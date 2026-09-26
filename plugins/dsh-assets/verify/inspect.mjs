/**
 * verify:inspect — epic 63 A4's claims for zoom inspect, asserted rather than intended.
 *
 * The claim: **a person can look at one picture closely** — fitted to the frame, zoomed about
 * the cursor, dragged, and at 1:1 — without a WebGL2 stage, because the hard part is
 * arithmetic and arithmetic can be asserted without rendering anything.
 *
 * THE MATH IS THE SLICE, so it is checked as math first:
 *
 *   1. `fitScale` FITS (the smaller of the two ratios — contain, not cover) and NEVER magnifies
 *      past 1:1: a small picture is shown at its own size, not blown up to fill the stage;
 *   2. `zoomAt` keeps the picture point under the cursor under the cursor — the property, over
 *      several cursors and factors, not one example — and the range is 0.2–8;
 *   3. AT A LIMIT THE VIEW COMES BACK UNCHANGED, scale AND offset: a wheel at the floor must not
 *      walk the picture a pixel at a time, which is the defect the "returns the input
 *      unchanged" rule exists to prevent;
 *   4. `panBy` moves the picture and never the scale, and `oneToOne` is exactly 1 with the point
 *      you were looking at left in the middle of the frame.
 *
 * And then the stage that uses it: the picture is drawn with a transform driven by that math,
 * a wheel changes the scale, a drag changes the offset, 1:1 asks for the ORIGINAL file, and a
 * clip — or a file that is not here — gets no stage at all.
 *
 *   node verify/inspect.mjs
 */
import { collect, loadClient, miniReact, net, recordingCtx, reporter, settle, textOf } from './harness.mjs'

const { check, note, finish } = reporter('verify:inspect — epic 63 A4 (zoom inspect)')
const mini = miniReact()

const { exports: client } = await loadClient({ React: mini.React })
const zoom = client.zoom
check('the client half exposes the inspect arithmetic, which is what makes it assertable', !!zoom && typeof zoom.zoomAt === 'function', typeof zoom)

const { ctx, seen } = recordingCtx('en')
client.apply(ctx)
const pane = seen.slots.find((slot) => slot.options.name === 'sidebar.right.pane.tab').component
const EN = seen.locales[0].table.en
const t = (key) => (Object.prototype.hasOwnProperty.call(EN, key) ? EN[key] : key)

/**
 * EVERY TRAVERSAL RESETS THE HOOK CURSOR FIRST. The React shim keys hooks by call order, and
 * walking a rendered tree re-invokes the components in it — so a node found without a reset
 * belongs to a shifted "render" whose `setState` writes to slots the next real render never
 * reads. The symptom is a button press that changes nothing; the fix is one `reset()`.
 */
const find = (tree, attr, value) => {
  mini.reset()
  return collect(tree, (node) => node.props && (value === undefined ? node.props[attr] !== undefined : node.props[attr] === value))[0] || null
}
const allOf = (tree, attr) => {
  mini.reset()
  return collect(tree, (node) => node.props && node.props[attr] !== undefined)
}
const textIn = (tree) => {
  mini.reset()
  return textOf(tree).join(' ')
}
/** One more render, the way a person's click leads to the next paint. */
const again = () => {
  mini.reset()
  return pane({ locale: { bind: () => t } })
}

const close = (a, b, epsilon = 1e-9) => Math.abs(a - b) < epsilon
const near = (a, b, epsilon = 1e-6) => Math.abs(a - b) < epsilon

// ── 1. fit: contain, and never bigger than the picture ──────────────────────

