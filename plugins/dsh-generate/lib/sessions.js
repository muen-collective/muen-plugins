/**
 * The session store (epic 64 S5): a piece of work, written down.
 *
 * WHAT A SESSION IS (epic 64 §7a): one workflow, the values it was run with, the files a
 * person picked, and the runs those values made — a **form session**, which is the smallest
 * honest version of the job session: `values`, `uploads` and `runIds` are exactly one entry
 * of a future `steps` array. One file per session:
 *
 *   <profile>/generate/sessions/<id>.json
 *
 * THE RUN RECORD STAYS THE PER-JOB TRUTH. A session is an index over run ids plus the form,
 * so no payload is written twice with two spellings, and a run that outlives its session is
 * still a run. The reverse is not true: a session whose runs are gone says so.
 *
 * `state/<workflow>.json` IS SUPERSEDED (epic 64 §7). A session's rows hold the values that
 * were used, and the values a form OPENS with come from the adapter's authored `ui.defaults`
 * — keeping a per-workflow snapshot would let one person's one-off tweak silently become
 * everyone's default, which is exactly what the founder's knob rule forbids (2026-09-25:
 * *"after finding the optimal settings … they should not need to find optimal parameters by
 * doing knob turning again"*). Editing a default is a knowledge change: measured, written to
 * the skill's md, then authored into `ui.defaults`.
 *
 * A FILE THAT IS NOT OURS IS REPORTED, NOT OBEYED. A session written by a newer schema, or a
 * half-written one, is listed as `skipped` with its own reason — never merged, never guessed
 * at, and never a reason for the list to fail. The same rule the folder registry keeps.
 *
 * THE ID IS A PATH SEGMENT, so it is sanitised on the way in and on the way out: a session id
 * off the wire cannot name a file outside `sessions/`.
 *
 * @module @muen/dsh-generate/lib/sessions
 */
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { safe } from './library.js'

/** The schema this store writes and the only one it obeys. */
export const SESSION_SCHEMA = 'muen-generate-session/v1'

/** Where sessions live, under the profile's own generate root. */
export const SESSIONS_DIR = 'sessions'

/** A cap on the values a session may carry: a form, not a dump. */
const MAX_VALUE_KEYS = 200
const MAX_RUN_IDS = 2000

/** `2026-09-26T03:04:05.000Z` → `20260926-030405`, the id an unnamed session gets. */
export function sessionIdFrom(at) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/.exec(String(at || ''))
  if (match === null) return null
  return 's-' + match[1] + match[2] + match[3] + '-' + match[4] + match[5] + match[6]
}

/** Where one session lives. The id is sanitised, so this cannot leave `sessions/`. */
export function sessionPath(root, id) {
  return join(root, SESSIONS_DIR, safe(id, 'session') + '.json')
}

/** A non-empty string, or `null`. */
function text(value) {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null
}

/** Values as the form hands them over: a flat object of scalars and list rows. */
function valuesObject(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {}
  const out = {}
  for (const [key, value] of Object.entries(input)) {
    if (Object.keys(out).length >= MAX_VALUE_KEYS) break
    if (key === '' || key.length > 200) continue
    if (value === undefined || value === null) continue
    if (typeof value === 'object') {
      // A list door's rows: kept as data, never stringified into one cell.
      try {
        JSON.stringify(value)
      } catch {
        continue
      }
      out[key] = value
      continue
    }
    out[key] = value
  }
  return out
}

/** The picked files a session holds, keyed by the door they were picked for. */
function uploadsObject(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {}
  const out = {}
  for (const [door, entry] of Object.entries(input)) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue
    const sha256 = text(entry.sha256)
    const file = text(entry.file)
    if (sha256 === null && file === null) continue
    out[door] = {
      sha256,
      file,
      name: text(entry.name),
      type: text(entry.type),
    }
  }
  return out
}

/** The runs this session made, in the order they were made. */
function runIdsList(input) {
  if (!Array.isArray(input)) return []
  const out = []
  for (const entry of input) {
    if (typeof entry !== 'string' && typeof entry !== 'number') continue
    const id = String(entry).trim()
    if (id === '' || out.includes(id)) continue
    out.push(id)
    if (out.length >= MAX_RUN_IDS) break
  }
  return out
}

/**
 * One session, normalised — or the reason it cannot be.
 *
 * A session a caller sends is not trusted to be the right shape: a value that is not an
 * object, a run id that is not a string, an id that names no session. What is unusable is
 * refused by name; what is merely absent gets the documented default (`open: true`, an empty
 * form, no runs).
 *
 * @returns {{ session: object } | { error: string, detail: string }}
 */
