/**
 * The Krea run: the body a model posts, the job it starts, and the record of the gate.
 *
 * THE GATE IS A RULE, NOT A DIALOG (§12 rule 1; `~/.kun/brand-os/01-task-surface-harness-gate.md`):
 * nothing is submitted without an explicit human action on a payload the human has seen. So
 * this module is built in two halves that match those two facts — `buildRunPayload` is the
 * pure half the gate reads (no key, no network, nothing spent), and `postRun` is the half
 * that spends, which the host route only reaches when the caller says a person confirmed.
 *
 * NOTHING HERE HOLDS A KEY. The key arrives as an argument, is put in one header, and is
 * never written to the run record: the record holds what was asked for and what came back,
 * which is what "what did we ship and why" needs (rule 4) and nothing a person did not
 * already see.
 *
 * A DOOR KEY IS THE API'S OWN FIELD NAME. That is why there is no mapping table: the Krea
 * doors are named `prompt`, `aspect_ratio`, `resolution`, `creativity`, `intensity`,
 * `complexity`, `movement`, `image_url`, `strength`, `seed`, `styles`,
 * `image_style_references` and `moodboards` because Krea's schema names them that, so the
 * surface's own keys ARE the request body's keys — and a list door's row fields are Krea's
 * field names too (`id`, `strength`, `url`).
 *
 * @module @muen/dsh-generate/lib/krea-run
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

/** One run: long enough for a cold API, short enough to fail in front of a person. */
const TIMEOUT_MS = 30000

/** Krea's own terminal and in-flight states, folded into the three a strip draws. */
const STATE_BY_STATUS = {
  backlogged: 'queued',
  queued: 'queued',
  scheduled: 'queued',
  processing: 'running',
  sampling: 'running',
  'intermediate-complete': 'running',
  completed: 'done',
  failed: 'failed',
  cancelled: 'failed',
}

/**
 * Nothing was entered: `undefined`, `null`, an empty string, or a string of spaces.
 *
 * An ARRAY IS NOT EMPTY HERE, and that is deliberate: `String([{…}])` is
 * `"[object Object]"` and `String([])` is `""`, so a list door's own contents are judged by
 * its rows (below) rather than by stringifying the array.
 */
function emptyish(value) {
  return value === undefined || value === null || (typeof value !== 'object' && String(value).trim() === '')
}

/**
 * One value, as Krea takes it, or the reason it cannot be sent.
 *
 * The rules are the door's and the API's: a number that is not a number, one below its
 * `minimum` or above its `maximum`, a select outside its `enum`, an image that is not a URL
 * or a data URI. `key` is what the gate names the failure by, so a row's own field is named
 * with its place in the list (`styles[0].strength`).
 *
 * @returns {{ sent: boolean, value?: unknown }}
 */
function readValue(key, door, raw, missing, refused) {
  if (emptyish(raw)) {
    if (door.required === true) missing.push(key)
    return { sent: false }
  }
  if (door.type === 'number') {
    const value = Number(String(raw).trim())
    if (!Number.isFinite(value)) {
      refused.push({ key, reason: 'not-a-number' })
      return { sent: false }
    }
    if (typeof door.min === 'number' && value < door.min) {
      refused.push({ key, reason: 'below-min' })
      return { sent: false }
    }
    if (typeof door.max === 'number' && value > door.max) {
      refused.push({ key, reason: 'above-max' })
      return { sent: false }
    }
    return { sent: true, value }
  }
  if (door.type === 'select') {
    const value = String(raw).trim()
    if (Array.isArray(door.options) && !door.options.includes(value)) {
      refused.push({ key, reason: 'not-an-option' })
      return { sent: false }
    }
    return { sent: true, value }
  }
  if (door.type === 'image') {
    const value = String(raw).trim()
    // Krea takes an external URL, an uploaded asset URL or a base64 data URI. A browser
    // file path (`C:\fakepath\…`) is none of the three — it is what the control produces
    // before the file has been uploaded, so it is refused by name rather than posted and
    // billed as a 400.
    if (!/^(https?:\/\/|data:image\/)/i.test(value)) {
      refused.push({ key, reason: 'not-a-url' })
      return { sent: false }
    }
    return { sent: true, value }
  }
  return { sent: true, value: String(raw) }
}

/**
 * What this model would post, and what a person still has to fill in.
 *
 * Pure, and the gate's whole input: the host builds the body once and both the disclosure
 * and the run use that one result, so what a person reads is what is sent.
 *
 * The rules are the schema's. A required door with nothing in it is `missing` (not an
 * error: the person simply has not typed it yet). A value the API would refuse — a select
 * outside its `enum`, a number that is not a number, an image that is not a URL — is
 * `refused`, by name, before anything is sent.
 *
 * A LIST DOOR'S ROWS ARE READ THE SAME WAY, one level down. A row with a required field
 * still empty is `missing` under that row's own name (`styles[0].id`), a row nobody filled
 * in is not sent at all, and a list longer than the API's own `maxItems` is `refused` whole
 * — the surface stops adding rows there, so this is the second gate on the same fact rather
 * than the only one.
 *
 * @returns {{ body: object, missing: string[], refused: Array<{ key: string, reason: string }> }}
 */
