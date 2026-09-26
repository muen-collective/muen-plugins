/**
 * verify:run — S5's claims for Krea, asserted rather than intended.
 *
 * The claim: **a person sees the exact request before it is sent, and nothing is spent
 * without that person's own confirmation.** Three rules from §12 are checked here rather
 * than described:
 *
 *   1. the gate's preview and the request are built by ONE function, so the dialog cannot
 *      describe something other than what leaves the machine;
 *   2. a run the API would reject is refused BEFORE the POST (no credit for a 400);
 *   3. the route refuses a call without `confirmed: true`, so a script, a stale tab or a
 *      future agent tool cannot spend without a person.
 *
 * THE HOST HALF IS DRIVEN FOR REAL: `lib/providers.js` and `lib/index.js` are imported,
 * `apply()` mounts the routes against a recording web server and a recording credentials
 * seam, and every call goes through the shipped handlers. The Krea API is stubbed and the
 * stub records what it was asked, which is how "nothing was posted" is provable rather than
 * asserted.
 *
 * The first case is the founder's own call (2026-09-23, the SDK snippet that named this
 * model): the body built from the model's own defaults must equal the `input` object he
 * pasted. Anything else means the surface is not sending what Krea's own example sends.
 *
 *   node verify/run.mjs
 */
import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { Readable } from 'node:stream'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')
const BASE = 'https://api.krea.ai'
const KEY_REF = 'KREA_API_KEY'
const SECRET = 'krea_test_key_123456'
const PROVIDERS_PATH = '/plugins/generate/providers'

const { buildRunPayload, getRun, postRun } = await import(pathToFileURL(join(ROOT, 'lib/krea-run.js')).href)
const providers = await import(pathToFileURL(join(ROOT, 'lib/providers.js')).href)
const { krea, runninghub, runOptions } = providers
const { buildRhPayload } = await import(pathToFileURL(join(ROOT, 'lib/runninghub-run.js')).href)
const { libraryPath } = await import(pathToFileURL(join(ROOT, 'lib/library.js')).href)
const { dataPaths, resolveDataRoot } = await import(pathToFileURL(join(ROOT, 'lib/paths.js')).href)
const { SHIPPED_KREA_MODELS } = await import(pathToFileURL(join(ROOT, 'lib/krea-models.js')).href)

// ── reporter (the same shape as the plugin's other suites) ───────────────────

const rows = []
const check = (label, ok, detail) => rows.push({ label, status: ok ? 'pass' : 'fail', detail: detail == null ? '' : String(detail) })

function finish() {
  let failed = 0
  process.stdout.write('\nverify:run — S5 (the gate, the run, and the result)\n')
  for (const row of rows) {
    if (row.status === 'pass') continue
    if (row.status === 'fail') failed += 1
    process.stdout.write('  FAIL  ' + row.label + (row.detail ? '  —  ' + row.detail : '') + '\n')
  }
  const passes = rows.filter((row) => row.status === 'pass').length
  process.stdout.write('  ' + passes + '/' + rows.length + ' passed\n')
  if (failed > 0) process.exitCode = 1
}

// ── the stubbed Krea API ─────────────────────────────────────────────────────

const turbo = SHIPPED_KREA_MODELS.find((model) => model.name === 'krea-2-medium-turbo')
const calls = []
/** What Krea answers next. */
let respond = () => ({ status: 200, body: { job_id: 'job-1', status: 'queued' } })
let throws = null

const fakeFetch = async (url, init = {}) => {
  calls.push({ url: String(url), method: (init.method || 'GET').toUpperCase(), headers: init.headers || {}, body: init.body })
  if (throws) throw throws
  const outcome = respond()
  return { ok: outcome.status >= 200 && outcome.status < 300, status: outcome.status, text: async () => JSON.stringify(outcome.body) }
}

// ── the founder's own call ───────────────────────────────────────────────────

/** The `input` object from the snippet he pasted, verbatim. */
const HIS_INPUT = {
  aspect_ratio: '1:1 (Square)',
  resolution: '1K',
  creativity: 'low',
  intensity: 0,
  complexity: 0,
  movement: 0,
  strength: 0.99,
}

check(
  "the model's own defaults build the body the founder's SDK call sends",
  (() => {
    const values = {}
    for (const [key, door] of Object.entries(turbo.doors)) if (door.default !== undefined) values[key] = door.default
    const { body, refused } = buildRunPayload(turbo, values)
    // The snippet has no `prompt` (his call was cut to the tuning doors), so the check is
    // on the body those doors build: every key he sent, with his own value.
    return refused.length === 0 && JSON.stringify(body) === JSON.stringify(HIS_INPUT)
  })(),
  (() => {
    const values = {}
    for (const [key, door] of Object.entries(turbo.doors)) if (door.default !== undefined) values[key] = door.default
    return JSON.stringify(buildRunPayload(turbo, values))
  })(),
)

// ── the payload builder ──────────────────────────────────────────────────────

check(
  'a required door with nothing in it is missing, not an error',
  (() => {
    const { body, missing, refused } = buildRunPayload(turbo, { aspect_ratio: '1:1 (Square)', resolution: '1K' })
    return missing.join(',') === 'prompt' && refused.length === 0 && body.prompt === undefined
  })(),
  JSON.stringify(buildRunPayload(turbo, {})),
)
check(
  'an untouched optional door is not sent: the API default is the API\'s',
  (() => {
    const { body } = buildRunPayload(turbo, { prompt: 'a house', aspect_ratio: '1:1 (Square)', resolution: '1K' })
    return !('seed' in body) && !('strength' in body) && !('intensity' in body) && body.prompt === 'a house'
  })(),
  JSON.stringify(buildRunPayload(turbo, { prompt: 'a house' }).body),
)
check(
  'a select outside its own options is refused by name, before anything is sent',
  (() => {
    const { refused, body } = buildRunPayload(turbo, { prompt: 'x', aspect_ratio: '7:3', resolution: '1K' })
    return refused.length === 1 && refused[0].key === 'aspect_ratio' && refused[0].reason === 'not-an-option' && body.aspect_ratio === undefined
  })(),
  JSON.stringify(buildRunPayload(turbo, { aspect_ratio: '7:3' }).refused),
)
check(
  'a number outside the API\'s own bounds is refused, and one inside is sent as a number',
  (() => {
    const tooBig = buildRunPayload(turbo, { prompt: 'x', intensity: 400 })
    const fine = buildRunPayload(turbo, { prompt: 'x', intensity: -40 })
    return (
      tooBig.refused.length === 1 &&
      tooBig.refused[0].reason === 'above-max' &&
      fine.refused.length === 0 &&
      fine.body.intensity === -40 &&
      typeof fine.body.intensity === 'number'
    )
  })(),
  JSON.stringify(buildRunPayload(turbo, { prompt: 'x', intensity: 400 }).refused),
)
check(
  'a number that is not a number is refused rather than sent as NaN',
  (() => {
    const { refused, body } = buildRunPayload(turbo, { prompt: 'x', strength: 'lots' })
    return refused.length === 1 && refused[0].reason === 'not-a-number' && body.strength === undefined
  })(),
  JSON.stringify(buildRunPayload(turbo, { strength: 'lots' }).refused),
)
check(
  'an image door takes a URL or a data URI, and refuses a browser file path by name',
  (() => {
    const url = buildRunPayload(turbo, { prompt: 'x', image_url: 'https://example.com/a.png' })
    const data = buildRunPayload(turbo, { prompt: 'x', image_url: 'data:image/png;base64,AAA' })
    const path = buildRunPayload(turbo, { prompt: 'x', image_url: 'C:\\fakepath\\a.png' })
    return (
      url.body.image_url === 'https://example.com/a.png' &&
      data.body.image_url === 'data:image/png;base64,AAA' &&
      path.refused.length === 1 &&
      path.refused[0].reason === 'not-a-url'
    )
  })(),
  JSON.stringify(buildRunPayload(turbo, { image_url: 'C:\\fakepath\\a.png' }).refused),
)

