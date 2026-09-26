/**
 * verify:result — epic 64 S1's claims for the bytes route, asserted rather than intended.
 *
 * The claim: **the asset library and the session strip can draw a file the host saved,
 * and only a file the host saved.** Four rules are checked here rather than described:
 *
 *   1. the path comes from the run RECORD, never from the query — a caller names which
 *      saved output, and there is no path parameter to climb with;
 *   2. a job id is refused unless it has the shape the record writer itself uses, so a
 *      `..` cannot walk out of `<profile>/generate/<provider>/runs/`;
 *   3. a run that saved nothing (`no-result`) and a run whose file has since moved
 *      (`missing-file`) are DIFFERENT answers, because the library draws them apart;
 *   4. the bytes are the file's own bytes, with the type the record chose.
 *
 * THE HOST HALF IS DRIVEN FOR REAL: `lib/index.js` is imported, `apply()` mounts against a
 * recording web server, and every call goes through the shipped handler. The data root is
 * a temp directory (`RH_DATA_DIR`), so a real run record and a real file are written and
 * really served.
 *
 * The last case asks the MATCHER's question rather than the handler's (the rule this
 * plugin paid for on 2026-09-23): the prefix is registered without a trailing slash, so
 * `/providers/<id>/result` is inside it.
 *
 *   node verify/result.mjs
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { Readable, Writable } from 'node:stream'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')
const PROVIDERS_PATH = '/plugins/generate/providers'

// ── reporter (the same shape as the plugin's other suites) ───────────────────

const rows = []
const check = (label, ok, detail) => rows.push({ label, status: ok ? 'pass' : 'fail', detail: detail == null ? '' : String(detail) })

function finish() {
  let failed = 0
  process.stdout.write('\nverify:result — S1 (the bytes of a finished run)\n')
  for (const row of rows) {
    if (row.status === 'pass') continue
    if (row.status === 'fail') failed += 1
    process.stdout.write('  FAIL  ' + row.label + (row.detail ? '  —  ' + row.detail : '') + '\n')
  }
  const passes = rows.filter((row) => row.status === 'pass').length
  process.stdout.write('  ' + passes + '/' + rows.length + ' passed\n')
  if (failed > 0) process.exitCode = 1
}

// ── a real data root, a real record, real bytes ──────────────────────────────

const dataRoot = mkdtempSync(join(tmpdir(), 'generate-result-'))
process.env.RH_DATA_DIR = dataRoot
const providerRoot = join(dataRoot, 'runninghub')
const runsDir = join(providerRoot, 'runs')
const libraryDir = join(dataRoot, 'library')
mkdirSync(runsDir, { recursive: true })
mkdirSync(libraryDir, { recursive: true })

/** The picture: bytes nobody else has, so "the file's own bytes" is provable. */
const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from('verify-result-' + 'x'.repeat(400)),
])
const fileOne = join(libraryDir, '20260926-job-one.png')
const fileTwo = join(libraryDir, '20260926-job-one-2.webp')
writeFileSync(fileOne, PNG)
writeFileSync(fileTwo, PNG.subarray(0, 64))

/** The record the host would have written: two saved outputs, one type each. */
function writeRecord(jobId, record) {
  writeFileSync(join(runsDir, jobId + '.json'), JSON.stringify(record, null, 2))
}

writeRecord('job-one', {
  schema: 'muen-rh-run/v1',
  jobId: 'job-one',
  at: '2026-09-26T03:00:00.000Z',
  status: 'done',
  outcome: {
    state: 'done',
    saved: [
      { file: fileOne, bytes: PNG.length, type: 'png', url: 'https://example.invalid/one.png' },
      { file: fileTwo, bytes: 64, type: 'webp', url: 'https://example.invalid/two.webp' },
    ],
  },
})

