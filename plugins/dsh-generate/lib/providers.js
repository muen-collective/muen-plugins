/**
 * The providers this plugin speaks to.
 *
 * ONE PLUGIN, SEVERAL PROVIDERS (founder, 2026-09-22: *"we need to rethink the
 * generate plugin to be able to use different providers, it should work like the
 * providers settings"*). Settings → Models → Providers is one page listing many
 * providers; Generate works the same way — one plugin, one settings page, one pane,
 * and a provider is an object in this file.
 *
 * WHY NOT A PLUGIN PER PROVIDER, measured the same day:
 *
 *   1. `settings.section` is a LIST slot — one page per registrant — so a plugin per
 *      provider would put a second (and third) Generate page in Settings, and reusing
 *      our id would REPLACE our page instead of adding to it;
 *   2. a third-party client plugin cannot declare its own slot (the client `slots`
 *      service exposes `register`, `registerFactory` and `inject` only), so "one page
 *      that several plugins contribute to" has no seam in this harness today.
 *
 * WHAT A PROVIDER OWNS: its id and label, the family it belongs to (`kind`, which is the
 * tag the settings row carries — Image or Workflows), the credential reference its key
 * lives under, the account page that issues that
 * key, the page a person manages the account at, what using it costs and the page that
 * sells that (`funding.kind` selects the sentence the row draws, `funding.url` the link
 * beside it), the prompt that installs one of its
 * workflows, how to read the account a key opens (which is how a key is validated
 * before it is stored), where its own data lives under the plugin root, and how to
 * list and read its workflows.
 *
 * FOUR PROVIDERS, AND THIS ARRAY IS THE ORDER EVERY SURFACE SHOWS THEM IN (founder,
 * 2026-09-23: *"the order of providers is: RunningHub, Krea, Comfy Cloud"*, then
 * *"actually you can leave magnific as a last row, I will test another time"* — the
 * host lists `PROVIDERS` in registry order and the settings page draws that list as it
 * arrives, so the order here is the order on the page, and `kind` is a tag rather than
 * a sort key):
 *
 *   runninghub   workflow   https://www.runninghub.ai
 *   krea         image      https://api.krea.ai
 *   comfycloud   workflow   https://cloud.comfy.org
 *   magnific     image      https://api.magnific.com
 *
 * RunningHub leads because it is the provider this plugin was built for and the one the
 * workspace already runs; the order was image-first only while the registry was being
 * filled. Magnific sits last because it is the one provider here whose key has not been
 * tested yet: it was registered for a one-month trial on 2026-09-23, removed the same
 * morning when the founder's working pair turned out to be Krea and Comfy Cloud, and
 * restored the same morning as the last row so the trial can happen later. It is a real
 * provider, not a disabled one — its key check runs like any other's.
 *
 * EACH KEY CHECK IS ONE CHEAP AUTHENTICATED READ, researched 2026-09-23 and cited on
 * the provider itself. Two facts shaped the contract:
 *
 *   - only RunningHub can report a balance. Krea, Magnific and Comfy Cloud publish no
 *     account endpoint at all (Krea's own docs: *"There is no public endpoint for
 *     checking your balance programmatically"*), so `account` is whatever the check
 *     could read and the surface must not promise a number it cannot get;
 *   - a provider may answer about the key without accepting it, in which case the key
 *     is real but unverified. Magnific answers `403` with an undocumented body, Comfy
 *     Cloud answers `429` for a key whose subscription is inactive, and Krea answers
 *     `402` when its prepaid API balance is empty. All three are
 *     stored — the founder's rule, 2026-09-23: *"store it and mark it unverified"* —
 *     and the row says which of them happened rather than calling a real key bad.
 *
 * WHAT A CHECK MAY ANSWER, one shape for every provider:
 *
 *   { account }                 the provider answered about this key; store it
 *   { unverified: true, note }  the key could not be checked; store it, say so
 *   { error: 'invalid-key' }    the provider answered and said no; store nothing
 *   { error: 'unreachable' | 'timeout' | 'unexpected-response' | 'http-<n>' }
 *                               no answer, or one this code cannot read; store nothing
 *
 * @module @muen/dsh-generate/lib/providers
 */
