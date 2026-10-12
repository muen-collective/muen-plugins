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

// A WIP plugin is built in the open but is NOT ready to be handed to anyone, so it must not reach
// public distribution. Founder, 2026-10-12: *"some plugins are work in progress so we need to
// disable them from public distribution"*. The founder's own profile installs them by `link:` and
// keeps working — nothing is deleted, only the PUBLISH is withheld.
//
// The lever is this list, checked in TWO places, because either one alone leaks:
//   1. the default local `npm run pack:all` skips them, so a stray dist/ never contains one;
//   2. a `RELEASE_TAG` naming one is refused, so even the release workflow cannot publish one.
//
// Adding a name here is the whole act of withholding a plugin. Deleting a name is the whole act of
// releasing it — and doing that should coincide with clearing its WIP corner mark in the pane
// (`data-studio-wip` / `data-cms-wip`), which is what the founder reads on screen.
// Each repo withholds its OWN WIP plugins: this list is `muen-plugins`'s, and `@muen/dsh-cms`
// (Website preview) is withheld in `mitsumeru-plugins`, where its source lives — a plugin can only be
// withheld by the repo that could publish it.
const WIP_PLUGINS = [
  'dsh-studio', // Studio Director, epic 94 (draft) — the video production surface
]

function pluginVersion(pluginDir) {
  try {
    const pkg = JSON.parse(readFileSync(join(pluginDir, 'package.json'), 'utf8'))
    return pkg.version || ''
  } catch { return '' }
}

// Release mode is selected by RELEASE_TAG (the release workflow passes the ref
// name) and a release must attach exactly ONE plugin. TWO TAG FORMS, and the
// second is why this file changed:
//
//   vX.Y.Z            version-only. Exactly one plugin in the repo must carry
//                     X.Y.Z, or the tag fails as ambiguous. This is the original
//                     rule and it still works.
//   <slug>-vX.Y.Z     plugin-named, e.g. `dsh-assets-v0.1.0`. The plugin in
//                     `plugins/<slug>` is released and must carry X.Y.Z.
//
// The version-only form forced released versions to be unique ACROSS plugins,
// which is not how a monorepo works: nine plugins here sit at 0.1.0, so the
// first two that reach the market could not be tagged at all without inventing
// a version number for one of them. A tag that names its plugin is unambiguous
// on its own, and the file attached is still the one whose own version says so —
// the tag never overrides a manifest, it only has to agree with it.
//
// Without RELEASE_TAG (a local `dist` rebuild) every plugin is packed.
const releaseTag = process.env.RELEASE_TAG || ''
/**
 * Split a release tag into `{ slug, version }`; `slug` is null for the
 * version-only form. A slug is a plugin directory name under `plugins/`.
 * @param {string} tag
 * @returns {{ slug: string | null, version: string } | null}
 */
function parseReleaseTag(tag) {
  const parsed = /^(?:([a-z0-9][a-z0-9-]*)-)?v(.+)$/.exec(tag)
  return parsed === null ? null : { slug: parsed[1] ?? null, version: parsed[2] }
}

let targets = pluginNames.filter((name) => !WIP_PLUGINS.includes(name))
if (releaseTag) {
  // A release must attach exactly what this run produces — clear any stale
  // tarball left in dist so the workflow's `dist/*.tgz` is unambiguous.
  rmSync(destination, { recursive: true, force: true })
  mkdirSync(destination, { recursive: true })
  const parsed = parseReleaseTag(releaseTag)
  if (parsed === null) {
    console.error(`RELEASE_TAG ${releaseTag}: expected vX.Y.Z or <plugin>-vX.Y.Z`)
    process.exit(1)
  }
  const { slug, version } = parsed
  if (slug !== null) {
    if (!pluginNames.includes(slug)) {
      console.error(`RELEASE_TAG ${releaseTag}: no plugin directory plugins/${slug}`)
      process.exit(1)
    }
    const found = pluginVersion(join(pluginsDir, slug))
    if (found !== version) {
      console.error(`RELEASE_TAG ${releaseTag}: plugins/${slug} is version ${found || '(none)'}, not ${version}`)
      process.exit(1)
    }
    if (WIP_PLUGINS.includes(slug)) {
      console.error(
        `RELEASE_TAG ${releaseTag}: plugins/${slug} is WORK IN PROGRESS and withheld from public ` +
        `distribution (see WIP_PLUGINS in scripts/pack-all.mjs). Clear its WIP corner mark and drop ` +
        `it from that list in the same change that releases it.`,
      )
      process.exit(1)
    }
    targets = [slug]
  } else {
    const matches = pluginNames.filter((name) => pluginVersion(join(pluginsDir, name)) === version)
    if (matches.length === 0) {
      console.error(`RELEASE_TAG ${releaseTag}: no plugin has package version ${version}`)
      process.exit(1)
    }
    if (matches.length > 1) {
      console.error(
        `RELEASE_TAG ${releaseTag}: version ${version} is ambiguous (${matches.join(', ')}) — ` +
        `name the plugin instead, e.g. ${matches[0]}-${releaseTag}`,
      )
      process.exit(1)
    }
    if (WIP_PLUGINS.includes(matches[0])) {
      console.error(
        `RELEASE_TAG ${releaseTag}: plugins/${matches[0]} is WORK IN PROGRESS and withheld from ` +
        `public distribution (see WIP_PLUGINS in scripts/pack-all.mjs).`,
      )
      process.exit(1)
    }
    targets = matches
  }
}

for (const name of targets) {
  execFileSync('npm', ['pack', '--pack-destination', destination], {
    cwd: join(pluginsDir, name),
    stdio: 'inherit',
  })
}
console.log(`Packed ${targets.length} plugin(s) into ${destination}${releaseTag ? ` for release ${releaseTag}` : ''}`)
