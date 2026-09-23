/**
 * verify:adapter — Epic 61 S3's claims, asserted rather than intended.
 *
 *   "`rh_workflow_graph` reads a real app's doors; `rh_adapter_validate` passes a
 *    good adapter and fails one with a wrong `nodeId`, one with an unknown
 *    `fieldName`, and one whose `nodeId` exists but is paired with the wrong
 *    `fieldName`; an adapter missing a `ui` key still renders from the house
 *    style; the derived fields (`options`, `min`, `max`, `step`, `multiline`,
 *    `default`) match `fieldData`" — epic 61 §14, verbatim.
 *
 * THE HOST HALF IS DRIVEN FOR REAL. `lib/index.js` is imported, `apply()` mounts
 * its tools against a recording tools registry, and every case below goes through
 * those definitions with a stubbed RunningHub and a recording credentials seam.
 * The fetch payloads are trimmed copies of the committed S0 receipts
 * (`product/strategy/data/rh-probe/*.json` in dsh-mitsu), so the shapes here are
 * the shapes the live API returned, not shapes invented to make the code pass.
 *
 * The endpoint is the one the probe settled: `GET /api/webapp/apiCallDemo`. Two
 * doors on the Krea2 payload share `nodeId` `942` with different `fieldName`s,
 * which is why the pair — never the node id alone — is the door's identity.
 *
 *   node verify/adapter.mjs            all cases
 *   node verify/adapter.mjs --static   all cases (there is no live layer in S3 yet)
 */
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')

const {
  controlFor,
  deriveDoors,
  parseAppRef,
  parseFieldData,
} = await import(pathToFileURL(join(ROOT, 'lib/doors.js')).href)
const { SHIPPED_HOUSE, mergeHouse, loadHouse } = await import(pathToFileURL(join(ROOT, 'lib/house.js')).href)
const { ADAPTER_SCHEMA, adapterFromDoors, validateAdapter } = await import(pathToFileURL(join(ROOT, 'lib/adapter.js')).href)
const { resolveDataRoot, dataPaths } = await import(pathToFileURL(join(ROOT, 'lib/paths.js')).href)
const { apply } = await import(pathToFileURL(join(ROOT, 'lib/index.js')).href)

// ── reporter (the same shape as mount.mjs and wallet.mjs) ─────────────────────

const rows = []
const check = (label, ok, detail) =>
  rows.push({ label, status: ok ? 'pass' : 'fail', detail: detail == null ? '' : String(detail) })

function finish() {
  let failed = 0
  process.stdout.write('\nverify:adapter — Epic 61 S3 (the install flow)\n')
  for (const row of rows) {
    if (row.status === 'pass') continue
    if (row.status === 'fail') failed += 1
    process.stdout.write('  FAIL  ' + row.label + (row.detail ? '  —  ' + row.detail : '') + '\n')
  }
  const passes = rows.filter((row) => row.status === 'pass').length
  process.stdout.write('  ' + passes + '/' + rows.length + ' passed\n')
  if (failed > 0) process.exitCode = 1
}

// ── fixtures: the S0 receipts, trimmed ───────────────────────────────────────

