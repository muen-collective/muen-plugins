// @muen/dsh-localize — browser half (epic 65 L2).
//
// ONE PLUGIN FOR LANGUAGE (founder, 2026-09-26: epic 65 rebuilds the retired language-switcher and
// the withdrawn ko/ja pack as this one package). What it does here, and why each piece is here:
//
//   the catalog   THE LANGUAGES WE OWN, offered to the harness's shared catalog. `locale.register`
//                 stores strings and does NOT make a language selectable; the picker lists the
//                 catalog, and the catalog is filled by `addLanguage` — measured in the shipped
//                 `@deepseek-ai/dsh-client-locale` (0.1.7-rc.1), which seeds `zh` and `en` only and
//                 throws on a taken id or a fallback that is not registered yet. A dictionary for a
//                 language nobody added is dead weight; that is the trap the reverted first attempt
//                 fell into, and this module is defensive because of it.
//   the globe     THE SECOND CONTROL, at `sidebar.footer.action` (order 5, beside Settings). It lists
//                 the CATALOG rather than a hardcoded list, and choosing a row is `locale.setLocale`,
//                 which persists through the harness's own preference scope — so the choice survives
//                 an app restart.
//
// THE SETTINGS ROW IS NOT OURS. The harness's locale plugin already draws Settings → General →
// Language (it registers `settings.general.item` with id `language`, order 0, and drives the row's
// options from the same catalog), so a second language row from us would be two rows listing the
// same six languages. What this plugin contributes to that page is the LANGUAGES themselves; the
// globe is the control the app does not have. Measured 2026-09-26 in the installed harness and in
// the profile's carrier (`dsh-multi-lang-ui` registers 29 namespaces × 8 languages and never calls
// `addLanguage`, and registers no slot at all).
//
// ONE FILE, BECAUSE A BUNDLE CANNOT REQUIRE ITS OWN SIBLINGS. `window.__ModuleLoader__` resolves by
// registered module id (the `dsh.client.inject` graph), not by relative path — every plugin's client
// is one self-contained script by design — so the catalog module lives here, where the locale
// service it talks to lives too, and `verify/catalog.mjs` drives THIS file rather than a copy of it.
//
// Loader format: one self-contained script registered via window.__ModuleLoader__.
window.__ModuleLoader__.load({
  id: '@muen/dsh-localize',
  factory: (require) => {
    const React = require('react')
    const h = React.createElement
    const primitives = require('@deepseek-ai/dsh-client-ui-primitives')
    const { Menu } = primitives
    /** The globe glyph by its current name, falling back to the pre-0.1.7 one. */
    const GlobeGlyph = primitives.IconGlobeOutlineRegular || primitives.IconGlobeOutline

    /** This plugin's namespace: its own strings, in the languages it catalogs. */
    const NS = 'dsh-localize'
    /** Where the globe lives: the sidebar foot, beside Settings. */
    const SEAM = 'sidebar.footer.action'
    const ACTION_ID = 'localize'
    const ACTION_ORDER = 5

    /**
     * OUR OWN COPY, in every language we catalog. `locale.register(NS, dicts)` takes an object of
     * locale → entries, and the four dictionaries carry the SAME KEYS — a missing key falls back
     * through `en` and then renders the key name itself, which is the failure a coverage check
     * exists to catch (epic 65 L3). `zh` and `ko`/`ja` are drafted here; the review gate is L5.
     */
    const DICT = {
      en: { 'globe.aria': 'Change language', 'globe.title': 'Language', 'menu.title': 'Language' },
      zh: { 'globe.aria': '切换语言', 'globe.title': '语言', 'menu.title': '语言' },
      ko: { 'globe.aria': '언어 변경', 'globe.title': '언어', 'menu.title': '언어' },
      ja: { 'globe.aria': '言語を変更', 'globe.title': '言語', 'menu.title': '言語' },
    }

    // ── the catalog ────────────────────────────────────────────────────────────
    //
    // See the module header: this is the single implementation, and the suite drives it from here.

    /** Accepted BCP 47-style ids — the same shape the runtime validates against. */
    const ID_PATTERN = /^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/u

    /**
     * THE LANGUAGES WE OWN, and the fallback each one degrades to.
     *
     * `label` is SELF-DESCRIBED — a person looking for their own language reads it in that language
     * (`한국어`, not "Korean"). `reviewed` says whether a native speaker has signed the translations
     * off (epic 65 §7.1: catalog all six so a French user can pick French; review ko/ja). It is data
     * about the TRANSLATION's state, never about whether the language may be chosen — hiding an
     * unreviewed language would take the choice away from the person whose language it is.
     */
    const LANGUAGES = Object.freeze([
      Object.freeze({ id: 'ko', label: '한국어', fallback: 'en', reviewed: true }),
      Object.freeze({ id: 'ja', label: '日本語', fallback: 'en', reviewed: true }),
      Object.freeze({ id: 'fr', label: 'Français', fallback: 'en', reviewed: false }),
      Object.freeze({ id: 'de', label: 'Deutsch', fallback: 'en', reviewed: false }),
      Object.freeze({ id: 'es', label: 'Español', fallback: 'en', reviewed: false }),
    ])

    /** The ids the runtime carries itself; a row naming one of these is kept, never re-registered. */
    const BUILT_IN = Object.freeze(['en', 'zh'])

    /** Lower-cased id of every language the service currently lists. */
    function catalogued(service) {
      try {
        const snapshot = service.getLocale()
        const locales = snapshot && Array.isArray(snapshot.locales) ? snapshot.locales : []
        return new Set(locales.map((row) => String(row && row.id).toLowerCase()))
      } catch {
        // A service that cannot answer has nothing to keep — the add calls then answer for themselves.
        return new Set()
      }
    }

    /** Why one row cannot be offered, or `null` when it can. */
    function refuseReason(row, known) {
      if (row === null || typeof row !== 'object') return 'not-a-row'
      if (typeof row.id !== 'string' || !ID_PATTERN.test(row.id)) return 'bad-id'
      if (typeof row.label !== 'string' || row.label.trim() === '') return 'bad-label'
      if (typeof row.fallback !== 'string' || row.fallback.trim() === '') return 'bad-fallback'
      if (!known.has(row.fallback.toLowerCase())) return 'unknown-fallback'
      return null
    }

    /**
     * Offer every language the service does not already list.
     *
     * Answers `{ added, kept, refused, catalog }`. Nothing here throws: a language that cannot be
     * added is a line in a report and the ones that can be are added, because one bad row must not
     * cost a person the rest of the picker — an activation-time throw is a broken app.
     */
    function installLanguages(service, languages = LANGUAGES) {
      const added = []
      const kept = []
      const refused = []
      const known = catalogued(service)
      // The ids this TABLE has already offered. A repeat is our own data error, refused rather than
      // folded into `kept`: keeping it would hide a typo behind the service's silence.
      const offered = new Set()

      for (const row of languages) {
        const id = row && typeof row.id === 'string' ? row.id : null
        const reason = refuseReason(row, known)
        if (reason !== null) {
          refused.push({ id, reason })
          continue
        }
        if (offered.has(id.toLowerCase())) {
          refused.push({ id, reason: 'duplicate-row' })
          continue
        }
        if (known.has(id.toLowerCase())) {
          offered.add(id.toLowerCase())
          kept.push(id)
          continue
        }
        try {
          service.addLanguage({ id: row.id, label: row.label, fallback: row.fallback })
          known.add(id.toLowerCase())
          offered.add(id.toLowerCase())
          added.push(id)
        } catch (error) {
          // The service is the authority on what it will take; its own words are the reason.
          refused.push({ id, reason: String((error && error.message) || error) })
        }
      }

      return { added, kept, refused, catalog: [...known] }
    }

    /** True when a language id is one this table owns (so a caller can tell ours from the runtime's). */
    function owned(id) {
      return LANGUAGES.some((row) => row.id.toLowerCase() === String(id).toLowerCase())
    }

    // ── the overlay on the rendered tree (epic 65 L4) ──────────────────────────
    //
    // The resolution rule lives HERE rather than in the host's store module, because this is where it
    // is used and a bundle cannot require its sibling (see the note at the top of this file).

    /** The route the host serves the maps on. */
    const OVERLAY_API = '/plugins/localize/overlay'

    /** The text node type, spelled out because this walk must work on any tree-shaped object. */
    const TEXT_NODE = 3

    /**
     * RESOLVE ONE RENDERED STRING. The exact source wins; there is no partial matching, because a
     * half-matched sentence is how an overlay produces nonsense. A string with no translation is
     * returned UNCHANGED — the English fallback, never blank and never a raw key.
     */
    function resolveOverlay(map, source) {
      if (typeof source !== 'string' || source === '') return source
      const direct = map[source]
      if (typeof direct === 'string' && direct !== '') return direct
      // A rendered node keeps its surrounding whitespace; the map is keyed by the trimmed string.
      const trimmed = source.trim()
      const spaced = map[trimmed]
      if (typeof spaced === 'string' && spaced !== '') {
        const lead = source.slice(0, source.indexOf(trimmed))
        const tail = source.slice(source.indexOf(trimmed) + trimmed.length)
        return lead + spaced + tail
      }
      return source
    }

    /**
     * Every text node under a root, in document order.
     *
     * A hand-rolled walk over `childNodes` rather than `document.createTreeWalker`, because this has to
     * be exercisable on a plain object: the suite builds a tree by hand, and a walk that needs a real
     * DOM could only be checked by eye.
     */
    function textNodesUnder(root, out = []) {
      if (root === null || typeof root !== 'object') return out
      if (root.nodeType === TEXT_NODE) {
        out.push(root)
        return out
      }
      const children = root.childNodes
      if (children === null || typeof children !== 'object' || typeof children.length !== 'number') return out
      for (let index = 0; index < children.length; index += 1) textNodesUnder(children[index], out)
      return out
    }

    /**
     * THE OVERLAY ITSELF, and the property that makes it safe to switch language: `apply` RESOLVES
     * AGAINST THE TEXT IT FIRST SAW, never against what it last wrote. A second language therefore
     * lands on the English original even if nobody called `restore` — translation is not cumulative,
     * and a screen cannot decay into a language-of-a-language. (`restore` is still the way back: it is
     * what puts the DOM in its own words again, for a language with no overlay or for teardown.)
     */
    function makeOverlay() {
      const originals = new WeakMap()
      let last = 0
      return {
        apply(root, map) {
          if (root === null || root === undefined || map === null || typeof map !== 'object') return 0
          let changed = 0
          for (const node of textNodesUnder(root)) {
            const current = node.nodeValue
            if (typeof current !== 'string') continue
            if (!originals.has(node)) originals.set(node, current)
            const next = resolveOverlay(map, originals.get(node))
            if (next !== current) {
              node.nodeValue = next
              changed += 1
            }
          }
          last = changed
          return changed
        },
        restore(root) {
          let back = 0
          for (const node of textNodesUnder(root)) {
            if (!originals.has(node)) continue
            const source = originals.get(node)
            if (node.nodeValue !== source) {
              node.nodeValue = source
              back += 1
            }
          }
          return back
        },
        changed: () => last,
      }
    }

    /**
     * WIRE IT UP: fetch the merged map for the active language, restore, apply — and re-apply on
     * mutations with the map already in hand, so a late-rendered string is translated WITHOUT another
     * request. Everything is guarded: no `document` (a test host), no `fetch`, or no map is a no-op,
     * never an exception during activation.
     */
    function startOverlay(locale) {
      const overlay = makeOverlay()
      let current = {}
      const draw = () => {
        if (typeof document === 'undefined' || !document.body) return 0
        return overlay.apply(document.body, current)
      }
      const refresh = async () => {
        if (typeof fetch !== 'function' || typeof document === 'undefined' || !document.body) return 0
        const active = locale && typeof locale.getSnapshot === 'function' ? locale.getSnapshot().active || 'en' : 'en'
        try {
          const answer = await fetch(OVERLAY_API + '?lang=' + encodeURIComponent(active))
          if (!answer || !answer.ok) return 0
          const body = await answer.json()
          current = body && body.map && typeof body.map === 'object' ? body.map : {}
        } catch {
          current = {}
        }
        overlay.restore(document.body)
        return draw()
      }
      if (typeof MutationObserver === 'function' && typeof document !== 'undefined' && document.body) {
        try {
          const observer = new MutationObserver(() => {
            draw()
          })
          observer.observe(document.body, { childList: true, subtree: true, characterData: true })
        } catch {
          // an observer that cannot be installed costs late text, not the boot
        }
      }
      refresh()
      return { refresh, draw, overlay }
    }

    // ── the globe ──────────────────────────────────────────────────────────────

    /**
     * THE LANGUAGE SURFACE (epic 65 §3, layer 1). A globe at the sidebar foot that opens the whole
     * catalog and switches to the chosen language.
     *
     * THE LIST IS THE CATALOG, never a constant: every row is a language the harness will actually
     * accept, drawn with the label that language calls itself, and the active one is marked by the
     * menu's own selected state rather than by copy we would have to translate. The glyph and the
     * menu are the app's own primitives — a trigger the app can focus, a list it can walk with Tab
     * and Escape — so this control behaves like every other one in the shell.
     */
    function makeGlobe(locale) {
      return function GlobeAction(props) {
        const wide = props && props.wide === true
        const t = typeof locale.bind === 'function' ? locale.bind(NS) : (key) => key
        const state = React.useSyncExternalStore(
          (notify) => (locale && typeof locale.subscribe === 'function' ? locale.subscribe(notify) : () => {}),
          () => (locale && typeof locale.getSnapshot === 'function' ? locale.getSnapshot() : { active: '', locales: [], revision: -1 }),
          () => ({ active: '', locales: [], revision: -1 }),
        )
        const [open, setOpen] = React.useState(false)
        const active = (state && state.active) || ''
        const locales = (state && Array.isArray(state.locales) ? state.locales : []).filter((row) => row && typeof row.id === 'string')
        const items = [{ type: 'label', id: 'heading', text: t('menu.title') }].concat(
          locales.map((row) => ({ id: row.id, label: row.label || row.id })),
        )

        return h(Menu, {
          open,
          side: 'top',
          align: 'start',
          items,
          selectedId: active,
          onSelect: (id) => {
            setOpen(false)
            if (locale && typeof locale.setLocale === 'function') locale.setLocale(id)
          },
          onClose: () => setOpen(false),
          anchor: h(
            'button',
            {
              type: 'button',
              'data-localize-globe': active || 'none',
              'aria-label': t('globe.aria'),
              title: t('globe.title'),
              'aria-haspopup': 'menu',
              'aria-expanded': open ? 'true' : 'false',
              onClick: () => setOpen((value) => !value),
              style: {
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                cursor: 'pointer',
                background: 'transparent',
                border: 'none',
                color: 'var(--dsw-alias-label-primary)',
                padding: wide ? '0 6px' : 0,
                font: 'inherit',
                fontSize: 12,
                lineHeight: 1,
              },
            },
            GlobeGlyph ? h(GlobeGlyph, { size: 16 }) : null,
            h(
              'span',
              { style: { fontWeight: 600, letterSpacing: '0.04em' } },
              (active || 'en').toUpperCase(),
            ),
          ),
        })
      }
    }

    // ── activation ─────────────────────────────────────────────────────────────

    /**
     * Register our own strings, offer our languages, and put the globe at the sidebar foot.
     *
     * Every step is guarded and reported rather than thrown: this runs during activation, and an
     * exception here is an app that does not start. The returned report is the seam the suites read
     * — the mount suite asserts on it, and the catalog suite calls `installLanguages` directly.
     */
    function apply(ctx) {
      const locale = typeof ctx.get === 'function' ? ctx.get('locale') : undefined
      const report = { dictionaries: null, languages: null, globe: null }

      if (locale && typeof locale.register === 'function') {
        try {
          locale.register(NS, DICT)
          report.dictionaries = Object.keys(DICT)
        } catch (error) {
          // A second activation is the one thing that throws here: the pairs are already registered.
          report.dictionaries = String((error && error.message) || error)
        }
      }

      if (locale && typeof locale.addLanguage === 'function' && typeof locale.getLocale === 'function') {
        report.languages = installLanguages(locale)
      }

      // THE OVERLAY, and its subscription: a language change re-reads the map for the new language.
      try {
        const overlay = startOverlay(locale)
        report.overlay = { started: true }
        if (locale && typeof locale.subscribe === 'function') {
          const subscribe = () => locale.subscribe(() => {
            overlay.refresh()
          })
          if (typeof ctx.effect === 'function') ctx.effect(subscribe, 'localize: overlay language')
          else subscribe()
        }
      } catch (error) {
        report.overlay = { started: false, error: String((error && error.message) || error) }
      }

      const slots = typeof ctx.get === 'function' ? ctx.get('slots') : undefined
      if (slots && typeof slots.inject === 'function' && typeof slots.register === 'function') {
        const Globe = makeGlobe(locale)
        slots.inject(SEAM, () => slots.register({ name: SEAM, id: ACTION_ID, order: ACTION_ORDER }, Globe))
        report.globe = { seam: SEAM, id: ACTION_ID, order: ACTION_ORDER }
      }

      return report
    }

    return {
      inject: ['slots'],
      apply,
      // The seams the suites drive (deliberate, like the assets plugin's zoom logic): the catalog is
      // tested against the harness's own runtime, and the globe is mounted with a stub ctx.
      NS,
      DICT,
      ID_PATTERN,
      SEAM,
      OVERLAY_API,
      resolveOverlay,
      textNodesUnder,
      makeOverlay,
      startOverlay,
      ACTION_ID,
      ACTION_ORDER,
      LANGUAGES,
      BUILT_IN,
      installLanguages,
      catalogued,
      owned,
      makeGlobe,
    }
  },
})
