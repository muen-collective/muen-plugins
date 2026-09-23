/**
 * verify:saved — the confirmation a successful save owes, asserted rather than
 * intended.
 *
 *   "a save that worked opens a dialog saying the key was validated, that the
 *    wallet answered with the balance it read, and where that balance now lives"
 *    — what the founder asked for after the gap he hit on 2026-09-22: the key
 *    saved, the strip showed the account, and he missed it because he was looking
 *    at the control he had just used. His words for what was missing: "a
 *    confirmation dialog that shows API works, can pull wallet info and instruct
 *    user the wallet balance is top left of surface".
 *
 * THE SHIPPED COMPONENTS ARE DRIVEN FOR REAL. `lib/client.js` is loaded in the
 * same stubbed loader verify/mount.mjs uses, `apply(ctx)` runs, and the two
 * surfaces that own a key field — the pane and the `settings.section` page — are
 * rendered with the real dictionary against a stubbed `fetch`. React is stood in
 * for by a shim with working `useState` / `useCallback` / `useEffect`, because
 * this claim is about what happens *after* a click: an inert stub can render the
 * first frame and nothing else, which is exactly the frame that had no defect.
 *
 * WHAT THIS DOES NOT PROVE: that the bytes are on the running app. A linked
 * plugin's client bundle is served from the copy captured at activation, so this
 * fix reaches the page on the next app start, and the founder's own re-save is
 * the acceptance act. Nothing here spends coins or touches RunningHub.
 *
 *   node verify/save-confirmation.mjs
 *   node verify/save-confirmation.mjs --show   # print the dialog's lines, in order
 */
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')
const PKG_NAME = '@muen/dsh-runninghub'
const NS = 'generate'
const argv = process.argv.slice(2)
/** `--show` prints the dialog's own lines, in order, without restarting the app. */
const SHOW = argv.includes('--show')
let preview = []
const removePreview = []
const panePreview = []

// ── the reporter (same shape as the plugin's other two, so a green run reads as evidence) ──

const rows = []
const check = (label, ok, detail) => rows.push({ label, status: ok ? 'pass' : 'fail', detail: detail == null ? '' : String(detail) })
const note = (text) => rows.push({ label: text, status: 'note', detail: '' })

function finish() {
  let failed = 0
  process.stdout.write('\nverify:saved — Epic 61 S2 (a save that worked says so)\n')
  for (const row of rows) {
    if (row.status === 'pass') continue
    if (row.status === 'note') {
      process.stdout.write('  ....  ' + row.label + '\n')
      continue
    }
    failed += 1
    process.stdout.write('  FAIL  ' + row.label + (row.detail ? '  —  ' + row.detail : '') + '\n')
  }
  const passes = rows.filter((row) => row.status === 'pass').length
  const total = rows.filter((row) => row.status !== 'note').length
  process.stdout.write('  ' + passes + '/' + total + ' passed\n')
  if (failed > 0) process.exitCode = 1
}

// ── React, stood in for, with hooks that hold ────────────────────────────────
//
// Instance identity is the element's path in the tree, which is the same thing
// React's own positional reconciliation does with unkeyed children: a sibling
// appearing above a component moves it, and its state goes with the slot, not
// the component. That behaviour is the reason the confirmation lives on the
// surface rather than inside `KeyForm`, so the shim models it instead of hiding
// it.

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

const PRIMITIVES = {
  IconSparkle16: (props) => REACT.createElement('svg', { 'data-stub': 'sparkle', ...props }),
  IconWarningOutline16: (props) => REACT.createElement('svg', { 'data-stub': 'warning', ...props }),
  IconRightUpOutline16: (props) => REACT.createElement('svg', { 'data-stub': 'right-up', ...props }),
  IconRefreshOutline16: (props) => REACT.createElement('svg', { 'data-stub': 'refresh', ...props }),
  IconCheckOutline16: (props) => REACT.createElement('svg', { 'data-stub': 'check', ...props }),
  IconInfoOutline14: (props) => REACT.createElement('svg', { 'data-stub': 'info', ...props }),
  /**
   * The harness's dialog, stood in for. The real one portals to `document.body`
   * behind a mask; the property under test is what the dialog is asked to show
   * and what closing it does, so this renders the same props inline and drops
   * out of the tree when `open` is false. `closeLabel` and `onClose` are kept on
   * the node so the checks can read the contract the real component receives.
   */
  Modal: (props) =>
    props.open
      ? REACT.createElement(
          'div',
          {
            'data-stub': 'modal',
            role: 'dialog',
            'aria-label': props.title,
            closeLabel: props.closeLabel,
            onClose: props.onClose,
          },
          props.title,
          props.description,
          props.children,
          props.footer,
        )
      : null,
}

