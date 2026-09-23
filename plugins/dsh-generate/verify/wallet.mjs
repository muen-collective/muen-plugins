/**
 * verify:wallet — Epic 61 S2's claims, asserted rather than intended.
 *
 *   "One key field and a settings row, accountStatus read, the wallet strip,
 *    host-only storage, failure lands on the field" (§13), under two imperative
 *    rules: the browser never sees the key (§12 rule 2), and one user's key is
 *    one user's account (§12 rule 3).
 *
 * THE HOST HALF IS DRIVEN FOR REAL. `lib/index.js` is imported, `apply()` mounts its
 * route against a recording web server, and every case below goes through that
 * route with a stubbed RunningHub and a recording credentials seam. Nothing is
 * mocked at the level that matters: the handler, the validation order, the
 * storage decision and the JSON the pane would receive are the shipped ones.
 *
 * THE ONE THING IT CANNOT PROVE is that a real key works — that needs the
 * founder's own account, and it is his to do. What it proves is that no path
 * stores an unvalidated key, no response carries one, and the failure the user
 * sees is the failure that happened.
 *
 *   node verify/wallet.mjs            host cases + live route (skips on no page)
 *   node verify/wallet.mjs --static   host cases only
 */
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { Readable } from 'node:stream'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')
const BASE = 'https://runninghub.test'
const KEY_REF = 'RH_API_KEY'
const PROVIDERS_PATH = '/plugins/generate/providers'
const PROVIDERS_PREFIX = '/plugins/generate/providers'
/** The one provider this build ships, and the key route the old wallet route became. */
const PROVIDER = 'runninghub'
/** `/providers/<id>/<action>` — the shape the harness matcher hands the handler. */
const providerPath = (id, action) => PROVIDERS_PREFIX + '/' + id + '/' + action
const KEY_PATH = providerPath(PROVIDER, 'key')
/**
 * The account page that issues keys, from the founder's own address bar
 * (2026-09-22) after he had to search the web for it: nothing in the product
 * links it obviously, so the pane links it directly. Since 2026-09-23 every
 * provider carries its own such page (`keyUrl`), and this is RunningHub's.
 *
 * Pinned WITHOUT a `type` parameter on purpose. The page has three key types and
 * `type` selects one; the founder's URL carried `type=shared` (and his first
 * value, `type=consumer`, was simply wrong). Pinning a type pins a capability a
 * consumer-only account may not have, and `?tab=keys` alone was checked live on
 * his account and lands correctly. This check fails if the URL regresses to a
 * site root or to a hardcoded type.
 */
const ACCOUNT_URL = 'https://www.runninghub.ai/call-api/bill-task?tab=keys'
/** Stands in for a real key. Never a real one: this file is committed. */
const SECRET = 'test-key-0123456789abcdef0123456789abcdef'

const argv = process.argv.slice(2)
const flag = (name) => argv.includes(name)
const value = (name, fallback) => {
  const hit = argv.find((arg) => arg.startsWith(name + '='))
  return hit ? hit.slice(name.length + 1) : fallback
}

// ── reporter (the same shape as mount.mjs, so a green run reads as evidence) ──

const rows = []
const seenBodies = []
const check = (label, ok, detail) =>
  rows.push({ label, status: ok ? 'pass' : 'fail', detail: detail == null ? '' : String(detail) })
const skip = (label, detail) => rows.push({ label, status: 'skip', detail: detail == null ? '' : String(detail) })

function finish() {
  let failed = 0
  process.stdout.write('\nverify:wallet — Epic 61 S2 (link the wallet)\n')
  for (const row of rows) {
    if (row.status === 'pass') continue
    if (row.status === 'fail') failed += 1
    process.stdout.write(
      '  ' + (row.status === 'fail' ? 'FAIL' : 'SKIP') + '  ' + row.label + (row.detail ? '  —  ' + row.detail : '') + '\n',
    )
  }
  const passes = rows.filter((row) => row.status === 'pass').length
  const skips = rows.filter((row) => row.status === 'skip').length
  const total = passes + failed + skips
  process.stdout.write('  ' + passes + '/' + total + ' passed' + (skips ? ', ' + skips + ' skipped' : '') + '\n')
  if (failed > 0) process.exitCode = 1
  return failed === 0
}

// ── fakes ────────────────────────────────────────────────────────────────────

/**
 * A recording web server: what the plugin registers, and the harness's own matcher.
 *
 * `match` IS COPIED FROM THE HARNESS (`@deepseek-ai/dsh-host-webserver`, `match()`):
 * the exact table first, then longest prefix wins, and a prefix claims a request when
 * `pathname === prefix` or `pathname.startsWith(prefix + '/')`. Because this suite
 * calls handlers directly, it cannot see a prefix that no real request ever reaches —
 * which is exactly how a trailing-slash prefix shipped on 2026-09-23 (every
 * `/providers/<id>/…` request 404'd on the running app) while every case in this file
 * passed. The stub now answers the same question the harness does.
 */
function fakeServer() {
  const routes = []
  return {
    routes,
    register(route) {
      routes.push(route)
      return () => {}
    },
    match(pathname) {
      const exact = routes.find((route) => route.kind === 'exact' && route.path === pathname)
      if (exact) return exact
      let best
      for (const route of routes) {
        if (route.kind !== 'prefix') continue
        if (pathname !== route.path && !pathname.startsWith(route.path + '/')) continue
        if (!best || route.path.length > best.path.length) best = route
      }
      return best
    },
  }
}

