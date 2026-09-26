/**
 * verify:handoff — epic 64 S7's claims, asserted rather than intended.
 *
 * The claim: **an asset a run made is a way back into that run.** RunningHub's own asset
 * library works this way (`regenerate` takes a person back to the workflow with the values
 * they used); here the way back is the harness's own seam, and it crosses no code:
 *
 *   an asset's **Regenerate**
 *     → `openTab('generate', { params: { run, unit, provider } })`
 *       → the Generate pane opens that workflow's tab and shows that run inside its series.
 *
 * WHAT THE CALL CARRIES, AND WHY THREE FACTS. A run id alone cannot open anything: the pane
 * opens a WORKFLOW and then shows the run inside it, so the call names the workflow (the
 * record's own unit field — `adapter` for RunningHub, `name` for Krea) and the provider it
 * ran on. Both come off the record, so nothing is guessed and no second lookup is invented.
 *
 * THE CLAIMS:
 *
 *   1. A file a run made draws ONE control, in the metadata block, and it is the block's
 *      action — not a second tile affordance, and not drawn for a file no run made;
 *   2. pressing it calls `openTab('generate', …)` with exactly `{ run, unit, provider }`, and
 *      runs nothing (no request, no run — the press that spends is still Generate's own);
 *   3. with no Generate tab type registered, the same block draws its own metadata plus ONE
 *      sentence, and NEVER a control that would do nothing — the library ships alone;
 *   4. a record that does not name its workflow gets the other sentence, because the pane
 *      cannot open a workflow nobody named;
 *   5. the three params are the three the receiver reads — checked against the sibling
 *      plugin's source when it is here, and reported as an unchecked contract when it is not
 *      (this package goes to the market on its own);
 *   6. the host reads a KREA record's own unit field: a Krea record has no `adapter`, and
 *      reading only that left every Krea asset unable to say what made it.
 *
 *   node verify/handoff.mjs
 */
import { readFile } from 'node:fs/promises'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { miniReact, textOf, collect, loadClient, recordingCtx, reporter, net, settle, ROOT } from './harness.mjs'
import { assetDetail } from '../lib/catalog.js'

const { check, note, finish } = reporter('verify:handoff — epic 64 S7 (an asset is a way back into its run)')
const mini = miniReact()

/** The kit's own Button, stubbed: the control a person presses is the harness primitive. */
const ButtonStub = (props) => mini.React.createElement('button', { type: 'button', ...props }, props.children)

const { exports: client, source } = await loadClient({ React: mini.React, stubs: { Button: ButtonStub } })
const { ctx, seen } = recordingCtx('en')
client.apply(ctx)
const pane = seen.slots.find((slot) => slot.options.name === 'sidebar.right.pane.tab').component
const EN = seen.locales[0].table.en
const t = (key) => (Object.prototype.hasOwnProperty.call(EN, key) ? EN[key] : key)

// ── the two hosts the pane reads, stubbed per URL ───────────────────────────

const RECORDED = '/Users/someone/Desktop/yammaman/output/20260926-job-aaa.png'
const KREA_MADE = '/Users/someone/Desktop/yammaman/output/20260926-job-krea.png'
const LOOSE = '/Users/someone/Desktop/yammaman/hand-added.jpg'
const NAMELESS = '/Users/someone/Desktop/yammaman/output/20260926-job-noname.png'

const foldersBody = {
  folders: [{ path: '/Users/someone/Desktop/yammaman', label: 'yammaman', addedAt: '2026-09-26T00:00:00.000Z' }],
  canChoose: true,
  root: '/p/assets',
  recordsRoot: '/p/generate',
}

const asset = (path, name, provenance) => ({
  path,
  name,
  ext: 'png',
  type: 'png',
  bytes: 2972603,
  mtime: '2026-09-26T01:04:00.000Z',
  date: '2026-09-26',
  context: 'yammaman',
  folder: '/Users/someone/Desktop/yammaman',
  hasRecord: provenance !== null,
  provenance,
})

const QWEN = { provider: 'runninghub', jobId: 'job-aaa', workflow: 'qwen-2-1-image-edit', title: 'Qwen 2.1 Edit Duo', prompt: 'The woman in Image 1 wears the outfit from Image 2.' }