// ── the walker ───────────────────────────────────────────────────────────────

/** Render one element into a searchable tree: host nodes keep their props. */
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

/**
 * Render, then let effects and the promises they start settle. Async work is why
 * this cannot be one pass: the wallet read and the save both land on a later
 * microtask, each one a re-render.
 */
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
const firstOf = (tree, type) => nodesOf(tree).find((node) => node.type === type) || null
const textOf = (tree) => {
  if (tree === null) return []
  if (typeof tree === 'string') return [tree]
  if (Array.isArray(tree)) return tree.flatMap(textOf)
  return [tree.children.flatMap(textOf), tree.props && typeof tree.props.children === 'string' ? tree.props.children : []]
    .flat(2)
    .filter((part) => typeof part === 'string')
}
/** Each string once, in render order — what the eye reads down the dialog. */
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
/** The deepest host node whose own text carries every one of these strings. */
const blockWith = (tree, texts) => {
  const hits = nodesOf(tree).filter((node) => {
    const own = textOf(node).join(' ')
    return texts.every((text) => own.includes(text))
  })
  return hits.length ? hits[hits.length - 1] : null
}
/**
 * Whether one node carries both the sentence and the shipped info glyph. The
 * text's own deepest node is the span holding it, so the search is for the row
 * that contains the text *and* an info glyph under it — which is the note.
 */
const carriesInfoGlyph = (tree, text) =>
  nodesOf(tree).some((node) => {
    if (!textOf(node).join(' ').includes(text)) return false
    return nodesOf(node).some((child) => child.props && child.props['data-stub'] === 'info')
  })

// ── the shipped client half, loaded the way the browser loads it ─────────────

async function loadClient() {
  const source = await readFile(join(ROOT, 'lib/client.js'), 'utf8')
  let captured = null
  const sandbox = {
    window: { __ModuleLoader__: { load: (registration) => { captured = registration } } },
    console,
    // The components fetch from inside the sandbox's realm, so the stub has to be
    // reachable from there — resolved at call time, since each case swaps it.
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
  const seen = { slots: [], locales: [] }
  const dicts = new Map()
  const ctx = {
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
      bind: (ns) => {
        const table = dicts.get(ns) || {}
        const dict = table[locale] || table.en || {}
        return (key) => (Object.prototype.hasOwnProperty.call(dict, key) ? dict[key] : key)
      },
    },
    sidebarRightTabs: { register: () => () => {} },
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
  }
  return { ctx, seen }
}

// ── the stubbed wallet route ─────────────────────────────────────────────────

const ACCOUNT_URL = 'https://www.runninghub.ai/call-api/bill-task?tab=keys'
const UNLINKED = { linked: false, writable: true, source: null, account: null, error: null, accountUrl: ACCOUNT_URL }
// `source: 'file'` is the seam's own word for the store it manages, which is what
// the live route reports after a paste (read from the running app 2026-09-22).
const LINKED = { linked: true, writable: true, source: 'file', account: { coins: 8600, money: 27.473, currency: 'USD', running: 0 }, error: null, accountUrl: ACCOUNT_URL }
const REFUSED = { linked: false, writable: true, source: null, account: null, error: 'invalid-key', accountUrl: ACCOUNT_URL }

/**
 * A stub host. A route may name a `url` and is then matched exactly; one without a
 * url answers any call of its method, which is how the wallet routes are written
 * here (GET · POST · DELETE). The pane also reads the installed-workflow list, so a
 * case that renders the pane names that url or the read fails as "no stub".
 */
function stubFetch(routes) {
  const calls = []
  return {
    calls,
    fetch: async (url, init = {}) => {
      const method = (init.method || 'GET').toUpperCase()
      calls.push({ url, method, body: init.body })
      const route =
        routes.find((candidate) => candidate.url === url && candidate.method === method) ||
        routes.find((candidate) => candidate.url === undefined && candidate.method === method)
      if (!route) throw new Error('no stub for ' + method + ' ' + url)
      return { ok: route.ok !== false, status: route.status || (route.ok === false ? 400 : 200), json: async () => route.body }
    },
  }
}

