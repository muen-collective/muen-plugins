/**
 * @muen/dsh-assets — the client half.
 *
 * A1 IS THE DOOR AND THE EMPTY ROOM: the right panel's tab type, the chip that names it, the
 * standard guide card on the Start page, and the pane's own empty state. The grid, the
 * folder control and the metadata block are A2/A3.
 *
 * THE EMPTY STATE IS TRUE, NOT DECORATION. The pane asks the host where the library's own
 * state lives and which folders are in it, so "nothing yet" is an answer about this machine
 * rather than a hardcoded screen: the two paths are drawn, because the first question an
 * empty library raises is where it is looking.
 *
 * THE CARD IS THE HARNESS'S OWN. No renderer is registered at `sidebar.right.tab.guide.entry`
 *: the guide draws its standard card from the type's `guide[]` entry, the way every other
 * surface in this product does.
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
     * Resolve one icon by its current name, falling back to the pre-0.1.7 name.
     *
     * ICON NAMES ARE NOT STABLE ACROSS HARNESS GENERATIONS: 0.1.6 shipped `IconSparkle16`
     * (glyph and size in one name) and 0.1.7-rc.1 replaced the set with
     * `IconSparkleRegular`, the size becoming a prop. Destructuring only one name yields
     * `undefined` on the other core, and React then throws #130 the moment the card renders
     * — which is what once emptied the Start page. One bundle must serve either core.
     */
    const icon = (current, legacy) => primitives[current] ?? primitives[legacy]
    const IconFolderOpen = icon('IconFolderOpenRegular', 'IconFolderOpen16')
    const IconLoadingOutline16 = icon('IconLoadingOutlineRegular', 'IconLoadingOutline16')
    const h = React.createElement

    const ASSETS_ID = '@muen/dsh-assets'
    const ASSETS_KIND = 'assets'
    const NS = 'assets'
    const FOLDERS_URL = '/plugins/assets/folders'

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
    }

    /**
     * What the host says about the library: the folders it holds and the two paths it reads.
     * A failure is a state, not an exception, so an empty library and an unreachable host
     * never look the same.
     */
    function useLibrary() {
      const [state, setState] = React.useState({ phase: 'loading', folders: [], error: null, root: null, recordsRoot: null })
      React.useEffect(() => {
        let live = true
        const read = async () => {
          try {
            const answer = await fetch(FOLDERS_URL)
            if (!answer.ok) throw new Error('http-' + answer.status)
            const body = await answer.json()
            if (!live) return
            setState({
              phase: 'ready',
              folders: Array.isArray(body.folders) ? body.folders : [],
              error: null,
              root: body.root || null,
              recordsRoot: body.recordsRoot || null,
            })
          } catch (error) {
            if (!live) return
            setState({ phase: 'error', folders: [], error: String((error && error.message) || error), root: null, recordsRoot: null })
          }
        }
        read()
        return () => {
          live = false
        }
      }, [])
      return state
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

    /** A path as the pane shows it: monospaced, wrapping, never clipped into a lie. */
    function PathRow({ label, value }) {
      if (!value) return null
      return h('div', { style: S.row }, h('span', { style: S.muted }, label), h('span', { style: S.path, className: 'mono' }, value))
    }

    /**
     * The pane. A1 draws three honest states — reading, unreachable, and empty — and the
     * empty one carries where the library is looking, because that is the first question.
     */
    function AssetsPane(props) {
      const t = (props && props.locale ? props.locale.bind(NS) : (key) => EN[key] || key)
      const library = useLibrary()

      if (library.phase === 'loading') {
        return h(
          'div',
          { style: S.pane, 'data-assets-pane': 'loading' },
          h(
            'div',
            { style: S.centre },
            IconLoadingOutline16 ? h(IconLoadingOutline16, { size: 16, style: S.glyph }) : null,
            h('span', { style: S.muted }, t('pane.loading')),
          ),
        )
      }

      if (library.phase === 'error') {
        return h(
          'div',
          { style: S.pane, 'data-assets-pane': 'error' },
          h(
            'div',
            { style: S.centre },
            h('span', { style: S.title }, t('pane.error')),
            h('span', { style: S.muted }, library.error),
          ),
        )
      }

      if (library.folders.length === 0) {
        return h(
          'div',
          { style: S.pane, 'data-assets-pane': 'empty' },
          h(
            'div',
            { style: S.centre, 'data-assets-empty': 'yes' },
            h('span', { style: S.glyph }, IconFolderOpen ? h(IconFolderOpen, { size: 22 }) : null),
            h('span', { style: S.title }, t('pane.empty.title')),
            h('span', { style: S.body }, t('pane.empty.body')),
            h(
              'div',
              { style: S.facts },
              h(PathRow, { label: t('pane.state'), value: library.root }),
              h(PathRow, { label: t('pane.records'), value: library.recordsRoot }),
            ),
          ),
        )
      }

      // A2 turns this list into the grid. Until then the pane names what it has rather than
      // pretending the picture wall is coming from nowhere.
      return h(
        'div',
        { style: S.pane, 'data-assets-pane': 'ready' },
        h('span', { style: S.title }, t('pane.where')),
        h(
          'div',
          { style: S.facts },
          ...library.folders.map((folder, index) =>
            h(PathRow, { key: folder.path + ':' + index, label: folder.label || '—', value: folder.path }),
          ),
        ),
      )
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
