import Schema from 'schemastery'

const name = 'brand-swap'
const inject = []
// Storage-side bound, aligned with the client cap (1 MB source → ~1.37 MB base64
// data-URL). Keeps the host settings doc from accepting unbounded logo strings.
const MAX_STORED = 2 * 1024 * 1024
// Hero tagline bound: a prose line that replaces the blank-session headline. Not
// a layout cure (the hero row wraps), just a bound on what the settings doc holds.
const MAX_TAGLINE = 200
// Provide the brand config to the client half so the rendered wordmark is
// overridable per profile (value separation). Reads this row's cordis `config`.
// Also registers the 'brand-swap' settings namespace (logoLight / logoDark /
// heroIcon data-URL strings + heroShow + brandTagline) so the Settings → Brand
// page persists the brand identity in the HOST settings document — the only store that survives
// app restarts (browser localStorage is origin-scoped and the desktop binds a
// fresh port each launch, orphaning old origins).
//
// Registration must succeed BEFORE any client scope write, or the host rejects
// the write (silently — the rejection is an async promise, invisible to a sync
// caller) and the brand is lost on the next restart. Two traps that caused that
// here:
//   1. schemastery's ESM surface exposes the schema builders on the DEFAULT
//      export (no named `Schema`), matching first-party code
//      (`import Schema from 'schemastery'` → `Schema.object(...)`).
//   2. The namespace must be registered synchronously inside
//      `ctx.inject(['settings'])` — a later async `import().then(register)`
//      races nothing at boot but silently never runs when the extract fails.
// This is guarded only by the service being absent (then nothing registers and
// the client falls back to its local-only copy with a visible warning).
function apply(ctx, config) {
  const cfg = config || {}
  try {
    ctx.provide('brand', {
      wordmark: cfg.wordmark || '',
      textColor: cfg.textColor,
      dotColor: cfg.dotColor,
      fontFamily: cfg.fontFamily,
      fontSize: cfg.fontSize,
      fontWeight: cfg.fontWeight,
      letterSpacing: cfg.letterSpacing,
      // Profile-level tagline default; the Settings → Brand field overrides it.
      brandTagline: cfg.brandTagline || '',
    })
  } catch (error) { /* provide is best-effort */ }

  try {
    ctx.inject(['settings'], (host) => {
      try {
        host.settings.register('brand-swap', Schema.object({
          // Pattern validates the data-URL prefix while allowing '' (a cleared logo)
          // — schemastery's pattern() is a regexp.test(), so anchor with ^.
          logoLight: Schema.string().max(MAX_STORED).pattern(/^(?:$|data:image\/)/).default(''),
          logoDark: Schema.string().max(MAX_STORED).pattern(/^(?:$|data:image\/)/).default(''),
          heroIcon: Schema.string().max(MAX_STORED).pattern(/^(?:$|data:image\/)/).default(''),
          heroShow: Schema.boolean().default(false),
          // Blank-session hero tagline (replaces the upstream "Into the Unknown"
          // headline when set; empty keeps the upstream copy). Plain text, so the
          // bound is prose length, not data-URL length.
          brandTagline: Schema.string().max(MAX_TAGLINE).default(''),
        }))
      } catch (error) { /* namespace may already be registered — keep the owner */ }
    })
  } catch (error) { /* settings service absent → client falls back to local-only */ }
}
export default { name, inject, apply }