// ── the three array doors (founder, 2026-09-23: *"we are missing a lot of fields for
//    upload image for style ref, etc.."*) ────────────────────────────────────────

check(
  'a list door builds the array of objects the API takes, with each row its own numbers',
  (() => {
    const { body, missing, refused } = buildRunPayload(turbo, {
      prompt: 'a house',
      aspect_ratio: '1:1 (Square)',
      resolution: '1K',
      styles: [{ id: 'lora-1', strength: 1.5 }],
      image_style_references: [{ url: 'https://example.com/ref.png', strength: 0.25 }],
      moodboards: [{ id: '11111111-2222-4333-8444-555555555555', strength: 0.23 }],
    })
    return (
      missing.length === 0 &&
      refused.length === 0 &&
      JSON.stringify(body.styles) === JSON.stringify([{ id: 'lora-1', strength: 1.5 }]) &&
      JSON.stringify(body.image_style_references) === JSON.stringify([{ url: 'https://example.com/ref.png', strength: 0.25 }]) &&
      body.moodboards[0].id === '11111111-2222-4333-8444-555555555555' &&
      typeof body.styles[0].strength === 'number'
    )
  })(),
  JSON.stringify(buildRunPayload(turbo, { prompt: 'x', aspect_ratio: '1:1 (Square)', resolution: '1K', styles: [{ id: 'lora-1', strength: 1.5 }] }).body),
)
check(
  'a row with a required field still empty is missing under its own place in the list',
  (() => {
    const { body, missing } = buildRunPayload(turbo, { prompt: 'x', aspect_ratio: '1:1 (Square)', resolution: '1K', styles: [{ strength: 1 }], moodboards: [{ id: 'not-a-uuid' }] })
    return missing.join(',') === 'styles[0].id' && body.styles !== undefined && body.styles[0].id === undefined
  })(),
  JSON.stringify(buildRunPayload(turbo, { prompt: 'x', aspect_ratio: '1:1 (Square)', resolution: '1K', styles: [{ strength: 1 }] })),
)
check(
  'an empty row the add control created is not a row: nothing is sent for it',
  (() => {
    const { body, missing, refused } = buildRunPayload(turbo, { prompt: 'x', aspect_ratio: '1:1 (Square)', resolution: '1K', styles: [{}, { id: 'lora-1', strength: 1 }], moodboards: [{}] })
    return missing.length === 0 && refused.length === 0 && body.styles.length === 1 && body.moodboards === undefined
  })(),
  JSON.stringify(buildRunPayload(turbo, { prompt: 'x', aspect_ratio: '1:1 (Square)', resolution: '1K', styles: [{}, { id: 'lora-1', strength: 1 }] }).body),
)
check(
  "a list past the API's own maxItems is refused whole, before anything is sent",
  (() => {
    const rows = Array.from({ length: 11 }, (_, index) => ({ url: 'https://example.com/' + index + '.png' }))
    const { body, refused } = buildRunPayload(turbo, { prompt: 'x', aspect_ratio: '1:1 (Square)', resolution: '1K', image_style_references: rows })
    const ten = buildRunPayload(turbo, { prompt: 'x', aspect_ratio: '1:1 (Square)', resolution: '1K', image_style_references: rows.slice(0, 10) })
    return (
      refused.length === 1 &&
      refused[0].key === 'image_style_references' &&
      refused[0].reason === 'too-many' &&
      body.image_style_references === undefined &&
      ten.refused.length === 0 &&
      ten.body.image_style_references.length === 10
    )
  })(),
  JSON.stringify(buildRunPayload(turbo, { prompt: 'x', aspect_ratio: '1:1 (Square)', resolution: '1K', image_style_references: Array.from({ length: 11 }, () => ({ url: 'https://e/x.png' })) }).refused),
)
check(
  "a row's own bounds are the API's: a style strength past 2 is refused by its place",
  (() => {
    const { refused, body } = buildRunPayload(turbo, { prompt: 'x', aspect_ratio: '1:1 (Square)', resolution: '1K', styles: [{ id: 'a', strength: 3 }] })
    const row = buildRunPayload(turbo, { prompt: 'x', aspect_ratio: '1:1 (Square)', resolution: '1K', styles: [{ id: 'a', strength: 2 }] })
    return (
      refused.length === 1 &&
      refused[0].key === 'styles[0].strength' &&
      refused[0].reason === 'above-max' &&
      body.styles[0].strength === undefined &&
      row.refused.length === 0
    )
  })(),
  JSON.stringify(buildRunPayload(turbo, { prompt: 'x', aspect_ratio: '1:1 (Square)', resolution: '1K', styles: [{ id: 'a', strength: 3 }] }).refused),
)
check(
  'an image inside a row is an image door too: a reference with no URL is missing, one with a URL is sent',
  (() => {
    const without = buildRunPayload(turbo, { prompt: 'x', aspect_ratio: '1:1 (Square)', resolution: '1K', image_style_references: [{ strength: 0.5 }] })
    const with_ = buildRunPayload(turbo, { prompt: 'x', aspect_ratio: '1:1 (Square)', resolution: '1K', image_style_references: [{ url: 'https://example.com/a.png' }] })
    return (
      without.missing.join(',') === 'image_style_references[0].url' &&
      with_.missing.length === 0 &&
      with_.body.image_style_references[0].url === 'https://example.com/a.png'
    )
  })(),
  JSON.stringify(buildRunPayload(turbo, { prompt: 'x', aspect_ratio: '1:1 (Square)', resolution: '1K', image_style_references: [{ strength: 0.5 }] }).missing),
)

// ── the two calls Krea answers ───────────────────────────────────────────────

const post = await postRun({ base: BASE, endpoint: turbo.endpoint, body: HIS_INPUT, key: SECRET, fetchImpl: fakeFetch })
check(
  'a run posts to the model\'s own endpoint, with the key in one header and the body as JSON',
  (() => {
    const last = calls[calls.length - 1]
    return (
      post.jobId === 'job-1' &&
      last.url === BASE + '/generate/image/krea/krea-2/medium-turbo' &&
      last.method === 'POST' &&
      last.headers.Authorization === 'Bearer ' + SECRET &&
      JSON.parse(last.body).aspect_ratio === '1:1 (Square)'
    )
  })(),
  JSON.stringify({ url: calls[calls.length - 1]?.url, method: calls[calls.length - 1]?.method }),
)

for (const [status, expected] of [
  [401, 'invalid-key'],
  [402, 'no-api-balance'],
  [429, 'too-many-jobs'],
  [400, 'bad-request'],
  [500, 'http-500'],
]) {
  respond = () => ({ status, body: { error: 'krea says: ' + status } })
  const outcome = await postRun({ base: BASE, endpoint: turbo.endpoint, body: HIS_INPUT, key: SECRET, fetchImpl: fakeFetch })
  check(
    'Krea answering ' + status + ' is reported as ' + expected,
    outcome.error === expected && (status !== 400 || String(outcome.detail).includes('krea says')),
    JSON.stringify(outcome),
  )
}

respond = () => ({ status: 200, body: { status: 'queued' } })
check(
  'a 200 without a job id is an unexpected answer, not a run',
  (await postRun({ base: BASE, endpoint: turbo.endpoint, body: HIS_INPUT, key: SECRET, fetchImpl: fakeFetch })).error === 'unexpected-response',
  'a job id is what makes a run readable',
)
throws = Object.assign(new Error('boom'), { name: 'TimeoutError' })
check(
  'a network failure is never reported as a bad key',
  (await postRun({ base: BASE, endpoint: turbo.endpoint, body: HIS_INPUT, key: SECRET, fetchImpl: fakeFetch })).error === 'timeout',
  '',
)
throws = null

