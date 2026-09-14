// @muen/dsh-white-label — browser half.
//
// WHAT THIS IS: an accent picker, not a skin engine — and the accent is
// PER-MODE, because light and dark are separate authored choices.
//
// WHY PER-MODE (measured, and it is the house model): EVA — the design system this
// product is built on — does exactly this. Its dark theme (Shinji, the default)
// takes `--primary: #765898`, a deep muted purple; its light theme (Rei) takes
// `--primary: #a0d6f1`, a pale blue. Those are not shades of one another, they are
// two authored choices, and `--primary-foreground` flips with them (#ffffff vs
// #0a1c2e). "Simple EVA would be purple for dark and light blue for light" is a
// taste preference, and taste is not derivable.
//
// So: two picks. Each side is independent. Fitting (see fitted()) applies ONLY to
// a side the user has not set — it derives a usable default from the other side so
// a client can drop one brand hex and still get a working pair. An authored side is
// used exactly as authored; the row warns instead of quietly changing it.
//
// WHAT IS NOT HERE, and why (the deletion is the point):
//   * No theme presets, wallpaper, or opacity/blur controls. A transparency control
//     cannot be made coherent: any dsh surface may paint itself from any token, so
//     a whitelist of overridden names is right on one dialog and inert on another,
//     with no way for the user to tell.
//   * No surface tokens. The ancestor's skins put alpha on SURFACE tokens (the
//     composer at 8%), which is what made the composer read through. dsh puts alpha
//     on nothing but state tints, and so does this.
//
// STYLE RULES OBSERVED (this product's own):
//   * rows separate by SPACING, never a divider — the General column expects a
//     border-bottom and suppresses it on the last child, so our rows draw none.
//   * default controls are monochrome; tints are explicit opt-ins.
;(function () {
const WL_NS = "settings.white-label"
const WL_ROW_ID = "white-label-accent"
const KEY_LIGHT = "white-label:accent-light"
const KEY_DARK = "white-label:accent-dark"

/** Chip row, carried verbatim from dsh-dream-skin (12 colours, same order). */
const CHIPS = [
  "#4f83f2", "#2563eb", "#34d399", "#22d3ee", "#a78bfa", "#fb923c",
  "#f87171", "#fbbf24", "#e879f9", "#f472b6", "#2dd4bf", "#a3e635"
]

const HEX_RE = /^#[\da-f]{6}$/i

// ── colour maths ───────────────────────────────────────────────────────────

const toRgb = (hex) => {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
const toHex = (rgb) =>
  "#" + rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("")
/** The colour at a given alpha — for the state tints. */
const tint = (hex, alpha) => {
  const [r, g, b] = toRgb(hex)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
const mix = (a, b, t) => {
  const [ar, ag, ab] = toRgb(a)
  const [br, bg, bb] = toRgb(b)
  return toHex([ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t])
}

// HSL, because the light-mode fit must move lightness without destroying
// saturation. RGB alone cannot express that — see fitted().
const rgbToHsl = (hex) => {
  const [ri, gi, bi] = toRgb(hex).map((v) => v / 255)
  const max = Math.max(ri, gi, bi)
  const min = Math.min(ri, gi, bi)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const h = max === ri ? (gi - bi) / d + (gi < bi ? 6 : 0) : max === gi ? (bi - ri) / d + 2 : (ri - gi) / d + 4
  return [h / 6, s, l]
}
const hslToRgb = (h, s, l) => {
  if (s === 0) return toHex([l * 255, l * 255, l * 255])
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const channel = (t) => {
    let tt = t
    if (tt < 0) tt += 1
    if (tt > 1) tt -= 1
    if (tt < 1 / 6) return p + (q - p) * 6 * tt
    if (tt < 1 / 2) return q
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6
    return p
  }
  return toHex([channel(h + 1 / 3) * 255, channel(h) * 255, channel(h - 1 / 3) * 255])
}

const srgb = (c) => {
  const v = c / 255
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
}
const luminance = (hex) => {
  const [r, g, b] = toRgb(hex)
  return 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b)
}
const contrast = (a, b) => {
  const la = luminance(a)
  const lb = luminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}
/** Chroma, for reporting how much of a brand colour survived a fit. */
const chroma = (hex) => {
  const [r, g, b] = toRgb(hex)
  return (Math.max(r, g, b) - Math.min(r, g, b)) / 255
}

/**
 * The ink a solid accent fill is read against, per mode. These are dsh's own
 * `label-primary-foreground` values, hardcoded per mode and NOT ours to
 * re-derive: that token is also a check tick on dsh's own ink, so tinting it
 * with the accent would put a coloured tick on a coloured box. The constraint
 * therefore moves onto the accent — see fitted().
 */
const LABEL_INK = { light: "#ffffff", dark: "#0f1115" }
const MIN_CONTRAST = 4.5

/**
 * Fit a colour until it clears the mode's label floor.
 *
 * Light mode darkens by LOWERING LIGHTNESS AND RAISING SATURATION, not by mixing
 * toward black. Measured difference: mixing toward black costs 44% of amber's
 * chroma and lands on ochre, while raising saturation keeps ~69% and reads as the
 * same colour, darker — which is what a designer means by "a deeper step of the
 * same hue". Dark mode only ever lightens, which is the same idea in reverse.
 *
 * This runs ONLY for a side the user left unset. An authored side is respected.
 */
const fitted = (hex, toward) => {
  if (toward === "light") {
    const [h, s, l] = rgbToHsl(hex)
    let out = hex
    for (let step = 1; step <= 80; step += 1) {
      if (contrast(out, LABEL_INK.light) >= MIN_CONTRAST) break
      out = hslToRgb(h, Math.min(1, s * (1 + step * 0.006)), Math.max(0, l * (1 - step * 0.03)))
    }
    return contrast(out, LABEL_INK.light) >= MIN_CONTRAST ? out : hex
  }
  let out = hex
  for (let step = 0; step < 80; step += 1) {
    if (contrast(out, LABEL_INK.dark) >= MIN_CONTRAST) break
    out = mix(out, "#ffffff", 0.05)
  }
  return contrast(out, LABEL_INK.dark) >= MIN_CONTRAST ? out : hex
}

/**
 * The effective accent per scheme.
 *
 * An authored value wins. A blank side is derived from the other side by fitting
 * it for its own floor — so one brand hex still yields a working pair, without
 * ever silently overriding a choice someone made on purpose.
 *
 * @param accents - { light, dark }, either side possibly null.
 * @returns the pair actually applied, or null when nothing is set at all.
 */
const resolvedAccents = (accents) => {
  const { light, dark } = accents
  if (light === null && dark === null) return null
  if (light !== null && dark !== null) return { light, dark }
  if (light !== null) return { light, dark: fitted(light, "dark") }
  return { light: fitted(dark, "light"), dark }
}

/** Roles the accent owns: the brand family ONLY. Nothing semantic, no surfaces. */
const roleOverrides = (pair) => {
  const value = (fn) => ({ light: fn(pair.light), dark: fn(pair.dark) })
  return {
    "--dsw-alias-brand-primary": value((c) => c),
    "--dsw-alias-button-primary-hover": value((c) => mix(c, "#ffffff", 0.18)),
    "--dsw-alias-button-primary-dimmed": value((c) => mix(c, "#ffffff", 0.72)),
    // Selected / hover tints. dsh's own numbers: its accent-tinted hover is
    // 14.1% light / 23.9% dark, and the ink ladder steps ~1.75x for active. The
    // pick supplies the hue; dsh's alphas supply the weights.
    "--dsw-alias-interactive-bg-hover": {
      light: tint(pair.light, 0.141),
      dark: tint(pair.dark, 0.239)
    },
    "--dsw-alias-interactive-bg-active": {
      light: tint(pair.light, 0.247),
      dark: tint(pair.dark, 0.418)
    }
  }
}

const storage = {
  read() {
    const read = (key) => {
      try {
        const raw = window.localStorage.getItem(key)
        return typeof raw === "string" && HEX_RE.test(raw) ? raw.toLowerCase() : null
      } catch {
        return null
      }
    }
    return { light: read(KEY_LIGHT), dark: read(KEY_DARK) }
  },
  write(scheme, value) {
    const key = scheme === "light" ? KEY_LIGHT : KEY_DARK
    try {
      if (value === null) window.localStorage.removeItem(key)
      else window.localStorage.setItem(key, value)
    } catch {}
  }
}

let current = { light: null, dark: null }
let overrideDispose = null

/** Apply (or clear) the accent as ONE override layer over dsh's built-in theme. */
function applyAccent(ctx) {
  const pair = resolvedAccents(current)
  if (pair === null) {
    overrideDispose?.()
    overrideDispose = null
    return
  }
  const tokens = roleOverrides(pair)
  const previous = overrideDispose
  overrideDispose = ctx.theme.overrideTokens("@muen/dsh-white-label:accent", tokens)
  previous?.()
}

/**
 * Contrast of the applied accent against its own mode's label, per scheme — the
 * number the row reports so an authored colour that fails is visible rather than
 * silent.
 */
const report = () => {
  const pair = resolvedAccents(current)
  if (pair === null) return null
  return {
    light: { value: pair.light, ratio: contrast(pair.light, LABEL_INK.light) },
    dark: { value: pair.dark, ratio: contrast(pair.dark, LABEL_INK.dark) }
  }
}

// Written from inside apply(), never at module scope: a module that evaluates but
// never registers must NOT look mounted.
const MARKER = "__WHITE_LABEL__"

window.__ModuleLoader__.load({
  id: "@muen/dsh-white-label",
  factory: function (require) {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" })

    var react_jsx_runtime = require("react/jsx-runtime")
    var store = require("@deepseek-ai/dsh-client-store")

    const styles = {
      group: { display: "flex", flexDirection: "column", gap: "12px", padding: "12px 0" },
      title: { color: "var(--dsw-alias-label-primary)", fontSize: "14px", fontWeight: 400, lineHeight: "22px" },
      sub: { color: "var(--dsw-alias-label-secondary)", fontSize: "12px", lineHeight: "18px", minWidth: "44px" },
      hint: { color: "var(--dsw-alias-label-tertiary)", fontSize: "12px", lineHeight: "18px" },
      warn: { color: "var(--dsw-alias-state-warn-primary)", fontSize: "12px", lineHeight: "18px" },
      row: { display: "flex", alignItems: "center", flexWrap: "wrap", gap: "8px" },
      dot: { width: "16px", height: "16px", borderRadius: "50%", flex: "none", boxShadow: "0 0 0 1px var(--dsw-alias-border-l2)" },
      hex: { color: "var(--dsw-alias-label-secondary)", fontSize: "12px", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" },
      button: {
        cursor: "pointer", borderRadius: "8px", border: "1px solid var(--dsw-alias-border-l2)",
        background: "transparent", color: "var(--dsw-alias-label-primary)",
        font: "inherit", fontSize: "12px", lineHeight: "18px", padding: "4px 10px"
      },
      chip: { width: "18px", height: "18px", padding: 0, borderRadius: "50%", border: "none", cursor: "pointer" }
    }

    // ── SVG inlining ──────────────────────────────────────────────────────
    // A `currentColor` mark under <img> is black-on-black in dark theme.
    // Inlining the SVG into the DOM is a REQUIREMENT, not a preference.
    // This helper decodes a data-URL and creates a component that injects
    // the raw SVG markup into a ref node, preserving currentColor and CSS.

    function dataUrlToString(dataUrl) {
      try {
        const parts = dataUrl.split(',')
        const meta = parts[0]
        const b64 = parts[1] || ''
        if (meta.includes(';base64')) {
          return atob(b64)
        }
        return decodeURIComponent(b64)
      } catch { return '' }
    }

    /**
     * A component that inlines raw SVG markup into the DOM.
     * <img> treats currentColor as black; inlining preserves it.
     */
    function InlineSvg(props) {
      const { src, className, style } = props
      const ref = React.useRef(null)
      React.useEffect(() => {
        if (!ref.current || !src) return
        const raw = src.startsWith('data:') ? dataUrlToString(src) : src
        if (!raw || !/<svg[\s>]/i.test(raw)) return
        // Strip XML declaration if present — the DOM parser handles it.
        const clean = raw.replace(/<\?xml[^?]*\?>\s*/gi, '')
        ref.current.innerHTML = clean
        // Size the inline SVG to fill its container.
        const svg = ref.current.querySelector('svg')
        if (svg) {
          svg.style.width = '100%'
          svg.style.height = '100%'
          svg.removeAttribute('width')
          svg.removeAttribute('height')
        }
      }, [src])
      return React.createElement('span', {
        ref,
        className,
        style: { display: 'inline-flex', alignItems: 'center', maxWidth: '100%', overflow: 'hidden', ...style },
        'data-ls-skip': ''
      })
    }

    /** One mode's control: swatch, value, picker, clear, and its chip row. */
    function AccentLine(props) {
      const { scheme, t } = props
      const authored = props.useStore((s) => s[scheme])
      const shown = authored !== null ? authored : props.derived[scheme]
      const failing = shown !== null && props.report !== null && props.report[scheme].ratio < 4.5
      return react_jsx_runtime.jsxs("div", {
        style: styles.group,
        children: [
          react_jsx_runtime.jsxs("div", {
            style: styles.row,
            children: [
              react_jsx_runtime.jsx("span", { style: styles.sub, children: t(scheme === "light" ? "mode.light" : "mode.dark") }),
              react_jsx_runtime.jsx("span", { style: { ...styles.dot, background: shown || "transparent" } }),
              react_jsx_runtime.jsx("span", { style: styles.hex, children: shown || t("accent.unset") }),
              // Authored, vs derived from the other side: saying which is which is
              // the difference between a transparent tool and a confusing one.
              react_jsx_runtime.jsx("span", {
                style: styles.sub,
                children: authored !== null ? t("accent.set") : shown !== null ? t("accent.derived") : ""
              }),
              // The input is an opacity-0 overlay ON the button, never a
              // display:none node triggered by .click(). `display: none` leaves
              // the input with no box, so the native popup has nothing to anchor
              // to and opens at the viewport origin — top-left corner, measured.
              react_jsx_runtime.jsxs("span", {
                style: { position: "relative", display: "inline-flex" },
                children: [
                  react_jsx_runtime.jsx("button", {
                    type: "button",
                    style: styles.button,
                    "aria-hidden": "true",
                    children: t("accent.pick")
                  }),
                  react_jsx_runtime.jsx("input", {
                    type: "color",
                    "aria-label": t("accent.pick"),
                    value: shown || "#4f83f2",
                    style: { position: "absolute", inset: 0, opacity: 0, cursor: "pointer" },
                    onChange: (event) => props.setAccent(scheme, String(event.target.value).toLowerCase())
                  })
                ]
              }),
              authored !== null
                ? react_jsx_runtime.jsx("button", {
                    type: "button",
                    style: styles.button,
                    onClick: () => props.clearAccent(scheme),
                    children: t("accent.reset")
                  })
                : null
            ]
          }),
          react_jsx_runtime.jsx("div", {
            style: styles.row,
            children: CHIPS.map((hex) =>
              react_jsx_runtime.jsx(
                "button",
                {
                  type: "button",
                  title: hex,
                  "aria-label": hex,
                  "aria-pressed": authored === hex,
                  style: {
                    ...styles.chip,
                    background: hex,
                    ...(authored === hex ? { outline: "2px solid var(--dsw-alias-label-primary)", outlineOffset: "1px" } : {})
                  },
                  onClick: () => props.setAccent(scheme, hex)
                },
                hex
              )
            )
          }),
          failing
            ? react_jsx_runtime.jsx("div", {
                style: styles.warn,
                children: t("accent.contrastWarn", { ratio: props.report[scheme].ratio.toFixed(2) })
              })
            : null
        ]
      })
    }

    function AccentRow(props) {
      const light = props.useStore((s) => s.light)
      const dark = props.useStore((s) => s.dark)
      const current = { light, dark }
      const pair = resolvedAccents(current)
      const account = pair === null ? null : reportFor(pair)
      return react_jsx_runtime.jsxs("div", {
        style: styles.group,
        children: [
          react_jsx_runtime.jsx("div", { style: styles.title, children: props.t("accent.title") }),
          react_jsx_runtime.jsx(AccentLine, {
            scheme: "light",
            t: props.t,
            useStore: props.useStore,
            derived: pair === null ? { light: null } : { light: pair.light },
            report: account,
            setAccent: props.setAccent,
            clearAccent: props.clearAccent
          }),
          react_jsx_runtime.jsx(AccentLine, {
            scheme: "dark",
            t: props.t,
            useStore: props.useStore,
            derived: pair === null ? { dark: null } : { dark: pair.dark },
            report: account,
            setAccent: props.setAccent,
            clearAccent: props.clearAccent
          }),
          react_jsx_runtime.jsx("div", { style: styles.hint, children: props.t("accent.hint") })
        ]
      })
    }

    /** Contrast per scheme for a resolved pair. */
    function reportFor(pair) {
      return {
        light: { value: pair.light, ratio: contrast(pair.light, LABEL_INK.light) },
        dark: { value: pair.dark, ratio: contrast(pair.dark, LABEL_INK.dark) }
      }
    }

    // ── brand row (order 20) ──────────────────────────────────────────────
    // The host half reads brand files from <DSH_HOME>/brand/ and exposes them
    // through the 'white-label' service. This row consumes that service.

    const BRAND_ROW_ID = "white-label-brand"
    const BRAND_NS = "settings.white-label-brand"
    const BRAND_CSS = [
      '.wl-brand{display:flex;flex-direction:column;gap:12px;padding:12px 0}',
      '.wl-brand-title{color:var(--dsw-alias-label-primary);font-size:14px;font-weight:400;line-height:22px}',
      '.wl-brand-hint{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}',
      '.wl-brand-path{font-size:12px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-2);padding:4px 8px;border-radius:6px;user-select:all;word-break:break-all}',
      '.wl-brand-errors{display:flex;flex-direction:column;gap:4px}',
      '.wl-brand-error{color:var(--dsw-alias-state-warn-primary);font-size:12px;line-height:18px}',
      '.wl-brand-previews{display:flex;gap:16px;flex-wrap:wrap}',
      '.wl-brand-slot{display:flex;flex-direction:column;gap:6px;min-width:0}',
      '.wl-brand-slot-label{font-size:12px;font-weight:600;color:var(--dsw-alias-label-secondary)}',
      '.wl-brand-slot-preview{min-height:48px;border:1px dashed rgba(255,255,255,.12);border-radius:8px;background:var(--dsw-static-neutral-bluish-900,#1b1b1c);display:flex;align-items:center;justify-content:center;padding:8px;overflow:hidden}',
      '.wl-brand-slot-preview img{max-height:32px;max-width:120px;object-fit:contain}',
      '.wl-brand-slot-empty{color:var(--dsw-alias-label-tertiary);font-size:12px}',
      '.wl-brand-btn{cursor:pointer;border-radius:6px;border:1px solid var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;line-height:18px;padding:3px 8px}',
    ].join('\n')

    /** One brand file preview slot (icon or logo). */
    function BrandSlot(props) {
      const { label, file } = props
      if (!file) {
        return react_jsx_runtime.jsxs("div", {
          className: "wl-brand-slot",
          children: [
            react_jsx_runtime.jsx("div", { className: "wl-brand-slot-label", children: label }),
            react_jsx_runtime.jsx("div", {
              className: "wl-brand-slot-preview",
              children: react_jsx_runtime.jsx("span", { className: "wl-brand-slot-empty", children: "not configured" })
            })
          ]
        })
      }
      return react_jsx_runtime.jsxs("div", {
        className: "wl-brand-slot",
        children: [
          react_jsx_runtime.jsx("div", { className: "wl-brand-slot-label", children: label }),
          react_jsx_runtime.jsx("div", {
            className: "wl-brand-slot-preview",
            children: react_jsx_runtime.jsx("img", { src: file.dataUrl, alt: label, draggable: false })
          })
        ]
      })
    }

    function BrandRow(props) {
      const { t } = props
      const brand = props.useStore((s) => s)
      const errors = brand.errors || []
      return react_jsx_runtime.jsxs("div", {
        style: styles.group,
        className: "wl-brand",
        children: [
          react_jsx_runtime.jsx("div", { style: styles.title, children: t("brand.title") }),
          react_jsx_runtime.jsx("div", { style: styles.hint, children: t("brand.hint") }),
          (brand.icon || brand.logo) && react_jsx_runtime.jsxs("div", {
            className: "wl-brand-previews",
            children: [
              react_jsx_runtime.jsx(BrandSlot, { label: "icon", file: brand.icon }),
              react_jsx_runtime.jsx(BrandSlot, { label: "logo", file: brand.logo })
            ]
          }),
          errors.length > 0 && react_jsx_runtime.jsx("div", {
            className: "wl-brand-errors",
            children: errors.map((e, i) =>
              react_jsx_runtime.jsx("div", { className: "wl-brand-error", children: e }, i)
            )
          }),
          react_jsx_runtime.jsxs("div", {
            style: { display: 'flex', alignItems: 'center', gap: '8px' },
            children: [
              react_jsx_runtime.jsx("div", {
                className: "wl-brand-path",
                children: brand.folder || t("brand.path")
              }),
              brand.revealFolder && react_jsx_runtime.jsx("button", {
                type: "button",
                className: "wl-brand-btn",
                onClick: () => brand.revealFolder(),
                children: t("brand.reveal")
              })
            ]
          })
        ]
      })
    }

    // ── sidebar marks ─────────────────────────────────────────────────────
    // The icon.svg goes into sidebar.brand.mark (inlined for currentColor).
    // The logo goes into sidebar.brand.name (inlined for currentColor).
    // Both read from the host service's brand data via the brand store.
    // A component that renders nothing when there is no file — dsh's own
    // default mark shows instead.

    /** Sidebar icon mark — inlined SVG from icon.svg. */
    function SidebarMark() {
      // Read from the brand store (injected by the slot registration).
      // useStore is not available here — we read from a module-level ref
      // that the brand store updates.
      const icon = sidebarBrand.icon
      if (!icon || !icon.dataUrl) return null
      if (icon.mimeType === 'image/svg+xml') {
        return React.createElement(InlineSvg, {
          src: icon.dataUrl,
          style: { height: '24px', width: 'auto' }
        })
      }
      // PNG: <img> is fine (no currentColor dependency).
      return React.createElement('img', {
        src: icon.dataUrl,
        alt: '',
        draggable: false,
        style: { height: '24px', width: 'auto', objectFit: 'contain' },
        'data-ls-skip': ''
      })
    }

    /** Sidebar wordmark/logo — inlined SVG from logo file. */
    function SidebarName() {
      const logo = sidebarBrand.logo
      if (!logo || !logo.dataUrl) return null
      if (logo.mimeType === 'image/svg+xml') {
        return React.createElement(InlineSvg, {
          src: logo.dataUrl,
          style: { height: '24px', width: 'auto', maxWidth: '100%' }
        })
      }
      return React.createElement('img', {
        src: logo.dataUrl,
        alt: '',
        draggable: false,
        style: { height: '24px', width: 'auto', maxWidth: '100%', objectFit: 'contain' },
        'data-ls-skip': ''
      })
    }

    /** Hero mark — inlined SVG from icon.svg, 34px square. */
    function HeroMark() {
      const icon = sidebarBrand.icon
      if (!icon || !icon.dataUrl) return null
      if (icon.mimeType === 'image/svg+xml') {
        return React.createElement(InlineSvg, {
          src: icon.dataUrl,
          style: { height: '34px', width: '34px' }
        })
      }
      return React.createElement('img', {
        src: icon.dataUrl,
        alt: '',
        draggable: false,
        style: { height: '34px', width: '34px', objectFit: 'contain' },
        'data-ls-skip': ''
      })
    }

    // Module-level ref for sidebar components to read brand data.
    // Updated by the brand store sync; sidebar components re-render on change.
    const sidebarBrand = { icon: null, logo: null }

    const inject = ["slots", "locale", "theme"]

    const createStore = () =>
      store.defineStore({
        init: () => ({ light: null, dark: null, revision: -1 }),
        actions: {
          sync: (d, light, dark, revision) => {
            if (revision <= d.revision) return
            d.light = light
            d.dark = dark
            d.revision = revision
          }
        }
      })

    function apply(ctx) {
      // Inject brand CSS
      if (typeof document !== 'undefined') {
        const tagId = '@muen/dsh-white-label/brand.css'
        if (!document.querySelector('style[data-plugin-css=' + JSON.stringify(tagId) + ']')) {
          const tag = document.createElement('style')
          tag.dataset.plugin = 'dsh-white-label'
          tag.dataset.pluginCss = tagId
          tag.textContent = BRAND_CSS
          document.head.appendChild(tag)
        }
      }

      // Dicts are keyed BY LOCALE, then by key. Getting this wrong is loud but
      // confusing: `register(ns, flatDict)` reads the dictionary's KEYS as locale
      // tags and fails the whole entry with
      // `locale id "accent.title" is not a BCP 47-style tag` — which reads like a
      // bad translation key rather than a bad call shape.
      ctx.effect(
        () =>
          ctx.locale.register(WL_NS, {
            en: {
              "accent.title": "Accent",
              "accent.pick": "Pick…",
              "accent.reset": "Reset",
              "accent.set": "set",
              "accent.derived": "from the other mode",
              "accent.unset": "not set",
              "accent.hint":
                "Choose a colour for each mode. They are independent — a deep purple for dark and a pale blue for light is a normal pairing. Leaving one out derives it from the other.",
              "accent.contrastWarn": "Low contrast on this mode's buttons ({ratio}:1) — pick a darker shade.",
              "mode.light": "Light",
              "mode.dark": "Dark",
              "brand.title": "Brand",
              "brand.hint":
                "Place your icon.svg and logo files in the brand folder. The plugin reads them on launch.",
              "brand.path": "<DSH_HOME>/brand/",
              "brand.reveal": "Reveal folder"
            },
            zh: {
              "accent.title": "强调色",
              "accent.pick": "选色…",
              "accent.reset": "清除",
              "accent.set": "已设置",
              "accent.derived": "由另一种模式推导",
              "accent.unset": "未设置",
              "accent.hint":
                "分别为两种模式选择颜色，两者互相独立——深色模式用深紫、浅色模式用浅蓝是常见的搭配。留空的一侧会由另一侧推导得出。",
              "accent.contrastWarn": "当前模式按钮对比度偏低（{ratio}:1），建议选择更深的颜色。",
              "mode.light": "浅色",
              "mode.dark": "深色",
              "brand.title": "品牌",
              "brand.hint": "将 icon.svg 和 logo 文件放入品牌文件夹，插件会在启动时读取。",
              "brand.path": "<DSH_HOME>/brand/",
              "brand.reveal": "打开文件夹"
            }
          }),
        "white-label: dictionaries"
      )

      // ── accent row (order 10.5) ──
      const accentStore = createStore()
      let bound
      let revision = 0
      const sync = () => {
        current = storage.read()
        bound?.sync(current.light, current.dark, ++revision)
        applyAccent(ctx)
      }

      current = storage.read()
      applyAccent(ctx)

      // `inject`, not a bare `register`: `settings.general.item` is declared by
      // the settings-general entry's children table, which may not exist yet when
      // this runs. Registering first fails the whole entry with
      // `slot "settings.general.item" is not declared (a parent entry's children
      // table must declare it)` — the same reason every shipped row (dsh's own
      // Appearance cubes included) goes through inject.
      ctx.slots.inject("settings.general.item", () =>
        ctx.slots.register(
          {
            name: "settings.general.item",
            id: WL_ROW_ID,
            // 10.5: between dsh's mode cubes (10) and its font-size row (11). The
            // accent and the mode choice are the same decision, and font size is a
            // typography row that was interrupting them. List slots sort by
            // `priority` then `order`, both numeric — so a fractional order is
            // legal and lands exactly between. priority stays 0, like dsh's own
            // rows, so nothing with priority 1 can leapfrog them.
            order: 10.5,
            locale: WL_NS,
            store: accentStore,
            inject: (actions) => {
              bound = actions
              sync()
              return {
                setAccent: (scheme, hex) => {
                  if (!HEX_RE.test(hex)) return
                  storage.write(scheme === "light" ? "light" : "dark", hex.toLowerCase())
                  sync()
                },
                clearAccent: (scheme) => {
                  storage.write(scheme === "light" ? "light" : "dark", null)
                  sync()
                }
              }
            }
          },
          AccentRow
        )
      )

      // ── brand row (order 20) ──
      // Read brand files from the host service. If the service is absent
      // (stock DSH, no host half loaded), the row shows the path only.
      let brandService = null
      try {
        brandService = typeof ctx.get === 'function' ? ctx.get('white-label') : null
      } catch { brandService = null }

      const brandStore = store.defineStore({
        init: () => ({
          icon: null, logo: null,
          folder: '', errors: [],
          revealFolder: null,
          revision: 0
        }),
        actions: {
          sync: (d, icon, logo, folder, errors, revealFolder, revision) => {
            if (revision <= d.revision) return
            d.icon = icon
            d.logo = logo
            d.folder = folder
            d.errors = errors
            d.revealFolder = revealFolder
            d.revision = revision
          }
        }
      })

      // Load brand files on mount.
      let brandBound
      let brandRev = 0
      const loadBrand = async () => {
        if (!brandService || typeof brandService.readBrand !== 'function') return
        try {
          const result = await brandService.readBrand()
          const reveal = typeof brandService.revealFolder === 'function'
            ? brandService.revealFolder : null
          // Update sidebar refs so SidebarMark/SidebarName re-render.
          sidebarBrand.icon = result.icon
          sidebarBrand.logo = result.logo
          brandBound?.sync(
            result.icon, result.logo,
            result.folder, result.errors,
            reveal, ++brandRev
          )
        } catch {
          // Service read failed — row shows path only
        }
      }

      // Try to get the brand folder path synchronously for the initial render.
      let initialPath = ''
      if (brandService && typeof brandService.brandPath === 'function') {
        try { initialPath = brandService.brandPath() } catch {}
      }

      ctx.slots.inject("settings.general.item", () =>
        ctx.slots.register(
          {
            name: "settings.general.item",
            id: BRAND_ROW_ID,
            order: 20,
            locale: BRAND_NS,
            store: brandStore,
            inject: (actions) => {
              brandBound = actions
              // Sync initial path, then load files async.
              brandBound.sync(null, null, initialPath || '<DSH_HOME>/brand/', [], null, 0)
              loadBrand()
              return {
                // No actions needed — the brand row is read-only.
                // Files are loaded from the host service, not edited here.
              }
            }
          },
          BrandRow
        )
      )

      // ── sidebar marks ─────────────────────────────────────────────────────
      // Register sidebar slots for icon (mark) and logo (name). The components
      // read from the sidebarBrand ref, which loadBrand() updates when files
      // arrive from the host service.
      ctx.slots.inject('sidebar.brand.mark', () =>
        ctx.slots.inject('sidebar.brand.name', () =>
          ctx.slots.inject('conversation.hero.brand.mark', function* () {
            yield ctx.slots.register({ name: 'sidebar.brand.mark' }, SidebarMark)
            yield ctx.slots.register({ name: 'sidebar.brand.name' }, SidebarName)
            yield ctx.slots.register({ name: 'conversation.hero.brand.mark' }, HeroMark)
          })))

      window[MARKER] = {
        mounted: true,
        accentRow: WL_ROW_ID,
        brandRow: BRAND_ROW_ID,
        accentOrder: 10.5,
        brandOrder: 20,
        perMode: true,
        at: new Date().toISOString()
      }
      try {
        console.log("[dsh-white-label] mounted, accent + brand rows registered")
      } catch {}
    }

    exports.apply = apply
    exports.inject = inject
    exports.WL_ROW_ID = WL_ROW_ID
    exports.BRAND_ROW_ID = BRAND_ROW_ID
    exports.CHIPS = CHIPS
    return module.exports
  }
})
})()
