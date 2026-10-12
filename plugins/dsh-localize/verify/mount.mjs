/**
 * verify:mount — epic 65 L2's claims about the bundle and the surfaces, asserted rather than intended.
 *
 * The claim: **`@muen/dsh-localize` makes the languages we own selectable, publishes the catalog where
 * a picker outside the page can read it, and draws no picker of its own.** The rules this file checks:
 *
 *   1. the bundle loads and exports an activation with the locale dependency, and it registers NO
 *      sidebar control — the language switch is the shell's account menu, and the harness's own
 *      Settings row is the fallback; a second control in the rail is the regression this guards;
 *   2. activation registers our own strings and offers the languages we own, and NOTHING here throws:
 *      a missing service, a partial one, or a second activation is reported, never fatal — this code
 *      runs during boot, where an exception is an app that does not start;
 *   3. the catalog is MIRRORED onto `<html data-muen-languages>` (the reader is `catalog.mjs`'s job,
 *      which loads this bundle with a document; here it is pinned as a contract);
 *   4. the four dictionaries carry the same keys, because a missing key renders as the key name;
 *   5. the review count (epic 65 §3) annotates the HARNESS's own Language row, in the active
 *      language, is kept to ONE note as the count changes, and is taken back down when the activation
 *      is disposed;
 *   6. the count rides the SAME response as the overlay map, so it costs no second request.
 *
 * The locale service under everything is the HARNESS'S OWN runtime, loaded from the installed bundle
 * (see `harness.mjs`), so the catalog this suite measures is a real one.
 *
 *   node verify/mount.mjs
 */
import { CLIENT, fakeScope, loadClient, loadLocaleRuntime, localeBundlePath, miniReact, mountCtx, primitivesStub, reporter } from './harness.mjs'

const { check, note, finish } = reporter('verify:mount', 'epic 65 L2 (the bundle and the surfaces)')

const oraclePath = localeBundlePath()
const mini = miniReact()
const ui = primitivesStub()
const client = loadClient(CLIENT, { react: mini.React, primitives: ui.primitives })

// ── 1. the bundle, and the control it must NOT draw ─────────────────────────

check('the bundle loads and exports an activation that depends on the locale service', typeof client.apply === 'function' && Array.isArray(client.inject) && client.inject.join(',') === 'locale', JSON.stringify({ apply: typeof client.apply, inject: client.inject }))
check(
  'and the globe is GONE from what the bundle ships — no seam, no action id, no component to mount',
  client.SEAM === undefined && client.ACTION_ID === undefined && client.ACTION_ORDER === undefined && client.makeGlobe === undefined && client.globeEnabled === undefined,
  JSON.stringify({ SEAM: client.SEAM, ACTION_ID: client.ACTION_ID, order: client.ACTION_ORDER, makeGlobe: typeof client.makeGlobe, globeEnabled: typeof client.globeEnabled }),
)

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
// THE REGRESSION GUARD. The founder's call was *"kill the globe icon in ui since we will use menu"*,
// and the failure mode is a second language control quietly coming back into the sidebar.
check(
  'and registers NO sidebar control at all: the switch is the account menu, not a rail action',
  mounted.registered.length === 0 && !mounted.injected.includes('sidebar.footer.action'),
  JSON.stringify({ registered: mounted.registered.map((row) => row.spec), injected: mounted.injected }),
)

{
  const again = mountCtx({ locale: watched.locale })
  const second = client.apply(again.ctx)
  check(
    'a SECOND activation is reported, not fatal: the runtime refuses a repeated pair and the app carries on',
    typeof second.dictionaries === 'string' && /already has locale/u.test(second.dictionaries) && second.languages.added.length === 0 && second.languages.kept.length === 5,
    JSON.stringify(second),
  )
  check('and it registers nothing either — a boot twice is still a boot with no globe', again.registered.length === 0, JSON.stringify(again.registered.map((row) => row.spec)))
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

// ── 3. the mirror, as a contract ─────────────────────────────────────────────
//
// The mirror is driven properly in `catalog.mjs` (which loads this bundle with a document). Here the
// point is only that activation reports it and that a page with NO document is not an error — this
// bundle is also loaded where there is no DOM, and a missing `document` must cost the mirror, not the boot.
check(
  'activation reports the mirror, and a page with no document is not an error',
  Array.isArray(report.published) && report.published.length === 0 && report.reviewNote !== null,
  JSON.stringify({ published: report.published, reviewNote: report.reviewNote }),
)

// ── 4. our own dictionaries ──────────────────────────────────────────────────

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
  // NO DEAD STRINGS: every key has a reader, so a key kept for a removed control is a defect here.
  const read = ['review.pending']
  check(
    'and the dictionary holds only keys something reads — no copy kept for a control that is gone',
    keys.join(',') === read.join(','),
    JSON.stringify({ keys, read }),
  )
}

