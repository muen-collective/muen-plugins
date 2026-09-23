/**
 * Reading an app's doors out of RunningHub.
 *
 * Epic 61 §2, measured 2026-09-22 (S0, receipts in the dsh-mitsu workspace at
 * `product/strategy/data/rh-probe/`): one GET answers with everything mechanical
 * about an app's exposed inputs.
 *
 *   GET /api/webapp/apiCallDemo?apiKey=&webappId=
 *   → { code: 0, data: { webappName, accessEncrypted, covers[], tags[],
 *                        descriptionEn, nodeInfoList[], … } }
 *
 * and each `nodeInfoList` entry carries `nodeId`, `fieldName`, `fieldType`,
 * `nodeName` and `fieldData`. `fieldData` is a JSON *string*, a two-element array:
 * `["STRING", {"multiline": true}]`, `["COMBO", {"options": […], "tooltip": …}]`,
 * `["FLOAT", {"min": 0.1, "max": 16, "step": 0.1, "default": 1}]`. Three findings
 * from the probe shape this file:
 *
 *   1. **`descriptionEn` is not a label.** It returns the raw field name. Every
 *      human word is authored, which is what the glossary is for (lib/house.js).
 *   2. **`fieldData`'s first element is not always a string.** An IMAGE door's is an
 *      array — `[["example.png", "None", "keep_this_dic"], {"image_upload": true}]` —
 *      so the control cannot be read off it alone, and `fieldType` leads instead.
 *   3. **Two doors can share a `nodeId`.** `942` carries both `aspect_ratio` and
 *      `megapixels` on a real app, so a door is identified by the PAIR
 *      `(nodeId, fieldName)`, never by `nodeId` alone (§8 rule 18).
 *
 * Nothing here writes, spends coins or calls the model. It reads one app and
 * derives what the API already knows.
 *
 * @module @muen/dsh-generate/lib/doors
 */
import { glossaryLabel } from './house.js'

/** The API path S0 proved. */
export const API_CALL_DEMO = '/api/webapp/apiCallDemo'

/** A RunningHub app id: 19 digits on every app probed. Six is a safe floor. */
const APP_ID = /^\d{6,}$/

/** The adapter's door vocabulary. Anything else is hidden, not guessed (§8 rule 11). */
export const DOOR_TYPES = ['image', 'text', 'number', 'select']

/**
 * What a SURFACE can draw: the four above, plus `list`.
 *
 * TWO VOCABULARIES ON PURPOSE. A RunningHub door is one of the app's own inputs, and an
 * app's `fieldType` is never a list, so an adapter stays on `DOOR_TYPES`. A Krea model's
 * doors are Krea's request schema, and three of its fields are arrays of objects —
 * `styles`, `image_style_references`, `moodboards` (Krea's OpenAPI, read 2026-09-23). The
 * surface can draw those as rows, each row carrying its own doors, which is why the
 * vocabulary the catalogue is checked against is this one.
 */
export const SURFACE_DOOR_TYPES = [...DOOR_TYPES, 'list']

/** `fieldName` → the semantic key a mechanical install proposes. */
const KEY_BY_FIELD = {
  image: 'image',
  image1: 'image1',
  image2: 'image2',
  image3: 'image3',
  text: 'prompt',
  prompt: 'prompt',
  aspect_ratio: 'aspectRatio',
  resolution: 'resolution',
  megapixels: 'megapixels',
  Value: 'seed',
  seed: 'seed',
  upload: 'upload',
}

function str(value) {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null
}

/**
 * Turn what a person pasted into an app id.
 *
 * Accepted: a bare id, any runninghub.ai app URL, and any URL whose query carries
 * `webappId` / `appId` or whose path carries a long numeric segment. A short
 * number is refused rather than guessed at — the failure mode of guessing is
 * reading a different app's doors and writing a surface for it.
 *
 * @param {string} input
 * @returns {{ appId: string, url: string | null } | { error: 'missing-link' | 'unrecognized-link' }}
 */
