// @muen/dsh-composer-race — browser half.
// Loader format: one self-contained script registered via window.__ModuleLoader__.
// React arrives via factory(require); the DSH slot registry comes from ctx.slots.
//
// ONE JOB: while the addressed agent is working, two soft EVA dots race around the composer's
// edge from the same start line — purple faster, green slower — and the race restarts the
// moment the slower dot arrives. Nothing is replaced, moved, or re-laid-out — the plugin adds
// one hidden marker inside the composer card and one stylesheet, and CSS does the rest.
//
// ── why a marker, and not a DOM write ─────────────────────────────────────────────
// Two harness facts make this survive an upgrade, and both are `data-` facts rather
// than class names:
//
//   * the composer card carries the semantic attribute `[data-composer-card]` — the
//     visible box (`border:0`, `border-radius:22px`, `position:relative`, its ring
//     drawn by `box-shadow`), NOT a stable class. The class beside it is a per-build
//     hash (`uV2eYG_card`), so a rule keyed on it would die on the next harness
//     release;
//   * `:has()` is already used by the shipped CSS (54 rules), so one stylesheet can
//     reach the card FROM the marker. The plugin therefore never needs the card's
//     class, its depth, or a `closest()` walk.
//
// ── the seat ──────────────────────────────────────────────────────────────────────
// `conversation.input.overlay` is a harness-declared `list` slot (scope: session)
// rendered as the composer card's FIRST child through
// `InputBar_module_css_default.overlayAnchor`. That is what it is for, so the marker
// lands inside the card by construction. It is declared under
// `conversation.composer.bar`, beside `conversation.composer.dock` (a list slot the
// built-in queue dock uses) — all additive seats, none of them a takeover. The
// `conversation.composer` chain slot IS the takeover route and is deliberately not
// used here.
//
// ── the state ─────────────────────────────────────────────────────────────────────
// `running` is the addressed agent's busy fact — the same one the composer reads to
// turn its Send button into Stop (`primaryStops = running && …`). It is NOT a data
// attribute: the ones nearby mean other things (`data-phase` is the layout phase
// hero/settling/active; `data-composer-composing` is IME composition). It arrives
// through the slots runtime's session lifecycle hook, which every session-scoped entry
// is handed as a prop — `props.useSession` — with the plural store (`props.useSessions`,
// already used by @muen/dsh-fast-context) as the fallback. The guard/inner split keeps
// every hook call unconditional.
//
// ── the theme ─────────────────────────────────────────────────────────────────────
// The dots' inks follow the SELECTED theme (the rule the design was accepted under):
// **EVA Dark = purple + green** (the accepted pair — the sheet's base), **EVA Light =
// dark blue + light blue**, **Regular (light / dark / system, or any non-EVA theme) =
// the theme's own accent** on both dots. The preference id is not a DOM fact anywhere,
// so it arrives through `ctx.theme`: this entry's OWN inject face hands the component a
// selector hook (`hooks: { theme }` — the exact channel `ui-settings-account` and
// `ui-sidebar-terminal` use to read a theme snapshot inside a slot). The component maps
// the preference onto the marker as one attribute, `[data-muen-race-theme]`, and the
// sheet maps it back to a pair — so a theme switch repaints the race as a pure-CSS
// attribute change: no DOM writes to the card, no global override layer to tear down,
// and the existing `var(--muen-race-ink-a/b)` card variables still win when a profile
// re-declares them (their rules come later than the theme map).

