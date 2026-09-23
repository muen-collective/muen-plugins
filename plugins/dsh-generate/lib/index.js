/**
 * @muen/dsh-generate — host half (Epic 61, S1 + S2 + S3 + the provider registry).
 *
 * WHAT THIS IS: the keys and the install. The browser never holds a provider's key,
 * so every conversation with a provider happens here, in the host process, behind two
 * rules the epic's safety section makes imperative (§12):
 *
 *   2. The browser never sees the key. No key in page state, no key in
 *      `localStorage`, no key echoed by a route response.
 *   3. One user's key, one user's account. Nothing here reads an ambient Muen
 *      key; the reference below is the *user's* own name for their own key, and
 *      the status route reports where the value came from so the surface can say
 *      so out loud.
 *
 * ROUTES — the provider registry, one prefix, all under the plugin's own namespace
 * (S2's single wallet route became the per-provider key route when the plugin turned
 * provider-neutral):
 *
 *   GET    /plugins/generate/providers                → every provider: its key state,
 *                                                       its installed workflows, and
 *                                                       whether the panel draws it
 *   GET    /plugins/generate/providers/<id>/key       → that provider's key state
 *   POST   /plugins/generate/providers/<id>/key       → { key } — check, then store
 *   DELETE /plugins/generate/providers/<id>/key       → unlink
 *   GET    /plugins/generate/providers/<id>/workflows → what it has installed
 *   GET    /plugins/generate/providers/<id>/workflow?name=  → one workflow, whole
 *   GET    /plugins/generate/providers/<id>/hidden    → whether the panel draws it
 *   POST   /plugins/generate/providers/<id>/hidden    → { hidden } — the settings toggle
 *
 * FOUR PROVIDERS (providers.js), in the order every surface shows them: RunningHub,
 * Krea, Comfy Cloud, Magnific. Every route is provider-addressed, so a fifth provider
 * is one object in that file.
 *
 * S3 ADDS THE INSTALL, and it is two tools and a skill, not a route:
 *
 *   rh_workflow_graph      reads an app's exposed doors from RunningHub
 *   rh_adapter_validate    checks a written adapter against the live app
 *   add-rh-workflow        the skill that names the doors and confirms before
 *                          anything is written
 *
 * The install flow is the pane's, with no model at all (§2b, D15): the API already
 * answers with types, options, bounds, defaults and tooltips, the glossary covers
 * the label, and the agent is the polish path rather than a dependency. So the
 * tools here are read-only and the plugin writes no adapter file: the agent writes
 * it with its own file tools, which is why "nothing is written before the user
 * confirms" is structural rather than a promise.
 *
 * WHERE THE KEY LIVES (epic 61 D1): the `credentials` seam, as a
 * `CredentialRef` — the half of that service that answers "what is behind this
 * environment-variable name". Naming RunningHub's `RH_API_KEY` is what makes the
 * founder's existing env file a fallback rather than a second place to paste the key:
 * the service layers the process environment, its own writable store, and `.env`
 * files, and `set` refuses while a read-only source shadows the reference. So a
 * change that cannot take effect fails loudly instead of appearing to work while
 * the old value keeps resolving.
 *
 * THE KEY IS VALIDATED BY ONE CHEAP READ (epic 61 §9). A wrong key fails at the
 * moment it is entered, at the field, instead of three screens later inside a paid
 * run. That read is also the gate on the write: the key reaches the seam only after
 * the provider accepted it — except where a provider answers about the key without
 * accepting it, which is stored and reported unverified (providers.js).
 *
 * WHAT THIS DOES NOT DO YET: submit a task (S5), price a run (§15 D5), or render
 * the guide card's flyout (S4). It reads one account, reads one app's doors, and
 * checks one adapter file.
 *
 * @module @muen/dsh-generate
 */
import { readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

import { parseAppRef, readAppDoors } from './doors.js'
import { loadHouse } from './house.js'
import { ADAPTER_SCHEMA, adapterFromDoors, validateAdapter } from './adapter.js'
import { PROVIDERS, normalizeKey, providerById, runninghub } from './providers.js'
import { readHidden, withHidden, writeHidden } from './hidden.js'
import { resolveDataRoot } from './paths.js'

/** Matches the row id in cordis.patch.yml. */
export const name = 'generate'

/**
 * The provider routes. One exact path answers the list, and the prefix owns
 * everything under `/providers/<id>/` — each provider's key and its workflows. A
 * distinct (kind, path) per registration is what the web server requires, and these
 * two are distinct entries in two tables.
 *
 * THE PREFIX CARRIES NO TRAILING SLASH, and that is a contract, not a style.
 * Measured against the harness's own matcher on 2026-09-23
 * (`@deepseek-ai/dsh-host-webserver`, `match()`): a prefix claims a request when
 * `pathname === prefix` or `pathname.startsWith(prefix + '/')` — the matcher appends
 * the slash itself. Register `'…/providers/'` and that second test becomes
 * `startsWith('…/providers//')`, so ONLY the bare path ever matches: every
 * `/providers/<id>/…` request falls through to the SPA fallback and comes back 404
 * with an empty body. That is the failure the founder hit on Krea — "The provider
 * could not be reached" for a request that never left the machine — and it broke
 * every provider's key, workflow list and workflow read at once.
 */
const PROVIDERS_PATH = '/plugins/generate/providers'
const PROVIDERS_PREFIX = '/plugins/generate/providers'
const TIMEOUT_MS = 15000

/** Refuse a body past this — a key is tens of bytes, and the route is reachable. */
const MAX_BODY_BYTES = 4096

/** S3's two hands (§7): what the agent reads with, and what proves the file. */
const TOOL_GRAPH = 'rh_workflow_graph'
const TOOL_VALIDATE = 'rh_adapter_validate'

/** The skill that does the naming, shipped inside this package (§5 rule 4). */
const SKILL_NAME = 'add-rh-workflow'
const SKILL_DESCRIPTION =
  'Add a RunningHub AI App to the Generate panel: read the app\'s exposed inputs, name each door in the user\'s words, confirm the list, then write and validate the adapter file.'
const SKILL_WHEN_TO_USE =
  'Use when the user wants to add, install or register a RunningHub workflow or AI App (they give a runninghub.ai app link or an app id), or says "add workflow".'
const SKILL_FILE = fileURLToPath(new URL('../skills/add-rh-workflow/SKILL.md', import.meta.url))

function str(value) {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null
}

/**
 * The user's key for one provider, resolved for a read.
 *
 * Kept apart from the route's status read so a missing key is one outcome rather than
 * an exception three calls deep, and so the two agent-facing tools (which read the
 * live app) ask for it the same way the routes do.
 */
async function resolveKey(ctx, provider) {
  const credentials = typeof ctx.get === 'function' ? ctx.get('credentials') : undefined
  if (!credentials) return { error: 'no-credentials' }
  try {
    const info = await credentials.describe(provider.keyRef)
    if (!info || !info.configured) return { error: 'no-key' }
    const resolved = await credentials.resolve(provider.keyRef)
    if (!resolved || !resolved.value) return { error: 'no-key' }
    return { key: resolved.value, source: str(info.source) || str(resolved.source) || null }
  } catch {
    return { error: 'credentials-unavailable' }
  }
}

/** JSON out, never cached, never carrying a secret. */
function send(res, status, body) {
  const text = JSON.stringify(body)
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Content-Length', Buffer.byteLength(text))
  res.end(text)
}

function methodNotAllowed(res, allow) {
  res.setHeader('Allow', allow)
  send(res, 405, { error: 'method-not-allowed' })
}

/** The request body, bounded and parsed. Resolves undefined when unusable. */
function readJsonBody(req) {
  return new Promise((resolve) => {
    let size = 0
    const chunks = []
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        resolve(undefined)
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      if (chunks.length === 0) return resolve({})
      try {
        const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'))
        resolve(parsed && typeof parsed === 'object' ? parsed : undefined)
      } catch {
        resolve(undefined)
      }
    })
    req.on('error', () => resolve(undefined))
  })
}

/** One text block, the shape every tool render returns. */
function text(value) {
  return [{ type: 'text', text: String(value) }]
}

/** The one-line result a tool shows on its card. */
function line(parts) {
  return parts.filter((part) => part !== null && part !== undefined && part !== '').join(' · ')
}

/** What the root resolution answered, said out loud rather than assumed. */
function rootNote(root) {
  if (root.kind === 'override') return 'adapters directory pinned by RH_DATA_DIR'
  if (root.kind === 'profile') return 'adapters directory is inside profile "' + root.profile + '"'
  return 'no --profile was found in this process, so the adapters directory is $DSH_HOME/generate'
}