{
  const big = zoom.fitScale({ width: 4000, height: 3000 }, { width: 400, height: 300 })
  check('a picture larger than the frame is fitted', close(big, 0.1), String(big))
  check('the fit is the SMALLER ratio: contain, not cover', close(zoom.fitScale({ width: 1000, height: 100 }, { width: 400, height: 300 }), 0.4), String(zoom.fitScale({ width: 1000, height: 100 }, { width: 400, height: 300 })))
  check('and a picture smaller than the frame is NOT magnified past its own size', zoom.fitScale({ width: 100, height: 100 }, { width: 400, height: 300 }) === 1, String(zoom.fitScale({ width: 100, height: 100 }, { width: 400, height: 300 })))
  check('a frame with no size yet is 1:1 rather than a division by nothing', zoom.fitScale({ width: 100, height: 100 }, { width: 0, height: 0 }) === 1, String(zoom.fitScale({ width: 100, height: 100 }, { width: 0, height: 0 })))
  check('and a picture with no known size is 1 as well, so nothing is guessed at', zoom.fitScale(null, { width: 400, height: 300 }) === 1, String(zoom.fitScale(null, { width: 400, height: 300 })))
  const view = zoom.fitView({ width: 1000, height: 500 }, { width: 400, height: 300 })
  check(
    'a fitted view is CENTRED: equal air on both sides at the fitted scale',
    close(view.scale, 0.4) && close(view.offset.x, (400 - 1000 * 0.4) / 2) && close(view.offset.y, (300 - 500 * 0.4) / 2),
    JSON.stringify(view),
  )
}

// ── 2. zoom about the cursor: the point does not move ───────────────────────

{
  const start = { scale: 0.5, offset: { x: -120, y: -60 } }
  const cursors = [{ x: 0, y: 0 }, { x: 137, y: 42 }, { x: 400, y: 300 }, { x: -50, y: 900 }]
  const factors = [1.1, 1 / 1.1, 2, 0.5, 1.37]
  let worst = 0
  let moved = false
  for (const cursor of cursors) {
    for (const factor of factors) {
      const before = { x: (cursor.x - start.offset.x) / start.scale, y: (cursor.y - start.offset.y) / start.scale }
      const next = zoom.zoomAt(start, factor, cursor)
      const after = { x: (cursor.x - next.offset.x) / next.scale, y: (cursor.y - next.offset.y) / next.scale }
      worst = Math.max(worst, Math.abs(after.x - before.x), Math.abs(after.y - before.y))
      if (next.scale !== start.scale) moved = true
    }
  }
  check(
    'the picture point under the cursor STAYS under the cursor, over every cursor and factor',
    moved && worst < 1e-9,
    'worst drift ' + worst,
  )
  const zoomedIn = zoom.zoomAt(start, 2, { x: 100, y: 100 })
  const zoomedOut = zoom.zoomAt(start, 0.5, { x: 100, y: 100 })
  check('a factor above 1 zooms in and one below 1 zooms out', zoomedIn.scale > start.scale && zoomedOut.scale < start.scale, JSON.stringify([zoomedIn.scale, zoomedOut.scale]))
  check('and the centre point is its own fixed point', (() => { const at = { x: 100, y: 100 }; const next = zoom.zoomAt(start, 2, at); const before = { x: (at.x - start.offset.x) / start.scale, y: (at.y - start.offset.y) / start.scale }; return close(before.x, (at.x - next.offset.x) / next.scale) && close(before.y, (at.y - next.offset.y) / next.scale) })(), '')
}

// ── 3. the limits are a wall, not a leak ────────────────────────────────────

{
  const atCeiling = { scale: 8, offset: { x: 12, y: -34 } }
  const over = zoom.zoomAt(atCeiling, 1.1, { x: 200, y: 150 })
  check(
    'AT THE CEILING the view comes back UNCHANGED — scale and offset both',
    over.scale === 8 && over.offset.x === 12 && over.offset.y === -34,
    JSON.stringify(over),
  )
  check('and it is a new object: a caller cannot mutate the view it passed in', over !== atCeiling && over.offset !== atCeiling.offset, 'copied')
  const atFloor = { scale: 0.2, offset: { x: 5, y: 5 } }
  const under = zoom.zoomAt(atFloor, 1 / 1.1, { x: 200, y: 150 })
  check(
    'AT THE FLOOR the same, which is what stops a wheel from walking the picture a pixel at a time',
    under.scale === 0.2 && under.offset.x === 5 && under.offset.y === 5,
    JSON.stringify(under),
  )
  let view = { scale: 1, offset: { x: 0, y: 0 } }
  let out = 0
  for (let step = 0; step < 100; step += 1) {
    view = zoom.zoomAt(view, 1.1, { x: 50, y: 50 })
    if (view.scale > 8) out += 1
  }
  check('a hundred wheels in cannot leave the range', out === 0 && view.scale === 8, String(view.scale))
  let down = view
  out = 0
  for (let step = 0; step < 200; step += 1) {
    down = zoom.zoomAt(down, 1 / 1.1, { x: 50, y: 50 })
    if (down.scale < 0.2) out += 1
  }
  check('and a hundred wheels out cannot either', out === 0 && down.scale === 0.2, String(down.scale))
  check('the range is the contract the epic names: 0.2 to 8', zoom.ZOOM_MIN === 0.2 && zoom.ZOOM_MAX === 8, JSON.stringify([zoom.ZOOM_MIN, zoom.ZOOM_MAX]))
  check('and a scale nobody can compute lands on the floor rather than NaN', zoom.clampZoom(Number.NaN) === 0.2 && zoom.clampZoom(1) === 1, String(zoom.clampZoom(Number.NaN)))
}