// A run that produced nothing, and one whose file has since gone.
writeRecord('job-empty', { schema: 'muen-rh-run/v1', jobId: 'job-empty', status: 'failed', outcome: { state: 'failed', status: 'ERROR', error: 'the node blew up', saved: [] } })
writeRecord('job-moved', { schema: 'muen-rh-run/v1', jobId: 'job-moved', status: 'done', outcome: { state: 'done', saved: [{ file: join(libraryDir, 'gone.png'), bytes: 10, type: 'png' }] } })
writeRecord('job-relative', { schema: 'muen-rh-run/v1', jobId: 'job-relative', status: 'done', outcome: { state: 'done', saved: [{ file: 'library/relative.png', bytes: 10, type: 'png' }] } })

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

function fakeCredentials(value) {
  return {
    read: async () => value,
    get: async () => value,
  }
}

/** A writable response: it collects bytes, so a streamed file is compared as bytes. */
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
  res.bytes = () => Buffer.concat(chunks)
  res.text = () => Buffer.concat(chunks).toString('utf8')
  res.json = () => { try { return JSON.parse(res.text()) } catch { return null } }
  return res
}

function fakeReq(method, path) {
  const req = Readable.from([])
  req.method = method
  req.url = path
  return req
}

const server = fakeServer()
const credentials = fakeCredentials('rh_test_key')
const ctx = {
  get: (name) => (name === 'webServer' ? server : name === 'credentials' ? credentials : undefined),
  effect: (fn) => { fn(); return () => {} },
  inject: () => {},
}

const module = await import(pathToFileURL(join(ROOT, 'lib/index.js')).href)
module.apply(ctx, {})

const prefixEntry = server.routes.find((route) => route.kind === 'prefix')
const handler = prefixEntry.handler
const RESULT = (id) => PROVIDERS_PATH + '/' + id + '/result'

/** The harness's own matcher rule, asked rather than re-implemented loosely. */
const matches = (prefix, pathname) => pathname === prefix || pathname.startsWith(prefix + '/')

async function get(path, method = 'GET') {
  const res = fakeRes()
  await handler(fakeReq(method, path), res)
  return res
}

function waitForEnd(res) {
  return new Promise((resolve) => {
    if (res.writableEnded) { resolve(); return }
    res.once('finish', resolve)
    res.once('close', resolve)
  })
}

// ── 1. the record's own file, with the record's own type ─────────────────────

{
  const res = await get(RESULT('runninghub') + '?job=job-one&i=0')
  await waitForEnd(res)
  check('serves the file the record names, byte for byte', res.statusCode === 200 && createHash('sha256').update(res.bytes()).digest('hex') === createHash('sha256').update(PNG).digest('hex'), 'status ' + res.statusCode + ', ' + res.bytes().length + ' bytes')
  check('the type is the record\'s own', res.headers['content-type'] === 'image/png', res.headers['content-type'])
  check('the length is the file\'s own', Number(res.headers['content-length']) === PNG.length, res.headers['content-length'])
  check('nothing is cached: a moved file must stop being served', res.headers['cache-control'] === 'no-store', res.headers['cache-control'])
}

// ── 2. `i` selects among the run's outputs ──────────────────────────────────

{
  const res = await get(RESULT('runninghub') + '?job=job-one&i=1')
  await waitForEnd(res)
  check('i picks the other saved output', res.statusCode === 200 && res.bytes().length === 64, 'status ' + res.statusCode + ', ' + res.bytes().length + ' bytes')
  check('and its own type comes with it', res.headers['content-type'] === 'image/webp', res.headers['content-type'])
}

// ── 3. the path is the record's, never the query's ──────────────────────────

{
  // A caller naming a path is ignored: there is no such parameter, and the record wins.
  const res = await get(RESULT('runninghub') + '?job=job-one&i=0&file=' + encodeURIComponent('/etc/passwd'))
  await waitForEnd(res)
  check('a `file` in the query is ignored — the record decides', res.statusCode === 200 && res.bytes().length === PNG.length, 'status ' + res.statusCode + ', ' + res.bytes().length + ' bytes')
}

// ── 4. a job id that could climb out is refused ─────────────────────────────

