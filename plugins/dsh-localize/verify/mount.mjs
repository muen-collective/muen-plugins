/**
 * verify:mount — epic 65 L2's claims about the bundle and the globe, asserted rather than intended.
 *
 * The claim: **`@muen/dsh-localize` installs the languages and puts a globe beside Settings, and the
 * globe lists the CATALOG rather than a list of its own.** The rules this file checks:
 *
 *   1. the bundle loads and registers one action at `sidebar.footer.action`, id `localize`, order 5;
 *   2. activation registers our own strings and offers the languages we own, and NOTHING here throws:
 *      a missing service, a partial one, or a second activation is reported, never fatal — this code
 *      runs during boot, where an exception is an app that does not start;
 *   3. the globe DRAWS the app's own `Menu` (this suite reads the element it returned, so what is
 *      asserted is exactly what the component asked the primitive to draw);
 *   4. the rows are the CATALOG — every language the runtime lists, with the runtime's labels — and a
 *      language added to the catalog AFTER activation appears with no code change here;
 *   5. the active language is marked by the menu's own selected state, and the trigger's copy comes
 *      from our dictionaries in the ACTIVE language (not in English, not from a raw key);
 *   6. choosing a row IS `locale.setLocale(id)`, which is what makes the choice durable;
 *   7. the four dictionaries carry the same keys, because a missing key renders as the key name.
 *
 * The locale service under the globe is the HARNESS'S OWN runtime, loaded from the installed bundle
 * (see `harness.mjs`), so the catalog the globe lists is a real one.
 *
 *   node verify/mount.mjs
 */
import { CLIENT, fakeScope, loadClient, loadLocaleRuntime, localeBundlePath, miniReact, mountCtx, primitivesStub, reporter } from './harness.mjs'

const { check, note, finish } = reporter('verify:mount', 'epic 65 L2 (the bundle and the globe)')

const oraclePath = localeBundlePath()
const mini = miniReact()
const ui = primitivesStub()
const client = loadClient(CLIENT, { react: mini.React, primitives: ui.primitives })

// ── 1. the bundle ────────────────────────────────────────────────────────────

check('the bundle loads and exports an activation with the slots dependency', typeof client.apply === 'function' && Array.isArray(client.inject) && client.inject.includes('slots'), JSON.stringify({ apply: typeof client.apply, inject: client.inject }))
check('and it names itself in one place: a namespace, a seam, an action id and an order', client.NS === 'dsh-localize' && client.SEAM === 'sidebar.footer.action' && client.ACTION_ID === 'localize' && client.ACTION_ORDER === 5, JSON.stringify({ NS: client.NS, SEAM: client.SEAM, id: client.ACTION_ID, order: client.ACTION_ORDER }))

if (oraclePath === null) {
  note('the harness locale bundle was not found, so the mount checks that need a real service are skipped (set DSH_CLIENT_LOCALE)')
  finish()
  process.exit(0)
}

const { make } = loadLocaleRuntime(oraclePath)

/** The real runtime with `setLocale` recorded, so the suite can see the choice being made. */
function watchedRuntime(scope) {
  const runtime = make(scope)
  const chosen = []
  const locale = new Proxy(runtime, {
    get(target, prop) {
      if (prop === 'setLocale') return (id) => { chosen.push(id); return target.setLocale(id) }
      const value = target[prop]
      return typeof value === 'function' ? value.bind(target) : value
    },
  })
  return { runtime, locale, chosen }
}

// ── 2. activation ────────────────────────────────────────────────────────────

const scope = fakeScope()
const watched = watchedRuntime(scope)
const mounted = mountCtx({ locale: watched.locale })
const report = client.apply(mounted.ctx)

check('activation registers our strings for every language we catalog', Array.isArray(report.dictionaries) && report.dictionaries.join(',') === 'en,zh,ko,ja', JSON.stringify(report.dictionaries))
check('and offers the languages we own to the shared catalog', !!report.languages && report.languages.added.join(',') === 'ko,ja,fr,de,es' && report.languages.refused.length === 0, JSON.stringify(report.languages))
check(
  'the globe is registered at the sidebar foot, beside Settings, as order 5',
  mounted.injected.includes('sidebar.footer.action') &&
    mounted.registered.length === 1 &&
    mounted.registered[0].spec.name === 'sidebar.footer.action' &&
    mounted.registered[0].spec.id === 'localize' &&
    mounted.registered[0].spec.order === 5,
  JSON.stringify(mounted.registered.map((row) => row.spec)),
)

