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
import { readFile } from 'node:fs/promises'
import { Readable } from 'node:stream'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')
const BASE = 'https://runninghub.test'
const KEY_REF = 'RH_API_KEY'
const WALLET_PATH = '/plugins/generate/wallet'
/**
 * The account page that issues keys, from the founder's own address bar
 * (2026-09-22) after he had to search the web for it: nothing in the product
 * links it obviously, so the pane links it directly.
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

/** A recording web server: what the plugin registers, and nothing else. */
function fakeServer() {
  const routes = []
  return {
    routes,
    register(route) {
      routes.push(route)
      return () => {}
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

function fakeReq(method, body) {
  const req = Readable.from(body === undefined ? [] : [Buffer.from(typeof body === 'string' ? body : JSON.stringify(body))])
  req.method = method
  return req
}

/** One route call. Returns the response object the handler filled in. */
async function call(handler, method, body) {
  const res = fakeRes()
  await handler(fakeReq(method, body), res)
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
  return { server, handler: server.routes[0] && server.routes[0].handler }
}

// 1. the route itself
{
  const { server } = mount(fakeCredentials({}))
  // Three routes, and they are three questions: the wallet is one account, the list
  // is one directory, and a workflow is one file. None of them needs a key except
  // the wallet's own writes.
  check('exactly three routes are registered', server.routes.length === 3, server.routes.length + ' routes')
  const route = server.routes.find((candidate) => candidate.path === WALLET_PATH)
  check("the route is an exact '" + WALLET_PATH + "'", !!route && route.kind === 'exact' && route.path === WALLET_PATH, route && route.kind + ' ' + route.path)
  check(
    'the installed list is its own exact route',
    server.routes.some((candidate) => candidate.kind === 'exact' && candidate.path === '/plugins/generate/adapters'),
    server.routes.map((candidate) => candidate.kind + ' ' + candidate.path).join(', '),
  )
  check(
    'one workflow is its own exact route',
    server.routes.some((candidate) => candidate.kind === 'exact' && candidate.path === '/plugins/generate/adapter'),
    server.routes.map((candidate) => candidate.kind + ' ' + candidate.path).join(', '),
  )
  try {
    new URL(WALLET_PATH, 'http://127.0.0.1')
    check('the route is a same-origin path (the pane fetches it directly)', true)
  } catch (error) {
    check('the route is a same-origin path (the pane fetches it directly)', false, String(error.message))
  }
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
    'the status carries the verified account page, not a vague site root',
    !!body && body.accountUrl === ACCOUNT_URL,
    body && body.accountUrl,
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
  const body = json(await call(server.routes[0].handler, 'GET'))
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
    .filter((body) => body && 'accountUrl' in body)
  check(
    'every status answer points at the same verified account page',
    withUrl.length > 0 && withUrl.every((body) => body.accountUrl === ACCOUNT_URL),
    withUrl.length + ' answers carry it',
  )
}

// ── live layer ───────────────────────────────────────────────────────────────

async function live(url) {
  try {
    const response = await realFetch(url.replace(/\/$/, '') + WALLET_PATH, { headers: { accept: 'application/json' } })
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
      response.ok && !!body && typeof body.linked === 'boolean',
      response.status + ' ' + text.slice(0, 120),
    )
    if (body) {
      check('live: the running route reports no key', !text.includes(SECRET) && !('key' in body), Object.keys(body).join(','))
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
