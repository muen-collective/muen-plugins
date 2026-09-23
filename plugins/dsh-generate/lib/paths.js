/**
 * Where the surface's own data lives.
 *
 * Epic 61 D2 puts an adapter in the profile, not in a repo and not in a database:
 * `<profile>/generate/<provider>/adapters/<name>.json`. The directory is named after
 * the cordis row id (`generate`), and inside it one directory per provider: the
 * plugin is provider-neutral (founder, 2026-09-22), so the row id must not name a
 * provider, and each provider's own data (its adapters, later its uploads) stays
 * together under its own name.
 *
 * THE HARNESS EXPOSES NO "PROFILE DIRECTORY" SERVICE, so this is resolved from two
 * facts that are already in the process:
 *
 *   1. the profile name from `argv` — the shell and the stock `dsh` CLI both boot
 *      with `dsh --profile <name> [app]` (measured in
 *      `~/mitsumeru/packages/mitsumeru/src/main/harness.ts`, which spawns exactly
 *      that), and
 *   2. `DSH_HOME`, the harness home every other service already reads
 *      (`@deepseek-ai/dsh-home-paths`, credentials, shell-env).
 *
 * So the profile directory is `$DSH_HOME/profiles/<name>`. `RH_DATA_DIR` overrides
 * the whole thing, which is what the verify scripts and a pinned deployment use.
 *
 * NOTHING HERE CREATES A DIRECTORY. Resolution is a question; making the directory
 * is the writer's act, and in S3 the only writer is the agent, through its own file
 * tools, after the user has confirmed the door list.
 *
 * @module @muen/dsh-generate/lib/paths
 */
import { homedir } from 'node:os'
import { join } from 'node:path'

/** The row id, which is also the profile directory name. Matches cordis.patch.yml. */
export const ROW_ID = 'generate'

/**
 * The profile name in `argv`, or null.
 *
 * Both spellings are accepted because both are real: the shell spawns
 * `['--profile', 'mitsu', …]`, while a person typing may write `--profile=mitsu`.
 * The first hit wins, which matches how the CLI parses it.
 *
 * @param {readonly string[]} argv
 * @returns {string | null}
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
 * The directory this plugin owns.
 *
 * @returns {{ root: string, kind: 'override' | 'profile' | 'home', profile: string | null }}
 *   `kind` says which rule answered, so a caller can show it rather than guess:
 *   `override` is `RH_DATA_DIR`, `profile` is `$DSH_HOME/profiles/<name>`, and
 *   `home` is the fallback when no `--profile` was found anywhere in `argv`.
 */
export function resolveDataRoot({ argv = process.argv, env = process.env } = {}) {
  const override = typeof env.RH_DATA_DIR === 'string' ? env.RH_DATA_DIR.trim() : ''
  const profile = profileNameFromArgv(argv)
  if (override !== '') return { root: override, kind: 'override', profile }
  if (profile !== null) return { root: join(dshHome(env), 'profiles', profile, ROW_ID), kind: 'profile', profile }
  return { root: join(dshHome(env), ROW_ID), kind: 'home', profile: null }
}

/**
 * One provider's data, under the plugin's root: its adapters directory and its
 * house-style file.
 *
 * THE PROVIDER IS REQUIRED, not optional. A default of "the root itself" would let a
 * caller read every provider's adapters as if they were one provider's — which is
 * exactly the confusion the per-provider directory exists to prevent.
 *
 * @param {string} root - the plugin's own root (`<profile>/generate`)
 * @param {string} providerId - the provider's id, which is also its directory name
 */
export function dataPaths(root, providerId) {
  const own = join(root, providerId)
  return {
    root: own,
    adapters: join(own, 'adapters'),
    house: join(own, '_house.json'),
  }
}
