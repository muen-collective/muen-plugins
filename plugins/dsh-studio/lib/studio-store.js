// @muen/dsh-studio — the project/session store.
//
// One job: own the on-disk shape of a Studio project and answer CRUD for it. The
// host routes are a thin shell over this module so the suites can test the store
// against a temp directory without a web server, and the routes can stay boring.
//
// Shape (design doc §8):
//   <root>/projects/<pid>/project.json
//   <root>/projects/<pid>/sequences/<sid>/session.json
//
// Nothing here knows about providers, prompts or LLMs — those layers land in
// later slices and write into session.json's fields through the same PUT.
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { emptyBible } from './bibles.js'
import { emptyRecord, kindConfig } from './records.js'
import { validateEdl } from './edl.js'

export const SESSION_SCHEMA = 1

export const STAGES = ['character', 'outfit', 'scene', 'script', 'shoot', 'timeline']

export function emptyStages() {
  return Object.fromEntries(STAGES.map((key) => [key, { status: 'empty', gate: null }]))
}

export function emptySession(project, sequence) {
  return {
    schema: SESSION_SCHEMA,
    project,
    sequence,
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
    stages: emptyStages(),
    shots: [],
  }
}

export function emptyShot(id) {
  return {
    id,
    beat: '',
    camera: '',
    duration_s: 5,
    assets: [],
    prompt: '',
    look: null,
    gate: null,
    selects: [],
  }
}

/**
 * Where the store lives. Three answers, in order, and every one says which it
 * used — the same honesty Generate's rootNote() carries, because "which disk
 * did that write go to" is the first question after any missing file.
 */
export function resolveRoot({ config = {}, env = process.env, argv = process.argv } = {}) {
  if (config.dataRoot) return { kind: 'override', root: config.dataRoot }
  if (env.STUDIO_DATA_DIR) return { kind: 'override', root: env.STUDIO_DATA_DIR }
  const home = env.DSH_HOME || path.join(os.homedir(), '.dsh')
  const at = argv.indexOf('--profile')
  const profile = at >= 0 ? argv[at + 1] : undefined
  if (profile) {
    return { kind: 'profile', profile, root: path.join(home, 'profiles', profile, 'studio') }
  }
  return { kind: 'home', root: path.join(home, 'studio') }
}

/** Ids become path segments; a slug that escapes the store is refused, not sanitized silently. */
function validId(id) {
  return typeof id === 'string' && /^[a-z0-9][a-z0-9._-]{0,63}$/i.test(id) && !id.includes('..')
}

function fail(code, error) {
  return { ok: false, code, error }
}

/** A session document is only accepted whole and sane: schema, stages, shots. */
export function validateSession(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return fail(400, 'not-an-object')
  if (payload.schema !== SESSION_SCHEMA) return fail(400, 'schema')
  if (!payload.stages || typeof payload.stages !== 'object') return fail(400, 'stages')
  for (const key of STAGES) {
    const stage = payload.stages[key]
    if (!stage || typeof stage !== 'object' || typeof stage.status !== 'string') return fail(400, 'stage:' + key)
  }
  if (!Array.isArray(payload.shots)) return fail(400, 'shots')
  const seen = new Set()
  for (const shot of payload.shots) {
    if (!shot || typeof shot !== 'object') return fail(400, 'shot')
    if (!validId(shot.id) || seen.has(shot.id)) return fail(400, 'shot.id')
    seen.add(shot.id)
    if (typeof shot.duration_s !== 'number' || !(shot.duration_s >= 0)) return fail(400, 'shot.duration_s')
    if (!Array.isArray(shot.assets)) return fail(400, 'shot.assets')
    if (!Array.isArray(shot.selects)) return fail(400, 'shot.selects')
  }
  return { ok: true }
}

