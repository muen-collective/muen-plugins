/**
 * Execute-all (M9): the serial batch, one gate, per-shot failure visibility.
 *
 * The acceptance: partial failure is visible per shot and the batch continues;
 * nothing spends without the confirm; only ready shots (saved prompts) run.
 */
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

const sessionDoc = {
  ok: true,
  session: {
    schema: 1,
    project: 'demo',
    sequence: 's1',
    stages: Object.fromEntries(['character', 'outfit', 'scene', 'script', 'shoot', 'timeline'].map((k) => [k, { status: 'empty', gate: null }])),
    shots: [
      { id: 's01', beat: 'One', camera: 'wide', duration_s: 5, assets: [], prompt: 'PROMPT ONE', look: null, gate: null, selects: [], takes: [] },
      { id: 's02', beat: 'Two', camera: 'close', duration_s: 8, assets: [], prompt: 'PROMPT TWO', look: null, gate: null, selects: [], takes: [] },
      { id: 's03', beat: 'Three', camera: 'wide', duration_s: 4, assets: [], prompt: '', look: null, gate: null, selects: [], takes: [] },
    ],
  },
}

const runCalls = []
const preflights = []
const saves = []
let jobCounter = 0

const routes = [
  { match: '/plugins/studio/projects/demo/sequences/s1/shots', respond: (call) => {
      preflights.push(call.body)
      return { body: { ok: true, drift: [] } }
    } },
  { match: '/plugins/generate/providers/runninghub/run?job=job-2', respond: () => ({ body: { ok: true, phase: 'failed' } }) },
  { match: '/plugins/generate/providers/runninghub/run?job=', respond: () => ({ body: { ok: true, phase: 'done' } }) },
  { match: '/plugins/generate/providers/runninghub/run', respond: (call) => {
      jobCounter += 1
      runCalls.push(call.body)
      return { body: { ok: true, job: 'job-' + jobCounter } }
    } },
  { match: '/plugins/studio/projects/demo/characters', respond: () => ({ body: { ok: true, characters: [{ id: 'mitsu', name: 'Mitsu' }] } }) },
  { match: '/plugins/studio/projects/demo/outfits', respond: () => ({ body: { ok: true, records: [] } }) },
  { match: '/plugins/studio/projects/demo/scenes', respond: () => ({ body: { ok: true, records: [] } }) },
  { match: '/plugins/studio/projects/demo/sequences/s1', respond: (call) => {
      if (call.method === 'PUT') {
        saves.push(call.body)
        return { body: { ok: true, session: call.body } }
      }
      return { body: sessionDoc }
    } },
  { match: '/plugins/studio/projects/demo/sequences', respond: () => ({ body: { ok: true, sequences: [{ id: 's1' }] } }) },
  { match: '/plugins/studio/projects', respond: () => ({ body: { ok: true, projects: [{ id: 'demo', name: 'Demo', sequences: [{ id: 's1' }] }] } }) },
]

const EN = {
  'stage.shoot': 'Shoot',
  'shoot.character': 'Character',
  'shoot.look': 'Outfit',
  'shoot.scene': 'Scene',
  'shoot.generate': 'Generate',
  'shoot.runAll': 'Run all ready shots',
  'shoot.batchConfirm': 'Confirm batch',
  'shoot.batchNote': 'Each ready shot runs in order.',
  'shoot.select': 'Select',
  'shoot.takes': 'Takes',
  'shoot.noTakes': 'No takes yet.',
  'shoot.prompt': 'prompt',
  'shoot.status.running': 'running',
  'shoot.status.done': 'done',
  'shoot.status.failed': 'failed',
  'run.composing': 'Composing…',
  'run.preflight': 'Preflight…',
  'run.running': 'Running…',
  'run.batch': 'Batch running…',
}

