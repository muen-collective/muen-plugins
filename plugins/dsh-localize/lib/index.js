// @muen/dsh-localize — host half (epic 65 L2).
//
// WHAT IS NOT HERE, AND WHY. The language surface is client-side by necessity: the catalog, the
// dictionaries and the choice all live in the harness's own locale service, which is a browser
// service (`ctx.provide('locale', …)` in `@deepseek-ai/dsh-client-locale`). A host half cannot add a
// language, so this one does not pretend to.
//
// What the host half is FOR, as the epic's later slices land: the overlay's store and scan
// (`<profile>/localizations/<plugin>/<lang>.json`, L4) and the review memory
// (`<profile>/localize-memory/<plugin>/<lang>.json`, L6) are files, and files are the host's job. It
// also registers this plugin's skills, the way `@muen/dsh-generate` registers its two.
const name = 'localize'
const inject = []

function apply() {
  // Nothing to provide yet: L1/L2 are the catalog and the globe, both client-side. The row exists so
  // the profile installs one package whose halves are named in the same place.
}

export default { name, inject, apply }
