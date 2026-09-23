/**
 * verify:start — the Generate pane as the hub (founder, 2026-09-22).
 *
 * THE UX DECISION THIS FILE PINS, in the founder's words:
 *
 *   "the UX is incorrect on the start page revert to Generate with RunningHub,
 *    then on this screen we need cards to launch the workflow UI/surface. So I
 *    think this surface needs to hold all wf surfaces inside this one RH plugin
 *    surface." … "we should only have 1 generate settings with the different
 *    adapters."
 *
 * So the claims are: the start-page card is the harness's own standard card saying
 * "Generate with RunningHub" (no custom renderer, no degrade to one app's title);
 * the pane's first screen is the cards; a card opens that workflow's surface IN the
 * pane; and this plugin registers exactly one settings page.
 *
 * WHAT THIS PROVES, AND WHAT IT DOES NOT. `lib/client.js` is loaded in the same
 * stubbed loader verify/mount.mjs and verify/save-confirmation.mjs use, `apply(ctx)`
 * runs against a recording ctx, and the pane is rendered against a stubbed host —
 * so the claim is source-level: the registrations and the shapes are what the
 * decision says. It does NOT prove the bytes are on the running page: a
 * `link:`-installed client bundle is served from the copy captured at activation,
 * so this reaches the page on the next app start.
 *
 * The host half is driven for real: `listAdapters` (what may be listed) and
 * `readAdapter` (what a surface may open, including the file-name check that stops
 * `?name=../…`), over temp directories.
 *
 * Nothing here spends coins, calls RunningHub, or writes an adapter.
 *
 *   node verify/start.mjs
 *   node verify/start.mjs --show   # print each rendered screen's lines
 */
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

import { ADAPTER_SCHEMA, listAdapters, readAdapter } from '../lib/adapter.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')
const PKG_NAME = '@muen/dsh-runninghub'
const WALLET_API = '/plugins/generate/wallet'
const ADAPTERS_API = '/plugins/generate/adapters'
const ADAPTER_API = '/plugins/generate/adapter'
const argv = process.argv.slice(2)
const SHOW = argv.includes('--show')

// ── the reporter (the same shape as this plugin's other verifies) ────────────

const rows = []
const check = (label, ok, detail) => rows.push({ label, status: ok ? 'pass' : 'fail', detail: detail == null ? '' : String(detail) })
const note = (text) => rows.push({ label: text, status: 'note', detail: '' })
const skip = (label, why) => rows.push({ label, status: 'skip', detail: why })

function finish() {
  let failed = 0
  process.stdout.write('\nverify:start — the Generate pane, as the hub\n')
  for (const row of rows) {
    if (row.status === 'pass') continue
    if (row.status === 'note') {
      process.stdout.write('  ....  ' + row.label + '\n')
      continue
    }
    if (row.status === 'skip') {
      process.stdout.write('  SKIP  ' + row.label + '  —  ' + row.detail + '\n')
      continue
    }
    failed += 1
    process.stdout.write('  FAIL  ' + row.label + (row.detail ? '  —  ' + row.detail : '') + '\n')
  }
  const passes = rows.filter((row) => row.status === 'pass').length
  const total = rows.filter((row) => row.status === 'pass' || row.status === 'fail').length
  process.stdout.write('  ' + passes + '/' + total + ' passed\n')
  if (failed > 0) process.exitCode = 1
}

// ── React, stood in for ─────────────────────────────────────────────────────
//
// The pane is a component tree, not a string, so a text search would prove nothing.
// The shim models what the pane depends on: state that survives a re-render (the
// open unit, the disclosure, the door values) and effects INCLUDING their
// dependency arrays — the surface fills its doors from defaults when the adapter
// arrives, which is a later render, and a shim that ran every effect once would
// never see the form at all.

const FRAGMENT = Symbol('Fragment')
const instances = new Map()
let current = null
let dirty = false
let pendingEffects = []

function instanceFor(key) {
  let instance = instances.get(key)
  if (!instance) {
    instance = { hooks: [] }
    instances.set(key, instance)
  }
  instance.cursor = 0
  return instance
}

