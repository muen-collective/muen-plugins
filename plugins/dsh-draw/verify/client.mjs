/**
 * Client-half verification — no app, no restart.
 *
 * The composed app is the only proof that a plugin is not inert, and that needs a launch.
 * This is everything below it: the bundle parses, it mounts through a stub loader, the
 * registration shape matches what the harness calls, the copy has a reader, and the pane
 * actually renders the frame it promises.
 *
 *   node verify/client.mjs
 */
import vm from 'node:vm'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const CLIENT = join(here, '..', 'lib', 'client.js')

const checks = []
function check(name, condition, detail) {
  checks.push({ name, ok: Boolean(condition) })
  console.log(`${condition ? '  ok ' : '  FAIL'}  ${name}${condition ? '' : '  <-- ' + (detail ?? '')}`)
}

const source = await readFile(CLIENT, 'utf8')

/* ---- 1. it must PARSE. every other check reads the file as text. ---- */
try {
  new vm.Script(source)
  check('the bundle parses', true)
} catch (err) {
  check('the bundle parses', false, err.message)
}

/* ---- 2. it mounts through the loader ---- */
let loaded = null
globalThis.window = { __ModuleLoader__: { load: (def) => (loaded = def) } }

await import(CLIENT + '?v=' + Date.now())

check('registers through __ModuleLoader__', Boolean(loaded), 'the loader was never called')
check('declares its own id', loaded && loaded.id === '@muen/dsh-draw', loaded && loaded.id)

/* ---- 3. only the three allowed requires ---- */
const ALLOWED = new Set(['react', 'react-dom', '@deepseek-ai/dsh-client-ui-primitives'])
const required = new Set()
const requireLike = (name) => {
  required.add(name)
  if (name === 'react') {
    return {
      createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
      useState: (initial) => [initial, () => undefined],
      useEffect: () => undefined,
      useRef: (v) => ({ current: v }),
      useMemo: (fn) => fn(),
    }
  }
  if (name === '@deepseek-ai/dsh-client-ui-primitives') {
    // Deliberately absent: the icon seam must survive a missing component, which is a
    // React crash rather than a blank if the fallback is wrong.
    return {}
  }
  throw new Error('require not allowed in a client bundle: ' + name)
}

const mod = loaded.factory(requireLike)
check('the factory returns { inject, apply }', typeof mod?.apply === 'function', JSON.stringify(Object.keys(mod || {})))
check('every require is on the allow-list', [...required].every((n) => ALLOWED.has(n)), [...required].join(', '))

/* ---- 4. the inject list names seams the harness provides ---- */
check(
  'injects slots, locale and the tab registry',
  Array.isArray(mod.inject) && ['slots', 'locale', 'sidebarRightTabs'].every((s) => mod.inject.includes(s)),
  JSON.stringify(mod.inject),
)

/* ---- 5. apply() registers exactly what it claims, through ctx.effect ---- */
const registered = { locale: null, tabs: [], slots: [], effects: 0 }
const ctx = {
  effect(fn) { registered.effects += 1; return fn() },
  locale: {
    bind: () => (key) => key,
    register: (ns, dict) => { registered.locale = { ns, dict } },
  },
  sidebarRightTabs: { register: (def) => (registered.tabs.push(def), () => undefined) },
  slots: {
    inject: (_name, fn) => fn(),
    register: (meta, component) => (registered.slots.push({ meta, component }), () => undefined),
  },
}

mod.apply(ctx)

check('registers through ctx.effect', registered.effects === 4, `effects=${registered.effects}`)
check('registers one locale namespace', registered.locale?.ns === 'draw', registered.locale?.ns)
check('registers one tab type', registered.tabs.length === 1, `tabs=${registered.tabs.length}`)
check('registers a body and a title', registered.slots.length === 2, `slots=${registered.slots.length}`)
check(
  'both slots use the plugin id as their key',
  registered.slots.every((s) => s.meta.key === '@muen/dsh-draw'),
  JSON.stringify(registered.slots.map((s) => s.meta.key)),
)
check(
  'both slots declare the locale namespace',
  registered.slots.every((s) => s.meta.locale === 'draw'),
  JSON.stringify(registered.slots.map((s) => s.meta.locale)),
)

