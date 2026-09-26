/**
 * verify:sessions — epic 64 S5's claims for the session store, asserted rather than intended.
 *
 * The claim: **a piece of work can be written down and come back.** One file per session
 * under the profile's own generate root, three verbs over it, and a store that refuses to
 * guess:
 *
 *   1. create, update, list and delete; a session round-trips its values and its run ids;
 *      an update keeps `createdAt` and replaces the form, so an autosaving pane never has to
 *      know whether this is the first write;
 *   2. **a file that is not ours is REPORTED, NOT OBEYED** — a newer schema and an unreadable
 *      file both arrive in `skipped` with their own reason, never merged into the list and
 *      never a reason for the list to fail;
 *   3. the id is a path segment: a hostile one cannot write outside `sessions/`;
 *   4. **the store does not validate against what is installed.** A session whose workflow has
 *      since been removed still lists, with its runs intact, because the record of the work
 *      outlives the tool that made it;
 *   5. the route is exact and its path carries no trailing slash — the rule this plugin paid
 *      for on 2026-09-23, asked of the registration rather than of the handler.
 *
 * THE HOST HALF IS DRIVEN FOR REAL: `lib/index.js` is imported, `apply()` mounts against a
 * recording web server, and every call goes through the shipped handler with a temp data root
 * (`RH_DATA_DIR`), so the files are really written, really read back and really deleted.
 *
 *   node verify/sessions.mjs
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { Readable, Writable } from 'node:stream'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')
const SESSIONS_PATH = '/plugins/generate/sessions'
const SESSION_SCHEMA = 'muen-generate-session/v1'

// ── reporter (the same shape as the plugin's other suites) ───────────────────

const rows = []
const check = (label, ok, detail) => rows.push({ label, status: ok ? 'pass' : 'fail', detail: detail == null ? '' : String(detail) })

function finish() {
  let failed = 0
  process.stdout.write('\nverify:sessions — S5 (a piece of work, written down)\n')
  for (const row of rows) {
    if (row.status === 'pass') continue
    if (row.status === 'fail') failed += 1
    process.stdout.write('  FAIL  ' + row.label + (row.detail ? '  —  ' + row.detail : '') + '\n')
  }
  const passes = rows.filter((row) => row.status === 'pass').length
  process.stdout.write('  ' + passes + '/' + rows.length + ' passed\n')
  if (failed > 0) process.exitCode = 1
}

// ── a real data root ─────────────────────────────────────────────────────────

const dataRoot = mkdtempSync(join(tmpdir(), 'generate-sessions-'))
process.env.RH_DATA_DIR = dataRoot
const sessionsDir = join(dataRoot, 'sessions')
mkdirSync(sessionsDir, { recursive: true })

// ── the seams the host provides ──────────────────────────────────────────────

function fakeServer() {
  const routes = []
  return {
    routes,
    register(entry) {
      routes.push(entry)
      return () => {}
    },
  }
}

function fakeRes() {
  const chunks = []
  const res = new Writable({
    write(chunk, _encoding, done) {
      chunks.push(Buffer.from(chunk))
      done()
    },
  })
  res.statusCode = 0
  res.headers = {}
  res.setHeader = (name, value) => { res.headers[String(name).toLowerCase()] = value }
  res.text = () => Buffer.concat(chunks).toString('utf8')
  res.json = () => { try { return JSON.parse(res.text()) } catch { return null } }
  return res
}

function fakeReq(method, path, body) {
  const req = Readable.from(body === undefined ? [] : [Buffer.from(typeof body === 'string' ? body : JSON.stringify(body))])
  req.method = method
  req.url = path
  return req
}

const server = fakeServer()
const ctx = {
  get: (name) => (name === 'webServer' ? server : undefined),
  effect: (fn) => { fn(); return () => {} },
  inject: () => {},
}

const module = await import(pathToFileURL(join(ROOT, 'lib/index.js')).href)
module.apply(ctx, {})

const entry = server.routes.find((route) => route.path === SESSIONS_PATH)
const handler = entry ? entry.handler : null

/**
 * One call through the shipped handler.
 *
 * A handler that THROWS is a failure this suite reports rather than a crash that hides every
 * claim after it: the answer becomes a 500 whose body names the error, so the check that was
 * written for that case fails with a reason.
 */
