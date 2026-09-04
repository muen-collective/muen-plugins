// @muen/dsh-language-switcher — browser half.
// Seams a "Language & translation" row into Settings > General (settings.general.item) with a
// Fix translation action that scans the rendered UI (core + any plugin's visible copy) for
// strings not in the active language, lets you set overrides, and applies them as a persisted
// DOM overlay (survives reload/restart; never edits bundles). Sidebar globe = quick switch.
// Real host bundle-inventory scan + agent drafting come in a later slice (docs/plans/53).
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
    const OVERRIDE_KEY = 'muen:language-switcher:overrides'
    const MAX_SCAN = 200

    // ── locale dictionaries (en / zh / ko / ja, en fallback) ─────────────────
    const DICT = {
      en: {
        title: 'Language & translation',
        intro: 'Fix untranslated text across the UI and installed plugins, then set per-language overrides.',
        fix: 'Fix translation',
        scanning: 'Scanning…',
        apply: 'Apply',
        showOriginal: 'Show original',
        hideOriginal: 'Show translation',
        noResults: 'Nothing untranslated found for this page.',
        scanHint: 'Strings detected as not in the current language. Leave blank to keep the original.',
        translated: 'translated',
        skipped: 'already in language',
        globe: 'Change language',
        lang: 'Language',
        translate: 'Translate this surface',
        translateNote: 'Translating the current surface lands in the next slice (L2.6).',
      },
      zh: {
        title: '语言与翻译',
        intro: '修复整个界面与已安装插件中未翻译的文案，并按语言设置覆盖。',
        fix: '修复翻译',
        scanning: '正在扫描…',
        apply: '应用',
        showOriginal: '显示原文',
        hideOriginal: '显示译文',
        noResults: '当前页面未发现未翻译的文案。',
        scanHint: '检测到不属于当前语言的字符串。留空则保留原文。',
        translated: '已翻译',
        skipped: '已是当前语言',
        globe: '更改语言',
        lang: '语言',
        translate: '翻译当前界面',
        translateNote: '翻译当前界面将在下一阶段接入（L2.6）。',
      },
      ko: {
        title: '언어 및 번역',
        intro: 'UI와 설치된 플러그인에서 번역되지 않은 텍스트를 고치고 언어별 재정의를 설정합니다.',
        fix: '번역 수정',
        scanning: '스캔 중…',
        apply: '적용',
        showOriginal: '원문 보기',
        hideOriginal: '번역 보기',
        noResults: '이 페이지에서 번역되지 않은 항목이 없습니다.',
        scanHint: '현재 언어가 아닌 것으로 감지된 문자열입니다. 비워 두면 원문을 유지합니다.',
        translated: '번역됨',
        skipped: '이미 해당 언어',
        globe: '언어 변경',
        lang: '언어',
        translate: '현재 화면 번역',
        translateNote: '현재 화면 번역은 다음 단계에서 연결됩니다 (L2.6).',
      },
      ja: {
        title: '言語と翻訳',
        intro: 'UIとインストール済みプラグインの未翻訳テキストを修正し、言語ごとの上書きを設定します。',
        fix: '翻訳を修正',
        scanning: 'スキャン中…',
        apply: '適用',
        showOriginal: '原文を表示',
        hideOriginal: '翻訳を表示',
        noResults: 'このページに未翻訳の項目はありません。',
        scanHint: '現在の言語ではないと検出された文字列です。空欄のままにすると原文を残します。',
        translated: '翻訳済み',
        skipped: 'すでにこの言語',
        globe: '言語を変更',
        lang: '言語',
        translate: 'この画面を翻訳',
        translateNote: 'この画面の翻訳は次のスライスで接続されます (L2.6).',
      },
      fr: {
        title: 'Langue et traduction',
        intro: 'Corriger le texte non traduit dans l’interface et les plugins installés, puis définir des remplacements par langue.',
        fix: 'Corriger la traduction',
        scanning: 'Analyse…',
        apply: 'Appliquer',
        showOriginal: 'Afficher l’original',
        hideOriginal: 'Afficher la traduction',
        noResults: 'Aucun texte non traduit trouvé sur cette page.',
        scanHint: 'Chaînes détectées comme n’étant pas dans la langue courante. Laissez vide pour conserver l’original.',
        translated: 'Traduit',
        skipped: 'déjà dans la langue',
        globe: 'Changer la langue',
        lang: 'Langue',
        translate: 'Traduire cette surface',
        translateNote: 'La traduction de la surface courante arrivera dans le prochain volet (L2.6).',
      },
      es: {
        title: 'Idioma y traducción',
        intro: 'Corrige el texto sin traducir en la interfaz y los plugins instalados, y define traducciones por idioma.',
        fix: 'Corregir traducción',
        scanning: 'Analizando…',
        apply: 'Aplicar',
        showOriginal: 'Mostrar original',
        hideOriginal: 'Mostrar traducción',
        noResults: 'No se encontró texto sin traducir en esta página.',
        scanHint: 'Cadena detectada como no perteneciente al idioma actual. Déjalo vacío para conservar el original.',
        translated: 'Traducido',
        skipped: 'ya en el idioma',
        globe: 'Cambiar idioma',
        lang: 'Idioma',
        translate: 'Traducir esta superficie',
        translateNote: 'La traducción de la superficie actual llegará en la próxima fase (L2.6).',
      },
    }

    // ── data-driven language set (en/zh are DSH built-ins; we register the rest) ──
    // Adding a language = one entry here (id/label/fallback) + a CORE_DICTS block.
    const LOCALES = {
      ko: { label: '한국어', fallback: 'en' },
      ja: { label: '日本語', fallback: 'en' },
      fr: { label: 'Français', fallback: 'en' },
      es: { label: 'Español', fallback: 'en' },
    }

    // Curated (plan 53 option A) dictionaries for the central namespaces our clients touch.
    // Starter subset; the Fix-translation overlay grows coverage on demand.
    const CORE_DICTS = {
      ko: {
        common: { ok: '확인', cancel: '취소', close: '닫기', save: '저장', copy: '복사', search: '검색', loading: '불러오는 중…', retry: '다시 시도', delete: '삭제', edit: '편집', submit: '제출' },
        'settings.locale': { 'language.title': '언어' },
        sidebar: { 'toggle.open': '사이드바 열기', 'toggle.collapse': '사이드바 접기', 'session.new': '새 세션' },
        conversation: { 'placeholder.default': '에이전트에게 메시지 보내기', 'input.send': '보내기', 'input.stop': '중지' },
        settings: { trigger: '설정', title: '설정', 'general.nav': '일반' },
      },
      ja: {
        common: { ok: 'OK', cancel: 'キャンセル', close: '閉じる', save: '保存', copy: 'コピー', search: '検索', loading: '読み込み中…', retry: '再試行', delete: '削除', edit: '編集', submit: '送信' },
        'settings.locale': { 'language.title': '言語' },
        sidebar: { 'toggle.open': 'サイドバーを開く', 'toggle.collapse': 'サイドバーを折りたたむ', 'session.new': '新規セッション' },
        conversation: { 'placeholder.default': 'エージェントにメッセージを送信', 'input.send': '送信', 'input.stop': '停止' },
        settings: { trigger: '設定', title: '設定', 'general.nav': '一般' },
      },
      fr: {
        common: { ok: 'OK', cancel: 'Annuler', close: 'Fermer', save: 'Enregistrer', copy: 'Copier', search: 'Rechercher', loading: 'Chargement…', retry: 'Réessayer', delete: 'Supprimer', edit: 'Modifier', submit: 'Envoyer' },
        'settings.locale': { 'language.title': 'Langue' },
        sidebar: { 'toggle.open': 'Ouvrir la barre latérale', 'toggle.collapse': 'Replier la barre latérale', 'session.new': 'Nouvelle session' },
        conversation: { 'placeholder.default': 'Envoyer un message à l’agent', 'input.send': 'Envoyer', 'input.stop': 'Arrêter' },
        settings: { trigger: 'Paramètres', title: 'Paramètres', 'general.nav': 'Général' },
      },
      es: {
        common: { ok: 'Aceptar', cancel: 'Cancelar', close: 'Cerrar', save: 'Guardar', copy: 'Copiar', search: 'Buscar', loading: 'Cargando…', retry: 'Reintentar', delete: 'Eliminar', edit: 'Editar', submit: 'Enviar' },
        'settings.locale': { 'language.title': 'Idioma' },
        sidebar: { 'toggle.open': 'Abrir la barra lateral', 'toggle.collapse': 'Plegar la barra lateral', 'session.new': 'Nueva sesión' },
        conversation: { 'placeholder.default': 'Enviar un mensaje al agente', 'input.send': 'Enviar', 'input.stop': 'Detener' },
        settings: { trigger: 'Ajustes', title: 'Ajustes', 'general.nav': 'General' },
      },
    }

    function activeLang() {
      try {
        const l = (typeof document !== 'undefined' && document.documentElement.lang) || 'en'
        if (l.startsWith('zh')) return 'zh'
        if (l.startsWith('ko')) return 'ko'
        if (l.startsWith('ja')) return 'ja'
        if (l.startsWith('fr')) return 'fr'
        if (l.startsWith('es')) return 'es'
        return 'en'
      } catch { return 'en' }
    }

    function translate(key) {
      const dict = DICT[activeLang()] || DICT.en
      return dict[key] || DICT.en[key] || key
    }

    function useSyncExternalStoreSafe(sub, get) {
      return React.useSyncExternalStore
        ? React.useSyncExternalStore(sub, get, get)
        : (React.useState(get)[0])
    }

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

    // ── DOM scan + language heuristic ───────────────────────────────────────
    const SKIP = 'script,style,code,pre,textarea,input,select,option,[contenteditable="true"],[data-ls-skip]'

    function detectScript(text) {
      let latin = 0; let han = 0; let hangul = 0; let kana = 0
      for (const ch of text) {
        const c = ch.codePointAt(0)
        if ((c >= 0x41 && c <= 0x5a) || (c >= 0x61 && c <= 0x7a)) latin++
        else if (c >= 0x1100 && c <= 0x11ff) hangul++
        else if ((c >= 0x3040 && c <= 0x30ff) || (c >= 0x31f0 && c <= 0x31ff)) kana++
        else if (c >= 0x2e80 && c <= 0x9fff) han++
      }
      return { latin, han, hangul, kana }
    }

    function isUntranslated(text, target) {
      const s = detectScript(text)
      const hasKana = s.kana > 0
      const hasHangul = s.hangul > 0
      const hasHan = s.han > 0
      const hasLatin = s.latin > 0
      const meaningful = Math.max(s.latin, s.han, s.hangul, s.kana)
      if (meaningful === 0) return false
      if (target === 'ja') return !hasKana && !hasHangul // already-Japanese has kana
      if (target === 'ko') return !hasHangul             // already-Korean has hangul
      if (target === 'zh') return hasLatin > (s.han * 0) // latin-dominant = not Chinese
      // target en (or fallback): flag CJK/hangul heavy text
      return (hasHan + hasHangul + hasKana) > hasLatin
    }

    function collectUntranslated(target) {
      const seen = new Set()
      const out = []
      if (typeof document === 'undefined' || !document.body) return out
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null)
      let node
      while ((node = walker.nextNode())) {
        if (out.length >= MAX_SCAN) break
        const parent = node.parentElement
        if (!parent) continue
        if (parent.closest(SKIP)) continue
        const text = (node.nodeValue || '').replace(/\s+/g, ' ').trim()
        if (text.length < 2 || text.length > 400) continue
        if (seen.has(text)) continue
        if (!isUntranslated(text, target)) continue
        seen.add(text)
        out.push(text)
      }
      return out
    }

    // ── persisted overlay engine ────────────────────────────────────────────
    function readOverrides(target) {
      try {
        const raw = localStorage.getItem(OVERRIDE_KEY + ':' + target)
        return raw ? JSON.parse(raw) : null
      } catch { return null }
    }
    function writeOverrides(target, map) {
      try { localStorage.setItem(OVERRIDE_KEY + ':' + target, JSON.stringify(map)) } catch { /* noop */ }
    }

    const originals = new WeakMap()
    let overlay = { target: activeLang(), map: readOverrides(activeLang()), showOriginal: false }
    let overlayObs = null

    function applyOverlay() {
      const { map, showOriginal } = overlay
      if (!map || typeof document === 'undefined' || !document.body) return
      if (overlayObs) overlayObs.disconnect()
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null)
      let node
      while ((node = walker.nextNode())) {
        const parent = node.parentElement
        if (!parent || parent.closest(SKIP)) continue
        const value = node.nodeValue
        const tgt = map[value]
        if (!tgt || tgt.trim() === '') continue
        if (!originals.has(node)) originals.set(node, value)
        const next = showOriginal ? originals.get(node) : tgt
        if (node.nodeValue !== next) node.nodeValue = next
      }
      if (overlayObs) overlayObs.observe(document.body, { childList: true, subtree: true, characterData: true })
    }

    function refreshOverlay() {
      overlay = { target: activeLang(), map: readOverrides(activeLang()), showOriginal: overlay.showOriginal }
      applyOverlay()
    }

    function startOverlay() {
      if (typeof MutationObserver !== 'undefined' && typeof document !== 'undefined') {
        overlayObs = new MutationObserver(() => refreshOverlay())
        overlayObs.observe(document.body, { childList: true, subtree: true, characterData: true })
      }
      refreshOverlay()
    }

    function toggleOriginal() {
      overlay.showOriginal = !overlay.showOriginal
      applyOverlay()
    }

    function apply(ctx) {
      // ── General row ────────────────────────────────────────────────────────
      function LanguageTranslateRow() {
        const [open, setOpen] = React.useState(false)
        const [scanning, setScanning] = React.useState(false)
        const [items, setItems] = React.useState([])

        const runScan = () => {
          setScanning(true)
          const target = activeLang()
          const src = collectUntranslated(target)
          const existing = readOverrides(target) || {}
          setItems(src.map((text) => ({ source: text, target: existing[text] || '' })))
          setScanning(false)
        }

        const applyTranslations = () => {
          const target = activeLang()
          const map = {}
          for (const it of items) if (it.target.trim()) map[it.source] = it.target.trim()
          writeOverrides(target, map)
          overlay = { target, map, showOriginal: false }
          setOpen(false)
          refreshOverlay()
        }

        return h('div', { style: { display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 640 } },
          h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 } },
            h('span', { style: { color: 'var(--dsw-alias-label-primary)', fontSize: 14, fontWeight: 400 } }, translate('title')),
            h('div', { style: { display: 'flex', gap: 8, alignItems: 'center' } },
              h('button', {
                type: 'button',
                onClick: () => { setOpen((v) => !v); if (!open) runScan() },
                style: btnStyle(),
              }, scanning ? translate('scanning') : translate('fix')),
              h('button', {
                type: 'button',
                onClick: () => { toggleOriginal(); setOpen(false) },
                style: btnStyle(),
              }, overlay.showOriginal ? translate('hideOriginal') : translate('showOriginal')))),
          h('p', { style: { color: 'var(--dsw-alias-label-secondary)', fontSize: 12, lineHeight: 1.6, margin: 0 } }, translate('intro')),
          open && h('div', { style: { display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 0' } },
            h('p', { style: { color: 'var(--dsw-alias-label-tertiary)', fontSize: 11, margin: 0 } }, translate('scanHint')),
            (!items.length
              ? h('span', { style: { color: 'var(--dsw-alias-label-secondary)', fontSize: 13 } }, translate('noResults'))
              : items.map((it, i) => h('div', {
                  key: it.source + i,
                  style: { display: 'flex', flexDirection: 'column', gap: 4, border: '1px solid var(--dsw-alias-border-l2)', borderRadius: 8, padding: '8px 10px', background: 'var(--dsw-alias-bg-layer-1)' },
                },
                  h('span', { style: { color: 'var(--dsw-alias-label-primary)', fontSize: 13, overflowWrap: 'anywhere' } }, it.source),
                  h('input', {
                    type: 'text',
                    value: it.target,
                    placeholder: translate('translated'),
                    onChange: (e) => setItems(items.map((x, j) => (j === i ? { ...x, target: e.target.value } : x))),
                    style: { font: 'inherit', fontSize: 13, color: 'var(--dsw-alias-label-primary)', background: 'var(--dsw-alias-bg-layer-2)', border: '1px solid var(--dsw-alias-border-l2)', borderRadius: 6, padding: '5px 8px', outline: 'none' },
                  })))),
            h('button', { type: 'button', onClick: applyTranslations, style: { ...btnStyle(), background: 'var(--dsw-alias-state-business-primary)', color: '#fff', alignSelf: 'flex-start' } }, translate('apply'))),
        )
      }

      // ── sidebar globe: quick language switch ───────────────────────────────
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
          return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
        }, [open])

        const overridden = active && active !== 'en'

        return h('div', { style: { position: 'relative' } },
          h('button', {
            type: 'button',
            'aria-label': translate('globe'), title: translate('lang'),
            'aria-haspopup': 'menu', 'aria-expanded': open,
            onClick: () => { setOpen((v) => !v); setNote('') },
            style: { display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', background: 'transparent', border: 'none', color: 'var(--dsw-alias-label-primary)', padding: 0, font: 'inherit', fontSize: 12 },
          },
            overridden
              ? h('span', { style: { color: 'var(--dsw-alias-label-primary)', fontWeight: 600 } }, activeLabel)
              : h(GlobeGlyph)),
          open && h('div', {
            ref: menuRef, role: 'menu',
            style: { position: 'absolute', right: 0, bottom: 'calc(100% + 6px)', zIndex: 1000, minWidth: 168, background: 'var(--dsw-alias-bg-layer-2)', border: '1px solid var(--dsw-alias-border-l2)', borderRadius: 8, padding: 4, boxShadow: 'var(--dsw-shadow-lv1)' },
          },
            locales.map((l) => h('button', {
              key: l.id, role: 'menuitem', type: 'button',
              onClick: () => { try { if (locale && typeof locale.setLocale === 'function') locale.setLocale(l.id) } catch { /* noop */ } setOpen(false) },
              style: { display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '6px 10px', textAlign: 'left', cursor: 'pointer', background: l.id === active ? 'var(--dsw-alias-interactive-bg-hover)' : 'transparent', color: 'var(--dsw-alias-label-primary)', border: 'none', borderRadius: 6, font: 'inherit', fontSize: 13 },
            },
              h('span', null, l.label),
              l.id === active && h('span', { style: { color: 'var(--dsw-alias-state-business-primary)' } }, '✓'))),
            h('div', { style: { borderTop: '1px solid var(--dsw-alias-border-l2)', margin: '4px 0' } }),
            h('button', {
              type: 'button', role: 'menuitem',
              onClick: () => { setNote(translate('translateNote')); setOpen(false) },
              style: { display: 'flex', width: '100%', alignItems: 'center', gap: 8, padding: '6px 10px', textAlign: 'left', cursor: 'pointer', background: 'transparent', color: 'var(--dsw-alias-label-primary)', border: 'none', borderRadius: 6, font: 'inherit', fontSize: 13 },
            },
              h('span', null, translate('translate'))),
            note && h('div', { style: { padding: '0 10px 6px', color: 'var(--dsw-alias-label-secondary)', fontSize: 11 } }, note)))
      }

      // Register own locale dictionaries.
      try {
        const locale = typeof ctx.get === 'function' ? ctx.get('locale') : undefined
        if (locale && typeof locale.register === 'function') {
          locale.register(NS, { en: DICT.en, zh: DICT.zh, ko: DICT.ko, ja: DICT.ja, fr: DICT.fr, es: DICT.es })
        }
        if (locale && typeof locale.addLanguage === 'function') {
          for (const [id, meta] of Object.entries(LOCALES)) {
            try { locale.addLanguage({ id, label: meta.label, fallback: meta.fallback }) } catch { /* already registered */ }
          }
          for (const [id, dicts] of Object.entries(CORE_DICTS)) {
            for (const [ns, dict] of Object.entries(dicts)) {
              try { locale.register(ns, id, dict) } catch { /* duplicate (ns, locale) or unknown namespace */ }
            }
          }
        }
      } catch { /* locale optional */ }

      // Mount the persisted overlay: apply on boot + watch DOM for late-arriving text.
      startOverlay()

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

    function btnStyle() {
      return {
        font: 'inherit', fontSize: 13, cursor: 'pointer', padding: '5px 12px',
        borderRadius: 7, border: '1px solid var(--dsw-alias-border-l2)',
        background: 'var(--dsw-alias-bg-layer-2)', color: 'var(--dsw-alias-label-primary)',
      }
    }

    return { inject: ['slots'], apply }
  },
})
