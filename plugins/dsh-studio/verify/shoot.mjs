/**
 * The Shoot stage (M6): mechanical prompt assembly, the preflight drift gate,
 * and the run flow through Generate's AI-App path.
 *
 * The money assertions: sealed paragraphs land byte-verbatim in the composed
 * prompt (the LLM writes ONLY the scene layer), a drifted prompt is refused at
 * preflight, and the run that spends carries `confirmed: true`.
 */
import { createHandler, createStore } from '../lib/index.js'
import { approve as approveBible, emptyBible, editParagraph as editBible } from '../lib/bibles.js'
import { emptyRecord, editParagraph as editRecord, approve as approveRecord } from '../lib/records.js'
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

// ---- fixtures: real approved bible + look, so the seal hashes are real ----

const bible = emptyBible('mitsu', 'Mitsu')
for (const [slot, text] of [
  ['overview', 'Mitsu, an exhausted hacker.'],
  ['identity', 'Tall, thin, pale skin with visible pores.'],
  ['makeup', 'Warm orange-red eyeshadow.'],
  ['hair', 'Jet-black, shoulder-length.'],
  ['outfit', 'Victorian maid uniform, black wool.'],
  ['pose', 'Half-lidded.'],
  ['environment', 'Neon store.'],
  ['photography', 'Portra 400.'],
]) {
  bible.paragraphs[slot] = text
}
const sealedBible = approveBible(bible).bible

const outfit = emptyRecord('outfit', 'maid', 'Maid uniform', { character: 'mitsu' })
for (const [slot, text] of [
  ['makeup', 'Same warm eyeshadow.'],
  ['hair', 'Hair pinned back.'],
  ['outfit', 'Black wool dress, white apron, no patterns.'],
]) {
  const edited = editRecord(outfit, slot, text)
  Object.assign(outfit, edited.record)
}
const sealedLook = approveRecord(outfit).record

const sceneRecord = emptyRecord('scene', 'konbini', 'Konbini at night')
sceneRecord.paragraphs.environment = 'Fluorescent konbini at night, rain outside.'
const approvedScene = approveRecord(sceneRecord).record

// ---- host routes: compose and preflight ----

const llmCalls = []
const ctx = {
  get: (key) =>
    key === 'llm'
      ? {
          stream: (request) => {
            llmCalls.push(request)
            return (async function* () {
              yield { type: 'text', text: 'She lurches against the counter.\n\nFluorescent hum, rain hissing outside.\n\nWarm tungsten key from the left.' }
              yield { type: 'finish' }
            })()
          },
        }
      : undefined,
}

const dir = (await import('node:fs/promises')).mkdtemp
const os = await import('node:os')
const path = await import('node:path')
const tmp = await dir(path.join(os.tmpdir(), 'dsh-studio-shoot-'))

const store = createStore(tmp)
await store.createProject({ id: 'demo', name: 'Demo' })
await store.createCharacter('demo', { id: 'mitsu', name: 'Mitsu' })
await store.writeCharacter('demo', 'mitsu', sealedBible)
await store.createRecord('demo', 'outfit', { id: 'maid', name: 'Maid uniform', character: 'mitsu' })
await store.writeRecord('demo', 'outfit', 'maid', sealedLook)
await store.createRecord('demo', 'scene', { id: 'konbini', name: 'Konbini' })
await store.writeRecord('demo', 'scene', 'konbini', approvedScene)
await store.createSequence('demo', { id: 's1', name: 'Cut' })

const handler = createHandler(store, ctx)

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

const composed = await call('/plugins/studio/projects/demo/sequences/s1/shots/s01/prompt', {
  body: { character: 'mitsu', look: 'maid', scene: 'konbini', beat: 'She lurches.', camera: 'medium' },
})
check('the compose route answers 200', composed.statusCode === 200, JSON.stringify(composed.body).slice(0, 120))
check('sealed core lands byte-verbatim', composed.body.prompt.includes(sealedBible.core.sealed.overview.text) && composed.body.prompt.includes(sealedBible.core.sealed.identity.text))
check('sealed look lands byte-verbatim', composed.body.prompt.includes(sealedLook.look.sealed.outfit.text))
check('the LLM wrote only the scene layer', composed.body.prompt.includes('She lurches against the counter.') && composed.body.prompt.includes('Warm tungsten key from the left.'))
check('the composed prompt passes its own preflight', composed.body.drift.length === 0, JSON.stringify(composed.body.drift))
check('the Prompt-desk role rode as the system message', llmCalls[0].messages[0].content[0].text.includes('SCENE paragraphs'))

