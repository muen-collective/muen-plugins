/**
 * @muen/dsh-generate-space — host half (Epic 61, S1 + S2).
 *
 * WHAT THIS IS: the wallet. The pane never holds the RunningHub key, so every
 * conversation with RunningHub happens here, in the host process, behind two
 * rules the epic's safety section makes imperative (§12):
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
 * WHAT THIS DOES NOT DO YET: submit a task (S3/S5), price a run (§15 D5), or
 * touch the adapter store. It reads one account and stores one secret.
 *
 * @module @muen/dsh-generate-space
 */

/** Matches the row id in cordis.patch.yml. */
export const name = 'generate-space'

/** The one wallet path. Distinct (kind, path) per route, so this cannot collide. */
const WALLET_PATH = '/plugins/generate/wallet'

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
 * Mount the wallet routes.
 *
 * `credentials` is read per request rather than captured, which is what the seam
 * asks for: resolution is per call, so a credential changed elsewhere reaches the
 * next request without a restart.
 */
export function apply(ctx, config = {}) {
  const base = str(config.base) || str(process.env.RH_BASE) || DEFAULT_BASE

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

  const mount = (server) => {
    if (!server || typeof server.register !== 'function') return
    ctx.effect(() => server.register({ kind: 'exact', path: WALLET_PATH, handler: wallet }), 'generate-space: wallet')
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
}