const catalogBody = {
  assets: [asset(RECORDED, '20260926-job-aaa.png', QWEN), asset(KREA_MADE, '20260926-job-krea.png', { provider: 'krea', jobId: 'job-krea', workflow: 'krea2-raw-turbo-claire', title: 'Krea 2 Raw' }), asset(LOOSE, 'hand-added.jpg', null), asset(NAMELESS, '20260926-job-noname.png', { provider: 'runninghub', jobId: 'job-noname', workflow: null, title: 'Removed Tool' })],
  counts: { context: [{ value: 'yammaman', count: 4 }], date: [] },
  countsOver: 'all',
  total: 4,
  shown: 4,
  truncated: false,
  folders: foldersBody.folders,
  filter: { context: null, date: null },
}

const detailFor = (path) => {
  const found = catalogBody.assets.find((entry) => entry.path === path) || catalogBody.assets[0]
  return {
    path: found.path,
    name: found.name,
    ext: 'png',
    type: 'png',
    bytes: found.bytes,
    mtime: found.mtime,
    date: found.date,
    context: found.context,
    folder: found.folder,
    where: 'present',
    dimensions: { width: 1440, height: 1920 },
    provenance: found.provenance,
    prompt: found.provenance ? found.provenance.prompt : null,
    values: [],
  }
}

let view = { schema: 'muen-assets-view/v1', view: 'grid', context: null, date: null, selected: RECORDED }
const calls = []

net.fetch = async (url, options) => {
  const href = String(url)
  calls.push({ url: href, method: (options && options.method) || 'GET' })
  if (href.includes('/catalog')) return { ok: true, json: async () => catalogBody }
  if (href.includes('/detail')) return { ok: true, json: async () => detailFor(decodeURIComponent(href.split('path=')[1] || '')) }
  if (href.includes('/folders')) return { ok: true, json: async () => foldersBody }
  return { ok: true, json: async () => view }
}

/**
 * Render the pane the way a mount really goes, with the props a real tab body receives: the
 * locale, and `useTabInfo` — the harness's own hook, whose `tab.actions.openTab` is the seam
 * this slice uses.
 */
async function render({ openTab = null, passes = 4 } = {}) {
  const props = { locale: { bind: () => t } }
  if (openTab !== null) props.useTabInfo = () => ({ tab: { actions: { openTab }, navigation: { params: null, revision: 0 } } })
  mini.clear()
  let tree = null
  for (let pass = 0; pass < passes; pass += 1) {
    mini.reset()
    tree = pane(props)
    mini.runEffects()
    await settle()
  }
  mini.reset()
  tree = pane(props)
  return tree
}

/** What the control's own click does, with nothing else in the way. */
function press(tree, label) {
  const control = collect(tree, (node) => node.props && node.props['data-assets-continue'] === label)[0]
  if (!control) return null
  control.props.onClick()
  return control
}

// ── 1. the control, and what it does ────────────────────────────────────────

{
  // THE FOUNDER'S OWN SEAM, read off the running app's contract: the Generate type is on the
  // page (its own boot registers this row), and a person is looking at a run's picture.
  ctx.sidebarRightTabs.register({ id: '@muen/dsh-generate', kind: 'generate', title: () => 'Generate' })
  const opened = []
  const tree = await render({ openTab: (...args) => opened.push(args) })

  const control = collect(tree, (node) => node.props && node.props['data-assets-continue'] === 'job-aaa')[0]
  check('a file a run made draws the way back into that run', !!control, control ? 'drawn' : 'nothing drawn')
  check('and it lives in the metadata block, which is what the block is for', !!control && collect(tree, (node) => node.props && node.props['data-assets-meta'] === 'yes').length === 1, '')
  check('it is the block\'s one action, so a tile keeps being a tile', collect(tree, (node) => node.props && node.props['data-assets-continue-row'] === 'yes').length === 1, '')
  check('and it says what it does rather than what it costs', !!control && control.props.title === EN['meta.continue.hint'], control ? String(control.props.title).slice(0, 60) : 'no control')

  check('nothing was opened by drawing it', opened.length === 0, JSON.stringify(opened))

  press(tree, 'job-aaa')
  check('pressing it opens the Generate pane', opened.length === 1 && opened[0][0] === 'generate', JSON.stringify(opened.map((entry) => entry[0])))
  const params = opened[0] ? opened[0][1].params : null
  check(
    'carrying the three facts a run record holds: the run, its workflow and its provider',
    !!params && params.run === 'job-aaa' && params.unit === 'qwen-2-1-image-edit' && params.provider === 'runninghub',
    JSON.stringify(params),
  )
  check('and nothing was typed at the receiver but those three', !!params && Object.keys(params).sort().join(',') === 'provider,run,unit', JSON.stringify(params && Object.keys(params)))
  check(
    'NOTHING RUNS: the press posts no request of its own, so no gate was bypassed',
    !calls.some((call) => call.method === 'POST'),
    JSON.stringify(calls.filter((call) => call.method === 'POST').map((call) => call.url)),
  )
}