const jobResponse = (body, status = 200) => {
  respond = () => ({ status, body })
  return getRun({ base: BASE, jobId: 'job-1', key: SECRET, fetchImpl: fakeFetch })
}

const completed = await jobResponse({ status: 'completed', result: { urls: ['https://gen.krea.ai/a.png'] } })
const stillQueued = await jobResponse({ status: 'queued' })
const sampling = await jobResponse({ status: 'sampling' })
const failed = await jobResponse({ status: 'failed', error: { code: 'x', message: 'the model refused this prompt' } })
const empty = await jobResponse({ status: 'completed', result: { urls: [] } })
const gone = await jobResponse({ error: 'nope' }, 404)
const denied = await jobResponse({ error: 'nope' }, 401)

check(
  'a completed job carries its images',
  completed.state === 'done' && completed.urls[0] === 'https://gen.krea.ai/a.png',
  JSON.stringify(completed),
)
check(
  'an in-flight job reads as queued or running, never as done',
  stillQueued.state === 'queued' && sampling.state === 'running',
  JSON.stringify([stillQueued.state, sampling.state]),
)
check(
  "a failed job keeps Krea's own message verbatim",
  failed.state === 'failed' && failed.error.message === 'the model refused this prompt',
  JSON.stringify(failed),
)
check(
  'a completed job with no images is a failure, not a success with nothing to show',
  empty.state === 'failed',
  JSON.stringify(empty),
)
check(
  'a job that is no longer on the provider, and a key that stopped working, are two answers',
  gone.error === 'job-not-found' && denied.error === 'invalid-key',
  JSON.stringify([gone, denied]),
)

// ── the provider, end to end, against a temp profile ─────────────────────────

const dataRoot = mkdtempSync(join(tmpdir(), 'krea-run-'))
process.env.RH_DATA_DIR = dataRoot
const providerRoot = dataPaths(dataRoot, 'krea').root
const values = { prompt: 'a cinematic glass cabin', aspect_ratio: '16:9 (Widescreen)', resolution: '1K' }

const preview = await krea.previewRun({ root: providerRoot, name: 'krea-2-medium-turbo', values })
check(
  'the preview names the model, its endpoint and the exact body',
  preview.model === 'image/krea/krea-2/medium-turbo' &&
    preview.endpoint === '/generate/image/krea/krea-2/medium-turbo' &&
    preview.body.prompt === 'a cinematic glass cabin' &&
    preview.body.aspect_ratio === '16:9 (Widescreen)',
  JSON.stringify(preview),
)
check(
  'the preview of a name that is not a model is not-found',
  (await krea.previewRun({ root: providerRoot, name: 'nope', values })).error === 'not-found',
  '',
)

// NOTHING IS POSTED FOR AN INCOMPLETE PAYLOAD: the refusals happen before the fetch, which
// is the difference between a gate and a dialog that merely looks like one.
calls.length = 0
const incomplete = await krea.startRun({ root: providerRoot, name: 'krea-2-medium-turbo', values: { aspect_ratio: '1:1 (Square)' }, key: SECRET, fetchImpl: fakeFetch })
check(
  'a run with a required door still empty never reaches the network',
  incomplete.error === 'payload-incomplete' && calls.length === 0,
  JSON.stringify({ error: incomplete.error, calls: calls.length }),
)
calls.length = 0
const refused = await krea.startRun({
  root: providerRoot,
  name: 'krea-2-medium-turbo',
  values: { prompt: 'x', aspect_ratio: '1:1 (Square)', resolution: '1K', aspect_ratio: '7:3', resolution: '1K' },
  key: SECRET,
  fetchImpl: fakeFetch,
})
check(
  'a run with a value the API would reject never reaches the network either',
  refused.error === 'payload-refused' && calls.length === 0,
  JSON.stringify({ error: refused.error, calls: calls.length }),
)

respond = () => ({ status: 200, body: { job_id: 'job-42', status: 'queued' } })
const started = await krea.startRun({ root: providerRoot, name: 'krea-2-medium-turbo', values, key: SECRET, fetchImpl: fakeFetch })
const recordAt = join(providerRoot, 'runs', 'job-42.json')
const record = JSON.parse(readFileSync(recordAt, 'utf8'))
check(
  'a started run answers with its job id, and leaves one file beside the adapters',
  started.jobId === 'job-42' && record.jobId === 'job-42' && typeof record.at === 'string',
  JSON.stringify(started),
)
check(
  'the record holds what was asked for, and that a person confirmed it',
  record.model === 'image/krea/krea-2/medium-turbo' &&
    record.body.prompt === 'a cinematic glass cabin' &&
    record.gate.confirmed === true &&
    record.gate.by === 'human' &&
    typeof record.at === 'string',
  JSON.stringify(record),
)
check(
  'THE KEY IS NOT IN THE RECORD: what is written is what a person already saw',
  !readFileSync(recordAt, 'utf8').includes(SECRET),
  'the file must not carry the credential',
)

respond = () => ({ status: 200, body: { status: 'completed', result: { urls: ['https://gen.krea.ai/out.png'] } } })
// THE BYTES ARE DOWNLOADED ON THE TERMINAL READ (founder, 2026-09-23: *"also for saving to
// local"*). The provider's API answer is JSON; its output link is the picture, and the two
// arrive through the same injected fetch, so this one answers both.
const PNG_BYTES = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex')
const apiAndImage = async (url, init = {}) => {
  if (String(url).startsWith('https://gen.krea.ai/')) {
    return {
      ok: true,
      status: 200,
      headers: { get: () => 'image/png' },
      arrayBuffer: async () => PNG_BYTES.buffer.slice(PNG_BYTES.byteOffset, PNG_BYTES.byteOffset + PNG_BYTES.byteLength),
    }
  }
  return fakeFetch(url, init)
}
const libraryDir = join(dataRoot, 'library')
const polled = await krea.readRun({ root: providerRoot, jobId: 'job-42', key: SECRET, libraryRoot: libraryDir, fetchImpl: apiAndImage })
const settled = JSON.parse(readFileSync(recordAt, 'utf8'))
check(
  'the poll that finishes a run writes the outcome back to the same file',
  polled.state === 'done' &&
    settled.status === 'completed' &&
    settled.urls[0] === 'https://gen.krea.ai/out.png' &&
    typeof settled.finishedAt === 'string',
  JSON.stringify(settled),
)
// WHERE THE BYTES LAND: <library>/<provider>/<workflow>/<yyyymmdd>-<jobId>.<ext>, chosen by
// the founder on 2026-09-23. The extension comes from the response's own content type, the
// day from the record, and the workflow from the unit's name rather than from an endpoint.
const savedFile = join(libraryDir, 'krea', 'krea-2-medium-turbo', new Date(record.at).toISOString().slice(0, 10).replace(/-/g, '') + '-job-42.png')
check(
  'a finished run saves its bytes into the library, and the record says where',
  (() => {
    try {
      const bytes = readFileSync(savedFile)
      const first = polled.saved[0] || {}
      const recorded = settled.saved[0] || {}
      return (
        bytes.length === PNG_BYTES.length &&
        polled.saved.length === 1 &&
        first.file === savedFile &&
        settled.saved.length === 1 &&
        recorded.type === 'png' &&
        recorded.bytes === PNG_BYTES.length
      )
    } catch {
      return false
    }
  })(),
  savedFile,
)
check(
  'reading the same terminal state again does not download or rewrite it',
  (async () => {
    let reads = 0
    const counting = async (url, init = {}) => {
      if (String(url).startsWith('https://gen.krea.ai/')) reads += 1
      return apiAndImage(url, init)
    }
    const again = await krea.readRun({ root: providerRoot, jobId: 'job-42', key: SECRET, libraryRoot: libraryDir, fetchImpl: counting })
    return reads === 1 && again.saved.length === 1 && again.saved[0].already === true
  })(),
  'a poll may read the same terminal state more than once',
)
// A SAVE THAT FAILS NEVER FAILS THE RUN: the provider's answer is still the answer, and the
// record says plainly that the bytes are missing.
{
  const dead = async (url, init = {}) => {
    if (String(url).startsWith('https://gen.krea.ai/')) return { ok: false, status: 502, headers: { get: () => null } }
    return fakeFetch(url, init)
  }
  const lossy = await krea.readRun({ root: providerRoot, jobId: 'job-42', key: SECRET, libraryRoot: join(dataRoot, 'library-2'), fetchImpl: dead })
  check(
    'a download that fails leaves the run done and records the failure',
    lossy.state === 'done' && lossy.urls.length === 1 && lossy.saved.length === 0 && (lossy.saveErrors[0] || {}).error === 'http-502',
    JSON.stringify({ state: lossy.state, saved: lossy.saved, errors: lossy.saveErrors }),
  )
}
check(
  'a workflow name and a job id cannot climb out of the library',
  (() => {
    // Deep enough that an unsanitised segment would climb ABOVE the library root, which is
    // the escape `path.join` still shows after it normalises the `..` away.
    const escaped = libraryPath(join(dataRoot, 'library'), {
      provider: '../../../../etc',
      workflow: '../../../../etc',
      jobId: '../../../../tmp/x',
      at: '2026-09-23T00:00:00Z',
      ext: 'png',
    })
    return escaped.startsWith(join(dataRoot, 'library')) && !escaped.includes('..')
  })(),
  libraryPath(join(dataRoot, 'library'), {
    provider: '../../../../etc',
    workflow: '../../../../etc',
    jobId: '../../../../tmp/x',
    at: '2026-09-23T00:00:00Z',
    ext: 'png',
  }),
)