async function call(method, path, body) {
  const res = fakeRes()
  try {
    await handler(fakeReq(method, path, body), res)
  } catch (error) {
    res.statusCode = 500
    res.threw = String((error && error.message) || error)
    const parsed = res.json
    res.json = () => (res.text() === '' ? { error: 'threw', detail: res.threw } : parsed())
  }
  return res
}

// ── 1. the registration itself ───────────────────────────────────────────────

check(
  'the sessions route is mounted, exactly, with no trailing slash',
  !!entry && entry.kind === 'exact' && SESSIONS_PATH.endsWith('/sessions'),
  JSON.stringify(server.routes.map((route) => ({ kind: route.kind, path: route.path }))),
)
check(
  'an empty store lists nothing and says where it looked',
  await call('GET', SESSIONS_PATH).then((res) => res.statusCode === 200 && res.json().sessions.length === 0 && res.json().root === dataRoot && res.json().schema === SESSION_SCHEMA),
  JSON.stringify((await call('GET', SESSIONS_PATH)).json()),
)

// ── 2. create, and what a created session is ─────────────────────────────────

const created = await call('POST', SESSIONS_PATH, {
  provider: 'runninghub',
  adapter: 'qwen-2-1-image-edit',
  title: 'Qwen 2.1 Edit Duo',
  values: { prompt: 'the woman in Image 1 wears the outfit from Image 2', aspect_ratio: '3:4' },
  uploads: { image: { sha256: 'a'.repeat(64), file: 'uploads/' + 'a'.repeat(64) + '.png', name: 'person.jpg', type: 'image/png' } },
  runIds: ['job-aaa', 'job-bbb'],
})
const first = created.json()
check(
  'a POST with no id creates a session, named by the day and the second',
  created.statusCode === 200 && /^s-\d{8}-\d{6}$/.test(String(first.id)) && first.schema === SESSION_SCHEMA,
  JSON.stringify({ status: created.statusCode, id: first.id }),
)
check(
  'and it is open, dated, and written where the store says',
  first.open === true && typeof first.createdAt === 'string' && first.createdAt === first.updatedAt && existsSync(join(sessionsDir, first.id + '.json')),
  JSON.stringify({ open: first.open, createdAt: first.createdAt, file: existsSync(join(sessionsDir, first.id + '.json')) }),
)
check(
  'the values and the picked files round-trip exactly',
  JSON.stringify(first.values) === JSON.stringify({ prompt: 'the woman in Image 1 wears the outfit from Image 2', aspect_ratio: '3:4' }) &&
    first.uploads.image.sha256 === 'a'.repeat(64) &&
    first.uploads.image.name === 'person.jpg',
  JSON.stringify({ values: first.values, uploads: first.uploads }),
)
check('and so do the run ids, in order', JSON.stringify(first.runIds) === JSON.stringify(['job-aaa', 'job-bbb']), JSON.stringify(first.runIds))

// ── 3. update in place, and what an update must not lose ─────────────────────

const updated = await call('POST', SESSIONS_PATH, {
  id: first.id,
  provider: 'runninghub',
  adapter: 'qwen-2-1-image-edit',
  name: 'Claire outfit',
  values: { prompt: 'a different prompt' },
  runIds: ['job-aaa', 'job-bbb', 'job-ccc'],
})
const second = updated.json()
check(
  'a POST naming an existing id updates it in place, keeping createdAt',
  updated.statusCode === 200 && second.id === first.id && second.createdAt === first.createdAt && second.updatedAt !== first.updatedAt,
  JSON.stringify({ id: second.id, createdAt: second.createdAt, updatedAt: second.updatedAt }),
)
check(
  'the form is REPLACED, not merged: this is the values that were used',
  JSON.stringify(second.values) === JSON.stringify({ prompt: 'a different prompt' }) && second.values.aspect_ratio === undefined,
  JSON.stringify(second.values),
)
check('and the new run joins the list', JSON.stringify(second.runIds) === JSON.stringify(['job-aaa', 'job-bbb', 'job-ccc']), JSON.stringify(second.runIds))
check('a name a person set is kept', second.name === 'Claire outfit', String(second.name))

