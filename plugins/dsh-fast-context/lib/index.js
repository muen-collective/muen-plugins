/**
 * dsh-fast-context — Host half.
 *
 * One job: when a session opens, warm it before the user types.
 *
 *   agent/created (source 'startup')
 *     → debounce, guard, resolve cwd
 *     → ctx.subagents.start('spawn', …)   one read-only Explore child
 *     → run.result.structured             the evidence pack
 *     → cached per cwd
 *
 *   agent/pre-step (turn 1, step 1)
 *     → wait up to `waitMs` for that pack
 *     → prepend it as a plugin user message with form 'snapshot'
 *
 * The child is a real agent with its own model and tools, not a heuristic file
 * walk. The scan is the one thing this feature costs tokens for, and the pack is
 * the one thing the model gets instead of exploring on its own.
 *
 * This half deliberately imports nothing from `@deepseek-ai/*`. A workspace- or
 * profile-linked bundle cannot resolve several harness internals, which is the
 * wall that made `@muen/dsh-codex-fold` inert on its first install. Every seam
 * below is reached through `ctx.get(...)` and guarded, so a deployment without
 * the subagent registry mounts this plugin and does nothing.
 */

export const name = 'fast-context'
export const inject = []

/** The child's catalog label. The Client card finds the run by this string. */
const LABEL = 'Fast Context retrieval'
/** This plugin's id in every message source it writes. */
const PLUGIN = 'fast-context'

const DEFAULTS = {
  /** Master switch. A Settings row can flip this later; the row does not exist yet. */
  enabled: true,
  /** How long the first step may wait for the pack before going without it. */
  waitMs: 8000,
  /** Hard wall clock for the child. Past this it is disposed. */
  timeoutMs: 90000,
  /** Ignored for now: the tool filter is the real cap. Kept for the prompt. */
  maxToolSteps: 25,
  /** A pack this old is re-retrieved rather than reused. */
  cacheTtlMs: 20 * 60 * 1000,
  /** How long a freshly opened session must stay open before a run starts. */
  debounceMs: 400,
  /** Concurrent retrievals process-wide. */
  maxConcurrent: 2,
  /** Rendered pack ceiling, in characters. */
  maxPackChars: 12000,
  /** Empty means the child inherits the session's route. Pin these to override. */
  provider: '',
  model: '',
  reasoningEffort: '',
  /** One line per run in the app log. Flip to false once the card is the signal. */
  debug: true,
}

/** The Explore child's operating instructions. `spawn` applies this as a scoped persona. */
const PERSONA = [
  'You are an exploration agent. You are read-only and you are fast.',
  'You are given a workspace path and nothing else: no task, no question, no user.',
  'Your job is to describe the workspace to another agent that is about to work in it.',
  'Read only what the pack needs. Never read a source file just to summarise it.',
  'Every claim carries a path. Never guess a path you have not listed.',
  'Prefer the project\'s own words: if a file states a convention, quote it.',
  'Stop as soon as the pack is complete. Do not explore for completeness.',
  'Answer with the structured object only. No prose outside it.',
].join(' ')

/** The task. Numbered so the child can budget itself against the step count. */
const TASK = [
  'Map this workspace and return the structured pack.',
  '',
  '1. List the top two directory levels. Skip node_modules, .git, dist, build, .next,',
  '   coverage and __pycache__, and anything in .gitignore.',
  '2. Read AGENTS.md, README*, and the package manifest (package.json, Cargo.toml,',
  '   pyproject.toml or go.mod). Read the last 20 commits.',
  '3. Identify the entry points and the test / typecheck / lint / build commands.',
  '4. Extract the conventions a new contributor would get wrong, each with the file',
  '   and line that states it.',
  '5. Report anything you could not determine in `unresolved`. An honest gap is',
  '   worth more than a guess.',
].join('\n')

/**
 * The pack's shape. Kept to plain object/array/string so it survives whatever
 * structured-output runtime the provider applies. Every property is optional in
 * spirit — `renderPack` copes with a partial object, and `extractPack` falls back
 * to the child's text when `structured` never arrives.
 */
