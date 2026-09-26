/**
 * verify:preview — epic 64 S9's claims, asserted rather than intended.
 *
 * The claim: **the grid never reads an original to draw a tile**, and nothing about that
 * promise can quietly break the picture.
 *
 *   1. the preview is named by the original's identity — path, mtime, size, width — so a
 *      picture replaced in place gets a new preview and the same ask twice reads one file;
 *   2. it is made ONCE: the second ask answers `cached: true` and the resizer is not run
 *      again (the injected resizer counts its own calls, which is how that is provable);
 *   3. EVERY FALLBACK SERVES THE PICTURE: a host without a resizer, a video, a width out of
 *      range and a failed resize all answer the original rather than an error a grid cannot
 *      draw — except a width out of range, which is a caller's mistake and says so;
 *   4. containment still holds with a width on it, and the answer says which one it is
 *      (`X-Assets-Preview`), because "why is this grid slow" should be answerable;
 *   5. a failed resize leaves no half-written file wearing the real name.
 *
 *   node verify/preview.mjs
 */
import { mkdtempSync, readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { ROOT, callRoute, fakeServer, reporter, waitForEnd } from './harness.mjs'

const { check, finish } = reporter('verify:preview — epic 64 S9 (the grid stops reading originals)')
const { canPreview, isResizable, previewFor, previewName } = await import(pathToFileURL(join(ROOT, 'lib/preview.js')).href)

// ── 1. the name is the original's identity ─────────────────────────────────

{
  const base = { path: '/lib/a.png', mtimeMs: 1000, size: 500, width: 320 }
  const name = previewName(base)
  check('a preview is named by a hash, not by the picture', !name.includes('a.png') && /^[0-9a-f]{40}\.jpg$/.test(name), name)
  check('the same file at the same width is the same name', previewName(base) === name, '')
  check('a picture replaced in place gets a new preview', previewName({ ...base, mtimeMs: 1001 }) !== name, '')
  check('a resized original gets a new preview', previewName({ ...base, size: 501 }) !== name, '')
  check('and a different width is a different file', previewName({ ...base, width: 640 }) !== name, '')
  check('two different pictures never collide', previewName({ ...base, path: '/lib/b.png' }) !== name, '')
}

// ── 2. what a host can do ──────────────────────────────────────────────────

{
  check('macOS can make previews', canPreview('darwin') === true, String(canPreview('darwin')))
  check('a host with no resizer says so', canPreview('linux') === false && canPreview('win32') === false, String(canPreview('linux')))
  check('pictures are resizable', isResizable('png') && isResizable('JPG') && isResizable('heic'), '')
  check('a video is not — a frame is a decode, not a resize', isResizable('mp4') === false && isResizable('mov') === false, '')
}

// ── 3. made once, and every fallback ───────────────────────────────────────

const cacheDir = mkdtempSync(join(tmpdir(), 'assets-proxies-'))
const sourceDir = mkdtempSync(join(tmpdir(), 'assets-source-'))
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(5000, 3)])
/** The mtime a preview's name is keyed on, read exactly as the module reads it. */
const mtimeOf = (path) => statSync(path).mtimeMs

const picture = join(sourceDir, 'picture.png')
const clip = join(sourceDir, 'clip.mp4')
writeFileSync(picture, PNG)
writeFileSync(clip, Buffer.alloc(1000, 1))

let resizes = []
let failNext = false
/** The resizer, injected: it writes a smaller file and remembers it was asked. */
function fakeSips(command, args, options, done) {
  resizes.push({ command, args: [...args] })
  const target = args[args.length - 1]
  if (failNext) {
    setImmediate(() => done(new Error('sips failed')))
    return
  }
  writeFileSync(target, Buffer.alloc(400, 7))
  setImmediate(() => done(null, ''))
}

