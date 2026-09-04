const name = 'brand-swap'
const inject = []
// Provide the brand config to the client half so the rendered wordmark is
// overridable per profile (value separation). Reads this row's cordis `config`.
// Also registers an OPTIONAL 'brand-swap' settings namespace (logoLight / logoDark
// data-URL strings) so the Settings → Brand page can persist uploaded logos in the
// host settings document. Everything is guarded: on a host without the settings
// service or schemastery, the plugin still works (client falls back to localStorage).
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
    })
  } catch (error) { /* provide is best-effort */ }

  const settings = typeof ctx.get === 'function' ? ctx.get('settings') : undefined
  if (settings && typeof settings.register === 'function') {
    import('schemastery')
      .then((mod) => {
        const Schema = (mod && (mod.Schema || (mod.default && mod.default.Schema)))
        if (!Schema || typeof Schema.object !== 'function') return
        try {
          settings.register('brand-swap', Schema.object({
            logoLight: Schema.string().default(''),
            logoDark: Schema.string().default(''),
            heroIcon: Schema.string().default(''),
            heroShow: Schema.boolean().default(false),
          }))
        } catch (error) { /* namespace may already exist */ }
      })
      .catch(() => { /* schemastery unavailable → client localStorage fallback */ })
  }
}
export default { name, inject, apply }
