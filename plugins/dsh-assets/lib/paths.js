/**
 * Where the library's own state lives, and where the records it reads live.
 *
 * TWO ROOTS, AND THEY ARE DIFFERENT ON PURPOSE.
 *
 * The library's own root is `<profile>/assets/`: the folder registry
 * (`folders.json`), and later the small catalog index. It holds no pictures — a
 * person's bytes stay in the folders they already keep them in, outside this app
 * (founder, 2026-09-26: *"for me it's better to create folders outside Mitsumeru —
 * kun creates inside .kun and it's a pain to dig it out when I need to attach or send
 * to people"*).
 *
 * The RECORDS root is the Generate plugin's (`<profile>/generate/`), because the run
 * record is what ties a file on disk to the values that made it. Epic 63 §1 decided
 * the two plugins stand alone, so this half READS those files and never imports
 * Generate's code: the rule below is repeated from `dsh-generate/lib/paths.js` and is
 * a contract between the two, not a shared module. (`RH_DATA_DIR` is the same
 * override Generate documents, so one test or one pinned deployment can point both
 * roots at one place.)
 *
 * The rule itself: the profile name comes from `argv` — the shell and the stock `dsh`
 * CLI both boot with `dsh --profile <name> [app]` — and the harness home from
 * `DSH_HOME`, which every other service already reads. Nothing here creates a
 * directory; resolving is a question, and the registry writer makes the directory.
 *
 * @module @muen/dsh-assets/lib/paths
 */
import { homedir } from 'node:os'
import { join } from 'node:path'

/** The row id, which is also this plugin's profile directory name. Matches cordis.patch.yml. */
export const ROW_ID = 'assets'

/** The Generate plugin's row id — where the run records are, and never where they are written from here. */
export const RECORDS_ROW_ID = 'generate'

/**
 * The profile name in `argv`, or null.
 *
 * Both spellings are accepted because both are real: the shell spawns
 * `['--profile', 'mitsu', …]`, while a person typing may write `--profile=mitsu`.
 */
export function profileNameFromArgv(argv = process.argv) {
  for (let index = 0; index < argv.length; index += 1) {
    const arg = String(argv[index] ?? '')
    if (arg === '--profile') {
      const next = String(argv[index + 1] ?? '').trim()
      return next === '' ? null : next
    }
    if (arg.startsWith('--profile=')) {
      const value = arg.slice('--profile='.length).trim()
      return value === '' ? null : value
    }
  }
  return null
}

/** `$DSH_HOME`, or the harness's own default of `~/.dsh`. */
export function dshHome(env = process.env) {
  const configured = typeof env.DSH_HOME === 'string' ? env.DSH_HOME.trim() : ''
  return configured === '' ? join(homedir(), '.dsh') : configured
}

/**
 * This plugin's own root.
 *
 * @returns {{ root: string, kind: 'override' | 'profile' | 'home', profile: string | null }}
 */
export function resolveDataRoot({ argv = process.argv, env = process.env } = {}) {
  const override = typeof env.ASSETS_DATA_DIR === 'string' ? env.ASSETS_DATA_DIR.trim() : ''
  const profile = profileNameFromArgv(argv)
  if (override !== '') return { root: override, kind: 'override', profile }
  if (profile !== null) return { root: join(dshHome(env), 'profiles', profile, ROW_ID), kind: 'profile', profile }
  return { root: join(dshHome(env), ROW_ID), kind: 'home', profile: null }
}

/**
 * The root the run records live under: the Generate plugin's, by the same rule.
 *
 * @returns {{ root: string, kind: 'override' | 'profile' | 'home', profile: string | null }}
 */
export function resolveRecordsRoot({ argv = process.argv, env = process.env } = {}) {
  const override = typeof env.RH_DATA_DIR === 'string' ? env.RH_DATA_DIR.trim() : ''
  const profile = profileNameFromArgv(argv)
  if (override !== '') return { root: override, kind: 'override', profile }
  if (profile !== null) return { root: join(dshHome(env), 'profiles', profile, RECORDS_ROW_ID), kind: 'profile', profile }
  return { root: join(dshHome(env), RECORDS_ROW_ID), kind: 'home', profile: null }
}

/** Where a provider keeps its run records, under the records root. */
export function runsDir(recordsRoot, providerId) {
  return join(recordsRoot, String(providerId), 'runs')
}
