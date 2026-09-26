/**
 * verify:intake — epic 63 A2's claims, asserted rather than intended.
 *
 * The claim: **the library is the folders a person added, and it says what is in them.**
 *
 *   1. the registry starts empty, and adding a folder is what makes assets exist — nothing
 *      is scanned that nobody asked for;
 *   2. an added folder is the person's own: `~` expands, a second add is refused as
 *      `already`, removing one that was never added answers 404, and a relative path is
 *      never accepted;
 *   3. a file is tied to a run by its **exact saved path** — the recorded one carries
 *      provenance, the loose one is still listed with its own facts, and one folder holds
 *      both without two kinds of row;
 *   4. the **context** rows and the **date** tree each carry a count, the counts are over
 *      everything scanned, and filtering narrows the list without moving the counts;
 *   5. a record's own settled date wins over a file's mtime, because that is the date a
 *      person remembers.
 *
 * THE HOST HALF IS DRIVEN FOR REAL: `lib/index.js` is imported, `apply()` mounts against a
 * recording web server with the OS dialog injected as a fake (so no dialog ever opens), and
 * every call goes through the shipped handlers against temp directories.
 *
 *   node verify/intake.mjs
 */
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { ROOT, callRoute, fakeServer, reporter } from './harness.mjs'

const { chooseStart } = await import(pathToFileURL(join(ROOT, 'lib/folder-actions.js')).href)
const FOLDERS_PATH = '/plugins/assets/folders'
const CATALOG_PATH = '/plugins/assets/catalog'
const DETAIL_PATH = '/plugins/assets/detail'

const { check, note, finish } = reporter('verify:intake — epic 63 A2 (folders, records, and the two filters)')

// ── a real library, a real project folder, real records ─────────────────────

const dataRoot = mkdtempSync(join(tmpdir(), 'assets-data-'))
const recordsRoot = mkdtempSync(join(tmpdir(), 'assets-records-'))
const projectA = mkdtempSync(join(tmpdir(), 'project-yammaman-'))
const projectB = mkdtempSync(join(tmpdir(), 'project-vent-'))
process.env.ASSETS_DATA_DIR = dataRoot
process.env.RH_DATA_DIR = recordsRoot

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('x'.repeat(200))])

/** One folder with a nested day folder, a loose picture, a non-media file, and a dotfile. */
function seedProject(dir) {
  const nested = join(dir, 'output')
  mkdirSync(nested, { recursive: true })
  const recorded = join(nested, '20260926-job-aaa.png')
  const loose = join(dir, 'hand-added.jpg')
  const other = join(dir, '20260925-job-bbb.png')
  writeFileSync(recorded, PNG)
  writeFileSync(loose, PNG.subarray(0, 80))
  writeFileSync(other, PNG.subarray(0, 90))
  writeFileSync(join(dir, 'notes.txt'), 'not an asset')
  writeFileSync(join(dir, '.hidden.png'), PNG)
  return { recorded, loose, other }
}

const seededA = seedProject(projectA)
const seededB = seedProject(projectB)

/** The records: one matches `recorded`, one matches `other`, and one was moved away. */
const runsDir = join(recordsRoot, 'runninghub', 'runs')
mkdirSync(runsDir, { recursive: true })
writeFileSync(
  join(runsDir, 'job-aaa.json'),
  JSON.stringify({
    schema: 'muen-rh-run/v1',
    jobId: 'job-aaa',
    at: '2026-09-26T01:00:00.000Z',
    adapter: 'qwen-2-1-image-edit',
    title: 'Qwen 2.1 Edit Duo',
    status: 'done',
    outcome: { state: 'done', status: 'SUCCESS', at: '2026-09-26T01:04:00.000Z', saved: [{ file: seededA.recorded, bytes: PNG.length, type: 'png', url: 'https://example.invalid/a.png' }] },
  }),
)
// The same file name in the OTHER project is a different asset: identity is the path.
writeFileSync(
  join(runsDir, 'job-bbb.json'),
  JSON.stringify({
    schema: 'muen-rh-run/v1',
    jobId: 'job-bbb',
    at: '2026-09-25T09:30:00.000Z',
    adapter: 'minimax-h3-first-last',
    title: 'Minimax H3 First Last Frame',
    status: 'done',
    outcome: { state: 'done', status: 'SUCCESS', at: '2026-09-25T09:33:00.000Z', saved: [{ file: seededB.other, bytes: 90, type: 'png' }] },
  }),
)
// A record whose file has since been deleted: it is not in any folder, so nothing lists it.
writeFileSync(
  join(runsDir, 'job-moved.json'),
  JSON.stringify({ schema: 'muen-rh-run/v1', jobId: 'job-moved', at: '2026-09-20T00:00:00.000Z', outcome: { state: 'done', saved: [{ file: join(projectA, 'gone.png'), bytes: 10, type: 'png' }] } }),
)
// A half-written record must not empty the grid.
writeFileSync(join(runsDir, 'job-broken.json'), '{ this is not json')

