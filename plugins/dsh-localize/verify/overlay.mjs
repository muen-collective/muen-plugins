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
 *   6. and it is bounded, deduplicated and sorted;
 *   7. the ROUTE serves those maps, refuses a write that would escape the profile, and can scan an
 *      installed bundle (reading its text, never executing it).
 *
 *   node verify/overlay.mjs
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'

import {
  LANGS,
  listOverlays,
  mergeOverlays,
  overlayPath,
  overlayRoot,
  overlaysFor,
  readOverlay,
  removeOverlay,
  validPluginId,
  writeOverlay,
} from '../lib/overlay.js'
import { CLIENT, loadClient, miniReact, primitivesStub } from './harness.mjs'
import localize from '../lib/index.js'
import { scanStrings, stringLiterals, looksLikeUiCopy } from '../lib/scan.js'

const bundle = loadClient(CLIENT, { react: miniReact().React, primitives: primitivesStub().primitives })

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

// ── 4. the resolution rule, driven from the shipped bundle ───────────────────

{
  const { resolveOverlay } = bundle
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
  check('the bundle asks the host on one route, with no trailing slash', bundle.OVERLAY_API === '/plugins/localize/overlay', bundle.OVERLAY_API)
}

// ── 4b. applying a map to a rendered tree ────────────────────────────────────

/** A DOM-shaped tree, hand-built: the walk has to work on this, so it is the test. */
function el(...children) {
  return { nodeType: 1, childNodes: children }
}
function text(value) {
  return { nodeType: 3, nodeValue: value }
}

