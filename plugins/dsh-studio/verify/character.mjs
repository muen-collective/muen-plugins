/**
 * The Character stage screen (M3 UI), driven through the stubbed loader.
 *
 * What is asked of it: the eight slot paragraphs render in the founder's order,
 * a paragraph edit PUTs through /edit, Approve & seal lands the seal badges and
 * freezes the core slots in the UI, Draft with LLM calls the Casting seam, and
 * Generate sheet runs through Generate's own run route — composed here, run
 * there, never talked to a provider directly.
 */
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

const EN = {
  'type.label': 'Studio',
  'char.title': 'Characters',
  'char.name': 'Name',
  'char.create': 'New character',
  'char.description': 'Describe the person',
  'char.draft': 'Draft with LLM',
  'char.approve': 'Approve & seal',
  'char.revise': 'Revise',
  'char.sealed': 'sealed',
  'char.photo': 'Add photo',
  'char.sheet': 'Generate sheet',
  'char.empty': 'Pick a character, or create one.',
  'char.run.composing': 'Composing…',
  'char.run.running': 'Generating…',
  'char.run.done': 'Done',
  'char.run.failed': 'Failed',
  'slot.overview': 'Overview',
  'slot.identity': 'Age / gender / face / build / skin',
  'slot.makeup': 'Makeup',
  'slot.hair': 'Hair',
  'slot.outfit': 'Outfit',
  'slot.pose': 'Pose',
  'slot.environment': 'Environment',
  'slot.photography': 'Photography & lighting',
}

const SLOTS8 = ['overview', 'identity', 'makeup', 'hair', 'outfit', 'pose', 'environment', 'photography']

// A host that owns the bible and records every action; the LLM seam and the
// Generate run are scripted so the screen can walk its whole loop.
const calls = []
let bible = {
  id: 'mitsu', name: 'Mitsu', paragraphs: Object.fromEntries(SLOTS8.map((s) => [s, ''])),
  core: null, looks: {}, gate: null,
}
const sealFor = (slots) => ({
  version: 1, layer: 'core',
  sealed: Object.fromEntries(slots.map((s) => [s, { text: bible.paragraphs[s], hash: 'h'.repeat(16) }])),
})

const routes = [
  { match: '/plugins/generate/providers/krea/run?job=', respond: () => ({ body: { ok: true, status: 'done', url: 'https://img.example/sheet.png' } }) },
  { match: '/plugins/generate/providers/krea/run', respond: (call) => {
      calls.push(call)
      return { body: { ok: true, jobId: 'job-1' } }
    } },
  { match: '/plugins/studio/projects/demo/characters/mitsu/sheet', respond: () => ({ body: { ok: true, name: 'krea-2-large', values: { prompt: 'sheet prompt', aspect_ratio: '3:4' } } }) },
  { match: '/plugins/studio/projects/demo/characters/mitsu/photo', respond: () => ({ body: { ok: true, photo: '/tmp/p.img', bytes: 4 } }) },
  { match: '/plugins/studio/projects/demo/characters/mitsu/draft', respond: (call) => {
      calls.push(call)
      for (const slot of SLOTS8) bible.paragraphs[slot] = 'drafted ' + slot
      return { body: { ok: true, bible } }
    } },
  { match: '/plugins/studio/projects/demo/characters/mitsu/edit', respond: (call) => {
      calls.push(call)
      bible = { ...bible, paragraphs: { ...bible.paragraphs, [call.body.slot]: call.body.text } }
      return { body: { ok: true, bible } }
    } },
  { match: '/plugins/studio/projects/demo/characters/mitsu/approve', respond: () => {
      bible = { ...bible, core: sealFor(['overview', 'identity']), gate: { by: 'human', at: 'now', coreVersion: 1 } }
      return { body: { ok: true, bible } }
    } },
  { match: '/plugins/studio/projects/demo/characters', respond: (call) => {
      if (call.method === 'POST') {
        calls.push(call)
        return { body: { ok: true, bible } }
      }
      return { body: { ok: true, characters: [bible] } }
    } },
  // The pane's boot chain, last so the longer character routes answer first.
  { match: '/plugins/studio/projects/demo/sequences', respond: () => ({ body: { ok: true, sequences: [{ id: 's1', stages: {}, shots: 0 }] } }) },
  { match: '/plugins/studio/projects', respond: () => ({ body: { ok: true, projects: [{ id: 'demo', name: 'Demo', sequences: [{ id: 's1' }] }] } }) },
]

const instance = createReact()
const { exports: exports_ } = await loadClient({ routes, react: instance.React, primitives: {} })
const { ctx, seen } = recordingCtx(EN)
exports_.apply(ctx)
const body = seen.slots.find((slot) => slot.options.name === 'sidebar.right.pane.tab')
const t = (key) => EN[key] || key

const tree0 = instance.run(body.component, { t })
await settle(instance)
const tree1 = instance.run(body.component, { t })

// Find the stage card's open handler and enter the character view.
const charCard = collect(tree1, (n) => n.props && n.props['data-studio-stage'] === 'character')[0]
check('the Character stage card is clickable', !!(charCard && charCard.props.onClick))
let tree = tree1
if (charCard && charCard.props.onClick) {
  charCard.props.onClick()
  await settle(instance)
  tree = instance.run(body.component, { t })
  // The first walk expands CharacterStage (its load effect queues at walk
  // time); one more settle + rerun brings the fetched list into the tree.
  textOf(tree)
  await settle(instance)
  tree = instance.run(body.component, { t })
}

