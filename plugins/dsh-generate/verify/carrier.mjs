/**
 * verify:carrier — epic 64 S8's claims for what a picture carries, asserted rather than
 * intended.
 *
 * The claim: **a saved picture can say what made it, and a picture can be written out with
 * the graph it needs to open in a local ComfyUI.** The rules this file checks are the ones the
 * module exists for:
 *
 *   1. a PNG with `prompt` / `workflow` chunks is READ and reports its node count and class
 *      types — the same `(nodeId, class_type)` space an adapter's doors use;
 *   2. a PNG carrying only the `AIGC` provenance label reports **NO GRAPH rather than an empty
 *      one**, because an empty graph and no graph are different facts;
 *   3. a format this module cannot read says so (`supported: false`) instead of answering "no
 *      graph" — the distinction the whole module is built on, since JPEG and WebP carry the
 *      same data in EXIF and this reads PNG only;
 *   4. the export injects a graph, re-reads with the same nodes and class types, REPLACES a
 *      key already in the file instead of writing it twice, and **refuses to write a lie** —
 *      no graph, or not a PNG, writes nothing at all;
 *   5. against this machine's own files, read-only: the canvas export the founder kept carries
 *      all three chunks, and every PNG this plugin's runs saved carries the label and no graph.
 *
 * A PNG is BUILT BY HAND HERE rather than with the module's own writer: the reader is what is
 * under test, and a fixture made by the code being tested proves nothing. The chunks are real
 * bytes with real CRCs.
 *
 *   node verify/carrier.mjs
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { PNG_SIGNATURE, carrierOf, crc32, exportGraphPng, formatOf, readPngText, textChunk } from '../lib/carrier.js'

const HERE = dirname(fileURLToPath(import.meta.url))

// ── reporter (the same shape as the plugin's other suites) ───────────────────

const rows = []
const check = (label, ok, detail) => rows.push({ label, status: ok ? 'pass' : 'fail', detail: detail == null ? '' : String(detail) })
const note = (text) => rows.push({ label: text, status: 'note', detail: '' })

function finish() {
  let failed = 0
  process.stdout.write('\nverify:carrier — S8 (what a picture carries)\n')
  for (const row of rows) {
    if (row.status === 'pass') continue
    if (row.status === 'note') {
      process.stdout.write('  ....  ' + row.label + '\n')
      continue
    }
    if (row.status === 'fail') failed += 1
    process.stdout.write('  FAIL  ' + row.label + (row.detail ? '  —  ' + row.detail : '') + '\n')
  }
  const passes = rows.filter((row) => row.status === 'pass').length
  const total = rows.filter((row) => row.status !== 'note').length
  process.stdout.write('  ' + passes + '/' + total + ' passed\n')
  if (failed > 0) process.exitCode = 1
}

// ── a PNG, built here, byte by byte ──────────────────────────────────────────

/** One chunk with its own CRC, the way the format demands. */
function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  const typeBytes = Buffer.from(type, 'latin1')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(type, data), 0)
  return Buffer.concat([length, typeBytes, data, crc])
}

/** A tEXt chunk: `keyword\0text` in latin-1. */
function text(key, value) {
  return chunk('tEXt', Buffer.concat([Buffer.from(key, 'latin1'), Buffer.from([0]), Buffer.from(value, 'latin1')]))
}

/** A 1×1 PNG that carries whatever text chunks are handed to it. */
function pngOf(...texts) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(1, 0)
  ihdr.writeUInt32BE(1, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  return Buffer.concat([PNG_SIGNATURE, chunk('IHDR', ihdr), ...texts, chunk('IDAT', Buffer.from([0x78, 0x9c, 0x03, 0x00, 0x00, 0x00, 0x00, 0x01])), chunk('IEND', Buffer.alloc(0))])
}

const API_GRAPH = {
  1: { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: 'krea2.safetensors' } },
  2: { class_type: 'CLIPTextEncode', inputs: { text: 'a candid 35mm photograph', clip: ['1', 1] } },
  3: { class_type: 'KSampler', inputs: { seed: 12, steps: 40, cfg: 1 } },
  4: { class_type: 'KSampler', inputs: { seed: 13, steps: 40, cfg: 1 } },
  5: { class_type: 'VAEDecode', inputs: { samples: ['3', 0] } },
}
const UI_GRAPH = { version: 0.4, nodes: [{ id: 1 }, { id: 2 }, { id: 3 }], links: [[1, 2, 0, 3, 0, 'IMAGE']], groups: [] }
const AIGC = { Label: '1', ContentProducer: '001191340100MAEB4N8H7600000', ProduceID: 'abc_20260925_3aa097', PropagateID: 'RH_2103307843358998530_20260925_3aa097' }