const renamed = await call('POST', SESSIONS_PATH, { id: first.id, values: { prompt: 'a third prompt' } })
check(
  'a later write that does not carry the name keeps the one that was set',
  renamed.json().name === 'Claire outfit' && renamed.json().provider === 'runninghub' && renamed.json().adapter === 'qwen-2-1-image-edit',
  JSON.stringify({ name: renamed.json().name, provider: renamed.json().provider, adapter: renamed.json().adapter }),
)
check(
  'and its picked files survive a write that does not mention them',
  renamed.json().uploads.image && renamed.json().uploads.image.sha256 === 'a'.repeat(64),
  JSON.stringify(renamed.json().uploads),
)

// ── 3b. one session, by id ───────────────────────────────────────────────────

const one = await call('GET', SESSIONS_PATH + '?id=' + encodeURIComponent(second.id))
check(
  'one session can be read by id, which is what a pane resuming a tab needs',
  one.statusCode === 200 && one.json().id === second.id && one.json().values.prompt === 'a third prompt' && one.json().runIds.length === 3,
  JSON.stringify({ status: one.statusCode, body: one.json() }),
)
const none = await call('GET', SESSIONS_PATH + '?id=no-such-session')
check(
  'and an id nothing answers to is a 404 rather than an empty session',
  none.statusCode === 404 && none.json().error === 'no-session',
  JSON.stringify({ status: none.statusCode, body: none.json() }),
)
const hostileRead = await call('GET', SESSIONS_PATH + '?id=' + encodeURIComponent('../../../../etc/passwd'))
check(
  'a hostile id read is sanitised like a hostile id written',
  hostileRead.statusCode === 404,
  JSON.stringify({ status: hostileRead.statusCode, body: hostileRead.json() }),
)

// ── 4. the list, newest first ────────────────────────────────────────────────

// A few milliseconds apart, so "newest first" is a claim about the order and not about a
// tie: two writes in the same millisecond sort by whatever the filesystem answered.
await new Promise((resolve) => setTimeout(resolve, 5))
await call('POST', SESSIONS_PATH, { id: 's-second', provider: 'krea', adapter: 'krea-2-medium-turbo', values: { prompt: 'krea' } })
const listed = (await call('GET', SESSIONS_PATH)).json()
check(
  'the list is newest first by the session own clock',
  listed.sessions.length === 2 &&
    listed.sessions[0].id === 's-second' &&
    listed.total === 2 &&
    listed.sessions[0].updatedAt > listed.sessions[1].updatedAt,
  JSON.stringify(listed.sessions.map((row) => ({ id: row.id, updatedAt: row.updatedAt }))),
)

// ── 5. a workflow that is gone does not take the session with it ─────────────

await call('POST', SESSIONS_PATH, { id: 's-removed-tool', provider: 'runninghub', adapter: 'qwen-rapid-aio-subject-swap', values: { prompt: 'kept' }, runIds: ['job-gone'] })
const withGone = (await call('GET', SESSIONS_PATH)).json()
const goneSession = withGone.sessions.find((row) => row.id === 's-removed-tool')
check(
  'a session whose workflow is no longer installed still lists, with its runs',
  !!goneSession && goneSession.adapter === 'qwen-rapid-aio-subject-swap' && goneSession.runIds[0] === 'job-gone',
  JSON.stringify(goneSession),
)

// ── 6. a file that is not ours is reported, never obeyed ─────────────────────