{
  const out = await previewFor({ path: picture, ext: 'png', width: 320, cacheDir, platform: 'darwin', run: fakeSips })
  check('a picture gets a preview', out.file !== undefined && out.cached === false, JSON.stringify(out))
  check('and the resizer was asked once', resizes.length === 1, resizes.length + ' calls')
  check('with the width as an ARGV, never interpolated', resizes[0].args.includes('-Z') && resizes[0].args.includes('320') && resizes[0].command === 'sips', resizes[0].args.join(' '))
  check('into the cache directory this plugin owns', existsSync(join(cacheDir, previewName({ path: picture, mtimeMs: mtimeOf(picture), size: PNG.length, width: 320 }))), cacheDir)
  check('and the result is the smaller file, not the original', readFileSync(out.file).length === 400, readFileSync(out.file).length + ' bytes')

  const again = await previewFor({ path: picture, ext: 'png', width: 320, cacheDir, platform: 'darwin', run: fakeSips })
  check('the second ask is served from the cache', again.cached === true && resizes.length === 1, 'cached ' + again.cached + ', ' + resizes.length + ' calls')
}

{
  const out = await previewFor({ path: picture, ext: 'png', width: 7, cacheDir, platform: 'darwin', run: fakeSips })
  check('a width below the floor is refused by name', out.error === 'bad-width', JSON.stringify(out))
  const high = await previewFor({ path: picture, ext: 'png', width: 99999, cacheDir, platform: 'darwin', run: fakeSips })
  check('and so is one above the ceiling', high.error === 'bad-width', JSON.stringify(high))
}

{
  const out = await previewFor({ path: picture, ext: 'png', width: 320, cacheDir, platform: 'linux', run: fakeSips })
  check('a host without a resizer answers `unsupported`, not an error', out.error === 'unsupported', JSON.stringify(out))
  const clipOut = await previewFor({ path: clip, ext: 'mp4', width: 320, cacheDir, platform: 'darwin', run: fakeSips })
  check('a video is not resized', clipOut.error === 'not-resizable', JSON.stringify(clipOut))
  const gone = await previewFor({ path: join(sourceDir, 'nope.png'), ext: 'png', width: 320, cacheDir, platform: 'darwin', run: fakeSips })
  check('a file that has gone says which absence it is', gone.error === 'missing-file', JSON.stringify(gone))
}

{
  failNext = true
  const out = await previewFor({ path: picture, ext: 'png', width: 640, cacheDir, platform: 'darwin', run: fakeSips })
  failNext = false
  check('a failed resize is reported', out.error === 'resize-failed', JSON.stringify(out))
  const leftovers = readdirSync(cacheDir).filter((name) => name.includes('.part'))
  check('and leaves no half-written file wearing the real name', leftovers.length === 0, leftovers.join(','))
  check('and nothing under the name it would have had', !existsSync(join(cacheDir, previewName({ path: picture, mtimeMs: mtimeOf(picture), size: PNG.length, width: 640 }))), '')
}

// ── 4. through the shipped route ───────────────────────────────────────────

const dataRoot = mkdtempSync(join(tmpdir(), 'assets-preview-data-'))
const library = mkdtempSync(join(tmpdir(), 'assets-preview-library-'))
writeFileSync(join(library, 'shot.png'), PNG)
writeFileSync(join(library, 'clip.mp4'), Buffer.alloc(2048, 2))
writeFileSync(join(dataRoot, 'folders.json'), JSON.stringify({ schema: 'muen-assets-folders/v1', folders: [{ path: library, label: 'preview-test' }] }))

const server = fakeServer()
const module = await import(pathToFileURL(join(ROOT, 'lib/index.js')).href)
const mount = (previewConfig) => {
  const own = fakeServer()
  module.apply(
    { get: (name) => (name === 'webServer' ? own : undefined), effect: (fn) => { fn(); return () => {} }, inject: () => {} },
    { folders: { canChoose: true, choose: async () => ({ cancelled: true }) }, preview: previewConfig, argv: ['node', 'verify'], env: { ASSETS_DATA_DIR: dataRoot, RH_DATA_DIR: join(dataRoot, 'generate') } },
  )
  return own.routes.find((route) => route.path === '/plugins/assets/file').handler
}