/**
 * Register the two read-only tools.
 *
 * They are registered host-wide on purpose: the install is a conversation with the
 * user's own agent, in whatever session they are in. `roles` is not used here
 * because the epic's UI is agent-facing and the gate (§12 rule 1) lives in the
 * pane, not in a role check.
 */
function mountTools(ctx, { base, paths, root }) {
  const tools = typeof ctx.get === 'function' ? ctx.get('tools') : undefined
  if (!tools || typeof tools.register !== 'function') return false

  ctx.effect(
    () =>
      tools.register({
        name: TOOL_GRAPH,
        description:
          'Read a RunningHub AI App\'s exposed inputs (its "doors") and return everything a surface needs: each input\'s node id, field name, control type, the app\'s own options, bounds, default and tooltip, a glossary label, and a starter adapter object. Read-only: it spends no coins, submits no run, and writes no file. Use it with the app link the user pasted, before asking them to confirm anything.',
        parameters: {
          type: 'object',
          properties: {
            link: {
              type: 'string',
              description: 'The RunningHub app link or id, exactly as the user gave it (e.g. https://www.runninghub.ai/app/2072445848017002498).',
            },
            title: { type: 'string', description: 'Optional label for the starter adapter; the app\'s own name is used when omitted.' },
          },
          required: ['link'],
        },
        output: {
          schema: { type: 'object' },
          render: (_args, value) =>
            value && value.ok
              ? text(
                  line([
                    '[runninghub] ' + (value.app.webappName || value.app.appId),
                    value.app.doors.length + ' door(s)',
                    value.adaptersDir,
                  ]),
                )
              : text('[runninghub] ' + String((value && (value.detail || value.error)) || 'failed')),
        },
        async execute(args) {
          const ref = parseAppRef(args && args.link)
          if (ref.error) {
            return {
              ok: false,
              error: ref.error,
              detail:
                ref.error === 'missing-link'
                  ? 'no app link was given; ask the user for the RunningHub app link or id'
                  : 'that does not look like a RunningHub app link or id; ask for it again',
            }
          }
          const key = await resolveKey(ctx, runninghub)
          if (key.error) {
            return {
              ok: false,
              error: key.error,
              detail:
                key.error === 'no-key'
                  ? 'no RunningHub key is linked to this profile yet; the user links one in Settings → Generate, and their wallet step has to come first'
                  : 'the credentials service is unavailable in this profile, so the key cannot be read',
            }
          }
          const loaded = await loadHouse(paths.house)
          const read = await readAppDoors({ base, key: key.key, appId: ref.appId, house: loaded.house, timeoutMs: TIMEOUT_MS })
          if (read.error) {
            return {
              ok: false,
              error: read.error,
              code: read.code,
              detail:
                read.error === 'access-encrypted'
                  ? 'this app does not expose an API we can call yet; write nothing'
                  : read.detail || (read.error === 'api-error' ? 'RunningHub refused the read' : read.error),
            }
          }

          const app = read.app
          const unsupported = app.doors.filter((door) => !door.supported)
          return {
            ok: true,
            schema: ADAPTER_SCHEMA,
            root: paths.root,
            rootKind: root.kind,
            adaptersDir: paths.adapters,
            housePath: paths.house,
            houseSource: loaded.source,
            houseWarning: loaded.warning || null,
            notes: [
              rootNote(root),
              'the API declares no requiredness, so no door is marked required',
              unsupported.length > 0
                ? unsupported.length + ' input(s) use a control this plugin does not render (' +
                  unsupported.map((door) => door.fieldName).join(', ') + '); offer to drop them'
                : null,
              app.doors.some((door) => !door.fromGlossary)
                ? 'some labels came from the field name rather than the glossary; say which, and offer better ones'
                : null,
              'write nothing until the user confirms the door list',
            ].filter((note) => note !== null),
            app,
            house: {
              runLabel: loaded.house.runLabel,
              mainDoors: loaded.house.mainDoors,
              advancedFieldNames: loaded.house.advancedFieldNames,
              advancedTypes: loaded.house.advancedTypes,
              glossary: loaded.house.glossary,
              hint: loaded.house.hint,
            },
            adapter: adapterFromDoors({ app, house: loaded.house, url: ref.url, title: args && args.title ? String(args.title) : null }),
          }
        },
      }),
    'generate: tool ' + TOOL_GRAPH,
  )

  ctx.effect(
    () =>
      tools.register({
        name: TOOL_VALIDATE,
        description:
          'Check a written RunningHub adapter against the live app: every door must be a (nodeId, fieldName) pair the app exposes, every control type must be one the pane renders, and every value copied from the app (options, min, max, step, default, multiline, tooltip) must still match it. Read-only: re-reading the app is the dry run, and it spends no coins. Call it after writing the adapter file and again after every fix, until it reports ok.',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Path to the adapter JSON file that was written.' },
            adapter: { type: 'object', description: 'The adapter object itself, when it is not on disk yet.' },
          },
          required: [],
        },
        output: {
          schema: { type: 'object' },
          render: (_args, value) =>
            value && value.ok
              ? text('[runninghub] adapter ok · ' + value.doors + ' door(s) match the live app')
              : text(
                  '[runninghub] ' +
                    (value && value.problems
                      ? value.problems.length + ' problem(s): ' + value.problems.map((problem) => problem.code).join(', ')
                      : String((value && (value.detail || value.error)) || 'failed')),
                ),
        },
        async execute(args) {
          let adapter = args && args.adapter
          if (!adapter) {
            const path = args && typeof args.path === 'string' ? args.path.trim() : ''
            if (path === '') {
              return { ok: false, error: 'missing-adapter', detail: 'give the adapter file path, or the adapter object' }
            }
            let raw
            try {
              raw = await readFile(path, 'utf8')
            } catch (error) {
              return { ok: false, error: 'unreadable', detail: path + ' could not be read: ' + String((error && error.message) || error) }
            }
            try {
              adapter = JSON.parse(raw)
            } catch (error) {
              return { ok: false, error: 'invalid-json', detail: path + ' is not valid JSON: ' + String((error && error.message) || error) }
            }
          }

          const appId = adapter && adapter.source && typeof adapter.source.appId === 'string' ? adapter.source.appId.trim() : ''
          if (appId === '') {
            return {
              ok: false,
              error: 'no-app',
              problems: [{ code: 'source', detail: 'the adapter declares no source.appId, so there is no app to check it against' }],
            }
          }
          const key = await resolveKey(ctx, runninghub)
          if (key.error) return { ok: false, error: key.error, detail: 'the key could not be read, so nothing can be checked against the live app' }

          const loaded = await loadHouse(paths.house)
          const read = await readAppDoors({ base, key: key.key, appId, house: loaded.house, timeoutMs: TIMEOUT_MS })
          if (read.error) {
            return {
              ok: false,
              error: read.error,
              code: read.code,
              detail: read.detail || 'the live app could not be read, so the adapter is unverified rather than wrong',
            }
          }

          const result = validateAdapter(adapter, { app: read.app })
          return {
            ok: result.ok,
            doors: result.doors,
            problems: result.problems,
            app: { appId: read.app.appId, webappName: read.app.webappName },
            detail: result.ok
              ? 'every door matches the live app; now set provenance.dryRun to "ok" and write the file once more'
              : 'fix every problem and run this tool again',
          }
        },
      }),
    'generate: tool ' + TOOL_VALIDATE,
  )

  return true
}

