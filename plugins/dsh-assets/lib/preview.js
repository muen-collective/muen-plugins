/**
 * Previews: a small copy of a picture, made once and kept beside the record.
 *
 * WHY THIS EXISTS: the grid draws a tile per asset, and a tile is 240–400px wide. Reading the
 * original for each one means a folder of 1,296 pictures (measured on this machine) hands the
 * browser gigabytes to paint a wall of thumbnails — and the honest fix is not a cache with a
 * lifetime, it is a smaller file that exists because the original does.
 *
 * THE ORIGINAL IS NEVER TOUCHED. A preview is written under `<profile>/assets/proxies/`, named
 * by a hash of the original's path, mtime and size — so a picture replaced in place gets a new
 * preview (the old one is simply orphaned) and the same picture drawn twice reads the same
 * file. Nothing here writes near the person's own folders.
 *
 * THE RESIZER IS THE PLATFORM'S. `sips` on macOS is present on every install and needs no
 * dependency; a host without it answers `canPreview: false` and the route serves the original
 * instead, because a slow grid is better than a broken one. The command is injectable so a
 * verify run never spawns anything.
 *
 * @module @muen/dsh-assets/lib/preview
 */
import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdir, rename, stat as statFile } from 'node:fs/promises'
import { join } from 'node:path'

/** The widths the route will make: a tile, a large tile, and nothing absurd. */
export const PREVIEW_MIN = 32
export const PREVIEW_MAX = 2048

/** What one preview costs on disk. Above this the original is served instead. */
const MAX_PREVIEW_BYTES = 4 * 1024 * 1024

/** Whether this host can make a preview at all. */
export function canPreview(platform = process.platform) {
  return platform === 'darwin'
}

/** The extensions worth resizing: a video frame is not a resize job, it is a decode. */
const RESIZABLE = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'tif', 'tiff', 'heic', 'bmp'])

export function isResizable(ext) {
  return RESIZABLE.has(String(ext || '').toLowerCase())
}

/** The name a preview gets: the original's identity, not its contents. */
export function previewName({ path, mtimeMs, size, width }) {
  const digest = createHash('sha1')
    .update(String(path) + '|' + String(mtimeMs) + '|' + String(size) + '|' + String(width))
    .digest('hex')
  return digest + '.jpg'
}

/** The resizer, as a promise. macOS `sips`, with the sizes as ARGV — never interpolated. */
function sips(source, target, width, { run = execFile, timeoutMs = 20000 } = {}) {
  return new Promise((resolve, reject) => {
    run(
      'sips',
      ['-Z', String(width), '-s', 'format', 'jpeg', '-s', 'formatOptions', '72', source, '--out', target],
      { timeout: timeoutMs },
      (error) => (error ? reject(error) : resolve({ ok: true })),
    )
  })
}

/**
 * The preview for one file, made on first ask.
 *
 * @returns {Promise<{ file: string, cached: boolean, width: number } | { error: string, detail?: string }>}
 */
export async function previewFor({
  path,
  ext,
  width,
  cacheDir,
  platform = process.platform,
  stat = statFile,
  run,
  resize = sips,
} = {}) {
  const wanted = Number(width)
  if (!Number.isInteger(wanted) || wanted < PREVIEW_MIN || wanted > PREVIEW_MAX) {
    return { error: 'bad-width' }
  }
  if (!canPreview(platform)) return { error: 'unsupported' }
  if (!isResizable(ext)) return { error: 'not-resizable' }

  let info
  try {
    info = await stat(path)
  } catch {
    return { error: 'missing-file' }
  }
  if (!info.isFile()) return { error: 'missing-file' }

  const file = join(cacheDir, previewName({ path, mtimeMs: info.mtimeMs, size: info.size, width: wanted }))
  try {
    const cached = await stat(file)
    if (cached.isFile() && cached.size > 0) return { file, cached: true, width: wanted }
  } catch {
    // Not made yet, which is the ordinary first ask.
  }

  await mkdir(cacheDir, { recursive: true })
  // WRITE SOMEWHERE ELSE, THEN RENAME: two tiles asking at once, or a reader arriving
  // mid-write, must never see half a picture under the real name.
  const temporary = file + '.' + process.pid + '.' + Math.random().toString(36).slice(2) + '.part'
  try {
    await resize(path, temporary, wanted, { run })
  } catch (error) {
    return { error: 'resize-failed', detail: String((error && error.message) || error) }
  }
  try {
    const made = await stat(temporary)
    if (!made.isFile() || made.size === 0) return { error: 'resize-failed', detail: 'no output' }
    if (made.size > MAX_PREVIEW_BYTES) return { error: 'too-big' }
    await rename(temporary, file)
  } catch (error) {
    return { error: 'resize-failed', detail: String((error && error.message) || error) }
  }
  return { file, cached: false, width: wanted }
}
