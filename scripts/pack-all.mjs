import { execFileSync } from 'node:child_process'
import { mkdirSync, readdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const pluginsDir = join(repoRoot, 'plugins')
const destination = join(repoRoot, 'dist')
mkdirSync(destination, { recursive: true })

// Pack every plugin subdirectory under plugins/ (one dir per plugin, any slug).
// Hidden entries (e.g. .gitkeep) are skipped.
const plugins = readdirSync(pluginsDir)
  .filter((name) => !name.startsWith('.'))
  .filter((name) => statSync(join(pluginsDir, name)).isDirectory())
for (const plugin of plugins) {
  execFileSync('npm', ['pack', '--pack-destination', destination], {
    cwd: join(pluginsDir, plugin),
    stdio: 'inherit'
  })
}
console.log(`Packed ${plugins.length} plugin(s) into ${destination}`)