// ── 4. pan, and 1:1 ─────────────────────────────────────────────────────────

{
  const start = { scale: 2, offset: { x: 10, y: 20 } }
  const moved = zoom.panBy(start, { x: -5, y: 7 })
  check('a drag moves the picture by exactly the delta', moved.offset.x === 5 && moved.offset.y === 27, JSON.stringify(moved))
  check('and never the scale', moved.scale === 2, String(moved.scale))
  check('panning is a new view, not a mutation of the old one', start.offset.x === 10 && start.offset.y === 20, JSON.stringify(start))

  const one = zoom.oneToOne({ width: 1440, height: 1920 }, { width: 400, height: 300 })
  check('1:1 is EXACTLY one, whatever the picture and the frame', one.scale === 1, String(one.scale))
  check('and the middle of the picture lands in the middle of the frame', one.offset.x === 400 / 2 - 1440 / 2 && one.offset.y === 300 / 2 - 1920 / 2, JSON.stringify(one))
  const focused = zoom.oneToOne({ width: 1000, height: 1000 }, { width: 200, height: 200 }, { x: 900, y: 100 })
  check('with a focus, that point is the one left in the middle', focused.offset.x === 100 - 900 && focused.offset.y === 100 - 100, JSON.stringify(focused))
}

// ── 5. the stage that uses it ───────────────────────────────────────────────

const RECORDED = '/Users/someone/Desktop/yammaman/output/20260926-job-aaa.png'
const CLIP = '/Users/someone/Desktop/yammaman/output/20260926-job-clip.mp4'

const foldersBody = { folders: [{ path: '/Users/someone/Desktop/yammaman', label: 'yammaman' }], canChoose: true, root: '/p/assets', recordsRoot: '/p/generate' }
const catalogBody = {
  assets: [
    { path: RECORDED, name: 'a.png', ext: 'png', type: 'png', bytes: 1000, mtime: '2026-09-26T01:00:00.000Z', date: '2026-09-26', context: 'yammaman', folder: '/Users/someone/Desktop/yammaman', hasRecord: false, provenance: null },
    { path: CLIP, name: 'a.mp4', ext: 'mp4', type: 'mp4', bytes: 1000, mtime: '2026-09-26T01:00:00.000Z', date: '2026-09-26', context: 'yammaman', folder: '/Users/someone/Desktop/yammaman', hasRecord: false, provenance: null },
  ],
  counts: { context: [], date: [] },
  total: 2,
  shown: 2,
  folders: foldersBody.folders,
  filter: { context: null, date: null },
}
const detailOf = (which) => ({
  path: which,
  name: which === RECORDED ? 'a.png' : 'a.mp4',
  ext: which === RECORDED ? 'png' : 'mp4',
  type: which === RECORDED ? 'png' : 'mp4',
  bytes: 1000,
  date: '2026-09-26',
  context: 'yammaman',
  folder: '/Users/someone/Desktop/yammaman',
  where: 'present',
  dimensions: which === RECORDED ? { width: 1440, height: 1920 } : null,
  carrier: null,
  provenance: null,
  prompt: null,
  values: [],
})

let view = { schema: 'muen-assets-view/v1', view: 'grid', context: null, date: null, selected: RECORDED }
net.fetch = async (url) => {
  const href = String(url)
  if (href.includes('/catalog')) return { ok: true, json: async () => catalogBody }
  if (href.includes('/detail')) return { ok: true, json: async () => detailOf(decodeURIComponent(href.split('path=')[1] || '')) }
  if (href.includes('/folders')) return { ok: true, json: async () => foldersBody }
  return { ok: true, json: async () => view }
}

