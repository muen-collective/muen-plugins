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
  IconLoadingOutline16: (props) => REACT.createElement('svg', { 'data-stub': 'loading', ...props }),
  IconCheckOutline16: (props) => REACT.createElement('svg', { 'data-stub': 'check', ...props }),
  IconInfoOutline14: (props) => REACT.createElement('svg', { 'data-stub': 'info', ...props }),
  IconPlusOutline16: (props) => REACT.createElement('svg', { 'data-stub': 'plus', ...props }),
  /**
   * The anchored menu the split run control opens. The stub renders the anchor it wraps and,
   * while open, one button per row — enough for a check to read the modes declared for a
   * provider and to choose one, which is what the real primitive's rows do.
   */
  Menu: (props) =>
    REACT.createElement(
      'span',
      { 'data-stub': 'menu', 'data-menu-open': props.open === true ? 'yes' : 'no', selected: props.selectedId, onClose: props.onClose, onSelect: props.onSelect },
      props.anchor,
      props.open === true
        ? REACT.createElement(
            'span',
            { 'data-stub': 'menu-list' },
            (props.items || []).map((item) =>
              REACT.createElement(
                'button',
                {
                  key: item.id,
                  type: 'button',
                  'data-menu-item': item.id,
                  // The real row is a `MenuItemButton`, which carries `disabled` and refuses the
                  // press; the stub keeps the flag AND the refusal, so a check can prove a greyed
                  // row does nothing rather than only that it is marked.
                  disabled: item.disabled === true,
                  ...(item.disabled === true ? { 'data-menu-item-disabled': 'yes' } : {}),
                  icon: item.icon,
                  onClick: () => {
                    if (item.disabled === true) return
                    props.onSelect(item.id)
                  },
                },
                item.label,
              ),
            ),
          )
        : null,
    ),
  // The way out of a workflow surface wears this (founder, 2026-09-23).
  IconChevronLeftOutline14: (props) => REACT.createElement('svg', { 'data-stub': 'chevron-left', ...props }),
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
  /**
   * THE ADD CONTROL'S POPOVER, from the app's own two rules (founder, 2026-09-25: *"click
   * add button launch popover w snippet"*). The real `useAnchoredPosition` measures the
   * trigger and clamps the panel inside the viewport; the stub answers the pair the real one
   * would return after measuring a panel and a trigger, so a check can read that the popover
   * is PLACED rather than laid out in the page flow. The real
   * `useDismissOnOutsidePointer` binds a document listener on the trigger's root; the stub
   * keeps all four arguments so a check can close the popover exactly the way an outside
   * pointerdown does.
   */
  useAnchoredPosition: (options) => (options.open === true ? { left: 120, top: 240 } : null),
  useDismissOnOutsidePointer: (root, open, setOpen, portal) => {
    dismissals.push({ root, open, setOpen, portal })
  },
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

/**
 * The blob URLs the image door asked for, and the ones it let go. The browser makes a real
 * object URL out of a picked file; this VM has no Blob and no URL, so the stub records the
 * two calls instead — which is what makes "a picked file previews as a thumbnail, and a
 * failed upload takes the preview back down" observable here.
 */
const blobUrls = []
const revokedBlobUrls = []
let blobSeq = 0
/** Every `useDismissOnOutsidePointer` call, so a check can close a popover the way a click does. */
const dismissals = []
/** Every `keydown` listener the pane bound, so a check can press a key instead of a window. */
const keydowns = []

async function loadClient() {
  const source = await readFile(join(ROOT, 'lib/client.js'), 'utf8')
  let captured = null
  const sandbox = {
    // The pane's popover closes on Escape, the way the app's own floating surfaces do. The
    // browser has a window with listeners; this VM has none, so the sandbox records them.
    window: {
      __ModuleLoader__: { load: (registration) => { captured = registration } },
      addEventListener: (type, fn) => {
        if (type === 'keydown') keydowns.push(fn)
      },
      removeEventListener: () => {},
    },
    console,
    // The one sheet this bundle injects: `apply()` appends a <style> when a DOM is
    // present. The host defines the stub before this loader runs (see the registrations
    // block), and the sandbox keeps its own reference to it.
    document: globalThis.document,
    fetch: (url, init) => globalThis.fetch(url, init),
    // The image door previews a picked file through a blob URL. The browser has
    // `URL.createObjectURL`; this VM does not, so the stub answers a marked string and
    // records both the make and the revoke.
    URL: {
      createObjectURL: (file) => {
        blobSeq += 1
        const url = 'blob:generate/' + blobSeq
        blobUrls.push({ url, file })
        return url
      },
      revokeObjectURL: (url) => {
        revokedBlobUrls.push(url)
      },
    },
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
  // One-press fills, the same flattening: the label names the glyph and the doors are what
  // one press writes (founder, 2026-09-25: *"we should add sparkles icon to fill the prompt w
  // subject swap skill to make the work faster"*).
  presets: [{ label: 'Subject swap', doors: { value: 'Swap the outfit from image 2 onto the person in image 1.' } }],
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
 * What RunningHub's upload answers: a `fileName`, not a URL — *"the unique path for file
 * loading … must be accurately passed to the corresponding node"*. Nothing a browser can
 * open, which is exactly why the preview may not be drawn from it.
 */
const OPAQUE_HANDLE = 'api/7a8b80db932c05c6b54459f8bee3'

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
  // The prompt-writing menu as the founder described it (2026-09-25: *"sparkles subject swap is a
  // prompt writing skill, we can have other skill like face swap, add object (add these others but
  // greyed for now)"*): one written skill and two placeholders. The placeholders carry a value no
  // one wrote, so a row that applies them anyway is visible rather than looking like a no-op.
  presets: [
    { label: 'Subject swap', doors: { prompt: 'Swap the outfit from image 2 onto the person in image 1.' } },
    { label: 'Face swap', doors: { prompt: 'the face-swap words nobody wrote' }, disabled: true },
    { label: 'Add object', doors: { prompt: 'the add-object words nobody wrote' }, disabled: true },
  ],
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
  /**
   * The run option a provider declares (RunningHub's `instanceType` today). It is attached
   * to the krea row on demand, because krea is the provider whose adapters can actually run
   * in these fixtures: the contract being exercised is "a provider that declares modes gets
   * the split control", and a runnable surface is what draws one.
   */
  runOption = null,
  /**
   * What the upload route answers as the door's value. Krea answers a real URL; RunningHub
   * answers an opaque `fileName` (`api/7a8b80db…`) that is a node input and nothing a browser
   * can open — which is the case the thumbnail rule exists for, so a case can ask for it.
   */
  assetUrl = UPLOADED_URL,
  /**
   * The values the host has on file for this workflow. The surface reads them when it mounts,
   * which is the only way a door can hold a value with no picked bytes in hand — the state a
   * reopened RunningHub workflow is in, where the door carries an opaque `api/…` handle.
   */
  savedValues = {},
  /**
   * The session the strip reads (epic 64 S3): the rows `/results` answers with, verbatim. A
   * case sets them to two runs — one whose file is here, one whose file is gone — because
   * those two must draw differently.
   */
  resultRows = [],
} = {}) {
  const calls = []
  // The runs this stub was asked to start, and how many times a job was polled: the two
  // facts the gate and the strip checks read.
  const runs = []
  const assets = []
  // The upload's answer, swappable mid-case: one surface has to see what a provider that
  // answers an opaque handle (RunningHub) puts on its image doors, the next what a provider
  // that answers a URL (Krea) does.
  let assetAnswer = assetUrl
  let polls = 0
  // The folder the Save-folder row posted, if any: the library answer mirrors the host's
  // own precedence (a chosen folder, else the Desktop default).
  let chosenPath = null
  const libraryAnswer = () =>
    chosenPath === null
      ? { path: null, root: '/Users/you/Desktop', source: 'desktop', canChoose: true, freeBytes: 187904819200 }
      : { path: chosenPath, root: chosenPath, source: 'custom', canChoose: true, freeBytes: 187904819200 }
  const ok = (body) => ({ ok: true, status: 200, json: async () => body })
  return {
    calls,
    runs,
    assets,
    /** What the next upload answers: a URL for Krea, an opaque fileName for RunningHub. */
    set assetUrl(next) {
      assetAnswer = next
    },
    get polls() {
      return polls
    },
    fetch: async (url, init = {}) => {
      // The body travels with the call: the split run control's check reads what the
      // payload request actually carried, not what the surface said it would.
      calls.push({ url, method: (init.method || 'GET').toUpperCase(), body: init.body })
      // The upload an image door calls: the file goes to this plugin's own host route, the
      // host answers the provider's asset URL, and that URL is the value the door carries.
      if (String(url).includes('/results?')) {
        return ok({ name: 'stub', rows: resultRows, total: resultRows.length, truncated: false })
      }
      if (String(url).endsWith('/asset')) {
        assets.push({
          url: String(url),
          name: (init && init.headers && init.headers['x-file-name']) || null,
          type: (init && init.headers && init.headers['content-type']) || null,
        })
        return ok({ url: assetAnswer })
      }
      // The payload preview, built here the way the host builds it (verify/run.mjs still
      // drives this route, though the surface stopped calling it when the confirmation
      // dialog went away): the body is the values
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
          // The host echoes the option it validated, so the gate draws what would be sent.
          options: posted.options || null,
          // And it sends the gate's rows, labelled by the same words the form drew.
          rows: Object.entries(values)
            .filter(([, value]) => value !== undefined && value !== null && String(value) !== '')
            .map(([key, value]) => ({ label: key, value: String(value) })),
        })
      }
      // Starting a run. The stub records the whole call, so a check can prove the confirm
      // carried the person's own flag.
      if (String(url).endsWith('/run') && (init.method || 'GET').toUpperCase() === 'POST') {
        const posted = JSON.parse((init && init.body) || '{}')
        runs.push(posted)
        // One id per start, so two jobs at once carry two names. The first run is still
        // `job-1`, which is what the single-run checks above rely on.
        return ok({ jobId: 'job-' + runs.length, status: 'queued' })
      }
      // One poll. `jobStates` is the script: the last entry answers every later poll.
      if (String(url).includes('/run?job=')) {
        polls += 1
        const state = jobStates[Math.min(polls - 1, jobStates.length - 1)]
        if (state === 'failed') return ok({ state: 'failed', status: 'failed', urls: [], error: jobError || { code: 'x', message: 'the model refused this prompt' } })
        if (state === 'done') {
          // The host saves the bytes on the terminal read and says where; the pane draws that
          // answer, so the stub answers the same shape.
          return ok({
            state: 'done',
            status: 'completed',
            urls: ['https://gen.krea.ai/out.png'],
            error: null,
            saved: [{ file: '/tmp/generate/library/krea/krea-2-medium-turbo/20260923-job-1.png', bytes: 24, type: 'png', url: 'https://gen.krea.ai/out.png' }],
          })
        }
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
          ].map((provider) => ({
            ...provider,
            hidden: hidden.includes(provider.id),
            ...(runOption && provider.id === 'krea' ? { runOption } : {}),
          })),
          // Where runs save, the way the host now answers it beside the rows: the
          // settings page's Save folder row reads this field off the same request.
          library: libraryAnswer(),
        })
      }
      // The Save-folder row: POST stores a chosen folder (or null for the Desktop
      // default), opens the folder dialog or reveals the folder (`action`), and answers
      // the state, exactly as /plugins/generate/library does.
      if (String(url).endsWith('/plugins/generate/library') && (init.method || 'GET').toUpperCase() === 'POST') {
        const posted = JSON.parse((init && init.body) || '{}')
        if (posted.action === 'reveal') return ok({ ok: true })
        if (posted.action === 'choose') {
          chosenPath = '/Users/you/Pictures'
          return ok(libraryAnswer())
        }
        if (posted.path === null) {
          chosenPath = null
          return ok(libraryAnswer())
        }
        const postedPath = typeof posted.path === 'string' ? posted.path.trim() : ''
        if (postedPath === '' || !(postedPath.startsWith('/') || postedPath.startsWith('~'))) {
          return { ok: false, status: 400, json: async () => ({ error: 'bad-path' }) }
        }
        chosenPath = postedPath
        return ok(libraryAnswer())
      }
      // The per-workflow values the host has on file. The surface reads them on mount, so a
      // fixture can open a door that already holds a value with no picked bytes in hand.
      if (String(url).includes('/state?name=')) {
        return ok(savedValues)
      }
      // Every provider's workflow route answers, because the pane and the open card
      // read one list per provider: RunningHub carries the units, the rest are empty.      // A failure case fails them all, which is what "the list could not be read"
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

// A minimal `document`, so apply()'s one style injection is observable here the way it is
// in the browser. It is defined BEFORE the loader runs — the client half executes in a VM,
// so its `document` is the sandbox's own key — and the host key is dropped right after
// apply; nothing else in this half touches it.
const injectedStyles = []
globalThis.document = {
  head: {
    appendChild: (element) => {
      injectedStyles.push(element)
      return element
    },
  },
  createElement: () => ({ textContent: '', setAttribute() {}, remove() {} }),
}
const module = await loadClient()
const { ctx, seen } = recordingCtx('en')
module.apply(ctx)
delete globalThis.document
check(
  'apply injects the one sheet the bundle needs: the spinner class and its keyframes',
  injectedStyles.length === 1 &&
    /@keyframes dsh-generate-spin/.test(String(injectedStyles[0].textContent)) &&
    /\.dsh-generate-spin/.test(String(injectedStyles[0].textContent)),
  JSON.stringify(injectedStyles.map((element) => String(element.textContent))),
)
check(
  'the sheet hides a tab\'s close until that tab is selected, hovered or focused',
  (() => {
    // The app's own pattern (founder, 2026-09-25: *"the pattern in dsh is when the tab is
    // unselected there is no close icon"*): DSH's `_tabClose_11olo_411` is
    // `opacity:0;pointer-events:none`, revealed by `:hover`, `:focus-within` or the active tab.
    const css = injectedStyles.length === 1 ? String(injectedStyles[0].textContent) : ''
    return (
      /\.dsh-generate-tabClose\s*\{[^}]*opacity:\s*0[^}]*\}/.test(css) &&
      /\.dsh-generate-tabClose\s*\{[^}]*pointer-events:\s*none[^}]*\}/.test(css) &&
      /\[data-generate-tab-pill\]:hover \.dsh-generate-tabClose/.test(css) &&
      /\[data-generate-tab-pill\]:focus-within \.dsh-generate-tabClose/.test(css) &&
      /\[data-generate-tab-pill\]\[data-generate-tab-selected="yes"\] \.dsh-generate-tabClose\s*\{[^}]*opacity:\s*1/.test(css) &&
      // …and it hides rather than removes, so the glyph keeps its box and selecting a tab
      // moves no pixel.
      !/\.dsh-generate-tabClose\s*\{[^}]*(display:\s*none|visibility:\s*hidden)/.test(css)
    )
  })(),
  injectedStyles.length === 1 ? String(injectedStyles[0].textContent) : 'no sheet',
)

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
// THE TAB TITLE WEARS THE SPARKLE (founder, 2026-09-25: *"add sparkles icon to generate tab at
// top to match other dsh tabs"*). The guide tab draws its compass first, in the tertiary ink,
// then its label; a Generate tab draws the same shape with the sparkle the start-page card
// wears, so the tab reads as one of the app's own rather than as a bare word.
{
  const chip = await settle(titleSlot.component, { t }, 'chip')
  const icon = byAttr(chip, 'data-generate-title-icon', 'yes')
  const sparkle = icon ? nodesOf(icon).find((node) => node.props && node.props['data-stub'] === 'sparkle') : null
  check(
    'the tab title draws the sparkle beside its label, in chrome ink',
    !!icon &&
      !!sparkle &&
      textIn(chip).trim() === 'Generate' &&
      icon.props.style.color === 'var(--dsw-alias-label-tertiary)',
    chip ? JSON.stringify({ text: textIn(chip), sparkle: !!sparkle }) : 'no chip',
  )
}
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
    // THE SAVE FOLDER ROW (founder, 2026-09-23: *"let's make save folder default on
    // desktop, and the user can click to choose a different folder. in capture one its
    // like this, click on icon to open finder"*). The host's answer rides the list the
    // row already has — no second fetch — and the row draws the Capture One shape: a
    // clickable path, the reveal arrow, the Space left line, and the typed input below.
    check(
      'the settings page says where runs save, from the host\'s own answer',
      !!byAttr(tree, 'data-generate-library', 'yes') &&
        textIn(byAttr(tree, 'data-generate-library-root', 'yes') || { children: [] }).includes('/Users/you/Desktop'),
      byAttr(tree, 'data-generate-library-root', 'yes') ? textIn(byAttr(tree, 'data-generate-library-root', 'yes')) : 'no row',
    )
    check(
      'the default root is a button: clicking the path is how a different folder is chosen',
      (() => {
        const path = byAttr(tree, 'data-generate-library-root', 'yes')
        return !!path && path.props['data-generate-library-choose'] === 'yes' && typeof path.props.onClick === 'function'
      })(),
      'the path line carries its own click',
    )
    check(
      'the Space left line carries the number the host measured',
      (() => {
        const line = byAttr(tree, 'data-generate-library-space', 'yes')
        return !!line && textIn(line).includes(EN['settings.library.space']) && /\d+\.\d{2} GB/.test(textIn(line))
      })(),
      byAttr(tree, 'data-generate-library-space', 'yes') ? textIn(byAttr(tree, 'data-generate-library-space', 'yes')) : 'no space line',
    )
    // Click the path: the dialog's answer takes over as the root, and the reset appears.
    const pathButton = byAttr(tree, 'data-generate-library-root', 'yes')
    if (pathButton && typeof pathButton.props.onClick === 'function') pathButton.props.onClick()
    const afterSave = await settle(settings.component, { t }, 'settings')
    check(
      'clicking the path opens the dialog, and what comes back takes over as the root',
      !!afterSave &&
        textIn(byAttr(afterSave, 'data-generate-library-root', 'yes') || { children: [] }).includes('/Users/you/Pictures') &&
        !!byAttr(afterSave, 'data-generate-library-reset', 'yes'),
      byAttr(afterSave, 'data-generate-library-root', 'yes') ? textIn(byAttr(afterSave, 'data-generate-library-root', 'yes')) : 'no row',
    )
    check(
      'the reveal arrow stands beside the path, to open the folder in Finder',
      !!byAttr(afterSave, 'data-generate-library-reveal', 'yes'),
      'no reveal control',
    )
    const resetFolder = byAttr(afterSave, 'data-generate-library-reset', 'yes')
    if (resetFolder) resetFolder.props.onClick()
    tree = await settle(settings.component, { t }, 'settings')
    check(
      'one control puts the root back on the Desktop default',
      textIn(byAttr(tree, 'data-generate-library-root', 'yes') || { children: [] }).includes('/Users/you/Desktop') &&
        !byAttr(tree, 'data-generate-library-reset', 'yes'),
      byAttr(tree, 'data-generate-library-root', 'yes') ? textIn(byAttr(tree, 'data-generate-library-root', 'yes')) : 'no row',
    )
    // The typed input still works — a path nobody wants to click through to.
    const folderInput = byAttr(tree, 'data-generate-library-input', 'yes')
    if (folderInput) folderInput.props.onChange({ target: { value: '/Volumes/External SSD/saves' } })
    const afterType = await settle(settings.component, { t }, 'settings')
    const saveFolder = byAttr(afterType, 'data-generate-library-save', 'yes')
    if (saveFolder) saveFolder.props.onClick()
    tree = await settle(settings.component, { t }, 'settings')
    check(
      'the typed path is still a way to choose, and the host\'s answer is what shows',
      textIn(byAttr(tree, 'data-generate-library-root', 'yes') || { children: [] }).includes('/Volumes/External SSD/saves'),
      byAttr(tree, 'data-generate-library-root', 'yes') ? textIn(byAttr(tree, 'data-generate-library-root', 'yes')) : 'no row',
    )
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
    const head = byAttr(home.tree, 'data-generate-section-head', PROVIDER)
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