// ── 1. a picture that carries a graph ────────────────────────────────────────

{
  const withGraph = pngOf(text('prompt', JSON.stringify(API_GRAPH)), text('workflow', JSON.stringify(UI_GRAPH)), text('AIGC', JSON.stringify(AIGC)))
  const read = carrierOf(withGraph)
  check('the format is read from the bytes, not from a file name', formatOf(withGraph) === 'png', formatOf(withGraph))
  check(
    'a PNG with a `prompt` chunk reports its node count',
    read.supported === true && read.hasGraph === true && read.api && read.api.nodes === 5,
    JSON.stringify({ supported: read.supported, hasGraph: read.hasGraph, api: read.api && read.api.nodes }),
  )
  check(
    'and the class types those nodes are, which is the space an adapter door lives in',
    read.api.classTypes.includes('KSampler') && read.api.classTypes.includes('CLIPTextEncode') && read.api.classTypes.length === 4 && read.api.ids.length === 5,
    JSON.stringify(read.api.classTypes),
  )
  check(
    'the UI graph is summarised too: nodes, links and the version ComfyUI wrote',
    read.ui && read.ui.nodes === 3 && read.ui.links === 1 && read.ui.version === '0.4',
    JSON.stringify(read.ui),
  )
  check(
    'and the provenance label is read as its own thing',
    read.provenance && read.provenance.ContentProducer === AIGC.ContentProducer && read.provenance.ProduceID === AIGC.ProduceID,
    JSON.stringify(read.provenance),
  )
  check('every key it found is named', JSON.stringify(read.keys) === JSON.stringify(['prompt', 'workflow', 'AIGC']), JSON.stringify(read.keys))
}

// ── 2. a label is not a graph ────────────────────────────────────────────────

{
  const labelOnly = pngOf(text('AIGC', JSON.stringify(AIGC)))
  const read = carrierOf(labelOnly)
  check(
    'a PNG carrying only the AIGC label reports NO GRAPH, not an empty one',
    read.supported === true && read.hasGraph === false && read.api === null && read.ui === null,
    JSON.stringify({ hasGraph: read.hasGraph, api: read.api, ui: read.ui }),
  )
  check('and it still reports the label it does carry', read.provenance && read.provenance.PropagateID === AIGC.PropagateID, JSON.stringify(read.provenance))
  const bare = carrierOf(pngOf())
  check(
    'a PNG with no text chunks at all is the same answer, with nothing named',
    bare.hasGraph === false && bare.keys.length === 0 && bare.provenance === null,
    JSON.stringify({ keys: bare.keys, provenance: bare.provenance }),
  )
}

// ── 3. a format that cannot be read says so ──────────────────────────────────

{
  const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64)])
  const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(16)])
  const readJpeg = carrierOf(jpeg)
  const readWebp = carrierOf(webp)
  check('a JPEG is recognised as a JPEG', readJpeg.format === 'jpeg', readJpeg.format)
  check(
    'and it says NOT READ rather than no graph, because EXIF is a reader this does not have',
    readJpeg.supported === false && readJpeg.hasGraph === false && readJpeg.api === null,
    JSON.stringify({ supported: readJpeg.supported, hasGraph: readJpeg.hasGraph }),
  )
  check('a WebP is its own answer too', readWebp.format === 'webp' && readWebp.supported === false, JSON.stringify({ format: readWebp.format, supported: readWebp.supported }))
  check('and something that is not a picture is unknown rather than guessed at', formatOf(Buffer.from('not a picture')) === 'unknown', formatOf(Buffer.from('not a picture')))
  check(
    'reading text chunks out of a non-PNG is a named refusal, not an empty read',
    readPngText(jpeg).error === 'not-a-png' && readPngText(jpeg).chunks.length === 0,
    JSON.stringify(readPngText(jpeg)),
  )
}

// ── 4. the export ────────────────────────────────────────────────────────────

