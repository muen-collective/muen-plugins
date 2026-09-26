// @muen/dsh-localize — host half (epic 65 L2, L4).
//
// WHAT IS NOT HERE, AND WHY. The language surface is client-side by necessity: the catalog, the
// dictionaries and the choice all live in the harness's own locale service, which is a browser service
// (`ctx.provide('locale', …)` in `@deepseek-ai/dsh-client-locale`). A host half cannot add a language.
//
// WHAT IS HERE IS THE PROFILE'S PART: the overlay store and the route that serves it. Translations for a
// plugin we do not own live in `<profile>/localizations/<plugin>/<lang>.json` — the profile is not a
// package, so a plugin update cannot remove them — and the client asks for the maps it should apply.
// The scan (`lib/scan.js`) finds the source strings to translate; it is a host module because it reads
// a bundle's text and must never EXECUTE it.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { overlayRootFor, ROW_ID } from './paths.js'
import { listOverlays, mergeOverlays, overlaysFor, readOverlay, removeOverlay, writeOverlay } from './overlay.js'
import { scanStrings } from './scan.js'

const name = 'localize'
const inject = ['webServer']

/** The one route. `kind: 'exact'`, and the prefix carries NO trailing slash (the 175d2a7 lesson). */
const OVERLAY_PATH = '/plugins/localize/overlay'

/** A map of a plugin's UI strings is small; a body past this is not one. */
const MAX_BODY_BYTES = 512 * 1024

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
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch {
        resolve(undefined)
      }
    })
    req.on('error', () => resolve(undefined))
  })
}

function apply(ctx) {
  const root = () => overlayRootFor()
  const server = typeof ctx.get === 'function' ? ctx.get('webServer') : undefined
  if (server === undefined || server === null) return

  const overlayRoute = async (req, res) => {
    const method = (req.method || 'GET').toUpperCase()
    const target = root()
    if (target === null) {
      send(res, 503, { error: 'no-profile', detail: 'no profile directory to keep the overlay in' })
      return
    }
    const url = new URL(req.url || OVERLAY_PATH, 'http://127.0.0.1')
    const plugin = url.searchParams.get('plugin')
    const lang = url.searchParams.get('lang')

    if (method === 'GET') {
      if (plugin !== null && lang !== null) {
        const one = readOverlay(target, plugin, lang)
        send(res, 200, { plugin, lang, map: one.map, missing: one.missing })
        return
      }
      if (lang !== null) {
        const overlays = overlaysFor(target, lang)
        const merged = mergeOverlays(overlays)
        send(res, 200, { lang, overlays, map: merged.map, conflicts: merged.conflicts })
        return
      }
      send(res, 200, { overlays: listOverlays(target) })
      return
    }

    if (method === 'POST') {
      const body = await readJsonBody(req)
      if (body === undefined || typeof body !== 'object' || body === null) {
        send(res, 400, { error: 'bad-body', detail: 'a JSON object is required' })
        return
      }
      if (body.scan === true) {
        // THE SCAN, for a plugin already installed in this profile: read its bundle's TEXT.
        const id = typeof body.plugin === 'string' ? body.plugin : ''
        const path = join(target, '..', 'node_modules', id, 'lib', 'client.js')
        if (!/^[A-Za-z0-9][A-Za-z0-9._@-]*$/u.test(id) || !existsSync(path)) {
          send(res, 404, { error: 'no-bundle', detail: 'no installed client bundle for ' + (id || '(no plugin)') })
          return
        }
        const found = scanStrings(readFileSync(path, 'utf8'))
        send(res, 200, { plugin: id, strings: found, count: found.length })
        return
      }
      const written = writeOverlay(target, body.plugin, body.lang, body.map)
      if (written.ok !== true) {
        const status = written.error === 'bad-plugin' || written.error === 'bad-lang' || written.error === 'nothing-usable' ? 400 : 500
        send(res, status, written)
        return
      }
      send(res, 200, written)
      return
    }

    if (method === 'DELETE') {
      if (plugin === null || lang === null) {
        send(res, 400, { error: 'bad-target', detail: 'plugin and lang are both required' })
        return
      }
      send(res, 200, removeOverlay(target, plugin, lang))
      return
    }

    res.setHeader('Allow', 'GET, POST, DELETE')
    send(res, 405, { error: 'method-not-allowed' })
  }

  ctx.effect(() => server.register({ kind: 'exact', path: OVERLAY_PATH, handler: overlayRoute }), 'localize: overlay')
  // The host half also owns the scan, reachable when a profile exists and a route was registered.
  return { scanStrings, overlayRoot: root(), route: OVERLAY_PATH }
}

export default { name, inject, apply }
export { apply, OVERLAY_PATH, ROW_ID }
