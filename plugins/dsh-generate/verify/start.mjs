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
 * "Generate" (no custom renderer, no degrade to one app's title); the pane's first
 * screen is the cards; a card opens that workflow's surface IN the pane; and this
 * plugin registers exactly one settings page.
 *
 * THE TITLE IS THE SURFACE'S OWN LABEL (founder, 2026-09-23: "Generate with Runninghub
 * should be Generate"). The card used to name the first provider; with four providers
 * inside one plugin the card names none of them, and a provider is named where it is
 * chosen — in the pane and in Settings → Generate.
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
const PKG_NAME = '@muen/dsh-generate'
const PROVIDERS_API = '/plugins/generate/providers'
const PROVIDER = 'runninghub'
const providerUrl = (action) => PROVIDERS_API + '/' + PROVIDER + '/' + action
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
  IconPlusOutline16: (props) => REACT.createElement('svg', { 'data-stub': 'plus', ...props }),
  /**
   * The real atoms the add control is built from. `Button` keeps its props on the
   * node, so a check can read the label and call the click. `CodeBlock` is drawn the
   * shape the primitive draws: a header bar with the language slot and the Copy
   * control, over the body — `showHeader` stays on the node so a check can tell
   * whether the owner asked for that bar or drew a copy control of its own.
   */
  Button: (props) => REACT.createElement('button', { type: 'button', 'data-stub': 'button', ...props }, props.icon, props.children),
  CodeBlock: (props) =>
    REACT.createElement(
      'div',
      { 'data-stub': 'code-block', showHeader: props.showHeader !== false, copyLabel: props.copyLabel, copiedLabel: props.copiedLabel },
      props.showHeader === false
        ? null
        : REACT.createElement(
            'div',
            { 'data-stub': 'code-header' },
            REACT.createElement('span', { 'data-stub': 'code-lang' }, props.lang || ''),
            REACT.createElement('button', { type: 'button', 'data-stub': 'code-copy' }, props.copyLabel || ''),
          ),
      REACT.createElement('pre', { 'data-stub': 'code' }, props.code),
    ),
  /**
   * The harness's dialog. The real one portals to `document.body` behind a mask; the stub
   * keeps the props a check reads (title, description, close) and renders the body and the
   * footer inline, so a gate's rows and its confirm/cancel controls are in the tree.
   */
  Modal: (props) =>
    props.open === false
      ? null
      : REACT.createElement(
          'div',
          { 'data-stub': 'modal', role: 'dialog', title: props.title, description: props.description, onClose: props.onClose },
          props.children,
          props.footer,
        ),
  /**
   * The harness's hover bubble. The real one clones its single child, positions a fixed
   * bubble and owns the hover/focus timing; the stub keeps the label and renders the
   * child, so a check can read which glyph wears which tooltip.
   */
  Tooltip: (props) =>
    REACT.createElement('span', { 'data-stub': 'tooltip', label: props.label, side: props.side, delayMs: props.delayMs }, props.children),
  /**
   * The settings hide switch. The real one is a 36×20 button whose label lives in
   * `aria-label`, so the stub keeps the props a check reads and lets the click be
   * driven the way the primitive drives it.
   */
  Switch: (props) =>
    REACT.createElement(
      'button',
      {
        type: 'button',
        role: 'switch',
        'aria-checked': props.checked,
        label: props.label,
        title: props.title,
        'data-stub': 'switch',
        onClick: () => props.onChange(!props.checked),
      },
      props.children,
    ),
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
/**
 * The tooltip a glyph control wears: the bubble node whose own subtree holds the
 * control carrying `attr`. The stub nests the anchor inside the bubble, which is the
 * one thing a check needs from the primitive.
 */
const tooltipOn = (tree, attr, id) =>
  nodesOf(tree).find(
    (node) =>
      node.props &&
      node.props['data-stub'] === 'tooltip' &&
      nodesOf(node).some((child) => child.props && child.props[attr] === id),
  ) || null
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

/** Every interval the client half registered, newest last. */
const timers = []

async function loadClient() {
  const source = await readFile(join(ROOT, 'lib/client.js'), 'utf8')
  let captured = null
  const sandbox = {
    window: { __ModuleLoader__: { load: (registration) => { captured = registration } } },
    console,
    fetch: (url, init) => globalThis.fetch(url, init),
    // The run strip polls on an interval. The sandbox records the callbacks instead of
    // running them, so a check drives exactly one poll (`timers.at(-1)()`) rather than
    // waiting two real seconds for one.
    setInterval: (fn) => timers.push(fn),
    clearInterval: () => {},
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
/** A workflow that names no known model: the card must fall back to the glyph. */
const PLAIN = { ...KREA, name: 'plain-app', title: 'Some Community App', origin: 'community', doorCount: 2 }
/** A second one-colour mark, so the mask path is not Krea's alone. */
const MINIMAX = { ...KREA, name: 'minimax-fl2v', title: 'First-LastFrames2Video Minimax H3', doorCount: 5 }

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
  // The authored starting values, as `readAdapter` flattens them out of the file's
  // `ui` block: megapixels opens at 2 even though the app declares 1.
  defaults: { megapixels: 2 },
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

/**
 * The host stub. The provider list is the real four (2026-09-23): RunningHub carries
 * this case's key state and installed units, and the other three are unlinked with
 * nothing installed — which is what makes the settings page's first-run posture
 * (the first UNLINKED provider opens its own card) a thing these cases can see.
 */
/**
 * The Krea model as the host hands it over (S5): the card a section draws, and the surface
 * a run happens in. `runnable` is the one field that separates it from an adapter, and it
 * is why this surface gets the run strip instead of the "not built yet" note.
 */
const MODEL_UNIT = {
  name: 'krea-2-medium-turbo',
  title: 'Krea 2 Medium Turbo',
  blurb: 'Fastest Krea 2, at medium quality.',
  group: 'Text to image',
  variant: 'Turbo',
  cover: '',
  origin: 'krea',
  runLabel: 'Generate',
  doorCount: 5,
}

const MODEL = {
  name: 'krea-2-medium-turbo',
  title: 'Krea 2 Medium Turbo',
  blurb: 'Fastest Krea 2, at medium quality.',
  group: 'Text to image',
  variant: 'Turbo',
  cover: '',
  origin: 'krea',
  runLabel: 'Generate',
  expect: '',
  runnable: true,
  order: ['prompt', 'aspect_ratio', 'resolution', 'creativity', 'intensity'],
  defaults: {},
  doors: {
    prompt: { type: 'text', label: 'Prompt', multiline: true, primary: true, required: true },
    aspect_ratio: { type: 'select', label: 'Aspect ratio', options: ['1:1', '16:9'], default: '1:1' },
    resolution: { type: 'select', label: 'Resolution', options: ['1K'], default: '1K' },
    creativity: { type: 'select', label: 'Creativity', options: ['raw', 'low', 'medium', 'high'], default: 'low' },
    intensity: { type: 'number', label: 'Intensity', min: -100, max: 100, step: 1, default: 0, advanced: true },
  },
}

/** What the stubbed asset route answers: the URL an uploaded file becomes. */
const UPLOADED_URL = 'https://assets.krea.ai/uploaded.png'

/**
 * THE ARRAY DOORS, as the catalogue ships them (founder, 2026-09-23: *"we are missing a lot
 * of fields for upload image for style ref, etc.."*, with Krea's own playground in the
 * screenshot). A second fixture rather than more doors on the model above: the S5 cases are
 * about the gate and the run, and widening that model would blur what they pin.
 */
const ARRAYS_UNIT = {
  name: 'krea-2-large-arrays',
  title: 'Krea 2 Large',
  blurb: 'More powerful version of Krea 2.',
  group: 'Text to image',
  variant: 'Large',
  cover: '',
  origin: 'krea',
  runLabel: 'Generate',
  doorCount: 5,
}

const ARRAYS = {
  name: 'krea-2-large-arrays',
  title: 'Krea 2 Large',
  blurb: 'More powerful version of Krea 2.',
  group: 'Text to image',
  variant: 'Large',
  cover: '',
  origin: 'krea',
  runLabel: 'Generate',
  expect: '',
  runnable: true,
  order: ['prompt', 'image_url', 'styles', 'image_style_references', 'moodboards'],
  defaults: {},
  doors: {
    prompt: { type: 'text', label: 'Prompt', multiline: true, primary: true, required: true },
    image_url: { type: 'image', label: 'Source image', advanced: true },
    styles: {
      type: 'list',
      label: 'Styles',
      addLabel: 'Add style',
      advanced: true,
      fields: {
        id: { type: 'text', label: 'Style', required: true },
        strength: { type: 'number', label: 'Strength', min: -2, max: 2, step: 0.05, default: 1, required: true },
      },
    },
    image_style_references: {
      type: 'list',
      label: 'Style references',
      addLabel: 'Add style reference',
      advanced: true,
      max: 10,
      fields: {
        url: { type: 'image', label: 'Image', required: true },
        strength: { type: 'number', label: 'Strength', min: 0, max: 1, step: 0.01, default: 0.5 },
      },
    },
    moodboards: {
      type: 'list',
      label: 'Moodboards',
      addLabel: 'Add moodboard',
      advanced: true,
      max: 1,
      fields: {
        id: { type: 'text', label: 'Moodboard', required: true },
        strength: { type: 'number', label: 'Strength', min: 0, max: 1, step: 0.01, default: 0.23 },
      },
    },
  },
}

const OTHER_PROVIDERS = [
  {
    id: 'krea',
    label: 'Krea',
    kind: 'image',
    keyPageLabel: 'API tokens',
    keyUrl: 'https://www.krea.ai/settings/api-tokens',
    accountUrl: 'https://www.krea.ai/app/api',
    funding: { kind: 'balance', url: 'https://www.krea.ai/app/api' },
    addPrompt: 'add this Krea model <model name>',
    // The capability the host reports: this provider turns a picked file into a URL, so its
    // image doors get the pick control. RunningHub answers false until its own run lands.
    upload: true,
  },
  {
    id: 'comfycloud',
    label: 'Comfy Cloud',
    kind: 'workflow',
    keyPageLabel: 'API keys',
    keyUrl: 'https://platform.comfy.org/profile/api-keys',
    accountUrl: 'https://platform.comfy.org',
    funding: { kind: 'plan', url: 'https://comfy.org/pricing' },
    addPrompt: 'add this Comfy Cloud workflow <workflow file>',
  },
  {
    id: 'magnific',
    label: 'Magnific',
    kind: 'image',
    keyPageLabel: 'API keys',
    keyUrl: 'https://www.magnific.com/user/organization/api-keys',
    accountUrl: null,
    funding: { kind: 'credits', url: 'https://www.magnific.com/pricing' },
    addPrompt: 'add this Magnific tool <tool name>',
  },
]

function stubHost({
  units = [],
  kreaUnits = [],
  file = null,
  failList = false,
  linked = true,
  note = null,
  hidden = [],
  jobStates = ['done'],
  jobError = null,
} = {}) {
  const calls = []
  // The runs this stub was asked to start, and how many times a job was polled: the two
  // facts the gate and the strip checks read.
  const runs = []
  const assets = []
  let polls = 0
  const ok = (body) => ({ ok: true, status: 200, json: async () => body })
  return {
    calls,
    runs,
    assets,
    get polls() {
      return polls
    },
    fetch: async (url, init = {}) => {
      calls.push({ url, method: (init.method || 'GET').toUpperCase() })
      // The upload an image door calls: the file goes to this plugin's own host route, the
      // host answers the provider's asset URL, and that URL is the value the door carries.
      if (String(url).endsWith('/asset')) {
        assets.push({
          url: String(url),
          name: (init && init.headers && init.headers['x-file-name']) || null,
          type: (init && init.headers && init.headers['content-type']) || null,
        })
        return ok({ url: UPLOADED_URL })
      }
      // The gate's preview. Built here the way the host builds it: the body is the values
      // the surface holds, and a required door with nothing in it is `missing`.
      if (String(url).endsWith('/payload')) {
        const posted = JSON.parse((init && init.body) || '{}')
        const values = posted.values || {}
        return ok({
          name: posted.name,
          title: 'Krea 2 Medium Turbo',
          model: 'image/krea/krea-2/medium-turbo',
          endpoint: '/generate/image/krea/krea-2/medium-turbo',
          body: values,
          missing: String(values.prompt || '').trim() === '' ? ['prompt'] : [],
          refused: [],
        })
      }
      // Starting a run. The stub records the whole call, so a check can prove the confirm
      // carried the person's own flag.
      if (String(url).endsWith('/run') && (init.method || 'GET').toUpperCase() === 'POST') {
        const posted = JSON.parse((init && init.body) || '{}')
        runs.push(posted)
        return ok({ jobId: 'job-1', status: 'queued' })
      }
      // One poll. `jobStates` is the script: the last entry answers every later poll.
      if (String(url).includes('/run?job=')) {
        polls += 1
        const state = jobStates[Math.min(polls - 1, jobStates.length - 1)]
        if (state === 'failed') return ok({ state: 'failed', status: 'failed', urls: [], error: jobError || { code: 'x', message: 'the model refused this prompt' } })
        if (state === 'done') return ok({ state: 'done', status: 'completed', urls: ['https://gen.krea.ai/out.png'], error: null })
        return ok({ state, status: state === 'queued' ? 'queued' : 'processing', urls: [], error: null })
      }
      // The settings toggle: the host records what the page asked for, so a check can
      // prove the switch reached the route rather than only moving on screen.
      const hiddenParts = String(url).split('/')
      if (hiddenParts[hiddenParts.length - 1] === 'hidden') {
        const id = hiddenParts[hiddenParts.length - 2]
        return ok({ id, hidden: JSON.parse((init && init.body) || '{}').hidden === true, hiddenIds: [] })
      }
      if (url === PROVIDERS_API) {
        // The registry's own order: runninghub, krea, comfycloud, magnific.
        const unlinked = (provider) => ({
          ...provider,
          linked: false,
          verified: false,
          writable: true,
          source: null,
          account: null,
          note: null,
          error: null,
          workflows: 0,
        })
        return ok({
          providers: [
            {
              id: PROVIDER,
              label: 'RunningHub',
              kind: 'workflow',
              keyPageLabel: 'API → Keys',
              keyUrl: ACCOUNT_URL,
              accountUrl: ACCOUNT_URL,
              funding: { kind: 'coins', url: 'https://www.runninghub.ai/call-api/bill-task' },
              addPrompt: 'add this RunningHub workflow <app link>',
              linked,
              verified: linked,
              writable: true,
              source: linked ? 'file' : null,
              account: linked ? { coins: 8600, money: 27.473, currency: 'USD', running: 0 } : null,
              note: linked ? note : null,
              error: null,
              workflows: units.length,
            },
            unlinked(OTHER_PROVIDERS[0]),
            unlinked(OTHER_PROVIDERS[1]),
            unlinked(OTHER_PROVIDERS[2]),
          ].map((provider) => ({ ...provider, hidden: hidden.includes(provider.id) })),
        })
      }
      // Every provider's workflow route answers, because the pane and the open card
      // read one list per provider: RunningHub carries the units, the rest are empty.
      // A failure case fails them all, which is what "the list could not be read"
      // means once there is more than one provider. The path is split rather than
      // matched with a regex: the client runs in a VM, and a cross-realm string does
      // not answer the outer realm's `RegExp` here (measured 2026-09-23).
      const parts = String(url).split('/')
      const workflowOwner =
        parts.length === 6 && parts[1] === 'plugins' && parts[2] === 'generate' && parts[3] === 'providers' && parts[5] === 'workflows' ? parts[4] : null
      if (workflowOwner !== null) {
        if (failList) return { ok: false, status: 500, json: async () => ({ error: 'unreadable' }) }
        if (workflowOwner === 'krea') return ok({ entries: kreaUnits, skipped: [] })
        return ok({ entries: workflowOwner === PROVIDER ? units : [], skipped: [] })
      }
      // One fixture per run of the suite, whichever provider asks: the surface route is
      // provider-addressed, and the run cases open a Krea model while the rest open a
      // RunningHub workflow.
      if (String(url).includes('/workflow?name=')) {
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
  "the guide card is the harness's own standard card, titled with the surface's own label",
  !!type && type.guide.length === 1 && type.guide[0].title() === 'Generate',
  type && type.guide[0].title(),
)
check(
  'no card renderer is registered: the card says what it opens',
  guideCardSlots.length === 0,
  guideCardSlots.map((slot) => String(slot.options.key)).join(', '),
)
check('the tab chip and the card carry the same label', type.title() === 'Generate', type.title())
check(
  'ONE Generate settings page, never one per workflow (settings.section is a list)',
  settingsSlots.length === 1 && settingsSlots[0].options.id === 'generate' && settingsSlots[0].options.label() === 'Generate',
  JSON.stringify(settingsSlots.map((slot) => slot.options.id)),
)

// ── the one settings page, in the Models → Providers shape ──────────────────
//
// One row per provider with a credential dot, a family tag and a sentence; one open
// card at a time, with the API key as its primary field and the install prompt where
// Models puts a model list. Image providers lead, workflow providers follow, and the
// order is the registry's own (founder, 2026-09-23: *"add image provider, then
// RunningHub"*).

{
  const settings = settingsSlots[0]
  const stub = stubHost({ units: [KREA] })
  const real = globalThis.fetch
  globalThis.fetch = stub.fetch
  let tree
  let opened
  try {
    tree = await settle(settings.component, { t }, 'settings')
    const toggle = byAttr(tree, 'data-generate-provider-toggle', PROVIDER)
    check(
      'a row carries the control that opens its own card',
      !!toggle && typeof toggle.props.onClick === 'function',
      toggle ? 'control present' : 'no toggle on the RunningHub row',
    )
    if (toggle) {
      toggle.props.onClick()
      opened = await settle(settings.component, { t }, 'settings')
    }
  } finally {
    globalThis.fetch = real
  }

  const cardIds = nodesOf(tree)
    .filter((node) => node.props && node.props['data-generate-provider-card'])
    .map((node) => node.props['data-generate-provider-card'])
  check(
    'the one settings page draws a row per provider, image providers first',
    cardIds.join(',') === 'runninghub,krea,comfycloud,magnific',
    JSON.stringify(cardIds),
  )

  // The hide switch (founder, 2026-09-23). ON means the Generate panel draws the
  // provider, so the switch is reversible from the row it was thrown on — and the
  // hidden row still carries its key state, because hiding is not unlinking.
  {
    const hiddenStub = stubHost({ units: [KREA], hidden: ['magnific'] })
    const realFetch = globalThis.fetch
    globalThis.fetch = hiddenStub.fetch
    let hiddenTree
    let posted = null
    try {
      hiddenTree = await settle(settings.component, { t }, 'settings-hidden')
      // The click happens WHILE the stub is installed: the handler posts, and a check
      // that restored the real fetch first would only prove that the click was ignored.
      const before = hiddenStub.calls.length
      const wrap = nodesOf(hiddenTree).find((node) => node.props && node.props['data-generate-provider-hide'] === 'krea')
      const target = wrap ? byAttr(wrap, 'data-stub', 'switch') : null
      if (target) target.props.onClick()
      posted = hiddenStub.calls.slice(before).find((call) => String(call.url).endsWith('/hidden')) || null
    } finally {
      globalThis.fetch = realFetch
    }
    const switchFor = (id) => {
      const wrap = nodesOf(hiddenTree).find((node) => node.props && node.props['data-generate-provider-hide'] === id)
      return wrap ? byAttr(wrap, 'data-stub', 'switch') : null
    }
    check(
      'every provider row carries the hide switch',
      ['runninghub', 'krea', 'comfycloud', 'magnific'].every((id) => switchFor(id) !== null),
      JSON.stringify(nodesOf(hiddenTree).filter((node) => node.props && node.props['data-generate-provider-hide']).map((node) => node.props['data-generate-provider-hide'])),
    )
    check(
      'the switch is on for the providers the panel draws, and off for the hidden one',
      (switchFor('krea') || { props: {} }).props['aria-checked'] === true && (switchFor('magnific') || { props: {} }).props['aria-checked'] === false,
      JSON.stringify(['krea', 'magnific'].map((id) => [id, switchFor(id) && switchFor(id).props['aria-checked']])),
    )
    check(
      'the switch is named, because a bare toggle says nothing about what it does',
      (switchFor('magnific') || { props: {} }).props.label === EN['settings.hide.label'] &&
        (switchFor('magnific') || { props: {} }).props.title === EN['settings.hide.hint'],
      JSON.stringify(switchFor('magnific') && switchFor('magnific').props),
    )
    check(
      'a hidden provider says so on its own row, since the panel cannot explain an absent section',
      !!byAttr(hiddenTree, 'data-generate-provider-hidden-tag', 'magnific') && !byAttr(hiddenTree, 'data-generate-provider-hidden-tag', 'krea'),
      JSON.stringify(nodesOf(hiddenTree).filter((node) => node.props && node.props['data-generate-provider-hidden-tag']).map((node) => node.props['data-generate-provider-hidden-tag'])),
    )
    check(
      'the switch is the last control in the row: identity, then the action, then the display preference',
      (() => {
        const row = byAttr(hiddenTree, 'data-generate-provider-card', 'krea')
        if (!row) return false
        const flat = nodesOf(row)
        const buttonAt = flat.findIndex((node) => node.props && node.props['data-generate-provider-toggle'] === 'krea')
        const switchAt = flat.findIndex((node) => node.props && node.props['data-generate-provider-hide'] === 'krea')
        // It is also the rightmost thing in its own flex row, which is what makes it
        // right-justified: `rowActions` is pushed right by a left margin and draws its
        // children in order.
        return buttonAt !== -1 && switchAt !== -1 && buttonAt < switchAt
      })(),
      JSON.stringify(['krea'].map((id) => nodesOf(byAttr(hiddenTree, 'data-generate-provider-card', id) || { children: [], props: {} }).filter((node) => node.props && (node.props['data-generate-provider-toggle'] || node.props['data-generate-provider-hide'])).map((node) => node.props['data-generate-provider-toggle'] || node.props['data-generate-provider-hide']))),
    )
    const before = hiddenStub.calls.length
    check(
      'clicking the switch posts the new state to that provider\'s own route',
      !!posted && posted.method === 'POST',
      JSON.stringify(posted) + ' ' + JSON.stringify(hiddenStub.calls.slice(before)),
    )
  }
  const dots = nodesOf(tree).filter((node) => node.props && node.props['data-generate-provider-dot'])
  check(
    'every row carries a credential dot that says which state it is in',
    dots.length === 4 && dots.map((node) => node.props['data-generate-provider-dot']).join(',') === 'ok,none,none,none',
    JSON.stringify(dots.map((node) => node.props['data-generate-provider-dot'])),
  )
  check(
    'every row carries its family, so the two kinds are tellable apart',
    textIn(tree).includes(EN['settings.kind.image']) && textIn(tree).includes(EN['settings.kind.workflow']),
    JSON.stringify([EN['settings.kind.image'], EN['settings.kind.workflow']]),
  )
  check(
    'a linked provider says its balance and an unlinked one says it has no key',
    (() => {
      const runninghub = byAttr(tree, 'data-generate-provider-summary', PROVIDER)
      const krea = byAttr(tree, 'data-generate-provider-summary', 'krea')
      return !!runninghub && !!krea && textIn(runninghub).includes('8,600') && textIn(krea).includes(EN['wallet.notLinked'])
    })(),
    JSON.stringify(
      nodesOf(tree)
        .filter((node) => node.props && node.props['data-generate-provider-summary'])
        .map((node) => textIn(node)),
    ),
  )
  // The funding line the founder asked for on 2026-09-23: what using a provider costs,
  // on its row, before a run is refused for it. The sentence is the client's copy keyed
  // by `funding.kind`, and the link is the page that sells it.
  const fundingRows = nodesOf(tree).filter((node) => node.props && node.props['data-generate-provider-funding'])
  check(
    'every row says what using the provider costs, in the client\'s own words',
    fundingRows.length === 4 &&
      fundingRows.map((node) => node.props['data-generate-provider-funding']).join(',') ===
        'runninghub,krea,comfycloud,magnific' &&
      textIn(fundingRows[0]).includes(EN['funding.coins']) &&
      textIn(fundingRows[1]).includes(EN['funding.balance']) &&
      textIn(fundingRows[2]).includes(EN['funding.plan']) &&
      textIn(fundingRows[3]).includes(EN['funding.credits']),
    JSON.stringify(fundingRows.map((node) => textIn(node))),
  )
  const fundingLinks = nodesOf(tree).filter(
    (node) => node.props && node.props['data-generate-provider-funding-link'],
  )
  check(
    'and each funding line links the page that sells it',
    fundingLinks.length === 4 &&
      fundingLinks.every((node) => /^https:\/\/[^/]+\/.+/.test(String(node.props.href || ''))),
    JSON.stringify(fundingLinks.map((node) => node.props.href)),
  )
  check(
    'the first-run posture opens the first unlinked card by itself',
    !!byAttr(tree, 'data-generate-provider-editor', 'krea') && !byAttr(tree, 'data-generate-provider-editor', PROVIDER),
    JSON.stringify(nodesOf(tree).filter((node) => node.props && node.props['data-generate-provider-editor']).map((node) => node.props['data-generate-provider-editor'])),
  )

  if (opened) {
    check(
      'opening a row swaps the open card: one card at a time',
      !!byAttr(opened, 'data-generate-provider-editor', PROVIDER) && !byAttr(opened, 'data-generate-provider-editor', 'krea'),
      JSON.stringify(nodesOf(opened).filter((node) => node.props && node.props['data-generate-provider-editor']).map((node) => node.props['data-generate-provider-editor'])),
    )
    check(
      'the open card carries the key field, named after its provider',
      (() => {
        const field = nodesOf(opened).find((node) => node.props && node.props.id === 'generate-key-' + PROVIDER)
        return !!field && field.type === 'input'
      })(),
      JSON.stringify(nodesOf(opened).filter((node) => node.type === 'input').map((node) => node.props.id)),
    )
    check(
      'the open card says how many workflows it has installed',
      (() => {
        const block = byAttr(opened, 'data-generate-provider-workflows', PROVIDER)
        return !!block && textIn(block).includes('1 ') && textIn(block).includes(EN['settings.workflows.one'])
      })(),
      byAttr(opened, 'data-generate-provider-workflows', PROVIDER) ? textIn(byAttr(opened, 'data-generate-provider-workflows', PROVIDER)) : 'no count',
    )
    check(
      'the open card lists the installed workflows by their own titles',
      (() => {
        const block = byAttr(opened, 'data-generate-provider-workflows', PROVIDER)
        return !!block && textIn(block).includes(KREA.title)
      })(),
      byAttr(opened, 'data-generate-provider-workflows', PROVIDER) ? textIn(byAttr(opened, 'data-generate-provider-workflows', PROVIDER)) : 'no list',
    )
    check(
      'the open card carries the install prompt, because a workflow is added by asking',
      (() => {
        const prompt = byAttr(opened, 'data-generate-add-prompt', PROVIDER)
        return !!prompt && textIn(prompt).includes('add this RunningHub workflow') && !!byAttr(opened, 'data-generate-copy-prompt', PROVIDER)
      })(),
      byAttr(opened, 'data-generate-add-prompt', PROVIDER) ? textIn(byAttr(opened, 'data-generate-add-prompt', PROVIDER)) : 'no prompt',
    )
    check(
      'the remove control names the provider it would unlink',
      !!byAttr(opened, 'data-generate-remove', PROVIDER),
      JSON.stringify(nodesOf(opened).filter((node) => node.props && node.props['data-generate-remove']).map((node) => node.props['data-generate-remove'])),
    )
  }

  check(
    'the page itself is one page, whatever the provider count',
    settingsSlots.length === 1,
    String(settingsSlots.length),
  )
}

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
const noted = await pane({ units: [KREA], note: 'subscription-inactive' }, { key: 'pane-noted' })
const opened = await pane({ units: [KREA], file: KREA_FILE }, { params: { unit: KREA.name, provider: PROVIDER }, key: 'pane-opened' })

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
  'a card carries the provider it runs on, and its section header names it',
  (() => {
    const card = byAttr(home.tree, 'data-generate-unit', KREA.name)
    const head = byAttr(home.tree, 'data-generate-section-toggle', PROVIDER)
    return !!card && card.props['data-generate-provider'] === PROVIDER && !!head && textIn(head).includes('RunningHub')
  })(),
  byAttr(home.tree, 'data-generate-unit', KREA.name) ? textIn(byAttr(home.tree, 'data-generate-unit', KREA.name)) : 'no card',
)
check(
  'no thumbnail is drawn: the card is icon, label and one line (founder, 2026-09-23)',
  (() => {
    const card = byAttr(home.tree, 'data-generate-unit', KREA.name)
    return !!card && !nodesOf(card).some((node) => node.type === 'img')
  })(),
  'the adapter carries a cover; the card no longer draws it',
)
check(
  'a community app says whose work it is',
  textIn(byAttr(home.tree, 'data-generate-unit', QWEN.name)).includes(EN['card.community']),
  textIn(byAttr(home.tree, 'data-generate-unit', QWEN.name)),
)
check(
  'the home screen asks the host for the list, once',
  home.calls.filter((call) => call.url === providerUrl('workflows')).length === 1,
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

// ── the home screen's accordion: one section per provider, all of them ──────
//
// THE SHAPE THE FOUNDER ASKED FOR (2026-09-23): "I want to try stacked accordion to
// each provider inside an accordion", with one section per provider — all four, not
// only the linked ones, because a section is where that provider's add card lives. One
// section is open at a time. The card inside a section is the harness's own start-page
// card: icon, label, one line under it, no thumbnail.

const sectionIds = (tree) =>
  nodesOf(tree)
    .filter((node) => node.props && node.props['data-generate-section-toggle'])
    .map((node) => node.props['data-generate-section-toggle'])

check(
  'the home screen is a stacked accordion, one section per provider, in registry order',
  sectionIds(home.tree).join(',') === 'runninghub,krea,comfycloud,magnific',
  JSON.stringify(sectionIds(home.tree)),
)

// Hiding a provider is a display preference, not a link (founder, 2026-09-23: *"I want a
// toggle inside settings to hide providers that I don't use much for less visual
// clutter"*). The panel draws the ones switched on, and it says what happened when that
// is none of them rather than looking like an install that lost its workflows.
{
  const hidOne = await pane({ units: [KREA, QWEN], hidden: ['krea'] }, { key: 'pane-hidden-one' })
  check(
    'a provider switched off in Settings is not drawn in the panel',
    sectionIds(hidOne.tree).join(',') === 'runninghub,comfycloud,magnific',
    JSON.stringify(sectionIds(hidOne.tree)),
  )
  check(
    'and the section count follows what is drawn, not the registry',
    (byAttr(hidOne.tree, 'data-generate-sections') || { props: {} }).props['data-generate-sections'] === '3',
    JSON.stringify((byAttr(hidOne.tree, 'data-generate-sections') || { props: {} }).props),
  )
  const hidOwner = await pane({ units: [KREA, QWEN], hidden: ['runninghub'] }, { key: 'pane-hidden-owner' })
  check(
    'hiding the provider that holds the workflows takes its cards out with it',
    !byAttr(hidOwner.tree, 'data-generate-unit', KREA.name) && !byAttr(hidOwner.tree, 'data-generate-unit', QWEN.name),
    'a hidden section must not leave its cards behind',
  )
  const hidAll = await pane({ units: [KREA, QWEN], hidden: ['runninghub', 'krea', 'comfycloud', 'magnific'] }, { key: 'pane-hidden-all' })
  check(
    'with every provider switched off the panel says so, and names the page holding the switches',
    !!byAttr(hidAll.tree, 'data-generate-all-hidden', 'yes') &&
      textIn(hidAll.tree).includes(EN['pane.hidden.title']) &&
      textIn(hidAll.tree).includes(EN['pane.hidden.body']),
    textIn(hidAll.tree).slice(0, 200),
  )
}

// The switch and the panel are on screen at the same time: Settings is a dialog over
// the app, so the pane behind it never unmounts while a switch is thrown. They used to
// hold a copy of the provider list each, which is why a hide only showed up after an
// app restart (founder, 2026-09-23: *"I tested toggle and it works if I restart"*).
// One shared list now, so the click reaches the panel that is already mounted.
{
  const stub = stubHost({ units: [KREA, QWEN] })
  const real = globalThis.fetch
  globalThis.fetch = stub.fetch
  let paneTree
  try {
    // The panel first, then Settings over it — the order the app mounts them in.
    paneTree = await settle(paneSlot.component, { t }, 'shared-pane')
    const settingsTree = await settle(settingsSlots[0].component, { t }, 'shared-settings')
    const wrap = nodesOf(settingsTree).find((node) => node.props && node.props['data-generate-provider-hide'] === 'krea')
    const target = wrap ? byAttr(wrap, 'data-stub', 'switch') : null
    if (target) target.props.onClick()
    // Drawn again under the SAME key: nothing remounts and the panel asks the host for
    // nothing, so whatever it draws now is what the click did.
    const readsBefore = stub.calls.filter((call) => call.url === PROVIDERS_API).length
    paneTree = await settle(paneSlot.component, { t }, 'shared-pane')
    check(
      'the panel is not re-read to show the hide: the switch moves the list every surface holds',
      stub.calls.filter((call) => call.url === PROVIDERS_API).length === readsBefore,
      JSON.stringify(stub.calls.map((call) => call.url)),
    )
  } finally {
    globalThis.fetch = real
  }
  check(
    'a switch thrown in Settings reaches the panel already on screen, without a restart',
    sectionIds(paneTree).join(',') === 'runninghub,comfycloud,magnific',
    JSON.stringify(sectionIds(paneTree)),
  )
}
check(
  'a section header names its provider and says what the section holds',
  (() => {
    const head = byAttr(home.tree, 'data-generate-section-toggle', PROVIDER)
    const text = head ? textIn(head) : ''
    return text.includes('RunningHub') && text.includes(EN['settings.kind.workflow']) && text.includes('2')
  })(),
  byAttr(home.tree, 'data-generate-section-toggle', PROVIDER) ? textIn(byAttr(home.tree, 'data-generate-section-toggle', PROVIDER)) : 'no header',
)
check(
  'an image provider is tagged as one, and says it has nothing installed',
  (() => {
    const head = byAttr(home.tree, 'data-generate-section-toggle', 'krea')
    const text = head ? textIn(head) : ''
    return text.includes('Krea') && text.includes(EN['settings.kind.image']) && text.includes(EN['pane.section.none'])
  })(),
  byAttr(home.tree, 'data-generate-section-toggle', 'krea') ? textIn(byAttr(home.tree, 'data-generate-section-toggle', 'krea')) : 'no header',
)
check(
  'the section that has workflows opens by itself; the empty ones stay shut',
  !!byAttr(home.tree, 'data-generate-section-body', PROVIDER) &&
    !byAttr(home.tree, 'data-generate-section-body', 'krea') &&
    !byAttr(home.tree, 'data-generate-section-body', 'comfycloud'),
  JSON.stringify(sectionIds(home.tree)),
)
check(
  'the open section carries its own workflows, and only its own',
  (() => {
    const body = byAttr(home.tree, 'data-generate-section-body', PROVIDER)
    const names = body
      ? nodesOf(body)
          .filter((node) => node.props && node.props['data-generate-unit'])
          .map((node) => node.props['data-generate-unit'])
      : []
    return names.join(',') === KREA.name + ',' + QWEN.name
  })(),
  'a card under the wrong provider is a card that runs somewhere else',
)

// The section header's status light, and the wallet as the header's own second row
// (founder, 2026-09-23: *"move the wall balance to row 2 below accordion title. change
// icon to status indictor; green=ready, amber=key good-no workflow, red=no key"*).
// Three states, one per fact the pane knows before a section is opened, and the balance
// reads under the name it belongs to instead of in a strip above the accordion.
{
  const lightOf = (tree, id) => {
    const head = byAttr(tree, 'data-generate-section-toggle', id)
    return head ? byAttr(head, 'data-generate-section-state') : null
  }
  const lightState = (tree, id) => (lightOf(tree, id) ? lightOf(tree, id).props['data-generate-section-state'] : null)
  const lightWords = (tree, id) => (lightOf(tree, id) ? lightOf(tree, id).props.title : null)
  const heads = ['runninghub', 'krea', 'comfycloud', 'magnific']

  check(
    'a section that can run wears a green light, and the light carries its own sentence',
    lightState(home.tree, PROVIDER) === 'ready' && lightWords(home.tree, PROVIDER) === EN['pane.light.ready'],
    JSON.stringify([lightState(home.tree, PROVIDER), lightWords(home.tree, PROVIDER)]),
  )
  check(
    'a key with nothing installed is amber, not green: a key is not a workflow',
    lightState(empty.tree, PROVIDER) === 'keyOnly' && lightWords(empty.tree, PROVIDER) === EN['pane.light.keyOnly'],
    JSON.stringify([lightState(empty.tree, PROVIDER), lightWords(empty.tree, PROVIDER)]),
  )
  check(
    'a provider with no key is red, which is the one thing its section can say',
    lightState(home.tree, 'krea') === 'noKey' && lightWords(home.tree, 'krea') === EN['pane.light.noKey'],
    JSON.stringify([lightState(home.tree, 'krea'), lightWords(home.tree, 'krea')]),
  )
  check(
    'an unconfirmed key is amber with its own sentence, never amber claiming an empty section',
    lightState(noted.tree, PROVIDER) === 'unchecked' && lightWords(noted.tree, PROVIDER) === EN['settings.linked.unverified'],
    JSON.stringify([lightState(noted.tree, PROVIDER), lightWords(noted.tree, PROVIDER)]),
  )
  check(
    'the colour is never the only carrier: every light has a sentence for its state',
    heads.every((id) => typeof lightWords(home.tree, id) === 'string' && lightWords(home.tree, id) !== ''),
    JSON.stringify(heads.map((id) => lightWords(home.tree, id))),
  )
  check(
    'a provider that was refused or is no longer linked is not drawn as ready',
    lightState(home.tree, PROVIDER) === 'ready' && !heads.some((id) => id !== PROVIDER && lightState(home.tree, id) === 'ready'),
    JSON.stringify(heads.map((id) => [id, lightState(home.tree, id)])),
  )

  const header = byAttr(home.tree, 'data-generate-section-toggle', PROVIDER)
  const balanceRow = byAttr(home.tree, 'data-generate-provider-strip', PROVIDER)
  const balanceRows = nodesOf(home.tree).filter((node) => node.props && node.props['data-generate-provider-strip'])
  check(
    'the wallet balance is the header\'s own row, inside the section it belongs to',
    !!header && !!balanceRow && nodesOf(header).includes(balanceRow) && textIn(balanceRow).includes('8,600'),
    balanceRow ? textIn(balanceRow) : 'no balance row',
  )
  check(
    'the strip above the accordion is gone: one balance row per provider, each in its header',
    balanceRows.length === heads.length &&
      heads.every((id) => {
        const head = byAttr(home.tree, 'data-generate-section-toggle', id)
        const row = byAttr(home.tree, 'data-generate-provider-strip', id)
        return !!head && !!row && nodesOf(head).includes(row)
      }),
    JSON.stringify(balanceRows.map((node) => node.props['data-generate-provider-strip'])),
  )
  check(
    'name · balance · count is the order the header owes',
    (() => {
      if (!header || !balanceRow) return false
      const flat = nodesOf(header)
      const nameAt = flat.findIndex((node) => textIn(node) === 'RunningHub')
      const balanceAt = flat.indexOf(balanceRow)
      const metaAt = flat.findIndex((node) => node.props && node.props['data-generate-section-meta'] === PROVIDER)
      return nameAt !== -1 && balanceAt !== -1 && metaAt !== -1 && nameAt < balanceAt && balanceAt < metaAt
    })(),
    header ? textIn(header) : 'no header',
  )
  check(
    'an unlinked provider says its state in words rather than drawing an empty wallet',
    textIn(byAttr(home.tree, 'data-generate-provider-strip', 'krea')).includes(EN['wallet.notLinked']),
    textIn(byAttr(home.tree, 'data-generate-provider-strip', 'krea')),
  )
  check(
    'the way out to the account page is the glyph beside the provider\'s name',
    (() => {
      const link = byAttr(home.tree, 'data-generate-account', PROVIDER)
      if (!link || !header || !nodesOf(header).includes(link)) return false
      // Row 1: the name, then the glyph, and only then the balance of row 2.
      const flat = nodesOf(header)
      const nameAt = flat.findIndex((node) => textIn(node) === 'RunningHub')
      const linkAt = flat.indexOf(link)
      const balanceAt = flat.indexOf(balanceRow)
      return nameAt !== -1 && linkAt !== -1 && balanceAt !== -1 && nameAt < linkAt && linkAt < balanceAt
    })(),
    'the glyph travels with the name it belongs to, not below it',
  )
  check(
    'a click on the way out does not fold the section it sits in',
    (() => {
      const link = byAttr(home.tree, 'data-generate-account', PROVIDER)
      if (!link || typeof link.props.onClick !== 'function') return false
      let stopped = false
      link.props.onClick({ stopPropagation: () => { stopped = true } })
      return stopped
    })(),
    'the header is the toggle, and the link inside it is not',
  )
  check(
    'the glyph is labelled, because an icon alone names nothing',
    (() => {
      const link = byAttr(home.tree, 'data-generate-account', PROVIDER)
      return !!link && link.props.title === EN['settings.account'] && link.props['aria-label'] === EN['settings.account']
    })(),
    byAttr(home.tree, 'data-generate-account', PROVIDER) ? JSON.stringify(byAttr(home.tree, 'data-generate-account', PROVIDER).props.title) : 'no glyph',
  )
  check(
    'the header is the toggle, keyboard included, since it is a role and not a button',
    (() => {
      if (!header || header.props.role !== 'button' || header.props.tabIndex !== 0) return false
      if (typeof header.props.onKeyDown !== 'function') return false
      let prevented = 0
      header.props.onKeyDown({ key: 'Enter', preventDefault: () => { prevented += 1 } })
      header.props.onKeyDown({ key: 'a', preventDefault: () => { prevented += 1 } })
      // Enter folds the section and is stopped from doing anything else; a letter is
      // not the toggle's key and gets no such treatment.
      return prevented === 1
    })(),
    header ? JSON.stringify({ role: header.props.role, tabIndex: header.props.tabIndex }) : 'no header',
  )

  // The model marks (founder, 2026-09-23: *"can you use logo for Krea WF"*, then the
  // Qwen mark from Wikimedia Commons). A one-colour mark is a MASK painted in the
  // card's own colour, so it needs no dark-theme inverse; a mark that carries its own
  // colours is drawn as an image, because a mask would read its white negative space
  // as opaque and fill the mark in. A workflow that names no known model keeps the
  // generic branch glyph.
  check(
    "a Krea workflow wears the Krea mark, as a mask in the card's own colour",
    (() => {
      const card = byAttr(home.tree, 'data-generate-unit', KREA.name)
      const mark = card ? byAttr(card, 'data-generate-mark') : null
      if (!mark) return false
      const s = mark.props.style
      // `currentColor` is the whole point: one asset, both themes.
      return (
        mark.type === 'span' &&
        typeof s.WebkitMaskImage === 'string' &&
        s.WebkitMaskImage.startsWith('url("data:image/png;base64,') &&
        s.maskImage === s.WebkitMaskImage &&
        s.backgroundColor === 'currentColor' &&
        !nodesOf(card).some((node) => node.type === 'img')
      )
    })(),
    'a mask paints the shape from the file\'s alpha, so the file\'s own colour is irrelevant',
  )
  check(
    "a Qwen workflow wears LobeHub's Color mark: the gradient as it came, not a mask",
    (() => {
      const card = byAttr(home.tree, 'data-generate-unit', QWEN.name)
      const mark = card ? byAttr(card, 'data-generate-mark') : null
      if (!mark) return false
      // The founder picked Color over Avatar (2026-09-23), so the tile is gone: an
      // image, its own gradient, and no avatar node anywhere on the card.
      return (
        mark.type === 'img' &&
        mark.props.alt === '' &&
        String(mark.props.src).startsWith('data:image/svg+xml;base64,') &&
        mark.props.style.objectFit === 'contain' &&
        !mark.props.style.WebkitMaskImage &&
        !byAttr(card, 'data-generate-avatar-mark')
      )
    })(),
    'the -color file their Color component renders: own colours, no tile',
  )
  // Its own fixture, so the panes above keep their unit counts: a workflow whose name
  // names no known model must still get a card, with the generic glyph.
  const plainPane = await pane({ units: [PLAIN] }, { key: 'pane-plain' })
  check(
    'a workflow that names no known model keeps the generic glyph',
    (() => {
      const card = byAttr(plainPane.tree, 'data-generate-unit', PLAIN.name)
      return !!card && !byAttr(card, 'data-generate-mark')
    })(),
    'the mark is a bonus, not a requirement: an unknown app still gets a card',
  )
  const minimaxPane = await pane({ units: [MINIMAX] }, { key: 'pane-minimax' })
  check(
    'a MiniMax workflow wears the MiniMax Color mark: its own gradient, not a mask',
    (() => {
      const card = byAttr(minimaxPane.tree, 'data-generate-unit', MINIMAX.name)
      const mark = card ? byAttr(card, 'data-generate-mark') : null
      if (!mark) return false
      return (
        mark.type === 'img' &&
        mark.props.alt === '' &&
        String(mark.props.src).startsWith('data:image/svg+xml;base64,') &&
        mark.props.style.objectFit === 'contain' &&
        !mark.props.style.WebkitMaskImage
      )
    })(),
    'the founder picked Color over the mono mark, so no workflow is on the mask path but Krea',
  )

  const refresh = byAttr(home.tree, 'data-generate-refresh', PROVIDER)
  check(
    'the refresh control lives in the header, right of the balance, and the pane keeps no foot row for it',
    (() => {
      if (!refresh || !header || !nodesOf(header).includes(refresh)) return false
      const flat = nodesOf(header)
      const balanceAt = flat.indexOf(balanceRow)
      const refreshAt = flat.indexOf(refresh)
      // Left to right: name, balance, then the control that re-reads it. The label is
      // no longer drawn anywhere, because the foot-of-pane button that carried it is
      // gone (founder, 2026-09-23: *"refresh the balance move to header"*).
      return balanceAt !== -1 && refreshAt !== -1 && balanceAt < refreshAt && !textIn(home.tree).includes('Refresh the balance')
    })(),
    header ? textIn(header) : 'no header',
  )
  check(
    'the refresh is named for what it does, since it is drawn as a glyph',
    !!refresh && refresh.props['aria-label'] === EN['wallet.refresh'] && tooltipOn(home.tree, 'data-generate-refresh', PROVIDER)?.props.label === EN['wallet.refresh'],
    refresh ? JSON.stringify({ label: refresh.props['aria-label'], tooltip: tooltipOn(home.tree, 'data-generate-refresh', PROVIDER)?.props.label }) : 'no refresh control',
  )
  check(
    'the refresh is its own control, not the header toggle it sits inside',
    !!refresh && typeof refresh.props.onClick === 'function' && !!header && refresh.props.onClick !== header.props.onClick,
    'a refresh that folded the section would be the toggle twice',
  )
  // The add glyph moved out of the body and next to refresh (founder, 2026-09-23:
  // *"move + workflow button as an icon button next to refresh"*). The order is pinned
  // rather than the presence, so a later edit that puts it back in the body fails.
  check(
    'the add glyph sits beside the refresh it was moved next to, on its left',
    (() => {
      if (!header) return false
      const flat = nodesOf(header)
      const addAt = flat.findIndex((node) => node.props && node.props['data-generate-add-button'] === PROVIDER)
      const refreshAt = flat.indexOf(refresh)
      return addAt !== -1 && refreshAt !== -1 && addAt < refreshAt
    })(),
    JSON.stringify(
      nodesOf(header || { children: [] })
        .filter((node) => node.props && (node.props['data-generate-add-button'] || node.props['data-generate-refresh']))
        .map((node) => node.props['data-generate-add-button'] || node.props['data-generate-refresh']),
    ),
  )

  // ONE SECTION IS ONE CARD (founder, 2026-09-23): the card is the section, so opening
  // one grows that card instead of stacking a second one under the header.
  check(
    'the section is the card: the border and radius are the section\'s, and the header keeps none of its own',
    (() => {
      const wrap = byAttr(home.tree, 'data-generate-section-wrap', PROVIDER)
      if (!wrap || !header) return false
      const box = wrap.props.style
      const head = header.props.style
      return box.borderRadius === 12 &&
        box.background === 'var(--dsw-alias-bg-layer-1)' &&
        /^\.5px solid /.test(box.border) &&
        head.border === 'none' &&
        head.background === 'transparent'
    })(),
    byAttr(home.tree, 'data-generate-section-wrap', PROVIDER)
      ? JSON.stringify(byAttr(home.tree, 'data-generate-section-wrap', PROVIDER).props.style)
      : 'no section',
  )
  check(
    'the open body is held inside that same card, under the header',
    (() => {
      const wrap = byAttr(home.tree, 'data-generate-section-wrap', PROVIDER)
      const body = byAttr(home.tree, 'data-generate-section-body', PROVIDER)
      return !!wrap && !!body && nodesOf(wrap).includes(header) && nodesOf(wrap).includes(body)
    })(),
    'a body outside the card would be the second card the change removed',
  )

  // The workflow card is the harness's start-page card at the size that card actually
  // has (the guide's `.entry`: 380px wide, a 56px floor, 24px radius, a half-pixel
  // border), so a card keeps its size inside the section card.
  check(
    'a workflow card is the start-page card at its own size: 380 wide, 56 tall, 24 radius',
    (() => {
      const card = byAttr(home.tree, 'data-generate-unit', KREA.name)
      if (!card) return false
      const s = card.props.style
      return s.width === 380 && s.maxWidth === '100%' && s.minHeight === 56 && s.borderRadius === 24 && /^\.5px solid /.test(s.border)
    })(),
    byAttr(home.tree, 'data-generate-unit', KREA.name)
      ? JSON.stringify(byAttr(home.tree, 'data-generate-unit', KREA.name).props.style)
      : 'no card',
  )
}

// Opening a section is what makes its cards reachable, and the accordion holds one
// open at a time: opening Krea's must close RunningHub's.
{
  const real = globalThis.fetch
  globalThis.fetch = stubHost({ units: [KREA, QWEN] }).fetch
  try {
    const before = await settle(paneSlot.component, { t }, 'pane-accordion')
    const toggle = byAttr(before, 'data-generate-section-toggle', 'krea')
    check(
      'a closed section is still a control that opens it',
      !!toggle && typeof toggle.props.onClick === 'function',
      toggle ? 'control present' : 'no toggle on the Krea section',
    )
    if (toggle) toggle.props.onClick()
    const after = await settle(paneSlot.component, { t }, 'pane-accordion')
    check(
      'opening a section closes the open one: one section at a time',
      !!byAttr(after, 'data-generate-section-body', 'krea') && !byAttr(after, 'data-generate-section-body', PROVIDER),
      JSON.stringify(sectionIds(after)),
    )
  } finally {
    globalThis.fetch = real
  }
}

// The add control is the pane's one install control, and it is the harness's own
// Button plus its own CodeBlock (founder, 2026-09-23: "+ workflow is a button
// primitive", "click on + workflow is a code snippet primitive"). It moved out of the
// section body and into the header, beside refresh, as a glyph (founder, 2026-09-23:
// *"move + workflow button as an icon button next to refresh"*). Its click has to yield
// THAT provider's own prompt, because the phrase the agent's skill answers to names the
// provider.
{
  const real = globalThis.fetch
  globalThis.fetch = stubHost({ units: [] }).fetch
  try {
    const first = await settle(paneSlot.component, { t }, 'pane-add-card')
    const button = byAttr(first, 'data-generate-add-button', PROVIDER)
    const header = byAttr(first, 'data-generate-section-toggle', PROVIDER)
    check(
      'a provider with nothing installed carries the add control in its header, as a glyph',
      !!button && !!header && nodesOf(header).includes(button),
      button ? JSON.stringify({ stub: button.props['data-stub'] }) : 'no add control',
    )
    check(
      'the add control is the Button primitive, carrying the plus as its icon',
      !!button && button.props['data-stub'] === 'button' && !!nodesOf(button).find((node) => node.props && node.props['data-stub'] === 'plus'),
      button ? JSON.stringify({ stub: button.props['data-stub'] }) : 'no add control',
    )
    check(
      'the glyph says what it does on hover, and wears the same words as its accessible name',
      !!button && tooltipOn(first, 'data-generate-add-button', PROVIDER)?.props.label === EN['pane.add.button'] && button.props['aria-label'] === EN['pane.add.button'],
      JSON.stringify({
        tooltip: tooltipOn(first, 'data-generate-add-button', PROVIDER)?.props.label,
        label: button && button.props['aria-label'],
      }),
    )
    check(
      'the prompt is not on screen until the glyph is clicked',
      !byAttr(first, 'data-generate-add-prompt', PROVIDER),
      'the sentence and the prompt stay behind the click',
    )
    if (button) button.props.onClick({ stopPropagation: () => {} })
    const after = await settle(paneSlot.component, { t }, 'pane-add-card')
    check(
      "clicking the add control yields that provider's own prompt",
      textIn(after).includes(EN['settings.workflows.add']) &&
        (() => {
          const block = byAttr(after, 'data-generate-add-prompt', PROVIDER)
          const code = block ? nodesOf(block).find((node) => node.props && node.props['data-stub'] === 'code') : null
          return !!code && textIn(code).trim() === 'add this RunningHub workflow <app link>'
        })(),
      textIn(after).slice(0, 240),
    )
    check(
      "the snippet is the primitive whole: its own header bar, and its own Copy on the right",
      (() => {
        const block = byAttr(after, 'data-generate-add-prompt', PROVIDER)
        if (!block) return false
        const inner = nodesOf(block).find((node) => node.props && node.props['data-stub'] === 'code-block')
        const header = nodesOf(block).find((node) => node.props && node.props['data-stub'] === 'code-header')
        const copy = nodesOf(block).find((node) => node.props && node.props['data-stub'] === 'code-copy')
        // The header is ON (the owner asked for the primitive's own bar), the Copy
        // control is the primitive's, it carries our words, and the pane draws no
        // second copy control of its own beside the block.
        return (
          !!inner &&
          inner.props.showHeader === true &&
          !!header &&
          !!copy &&
          textIn(copy) === EN['settings.workflows.copy'] &&
          !byAttr(after, 'data-generate-copy-prompt', PROVIDER)
        )
      })(),
      (() => {
        const block = byAttr(after, 'data-generate-add-prompt', PROVIDER)
        return block ? JSON.stringify(nodesOf(block).filter((node) => node.props && node.props['data-stub']).map((node) => node.props['data-stub'])) : 'no snippet'
      })(),
    )
    check(
      'the glyph is a toggle: it says whether the prompt is open',
      (() => {
        const open = byAttr(after, 'data-generate-add-button', PROVIDER)
        return !!button && button.props['aria-expanded'] === 'false' && !!open && open.props['aria-expanded'] === 'true'
      })(),
      JSON.stringify([button && button.props['aria-expanded'], byAttr(after, 'data-generate-add-button', PROVIDER)?.props['aria-expanded']]),
    )
  } finally {
    globalThis.fetch = real
  }
}

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
  opened.calls.some((call) => String(call.url).startsWith(providerUrl('workflow') + '?name=' + KREA.name)),
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
  "a door control carries the app's own bounds, and opens where the adapter says",
  (() => {
    const megapixels = byAttr(opened.tree, 'data-generate-door', 'megapixels')
    return (
      !!megapixels &&
      megapixels.props.type === 'number' &&
      // The fixture authors 2 for this door while the app declares 1: the bounds stay
      // the app's, the starting value is the owner's (`ui.defaults`).
      megapixels.props.value === 2 &&
      megapixels.props.min === 0.1 &&
      megapixels.props.max === 16 &&
      megapixels.props.step === 0.1
    )
  })(),
  JSON.stringify(byAttr(opened.tree, 'data-generate-door', 'megapixels') && byAttr(opened.tree, 'data-generate-door', 'megapixels').props),
)
check(
  'a door the adapter says nothing about still opens on the app\'s own default',
  (() => {
    const scale = byAttr(opened.tree, 'data-generate-door', 'scaleBy')
    return !!scale && scale.props.value === 1
  })(),
  JSON.stringify(byAttr(opened.tree, 'data-generate-door', 'scaleBy') && byAttr(opened.tree, 'data-generate-door', 'scaleBy').props),
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
  const after = await settle(paneSlot.component, { t, useTabInfo: () => ({ tab: { navigation: { params: { unit: KREA.name, provider: PROVIDER }, revision: 1 } } }) }, 'pane-opened')
  check(
    'opening the disclosure adds the advanced doors, and they carry their own bounds',
    before === 4 && rowsRendered(after).length === 7,
    JSON.stringify({ before, after: rowsRendered(after) }),
  )
}

// ── nothing installed, and a host that cannot answer ────────────────────────

check(
  'nothing installed: the section says so and names the header glyph, instead of an empty box',
  (() => {
    const box = byAttr(empty.tree, 'data-generate-none', PROVIDER)
    return (
      !!box &&
      !!byAttr(box, 'data-generate-section-empty', PROVIDER) &&
      textIn(box).includes(EN['pane.section.empty']) &&
      !!byAttr(empty.tree, 'data-generate-add-button', PROVIDER)
    )
  })(),
  byAttr(empty.tree, 'data-generate-none', PROVIDER) ? textIn(byAttr(empty.tree, 'data-generate-none', PROVIDER)) : 'no empty section',
)
check(
  'nothing installed: every provider still has a section to fill',
  sectionIds(empty.tree).join(',') === 'runninghub,krea,comfycloud,magnific',
  JSON.stringify(sectionIds(empty.tree)),
)
check(
  'nothing installed: the key directions are still there, below the sections',
  (() => {
    const nodes = nodesOf(empty.tree)
    const sectionAt = nodes.findIndex((node) => node.props && node.props['data-generate-none'])
    const manageAt = nodes.findIndex((node) => node.props && node.props['data-generate-manage-hint'] === 'yes')
    return sectionAt !== -1 && manageAt !== -1 && sectionAt < manageAt
  })(),
  'strip · sections · the directions is the order the pane owes',
)
check(
  'a host that cannot answer says so, instead of looking like an empty install',
  !!byAttr(failed.tree, 'data-generate-list-failed', 'yes') &&
    !nodesOf(failed.tree).some((node) => node.props && node.props['data-generate-none']) &&
    !byAttr(failed.tree, 'data-generate-add-button') &&
    !!byAttr(failed.tree, 'data-generate-pane') &&
    byAttr(failed.tree, 'data-generate-pane').props['data-generate-pane'] === 'home',
  textIn(failed.tree).slice(0, 160),
)
check(
  'one failed read does not take the wallet strip with it',
  !!byAttr(failed.tree, 'data-generate-source'),
  '',
)

// ── S5: the gate, the run and the result ────────────────────────────────────
//
// Founder, 2026-09-23: *"i want s5 for krea"*. A runnable surface offers the run; the
// control opens the gate rather than submitting; nothing is posted without the person's
// own confirm; and what comes back is drawn. The host's half of these rules is
// verify/run.mjs — this is the half a person touches.
{
  const props = {
    t,
    useTabInfo: () => ({ tab: { navigation: { params: { unit: MODEL_UNIT.name, provider: 'krea' }, revision: 1 } } }),
  }
  const stub = stubHost({ units: [], kreaUnits: [MODEL_UNIT], file: MODEL, jobStates: ['running', 'done'] })
  const real = globalThis.fetch
  globalThis.fetch = stub.fetch
  let tree
  let gate
  try {
    tree = await settle(paneSlot.component, props, 'pane-run')
    const runButton = byAttr(tree, 'data-generate-run', MODEL_UNIT.name)
    check(
      'a surface that can run offers the run, labelled by the adapter itself',
      !!runButton && textIn(runButton) === 'Generate',
      runButton ? textIn(runButton) : 'no run control',
    )
    check('nothing is posted until that control is pressed', stub.runs.length === 0, JSON.stringify(stub.runs))

    if (runButton) runButton.props.onClick()
    gate = await settle(paneSlot.component, props, 'pane-run')
    check(
      'the run control opens the gate rather than submitting',
      !!byAttr(gate, 'data-generate-gate', MODEL_UNIT.name) && stub.runs.length === 0,
      JSON.stringify({ gate: !!byAttr(gate, 'data-generate-gate', MODEL_UNIT.name), runs: stub.runs.length }),
    )
    check(
      'the gate names the model and where the request goes',
      textIn(gate).includes('Krea 2 Medium Turbo') && textIn(gate).includes('/generate/image/krea/krea-2/medium-turbo'),
      textIn(gate).slice(0, 200),
    )
    check(
      'a required door that is still empty is named, and the confirm is blocked',
      !!byAttr(gate, 'data-generate-gate-missing', 'prompt') &&
        (byAttr(gate, 'data-generate-gate-confirm', 'yes') || { props: {} }).props.disabled === true,
      JSON.stringify(byAttr(gate, 'data-generate-gate-missing', 'prompt') ? textIn(byAttr(gate, 'data-generate-gate-missing', 'prompt')) : 'no missing line'),
    )
    check(
      'the request itself sits behind one disclosure, closed until it is asked for',
      !nodesOf(gate).some((node) => node.props && node.props['data-generate-gate-code']) && !!byAttr(gate, 'data-generate-gate-request'),
      'a gate that shows the JSON unasked is a wall of text',
    )

    // Cancel returns to the form with every value intact — the rule that makes the gate a
    // gate rather than a trap.
    const cancel = byAttr(gate, 'data-generate-gate-cancel', 'yes')
    if (cancel) cancel.props.onClick()
    const backAtForm = await settle(paneSlot.component, props, 'pane-run')
    const promptDoor = nodesOf(backAtForm).find((node) => node.props && node.props['data-generate-door'] === 'prompt')
    check(
      'cancelling returns to the form, with the doors still there',
      !byAttr(backAtForm, 'data-generate-gate', MODEL_UNIT.name) && !!promptDoor,
      promptDoor ? 'the form is back' : 'no door after cancelling',
    )
    if (promptDoor) promptDoor.props.onChange({ target: { value: 'a cinematic glass cabin' } })

    const typed = await settle(paneSlot.component, props, 'pane-run')
    const again = byAttr(typed, 'data-generate-run', MODEL_UNIT.name)
    if (again) again.props.onClick()
    gate = await settle(paneSlot.component, props, 'pane-run')
    check(
      'with the required door filled the confirm is live, and not before',
      !byAttr(gate, 'data-generate-gate-missing', 'prompt') &&
        (byAttr(gate, 'data-generate-gate-confirm', 'yes') || { props: {} }).props.disabled !== true,
      JSON.stringify((byAttr(gate, 'data-generate-gate-confirm', 'yes') || { props: {} }).props.disabled),
    )

    const showRequest = byAttr(gate, 'data-generate-gate-request')
    if (showRequest) showRequest.props.onClick()
    const disclosed = await settle(paneSlot.component, props, 'pane-run')
    check(
      'the disclosure shows the resolved request, as JSON to read',
      (() => {
        const block = nodesOf(disclosed).find((node) => node.props && node.props['data-generate-gate-code'] === MODEL_UNIT.name)
        const code = block ? nodesOf(block).find((node) => node.props && node.props['data-stub'] === 'code') : null
        return !!code && textIn(code).includes('"prompt"') && textIn(code).includes('a cinematic glass cabin')
      })(),
      'the gate must show what will leave the machine',
    )

    const confirm = byAttr(disclosed, 'data-generate-gate-confirm', 'yes')
    if (confirm) confirm.props.onClick()
    const started = await settle(paneSlot.component, props, 'pane-run')
    check(
      "confirming is what posts the run, with the person's own flag on it",
      stub.runs.length === 1 && stub.runs[0].confirmed === true && stub.runs[0].name === MODEL_UNIT.name && stub.runs[0].values.prompt === 'a cinematic glass cabin',
      JSON.stringify(stub.runs),
    )
    check(
      'the strip says the run is in flight, with its job id beside the phase',
      !!byAttr(started, 'data-generate-run-strip', 'running') && !!byAttr(started, 'data-generate-run-job', 'job-1'),
      JSON.stringify(nodesOf(started).filter((node) => node.props && (node.props['data-generate-run-strip'] || node.props['data-generate-run-job'])).map((node) => node.props['data-generate-run-strip'] || node.props['data-generate-run-job'])),
    )

    // One poll by hand, which is what the interval would have done two seconds later.
    const poll = timers[timers.length - 1]
    if (poll) poll()
    const done = await settle(paneSlot.component, props, 'pane-run')
    check(
      'the finished run is drawn: the image the provider returned, and a way to open it',
      (() => {
        const result = byAttr(done, 'data-generate-result', 'https://gen.krea.ai/out.png')
        const image = result ? nodesOf(result).find((node) => node.type === 'img') : null
        return !!result && !!image && image.props.src === 'https://gen.krea.ai/out.png' && !!byAttr(done, 'data-generate-result-url', 'https://gen.krea.ai/out.png')
      })(),
      JSON.stringify(nodesOf(done).filter((node) => node.props && node.props['data-generate-result']).map((node) => node.props['data-generate-result'])),
    )
  } finally {
    globalThis.fetch = real
  }
}

// A run that fails says whose words it is: the provider's message verbatim, plus the run
// id, plus a way back to the form.
{
  const props = {
    t,
    useTabInfo: () => ({ tab: { navigation: { params: { unit: MODEL_UNIT.name, provider: 'krea' }, revision: 1 } } }),
  }
  const stub = stubHost({ units: [], kreaUnits: [MODEL_UNIT], file: MODEL, jobStates: ['failed'], jobError: { code: 'content', message: 'the model refused this prompt' } })
  const real = globalThis.fetch
  globalThis.fetch = stub.fetch
  try {
    let tree = await settle(paneSlot.component, props, 'pane-run-failed')
    const door = nodesOf(tree).find((node) => node.props && node.props['data-generate-door'] === 'prompt')
    if (door) door.props.onChange({ target: { value: 'something Krea will not draw' } })
    const typed = await settle(paneSlot.component, props, 'pane-run-failed')
    const runButton = byAttr(typed, 'data-generate-run', MODEL_UNIT.name)
    if (runButton) runButton.props.onClick()
    const gate = await settle(paneSlot.component, props, 'pane-run-failed')
    const confirm = byAttr(gate, 'data-generate-gate-confirm', 'yes')
    if (confirm) confirm.props.onClick()
    tree = await settle(paneSlot.component, props, 'pane-run-failed')
    check(
      "a failed run shows the provider's own message, not a sentence this plugin invented",
      textIn(tree).includes('the model refused this prompt') && !!byAttr(tree, 'data-generate-run-failed', 'run-failed'),
      textIn(tree).slice(0, 240),
    )
    check(
      'and it keeps the run id, so the failure can be found again',
      !!byAttr(tree, 'data-generate-run-job', 'job-1'),
      'a failure without its id is not actionable',
    )
    check(
      'and it offers the way back to the form',
      !!byAttr(tree, 'data-generate-run-again', 'yes'),
      'a failed run must not be a dead end',
    )
  } finally {
    globalThis.fetch = real
  }
}

// ── the array doors, and the upload an image door needs ──────────────────────
//
// Founder, 2026-09-23: *"we are missing a lot of fields for upload image for style ref,
// etc.."*, with Krea's own playground in the screenshot. The claims: a Krea array field is a
// LIST whose rows carry the API's own doors; the add control stops at the API's own
// `maxItems`; a row a person typed into is what the gate shows; and a picked file becomes
// the URL the request carries, uploaded through the host because the pane holds no key.
{
  const props = {
    t,
    useTabInfo: () => ({ tab: { navigation: { params: { unit: ARRAYS_UNIT.name, provider: 'krea' }, revision: 1 } } }),
  }
  const stub = stubHost({ units: [], kreaUnits: [ARRAYS_UNIT], file: ARRAYS })
  const real = globalThis.fetch
  globalThis.fetch = stub.fetch
  try {
    let tree = await settle(paneSlot.component, props, 'pane-arrays')
    const disclosure = byAttr(tree, 'data-generate-advanced')
    check(
      'the array doors sit behind the same disclosure as the other tuning doors',
      !!disclosure && !byAttr(tree, 'data-generate-list-add', 'styles'),
      disclosure ? textIn(disclosure) : 'no disclosure',
    )
    if (disclosure) disclosure.props.onClick()
    tree = await settle(paneSlot.component, props, 'pane-arrays')

    check(
      'a list door starts empty, offering the add control the catalogue names and no rows',
      !!byAttr(tree, 'data-generate-list-add', 'styles') &&
        textIn(byAttr(tree, 'data-generate-list-add', 'styles')).includes('Add style') &&
        !byAttr(tree, 'data-generate-list-row', 'styles[0]'),
      JSON.stringify({ add: !!byAttr(tree, 'data-generate-list-add', 'styles'), first: !!byAttr(tree, 'data-generate-list-row', 'styles[0]') }),
    )

    const addStyle = byAttr(tree, 'data-generate-list-add', 'styles')
    if (addStyle) addStyle.props.onClick()
    tree = await settle(paneSlot.component, props, 'pane-arrays')
    check(
      "adding a row draws that row's own doors, at the API's own defaults",
      (() => {
        const row = byAttr(tree, 'data-generate-list-row', 'styles[0]')
        const id = byAttr(tree, 'data-generate-door', 'styles[0].id')
        const strength = byAttr(tree, 'data-generate-door', 'styles[0].strength')
        return !!row && !!id && !!strength && String(strength.props.value) === '1'
      })(),
      JSON.stringify({
        row: !!byAttr(tree, 'data-generate-list-row', 'styles[0]'),
        strength: (byAttr(tree, 'data-generate-door', 'styles[0].strength') || { props: {} }).props.value,
      }),
    )

    const idField = byAttr(tree, 'data-generate-door', 'styles[0].id')
    if (idField) idField.props.onChange({ target: { value: 'lora-7' } })
    tree = await settle(paneSlot.component, props, 'pane-arrays')
    const runButton = byAttr(tree, 'data-generate-run', ARRAYS_UNIT.name)
    check('a filled row is a value the run control can be pressed with', !!runButton, runButton ? 'the run control is there' : 'no run control')
    if (runButton) runButton.props.onClick()
    let gate = await settle(paneSlot.component, props, 'pane-arrays')
    const promptDoor = byAttr(gate, 'data-generate-door', 'prompt')
    if (promptDoor) promptDoor.props.onChange({ target: { value: 'a glass cabin' } })
    gate = await settle(paneSlot.component, props, 'pane-arrays')
    const showRequest = byAttr(gate, 'data-generate-gate-request')
    if (showRequest) showRequest.props.onClick()
    gate = await settle(paneSlot.component, props, 'pane-arrays')
    check(
      'the gate shows the row itself: the array a run would post is what a person reads',
      textIn(gate).includes('lora-7'),
      textIn(gate).slice(0, 300),
    )

    const cancel = byAttr(gate, 'data-generate-gate-cancel', 'yes')
    if (cancel) cancel.props.onClick()
    tree = await settle(paneSlot.component, props, 'pane-arrays')

    // The API's own `maxItems`, drawn: a second moodboard cannot be added.
    const addBoard = byAttr(tree, 'data-generate-list-add', 'moodboards')
    if (addBoard) addBoard.props.onClick()
    tree = await settle(paneSlot.component, props, 'pane-arrays')
    check(
      "the add control stops at the API's own `maxItems`: one moodboard is all Krea takes",
      !!byAttr(tree, 'data-generate-list-row', 'moodboards[0]') && !byAttr(tree, 'data-generate-list-add', 'moodboards'),
      JSON.stringify({ row: !!byAttr(tree, 'data-generate-list-row', 'moodboards[0]'), add: !!byAttr(tree, 'data-generate-list-add', 'moodboards') }),
    )

    const remove = byAttr(tree, 'data-generate-list-remove', 'styles[0]')
    check('every row carries its own remove control', !!remove, remove ? textIn(remove) : 'no remove control')
    if (remove) remove.props.onClick()
    tree = await settle(paneSlot.component, props, 'pane-arrays')
    check(
      'removing a row takes it off the form, and the add control comes back',
      !byAttr(tree, 'data-generate-list-row', 'styles[0]') && !!byAttr(tree, 'data-generate-list-add', 'styles'),
      JSON.stringify({ row: !!byAttr(tree, 'data-generate-list-row', 'styles[0]'), add: !!byAttr(tree, 'data-generate-list-add', 'styles') }),
    )

    // THE UPLOAD. An image door is a file a person picks, and what the door then carries is
    // the URL the provider's asset API answered — never the browser's own file path.
    const upload = byAttr(tree, 'data-generate-upload', 'image_url')
    check(
      'an image door offers the pick control beside the URL field, and starts empty',
      !!upload && (byAttr(tree, 'data-generate-door', 'image_url') || { props: {} }).props.value === '',
      JSON.stringify({ upload: !!upload, value: (byAttr(tree, 'data-generate-door', 'image_url') || { props: {} }).props.value }),
    )
    if (upload) upload.props.onChange({ target: { files: [{ name: 'photo.png', type: 'image/png' }], value: 'C:\\fakepath\\photo.png' } })
    tree = await settle(paneSlot.component, props, 'pane-arrays')
    check(
      'the picked file is uploaded through the host, and the door carries the URL it answered',
      stub.assets.length === 1 &&
        stub.assets[0].url === PROVIDERS_API + '/krea/asset' &&
        stub.assets[0].name === 'photo.png' &&
        (byAttr(tree, 'data-generate-door', 'image_url') || { props: {} }).props.value === UPLOADED_URL,
      JSON.stringify({ assets: stub.assets, value: (byAttr(tree, 'data-generate-door', 'image_url') || { props: {} }).props.value }),
    )
    check(
      'and what the door carries is a URL the payload builder accepts, not a file path',
      !String((byAttr(tree, 'data-generate-door', 'image_url') || { props: {} }).props.value).includes('fakepath'),
      String((byAttr(tree, 'data-generate-door', 'image_url') || { props: {} }).props.value),
    )
  } finally {
    globalThis.fetch = real
  }
}

// A surface that cannot run still says so, and offers no control that would post a request
// this plugin cannot build. That is RunningHub's state until its own run slice lands.
{
  const miss = await pane({ units: [KREA], file: KREA_FILE }, { params: { unit: KREA.name, provider: PROVIDER }, key: 'pane-run-pending' })
  check(
    'a surface that cannot run yet says so, and offers no run control',
    !!byAttr(miss.tree, 'data-generate-run-pending', 'yes') && !byAttr(miss.tree, 'data-generate-run', KREA.name),
    textIn(miss.tree).slice(0, 200),
  )
}

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
  // The image door and the list doors (2026-09-23): a picked file uploads, and a Krea array
  // field is a list of rows. A key missing here would put a raw id on a control a person
  // uses every time they touch a style reference.
  'surface.image.placeholder',
  'surface.image.uploading',
  'surface.image.failed',
  'surface.list.add',
  'surface.list.remove',
  // The accordion and its add control (founder, 2026-09-23). `pane.section.none` is the
  // count on an empty section's header, `pane.section.empty` is the body's own sentence,
  // and `pane.add.button` is the header glyph's tooltip and accessible name — so a
  // missing key would put a raw id on the pane's most-used control.
  'pane.section.none',
  'pane.section.count',
  'pane.section.empty',
  'pane.add.button',
  // The section header's light (founder, 2026-09-23): each state's sentence is the
  // dot's own tooltip, so a missing key here is a raw id on hover.
  'pane.light.ready',
  'pane.light.keyOnly',
  'pane.light.noKey',
  // The notes a provider can attach to a stored key. Each one is rendered as
  // `t('note.' + provider.note)` from the host's row, so a missing key here shows the
  // raw id to the user — which is what a note without copy looks like.
  'note.subscription-inactive',
  'note.not-entitled',
  'note.no-api-balance',
  // What using a provider costs, rendered as `t('funding.' + kind)` and, on the link,
  // `t('funding.' + kind + '.link')` — same rule: no copy means a raw id on the row.
  'funding.coins',
  'funding.balance',
  'funding.plan',
  'funding.credits',
  'funding.coins.link',
  'funding.balance.link',
  'funding.plan.link',
  'funding.credits.link',
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

const profile = join(homedir(), 'Library', 'Application Support', 'Mitsumeru', 'mitsu-dsh', 'profiles', 'mitsu', 'generate', PROVIDER, 'adapters')
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
