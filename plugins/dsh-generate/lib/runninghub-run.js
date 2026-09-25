/**
 * The RunningHub run: the node list an AI App posts, the task it starts, and how the task
 * is read back.
 *
 * THE GATE IS A RULE, NOT A DIALOG (§12 rule 1): nothing is submitted without an explicit
 * human action on a payload the human has seen. So this module is two halves —
 * `buildRhPayload` is the pure half the gate reads (no key, no network, nothing spent), and
 * `postRhRun` is the half that spends, which the host route only reaches when the caller
 * says a person confirmed.
 *
 * THE API, read from RunningHub's own OpenAPI on 2026-09-23:
 *
 *   POST /task/openapi/ai-app/run   { apiKey, webappId, nodeInfoList, instanceType? }
 *                                   → { code: 0, data: { taskId, taskStatus, … } }
 *   POST /task/openapi/status       { apiKey, taskId }
 *                                   → { code: 0, data: 'QUEUED' | 'RUNNING' | 'FAILED' | 'SUCCESS' }
 *   POST /task/openapi/outputs      { apiKey, taskId }
 *                                   → { code: 0, data: [{ fileUrl, fileType, taskCostTime, consumeCoins, … }] }
 *   POST /task/openapi/upload       multipart: apiKey, file, fileType=input
 *                                   → { code: 0, data: { fileName, fileType } }
 *
 * THREE THINGS THAT SHAPE THE CODE BELOW, all from those pages:
 *
 *   1. **A door is `(nodeId, fieldName, fieldValue)` and nothing else.** The adapter
 *      already carries the pair that identifies a door, so the request is the surface's own
 *      values under the API's own names — no mapping table, and no node id ever drawn.
 *   2. **An image door's value is an uploaded `fileName`, not a URL** (their upload guide:
 *      the returned `fileName` "is the unique path for file loading … must be accurately
 *      passed to the corresponding node"). A public direct link also works for a loading
 *      node, which is why a pasted URL is accepted; a browser file path is not, because it
 *      names a file on the person's disk and no node can load it.
 *   3. **A failure has its own words.** `outputs` answers `code: 805` with
 *      `data.failedReason`, carrying the node name and the exception message; that message
 *      is what the strip shows, verbatim, because a sentence this plugin invented about
 *      somebody else's workflow helps nobody.
 *
 * NOTHING HERE HOLDS A KEY. It arrives as an argument, goes into the request body the API
 * documents, and is written to no record: the record holds what was asked for and what came
 * back — which is what rule 4 needs and nothing a person did not already see.
 *
 * @module @muen/dsh-generate/lib/runninghub-run
 */
import { DOOR_TYPES } from './doors.js'

/** One request: long enough for a cold API, short enough to fail in front of a person. */
const TIMEOUT_MS = 30000

/** The paths, each one the API's own. */
export const RH_RUN_PATH = '/task/openapi/ai-app/run'
export const RH_STATUS_PATH = '/task/openapi/status'
export const RH_OUTPUTS_PATH = '/task/openapi/outputs'
export const RH_UPLOAD_PATH = '/task/openapi/upload'
/**
 * Cancel a task (read from RunningHub's own OpenAPI, "Cancel ComfyUI Task", 2026-09-23):
 * `POST { apiKey, taskId }` → `code: 0` on acceptance, `code: 807
 * APIKEY_TASK_NOT_FOUND` when the task is already gone. It is documented as
 * fire-and-ask — the API accepts the request, it does not promise the task stopped —
 * which is why the surface keeps polling until the status settles.
 */
export const RH_CANCEL_PATH = '/task/openapi/cancel'
/**
 * The account's queue (same docs day, "查询指定 APIKEY 下队列状态"): a GET with the
 * key as a Bearer token answering `apiKeyType`, `concurrentLimit`, `runningCount`,
 * `queuedCount`, `totalCurrentTasks` — the counts arrive as strings. Their spec marks
 * this endpoint `developing` and lists the `.cn` server, so a caller must treat any
 * failure as "no answer" rather than as an error to show.
 */
