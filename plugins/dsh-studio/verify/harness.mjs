/**
 * Shared half of this plugin's browser suites — the same contract as
 * dsh-socialgrab's harness: `lib/client.js` is a loader script, so the suites run
 * it the way the page does. A stubbed `window.__ModuleLoader__`, a recording ctx,
 * and a React small enough to walk. Deliberately NOT React: anything it cannot
 * do fails loudly instead of rendering a stale tree.
 */
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

export const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))

// ── elements ─────────────────────────────────────────────────────────────────

let passes = 0

export function createElement(type, props, ...children) {
  return { type, props: { ...(props || {}), children: children.flat().filter((c) => c !== null && c !== undefined && c !== false) } }
}

/** The hookless React, for suites that walk a component's tree. */
export const React = { createElement }

/** The hooks-carrying instance, so walk-time expansion shares its hook slots. */
let activeHooks = null

/**
 * A tree node's own output: function components are elements whose type is a
 * function, so walking one means calling it. Pure children expand fine here;
 * hook-carrying components belong to `createReact().run`, not this walker.
 */
function expand(node) {
  if (node && typeof node === 'object' && typeof node.type === 'function') {
    const out = activeHooks
      ? activeHooks.renderChild(node.type, node.props || {})
      : node.type(node.props || {})
    return expand(out)
  }
  return node
}

/** Walk a tree collecting nodes the predicate answers for. */
export function collect(node, predicate, found = []) {
  node = expand(node)
  if (node === null || node === undefined || typeof node === 'boolean') return found
  if (Array.isArray(node)) {
    for (const child of node) collect(child, predicate, found)
    return found
  }
  if (typeof node === 'object') {
    if (predicate(node)) found.push(node)
    if (node.props && node.props.children) collect(node.props.children, predicate, found)
    return found
  }
  return found
}

/** The visible text of a tree, in order. */
export function textOf(node) {
  if (++passes > 5000) throw new Error('mini-react: walk loop')
  node = expand(node)
  if (node === null || node === undefined || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join('')
  if (node.props && node.props.children) return textOf(node.props.children)
  return ''
}

export function sameProps(a, b) {
  const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})])
  for (const key of keys) {
    if (key === 'children') continue
    if (JSON.stringify(a && a[key]) !== JSON.stringify(b && b[key])) return false
  }
  return true
}

// ── a hooks-carrying React, for the pane ─────────────────────────────────────

export function createReact() {
  // Hook state is keyed PER COMPONENT FUNCTION. A walk-time expansion
  // (collect/textOf) reuses the same slot as a full render, so state and
  // effects survive arbitrary walk order. A single global hook array silently
  // misfires: every extra expansion climbs the index and lands on a fresh
  // slice — empty state reads, effects re-queued forever.
  const slots = new Map()
  let current = null
  let render = () => {
    throw new Error('createReact: render not set')
  }
  const queue = []

  const slotFor = (component) => {
    let slot = slots.get(component)
    if (!slot) {
      slot = { hooks: [] }
      slots.set(component, slot)
    }
    return slot
  }

  const within = (component, fn) => {
    const slot = slotFor(component)
    const prev = current
    current = slot
    slot.index = 0
    try {
      return fn()
    } finally {
      current = prev
    }
  }

  const hookAt = (make) => {
    if (!current) throw new Error('mini-react: hook called outside a component')
    const i = current.index++
    if (i >= current.hooks.length) current.hooks.push(make())
    return current.hooks[i]
  }

  const React = {
    createElement,
    useState(initial) {
      const hook = hookAt(() => ({ kind: 'state', value: typeof initial === 'function' ? initial() : initial }))
      const set = (next) => {
        hook.value = typeof next === 'function' ? next(hook.value) : next
        hook.dirty = true // run() re-renders to a settled tree; no ad-hoc queue entry
      }
      return [hook.value, set]
    },
    useEffect(fn, deps) {
      const hook = hookAt(() => ({ kind: 'effect', deps: undefined }))
      const changed = !hook.deps || !deps || hook.deps.length !== deps.length || hook.deps.some((d, j) => d !== deps[j])
      if (changed) {
        hook.deps = deps
        queue.push(() => {
          const dispose = fn()
          if (typeof dispose === 'function') hook.dispose = dispose
        })
      }
    },
    useRef(initial) {
      return hookAt(() => ({ kind: 'ref', current: initial }))
    },
    useMemo(fn, deps) {
      const hook = hookAt(() => ({ kind: 'memo', deps: undefined }))
      if (!hook.deps || !deps || hook.deps.length !== deps.length || hook.deps.some((d, j) => d !== deps[j])) {
        hook.deps = deps
        hook.value = fn()
      }
      return hook.value
    },
    useCallback(fn, deps) {
      return React.useMemo(() => fn, deps)
    },
  }

  const clearDirty = () => {
    for (const slot of slots.values()) {
      for (const hook of slot.hooks) if (hook.kind === 'state') hook.dirty = false
    }
  }

  const instance = {
    React,
    /** Walk-time component invocation — the same hook slot as a full render. */
    renderChild(component, props) {
      return within(component, () => component(props))
    },
    run(component, props) {
      render = () => instance.run(component, props)
      const paint = () => {
        const tree = within(component, () => component(props || {}))
        clearDirty()
        return tree
      }
      let tree = paint()
      // Settle: effect jobs and state updates re-render until quiet, so what
      // run() RETURNS is the settled tree — a pane's boot fetch lands in it.
      for (let pass = 0; pass < 20; pass += 1) {
        const pending = queue.splice(0)
        let dirty = false
        for (const slot of slots.values()) {
          if (slot.hooks.some((hook) => hook.kind === 'state' && hook.dirty)) {
            dirty = true
            break
          }
        }
        if (pending.length === 0 && !dirty) break
        for (const job of pending) job()
        tree = paint()
      }
      return tree
    },
    flush() {
      const pending = queue.splice(0)
      for (const job of pending) job()
    },
  }
  activeHooks = instance
  return instance
}