{
  const again = mountCtx({ locale: watched.locale })
  const second = client.apply(again.ctx)
  check(
    'a SECOND activation is reported, not fatal: the runtime refuses a repeated pair and the app carries on',
    typeof second.dictionaries === 'string' && /already has locale/u.test(second.dictionaries) && second.languages.added.length === 0 && second.languages.kept.length === 5,
    JSON.stringify(second),
  )
  check('and it still puts the globe up, because a boot twice is a boot that has to work', again.registered.length === 1, JSON.stringify(again.registered.map((row) => row.spec)))
}

{
  const partial = mountCtx({ locale: { register: () => {} } })
  let threw = null
  try {
    client.apply(partial.ctx)
  } catch (error) {
    threw = String((error && error.message) || error)
  }
  check('a service that cannot list languages is tolerated, not thrown at', threw === null, threw || 'no throw')
  const bare = mountCtx({ locale: undefined })
  let bareThrew = null
  try {
    client.apply(bare.ctx)
  } catch (error) {
    bareThrew = String((error && error.message) || error)
  }
  check('and so is a context with no locale service at all', bareThrew === null, bareThrew || 'no throw')
}

// ── 3. the globe ─────────────────────────────────────────────────────────────

const entry = mounted.registered[0]
/** One render of the registered component, the way the slot registry calls it. It answers the
 *  element the component asked the app's `Menu` to draw, so every assertion below reads the real
 *  request rather than a re-implementation of it. */
function render(props = {}) {
  mini.reset()
  return entry.component(props)
}
const rowIds = (tree) => (tree.props.items || []).filter((row) => row.type === undefined).map((row) => row.id)
const catalogIds = () => watched.runtime.getSnapshot().locales.map((row) => row.id)

let tree = render({ wide: false })
check('the globe draws the harness\'s own Menu, opened above the trigger', tree && tree.type === ui.primitives.Menu && tree.props.side === 'top' && tree.props.align === 'start', JSON.stringify({ type: tree && typeof tree.type, side: tree && tree.props.side }))
const anchor = tree.props.anchor
check(
  'and its trigger is a button drawing the app\'s own globe glyph plus the short code',
  anchor &&
    anchor.type === 'button' &&
    // NULL CHILDREN ARE SKIPPED BY REACT, and this tree keeps them: a conditional child that renders
    // nothing is a `null` here, so the count is of what actually draws.
    (anchor.children || []).filter(Boolean).length === 2 &&
    (anchor.children.filter(Boolean)[0] || {}).type === ui.primitives.IconGlobeOutlineRegular &&
    (anchor.children.filter(Boolean)[1] || {}).children[0] === 'EN',
  JSON.stringify({ drawn: (anchor.children || []).filter(Boolean).map((child) => child.type) }),
)
check(
  'the trigger is a menu control named by our own dictionary',
  anchor.props['aria-haspopup'] === 'menu' && anchor.props['aria-expanded'] === 'false' && anchor.props['aria-label'] === 'Change language' && anchor.props.title === 'Language',
  JSON.stringify({ haspopup: anchor.props['aria-haspopup'], label: anchor.props['aria-label'], title: anchor.props.title }),
)

// ── 4. the rows are the catalog ──────────────────────────────────────────────

check(
  'the rows ARE the catalog: every language the runtime lists, in its order',
  rowIds(tree).join(',') === catalogIds().join(','),
  JSON.stringify({ rows: rowIds(tree), catalog: catalogIds() }),
)
// Every read below is NULL-SAFE ON PURPOSE: a suite that throws on a wrong bundle stops at the
// first defect and hides the rest, so a missing row has to be a FAIL like any other.
const itemsOf = (node) => (node && node.props && Array.isArray(node.props.items) ? node.props.items : [])
const rowFor = (node, id) => itemsOf(node).find((row) => row && row.id === id) || null
check(
  'with the runtime\'s own labels, so a person reads their language in that language',
  itemsOf(tree).filter((row) => row && row.type === undefined).length === catalogIds().length &&
    itemsOf(tree).filter((row) => row && row.type === undefined).every((row) => {
      const found = watched.runtime.getSnapshot().locales.find((language) => language.id === row.id)
      return !!found && row.label === found.label
    }) &&
    !!rowFor(tree, 'ko') &&
    rowFor(tree, 'ko').label === '한국어',
  JSON.stringify(itemsOf(tree)),
)
check(
  'and the heading is ours, in the active language',
  itemsOf(tree)[0] && itemsOf(tree)[0].type === 'label' && itemsOf(tree)[0].text === 'Language',
  JSON.stringify(itemsOf(tree)[0] || null),
)
check(
  'the active language is marked by the menu\'s own selected state, not by copy we would have to translate',
  tree.props.selectedId === 'en' && !itemsOf(tree).some((row) => row && typeof row.label === 'string' && /current/u.test(row.label)),
  JSON.stringify({ selectedId: tree.props.selectedId }),
)
check('and the trigger is the only place that carries the code, so a row is a language and nothing else', anchor.props['data-localize-globe'] === 'en' && (tree.props.items || []).every((row) => typeof row.label !== 'string' || !/^[A-Z]{2}$/u.test(row.label)), JSON.stringify(anchor.props['data-localize-globe']))

