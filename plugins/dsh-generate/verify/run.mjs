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
import { mkdtempSync, readFileSync } from 'node:fs'
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
const { krea, runOptions } = await import(pathToFileURL(join(ROOT, 'lib/providers.js')).href)
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
  aspect_ratio: '1:1',
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
    const { body, missing, refused } = buildRunPayload(turbo, { aspect_ratio: '1:1', resolution: '1K' })
    return missing.join(',') === 'prompt' && refused.length === 0 && body.prompt === undefined
  })(),
  JSON.stringify(buildRunPayload(turbo, {})),
)
check(
  'an untouched optional door is not sent: the API default is the API\'s',
  (() => {
    const { body } = buildRunPayload(turbo, { prompt: 'a house', aspect_ratio: '1:1', resolution: '1K' })
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
      aspect_ratio: '1:1',
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
  JSON.stringify(buildRunPayload(turbo, { prompt: 'x', aspect_ratio: '1:1', resolution: '1K', styles: [{ id: 'lora-1', strength: 1.5 }] }).body),
)
check(
  'a row with a required field still empty is missing under its own place in the list',
  (() => {
    const { body, missing } = buildRunPayload(turbo, { prompt: 'x', aspect_ratio: '1:1', resolution: '1K', styles: [{ strength: 1 }], moodboards: [{ id: 'not-a-uuid' }] })
    return missing.join(',') === 'styles[0].id' && body.styles !== undefined && body.styles[0].id === undefined
  })(),
  JSON.stringify(buildRunPayload(turbo, { prompt: 'x', aspect_ratio: '1:1', resolution: '1K', styles: [{ strength: 1 }] })),
)
check(
  'an empty row the add control created is not a row: nothing is sent for it',
  (() => {
    const { body, missing, refused } = buildRunPayload(turbo, { prompt: 'x', aspect_ratio: '1:1', resolution: '1K', styles: [{}, { id: 'lora-1', strength: 1 }], moodboards: [{}] })
    return missing.length === 0 && refused.length === 0 && body.styles.length === 1 && body.moodboards === undefined
  })(),
  JSON.stringify(buildRunPayload(turbo, { prompt: 'x', aspect_ratio: '1:1', resolution: '1K', styles: [{}, { id: 'lora-1', strength: 1 }] }).body),
)
check(
  "a list past the API's own maxItems is refused whole, before anything is sent",
  (() => {
    const rows = Array.from({ length: 11 }, (_, index) => ({ url: 'https://example.com/' + index + '.png' }))
    const { body, refused } = buildRunPayload(turbo, { prompt: 'x', aspect_ratio: '1:1', resolution: '1K', image_style_references: rows })
    const ten = buildRunPayload(turbo, { prompt: 'x', aspect_ratio: '1:1', resolution: '1K', image_style_references: rows.slice(0, 10) })
    return (
      refused.length === 1 &&
      refused[0].key === 'image_style_references' &&
      refused[0].reason === 'too-many' &&
      body.image_style_references === undefined &&
      ten.refused.length === 0 &&
      ten.body.image_style_references.length === 10
    )
  })(),
  JSON.stringify(buildRunPayload(turbo, { prompt: 'x', aspect_ratio: '1:1', resolution: '1K', image_style_references: Array.from({ length: 11 }, () => ({ url: 'https://e/x.png' })) }).refused),
)
check(
  "a row's own bounds are the API's: a style strength past 2 is refused by its place",
  (() => {
    const { refused, body } = buildRunPayload(turbo, { prompt: 'x', aspect_ratio: '1:1', resolution: '1K', styles: [{ id: 'a', strength: 3 }] })
    const row = buildRunPayload(turbo, { prompt: 'x', aspect_ratio: '1:1', resolution: '1K', styles: [{ id: 'a', strength: 2 }] })
    return (
      refused.length === 1 &&
      refused[0].key === 'styles[0].strength' &&
      refused[0].reason === 'above-max' &&
      body.styles[0].strength === undefined &&
      row.refused.length === 0
    )
  })(),
  JSON.stringify(buildRunPayload(turbo, { prompt: 'x', aspect_ratio: '1:1', resolution: '1K', styles: [{ id: 'a', strength: 3 }] }).refused),
)
check(
  'an image inside a row is an image door too: a reference with no URL is missing, one with a URL is sent',
  (() => {
    const without = buildRunPayload(turbo, { prompt: 'x', aspect_ratio: '1:1', resolution: '1K', image_style_references: [{ strength: 0.5 }] })
    const with_ = buildRunPayload(turbo, { prompt: 'x', aspect_ratio: '1:1', resolution: '1K', image_style_references: [{ url: 'https://example.com/a.png' }] })
    return (
      without.missing.join(',') === 'image_style_references[0].url' &&
      with_.missing.length === 0 &&
      with_.body.image_style_references[0].url === 'https://example.com/a.png'
    )
  })(),
  JSON.stringify(buildRunPayload(turbo, { prompt: 'x', aspect_ratio: '1:1', resolution: '1K', image_style_references: [{ strength: 0.5 }] }).missing),
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
      JSON.parse(last.body).aspect_ratio === '1:1'
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
const values = { prompt: 'a cinematic glass cabin', aspect_ratio: '16:9', resolution: '1K' }

const preview = await krea.previewRun({ root: providerRoot, name: 'krea-2-medium-turbo', values })
check(
  'the preview names the model, its endpoint and the exact body',
  preview.model === 'image/krea/krea-2/medium-turbo' &&
    preview.endpoint === '/generate/image/krea/krea-2/medium-turbo' &&
    preview.body.prompt === 'a cinematic glass cabin' &&
    preview.body.aspect_ratio === '16:9',
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
const incomplete = await krea.startRun({ root: providerRoot, name: 'krea-2-medium-turbo', values: { aspect_ratio: '1:1' }, key: SECRET, fetchImpl: fakeFetch })
check(
  'a run with a required door still empty never reaches the network',
  incomplete.error === 'payload-incomplete' && calls.length === 0,
  JSON.stringify({ error: incomplete.error, calls: calls.length }),
)
calls.length = 0
const refused = await krea.startRun({
  root: providerRoot,
  name: 'krea-2-medium-turbo',
  values: { prompt: 'x', aspect_ratio: '1:1', resolution: '1K', aspect_ratio: '7:3', resolution: '1K' },
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
const polled = await krea.readRun({ root: providerRoot, jobId: 'job-42', key: SECRET, fetchImpl: fakeFetch })
const settled = JSON.parse(readFileSync(recordAt, 'utf8'))
check(
  'the poll that finishes a run writes the outcome back to the same file',
  polled.state === 'done' &&
    settled.status === 'completed' &&
    settled.urls[0] === 'https://gen.krea.ai/out.png' &&
    typeof settled.finishedAt === 'string',
  JSON.stringify(settled),
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

// ── a run's own options, read through what the provider declares ─────────────
//
// RunningHub's `instanceType` (default 24GB / plus 48GB / ultra 84GB, from its own OpenAPI)
// is not a door: it is the same three choices for every app and it goes to the request's top
// level. The provider declares it, the route validates a request against that declaration,
// and the preview echoes what it would send so the gate can show it.
{
  const RH_PAYLOAD = PROVIDERS_PATH + '/runninghub/payload'
  const rhPayload = await call(handler, 'POST', { name: 'x', values: {}, options: { instanceType: 'plus' } }, RH_PAYLOAD)
  check(
    "RunningHub's declared modes cannot be sent yet: its run is not built, so the route still answers 501",
    rhPayload.statusCode === 501 && json(rhPayload).error === 'unsupported',
    JSON.stringify({ status: rhPayload.statusCode, body: json(rhPayload) }),
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
const unsupported = await call(handler, 'POST', { name: 'x', values: {}, confirmed: true }, PROVIDERS_PATH + '/runninghub/run')
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
const noUploadProvider = await call(handler, 'POST', {}, PROVIDERS_PATH + '/runninghub/asset')
check(
  'the provider whose run is still owed has no upload path either, and says so',
  noUploadProvider.statusCode === 501 && json(noUploadProvider).error === 'unsupported',
  JSON.stringify({ status: noUploadProvider.statusCode, body: json(noUploadProvider) }),
)

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
