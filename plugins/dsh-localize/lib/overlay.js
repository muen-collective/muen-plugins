/**
 * THE OVERLAY STORE (epic 65 L4) — per-plugin, per-language translations that live in the PROFILE,
 * not in the plugin.
 *
 * WHY THIS EXISTS AT ALL. A third-party plugin with hardcoded strings cannot be translated the way
 * our own plugins are: `locale.register` needs a namespace the plugin binds, and a plugin that never
 * calls `bind()` has none. Editing its installed bundle is not an option either — the boundary rule
 * forbids it and the next `pnpm update` would clobber the edit. So the translations live beside the
 * profile at `<profile>/localizations/<plugin>/<lang>.json`, keyed by the ENGLISH SOURCE STRING, and
 * a runtime overlay replaces matching text as it renders. The profile is not a package, so nothing
 * an update touches can remove it.
 *
 * THE RESOLUTION RULE IS THE POINT: a source string with no translation comes back as the SOURCE —
 * never blank, never the raw key, never a placeholder id. A half-translated screen reads as English
 * where the translation is missing, which is the only failure a person can act on.
 *
 * The store is deliberately dumb: JSON in, JSON out, no plugin knowledge. Everything that could
 * refuse a write (a hostile plugin id, a non-string value, an unreadable file) is done here rather
 * than at the route, so the rules hold wherever the store is called from.
 */
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/** The directory under the profile that holds every overlay. */
const OVERLAY_DIR = 'localizations'

/** Languages this plugin offers, and the fallback root. `en` is the source, so it needs no overlay. */
const LANGS = Object.freeze(['ko', 'ja', 'fr', 'de', 'es'])

/** A plugin id is one path segment: no separators, no traversal, nothing that escapes the root. */
function validPluginId(id) {
  return typeof id === 'string' && /^[A-Za-z0-9][A-Za-z0-9._@-]{0,127}$/u.test(id) && !id.includes('..')
}

/** The root of the overlay tree for a profile root. */
function overlayRoot(root) {
  return join(root, OVERLAY_DIR)
}

/** One plugin's overlay directory, or `null` when the id is not one we will write under. */
function pluginDir(root, plugin) {
  if (!validPluginId(plugin)) return null
  return join(overlayRoot(root), plugin)
}

/** A language we will store: one of ours, and a well-formed tag. */
function validLang(lang) {
  return typeof lang === 'string' && /^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/u.test(lang)
}

/**
 * Clean a candidate map: string source → non-empty string target, nothing else. Answers
 * `{ map, refused }` so a caller can say what it dropped instead of failing the whole write.
 */
function cleanMap(input) {
  const map = {}
  const refused = []
  if (input === null || typeof input !== 'object' || Array.isArray(input)) return { map, refused: [{ key: null, reason: 'not-a-map' }] }
  for (const [source, target] of Object.entries(input)) {
    if (typeof source !== 'string' || source.trim() === '') {
      refused.push({ key: String(source), reason: 'bad-source' })
      continue
    }
    if (typeof target !== 'string' || target.trim() === '') {
      refused.push({ key: source, reason: 'bad-target' })
      continue
    }
    map[source] = target
  }
  return { map, refused }
}

/** One overlay file's path, or `null` when the id or language will not do. */
function overlayPath(root, plugin, lang) {
  const dir = pluginDir(root, plugin)
  if (dir === null || !validLang(lang)) return null
  return join(dir, lang + '.json')
}

/** Read one overlay. An absent file is an EMPTY overlay, which is not an error. */
function readOverlay(root, plugin, lang) {
  const path = overlayPath(root, plugin, lang)
  if (path === null) return { map: {}, refused: [], path: null, missing: true }
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8'))
    return { ...cleanMap(parsed), path, missing: false }
  } catch {
    return { map: {}, refused: [], path, missing: true }
  }
}

