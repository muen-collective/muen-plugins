import { execFileSync } from 'node:child_process'
import { mkdirSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const pluginsDir = join(repoRoot, 'plugins')
const destination = join(repoRoot, 'dist')
mkdirSync(destination, { recursive: true })

const plugins = readdirSync(pluginsDir).filter((name) => name.startsWith('mitsu-'))
for (const plugin of plugins) {
  execFileSync('npm', ['pack', '--pack-destination', destination], {
    cwd: join(pluginsDir, plugin),
    stdio: 'inherit'
  })
}
console.log(`Packed ${plugins.length} plugin(s) into ${destination}`)
