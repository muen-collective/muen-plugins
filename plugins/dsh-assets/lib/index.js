/**
 * @muen/dsh-assets — the host half.
 *
 * TWO JOBS: answer and edit the folder registry, and answer the catalog those folders make.
 * The pictures are not here and never move here — a person's project folders stay where they
 * already are, outside this app, so Finder, email and AirDrop keep working.
 *
 * THE RECORDS ARE READ, NOT OWNED. `<profile>/generate/<provider>/runs/*.json` belongs to
 * the Generate plugin, and this half reads those files by the same path rule (lib/paths.js)
 * rather than calling into it: epic 63 §1 decided the two plugins stand alone, so the
 * library works with Generate absent and neither import reaches across.
 *
 * THE PREFIX CARRIES NO TRAILING SLASH. The harness matches a prefix as
 * `pathname === prefix || pathname.startsWith(prefix + '/')` — it appends the slash itself
 * — so registering `'…/assets/'` would make the second test `startsWith('…/assets//')` and
 * every route below it would answer 404 with an empty body. Measured on this plugin's
 * sibling on 2026-09-23 (`docs/status/2026-09-23-generate-route-prefix-404.md`).
 *
 * @module @muen/dsh-assets
 */
import { createReadStream } from 'node:fs'
import { readFile, stat, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'

import { resolveDataRoot, resolveRecordsRoot } from './paths.js'
import { expandFolder, readFolders, writeFolders } from './folders.js'
import { assetDetail, readCatalog } from './catalog.js'
import { nativeFolders } from './folder-actions.js'
import { canPreview, previewFor } from './preview.js'

/** Matches the row id in cordis.patch.yml. */
export const name = 'assets'

/** The registry: `GET` it, or `POST` an action that changes it. */
const FOLDERS_PATH = '/plugins/assets/folders'
/** The catalog: the tiles and the counts a surface draws. */
const CATALOG_PATH = '/plugins/assets/catalog'
/** One asset, whole: what the metadata block draws when a tile is selected. */
const DETAIL_PATH = '/plugins/assets/detail'
/** The bytes of an asset the library holds — the tile's picture. */
const FILE_PATH = '/plugins/assets/file'
/** The view a person left behind: grid or list, the filters, the selection. */
const VIEW_PATH = '/plugins/assets/view'

/**
 * What an asset's extension means on the wire. Written out here rather than imported from
 * the generator plugin: this is a route's concern, and sharing it would be the coupling
 * epic 63 §1 exists to avoid.
 */
const TYPE_BY_EXT = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  avif: 'image/avif',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  heic: 'image/heic',
  bmp: 'image/bmp',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
  mkv: 'video/x-matroska',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  m4a: 'audio/mp4',
}

/** The view file's schema, so an unknown one is reported rather than obeyed. */
const VIEW_SCHEMA = 'muen-assets-view/v1'

/** The two layouts a person can leave behind. */
const VIEWS = ['grid', 'list']

/** Refuse a body past this — the only bodies here are a path and a verb. */
const MAX_BODY_BYTES = 8192

/** JSON out, never cached — a folder added a second ago must be there on the next read. */
function send(res, status, body) {
  const text = JSON.stringify(body)
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Content-Length', Buffer.byteLength(text))
  res.end(text)
}

/** The request body, bounded and parsed. Resolves undefined when unusable. */
function readJsonBody(req) {
  return new Promise((resolve) => {
    let size = 0
    const chunks = []
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        resolve(undefined)
        req.destroy?.()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      if (chunks.length === 0) {
        resolve(undefined)
        return
      }
      try {
        const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'))
        resolve(parsed && typeof parsed === 'object' ? parsed : undefined)
      } catch {
        resolve(undefined)
      }
    })
    req.on('error', () => resolve(undefined))
  })
}

const str = (value) => (value === undefined || value === null ? '' : String(value)).trim()

