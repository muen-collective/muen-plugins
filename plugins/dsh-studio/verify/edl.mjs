/**
 * The EDL (M7): the decision-list model, the host routes, and the strip.
 *
 * What matters here: frames are whole (trims can never land between samples),
 * ops are pure and host-side (one implementation), a bad EDL is refused whole,
 * and Undo in the view really restores the document before the last op.
 */
import {
  emptyEdl, snapFrame, addClip, moveClip, setTrim, splitClip, removeClip,
  totalFrames, buildFromSelects, validateEdl,
} from '../lib/edl.js'
import { createHandler, createStore } from '../lib/index.js'
import { createReact, loadClient, recordingCtx, settle, collect, textOf } from './harness.mjs'

let failures = 0
function check(label, condition, detail) {
  if (condition) {
    console.log('  ok   ' + label)
  } else {
    failures += 1
    console.log('  FAIL ' + label + (detail ? ' -- ' + detail : ''))
  }
}

// ---- the model ----

check('frames snap to whole numbers', snapFrame(3.6) === 4 && snapFrame(-2) === 0 && snapFrame('7') === 7)

let edl = emptyEdl(24)
edl = addClip(edl, { take: { provider: 'runninghub', jobId: 'j1', index: 0 }, label: 'A', sourceFrames: 124 })
check('a clip starts whole-take', edl.clips[0].in_f === 0 && edl.clips[0].out_f === 124, JSON.stringify(edl.clips[0]))
check('the total is the clip sum', totalFrames(edl) === 124)

edl = addClip(edl, { take: { provider: 'runninghub', jobId: 'j2', index: 0 }, label: 'B', sourceFrames: 192 })
check('clips accumulate', edl.clips.length === 2 && totalFrames(edl) === 316)

edl = moveClip(edl, edl.clips[1].id, 0)
check('move reorders', edl.clips[0].label === 'B')

edl = setTrim(edl, edl.clips[0].id, 10.4, 120.6)
check('trim snaps to whole frames', edl.clips[0].in_f === 10 && edl.clips[0].out_f === 121, JSON.stringify(edl.clips[0]))
edl = setTrim(edl, edl.clips[0].id, 50, 40)
check('an inverted trim keeps a real window', edl.clips[0].out_f === edl.clips[0].in_f + 1, JSON.stringify(edl.clips[0]))
edl = setTrim(edl, edl.clips[0].id, 0, 99999)
check('a trim clamps to the source', edl.clips[0].out_f <= 192, String(edl.clips[0].out_f))

const beforeSplit = edl.clips.length
edl = splitClip(edl, edl.clips[0].id, 60)
check('split makes two pieces', edl.clips.length === beforeSplit + 1 && edl.clips[0].out_f === 60 && edl.clips[1].in_f === 60)
check('split pieces share the take', edl.clips[0].take.jobId === edl.clips[1].take.jobId)
check('split preserves the total', totalFrames(edl) === 316, String(totalFrames(edl)))
check('a split outside the clip is a no-op', splitClip(edl, edl.clips[0].id, 0).clips.length === edl.clips.length)

edl = removeClip(edl, edl.clips[1].id)
check('delete removes one clip', edl.clips.length === beforeSplit)

// ---- selects bridge ----

const shots = [
  { id: 's01', beat: 'One', duration_s: 5, selects: [{ provider: 'runninghub', job: 'j9', index: 0 }] },
  { id: 's02', beat: 'Two', duration_s: 8, selects: [] },
  { id: 's03', beat: 'Three', duration_s: 4, selects: [{ provider: 'runninghub', job: 'j10', index: 0 }] },
]
const built = buildFromSelects(shots)
check('build takes only selects', built.clips.length === 2)
check('build keeps shot order', built.clips[0].label.startsWith('s01') && built.clips[1].label.startsWith('s03'))
check('build spans the whole take', built.clips[0].out_f === 120, JSON.stringify(built.clips[0]))
check('built clips reference take triples', built.clips[0].take.provider === 'runninghub' && built.clips[0].take.jobId === 'j9')

// ---- validation ----

check('a good EDL validates', validateEdl(emptyEdl(24)).ok)
check('wrong schema refused', validateEdl({ schema: 2, fps: 24, clips: [] }).code === 400)
check('bad fps refused', validateEdl({ schema: 1, fps: 0, clips: [] }).code === 400)
check('clips not array refused', validateEdl({ schema: 1, fps: 24, clips: 'x' }).code === 400)
check('duplicate clip ids refused', validateEdl({ schema: 1, fps: 24, clips: [{ id: 'a', in_f: 0, out_f: 5 }, { id: 'a', in_f: 0, out_f: 5 }] }).code === 400)
check('a non-integer frame refused', validateEdl({ schema: 1, fps: 24, clips: [{ id: 'a', in_f: 0.5, out_f: 5 }] }).code === 400)
check('an inverted range refused', validateEdl({ schema: 1, fps: 24, clips: [{ id: 'a', in_f: 9, out_f: 5 }] }).code === 400)

