/**
 * The carrier (epic 64 S8): what a saved picture carries besides pixels.
 *
 * ComfyUI writes its graph into the picture it saves. A PNG gets `tEXt` chunks keyed
 * **`prompt`** (the API-format graph: one entry per node id, each with its `class_type` and
 * `inputs`) and **`workflow`** (the UI graph: nodes, links, groups), and RunningHub adds a
 * third, **`AIGC`** (its provenance label: `Label`, `ContentProducer`, `ProduceID`,
 * `PropagateID`). Measured 2026-09-25 on this machine, and the two halves are true of
 * DIFFERENT files:
 *
 *   - every PNG the plugin's own runs saved carries exactly one chunk, `AIGC` — the label
 *     and no graph (`~/Desktop/runninghub/**`, 22 files, and the newest re-fetched from its
 *     own provider URL is byte-identical to the saved copy);
 *   - a file exported from RunningHub's own canvas carries `prompt` (6,022 bytes, 49 nodes)
 *     and `workflow` (22,254 bytes) beside that label.
 *
 * So this module answers a question a surface can draw — "does this picture carry a graph,
 * and what is in it" — and never invents one. **A file with only `AIGC` reports NO GRAPH
 * rather than an empty one**, because an empty graph and no graph are different facts.
 *
 * THE NODE IDS LINE UP. `prompt` is keyed by node id and carries `class_type`, which is the
 * same `(nodeId, fieldName)` space an adapter's doors already use — so a graph and a run
 * record merge: the record supplies the values a person confirmed, the graph supplies
 * everything else around them. That is what makes an export meaningful, and it is why the
 * reading is a summary rather than a blob.
 *
 * WRITING IS AN EXPORT, NOT A RUN (`insertPngText`). A saved result can be written out with
 * the graph injected, so a picture from this panel opens in a local ComfyUI — which is what
 * "everything stored on local" means at its strongest. The export **refuses an app with no
 * graph instead of writing a lie**: a PNG claiming a graph it does not carry would error in
 * somebody else's ComfyUI with no way to tell why.
 *
 * WHAT THIS DOES NOT DO YET: JPEG and WebP carry the same data in EXIF, and this reads PNG
 * only. A JPEG answers `format: 'jpeg'` with `supported: false`, so a caller says "not read"
 * rather than "no graph" — the distinction the whole module is built on.
 *
 * @module @muen/dsh-generate/lib/carrier
 */

/** The eight bytes every PNG starts with. */
export const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

/** The chunk keys this product cares about, and what each one is. */
export const CARRIER_KEYS = ['prompt', 'workflow', 'AIGC']

/** Chunk types whose payload is text this module can read. */
const TEXT_CHUNKS = new Set(['tEXt', 'zTXt', 'iTXt'])

/** The formats a caller can be told apart, so "not read" never reads as "no graph". */
export function formatOf(buffer) {
  const bytes = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || [])
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(PNG_SIGNATURE)) return 'png'
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg'
  if (bytes.length >= 12 && bytes.subarray(0, 4).toString('latin1') === 'RIFF' && bytes.subarray(8, 12).toString('latin1') === 'WEBP') return 'webp'
  return 'unknown'
}

/** `AIGC` and friends are JSON; a chunk that is not JSON is kept as text. */
function parseMaybeJson(text) {
  const trimmed = String(text || '').trim()
  if (trimmed === '') return null
  if (trimmed[0] !== '{' && trimmed[0] !== '[') return trimmed
  try {
    return JSON.parse(trimmed)
  } catch {
    return trimmed
  }
}

/**
 * Every text chunk in a PNG, in file order.
 *
 * `tEXt` is `keyword\0text` in latin-1; `iTXt` is `keyword\0flag\0method\0language\0translated\0text`
 * in UTF-8; `zTXt` is `keyword\0method\0compressed` — and the compressed form is REFUSED
 * rather than inflated, because this module has no inflater and a half-read graph is worse
 * than a named miss. Nothing is guessed from a malformed chunk: it is skipped, and the count
 * of what was skipped is part of the answer.
 */