{
  // A KREA ASSET NAMES ITS UNIT THE SAME WAY, under the field its own provider writes.
  const opened = []
  view = { ...view, selected: KREA_MADE }
  const tree = await render({ openTab: (...args) => opened.push(args) })
  press(tree, 'job-krea')
  const params = opened[0] ? opened[0][1].params : null
  check('a Krea asset hands off under its own unit name too', !!params && params.unit === 'krea2-raw-turbo-claire' && params.provider === 'krea', JSON.stringify(params))
}

// ── 2. the two absences, said out loud ──────────────────────────────────────

{
  // NO GENERATE ON THE PAGE: the library ships alone and must still be a whole library.
  const { ctx: alone, seen: aloneSeen } = recordingCtx('en')
  client.apply(alone)
  const alonePane = aloneSeen.slots.find((slot) => slot.options.name === 'sidebar.right.pane.tab').component
  const opened = []
  view = { ...view, selected: RECORDED }
  mini.clear()
  let tree = null
  for (let pass = 0; pass < 4; pass += 1) {
    mini.reset()
    tree = alonePane({ locale: { bind: () => t }, useTabInfo: () => ({ tab: { actions: { openTab: (...args) => opened.push(args) }, navigation: { params: null, revision: 0 } } }) })
    mini.runEffects()
    await settle()
  }
  mini.reset()
  tree = alonePane({ locale: { bind: () => t }, useTabInfo: () => ({ tab: { actions: { openTab: (...args) => opened.push(args) }, navigation: { params: null, revision: 0 } } }) })

  const text = textOf(tree).join(' | ')
  check('with no Generate tab type registered, the library draws its own metadata', text.includes(EN['meta.title']) && text.includes('job-aaa') && text.includes('qwen-2-1-image-edit'), text.slice(0, 100))
  const sentence = collect(tree, (node) => node.props && node.props['data-assets-no-continue'] === 'no-generate')[0]
  check('plus ONE sentence saying why the run cannot be opened here', !!sentence && textOf(sentence).join(' ').includes(EN['meta.continue.noPlugin']), sentence ? textOf(sentence).join(' ') : 'no sentence')
  check('and never a dead control', collect(tree, (node) => node.props && node.props['data-assets-continue'] !== undefined).length === 0, '')
  check('which is one sentence and not two', collect(tree, (node) => node.props && node.props['data-assets-no-continue'] !== undefined).length === 1, '')

  // The press that could not be made: nothing was called, and nothing was posted.
  check('and nothing was opened by a library that has nowhere to open it', opened.length === 0, JSON.stringify(opened))
}

{
  // A RECORD THAT NAMES NO WORKFLOW: the pane cannot open what nobody named, and the other
  // sentence is the honest one.
  const opened = []
  view = { ...view, selected: NAMELESS }
  const tree = await render({ openTab: (...args) => opened.push(args) })
  const sentence = collect(tree, (node) => node.props && node.props['data-assets-no-continue'] === 'no-workflow')[0]
  check('a run that does not name its workflow gets the other sentence', !!sentence && textOf(sentence).join(' ').includes(EN['meta.continue.noWorkflow']), sentence ? textOf(sentence).join(' ') : 'no sentence')
  check('and no control either', collect(tree, (node) => node.props && node.props['data-assets-continue'] !== undefined).length === 0, '')
  check('and nothing opened', opened.length === 0, JSON.stringify(opened))
}

