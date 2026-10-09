/**
 * The M1 shell, asserted rather than intended.
 *
 * `lib/client.js` runs in the stubbed loader (verify/harness.mjs): apply() gets a
 * recording ctx, the tab kind registers as `studio`, the pane draws the six
 * stage cards of the pipeline nav, and a shot added in the pane is PUT to
 * /plugins/studio/projects/demo/sequences/s1 — the "reload persists" contract
 * starts with the pane actually sending the document.
 */
import { React, createReact, collect, textOf, loadClient, recordingCtx, tick, settle } from './harness.mjs'

let failures = 0
function check(label, condition, detail) {
  if (condition) {
    console.log('  ok   ' + label)
  } else {
    failures += 1
    console.log('  FAIL ' + label + (detail ? ' -- ' + detail : ''))
  }
}

const EN = {
  'type.label': 'Studio',
  'guide.title': 'Make a video',
  'guide.description': 'Character, scene, script, shoot and a timeline that exports MP4',
  'stage.character': 'Character',
  'stage.outfit': 'Outfit',
  'stage.scene': 'Scene',
  'stage.script': 'Script',
  'stage.shoot': 'Shoot',
  'stage.timeline': 'Timeline',
}

// A host that answers the pane's boot fetches and records writes. Route order
// matters: the matcher is prefix-based, so the longest match answers first.
const writes = []
const sessionDoc = {
  ok: true,
  session: {
    schema: 1,
    project: 'demo',
    sequence: 's1',
    stages: Object.fromEntries(['character', 'outfit', 'scene', 'script', 'shoot', 'timeline'].map((k) => [k, { status: 'empty', gate: null }])),
    shots: [],
  },
}
const routes = [
  { match: '/plugins/studio/projects/demo/sequences/s1', respond: (call) => {
      if (call.method === 'PUT') {
        writes.push(call.body)
        return { status: 200, body: { ok: true, session: call.body } }
      }
      return { body: sessionDoc }
    } },
  { match: '/plugins/studio/projects/demo/sequences', respond: () => ({ body: { ok: true, sequences: [{ id: 's1', stages: sessionDoc.session.stages, shots: 0 }] } }) },
  { match: '/plugins/studio/projects', respond: () => ({ body: { ok: true, projects: [{ id: 'demo', name: 'Demo', sequences: [{ id: 's1', stages: sessionDoc.session.stages, shots: 0 }] }] } }) },
]

const instance = createReact()
const { exports: exports_ } = await loadClient({
  routes,
  react: instance.React,
  primitives: {
    IconSparkleRegular: (props) => React.createElement('svg', { 'data-stub-icon': 'sparkle', ...props }),
    IconSparkle16: (props) => React.createElement('svg', { 'data-stub-icon': 'sparkle', ...props }),
    IconCheckOutlineRegular: (props) => React.createElement('svg', { 'data-stub-icon': 'check', ...props }),
    IconCheckOutline16: (props) => React.createElement('svg', { 'data-stub-icon': 'check', ...props }),
    IconPlusOutlineRegular: (props) => React.createElement('svg', { 'data-stub-icon': 'plus', ...props }),
    IconPlusOutline16: (props) => React.createElement('svg', { 'data-stub-icon': 'plus', ...props }),
    IconWarningOutlineRegular: (props) => React.createElement('svg', { 'data-stub-icon': 'warning', ...props }),
    IconWarningOutline16: (props) => React.createElement('svg', { 'data-stub-icon': 'warning', ...props }),
  },
})

const { ctx, seen } = recordingCtx(EN)
exports_.apply(ctx)

// ── registration ─────────────────────────────────────────────────────────────

const type = seen.types[0]
check('the studio tab kind registers', !!type && type.kind === 'studio', type && type.kind)
check('the tab carries a live icon', type && typeof type.icon === 'function' && type.icon() !== null)

const body = seen.slots.find((slot) => slot.options.name === 'sidebar.right.pane.tab')
check('the pane body registers', !!body, body && body.options.name)

// ── the pipeline nav draws the method ────────────────────────────────────────

instance.run(body.component, { t: (key) => EN[key] || key })
await settle(instance) // let the boot fetches land and the hook queue flush
const tree = instance.run(body.component, { t: (key) => EN[key] || key })
const text = textOf(tree)
for (const stage of ['Character', 'Outfit', 'Scene', 'Script', 'Shoot', 'Timeline']) {
  check('pipeline nav names ' + stage, text.includes(stage), text.slice(0, 120))
}
check('the nav draws all six stage cards', (text.match(/Character|Outfit|Scene|Script|Shoot|Timeline/g) || []).length >= 6)

// ── a shot added in the pane is PUT to the host ──────────────────────────────

tick([]) // run any poll the pane scheduled
const addShot = collect(tree, (n) => n.props && n.props['data-studio'] === 'shot-add')[0]
check('the add-shot control exists', !!addShot)
if (addShot && typeof addShot.props.onClick === 'function') {
  addShot.props.onClick()
  await settle(instance) // the save PUT is a promise; settle before reading writes
}
check('adding a shot PUTs the session', writes.length >= 1, 'writes=' + writes.length)
const sent = writes[writes.length - 1]
check('the PUT carries schema 1', sent && sent.schema === 1)
check('the PUT carries the new shot', sent && Array.isArray(sent.shots) && sent.shots.length === 1, JSON.stringify((sent && sent.shots) || null).slice(0, 120))

console.log(failures ? '\n' + failures + ' failure(s)' : '\nshell ok')
process.exit(failures ? 1 : 0)
