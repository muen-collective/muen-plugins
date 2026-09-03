// @muen/mitsu-brand — browser half.
// Loader format: one self-contained script registered via window.__ModuleLoader__.
// React arrives via factory(require), and the DSH slot registry comes from ctx.slots.
//
// Value separation: the brand identity (wordmark text, colors, font) is overridable per
// profile so the published plugin is generic + re-brandable. The node half reads this
// brand's cordis config row and provides a `mitsu.brand` service; here we read it guarded —
// any absence or loader difference degrades to the default Mitsu identity, never a crash
// or a blank render.
window.__ModuleLoader__.load({
  id: '@muen/mitsu-brand',
  factory: (require) => {
    const React = require('react')
    const h = React.createElement

    // NEUTRAL defaults: the published market plugin is a generic brand slot. No client
    // (or Muen) wordmark or brand font is baked in — a profile supplies its own via the
    // `config` block (see the plugin's cordis.patch.yml / a product patch overlay). With
    // no config the slot renders just the neutral mark, so the market card stays generic.
    const DEFAULT_BRAND = {
      // Wordmark text (whatever the profile configures). Empty = neutral (mark only).
      wordmark: '',
      // Text + dot colors track DSH design tokens (legible in light + dark).
      text: 'var(--dsw-alias-label-primary)',
      dot: 'var(--dsw-alias-state-business-primary)',
      font: 'ui-sans-serif, system-ui, sans-serif',
      fontSize: 18,
      fontWeight: 700,
      letterSpacing: '0.02em',
    }

    const readBrand = (ctx) => {
      let cfg = {}
      try {
        const get = typeof ctx?.get === 'function' ? ctx.get : () => null
        cfg = get('mitsu.brand') || get('brand') || get('config') || {}
      } catch {
        // Any missing/odd config channel falls through to the defaults above.
      }
      return {
        wordmark: cfg.wordmark || DEFAULT_BRAND.wordmark,
        text: cfg.textColor || DEFAULT_BRAND.text,
        dot: cfg.dotColor || DEFAULT_BRAND.dot,
        font: cfg.fontFamily || DEFAULT_BRAND.font,
        fontSize: cfg.fontSize || DEFAULT_BRAND.fontSize,
        fontWeight: cfg.fontWeight || DEFAULT_BRAND.fontWeight,
        letterSpacing: cfg.letterSpacing || DEFAULT_BRAND.letterSpacing,
      }
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        const BRAND = readBrand(ctx)

        const Dot = ({ size = 6 }) =>
          h('span', {
            'aria-hidden': true,
            style: {
              display: 'inline-block',
              width: size,
              height: size,
              marginLeft: '0.2em',
              borderRadius: 999,
              backgroundColor: BRAND.dot,
              verticalAlign: 'baseline',
              transform: 'translateY(-1px)',
            },
          })

        const BrandName = () =>
          h('span', {
            style: {
              color: BRAND.text,
              fontFamily: BRAND.font,
              fontWeight: BRAND.fontWeight,
              fontSize: BRAND.fontSize,
              letterSpacing: BRAND.letterSpacing,
              whiteSpace: 'nowrap',
              display: 'inline-flex',
              alignItems: 'baseline',
            },
          }, BRAND.wordmark, h(Dot, { size: 6 }))

        const SidebarMark = () => null

        const HeroMark = () => null

        ctx.slots.inject('sidebar.brand.mark', () =>
          ctx.slots.inject('sidebar.brand.name', () =>
            ctx.slots.inject('conversation.hero.brand.mark', function* () {
              yield ctx.slots.register({ name: 'sidebar.brand.mark' }, SidebarMark)
              yield ctx.slots.register({ name: 'sidebar.brand.name' }, BrandName)
              yield ctx.slots.register({ name: 'conversation.hero.brand.mark' }, HeroMark)
            })))
      },
    }
  },
})
