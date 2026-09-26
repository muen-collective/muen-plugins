/**
 * The carrier, read where the library needs it (epic 64 S8, the library's half).
 *
 * THE FORMAT IS SHARED, THE CODE IS NOT (epic 63 §1): `@muen/dsh-generate` owns the same
 * reading for its export half, and the two plugins never import each other. What travels
 * between them is a written-down file format — `prompt` and `workflow` are ComfyUI's own
 * `tEXt` chunks (the API graph and the UI graph) and `AIGC` is RunningHub's provenance label
 * — so each plugin reads it for what it needs and neither reaches into the other. This half
 * needs ONE fact: does this picture carry a graph, and how big is it.
 *
 * WHY IT BELONGS HERE (epic 64 §4b: *"reading it is free and belongs in the library"*): the
 * catalog job is "find the original", and a graph-carrying file is a different thing from a
 * provider's result — one can be opened in a local ComfyUI, the other cannot. Measured on
 * this machine: every PNG the Generate plugin's runs saved carries the label and no graph,
 * while a canvas export carries both.
 *
 * IT NEVER GUESSES. A format this does not read (JPEG and WebP carry the same data in EXIF,
 * which is not built) answers `supported: false`, so a caller says "not read" rather than
 * "no graph"; a PNG with only the label answers `hasGraph: false` with the label still named.
 * The read is BOUNDED — text chunks sit before the image data in every file measured here —
 * and a file whose chunks would fall past the bound answers `complete: false` instead of
 * pretending it saw the whole thing.
 *
 * @module @muen/dsh-assets/lib/carrier
 */
import { open } from 'node:fs/promises'

/** How much of a file is read looking for text chunks. The canvas file's three total 28.5 KB. */
export const CARRIER_MAX_BYTES = 1024 * 1024

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

/** The three chunk keys this product knows, and what each one means. */
const KEYS = { prompt: 'api', workflow: 'ui', AIGC: 'label' }

/** What format these bytes are, so "not read" never reads as "no graph". */
export function formatOf(buffer) {
  const bytes = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || [])
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(PNG_SIGNATURE)) return 'png'
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg'
  if (bytes.length >= 12 && bytes.subarray(0, 4).toString('latin1') === 'RIFF' && bytes.subarray(8, 12).toString('latin1') === 'WEBP') return 'webp'
  return 'unknown'
}

/** A chunk's text as data: the graphs are JSON, and a chunk that is not is kept as text. */
function asJson(text) {
  const trimmed = String(text || '').trim()
  if (trimmed === '' || (trimmed[0] !== '{' && trimmed[0] !== '[')) return trimmed
  try {
    return JSON.parse(trimmed)
  } catch {
    return trimmed
  }
}

/** How many entries a graph object has, and the class types among them. */
function graphShape(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const ids = Object.keys(value)
  if (ids.length === 0) return null
  const classTypes = []
  for (const id of ids) {
    const node = value[id]
    const kind = node && typeof node === 'object' && typeof node.class_type === 'string' ? node.class_type : null
    if (kind !== null && !classTypes.includes(kind)) classTypes.push(kind)
  }
  return { nodes: ids.length, classTypes }
}

/** The UI graph's shape, which is a different object: `nodes`, `links`, `version`. */
function uiShape(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const nodes = Array.isArray(value.nodes) ? value.nodes.length : null
  const links = Array.isArray(value.links) ? value.links.length : null
  if (nodes === null && links === null) return null
  return { nodes, links }
}

/**
 * What the text chunks of these bytes say.
 *
 * @param {Buffer} buffer - the first part of the file (see `CARRIER_MAX_BYTES`).
 * @param {object} [options]
 * @param {boolean} [options.complete] - whether the buffer was the whole file.
 * @returns {{ format: string, supported: boolean, hasGraph: boolean, api: object|null, ui: object|null, label: boolean, complete: boolean, error: string|null }}
 */
export function graphFactsFromBuffer(buffer, { complete = true } = {}) {
  const bytes = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || [])
  const format = formatOf(bytes)
  const empty = { format, supported: false, hasGraph: false, api: null, ui: null, label: false, complete, error: null }
  if (format !== 'png') return empty
  const found = {}
  let offset = PNG_SIGNATURE.length
  while (offset + 8 <= bytes.length) {
    const length = bytes.readUInt32BE(offset)
    const type = bytes.subarray(offset + 4, offset + 8).toString('latin1')
    const dataStart = offset + 8
    const dataEnd = dataStart + length
    // A chunk that runs past the buffer ends the walk: what was read is what there is. The
    // buffer being the WHOLE file while a chunk overruns means the file is malformed, which is
    // still "no graph found" — `complete` describes the READ, not the file's health.
    if (dataEnd + 4 > bytes.length) break
    if (type === 'tEXt' || type === 'iTXt') {
      const data = bytes.subarray(dataStart, dataEnd)
      const zero = data.indexOf(0)
      if (zero >= 1) {
        const key = data.subarray(0, zero).toString('latin1')
        if (KEYS[key] !== undefined && found[key] === undefined) {
          if (type === 'tEXt') {
            found[key] = data.subarray(zero + 1).toString('latin1')
          } else {
            const rest = data.subarray(zero + 1)
            const languageEnd = rest.indexOf(0, 2)
            const translatedEnd = languageEnd === -1 ? -1 : rest.indexOf(0, languageEnd + 1)
            if (translatedEnd !== -1) found[key] = rest.subarray(translatedEnd + 1).toString('utf8')
          }
        }
      }
    }
    if (type === 'IEND') break
    offset = dataEnd + 4
  }
  const api = graphShape(asJson(found.prompt))
  const ui = uiShape(asJson(found.workflow))
  return {
    format,
    supported: true,
    hasGraph: api !== null || ui !== null,
    api,
    ui,
    label: found.AIGC !== undefined,
    complete,
    error: null,
  }
}

/**
 * Read a file's own carrier facts, by opening it and reading at most `max` bytes.
 *
 * A file that vanishes, cannot be read, or is not a PNG answers `null`/`supported: false` —
 * the metadata block says nothing rather than inventing a graph.
 */
export async function graphFacts(file, ext, { openFile = open, max = CARRIER_MAX_BYTES } = {}) {
  if (String(ext || '').toLowerCase() !== 'png') {
    // Not read rather than not carried: the format is named, and the surface stays quiet.
    return { format: String(ext || '').toLowerCase() === 'jpg' || String(ext || '').toLowerCase() === 'jpeg' ? 'jpeg' : 'unknown', supported: false, hasGraph: false, api: null, ui: null, label: false, complete: true, error: null }
  }
  let handle
  try {
    handle = await openFile(file, 'r')
  } catch {
    return null
  }
  try {
    const info = await handle.stat()
    const size = Number(info.size) || 0
    const length = Math.min(size, max)
    if (length < 8) return null
    const buffer = Buffer.alloc(length)
    await handle.read(buffer, 0, length, 0)
    return graphFactsFromBuffer(buffer, { complete: size <= max })
  } catch {
    return null
  } finally {
    await handle.close().catch(() => {})
  }
}