// ---- routes through the real handler ----

const os = await import('node:os')
const fsp = await import('node:fs/promises')
const path = await import('node:path')
const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'dsh-studio-edl-'))
const store = createStore(tmp)
await store.createProject({ id: 'demo', name: 'Demo' })
await store.createSequence('demo', { id: 's1', name: 'Cut' })
const handler = createHandler(store, { get: () => undefined })

function fakeReq(url, { method = 'POST', body } = {}) {
  const listeners = {}
  const pending = []
  let ended = false
  return {
    url,
    method,
    on: (event, fn) => {
      listeners[event] = fn
      if (event === 'data') for (const chunk of pending) fn(chunk)
      if (event === 'end' && ended) fn()
    },
    destroy: () => {},
    emitBody: () => {
      if (body !== undefined) {
        const chunk = Buffer.from(JSON.stringify(body))
        pending.push(chunk)
        if (listeners.data) listeners.data(chunk)
      }
      ended = true
      if (listeners.end) listeners.end()
    },
  }
}
function fakeRes() {
  return {
    statusCode: 0,
    body: undefined,
    setHeader() {},
    end(text) {
      this.body = text ? JSON.parse(text) : undefined
    },
  }
}
async function call(url, options) {
  const res = fakeRes()
  const req = fakeReq(url, options)
  const handled = handler(req, res)
  req.emitBody()
  await handled
  return res
}

{
  const res = await call('/plugins/studio/projects/demo/sequences/s1/edl', { method: 'GET' })
  check('a missing EDL is 404 (the pane starts empty)', res.statusCode === 404)
}
{
  const res = await call('/plugins/studio/projects/demo/sequences/s1/edl/op', { body: { op: 'add', take: { provider: 'runninghub', jobId: 'j1', index: 0 }, label: 'A', sourceFrames: 124 } })
  check('op add creates and persists', res.statusCode === 200 && res.body.edl.clips.length === 1, JSON.stringify(res.body))
}
{
  const res = await call('/plugins/studio/projects/demo/sequences/s1/edl', { method: 'GET' })
  check('the EDL reads back from disk', res.body.edl.clips[0].label === 'A')
}
{
  const res = await call('/plugins/studio/projects/demo/sequences/s1/edl', { method: 'PUT', body: { schema: 1, fps: 24, clips: [{ id: 'x', in_f: 2, out_f: 1 }] } })
  check('a bad EDL is refused whole', res.statusCode === 400)
}
{
  const res = await call('/plugins/studio/projects/demo/sequences/s1/edl/op', { body: { op: 'nonesuch' } })
  check('an unknown op is refused', res.statusCode === 400)
}

// ---- the strip view: ops sent, docs rendered, undo restores ----

const model = await import('../lib/edl.js')
let live = model.emptyEdl(24)
live = model.addClip(live, { take: { provider: 'runninghub', jobId: 'j1', index: 0 }, label: 's01 · One', sourceFrames: 120 })
live = model.addClip(live, { take: { provider: 'runninghub', jobId: 'j2', index: 0 }, label: 's02 · Two', sourceFrames: 96 })
const opCalls = []
const putCalls = []
const edlRoutes = [
  { match: '/plugins/studio/projects/demo/sequences/s1/edl/op', respond: (call3) => {
      opCalls.push(call3.body)
      const b = call3.body
      if (b.op === 'add') live = model.addClip(live, b)
      else if (b.op === 'move') live = model.moveClip(live, b.id, b.to)
      else if (b.op === 'trim') live = model.setTrim(live, b.id, b.in_f, b.out_f)
      else if (b.op === 'split') live = model.splitClip(live, b.id, b.at)
      else if (b.op === 'delete') live = model.removeClip(live, b.id)
      return { body: { ok: true, edl: live } }
    } },
  { match: '/plugins/studio/projects/demo/sequences/s1/edl/build', respond: () => {
      live = model.buildFromSelects([{ id: 's01', duration_s: 5, selects: [{ provider: 'runninghub', job: 'j9', index: 0 }] }])
      return { body: { ok: true, edl: live } }
    } },
  { match: '/plugins/studio/projects/demo/sequences/s1/edl', respond: (call3) => {
      if (call3.method === 'PUT') {
        putCalls.push(call3.body)
        return { body: { ok: true, edl: call3.body } }
      }
      return { body: { ok: true, edl: live } }
    } },
  { match: '/plugins/studio/projects/demo/sequences/s1', respond: () => ({ body: { ok: true, session: { schema: 1, sequence: 's1', shots: [] } } }) },
  { match: '/plugins/studio/projects/demo/sequences', respond: () => ({ body: { ok: true, sequences: [{ id: 's1' }] } }) },
  { match: '/plugins/studio/projects', respond: () => ({ body: { ok: true, projects: [{ id: 'demo', name: 'Demo', sequences: [{ id: 's1' }] }] } }) },
]

