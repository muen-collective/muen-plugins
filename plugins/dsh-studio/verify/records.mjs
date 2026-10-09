/**
 * Outfit + Scene records (M4): the shared loop, asserted per kind.
 *
 * The difference under test is exactly one thing: an outfit's look paragraphs
 * seal at approve (slots 3–5, design doc §4.1 — "new costume = new look record,
 * same core"), while a scene gates only. Everything else — create, edit, revise,
 * the pane view — is the same loop M3 proved for characters.
 */
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { emptyRecord, editParagraph, approve, revise, verifyPrompt, RECORD_KINDS } from '../lib/records.js'
import { createHandler, createStore } from '../lib/index.js'
import { createReact, collect, textOf, loadClient, recordingCtx, settle } from './harness.mjs'

let failures = 0
function check(label, condition, detail) {
  if (condition) {
    console.log('  ok   ' + label)
  } else {
    failures += 1
    console.log('  FAIL ' + label + (detail ? ' -- ' + detail : ''))
  }
}

// ── the rules ────────────────────────────────────────────────────────────────

check('outfit slots are the look layer', RECORD_KINDS.outfit.slots.join(',') === 'makeup,hair,outfit')
check('scene slots are the scene layer', RECORD_KINDS.scene.slots.join(',') === 'environment,photography')

const outfit = emptyRecord('outfit', 'maid', 'Maid uniform', { character: 'mitsu' })
check('an outfit binds a character', outfit.character === 'mitsu' && outfit.kind === 'outfit')

const refused = approve(outfit)
check('approving an empty outfit is refused', refused.ok === false && refused.error.includes('outfit'), refused.error)

let edited = outfit
for (const [slot, text] of [['makeup', 'Warm eyeshadow.'], ['hair', 'Limp, shoulder-length.'], ['outfit', 'Black wool, white apron.']]) {
  edited = editParagraph(edited, slot, text).record
}
const sealed = approve(edited)
check('outfit approve seals the look', sealed.ok && sealed.record.look !== null)
check('all three look paragraphs sealed', Object.keys(sealed.record.look.sealed).sort().join(',') === 'hair,makeup,outfit')
check('look version is 1', sealed.record.look.version === 1 && sealed.record.gate.lookVersion === 1)

const blocked = editParagraph(sealed.record, 'outfit', 'Silk now.')
check('a sealed look paragraph is frozen', blocked.ok === false && blocked.error.includes('sealed'), blocked.error)

const reopened = revise(sealed.record)
check('revise unseals the look', reopened.record.look === null && reopened.record.gate === null)
const reapproved = approve(editParagraph(reopened.record, 'outfit', 'Silk now.').record)
check('re-approval bumps the look version', reapproved.ok && reapproved.record.look.version === 2)

const promptWithLook = ['outfit', 'hair', 'makeup']
  .map((slot) => sealed.record.look.sealed[slot].text)
  .join('\n\n')
check('a verbatim prompt passes', verifyPrompt(sealed.record, promptWithLook).ok)
const drifted = verifyPrompt(sealed.record, promptWithLook.replace('Black wool, white apron.', 'Something else.'))
check('a drifted look paragraph is caught', drifted.ok === false && drifted.drift.some((d) => d.slot === 'outfit'), JSON.stringify(drifted.drift))

const scene = emptyRecord('scene', 'store', 'Convenience store')
check('a scene binds no character', scene.character === null)
const sceneRefused = approve(scene)
check('approving an empty scene is refused', sceneRefused.ok === false && sceneRefused.error.includes('environment'))
const sceneApproved = approve(editParagraph(scene, 'environment', 'Neon convenience store at night.').record)
check('scene approve gates without sealing', sceneApproved.ok && sceneApproved.record.gate && sceneApproved.record.look === null)
const sceneEditable = editParagraph(sceneApproved.record, 'environment', 'A different room.')
check('scene paragraphs stay editable after approval', sceneEditable.ok)

// ── the routes carry the same rules ──────────────────────────────────────────

const dir = await mkdtemp(path.join(tmpdir(), 'dsh-studio-records-'))
const store = createStore(dir)
const handler = createHandler(store, { get: () => undefined })
await store.createProject({ id: 'demo', name: 'Demo' })

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
  const res = await call('/plugins/studio/projects/demo/outfits', { body: { id: 'maid', name: 'Maid uniform', character: 'mitsu' } })
  check('POST /outfits creates a record with its character', res.statusCode === 200 && res.body.record.character === 'mitsu', String(res.statusCode))
}
{
  await call('/plugins/studio/projects/demo/outfits/maid/edit', { body: { slot: 'outfit', text: 'Black wool, white apron.' } })
  const res = await call('/plugins/studio/projects/demo/outfits/maid/approve', {})
  check('outfit approve seals through the route', res.statusCode === 200 && res.body.record.look.sealed.outfit, String(res.statusCode))
}
{
  const res = await call('/plugins/studio/projects/demo/outfits/maid/edit', { body: { slot: 'outfit', text: 'Drift.' } })
  check('the route freezes sealed look paragraphs', res.statusCode === 409, String(res.statusCode))
}
{
  const res = await call('/plugins/studio/projects/demo/scenes', { body: { id: 'store', name: 'Store' } })
  check('POST /scenes creates a scene', res.statusCode === 200 && res.body.record.kind === 'scene', String(res.statusCode))
}
{
  await call('/plugins/studio/projects/demo/scenes/store/edit', { body: { slot: 'environment', text: 'Neon convenience store at night.' } })
  const res = await call('/plugins/studio/projects/demo/scenes/store/approve', {})
  check('scene approve gates through the route', res.statusCode === 200 && res.body.record.gate && !res.body.record.look, String(res.statusCode))
}