const REACT = {
  Fragment: FRAGMENT,
  createElement: (type, props, ...children) => {
    const merged = { ...(props || {}) }
    if (children.length === 1) merged.children = children[0]
    else if (children.length > 1) merged.children = children
    return { type, props: merged }
  },
  useState: (initial) => {
    const instance = current
    const index = instance.cursor++
    if (!(index in instance.hooks)) {
      const cell = [typeof initial === 'function' ? initial() : initial, null]
      cell[1] = (next) => {
        const value = typeof next === 'function' ? next(cell[0]) : next
        if (Object.is(value, cell[0])) return
        cell[0] = value
        dirty = true
      }
      instance.hooks[index] = cell
    }
    return instance.hooks[index]
  },
  useCallback: (fn) => {
    const instance = current
    const index = instance.cursor++
    if (!(index in instance.hooks)) instance.hooks[index] = [fn]
    return instance.hooks[index][0]
  },
  useEffect: (fn, deps) => {
    const instance = current
    const index = instance.cursor++
    const seen = instance.hooks[index]
    if (seen && deps !== undefined && JSON.stringify(seen[0]) === JSON.stringify(deps)) return
    instance.hooks[index] = [deps === undefined ? null : deps, true]
    pendingEffects.push(fn)
  },
  useMemo: (fn) => fn(),
  useRef: (initial) => {
    const instance = current
    const index = instance.cursor++
    if (!(index in instance.hooks)) instance.hooks[index] = [{ current: initial }]
    return instance.hooks[index][0]
  },
}

/** The harness's own primitives, stood in for. Only what this half requires. */
const PRIMITIVES = {
  IconSparkle16: (props) => REACT.createElement('svg', { 'data-stub': 'sparkle', ...props }),
  IconWarningOutline16: (props) => REACT.createElement('svg', { 'data-stub': 'warning', ...props }),
  IconRightUpOutline16: (props) => REACT.createElement('svg', { 'data-stub': 'right-up', ...props }),
  IconRefreshOutline16: (props) => REACT.createElement('svg', { 'data-stub': 'refresh', ...props }),
  IconCheckOutline16: (props) => REACT.createElement('svg', { 'data-stub': 'check', ...props }),
  IconInfoOutline14: (props) => REACT.createElement('svg', { 'data-stub': 'info', ...props }),
  Modal: () => null,
}

// ── the walker ───────────────────────────────────────────────────────────────

function walk(node, key) {
  if (node === null || node === undefined || typeof node === 'boolean') return null
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) {
    return node.map((child, index) => walk(child, key + '.' + index)).filter((child) => child !== null)
  }
  const type = node.type
  if (typeof type === 'function') {
    const instance = instanceFor(key)
    const previous = current
    current = instance
    let out
    try {
      out = type(node.props)
    } finally {
      current = previous
    }
    return walk(out, key)
  }
  const children = walk(node.props ? node.props.children : undefined, key)
  const flattened = []
  const push = (child) => {
    if (child === null) return
    if (Array.isArray(child)) child.forEach(push)
    else flattened.push(child)
  }
  push(children)
  if (type === FRAGMENT) return flattened.length === 1 ? flattened[0] : flattened
  return { type, props: node.props || {}, children: flattened }
}

/** Render, then let effects and the promises they start settle. */
async function settle(component, props, key, { max = 20 } = {}) {
  let tree = null
  for (let pass = 0; pass < max; pass += 1) {
    dirty = false
    pendingEffects = []
    current = null
    tree = walk(REACT.createElement(component, props), key)
    for (const effect of pendingEffects) effect()
    for (let tick = 0; tick < 3; tick += 1) await new Promise((resolve) => setTimeout(resolve, 0))
    if (!dirty) return tree
  }
  throw new Error('the component tree never settled at ' + key)
}

