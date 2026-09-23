/**
 * verify:start — Epic 61 S4's first half, asserted rather than intended.
 *
 *   "Installing the plugin adds one card to the harness's own start page, beside
 *    'Workspace files', 'New terminal' and 'Browser' … a categorized flyout that
 *    dispatches … it degrades to one entry, and that is a supported install …
 *    selecting a leaf opens that unit's UI" — §10.
 *
 * WHAT THIS PROVES, AND WHAT IT DOES NOT. `lib/client.js` is loaded in the same
 * stubbed loader verify/mount.mjs and verify/save-confirmation.mjs use, `apply(ctx)`
 * runs against a recording ctx, and the card renderer is then rendered against a
 * stubbed `/plugins/generate/adapters` — so the claim here is source-level: the
 * registration exists under our id, and the card draws the shape §10 describes for
 * each install (none, one, several, grouped, community, unreachable host). It does
 * NOT prove the bytes are on the running page: a `link:`-installed client bundle is
 * served from the copy captured at activation, so this reaches the page on the next
 * app start, and `verify/mount.mjs`'s live layer is the one that reads the real DOM.
 *
 * THE HOST HALF IS DRIVEN TOO. `listAdapters` is exercised over a temp directory,
 * because "an entry appears only after rh_adapter_validate passes" (§10) is a rule
 * about what gets listed, and a rule that is only intended is the defect class this
 * plugin's verifies exist to catch. The real profile directory is listed as well
 * when it exists, so the file the install flow wrote is read back once.
 *
 * Nothing here spends coins, calls RunningHub, or writes an adapter.
 *
 *   node verify/start.mjs
 *   node verify/start.mjs --show   # print each case's card title and flyout rows
 */
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

import { ADAPTER_SCHEMA, listAdapters } from '../lib/adapter.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')
const PKG_NAME = '@muen/dsh-runninghub'
const GENERATE_ID = '@muen/dsh-runninghub'
const ADAPTERS_API = '/plugins/generate/adapters'
const argv = process.argv.slice(2)
const SHOW = argv.includes('--show')

// ── the reporter (the same shape as this plugin's other four) ────────────────

const rows = []
const check = (label, ok, detail) => rows.push({ label, status: ok ? 'pass' : 'fail', detail: detail == null ? '' : String(detail) })
const note = (text) => rows.push({ label: text, status: 'note', detail: '' })
const skip = (label, why) => rows.push({ label, status: 'skip', detail: why })