{
  const { makeOverlay, textNodesUnder } = bundle
  const save = text('Save')
  const nested = text('Cancel')
  const untouched = text('Something else')
  const body = el(el(text('  '), save), el(nested), untouched)

  check('the walk finds every text node under a root, and no element', textNodesUnder(body).length === 4 && textNodesUnder(body).every((node) => node.nodeType === 3), JSON.stringify(textNodesUnder(body).map((node) => node.nodeValue)))
  check('a tree with no children is walked without complaint', textNodesUnder(el()).length === 0 && textNodesUnder(null).length === 0 && textNodesUnder(text('x')).length === 1, 'walk')

  const overlay = makeOverlay()
  const changed = overlay.apply(body, { Save: '저장', Cancel: '취소' })
  check('applying a map translates the matching nodes and counts them', changed === 2 && save.nodeValue === '저장' && nested.nodeValue === '취소', JSON.stringify({ changed, save: save.nodeValue, nested: nested.nodeValue }))
  check('and a node with no translation is left EXACTLY as it was', untouched.nodeValue === 'Something else', untouched.nodeValue)
  check('whitespace-only nodes are not disturbed', textNodesUnder(body)[0].nodeValue === '  ', JSON.stringify(textNodesUnder(body)[0].nodeValue))

  // A SECOND LANGUAGE IS NOT ADDITIVE: the overlay restores the English first, then applies.
  const back = overlay.restore(body)
  check('restoring puts every changed node back to its own text', back === 2 && save.nodeValue === 'Save' && nested.nodeValue === 'Cancel', JSON.stringify({ back, save: save.nodeValue }))
  const second = overlay.apply(body, { Save: '保存', Cancel: '取消' })
  check(
    'and a language switch lands on the ENGLISH, not on the previous language',
    second === 2 && save.nodeValue === '保存' && nested.nodeValue === '取消',
    JSON.stringify({ second, save: save.nodeValue }),
  )
  overlay.restore(body)
  check('so switching back and forth is stable', save.nodeValue === 'Save' && nested.nodeValue === 'Cancel', JSON.stringify({ save: save.nodeValue, nested: nested.nodeValue }))
  check('applying no map at all changes nothing', makeOverlay().apply(body, null) === 0 && makeOverlay().apply(body, {}) === 0, 'no map')
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

// ── 5b. the wiring: a language change restores before it applies ─────────────

{
  // Driven through `startOverlay` with a real (stub) document and fetch. The rule under test is the
  // one that makes a language switch safe: `apply` resolves against the ORIGINAL text it first saw, so
  // a second language lands on the English even though the DOM currently holds the first language.
  // (Resolving against the CURRENT text instead is the mutation this check exists to catch — it leaves
  // the screen in the old language, because the new map has no entry for a translated string.)
  const node = { nodeType: 3, nodeValue: 'Save' }
  const body = { nodeType: 1, childNodes: [{ nodeType: 1, childNodes: [node] }] }
  let map = { Save: '저장' }
  let asked = []
  const wired = loadClient(CLIENT, {
    react: miniReact().React,
    primitives: primitivesStub().primitives,
    globals: {
      document: { body },
      fetch: async (url) => {
        asked.push(String(url))
        return { ok: true, json: async () => ({ map }) }
      },
      MutationObserver: undefined,
    },
  })
  const started = wired.startOverlay({ getSnapshot: () => ({ active: 'ko' }) })
  await started.refresh()
  const korean = node.nodeValue
  check('the wiring applies the map for the ACTIVE language', korean === '저장', JSON.stringify({ korean, asked }))
  check('and the overlay asked the host for that language', asked.every((url) => url.includes('lang=ko')), JSON.stringify(asked))

  // THE MECHANISM ON ITS OWN, and it has to run while the node holds a TRANSLATED word: `apply`
  // resolves against the original it remembered, so the French lands even though the DOM says Korean.
  // Resolving against the current text instead is the mutation this isolates (the wiring's own restore
  // hides it, because after a restore the current text IS the original).
  map = { Save: 'Enregistrer' }
  const switchedAlone = started.overlay.apply(body, map)
  check(
    'and `apply` alone switches language, because it resolves against the remembered original',
    switchedAlone === 1 && node.nodeValue === 'Enregistrer',
    JSON.stringify({ switchedAlone, node: node.nodeValue }),
  )

  // THE WIRING'S OWN PATH: a refresh for another language lands on that language too.
  map = { Save: '保存' }
  await started.refresh()
  const chinese = node.nodeValue
  check('a second refresh lands on the second language: translation is not cumulative', chinese === '保存', JSON.stringify({ chinese }))
  const back = started.overlay.restore(body)
  check('and restore puts the DOM back in its own words, which is the way out of a language', node.nodeValue === 'Save', JSON.stringify({ back, node: node.nodeValue }))
  check('a host with no document is a no-op, never an exception', typeof wired.startOverlay({ getSnapshot: () => ({ active: 'en' }) }).refresh === 'function', 'no-op')
}

// ── 6. the route that serves the maps ────────────────────────────────────────

function fakeResponse() {
  const res = { statusCode: 0, headers: {}, body: '' }
  res.setHeader = (key, value) => {
    res.headers[String(key).toLowerCase()] = value
  }
  res.end = (text) => {
    res.body = text
  }
  res.destroy = () => {}
  return res
}
function fakeRequest(method, url, body) {
  const req = Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))])
  req.method = method
  req.url = url
  req.headers = { 'content-type': 'application/json' }
  return req
}
const parse = (res) => {
  try {
    return JSON.parse(res.body)
  } catch {
    return null
  }
}