export function parseAppRef(input) {
  const text = String(input ?? '').trim()
  if (text === '') return { error: 'missing-link' }
  if (APP_ID.test(text)) return { appId: text, url: null }

  let url
  try {
    url = new URL(text)
  } catch {
    return { error: 'unrecognized-link' }
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return { error: 'unrecognized-link' }

  // An explicit parameter names the app even when the path is a short link.
  for (const name of ['webappId', 'appId']) {
    const value = str(url.searchParams.get(name))
    if (value !== null && APP_ID.test(value)) return { appId: value, url: url.toString() }
  }
  // Otherwise the id is the last long numeric path segment (`/app/<id>`, `/ai-app/<id>`).
  const segments = url.pathname.split('/').filter(Boolean)
  for (let index = segments.length - 1; index >= 0; index -= 1) {
    if (APP_ID.test(segments[index])) return { appId: segments[index], url: url.toString() }
  }
  return { error: 'unrecognized-link' }
}

/**
 * `fieldData` parsed. Never throws: an unreadable string is reported as null and
 * the door still derives from `fieldType` alone.
 *
 * @returns {{ kind: string | null, opts: Record<string, unknown> } | null}
 */
export function parseFieldData(fieldData) {
  let parsed = fieldData
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed)
    } catch {
      return null
    }
  }
  if (!Array.isArray(parsed)) return null
  const kind = typeof parsed[0] === 'string' ? parsed[0] : null
  const opts = parsed.length > 1 && typeof parsed[1] === 'object' && parsed[1] !== null ? parsed[1] : {}
  // The API's OTHER shape, met on KSampler's scheduler and sampler_name and on
  // UNETLoader's weight_dtype: the options ARE the first element, with no kind token in
  // front of them. It is kept SEPARATE from `opts.options` rather than folded in,
  // because for an IMAGE door that same first element is the filename currently loaded
  // — a picture, not a menu — and only `controlFor` knows the type.
  const bareOptions =
    Array.isArray(parsed[0]) && parsed[0].length > 0 && parsed[0].every((option) => typeof option === 'string') ? parsed[0] : null
  return { kind, opts, bareOptions }
}

/**
 * The control the pane renders, from the API's own facts.
 *
 * Options win over type: a `LIST` door is a select because it has options to
 * select, and a `COMBO`'s options are the whole point of it. `fieldType` leads
 * otherwise, because `fieldData`'s first element is not always a type string.
 *
 * @returns {'image' | 'text' | 'number' | 'select' | null} null = not rendered (§8 rule 11)
 */
export function controlFor(fieldType, fieldData) {
  const spec = parseFieldData(fieldData)
  const type = String(fieldType ?? '').toUpperCase()
  const options = spec
    ? Array.isArray(spec.opts.options)
      ? spec.opts.options
      : // A bare option list is a menu on everything except an image door, where it is
        // the file that door is holding.
        type !== 'IMAGE' && Array.isArray(spec.bareOptions)
        ? spec.bareOptions
        : null
    : null
  if (options && options.length > 0) return 'select'
  if (type === 'IMAGE') return 'image'
  if (type === 'INT' || type === 'FLOAT' || type === 'NUMBER') return 'number'
  if (type === 'STRING') return 'text'
  return null
}

/** A stable, semantic key for a door, deduped against the keys already used. */
export function doorKeyFor(fieldName, used = new Set()) {
  const token = String(fieldName ?? '').trim()
  const base =
    Object.prototype.hasOwnProperty.call(KEY_BY_FIELD, token)
      ? KEY_BY_FIELD[token]
      : token
          .replace(/[^A-Za-z0-9]+(.)?/g, (_match, next) => (next ? next.toUpperCase() : ''))
          .replace(/^[A-Z]/, (first) => first.toLowerCase()) || 'field'
  let key = base
  let suffix = 2
  while (used.has(key)) {
    key = base + suffix
    suffix += 1
  }
  used.add(key)
  return key
}

/**
 * One door, derived. `nodeId` and `fieldName` are the API's, everything in
 * `copy` is the API's, and the label is the only authored word.
 *
 * @returns {object | null} null when the entry carries no usable pair
 */
