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
import { dirname, join } from 'node:path'

import { fileURLToPath } from 'node:url'

import { overlayRootFor, profileDir, ROW_ID } from './paths.js'
import { listOverlays, mergeOverlays, overlaysFor, readOverlay, removeOverlay, writeOverlay } from './overlay.js'
import { readMemory, reviewState } from './memory.js'
import { scanStrings } from './scan.js'

const name = 'localize'
const inject = ['webServer']

/**
 * THE SKILL THAT SHIPS HERE (epic 65 L5). The reviewer travels inside this package — its own copy, read
 * at apply time — so the host serves the same text that is in the repo, and the gate has one owner.
 */
const SKILLS = [
  {
    name: 'localize-review',
    description:
      'Review a plugin\'s translations and record per-key verdicts — approved, flagged or missing — with the reason, in the profile\'s review memory.',
    whenToUse:
      'Use when the user asks to review, audit or check translations for a plugin or a language ("review the Korean", "audit the ko file", "is this translation right"), or when a translation change needs a verdict before it ships.',
    file: fileURLToPath(new URL('../skills/localize-review/SKILL.md', import.meta.url)),
  },
]

/** Register the shipped skills. One that cannot be read is skipped; a plugin that fails to load is worse. */
function mountSkill(ctx) {
  const skills = typeof ctx.get === 'function' ? ctx.get('skills') : undefined
  if (!skills || typeof skills.register !== 'function') return false
  let mounted = false
  for (const skill of SKILLS) {
    let content
    try {
      content = readFileSync(skill.file, 'utf8')
    } catch (error) {
      if (ctx.logger && typeof ctx.logger.warn === 'function') {
        ctx.logger.warn('localize: the skill file could not be read at ' + skill.file + ': ' + String((error && error.message) || error))
      }
      continue
    }
    ctx.effect(
      () =>
        skills.register({
          name: skill.name,
          description: skill.description,
          whenToUse: skill.whenToUse,
          invocation: { modelInvocable: true, userInvocable: true },
          source: 'runtime',
          provider: 'localize',
          path: skill.file,
          resourceBase: { kind: 'directory', path: dirname(skill.file) },
          content,
        }),
      'localize: skill ' + skill.name,
    )
    mounted = true
  }
  return mounted
}

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
  // TWO ROOTS, AND THEY ARE NOT THE SAME ONE: the overlays live under `<profile>/localizations`, the
  // verdicts under `<profile>/localize-memory`. Reading the memory from the overlay root found nothing,
  // so a flagged translation was invisible to the globe's mark — which is what the route check caught.
  const root = () => overlayRootFor()
  const profile = () => profileDir()
  mountSkill(ctx)
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

    /**
     * WHAT IS WAITING FOR A PERSON, per plugin: verdicts that came back flagged, and translations
     * nothing has judged yet (new, changed, or approved under an older prompt). This is the number
     * behind the globe's mark — a to-do, not an error — and it rides the overlay response so the mark
     * costs no extra request.
     */
    const reviewFor = (root, lang) => {
      const rows = []
      let flagged = 0
      let unjudged = 0
      const memoryRoot = profile()
      if (memoryRoot === null) return { pending: 0, flagged: 0, unjudged: 0, plugins: [] }
      for (const row of overlaysFor(root, lang)) {
        const state = reviewState(readMemory(memoryRoot, row.plugin, lang), row.map)
        const waiting = state.new.length + state.changed.length + state.stalePrompt.length
        flagged += state.flagged.length
        unjudged += waiting
        rows.push({ plugin: row.plugin, keys: Object.keys(row.map).length, approved: state.approved.length, flagged: state.flagged.length, unjudged: waiting })
      }
      return { pending: flagged + unjudged, flagged, unjudged, plugins: rows }
    }

    if (method === 'GET') {
      if (plugin !== null && lang !== null) {
        const one = readOverlay(target, plugin, lang)
        send(res, 200, { plugin, lang, map: one.map, missing: one.missing, review: reviewFor(target, lang) })
        return
      }
      if (lang !== null) {
        const overlays = overlaysFor(target, lang)
        const merged = mergeOverlays(overlays)
        send(res, 200, { lang, overlays, map: merged.map, conflicts: merged.conflicts, review: reviewFor(target, lang) })
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
export { apply, SKILLS, mountSkill, OVERLAY_PATH, ROW_ID }
