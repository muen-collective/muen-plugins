// @muen/dsh-language-switcher — browser half.
// Seams a "Language & translation" row into Settings > General (settings.general.item) with a
// Fix plugins action that detects installed plugins that are not properly localized (L2.1
// slice: the row renders; the scan/patch flow is stubbed — see L2.2+ in docs/plans/53).
//
// Loader format: one self-contained script registered via window.__ModuleLoader__.
// React arrives via factory(require); the DSH slot registry comes from ctx.slots.
window.__ModuleLoader__.load({
  id: '@muen/dsh-language-switcher',
  factory: (require) => {
    const React = require('react')
    const h = React.createElement

    const NS = 'language-switcher'
    const ROW_ID = 'language-translate'

    // ── locale dictionaries (en / zh / ko / ja, en fallback) ─────────────────
    const DICT = {
      en: {
        title: 'Language & translation',
        intro: 'Fix installed plugins that are not properly localized, or translate the current surface.',
        fix: 'Fix plugins',
        scanning: 'Scanning…',
        ok: 'All good — no unlocalized plugins found.',
        demoNote: 'Preview (real plugin scan is wired in the next slice).',
        fixture: 'example-hardcoded-plugin',
        globe: 'Change language',
        lang: 'Language',
        translate: 'Translate this surface',
        translateNote: 'Translating the current surface lands in the next slice (L2.6).',
      },
      zh: {
        title: '语言与翻译',
        intro: '修复未正确本地化的已安装插件，或翻译当前界面。',
        fix: '修复插件',
        scanning: '正在扫描…',
        ok: '一切正常——未发现未本地化的插件。',
        demoNote: '预览（真实插件扫描将在下一阶段接入）。',
        fixture: '示例硬编码插件',
        globe: '更改语言',
        lang: '语言',
        translate: '翻译当前界面',
        translateNote: '翻译当前界面将在下一阶段接入（L2.6）。',
      },
      ko: {
        title: '언어 및 번역',
        intro: '제대로 지역화되지 않은 설치 플러그인을 고치거나 현재 화면을 번역합니다.',
        fix: '플러그인 수정',
        scanning: '스캔 중…',
        ok: '모두 정상입니다 — 지역화되지 않은 플러그인이 없습니다.',
        demoNote: '미리보기 (실제 플러그인 스캔은 다음 단계에서 연결됩니다).',
        fixture: '예시 하드코딩 플러그인',
        globe: '언어 변경',
        lang: '언어',
        translate: '현재 화면 번역',
        translateNote: '현재 화면 번역은 다음 단계에서 연결됩니다 (L2.6).',
      },
      ja: {
        title: '言語と翻訳',
        intro: 'ローカライズされていないインストール済みプラグインを修正するか、現在の画面を翻訳します。',
        fix: 'プラグインを修正',
        scanning: 'スキャン中…',
        ok: '問題ありません — ローカライズされていないプラグインはありません。',
        demoNote: 'プレビュー (実際のプラグインスキャンは次のスライスで接続されます).',
        fixture: '例: ハードコードされたプラグイン',
        globe: '言語を変更',
        lang: '言語',
        translate: 'この画面を翻訳',
        translateNote: 'この画面の翻訳は次のスライスで接続されます (L2.6).',
      },
    }

    function activeLang() {
      try {
        const l = (typeof document !== 'undefined' && document.documentElement.lang) || 'en'
        if (l.startsWith('zh')) return 'zh'
        if (l.startsWith('ko')) return 'ko'
        if (l.startsWith('ja')) return 'ja'
        return 'en'
      } catch { return 'en' }
    }

    function translate(key) {
      const dict = DICT[activeLang()] || DICT.en
      return dict[key] || DICT.en[key] || key
    }

    // useSyncExternalStore, guarded for older React builds.
    function useSyncExternalStoreSafe(sub, get) {
      return React.useSyncExternalStore
        ? React.useSyncExternalStore(sub, get, get)
        : (React.useState(get)[0])
    }

    // A static globe glyph (no icon dependency).
    function GlobeGlyph() {
      return React.createElement('svg', {
        width: 15, height: 15, viewBox: '0 0 24 24', fill: 'none',
        stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
        'aria-hidden': true,
      },
        React.createElement('circle', { cx: 12, cy: 12, r: 10 }),
        React.createElement('line', { x1: 2, y1: 12, x2: 22, y2: 12 }),
        React.createElement('path', { d: 'M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z' }),
      )
    }

    function apply(ctx) {
      // ── the General row (owner supplies no props; the row draws itself) ──────
      function LanguageTranslateRow() {
        const [open, setOpen] = React.useState(false)
        const [scanning, setScanning] = React.useState(false)
        const [result, setResult] = React.useState(null)

        const runScan = async () => {
          setScanning(true)
          let plugins
          try {
            const localizer = typeof ctx.get === 'function' ? ctx.get('localizer') : undefined
            plugins = localizer && typeof localizer.listPlugins === 'function'
              ? await localizer.listPlugins() : []
          } catch { plugins = [] }
          // L2.1 preview: if the host backs nothing non-empty, show a demo fixture so the
          // founder can eyeball the intended UX. Real scan replaces this in L2.2.
          setResult(plugins && plugins.length ? plugins : [{ id: 'fixture', name: translate('fixture'), localized: false }])
          setScanning(false)
        }

        return h('div', { style: { display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 620 } },
          h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 } },
            h('span', { style: { color: 'var(--dsw-alias-label-primary)', fontSize: 14, fontWeight: 400 } },
              translate('title')),
            h('button', {
              type: 'button',
              onClick: () => { setOpen((v) => !v); if (!open) runScan() },
              style: {
                font: 'inherit', fontSize: 13, cursor: 'pointer', padding: '5px 12px',
                borderRadius: 7, border: '1px solid var(--dsw-alias-border-l2)',
                background: 'var(--dsw-alias-bg-layer-2)', color: 'var(--dsw-alias-label-primary)',
              },
            }, scanning ? translate('scanning') : translate('fix'))),
          h('p', { style: { color: 'var(--dsw-alias-label-secondary)', fontSize: 12, lineHeight: 1.6, margin: 0 } },
            translate('intro')),
          open && h('div', { style: { display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 0' } },
            (result && result.length
              ? result.map((p) => h('div', {
                  key: p.id,
                  style: {
                    border: '1px solid var(--dsw-alias-border-l2)', borderRadius: 8,
                    padding: '8px 12px', background: 'var(--dsw-alias-bg-layer-1)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10,
                  },
                },
                  h('span', { style: { color: 'var(--dsw-alias-label-primary)', fontSize: 13 } }, p.name),
                  h('span', {
                    style: {
                      color: p.localized ? 'var(--dsw-alias-state-success-primary)' : 'var(--dsw-alias-state-error-primary)',
                      fontSize: 11,
                    },
                  }, p.localized ? 'OK' : 'unlocalized'),
                ))
              : h('span', { style: { color: 'var(--dsw-alias-label-secondary)', fontSize: 13 } }, translate('ok'))),
            h('span', { style: { color: 'var(--dsw-alias-label-tertiary)', fontSize: 11 } }, translate('demoNote'))),
        )
      }

      // ── sidewalk globe: quick language switch (+ Translate entry) ───────────
      function GlobeAction() {
        const locale = typeof ctx.get === 'function' ? ctx.get('locale') : undefined
        const state = useSyncExternalStoreSafe(
          (fn) => (locale && typeof locale.subscribe === 'function') ? locale.subscribe(fn) : () => {},
          () => (locale && typeof locale.getSnapshot === 'function')
            ? locale.getSnapshot() : { active: '', locales: [], revision: -1 },
        )
        const active = (state && state.active) || ''
        const locales = (state && state.locales) || []
        const activeLabel = locales.find((l) => l.id === active)?.label || ''
        const [open, setOpen] = React.useState(false)
        const [note, setNote] = React.useState('')
        const menuRef = React.useRef(null)

        React.useEffect(() => {
          if (!open) return
          const onDown = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false) }
          const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
          document.addEventListener('mousedown', onDown)
          document.addEventListener('keydown', onKey)
          return () => {
            document.removeEventListener('mousedown', onDown)
            document.removeEventListener('keydown', onKey)
          }
        }, [open])

        // Show a native-label chip when the active language differs from the
        // English provisional default (ja/ko/zh-first users see their language at a glance).
        const overridden = active && active !== 'en'

        return h('div', { style: { position: 'relative' } },
          h('button', {
            type: 'button',
            'aria-label': translate('globe'),
            title: translate('lang'),
            'aria-haspopup': 'menu',
            'aria-expanded': open,
            onClick: () => { setOpen((v) => !v); setNote('') },
            style: {
              display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer',
              background: 'transparent', border: 'none', color: 'var(--dsw-alias-label-primary)',
              padding: 0, font: 'inherit', fontSize: 12,
            },
          },
            overridden
              ? h('span', { style: { color: 'var(--dsw-alias-label-primary)', fontWeight: 600 } }, activeLabel)
              : h(GlobeGlyph)),
          open && h('div', {
            ref: menuRef, role: 'menu',
            style: {
              position: 'absolute', right: 0, bottom: 'calc(100% + 6px)', zIndex: 1000,
              minWidth: 168, background: 'var(--dsw-alias-bg-layer-2)',
              border: '1px solid var(--dsw-alias-border-l2)', borderRadius: 8, padding: 4,
              boxShadow: 'var(--dsw-shadow-lv1)',
            },
          },
            locales.map((l) => h('button', {
              key: l.id, role: 'menuitem', type: 'button',
              onClick: () => {
                try { if (locale && typeof locale.setLocale === 'function') locale.setLocale(l.id) } catch { /* noop */ }
                setOpen(false)
              },
              style: {
                display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between',
                gap: 8, padding: '6px 10px', textAlign: 'left', cursor: 'pointer',
                background: l.id === active ? 'var(--dsw-alias-interactive-bg-hover)' : 'transparent',
                color: 'var(--dsw-alias-label-primary)', border: 'none', borderRadius: 6, font: 'inherit', fontSize: 13,
              },
            },
              h('span', null, l.label),
              l.id === active && h('span', { style: { color: 'var(--dsw-alias-state-business-primary)' } }, '✓'))),
            locales.length > 0 && h('div', { style: { borderTop: '1px solid var(--dsw-alias-border-l2)', margin: '4px 0', paddingTop: 4 } }),
            h('button', {
              type: 'button', role: 'menuitem',
              onClick: () => { setNote(translate('translateNote')); setOpen(false) },
              style: {
                display: 'flex', width: '100%', alignItems: 'center', gap: 8, padding: '6px 10px',
                textAlign: 'left', cursor: 'pointer', background: 'transparent',
                color: 'var(--dsw-alias-label-primary)', border: 'none', borderRadius: 6, font: 'inherit', fontSize: 13,
              },
            },
              h('span', null, translate('translate'))),
            note && h('div', { style: { padding: '0 10px 6px', color: 'var(--dsw-alias-label-secondary)', fontSize: 11 } }, note)))
      }

      // Register own locale dictionaries when the locale service is present.
      try {
        const locale = typeof ctx.get === 'function' ? ctx.get('locale') : undefined
        if (locale && typeof locale.register === 'function') {
          locale.register(NS, { en: DICT.en, zh: DICT.zh, ko: DICT.ko, ja: DICT.ja })
        }
      } catch { /* locale optional */ }

      // Seam the row into Settings > General (beside the native Language row, order 1).
      const slots = typeof ctx.get === 'function' ? ctx.get('slots') : undefined
      if (slots && typeof slots.inject === 'function') {
        slots.inject('settings.general.item', () => slots.register(
          { name: 'settings.general.item', id: ROW_ID, order: 1 },
          LanguageTranslateRow,
        ))
      }

      // Quick-access globe beside Settings at the sidebar foot.
      if (slots && typeof slots.inject === 'function') {
        slots.inject('sidebar.footer.action', () => slots.register(
          { name: 'sidebar.footer.action', id: 'language-switcher', order: 5 },
          GlobeAction,
        ))
      }
    }

    return { inject: ['slots'], apply }
  },
})