const EN = {
  'stage.timeline': 'Timeline',
  'timeline.build': 'Build from selects',
  'timeline.undo': 'Undo',
  'timeline.total': 'Total',
  'timeline.split': 'Split',
  'timeline.delete': 'Delete',
  'timeline.empty': 'Build the first cut.',
}

const instance = createReact()
const { exports: exports_ } = await loadClient({ routes: edlRoutes, react: instance.React, primitives: {} })
const { ctx: vctx, seen } = recordingCtx(EN)
exports_.apply(vctx)
const pane = seen.slots.find((s) => s.options.name === 'sidebar.right.pane.tab')
const t2 = (key) => EN[key] || key

instance.run(pane.component, { t: t2 })
await settle(instance)
let tree = instance.run(pane.component, { t: t2 })
const card = collect(tree, (n) => n.props && n.props['data-studio-stage'] === 'timeline')[0]
check('the Timeline stage card is clickable', !!(card && card.props.onClick))

if (card && card.props.onClick) {
  card.props.onClick()
  await settle(instance)
  tree = instance.run(pane.component, { t: t2 })
  textOf(tree)
  await settle(instance)
  tree = instance.run(pane.component, { t: t2 })
}

const clips = collect(tree, (n) => n.props && n.props['data-studio-clip'])
check('the strip renders the clips in order', clips.length === 2 && clips[0].props['data-studio-clip'] === live.clips[0].id, clips.map((c) => c.props['data-studio-clip']).join(','))
const totalLine = collect(tree, (n) => n.props && n.props['data-studio'] === 'timeline-total')[0]
check('the total shows frames and seconds', totalLine && textOf(totalLine).includes('216') && textOf(totalLine).includes('9.00'), totalLine && textOf(totalLine))
check('the preview order carries the take urls', !!collect(tree, (n) => n.props && n.props['data-preview-order'] && n.props['data-preview-order'].includes('job=j1'))[0])

const up = collect(tree, (n) => n.props && n.props['data-studio-clip-up'] === live.clips[1].id)[0]
if (up && up.props.onClick) {
  up.props.onClick()
  await settle(instance)
  tree = instance.run(pane.component, { t: t2 })
}
check('move up sends the op', opCalls.some((b) => b.op === 'move'), JSON.stringify(opCalls))
check('and the strip reorders', collect(tree, (n) => n.props && n.props['data-studio-clip'])[0].props['data-studio-clip'] === live.clips[0].id)

const trimIn = collect(tree, (n) => n.props && n.props['data-studio-clip-in'] === live.clips[0].id)[0]
if (trimIn && trimIn.props.onBlur) {
  trimIn.props.onBlur({ target: { value: '12.4' } })
  await settle(instance)
  tree = instance.run(pane.component, { t: t2 })
}
const trimCall = opCalls.filter((b) => b.op === 'trim').pop()
check('a trim blur sends the frames to snap host-side', trimCall && trimCall.in_f === '12.4', JSON.stringify(trimCall))

const del = collect(tree, (n) => n.props && n.props['data-studio-clip-delete'] === live.clips[0].id)[0]
if (del && del.props.onClick) {
  del.props.onClick()
  await settle(instance)
  tree = instance.run(pane.component, { t: t2 })
}
check('delete removes a clip from the strip', collect(tree, (n) => n.props && n.props['data-studio-clip']).length === 1)

const undoBtn = collect(tree, (n) => n.props && n.props['data-studio'] === 'timeline-undo')[0]
if (undoBtn && undoBtn.props.onClick) {
  undoBtn.props.onClick()
  await settle(instance)
  tree = instance.run(pane.component, { t: t2 })
}
check('undo PUTs the document before the op', putCalls.length >= 1 && putCalls[putCalls.length - 1].clips.length === 2, JSON.stringify(putCalls[putCalls.length - 1] && putCalls[putCalls.length - 1].clips.map((c) => c.id)))
check('and the strip shows the restored document', collect(tree, (n) => n.props && n.props['data-studio-clip']).length === 2)

await fsp.rm(tmp, { recursive: true, force: true })
console.log(failures ? '\n' + failures + ' failure(s)' : '\nedl ok')
process.exit(failures ? 1 : 0)