// ── the routes ───────────────────────────────────────────────────────────────

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

function fakeCredentials(value) {
  const calls_ = []
  return {
    calls: calls_,
    async describe() {
      calls_.push(['describe'])
      return { configured: value !== undefined, source: value === undefined ? undefined : 'file', writable: true }
    },
    async resolve() {
      calls_.push(['resolve'])
      return value === undefined ? undefined : { value, source: 'file' }
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
    },
  }
  return res
}

function fakeReq(method, body, path) {
  const req = Readable.from(body === undefined ? [] : [Buffer.from(typeof body === 'string' ? body : JSON.stringify(body))])
  req.method = method
  req.url = path
  return req
}

async function call(handler, method, body, path) {
  const res = fakeRes()
  await handler(fakeReq(method, body, path), res)
  return res
}

const json = (res) => {
  try {
    return JSON.parse(res.body)
  } catch {
    return null
  }
}

// The routes call the provider without an injected `fetch`, exactly as the running host
// does, so the stub has to be the global one here — otherwise these cases would talk to
// api.krea.ai (which is how a first cut of this file returned a real 401).
const realFetch = globalThis.fetch
globalThis.fetch = fakeFetch

const server = fakeServer()
const credentials = fakeCredentials(SECRET)
const ctx = {
  get: (name) => (name === 'webServer' ? server : name === 'credentials' ? credentials : undefined),
  effect: (fn) => {
    fn()
    return () => {}
  },
  inject: () => {},
}
const module = await import(pathToFileURL(join(ROOT, 'lib/index.js')).href)
module.apply(ctx, {})
const handler = server.routes.find((route) => route.kind === 'prefix').handler
const RUN_PATH = PROVIDERS_PATH + '/krea/run'
const PAYLOAD_PATH = PROVIDERS_PATH + '/krea/payload'

calls.length = 0
const notConfirmed = await call(handler, 'POST', { name: 'krea-2-medium-turbo', values }, RUN_PATH)
check(
  'THE GATE CANNOT BE SKIPPED: a run posted without `confirmed` is refused, and nothing is posted to Krea',
  notConfirmed.statusCode === 400 && json(notConfirmed).error === 'not-confirmed' && calls.length === 0,
  JSON.stringify({ status: notConfirmed.statusCode, body: json(notConfirmed), kreaCalls: calls.length }),
)

respond = () => ({ status: 200, body: { job_id: 'job-7', status: 'queued' } })
const confirmed = await call(handler, 'POST', { name: 'krea-2-medium-turbo', values, confirmed: true }, RUN_PATH)
check(
  'the same call with `confirmed` starts the run and answers with the job id',
  confirmed.statusCode === 200 && json(confirmed).jobId === 'job-7' && calls.length === 1,
  JSON.stringify({ status: confirmed.statusCode, body: json(confirmed) }),
)
check(
  'the route reads the key from the credential store, under the provider\'s own reference',
  credentials.calls.filter((entry) => entry[0] === 'resolve').length === 1,
  JSON.stringify(credentials.calls),
)

const previewRoute = await call(handler, 'POST', { name: 'krea-2-medium-turbo', values }, PAYLOAD_PATH)
check(
  'the preview route answers the body the run would post, and spends nothing',
  previewRoute.statusCode === 200 && json(previewRoute).body.prompt === 'a cinematic glass cabin' && calls.length === 1,
  JSON.stringify(json(previewRoute)),
)

respond = () => ({ status: 200, body: { status: 'processing' } })
const pollRoute = await call(handler, 'GET', undefined, RUN_PATH + '?job=job-7')
check(
  'the poll route answers the job state through the same provider',
  pollRoute.statusCode === 200 && json(pollRoute).state === 'running',
  JSON.stringify(json(pollRoute)),
)
const pollWithoutJob = await call(handler, 'GET', undefined, RUN_PATH)
check(
  'a poll without a job id is refused by name',
  pollWithoutJob.statusCode === 400 && json(pollWithoutJob).error === 'bad-request',
  JSON.stringify(json(pollWithoutJob)),
)