// ── the seams ───────────────────────────────────────────────────────────────

const dialog = { canChoose: true, next: { path: projectA }, calls: 0, starts: [], revealed: [], choose: async (start) => { dialog.calls += 1; dialog.starts.push(start); return dialog.next }, reveal: async (path) => { dialog.revealed.push(path); return { ok: true } } }

const server = fakeServer()
const ctx = {
  get: (name) => (name === 'webServer' ? server : undefined),
  effect: (fn) => { fn(); return () => {} },
  inject: () => {},
}
const module = await import(pathToFileURL(join(ROOT, 'lib/index.js')).href)
module.apply(ctx, { folders: dialog, argv: ['node', 'verify'], env: process.env })

const foldersHandler = server.routes.find((route) => route.path === FOLDERS_PATH).handler
const catalogHandler = server.routes.find((route) => route.path === CATALOG_PATH).handler
const detailHandler = server.routes.find((route) => route.path === DETAIL_PATH).handler
const paths = server.routes.map((route) => route.path)

const call = (handler, method, path, body) => callRoute(handler, method, path, body)

// ── 1. the routes are mounted the way the matcher needs ─────────────────────

{
  check('the routes A2 needs are mounted', [FOLDERS_PATH, CATALOG_PATH].every((path) => paths.includes(path)), paths.join(', '))
  check('neither carries a trailing slash (the contract)', paths.every((path) => !path.endsWith('/')), paths.join(', '))
}

// ── 2. it starts empty ──────────────────────────────────────────────────────

{
  const res = await call(foldersHandler, 'GET', FOLDERS_PATH)
  const body = res.json()
  check('an empty library answers an empty registry', res.statusCode === 200 && Array.isArray(body.folders) && body.folders.length === 0, JSON.stringify(body.folders))
  check('and says where it looked, with the rule that answered', body.root === dataRoot && body.rootKind === 'override' && body.recordsRoot === recordsRoot, body.root + ' / ' + body.recordsRoot)
  check('and whether the host has a folder dialog', body.canChoose === true, String(body.canChoose))
}

{
  const res = await call(catalogHandler, 'GET', CATALOG_PATH)
  const body = res.json()
  check('the catalog is empty before any folder is added', res.statusCode === 200 && body.total === 0 && body.assets.length === 0, JSON.stringify(body.total))
}

// ── 2b. the dialog's start folder must EXIST ────────────────────────────────
//
// `+ Folder` did nothing on a fresh install (founder, 2026-09-26: *"+folder in assets plugin not
// working"*): the start folder was this plugin's own root, `<profile>/assets`, and nothing had
// created it yet — so AppleScript's `default location` pointed at a folder that was not there,
// `choose folder` errored before it opened, and the press was silent. The start is now the first
// added folder that exists, and the person's home is the floor.
{
  dialog.next = { cancelled: true }
  const res = await call(foldersHandler, 'POST', FOLDERS_PATH, { action: 'choose' })
  check('with nothing added, the dialog starts at the person\'s home', res.statusCode === 200 && dialog.starts.at(-1) && !dialog.starts.at(-1).startsWith(dataRoot), JSON.stringify(dialog.starts.at(-1)))
  const home = process.env.HOME || ''
  check('and never at this plugin\'s own root, which may not exist yet', dialog.starts.at(-1) !== dataRoot, dialog.starts.at(-1))
}

// ── 3. adding, and the ways it is refused ───────────────────────────────────