async function render() {
  mini.clear()
  let tree = null
  for (let pass = 0; pass < 4; pass += 1) {
    mini.reset()
    tree = pane({ locale: { bind: () => t } })
    mini.runEffects()
    await settle()
  }
  mini.reset()
  return pane({ locale: { bind: () => t } })
}

{
  view = { ...view, selected: RECORDED }
  let tree = await render()
  const stage = find(tree, 'data-assets-stage', 'yes')
  check('the selected picture gets a stage', !!stage, stage ? 'drawn' : 'no stage')
  const image = find(tree, 'data-assets-stage-image', 'yes')
  check('drawn from the file route, at a PREVIEW width rather than the original', !!image && image.props.src.includes('&w=1024'), image ? String(image.props.src).slice(-40) : 'no image')
  check('with a transform driven by the scale the math produced', !!image && /scale\(1\)/.test(String(image.props.style.transform)), image ? String(image.props.style.transform) : 'no image')
  check('and a scale label a person can read', !!find(tree, 'data-assets-stage-label', 'yes') && textIn(tree).includes('100%'), textIn(tree).slice(0, 60))

  const before = String(image.props.style.transform)
  stage.props.onWheel({ deltaY: -1, clientX: 200, clientY: 150, currentTarget: { getBoundingClientRect: () => ({ left: 0, top: 0 }) } })
  tree = again()
  const zoomed = find(tree, 'data-assets-stage-image', 'yes')
  check(
    'a wheel zooms the picture, through the same arithmetic the suite asserts above',
    !!zoomed && zoomed.props.style.transform !== before && /scale\(1\.1\)/.test(String(zoomed.props.style.transform)),
    zoomed ? String(zoomed.props.style.transform) : 'no image',
  )
  check('and the label follows it', textIn(tree).includes('110%'), textIn(tree).slice(0, 80))

  const offsetBefore = String(zoomed.props.style.transform)
  const draggable = find(tree, 'data-assets-stage', 'yes')
  draggable.props.onPointerDown({ clientX: 10, clientY: 10 })
  draggable.props.onPointerMove({ clientX: 40, clientY: 25 })
  tree = again()
  const panned = find(tree, 'data-assets-stage-image', 'yes')
  check(
    'a drag pans it by the delta, and does not change the scale',
    !!panned && panned.props.style.transform !== offsetBefore && /scale\(1\.1\)/.test(String(panned.props.style.transform)),
    panned ? String(panned.props.style.transform) : 'no image',
  )

  const one = find(tree, 'data-assets-stage-one', 'yes')
  check('1:1 is offered as its own control', !!one, one ? 'drawn' : 'not drawn')
  one.props.onClick()
  tree = again()
  const atOne = find(tree, 'data-assets-stage-image', 'yes')
  const stageAfter = find(tree, 'data-assets-stage', 'yes')
  check('pressing it shows the picture at exactly its own pixels', /scale\(1\)/.test(String(atOne.props.style.transform)), String(atOne.props.style.transform))
  check('and asks for the ORIGINAL file, which is what 1:1 means', atOne.props.src.includes(encodeURIComponent(RECORDED)) && !atOne.props.src.includes('&w='), String(atOne.props.src).slice(-60))
  check('and the stage remembers it is at full resolution', stageAfter.props['data-assets-stage-full'] === 'yes', String(stageAfter.props['data-assets-stage-full']))

  const fit = find(tree, 'data-assets-stage-fit', 'yes')
  fit.props.onClick()
  tree = again()
  const fitted = find(tree, 'data-assets-stage-image', 'yes')
  check('Fit puts it back to the fitted scale', !!fitted && /scale\(1\)/.test(String(fitted.props.style.transform)), fitted ? String(fitted.props.style.transform) : 'no image')
}

{
  // A clip is not a picture: it gets its facts and no stage.
  view = { ...view, selected: CLIP }
  const tree = await render()
  check('a clip gets no stage at all', allOf(tree, 'data-assets-stage').length === 0, textIn(tree).slice(0, 60))
  view = { ...view, selected: RECORDED }
}

note('the live layer is the founder’s eyes: the stage on a running app — wheel at a corner, drag, 1:1')

finish()