/** `2072445848017002498` — Krea2 Claire, four doors, two of them on node 942. */
const KREA2 = {
  code: 0,
  msg: 'success',
  data: {
    descriptionEn: '<p>Krea2 Claire backend.&nbsp; Seed value</p>',
    accessEncrypted: false,
    webappName: 'Krea2 Claire',
    covers: [{ id: '2072445853805142017', url: 'https://rh-hk-images.example/cover.png' }],
    tags: [{ id: '1871151815242543198', name: '图生图', nameEn: 'Image-to-Image' }],
    nodeInfoList: [
      {
        nodeId: '951',
        nodeName: 'Text Multiline',
        fieldName: 'text',
        fieldData: '["STRING", {"default": "", "multiline": true, "dynamicPrompts": true}]',
        fieldType: 'STRING',
        description: 'text',
        descriptionEn: 'text',
      },
      {
        nodeId: '942',
        nodeName: 'ResolutionSelector',
        fieldName: 'aspect_ratio',
        fieldData:
          '["COMBO", {"default": "1:1 (Square)", "options": ["1:1 (Square)", "2:3 (Portrait Photo)", "3:2 (Photo)"], "tooltip": "The aspect ratio for the output dimensions."}]',
        fieldType: 'LIST',
        description: 'aspect_ratio',
        descriptionEn: 'aspect_ratio',
      },
      {
        nodeId: '942',
        nodeName: 'ResolutionSelector',
        fieldName: 'megapixels',
        fieldData:
          '["FLOAT", {"max": 16, "min": 0.1, "step": 0.1, "default": 1, "tooltip": "Target total megapixels. 1.0 MP ≈ 1024x1024 for square."}]',
        fieldType: 'FLOAT',
        description: 'megapixels',
        descriptionEn: 'megapixels',
      },
      {
        nodeId: '960',
        nodeName: 'DF_Integer',
        fieldName: 'Value',
        fieldData: '["FLOAT", {"max": 1.7976931348623157e308, "min": -1.7976931348623157e308, "step": 1, "default": 1, "forceInput": false}]',
        fieldType: 'FLOAT',
        description: 'Value',
        descriptionEn: 'Value',
      },
    ],
  },
}

/** `2071662900963532802` — Clothes extraction Claire: one IMAGE door, whose `fieldData` leads with an array. */
const CLOTHES = {
  code: 0,
  msg: 'success',
  data: {
    descriptionEn: null,
    accessEncrypted: false,
    webappName: 'Clothes extraction Claire',
    covers: [],
    tags: [],
    nodeInfoList: [
      {
        nodeId: '157',
        nodeName: 'LoadImage',
        fieldName: 'image',
        fieldData: '[["example.png", "None", "keep_this_dic"], {"image_upload": true}]',
        fieldType: 'IMAGE',
        description: 'image',
        descriptionEn: 'image',
      },
      {
        nodeId: '203',
        nodeName: 'Text Multiline',
        fieldName: 'text',
        fieldData: '["STRING", {"default": "", "multiline": true, "dynamicPrompts": true}]',
        fieldType: 'STRING',
        description: 'text',
        descriptionEn: 'text',
      },
    ],
  },
}

/** Stands in for a real key. Never a real one: this file is committed. */
const SECRET = 'test-key-0123456789abcdef0123456789abcdef'
const BASE = 'https://runninghub.test'

// ── fakes ────────────────────────────────────────────────────────────────────

/** A stubbed RunningHub: every request is recorded, and the key never leaks out. */
function stubFetch(payload, { status = 200, raw = undefined } = {}) {
  const calls = []
  const impl = async (url, options) => {
    calls.push({ url: String(url), options })
    return {
      ok: status >= 200 && status < 300,
      status,
      async text() {
        return raw !== undefined ? raw : JSON.stringify(payload)
      },
    }
  }
  impl.calls = calls
  return impl
}

/**
 * A stubbed RunningHub that answers per app id, read off the `webappId` the plugin
 * puts in the query. A URL-blind stub would let an adapter naming one app "pass"
 * against another app's doors, which is exactly the confusion the pair check
 * exists to catch.
 */
function stubRunningHub(byAppId) {
  const calls = []
  const impl = async (url, options) => {
    const text = String(url)
    calls.push({ url: text, options })
    const match = /webappId=(\d+)/.exec(text)
    const payload = (match && byAppId[match[1]]) || { code: 404, msg: 'no such app', data: null }
    return { ok: true, status: 200, async text() { return JSON.stringify(payload) } }
  }
  impl.calls = calls
  return impl
}

/** A recording credentials seam. The default `source` is the word the real seam uses. */
function fakeCredentials({ value = SECRET, writable = true, source = 'file' } = {}) {
  return {
    async describe() {
      return { configured: value !== undefined, source: value === undefined ? undefined : source, writable }
    },
    async resolve() {
      return value === undefined ? undefined : { value, source }
    },
    async set() {},
    async unset() {},
  }
}