const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['workspace', 'stack', 'entryPoints', 'conventions'],
  properties: {
    workspace: {
      type: 'object',
      additionalProperties: false,
      required: ['path'],
      properties: {
        path: { type: 'string' },
        name: { type: 'string' },
      },
    },
    stack: {
      type: 'object',
      additionalProperties: false,
      required: ['languages'],
      properties: {
        languages: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['name'],
            properties: {
              name: { type: 'string' },
              share: { type: 'string' },
            },
          },
        },
        packageManager: { type: 'string' },
        frameworks: { type: 'array', items: { type: 'string' } },
        commands: {
          type: 'object',
          additionalProperties: false,
          properties: {
            test: { type: 'string' },
            typecheck: { type: 'string' },
            lint: { type: 'string' },
            build: { type: 'string' },
          },
        },
      },
    },
    layout: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['path'],
        properties: {
          path: { type: 'string' },
          files: { type: 'string' },
          note: { type: 'string' },
        },
      },
    },
    entryPoints: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['path', 'why'],
        properties: {
          path: { type: 'string' },
          why: { type: 'string' },
        },
      },
    },
    keyDocs: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['path', 'summary'],
        properties: {
          path: { type: 'string' },
          summary: { type: 'string' },
          mustFollow: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    conventions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['rule'],
        properties: {
          rule: { type: 'string' },
          evidence: { type: 'string' },
        },
      },
    },
    recentActivity: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['summary'],
        properties: {
          commit: { type: 'string' },
          summary: { type: 'string' },
        },
      },
    },
    unresolved: { type: 'array', items: { type: 'string' } },
  },
}