const nodesOf = (tree, out = []) => {
  if (tree === null || typeof tree === 'string') return out
  if (Array.isArray(tree)) {
    tree.forEach((child) => nodesOf(child, out))
    return out
  }
  out.push(tree)
  tree.children.forEach((child) => nodesOf(child, out))
  return out
}
const textOf = (tree) => {
  if (tree === null) return []
  if (typeof tree === 'string') return [tree]
  if (Array.isArray(tree)) return tree.flatMap(textOf)
  return tree.children.flatMap(textOf)
}
const textIn = (tree) => textOf(tree).join(' ')
const byAttr = (tree, attr, value) =>
  nodesOf(tree).find((node) => node.props && (value === undefined ? node.props[attr] !== undefined : node.props[attr] === value)) || null
const linesOf = (tree, out = []) => {
  if (tree === null || typeof tree === 'string') return out
  if (Array.isArray(tree)) {
    tree.forEach((child) => linesOf(child, out))
    return out
  }
  tree.children.forEach((child) => {
    if (typeof child === 'string') out.push(child)
    else linesOf(child, out)
  })
  return out
}

// ── the shipped client half, loaded the way the browser loads it ─────────────

async function loadClient() {
  const source = await readFile(join(ROOT, 'lib/client.js'), 'utf8')
  let captured = null
  const sandbox = {
    window: { __ModuleLoader__: { load: (registration) => { captured = registration } } },
    console,
    fetch: (url, init) => globalThis.fetch(url, init),
  }
  vm.createContext(sandbox)
  vm.runInContext(source, sandbox, { filename: 'lib/client.js' })
  if (!captured) throw new Error('lib/client.js never called window.__ModuleLoader__.load')
  if (captured.id !== PKG_NAME) throw new Error('unexpected module id: ' + captured.id)
  return captured.factory((id) => {
    if (id === 'react') return REACT
    if (id === '@deepseek-ai/dsh-client-ui-primitives') return PRIMITIVES
    throw new Error('the client half required something unexpected: ' + id)
  })
}

function recordingCtx(locale = 'en') {
  const seen = { slots: [], locales: [], types: [] }
  const dicts = new Map()
  return {
    ctx: {
      effect: (fn) => {
        fn()
        return () => {}
      },
      locale: {
        register: (ns, table) => {
          seen.locales.push({ ns, table })
          dicts.set(ns, table)
          return () => {}
        },
        // Resolved at call time: `apply` binds the translator before it registers.
        bind: (ns) => (key) => {
          const table = dicts.get(ns) || {}
          const dict = table[locale] || table.en || {}
          return Object.prototype.hasOwnProperty.call(dict, key) ? dict[key] : key
        },
      },
      sidebarRightTabs: { register: (definition) => { seen.types.push(definition); return () => {} } },
      slots: {
        inject: (name, callback) => {
          callback()
          return () => {}
        },
        register: (options, component) => {
          seen.slots.push({ options, component })
          return () => {}
        },
      },
    },
    seen,
  }
}

// ── the stubbed host ─────────────────────────────────────────────────────────

const ACCOUNT_URL = 'https://www.runninghub.ai/call-api/bill-task?tab=keys'
const LINKED = {
  linked: true,
  writable: true,
  source: 'file',
  account: { coins: 8600, money: 27.473, currency: 'USD', running: 0 },
  error: null,
  accountUrl: ACCOUNT_URL,
}

const KREA = {
  name: 'krea2-raw-turbo-claire',
  title: 'Krea 2 Raw/Turbo Dual Mining',
  blurb: 'Text to image, with aspect ratio, megapixels and an upscale pass.',
  cover: '',
  origin: 'mine',
  runLabel: 'Generate image',
  doorCount: 7,
}
const QWEN = { ...KREA, name: 'qwen-edit', title: 'Qwen 2.1 Edit', origin: 'community', doorCount: 3 }