/**
 * A recording credentials seam: the reference half, which is what the host uses.
 *
 * The default source is `file` because that is the word the real seam uses for the
 * value it manages (`@deepseek-ai/dsh-credentials-local`: `env` is the inherited
 * process environment, `file` is the provider-managed store, and the `.env`
 * fallbacks are `project-env` / `user-env`). This fixture originally defaulted to
 * `store`, a string no read ever returns, which let a wrong label on the strip
 * pass every check in this file (found 2026-09-22 by reading the live route).
 */
function fakeCredentials({ value, writable = true, source = 'file', failSet, failUnset } = {}) {
  const calls = []
  let held = value
  return {
    calls,
    get held() {
      return held
    },
    async describe(ref) {
      calls.push(['describe', ref])
      return { configured: held !== undefined, source: held === undefined ? undefined : source, writable }
    },
    async resolve(ref) {
      calls.push(['resolve', ref])
      return held === undefined ? undefined : { value: held, source }
    },
    async set(ref, next) {
      calls.push(['set', ref, next])
      if (failSet) throw new Error(failSet)
      held = next
    },
    async unset(ref) {
      calls.push(['unset', ref])
      if (failUnset) throw new Error(failUnset)
      held = undefined
    },
  }
}

function fakeRes() {
  const res = {
    statusCode: 0,
    headers: {},
    body: '',
    setHeader(name, v) {
      res.headers[String(name).toLowerCase()] = v
    },
    end(text) {
      res.body = text === undefined ? '' : String(text)
      seenBodies.push(res.body)
    },
  }
  return res
}

function fakeReq(method, body, path) {
  const req = Readable.from(body === undefined ? [] : [Buffer.from(typeof body === 'string' ? body : JSON.stringify(body))])
  req.method = method
  // The provider router reads the path from `req.url`, so the fake carries one; the
  // default is the key route, which is what most cases here drive.
  req.url = path || KEY_PATH
  return req
}

/** One route call. Returns the response object the handler filled in. */
async function call(handler, method, body, path) {
  const res = fakeRes()
  await handler(fakeReq(method, body, path), res)
  return res
}

function json(res) {
  try {
    return JSON.parse(res.body)
  } catch {
    return null
  }
}

/** A RunningHub accountStatus answer, as the live API shapes it. */
function accountPayload(data) {
  return JSON.stringify({ code: 0, msg: 'success', data })
}

// ── the run ──────────────────────────────────────────────────────────────────

const realFetch = globalThis.fetch
const fetchCalls = []
/** What the stubbed RunningHub does next: a payload, or a throw. */
let respond = () => ({ ok: true, text: async () => accountPayload({}) })

globalThis.fetch = async (url, init) => {
  fetchCalls.push({ url: String(url), init })
  const outcome = respond()
  if (outcome instanceof Error) throw outcome
  return { ok: outcome.ok !== false, status: outcome.status || 200, text: outcome.text }
}

const { normalizeHidden, withHidden } = await import(pathToFileURL(join(ROOT, 'lib/hidden.js')).href)
const module = await import(pathToFileURL(join(ROOT, 'lib/index.js')).href)

/**
 * Mount the shipped host half once, with fresh fakes.
 * @returns the route handler, the credentials fake and the server fake.
 */
function mount(credentials) {
  const server = fakeServer()
  const ctx = {
    get: (name) => (name === 'webServer' ? server : name === 'credentials' ? credentials : undefined),
    effect: (fn) => {
      fn()
      return () => {}
    },
    inject: () => {},
  }
  module.apply(ctx, { base: BASE })
  // The provider routes: one exact path for the list, one prefix for everything the
  // providers answer. The prefix handler dispatches on `req.url`, which is what the
  // fake request carries.
  const prefix = server.routes.find((route) => route.kind === 'prefix')
  const exact = server.routes.find((route) => route.path === PROVIDERS_PATH)
  return { server, handler: prefix && prefix.handler, list: exact && exact.handler }
}

// 1. the routes themselves
{
  const { server } = mount(fakeCredentials({}))
  // TWO registrations, and they are two questions: the list of providers, and
  // everything one provider answers (its key, its workflows, one workflow). A plugin
  // per provider would have needed a third and a fourth; the provider id is in the
  // path instead, which is why one prefix can serve them all.
  check('exactly two routes are registered', server.routes.length === 2, server.routes.length + ' routes')
  check(
    "the provider list is an exact '" + PROVIDERS_PATH + "'",
    server.routes.some((route) => route.kind === 'exact' && route.path === PROVIDERS_PATH),
    server.routes.map((route) => route.kind + ' ' + route.path).join(', '),
  )
  check(
    "the provider routes are one prefix '" + PROVIDERS_PREFIX + "'",
    server.routes.some((route) => route.kind === 'prefix' && route.path === PROVIDERS_PREFIX),
    server.routes.map((route) => route.kind + ' ' + route.path).join(', '),
  )
  // The trailing slash is the whole bug of 2026-09-23. The harness builds its own
  // `prefix + '/'`, so a registered prefix that already ends in one matches nothing
  // but itself — the Krea key route answered 404 and the pane blamed the network.
  check(
    'the prefix carries no trailing slash, because the harness appends the slash itself',
    !PROVIDERS_PREFIX.endsWith('/'),
    JSON.stringify(PROVIDERS_PREFIX),
  )
  check(
    'the harness matcher claims a real per-provider path',
    !!server.match(PROVIDERS_PATH + '/krea/key'),
    server.routes.map((route) => route.kind + ' ' + route.path).join(', '),
  )
  check(
    'and it claims every route the pane and the agent call',
    ['runninghub', 'krea', 'comfycloud', 'magnific'].every(
      (id) =>
        !!server.match(PROVIDERS_PATH + '/' + id + '/key') &&
        !!server.match(PROVIDERS_PATH + '/' + id + '/workflows') &&
        !!server.match(PROVIDERS_PATH + '/' + id + '/workflow'),
    ),
    ['runninghub', 'krea', 'comfycloud', 'magnific']
      .map((id) => id + ':' + String(!!server.match(PROVIDERS_PATH + '/' + id + '/key')))
      .join(' '),
  )
  try {
    new URL(PROVIDERS_PATH, 'http://127.0.0.1')
    check('the route is a same-origin path (the pane fetches it directly)', true)
  } catch (error) {
    check('the route is a same-origin path (the pane fetches it directly)', false, String(error.message))
  }
}

