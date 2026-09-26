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
import { resolveDataRoot, resolveRecordsRoot } from './paths.js'
import { expandFolder, readFolders, writeFolders } from './folders.js'
import { readCatalog } from './catalog.js'
import { nativeFolders } from './folder-actions.js'

/** Matches the row id in cordis.patch.yml. */
export const name = 'assets'

/** The registry: `GET` it, or `POST` an action that changes it. */
const FOLDERS_PATH = '/plugins/assets/folders'
/** The catalog: the tiles and the counts a surface draws. */
const CATALOG_PATH = '/plugins/assets/catalog'

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
      truncated: catalog.truncated,
    })
  }

  const mount = (server) => {
    ctx.effect(() => server.register({ kind: 'exact', path: FOLDERS_PATH, handler: foldersRoute }), 'assets: folders')
    ctx.effect(() => server.register({ kind: 'exact', path: CATALOG_PATH, handler: catalogRoute }), 'assets: catalog')
  }

  const server = typeof ctx.get === 'function' ? ctx.get('webServer') : undefined
  if (server !== undefined && server !== null) {
    mount(server)
  } else if (typeof ctx.inject === 'function') {
    ctx.inject(['webServer'], () => mount(ctx.get('webServer')))
  }
}
