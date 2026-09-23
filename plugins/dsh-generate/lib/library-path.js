/**
 * The Save folder choice, as the one small file it is.
 *
 * WHERE FINISHED RUNS LAND has two answers (founder, 2026-09-23: *"let's make save
 * folder default on desktop, and the user can click to choose a different folder"*):
 * a folder the person chose, else the Desktop. This module owns only the first
 * answer's storage — the chosen path lives in `<root>/library.json`, beside the
 * provider directories and nowhere near a key — and the precedence between the two
 * lives in lib/index.js (`libraryState`).
 *
 * The verbs live here rather than in index.js because the host half's contract is
 * that its entry file READS files and does not write them (verify/skill.mjs pins
 * that on `lib/index.js`): this file is the one place the setting is persisted,
 * the same way `hidden.js` is the one place the hide switches are.
 *
 * @module @muen/dsh-generate/lib/library-path
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

/** `<root>/library.json`: `{ "path": "/Users/you/Desktop" | null }`. */
export function libraryFileOf(root) {
  return join(root, 'library.json')
}

/**
 * The chosen folder, or null when nobody chose one.
 *
 * Anything unreadable or unrecognised answers null — a corrupt settings file falls
 * back to the project default instead of failing every run's save.
 */
export async function readChosenFolder(root) {
  try {
    const parsed = JSON.parse(await readFile(libraryFileOf(root), 'utf8'))
    const path = parsed && typeof parsed.path === 'string' ? parsed.path.trim() : ''
    return path === '' ? null : path
  } catch {
    return null
  }
}

/** Store the choice: an absolute folder, or null to go back to the project default. */
export async function writeChosenFolder(root, path) {
  await mkdir(root, { recursive: true })
  await writeFile(libraryFileOf(root), JSON.stringify({ path }, null, 2) + '\n', 'utf8')
}