export function readPngText(buffer, { inflate = null } = {}) {
  const bytes = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || [])
  if (formatOf(bytes) !== 'png') return { chunks: [], skipped: 0, error: 'not-a-png' }
  const chunks = []
  let skipped = 0
  let offset = PNG_SIGNATURE.length
  while (offset + 8 <= bytes.length) {
    const length = bytes.readUInt32BE(offset)
    const type = bytes.subarray(offset + 4, offset + 8).toString('latin1')
    const dataStart = offset + 8
    const dataEnd = dataStart + length
    if (length > bytes.length || dataEnd + 4 > bytes.length) break
    if (TEXT_CHUNKS.has(type)) {
      const data = bytes.subarray(dataStart, dataEnd)
      const zero = data.indexOf(0)
      if (zero < 1) {
        skipped += 1
      } else {
        const keyword = data.subarray(0, zero).toString('latin1')
        let text = null
        if (type === 'tEXt') {
          text = data.subarray(zero + 1).toString('latin1')
        } else if (type === 'iTXt') {
          // keyword\0 flag method language\0 translated\0 text
          const rest = data.subarray(zero + 1)
          const languageEnd = rest.indexOf(0, 2)
          const translatedEnd = languageEnd === -1 ? -1 : rest.indexOf(0, languageEnd + 1)
          text = translatedEnd === -1 ? null : rest.subarray(translatedEnd + 1).toString('utf8')
        } else {
          const rest = data.subarray(zero + 1)
          const method = rest.length > 0 ? rest[0] : 1
          if (typeof inflate === 'function') {
            try {
              text = inflate(rest.subarray(1)).toString('utf8')
            } catch {
              text = null
            }
          } else {
            text = null
            skipped += 1
          }
          void method
        }
        if (text === null) skipped += 1
        else chunks.push({ type, key: keyword, text })
      }
    }
    if (type === 'IEND') break
    offset = dataEnd + 4
  }
  return { chunks, skipped, error: null }
}

/** The API-format graph, summarised: how many nodes, and what they are. */
function summariseApi(prompt) {
  if (!prompt || typeof prompt !== 'object' || Array.isArray(prompt)) return null
  const ids = Object.keys(prompt)
  if (ids.length === 0) return null
  const classTypes = []
  for (const id of ids) {
    const node = prompt[id]
    const kind = node && typeof node === 'object' && typeof node.class_type === 'string' ? node.class_type : null
    if (kind !== null && !classTypes.includes(kind)) classTypes.push(kind)
  }
  return { nodes: ids.length, classTypes, ids: ids.slice(0, 200) }
}

/** The UI-format graph, summarised: the shape ComfyUI's editor rebuilds from. */
function summariseUi(workflow) {
  if (!workflow || typeof workflow !== 'object' || Array.isArray(workflow)) return null
  const nodes = Array.isArray(workflow.nodes) ? workflow.nodes.length : null
  const links = Array.isArray(workflow.links) ? workflow.links.length : null
  if (nodes === null && links === null && workflow.version === undefined) return null
  return { nodes, links, version: workflow.version === undefined ? null : String(workflow.version) }
}

/**
 * What one saved file carries.
 *
 * THE ANSWER A SURFACE DRAWS: `supported` says whether this format could be read at all,
 * `hasGraph` whether a graph is actually inside, and the three summaries are `null` when
 * their chunk is absent — never `{}` and never a guess. A file with only the `AIGC` label is
 * exactly that: provenance, no graph.
 */
export function carrierOf(buffer, { inflate = null } = {}) {
  const bytes = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || [])
  const format = formatOf(bytes)
  if (format !== 'png') {
    return {
      format,
      supported: false,
      hasGraph: false,
      keys: [],
      api: null,
      ui: null,
      provenance: null,
      skipped: 0,
      bytes: bytes.length,
    }
  }
  const read = readPngText(bytes, { inflate })
  const byKey = new Map()
  for (const chunk of read.chunks) byKey.set(chunk.key, chunk.text)
  const api = summariseApi(parseMaybeJson(byKey.get('prompt')))
  const ui = summariseUi(parseMaybeJson(byKey.get('workflow')))
  const label = parseMaybeJson(byKey.get('AIGC'))
  return {
    format,
    supported: true,
    // A GRAPH IS `prompt` OR `workflow`: the API form is what a headless run needs, the UI
    // form is what the editor rebuilds from, and a file may honestly carry one without the
    // other.
    hasGraph: api !== null || ui !== null,
    keys: read.chunks.map((chunk) => chunk.key),
    api,
    ui,
    provenance: label && typeof label === 'object' && !Array.isArray(label) ? label : label === null ? null : { raw: label },
    skipped: read.skipped,
    bytes: bytes.length,
  }
}