// ── the home screen's dashboard: one block per provider, all of them ────────
//
// THE SHAPE THE FOUNDER ASKED FOR (2026-09-23 for the blocks, 2026-09-25 for the look):
// one block per provider — all four, not only the linked ones, because a block is where
// that provider's add control lives — with the provider's name on a caption line and its
// facts on a line under it. It was a stacked accordion with every section boxed; the
// boxes, the separators and the fold are what went (founder, 2026-09-25: *"it should be
// minimal like start surface and make like dashboard"*). The card inside a block is the
// harness's own start-page card: icon, label, one line under it, no thumbnail.

const sectionIds = (tree) =>
  nodesOf(tree)
    .filter((node) => node.props && node.props['data-generate-section-head'])
    .map((node) => node.props['data-generate-section-head'])

check(
  'the home screen is one block per provider, in registry order',
  sectionIds(home.tree).join(',') === 'runninghub,krea,comfycloud,magnific',
  JSON.stringify(sectionIds(home.tree)),
)
// THE COLUMN IS THE START SURFACE'S (founder, 2026-09-25: *"it should be minimal like start
// surface"*, then *"vertical center on page"*). The guide draws one centred column of 380px
// entries; the home draws one centred column of 380px blocks, so a wide Generate tab and the
// narrow right column read the same rather than the blocks stretching to whatever width the
// pane happens to have — and the column is centred on the page vertically as well.
check(
  "the home is the guide's own centred column: 380px blocks, centred across and down",
  (() => {
    const box = (byAttr(home.tree, 'data-generate-sections') || { props: {} }).props.style || {}
    return (
      box.display === 'flex' &&
      box.flexDirection === 'column' &&
      box.alignItems === 'center' &&
      // `margin: auto` centres vertically without the clipping `justify-content: center`
      // causes once the column is taller than the pane.
      box.margin === 'auto 0' &&
      box.flex === 'none'
    )
  })(),
  JSON.stringify((byAttr(home.tree, 'data-generate-sections') || { props: {} }).props.style),
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
    // PUT KREA BACK. The provider store is shared by every surface in this file, and
    // later checks re-settle LIVE trees (the metas loop opens each section in turn): a
    // krea left hidden would erase its section from all of them. The checks that came
    // before this block only read snapshots, which is why the leak was never noticed.
    // The settings row is re-settled first so the switch's own props are current — the
    // snapshot above predates the hide and would toggle the wrong way.
    const freshSettings = await settle(settingsSlots[0].component, { t }, 'shared-settings')
    const kreaHide = nodesOf(freshSettings).find((node) => node.props && node.props['data-generate-provider-hide'] === 'krea')
    const kreaSwitch = kreaHide ? byAttr(kreaHide, 'data-stub', 'switch') : null
    if (kreaSwitch) kreaSwitch.props.onClick()
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
  "a block's caption names its provider, and the facts line under it says what the block holds",
  (() => {
    const head = byAttr(home.tree, 'data-generate-section-head', PROVIDER)
    const facts = byAttr(home.tree, 'data-generate-section-facts', PROVIDER)
    const headText = head ? textIn(head) : ''
    const factsText = facts ? textIn(facts) : ''
    return (
      headText.includes('RunningHub') &&
      !headText.includes(EN['settings.kind.workflow']) &&
      // THE COUNT LINE IS GONE (founder, 2026-09-25: *"remove workflows 3 installed"*):
      // the facts line holds the wallet and the two glyph controls, and the cards under it
      // are what says how many there are.
      !factsText.includes('installed') &&
      factsText.includes('8,600')
    )
  })(),
  (() => {
    const head = byAttr(home.tree, 'data-generate-section-head', PROVIDER)
    const facts = byAttr(home.tree, 'data-generate-section-facts', PROVIDER)
    return 'caption: ' + (head ? textIn(head) : 'none') + ' / facts: ' + (facts ? textIn(facts) : 'none')
  })(),
)
check(
  'all provider sections are visible in the flat grid (no accordion)',
  !!byAttr(home.tree, 'data-generate-section-body', PROVIDER) &&
    !!byAttr(home.tree, 'data-generate-section-body', 'krea') &&
    !!byAttr(home.tree, 'data-generate-section-body', 'comfycloud'),
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
    const head = byAttr(tree, 'data-generate-section-head', id)
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

  const header = byAttr(home.tree, 'data-generate-section-head', PROVIDER)
  const sub = byAttr(home.tree, 'data-generate-section-facts', PROVIDER)
  const balanceRow = byAttr(home.tree, 'data-generate-provider-strip', PROVIDER)
  const balanceRows = nodesOf(home.tree).filter((node) => node.props && node.props['data-generate-provider-strip'])
  check(
    'the wallet balance is the subheader\'s own row, inside the section it belongs to',
    !!header && !!sub && !!balanceRow && nodesOf(sub).includes(balanceRow) && !nodesOf(header).includes(balanceRow) && textIn(balanceRow).includes('8,600'),
    balanceRow ? textIn(balanceRow) : 'no balance row',
  )
  check(
    'the strip above the accordion is gone: a balance row lives only in its open section\'s band',
    (() => {
      const openIds = nodesOf(home.tree)
        .filter((node) => node.props && node.props['data-generate-section-body'])
        .map((node) => node.props['data-generate-section-body'])
      if (openIds.length === 0 || balanceRows.length !== openIds.length) return false
      // Every row sits in its own band, and a SHUT section draws no band at all
      // (founder, 2026-09-23: *"when the accordion is closed don't show the subheader"*).
      return (
        openIds.every((id) => {
          const band = byAttr(home.tree, 'data-generate-section-facts', id)
          const row = byAttr(home.tree, 'data-generate-provider-strip', id)
          return !!band && !!row && nodesOf(band).includes(row)
        }) &&
        heads.every((id) => openIds.includes(id) || !byAttr(home.tree, 'data-generate-section-facts', id))
      )
    })(),
    JSON.stringify(balanceRows.map((node) => node.props['data-generate-provider-strip'])),
  )
  // THE FACTS LINE (founder, 2026-09-25: *"it should be minimal like start surface and
  // make like dashboard"*). It stands where the subheader band stood, and its claims are
  // the opposite of that band's: it still sits between the caption and the body inside the
  // block, and it now draws NO separator — the hairline above and below, and the card
  // around them, are exactly what the redesign took away.
  check(
    'the facts line sits between the caption and the body, and draws no separator',
    (() => {
      if (!header || !sub) return false
      const wrap = byAttr(home.tree, 'data-generate-section-wrap', PROVIDER)
      if (!wrap || !nodesOf(wrap).includes(sub)) return false
      const order = nodesOf(wrap)
      const headAt = order.indexOf(header)
      const subAt = order.indexOf(sub)
      const body = byAttr(home.tree, 'data-generate-section-body', PROVIDER)
      const bodyAt = body ? order.indexOf(body) : -1
      const style = sub.props.style || {}
      return (
        headAt !== -1 &&
        subAt > headAt &&
        (bodyAt === -1 || subAt < bodyAt) &&
        style.borderTop === undefined &&
        style.borderBottom === undefined
      )
    })(),
    sub ? JSON.stringify(sub.props.style) : 'no facts line',
  )
  check(
    'the header keeps none of what moved: no balance, no count line, no add, no refresh',
    (() => {
      if (!header) return false
      return !nodesOf(header).some(
        (node) =>
          node.props &&
          (node.props['data-generate-provider-strip'] !== undefined ||
            node.props['data-generate-add-button'] !== undefined ||
            node.props['data-generate-refresh'] !== undefined),
      )
    })(),
    header ? textIn(header) : 'no header',
  )
  check(
    'all sections show their subheader bands in the flat grid',
    (() => {
      const kreaBand = byAttr(home.tree, 'data-generate-section-facts', 'krea')
      const openBand = byAttr(home.tree, 'data-generate-section-facts', PROVIDER)
      return (
        !!kreaBand &&
        !!openBand
      )
    })(),
    'all sections visible in flat grid',
  )
  const parentOf = (root, node) => nodesOf(root).find((candidate) => candidate.children.includes(node)) || null
  // THE COUNT LINE IS GONE (founder, 2026-09-25: *"remove workflows 3 installed"*). The
  // check that pinned `Workflows · N installed` as the facts line's right cluster went with
  // it; what is left on that line is the balance and the two glyphs, and the check below
  // reads their order.
  check(
    'the facts line is the balance, then the add and refresh glyphs, and nothing between them',
    (() => {
      if (!sub) return false
      const flat = nodesOf(sub)
      const addAt = flat.findIndex((node) => node.props && node.props['data-generate-add-button'] === PROVIDER)
      const refreshAt = flat.findIndex((node) => node.props && node.props['data-generate-refresh'] === PROVIDER)
      const textAt = balanceRow ? flat.indexOf(balanceRow) : -1
      return (
        textAt !== -1 &&
        addAt !== -1 &&
        refreshAt !== -1 &&
        textAt < addAt &&
        addAt < refreshAt
      )
    })(),
    sub ? textIn(sub) : 'no facts line',
  )
  // SMALL AND MUTED (founder, 2026-09-25: *"make coins usd key saved small muted font color /
  // fontsize sm"*). The balance is the quietest line on the block now: 11px in the caption
  // ink, and neither the number nor its note carries a weight of its own.
  check(
    'the balance reads small and muted: 11px, the caption ink, and no weight of its own',
    (() => {
      if (!balanceRow) return false
      const style = balanceRow.props.style || {}
      const weighted = nodesOf(balanceRow).some((node) => node.props && node.props.style && node.props.style.fontWeight)
      return style.fontSize === 11 && style.color === 'var(--dsw-alias-label-caption)' && !weighted
    })(),
    balanceRow ? JSON.stringify(balanceRow.props.style) : 'no balance',
  )
  check(
    'the header\'s text column is the name row, and nothing else',
    (() => {
      if (!header) return false
      const column = header.children.find((child) => child && typeof child !== 'string' && textIn(child).includes('RunningHub'))
      if (!column || column.children.length !== 1) return false
      // The add glyph is not in the header: it lives on the facts line, and the count line
      // that used to sit beside it is gone (founder, 2026-09-25).
      return !nodesOf(header).some((node) => node.props && node.props['data-generate-add-button'])
    })(),
    (() => {
      const column = header
        ? header.children.find((child) => child && typeof child !== 'string' && textIn(child).includes('RunningHub'))
        : null
      return column ? String(column.children.length) + ' child(ren)' : 'no column'
    })(),
  )
  check(
    'name in the header, balance beneath it in the band: the order the section owes',
    (() => {
      if (!header || !sub || !balanceRow) return false
      const nameAt = nodesOf(header).findIndex((node) => textIn(node) === 'RunningHub')
      const order = nodesOf(byAttr(home.tree, 'data-generate-section-wrap', PROVIDER))
      const headAt = order.indexOf(header)
      const subAt = order.indexOf(sub)
      const balanceAt = order.indexOf(balanceRow)
      return nameAt !== -1 && headAt !== -1 && subAt > headAt && balanceAt > subAt && nodesOf(sub).includes(balanceRow)
    })(),
    header ? textIn(header) : 'no header',
  )
  // THE COUNT LINE IS GONE (founder, 2026-09-25: *"remove workflows 3 installed"*), so the
  // loop that opened each section in turn to read `Workflows · N installed` went with it.
  // `pane.section.family`, `pane.section.count` and `pane.section.none` left both
  // dictionaries at the same time, which is why the copy coverage list below no longer names
  // them: the cards under a block are what says how many entries it has.
  //
  // The walk-back the loop used to do stays, because the checks AFTER it still read the home
  // instance: a card-click check earlier drove this tree to a unit surface, and the fixture's
  // own state (not the `home.tree` snapshot) is what a re-settle renders.
  {
    const walked = await pane({ units: [KREA, QWEN] }, { key: 'pane-home' })
    // The fixture is on a unit when the pane says so; the way back is the header's first tab
    // (the surface's own back button went with the header, founder 2026-09-25).
    const mode = byAttr(walked.tree, 'data-generate-pane')
    if (mode && mode.props['data-generate-pane'] === 'unit') {
      byAttr(walked.tree, 'data-generate-tab-add', 'yes').props.onClick()
      await pane({ units: [KREA, QWEN] }, { key: 'pane-home' })
    }
  }
  // THE ACCOUNT ARROW'S HOVER (founder, 2026-09-23: *"add onhover on the website link
  // arrow to theme primary token color"*): state-swapped like the cards, because an
  // inline style carries no `:hover`.
  {
    const linkAtRest = byAttr(home.tree, 'data-generate-account', PROVIDER)
    if (linkAtRest && typeof linkAtRest.props.onMouseEnter === 'function') {
      linkAtRest.props.onMouseEnter()
      const hoveredLink = byAttr((await pane({ units: [KREA, QWEN] }, { key: 'pane-home' })).tree, 'data-generate-account', PROVIDER)
      check(
        'the account arrow wears the theme primary while the pointer is on it',
        !!hoveredLink && !!hoveredLink.props.style && hoveredLink.props.style.color === 'var(--dsw-alias-brand-primary)',
        hoveredLink ? JSON.stringify(hoveredLink.props.style) : 'no arrow',
      )
      if (hoveredLink) hoveredLink.props.onMouseLeave()
      const restLink = byAttr((await pane({ units: [KREA, QWEN] }, { key: 'pane-home' })).tree, 'data-generate-account', PROVIDER)
      check(
        'the arrow lets the colour go when the pointer leaves',
        !!restLink && !!restLink.props.style && restLink.props.style.color === 'var(--dsw-alias-label-tertiary)',
        restLink ? JSON.stringify(restLink.props.style) : 'no arrow',
      )
    } else {
      check('the account arrow wears the theme primary while the pointer is on it', false, 'no hover handler on the arrow')
      check('the arrow lets the colour go when the pointer leaves', false, 'no hover handler on the arrow')
    }
  }
  check(
    'the way out to the account page is the glyph beside the provider\'s name',
    (() => {
      const link = byAttr(home.tree, 'data-generate-account', PROVIDER)
      if (!link || !header || !nodesOf(header).includes(link)) return false
      // The name, then the glyph — both still in the header. The balance that used
      // to follow them in row 2 lives in the subheader now.
      const flat = nodesOf(header)
      const nameAt = flat.findIndex((node) => textIn(node) === 'RunningHub')
      const linkAt = flat.indexOf(link)
      return nameAt !== -1 && linkAt !== -1 && nameAt < linkAt && !flat.includes(balanceRow)
    })(),
    'the glyph travels with the name it belongs to, not below it',
  )
  // NOTHING FOLDS (founder, 2026-09-25): the caption line is a label now, not a control,
  // so there is no toggle for the account link to stop and no key for a keyboard to press.
  check(
    'the caption line is a label, not a toggle: no role, no key handling, no click',
    (() => {
      if (!header) return false
      return (
        header.props.role === undefined &&
        header.props.tabIndex === undefined &&
        typeof header.props.onClick !== 'function' &&
        typeof header.props.onKeyDown !== 'function'
      )
    })(),
    header
      ? JSON.stringify({ role: header.props.role, tabIndex: header.props.tabIndex, click: typeof header.props.onClick })
      : 'no caption line',
  )
  check(
    'the account glyph is a plain link: nothing above it folds, so nothing needs stopping',
    (() => {
      const link = byAttr(home.tree, 'data-generate-account', PROVIDER)
      return !!link && link.props.onClick === undefined
    })(),
    'the stopPropagation the toggle needed is gone with the toggle',
  )
  check(
    'the glyph is labelled, because an icon alone names nothing',
    (() => {
      const link = byAttr(home.tree, 'data-generate-account', PROVIDER)
      return !!link && link.props.title === EN['settings.account'] && link.props['aria-label'] === EN['settings.account']
    })(),
    byAttr(home.tree, 'data-generate-account', PROVIDER) ? JSON.stringify(byAttr(home.tree, 'data-generate-account', PROVIDER).props.title) : 'no glyph',
  )
  // The commentary the two checks above replaced: the header WAS the toggle, a role rather
  // than a button so the account anchor could live inside it, and Enter folded the section
  // while a letter did not. The whole fold is gone (founder, 2026-09-25), so its keyboard
  // contract is not a thing the page owes any more — and the two checks above say so from
  // the other side: nothing on the caption line is a control.

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
  const refreshBand = byAttr(home.tree, 'data-generate-section-facts', PROVIDER)
  check(
    'the refresh control lives in the subheader, right of the balance, and the pane keeps no foot row for it',
    (() => {
      if (!refresh || !refreshBand || !nodesOf(refreshBand).includes(refresh)) return false
      const flat = nodesOf(refreshBand)
      const balanceAt = flat.indexOf(balanceRow)
      const refreshAt = flat.indexOf(refresh)
      // Left to right: balance, count line, then the control that re-reads it. The
      // label is no longer drawn anywhere, because the foot-of-pane button that
      // carried it is gone (founder, 2026-09-23: *"refresh the balance move to
      // header"*, and the band that later emptied the header kept it).
      return balanceAt !== -1 && refreshAt !== -1 && balanceAt < refreshAt && !textIn(home.tree).includes('Refresh the balance')
    })(),
    refreshBand ? textIn(refreshBand) : 'no subheader',
  )
  check(
    'the refresh is named for what it does, since it is drawn as a glyph',
    !!refresh && refresh.props['aria-label'] === EN['wallet.refresh'] && tooltipOn(home.tree, 'data-generate-refresh', PROVIDER)?.props.label === EN['wallet.refresh'],
    refresh ? JSON.stringify({ label: refresh.props['aria-label'], tooltip: tooltipOn(home.tree, 'data-generate-refresh', PROVIDER)?.props.label }) : 'no refresh control',
  )
  check(
    'the refresh is its own control, not the section toggle above it',
    !!refresh && typeof refresh.props.onClick === 'function' && !!header && refresh.props.onClick !== header.props.onClick,
    'a refresh that folded the section would be the toggle twice',
  )
  // The add glyph moved out of the body and next to refresh (founder, 2026-09-23:
  // *"move + workflow button as an icon button next to refresh"*), and both then
  // moved together into the subheader. The order is pinned rather than the
  // presence, so a later edit that puts it back in the body fails.
  check(
    'the add glyph sits beside the refresh it was moved next to, on its left',
    (() => {
      const band = byAttr(home.tree, 'data-generate-section-facts', PROVIDER)
      if (!band) return false
      const flat = nodesOf(band)
      const addAt = flat.findIndex((node) => node.props && node.props['data-generate-add-button'] === PROVIDER)
      const refreshAt = flat.indexOf(refresh)
      return addAt !== -1 && refreshAt !== -1 && addAt < refreshAt
    })(),
    JSON.stringify(
      nodesOf(byAttr(home.tree, 'data-generate-section-facts', PROVIDER) || { children: [] })
        .filter((node) => node.props && (node.props['data-generate-add-button'] || node.props['data-generate-refresh']))
        .map((node) => node.props['data-generate-add-button'] || node.props['data-generate-refresh']),
    ),
  )

  // NOTHING DRAWS A CARD (founder, 2026-09-25: *"it should be minimal like start surface
  // and make like dashboard"*). The block is a column at the guide's own width on the
  // page's own background — no border, no fill, no radius — so the only lines on the home
  // are the entries' own.
  check(
    'no block draws a card: the section has no border, no fill and no radius',
    (() => {
      const wrap = byAttr(home.tree, 'data-generate-section-wrap', PROVIDER)
      if (!wrap) return false
      const box = wrap.props.style
      return (
        box.border === undefined &&
        box.background === undefined &&
        box.borderRadius === undefined &&
        box.width === 380 &&
        box.maxWidth === '100%'
      )
    })(),
    byAttr(home.tree, 'data-generate-section-wrap', PROVIDER)
      ? JSON.stringify(byAttr(home.tree, 'data-generate-section-wrap', PROVIDER).props.style)
      : 'no section',
  )
  check(
    'the facts line and the entries are held inside that same block, under the caption',
    (() => {
      const wrap = byAttr(home.tree, 'data-generate-section-wrap', PROVIDER)
      const body = byAttr(home.tree, 'data-generate-section-body', PROVIDER)
      return !!wrap && !!body && nodesOf(wrap).includes(header) && nodesOf(wrap).includes(body)
    })(),
    'a body outside the block would be the second card the change removed',
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

// NOTHING FOLDS (founder, 2026-09-25: *"it should be minimal like start surface and make
// like dashboard"*). Every block is open on the first paint, so no click is what makes a
// card reachable, and no caption line is a control at all — the accordion, its chevron
// and its one-open-at-a-time rule are gone.
{
  const real = globalThis.fetch
  globalThis.fetch = stubHost({ units: [KREA, QWEN] }).fetch
  try {
    const flat = await settle(paneSlot.component, { t }, 'pane-flat')
    const all = ['runninghub', 'krea', 'comfycloud', 'magnific']
    check(
      'every block is open on the first paint, with no click to make a card reachable',
      sectionIds(flat).join(',') === all.join(',') &&
        all.every((id) => !!byAttr(flat, 'data-generate-section-body', id)),
      JSON.stringify(sectionIds(flat)),
    )
    check(
      'no caption line is a toggle: nothing on the home folds',
      all.every((id) => {
        const head = byAttr(flat, 'data-generate-section-head', id)
        return (
          !!head &&
          // Two children and no more: the status light and the name. The chevron the
          // fold needed was the third, and it is gone with the fold.
          head.children.length === 2 &&
          head.props.role === undefined &&
          typeof head.props.onClick !== 'function' &&
          typeof head.props.onKeyDown !== 'function'
        )
      }),
      'the caption line is a label: the fold, its chevron and its keyboard contract are gone',
    )
    // The image provider's block, read the same way every other one is: its caption names
    // it, and the facts line under it carries that block's own state.
    const kreaHead = byAttr(flat, 'data-generate-section-head', 'krea')
    const kreaFacts = byAttr(flat, 'data-generate-section-facts', 'krea')
    const kreaHeadText = kreaHead ? textIn(kreaHead) : ''
    const kreaFactsText = kreaFacts ? textIn(kreaFacts) : ''
    check(
      "an image provider's block draws like every other one: the caption names it, the facts line carries its state",
      kreaHeadText.includes('Krea') &&
        !kreaHeadText.includes(EN['settings.kind.image']) &&
        kreaFactsText.includes(EN['wallet.notLinked']) &&
        !kreaFactsText.includes(EN['settings.kind.image']) &&
        !kreaFactsText.includes('installed'),
      'caption: ' + kreaHeadText + ' / facts: ' + kreaFactsText,
    )
    check(
      'an unlinked provider says its state in words rather than drawing an empty wallet',
      textIn(byAttr(flat, 'data-generate-provider-strip', 'krea') || { children: [] }).includes(EN['wallet.notLinked']),
      textIn(byAttr(flat, 'data-generate-provider-strip', 'krea') || { children: [] }),
    )
  } finally {
    globalThis.fetch = real
  }
}

// The add control is the pane's one install control, and it is the harness's own
// Button plus its own CodeBlock (founder, 2026-09-23: "+ workflow is a button
// primitive", "click on + workflow is a code snippet primitive"). It moved out of the
// section body, beside refresh, and then into the subheader, as a glyph (founder,
// 2026-09-23: *"move + workflow button as an icon button next to refresh"*). Its
// click has to yield THAT provider's own prompt, because the phrase the agent's
// skill answers to names the provider.
{
  const real = globalThis.fetch
  globalThis.fetch = stubHost({ units: [] }).fetch
  try {
    const first = await settle(paneSlot.component, { t }, 'pane-add-card')
    const button = byAttr(first, 'data-generate-add-button', PROVIDER)
    const band = byAttr(first, 'data-generate-section-facts', PROVIDER)
    check(
      'a provider with nothing installed carries the add control in its subheader, as a glyph',
      !!button && !!band && nodesOf(band).includes(button),
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
    // THE POPOVER (founder, 2026-09-25: *"click add button launch popover w snippet"*). The
    // snippet used to open inline at the foot of the block, which pushed every card under it
    // down and re-flowed the page. The claims are structural: what the glyph opens is a
    // dialog, it is placed out of the page flow by the app's own anchored hook, and it lives
    // outside the block's body so opening it cannot move a single card.
    // The stub records one call per render, so the OPEN one belongs to the block whose glyph
    // was clicked; the other three blocks are still shut and report `open: false`.
    const livePopover = () => dismissals.filter((entry) => entry.open === true).at(-1)
    const popover = byAttr(after, 'data-generate-add-popover', PROVIDER)
    check(
      'the add glyph opens a popover: a dialog, out of the page flow, holding the snippet',
      (() => {
        if (!popover) return false
        const style = popover.props.style || {}
        const body = byAttr(after, 'data-generate-section-body', PROVIDER)
        const inBody = body ? nodesOf(body).some((node) => node.props && node.props['data-generate-add-popover']) : true
        return (
          popover.props.role === 'dialog' &&
          style.position === 'fixed' &&
          typeof style.left === 'number' &&
          typeof style.top === 'number' &&
          !!byAttr(popover, 'data-generate-add-prompt', PROVIDER) &&
          // The cards' container is untouched by the click: the prompt is not one of them.
          !inBody
        )
      })(),
      popover ? JSON.stringify(popover.props.style) : 'no popover',
    )
    check(
      "the popover is placed and dismissed by the app's own two hooks, not a second system",
      (() => {
        const last = livePopover()
        return (
          !!last &&
          last.open === true &&
          typeof last.setOpen === 'function' &&
          // The root is the block that holds the glyph, so a click on either side of the
          // panel counts as inside.
          !!last.root &&
          typeof last.root === 'object'
        )
      })(),
      JSON.stringify({ open: livePopover()?.open, setter: typeof livePopover()?.setOpen }),
    )
    if (livePopover()) livePopover().setOpen(false)
    const dismissed = await settle(paneSlot.component, { t }, 'pane-add-card')
    check(
      'a pointerdown outside the block closes it',
      !byAttr(dismissed, 'data-generate-add-popover', PROVIDER),
      'the outside-click rule the primitive hands back is what closed it',
    )
    // And Escape, the way every other floating surface in the app closes.
    const reopen = byAttr(dismissed, 'data-generate-add-button', PROVIDER)
    if (reopen) reopen.props.onClick({ stopPropagation: () => {} })
    const again = await settle(paneSlot.component, { t }, 'pane-add-card')
    check('the glyph opens it again after a dismissal', !!byAttr(again, 'data-generate-add-popover', PROVIDER))
    if (keydowns.at(-1)) keydowns.at(-1)({ key: 'Escape' })
    const escaped = await settle(paneSlot.component, { t }, 'pane-add-card')
    check(
      'Escape closes it, and the pane keeps no other way out',
      !byAttr(escaped, 'data-generate-add-popover', PROVIDER),
      'no close button in the card: the key and the outside click are the two ways',
    )
  } finally {
    globalThis.fetch = real
  }
}

// ── the header: the strip's own pattern, one row lower ──────────────────────
//
// THE SHAPE THE FOUNDER ASKED FOR (2026-09-25): *"the separator is below the dsh tabs. then
// below that are the generate workflows headers … styling for tab is: selected=border;
// unselected=no border. then add button like dsh pattern"*, corrected the same day to *"the dsh
// pattern does not have all workflows, it uses add button to create new tab and uses start
// screen to add the tab"* and *"same navigation but below the dsh navigation. same pattern but
// below the separator"*.
//
// So the row is the strip's own pattern one level down: a tab per OPEN WORKFLOW and a plus,
// exactly as the strip above carries a tab per open page and a plus. There is no "All workflows"
// tab, because DSH has none either — the start screen is not a tab, it is what the plus shows.
// DSH's own `addTab` opens the `guide` tab (`openTab(GUIDE_KIND, …)` in the sidebar's actions),
// and the guide's cards are what make a tab; here the plus shows the workflow grid, and a card
// on it opens that workflow's tab. The separator above the row is the DSH strip's own, so the
// row draws none of its own.
{
  const tabsOf = (tree) =>
    nodesOf(tree)
      .filter((node) => node.props && node.props['data-generate-tab'])
      .map((node) => node.props['data-generate-tab'])
  const pillOf = (tree, key) =>
    nodesOf(tree).find((node) => node.props && node.props['data-generate-tab-pill'] === key) || null
  const borderOf = (tree, key) => (pillOf(tree, key) ? pillOf(tree, key).props.style.border : 'no pill')

  const bare = await pane({ units: [KREA, QWEN] }, { key: 'pane-header' })
  check(
    'with nothing open there is no row at all: the start screen needs no plus beside it',
    !byAttr(bare.tree, 'data-generate-header', 'yes') &&
      !byAttr(bare.tree, 'data-generate-tab-add', 'yes') &&
      tabsOf(bare.tree).length === 0 &&
      // …and the start screen itself is what is drawn, straight under the separator.
      !!byAttr(bare.tree, 'data-generate-sections'),
    JSON.stringify(tabsOf(bare.tree)),
  )

  // A card on the start screen is what makes a tab, the way DSH's guide entries do.
  const kreaCard = byAttr(bare.tree, 'data-generate-unit', KREA.name)
  if (kreaCard) kreaCard.props.onClick()
  const one = await pane({ units: [KREA, QWEN] }, { key: 'pane-header' })
  check(
    'a card on the start screen opens its workflow as a tab, named by the workflow',
    (() => {
      const tab = byAttr(one.tree, 'data-generate-tab', KREA.name)
      return (
        tabsOf(one.tree).join(',') === KREA.name &&
        !!tab &&
        textIn(tab).trim() === KREA.title &&
        pillOf(one.tree, KREA.name) !== null &&
        pillOf(one.tree, KREA.name).props['data-generate-tab-selected'] === 'yes' &&
        borderOf(one.tree, KREA.name) === '.5px solid var(--dsw-alias-border-l3)' &&
        !!byAttr(one.tree, 'data-generate-tab-close', KREA.name)
      )
    })(),
    JSON.stringify(tabsOf(one.tree)),
  )
  check(
    'a tab is as wide as its label: no cap on the pill and no ellipsis on the name',
    (() => {
      const pill = pillOf(one.tree, KREA.name)
      const label = byAttr(one.tree, 'data-generate-tab', KREA.name)
      if (!pill || !label) return false
      return (
        pill.props.style.maxWidth === undefined &&
        label.props.style.overflow === undefined &&
        label.props.style.textOverflow === undefined &&
        // One line, never wrapped: the row scrolls instead.
        label.props.style.whiteSpace === 'nowrap'
      )
    })(),
    'the pill used to cap at 200px and ellipsise, which is what turned two Qwen apps into one name',
  )
  check(
    'the row is the first thing under the separator: the header comes before the content',
    (() => {
      const header = byAttr(one.tree, 'data-generate-header', 'yes')
      const order = nodesOf(one.tree)
      return !!header && order.indexOf(header) < order.indexOf(byAttr(one.tree, 'data-generate-surface'))
    })(),
    'the separator above it is the DSH strip\'s, so the pane draws none of its own',
  )
  check(
    'the row takes the DSH strip\'s own breath: 10px above its tabs and 10px below them',
    (() => {
      const header = byAttr(one.tree, 'data-generate-header', 'yes')
      // The strip's own rule is `padding:10px 6px 0 …`, so a DSH pill sits 10px under the top
      // of the viewport; these tabs sit 10px under the hairline, and the same 10px separates
      // them from what follows — one number, both sides (founder: *"i meant same spacing top
      // and bottom"*).
      return !!header && header.props.style.padding === '10px 8px'
    })(),
    'the strip shares its top padding with no other row, so this one copies the number',
  )

  check(
    'the row draws no hairline of its own: the separator above it is the DSH strip\'s',
    (() => {
      const header = byAttr(one.tree, 'data-generate-header', 'yes')
      if (!header) return false
      // The DSH strip's own header already draws `.5px solid var(--dsw-alias-border-l2)`; a
      // second line here stacked on it and the boundary read as one thick rule (founder,
      // 2026-09-25: *"remove separator"*).
      return (
        header.props.style.borderTop === undefined &&
        header.props.style.borderBottom === undefined
      )
    })(),
    'the row drew a hairline above itself for a few hours, doubling the DSH strip\'s own line',
  )

  check(
    'the add button carries the plus and says what it is, so it is not the DSH strip\'s bare plus',
    (() => {
      const add = byAttr(one.tree, 'data-generate-tab-add', 'yes')
      if (!add) return false
      const button = byAttr(add, 'data-stub', 'button')
      const plus = nodesOf(add).find((node) => node.props && node.props['data-stub'] === 'plus')
      return (
        !!button &&
        !!plus &&
        textIn(add).trim() === EN['tabs.addLabel'] &&
        button.props['aria-label'] === EN['tabs.add'] &&
        button.props.title === EN['tabs.add']
      )
    })(),
    byAttr(one.tree, 'data-generate-tab-add', 'yes') ? JSON.stringify(byAttr(one.tree, 'data-generate-tab-add', 'yes').props) : 'no add button',
  )

  // The plus shows the start screen again; the tab keeps its place on the row.
  if (byAttr(one.tree, 'data-generate-tab-add', 'yes')) byAttr(one.tree, 'data-generate-tab-add', 'yes').props.onClick()
  const back = await pane({ units: [KREA, QWEN] }, { key: 'pane-header' })
  check(
    'the plus shows the start screen again, and the open tab keeps its place on the row',
    (() => {
      const mode = byAttr(back.tree, 'data-generate-pane')
      return (
        !!mode &&
        mode.props['data-generate-pane'] === 'home' &&
        !!byAttr(back.tree, 'data-generate-sections') &&
        tabsOf(back.tree).join(',') === KREA.name &&
        pillOf(back.tree, KREA.name) !== null &&
        pillOf(back.tree, KREA.name).props['data-generate-tab-selected'] === 'no' &&
        // Same width, transparent: switching between the start screen and a tab moves no pixel.
        borderOf(back.tree, KREA.name) === '.5px solid transparent'
      )
    })(),
    JSON.stringify(tabsOf(back.tree)),
  )
  // The plus wears the selected state too (founder, 2026-09-25: *"when I click + there should be
  // border if we follow pattern"*): the primitive's `outline` while the start screen is showing,
  // a plain ghost while a workflow is, so "which view am I on" reads the same on both controls.
  check(
    'the plus carries the border while the start screen is what the pane shows',
    (() => {
      const onStart = byAttr(back.tree, 'data-generate-tab-add', 'yes')
      const onWorkflow = byAttr(one.tree, 'data-generate-tab-add', 'yes')
      const variant = (span) => {
        const button = span ? byAttr(span, 'data-stub', 'button') : null
        return button ? button.props.variant : 'no button'
      }
      return variant(onStart) === 'outline' && variant(onWorkflow) === 'ghost'
    })(),
    'outline@start vs ghost@workflow',
  )

  const qwenCard = byAttr(back.tree, 'data-generate-unit', QWEN.name)
  if (qwenCard) qwenCard.props.onClick()
  const two = await pane({ units: [KREA, QWEN] }, { key: 'pane-header' })
  check(
    'two tabs, one border: the open workflow wears it and the other does not',
    (() => {
      const kreaPill = pillOf(two.tree, KREA.name)
      const qwenPill = pillOf(two.tree, QWEN.name)
      return (
        tabsOf(two.tree).join(',') === KREA.name + ',' + QWEN.name &&
        !!kreaPill &&
        !!qwenPill &&
        qwenPill.props['data-generate-tab-selected'] === 'yes' &&
        borderOf(two.tree, QWEN.name) === '.5px solid var(--dsw-alias-border-l3)' &&
        kreaPill.props['data-generate-tab-selected'] === 'no' &&
        borderOf(two.tree, KREA.name) === '.5px solid transparent'
      )
    })(),
    JSON.stringify(tabsOf(two.tree)),
  )
  check(
    'an unselected tab\'s close is hidden by the sheet, not drawn beside its name',
    (() => {
      // founder, 2026-09-25: *"the pattern in dsh is when the tab is unselected there is no
      // close icon"*. Every tab still owns a close — that is how a tab is closed — but its
      // visibility belongs to the sheet's `.dsh-generate-tabClose` rule, keyed to the pill's own
      // selected/hover/focus state, so nothing about it is decided inline, and the unselected
      // pill is where the rule reads "no".
      const closeOf = (tree, key) => byAttr(tree, 'data-generate-tab-close', key)
      const bare = (node) =>
        !!node &&
        node.props.className === 'dsh-generate-tabClose' &&
        !node.props.style.opacity &&
        !node.props.style.visibility &&
        node.props.style.display !== 'none'
      return (
        bare(closeOf(two.tree, KREA.name)) &&
        bare(closeOf(two.tree, QWEN.name)) &&
        pillOf(two.tree, KREA.name).props['data-generate-tab-selected'] === 'no' &&
        pillOf(two.tree, QWEN.name).props['data-generate-tab-selected'] === 'yes'
      )
    })(),
    JSON.stringify(byAttr(two.tree, 'data-generate-tab-close', KREA.name).props),
  )
  check(
    'the file name is nowhere on the row: a tab reads its workflow\'s own title',
    (() => {
      const row = byAttr(two.tree, 'data-generate-header', 'yes')
      const text = row ? textIn(row) : ''
      return !text.includes(KREA.name) && !text.includes(QWEN.name) && text.includes(KREA.title) && text.includes(QWEN.title)
    })(),
    textIn(byAttr(two.tree, 'data-generate-header', 'yes')).slice(0, 160),
  )

  if (byAttr(two.tree, 'data-generate-tab-close', QWEN.name)) byAttr(two.tree, 'data-generate-tab-close', QWEN.name).props.onClick()
  const closed = await pane({ units: [KREA, QWEN] }, { key: 'pane-header' })
  check(
    'closing the open tab takes it off the row and lands back on the start screen',
    (() => {
      const mode = byAttr(closed.tree, 'data-generate-pane')
      return (
        tabsOf(closed.tree).join(',') === KREA.name &&
        !!mode &&
        mode.props['data-generate-pane'] === 'home' &&
        !!byAttr(closed.tree, 'data-generate-sections') &&
        !!byAttr(closed.tree, 'data-generate-tab-add', 'yes')
      )
    })(),
    JSON.stringify(tabsOf(closed.tree)),
  )

  // A NARROW TAB MAY READ A SHORTER NAME (founder, 2026-09-25: *"the workflow tab fontsize too
  // big, maybe we need to use different names in to make it easier to read. Qwen Duo / Qwen
  // Multi / H3 F/L / Krea Raw / Krea Turbo / Krea Medium / Krea Large"*). The short name is
  // authored on the adapter (`ui.tabLabel`); the 380px card keeps the workflow's own title, and
  // a workflow that authors none reads its title on both (which the two tabs above prove).
  const short = { ...KREA, name: 'long-titled-app', title: 'A Very Long Workflow Title', tabLabel: 'Short' }
  const named = await pane({ units: [short] }, { key: 'pane-header-named' })
  const namedCard = byAttr(named.tree, 'data-generate-unit', short.name)
  if (namedCard) namedCard.props.onClick()
  const withShort = await pane({ units: [short] }, { key: 'pane-header-named' })
  check(
    'a card keeps the workflow title, and the tab may read the shorter name it authors',
    (() => {
      const card = byAttr(named.tree, 'data-generate-unit', short.name)
      const tab = byAttr(withShort.tree, 'data-generate-tab', short.name)
      return (
        !!card &&
        textIn(card).includes(short.title) &&
        !!tab &&
        textIn(tab).trim() === short.tabLabel &&
        !textIn(byAttr(withShort.tree, 'data-generate-header', 'yes')).includes(short.title)
      )
    })(),
    'the narrow tab reads the short name; the card keeps the title',
  )
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
check(
  'the surface has a way back to the start screen: the header\'s plus',
  !!byAttr(opened.tree, 'data-generate-tab-add', 'yes') && !byAttr(opened.tree, 'data-generate-back', 'yes'),
)

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

// ── two of the fixes the founder asked for on opening a workflow ─────────────
//
// "Increase gap space below. Design for responsive, past mobile breakpoint we should 2
//  column parameters + output preview. … for number input use the correct primitive"
// (2026-09-23). The back arrow that request produced is GONE (founder, 2026-09-25): the
// pane's header carries the same control as its first tab, so the surface repeats nothing.

{
  const props = { t, useTabInfo: () => ({ tab: { navigation: { params: { unit: KREA.name, provider: PROVIDER }, revision: 1 } } }) }
  check(
    "a surface carries no way-out button of its own: the header's plus leads to the start screen",
    !byAttr(opened.tree, 'data-generate-back', 'yes') && !!byAttr(opened.tree, 'data-generate-tab-add', 'yes'),
    JSON.stringify(nodesOf(opened.tree).filter((node) => node.props && node.props['data-stub'] === 'chevron-left').length) + ' left chevron(s) on the surface',
  )
  check(
    'parameters and output are two columns that wrap, so a wide pane puts them side by side',
    (() => {
      const columns = byAttr(opened.tree, 'data-generate-columns', 'two')
      const params = byAttr(opened.tree, 'data-generate-column', 'params')
      if (!columns || !params) return false
      // The wrap is the breakpoint: the pane's own width decides, not the window's.
      if (columns.props.style.flexWrap !== 'wrap') return false
      const kids = nodesOf(columns)
      // The parameter column is the first of the two, and it holds the doors.
      return kids.includes(params) && kids[1] === params && !!byAttr(params, 'data-generate-door-row', 'megapixels')
    })(),
    'a wrapping row of two columns is the responsive shape a resizable pane needs',
  )
  // TWO TO THREE, NOT ONE TO ONE (founder, 2026-09-25: *"the ratio of parameters/preview try
  // 2/5:3/5 of 5 column after a mobile breakpoint"*). The zero basis is what makes that exact:
  // flex divides the FREE width by the grow factors, so 2 and 3 land on 2/5 and 3/5 of the row.
  // An authored basis would sit inside the ratio and neither card would be the fraction it says.
  check(
    'the parameters and preview cards stand in a 2:3 ratio, and stack only when the pane is narrow',
    (() => {
      const params = byAttr(opened.tree, 'data-generate-card', 'params')
      const preview = byAttr(opened.tree, 'data-generate-card', 'preview')
      if (!params || !preview) return false
      const p = params.props.style
      const o = preview.props.style
      return (
        p.flex === '2 1 0' &&
        o.flex === '3 1 0' &&
        // The minima are the breakpoint: below their sum the row wraps and each card takes its
        // own line, which is what makes a narrow pane stack them.
        typeof p.minWidth === 'number' &&
        typeof o.minWidth === 'number'
      )
    })(),
    JSON.stringify({
      params: byAttr(opened.tree, 'data-generate-card', 'params').props.style.flex,
      preview: byAttr(opened.tree, 'data-generate-card', 'preview').props.style.flex,
    }),
  )
  check(
    'a workflow whose run is not built yet still gets its preview card, and says so in it',
    (() => {
      // This fixture's workflow cannot run, so the note that says running comes next is
      // the preview card's own content: two cards whether or not the run behind one of
      // them exists, rather than a lopsided pane that fills in later.
      const preview = byAttr(opened.tree, 'data-generate-card', 'preview')
      const params = byAttr(opened.tree, 'data-generate-card', 'params')
      const pending = byAttr(opened.tree, 'data-generate-run-pending', 'yes')
      if (!preview || !params || !pending) return false
      return nodesOf(preview).includes(pending) && !nodesOf(params).includes(pending) && preview.props['data-generate-output-empty'] === 'yes'
    })(),
    'two cards, whether or not the run behind one of them is built',
  )

  // The number door is the stepper primitive: a decrement, the value, an increment.
  check(
    'a number door draws the stepper the founder asked for: minus, value, plus',
    (() => {
      const box = byAttr(opened.tree, 'data-generate-stepper', 'megapixels')
      const down = byAttr(opened.tree, 'data-generate-step-down', 'megapixels')
      const up = byAttr(opened.tree, 'data-generate-step-up', 'megapixels')
      const value = byAttr(opened.tree, 'data-generate-door', 'megapixels')
      if (!box || !down || !up || !value) return false
      // The value keeps the door's own identity and bounds; the buttons are the new part.
      return (
        nodesOf(box).includes(value) &&
        nodesOf(box).includes(down) &&
        nodesOf(box).includes(up) &&
        value.props.min === 0.1 &&
        value.props.max === 16 &&
        value.props.step === 0.1 &&
        down.props['aria-label'] === EN['surface.step.down'] &&
        up.props['aria-label'] === EN['surface.step.up']
      )
    })(),
    JSON.stringify(!!byAttr(opened.tree, 'data-generate-stepper', 'megapixels')),
  )
  const stepUp = byAttr(opened.tree, 'data-generate-step-up', 'megapixels')
  if (stepUp) stepUp.props.onClick()
  const stepped = await settle(paneSlot.component, props, 'pane-opened')
  check(
    "the increment moves the value by the app's own step, and the value stays a value",
    String(byAttr(stepped, 'data-generate-door', 'megapixels').props.value) === '2.1',
    String(byAttr(stepped, 'data-generate-door', 'megapixels').props.value),
  )
  // Walk it down to the app's own floor: the value stops there and the button goes dead.
  let floored = stepped
  for (let press = 0; press < 24; press += 1) {
    const down = byAttr(floored, 'data-generate-step-down', 'megapixels')
    if (!down || down.props.disabled === true) break
    down.props.onClick()
    floored = await settle(paneSlot.component, props, 'pane-opened')
  }
  check(
    "the stepper stops at the app's own floor and disables the control that would pass it",
    (() => {
      const value = byAttr(floored, 'data-generate-door', 'megapixels')
      const down = byAttr(floored, 'data-generate-step-down', 'megapixels')
      return String(value.props.value) === '0.1' && !!down && down.props.disabled === true
    })(),
    JSON.stringify({
      value: String(byAttr(floored, 'data-generate-door', 'megapixels').props.value),
      disabled: byAttr(floored, 'data-generate-step-down', 'megapixels').props.disabled,
    }),
  )
  // Put it back where the fixture had it, so the checks after this block read the same
  // surface the fixture authored.
  const backUp = byAttr(floored, 'data-generate-step-up', 'megapixels')
  if (backUp) {
    const input = byAttr(floored, 'data-generate-door', 'megapixels')
    input.props.onChange({ target: { value: '2' } })
    await settle(paneSlot.component, props, 'pane-opened')
  }
}
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
  (() => {
    const strip = byAttr(failed.tree, 'data-generate-provider-strip', PROVIDER)
    const note = byAttr(failed.tree, 'data-generate-source')
    // The balance is the strip's own fact and the provenance note is gone from the page
    // (founder, 2026-09-25: *"remove stored on this machine"*) — but the source itself is
    // still on the DOM node, which is where that seam belongs.
    return !!strip && textIn(strip).includes('8,600') && !!note
  })(),
  '',
)

// ── S5: the run and the result ──────────────────────────────────────────────
//
// Founder, 2026-09-23: *"i want s5 for krea"*, and the same day the gate went away:
// *"we don't need the confirmation modal, click the button can just run the job"*. A
// runnable surface offers the run; ONE PRESS posts it outright — no dialog, no preview
// fetch — the control is disabled while it is on its way, and what comes back is drawn
// on the strip. The host's half (it still demands `confirmed: true` and refuses a
// payload the API would reject) is verify/run.mjs — this is the half a person touches.
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
    // The two columns, on a surface that has something to put in the second one: the
    // control that spends stays with the form, and the output column waits beside it
    // (founder, 2026-09-23: *"2 column parameters + output preview"*).
    check(
      'the run control is in the parameters column and the output column waits beside it',
      (() => {
        const params = byAttr(tree, 'data-generate-column', 'params')
        const output = nodesOf(tree).find((node) => node.props && node.props['data-generate-run-output'] === MODEL_UNIT.name)
        const columns = byAttr(tree, 'data-generate-columns', 'two')
        if (!params || !output || !columns || !runButton) return false
        return (
          nodesOf(params).includes(runButton) &&
          !nodesOf(output).includes(runButton) &&
          nodesOf(columns).includes(output) &&
          columns.props.style.flexWrap === 'wrap'
        )
      })(),
      'the run control belongs with the form; what the run makes belongs beside it',
    )
    check(
      'the output column is drawn and quiet before a run, rather than missing',
      !!nodesOf(tree).find((node) => node.props && node.props['data-generate-run-output'] === MODEL_UNIT.name) &&
        !!byAttr(tree, 'data-generate-output-empty', 'yes'),
      'a column that appears only after a run would make the pane jump',
    )
    // TWO CARDS, ONE SURFACE (founder, 2026-09-23: *"let's make layout 2 cards, parameters
    // card and preview card, these are reusable components so when you build UI from
    // design.md it will be consistent"*). Equal background, border, radius and padding is
    // what "reusable component" means in a bundle with no CSS layer to share — the two
    // cards differ in how wide they grow, not in what they look like.
    check(
      'the parameters and the preview are two cards drawn from one surface',
      (() => {
        const params = byAttr(tree, 'data-generate-card', 'params')
        const preview = byAttr(tree, 'data-generate-card', 'preview')
        if (!params || !preview) return false
        const styles = [params.props.style, preview.props.style]
        const same = (key) => styles[0][key] === styles[1][key]
        // Equal to each other AND equal to the kit's own values: two cards that agree on
        // a wrong surface would pass a comparison-only check.
        return (
          same('background') &&
          same('border') &&
          same('borderRadius') &&
          same('padding') &&
          styles[0].background === 'var(--dsw-alias-bg-layer-2)' &&
          styles[0].borderRadius === 12 &&
          styles[0].padding === '14px' &&
          String(styles[0].border).includes('--dsw-alias-border-l3') &&
          !/eva|--card/i.test(JSON.stringify(styles[0]))
        )
      })(),
      JSON.stringify(byAttr(tree, 'data-generate-card', 'preview') ? byAttr(tree, 'data-generate-card', 'preview').props.style : 'no preview card'),
    )
    check(
      'the result lands in the preview card, not beside the form',
      (() => {
        const preview = byAttr(tree, 'data-generate-card', 'preview')
        const params = byAttr(tree, 'data-generate-card', 'params')
        const run = byAttr(tree, 'data-generate-run', MODEL_UNIT.name)
        return !!preview && !!params && !!run && nodesOf(params).includes(run) && !nodesOf(preview).includes(run)
      })(),
      'one card spends, the other one shows',
    )
    // THE ASPECT DOOR SHAPES THE CANVAS (founder, 2026-09-23: *"the aspect controls the shape
    // of preview card"*). The door that decides what the provider is asked for decides what
    // the person sees — before the run as well as after it.
    check(
      'the preview canvas takes the shape the workflow\'s own aspect door asks for',
      (() => {
        const frame = byAttr(tree, 'data-generate-preview-frame', MODEL_UNIT.name)
        return !!frame && frame.props['data-generate-preview-shape'] === '1:1' && frame.props.style.aspectRatio === '1 / 1'
      })(),
      JSON.stringify(byAttr(tree, 'data-generate-preview-frame', MODEL_UNIT.name) ? byAttr(tree, 'data-generate-preview-frame', MODEL_UNIT.name).props.style.aspectRatio : 'no canvas'),
    )
    const aspectDoor = byAttr(tree, 'data-generate-door', 'aspect_ratio')
    if (aspectDoor) aspectDoor.props.onChange({ target: { value: '16:9' } })
    const reshaped = await settle(paneSlot.component, props, 'pane-run')
    check(
      'choosing a different aspect reshapes the canvas, before anything runs',
      (() => {
        const frame = byAttr(reshaped, 'data-generate-preview-frame', MODEL_UNIT.name)
        return !!frame && frame.props['data-generate-preview-shape'] === '16:9' && frame.props.style.aspectRatio === '16 / 9'
      })(),
      JSON.stringify(byAttr(reshaped, 'data-generate-preview-frame', MODEL_UNIT.name) ? byAttr(reshaped, 'data-generate-preview-frame', MODEL_UNIT.name).props['data-generate-preview-shape'] : 'no canvas'),
    )
    // Back to the fixture's own shape, so the checks after this block read what it authored.
    const backToSquare = byAttr(reshaped, 'data-generate-door', 'aspect_ratio')
    if (backToSquare) backToSquare.props.onChange({ target: { value: '1:1' } })
    await settle(paneSlot.component, props, 'pane-run')
    // The other half of the split rule: this provider declares no run modes, so the control
    // is the plain button it always was — a segment opening an empty list would be worse.
    check(
      'a provider with no run modes draws the plain run button, with no empty split',
      !!runButton && !byAttr(tree, 'data-generate-split', 'yes') && !byAttr(tree, 'data-generate-mode-toggle', 'yes'),
      JSON.stringify({ split: !!byAttr(tree, 'data-generate-split', 'yes'), toggle: !!byAttr(tree, 'data-generate-mode-toggle', 'yes') }),
    )
    check('nothing is posted until that control is pressed', stub.runs.length === 0, JSON.stringify(stub.runs))

    // ONE PRESS SPENDS (founder, 2026-09-23: *"we don't need the confirmation modal,
    // click the button can just run the job"*): the press posts the run outright — no
    // dialog opens and no preview is fetched. What the API would refuse is the host's
    // answer to refuse (verify/run.mjs drives that half), so an empty required door is a
    // strip failure rather than a dialog that used to block the button.
    if (runButton) runButton.props.onClick()
    const started = await settle(paneSlot.component, props, 'pane-run')
    check(
      'the run control posts the run outright: no dialog, no preview, one press',
      !nodesOf(started).some((node) => node.props && node.props['data-stub'] === 'modal') &&
        !nodesOf(started).some((node) => node.props && node.props['data-generate-gate-row']) &&
        !stub.calls.some((call) => String(call.url).endsWith('/payload')) &&
        stub.runs.length === 1 &&
        stub.runs[0].confirmed === true &&
        stub.runs[0].name === MODEL_UNIT.name,
      JSON.stringify({ runs: stub.runs.length, calls: stub.calls.map((call) => String(call.url)) }),
    )
    check(
      'the strip says the run is in flight, with its job id beside the phase',
      !!byAttr(started, 'data-generate-run-strip', 'running') && !!byAttr(started, 'data-generate-run-job', 'job-1'),
      JSON.stringify(nodesOf(started).filter((node) => node.props && (node.props['data-generate-run-strip'] || node.props['data-generate-run-job'])).map((node) => node.props['data-generate-run-strip'] || node.props['data-generate-run-job'])),
    )
    // The spinner (founder, 2026-09-23: *"add spinner to left of Running"*): the
    // harness's own loading glyph, the FIRST thing in the strip — left of the phase —
    // on the class the injected sheet spins.
    check(
      'the strip wears the loading glyph, spinning, left of the phase it reports',
      (() => {
        const strip = byAttr(started, 'data-generate-run-strip', 'running')
        const spin = byAttr(started, 'data-generate-run-spin', 'running')
        if (!strip || !spin || strip.children[0] !== spin) return false
        const icon = nodesOf(spin).find((node) => node.props && node.props['data-stub'] === 'loading')
        return !!icon && icon.props.className === 'dsh-generate-spin'
      })(),
      'the spin span is the strip\'s first child and carries the animated class',
    )
    check(
      'the control is always enabled so the user can queue concurrent runs',
      (() => {
        const live = byAttr(started, 'data-generate-run', MODEL_UNIT.name)
        return !!live && live.props.disabled === false
      })(),
      'enabled at queued',
    )
    // STOP IT (founder, 2026-09-25: *"it seems like cancel button got removed"*). The route and
    // `useRun`'s own handler were both there and no control was drawn, so a run in flight had no
    // way out on screen. The strip carries it while the run is in flight, and only then.
    {
      const cancel = byAttr(started, 'data-generate-run-cancel', 'job-1')
      check(
        'the strip carries a Cancel while the run is in flight',
        !!cancel && textIn(cancel) === 'Cancel' && cancel.props.disabled === false,
        cancel ? textIn(cancel) : 'no cancel control',
      )
      const callsBefore = stub.calls.length
      if (cancel) cancel.props.onClick()
      await settle(paneSlot.component, props, 'pane-run')
      check(
        'pressing it asks the host to cancel that job',
        stub.calls.length === callsBefore + 1 &&
          String(stub.calls.at(-1).url).endsWith('/cancel') &&
          JSON.parse(String(stub.calls.at(-1).body)).jobId === 'job-1',
        JSON.stringify(stub.calls.slice(callsBefore).map((call) => ({ url: call.url, method: call.method }))),
      )
    }

    // One poll by hand, which is what the interval would have done two seconds later.
    const poll = timers[timers.length - 1]
    if (poll) poll()
    const done = await settle(paneSlot.component, props, 'pane-run')
    check(
      'the finished run is drawn: the image the provider returned, and Open in Finder over its saved file',
      (() => {
        const result = byAttr(done, 'data-generate-result', 'https://gen.krea.ai/out.png')
        const image = result ? nodesOf(result).find((node) => node.type === 'img') : null
        const finder = byAttr(done, 'data-generate-result-finder', '/tmp/generate/library/krea/krea-2-medium-turbo/20260923-job-1.png')
        return (
          !!result &&
          !!image &&
          image.props.src === 'https://gen.krea.ai/out.png' &&
          !!finder &&
          typeof finder.props.onClick === 'function' &&
          // A saved file means NO browser link — Finder is the handle (founder,
          // 2026-09-23: *"Open the image opens in browser, but its more useful to
          // open in finder"*).
          !byAttr(done, 'data-generate-result-url', 'https://gen.krea.ai/out.png')
        )
      })(),
      JSON.stringify(nodesOf(done).filter((node) => node.props && node.props['data-generate-result']).map((node) => node.props['data-generate-result'])),
    )
    check(
      'a settled run carries no Cancel: the strip is the only place the control lives',
      !byAttr(done, 'data-generate-run-cancel', 'job-1') && !byAttr(done, 'data-generate-run-strip', 'running'),
      JSON.stringify(nodesOf(done).filter((node) => node.props && node.props['data-generate-run-cancel']).map((node) => node.props['data-generate-run-cancel'])),
    )
    check(
      'the pane says where the bytes were saved, from the host\'s own answer',
      (() => {
        const line = byAttr(done, 'data-generate-saved', '/tmp/generate/library/krea/krea-2-medium-turbo/20260923-job-1.png')
        return !!line && textIn(line).includes(EN['run.saved']) && textIn(line).includes('20260923-job-1.png')
      })(),
      JSON.stringify(nodesOf(done).filter((node) => node.props && node.props['data-generate-saved']).map((node) => textIn(node))),
    )
    // Pressing it posts the reveal WITH the file, to the library route.
    const callsBeforeFinder = stub.calls.length
    const finderButton = byAttr(done, 'data-generate-result-finder', '/tmp/generate/library/krea/krea-2-medium-turbo/20260923-job-1.png')
    if (finderButton) finderButton.props.onClick()
    await settle(paneSlot.component, props, 'pane-run')
    check(
      'Open in Finder posts the reveal with that exact file path',
      (() => {
        const posted = stub.calls.slice(callsBeforeFinder).find((call) => String(call.url).endsWith('/plugins/generate/library') && call.method === 'POST')
        if (!posted) return false
        const body = JSON.parse(posted.body)
        return body.action === 'reveal' && body.file === '/tmp/generate/library/krea/krea-2-medium-turbo/20260923-job-1.png'
      })(),
      JSON.stringify(stub.calls.slice(callsBeforeFinder).map((call) => ({ url: call.url, body: call.body }))),
    )
    // No "Run again" button (founder, 2026-09-23: *"run again button can be removed"*):
    // the parameters card never left, so the form itself is the way back. Type into it
    // and press Run: what the form held when pressed is what the run posts.
    check(
      'there is no Run again button on a finished run — the form never left the screen',
      !byAttr(done, 'data-generate-run-again', 'yes') && !!byAttr(done, 'data-generate-run', MODEL_UNIT.name),
      byAttr(done, 'data-generate-run-again', 'yes') ? 'a Run again button is still drawn' : 'the Run control is the way back',
    )
    const formBack = done
    const promptDoor = nodesOf(formBack).find((node) => node.props && node.props['data-generate-door'] === 'prompt')
    if (promptDoor) promptDoor.props.onChange({ target: { value: 'a cinematic glass cabin' } })
    const typed = await settle(paneSlot.component, props, 'pane-run')
    const pressed = byAttr(typed, 'data-generate-run', MODEL_UNIT.name)
    if (pressed) pressed.props.onClick()
    await settle(paneSlot.component, props, 'pane-run')
    check(
      'what the form held when pressed is what the run posts',
      stub.runs.length === 2 &&
        stub.runs[1].confirmed === true &&
        stub.runs[1].values.prompt === 'a cinematic glass cabin',
      JSON.stringify(stub.runs.map((run) => run.values)),
    )
  } finally {
    globalThis.fetch = real
  }
}

// ── the concurrency queue: one row per job, each stoppable on its own ────────
//
// Founder, 2026-09-25: *"the concurrency queue should be 1 row each so we can stop each one
// individually"*. The first cut drew only the newest run, and the one Cancel read that run's
// id off the closure, so a second job in flight had no face and no way out. `jobStates:
// ['queued']` is what keeps every job in flight — the single-run scenarios above settle on
// their first poll, which is exactly the state this slice is not about.
{
  const props = {
    t,
    useTabInfo: () => ({ tab: { navigation: { params: { unit: MODEL_UNIT.name, provider: 'krea' }, revision: 1 } } }),
  }
  const stub = stubHost({ units: [], kreaUnits: [MODEL_UNIT], file: MODEL, jobStates: ['queued'] })
  const real = globalThis.fetch
  globalThis.fetch = stub.fetch
  try {
    let typed = await settle(paneSlot.component, props, 'pane-queue')
    const door = nodesOf(typed).find((node) => node.props && node.props['data-generate-door'] === 'prompt')
    if (door) door.props.onChange({ target: { value: 'a cinematic glass cabin' } })
    typed = await settle(paneSlot.component, props, 'pane-queue')
    // TWO PRESSES WITH NO AWAIT BETWEEN THEM, which is the race the per-run identity
    // exists for: a double press puts both starts in the air at once, and a write into
    // whatever slot happens to be last lands both answers in the newest one, leaving the
    // first job stuck as `starting` with no id of its own.
    const control = byAttr(typed, 'data-generate-run', MODEL_UNIT.name)
    if (control) {
      control.props.onClick()
      control.props.onClick()
    }
    // The same walk key every time: the harness keys component state by that path, so a
    // fresh key would throw the run state away between presses.
    typed = await settle(paneSlot.component, props, 'pane-queue')
    check(
      'two presses at once are two jobs, each holding its own job id',
      (() => {
        const rows = nodesOf(typed).filter((node) => node.props && node.props['data-generate-queue-row'])
        return (
          !!byAttr(typed, 'data-generate-queue-list', '2') &&
          rows.map((row) => row.props['data-generate-queue-row']).join(',') === 'job-1,job-2'
        )
      })(),
      JSON.stringify(nodesOf(typed).filter((node) => node.props && node.props['data-generate-queue-row']).map((node) => node.props['data-generate-queue-row'])),
    )
    const third = byAttr(typed, 'data-generate-run', MODEL_UNIT.name)
    if (third) third.props.onClick()
    typed = await settle(paneSlot.component, props, 'pane-queue')
    check(
      'three presses against a provider that allows three are three jobs',
      stub.runs.length === 3 && stub.runs.every((run) => run.confirmed === true),
      JSON.stringify(stub.runs.map((run) => run.values)),
    )
    check(
      'the queue draws one row per job in flight, in the order they were started',
      (() => {
        const rows = nodesOf(typed).filter((node) => node.props && node.props['data-generate-queue-row'])
        return (
          !!byAttr(typed, 'data-generate-queue-list', '3') &&
          rows.map((row) => row.props['data-generate-queue-row']).join(',') === 'job-1,job-2,job-3' &&
          rows.every((row) => textIn(row).includes(row.props['data-generate-queue-row']))
        )
      })(),
      JSON.stringify(nodesOf(typed).filter((node) => node.props && node.props['data-generate-queue-row']).map((node) => node.props['data-generate-queue-row'])),
    )
    check(
      'every row carries its own Stop, so any one of them can be stopped',
      ['job-1', 'job-2', 'job-3'].every((jobId) => {
        const stop = byAttr(typed, 'data-generate-queue-stop', jobId)
        return !!stop && stop.props.disabled === false && textIn(stop) === 'Cancel'
      }),
      JSON.stringify(nodesOf(typed).filter((node) => node.props && node.props['data-generate-queue-stop']).map((node) => node.props['data-generate-queue-stop'])),
    )
    // STOP THE ONE THAT WAS PRESSED, not the newest. This is the whole point of a row each:
    // the route has always taken a job id, and now the control sends that row's own.
    const stopSecond = byAttr(typed, 'data-generate-queue-stop', 'job-2')
    const callsBefore = stub.calls.length
    if (stopSecond) stopSecond.props.onClick()
    const stopped = await settle(paneSlot.component, props, 'pane-queue')
    check(
      'Stop on a row cancels THAT job, not the newest one',
      (() => {
        const posted = stub.calls.slice(callsBefore).find((call) => String(call.url).endsWith('/cancel'))
        return !!posted && JSON.parse(String(posted.body)).jobId === 'job-2'
      })(),
      JSON.stringify(stub.calls.slice(callsBefore).map((call) => ({ url: call.url, body: call.body }))),
    )
    check(
      'and the other two rows are still there, still stoppable',
      !!byAttr(stopped, 'data-generate-queue-list', '3') &&
        !!byAttr(stopped, 'data-generate-queue-row', 'job-1') &&
        !!byAttr(stopped, 'data-generate-queue-row', 'job-3') &&
        !!byAttr(stopped, 'data-generate-queue-stop', 'job-3'),
      JSON.stringify(nodesOf(stopped).filter((node) => node.props && node.props['data-generate-queue-row']).map((node) => node.props['data-generate-queue-row'])),
    )
  } finally {
    globalThis.fetch = real
  }
}

// ── each job settles on its own poll ─────────────────────────────────────────
//
// The other half of "1 row each": the timer covers every job in flight, not only the
// newest, so the first job can finish while the second still runs. `jobStates: ['done',
// 'queued']` is the script — the first poll answers `done`, every later one `queued` — so a
// timer that only read the newest job would leave the first one queued forever.
{
  const props = {
    t,
    useTabInfo: () => ({ tab: { navigation: { params: { unit: MODEL_UNIT.name, provider: 'krea' }, revision: 1 } } }),
  }
  const stub = stubHost({ units: [], kreaUnits: [MODEL_UNIT], file: MODEL, jobStates: ['done', 'queued'] })
  const real = globalThis.fetch
  globalThis.fetch = stub.fetch
  try {
    let typed = await settle(paneSlot.component, props, 'pane-queue-settle')
    const door = nodesOf(typed).find((node) => node.props && node.props['data-generate-door'] === 'prompt')
    if (door) door.props.onChange({ target: { value: 'a cinematic glass cabin' } })
    typed = await settle(paneSlot.component, props, 'pane-queue-settle')
    const control = byAttr(typed, 'data-generate-run', MODEL_UNIT.name)
    if (control) {
      control.props.onClick()
      control.props.onClick()
    }
    typed = await settle(paneSlot.component, props, 'pane-queue-settle')
    check(
      'the first job settles while the second is still in flight: the second keeps its row',
      (() => {
        const rows = nodesOf(typed).filter((node) => node.props && node.props['data-generate-queue-row'])
        return (
          !!byAttr(typed, 'data-generate-queue-list', '1') &&
          rows.length === 1 &&
          rows[0].props['data-generate-queue-row'] === 'job-2'
        )
      })(),
      JSON.stringify(nodesOf(typed).filter((node) => node.props && node.props['data-generate-queue-row']).map((node) => node.props['data-generate-queue-row'])),
    )
  } finally {
    globalThis.fetch = real
  }
}

// ── RunningHub runs: the workflow surface lights up ──────────────────────────
//
// The slice that used to say "running comes next". A workflow file served with `runnable`
// (which the host sets from the PROVIDER registry, not from the file) draws the run control;
// with RunningHub's own run modes declared it draws the split button; and its image doors
// draw the pick control its upload capability now earns.
{
  const RH_RUNNER_FILE = {
    ...KREA_FILE,
    name: 'outfit-swap',
    title: 'Swap the outfit',
    blurb: 'Put the garment from one photo on the person in another.',
    runLabel: 'Swap the outfit',
    order: ['value', 'person', 'garment'],
    doors: {
      value: { nodeId: '63', fieldName: 'value', type: 'text', label: 'Prompt', primary: true, multiline: true },
      person: { nodeId: '10', fieldName: 'image', type: 'image', label: 'Person photo' },
      garment: { nodeId: '11', fieldName: 'image', type: 'image', label: 'Garment photo' },
    },
    runnable: true,
  }
  const RUN_OPTION = {
    key: 'instanceType',
    label: 'Instance',
    fallback: 'default',
    modes: [
      { id: 'default', label: 'Default', description: '24GB VRAM' },
      { id: 'plus', label: 'Plus', description: '48GB VRAM' },
      { id: 'ultra', label: 'Ultra', description: '84GB VRAM' },
    ],
  }
  const props = {
    t,
    useTabInfo: () => ({ tab: { navigation: { params: { unit: RH_RUNNER_FILE.name, provider: PROVIDER }, revision: 1 } } }),
  }
  const stub = stubHost({ units: [RH_RUNNER_FILE], file: RH_RUNNER_FILE, runOption: RUN_OPTION })
  // The provider row is what says this provider can upload; the pane passes that to the
  // surface, so the stub row has to carry it the way the host sends it.
  const inner = stub.fetch
  const stubWithUpload = {
    ...stub,
    fetch: async (url, init) => {
      if (url === PROVIDERS_API) {
        const answer = await inner(url, init)
        const body = await answer.json()
        return { ok: true, status: 200, json: async () => ({ providers: body.providers.map((row) => (row.id === PROVIDER ? { ...row, upload: true, runOption: RUN_OPTION } : row)) }) }
      }
      return inner(url, init)
    },
  }
  const real = globalThis.fetch
  globalThis.fetch = stubWithUpload.fetch
  try {
    let tree = await settle(paneSlot.component, props, 'pane-rh-run')
    check(
      'a RunningHub workflow now draws the run control, because its provider can run',
      !!byAttr(tree, 'data-generate-run', 'outfit-swap') && !byAttr(tree, 'data-generate-run-pending', 'yes'),
      JSON.stringify({ run: !!byAttr(tree, 'data-generate-run', 'outfit-swap'), pending: !!byAttr(tree, 'data-generate-run-pending', 'yes') }),
    )
    check(
      'it draws two buttons, not a split one: the action filled, the choice outlined',
      (() => {
        const pair = byAttr(tree, 'data-generate-split', 'yes')
        const action = byAttr(tree, 'data-generate-run', RH_RUNNER_FILE.name)
        const toggle = byAttr(tree, 'data-generate-mode-toggle', 'yes')
        if (!pair || !action || !toggle) return false
        // Both are the harness `Button` (the stub keeps its `variant`), so the pair is the app's
        // own two button families rather than half-rounded halves of one control.
        const variantOf = (node) => {
          const button = byAttr(node, 'data-stub', 'button')
          return button ? button.props.variant : 'no button'
        }
        const kids = nodesOf(pair)
        return (
          variantOf(action) === 'primary' &&
          variantOf(toggle) === 'outline' &&
          // Two buttons with the ordinary gap, not one control split in half: no shared border,
          // no half-rounded corners.
          pair.props.style.gap === 8 &&
          kids.indexOf(action) !== -1 &&
          kids.indexOf(action) < kids.indexOf(toggle) &&
          textIn(action).trim() === RH_RUNNER_FILE.runLabel
        )
      })(),
      JSON.stringify({
        action: byAttr(tree, 'data-generate-run', RH_RUNNER_FILE.name) ? byAttr(byAttr(tree, 'data-generate-run', RH_RUNNER_FILE.name), 'data-stub', 'button').props.variant : 'none',
        toggle: byAttr(tree, 'data-generate-mode-toggle', 'yes') ? byAttr(byAttr(tree, 'data-generate-mode-toggle', 'yes'), 'data-stub', 'button').props.variant : 'none',
      }),
    )
    check(
      "its image doors draw the pick control the provider's upload earns",
      !!byAttr(tree, 'data-generate-upload', 'person') && !!byAttr(tree, 'data-generate-upload', 'garment'),
      JSON.stringify({ person: !!byAttr(tree, 'data-generate-upload', 'person'), garment: !!byAttr(tree, 'data-generate-upload', 'garment') }),
    )
    // TWO REFERENCE IMAGES ON ONE ROW (founder, 2026-09-24: *"2 ref images on same row"*). This
    // is the outfit-swap shape: the person and the garment are what a person compares, so the
    // two consecutive image doors share a row rather than stacking down the card.
    check(
      'two reference images sit on one row, in the order the adapter lists them',
      !!byAttr(tree, 'data-generate-image-group', 'person+garment'),
      JSON.stringify(nodesOf(tree).filter((node) => node.props && node.props['data-generate-image-group']).map((node) => node.props['data-generate-image-group'])),
    )
    // THE DROP ORDER IS THE ONLY ORDER THERE IS (founder, 2026-09-25: *"its drops in order not by
    // left/right position. we can disable image 2 and message user to drop image 1 first"*). The
    // composer's tray takes every dropped file at `document`, in the order the drops happened, so
    // an empty second image door waits for the first: no drop target, no picker, and a sentence
    // that names the door to fill. Everything here is about the EMPTY state.
    check(
      'an empty second image door waits for the first, and names the door to fill',
      (() => {
        const wait = byAttr(tree, 'data-generate-drop-wait', 'garment')
        return (
          !!wait &&
          !byAttr(tree, 'data-generate-drop-wait', 'person') &&
          !!byAttr(tree, 'data-generate-drop', 'yes') &&
          textIn(wait).includes(EN['surface.image.waitFor'].replace('{label}', 'Person photo'))
        )
      })(),
      JSON.stringify(nodesOf(tree).filter((node) => node.props && node.props['data-generate-drop-wait']).map((node) => ({ door: node.props['data-generate-drop-wait'], text: textIn(node) }))),
    )
    check(
      'its picker is closed too, not only its drop area',
      (() => {
        const waiting = byAttr(tree, 'data-generate-upload', 'garment')
        const first = byAttr(tree, 'data-generate-upload', 'person')
        return !!waiting && waiting.props.disabled === true && !!first && first.props.disabled !== true
      })(),
      JSON.stringify({
        garment: String((byAttr(tree, 'data-generate-upload', 'garment') || { props: {} }).props.disabled),
        person: String((byAttr(tree, 'data-generate-upload', 'person') || { props: {} }).props.disabled),
      }),
    )
    // Fill the first image the way a person does, and the second door opens again.
    {
      const first = byAttr(tree, 'data-generate-upload', 'person')
      if (first) first.props.onChange({ target: { files: [{ name: 'person.png', type: 'image/png' }], value: '/tmp/person.png' } })
      tree = await settle(paneSlot.component, props, 'pane-rh-run')
      check(
        'once the first image is in, the second door is an ordinary drop area',
        !byAttr(tree, 'data-generate-drop-wait', 'garment') &&
          !!byAttr(tree, 'data-generate-thumb', 'person') &&
          !(byAttr(tree, 'data-generate-upload', 'garment') || { props: {} }).props.disabled,
        JSON.stringify({
          wait: !!byAttr(tree, 'data-generate-drop-wait', 'garment'),
          thumb: !!byAttr(tree, 'data-generate-thumb', 'person'),
        }),
      )
    }
    // A HANDLE WITH NO PICKED BYTES. A surface that remounts while its door already holds one has
    // no blob to draw, and RunningHub's `api/…` handle is not addressable — so the door says a
    // picture is set and draws the neutral mark. Never an `<img>` with a src no browser can open.
    // A HANDLE WITH NO PICKED BYTES, driven the way it now really happens: a strip row carries
    // RunningHub's opaque `api/…` fileName, and clicking it (regenerate, S4) puts that value on
    // the door. There is no blob behind it and no address a browser can open, so the door says a
    // picture is set and draws the NEUTRAL MARK — never an `<img>` with a src that cannot load.
    //
    // This used to be reached by reopening a workflow whose saved state held a handle. That
    // restore is superseded (a form opens clean at the authored defaults), and the strip's own
    // row is what replaces it — which is why this case reads the way it does now.
    {
      const rowStub = stubHost({
        units: [RH_RUNNER_FILE],
        file: RH_RUNNER_FILE,
        runOption: RUN_OPTION,
        resultRows: [
          {
            jobId: 'job-handle',
            at: '2026-09-26T03:00:00.000Z',
            settledAt: '2026-09-26T03:01:00.000Z',
            status: 'SUCCESS',
            state: 'done',
            values: { person: OPAQUE_HANDLE },
            files: [{ i: 0, where: 'present', type: 'png', bytes: 24, path: '/tmp/x.png', url: 'https://gen.example/out.png' }],
            error: null,
          },
        ],
      })
      const innerRow = rowStub.fetch
      globalThis.fetch = async (url, init) => {
        if (url === PROVIDERS_API) {
          const answer = await innerRow(url, init)
          const body = await answer.json()
          return { ok: true, status: 200, json: async () => ({ providers: body.providers.map((row) => (row.id === PROVIDER ? { ...row, upload: true, runOption: RUN_OPTION } : row)) }) }
        }
        return innerRow(url, init)
      }
      let rerun = await settle(paneSlot.component, props, 'pane-rh-handle')
      const row = byAttr(rerun, 'data-generate-strip-row', 'job-handle')
      if (row) row.props.onClick()
      rerun = await settle(paneSlot.component, props, 'pane-rh-handle')
      const saved = rerun
      check(
        'a handle with no picked bytes draws the neutral mark, never a broken image',
        !byAttr(saved, 'data-generate-thumb', 'person') &&
          !!byAttr(saved, 'data-generate-thumb-missing', 'person') &&
          !byAttr(saved, 'data-generate-door', 'person'),
        JSON.stringify({
          thumb: !!byAttr(saved, 'data-generate-thumb', 'person'),
          missing: !!byAttr(saved, 'data-generate-thumb-missing', 'person'),
          field: !!byAttr(saved, 'data-generate-door', 'person'),
        }),
      )
    }
    // THE GUARD LOOKS ONLY AT EMPTY DOORS, and this is the state it exists not to trap: a result
    // brings back a value for the SECOND image while the first is empty. The guard is about the
    // empty state, so a filled door keeps its picker and its clear control.
    {
      const rowStub = stubHost({
        units: [RH_RUNNER_FILE],
        file: RH_RUNNER_FILE,
        runOption: RUN_OPTION,
        resultRows: [
          {
            jobId: 'job-garment',
            at: '2026-09-26T03:00:00.000Z',
            settledAt: '2026-09-26T03:01:00.000Z',
            status: 'SUCCESS',
            state: 'done',
            values: { garment: OPAQUE_HANDLE },
            files: [{ i: 0, where: 'present', type: 'png', bytes: 24, path: '/tmp/y.png', url: 'https://gen.example/out.png' }],
            error: null,
          },
        ],
      })
      const innerRow = rowStub.fetch
      globalThis.fetch = async (url, init) => {
        if (url === PROVIDERS_API) {
          const answer = await innerRow(url, init)
          const body = await answer.json()
          return { ok: true, status: 200, json: async () => ({ providers: body.providers.map((row) => (row.id === PROVIDER ? { ...row, upload: true, runOption: RUN_OPTION } : row)) }) }
        }
        return innerRow(url, init)
      }
      let held = await settle(paneSlot.component, props, 'pane-rh-held')
      const row = byAttr(held, 'data-generate-strip-row', 'job-garment')
      if (row) row.props.onClick()
      held = await settle(paneSlot.component, props, 'pane-rh-held')
      check(
        'a door that already holds an image is never held back, even with the first one empty',
        !byAttr(held, 'data-generate-drop-wait', 'garment') &&
          !!byAttr(held, 'data-generate-image-clear', 'garment') &&
          !(byAttr(held, 'data-generate-upload', 'garment') || { props: {} }).props.disabled,
        JSON.stringify({
          wait: !!byAttr(held, 'data-generate-drop-wait', 'garment'),
          clear: !!byAttr(held, 'data-generate-image-clear', 'garment'),
        }),
      )
    }
  } finally {
    globalThis.fetch = real
  }
}

// ── the split run control: the action, and the mode it will run in ───────────
//
// Founder, 2026-09-23: *"RH has option to run as plus vs ultra we can use this shadcn split
// button"*. RunningHub's own OpenAPI is where the modes come from (`instanceType`: default
// 24GB, plus 48GB, ultra 84GB); this block exercises the declaration wherever a provider
// makes it, on the fixture provider whose adapters can actually run.
{
  const RUN_OPTION = {
    key: 'instanceType',
    label: 'Instance',
    fallback: 'default',
    modes: [
      { id: 'default', label: 'Default', description: '24GB VRAM' },
      { id: 'plus', label: 'Plus', description: '48GB VRAM' },
      { id: 'ultra', label: 'Ultra', description: '84GB VRAM' },
    ],
  }
  const props = {
    t,
    useTabInfo: () => ({ tab: { navigation: { params: { unit: MODEL_UNIT.name, provider: 'krea' }, revision: 1 } } }),
  }
  const stub = stubHost({ units: [], kreaUnits: [MODEL_UNIT], file: MODEL, runOption: RUN_OPTION })
  const real = globalThis.fetch
  globalThis.fetch = stub.fetch
  try {
    const tree = await settle(paneSlot.component, props, 'pane-split')
    const toggle = byAttr(tree, 'data-generate-mode-toggle', 'yes')
    check(
      'a provider that declares run modes gets the split control, not a plain button',
      !!byAttr(tree, 'data-generate-split', 'yes') && !!byAttr(tree, 'data-generate-run', MODEL_UNIT.name) && !!toggle,
      JSON.stringify({ split: !!byAttr(tree, 'data-generate-split', 'yes'), toggle: !!toggle }),
    )
    check(
      "the segment shows the provider's own fallback mode before anything is chosen",
      !!toggle && textIn(toggle).includes('Default') && byAttr(tree, 'data-generate-mode').props['data-generate-mode'] === 'default',
      toggle ? textIn(toggle) : 'no segment',
    )
    const opener = byAttr(tree, 'data-generate-mode-toggle', 'yes')
    if (opener) opener.props.onClick({ stopPropagation: () => {} })
    const opened = await settle(paneSlot.component, props, 'pane-split')
    const ultra = nodesOf(opened).find((node) => node.props && node.props['data-menu-item'] === 'ultra')
    check('the segment opens the list of modes', !!ultra, ultra ? 'the rows are there' : 'no rows')
    // THE PANE HAS MORE THAN ONE MENU NOW: the header's add button opens one too (founder,
    // 2026-09-25), and it comes first in the tree. A mode list is the one with rows, so the
    // checks below pick the menu by its rows rather than by being the first on the page.
    const menuWithRows = (tree) =>
      nodesOf(tree).find(
        (node) =>
          node.props &&
          node.props['data-stub'] === 'menu' &&
          nodesOf(node).some((child) => child.props && child.props['data-menu-item']),
      )
    check(
      'the modes come from the provider: each row names the mode and the machine it buys',
      (() => {
        const menu = menuWithRows(opened)
        if (!menu) return false
        const rows = nodesOf(menu).filter((node) => node.props && node.props['data-menu-item'])
        return rows.length === 3 && textIn(menu).includes('Ultra') && textIn(menu).includes('84GB VRAM') && textIn(menu).includes('48GB VRAM')
      })(),
      "the sizes are RunningHub's own words for the machines, not a price",
    )
    if (ultra) ultra.props.onClick()
    const chosen = await settle(paneSlot.component, props, 'pane-split')
    check(
      'choosing a mode says so on the segment, and closes the list',
      (() => {
        const segment = byAttr(chosen, 'data-generate-mode')
        // Every menu on the page must be shut, the header's add list and the mode list alike.
        const menus = nodesOf(chosen).filter((node) => node.props && node.props['data-stub'] === 'menu')
        return (
          !!segment &&
          segment.props['data-generate-mode'] === 'ultra' &&
          textIn(byAttr(chosen, 'data-generate-mode-toggle', 'yes')).includes('Ultra') &&
          menus.every((menu) => menu.props['data-menu-open'] === 'no')
        )
      })(),
      JSON.stringify(byAttr(chosen, 'data-generate-mode') ? byAttr(chosen, 'data-generate-mode').props['data-generate-mode'] : 'no segment'),
    )
    // Type first, then press: the run posts outright and carries the chosen mode.
    const prompt = byAttr(chosen, 'data-generate-door', 'prompt')
    if (prompt) prompt.props.onChange({ target: { value: 'a glass cabin' } })
    const filled = await settle(paneSlot.component, props, 'pane-split')
    const run = byAttr(filled, 'data-generate-run', MODEL_UNIT.name)
    if (run) run.props.onClick()
    await settle(paneSlot.component, props, 'pane-split')
    check(
      'one press runs, and the run carries the mode the segment showed',
      stub.runs.length === 1 &&
        stub.runs[0].confirmed === true &&
        !!stub.runs[0].options &&
        stub.runs[0].options.instanceType === 'ultra' &&
        stub.runs[0].values.prompt === 'a glass cabin',
      JSON.stringify(stub.runs),
    )
  } finally {
    globalThis.fetch = real
  }
}
// A run that fails says whose words it is: the provider's message verbatim, plus the run
// id — and the form stays on screen, which is the way back (no Run again button).
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
      'and there is no Run again button — the failure keeps the form, which is the way back',
      !byAttr(tree, 'data-generate-run-again', 'yes') && !!byAttr(tree, 'data-generate-run', MODEL_UNIT.name),
      'a failed run must not be a dead end, and the Run control is still under the doors',
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

    // THE SPARKLE AND ITS MENU (founder, 2026-09-25: *"make a sparkles menu, sparkles subject swap
    // is a prompt writing skill, we can have other skill like face swap, add object (add these
    // others but greyed for now) I just want to test UI"*). The glyph sits on the label line of a
    // door the presets fill and opens a menu of them; a greyed row is drawn and chooses nothing.
    {
      const sparkle = byAttr(tree, 'data-generate-preset', 'prompt')
      const promptField = () => byAttr(tree, 'data-generate-door', 'prompt')
      check(
        'a preset door wears the sparkle, and only a door the presets fill wears one',
        !!sparkle &&
          sparkle.props['aria-label'] === 'Prompt skills' &&
          sparkle.props['aria-haspopup'] === 'true' &&
          // Only the prompt door gets one: the image and list doors beside it have no preset.
          nodesOf(tree).filter((node) => node.props && node.props['data-generate-preset'] !== undefined).length === 1,
        JSON.stringify(nodesOf(tree).filter((node) => node.props && node.props['data-generate-preset'] !== undefined).map((node) => node.props['data-generate-preset'])),
      )
      // THE GLYPH SITS AT THE FAR END OF THE PROMPT'S TITLE ROW (founder, 2026-09-25: *"add
      // sparkles icon to the Prompt title row above prompt input box … Put it justify right"*):
      // the label is the row's first child, the glyph its last, and the row spaces them apart.
      check(
        'the prompt\'s title row carries the sparkle, justified to its right end',
        (() => {
          const row = byAttr(tree, 'data-generate-door-row', 'prompt')
          if (!row || !sparkle) return false
          const kids = (node) => (Array.isArray(node.children) ? node.children : node.children === undefined ? [] : [node.children])
          const line = kids(row)[0]
          if (!line) return false
          const lineKids = kids(line)
          const label = lineKids[0]
          const last = lineKids[lineKids.length - 1]
          return (
            line.props.style.justifyContent === 'space-between' &&
            !!label &&
            label.type === 'label' &&
            textIn(label).trim() === 'Prompt' &&
            // The glyph lives in the row's LAST child (the menu it anchors renders around it), so
            // the label is first, the control is last, and the row is what spaces them apart.
            !!last &&
            last !== label &&
            nodesOf(last).includes(sparkle)
          )
        })(),
        JSON.stringify({
          justify: (() => {
            const row = byAttr(tree, 'data-generate-door-row', 'prompt')
            if (!row) return 'no row'
            const kids = Array.isArray(row.children) ? row.children : [row.children]
            return kids[0] ? kids[0].props.style.justifyContent : 'no line'
          })(),
        }),
      )
      if (sparkle) sparkle.props.onClick()
      tree = await settle(paneSlot.component, props, 'pane-arrays')
      const menu = byAttr(tree, 'data-stub', 'menu')
      const rows = nodesOf(tree).filter((node) => node.props && node.props['data-generate-preset-row'] !== undefined)
      const stateOf = (label) => {
        const row = rows.find((node) => node.props['data-generate-preset-row'] === label)
        const mark = row ? nodesOf(row).find((node) => node.props && node.props['data-generate-preset-state'] !== undefined) : null
        return mark ? mark.props['data-generate-preset-state'] : 'missing'
      }
      check(
        'the sparkle opens a menu of the prompt skills, in the adapter\'s order',
        !!menu &&
          menu.props['data-menu-open'] === 'yes' &&
          rows.map((row) => row.props['data-generate-preset-row']).join(',') === 'Subject swap,Face swap,Add object' &&
          stateOf('Subject swap') === 'ready' &&
          stateOf('Face swap') === 'soon' &&
          stateOf('Add object') === 'soon',
        JSON.stringify(rows.map((row) => row.props['data-generate-preset-row'] + ':' + stateOf(row.props['data-generate-preset-row']))),
      )
      check(
        'the unwritten skills say so, and their rows are disabled',
        ['Face swap', 'Add object'].every((label) => {
          const row = byAttr(tree, 'data-menu-item', label)
          return !!row && row.props.disabled === true && row.props['data-menu-item-disabled'] === 'yes' && textIn(row).includes('Coming soon')
        }),
        JSON.stringify(['Face swap', 'Add object'].map((label) => {
          const row = byAttr(tree, 'data-menu-item', label)
          return row ? { disabled: row.props.disabled, text: textIn(row) } : 'no row'
        })),
      )
      // A GREYED ROW CHOOSES NOTHING, even if its press is driven by hand: the words stay empty
      // and the menu stays open, because nothing was chosen.
      const runsBefore = stub.runs.length
      const greyed = byAttr(tree, 'data-menu-item', 'Face swap')
      if (greyed) greyed.props.onClick()
      tree = await settle(paneSlot.component, props, 'pane-arrays')
      check(
        'pressing a greyed skill writes nothing, and leaves the menu open',
        String((promptField() || { props: {} }).props.value) === '' &&
          (byAttr(tree, 'data-stub', 'menu') || { props: {} }).props['data-menu-open'] === 'yes',
        JSON.stringify({ value: (promptField() || { props: {} }).props.value }),
      )
      // …and the client refuses it a second time, for a primitive that ever calls through: the
      // greyed id goes straight to the menu's own `onSelect`, which is what the real row would
      // invoke. Two walls, because "disabled" is a promise the primitive keeps and the surface
      // must not depend on.
      const menuNode = byAttr(tree, 'data-stub', 'menu')
      if (menuNode && typeof menuNode.props.onSelect === 'function') menuNode.props.onSelect('Face swap')
      tree = await settle(paneSlot.component, props, 'pane-arrays')
      check(
        'a greyed skill stays empty even when the menu hands its id straight back',
        String((promptField() || { props: {} }).props.value) === '',
        JSON.stringify((promptField() || { props: {} }).props.value),
      )
      // THE WRITTEN ONE FILLS, and runs nothing: no run, so nothing spends. The menu is reopened
      // first, because the direct call above closed it the way a choice would.
      const reopen = byAttr(tree, 'data-generate-preset', 'prompt')
      if (reopen) reopen.props.onClick()
      tree = await settle(paneSlot.component, props, 'pane-arrays')
      const chosen = byAttr(tree, 'data-menu-item', 'Subject swap')
      if (chosen) chosen.props.onClick()
      tree = await settle(paneSlot.component, props, 'pane-arrays')
      check(
        'choosing it writes the prompt, runs nothing, and closes the menu',
        String((promptField() || { props: {} }).props.value) === 'Swap the outfit from image 2 onto the person in image 1.' &&
          stub.runs.length === runsBefore &&
          (byAttr(tree, 'data-stub', 'menu') || { props: {} }).props['data-menu-open'] === 'no',
        JSON.stringify({
          value: (promptField() || { props: {} }).props.value,
          runs: stub.runs.length - runsBefore,
          menu: (byAttr(tree, 'data-stub', 'menu') || { props: {} }).props['data-menu-open'],
        }),
      )
      // The prompt stays ordinary text afterwards: the sparkle fills, it does not lock.
      const afterFill = promptField()
      if (afterFill) afterFill.props.onChange({ target: { value: 'a person in a red dress' } })
      tree = await settle(paneSlot.component, props, 'pane-arrays')
      check(
        'the filled words are the field\'s own: they can be edited like any others',
        String((promptField() || { props: {} }).props.value) === 'a person in a red dress',
        JSON.stringify((promptField() || { props: {} }).props.value),
      )
    }

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
    check(
      'a workflow with no aspect door gets a square canvas rather than a guessed shape',
      (() => {
        // This catalogue entry has no aspect field at all (its doors are the prompt, an
        // image and three lists), so the canvas falls back to the one shape that never
        // misrepresents a workflow.
        const frame = byAttr(tree, 'data-generate-preview-frame', ARRAYS_UNIT.name)
        return !!frame && frame.props['data-generate-preview-shape'] === '1:1' && frame.props.style.aspectRatio === '1 / 1'
      })(),
      JSON.stringify(byAttr(tree, 'data-generate-preview-frame', ARRAYS_UNIT.name) ? byAttr(tree, 'data-generate-preview-frame', ARRAYS_UNIT.name).props['data-generate-preview-shape'] : 'no canvas'),
    )
    // Type first, then press: what the form held — the row included — is what the run
    // posts, and the press posts it outright (no dialog between the form and the run).
    const promptDoor = nodesOf(tree).find((node) => node.props && node.props['data-generate-door'] === 'prompt')
    if (promptDoor) promptDoor.props.onChange({ target: { value: 'a glass cabin' } })
    tree = await settle(paneSlot.component, props, 'pane-arrays')
    const pressed = byAttr(tree, 'data-generate-run', ARRAYS_UNIT.name)
    if (pressed) pressed.props.onClick()
    await settle(paneSlot.component, props, 'pane-arrays')
    check(
      'the run posts the row itself: the array the form held is the array that went',
      stub.runs.length === 1 &&
        !!stub.runs[0].values.styles &&
        !!stub.runs[0].values.styles[0] &&
        stub.runs[0].values.styles[0].id === 'lora-7',
      JSON.stringify(stub.runs.map((entry) => entry.values && entry.values.styles)),
    )
    // After the run the form is still there — a result does not cover the doors.
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
      'an empty image door is one drop area and nothing else, and carries no value yet',
      !!upload &&
        !!byAttr(tree, 'data-generate-drop', 'yes') &&
        // The URL route is GONE (founder, 2026-09-25: *"i can't get url to work. maybe we don't
        // need on local, user can download and upload is better"*): no second control, no field.
        !byAttr(tree, 'data-generate-url-open', 'image_url') &&
        !byAttr(tree, 'data-generate-door', 'image_url'),
      JSON.stringify({
        upload: !!upload,
        drop: !!byAttr(tree, 'data-generate-drop', 'yes'),
        urlButton: !!byAttr(tree, 'data-generate-url-open', 'image_url'),
        field: !!byAttr(tree, 'data-generate-door', 'image_url'),
      }),
    )
    const blobsBefore = blobUrls.length
    if (upload) upload.props.onChange({ target: { files: [{ name: 'photo.png', type: 'image/png' }], value: 'C:\\fakepath\\photo.png' } })
    tree = await settle(paneSlot.component, props, 'pane-arrays')
    check(
      'the picked file is uploaded through the host',
      stub.assets.length === 1 && stub.assets[0].url === PROVIDERS_API + '/krea/asset' && stub.assets[0].name === 'photo.png',
      JSON.stringify(stub.assets),
    )
    // THE FIX OF 2026-09-24. Once a picture is set the door draws the picture, not the value
    // it carries: RunningHub's upload answers an opaque `api/…` fileName, and printing that in
    // an editable field was the founder's complaint (*"why is api/editable?"*).
    check(
      'a filled image door draws the thumbnail and takes the raw value off the screen',
      !!byAttr(tree, 'data-generate-thumb', 'image_url') &&
        !byAttr(tree, 'data-generate-door', 'image_url') &&
        !!byAttr(tree, 'data-generate-image-clear', 'image_url'),
      JSON.stringify({
        thumb: !!byAttr(tree, 'data-generate-thumb', 'image_url'),
        field: !!byAttr(tree, 'data-generate-door', 'image_url'),
        clear: !!byAttr(tree, 'data-generate-image-clear', 'image_url'),
      }),
    )
    // The thumbnail is the file in hand, made into a blob URL — never the provider's answer,
    // which for RunningHub is a node input a browser cannot open (the founder's *"I don't see
    // thumbnails"*, caused by drawing that handle as `src`).
    check(
      'the thumbnail previews the picked bytes as a blob, not the provider handle',
      blobUrls.length === blobsBefore + 1 &&
        String((byAttr(tree, 'data-generate-thumb', 'image_url') || { props: {} }).props.src || '').startsWith('blob:generate/') &&
        (blobUrls.at(-1).file || {}).name === 'photo.png',
      JSON.stringify({ made: blobUrls.length - blobsBefore, src: (byAttr(tree, 'data-generate-thumb', 'image_url') || { props: {} }).props.src }),
    )
    // A BIG PICTURE, IN THE PICTURE'S OWN SHAPE, WITH ITS CONTROLS UNDERNEATH (founder,
    // 2026-09-24: *"make the thumbnails bigger and match the aspect of ref image, the replace
    // and remove buttons should be below"*). The frame is the door's own block, so the shape is
    // a number on the frame rather than a size on the `<img>`.
    const frame = byAttr(tree, 'data-generate-thumb-frame', 'image_url')
    check(
      'the thumbnail is a big frame, not a 56px square',
      !!frame && frame.props.style.maxWidth === 240 && frame.props.style.width === '100%',
      JSON.stringify(frame ? { maxWidth: frame.props.style.maxWidth, width: frame.props.style.width } : 'no frame'),
    )
    // Before the bytes have loaded there is no honest ratio, so the frame waits square.
    check(
      'the frame waits square until the picture loads',
      !!frame && frame.props.style.aspectRatio === '1 / 1',
      JSON.stringify(frame ? frame.props.style.aspectRatio : 'no frame'),
    )
    // The image reports its own dimensions; a portrait must read as a portrait.
    const thumbImg = byAttr(tree, 'data-generate-thumb', 'image_url')
    check(
      'the picture reports its own dimensions to the frame',
      !!thumbImg && typeof thumbImg.props.onLoad === 'function',
      JSON.stringify({ onLoad: typeof (thumbImg || { props: {} }).props.onLoad }),
    )
    if (thumbImg && thumbImg.props.onLoad) thumbImg.props.onLoad({ target: { naturalWidth: 900, naturalHeight: 1200 } })
    tree = await settle(paneSlot.component, props, 'pane-arrays')
    check(
      "a portrait reference reads as a portrait: the frame wears the image's own ratio",
      String((byAttr(tree, 'data-generate-thumb-frame', 'image_url') || { props: { style: {} } }).props.style.aspectRatio) === String(900 / 1200),
      JSON.stringify((byAttr(tree, 'data-generate-thumb-frame', 'image_url') || { props: { style: {} } }).props.style.aspectRatio),
    )
    // THE BADGE, INSIDE THE PICTURE (founder, 2026-09-25: *"to clear the upload use a badge close
    // icon in the top right corner"*). The row of actions under the picture is gone: the control
    // lives in the frame's own top-right corner and the frame is what positions it.
    {
      const door = byAttr(tree, 'data-generate-image', 'image_url')
      const kids = door ? (Array.isArray(door.children) ? door.children : [door.children]) : []
      const has = (node, attr) => nodesOf(node).some((child) => child.props && child.props[attr] !== undefined)
      const frameAt = kids.findIndex((kid) => has(kid, 'data-generate-thumb-frame'))
      const doorStyle = (door || { props: { style: {} } }).props.style
      const frameNode = byAttr(tree, 'data-generate-thumb-frame', 'image_url')
      const badge = byAttr(tree, 'data-generate-image-clear', 'image_url')
      const badgeStyle = (badge || { props: { style: {} } }).props.style
      check(
        'the clear badge sits in the picture frame, at its top-right corner',
        doorStyle.flexDirection === 'column' &&
          frameAt !== -1 &&
          has(kids[frameAt], 'data-generate-image-clear') &&
          !!frameNode &&
          frameNode.props.style.position === 'relative' &&
          badgeStyle.position === 'absolute' &&
          badgeStyle.top === 6 &&
          badgeStyle.right === 6,
        JSON.stringify({
          flexDirection: doorStyle.flexDirection,
          frameAt,
          inFrame: frameAt === -1 ? false : has(kids[frameAt], 'data-generate-image-clear'),
          framePosition: (frameNode || { props: { style: {} } }).props.style.position,
          badge: { position: badgeStyle.position, top: badgeStyle.top, right: badgeStyle.right },
        }),
      )
    }
    // REMOVE puts the control back the way it started, and lets the blob go.
    const clear = byAttr(tree, 'data-generate-image-clear', 'image_url')
    if (clear) clear.props.onClick()
    tree = await settle(paneSlot.component, props, 'pane-arrays')
    check(
      'removing the picture restores the empty door, drops the blob and clears the value',
      !byAttr(tree, 'data-generate-thumb', 'image_url') &&
        !!byAttr(tree, 'data-generate-drop', 'yes') &&
        // …and the drop area is the whole way back in, with no second control beside it.
        !byAttr(tree, 'data-generate-url-open', 'image_url') &&
        !byAttr(tree, 'data-generate-door', 'image_url') &&
        revokedBlobUrls.includes(blobUrls.at(-1).url),
      JSON.stringify({
        thumb: !!byAttr(tree, 'data-generate-thumb', 'image_url'),
        drop: !!byAttr(tree, 'data-generate-drop', 'yes'),
        revoked: revokedBlobUrls,
      }),
    )
    // AN EMPTY DOOR IS ONE DASHED AREA AND NOTHING ELSE (founder, 2026-09-25: the tiles went
    // first — *"we don't need finder button since click on the drop area does same thing"* — and
    // the URL button went the same day: *"i can't get url to work. maybe we don't need on local,
    // user can download and upload is better"*).
    {
      const door = byAttr(tree, 'data-generate-image', 'image_url')
      const drop = byAttr(tree, 'data-generate-drop', 'yes')
      const dropStyle = (drop || { props: { style: {} } }).props.style
      check(
        'an empty image door is one dashed drop area with no second control in it',
        !!door &&
          door.props.style.flexDirection === 'column' &&
          !!drop &&
          /dashed/.test(String(dropStyle.border)) &&
          // The only button the area holds is its own label's, and the picker is that label.
          (drop ? nodesOf(drop).filter((node) => node.props && node.props.type === 'button').length === 0 : false) &&
          !!byAttr(tree, 'data-generate-upload', 'image_url'),
        JSON.stringify({ drop: !!drop, border: dropStyle.border }),
      )
      check(
        'and the drop area is a drop zone: it takes the drag events and says so',
        !!drop &&
          drop.props['data-generate-drop'] === 'yes' &&
          typeof drop.props.onDrop === 'function' &&
          typeof drop.props.onDragOver === 'function' &&
          typeof drop.props.onDragLeave === 'function',
        JSON.stringify({ drop: (drop || { props: {} }).props['data-generate-drop'], onDrop: typeof (drop || { props: {} }).props.onDrop }),
      )
      // A FILE OVER THE AREA LIGHTS IT, and says what letting go does.
      if (drop && drop.props.onDragOver) drop.props.onDragOver({ preventDefault: () => {} })
      tree = await settle(paneSlot.component, props, 'pane-arrays')
      const over = byAttr(tree, 'data-generate-drop', 'yes')
      const overStyle = (over || { props: { style: {} } }).props.style
      check(
        'a file over the area lights the border and changes the sentence',
        !!over &&
          over.props['data-generate-drag-over'] === 'yes' &&
          overStyle.borderColor === 'var(--dsw-alias-brand-primary)' &&
          textIn(over).includes('Drop the image'),
        JSON.stringify({ over: (over || { props: {} }).props['data-generate-drag-over'], border: overStyle.borderColor }),
      )
      // THE DROP ITSELF: the browser's own event, the same route as the picker.
      const blobsBeforeDrop = blobUrls.length
      const assetsBeforeDrop = stub.assets.length
      if (over && over.props.onDrop) over.props.onDrop({ preventDefault: () => {}, dataTransfer: { files: [{ name: 'dropped.png', type: 'image/png' }] } })
      tree = await settle(paneSlot.component, props, 'pane-arrays')
      check(
        'a dropped file uploads through the host and previews, exactly as a picked one does',
        stub.assets.length === assetsBeforeDrop + 1 &&
          stub.assets.at(-1).name === 'dropped.png' &&
          blobUrls.length === blobsBeforeDrop + 1 &&
          !!byAttr(tree, 'data-generate-thumb', 'image_url'),
        JSON.stringify({ assets: stub.assets.map((row) => row.name), made: blobUrls.length - blobsBeforeDrop, thumb: !!byAttr(tree, 'data-generate-thumb', 'image_url') }),
      )
      // Back to empty for the checks that follow.
      const clearAgain = byAttr(tree, 'data-generate-image-clear', 'image_url')
      if (clearAgain) clearAgain.props.onClick()
      tree = await settle(paneSlot.component, props, 'pane-arrays')
    }
    // AN OPAQUE HANDLE IS NOT A PICTURE — the founder's own bug, in his words: *"I don't see
    // thumbnails"*. RunningHub's upload answers `api/7a8b80db…`, a node input the browser cannot
    // open; drawing that as `src` is what put a broken image where the preview belongs. With the
    // asset route answering exactly that handle, the door must still preview the picked bytes —
    // a blob — and the handle must reach neither an image nor the screen.
    const opaquePick = byAttr(tree, 'data-generate-upload', 'image_url')
    stub.assetUrl = OPAQUE_HANDLE
    const blobsBeforeOpaque = blobUrls.length
    if (opaquePick) opaquePick.props.onChange({ target: { files: [{ name: 'handle.png', type: 'image/png' }], value: 'C:\\fakepath\\handle.png' } })
    tree = await settle(paneSlot.component, props, 'pane-arrays')
    const opaqueThumb = byAttr(tree, 'data-generate-thumb', 'image_url')
    const opaqueSrc = String((opaqueThumb || { props: {} }).props.src || '')
    check(
      'an opaque provider handle is never drawn as an image: the door previews the picked bytes instead',
      blobUrls.length === blobsBeforeOpaque + 1 &&
        !!opaqueThumb &&
        opaqueSrc.startsWith('blob:generate/') &&
        !opaqueSrc.includes(OPAQUE_HANDLE) &&
        !byAttr(tree, 'data-generate-door', 'image_url'),
      JSON.stringify({ src: opaqueSrc, thumb: !!opaqueThumb, field: !!byAttr(tree, 'data-generate-door', 'image_url') }),
    )
    stub.assetUrl = UPLOADED_URL
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
  'tabs.add',
  // The word on the add control itself (founder, 2026-09-25: *"lets change + to +add to keep
  // disinction"*): a key missing here would put a raw id on the button.
  'tabs.addLabel',
  'tabs.close',
  'surface.loading',
  'surface.failed',
  'surface.advanced',
  'surface.advanced.hide',
  'surface.pending',
  'card.community',
  'surface.image.placeholder',
  'surface.image.uploading',
  'surface.image.failed',
  // The image door's drop sentence and its one failure line, plus the sparkle menu's own words
  // (founder, 2026-09-25: *"make a sparkles menu … prompt writing skill"*).
  'surface.image.badUrl',
  'surface.image.drop',
  // The sentence a waiting image door carries (founder, 2026-09-25: *"we can disable image 2 and
  // message user to drop image 1 first"*). It names another door, so a missing key would put a
  // raw id where the door to fill belongs.
  'surface.image.waitFor',
  'run.cancel',
  'run.canceling',
  'preset.open',
  'preset.soon',
  'surface.list.add',
  'surface.list.remove',
  // The dashboard and its add control (founder, 2026-09-25). `pane.section.empty` is the
  // block's own sentence and `pane.add.button` is the facts-line glyph's tooltip and
  // accessible name — so a missing key would put a raw id on the pane's most-used control.
  // `pane.section.family` / `.count` / `.none` were the count line's; they left both
  // dictionaries when the founder removed that line (*"remove workflows 3 installed"*).
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
  ui: {
    runLabel: 'Run it',
    order: ['a', 'b'],
    // One usable preset, one with no label, and one a person cannot press yet: the surface needs
    // the label (it is the glyph's accessible name), so the projection keeps the first and the
    // greyed one — and drops the one with nothing to call it.
    presets: [
      { label: 'Fill A', doors: { a: 'hello' } },
      { labels: 'no' },
      { label: 'Not written', doors: { b: '' }, disabled: true },
    ],
  },
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
        // The one-press fills ride the same flattened shape, a preset with no label is dropped
        // (a glyph with no name), and a greyed one travels with its own flag.
        adapter.presets.length === 2 &&
        adapter.presets[0].label === 'Fill A' &&
        adapter.presets[0].doors.a === 'hello' &&
        adapter.presets[0].disabled === undefined &&
        adapter.presets[1].label === 'Not written' &&
        adapter.presets[1].disabled === true &&
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

