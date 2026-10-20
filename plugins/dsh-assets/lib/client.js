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
    // The refresh control (founder, 2026-10-17: *"it needs a refresh button to refresh the view so
    // when agent does housecleaning the user can update the view"*). The app's own glyph, so it sits
    // beside the bar's other marks at the same weight.
    const IconRefreshOutline16 = icon('IconRefreshOutlineRegular', 'IconRefreshOutline16')
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
    const DELETE_URL = '/plugins/assets/delete'

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
      // THE FILMSTRIP CAROUSEL (2026-10-18): the arrows over the main thumb move the selection, and
      // the strip follows. Named for a screen reader; the glyph says it visually.
      'pane.carousel.prev': 'Previous image',
      'pane.carousel.next': 'Next image',
      'pane.search.placeholder': 'Search by name or prompt',
      // THE REFRESH CONTROL'S WORDS (founder, 2026-10-17): the sentence says what it re-reads, and the
      // label names the thing that changed on disk rather than the word "refresh" alone.
      'pane.refresh': 'Refresh',
      'pane.refresh.hint': 'Re-read these folders — files added or moved outside the app show up here.',
      'pane.refreshed': '{n} assets — up to date',
      // THE DIVIDER: a split a person can drag, and a way back to the default one.
      'pane.split': 'Drag to resize the columns — double-click to reset',
      'pane.split.reset': 'Default columns',
      'pane.selected': 'Selected',
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
      // THE DISCLOSURE'S TWO HOVER SENTENCES (2026-10-17): the row itself says the file's name, so the
      // tip only has to say what the press does.
      'meta.facts.show': 'Show this file\'s details',
      'meta.facts.hide': 'Hide this file\'s details',
      // THE DESTRUCTIVE ACT, in Finder's own words: the control says Delete (what a person
      // calls it), the confirm says Move to Trash (what actually happens).
      'meta.delete': 'Delete',
      'meta.deleteAsk': 'Move this to the Trash?',
      'meta.deleteYes': 'Move to Trash',
      'meta.deleteCancel': 'Cancel',
      'meta.trashed': 'Moved to the Trash: {name}',
      'meta.trashFailed': 'The Trash refused it',
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
      'pane.carousel.prev': '上一张',
      'pane.carousel.next': '下一张',
      'pane.search.placeholder': '按名称或提示词搜索',
      'pane.refresh': '刷新',
      'pane.refresh.hint': '重新读取这些文件夹——在应用之外新增或移动的文件会出现在这里。',
      'pane.refreshed': '{n} 项资产 —— 已是最新',
      'pane.split': '拖动可调整两栏宽度——双击恢复默认',
      'pane.split.reset': '恢复默认宽度',
      'pane.selected': '已选择',
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
      'meta.facts.show': '展开此文件的详细信息',
      'meta.facts.hide': '收起此文件的详细信息',
      'meta.delete': '删除',
      'meta.deleteAsk': '移到废纸篓？',
      'meta.deleteYes': '移到废纸篓',
      'meta.deleteCancel': '取消',
      'meta.trashed': '已移到废纸篓：{name}',
      'meta.trashFailed': '废纸篓拒绝了该操作',
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
      // THE PANE IS A COLUMN, SO EVERY CHILD IS A FLEX ITEM — and a flex item's default is `flex: 0 1 auto`,
      // which means it MAY SHRINK. The tab strip carries `overflowY: hidden`, and an `overflow` other than
      // `visible` removes the automatic minimum size a flex item otherwise gets, so under the grid's weight
      // the strip shrank to a two-pixel sliver (founder, 2026-10-17: *"tabs are there but clipped"*). Every
      // fixed row in this pane therefore says `flex: 0 0 auto` out loud: a toolbar is not a flexible thing.
      // THE PANE ITSELF DOES NOT SCROLL (2026-10-18): it is a fixed frame around a fixed top block and
      // a columns row that owns the scrolling. The loading, error and empty states restore `auto`
      // inline, because there the pane is still one sheet of content.
      // `boxSizing: border-box` matters now that the pane is a fixed frame: without it the 36px of
      // vertical padding is added ON TOP of `height: 100%`, so the columns row would hang past the
      // pane's bottom by the padding it never counted.
      pane: { display: 'flex', flexDirection: 'column', gap: 12, padding: '18px 16px', height: '100%', minHeight: 0, boxSizing: 'border-box', overflow: 'hidden' },
      // THE THREE ROWS THAT STAY PUT: the header, the folder tabs and the bar. `flex: 0 0 auto` is what
      // keeps them at their content height so the columns get the rest of the pane.
      top: { display: 'flex', flexDirection: 'column', gap: 12, flex: '0 0 auto', minWidth: 0, minHeight: 0 },
      centre: { margin: 'auto 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, textAlign: 'center', maxWidth: 380, alignSelf: 'center' },
      title: { color: 'var(--dsw-alias-label-primary)', fontSize: 14, fontWeight: 600 },
      body: { color: 'var(--dsw-alias-label-secondary)', fontSize: 13, lineHeight: '19px' },
      muted: { color: 'var(--dsw-alias-label-tertiary)', fontSize: 11.5, lineHeight: '17px' },
      glyph: { color: 'var(--dsw-alias-label-tertiary)', display: 'flex' },
      head: { display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between', flex: '0 0 auto' },
      // ── THE FOLDER TABS (2026-10-17) ─────────────────────────────────────────
      //
      // ONE ROW, SCROLLING SIDEWAYS, not a stacked list: the folders are places to switch between, so they
      // read as the harness's own tab strip one row down — a muted label at rest, and the ACTIVE tab
      // wearing the app's outline (`--dsw-alias-border-l3`, the same pair the DSH strip uses). Nothing
      // here is a card: a tab is a label with a hit area, not a block.
      //
      // `flex: '0 0 auto'` with `flexWrap: 'nowrap'` is what keeps a strip a strip: names never truncate
      // into each other, the row scrolls when there are many folders, and a long path cannot push the
      // controls below it off the pane.
      tabs: { display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'nowrap', overflowX: 'auto', overflowY: 'hidden', paddingBottom: 2, minWidth: 0, flex: '0 0 auto', minHeight: 26 },
      tab: { display: 'inline-flex', alignItems: 'center', gap: 2, flex: '0 0 auto', padding: '0 2px 0 0', border: '0.5px solid transparent', borderRadius: 7, minWidth: 0 },
      tabOn: { borderColor: 'var(--dsw-alias-border-l3)' },
      // The label itself is the switch: no fill, no border, the strip's own ink.
      tabButton: { display: 'inline-flex', alignItems: 'center', gap: 5, minWidth: 0, padding: '3px 5px', border: 0, background: 'transparent', color: 'var(--dsw-alias-label-secondary)', font: 'inherit', fontSize: 11.5, cursor: 'pointer', whiteSpace: 'nowrap' },
      tabGlyph: { color: 'var(--dsw-alias-label-tertiary)', display: 'flex', flex: '0 0 auto' },
      tabLabel: { overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 150 },
      // The count and the close sit in the SAME slot, so selecting a tab changes the control in place
      // rather than growing the tab by a glyph.
      tabCount: { color: 'var(--dsw-alias-label-tertiary)', fontSize: 10.5, fontVariantNumeric: 'tabular-nums', paddingRight: 4 },
      tabClose: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 18, padding: 0, border: 0, borderRadius: 5, background: 'transparent', color: 'var(--dsw-alias-label-tertiary)', cursor: 'pointer', flex: '0 0 auto' },
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
      // The trash confirm's own words, drawn in the pill's transient bubble.
      deleteAsk: { color: 'var(--dsw-alias-label-secondary)', fontSize: 11.5 },
      notice: { color: 'var(--dsw-alias-label-secondary)', fontSize: 11.5, padding: '0 2px' },
      // THE GRID, from the OS that shipped this surface: fluid columns, a 240px floor, no
      // breakpoints — the pane's own width is the only input (`repeat(auto-fit, minmax(240px, 1fr))`).
      // THE FLOOR YIELDS TO THE COLUMN WHEN THE SPLIT MAKES IT NARROW (2026-10-18): the right-hand
      // preview can now take most of the pane, and a 240px hard floor would overflow a 120px thumbnail
      // column instead of letting its one tile shrink with it. `min(240px, 100%)` is the floor that
      // still makes a wide pane several 240px columns.
      grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px, 100%), 1fr))', gap: 12, alignContent: 'start' },
      tile: { display: 'flex', flexDirection: 'column', gap: 0, minWidth: 0, padding: 0, border: '1px solid var(--dsw-alias-border-l2)', borderRadius: 10, background: 'var(--dsw-alias-bg-layer-2)', cursor: 'pointer', textAlign: 'left', overflow: 'hidden' },
      // HOVER IS STATE, NOT A SHEET: every style in this pane is inline, so there is no `:hover`
      // to write — the tile carries the flag and swaps its own border (founder, 2026-09-23, on
      // the sibling's account arrow: *"add onhover on the website link arrow to theme primary
      // token color"*). SELECTED TAKES THE BRAND ACCENT, which is the app's own "this one".
      tileHover: { borderColor: 'var(--dsw-alias-border-l3)' },
      tileOn: { borderColor: 'var(--dsw-alias-brand-primary)' },
      // ONE RATIO FOR EVERY TILE, so a grid stays a grid.
      thumb: { position: 'relative', width: '100%', aspectRatio: '3 / 4', background: 'var(--dsw-alias-bg-layer-1, var(--dsw-alias-bg-layer-2))', overflow: 'hidden' },
      thumbImage: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
      // NO OVERLAY ON THE PICTURE (2026-10-18). The tile used to carry two badges on top of the
      // thumbnail: a filled context ("fashion people") and an outlined size. The founder asked for
      // the picture to be the card and the facts to sit under it: *"the thumbnail fills the card and
      // text is below, remove the badge fashion people ... 1.6 MB badge below the thumbnail card"*.
      // The size survives as an outlined chip in the text area; the context lives in the facts card.
      badgeLine: { border: '1px solid var(--dsw-alias-border-l3)', color: 'var(--dsw-alias-label-secondary)', fontSize: 10.5, lineHeight: '15px', padding: '0 4px', borderRadius: 4, whiteSpace: 'nowrap', letterSpacing: '0.02em', flex: '0 0 auto' },
      // The text is BELOW the image, not on it: a little breathing room above the filename, and the
      // card's own padding is the only inset around it.
      tileText: { padding: '7px 8px 8px', display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 },

      // ── the polish pass (founder, 2026-09-26: *"now let's UX polish"*) ─────
      //
      // THE BAR IS ONE ROW: the search, the two layouts, the two filters and the count. The
      // grid then starts high, and a filter no longer owns the screen before the pictures do.
      bar: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', flex: '0 0 auto' },
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
      // THE REFRESH CONTROL (founder, 2026-10-17). A glyph at the bar's end, sized to sit level with
      // the filters' 32px and wearing the same hairline family, so the row still reads as one strip of
      // controls. The mark turns while a read is running (`refreshBusy`) and the button refuses a
      // second press, because a slow folder should be one read rather than a queue of them.
      refreshButton: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto', width: 30, height: 30, padding: 0, borderRadius: 8, border: '1px solid var(--dsw-alias-border-l2)', background: 'transparent', color: 'var(--dsw-alias-label-secondary)', cursor: 'pointer' },
      refreshBusy: { color: 'var(--dsw-alias-label-tertiary)', cursor: 'progress' },
      // The fallback when the app's icon set is absent (the verify stub does not guarantee it).
      refreshFallback: { fontSize: 13, lineHeight: '1' },
      // THE TWO COLUMNS, AND THE LINE BETWEEN THEM (founder, 2026-10-17: *"the panel should be
      // constructed w 2 resizable panels, a lot of times I need to see the larger image"*).
      //
      // THE SPLIT IS THE PERSON'S, so the columns stop being a fixed 3:2 pair: each takes its share of
      // the free width from the view file (`split`), which is what makes the divider draggable and why
      // a drag survives a reload. `flex: '0 0 N%'` rather than `flexGrow`, because a share of the free
      // width is exactly what the drag computes — grow factors would re-divide whatever the floors
      // leave over and the handle would drift away from the pointer.
      //
      // THE HANDLE IS PART OF THE SIDE'S SHARE, NOT AN EXTRA COLUMN (2026-10-18). It used to be a 12px
      // flex item between columns whose bases already added to 100%, with the row's own `gap: 12` on
      // both sides of it: 100% + 24px cannot fit, so the row wrapped and the preview fell UNDER the
      // grid — the founder's *"the grid view is missing the large image on right"*. Now the row has no
      // gap, the handle is 12px carved out of the side's share (`calc(R% - 12px)`), and the two columns
      // plus the handle add up to exactly 100%.
      //
      // THE FLOORS ARE STILL THE CONTRACT: 120 + 240 + the 12px handle is the width below which there
      // are not two columns, only a stack — the breakpoint is the pane's own width, because the pane is
      // what resizes. The pane measures the row (`ResizeObserver`) and stacks below that number; when it
      // does, the divider goes with it, since there is nothing to divide.
      // THE ROW FILLS THE PANE'S REMAINING SPACE, and its main column fills the row's WIDTH. Without a
      // `flex` a flex item is shrink-to-fit, so the `repeat(auto-fit, minmax(240px, 1fr))` grid inside it
      // had a 240px container to divide and laid itself out in ONE column with the pane's width empty
      // beside it (founder, 2026-10-17, in the same screenshot as the clipped tabs).
      // The row clips (or scrolls, when stacked) and gives each column a DEFINITE height, which is what
      // makes `overflowY: auto` on a column actually scroll instead of growing.
      columns: { display: 'flex', flexWrap: 'wrap', gap: 0, alignItems: 'stretch', minWidth: 0, flex: '1 1 0', minHeight: 0, overflow: 'hidden' },
      // The floors are MONOTONIC with the split: the thumbnail column may shrink to 120px, and the
      // preview never goes below 240px, so dragging the handle all the way left makes the picture most
      // of the frame instead of squeezing both columns into noise.
      // EACH COLUMN IS ITS OWN SCROLL BOX (2026-10-18). `minHeight: 0` plus a definite height from the
      // row is the flex rule that lets a child scroll instead of pushing its parent taller.
      columnMain: { display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0, height: '100%', flex: '1 1 100%', overflowY: 'auto', overflowX: 'hidden' },
      columnSide: { display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0, height: '100%', overflowY: 'auto', overflowX: 'hidden' },
      // THE HANDLE. A 12px column that is mostly air: the line is what a person sees, the rest is what
      // their pointer can actually hit, so the split is grabbable without the divider looking heavy.
      // It is a flex item with a real 12px width, but the side's basis subtracts it, so the row still
      // totals exactly 100%. `touchAction: none` because a drag on a trackpad must not also scroll the
      // pane.
      split: { flex: '0 0 12px', alignSelf: 'stretch', minHeight: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'col-resize', touchAction: 'none', background: 'transparent' },
      splitLine: { width: 1, alignSelf: 'stretch', borderRadius: 1, background: 'var(--dsw-alias-border-l2)', transition: 'background 120ms ease' },
      // The handle under the pointer (or held): the brand accent, the app's own "this one".
      splitLineOn: { background: 'var(--dsw-alias-brand-primary)' },
      // THE SKELETON wears the app's own token and the pane's own shape, so the library looks
      // like itself while it loads instead of throwing a spinner into the middle of nothing.
      skeletonTile: { border: '1px solid var(--dsw-alias-border-l2)', borderRadius: 10, overflow: 'hidden', background: 'var(--dsw-alias-bg-layer-2)' },
      skeletonBlock: { background: 'var(--dsw-alias-bg-skeleton)' },

      // ── the gallery (founder, 2026-09-26, from Finder; enlarged 2026-10-18) ──
      //
      // THE MAIN THUMB IS THE TOP AND THE FILMSTRIP IS THE BOTTOM (founder, 2026-10-18: *"fix the main
      // thumb top+filmstrip bottom. it should also have metadata bottom right to make the main thumb
      // bigger"*). The stage takes every pixel the column can give it; the 56×74 frames are one fixed
      // row under it; the facts are a floating card over the stage's lower-right corner — the same
      // `metaFloat` the grid/list preview uses — instead of a side column stealing the picture's width.
      gallery: { display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0, minHeight: 0, flex: '1 1 auto' },
      galleryStage: { position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', flex: '1 1 auto', minHeight: 0, borderRadius: 10, background: 'var(--dsw-alias-bg-layer-2)', overflow: 'hidden' },
      galleryPreview: { maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block' },
      galleryHint: { padding: 24, textAlign: 'center' },
      galleryStrip: { display: 'flex', gap: 6, overflowX: 'auto', overflowY: 'hidden', paddingBottom: 4, flex: '0 0 auto' },
      // THE CAROUSEL ARROWS (2026-10-18). They hover over the main thumb's mid-left and mid-right and
      // move the SELECTION (the strip follows), not just the strip's scroll offset — the founder asked
      // for a carousel because the strip's overlay scrollbar is a hard mouse target.
      carouselButton: { position: 'absolute', top: '50%', transform: 'translateY(-50%)', zIndex: 4, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, padding: 0, borderRadius: '50%', border: '0.5px solid var(--dsw-alias-border-l3)', background: 'var(--dsw-alias-bg-layer-2)', color: 'var(--dsw-alias-label-primary)', cursor: 'pointer', boxShadow: 'var(--dsw-elevation-prominent, 0 4px 12px rgba(0, 0, 0, 0.24))' },
      frame: { flex: '0 0 auto', width: 56, height: 74, padding: 0, borderRadius: 8, border: '1px solid var(--dsw-alias-border-l2)', background: 'var(--dsw-alias-bg-layer-2)', cursor: 'pointer', overflow: 'hidden' },
      frameOn: { borderColor: 'var(--dsw-alias-brand-primary)' },
      frameImage: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
      // THE INSPECT STAGE (epic 63 A4): the picture in a frame of its own, above the facts.
      // THE FRAME IS THE PICTURE'S SHAPE (founder, 2026-09-26: *"fix the main preview it should be same
      // aspect as the image or we can lock view as 3:4 as default"*). It was a fixed 280px-tall box, so a
      // 3:4 portrait sat in a wide short letterbox; the ratio, the ceiling and the width cap are set per
      // picture in `InspectStage` (`aspectRatio` + `maxHeight`, with `maxWidth` keeping the box the
      // picture's own shape when the pane is wide rather than letting the ratio run past 60vh).
      // A FRAME, SO THE PICTURE HAS AN EDGE (founder, 2026-09-26: *"add border around the side preview"*).
      // The stage's own fill is a layer, not a line: on a light theme a pale photograph on a pale pane had
      // no boundary at all, so the preview read as part of the page rather than as one picture. The ink is
      // the one the app's own cards use (`--dsw-alias-border-l3`) and it is BORDER-BOX, so the hairline
      // cannot push the frame a pixel past the column it is measured in.
      stage: { position: 'relative', width: '100%', boxSizing: 'border-box', border: '0.5px solid var(--dsw-alias-border-l3)', overflow: 'hidden', borderRadius: 10, background: 'var(--dsw-alias-bg-layer-1, var(--dsw-alias-bg-layer-2))', cursor: 'grab', touchAction: 'none' },
      stageImage: { position: 'absolute', top: 0, left: 0, transformOrigin: '0 0', maxWidth: 'none', maxHeight: 'none', display: 'block', userSelect: 'none' },
      stageControls: { position: 'absolute', right: 6, bottom: 6, display: 'flex', alignItems: 'center', gap: 4, padding: '3px 5px', borderRadius: 8, background: 'var(--dsw-alias-bg-layer-2)', border: '1px solid var(--dsw-alias-border-l2)' },
      stageHint: { position: 'absolute', left: 8, bottom: 8, color: 'var(--dsw-alias-label-tertiary)', fontSize: 10.5, pointerEvents: 'none' },
      stageButton: { border: 0, background: 'transparent', color: 'var(--dsw-alias-label-primary)', font: 'inherit', fontSize: 11.5, padding: '2px 6px', borderRadius: 6, cursor: 'pointer' },
      stageScale: { color: 'var(--dsw-alias-label-tertiary)', fontSize: 11, minWidth: 34, textAlign: 'center', fontVariantNumeric: 'tabular-nums' },
      metaRow: { display: 'flex', gap: 10, justifyContent: 'space-between', minWidth: 0 },
      metaKey: { color: 'var(--dsw-alias-label-tertiary)', fontSize: 11.5, whiteSpace: 'nowrap' },
      metaValue: { color: 'var(--dsw-alias-label-secondary)', fontSize: 11.5, textAlign: 'right', overflowWrap: 'anywhere', minWidth: 0 },
      // ── THE METADATA PILL (2026-10-18) ─────────────────────────────────────
      //
      // The founder: *"make the floating metadata card just a pill with 2 icon buttons, expand and
      // trash. all views are like this"*. At rest the metadata is a small capsule at the preview's
      // lower-right: a chevron and a trash can, nothing else. The facts panel grows UPWARD from the
      // pill when the chevron is pressed; the pill itself stays put. The confirm for the trash is a
      // transient bubble above the pill, not a permanent row.
      //
      // THE PILL IS ABSOLUTE against the caller's positioned preview box (the grid/list side column,
      // the stacked stage, or the gallery stage). `maxHeight: calc(100% - 64px)` reserves the top
      // strip for the stage's hint and Fit / 1:1 controls; the panel is the flexible child that
      // scrolls when the facts outgrow the space.
      pillWrap: { position: 'absolute', right: 8, bottom: 8, zIndex: 3, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, maxWidth: 'calc(100% - 16px)', maxHeight: 'calc(100% - 64px)', boxSizing: 'border-box' },
      pill: { display: 'inline-flex', alignItems: 'center', gap: 2, padding: 3, borderRadius: 999, border: '0.5px solid var(--dsw-alias-border-l3)', background: 'var(--dsw-alias-bg-layer-2)', boxShadow: 'var(--dsw-elevation-prominent, 0 8px 24px rgba(0, 0, 0, 0.28))', flex: '0 0 auto' },
      pillButton: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, padding: 0, border: 0, borderRadius: '50%', background: 'transparent', color: 'var(--dsw-alias-label-primary)', cursor: 'pointer' },
      pillDanger: { color: 'var(--dsw-alias-state-error-primary)' },
      pillPanel: { display: 'flex', flexDirection: 'column', gap: 6, flex: '0 1 auto', minHeight: 0, overflowY: 'auto', overflowX: 'hidden', width: 'min(360px, 100%)', padding: '10px 12px', borderRadius: 12, border: '0.5px solid var(--dsw-alias-border-l3)', background: 'var(--dsw-alias-bg-layer-2)', boxShadow: 'var(--dsw-elevation-prominent, 0 8px 24px rgba(0, 0, 0, 0.28))' },
      pillHead: { display: 'flex', alignItems: 'baseline', gap: 6, minWidth: 0 },
      pillAsk: { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', maxWidth: '100%', flex: '0 0 auto', padding: '7px 9px', borderRadius: 10, border: '0.5px solid var(--dsw-alias-border-l3)', background: 'var(--dsw-alias-bg-layer-2)', boxShadow: 'var(--dsw-elevation-prominent, 0 8px 24px rgba(0, 0, 0, 0.28))' },
      pillError: { maxWidth: '100%', flex: '0 0 auto', padding: '6px 9px', borderRadius: 10, border: '0.5px solid var(--dsw-alias-border-l3)', background: 'var(--dsw-alias-bg-layer-2)', color: 'var(--dsw-alias-state-error-primary)', fontSize: 11.5 },
      factsName: { flex: '1 1 auto', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12, fontWeight: 500 },
      factsSummary: { flex: '0 0 auto', color: 'var(--dsw-alias-label-tertiary)', fontSize: 11, fontVariantNumeric: 'tabular-nums' },
      // The panel's facts, under its filename row. No extra indent: the panel itself is the inset.
      factsBody: { display: 'flex', flexDirection: 'column', gap: 6 },
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

    // ── the two columns' arithmetic (the 2026-10-17 split) ─────────────────────
    //
    // THE SPLIT IS A SHARE, NOT A WIDTH, and it is kept as pure functions for the same reason the
    // stage's zoom is: "a drag from this pointer lands on this share" and "neither column can be
    // dragged out of existence" are claims a suite can assert without a browser.
    //
    // THE BOUNDS ARE THE SAME IN THE HOST AND HERE (`SPLIT_MIN`/`SPLIT_MAX`/`SPLIT_DEFAULT` in
    // lib/index.js). They are duplicated because the two halves ship as separate files a profile
    // composes independently — but they must agree, or a drag would be clamped in the pane and stored
    // as something else, and the columns would move on the next read. `verify/intake.mjs` posts the
    // bounds and asserts the host stores them.
    //
    // THE RANGE IS WIDE ON PURPOSE (2026-10-18): this is the detail-inspection surface, so the
    // thumbnail column can go down to 10% and the preview can take 90% — the old 30% floor left the
    // picture smaller than the wall of tiles it was meant to be inspected against. The pane's pixel
    // floor (120px) is usually the binding one on a real pane.
    const SPLIT_MIN = 0.1
    const SPLIT_MAX = 0.85
    const SPLIT_DEFAULT = 0.6
    // A HOST THAT ANSWERS NO BOUNDS IS THE OLD HOST (2026-10-18). The widening above shipped with a
    // host that also widened its clamp, but a running app from before that build still refuses a
    // share below 0.3 — and the pane must not offer a drag the host will clamp away on release, which
    // is the founder's *"it snaps back to bigger size"*. The view route now answers `splitBounds`;
    // absent that field, the pane uses exactly the old build's range, so a drag to its floor stays
    // put. After a restart the new host answers 0.1–0.85 and the full range opens by itself.
    const HOST_SPLIT_FALLBACK = { min: 0.3, max: 0.8 }
    // The 12px the handle itself occupies, carved out of the side's share rather than added to the row.
    const SPLIT_HANDLE = 12
    // The two columns' floors. Below MAIN + SIDE + HANDLE there is not enough width for two columns, so
    // the pane stacks them (and hides the handle) — the pane's own width is the breakpoint.
    const MAIN_FLOOR = 120
    const SIDE_FLOOR = 240
    const STACK_BELOW = MAIN_FLOOR + SIDE_FLOOR + SPLIT_HANDLE
    // A pane whose width is not measured yet (a suite, or the first paint) is assumed wide enough that
    // the static range is the only bound.
    const ASSUMED_PANE_WIDTH = 1000

    /** A share inside the interaction range — the one place the static bounds are applied in the pane. */
    function splitOf(value) {
      const number = typeof value === 'number' ? value : Number(value)
      if (!Number.isFinite(number)) return SPLIT_DEFAULT
      return Math.min(SPLIT_MAX, Math.max(SPLIT_MIN, number))
    }

    /**
     * The share range a pane of this width can actually draw: the static range narrowed by the two
     * floors, so a drag can never press a column below its minimum and wrap the row.
     */
    function splitBounds(width, limits = null) {
      const usable = Number.isFinite(width) && width > 0 ? width : ASSUMED_PANE_WIDTH
      // THE HOST'S RANGE, THEN THE CLIENT'S, THEN THE PANE'S OWN PIXEL FLOORS. The host's answer is
      // what it will actually store; the client constants are the widest this build understands; the
      // floors are what the columns can draw. Intersecting all three is what makes a release land
      // where the pointer left it.
      const hostMin = limits && Number.isFinite(limits.min) ? limits.min : HOST_SPLIT_FALLBACK.min
      const hostMax = limits && Number.isFinite(limits.max) ? limits.max : HOST_SPLIT_FALLBACK.max
      const min = Math.max(SPLIT_MIN, hostMin, MAIN_FLOOR / usable)
      const max = Math.min(SPLIT_MAX, hostMax, (usable - SPLIT_HANDLE - SIDE_FLOOR) / usable)
      // A pane too narrow for both floors stacks (the pane decides that), but the arithmetic still has
      // to answer a legal pair; `max` never goes below `min`.
      return { min, max: Math.max(min, max) }
    }

    /**
     * The two columns' widths, in PIXELS, for a measured row. A percentage pair with `minWidth` floors
     * can end up one subpixel over the row — round each share down and flexbox may push a floored
     * column back up — and under `flex-wrap` a subpixel over is a wrapped preview, the bug this whole
     * change exists to kill. Pixel bases are exact: `main + handle + side === width`, always.
     *
     * `main` is floored and the side is the remainder, so both floors are honoured at once: the share
     * clamp guarantees `share * width >= MAIN_FLOOR` and `(1 − share) * width − handle >= SIDE_FLOOR`.
     * A row with no measured width answers `null` and the pane falls back to percentages.
     */
    function splitWidths(width, share, limits = null) {
      const row = Number(width)
      if (!Number.isFinite(row) || row <= 0) return null
      const bounds = splitBounds(row, limits)
      // `0` IS A SHARE, not "missing": `|| SPLIT_DEFAULT` would turn a deliberate far-left drag into
      // the middle of the pane, so the number is tested for finiteness rather than truthiness.
      const wanted = typeof share === 'number' ? share : Number(share)
      const live = Math.min(bounds.max, Math.max(bounds.min, Number.isFinite(wanted) ? wanted : SPLIT_DEFAULT))
      // AT THE EXACT FLOOR, `(120 / row) * row` can be 119.999… and `floor` would hand back 119 — one
      // pixel below the floor the drag was clamped to. The max keeps the pixel contract on the floor.
      const main = Math.max(MAIN_FLOOR, Math.floor(live * row))
      return { share: main / row, main, side: row - SPLIT_HANDLE - main }
    }

    /**
     * The share a pointer at `clientX` asks for, given the container the two columns divide.
     *
     * A container with no measured width answers `null` — the caller keeps what it has, because a
     * zero-width frame is a pane that has not been laid out yet, and dividing by it would snap the
     * line to a limit on the first pointer event.
     */
    function splitFrom(left, width, clientX) {
      if (!Number.isFinite(width) || width <= 0) return null
      return splitOf(((clientX || 0) - (left || 0)) / width)
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

    // `stemOf` lived here until 2026-10-18: a picture was called by its stem. The founder asked for
    // the file name itself — *"the labels should be filename *.png or whatever"* — so every label
    // (tile, list row, gallery tooltip, metadata header) reads `asset.name` whole.

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
            // THE CARD IS SOLID (founder, 2026-09-26: *"the dropdown menu is grey instead of white"*).
            // The primitive's own card is `--dsw-specific-menu` — #30313680 in dark, 50% alpha with a
            // 40px backdrop blur — so over this pane's thumbnails the pictures bleed through and it
            // reads as dirty grey. `listClassName` is the primitive's own hook for the card, which
            // means the rule in this bundle's sheet reaches ONLY these two menus and never the app's.
            listClassName: 'dsh-assets-menu',
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
     * ONE TILE. A CARD WHOSE PICTURE IS THE TOP AND WHOSE FACTS ARE UNDER IT (2026-10-18). The
     * founder's correction: *"the thumbnail fills the card and text is below, remove the badge fashion
     * people, the labels should be filename *.png or whatever. 1.6 MB badge below the thumbnail card"*.
     *
     * So there is NO overlay on the picture — no filled context chip, no size chip on top of the
     * photograph. The card is the image, edge to edge; the text area below it carries the FULL FILE
     * NAME (`lee_facecard.png`, extension and all) and a row with the size as an outlined chip, the
     * date, and the Run/File marker. The context is still in the metadata card; a tile does not repeat
     * the folder every picture came from.
     *
     * It is a button — `role`, `tabIndex`, Enter and Space — because a tile a keyboard cannot reach is
     * a tile half the people cannot use.
     *
     * DRAGGABLE ONLY WHEN THERE ARE BYTES: an entry with a name and no file is listed (so a person can
     * see the library knows about it) but nothing invents a file to carry.
     */
    function Tile({ asset, selected, onSelect, t, hovered = false, onHover = null }) {
      const carry = typeof asset.bytes === 'number' && asset.bytes > 0
      return h(
        'div',
        {
          role: 'button',
          tabIndex: 0,
          'aria-label': t('pane.selected') + ': ' + asset.name,
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
          { style: S.thumb, 'data-assets-tile-thumb': 'yes' },
          // A TILE ASKS FOR A PREVIEW, not the original: 320px is a tile's own size at this
          // pane's width, and the host answers the original when it cannot resize. No badge sits on
          // this picture any more — the card's text area carries every fact instead.
          h('img', { style: S.thumbImage, src: '/plugins/assets/file?path=' + encodeURIComponent(asset.path) + '&w=320', alt: '', loading: 'lazy', draggable: false }),
        ),
        h(
          'div',
          { style: S.tileText },
          h('span', { style: S.itemName, title: asset.path, 'data-assets-tile-name': 'yes' }, asset.name),
          h(
            'span',
            { style: S.itemMeta },
            // THE SIZE IS BELOW THE THUMBNAIL, as an outlined chip (2026-10-18). It left the picture
            // with the context badge; the card's text row is where a person reads it.
            asset.bytes ? h('span', { style: S.badgeLine, title: t('meta.bytes'), 'data-assets-tile-size': 'yes' }, sizeOf(asset.bytes)) : null,
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
          // THE FULL FILE NAME, extension and all (2026-10-18): a person looking for the file needs
          // `lee_facecard.png`, not `lee_facecard`. The context badge is gone from the card and from
          // this row; the facts card is where the folder is read.
          h('span', { style: S.itemName, title: asset.path }, asset.name),
          h(
            'span',
            { style: S.itemMeta },
            h('span', null, asset.date || ''),
            h('span', null, sizeOf(asset.bytes)),
            asset.hasRecord ? h('span', null, t('pane.recorded')) : h('span', null, t('pane.unrecorded')),
          ),
        ),
      )
    }

    /**
     * THE FOLDER TABS (founder, 2026-10-17: *"folders should be like tabs not stacked"*).
     *
     * The folders used to be a stacked list with a `×` on each row: two folders already pushed the
     * search and the pictures down the page, and each row was two controls (a Finder link and a Remove)
     * for a thing a person mostly wants to SWITCH TO. A tab is that switch. Three facts decide the
     * shape:
     *
     *   - **All is a tab, and it is always first.** It is the library as a whole, which is the state
     *     every install starts in; without it a person on one folder's tab has no way back to "all".
     *   - **The active tab is the scope.** Selecting a folder tab reads the catalog for that folder —
     *     the tab is not decoration over an unscoped list.
     *   - **A tab carries its count**, because the number behind each folder is what tells a person
     *     which one to look at, and a tab that cannot say is a guess.
     *
     * The `×` on a folder tab REMOVES it from the library (it never touches the folder on disk — that is
     * `pane.remove`'s own sentence), and it is drawn only on the ACTIVE tab: a `×` on every tab turns a
     * row of switches into a row of delete buttons, which is how a person loses a folder by mis-clicking
     * a tab they meant to open. The count sits where the `×` would be on the inactive ones, so nothing
     * shifts when a tab is selected.
     */
    function FolderTabs({ folders, active, counts, onPick, onRemove, onReveal, busy, t }) {
      const stripped = folders.map((folder, index) =>
        h(
          'div',
          {
            key: folder.path + ':' + index,
            style: { ...S.tab, ...(active === folder.path ? S.tabOn : null) },
            'data-assets-tab': folder.path,
            'data-assets-tab-on': active === folder.path ? 'yes' : 'no',
          },
          h(
            'button',
            {
              type: 'button',
              'aria-current': active === folder.path ? 'page' : undefined,
              title: folder.path,
              'data-assets-tab-pick': folder.path,
              onClick: () => onPick(folder.path),
            // A TAB IS A SWITCH, so it has no fill of its own and no border: the strip's rule is the
            // active tab's, drawn by `S.tabOn`.
              style: S.tabButton,
            },
            IconFolderOpen ? h(IconFolderOpen, { size: 13, style: S.tabGlyph }) : null,
            h('span', { style: S.tabLabel }, folder.label || folder.path),
          ),
          active === folder.path
            ? h(
                'button',
                {
                  type: 'button',
                  title: t('pane.remove'),
                  'aria-label': t('pane.remove') + ' ' + (folder.label || folder.path),
                  disabled: busy,
                  'data-assets-tab-remove': folder.path,
                  // REMOVES IT FROM THE LIBRARY, NOT FROM THE DISK. `pane.remove`'s own sentence.
                  onClick: (event) => {
                    if (event && typeof event.stopPropagation === 'function') event.stopPropagation()
                    onRemove(folder.path)
                  },
                  style: S.tabClose,
                },
                IconCloseOutline16 ? h(IconCloseOutline16, { size: 12 }) : null,
              )
            : h('span', { style: S.tabCount, 'data-assets-tab-count': folder.path }, String(counts(folder.path))),
          // THE WAY TO THE FOLDER ITSELF stays one press away, on the tab that is already open: a Finder
          // link belongs to the folder a person is looking at, and a strip is not a place for two verbs
          // on every item.
          active === folder.path && typeof onReveal === 'function'
            ? h(
                'button',
                {
                  type: 'button',
                  title: t('pane.reveal') + ' — ' + folder.path,
                  'aria-label': t('pane.reveal') + ' ' + (folder.label || folder.path),
                  'data-assets-tab-reveal': folder.path,
                  onClick: () => onReveal(folder.path),
                  style: S.tabClose,
                },
                h(RevealGlyph, { size: 12 }),
              )
            : null,
        ),
      )
      return h(
        'div',
        { style: S.tabs, role: 'tablist', 'aria-label': t('pane.where'), 'data-assets-tabs': 'yes' },
        h(
          'div',
          {
            style: { ...S.tab, ...(active === null ? S.tabOn : null) },
            'data-assets-tab': 'all',
            'data-assets-tab-on': active === null ? 'yes' : 'no',
          },
          h(
            'button',
            {
              type: 'button',
              'aria-current': active === null ? 'page' : undefined,
              'data-assets-tab-pick': 'all',
              onClick: () => onPick(null),
              style: S.tabButton,
            },
            h('span', { style: S.tabLabel }, t('pane.filter.all')),
          ),
          active === null ? null : h('span', { style: S.tabCount }, String(counts(null))),
        ),
        ...stripped,
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
    function InspectStage({ detail, t, fill = false, panel = false }) {
      const frameRef = React.useRef(null)
      const [frame, setFrame] = React.useState({ width: 0, height: 0 })
      const [full, setFull] = React.useState(false)
      const drag = React.useRef(null)
      // THE SCALE IS A FRACTION OF THE PICTURE, SO THE PICTURE'S BOX HAS TO BE THE PICTURE. The `<img>`
      // was laid out at the PREVIEW BITMAP's size (the route serves `?w=1024`) while `fitScale` divided
      // the FILE's real width, so a 1888-pixel file drawn from a 1024-pixel bitmap came out at 54% of the
      // fit — an 11% label on a picture that filled a third of the stage. The declared dimensions are the
      // box; a file that declares none adopts the bitmap's own size when it loads, so an unreadable
      // header still fits instead of guessing.
      const [bitmap, setBitmap] = React.useState(null)
      const declared = detail && detail.dimensions && detail.dimensions.width > 0 && detail.dimensions.height > 0 ? detail.dimensions : null
      const natural = declared || bitmap
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

      // THE STAGE OWNS THE WHEEL (2026-10-18). Each column is now its own scroll container, so a wheel
      // over the picture would zoom it AND scroll the column underneath. A native non-passive listener
      // is what can stop the second half: React's delegated wheel listener is passive, so a
      // `preventDefault` from the JSX handler would be ignored. The JSX handler still does the zoom;
      // this one only claims the gesture.
      React.useEffect(() => {
        const node = frameRef.current
        if (!node || typeof node.addEventListener !== 'function') return () => {}
        const hold = (event) => {
          if (event && event.cancelable !== false) event.preventDefault()
        }
        node.addEventListener('wheel', hold, { passive: false })
        return () => node.removeEventListener('wheel', hold)
      }, [])

      // A new picture, a new frame, or the full-resolution swap: back to the fit.
      React.useEffect(() => {
        setBitmap(null)
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
          // THE STAGE IS AS WIDE AS THE COLUMN IT SITS IN, AND AS TALL AS THAT ALLOWS (founder,
          // 2026-10-17: *"the large image has pan and zoom"*, after the two panels became resizable).
          //
          // The ceiling used to be 60vh with a matching width cap, which meant a person who dragged the
          // divider to give the picture more room got MORE WHITESPACE: the frame grew horizontally and
          // stopped at 60vh of height, so the picture inside never grew. A picture is inspected by
          // making it larger, so the constraint has to be the column's own width — `width: 100%` plus
          // the picture's ratio is what makes height follow it — with the viewport height as the only
          // outer limit. Dragging the divider wider now makes the picture bigger until the pane's height
          // runs out, which is the behaviour the split was built for.
          //
          // NO `maxWidth` cap any more: the old `calc(60vh * ratio)` existed only to keep that 60vh box
          // the picture's shape, and without the height cap it would contradict the width.
          //
          // TWO CALLERS, TWO SHAPES. The GALLERY is the old filmstrip, unchanged (2026-09-26): its stage
          // is the pane's width with the 60vh ceiling and the ratio's matching width cap. The SIDE
          // COLUMN (grid and list) is the inspection preview (2026-10-17): `fill` gives the stage the
          // column's own width AND height, so it is the whole panel and the metadata card floats on top
          // of it (2026-10-18). The gallery is deliberately NOT the inspection panel — the founder
          // asked for it to stay as it was (2026-10-18: *"that view was not supposed to change"*).
          //
          // THE FILLED STAGE IS UNFRAMED: no border, no radius, no card background — the picture is the
          // panel, and a frame around a panel is a second edge. The framed form stays for gallery,
          // where the stage sits above a strip and needs an edge to read as one picture.
          style: fill
            ? { ...S.stage, width: '100%', height: '100%', maxHeight: 'none', border: 0, borderRadius: 0, background: 'transparent' }
            : panel
              ? { ...S.stage, width: '100%', aspectRatio: natural ? natural.width + ' / ' + natural.height : '3 / 4', maxHeight: 'calc(100vh - 220px)' }
              : { ...S.stage, aspectRatio: natural ? natural.width + ' / ' + natural.height : '3 / 4', maxHeight: '60vh', maxWidth: 'calc(60vh * ' + (natural && natural.height > 0 ? natural.width / natural.height : 3 / 4) + ')', margin: '0 auto' },
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
          style: {
            ...S.stageImage,
            width: natural ? natural.width : undefined,
            height: natural ? natural.height : undefined,
            transform: 'translate(' + offset.x + 'px, ' + offset.y + 'px) scale(' + scale + ')',
          },
          src: src(full ? null : 1024),
          alt: '',
          draggable: false,
          'data-assets-stage-image': 'yes',
          onLoad: (event) => {
            if (declared) return
            const el = event && event.target ? event.target : null
            if (!el || !(el.naturalWidth > 0) || !(el.naturalHeight > 0)) return
            setBitmap({ width: el.naturalWidth, height: el.naturalHeight })
          },
        }),
        // THE PILL LIVES AT THE BOTTOM-RIGHT, so wherever it floats — the filled preview, the framed
        // panel a stacked pair uses, and the gallery stage — the hint and the zoom controls move to the
        // TOP. The pill must never cover Fit or 1:1.
        h('span', { style: fill || panel ? { ...S.stageHint, top: 8, bottom: 'auto' } : S.stageHint }, t('stage.hint')),
        h(
          'div',
          { style: fill || panel ? { ...S.stageControls, top: 8, bottom: 'auto' } : S.stageControls },
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
     * filling the top, the frames in a fixed strip under it, and the facts floating over the stage's
     * lower-right corner (2026-10-18). It is the view A4's inspect stage was built for — the stage is
     * the SAME component the metadata block draws, filling the box, so the zoom, the pan and the 1:1
     * control arrive with it and nothing is written twice. The `meta` node is passed in by the pane
     * and rendered INSIDE the stage box, so the card can never cover the strip below.
     *
     * THE STRIP IS THE CATALOG, not a second fetch: each frame asks the file route for a 128px
     * preview, the way every other tile does. Nothing selected yet says so and waits — auto-selecting
     * the first frame would write to the view file from inside a render.
     */
    function GalleryView({ assets, selected, onSelect, detail, t, meta = null }) {
      const ready = detail && detail.path === selected
      // THE CAROUSEL (2026-10-18). The founder: *"its very hard to get the mouse hit on scroll bar.
      // also add caurosel, left/right buttons on hover"*. The arrows move the SELECTION one frame, so
      // the strip does not have to be grabbed at all; it scrolls the newly selected frame into view.
      // They appear only while the pointer is over the stage, so the picture stays clean at rest.
      const [hovered, setHovered] = React.useState(false)
      const stripRef = React.useRef(null)
      const step = (delta) => {
        if (assets.length === 0) return
        const at = assets.findIndex((asset) => asset.path === selected)
        const from = at >= 0 ? at : (delta > 0 ? -1 : 0)
        const next = (from + delta + assets.length) % assets.length
        onSelect(assets[next].path)
      }
      // KEEP THE STRIP ON THE SELECTED FRAME, whether the selection came from a click on the strip or
      // from a carousel arrow. A DOM ref, so the offline shim (no nodes) simply skips it.
      React.useEffect(() => {
        const strip = stripRef.current
        if (!strip || typeof strip.querySelector !== 'function') return
        const marked = strip.querySelector('[data-assets-frame-on="yes"]')
        if (marked && typeof marked.scrollIntoView === 'function') marked.scrollIntoView({ block: 'nearest', inline: 'nearest' })
      }, [selected])
      // THE MAIN THUMB IS THE TOP, THE FILMSTRIP IS THE BOTTOM, AND THE FACTS FLOAT ON THE PICTURE
      // (founder, 2026-10-18: *"fix the main thumb top+filmstrip bottom. it should also have metadata
      // bottom right to make the main thumb bigger"*).
      //
      // The stage now takes every pixel the column can give it (the framed 60vh box and the facts
      // side-column are both gone), the frames are one fixed 56×74 row under it, and the metadata is
      // the same bottom-right floating accordion card the grid/list preview uses. The card is inside
      // the STAGE box, so it floats over the picture and never covers the strip.
      return h(
        'div',
        { style: S.gallery, 'data-assets-gallery': 'yes' },
        h(
          'div',
          {
            style: S.galleryStage,
            'data-assets-gallery-stage': 'yes',
            onMouseEnter: () => setHovered(true),
            onMouseLeave: () => setHovered(false),
          },
          selected === null || selected === undefined
            ? h('span', { style: { ...S.muted, ...S.galleryHint }, 'data-assets-gallery-empty': 'yes' }, t('pane.gallery.pick'))
            : ready
              ? h(InspectStage, { detail, t, fill: true })
              : h('img', { style: S.galleryPreview, src: '/plugins/assets/file?path=' + encodeURIComponent(selected) + '&w=1024', alt: '', 'data-assets-gallery-preview': 'yes' }),
          // The card is a sibling of the picture inside the positioned stage, so `metaFloat` anchors
          // to the stage's lower-right corner rather than to the whole gallery (which would put it
          // over the filmstrip).
          meta,
          // THE ARROWS ARE SIBLINGS OF THE STAGE, not children of it: the stage owns pointerdown for
          // panning, and a button inside it would start a pan on press. They are hover-only.
          hovered && selected !== null && selected !== undefined && assets.length > 1
            ? [
                h(
                  'button',
                  {
                    key: 'prev',
                    type: 'button',
                    'data-assets-carousel': 'prev',
                    'aria-label': t('pane.carousel.prev'),
                    title: t('pane.carousel.prev'),
                    onClick: () => step(-1),
                    style: { ...S.carouselButton, left: 10 },
                  },
                  h(CarouselPrev, { size: 18 }),
                ),
                h(
                  'button',
                  {
                    key: 'next',
                    type: 'button',
                    'data-assets-carousel': 'next',
                    'aria-label': t('pane.carousel.next'),
                    title: t('pane.carousel.next'),
                    onClick: () => step(1),
                    style: { ...S.carouselButton, right: 10 },
                  },
                  h(CarouselNext, { size: 18 }),
                ),
              ]
            : null,
        ),
        h(
          'div',
          {
            ref: stripRef,
            className: 'dsh-assets-scroll',
            style: S.galleryStrip,
            'data-assets-gallery-strip': 'yes',
            role: 'listbox',
            'aria-label': t('pane.view.gallery'),
          },
          ...assets.map((asset) =>
            h(
              'button',
              {
                key: asset.path,
                type: 'button',
                role: 'option',
                // THE FILE NAME, extension and all — the same label rule as the tiles (2026-10-18).
                title: asset.name,
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

    function MetadataBlock({ detail, loading, t, openGenerate, generateReady, canTrash = false, asking = false, busy = false, trashError = null, onAsk, onCancel, onConfirm }) {
      // THE METADATA IS A PILL NOW (2026-10-18). The founder: *"make the floating metadata card just
      // a pill with 2 icon buttons, expand and trash. all views are like this"*. At rest the block is
      // two 30px icon buttons in a capsule at the preview's lower-right; the picture keeps the rest.
      //
      // WHAT THE CHEVRON OPENS: every fact the library has — the file's own rows, the run's
      // provenance, the prompt and the values, and the way back into Generate — in a panel that grows
      // UPWARD from the pill. The trash opens a transient confirm bubble; it never deletes on the
      // first press. The pill and its panel are ABSOLUTE against the caller's positioned preview box
      // (the grid/list side column, the stacked stage, or the gallery stage).
      //
      // THE HOOK IS UNCONDITIONAL. The early returns below (loading, no detail) come after it, because
      // a component that calls a hook on some renders and not others is the one bug the verify shim
      // would report as a wrong slot rather than a wrong design.
      const [openFacts, setOpenFacts] = React.useState(false)
      // THE CONFIRM REPLACES THE PANEL, whichever path opened it (the trash button or ⌘⌫ on the pane).
      React.useEffect(() => {
        if (asking) setOpenFacts(false)
      }, [asking])

      /** The capsule, with whatever transient bubbles sit above it (facts panel, confirm, error). */
      const pill = (extra) =>
        h(
          'div',
          { style: S.pillWrap, 'data-assets-meta': loading ? 'loading' : 'yes', 'data-assets-meta-float': 'yes' },
          extra,
          trashError ? h('div', { style: S.pillError, 'data-assets-trash-failed': 'yes' }, trashError) : null,
          h(
            'div',
            { style: S.pill, 'data-assets-pill': 'yes' },
            h(
              'button',
              {
                type: 'button',
                'data-assets-pill-expand': 'yes',
                // The old disclosure's attribute too: the facts are one press away, whichever name a
                // suite knows them by.
                'data-assets-facts-toggle': 'yes',
                'aria-expanded': openFacts ? 'true' : 'false',
                'aria-label': openFacts ? t('meta.facts.hide') : t('meta.facts.show'),
                title: openFacts ? t('meta.facts.hide') : t('meta.facts.show'),
                disabled: loading,
                onClick: () => setOpenFacts((was) => !was),
                className: 'dsh-assets-pill-btn',
                style: S.pillButton,
              },
              // A down chevron when the panel is open (it would close it), an up one when it is shut
              // (the panel grows upward).
              h(FactsChevron, { size: 16, style: { transform: openFacts ? 'none' : 'rotate(180deg)' } }),
            ),
            canTrash && !loading
              ? h(
                  'button',
                  {
                    type: 'button',
                    'data-assets-pill-trash': 'yes',
                    'data-assets-delete': 'yes',
                    'aria-label': t('meta.delete'),
                    title: t('meta.delete') + ' ⌘⌫',
                    disabled: busy,
                    onClick: () => {
                      // The confirm replaces the facts panel rather than stacking on it.
                      setOpenFacts(false)
                      if (onAsk) onAsk()
                    },
                    className: 'dsh-assets-pill-btn dsh-assets-pill-danger',
                    style: { ...S.pillButton, ...S.pillDanger },
                  },
                  h(TrashGlyph, { size: 16 }),
                )
              : null,
          ),
        )

      if (loading) return pill(null)
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
      // The panel's one-line caption: the full file name and the facts that orient a person.
      const summary = [String(detail.ext || '').toUpperCase(), sizeOf(detail.bytes)].filter((part) => part !== '').join(' · ')

      const facts = h(
        'div',
        { style: S.factsBody },
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
            )
          : h('span', { style: S.muted, 'data-assets-meta-norecord': 'yes' }, t('meta.noRecord')),
        // THE WAY BACK INTO THE RUN lives in the facts panel now: the pill is exactly two icons, and
        // Regenerate is information-adjacent rather than a destructive act.
        provenance
          ? h(ContinueControl, {
              jobId: provenance.jobId,
              workflow,
              provider: provenance.provider,
              title: provenance.title || '',
              ready: generateReady === true,
              openGenerate,
              t,
            })
          : null,
      )

      const panel = openFacts
        ? h(
            'div',
            { style: S.pillPanel, className: 'dsh-assets-scroll', 'data-assets-facts': 'yes', role: 'region', 'aria-label': detail.name },
            h(
              'div',
              { style: S.pillHead },
              h('span', { style: S.factsName, title: detail.path, 'data-assets-facts-name': 'yes' }, detail.name),
              summary === '' ? null : h('span', { style: S.factsSummary, 'data-assets-facts-summary': 'yes' }, summary),
            ),
            facts,
          )
        : null

      // THE TRASH ASKS FIRST. The probe is a small bubble above the pill, never a bare destructive
      // press; the host also refuses a delete without `confirm: true`.
      const confirm = asking
        ? h(
            'div',
            { style: S.pillAsk, 'data-assets-delete-row': 'yes' },
            h('span', { style: S.deleteAsk, 'data-assets-delete-ask': 'yes' }, t('meta.deleteAsk')),
            Button
              ? h(Button, { variant: 'primary', size: 'sm', disabled: busy, 'data-assets-delete-confirm': 'yes', onClick: onConfirm }, t('meta.deleteYes'))
              : h('button', { type: 'button', disabled: busy, 'data-assets-delete-confirm': 'yes', onClick: onConfirm }, t('meta.deleteYes')),
            Button
              ? h(Button, { variant: 'ghost', size: 'sm', 'data-assets-delete-cancel': 'yes', onClick: onCancel }, t('meta.deleteCancel'))
              : h('button', { type: 'button', 'data-assets-delete-cancel': 'yes', onClick: onCancel }, t('meta.deleteCancel')),
          )
        : null

      return pill(panel || confirm ? [panel, confirm] : null)
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
      // The confirm is the PANE's state, not the block's: `⌘⌫` on the pane opens the same confirm the
      // button does, and the block is a child that may not even be mounted when the key is pressed.
      const [asking, setAsking] = React.useState(false)
      const [notice, setNotice] = React.useState(null)
      // THE TRASH'S OWN REFUSAL, kept apart from `failed`: that one belongs to the folder actions and
      // wears their sentence ("The folder could not be added."), which is not what a refused delete has
      // to say — and it is drawn by the room, one column away from the control that asked. Both halves
      // of that were the founder's report (2026-09-26): *"confirmation works -- but it doesn't delete
      // (still there)"*, against a route that had answered `500 trash-failed` all along.
      const [trashError, setTrashError] = React.useState(null)
      // THE DRAG'S LIVE VALUE (2026-10-17 split). The view file holds the share a person CHOSE; this
      // holds where their pointer is while they are choosing, so the columns follow the pointer without
      // a request per pixel. It is null at rest, which is what makes the stored value the only truth.
      const [dragging, setDragging] = React.useState(null)
      // A refresh that is running: the control spins and refuses a second press, so a slow folder is
      // one read rather than a queue of them.
      const [refreshing, setRefreshing] = React.useState(false)
      // THE SPLIT ROW'S OWN WIDTH (2026-10-18). The share is a fraction of the row, but the two floors
      // are pixels — so the pane has to know the width to decide (a) whether both columns fit at all
      // and (b) how far the handle may travel before one column crosses its floor. A callback ref (not
      // a `useRef`) is what re-runs the observer when the row mounts LATER: the pane renders a loading
      // state first, so a one-time effect would observe nothing and the columns would never stack.
      const [columnsNode, setColumnsNode] = React.useState(null)
      const [columnsWidth, setColumnsWidth] = React.useState(0)
      React.useEffect(() => {
        if (!columnsNode || typeof ResizeObserver !== 'function') return () => {}
        const observer = new ResizeObserver((entries) => {
          for (const entry of entries) {
            const box = entry.contentRect || {}
            setColumnsWidth(Number(box.width) || 0)
          }
        })
        observer.observe(columnsNode)
        return () => observer.disconnect()
      }, [columnsNode])

      const chosen = view.data || { view: 'grid', folder: null, context: null, date: null, selected: null, split: SPLIT_DEFAULT }
      const layout = chosen.view === 'list' ? 'list' : chosen.view === 'gallery' ? 'gallery' : 'grid'
      // THE FOLDER TAB (founder, 2026-10-17: *"folders should be like tabs not stacked"*). `null` is the
      // All tab; a path is that folder's tab. It is a SCOPE, not a decoration — the tab a person is on is
      // the folder the catalog was read for, which is why it travels to the route and lives in the view
      // file beside the layout and the filters.
      const folder = typeof chosen.folder === 'string' ? chosen.folder : null
      const context = chosen.context
      const date = chosen.date
      const selectedPath = chosen.selected
      // THE HOST'S OWN RANGE, when it answers one (2026-10-18). The view route now ships
      // `splitBounds`; a host from before that field is the 0.3–0.8 build, and `splitBounds` falls back
      // to exactly that. This is the fix for *"it snaps back to bigger size"*: the pane no longer
      // offers a share the host will clamp away the moment the pointer is released.
      const hostLimits = chosen && chosen.splitBounds && Number.isFinite(chosen.splitBounds.min) && Number.isFinite(chosen.splitBounds.max)
        ? { min: chosen.splitBounds.min, max: chosen.splitBounds.max }
        : null
      // The line the columns are drawn at: the pointer's value while dragging, the file's at rest.
      const split = dragging === null ? splitOf(chosen.split) : dragging
      // THE TWO-COLUMN STATE, IN ONE PLACE. `twoColumns` is grid/list with something selected; gallery
      // keeps its own fixed filmstrip proportions (the founder asked for that view to stay as shipped),
      // and with nothing selected there is nothing to divide. `stacked` is the pane's width saying two
      // floors no longer fit — then the row stacks and the handle is gone. `liveSplit` is the share the
      // stored value asks for, narrowed to what this width can draw, so the columns never wrap and the
      // handle always sits where the divider actually is.
      const twoColumns = selectedPath !== null && selectedPath !== undefined && selectedPath !== '' && layout !== 'gallery'
      const stacked = twoColumns && columnsWidth > 0 && columnsWidth < STACK_BELOW
      const bounds = splitBounds(columnsWidth, hostLimits)
      const liveSplit = stacked ? split : Math.min(bounds.max, Math.max(bounds.min, split))
      // A MEASURED ROW IS LAID OUT IN PIXELS (see `splitWidths`): exact, so no subpixel can wrap the
      // preview. Before the first measurement (and in the offline suites) percentages are the fallback,
      // with the side derived from the main so the pair always adds to exactly 100.
      const widths = !stacked ? splitWidths(columnsWidth, liveSplit, hostLimits) : null
      const shownSplit = widths ? widths.share : liveSplit
      const mainShare = Math.round(liveSplit * 10000) / 100
      const sideShare = 100 - mainShare

      const query = []
      if (folder) query.push('folder=' + encodeURIComponent(folder))
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
        setNotice(null)
        setTrashError(null)
        patchView({ selected: selectedPath === path ? null : path })
      }

      /**
       * THE REFRESH (founder, 2026-10-17: *"it needs a refresh button to refresh the view so when agent
       * does housecleaning the user can update the view"*).
       *
       * THE PANE HAS NO LIVE FEED, by design: the catalog is a directory walk the host makes per
       * request, so a picture an agent deleted, renamed or added mid-session is invisible until
       * something asks again. That something is this control — and it re-reads ALL THREE reads at
       * once, because they are one fact seen three ways: the folders (a folder may have been added or
       * removed), the catalog (the files), and the detail of the selection (which may be the file that
       * just went away).
       *
       * A SELECTION WHOSE FILE IS GONE IS DROPPED, through the view file, so the pane does not sit on
       * a metadata block describing a file that no longer exists and a stage that cannot load. The
       * reload is awaited before the answer is judged: `useJson` refetches on a tick, so the new
       * catalog is only on screen a moment later, and a person pressing a button deserves the button
       * to look busy for as long as the read actually runs.
       */
      const refresh = async () => {
        if (refreshing) return
        setRefreshing(true)
        setNotice(null)
        setTrashError(null)
        try {
          const query = []
          if (context) query.push('context=' + encodeURIComponent(context))
          if (date) query.push('date=' + encodeURIComponent(date))
          const answer = await fetch(CATALOG_URL + (query.length > 0 ? '?' + query.join('&') : ''), { cache: 'no-store' })
          if (!answer.ok) throw new Error('http-' + answer.status)
          const body = await answer.json()
          const rows = Array.isArray(body && body.assets) ? body.assets : []
          reloadRegistry()
          reloadCatalog()
          reloadDetail()
          // The selection is checked against what the read actually returned, not against the host
          // again: the catalog is the answer to "what is here now".
          if (selectedPath !== null && selectedPath !== undefined && !rows.some((row) => row && row.path === selectedPath)) {
            await patchView({ selected: null })
          }
          setNotice(t('pane.refreshed').replace('{n}', String(rows.length)))
        } catch (error) {
          setFailed(String((error && error.message) || error))
        } finally {
          setRefreshing(false)
        }
      }

      /**
       * THE SPLIT'S TWO WRITES. A drag reports every move so the columns follow the pointer, and the
       * file is written once on release — a request per pixel would be one write per frame for a number
       * that is only decided at the end. A double-click or an arrow key decides immediately, so it
       * commits at once.
       */
      const moveSplit = (next) => setDragging(Math.min(bounds.max, Math.max(bounds.min, next)))
      const commitSplit = async (next) => {
        setDragging(null)
        // THE FLOORS, APPLIED BEFORE THE WRITE: a share the pane could not draw is not the share to
        // remember, or the next read would open with a divider somewhere the pointer never was.
        await patchView({ split: Math.min(bounds.max, Math.max(bounds.min, next)) })
      }

      /**
       * THE DESTRUCTIVE ACT — the only one in this pane (founder, 2026-09-26: *"a feature to delete the
       * asset as if I am deleting from finder so I don't have to leave mitsumeru ui"*).
       *
       * NOTHING IS UNLINKED, HERE OR IN THE HOST. The file goes to the platform's own trash, where
       * Finder's Put Back still finds it; that is the whole difference between deleting from Finder
       * and `rm`, and it is why this is safe to put one press away. The host also refuses a call
       * without `confirm: true`, so this function is the only path that can move a file.
       *
       * After it lands: the selection that pointed at the file goes too — through the view FILE, so a
       * reload does not ask for a path that no longer exists — and the catalog is re-read, which is
       * what takes the tile off the grid.
       */
      const remove = async (path) => {
        setAsking(false)
        setBusy(true)
        setTrashError(null)
        try {
          const answer = await fetch(DELETE_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path, confirm: true }) })
          const result = await answer.json().catch(() => null)
          if (!answer.ok) {
            setTrashError(t('meta.trashFailed') + ': ' + String((result && (result.detail || result.error)) || 'http-' + answer.status))
            return
          }
          setNotice(t('meta.trashed').replace('{name}', String((result && result.name) || '')))
          if (selectedPath === path) await patchView({ selected: null })
          reloadCatalog()
        } catch (error) {
          setTrashError(t('meta.trashFailed') + ': ' + String((error && error.message) || error))
        } finally {
          setBusy(false)
        }
      }

      /**
       * FINDER'S OWN GESTURE (⌘⌫), because that is what the founder asked to keep. Three guards, each
       * for a way this could hurt: nothing is selected, the key is not held, or the person is TYPING —
       * a ⌘⌫ in the search field must delete a character, not a photograph. It opens the confirm
       * rather than acting outright: the keyboard gets the same one press of warning as the button.
       */
      const onKeyDown = (event) => {
        if (!selectedPath || !event || (event.key !== 'Backspace' && event.key !== 'Delete')) return
        if (event.metaKey !== true && event.ctrlKey !== true) return
        const target = event.target || {}
        const tag = String(target.tagName || '').toLowerCase()
        if (tag === 'input' || tag === 'textarea' || target.isContentEditable === true) return
        event.preventDefault()
        // A NEW QUESTION CLEARS THE LAST ANSWER: the refusal belongs to the attempt that is over, not
        // to the one being asked about.
        setTrashError(null)
        setAsking(true)
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
          { style: { ...S.pane, overflow: 'auto' }, 'data-assets-pane': 'loading' },
          // The sentence stays (it is what a screen reader and a person both read); the spinner
          // became the pane's own shape, so the grid does not jump into place when the answer
          // lands (polish pass, 2026-09-26).
          h('div', { style: S.bar }, h('span', { style: S.muted, 'data-assets-loading': 'yes' }, t('pane.loading'))),
          h(SkeletonGrid, null),
        )
      }

      if (registry.phase === 'error' || catalog.phase === 'error') {
        const detail = (registry.error || catalog.error) || ''
        return h('div', { style: { ...S.pane, overflow: 'auto' }, 'data-assets-pane': 'error' }, h('div', { style: S.centre }, h('span', { style: S.title }, t('pane.error')), h('span', { style: S.muted }, detail)))
      }

      const folders = (registry.data && registry.data.folders) || []
      const canChoose = !!(registry.data && registry.data.canChoose)
      // The Delete control is drawn only when the host has somewhere to put the file (the trash verb
      // is per platform): a button that always fails is worse than no button.
      const canTrash = !!(registry.data && registry.data.canTrash)
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
          { style: { ...S.pane, overflow: 'auto' }, 'data-assets-pane': 'empty' },
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

      // THE METADATA IS A PILL IN EVERY VIEW (2026-10-18). The stage is drawn by the caller — the
      // side column for grid/list (filling it side by side, by its ratio when stacked), the gallery
      // stage for gallery — and the pill is the metadata in all three. The pill is absolute, so the
      // caller's box must be `position: relative`; the facts panel grows upward from it.
      const sideStage = layout !== 'gallery'
      const detailData = detail.data
      const showStage = sideStage && detailData && detailData.where === 'present' && PICTURE_EXT.test(String(detailData.ext || ''))
      // ONE SET OF FACTS PROPS FOR EVERY PLACE: the grid/list side and the gallery stage are the same
      // pill, so they get the same detail, loading and actions.
      const metaProps = {
        detail: detailData,
        loading: detail.phase === 'loading',
        t,
        openGenerate,
        generateReady,
        canTrash,
        asking,
        busy,
        trashError,
        onAsk: () => { setTrashError(null); setAsking(true) },
        onCancel: () => setAsking(false),
        onConfirm: () => remove(detailData && detailData.path ? detailData.path : selectedPath),
      }

      return h(
        'div',
        { style: S.pane, 'data-assets-pane': 'ready', onKeyDown },
        // ── THE TOP THREE ROWS DO NOT SCROLL (2026-10-18) ─────────────────────
        //
        // The founder: *"the left panel can scroll but not the right, the top 3 rows are sticky"*.
        // The pane used to be ONE scroll box, so the header, the folder tabs and the bar scrolled away
        // with the pictures, and the preview column had no scroll container of its own — its facts
        // were merely carried by the page. The top rows now live in a fixed block (`flex: 0 0 auto`)
        // and only the columns below scroll, each in its own container: a long grid never pushes the
        // preview's facts out of reach, and a tall preview never scrolls the thumbnails.
        h(
          'div',
          { style: S.top, 'data-assets-top': 'yes' },
          h('div', { style: S.head }, h('span', { style: S.title }, t('pane.where')), addControl),
        // ── THE FOLDERS ARE A STRIP (2026-10-17) ──────────────────────────────
        //
        // The stacked list became tabs: one row, the active tab scoping the catalog, the count behind each
        // folder where the `×` is on the active one. The handler is the same write the old rows used —
        // `folder` goes into the view file, which is also what the route reads — so a tab survives a
        // reload exactly as the layout and the filters do.
        h(FolderTabs, {
          folders,
          active: folder !== null && folders.some((entry) => entry.path === folder) ? folder : null,
          counts: (path) => {
            if (path === null) return total
            const row = ((catalog.data && catalog.data.counts) || {}).folder || []
            const match = row.find((entry) => entry.value === path)
            return match ? match.count : 0
          },
          onPick: (path) => patchView({ folder: path, selected: null }),
          onRemove: (path) => post({ action: 'remove', path }),
          onReveal: (path) => post({ action: 'reveal', path }),
          busy,
          t,
        }),
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
          // THE REFRESH SITS AFTER THE COUNT, at the bar's end, because it is the action on what the
          // count counts. A glyph button (the app's own refresh mark) with the sentence on hover, so
          // the row keeps its height and the control reads as a tool rather than a label.
          h(
            'button',
            {
              type: 'button',
              title: t('pane.refresh.hint'),
              'aria-label': t('pane.refresh'),
              'data-assets-refresh': 'yes',
              'data-assets-refreshing': refreshing ? 'yes' : 'no',
              disabled: refreshing,
              onClick: refresh,
              style: { ...S.refreshButton, ...(refreshing ? S.refreshBusy : null) },
            },
            IconRefreshOutline16 ? h(IconRefreshOutline16, { size: 15 }) : h('span', { style: S.refreshFallback }, '↻'),
          ),
        ),
        notice ? h('span', { style: S.notice, 'data-assets-notice': 'yes' }, notice) : null,
        ),

        // ── the two columns: the pictures, and the one you picked ─────────────
        //
        // THE BLOCK USED TO SIT UNDER THE WHOLE GRID, so reading the asset you had just picked
        // meant scrolling past every tile in the library. Now the grid keeps the left and the
        // block takes the right while there is width for both; below their minima they stack, and
        // the block goes back under the grid where it is the only place left to be.
        //
        // AND THE LINE BETWEEN THEM IS A HANDLE (founder, 2026-10-17: *"a lot of times I need to see
        // the larger image ... to inspect details"*). The shares come from the view file, so the split
        // a person drags is the split they come back to. With nothing picked there is nothing to
        // divide, so the grid keeps the whole width and no handle is drawn.
        //
        // EACH COLUMN SCROLLS ITSELF (2026-10-18). The row takes the height the top block leaves and
        // clips; the left column scrolls its tiles and the right column scrolls its picture and facts,
        // independently. Before this the PANE was the scroll box, so the whole surface — header, tabs,
        // bar and both columns — moved as one sheet, and the preview's lower facts could not be
        // reached at all while the grid was tall.
        //
        // GALLERY IS ONE COLUMN NOW (2026-10-18): the main thumb takes the whole width and height, the
        // strip is a fixed row under it, and the facts float over the stage's lower-right corner. It is
        // the SPLIT that gallery does not take, and it no longer needs a facts column.
        h(
          'div',
          {
            // THE CALLBACK REF IS WHAT MAKES THE OBSERVER REAL (2026-10-18): the pane's first render is
            // usually the loading state, so the row mounts on a later pass and a one-time effect would
            // have observed nothing.
            ref: setColumnsNode,
            // No gap in the split layout: the handle IS the gap (a 12px item carved out of the side's
            // share). Gallery keeps the 12px gap it shipped with, and so does a stacked pair.
            style: {
              ...S.columns,
              gap: layout === 'gallery' || stacked ? 12 : 0,
              // Side by side, both columns take the row's height so each can own its scrollbar. A
              // stacked pair is content-height and the ROW scrolls instead (see the column styles);
              // `alignContent: flex-start` packs the two stacked lines at the top so the overflow is
              // real content rather than line space shared out to fill the row.
              alignItems: stacked ? 'flex-start' : 'stretch',
              alignContent: stacked ? 'flex-start' : 'stretch',
              ...(stacked ? { overflowY: 'auto', overflowX: 'hidden' } : { overflow: 'hidden' }),
            },
            className: 'dsh-assets-scroll',
            'data-assets-columns': 'yes',
            'data-assets-stacked': stacked ? 'yes' : 'no',
            'data-assets-columns-scroll': stacked ? 'row' : 'columns',
          },
          h(
            'div',
            {
              style: layout === 'gallery'
                // THE GALLERY TAKES THE WHOLE ROW (2026-10-18): no facts column steals its width.
                ? { ...S.columnMain, flex: '1 1 100%', minWidth: 0 }
                : stacked
                  // STACKED: the row is the scroll box, so the columns are content-height and show
                  // their overflow instead of each owning a scrollbar inside a scrolling row.
                  ? { ...S.columnMain, flex: '1 1 100%', minWidth: 0, height: 'auto', overflowY: 'visible', overflowX: 'visible' }
                  : twoColumns
                    ? widths
                      ? { ...S.columnMain, flex: '0 0 ' + widths.main + 'px', minWidth: MAIN_FLOOR }
                      : { ...S.columnMain, flex: '0 0 ' + String(mainShare) + '%', minWidth: MAIN_FLOOR }
                    : S.columnMain,
              className: 'dsh-assets-scroll',
              'data-assets-main': 'yes',
              'data-assets-main-split': twoColumns ? (stacked ? 'stacked' : String(Math.round(shownSplit * 100))) : 'full',
            },
            shownAssets.length === 0
              ? h('span', { style: S.muted, 'data-assets-none': 'yes' }, total === 0 ? t('pane.none') : t('pane.none.match'))
              : layout === 'gallery'
                ? h(GalleryView, {
                    assets: shownAssets,
                    selected: selectedPath,
                    onSelect: select,
                    detail: detailData,
                    t,
                    // THE GALLERY'S FACTS ARE THE FLOATING CARD TOO (2026-10-18): over the stage's
                    // lower-right corner, so the picture keeps the full width and the strip stays under.
                    meta: selectedPath ? h(MetadataBlock, metaProps) : null,
                  })
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
          // THE HANDLE, ONLY WHEN BOTH COLUMNS ARE SIDE BY SIDE. A stacked pair has nothing to divide,
          // so drawing a divider there would be a control that moves nothing.
          twoColumns && !stacked
            ? h(ColumnSplit, { split: shownSplit, min: bounds.min, max: bounds.max, onMove: moveSplit, onCommit: commitSplit, t })
            : null,
          // THE PREVIEW COLUMN (grid and list). The stage is the picture — filling the column side by
          // side, keeping its ratio when stacked — and the metadata is the PILL over its lower-right
          // corner in both. The pill is absolute, so the column is `position: relative`. There is no
          // stage inside the block any more.
          //
          // GALLERY HAS NO SIDE COLUMN (2026-10-18): its main thumb takes the whole width and height,
          // the strip is a fixed row under it, and its pill is rendered inside the gallery stage
          // (`GalleryView`), so the picture is as large as the pane can make it.
          selectedPath && layout !== 'gallery'
            ? h(
                'div',
                {
                  style: stacked
                    ? { ...S.columnSide, flex: '1 1 100%', minWidth: 0, minHeight: showStage ? 0 : 120, height: 'auto', overflowY: 'visible', overflowX: 'visible', position: 'relative' }
                    : {
                        ...S.columnSide,
                        ...(widths ? { flex: '0 0 ' + widths.side + 'px' } : { flex: '0 0 calc(' + String(sideShare) + '% - ' + SPLIT_HANDLE + 'px)' }),
                        minWidth: SIDE_FLOOR,
                        // The card is positioned against this column, and the picture (not a
                        // scrollbar) is what the column contains.
                        position: 'relative',
                        overflow: 'hidden',
                      },
                  className: 'dsh-assets-scroll',
                  'data-assets-side': 'yes',
                  'data-assets-side-float': 'yes',
                  'data-assets-side-split': twoColumns ? (stacked ? 'stacked' : String(Math.round((1 - shownSplit) * 100))) : 'full',
                },
                showStage ? h(InspectStage, { detail: detailData, t, fill: !stacked, panel: stacked }) : null,
                h(MetadataBlock, metaProps),
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
     * THE DIVIDER BETWEEN THE TWO COLUMNS (founder, 2026-10-17: *"the panel should be constructed w 2
     * resizable panels, a lot of times I need to see the larger image to fill in order to inspect
     * details"*).
     *
     * THE ARITHMETIC IS NOT HERE, for the same reason the inspect stage's is not: `splitFrom` and
     * `splitBounds` are pure functions above this component, so "a drag from this pointer lands on
     * this share" and "the floors are never crossed" are asserted without a browser (verify/views.mjs
     * does exactly that, and the factory exposes them).
     *
     * THE CONTAINER IS WHAT IS MEASURED, not the handle: the share is of the free width the two
     * columns divide, so the frame is read once at pointer-down (a rect per move would be a layout
     * read per frame for a number that cannot change while the pointer is held — the pane does not
     * resize mid-drag).
     *
     * IT WRITES ONCE, ON RELEASE. The drag keeps its own live value so the columns follow the pointer
     * without a request per pixel; the view file is written when the pointer is up, which is the one
     * moment the person has decided where the line goes.
     */
    function ColumnSplit({ split, min = SPLIT_MIN, max = SPLIT_MAX, onMove, onCommit, t }) {
      const [dragging, setDragging] = React.useState(false)
      const [hovered, setHovered] = React.useState(false)
      const drag = React.useRef(null)
      // THE PANE'S OWN RANGE (2026-10-18): the static 10–85% narrowed by the two pixel floors at the
      // width the row actually has. Clamping here — not only in the pane's handler — keeps the live
      // value, and so the stored value on release, inside what the columns can draw.
      const clamp = (value) => Math.min(max, Math.max(min, value))

      const onPointerDown = (event) => {
        const frame = event && event.currentTarget && event.currentTarget.parentElement
        const box = frame && frame.getBoundingClientRect ? frame.getBoundingClientRect() : null
        if (!box || !(box.width > 0)) return
        if (event.preventDefault) event.preventDefault()
        // WHERE THE HANDLE WAS GRABBED, not where the pointer is: the handle is 12px wide, so pressing
        // its edge must not snap the divider 6px to the pointer before the first move.
        const offset = (event && event.clientX ? event.clientX : 0) - (box.left + split * box.width)
        drag.current = { left: box.left, width: box.width, at: split, offset }
        setDragging(true)
        // THE REST OF THE GESTURE BELONGS TO THE WINDOW. See onMove/endDrag below.
        if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
          window.addEventListener('pointermove', dragMove)
          window.addEventListener('pointerup', endDrag)
          window.addEventListener('pointercancel', endDrag)
        }
      }
      // THE DRAG LISTENS ON THE WINDOW, NOT ON THE HANDLE.
      //
      // This is why the handle "did not work" (founder, 2026-10-17). The pointer handlers were on the
      // 12px divider itself, so the moment the pointer moved faster than the handle — or simply off its
      // edge, which is most of a drag — `pointermove` stopped arriving, and `pointerleave` ended the
      // gesture. The divider therefore only followed the pointer while the pointer was ON it, which is
      // a control that moves a pixel at a time if you are very careful and does nothing otherwise.
      //
      // A drag is a gesture of the WHOLE WINDOW until the button is released. This is what the stage's
      // own pan already gets away with (it is a large target); a 12px handle cannot.
      //
      // The listeners are attached on pointerdown and removed on release, so nothing is left listening
      // after a drag, and they are removed by name — the same function objects — not by a new arrow.
      const dragMove = (event) => {
        if (drag.current === null) return
        const x = (event ? event.clientX : 0) - (drag.current.offset || 0)
        const next = splitFrom(drag.current.left, drag.current.width, x)
        if (next === null) return
        const held = clamp(next)
        drag.current.at = held
        onMove(held)
      }
      const endDrag = () => {
        const held = drag.current
        if (held === null) return
        drag.current = null
        setDragging(false)
        if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
          window.removeEventListener('pointermove', dragMove)
          window.removeEventListener('pointerup', endDrag)
          window.removeEventListener('pointercancel', endDrag)
        }
        // Only a drag that MOVED is written; a click on the handle with no movement would otherwise
        // post the value it already holds.
        if (held.at !== split) onCommit(held.at)
      }
      const onKeyDown = (event) => {
        const key = event && event.key
        if (key !== 'ArrowLeft' && key !== 'ArrowRight') return
        if (event.preventDefault) event.preventDefault()
        onCommit(clamp(splitOf(split + (key === 'ArrowLeft' ? -0.02 : 0.02))))
      }
      const lit = dragging || hovered
      return h(
        'div',
        {
          role: 'separator',
          tabIndex: 0,
          'aria-orientation': 'vertical',
          'aria-label': t('pane.split'),
          'aria-valuenow': Math.round(split * 100),
          'aria-valuemin': Math.round(min * 100),
          'aria-valuemax': Math.round(max * 100),
          title: t('pane.split'),
          'data-assets-split': 'yes',
          'data-assets-split-on': dragging ? 'drag' : (hovered ? 'hover' : 'no'),
          style: S.split,
          onPointerDown,
          // NO onPointerMove/onPointerUp HERE: the drag listens on the window (see onMove/endDrag), so it
          // keeps working when the pointer leaves this 12px target — which is most of any real drag.
          onPointerLeave: () => setHovered(false),
          onPointerEnter: () => setHovered(true),
          onKeyDown,
          // DOUBLE-CLICK IS THE WAY BACK. A divider dragged to a limit is otherwise only undoable by
          // hitting the same limit from the other side, which is a puzzle rather than a control.
          onDoubleClick: () => onCommit(clamp(SPLIT_DEFAULT)),
        },
        h('span', { style: { ...S.splitLine, ...(lit ? S.splitLineOn : null) }, 'aria-hidden': 'true' }),
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

    /**
     * THE DISCLOSURE'S CHEVRON, drawn here for one reason: the harness ships two chevrons at two sizes
     * and this row needs the 12px down one — but the verify stub has no icon set at all, so a host
     * without the primitives would draw a nameless button with no mark to say it opens. Same 24-unit
     * grid and 1.5 stroke as the view switch's glyphs, so it sits at the family's weight.
     */
    const FactsChevron = viewGlyph('FactsChevron', [
      h('path', { key: 'a', d: 'M6 9l6 6 6-6' }),
    ])

    /**
     * THE FOLDER TAB'S "SHOW IN FINDER" MARK. Lucide's `arrow-up-right`: the glyph that says "this leaves
     * the app", which is what the reveal action does — it opens the folder in Finder, not in a pane. Drawn
     * here rather than resolved so a host without the icon set still shows the direction.
     */
    const RevealGlyph = viewGlyph('RevealGlyph', [
      h('path', { key: 'a', d: 'M7 17L17 7' }),
      h('path', { key: 'b', d: 'M9 7h8v8' }),
    ])

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

    // THE CAROUSEL CHEVRONS, Lucide's own `chevron-left` / `chevron-right` geometry at the family's
    // 24-unit grid and 1.5 stroke, so the arrows match the view switch rather than the text.
    const CarouselPrev = viewGlyph('CarouselPrev', [
      h('path', { key: 'a', d: 'M15 18l-6-6 6-6' }),
    ])
    const CarouselNext = viewGlyph('CarouselNext', [
      h('path', { key: 'a', d: 'M9 18l6-6-6-6' }),
    ])

    // THE PILL'S TRASH, Lucide's `trash-2` geometry, same 24-unit grid and 1.5 stroke as the rest.
    const TrashGlyph = viewGlyph('TrashGlyph', [
      h('path', { key: 'a', d: 'M3 6h18' }),
      h('path', { key: 'b', d: 'M8 6V4h8v2' }),
      h('path', { key: 'c', d: 'M19 6l-1 14H6L5 6' }),
      h('path', { key: 'd', d: 'M10 11v6' }),
      h('path', { key: 'e', d: 'M14 11v6' }),
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
          '.dsh-assets-views > button { display: inline-flex; align-items: center; justify-content: center; padding: 0 10px; }\n' +
          // The card the primitive draws is translucent on purpose, and the app reads it through a
          // backdrop blur. That is right over a dialog and wrong over photographs: the founder called
          // it *"grey instead of white"*. So these two menus take the app's own raised surface —
          // solid `bg-layer-2`, a real `border-l3` hairline (the shadow's own stroke is silenced so
          // there is exactly one ring), no blur — which is the same answer the Generate popover uses.
          // A SCROLLBAR A MOUSE CAN HIT (founder, 2026-10-18: *"its very hard to get the mouse hit on
          // scroll bar"*). macOS's overlay scrollbar is a few transparent pixels until it is already
          // scrolling. Styling `::-webkit-scrollbar` makes it a real 10px track with a 6px thumb, and
          // every scroll container in this pane wears the class: the thumbnail column, the preview
          // column, the floating facts card, the stacked row and the filmstrip.
          '.dsh-assets-scroll { scrollbar-width: thin; }\n' +
          '.dsh-assets-scroll::-webkit-scrollbar { width: 10px; height: 10px; }\n' +
          '.dsh-assets-scroll::-webkit-scrollbar-thumb { background: var(--dsw-alias-border-l3); border-radius: 6px; border: 2px solid transparent; background-clip: padding-box; }\n' +
          '.dsh-assets-scroll::-webkit-scrollbar-thumb:hover { background: var(--dsw-alias-label-tertiary); background-clip: padding-box; }\n' +
          '.dsh-assets-scroll::-webkit-scrollbar-track { background: transparent; }\n' +
          // The pill's icon buttons read as buttons on hover even without the primitives.
          '.dsh-assets-pill-btn:hover { background: var(--dsw-alias-interactive-bg-hover); }\n' +
          '.dsh-assets-pill-btn:disabled { color: var(--dsw-alias-label-tertiary); cursor: default; }\n' +
          '.dsh-assets-menu { background: var(--dsw-alias-bg-layer-2); backdrop-filter: none; border: 0.5px solid var(--dsw-alias-border-l3); --dsw-elevation-stroke-color: transparent; }\n'
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
    return {
      inject,
      apply,
      zoom: { ZOOM_MIN, ZOOM_MAX, clampZoom, fitScale, fitView, centreOffset, zoomAt, panBy, oneToOne },
      split: { SPLIT_MIN, SPLIT_MAX, SPLIT_DEFAULT, SPLIT_HANDLE, MAIN_FLOOR, SIDE_FLOOR, STACK_BELOW, splitOf, splitBounds, splitWidths, splitFrom },
    }
  },
})
