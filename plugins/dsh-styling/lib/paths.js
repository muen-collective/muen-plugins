/**
 * Where the styling plugin's own state lives.
 *
 * The person's photographs never move into the app. The plugin's root is
 * `<profile>/styling/`: `root.json` (the folder they added), `manifest.json`
 * (what the probe found), `state.json` (their approve/re-generate decisions),
 * `job.json` (the last queue) and `proxies/` (the 2048px previews).
 *
 * The profile name comes from argv, the harness home from `DSH_HOME`, and a
 * pinned deployment can point `STYLING_DATA_DIR` at one directory.
 *
 * @module @muen/dsh-styling/lib/paths
 */
import { homedir } from 'node:os'
import { join } from 'node:path'

/** The row id, which is also this plugin's profile directory name. */
export const ROW_ID = 'styling'

/** The profile name in argv, or null. Both `--profile x` and `--profile=x`. */
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

/** This plugin's own root. */
export function resolveDataRoot({ argv = process.argv, env = process.env } = {}) {
  const override = typeof env.STYLING_DATA_DIR === 'string' ? env.STYLING_DATA_DIR.trim() : ''
  const profile = profileNameFromArgv(argv)
  if (override !== '') return { root: override, kind: 'override', profile }
  if (profile !== null) return { root: join(dshHome(env), 'profiles', profile, ROW_ID), kind: 'profile', profile }
  return { root: join(dshHome(env), ROW_ID), kind: 'home', profile: null }
}
