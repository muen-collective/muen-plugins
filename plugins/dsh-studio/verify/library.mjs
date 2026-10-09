/**
 * The recipe library (M10): recipes carry the FULL payload, stars are 0–5, and
 * Recall answers a recipe whole. The acceptance: star a take → a library row
 * with the full recipe; recall a 5-star recipe into the desk → the payload
 * matches what produced it.
 */
import { promises as fsp } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { createLibrary, recipeFromTake, validRating } from '../lib/library.js'
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

check('ratings are 0–5 integers', validRating(3) === 3 && validRating(0) === 0 && validRating(6) === null && validRating('4') === 4 && validRating(-1) === null && validRating(2.5) === null)

const shot = { id: 's01', prompt: 'A precise prompt.', duration_s: 5 }
const take = { provider: 'runninghub', job: 'j1', index: 0 }
const recipe = recipeFromTake(shot, take, { look: 'maid', refs: ['mitsu'], workflow: 'h3-app' })
check('a recipe records the full payload', recipe.recipe.prompt === 'A precise prompt.' && recipe.recipe.params.duration_s === 5 && recipe.recipe.params.workflow === 'h3-app' && recipe.recipe.look === 'maid', JSON.stringify(recipe))
check('refs ride along', recipe.recipe.refs.join(',') === 'mitsu')
check('seed is recorded when known', recipeFromTake(shot, take, { seed: 42 }).recipe.seed === 42)

// ---- the store ----

const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'dsh-studio-library-'))
const library = createLibrary(path.join(tmp, 'library'))
{
  const res = await library.upsert(recipe)
  check('upsert stores a recipe', res.ok && res.recipe.id === 'r-j1')
}
{
  const res = await library.upsert({ id: 'r-j2', kind: 'video', provider: 'runninghub', jobId: 'j2', recipe: { prompt: 'Second.', params: {} }, rating: 5, tags: ['hero'] })
  check('a 5-star recipe stores', res.ok && res.recipe.rating === 5)
}
{
  const res = await library.upsert({ id: 'r-bad', recipe: { prompt: 'x' }, rating: 9 })
  check('a rating outside 0–5 is refused', res.code === 400)
}
{
  const res = await library.upsert({ id: 'r-bad2', recipe: {} })
  check('a recipe without a prompt is refused', res.code === 400)
}
{
  const all = await library.list()
  check('list answers everything', all.recipes.length === 2)
  const starred = await library.list({ minRating: 5 })
  check('min rating filters', starred.recipes.length === 1 && starred.recipes[0].id === 'r-j2', JSON.stringify(starred.recipes.map((r) => r.id)))
  const tagged = await library.list({ tag: 'hero' })
  check('tags filter', tagged.recipes.length === 1 && tagged.recipes[0].id === 'r-j2')
  const kind = await library.list({ kind: 'image' })
  check('kind filters', kind.recipes.length === 0)
}
{
  const res = await library.rate('r-j1', 4)
  check('rate changes one field', res.ok && res.recipe.rating === 4 && res.recipe.recipe.prompt === 'A precise prompt.')
  const got = await library.get('r-j1')
  check('recall answers the recipe whole', got.ok && got.recipe.recipe.params.workflow === 'h3-app')
  check('rating an unknown recipe is 404', (await library.rate('ghost', 3)).code === 404)
}

// ---- routes through the real handler ----

const store = createStore(path.join(tmp, 'studio'))
const handler = createHandler(store, { get: () => undefined }, { root: store.root }, { libraryRoot: path.join(tmp, 'library') })

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
async function call(url, options) {
  const res = fakeRes()
  const req = fakeReq(url, options)
  const handled = handler(req, res)
  req.emitBody()
  await handled
  return res
}

{
  const res = await call('/plugins/studio/library?min=4', { method: 'GET' })
  check('GET /library filters through the query', res.statusCode === 200 && res.body.recipes.length === 2, JSON.stringify(res.body.recipes.map((r) => r.id)))
}
{
  const res = await call('/plugins/studio/library?min=5', { method: 'GET' })
  check('the query carries min stars', res.body.recipes.length === 1 && res.body.recipes[0].id === 'r-j2')
}
{
  const res = await call('/plugins/studio/library/r-j1/rate', { body: { rating: 5 } })
  check('POST rate works through the route', res.statusCode === 200 && res.body.recipe.rating === 5)
}
{
  const res = await call('/plugins/studio/library/r-j1/rate', { body: { rating: 12 } })
  check('an out-of-range rating is refused', res.statusCode === 400)
}

// ---- the view: star a take, browse, recall into the desk ----