/**
 * Register the shipped skill.
 *
 * The skill travels inside this package (§5 rule 4: its own copy, never a
 * dependency on Muen's translation pack) and is read at apply time, so the host
 * process serves the same text that is in the repo. A missing file is reported and
 * skipped rather than thrown: a plugin that fails to load is worse than one
 * without its skill.
 */
function mountSkill(ctx) {
  const skills = typeof ctx.get === 'function' ? ctx.get('skills') : undefined
  if (!skills || typeof skills.register !== 'function') return false
  let content
  try {
    content = readFileSync(SKILL_FILE, 'utf8')
  } catch (error) {
    if (ctx.logger && typeof ctx.logger.warn === 'function') {
      ctx.logger.warn('generate: the skill file could not be read at ' + SKILL_FILE + ': ' + String((error && error.message) || error))
    }
    return false
  }
  ctx.effect(
    () =>
      skills.register({
        name: SKILL_NAME,
        description: SKILL_DESCRIPTION,
        whenToUse: SKILL_WHEN_TO_USE,
        invocation: { modelInvocable: true, userInvocable: true },
        source: 'runtime',
        provider: 'runninghub',
        path: SKILL_FILE,
        resourceBase: { kind: 'directory', path: dirname(SKILL_FILE) },
        content,
      }),
    'generate: skill ' + SKILL_NAME,
  )
  return true
}

