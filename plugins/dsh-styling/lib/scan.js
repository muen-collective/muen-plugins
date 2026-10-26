/**
 * Probe a folder into looks.
 *
 * THE CONTRACT IS THE FOLDER, NOT A DATABASE. A look is a pair of sibling folders:
 *
 *   look 001-originals/   the photographs of that look (one file per view)
 *   look 001-final/       the styled output(s)
 *
 * Both spellings the person might write are accepted — `look 001-originals`,
 * `look-001-final`, `Look_001_Originals`, `look 1 finals`. The number is the key.
 *
 * WHEN THE FOLDER IS FLAT, the probe creates the structure: image files at the root
 * are sorted naturally and grouped in batches of `views` (4 by default), and each
 * batch becomes a `look NNN-originals` + `look NNN-final` pair. The files are HARD
 * LINKED into the look folder — the bytes are not duplicated, the source is not
 * moved, and a later edit of either name changes the one inode. A file system that
 * refuses a link (another volume) gets a copy instead.
 *
 * THE PROBE IS ADDITIVE. Running it again pairs the folders, keeps decisions by look
 * id, and only groups flat images whose basenames are not already in a look folder.
 *
 * @module @muen/dsh-styling/lib/scan
 */
import { access, copyFile, link, mkdir, readFile, readdir } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'

/** The extensions the probe will treat as a photograph. */
const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.tif', '.tiff', '.heic', '.bmp'])

/** `look 001-originals`, `look-1-final`, `Look_003_Finals`. */
export const LOOK_RE = /^look[\s._-]*(\d{1,4})[\s._-]*(originals?|finals?)$/i

/** The id every surface uses. */
export function lookId(num) {
  return 'look-' + String(num).padStart(3, '0')
}

/** The folder name for one side of a look. */
export function lookFolderName(num, side) {
  return 'look ' + String(num).padStart(3, '0') + '-' + (side === 'originals' ? 'originals' : 'final')
}

function isImage(name) {
  return IMAGE_EXT.has(extname(String(name || '')).toLowerCase())
}

/** Numeric-aware, case-insensitive ordering: `2` before `10`. */
export function naturalCompare(a, b) {
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' })
}

async function listImages(dir) {
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return []
  }
  return entries
    .filter((entry) => entry.isFile() && isImage(entry.name))
    .map((entry) => join(dir, entry.name))
    .sort((a, b) => naturalCompare(basename(a), basename(b)))
}

async function ensureDir(dir) {
  await mkdir(dir, { recursive: true })
}

async function exists(file) {
  try {
    await access(file)
    return true
  } catch {
    return false
  }
}

/** Hard-link, or copy when the file system will not link across volumes. */
async function linkOrCopy(source, target) {
  if (await exists(target)) return false
  try {
    await link(source, target)
    return true
  } catch {
    await copyFile(source, target)
    return true
  }
}

/** A cover prefers the view named front/cover, then the first frame. */
function pickCover(list, preferred) {
  if (!Array.isArray(list) || list.length === 0) return null
  if (preferred) {
    const hit = list.find((path) => new RegExp('(^|[^a-z])' + preferred + '([^a-z]|$)', 'i').test(basename(path)))
    if (hit) return hit
  }
  return list[0]
}

/** The four camera views a lookbook image can be. */
const VIEWS = new Set(['front', 'side', 'back', 'detail'])

/**
 * A view named in the filename, when the person wrote one:
 * `front.jpg`, `side-2.png`, `look back.png`, `detail_close.jpg`.
 */
function viewFromName(name) {
  const base = basename(name).toLowerCase()
  if (/\b(front|cover)\b/.test(base)) return 'front'
  if (/\b(side|profile)\b/.test(base)) return 'side'
  if (/\b(back|rear)\b/.test(base)) return 'back'
  if (/\b(detail|closeup|close-up|macro|crop)\b/.test(base)) return 'detail'
  return null
}

/**
 * The VL step writes `views.json` in each folder: `{ "b3.png": "side", … }`.
 * It is the only source that can tell b1/b2/b3/b4 apart when the names carry
 * no view; without it the probe falls back to pairing by position.
 */
async function readViews(dir) {
  try {
    const parsed = JSON.parse(await readFile(join(dir, 'views.json'), 'utf8'))
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const out = {}
    for (const [name, value] of Object.entries(parsed)) {
      const view = String(value || '').toLowerCase()
      if (VIEWS.has(view)) out[basename(name)] = view
    }
    return out
  } catch {
    return {}
  }
}