import { listAdapters, readAdapter } from './adapter.js'
import { modelEntry, modelSurface, readKreaModels } from './krea-models.js'
import { buildRunPayload, getRun, postRun, readRunRecord, writeRunRecord } from './krea-run.js'
import { dataPaths } from './paths.js'

/** One key check: long enough for a cold API, short enough to fail at the field. */
const TIMEOUT_MS = 15000

function str(value) {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null
}

function num(value) {
  if (value === undefined || value === null || value === '') return null
  const parsed = typeof value === 'number' ? value : Number(String(value).trim())
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * Every space a paste can carry, the Unicode ones included: a browser clipboard brings
 * back a non-breaking space or a zero-width space often enough that the field has met
 * one. No API key contains a space, so these are removed rather than refused.
 */
const PASTE_SPACE = /[\s\u00a0\u1680\u2000-\u200b\u2028\u2029\u202f\u205f\u3000\ufeff]/g

/**
 * What a pasted key has to be before it can be sent at all.
 *
 * MEASURED 2026-09-23 in the app's own runtime: `fetch` THROWS on a header value that
 * carries a line break or a character above U+00FF — a key copied out of a chat
 * message, with a smart quote in it, is enough. The throw was caught and reported as
 * `unreachable`, so the pane blamed the network for a key that never left the
 * machine. So the value is settled before it is sent: the spaces and line breaks a
 * paste drags along are removed (no API key contains one, and a key wrapped over two
 * lines is the real key once joined), and whatever is left that the wire cannot carry
 * is refused by name instead of being sent. The same rule applies to every provider,
 * because the header is the same everywhere.
 *
 * @returns {{ key: string } | { error: 'key-required' | 'key-characters' }}
 */
export function normalizeKey(raw) {
  const stripped = String(raw === undefined || raw === null ? '' : raw).replace(PASTE_SPACE, '')
  if (stripped === '') return { error: 'key-required' }
  for (const character of stripped) {
    const code = character.codePointAt(0)
    const control = code < 0x20 || code === 0x7f
    if (control || code > 0xff) return { error: 'key-characters' }
  }
  return { key: stripped }
}

/**
 * One multipart POST of a file, judged the same way for every provider that takes a file.
 *
 * WHY THE UPLOAD GOES THROUGH THE HOST AND NOT THE PAGE. Krea's generation fields take an
 * external URL, a Krea asset URL or a base64 data URI — but a data URI of a real photograph
 * runs to megabytes, and `image_url` and `image_style_references[].url` cap the string at
 * 1024 characters. So a person's own file has to become a URL first, and the call that does
 * that needs the key: the pane never holds one (§12 rule 2).
 *
 * Krea's own upload, read 2026-09-23: `POST /assets`, multipart/form-data, one `file` part,
 * 75 MB maximum, answering `{ id, image_url, uploaded_at, width, height, … }`.
 *
 * @returns {{ payload: unknown } | { error: string, detail?: string }}
 */
async function postFile({ url, headers, field, name, type, bytes, timeoutMs = TIMEOUT_MS, fetchImpl = fetch }) {
  const form = new FormData()
  form.append(field, new Blob([bytes], { type }), name)
  let response
  try {
    response = await fetchImpl(url, {
      method: 'POST',
      headers: { Accept: 'application/json', ...headers },
      body: form,
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
    // The same three answers a run gets, plus the one an upload can get: a file past the
    // provider's own limit. Krea's limit is documented (75 MB) and enforced here too.
    if (response.status === 401) return { error: 'invalid-key' }
    if (response.status === 402) return { error: 'no-api-balance' }
    if (response.status === 413) return { error: 'too-large' }
    return { error: 'http-' + response.status }
  }
  return { payload }
}

/**
 * Upload one file for a provider that declares an `upload` descriptor, and answer the URL
 * the surface puts in the door.
 *
 * A provider without the descriptor is not an error here: the route refuses it by name
 * before this is reached, and RunningHub's run — which would upload per image door — is
 * still owed, so its descriptor arrives with that slice rather than before it.
 *
 * @returns {{ url: string } | { error: string, detail?: string }}
 */
export async function uploadFile(provider, { key, name, type, bytes, timeoutMs, fetchImpl } = {}) {
  const upload = provider && provider.upload
  if (!upload || typeof upload !== 'object') return { error: 'unsupported' }
  const posted = await postFile({
    url: provider.base + upload.path,
    headers: upload.headers ? upload.headers(key) : { Authorization: `Bearer ${key}` },
    field: upload.field,
    name,
    type,
    bytes,
    timeoutMs,
    fetchImpl,
  })
  if (posted.error) return posted
  const url = upload.url(posted.payload)
  if (str(url) === null) return { error: 'unexpected-response' }
  return { url, asset: upload.asset ? upload.asset(posted.payload) : null }
}

/**
 * One authenticated GET, judged the same way for every provider.
 *
 * The two failures are kept apart on purpose: a network failure never masquerades as
 * a bad key, and a bad key is never blamed on the network. A body that is not JSON is
 * not an error here — the caller decides, because "not JSON" is an unexpected answer
 * for one provider and impossible for another.
 *
 * @returns {{ status: number, ok: boolean, payload: unknown } | { error: 'timeout' | 'unreachable' }}
 */
async function getJson(url, headers, { timeoutMs = TIMEOUT_MS, fetchImpl = fetch } = {}) {
  let response
  try {
    response = await fetchImpl(url, {
      method: 'GET',
      headers: { Accept: 'application/json', ...headers },
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
  return { status: response.status, ok: response.ok, payload }
}

/**
 * The three things every provider does the same way: where its own data lives, what
 * it has installed, and how one of those is read.
 *
 * Takes the id rather than reading it off `this`: a provider is assembled from this
 * helper at module load, and passing the id keeps `this` out of the data paths.
 */
function adapterBacked(id) {
  return {
    /** This provider's own data, under the plugin's root: one directory per provider. */
    data(root) {
      return dataPaths(root, id)
    },

    /** The installed workflows of this provider: the list a card is drawn from. */
    listWorkflows({ dir }) {
      return listAdapters(dir)
    },

    /** One workflow, whole: the doors a surface renders. */
    readWorkflow({ dir, name }) {
      return readAdapter(dir, name)
    },
  }
}

/**
 * The Krea model a name refers to, or the failure the routes already answer with.
 *
 * Shared by the gate's preview and the run, so both resolve the name the same way and the
 * run cannot post to a model the preview did not just describe.
 */
async function modelFor(root, name) {
  const { models } = await readKreaModels(root)
  const model = models.find((entry) => entry.name === name)
  if (model === undefined) return { error: 'not-found', detail: 'no Krea model is named "' + String(name) + '"' }
  return { model }
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
 * RunningHub: the provider this plugin was built for, and the only one that can say
 * what a key is worth.
 *
 * A plain membership key can list and run AI Apps and ComfyUI Workflows; only the
 * Model API and LLM need an enterprise key, so a hobby account works here.
 */
/**
 * A RUN'S OWN OPTIONS, read through what the provider declares.
 *
 * An option is not a door: RunningHub's `instanceType` is the same three choices for every
 * app and belongs at the request's top level beside `webappId` rather than inside
 * `nodeInfoList`, so it cannot come from the adapter. The provider declares it
 * (`runOption`) and this is the only place a request's `options` is read — an option
 * nobody declared, or a value outside the declared modes, is refused here rather than
 * forwarded into somebody else's API.
 *
 * A missing value is not an error: it is the provider's own `fallback`, so a surface that
 * draws no split button still sends a complete request.
 *
 * @returns {{ ok: true, options: object | null } | { ok: false, detail: string }}
 */
export function runOptions(provider, raw) {
  const declared = provider.runOption
  const given = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  const keys = Object.keys(given)
  if (!declared) {
    return keys.length === 0 ? { ok: true, options: null } : { ok: false, detail: 'this provider takes no run options' }
  }
  if (keys.some((key) => key !== declared.key)) {
    return { ok: false, detail: declared.key + ' is the only run option this provider takes' }
  }
  const value = given[declared.key] === undefined ? declared.fallback : given[declared.key]
  if (!declared.modes.some((mode) => mode.id === value)) {
    return { ok: false, detail: String(value) + ' is not one of ' + declared.modes.map((mode) => mode.id).join(', ') }
  }
  return { ok: true, options: { [declared.key]: value } }
}

export const runninghub = {
  id: 'runninghub',
  label: 'RunningHub',
  /** What this provider makes. The settings row tags it; the list order is the
   * registry's, not this field's. */
  kind: 'workflow',
  /** The credential reference. A `CredentialRef` is the environment-variable-name
   * half of the credentials seam, so this string is also the name a person may
   * already have set — which is the point (epic 61 D1). */
  keyRef: 'RH_API_KEY',
  base: 'https://www.runninghub.ai',
  accountPath: '/uc/openapi/accountStatus',
  /**
   * One page, two jobs: the key list is there (`tab=keys`) and so is the billing
   * balance (`bill-task`). No separate billing deep link is published, and inventing
   * one would be worse than landing the person on the page that has both.
   */
  keyUrl: 'https://www.runninghub.ai/call-api/bill-task?tab=keys',
  keyPageLabel: 'API → Keys',
  accountUrl: 'https://www.runninghub.ai/call-api/bill-task',
  /** RunningHub runs on coins, bought on the same page that shows the balance. */
  funding: { kind: 'coins', url: 'https://www.runninghub.ai/call-api/bill-task' },
  /**
   * How one of this provider's workflows is installed: the sentence the user says to
   * the agent. A plugin cannot type into the composer and neither can a slash command
   * start a turn (measured 2026-09-22), so the surface shows this and the
   * `add-rh-workflow` skill does the work.
   */
  addPrompt: 'add this RunningHub workflow <app link>',

  /**
   * THE INSTANCE TYPE — RunningHub's own run modes.
   *
   * Read from RunningHub's OpenAPI on 2026-09-23 (`POST /task/openapi/ai-app/run`, the
   * `instanceType` field): *"Optional. `default` uses 24GB VRAM; `plus` uses 48GB;
   * `ultra` uses 84GB."* The founder saw the same three in RunningHub's own form —
   * *"RH has option to run as plus vs ultra"* — as a split button beside Run.
   *
   * It is provider data, not a door: it does not come from the app, it is the same three
   * choices for every app, and it belongs at the request's top level beside `webappId`
   * rather than inside `nodeInfoList`. So it is declared here, the surface draws it from
   * this declaration, and the host refuses any option this declaration does not name.
   *
   * The sizes are RunningHub's own words for the machines, which is what a person is
   * choosing between; they are not a price, and no price is claimed here.
   */
  runOption: {
    key: 'instanceType',
    label: 'Instance',
    fallback: 'default',
    modes: [
      { id: 'default', label: 'Default', description: '24GB VRAM' },
      { id: 'plus', label: 'Plus', description: '48GB VRAM' },
      { id: 'ultra', label: 'Ultra', description: '84GB VRAM' },
    ],
  },

  /**
   * One account read. `code: 0` is the API's yes; a non-zero code is its no. The
   * outcomes are the shared four above.
   */
  async account({ base = this.base, key, timeoutMs = TIMEOUT_MS, fetchImpl = fetch } = {}) {
    let response
    try {
      response = await fetchImpl(base + this.accountPath, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({ apikey: key }),
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
    if (payload === null || typeof payload.code !== 'number') {
      return { error: response.ok ? 'unexpected-response' : 'http-' + response.status }
    }
    if (payload.code !== 0) return { error: 'invalid-key' }
    return { account: accountOf(payload.data) }
  },

  ...adapterBacked('runninghub'),
}

/**
 * Krea: the image provider, and the first one whose key proves itself by listing.
 *
 * THE CHECK IS `GET /jobs`, read from Krea's own OpenAPI on 2026-09-23
 * (`docs/api-reference/general/list-jobs.md`): `security: bearerAuth`, 200 is
 * `{ items: [...], next_cursor }` with `items` required, 401 is Unauthorized. It is the
 * cheapest authenticated read the API has, and it is also the only thing a key can be
 * checked against: the 117-path spec has no `/me`, `/account`, `/credits`, `/balance` or
 * `/keys` route — all five answer 404 — the official SDK exposes no account call, and
 * the key page says outright that balance *"cannot be read programmatically — monitor it
 * in-app"*. So `account` carries what the read proves and nothing is invented.
 *
 * 402 IS "NO API BALANCE", NOT A BAD KEY. Same page, same date: API calls draw on a
 * separate USD balance, and when it runs out *"new API requests are rejected with HTTP
 * 402 Payment Required"*, with the top-up page as the way back. Calling that key invalid
 * would be a guess, and throwing it away would lose a key the user owns, so it is stored
 * and the row says which of the two happened — the founder's rule for Comfy Cloud's 429
 * (2026-09-23: *"store it and mark it unverified"*).
 *
 * A read is not billed: the docs bill completed generations ("failed and cancelled jobs
 * are not billed").
 */
export const krea = {
  id: 'krea',
  label: 'Krea',
  kind: 'image',
  keyRef: 'KREA_API_KEY',
  base: 'https://api.krea.ai',
  keyUrl: 'https://www.krea.ai/settings/api-tokens',
  keyPageLabel: 'API tokens',
  /** Where the API balance is topped up. The docs call it a separate USD balance from
   * the app's own compute units, so this is the page that matters for a run. */
  accountUrl: 'https://www.krea.ai/app/api',
  /** Krea has NO monthly plan: the API draws on a separate prepaid USD balance, which
   * is why an empty one is the 402 above rather than an expired subscription. */
  funding: { kind: 'balance', url: 'https://www.krea.ai/app/api' },
  addPrompt: 'add this Krea model <model name>',

  /**
   * THE UPLOAD: how a file a person picked becomes the URL a door carries.
   *
   * Krea's own asset API, read 2026-09-23: `POST /assets` takes multipart/form-data with one
   * `file` part (JPEG, PNG, WebP, HEIC, MP4, MOV, WebM, GLB, WAV, MP3; 75 MB maximum) and
   * answers `{ id, image_url, uploaded_at, width, height, size_bytes, mime_type,
   * description }`. `image_url` is the string Krea's generation fields then accept, and the
   * only field this plugin reads.
   *
   * It is here rather than in the pane because the call needs the key, and the pane never
   * holds one (§12 rule 2).
   */
  upload: {
    path: '/assets',
    field: 'file',
    /** Krea's own documented maximum, so the file is refused here rather than at the wire. */
    limitBytes: 75 * 1024 * 1024,
    url: (payload) => (payload && typeof payload.image_url === 'string' ? payload.image_url : null),
    asset: (payload) => (payload && typeof payload.id === 'string' ? payload.id : null),
  },

  async account({ base = this.base, key, timeoutMs = TIMEOUT_MS, fetchImpl = fetch } = {}) {
    const read = await getJson(base + '/jobs', { Authorization: `Bearer ${key}` }, { timeoutMs, fetchImpl })
    if (read.error) return { error: read.error }
    // 401 for a missing, malformed or revoked key. The spec says the body is
    // `{ error }` while the live API answers `{ message: "Unauthorized" }`, so the
    // status decides and the body is never read for it.
    if (read.status === 401) return { error: 'invalid-key' }
    // Out of API balance: every request is refused until the workspace is topped up.
    if (read.status === 402) return { unverified: true, note: 'no-api-balance' }
    if (!read.ok) return { error: 'http-' + read.status }
    if (!read.payload || !Array.isArray(read.payload.items)) return { error: 'unexpected-response' }
    return { account: { jobs: read.payload.items.length } }
  },

  ...adapterBacked('krea'),

  /**
   * THE KREA SECTION HOLDS TWO KINDS OF THING, and this is the only provider where that
   * is true: the models Krea documents (shipped, plus the profile's own `_models.json`)
   * and any adapter somebody installed into Krea's own directory. Both arrive as the one
   * list of cards the pane already draws, so the pane needed no change to gain a model.
   */
  async listWorkflows({ dir, root }) {
    const models = await readKreaModels(root)
    const adapters = await listAdapters(dir)
    return {
      entries: [...models.models.map(modelEntry), ...adapters.entries],
      skipped: [...models.skipped, ...adapters.skipped],
    }
  },

  /** One Krea unit, whole: a documented model when the name is one, a file otherwise. */
  async readWorkflow({ dir, root, name }) {
    const { models } = await readKreaModels(root)
    const model = models.find((entry) => entry.name === name)
    if (model !== undefined) return { adapter: modelSurface(model) }
    return readAdapter(dir, name)
  },

  /**
   * THIS IS THE PROVIDER THAT CAN RUN (S5). A model carries its own endpoint, its doors
   * carry the API's own field names, and the key is a bearer token — which is everything a
   * generation needs. RunningHub's run is a different job (a workflow's node ids, an upload
   * for every image door) and says so rather than pretending.
   */
  runnable: true,

  /**
   * The gate's preview: the exact body a run would post, built by the same function the run
   * itself uses, so what a person reads is what goes out. No key, no network, nothing spent.
   */
  async previewRun({ root, name, values }) {
    const found = await modelFor(root, name)
    if (found.error) return found
    const built = buildRunPayload(found.model, values)
    return {
      name: found.model.name,
      title: found.model.title,
      model: found.model.model,
      endpoint: found.model.endpoint,
      docs: str(found.model.docs) || null,
      ...built,
    }
  },

  /**
   * Start the job. The host route only reaches this after a person confirmed the payload
   * the preview showed, and it refuses a payload the API would reject rather than spending
   * a credit on a 400.
   *
   * `options` — the host's own validated read of the request's run options — is not used
   * here: Krea declares no `runOption`, so the host only ever passes null. It is accepted
   * and recorded so one route shape serves every provider.
   */
  async startRun({ root, name, values, options, key, timeoutMs, fetchImpl }) {
    const preview = await this.previewRun({ root, name, values })
    if (preview.error) return preview
    if (preview.missing.length > 0) return { error: 'payload-incomplete', detail: 'still empty: ' + preview.missing.join(', ') }
    if (preview.refused.length > 0) {
      return { error: 'payload-refused', detail: preview.refused.map((row) => row.key + ': ' + row.reason).join(', ') }
    }
    const posted = await postRun({ base: this.base, endpoint: preview.endpoint, body: preview.body, key, timeoutMs, fetchImpl })
    if (posted.error) return posted

    const at = new Date().toISOString()
    const record = {
      schema: 'muen-krea-run/v1',
      jobId: posted.jobId,
      at,
      model: preview.model,
      title: preview.title,
      endpoint: preview.endpoint,
      body: preview.body,
      // The run's own options, as the host validated them (null for a provider that
      // declares none), so the record answers "what did we ship" as completely as the
      // payload does.
      options: options || null,
      // THE GATE'S OWN ANSWER, in the record, because rule 4 asks what was shipped and
      // why: the payload above is what a person saw before this line existed.
      gate: { confirmed: true, by: 'human', at },
      status: posted.status,
    }
    await writeRunRecord(root, record)
    return { jobId: posted.jobId, status: posted.status }
  },

  /**
   * One poll of a running job. The outcome is written back to that job's record, so the
   * file on disk ends as the answer rather than as the request.
   */
  async readRun({ root, jobId, key, timeoutMs, fetchImpl }) {
    const read = await getRun({ base: this.base, jobId, key, timeoutMs, fetchImpl })
    if (read.error) return read
    if (read.state === 'done' || read.state === 'failed') {
      const record = await readRunRecord(root, jobId)
      if (record !== null) {
        await writeRunRecord(root, {
          ...record,
          status: read.status,
          urls: read.urls,
          error: read.error,
          finishedAt: new Date().toISOString(),
        })
      }
    }
    return read
  },
}

/**
 * Magnific: the image enhancer.
 *
 * THE CHECK IS `GET /v1/creations/recent?per_page=1` — the one read the docs say
 * *"does not consume credits"*, and the only free call that resolves identity from
 * the key. Researched 2026-09-23: no balance, credits or plan endpoint exists in the
 * 360-path spec, so this provider can never report a number.
 *
 * 401 IS "BAD KEY"; 403 IS NOT. The spec references a `403-forbidden` response
 * component it never defines, so a 403 has no documented meaning: it may be a valid
 * key without API entitlement. Calling that key invalid would be a guess, and
 * throwing it away would lose a key the user owns, so it is stored and the row says
 * it was not checked.
 */
export const magnific = {
  id: 'magnific',
  label: 'Magnific',
  kind: 'image',
  keyRef: 'MAGNIFIC_API_KEY',
  base: 'https://api.magnific.com',
  keyUrl: 'https://www.magnific.com/user/organization/api-keys',
  keyPageLabel: 'API keys',
  /** No billing page is documented well enough to link: every dashboard URL the docs
   * cite answers 403 to a non-browser client, so the card links the key page only. */
  accountUrl: null,
  /** Its API is not pay-per-use: a paid plan grants a credit bundle (yearly on the
   * annual plans, topped up anytime) and API calls draw on those credits, so the row
   * links the public plans page rather than a console. Researched 2026-09-23. */
  funding: { kind: 'credits', url: 'https://www.magnific.com/pricing' },
  addPrompt: 'add this Magnific tool <tool name>',

  async account({ base = this.base, key, timeoutMs = TIMEOUT_MS, fetchImpl = fetch } = {}) {
    const read = await getJson(
      base + '/v1/creations/recent?per_page=1',
      { 'x-magnific-api-key': key },
      { timeoutMs, fetchImpl },
    )
    if (read.error) return { error: read.error }
    if (read.status === 401) return { error: 'invalid-key' }
    if (read.status === 403) return { unverified: true, note: 'not-entitled' }
    if (!read.ok) return { error: 'http-' + read.status }
    if (!read.payload || !Array.isArray(read.payload.data)) return { error: 'unexpected-response' }
    const first = read.payload.data[0]
    return { account: { userId: first ? num(first.user_id) : null } }
  },

  ...adapterBacked('magnific'),
}

/**
 * Comfy Cloud: the hosted ComfyUI, and the second workflow provider.
 *
 * THE CHECK IS `GET /api/user` with `X-API-Key` — documented as *"information about
 * the currently authenticated user"*, and the only account route the v1 spec has.
 * Researched 2026-09-23: `/api/me`, `/api/credits` and `/api/org` do not exist, and
 * the documented body is `{ status }` alone.
 *
 * 429 IS NOT A BAD KEY. The v1 docs give it one meaning — *"the API key is on an
 * inactive subscription"* — which means the key is real. It is stored, and the row
 * says the subscription is what is missing: a v2 job submission would still fail, so
 * saying "linked" without that note would be the lie.
 */
export const comfycloud = {
  id: 'comfycloud',
  label: 'Comfy Cloud',
  kind: 'workflow',
  keyRef: 'COMFY_CLOUD_API_KEY',
  base: 'https://cloud.comfy.org',
  keyUrl: 'https://platform.comfy.org/profile/api-keys',
  keyPageLabel: 'API keys',
  /** Subscription and credits live in the platform console, which is where the key
   * page is and the only Comfy-owned URL the docs cite for an account. */
  accountUrl: 'https://platform.comfy.org',
  /** The one provider here with a monthly plan. Its key is refused while the
   * subscription is inactive (the 429 above), so the row says so and links the page
   * that compares the plans and their monthly credits; the plan itself is bought and
   * the credits held in the console at `accountUrl`. */
  funding: { kind: 'plan', url: 'https://comfy.org/pricing' },
  addPrompt: 'add this Comfy Cloud workflow <workflow file>',

  async account({ base = this.base, key, timeoutMs = TIMEOUT_MS, fetchImpl = fetch } = {}) {
    const read = await getJson(base + '/api/user', { 'X-API-Key': key }, { timeoutMs, fetchImpl })
    if (read.error) return { error: read.error }
    if (read.status === 401) return { error: 'invalid-key' }
    if (read.status === 429) return { account: { status: 'inactive' }, note: 'subscription-inactive' }
    if (!read.ok) return { error: 'http-' + read.status }
    const status = read.payload ? str(read.payload.status) : null
    if (status === null) return { error: 'unexpected-response' }
    return { account: { status } }
  },

  ...adapterBacked('comfycloud'),
}

/**
 * Every provider this build speaks to, in the order the surfaces show them (founder,
 * 2026-09-23: *"the order of providers is: RunningHub, Krea, Comfy Cloud"*, and
 * Magnific — the one key still untested — as the last row). Reordering this array
 * reorders the settings page, the pane's meters and every card list that follows them.
 */
export const PROVIDERS = [runninghub, krea, comfycloud, magnific]

/**
 * One provider by id, or null.
 *
 * The id arrives from the page, so an unknown one is a normal answer rather than an
 * exception: the router turns it into a 404 that names what it did not find.
 */
export function providerById(id) {
  const wanted = str(id)
  if (wanted === null) return null
  return PROVIDERS.find((provider) => provider.id === wanted) || null
}