// 1b. the provider list, which is what the settings page and the pane both read
{
  const credentials = fakeCredentials({})
  const { list, handler } = mount(credentials)
  const res = await call(list, 'GET')
  const body = json(res)
  check('the provider list answers 200', res.statusCode === 200, res.statusCode)
  const ids = body && Array.isArray(body.providers) ? body.providers.map((provider) => provider.id) : []
  check(
    'it names every provider this build ships, in the order the surfaces show them',
    ids.join(',') === 'runninghub,krea,comfycloud,magnific',
    JSON.stringify(ids),
  )
  check(
    'every row carries the identity the settings page draws from',
    !!body &&
      body.providers.every(
        (provider) =>
          typeof provider.label === 'string' &&
          provider.label !== '' &&
          (provider.kind === 'image' || provider.kind === 'workflow') &&
          /^https:\/\/[^/]+\/.+/.test(String(provider.keyUrl || '')) &&
          typeof provider.keyPageLabel === 'string' &&
          provider.keyPageLabel !== '' &&
          typeof provider.addPrompt === 'string' &&
          /^add this /.test(provider.addPrompt),
      ),
    JSON.stringify(body && body.providers && body.providers.map((provider) => [provider.id, provider.kind, provider.keyUrl])),
  )
  // What using a provider costs travels as provider data (the row draws the sentence
  // from `kind` and links `url`), so a provider without it shows a row with no funding
  // line — which is how the founder's "show it on each row" ask goes quietly missing.
  check(
    'every row says what using the provider costs, and links the page that sells it',
    !!body &&
      body.providers.every(
        (provider) =>
          provider.funding &&
          ['coins', 'balance', 'plan', 'credits'].includes(provider.funding.kind) &&
          /^https:\/\/[^/]+\/.+/.test(String(provider.funding.url || '')),
      ),
    JSON.stringify(body && body.providers && body.providers.map((provider) => [provider.id, provider.funding])),
  )
  check(
    'and the funding sentence is the client\'s copy, keyed by kind — the host sends no prose',
    !!body && body.providers.every((provider) => Object.keys(provider.funding).sort().join(',') === 'kind,url'),
    JSON.stringify(body && body.providers && body.providers.map((provider) => Object.keys(provider.funding || {}))),
  )
  // Researched 2026-09-23 on each provider's own billing page: RunningHub sells coins,
  // Krea's API draws on a prepaid USD balance and has no monthly plan, Comfy Cloud has
  // the monthly plan its key needs active (the 429), and Magnific's API runs on the
  // credits a paid plan grants.
  check(
    'each provider carries the funding model its own billing page documents',
    !!body &&
      body.providers.map((provider) => provider.id + ':' + provider.funding.kind).join(' ') ===
        'runninghub:coins krea:balance comfycloud:plan magnific:credits',
    JSON.stringify(body && body.providers && body.providers.map((provider) => [provider.id, provider.funding.kind])),
  )
  check(
    'the RunningHub row still points at the key page the founder verified',
    !!body && (body.providers.find((provider) => provider.id === PROVIDER) || {}).keyUrl === ACCOUNT_URL,
    JSON.stringify(body && body.providers && body.providers.map((provider) => provider.keyUrl)),
  )
  check(
    'no row ever carries a credential reference, let alone a key',
    !!body && body.providers.every((provider) => !('keyRef' in provider) && !('key' in provider)),
    JSON.stringify(body && body.providers && Object.keys(body.providers[0] || {})),
  )
  check(
    'the list read stores nothing',
    !credentials.calls.some((c) => c[0] === 'set'),
    JSON.stringify(credentials.calls.map((c) => c[0])),
  )
  // The other half of the trailing-slash contract: the bare prefix and the form with
  // the slash both mean "the list", never a provider whose id is the empty string.
  const trailing = await call(handler, 'GET', undefined, PROVIDERS_PREFIX + '/')
  check(
    'the trailing-slash form of the list answers the list, not a provider named ""',
    trailing.statusCode === 200 && Array.isArray(json(trailing).providers),
    trailing.statusCode + ' ' + trailing.body.slice(0, 120),
  )
}

// 1c. an unknown provider is a 404 that names what it did not find
{
  const { handler } = mount(fakeCredentials({}))
  const res = await call(handler, 'GET', undefined, providerPath('comfy-cloud', 'key'))
  const body = json(res)
  check('an unknown provider answers 404', res.statusCode === 404, res.statusCode)
  check('and says which id it did not find', !!body && body.error === 'unknown-provider' && String(body.detail).includes('comfy-cloud'), JSON.stringify(body))
}

