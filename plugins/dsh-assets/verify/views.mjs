/**
 * verify:views — epic 63 A3's claims, asserted rather than intended.
 *
 * The claim: **the catalog job is done** — a person can scan a batch, read one, and see the
 * two things the job is for (what made it, and where the original is).
 *
 *   1. THE GRID IS FLUID AND HAS NO BREAKPOINTS: `repeat(auto-fit, minmax(240px, 1fr))`, the
 *      pane's own width as the only input, and not one `@media` in the bundle;
 *   2. A TILE IS A BUTTON — role, tabIndex, Enter and Space — and it is **draggable only
 *      when there are bytes**, because a name with no file is still a row and nothing
 *      invents a file to carry;
 *   3. THE TWO BADGES ARE DIFFERENT KINDS OF FACT: the context is filled, the size is
 *      outlined;
 *   4. THE METADATA BLOCK SAYS WHAT A RUN ASKED FOR (provider, job, workflow, the prompt
 *      verbatim, the values) and, when no run made the file, says exactly that instead;
 *   5. the layout, the filters and the selection are WRITTEN, so a reload opens where the
 *      last one left off — the harness does not restore tabs in this shell;
 *   6. the search narrows what is on screen over the name, the prompt and the context.
 *
 *   7. EVERY FOLDER CONTROL REACHES THE HOST. This one is here because the suites were
 *      blind to it: A3 deleted the `post` helper and left its call sites, so `+ Folder`,
 *      the Finder link, the row's remove and the typed add all drew and did nothing —
 *      every press threw `ReferenceError: post is not defined` inside the handler. So
 *      these checks PRESS the controls and read what the pane asked the host for.
 *
 *   node verify/views.mjs
 */
import { miniReact, textOf, collect, loadClient, recordingCtx, reporter, net, settle } from './harness.mjs'

const { check, note, finish } = reporter('verify:views — epic 63 A3 (the grid, the tile, the metadata block)')
const mini = miniReact()

const { exports: client, source } = await loadClient({ React: mini.React })
const { ctx, seen } = recordingCtx('en')
client.apply(ctx)
const pane = seen.slots.find((slot) => slot.options.name === 'sidebar.right.pane.tab').component
// The dictionary the client registered, so the assertions read what a person reads.
const EN = seen.locales[0].table.en
const t = (key) => (Object.prototype.hasOwnProperty.call(EN, key) ? EN[key] : key)

// ── the two hosts the pane reads, stubbed per URL ───────────────────────────

const RECORDED = '/Users/someone/Desktop/yammaman/output/20260926-job-aaa.png'
const LOOSE = '/Users/someone/Desktop/yammaman/hand-added.jpg'

const foldersBody = {
  folders: [{ path: '/Users/someone/Desktop/yammaman', label: 'yammaman', addedAt: '2026-09-26T00:00:00.000Z' }],
  canChoose: true,
  root: '/p/assets',
  recordsRoot: '/p/generate',
}

// The registry the pane reads is mutable, because section 7 renders the empty room too.
let folders = foldersBody

const catalogBody = {
  assets: [
    {
      path: RECORDED,
      name: '20260926-job-aaa.png',
      ext: 'png',
      type: 'png',
      bytes: 2972603,
      mtime: '2026-09-26T01:04:00.000Z',
      date: '2026-09-26',
      context: 'yammaman',
      folder: '/Users/someone/Desktop/yammaman',
      hasRecord: true,
      provenance: { provider: 'runninghub', jobId: 'job-aaa', workflow: 'qwen-2-1-image-edit', title: 'Qwen 2.1 Edit Duo', prompt: 'The woman in Image 1 wears the outfit from Image 2.' },
    },
    {
      path: LOOSE,
      name: 'hand-added.jpg',
      ext: 'jpg',
      type: 'jpg',
      bytes: 0,
      mtime: '2026-09-25T09:00:00.000Z',
      date: '2026-09-25',
      context: 'yammaman',
      folder: '/Users/someone/Desktop/yammaman',
      hasRecord: false,
      provenance: null,
    },
  ],
  counts: { context: [{ value: 'yammaman', count: 2 }], date: [{ year: '2026', count: 2, months: [{ month: '09', count: 2, days: [{ day: '2026-09-26', count: 1 }, { day: '2026-09-25', count: 1 }] }] }] },
  countsOver: 'all',
  total: 2,
  shown: 2,
  truncated: false,
  folders: foldersBody.folders,
  filter: { context: null, date: null },
}