export const RH_QUEUE_PATH = '/openapi/v2/queue/status'

/**
 * RunningHub's own status words, folded into the states a strip draws. `CANCEL`ed is
 * terminal like the rest — and it is read BEFORE the outputs call, because a cancelled
 * task has no outputs and asking would turn the cancel into a 805 failure.
 */
const STATE_BY_STATUS = {
  QUEUED: 'queued',
  RUNNING: 'running',
  SUCCESS: 'done',
  FAILED: 'failed',
  CANCEL: 'cancelled',
  CANCELED: 'cancelled',
  CANCELLED: 'cancelled',
}

const str = (value) => (typeof value === 'string' && value.trim() !== '' ? value.trim() : null)
const emptyish = (value) => value === undefined || value === null || (typeof value === 'string' && value.trim() === '')

/** A file on the person's own disk, or a browser-only URL: no workflow node can load it. */
const BROWSER_FILE = /^(?:[a-z]:[\\/]|\\\\|file:|blob:|data:)/i

/**
 * One door's value, read against what the app declares.
 *
 * The value the app's own field accepts is a string in every example RunningHub publishes,
 * including numeric fields, so every door is sent as one: `fieldValue` is the API's field
 * name for "what to put in this input", and a workflow that wants a number parses it.
 *
 * @returns {{ sent: true, value: string } | { sent: false }}
 */
function readDoorValue(key, door, raw, missing, refused) {
  if (emptyish(raw)) {
    // The API declares no requiredness, so a door is only required when an adapter says so
    // — the surface must not invent a requirement the app never stated.
    if (door.required === true) missing.push(key)
    return { sent: false }
  }
  if (door.type === 'select') {
    const options = Array.isArray(door.options) ? door.options : []
    if (options.length > 0 && !options.includes(raw)) {
      refused.push({ key, reason: 'not-an-option' })
      return { sent: false }
    }
    return { sent: true, value: String(raw) }
  }
  if (door.type === 'number') {
    const value = Number(raw)
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
    return { sent: true, value: String(value) }
  }
  if (door.type === 'image') {
    const value = String(raw).trim()
    if (BROWSER_FILE.test(value)) {
      // The surface uploads a picked file and the door then holds the `fileName` RunningHub
      // answered; a path still shaped like a local file means that upload never happened.
      refused.push({ key, reason: 'not-uploaded' })
      return { sent: false }
    }
    return { sent: true, value }
  }
  if (door.type === 'list') {
    // An adapter's doors are an app's exposed inputs and come from `DOOR_TYPES`, so this is
    // the second gate on a fact the adapter validator already refuses.
    refused.push({ key, reason: 'unsupported-type' })
    return { sent: false }
  }
  return { sent: true, value: String(raw) }
}

/**
 * What this workflow would post, and what a person still has to fill in.
 *
 * Pure, and the gate's whole input: the host builds the node list once and both the
 * disclosure and the run use that one result, so what a person reads is what is sent.
 *
 * The `instanceType` — RunningHub's 24/48/84GB machines — arrives already validated by the
 * route, which is the only place a run option is read; it is absent from the body when the
 * provider's own default is what the person left it on, because the API's own default is
 * the same word.
 *
 * @returns {{ endpoint: string, body: object, nodeInfoList: object[], missing: string[], refused: Array<{ key: string, reason: string }> }}
 */
