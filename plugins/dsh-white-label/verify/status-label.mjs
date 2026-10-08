/**
 * verify:status-label — the run-status label patch, asserted against BOTH
 * harness shapes.
 *
 *   "the brand's status label replaces the line the conversation shows while a
 *    turn runs" — README, and the field behind Settings → Brand → Status label.
 *
 * THE CLAIM THAT DROVE THIS SUITE: a saved label silently stopped applying after
 * the harness bump to dsh-client-ui-chat 0.2.x (measured 2026-10-08). The value
 * was saved; the DOM matcher was not: ui-chat moved the line out of the visible
 * `role="status"` row into `div[data-chat-running]`, changed the copy from
 * "Deep diving..." to "Deep diving" / "Deep diving for 12s ···" (duration IN the
 * string, rewritten every second by the run clock), and moved a second copy of
 * it into a `data-shimmer-text` ATTRIBUTE on the shimmer sweep. An exact-set
 * matcher keyed on the old string can never fire against that.
 *
 * THE REAL BUNDLE IS DRIVEN FOR REAL. `lib/client.js` runs in a vm sandbox with
 * a miniature DOM carrying both shapes, `apply()` mounts against a fake ctx
 * whose configForms scope delivers the brand document the way the settings
 * transport does, and every case below goes through applyStatusLabel() — no
 * internal is imported, so a refactor that breaks the seam breaks the suite.
 *
 *   node verify/status-label.mjs            all cases
 *   node verify/status-label.mjs --static   all cases (there is no live layer)
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')
const SOURCE = readFileSync(join(ROOT, 'lib/client.js'), 'utf8')

// ── reporter (the same shape as the other suites in muen-plugins) ────────────

const rows = []
const check = (label, ok, detail) =>
  rows.push({ label, status: ok ? 'pass' : 'fail', detail: detail == null ? '' : String(detail) })

function finish() {
  let failed = 0
  process.stdout.write('\nverify:status-label — the run-status label, both harness shapes\n')
  for (const row of rows) {
    if (row.status === 'pass') continue
    if (row.status === 'fail') failed += 1
    process.stdout.write('  FAIL  ' + row.label + (row.detail ? '  —  ' + row.detail : '\n'))
  }
  const passes = rows.filter((row) => row.status === 'pass').length
  process.stdout.write('  ' + passes + '/' + rows.length + ' passed\n')
  if (failed > 0) process.exitCode = 1
}

// ── miniature DOM: the two shapes the harness has shipped ────────────────────

/** Attribute-selector matcher for exactly the selectors the plugin uses. */
function matchesSel(el, sel) {
  const attrs = [...sel.matchAll(/\[([\w-]+)(?:="([^"]*)")?\]/g)]
  if (attrs.length === 0) return false
  return attrs.every(([, name, value]) => {
    if (!(name in el.attrs)) return false
    return value === undefined || el.attrs[name] === value
  })
}

function makeText(value) {
  return { nodeType: 3, nodeValue: value, parentNode: null }
}

function makeEl(tag, attrs = {}) {
  const el = {
    nodeType: 1,
    tagName: tag,
    attrs: { ...attrs },
    childNodes: [],
    parentNode: null,
    get firstChild() { return el.childNodes[0] ?? null },
    getAttribute(name) { return name in el.attrs ? el.attrs[name] : null },
    setAttribute(name, value) { el.attrs[name] = value },
    matches(sel) { return matchesSel(el, sel) },
    closest(sel) {
      for (let node = el; node && node.nodeType === 1; node = node.parentNode) {
        if (node.matches(sel)) return node
      }
      return null
    },
    querySelectorAll(sel) {
      const out = []
      const walk = (node) => {
        for (const child of node.childNodes) {
          if (child.nodeType !== 1) continue
          if (child.matches(sel)) out.push(child)
          walk(child)
        }
      }
      walk(el)
      return out
    },
  }
  return el
}

function append(parent, child) {
  child.parentNode = parent
  parent.childNodes.push(child)
  return child
}

/**
 * The OLD harness shape: one visible text node inside a single
 * `role="status"` / `aria-live="polite"` element, with the clock a sibling span
 * (dsh-client-ui-chat ≤0.1.x, and the conversation client of 0.1.1-rc.2).
 */
function mountOldRow(body, text) {
  const row = append(body, makeEl('div', { role: 'status', 'aria-live': 'polite' }))
  append(row, makeText(text))
  append(row, makeEl('span', { 'aria-hidden': 'true' }))  // the clock
  return row
}

/**
 * The NEW harness shape: `div[data-chat-running]` holding the visually-hidden
 * a11y status span, the visible TextShimmer label, and the sweep copy in a
 * `data-shimmer-text` attribute — dsh-client-ui-chat 0.2.1-alpha.1, trimmed to
 * the three carriers the plugin touches (the whale svg and divider are textless
 * and cannot change the outcome).
 */
function mountRunningBox(body, { a11y, visible, shimmer = visible }) {
  const box = append(body, makeEl('div', { 'data-chat-running': 'true' }))
  const status = append(box, makeEl('span', { role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' }))
  append(status, makeText(a11y))
  const content = append(box, makeEl('span', { class: 'content' }))
  const label = append(content, makeText(visible))
  const decoration = append(box, makeEl('span', { class: 'decoration', 'aria-hidden': 'true' }))
  const sweep = append(decoration, makeEl('span', { 'data-shimmer-text': shimmer }))
  return { box, status, label, sweep }
}

// ── sandbox: the real client bundle, the real apply(), fake transport ────────

function boot({ statusLabel, body }) {
  const observers = []
  class FakeMutationObserver {
    constructor(callback) {
      this.callback = callback
      this.observed = null
      observers.push(this)
    }
    observe(target) { this.observed = target }
    disconnect() { this.observed = null }
  }

  const document = {
    body,
    head: { appendChild() {} },
    querySelector() { return null },       // the style-tag guard: not present
    createElement() { return { dataset: {}, textContent: '' } },
    querySelectorAll(sel) { return body.querySelectorAll(sel) },
  }

  let snapshot = { statusLabel }
  const subscribers = []
  const scope = {
    getSnapshot: () => ({ status: 'ready', mode: 'host', writable: true, value: { ...snapshot } }),
    subscribe(fn) { subscribers.push(fn); return () => {} },
    set() { return Promise.resolve(true) },
  }

  const plugins = {}
  const sandbox = {
    window: {
      __ModuleLoader__: { load(module) { plugins[module.id] = module } },
      localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    document,
    MutationObserver: FakeMutationObserver,
    console,
  }

  vm.runInNewContext(SOURCE, sandbox, { filename: 'dsh-white-label/client.js' })
  const module = plugins['@muen/dsh-white-label']
  if (!module || typeof module.factory !== 'function') {
    throw new Error('client bundle did not register a factory')
  }

  // Only the three modules the factory binds. None renders in this suite, so a
  // stub that answers every property keeps definition-time code honest without
  // pulling React into a DOM-free test.
  const anyFn = new Proxy(function () {}, { get: () => anyFn, apply: () => anyFn })
  const react = new Proxy({}, { get: () => anyFn })
  const store = { defineStore: () => ({ sync() {} }) }
  const fakeRequire = (id) => {
    if (id === 'react') return react
    if (id === 'react/jsx-runtime') return react
    if (id === '@deepseek-ai/dsh-client-store') return store
    throw new Error('unexpected require: ' + id)
  }

  const plugin = module.factory(fakeRequire)
  const ctx = {
    get(name) {
      if (name === 'configForms') return { get: (ns) => (ns === 'white-label' ? scope : null) }
      if (name === 'locale') return { register() {}, bind: () => (key) => key }
      if (name === 'theme') return { overrideTokens: () => () => {} }
      return undefined
    },
    slots: { inject() {}, register() {} },
    inject() {},
    effect() {},
  }
  plugin.apply(ctx)

  return {
    observers,
    /** The settings transport delivering a new document — the real subscription path. */
    deliver(next) {
      snapshot = { ...snapshot, ...next }
      for (const fn of [...subscribers]) fn()
    },
  }
}

/** Fire the plugin's own observer callback the way the browser would. */
function notifyCharacter(sandboxObserver, textNode) {
  sandboxObserver.callback([{ type: 'characterData', target: textNode }])
}

// ── cases ────────────────────────────────────────────────────────────────────

const LABEL = 'Staring intently…'

// 1. OLD SHAPE, label set: the exact shipped copy is replaced, the clock is not.
{
  const body = makeEl('body')
  const row = mountOldRow(body, 'Deep diving...')
  boot({ statusLabel: LABEL, body })
  check('old shape: "Deep diving..." becomes the label', row.firstChild.nodeValue === LABEL,
    JSON.stringify(row.firstChild.nodeValue))
  check('old shape: the clock span is untouched', row.childNodes.length === 2 && row.childNodes[1].childNodes.length === 0)
}

// 2. OLD SHAPE, no label: nothing is written.
{
  const body = makeEl('body')
  const row = mountOldRow(body, 'Deep diving...')
  const run = boot({ statusLabel: '', body })
  check('old shape: a brand with no label writes nothing', row.firstChild.nodeValue === 'Deep diving...',
    JSON.stringify(row.firstChild.nodeValue))
  check('old shape: no label means no observer is installed', run.observers.length === 0)
}

// 3. NEW SHAPE, pre-first-tick: all three carriers — a11y span, visible label,
//    sweep attribute — take the label.
{
  const body = makeEl('body')
  const m = mountRunningBox(body, { a11y: 'Deep diving', visible: 'Deep diving' })
  boot({ statusLabel: LABEL, body })
  check('new shape: the visible label becomes the label', m.label.nodeValue === LABEL,
    JSON.stringify(m.label.nodeValue))
  check('new shape: the a11y status span becomes the label', m.status.firstChild.nodeValue === LABEL,
    JSON.stringify(m.status.firstChild.nodeValue))
  check('new shape: the shimmer sweep attribute becomes the label',
    m.sweep.getAttribute('data-shimmer-text') === LABEL, JSON.stringify(m.sweep.getAttribute('data-shimmer-text')))
}

// 4. NEW SHAPE, mid-run: the duration tail survives the rewrite.
{
  const body = makeEl('body')
  const m = mountRunningBox(body, {
    a11y: 'Deep diving',
    visible: 'Deep diving for 12s ···',
  })
  boot({ statusLabel: LABEL, body })
  check('new shape: "Deep diving for 12s ···" keeps the clock',
    m.label.nodeValue === LABEL + ' for 12s ···', JSON.stringify(m.label.nodeValue))
  check('new shape: the sweep attribute keeps the clock too',
    m.sweep.getAttribute('data-shimmer-text') === LABEL + ' for 12s ···',
    JSON.stringify(m.sweep.getAttribute('data-shimmer-text')))
}

// 5. THE TICK: React restores the shipped copy every second (the duration
//    changed), and the observer re-patches — this is the loop the old exact-set
//    matcher could never join.
{
  const body = makeEl('body')
  const m = mountRunningBox(body, { a11y: 'Deep diving', visible: 'Deep diving for 12s ···' })
  const run = boot({ statusLabel: LABEL, body })
  const observer = run.observers[0]
  // The run clock ticks: React rewrites the visible node with a NEW duration.
  m.label.nodeValue = 'Deep diving for 13s ···'
  notifyCharacter(observer, m.label)
  check('the tick: a re-rendered duration is re-patched with the new tail',
    m.label.nodeValue === LABEL + ' for 13s ···', JSON.stringify(m.label.nodeValue))
}

// 6. A FRESH BOX mid-turn: a childList mutation carrying a new running box is
//    patched without waiting for the next character tick.
{
  const body = makeEl('body')
  const run = boot({ statusLabel: LABEL, body })
  const observer = run.observers[0]
  const m = mountRunningBox(body, { a11y: 'Deep diving', visible: 'Deep diving for 4s ···' })
  observer.callback([{ type: 'childList', addedNodes: [m.box] }])
  check('a box mounted mid-turn is patched on arrival', m.label.nodeValue === LABEL + ' for 4s ···',
    JSON.stringify(m.label.nodeValue))
}

// 7. SOMEBODY ELSE'S LINE: inside the box or out of it, copy that does not
//    carry the shipped prefix is left exactly as it renders.
{
  const body = makeEl('body')
  const foreign = mountOldRow(body, 'Streaming results...')
  const box = append(body, makeEl('div', { 'data-chat-running': 'true' }))
  const other = append(append(box, makeEl('span')), makeText('Compiling tools'))
  const sweep = append(box, makeEl('span', { 'data-shimmer-text': 'Compiling tools' }))
  boot({ statusLabel: LABEL, body })
  check('a foreign status row is left alone', foreign.firstChild.nodeValue === 'Streaming results...',
    JSON.stringify(foreign.firstChild.nodeValue))
  check('a foreign label inside the box is left alone', other.nodeValue === 'Compiling tools',
    JSON.stringify(other.nodeValue))
  check('a foreign sweep attribute inside the box is left alone',
    sweep.getAttribute('data-shimmer-text') === 'Compiling tools')
}

// 8. THE ZH COPIES: both shapes, both phases.
{
  const body = makeEl('body')
  const row = mountOldRow(body, '深度求索中...')
  const m = mountRunningBox(body, { a11y: '深度求索中', visible: '深度求索中，用时 12s ···' })
  boot({ statusLabel: LABEL, body })
  check('zh old shape: "深度求索中..." becomes the label', row.firstChild.nodeValue === LABEL,
    JSON.stringify(row.firstChild.nodeValue))
  check('zh new shape: the duration form keeps its tail',
    m.label.nodeValue === LABEL + '，用时 12s ···', JSON.stringify(m.label.nodeValue))
}

// 9. CLEARING THE LABEL restores the shipped copy — the same subscription path
//    Settings → Brand uses when the field is emptied.
{
  const body = makeEl('body')
  const row = mountOldRow(body, 'Deep diving...')
  const m = mountRunningBox(body, { a11y: 'Deep diving', visible: 'Deep diving for 12s ···' })
  const run = boot({ statusLabel: LABEL, body })
  run.deliver({ statusLabel: '' })
  check('clearing the label restores the old-shape row', row.firstChild.nodeValue === 'Deep diving...',
    JSON.stringify(row.firstChild.nodeValue))
  check('clearing the label restores the visible label', m.label.nodeValue === 'Deep diving for 12s ···',
    JSON.stringify(m.label.nodeValue))
  check('clearing the label restores the sweep attribute',
    m.sweep.getAttribute('data-shimmer-text') === 'Deep diving for 12s ···')
  check('clearing the label disconnects the observer', run.observers.every((o) => o.observed === null))
}

// 10. THE SHIP GATE: the plugin still knows the copy the matcher was written
//     for, so a future trim cannot drop the old harness by accident.
{
  check('the old exact strings and the new prefixes are both declared',
    /SHIPPED_STATUS_TEXTS[\s\S]*Deep diving\.\.\./.test(SOURCE) &&
    /SHIPPED_STATUS_PREFIXES[\s\S]*Deep diving/.test(SOURCE) &&
    /RUNNING_SELECTOR\s*=\s*"\[data-chat-running\]"/.test(SOURCE))
}

finish()
