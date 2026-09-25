/**
 * verify:models — the Krea models, asserted rather than intended.
 *
 * The claim: **a Krea model is a card and a surface like any other unit.** The shipped
 * catalogue is Krea's own documented schema (`POST /generate/image/krea/krea-2/medium`,
 * `.../large` and `.../medium-turbo`, read 2026-09-23), the profile's
 * `_models.json` adds or overrides one, and the Krea
 * provider serves both through the list route and the surface route the pane already
 * reads — so the pane needed no change to gain a model.
 *
 * THE HOST HALF IS DRIVEN FOR REAL: `lib/providers.js` is imported and its `krea` provider
 * is asked the two questions the routes ask it, against temp directories. Nothing here
 * talks to Krea, spends a credit, or needs a key.
 *
 * Two rules are checked that a card alone would not show. A door the API would refuse is
 * refused here by name (a select with no options, a default outside its own bounds), and a
 * malformed profile model is SKIPPED rather than allowed to empty the section — the
 * shipped models stay drawable, and the reason travels with the answer.
 *
 *   node verify/models.mjs
 */
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')

const {
  KREA_MODELS_FILE,
  KREA_MODELS_SCHEMA,
  SHIPPED_KREA_MODELS,
  modelEntry,
  modelSurface,
  normalizeModels,
  readKreaModels,
} = await import(pathToFileURL(join(ROOT, 'lib/krea-models.js')).href)
const { krea } = await import(pathToFileURL(join(ROOT, 'lib/providers.js')).href)

// ── reporter (the same shape as the plugin's other suites) ───────────────────

const rows = []
const check = (label, ok, detail) => rows.push({ label, status: ok ? 'pass' : 'fail', detail: detail == null ? '' : String(detail) })

function finish() {
  let failed = 0
  process.stdout.write('\nverify:models — the Krea models (one card and one surface per model)\n')
  for (const row of rows) {
    if (row.status === 'pass') continue
    if (row.status === 'fail') failed += 1
    process.stdout.write('  FAIL  ' + row.label + (row.detail ? '  —  ' + row.detail : '') + '\n')
  }
  const passes = rows.filter((row) => row.status === 'pass').length
  process.stdout.write('  ' + passes + '/' + rows.length + ' passed\n')
  if (failed > 0) process.exitCode = 1
}

// ── fixtures ─────────────────────────────────────────────────────────────────

/** A profile-shaped temp root: the data directory, its `_models.json`, its adapters. */
function fixture({ models = null, adapters = null } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'krea-models-'))
  if (models !== null) {
    writeFileSync(join(root, KREA_MODELS_FILE), typeof models === 'string' ? models : JSON.stringify(models, null, 2))
  }
  const dir = join(root, 'adapters')
  if (adapters !== null) {
    mkdirSync(dir, { recursive: true })
    for (const [file, body] of Object.entries(adapters)) writeFileSync(join(dir, file), JSON.stringify(body, null, 2))
  }
  return { root, dir }
}

/** One installable RunningHub adapter, only as valid as `listAdapters` requires. */
const INSTALLED = {
  schema: 'muen-rh-adapter/v1',
  name: 'krea2-face-swap',
  title: 'Krea 2 Face Swap',
  origin: 'mine',
  source: { kind: 'webapp', appId: '2072445848017002498', webappName: 'krea2 raw turbo dual mining' },
  doors: { image: { nodeId: '1', fieldName: 'image', type: 'image', label: 'Image' } },
  ui: { runLabel: 'Generate', order: ['image'] },
  provenance: { writtenBy: 'agent', at: '2026-09-23T00:00:00.000Z', checkedAgainst: 'apiCallDemo', dryRun: 'ok' },
}

const ASPECTS = ['1:1 (Square)', '4:3 (Standard)', '3:2 (Photo)', '16:9 (Widescreen)', '2.35:1 (Cinematic)', '4:5 (Portrait)', '3:4 (Portrait Standard)', '2:3 (Portrait Photo)', '9:16 (Portrait Widescreen)']

