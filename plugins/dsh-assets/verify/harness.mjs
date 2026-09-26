/**
 * The pieces this plugin's suites share: the reporter, the stubs, and enough React to
 * render a component twice.
 *
 * WHY IT IS SHARED: three suites drive the same shipped code — the client half in a stubbed
 * loader, the host half against temp directories — and three copies of "how do I render this"
 * would drift until one of them proved something the others did not. The harness is not a
 * test framework: it is the smallest thing that makes a claim checkable.
 *
 * @module @muen/dsh-assets/verify/harness
 */
import { readFile } from 'node:fs/promises'
import { Readable, Writable } from 'node:stream'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

export const HERE = dirname(fileURLToPath(import.meta.url))
export const ROOT = join(HERE, '..')

// ── the reporter (the same shape as the plugin's siblings) ───────────────────

export function reporter(title) {
  const rows = []
  const check = (label, ok, detail) => rows.push({ label, status: ok ? 'pass' : 'fail', detail: detail == null ? '' : String(detail) })
  const note = (text) => rows.push({ label: text, status: 'note', detail: '' })
  const finish = () => {
    let failed = 0
    process.stdout.write('\n' + title + '\n')
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
  return { check, note, finish, rows }
}

// ── enough React to render a component twice ────────────────────────────────

/**
 * Hooks are read in call order, so a render pass counts from zero (`reset`) and reads the
 * values the previous pass left behind. An effect runs after the first pass, and the second
 * pass is what makes the state it set observable — which is how a claim about what a person
 * sees on screen becomes checkable without a browser.
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
    /**
     * DEPENDENCIES ARE HONOURED, because a real `useEffect` re-runs only when they change —
     * and without that, a second render pass would re-fire every fetch in the component and
     * the suite would prove something the browser never does.
     */
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
  }
  return {
    React,
    reset: () => { cursor = 0 },
    clear: () => { slots = []; cursor = 0 },
    peek: () => (slots[0] ? slots[0].value : null),
    runEffects: () => {
      for (const slot of [...slots]) {
        if (!slot || typeof slot.effect !== 'function' || slot.pending !== true) continue
        slot.pending = false
        slot.effect()
      }
    },
  }
}

/** Shallow equality, which is what React compares a dependency array with. */
function sameDeps(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false
  return a.every((value, index) => Object.is(value, b[index]))
}

/** Every string in a rendered tree, in order. Function components are called. */
export function textOf(node, out = []) {
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
  if (typeof type === 'function') return textOf(type({ ...props, children }), out)
  const list = Array.isArray(children) ? children : children === undefined ? [] : [children]
  for (const child of list) textOf(child, out)
  if (props && props.children !== undefined && !list.includes(props.children)) textOf(props.children, out)
  return out
}

/** Every node in a rendered tree whose props match, roots first. */
export function collect(node, predicate, out = []) {
  if (node == null || typeof node !== 'object') return out
  if (Array.isArray(node)) {
    for (const child of node) collect(child, predicate, out)
    return out
  }
  const { type, props, children } = node
  if (typeof type === 'function') {
    // A host component is a string (`div`, `img`); anything else is ours to call.
    if (typeof type !== 'string') return collect(type({ ...props, children }), predicate, out)
  }
  if (props && predicate({ ...node, props })) out.push({ ...node, props })
  const list = Array.isArray(children) ? children : children === undefined ? [] : [children]
  for (const child of list) collect(child, predicate, out)
  if (props && props.children !== undefined && !list.includes(props.children)) collect(props.children, predicate, out)
  return out
}

// ── the client half, in a stubbed loader ────────────────────────────────────

/** The fetch the client sees: the browser's is a global, so the sandbox gets one that forwards. */
export const net = { fetch: () => Promise.reject(new Error('no stub installed')) }

/**
 * Load the shipped browser script in a stubbed loader and return its factory.
 *
 * `stubs` is the icon set the current harness names; a client half resolves each glyph by its
 * current name with the legacy one as fallback, so a stub carrying one of the two is enough.
 */
export async function loadClient({ React, stubs = {} }) {
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
    // the sandbox's own — a `globalThis.fetch` set out here would never be seen from inside.
    fetch: (...args) => net.fetch(...args),
    console,
  }
  vm.createContext(sandbox)
  vm.runInContext(source, sandbox, { filename: 'lib/client.js' })
  if (!captured) throw new Error('lib/client.js never called window.__ModuleLoader__.load')
  const primitives = {
    // The pane's glyphs, named as the current core names them.
    IconFolderOpenRegular: (props) => React.createElement('svg', { 'data-stub-icon': 'folder', ...props }),
    IconLoadingOutlineRegular: (props) => React.createElement('svg', { 'data-stub-icon': 'loading', ...props }),
    IconPlusOutlineRegular: (props) => React.createElement('svg', { 'data-stub-icon': 'plus', ...props }),
    IconCloseOutlineRegular: (props) => React.createElement('svg', { 'data-stub-icon': 'close', ...props }),
    IconGridRegular: (props) => React.createElement('svg', { 'data-stub-icon': 'grid', ...props }),
    IconRowsRegular: (props) => React.createElement('svg', { 'data-stub-icon': 'rows', ...props }),
    IconWarningOutlineRegular: (props) => React.createElement('svg', { 'data-stub-icon': 'warning', ...props }),
    ...stubs,
  }
  const factory = captured.factory((spec) => {
    if (spec === 'react') return React
    if (spec === '@deepseek-ai/dsh-client-ui-primitives') return primitives
    throw new Error('unexpected require: ' + spec)
  })
  return { registration: captured, exports: factory, primitives, source }
}

/** The recording ctx the browser's own services stand in for. */
export function recordingCtx(locale = 'en') {
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

// ── the host half, against a recording server ───────────────────────────────

export function fakeServer() {
  const routes = []
  return {
    routes,
    register(entry) {
      routes.push(entry)
      return () => {}
    },
  }
}

/** A writable response: it collects bytes, so a streamed file is compared as bytes. */
export function fakeRes() {
  const chunks = []
  const res = new Writable({
    write(chunk, _encoding, done) {
      chunks.push(Buffer.from(chunk))
      done()
    },
  })
  res.statusCode = 0
  res.headers = {}
  res.setHeader = (name, value) => { res.headers[String(name).toLowerCase()] = value }
  res.bytes = () => Buffer.concat(chunks)
  res.text = () => Buffer.concat(chunks).toString('utf8')
  res.json = () => { try { return JSON.parse(res.text()) } catch { return null } }
  return res
}

export function fakeReq(method, path, body) {
  const req = Readable.from(body === undefined ? [] : [Buffer.from(typeof body === 'string' ? body : JSON.stringify(body))])
  req.method = method
  req.url = path
  return req
}

/** Call a route handler the way the web server does. */
export async function callRoute(handler, method, path, body) {
  const res = fakeRes()
  await handler(fakeReq(method, path, body), res)
  return res
}

/** Wait for a streamed response to finish, so its bytes are all there. */
export function waitForEnd(res) {
  return new Promise((resolve) => {
    if (res.writableEnded) {
      resolve()
      return
    }
    res.once('finish', resolve)
    res.once('close', resolve)
  })
}

/** `await` the microtask queue twice: enough for a stubbed fetch's promise chain to settle. */
export async function settle() {
  await new Promise((resolve) => setTimeout(resolve, 0))
  await new Promise((resolve) => setTimeout(resolve, 0))
}