/** A plugin context with whichever services the case needs. */
function recordingCtx({ credentials, tools, skills } = {}) {
  const services = {}
  if (credentials) services.credentials = credentials
  if (tools) services.tools = tools
  if (skills) services.skills = skills
  const effects = []
  const ctx = {
    get: (name) => services[name],
    effect: (fn) => {
      effects.push(fn())
    },
    inject: () => {},
    logger: { warn() {}, error() {} },
  }
  return { ctx, effects }
}

/** Mount the plugin and hand back its tool definitions. */
function mountTools({ credentials = fakeCredentials() } = {}) {
  const definitions = new Map()
  const toolsService = {
    register: (definition) => {
      definitions.set(definition.name, definition)
      return () => definitions.delete(definition.name)
    },
  }
  const { ctx } = recordingCtx({ credentials, tools: toolsService })
  apply(ctx, { base: BASE })
  return definitions
}

const GRAPH = 'rh_workflow_graph'
const VALIDATE = 'rh_adapter_validate'

const tmp = mkdtempSync(join(tmpdir(), 'rh-adapter-'))
const dataRoot = join(tmp, 'generate')
process.env.RH_DATA_DIR = dataRoot
process.env.DSH_HOME = join(tmp, 'dsh-home')

// ── 1. the app reference ─────────────────────────────────────────────────────

check('a founder-style app link yields its id and keeps the link', (() => {
  const ref = parseAppRef('https://www.runninghub.ai/app/2072445848017002498')
  return ref.appId === '2072445848017002498' && ref.url === 'https://www.runninghub.ai/app/2072445848017002498'
})(), JSON.stringify(parseAppRef('https://www.runninghub.ai/app/2072445848017002498')))

check('a bare id is accepted', parseAppRef('2072445848017002498').appId === '2072445848017002498')
check('a query parameter names the app', parseAppRef('https://www.runninghub.ai/x?webappId=2072445848017002498').appId === '2072445848017002498')
check('a short number is refused rather than guessed at', parseAppRef('123').error === 'unrecognized-link')
check('a non-link is refused', parseAppRef('https://example.com/hello').error === 'unrecognized-link')
check('an empty link says the link is missing', parseAppRef('   ').error === 'missing-link')

// ── 2. doors, derived from the app's own facts ────────────────────────────────

const house = mergeHouse(SHIPPED_HOUSE)
const kreaDoors = deriveDoors(KREA2.data.nodeInfoList, house)
const byField = (list, field) => list.find((door) => door.fieldName === field)

check('the Krea2 payload yields four doors', kreaDoors.length === 4, kreaDoors.map((door) => door.key).join(', '))
check('two doors on node 942 both survive, as distinct keys', (() => {
  const shared = kreaDoors.filter((door) => door.nodeId === '942')
  return shared.length === 2 && new Set(shared.map((door) => door.key)).size === 2
})(), kreaDoors.filter((d) => d.nodeId === '942').map((d) => d.key).join(', '))
check('the glossary labels the known field names', (() => {
  const expect = { text: 'Prompt', aspect_ratio: 'Aspect ratio', megapixels: 'Megapixels', Value: 'Seed' }
  return Object.entries(expect).every(([field, label]) => byField(kreaDoors, field).label === label)
})(), kreaDoors.map((door) => door.fieldName + '=' + door.label).join(', '))
check('every Krea2 label came from the glossary', kreaDoors.every((door) => door.fromGlossary === true))

const aspect = byField(kreaDoors, 'aspect_ratio')
check('a select door carries the app\'s own options, in order', (() => {
  const expected = ['1:1 (Square)', '2:3 (Portrait Photo)', '3:2 (Photo)']
  return aspect.type === 'select' && JSON.stringify(aspect.options) === JSON.stringify(expected)
})(), JSON.stringify(aspect.options))
check('the app\'s tooltip becomes the hint', aspect.hint === 'The aspect ratio for the output dimensions.', aspect.hint)
check('the app\'s default is copied', aspect.default === '1:1 (Square)', String(aspect.default))

const mega = byField(kreaDoors, 'megapixels')
check('a number door carries min, max, step and default exactly as the app declares them', (() => {
  return mega.type === 'number' && mega.min === 0.1 && mega.max === 16 && mega.step === 0.1 && mega.default === 1
})(), JSON.stringify({ min: mega.min, max: mega.max, step: mega.step, default: mega.default }))