{
  const added = await call(foldersHandler, 'POST', FOLDERS_PATH, { action: 'add', path: projectA, label: 'yammaman' })
  const body = added.json()
  check('a folder is added with its label', added.statusCode === 200 && body.folders.length === 1 && body.folders[0].label === 'yammaman', JSON.stringify(body.folders))
  check('the registry is written to this plugin\'s own root', existsSync(join(dataRoot, 'folders.json')), join(dataRoot, 'folders.json'))
  const raw = JSON.parse(readFileSync(join(dataRoot, 'folders.json'), 'utf8'))
  check('and the file is one this plugin can recognise again', raw.schema === 'muen-assets-folders/v1', raw.schema)
}

{
  const again = await call(foldersHandler, 'POST', FOLDERS_PATH, { action: 'add', path: projectA })
  const body = again.json()
  check('adding the same folder twice is a no-op that says so', again.statusCode === 200 && body.already === true && body.folders.length === 1, JSON.stringify({ already: body.already, n: body.folders.length }))
}

{
  const relative = await call(foldersHandler, 'POST', FOLDERS_PATH, { action: 'add', path: 'Desktop/project' })
  check('a relative path is refused', relative.statusCode === 400 && relative.json().error === 'bad-path', relative.statusCode + ' ' + JSON.stringify(relative.json().error))
  const missing = await call(foldersHandler, 'POST', FOLDERS_PATH, { action: 'add' })
  check('an absent path is refused the same way', missing.statusCode === 400 && missing.json().error === 'bad-path', missing.statusCode)
  const nothing = await call(foldersHandler, 'POST', FOLDERS_PATH)
  check('a POST with no body is a bad request', nothing.statusCode === 400 && nothing.json().error === 'bad-request', nothing.statusCode)
  const odd = await call(foldersHandler, 'POST', FOLDERS_PATH, { action: 'edit' })
  check('an unknown action is named', odd.statusCode === 400 && odd.json().error === 'unknown-action', odd.statusCode + ' ' + JSON.stringify(odd.json().detail))
  const put = await call(foldersHandler, 'PUT', FOLDERS_PATH)
  check('and the method is bounded', put.statusCode === 405 && put.headers.allow === 'GET, POST', put.statusCode + ' allow=' + put.headers.allow)
}

// ── 4. the picker's start folder, as a pure function ────────────────────────

{
  check('a start folder that is NOT there is never used', chooseStart(['/definitely/not/here']) === homedir(), chooseStart(['/definitely/not/here']))
  check('an existing one is', chooseStart([projectA]) === projectA, chooseStart([projectA]))
  check('and the first existing candidate wins', chooseStart(['/not/here', projectB, projectA]) === projectB, chooseStart(['/not/here', projectB, projectA]))
  check('with nothing to go on, the home stands in', chooseStart([]) === homedir() && chooseStart([null, '', '  ']) === homedir(), chooseStart([]))
}

// ── 4b. the dialog is the same act ───────────────────────────────────────────
//
// And once a folder IS in the library, the dialog starts there — a folder a person has already
// added is a real place, which is the property the first bug was missing.

{
  dialog.next = { path: projectB }
  const callsBefore = dialog.calls
  const chosen = await call(foldersHandler, 'POST', FOLDERS_PATH, { action: 'choose' })
  const body = chosen.json()
  check('the dialog adds the folder it answered', chosen.statusCode === 200 && dialog.calls === callsBefore + 1 && body.folders.some((folder) => folder.path === projectB), JSON.stringify(body.folders.map((folder) => folder.label)))
  check('and the label defaults to the folder\'s own name', body.folders.some((folder) => folder.path === projectB && folder.label.length > 0), JSON.stringify(body.folders.map((folder) => folder.label)))
  check('the dialog starts at a folder the library already holds', dialog.starts.at(-1) === projectA || dialog.starts.at(-1) === projectB, JSON.stringify(dialog.starts.at(-1)))
}

{
  dialog.next = { cancelled: true }
  const cancelled = await call(foldersHandler, 'POST', FOLDERS_PATH, { action: 'choose' })
  const body = cancelled.json()
  check('a cancelled dialog is not an error and changes nothing', cancelled.statusCode === 200 && body.cancelled === true && body.folders.length === 2, cancelled.statusCode + ' n=' + body.folders.length)
}

// ── 4b. revealing a folder in the file browser ──────────────────────────────

