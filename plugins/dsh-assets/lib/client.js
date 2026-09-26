/**
 * @muen/dsh-assets — the client half.
 *
 * A2 ADDS THE FOLDER CONTROL AND THE TWO FILTER GROUPS, over A1's door and empty room:
 *
 *   - `+ Folder` opens the OS folder dialog where the host has one, and a typed path where
 *     it does not. An added folder is the person's own directory, outside this app;
 *   - the **context** rows (the project folder's label) and the **date** tree
 *     (year → month → day), each row carrying the count of assets behind it, because a
 *     filter that cannot say how much is behind it is a guess;
 *   - the list itself — deliberately plain. A3 replaces it with the grid and the metadata
 *     block, so this is the shape the data is checked against, not the design.
 *
 * The empty state stays A1's: an empty library says where it looked.
 *
 * Loader format: one self-contained script registered via window.__ModuleLoader__.
 *
 * @module @muen/dsh-assets/lib/client
 */
window.__ModuleLoader__.load({
  id: '@muen/dsh-assets',
  factory: (require) => {
    const React = require('react')
    const primitives = require('@deepseek-ai/dsh-client-ui-primitives')
    /**
     * Resolve one icon by its current name, falling back to the pre-0.1.7 name: 0.1.6 shipped
     * `IconSparkle16` (glyph and size in one name), 0.1.7-rc.1 replaced the set with
     * `IconSparkleRegular`, the size becoming a prop. Destructuring only one name yields
     * `undefined` on the other core, and React then throws #130 the moment a card renders.
     */
    const icon = (current, legacy) => primitives[current] ?? primitives[legacy]
    const IconFolderOpen = icon('IconFolderOpenRegular', 'IconFolderOpen16')
    const IconLoadingOutline16 = icon('IconLoadingOutlineRegular', 'IconLoadingOutline16')
    const IconPlusOutline16 = icon('IconPlusOutlineRegular', 'IconPlusOutline16')
    const IconCloseOutline16 = icon('IconCloseOutlineRegular', 'IconCloseOutline16')
    const Button = primitives.Button
    const h = React.createElement

    const ASSETS_ID = '@muen/dsh-assets'
    const ASSETS_KIND = 'assets'
    const NS = 'assets'
    const FOLDERS_URL = '/plugins/assets/folders'
    const CATALOG_URL = '/plugins/assets/catalog'

    const EN = {
      'type.label': 'Assets',
      'guide.title': 'Assets',
      'guide.description': 'Find the originals you have already made',
      'pane.loading': 'Reading folders…',
      'pane.error': 'The library could not be read.',
      'pane.empty.title': 'No folders yet',
      'pane.empty.body':
        'Add the folder a project keeps its pictures in. Nothing is copied or moved — the library reads that folder where it already lives.',
      'pane.where': 'Folders added to this library',
      'pane.state': 'Library state',
      'pane.records': 'Run records',
      'pane.add': 'Folder',
      'pane.adding': 'Adding…',
      'pane.path.placeholder': '/Users/you/Desktop/project',
      'pane.path.use': 'Add folder',
      'pane.path.hint': 'An absolute path. Nothing is copied or moved.',
      'pane.remove': 'Remove from the library',
      'pane.filter.context': 'Context',
      'pane.filter.date': 'Date',
      'pane.filter.all': 'All',
      'pane.assets': 'assets',
      'pane.none': 'Nothing here yet',
      'pane.none.match': 'No asset matches this filter.',
      'pane.recorded': 'Run',
      'pane.unrecorded': 'File',
      'pane.truncated': 'This folder list is longer than the library scans; the rest is not shown.',
      'pane.add.failed': 'The folder could not be added.',
      'pane.inLibrary': 'already in the library',
    }

    const ZH = {
      'type.label': '资产',
      'guide.title': '资产',
      'guide.description': '找回你已经做出来的原图',
      'pane.loading': '正在读取文件夹…',
      'pane.error': '无法读取资产库。',
      'pane.empty.title': '还没有文件夹',
      'pane.empty.body': '把项目存放图片的文件夹加进来。不会复制也不会移动——资产库就地读取该文件夹。',
      'pane.where': '已加入资产库的文件夹',
      'pane.state': '资产库状态',
      'pane.records': '运行记录',
      'pane.add': '文件夹',
      'pane.adding': '正在添加…',
      'pane.path.placeholder': '/Users/你/Desktop/项目',
      'pane.path.use': '添加文件夹',
      'pane.path.hint': '绝对路径。不会复制也不会移动。',
      'pane.remove': '从资产库移除',
      'pane.filter.context': '情境',
      'pane.filter.date': '日期',
      'pane.filter.all': '全部',
      'pane.assets': '项资产',
      'pane.none': '这里还没有内容',
      'pane.none.match': '没有符合当前筛选的资产。',
      'pane.recorded': '运行',
      'pane.unrecorded': '文件',
      'pane.truncated': '文件夹内容超出资产库的扫描范围，其余未显示。',
      'pane.add.failed': '无法添加该文件夹。',
      'pane.inLibrary': '已在资产库中',
    }

    /** The pane's ink, in the harness's own aliases so it follows the theme. */
    const S = {
      pane: { display: 'flex', flexDirection: 'column', gap: 12, padding: '18px 16px', height: '100%', overflow: 'auto' },
      centre: { margin: 'auto 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, textAlign: 'center', maxWidth: 380, alignSelf: 'center' },
      title: { color: 'var(--dsw-alias-label-primary)', fontSize: 14, fontWeight: 600 },
      body: { color: 'var(--dsw-alias-label-secondary)', fontSize: 13, lineHeight: '19px' },
      muted: { color: 'var(--dsw-alias-label-tertiary)', fontSize: 11.5, lineHeight: '17px' },
      facts: { display: 'flex', flexDirection: 'column', gap: 2, width: '100%', paddingTop: 4 },
      row: { display: 'flex', justifyContent: 'space-between', gap: 12, minWidth: 0 },
      path: { color: 'var(--dsw-alias-label-secondary)', fontSize: 11.5, overflowWrap: 'anywhere', textAlign: 'right' },
      glyph: { color: 'var(--dsw-alias-label-tertiary)', display: 'flex' },
      head: { display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' },
      folderRow: { display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 },
      group: { display: 'flex', flexDirection: 'column', gap: 2, borderTop: '1px solid var(--dsw-alias-border-l2)', paddingTop: 8 },
      groupTitle: { color: 'var(--dsw-alias-label-tertiary)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' },
      filterRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, width: '100%', padding: '3px 6px', background: 'transparent', border: 0, borderRadius: 6, cursor: 'pointer', color: 'var(--dsw-alias-label-primary)', font: 'inherit', fontSize: 12.5, textAlign: 'left' },
      filterRowOn: { background: 'var(--dsw-alias-bg-layer-2)' },
      count: { color: 'var(--dsw-alias-label-tertiary)', fontSize: 11, fontVariantNumeric: 'tabular-nums' },
      indent: { paddingLeft: 14 },
      list: { display: 'flex', flexDirection: 'column', gap: 4 },
      item: { display: 'flex', flexDirection: 'column', gap: 1, padding: '6px 8px', borderRadius: 8, background: 'var(--dsw-alias-bg-layer-2)', minWidth: 0 },
      itemName: { color: 'var(--dsw-alias-label-primary)', fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
      itemMeta: { color: 'var(--dsw-alias-label-tertiary)', fontSize: 11, display: 'flex', gap: 8, minWidth: 0 },
      input: { width: '100%', boxSizing: 'border-box', padding: '6px 8px', borderRadius: 8, border: '1px solid var(--dsw-alias-border-l3)', background: 'var(--dsw-alias-bg-layer-2)', color: 'var(--dsw-alias-label-primary)', font: 'inherit', fontSize: 12.5 },
      error: { color: 'var(--dsw-alias-label-secondary)', fontSize: 11.5 },
    }

    /** A GET that answers a state rather than throwing: an empty library and an unreachable host never look alike. */
    function useJson(url) {
      const [state, setState] = React.useState({ phase: 'loading', data: null, error: null })
      const [tick, setTick] = React.useState(0)
      React.useEffect(() => {
        let live = true
        const read = async () => {
          try {
            const answer = await fetch(url)
            if (!answer.ok) throw new Error('http-' + answer.status)
            const body = await answer.json()
            if (live) setState({ phase: 'ready', data: body, error: null })
          } catch (error) {
            if (live) setState({ phase: 'error', data: null, error: String((error && error.message) || error) })
          }
        }
        read()
        return () => {
          live = false
        }
      }, [url, tick])
      return [state, () => setTick((value) => value + 1)]
    }

    /** Bytes as a person reads them. */
    function sizeOf(bytes) {
      if (typeof bytes !== 'number' || !isFinite(bytes)) return ''
      if (bytes < 1024) return bytes + ' B'
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB'
      return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
    }

    /** The name without its extension: a picture is called by what it is, not by its format. */
    function stemOf(name) {
      const text = String(name || '')
      const dot = text.lastIndexOf('.')
      return dot > 0 ? text.slice(0, dot) : text
    }

    /** A path as the pane shows it: monospaced, wrapping, never clipped into a lie. */
    function PathRow({ label, value }) {
      if (!value) return null
      return h('div', { style: S.row }, h('span', { style: S.muted }, label), h('span', { style: S.path, className: 'mono' }, value))
    }

    /** One filter row: a label, and the number of assets behind it. */
    function FilterRow({ label, count, on, depth = 0, onClick }) {
      return h(
        'button',
        {
          type: 'button',
          onClick,
          style: { ...S.filterRow, ...(on ? S.filterRowOn : null), ...(depth > 0 ? { paddingLeft: 6 + depth * 14 } : null) },
          'data-assets-filter-row': 'yes',
          'data-assets-filter-on': on ? 'yes' : 'no',
        },
        h('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, label),
        h('span', { style: S.count }, String(count)),
      )
    }

    /**
     * The pane. A1's three honest states, and then A2's controls: the folders, the filters
     * with their counts, and the list.
     */
    function AssetsPane(props) {
      const t = (props && props.locale ? props.locale.bind(NS) : (key) => EN[key] || key)
      const [context, setContext] = React.useState(null)
      const [date, setDate] = React.useState(null)
      const [typed, setTyped] = React.useState('')
      const [busy, setBusy] = React.useState(false)
      const [failed, setFailed] = React.useState(null)

      const query = []
      if (context) query.push('context=' + encodeURIComponent(context))
      if (date) query.push('date=' + encodeURIComponent(date))
      const catalogUrl = CATALOG_URL + (query.length > 0 ? '?' + query.join('&') : '')
      const [registry, reloadRegistry] = useJson(FOLDERS_URL)
      const [catalog, reloadCatalog] = useJson(catalogUrl)

      const post = async (body) => {
        setBusy(true)
        setFailed(null)
        try {
          const answer = await fetch(FOLDERS_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
          if (!answer.ok) throw new Error('http-' + answer.status)
          const result = await answer.json()
          reloadRegistry()
          reloadCatalog()
          return result
        } catch (error) {
          setFailed(String((error && error.message) || error))
          return null
        } finally {
          setBusy(false)
        }
      }

      if (registry.phase === 'loading' && catalog.phase === 'loading') {
        return h(
          'div',
          { style: S.pane, 'data-assets-pane': 'loading' },
          h('div', { style: S.centre }, IconLoadingOutline16 ? h(IconLoadingOutline16, { size: 16, style: S.glyph }) : null, h('span', { style: S.muted }, t('pane.loading'))),
        )
      }

      if (registry.phase === 'error' || catalog.phase === 'error') {
        const detail = (registry.error || catalog.error) || ''
        return h('div', { style: S.pane, 'data-assets-pane': 'error' }, h('div', { style: S.centre }, h('span', { style: S.title }, t('pane.error')), h('span', { style: S.muted }, detail)))
      }

      const folders = (registry.data && registry.data.folders) || []
      const canChoose = !!(registry.data && registry.data.canChoose)
      const counts = (catalog.data && catalog.data.counts) || { context: [], date: [] }
      const assets = (catalog.data && catalog.data.assets) || []
      const total = (catalog.data && catalog.data.total) || 0

      const addControl = h(
        'span',
        { style: S.folderRow, 'data-assets-add': 'yes' },
        Button
          ? h(
              Button,
              {
                variant: 'outline',
                size: 'sm',
                disabled: busy,
                onClick: async () => {
                  if (canChoose) await post({ action: 'choose' })
                },
              },
              IconPlusOutline16 ? h(IconPlusOutline16, { size: 14 }) : null,
              t('pane.add'),
            )
          : h('button', { type: 'button', disabled: busy, onClick: () => post({ action: 'choose' }) }, t('pane.add')),
      )

      if (folders.length === 0) {
        return h(
          'div',
          { style: S.pane, 'data-assets-pane': 'empty' },
          h(
            'div',
            { style: { ...S.centre, 'data-assets-empty': 'yes' } },
            h('span', { style: S.glyph }, IconFolderOpen ? h(IconFolderOpen, { size: 22 }) : null),
            h('span', { style: S.title }, t('pane.empty.title')),
            h('span', { style: S.body }, t('pane.empty.body')),
            // THE WAY IN. Where the host has a dialog this is one press; where it does not,
            // the field below is the same act typed out.
            h('div', { style: { display: 'flex', flexDirection: 'column', gap: 6, width: '100%', alignItems: 'center' } }, addControl),
            canChoose
              ? null
              : h(
                  'div',
                  { style: { display: 'flex', flexDirection: 'column', gap: 6, width: '100%' } },
                  h('input', {
                    style: S.input,
                    value: typed,
                    placeholder: t('pane.path.placeholder'),
                    'aria-label': t('pane.path.use'),
                    onChange: (event) => setTyped(event.target.value),
                  }),
                  h('span', { style: S.muted }, t('pane.path.hint')),
                  Button
                    ? h(Button, { variant: 'primary', size: 'sm', disabled: busy || typed.trim() === '', onClick: async () => { await post({ action: 'add', path: typed.trim() }); setTyped('') } }, t('pane.path.use'))
                    : null,
                ),
            failed ? h('span', { style: S.error }, t('pane.add.failed') + ' ' + failed) : null,
            h('div', { style: S.facts }, h(PathRow, { label: t('pane.state'), value: registry.data && registry.data.root }), h(PathRow, { label: t('pane.records'), value: registry.data && registry.data.recordsRoot })),
          ),
        )
      }

      return h(
        'div',
        { style: S.pane, 'data-assets-pane': 'ready' },
        h('div', { style: S.head }, h('span', { style: S.title }, t('pane.where')), addControl),
        h(
          'div',
          { style: S.facts },
          ...folders.map((folder, index) =>
            h(
              'div',
              { key: folder.path + ':' + index, style: S.row },
              h('span', { style: S.path, className: 'mono', title: folder.path }, folder.label || folder.path),
              h(
                'button',
                {
                  type: 'button',
                  title: t('pane.remove'),
                  'aria-label': t('pane.remove'),
                  disabled: busy,
                  onClick: () => post({ action: 'remove', path: folder.path }),
                  style: { background: 'transparent', border: 0, cursor: 'pointer', color: 'var(--dsw-alias-label-tertiary)', display: 'flex' },
                },
                IconCloseOutline16 ? h(IconCloseOutline16, { size: 14 }) : null,
              ),
            ),
          ),
        ),
        canChoose
          ? null
          : h(
              'div',
              { style: { display: 'flex', flexDirection: 'column', gap: 6 } },
              h('input', { style: S.input, value: typed, placeholder: t('pane.path.placeholder'), 'aria-label': t('pane.path.use'), onChange: (event) => setTyped(event.target.value) }),
              Button ? h(Button, { variant: 'primary', size: 'sm', disabled: busy || typed.trim() === '', onClick: async () => { await post({ action: 'add', path: typed.trim() }); setTyped('') } }, t('pane.path.use')) : null,
            ),
        failed ? h('span', { style: S.error }, t('pane.add.failed') + ' ' + failed) : null,

        // ── the two filter groups, each row carrying its count ────────────────
        h(
          'div',
          { style: S.group, 'data-assets-filters': 'yes' },
          h('span', { style: S.groupTitle }, t('pane.filter.context') + ' · ' + total + ' ' + t('pane.assets')),
          h(FilterRow, { label: t('pane.filter.all'), count: total, on: context === null, onClick: () => setContext(null) }),
          ...counts.context.map((row) =>
            h(FilterRow, {
              key: 'ctx:' + row.value,
              label: row.value === '' ? '—' : row.value,
              count: row.count,
              depth: 1,
              on: context === row.value,
              onClick: () => setContext(context === row.value ? null : row.value),
            }),
          ),
        ),
        h(
          'div',
          { style: S.group },
          h('span', { style: S.groupTitle }, t('pane.filter.date')),
          h(FilterRow, { label: t('pane.filter.all'), count: total, on: date === null, onClick: () => setDate(null) }),
          ...counts.date.flatMap((year) => [
            h(FilterRow, { key: 'y:' + year.year, label: year.year, count: year.count, depth: 1, on: false, onClick: () => setDate(null) }),
            ...year.months.flatMap((month) => [
              h(FilterRow, { key: 'm:' + year.year + '-' + month.month, label: year.year + '-' + month.month, count: month.count, depth: 2, on: false, onClick: () => setDate(null) }),
              ...month.days.map((day) =>
                h(FilterRow, { key: 'd:' + day.day, label: day.day, count: day.count, depth: 3, on: date === day.day, onClick: () => setDate(date === day.day ? null : day.day) }),
              ),
            ]),
          ]),
        ),

        // ── the list (A3 replaces this with the grid and the metadata block) ──
        assets.length === 0
          ? h('span', { style: S.muted, 'data-assets-none': 'yes' }, total === 0 ? t('pane.none') : t('pane.none.match'))
          : h(
              'div',
              { style: S.list, 'data-assets-list': 'yes' },
              ...assets.map((asset) =>
                h(
                  'div',
                  { key: asset.path, style: S.item, 'data-assets-item': 'yes' },
                  h('span', { style: S.itemName, title: asset.path }, stemOf(asset.name)),
                  h(
                    'span',
                    { style: S.itemMeta },
                    h('span', null, asset.date || ''),
                    h('span', null, sizeOf(asset.bytes)),
                    h('span', null, asset.hasRecord ? t('pane.recorded') : t('pane.unrecorded')),
                    asset.context ? h('span', null, asset.context) : null,
                  ),
                ),
              ),
            ),
        catalog.data && catalog.data.truncated ? h('span', { style: S.muted }, t('pane.truncated')) : null,
      )
    }

    /** The chip beside the DSH glyph: the folder, then the name — the guide tab's own shape. */
    function AssetsTitle(props) {
      const t = props && props.locale ? props.locale.bind(NS) : (key) => EN[key] || key
      return h(
        'span',
        { style: { display: 'inline-flex', alignItems: 'center', gap: 6 }, 'data-assets-chip': 'yes' },
        IconFolderOpen ? h(IconFolderOpen, { size: 16, style: S.glyph }) : null,
        t('type.label'),
      )
    }

    /** The guide card's glyph. Without one the guide draws its cube, which reads as unfinished. */
    function AssetsGuideIcon() {
      return IconFolderOpen ? h(IconFolderOpen, { size: 20 }) : null
    }

    function assetsDefinition(t) {
      return {
        id: ASSETS_ID,
        kind: ASSETS_KIND,
        // A type from outside the product, which is what this is in any DSH.
        priority: 'extension',
        title: () => t('type.label'),
        guide: [
          {
            id: 'open',
            order: 46,
            title: () => t('guide.title'),
            description: () => t('guide.description'),
            icon: AssetsGuideIcon,
          },
        ],
      }
    }

    const inject = ['slots', 'locale', 'sidebarRightTabs']

    /**
     * Every registration goes through `ctx.effect`, so unloading the row takes the type, its
     * body and its chip with it. A bare `register()` would leak into the next mount.
     */
    function apply(ctx) {
      const t = ctx.locale.bind(NS)
      ctx.effect(() => ctx.locale.register(NS, { en: EN, zh: ZH }), 'assets.copy')
      ctx.effect(() => ctx.sidebarRightTabs.register(assetsDefinition(t)), 'assets.type')
      ctx.effect(
        () =>
          ctx.slots.inject('sidebar.right.pane.tab', () =>
            ctx.slots.register({ name: 'sidebar.right.pane.tab', key: ASSETS_ID, locale: NS }, AssetsPane),
          ),
        'assets.body',
      )
      ctx.effect(
        () =>
          ctx.slots.inject('sidebar.right.pane.tab.title', () =>
            ctx.slots.register({ name: 'sidebar.right.pane.tab.title', key: ASSETS_ID, locale: NS }, AssetsTitle),
          ),
        'assets.title',
      )
    }

    return { inject, apply }
  },
})
