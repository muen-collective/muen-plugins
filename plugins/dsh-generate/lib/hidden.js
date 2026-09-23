/**
 * Which providers the Generate panel draws.
 *
 * A DISPLAY PREFERENCE, NOT A LINK (founder, 2026-09-23: *"I want a toggle inside
 * settings to hide providers that I don't use much for less visual clutter"*). A hidden
 * provider keeps everything it owns — its key stays in credentials, its adapters stay on
 * disk, its row stays in Settings → Generate — and only stops being drawn in the pane.
 * That is what makes the toggle safe to give a person: nothing is uninstalled, and the
 * switch that undoes it is on the row they hid.
 *
 * Stored as one small JSON file beside the adapters, `<root>/providers.json`:
 *
 *     { "hidden": ["magnific"] }
 *
 * Beside them and not in a profile setting, because it is the surface's own data in the
 * same sense the adapters are: it travels with the profile, it survives a plugin
 * upgrade, and it is readable by hand when something goes wrong.
 *
 * UNKNOWN IDS ARE KEPT, NOT DROPPED. A provider can leave the registry and come back —
 * Magnific did exactly that on 2026-09-23 — and forgetting the preference in between
 * would silently un-hide it. Only ids are stored, so an id nobody recognises costs one
 * string and nothing else.
 *
 * @module @muen/dsh-generate/lib/hidden
 */
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

/** The file, inside the plugin's own data root. */
export const HIDDEN_FILE = 'providers.json'

/** Where that file lives, given the root `resolveDataRoot` returned. */
export function hiddenPath(root) {
  return join(root, HIDDEN_FILE)
}

/**
 * The ids in a stored value, as a clean array.
 *
 * Anything that is not an array of non-empty strings reads as "nothing is hidden": a
 * corrupt file must not empty the panel, and the next write repairs it.
 *
 * @param {unknown} value - the parsed file, or anything else
 * @returns {string[]}
 */
export function normalizeHidden(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return []
  const list = Array.isArray(value.hidden) ? value.hidden : []
  const out = []
  for (const entry of list) {
    const id = typeof entry === 'string' ? entry.trim() : ''
    if (id !== '' && !out.includes(id)) out.push(id)
  }
  return out
}

/**
 * The hidden ids on disk. A missing or unreadable file is the fresh-install case, not a
 * failure: nothing is hidden yet.
 *
 * @param {string} root
 * @param {{ readText?: (path: string, encoding: string) => Promise<string> }} [io]
 * @returns {Promise<string[]>}
 */
export async function readHidden(root, { readText = readFile } = {}) {
  try {
    return normalizeHidden(JSON.parse(await readText(hiddenPath(root), 'utf8')))
  } catch {
    return []
  }
}

/**
 * Write the hidden ids, creating the root if this is the first thing to need it.
 *
 * The write is a rename over the target so a reader never sees half a file: the surface
 * reads this on every provider list, which is often enough for a torn read to matter.
 *
 * @param {string} root
 * @param {readonly string[]} ids
 * @param {{ writeText?: Function, makeDir?: Function, move?: Function }} [io]
 * @returns {Promise<string[]>} what was written, normalized
 */
export async function writeHidden(root, ids, { writeText = writeFile, makeDir = mkdir, move = rename } = {}) {
  const clean = normalizeHidden({ hidden: ids })
  await makeDir(root, { recursive: true })
  const target = hiddenPath(root)
  const scratch = target + '.tmp'
  await writeText(scratch, JSON.stringify({ hidden: clean }, null, 2) + '\n', 'utf8')
  await move(scratch, target)
  return clean
}

/**
 * The ids after one provider is switched on or off.
 *
 * Pure, so the route's rule is testable without a filesystem: switching on removes the
 * id, switching off adds it, and the order is the order they were first hidden.
 *
 * @param {readonly string[]} current
 * @param {string} id
 * @param {boolean} hidden
 * @returns {string[]}
 */
export function withHidden(current, id, hidden) {
  const list = normalizeHidden({ hidden: current })
  if (hidden) return list.includes(id) ? list : [...list, id]
  return list.filter((entry) => entry !== id)
}
