/**
 * @muen/dsh-runninghub — host half (Epic 61, S1 + S2 + S3).
 *
 * WHAT THIS IS: the wallet and the install. The pane never holds the RunningHub
 * key, so every conversation with RunningHub happens here, in the host process,
 * behind two rules the epic's safety section makes imperative (§12):
 *
 *   2. The browser never sees the key. No key in page state, no key in
 *      `localStorage`, no key echoed by a route response.
 *   3. One user's key, one user's account. Nothing here reads an ambient Muen
 *      key; the reference below is the *user's* own name for their own key, and
 *      the status route reports where the value came from so the surface can say
 *      so out loud.
 *
 * ROUTES — one path, three verbs, all under the plugin's own prefix:
 *
 *   GET    /plugins/generate/wallet   → the wallet status (never the key)
 *   POST   /plugins/generate/wallet   → { key } — validate, then store
 *   DELETE /plugins/generate/wallet   → unlink
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
 * environment-variable name". Naming it `RH_API_KEY` is what makes the founder's
 * existing env file a fallback rather than a second place to paste the key: the
 * service layers the process environment, its own writable store, and `.env`
 * files, and `set` refuses while a read-only source shadows the reference. So a
 * change that cannot take effect fails loudly instead of appearing to work while
 * the old value keeps resolving.
 *
 * THE KEY IS VALIDATED BY READING THE WALLET (epic 61 §9). A wrong key fails at
 * the moment it is entered, at the field, instead of three screens later inside a
 * paid run. That read is also the gate on the write: the key reaches the seam
 * only after RunningHub has accepted it.
 *
 * WHAT THIS DOES NOT DO YET: submit a task (S5), price a run (§15 D5), or render
 * the guide card's flyout (S4). It reads one account, reads one app's doors, and
 * checks one adapter file.
 *
 * @module @muen/dsh-runninghub
 */
import { readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

import { parseAppRef, readAppDoors } from './doors.js'
import { loadHouse } from './house.js'
import { ADAPTER_SCHEMA, adapterFromDoors, listAdapters, validateAdapter } from './adapter.js'
import { dataPaths, resolveDataRoot } from './paths.js'

/** Matches the row id in cordis.patch.yml. */
export const name = 'runninghub'

/** The one wallet path. Distinct (kind, path) per route, so this cannot collide. */
const WALLET_PATH = '/plugins/generate/wallet'

/**
 * The installed-adapter list, read by the guide card.
 *
 * A second route rather than a query on the wallet route: the wallet is one
 * account and the list is one directory, and a route that answered two unrelated
 * questions would have to be told apart by its caller.
 */
const ADAPTERS_PATH = '/plugins/generate/adapters'

/**
 * The credential reference. A `CredentialRef` is the environment-variable-name
 * half of the credentials seam, so this string is also the name the founder may
 * already have set — which is the point (D1).
 */
const KEY_REF = 'RH_API_KEY'

const DEFAULT_BASE = 'https://www.runninghub.ai'
const ACCOUNT_PATH = '/uc/openapi/accountStatus'

/**
 * The account page that issues keys. The founder had to search the web for
 * "account API" and follow the API instructions to it (2026-09-22): nothing in
 * RunningHub's product links it obviously, and the docs link it only from inside
 * one article. So the pane links it directly rather than telling the user where
 * to look.
 *
 * **No `type` parameter, deliberately.** The page has three key types —
 * Enterprise-Shared, Consumer-Membership, Enterprise-Dedicated — and `type`
 * selects one. The founder's own URL carried `type=shared` (his first value,
 * `type=consumer`, was wrong), but pinning a type pins a *capability*: a
 * consumer-only account asking for `type=shared` is asking for a tab it may not
 * have. Checked live on the founder's account 2026-09-22: `?tab=keys` alone lands
 * on the right page, defaulting to Enterprise-Shared there, and the nav switches
 * types. The comparison table on that page is transcribed in epic 61 §9; the
 * short version is that a plain membership can call the AI App and ComfyUI
 * Workflow APIs this plugin uses, and only the Model API and LLM need an
 * enterprise key.
 *
 * One page, two jobs: the key list is there (`tab=keys`) and so is the billing
 * balance (`bill-task`). No separate billing deep link is published, and
 * inventing one would be worse than landing the user on the page that has both.
 */
const ACCOUNT_URL = 'https://www.runninghub.ai/call-api/bill-task?tab=keys'

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

/** The docs type these as strings; the surface wants numbers where they parse. */
function num(value) {
  if (value === undefined || value === null || value === '') return null
  const parsed = typeof value === 'number' ? value : Number(String(value).trim())
  return Number.isFinite(parsed) ? parsed : null
}

function str(value) {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null
}

/**
 * The account as RunningHub reports it. Field names are the API's, values are
 * normalized, and nothing else from the response is kept.
 * @see https://www.runninghub.ai/runninghub-api-doc-en/api-425761030
 */
function accountOf(data) {
  const raw = data && typeof data === 'object' ? data : {}
  return {
    coins: num(raw.remainCoins),
    money: num(raw.remainMoney),
    currency: str(raw.currency),
    running: num(raw.currentTaskCounts),
    apiType: str(raw.apiType),
  }
}

/**
 * One account read. Outcomes are kept apart on purpose:
 *
 *   { account }                 the key works
 *   { error: 'invalid-key' }    RunningHub answered and said no
 *   { error: 'unreachable' | 'timeout' | 'unexpected-response' | 'http-<n>' }
 *                               no answer, or one this code cannot read
 *
 * A network failure never masquerades as a bad key, and a bad key is never
 * blamed on the network: the surface can say which one happened.
 */
async function readAccount(base, key) {
  let response
  try {
    response = await fetch(base + ACCOUNT_PATH, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({ apikey: key }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch (error) {
    const kind = error && error.name
    return { error: kind === 'TimeoutError' || kind === 'AbortError' ? 'timeout' : 'unreachable' }
  }
  let payload = null
  try {
    payload = JSON.parse(await response.text())
  } catch {
    payload = null
  }
  if (payload === null || typeof payload.code !== 'number') {
    return { error: response.ok ? 'unexpected-response' : 'http-' + response.status }
  }
  if (payload.code !== 0) return { error: 'invalid-key' }
  return { account: accountOf(payload.data) }
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

/**
 * The wallet as the pane is allowed to see it. `linked` is a fact about the
 * seam; `source` is where the value came from, so a key inherited from the
 * environment is visible as such rather than looking like one pasted here.
 */
async function status(ctx, base) {
  const empty = { linked: false, writable: false, source: null, account: null, error: null, accountUrl: ACCOUNT_URL }
  const credentials = typeof ctx.get === 'function' ? ctx.get('credentials') : undefined
  if (!credentials) return { ...empty, error: 'no-credentials' }

  let info
  try {
    info = await credentials.describe(KEY_REF)
  } catch {
    return { ...empty, error: 'credentials-unavailable' }
  }
  if (!info || !info.configured) {
    return { ...empty, writable: !!(info && info.writable) }
  }

  let resolved
  try {
    resolved = await credentials.resolve(KEY_REF)
  } catch {
    return { ...empty, writable: !!info.writable, error: 'credentials-unavailable' }
  }
  if (!resolved || !resolved.value) {
    return { ...empty, writable: !!info.writable }
  }

  const probe = await readAccount(base, resolved.value)
  return {
    linked: true,
    writable: !!info.writable,
    source: str(info.source) || str(resolved.source) || null,
    account: probe.account || null,
    error: probe.error || null,
    accountUrl: ACCOUNT_URL,
  }
}

/**
 * The user's key, resolved for a read. Kept apart from the wallet's own read so a
 * missing key is one outcome rather than an exception three calls deep.
 */
async function resolveKey(ctx) {
  const credentials = typeof ctx.get === 'function' ? ctx.get('credentials') : undefined
  if (!credentials) return { error: 'no-credentials' }
  try {
    const info = await credentials.describe(KEY_REF)
    if (!info || !info.configured) return { error: 'no-key' }
    const resolved = await credentials.resolve(KEY_REF)
    if (!resolved || !resolved.value) return { error: 'no-key' }
    return { key: resolved.value, source: str(info.source) || str(resolved.source) || null }
  } catch {
    return { error: 'credentials-unavailable' }
  }
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
  return 'no --profile was found in this process, so the adapters directory is $DSH_HOME/runninghub'
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
          const key = await resolveKey(ctx)
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
    'runninghub: tool ' + TOOL_GRAPH,
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
          const key = await resolveKey(ctx)
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
    'runninghub: tool ' + TOOL_VALIDATE,
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
      ctx.logger.warn('runninghub: the skill file could not be read at ' + SKILL_FILE + ': ' + String((error && error.message) || error))
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
    'runninghub: skill ' + SKILL_NAME,
  )
  return true
}

/**
 * Mount the wallet routes.
 *
 * `credentials` is read per request rather than captured, which is what the seam
 * asks for: resolution is per call, so a credential changed elsewhere reaches the
 * next request without a restart.
 */
export function apply(ctx, config = {}) {
  const base = str(config.base) || str(process.env.RH_BASE) || DEFAULT_BASE

  // Resolved before the routes mount, because the adapters route answers from this
  // directory and the tools below report the same resolution (§4: one root, said
  // out loud once).
  const root = resolveDataRoot()
  const paths = dataPaths(root.root)

  const wallet = async (req, res) => {
    const method = (req.method || 'GET').toUpperCase()
    const credentials = typeof ctx.get === 'function' ? ctx.get('credentials') : undefined

    if (method === 'GET') {
      send(res, 200, await status(ctx, base))
      return
    }

    if (method === 'POST') {
      const body = await readJsonBody(req)
      if (body === undefined) {
        send(res, 400, { error: 'bad-request' })
        return
      }
      const key = str(body.key)
      if (!key) {
        send(res, 400, { error: 'key-required' })
        return
      }
      const probe = await readAccount(base, key)
      if (!probe.account) {
        // Nothing is stored on a rejected key: an unvalidated secret is worse
        // than no secret.
        send(res, probe.error === 'invalid-key' ? 400 : 502, {
          linked: false,
          writable: true,
          source: null,
          account: null,
          error: probe.error,
          accountUrl: ACCOUNT_URL,
        })
        return
      }
      if (!credentials) {
        send(res, 503, { error: 'no-credentials' })
        return
      }
      try {
        await credentials.set(KEY_REF, key)
      } catch (error) {
        // The seam refuses while a read-only source shadows the reference. Say
        // which, because "the key did not change" is otherwise unexplainable.
        send(res, 409, {
          linked: true,
          writable: false,
          source: null,
          account: probe.account,
          error: 'read-only',
          detail: String((error && error.message) || error),
          accountUrl: ACCOUNT_URL,
        })
        return
      }
      send(res, 200, {
        linked: true,
        writable: true,
        // The seam's own word for the value it manages: a `credentials` read after
        // this save reports `file`, and the surface's note is keyed on that. It
        // said `store` here until 2026-09-22, which no read ever confirms — the
        // strip then called a pasted key "from your environment".
        source: 'file',
        account: probe.account,
        error: null,
        accountUrl: ACCOUNT_URL,
      })
      return
    }

    if (method === 'DELETE') {
      if (!credentials) {
        send(res, 503, { error: 'no-credentials' })
        return
      }
      try {
        await credentials.unset(KEY_REF)
      } catch (error) {
        send(res, 409, {
          linked: true,
          writable: false,
          source: null,
          account: null,
          error: 'read-only',
          detail: String((error && error.message) || error),
          accountUrl: ACCOUNT_URL,
        })
        return
      }
      send(res, 200, await status(ctx, base))
      return
    }

    methodNotAllowed(res, 'GET, POST, DELETE')
  }

  /**
   * The installed list. A read of one directory, so it needs no key, no network
   * and no wallet — the card draws on a fresh install, before anything is linked
   * (§10: the card ships with no apps, and that empty state is correct).
   */
  const adapters = async (req, res) => {
    if ((req.method || 'GET').toUpperCase() !== 'GET') {
      methodNotAllowed(res, 'GET')
      return
    }
    try {
      send(res, 200, await listAdapters(paths.adapters))
    } catch (error) {
      // The directory exists but cannot be read: a permission or a filesystem
      // problem, not an empty install, and the two must not look alike.
      send(res, 500, { entries: [], skipped: [], error: 'unreadable', detail: String((error && error.message) || error) })
    }
  }

  const mount = (server) => {
    if (!server || typeof server.register !== 'function') return
    ctx.effect(() => server.register({ kind: 'exact', path: WALLET_PATH, handler: wallet }), 'runninghub: wallet')
    ctx.effect(() => server.register({ kind: 'exact', path: ADAPTERS_PATH, handler: adapters }), 'runninghub: adapters')
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
  // is — a profile without the tools or skills service still gets the wallet, and a
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
  mountOptional('tools', () => mountTools(ctx, { base, paths, root }))
  mountOptional('skills', () => mountSkill(ctx))
}
