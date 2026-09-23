/**
 * The library: where a finished run's bytes land, on this machine.
 *
 * THE URL IS NOT THE RESULT (founder, 2026-09-23: *"also for saving to local. we should
 * think about folder organization"*). A provider answers a link to its own output, and that
 * link is not a promise: RunningHub's upload links are documented as lasting a day, and its
 * output host's lifetime is undocumented. So a run that finishes downloads its bytes here,
 * and the record beside it keeps the path — "what did we ship and why" (epic 61 §12 rule 4)
 * then answers with a file rather than with a URL that may already be dead.
 *
 * ONE ROOT FOR EVERY PROVIDER, so the library is a property of the install rather than of
 * whoever made the asset:
 *
 *   <profile>/generate/library/<provider>/<workflow>/<yyyymmdd>-<jobId>.<ext>
 *
 * PROVIDER, THEN WORKFLOW, THEN THE DAY IN THE NAME (chosen by the founder, 2026-09-23).
 * The first two are how a person looks for a thing again — "the outfit swaps from last
 * week" — and the date is a prefix rather than a folder because a workflow's own series is
 * what you scroll, and a tree of empty day-folders would be mostly empty.
 *
 * SAVING NEVER FAILS A RUN. A download that times out, a host that refuses, a disk that is
 * full: each is recorded against the asset and the run still reports what the provider
 * said. The bytes are the durable half, and the record says plainly when they are missing.
 *
 * NO KEY IS HERE. Both providers' outputs are public signed links, so the download carries
 * nothing but the URL, and a token never travels into a file path or a record.
 *
 * @module @muen/dsh-generate/lib/library
 */
import { mkdir, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

/** One download: generous for a picture, short enough that a stuck host gives up. */
const TIMEOUT_MS = 30000

/** What a content type means on disk, when the URL says nothing. */
const EXT_BY_TYPE = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
}

/** A path segment nobody can climb out of, or lie to a filesystem with. */
function safe(part, fallback = 'unknown') {
  const text = String(part === undefined || part === null ? '' : part)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^[.-]+/, '')
    .replace(/[.-]+$/, '')
  return text === '' ? fallback : text
}

/** `2026-09-23T…` → `20260923`. A record with no date says so rather than guessing today. */
function dayOf(at) {
  const text = String(at || '')
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(text)
  return match ? match[1] + match[2] + match[3] : 'undated'
}

/** The extension a saved file gets: the provider's own type first, then the URL, then the header. */
function extOf({ type, url, contentType }) {
  const given = safe(type, '')
  if (given !== '' && /^[a-z0-9]{2,5}$/.test(given)) return given
  const path = String(url || '').split('?')[0].split('#')[0]
  const tail = path.includes('.') ? path.slice(path.lastIndexOf('.') + 1) : ''
  if (/^[a-z0-9]{2,5}$/i.test(tail)) return tail.toLowerCase()
  const header = String(contentType || '').split(';')[0].trim().toLowerCase()
  return EXT_BY_TYPE[header] || 'bin'
}

/**
 * Where one asset lands, as a path relative to the library root. Exported because the
 * record says where the file went, and a check wants to say the same thing.
 */
export function libraryPath(root, { provider, workflow, jobId, at, index = 0, ext = 'bin' }) {
  const name = dayOf(at) + '-' + safe(jobId, 'job') + (index > 0 ? '-' + (index + 1) : '') + '.' + ext
  return join(root, safe(provider), safe(workflow, 'workflow'), name)
}

/**
 * Download every URL a finished run answered, and answer where each one landed.
 *
 * A file that is already there is left alone: a poll can read the same terminal state twice
 * (the pane asks every two seconds until it stops, and a restart re-asks), and re-writing
 * the same bytes would only risk a half-written file.
 *
 * @returns {Promise<{ saved: object[], errors: object[] }>}
 */
export async function saveAssets({ root, provider, workflow, jobId, at, urls, types = [], fetchImpl = fetch, timeoutMs = TIMEOUT_MS } = {}) {
  const saved = []
  const errors = []
  const list = Array.isArray(urls) ? urls : []
  for (const [index, url] of list.entries()) {
    if (typeof url !== 'string' || url === '') continue
    let response
    try {
      response = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs) })
    } catch (error) {
      const kind = error && error.name
      errors.push({ url, error: kind === 'TimeoutError' || kind === 'AbortError' ? 'timeout' : 'unreachable' })
      continue
    }
    if (!response.ok) {
      errors.push({ url, error: 'http-' + response.status })
      continue
    }
    let bytes
    try {
      bytes = Buffer.from(await response.arrayBuffer())
    } catch (error) {
      errors.push({ url, error: 'unreadable' })
      continue
    }
    const ext = extOf({ type: types[index], url, contentType: response.headers && response.headers.get ? response.headers.get('content-type') : null })
    const file = libraryPath(root, { provider, workflow, jobId, at, index, ext })
    try {
      await mkdir(join(root, safe(provider), safe(workflow, 'workflow')), { recursive: true })
      // Already saved: the same bytes under the same name are not saved twice.
      try {
        await stat(file)
        saved.push({ file, bytes: bytes.length, type: ext, url, already: true })
        continue
      } catch {
        // Not there yet, which is the ordinary case.
      }
      await writeFile(file, bytes)
    } catch (error) {
      errors.push({ url, error: 'unwritable', detail: String((error && error.message) || error) })
      continue
    }
    saved.push({ file, bytes: bytes.length, type: ext, url })
  }
  return { saved, errors }
}