// ── 5. the review count, annotated onto the HARNESS's Language row ───────────
//
// The globe used to carry this. With no globe there is still a to-do to show, and the harness's own
// Settings → General → Language row is the picker a person actually uses — so the note goes there.
// This runs the activation's own effect against a stub document rather than re-implementing the DOM
// walk, so what is measured is the shipped code path.
{
  /**
   * A page with one element that answers the Language row's selector.
   *
   * The note elements behave like DOM nodes where it matters to the plugin: `appendChild` records
   * `parentElement`, and `remove()` clears it and marks the node removed. A stub without those makes
   * the plugin's "is my note still on this row?" check answer no forever, and the suite then measures
   * duplicates instead of the feature.
   */
  function pageWithRow() {
    const notes = []
    const row = {
      dataset: {},
      appended: [],
      appendChild(child) {
        this.appended.push(child)
        child.parentElement = this
        notes.push(child)
      },
    }
    const wanted = `[data-slot="settings.general.item"] [data-settings-id="language"]`
    const element = {
      dataset: {},
      childNodes: [row],
      querySelector: (selector) => (selector === wanted ? row : null),
      appendChild() {},
    }
    const document = {
      documentElement: element,
      querySelectorAll: () => [],
      querySelector: (selector) => (selector === wanted ? row : null),
      createElement: () => {
        const node = {
          dataset: {},
          parentElement: null,
          removed: false,
          // `cssText` is here because that is how the note is styled and a real element supports it: a
          // stub without it turns "the note is styled" into "the note is unstyled", silently.
          style: { cssText: '' },
          setAttribute(name, value) { this[name] = value },
          remove() {
            this.removed = true
            this.parentElement = null
          },
        }
        return node
      },
      head: { append() {} },
      body: { childNodes: [] },
    }
    return { document, row, notes: row.appended }
  }

  // The page and its fetch. THE COUNT COMES FROM THE OVERLAY RESPONSE, which is the shipped path: an
  // earlier version of this block handed `mountCtx` an overlay service that activation never reads (the
  // plugin builds its own through `startOverlay`), so the note was never drawn and the checks passed
  // against nothing. Driving the fetch means what is measured is the real wiring.
  const { document, row } = pageWithRow()
  const counts = [3]
  const withPage = loadClient(CLIENT, {
    react: miniReact().React,
    primitives: primitivesStub().primitives,
    globals: {
      document,
      MutationObserver: undefined,
      fetch: async () => ({ ok: true, json: async () => ({ map: {}, review: { pending: counts[0], flagged: counts[0], unjudged: 0 } }) }),
    },
  })
  const scopeFor = fakeScope()
  const runtimeFor = watchedRuntime(scopeFor)
  const mountedFor = mountCtx({ locale: runtimeFor.locale })
  const offReport = withPage.apply(mountedFor.ctx)
  await offReport.__overlay.refresh()

  check(
    'the review count is annotated onto the harness Language row, and named by our own string',
    row.appended.length === 1 &&
      row.appended[0].textContent === '3' &&
      row.appended[0].title === withPage.DICT.en['review.pending'] &&
      row.appended[0]['aria-label'] === row.appended[0].title,
    JSON.stringify({ notes: row.appended.length, text: row.appended[0] && row.appended[0].textContent, title: row.appended[0] && row.appended[0].title }),
  )
  check(
    'it wears the app\'s own WARN state, because a review is a to-do and not an error',
    // NULL-SAFE: a wrong bundle has to FAIL here, not throw and hide every check after it.
    (row.appended[0] || {}).role === 'status' && /--dsw-alias-state-warn-primary/u.test((row.appended[0] || { style: {} }).style.cssText || ''),
    JSON.stringify(row.appended[0] ? row.appended[0].style : null),
  )
  check('and the count is mirrored onto the document element for anything that cannot see the row', document.documentElement.dataset.muenReviewPending === '3', JSON.stringify(document.documentElement.dataset))
  check('the report names where it went, so the suite is not guessing', offReport.reviewNote && offReport.reviewNote.slot === 'settings.general.item' && offReport.reviewNote.id === 'language', JSON.stringify(offReport.reviewNote))

  // THE COUNT FOLLOWS: a review recorded while the app is open moves the note without a reload.
  counts[0] = 5
  await offReport.__overlay.refresh()
  check(
    'a count that arrives LATER updates the ONE note — it listens rather than polling, and does not stack',
    row.appended.length === 1 && row.appended[0].textContent === '5',
    JSON.stringify(row.appended.map((noteEl) => noteEl.textContent)),
  )

  // DISPOSAL TAKES IT BACK DOWN: the row belongs to the harness, and this plugin may be removed.
  const disposer = mountedFor.effects.find((entry) => /review note/u.test(entry.label))
  check('the note is owned by an effect, so removing the plugin removes the note', !!disposer, JSON.stringify(mountedFor.effects.map((entry) => entry.label)))
  if (disposer) {
    for (const el of row.appended) el.remove = () => { el.removed = true }
    disposer.dispose()
    check(
      'and disposing the activation removes it from the row and drops the mirror',
      document.documentElement.dataset.muenReviewPending === undefined && row.appended.every((el) => el.removed === true),
      JSON.stringify({ mark: document.documentElement.dataset.muenReviewPending, removed: row.appended.map((el) => el.removed === true) }),
    )
  }
}

// ── 6. the count rides the overlay response ──────────────────────────────────

{
  // THE COUNT RIDES THE OVERLAY RESPONSE, so the note costs no second request.
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
  check('and it tells whoever is watching, which is what moves the note', seen.length >= 1 && seen[seen.length - 1].pending === 4, JSON.stringify(seen))
  const unwatch = overlay.onReview(() => {})
  check('a watcher can leave without disturbing the others', typeof unwatch === 'function' && unwatch() === true, 'no disposer')
}

note('oracle: ' + oraclePath)
finish()