/** The store. Every method answers `{ ok, code?, error?, … }` — codes are HTTP-shaped. */
export function createStore(root) {
  const projectsDir = path.join(root, 'projects')

  const projectFile = (pid) => path.join(projectsDir, pid, 'project.json')
  const sessionFile = (pid, sid) => path.join(projectsDir, pid, 'sequences', sid, 'session.json')

  async function readJson(file) {
    try {
      return JSON.parse(await fs.readFile(file, 'utf8'))
    } catch {
      return null
    }
  }

  async function writeJson(file, value) {
    await fs.mkdir(path.dirname(file), { recursive: true })
    const tmp = file + '.tmp'
    await fs.writeFile(tmp, JSON.stringify(value, null, 2) + '\n', 'utf8')
    await fs.rename(tmp, file) // atomic: a half-written project is worse than a missing one
  }

  async function listProjects() {
    await fs.mkdir(projectsDir, { recursive: true })
    const names = await fs.readdir(projectsDir).catch(() => [])
    const out = []
    for (const name of names.sort()) {
      const project = await readJson(projectFile(name))
      if (!project) continue
      const sequences = await listSequences(name)
      out.push({ id: name, name: project.name, created: project.created, updated: project.updated, sequences: sequences.ok ? sequences.sequences : [] })
    }
    return { ok: true, projects: out }
  }

  async function createProject({ id, name }) {
    if (!validId(id)) return fail(400, 'project id must be a short slug')
    if (typeof name !== 'string' || name.trim() === '') return fail(400, 'project needs a name')
    if (await readJson(projectFile(id))) return fail(409, 'project exists')
    const now = new Date().toISOString()
    await writeJson(projectFile(id), { schema: 1, id, name: name.trim(), created: now, updated: now })
    return { ok: true, id, name: name.trim() }
  }

  async function readProject(pid) {
    if (!validId(pid)) return fail(400, 'bad project id')
    const project = await readJson(projectFile(pid))
    if (!project) return fail(404, 'no project')
    return { ok: true, project }
  }

  async function listSequences(pid) {
    if (!validId(pid)) return fail(400, 'bad project id')
    const dir = path.join(projectsDir, pid, 'sequences')
    const names = await fs.readdir(dir).catch(() => [])
    const out = []
    for (const name of names.sort()) {
      const session = await readJson(sessionFile(pid, name))
      if (!session) continue
      out.push({
        id: name,
        created: session.created,
        updated: session.updated,
        shots: session.shots.length,
        stages: session.stages,
      })
    }
    return { ok: true, sequences: out }
  }

  async function createSequence(pid, { id, name }) {
    if (!validId(pid)) return fail(400, 'bad project id')
    if (!validId(id)) return fail(400, 'sequence id must be a short slug')
    if (!(await readJson(projectFile(pid)))) return fail(404, 'no project')
    if (await readJson(sessionFile(pid, id))) return fail(409, 'sequence exists')
    const session = emptySession(pid, id)
    if (typeof name === 'string' && name.trim()) session.name = name.trim()
    await writeJson(sessionFile(pid, id), session)
    return { ok: true, id, session }
  }

  async function readSession(pid, sid) {
    if (!validId(pid) || !validId(sid)) return fail(400, 'bad id')
    const session = await readJson(sessionFile(pid, sid))
    if (!session) return fail(404, 'no session')
    return { ok: true, session }
  }

  async function writeSession(pid, sid, payload) {
    if (!validId(pid) || !validId(sid)) return fail(400, 'bad id')
    const checked = validateSession(payload)
    if (!checked.ok) return checked
    if (!(await readJson(projectFile(pid)))) return fail(404, 'no project')
    const session = { ...payload, project: pid, sequence: sid, updated: new Date().toISOString() }
    await writeJson(sessionFile(pid, sid), session)
    return { ok: true, session }
  }

  // ── the EDL (M7) ────────────────────────────────────────────────────────────

  const edlFile = (pid, sid) => path.join(projectsDir, pid, 'sequences', sid, 'edl.json')

  async function readEdl(pid, sid) {
    if (!validId(pid) || !validId(sid)) return fail(400, 'bad id')
    const edl = await readJson(edlFile(pid, sid))
    if (!edl) return fail(404, 'no edl')
    return { ok: true, edl }
  }

  /** Persists an EDL whole: a refused document is never half-written. */
  async function writeEdl(pid, sid, payload) {
    if (!validId(pid) || !validId(sid)) return fail(400, 'bad id')
    const checked = validateEdl(payload)
    if (!checked.ok) return checked
    if (!(await readJson(projectFile(pid)))) return fail(404, 'no project')
    if (!(await readJson(sessionFile(pid, sid)))) return fail(404, 'no session')
    const edl = { ...payload, updated: new Date().toISOString() }
    await writeJson(edlFile(pid, sid), edl)
    return { ok: true, edl }
  }

  // ── character bibles (M3) ───────────────────────────────────────────────────

  const characterFile = (pid, cid) => path.join(projectsDir, pid, 'characters', cid + '.json')

  async function listCharacters(pid) {
    if (!validId(pid)) return fail(400, 'bad project id')
    const dir = path.join(projectsDir, pid, 'characters')
    const names = await fs.readdir(dir).catch(() => [])
    const out = []
    for (const name of names.sort()) {
      if (!name.endsWith('.json')) continue
      const bible = await readJson(path.join(dir, name))
      if (bible) out.push(bible)
    }
    return { ok: true, characters: out }
  }

  async function createCharacter(pid, { id, name }) {
    if (!validId(pid)) return fail(400, 'bad project id')
    if (!validId(id)) return fail(400, 'character id must be a short slug')
    if (!(await readJson(projectFile(pid)))) return fail(404, 'no project')
    if (await readJson(characterFile(pid, id))) return fail(409, 'character exists')
    const bible = emptyBible(id, name)
    await writeJson(characterFile(pid, id), bible)
    return { ok: true, bible }
  }

  async function readCharacter(pid, cid) {
    if (!validId(pid) || !validId(cid)) return fail(400, 'bad id')
    const bible = await readJson(characterFile(pid, cid))
    if (!bible) return fail(404, 'no character')
    return { ok: true, bible }
  }

  /** Write a bible back. The bibles.js edit/approve/revise helpers own the rules; this persists. */
  async function writeCharacter(pid, cid, bible) {
    if (!validId(pid) || !validId(cid)) return fail(400, 'bad id')
    if (!bible || typeof bible !== 'object' || bible.id !== cid) return fail(400, 'bad bible')
    if (!(await readJson(projectFile(pid)))) return fail(404, 'no project')
    const stored = { ...bible, updated: new Date().toISOString() }
    await writeJson(characterFile(pid, cid), stored)
    return { ok: true, bible: stored }
  }

  // ── outfit and scene records (M4) ────────────────────────────────────────────

  const RECORD_DIRS = { outfit: 'outfits', scene: 'scenes' }
  const recordFile = (pid, kind, rid) => path.join(projectsDir, pid, RECORD_DIRS[kind], rid + '.json')

  async function listRecords(pid, kind) {
    if (!validId(pid) || !RECORD_DIRS[kind]) return fail(400, 'bad request')
    const dir = path.join(projectsDir, pid, RECORD_DIRS[kind])
    const names = await fs.readdir(dir).catch(() => [])
    const out = []
    for (const name of names.sort()) {
      if (!name.endsWith('.json')) continue
      const record = await readJson(path.join(dir, name))
      if (record) out.push(record)
    }
    return { ok: true, records: out }
  }

  async function createRecord(pid, kind, { id, name, character }) {
    if (!validId(pid) || !RECORD_DIRS[kind]) return fail(400, 'bad request')
    if (!validId(id)) return fail(400, 'record id must be a short slug')
    if (!(await readJson(projectFile(pid)))) return fail(404, 'no project')
    if (await readJson(recordFile(pid, kind, id))) return fail(409, 'record exists')
    const record = emptyRecord(kind, id, name, { character: character || null })
    await writeJson(recordFile(pid, kind, id), record)
    return { ok: true, record }
  }

  async function readRecord(pid, kind, rid) {
    if (!validId(pid) || !validId(rid) || !RECORD_DIRS[kind]) return fail(400, 'bad request')
    const record = await readJson(recordFile(pid, kind, rid))
    if (!record) return fail(404, 'no record')
    return { ok: true, record }
  }

  /** Persists a record; the records.js helpers own the rules. */
  async function writeRecord(pid, kind, rid, record) {
    if (!validId(pid) || !validId(rid) || !RECORD_DIRS[kind]) return fail(400, 'bad request')
    if (!record || typeof record !== 'object' || record.id !== rid || record.kind !== kind) return fail(400, 'bad record')
    if (!(await readJson(projectFile(pid)))) return fail(404, 'no project')
    const stored = { ...record, updated: new Date().toISOString() }
    await writeJson(recordFile(pid, kind, rid), stored)
    return { ok: true, record: stored }
  }

  return {
    root,
    listProjects, createProject, readProject,
    listSequences, createSequence, readSession, writeSession, readEdl, writeEdl,
    listCharacters, createCharacter, readCharacter, writeCharacter,
    listRecords, createRecord, readRecord, writeRecord,
  }
}