/** The file the one-workflow route hands back, in the shape `readAdapter` builds. */
const KREA_FILE = {
  name: KREA.name,
  title: KREA.title,
  blurb: KREA.blurb,
  group: '',
  variant: '',
  cover: '',
  origin: 'mine',
  runLabel: 'Generate image',
  expect: '',
  order: ['value', 'aspectRatio', 'megapixels', 'scaleBy', 'steps', 'cfg', 'denoise'],
  doors: {
    value: { nodeId: '63', fieldName: 'value', type: 'text', label: 'Prompt', primary: true, multiline: true },
    aspectRatio: {
      nodeId: '49',
      fieldName: 'aspect_ratio',
      type: 'select',
      label: 'Aspect ratio',
      options: ['1:1 (Square)', '2:3 (Portrait Photo)'],
      default: '1:1 (Square)',
      hint: 'The aspect ratio for the output dimensions.',
    },
    megapixels: { nodeId: '49', fieldName: 'megapixels', type: 'number', label: 'Megapixels', min: 0.1, max: 16, step: 0.1, default: 1 },
    scaleBy: { nodeId: '95', fieldName: 'scale_by', type: 'number', label: 'Upscale factor', min: 0.01, max: 8, step: 0.01, default: 1 },
    steps: { nodeId: '53', fieldName: 'steps', type: 'number', label: 'Steps', advanced: true, min: 1, max: 10000, default: 20 },
    cfg: { nodeId: '53', fieldName: 'cfg', type: 'number', label: 'CFG scale', advanced: true, min: 0, max: 100, step: 0.1, default: 8 },
    denoise: { nodeId: '53', fieldName: 'denoise', type: 'number', label: 'Denoise', advanced: true, min: 0, max: 1, step: 0.01, default: 1 },
  },
}

function stubHost({ units = [], file = null, failList = false } = {}) {
  const calls = []
  const ok = (body) => ({ ok: true, status: 200, json: async () => body })
  return {
    calls,
    fetch: async (url, init = {}) => {
      calls.push({ url, method: (init.method || 'GET').toUpperCase() })
      if (url === WALLET_API) return ok(LINKED)
      if (url === ADAPTERS_API) {
        return failList ? { ok: false, status: 500, json: async () => ({ error: 'unreadable' }) } : ok({ entries: units, skipped: [] })
      }
      if (String(url).startsWith(ADAPTER_API)) {
        const name = decodeURIComponent(String(url).split('name=')[1] || '')
        if (file && file.name === name) return ok(file)
        return { ok: false, status: 404, json: async () => ({ error: 'not-found' }) }
      }
      throw new Error('no stub for ' + url)
    },
  }
}

// ── the registrations ────────────────────────────────────────────────────────

const module = await loadClient()
const { ctx, seen } = recordingCtx('en')
module.apply(ctx)

const copy = seen.locales.find((entry) => entry.ns === 'generate')
const EN = copy ? copy.table.en : {}
const ZH = copy ? copy.table.zh : {}
const t = ctx.locale.bind('generate')
const type = seen.types[0]
const paneSlot = seen.slots.find((slot) => slot.options.name === 'sidebar.right.pane.tab')
const titleSlot = seen.slots.find((slot) => slot.options.name === 'sidebar.right.pane.tab.title')
const settingsSlots = seen.slots.filter((slot) => slot.options.name === 'settings.section')
const guideCardSlots = seen.slots.filter((slot) => slot.options.name === 'sidebar.right.tab.guide.entry')

check('the pane body registers under our id', !!paneSlot && paneSlot.options.key === PKG_NAME, paneSlot && String(paneSlot.options.key))
check('the chip registers beside it', !!titleSlot && titleSlot.options.key === PKG_NAME, titleSlot && String(titleSlot.options.key))
check(
  "the guide card is the harness's own standard card, and the copy names the provider",
  !!type && type.guide.length === 1 && type.guide[0].title() === 'Generate with RunningHub',
  type && type.guide[0].title(),
)
check(
  'no card renderer is registered: the card says what it opens',
  guideCardSlots.length === 0,
  guideCardSlots.map((slot) => String(slot.options.key)).join(', '),
)
check('the tab chip stays short, so the card can carry the provider', type.title() === 'Generate', type.title())
check(
  'ONE Generate settings page, never one per workflow (settings.section is a list)',
  settingsSlots.length === 1 && settingsSlots[0].options.id === 'runninghub-wallet' && settingsSlots[0].options.label() === 'Generate',
  JSON.stringify(settingsSlots.map((slot) => slot.options.id)),
)

