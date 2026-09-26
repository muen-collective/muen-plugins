/**
 * verify:overlay — epic 65 L4's claims about the overlay, asserted rather than intended.
 *
 * The claim: **a plugin we do not own can be translated without touching its bundle, and a string
 * with no translation comes back as its own English rather than as nothing.** Two halves are checked
 * here; the DOM walk that applies a map to a rendered tree lands with the routes.
 *
 *   1. the STORE lives in the profile (`<profile>/localizations/<plugin>/<lang>.json`), round-trips,
 *      and refuses a plugin id that would write outside it — nothing escapes the root;
 *   2. it refuses a target that is not a non-empty string, and a map with nothing usable in it writes
 *      no file at all;
 *   3. the resolution rule: an exact source maps, surrounding whitespace survives, and a source with
 *      no translation is returned UNCHANGED — never blank, never a raw key;
 *   4. two plugins translating one English string differently is REPORTED as a conflict, not decided
 *      by directory order;
 *   5. the SCAN finds the strings a UI draws and ignores the code around them — CSS, module ids,
 *      attributes, regex bodies and comments — because a scan that quietly stops finding strings
 *      looks exactly like a plugin with nothing to translate;
 *   6. and it is bounded, deduplicated and sorted.
 *
 *   node verify/overlay.mjs
 */
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  LANGS,
  listOverlays,
  mergeOverlays,
  overlayPath,
  overlayRoot,
  overlaysFor,
  readOverlay,
  removeOverlay,
  resolveOverlay,
  validPluginId,
  writeOverlay,
} from '../lib/overlay.js'
import { scanStrings, stringLiterals, looksLikeUiCopy } from '../lib/scan.js'

// ── reporter ─────────────────────────────────────────────────────────────────

const rows = []
const check = (label, ok, detail) => rows.push({ label, status: ok ? 'pass' : 'fail', detail: detail == null ? '' : String(detail) })
const note = (text) => rows.push({ label: text, status: 'note', detail: '' })

function finish() {
  let failed = 0
  process.stdout.write('\nverify:overlay — epic 65 L4 (the overlay)\n')
  for (const row of rows) {
    if (row.status === 'pass') continue
    if (row.status === 'note') {
      process.stdout.write('  ....  ' + row.label + '\n')
      continue
    }
    if (row.status === 'fail') failed += 1
    process.stdout.write('  FAIL  ' + row.label + (row.detail ? '  —  ' + row.detail : '') + '\n')
  }
  const passes = rows.filter((row) => row.status === 'pass').length
  const total = rows.filter((row) => row.status !== 'note').length
  process.stdout.write('  ' + passes + '/' + total + ' passed\n')
  if (failed > 0) process.exitCode = 1
}

const ROOT = mkdtempSync(join(tmpdir(), 'localize-overlay-'))
process.on('exit', () => {
  try {
    rmSync(ROOT, { recursive: true, force: true })
  } catch {
    // a temp dir left behind is not a failure
  }
})

// ── 1. the store ─────────────────────────────────────────────────────────────

{
  const written = writeOverlay(ROOT, 'dsh-discord', 'ko', { Save: '저장', Cancel: '취소' })
  check('an overlay writes into the profile, under localizations/<plugin>/<lang>.json', written.ok === true && written.keys === 2, JSON.stringify(written))
  const path = overlayPath(ROOT, 'dsh-discord', 'ko')
  check(
    'and the path is the one the epic names, with no plugin directory in it',
    path === join(ROOT, 'localizations', 'dsh-discord', 'ko.json') && !path.includes('node_modules'),
    path,
  )
  check('the file on disk is real JSON, so a person can read and edit it', existsSync(path) && /"Save": "저장"/u.test(readFileSync(path, 'utf8')), existsSync(path) ? readFileSync(path, 'utf8').slice(0, 80) : 'missing')
  const back = readOverlay(ROOT, 'dsh-discord', 'ko')
  check('reading it back gives the same map', back.map.Save === '저장' && back.map.Cancel === '취소' && back.missing === false, JSON.stringify(back))
  const absent = readOverlay(ROOT, 'dsh-discord', 'ja')
  check('an overlay that does not exist is an EMPTY overlay, not an error', absent.missing === true && Object.keys(absent.map).length === 0, JSON.stringify(absent))
}

// ── 2. what the store refuses ────────────────────────────────────────────────