const textDoor = byField(kreaDoors, 'text')
check('multiline comes from fieldData', textDoor.type === 'text' && textDoor.multiline === true)
check('a seed is advanced by the house default', byField(kreaDoors, 'Value').advanced === true)
check('the fieldData string is kept verbatim', textDoor.fieldData === KREA2.data.nodeInfoList[0].fieldData)
check('doors within the main-screen budget are marked, and the seed is not', (() => {
  return textDoor.mainDoor === true && aspect.mainDoor === true && byField(kreaDoors, 'Value').mainDoor === undefined
})())

const clothesDoors = deriveDoors(CLOTHES.data.nodeInfoList, house)
const imageDoor = byField(clothesDoors, 'image')
check('an IMAGE door whose fieldData leads with an array still reads as an image', imageDoor.type === 'image', String(imageDoor.type))
check('the adapter puts focus on the image door, not on the prompt', (() => {
  const adapter = adapterFromDoors({ app: { ...CLOTHES.data, appId: '2071662900963532802', doors: clothesDoors, cover: null, tags: [] }, house })
  return adapter.doors.image.primary === true && adapter.doors.prompt.primary === undefined
})(), JSON.stringify(adapterFromDoors({ app: { ...CLOTHES.data, appId: '2071662900963532802', doors: clothesDoors, cover: null, tags: [] }, house }).doors))

const unknown = deriveDoors(
  [{ nodeId: '42', nodeName: 'X', fieldName: 'some_new_knob', fieldData: '["FLOAT", {"min": 0, "max": 1, "default": 0.5}]', fieldType: 'FLOAT' }],
  house,
)
check('an unrecognised field name is title-cased and marked unpolished', unknown[0].label === 'Some new knob' && unknown[0].fromGlossary === false, unknown[0].label)
check('an unrenderable type is reported rather than guessed', (() => {
  const doors = deriveDoors([{ nodeId: '7', fieldName: 'flag', fieldType: 'BOOLEAN', fieldData: '["BOOLEAN", {}]' }], house)
  return doors[0].type === null && doors[0].supported === false
})())
check('a door without a pair is dropped', deriveDoors([{ nodeId: '9' }], house).length === 0)

// ── 3. controlFor and parseFieldData, on the shapes the API actually returns ──

check('parseFieldData reads a JSON string', parseFieldData('["FLOAT", {"min": 1}]').kind === 'FLOAT')
check('parseFieldData survives an unreadable string', parseFieldData('not json') === null)
check('a COMBO is a select', controlFor('LIST', '["COMBO", {"options": ["a", "b"]}]') === 'select')
check('an IMAGE whose first element is an array is an image', controlFor('IMAGE', '[["a.png"], {"image_upload": true}]') === 'image')
check('a STRING is text', controlFor('STRING', '["STRING", {}]') === 'text')
check('a FLOAT is a number', controlFor('FLOAT', '["FLOAT", {}]') === 'number')
check('a LIST with no options is hidden, not guessed', controlFor('LIST', '["LIST", {}]') === null)
check('keys are deduped when two doors derive the same one', (() => {
  const doors = deriveDoors([
    { nodeId: '1', fieldName: 'image', fieldType: 'IMAGE', fieldData: '[["a.png"], {"image_upload": true}]' },
    { nodeId: '2', fieldName: 'image', fieldType: 'IMAGE', fieldData: '[["b.png"], {"image_upload": true}]' },
  ], house)
  return doors.length === 2 && doors[0].key === 'image' && doors[1].key === 'image2'
})(), deriveDoors([
  { nodeId: '1', fieldName: 'image', fieldType: 'IMAGE', fieldData: '[["a.png"], {}]' },
  { nodeId: '2', fieldName: 'image', fieldType: 'IMAGE', fieldData: '[["b.png"], {}]' },
], house).map((door) => door.key).join(', '))

// ── 4. the house style, in its two layers ────────────────────────────────────

