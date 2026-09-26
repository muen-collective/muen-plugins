/**
 * The shared harness for this plugin's suites — the same shape `@muen/dsh-assets` uses: one
 * reporter, one way to load a `window.__ModuleLoader__` bundle in this process, one mini React, and
 * the harness's own locale runtime loaded as a REAL oracle rather than faked.
 */
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createContext, runInContext } from 'node:vm'

const HERE = dirname(fileURLToPath(import.meta.url))
export const PLUGIN = dirname(HERE)
export const CLIENT = join(PLUGIN, 'lib', 'client.js')

// ── reporter ─────────────────────────────────────────────────────────────────

export function reporter(name, title) {
  const rows = []
  return {
    check: (label, ok, detail) => rows.push({ label, status: ok ? 'pass' : 'fail', detail: detail == null ? '' : String(detail) }),
    note: (text) => rows.push({ label: text, status: 'note', detail: '' }),
    finish: () => {
      let failed = 0
      process.stdout.write('\n' + name + ' — ' + title + '\n')
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
    },
  }
}

// ── a bundle, loaded the way the app loads it ────────────────────────────────

/** Anything a member access asks for answers a no-op function: the bundle touches these inside
 *  components and actions, never while it is being defined. */
const anyFunction = () => new Proxy(function noop() {}, { get: () => anyFunction() })

/**
 * Load one `window.__ModuleLoader__.load({ id, factory })` bundle in this process and answer its
 * exports. `react` and the primitives are supplied by the caller so a suite can render what the
 * bundle draws.
 */
export function loadClient(path, { react, primitives, globals = {} }) {
  let captured = null
  const sandbox = {
    console,
    setTimeout,
    clearTimeout,
    Date,
    Math,
    JSON,
    Object,
    Array,
    Map,
    Set,
    String,
    Number,
    Boolean,
    Symbol,
    Error,
    TypeError,
    Promise,
    RegExp,
  }
  // Whatever the caller needs the bundle to see as a browser global (`document`, `fetch`, an
  // observer) is injected here, because the bundle reads them from its own global scope.
  Object.assign(sandbox, globals)
  sandbox.globalThis = sandbox
  sandbox.navigator = { languages: ['en-US', 'en'], language: 'en-US' }
  sandbox.window = {
    __ModuleLoader__: {
      load: (entry) => {
        captured = entry.factory((name) => {
          if (name === 'react') return react || anyFunction()
          if (name === '@deepseek-ai/dsh-client-ui-primitives') return primitives || anyFunction()
          return anyFunction()
        })
      },
    },
  }
  createContext(sandbox)
  runInContext(readFileSync(path, 'utf8'), sandbox, { filename: path })
  return captured
}

// ── the mini React ───────────────────────────────────────────────────────────

/**
 * A React stub good enough to render these components the way the browsers do: hooks keyed by call
 * order, dependencies honoured, and `useSyncExternalStore` reading the store on every render (which
 * is what a re-render does in the browser, and what the suite drives by rendering again after it
 * changes the locale).
 */
export function miniReact() {
  let slots = []
  let cursor = 0
  const React = {
    createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
    useState: (initial) => {
      const index = cursor
      cursor += 1
      if (slots[index] === undefined) slots[index] = { value: typeof initial === 'function' ? initial() : initial }
      return [slots[index].value, (next) => { slots[index].value = typeof next === 'function' ? next(slots[index].value) : next }]
    },
    useEffect: (fn, deps) => {
      const index = cursor
      cursor += 1
      const previous = slots[index] || {}
      const changed = previous.deps === undefined || !sameDeps(previous.deps, deps)
      slots[index] = { ...previous, effect: fn, deps: Array.isArray(deps) ? [...deps] : deps, pending: changed || previous.pending === true }
    },
    useMemo: (fn) => fn(),
    useCallback: (fn) => fn,
    useRef: (initial) => ({ current: initial }),
    useSyncExternalStore: (subscribe, getSnapshot) => {
      const index = cursor
      cursor += 1
      if (slots[index] === undefined) {
        slots[index] = { unsubscribe: typeof subscribe === 'function' ? subscribe(() => {}) : null }
      }
      return getSnapshot()
    },
  }
  return {
    React,
    reset: () => { cursor = 0 },
    clear: () => { slots = []; cursor = 0 },
    subscribed: () => slots.some((slot) => slot && typeof slot.unsubscribe === 'function'),
    runEffects: () => {
      for (const slot of [...slots]) {
        if (!slot || typeof slot.effect !== 'function' || slot.pending !== true) continue
        slot.pending = false
        slot.effect()
      }
    },
  }
}

function sameDeps(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false
  return a.every((value, index) => Object.is(value, b[index]))
}

/**
 * The primitives the bundle draws with, recording what it was asked to draw. `Menu` answers its
 * anchor (so the trigger is rendered) and stores its props for the suite to read.
 */
export function primitivesStub() {
  const menus = []
  return {
    menus,
    primitives: {
      Menu: (props) => {
        menus.push(props)
        return props.anchor
      },
      IconGlobeOutlineRegular: (props) => ({ type: 'globe', props: props || {}, children: [] }),
      IconGlobeOutline: (props) => ({ type: 'globe', props: props || {}, children: [] }),
    },
  }
}

// ── the harness's own locale runtime, as an oracle ───────────────────────────

/** Where the harness keeps the locale client: the installed app, then a dev tree. */
export function localeBundlePath() {
  const candidates = [
    process.env.DSH_CLIENT_LOCALE,
    '/Applications/Mitsumeru.app/Contents/Resources/harness/node_modules/@deepseek-ai/dsh-client-locale/lib/client.js',
    join(homedir(), 'mitsumeru', 'node_modules', '@deepseek-ai', 'dsh-client-locale', 'lib', 'client.js'),
  ].filter((path) => typeof path === 'string' && path !== '')
  return candidates.find((path) => existsSync(path)) || null
}

/** The real `LocaleRuntime`, built the way the harness builds it (no host scope ⇒ process-local). */
export function loadLocaleRuntime(path) {
  const bundle = loadClient(path, { react: anyFunction(), primitives: anyFunction() })
  const make = (scope) => new bundle.LocaleRuntime({ emit: () => {}, effect: () => {} }, scope, undefined)
  return { LocaleRuntime: bundle.LocaleRuntime, make }
}

/** The durable preference scope the app hands the runtime (a config form in the real tree). */
export function fakeScope(initial) {
  const state = { value: initial === undefined ? undefined : { preference: initial } }
  const subscribers = new Set()
  return {
    state,
    getSnapshot: () => state,
    subscribe: (fn) => {
      subscribers.add(fn)
      return () => subscribers.delete(fn)
    },
    set: (field, value) => {
      state.value = { ...(state.value || {}), [field]: value }
      for (const fn of [...subscribers]) fn()
    },
  }
}

/** A context that answers the two services the bundle asks for, and records the registrations. */
export function mountCtx({ locale, slots = true } = {}) {
  const registered = []
  const injected = []
  const service = {
    injected,
    registered,
    inject: (name, callback) => {
      injected.push(name)
      if (typeof callback === 'function') callback()
    },
    register: (spec, component) => {
      registered.push({ spec, component })
      return () => {}
    },
  }
  const ctx = {
    get: (name) => {
      if (name === 'locale') return locale
      if (name === 'slots') return slots ? service : undefined
      return undefined
    },
  }
  return { ctx, service, injected, registered }
}
