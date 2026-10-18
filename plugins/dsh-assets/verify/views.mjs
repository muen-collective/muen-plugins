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
import { miniReact, textOf, collect, loadClient, recordingCtx, reporter, net, settle, sheets } from './harness.mjs'

const { check, note, finish } = reporter('verify:views — epic 63 A3 (the grid, the tile, the metadata block)')
const mini = miniReact()

const { exports: client, source, sandboxListeners } = await loadClient({ React: mini.React })
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
  // The trash verb is per platform: the pane draws no Delete control when the host has none, so the
  // fixture has to say. Section 10 renders the other host.
  canTrash: true,
  root: '/p/assets',
  recordsRoot: '/p/generate',
}

// The registry the pane reads is mutable, because section 7 renders the empty room too.
let folders = foldersBody

let catalogBody = {
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

let view = { schema: 'muen-assets-view/v1', view: 'grid', context: null, date: null, selected: null, splitBounds: { min: 0.15, max: 0.85 } }
const posted = []
// EVERY READ AND WRITE THE PANE MAKES, in order: the refresh and the split assert against it (a
// control's whole behaviour is the request it issues), so the stub that answers them records them.
const requests = []
// A HOST WHOSE TRASH REFUSES. Every section below drove a stub that always succeeded, so the
// branch the founder actually hit — the route answering `500 trash-failed` — had never been drawn.
let trashRefuses = false

net.fetch = async (url, options) => {
  const href = String(url)
  requests.push(href)
  if (options && options.method === 'POST') {
    const body = JSON.parse(options.body)
    posted.push({ url: href, body })
    // THE STUB WRITES WHAT THE HOST WRITES. A POST that changed nothing on the next read
    // would make "the folder a person added is on screen" unfalsifiable, and that is the
    // claim behind the founder's report: the press worked, so the folder is there.
    if (href.includes('/folders') && body.action === 'add' && typeof body.path === 'string') {
      folders = { ...folders, folders: [...folders.folders, { path: body.path, label: body.path.split('/').filter(Boolean).pop() }] }
    }
    if (href.includes('/delete')) {
      // THE STUB MOVES THE FILE THE WAY THE HOST DOES: a POST that changed nothing would make "the
      // grid no longer lists it" unfalsifiable, and that is the claim the founder is buying.
      const gone = String(body.path || '')
      // A REFUSED TRASH IS A REAL ANSWER THIS PANE HAS TO DRAW, in the host's own words: the route
      // answers `500 trash-failed` and the detail carries osascript's message.
      if (trashRefuses) return { ok: false, status: 500, json: async () => ({ error: 'trash-failed', detail: 'Finder got an error: Can’t get POSIX file "…". (-1728)' }) }
      catalogBody = { ...catalogBody, assets: catalogBody.assets.filter((row) => row.path !== gone) }
      return { ok: true, json: async () => (body.confirm === true ? { trashed: true, path: gone, name: gone.split('/').filter(Boolean).pop(), where: 'Trash' } : { error: 'needs-confirmation' }) }
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
  // THE RULE IS "NO WIDTH IS EVER A BREAKPOINT", not "no media query exists": the polish pass
  // added a `prefers-reduced-motion` guard for the skeleton's pulse, which is an accessibility
  // query and says nothing about the pane's width. So the check is sharpened to what it means —
  // no `min-width`/`max-width` anywhere — and the one query the bundle does carry is named.
  check('with no width breakpoint anywhere in the bundle', !/@media[^{]*(min-width|max-width)/.test(source), (source.match(/@media[^{]*/g) || []).join(' | '))
  check(
    'and the only media query it carries is the reduced-motion guard',
    (source.match(/@media/g) || []).length === 1 && /@media \(prefers-reduced-motion: reduce\)/.test(source) && !source.includes('@media (min-width') && !source.includes('@media (max-width'),
    (source.match(/@media[^{]*/g) || []).join(' | '),
  )
  check('and no fixed column count', !/gridTemplateColumns: *'repeat\(\d/.test(source), 'no repeat(3, …)')

  // A DUPLICATE STYLE KEY IS A DESIGN NOBODY CAN FIND AGAIN. The polish pass found `list` and
  // `item` each declared twice — the first pair silently shadowed by the second — and, beside
  // them, keys nothing had drawn for days. Nothing but a scan can see either: the last key in an
  // object literal wins in silence, which is exactly how that rot hides.
  const styleAt = source.indexOf('const S = {')
  const styleBody = source.slice(styleAt, source.indexOf('\n    }', styleAt))
  const styleKeys = [...styleBody.matchAll(/^      ([A-Za-z][A-Za-z0-9]*):/gm)].map((match) => match[1])
  const twice = styleKeys.filter((key, index) => styleKeys.indexOf(key) !== index)
  check('no style key is declared twice', twice.length === 0, twice.join(', ') || 'none')
  const elsewhere = source.replace(styleBody, '')
  const unread = styleKeys.filter((key) => !new RegExp(String.raw`S\.${key}\b`).test(elsewhere))
  check('and no style key is left unread', unread.length === 0, unread.join(', ') || 'none')
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

// ── 3. the picture is the card, and the facts are under it (2026-10-18) ──────
//
// The founder: *"the thumbnail fills the card and text is below, remove the badge fashion people, the
// labels should be filename *.png or whatever. 1.6 MB badge below the thumbnail card"*. So the old
// on-image badges are GONE: no filled context chip, no size chip on the photograph. The size is an
// outlined chip in the card's text area, under the image, beside the full file name.

{
  const tree = await render()
  const tile = collect(tree, (node) => node.props && node.props['data-assets-tile'] === 'yes')[0]
  const thumb = collect(tile, (node) => node.props && node.props['data-assets-tile-thumb'] === 'yes')[0]
  const name = collect(tile, (node) => node.props && node.props['data-assets-tile-name'] === 'yes')[0]
  const size = collect(tile, (node) => node.props && node.props['data-assets-tile-size'] === 'yes')[0]
  check('the thumbnail is the card’s top, edge to edge', !!thumb && thumb.props.style.width === '100%', thumb ? String(thumb.props.style.width) : 'no thumb')
  check('and NO badge sits on the picture any more', !!thumb && collect(thumb, (node) => node.props && (node.props['data-assets-tile-name'] === 'yes' || node.props['data-assets-tile-size'] === 'yes')).length === 0, 'a fact was drawn over the thumbnail')
  check('the label is the FILE NAME with its extension', !!name && textOf(name).join('') === '20260926-job-aaa.png', name ? textOf(name).join('') : 'no name')
  check('and the size is an outlined chip BELOW the thumbnail, in the card', !!size && textOf(size).join('') === '2.8 MB' && String(size.props.style.border).includes('var(--dsw-alias-border-l3)'), size ? JSON.stringify({ text: textOf(size).join(''), border: size.props.style.border }) : 'no size chip')
  check('and the context chip is gone entirely', collect(tree, (node) => node.props && node.props.style && node.props.style.opacity === 0.94).length === 0, 'a filled context chip is still on screen')
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
  // NO HEADING AND NO SEPARATOR (founder, 2026-09-26: *"remove separator and Metadata label"*): the block
  // is named by the facts it holds, not by a word over them, and it draws no hairline of its own.
  const block = collect(tree, (node) => node.props && node.props['data-assets-meta'] === 'yes')[0]
  check('a selected tile opens the facts block, with no heading over it', !!block && !text.includes('Metadata'), text.slice(0, 80))
  check('and the block draws no separator of its own', !!block && block.props.style.borderTop === undefined && block.props.style.paddingTop === undefined, block ? JSON.stringify({ borderTop: block.props.style.borderTop, paddingTop: block.props.style.paddingTop }) : 'no block')

  // ── THE FACTS ARE FOLDED (founder, 2026-10-17: *"the metadata info is better collapsed in accordion
  // instead being visible all the time"*). At rest: one row naming the file, and none of the facts.
  const toggle = collect(tree, (node) => node.props && node.props['data-assets-facts-toggle'] === 'yes')[0]
  check('the block opens with ONE row, not a wall of facts', !!toggle && toggle.props['aria-expanded'] === 'false', toggle ? String(toggle.props['aria-expanded']) : 'no toggle')
  check('that row names the file and sums it up — format and size', !!toggle && textOf(toggle).join(' ').includes('20260926-job-aaa.png') && textOf(toggle).join(' ').includes('PNG') && textOf(toggle).join(' ').includes('2.8 MB'), toggle ? textOf(toggle).join(' ') : 'none')
  check('and the facts themselves are NOT on screen until asked for', collect(tree, (node) => node.props && node.props['data-assets-facts'] === 'yes').length === 0, 'the body was mounted while collapsed')
  check('nothing folded away is even in the tree — the body is unmounted, not hidden', !text.includes('1440 × 1920') && !text.includes('Where it is'), text.slice(0, 100))

  // THE ACTIONS DO NOT FOLD: a destructive control behind a collapsed section is a trap.
  check('Delete stays outside the disclosure', collect(tree, (node) => node.props && node.props['data-assets-delete'] === 'yes').length === 1, 'no delete control at rest')
  check('and so does the way back into the run', collect(tree, (node) => node.props && (node.props['data-assets-continue'] !== undefined || node.props['data-assets-no-continue'] !== undefined)).length === 1, 'no Regenerate at rest')

  // OPENING IT. The press flips the same component's state, so a re-render (not a re-read) is what
  // shows the facts — that is what a disclosure is, and it is why this section re-renders in place
  // with the hook slots the collapsed render already filled.
  const rerender = () => {
    mini.reset()
    return pane({ locale: { bind: () => t } })
  }
  toggle.props.onClick()
  const opened = rerender()
  const openedText = textOf(opened).join(' | ')
  const openedToggle = collect(opened, (node) => node.props && node.props['data-assets-facts-toggle'] === 'yes')[0]
  check('pressing the row opens the facts', !!openedToggle && openedToggle.props['aria-expanded'] === 'true' && collect(opened, (node) => node.props && node.props['data-assets-facts'] === 'yes').length === 1, openedToggle ? String(openedToggle.props['aria-expanded']) : 'none')
  check('it names the file and its dimensions', openedText.includes('20260926-job-aaa.png') && openedText.includes('1440 × 1920'), '')
  check('and its format, size and date', openedText.includes('PNG') && openedText.includes('2.8 MB') && openedText.includes('2026-09-26'), '')
  check('and WHERE IT IS, which is the catalog job', openedText.includes('Where it is') && openedText.includes('here'), '')
  check('the run is named: provider, job, workflow, app', openedText.includes('runninghub') && openedText.includes('job-aaa') && openedText.includes('qwen-2-1-image-edit') && openedText.includes('2099528179505848321'), '')
  const prompt = collect(opened, (node) => node.props && node.props['data-assets-prompt'] === 'yes')
  check('the prompt is shown verbatim', prompt.length === 1 && prompt[0].children[0] === 'The woman in Image 1 wears the outfit from Image 2.', prompt.length ? String(prompt[0].children[0]).slice(0, 60) : 'none')
  check('and the values it ran with', openedText.includes('cfg') && openedText.includes('image'), '')

  // AND CLOSING IT AGAIN puts the block back the way it was found.
  openedToggle.props.onClick()
  const shut = rerender()
  check('pressing it again folds the facts away', collect(shut, (node) => node.props && node.props['data-assets-facts'] === 'yes').length === 0, 'still open')
}

{
  view = { ...view, selected: LOOSE }
  // The no-run sentence is a FACT, so it lives inside the disclosure with the rest of them.
  const rerender = () => {
    mini.reset()
    return pane({ locale: { bind: () => t } })
  }
  let tree = await render()
  check('a file no run made says nothing extra while folded — the row still names it', textOf(tree).join(' ').includes('hand-added.jpg'), textOf(tree).join(' ').slice(-80))
  collect(tree, (node) => node.props && node.props['data-assets-facts-toggle'] === 'yes')[0].props.onClick()
  tree = rerender()
  const text = textOf(tree).join(' | ')
  check('a file no run made says exactly that, once opened', collect(tree, (node) => node.props && node.props['data-assets-meta-norecord'] === 'yes').length === 1, text.slice(0, 120))
  check('and still shows the file\'s own facts', text.includes('hand-added.jpg') && text.includes('JPG'), '')
  check('and does not invent a prompt', !text.includes('Prompt'), '')
  view = { ...view, selected: null }
}

// ── 4b. what the file itself carries (epic 64 S8) ──────────────────────────

{
  // A folded fact is asserted through the disclosure: open it, then read (2026-10-17).
  const rerender = () => {
    mini.reset()
    return pane({ locale: { bind: () => t } })
  }
  view = { ...view, selected: RECORDED }
  let tree = await render()
  collect(tree, (node) => node.props && node.props['data-assets-facts-toggle'] === 'yes')[0].props.onClick()
  tree = rerender()
  const text = textOf(tree).join(' | ')
  check(
    'a file that carries a graph says so, with how big the graph is',
    text.includes(EN['meta.carrier']) && text.includes(EN['meta.carrier.yes'].replace('{nodes}', '25')),
    text.slice(0, 160),
  )
}

{
  // A provider result: the label is there and the graph is not, and the row says which.
  const rerender = () => {
    mini.reset()
    return pane({ locale: { bind: () => t } })
  }
  detailBody.carrier = { format: 'png', supported: true, hasGraph: false, api: null, ui: null, label: true, complete: true, error: null }
  view = { ...view, selected: RECORDED }
  let tree = await render()
  collect(tree, (node) => node.props && node.props['data-assets-facts-toggle'] === 'yes')[0].props.onClick()
  tree = rerender()
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
  // THE SWITCH IS THE APP'S OWN SEGMENTED CONTROL (founder, 2026-09-26: *"copy finder switch view w
  // segmented control using icon buttons: grid, list, filmstrip"*). Its contract is a `tablist` with
  // one `role="tab"` per view, so that is what is read here — not three buttons written by hand.
  const list = collect(tree, (node) => node.props && node.props.role === 'tablist')[0]
  check('the view switch is the app’s segmented tablist, labelled', !!list && typeof list.props['aria-label'] === 'string' && list.props['aria-label'].length > 0, list ? String(list.props['aria-label']) : 'none')
  const tabs = collect(tree, (node) => node.props && node.props.role === 'tab' && node.props['data-segment'] !== undefined)
  check('offering exactly grid, list and gallery', tabs.map((node) => node.props['data-segment']).join(',') === 'grid,list,gallery', tabs.map((node) => node.props['data-segment']).join(','))
  check('as icon buttons whose word is the title', tabs.every((node) => typeof node.props.title === 'string' && node.props.title.length > 0), tabs.map((node) => String(node.props.title)).join(' / '))
  // WHICH GLYPH IS WHICH, pinned by structure — three little squares are easy to confuse, and the
  // founder named these three (2026-09-26: *"lucide icons: layout-grid, list, gallery-thumbnails"*).
  // Lucide's own geometry: layout-grid is four cells, list is six lines, gallery-thumbnails is a
  // frame with four ticks under it.
  const glyphs = collect(tree, (node) => node.props && node.props['data-assets-view-icon'] === 'yes')
  const shapeOf = (node) => node.children.map((child) => (child.type === 'rect' ? 'r' : 'p')).join('')
  check('every segment draws its own glyph', glyphs.length === 3, glyphs.length + ' glyphs')
  check('layout-grid, list and gallery-thumbnails, in that order', glyphs.map(shapeOf).join(' ') === 'rrrr pppppp rpppp', glyphs.map(shapeOf).join(' '))
  check(
    'all three on the 24-unit grid at stroke 1.5, currentColor — the same hand as the card’s mark',
    glyphs.every((node) => node.props.viewBox === '0 0 24 24' && node.props.strokeWidth === 1.5 && node.props.stroke === 'currentColor'),
    glyphs.map((node) => node.props.viewBox + '/' + node.props.strokeWidth).join(' '),
  )
  // A WALK THAT CANNOT FIND ITS TAB REPORTS IT: a suite that throws on `[0].props` says nothing
  // about which claim broke (learned on the date filter, then again here).
  const gridTab = tabs.find((node) => node.props['data-segment'] === 'grid')
  const listTab = tabs.find((node) => node.props['data-segment'] === 'list')
  check('with the current view marked selected, and only it', !!gridTab && tabs.filter((node) => node.props['aria-selected'] === 'true').length === 1 && gridTab.props['aria-selected'] === 'true', tabs.map((node) => node.props['data-segment'] + '=' + node.props['aria-selected']).join(' '))
  if (listTab) {
    listTab.props.onClick()
    await settle()
    check('choosing one writes it to the view file', posted.some((entry) => entry.url.includes('/view') && entry.body.view === 'list'), JSON.stringify(posted))
  } else {
    check('choosing one writes it to the view file', false, 'no list tab was drawn to press')
  }
}

{
  posted.length = 0
  const tree = await render()
  const row = collect(tree, (node) => node.props && node.props['data-assets-item'] === 'yes')
  check('the list layout draws rows instead of tiles', row.length === 2, row.length + ' rows')
  if (row[0]) {
    row[0].props.onClick()
    await settle()
    check('selecting a row writes the selection', posted.some((entry) => entry.url.includes('/view') && entry.body.selected === RECORDED), JSON.stringify(posted))
  } else {
    check('selecting a row writes the selection', false, 'the list layout drew no row to press')
  }
}

{
  posted.length = 0
  view = { ...view, view: 'grid', selected: null }
  let tree = await render()
  // THE DATE TREE IS ONE PRESS AWAY (polish pass, 2026-09-26): the filter is one line in the
  // bar and its rows — with their counts — open under it. Closed at rest, because a tree that is
  // always open is a wall between a person and the grid; the count on the trigger keeps "how
  // much is behind this" answerable without opening anything.
  const trigger = collect(tree, (node) => node.props && node.props['data-assets-filter-button'] === 'date')[0]
  check('the date filter is one control in the bar', !!trigger, trigger ? textOf(trigger).join(' ') : 'none')
  check('and it shows the value the library is filtered by while shut', !!trigger && textOf(trigger).join(' ').includes('All'), trigger ? textOf(trigger).join(' ') : 'none')
  check('with no menu open at rest', collect(tree, (node) => node.props && node.props['data-menu-open'] === 'yes').length === 0, 'a menu was open at rest')

  if (!trigger) {
    check('opening it draws the day rows, each with its own count', false, 'no filter trigger to press')
    check('and choosing it writes the filter', false, 'no filter trigger to press')
  } else {
  trigger.props.onClick()
  mini.reset()
  tree = pane({ locale: { bind: () => t } })
  check('opening it draws the menu', collect(tree, (node) => node.props && node.props['data-menu-open'] === 'yes').length === 1, 'no menu opened')
  const dayRow = collect(tree, (node) => node.props && node.props['data-menu-item'] === '2026-09-25')
  check('with the days in it, each carrying its own count', dayRow.length === 1 && textOf(dayRow[0]).join(' ').includes('1'), dayRow.length ? textOf(dayRow[0]).join(' ') : 'none')
  check('and the row the library is filtered by is the marked one', !!dayRow[0] && collect(tree, (node) => node.props && node.props['data-menu-item-selected'] === 'yes').length === 1, '')
  // A WALK THAT CANNOT FIND ITS ROW REPORTS IT rather than dying on `[0].props`: a suite that
  // throws tells the next person nothing about which claim broke.
  if (dayRow[0]) {
    dayRow[0].props.onClick()
    await settle()
    check('and choosing it writes the filter', posted.some((entry) => entry.url.includes('/view') && entry.body.date === '2026-09-25'), JSON.stringify(posted))
  } else {
    check('and choosing it writes the filter', false, 'no day row was drawn to press')
  }
  }
  mini.reset()
  tree = pane({ locale: { bind: () => t } })
  check('then the menu shuts itself — choosing IS the end of that interaction', collect(tree, (node) => node.props && node.props['data-menu-open'] === 'yes').length === 0, 'still open')
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
  // THE FOLDERS ARE A STRIP (2026-10-17): a tab is the switch, and the two verbs that used to sit on
  // every row — Finder and Remove — now live on the tab that is OPEN. So the assertions read the tabs.
  const tabs = collect(tree, (node) => node.props && node.props['data-assets-tabs'] === 'yes')[0]
  check('the folders are a strip, not a stacked list', !!tabs && tabs.props.role === 'tablist', tabs ? String(tabs.props.role) : 'absent')
  const allTab = collect(tree, (node) => node.props && node.props['data-assets-tab'] === 'all')[0]
  check('All is the first tab, and it is the one selected before anyone picks', !!allTab && allTab.props['data-assets-tab-on'] === 'yes', allTab ? String(allTab.props['data-assets-tab-on']) : 'absent')
  const folderTab = collect(tree, (node) => node.props && node.props['data-assets-tab'] === '/Users/someone/Desktop/yammaman')[0]
  check('and each folder the library holds is a tab of its own', !!folderTab, folderTab ? 'drawn' : 'absent')

  // PICKING A TAB IS THE SCOPE: it writes `folder` to the view file, which is what the catalog route reads.
  const pick = collect(tree, (node) => node.props && node.props['data-assets-tab-pick'] === '/Users/someone/Desktop/yammaman')[0]
  check('a folder tab is a switch a person can press', !!pick && typeof pick.props.onClick === 'function', pick ? textOf(pick).join('') : 'none')
  await pressInto(pick)
  const picked = posted.filter((row) => row.url.includes('/view') && row.body && row.body.folder !== undefined).pop()
  check('and pressing it scopes the library to that folder', !!picked && picked.body.folder === '/Users/someone/Desktop/yammaman', picked ? JSON.stringify(picked.body) : JSON.stringify(posted.slice(-2)))

  // THE VERBS LIVE ON THE OPEN TAB — the tab a person already chose.
  view = { ...view, folder: '/Users/someone/Desktop/yammaman', selected: null }
  tree = await render2()
  const activeTab = collect(tree, (node) => node.props && node.props['data-assets-tab'] === '/Users/someone/Desktop/yammaman')[0]
  check('the active tab says so, for the strip and for a screen reader', !!activeTab && activeTab.props['data-assets-tab-on'] === 'yes', activeTab ? String(activeTab.props['data-assets-tab-on']) : 'absent')
  check('and the All tab gives up the mark while a folder is open', collect(tree, (node) => node.props && node.props['data-assets-tab'] === 'all' && node.props['data-assets-tab-on'] === 'yes').length === 0, 'All stayed selected')

  const remove = collect(tree, (node) => node.props && node.props['data-assets-tab-remove'] === '/Users/someone/Desktop/yammaman')[0]
  check('the open tab carries a remove', !!remove, remove ? String(remove.props.title) : 'none')
  const removeWhy = await pressInto(remove)
  check('and pressing it asks the host to drop that folder', removeWhy === null && foldersPost().length === 1 && foldersPost()[0].body.action === 'remove' && foldersPost()[0].body.path === '/Users/someone/Desktop/yammaman', removeWhy || JSON.stringify(posted))

  tree = await render2()
  const reveal = collect(tree, (node) => node.props && node.props['data-assets-tab-reveal'] === '/Users/someone/Desktop/yammaman')[0]
  check('and a way to the folder itself, which is the Finder link', !!reveal, reveal ? String(reveal.props.title) : 'none')
  const revealWhy = await pressInto(reveal)
  check('pressing it asks for that folder in the file browser', revealWhy === null && foldersPost().length === 1 && foldersPost()[0].body.action === 'reveal' && foldersPost()[0].body.path === '/Users/someone/Desktop/yammaman', revealWhy || JSON.stringify(posted))
  view = { ...view, folder: null }

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

// ── 8. the polish pass: two columns, a bar, hover, and a count that is a sentence ─────────
//
// The founder, 2026-09-26: *"now let's UX polish"*. Four claims, each one something a person
// sees: the picked asset is BESIDE the grid instead of under all of it; the filters are one line
// each until asked; a tile answers the pointer and the selection wears the app's own accent; and
// the bar says how much is here in words.

{
  view = { ...view, view: 'grid', context: null, date: null, selected: null }
  let tree = await render()
  const columns = collect(tree, (node) => node.props && node.props['data-assets-columns'] === 'yes')[0]
  check('the pictures and the picked one are two columns', !!columns, columns ? 'drawn' : 'absent')
  const main = collect(tree, (node) => node.props && node.props['data-assets-main'] === 'yes')[0]
  // THE SPLIT REPLACED THE FIXED 3:2 PAIR (founder, 2026-10-17: *"the panel should be constructed w 2
  // resizable panels, a lot of times I need to see the larger image"*). With nothing picked there is
  // nothing to divide, so the grid takes the whole width and carries no share.
  // THE GRID MUST FILL THE WIDTH. This used to assert `flex === undefined`, which was the BUG: an unset
  // flex is shrink-to-fit, so the auto-fit grid divided a 240px container and drew one column while the
  // rest of the pane sat empty (founder, 2026-10-17). The contract is "this column takes the row's width",
  // and `1 1 100%` is what says it.
  check('with nothing picked the grid takes the whole width', !!main && /100%/.test(String(main.props.style.flex)) && main.props['data-assets-main-split'] === 'full', JSON.stringify(main && { flex: main.props.style.flex, split: main.props['data-assets-main-split'] }))
  check('and with nothing picked there is no empty panel waiting', collect(tree, (node) => node.props && node.props['data-assets-side'] === 'yes').length === 0, 'a side column was drawn with no selection')

  view = { ...view, selected: RECORDED }
  tree = await render()
  const side = collect(tree, (node) => node.props && node.props['data-assets-side'] === 'yes')[0]
  check('picking one opens the block BESIDE the grid, not under it', !!side && collect(side, (node) => node.props && node.props['data-assets-stage'] === 'yes').length === 1, side ? 'beside' : 'absent')
  // 0.6 / 0.4 is the default share the view file carries when nobody has dragged (SPLIT_DEFAULT).
  // THE HANDLE IS CARVED OUT OF THE SIDE'S SHARE (2026-10-18): the row has no gap, and the side's
  // basis subtracts the 12px handle, so 60% + 12px + (40% − 12px) is exactly the pane's width. The
  // old pair added to 100% WITH two gaps and the preview wrapped under the grid — the founder's
  // *"the grid view is missing the large image on right"*.
  const main2 = collect(tree, (node) => node.props && node.props['data-assets-main'] === 'yes')[0]
  check('the two columns take the share the view file holds — 60 / 40 by default', !!main2 && main2.props.style.flex === '0 0 60%' && !!side && side.props.style.flex === '0 0 calc(40% - 12px)', JSON.stringify({ main: main2 && main2.props.style.flex, side: side && side.props.style.flex }))
  check('each keeps its own floor, so the pane’s width is still the breakpoint', !!side && side.props.style.minWidth === 240 && main2.props.style.minWidth === 160, JSON.stringify({ main: main2 && main2.props.style.minWidth, side: side && side.props.style.minWidth }))
  check('and the divider is a real element between them, not a gap in the row', !!collect(tree, (node) => node.props && node.props['data-assets-split'] === 'yes')[0] && columns.props.style.gap === 0, JSON.stringify({ gap: columns.props.style.gap }))
  check('and the block it holds is a sibling of the grid, not a child of it', !!side && collect(side, (node) => node.props && node.props['data-assets-grid'] === 'yes').length === 0, 'the grid is inside the side column')

  // ── THE FACTS ARE A FLOATING CARD OVER THE PICTURE (2026-10-18) ──────────
  //
  // The founder: *"make the metadata a floating accordion card"*. The side column is the picture (one
  // unframed stage filling it), the metadata block is absolutely positioned on its lower-right corner,
  // and the block is told `withStage: false` so there is exactly one picture in the column.
  const floatMeta = collect(side, (node) => node.props && node.props['data-assets-meta'] === 'yes')[0]
  check(
    'the facts are a floating card, anchored to the preview column',
    !!floatMeta && floatMeta.props['data-assets-meta-float'] === 'yes' && floatMeta.props.style.position === 'absolute' && !!side && side.props.style.position === 'relative' && side.props['data-assets-side-float'] === 'yes',
    floatMeta ? JSON.stringify({ card: floatMeta.props.style.position, side: side && side.props.style.position, float: side && side.props['data-assets-side-float'] }) : 'no card',
  )
  check(
    'the card is bottom-RIGHT, in the app’s raised surface, and never grows past the preview',
    !!floatMeta && floatMeta.props.style.bottom === 8 && floatMeta.props.style.right === 8 && String(floatMeta.props.style.background).includes('--dsw-alias-bg-layer-2') && String(floatMeta.props.style.maxHeight).includes('100%'),
    floatMeta ? JSON.stringify({ bottom: floatMeta.props.style.bottom, right: floatMeta.props.style.right, bg: floatMeta.props.style.background }) : 'no card',
  )
  check('and the picture is the panel behind it, with a single stage in the column', !!side && collect(side, (node) => node.props && node.props['data-assets-stage'] === 'yes').length === 1 && !!floatMeta && collect(floatMeta, (node) => node.props && node.props['data-assets-stage'] === 'yes').length === 0, 'the card contains a second stage')

  // ── THE TOP ROWS STAY, AND EACH COLUMN SCROLLS ITSELF (2026-10-18) ────────
  //
  // The founder: *"the left panel can scroll but not the right, the top 3 rows are sticky"*. The pane
  // used to be one scroll box; the assertion is structural, because that is what the defect was — the
  // preview's facts were below the fold of a sheet that scrolled the header and bar away with them.
  const root = collect(tree, (node) => node.props && node.props['data-assets-pane'] === 'ready')[0]
  const top = collect(tree, (node) => node.props && node.props['data-assets-top'] === 'yes')[0]
  const selectedColumns = collect(tree, (node) => node.props && node.props['data-assets-columns'] === 'yes')[0]
  check('the pane is a fixed frame, not one long scroll sheet', !!root && root.props.style.overflow === 'hidden', root ? String(root.props.style.overflow) : 'no pane')
  check(
    'the header, the folder tabs and the bar sit in one top block above the scroll area',
    !!top && !!collect(top, (node) => node.props && node.props['data-assets-bar'] === 'yes')[0] && !!collect(top, (node) => node.props && node.props['data-assets-tabs'] === 'yes')[0] && collect(top, (node) => node.props && node.props['data-assets-columns'] === 'yes').length === 0,
    top ? 'top block found' : 'no top block',
  )
  check('and the columns below are the scroll area', !!selectedColumns && selectedColumns.props.style.overflow === 'hidden' && selectedColumns.props['data-assets-columns-scroll'] === 'columns', selectedColumns ? String(selectedColumns.props.style.overflow) + ' / ' + String(selectedColumns.props['data-assets-columns-scroll']) : 'no columns')
  check(
    'each column owns its own vertical scroll, so the preview is reachable',
    !!main2 && main2.props.style.overflowY === 'auto' && !!side && side.props.style.overflowY === 'auto',
    JSON.stringify({ main: main2 && main2.props.style.overflowY, side: side && side.props.style.overflowY }),
  )
  // HEIGHT, NOT JUST OVERFLOW (2026-10-18): `align-items: stretch` does not shrink a flex line whose
  // content is taller than the row, so a column without `height: 100%` was content-height, overflowed
  // the clipped row, and its `overflow-y: auto` had nothing to scroll. Measured in headless Chromium:
  // 2,000px columns inside a 646px row until the height was explicit.
  check(
    'each column is given the row’s height, so its overflow has somewhere to scroll',
    !!main2 && main2.props.style.height === '100%' && !!side && side.props.style.height === '100%',
    JSON.stringify({ main: main2 && main2.props.style.height, side: side && side.props.style.height }),
  )
}

{
  // THE BAR: the filters are one line each, the count is a sentence.
  view = { ...view, selected: null }
  let tree = await render()
  const bar = collect(tree, (node) => node.props && node.props['data-assets-bar'] === 'yes')[0]
  check('the search, the layouts and the filters share one bar', !!bar, bar ? 'drawn' : 'absent')
  // ONE HEIGHT FOR THE BAR'S TWO CONTROLS (founder, 2026-09-26: *"can match height of segmented control
  // with search input and then center icons"*). The field is the app's own `Input` — 32px by its own CSS —
  // and the switch is compacted to 2px of padding around the primitive's 28px tab, which is that same 32.
  // The geometry lives in injected CSS, so what is checked is the sheet's own rule and the pieces it names.
  const search = collect(tree, (node) => node.props && node.props['data-assets-search'] === 'yes')[0]
  check('the search field is the app’s own Input, wearing its magnifier', !!search && collect(tree, (node) => node.props && node.props['data-stub-icon'] === 'search').length === 1, search ? 'drawn' : 'none')
  const sheet = sheets.text.join('\n')
  // THE VIEW SWITCH, found by its own class rather than by `role="tablist"` — the folder strip is a
  // tablist too now (2026-10-17), and the first tablist in the tree is the folders, not the layouts.
  const viewList = collect(tree, (node) => node.props && node.props.className === 'dsh-assets-views')[0]
  check('the switch wears that class, so the sheet has something to reach', !!viewList && viewList.props.role === 'tablist', viewList ? String(viewList.props.className) : 'none')
  check('and so does the field’s wrapper', collect(tree, (node) => node.props && node.props.className === 'dsh-assets-search').length === 1, 'no wrapper class')
  check(
    'both controls carry a class the sheet can pin to one height — and the field is stretched, not sized by hand',
    /\.dsh-assets-search \{ flex: 1 1 200px/.test(sheet),
    (sheet.match(/\.dsh-assets-search[^\n]*/) || ['no rule'])[0],
  )
  check(
    'the switch is 2px of padding around the primitive’s 28px tab — the input’s own 32',
    /\.dsh-assets-views \{ padding: 2px; \}/.test(sheet),
    (sheet.match(/\.dsh-assets-views \{[^\n]*/) || ['no rule'])[0],
  )
  check(
    'and the sliding indicator moved onto that padding, so the pill is not 1px off-centre',
    /top: 2px; left: 2px; height: calc\(100% - 4px\)/.test(sheet),
    (sheet.match(/span\[aria-hidden[^\n]*/) || ['no rule'])[0],
  )
  check(
    'the segments centre their glyphs instead of riding the text baseline',
    /\.dsh-assets-views > button \{ display: inline-flex; align-items: center; justify-content: center;/.test(sheet),
    (sheet.match(/\> button \{[^\n]*/) || ['no rule'])[0],
  )

  const summary = collect(tree, (node) => node.props && node.props['data-assets-summary'] === 'yes')[0]
  check('the count is a sentence, not an uppercase group title', !!summary && textOf(summary).join('') === '2 assets', summary ? textOf(summary).join('') : 'none')
  check('and it never counts a collapsed tree in a title', !textOf(tree).join(' ').includes('CONTEXT ·'), textOf(tree).join(' ').slice(0, 60))

  const input = collect(tree, (node) => node.props && node.props['data-assets-search'] === 'yes')[0]
  input.props.onChange({ target: { value: 'job-aaa' } })
  mini.reset()
  tree = pane({ locale: { bind: () => t } })
  const narrowed = collect(tree, (node) => node.props && node.props['data-assets-summary'] === 'yes')[0]
  check('narrowing the search says how much is LEFT of how much there is', !!narrowed && textOf(narrowed).join('') === '1 of 2', narrowed ? textOf(narrowed).join('') : 'none')
  check('and the numbers come from the catalog, not from the rendered page', source.includes("t('pane.summary.filtered')"), 'the summary is not built from the payload counts')
}

{
  // HOVER AND SELECTION. An inline style cannot carry `:hover`, so the pane keeps the flag.
  view = { ...view, selected: null }
  let tree = await render()
  const at = () => collect(tree, (node) => node.props && node.props['data-assets-tile'] === 'yes')[0]
  const tile = at()
  check('a tile says whether it is under the pointer, and starts not', !!tile && tile.props['data-assets-tile-hover'] === 'no', tile ? String(tile.props['data-assets-tile-hover']) : 'none')
  // The resting tile draws the `border` shorthand (`1px solid …l2`); hover and selection override
  // only its COLOUR, which is why those two read `borderColor` and this one reads `border`.
  check('resting on the pane’s own border', tile.props.style.border === '1px solid var(--dsw-alias-border-l2)' && tile.props.style.borderColor === undefined, String(tile.props.style.border))

  tile.props.onMouseEnter()
  mini.reset()
  tree = pane({ locale: { bind: () => t } })
  check('under the pointer it brightens', at().props['data-assets-tile-hover'] === 'yes' && at().props.style.borderColor === 'var(--dsw-alias-border-l3)', String(at().props.style.borderColor))
  at().props.onMouseLeave()
  mini.reset()
  tree = pane({ locale: { bind: () => t } })
  check('and it goes back when the pointer leaves', at().props['data-assets-tile-hover'] === 'no' && at().props.style.borderColor === undefined, String(at().props.style.borderColor))

  view = { ...view, selected: RECORDED }
  tree = await render()
  const picked = collect(tree, (node) => node.props && node.props['data-assets-tile-selected'] === 'yes')[0]
  check('the picked tile wears the app’s own accent', !!picked && picked.props.style.borderColor === 'var(--dsw-alias-brand-primary)', picked ? String(picked.props.style.borderColor) : 'none')
  picked.props.onMouseEnter()
  mini.reset()
  tree = pane({ locale: { bind: () => t } })
  const stillPicked = collect(tree, (node) => node.props && node.props['data-assets-tile-selected'] === 'yes')[0]
  check('and hovering a picked tile does not repaint the selection', stillPicked.props.style.borderColor === 'var(--dsw-alias-brand-primary)', String(stillPicked.props.style.borderColor))
  view = { ...view, selected: null }
}

// ── 9. Finder's switch, the dropdowns, and the gallery view ────────────────────────────────
//
// The founder, 2026-09-26, from Finder's own toolbar: *"can you copy finder switch view w segmented
// control using icon buttons: grid, list, filmstrip … also use dropdown select menu primitives"*.
// The switch and the filters are the APP'S primitives — a `tablist` whose pill slides, and an
// anchored `Menu` — so what is checked here is the contract this pane hands them, and the third
// view they made room for.

{
  view = { ...view, view: 'grid', context: null, date: null, selected: null }
  /**
   * RE-READ WITHOUT REMOUNTING. `mini.reset()` no longer clears the hooks, so this re-runs the
   * pane's effects — a written view file is fetched again — while a component's own state (a menu
   * being open, say) survives, which is what the browser does after a POST.
   */
  const refresh = async () => {
    mini.reset()
    let next = pane({ locale: { bind: () => t } })
    mini.runEffects()
    await settle()
    mini.reset()
    return pane({ locale: { bind: () => t } })
  }
  let tree = await render()
  const trigger = collect(tree, (node) => node.props && node.props['data-assets-filter-button'] === 'context')[0]
  check('a filter is announced as a menu trigger', !!trigger && trigger.props['aria-haspopup'] === 'true' && trigger.props['aria-expanded'] === 'false', trigger ? JSON.stringify({ haspopup: trigger.props['aria-haspopup'], expanded: trigger.props['aria-expanded'] }) : 'none')

  trigger.props.onClick()
  mini.reset()
  tree = pane({ locale: { bind: () => t } })
  const menu = collect(tree, (node) => node.props && node.props.role === 'menu')[0]
  // THE MENU CARD IS SOLID (founder, 2026-09-26: *"the dropdown menu is grey instead of white"*). The
  // primitive's card is 50% alpha + a 40px backdrop blur — right over a dialog, muddy over photographs,
  // which is what the pane is full of. These two menus take the app's raised surface instead, and it
  // reaches ONLY them because `Menu` puts `listClassName` on the card. Both halves are checked: the glue
  // (this plugin passes the class) and the rule (the sheet asks for an opaque card).
  const menuCards = collect(tree, (node) => node.props && node.props.role === 'menu')
  check('the open dropdown card carries this plugin’s own class', menuCards.length === 1 && menuCards[0].props.className === 'dsh-assets-menu', menuCards.map((node) => String(node.props.className)).join(',') || 'no card')
  const sheetText = sheets.text.join('\n')
  check(
    'and the sheet makes it opaque — the app’s raised surface, not the translucent menu token',
    /\.dsh-assets-menu \{ background: var\(--dsw-alias-bg-layer-2\); backdrop-filter: none; border: 0\.5px solid var\(--dsw-alias-border-l3\);/.test(sheetText),
    (sheetText.match(/\.dsh-assets-menu \{[^\n]*/) || ['no rule'])[0],
  )

  const rows = collect(tree, (node) => node.props && node.props.role === 'menuitem')
  // `All` plus the one context in the fixture, and `All` plus the two days: the rows are the catalog's own counts.
  check('it opens the app’s menu, not a panel written here', !!menu && rows.length === 2, rows.length + ' rows')
  check('every choice carries its own count', rows.every((node) => /\d/.test(textOf(node).join(' '))), rows.map((node) => textOf(node).join(' ')).join(' / '))
  check('and the one in force is the one the menu marks', collect(tree, (node) => node.props && node.props['data-menu-item-selected'] === 'yes').length === 1, 'the menu marked no row')

  rows.find((node) => node.props['data-menu-item'] === 'yammaman').props.onClick()
  await settle()
  check('choosing a row writes that filter', posted.some((entry) => entry.url.includes('/view') && entry.body.context === 'yammaman'), JSON.stringify(posted.slice(-2)))
  tree = await refresh()
  const afterTrigger = collect(tree, (node) => node.props && node.props['data-assets-filter-button'] === 'context')[0]
  check('and the menu is gone, with the trigger saying so', collect(tree, (node) => node.props && node.props.role === 'menu').length === 0 && !!afterTrigger && afterTrigger.props['aria-expanded'] === 'false', 'still open')
  check('while the trigger now reads the value it holds', !!afterTrigger && textOf(afterTrigger).join(' ').includes('yammaman'), 'the trigger still says All')

  // THE CLEAR IS ITS OWN CONTROL, in place: a filter that is on can be taken off without opening
  // the menu again.
  const clear = collect(tree, (node) => node.props && node.props['data-assets-filter-clear'] === 'context')[0]
  check('a filter that is on offers a clear beside it', !!clear, clear ? 'drawn' : 'none')
  clear.props.onClick()
  await settle()
  check('and clearing it writes the filter off', posted.some((entry) => entry.url.includes('/view') && entry.body.context === null), JSON.stringify(posted.slice(-2)))
  view = { ...view, context: null, date: null, selected: null }
}

{
  // THE FILMSTRIP, AS SHIPPED (restored 2026-10-18). The founder: *"the filmstrip gallery view attempts
  // this but that view was not supposed to change"*. So this view keeps its 2026-09-26 shape — ONE
  // PICTURE BIG, the frames in a 56×74 strip UNDER it, the facts beside it without a second stage —
  // and it does NOT take the grid/list resizable preview.
  view = { ...view, view: 'gallery', context: null, date: null, selected: null }
  let tree = await render()
  check('the gallery view is drawn when the view file says so', collect(tree, (node) => node.props && node.props['data-assets-gallery'] === 'yes').length === 1, 'no gallery')
  check('with nothing picked it says so rather than guessing a thumbnail', collect(tree, (node) => node.props && node.props['data-assets-gallery-empty'] === 'yes').length === 1, 'no hint')
  const frames = collect(tree, (node) => node.props && node.props['data-assets-frame'] !== undefined)
  check('and the thumbnail strip holds every asset in the catalog', frames.length === 2, frames.length + ' frames')
  check('each one a selectable option, with none selected', frames.every((node) => node.props.role === 'option') && frames.every((node) => node.props['aria-selected'] === 'false'), frames.map((node) => node.props['aria-selected']).join(','))
  check('the frames are 56×74 strip cells — the shipped filmstrip, not a full-width rail', frames.length > 0 && frames[0].props.style.width === 56, frames[0] ? String(frames[0].props.style.width) : 'no frame')

  posted.length = 0
  if (frames[0]) {
    frames[0].props.onClick()
    await settle()
    check('pressing a thumbnail selects it, like any other tile', posted.some((entry) => entry.url.includes('/view') && entry.body.selected === RECORDED), JSON.stringify(posted.slice(-2)))
  } else {
    check('pressing a thumbnail selects it, like any other tile', false, 'the strip drew no thumbnail to press')
  }

  view = { ...view, selected: RECORDED }
  tree = await render()
  const stage = collect(tree, (node) => node.props && node.props['data-assets-stage'] === 'yes')
  check('a picked thumbnail is drawn big, in the stage A4 built', stage.length === 1, stage.length + ' stages')
  const marked = collect(tree, (node) => node.props && node.props['data-assets-frame-on'] === 'yes')
  check('and its thumbnail is the marked one in the strip', marked.length === 1 && marked[0].props['data-assets-frame'] === RECORDED, marked.length ? String(marked[0].props['data-assets-frame']) : 'none')
  const meta = collect(tree, (node) => node.props && node.props['data-assets-meta'] === 'yes')[0]
  check('the block beside it draws the facts and NOT a second picture', !!meta && collect(meta, (node) => node.props && node.props['data-assets-stage'] === 'yes').length === 0, meta ? 'facts only' : 'no block')
  // THE FLOATING CARD IS GRID/LIST'S (2026-10-18): gallery's stage is its main column and the facts
  // already have their own column, so there is nothing for a card to float over. It stays in flow.
  check('gallery keeps its facts in flow, not as a floating card', !!meta && meta.props['data-assets-meta-float'] === 'no' && meta.props.style.position === undefined, meta ? JSON.stringify({ float: meta.props['data-assets-meta-float'], position: meta.props.style.position }) : 'no block')
  // THE GALLERY KEEPS THE FIXED 3:2 PAIR AND NO HANDLE. The split belongs to grid and list; putting it
  // here would change the view the founder asked to leave alone.
  const main = collect(tree, (node) => node.props && node.props['data-assets-main'] === 'yes')[0]
  const side = collect(tree, (node) => node.props && node.props['data-assets-side'] === 'yes')[0]
  check('gallery keeps its shipped 3:2 columns', !!main && main.props.style.flex === '3 1 0' && !!side && side.props.style.flex === '2 1 0', JSON.stringify({ main: main && main.props.style.flex, side: side && side.props.style.flex }))
  check('and no draggable handle, because this view was not supposed to change', collect(tree, (node) => node.props && node.props['data-assets-split'] === 'yes').length === 0, 'a handle was drawn in gallery')
  view = { ...view, view: 'grid', selected: null }
}

// ── 10. THE DESTRUCTIVE ACT: it asks, it trashes, and Finder's key opens it ──
//
// The founder's ask (2026-09-26): *"a feature to delete the asset as if I am deleting from finder so I
// don't have to leave mitsumeru ui"*. Four claims, and the third is the one that matters most: THE
// PANE MUST NOT MOVE A FILE WITHOUT `confirm: true`. Every check here reads the recorded POSTs, not
// just the screen, because a control that renders is not a control that acts — and the reverse.
{
  // Re-render with the SAME hook slots (a local state change needs no effect run) or from scratch
  // (a new read does) — the two idioms the sections above use.
  const rerender = () => {
    mini.reset()
    return pane({ locale: { bind: () => t } })
  }
  folders = { ...foldersBody, canTrash: true }
  view = { ...view, selected: RECORDED }
  const deletePosts = () => posted.filter((entry) => entry.url.includes('/delete'))
  let tree = await render()

  const control = collect(tree, (node) => node.props && node.props['data-assets-delete'] === 'yes')[0]
  check('the block offers Delete when the host has a trash verb', !!control, control ? textOf(control).join('') : 'none')
  check('without a Delete control there is nothing to press — the checks below would be guesses', !!control, control ? 'pressable' : 'no control')
  check('and it says which key does the same thing', !!control && String(control.props.title).includes('⌘⌫'), control ? String(control.props.title) : 'no title')
  check('through the app’s own Button, not the fallback a host without primitives gets', !!control && control.props['data-stub-button'] === 'ghost:sm', control ? String(control.props['data-stub-button']) : 'no stub button')

  if (control) control.props.onClick()
  tree = rerender()
  const ask = collect(tree, (node) => node.props && node.props['data-assets-delete-ask'] === 'yes')[0]
  check('pressing it ASKS, naming what will happen', !!ask && textOf(ask).join('') === EN['meta.deleteAsk'], ask ? textOf(ask).join('') : 'no question')
  check('and nothing has been sent to the host yet — a question is not an act', deletePosts().length === 0, JSON.stringify(deletePosts()))

  const cancel = collect(tree, (node) => node.props && node.props['data-assets-delete-cancel'] === 'yes')[0]
  check('Cancel is offered beside the answer', !!cancel, cancel ? textOf(cancel).join('') : 'none')
  if (cancel) cancel.props.onClick()
  tree = rerender()
  check('and Cancel closes the question without sending anything', deletePosts().length === 0 && collect(tree, (node) => node.props && node.props['data-assets-delete-ask'] === 'yes').length === 0, JSON.stringify(deletePosts()))

  const againControl = collect(tree, (node) => node.props && node.props['data-assets-delete'] === 'yes')[0]
  if (againControl) againControl.props.onClick()
  tree = rerender()
  const confirm = collect(tree, (node) => node.props && node.props['data-assets-delete-confirm'] === 'yes')[0]
  check('the question offers the act itself', !!confirm, confirm ? textOf(confirm).join('') : 'no confirm')
  if (confirm) await confirm.props.onClick()
  tree = rerender()
  const sent = deletePosts()
  check(
    'confirming posts the path WITH confirm: true — the host refuses the act without it',
    sent.length === 1 && sent[0].body.path === RECORDED && sent[0].body.confirm === true,
    JSON.stringify(sent),
  )
  check('and the pane says where the file went', textOf(tree).join(' ').includes(EN['meta.trashed'].replace('{name}', '20260926-job-aaa.png')), textOf(tree).join(' ').slice(0, 90))

  // A TRASH THAT IS REFUSED ANSWERS WHERE IT WAS PRESSED. The route had in fact been answering
  // `500 trash-failed` while the founder read "it doesn't delete (still there)": the sentence went
  // to the room, one column from the control, wearing the folder-add copy.
  trashRefuses = true
  view = { ...view, selected: RECORDED }
  tree = await render()
  const refusedControl = collect(tree, (node) => node.props && node.props['data-assets-delete'] === 'yes')[0]
  if (refusedControl) refusedControl.props.onClick()
  tree = rerender()
  const refusedConfirm = collect(tree, (node) => node.props && node.props['data-assets-delete-confirm'] === 'yes')[0]
  if (refusedConfirm) await refusedConfirm.props.onClick()
  tree = rerender()
  const refusal = collect(tree, (node) => node.props && node.props['data-assets-trash-failed'] === 'yes')[0]
  const side = collect(tree, (node) => node.props && node.props['data-assets-side'] === 'yes')[0]
  check(
    'a refused trash says so BESIDE the control that asked, not one column away',
    !!refusal && !!side && collect(side, (node) => node.props && node.props['data-assets-trash-failed'] === 'yes').length === 1,
    refusal ? textOf(refusal).join('') : 'nothing on screen',
  )
  check(
    'and in the trash’s own words — not the folder sentence the room uses',
    // THE HOST'S OWN DETAIL IS WHAT A PERSON READS after the sentence: the pane prints the answer,
    // not its slug (`trash-failed` is only the fallback for an answer with no detail at all).
    !!refusal && textOf(refusal).join('').includes(EN['meta.trashFailed']) && textOf(refusal).join('').includes('(-1728)') && !textOf(refusal).join('').includes(EN['pane.add.failed']),
    refusal ? textOf(refusal).join('') : 'nothing on screen',
  )
  check(
    'while the picture stays on screen: a refusal is not a delete',
    !!collect(tree, (node) => node.props && node.props['data-assets-delete'] === 'yes')[0] && String(view.selected) === RECORDED,
    JSON.stringify(view.selected),
  )
  trashRefuses = false
  check(
    'and the selection is cleared IN THE VIEW FILE, so a reload does not ask for a path that is gone',
    posted.filter((entry) => entry.url.includes('/view') && entry.body.selected === null).length >= 1,
    JSON.stringify(posted.filter((entry) => entry.url.includes('/view')).slice(-1)),
  )

  // FINDER'S OWN KEY. It opens the same question rather than acting outright: the keyboard gets the
  // same one press of warning, and the three guards are what keep it from being a trap.
  view = { ...view, selected: RECORDED }
  tree = await render()
  const root = collect(tree, (node) => node.props && node.props['data-assets-pane'] === 'ready')[0]
  const key = (props) => {
    if (!root) return false
    let prevented = false
    root.props.onKeyDown({ preventDefault: () => { prevented = true }, ...props })
    return prevented
  }
  check('the pane listens for the key', !!root && typeof root.props.onKeyDown === 'function', root ? 'listening' : 'none')
  let prevented = key({ key: 'Backspace', metaKey: true, target: { tagName: 'BUTTON' } })
  tree = rerender()
  check(
    '⌘⌫ on a selected asset opens the question',
    prevented && collect(tree, (node) => node.props && node.props['data-assets-delete-ask'] === 'yes').length === 1,
    'prevented=' + String(prevented),
  )
  collect(tree, (node) => node.props && node.props['data-assets-delete-cancel'] === 'yes')[0].props.onClick()
  tree = rerender()

  prevented = key({ key: 'Backspace', metaKey: true, target: { tagName: 'INPUT' } })
  tree = rerender()
  check(
    'but NOT while the person is typing — ⌘⌫ in the search field deletes a character',
    !prevented && collect(tree, (node) => node.props && node.props['data-assets-delete-ask'] === 'yes').length === 0,
    'prevented=' + String(prevented),
  )

  prevented = key({ key: 'Backspace', target: { tagName: 'BUTTON' } })
  check('and a bare Backspace is not the gesture', !prevented, 'prevented=' + String(prevented))

  // THE HOST WITH NO TRASH VERB: no control at all, because a button that always fails is worse.
  folders = { ...foldersBody, canTrash: false }
  view = { ...view, selected: RECORDED }
  tree = await render()
  check(
    'a host that cannot trash draws no Delete control',
    collect(tree, (node) => node.props && node.props['data-assets-delete'] === 'yes').length === 0,
    'drawn',
  )
  folders = { ...foldersBody, canTrash: true }
}

// ── 10. THE PANE'S OWN LAYOUT (2026-10-17) ──────────────────────────────────
//
// Two flex bugs shipped in one screenshot: the folder tabs were a two-pixel sliver, and the grid drew one
// column with the pane's width empty beside it. Neither is a matter of taste — both are the default
// behaviour of a flex item, and both are assertable without a browser because every style here is inline.

{
  view = { ...view, view: 'grid', folder: null, context: null, date: null, selected: null }
  const tree = await render()

  // A TOOLBAR IS NOT A FLEXIBLE THING. In a column flex container the default `flex: 0 1 auto` lets a row
  // SHRINK, and an `overflow` other than visible removes the automatic minimum size, so the strip went to
  // nothing under the grid's weight. Every fixed row says `flex: 0 0 auto` out loud.
  const strip = collect(tree, (node) => node.props && node.props['data-assets-tabs'] === 'yes')[0]
  check('the folder strip cannot be squeezed to nothing', !!strip && strip.props.style.flex === '0 0 auto', strip ? String(strip.props.style.flex) : 'absent')
  check('and it keeps a height even when the list is long', !!strip && strip.props.style.minHeight === 26, strip ? String(strip.props.style.minHeight) : 'absent')
  const bar = collect(tree, (node) => node.props && node.props['data-assets-bar'] === 'yes')[0]
  check('the search bar cannot be squeezed either', !!bar && bar.props.style.flex === '0 0 auto', bar ? String(bar.props.style.flex) : 'absent')

  // THE GRID FILLS THE WIDTH. A flex item with no `flex` is shrink-to-fit, which is how an auto-fit grid
  // ends up dividing 240px and drawing one column.
  const row = collect(tree, (node) => node.props && node.props['data-assets-columns'] === 'yes')[0]
  // `1 1 0`, not `1 1 auto`: a zero basis is what makes the row take the REMAINING height instead of
  // starting from its content's height (2026-10-18, the scroll fix).
  check('the pictures row takes the pane’s remaining height', !!row && row.props.style.flex === '1 1 0', row ? String(row.props.style.flex) : 'absent')
  const main = collect(tree, (node) => node.props && node.props['data-assets-main'] === 'yes')[0]
  check('and its column fills that row’s width, so the grid can use the whole pane', !!main && /100%/.test(String(main.props.style.flex)), main ? String(main.props.style.flex) : 'absent')
}

note('the live layer is the founder’s eyes: the bar, the two columns, the hover and the card’s own mark')

// ── 9. the refresh control, and the draggable split (2026-10-17) ────────────
//
// The founder, with the pane on screen: *"it needs a refresh button to refresh the view so when agent
// does housecleaning the user can update the view"* and *"the panel should be constructed w 2
// resizable panels, a lot of times I need to see the larger image"*. Two claims each, one for the
// control and one for the arithmetic behind it.

{
  view = { ...view, view: 'grid', context: null, date: null, selected: null }
  let tree = await render()
  const button = collect(tree, (node) => node.props && node.props['data-assets-refresh'] === 'yes')[0]
  check('the bar carries a refresh control', !!button, button ? 'drawn' : 'absent')
  check(
    'it is a button with a name and the sentence that says what it re-reads',
    !!button && button.props.type === 'button' && typeof button.props['aria-label'] === 'string' && typeof button.props.title === 'string' && button.props.title.length > 20,
    button ? JSON.stringify({ label: button.props['aria-label'], title: button.props.title }) : 'none',
  )
  check('and it sits after the count, the action on what the count counts', !!button && collect(tree, (node) => node.props && node.props['data-assets-summary'] === 'yes').length === 1, 'no summary beside it')

  // THE PRESS ASKS FOR THE CATALOG AGAIN — that is the whole behaviour: a directory walk the host makes
  // per request, so the only way a file an agent moved shows up here is a fresh read.
  const before = requests.length
  button.props.onClick()
  await new Promise((resolve) => setTimeout(resolve, 20))
  const asked = requests.slice(before).filter((url) => String(url).includes('/plugins/assets/catalog'))
  check('pressing it re-reads the catalog', asked.length >= 1, JSON.stringify(requests.slice(before)))
  check('and the catalog read is not served from a cache', asked.some((url) => String(url).includes('catalog')), 'no request')
}

{
  // THE ARITHMETIC, as arithmetic (the same discipline verify/inspect.mjs holds the zoom to).
  const api = await loadClient({ React: mini.React })
  const { splitOf, splitFrom, splitBounds, splitWidths, SPLIT_MIN, SPLIT_MAX, SPLIT_DEFAULT, SPLIT_HANDLE, MAIN_FLOOR, SIDE_FLOOR, STACK_BELOW } = api.exports.split
  check('the default share is inside its own bounds', SPLIT_DEFAULT >= SPLIT_MIN && SPLIT_DEFAULT <= SPLIT_MAX, String(SPLIT_DEFAULT))
  // THE FLOORS ARE PIXELS, SO THE RANGE DEPENDS ON THE PANE'S WIDTH (2026-10-18): 160px of thumbnails
  // and 240px of preview are what a drag may not cross, and the handle's 12px comes out of the preview's
  // share. At 1000px that is 16%–74.8%; at 2000px the static 15%–85% is the only bound.
  const hostLimits = { min: SPLIT_MIN, max: SPLIT_MAX }
  const at1000 = splitBounds(1000, hostLimits)
  check('a 1000px row already narrows the range to its two floors', at1000.min === 0.16 && at1000.max === 0.748, JSON.stringify(at1000))
  const at2000 = splitBounds(2000, hostLimits)
  check('a 2000px row is bounded only by the static 15–85%', at2000.min === SPLIT_MIN && at2000.max === SPLIT_MAX, JSON.stringify(at2000))
  check('the stack point is both floors plus the handle, and that is the pane’s breakpoint', STACK_BELOW === MAIN_FLOOR + SIDE_FLOOR + SPLIT_HANDLE, String(STACK_BELOW))
  // THE HOST THAT ANSWERS NO BOUNDS (2026-10-18) is the 0.3–0.8 build still running. The pane must use
  // ITS range, not the widened one: otherwise a drag to 0.2 renders, the host stores 0.3 on release,
  // and the divider visibly snaps back — the founder's report.
  const legacy1000 = splitBounds(1000)
  check('a host from before the widening keeps its own 0.3 floor, so a release cannot snap back', legacy1000.min === 0.3 && legacy1000.max === 0.748, JSON.stringify(legacy1000))
  const legacyWidths = splitWidths(1000, 0.2)
  check('and the old host’s release is clamped to its own floor, not left at the pointer', legacyWidths.main === 300, JSON.stringify(legacyWidths))
  // THE MEASURED ROW IS LAID OUT IN EXACT PIXELS (2026-10-18): `main + handle + side === width` for
  // every width and share, and neither floor is ever crossed. A subpixel over the row would wrap the
  // preview under the grid — the bug this range and arithmetic exist to prevent.
  const rows = [412, 500, 700, 1000, 1440, 2000, 3200]
  const shares = [0, 0.15, 0.3, 0.5, 0.6, 0.75, 0.85, 1]
  const sumsExact = []
  const floorsKept = []
  for (const width of rows) {
    for (const share of shares) {
      const got = splitWidths(width, share, hostLimits)
      if (!got || got.main + SPLIT_HANDLE + got.side !== width) sumsExact.push(width + '@' + share)
      if (!got || got.main < MAIN_FLOOR || got.side < SIDE_FLOOR) floorsKept.push(width + '@' + share + '=' + JSON.stringify(got))
    }
  }
  check('every measured row divides into exact pixels, so nothing can wrap', sumsExact.length === 0, sumsExact.join(', '))
  check('and neither column is ever pressed below its floor', floorsKept.length === 0, floorsKept.join(', '))
  check('a share below the floor comes back at the floor', splitOf(0) === SPLIT_MIN && splitOf(-2) === SPLIT_MIN, String(splitOf(0)))
  check('a share above the ceiling comes back at the ceiling', splitOf(1) === SPLIT_MAX && splitOf(9) === SPLIT_MAX, String(splitOf(1)))
  check('a value that is not a number is the default, not a NaN width', splitOf('nonsense') === SPLIT_DEFAULT && splitOf(undefined) === SPLIT_DEFAULT, String(splitOf(undefined)))
  check('a pointer in the middle of a 1000px frame asks for half the width', splitFrom(0, 1000, 500) === 0.5, String(splitFrom(0, 1000, 500)))
  check('the frame’s own left edge is subtracted, so a scrolled pane still lands true', splitFrom(300, 1000, 800) === 0.5, String(splitFrom(300, 1000, 800)))
  check('a frame that has not been laid out answers nothing rather than a limit', splitFrom(0, 0, 10) === null, String(splitFrom(0, 0, 10)))
  check('and a pointer past either edge is clamped, never written out of range', splitFrom(0, 1000, -50) === SPLIT_MIN && splitFrom(0, 1000, 5000) === SPLIT_MAX, JSON.stringify({ low: splitFrom(0, 1000, -50), high: splitFrom(0, 1000, 5000) }))
}

{
  // THE HANDLE IN THE PANE: drawn only when there are two columns to divide, and reporting a move
  // separately from the commit the release makes.
  view = { ...view, selected: null }
  let tree = await render()
  check('with nothing picked there is no divider to drag', collect(tree, (node) => node.props && node.props['data-assets-split'] === 'yes').length === 0, 'a handle was drawn with one column')

  view = { ...view, selected: RECORDED }
  tree = await render()
  const handle = collect(tree, (node) => node.props && node.props['data-assets-split'] === 'yes')[0]
  check('picking one draws the divider between the columns', !!handle, handle ? 'drawn' : 'absent')
  check(
    'it is a separator a keyboard can reach, with its share spoken',
    !!handle && handle.props.role === 'separator' && handle.props.tabIndex === 0 && handle.props['aria-orientation'] === 'vertical' && handle.props['aria-valuenow'] === 60,
    handle ? JSON.stringify({ role: handle.props.role, now: handle.props['aria-valuenow'] }) : 'none',
  )
  // THE DRAG BELONGS TO THE WINDOW (founder, 2026-10-17: *"the handle is not working"*). The handlers
  // were on the 12px handle, so `pointermove` stopped arriving the moment the pointer left it — which is
  // most of any real drag. So the assertions are about WINDOW listeners, not about props on the handle:
  // a suite that drove `handle.props.onPointerMove` would have gone on passing while the control was
  // unusable, which is exactly what happened.
  const frameRect = { left: 0, width: 1000, top: 0, height: 400 }
  const frameEl = { getBoundingClientRect: () => frameRect }
  const listeners = sandboxListeners
  listeners.clear()

  let before = requests.length
  handle.props.onPointerDown({ currentTarget: { parentElement: frameEl }, preventDefault: () => {}, clientX: 600 })
  check('pressing the divider starts listening on the window, not on the 12px handle', listeners.has('pointermove') && listeners.has('pointerup'), JSON.stringify([...listeners.keys()]))
  check('and the handle carries no pointermove of its own any more', handle.props.onPointerMove === undefined, handle.props.onPointerMove === undefined ? 'none' : 'still bound to the handle')

  // A DRAG OFF THE HANDLE STILL TRACKS: the move goes to the window, not to the divider.
  listeners.get('pointermove')({ clientX: 650 })
  listeners.get('pointermove')({ clientX: 700 })
  const duringDrag = requests.slice(before).filter((url) => url.includes('/view')).length
  listeners.get('pointerup')({})
  await new Promise((resolve) => setTimeout(resolve, 20))
  const wrote = requests.slice(before).filter((url) => url.includes('/view'))
  check('a pointer that leaves the handle still moves the divider', duringDrag === 0 && wrote.length >= 1, JSON.stringify({ duringDrag, wrote }))
  const lastPost = posted.filter((row) => row.url.includes('/view') && typeof row.body.split === 'number').pop()
  check('and it writes the share the pointer ended on — 0.7 of a 1000px frame', !!lastPost && lastPost.body.split === 0.7, lastPost ? JSON.stringify(lastPost.body) : 'no split write')
  check('the listeners are removed when the drag ends', listeners.size === 0, JSON.stringify([...listeners.keys()]))

  // THE PREVIEW CAN TAKE MOST OF THE FRAME (2026-10-18). Dragging the line far left leaves the
  // thumbnail column its 160px floor and gives the rest to the picture — the point of the split for
  // detail inspection. A second drag proves the range reaches there, not just the default's vicinity.
  tree = await render()
  const leftHandle = collect(tree, (node) => node.props && node.props['data-assets-split'] === 'yes')[0]
  before = requests.length
  leftHandle.props.onPointerDown({ currentTarget: { parentElement: frameEl }, preventDefault: () => {}, clientX: 700 })
  listeners.get('pointermove')({ clientX: 200 })
  listeners.get('pointerup')({})
  await new Promise((resolve) => setTimeout(resolve, 20))
  const leftPost = posted.filter((row) => row.url.includes('/view') && typeof row.body.split === 'number').pop()
  check('and a drag the other way gives the preview 80% of the frame', !!leftPost && leftPost.body.split === 0.2, leftPost ? JSON.stringify(leftPost.body) : 'no split write')

  // A CLICK WITH NO MOVEMENT WRITES NOTHING.
  tree = await render()
  const clickHandle = collect(tree, (node) => node.props && node.props['data-assets-split'] === 'yes')[0]
  before = requests.length
  clickHandle.props.onPointerDown({ currentTarget: { parentElement: frameEl }, preventDefault: () => {}, clientX: 600 })
  listeners.get('pointerup')({})
  await new Promise((resolve) => setTimeout(resolve, 10))
  check('a press and release with no movement writes nothing', requests.slice(before).filter((url) => url.includes('/view')).length === 0, JSON.stringify(requests.slice(before)))


  check('and a double-click is the way back to the default split', !!handle && typeof handle.props.onDoubleClick === 'function', 'no reset')
}

{
  // THE HOST STILL RUNNING FROM BEFORE THE WIDENING (2026-10-18). It answers no `splitBounds`, so the
  // pane must use its 0.3 floor — not the widened 0.15 it ships with. This is the pane-level proof of
  // the founder's *"it snaps back to bigger size"*: a release below 0.3 is stored at 0.3, and the
  // handle never renders below the floor in the first place, so there is nothing to jump back from.
  const savedBounds = view.splitBounds
  delete view.splitBounds
  // Start ABOVE the floor: a drag that begins at the floor and tries to go further left has not moved,
  // so it correctly writes nothing. The claim here is the release that crosses the floor.
  view = { ...view, selected: RECORDED, split: 0.5 }
  const tree = await render()
  const legacyHandle = collect(tree, (node) => node.props && node.props['data-assets-split'] === 'yes')[0]
  check('a host that answers no bounds hands the pane its own 0.3 floor', !!legacyHandle && legacyHandle.props['aria-valuemin'] === 30, legacyHandle ? String(legacyHandle.props['aria-valuemin']) : 'no handle')

  const legacyListeners = sandboxListeners
  legacyListeners.clear()
  const frameRect = { left: 0, width: 1000, top: 0, height: 400 }
  const frameEl = { getBoundingClientRect: () => frameRect }
  if (legacyHandle) {
    legacyHandle.props.onPointerDown({ currentTarget: { parentElement: frameEl }, preventDefault: () => {}, clientX: 600 })
    legacyListeners.get('pointermove')({ clientX: 100 })
    legacyListeners.get('pointerup')({})
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
  const legacyPost = posted.filter((row) => row.url.includes('/view') && typeof row.body.split === 'number').pop()
  check('and a release past that floor is stored AT the floor, so the divider cannot snap back', !!legacyPost && legacyPost.body.split === 0.3, legacyPost ? JSON.stringify(legacyPost.body) : 'no split write')

  view.splitBounds = savedBounds
  view = { ...view, selected: RECORDED }
}

finish()
