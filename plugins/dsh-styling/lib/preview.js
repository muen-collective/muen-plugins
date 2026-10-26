/**
 * 2048px previews, made once and kept in the plugin's own proxies folder.
 *
 * The stage asks for a 2048px long edge, the grid for 640px, the strip for 320px.
 * Reading the original for every tile would hand the browser gigabytes to paint a
 * wall of thumbnails; the original is never touched, and a missing resizer simply
 * serves the original instead.
 *
 * `sips` is the platform resizer on macOS and needs no dependency. A host without it
 * answers `canPreview: false`.
 *
 * @module @muen/dsh-styling/lib/preview
 */
import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdir, rename, stat as statFile } from 'node:fs/promises'
import { join } from 'node:path'

export const PREVIEW_MIN = 32
export const PREVIEW_MAX = 2048
const MAX_PREVIEW_BYTES = 8 * 1024 * 1024
const RESIZABLE = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'tif', 'tiff', 'heic', 'bmp'])

export function canPreview(platform = process.platform) {
  return platform === 'darwin'
}

export function isResizable(ext) {
  return RESIZABLE.has(String(ext || '').toLowerCase())
}

export function previewName({ path, mtimeMs, size, width }) {
  const digest = createHash('sha1')
    .update(String(path) + '|' + String(mtimeMs) + '|' + String(size) + '|' + String(width))
    .digest('hex')
  return digest + '.jpg'
}

function sips(source, target, width, { run = execFile, timeoutMs = 30000 } = {}) {
  return new Promise((resolve, reject) => {
    run(
      'sips',
      ['-Z', String(width), '-s', 'format', 'jpeg', '-s', 'formatOptions', '82', source, '--out', target],
      { timeout: timeoutMs },
      (error) => (error ? reject(error) : resolve({ ok: true })),
    )
  })
}

/**
 * The preview for one file, made on first ask.
 *
 * @returns {Promise<{file:string, cached:boolean, width:number} | {error:string, detail?:string}>}
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
  if (!Number.isInteger(wanted) || wanted < PREVIEW_MIN || wanted > PREVIEW_MAX) return { error: 'bad-width' }
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
    // ordinary first ask
  }

  await mkdir(cacheDir, { recursive: true })
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
