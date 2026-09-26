/**
 * The folder registry: the project folders a person has added to the library.
 *
 * THE LIBRARY STARTS EMPTY (founder, 2026-09-26). There is no root that is scanned by
 * default and no set of records that appears whether or not a person asked for it:
 * `folders.json` lists what they added, and a fresh install answers nothing. Two earlier
 * answers to the same question were tried and both were wrong — "the records only" ate the
 * work that predates this plugin, and "everything under a root" ate the Desktop (1,259
 * image files under one, measured the same day).
 *
 * A FOLDER IS THE PERSON'S OWN AND LIVES OUTSIDE THIS APP — Desktop, Documents, a drive —
 * so Finder, email and AirDrop reach the pictures with no export step. Their reason is the
 * founder's: *"kun creates inside .kun and it's a pain to dig it out when I need to attach
 * or send to people."*
 *
 * ONE FILE, ONE WRITER, AND LOSING IT COSTS THE GROUPING — never a picture. The file is
 * `<profile>/assets/folders.json`; the paths in it are absolute and are kept as typed
 * (after `~` expansion) so the same folder is the same entry twice over.
 *
 * @module @muen/dsh-assets/lib/folders
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { isAbsolute, join, normalize } from 'node:path'

/** The schema string a reader can trust, and can refuse by name. */
export const FOLDERS_SCHEMA = 'muen-assets-folders/v1'

/** The registry file's name under this plugin's root. */
export const FOLDERS_FILE = 'folders.json'

/** The path of the registry, given this plugin's root. */
export function foldersPath(root) {
  return join(root, FOLDERS_FILE)
}

/**
 * `~` and `~/…` expand; anything else is left as it is, because a relative path is not a
 * folder a person chose. Returns null for input that cannot be a folder.
 */
export function expandFolder(value, home = homedir()) {
  const text = String(value === undefined || value === null ? '' : value).trim()
  if (text === '' || text.length > 4096 || text.includes('\0')) return null
  if (text === '~') return home
  const expanded = text.startsWith('~/') || text.startsWith('~\\') ? join(home, text.slice(2)) : text
  const normal = normalize(expanded)
  // An absolute path only: the registry answers "which folder", and a relative one would
  // mean a different folder for whoever happened to be running.
  if (!isAbsolute(normal) && !/^[a-zA-Z]:[\\/]/.test(normal)) return null
  return normal
}

/** One entry, in the shape the file holds and a surface reads. */
function entryOf(folder) {
  const path = expandFolder(folder && folder.path)
  if (path === null) return null
  const label = String((folder && folder.label) || '').trim().slice(0, 80)
  const addedAt = String((folder && folder.addedAt) || '').trim()
  return { path, label, addedAt }
}

/**
 * The registry as stored. A missing file, an unreadable one, or an unknown `schema` all
 * answer an empty list rather than throwing: this is a read of a person's own note to
 * themselves, and a broken one must not take the surface down with it.
 */
export async function readFolders(root, { readText = readFile } = {}) {
  let parsed
  try {
    parsed = JSON.parse(await readText(foldersPath(root), 'utf8'))
  } catch {
    return { schema: FOLDERS_SCHEMA, folders: [], known: true }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { schema: FOLDERS_SCHEMA, folders: [], known: true }
  const known = parsed.schema === FOLDERS_SCHEMA
  const list = Array.isArray(parsed.folders) ? parsed.folders : []
  const folders = []
  const seen = new Set()
  for (const raw of list) {
    const entry = entryOf(raw)
    if (entry === null || seen.has(entry.path)) continue
    seen.add(entry.path)
    folders.push(entry)
  }
  // An unknown schema is reported rather than obeyed: the list is still read, because the
  // shape is small and forward-compatible, but a caller can say the file is not ours.
  return { schema: FOLDERS_SCHEMA, folders, known, found: parsed.schema === undefined ? undefined : String(parsed.schema) }
}

/**
 * Write the registry. The caller decides what the list is; this only refuses entries that
 * cannot be folders and de-duplicates by path.
 */
export async function writeFolders(root, folders, { writeText = writeFile, makeDir = mkdir, now = () => new Date().toISOString() } = {}) {
  const kept = []
  const seen = new Set()
  for (const raw of Array.isArray(folders) ? folders : []) {
    const entry = entryOf(raw)
    if (entry === null || seen.has(entry.path)) continue
    seen.add(entry.path)
    kept.push({ path: entry.path, label: entry.label, addedAt: entry.addedAt || now() })
  }
  await makeDir(root, { recursive: true })
  await writeText(foldersPath(root), JSON.stringify({ schema: FOLDERS_SCHEMA, folders: kept }, null, 2) + '\n', 'utf8')
  return kept
}