const posts = []
const listed = []
const viewRoutes = [
  { match: '/plugins/studio/library', respond: (call2) => {
      if (call2.method === 'POST') {
        posts.push(call2.body)
        return { body: { ok: true, recipe: call2.body } }
      }
      listed.push(call2.url)
      return { body: { ok: true, recipes: [{ id: 'r-j9', kind: 'video', provider: 'runninghub', rating: 5, tags: [], recipe: { prompt: 'FIVE STAR PROMPT', params: { duration_s: 5, workflow: 'h3-app' }, look: 'maid', refs: [] } }] } }
    } },
  { match: '/plugins/studio/projects/demo/sequences/s1/shots', respond: () => ({ body: { ok: true, prompt: 'FIVE STAR PROMPT', drift: [] } }) },
  { match: '/plugins/studio/projects/demo/characters', respond: () => ({ body: { ok: true, characters: [{ id: 'mitsu', name: 'Mitsu' }] } }) },
  { match: '/plugins/studio/projects/demo/outfits', respond: () => ({ body: { ok: true, records: [{ id: 'maid', name: 'Maid' }] } }) },
  { match: '/plugins/studio/projects/demo/scenes', respond: () => ({ body: { ok: true, records: [] } }) },
  { match: '/plugins/studio/projects/demo/sequences/s1', respond: (call2) => {
      if (call2.method === 'PUT') return { body: { ok: true, session: call2.body } }
      return { body: { ok: true, session: {
        schema: 1, project: 'demo', sequence: 's1',
        stages: Object.fromEntries(['character', 'outfit', 'scene', 'script', 'shoot', 'timeline'].map((k) => [k, { status: 'empty', gate: null }])),
        shots: [{ id: 's01', beat: 'One', camera: 'wide', duration_s: 5, assets: [], prompt: 'FIVE STAR PROMPT', look: null, gate: null, selects: [], takes: [{ provider: 'runninghub', job: 'j9', index: 0, url: '/r' }] }],
      } } }
    } },
  { match: '/plugins/studio/projects/demo/sequences', respond: () => ({ body: { ok: true, sequences: [{ id: 's1' }] } }) },
  { match: '/plugins/studio/projects', respond: () => ({ body: { ok: true, projects: [{ id: 'demo', name: 'Demo', sequences: [{ id: 's1' }] }] } }) },
]

const EN = {
  'library.title': 'Library',
  'library.open': 'Library',
  'library.recall': 'Recall',
  'library.empty': 'Star a take.',
  'library.filterAll': 'All kinds',
  'library.rating': 'rating',
  'stage.shoot': 'Shoot',
  'shoot.character': 'Character',
  'shoot.look': 'Outfit',
  'shoot.scene': 'Scene',
  'shoot.generate': 'Generate',
  'shoot.runAll': 'Run all',
  'shoot.select': 'Select',
  'shoot.takes': 'Takes',
  'shoot.noTakes': 'No takes yet.',
  'shoot.prompt': 'prompt',
  'run.composing': 'Composing…',
  'run.preflight': 'Preflight…',
  'run.running': 'Running…',
}

const instance = createReact()
const { exports: exports_ } = await loadClient({ routes: viewRoutes, react: instance.React, primitives: {} })
const { ctx, seen } = recordingCtx(EN)
exports_.apply(ctx)
const pane = seen.slots.find((s) => s.options.name === 'sidebar.right.pane.tab')
const t2 = (key) => EN[key] || key

instance.run(pane.component, { t: t2 })
await settle(instance)
let tree = instance.run(pane.component, { t: t2 })

// open the shoot desk and star the take
const shootCard = collect(tree, (n) => n.props && n.props['data-studio-stage'] === 'shoot')[0]
if (shootCard && shootCard.props.onClick) {
  shootCard.props.onClick()
  await settle(instance)
  tree = instance.run(pane.component, { t: t2 })
  textOf(tree)
  await settle(instance)
  tree = instance.run(pane.component, { t: t2 })
}
const rateSelect = collect(tree, (n) => n.props && n.props['data-studio-take-rate'] === 'j9')[0]
check('the take carries a star control', !!rateSelect)
if (rateSelect && rateSelect.props.onChange) {
  rateSelect.props.onChange({ target: { value: '5' } })
  await settle(instance)
  tree = instance.run(pane.component, { t: t2 })
}
check('starring sends the FULL recipe', posts.length === 1 && posts[0].recipe.prompt === 'FIVE STAR PROMPT' && posts[0].recipe.params.duration_s === 5 && posts[0].rating === 5 && Array.isArray(posts[0].recipe.refs) && 'look' in posts[0].recipe, JSON.stringify(posts))

// browse the library
const back = collect(tree, (n) => n.props && n.props['data-studio'] === 'view-back')[0]
if (back && back.props.onClick) {
  back.props.onClick()
  await settle(instance)
  tree = instance.run(pane.component, { t: t2 })
}
const openLibrary = collect(tree, (n) => n.props && n.props['data-studio'] === 'library-open')[0]
check('the library opens from the pane', !!openLibrary)
if (openLibrary && openLibrary.props.onClick) {
  openLibrary.props.onClick()
  await settle(instance)
  tree = instance.run(pane.component, { t: t2 })
  textOf(tree)
  await settle(instance)
  tree = instance.run(pane.component, { t: t2 })
}
const rows = collect(tree, (n) => n.props && n.props['data-studio-recipe'] === 'r-j9')
check('the library row shows the recipe prompt', rows.length === 1 && textOf(rows[0]).includes('FIVE STAR PROMPT'), rows.length ? textOf(rows[0]) : 'none')
check('the browse query carries the filter', listed.some((u) => u.includes('min=0')), listed.join(','))

// recall into the desk
const recallBtn = collect(tree, (n) => n.props && n.props['data-studio-recipe-recall'] === 'r-j9')[0]
if (recallBtn && recallBtn.props.onClick) {
  recallBtn.props.onClick()
  await settle(instance)
  tree = instance.run(pane.component, { t: t2 })
  textOf(tree)
  await settle(instance)
  tree = instance.run(pane.component, { t: t2 })
}
const promptBox = collect(tree, (n) => n.props && n.props['data-studio'] === 'shoot-prompt')[0]
check('recall lands on the desk', !!collect(tree, (n) => n.props && n.props['data-studio'] === 'shoot').length)
check('and the payload matches the recipe', promptBox && String(promptBox.props.value) === 'FIVE STAR PROMPT', promptBox && String(promptBox.props.value))

await fsp.rm(tmp, { recursive: true, force: true })
console.log(failures ? '\n' + failures + ' failure(s)' : '\nlibrary ok')
process.exit(failures ? 1 : 0)