/** What the installed-workflow list answers when a case is about the wallet. */
const NO_WORKFLOWS = { method: 'GET', url: '/plugins/generate/adapters', body: { entries: [], skipped: [] } }

// ── the cases ────────────────────────────────────────────────────────────────

const module = await loadClient()
const { ctx, seen } = recordingCtx('en')
const realFetch = globalThis.fetch
module.apply(ctx)

const copy = seen.locales.find((entry) => entry.ns === NS)
const EN = copy ? copy.table.en : {}
const ZH = copy ? copy.table.zh : {}
const pane = seen.slots.find((slot) => slot.options.name === 'sidebar.right.pane.tab')
const settings = seen.slots.find((slot) => slot.options.name === 'settings.section')
const t = ctx.locale.bind(NS)

check('the pane and the settings page both register', !!pane && !!settings, seen.slots.map((slot) => slot.options.name).join(', '))

if (pane && settings) {
  const render = async (component, routes, key, locale = t) => {
    const stub = stubFetch(routes)
    globalThis.fetch = stub.fetch
    const tree = await settle(component, { t: locale }, key)
    return { tree, stub }
  }
  const DIALOG_TITLE = EN['saved.title']
  check(
    'every line the dialog shows has copy in both languages',
    ['saved.title', 'saved.close', 'saved.intro', 'saved.keyOk', 'saved.walletOk', 'saved.walletOkBare', 'saved.where', 'saved.dismiss'].every(
      (key) => !!EN[key] && !!ZH[key],
    ),
    DIALOG_TITLE,
  )

  // 1. the pane: the first-run field, a save that works
  {
    const { tree } = await render(pane.component, [
      NO_WORKFLOWS,
      { method: 'GET', body: UNLINKED },
      { method: 'POST', body: LINKED },
    ], 'pane-linked')
    check(
      'the pane opens on the key field when nothing is linked',
      textOf(tree).join(' ').includes(EN['pane.first.title']),
      textOf(tree).join(' | ').slice(0, 120),
    )
    const input = firstOf(tree, 'input')
    const form = firstOf(tree, 'form')
    check('the field is there to type into', !!input && !!form, input && form ? 'field + form' : 'missing')
    if (input && form) {
      input.props.onChange({ target: { value: 'rh-a-key' } })
      const after = await settle(pane.component, { t }, 'pane-linked')
      const typed = firstOf(after, 'form')
      await typed.props.onSubmit({ preventDefault() {} })
      const saved = await settle(pane.component, { t }, 'pane-linked')
      const text = textOf(saved).join(' ')
      const modal = nodesOf(saved).find((node) => node.props && node.props['data-stub'] === 'modal')

      check('a save that worked opens the confirmation dialog', !!modal, modal ? 'dialog present' : 'no dialog: ' + text.slice(0, 160))
      if (modal) preview = linesOf(modal)
      check('the dialog is a dialog, with the title as its accessible name', !!modal && modal.props.role === 'dialog' && modal.props['aria-label'] === DIALOG_TITLE, modal && modal.props['aria-label'])
      check('the dialog says the key works', text.includes(EN['saved.keyOk']), text.slice(0, 220))
      check('the dialog says the wallet answered', text.includes(EN['saved.walletOk']), text.slice(0, 220))
      check('the dialog shows the balance it just read', text.includes('8,600') && text.includes('USD 27.473'), text.slice(0, 220))
      check(
        'the dialog tells the user where the balance went',
        text.includes(EN['saved.where']),
        text.slice(0, 260),
      )
      check(
        'each confirmed fact carries the shipped check glyph, not colour alone',
        !!modal && nodesOf(modal).filter((node) => node.props && node.props['data-stub'] === 'check').length >= 2,
        modal ? nodesOf(modal).filter((node) => node.props && node.props['data-stub'] === 'check').length + ' checks' : 'no dialog',
      )
      check(
        'the dialog is labelled for a screen reader and carries a close label',
        !!modal && typeof modal.props.closeLabel === 'string' && modal.props.closeLabel.length > 0 && typeof modal.props.onClose === 'function',
        modal && modal.props.closeLabel,
      )
      check('the balance still reads in the strip behind the dialog', text.includes('8,600'), text.slice(0, 200))
      check(
        'the pane leaves the first-run field behind once the key is stored',
        !firstOf(saved, 'input'),
        firstOf(saved, 'input') ? 'the field is still there' : 'no field in the linked view',
      )

      // dismissing is a real close, not just a hidden dialog
      const dismiss = nodesOf(saved).find((node) => node.props && node.props['data-generate-dismiss'] === 'yes')
      check('the dialog has its own dismiss action', !!dismiss && typeof dismiss.props.onClick === 'function', dismiss ? 'button present' : 'no dismiss button')
      if (dismiss) {
        dismiss.props.onClick()
        const closed = await settle(pane.component, { t }, 'pane-linked')
        check(
          'dismissing the dialog closes it',
          !nodesOf(closed).some((node) => node.props && node.props['data-stub'] === 'modal'),
          'the dialog is still open',
        )
        check(
          'the linked pane stays after the dialog closes',
          !!firstOf(closed, 'div') && textOf(closed).join(' ').includes(EN['pane.empty.title']),
          textOf(closed).join(' | ').slice(0, 160),
        )
      }
    }
  }

  // 2. the pane: a save that is refused confirms nothing
  {
    const { tree } = await render(pane.component, [
      NO_WORKFLOWS,
      { method: 'GET', body: UNLINKED },
      { method: 'POST', body: REFUSED, ok: false, status: 400 },
    ], 'pane-refused')
    const input = firstOf(tree, 'input')
    input.props.onChange({ target: { value: 'rh-a-bad-key' } })
    const typed = firstOf(await settle(pane.component, { t }, 'pane-refused'), 'form')
    await typed.props.onSubmit({ preventDefault() {} })
    const failed = await settle(pane.component, { t }, 'pane-refused')
    const text = textOf(failed).join(' ')
    check('a refused key opens no dialog', !nodesOf(failed).some((node) => node.props && node.props['data-stub'] === 'modal'), text.slice(0, 200))
    check('a refused key still fails at the field', text.includes(EN['error.invalidKey']), text.slice(0, 200))
  }

  // 3. the settings page: changing a key on a linked wallet
  {
    const { tree } = await render(settings.component, [
      { method: 'GET', body: LINKED },
      { method: 'POST', body: LINKED },
    ], 'settings-change')
    const input = firstOf(tree, 'input')
    check('the settings page offers the field for a linked wallet', !!input, textOf(tree).join(' | ').slice(0, 160))
    input.props.onChange({ target: { value: 'rh-a-second-key' } })
    const typed = firstOf(await settle(settings.component, { t }, 'settings-change'), 'form')
    await typed.props.onSubmit({ preventDefault() {} })
    const saved = await settle(settings.component, { t }, 'settings-change')
    const text = textOf(saved).join(' ')
    check('a key changed in Settings opens the dialog too', text.includes(DIALOG_TITLE) && text.includes(EN['saved.where']), text.slice(0, 220))
    const page = firstOf(saved, 'div')
    check('the settings page is still the linked page', !!page && page.props['data-generate-settings'] === 'linked', page && page.props['data-generate-settings'])
    check(
      'the settings field is emptied, so the key is not left on screen',
      (firstOf(saved, 'input') || { props: {} }).props.value === '',
      JSON.stringify((firstOf(saved, 'input') || { props: {} }).props.value),
    )

    // 4. a new keystroke makes the old confirmation stale
    const stale = firstOf(saved, 'input')
    stale.props.onChange({ target: { value: 'rh-a-third-key' } })
    const edited = await settle(settings.component, { t }, 'settings-change')
    check(
      'typing a new key takes the old dialog away',
      !nodesOf(edited).some((node) => node.props && node.props['data-stub'] === 'modal'),
      textOf(edited).join(' | ').slice(0, 160),
    )
  }

  // 5. the settings page: a wallet that cannot be written to offers no field at all
  {
    const { tree } = await render(settings.component, [{ method: 'GET', body: { ...LINKED, writable: false, source: 'env' } }], 'settings-readonly')
    const text = textOf(tree).join(' ')
    check('a read-only key shows the reason instead of a field', !firstOf(tree, 'input') && text.includes(EN['settings.readOnly']), text.slice(0, 200))
    check('a read-only key opens no dialog', !nodesOf(tree).some((node) => node.props && node.props['data-stub'] === 'modal'), text.slice(0, 200))
    check(
      'a read-only key cannot be removed from here either',
      !nodesOf(tree).some((node) => node.props && node.props['data-generate-remove'] === 'yes'),
      'an unremovable key must not offer the control',
    )
  }

  // 6. removing the key: rotation's other half, and the way back to a first-run field
  {
    const { tree, stub } = await render(settings.component, [
      { method: 'GET', body: LINKED },
      { method: 'DELETE', body: UNLINKED },
    ], 'settings-remove')
    check(
      'a linked wallet says the field replaces the stored key',
      textOf(tree).join(' ').includes(EN['wallet.replace.hint']),
      textOf(tree).join(' | ').slice(0, 180),
    )
    const remove = nodesOf(tree).find((node) => node.props && node.props['data-generate-remove'] === 'yes')
    check('a linked wallet offers removing the key', !!remove, remove ? 'control present' : 'no remove control')
    if (remove) {
      remove.props.onClick()
      const asked = await settle(settings.component, { t }, 'settings-remove')
      const asks = nodesOf(asked).some((node) => node.props && node.props['data-stub'] === 'modal')
      if (SHOW) {
        const askedModal = nodesOf(asked).find((node) => node.props && node.props['data-stub'] === 'modal')
        const askedButtons = askedModal
          ? nodesOf(askedModal)
              .filter((node) => node.type === 'button')
              .map((node) => linesOf(node).join(''))
          : []
        if (askedModal) removePreview.push({ label: 'the question', lines: linesOf(askedModal), buttons: askedButtons })
      }
      check('removing asks before deleting anything', asks, asks ? 'question shown' : 'it went straight through')
      check(
        'the question says the RunningHub key itself survives',
        textOf(asked).join(' ').includes(EN['remove.intro']),
        textOf(asked).join(' | ').slice(0, 200),
      )
      check(
        'nothing was deleted while the question was open',
        !stub.calls.some((call) => call.method === 'DELETE'),
        stub.calls.map((call) => call.method).join(','),
      )
      const confirm = nodesOf(asked).find((node) => node.props && node.props['data-generate-remove-confirm'] === 'yes')
      check('the question carries a destructive confirm action', !!confirm, confirm ? 'confirm present' : 'no confirm')
      if (confirm) {
        await confirm.props.onClick()
        const removed = await settle(settings.component, { t }, 'settings-remove')
        if (SHOW) {
          const removedModal = nodesOf(removed).find((node) => node.props && node.props['data-stub'] === 'modal')
          if (removedModal) removePreview.push({ label: 'the receipt', lines: linesOf(removedModal), buttons: [] })
        }
        check(
          'confirming is what deletes the key',
          stub.calls.some((call) => call.method === 'DELETE'),
          stub.calls.map((call) => call.method).join(','),
        )
        const text = textOf(removed).join(' ')
        check(
          'removal is confirmed as a receipt, in the same dialog',
          text.includes(EN['remove.doneTitle']) && text.includes(EN['remove.gone']),
          text.slice(0, 220),
        )
        check(
          'the page is back to its unlinked shape',
          (firstOf(removed, 'div') || { props: {} }).props['data-generate-settings'] === 'unlinked' && !!firstOf(removed, 'input'),
          text.slice(0, 160),
        )
        const done = nodesOf(removed).find((node) => node.props && node.props['data-generate-remove-done'] === 'yes')
        check('the receipt is dismissible', !!done, done ? 'dismiss present' : 'no dismiss')
        if (done) {
          done.props.onClick()
          const closed = await settle(settings.component, { t }, 'settings-remove')
          check(
            'dismissing the receipt leaves no dialog behind',
            !nodesOf(closed).some((node) => node.props && node.props['data-stub'] === 'modal'),
            'a dialog is still open',
          )
        }
      }
    }
  }

  // 7. declining the removal question leaves the key alone
  {
    const { tree, stub } = await render(settings.component, [
      { method: 'GET', body: LINKED },
      { method: 'DELETE', body: UNLINKED },
    ], 'settings-cancel-remove')
    const remove = nodesOf(tree).find((node) => node.props && node.props['data-generate-remove'] === 'yes')
    remove.props.onClick()
    const asked = await settle(settings.component, { t }, 'settings-cancel-remove')
    const buttons = nodesOf(asked).filter((node) => node.type === 'button')
    const cancel = buttons.find((node) => linesOf(node).join('') === EN['remove.cancel'])
    check(
      'the question can be declined',
      !!cancel,
      buttons.length ? buttons.map((node) => JSON.stringify(linesOf(node).join(''))).join(', ') : 'no buttons in the dialog',
    )
    if (cancel) {
      cancel.props.onClick()
      const back = await settle(settings.component, { t }, 'settings-cancel-remove')
      check(
        'declining closes the question and deletes nothing',
        !stub.calls.some((call) => call.method === 'DELETE') &&
          !nodesOf(back).some((node) => node.props && node.props['data-stub'] === 'modal'),
        stub.calls.map((call) => call.method).join(','),
      )
      check(
        'the wallet is still linked after declining',
        (firstOf(back, 'div') || { props: {} }).props['data-generate-settings'] === 'linked',
        textOf(back).join(' | ').slice(0, 160),
      )
    }
  }

  // 8. the strip says where the key really came from, in the seam's own vocabulary
  {
    const noteOf = (tree) => {
      const note = nodesOf(tree).find((node) => node.props && 'data-generate-source' in node.props)
      return note ? { source: note.props['data-generate-source'], text: linesOf(note).join(' ').trim() } : null
    }
    const sources = [
      {
        source: 'file',
        writable: true,
        want: EN['wallet.fromStore'],
        label: 'a key the harness stored reads as stored on this machine',
      },
      {
        source: 'user-env',
        writable: true,
        want: EN['wallet.fromEnvironment'],
        label: 'a key from a .env fallback reads as from the environment',
      },
      {
        source: 'env',
        writable: false,
        want: EN['settings.readOnly'],
        label: 'an inherited key reads as one this page cannot change',
      },
    ]
    for (const item of sources) {
      const { tree } = await render(
        settings.component,
        [{ method: 'GET', body: { ...LINKED, writable: item.writable, source: item.source } }],
        'settings-source-' + item.source,
      )
      const note = noteOf(tree)
      check(
        item.label,
        !!note && note.source === item.source && note.text === item.want,
        note ? JSON.stringify(note.text) : 'no strip note found',
      )
    }
    const unknown = await render(
      settings.component,
      [{ method: 'GET', body: { ...LINKED, source: 'mystery' } }],
      'settings-source-unknown',
    )
    const unknownNote = noteOf(unknown.tree)
    check(
      'an unrecognised source says nothing rather than guessing',
      !!unknownNote && unknownNote.text === '',
      unknownNote ? JSON.stringify(unknownNote.text) : 'no strip note found',
    )
  }

  // 9. the fresh-install flow names the page that owns the key
  //
  // The pane can link a key and cannot change or remove one; only Settings →
  // Generate can. A plugin cannot open Settings (no service and no event in the
  // client catalog carries it), so the pane has to say where to go — and these
  // checks are what keep the directions from quietly disappearing from the one
  // screen a fresh install lands on.
  {
    const fresh = await render(pane.component, [
      NO_WORKFLOWS,
      { method: 'GET', body: UNLINKED },
      { method: 'POST', body: LINKED },
    ], 'pane-guidance')
    const freshText = textOf(fresh.tree).join(' ')
    if (SHOW) panePreview.push({ label: 'a fresh install lands on this pane', lines: linesOf(fresh.tree) })
    check(
      'a fresh install can still link the key right here',
      !!firstOf(fresh.tree, 'input') && freshText.includes(EN['pane.first.body']),
      freshText.slice(0, 160),
    )
    check(
      'a fresh install is told where the key is managed',
      freshText.includes(EN['pane.first.manage']) && EN['pane.first.manage'].includes('Settings → Generate'),
      freshText.slice(0, 240),
    )
    check(
      'the fresh-install directions carry the shipped info glyph',
      carriesInfoGlyph(fresh.tree, EN['pane.first.manage']),
      'an unmarked sentence reads as one more instruction',
    )

    const linked = await render(pane.component, [NO_WORKFLOWS, { method: 'GET', body: LINKED }], 'pane-guidance-linked')
    const linkedText = textOf(linked.tree).join(' ')
    if (SHOW) panePreview.push({ label: 'once linked, the same pane', lines: linesOf(linked.tree) })
    check(
      'the linked pane repeats the directions, for the person coming back to rotate',
      linkedText.includes(EN['pane.linked.manage']) && EN['pane.linked.manage'].includes('Settings → Generate'),
      linkedText.slice(0, 240),
    )
    // The home screen's own block holds the directions, and the block does not
    // carry the wallet strip's balance: a note beside the strip is a different
    // claim, and anything looser passes when the note sits at the top of the pane,
    // because the pane root contains every text on it.
    const homeRoot = nodesOf(linked.tree).find((node) => node.props && node.props['data-generate-pane'] === 'home')
    const noteHolder = homeRoot
      ? homeRoot.children.find((child) => textOf(child).join(' ').includes(EN['pane.linked.manage']))
      : null
    check(
      'the linked directions sit in their own block below the screen they explain',
      !!noteHolder && textOf(noteHolder).join(' ').includes(EN['pane.add.hint']) && !textOf(noteHolder).join(' ').includes('8,600'),
      noteHolder ? textOf(noteHolder).join(' ').slice(0, 200) : 'no block holds the note',
    )
    check(
      'the linked directions carry the shipped info glyph',
      carriesInfoGlyph(linked.tree, EN['pane.linked.manage']),
      'an unmarked sentence reads as one more instruction',
    )
    check(
      'the notes come after the screen they explain, and the wallet strip comes first',
      (() => {
        if (!homeRoot) return false
        const inOrder = nodesOf(homeRoot)
        const stripAt = inOrder.findIndex((node) => node.props && node.props['data-generate-source'])
        const emptyAt = inOrder.findIndex((node) => node.props && node.props['data-generate-none'] === 'yes')
        const manageAt = inOrder.findIndex((node) => node.props && node.props['data-generate-manage-hint'] === 'yes')
        return stripAt !== -1 && emptyAt !== -1 && manageAt !== -1 && stripAt < emptyAt && emptyAt < manageAt
      })(),
      'strip · screen · notes is the order the pane owes',
    )
    check(
      'the directions name both halves of the path, not a vague place',
      EN['pane.first.manage'].includes('bottom of the left sidebar') &&
        EN['pane.linked.manage'].includes('bottom of the left sidebar'),
      EN['pane.linked.manage'],
    )

    // 9b. how an app gets added, on the screen that has nothing installed
    //
    // The pane cannot hand the job to the chat: a third-party client plugin cannot
    // put text into the composer and a slash command cannot start a turn (measured
    // 2026-09-22). So the one thing it can do is say what to ask for, and this is
    // the screen whose whole job is to be filled — the sentence has to be on it,
    // under the key directions, because linking a wallet and adding a workflow are
    // the two answers this pane owes a new install.
    {
      const noteAt = (tree, attr) => nodesOf(tree).findIndex((node) => node.props && node.props[attr] === 'yes')
      const noteOf = (tree, attr) => nodesOf(tree).find((node) => node.props && node.props[attr] === 'yes')

      check(
        'the trigger names the chat and the phrase the skill answers to',
        EN['pane.add.hint'].includes('in chat') &&
          EN['pane.add.hint'].includes('add this RunningHub workflow') &&
          EN['pane.add.hint'].includes('<app link>'),
        EN['pane.add.hint'],
      )
      check(
        'a fresh install is told how to add a workflow',
        freshText.includes(EN['pane.add.hint']),
        freshText.slice(0, 320),
      )
      check(
        'the add line carries the shipped info glyph too',
        carriesInfoGlyph(fresh.tree, EN['pane.add.hint']),
        'a bare sentence reads as one more instruction',
      )
      check(
        'on a fresh install the add line sits under the key directions',
        noteAt(fresh.tree, 'data-generate-manage-hint') !== -1 &&
          noteAt(fresh.tree, 'data-generate-manage-hint') < noteAt(fresh.tree, 'data-generate-add-hint'),
        'manage@' + noteAt(fresh.tree, 'data-generate-manage-hint') + ' add@' + noteAt(fresh.tree, 'data-generate-add-hint'),
      )
      check(
        'the linked pane says the same thing, in the same order',
        linkedText.includes(EN['pane.add.hint']) &&
          carriesInfoGlyph(linked.tree, EN['pane.add.hint']) &&
          noteAt(linked.tree, 'data-generate-manage-hint') < noteAt(linked.tree, 'data-generate-add-hint'),
        'manage@' + noteAt(linked.tree, 'data-generate-manage-hint') + ' add@' + noteAt(linked.tree, 'data-generate-add-hint'),
      )
      check(
        'the add note is read off its own node, not matched as a phrase',
        (() => {
          const freshNote = noteOf(fresh.tree, 'data-generate-add-hint')
          const linkedNote = noteOf(linked.tree, 'data-generate-add-hint')
          const freshLine = freshNote ? linesOf(freshNote).join(' ').trim() : ''
          const linkedLine = linkedNote ? linesOf(linkedNote).join(' ').trim() : ''
          return freshLine === EN['pane.add.hint'] && linkedLine === EN['pane.add.hint']
        })(),
        'the note node must carry the copy itself',
      )
      // Both notes belong to the home screen's own block, not to the pane root: the
      // strip's balance sits above them, and a note beside the strip is a different
      // claim.
      const bothNotes = homeRoot
        ? homeRoot.children.find((child) => textOf(child).join(' ').includes(EN['pane.add.hint']))
        : null
      const bothText = bothNotes ? textOf(bothNotes).join(' ') : ''
      check(
        'both notes live in one block of their own, with no balance in it',
        !!bothNotes &&
          bothText.includes(EN['pane.linked.manage']) &&
          bothText.includes(EN['pane.add.hint']) &&
          !bothText.includes('8,600'),
        bothNotes ? bothText.slice(0, 240) : 'no block carries both notes',
      )
    }
  }

  // 10. the copy is reached through the same path a language change takes
  {
    const { ctx: zhCtx, seen: zhSeen } = recordingCtx('zh')
    const zhModule = await loadClient()
    zhModule.apply(zhCtx)
    const zhCopy = zhSeen.locales.find((entry) => entry.ns === NS)
    const zhT = zhCtx.locale.bind(NS)
    const stub = stubFetch([{ method: 'GET', body: LINKED }, { method: 'POST', body: LINKED }])
    globalThis.fetch = stub.fetch
    const zhSettings = zhSeen.slots.find((slot) => slot.options.name === 'settings.section').component
    const tree = await settle(zhSettings, { t: zhT }, 'settings-zh')
    firstOf(tree, 'input').props.onChange({ target: { value: 'rh-zh-key' } })
    const typed = firstOf(await settle(zhSettings, { t: zhT }, 'settings-zh'), 'form')
    await typed.props.onSubmit({ preventDefault() {} })
    const saved = await settle(zhSettings, { t: zhT }, 'settings-zh')
    check(
      'the dialog follows the language in force',
      textOf(saved).join(' ').includes(zhCopy.table.zh['saved.title']) &&
        textOf(saved).join(' ').includes(zhCopy.table.zh['saved.where']),
      textOf(saved).join(' | ').slice(0, 200),
    )

    // The add trigger is the one sentence that must NOT be translated: it is the
    // phrase the skill answers to, so a localized version would be a sentence the
    // user types and nothing picks up.
    const zhStub = stubFetch([{ method: 'GET', body: UNLINKED }])
    globalThis.fetch = zhStub.fetch
    const zhPane = zhSeen.slots.find((slot) => slot.options.name === 'sidebar.right.pane.tab').component
    const zhFresh = nodesOf(await settle(zhPane, { t: zhT }, 'pane-zh'))
    const zhAdd = zhFresh.find((node) => node.props && node.props['data-generate-add-hint'] === 'yes')
    const zhLine = zhAdd ? linesOf(zhAdd).join(' ').trim() : ''
    check(
      'the zh pane carries the add line, with the trigger still in English',
      zhLine === zhCopy.table.zh['pane.add.hint'] && zhLine.includes('add this RunningHub workflow'),
      zhLine || 'no add note in the zh pane',
    )
  }
}

note('the running app still serves the bundle captured at activation — this reaches the page on the next app start')

if (SHOW && preview.length) {
  process.stdout.write('\nwhat the dialog says, top to bottom:\n')
  preview.forEach((line, index) => process.stdout.write('  ' + (index === 0 ? '# ' : '  ') + line + '\n'))
}
if (SHOW && removePreview.length) {
  process.stdout.write('\nremoving the key, in the same dialog:\n')
  for (const frame of removePreview) {
    process.stdout.write('  ' + frame.label + '\n')
    frame.lines.forEach((line, index) => process.stdout.write('    ' + (index === 0 ? '# ' : '  ') + line + '\n'))
    if (frame.buttons.length) process.stdout.write('    [ ' + frame.buttons.join(' ] [ ') + ' ]\n')
  }
}
if (SHOW && panePreview.length) {
  for (const frame of panePreview) {
    process.stdout.write('\n' + frame.label + ':\n')
    frame.lines.forEach((line) => process.stdout.write('  ' + line + '\n'))
  }
}

globalThis.fetch = realFetch
finish()