const clean = await call('/plugins/studio/projects/demo/sequences/s1/shots/s01/preflight', {
  body: { prompt: composed.body.prompt, character: 'mitsu', look: 'maid' },
})
check('a verbatim prompt passes preflight', clean.statusCode === 200 && clean.body.ok === true, JSON.stringify(clean.body))

const driftedPrompt = composed.body.prompt.replace(sealedBible.core.sealed.identity.text, 'Tall, thin, luminous skin.')
const drifted = await call('/plugins/studio/projects/demo/sequences/s1/shots/s01/preflight', {
  body: { prompt: driftedPrompt, character: 'mitsu', look: 'maid' },
})
check('a drifted core paragraph is refused', drifted.body.ok === false && drifted.body.drift.some((d) => d.slot === 'identity' && d.layer === 'core'), JSON.stringify(drifted.body))

const lookDrift = await call('/plugins/studio/projects/demo/sequences/s1/shots/s01/preflight', {
  body: { prompt: composed.body.prompt.replace(sealedLook.look.sealed.outfit.text, 'A red coat.'), character: 'mitsu', look: 'maid' },
})
check('a drifted look paragraph is refused', lookDrift.body.ok === false && lookDrift.body.drift.some((d) => d.layer === 'look'), JSON.stringify(lookDrift.body))

const noCore = await call('/plugins/studio/projects/demo/sequences/s1/shots/s01/prompt', {
  body: { character: 'ghost', beat: 'x', camera: 'x' },
})
check('an unknown character is refused', noCore.statusCode === 404 || noCore.statusCode === 409, String(noCore.statusCode))

// ---- the Shoot stage view: the desk, the gate, the run ----