// ── the pane views (both kinds, the shared loop) ─────────────────────────────

const EN = {
  'stage.outfit': 'Outfit',
  'stage.scene': 'Scene',
  'record.name': 'Name',
  'record.character': 'Character id',
  'record.create': 'New record',
  'record.empty': 'Pick a record, or create one.',
  'record.approve': 'Approve',
  'record.revise': 'Revise',
  'record.sealed': 'sealed',
  'slot.makeup': 'Makeup',
  'slot.hair': 'Hair',
  'slot.outfit': 'Outfit',
  'slot.environment': 'Environment',
  'slot.photography': 'Photography & lighting',
}
const calls = []
const outfitDoc = { kind: 'outfit', id: 'maid', name: 'Maid uniform', character: 'mitsu', paragraphs: { makeup: 'x', hair: 'y', outfit: 'z' }, look: null, gate: null }
const viewRoutes = [
  { match: '/plugins/studio/projects/demo/outfits/maid/approve', respond: () => {
      calls.push('approve')
      outfitDoc.look = { version: 1, layer: 'look', sealed: { outfit: { text: 'z', hash: 'h'.repeat(16) }, makeup: { text: 'x', hash: 'h'.repeat(16) }, hair: { text: 'y', hash: 'h'.repeat(16) } } }
      outfitDoc.gate = { by: 'human', at: 'now', lookVersion: 1 }
      return { body: { ok: true, record: outfitDoc } }
    } },
  { match: '/plugins/studio/projects/demo/outfits', respond: (call_) => {
      if (call_.method === 'POST') return { body: { ok: true, record: outfitDoc } }
      return { body: { ok: true, records: [outfitDoc] } }
    } },
  { match: '/plugins/studio/projects/demo/scenes', respond: () => ({ body: { ok: true, records: [{ kind: 'scene', id: 'store', name: 'Store', paragraphs: { environment: 'e', photography: 'p' }, look: null, gate: null }] } }) },
  { match: '/plugins/studio/projects/demo/sequences', respond: () => ({ body: { ok: true, sequences: [{ id: 's1' }] } }) },
  { match: '/plugins/studio/projects', respond: () => ({ body: { ok: true, projects: [{ id: 'demo', name: 'Demo', sequences: [{ id: 's1' }] }] } }) },
]

const instance = createReact()
const { exports: exports_ } = await loadClient({ routes: viewRoutes, react: instance.React, primitives: {} })
const { ctx, seen } = recordingCtx(EN)
exports_.apply(ctx)
const bodySlot = seen.slots.find((slot) => slot.options.name === 'sidebar.right.pane.tab')
const t = (key) => EN[key] || key

instance.run(bodySlot.component, { t })
await settle(instance)
let tree = instance.run(bodySlot.component, { t })

const openView = async (stageKey) => {
  const card = collect(tree, (n) => n.props && n.props['data-studio-stage'] === stageKey)[0]
  check('the ' + stageKey + ' stage card is clickable', !!(card && card.props.onClick))
  if (card && card.props.onClick) {
    card.props.onClick()
    await settle(instance)
    tree = instance.run(bodySlot.component, { t })
    textOf(tree) // expand the record view (queues its load effect)
    await settle(instance)
    tree = instance.run(bodySlot.component, { t })
  }
}

// Outfit view: chip → approve → seal badge on the sealed paragraph.
await openView('outfit')
check('the outfit view lists the record', collect(tree, (n) => n.props && n.props['data-studio-record'] === 'maid').length === 1)
const chip = collect(tree, (n) => n.props && n.props['data-studio-record'] === 'maid')[0]
if (chip && chip.props.onClick) {
  chip.props.onClick()
  await settle(instance)
  tree = instance.run(bodySlot.component, { t })
}
check('the outfit card draws its three slots', collect(tree, (n) => n.props && n.props['data-studio-slot']).length === 3)
const approveBtn = collect(tree, (n) => n.props && n.props['data-studio'] === 'record-approve')[0]
check('the approve control exists', !!approveBtn)
if (approveBtn && approveBtn.props.onClick) {
  approveBtn.props.onClick()
  await settle(instance)
  tree = instance.run(bodySlot.component, { t })
}
check('approve seals through the view', calls.includes('approve'))
check('seal badges appear on sealed paragraphs', collect(tree, (n) => n.props && n.props['data-studio-seal']).length >= 1)

// Scene view: the same loop with its two slots.
tree = instance.run(bodySlot.component, { t })
const back = collect(tree, (n) => n.props && n.props['data-studio'] === 'view-back')[0]
if (back && back.props.onClick) {
  back.props.onClick()
  await settle(instance)
  tree = instance.run(bodySlot.component, { t })
}
await openView('scene')
check('the scene view draws its two slots', collect(tree, (n) => n.props && n.props['data-studio-slot']).length === 2, String(collect(tree, (n) => n.props && n.props['data-studio-slot']).length))

await rm(dir, { recursive: true, force: true })
console.log(failures ? '\n' + failures + ' failure(s)' : '\nrecords ok')
process.exit(failures ? 1 : 0)