export function buildRunPayload(model, values) {
  const doors = (model && model.doors) || {}
  const given = values && typeof values === 'object' ? values : {}
  const body = {}
  const missing = []
  const refused = []

  for (const [key, door] of Object.entries(doors)) {
    const raw = given[key]
    if (emptyish(raw)) {
      if (door.required === true) missing.push(key)
      // An omitted optional door is the API's own default, which is why it is not sent:
      // the request says what the person chose and nothing else.
      continue
    }

    // A LIST DOOR IS AN ARRAY OF ROWS, and each row is read by the same rules one level
    // down — which is why a row's failure is named by its place (`styles[0].id`) rather
    // than by the list. A row nobody filled in is not a row: the add control creates an
    // empty one, and sending that would be a body Krea refuses.
    if (door.type === 'list') {
      const rows = Array.isArray(raw) ? raw : []
      const fields = door.fields && typeof door.fields === 'object' ? door.fields : {}
      const filled = rows.filter(
        (row) => row && typeof row === 'object' && !Array.isArray(row) && Object.values(row).some((value) => !emptyish(value)),
      )
      if (filled.length === 0) continue
      // Krea's own `maxItems`: an eleventh style reference is a 400, and the surface stops
      // adding rows where this stops sending them.
      if (typeof door.max === 'number' && filled.length > door.max) {
        refused.push({ key, reason: 'too-many' })
        continue
      }
      const items = []
      for (const [index, row] of filled.entries()) {
        const item = {}
        for (const [fieldKey, field] of Object.entries(fields)) {
          const read = readValue(key + '[' + index + '].' + fieldKey, field, row[fieldKey], missing, refused)
          if (read.sent) item[fieldKey] = read.value
        }
        items.push(item)
      }
      body[key] = items
      continue
    }

    const read = readValue(key, door, raw, missing, refused)
    if (read.sent) body[key] = read.value
  }

  return { body, missing, refused }
}

/**
 * Submit the payload. The only function here that spends anything, and the only one that
 * takes a key.
 *
 * @returns {{ jobId: string, status: string } | { error: string, detail?: string }}
 */
export async function postRun({ base, endpoint, body, key, timeoutMs = TIMEOUT_MS, fetchImpl = fetch } = {}) {
  let response
  try {
    response = await fetchImpl(base + endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
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

  if (!response.ok) {
    // Krea's own statuses, judged the way the key check judges them: 401 is a bad key,
    // 402 is an empty API balance (the key is real), 429 is too many jobs at once, and
    // 400 is a body the API refused — which is the case worth reading, because it means
    // this plugin built something Krea does not accept.
    if (response.status === 401) return { error: 'invalid-key' }
    if (response.status === 402) return { error: 'no-api-balance' }
    if (response.status === 429) return { error: 'too-many-jobs' }
    const message = payload && typeof payload.error === 'string' ? payload.error : null
    return { error: response.status === 400 ? 'bad-request' : 'http-' + response.status, detail: message }
  }
  const jobId = payload && typeof payload.job_id === 'string' ? payload.job_id : null
  if (jobId === null) return { error: 'unexpected-response' }
  return { jobId, status: typeof payload.status === 'string' ? payload.status : 'queued' }
}

/**
 * Read one job.
 *
 * @returns {{ state: 'queued' | 'running' | 'done' | 'failed', status: string, urls: string[], error: object | null }
 *   | { error: string, detail?: string }}
 */
export async function getRun({ base, jobId, key, timeoutMs = TIMEOUT_MS, fetchImpl = fetch } = {}) {
  let response
  try {
    response = await fetchImpl(base + '/jobs/' + encodeURIComponent(jobId), {
      method: 'GET',
      headers: { Accept: 'application/json', Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(timeoutMs),
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

  if (!response.ok) {
    if (response.status === 401) return { error: 'invalid-key' }
    if (response.status === 404) return { error: 'job-not-found' }
    return { error: 'http-' + response.status }
  }
  if (!payload || typeof payload.status !== 'string') return { error: 'unexpected-response' }

  const status = payload.status
  const state = STATE_BY_STATUS[status] || 'running'
  const urls = payload.result && Array.isArray(payload.result.urls) ? payload.result.urls.filter((url) => typeof url === 'string') : []
  // Krea's own words, kept verbatim: a failure the user can read is worth more than a
  // sentence this plugin invented about it.
  const failure = payload.error && typeof payload.error === 'object' ? payload.error : null
  return { state: state === 'done' && urls.length === 0 ? 'failed' : state, status, urls, error: failure }
}

/** Where one run's record lives: beside the adapters, one file per job. */
export function runPath(root, jobId) {
  return join(root, 'runs', String(jobId) + '.json')
}

/**
 * Write the record of a run.
 *
 * ON SUBMIT it is the gate's own answer: what was asked for, when, and that a person
 * confirmed it. ON SETTLE the same file gains the outcome, so one file answers "what did
 * we ship and why" (rule 4) without a second log to reconcile. No key is ever in it.
 */
export async function writeRunRecord(root, record, { writeText = writeFile, makeDir = mkdir } = {}) {
  await makeDir(join(root, 'runs'), { recursive: true })
  await writeText(runPath(root, record.jobId), JSON.stringify(record, null, 2) + '\n', 'utf8')
  return record
}

/** The record of one run, or `null`. A missing file is a job this install did not start. */
export async function readRunRecord(root, jobId, { readText = readFile } = {}) {
  try {
    const parsed = JSON.parse(await readText(runPath(root, jobId), 'utf8'))
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}