const sessionDoc = {
  ok: true,
  session: {
    schema: 1,
    project: 'demo',
    sequence: 's1',
    stages: Object.fromEntries(['character', 'outfit', 'scene', 'script', 'shoot', 'timeline'].map((k) => [k, { status: 'empty', gate: null }])),
    shots: [{ id: 's01', beat: 'She lurches.', camera: 'medium', duration_s: 5, assets: [], prompt: '', look: null, gate: null, selects: [], takes: [] }],
  },
}
const runCalls = []
const saves = []
const viewRoutes = [
  { match: '/plugins/studio/projects/demo/sequences/s1/shots', respond: () => ({ body: { ok: true, prompt: composed.body.prompt, scene: {}, drift: [] } }) },
  { match: '/plugins/generate/providers/runninghub/run?job=', respond: () => ({ body: { ok: true, phase: 'done' } }) },
  { match: '/plugins/generate/providers/runninghub/run', respond: (call2) => {
      runCalls.push(call2.body)
      return { body: { ok: true, job: 'job-1' } }
    } },
  { match: '/plugins/studio/projects/demo/characters', respond: () => ({ body: { ok: true, characters: [{ id: 'mitsu', name: 'Mitsu' }] } }) },
  { match: '/plugins/studio/projects/demo/outfits', respond: () => ({ body: { ok: true, records: [{ id: 'maid', name: 'Maid uniform' }] } }) },
  { match: '/plugins/studio/projects/demo/scenes', respond: () => ({ body: { ok: true, records: [{ id: 'konbini', name: 'Konbini' }] } }) },
  { match: '/plugins/studio/projects/demo/sequences/s1', respond: (call2) => {
      if (call2.method === 'PUT') {
        saves.push(call2.body)
        return { body: { ok: true, session: call2.body } }
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
  'shoot.compose': 'Write with LLM',
  'shoot.generate': 'Generate',
  'shoot.confirm': 'Confirm run',
  'shoot.takes': 'Takes',
  'shoot.noTakes': 'No takes yet.',
  'shoot.select': 'Select',
  'shoot.prompt': 'prompt',
  'run.composing': 'Composing…',
  'run.preflight': 'Preflight…',
  'run.running': 'Running…',
}

const instance = createReact()
const { exports: exports_ } = await loadClient({ routes: viewRoutes, react: instance.React, primitives: {} })
const { ctx: vctx, seen } = recordingCtx(EN)
exports_.apply(vctx)
const body = seen.slots.find((s) => s.options.name === 'sidebar.right.pane.tab')
const t = (key) => EN[key] || key

instance.run(body.component, { t })
await settle(instance)
let tree = instance.run(body.component, { t })
const shootCard = collect(tree, (n) => n.props && n.props['data-studio-stage'] === 'shoot')[0]
check('the Shoot stage card is clickable', !!(shootCard && shootCard.props.onClick))

if (shootCard && shootCard.props.onClick) {
  shootCard.props.onClick()
  await settle(instance)
  tree = instance.run(body.component, { t })
  textOf(tree) // expand ShootStage (loads asset lists)
  await settle(instance)
  tree = instance.run(body.component, { t })
}

check('the shot desk renders the shot', !!collect(tree, (n) => n.props && n.props['data-studio-shot'] === 's01').length)

const bindCharacter = collect(tree, (n) => n.props && n.props['data-studio'] === 'bind-character')[0]
check('the asset picker draws', !!bindCharacter)
if (bindCharacter && bindCharacter.props.onChange) {
  bindCharacter.props.onChange({ target: { value: 'mitsu' } })
  await settle(instance)
  tree = instance.run(body.component, { t })
}

const composeBtn = collect(tree, (n) => n.props && n.props['data-studio'] === 'shoot-compose')[0]
check('the compose control exists', !!composeBtn)
if (composeBtn && composeBtn.props.onClick) {
  composeBtn.props.onClick()
  await settle(instance)
  tree = instance.run(body.component, { t })
}
const promptBox = collect(tree, (n) => n.props && n.props['data-studio'] === 'shoot-prompt')[0]
check('the composed prompt lands in the textarea', promptBox && String(promptBox.props.value).includes(sealedBible.core.sealed.overview.text), promptBox && String(promptBox.props.value).slice(0, 60))

const generateBtn = collect(tree, (n) => n.props && n.props['data-studio'] === 'shoot-generate')[0]
if (generateBtn && generateBtn.props.onClick) {
  generateBtn.props.onClick()
  await settle(instance)
  tree = instance.run(body.component, { t })
}
check('the confirm gate opens before anything spends', collect(tree, (n) => n.props && n.props['data-studio'] === 'shoot-confirm').length === 1)
check('nothing has run yet', runCalls.length === 0)

const confirmBtn = collect(tree, (n) => n.props && n.props['data-studio'] === 'shoot-confirm')[0]
if (confirmBtn && confirmBtn.props.onClick) {
  confirmBtn.props.onClick()
  for (let i = 0; i < 50; i += 1) {
    await settle(instance, 2)
    tree = instance.run(body.component, { t })
    if (collect(tree, (n) => n.props && n.props['data-studio-take']).length >= 1) break
  }
}
check('the run that spends carries confirmed: true', runCalls.length === 1 && runCalls[0].confirmed === true, JSON.stringify(runCalls))
check('the take lands in the filmstrip', collect(tree, (n) => n.props && n.props['data-studio-take'] === 'job-1').length === 1)

const selectBtn = collect(tree, (n) => n.props && n.props['data-studio-take-select'] === 'job-1')[0]
if (selectBtn && selectBtn.props.onClick) {
  selectBtn.props.onClick()
  await settle(instance)
}
check('selecting writes the session', saves.length >= 1 && saves[saves.length - 1].shots[0].selects.length === 1 && saves[saves.length - 1].shots[0].selects[0].job === 'job-1', JSON.stringify(saves[saves.length - 1] && saves[saves.length - 1].shots[0].selects))

const fs = await import('node:fs/promises')
await fs.rm(tmp, { recursive: true, force: true })
console.log(failures ? '\n' + failures + ' failure(s)' : '\nshoot ok')
process.exit(failures ? 1 : 0)