// ── RunningHub's run, end to end ─────────────────────────────────────────────
//
// The slice this file used to say was owed: a node list built from the adapter's own
// `(nodeId, fieldName)` pairs, the task started with `instanceType` when one was chosen, and
// the two calls that read it back — status, then outputs for the files and the failure's own
// words. RunningHub's own OpenAPI, read 2026-09-23.
{
  const rhRoot = dataPaths(dataRoot, 'runninghub').root
  const adaptersDir = dataPaths(dataRoot, 'runninghub').adapters
  mkdirSync(adaptersDir, { recursive: true })
  const rhAdapter = {
    schema: 'muen-rh-adapter/v1',
    name: 'outfit-swap',
    title: 'Swap the outfit',
    blurb: 'Put the garment from one photo on the person in another.',
    origin: 'mine',
    source: { appId: '2072445848017002498', webappName: 'qwen image edit', url: 'https://www.runninghub.ai/app/2072445848017002498', revision: 'v1', checkedAt: '2026-09-23' },
    provenance: { dryRun: 'ok' },
    ui: { runLabel: 'Swap the outfit', order: ['person', 'garment', 'notes'] },
    doors: {
      person: { nodeId: '10', fieldName: 'image', type: 'image', label: 'Person photo', primary: true },
      garment: { nodeId: '11', fieldName: 'image', type: 'image', label: 'Garment photo' },
      notes: { nodeId: '12', fieldName: 'text', type: 'text', label: 'Notes' },
    },
  }
  writeFileSync(join(adaptersDir, 'outfit-swap.json'), JSON.stringify(rhAdapter, null, 2))
  const rhValues = { person: 'api/person.png', garment: 'https://cdn.example/garment.png', notes: 'keep the shoes' }

  const rhPreview = await runninghub.previewRun({ root: rhRoot, name: 'outfit-swap', values: rhValues, options: { instanceType: 'plus' } })
  check(
    'the RunningHub preview is the node list a run would post, in the order the adapter declares',
    rhPreview.endpoint === '/task/openapi/ai-app/run' &&
      rhPreview.body.webappId === '2072445848017002498' &&
      rhPreview.body.instanceType === 'plus' &&
      JSON.stringify(rhPreview.nodeInfoList) ===
        JSON.stringify([
          { nodeId: '10', fieldName: 'image', fieldValue: 'api/person.png' },
          { nodeId: '11', fieldName: 'image', fieldValue: 'https://cdn.example/garment.png' },
          { nodeId: '12', fieldName: 'text', fieldValue: 'keep the shoes' },
        ]),
    JSON.stringify(rhPreview.body),
  )
  check(
    "a run left on the provider's own default does not name it: the API's default is the same word",
    (() => {
      const plain = buildRhPayload(rhAdapter, rhValues)
      return plain.body.instanceType === undefined && plain.body.nodeInfoList.length === 3
    })(),
    'instanceType is sent only when a person chose a machine',
  )
  check(
    'a browser file path is refused before the run: no node can load a file on the person\'s disk',
    (() => {
      const read = buildRhPayload(rhAdapter, { ...rhValues, person: 'C:\\Users\\me\\look.png' })
      return read.refused.length === 1 && read.refused[0].key === 'person' && read.refused[0].reason === 'not-uploaded'
    })(),
    JSON.stringify(buildRhPayload(rhAdapter, { ...rhValues, person: 'blob:http://127.0.0.1/x' }).refused),
  )
  // WHETHER A SURFACE CAN RUN IS THE PROVIDER'S FACT, and the workflow route is where the
  // page learns it: one adapter file means the same thing under a provider that can spend
  // and one that cannot, which is why the flag is added at the route rather than written
  // into the file.
  const rhServed = await call(handler, 'GET', undefined, PROVIDERS_PATH + '/runninghub/workflow?name=outfit-swap')
  check(
    "the workflow route tells the page this provider can run, from the registry's own flag",
    rhServed.statusCode === 200 && json(rhServed).runnable === true && json(rhServed).source === undefined,
    JSON.stringify({ status: rhServed.statusCode, runnable: json(rhServed).runnable, source: json(rhServed).source }),
  )
  check(
    'the registry says which providers can run, and the two that cannot say nothing',
    (() => {
      const { PROVIDERS } = providers
      return (
        PROVIDERS.find((provider) => provider.id === 'runninghub').runnable === true &&
        PROVIDERS.find((provider) => provider.id === 'krea').runnable === true &&
        PROVIDERS.find((provider) => provider.id === 'comfycloud').runnable !== true &&
        PROVIDERS.find((provider) => provider.id === 'magnific').runnable !== true
      )
    })(),
    JSON.stringify(providers.PROVIDERS.map((provider) => [provider.id, provider.runnable === true])),
  )
  check(
    'the preview of a name that is not an installed workflow is not-found',
    (await runninghub.previewRun({ root: rhRoot, name: 'nope', values: rhValues })).error === 'not-found',
    '',
  )

  // The run itself, with the API's own answers: start, status, outputs.
  const rhCalls = []
  const RH_IMAGE_BYTES = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex')
  const rhFetch = async (url, init = {}) => {
    const target = String(url)
    // The result link is the picture, not the API: RunningHub hands out a plain https URL,
    // and this one answers it with bytes so the library has something to save.
    if (target.startsWith('https://rh-images.example/')) {
      return {
        ok: true,
        status: 200,
        headers: { get: () => 'image/png' },
        arrayBuffer: async () => RH_IMAGE_BYTES.buffer.slice(RH_IMAGE_BYTES.byteOffset, RH_IMAGE_BYTES.byteOffset + RH_IMAGE_BYTES.byteLength),
      }
    }
    rhCalls.push({ url: target, body: JSON.parse((init && init.body) || '{}') })
    const path = target.replace(/^https:\/\/www\.runninghub\.ai/, '')
    const answer = (body) => ({ ok: true, status: 200, text: async () => JSON.stringify(body) })
    if (path === '/task/openapi/ai-app/run') return answer({ code: 0, msg: 'success', data: { taskId: '1907035719658053634', taskStatus: 'RUNNING' } })
    if (path === '/task/openapi/status') return answer({ code: 0, msg: '', data: rhStatus })
    if (path === '/task/openapi/outputs') return answer(rhOutputs)
    return answer({ code: 404, msg: 'no such route' })
  }
  let rhStatus = 'RUNNING'
  let rhOutputs = { code: 804, msg: 'APIKEY_TASK_IS_RUNNING', data: { netWssUrl: 'wss://…' } }

  const started = await runninghub.startRun({ root: rhRoot, name: 'outfit-swap', values: rhValues, options: { instanceType: 'ultra' }, key: SECRET, fetchImpl: rhFetch })
  check(
    'the run posts to the AI App endpoint with the key, the app and the node list, and answers a task id',
    started.jobId === '1907035719658053634' &&
      (() => {
        const first = rhCalls[0]
        return (
          first.url === 'https://www.runninghub.ai/task/openapi/ai-app/run' &&
          first.body.apiKey === SECRET &&
          first.body.webappId === '2072445848017002498' &&
          first.body.instanceType === 'ultra' &&
          first.body.nodeInfoList.length === 3
        )
      })(),
    JSON.stringify(rhCalls[0]),
  )
  check(
    "the run's record holds the node list and the machine, and never the key",
    (() => {
      const record = JSON.parse(readFileSync(join(rhRoot, 'runs', '1907035719658053634.json'), 'utf8'))
      return (
        record.schema === 'muen-rh-run/v1' &&
        record.appId === '2072445848017002498' &&
        record.options.instanceType === 'ultra' &&
        record.gate.confirmed === true &&
        !JSON.stringify(record).includes(SECRET)
      )
    })(),
    join(rhRoot, 'runs', '1907035719658053634.json'),
  )

  const running = await runninghub.readRun({ root: rhRoot, jobId: started.jobId, key: SECRET, fetchImpl: rhFetch })
  check(
    'a task in flight answers the state the strip draws, without asking for outputs',
    running.state === 'running' && running.status === 'RUNNING' && rhCalls.filter((call) => call.url.endsWith('/outputs')).length === 0,
    JSON.stringify(running),
  )

  rhStatus = 'SUCCESS'
  rhOutputs = {
    code: 0,
    msg: 'success',
    data: [{ fileUrl: 'https://rh-images.example/output/swap_00001.png', fileType: 'png', taskCostTime: '83', nodeId: '12', consumeCoins: '17' }],
  }
  const rhLibrary = join(dataRoot, 'library')
  const done = await runninghub.readRun({ root: rhRoot, jobId: started.jobId, key: SECRET, libraryRoot: rhLibrary, fetchImpl: rhFetch })
  check(
    'a finished task answers its files, and the record gains the outcome',
    done.state === 'done' &&
      done.urls[0] === 'https://rh-images.example/output/swap_00001.png' &&
      (() => {
        const record = JSON.parse(readFileSync(join(rhRoot, 'runs', '1907035719658053634.json'), 'utf8'))
        return record.outcome && record.outcome.state === 'done' && record.outcome.urls.length === 1
      })(),
    JSON.stringify(done),
  )
  check(
    "RunningHub's result is saved under its own workflow folder, typed by the API's own fileType",
    (() => {
      const guess = join(rhLibrary, 'runninghub', 'outfit-swap')
      let names = []
      try {
        names = readdirSync(guess)
      } catch {
        return false
      }
      const file = names.find((name) => name.endsWith('.png'))
      if (!file) return false
      return (
        done.saved.length === 1 &&
        done.saved[0].type === 'png' &&
        readFileSync(join(guess, file)).length === RH_IMAGE_BYTES.length &&
        /^\d{8}-1907035719658053634\.png$/.test(file)
      )
    })(),
    JSON.stringify(done.saved),
  )

  rhStatus = 'FAILED'
  rhOutputs = {
    code: 805,
    msg: 'APIKEY_TASK_STATUS_ERROR',
    data: { failedReason: { node_name: 'KSampler', exception_message: 'KSampler.sample() got an unexpected keyword argument' } },
  }
  const failed = await runninghub.readRun({ root: rhRoot, jobId: started.jobId, key: SECRET, fetchImpl: rhFetch })
  check(
    "a failed task carries the workflow's own words, not a sentence this plugin invented",
    failed.state === 'failed' && failed.error.message === 'KSampler.sample() got an unexpected keyword argument' && failed.error.node === 'KSampler',
    JSON.stringify(failed.error),
  )
  check(
    'a task the provider does not know is job-not-found, not a network failure',
    (async () => {
      const unknown = async (url) => ({ ok: true, status: 200, text: async () => JSON.stringify({ code: 805, msg: 'APIKEY_TASK_STATUS_ERROR', data: null }) })
      const read = await runninghub.readRun({ root: rhRoot, jobId: 'nope', key: SECRET, fetchImpl: unknown })
      return read.error === 'job-not-found'
    })(),
    '',
  )
}