// ── the pane's first screen: cards ───────────────────────────────────────────

async function pane(state, { params, key = 'pane' } = {}) {
  const stub = stubHost(state)
  const real = globalThis.fetch
  globalThis.fetch = stub.fetch
  try {
    const props = { t }
    if (params !== undefined) props.useTabInfo = () => ({ tab: { navigation: { params, revision: 1 } } })
    const tree = await settle(paneSlot.component, props, key)
    return { tree, calls: stub.calls }
  } finally {
    globalThis.fetch = real
  }
}

// Each case renders under its own key: the shim keeps hook state per tree path,
// exactly as React's positional reconciliation does, so two cases sharing a key
// would share their state and the second would render the first's data.
const home = await pane({ units: [KREA, QWEN] }, { key: 'pane-home' })
const empty = await pane({ units: [] }, { key: 'pane-empty' })
const failed = await pane({ units: [], failList: true }, { key: 'pane-failed' })
const opened = await pane({ units: [KREA], file: KREA_FILE }, { params: { unit: KREA.name }, key: 'pane-opened' })

if (SHOW) {
  for (const [name, state] of [['home', home], ['empty', empty], ['failed', failed], ['opened', opened]]) {
    note(name + ': ' + JSON.stringify(linesOf(state.tree).slice(0, 12)))
  }
}

const homeRoot = byAttr(home.tree, 'data-generate-pane')
check(
  'the linked pane opens on its home screen',
  !!homeRoot && homeRoot.props['data-generate-pane'] === 'home',
  homeRoot && homeRoot.props['data-generate-pane'],
)
const cardsOf = (tree) => nodesOf(tree).filter((node) => node.props && node.props['data-generate-unit'] && !node.props['data-generate-door'])
check(
  'the home screen carries one card per installed workflow',
  (() => {
    const cards = nodesOf(home.tree).filter((node) => node.props && node.props['data-generate-unit'])
    return cards.length === 2 && cards.map((card) => card.props['data-generate-unit']).join(',') === KREA.name + ',' + QWEN.name
  })(),
  JSON.stringify(cardsOf(home.tree).map((node) => node.props['data-generate-unit'])),
)
check(
  "a card carries the workflow's own title and blurb",
  (() => {
    const card = byAttr(home.tree, 'data-generate-unit', KREA.name)
    const text = card ? textIn(card) : ''
    return text.includes(KREA.title) && text.includes(KREA.blurb)
  })(),
  byAttr(home.tree, 'data-generate-unit', KREA.name) ? textIn(byAttr(home.tree, 'data-generate-unit', KREA.name)) : 'no card',
)
check(
  'a community app says whose work it is',
  textIn(byAttr(home.tree, 'data-generate-unit', QWEN.name)).includes(EN['card.community']),
  textIn(byAttr(home.tree, 'data-generate-unit', QWEN.name)),
)
check(
  'the home screen asks the host for the list, once',
  home.calls.filter((call) => call.url === ADAPTERS_API).length === 1,
  JSON.stringify(home.calls),
)
check(
  'the cards are a view of this pane: opening one does not open a tab',
  (() => {
    const card = byAttr(home.tree, 'data-generate-unit', KREA.name)
    if (!card || typeof card.props.onClick !== 'function') return false
    card.props.onClick()
    return !nodesOf(home.tree).some((node) => node.props && node.props['data-generate-surface'])
  })(),
  'the card switches the pane over to the surface; the list route is the only host read on home',
)
check(
  'the tab kind is still the only thing an opener names — no per-workflow tab',
  seen.types.length === 1 && seen.types[0].multiple === undefined,
  JSON.stringify(seen.types.map((definition) => ({ kind: definition.kind, multiple: definition.multiple }))),
)

// ── a workflow's surface, inside the pane ───────────────────────────────────

