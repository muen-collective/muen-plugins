/**
 * verify:mount — epic 63 A1's claim, asserted rather than intended.
 *
 * The claim: **the Assets library has a door and an honest empty room.** The shipped
 * `lib/client.js` is executed in a stubbed loader and driven exactly as the browser drives
 * it: the factory is called, `apply(ctx)` runs against a recording ctx, and every
 * registration the slice claims is read back off the recorder — the tab type under our id,
 * the body and chip keys beside it, the guide entry the Start page's card comes from, the
 * glyph it draws, and the copy in both languages.
 *
 * IT ALSO RENDERS THE PANE, THREE WAYS, against a stubbed host: while the answer is in
 * flight, when the host cannot be read, and when it answers no folders. The third is the
 * empty state A1 is made of, and it is checked as TEXT plus the two paths the pane shows,
 * because "no folders yet" without saying where it looked is the shrug this slice exists to
 * avoid.
 *
 * This is source-level evidence: it proves the registration code does what A1 says, not that
 * a running harness accepted it. The live layer is the founder's eyes on the app after a
 * restart, which is the gate this slice ends at.
 *
 *   node verify/mount.mjs
 */
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')
const PKG_NAME = '@muen/dsh-assets'
const KIND = 'assets'
const NS = 'assets'
const GUIDE_ENTRY_ID = 'open'

// ── the reporter (the same shape as the plugin's siblings) ───────────────────

const rows = []
const check = (label, ok, detail) => rows.push({ label, status: ok ? 'pass' : 'fail', detail: detail == null ? '' : String(detail) })
const note = (text) => rows.push({ label: text, status: 'note', detail: '' })

function finish() {
  let failed = 0
  process.stdout.write('\nverify:mount — epic 63 A1 (the Assets card and the empty room)\n')
  for (const row of rows) {
    if (row.status === 'pass') continue
    if (row.status === 'note') {
      process.stdout.write('  ....  ' + row.label + '\n')
      continue
    }
    if (row.status === 'fail') failed += 1
    process.stdout.write('  FAIL  ' + row.label + (row.detail ? '  —  ' + row.detail : '') + '\n')
  }
  const passes = rows.filter((row) => row.status === 'pass').length
  const total = rows.filter((row) => row.status !== 'note').length
  process.stdout.write('  ' + passes + '/' + total + ' passed\n')
  if (failed > 0) process.exitCode = 1
}

// ── a tiny hook runtime, so a state the pane reaches can be read ─────────────

/**
 * Enough React to render one component twice: hooks are kept in order, effects run after
 * the first render, and the second render reads the values those effects set. This is what
 * makes the empty state checkable as text instead of assumed.
 */
function miniReact() {
  let slots = []
  // A RENDER CURSOR, not `slots.length`: hooks are read in the order a render calls them, so
  // the second render must start again at 0 and read the values the first one left behind.
  let cursor = 0
  const React = {
    createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
    useState: (initial) => {
      const index = cursor
      cursor += 1
      if (slots[index] === undefined) slots[index] = { value: typeof initial === 'function' ? initial() : initial }
      return [slots[index].value, (next) => { slots[index].value = typeof next === 'function' ? next(slots[index].value) : next }]
    },
    useEffect: (fn) => {
      const index = cursor
      cursor += 1
      slots[index] = { ...(slots[index] || {}), effect: fn }
    },
    useMemo: (fn) => fn(),
    useCallback: (fn) => fn,
    useRef: (initial) => ({ current: initial }),
  }
  return {
    React,
    /** Begin a render pass: hooks are counted from zero again. */
    reset: () => { cursor = 0 },
    /** Forget everything, for a fresh component instance. */
    clear: () => { slots = []; cursor = 0 },
    peek: () => (slots[0] ? slots[0].value : null),
    runEffects: () => {
      // A copy: an effect may render again (and so push slots) while this loop runs.
      for (const slot of [...slots]) if (slot && typeof slot.effect === 'function') slot.effect()
    },
  }
}

/** Every string in a rendered tree, in order. Function components are called. */
function textOf(node, out = []) {
  if (node == null || node === false || node === true) return out
  if (typeof node === 'string' || typeof node === 'number') {
    out.push(String(node))
    return out
  }
  if (Array.isArray(node)) {
    for (const child of node) textOf(child, out)
    return out
  }
  if (typeof node !== 'object') return out
  const { type, props, children } = node
  if (typeof type === 'function') {
    // A function component: call it with its own props, and walk what it returned.
    return textOf(type({ ...props, children }), out)
  }
  const list = Array.isArray(children) ? children : children === undefined ? [] : [children]
  for (const child of list) textOf(child, out)
  if (props && props.children !== undefined && !list.includes(props.children)) textOf(props.children, out)
  return out
}