// A LANGUAGE ADDED AFTER ACTIVATION APPEARS: the list is read per render, never captured.
{
  watched.runtime.addLanguage({ id: 'pt', label: 'Português', fallback: 'en' })
  tree = render({})
  check(
    'a language added to the catalog AFTER activation appears in the menu with no code change here',
    rowIds(tree).includes('pt') && rowIds(tree).join(',') === catalogIds().join(','),
    JSON.stringify({ rows: rowIds(tree) }),
  )
}

// ── 5. choosing a language ───────────────────────────────────────────────────

{
  const before = tree.props.open
  tree.props.onSelect('ko')
  tree = render({})
  check('choosing a row switches the locale through the service', watched.chosen.join(',') === 'ko' && watched.runtime.getSnapshot().active === 'ko', JSON.stringify({ chosen: watched.chosen, active: watched.runtime.getSnapshot().active }))
  check(
    'and the choice is written through the durable scope, which is how it survives a restart',
    scope.state.value && scope.state.value.preference === 'ko',
    JSON.stringify(scope.state.value),
  )
  check(
    'the globe then shows the new language, and the trigger copy is OURS in that language',
    tree.props.anchor.props['data-localize-globe'] === 'ko' && tree.props.anchor.props['aria-label'] === '언어 변경' && tree.props.anchor.props.title === '언어',
    JSON.stringify({ globe: tree.props.anchor.props['data-localize-globe'], label: tree.props.anchor.props['aria-label'], title: tree.props.anchor.props.title }),
  )
  check('and the rows still are the catalog after the switch', rowIds(tree).join(',') === catalogIds().join(','), JSON.stringify(rowIds(tree)))
  check('the menu starts closed and a choice closes it (the owner decides, and this one decides yes)', before === false && tree.props.open === false, JSON.stringify({ before, after: tree.props.open }))
}

// ── 6. our own dictionaries ──────────────────────────────────────────────────

{
  const keys = Object.keys(client.DICT.en)
  check(
    'every language we register carries the SAME keys, because a missing key renders as the key name',
    ['zh', 'ko', 'ja'].every((id) => {
      const entries = Object.keys(client.DICT[id] || {})
      return entries.length === keys.length && keys.every((key) => entries.includes(key))
    }) && keys.every((key) => String(client.DICT.en[key]).trim() !== ''),
    JSON.stringify(Object.fromEntries(Object.entries(client.DICT).map(([id, entries]) => [id, Object.keys(entries)]))),
  )
  check(
    'and every value is translated rather than copied from English',
    ['zh', 'ko', 'ja'].every((id) => keys.every((key) => client.DICT[id][key] !== client.DICT.en[key])),
    JSON.stringify(client.DICT),
  )
  check('the catalog is data: five languages we own, with en and zh left to the runtime', client.LANGUAGES.map((row) => row.id).join(',') === 'ko,ja,fr,de,es' && client.BUILT_IN.join(',') === 'en,zh' && !client.owned('en') && client.owned('ja'), JSON.stringify(client.LANGUAGES.map((row) => row.id)))
  // THE TRIGGER TOGGLES: pressing it opens the menu, which is what a footer action is for.
  tree.props.anchor.props.onClick()
  tree = render({})
  check('the trigger opens the menu, and the app can close it again', tree.props.open === true && typeof tree.props.onClose === 'function', JSON.stringify({ open: tree.props.open }))
}

// ── 7. the review mark (epic 65 §3) ──────────────────────────────────────────