const surface = byAttr(opened.tree, 'data-generate-surface')
check('a unit opens its surface inside the pane', !!surface && surface.props['data-generate-surface'] === 'ready', surface && surface.props['data-generate-surface'])
check(
  'the surface is the unit that was asked for',
  !!byAttr(opened.tree, 'data-generate-unit', KREA.name) && !byAttr(opened.tree, 'data-generate-cards'),
  String(byAttr(opened.tree, 'data-generate-unit') && byAttr(opened.tree, 'data-generate-unit').props['data-generate-unit']),
)
check(
  'the pane knows which unit it is from params.unit, the seam an opener uses',
  opened.calls.some((call) => String(call.url).startsWith(ADAPTER_API + '?name=' + KREA.name)),
  JSON.stringify(opened.calls.map((call) => call.url)),
)
check('the surface has a way back to the list', !!byAttr(opened.tree, 'data-generate-back', 'yes'))

const rowsRendered = (tree) =>
  nodesOf(tree)
    .filter((node) => node.props && node.props['data-generate-door-row'])
    .map((node) => node.props['data-generate-door-row'])

check(
  "the doors render as controls, in the adapter's order, the primary door first",
  rowsRendered(opened.tree).join(',') === 'value,aspectRatio,megapixels,scaleBy',
  JSON.stringify(rowsRendered(opened.tree)),
)
check(
  'an advanced door is behind the one disclosure, which counts them',
  (() => {
    const disclosure = byAttr(opened.tree, 'data-generate-advanced', 'closed')
    return !!disclosure && textIn(disclosure).includes('(3)')
  })(),
  byAttr(opened.tree, 'data-generate-advanced') ? textIn(byAttr(opened.tree, 'data-generate-advanced')) : 'no disclosure',
)
check(
  "a door control carries the app's own bounds and default",
  (() => {
    const megapixels = byAttr(opened.tree, 'data-generate-door', 'megapixels')
    return (
      !!megapixels &&
      megapixels.props.type === 'number' &&
      megapixels.props.value === 1 &&
      megapixels.props.min === 0.1 &&
      megapixels.props.max === 16 &&
      megapixels.props.step === 0.1
    )
  })(),
  JSON.stringify(byAttr(opened.tree, 'data-generate-door', 'megapixels') && byAttr(opened.tree, 'data-generate-door', 'megapixels').props),
)
check(
  "a select door offers the app's own options and starts on its default",
  (() => {
    const select = byAttr(opened.tree, 'data-generate-door', 'aspectRatio')
    return !!select && select.props.value === '1:1 (Square)' && textOf(select).join(',') === '1:1 (Square),2:3 (Portrait Photo)'
  })(),
  JSON.stringify(textOf(byAttr(opened.tree, 'data-generate-door', 'aspectRatio'))),
)
check(
  'a multiline door is a text area, not a one-line field',
  byAttr(opened.tree, 'data-generate-door', 'value') && byAttr(opened.tree, 'data-generate-door', 'value').type === 'textarea',
  byAttr(opened.tree, 'data-generate-door', 'value') && byAttr(opened.tree, 'data-generate-door', 'value').type,
)
check(
  "a door draws its label, and the app's tooltip under it",
  (() => {
    const row = byAttr(opened.tree, 'data-generate-door-row', 'aspectRatio')
    const text = row ? textIn(row) : ''
    return text.includes('Aspect ratio') && text.includes('The aspect ratio for the output dimensions.')
  })(),
  byAttr(opened.tree, 'data-generate-door-row', 'aspectRatio') && textIn(byAttr(opened.tree, 'data-generate-door-row', 'aspectRatio')),
)
check(
  'NO node id and NO field name is drawn: those belong to the gate, as JSON to read',
  (() => {
    const text = textIn(opened.tree)
    return !text.includes('aspect_ratio') && !text.includes('scale_by') && !/\bnode\b/i.test(text)
  })(),
  textIn(opened.tree).slice(0, 240),
)
check(
  'the surface says running is not wired yet, rather than offering a dead button',
  !!byAttr(opened.tree, 'data-generate-run-pending', 'yes') && !nodesOf(opened.tree).some((node) => textIn(node).trim() === KREA_FILE.runLabel),
  '',
)