{
  const hostile = writeOverlay(ROOT, '../evil', 'ko', { Save: '저장' })
  check(
    'a plugin id that would climb out of the profile is refused, and nothing is written',
    hostile.ok === false && hostile.error === 'bad-plugin' && !existsSync(join(ROOT, '..', 'evil')) && !existsSync(join(ROOT, 'evil')),
    JSON.stringify(hostile),
  )
  check('and neither is an absolute path or one with a separator in it', validPluginId('dsh-discord') && !validPluginId('/etc/passwd') && !validPluginId('a/b') && !validPluginId('a\\b') && !validPluginId('') && !validPluginId('..'), JSON.stringify({ ok: validPluginId('dsh-discord'), abs: validPluginId('/etc/passwd'), slash: validPluginId('a/b') }))
  const badLang = writeOverlay(ROOT, 'dsh-discord', '../ko', { Save: '저장' })
  check('a language that is not a tag is refused too', badLang.ok === false && badLang.error === 'bad-lang', JSON.stringify(badLang))
  const badTarget = writeOverlay(ROOT, 'dsh-discord', 'fr', { Save: '', Cancel: '   ', Keep: 42 })
  check(
    'a target that is not a non-empty string is refused, with the reason',
    badTarget.ok === false && badTarget.error === 'nothing-usable' && badTarget.refused.length === 3,
    JSON.stringify(badTarget),
  )
  check('and no file was written for it', !existsSync(overlayPath(ROOT, 'dsh-discord', 'fr')), 'file exists')
  const partial = writeOverlay(ROOT, 'dsh-discord', 'ja', { Save: '保存', broken: null })
  check('a write with SOME usable entries lands, and says what it dropped', partial.ok === true && partial.keys === 1 && partial.refused.length === 1, JSON.stringify(partial))

  // SURVIVAL: the overlay is the profile's, so replacing the plugin cannot remove it.
  const pluginDir = join(ROOT, 'node_modules', 'dsh-discord')
  mkdirSync(pluginDir, { recursive: true })
  writeFileSync(join(pluginDir, 'client.js'), '// version one')
  writeFileSync(join(pluginDir, 'client.js'), '// version two, an update')
  const after = readOverlay(ROOT, 'dsh-discord', 'ko')
  check(
    'a plugin update cannot remove it: the map is the profile\'s, not the package\'s',
    after.map.Save === '저장' && !overlayPath(ROOT, 'dsh-discord', 'ko').startsWith(pluginDir),
    JSON.stringify({ map: after.map, insidePlugin: overlayPath(ROOT, 'dsh-discord', 'ko').startsWith(pluginDir) }),
  )
}

// ── 3. listing and merging ───────────────────────────────────────────────────

{
  writeOverlay(ROOT, 'dsh-graphify', 'ko', { Save: '저장', Graph: '그래프' })
  const all = listOverlays(ROOT)
  check(
    'the profile can list what it holds, per plugin and language',
    all.length === 3 && all.some((row) => row.plugin === 'dsh-discord' && row.lang === 'ko' && row.keys === 2) && all.some((row) => row.plugin === 'dsh-graphify' && row.lang === 'ko'),
    JSON.stringify(all),
  )
  const ko = overlaysFor(ROOT, 'ko')
  check(
    'and one language can be collected for the whole DOM',
    ko.length === 2 && ko.every((row) => row.map && typeof row.map === 'object') && ko.some((row) => row.map.Save === '저장'),
    JSON.stringify(ko.map((row) => [row.plugin, Object.keys(row.map).length])),
  )
  const merged = mergeOverlays([{ plugin: 'a', map: { Save: '저장', Open: '열기' } }, { plugin: 'b', map: { Save: '보존', Close: '닫기' } }])
  check(
    'two plugins translating one string differently is REPORTED, and the later one wins',
    merged.map.Save === '보존' && merged.map.Close === '닫기' && merged.conflicts.length === 1 && merged.conflicts[0].source === 'Save',
    JSON.stringify(merged),
  )
  check('and an overlay that is the same in both is not called a conflict', mergeOverlays([{ plugin: 'a', map: { Save: '저장' } }, { plugin: 'b', map: { Save: '저장' } }]).conflicts.length === 0, 'conflict reported')
  const removed = removeOverlay(ROOT, 'dsh-graphify', 'ko')
  check('an overlay can be removed, and removing one that is gone is still fine', removed.ok === true && readOverlay(ROOT, 'dsh-graphify', 'ko').missing === true && removeOverlay(ROOT, 'dsh-graphify', 'ko').ok === true, JSON.stringify(removed))
}

// ── 4. the resolution rule ───────────────────────────────────────────────────