/* ---- 6. the tab registry CALLS these, so they must be functions ---- */
const tab = registered.tabs[0]
check('the tab has a kind', typeof tab?.kind === 'string' && tab.kind === 'draw', tab?.kind)
check('title is a thunk, not a string', typeof tab?.title === 'function', typeof tab?.title)
check('the title thunk answers', typeof tab?.title?.() === 'string', String(tab?.title?.()))
check(
  'every guide entry has thunks for title and description',
  Array.isArray(tab?.guide) &&
    tab.guide.length > 0 &&
    tab.guide.every((g) => typeof g.title === 'function' && typeof g.description === 'function'),
  JSON.stringify(tab?.guide?.map((g) => [typeof g.title, typeof g.description])),
)

/* ---- 7. copy: the host's t must be CONSULTED, and both languages must cover it ---- */
const asked = new Set()
const bound = (key) => { asked.add(key); return key }
for (const slot of registered.slots) {
  const Component = slot.component
  // render with the host's bound translator, exactly as the harness would
  Component({ t: bound })
}
const en = registered.locale.dict.en || {}
const zh = registered.locale.dict.zh || {}
check('the pane asks the host for translation (props.t is used)', asked.size > 0, `${asked.size} keys requested`)
check(
  'every requested key exists in both dictionaries',
  [...asked].every((k) => k in en && k in zh),
  [...asked].filter((k) => !(k in en && k in zh)).join(', '),
)
check(
  'both dictionaries have the same key set',
  Object.keys(en).length === Object.keys(zh).length && Object.keys(en).every((k) => k in zh),
  `en=${Object.keys(en).length} zh=${Object.keys(zh).length}`,
)

/* ---- 8. the pane renders the frame it promises ---- */
function walk(node, visit) {
  if (!node || typeof node !== 'object') return
  visit(node)
  for (const child of node.children || []) walk(child, visit)
}

let iframe = null
let sawReadsCopy = false
for (const slot of registered.slots) {
  const tree = slot.component({ t: (k) => en[k] ?? k })
  walk(tree, (n) => {
    if (n.type === 'iframe') iframe = n
    if (typeof n.children?.[0] === 'string') return
  })
  // the promise the pane makes, in words, must be on screen somewhere
  const flat = JSON.stringify(tree)
  if (flat.includes(en['pane.reads'])) sawReadsCopy = true
}

check('the pane renders an iframe', Boolean(iframe), 'no iframe in the tree')
check('the iframe points at the host route', iframe?.props?.src === '/plugins/draw/', iframe?.props?.src)
check('the iframe is titled for accessibility', typeof iframe?.props?.title === 'string' && iframe.props.title.length > 0, iframe?.props?.title)
check('the pane says the agent reads it', sawReadsCopy, 'pane.reads is not rendered')

/* ---- 9. a missing icon component must not crash the pane ---- */
const primitivesEmpty = {}
check('renders when the icon seam is empty', (() => {
  try {
    const m2 = loaded.factory((n) => (n === 'react' ? {
      createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
      useState: (v) => [v, () => undefined],
    } : primitivesEmpty))
    m2.apply({
      effect: (fn) => fn(),
      locale: { bind: () => (k) => k, register: () => undefined },
      sidebarRightTabs: { register: () => undefined },
      slots: { inject: (_n, fn) => fn(), register: (_m, C) => (C({ t: (k) => k }), () => undefined) },
    })
    return true
  } catch (err) {
    check('  (missing-icon crash)', false, err.message)
    return false
  }
})(), 'a missing icon name threw')

const failed = checks.filter((c) => !c.ok)
console.log(`\n${checks.length - failed.length}/${checks.length} passed`)
process.exit(failed.length ? 1 : 0)