/**
 * Mount the provider routes.
 *
 * ONE ROUTER, ONE PREFIX. The plugin owns `/plugins/generate/` and answers everything
 * under `/plugins/generate/providers`: the provider list, each provider's key, and
 * each provider's workflows. A route per provider per action would have been three
 * registrations per provider; a prefix route keeps the surface's own namespace ours
 * and puts the provider id in the path, which is where a reader expects it. The
 * prefix is registered WITHOUT a trailing slash — see `PROVIDERS_PREFIX` for the
 * measured reason.
 *
 * `credentials` is read per request rather than captured, which is what the seam asks
 * for: resolution is per call, so a credential changed elsewhere reaches the next
 * request without a restart of the plugin.
 */
export function apply(ctx, config = {}) {
  const base = str(config.base) || str(process.env.RH_BASE) || null

  // Resolved before the routes mount, because the provider routes answer from these
  // directories and the tools below report the same resolution (§4: one root, said
  // out loud once).
  const root = resolveDataRoot()

  /**
   * The host one provider is asked at.
   *
   * `config.base` / `RH_BASE` predates the second provider and stays what it was: an
   * override for the verify scripts and a pinned deployment. With four providers it
   * can only name RunningHub's host — one override cannot mean four hosts, and letting
   * it rewrite every provider would send Krea's key to RunningHub's server.
   */
  const baseFor = (provider) => (provider.id === 'runninghub' ? base || provider.base : provider.base)

  /**
   * What every row says about a provider, whatever the state of its key.
   *
   * The page's own copy comes from here rather than from the browser half, because it
   * is provider data: the label, the family the settings page tags it with, the page
   * that issues the key and what that page is called, the page a person manages the
   * account at, what using the provider costs (`funding` — the row draws the sentence
   * from its `kind` and links its `url`), and the sentence that installs one of
   * its workflows. No key and no credential reference: a route answers a page.
   */
  const identity = (provider) => ({
    id: provider.id,
    label: provider.label,
    kind: provider.kind,
    keyPageLabel: provider.keyPageLabel,
    keyUrl: provider.keyUrl,
    accountUrl: provider.accountUrl,
    funding: provider.funding,
    addPrompt: provider.addPrompt,
  })

  /**
   * The key state of one provider: what the pane and Settings both read.
   *
   * `linked` is "a value resolves"; `verified` is "the provider answered about it".
   * They are two facts, and a provider can hold the first without the second: a key
   * whose subscription has lapsed (Comfy Cloud's 429), whose API balance is empty
   * (Krea's 402), or whose entitlement Magnific never confirms (its 403) is stored and
   * reported unverified rather than thrown away (founder,
   * 2026-09-23: *"store it and mark it unverified"*). `note` carries the caveat when
   * there is one.
   */
  const keyStatus = async (provider) => {
    const empty = { ...identity(provider), linked: false, verified: false, writable: false, source: null, account: null, note: null, error: null }
    const credentials = typeof ctx.get === 'function' ? ctx.get('credentials') : undefined
    if (!credentials) return { ...empty, error: 'no-credentials' }

    let info
    try {
      info = await credentials.describe(provider.keyRef)
    } catch {
      return { ...empty, error: 'credentials-unavailable' }
    }
    if (!info || !info.configured) return { ...empty, writable: !!info.writable }

    let resolved
    try {
      resolved = await credentials.resolve(provider.keyRef)
    } catch {
      return { ...empty, writable: !!info.writable, error: 'credentials-unavailable' }
    }
    if (!resolved || !resolved.value) return { ...empty, writable: !!info.writable }

    const probe = await provider.account({ base: baseFor(provider), key: resolved.value })
    return {
      ...empty,
      linked: true,
      verified: !!probe.account,
      writable: !!info.writable,
      source: str(info.source) || str(resolved.source) || null,
      account: probe.account || null,
      note: probe.note || null,
      error: probe.error || null,
    }
  }

  /** Every provider, with its key state, how many workflows it has, and its switch. */
  const providerList = async () => {
    const hidden = await readHidden(root.root)
    const rows = []
    for (const provider of PROVIDERS) {
      const status = await keyStatus(provider)
      const paths = provider.data(root.root)
      let workflows = 0
      try {
        const listed = await provider.listWorkflows({ dir: paths.adapters, root: root.root })
        workflows = listed.entries.length
      } catch {
        // A provider whose directory cannot be read is still a provider: the key
        // state is what this route is for, and the workflow count is a courtesy.
        workflows = null
      }
      rows.push({ ...status, workflows, hidden: hidden.includes(provider.id) })
    }
    return { providers: rows }
  }

  /**
   * The settings toggle: whether the Generate panel draws this provider.
   *
   * It writes one id to one small file and changes nothing else — no credential is
   * touched, no adapter is moved, no route stops answering for it. The row itself stays
   * in Settings, which is what makes the switch reversible from where it was thrown.
   */
  const providerHidden = async (provider, req, res) => {
    const method = (req.method || 'GET').toUpperCase()

    if (method === 'GET') {
      const hidden = await readHidden(root.root)
      send(res, 200, { id: provider.id, hidden: hidden.includes(provider.id), hiddenIds: hidden })
      return
    }

    if (method !== 'POST') {
      methodNotAllowed(res, 'GET, POST')
      return
    }

    const body = await readJsonBody(req)
    if (body === undefined || typeof body.hidden !== 'boolean') {
      send(res, 400, { error: 'bad-request', detail: '"hidden" must be true or false' })
      return
    }

    const current = await readHidden(root.root)
    const next = await writeHidden(root.root, withHidden(current, provider.id, body.hidden))
    send(res, 200, { id: provider.id, hidden: body.hidden, hiddenIds: next })
  }

  /** One provider's key: read, link, or remove. The wallet route, per provider. */
  const providerKey = async (provider, req, res) => {
    const method = (req.method || 'GET').toUpperCase()
    const credentials = typeof ctx.get === 'function' ? ctx.get('credentials') : undefined

    if (method === 'GET') {
      send(res, 200, await keyStatus(provider))
      return
    }

    if (method === 'POST') {
      const body = await readJsonBody(req)
      if (body === undefined) {
        send(res, 400, { error: 'bad-request' })
        return
      }
      // A key the wire cannot carry is refused here, with its own reason: a pasted
      // line break or smart quote used to come back as "the provider could not be
      // reached", which blamed the network for a request that was never made.
      const shape = normalizeKey(body.key)
      if (shape.error) {
        send(res, 400, { error: shape.error })
        return
      }
      const key = shape.key
      const probe = await provider.account({ base: baseFor(provider), key })
      // A key the provider could not check is still the user's key: it is stored and
      // the row reports it unverified. A key the provider REFUSED is never stored —
      // an unvalidated secret is worse than no secret.
      if (!probe.account && probe.unverified !== true) {
        send(res, probe.error === 'invalid-key' ? 400 : 502, {
          ...identity(provider),
          linked: false,
          verified: false,
          writable: true,
          source: null,
          account: null,
          note: null,
          error: probe.error,
        })
        return
      }
      if (!credentials) {
        send(res, 503, { error: 'no-credentials' })
        return
      }
      try {
        await credentials.set(provider.keyRef, key)
      } catch (error) {
        // The seam refuses while a read-only source shadows the reference. Say
        // which, because "the key did not change" is otherwise unexplainable.
        send(res, 409, {
          ...identity(provider),
          linked: true,
          verified: !!probe.account,
          writable: false,
          source: null,
          account: probe.account || null,
          note: probe.note || null,
          error: 'read-only',
          detail: String((error && error.message) || error),
        })
        return
      }
      send(res, 200, {
        ...identity(provider),
        linked: true,
        verified: !!probe.account,
        writable: true,
        // The seam's own word for the value it manages: a `credentials` read after
        // this save reports `file`, and the surface's note is keyed on that. It said
        // `store` here until 2026-09-22, which no read ever confirms — the strip then
        // called a pasted key "from your environment".
        source: 'file',
        account: probe.account || null,
        note: probe.note || null,
        error: null,
      })
      return
    }

    if (method === 'DELETE') {
      if (!credentials) {
        send(res, 503, { error: 'no-credentials' })
        return
      }
      try {
        await credentials.unset(provider.keyRef)
      } catch (error) {
        send(res, 409, {
          ...identity(provider),
          linked: true,
          verified: false,
          writable: false,
          source: null,
          account: null,
          note: null,
          error: 'read-only',
          detail: String((error && error.message) || error),
        })
        return
      }
      send(res, 200, await keyStatus(provider))
      return
    }

    methodNotAllowed(res, 'GET, POST, DELETE')
  }

  /**
   * One provider's workflows: the list the pane's cards are drawn from.
   *
   * A read of one directory, so it needs no key, no network and no account — the
   * cards draw on a fresh install, before anything is linked.
   */
  const providerWorkflows = async (provider, res) => {
    try {
      send(res, 200, await provider.listWorkflows({ dir: provider.data(root.root).adapters, root: root.root }))
    } catch (error) {
      // The directory exists but cannot be read: a permission or a filesystem
      // problem, not an empty install, and the two must not look alike.
      send(res, 500, { entries: [], skipped: [], error: 'unreadable', detail: String((error && error.message) || error) })
    }
  }

  /**
   * One workflow, as the surface that renders it needs it.
   *
   * The name arrives in the query string, so it is validated before any file is
   * opened and the answer says which failure it was: a bad name is the caller's
   * mistake, a missing file is an empty slot, and a file that is not a listable
   * adapter is neither.
   */
  const providerWorkflow = async (provider, url, res) => {
    const read = await provider.readWorkflow({ dir: provider.data(root.root).adapters, root: root.root, name: url.searchParams.get('name') })
    if (read.error) {
      const status = read.error === 'not-found' ? 404 : read.error === 'bad-name' ? 400 : 500
      send(res, status, { error: read.error, detail: read.detail || null })
      return
    }
    send(res, 200, read.adapter)
  }

  /** `/providers/<id>/<action>`, with the provider resolved before any work happens. */
  const route = async (req, res) => {
    const url = new URL(req.url || '/', 'http://127.0.0.1')
    // The matcher hands over the tail WITH its leading slash: `/providers/krea/key`
    // arrives here as `/krea/key`. Strip it, so the bare prefix (`''`) and the
    // trailing-slash form (`/`) both mean "the list" instead of "provider ''".
    const tail = url.pathname.slice(PROVIDERS_PREFIX.length).replace(/^\/+/, '')
    const [id, action] = tail.split('/')

    if (action === undefined || action === '') {
      // The bare `/providers/` answers the same list as the exact route, so a caller
      // that adds the slash is not punished for it.
      send(res, 200, await providerList())
      return
    }

    const provider = providerById(id)
    if (!provider) {
      send(res, 404, { error: 'unknown-provider', detail: 'no provider is registered as "' + String(id) + '"' })
      return
    }

    if (action === 'key') {
      await providerKey(provider, req, res)
      return
    }

    if (action === 'hidden') {
      await providerHidden(provider, req, res)
      return
    }

    const method = (req.method || 'GET').toUpperCase()
    if (method !== 'GET') {
      methodNotAllowed(res, 'GET')
      return
    }
    if (action === 'workflows') {
      await providerWorkflows(provider, res)
      return
    }
    if (action === 'workflow') {
      await providerWorkflow(provider, url, res)
      return
    }

    send(res, 404, { error: 'unknown-action', detail: '"' + String(action) + '" is not a provider route' })
  }

  const list = async (req, res) => {
    if ((req.method || 'GET').toUpperCase() !== 'GET') {
      methodNotAllowed(res, 'GET')
      return
    }
    send(res, 200, await providerList())
  }

  const mount = (server) => {
    if (!server || typeof server.register !== 'function') return
    ctx.effect(() => server.register({ kind: 'exact', path: PROVIDERS_PATH, handler: list }), 'generate: providers')
    ctx.effect(() => server.register({ kind: 'prefix', path: PROVIDERS_PREFIX, handler: route }), 'generate: provider routes')
  }

  const server = typeof ctx.get === 'function' ? ctx.get('webServer') : undefined
  if (server) mount(server)
  else if (typeof ctx.inject === 'function') {
    try {
      ctx.inject(['webServer'], () => mount(ctx.get('webServer')))
    } catch {
      // A profile with no web server at all: the pane reports it, nothing throws.
    }
  }

  // S3: the install. Both registrations are optional in the same way the web server
  // is — a profile without the tools or skills service still gets the routes, and a
  // missing registration is reported rather than thrown.
  const mountOptional = (name, register) => {
    if (register()) return
    if (typeof ctx.inject !== 'function') return
    try {
      ctx.inject([name], () => register())
    } catch {
      // The service never arrives in this profile. Nothing to report to a page.
    }
  }
  mountOptional('tools', () => mountTools(ctx, { base: base || runninghub.base, paths: runninghub.data(root.root), root }))
  mountOptional('skills', () => mountSkill(ctx))
}
