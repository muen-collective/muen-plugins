// @muen/dsh-language-switcher — host half.
//
// Currently minimal (the L2.1 slice is client-only: the Settings > General row and the
// Fix-plugins button render on the client). The host provides a `localizer` service so the
// client can list installed plugins and run the patch/override flow (wired in L2.2+). The
// service is guarded and best-effort: on a host without plugin-inventory, it returns an
// empty list and the client shows a graceful "nothing to fix / not available" state.
const name = 'language-switcher'
const inject = []

function apply(ctx) {
  // Plugin inventory + hardcoded-string scan. Real implementation comes in L2.2; this
  // stub proves the service seam and keeps the client's Fix-plugins flow testable.
  ctx.provide('localizer', {
    async listPlugins() {
      // Return a plain, JSON-safe list: [{ id, name, localized: boolean, sourceDirs: [] }].
      const plugins = typeof ctx.get === 'function' ? ctx.get('pluginInventory') : undefined
      if (plugins && typeof plugins.list === 'function') {
        try {
          return await plugins.list()
        } catch (error) {
          return []
        }
      }
      return []
    },
  })
}

export default { name, inject, apply }
