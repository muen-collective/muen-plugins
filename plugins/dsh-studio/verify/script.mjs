/**
 * The Script stage (M5): shot-draft parsing, H3's frame grid, the two LLM
 * routes, and the pane's shot list. The gate under test is simple: drafts land
 * as editable rows and nothing approves itself.
 */
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { parseShotDrafts, premiseFromBrief, gridTotal, framesFor } from '../lib/script.js'
import { createHandler, createStore } from '../lib/index.js'
import { React, createReact, collect, textOf, loadClient, recordingCtx, settle } from './harness.mjs'

let failures = 0
function check(label, condition, detail) {
  if (condition) {
    console.log('  ok   ' + label)
  } else {
    failures += 1
    console.log('  FAIL ' + label + (detail ? ' -- ' + detail : ''))
  }
}

// ── the parser ───────────────────────────────────────────────────────────────

const good = parseShotDrafts('```json\n[{"beat":"The loom, hands","camera":"insert, static","duration_s":5},{"beat":"She looks up","camera":"close-up","duration_s":8}]\n```')
check('fenced JSON parses', good.ok && good.shots.length === 2, JSON.stringify(good).slice(0, 120))
check('shots get session ids in order', good.shots[0].id === 's01' && good.shots[1].id === 's02')
check('beat and camera are carried', good.shots[0].beat === 'The loom, hands' && good.shots[1].camera === 'close-up')
check('a raw array parses too', parseShotDrafts('[{"beat":"x","duration_s":4}]').ok)
check('out-of-envelope durations clamp to 5', parseShotDrafts('[{"beat":"x","duration_s":99}]').shots[0].duration_s === 5)
check('empty answers are refused', parseShotDrafts('').ok === false && parseShotDrafts('   ').ok === false)
check('prose without an array is refused', parseShotDrafts('Here are your shots: none.').ok === false)
check('broken JSON is refused', parseShotDrafts('[{"beat": ').ok === false)
check('a beatless shot is dropped, not invented', parseShotDrafts('[{"camera":"wide"},{"beat":"ok","duration_s":5}]').shots.length === 1)
check('all-beatless answers are refused', parseShotDrafts('[{"camera":"wide"}]').ok === false)

// ── H3's frame grid (17k+5 at 24 fps) ────────────────────────────────────────

check('5 s snaps to 124 frames', framesFor(5) === 124)
check('zero stays zero', framesFor(0) === 0)
check('4 s snaps up to 5 frames grid', framesFor(4) === 107)
const total = gridTotal([5, 8])
check('totals add on the grid', total.frames === 124 + 192 && total.seconds === 13.17, JSON.stringify(total))

// ── brief → premise ──────────────────────────────────────────────────────────

check('a premise field wins', premiseFromBrief({ premise: 'A hero rises.' }) === 'A hero rises.')
check('a summary is next', premiseFromBrief({ summary: 'S' }) === 'S')
check('unknown shapes fall back to compact JSON', premiseFromBrief({ a: 1 }).startsWith('{"a":1'))
check('plain text rides through', premiseFromBrief('just text') === 'just text')

// ── the routes ───────────────────────────────────────────────────────────────

const dir = await mkdtemp(path.join(tmpdir(), 'dsh-studio-script-'))
const llmCalls = []
const ctx = {
  get: (key) =>
    key === 'llm'
      ? {
          stream: (request) => {
            llmCalls.push(request)
            return (async function* () {
              yield { type: 'text', text: '[{"beat":"Drafted one","camera":"wide","duration_s":5},{"beat":"Drafted two","camera":"medium","duration_s":8}]' }
              yield { type: 'finish' }
            })()
          },
        }
      : undefined,
}
const store = createStore(dir)
const handler = createHandler(store, ctx)
await store.createProject({ id: 'demo', name: 'Demo' })
await store.createSequence('demo', { id: 's1' })

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
  const res = await call('/plugins/studio/projects/demo/sequences/s1/script/draft', { body: { premise: 'A hero rises.', assets: ['Mitsu', 'Kimono'] } })
  check('draft returns session-shaped shots', res.statusCode === 200 && res.body.shots.length === 2 && res.body.shots[0].id === 's01', String(res.statusCode))
  check('the grid total rides along', res.body.grid && res.body.grid.frames === 316, JSON.stringify(res.body.grid))
  check('the Script role rode as system', llmCalls[0].messages[0].role === 'system' && llmCalls[0].messages[0].content[0].text.includes('shot list'))
  check('approved assets ride as context', llmCalls[0].messages[1].content[0].text.includes('Approved assets: Mitsu, Kimono'))
}
{
  const res = await call('/plugins/studio/projects/demo/sequences/s1/script/brief', { body: { brief: { premise: 'From a competitor brief.' } } })
  check('brief import drafts through the same seam', res.statusCode === 200 && res.body.shots.length === 2)
  check('the brief premise reached the role', llmCalls[1].messages[1].content[0].text.includes('From a competitor brief.'))
}
{
  const res = await call('/plugins/studio/projects/demo/sequences/s1/script/draft', { body: { premise: '   ' } })
  check('an empty premise is refused 400', res.statusCode === 400, String(res.statusCode))
}
{
  const res = await call('/plugins/studio/projects/demo/sequences/s1/script/draft', { method: 'GET' })
  check('GET on the script route is refused 405', res.statusCode === 405, String(res.statusCode))
}

await rm(dir, { recursive: true, force: true })