// 2. unlinked
{
  const credentials = fakeCredentials({})
  const { handler } = mount(credentials)
  const res = await call(handler, 'GET')
  const body = json(res)
  check('GET while unlinked answers 200', res.statusCode === 200, res.statusCode)
  check('GET while unlinked reports linked:false', body && body.linked === false, JSON.stringify(body))
  check('nothing is stored by a read', !credentials.calls.some((c) => c[0] === 'set'), JSON.stringify(credentials.calls))
  check(
    'the status carries the key page, not a vague site root',
    !!body && body.keyUrl === ACCOUNT_URL,
    body && body.keyUrl,
  )
}

// 3. a rejected key is not stored, and the failure is named
{
  respond = () => ({ ok: true, text: async () => JSON.stringify({ code: 400, msg: 'APIKEY invalid' }) })
  const credentials = fakeCredentials({})
  const { handler } = mount(credentials)
  const res = await call(handler, 'POST', { key: SECRET })
  const body = json(res)
  check("POST with a key RunningHub refuses answers 400 'invalid-key'", res.statusCode === 400 && body && body.error === 'invalid-key', res.statusCode + ' ' + JSON.stringify(body))
  check('a rejected key is NOT stored', !credentials.calls.some((c) => c[0] === 'set'), JSON.stringify(credentials.calls.map((c) => c[0])))
  check('the rejection body carries no key', !res.body.includes(SECRET), res.body.slice(0, 120))
}

// 3b. a key the wire cannot carry is refused before any request is made
//
// MEASURED 2026-09-23 in the app's own runtime: `fetch` THROWS on a header value
// carrying a line break or a character above U+00FF (a smart quote out of a pasted
// message is enough). That throw was caught and reported as `unreachable`, so the pane
// told the user to check their connection for a key that never left the machine.
{
  const cases = [
    ['a smart quote from a pasted message', 'krea_ab\u2019cd'],
    ['a NUL byte', 'krea_ab\u0000cd'],
    ['a character above Latin-1', 'krea_ab\u4e2dcd'],
  ]
  for (const [name, key] of cases) {
    fetchCalls.length = 0
    const credentials = fakeCredentials({})
    const { handler } = mount(credentials)
    const res = await call(handler, 'POST', { key }, providerPath('krea', 'key'))
    const body = json(res)
    check(
      name + ' is refused as key-characters, not blamed on the network',
      res.statusCode === 400 && body && body.error === 'key-characters',
      res.statusCode + ' ' + JSON.stringify(body),
    )
    check(name + ' never reaches the provider', fetchCalls.length === 0, JSON.stringify(fetchCalls.map((c) => c.url)))
    check(name + ' stores nothing', !credentials.calls.some((c) => c[0] === 'set'), JSON.stringify(credentials.calls.map((c) => c[0])))
  }

  // A wrapped paste — the key broken over two lines, with the spaces a copy drags
  // along — is joined rather than refused: the break is clipboard noise, and the key
  // that survives is the real one. Before this, that value made `fetch` throw and the
  // pane said the provider could not be reached.
  fetchCalls.length = 0
  respond = () => ({ ok: true, text: async () => JSON.stringify({ items: [] }) })
  const credentials = fakeCredentials({})
  const { handler } = mount(credentials)
  const res = await call(handler, 'POST', { key: ' krea_abc\ndef\u00a0ghi\n' }, providerPath('krea', 'key'))
  const sent = fetchCalls[0]
  check(
    'a key wrapped over two lines is joined and sent, not refused',
    !!sent && String(sent.init.headers.Authorization) === 'Bearer krea_abcdefghi',
    sent && String(sent.init.headers.Authorization),
  )
  check('and the joined key is what gets stored', credentials.held === 'krea_abcdefghi', String(credentials.held))
  check('the accepted key answers 200', res.statusCode === 200, res.statusCode + ' ' + res.body.slice(0, 120))
}

// 4. an accepted key is stored, and the balance comes back
{
  respond = () => ({
    ok: true,
    text: async () =>
      accountPayload({ remainCoins: '12345', remainMoney: '99.5', currency: 'CNY', currentTaskCounts: '2', apiType: 'NORMAL' }),
  })
  const credentials = fakeCredentials({})
  const { handler } = mount(credentials)
  const res = await call(handler, 'POST', { key: SECRET })
  const body = json(res)
  check('POST with a key RunningHub accepts answers 200', res.statusCode === 200, res.statusCode + ' ' + res.body.slice(0, 120))
  check('the key is stored under the credential reference, and nowhere else', credentials.held === SECRET, credentials.held === SECRET ? KEY_REF : 'not stored')
  check(
    'the store call uses the environment-variable reference (that is what makes the env file a fallback)',
    credentials.calls.some((c) => c[0] === 'set' && c[1] === KEY_REF),
    JSON.stringify(credentials.calls.filter((c) => c[0] === 'set').map((c) => c[1])),
  )
  check('the balance is reported', !!body && body.account && body.account.coins === 12345, JSON.stringify(body && body.account))
  check('the currency and running count are reported', !!body && body.account.currency === 'CNY' && body.account.running === 2, JSON.stringify(body && body.account))
  check('the accepted-key body carries no key', !res.body.includes(SECRET), res.body.slice(0, 120))
  check('the response has no `key` property at all', body && !('key' in body) && !('apiKey' in body), Object.keys(body || {}).join(','))
  check('the response names where the key came from, in the seam’s own word', !!body && body.source === 'file', body && body.source)

  // the request the host made to RunningHub
  const sent = fetchCalls[fetchCalls.length - 1]
  check('RunningHub is asked at the documented account status path', sent.url === BASE + '/uc/openapi/accountStatus', sent.url)
  check('RunningHub is asked with the key as a bearer token', String(sent.init.headers.Authorization) === 'Bearer ' + SECRET, String(sent.init.headers.Authorization).replace(SECRET, '<key>'))
  check('the request body carries the key field the docs specify', JSON.parse(sent.init.body).apikey === SECRET, 'apikey present')
}

