const name = 'mitsu-brand'
const inject = []
// Provide the brand config to the client half so the rendered wordmark is
// overridable per profile (value separation). Reads this row's cordis `config`.
function apply(ctx) {
  const cfg = (ctx && ctx.config) || {}
  ctx.provide('mitsu.brand', {
    wordmark: cfg.wordmark,
    textColor: cfg.textColor,
    dotColor: cfg.dotColor,
    fontFamily: cfg.fontFamily,
    fontSize: cfg.fontSize,
    fontWeight: cfg.fontWeight,
    letterSpacing: cfg.letterSpacing,
  })
}
export default { name, inject, apply }