// ── a run's own options, read through what the provider declares ─────────────
//
// RunningHub's `instanceType` (default 24GB / plus 48GB / ultra 84GB, from its own OpenAPI)
// is not a door: it is the same three choices for every app and it goes to the request's top
// level. The provider declares it, the route validates a request against that declaration,
// and the preview echoes what it would send so the gate can show it.
{
  // RunningHub can run now, so its payload route answers instead of 501, and a mode outside
  // the declared list is refused by name before anything is built.
  const RH_PAYLOAD = PROVIDERS_PATH + '/runninghub/payload'
  const rhBadMode = await call(handler, 'POST', { name: 'outfit-swap', values: {}, options: { instanceType: 'quantum' } }, RH_PAYLOAD)
  check(
    'a mode outside the declared list is refused by the route, by name',
    rhBadMode.statusCode === 400 && json(rhBadMode).error === 'bad-option',
    JSON.stringify({ status: rhBadMode.statusCode, body: json(rhBadMode) }),
  )
  const rhGood = await call(handler, 'POST', { name: 'outfit-swap', values: { notes: 'keep the shoes' }, options: { instanceType: 'plus' } }, RH_PAYLOAD)
  check(
    'the RunningHub payload route answers the node list, and echoes the machine it would run on',
    rhGood.statusCode === 200 && json(rhGood).options.instanceType === 'plus' && json(rhGood).body.instanceType === 'plus',
    JSON.stringify({ status: rhGood.statusCode, body: json(rhGood).body }),
  )
  // Krea declares no runOption at all, so options sent to it are refused rather than
  // silently dropped: a value nobody declared must not travel into somebody else's API.
  const kreaOption = await call(handler, 'POST', { name: 'krea-2-medium-turbo', values, options: { instanceType: 'plus' } }, PAYLOAD_PATH)
  check(
    'a provider that declares no run options refuses one rather than ignoring it',
    kreaOption.statusCode === 400 && json(kreaOption).error === 'bad-option',
    JSON.stringify({ status: kreaOption.statusCode, body: json(kreaOption) }),
  )
  // And with nothing declared and nothing sent, the route answers as it always did.
  const noOptions = await call(handler, 'POST', { name: 'krea-2-medium-turbo', values }, PAYLOAD_PATH)
  check(
    'no options at all is still a valid request, on any provider',
    noOptions.statusCode === 200 && json(noOptions).options === null,
    JSON.stringify(json(noOptions).options),
  )
  // The declaration is read directly too, because the route can only reach one of its
  // branches today: no runnable provider declares modes yet (Krea declares none,
  // RunningHub cannot run), so an unknown KEY is refused by a route and an unknown VALUE
  // is refused here. Both are the same rule, and the day RunningHub runs the first covers
  // the second as well.
  const withModes = { id: 'fake', runOption: { key: 'instanceType', label: 'Instance', fallback: 'default', modes: [{ id: 'default' }, { id: 'plus' }] } }
  check(
    'an option the provider never declared is refused by name',
    (() => {
      const read = runOptions(withModes, { gpu: 'plus' })
      return read.ok === false && read.detail.includes('instanceType')
    })(),
    JSON.stringify(runOptions(withModes, { gpu: 'plus' })),
  )
  check(
    'a mode outside the declared list is refused by name',
    (() => {
      const read = runOptions(withModes, { instanceType: 'quantum' })
      return read.ok === false && read.detail.includes('quantum')
    })(),
    JSON.stringify(runOptions(withModes, { instanceType: 'quantum' })),
  )
  check(
    'a missing mode becomes the provider\'s own fallback rather than an error',
    (() => {
      const read = runOptions(withModes, {})
      return read.ok === true && read.options.instanceType === 'default'
    })(),
    JSON.stringify(runOptions(withModes, {})),
  )
  check(
    'a valid mode is carried through as the request\'s own options',
    (() => {
      const read = runOptions(withModes, { instanceType: 'plus' })
      return read.ok === true && read.options.instanceType === 'plus' && Object.keys(read.options).length === 1
    })(),
    JSON.stringify(runOptions(withModes, { instanceType: 'plus' })),
  )
  const { runninghub } = await import(pathToFileURL(join(ROOT, 'lib/providers.js')).href)
  check(
    'RunningHub declares its own modes, with the sizes its documentation gives',
    (() => {
      const declared = runninghub.runOption
      return (
        !!declared &&
        declared.key === 'instanceType' &&
        declared.fallback === 'default' &&
        declared.modes.map((mode) => mode.id).join(',') === 'default,plus,ultra' &&
        declared.modes.every((mode) => typeof mode.label === 'string' && typeof mode.description === 'string')
      )
    })(),
    JSON.stringify(runninghub.runOption),
  )
  check(
    'the modes are RunningHub\'s own words for the machines, not a price',
    runninghub.runOption.modes.map((mode) => mode.description).join(' ') === '24GB VRAM 48GB VRAM 84GB VRAM',
    JSON.stringify(runninghub.runOption.modes.map((mode) => mode.description)),
  )
}

// A provider with no run path answers 501 rather than pretending: RunningHub's run is a
// workflow's node ids and an upload per image door, which is a different slice.
const unsupported = await call(handler, 'POST', { name: 'x', values: {}, confirmed: true }, PROVIDERS_PATH + '/comfycloud/run')
check(
  'a provider that cannot run yet says so, instead of failing at something else',
  unsupported.statusCode === 501 && json(unsupported).error === 'unsupported',
  JSON.stringify({ status: unsupported.statusCode, body: json(unsupported) }),
)

// A key that is not linked is a refusal with a name, not a 500.
const bare = fakeCredentials(undefined)
const bareServer = fakeServer()
module.apply(
  {
    get: (name) => (name === 'webServer' ? bareServer : name === 'credentials' ? bare : undefined),
    effect: (fn) => {
      fn()
      return () => {}
    },
    inject: () => {},
  },
  {},
)
const bareHandler = bareServer.routes.find((route) => route.kind === 'prefix').handler
const noKey = await call(bareHandler, 'POST', { name: 'krea-2-medium-turbo', values, confirmed: true }, RUN_PATH)
check(
  'a run with no key linked is refused by name, and never reaches the provider',
  noKey.statusCode === 400 && json(noKey).error === 'no-key',
  JSON.stringify({ status: noKey.statusCode, body: json(noKey) }),
)