/** Write one overlay, creating the directory. Answers what it wrote, or why it would not. */
function writeOverlay(root, plugin, lang, input) {
  const path = overlayPath(root, plugin, lang)
  if (path === null) return { ok: false, error: validPluginId(plugin) ? 'bad-lang' : 'bad-plugin', path: null }
  const { map, refused } = cleanMap(input)
  if (Object.keys(map).length === 0 && refused.length > 0) return { ok: false, error: 'nothing-usable', refused, path }
  mkdirSync(join(overlayRoot(root), plugin), { recursive: true })
  writeFileSync(path, JSON.stringify(map, null, 2) + '\n', 'utf8')
  return { ok: true, keys: Object.keys(map).length, refused, path }
}

/** Remove one overlay file. Absent is success: the caller asked for it to be gone. */
function removeOverlay(root, plugin, lang) {
  const path = overlayPath(root, plugin, lang)
  if (path === null) return { ok: false, error: 'bad-target' }
  try {
    rmSync(path)
  } catch {
    // already gone
  }
  return { ok: true }
}

/** Every overlay the profile holds: `[{ plugin, lang, keys }]`. */
function listOverlays(root) {
  const base = overlayRoot(root)
  const found = []
  let plugins = []
  try {
    plugins = readdirSync(base, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name)
  } catch {
    return found
  }
  for (const plugin of plugins.sort()) {
    let files = []
    try {
      files = readdirSync(join(base, plugin))
    } catch {
      continue
    }
    for (const file of files.sort()) {
      if (!file.endsWith('.json')) continue
      const lang = file.slice(0, -'.json'.length)
      const { map } = readOverlay(root, plugin, lang)
      found.push({ plugin, lang, keys: Object.keys(map).length })
    }
  }
  return found
}

/**
 * ONE MAP FOR THE WHOLE DOM, from every plugin's overlay for a language.
 *
 * A DOM walk cannot know which plugin drew a node, so the overlays are flattened into one map — and
 * TWO PLUGINS TRANSLATING THE SAME ENGLISH STRING DIFFERENTLY is a real possibility, not a
 * hypothetical (epic 65 L6 names it: "Enable" rendered two ways). The conflict is REPORTED and the
 * later plugin wins, so a person can see the disagreement instead of the screen quietly depending on
 * directory order.
 */
function mergeOverlays(overlays) {
  const map = {}
  const conflicts = []
  for (const { plugin, map: entries } of overlays) {
    for (const [source, target] of Object.entries(entries || {})) {
      if (map[source] !== undefined && map[source] !== target) conflicts.push({ source, kept: map[source], dropped: target, plugin })
      map[source] = target
    }
  }
  return { map, conflicts }
}

/** Everything the profile holds for one language, ready to merge. */
function overlaysFor(root, lang) {
  const overlays = []
  for (const row of listOverlays(root)) {
    if (row.lang !== lang) continue
    const { map } = readOverlay(root, row.plugin, lang)
    overlays.push({ plugin: row.plugin, map })
  }
  return overlays
}

/**
 * RESOLVE ONE RENDERED STRING. The exact source wins; there is no partial matching, because a
 * half-matched sentence is how an overlay produces nonsense. A string with no translation is
 * returned UNCHANGED — the English fallback the epic names.
 */
function resolveOverlay(map, source) {
  if (typeof source !== 'string' || source === '') return source
  const direct = map[source]
  if (typeof direct === 'string' && direct !== '') return direct
  // A rendered node keeps its surrounding whitespace; the map is keyed by the trimmed string.
  const trimmed = source.trim()
  const spaced = map[trimmed]
  if (typeof spaced === 'string' && spaced !== '') {
    const lead = source.slice(0, source.indexOf(trimmed))
    const tail = source.slice(source.indexOf(trimmed) + trimmed.length)
    return lead + spaced + tail
  }
  return source
}

export {
  OVERLAY_DIR,
  LANGS,
  validPluginId,
  validLang,
  overlayRoot,
  pluginDir,
  overlayPath,
  cleanMap,
  readOverlay,
  writeOverlay,
  removeOverlay,
  listOverlays,
  mergeOverlays,
  overlaysFor,
  resolveOverlay,
}