// ── the pane's shot list ─────────────────────────────────────────────────────

const EN = {
  'stage.script': 'Script',
  'script.title': 'Script',
  'script.camera': 'Camera',
  'script.premise': 'Premise',
  'script.write': 'Write with LLM',
  'script.brief': 'Brief',
  'script.import': 'Import brief',
  'script.approve': 'Approve script',
  'script.gated': 'Approved',
  'script.remove': '×',
  'script.total': 'Total',
  'script.empty': 'No shots yet.',
  'script.noseq': 'Create a sequence first.',
  'shot.beat': 'Beat',
  'shot.add': 'Add shot',
}

const session = {
  schema: 1,
  project: 'demo',
  sequence: 's1',
  stages: { script: { status: 'empty', gate: null } },
  shots: [
    { id: 's01', beat: 'The loom, hands', camera: 'insert', duration_s: 5, assets: [], prompt: '', look: null, gate: null, selects: [] },
    { id: 's02', beat: 'She looks up', camera: 'close-up', duration_s: 8, assets: [], prompt: '', look: null, gate: null, selects: [] },
  ],
}
const saves = []
const scriptRoutes = [
  { match: '/plugins/studio/projects/demo/sequences/s1/script', respond: () => ({ body: { ok: true, shots: [{ id: 's01', beat: 'Drafted one', camera: '', duration_s: 5, assets: [], prompt: '', look: null, gate: null, selects: [] }], grid: { frames: 124, seconds: 5.17 } } }) },
  { match: '/plugins/studio/projects/demo/sequences/s1', respond: (call) => {
      if (call.method === 'PUT') {
        saves.push(call.body)
        return { body: { ok: true, session: call.body } }
      }
      return { body: { ok: true, session } }
    } },
  { match: '/plugins/studio/projects/demo/sequences', respond: () => ({ body: { ok: true, sequences: [{ id: 's1' }] } }) },
  { match: '/plugins/studio/projects', respond: () => ({ body: { ok: true, projects: [{ id: 'demo', name: 'Demo', sequences: [{ id: 's1' }] }] } }) },
]

const instance = createReact()
const { exports: exports_ } = await loadClient({ routes: scriptRoutes, react: instance.React, primitives: {} })
const { ctx: paneCtx, seen } = recordingCtx(EN)
exports_.apply(paneCtx)
const body = seen.slots.find((slot) => slot.options.name === 'sidebar.right.pane.tab')
const t = (key) => EN[key] || key

instance.run(body.component, { t })
await settle(instance)
let tree = instance.run(body.component, { t })
const card = collect(tree, (n) => n.props && n.props['data-studio-stage'] === 'script')[0]
check('the Script stage card is clickable', !!(card && card.props.onClick))
if (card && card.props.onClick) {
  card.props.onClick()
  await settle(instance)
  tree = instance.run(body.component, { t })
}

const rows = collect(tree, (n) => n.props && n.props['data-studio-shot'])
check('the shot rows render', rows.length === 2, 'rows=' + rows.length)
check('in session order', rows.map((n) => n.props['data-studio-shot']).join(',') === 's01,s02')
const totalLine = collect(tree, (n) => n.props && n.props['data-studio'] === 'script-total')[0]
check('the total shows the frame grid', totalLine && textOf(totalLine).includes('13.17'), totalLine && textOf(totalLine))

// Editing a row saves through the session PUT.
const beat = collect(tree, (n) => n.props && n.props['data-studio-shot-beat'] === 's01')[0]
if (beat && beat.props.onChange) {
  beat.props.onChange({ target: { value: 'The loom, hands, closer.' } })
  await settle(instance)
}
check('a row edit PUTs the session', saves.length === 1 && saves[0].shots[0].beat === 'The loom, hands, closer.', JSON.stringify(saves.map((s) => s.shots && s.shots[0].beat)))

// LLM write: drafts replace the list after the seam answers.
tree = instance.run(body.component, { t })
const premise = collect(tree, (n) => n.props && n.props['data-studio'] === 'script-premise')[0]
if (premise && premise.props.onChange) premise.props.onChange({ target: { value: 'A hero rises.' } })
await settle(instance)
tree = instance.run(body.component, { t })
const writeBtn = collect(tree, (n) => n.props && n.props['data-studio'] === 'script-write')[0]
if (writeBtn && writeBtn.props.onClick) {
  writeBtn.props.onClick()
  await settle(instance)
  tree = instance.run(body.component, { t })
}
const afterWrite = saves[saves.length - 1]
check('LLM drafts replace the rows', afterWrite && afterWrite.shots.length === 1 && afterWrite.shots[0].beat === 'Drafted one', JSON.stringify((afterWrite && afterWrite.shots) || null).slice(0, 120))

// The gate stamps the script stage and never runs itself.
const approveBtn = collect(tree, (n) => n.props && n.props['data-studio'] === 'script-approve')[0]
check('the approve control exists', !!approveBtn)
if (approveBtn && approveBtn.props.onClick) {
  approveBtn.props.onClick()
  await settle(instance)
  tree = instance.run(body.component, { t })
}
const gated = saves[saves.length - 1]
check('approve stamps the script gate', gated && gated.stages.script.status === 'gated', JSON.stringify(gated && gated.stages.script))
check('the approved line shows', collect(tree, (n) => n.props && n.props['data-studio'] === 'script-gated').length === 1)

console.log(failures ? '\n' + failures + ' failure(s)' : '\nscript ok')
process.exit(failures ? 1 : 0)