export function buildRhPayload(adapter, values, options) {
  const doors = (adapter && adapter.doors) || {}
  const given = values && typeof values === 'object' ? values : {}
  const order = Array.isArray(adapter && adapter.ui && adapter.ui.order) ? adapter.ui.order : Object.keys(doors)
  const nodeInfoList = []
  const missing = []
  const refused = []

  for (const key of order) {
    const door = doors[key]
    if (!door || typeof door !== 'object' || !DOOR_TYPES.includes(door.type)) continue
    const read = readDoorValue(key, door, given[key], missing, refused)
    if (!read.sent) continue
    nodeInfoList.push({ nodeId: door.nodeId, fieldName: door.fieldName, fieldValue: read.value })
  }

  const body = { webappId: adapter && adapter.source ? adapter.source.appId : null, nodeInfoList }
  // The API's own default is `default`, so leaving it out says the same thing as naming it.
  if (options && typeof options.instanceType === 'string' && options.instanceType !== 'default') {
    body.instanceType = options.instanceType
  }
  return { endpoint: RH_RUN_PATH, body, nodeInfoList, missing, refused }
}

/** One JSON POST, judged the same way for every call here. */
async function postJson(url, body, key, { timeoutMs = TIMEOUT_MS, fetchImpl = fetch } = {}) {
  let response
  try {
    response = await fetchImpl(url, {
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
    if (response.status === 401) return { error: 'invalid-key' }
    if (response.status === 429) return { error: 'too-many-jobs' }
    return { error: response.status === 400 ? 'bad-request' : 'http-' + response.status }
  }
  if (payload === null || typeof payload.code !== 'number') return { error: 'unexpected-response' }
  return { payload }
}

/**
 * Submit the node list. The only function here that spends anything, and the only one that
 * takes a key.
 *
 * The key is in the BODY, not in a header alone: the API documents `apiKey` as a required
 * body field, and the Authorization header rides along because their own examples show both.
 *
 * @returns {{ jobId: string, status: string } | { error: string, detail?: string }}
 */
export async function postRhRun({ base, body, key, timeoutMs = TIMEOUT_MS, fetchImpl = fetch } = {}) {
  const posted = await postJson(base + RH_RUN_PATH, { apiKey: key, ...body }, key, { timeoutMs, fetchImpl })
  if (posted.error) return posted
  const payload = posted.payload
  if (payload.code !== 0) {
    // The API's own refusal, in its own words: an expired key, an app that is not yours, a
    // node list it will not accept. `msg` is the only sentence that says which.
    return { error: 'api-refused', detail: str(payload.msg) || str(payload.errorMessages) || 'code ' + payload.code }
  }
  const taskId = payload.data && (str(payload.data.taskId) || str(payload.data.taskID))
  if (taskId === null) return { error: 'unexpected-response' }
  return { jobId: taskId, status: str(payload.data.taskStatus) || 'QUEUED' }
}

/**
 * ASK RunningHub to cancel a task. The docs are explicit that this is fire-and-ask:
 * `code: 0` means the request was accepted, not that the GPU stopped — so the caller
 * keeps polling and lets the status endpoint be the one that settles the run. `807`
 * means the task is already gone (finished, or cancelled by an earlier ask), which is
 * an answer rather than a failure and maps to `job-not-found` for the route.
 *
 * @returns {{ ok: true } | { error: string, detail?: string }}
 */
export async function cancelRhRun({ base, jobId, key, timeoutMs = TIMEOUT_MS, fetchImpl = fetch } = {}) {
  const posted = await postJson(base + RH_CANCEL_PATH, { apiKey: key, taskId: jobId }, key, { timeoutMs, fetchImpl })
  if (posted.error) return posted
  const payload = posted.payload
  if (payload.code === 0) return { ok: true }
  const message = str(payload.msg) || 'code ' + payload.code
  if (payload.code === 807) return { error: 'job-not-found', detail: message }
  return { error: 'api-refused', detail: message }
}

/**
 * READ the account's queue — how many tasks run, how many wait, the key's concurrency
 * ceiling. A GET with the key as Bearer (their spec, not the task family's body-key),
 * and every failure answers `error` rather than a number: this endpoint is marked
 * `developing` in their own docs, and a band that shows nothing is the honest answer
 * to an endpoint that does not answer.
 *
 * @returns {{ running: number, queued: number, limit: number, total: number }
 *   | { error: string, detail?: string }}
 */
export async function readRhQueue({ base, key, timeoutMs = TIMEOUT_MS, fetchImpl = fetch } = {}) {
  let response
  try {
    response = await fetchImpl(base + RH_QUEUE_PATH, {
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
    return { error: 'http-' + response.status }
  }
  if (payload === null || typeof payload.code !== 'number') return { error: 'unexpected-response' }
  if (payload.code !== 0) return { error: 'api-refused', detail: str(payload.msg) || 'code ' + payload.code }
  const data = (payload.data && typeof payload.data === 'object' ? payload.data : {}) || {}
  const count = (value) => {
    const num = Number(value)
    return Number.isFinite(num) ? num : 0
  }
  return {
    running: count(data.runningCount),
    queued: count(data.queuedCount),
    limit: count(data.concurrentLimit),
    total: count(data.totalCurrentTasks),
  }
}

/**
 * Read one task: its state first, its outputs when they exist.
 *
 * The status call is the cheap one and answers the four words; the outputs call is asked
 * only when there is something to read, because on a failure it is where the reason lives
 * (`code: 805`, `data.failedReason.exception_message`).
 *
 * @returns {{ state: 'queued' | 'running' | 'done' | 'failed' | 'cancelled', status: string, urls: string[], error: object | null }
 *   | { error: string, detail?: string }}
 */
export async function readRhRun({ base, jobId, key, timeoutMs = TIMEOUT_MS, fetchImpl = fetch } = {}) {
  const read = await postJson(base + RH_STATUS_PATH, { apiKey: key, taskId: jobId }, key, { timeoutMs, fetchImpl })
  if (read.error) {
    // A task this install did not start is not a network failure: the API answers about
    // keys and tasks with its own codes, and 805 on the status call is "no such task".
    return read
  }
  const payload = read.payload
  if (payload.code !== 0) {
    const message = str(payload.msg) || 'code ' + payload.code
    if (payload.code === 805) return { error: 'job-not-found', detail: message }
    return { error: 'api-refused', detail: message }
  }
  const status = str(payload.data) || 'RUNNING'
  const state = STATE_BY_STATUS[status] || 'running'
  if (state === 'queued' || state === 'running') return { state, status, urls: [], error: null }
  // CANCELLED IS TERMINAL AND HAS NO OUTPUTS: asking the outputs call would answer 805
  // and turn a cancel into a failure. Done and failed fall through to it below.
  if (state === 'cancelled') return { state: 'cancelled', status, urls: [], error: null }

  // Terminal: the outputs call carries both the files and, on a failure, the reason.
  const outputs = await postJson(base + RH_OUTPUTS_PATH, { apiKey: key, taskId: jobId }, key, { timeoutMs, fetchImpl })
  if (outputs.error) return outputs
  const result = outputs.payload
  const rows = result.code === 0 && Array.isArray(result.data) ? result.data : []
  const urls = rows.map((row) => (row && str(row.fileUrl)) || null).filter((url) => url !== null)
  if (result.code === 0) {
    // `fileUrl` is RunningHub's own link to the result. A success with nothing to show is a
    // failure the person needs to see rather than a strip that never settles.
    return { state: urls.length > 0 ? 'done' : 'failed', status, urls, error: urls.length > 0 ? null : { code: 'no-output', message: str(result.msg) } }
  }
  const reason = result.data && typeof result.data === 'object' ? result.data.failedReason : null
  return {
    state: 'failed',
    status,
    urls,
    // THE WORKFLOW'S OWN WORDS: the node that failed and the exception it raised.
    error: {
      code: str(result.msg) || 'api-refused',
      message: reason && (str(reason.exception_message) || str(reason.node_name)) ? str(reason.exception_message) || str(reason.node_name) : str(result.msg),
      node: reason ? str(reason.node_name) : null,
    },
  }
}