// The disclosure is a control: opening it must reveal the advanced doors.
{
  const disclosure = byAttr(opened.tree, 'data-generate-advanced', 'closed')
  const before = rowsRendered(opened.tree).length
  if (disclosure) disclosure.props.onClick()
  const after = await settle(paneSlot.component, { t, useTabInfo: () => ({ tab: { navigation: { params: { unit: KREA.name }, revision: 1 } } }) }, 'pane-opened')
  check(
    'opening the disclosure adds the advanced doors, and they carry their own bounds',
    before === 4 && rowsRendered(after).length === 7,
    JSON.stringify({ before, after: rowsRendered(after) }),
  )
}

// ── nothing installed, and a host that cannot answer ────────────────────────

check(
  'nothing installed: the pane says so, in its own block',
  !!byAttr(empty.tree, 'data-generate-none', 'yes') && textIn(byAttr(empty.tree, 'data-generate-none', 'yes')).includes(EN['pane.empty.title']),
  byAttr(empty.tree, 'data-generate-none', 'yes') ? textIn(byAttr(empty.tree, 'data-generate-none', 'yes')) : 'no empty block',
)
check(
  'nothing installed: both notes are still there, below that block',
  !!byAttr(empty.tree, 'data-generate-manage-hint', 'yes') && !!byAttr(empty.tree, 'data-generate-add-hint', 'yes'),
  '',
)
check(
  'a host that cannot answer says so, instead of looking like an empty install',
  !!byAttr(failed.tree, 'data-generate-list-failed', 'yes') &&
    !byAttr(failed.tree, 'data-generate-none', 'yes') &&
    !!byAttr(failed.tree, 'data-generate-pane') &&
    byAttr(failed.tree, 'data-generate-pane').props['data-generate-pane'] === 'home',
  textIn(failed.tree).slice(0, 160),
)
check(
  'one failed read does not take the wallet strip with it',
  !!byAttr(failed.tree, 'data-generate-source'),
  '',
)

// ── the copy, in both languages ─────────────────────────────────────────────

for (const key of [
  'guide.title',
  'guide.description',
  'surface.back',
  'surface.loading',
  'surface.failed',
  'surface.advanced',
  'surface.advanced.hide',
  'surface.pending',
  'card.community',
  'surface.image.choose',
]) {
  check('the copy has ' + key + ' in English', typeof EN[key] === 'string' && EN[key] !== '', String(EN[key]))
  check('the copy has ' + key + ' in Chinese', typeof ZH[key] === 'string' && ZH[key] !== '', String(ZH[key]))
}

// ── the host half: what may be listed, and what may be opened ───────────────

const VALID = {
  schema: ADAPTER_SCHEMA,
  name: 'good',
  title: 'A good adapter',
  blurb: 'one line',
  group: 'Capability',
  variant: 'v1',
  origin: 'mine',
  source: { kind: 'webapp', appId: '1', webappName: 'Good', url: '' },
  doors: {
    a: { nodeId: '1', fieldName: 'a', type: 'text', label: 'A' },
    b: { nodeId: '2', fieldName: 'b', type: 'text', label: 'B' },
  },
  ui: { runLabel: 'Run it', order: ['a', 'b'] },
  provenance: { checkedAgainst: 'apiCallDemo', dryRun: 'ok' },
}

