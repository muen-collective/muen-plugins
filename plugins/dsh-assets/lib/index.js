/**
 * @muen/dsh-assets — the host half.
 *
 * ONE JOB, AND IT IS THE LIBRARY'S OWN FILE: answer which folders this library holds, and
 * (from A2) add and remove them. The pictures are not here and never move here — a person's
 * project folders stay where they already are, outside this app, so Finder, email and
 * AirDrop keep working.
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
import { readFolders } from './folders.js'

/** Matches the row id in cordis.patch.yml. */
export const name = 'assets'

/** The one exact route A1 ships: the registry as stored, read-only. */
const FOLDERS_PATH = '/plugins/assets/folders'

/** JSON out, never cached — a folder added a second ago must be there on the next read. */
function send(res, status, body) {
  const text = JSON.stringify(body)
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Content-Length', Buffer.byteLength(text))
  res.end(text)
}

export function apply(ctx, config = {}) {
  const argv = Array.isArray(config.argv) ? config.argv : process.argv
  const env = config.env && typeof config.env === 'object' ? config.env : process.env
  const own = resolveDataRoot({ argv, env })
  const records = resolveRecordsRoot({ argv, env })

  const foldersRoute = async (req, res) => {
    const method = (req.method || 'GET').toUpperCase()
    if (method !== 'GET') {
      res.setHeader('Allow', 'GET')
      send(res, 405, { error: 'method-not-allowed' })
      return
    }
    const registry = await readFolders(own.root)
    send(res, 200, {
      folders: registry.folders,
      // Whether the file on disk is one this plugin wrote. An unknown schema is reported,
      // never obeyed silently, and never a reason to show an empty library without saying so.
      known: registry.known,
      found: registry.found,
      // Where the library's own state lives, and where the records it reads live: the
      // surface can say both without a second call, and a person debugging an empty library
      // gets the two paths instead of a shrug.
      root: own.root,
      rootKind: own.kind,
      recordsRoot: records.root,
      recordsRootKind: records.kind,
    })
  }

  const mount = (server) => {
    ctx.effect(() => server.register({ kind: 'exact', path: FOLDERS_PATH, handler: foldersRoute }), 'assets: folders')
  }

  const server = typeof ctx.get === 'function' ? ctx.get('webServer') : undefined
  if (server !== undefined && server !== null) {
    mount(server)
  } else if (typeof ctx.inject === 'function') {
    ctx.inject(['webServer'], () => mount(ctx.get('webServer')))
  }
}
