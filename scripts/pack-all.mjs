import { execFileSync } from 'node:child_process'
import { mkdirSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const pluginsDir = join(repoRoot, 'plugins')
const destination = join(repoRoot, 'dist')
mkdirSync(destination, { recursive: true })

// Pack plugin subdirectories under plugins/ (one dir per plugin, any slug).
// Hidden entries (e.g. .gitkeep) are skipped.
const pluginNames = readdirSync(pluginsDir)
  .filter((name) => !name.startsWith('.'))
  .filter((name) => statSync(join(pluginsDir, name)).isDirectory())

function pluginVersion(pluginDir) {
  try {
    const pkg = JSON.parse(readFileSync(join(pluginDir, 'package.json'), 'utf8'))
    return pkg.version || ''
  } catch { return '' }
}

// A pushed release tag `vX.Y.Z` must attach exactly ONE plugin. Release mode is
// selected by RELEASE_TAG (the release workflow passes the ref name, e.g.
// `v0.1.1`). We pack only the plugin(s) whose package.json version equals the tag
// version, and fail loudly if the tag matches nothing (typo / stale tag) or is
// ambiguous (two plugins sharing a version) — every released version must be
// unique across plugins. Without RELEASE_TAG (a local `dist` rebuild) every
// plugin is packed.
const releaseTag = process.env.RELEASE_TAG || ''
let targets = pluginNames
if (releaseTag) {
  // A release must attach exactly what this run produces — clear any stale
  // tarball left in dist so the workflow's `dist/*.tgz` is unambiguous.
  rmSync(destination, { recursive: true, force: true })
  mkdirSync(destination, { recursive: true })
  const version = releaseTag.replace(/^v/, '')
  const matches = pluginNames.filter((name) => pluginVersion(join(pluginsDir, name)) === version)
  if (matches.length === 0) {
    console.error(`RELEASE_TAG ${releaseTag}: no plugin has package version ${version}`)
    process.exit(1)
  }
  if (matches.length > 1) {
    console.error(
      `RELEASE_TAG ${releaseTag}: version ${version} is ambiguous (${matches.join(', ')}) — ` +
      `released versions must be unique across plugins`,
    )
    process.exit(1)
  }
  targets = matches
}

for (const name of targets) {
  execFileSync('npm', ['pack', '--pack-destination', destination], {
    cwd: join(pluginsDir, name),
    stdio: 'inherit',
  })
}
console.log(`Packed ${targets.length} plugin(s) into ${destination}${releaseTag ? ` for release ${releaseTag}` : ''}`)