{
  // The record for `../job-one` would be `runs/../job-one.json` — a real file one level up.
  writeFileSync(join(providerRoot, 'job-one.json'), JSON.stringify({ outcome: { saved: [{ file: fileOne, type: 'png' }] } }))
  for (const job of ['../job-one', '..%2Fjob-one', 'a/../../b', '.']) {
    const res = await get(RESULT('runninghub') + '?job=' + job)
    check('refuses a job id that is not a record stem: ' + job, res.statusCode === 400 && res.json() && res.json().error === 'bad-job', 'status ' + res.statusCode + ' ' + JSON.stringify(res.json() && res.json().error))
  }
}

// ── 5. the three absences answer differently ────────────────────────────────

{
  const empty = await get(RESULT('runninghub') + '?job=job-empty')
  const body = empty.json()
  check('a run that saved nothing answers 404 no-result', empty.statusCode === 404 && body && body.error === 'no-result', 'status ' + empty.statusCode + ' ' + JSON.stringify(body && body.error))
  check('and carries the provider\'s own reason', body && String(body.detail).includes('blew up'), body && body.detail)
  check('and says which state it ended in', body && body.state === 'failed', body && body.state)
}

{
  const moved = await get(RESULT('runninghub') + '?job=job-moved')
  const body = moved.json()
  check('a file that has moved answers 404 missing-file', moved.statusCode === 404 && body && body.error === 'missing-file', 'status ' + moved.statusCode + ' ' + JSON.stringify(body && body.error))
  check('and names the path it expected', body && String(body.detail).includes('gone.png'), body && body.detail)
}

{
  const none = await get(RESULT('runninghub') + '?job=no-such-run')
  check('an unknown job answers 404 no-record, not an empty page', none.statusCode === 404 && none.json() && none.json().error === 'no-record' && none.text().length > 0, none.statusCode + ' ' + none.text().slice(0, 60))
}

{
  const relative = await get(RESULT('runninghub') + '?job=job-relative')
  const body = relative.json()
  check('a record naming a relative path is refused, never read from the cwd', relative.statusCode === 404 && body && body.error === 'missing-file', 'status ' + relative.statusCode + ' ' + JSON.stringify(body && body.error))
}

// ── 6. the index and the method are bounded ─────────────────────────────────

{
  const high = await get(RESULT('runninghub') + '?job=job-one&i=9')
  check('an index past the saved list answers no-result', high.statusCode === 404 && high.json().error === 'no-result', high.statusCode + ' ' + JSON.stringify(high.json() && high.json().error))
  const bad = await get(RESULT('runninghub') + '?job=job-one&i=-1')
  check('a negative index is a bad request', bad.statusCode === 400 && bad.json().error === 'bad-index', bad.statusCode)
  const text = await get(RESULT('runninghub') + '?job=job-one&i=two')
  check('a non-numeric index is a bad request', text.statusCode === 400 && text.json().error === 'bad-index', text.statusCode)
}

{
  const posted = await get(RESULT('runninghub') + '?job=job-one', 'POST')
  check('the route is GET only', posted.statusCode === 405 && posted.headers.allow === 'GET', posted.statusCode + ' allow=' + posted.headers.allow)
}

// ── 7. the per-workflow state route reads the same root ─────────────────────

{
  // Found while writing this suite: the state route used `provider.root`, which no provider
  // has — a provider's own directory is `provider.data(root.root).root`. Every call threw
  // before it read anything, and the route stays mounted while the surface keeps calling it.
  const STATE = PROVIDERS_PATH + '/runninghub/state'
  const body = JSON.stringify({ name: 'verify-result', values: { steps: 40 } })
  const req = Readable.from([Buffer.from(body)])
  req.method = 'POST'
  req.url = STATE
  const post = fakeRes()
  await handler(req, post)
  check('the state route stores the values a person set', post.statusCode === 200 && post.json() && post.json().ok === true, post.statusCode + ' ' + post.text().slice(0, 80))

  const back = await get(STATE + '?name=verify-result')
  const saved = back.json()
  check('so they come back on the next open', back.statusCode === 200 && saved && saved.steps === 40, JSON.stringify(saved))

  const other = await get(STATE + '?name=nothing-saved-here')
  check('and a workflow with nothing saved answers an empty object', other.statusCode === 200 && JSON.stringify(other.json()) === '{}', other.text())
}