function finish() {
  let failed = 0
  process.stdout.write('\nverify:start — Epic 61 S4 (the card on the start page)\n')
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
// The card is a component, not a string, so a text search would prove nothing. The
// shim models the two things the card depends on: state that survives a re-render
// (the flyout's open flag) and an effect that runs after the first frame (the list
// read). Instance identity is the element's path in the tree, the same positional
// reconciliation React does with unkeyed children.

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
  useEffect: (fn) => {
    const instance = current
    const index = instance.cursor++
    if (index in instance.hooks) return
    instance.hooks[index] = [true]
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

/**
 * The harness's own primitives, stood in for.
 *
 * `Menu` keeps its `items` and its `onSelect` on the node rather than inventing a
 * DOM for them: the claim under test is which rows the card offers and what
 * selecting one does, and both are props. `Button` renders a real button so the
 * card's two clicks can be told apart and fired.
 */
const PRIMITIVES = {
  IconSparkle16: (props) => REACT.createElement('svg', { 'data-stub': 'sparkle', ...props }),
  IconWarningOutline16: (props) => REACT.createElement('svg', { 'data-stub': 'warning', ...props }),
  IconRightUpOutline16: (props) => REACT.createElement('svg', { 'data-stub': 'right-up', ...props }),
  IconRefreshOutline16: (props) => REACT.createElement('svg', { 'data-stub': 'refresh', ...props }),
  IconCheckOutline16: (props) => REACT.createElement('svg', { 'data-stub': 'check', ...props }),
  IconInfoOutline14: (props) => REACT.createElement('svg', { 'data-stub': 'info', ...props }),
  IconChevronDownOutline14: (props) => REACT.createElement('svg', { 'data-stub': 'chevron', ...props }),
  Button: (props) =>
    REACT.createElement(
      'button',
      {
        type: 'button',
        'data-stub': 'button',
        variant: props.variant,
        style: props.style,
        'aria-label': props['aria-label'],
        'aria-expanded': props['aria-expanded'],
        onClick: props.onClick,
      },
      props.children,
    ),
  Menu: (props) =>
    REACT.createElement(
      'div',
      { 'data-stub': 'menu', menuItems: props.items, menuSelect: props.onSelect, menuOpen: props.open },
      props.anchor,
    ),
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

/** Render, then let the list read land — the fetch settles on a later microtask. */
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
const menuOf = (tree) => nodesOf(tree).find((node) => node.props && node.props['data-stub'] === 'menu') || null
const cardOf = (tree) => nodesOf(tree).find((node) => node.props && node.props['data-generate-card']) || null
const buttonsOf = (tree) => nodesOf(tree).filter((node) => node.props && node.props['data-stub'] === 'button')
/** The card's main button is the wide one; the chevron cell is the narrow one. */
const mainButtonOf = (tree) => buttonsOf(tree).find((node) => node.props.style && node.props.style.flex === 1) || null
/** One flyout row's label, or null when the row is a separator. */
const rowLabel = (row) => (typeof row.label === 'string' ? row.label : null)
const labelsOf = (items) => items.map(rowLabel)

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
        bind: (ns) => (key) => {
          // Resolved at call time, not at bind time: `apply` binds the translator
          // before it registers the dictionary, which is what the harness does too.
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

// ── the stubbed host route ───────────────────────────────────────────────────

const ADAPTER = {
  name: 'krea2-raw-turbo-claire',
  title: 'Krea 2 Raw/Turbo Dual Mining',
  blurb: 'Text to image, with aspect ratio, megapixels and an upscale pass.',
  group: '',
  variant: '',
  cover: '',
  origin: 'mine',
  appId: '2090951249314521089',
  webappName: 'krea2 raw turbo dual mining 2 Claire',
  runLabel: 'Generate image',
  doorCount: 7,
}
const COMMUNITY = {
  ...ADAPTER,
  name: 'qwen-edit',
  title: 'Qwen 2.1 Edit',
  origin: 'community',
}
const UPSCALE_A = { ...ADAPTER, name: 'upscale-a', title: 'Upscale A', group: 'Upscale', variant: 'v1', doorCount: 2 }
const UPSCALE_B = { ...ADAPTER, name: 'upscale-b', title: 'Upscale A', group: 'Upscale', variant: 'v2', doorCount: 2 }
const DIGITAL_HUMAN = { ...ADAPTER, name: 'dh-krea', title: 'Krea 2 Raw dual mining', group: 'Generate digital human', doorCount: 5 }
const DIGITAL_HUMAN_2 = { ...ADAPTER, name: 'dh-qwen', title: 'Qwen 2.1 digital human', group: 'Generate digital human', doorCount: 4 }

function stubFetch(route) {
  const calls = []
  return {
    calls,
    fetch: async (url, init = {}) => {
      calls.push({ url, method: (init.method || 'GET').toUpperCase() })
      if (route === 'fail') return { ok: false, status: 500, json: async () => ({ error: 'unreadable' }) }
      if (route === 'throw') throw new Error('the host is not there')
      return { ok: true, status: 200, json: async () => ({ entries: route, skipped: [] }) }
    },
  }
}

// ── the cases ────────────────────────────────────────────────────────────────

const module = await loadClient()
const { ctx, seen } = recordingCtx('en')
module.apply(ctx)

const copy = seen.locales.find((entry) => entry.ns === 'generate')
const EN = copy ? copy.table.en : {}
const ZH = copy ? copy.table.zh : {}
const t = ctx.locale.bind('generate')
const type = seen.types[0]

const cardSlot = seen.slots.find((slot) => slot.options.name === 'sidebar.right.tab.guide.entry')

check(
  'the card renderer registers at sidebar.right.tab.guide.entry',
  !!cardSlot,
  seen.slots.map((slot) => slot.options.name).join(', '),
)
check(
  'the card registers under the type id, which is the key the guide dispatches',
  !!cardSlot && cardSlot.options.key === GENERATE_ID,
  cardSlot && String(cardSlot.options.key),
)
check(
  'the card takes this package\'s own copy',
  !!cardSlot && cardSlot.options.locale === 'generate',
  cardSlot && String(cardSlot.options.locale),
)
check(
  'the card does not replace the type registration',
  !!type && type.kind === 'generate' && Array.isArray(type.guide) && type.guide.length === 1,
  type && JSON.stringify({ kind: type.kind, guide: (type.guide || []).map((entry) => entry.id) }),
)
check(
  'the type still owns the standard card as the fallback',
  !!type && type.guide[0].id === 'open' && typeof type.guide[0].icon === 'function',
  type && String(type.guide[0].id),
)

const GUIDE_TITLE = type.guide[0].title()
const GUIDE_DESCRIPTION = type.guide[0].description()

/** Render the card for one host answer, and hand back what a click can reach. */
async function card(entries, { fail = false, key = 'card' } = {}) {
  const stub = stubFetch(fail ? 'fail' : entries)
  const real = globalThis.fetch
  globalThis.fetch = stub.fetch
  const opened = []
  try {
    const tree = await settle(
      cardSlot.component,
      {
        t,
        entryId: 'open',
        kind: 'generate',
        title: GUIDE_TITLE,
        description: GUIDE_DESCRIPTION,
        useTabInfo: () => ({ tab: { actions: { openTab: (kind, options) => opened.push({ kind, options }) } } }),
      },
      key,
    )
    return { tree, opened, calls: stub.calls }
  } finally {
    globalThis.fetch = real
  }
}

const ONE = await card([ADAPTER], { key: 'one' })
const MANY = await card([ADAPTER, COMMUNITY, UPSCALE_A, UPSCALE_B, DIGITAL_HUMAN, DIGITAL_HUMAN_2], { key: 'many' })
const NONE = await card([], { key: 'none' })
const BROKEN = await card([], { fail: true, key: 'broken' })

if (SHOW) {
  /** One row, with its submenu written out, so the hierarchy is readable in a terminal. */
  const rowText = (item) => {
    if (item.type === 'separator') return '---'
    if (!Array.isArray(item.submenu)) return item.label
    return item.label + ' ▸ ' + item.submenu.map(rowText).join(' / ')
  }
  for (const [name, state] of [['one', ONE], ['many', MANY], ['none', NONE], ['broken', BROKEN]]) {
    const menu = menuOf(state.tree)
    const items = menu ? menu.props.menuItems : []
    note(
      name + ': title=' + JSON.stringify((cardOf(state.tree) && textIn(mainButtonOf(state.tree))) || '') +
        ' rows=' + JSON.stringify(items.map(rowText)),
    )
  }
}

// ── the card, one entry: the degrade, and it dispatches straight to the app ──

check(
  'the card is drawn, and it is ours',
  !!cardOf(ONE.tree) && cardOf(ONE.tree).props['data-sidebar-right-guide-entry'] === 'generate',
  cardOf(ONE.tree) && String(cardOf(ONE.tree).props['data-sidebar-right-guide-entry']),
)
check(
  'one installed workflow: the card is that workflow, not the type',
  !!mainButtonOf(ONE.tree) && textIn(mainButtonOf(ONE.tree)).includes(ADAPTER.title),
  mainButtonOf(ONE.tree) && textIn(mainButtonOf(ONE.tree)),
)
check(
  'one installed workflow: its blurb is the second line',
  !!mainButtonOf(ONE.tree) && textIn(mainButtonOf(ONE.tree)).includes(ADAPTER.blurb),
  mainButtonOf(ONE.tree) && textIn(mainButtonOf(ONE.tree)),
)
check(
  'one installed workflow: no flyout at all, because there is nothing to categorize',
  menuOf(ONE.tree) === null,
  menuOf(ONE.tree) ? 'a flyout was drawn' : '',
)
// The row is a real control: fire the card and see where it goes.
mainButtonOf(ONE.tree).props.onClick()
check(
  'one installed workflow: clicking the card opens that unit',
  ONE.opened.length === 1 && ONE.opened[0].kind === 'generate' && ONE.opened[0].options.params.unit === ADAPTER.name,
  JSON.stringify(ONE.opened),
)
check(
  'the card asked the host for the installed list',
  ONE.calls.length === 1 && ONE.calls[0].url === ADAPTERS_API,
  JSON.stringify(ONE.calls),
)

// ── the card, several entries: the categorized flyout ───────────────────────

const manyMenu = menuOf(MANY.tree)
const manyItems = manyMenu ? manyMenu.props.menuItems : []
check(
  'several installed workflows: the card keeps the type\'s own label',
  !!mainButtonOf(MANY.tree) && textIn(mainButtonOf(MANY.tree)).includes(GUIDE_TITLE),
  mainButtonOf(MANY.tree) && textIn(mainButtonOf(MANY.tree)),
)
check('several installed workflows: a flyout is drawn', !!manyMenu)
check(
  'the flyout lists every installed workflow',
  [ADAPTER.title, COMMUNITY.title, DIGITAL_HUMAN.title].every((title) => JSON.stringify(manyItems).includes(title)),
  JSON.stringify(labelsOf(manyItems)),
)
check(
  'a capability is a submenu, not a flat row',
  (() => {
    const group = manyItems.find((item) => item.id === 'group:Generate digital human')
    if (!group || !Array.isArray(group.submenu)) return false
    const ids = group.submenu.map((item) => item.id)
    return ids.join(',') === DIGITAL_HUMAN.name + ',' + DIGITAL_HUMAN_2.name
      && !manyItems.some((item) => item.id === DIGITAL_HUMAN.name)
  })(),
  JSON.stringify(manyItems.map((item) => item.id)),
)
check(
  'several variants of one workflow are a third level, labelled by the variant',
  (() => {
    const group = manyItems.find((item) => item.id === 'group:Upscale')
    if (!group || !Array.isArray(group.submenu)) return false
    return group.submenu.length === 1 && group.submenu[0].submenu.map((item) => item.label).join(',') === 'v1,v2'
  })(),
  JSON.stringify(labelsOf(manyItems)),
)
check(
  'two variants are one row with two children, never the same row twice',
  (() => {
    const ids = manyItems.flatMap((item) => [item.id, ...(item.submenu || []).map((child) => child.id)])
    return new Set(ids).size === ids.length
  })(),
  JSON.stringify(manyItems.map((item) => item.id)),
)
check(
  'the last row is the way to add another workflow',
  manyItems.length > 0 && manyItems[manyItems.length - 1].label === EN['guide.flyout.add'],
  JSON.stringify(labelsOf(manyItems)),
)
check(
  'the ways to add are set apart from the installed workflows',
  manyItems.some((item) => item.type === 'separator') && manyItems[manyItems.length - 2].type === 'separator',
  JSON.stringify(manyItems.map((item) => item.type || item.id)),
)
check(
  'a community app is marked as someone else\'s work',
  JSON.stringify(manyItems).includes(COMMUNITY.title + ' · ' + EN['guide.community']),
  JSON.stringify(labelsOf(manyItems)),
)

if (manyMenu) {
  manyMenu.props.menuSelect(ADAPTER.name)
  manyMenu.props.menuSelect('add-a-workflow')
}
check(
  'selecting a leaf opens that unit, and selecting the add row opens the pane',
  MANY.opened.length === 2 &&
    MANY.opened[0].options.params.unit === ADAPTER.name &&
    MANY.opened[1].options.params === undefined,
  JSON.stringify(MANY.opened),
)
check(
  'every open replaces the pane\'s tab rather than stacking a second one',
  [...ONE.opened, ...MANY.opened].every((call) => call.options.replaceTab === true),
  JSON.stringify([...ONE.opened, ...MANY.opened]),
)

// ── the card, nothing installed: the correct empty state ────────────────────

const noneMenu = menuOf(NONE.tree)
const noneItems = noneMenu ? noneMenu.props.menuItems : []
check(
  'nothing installed: the card is the type\'s, not an empty workflow',
  !!mainButtonOf(NONE.tree) && textIn(mainButtonOf(NONE.tree)).includes(GUIDE_TITLE),
  mainButtonOf(NONE.tree) && textIn(mainButtonOf(NONE.tree)),
)
check(
  'nothing installed: the flyout offers the add row and nothing else',
  noneItems.length === 1 && noneItems[0].label === EN['guide.flyout.add'] && noneItems[0].type === undefined,
  JSON.stringify(noneItems.map((item) => item.type || item.label)),
)
check(
  'nothing installed: no separator between an add row and nothing',
  !noneItems.some((item) => item.type === 'separator'),
  JSON.stringify(noneItems),
)
mainButtonOf(NONE.tree).props.onClick()
check(
  'nothing installed: the card opens the pane, which is where adding is explained',
  NONE.opened.length === 1 && NONE.opened[0].kind === 'generate' && NONE.opened[0].options.params === undefined,
  JSON.stringify(NONE.opened),
)

// ── the card, host unreachable: said out loud, not drawn as empty ───────────

const brokenMenu = menuOf(BROKEN.tree)
check(
  'an unreachable host says so instead of looking like an empty install',
  !!brokenMenu && brokenMenu.props.menuItems[0].label === EN['guide.flyout.failed'] && brokenMenu.props.menuItems[0].disabled === true,
  brokenMenu && JSON.stringify(brokenMenu.props.menuItems.map((item) => item.label)),
)
check(
  'an unreachable host still offers the add row, so the card is never a dead end',
  !!brokenMenu && brokenMenu.props.menuItems[brokenMenu.props.menuItems.length - 1].label === EN['guide.flyout.add'],
  brokenMenu && JSON.stringify(brokenMenu.props.menuItems.map((item) => item.label)),
)

// ── the copy, in both languages ─────────────────────────────────────────────

for (const key of ['guide.flyout.label', 'guide.flyout.loading', 'guide.flyout.failed', 'guide.flyout.add', 'guide.community']) {
  check('the copy has ' + key + ' in English', typeof EN[key] === 'string' && EN[key] !== '', String(EN[key]))
  check('the copy has ' + key + ' in Chinese', typeof ZH[key] === 'string' && ZH[key] !== '', String(ZH[key]))
}

// ── the host half: what may be listed, and what is reported instead ─────────

const dir = await mkdtemp(join(tmpdir(), 'rh-adapters-'))
try {
  const valid = {
    schema: ADAPTER_SCHEMA,
    name: 'good',
    title: 'A good adapter',
    blurb: 'one line',
    group: 'Capability',
    variant: 'v1',
    origin: 'mine',
    source: { kind: 'webapp', appId: '1', webappName: 'Good', url: '' },
    doors: { a: { nodeId: '1', fieldName: 'a', type: 'text', label: 'A' }, b: { nodeId: '2', fieldName: 'b', type: 'text', label: 'B' } },
    ui: { runLabel: 'Run it', order: ['a', 'b'] },
    provenance: { checkedAgainst: 'apiCallDemo', dryRun: 'ok' },
  }
  await writeFile(join(dir, 'good.json'), JSON.stringify(valid))
  await writeFile(join(dir, 'broken.json'), '{ this is not json')
  await writeFile(join(dir, 'unvalidated.json'), JSON.stringify({ ...valid, name: 'unvalidated', provenance: { checkedAgainst: 'apiCallDemo', dryRun: '' } }))
  await writeFile(join(dir, 'anonymous.json'), JSON.stringify({ ...valid, name: 'anonymous', origin: '' }))
  await writeFile(join(dir, 'future.json'), JSON.stringify({ ...valid, name: 'future', schema: 'muen-rh-adapter/v2' }))
  await writeFile(join(dir, 'notes.txt'), 'not an adapter')

  const listed = await listAdapters(dir)
  check(
    'an adapter that was validated and attributed is listed',
    listed.entries.length === 1 && listed.entries[0].name === 'good',
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
        entry.doorCount === 2
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
} finally {
  await rm(dir, { recursive: true, force: true })
}

// ── the install that is actually on this machine, when there is one ─────────

const profile = join(homedir(), 'Library', 'Application Support', 'Mitsumeru', 'mitsu-dsh', 'profiles', 'mitsu', 'runninghub', 'adapters')
const installed = await listAdapters(profile).catch(() => null)
if (installed === null || installed.entries.length === 0) {
  skip('the installed profile lists at least one workflow', 'nothing installed at ' + profile)
} else {
  check(
    'the installed profile lists what the install flow wrote',
    installed.entries.every((entry) => entry.name !== '' && entry.title !== '' && entry.doorCount > 0),
    JSON.stringify(installed.entries.map((entry) => entry.name + ' → ' + entry.title + ' (' + entry.doorCount + ' doors)')),
  )
  check(
    'every installed adapter is one the card can open',
    installed.skipped.length === 0,
    JSON.stringify(installed.skipped),
  )
}

finish()
