/**
 * The styling state files: root, manifest, decisions, job.
 *
 * FOUR FILES, ONE WRITER. Each is JSON with a schema string; a reader that does not
 * recognise the schema answers the empty shape rather than throwing. Writes go to a
 * temporary name and are renamed into place, so a reader never sees half a file.
 *
 * The manifest is FACTS (what folders exist, what is inside them). The state is
 * DECISIONS (approved, runs). A re-probe rewrites the manifest and preserves the
 * decisions by look id.
 *
 * @module @muen/dsh-styling/lib/state
 */
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

export const ROOT_SCHEMA = 'muen-styling-root/v1'
export const MANIFEST_SCHEMA = 'muen-styling-manifest/v1'
export const STATE_SCHEMA = 'muen-styling-state/v1'
export const JOB_SCHEMA = 'muen-styling-job/v1'

export const rootPath = (dataRoot) => join(dataRoot, 'root.json')
export const manifestPath = (dataRoot) => join(dataRoot, 'manifest.json')
export const statePath = (dataRoot) => join(dataRoot, 'state.json')
export const jobPath = (dataRoot) => join(dataRoot, 'job.json')
export const proxiesPath = (dataRoot) => join(dataRoot, 'proxies')

/** Parse a JSON file, or answer the fallback. A missing file is ordinary. */
export async function readJson(file, fallback) {
  try {
    const parsed = JSON.parse(await readFile(file, 'utf8'))
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : fallback
  } catch {
    return fallback
  }
}

/** Write one JSON file atomically. */
export async function writeJson(file, value) {
  await mkdir(dirname(file), { recursive: true })
  const temporary = file + '.' + process.pid + '.' + Math.random().toString(36).slice(2) + '.part'
  await writeFile(temporary, JSON.stringify(value, null, 2) + '\n', 'utf8')
  await rename(temporary, file)
}

/** The folder a person added, or null. */
export async function readRoot(dataRoot) {
  const parsed = await readJson(rootPath(dataRoot), null)
  if (!parsed || parsed.schema !== ROOT_SCHEMA || typeof parsed.root !== 'string' || parsed.root.trim() === '') return null
  return { root: parsed.root, addedAt: typeof parsed.addedAt === 'string' ? parsed.addedAt : '' }
}

export async function writeRoot(dataRoot, root) {
  await writeJson(rootPath(dataRoot), { schema: ROOT_SCHEMA, root, addedAt: new Date().toISOString() })
}

export async function clearRoot(dataRoot) {
  await writeJson(rootPath(dataRoot), { schema: ROOT_SCHEMA, root: '', addedAt: '' })
}

/** The last probe. */
export async function readManifest(dataRoot) {
  const parsed = await readJson(manifestPath(dataRoot), null)
  if (!parsed || parsed.schema !== MANIFEST_SCHEMA || !Array.isArray(parsed.looks)) return { schema: MANIFEST_SCHEMA, root: null, generatedAt: '', looks: [] }
  return parsed
}

export async function writeManifest(dataRoot, manifest) {
  await writeJson(manifestPath(dataRoot), { ...manifest, schema: MANIFEST_SCHEMA, generatedAt: new Date().toISOString() })
}

/** The decisions. */
export async function readState(dataRoot) {
  const parsed = await readJson(statePath(dataRoot), null)
  if (!parsed || parsed.schema !== STATE_SCHEMA || !parsed.looks || typeof parsed.looks !== 'object') {
    return { schema: STATE_SCHEMA, updatedAt: '', looks: {} }
  }
  return parsed
}

export async function writeState(dataRoot, state) {
  await writeJson(statePath(dataRoot), { ...state, schema: STATE_SCHEMA, updatedAt: new Date().toISOString() })
}

/** The last queue. */
export async function readJob(dataRoot) {
  const parsed = await readJson(jobPath(dataRoot), null)
  if (!parsed || parsed.schema !== JOB_SCHEMA) return null
  return parsed
}

export async function writeJob(dataRoot, job) {
  await writeJson(jobPath(dataRoot), { ...job, schema: JOB_SCHEMA })
}

/** One look's view count: the number of views the probe paired. */
export function viewCountOf(look) {
  return Array.isArray(look && look.views) && look.views.length > 0 ? look.views.length : 4
}

/**
 * The per-view approvals, aligned with the look's views.
 *
 * A saved `viewApprovals` array wins. Failing that, the older look-level
 * `approved` is migrated: it covered every view that already had a final.
 */
export function approvalsOf(state, look) {
  const count = viewCountOf(look)
  const saved = state && state.looks ? state.looks[look.id] : null
  if (saved && Array.isArray(saved.viewApprovals)) {
    return Array.from({ length: count }, (_, index) => saved.viewApprovals[index] === true)
  }
  const approved = Boolean(saved && saved.approved === true)
  return Array.from({ length: count }, (_, index) =>
    approved && Boolean(look.views && look.views[index] && look.views[index].final),
  )
}

/** How many views are approved. */
export function approvedViewsOf(state, look) {
  return approvalsOf(state, look).filter(Boolean).length
}

/** A look is approved when at least one of its views is approved. */
export function lookApproved(state, look) {
  return approvedViewsOf(state, look) > 0
}

/** One look's decision, with the defaults a first probe leaves. */
export function decisionOf(state, id, hasFinal) {
  const saved = state && state.looks ? state.looks[id] : null
  const approved = saved && typeof saved.approved === 'boolean' ? saved.approved : Boolean(hasFinal)
  return {
    approved,
    reviewed: saved && saved.reviewed === true,
    runs: saved && Array.isArray(saved.runs) ? saved.runs : [],
  }
}

/** The counts the PLP header and the queue both use. */
export function countsOf(looks, state) {
  let approved = 0
  let toStyle = 0
  let withFinal = 0
  for (const look of Array.isArray(looks) ? looks : []) {
    const isApproved = look && look.approved === true ? true : lookApproved(state, look)
    if (look.coverFinal) withFinal += 1
    if (isApproved) approved += 1
    else toStyle += 1
  }
  return { total: Array.isArray(looks) ? looks.length : 0, approved, toStyle, withFinal, noFinal: (Array.isArray(looks) ? looks.length : 0) - withFinal }
}