// ── the shipped catalogue: Krea's own schema ─────────────────────────────────

const shipped = SHIPPED_KREA_MODELS
const medium = shipped.find((model) => model.name === 'krea-2-medium')
const large = shipped.find((model) => model.name === 'krea-2-large')
const turbo = shipped.find((model) => model.name === 'krea-2-medium-turbo')

check(
  "the founder's three models are shipped, under the names his SDK calls use",
  !!medium &&
    medium.model === 'image/krea/krea-2/medium' &&
    medium.endpoint === '/generate/image/krea/krea-2/medium' &&
    !!large &&
    large.model === 'image/krea/krea-2/large' &&
    large.endpoint === '/generate/image/krea/krea-2/large' &&
    !!turbo &&
    turbo.model === 'image/krea/krea-2/medium-turbo' &&
    turbo.endpoint === '/generate/image/krea/krea-2/medium-turbo',
  JSON.stringify(shipped.map((model) => ({ model: model.model, endpoint: model.endpoint }))),
)
check(
  "the list reads in the founder's order: Turbo, Medium, Large",
  shipped.map((model) => model.name).join(',') === 'krea-2-medium-turbo,krea-2-medium,krea-2-large',
  JSON.stringify(shipped.map((model) => model.name)),
)
check(
  'the three variants carry the same request shape, which is why one schema serves all of them',
  !!medium &&
    !!large &&
    !!turbo &&
    JSON.stringify(medium.doors) === JSON.stringify(large.doors) &&
    JSON.stringify(large.doors) === JSON.stringify(turbo.doors),
  JSON.stringify(shipped.map((model) => [model.name, Object.keys(model.doors).length])),
)
check(
  'the shipped card copy is Krea\'s own, name and description both',
  !!medium &&
    medium.title === 'Krea 2 Medium' &&
    medium.blurb === 'A smaller variant of Krea 2. Works best with illustrations and graphic design.' &&
    !!large &&
    large.title === 'Krea 2 Large' &&
    large.blurb === 'More powerful version of Krea 2 optimized for expressive photorealism.' &&
    !!turbo &&
    turbo.title === 'Krea 2 Turbo' &&
    turbo.blurb === 'The fastest Krea 2 model. Best for quickly iterating on expressive illustrations.',
  JSON.stringify(shipped.map((model) => [model.title, model.blurb])),
)
check(
  'the shipped list obeys its own rules',
  (() => {
    const { models, problems } = normalizeModels({ schema: KREA_MODELS_SCHEMA, models: shipped })
    return problems.length === 0 && models.length === shipped.length
  })(),
  JSON.stringify(normalizeModels({ schema: KREA_MODELS_SCHEMA, models: shipped }).problems),
)