writeFileSync(join(sessionsDir, 'from-the-future.json'), JSON.stringify({ schema: 'muen-generate-session/v99', id: 'from-the-future' }))
writeFileSync(join(sessionsDir, 'half-written.json'), '{ this is not json')
const mixed = (await call('GET', SESSIONS_PATH)).json()
check(
  'a newer schema is reported by name and left out of the list',
  mixed.skipped.some((row) => row.id === 'from-the-future' && row.reason === 'unknown-schema' && row.schema === 'muen-generate-session/v99') &&
    !mixed.sessions.some((row) => row.id === 'from-the-future'),
  JSON.stringify(mixed.skipped),
)
check(
  'an unreadable file is reported too, and the list still answers',
  mixed.skipped.some((row) => row.id === 'half-written' && row.reason === 'unreadable') && mixed.sessions.length === 3,
  JSON.stringify({ skipped: mixed.skipped, sessions: mixed.sessions.map((row) => row.id) }),
)
const refusedSchema = await call('POST', SESSIONS_PATH, { id: 'nope', schema: 'muen-generate-session/v99' })
check(
  'and a write carrying a schema this store does not know is refused, never stored',
  refusedSchema.statusCode === 400 && refusedSchema.json().error === 'unknown-schema' && !existsSync(join(sessionsDir, 'nope.json')),
  JSON.stringify({ status: refusedSchema.statusCode, body: refusedSchema.json() }),
)

// ── 7. the id is a path segment ──────────────────────────────────────────────

const HOSTILE = '../../../../tmp/evil'
const hostile = await call('POST', SESSIONS_PATH, { id: HOSTILE, provider: 'runninghub', adapter: 'x', values: {} })
check(
  'a hostile id is sanitised into a plain name, so nothing is written outside sessions/',
  hostile.statusCode === 200 &&
    hostile.json().id === 'tmp-evil' &&
    !existsSync(join(dataRoot, 'evil.json')) &&
    !existsSync('/tmp/evil.json') &&
    readdirSync(sessionsDir).includes('tmp-evil.json'),
  JSON.stringify({ id: hostile.json().id, sessions: readdirSync(sessionsDir), dataRoot: readdirSync(dataRoot) }),
)

// ── 8. delete answers the truth ──────────────────────────────────────────────

const deleted = await call('DELETE', SESSIONS_PATH + '?id=' + encodeURIComponent(first.id))
check('DELETE removes the session', deleted.statusCode === 200 && deleted.json().ok === true && !existsSync(join(sessionsDir, first.id + '.json')), JSON.stringify(deleted.json()))
const again = await call('DELETE', SESSIONS_PATH + '?id=' + encodeURIComponent(first.id))
check(
  'deleting one that is not there answers 404 rather than succeeding quietly',
  again.statusCode === 404 && again.json().error === 'no-session',
  JSON.stringify({ status: again.statusCode, body: again.json() }),
)
const noId = await call('DELETE', SESSIONS_PATH)
check('and a delete with no id is refused by name', noId.statusCode === 400 && noId.json().error === 'missing-id', JSON.stringify(noId.json()))
const badBody = await call('POST', SESSIONS_PATH, 'not-an-object')
check('a POST whose body is not an object is refused by name', badBody.statusCode === 400 && badBody.json().error === 'bad-request', JSON.stringify({ status: badBody.statusCode, body: badBody.json() }))
const noBody = await call('POST', SESSIONS_PATH)
check('and a POST with no body at all creates nothing', noBody.statusCode === 400 && noBody.json().detail === 'a session is required', JSON.stringify(noBody.json()))
const emptyBody = await call('POST', SESSIONS_PATH, {})
check('an empty object is not a session either', emptyBody.statusCode === 400 && emptyBody.json().error === 'bad-request', JSON.stringify(emptyBody.json()))
const wrongVerb = await call('PUT', SESSIONS_PATH, {})
check('the route owns its three verbs', wrongVerb.statusCode === 405, wrongVerb.statusCode)

// ── 9. nothing but sessions lives in the directory ───────────────────────────

check(
  'every file in the sessions directory is one session file',
  readdirSync(sessionsDir).every((name) => name.endsWith('.json')) && !existsSync(join(dataRoot, 'evil.json')),
  readdirSync(sessionsDir).join(','),
)
check(
  'and the store writes nothing else under the profile root',
  readdirSync(dataRoot).every((name) => ['sessions', 'library'].includes(name)),
  readdirSync(dataRoot).join(','),
)

void readFileSync

finish()
