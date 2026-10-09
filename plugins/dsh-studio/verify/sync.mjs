/**
 * GitHub sync (M11) behind the sync-target seam.
 *
 * The acceptance: push on machine A, pull on machine B, ratings intact; offline
 * is an honest answer and the local file keeps working. No network in any test —
 * the target's fetch is injected and the seam is exercised between two local
 * library files sharing one fake remote.
 */
import { promises as fsp } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { githubTarget, createSync } from '../lib/sync.js'
import { createLibrary } from '../lib/library.js'
import { createHandler, createStore } from '../lib/index.js'

let failures = 0
function check(label, condition, detail) {
  if (condition) {
    console.log('  ok   ' + label)
  } else {
    failures += 1
    console.log('  FAIL ' + label + (detail ? ' -- ' + detail : ''))
  }
}

// A fake GitHub Contents API: one file, sha-stamped, base64.
function fakeGithub() {
  const remote = { content: null, sha: null }
  let shaCounter = 0
  const calls = []
  const impl = async (url, options = {}) => {
    calls.push({ url: String(url), method: String(options.method || 'GET') })
    if (String(url).includes('/contents/library.json')) {
      if (String(options.method || 'GET') === 'GET') {
        if (remote.content === null) return { ok: false, status: 404, json: async () => ({}) }
        return { ok: true, status: 200, json: async () => ({ content: Buffer.from(remote.content, 'utf8').toString('base64'), sha: remote.sha }) }
      }
      const body = JSON.parse(options.body)
      if (remote.sha && body.sha !== remote.sha) return { ok: false, status: 409, json: async () => ({}) }
      remote.content = Buffer.from(body.content, 'base64').toString('utf8')
      remote.sha = 'sha-' + (++shaCounter)
      return { ok: true, status: 200, json: async () => ({ content: { sha: remote.sha } }) }
    }
    return { ok: false, status: 404, json: async () => ({}) }
  }
  return { impl, remote, calls }
}

// ---- the target ----

check('an unconfigured target is null', githubTarget({}) === null)

{
  const api = fakeGithub()
  const target = githubTarget({ repo: 'me/mitsu-library', token: 'pat', fetchImpl: api.impl })
  check('the target names itself', target.name === 'github')
  const pulled = await target.pull()
  check('pulling a missing file is an honest 404', pulled.ok === false && pulled.code === 404)
  const pushed = await target.push('{"recipes":[]}')
  check('pushing creates the file', pushed.ok === true && api.remote.content === '{"recipes":[]}', JSON.stringify(pushed))
  const pushed2 = await target.push('{"recipes":[1]}')
  check('pushing again updates with the sha', pushed2.ok && api.remote.content === '{"recipes":[1]}')
  const back = await target.pull()
  check('pulling returns the content verbatim', back.ok && back.content === '{"recipes":[1]}' && back.sha === api.remote.sha)
  check('the api was only asked for the one file', api.calls.every((c) => c.url.includes('/repos/me/mitsu-library/contents/library.json')), JSON.stringify(api.calls))
}
{
  const target = githubTarget({ repo: 'me/r', token: 'pat', fetchImpl: () => { throw new Error('ENETDOWN') } })
  const answer = await target.push('x')
  check('offline is an honest answer', answer.ok === false && answer.error.includes('offline'), JSON.stringify(answer))
}

// ---- the seam between two machines, one remote ----

const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'dsh-studio-sync-'))
const api = fakeGithub()
const shared = githubTarget({ repo: 'me/mitsu-library', token: 'pat', fetchImpl: api.impl })
const machineA = createLibrary(path.join(tmp, 'a', 'library'))
const machineB = createLibrary(path.join(tmp, 'b', 'library'))
await machineA.upsert({ id: 'r-1', kind: 'video', provider: 'runninghub', jobId: 'j1', recipe: { prompt: 'PROMPT', params: {} }, rating: 5, tags: [] })

const syncA = createSync({ file: path.join(tmp, 'a', 'library', 'library.json'), target: shared })
const syncB = createSync({ file: path.join(tmp, 'b', 'library', 'library.json'), target: shared })

{
  const pushed = await syncA.push()
  check('machine A pushes', pushed.ok === true)
}
{
  const pulled = await syncB.pull()
  check('machine B pulls', pulled.ok === true)
  const recipes = await machineB.list()
  check('ratings travel intact', recipes.recipes.length === 1 && recipes.recipes[0].rating === 5, JSON.stringify(recipes.recipes))
}
{
  const unsynced = createSync({ file: path.join(tmp, 'a', 'library', 'library.json'), target: null })
  const answer = await unsynced.push()
  check('unconfigured push is an honest 501', answer.code === 501 && answer.error === 'sync not configured')
  const pulled = await unsynced.pull()
  check('unconfigured pull is an honest 501', pulled.code === 501)
}
{
  const fresh = createSync({ file: path.join(tmp, 'never', 'library.json'), target: shared })
  const answer = await fresh.push()
  check('pushing an empty machine is an honest 404', answer.code === 404)
}