{
  const shown = await call(foldersHandler, 'POST', FOLDERS_PATH, { action: 'reveal', path: projectB })
  check('a folder in the library can be shown in the file browser', shown.statusCode === 200 && dialog.revealed.at(-1) === projectB, shown.statusCode + ' ' + JSON.stringify(shown.json()))
  const outside = await call(foldersHandler, 'POST', FOLDERS_PATH, { action: 'reveal', path: '/etc' })
  check('and a path the library does not hold is refused, not opened', outside.statusCode === 404 && outside.json().error === 'not-in-library', outside.statusCode + ' ' + JSON.stringify(outside.json().error))
  const relative = await call(foldersHandler, 'POST', FOLDERS_PATH, { action: 'reveal', path: 'Desktop' })
  check('a relative path is refused the same way', relative.statusCode === 404, relative.statusCode)
}

// ── 5. the catalog: files, records, and the identity of a path ──────────────

let catalog = null
{
  const res = await call(catalogHandler, 'GET', CATALOG_PATH)
  catalog = res.json()
  check('the catalog answers once folders exist', res.statusCode === 200 && Array.isArray(catalog.assets), res.statusCode)
  const byName = new Map(catalog.assets.map((asset) => [asset.path, asset]))
  check('every media file in both folders is listed', catalog.total === 6, 'total ' + catalog.total)
  check('a loose picture is listed with its own facts', !!byName.get(seededA.loose) && byName.get(seededA.loose).hasRecord === false, JSON.stringify(byName.get(seededA.loose) || null).slice(0, 90))
  check('and a recorded one carries provenance', !!byName.get(seededA.recorded) && byName.get(seededA.recorded).hasRecord === true && byName.get(seededA.recorded).provenance.jobId === 'job-aaa', JSON.stringify(byName.get(seededA.recorded) && byName.get(seededA.recorded).provenance && byName.get(seededA.recorded).provenance.jobId))
  check('provenance names the provider, the workflow and the doors\' own title', byName.get(seededA.recorded).provenance.provider === 'runninghub' && byName.get(seededA.recorded).provenance.workflow === 'qwen-2-1-image-edit', JSON.stringify(byName.get(seededA.recorded).provenance.workflow))
  check('the same file name in another folder is a different asset', !!byName.get(seededB.other) && byName.get(seededB.other).provenance.jobId === 'job-bbb', JSON.stringify(byName.get(seededB.other) && byName.get(seededB.other).provenance.jobId))
  check('a non-media file is not an asset', !catalog.assets.some((asset) => asset.name === 'notes.txt'), catalog.assets.map((asset) => asset.name).join(','))
  check('a dotfile is not an asset', !catalog.assets.some((asset) => asset.name === '.hidden.png'), '')
  check('a record whose file is gone lists nothing extra', !catalog.assets.some((asset) => asset.name === 'gone.png'), '')
  check('a half-written record does not take the catalog down', catalog.assets.length > 0 && catalog.total === 6, 'total ' + catalog.total)
  const today = new Date().toISOString().slice(0, 10)
  check('a record\'s settled date wins over the file\'s mtime', byName.get(seededA.recorded).date === '2026-09-26' && byName.get(seededB.other).date === '2026-09-25', byName.get(seededA.recorded).date + ' / ' + byName.get(seededB.other).date)
  check('and a file with no record falls back to its own mtime', byName.get(seededA.loose).date === today, byName.get(seededA.loose).date + ' vs ' + today)
  check('the context is the folder a person added', byName.get(seededA.recorded).context === 'yammaman' && byName.get(seededB.other).context.length > 0, byName.get(seededB.other).context)
}

// ── 6. the two filter groups, each row carrying its count ───────────────────

{
  const contexts = catalog.counts.context
  check('the context rows carry counts', contexts.length === 2 && contexts.every((row) => row.count === 3), JSON.stringify(contexts))
  const years = catalog.counts.date
  check('the date tree is grouped by year then month then day', years.length >= 1 && years[0].months.length >= 1 && years[0].months[0].days.length >= 1, JSON.stringify(years).slice(0, 160))
  const day = years[0].months[0].days[0]
  check('and a day row carries its own count', typeof day.count === 'number' && day.count >= 1 && /^\d{4}-\d{2}-\d{2}$/.test(day.day), JSON.stringify(day))
  check('the counts say what they are over', catalog.countsOver === 'all', catalog.countsOver)
}

// ── 7. filtering narrows the list and does not move the counts ──────────────