// The data root the plugin resolved is the one the run wrote into: a run record landing
// anywhere else would be invisible to the profile that owns it.
globalThis.fetch = realFetch

check(
  'the run was written under the resolved profile root, not beside it',
  resolveDataRoot().root === dataRoot && readFileSync(join(dataRoot, 'krea', 'runs', 'job-42.json'), 'utf8').length > 0,
  JSON.stringify(resolveDataRoot()),
)
// ── the upload an image door needs ───────────────────────────────────────────
//
// An image a person picks cannot be a value: a browser reports the pick as `C:\fakepath\…`,
// and a real photograph inlined as a data URI is past the 1024 characters Krea's own fields
// allow. So the file goes to the provider's asset API and the door carries the URL that
// comes back. That call needs the key, so it goes through the host — the pane holds none.

const ASSET_PATH = PROVIDERS_PATH + '/krea/asset'
const FILE_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

// The section above restored the real `fetch` (its last claim is about the data root, not
// about the wire). These cases are about the wire, so the stub goes back on.
globalThis.fetch = fakeFetch

/** A POST whose body is the file itself, with the name and type in headers. */
async function callBytes(handler_, path, bytes, headers) {
  const req = Readable.from([bytes])
  req.method = 'POST'
  req.url = path
  req.headers = headers
  const res = fakeRes()
  await handler_(req, res)
  return res
}

respond = () => ({ status: 200, body: { id: 'asset-1', image_url: 'https://assets.krea.ai/asset-1.png', mime_type: 'image/png' } })
calls.length = 0
const uploaded = await callBytes(handler, ASSET_PATH, FILE_BYTES, { 'content-type': 'image/png', 'x-file-name': 'my%20photo.png' })
check(
  'an image door uploads through the host, and the door is handed the URL the asset API answered',
  uploaded.statusCode === 200 && json(uploaded).url === 'https://assets.krea.ai/asset-1.png',
  JSON.stringify({ status: uploaded.statusCode, body: json(uploaded) }),
)
check(
  "the upload posts the file to the provider's own asset path, with the key in one header",
  (() => {
    const last = calls[calls.length - 1]
    return (
      calls.length === 1 &&
      last.url === BASE + '/assets' &&
      last.method === 'POST' &&
      last.headers.Authorization === 'Bearer ' + SECRET &&
      typeof FormData !== 'undefined' &&
      last.body instanceof FormData
    )
  })(),
  JSON.stringify(calls.map((row) => ({ url: row.url, method: row.method, auth: row.headers.Authorization }))),
)
respond = () => ({ status: 401, body: { message: 'Unauthorized' } })
const refusedUpload = await callBytes(handler, ASSET_PATH, FILE_BYTES, { 'content-type': 'image/png', 'x-file-name': 'a.png' })
check(
  'a key the asset API refuses is reported as a bad key, not as a failed upload',
  refusedUpload.statusCode === 401 && json(refusedUpload).error === 'invalid-key',
  JSON.stringify({ status: refusedUpload.statusCode, body: json(refusedUpload) }),
)
respond = () => ({ status: 200, body: { id: 'asset-1', image_url: 'https://assets.krea.ai/asset-1.png' } })
const emptyUpload = await callBytes(handler, ASSET_PATH, Buffer.alloc(0), { 'content-type': 'image/png', 'x-file-name': 'a.png' })
check(
  'an upload with no bytes is refused before the provider is called: the body IS the file',
  emptyUpload.statusCode === 400 && json(emptyUpload).error === 'bad-request',
  JSON.stringify({ status: emptyUpload.statusCode, body: json(emptyUpload) }),
)
const noKeyUpload = await callBytes(bareHandler, ASSET_PATH, FILE_BYTES, { 'content-type': 'image/png', 'x-file-name': 'a.png' })
check(
  'an upload with no key linked is refused by name, and never reaches the provider',
  noKeyUpload.statusCode === 400 && json(noKeyUpload).error === 'no-key',
  JSON.stringify({ status: noKeyUpload.statusCode, body: json(noKeyUpload) }),
)
// RunningHub uploads too, since its run landed (2026-09-23), and it does it the way its own
// guide says: a multipart post carrying the key and the file kind as form parts, answering a
// `fileName` — the value an image door then holds, not a URL.
calls.length = 0
respond = () => ({ status: 200, body: { code: 0, msg: 'success', data: { fileName: 'api/9d77b8530f.png', fileType: 'input' } } })
const rhUpload = await callBytes(handler, PROVIDERS_PATH + '/runninghub/asset', FILE_BYTES, { 'content-type': 'image/png', 'x-file-name': 'look.png' })
check(
  'RunningHub uploads a picked file and answers the fileName an image door carries',
  rhUpload.statusCode === 200 && json(rhUpload).url === 'api/9d77b8530f.png',
  JSON.stringify({ status: rhUpload.statusCode, body: json(rhUpload) }),
)
check(
  "the upload goes to RunningHub's own endpoint, with its key and file kind as form parts",
  (() => {
    const last = calls[calls.length - 1]
    if (!last || last.method !== 'POST' || !(last.body instanceof FormData)) return false
    const form = last.body
    return (
      String(last.url).endsWith('/task/openapi/upload') &&
      form.get('apiKey') === SECRET &&
      form.get('fileType') === 'input' &&
      form.get('file') instanceof Blob
    )
  })(),
  JSON.stringify(calls.map((row) => ({ url: row.url, method: row.method }))),
)
// RunningHub's own limit is 30MB (its upload guide), refused here rather than at the wire.
respond = () => ({ status: 200, body: { code: 0, data: { fileName: 'x.png', fileType: 'input' } } })
const tooBig = await callBytes(handler, PROVIDERS_PATH + '/runninghub/asset', Buffer.alloc(30 * 1024 * 1024 + 1), { 'content-type': 'image/png', 'x-file-name': 'huge.png' })
check(
  "a file past RunningHub's own 30MB limit is refused before the upload",
  tooBig.statusCode === 413 && json(tooBig).error === 'too-large',
  JSON.stringify({ status: tooBig.statusCode, body: json(tooBig) }),
)

// ── the picked file is KEPT (epic 64 S2) ─────────────────────────────────────
//
// The handle a provider answers is not a durable record of what went in: RunningHub's guide
// says the file is not hosted, and Krea's asset link has its own lifetime. So the route keeps
// the bytes under the provider's own root, content-addressed, and answers the hash beside the
// handle. The claims: the copy is there and is byte-identical; the same bytes are written
// ONCE however many times they are picked; the file's NAME is provenance and never the path;
// the extension describes the bytes rather than the name; and a failed provider upload still
// keeps the input, because a full disk or a refused key must not erase what a person picked.