// ---- routes through the real handler ----

const store = createStore(path.join(tmp, 'studio'))

function fakeReq(url, { method = 'POST', body = {} } = {}) {
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
      const chunk = Buffer.from(JSON.stringify(body))
      pending.push(chunk)
      if (listeners.data) listeners.data(chunk)
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
async function call(handler, url, options) {
  const res = fakeRes()
  const req = fakeReq(url, options)
  const handled = handler(req, res)
  req.emitBody()
  await handled
  return res
}

{
  const bare = createHandler(store, { get: () => undefined }, { root: store.root }, { libraryRoot: path.join(tmp, 'a', 'library') })
  const res = await call(bare, '/plugins/studio/sync/status', { method: 'GET' })
  check('status says unconfigured when no target', res.statusCode === 200 && res.body.configured === false, JSON.stringify(res.body))
  const pushed = await call(bare, '/plugins/studio/sync/push')
  check('push without config is 501 through the route', pushed.statusCode === 501)
}

{
  const api2 = fakeGithub()
  const configured = createHandler(store, { get: () => undefined }, { root: store.root }, {
    libraryRoot: path.join(tmp, 'a', 'library'),
    sync: { repo: 'me/mitsu-library', token: 'pat' },
    fetchImpl: api2.impl,
  })
  const status = await call(configured, '/plugins/studio/sync/status', { method: 'GET' })
  check('status names the configured target', status.body.configured === true && status.body.target === 'github', JSON.stringify(status.body))
  const pushed = await call(configured, '/plugins/studio/sync/push')
  check('push through the route reaches the remote', pushed.statusCode === 200 && api2.remote.content.includes('PROMPT'), JSON.stringify(pushed.body))
  const pulled = await call(configured, '/plugins/studio/sync/pull')
  check('pull through the route answers the content', pulled.statusCode === 200 && pulled.body.content.includes('PROMPT'))
}

// ---- the view: honest status, honest buttons ----

{
  const viewRoutes = [
    { match: '/plugins/studio/sync/status', respond: () => ({ body: { ok: true, configured: false, target: null } }) },
    { match: '/plugins/studio/library', respond: () => ({ body: { ok: true, recipes: [] } }) },
    { match: '/plugins/studio/projects/demo/sequences', respond: () => ({ body: { ok: true, sequences: [{ id: 's1' }] } }) },
    { match: '/plugins/studio/projects', respond: () => ({ body: { ok: true, projects: [{ id: 'demo', name: 'Demo', sequences: [{ id: 's1' }] }] } }) },
    { match: '/plugins/studio/projects/demo/sequences/s1', respond: () => ({ body: { ok: true, session: { schema: 1, sequence: 's1', stages: {}, shots: [] } } }) },
  ]
  const EN = {
    'library.title': 'Library', 'library.open': 'Library', 'library.recall': 'Recall',
    'library.empty': 'empty', 'library.filterAll': 'All kinds', 'library.rating': 'rating',
    'library.push': 'Push', 'library.pull': 'Pull', 'library.syncOff': 'Sync not configured — recipes stay local.',
    'library.syncReady': 'GitHub sync ready.', 'library.pushed': 'pushed', 'library.pulled': 'pulled',
  }
  const instance = (await import('./harness.mjs')).createReact()
  const harness = await import('./harness.mjs')
  const { exports: exports_ } = await harness.loadClient({ routes: viewRoutes, react: instance.React, primitives: {} })
  const { ctx, seen } = harness.recordingCtx(EN)
  exports_.apply(ctx)
  const pane = seen.slots.find((s) => s.options.name === 'sidebar.right.pane.tab')
  const t2 = (key) => EN[key] || key
  instance.run(pane.component, { t: t2 })
  await harness.settle(instance)
  let tree = instance.run(pane.component, { t: t2 })
  const openLibrary = harness.collect(tree, (n) => n.props && n.props['data-studio'] === 'library-open')[0]
  if (openLibrary && openLibrary.props.onClick) {
    openLibrary.props.onClick()
    await harness.settle(instance)
    tree = instance.run(pane.component, { t: t2 })
    harness.textOf(tree)
    await harness.settle(instance)
    tree = instance.run(pane.component, { t: t2 })
  }
  const statusLine = harness.collect(tree, (n) => n.props && n.props['data-studio'] === 'sync-status')[0]
  check('the view states the unconfigured truth', statusLine && harness.textOf(statusLine).includes('Sync not configured'), statusLine && harness.textOf(statusLine))
  check('push and pull buttons draw', !!harness.collect(tree, (n) => n.props && n.props['data-studio'] === 'sync-push').length && !!harness.collect(tree, (n) => n.props && n.props['data-studio'] === 'sync-pull').length)
}

await fsp.rm(tmp, { recursive: true, force: true })
console.log(failures ? '\n' + failures + ' failure(s)' : '\nsync ok')
process.exit(failures ? 1 : 0)