check('a profile override wins per key and keeps the shipped glossary', (() => {
  const merged = mergeHouse(SHIPPED_HOUSE, { runLabel: 'Swap the outfit', glossary: { text: 'Notes' } })
  return merged.runLabel === 'Swap the outfit' && merged.glossary.text === 'Notes' && merged.glossary.image === 'Image'
})())
check('the shipped default is generic, never fashion', (() => {
  const words = Object.values(SHIPPED_HOUSE.glossary).join(' ').toLowerCase()
  return !/garment|outfit|person to wear|model photo/.test(words)
})(), Object.values(SHIPPED_HOUSE.glossary).join(', '))
check('the shipped default carries a run label, a door budget and the advanced field names', (() => {
  return SHIPPED_HOUSE.runLabel === 'Generate' && SHIPPED_HOUSE.mainDoors === 4 && SHIPPED_HOUSE.advancedFieldNames.includes('Value')
})())

const housePath = join(tmp, 'house', '_house.json')
check('a missing house file falls back to the shipped default', (await loadHouse(housePath)).source === 'shipped')
writeFileSync(join(tmp, 'broken-house.json'), '{ not json')
const broken = await loadHouse(join(tmp, 'broken-house.json'))
check('a malformed house file warns and still applies the default', broken.source === 'shipped' && typeof broken.warning === 'string', broken.warning)
writeFileSync(join(tmp, 'profile-house.json'), '{ "runLabel": "Make it" }')
const profileHouse = await loadHouse(join(tmp, 'profile-house.json'))
check('a profile house file overrides the shipped default', profileHouse.source === 'profile' && profileHouse.house.runLabel === 'Make it')

check('an adapter door key beats the house default label only where it says so', (() => {
  const doors = deriveDoors(KREA2.data.nodeInfoList, mergeHouse(SHIPPED_HOUSE, { glossary: { text: 'Notes' } }))
  return byField(doors, 'text').label === 'Notes' && byField(doors, 'Value').label === 'Seed'
})())

// ── 5. rh_workflow_graph, through the mounted tool ───────────────────────────

const definitions = mountTools()
const graph = definitions.get(GRAPH)
const validate = definitions.get(VALIDATE)

check('the plugin registers both tools under the names the epic fixes', graph !== undefined && validate !== undefined)
check('rh_workflow_graph declares a required link', JSON.stringify(graph.parameters.required) === '["link"]')

const okFetch = stubFetch(KREA2)
globalThis.fetch = okFetch
const read = await graph.execute({ link: 'https://www.runninghub.ai/app/2072445848017002498' }, {})
check('the tool reads the app and returns its doors', read.ok === true && read.app.doors.length === 4, JSON.stringify(read.error || ''))
check('the read names the app, its cover and its tags', read.app.webappName === 'Krea2 Claire' && read.app.cover === 'https://rh-hk-images.example/cover.png' && read.app.tags[0] === 'Image-to-Image')
check('the request is the endpoint the S0 probe settled', okFetch.calls.length === 1 && okFetch.calls[0].url.includes('/api/webapp/apiCallDemo?') && okFetch.calls[0].url.includes('webappId=2072445848017002498'), okFetch.calls[0] && okFetch.calls[0].url)
check('the app declares no requiredness, and the tool says so rather than inventing one', read.app.requirednessKnown === false && read.notes.some((note) => note.includes('no requiredness')))
check('the tool hands back a starter adapter with the app\'s own numbers', (() => {
  const door = read.adapter.doors.prompt
  return read.adapter.schema === ADAPTER_SCHEMA && door.nodeId === '951' && door.type === 'text' && door.multiline === true
})(), JSON.stringify(read.adapter.doors))
check('the starter adapter leaves the origin unset, because the API cannot know it', read.adapter.origin === '')
check('the tool says where the adapter file goes', typeof read.adaptersDir === 'string' && read.adaptersDir.endsWith(join('generate', 'runninghub', 'adapters')), read.adaptersDir)
check('the tool says which rule resolved that directory', typeof read.rootKind === 'string' && read.notes.some((note) => note.includes('adapters directory')))
check('the tool tells the agent to write nothing before the confirmation', read.notes.some((note) => note.includes('write nothing until the user confirms')))
check('the key never appears in the tool result', !JSON.stringify(read).includes(SECRET))
check('nor in the request body, which has none — the key rides the query the endpoint documents', !(okFetch.calls[0].options && okFetch.calls[0].options.body))

