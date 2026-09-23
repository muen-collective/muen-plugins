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