export function deriveDoor(node, index, house, used = new Set()) {
  if (!node || typeof node !== 'object') return null
  const nodeId = str(node.nodeId)
  const fieldName = str(node.fieldName)
  if (nodeId === null || fieldName === null) return null

  const spec = parseFieldData(node.fieldData)
  const opts = spec ? spec.opts : {}
  const type = controlFor(node.fieldType, node.fieldData)
  const { label, fromGlossary } = glossaryLabel(fieldName, house.glossary)
  const advanced =
    house.advancedFieldNames.includes(fieldName) || (type !== null && house.advancedTypes.includes(type))

  const door = {
    key: doorKeyFor(fieldName, used),
    nodeId,
    fieldName,
    fieldType: str(node.fieldType),
    nodeName: str(node.nodeName),
    type,
    supported: type !== null,
    label,
    fromGlossary,
    advanced,
    // The API's own string, kept so nothing derived is taken on trust.
    fieldData: typeof node.fieldData === 'string' ? node.fieldData : undefined,
  }
  for (const [from, to] of [
    ['options', 'options'],
    ['min', 'min'],
    ['max', 'max'],
    ['step', 'step'],
    ['default', 'default'],
    ['multiline', 'multiline'],
  ]) {
    if (opts[from] !== undefined) door[to] = opts[from]
  }
  // A bare option list is this door's menu unless the door is an image, where that same
  // element is the file it holds (the rule `controlFor` applies, carried through here
  // so a select derived from it also carries the options it selects between).
  if (door.options === undefined && type !== 'image' && spec && Array.isArray(spec.bareOptions)) {
    door.options = spec.bareOptions
  }
  if (house.hint === 'tooltip' && typeof opts.tooltip === 'string' && opts.tooltip.trim() !== '') {
    door.hint = opts.tooltip.trim()
  }
  if (index < house.mainDoors && !advanced) door.mainDoor = true
  return door
}

/** Every usable door on an app, in the order the app declares them (which is render order). */
export function deriveDoors(nodeInfoList, house) {
  const list = Array.isArray(nodeInfoList) ? nodeInfoList : []
  const used = new Set()
  const doors = []
  list.forEach((node, index) => {
    const door = deriveDoor(node, index, house, used)
    if (door !== null) doors.push(door)
  })
  return doors
}

/** The cover the start-page card shows. `covers[0]`, or nothing (§8 rule 12). */
export function coverOf(covers) {
  if (!Array.isArray(covers) || covers.length === 0) return null
  const first = covers[0]
  if (!first || typeof first !== 'object') return null
  return str(first.url) || str(first.thumbnailUri)
}

/** The tag name in English when the API has one, else the tag's own name. */
export function tagsOf(tags) {
  if (!Array.isArray(tags)) return []
  return tags
    .map((tag) => (tag && typeof tag === 'object' ? str(tag.nameEn) || str(tag.name) : null))
    .filter((name) => name !== null)
}

/**
 * One app read. Outcomes are kept apart, the same way the wallet's are:
 *
 *   { app }                       the app's doors are usable
 *   { error: 'access-encrypted' } the app sets `accessEncrypted`; write nothing (D14)
 *   { error: 'api-error', … }     RunningHub answered and refused, with its own words
 *   { error: 'unreachable' | 'timeout' | 'unexpected-response' | 'http-<n>' }
 *
 * The key travels in the query string because that is the endpoint's documented
 * shape; it is never logged, never returned, and never written into a receipt.
 */
export async function readAppDoors({ base, key, appId, house, timeoutMs = 15000, fetchImpl = fetch }) {
  const url = `${base}${API_CALL_DEMO}?apiKey=${encodeURIComponent(key)}&webappId=${encodeURIComponent(appId)}`
  let response
  try {
    response = await fetchImpl(url, {
      headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
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
  if (payload.code !== 0) {
    return { error: 'api-error', code: payload.code, detail: str(payload.msg) || str(payload.errorMessages) }
  }

  const data = payload.data
  if (!data || typeof data !== 'object') return { error: 'unexpected-response' }
  const appName = str(data.webappName)
  if (data.accessEncrypted === true) return { error: 'access-encrypted', appName }

  const doors = deriveDoors(data.nodeInfoList, house)
  return {
    app: {
      appId,
      webappName: appName,
      accessEncrypted: data.accessEncrypted === true,
      description: str(data.description) || str(data.descriptionEn),
      cover: coverOf(data.covers),
      tags: tagsOf(data.tags),
      doors,
      // The API declares no requiredness, so the surface must not invent one.
      requirednessKnown: false,
    },
  }
}