const doors = (turbo && turbo.doors) || {}
check(
  'the three doors the API requires are doors here, and the prompt is the primary one',
  doors.prompt?.type === 'text' &&
    doors.prompt.primary === true &&
    doors.prompt.required === true &&
    doors.prompt.multiline === true &&
    doors.aspect_ratio?.type === 'select' &&
    doors.aspect_ratio.required === true &&
    doors.resolution?.required === true,
  JSON.stringify(['prompt', 'aspect_ratio', 'resolution'].map((key) => [key, doors[key] && doors[key].type])),
)
check(
  "the aspect ratios are the API's own nine, in its order, starting where it starts",
  JSON.stringify(doors.aspect_ratio?.options) === JSON.stringify(ASPECTS) && doors.aspect_ratio.default === '1:1 (Square)',
  JSON.stringify(doors.aspect_ratio && doors.aspect_ratio.options),
)
check(
  'resolution is the one value Krea 2 documents',
  JSON.stringify(doors.resolution?.options) === JSON.stringify(['1K']) && doors.resolution.default === '1K',
  JSON.stringify(doors.resolution && doors.resolution.options),
)
check(
  "creativity carries all four modes and THIS variant's own default",
  JSON.stringify(doors.creativity?.options) === JSON.stringify(['raw', 'low', 'medium', 'high']) && doors.creativity.default === 'low',
  JSON.stringify([doors.creativity && doors.creativity.options, doors.creativity && doors.creativity.default]),
)
check(
  'the three generative sliders are integers from -100 to 100, neutral at 0',
  ['intensity', 'complexity', 'movement'].every(
    (key) => doors[key]?.type === 'number' && doors[key].min === -100 && doors[key].max === 100 && doors[key].step === 1 && doors[key].default === 0,
  ),
  JSON.stringify(['intensity', 'complexity', 'movement'].map((key) => doors[key] && [doors[key].min, doors[key].max, doors[key].default])),
)
check(
  'image_url is an image door and strength is the denoising default the API declares',
  doors.image_url?.type === 'image' &&
    doors.strength?.type === 'number' &&
    doors.strength.min === 0 &&
    doors.strength.max === 1 &&
    doors.strength.default === 0.99,
  JSON.stringify({ image_url: doors.image_url && doors.image_url.type, strength: doors.strength && doors.strength.default }),
)
check(
  'the three array fields are lists now, each row carrying the doors Krea requires of it',
  (() => {
    const styles = doors.styles
    const srefs = doors.image_style_references
    const boards = doors.moodboards
    return (
      styles?.type === 'list' &&
      styles.fields?.id?.type === 'text' &&
      styles.fields.id.required === true &&
      styles.fields?.strength?.type === 'number' &&
      styles.fields.strength.required === true &&
      styles.fields.strength.min === -2 &&
      styles.fields.strength.max === 2 &&
      // Krea's own maxItems, so the surface stops adding rows where the API stops taking them.
      srefs?.type === 'list' &&
      srefs.max === 10 &&
      srefs.fields?.url?.type === 'image' &&
      srefs.fields.url.required === true &&
      srefs.fields?.strength?.default === 0.5 &&
      boards?.type === 'list' &&
      boards.max === 1 &&
      boards.fields?.id?.required === true &&
      boards.fields?.strength?.default === 0.23
    )
  })(),
  JSON.stringify(['styles', 'image_style_references', 'moodboards'].map((key) => doors[key] && [doors[key].type, doors[key].max, Object.keys(doors[key].fields || {})])),
)
check(
  'every door is labelled, because a raw field name is not a label',
  Object.entries(doors).every(([, door]) => typeof door.label === 'string' && door.label.trim() !== ''),
  JSON.stringify(Object.entries(doors).filter(([, door]) => !door.label).map(([key]) => key)),
)
check(
  'the door list is longer than the four a surface opens on, and the tuning doors sit behind the disclosure',
  Object.keys(doors).length === 13 && Object.values(doors).filter((door) => door.advanced === true).length === 9,
  JSON.stringify({ doors: Object.keys(doors).length, advanced: Object.values(doors).filter((door) => door.advanced).length }),
)

// ── the two shapes the pane reads ────────────────────────────────────────────