/** Load the shipped browser script in a stubbed loader, and return its factory. */
/** The fetch the pane sees: the browser's is a global, so the sandbox gets one that forwards. */
const net = { fetch: () => Promise.reject(new Error('no stub installed')) }

async function loadFactory(React) {
  const source = await readFile(join(ROOT, 'lib/client.js'), 'utf8')
  let captured = null
  const sandbox = {
    window: {
      __ModuleLoader__: {
        load: (registration) => {
          captured = registration
        },
      },
    },
    // The client half runs in the vm, so a global it reads at call time (`fetch`) has to be
    // the sandbox's own — a `globalThis.fetch` set here would never be seen from inside.
    fetch: (...args) => net.fetch(...args),
    console,
  }
  vm.createContext(sandbox)
  vm.runInContext(source, sandbox, { filename: 'lib/client.js' })
  if (!captured) throw new Error('lib/client.js never called window.__ModuleLoader__.load')
  return { registration: captured, sandbox }
}

/** The recording ctx the browser's own services stand in for. */
function recordingCtx(locale = 'en') {
  const seen = { effects: [], locales: [], types: [], injected: [], slots: [] }
  const dicts = new Map()
  const ctx = {
    effect: (fn, id) => {
      seen.effects.push(id)
      fn()
      return () => {}
    },
    locale: {
      register: (ns, table) => {
        seen.locales.push({ ns, table })
        dicts.set(ns, table)
        return () => {}
      },
      // `bind(ns)` resolves at CALL time, which is the property that makes a language change
      // need no re-registration: the closure must not capture the dictionary it saw.
      bind: (ns) => (key) => {
        const table = dicts.get(ns) || {}
        const dict = table[locale] || table.en || {}
        return Object.prototype.hasOwnProperty.call(dict, key) ? dict[key] : key
      },
    },
    sidebarRightTabs: {
      register: (definition) => {
        seen.types.push(definition)
        return () => {}
      },
    },
    slots: {
      inject: (name, callback) => {
        seen.injected.push(name)
        callback()
        return () => {}
      },
      register: (options, component) => {
        seen.slots.push({ options, component })
        return () => {}
      },
    },
  }
  return { ctx, seen }
}

const mini = miniReact()
const PRIMITIVES_STUB = {
  // The pane's glyphs, named as the current core names them. The loader resolves by current
  // name with the legacy as fallback, so a stub carrying only the current name is enough.
  IconFolderOpenRegular: (props) => mini.React.createElement('svg', { 'data-stub-icon': 'folder', ...props }),
  IconLoadingOutlineRegular: (props) => mini.React.createElement('svg', { 'data-stub-icon': 'loading', ...props }),
}

const { registration } = await loadFactory(mini.React)
check('the client half registers itself under the package name', registration && registration.id === PKG_NAME, registration && registration.id)
check('and exposes a factory that needs only react', typeof registration.factory === 'function', typeof registration.factory)

const requireStub = (spec) => {
  if (spec === 'react') return mini.React
  if (spec === '@deepseek-ai/dsh-client-ui-primitives') return PRIMITIVES_STUB
  throw new Error('unexpected require: ' + spec)
}

const exports_ = registration.factory(requireStub)
check('the factory answers inject + apply', typeof exports_.apply === 'function' && Array.isArray(exports_.inject), JSON.stringify(exports_.inject))
check('and asks for the three services it registers through', ['slots', 'locale', 'sidebarRightTabs'].every((name) => exports_.inject.includes(name)), JSON.stringify(exports_.inject))

const { ctx, seen } = recordingCtx('en')
exports_.apply(ctx)

// ── the door ────────────────────────────────────────────────────────────────

const definition = seen.types[0]
check('one tab type is registered', seen.types.length === 1, seen.types.length + ' types')
check('under our own id', definition && definition.id === PKG_NAME, definition && definition.id)
check('as the assets kind', definition && definition.kind === KIND, definition && definition.kind)
check('with the extension priority a third-party surface carries', definition && definition.priority === 'extension', definition && definition.priority)
check('and a live chip label', typeof definition.title === 'function' && definition.title() === 'Assets', definition.title && definition.title())

const guide = definition && Array.isArray(definition.guide) ? definition.guide[0] : null
check('the Start page gets exactly one entry', definition && definition.guide.length === 1, definition && definition.guide.length)
check('the entry has the id a card is opened by', guide && guide.id === GUIDE_ENTRY_ID, guide && guide.id)
check('and a live title and description', guide && typeof guide.title === 'function' && guide.title() === 'Assets' && typeof guide.description() === 'string' && guide.description().length > 0, guide && guide.title() + ' / ' + guide.description())
check('and a glyph of its own, so no cube placeholder', typeof guide.icon === 'function' && guide.icon() !== null && guide.icon() !== undefined, typeof guide.icon)

// ── the body and the chip ───────────────────────────────────────────────────

