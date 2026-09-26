/**
 * The uploads copy (epic 64 S2): the picked file, kept on this machine.
 *
 * THE PROBLEM THIS SOLVES. When a person picks a picture for an image door, the host
 * forwards it to the provider and the provider answers a handle — RunningHub a `fileName`,
 * Krea a URL. Those handles are the ONLY record of what went in, and both are the wrong
 * shape for a durable one: RunningHub's guide says the file is not hosted, and Krea's asset
 * link has its own lifetime. So a form restored tomorrow would hold a dead handle, and a
 * session that cannot say what it was given is not a session.
 *
 * So the bytes are kept here, before the provider is asked, and the answer carries the hash
 * beside the handle. A later slice re-uploads from this copy (`POST …/restore`), which is
 * why the copy is content-addressed and complete rather than a thumbnail or a reference.
 *
 * WHY THE PROFILE AND NOT THE PERSON'S SAVE FOLDER (epic 64 §8): an upload is an input to a
 * form, not a picture the person made. It has to survive the save folder being changed, and
 * it is the one thing a restored session needs and cannot re-fetch.
 *
 *   <profile>/generate/<provider>/uploads/<sha256>.<ext>
 *
 * THE HASH IS THE NAME, so the same bytes are written once however many times they are
 * picked: a person who clears a door and picks the same picture again costs one file, not
 * two. The extension comes from the content type first and the file's own name second,
 * because two names for the same bytes should still land on one path — and the name is kept
 * for provenance only, never used as one.
 *
 * NOTHING HERE SPENDS OR TALKS TO A PROVIDER, and nothing here can fail an upload: the
 * caller keeps the provider's answer whatever this returns, because a full disk must not
 * stop a person from generating. A failure is reported in the answer instead.
 *
 * @module @muen/dsh-generate/lib/uploads
 */
import { createHash } from 'node:crypto'
import { mkdir, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { EXT_BY_TYPE, safe } from './library.js'

/** The folder the kept copies live in, under the provider's own root. */
export const UPLOADS_DIR = 'uploads'

/** How long an extension may be before it is not an extension. */
const EXT_RE = /^[a-z0-9]{2,5}$/

/**
 * The extension a kept copy gets.
 *
 * THE CONTENT TYPE WINS, because it describes the bytes rather than what somebody named
 * them: the same picture picked twice under two names is one file, and a `.png` that is
 * really a JPEG is stored as what it is. The name is the fallback, and `bin` is the last
 * resort — an honest "we do not know" rather than a guess dressed as a format.
 *
 * @param {string} name - the picked file's name, for provenance and as a fallback.
 * @param {string} type - the request's content type.
 * @returns {string} a lower-case extension without the dot, or `''` when nothing is known.
 */
export function uploadExt(name, type) {
  const header = String(type || '').split(';')[0].trim().toLowerCase()
  const byType = EXT_BY_TYPE[header]
  if (byType !== undefined) return byType
  const tail = String(name || '')
    .split(/[\\/]/)
    .pop()
    .split('.')
  const candidate = tail.length > 1 ? tail.pop().toLowerCase() : ''
  if (EXT_RE.test(candidate)) return candidate
  return header === '' || header === 'application/octet-stream' ? 'bin' : ''
}

/** Where one kept copy lives, relative to the provider's own root. */
export function uploadPath(root, sha256, ext = '') {
  const file = ext === '' ? String(sha256) : String(sha256) + '.' + ext
  return join(root, UPLOADS_DIR, safe(file, 'upload'))
}

/**
 * Keep one picked file, once.
 *
 * @param {object} options
 * @param {string} options.root - the provider's own data root (`<profile>/generate/<provider>`).
 * @param {string} options.name - the file's name, kept for provenance.
 * @param {string} options.type - the request's content type.
 * @param {Buffer} options.bytes - the file itself.
 * @param {Function} [options.readFileImpl] - unused here; the seam verify replaces the writers with.
 * @returns {Promise<{ sha256: string, file: string, bytes: number, name: string, type: string, existed: boolean } | { error: string, detail: string }>}
 */
export async function keepUpload({ root, name, type, bytes, makeDir = mkdir, writeFileImpl = writeFile, statFile = stat } = {}) {
  const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes || [])
  const sha256 = createHash('sha256').update(buffer).digest('hex')
  const ext = uploadExt(name, type)
  const file = uploadPath(root, sha256, ext)
  const answer = { sha256, file, bytes: buffer.length, name: String(name || ''), type: String(type || ''), ext }
  try {
    await statFile(file)
    // The same bytes are already here: writing them again would only risk a half-written file.
    return { ...answer, existed: true }
  } catch {
    // Not there yet, which is the ordinary case.
  }
  try {
    await makeDir(join(root, UPLOADS_DIR), { recursive: true })
    await writeFileImpl(file, buffer)
  } catch (error) {
    return { error: 'unwritable', detail: String((error && error.message) || error) }
  }
  return { ...answer, existed: false }
}