check(
  'a model lists as the card the pane already draws',
  (() => {
    const entry = modelEntry(turbo)
    return (
      entry.name === 'krea-2-medium-turbo' &&
      entry.title === 'Krea 2 Turbo' &&
      // The tab's short name, authored on the model (founder, 2026-09-25: *"use different
      // names … Krea Turbo / Krea Medium / Krea Large"*): the card keeps the title.
      entry.tabLabel === 'Krea Turbo' &&
      entry.doorCount === 13 &&
      entry.runLabel === 'Generate' &&
      entry.blurb.length > 0
    )
  })(),
  JSON.stringify(modelEntry(turbo)),
)
check(
  'the second model lists as a card of its own, so the section draws a card per model',
  (() => {
    const entry = modelEntry(medium)
    return (
      entry.name === 'krea-2-medium' &&
      entry.title === 'Krea 2 Medium' &&
      entry.variant === 'Medium' &&
      entry.doorCount === 13 &&
      entry.runLabel === 'Generate' &&
      entry.origin === 'krea' &&
      entry.blurb.length > 0
    )
  })(),
  JSON.stringify(modelEntry(medium)),
)
check(
  'a model opens as the surface the pane already renders: order, doors, and the two facts S5 needs',
  (() => {
    const surface = modelSurface(turbo)
    return (
      JSON.stringify(surface.order) === JSON.stringify(Object.keys(doors)) &&
      surface.doors === doors &&
      surface.model === 'image/krea/krea-2/medium-turbo' &&
      surface.endpoint === '/generate/image/krea/krea-2/medium-turbo'
    )
  })(),
  JSON.stringify({ order: modelSurface(turbo).order, endpoint: modelSurface(turbo).endpoint }),
)
check(
  'the second model opens the same way, with its own endpoint',
  (() => {
    const surface = modelSurface(medium)
    return (
      JSON.stringify(surface.order) === JSON.stringify(Object.keys(medium.doors)) &&
      surface.doors === medium.doors &&
      surface.model === 'image/krea/krea-2/medium' &&
      surface.endpoint === '/generate/image/krea/krea-2/medium' &&
      surface.runnable === true
    )
  })(),
  JSON.stringify({ order: modelSurface(medium).order, endpoint: modelSurface(medium).endpoint }),
)
check(
  'every shipped model draws as a card and opens as its own runnable surface',
  shipped.every((model) => {
    const entry = modelEntry(model)
    const surface = modelSurface(model)
    return (
      entry.name === model.name &&
      entry.title === model.title &&
      entry.doorCount === 13 &&
      entry.runLabel === 'Generate' &&
      entry.origin === 'krea' &&
      entry.blurb.length > 0 &&
      JSON.stringify(surface.order) === JSON.stringify(Object.keys(model.doors)) &&
      surface.doors === model.doors &&
      surface.model === model.model &&
      surface.endpoint === model.endpoint &&
      surface.runnable === true
    )
  }),
  JSON.stringify(shipped.map((model) => [modelEntry(model).name, modelSurface(model).endpoint])),
)

// ── the provider: the catalogue and the provider's own adapters, one list ────

const bare = mkdtempSync(join(tmpdir(), 'krea-bare-'))
const bareList = await krea.listWorkflows({ dir: join(bare, 'adapters'), root: bare })
check(
  'with nothing on disk the Krea section holds every shipped model, and a missing directory is not an error',
  bareList.entries.length === 3 &&
    bareList.entries.map((entry) => entry.name).join(',') === 'krea-2-medium-turbo,krea-2-medium,krea-2-large' &&
    bareList.skipped.length === 0,
  JSON.stringify({ entries: bareList.entries.map((entry) => entry.name), skipped: bareList.skipped }),
)

const withAdapter = fixture({ adapters: { 'krea2-face-swap.json': INSTALLED } })
const mixed = await krea.listWorkflows({ dir: withAdapter.dir, root: withAdapter.root })
check(
  'an adapter installed under Krea is merged with the catalogue, every shipped model drawn as a card',
  mixed.entries.map((entry) => entry.name).sort().join(',') === 'krea-2-large,krea-2-medium,krea-2-medium-turbo,krea2-face-swap',
  JSON.stringify(mixed.entries.map((entry) => entry.name)),
)
check(
  'the catalogue comes first, so a documented model is not buried under a file',
  mixed.entries[0].name === 'krea-2-medium-turbo' &&
    mixed.entries[1].name === 'krea-2-medium' &&
    mixed.entries[2].name === 'krea-2-large' &&
    mixed.entries[3].name === 'krea2-face-swap',
  JSON.stringify(mixed.entries.map((entry) => entry.name)),
)