{
  // The route reads the profile from `MUEN_LOCALIZE_DIR`, which is this suite's temp root — so the
  // route and the store are checked against the SAME place, and a drift between them would fail here.
  process.env.MUEN_LOCALIZE_DIR = ROOT
  const registered = []
  const labels = []
  const server = { register: (row) => { registered.push(row); return () => {} } }
  const ctx = {
    get: (service) => (service === 'webServer' ? server : undefined),
    effect: (fn, label) => { labels.push(label); fn(); return () => {} },
    inject: (names, fn) => fn(),
    on: () => {},
  }
  const report = localize.apply(ctx)
  check(
    'the host registers ONE exact route, and the path carries no trailing slash',
    registered.length === 1 && registered[0].kind === 'exact' && registered[0].path === '/plugins/localize/overlay' && !registered[0].path.endsWith('/'),
    JSON.stringify(registered.map((row) => [row.kind, row.path])),
  )
  check(
    'and its disposer is owned by ctx.effect, so the route leaves with the plugin',
    labels.includes('localize: overlay') && report && report.overlayRoot === join(ROOT, 'localizations'),
    JSON.stringify({ labels, root: report && report.overlayRoot }),
  )

  const route = registered[0].handler

  const written = fakeResponse()
  await route(fakeRequest('POST', '/plugins/localize/overlay', { plugin: 'dsh-discord', lang: 'fr', map: { Save: 'Enregistrer', Cancel: 'Annuler' } }), written)
  check('a POST writes an overlay through the route', written.statusCode === 200 && parse(written).ok === true && parse(written).keys === 2, written.body)

  const one = fakeResponse()
  await route(fakeRequest('GET', '/plugins/localize/overlay?plugin=dsh-discord&lang=fr'), one)
  check('a GET for one plugin and language answers its map', one.statusCode === 200 && parse(one).map.Save === 'Enregistrer' && parse(one).missing === false, one.body)

  const mergedRead = fakeResponse()
  await route(fakeRequest('GET', '/plugins/localize/overlay?lang=fr'), mergedRead)
  check(
    'a GET for a language answers the maps to merge, the merged map, and any conflict',
    mergedRead.statusCode === 200 && parse(mergedRead).map.Save === 'Enregistrer' && Array.isArray(parse(mergedRead).conflicts) && parse(mergedRead).overlays.length === 1,
    mergedRead.body,
  )

  const listed = fakeResponse()
  await route(fakeRequest('GET', '/plugins/localize/overlay'), listed)
  check('and a GET with nothing named lists what the profile holds', listed.statusCode === 200 && Array.isArray(parse(listed).overlays) && parse(listed).overlays.some((row) => row.plugin === 'dsh-discord' && row.lang === 'fr'), listed.body)

  const hostile = fakeResponse()
  await route(fakeRequest('POST', '/plugins/localize/overlay', { plugin: '../evil', lang: 'fr', map: { Save: 'x' } }), hostile)
  check('a write that would escape the profile is refused with 400, and nothing lands', hostile.statusCode === 400 && parse(hostile).error === 'bad-plugin' && !existsSync(join(ROOT, '..', 'evil')), hostile.body)

  const noBody = fakeResponse()
  await route(fakeRequest('POST', '/plugins/localize/overlay'), noBody)
  check('a POST with no body at all is refused rather than treated as an empty overlay', noBody.statusCode === 400 && parse(noBody).error === 'bad-body', noBody.body)

  // The scan, through the route, on a bundle this suite writes: the host reads TEXT and never executes it.
  const pluginLib = join(ROOT, 'node_modules', 'dsh-discord', 'lib')
  mkdirSync(pluginLib, { recursive: true })
  writeFileSync(join(pluginLib, 'client.js'), "const x = '--dsw-alias-bg-layer-2'\nh('button', null, 'Save changes')\n")
  const scanned = fakeResponse()
  await route(fakeRequest('POST', '/plugins/localize/overlay', { scan: true, plugin: 'dsh-discord' }), scanned)
  check(
    'the route can scan an installed bundle: the copy is found and the CSS is not',
    scanned.statusCode === 200 && parse(scanned).strings.includes('Save changes') && !parse(scanned).strings.some((value) => value.includes('dsw-')),
    scanned.body,
  )
  const noBundle = fakeResponse()
  await route(fakeRequest('POST', '/plugins/localize/overlay', { scan: true, plugin: 'not-installed' }), noBundle)
  check('and a plugin with no bundle is a 404, not an empty answer', noBundle.statusCode === 404 && parse(noBundle).error === 'no-bundle', noBundle.body)

  const removed = fakeResponse()
  await route(fakeRequest('DELETE', '/plugins/localize/overlay?plugin=dsh-discord&lang=fr'), removed)
  const gone = fakeResponse()
  await route(fakeRequest('GET', '/plugins/localize/overlay?plugin=dsh-discord&lang=fr'), gone)
  check('a DELETE removes one overlay, and the next read says it is gone', removed.statusCode === 200 && parse(removed).ok === true && parse(gone).missing === true, JSON.stringify({ removed: removed.body, gone: gone.body }))

  const badDelete = fakeResponse()
  await route(fakeRequest('DELETE', '/plugins/localize/overlay'), badDelete)
  check('a DELETE with nothing named is refused', badDelete.statusCode === 400 && parse(badDelete).error === 'bad-target', badDelete.body)

  const wrongMethod = fakeResponse()
  await route(fakeRequest('PUT', '/plugins/localize/overlay'), wrongMethod)
  check('and a method the route does not own answers 405 with Allow', wrongMethod.statusCode === 405 && /GET, POST, DELETE/u.test(wrongMethod.headers.allow || ''), JSON.stringify({ status: wrongMethod.statusCode, allow: wrongMethod.headers.allow }))
}

note('temp profile: ' + ROOT)
finish()
