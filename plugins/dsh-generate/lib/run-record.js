/**
 * The record of one run: where it lives, how it is written, how it is read back.
 *
 * ONE FILE PER JOB, under the provider's own root (`<profile>/generate/<provider>/runs/`),
 * and it answers "what did we ship and why" (epic 61 §12 rule 4) without a second log to
 * reconcile: on submit it holds the payload a person confirmed and the gate's own answer,
 * and on a terminal state the same file gains the outcome.
 *
 * PROVIDER-NEUTRAL, which is why it is not in a provider's runner: Krea writes
 * `muen-krea-run/v1` records and RunningHub writes `muen-rh-run/v1` records, with
 * different bodies and different status words, and both want the same file discipline.
 * Each record carries its own `schema` string, so a reader that meets an unknown one can
 * say so rather than guess.
 *
 * NO KEY IS EVER IN ONE. The key travels as an argument to the call that spends and is
 * written nowhere.
 *
 * @module @muen/dsh-generate/lib/run-record
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

/** Where one run's record lives: beside the adapters, one file per job. */
export function runPath(root, jobId) {
  return join(root, 'runs', String(jobId) + '.json')
}

/**
 * Write the record of a run.
 *
 * ON SUBMIT it is the gate's own answer: what was asked for, when, and that a person
 * confirmed it. ON SETTLE the same file gains the outcome, so one file answers "what did
 * we ship and why" (rule 4) without a second log to reconcile. No key is ever in it.
 */
export async function writeRunRecord(root, record, { writeText = writeFile, makeDir = mkdir } = {}) {
  await makeDir(join(root, 'runs'), { recursive: true })
  await writeText(runPath(root, record.jobId), JSON.stringify(record, null, 2) + '\n', 'utf8')
  return record
}

/** The record of one run, or `null`. A missing file is a job this install did not start. */
export async function readRunRecord(root, jobId, { readText = readFile } = {}) {
  try {
    const parsed = JSON.parse(await readText(runPath(root, jobId), 'utf8'))
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

/**
 * Every record this install holds, newest first — the strip's own read (epic 64 S3).
 *
 * THE RECORD IS THE INDEX (epic 64 §4): no second catalogue and no database in v1. A
 * directory read plus one JSON parse per file is what 35 records cost, and the founder's
 * own number is the bound worth watching — "fine into the thousands".
 *
 * A record that cannot be parsed is SKIPPED rather than fatal: a half-written file must not
 * empty a series. `limit` caps what one request walks, and the caller is told when it bit.
 */
export async function listRunRecords(root, { limit = 100, listDir, readText = readFile } = {}) {
  const { readdir } = await import('node:fs/promises')
  const list = listDir || readdir
  let names = []
  try {
    names = await list(join(root, 'runs'))
  } catch {
    return { records: [], truncated: false, total: 0 }
  }
  const files = names.filter((name) => String(name).endsWith('.json'))
  const records = []
  for (const name of files) {
    const record = await readRunRecord(root, String(name).replace(/\.json$/, ''), { readText })
    if (record) records.push(record)
  }
  // NEWEST FIRST by the run's own clock: the strip reads like the series it is, and a
  // record whose `at` is missing sorts last rather than first.
  records.sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')))
  return { records: records.slice(0, limit), truncated: records.length > limit, total: records.length }
}

/**
 * The values a run was asked for, in the shape the form can take them back (epic 64 S4).
 *
 * A door's own name is the API's `fieldName`, and that is the key this answers with, because
 * that is the one string both shapes carry: RunningHub's body is a `nodeInfoList` of
 * `{ nodeId, fieldName, fieldValue }`, and Krea's body is the request itself keyed by the
 * API's own names. A value the record does not carry is simply absent — the form keeps what
 * it had rather than being handed an invented default.
 */
export function valuesOf(record) {
  const body = record && record.body && typeof record.body === 'object' ? record.body : null
  if (!body) return {}
  const values = {}
  const list = Array.isArray(body.nodeInfoList) ? body.nodeInfoList : null
  if (list) {
    for (const node of list) {
      if (!node || typeof node !== 'object') continue
      const key = String(node.fieldName === undefined ? node.nodeId : node.fieldName)
      if (node.fieldValue === undefined || node.fieldValue === null) continue
      values[key] = node.fieldValue
    }
    return values
  }
  for (const [key, value] of Object.entries(body)) {
    if (value === undefined || value === null) continue
    if (typeof value === 'object' && value !== null) continue
    values[key] = value
  }
  return values
}

/**
 * Where a saved file is now, as far as this machine can honestly say (epic 64 §4).
 *
 * `present` — here. `trashed` — gone from its place, with a copy under the `_trash/` folder
 * beside it, which is where this product's delete moves things rather than unlinking them;
 * **the strip drops such a row**, because a delete is a decision about the series. `offline`
 * — on a volume that is not mounted, which keeps its row and says so. `missing` — nowhere,
 * which ALSO keeps its row, because a gap in a series is information.
 */
export async function whereIs(file, { statFile } = {}) {
  const stat = statFile || (await import('node:fs/promises')).stat
  const path = String(file || '')
  try {
    const info = await stat(path)
    if (info.isFile()) return 'present'
  } catch {
    // Not where the record says, which is what the rest of this is about.
  }
  const name = path.split(/[\\/]/).pop() || ''
  const dir = path.slice(0, Math.max(0, path.length - name.length - 1))
  if (name !== '' && dir !== '') {
    try {
      const info = await stat(join(dir, '_trash', name))
      if (info.isFile()) return 'trashed'
    } catch {
      // No trash copy either.
    }
  }
  const volume = /^(?:\/Volumes|\/media|\/mnt)\/([^/]+)\//.exec(path)
  if (volume) {
    try {
      await stat('/Volumes/' + volume[1])
    } catch {
      return 'offline'
    }
  }
  return 'missing'
}
