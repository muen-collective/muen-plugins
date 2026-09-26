/**
 * Where the overlay lives (epic 65 L4).
 *
 * The harness exposes no "profile directory" service, so this resolves it from the two facts already
 * in the process — the profile name in `argv` and `DSH_HOME` — exactly as `@muen/dsh-generate/lib/paths.js`
 * does, with `MUEN_LOCALIZE_DIR` overriding the whole thing for a verify run or a pinned deployment.
 *
 * The overlay is NOT under this plugin's row directory. It is `<profile>/localizations/<plugin>/<lang>.json`
 * — the same place the reference `localize-plugin` pipeline keeps it, and a name that says what it holds
 * rather than which plugin wrote it, because a reader of the profile should find the translations without
 * knowing which package produced them.
 */
import { homedir } from 'node:os'
import { join } from 'node:path'

/** The row id, matching `cordis.patch.yml`. */
export const ROW_ID = 'localize'

/** The directory under the profile that holds every overlay. */
export const OVERLAY_DIR = 'localizations'

/** The profile name in `argv`, or null. Both `--profile mitsu` and `--profile=mitsu` are real. */
export function profileName(argv = process.argv) {
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--profile') return typeof argv[index + 1] === 'string' ? argv[index + 1] : null
    if (typeof arg === 'string' && arg.startsWith('--profile=')) return arg.slice('--profile='.length) || null
  }
  return null
}

/** `$DSH_HOME`, or the harness default `~/.dsh`. */
export function dshHome(env = process.env) {
  const configured = typeof env.DSH_HOME === 'string' ? env.DSH_HOME.trim() : ''
  if (configured !== '') return configured
  const home = typeof env.HOME === 'string' && env.HOME.trim() !== '' ? env.HOME : homedir()
  return join(home, '.dsh')
}

/** The profile directory, or null when no profile was named. */
export function profileDir({ argv = process.argv, env = process.env } = {}) {
  const override = typeof env.MUEN_LOCALIZE_DIR === 'string' ? env.MUEN_LOCALIZE_DIR.trim() : ''
  if (override !== '') return override
  const name = profileName(argv)
  if (name === null || name === '') return null
  return join(dshHome(env), 'profiles', name)
}

/** The directory every overlay lives under, or null when there is no profile to put it in. */
export function overlayRootFor(options) {
  const dir = profileDir(options)
  return dir === null ? null : join(dir, OVERLAY_DIR)
}