const emptyResult = await (async () => {
  const empty = { code: 0, msg: 'success', data: { accessEncrypted: false, webappName: 'Empty', nodeInfoList: [], covers: [], tags: [] } }
  globalThis.fetch = stubFetch(empty)
  return graph.execute({ link: '2072445848017002498' }, {})
})()
check('an app with no adjustable inputs says so instead of failing', emptyResult.ok === true && emptyResult.app.doors.length === 0, JSON.stringify(emptyResult.error || ''))

const encrypted = await (async () => {
  globalThis.fetch = stubFetch({ code: 0, msg: 'success', data: { accessEncrypted: true, webappName: 'Locked', nodeInfoList: [], covers: [], tags: [] } })
  return graph.execute({ link: '2072445848017002498' }, {})
})()
check('an accessEncrypted app is refused, and nothing is written', encrypted.ok === false && encrypted.error === 'access-encrypted', encrypted.detail)

const apiError = await (async () => {
  globalThis.fetch = stubFetch({ code: 400, msg: 'Invalid API key', data: null })
  return graph.execute({ link: '2072445848017002498' }, {})
})()
check('the API\'s own refusal is reported in its own words', apiError.ok === false && apiError.error === 'api-error' && apiError.detail === 'Invalid API key', JSON.stringify(apiError))
check('a non-zero code is not blamed on the network', apiError.detail !== 'unreachable')

const badLink = await (async () => {
  const stub = stubFetch(KREA2)
  globalThis.fetch = stub
  const result = await graph.execute({ link: 'https://example.com/nope' }, {})
  return { result, stub }
})()
check('a link that does not resolve fails at the field, before any request', badLink.result.error === 'unrecognized-link' && badLink.stub.calls.length === 0)

const noKey = await (async () => {
  const stub = stubFetch(KREA2)
  globalThis.fetch = stub
  const defs = mountTools({ credentials: fakeCredentials({ value: null }) })
  const result = await defs.get(GRAPH).execute({ link: '2072445848017002498' }, {})
  return { result, stub }
})()
check('no linked key fails into the wallet step, not into a run error', noKey.result.error === 'no-key' && noKey.stub.calls.length === 0, noKey.result.detail)

const unreachable = await (async () => {
  globalThis.fetch = async () => {
    const error = new Error('boom')
    error.name = 'TypeError'
    throw error
  }
  return graph.execute({ link: '2072445848017002498' }, {})
})()
check('an unreachable host is kept apart from a refusal', unreachable.ok === false && unreachable.error === 'unreachable')

// ── 6. rh_adapter_validate ───────────────────────────────────────────────────

globalThis.fetch = stubRunningHub({ '2072445848017002498': KREA2, '2071662900963532802': CLOTHES })
const readAgain = await graph.execute({ link: '2072445848017002498' }, {})
const good = {
  ...readAgain.adapter,
  name: 'krea2-claire',
  title: 'Generate digital human',
  group: 'wear',
  origin: 'mine',
  provenance: { ...readAgain.adapter.provenance, dryRun: 'ok' },
}
const goodResult = await validate.execute({ adapter: good }, {})
check('a good adapter passes, and says what it checked', goodResult.ok === true && goodResult.doors === 4, JSON.stringify(goodResult.problems))

const wrongNode = JSON.parse(JSON.stringify(good))
wrongNode.doors.prompt.nodeId = '999'
const wrongNodeResult = await validate.execute({ adapter: wrongNode }, {})
check('a wrong node id fails as a pair problem, not as a mystery', wrongNodeResult.ok === false && wrongNodeResult.problems.some((problem) => problem.code === 'door-pair'), JSON.stringify(wrongNodeResult.problems))

const unknownField = JSON.parse(JSON.stringify(good))
unknownField.doors.prompt.fieldName = 'not_a_field'
const unknownFieldResult = await validate.execute({ adapter: unknownField }, {})
check('an unknown field name fails as an unknown door', unknownFieldResult.ok === false && unknownFieldResult.problems.some((problem) => problem.code === 'unknown-door'), JSON.stringify(unknownFieldResult.problems))