{
  const map = { Save: '저장', 'Save changes': '변경 사항 저장' }
  check('an exact source resolves to its translation', resolveOverlay(map, 'Save') === '저장', resolveOverlay(map, 'Save'))
  check('a longer source resolves as itself, not by prefix', resolveOverlay(map, 'Save changes now') === 'Save changes now', resolveOverlay(map, 'Save changes now'))
  check(
    'a rendered node keeps its surrounding whitespace',
    resolveOverlay(map, '\n    Save\n  ') === '\n    저장\n  ',
    JSON.stringify(resolveOverlay(map, '\n    Save\n  ')),
  )
  check(
    'AND A STRING WITH NO TRANSLATION COMES BACK AS ITSELF — the English fallback, never blank and never a key',
    resolveOverlay(map, 'Something else') === 'Something else' && resolveOverlay(map, '') === '' && resolveOverlay({ Save: undefined }, 'Save') === 'Save',
    JSON.stringify([resolveOverlay(map, 'Something else'), resolveOverlay({ Save: undefined }, 'Save')]),
  )
  check('`en` is the source language, so it is never one we store an overlay for', !LANGS.includes('en') && !LANGS.includes('zh') && LANGS.join(',') === 'ko,ja,fr,de,es', JSON.stringify(LANGS))
  check('and the overlay root is a directory beside the profile, not inside a package', overlayRoot('/some/profile') === '/some/profile/localizations', overlayRoot('/some/profile'))
}

// ── 5. the scan ──────────────────────────────────────────────────────────────

const FIXTURE = `
// A comment with 'A comment string' inside it, which is not copy.
const CSS = '--dsw-alias-bg-layer-2'
const URL = 'https://example.com/bundle.js'
const MODULE = '@deepseek-ai/dsh-client-ui-primitives'
const SHAPE = { name: 'dsh-discord', tag: 'data-run-state', height: '0.5rem', colour: 'rgba(0,0,0,.5)' }
const RAIL = /['"]/g
function draw() {
  return [
    h('button', null, 'Save changes'),
    h('span', null, '  Cancel  '),
    h('span', null, 'OK'),
    h('span', null, '保存设置'),
  ]
}
`
{
  const found = scanStrings(FIXTURE)
  check(
    'the scan finds the sentences a UI draws',
    found.includes('Save changes') && found.includes('Cancel'),
    JSON.stringify(found),
  )
  check('and the single-word labels, which are buttons too', found.includes('OK'), JSON.stringify(found))
  check('and hardcoded CJK, which is the other reason to scan', found.includes('保存设置'), JSON.stringify(found))
  check(
    'and NONE of the code around them: CSS variables, URLs, module ids, attributes, measurements, colours',
    !found.some((value) => /dsw-|example\.com|deepseek-ai|data-run-state|0\.5rem|rgba\(|dsh-discord|bundle\.js/u.test(value)),
    JSON.stringify(found),
  )
  check(
    'a string inside a comment or a regex literal is not copy, and is never offered',
    !found.includes('A comment string') && !stringLiterals(FIXTURE).includes('A comment string'),
    JSON.stringify(stringLiterals(FIXTURE).filter((value) => value.includes('comment'))),
  )
  const twice = scanStrings(FIXTURE + FIXTURE)
  check('the scan deduplicates and sorts, so the map a person edits has one entry per string', twice.length === found.length && twice.join('|') === found.join('|'), JSON.stringify(twice))
  const capped = scanStrings(FIXTURE, { limit: 2 })
  check('and it is bounded, so a pathological bundle cannot become an unbounded map', capped.length === 2, JSON.stringify(capped))
}

const CASES = [
  ['Save', true],
  ['OK', true],
  ['Cancel', true],
  ['Save changes', true],
  ['Are you sure?', true],
  ['保存设置', true],
  ['ID', false],
  ['URL', false],
  ['px', false],
  ['button', false],
  ['dsh-discord', false],
  ['index.js', false],
  ['https://example.com', false],
  ['--dsw-alias-bg-layer-2', false],
  ['MutationObserver', false],
  ['rgba(0,0,0,.5)', false],
  ['0.5rem', false],
  ['', false],
  ['   ', false],
]
{
  const wrong = CASES.filter(([value, wanted]) => looksLikeUiCopy(value) !== wanted)
  check(
    'the filter\'s rules hold one case at a time: labels in, code out',
    wrong.length === 0,
    JSON.stringify(wrong),
  )
}

// Read-only, this machine: a real installed bundle, so the scan is not only ever run on my fixture.
{
  const real = join(process.env.HOME || '', 'muen-plugins', 'plugins', 'dsh-generate', 'lib', 'client.js')
  if (existsSync(real)) {
    const found = scanStrings(readFileSync(real, 'utf8'), { limit: 2000 })
    check(
      'a real bundle of ours scans to a plausible candidate set, not to everything and not to nothing',
      found.length > 20 && found.length < 1500,
      JSON.stringify({ found: found.length, sample: found.slice(0, 5) }),
    )
    const noise = found.filter((value) => /dsw-|deepseek-ai|node_modules|\.js$/u.test(value))
    check('and no obvious code token survives the sieve on a real file either', noise.length === 0, JSON.stringify(noise.slice(0, 4)))
  } else {
    note('no real bundle to scan on this machine')
  }
}

note('temp profile: ' + ROOT)
finish()