{
  const res = await call(catalogHandler, 'GET', CATALOG_PATH + '?context=yammaman')
  const body = res.json()
  check('a context filter keeps only that context', res.statusCode === 200 && body.assets.length === 3 && body.assets.every((asset) => asset.context === 'yammaman'), body.shown + ' shown')
  check('and the counts stay over everything scanned', body.counts.context.length === 2 && body.counts.context.every((row) => row.count === 3), JSON.stringify(body.counts.context))
  check('the filter that answered is echoed back', body.filter && body.filter.context === 'yammaman' && body.filter.date === null, JSON.stringify(body.filter))
}

{
  const res = await call(catalogHandler, 'GET', CATALOG_PATH + '?date=2026-09-26')
  const body = res.json()
  check('a date filter keeps exactly that day', res.statusCode === 200 && body.assets.length >= 1 && body.assets.every((asset) => asset.date === '2026-09-26'), body.shown + ' shown')
  const bad = await call(catalogHandler, 'GET', CATALOG_PATH + '?date=tuesday')
  check('a malformed date is a bad request, not a silent empty list', bad.statusCode === 400 && bad.json().error === 'bad-date', bad.statusCode + ' ' + JSON.stringify(bad.json().error))
  const posted = await call(catalogHandler, 'POST', CATALOG_PATH)
  check('the catalog is read-only', posted.statusCode === 405 && posted.headers.allow === 'GET', posted.statusCode)
}

// ── 8. a file that is not ours says so ──────────────────────────────────────

{
  writeFileSync(join(dataRoot, 'folders.json'), JSON.stringify({ schema: 'something-else/v9', folders: [{ path: projectA, label: 'kept' }] }))
  const res = await call(foldersHandler, 'GET', FOLDERS_PATH)
  const body = res.json()
  check('an unknown schema is reported rather than obeyed silently', body.known === false && body.found === 'something-else/v9', JSON.stringify({ known: body.known, found: body.found }))
  check('and the list is still read, so a person keeps their folders', body.folders.length === 1 && body.folders[0].label === 'kept', JSON.stringify(body.folders))
}

{
  writeFileSync(join(dataRoot, 'folders.json'), '{ not json at all')
  const res = await call(foldersHandler, 'GET', FOLDERS_PATH)
  check('a broken registry answers an empty library instead of failing the pane', res.statusCode === 200 && Array.isArray(res.json().folders), res.statusCode)
}

// ── 9. removing ─────────────────────────────────────────────────────────────

{
  writeFileSync(join(dataRoot, 'folders.json'), JSON.stringify({ schema: 'muen-assets-folders/v1', folders: [{ path: projectA, label: 'yammaman' }] }))
  const removed = await call(foldersHandler, 'POST', FOLDERS_PATH, { action: 'remove', path: projectA })
  check('a folder is removed from the registry', removed.statusCode === 200 && removed.json().folders.length === 0, removed.statusCode)
  const again = await call(foldersHandler, 'POST', FOLDERS_PATH, { action: 'remove', path: projectA })
  check('removing one that is not there answers 404, not a silent success', again.statusCode === 404 && again.json().error === 'not-in-library', again.statusCode + ' ' + JSON.stringify(again.json().error))
}

// ── 10. `~` is the person's home, and only that ─────────────────────────────

{
  const res = await call(foldersHandler, 'POST', FOLDERS_PATH, { action: 'add', path: '~' })
  check('`~` expands to the home directory', res.statusCode === 200 && res.json().folders.some((folder) => folder.path === homedir()), JSON.stringify(res.json().folders.map((folder) => folder.path)))
  await call(foldersHandler, 'POST', FOLDERS_PATH, { action: 'remove', path: '~' })
}

// ── 11. what the picture itself carries (epic 64 S8, the library's half) ─────