window.__ModuleLoader__.load({
  id: '@muen/dsh-composer-race',
  factory: (require) => {
    const React = require('react')
    const h = React.createElement

    /** The composer card's overlay seat — a `list` slot inside the card. */
    const SEAT = 'conversation.input.overlay'
    const STYLE_ID = '@muen/dsh-composer-race/style.css'
    /** After the queue dock (20) and the watchdog banner (30); order is cosmetic here. */
    const ORDER = 40

    // ── the EVA design: a race ────────────────────────────────────────────────────
    // Two soft dots start together at the top-left corner of the card. Purple is the faster one: it
    // crosses the line at 62% of the cycle and HOLDS there. Green laps for the whole cycle;
    // its arrival is the finish, and the next lap starts from the same point for both. So
    // the cycle IS green's lap, and the race resets the moment the slower dot lands.
    //
    // The base pair — EVA Dark, the accepted design — is EVA Unit 01's brand triad:
    // `--primary` (#765898 — the purple EVA's own documented glow halo is built from) and
    // `--secondary` (#52d053, EVA green). Both carry their hex as a fallback, so the look
    // holds in a profile that has not loaded the EVA tokens. Purple is painted above green,
    // because the leader should not be covered at the start line (top-left corner), where the two dots are
    // coincident.
    //
    // The SELECTED THEME then re-inks the pair through `[data-muen-race-theme]`, the
    // attribute the marker carries (see "the theme" in the header comment):
    //   `eva-01`  → the base pair above (no override rule — EVA Dark IS the default);
    //   `eva-00`  → dark blue `#000864` + light blue `#00C4FF`, the app's own EVA Light
    //                blues (EVA 00's brand-primary and its light highlight);
    //   `regular` → `--dsw-alias-state-business-primary` on BOTH dots — the theme's own
    //                accent, the ink the composer's pending dot and caret already wear,
    //                so the race follows whatever accent the selected theme carries
    //                (DeepSeek blue under stock light/dark, a white-label accent if one
    //                is set). Same accent twice: the dots still read apart by speed,
    //                glow and position.
    //
    // The blur is EVA's glow language rather than a new one: DESIGN.md documents the dark
    // halo as 1px + 16px + 48px of rgba(118,88,152,{0.4,0.3,0.25}). Each dot therefore
    // carries a three-stop `drop-shadow` bloom at those alphas — tightened to 4/16/32px for
    // a 2.5px ring — plus a half-pixel blur, and this sheet has no other shadow.
    //
    // Motion follows DESIGN.md "Motion": calm and short, standard easing only, no overshoot.
    // Hence a linear lap at 3.2s, and reduced motion stops the race while keeping the glow —
    // both dots still read as active, parked apart, which is the "instant / opacity-only"
    // fallback that rule names.
    //
    // DESIGN.md Resolved #2, said out loud: `--secondary` is identity, and a *status* reading
    // of "running" is `--success`. This is a brand gesture, not a status readout, so the EVA
    // pairing is the default — but each ink is one variable, so a profile that wants it read
    // as status sets both to `var(--success)`.
    const CSS = [
      '/* composer-race — two EVA dots race round the composer while the agent works. */',
      '@property --muen-race-angle{syntax:"<angle>";initial-value:315deg;inherits:false}',
      '[data-composer-card]{--muen-race-ink-a:var(--primary,#765898);--muen-race-ink-b:var(--secondary,#52d053);--muen-race-ring:2.5px;--muen-race-duration:3.2s}',
      '/* ── theme map: the selected theme picks the pair ───────────────────────────────',
      '   The marker carries the preference as `[data-muen-race-theme]`; each rule below',
      '   re-inks BOTH card variables, so the two comet rules and every glow stop follow',
      '   without touching them. Specificity: base (0,1,0) → map (0,3,0). A profile that',
      '   re-declares `--muen-race-ink-a/b` on the card in a later sheet still wins — the',
      '   documented retune seam. Values: EVA 00 = brand-primary #000864 (dark blue) +',
      '   #00C4FF (light blue); regular = the app accent the composer itself wears. */',
      '[data-composer-card]:has([data-muen-race-theme="eva-00"]){--muen-race-ink-a:#000864;--muen-race-ink-b:#00C4FF}',
      '[data-composer-card]:has([data-muen-race-theme="regular"]){--muen-race-ink-a:var(--dsw-alias-state-business-primary,#4176e6);--muen-race-ink-b:var(--dsw-alias-state-business-primary,#4176e6)}',
      '[data-composer-card]:has([data-muen-race="on"])::before,',
      '[data-composer-card]:has([data-muen-race="on"])::after{',
      'content:"";',
      'position:absolute;',
      'inset:0;',
      'border-radius:inherit;',
      'pointer-events:none;',
      'padding:var(--muen-race-ring);',
      'animation:muen-race-lap var(--muen-race-duration) linear infinite;',
      '-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);',
      '-webkit-mask-composite:xor;',
      'mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);',
      'mask-composite:exclude;',
      '}',
      '/* Both comets are drawn head-first at 315deg — the start line, at the top-left corner of the card,',
      '   which is also the finish, because a lap ends where it began. */',
      '/* green — the slower dot. One lap per cycle, and its arrival restarts the race. */',
      '[data-composer-card]:has([data-muen-race="on"])::before{',
      'background:conic-gradient(from var(--muen-race-angle),var(--muen-race-ink-b) 0deg 4deg,transparent 4deg 302deg,color-mix(in oklab,var(--muen-race-ink-b) 12%,transparent) 302deg 324deg,color-mix(in oklab,var(--muen-race-ink-b) 38%,transparent) 324deg 346deg,color-mix(in oklab,var(--muen-race-ink-b) 72%,transparent) 346deg 356deg,var(--muen-race-ink-b) 356deg 360deg);',
      'filter:drop-shadow(0 0 4px var(--muen-race-ink-b)) drop-shadow(0 0 16px color-mix(in oklab,var(--muen-race-ink-b) 30%,transparent)) drop-shadow(0 0 32px color-mix(in oklab,var(--muen-race-ink-b) 25%,transparent)) blur(.5px);',
      '}',
      '/* purple — the faster dot, painted above green. It crosses at 62% of the cycle and',
      '   holds the line from there. The 62% is the ONE baked number in this sheet: CSS cannot',
      '   take a var() in a keyframe selector, so change it here and in @keyframes',
      '   muen-race-lead together. 62% of 3.2s is a 1.98s lap against green\'s 3.2s. */',
      '[data-composer-card]:has([data-muen-race="on"])::after{',
      'background:conic-gradient(from var(--muen-race-angle),var(--muen-race-ink-a) 0deg 4deg,transparent 4deg 302deg,color-mix(in oklab,var(--muen-race-ink-a) 12%,transparent) 302deg 324deg,color-mix(in oklab,var(--muen-race-ink-a) 38%,transparent) 324deg 346deg,color-mix(in oklab,var(--muen-race-ink-a) 72%,transparent) 346deg 356deg,var(--muen-race-ink-a) 356deg 360deg);',
      'filter:drop-shadow(0 0 4px var(--muen-race-ink-a)) drop-shadow(0 0 16px color-mix(in oklab,var(--muen-race-ink-a) 30%,transparent)) drop-shadow(0 0 32px color-mix(in oklab,var(--muen-race-ink-a) 25%,transparent)) blur(.5px);',
      'animation-name:muen-race-lead;',
      '}',
      '/* green laps the whole cycle: 100% is the finish, and the next lap begins there. */',
      '@keyframes muen-race-lap{0%{--muen-race-angle:315deg}100%{--muen-race-angle:675deg}}',
      '/* purple needs only 62% of it, then holds — 675deg is the start line again. */',
      '@keyframes muen-race-lead{0%{--muen-race-angle:315deg}62%,100%{--muen-race-angle:675deg}}',
      '/* No motion: the race stops but both dots still read as active, parked apart. */',
      '@media (prefers-reduced-motion:reduce){',
      '[data-composer-card]:has([data-muen-race="on"])::before{animation:none;--muen-race-angle:495deg}',
      '[data-composer-card]:has([data-muen-race="on"])::after{animation:none;--muen-race-angle:315deg}',
      '}',
    ].join('\n')

    /**
     * One sheet per page, owned by this plugin. Same idiom as the other Muen client
     * halves: a guarded append keyed on `data-plugin-css`, so a hot reload or a second
     * activation cannot stack two copies.
     */
    function injectCss() {
      if (typeof document === 'undefined') return
      if (document.querySelector('style[data-plugin-css=' + JSON.stringify(STYLE_ID) + ']')) return
      const tag = document.createElement('style')
      tag.dataset.plugin = 'dsh-composer-race'
      tag.dataset.pluginCss = STYLE_ID
      tag.textContent = CSS
      document.head.appendChild(tag)
    }

    /**
     * The selected theme, as the marker attribute the sheet keys on.
     *
     * `useTheme` arrives through this entry's own inject face (`hooks: { theme }`,
     * bound by the renderer to a selector hook over the theme snapshot) — the same
     * channel `ui-settings-account` and `ui-sidebar-terminal` use. The preference id
     * is `eva-01` / `eva-00` when an EVA skin is selected and `light` / `dark` /
     * `system` (or another plugin's id) otherwise; absent entirely on a host whose
     * runtime does not hand the hook, which maps to `undefined` and leaves the base
     * pair — the accepted EVA Dark look — in place.
     */
    const themeAttr = (useTheme) => {
      const preference = useTheme((snapshot) => (snapshot == null ? undefined : snapshot.preference))
      if (preference === 'eva-01') return 'eva-01'
      if (preference === 'eva-00') return 'eva-00'
      if (preference === undefined) return undefined
      return 'regular'
    }

    /**
     * The one thing CSS sees. `hidden` keeps it out of layout and out of the
     * accessibility tree; `:has()` does not care that it is invisible.
     */
    function Marker(props) {
      return h('span', {
        hidden: true,
        'aria-hidden': 'true',
        'data-muen-race': props.running === true ? 'on' : 'off',
        'data-muen-race-theme': props.theme,
      })
    }

    /** `running` straight off the session lifecycle hook the slots runtime hands over. */
    function RaceFromSession(props) {
      const running = props.useSession((session) => session != null && session.running === true)
      return h(Marker, { running: running === true, theme: themeAttr(props.useTheme) })
    }

    /**
     * Fallback for a runtime that hands the plural store instead of the single session
     * hook: read this entry's own session id, the shape @muen/dsh-fast-context uses.
     */
    function RaceFromSessions(props) {
      const id =
        props.sessionId === undefined || props.sessionId === null ? null : String(props.sessionId)
      const running = props.useSessions((state) => {
        if (state == null || id === null) return false
        const row = state.byId === undefined ? undefined : state.byId[id]
        return row != null && row.running === true
      })
      return h(Marker, { running: running === true, theme: themeAttr(props.useTheme) })
    }

    /**
     * A runtime that hands no theme hook (older kit): the selector is answered
     * against `undefined`, so `themeAttr` maps it to no attribute — the base pair.
     * Declared once so the inner components call one hook of stable identity
     * unconditionally.
     */
    const useNoTheme = (selector) => selector(undefined)

    /**
     * The entry the seat renders. The props kit differs between harness builds, so the
     * guard checks WHICH session hook arrived and hands off — it calls no hook itself,
     * so no hook is ever called conditionally.
     */
    function RaceMarker(props) {
      const full = props.useTheme === undefined || props.useTheme === null
        ? Object.assign({}, props, { useTheme: useNoTheme })
        : props
      if (typeof full.useSession === 'function') return h(RaceFromSession, full)
      if (typeof full.useSessions === 'function') return h(RaceFromSessions, full)
      return null
    }

    function apply(ctx) {
      // The sheet is a resource this plugin owns, so it rides ctx.effect and leaves with
      // the plugin rather than outliving it in the page head.
      ctx.effect(() => {
        injectCss()
        return () => {}
      }, 'composer-race: stylesheet')

      // The theme snapshot as a HostObservable: this is what `inject: { hooks }`
      // wants — the renderer binds it to a selector hook and passes it as `useTheme`.
      // Built lazily from ctx so a runtime without the theme service still registers
      // the seat; the marker then answers `undefined` (base pair) rather than throw.
      const themeSource =
        ctx.theme === undefined || ctx.theme === null
          ? undefined
          : {
              getSnapshot: () => ctx.theme.getTheme(),
              subscribe: (listener) => ctx.on('theme/change', listener),
            }

      // Registering nothing when the seat is absent is the correct failure: a host
      // without the slot renders no race rather than throwing at boot.
      ctx.slots.inject(SEAT, () =>
        ctx.slots.register(
          {
            name: SEAT,
            id: 'composer-race',
            order: ORDER,
            inject:
              themeSource === undefined
                ? undefined
                : () => ({ hooks: { theme: themeSource } }),
          },
          RaceMarker,
        ),
      )
    }

    return { inject: ['slots', 'theme'], apply }
  },
})