const sha256Of = (buffer) => createHash('sha256').update(buffer).digest('hex')
const uploadsDir = join(dataRoot, 'krea', 'uploads')
/** A response's kept-copy block, or an empty one — so a missing field FAILS a check instead of throwing. */
const keptOf = (res) => json(res).kept || {}
/** The uploads directory as it stands, or an empty list when the copy was never written. */
const uploadsNow = () => { try { return readdirSync(uploadsDir) } catch { return [] } }
/** A kept file's bytes, or null when it is not where the route said it was. */
const keptBytes = (name) => { try { return readFileSync(join(uploadsDir, name)) } catch { return null } }
const keptName = sha256Of(FILE_BYTES) + '.png'
// The Krea shape back on the wire: the RunningHub cases above left their own answer installed.
respond = () => ({ status: 200, body: { id: 'asset-1', image_url: 'https://assets.krea.ai/asset-1.png' } })
check(
  'the picked file is kept under the provider\'s own root, byte for byte',
  (() => {
    try {
      const kept = readFileSync(join(uploadsDir, keptName))
      return Buffer.compare(kept, FILE_BYTES) === 0
    } catch {
      return false
    }
  })(),
  (() => { try { return uploadsNow().join(',') } catch { return 'no uploads directory' } })(),
)
check(
  'and the answer carries the hash beside the provider\'s handle',
  !!json(uploaded).kept &&
    keptOf(uploaded).sha256 === sha256Of(FILE_BYTES) &&
    keptOf(uploaded).file === join(dataRoot, 'krea', 'uploads', keptName) &&
    keptOf(uploaded).existed === false,
  JSON.stringify(keptOf(uploaded)),
)

calls.length = 0
const again = await callBytes(handler, ASSET_PATH, FILE_BYTES, { 'content-type': 'image/png', 'x-file-name': 'a%20different%20name.png' })
check(
  'the same bytes picked twice are written ONCE, and the second answer says so',
  again.statusCode === 200 &&
    keptOf(again).sha256 === sha256Of(FILE_BYTES) &&
    keptOf(again).existed === true &&
    uploadsNow().length === 1,
  JSON.stringify({ kept: json(again).kept, files: uploadsNow() }),
)

const HOSTILE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x99])
const hostile = await callBytes(handler, ASSET_PATH, HOSTILE, { 'content-type': 'image/png', 'x-file-name': '../../../../etc/passwd.png' })
check(
  "a hostile file name is kept for provenance and never becomes the path",
  hostile.statusCode === 200 &&
    keptOf(hostile).sha256 === sha256Of(HOSTILE) &&
    uploadsNow().includes(sha256Of(HOSTILE) + '.png') &&
    keptOf(hostile).name === '../../../../etc/passwd.png',
  JSON.stringify({ kept: json(hostile).kept, files: uploadsNow() }),
)

const byType = await callBytes(handler, ASSET_PATH, Buffer.from([1, 2, 3, 4]), { 'content-type': 'image/jpeg', 'x-file-name': 'photo-without-extension' })
check(
  'the extension describes the bytes, not what the file was named',
  byType.statusCode === 200 && String(keptOf(byType).file || '').endsWith('.jpg'),
  JSON.stringify(keptOf(byType)),
)

respond = () => ({ status: 500, body: { message: 'boom' } })
const REFUSED = Buffer.from([9, 9, 9, 9])
const refusedKeep = await callBytes(handler, ASSET_PATH, REFUSED, { 'content-type': 'image/png', 'x-file-name': 'kept-anyway.png' })
check(
  'a failed provider upload still keeps the input and says where it is',
  refusedKeep.statusCode === 502 &&
    keptOf(refusedKeep).sha256 === sha256Of(REFUSED) &&
    (keptBytes(sha256Of(REFUSED) + '.png') || Buffer.alloc(0)).length === REFUSED.length,
  JSON.stringify({ status: refusedKeep.statusCode, kept: json(refusedKeep).kept }),
)
respond = () => ({ status: 200, body: { id: 'asset-1', image_url: 'https://assets.krea.ai/asset-1.png' } })

// ── a resumed session's inputs go back through the provider (epic 64 S6) ─────
//
// A record's image door holds a PROVIDER HANDLE, and by the time a session is resumed that
// handle may be dead (RunningHub's file is not hosted; Krea's asset link has its own lifetime).
// The kept copy is what makes it fresh. Three rules: the file is found by the HASH and never
// by a path a caller sends; a hash nothing kept is `no-copy` rather than a provider failure;
// and what travels is the kept bytes, not whatever the body said.

/** A JSON POST through the shipped handler. */
async function callJson(path, body) {
  const req = Readable.from([Buffer.from(JSON.stringify(body))])
  req.method = 'POST'
  req.url = path
  req.headers = { 'content-type': 'application/json' }
  const res = fakeRes()
  await handler(req, res)
  return res
}

{
  const KEPT = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x11, 0x22, 0x33, 0x44])
  const keptName = sha256Of(KEPT) + '.png'
  writeFileSync(join(uploadsDir, keptName), KEPT)

  respond = () => ({ status: 200, body: { id: 'asset-2', image_url: 'https://assets.krea.ai/resumed.png' } })
  calls.length = 0
  const restored = await callJson(PROVIDERS_PATH + '/krea/restore', { door: 'image_url', sha256: sha256Of(KEPT) })
  check(
    'a resumed image door is re-uploaded from the copy the library kept, and answered a fresh handle',
    restored.statusCode === 200 && json(restored).url === 'https://assets.krea.ai/resumed.png' && json(restored).door === 'image_url' && json(restored).sha256 === sha256Of(KEPT),
    JSON.stringify({ status: restored.statusCode, body: json(restored) }),
  )
  check(
    'and what travels to the provider is the KEPT bytes, not something the body named',
    calls.length === 1 && calls[0].url === BASE + '/assets' && calls[0].method === 'POST',
    JSON.stringify(calls.map((row) => ({ url: row.url, method: row.method }))),
  )

  const noCopy = await callJson(PROVIDERS_PATH + '/krea/restore', { door: 'image_url', sha256: 'b'.repeat(64) })
  check(
    'a hash nothing kept is its OWN answer, not a provider failure',
    noCopy.statusCode === 404 && json(noCopy).error === 'no-copy',
    JSON.stringify({ status: noCopy.statusCode, body: json(noCopy) }),
  )
  const badHash = await callJson(PROVIDERS_PATH + '/krea/restore', { door: 'image_url', sha256: '../../etc/passwd' })
  check(
    'and a sha256 that is not one is refused before any file is looked for',
    badHash.statusCode === 400 && json(badHash).error === 'bad-hash',
    JSON.stringify({ status: badHash.statusCode, body: json(badHash) }),
  )
  calls.length = 0
  const hostile = await callJson(PROVIDERS_PATH + '/krea/restore', { door: 'image_url', sha256: sha256Of(KEPT), path: '/etc/passwd' })
  // WHAT TRAVELLED, not what came back: the answer echoes the hash it was given, so only the
  // bytes in the request prove which file was read.
  const hostileForm = calls.length > 0 && calls[calls.length - 1].body && typeof calls[calls.length - 1].body.get === 'function' ? calls[calls.length - 1].body : null
  const hostileFile = hostileForm ? hostileForm.get('file') : null
  const hostileBytes = hostileFile && typeof hostileFile.arrayBuffer === 'function' ? Buffer.from(await hostileFile.arrayBuffer()) : null
  check(
    'a PATH in the body is ignored: what travels is the bytes the HASH names',
    hostile.statusCode === 200 && hostileBytes !== null && Buffer.compare(hostileBytes, KEPT) === 0,
    JSON.stringify({ status: hostile.statusCode, got: hostileBytes ? hostileBytes.length : null, wanted: KEPT.length, same: hostileBytes ? Buffer.compare(hostileBytes, KEPT) === 0 : null }),
  )
}

// The route-written run, not only the provider-written one: this is the check that the
// handler passes the PROVIDER's directory rather than the plugin root, which is where a
// first cut of the route put every record.
check(
  "a run started through the route lands in that provider's own runs directory",
  (() => {
    try {
      const routed = JSON.parse(readFileSync(join(dataRoot, 'krea', 'runs', 'job-7.json'), 'utf8'))
      return routed.jobId === 'job-7' && routed.gate.confirmed === true
    } catch {
      return false
    }
  })(),
  join(dataRoot, 'krea', 'runs', 'job-7.json'),
)

finish()