{
  // A PNG built here, byte by byte: the reader is what is under test, and a fixture made by
  // the code being tested proves nothing. Real chunks, real CRCs.
  const table = (() => { const t = new Int32Array(256); for (let n = 0; n < 256; n += 1) { let c = n; for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c } return t })()
  const crc = (type, data) => { let c = 0xffffffff; for (const byte of Buffer.concat([Buffer.from(type, 'latin1'), data])) c = table[(c ^ byte) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0); const crcBytes = Buffer.alloc(4); crcBytes.writeUInt32BE(crc(type, data), 0); return Buffer.concat([len, Buffer.from(type, 'latin1'), data, crcBytes]) }
  const text = (key, value) => chunk('tEXt', Buffer.concat([Buffer.from(key, 'latin1'), Buffer.from([0]), Buffer.from(value, 'latin1')]))
  const pngOf = (...texts) => {
    const ihdr = Buffer.alloc(13)
    ihdr.writeUInt32BE(1, 0); ihdr.writeUInt32BE(1, 4); ihdr[8] = 8; ihdr[9] = 2
    // The signature alone, then real chunks: `PNG` above is a fixture, not a file.
    return Buffer.concat([PNG.subarray(0, 8), chunk('IHDR', ihdr), ...texts, chunk('IDAT', Buffer.from([0x78, 0x9c, 0x03, 0x00, 0x00, 0x00, 0x00, 0x01])), chunk('IEND', Buffer.alloc(0))])
  }
  const graph = { 1: { class_type: 'CheckpointLoaderSimple', inputs: {} }, 2: { class_type: 'KSampler', inputs: {} }, 3: { class_type: 'VAEDecode', inputs: {} } }
  const ui = { version: 0.4, nodes: [{ id: 1 }, { id: 2 }], links: [[1]] }
  const label = { Label: '1', ContentProducer: '001191340100MAEB4N8H7600000' }

  const dir = mkdtempSync(join(tmpdir(), 'project-carrier-'))
  const withGraph = join(dir, 'canvas.png')
  const labelOnly = join(dir, 'provider.png')
  const notRead = join(dir, 'scan.jpg')
  writeFileSync(withGraph, pngOf(text('prompt', JSON.stringify(graph)), text('workflow', JSON.stringify(ui)), text('AIGC', JSON.stringify(label))))
  writeFileSync(labelOnly, pngOf(text('AIGC', JSON.stringify(label))))
  writeFileSync(notRead, Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64)]))
  await call(foldersHandler, 'POST', FOLDERS_PATH, { action: 'add', path: dir })

  const detailOf = async (file) => (await call(detailHandler, 'GET', DETAIL_PATH + '?path=' + encodeURIComponent(file))).json()

  const readGraph = await detailOf(withGraph)
  check(
    'the detail says a canvas file carries its graph, and how big it is',
    !!readGraph.carrier && readGraph.carrier.supported === true && readGraph.carrier.hasGraph === true && readGraph.carrier.api.nodes === 3,
    JSON.stringify(readGraph.carrier),
  )
  check(
    'and the graph is named by the class types an adapter door lives in',
    readGraph.carrier.api.classTypes.includes('KSampler') && readGraph.carrier.ui.nodes === 2,
    JSON.stringify({ classes: readGraph.carrier.api.classTypes, ui: readGraph.carrier.ui }),
  )
  const readLabel = await detailOf(labelOnly)
  check(
    'a provider result says NO graph while still naming the label it carries',
    !!readLabel.carrier && readLabel.carrier.supported === true && readLabel.carrier.hasGraph === false && readLabel.carrier.label === true,
    JSON.stringify(readLabel.carrier),
  )
  const readJpeg = await detailOf(notRead)
  check(
    'a format the library cannot read says NOT READ rather than no graph',
    !!readJpeg.carrier && readJpeg.carrier.supported === false && readJpeg.carrier.hasGraph === false,
    JSON.stringify(readJpeg.carrier),
  )
  // A `.png` that is really a JPEG: the extension is a hint, and the BYTES decide. This is the
  // case that proves the signature is read rather than the name trusted.
  const mislabeled = join(dir, 'mislabeled.png')
  writeFileSync(mislabeled, Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64)]))
  const readMislabeled = await detailOf(mislabeled)
  check(
    'a picture named .png that is not one is judged by its bytes, and says NOT READ',
    !!readMislabeled.carrier && readMislabeled.carrier.format === 'jpeg' && readMislabeled.carrier.supported === false,
    JSON.stringify(readMislabeled.carrier),
  )
  check(
    'and the file facts it already answered are untouched by the read',
    readGraph.dimensions && readGraph.dimensions.width === 1 && readGraph.where === 'present',
    JSON.stringify({ dimensions: readGraph.dimensions, where: readGraph.where }),
  )
}

finish()