{
  resizes = []
  const handler = mount({ platform: 'darwin', run: fakeSips })
  const tile = await callRoute(handler, 'GET', '/plugins/assets/file?path=' + encodeURIComponent(join(library, 'shot.png')) + '&w=320')
  await waitForEnd(tile)
  check('a tile ask answers a preview', tile.statusCode === 200 && tile.headers['content-type'] === 'image/jpeg', tile.statusCode + ' ' + tile.headers['content-type'])
  check('and says so in a header a person can read', tile.headers['x-assets-preview'] === '1', tile.headers['x-assets-preview'])
  check('with the smaller number of bytes', tile.bytes().length === 400, tile.bytes().length + ' bytes')
  const original = await callRoute(handler, 'GET', '/plugins/assets/file?path=' + encodeURIComponent(join(library, 'shot.png')))
  await waitForEnd(original)
  check('and no width still means the original, byte for byte', original.statusCode === 200 && original.headers['content-type'] === 'image/png' && original.headers['x-assets-preview'] === '0' && Buffer.compare(original.bytes(), PNG) === 0, original.statusCode + ' ' + original.bytes().length + ' bytes')
  const bad = await callRoute(handler, 'GET', '/plugins/assets/file?path=' + encodeURIComponent(join(library, 'shot.png')) + '&w=7')
  check('a width out of range is the caller\'s mistake and says so', bad.statusCode === 400 && bad.json().error === 'bad-width', bad.statusCode)
  const outside = await callRoute(handler, 'GET', '/plugins/assets/file?path=' + encodeURIComponent('/etc/hosts') + '&w=320')
  check('containment still holds with a width on it', outside.statusCode === 404 && outside.json().error === 'not-in-library', outside.statusCode + ' ' + JSON.stringify(outside.json().error))
}

{
  const handler = mount({ platform: 'darwin', run: fakeSips })
  const clip = await callRoute(handler, 'GET', '/plugins/assets/file?path=' + encodeURIComponent(join(library, 'clip.mp4')) + '&w=320')
  await waitForEnd(clip)
  check('a video with a width on it is served as itself', clip.statusCode === 200 && clip.headers['x-assets-preview'] === '0' && clip.bytes().length === 2048, clip.statusCode + ' ' + clip.bytes().length)
}

{
  const handler = mount({ platform: 'linux', run: fakeSips })
  const tile = await callRoute(handler, 'GET', '/plugins/assets/file?path=' + encodeURIComponent(join(library, 'shot.png')) + '&w=320')
  await waitForEnd(tile)
  check('a host with no resizer serves the original rather than failing', tile.statusCode === 200 && tile.headers['x-assets-preview'] === '0' && tile.bytes().length === PNG.length, tile.statusCode + ' ' + tile.bytes().length)
}

{
  // The registry and the catalog both say whether this host can make previews, so the
  // surface never has to guess and a person debugging a slow grid has one thing to read.
  const own = fakeServer()
  module.apply(
    { get: (name) => (name === 'webServer' ? own : undefined), effect: (fn) => { fn(); return () => {} }, inject: () => {} },
    { folders: { canChoose: true, choose: async () => ({ cancelled: true }) }, preview: { platform: 'linux' }, argv: ['node', 'verify'], env: { ASSETS_DATA_DIR: dataRoot, RH_DATA_DIR: join(dataRoot, 'generate') } },
  )
  const folders = own.routes.find((route) => route.path === '/plugins/assets/folders').handler
  const answer = await callRoute(folders, 'GET', '/plugins/assets/folders')
  check('the registry reports whether this host can preview at all', answer.json().canPreview === false, JSON.stringify(answer.json().canPreview))
  const catalog = own.routes.find((route) => route.path === '/plugins/assets/catalog').handler
  const listing = await callRoute(catalog, 'GET', '/plugins/assets/catalog')
  check('and so does the catalog', listing.json().canPreview === false, JSON.stringify(listing.json().canPreview))
}

finish()