{
  const plain = pngOf(text('AIGC', JSON.stringify(AIGC)))
  const written = exportGraphPng({ png: plain, api: API_GRAPH, ui: UI_GRAPH })
  check('an export writes the two graph chunks', !written.error && JSON.stringify(written.written) === JSON.stringify(['prompt', 'workflow']), JSON.stringify({ error: written.error, written: written.written }))
  const reread = carrierOf(written.png)
  check(
    'and the file re-reads with the same graph: the export did not corrupt what it wrote',
    reread.hasGraph && reread.api.nodes === 5 && reread.ui.nodes === 3 && reread.api.classTypes.includes('KSampler'),
    JSON.stringify({ api: reread.api && reread.api.nodes, ui: reread.ui && reread.ui.nodes }),
  )
  check(
    'the label the file already carried is still there, untouched',
    reread.provenance && reread.provenance.ContentProducer === AIGC.ContentProducer,
    JSON.stringify(reread.provenance),
  )
  check('and the picture itself is still a PNG a reader can walk', reread.format === 'png' && reread.bytes > plain.length, reread.bytes + ' bytes')

  // An existing key is REPLACED, never duplicated: two `prompt` chunks would leave the reader
  // to pick, and a picture that opens with the wrong graph is worse than one that does not open.
  const twice = exportGraphPng({ png: written.png, api: { 9: { class_type: 'OnlyNode', inputs: {} } } })
  const final = carrierOf(twice.png)
  check(
    'writing over a key the file already has REPLACES it rather than duplicating it',
    final.keys.filter((key) => key === 'prompt').length === 1 && final.api.nodes === 1 && final.ui.nodes === 3,
    JSON.stringify({ keys: final.keys, api: final.api && final.api.nodes }),
  )

  const lie = exportGraphPng({ png: plain })
  check(
    'an export with no graph to write refuses instead of writing a picture that lies',
    lie.error === 'no-graph' && lie.png === undefined,
    JSON.stringify(lie),
  )
  const wrongFormat = exportGraphPng({ png: Buffer.from([0xff, 0xd8, 0xff, 0xe0]), api: API_GRAPH })
  check('and an export into a format that cannot carry these chunks refuses too', wrongFormat.error === 'not-a-png', JSON.stringify(wrongFormat))
}

// ── 5. the chunk writer is the format's own ──────────────────────────────────

{
  const made = textChunk('AIGC', JSON.stringify(AIGC))
  const read = readPngText(Buffer.concat([PNG_SIGNATURE, chunk('IHDR', (() => { const h = Buffer.alloc(13); h[8] = 8; h[9] = 2; return h })()), made, chunk('IEND', Buffer.alloc(0))]))
  check(
    'a chunk this module writes is a chunk it can read back',
    read.chunks.length === 1 && read.chunks[0].key === 'AIGC' && read.chunks[0].text === JSON.stringify(AIGC),
    JSON.stringify(read.chunks.map((c) => ({ key: c.key, len: c.text.length }))),
  )
}

// ── 6. this machine's own files (read-only) ──────────────────────────────────

{
  const canvas = join(homedir(), 'Desktop', 'hmu banner', 'ComfyUI_00002_jozuk_1787494436.png')
  if (!existsSync(canvas)) {
    note('no canvas export on this machine: the live read is skipped')
  } else {
    const read = carrierOf(readFileSync(canvas))
    check(
      'the canvas export the founder kept carries a graph, and it is read off the real bytes',
      read.supported && read.hasGraph && read.api.nodes > 10 && read.ui.nodes > 10 && read.ui.links > 10,
      JSON.stringify({ api: read.api && read.api.nodes, ui: read.ui && read.ui.nodes, links: read.ui && read.ui.links, version: read.ui && read.ui.version }),
    )
    check(
      'and the node ids the graph is keyed by are the ids an adapter door names',
      read.api.ids.every((id) => /^\d+$/.test(String(id))) && read.api.classTypes.length > 0,
      JSON.stringify(read.api.classTypes.slice(0, 6)),
    )
    check(
      'and it carries the provenance label beside the graph',
      !!read.provenance && Object.keys(read.provenance).includes('ContentProducer'),
      JSON.stringify(read.provenance && Object.keys(read.provenance)),
    )
  }

  const library = join(homedir(), 'Desktop', 'runninghub')
  if (!existsSync(library)) {
    note('no saved-run folder on this machine: the library read is skipped')
  } else {
    const carriers = []
    for (const workflow of readdirSync(library)) {
      const dir = join(library, workflow)
      if (!statSync(dir).isDirectory()) continue
      for (const name of readdirSync(dir).filter((entry) => entry.endsWith('.png'))) carriers.push(carrierOf(readFileSync(join(dir, name))))
    }
    check(
      "every PNG this plugin's own runs saved carries the label and NO graph",
      carriers.length > 0 && carriers.every((read) => read.hasGraph === false && read.keys.includes('AIGC')),
      carriers.length + ' files, ' + carriers.filter((read) => read.hasGraph).length + ' with a graph, ' + carriers.filter((read) => !read.keys.includes('AIGC')).length + ' without the label',
    )
    check(
      'which is why the export exists: the picture has the pixels and the label, and the graph comes from the app that ran it',
      carriers.length > 0 && carriers.every((read) => read.provenance === null || typeof read.provenance.PropagateID === 'string'),
      JSON.stringify(carriers[0] && carriers[0].provenance && carriers[0].provenance.PropagateID),
    )
  }
}

finish()

void HERE