{
  const globeWith = (pendingCount) => {
    let watcher = null
    const overlay = {
      review: () => ({ pending: pendingCount, flagged: pendingCount, unjudged: 0 }),
      onReview: (fn) => {
        watcher = fn
        return () => {
          watcher = null
        }
      },
    }
    const Globe = client.makeGlobe(watched.locale, overlay)
    // CLEARED, not just rewound: the mini React keeps hook slots in call order, and two component
    // instances rendered through the same stub would otherwise share them (`pending` from the last
    // globe would decide this one's mark — which is what the first version of these checks measured).
    mini.clear()
    const el = Globe({})
    // EFFECTS ARE RECORDED, NOT RUN, by the mini React: the subscription to the review count is an
    // effect, and a suite that never runs it measures a globe that never listens.
    mini.runEffects()
    return {
      el,
      notify: (next) => watcher && watcher(next),
      // The same instance rendered again, which is what a React re-render does.
      renderAgain: () => {
        mini.reset()
        return Globe({})
      },
    }
  }

  const quiet = globeWith(0)
  const drawn = (tree) => (tree.props.anchor.children || []).filter(Boolean)
  check(
    'with nothing waiting, the globe draws no mark — a mark that is always on says nothing',
    drawn(quiet.el).length === 2 && !drawn(quiet.el).some((child) => child.props && child.props['data-localize-review']),
    JSON.stringify(drawn(quiet.el).map((child) => child.type)),
  )

  const waiting = globeWith(3)
  const mark = drawn(waiting.el).find((child) => child.props && child.props['data-localize-review'] === 'pending')
  check(
    'and with translations waiting it draws one subtle mark, carrying the count',
    drawn(waiting.el).length === 3 && !!mark && mark.props['data-localize-review-count'] === '3',
    JSON.stringify(drawn(waiting.el).map((child) => (child.props || {})['data-localize-review'] || child.type)),
  )
  check(
    'the mark wears the app\'s own WARN state, because a review is a to-do and not an error',
    !!mark && /--dsw-alias-state-warn-primary/u.test(mark.props.style.background) && mark.props.style.borderRadius === '50%',
    JSON.stringify(mark && mark.props.style),
  )
  // IN THE ACTIVE LANGUAGE: an earlier check in this file switched the app to Korean, and the mark is
  // ours — so it reads Korean, which is the point rather than an accident.
  const activeLang = watched.runtime.getSnapshot().active
  check(
    'and it says what it is, in the ACTIVE language, rather than being a mystery dot',
    !!mark &&
      mark.props.role === 'status' &&
      mark.props.title === client.DICT[activeLang]['review.pending'] &&
      mark.props['aria-label'] === mark.props.title &&
      mark.props.title !== 'review.pending',
    JSON.stringify({ active: activeLang, title: mark && mark.props.title, wanted: client.DICT[activeLang]['review.pending'] }),
  )
  check(
    'the trigger stays a menu control with the mark on it — the mark is not a second button',
    waiting.el.props.anchor.type === 'button' && waiting.el.props.anchor.props['aria-haspopup'] === 'menu',
    JSON.stringify(waiting.el.props.anchor.props['aria-haspopup']),
  )

  // THE MARK FOLLOWS THE COUNT: a review recorded while the app is open moves it without a reload.
  const moving = globeWith(0)
  check('a quiet globe has no mark to start with', !drawn(moving.el).some((child) => child.props && child.props['data-localize-review']), 'mark already drawn')
  moving.notify({ pending: 2 })
  const after = moving.renderAgain()
  check(
    'and a count that ARRIVES LATER draws it — the globe listens rather than polling',
    drawn(after).some((child) => child.props && child.props['data-localize-review-count'] === '2'),
    JSON.stringify(drawn(after).map((child) => (child.props || {})['data-localize-review-count'] || child.type)),
  )
}

{
  // THE COUNT RIDES THE OVERLAY RESPONSE, so the mark costs no second request.
  const node = { nodeType: 3, nodeValue: 'Save' }
  const body = { nodeType: 1, childNodes: [node] }
  const wired = loadClient(CLIENT, {
    react: miniReact().React,
    primitives: primitivesStub().primitives,
    globals: {
      document: { body },
      fetch: async () => ({ ok: true, json: async () => ({ map: { Save: '저장' }, review: { pending: 4, flagged: 1, unjudged: 3 } }) }),
      MutationObserver: undefined,
    },
  })
  const overlay = wired.startOverlay({ getSnapshot: () => ({ active: 'ko' }) })
  const seen = []
  overlay.onReview((next) => seen.push(next))
  await overlay.refresh()
  check(
    'the overlay reads the review count from the same response as the map',
    overlay.review().pending === 4 && overlay.review().flagged === 1 && node.nodeValue === '저장',
    JSON.stringify({ review: overlay.review(), node: node.nodeValue }),
  )
  check('and it tells whoever is watching, which is what moves the globe', seen.length >= 1 && seen[seen.length - 1].pending === 4, JSON.stringify(seen))
  const unwatch = overlay.onReview(() => {})
  check('a watcher can leave without disturbing the others', typeof unwatch === 'function' && unwatch() === true, 'no disposer')
}

note('oracle: ' + oraclePath)
finish()
