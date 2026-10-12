/**
 * A work-in-progress plugin must not reach public distribution.
 *
 * Founder, 2026-10-12: *"some plugins are work in progress so we need to disable them from public
 * distribution"*. The lever is `WIP_PLUGINS` in `scripts/pack-all.mjs`, and this file pins it so a
 * later edit cannot quietly re-open the tap.
 *
 * Two things are asserted, because a refusal that lives in only one of them leaks:
 *   - the list still names the plugins that are actually WIP, and each name is a real directory;
 *   - the release path REFUSES a tag that names one, with a message that says why.
 *
 * `WIP_PLUGINS` is read out of the script source rather than imported: `pack-all.mjs` does its work
 * at module top level (it is a command, not a library), so importing it would run the pack.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { readFile, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const run = promisify(execFile)
const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = join(HERE, '..')
const PACK = join(REPO, 'scripts', 'pack-all.mjs')

/** The `WIP_PLUGINS` array literal, read from the script that owns it. */
async function wipPlugins() {
  const source = await readFile(PACK, 'utf8')
  const block = /const WIP_PLUGINS = \[([\s\S]*?)\]/.exec(source)
  assert.ok(block, 'scripts/pack-all.mjs no longer declares WIP_PLUGINS')
  return [...block[1].matchAll(/'([^']+)'/g)].map((match) => match[1])
}

test('the WIP list names Studio Director — the plugin this repo publishes', async () => {
  const wip = await wipPlugins()
  assert.ok(wip.includes('dsh-studio'), 'dsh-studio (Studio Director) left the WIP list')
  // `@muen/dsh-cms` (Website preview) is WIP too, but its source lives in `mitsumeru-plugins`,
  // which withholds it in its own pack script — a plugin can only be withheld by its own repo.
})

test('every name in the WIP list is a real plugin directory', async () => {
  for (const slug of await wipPlugins()) {
    const info = await stat(join(REPO, 'plugins', slug))
    assert.ok(info.isDirectory(), `WIP_PLUGINS names plugins/${slug}, which does not exist`)
  }
})

test('the release path refuses a tag that names a WIP plugin', async () => {
  for (const slug of await wipPlugins()) {
    const version = JSON.parse(await readFile(join(REPO, 'plugins', slug, 'package.json'), 'utf8')).version
    const failure = await run(process.execPath, [PACK], {
      cwd: REPO,
      env: { ...process.env, RELEASE_TAG: `${slug}-v${version}` },
    }).then(
      () => null,
      (error) => error,
    )
    assert.ok(failure, `${slug}-v${version} was allowed to release`)
    assert.equal(failure.code, 1, `${slug}: expected exit 1, got ${failure.code}`)
    assert.match(failure.stderr, /WORK IN PROGRESS/, `${slug}: the refusal does not say why`)
  }
})