export function normaliseSession(input, { id = null, at = new Date().toISOString(), existing = null } = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { error: 'bad-session', detail: 'a session is a JSON object' }
  }
  if (input.schema !== undefined && input.schema !== SESSION_SCHEMA) {
    return { error: 'unknown-schema', detail: 'this store writes ' + SESSION_SCHEMA }
  }
  // THE ID IS THE FILE'S NAME, so the id a caller gets back is the one that will find it
  // again: a hostile or merely awkward id is sanitised HERE rather than only on the way to
  // disk, because a session whose stored id disagrees with its own filename is a trap for
  // the next reader.
  const wanted = text(id) || text(input.id)
  let sessionId
  if (wanted !== null) {
    sessionId = safe(wanted, 'session')
  } else {
    sessionId = sessionIdFrom(at)
    if (sessionId === null) return { error: 'bad-id', detail: 'an id or a timestamp is required' }
  }
  const createdAt = (existing && text(existing.createdAt)) || text(input.createdAt) || at
  return {
    session: {
      schema: SESSION_SCHEMA,
      id: sessionId,
      provider: text(input.provider) || (existing && existing.provider) || null,
      adapter: text(input.adapter) || (existing && existing.adapter) || null,
      title: text(input.title) || (existing && existing.title) || null,
      // The name a person set. Absent on creation it is the workflow's title, which the
      // caller supplies; this module never invents one.
      name: text(input.name) || (existing && existing.name) || null,
      createdAt,
      updatedAt: at,
      // OPEN means "resume me on the next launch" (epic 64 §7, D8). Absent is open: a
      // session a person is working on is open by definition.
      open: input.open === undefined ? (existing ? existing.open !== false : true) : input.open === true,
      values: valuesObject(input.values !== undefined ? input.values : existing && existing.values),
      uploads: uploadsObject(input.uploads !== undefined ? input.uploads : existing && existing.uploads),
      runIds: runIdsList(input.runIds !== undefined ? input.runIds : existing && existing.runIds),
    },
  }
}

/** One session, or `null`. An unreadable file is `null` here; `listSessions` names the reason. */
export async function readSession(root, id, { readText = readFile } = {}) {
  if (text(id) === null) return null
  try {
    const parsed = JSON.parse(await readText(sessionPath(root, id), 'utf8'))
    if (!parsed || typeof parsed !== 'object' || parsed.schema !== SESSION_SCHEMA) return null
    return parsed
  } catch {
    return null
  }
}

/**
 * Every session this install holds, newest first — and every file that is NOT one, named.
 *
 * A file that cannot be read, or whose schema is not ours, does not fail the list and is not
 * silently dropped either: it arrives in `skipped` with its reason, because a session that
 * disappeared without a word is the failure this store exists to prevent.
 */
export async function listSessions(root, { listDir = readdir, readText = readFile } = {}) {
  let names = []
  try {
    names = await listDir(join(root, SESSIONS_DIR))
  } catch {
    return { sessions: [], skipped: [], total: 0 }
  }
  const sessions = []
  const skipped = []
  for (const name of names) {
    if (!String(name).endsWith('.json')) continue
    const id = String(name).slice(0, -'.json'.length)
    let parsed
    try {
      parsed = JSON.parse(await readText(join(root, SESSIONS_DIR, String(name)), 'utf8'))
    } catch {
      skipped.push({ id, reason: 'unreadable' })
      continue
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      skipped.push({ id, reason: 'bad-session' })
      continue
    }
    if (parsed.schema !== SESSION_SCHEMA) {
      skipped.push({ id, reason: 'unknown-schema', schema: parsed.schema === undefined ? null : String(parsed.schema) })
      continue
    }
    sessions.push(parsed)
  }
  sessions.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))
  return { sessions, skipped, total: sessions.length }
}

/** Write one session, whole. The caller has already normalised it. */
export async function writeSession(root, session, { makeDir = mkdir, writeText = writeFile } = {}) {
  await makeDir(join(root, SESSIONS_DIR), { recursive: true })
  await writeText(sessionPath(root, session.id), JSON.stringify(session, null, 2) + '\n', 'utf8')
  return session
}

/**
 * Remove one session. Reports whether there was one to remove: deleting nothing is an answer,
 * not a success, so the route can say `404` rather than pretending.
 */
export async function deleteSession(root, id, { removeFile = rm } = {}) {
  if (text(id) === null) return { removed: false }
  try {
    await removeFile(sessionPath(root, id))
    return { removed: true }
  } catch {
    return { removed: false }
  }
}