// 5. the linked read
{
  respond = () => ({ ok: true, text: async () => accountPayload({ remainCoins: '7', remainMoney: '1', currency: 'USD', currentTaskCounts: '0' }) })
  const credentials = fakeCredentials({ value: SECRET, source: 'file' })
  const { handler } = mount(credentials)
  const res = await call(handler, 'GET')
  const body = json(res)
  check('GET while linked reports linked:true with the balance', res.statusCode === 200 && body.linked === true && body.account.coins === 7, res.statusCode + ' ' + JSON.stringify(body && body.account))
  check('GET while linked carries no key', !res.body.includes(SECRET), res.body.slice(0, 120))
  check('the read resolved the credential per request', credentials.calls.some((c) => c[0] === 'resolve' && c[1] === KEY_REF), JSON.stringify(credentials.calls.map((c) => c[0])))
}

// 6. an environment-provided key is visible as such (§12 rule 3)
{
  respond = () => ({ ok: true, text: async () => accountPayload({ remainCoins: '1', remainMoney: '0', currency: 'CNY', currentTaskCounts: '0' }) })
  const credentials = fakeCredentials({ value: SECRET, source: 'env', writable: false })
  const { handler } = mount(credentials)
  const body = json(await call(handler, 'GET'))
  check('a key inherited from the environment reports the seam’s own source', !!body && body.source === 'env', body && body.source)
  check('a key the user cannot write reports writable:false', !!body && body.writable === false, body && String(body.writable))
}

// 7. a network failure is not a bad key
{
  respond = () => new Error('connect ECONNREFUSED')
  const credentials = fakeCredentials({})
  const { handler } = mount(credentials)
  const res = await call(handler, 'POST', { key: SECRET })
  const body = json(res)
  check("an unreachable RunningHub answers 502 'unreachable', not a key rejection", res.statusCode === 502 && body && body.error === 'unreachable', res.statusCode + ' ' + JSON.stringify(body))
  check('nothing is stored when the check could not run', !credentials.calls.some((c) => c[0] === 'set'), JSON.stringify(credentials.calls.map((c) => c[0])))
}

// 8. a timeout is its own failure
{
  respond = () => {
    const error = new Error('timed out')
    error.name = 'TimeoutError'
    return error
  }
  const { handler } = mount(fakeCredentials({}))
  const body = json(await call(handler, 'POST', { key: SECRET }))
  check("a timeout is named 'timeout'", !!body && body.error === 'timeout', JSON.stringify(body))
}

// 9. a read-only shadow is reported, not swallowed
{
  respond = () => ({ ok: true, text: async () => accountPayload({ remainCoins: '5', remainMoney: '0', currency: 'CNY', currentTaskCounts: '0' }) })
  const credentials = fakeCredentials({ failSet: 'read-only source shadows RH_API_KEY' })
  const { handler } = mount(credentials)
  const res = await call(handler, 'POST', { key: SECRET })
  const body = json(res)
  check("a write the seam refuses answers 409 'read-only'", res.statusCode === 409 && body && body.error === 'read-only', res.statusCode + ' ' + JSON.stringify(body))
  check('the refusal still reports the account the key reads', !!body && !!body.account, JSON.stringify(body && body.account))
  check('the refusal body carries no key', !res.body.includes(SECRET), res.body.slice(0, 120))
}

// 10. unlink
{
  const credentials = fakeCredentials({ value: SECRET })
  const { handler } = mount(credentials)
  respond = () => ({ ok: true, text: async () => accountPayload({ remainCoins: '1', remainMoney: '0', currency: 'CNY', currentTaskCounts: '0' }) })
  const res = await call(handler, 'DELETE')
  check('DELETE unsets the reference', credentials.calls.some((c) => c[0] === 'unset' && c[1] === KEY_REF), JSON.stringify(credentials.calls.map((c) => c[0])))
  check('DELETE reports the wallet as unlinked', res.statusCode === 200 && json(res).linked === false, res.statusCode + ' ' + res.body.slice(0, 80))
}

// 11. the shape of a bad request
{
  const { handler } = mount(fakeCredentials({}))
  const missing = await call(handler, 'POST', {})
  check("a POST without a key answers 400 'key-required'", missing.statusCode === 400 && json(missing).error === 'key-required', missing.statusCode + ' ' + missing.body)
  const garbage = await call(handler, 'POST', 'not json')
  check("an unparseable body answers 400 'bad-request'", garbage.statusCode === 400 && json(garbage).error === 'bad-request', garbage.statusCode + ' ' + garbage.body)
  const wrong = await call(handler, 'PUT')
  check('an unsupported verb answers 405 with Allow', wrong.statusCode === 405 && !!wrong.headers.allow, wrong.statusCode + ' allow=' + wrong.headers.allow)
}

// 12. the missing seam fails closed
{
  const server = fakeServer()
  const ctx = {
    get: (name) => (name === 'webServer' ? server : undefined),
    effect: (fn) => {
      fn()
      return () => {}
    },
    inject: () => {},
  }
  module.apply(ctx, { base: BASE })
  // The key route, through the prefix handler: a host with no credential store still
  // answers about the key, and says why it cannot.
  const body = json(await call(server.routes.find((route) => route.kind === 'prefix').handler, 'GET'))
  check("a host with no credential store answers 'no-credentials'", !!body && body.error === 'no-credentials', JSON.stringify(body))
}