const body = seen.slots.find((slot) => slot.options.name === 'sidebar.right.pane.tab')
const chip = seen.slots.find((slot) => slot.options.name === 'sidebar.right.pane.tab.title')
check('the pane body is registered against our key', !!body && body.options.key === PKG_NAME, body && body.options.key)
check('and it carries the namespace, so its copy re-reads on a language change', !!body && body.options.locale === NS, body && body.options.locale)
check('the chip is registered against the same key', !!chip && chip.options.key === PKG_NAME, chip && chip.options.key)
check('both arrive through the slot injection the harness documents', seen.injected.includes('sidebar.right.pane.tab') && seen.injected.includes('sidebar.right.pane.tab.title'), JSON.stringify(seen.injected))
check('every registration is registered as an effect, so unloading takes it away', seen.effects.length >= 4, JSON.stringify(seen.effects))

// ── the copy, in both languages ─────────────────────────────────────────────

const table = seen.locales[0] && seen.locales[0].table
check('the copy is registered under our own namespace', seen.locales.length === 1 && seen.locales[0].ns === NS, seen.locales.length + ' registrations')
const en = (table && table.en) || {}
const zh = (table && table.zh) || {}
const enKeys = Object.keys(en).sort()
const zhKeys = Object.keys(zh).sort()
check('english and chinese cover exactly the same keys', enKeys.length > 0 && JSON.stringify(enKeys) === JSON.stringify(zhKeys), enKeys.length + ' en / ' + zhKeys.length + ' zh')
check('no string is left as its own key', enKeys.every((key) => en[key] !== key && String(en[key]).trim() !== '') && zhKeys.every((key) => zh[key] !== key && String(zh[key]).trim() !== ''), enKeys.filter((key) => en[key] === key).join(', '))
check('the empty state is written, not implied', typeof en['pane.empty.title'] === 'string' && en['pane.empty.title'].length > 0 && typeof en['pane.empty.body'] === 'string' && en['pane.empty.body'].length > 20, en['pane.empty.title'])
check('and it says nothing is copied or moved', /copied|moved/i.test(en['pane.empty.body']), en['pane.empty.body'])

// ── the pane, rendered against three hosts ──────────────────────────────────

const renderPane = async (fetchImpl) => {
  net.fetch = fetchImpl
  try {
    mini.clear()
    mini.reset()
    let tree = body.component({ locale: { bind: () => (key) => en[key] || key } })
    mini.runEffects()
    // Let the promise the effect started settle, then render again and read the state it set.
    await new Promise((resolve) => setTimeout(resolve, 0))
    await new Promise((resolve) => setTimeout(resolve, 0))
    if (process.env.DEBUG_RENDER) console.log('  [debug] state =', JSON.stringify(mini.peek()))
    mini.reset()
    tree = body.component({ locale: { bind: () => (key) => en[key] || key } })
    return textOf(tree).join(' | ')
  } finally {
    net.fetch = () => Promise.reject(new Error('no stub installed'))
  }
}

{
  const text = await renderPane(() => new Promise(() => {}))
  check('while the host is answering, the pane says it is reading', text.includes('Reading folders'), text.slice(0, 80))
}

{
  const text = await renderPane(() => Promise.reject(new Error('ECONNREFUSED')))
  check('when the host cannot be read, the pane says so rather than showing an empty library', text.includes('could not be read') && text.includes('ECONNREFUSED'), text.slice(0, 120))
}

{
  const text = await renderPane(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ folders: [], root: '/Users/someone/Library/Application Support/Mitsumeru/mitsu-dsh/profiles/mitsu/assets', recordsRoot: '/Users/someone/Library/Application Support/Mitsumeru/mitsu-dsh/profiles/mitsu/generate' }),
    }),
  )
  check('with no folders, the pane draws the empty state', text.includes('No folders yet'), text.slice(0, 120))
  check('and it says what to do next', /Add the folder/i.test(text), text.slice(0, 200))
  check('and where the library is looking, both paths', text.includes('profiles/mitsu/assets') && text.includes('profiles/mitsu/generate'), text.slice(0, 260))
}

{
  const text = await renderPane(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ folders: [{ path: '/Users/someone/Desktop/yammaman', label: 'yammaman', addedAt: '2026-09-26T00:00:00.000Z' }], root: '/p/assets', recordsRoot: '/p/generate' }),
    }),
  )
  check('with a folder added, the pane lists it instead of the empty state', text.includes('/Users/someone/Desktop/yammaman') && !text.includes('No folders yet'), text.slice(0, 160))
}

// ── the chip renders ────────────────────────────────────────────────────────

{
  const text = textOf(chip.component({ locale: { bind: () => (key) => en[key] || key } })).join('')
  check('the chip draws the folder glyph and the name', text.includes('Assets'), text)
}

note('the live layer is the founder’s eyes: after an app restart the Assets card appears on the Start page')

finish()