/** The name a look shows until a person (or the agent) names it. */
function defaultName(num) {
  return 'look ' + String(num).padStart(3, '0')
}

/**
 * Probe one root.
 *
 * @returns {Promise<{root:string, looks:Array, created:number}>}
 */
export async function probe(root, { views = 4 } = {}) {
  const size = Math.max(1, Math.min(12, Number(views) || 4))
  await ensureDir(root)

  let entries = []
  try {
    entries = await readdir(root, { withFileTypes: true })
  } catch {
    return { root, looks: [], created: 0 }
  }

  const pairs = new Map()
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const match = entry.name.match(LOOK_RE)
    if (!match) continue
    const num = Number(match[1])
    const side = match[2].toLowerCase().startsWith('original') ? 'originals' : 'final'
    const pair = pairs.get(num) || { num, originals: null, final: null }
    pair[side] = join(root, entry.name)
    pairs.set(num, pair)
  }

  // Every basename already inside a look folder is accounted for, so a flat file
  // that has already been linked is not grouped a second time.
  const accounted = new Set()
  for (const pair of pairs.values()) {
    for (const dir of [pair.originals, pair.final]) {
      if (!dir) continue
      for (const path of await listImages(dir)) accounted.add(basename(path))
    }
  }

  // Flat images at the root that no look folder accounts for. They become new looks
  // after the highest existing number.
  const flat = (await listImages(root)).filter((path) => !accounted.has(basename(path)))
  let created = 0
  if (flat.length > 0) {
    let next = pairs.size === 0 ? 1 : Math.max(...pairs.keys()) + 1
    for (let index = 0; index < flat.length; index += size) {
      const batch = flat.slice(index, index + size)
      const num = next++
      const originalsDir = join(root, lookFolderName(num, 'originals'))
      const finalDir = join(root, lookFolderName(num, 'final'))
      await ensureDir(originalsDir)
      await ensureDir(finalDir)
      for (const source of batch) {
        await linkOrCopy(source, join(originalsDir, basename(source)))
      }
      pairs.set(num, { num, originals: originalsDir, final: finalDir })
      created += 1
    }
  }

  const looks = []
  for (const num of [...pairs.keys()].sort((a, b) => a - b)) {
    const pair = pairs.get(num)
    // A final folder without an originals folder cannot be reviewed; leave it alone.
    if (!pair.originals) continue
    const originals = await listImages(pair.originals)
    if (originals.length === 0) continue
    const finalDir = pair.final || join(root, lookFolderName(num, 'final'))
    await ensureDir(finalDir)
    const finals = await listImages(finalDir)
    const originalLabels = await readViews(pair.originals)
    const finalLabels = await readViews(finalDir)
    // The VL pass is the authority: an original and a final with the same view
    // are a pair, regardless of their file order. A view with no matching final
    // stays original — a different view is never substituted for it.
    const views = []
    const used = new Set()
    for (let index = 0; index < originals.length; index += 1) {
      const original = originals[index]
      const view = originalLabels[basename(original)] || viewFromName(original)
      let final = null
      if (view) {
        const at = finals.findIndex(
          (path, finalIndex) =>
            !used.has(finalIndex) &&
            (finalLabels[basename(path)] || viewFromName(path)) === view,
        )
        if (at >= 0) {
          final = finals[at]
          used.add(at)
        }
      } else {
        // No VL label: keep the old positional pairing for unlabelled folders.
        final = finals[index] || null
        if (final) used.add(index)
      }
      views.push({ original, final, view: view || null })
    }
    const coverPair = views.find((entry) => entry.view === 'front' && entry.final) || views.find((entry) => entry.final) || null
    const coverOriginal = (coverPair && coverPair.original) || pickCover(originals, 'front') || originals[0]
    const coverFinal =
      (coverPair && coverPair.final) || pickCover(finals, 'cover') || pickCover(finals, 'front') || finals[0] || null
    looks.push({
      id: lookId(num),
      num,
      name: defaultName(num),
      originalsDir: pair.originals,
      finalDir,
      originals,
      finals,
      coverOriginal,
      coverFinal,
      // The stage's strip: one row per original view, final paired by the VL view.
      views,
    })
  }

  return { root, looks, created }
}