// ── the loader ───────────────────────────────────────────────────────────────

export async function loadClient({ primitives = {}, routes = [], onRequire, react } = {}) {
  const source = await readFile(path.join(ROOT, 'lib/client.js'), 'utf8')
  let registration = null
  const calls = []
  const timers = []

  const fetchStub = async (url, options = {}) => {
    const call = {
      url: String(url),
      method: String((options && options.method) || 'GET').toUpperCase(),
      body:
        options && options.body
          ? typeof options.body === 'string'
            ? JSON.parse(options.body)
            : { raw: true, bytes: options.body.byteLength || options.body.length || 0 }
          : null,
    }
    calls.push(call)
    for (const route of routes) {
      if (call.url.startsWith(route.match)) {
        const answer = await route.respond(call)
        return {
          ok: answer.status === undefined ? true : answer.status < 400,
          status: answer.status === undefined ? 200 : answer.status,
          json: async () => answer.body,
        }
      }
    }
    throw new Error('no stubbed route for ' + call.url)
  }

  const sandbox = {
    window: { __ModuleLoader__: { load: (value) => { registration = value } } },
    console,
    fetch: fetchStub,
    setInterval: (fn) => timers.push(fn) - 1,
    clearInterval: (id) => { if (id !== undefined && id !== null) timers[id] = null },
    // A real tick, so `new Promise((r) => setTimeout(r, N))` resolves (poll
    // loops ride this); the timer is still recorded for explicit ticking.
    setTimeout: (fn) => {
      timers.push(fn)
      const real = setTimeout(fn, 0)
      if (real.unref) real.unref()
      return timers.length - 1
    },
    clearTimeout: (id) => {
      if (id !== undefined && id !== null) timers[id] = null
    },
  }
  vm.createContext(sandbox)
  vm.runInContext(source, sandbox, { filename: 'lib/client.js' })
  if (!registration) throw new Error('lib/client.js never called window.__ModuleLoader__.load')

  const exports_ = registration.factory((spec) => {
    if (onRequire) {
      const answered = onRequire(spec)
      if (answered !== undefined) return answered
    }
    if (spec === 'react') return react || createElement
    if (spec === '@deepseek-ai/dsh-client-ui-primitives') return primitives
    throw new Error('unexpected require: ' + spec)
  })
  return { registration, exports: exports_, calls, timers }
}

export function tick(timers) {
  for (const timer of [...timers]) {
    if (typeof timer === 'function') timer()
  }
}

/** Let queued promises settle (boot fetches, save PUTs), then flush the hook queue. */
export async function settle(instance, turns = 6) {
  if (instance && typeof instance.flush === 'function') instance.flush() // start queued effects
  for (let i = 0; i < turns; i += 1) await new Promise((resolve) => setImmediate(resolve))
  if (instance && typeof instance.flush === 'function') instance.flush() // run what they queued
}

// ── the registering context ──────────────────────────────────────────────────

export function recordingCtx(translations = {}) {
  const seen = { types: [], slots: [], effects: [] }
  const dictionaries = {}
  const ctx = {
    effect: (fn, label) => {
      seen.effects.push(String(label || ''))
      return fn()
    },
    slots: {
      inject: (name, fn) => fn(),
      register: (options, component) => {
        seen.slots.push({ options, component })
      },
    },
    locale: {
      register: (namespace, packs) => {
        dictionaries[namespace] = packs
      },
      bind: (namespace) => (key) =>
        (dictionaries[namespace] && dictionaries[namespace].en && dictionaries[namespace].en[key]) ||
        translations[key] ||
        key,
    },
    sidebarRightTabs: {
      register: (definition) => {
        seen.types.push(definition)
      },
    },
  }
  return { ctx, seen, dictionaries }
}
