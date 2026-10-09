/**
 * The store is the thing that makes "reload persists" true, so it is tested
 * against a real temp directory: create, read, write, refuse. No network, no
 * harness, no profile — a store that lies here breaks the pane quietly later.
 */
import { mkdtemp, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { createStore, validateSession, emptySession, emptyShot, STAGES, resolveRoot } from '../lib/studio-store.js'

let failures = 0
function check(label, condition, detail) {
  if (condition) {
    console.log('  ok   ' + label)
  } else {
    failures += 1
    console.log('  FAIL ' + label + (detail ? ' -- ' + detail : ''))
  }
}

const dir = await mkdtemp(path.join(tmpdir(), 'dsh-studio-store-'))
const store = createStore(dir)

// ── projects ─────────────────────────────────────────────────────────────────

const created = await store.createProject({ id: 'demo', name: 'Demo project' })
check('create project', created.ok, JSON.stringify(created))
check('create project is idempotent-refused', (await store.createProject({ id: 'demo', name: 'x' })).code === 409)
check('bad id refused', (await store.createProject({ id: '../etc', name: 'x' })).code === 400)
check('nameless refused', (await store.createProject({ id: 'x2', name: '  ' })).code === 400)

const listed = await store.listProjects()
check('list has the project', listed.ok && listed.projects.length === 1 && listed.projects[0].id === 'demo', JSON.stringify(listed.projects))
const read = await store.readProject('demo')
check('read project', read.ok && read.project.name === 'Demo project')
check('missing project is 404', (await store.readProject('nope')).code === 404)

// ── sequences + sessions ─────────────────────────────────────────────────────

const seq = await store.createSequence('demo', { id: 's1', name: 'First cut' })
check('create sequence', seq.ok, JSON.stringify(seq).slice(0, 120))
check('sequence without project is 404', (await store.createSequence('ghost', { id: 's1' })).code === 404)
check('duplicate sequence is 409', (await store.createSequence('demo', { id: 's1' })).code === 409)

const got = await store.readSession('demo', 's1')
check('session reads back', got.ok && got.session.schema === 1 && Array.isArray(got.session.shots))
check('session has all six stages', got.ok && STAGES.every((key) => got.session.stages && got.session.stages[key]), JSON.stringify(got.ok && Object.keys(got.session.stages)))

// ── write a session with shots, read it back (the "reload persists" fact) ────

const session = emptySession('demo', 's1')
const shot = emptyShot('s01')
shot.beat = 'The loom, hands'
shot.duration_s = 5
session.shots.push(shot)
await new Promise((resolve) => setTimeout(resolve, 5)) // so `updated` provably moves
const written = await store.writeSession('demo', 's1', session)
check('write session with a shot', written.ok, JSON.stringify(written).slice(0, 160))
check('write stamps updated', written.ok && written.session.updated !== session.updated)

const reread = await store.readSession('demo', 's1')
check('shot survives reload', reread.ok && reread.session.shots.length === 1 && reread.session.shots[0].beat === 'The loom, hands')
check('duration survives reload', reread.ok && reread.session.shots[0].duration_s === 5)

// ── validation refusals (nothing half-broken is ever written) ────────────────

const bad = (payload) => validateSession(payload).code
check('non-object refused', bad(null) === 400)
check('wrong schema refused', bad({ schema: 2, stages: {}, shots: [] }) === 400)
check('missing stages refused', bad({ schema: 1, shots: [] }) === 400)
check('missing one stage refused', bad({ schema: 1, stages: { character: { status: 'empty' } }, shots: [] }) === 400)
check('shots not array refused', bad({ schema: 1, stages: emptyStagesSafe(), shots: 'no' }) === 400)
check('shot without id refused', bad({ schema: 1, stages: emptyStagesSafe(), shots: [{ duration_s: 5, assets: [], selects: [] }] }) === 400)
check('duplicate shot id refused', bad({ schema: 1, stages: emptyStagesSafe(), shots: [emptyShot('a'), emptyShot('a')] }) === 400)
check('negative duration refused', bad({ schema: 1, stages: emptyStagesSafe(), shots: [{ ...emptyShot('a'), duration_s: -1 }] }) === 400)

const refusedWrite = await store.writeSession('demo', 's1', { schema: 99 })
check('writeSession refuses bad docs', refusedWrite.code === 400)
const afterRefusal = await store.readSession('demo', 's1')
check('refused write leaves the file alone', afterRefusal.ok && afterRefusal.session.shots.length === 1)

function emptyStagesSafe() {
  return Object.fromEntries(STAGES.map((key) => [key, { status: 'empty', gate: null }]))
}

// ── root resolution, said out loud ───────────────────────────────────────────

check('config override wins', resolveRoot({ config: { dataRoot: '/tmp/x' }, env: {} }).root === '/tmp/x')
check('env override is named', resolveRoot({ env: { STUDIO_DATA_DIR: '/tmp/y' }, argv: [] }).kind === 'override')
check('profile is named', resolveRoot({ env: { DSH_HOME: '/tmp/h' }, argv: ['node', 'x', '--profile', 'mitsu'] }).kind === 'profile')
check('fallback is $DSH_HOME/studio', resolveRoot({ env: { DSH_HOME: '/tmp/h' }, argv: [] }).root === path.join('/tmp/h', 'studio'))

await rm(dir, { recursive: true, force: true })
console.log(failures ? '\n' + failures + ' failure(s)' : '\nstore ok')
process.exit(failures ? 1 : 0)