export function apply(ctx, config = {}) {
  const argv = Array.isArray(config.argv) ? config.argv : process.argv
  const env = config.env && typeof config.env === 'object' ? config.env : process.env
  const folders = config.folders && typeof config.folders === 'object' ? config.folders : nativeFolders
  // The resizer is a seam like the folder dialog: a verify run asserts the cache and the
  // fallbacks without spawning anything, and a host without `sips` answers canPreview false.
  const preview = {
    platform: (config.preview && config.preview.platform) || process.platform,
    run: config.preview ? config.preview.run : undefined,
  }
  const own = resolveDataRoot({ argv, env })
  const records = resolveRecordsRoot({ argv, env })

  /** The registry, plus where the library is looking: the two paths and the rule behind each. */
  const registryState = async () => {
    const registry = await readFolders(own.root)
    return {
      folders: registry.folders,
      // Whether the file on disk is one this plugin wrote. An unknown schema is reported,
      // never obeyed silently, and never a reason to show an empty library without saying so.
      known: registry.known,
      found: registry.found,
      canChoose: folders.canChoose === true,
      canPreview: canPreview(preview.platform),
      root: own.root,
      rootKind: own.kind,
      recordsRoot: records.root,
      recordsRootKind: records.kind,
    }
  }

  const foldersRoute = async (req, res) => {
    const method = (req.method || 'GET').toUpperCase()

    if (method === 'GET') {
      send(res, 200, await registryState())
      return
    }

    if (method !== 'POST') {
      res.setHeader('Allow', 'GET, POST')
      send(res, 405, { error: 'method-not-allowed' })
      return
    }

    const body = await readJsonBody(req)
    if (body === undefined) {
      send(res, 400, { error: 'bad-request', detail: 'a JSON body is required' })
      return
    }

    const current = await readFolders(own.root)

    // A TYPED PATH OR THE OS DIALOG: both are the same act, and the dialog is only offered
    // when this host has one (the surface hides the control otherwise rather than failing).
    let target = null
    if (body.action === 'choose') {
      if (folders.canChoose !== true || typeof folders.choose !== 'function') {
        send(res, 501, { error: 'unsupported', detail: 'this host has no folder dialog' })
        return
      }
      let picked
      try {
        picked = await folders.choose(current.folders.length > 0 ? current.folders[0].path : own.root)
      } catch (error) {
        send(res, 500, { error: 'choose-failed', detail: String((error && error.message) || error) })
        return
      }
      if (!picked || picked.cancelled === true) {
        // Cancelling is not an error: the registry answers unchanged.
        send(res, 200, { ...(await registryState()), cancelled: true })
        return
      }
      target = picked.path
    } else if (body.action === 'add') {
      target = body.path
    } else if (body.action === 'remove') {
      const path = expandFolder(body.path)
      if (path === null) {
        send(res, 400, { error: 'bad-path', detail: 'an absolute folder path' })
        return
      }
      const kept = current.folders.filter((folder) => folder.path !== path)
      if (kept.length === current.folders.length) {
        send(res, 404, { error: 'not-in-library', detail: 'that folder is not added: ' + path })
        return
      }
      await writeFolders(own.root, kept)
      send(res, 200, await registryState())
      return
    } else {
      send(res, 400, { error: 'unknown-action', detail: '"' + str(body.action) + '" is not a folder action' })
      return
    }

    const path = expandFolder(target)
    if (path === null) {
      send(res, 400, { error: 'bad-path', detail: 'an absolute folder path' })
      return
    }
    if (current.folders.some((folder) => folder.path === path)) {
      // Adding the same folder twice is a no-op that says so, not a second row.
      send(res, 200, { ...(await registryState()), already: true })
      return
    }
    const label = str(body.label).slice(0, 80) || (path.split(/[\\/]/).filter(Boolean).pop() || path)
    await writeFolders(own.root, [...current.folders, { path, label }])
    send(res, 200, await registryState())
  }

  const catalogRoute = async (req, res) => {
    const method = (req.method || 'GET').toUpperCase()
    if (method !== 'GET') {
      res.setHeader('Allow', 'GET')
      send(res, 405, { error: 'method-not-allowed' })
      return
    }
    const url = new URL(req.url || '/', 'http://127.0.0.1')
    const context = str(url.searchParams.get('context')) || null
    const date = str(url.searchParams.get('date')) || null
    if (date !== null && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      send(res, 400, { error: 'bad-date', detail: 'date is YYYY-MM-DD' })
      return
    }
    const registry = await readFolders(own.root)
    const catalog = await readCatalog({ folders: registry.folders, recordsRoot: records.root, context, date })
    send(res, 200, {
      ...catalog,
      folders: registry.folders,
      filter: { context, date },
      // Where it looked, with the rule that answered each root — the two facts a person
      // needs when the library is empty and the folders are not.
      root: own.root,
      rootKind: own.kind,
      recordsRoot: records.root,
      recordsRootKind: records.kind,
      canPreview: canPreview(preview.platform),
      truncated: catalog.truncated,
    })
  }

  /**
   * The bytes of an asset the library holds.
   *
   * CONTAINMENT IS THE WHOLE SECURITY MODEL, and it is the same check the detail route makes:
   * the requested path must be the folder itself or something inside it, or the answer is
   * 404. So this route can serve a picture from a folder a person added and nothing else on
   * the machine — there is no `..` to climb with, because a path outside the added folders is
   * simply not in the library.
   *
   * IT READS THE DISK EVERY TIME (`no-store`), the same rule the generator's route keeps: a
   * cached 200 would keep showing a picture that has been moved. The grid asks for a handful
   * of tiles at a time and the browser is told so with `loading="lazy"`; the answer for many
   * tiles at once is the preview proxy (epic 64 S9), not a cache that lies.
   */
  const fileRoute = async (req, res) => {
    const method = (req.method || 'GET').toUpperCase()
    if (method !== 'GET') {
      res.setHeader('Allow', 'GET')
      send(res, 405, { error: 'method-not-allowed' })
      return
    }
    const url = new URL(req.url || '/', 'http://127.0.0.1')
    const wanted = str(url.searchParams.get('path'))
    const width = str(url.searchParams.get('w'))
    const registry = await readFolders(own.root)
    const folder = registry.folders.find((entry) => wanted === entry.path || wanted.startsWith(entry.path.replace(/\/+$/, '') + '/'))
    if (wanted === '' || !folder) {
      send(res, 404, { error: 'not-in-library', detail: 'that path is not inside a folder this library holds' })
      return
    }
    let info
    try {
      info = await stat(wanted)
    } catch {
      send(res, 404, { error: 'missing-file', detail: 'the file is not there: ' + wanted })
      return
    }
    if (!info.isFile()) {
      send(res, 404, { error: 'missing-file', detail: 'not a file: ' + wanted })
      return
    }
    const ext = String(wanted).split('.').pop().toLowerCase()

    // A SMALLER FILE WHEN ONE IS ASKED FOR, and the original whenever one cannot be made:
    // a host without a resizer, a width out of range, a video, a resize that failed. The
    // answer is always a picture of the right thing rather than an error a grid cannot draw.
    let serve = wanted
    let type = TYPE_BY_EXT[ext] || 'application/octet-stream'
    let bytes = info.size
    let previewed = false
    if (width !== '') {
      const made = await previewFor({
        path: wanted,
        ext,
        width: Number(width),
        cacheDir: join(own.root, 'proxies'),
        platform: preview.platform,
        stat,
        run: preview.run,
      })
      if (made && made.file) {
        serve = made.file
        type = 'image/jpeg'
        previewed = true
        try {
          bytes = (await stat(made.file)).size
        } catch {
          bytes = info.size
        }
      } else if (made && made.error === 'bad-width') {
        send(res, 400, { error: 'bad-width', detail: 'w is between 32 and 2048' })
        return
      }
    }

    res.statusCode = 200
    res.setHeader('Content-Type', type)
    res.setHeader('Content-Length', bytes)
    res.setHeader('Cache-Control', 'no-store')
    // Whether this is the original matters to a person debugging the grid: 1 means the
    // resizer answered, 0 means this is the file itself.
    res.setHeader('X-Assets-Preview', previewed ? '1' : '0')
    const stream = createReadStream(serve)
    stream.on('error', () => {
      try { res.destroy() } catch { /* the socket is already gone */ }
    })
    stream.pipe(res)
  }

  /** One asset, whole — dimensions, where it is, and the run that made it, if one did. */
  const detailRoute = async (req, res) => {
    const method = (req.method || 'GET').toUpperCase()
    if (method !== 'GET') {
      res.setHeader('Allow', 'GET')
      send(res, 405, { error: 'method-not-allowed' })
      return
    }
    const url = new URL(req.url || '/', 'http://127.0.0.1')
    const wanted = str(url.searchParams.get('path'))
    const registry = await readFolders(own.root)
    const detail = await assetDetail({ folders: registry.folders, recordsRoot: records.root, path: wanted })
    if (detail.error === 'not-in-library') {
      send(res, 404, { error: 'not-in-library', detail: 'that path is not inside a folder this library holds' })
      return
    }
    send(res, 200, detail)
  }

  /** Where the view file lives, and what it holds. */
  const viewPath = () => join(own.root, 'view.json')
  const readView = async () => {
    try {
      const parsed = JSON.parse(await readFile(viewPath(), 'utf8'))
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { schema: VIEW_SCHEMA, view: 'grid', context: null, date: null, selected: null }
      return {
        schema: VIEW_SCHEMA,
        known: parsed.schema === VIEW_SCHEMA,
        view: VIEWS.includes(parsed.view) ? parsed.view : 'grid',
        context: typeof parsed.context === 'string' ? parsed.context : null,
        date: typeof parsed.date === 'string' ? parsed.date : null,
        selected: typeof parsed.selected === 'string' ? parsed.selected : null,
      }
    } catch {
      return { schema: VIEW_SCHEMA, view: 'grid', context: null, date: null, selected: null }
    }
  }

  /**
   * The view a person left behind.
   *
   * THE PANE IS NOT REMEMBERED BY THE APP: the harness does not restore tabs in this shell
   * (its layout store is localStorage under an origin the shell randomises with `--port 0`),
   * so what survives a reload is what this file holds — the layout, the two filters, and the
   * selected tile.
   */
  const viewRoute = async (req, res) => {
    const method = (req.method || 'GET').toUpperCase()
    if (method === 'GET') {
      send(res, 200, await readView())
      return
    }
    if (method !== 'POST') {
      res.setHeader('Allow', 'GET, POST')
      send(res, 405, { error: 'method-not-allowed' })
      return
    }
    const body = await readJsonBody(req)
    if (body === undefined) {
      send(res, 400, { error: 'bad-request', detail: 'a JSON body is required' })
      return
    }
    const current = await readView()
    const next = {
      schema: VIEW_SCHEMA,
      view: VIEWS.includes(body.view) ? body.view : current.view,
      context: body.context === undefined ? current.context : (body.context === null ? null : str(body.context)),
      date: body.date === undefined ? current.date : (body.date === null ? null : str(body.date)),
      selected: body.selected === undefined ? current.selected : (body.selected === null ? null : str(body.selected)),
    }
    if (next.date !== null && !/^\d{4}-\d{2}-\d{2}$/.test(next.date)) {
      send(res, 400, { error: 'bad-date', detail: 'date is YYYY-MM-DD' })
      return
    }
    await mkdir(own.root, { recursive: true })
    await writeFile(viewPath(), JSON.stringify(next, null, 2) + '\n', 'utf8')
    send(res, 200, next)
  }

  const mount = (server) => {
    ctx.effect(() => server.register({ kind: 'exact', path: FOLDERS_PATH, handler: foldersRoute }), 'assets: folders')
    ctx.effect(() => server.register({ kind: 'exact', path: CATALOG_PATH, handler: catalogRoute }), 'assets: catalog')
    ctx.effect(() => server.register({ kind: 'exact', path: DETAIL_PATH, handler: detailRoute }), 'assets: detail')
    ctx.effect(() => server.register({ kind: 'exact', path: FILE_PATH, handler: fileRoute }), 'assets: file')
    ctx.effect(() => server.register({ kind: 'exact', path: VIEW_PATH, handler: viewRoute }), 'assets: view')
  }

  const server = typeof ctx.get === 'function' ? ctx.get('webServer') : undefined
  if (server !== undefined && server !== null) {
    mount(server)
  } else if (typeof ctx.inject === 'function') {
    ctx.inject(['webServer'], () => mount(ctx.get('webServer')))
  }
}