const readTurbo = await krea.readWorkflow({ dir: withAdapter.dir, root: withAdapter.root, name: 'krea-2-medium-turbo' })
const readMedium = await krea.readWorkflow({ dir: withAdapter.dir, root: withAdapter.root, name: 'krea-2-medium' })
const readLarge = await krea.readWorkflow({ dir: withAdapter.dir, root: withAdapter.root, name: 'krea-2-large' })
const readInstalled = await krea.readWorkflow({ dir: withAdapter.dir, root: withAdapter.root, name: 'krea2-face-swap' })
const readMissing = await krea.readWorkflow({ dir: withAdapter.dir, root: withAdapter.root, name: 'no-such-thing' })
check(
  "each shipped model opens through the provider's read route, and carries its own doors",
  !!readTurbo.adapter &&
    readTurbo.adapter.name === 'krea-2-medium-turbo' &&
    readTurbo.adapter.doors === doors &&
    !!readMedium.adapter &&
    readMedium.adapter.name === 'krea-2-medium' &&
    readMedium.adapter.doors === medium.doors &&
    !!readLarge.adapter &&
    readLarge.adapter.name === 'krea-2-large' &&
    readLarge.adapter.doors === large.doors,
  JSON.stringify(shipped.map((model) => [model.name, Object.keys(model.doors).length])),
)
check(
  'a name that is a file still reads as a file, so the two kinds share one route',
  !!readInstalled.adapter && readInstalled.adapter.name === 'krea2-face-swap' && readInstalled.adapter.title === 'Krea 2 Face Swap',
  JSON.stringify(readInstalled.adapter && readInstalled.adapter.name),
)
check(
  'a name that is neither is not-found, not an empty surface',
  readMissing.error === 'not-found',
  JSON.stringify(readMissing),
)

// ── the profile layer ────────────────────────────────────────────────────────

const own = {
  schema: KREA_MODELS_SCHEMA,
  models: [
    {
      name: 'my-krea-model',
      title: 'My Krea model',
      blurb: 'A model this profile ships itself.',
      model: 'image/krea/my-model',
      endpoint: '/generate/image/krea/my-model',
      doors: {
        prompt: { type: 'text', label: 'Prompt', multiline: true, primary: true, required: true },
        aspect_ratio: { type: 'select', label: 'Aspect ratio', options: ['1:1', '16:9'], default: '1:1' },
      },
      ui: { runLabel: 'Generate', order: ['prompt', 'aspect_ratio'] },
    },
    {
      name: 'krea-2-medium-turbo',
      title: 'Turbo, my name for it',
      model: 'image/krea/krea-2/medium-turbo',
      endpoint: '/generate/image/krea/krea-2/medium-turbo',
      doors: { prompt: { type: 'text', label: 'Prompt' } },
    },
  ],
}
const layered = fixture({ models: own })
const layeredRead = await readKreaModels(layered.root)
check(
  'the profile adds a model of its own, and all three shipped models are still there',
  layeredRead.models.map((model) => model.name).sort().join(',') ===
    'krea-2-large,krea-2-medium,krea-2-medium-turbo,my-krea-model' &&
    layeredRead.skipped.length === 0,
  JSON.stringify({ models: layeredRead.models.map((model) => model.name), skipped: layeredRead.skipped }),
)
check(
  'a profile entry with the same name replaces the shipped one, later winning per name',
  layeredRead.models.find((model) => model.name === 'krea-2-medium-turbo').title === 'Turbo, my name for it',
  JSON.stringify(layeredRead.models.find((model) => model.name === 'krea-2-medium-turbo')),
)
const layeredList = await krea.listWorkflows({ dir: join(layered.root, 'adapters'), root: layered.root })
check(
  'the added model reaches the pane through the same list, with its own door count',
  layeredList.entries.some((entry) => entry.name === 'my-krea-model' && entry.doorCount === 2),
  JSON.stringify(layeredList.entries.map((entry) => entry.name)),
)

