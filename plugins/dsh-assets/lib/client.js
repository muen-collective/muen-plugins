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
    const IconPlusOutline16 = icon('IconPlusOutlineRegular', 'IconPlusOutline16')
    const IconCloseOutline16 = icon('IconCloseOutlineRegular', 'IconCloseOutline16')
    const IconWarningOutline16 = icon('IconWarningOutlineRegular', 'IconWarningOutline16')
    // The bar's filters wear the app's own disclosure chevron (polish pass, 2026-09-26).
    const IconChevronDownOutline16 = icon('IconChevronDownOutlineRegular', 'IconChevronDown16')
    const IconSearchOutline16 = icon('IconSearchOutlineRegular', 'IconSearchOutline16')
    // The Generate surface's own glyph, which is what tells a person where this control goes
    // (epic 64 S7).
    const IconSparkle16 = icon('IconSparkleRegular', 'IconSparkle16')
    const Button = primitives.Button
    // THE APP'S OWN CONTROLS, NOT HAND-ROLLED ONES (founder, 2026-09-26: *"can you copy finder switch
    // view w segmented control using icon buttons: grid, list, filmstrip. there is segmented tab
    // control in eva design system w animated state change. also use dropdown select menu primitives
    // from EVA design system"*). `SegmentedControl` is the tablist whose white pill SLIDES under the
    // selected segment (`transition: transform 160ms ease`, placed arithmetically from
    // `--dsh-segment-count`/`--dsh-segment-index`), and `Menu` is the anchored list Settings uses for
    // a choice — it takes its own `anchor` and hands the keyboard back to the trigger that opened it.
    // Both are the same primitives the app's own Settings pages draw; `@muen/eva`'s React sources are
    // a Tailwind package the shell does not ship to plugins, and this bundle declares exactly one peer.
    const SegmentedControl = primitives.SegmentedControl
    const Menu = primitives.Menu
    // The search field is the app's OWN `Input` (32px tall by its own CSS, focus ring and all) rather
    // than a hand-rolled `<input>`: the founder's ask was that it and the switch agree on a height, and
    // the way to agree with the design system is to use it (2026-09-26: *"can match height of segmented
    // control with search input and then center icons"*).
    const Input = primitives.Input
    const h = React.createElement

    const ASSETS_ID = '@muen/dsh-assets'
    const ASSETS_KIND = 'assets'
    const NS = 'assets'
    /**
     * The kind the Generate pane registers and the one an asset hands off through. It is a
     * STRING, not an import: the seam is the harness's `openTab(kind, { params })`, and what
     * travels on it is data — `{ run, unit, provider }`, the three facts a run record already
     * holds (epic 64 S7 and §9).
     */
    const GENERATE_KIND = 'generate'
    const FOLDERS_URL = '/plugins/assets/folders'
    const CATALOG_URL = '/plugins/assets/catalog'
    const DETAIL_URL = '/plugins/assets/detail'
    const VIEW_URL = '/plugins/assets/view'

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
      'pane.reveal': 'Show in Finder',
      'pane.add': 'Folder',
      'pane.adding': 'Adding…',
      'pane.path.placeholder': '/Users/you/Desktop/project',
      'pane.path.use': 'Add folder',
      'pane.path.hint': 'An absolute path. Nothing is copied or moved.',
      'pane.remove': 'Remove from the library',
      'pane.filter.context': 'Context',
      'pane.filter.date': 'Date',
      'pane.filter.all': 'All',
      'pane.filter.clear': 'Clear this filter',
      'pane.assets': 'assets',
      // THE SUMMARY IS A SENTENCE ABOUT HOW MUCH IS HERE, and how much of it is on screen.
      'pane.summary': '{n} assets',
      'pane.summary.filtered': '{shown} of {total}',
      'pane.none': 'Nothing here yet',
      'pane.none.match': 'No asset matches this filter.',
      'pane.recorded': 'Run',
      'pane.unrecorded': 'File',
      'pane.truncated': 'This folder list is longer than the library scans; the rest is not shown.',
      'pane.add.failed': 'The folder could not be added.',
      'pane.inLibrary': 'already in the library',
      'pane.view': 'View',
      'pane.view.grid': 'Grid',
      'pane.view.list': 'List',
      'pane.view.gallery': 'Gallery',
      'pane.gallery.pick': 'Pick a thumbnail below to look at it closely',
      'pane.search.placeholder': 'Search by name or prompt',
      'pane.selected': 'Selected',
      'meta.title': 'Metadata',
      'meta.file': 'File',
      'meta.dimensions': 'Dimensions',
      'meta.format': 'Format',
      'meta.bytes': 'Size',
      'meta.date': 'Date',
      'meta.context': 'Context',
      'meta.where': 'Where it is',
      // WHAT THE FILE ITSELF CARRIES (epic 64 S8): a graph makes a picture openable in a local
      // ComfyUI, so it is a fact about the asset. Three answers, not two — a format the library
      // cannot read says so rather than claiming there is no graph.
      'stage.hint': 'Scroll to zoom · drag to pan',
      'stage.fit': 'Fit',
      'stage.one': '1:1',
      'stage.oneHint': 'Show the picture at its own pixels, at full resolution',
      'meta.carrier': 'Graph inside',
      'meta.carrier.yes': 'Yes — {nodes} nodes',
      'meta.carrier.no': 'No — only the provider’s label',
      'meta.carrier.unknown': 'Not read',
      'meta.run': 'Run',
      'meta.provider': 'Provider',
      'meta.job': 'Job',
      'meta.workflow': 'Workflow',
      'meta.app': 'App',
      'meta.settled': 'Settled',
      'meta.prompt': 'Prompt',
      'meta.values': 'Values',
      'meta.noRecord': 'No run made this file — it is listed with the file\'s own facts only.',
      // THE HANDOFF'S OWN WORDS (epic 64 S7). The control says what it does and the hint says
      // what it does NOT do, because "Regenerate" is the one word here a person could read as
      // spending money.
      'meta.continue': 'Regenerate',
      'meta.continue.hint': 'Opens this run in Generate, with its picture and its settings. Nothing runs until you press Generate there.',
      'meta.continue.noPlugin': 'Generate is not installed, so this run cannot be opened here.',
      'meta.continue.noWorkflow': 'This run does not name the workflow it came from, so it cannot be opened.',
      'where.present': 'here',
      'where.trashed': 'in the trash',
      'where.offline': 'on a volume that is not mounted',
      'where.missing': 'gone',
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
      'pane.reveal': '在访达中显示',
      'pane.add': '文件夹',
      'pane.adding': '正在添加…',
      'pane.path.placeholder': '/Users/你/Desktop/项目',
      'pane.path.use': '添加文件夹',
      'pane.path.hint': '绝对路径。不会复制也不会移动。',
      'pane.remove': '从资产库移除',
      'pane.filter.context': '情境',
      'pane.filter.date': '日期',
      'pane.filter.all': '全部',
      'pane.filter.clear': '清除此筛选',
      'pane.assets': '项资产',
      'pane.summary': '{n} 项资产',
      'pane.summary.filtered': '显示 {shown} / {total}',
      'pane.none': '这里还没有内容',
      'pane.none.match': '没有符合当前筛选的资产。',
      'pane.recorded': '运行',
      'pane.unrecorded': '文件',
      'pane.truncated': '文件夹内容超出资产库的扫描范围，其余未显示。',
      'pane.add.failed': '无法添加该文件夹。',
      'pane.inLibrary': '已在资产库中',
      'pane.view': '视图',
      'pane.view.grid': '网格',
      'pane.view.list': '列表',
      'pane.view.gallery': '画廊',
      'pane.gallery.pick': '在下方选择缩略图以便细看',
      'pane.search.placeholder': '按名称或提示词搜索',
      'pane.selected': '已选择',
      'meta.title': '元数据',
      'meta.file': '文件',
      'meta.dimensions': '尺寸',
      'meta.format': '格式',
      'meta.bytes': '大小',
      'meta.date': '日期',
      'meta.context': '情境',
      'meta.where': '位置',
      'stage.hint': '滚轮缩放 · 拖拽平移',
      'stage.fit': '适应',
      'stage.one': '1:1',
      'stage.oneHint': '按原始像素、全分辨率显示',
      'meta.carrier': '内嵌工作流图',
      'meta.carrier.yes': '有 —— {nodes} 个节点',
      'meta.carrier.no': '没有 —— 只有提供方的标记',
      'meta.carrier.unknown': '未读取',
      'meta.run': '运行',
      'meta.provider': '提供方',
      'meta.job': '任务',
      'meta.workflow': '工作流',
      'meta.app': '应用',
      'meta.settled': '完成',
      'meta.prompt': '提示词',
      'meta.values': '参数',
      'meta.noRecord': '这个文件不是运行产生的——只列出文件本身的信息。',
      'meta.continue': '重新生成',
      'meta.continue.hint': '在「生成」中打开这次运行，连同它的图片和参数。在那里按下生成之前不会运行任何东西。',
      'meta.continue.noPlugin': '未安装「生成」，无法在这里打开这次运行。',
      'meta.continue.noWorkflow': '这次运行没有记录它来自哪个工作流，因此无法打开。',
      'where.present': '在此处',
      'where.trashed': '在回收站',
      'where.offline': '在未挂载的卷上',
      'where.missing': '已丢失',
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
      glyph: { color: 'var(--dsw-alias-label-tertiary)', display: 'flex' },
      head: { display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' },
      folderRow: { display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 },
      // A FOLDER A PERSON ADDED IS A PLACE, so its name is the way there: the glyph says what
      // it is, the name is the button, and Finder opens it (`pane.reveal`).
      folderButton: { display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: '1 1 auto', padding: '2px 4px', background: 'transparent', border: 0, borderRadius: 6, cursor: 'pointer', color: 'var(--dsw-alias-label-primary)', font: 'inherit', fontSize: 12.5, textAlign: 'left' },
      folderName: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
      // (Six style keys were deleted in the 2026-09-26 polish pass because nothing drew them:
      //  `path`, `indent` and `thumbEmpty` had been dead since the system-path and nested-date
      //  designs left, and `group`, `groupTitle` and `head2` died with the always-open filters.)
      // (`list` and `item` used to be declared HERE too — a column-shaped row from an earlier
      // layout, silently shadowed by the pair near the bottom of this object. Removed in the
      // 2026-09-26 polish pass: a duplicate key is a design nobody can find again.)
      itemName: { color: 'var(--dsw-alias-label-primary)', fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
      itemMeta: { color: 'var(--dsw-alias-label-tertiary)', fontSize: 11, display: 'flex', gap: 8, minWidth: 0 },
      input: { width: '100%', boxSizing: 'border-box', padding: '6px 8px', borderRadius: 8, border: '1px solid var(--dsw-alias-border-l3)', background: 'var(--dsw-alias-bg-layer-2)', color: 'var(--dsw-alias-label-primary)', font: 'inherit', fontSize: 12.5 },
      error: { color: 'var(--dsw-alias-label-secondary)', fontSize: 11.5 },
      // THE GRID, from the OS that shipped this surface: fluid columns, a 240px floor, no
      // breakpoints — the pane's own width is the only input (`repeat(auto-fit, minmax(240px, 1fr))`).
      grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, alignContent: 'start' },
      tile: { display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, padding: 0, border: '1px solid var(--dsw-alias-border-l2)', borderRadius: 10, background: 'var(--dsw-alias-bg-layer-2)', cursor: 'pointer', textAlign: 'left', overflow: 'hidden' },
      // HOVER IS STATE, NOT A SHEET: every style in this pane is inline, so there is no `:hover`
      // to write — the tile carries the flag and swaps its own border (founder, 2026-09-23, on
      // the sibling's account arrow: *"add onhover on the website link arrow to theme primary
      // token color"*). SELECTED TAKES THE BRAND ACCENT, which is the app's own "this one".
      tileHover: { borderColor: 'var(--dsw-alias-border-l3)' },
      tileOn: { borderColor: 'var(--dsw-alias-brand-primary)' },
      // ONE RATIO FOR EVERY TILE, so a grid stays a grid.
      thumb: { position: 'relative', width: '100%', aspectRatio: '3 / 4', background: 'var(--dsw-alias-bg-layer-1, var(--dsw-alias-bg-layer-2))', overflow: 'hidden' },
      thumbImage: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
      badgeRow: { position: 'absolute', left: 6, bottom: 6, display: 'flex', alignItems: 'center', gap: 4, maxWidth: 'calc(100% - 12px)' },
      // THE TWO BADGES ARE DIFFERENT KINDS OF FACT: the context is FILLED (where it belongs),
      // the size is OUTLINED (how big it is). They must not read as the same statement.
      badgeFill: { background: 'var(--dsw-alias-bg-layer-2)', color: 'var(--dsw-alias-label-primary)', fontSize: 10.5, lineHeight: '15px', padding: '0 5px', borderRadius: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', opacity: 0.94 },
      badgeLine: { border: '1px solid var(--dsw-alias-border-l3)', color: 'var(--dsw-alias-label-secondary)', fontSize: 10.5, lineHeight: '15px', padding: '0 4px', borderRadius: 4, whiteSpace: 'nowrap', letterSpacing: '0.02em' },
      tileText: { padding: '0 8px 8px', display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 },

      // ── the polish pass (founder, 2026-09-26: *"now let's UX polish"*) ─────
      //
      // THE BAR IS ONE ROW: the search, the two layouts, the two filters and the count. The
      // grid then starts high, and a filter no longer owns the screen before the pictures do.
      bar: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
      // THE COUNT IS A SUMMARY, not an uppercase group title: how much is here, and how much of
      // it the filters are showing.
      summary: { color: 'var(--dsw-alias-label-caption)', fontSize: 11, fontVariantNumeric: 'tabular-nums', marginLeft: 'auto', whiteSpace: 'nowrap' },
      // A FILTER IS ONE LINE AT REST — its name and the value it holds. The rows with their
      // counts are one press away, because a filter that cannot say how much is behind it is a
      // guess and a tree that is always open is a wall.
      filterWrap: { display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 },
      filterButton: { display: 'inline-flex', alignItems: 'center', gap: 4, maxWidth: 190, padding: '3px 7px', borderRadius: 7, border: '1px solid var(--dsw-alias-border-l2)', background: 'transparent', color: 'var(--dsw-alias-label-secondary)', font: 'inherit', fontSize: 11.5, cursor: 'pointer', whiteSpace: 'nowrap' },
      filterValue: { overflow: 'hidden', textOverflow: 'ellipsis' },
      // A MENU ROW: the choice on the left, its count on the right — the count is why the row is
      // there, so it is not a footnote.
      menuRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, minWidth: 150 },
      menuRowLabel: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
      menuRowCount: { color: 'var(--dsw-alias-label-tertiary)', fontSize: 11, fontVariantNumeric: 'tabular-nums' },
      clearButton: { border: 0, background: 'transparent', color: 'var(--dsw-alias-label-tertiary)', display: 'flex', cursor: 'pointer', padding: 0 },
      // THE TWO COLUMNS. The breakpoint is the pane's own width, because the pane is what
      // resizes: the grid keeps a 320px floor and the block a 280px one, and below that they
      // stack — the same rule the workflow surface already uses.
      columns: { display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-start', minWidth: 0 },
      // The floors are the SAME PAIR the workflow surface settled on (260 + 240 + the 12px gap):
      // one number for the whole family, so a pane that shows two columns there shows them here.
      columnMain: { flex: '3 1 0', minWidth: 260, display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0 },
      columnSide: { flex: '2 1 0', minWidth: 240, display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0 },
      // THE SKELETON wears the app's own token and the pane's own shape, so the library looks
      // like itself while it loads instead of throwing a spinner into the middle of nothing.
      skeletonTile: { border: '1px solid var(--dsw-alias-border-l2)', borderRadius: 10, overflow: 'hidden', background: 'var(--dsw-alias-bg-layer-2)' },
      skeletonBlock: { background: 'var(--dsw-alias-bg-skeleton)' },

      // ── the gallery (founder, 2026-09-26, from Finder) ──────────────────
      //
      // THE FRAME IS THE PANE'S WIDTH and the strip is one row of 56×74 cells under it: the stage
      // A4 already draws, with the catalog's own thumbnails beneath.
      gallery: { display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0, flex: '1 1 auto' },
      galleryStage: { position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', minHeight: 200, borderRadius: 10, background: 'var(--dsw-alias-bg-layer-2)', overflow: 'hidden' },
      galleryPreview: { maxWidth: '100%', maxHeight: 420, objectFit: 'contain', display: 'block' },
      galleryHint: { padding: 24, textAlign: 'center' },
      galleryStrip: { display: 'flex', gap: 6, overflowX: 'auto', overflowY: 'hidden', paddingBottom: 4 },
      frame: { flex: '0 0 auto', width: 56, height: 74, padding: 0, borderRadius: 8, border: '1px solid var(--dsw-alias-border-l2)', background: 'var(--dsw-alias-bg-layer-2)', cursor: 'pointer', overflow: 'hidden' },
      frameOn: { borderColor: 'var(--dsw-alias-brand-primary)' },
      frameImage: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
      meta: { display: 'flex', flexDirection: 'column', gap: 6, borderTop: '1px solid var(--dsw-alias-border-l2)', paddingTop: 10 },
      metaHead: { color: 'var(--dsw-alias-label-primary)', fontSize: 12.5, fontWeight: 600 },
      // THE INSPECT STAGE (epic 63 A4): the picture in a frame of its own, above the facts.
      stage: { position: 'relative', width: '100%', height: 280, overflow: 'hidden', borderRadius: 10, background: 'var(--dsw-alias-bg-layer-1, var(--dsw-alias-bg-layer-2))', cursor: 'grab', touchAction: 'none' },
      stageImage: { position: 'absolute', top: 0, left: 0, transformOrigin: '0 0', maxWidth: 'none', maxHeight: 'none', display: 'block', userSelect: 'none' },
      stageControls: { position: 'absolute', right: 6, bottom: 6, display: 'flex', alignItems: 'center', gap: 4, padding: '3px 5px', borderRadius: 8, background: 'var(--dsw-alias-bg-layer-2)', border: '1px solid var(--dsw-alias-border-l2)' },
      stageHint: { position: 'absolute', left: 8, bottom: 8, color: 'var(--dsw-alias-label-tertiary)', fontSize: 10.5, pointerEvents: 'none' },
      stageButton: { border: 0, background: 'transparent', color: 'var(--dsw-alias-label-primary)', font: 'inherit', fontSize: 11.5, padding: '2px 6px', borderRadius: 6, cursor: 'pointer' },
      stageScale: { color: 'var(--dsw-alias-label-tertiary)', fontSize: 11, minWidth: 34, textAlign: 'center', fontVariantNumeric: 'tabular-nums' },
      metaRow: { display: 'flex', gap: 10, justifyContent: 'space-between', minWidth: 0 },
      metaKey: { color: 'var(--dsw-alias-label-tertiary)', fontSize: 11.5, whiteSpace: 'nowrap' },
      metaValue: { color: 'var(--dsw-alias-label-secondary)', fontSize: 11.5, textAlign: 'right', overflowWrap: 'anywhere', minWidth: 0 },
      // THE HANDOFF'S ROW. The control is the block's one action, so it sits on its own line
      // under the run it belongs to rather than inside a fact row where it would read as one
      // more piece of metadata.
      metaAction: { display: 'flex', alignItems: 'center', gap: 8, paddingTop: 4 },
      // The fallback when the primitives are absent (the verify harness runs this half in a
      // stub, and the harness's own `Button` is not guaranteed there). Same ink as the kit's
      // outline variant, kept in one place so the two never drift.
      metaButton: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 8, border: '1px solid var(--dsw-alias-border-l3)', background: 'transparent', color: 'var(--dsw-alias-label-primary)', font: 'inherit', fontSize: 12, cursor: 'pointer' },
      prompt: { color: 'var(--dsw-alias-label-secondary)', fontSize: 11.5, lineHeight: '17px', whiteSpace: 'pre-wrap', background: 'var(--dsw-alias-bg-layer-2)', borderRadius: 8, padding: '6px 8px', maxHeight: 160, overflow: 'auto' },
      sectionLabel: { color: 'var(--dsw-alias-label-tertiary)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' },
      list: { display: 'flex', flexDirection: 'column', gap: 4 },
      item: { display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', borderRadius: 8, background: 'var(--dsw-alias-bg-layer-2)', minWidth: 0, border: '1px solid transparent', cursor: 'pointer', textAlign: 'left', width: '100%', font: 'inherit' },
      itemHover: { background: 'var(--dsw-alias-interactive-bg-hover)' },
      itemOn: { borderColor: 'var(--dsw-alias-brand-primary)' },
      swatch: { width: 28, height: 28, borderRadius: 6, objectFit: 'cover', flexShrink: 0, background: 'var(--dsw-alias-bg-layer-1, var(--dsw-alias-bg-layer-2))' },
      grow: { display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0, flex: '1 1 auto' },
    }

    /** A GET that answers a state rather than throwing: an empty library and an unreachable host never look alike. */
    function useJson(url) {
      const [state, setState] = React.useState(url === null ? { phase: 'idle', data: null, error: null } : { phase: 'loading', data: null, error: null })
      const [tick, setTick] = React.useState(0)
      React.useEffect(() => {
        // No URL is not a failure: a selection nothing has been made yet is simply idle.
        if (url === null) {
          setState({ phase: 'idle', data: null, error: null })
          return () => {}
        }
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

    // ── the inspect stage's arithmetic (epic 63 A4) ────────────────────────────
    //
    // ZOOM IS ARITHMETIC, NOT WEBGL, and the hard part — keeping the point under the cursor
    // under the cursor — is pure functions kept OUT of the component so they can be asserted
    // without rendering. The range is the stage's contract: 0.2 to 8, and a wheel AT a limit
    // returns the view UNCHANGED, scale and offset both, so scrolling at the floor cannot
    // drift the picture a pixel at a time.
    const ZOOM_MIN = 0.2
    const ZOOM_MAX = 8

    /** A scale inside the interaction range. */
    function clampZoom(scale, min = ZOOM_MIN, max = ZOOM_MAX) {
      if (!Number.isFinite(scale)) return min
      return Math.min(max, Math.max(min, scale))
    }

    /**
     * The scale a picture opens at: the largest that fits the frame, and never magnified past
     * 1:1 — a small picture is shown at its own size rather than blown up to fill the stage.
     *
     * A fit is NOT clamped to the zoom floor. The floor belongs to the wheel (it is where a
     * person stops zooming OUT); a fit that refused to go below it would open a 10,000-pixel
     * plate as a crop, which is the one thing "fit" promises not to do.
     */
    function fitScale(natural, frame) {
      if (!natural || !frame) return 1
      const nw = Number(natural.width)
      const nh = Number(natural.height)
      const fw = Number(frame.width)
      const fh = Number(frame.height)
      if (!(nw > 0) || !(nh > 0) || !(fw > 0) || !(fh > 0)) return 1
      return Math.min(1, fw / nw, fh / nh)
    }

    /** The offset that centres a picture of this natural size in the frame at this scale. */
    function centreOffset(natural, frame, scale) {
      const nw = natural && Number(natural.width) > 0 ? Number(natural.width) : 0
      const nh = natural && Number(natural.height) > 0 ? Number(natural.height) : 0
      const fw = frame && Number(frame.width) > 0 ? Number(frame.width) : 0
      const fh = frame && Number(frame.height) > 0 ? Number(frame.height) : 0
      return { x: (fw - nw * scale) / 2, y: (fh - nh * scale) / 2 }
    }

    /** The view a picture opens at: fitted, centred. */
    function fitView(natural, frame) {
      const scale = fitScale(natural, frame)
      return { scale, offset: centreOffset(natural, frame, scale) }
    }

    /**
     * Zoom about a point, keeping the picture point under it exactly there.
     *
     * `p = (cursor - offset) / scale` is the point in the picture that is under the cursor;
     * after the zoom it must satisfy `cursor = p * scale' + offset'`. At a limit the input
     * comes back unchanged — including the offset — which is the property that makes the
     * limits feel like a wall rather than a slow leak.
     */
    function zoomAt(view, factor, cursor, min = ZOOM_MIN, max = ZOOM_MAX) {
      const from = view && view.scale ? view.scale : 1
      const offset = { x: (view && view.offset && view.offset.x) || 0, y: (view && view.offset && view.offset.y) || 0 }
      const next = clampZoom(from * factor, min, max)
      if (next === from) return { scale: from, offset: { x: offset.x, y: offset.y } }
      const ratio = next / from
      const at = { x: (cursor && cursor.x) || 0, y: (cursor && cursor.y) || 0 }
      return { scale: next, offset: { x: at.x - (at.x - offset.x) * ratio, y: at.y - (at.y - offset.y) * ratio } }
    }

    /** Drag: the picture follows the hand, and the scale does not move. */
    function panBy(view, delta) {
      const scale = view && view.scale ? view.scale : 1
      const offset = { x: (view && view.offset && view.offset.x) || 0, y: (view && view.offset && view.offset.y) || 0 }
      return { scale, offset: { x: offset.x + ((delta && delta.x) || 0), y: offset.y + ((delta && delta.y) || 0) } }
    }

    /**
     * 1:1 — the picture at its own pixels, with `focus` (a point in picture coordinates, the
     * middle by default) left in the middle of the frame.
     */
    function oneToOne(natural, frame, focus = null) {
      const nw = natural && Number(natural.width) > 0 ? Number(natural.width) : 0
      const nh = natural && Number(natural.height) > 0 ? Number(natural.height) : 0
      const fw = frame && Number(frame.width) > 0 ? Number(frame.width) : 0
      const fh = frame && Number(frame.height) > 0 ? Number(frame.height) : 0
      const at = focus === null ? { x: nw / 2, y: nh / 2 } : { x: Number(focus.x) || 0, y: Number(focus.y) || 0 }
      return { scale: 1, offset: { x: fw / 2 - at.x, y: fh / 2 - at.y } }
    }

    /** The name without its extension: a picture is called by what it is, not by its format. */
    function stemOf(name) {
      const text = String(name || '')
      const dot = text.lastIndexOf('.')
      return dot > 0 ? text.slice(0, dot) : text
    }

    /** One filter row: a label, and the number of assets behind it. */
    /**
     * THE LIBRARY'S OWN SHAPE WHILE IT LOADS (polish pass, 2026-09-26). A centred spinner says
     * "something is happening"; six of the pane's own tiles wearing the app's skeleton token say
     * what is coming, so the grid does not jump into place afterwards.
     *
     * The pulse is a class, not an inline `animation`, because the keyframes have to be declared
     * somewhere — the sibling plugin's spinner set an `animation` name it never declared and
     * spun nothing for a week. `verify/mount.mjs` checks that every name this bundle animates is
     * declared in the sheet it injects.
     */
    function SkeletonGrid({ count = 6 }) {
      return h(
        'div',
        { style: S.grid, 'data-assets-skeleton': 'yes', 'aria-hidden': 'true' },
        ...Array.from({ length: count }, (_, index) =>
          h(
            'div',
            { key: 'sk:' + index, style: S.skeletonTile },
            h('div', { className: 'dsh-assets-skeleton', style: { width: '100%', aspectRatio: '3 / 4', ...S.skeletonBlock } }),
            h(
              'div',
              { style: { ...S.tileText, paddingTop: 8, paddingBottom: 10, gap: 5 } },
              h('span', { className: 'dsh-assets-skeleton', style: { ...S.skeletonBlock, height: 10, width: '72%', borderRadius: 4 } }),
              h('span', { className: 'dsh-assets-skeleton', style: { ...S.skeletonBlock, height: 9, width: '46%', borderRadius: 4 } }),
            ),
          ),
        ),
      )
    }

    /**
     * ONE FILTER, AS THE APP'S OWN DROPDOWN (founder, 2026-09-26: *"use dropdown select menu
     * primitives"*). `Menu` takes its own `anchor` — the trigger IS the anchor — closes itself on a
     * choice or a press outside, and hands the keyboard back to the trigger, so the pane owns
     * nothing but "which one is open".
     *
     * THE COUNTS ARE THE FIRST THING IN THE LIST, because a filter that cannot say how much is
     * behind it is a guess. The trigger carries the value the library is filtered by; a set filter
     * wears a `✕` that clears it in place.
     */
    function FilterMenu({ id, name, value, rows, onPick, onClear, t }) {
      const [open, setOpen] = React.useState(false)
      const isSet = value !== null && value !== undefined
      const ALL = '__all__'
      const items = rows.map((row) => ({
        id: row.value === null ? ALL : String(row.value),
        label: h(
          'div',
          { style: S.menuRow, 'data-assets-filter-row': row.value === null ? ALL : String(row.value) },
          h('span', { style: S.menuRowLabel }, row.label),
          h('span', { style: S.menuRowCount }, String(row.count)),
        ),
      }))
      const triggerProps = {
        'data-assets-filter-button': id,
        'aria-haspopup': 'true',
        'aria-expanded': open ? 'true' : 'false',
        disabled: rows.length === 0,
        onClick: () => setOpen((was) => !was),
      }
      const children = [
        h('span', { key: 'name' }, name),
        h('span', { key: 'value', style: S.filterValue }, isSet ? String(value) : t('pane.filter.all')),
        IconChevronDownOutline16 ? h(IconChevronDownOutline16, { key: 'chev', size: 12 }) : null,
      ]
      return h(
        'div',
        { style: S.filterWrap, 'data-assets-filter': id },
        h(
          'div',
          { style: { display: 'flex', alignItems: 'center', gap: 2 } },
          h(Menu, {
            open,
            side: 'bottom',
            align: 'start',
            items,
            selectedId: isSet ? String(value) : ALL,
            onSelect: (picked) => {
              setOpen(false)
              onPick(picked === ALL ? null : picked)
            },
            onClose: () => setOpen(false),
            anchor: Button
              ? h(Button, { variant: 'outline', size: 'sm', ...triggerProps }, children)
              : h('button', { type: 'button', ...triggerProps, style: S.filterButton }, children),
          }),
          isSet
            ? h(
                'button',
                { type: 'button', title: t('pane.filter.clear'), 'aria-label': t('pane.filter.clear'), 'data-assets-filter-clear': id, onClick: onClear, style: S.clearButton },
                IconCloseOutline16 ? h(IconCloseOutline16, { size: 12 }) : null,
              )
            : null,
        ),
      )
    }

    /**
     * ONE TILE. The 3/4 thumbnail, the name, and the two badges that are deliberately unlike
     * each other: the context is FILLED (where the asset belongs) and the size is OUTLINED
     * (how big it is). It is a button — `role`, `tabIndex`, Enter and Space — because a tile a
     * keyboard cannot reach is a tile half the people cannot use.
     *
     * DRAGGABLE ONLY WHEN THERE ARE BYTES: an entry with a name and no file is listed (so a
     * person can see the library knows about it) but nothing invents a file to carry.
     */
    function Tile({ asset, selected, onSelect, t, hovered = false, onHover = null }) {
      const carry = typeof asset.bytes === 'number' && asset.bytes > 0
      return h(
        'div',
        {
          role: 'button',
          tabIndex: 0,
          'aria-label': t('pane.selected') + ': ' + stemOf(asset.name),
          'data-assets-tile': 'yes',
          'data-assets-tile-selected': selected ? 'yes' : 'no',
          'data-assets-tile-hover': hovered ? 'yes' : 'no',
          onMouseEnter: () => onHover && onHover(asset.path),
          onMouseLeave: () => onHover && onHover(null),
          draggable: carry,
          onDragStart: (event) => {
            if (!carry) {
              event.preventDefault()
              return
            }
            // The path is what another surface needs — a prompt, an agent turn, an editor.
            try {
              event.dataTransfer.setData('text/plain', asset.path)
              event.dataTransfer.setData('text/uri-list', 'file://' + asset.path)
              event.dataTransfer.effectAllowed = 'copy'
            } catch {
              /* a browser that refuses the payload simply does not drag */
            }
          },
          onClick: () => onSelect(asset.path),
          onKeyDown: (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              onSelect(asset.path)
            }
          },
          style: { ...S.tile, ...(hovered && !selected ? S.tileHover : null), ...(selected ? S.tileOn : null) },
        },
        h(
          'div',
          { style: S.thumb },
          // A TILE ASKS FOR A PREVIEW, not the original: 320px is a tile's own size at this
          // pane's width, and the host answers the original when it cannot resize.
          h('img', { style: S.thumbImage, src: '/plugins/assets/file?path=' + encodeURIComponent(asset.path) + '&w=320', alt: '', loading: 'lazy', draggable: false }),
          h(
            'div',
            { style: S.badgeRow },
            asset.context ? h('span', { style: S.badgeFill, title: t('meta.context') }, asset.context) : null,
            asset.bytes ? h('span', { style: S.badgeLine, title: t('meta.bytes') }, sizeOf(asset.bytes)) : null,
          ),
        ),
        h(
          'div',
          { style: S.tileText },
          h('span', { style: S.itemName, title: asset.path }, stemOf(asset.name)),
          h(
            'span',
            { style: S.itemMeta },
            h('span', null, asset.date || ''),
            asset.hasRecord ? h('span', null, t('pane.recorded')) : h('span', null, t('pane.unrecorded')),
          ),
        ),
      )
    }

    /** One row of the list view: the same facts, read across. */
    function Row({ asset, selected, onSelect, t, hovered = false, onHover = null }) {
      return h(
        'button',
        {
          type: 'button',
          'data-assets-item': 'yes',
          'data-assets-tile-selected': selected ? 'yes' : 'no',
          'data-assets-item-hover': hovered ? 'yes' : 'no',
          onClick: () => onSelect(asset.path),
          onMouseEnter: () => onHover && onHover(asset.path),
          onMouseLeave: () => onHover && onHover(null),
          style: { ...S.item, ...(hovered && !selected ? S.itemHover : null), ...(selected ? S.itemOn : null) },
        },
        h('img', { style: S.swatch, src: '/plugins/assets/file?path=' + encodeURIComponent(asset.path) + '&w=64', alt: '', loading: 'lazy' }),
        h(
          'span',
          { style: S.grow },
          h('span', { style: S.itemName, title: asset.path }, stemOf(asset.name)),
          h(
            'span',
            { style: S.itemMeta },
            h('span', null, asset.date || ''),
            h('span', null, sizeOf(asset.bytes)),
            asset.context ? h('span', null, asset.context) : null,
            asset.hasRecord ? h('span', null, t('pane.recorded')) : h('span', null, t('pane.unrecorded')),
          ),
        ),
      )
    }

    /**
     * THE THREE VIEWS, AS THE APP'S OWN SEGMENTED CONTROL (founder, 2026-09-26, reading Finder's
     * toolbar: *"can you copy finder switch view w segmented control using icon buttons: grid, list,
     * filmstrip"*). A `tablist` whose white pill SLIDES under the selected segment — the primitive
     * places it arithmetically from `--dsh-segment-count`/`--dsh-segment-index` with a 160ms
     * transform, so the state change is animated without a line of animation here — and each segment
     * is an icon button whose word lives in its `title`, which keeps the control three glyphs wide.
     */
    function ViewToggle({ view, onView, t }) {
      const options = [
        { value: 'grid', title: t('pane.view.grid'), label: h(IconLayoutGrid, { size: 14 }) },
        { value: 'list', title: t('pane.view.list'), label: h(IconList, { size: 14 }) },
        // Finder's own Gallery, drawn with Lucide's `gallery-thumbnails`.
        { value: 'gallery', title: t('pane.view.gallery'), label: h(IconGalleryThumbnails, { size: 14 }) },
      ]
      return h(
        'span',
        { style: { display: 'inline-flex', flex: '0 0 auto' }, 'data-assets-view': view },
        h(SegmentedControl, { id: 'assets-view', value: view, options, onChange: onView, label: t('pane.view'), className: 'dsh-assets-views' }),
      )
    }

    /**
     * THE HANDOFF (epic 64 S7): a run a person finds here can be CONTINUED where it was made.
     *
     * IT CARRIES THREE FACTS, NOT ONE, and that is the honest shape of this seam. A run id
     * alone cannot open anything: the Generate pane opens a WORKFLOW tab and then shows that
     * run inside it, so the call carries the workflow the record names (`unit`) and the
     * provider it ran on — both of which this library already reads off the record. Epic 64's
     * shorthand `{ run: jobId }` assumed the receiver could resolve a job id by itself; it
     * cannot today, and a lookup there would duplicate knowledge the asset already holds.
     *
     * IT RUNS NOTHING. `openTab` shows a surface; the press that spends is still the person's
     * own, on Generate's own button, behind Generate's own gate (epic 64 S1).
     *
     * THE TWO WAYS IT CANNOT HAND OFF are sentences rather than dead controls: no Generate on
     * the page, or a record that does not name its workflow.
     */
    function ContinueControl({ jobId, workflow, provider, title, ready, openGenerate, t }) {
      if (workflow === '') {
        return h('span', { style: S.muted, 'data-assets-no-continue': 'no-workflow' }, t('meta.continue.noWorkflow'))
      }
      if (ready !== true || typeof openGenerate !== 'function') {
        return h('span', { style: S.muted, 'data-assets-no-continue': 'no-generate' }, t('meta.continue.noPlugin'))
      }
      const props = {
        title: t('meta.continue.hint'),
        'aria-label': t('meta.continue') + ' — ' + (title || workflow),
        'data-assets-continue': jobId,
        onClick: () => openGenerate(GENERATE_KIND, { params: { run: jobId, unit: workflow, provider } }),
      }
      const glyph = IconSparkle16 ? h(IconSparkle16, { size: 14 }) : null
      return h(
        'div',
        { style: S.metaAction, 'data-assets-continue-row': 'yes' },
        Button
          ? h(Button, { ...props, variant: 'outline', size: 'sm' }, glyph, t('meta.continue'))
          : h('button', { type: 'button', ...props, style: S.metaButton }, glyph, t('meta.continue')),
      )
    }

    /** The extensions the browser can draw. A clip gets its facts and no stage. */
    const PICTURE_EXT = /^(png|jpe?g|webp|gif|avif|tiff?|bmp|heic)$/i

    /**
     * THE INSPECT STAGE (epic 63 A4): the selected picture, fitted, zoomable about the cursor,
     * draggable, with its own pixels one press away.
     *
     * THE MATH IS NOT HERE — `fitView`, `zoomAt`, `panBy` and `oneToOne` are pure functions
     * above this component, so "the point under the cursor stays under the cursor" is asserted
     * without rendering anything (verify/inspect.mjs does exactly that, and the factory exposes
     * them for it). What this component owns is the parts that need a browser: measuring the
     * frame, turning a wheel event into a cursor, and holding the drag.
     *
     * PROGRESSIVE: it draws the 320–1024px preview the file route can make, and the 1:1 control
     * asks for the ORIGINAL — which is what a person inspecting focus wants, and is not what a
     * grid of tiles should ever cost.
     */
    function InspectStage({ detail, t }) {
      const frameRef = React.useRef(null)
      const [frame, setFrame] = React.useState({ width: 0, height: 0 })
      const [full, setFull] = React.useState(false)
      const drag = React.useRef(null)
      const natural = detail && detail.dimensions && detail.dimensions.width > 0 ? detail.dimensions : null
      const [view, setView] = React.useState(() => fitView(natural, { width: 0, height: 0 }))

      // The frame is MEASURED: the pane resizes (docked, split, fullscreen) and the fit follows
      // it. Without a ResizeObserver the stage opens at 1:1, which is a picture, not a blank.
      React.useEffect(() => {
        if (typeof ResizeObserver !== 'function' || !frameRef.current) return () => {}
        const observer = new ResizeObserver((entries) => {
          for (const entry of entries) {
            const box = entry.contentRect || {}
            setFrame({ width: Number(box.width) || 0, height: Number(box.height) || 0 })
          }
        })
        observer.observe(frameRef.current)
        return () => observer.disconnect()
      }, [detail && detail.path])

      // A new picture, a new frame, or the full-resolution swap: back to the fit.
      React.useEffect(() => {
        setView(fitView(natural, frame))
      }, [detail && detail.path, frame.width, frame.height])

      const src = (width) => '/plugins/assets/file?path=' + encodeURIComponent(detail.path) + (width ? '&w=' + width : '')

      /** A wheel event, in the stage's own coordinates. */
      const onWheel = (event) => {
        const box = event && event.currentTarget && event.currentTarget.getBoundingClientRect ? event.currentTarget.getBoundingClientRect() : { left: 0, top: 0 }
        const cursor = { x: (event && event.clientX ? event.clientX : 0) - (box.left || 0), y: (event && event.clientY ? event.clientY : 0) - (box.top || 0) }
        const factor = (event && event.deltaY ? event.deltaY : 0) < 0 ? 1.1 : 1 / 1.1
        setView((current) => zoomAt(current, factor, cursor))
      }
      const onPointerDown = (event) => {
        drag.current = { x: (event && event.clientX) || 0, y: (event && event.clientY) || 0 }
      }
      const onPointerMove = (event) => {
        if (drag.current === null) return
        const at = { x: (event && event.clientX) || 0, y: (event && event.clientY) || 0 }
        const delta = { x: at.x - drag.current.x, y: at.y - drag.current.y }
        drag.current = at
        setView((current) => panBy(current, delta))
      }
      const onPointerUp = () => {
        drag.current = null
      }
      const scale = view && view.scale ? view.scale : 1
      const offset = (view && view.offset) || { x: 0, y: 0 }
      return h(
        'div',
        {
          ref: frameRef,
          style: S.stage,
          'data-assets-stage': 'yes',
          'data-assets-stage-scale': String(scale),
          'data-assets-stage-full': full ? 'yes' : 'no',
          onWheel,
          onPointerDown,
          onPointerMove,
          onPointerUp,
          onPointerLeave: onPointerUp,
        },
        h('img', {
          style: { ...S.stageImage, transform: 'translate(' + offset.x + 'px, ' + offset.y + 'px) scale(' + scale + ')' },
          src: src(full ? null : 1024),
          alt: '',
          draggable: false,
          'data-assets-stage-image': 'yes',
        }),
        h('span', { style: S.stageHint }, t('stage.hint')),
        h(
          'div',
          { style: S.stageControls },
          h('span', { style: S.stageScale, 'data-assets-stage-label': 'yes' }, String(Math.round(scale * 100)) + '%'),
          h('button', { type: 'button', style: S.stageButton, title: t('stage.fit'), 'data-assets-stage-fit': 'yes', onClick: () => setView(fitView(natural, frame)) }, t('stage.fit')),
          h(
            'button',
            {
              type: 'button',
              style: S.stageButton,
              title: t('stage.oneHint'),
              'data-assets-stage-one': 'yes',
              onClick: () => {
                // 1:1 IS the full-resolution ask: the preview cannot show a pixel it does not have.
                setFull(true)
                setView(oneToOne(natural, frame))
              },
            },
            t('stage.one'),
          ),
        ),
      )
    }

    /**
     * THE METADATA BLOCK: what the catalog job is for.
     *
     * PROVENANCE WHEN A RUN MADE IT — the provider, the job, the workflow, the app, the date
     * it settled, the prompt verbatim and the values it ran with — and THE FILE'S OWN FACTS
     * WHEN NOTHING DID. `where it is` is on both, because "find the original" is the job. A
     * file a run made also carries the way back into that run's own pane (S7).
     */
    /**
     * THE THIRD VIEW (founder, 2026-09-26, reading Finder: *"grid, list, filmstrip"*, and then, on second thought, *"finder also calls it gallery, that's my ignorance"* — Finder's own View menu is Icons · List · Columns · **Gallery**, and Lucide's glyph for it is `gallery-thumbnails`): one picture
     * big, the frames in a strip under it, the facts beside it. It is the view A4's inspect stage was
     * built for — the stage is the SAME component the metadata block draws, at the pane's width, so
     * the zoom, the pan and the 1:1 control arrive with it and nothing is written twice.
     *
     * THE STRIP IS THE CATALOG, not a second fetch: each frame asks the file route for a 128px
     * preview, the way every other tile does. Nothing selected yet says so and waits — auto-selecting
     * the first frame would write to the view file from inside a render.
     */
    function GalleryView({ assets, selected, onSelect, detail, t }) {
      const ready = detail && detail.path === selected
      return h(
        'div',
        { style: S.gallery, 'data-assets-gallery': 'yes' },
        h(
          'div',
          { style: S.galleryStage, 'data-assets-gallery-stage': 'yes' },
          selected === null || selected === undefined
            ? h('span', { style: { ...S.muted, ...S.galleryHint }, 'data-assets-gallery-empty': 'yes' }, t('pane.gallery.pick'))
            : ready
              ? h(InspectStage, { detail, t })
              : h('img', { style: S.galleryPreview, src: '/plugins/assets/file?path=' + encodeURIComponent(selected) + '&w=1024', alt: '', 'data-assets-gallery-preview': 'yes' }),
        ),
        h(
          'div',
          { style: S.galleryStrip, 'data-assets-gallery-strip': 'yes', role: 'listbox', 'aria-label': t('pane.view.gallery') },
          ...assets.map((asset) =>
            h(
              'button',
              {
                key: asset.path,
                type: 'button',
                role: 'option',
                title: stemOf(asset.name),
                'aria-selected': asset.path === selected ? 'true' : 'false',
                'data-assets-frame': asset.path,
                'data-assets-frame-on': asset.path === selected ? 'yes' : 'no',
                onClick: () => onSelect(asset.path),
                style: { ...S.frame, ...(asset.path === selected ? S.frameOn : null) },
              },
              h('img', { style: S.frameImage, src: '/plugins/assets/file?path=' + encodeURIComponent(asset.path) + '&w=128', alt: '', loading: 'lazy', draggable: false }),
            ),
          ),
        ),
      )
    }

    function MetadataBlock({ detail, loading, t, openGenerate, generateReady, withStage = true }) {
      if (loading) return h('div', { style: S.meta, 'data-assets-meta': 'loading' }, h('span', { style: S.muted }, t('pane.loading')))
      if (!detail) return null
      const provenance = detail.provenance || null
      // The unit a run belongs to, as the record names it. The catalog reads the provider's
      // own field (`adapter` for RunningHub, `name` for Krea) and answers it as `workflow`;
      // the title is only ever a nicer word for the row a person reads.
      const workflow = provenance ? String(provenance.workflow || '') : ''
      // THE FILE'S OWN GRAPH (epic 64 S8): one line, and only when the library could actually
      // read this format. A file it cannot read draws NOTHING — `Not read` is for a PNG whose
      // chunks fall past the read bound, which is a different statement from "no graph".
      const carrier = detail.carrier || null
      const carrierText =
        !carrier || carrier.supported !== true
          ? null
          : carrier.complete === false
            ? t('meta.carrier.unknown')
            : carrier.hasGraph
              ? t('meta.carrier.yes').replace('{nodes}', String((carrier.api && carrier.api.nodes) || (carrier.ui && carrier.ui.nodes) || 0))
              : t('meta.carrier.no')
      const rows = [
        [t('meta.file'), detail.name],
        [t('meta.dimensions'), detail.dimensions ? detail.dimensions.width + ' × ' + detail.dimensions.height : '—'],
        [t('meta.format'), String(detail.ext || '').toUpperCase()],
        [t('meta.bytes'), sizeOf(detail.bytes)],
        [t('meta.date'), detail.date || '—'],
        [t('meta.context'), detail.context || '—'],
        [t('meta.where'), t('where.' + (detail.where || 'missing'))],
        ...(carrierText === null ? [] : [[t('meta.carrier'), carrierText]]),
      ]
      const runRows = provenance
        ? [
            [t('meta.provider'), provenance.provider],
            [t('meta.job'), provenance.jobId],
            [t('meta.workflow'), provenance.workflow || provenance.title || '—'],
            [t('meta.app'), provenance.appId === null || provenance.appId === undefined ? '—' : String(provenance.appId)],
            [t('meta.settled'), provenance.settledAt || provenance.at || '—'],
          ]
        : []
      const picture = detail.where === 'present' && PICTURE_EXT.test(String(detail.ext || ''))
      return h(
        'div',
        { style: S.meta, 'data-assets-meta': 'yes' },
        h('span', { style: S.metaHead }, t('meta.title')),
        // The stage first: the facts describe the picture, so the picture leads.
        // In the gallery the stage is already the pane's main column, so the block draws its
        // facts only — one picture, not two (`withStage`).
        withStage && picture ? h(InspectStage, { detail, t }) : null,
        ...rows.map(([key, value]) => h('div', { key: 'f:' + key, style: S.metaRow }, h('span', { style: S.metaKey }, key), h('span', { style: S.metaValue }, value))),
        provenance
          ? h(
              'div',
              { style: { display: 'flex', flexDirection: 'column', gap: 6 } },
              h('span', { style: S.sectionLabel }, t('meta.run')),
              ...runRows.map(([key, value]) => h('div', { key: 'r:' + key, style: S.metaRow }, h('span', { style: S.metaKey }, key), h('span', { style: S.metaValue }, value))),
              detail.prompt ? h('span', { style: S.sectionLabel }, t('meta.prompt')) : null,
              detail.prompt ? h('div', { style: S.prompt, 'data-assets-prompt': 'yes' }, detail.prompt) : null,
              detail.values && detail.values.length > 0 ? h('span', { style: S.sectionLabel }, t('meta.values')) : null,
              ...(detail.values || []).slice(0, 24).map((row) =>
                h('div', { key: 'v:' + row.key, style: S.metaRow }, h('span', { style: S.metaKey }, row.key), h('span', { style: S.metaValue }, row.value.length > 300 ? row.value.slice(0, 300) + '…' : row.value)),
              ),
              // THE WAY BACK IN (epic 64 S7). It is the block's one action, so it sits after
              // everything it acts on.
              h(ContinueControl, {
                jobId: provenance.jobId,
                workflow,
                provider: provenance.provider,
                title: provenance.title || '',
                ready: generateReady === true,
                openGenerate,
                t,
              }),
            )
          : h('span', { style: S.muted, 'data-assets-meta-norecord': 'yes' }, t('meta.noRecord')),
      )
    }

    /**
     * The pane. A1's three honest states, A2's controls, and A3's grid: the layouts, the
     * tiles, and the metadata block for whichever tile is selected.
     */
    function AssetsPane(props) {
      const t = (props && props.locale ? props.locale.bind(NS) : (key) => EN[key] || key)
      // THE VIEW IS THE FILE, not component state: the harness does not restore tabs in this
      // shell (the layout store is localStorage under an origin the shell randomises with
      // `--port 0`), so the layout, the two filters and the selection survive a reload
      // because view.json holds them.
      const [view, reloadView] = useJson(VIEW_URL)
      const [typed, setTyped] = React.useState('')
      const [search, setSearch] = React.useState('')
      const [busy, setBusy] = React.useState(false)
      const [failed, setFailed] = React.useState(null)
      // ONE HOVERED PATH FOR THE WHOLE PANE: exactly one tile is under the pointer, and a hook per
      // tile would make the pane's hook count depend on how many tiles are on screen — a shape the
      // verify shim (hooks keyed by call order) cannot survive.
      const [hoveredPath, setHoveredPath] = React.useState(null)

      const chosen = view.data || { view: 'grid', context: null, date: null, selected: null }
      const layout = chosen.view === 'list' ? 'list' : chosen.view === 'gallery' ? 'gallery' : 'grid'
      const context = chosen.context
      const date = chosen.date
      const selectedPath = chosen.selected

      const query = []
      if (context) query.push('context=' + encodeURIComponent(context))
      if (date) query.push('date=' + encodeURIComponent(date))
      const catalogUrl = CATALOG_URL + (query.length > 0 ? '?' + query.join('&') : '')
      const [registry, reloadRegistry] = useJson(FOLDERS_URL)
      const [catalog, reloadCatalog] = useJson(catalogUrl)
      const [detail, reloadDetail] = useJson(selectedPath ? DETAIL_URL + '?path=' + encodeURIComponent(selectedPath) : null)

      // THE HANDOFF'S OWN SEAM (epic 64 S7): the tab's actions, bound by the harness to the
      // session this tab is in — so the call lands in the right pane whether this tab is
      // docked, split or floating, and no service handle is kept anywhere in this file.
      const tabInfo = typeof props.useTabInfo === 'function' ? props.useTabInfo() : null
      const tabActions = tabInfo && tabInfo.tab && tabInfo.tab.actions ? tabInfo.tab.actions : null
      const openGenerate = tabActions && typeof tabActions.openTab === 'function' ? tabActions.openTab : null
      const generateReady = typeof props.canOpenGenerate === 'function' ? props.canOpenGenerate() === true : props.canOpenGenerate === true

      /** Every change to the view is written, so the next reload opens where this one left off. */
      const patchView = async (patch) => {
        try {
          const answer = await fetch(VIEW_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) })
          if (!answer.ok) throw new Error('http-' + answer.status)
          reloadView()
        } catch (error) {
          setFailed(String((error && error.message) || error))
        }
      }
      const select = (path) => {
        patchView({ selected: selectedPath === path ? null : path })
      }

      /**
       * EVERY FOLDER ACTION GOES THROUGH HERE, and it must exist: `+ Folder`, the typed-path
       * add, the Finder link on a row and the row's remove all call it. It was deleted with
       * the list that used it in A3 (`0badc39`, 2026-09-26) while these call sites stayed, so
       * every press threw `ReferenceError: post is not defined` inside the click handler — the
       * button rendered and did nothing at all, which is the bug the founder reported twice
       * (2026-09-26). The suites missed it because they read the tree and never pressed the
       * control; `verify/views.mjs` now presses it.
       *
       * A refused call is a state, not a throw: the answer's status is what the pane shows,
       * and the registry is re-read only when the host actually wrote something.
       */
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
          // The sentence stays (it is what a screen reader and a person both read); the spinner
          // became the pane's own shape, so the grid does not jump into place when the answer
          // lands (polish pass, 2026-09-26).
          h('div', { style: S.bar }, h('span', { style: S.muted, 'data-assets-loading': 'yes' }, t('pane.loading'))),
          h(SkeletonGrid, null),
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
                    ? h(Button, { variant: 'primary', size: 'sm', disabled: busy || typed.trim() === '', 'data-assets-add-path': 'yes', onClick: async () => { await post({ action: 'add', path: typed.trim() }); setTyped('') } }, t('pane.path.use'))
                    : null,
                ),
            failed ? h('span', { style: S.error }, t('pane.add.failed') + ' ' + failed) : null,
            // THE TWO SYSTEM PATHS ARE NOT ON SCREEN (founder, 2026-09-26: *"UI upgrade library
            // state and run records are Mitsumeru system folders? maybe use icon and finder link?
            // I'm not sure the purpose to showing this to user"*). They are this plugin's own
            // bookkeeping inside the app's profile — nothing a person acts on — and the route
            // still answers with them for a bug report. What a person CAN act on is the folder
            // they added, which is a Finder link in the list below.
          ),
        )
      }

      // THE SEARCH IS OVER WHAT THE LIBRARY KNOWS: the name, the prompt a run was given,
      // and the context. It narrows the list on this machine — no route, no scan.
      const needle = search.trim().toLowerCase()
      const shownAssets = needle === ''
        ? assets
        : assets.filter((asset) =>
            (asset.name + ' ' + (asset.context || '') + ' ' + ((asset.provenance && asset.provenance.prompt) || ''))
              .toLowerCase()
              .includes(needle),
          )

      // THE BAR'S OWN DATA. Each filter is a list of rows with their counts — the count is the
      // fact that keeps a collapsed filter honest — and the summary says how much is here.
      const rowFor = (value) => (value === '' ? '—' : value)
      const contextRows = [
        { value: null, label: t('pane.filter.all'), count: total, depth: 0 },
        ...counts.context.map((row) => ({ value: row.value, label: rowFor(row.value), count: row.count, depth: 1 })),
      ]
      const dateRows = [
        { value: null, label: t('pane.filter.all'), count: total, depth: 0 },
        ...counts.date.flatMap((year) =>
          year.months.flatMap((month) => month.days.map((day) => ({ value: day.day, label: day.day, count: day.count, depth: 1 }))),
        ),
      ]
      const summaryText = shownAssets.length === total
        ? t('pane.summary').replace('{n}', String(total))
        : t('pane.summary.filtered').replace('{shown}', String(shownAssets.length)).replace('{total}', String(total))

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
              h(
                'button',
                {
                  type: 'button',
                  title: t('pane.reveal') + ' — ' + folder.path,
                  'aria-label': t('pane.reveal') + ' ' + (folder.label || folder.path),
                  'data-assets-folder': folder.path,
                  disabled: busy,
                  onClick: () => post({ action: 'reveal', path: folder.path }),
                  style: S.folderButton,
                },
                IconFolderOpen ? h(IconFolderOpen, { size: 14, style: S.glyph }) : null,
                h('span', { style: S.folderName }, folder.label || folder.path),
              ),
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
              Button ? h(Button, { variant: 'primary', size: 'sm', disabled: busy || typed.trim() === '', 'data-assets-add-path': 'yes', onClick: async () => { await post({ action: 'add', path: typed.trim() }); setTyped('') } }, t('pane.path.use')) : null,
            ),
        failed ? h('span', { style: S.error }, t('pane.add.failed') + ' ' + failed) : null,

        // ── the bar: the search, the two layouts, the two filters, the count ──
        //
        // ONE ROW, and the pictures start high. The filters used to be two always-open trees
        // between this row and the grid; at `~/Desktop`'s 1,296 assets the date list alone could
        // own the screen (founder, 2026-09-26: *"now let's UX polish"*).
        h(
          'div',
          { style: S.bar, 'data-assets-bar': 'yes' },
          h(Input, {
            // The width lives on the wrapper (the primitive puts `...rest` on the inner input, and
            // `className` on its own flex wrap), so the field fills the row's leftover space.
            className: 'dsh-assets-search',
            icon: IconSearchOutline16 ? h(IconSearchOutline16, { size: 16 }) : null,
            value: search,
            placeholder: t('pane.search.placeholder'),
            'aria-label': t('pane.search.placeholder'),
            'data-assets-search': 'yes',
            onChange: (event) => setSearch(event.target.value),
          }),
          h(ViewToggle, { view: layout, onView: (next) => patchView({ view: next }), t }),
          h(FilterMenu, {
            id: 'context',
            name: t('pane.filter.context'),
            value: context,
            rows: contextRows,
            onPick: (next) => patchView({ context: next }),
            onClear: () => patchView({ context: null }),
            t,
          }),
          h(FilterMenu, {
            id: 'date',
            name: t('pane.filter.date'),
            value: date,
            rows: dateRows,
            onPick: (next) => patchView({ date: next }),
            onClear: () => patchView({ date: null }),
            t,
          }),
          h('span', { style: S.summary, 'data-assets-summary': 'yes' }, summaryText),
        ),

        // ── the two columns: the pictures, and the one you picked ─────────────
        //
        // THE BLOCK USED TO SIT UNDER THE WHOLE GRID, so reading the asset you had just picked
        // meant scrolling past every tile in the library. Now the grid keeps the left and the
        // block takes the right while there is width for both; below their minima they stack, and
        // the block goes back under the grid where it is the only place left to be.
        h(
          'div',
          { style: S.columns, 'data-assets-columns': 'yes' },
          h(
            'div',
            { style: S.columnMain, 'data-assets-main': 'yes' },
            shownAssets.length === 0
              ? h('span', { style: S.muted, 'data-assets-none': 'yes' }, total === 0 ? t('pane.none') : t('pane.none.match'))
              : layout === 'gallery'
                ? h(GalleryView, { assets: shownAssets, selected: selectedPath, onSelect: select, detail: detail.data, t })
                : layout === 'grid'
                ? h(
                    'div',
                    { style: S.grid, 'data-assets-grid': 'yes' },
                    ...shownAssets.map((asset) => h(Tile, { key: asset.path, asset, selected: selectedPath === asset.path, onSelect: select, t, hovered: hoveredPath === asset.path, onHover: setHoveredPath })),
                  )
                : h(
                    'div',
                    { style: S.list, 'data-assets-list': 'yes' },
                    ...shownAssets.map((asset) => h(Row, { key: asset.path, asset, selected: selectedPath === asset.path, onSelect: select, t, hovered: hoveredPath === asset.path, onHover: setHoveredPath })),
                  ),
            catalog.data && catalog.data.truncated ? h('span', { style: S.muted }, t('pane.truncated')) : null,
          ),
          selectedPath
            ? h(
                'div',
                { style: S.columnSide, 'data-assets-side': 'yes' },
                h(MetadataBlock, { detail: detail.data, loading: detail.phase === 'loading', t, openGenerate, generateReady, withStage: layout !== 'gallery' }),
              )
            : null,
        ),
      )
    }

    /**
     * THE CARD'S OWN MARK (founder, 2026-09-26: *"the icon for assets card should not be folder —
     * folder is already used for workspace files, lucide icon square-sparkles or something
     * similar"*). The harness ships no picture glyph at all — its set is ~140 glyphs in
     * Artwork / Medium / Regular variants and not one image, gallery or square-sparkle — and the
     * folder is Workspace's, so the mark is hand-drawn here: this plugin family draws the one
     * glyph a surface genuinely lacks rather than borrowing a neighbour's (its sibling's
     * `IconUpload24` is the other). Lucide's `square-sparkles` geometry on the 24-unit grid at
     * stroke 1.5, which lands on the harness's own Regular weight (1px) when the grid is drawn
     * at 16px, so it sits beside the app's icons rather than shouting next to them.
     *
     * IT IS IDENTITY ONLY. Where a folder IS the thing, a folder stays: the empty room, the
     * Finder link on a row and its reveal all keep `IconFolderOpen`. This mark says "the
     * library" and appears on the two identity places — the Start-page card and the pane chip.
     */
    function IconSquareSparkle({ size = 16, className, ...rest }) {
      return h(
        'svg',
        {
          width: size,
          height: size,
          className,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.5,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': 'true',
          'data-assets-mark': 'yes',
          ...rest,
        },
        h('path', { d: 'M11 15H7' }),
        h('path', { d: 'M15.41 2.49a.6.6 0 011.18 0l.63 3.334a1.2 1.2 0 00.956.955l3.334.631a.6.6 0 010 1.18l-3.334.63a1.2 1.2 0 00-.955.956l-.631 3.334a.6.6 0 01-1.18 0l-.63-3.334a1.2 1.2 0 00-.956-.955L10.49 8.59a.6.6 0 010-1.18l3.334-.63a1.2 1.2 0 00.955-.956z' }),
        h('path', { d: 'M21 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h6' }),
        h('path', { d: 'M9 13v4' }),
      )
    }

    /**
     * THE VIEW SWITCH'S THREE GLYPHS — Lucide's `layout-grid`, `list` and `gallery-thumbnails`
     * (founder, 2026-09-26: *"lucide icons: layout-grid, list, gallery-thumbnails"*), drawn here
     * rather than resolved from the harness. Mixing families was the reason: the harness's own grid
     * and rows marks are a different drawing (filled 16-unit geometry) and the filmstrip glyph had
     * to be hand-drawn because the harness ships none, so one control carried two styles.
     *
     * All three are 24-unit at stroke 1.5, which lands on the app's Regular weight (1px) once drawn
     * at 16px — the same grid and weight as the card's mark. `data-assets-view-icon` marks them, so
     * a suite can pin WHICH glyph is which rather than trusting three similar little squares.
     */
    function viewGlyph(name, children) {
      const ViewGlyph = ({ size = 16, className, ...rest }) =>
        h(
          'svg',
          {
            width: size,
            height: size,
            className,
            viewBox: '0 0 24 24',
            fill: 'none',
            stroke: 'currentColor',
            strokeWidth: 1.5,
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
            'aria-hidden': 'true',
            'data-assets-view-icon': 'yes',
            ...rest,
          },
          ...children,
        )
      // The verify shim names component instances by `type.name`, so an unnamed factory product
      // would report every glyph as `ViewGlyph#0..#2` and a failure would not name the one that broke.
      Object.defineProperty(ViewGlyph, 'name', { value: name })
      return ViewGlyph
    }

    const IconLayoutGrid = viewGlyph('IconLayoutGrid', [
      h('rect', { key: 'a', x: 3, y: 3, width: 7, height: 7, rx: 1 }),
      h('rect', { key: 'b', x: 14, y: 3, width: 7, height: 7, rx: 1 }),
      h('rect', { key: 'c', x: 14, y: 14, width: 7, height: 7, rx: 1 }),
      h('rect', { key: 'd', x: 3, y: 14, width: 7, height: 7, rx: 1 }),
    ])

    const IconList = viewGlyph('IconList', [
      h('path', { key: 'a', d: 'M3 5h.01' }),
      h('path', { key: 'b', d: 'M3 12h.01' }),
      h('path', { key: 'c', d: 'M3 19h.01' }),
      h('path', { key: 'd', d: 'M8 5h13' }),
      h('path', { key: 'e', d: 'M8 12h13' }),
      h('path', { key: 'f', d: 'M8 19h13' }),
    ])

    const IconGalleryThumbnails = viewGlyph('IconGalleryThumbnails', [
      h('rect', { key: 'a', x: 3, y: 3, width: 18, height: 14, rx: 2 }),
      h('path', { key: 'b', d: 'M4 21h1' }),
      h('path', { key: 'c', d: 'M9 21h1' }),
      h('path', { key: 'd', d: 'M14 21h1' }),
      h('path', { key: 'e', d: 'M19 21h1' }),
    ])

    /** The chip beside the DSH glyph: the library's own mark, then the name — the guide tab's own shape. */
    function AssetsTitle(props) {
      const t = props && props.locale ? props.locale.bind(NS) : (key) => EN[key] || key
      return h(
        'span',
        { style: { display: 'inline-flex', alignItems: 'center', gap: 6 }, 'data-assets-chip': 'yes' },
        h(IconSquareSparkle, { size: 16, style: S.glyph }),
        t('type.label'),
      )
    }

    /** The guide card's glyph — the library's mark, so the card is not a second Workspace folder. */
    function AssetsGuideIcon() {
      return h(IconSquareSparkle, { size: 20 })
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
      /**
       * IS THERE SOMEWHERE TO HAND OFF TO? (epic 64 S7.) The question is asked of the tab-type
       * registry — the one service that knows whether the Generate pane is on this page — and
       * it is asked at RENDER time, not once at registration, because a plugin's row may come
       * and go while this pane stays mounted.
       *
       * A registry that cannot be asked (an older core, or the verify stub) answers "no", and
       * the block draws its sentence rather than a control that would throw.
       */
      const canOpenGenerate = () => {
        const types = ctx.sidebarRightTabs
        return !!types && typeof types.get === 'function' && types.get(GENERATE_KIND) !== undefined
      }
      ctx.effect(() => {
        // ONE SHEET, AND IT DECLARES WHAT IT USES. The skeleton's pulse is the only thing in
        // this pane that cannot be an inline style: `animation` needs keyframes that live
        // somewhere, and an inline style has nowhere to put them. The sibling plugin shipped a
        // spinner whose `animation` name was never declared — it never spun, and nothing said so
        // — so the rule and its keyframes are written together here and `verify/mount.mjs`
        // checks that every class this bundle animates is declared in this text.
        const style = document.createElement('style')
        style.textContent =
          '@keyframes dsh-assets-skeleton { 0%, 100% { opacity: 1; } 50% { opacity: 0.45; } }\n' +
          '.dsh-assets-skeleton { animation: dsh-assets-skeleton 1.4s ease-in-out infinite; }\n' +
          '@media (prefers-reduced-motion: reduce) { .dsh-assets-skeleton { animation: none; } }\n' +
          // THE BAR'S TWO CONTROLS ARE THE SAME HEIGHT (founder, 2026-09-26: *"can match height of
          // segmented control with search input and then center icons"*). The field is the app's own
          // `Input`, which its own CSS pins at 32px; the switch is the app's `SegmentedControl`, whose
          // 28px tab plus 3px of padding comes to 34. So the padding drops to 2 — 2 + 28 + 2 = 32, the
          // input's own number — and the indicator, which is positioned from that padding (`top: 3px`,
          // `height: calc(100% - 6px)`, and a width that subtracts 6), is moved with it. THE SELECTORS
          // ARE STRUCTURAL ON PURPOSE: a CSS module's class names are hashed and cannot be named from
          // here, so the control is reached through the class this bundle owns and the parts through
          // their roles — an indicator is the one `aria-hidden` span, a segment is a button. If the
          // primitive ever reshapes itself the damage is cosmetic and visible, not silent.
          '.dsh-assets-search { flex: 1 1 200px; max-width: 340px; }\n' +
          '.dsh-assets-views { padding: 2px; }\n' +
          '.dsh-assets-views > span[aria-hidden="true"] { top: 2px; left: 2px; height: calc(100% - 4px); width: calc((100% - 4px - 2px * (var(--dsh-segment-count) - 1)) / var(--dsh-segment-count)); }\n' +
          // The glyphs were riding the text baseline (the primitive's tab is a plain button with 16px
          // side padding, laid out for words). A flex box centres a 14px mark in a 28px segment, and 10px
          // of side padding keeps a comfortable target without the word-shaped gutter.
          '.dsh-assets-views > button { display: inline-flex; align-items: center; justify-content: center; padding: 0 10px; }\n'
        document.head.appendChild(style)
        return () => {
          style.remove()
        }
      }, 'assets.style')
      ctx.effect(() => ctx.locale.register(NS, { en: EN, zh: ZH }), 'assets.copy')
      ctx.effect(() => ctx.sidebarRightTabs.register(assetsDefinition(t)), 'assets.type')
      ctx.effect(
        () =>
          ctx.slots.inject('sidebar.right.pane.tab', () =>
            ctx.slots.register(
              { name: 'sidebar.right.pane.tab', key: ASSETS_ID, locale: NS },
              /**
               * The pane itself stays free of the registry: it is handed a reader for the one
               * fact it cannot see, and everything else it needs arrives as props.
               *
               * THE PANE IS CALLED, NOT WRAPPED IN AN ELEMENT. A body registered here is a plain
               * function component, and the verify harness drives it by CALLING it — an outer
               * component that only returns `h(AssetsPane, …)` would hide the pane's own hooks
               * from that call, and every suite would read a component stuck in its loading
               * state. Calling it with the extra prop keeps one component and one hook order,
               * which is what React does with a wrapper anyway.
               */
              (props) => AssetsPane({ ...props, canOpenGenerate }),
            ),
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

    /**
     * `zoom` is a TEST SEAM and it is deliberate: the client half is one self-contained script,
     * so the pure arithmetic cannot live in a module a suite could import. Exposing it here is
     * what lets verify/inspect.mjs assert "the point under the cursor stays under the cursor"
     * as arithmetic rather than by rendering and squinting at a transform.
     */
    return { inject, apply, zoom: { ZOOM_MIN, ZOOM_MAX, clampZoom, fitScale, fitView, centreOffset, zoomAt, panBy, oneToOne } }
  },
})