const swappedPair = JSON.parse(JSON.stringify(good))
swappedPair.doors.prompt.nodeId = '942'
const swappedResult = await validate.execute({ adapter: swappedPair }, {})
check('a node that exists but is paired with the wrong field name fails as a pair', (() => {
  const problem = swappedResult.problems.find((entry) => entry.code === 'door-pair')
  return swappedResult.ok === false && problem !== undefined && problem.door === 'prompt'
})(), JSON.stringify(swappedResult.problems))

const drifted = JSON.parse(JSON.stringify(good))
drifted.doors.megapixels.min = 0.5
const driftResult = await validate.execute({ adapter: drifted }, {})
check('a derived value that drifted is reported with both numbers', (() => {
  const problem = driftResult.problems.find((entry) => entry.code === 'derived-drift')
  return driftResult.ok === false && problem !== undefined && problem.detail.includes('0.5') && problem.detail.includes('0.1')
})(), JSON.stringify(driftResult.problems))

const missingDerived = JSON.parse(JSON.stringify(good))
delete missingDerived.doors.aspectRatio.options
const missingResult = await validate.execute({ adapter: missingDerived }, {})
check('a derived value left out is reported as missing', missingResult.problems.some((problem) => problem.code === 'derived-missing'), JSON.stringify(missingResult.problems))

const unsupported = JSON.parse(JSON.stringify(good))
unsupported.doors.prompt.type = 'canvas'
const unsupportedResult = await validate.execute({ adapter: unsupported }, {})
check('a type the pane cannot render is refused, not guessed', unsupportedResult.problems.some((problem) => problem.code === 'unsupported-type'))

const noOrigin = JSON.parse(JSON.stringify(good))
noOrigin.origin = ''
const noOriginResult = await validate.execute({ adapter: noOrigin }, {})
check('an adapter that never says whose work it is cannot be listed', noOriginResult.problems.some((problem) => problem.code === 'origin-missing'), JSON.stringify(noOriginResult.problems))

const noUi = JSON.parse(JSON.stringify(good))
delete noUi.ui
const noUiResult = await validate.execute({ adapter: noUi }, {})
check('an adapter with no ui block still passes: the house style dresses it', (() => {
  return noUiResult.ok === true && !noUiResult.problems.some((problem) => problem.code === 'ui')
})(), JSON.stringify(noUiResult.problems))

const noDryRun = JSON.parse(JSON.stringify(good))
noDryRun.provenance.dryRun = ''
const noDryRunResult = await validate.execute({ adapter: noDryRun }, {})
check('an unvalidated adapter is not a capability', noDryRunResult.ok === false && noDryRunResult.problems.some((problem) => problem.code === 'not-dry-run'))

const badOrder = JSON.parse(JSON.stringify(good))
badOrder.ui.order = ['prompt', 'ghost']
const badOrderResult = await validate.execute({ adapter: badOrder }, {})
check('ui.order may only name declared doors', badOrderResult.problems.some((problem) => problem.code === 'ui'), JSON.stringify(badOrderResult.problems))

const wrongApp = JSON.parse(JSON.stringify(good))
wrongApp.source.appId = '2071662900963532802'
const wrongAppResult = await validate.execute({ adapter: wrongApp }, {})
check('doors borrowed from another app fail as pairs, because the adapter names the app that is read', (() => {
  return wrongAppResult.ok === false && wrongAppResult.problems.every((problem) => problem.code === 'unknown-door' || problem.code === 'door-pair')
})(), JSON.stringify(wrongAppResult.problems.map((problem) => problem.code)))
check('the pure validator still refuses an app that is not the one it was handed', (() => {
  const result = validateAdapter({ ...good, source: { ...good.source, appId: '999999999999999999' } }, { app: readAgain.app })
  return result.problems.some((problem) => problem.code === 'source')
})())