// ── writing: the export ──────────────────────────────────────────────────────

const CRC_TABLE = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  return table
})()

/** The CRC every PNG chunk carries, over its type and data. */
export function crc32(type, data) {
  let c = 0xffffffff
  const typeBytes = Buffer.from(String(type), 'latin1')
  for (const byte of Buffer.concat([typeBytes, data])) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

/** One `tEXt` chunk: `keyword\0text`, latin-1, with its own CRC. */
export function textChunk(key, text) {
  const data = Buffer.concat([Buffer.from(String(key), 'latin1'), Buffer.from([0]), Buffer.from(String(text), 'latin1')])
  const type = Buffer.from('tEXt', 'latin1')
  const out = Buffer.alloc(12 + data.length)
  out.writeUInt32BE(data.length, 0)
  type.copy(out, 4)
  data.copy(out, 8)
  out.writeUInt32BE(crc32('tEXt', data), 8 + data.length)
  return out
}

/**
 * Write a picture out with the graph it needs to open in a local ComfyUI.
 *
 * THE CHUNKS GO AFTER `IHDR`, which is where the tools that read them look and is a legal
 * place for any ancillary chunk. A key already in the file is REPLACED rather than
 * duplicated: two `prompt` chunks in one file would leave the reader to pick, and a picture
 * that opens with the wrong graph is worse than one that does not open.
 *
 * REFUSES A LIE: no API graph and no UI graph is `no-graph`, and a format that cannot carry
 * these chunks is `not-a-png`. Nothing is written in either case.
 */
export function exportGraphPng({ png, api, ui, provenance = null } = {}) {
  const bytes = Buffer.isBuffer(png) ? png : Buffer.from(png || [])
  if (formatOf(bytes) !== 'png') return { error: 'not-a-png', detail: 'a PNG is the only format these chunks exist in' }
  const entries = []
  if (api !== undefined && api !== null) entries.push(['prompt', typeof api === 'string' ? api : JSON.stringify(api)])
  if (ui !== undefined && ui !== null) entries.push(['workflow', typeof ui === 'string' ? ui : JSON.stringify(ui)])
  if (provenance !== undefined && provenance !== null) entries.push(['AIGC', typeof provenance === 'string' ? provenance : JSON.stringify(provenance)])
  if (entries.length === 0) return { error: 'no-graph', detail: 'there is no graph to write' }

  const replaced = new Set(entries.map(([key]) => key))
  const out = [PNG_SIGNATURE]
  let offset = PNG_SIGNATURE.length
  let inserted = false
  while (offset + 8 <= bytes.length) {
    const length = bytes.readUInt32BE(offset)
    const end = offset + 12 + length
    if (length > bytes.length || end > bytes.length) break
    const type = bytes.subarray(offset + 4, offset + 8).toString('latin1')
    const chunk = bytes.subarray(offset, end)
    const keyOfChunk = TEXT_CHUNKS.has(type) ? chunk.subarray(8, 8 + Math.max(0, chunk.indexOf(0, 8) - 8)).toString('latin1') : null
    const drop = keyOfChunk !== null && replaced.has(keyOfChunk)
    if (!drop) out.push(chunk)
    offset = end
    if (type === 'IHDR' && !inserted) {
      for (const [key, text] of entries) out.push(textChunk(key, text))
      inserted = true
    }
    if (type === 'IEND') break
  }
  if (!inserted) return { error: 'not-a-png', detail: 'no IHDR: this is not a PNG' }
  return { png: Buffer.concat(out), written: entries.map(([key]) => key) }
}