const text = textOf(tree)
check('the character view renders', text.includes('Characters'), text.slice(0, 120))
check('the character chip lists Mitsu', collect(tree, (n) => n.props && n.props['data-studio-character'] === 'mitsu').length === 1)

// Choose the character → the bible card renders all eight slots in order.
const chip = collect(tree, (n) => n.props && n.props['data-studio-character'] === 'mitsu')[0]
if (chip && chip.props.onClick) {
  chip.props.onClick()
  await settle(instance)
  tree = instance.run(body.component, { t })
}
let slots = collect(tree, (n) => n.props && n.props['data-studio-slot'])
check('all eight slots render', slots.length === 8, 'slots=' + slots.length)
check('in the founder order', slots.map((n) => n.props['data-studio-slot']).join(',') === SLOTS8.join(','), slots.map((n) => n.props['data-studio-slot']).join(','))

// Edit a paragraph: onChange updates the field, onBlur saves through /edit.
const makeup = slots.find((n) => n.props['data-studio-slot'] === 'makeup')
if (makeup && makeup.props.onChange) {
  makeup.props.onChange({ target: { value: 'Warm orange-red eyeshadow.' } })
  await settle(instance)
  tree = instance.run(body.component, { t })
  slots = collect(tree, (n) => n.props && n.props['data-studio-slot'])
  const makeup2 = slots.find((n) => n.props['data-studio-slot'] === 'makeup')
  if (makeup2.props.onBlur) makeup2.props.onBlur({ target: { value: makeup2.props.value } })
  await settle(instance)
}
const edits = calls.filter((c) => c.url.endsWith('/edit'))
check('the edit saves through /edit', edits.length === 1 && edits[0].body.slot === 'makeup', JSON.stringify(edits.map((c) => c.body)))

// Draft with LLM: the description rides the Casting seam.
const desc = collect(tree, (n) => n.props && n.props['data-studio'] === 'char-description')[0]
if (desc && desc.props.onChange) desc.props.onChange({ target: { value: 'An exhausted hacker.' } })
await settle(instance)
tree = instance.run(body.component, { t })
const draftBtn = collect(tree, (n) => n.props && n.props['data-studio'] === 'char-draft')[0]
if (draftBtn && draftBtn.props.onClick) {
  draftBtn.props.onClick()
  await settle(instance)
  tree = instance.run(body.component, { t })
}
const drafts = calls.filter((c) => c.url.endsWith('/draft'))
check('draft calls the Casting seam route', drafts.length === 1 && drafts[0].body.description === 'An exhausted hacker.', JSON.stringify(drafts.map((c) => c.body)))

// Approve & seal: badges appear, core slots freeze in the UI.
const approveBtn = collect(tree, (n) => n.props && n.props['data-studio'] === 'char-approve')[0]
check('the approve control exists while unsealed', !!approveBtn)
if (approveBtn && approveBtn.props.onClick) {
  approveBtn.props.onClick()
  await settle(instance)
  tree = instance.run(body.component, { t })
}
const seals = collect(tree, (n) => n.props && n.props['data-studio-seal'])
check('seal badges appear on the core slots', seals.map((n) => n.props['data-studio-seal']).sort().join(',') === 'identity,overview', seals.map((n) => n.props['data-studio-seal']).join(','))
slots = collect(tree, (n) => n.props && n.props['data-studio-slot'])
const overview = slots.find((n) => n.props['data-studio-slot'] === 'overview')
check('sealed core slots are disabled in the UI', overview && overview.props.disabled === true)
check('the revise control replaces approve', collect(tree, (n) => n.props && n.props['data-studio'] === 'char-revise').length === 1)

// Generate sheet: composed here, run through Generate's own route, polled to done.
const sheetBtn = collect(tree, (n) => n.props && n.props['data-studio'] === 'char-sheet')[0]
if (sheetBtn && sheetBtn.props.onClick) {
  sheetBtn.props.onClick()
  // The poll loop rides real timer hops; wait for the result deterministically
  // instead of racing a fixed settle count.
  for (let i = 0; i < 50; i += 1) {
    await settle(instance, 2)
    tree = instance.run(body.component, { t })
    if (collect(tree, (n) => n.props && n.props['data-studio-sheet'] === 'result').length === 1) break
  }
}
const runs = calls.filter((c) => c.url.startsWith('/plugins/generate/providers/krea/run'))
check('the sheet runs through Generate\'s route', runs.length >= 1 && runs[0].body.confirmed === true, JSON.stringify(runs.map((c) => c.url)))
check('the composed name and values ride the run', runs.length >= 1 && runs[0].body.name === 'krea-2-large' && runs[0].body.values.prompt === 'sheet prompt', JSON.stringify(runs[0] && runs[0].body))
check('the result lands on screen', collect(tree, (n) => n.props && n.props['data-studio-sheet'] === 'result').length === 1)

console.log(failures ? '\n' + failures + ' failure(s)' : '\ncharacter stage ok')
process.exit(failures ? 1 : 0)