const dir = await mkdtemp(join(tmpdir(), 'rh-adapters-'))
try {
  await writeFile(join(dir, 'good.json'), JSON.stringify(VALID))
  await writeFile(join(dir, 'broken.json'), '{ this is not json')
  await writeFile(join(dir, 'unvalidated.json'), JSON.stringify({ ...VALID, name: 'unvalidated', provenance: { checkedAgainst: 'apiCallDemo', dryRun: '' } }))
  await writeFile(join(dir, 'anonymous.json'), JSON.stringify({ ...VALID, name: 'anonymous', origin: '' }))
  await writeFile(join(dir, 'future.json'), JSON.stringify({ ...VALID, name: 'future', schema: 'muen-rh-adapter/v2' }))
  await writeFile(join(dir, 'other.json'), JSON.stringify({ ...VALID, name: 'good' }))
  await writeFile(join(dir, 'notes.txt'), 'not an adapter')

  const listed = await listAdapters(dir)
  check(
    'an adapter that was validated and attributed is listed',
    listed.entries.length === 2 && listed.entries.map((entry) => entry.name).join(',') === 'good,good',
    JSON.stringify(listed.entries.map((entry) => entry.name)),
  )
  check(
    'a listed adapter carries what a card draws and nothing else',
    (() => {
      const entry = listed.entries[0]
      return (
        entry.title === 'A good adapter' &&
        entry.group === 'Capability' &&
        entry.variant === 'v1' &&
        entry.origin === 'mine' &&
        entry.runLabel === 'Run it' &&
        entry.doorCount === 2 &&
        entry.doors === undefined
      )
    })(),
    JSON.stringify(listed.entries[0]),
  )
  check(
    'an unvalidated, unattributed, future or broken file is skipped, and each says why',
    JSON.stringify(listed.skipped.slice().sort((a, b) => (a.file < b.file ? -1 : 1))) ===
      JSON.stringify([
        { file: 'anonymous.json', reason: 'origin-missing' },
        { file: 'broken.json', reason: 'invalid-json' },
        { file: 'future.json', reason: 'schema' },
        { file: 'unvalidated.json', reason: 'not-validated' },
      ]),
    JSON.stringify(listed.skipped),
  )
  check('a file that is not an adapter at all is not read', !listed.skipped.some((row) => row.file === 'notes.txt'))

  const missing = await listAdapters(join(dir, 'no-such-directory'))
  check('no adapters directory is an empty install, not an error', missing.entries.length === 0 && missing.skipped.length === 0)

  const one = await readAdapter(dir, 'good')
  check(
    'one workflow comes back with its doors and order, and without source or provenance',
    (() => {
      const adapter = one.adapter
      return (
        !!adapter &&
        adapter.title === 'A good adapter' &&
        adapter.runLabel === 'Run it' &&
        adapter.order.join(',') === 'a,b' &&
        Object.keys(adapter.doors).join(',') === 'a,b' &&
        adapter.source === undefined &&
        adapter.provenance === undefined
      )
    })(),
    JSON.stringify(one).slice(0, 200),
  )
  check(
    'a name that is not a file name is refused before anything is opened',
    (await readAdapter(dir, '../mitsu')).error === 'bad-name' &&
      (await readAdapter(dir, 'good/../good')).error === 'bad-name' &&
      (await readAdapter(dir, '')).error === 'bad-name',
    JSON.stringify(await readAdapter(dir, '../mitsu')),
  )
  check('an unknown workflow is not-found, not an error', (await readAdapter(dir, 'nope')).error === 'not-found')
  check(
    'a file whose own name differs from the one asked for is refused',
    (await readAdapter(dir, 'other')).error === 'name-mismatch',
    JSON.stringify(await readAdapter(dir, 'other')),
  )
  check(
    'a file that may not be listed may not be opened either',
    (await readAdapter(dir, 'unvalidated')).error === 'not-validated' &&
      (await readAdapter(dir, 'anonymous')).error === 'origin-missing' &&
      (await readAdapter(dir, 'future')).error === 'schema',
    '',
  )
} finally {
  await rm(dir, { recursive: true, force: true })
}

// ── the install that is actually on this machine, when there is one ─────────

const profile = join(homedir(), 'Library', 'Application Support', 'Mitsumeru', 'mitsu-dsh', 'profiles', 'mitsu', 'runninghub', 'adapters')
const installed = await listAdapters(profile).catch(() => null)
if (installed === null || installed.entries.length === 0) {
  skip('the installed profile lists at least one workflow', 'nothing installed at ' + profile)
} else {
  const openedFiles = await Promise.all(installed.entries.map((entry) => readAdapter(profile, entry.name)))
  check(
    'the installed profile lists what the install flow wrote, and every one of them opens',
    openedFiles.every((read) => read.adapter && Object.keys(read.adapter.doors).length > 0),
    JSON.stringify(installed.entries.map((entry) => entry.name + ' → ' + entry.title)),
  )
  check('every installed adapter is one the pane can open', installed.skipped.length === 0, JSON.stringify(installed.skipped))
}

finish()