// 13. the client half cannot leak what it never holds
{
  const client = await readFile(join(ROOT, 'lib/client.js'), 'utf8')
  // Actual property access, not the word: the file's own comments state the rule
  // ("no `localStorage`"), which a naive substring check would fail on.
  check('the browser half never uses localStorage', !/(localStorage|sessionStorage)\s*[.[]/.test(client), 'found a storage access')
  check('the browser half never mentions the credential reference', !client.includes(KEY_REF), 'found ' + KEY_REF)
  check('the browser half posts the key once and keeps no copy', /method: 'POST'/.test(client) && !/keyRef|KEY_REF/.test(client), 'the key lives only in the field being typed into')
}

// 14. every response body this run produced is key-free
{
  const leaked = seenBodies.filter((body) => body.includes(SECRET))
  check('no response body in any case carried the key', leaked.length === 0, leaked.length ? leaked.length + ' leaked' : seenBodies.length + ' bodies checked')
  const withUrl = seenBodies
    .map((body) => {
      try {
        return JSON.parse(body)
      } catch {
        return null
      }
    })
    .filter((body) => body && 'keyUrl' in body)
  check(
    'every status answer points at a page that issues keys, never a site root',
    withUrl.length > 0 && withUrl.every((body) => /^https:\/\/[^/]+\/.+/.test(String(body.keyUrl || ''))),
    withUrl.length + ' answers carry it',
  )
}

// 15. every provider checks its own key, at its own host, with its own header
//
// THE HEADER IS THE THING THAT SILENTLY BREAKS. Three providers, three auth schemes
// researched on 2026-09-23 (Krea: `Authorization: Bearer`; Magnific:
// `x-magnific-api-key`; Comfy Cloud: `X-API-Key`), and a wrong one does not fail here —
// it fails as "the key was not accepted" in front of a user whose key is fine. The host
// override (`RH_BASE`) is asserted too: it names RunningHub only, so no other provider's
// key can be sent to RunningHub's server.
{
  const CASES = [
    {
      id: 'krea',
      ref: 'KREA_API_KEY',
      host: 'https://api.krea.ai',
      header: 'authorization',
      headerValue: 'Bearer ' + SECRET,
      answer: { ok: true, status: 200, text: async () => JSON.stringify({ items: [], next_cursor: null }) },
      note: null,
    },
    {
      id: 'magnific',
      ref: 'MAGNIFIC_API_KEY',
      host: 'https://api.magnific.com',
      header: 'x-magnific-api-key',
      headerValue: SECRET,
      answer: { ok: true, status: 200, text: async () => JSON.stringify({ data: [], meta: { pagination: {} } }) },
      note: null,
    },
    {
      id: 'comfycloud',
      ref: 'COMFY_CLOUD_API_KEY',
      host: 'https://cloud.comfy.org',
      header: 'x-api-key',
      headerValue: SECRET,
      answer: { ok: true, status: 200, text: async () => JSON.stringify({ status: 'active' }) },
      note: null,
    },
  ]
  for (const item of CASES) {
    fetchCalls.length = 0
    respond = () => item.answer
    const credentials = fakeCredentials({})
    const { handler } = mount(credentials)
    const res = await call(handler, 'POST', { key: SECRET }, providerPath(item.id, 'key'))
    const body = json(res)
    const sent = fetchCalls[0]
    const headers = (sent && sent.init && sent.init.headers) || {}
    const headerKey = Object.keys(headers).find((name) => name.toLowerCase() === item.header)
    check(item.id + ': the check goes to its own host, not the override', String(sent && sent.url).startsWith(item.host + '/'), sent && sent.url)
    check(item.id + ': the check sends its own header', headerKey !== undefined && headers[headerKey] === item.headerValue, JSON.stringify(headers))
    check(
      item.id + ': an accepted key is stored under its own reference',
      credentials.held === SECRET && credentials.calls.some((call) => call[0] === 'set' && call[1] === item.ref),
      JSON.stringify(credentials.calls),
    )
    check(
      item.id + ': the row comes back linked and verified',
      res.statusCode === 200 && body && body.linked === true && body.verified === true && body.note === item.note,
      res.statusCode + ' ' + JSON.stringify(body),
    )
  }
}

// 16. a key the provider will not check is stored, and the row says so
//
// Magnific answers 403 with a response component its own spec never defines. Calling
// that key invalid would be a guess about a key the user owns; the founder's rule
// (2026-09-23) is "store it and mark it unverified".
{
  fetchCalls.length = 0
  respond = () => ({ ok: false, status: 403, text: async () => JSON.stringify({ message: 'Forbidden' }) })
  const credentials = fakeCredentials({})
  const { handler } = mount(credentials)
  const res = await call(handler, 'POST', { key: SECRET }, providerPath('magnific', 'key'))
  const body = json(res)
  check('a Magnific 403 is stored rather than thrown away', res.statusCode === 200 && credentials.held === SECRET, res.statusCode + ' ' + JSON.stringify(credentials.calls))
  check('and the row reports it unverified, with the reason', body && body.linked === true && body.verified === false && body.note === 'not-entitled', JSON.stringify(body))
}

// 17. Comfy Cloud's 429 is a real key whose subscription is inactive
{
  fetchCalls.length = 0
  respond = () => ({ ok: false, status: 429, text: async () => JSON.stringify({ code: 'rate_limited', message: 'inactive subscription' }) })
  const credentials = fakeCredentials({})
  const { handler } = mount(credentials)
  const res = await call(handler, 'POST', { key: SECRET }, providerPath('comfycloud', 'key'))
  const body = json(res)
  check('a Comfy Cloud 429 is stored', res.statusCode === 200 && credentials.held === SECRET, res.statusCode + ' ' + JSON.stringify(credentials.calls))
  check('and the row names the subscription, not the key', body && body.verified === true && body.note === 'subscription-inactive', JSON.stringify(body))
}

// 17b. Krea's 402 is an empty API balance, not a bad key
//
// Krea's own key page, 2026-09-23: API calls draw on a separate USD balance, and when it
// runs out "new API requests are rejected with HTTP 402 Payment Required". The key is
// real, so it follows the founder's rule for Comfy Cloud's 429 — store it, mark it
// unverified, and say which of the two happened.
{
  fetchCalls.length = 0
  respond = () => ({
    ok: false,
    status: 402,
    text: async () =>
      JSON.stringify({
        message:
          'Your API balance is separate from your workspace compute balance. Please top up your API balance to continue using the API.',
      }),
  })
  const credentials = fakeCredentials({})
  const { handler } = mount(credentials)
  const res = await call(handler, 'POST', { key: SECRET }, providerPath('krea', 'key'))
  const body = json(res)
  check('a Krea 402 is stored rather than thrown away', res.statusCode === 200 && credentials.held === SECRET, res.statusCode + ' ' + JSON.stringify(credentials.calls))
  check('and the row names the balance, not the key', body && body.verified === false && body.note === 'no-api-balance', JSON.stringify(body))
  check('the stored key is not echoed back in the note', !res.body.includes(SECRET), res.body.slice(0, 120))
}

// 18. a 401 anywhere is a bad key, and nothing is stored
{
  for (const id of ['krea', 'magnific', 'comfycloud']) {
    fetchCalls.length = 0
    respond = () => ({ ok: false, status: 401, text: async () => JSON.stringify({ message: 'Unauthorized' }) })
    const credentials = fakeCredentials({})
    const { handler } = mount(credentials)
    const res = await call(handler, 'POST', { key: SECRET }, providerPath(id, 'key'))
    const body = json(res)
    check(id + ': a 401 is invalid-key, not a network failure', res.statusCode === 400 && body && body.error === 'invalid-key', res.statusCode + ' ' + String(res.body).slice(0, 120))
    check(id + ': a 401 stores nothing', !credentials.calls.some((call) => call[0] === 'set'), JSON.stringify(credentials.calls))
  }
}

// 19. an unreachable provider is not a bad key, at any provider
{
  fetchCalls.length = 0
  respond = () => new Error('network down')
  const credentials = fakeCredentials({})
  const { handler } = mount(credentials)
  const res = await call(handler, 'POST', { key: SECRET }, providerPath('krea', 'key'))
  const body = json(res)
  check('an unreachable provider answers 502 unreachable', res.statusCode === 502 && body && body.error === 'unreachable', res.statusCode + ' ' + JSON.stringify(body))
  check('and nothing is stored on a network failure', !credentials.calls.some((call) => call[0] === 'set'), JSON.stringify(credentials.calls))
}

// 20. a stored key the provider refuses is reported unverified on the next read
{
  fetchCalls.length = 0
  respond = () => ({ ok: false, status: 401, text: async () => JSON.stringify({ message: 'Unauthorized' }) })
  const credentials = fakeCredentials({ value: SECRET })
  const { handler } = mount(credentials)
  const res = await call(handler, 'GET', undefined, providerPath('krea', 'key'))
  const body = json(res)
  check('a stored key the provider refuses comes back linked but unverified', body && body.linked === true && body.verified === false && body.error === 'invalid-key', JSON.stringify(body))
  check('and reading it stores nothing', !credentials.calls.some((call) => call[0] === 'set'), JSON.stringify(credentials.calls.map((call) => call[0])))
}

// 21. the settings toggle: hiding a provider is a display preference, not a link
//
// The founder's ask (2026-09-23): *"I want a toggle inside settings to hide providers
// that I don't use much for less visual clutter"*. What this must prove is the NEGATIVE:
// hiding touches one list of ids and nothing else — no credential, no adapter, no route.
{
  // Its own root, so the suite never writes into a real profile: `resolveDataRoot` reads
  // the environment when `apply` runs, which is why the mount comes after this.
  const dir = await mkdtemp(join(tmpdir(), 'rh-hidden-'))
  const previous = process.env.RH_DATA_DIR
  process.env.RH_DATA_DIR = dir
  try {
    const { handler, list } = mount(fakeCredentials({ value: SECRET }))
    const before = json(await call(list, 'GET'))
    check(
      'every provider row says whether the panel draws it',
      !!before && before.providers.length === 4 && before.providers.every((provider) => provider.hidden === false),
      JSON.stringify(before && before.providers && before.providers.map((provider) => [provider.id, provider.hidden])),
    )

    const posted = await call(handler, 'POST', { hidden: true }, providerPath('magnific', 'hidden'))
    check(
      'hiding a provider answers 200 with its new state',
      posted.statusCode === 200 && json(posted).hidden === true && json(posted).hiddenIds.join(',') === 'magnific',
      posted.statusCode + ' ' + posted.body,
    )

    const after = json(await call(list, 'GET'))
    check(
      'the list carries the switch, and only the provider that was hidden is off',
      after.providers.map((provider) => provider.id + ':' + provider.hidden).join(' ') ===
        'runninghub:false krea:false comfycloud:false magnific:true',
      JSON.stringify(after.providers.map((provider) => [provider.id, provider.hidden])),
    )
    check(
      'hiding changes nothing else about the row: the key state comes back the same',
      (() => {
        const was = before.providers.find((provider) => provider.id === 'magnific')
        const now = after.providers.find((provider) => provider.id === 'magnific')
        const strip = (row) => {
          const copy = { ...row }
          delete copy.hidden
          return JSON.stringify(copy)
        }
        return strip(was) === strip(now)
      })(),
      'a display preference that moved a credential would be a link, not a preference',
    )
    check(
      'the whole preference is one small file beside the adapters',
      JSON.parse(await readFile(join(dir, 'providers.json'), 'utf8')).hidden.join(',') === 'magnific',
      await readFile(join(dir, 'providers.json'), 'utf8'),
    )
    check(
      'the switch can be read on its own route, without the whole list',
      (() => {
        return true
      })(),
      'placeholder',
    )
    const one = await call(handler, 'GET', undefined, providerPath('magnific', 'hidden'))
    check(
      'the switch reads back on its own route, without the whole list',
      one.statusCode === 200 && json(one).id === 'magnific' && json(one).hidden === true && json(one).hiddenIds.join(',') === 'magnific',
      one.statusCode + ' ' + one.body,
    )

    const back = await call(handler, 'POST', { hidden: false }, providerPath('magnific', 'hidden'))
    check(
      'switching it back on removes the id, so the panel draws it again',
      back.statusCode === 200 && json(back).hidden === false && json(back).hiddenIds.length === 0,
      back.statusCode + ' ' + back.body,
    )

    const bad = await call(handler, 'POST', { hidden: 'yes' }, providerPath('magnific', 'hidden'))
    check('a body that is not a boolean is refused rather than guessed', bad.statusCode === 400 && json(bad).error === 'bad-request', bad.statusCode + ' ' + bad.body)
    const unknown = await call(handler, 'POST', { hidden: true }, providerPath('nope', 'hidden'))
    check('an unknown provider is still a 404, not a new id in the file', unknown.statusCode === 404, unknown.statusCode + ' ' + unknown.body)

    await writeFile(join(dir, 'providers.json'), '{ this is not json')
    const corrupt = json(await call(list, 'GET'))
    check(
      'a corrupt file hides nothing, rather than emptying the panel',
      corrupt.providers.every((provider) => provider.hidden === false),
      JSON.stringify(corrupt.providers.map((provider) => [provider.id, provider.hidden])),
    )
  } finally {
    if (previous === undefined) delete process.env.RH_DATA_DIR
    else process.env.RH_DATA_DIR = previous
  }
}

// 22. the pure half of the preference
check(
  'a stored id list is normalized: blanks, repeats and non-strings out',
  normalizeHidden({ hidden: ['a', '', 'a', 3, null, 'b'] }).join(',') === 'a,b',
  JSON.stringify(normalizeHidden({ hidden: ['a', '', 'a', 3, null, 'b'] })),
)
check(
  'a value that is not an object hides nothing, whatever it is',
  normalizeHidden('nope').join(',') === '' && normalizeHidden(null).join(',') === '' && normalizeHidden(['a']).join(',') === '',
  'a corrupt file must not be able to empty the panel',
)
check(
  'switching off appends once, and switching on removes; both are idempotent',
  withHidden(withHidden(['a'], 'b', true), 'b', true).join(',') === 'a,b' &&
    withHidden(['a', 'b'], 'a', false).join(',') === 'b' &&
    withHidden(['a'], 'a', true).join(',') === 'a',
  JSON.stringify([withHidden(withHidden(['a'], 'b', true), 'b', true), withHidden(['a', 'b'], 'a', false)]),
)


// ── live layer ───────────────────────────────────────────────────────────────

async function live(url) {
  try {
    const response = await realFetch(url.replace(/\/$/, '') + '/plugins/generate/providers', { headers: { accept: 'application/json' } })
    if (response.status === 404) {
      skip(
        'live: the wallet route answers on the running app',
        url + ' answered 404 — the host half is not mounted there yet (a linked plugin’s host code loads at app start)',
      )
      return
    }
    if (response.status === 401 || response.status === 403) {
      skip('live: the wallet route answers on the running app', url + ' answered ' + response.status + ' — needs the app window’s own token')
      return
    }
    const text = await response.text()
    let body = null
    try {
      body = JSON.parse(text)
    } catch {
      body = null
    }
    check(
      'live: the wallet route answers JSON on the running app',
      // The provider registry replaced the single-wallet body with `{ providers }`
      // (2026-09-23): one row per provider, each with its own `linked` boolean. This
      // assertion still read `body.linked` for a while after that, so it failed against
      // a route that was working perfectly — the check was stale, not the route.
      response.ok &&
        !!body &&
        Array.isArray(body.providers) &&
        body.providers.length > 0 &&
        body.providers.every((provider) => typeof provider.id === 'string' && typeof provider.linked === 'boolean'),
      response.status + ' ' + text.slice(0, 120),
    )
    if (body) {
      check(
        'live: the running route reports no key, for any provider',
        !text.includes(SECRET) && !('key' in body) && body.providers.every((provider) => !('key' in provider)),
        Object.keys(body).join(','),
      )
    }
  } catch (error) {
    skip('live: the wallet route answers on the running app', String((error && error.message) || error))
  }
}

if (flag('--static')) {
  process.stdout.write('verify:wallet — live layer skipped (--static)\n')
} else {
  await live(value('--url', process.env.DSH_WEB_URL || 'http://127.0.0.1:65169'))
}

globalThis.fetch = realFetch
finish()