const wrongSchema = fixture({ models: { schema: 'something-else/v9', models: [own.models[0]] } })
const wrongRead = await readKreaModels(wrongSchema.root)
check(
  'a file from another schema is refused by name, and the shipped models still draw',
  wrongRead.models.length === 3 && wrongRead.skipped.length === 1 && String(wrongRead.skipped[0].reason).includes(KREA_MODELS_SCHEMA),
  JSON.stringify(wrongRead.skipped),
)

const broken = fixture({
  models: {
    schema: KREA_MODELS_SCHEMA,
    models: [
      { name: 'no-options', title: 'No options', model: 'm', endpoint: '/e', doors: { pick: { type: 'select', label: 'Pick' } } },
      { name: 'out-of-bounds', title: 'Out of bounds', model: 'm2', endpoint: '/e2', doors: { n: { type: 'number', label: 'N', min: 0, max: 1, default: 5 } } },
      { name: 'no-label', title: 'No label', model: 'm3', endpoint: '/e3', doors: { t: { type: 'text' } } },
      { name: 'bad-order', title: 'Bad order', model: 'm4', endpoint: '/e4', doors: { t: { type: 'text', label: 'T' } }, ui: { order: ['t', 'ghost'] } },
      { name: 'fine', title: 'Fine', model: 'm5', endpoint: '/e5', doors: { t: { type: 'text', label: 'T', multiline: true } }, ui: { order: ['t'] } },
    ],
  },
})
const brokenRead = await readKreaModels(broken.root)
check(
  'a door the API would refuse is refused here: no options, a default outside its bounds, no label, an order naming nothing',
  brokenRead.skipped.length === 4 &&
    brokenRead.skipped.some((row) => row.reason.includes('select with no options')) &&
    brokenRead.skipped.some((row) => row.reason.includes('above its maximum')) &&
    brokenRead.skipped.some((row) => row.reason.includes('label is required')) &&
    brokenRead.skipped.some((row) => row.reason.includes('ui.order names')),
  JSON.stringify(brokenRead.skipped.map((row) => row.reason)),
)
check(
  'one broken model does not take the others down',
  brokenRead.models.map((model) => model.name).sort().join(',') === 'fine,krea-2-large,krea-2-medium,krea-2-medium-turbo',
  JSON.stringify(brokenRead.models.map((model) => model.name)),
)

const invalid = fixture({ models: '{ not json' })
const invalidRead = await readKreaModels(invalid.root)
check(
  'a file that is not JSON is one skipped entry, and the shipped models still draw',
  invalidRead.models.length === 3 && invalidRead.skipped.length === 1 && invalidRead.skipped[0].reason === 'invalid-json',
  JSON.stringify(invalidRead.skipped),
)
check(
  'the skipped rows carry the file name and a reason, the way a broken adapter file does',
  invalidRead.skipped.every((row) => row.file === KREA_MODELS_FILE && typeof row.reason === 'string' && row.reason !== ''),
  JSON.stringify(invalidRead.skipped),
)
const invalidList = await krea.listWorkflows({ dir: join(invalid.root, 'adapters'), root: invalid.root })
check(
  "the provider reports the profile layer's problems on its own list route, rather than dropping them",
  invalidList.skipped.length === 1 && invalidList.entries.length === 3,
  JSON.stringify(invalidList.skipped),
)

// A root that does not exist yet is the fresh-install case: readKreaModels must not
// throw, because the route is called before anything is linked.
const goneRead = await readKreaModels(join(tmpdir(), 'krea-models-that-are-not-there'))
check(
  'no data directory at all is the fresh install, not a failure',
  goneRead.models.length === 3 && goneRead.skipped.length === 0,
  JSON.stringify(goneRead.skipped),
)

finish()