{
  // A FILE NO RUN MADE: neither a control nor a sentence — there is no run to speak of, and
  // the block already says so in its own words.
  view = { ...view, selected: LOOSE }
  const tree = await render({ openTab: () => {} })
  const text = textOf(tree).join(' | ')
  check('a file no run made draws no handoff at all', collect(tree, (node) => node.props && node.props['data-assets-continue'] !== undefined).length === 0 && collect(tree, (node) => node.props && node.props['data-assets-no-continue'] !== undefined).length === 0, text.slice(0, 80))
  check('and it still says the file has no run behind it', !!collect(tree, (node) => node.props && node.props['data-assets-meta-norecord'] === 'yes')[0], '')
}

// ── 3. the contract, checked against the receiver when it is here ───────────

{
  let sibling = null
  try {
    sibling = await readFile(join(ROOT, '..', 'dsh-generate', 'lib', 'client.js'), 'utf8')
  } catch {
    sibling = null
  }
  if (sibling === null) {
    note('the Generate plugin is not beside this one: the params contract is unchecked here')
  } else {
    check(
      'the receiver reads the tab\'s navigation params, which is where this library writes',
      sibling.includes('useTabInfo') && sibling.includes('navigation') && sibling.includes('params'),
      '',
    )
    check('and it reads the run this library hands over', sibling.includes('params.run') || /params && typeof params\.run/.test(sibling), 'params.run')
    check('and the workflow it names', /params\.unit/.test(sibling), 'params.unit')
    check('and the provider, so the same name under two providers cannot be confused', /params\.provider/.test(sibling), 'params.provider')
    // The other half of never-a-dead-link: a unit that is gone must be said, not swallowed.
    check('and it says so when the workflow named is not installed', sibling.includes('data-generate-missing-unit'), 'the receiver\'s own notice')
  }
}

// ── 4. the host: a Krea record's own unit field ─────────────────────────────

{
  // A KREA RECORD HAS NO `adapter`. The route that reads records has to know that, or every
  // Krea asset is an asset that cannot name what made it — and the handoff above is then a
  // sentence rather than a control. Driven against the shipped host, on a temp records root.
  const dir = mkdtempSync(join(tmpdir(), 'assets-handoff-'))
  try {
    const runs = join(dir, 'krea', 'runs')
    mkdirSync(runs, { recursive: true })
    writeFileSync(
      join(runs, 'job-k.json'),
      JSON.stringify({
        schema: 'muen-krea-run/v1',
        jobId: 'job-k',
        name: 'krea-2-medium-turbo',
        model: 'image/krea/krea-2/medium-turbo',
        title: 'Krea 2 Turbo',
        outcome: { state: 'done', saved: [{ file: '/Users/someone/Desktop/yammaman/output/krea.png', bytes: 12, type: 'png' }] },
      }),
    )
    const told = await assetDetail({ folders: [{ path: '/Users/someone/Desktop/yammaman', label: 'yammaman' }], recordsRoot: dir, path: '/Users/someone/Desktop/yammaman/output/krea.png' })
    check(
      'the host answers a Krea asset\'s workflow from the field its own runner writes',
      !!told.provenance && told.provenance.workflow === 'krea-2-medium-turbo' && told.provenance.provider === 'krea',
      JSON.stringify(told.provenance),
    )
    const rh = await assetDetail({ folders: [{ path: '/Users/someone/Desktop/yammaman', label: 'yammaman' }], recordsRoot: dir, path: '/Users/someone/Desktop/yammaman/output/other.png' })
    check('and a record it does not hold is still the file\'s own facts', rh.provenance === null, JSON.stringify(rh.provenance))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

// ── 5. the copy is in both languages ────────────────────────────────────────

{
  const table = seen.locales[0].table
  const keys = ['meta.continue', 'meta.continue.hint', 'meta.continue.noPlugin', 'meta.continue.noWorkflow']
  check('every handoff word is translated, not just the english one', keys.every((key) => typeof table.en[key] === 'string' && table.en[key] !== '' && typeof table.zh[key] === 'string' && table.zh[key] !== ''), JSON.stringify(keys.filter((key) => !table.zh[key])))
}

note('the live layer is the founder’s eyes: with Generate installed, Regenerate on an asset opens that run’s workflow')
note('and one app restart is owed before the Assets pane carries this: a client bundle is captured at activation')

finish()