/** Fresh message identity. `MessageId` is a branded string at runtime. */
function newId() {
  const c = globalThis.crypto
  if (c !== undefined && typeof c.randomUUID === 'function') return c.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/** A non-empty string, or undefined. Keeps partial model output from becoming "undefined". */
function str(value) {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined
}

/** One "name: value" line, or null when the value is empty. */
function line(label, value) {
  const text = str(value)
  return text === undefined ? null : `${label}: ${text}`
}

/** Join the non-null lines, or return null when there are none. */
function lines(parts) {
  const kept = parts.filter((part) => part !== null && part !== undefined && part !== '')
  return kept.length === 0 ? null : kept.join('\n')
}

/**
 * Turn a structured pack into the named sections the transcript renders.
 *
 * The `snapshot` context form shows `source.sections` and nothing else, so every
 * byte the model should read has to be in one of these. Empty groups are dropped
 * rather than rendered as a heading with no content.
 */
export function renderPack(pack, cwd, maxChars) {
  if (pack === null || typeof pack !== 'object') return null
  const sections = []
  const push = (sectionName, text) => {
    if (text !== null && text !== undefined && text !== '') sections.push({ name: sectionName, text })
  }

  const workspace = pack.workspace ?? {}
  // The workspace path falls back to the cwd we already know, but the section
  // still needs the pack to have said *something*: a structured result that
  // parsed to `{}` must render nothing rather than a lone, useless path.
  if (str(workspace.path) !== undefined || str(workspace.name) !== undefined) {
    push('Workspace', lines([
      line('Path', str(workspace.path) ?? cwd),
      line('Name', workspace.name),
    ]))
  }

  const stack = pack.stack ?? {}
  const languages = Array.isArray(stack.languages)
    ? stack.languages
      .map((entry) => {
        if (typeof entry === 'string') return entry
        if (entry === null || typeof entry !== 'object') return null
        const langName = str(entry.name)
        if (langName === undefined) return null
        const share = str(entry.share)
        return share === undefined ? langName : `${langName} ${share}`
      })
      .filter((entry) => entry !== null)
    : []
  const commands = stack.commands ?? {}
  push('Stack', lines([
    line('Languages', languages.join(', ')),
    line('Package manager', stack.packageManager),
    line('Frameworks', Array.isArray(stack.frameworks) ? stack.frameworks.filter(str).join(', ') : undefined),
    line('Test', commands.test),
    line('Typecheck', commands.typecheck),
    line('Lint', commands.lint),
    line('Build', commands.build),
  ]))

  if (Array.isArray(pack.layout) && pack.layout.length > 0) {
    push('Layout', pack.layout
      .map((entry) => {
        if (entry === null || typeof entry !== 'object') return null
        const path = str(entry.path)
        if (path === undefined) return null
        const files = str(entry.files)
        const note = str(entry.note)
        const suffix = [files === undefined ? null : `${files} files`, note].filter(Boolean).join(' — ')
        return suffix === '' ? `- ${path}` : `- ${path} (${suffix})`
      })
      .filter((entry) => entry !== null)
      .join('\n'))
  }

  if (Array.isArray(pack.entryPoints) && pack.entryPoints.length > 0) {
    push('Entry points', pack.entryPoints
      .map((entry) => {
        if (entry === null || typeof entry !== 'object') return null
        const path = str(entry.path)
        if (path === undefined) return null
        const why = str(entry.why)
        return why === undefined ? `- ${path}` : `- ${path} — ${why}`
      })
      .filter((entry) => entry !== null)
      .join('\n'))
  }

  if (Array.isArray(pack.keyDocs) && pack.keyDocs.length > 0) {
    push('Key docs', pack.keyDocs
      .map((entry) => {
        if (entry === null || typeof entry !== 'object') return null
        const path = str(entry.path)
        if (path === undefined) return null
        const summary = str(entry.summary)
        const head = summary === undefined ? `- ${path}` : `- ${path} — ${summary}`
        const must = Array.isArray(entry.mustFollow) ? entry.mustFollow.filter(str) : []
        return must.length === 0 ? head : `${head}\n  must follow: ${must.join('; ')}`
      })
      .filter((entry) => entry !== null)
      .join('\n'))
  }

  if (Array.isArray(pack.conventions) && pack.conventions.length > 0) {
    push('Conventions', pack.conventions
      .map((entry) => {
        if (entry === null || typeof entry !== 'object') return null
        const rule = str(entry.rule)
        if (rule === undefined) return null
        const evidence = str(entry.evidence)
        return evidence === undefined ? `- ${rule}` : `- ${rule} (${evidence})`
      })
      .filter((entry) => entry !== null)
      .join('\n'))
  }

  if (Array.isArray(pack.recentActivity) && pack.recentActivity.length > 0) {
    push('Recent activity', pack.recentActivity
      .map((entry) => {
        if (entry === null || typeof entry !== 'object') return null
        const summary = str(entry.summary)
        if (summary === undefined) return null
        const commit = str(entry.commit)
        return commit === undefined ? `- ${summary}` : `- ${commit} ${summary}`
      })
      .filter((entry) => entry !== null)
      .join('\n'))
  }

  if (Array.isArray(pack.unresolved) && pack.unresolved.length > 0) {
    push('Unresolved', pack.unresolved.filter(str).map((item) => `- ${item}`).join('\n'))
  }

  if (sections.length === 0) return null

  // The ceiling is on the whole pack, so trim the last sections rather than
  // letting one long one blow the budget.
  let total = 0
  const kept = []
  for (const section of sections) {
    if (total >= maxChars) break
    const room = maxChars - total
    const text = section.text.length > room ? `${section.text.slice(0, Math.max(0, room - 1))}…` : section.text
    kept.push({ name: section.name, text })
    total += text.length
  }
  return kept
}

/** The joined text the model reads. Built from the same sections the transcript shows. */
function joinSections(sections) {
  return sections.map((section) => `## ${section.name}\n${section.text}`).join('\n\n')
}

/**
 * The child's answer, as a pack.
 *
 * `structured` is the happy path. When the provider never fills it, the child's
 * text is tried as fenced JSON and, failing that, is kept verbatim as one
 * section — a slightly worse pack beats no pack.
 */
export function extractPack(result) {
  const structured = result?.structured
  if (structured !== null && typeof structured === 'object') return { pack: structured }

  const text = Array.isArray(result?.output)
    ? result.output
      .filter((block) => block !== null && typeof block === 'object' && block.type === 'text')
      .map((block) => (typeof block.text === 'string' ? block.text : ''))
      .join('\n')
      .trim()
    : ''
  if (text === '') return { pack: null }

  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text)
  const candidate = fenced === null ? text : fenced[1]
  try {
    const parsed = JSON.parse(candidate)
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) return { pack: parsed }
  } catch (error) {
    // not JSON: fall through to the raw text
  }
  return { pack: null, raw: text }
}

