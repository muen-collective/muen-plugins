// @muen/dsh-brand-swap — browser half (Settings → Brand page).
// Loader format: one self-contained script registered via window.__ModuleLoader__.
// React arrives via factory(require); the DSH slot registry comes from ctx.slots.
//
// White-label brand plugin: a Brand OS configures its identity through this row's
// cordis `config` (wordmark text / colors / font — legacy v0.1 path) or, from v0.2, by
// uploading transparent PNG / SVG logos + hero mark in a Settings → Brand page. Values
// are persisted via the host settings doc when a `settingsScope` is available, otherwise
// in localStorage — never by editing the installed bundle, so it survives plugin updates.
window.__ModuleLoader__.load({
  id: '@muen/dsh-brand-swap',
  factory: (require) => {
    const React = require('react')
    const h = React.createElement

    const NS = 'brand-swap'
    const LS_KEY = 'muen:brand-swap:logos'
    const MAX_BYTES = 1024 * 1024 // 1 MB per image
    const ACCEPT_IMAGE = 'image/png,image/svg+xml'

    // ── locale dictionaries (en / zh / ko / ja, en fallback) ──────────────
    const DICT = {
      en: {
        title: 'Brand',
        intro: 'Swap in your brand: upload logos for light and dark themes and choose the hero mark.',
        lightLabel: 'Logo — light theme',
        darkLabel: 'Logo — dark theme',
        choose: 'Choose image…',
        replace: 'Replace',
        remove: 'Remove',
        preview: 'Preview',
        sizeHint:
          'Transparent PNG or SVG. Lockups: artwork ≥ 48 px tall (2× of the 24 px render) with side padding. Square marks: ≥ 96 px. The page height-caps it — wide is fine, tall is not.',
        heroShow: 'Show hero brand mark',
        heroIconLabel: 'Square icon — 34×34',
        heroHint:
          'The hero seat above the composer only fits a square 34 px mark — wide lockups won’t fit. Upload a transparent square PNG or SVG to use it.',
        saved: 'Saved — your brand is live now.',
        saveBtn: 'Save brand',
        revertBtn: 'Revert',
        dirtyHint: 'Changes apply when you click “Save brand”.',
        localOnly: 'Warning: saved to this browser only — it will be lost when the app restarts.',
        invalidType: 'Please choose a PNG or SVG file.',
        tooLarge: 'That image is larger than 1 MB — please use a smaller export.',
        readError: 'Could not read that file — please try again.',
        notConfigured: 'No wordmark configured yet — upload a logo above or configure the row.',
      },
      zh: {
        title: '品牌',
        intro: '换上你的品牌：上传浅色/深色主题的标志，并选择起始页标志。',
        lightLabel: '标志 — 浅色主题',
        darkLabel: '标志 — 深色主题',
        choose: '选择图片…',
        replace: '替换',
        remove: '移除',
        preview: '预览',
        sizeHint:
          '透明 PNG 或 SVG。横向锁型标志：图案高度 ≥ 48px（渲染高度 24px 的 2 倍）并留出边距；方形标志 ≥ 96px。页面按高度约束显示——宽度不限，高度不可超。',
        heroShow: '显示起始页品牌标志',
        heroIconLabel: '方形图标 — 34×34',
        heroHint: '输入框上方的起始页槽位只放得下 34px 方形标志——宽锁型标志放不下。请上传透明方形 PNG 或 SVG。',
        saved: '已保存——品牌已生效。',
        saveBtn: '保存品牌',
        revertBtn: '还原',
        dirtyHint: '修改需点击“保存品牌”后才会生效。',
        localOnly: '警告：仅保存在当前浏览器中，应用重启后会丢失。',
        invalidType: '请选择 PNG 或 SVG 文件。',
        tooLarge: '该图片超过 1MB，请使用更小的导出。',
        readError: '无法读取该文件，请重试。',
        notConfigured: '尚未配置文字标识——请在上方上传标志，或配置该插件的 config。',
      },
      ko: {
        title: '브랜드',
        intro: '브랜드 교체: 라이트/다크 테마용 로고와 히어로 마크를 설정하세요.',
        lightLabel: '로고 — 라이트 테마',
        darkLabel: '로고 — 다크 테마',
        choose: '이미지 선택…',
        replace: '교체',
        remove: '제거',
        preview: '미리보기',
        sizeHint:
          '투명 PNG 또는 SVG. 가로형 로고: 그림 높이 ≥ 48px(24px 렌더의 2배), 여백 포함. 정사각형: ≥ 96px. 높이 제한으로 표시됩니다 — 가로는 자유, 높이는 불가.',
        heroShow: '히어로 브랜드 마크 표시',
        heroIconLabel: '정사각형 아이콘 — 34×34',
        heroHint: '컴포저 위 히어로 슬롯은 34px 정사각형만 맞습니다 — 넓은 로고는 안 맞아요. 투명 정사각형 PNG 또는 SVG를 업로드하세요.',
        saved: '저장됨 — 브랜드가 적용되었습니다.',
        saveBtn: '브랜드 저장',
        revertBtn: '되돌리기',
        dirtyHint: '변경 사항은 “브랜드 저장”을 누르면 적용됩니다.',
        localOnly: '경고: 이 브라우저에만 저장됨 — 앱을 다시 시작하면 사라집니다.',
        invalidType: 'PNG 또는 SVG 파일을 선택해 주세요.',
        tooLarge: '이미지가 1MB를 초과합니다. 더 작은 파일을 사용하세요.',
        readError: '파일을 읽을 수 없습니다. 다시 시도해 주세요.',
        notConfigured: '워드마크가 아직 없습니다 — 위에서 로고를 올리거나 config를 설정하세요.',
      },
      ja: {
        title: 'ブランド',
        intro: 'ブランドを差し替え: ライト/ダーク用ロゴとヒーローマークを設定します。',
        lightLabel: 'ロゴ — ライトテーマ',
        darkLabel: 'ロゴ — ダークテーマ',
        choose: '画像を選択…',
        replace: '差し替え',
        remove: '削除',
        preview: 'プレビュー',
        sizeHint:
          '透明PNGまたはSVG。横長ロゴ: 図柄の高さは48px以上(24px表示の2倍)・余白付き。正方形マーク: 96px以上。高さ上限で表示されます — 幅は自由、高さは厳守。',
        heroShow: 'ヒーローのブランドマークを表示',
        heroIconLabel: '正方形アイコン — 34×34',
        heroHint: 'コンポーザー上のヒーロースロットは34pxの正方形のみ収まります — 横長は入りません。透明の正方形PNGまたはSVGをアップロードしてください。',
        saved: '保存しました — ブランドが反映されました。',
        saveBtn: 'ブランドを保存',
        revertBtn: '元に戻す',
        dirtyHint: '変更は「ブランドを保存」を押すと反映されます。',
        localOnly: '警告: このブラウザのみに保存 — 再起動すると失われます。',
        invalidType: 'PNG または SVG ファイルを選択してください。',
        tooLarge: '画像が1MBを超えています。より小さい書き出しを使用してください。',
        readError: 'ファイルを読み込めませんでした。もう一度お試しください。',
        notConfigured: 'ワードマーク未設定です — 上でロゴをアップロードするか、configを設定してください。',
      },
    }

    // ── persistence: settings doc when available, else localStorage ───────
    let SCOPE = null
    let VALUE = { logoLight: '', logoDark: '', heroShow: false, heroIcon: '' }
    let REV = 0
    const listeners = new Set()
    const STRING_KEYS = ['logoLight', 'logoDark', 'heroIcon']

    function readPersisted() {
      const out = { logoLight: '', logoDark: '', heroShow: false, heroIcon: '' }
      const applyString = (source, target) => {
        for (const key of STRING_KEYS) {
          if (typeof source[key] === 'string' && source[key]) target[key] = source[key]
        }
        if (typeof source.heroShow === 'boolean') target.heroShow = source.heroShow
        else if (source.heroShow === 'true' || source.heroShow === 'false') target.heroShow = source.heroShow === 'true'
      }
      // Read the settings scope AND the localStorage cache independently, then merge.
      // The old code bailed as soon as the scope had *any* truthy field, so if the
      // scope carried e.g. `heroShow` but the (large) SVG logo had failed to write or
      // had been truncated there, a logo that WAS in localStorage was silently dropped —
      // the brand reverted to the wordmark+dot fallback after a reload / language switch.
      const fromScope = { logoLight: '', logoDark: '', heroShow: false, heroIcon: '' }
      try {
        // The settings scope snapshot carries the namespace fields flat (plus a
        // `revision`), e.g. { logoLight, logoDark, heroShow, heroIcon, revision }.
        // Accept a legacy `{ value: {...} }` envelope too, for older runtimes.
        const snap = SCOPE && typeof SCOPE.getSnapshot === 'function'
          ? SCOPE.getSnapshot() : undefined
        const scopeValue = (snap && typeof snap === 'object'
          && snap.value && typeof snap.value === 'object')
          ? snap.value
          : snap
        if (scopeValue && typeof scopeValue === 'object') applyString(scopeValue, fromScope)
      } catch { /* scope may be mid-adoption */ }
      const fromLocal = { logoLight: '', logoDark: '', heroShow: false, heroIcon: '' }
      try {
        const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(LS_KEY)
        if (raw) {
          const parsed = JSON.parse(raw)
          if (parsed && typeof parsed === 'object') applyString(parsed, fromLocal)
        }
      } catch { /* ignore corrupt cache */ }
      // Merge per field. Never let an empty/truncated value in one store shadow a real
      // logo in the other: prefer the longer (uncorrupted) data URL for image fields.
      const pick = (a, b) => {
        if (!a) return b
        if (!b) return a
        return b.length > a.length ? b : a
      }
      out.logoLight = pick(fromScope.logoLight, fromLocal.logoLight)
      out.logoDark = pick(fromScope.logoDark, fromLocal.logoDark)
      out.heroIcon = pick(fromScope.heroIcon, fromLocal.heroIcon)
      out.heroShow = fromScope.heroShow || fromLocal.heroShow
      return out
    }

    // Commit one field. The value is applied locally (mirrored to the port-local
    // localStorage cache) immediately so the brand updates in-session; the
    // durable host-doc write is attempted through the settings scope and its
    // outcome reported (Promise<boolean>) — the Save flow only claims “saved”
    // when the host accepted it, because a local-only copy is lost on restart.
    // Host rejections are async (namespace unregistered, read-only provider), so
    // any thenable returned by set() is awaited and its failure turned into a
    // false instead of being swallowed.
    function persist(field, value) {
      VALUE = { ...VALUE, [field]: value }
      REV += 1
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(LS_KEY, JSON.stringify(VALUE))
        }
      } catch { /* storage may be unavailable */ }
      for (const fn of [...listeners]) fn()
      if (!SCOPE || typeof SCOPE.set !== 'function') return Promise.resolve(false)
      let outcome
      try {
        outcome = SCOPE.set(field, value)
      } catch { return Promise.resolve(false) }
      if (outcome && typeof outcome.then === 'function') {
        return outcome.then(() => true, () => false)
      }
      return Promise.resolve(true)
    }

    function subscribe(fn) {
      listeners.add(fn)
      let disposed = false
      const unsub = SCOPE && typeof SCOPE.subscribe === 'function'
        ? (() => { try { return SCOPE.subscribe(() => { VALUE = readPersisted(); for (const f of [...listeners]) f() }) } catch { return null } })()
        : null
      return () => {
        if (disposed) return
        disposed = true
        listeners.delete(fn)
        if (typeof unsub === 'function') { try { unsub() } catch { /* noop */ } }
      }
    }

    function getSnapshot() {
      return VALUE
    }

    // ── theme-aware logo CSS (switches on DSH's resolved theme attribute) ──
    const CSS = [
      '.bs-logo{max-height:20px;width:auto;max-width:100%;object-fit:contain;vertical-align:middle;flex:none}',
      '.bs-logo--dark{display:none}',
      'body[data-ds-dark-theme] .bs-logo--light{display:none}',
      'body[data-ds-dark-theme] .bs-logo--dark{display:inline-block}',
      '.bs-hero{width:34px;height:34px;object-fit:contain;display:inline-block;vertical-align:middle}',
      '.bs-brand-page{display:flex;flex-direction:column;gap:18px;max-width:620px}',
      '.bs-brand-card{border:1px solid var(--dsw-alias-border-l2);border-radius:10px;padding:14px;background:var(--dsw-alias-bg-layer-1);display:flex;flex-direction:column;gap:10px}',
      '.bs-brand-card h3{margin:0;font-size:14px;font-weight:600;color:var(--dsw-alias-label-primary)}',
      // Preview canvas matches the uploader's theme: the LIGHT-theme cell gets a
      // light canvas (its artwork is drawn for light surfaces), the DARK-theme
      // cell keeps the dark canvas. Static colors (not theme tokens) so each
      // preview reads correctly no matter which app theme is active.
      '.bs-brand-preview{min-height:64px;border:1px dashed rgba(255,255,255,.16);border-radius:8px;background:var(--dsw-static-neutral-bluish-900,#1b1b1c);display:flex;align-items:center;justify-content:center;padding:10px;overflow:hidden}',
      '.bs-brand-preview--light{background:#f4f3f0;border-color:rgba(18,18,24,.16)}',
      '.bs-brand-preview--light .bs-brand-preview--empty{color:#8a8a92}',
      '.bs-brand-preview img{max-height:44px;max-width:100%;object-fit:contain}',
      '.bs-brand-preview--empty{color:var(--dsw-alias-label-tertiary);font-size:12px}',
      '.bs-brand-hint{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:1.6;margin:0}',
      '.bs-logo-cell-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}',
      '.bs-brand-btn{font:inherit;font-size:13px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);border-radius:7px;padding:5px 12px;cursor:pointer}',
      '.bs-brand-btn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}',
      '.bs-brand-msg{font-size:13px;color:var(--dsw-alias-state-success-primary)}',
      '.bs-logo-row{display:flex;gap:12px}',
      '.bs-logo-cell{flex:1;display:flex;flex-direction:column;gap:10px;min-width:0}',
      '.bs-logo-cell-label{font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary)}',
      '.bs-switch{display:inline-flex;align-items:center;gap:10px;font-size:13px;color:var(--dsw-alias-label-primary);cursor:pointer;user-select:none}',
      '.bs-switch input{position:absolute;opacity:0;width:0;height:0;margin:0}',
      '.bs-switch .bs-switch-track{position:relative;flex:none;width:36px;height:20px;border-radius:999px;background:var(--dsw-alias-border-l2);box-shadow:inset 0 0 0 1px var(--dsw-alias-border-l2);transition:background .15s ease}',
      '.bs-switch .bs-switch-track:after{content:"";position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:var(--dsw-alias-label-primary);transition:transform .15s ease}',
      '.bs-switch input:checked + .bs-switch-track{background:var(--dsw-alias-state-business-primary);box-shadow:inset 0 0 0 1px var(--dsw-alias-state-business-primary)}',
      '.bs-switch input:checked + .bs-switch-track:after{transform:translateX(16px);background:#fff}',
      '.bs-switch input:focus-visible + .bs-switch-track{outline:2px solid var(--dsw-alias-label-tertiary);outline-offset:2px}',
      '.bs-brand-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}',
      '.bs-brand-btn--primary{background:var(--dsw-alias-state-business-primary);border-color:transparent;color:#fff;font-weight:600}',
      '.bs-brand-btn--primary:hover:not(:disabled){background:var(--dsw-alias-state-business-primary);filter:brightness(1.12)}',
      '.bs-brand-btn:disabled{opacity:.45;cursor:default}',
      '.bs-brand-msg--warn{color:var(--dsw-alias-state-warn-primary)}',
      '.bs-brand-msg--ok{color:var(--dsw-alias-state-success-primary)}',
    ].join('\n')

    function injectCss() {
      if (typeof document === 'undefined') return
      const tagId = '@muen/dsh-brand-swap/style.css'
      if (document.querySelector('style[data-plugin-css=' + JSON.stringify(tagId) + ']')) return
      const tag = document.createElement('style')
      tag.dataset.plugin = 'dsh-brand-swap'
      tag.dataset.pluginCss = tagId
      tag.textContent = CSS
      document.head.appendChild(tag)
    }

    // ── row-config values (wordmark fallback, legacy v0.1 path) ────────────
    function readRowConfig(ctx) {
      let cfg = {}
      try {
        const get = typeof ctx?.get === 'function' ? ctx.get : () => null
        cfg = get('brand') || get('config') || {}
      } catch { /* no config channel */ }
      return {
        wordmark: cfg.wordmark || '',
        text: cfg.textColor || 'var(--dsw-alias-label-primary)',
        dot: cfg.dotColor || 'var(--dsw-alias-state-business-primary)',
        font: cfg.fontFamily || 'ui-sans-serif, system-ui, sans-serif',
        fontSize: cfg.fontSize || 18,
        fontWeight: cfg.fontWeight || 700,
        letterSpacing: cfg.letterSpacing || '0.02em',
      }
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

    // Dictionary-first translation — the locator service is not relied on for
    // these strings (using it could return the raw key instead of the value).
    function translate(key) {
      const dict = DICT[activeLang()] || DICT.en
      return dict[key] || DICT.en[key] || key
    }

    // Accept PNG or SVG. SVG is rendered through an <img> data-URL, which is inert
    // (no external loads or scripts), so it is safe to persist and re-render.
    function isAcceptedImage(file) {
      return file
        && (file.type === 'image/png' || file.type === 'image/svg+xml' || /\.(png|svg)$/i.test(file.name))
    }

    function apply(ctx) {
      injectCss()
      try {
        const scopeService = typeof ctx.get === 'function' ? ctx.get('settingsScope') : undefined
        SCOPE = scopeService && typeof scopeService.bind === 'function'
          ? scopeService.bind({ namespace: 'brand-swap' })
          : null
      } catch { SCOPE = null }
      VALUE = readPersisted()

      const BRAND = readRowConfig(ctx)

      // Register own locale dictionaries when the locale service is present.
      try {
        const locale = typeof ctx.get === 'function' ? ctx.get('locale') : undefined
        if (locale && typeof locale.register === 'function') {
          const langs = { en: DICT.en, zh: DICT.zh, ko: DICT.ko, ja: DICT.ja }
          locale.register(NS, langs) // throws on duplicate (ns, locale) — single instance, safe
        }
      } catch { /* locale optional */ }

      // ── brand seats ──────────────────────────────────────────────────────
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

      const WordmarkName = () =>
        h('span', {
          'data-ls-skip': '',
          style: {
            color: BRAND.text,
            fontFamily: BRAND.font,
            fontWeight: BRAND.fontWeight,
            fontSize: BRAND.fontSize,
            letterSpacing: BRAND.letterSpacing,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: 'inline-flex',
            alignItems: 'baseline',
            minWidth: 0,
          },
        }, BRAND.wordmark, h(Dot, { size: 6 }))

      const SidebarName = () => {
        const logos = useSyncExternalStoreSafe(subscribe, getSnapshot)
        const hasLight = Boolean(logos.logoLight)
        const hasDark = Boolean(logos.logoDark)
        if (!hasLight && !hasDark) return WordmarkName()
        // One variant → always show it; both → theme-switched pair.
        if (hasLight && hasDark) {
          return h('span', { 'data-ls-skip': '', style: { display: 'inline-flex', alignItems: 'center', maxWidth: '100%', minWidth: 0, overflow: 'hidden' } },
            h('img', { key: 'light', className: 'bs-logo bs-logo--light', src: logos.logoLight, alt: '', draggable: false }),
            h('img', { key: 'dark', className: 'bs-logo bs-logo--dark', src: logos.logoDark, alt: '', draggable: false }))
        }
        const src = hasLight ? logos.logoLight : logos.logoDark
        return h('img', { 'data-ls-skip': '', className: 'bs-logo', src, alt: '', draggable: false })
      }

      const SidebarMark = () => null

      // Hero (above composer): only a square 34 px mark fits. Hidden unless the
      // Settings page enables it and a square icon is uploaded.
      const HeroMark = () => {
        const logos = useSyncExternalStoreSafe(subscribe, getSnapshot)
        if (!logos.heroShow || !logos.heroIcon) return null
        return h('img', { 'data-ls-skip': '', className: 'bs-hero', src: logos.heroIcon, alt: '', draggable: false })
      }

      ctx.slots.inject('sidebar.brand.mark', () =>
        ctx.slots.inject('sidebar.brand.name', () =>
          ctx.slots.inject('conversation.hero.brand.mark', function* () {
            yield ctx.slots.register({ name: 'sidebar.brand.mark' }, SidebarMark)
            yield ctx.slots.register({ name: 'sidebar.brand.name' }, SidebarName)
            yield ctx.slots.register({ name: 'conversation.hero.brand.mark' }, HeroMark)
          })))

      // ── Settings → Brand page (draft → explicit Save) ─────────────────────
      // Uploads and toggles are staged in local state (live previews, nothing
      // persisted). “Save brand” commits all fields through persist(), which
      // writes the host settings doc (durable) + a localStorage mirror and
      // reports whether the host write succeeded — the page warns when only the
      // browser copy was saved (lost when the app restarts and rebinds its port).
      const readFileAsDataUrl = (file, onOk, onError) => {
        const reader = new FileReader()
        reader.onload = () => onOk(String(reader.result))
        reader.onerror = () => onError(translate('readError'))
        reader.readAsDataURL(file)
      }

      const LogoCell = ({ field, label, value, onChange }) => {
        const [error, setError] = React.useState(null)
        const pick = (event) => {
          const file = event.target.files && event.target.files[0]
          event.target.value = ''
          if (!file) return
          if (!isAcceptedImage(file)) { setError(translate('invalidType')); return }
          if (file.size > MAX_BYTES) { setError(translate('tooLarge')); return }
          setError(null)
          readFileAsDataUrl(file,
            (dataUrl) => onChange(field, dataUrl),
            (message) => setError(message))
        }
        const btnLabel = value ? translate('replace') : translate('choose')
        return h('div', { className: 'bs-logo-cell' },
          h('div', { className: 'bs-logo-cell-label' }, label),
          h('div', { className: 'bs-brand-preview' + (field === 'logoLight' ? ' bs-brand-preview--light' : '') },
            value
              ? h('img', { src: value, alt: '', draggable: false })
              : h('span', { className: 'bs-brand-preview--empty' }, translate('preview'))),
          h('div', { className: 'bs-logo-cell-actions' },
            h('label', { className: 'bs-brand-btn', style: { display: 'inline-block' } },
              btnLabel,
              h('input', {
                type: 'file',
                accept: ACCEPT_IMAGE,
                style: { display: 'none' },
                onChange: pick,
              })),
            value && h('button', { className: 'bs-brand-btn', onClick: () => { onChange(field, ''); setError(null) } },
              translate('remove'))),
          error && h('div', { className: 'bs-brand-msg bs-brand-msg--warn' }, error))
      }

      const BrandSettingsPage = () => {
        const committed = useSyncExternalStoreSafe(subscribe, getSnapshot)
        const [draft, setDraft] = React.useState(() => ({ ...committed }))
        const [saving, setSaving] = React.useState(false)
        const [notice, setNotice] = React.useState(null) // { kind: 'ok'|'warn', text }
        const FIELDS = ['logoLight', 'logoDark', 'heroIcon', 'heroShow']
        const setField = (field, value) => { setDraft((d) => ({ ...d, [field]: value })); setNotice(null) }
        const dirty = FIELDS.some((key) => draft[key] !== committed[key])
        const save = async () => {
          setSaving(true)
          const results = await Promise.all(FIELDS.map((key) => persist(key, draft[key])))
          setSaving(false)
          const hostOk = results.every(Boolean)
          setNotice({ kind: hostOk ? 'ok' : 'warn', text: translate(hostOk ? 'saved' : 'localOnly') })
        }
        const revert = () => { setDraft({ ...committed }); setNotice(null) }
        return h('div', { className: 'bs-brand-page' },
          h('p', { style: { color: 'var(--dsw-alias-label-secondary)', fontSize: 13, lineHeight: 1.6, margin: 0 } },
            translate('intro')),
          h('h3', null, translate('title')),
          h('div', { className: 'bs-brand-card' },
            h('div', { className: 'bs-logo-row' },
              h(LogoCell, { field: 'logoLight', label: translate('lightLabel'), value: draft.logoLight, onChange: setField }),
              h(LogoCell, { field: 'logoDark', label: translate('darkLabel'), value: draft.logoDark, onChange: setField }))),
          h('p', { className: 'bs-brand-hint' }, translate('sizeHint')),
          h('div', { className: 'bs-brand-card' },
            h('label', { className: 'bs-switch' },
              h('input', { type: 'checkbox', checked: Boolean(draft.heroShow), onChange: (e) => setField('heroShow', e.target.checked) }),
              h('span', { className: 'bs-switch-track', 'aria-hidden': true }),
              h('span', { className: 'bs-switch-label' }, translate('heroShow'))),
            draft.heroShow && h(LogoCell, { field: 'heroIcon', label: translate('heroIconLabel'), value: draft.heroIcon, onChange: setField }),
            h('p', { className: 'bs-brand-hint' }, translate('heroHint'))),
          h('div', { className: 'bs-brand-actions' },
            h('button', { className: 'bs-brand-btn bs-brand-btn--primary', disabled: !dirty || saving, onClick: save },
              translate('saveBtn')),
            h('button', { className: 'bs-brand-btn', disabled: !dirty || saving, onClick: revert },
              translate('revertBtn'))),
          dirty && !saving && h('p', { className: 'bs-brand-hint', style: { margin: 0 } }, translate('dirtyHint')),
          notice && h('div',
            { className: notice.kind === 'warn' ? 'bs-brand-msg bs-brand-msg--warn' : 'bs-brand-msg bs-brand-msg--ok' },
            notice.text))
      }

      ctx.slots.inject('settings.section', () =>
        ctx.slots.register({
          name: 'settings.section',
          id: 'brand',
          order: 15,
          label: () => translate('title'),
        }, BrandSettingsPage))
    }

    // useSyncExternalStore, guarded for older React builds.
    function useSyncExternalStoreSafe(sub, get) {
      return React.useSyncExternalStore
        ? React.useSyncExternalStore(sub, get, get)
        : (React.useState(get)[0])
    }

    return { inject: ['slots', 'settingsScope'], apply }
  },
})
