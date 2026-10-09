/**
 * The manifest and the patch file are what the loader reads before any of this
 * code runs, so they get their own gate. A patch file that is not exactly one
 * top-level array document takes the next profile boot into safe mode.
 */
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
let failures = 0

function check(label, condition, detail) {
  if (condition) {
    console.log('  ok   ' + label)
  } else {
    failures += 1
    console.log('  FAIL ' + label + (detail ? ' -- ' + detail : ''))
  }
}

const manifest = JSON.parse(await readFile(path.join(ROOT, 'package.json'), 'utf8'))

check('name is @muen/dsh-studio', manifest.name === '@muen/dsh-studio', manifest.name)
check('is publishable (no `private`)', manifest.private === undefined, 'the public repo normalizes `private` away')
check('carries its license and repository', manifest.license === 'MIT' && manifest.repository && manifest.repository.directory === 'plugins/dsh-studio', JSON.stringify(manifest.repository))
check('main resolves to lib/index.js', manifest.main === 'lib/index.js', manifest.main)
check('exports the client half', manifest.exports && manifest.exports['./client'] === './lib/client.js')
check(
  'patch is declared',
  manifest.dsh && manifest.dsh.bundle && manifest.dsh.bundle.patch === './cordis.patch.yml',
)
check(
  'client injects locale + sidebar modules',
  manifest.dsh &&
    manifest.dsh.client &&
    Array.isArray(manifest.dsh.client.inject) &&
    manifest.dsh.client.inject.includes('@deepseek-ai/dsh-client-locale') &&
    manifest.dsh.client.inject.includes('@deepseek-ai/dsh-client-ui-sidebar-right'),
  JSON.stringify(manifest.dsh && manifest.dsh.client),
)
check(
  'client declares ui-primitives external',
  manifest.dsh && manifest.dsh.client && Array.isArray(manifest.dsh.client.external) &&
    manifest.dsh.client.external.includes('@deepseek-ai/dsh-client-ui-primitives'),
)

for (const file of ['lib/index.js', 'lib/client.js', 'lib/studio-store.js', 'lib/seals.js', 'lib/bibles.js', 'lib/records.js', 'lib/script.js', 'lib/edl.js', 'lib/export.js', 'lib/library.js', 'lib/sync.js', 'lib/sheet.js', 'lib/llm.js', 'lib/roles/casting.md', 'lib/roles/script.md', 'lib/roles/prompt-desk.md', 'README.md']) {
  check('exists: ' + file, existsSync(path.join(ROOT, file)))
}

const patch = await readFile(path.join(ROOT, 'cordis.patch.yml'), 'utf8')
const documents = patch
  .split('\n')
  .filter((line) => line.trim() === '---')
check('patch is a single YAML document', documents.length === 0, documents.length + ' extra --- markers')
check('patch is not an empty array', !/^\s*\[\s*\]\s*$/m.test(patch))
check('patch has no trailing junk after the array', !/\n\s*\n\s*[^-\s#]/.test(patch.trimEnd() + '\n'))
check('patch declares the row id', /^\s*-?\s*id:\s*studio\s*$/m.test(patch))
check('patch mounts the package', patch.includes("name: '@muen/dsh-studio'"))

console.log(failures ? '\n' + failures + ' failure(s)' : '\nmanifest + patch ok')
process.exit(failures ? 1 : 0)