export function apply(ctx, config = {}) {
  const options = Object.assign({}, DEFAULTS, config)
  const log = (...args) => {
    if (options.debug) console.log('[fast-context]', ...args)
  }
  log('mounted', {
    waitMs: options.waitMs,
    enabled: options.enabled,
    subagents: ctx.get('subagents') !== undefined,
  })

  /** sessionId -> { state, sections, text, done, childId, startedAt, consumed } */
  const bySession = new Map()
  /** cwd -> { sections, text, stamp, at } */
  const cache = new Map()
  /** cwd -> Promise, so two sessions on one workspace share one run. */
  const inFlight = new Map()
  /** Sessions where a model step has begun. The real "this session is in use" signal. */
  const stepped = new Set()
  /** Timers we own, cleared on disposal. */
  const timers = new Set()

  ctx.effect(() => () => {
    for (const timer of timers) clearTimeout(timer)
    timers.clear()
    for (const entry of inFlight.values()) {
      Promise.resolve(entry).catch(() => {})
    }
    inFlight.clear()
    bySession.clear()
    stepped.clear()
  }, 'fast-context: state')

  function later(fn, delay) {
    const timer = setTimeout(() => {
      timers.delete(timer)
      try {
        fn()
      } catch (error) {
        console.error('[fast-context] timer failed', error)
      }
    }, delay)
    timers.add(timer)
    return timer
  }

  /**
   * Resolve the workspace stamp: git HEAD plus the mtimes of the two files whose
   * change most often invalidates a map. Both are optional; without them the
   * cache degrades to TTL-only.
   */
  async function stampOf(cwd) {
    const fs = ctx.get('fs')
    if (fs === undefined || typeof fs.resolve !== 'function') return ''
    const parts = []
    for (const name of ['AGENTS.md', 'package.json']) {
      try {
        const target = await fs.resolve(`${cwd}/${name}`)
        const info = await fs.stat(target)
        parts.push(info === undefined ? `${name}:gone` : `${name}:${info.mtimeMs ?? info.mtime ?? 0}`)
      } catch (error) {
        parts.push(`${name}:missing`)
      }
    }
    return parts.join('|')
  }

  function takeCached(cwd) {
    const hit = cache.get(cwd)
    if (hit === undefined) return null
    if (Date.now() - hit.at > options.cacheTtlMs) return null
    return hit
  }

  /** Run the Explore child and resolve to { sections, text } or null. */
  async function retrieve(agent, cwd) {
    const subagents = ctx.get('subagents')
    if (subagents === undefined || typeof subagents.start !== 'function') return null
    const providers = typeof subagents.list === 'function' ? subagents.list() : []
    if (!Array.isArray(providers) || providers.indexOf('spawn') === -1) {
      log('no spawn provider; nothing to run')
      return null
    }

    const controller = new AbortController()
    // Empty by default: the child inherits the parent's route. Reasoning-effort
    // ids come from the host's per-model catalog, so guessing one here would be a
    // start-time failure on any route that does not offer it.
    const agentOptions = {}
    for (const key of ['provider', 'model', 'reasoningEffort']) {
      const value = options[key]
      if (typeof value === 'string' && value !== '') agentOptions[key] = value
    }

    let run
    try {
      run = await subagents.start('spawn', {
        label: LABEL,
        prompt: [{ type: 'text', text: TASK }],
        parent: agent,
        signal: controller.signal,
        agentOptions,
        toolFilter: { allow: ['read', 'grep', 'glob'] },
        persona: PERSONA,
        outputSchema: OUTPUT_SCHEMA,
      })
    } catch (error) {
      console.error('[fast-context] start failed', error)
      return null
    }

    const startedAt = Date.now()
    log('running', { cwd, child: run?.id, model: agentOptions.model ?? 'inherited' })

    const timer = setTimeout(() => {
      timers.delete(timer)
      log('timeout, disposing', { cwd, child: run?.id })
      Promise.resolve(run?.dispose?.()).catch(() => {})
    }, options.timeoutMs)
    timers.add(timer)

    let result
    try {
      result = await run.result
    } catch (error) {
      console.error('[fast-context] run rejected', error)
      result = undefined
    } finally {
      clearTimeout(timer)
      timers.delete(timer)
      Promise.resolve(run?.dispose?.()).catch(() => {})
    }

    const stopReason = result?.stopReason
    if (stopReason !== undefined && stopReason !== 'completed') {
      log('child stopped early', { cwd, stopReason, diagnostic: result?.diagnostic })
    }

    const extracted = extractPack(result)
    const sections = extracted.pack !== null
      ? renderPack(extracted.pack, cwd, options.maxPackChars)
      : (extracted.raw === undefined
        ? null
        : [{ name: 'Workspace notes', text: extracted.raw.slice(0, options.maxPackChars) }])
    if (sections === null || sections.length === 0) {
      log('no usable pack', { cwd, stopReason })
      return null
    }
    const text = joinSections(sections)
    const stamp = await stampOf(cwd)
    cache.set(cwd, { sections, text, stamp, at: Date.now() })
    log('pack ready', { cwd, sections: sections.length, chars: text.length, ms: Date.now() - startedAt })
    return { sections, text }
  }

  /** One workspace, one run. A second session on the same cwd joins the first. */
  function retrieveOnce(agent, cwd) {
    const existing = inFlight.get(cwd)
    if (existing !== undefined) return existing
    const work = retrieve(agent, cwd)
      .catch((error) => {
        console.error('[fast-context] retrieval failed', error)
        return null
      })
      .finally(() => {
        inFlight.delete(cwd)
      })
    inFlight.set(cwd, work)
    return work
  }

  /** Start (or adopt) the run for one session, and record it for the pre-step to find. */
  async function begin(agent, cwd) {
    const cached = takeCached(cwd)
    if (cached !== null) {
      // A stamp mismatch only matters when we can compute one; otherwise the TTL decided.
      const stamp = await stampOf(cwd)
      if (stamp === '' || cached.stamp === '' || cached.stamp === stamp) {
        log('cache hit', { cwd, ago: Date.now() - cached.at })
        bySession.set(agent.id, {
          state: 'ready',
          sections: cached.sections,
          text: cached.text,
          done: Promise.resolve(),
          consumed: false,
          source: 'cache',
        })
        return
      }
      cache.delete(cwd)
    }

    if (inFlight.size >= options.maxConcurrent) {
      log('at capacity, skipping', { cwd, inFlight: inFlight.size })
      return
    }

    const entry = {
      state: 'running',
      sections: null,
      text: null,
      startedAt: Date.now(),
      consumed: false,
    }
    entry.done = retrieveOnce(agent, cwd).then((pack) => {
      if (pack === null) {
        entry.state = 'failed'
        return
      }
      entry.state = 'ready'
      entry.sections = pack.sections
      entry.text = pack.text
    })
    bySession.set(agent.id, entry)
  }

  ctx.on('agent/created', (payload) => {
    // Serial mode: every listener is awaited before creation resolves, and a
    // throw fails the session. Never await anything here.
    try {
      if (options.enabled !== true) return
      if (payload?.source !== 'startup') return
      const agent = payload.agent
      const session = agent?.session
      const header = session?.header
      if (agent === undefined || session === undefined || header === undefined) return
      // Children are created through this same path. Without this guard the
      // retrieval agent would trigger a retrieval of its own.
      if (header.origin === 'subagent') return
      if ((header.delegationDepth ?? 0) > 0) return
      const cwd = str(header.cwd)
      if (cwd === undefined) return
      const subagents = ctx.get('subagents')
      if (subagents === undefined || typeof subagents.start !== 'function') return

      log('new session', { session: agent.id, cwd })
      later(() => {
        // "Still new" cannot be read off `session.seq`: a fresh Session's log is
        // not empty, because the seed marker already occupies a seq. The signal
        // that actually matters is whether a step has begun — that only happens
        // once the user has sent something.
        if (stepped.has(agent.id)) {
          log('session already stepped, skipping', { session: agent.id })
          return
        }
        begin(agent, cwd).catch((error) => {
          console.error('[fast-context] begin failed', error)
        })
      }, options.debounceMs)
    } catch (error) {
      console.error('[fast-context] trigger failed', error)
    }
  })

  /** Resolve when `promise` settles or the budget runs out. Never rejects. */
  function boundedWait(promise, ms, signal) {
    return new Promise((resolve) => {
      let settled = false
      const finish = () => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        if (signal !== undefined && typeof signal.removeEventListener === 'function') {
          signal.removeEventListener('abort', finish)
        }
        resolve()
      }
      const timer = setTimeout(finish, ms)
      if (signal !== undefined && typeof signal.addEventListener === 'function') {
        signal.addEventListener('abort', finish, { once: true })
      }
      Promise.resolve(promise).then(finish, finish)
    })
  }

  ctx.on('agent/pre-step', async (payload, next) => {
    // Recorded before anything else: this is what tells a pending debounce that
    // the session is no longer untouched.
    if (payload?.agent !== undefined) stepped.add(payload.agent.id)
    const decision = await next()
    try {
      if (decision.kind === 'reject') return decision
      if (payload?.turn !== 1 || payload?.step !== 1) return decision
      const agent = payload.agent
      const entry = bySession.get(agent?.id)
      if (entry === undefined || entry.consumed === true) return decision

      if (entry.state === 'running') {
        await boundedWait(entry.done, options.waitMs, payload.signal)
      }
      if (entry.state !== 'ready' || entry.text === null) return decision
      entry.consumed = true

      const text = `Workspace context was retrieved before your first message. `
        + `Use it instead of exploring the repository yourself.\n\n${entry.text}`
      const message = {
        id: `fast-context-${newId()}`,
        role: 'user',
        content: [{ type: 'text', text }],
        source: {
          // Session format v4 retired the wrapper form `{ kind: 'plugin', plugin }`
          // and refuses it on admission; a plugin's own kind is `plugin:<name>`.
          kind: `plugin:${PLUGIN}`,
          form: 'snapshot',
          sections: entry.sections,
        },
      }
      log('injected', { session: agent.id, sections: entry.sections.length, chars: text.length })
      return { ...decision, messages: [message, ...decision.messages] }
    } catch (error) {
      // An injection that fails must never cost the user their turn.
      console.error('[fast-context] injection failed', error)
      return decision
    }
  })

  // Exposed for a future Settings row and for the Client card's Preview. Reading
  // it invokes nothing; the card reads run state from the subagent catalog.
  ctx.provide('fastContext', {
    /** The pack for one session, or null. */
    packOf(sessionId) {
      const entry = bySession.get(sessionId)
      if (entry === undefined || entry.state !== 'ready') return null
      return { sections: entry.sections, text: entry.text, source: entry.source ?? 'run', consumed: entry.consumed }
    },
    /** Cached packs, by workspace. */
    cacheEntries() {
      return [...cache.entries()].map(([cwd, hit]) => ({ cwd, at: hit.at, sections: hit.sections.length }))
    },
    /** Options in force, for diagnostics. */
    options() {
      return { ...options }
    },
  })
}

export default { name, inject, apply }