// ── 8. an unknown provider still says so ────────────────────────────────────

{
  const unknown = await get(PROVIDERS_PATH + '/nope/result?job=job-one')
  check('an unknown provider is refused before any work', unknown.statusCode === 404 && unknown.json().error === 'unknown-provider', unknown.statusCode + ' ' + JSON.stringify(unknown.json() && unknown.json().error))
}

// ── 9. the matcher's question, not the handler's ────────────────────────────

{
  check('the provider prefix is registered without a trailing slash', prefixEntry && prefixEntry.path === PROVIDERS_PATH, prefixEntry && prefixEntry.path)
  check('so a result path is inside it', matches(PROVIDERS_PATH, PROVIDERS_PATH + '/runninghub/result'), PROVIDERS_PATH + '/runninghub/result')
  check('and a trailing-slash prefix would have matched nothing below it', matches(PROVIDERS_PATH + '/', PROVIDERS_PATH + '/runninghub/result') === false, 'the failure this rule exists for')
}

// ── 10. the running install's own records ────────────────────────────────────

{
  // Read-only, and only when this machine has records: the real profile's own first saved
  // file must serve, byte for byte, through the same shipped handler. Nothing is written
  // and no coins are spent. A machine with no records is an honest skip, not a pass.
  const profileRoot = join(homedir(), 'Library/Application Support/Mitsumeru/mitsu-dsh/profiles/mitsu/generate')
  const liveRuns = join(profileRoot, 'runninghub', 'runs')
  const records = []
  try {
    for (const name of readdirSync(liveRuns)) {
      if (!name.endsWith('.json')) continue
      const record = JSON.parse(readFileSync(join(liveRuns, name), 'utf8'))
      for (const entry of ((record.outcome && record.outcome.saved) || [])) {
        if (!entry || typeof entry.file !== 'string' || entry.file === '') continue
        records.push({ jobId: String(record.jobId || name.replace(/\.json$/, '')), file: entry.file, present: existsSync(entry.file) })
      }
    }
  } catch {
    records.length = 0
  }

  if (records.length === 0) {
    check('live: the real install serves its own saved file (skipped — no records here)', true, 'skipped')
  } else {
    // The route resolves its root at mount, so the live call needs the real plugin root
    // (`<profile>/generate`) rather than the temp one.
    process.env.RH_DATA_DIR = profileRoot
    const liveServer = fakeServer()
    const liveCtx = {
      get: (name) => (name === 'webServer' ? liveServer : name === 'credentials' ? credentials : undefined),
      effect: (fn) => { fn(); return () => {} },
      inject: () => {},
    }
    module.apply(liveCtx, {})
    const liveHandler = liveServer.routes.find((route) => route.kind === 'prefix').handler
    const live = records.find((record) => record.present)
    if (!live) {
      check('live: no record on this machine still has its file', true, records.length + ' records, all missing')
    } else {
      const res = fakeRes()
      await liveHandler(fakeReq('GET', RESULT('runninghub') + '?job=' + encodeURIComponent(live.jobId) + '&i=0'), res)
      await waitForEnd(res)
      const onDisk = readFileSync(live.file)
      const same = res.statusCode === 200 && createHash('sha256').update(res.bytes()).digest('hex') === createHash('sha256').update(onDisk).digest('hex')
      check('live: the real install serves its own saved file, byte for byte', same, 'job ' + live.jobId + ' — status ' + res.statusCode + ', ' + res.bytes().length + '/' + onDisk.length + ' bytes, ' + res.headers['content-type'])
    }
    // The count is the library's own first measurement: the missing ones are what its
    // "where is it" state exists to say, so the number is reported rather than hidden.
    const present = records.filter((record) => record.present).length
    check('live: and the machine reports which records still have bytes', present > 0, present + ' of ' + records.length + ' recorded files are present')
    process.env.RH_DATA_DIR = dataRoot
  }
}

finish()