const instance = createReact()
const { exports: exports_ } = await loadClient({ routes, react: instance.React, primitives: {} })
const { ctx, seen } = recordingCtx(EN)
exports_.apply(ctx)
const pane = seen.slots.find((s) => s.options.name === 'sidebar.right.pane.tab')
const t = (key) => EN[key] || key

instance.run(pane.component, { t })
await settle(instance)
let tree = instance.run(pane.component, { t })
const card = collect(tree, (n) => n.props && n.props['data-studio-stage'] === 'shoot')[0]
if (card && card.props.onClick) {
  card.props.onClick()
  await settle(instance)
  tree = instance.run(pane.component, { t })
  textOf(tree)
  await settle(instance)
  tree = instance.run(pane.component, { t })
}
check('the Shoot stage opens', !!collect(tree, (n) => n.props && n.props['data-studio'] === 'shoot').length)

const bind = collect(tree, (n) => n.props && n.props['data-studio'] === 'bind-character')[0]
if (bind && bind.props.onChange) {
  bind.props.onChange({ target: { value: 'mitsu' } })
  await settle(instance)
  tree = instance.run(pane.component, { t })
}

const runAllBtn = collect(tree, (n) => n.props && n.props['data-studio'] === 'shoot-runall')[0]
check('the run-all control exists', !!runAllBtn)
if (runAllBtn && runAllBtn.props.onClick) {
  runAllBtn.props.onClick()
  await settle(instance)
  tree = instance.run(pane.component, { t })
}
check('the batch gate opens before anything runs', collect(tree, (n) => n.props && n.props['data-studio'] === 'shoot-batch-confirm').length === 1)
check('nothing has run at the gate', runCalls.length === 0, JSON.stringify(runCalls))

const confirmBtn = collect(tree, (n) => n.props && n.props['data-studio'] === 'shoot-batch-confirm')[0]
if (confirmBtn && confirmBtn.props.onClick) {
  confirmBtn.props.onClick()
  for (let i = 0; i < 80; i += 1) {
    await settle(instance, 2)
    tree = instance.run(pane.component, { t })
    const chips = collect(tree, (n) => n.props && n.props['data-studio-shot'])
    const texts = chips.map((c) => textOf(c))
    if (texts.some((x) => x.includes('done')) && texts.some((x) => x.includes('failed'))) break
  }
}

check('only the ready shots ran', runCalls.length === 2, JSON.stringify(runCalls.map((c) => c.values && c.values.prompt)))
check('they ran in shot order', runCalls[0] && runCalls[0].values.prompt === 'PROMPT ONE' && runCalls[1] && runCalls[1].values.prompt === 'PROMPT TWO', JSON.stringify(runCalls.map((c) => c.values && c.values.prompt)))
check('every run passed the confirm gate', runCalls.every((c) => c.confirmed === true))
check('every shot preflighted before spending', preflights.length === 2 && preflights.every((b) => b && b.prompt), JSON.stringify(preflights))

const chips = collect(tree, (n) => n.props && n.props['data-studio-shot'])
const chipText = (id) => textOf(chips.find((c) => c.props['data-studio-shot'] === id) || {})
check('the success is visible on its shot', chipText('s01').includes('done'), chipText('s01'))
check('the failure is visible on its shot', chipText('s02').includes('failed'), chipText('s02'))
check('the unready shot is untouched', !chipText('s03').includes('done') && !chipText('s03').includes('failed') && !chipText('s03').includes('running'), chipText('s03'))
check('the batch continued past the failure', runCalls.length === 2 && chipText('s01').includes('done'))

const takeSaved = saves.some((s) => s.shots && s.shots[0] && s.shots[0].takes && s.shots[0].takes.length === 1)
check('the succeeded take landed in the session', takeSaved, JSON.stringify(saves.map((s) => s.shots && s.shots.map((x) => (x.takes || []).length))))

console.log(failures ? '\n' + failures + ' failure(s)' : '\nbatch ok')
process.exit(failures ? 1 : 0)