// ── S3/S4: the strip, and regenerate ────────────────────────────────────────
//
// THE STRIP UNDER THE CANVAS IS THE SESSION (epic 64 §6), in the founder's own words:
// *"in the RH sense it's clicking on 'regenerate' and continuing where previously left off …
// in RH the filmstrip below the main preview keeps it contained as a 'session'."* So: one row
// per run, newest first, the row whose picture is on the canvas marked; a file that has gone
// KEEPS its row and says Missing, because a gap in a series is information; and CLICKING a row
// brings that run's values back into the form — which is regenerate — while nothing runs and
// the gate is not bypassed, because the press that spends is still the person's own.
{
  const props = {
    t,
    useTabInfo: () => ({ tab: { navigation: { params: { unit: MODEL_UNIT.name, provider: 'krea' }, revision: 1 } } }),
  }
  const rows = [
    {
      jobId: 'job-new',
      at: '2026-09-26T02:00:00.000Z',
      settledAt: '2026-09-26T02:01:00.000Z',
      status: 'SUCCESS',
      state: 'done',
      values: { prompt: 'the woman in image 1 wears the outfit from image 2', aspect_ratio: '16:9' },
      files: [{ i: 0, where: 'present', type: 'png', bytes: 24, path: '/tmp/generate/library/krea/' + MODEL_UNIT.name + '/20260926-job-new.png', url: 'https://gen.krea.ai/out.png' }],
      error: null,
    },
    {
      jobId: 'job-old',
      at: '2026-09-26T01:00:00.000Z',
      settledAt: '2026-09-26T01:01:00.000Z',
      status: 'SUCCESS',
      state: 'done',
      values: { prompt: 'an older prompt' },
      files: [{ i: 0, where: 'missing', type: 'png', bytes: 24, path: '/tmp/gone/20260926-job-old.png', url: null }],
      error: null,
    },
  ]

  const stub = stubHost({ units: [], kreaUnits: [MODEL_UNIT], file: MODEL, jobStates: ['done'], resultRows: rows })
  const real = globalThis.fetch
  globalThis.fetch = stub.fetch
  try {
    const tree = await settle(paneSlot.component, props, 'pane-run-strip')
    const strip = byAttr(tree, 'data-generate-strip', 'yes')
    check('the session strip is drawn, with a row per run', !!strip, strip ? 'yes' : 'no strip')
    const newest = byAttr(tree, 'data-generate-strip-row', 'job-new')
    const oldest = byAttr(tree, 'data-generate-strip-row', 'job-old')
    check(
      'both runs are in it, newest first',
      !!newest && !!oldest && nodesOf(strip).indexOf(newest) < nodesOf(strip).indexOf(oldest),
      JSON.stringify([!!newest, !!oldest]),
    )
    check(
      'a row with its file here draws a thumbnail from the bytes route',
      !!newest && nodesOf(newest).some((node) => node.type === 'img' && String(node.props.src).includes('/result?job=job-new')),
      newest ? nodesOf(newest).filter((node) => node.type === 'img').map((node) => node.props.src).join(',') : 'no row',
    )
    check(
      'a row whose file has gone KEEPS its place and says Missing',
      !!oldest && oldest.props['data-generate-strip-state'] === 'missing' && textIn(oldest).includes(EN['strip.missing']),
      oldest ? oldest.props['data-generate-strip-state'] + ' ' + textIn(oldest) : 'no row',
    )
    check(
      'and it is not drawn as a broken image',
      !!oldest && !nodesOf(oldest).some((node) => node.type === 'img'),
      'the gone row carries no <img>',
    )

    // ── S4: regenerate ────────────────────────────────────────────────────
    const callsBefore = stub.calls.length
    const runsBefore = stub.runs.length
    if (newest) newest.props.onClick()
    const after = await settle(paneSlot.component, props, 'pane-run-strip')
    const promptDoor = byAttr(after, 'data-generate-door', 'prompt')
    check(
      "clicking a row brings that run's values back into the form",
      !!promptDoor && promptDoor.props.value === 'the woman in image 1 wears the outfit from image 2',
      promptDoor ? String(promptDoor.props.value).slice(0, 60) : 'no prompt door',
    )
    const aspectDoor = byAttr(after, 'data-generate-door', 'aspect_ratio')
    check(
      'every value the record carried comes back, not just the first',
      !!aspectDoor && aspectDoor.props.value === '16:9',
      aspectDoor ? String(aspectDoor.props.value) : 'no aspect door',
    )
    check(
      'NOTHING RUNS: no run was started by clicking a row',
      stub.runs.length === runsBefore,
      runsBefore + ' -> ' + stub.runs.length,
    )
    check(
      'and no request at all was posted, so no gate could have been bypassed',
      !stub.calls.slice(callsBefore).some((call) => (call.method || 'GET').toUpperCase() === 'POST'),
      JSON.stringify(stub.calls.slice(callsBefore).map((call) => ({ url: call.url, method: call.method }))),
    )
    const selectedCanvas = byAttr(after, 'data-generate-canvas', 'selected')
    check(
      "the canvas shows the selected row's own picture",
      !!selectedCanvas && String(selectedCanvas.props.src).includes('/result?job=job-new'),
      selectedCanvas ? String(selectedCanvas.props.src) : 'no canvas',
    )

    // The gone row on the canvas: a sentence, not a frame that failed to load.
    const oldestAgain = byAttr(after, 'data-generate-strip-row', 'job-old')
    if (oldestAgain) oldestAgain.props.onClick()
    const gone = await settle(paneSlot.component, props, 'pane-run-strip')
    check(
      'selecting a gone result puts the word on the canvas instead of a broken frame',
      !!byAttr(gone, 'data-generate-canvas-gone', 'missing') && !byAttr(gone, 'data-generate-canvas', 'selected'),
      byAttr(gone, 'data-generate-canvas-gone', 'missing') ? 'says Missing' : 'no word',
    )

    // Clicking the SELECTED row again lets it go: the canvas stops showing that run's picture.
    const oldestTwice = byAttr(gone, 'data-generate-strip-row', 'job-old')
    if (oldestTwice) oldestTwice.props.onClick()
    const back = await settle(paneSlot.component, props, 'pane-run-strip')
    check(
      'and clicking the selected row again lets it go',
      !byAttr(back, 'data-generate-canvas', 'selected') && !byAttr(back, 'data-generate-canvas-gone'),
      byAttr(back, 'data-generate-canvas', 'selected') ? 'still selected' : 'cleared',
    )
  } finally {
    globalThis.fetch = real
  }
}

// A workflow with no history: the strip is there, empty, and says so rather than vanishing —
// the preview card must not change height the moment the first run finishes.
{
  const props = {
    t,
    useTabInfo: () => ({ tab: { navigation: { params: { unit: MODEL_UNIT.name, provider: 'krea' }, revision: 1 } } }),
  }
  const stub = stubHost({ units: [], kreaUnits: [MODEL_UNIT], file: MODEL, jobStates: ['done'], resultRows: [] })
  const real = globalThis.fetch
  globalThis.fetch = stub.fetch
  try {
    const tree = await settle(paneSlot.component, props, 'pane-run-empty-strip')
    check(
      'a session with no results says so, in place',
      !!byAttr(tree, 'data-generate-strip-none', 'yes') && textIn(byAttr(tree, 'data-generate-strip-none', 'yes')) === EN['strip.none'],
      byAttr(tree, 'data-generate-strip-none', 'yes') ? textIn(byAttr(tree, 'data-generate-strip-none', 'yes')) : 'nothing drawn',
    )
  } finally {
    globalThis.fetch = real
  }
}

finish()