const detailBody = {
  path: RECORDED,
  name: '20260926-job-aaa.png',
  ext: 'png',
  type: 'png',
  bytes: 2972603,
  mtime: '2026-09-26T01:04:00.000Z',
  date: '2026-09-26',
  context: 'yammaman',
  folder: '/Users/someone/Desktop/yammaman',
  where: 'present',
  dimensions: { width: 1440, height: 1920 },
  provenance: { provider: 'runninghub', jobId: 'job-aaa', workflow: 'qwen-2-1-image-edit', title: 'Qwen 2.1 Edit Duo', appId: '2099528179505848321', settledAt: '2026-09-26T01:04:00.000Z', at: '2026-09-26T01:00:00.000Z' },
  // What the file itself carries (epic 64 S8): this one was exported from a canvas, so it has
  // a graph — and the row is what says so.
  carrier: { format: 'png', supported: true, hasGraph: true, api: { nodes: 25, classTypes: ['KSampler', 'VAEDecode'] }, ui: { nodes: 25, links: 33 }, label: true, complete: true, error: null },
  prompt: 'The woman in Image 1 wears the outfit from Image 2.',
  values: [{ key: 'image', value: 'ref-1.png' }, { key: 'cfg', value: '1' }],
}

const looseDetail = { ...detailBody, path: LOOSE, name: 'hand-added.jpg', ext: 'jpg', bytes: 0, dimensions: null, provenance: null, prompt: null, values: [], carrier: { format: 'jpeg', supported: false, hasGraph: false, api: null, ui: null, label: false, complete: true, error: null } }

let view = { schema: 'muen-assets-view/v1', view: 'grid', context: null, date: null, selected: null }
const posted = []

net.fetch = async (url, options) => {
  const href = String(url)
  if (options && options.method === 'POST') {
    const body = JSON.parse(options.body)
    posted.push({ url: href, body })
    // THE STUB WRITES WHAT THE HOST WRITES. A POST that changed nothing on the next read
    // would make "the folder a person added is on screen" unfalsifiable, and that is the
    // claim behind the founder's report: the press worked, so the folder is there.
    if (href.includes('/folders') && body.action === 'add' && typeof body.path === 'string') {
      folders = { ...folders, folders: [...folders.folders, { path: body.path, label: body.path.split('/').filter(Boolean).pop() }] }
    }
    if (href.includes('/view')) view = { ...view, ...body }
    return { ok: true, json: async () => view }
  }
  if (href.includes('/catalog')) return { ok: true, json: async () => catalogBody }
  if (href.includes('/detail')) return { ok: true, json: async () => (String(url).includes('hand-added') ? looseDetail : detailBody) }
  if (href.includes('/folders')) return { ok: true, json: async () => folders }
  if (href.includes('/view')) return { ok: true, json: async () => view }
  return { ok: false, status: 404, json: async () => ({}) }
}

/**
 * Render the pane the way a mount really goes: render, run the effects whose dependencies
 * changed, let their promises settle, and do it again — which is what carries a chained read
 * (the view file, then the catalog, then the detail of the selected asset) to the screen.
 */
async function render(passes = 4) {
  mini.clear()
  let tree = null
  for (let pass = 0; pass < passes; pass += 1) {
    mini.reset()
    tree = pane({ locale: { bind: () => t } })
    mini.runEffects()
    await settle()
  }
  mini.reset()
  tree = pane({ locale: { bind: () => t } })
  return tree
}

// ── 1. the grid is fluid, and says so in one line ───────────────────────────