const clothesRead = await graph.execute({ link: '2071662900963532802' }, {})
const clothesAdapter = {
  ...clothesRead.adapter,
  name: 'clothes-extraction',
  title: 'Extract the garment',
  origin: 'community',
  provenance: { ...clothesRead.adapter.provenance, dryRun: 'ok' },
}
const clothesResult = await validate.execute({ adapter: clothesAdapter }, {})
check('the same path validates a second app, so nothing is pinned to one workflow', clothesResult.ok === true, JSON.stringify(clothesResult.problems))

const noApp = await validate.execute({ adapter: { schema: ADAPTER_SCHEMA } }, {})
check('an adapter with no app id has nothing to check against, and says so', noApp.error === 'no-app')
const noArgs = await validate.execute({}, {})
check('the tool refuses to guess which adapter to check', noArgs.error === 'missing-adapter')

const adapterPath = join(tmp, 'krea2-claire.json')
writeFileSync(adapterPath, JSON.stringify(good, null, 2))
const fromPath = await validate.execute({ path: adapterPath }, {})
check('the tool validates an adapter from its file, which is how the skill uses it', fromPath.ok === true, JSON.stringify(fromPath.problems))

writeFileSync(join(tmp, 'broken.json'), '{ nope')
const brokenJson = await validate.execute({ path: join(tmp, 'broken.json') }, {})
check('an unreadable adapter file is reported as such, not as a validation result', brokenJson.error === 'invalid-json', JSON.stringify(brokenJson))
const missingFile = await validate.execute({ path: join(tmp, 'absent.json') }, {})
check('a missing adapter file is reported as unreadable', missingFile.error === 'unreadable')

// ── 7. nothing was written ───────────────────────────────────────────────────

check('no tool created the data directory or a file in it', !existsSync(dataRoot), dataRoot)
check('the adapters directory the tool reports is the provider-relative one', read.adaptersDir === dataPaths(dataRoot, 'runninghub').adapters)

// ── 8. the data root, from argv and the environment ──────────────────────────

check('a profile in argv resolves inside that profile', (() => {
  const root = resolveDataRoot({ argv: ['node', 'dsh', '--profile', 'mitsu', 'web'], env: { DSH_HOME: '/home/x/.dsh' } })
  return root.kind === 'profile' && root.profile === 'mitsu' && root.root === join('/home/x/.dsh', 'profiles', 'mitsu', 'generate')
})(), JSON.stringify(resolveDataRoot({ argv: ['node', 'dsh', '--profile', 'mitsu', 'web'], env: { DSH_HOME: '/home/x/.dsh' } })))
check('the --profile=name spelling resolves the same way', (() => {
  const root = resolveDataRoot({ argv: ['--profile=mitsu'], env: { DSH_HOME: '/home/x/.dsh' } })
  return root.kind === 'profile' && root.profile === 'mitsu'
})())
check('RH_DATA_DIR overrides everything', (() => {
  const root = resolveDataRoot({ argv: ['--profile', 'mitsu'], env: { DSH_HOME: '/home/x/.dsh', RH_DATA_DIR: '/pinned' } })
  return root.kind === 'override' && root.root === '/pinned'
})())
check('with no profile anywhere the root falls back to the home, and says so', (() => {
  const root = resolveDataRoot({ argv: ['node', 'dsh', 'web'], env: { DSH_HOME: '/home/x/.dsh' } })
  return root.kind === 'home' && root.profile === null && root.root === join('/home/x/.dsh', 'generate')
})())
check('the default DSH home is used when the environment has none', (() => {
  const root = resolveDataRoot({ argv: ['--profile', 'mitsu'], env: {} })
  return root.root.endsWith(join('.dsh', 'profiles', 'mitsu', 'generate'))
})(), resolveDataRoot({ argv: ['--profile', 'mitsu'], env: {} }).root)

// ── 9. the optional services ─────────────────────────────────────────────────

check('a context with no tools service does not throw', (() => {
  const { ctx } = recordingCtx({ credentials: fakeCredentials() })
  apply(ctx, { base: BASE })
  return true
})())
check('a context with no credentials and no web server does not throw', (() => {
  const { ctx } = recordingCtx({})
  apply(ctx, { base: BASE })
  return true
})())

finish()
