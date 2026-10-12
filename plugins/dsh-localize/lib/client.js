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
//   the mirror    THE CATALOG, mirrored onto `<html data-muen-languages>` for the one picker that is
//                 outside this page: the shell's account menu, which is DOM injected from the main
//                 process and holds no locale service. Written on activation, refreshed on every
//                 locale change, removed on disposal.
//   the note      THE REVIEW COUNT (epic 65 §3), annotated onto the harness's own Language row. A
//                 count is a to-do, not a preference, so it lives with the picker rather than in a
//                 control of its own.
//
// THIS PLUGIN DRAWS NO PICKER (founder, 2026-10-12: *"kill the globe icon in ui since we will use
// menu"*). It used to draw a globe at `sidebar.footer.action`; that is gone. The switchers are the
// account menu (above) and the harness's own Settings row, which we only add languages to.
//
// THE SETTINGS ROW IS NOT OURS. The harness's locale plugin already draws Settings → General →
// Language (it registers `settings.general.item` with id `language`, order 0, and drives the row's
// options from the same catalog), so a row from us would be two rows listing the same six languages.
// What this plugin contributes to that page is the LANGUAGES themselves — and the review count.
// Measured 2026-09-26 in the installed harness and in the profile's carrier (`dsh-multi-lang-ui`
// registers 29 namespaces × 8 languages and never calls `addLanguage`, and registers no slot at all).
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

    /** This plugin's namespace: its own strings, in the languages it catalogs. */
    const NS = 'dsh-localize'

    /**
     * The settings row the harness's own locale plugin draws (Settings → General → Language). It is the
     * picker this plugin ADDS LANGUAGES TO, and where its "some translations need review" note goes —
     * this plugin draws no picker of its own (see activation).
     */
    const LANGUAGE_ROW_SLOT = 'settings.general.item'
    const LANGUAGE_ROW_ID = 'language'

    /**
     * OUR OWN COPY, in every language we catalog. `locale.register(NS, dicts)` takes an object of
     * locale → entries, and the four dictionaries carry the SAME KEYS — a missing key falls back
     * through `en` and then renders the key name itself, which is the failure a coverage check
     * exists to catch (epic 65 L3). `zh` and `ko`/`ja` are drafted here; the review gate is L5.
     */
    const DICT = {
      en: { 'review.pending': 'Some translations need review' },
      zh: { 'review.pending': '有翻译需要审阅' },
      ko: { 'review.pending': '검토가 필요한 번역이 있습니다' },
      ja: { 'review.pending': 'レビューが必要な翻訳があります' },
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

    /**
     * Where the page mirrors the selectable languages, for surfaces OUTSIDE this plugin.
     *
     * Every picker inside the page reads the catalog through the locale service, and a plugin is the
     * only thing that can hold that service. The shell's account row cannot: it is DOM the shell
     * injects with no bundle of its own, and it used to carry a hardcoded `en`/`zh` pair. Those are
     * exactly the two the harness ships, so the one person this hurts is a Korean, Japanese, French,
     * German or Spanish reader — the languages this plugin exists to add.
     *
     * So the catalog is mirrored onto the document element as
     * `<html data-muen-languages="[{\"id\":\"ko\",\"label\":\"한국어\"},…]">`, in the runtime's own
     * order, rewritten whenever the catalog moves and REMOVED on disposal: a profile without this
     * plugin must not keep advertising its languages.
     */
    const CATALOG_ATTR = 'muenLanguages'

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

    // ── the catalog mirror (the shell's language menu reads this) ──────────────

    /**
     * The rows a picker draws, in the runtime's own order: `{ id, label }` and nothing else.
     *
     * The runtime's snapshot also carries revisions and fallbacks; a menu needs two fields per row,
     * and copying more of the runtime's shape into an attribute would make this mirror a schema we
     * then have to keep in step. A row missing either field is dropped rather than drawn blank.
     */
    function catalogRows(service) {
      try {
        const snapshot = service && typeof service.getLocale === 'function' ? service.getLocale() : null
        const locales = snapshot && Array.isArray(snapshot.locales) ? snapshot.locales : []
        return locales
          .filter((row) => row && typeof row.id === 'string' && row.id !== '' && typeof row.label === 'string' && row.label !== '')
          .map((row) => ({ id: row.id, label: row.label }))
      } catch {
        return []
      }
    }

    /**
     * Write the mirror. Answers the rows written, or `[]` when there is nowhere to write or nothing
     * to write — never throws, because this runs during activation and inside a change subscription.
     */
    function publishCatalog(service) {
      const rows = catalogRows(service)
      if (rows.length === 0) return []
      try {
        const root = typeof document !== 'undefined' ? document.documentElement : null
        if (!root || !root.dataset) return []
        root.dataset[CATALOG_ATTR] = JSON.stringify(rows)
        return rows
      } catch {
        return []
      }
    }

    /** Take the mirror down. */
    function clearCatalog() {
      try {
        const root = typeof document !== 'undefined' ? document.documentElement : null
        if (root && root.dataset) delete root.dataset[CATALOG_ATTR]
      } catch {
        // Nothing to undo.
      }
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
    /**
     * THE MAP'S ANSWER FOR ONE STRING, or `undefined` when it has none.
     *
     * Separate from `resolveOverlay` because "the map has no entry" and "the entry is the source"
     * read as the same string but are NOT the same decision. The walk may only WRITE a node the map
     * answers for; writing the source back over an unanswered node is what froze every live text
     * node in the app - a composer kept the first character of a draft and silently dropped the
     * rest, because the walk restored the value it had memorised before the keystroke.
     */
    function translate(map, source) {
      if (typeof source !== 'string' || source === '') return undefined
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
      return undefined
    }

    function resolveOverlay(map, source) {
      const hit = translate(map, source)
      return hit === undefined ? source : hit
    }

    /**
     * True when the DOM inside `node` belongs to an EDITOR rather than to us: a form field, or any
     * contenteditable host and its descendants.
     *
     * A rich-text composer (Lexical, in this shell) OWNS its subtree - it reads that DOM back on every
     * keystroke and reconciles it against its own state, so a text node we rewrite inside it is a
     * draft we have corrupted. The overlay translates RENDERED copy, so these subtrees are stepped
     * over rather than walked.
     */
    function ownsItsText(node) {
      if (node === null || typeof node !== 'object' || node.nodeType !== 1) return false
      const tag = typeof node.tagName === 'string' ? node.tagName.toLowerCase() : ''
      if (tag === 'input' || tag === 'textarea') return true
      return node.isContentEditable === true
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
      if (ownsItsText(root)) return out
      const children = root.childNodes
      if (children === null || typeof children !== 'object' || typeof children.length !== 'number') return out
      for (let index = 0; index < children.length; index += 1) textNodesUnder(children[index], out)
      return out
    }

    /**
     * THE OVERLAY ITSELF - the rule that makes it safe to run this over a LIVE tree.
     *
     * A node is resolved against the text it says RIGHT NOW, and the walk writes only what the map
     * answers for. Two consequences, and both are the difference between a translator and a freeze:
     *
     *   - a node with no entry is left alone; if it changed since we memorised it (an editor
     *     inserting a character, a counter ticking, a live status) the text it shows now becomes what
     *     we memorise. The overlay never restores a stale value over its owner's own text;
     *   - a node we DID translate still resolves from the English source, never from our own
     *     translation, so a second language lands on the original even if nobody called `restore` -
     *     translation is not cumulative, and a screen cannot decay into a language-of-a-language.
     *     (`restore` is still the way back: it is what puts the DOM in its own words again, for a
     *     language with no overlay or for teardown.)
     */
    function makeOverlay() {
      const originals = new WeakMap()
      const written = new WeakMap()
      let last = 0
      return {
        apply(root, map) {
          if (root === null || root === undefined || map === null || typeof map !== 'object') return 0
          let changed = 0
          for (const node of textNodesUnder(root)) {
            const current = node.nodeValue
            if (typeof current !== 'string') continue
            // What the node says in the language we translate FROM: what we memorised, unless it has
            // moved. Moved away from what WE last wrote means its owner re-rendered it - a node that
            // is not ours is adopted, never overwritten.
            let source = originals.has(node) ? originals.get(node) : current
            if (source !== current && written.get(node) !== current) {
              source = current
              written.delete(node)
            }
            originals.set(node, source)
            const hit = translate(map, source)
            if (hit === undefined || hit === current) continue
            node.nodeValue = hit
            written.set(node, hit)
            changed += 1
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
      let review = { pending: 0, flagged: 0, unjudged: 0 }
      const watchers = new Set()
      const refresh = async () => {
        if (typeof fetch !== 'function' || typeof document === 'undefined' || !document.body) return 0
        const active = locale && typeof locale.getSnapshot === 'function' ? locale.getSnapshot().active || 'en' : 'en'
        try {
          const answer = await fetch(OVERLAY_API + '?lang=' + encodeURIComponent(active))
          if (!answer || !answer.ok) return 0
          const body = await answer.json()
          current = body && body.map && typeof body.map === 'object' ? body.map : {}
          // THE MARK'S NUMBER RIDES THIS RESPONSE (epic 65 §3): one request per language, not two.
          review = body && body.review && typeof body.review === 'object' ? body.review : { pending: 0, flagged: 0, unjudged: 0 }
        } catch {
          current = {}
          review = { pending: 0, flagged: 0, unjudged: 0 }
        }
        overlay.restore(document.body)
        for (const watcher of [...watchers]) {
          try {
            watcher(review)
          } catch {
            // a watcher that throws costs its own render, never the overlay
          }
        }
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
      return {
        refresh,
        draw,
        overlay,
        review: () => review,
        /** Watch the review count: the Language row's note is drawn from it. */
        onReview: (watcher) => {
          watchers.add(watcher)
          return () => watchers.delete(watcher)
        },
      }
    }

    // ── the review note ────────────────────────────────────────────────────────

    // ── activation ─────────────────────────────────────────────────────────────

    /**
     * Register our own strings, offer our languages, publish the catalog mirror, and put the review
     * count on the harness's own Language row.
     *
     * Every step is guarded and reported rather than thrown: this runs during activation, and an
     * exception here is an app that does not start. The returned report is the seam the suites read
     * — the mount suite asserts on it, and the catalog suite calls `installLanguages` directly.
     */
    function apply(ctx) {
      const locale = typeof ctx.get === 'function' ? ctx.get('locale') : undefined
      const report = { dictionaries: null, languages: null, published: null, reviewNote: null }

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

      // The mirror: whatever the catalog now holds, where the shell's language menu can read it.
      // Published once here and refreshed on every locale change below, because a language can arrive
      // after us (another plugin's `addLanguage`) and a re-registration can re-label one.
      report.published = publishCatalog(locale).map((row) => row.id)

      // THE OVERLAY, and its subscription: a language change re-reads the map for the new language.
      try {
        const overlay = startOverlay(locale)
        report.__overlay = overlay
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

      // The mirror's lifetime is the activation's: refreshed when the catalog moves, and taken down
      // on disposal so a profile that drops this plugin stops advertising languages it no longer has.
      if (locale && typeof locale.subscribe === 'function') {
        const startMirror = () => {
          const off = locale.subscribe(() => {
            publishCatalog(locale)
          })
          return () => {
            try {
              off()
            } catch {
              // The subscription may already be gone; the mirror still comes down.
            }
            clearCatalog()
          }
        }
        if (typeof ctx.effect === 'function') ctx.effect(startMirror, 'localize: catalog mirror')
        else startMirror()
      }

      // THE PICKERS ARE NOT OURS (founder, 2026-10-12: *"kill the globe icon in ui since we will use
      // menu"*).
      //
      // This plugin used to draw a globe at `sidebar.footer.action`. It does not any more: the language
      // switch for this product is the account menu (the shell's own DOM, which reads the catalog mirror
      // above), and the harness's Settings → General → Language row lists the same catalog for anyone not
      // signed in. Two controls for one setting was the redundancy, and a third would be worse.
      //
      // What is left is the part a picker cannot do: the review count (epic 65 §3), which is a to-do and
      // not a preference. It annotates the harness's own Language row — the one picker guaranteed to be
      // on screen in every profile — because that is where a person looks when they are thinking about
      // languages.
      {
        const reviewKey = 'review.pending'
        const count = () => {
          const overlay = report.__overlay
          return overlay && typeof overlay.review === 'function' ? overlay.review().pending || 0 : 0
        }
        const MARK = 'muenReviewPending'
        // ONE note, updated in place. An earlier cut appended a fresh note on every change without
        // removing the previous one, which would stack a count per review as the response arrived.
        let note = null
        const dropNote = () => {
          if (!note) return
          try {
            if (note.parentElement) {
              delete note.parentElement.dataset.muenReviewNote
              note.remove()
            }
          } catch {
            // The row may already be gone with the dialog.
          }
          note = null
        }
        const paint = () => {
          try {
            // RE-READ, never captured: the first paint happens during activation, before the overlay
            // request has answered, so a count read once here would be the count before the fetch.
            const pending = count()
            const root = typeof document !== 'undefined' ? document.documentElement : null
            if (root && root.dataset) {
              if (pending > 0) root.dataset[MARK] = String(pending)
              else delete root.dataset[MARK]
            }
            if (pending <= 0) {
              dropNote()
              return
            }
            const row = document.querySelector('[data-slot="' + LANGUAGE_ROW_SLOT + '"] [data-settings-id="' + LANGUAGE_ROW_ID + '"]')
            // Settings is a dialog: the row can go away while the count stays.
            if (!row) {
              dropNote()
              return
            }
            if (note && note.parentElement === row) {
              if (note.textContent !== String(pending)) note.textContent = String(pending)
              return
            }
            dropNote()
            note = document.createElement('span')
            note.dataset.muenReviewNoteText = 'yes'
            note.setAttribute('role', 'status')
            note.style.cssText = 'margin-inline-start:8px;font-size:12px;color:var(--dsw-alias-state-warn-primary);white-space:nowrap'
            note.textContent = String(pending)
            const label = locale && typeof locale.bind === 'function' ? locale.bind(NS) : (key) => key
            note.title = label(reviewKey)
            note.setAttribute('aria-label', label(reviewKey))
            row.dataset.muenReviewNote = String(pending)
            row.appendChild(note)
          } catch {
            // A missing row or a page mid-render is not a reason to fail an activation.
          }
        }
        const clear = () => {
          try {
            const root = typeof document !== 'undefined' ? document.documentElement : null
            if (root && root.dataset) delete root.dataset[MARK]
          } catch {
            // Nothing to undo.
          }
          // The tracked note first, then the selector as a belt-and-braces sweep for one that was
          // appended by an earlier activation of this same page.
          dropNote()
          try {
            const stray = document.querySelector('[data-slot="' + LANGUAGE_ROW_SLOT + '"] [data-muen-review-note-text="yes"]')
            if (stray) {
              if (stray.parentElement) delete stray.parentElement.dataset.muenReviewNote
              stray.remove()
            }
          } catch {
            // The dialog may already be gone.
          }
        }
        const startRowNote = () => {
          paint()
          const stop = report.__overlay && typeof report.__overlay.onReview === 'function' ? report.__overlay.onReview(() => paint()) : () => {}
          // The row belongs to the harness's locale plugin, so it may not exist yet when we activate and
          // it may be re-created when Settings opens. Redraw when it appears; the count never polls.
          let observer = null
          try {
            if (typeof MutationObserver === 'function' && typeof document !== 'undefined') {
              observer = new MutationObserver(() => paint())
              observer.observe(document.documentElement, { childList: true, subtree: true })
            }
          } catch {
            observer = null
          }
          return () => {
            try {
              if (typeof stop === 'function') stop()
            } catch {
              // The subscription may already be gone.
            }
            if (observer) observer.disconnect()
            clear()
          }
        }
        if (typeof ctx.effect === 'function') ctx.effect(startRowNote, 'localize: review note on the Language row')
        else startRowNote()
        report.reviewNote = { slot: LANGUAGE_ROW_SLOT, id: LANGUAGE_ROW_ID }
      }

      return report
    }

    return {
      inject: ['locale'],
      apply,
      // The seams the suites drive (deliberate, like the assets plugin's zoom logic): the catalog is
      // tested against the harness's own runtime, and the review note against a stub document.
      NS,
      DICT,
      ID_PATTERN,
      LANGUAGE_ROW_SLOT,
      LANGUAGE_ROW_ID,
      OVERLAY_API,
      resolveOverlay,
      textNodesUnder,
      makeOverlay,
      startOverlay,
      LANGUAGES,
      BUILT_IN,
      CATALOG_ATTR,
      installLanguages,
      catalogued,
      catalogRows,
      publishCatalog,
      clearCatalog,
      owned,
    }
  },
})