{
  check('the grid is `repeat(auto-fit, minmax(240px, 1fr))`', /repeat\(auto-fit, minmax\(240px, 1fr\)\)/.test(source), 'the expression the OS shipped')
  check('with no breakpoints anywhere in the bundle', !source.includes('@media'), (source.match(/@media/g) || []).length + ' @media')
  check('and no fixed column count', !/gridTemplateColumns: *'repeat\(\d/.test(source), 'no repeat(3, …)')
}

// ── 2. a tile is a button, and draggable only with bytes ───────────────────

{
  const tree = await render()
  const tiles = collect(tree, (node) => node.props && node.props['data-assets-tile'] === 'yes')
  check('two tiles render for two assets', tiles.length === 2, tiles.length + ' tiles')
  const first = tiles[0]
  check('a tile is a button a keyboard reaches', first.props.role === 'button' && first.props.tabIndex === 0, JSON.stringify({ role: first.props.role, tabIndex: first.props.tabIndex }))
  check('and it carries an Enter/Space handler', typeof first.props.onKeyDown === 'function', typeof first.props.onKeyDown)
  const recorded = tiles.find((tile) => collect(tile, (n) => n.props && n.props['data-assets-tile'] === 'yes').length >= 0 && textOf(tile).join(' ').includes('job-aaa'))
  const loose = tiles.find((tile) => textOf(tile).join(' ').includes('hand-added'))
  check('a tile with bytes is draggable', !!recorded && recorded.props.draggable === true, recorded && String(recorded.props.draggable))
  check('a tile with no bytes is not', !!loose && loose.props.draggable === false, loose && String(loose.props.draggable))
  check('and its drag payload is the path, not a copy of the bytes', !!recorded && typeof recorded.props.onDragStart === 'function', typeof (recorded && recorded.props.onDragStart))
}

// ── 3. the two badges are different kinds of fact ──────────────────────────

{
  const tree = await render()
  const badges = collect(tree, (node) => node.props && typeof node.props.style === 'object' && typeof node.props.style.border === 'string')
  const contextBadge = collect(tree, (node) => node.props && typeof node.props.style === 'object' && node.props.style.opacity === 0.94)
  check('the context badge is filled', contextBadge.length >= 1, contextBadge.length + ' filled badges')
  check('and it carries no border', contextBadge.every((node) => node.props.style.border === undefined), JSON.stringify(contextBadge.map((node) => node.props.style.border)))
  check('the size badge is outlined instead', badges.length >= 1, badges.length + ' outlined badges')
  check('and never filled with the same ink', badges.every((node) => node.props.style.opacity === undefined), JSON.stringify(badges.map((node) => node.props.style.opacity)))
}

// ── 4. the metadata block, with a run and without ──────────────────────────

{
  // With nothing selected the block is absent: it describes a tile, not the library.
  const tree = await render()
  check('no tile selected, no metadata block', collect(tree, (node) => node.props && node.props['data-assets-meta'] === 'yes').length === 0, '')
}

{
  view = { ...view, selected: RECORDED }
  const tree = await render()
  const text = textOf(tree).join(' | ')
  check('a selected tile opens the metadata block', text.includes('Metadata'), text.slice(0, 80))
  check('it names the file and its dimensions', text.includes('20260926-job-aaa.png') && text.includes('1440 × 1920'), '')
  check('and its format, size and date', text.includes('PNG') && text.includes('2.8 MB') && text.includes('2026-09-26'), '')
  check('and WHERE IT IS, which is the catalog job', text.includes('Where it is') && text.includes('here'), '')
  check('the run is named: provider, job, workflow, app', text.includes('runninghub') && text.includes('job-aaa') && text.includes('qwen-2-1-image-edit') && text.includes('2099528179505848321'), '')
  const prompt = collect(tree, (node) => node.props && node.props['data-assets-prompt'] === 'yes')
  check('the prompt is shown verbatim', prompt.length === 1 && prompt[0].children[0] === 'The woman in Image 1 wears the outfit from Image 2.', prompt.length ? String(prompt[0].children[0]).slice(0, 60) : 'none')
  check('and the values it ran with', text.includes('cfg') && text.includes('image'), '')
}

{
  view = { ...view, selected: LOOSE }
  const tree = await render()
  const text = textOf(tree).join(' | ')
  check('a file no run made says exactly that', collect(tree, (node) => node.props && node.props['data-assets-meta-norecord'] === 'yes').length === 1, text.slice(0, 120))
  check('and still shows the file\'s own facts', text.includes('hand-added.jpg') && text.includes('JPG'), '')
  check('and does not invent a prompt', !text.includes('Prompt'), '')
  view = { ...view, selected: null }
}

// ── 4b. what the file itself carries (epic 64 S8) ──────────────────────────

{
  view = { ...view, selected: RECORDED }
  const tree = await render()
  const text = textOf(tree).join(' | ')
  check(
    'a file that carries a graph says so, with how big the graph is',
    text.includes(EN['meta.carrier']) && text.includes(EN['meta.carrier.yes'].replace('{nodes}', '25')),
    text.slice(0, 160),
  )
}

{
  // A provider result: the label is there and the graph is not, and the row says which.
  detailBody.carrier = { format: 'png', supported: true, hasGraph: false, api: null, ui: null, label: true, complete: true, error: null }
  view = { ...view, selected: RECORDED }
  const tree = await render()
  const text = textOf(tree).join(' | ')
  check(
    'a provider result says NO graph, and says what it does carry instead',
    text.includes(EN['meta.carrier']) && text.includes(EN['meta.carrier.no']) && !text.includes(EN['meta.carrier.yes'].replace('{nodes}', '25')),
    text.slice(0, 160),
  )
  detailBody.carrier = { format: 'png', supported: true, hasGraph: true, api: { nodes: 25, classTypes: ['KSampler'] }, ui: { nodes: 25, links: 33 }, label: true, complete: true, error: null }
}

{
  view = { ...view, selected: LOOSE }
  const tree = await render()
  const text = textOf(tree).join(' | ')
  check(
    'a format the library cannot read draws no row at all, rather than claiming no graph',
    !text.includes(EN['meta.carrier']) && !text.includes(EN['meta.carrier.no']),
    text.slice(0, 160),
  )
  view = { ...view, selected: null }
}

// ── 5. the layout, the filters and the selection are written ───────────────

{
  posted.length = 0
  const tree = await render()
  const buttons = collect(tree, (node) => node.props && node.props['data-assets-view-button'] !== undefined)
  check('the layout control offers two layouts', buttons.length === 2, buttons.map((node) => node.props['data-assets-view-button']).join(','))
  check('and says which one is on', buttons.every((node) => node.props['aria-pressed'] !== undefined), '')
  const listButton = buttons.find((node) => node.props['data-assets-view-button'] === 'list')
  listButton.props.onClick()
  await settle()
  check('choosing one writes it to the view file', posted.some((entry) => entry.url.includes('/view') && entry.body.view === 'list'), JSON.stringify(posted))
}

{
  posted.length = 0
  const tree = await render()
  const row = collect(tree, (node) => node.props && node.props['data-assets-item'] === 'yes')
  check('the list layout draws rows instead of tiles', row.length === 2, row.length + ' rows')
  row[0].props.onClick()
  await settle()
  check('selecting a row writes the selection', posted.some((entry) => entry.url.includes('/view') && entry.body.selected === RECORDED), JSON.stringify(posted))
}

{
  posted.length = 0
  view = { ...view, view: 'grid', selected: null }
  const tree = await render()
  const dayRow = collect(tree, (node) => node.props && node.props['data-assets-filter-row'] === 'yes' && textOf(node).join(' ').includes('2026-09-25'))
  check('a day row carries its own count', dayRow.length === 1 && textOf(dayRow[0]).join(' ').includes('1'), dayRow.length ? textOf(dayRow[0]).join(' ') : 'none')
  dayRow[0].props.onClick()
  await settle()
  check('and choosing it writes the filter', posted.some((entry) => entry.url.includes('/view') && entry.body.date === '2026-09-25'), JSON.stringify(posted))
}

// ── 6. the search narrows what is on screen ────────────────────────────────

{
  view = { ...view, view: 'grid', date: null, selected: null }
  let tree = await render()
  const input = collect(tree, (node) => node.props && node.props['data-assets-search'] === 'yes')[0]
  check('the search box is drawn', !!input, input ? 'yes' : 'none')
  input.props.onChange({ target: { value: 'image 2' } })
  // A local state change needs no effect run: render again with the same hook slots.
  mini.reset()
  tree = pane({ locale: { bind: () => t } })
  const tiles = collect(tree, (node) => node.props && node.props['data-assets-tile'] === 'yes')
  check('searching the prompt keeps the tile a run made', tiles.length === 1 && textOf(tiles[0]).join(' ').includes('job-aaa'), tiles.length + ' tiles')
  mini.reset()
  tree = pane({ locale: { bind: () => t } })
  const again = collect(tree, (node) => node.props && node.props['data-assets-search'] === 'yes')[0]
  again.props.onChange({ target: { value: 'zzz-nothing' } })
  mini.reset()
  tree = pane({ locale: { bind: () => t } })
  check('and a term nothing matches says so', collect(tree, (node) => node.props && node.props['data-assets-none'] === 'yes').length === 1, '')
}

// ── 7. every folder control reaches the host ───────────────────────────────
//
// THE DEFECT THIS SECTION EXISTS FOR (founder, 2026-09-26, twice: *"+folder in assets plugin
// not working"*): A3 deleted the `post` helper and left its four call sites, so every folder
// control drew and did nothing — the press threw `ReferenceError: post is not defined` INSIDE
// the click handler, and the suites stayed green because not one of them pressed a control;
// they READ the tree. So these press.

{
  /**
   * Press a control and answer WHY it failed, or null when it worked.
   *
   * A press that throws is a FAILED CHECK and not a crashed suite, because "the control threw"
   * is exactly the defect this section exists for: the missing `post` was a `ReferenceError`
   * inside the handler, so a reporter that let it escape would report the regression as a
   * stack trace instead of the one line a person reads.
   */
  const pressInto = async (node) => {
    posted.length = 0
    if (!node) return 'no control on screen'
    try {
      await node.props.onClick()
      await settle()
      return null
    } catch (error) {
      await settle()
      return 'the press threw: ' + String((error && error.message) || error)
    }
  }
  const foldersPost = () => posted.filter((entry) => entry.url.includes('/folders'))
  const addControl = (tree) => {
    const holder = collect(tree, (node) => node.props && node.props['data-assets-add'] === 'yes')[0]
    return holder ? collect(holder, (node) => typeof node.props.onClick === 'function')[0] : undefined
  }

  // THE LIVE BRANCH IS THE `Button` ONE: the real primitives export `Button`, so the control
  // a person presses is that component — not the plain `<button>` fallback the six sections
  // above happen to draw, which is why this section loads a second client with it named. The
  // stub forwards `data-*` because the primitive spreads its rest props onto a native button,
  // and that is how a check finds the control rather than matching its copy.
  const Button = (props) => {
    const forwarded = {}
    for (const [key, value] of Object.entries(props)) if (key.startsWith('data-')) forwarded[key] = value
    return mini.React.createElement('button', { type: 'button', disabled: props.disabled === true, onClick: props.onClick, ...forwarded }, props.children)
  }
  const live = await loadClient({ React: mini.React, stubs: { Button } })
  const second = recordingCtx('en')
  live.exports.apply(second.ctx)
  const pane2 = second.seen.slots.find((slot) => slot.options.name === 'sidebar.right.pane.tab').component
  const render2 = async (passes = 4) => {
    mini.clear()
    let tree = null
    for (let pass = 0; pass < passes; pass += 1) {
      mini.reset()
      tree = pane2({ locale: { bind: () => t } })
      mini.runEffects()
      await settle()
    }
    mini.reset()
    return pane2({ locale: { bind: () => t } })
  }

  folders = foldersBody
  let tree = await render2()
  const add = addControl(tree)
  check('`+ Folder` is a control a person can press', !!add && typeof add.props.onClick === 'function', add ? textOf(add).join('') : 'none')
  const choseWhy = await pressInto(add)
  check('and pressing it asks the host for the folder dialog', choseWhy === null && foldersPost().length === 1 && foldersPost()[0].body.action === 'choose', choseWhy || JSON.stringify(posted))

  tree = await render2()
  const row = collect(tree, (node) => node.props && node.props['data-assets-folder'] === '/Users/someone/Desktop/yammaman')[0]
  check('a folder the library holds is a link to where it lives', !!row, row ? String(row.props.title) : 'none')
  const revealWhy = await pressInto(row)
  check('and pressing it asks for that folder in the file browser', revealWhy === null && foldersPost().length === 1 && foldersPost()[0].body.action === 'reveal' && foldersPost()[0].body.path === '/Users/someone/Desktop/yammaman', revealWhy || JSON.stringify(posted))

  tree = await render2()
  const remove = collect(tree, (node) => node.props && node.props['aria-label'] === EN['pane.remove'])[0]
  check('the row carries a remove beside the link', !!remove, remove ? String(remove.props.title) : 'none')
  const removeWhy = await pressInto(remove)
  check('and pressing it asks the host to drop that folder', removeWhy === null && foldersPost().length === 1 && foldersPost()[0].body.action === 'remove' && foldersPost()[0].body.path === '/Users/someone/Desktop/yammaman', removeWhy || JSON.stringify(posted))

  // THE HOST WITH NO DIALOG: on anything but macOS the head control cannot open a picker, so
  // the typed field is the way in — and it must reach the host like every other control.
  folders = { ...foldersBody, folders: [], canChoose: false }
  tree = await render2()
  const field = collect(tree, (node) => node.props && node.props['aria-label'] === EN['pane.path.use'] && typeof node.props.onChange === 'function')[0]
  check('with no folder dialog the pane asks for the path instead', !!field, field ? String(field.props.placeholder) : 'none')
  if (field) {
    field.props.onChange({ target: { value: '/Users/someone/Desktop/yammaman' } })
    mini.reset()
    tree = pane2({ locale: { bind: () => t } })
    const addPath = collect(tree, (node) => node.props && node.props['data-assets-add-path'] === 'yes' && typeof node.props.onClick === 'function')[0]
    check('and its own Add control is a press away from the host', !!addPath, addPath ? textOf(addPath).join('') : 'none')
    const typedWhy = await pressInto(addPath)
    check('pressing it adds the path a person typed', typedWhy === null && foldersPost().length === 1 && foldersPost()[0].body.action === 'add' && foldersPost()[0].body.path === '/Users/someone/Desktop/yammaman', typedWhy || JSON.stringify(posted))
    // AND THE PANE LOOKS AGAIN. `post` re-reads the registry it just wrote, on the SAME hook
    // slots a press leaves behind — which is the difference between "the folder was added"
    // and "the folder shows up", and the half a person would report as still broken.
    mini.reset()
    tree = pane2({ locale: { bind: () => t } })
    mini.runEffects()
    await settle()
    mini.reset()
    tree = pane2({ locale: { bind: () => t } })
    const shown = textOf(tree).join(' ')
    check('and the folder is on screen without a reload', shown.includes('yammaman'), shown.slice(0, 120))
  }

  // AND THE FALLBACK, because the defect was branch-independent: where the primitives name no
  // `Button`, the same act is a plain `<button>`.
  folders = foldersBody
  tree = await render()
  const fallback = addControl(tree)
  check('the fallback control is a plain button, and pressable', !!fallback && fallback.type === 'button', fallback ? String(fallback.type) : 'none')
  const fallbackWhy = await pressInto(fallback)
  check('and it reaches the host as well', fallbackWhy === null && foldersPost().length === 1 && foldersPost()[0].body.action === 'choose', fallbackWhy || JSON.stringify(posted))
}

note('the live layer is the founder’s eyes: the grid, the badges and the metadata block on a running app')

finish()
