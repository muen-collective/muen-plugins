/**
 * @muen/dsh-styling — the client half.
 *
 * ONE REGISTRATION, TWO SCREENS:
 *   PLP  a grid of look covers. Each card opens the look; a switch approves it;
 *        the top bar queues every look that is not approved, with a "regenerate
 *        approved" switch that widens the queue to the ones that are.
 *   PDP  the look, one view at a time: a 2048px before/after wipe with pan and
 *        zoom, a strip of the other views above it, and the approve / re-generate
 *        pair under it.
 *
 * Loader format: one self-contained script registered via window.__ModuleLoader__.
 * Only `react` and the client UI primitives are required. All styles are inline on
 * the app's `--dsw-alias-*` tokens, plus one sheet for hover, focus and the wipe
 * handle's cursor.
 */
window.__ModuleLoader__.load({
  id: '@muen/dsh-styling',
  factory: (require) => {
    const React = require('react')
    // react-dom is a platform seed word in the Web shell. It is required defensively: a
    // host without the seed still loads the pane and renders the inspection inline.
    let ReactDOM = null
    try {
      ReactDOM = require('react-dom')
    } catch {
      ReactDOM = null
    }
    const primitives = require('@deepseek-ai/dsh-client-ui-primitives') || {}
    const h = React.createElement
    const useState = React.useState
    const useEffect = React.useEffect
    const useRef = React.useRef
    const useCallback = React.useCallback

    const STYLING_ID = '@muen/dsh-styling'
    const STYLING_KIND = 'styling'
    const NS = 'styling'
    const API = '/plugins/styling'
    const STATE_URL = API + '/state'
    const FOLDER_URL = API + '/folder'
    const PROBE_URL = API + '/probe'
    const APPROVE_URL = API + '/approve'
    const NAME_URL = API + '/name'
    const REGENERATE_URL = API + '/regenerate'
    const DETAIL_URL = API + '/detail'
    const IMAGE_URL = API + '/image'

    // ── glyphs, drawn here so a missing icon name cannot crash the pane ─────────
    function glyph(name, paths) {
      const Component = (props) => {
        const { size = 16, ...rest } = props || {}
        return h(
          'svg',
          {
            width: size,
            height: size,
            viewBox: '0 0 24 24',
            fill: 'none',
            stroke: 'currentColor',
            strokeWidth: 1.6,
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
            'aria-hidden': 'true',
            focusable: 'false',
            ...rest,
          },
          paths,
        )
      }
      Component.displayName = name
      return Component
    }

    const IconSparkle = glyph('Sparkle', [
      h('path', { key: 'a', d: 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z' }),
      h('path', { key: 'b', d: 'M18.5 16.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z' }),
    ])
    const IconFolder = glyph('Folder', [h('path', { key: 'a', d: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z' })])
    // Lucide `shirt` — the plugin's mark. Drawn here so the tab and the pane
    // header carry the same shape without a second icon dependency.
    const IconShirt = glyph('Shirt', [
      h('path', {
        key: 'a',
        d: 'M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z',
      }),
    ])

    const IconPlus = glyph('Plus', [h('path', { key: 'a', d: 'M12 5v14M5 12h14' })])
    const IconBack = glyph('Back', [h('path', { key: 'a', d: 'M19 12H5M12 19l-7-7 7-7' })])
    const IconChevronLeft = glyph('ChevronLeft', [h('path', { key: 'a', d: 'M15 18l-6-6 6-6' })])
    const IconChevronRight = glyph('ChevronRight', [h('path', { key: 'a', d: 'M9 18l6-6-6-6' })])
    const IconCheck = glyph('Check', [h('path', { key: 'a', d: 'M20 6L9 17l-5-5' })])
    const IconRefresh = glyph('Refresh', [h('path', { key: 'a', d: 'M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5' })])
    const IconZoomIn = glyph('ZoomIn', [
      h('path', { key: 'a', d: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z' }),
      h('path', { key: 'b', d: 'M21 21l-4.3-4.3M11 8v6M8 11h6' }),
    ])
    const IconZoomOut = glyph('ZoomOut', [
      h('path', { key: 'a', d: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z' }),
      h('path', { key: 'b', d: 'M21 21l-4.3-4.3M8 11h6' }),
    ])
    const IconFit = glyph('Fit', [h('path', { key: 'a', d: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5' })])
    const IconSplit = glyph('Split', [h('path', { key: 'a', d: 'M4 4h16v16H4zM12 4v16' })])
    const IconClose = glyph('Close', [h('path', { key: 'a', d: 'M18 6L6 18M6 6l12 12' })])
    const IconLayers = glyph('Layers', [h('path', { key: 'a', d: 'M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5' })])
    const IconExpand = glyph('Expand', [h('path', { key: 'a', d: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5' })])
    const IconCollapse = glyph('Collapse', [h('path', { key: 'a', d: 'M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5' })])

    // ── copy ───────────────────────────────────────────────────────────────────
    const EN = {
      'type.label': 'Styling',
      'guide.title': 'Styling',
      'guide.description': 'Style every look, then review it',
      'pane.loading': 'Reading the folder…',
      'pane.error': 'The folder could not be read.',
      'pane.error.body': 'The host did not answer. Re-read the folder; if this stays, the plugin’s host half is not running.',
      'pane.retry': 'try again',
      'pane.empty.title': 'No looks yet',
      'pane.empty.body':
        'Add the folder your look photographs live in. The host creates one folder per look — originals and final — and leaves your files where they are.',
      'pane.add': 'Add folder',
      'pane.adding': 'Adding…',
      'pane.path.placeholder': '/Users/you/Pictures/ss27',
      'pane.path.use': 'Add folder',
      'pane.path.hint': 'An absolute path. Nothing is moved.',
      'pane.reveal': 'Show in Finder',
      'pane.remove': 'Remove folder',
      'pane.refresh': 'Re-read the folder',
      'pane.summary': '{n} looks',
      'pane.summary.filtered': '{approved} approved · {toStyle} to style',
      'pane.noFinal': '{n} without a final',
      'pane.add.failed': 'The folder could not be added.',
      'plp.generate': 'generate {n}',
      'plp.regenerate': 'regenerate {n}',
      'plp.regenerating': 'queueing…',
      'plp.regenerateApproved': 'regenerate approved',
      'plp.regenerateApprovedHint': 'Include the looks you already approved.',
      'plp.queued': '{n} looks queued. Ask the agent to run the styling queue.',
      'plp.noneQueued': 'Every look is approved.',
      'plp.noFinal': 'no final yet',
      'plp.approved': 'approved',
      'plp.approvedCount': 'approved {approved}/{total}',
      'plp.toStyle': 'to style',
      'plp.open': 'open look',
      'plp.viewProgress': '{approved}/{total} views',
      'queue.title': 'Re-generate looks',
      'queue.generateTitle': 'Generate looks',
      'queue.regenerateTitle': 'Regenerate looks',
      'queue.body': 'Choose the scope. Writing the queue does not start the agent; it runs when you tell it to.',
      'queue.all': 'All at once',
      'queue.allHint': 'Queue {n} look(s); review the batch afterwards.',
      'queue.one': 'One look at a time',
      'queue.oneHint': 'Queue the next look ({name}); review it before the next.',
      'queue.only': 'Only this look',
      'queue.onlyHint': 'Pick one look; only it is queued.',
      'queue.queueOnly': 'Regenerate this look',
      'queue.generateOnly': 'Generate this look',
      'queue.noLooks': 'No looks are in this folder yet.',
      'queue.pick': 'Pick a look',
      'queue.queueAll': 'Queue all {n}',
      'queue.queueOne': 'Queue next look',
      'queue.cancel': 'Cancel',
      'queue.close': 'Close',
      'queue.none': 'No looks are waiting for styling.',
      'queue.note': 'Nothing is generated from this dialog. The agent runs the queue only when you tell it to.',
      'pdp.back': 'all looks',
      'pdp.view': 'view {n} of {total}',
      'pdp.viewName': 'view {n} of {total} · {view}',
      'pdp.before': 'before',
      'pdp.after': 'after',
      'pdp.noFinal': 'No final for this view yet.',
      'pdp.noFinal.body': 'Press generate to style this view.',
      'pdp.noFinal.regenerate': 'Press regenerate to style this view.',
      'pdp.fit': 'fit',
      'pdp.one': '1:1',
      'pdp.fill': 'fill',
      'pdp.wipe': 'wipe',
      'pdp.split': 'side by side',
      'pdp.approveView': 'approve this view',
      'pdp.approvedView': 'view approved',
      'pdp.approveViewHint': 'approval is per view',
      'pdp.generate': 'generate this view',
      'pdp.regenerate': 'regenerate this view',
      'pdp.queuedView': 'This view is queued.',
      'pdp.queued': 'Queued.',
      'pdp.lastRun': 'last run {when}',
      'pdp.noRuns': 'no runs yet',
      'pdp.name': 'name',
      'pdp.namePlaceholder': 'name this look',
      'pdp.loading': 'Loading the look…',
      'pdp.gone': 'That look is no longer in the folder.',
      'pdp.zoom': 'zoom {n}%',
      'pdp.fullscreen': 'fullscreen',
      'pdp.exitFullscreen': 'exit fullscreen',
      'pdp.inspect': 'inspection',
      'pdp.fullscreenHint': 'inspect the look at full size',
    }

    const ZH = {
      'type.label': '造型',
      'guide.title': '造型',
      'guide.description': '为每个造型做图，再逐张审阅',
      'pane.loading': '正在读取文件夹…',
      'pane.error': '无法读取文件夹。',
      'pane.error.body': '宿主没有回应。请重新读取；如果仍然失败，插件的宿主端没有运行。',
      'pane.retry': '重试',
      'pane.empty.title': '还没有造型',
      'pane.empty.body': '添加存放造型照片的文件夹。宿主会按造型各建一个文件夹——原图与成图——照片不会被移动。',
      'pane.add': '添加文件夹',
      'pane.adding': '正在添加…',
      'pane.path.placeholder': '/Users/you/Pictures/ss27',
      'pane.path.use': '添加文件夹',
      'pane.path.hint': '绝对路径。不会移动任何文件。',
      'pane.reveal': '在访达中显示',
      'pane.remove': '移除文件夹',
      'pane.refresh': '重新读取文件夹',
      'pane.summary': '{n} 个造型',
      'pane.summary.filtered': '{approved} 已通过 · {toStyle} 待造型',
      'pane.noFinal': '{n} 个还没有成图',
      'pane.add.failed': '无法添加文件夹。',
      'plp.generate': '生成 {n} 个',
      'plp.regenerate': '重新生成 {n} 个',
      'plp.regenerating': '正在排队…',
      'plp.regenerateApproved': '重新生成已通过',
      'plp.regenerateApprovedHint': '把已经通过的造型也包含进来。',
      'plp.queued': '已排队 {n} 个造型。请让 agent 运行造型队列。',
      'plp.noneQueued': '所有造型都已通过。',
      'plp.noFinal': '还没有成图',
      'plp.approved': '已通过',
      'plp.approvedCount': '已通过 {approved}/{total}',
      'plp.toStyle': '待造型',
      'plp.open': '打开造型',
      'plp.viewProgress': '{approved}/{total} 个视图',
      'queue.title': '重新生成',
      'queue.generateTitle': '生成造型',
      'queue.regenerateTitle': '重新生成造型',
      'queue.body': '选择范围。写队列不会启动 agent，只有你让它跑时才会生成。',
      'queue.all': '全部一起',
      'queue.allHint': '加入 {n} 个造型，跑完一起审。',
      'queue.one': '一次一个',
      'queue.oneHint': '加入下一个造型（{name}），审完再下一个。',
      'queue.only': '只重新生成这个造型',
      'queue.onlyHint': '选一个造型，只加入它。',
      'queue.queueOnly': '重新生成这个造型',
      'queue.generateOnly': '生成这个造型',
      'queue.noLooks': '文件夹里还没有造型。',
      'queue.pick': '选一个造型',
      'queue.queueAll': '加入全部 {n} 个',
      'queue.queueOne': '加入下一个',
      'queue.cancel': '取消',
      'queue.close': '关闭',
      'queue.none': '没有待造型的造型。',
      'queue.note': '这个对话框不会生成图片。只有你让 agent 跑队列时才会生成。',
      'pdp.back': '全部造型',
      'pdp.view': '第 {n} / {total} 个视图',
      'pdp.viewName': '第 {n} / {total} 个视图 · {view}',
      'pdp.before': '原图',
      'pdp.after': '成图',
      'pdp.noFinal': '这个视图还没有成图。',
      'pdp.noFinal.body': '按生成来为这个视图做图。',
      'pdp.noFinal.regenerate': '按重新生成来为这个视图做图。',
      'pdp.fit': '适应',
      'pdp.one': '1:1',
      'pdp.fill': '填满',
      'pdp.wipe': '对比',
      'pdp.split': '并排',
      'pdp.approveView': '通过这个视图',
      'pdp.approvedView': '视图已通过',
      'pdp.approveViewHint': '按视图逐个通过',
      'pdp.generate': '生成这个视图',
      'pdp.regenerate': '重新生成这个视图',
      'pdp.queuedView': '这个视图已排队。',
      'pdp.queued': '已排队。',
      'pdp.lastRun': '上次运行 {when}',
      'pdp.noRuns': '还没有运行',
      'pdp.name': '名称',
      'pdp.namePlaceholder': '给这个造型命名',
      'pdp.loading': '正在读取造型…',
      'pdp.gone': '这个造型已不在文件夹里。',
      'pdp.zoom': '缩放 {n}%',
      'pdp.fullscreen': '全屏',
      'pdp.exitFullscreen': '退出全屏',
      'pdp.inspect': '查看',
      'pdp.fullscreenHint': '全尺寸查看这个造型',
    }

    // ── styles ─────────────────────────────────────────────────────────────────
    const S = {
      pane: {
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        padding: '16px 14px',
        height: '100%',
        minHeight: 0,
        boxSizing: 'border-box',
        overflow: 'hidden',
        color: 'var(--dsw-alias-label-primary)',
      },
      top: { display: 'flex', flexDirection: 'column', gap: 10, flex: '0 0 auto', minWidth: 0 },
      head: { display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between', minWidth: 0 },
      brand: { display: 'inline-flex', alignItems: 'center', gap: 7, minWidth: 0 },
      brandGlyph: { color: 'var(--dsw-alias-brand-primary)', display: 'flex', flex: '0 0 auto' },
      title: { color: 'var(--dsw-alias-label-primary)', fontSize: 14, fontWeight: 600, letterSpacing: '.01em' },
      rootRow: { display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 },
      root: {
        color: 'var(--dsw-alias-label-tertiary)',
        fontSize: 11,
        lineHeight: '16px',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        direction: 'ltr',
        minWidth: 0,
      },
      stats: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', color: 'var(--dsw-alias-label-secondary)', fontSize: 11.5 },
      statStrong: { color: 'var(--dsw-alias-label-primary)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' },
      bar: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', flex: '0 0 auto' },
      scroll: { flex: '1 1 auto', minHeight: 0, overflow: 'auto', paddingRight: 2 },
      grid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(min(150px, 100%), 1fr))',
        gap: 10,
        alignContent: 'start',
      },
      card: {
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        padding: 0,
        border: '1px solid var(--dsw-alias-border-l2)',
        borderRadius: 10,
        background: 'var(--dsw-alias-bg-layer-2)',
        cursor: 'pointer',
        textAlign: 'left',
        overflow: 'hidden',
        position: 'relative',
      },
      cardOn: { borderColor: 'var(--dsw-alias-brand-primary)' },
      thumb: {
        position: 'relative',
        width: '100%',
        aspectRatio: '3 / 4',
        background: 'var(--dsw-alias-bg-layer-1)',
        overflow: 'hidden',
      },
      thumbImage: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
      thumbEmpty: { width: '100%', height: '100%', display: 'grid', placeItems: 'center', color: 'var(--dsw-alias-label-tertiary)' },
      cardText: { padding: '7px 8px 8px', display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 },
      cardName: {
        color: 'var(--dsw-alias-label-primary)',
        fontSize: 12,
        lineHeight: '16px',
        fontWeight: 500,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      },
      cardMeta: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, minWidth: 0 },
      status: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        color: 'var(--dsw-alias-label-tertiary)',
        fontSize: 10.5,
        lineHeight: '14px',
        whiteSpace: 'nowrap',
      },
      statusOn: { color: 'var(--dsw-alias-brand-primary)' },
      dot: { width: 5, height: 5, borderRadius: 999, background: 'currentColor', flex: '0 0 auto' },
      button: {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        minHeight: 28,
        padding: '0 10px',
        borderRadius: 7,
        border: '1px solid var(--dsw-alias-border-l3)',
        background: 'transparent',
        color: 'var(--dsw-alias-label-secondary)',
        font: 'inherit',
        fontSize: 11.5,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      },
      buttonPrimary: {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        minHeight: 30,
        padding: '0 12px',
        borderRadius: 7,
        border: '1px solid var(--dsw-alias-brand-primary)',
        background: 'var(--dsw-alias-brand-primary)',
        color: 'var(--dsw-alias-bg-layer-1, #fff)',
        font: 'inherit',
        fontSize: 11.5,
        fontWeight: 600,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      },
      buttonQuiet: {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        minHeight: 24,
        padding: '0 6px',
        borderRadius: 6,
        border: 0,
        background: 'transparent',
        color: 'var(--dsw-alias-label-tertiary)',
        font: 'inherit',
        fontSize: 11,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      },
      buttonDisabled: { opacity: 0.45, cursor: 'default' },
      iconButton: {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 28,
        height: 28,
        padding: 0,
        borderRadius: 7,
        border: '1px solid var(--dsw-alias-border-l2)',
        background: 'transparent',
        color: 'var(--dsw-alias-label-secondary)',
        cursor: 'pointer',
        flex: '0 0 auto',
      },
      switchRow: { display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0 },
      switchLabel: { color: 'var(--dsw-alias-label-secondary)', fontSize: 11, whiteSpace: 'nowrap' },
      track: {
        position: 'relative',
        width: 28,
        height: 16,
        borderRadius: 999,
        border: '1px solid var(--dsw-alias-border-l3)',
        background: 'var(--dsw-alias-bg-layer-1)',
        cursor: 'pointer',
        flex: '0 0 auto',
        padding: 0,
      },
      trackOn: { background: 'var(--dsw-alias-brand-primary)', borderColor: 'var(--dsw-alias-brand-primary)' },
      knob: {
        position: 'absolute',
        top: 2,
        left: 2,
        width: 10,
        height: 10,
        borderRadius: 999,
        background: 'var(--dsw-alias-label-tertiary)',
        transition: 'transform 120ms ease, background 120ms ease',
      },
      knobOn: { transform: 'translateX(12px)', background: 'var(--dsw-alias-bg-layer-1)' },
      notice: {
        padding: '7px 9px',
        borderRadius: 8,
        border: '1px solid var(--dsw-alias-border-l2)',
        background: 'var(--dsw-alias-bg-layer-2)',
        color: 'var(--dsw-alias-label-secondary)',
        fontSize: 11.5,
        lineHeight: '16px',
      },
      queueOverlay: {
        position: 'fixed',
        inset: 0,
        zIndex: 90,
        background: 'rgba(8, 10, 16, 0.48)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      },
      queueCard: {
        width: 'min(92vw, 460px)',
        maxHeight: 'min(84vh, 720px)',
        overflow: 'auto',
        background: 'var(--dsw-alias-bg-layer-1)',
        border: '1px solid var(--dsw-alias-border-l2)',
        borderRadius: 12,
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.28)',
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      },
      queueHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
      queueTitle: { fontSize: 15, fontWeight: 600, color: 'var(--dsw-alias-label-primary)' },
      queueClose: {
        width: 26,
        height: 26,
        border: '1px solid var(--dsw-alias-border-l3)',
        borderRadius: 7,
        background: 'transparent',
        color: 'var(--dsw-alias-label-secondary)',
        display: 'grid',
        placeItems: 'center',
        cursor: 'pointer',
        padding: 0,
      },
      queueBody: { margin: 0, fontSize: 12, lineHeight: 1.5, color: 'var(--dsw-alias-label-secondary)' },
      queueSwitchRow: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        borderTop: '1px solid var(--dsw-alias-border-l3)',
        borderBottom: '1px solid var(--dsw-alias-border-l3)',
        padding: '8px 0',
      },
      queueOptions: { display: 'flex', flexDirection: 'column', gap: 6 },
      queueOption: {
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
        textAlign: 'left',
        padding: '9px 10px',
        border: '1px solid var(--dsw-alias-border-l3)',
        borderRadius: 8,
        background: 'transparent',
        cursor: 'pointer',
        color: 'var(--dsw-alias-label-primary)',
      },
      queueOptionOn: {
        borderColor: 'var(--dsw-alias-brand-primary)',
        background: 'color-mix(in srgb, var(--dsw-alias-brand-primary) 8%, transparent)',
      },
      queueRadio: {
        width: 14,
        height: 14,
        borderRadius: 999,
        border: '1px solid var(--dsw-alias-border-l2)',
        flex: '0 0 auto',
        marginTop: 2,
      },
      queueRadioOn: {
        borderColor: 'var(--dsw-alias-brand-primary)',
        background: 'var(--dsw-alias-brand-primary)',
        boxShadow: 'inset 0 0 0 3px var(--dsw-alias-bg-layer-1)',
      },
      queueOptionTitle: { display: 'block', fontSize: 12, fontWeight: 600 },
      queueOptionHint: { display: 'block', fontSize: 11, color: 'var(--dsw-alias-label-secondary)', marginTop: 2 },
      queueList: {
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        maxHeight: 220,
        overflowY: 'auto',
        paddingRight: 2,
      },
      queueItem: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        textAlign: 'left',
        padding: '6px 8px',
        border: '1px solid transparent',
        borderRadius: 7,
        background: 'var(--dsw-alias-bg-layer-2)',
        cursor: 'pointer',
        color: 'var(--dsw-alias-label-primary)',
      },
      queueItemOn: { borderColor: 'var(--dsw-alias-brand-primary)' },
      queueItemNum: { fontSize: 10, color: 'var(--dsw-alias-label-tertiary)', fontVariantNumeric: 'tabular-nums' },
      queueItemName: {
        flex: 1,
        minWidth: 0,
        fontSize: 12,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      },
      queueItemMeta: { fontSize: 10, color: 'var(--dsw-alias-label-secondary)', fontVariantNumeric: 'tabular-nums' },
      queueSelectWrap: { display: 'flex', flexDirection: 'column', gap: 4 },
      queueSelectLabel: { fontSize: 11, color: 'var(--dsw-alias-label-secondary)' },
      queueSelect: {
        width: '100%',
        padding: '7px 8px',
        border: '1px solid var(--dsw-alias-border-l3)',
        borderRadius: 7,
        background: 'var(--dsw-alias-bg-layer-2)',
        color: 'var(--dsw-alias-label-primary)',
        fontSize: 12,
      },
      queueNote: { margin: 0, fontSize: 11, lineHeight: 1.45, color: 'var(--dsw-alias-label-tertiary)' },
      queueFoot: { display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 2 },
      queueCancel: {
        padding: '6px 10px',
        border: '1px solid var(--dsw-alias-border-l3)',
        borderRadius: 7,
        background: 'transparent',
        color: 'var(--dsw-alias-label-primary)',
        fontSize: 12,
        cursor: 'pointer',
      },
      queueGo: {
        padding: '6px 12px',
        border: '1px solid var(--dsw-alias-brand-primary)',
        borderRadius: 7,
        background: 'var(--dsw-alias-brand-primary)',
        color: 'var(--dsw-alias-bg-layer-1)',
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
      },
      error: { color: 'var(--dsw-alias-state-error-primary)', fontSize: 11.5, lineHeight: '16px' },
      centre: {
        margin: 'auto 0',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        textAlign: 'center',
        maxWidth: 380,
        alignSelf: 'center',
        width: '100%',
      },
      body: { color: 'var(--dsw-alias-label-secondary)', fontSize: 12.5, lineHeight: '19px' },
      muted: { color: 'var(--dsw-alias-label-tertiary)', fontSize: 11, lineHeight: '16px' },
      glyph: { color: 'var(--dsw-alias-label-tertiary)', display: 'flex' },
      input: {
        width: '100%',
        boxSizing: 'border-box',
        padding: '6px 8px',
        borderRadius: 8,
        border: '1px solid var(--dsw-alias-border-l3)',
        background: 'var(--dsw-alias-bg-layer-2)',
        color: 'var(--dsw-alias-label-primary)',
        font: 'inherit',
        fontSize: 12.5,
      },
      // The PDP
      pdpTop: { display: 'flex', flexDirection: 'column', gap: 8, flex: '0 0 auto', minWidth: 0 },
      pdpHead: { display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 },
      pdpName: {
        color: 'var(--dsw-alias-label-primary)',
        fontSize: 13,
        fontWeight: 600,
        minWidth: 0,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      },
      strip: {
        display: 'flex',
        alignItems: 'stretch',
        gap: 6,
        overflowX: 'auto',
        overflowY: 'hidden',
        paddingBottom: 2,
        flex: '0 0 auto',
        minHeight: 54,
      },
      stripItem: {
        position: 'relative',
        flex: '0 0 auto',
        width: 44,
        height: 54,
        padding: 0,
        borderRadius: 7,
        border: '1px solid var(--dsw-alias-border-l2)',
        background: 'var(--dsw-alias-bg-layer-1)',
        overflow: 'hidden',
        cursor: 'pointer',
      },
      stripOn: { borderColor: 'var(--dsw-alias-brand-primary)' },
      stripImage: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
      stripDot: {
        position: 'absolute',
        right: 3,
        bottom: 3,
        width: 6,
        height: 6,
        borderRadius: 999,
        background: 'var(--dsw-alias-brand-primary)',
        border: '1px solid var(--dsw-alias-bg-layer-2)',
      },
      stripCheck: {
        position: 'absolute',
        right: 2,
        bottom: 2,
        color: 'var(--dsw-alias-brand-primary)',
        background: 'var(--dsw-alias-bg-layer-2)',
        borderRadius: 999,
        lineHeight: 0,
        padding: 1,
        border: '1px solid var(--dsw-alias-border-l3)',
      },
      stage: {
        position: 'relative',
        width: '100%',
        height: 'min(62vh, 720px)',
        minHeight: 260,
        borderRadius: 10,
        border: '1px solid var(--dsw-alias-border-l2)',
        background: 'var(--dsw-alias-bg-layer-1)',
        overflow: 'hidden',
        touchAction: 'none',
        cursor: 'grab',
      },
      stageCanvas: { position: 'absolute', inset: 0, overflow: 'hidden' },
      stageImage: { position: 'absolute', top: 0, left: 0, display: 'block', transformOrigin: '0 0', userSelect: 'none', pointerEvents: 'none' },
      wipeLayer: { position: 'absolute', inset: 0, overflow: 'hidden' },
      wipeHandle: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        width: 2,
        background: 'var(--dsw-alias-bg-layer-1)',
        boxShadow: '0 0 0 1px rgba(0,0,0,.28)',
        cursor: 'ew-resize',
        zIndex: 3,
        padding: 0,
        border: 0,
      },
      wipeGrip: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        width: 26,
        height: 26,
        marginTop: -13,
        marginLeft: -13,
        borderRadius: 999,
        background: 'var(--dsw-alias-bg-layer-1)',
        border: '1px solid var(--dsw-alias-border-l3)',
        boxShadow: '0 1px 4px rgba(0,0,0,.24)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--dsw-alias-label-secondary)',
        gap: 0,
      },
      label: {
        position: 'absolute',
        top: 8,
        padding: '2px 6px',
        borderRadius: 999,
        background: 'var(--dsw-alias-bg-layer-2)',
        border: '1px solid var(--dsw-alias-border-l3)',
        color: 'var(--dsw-alias-label-secondary)',
        fontSize: 10,
        lineHeight: '14px',
        pointerEvents: 'none',
        zIndex: 4,
      },
      stageControls: {
        position: 'absolute',
        bottom: 8,
        right: 8,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        zIndex: 5,
        background: 'var(--dsw-alias-bg-layer-2)',
        border: '1px solid var(--dsw-alias-border-l2)',
        borderRadius: 7,
        padding: 2,
      },
      stageScale: {
        color: 'var(--dsw-alias-label-tertiary)',
        fontSize: 10.5,
        fontVariantNumeric: 'tabular-nums',
        padding: '0 4px',
        minWidth: 34,
        textAlign: 'center',
      },
      noFinal: {
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        textAlign: 'center',
        padding: 18,
        background: 'color-mix(in srgb, var(--dsw-alias-bg-layer-1) 82%, transparent)',
        zIndex: 2,
        pointerEvents: 'none',
      },
      stageWrap: { flex: '1 1 auto', minHeight: 220, display: 'flex', position: 'relative' },
      modeButton: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        minHeight: 24,
        padding: '0 8px',
        borderRadius: 6,
        border: '1px solid var(--dsw-alias-border-l2)',
        background: 'transparent',
        color: 'var(--dsw-alias-label-secondary)',
        font: 'inherit',
        fontSize: 11,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        flex: '0 0 auto',
      },
      splitStage: {
        display: 'flex',
        gap: 6,
        width: '100%',
        height: 'min(62vh, 720px)',
        minHeight: 260,
        position: 'relative',
        overflow: 'hidden',
        touchAction: 'none',
        cursor: 'grab',
      },
      splitPane: {
        flex: '1 1 0',
        position: 'relative',
        borderRadius: 10,
        border: '1px solid var(--dsw-alias-border-l2)',
        background: 'var(--dsw-alias-bg-layer-1)',
        overflow: 'hidden',
        minWidth: 0,
      },
      splitCanvas: { position: 'absolute', inset: 0, overflow: 'hidden' },
      splitImage: { position: 'absolute', top: 0, left: 0, display: 'block', transformOrigin: '0 0', userSelect: 'none', pointerEvents: 'none', objectFit: 'cover' },
      pdpActions: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', flex: '0 0 auto' },
      pdpMeta: { display: 'flex', flexDirection: 'column', gap: 4, color: 'var(--dsw-alias-label-tertiary)', fontSize: 11, lineHeight: '16px' },
      fsOverlay: {
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        padding: 12,
        boxSizing: 'border-box',
        background: 'var(--dsw-alias-bg-layer-1)',
        color: 'var(--dsw-alias-label-primary)',
        outline: 'none',
      },
      fsHead: { display: 'flex', alignItems: 'center', gap: 10, flex: '0 0 auto', minWidth: 0 },
      fsTitle: { color: 'var(--dsw-alias-label-primary)', fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
      fsStrip: { display: 'flex', alignItems: 'center', gap: 6, overflowX: 'auto', overflowY: 'hidden', flex: '0 0 auto', minHeight: 64, paddingBottom: 2 },
      fsStripItem: {
        position: 'relative',
        flex: '0 0 auto',
        width: 52,
        height: 64,
        padding: 0,
        borderRadius: 7,
        border: '1px solid var(--dsw-alias-border-l2)',
        background: 'var(--dsw-alias-bg-layer-1)',
        overflow: 'hidden',
        cursor: 'pointer',
      },
      fsStripOn: { borderColor: 'var(--dsw-alias-brand-primary)' },
      fsStage: { flex: '1 1 auto', minHeight: 0, position: 'relative' },
      fsFoot: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', flex: '0 0 auto' },
      nameInput: {
        width: '100%',
        boxSizing: 'border-box',
        border: '1px solid transparent',
        borderRadius: 6,
        background: 'transparent',
        color: 'var(--dsw-alias-label-primary)',
        font: 'inherit',
        fontSize: 13,
        fontWeight: 600,
        padding: '2px 4px',
      },
      skeleton: {
        height: '100%',
        width: '100%',
        borderRadius: 8,
        background: 'var(--dsw-alias-bg-skeleton, var(--dsw-alias-bg-layer-2))',
      },
    }

    // ── zoom arithmetic (pure, exported for verify) ────────────────────────────
    const ZOOM_MIN = 0.2
    const ZOOM_MAX = 8

    function clampZoom(scale, min = ZOOM_MIN, max = ZOOM_MAX) {
      if (!Number.isFinite(scale)) return min
      return Math.min(max, Math.max(min, scale))
    }

    function fitScale(natural, frame) {
      if (!natural || !frame) return 1
      const nw = Number(natural.width)
      const nh = Number(natural.height)
      const fw = Number(frame.width)
      const fh = Number(frame.height)
      if (!(nw > 0) || !(nh > 0) || !(fw > 0) || !(fh > 0)) return 1
      return Math.min(1, fw / nw, fh / nh)
    }

    function centreOffset(natural, frame, scale) {
      const nw = natural && Number(natural.width) > 0 ? Number(natural.width) : 0
      const nh = natural && Number(natural.height) > 0 ? Number(natural.height) : 0
      const fw = frame && Number(frame.width) > 0 ? Number(frame.width) : 0
      const fh = frame && Number(frame.height) > 0 ? Number(frame.height) : 0
      return { x: (fw - nw * scale) / 2, y: (fh - nh * scale) / 2 }
    }

    function fitView(natural, frame) {
      const scale = fitScale(natural, frame)
      return { scale, offset: centreOffset(natural, frame, scale) }
    }

    function zoomAt(view, factor, cursor, min = ZOOM_MIN, max = ZOOM_MAX) {
      const from = view && view.scale ? view.scale : 1
      const offset = { x: (view && view.offset && view.offset.x) || 0, y: (view && view.offset && view.offset.y) || 0 }
      const next = clampZoom(from * factor, min, max)
      if (next === from) return { scale: from, offset: { x: offset.x, y: offset.y } }
      const ratio = next / from
      const at = { x: (cursor && cursor.x) || 0, y: (cursor && cursor.y) || 0 }
      return { scale: next, offset: { x: at.x - (at.x - offset.x) * ratio, y: at.y - (at.y - offset.y) * ratio } }
    }

    function panBy(view, delta) {
      const scale = view && view.scale ? view.scale : 1
      const offset = { x: (view && view.offset && view.offset.x) || 0, y: (view && view.offset && view.offset.y) || 0 }
      return { scale, offset: { x: offset.x + ((delta && delta.x) || 0), y: offset.y + ((delta && delta.y) || 0) } }
    }

    function oneToOne(natural, frame, focus = null) {
      const nw = natural && Number(natural.width) > 0 ? Number(natural.width) : 0
      const nh = natural && Number(natural.height) > 0 ? Number(natural.height) : 0
      const fw = frame && Number(frame.width) > 0 ? Number(frame.width) : 0
      const fh = frame && Number(frame.height) > 0 ? Number(frame.height) : 0
      const at = focus === null ? { x: nw / 2, y: nh / 2 } : { x: Number(focus.x) || 0, y: Number(focus.y) || 0 }
      return { scale: 1, offset: { x: fw / 2 - at.x, y: fh / 2 - at.y } }
    }

    /** Fill: the largest scale that still covers the frame — the image fills it, cropping the rest. */
    function fillScale(natural, frame) {
      if (!natural || !frame) return 1
      const nw = Number(natural.width)
      const nh = Number(natural.height)
      const fw = Number(frame.width)
      const fh = Number(frame.height)
      if (!(nw > 0) || !(nh > 0) || !(fw > 0) || !(fh > 0)) return 1
      return Math.max(fw / nw, fh / nh)
    }

    function fillView(natural, frame) {
      const scale = fillScale(natural, frame)
      return { scale, offset: centreOffset(natural, frame, scale) }
    }

    // ── small helpers ──────────────────────────────────────────────────────────
    function translatorOf(props) {
      if (props && typeof props.t === 'function') return props.t
      if (props && props.locale && typeof props.locale.bind === 'function') return props.locale.bind(NS)
      return (key) => (EN[key] !== undefined ? EN[key] : key)
    }

    function replace(template, values) {
      return String(template).replace(/\{(\w+)\}/g, (whole, key) => (values && values[key] !== undefined ? String(values[key]) : whole))
    }

    function imageUrl(path, width) {
      if (!path) return ''
      return IMAGE_URL + '?path=' + encodeURIComponent(path) + (width ? '&w=' + width : '')
    }

    function when(value) {
      if (!value) return ''
      try {
        return new Date(value).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
      } catch {
        return String(value)
      }
    }

    function readStored(key, fallback) {
      try {
        const value = window.localStorage.getItem(key)
        return value === null ? fallback : value
      } catch {
        return fallback
      }
    }

    function store(key, value) {
      try {
        window.localStorage.setItem(key, value)
      } catch {
        // a private window is allowed to forget
      }
    }

    async function getJson(url) {
      const answer = await fetch(url, { cache: 'no-store' })
      const body = await answer.json().catch(() => null)
      if (!answer.ok) throw new Error((body && (body.detail || body.error)) || 'http-' + answer.status)
      return body
    }

    async function postJson(url, body) {
      const answer = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {}),
      })
      const result = await answer.json().catch(() => null)
      if (!answer.ok) throw new Error((result && (result.detail || result.error)) || 'http-' + answer.status)
      return result
    }

    // ── controls ───────────────────────────────────────────────────────────────
    function Switch({ checked, onChange, label, hint, disabled, t, dataName }) {
      return h(
        'span',
        { style: S.switchRow },
        h(
          'button',
          {
            type: 'button',
            role: 'switch',
            'aria-checked': checked ? 'true' : 'false',
            'aria-label': label,
            title: hint || label,
            disabled,
            'data-styling-switch': dataName || 'yes',
            onClick: (event) => {
              if (event) event.stopPropagation()
              if (!disabled) onChange(!checked)
            },
            style: { ...S.track, ...(checked ? S.trackOn : null), ...(disabled ? S.buttonDisabled : null) },
          },
          h('span', { style: { ...S.knob, ...(checked ? S.knobOn : null) }, className: 'dsh-styling-knob' }),
        ),
        h('span', { style: S.switchLabel }, label),
      )
    }

    function PaneButton({ children, onClick, disabled, kind, title, dataName }) {
      const style = kind === 'primary' ? S.buttonPrimary : kind === 'quiet' ? S.buttonQuiet : S.button
      return h(
        'button',
        {
          type: 'button',
          title,
          disabled,
          'data-styling-button': dataName || 'yes',
          onClick,
          style: { ...style, ...(disabled ? S.buttonDisabled : null) },
        },
        children,
      )
    }

    // ── the wipe stage ─────────────────────────────────────────────────────────
    function WipeStage({ original, final, wipe, setWipe, mode, t, full, fill, fullscreen, onFullscreen, generated }) {
      const frameRef = useRef(null)
      const [frame, setFrame] = useState({ width: 0, height: 0 })
      const [natural, setNatural] = useState(null)
      const [view, setView] = useState({ scale: 1, offset: { x: 0, y: 0 } })
      const drag = useRef(null)

      // In split mode the camera fits ONE pane, not the whole stage. The panes are
      // equal with a 6px gap; both images share `view`, so pan and zoom stay synced.
      const paneWidth = Math.max(0, (frame.width - 6) / 2)
      const stageFrame = mode === 'split' ? { width: paneWidth, height: frame.height } : frame

      useEffect(() => {
        if (typeof ResizeObserver !== 'function' || !frameRef.current) return () => {}
        const observer = new ResizeObserver((entries) => {
          for (const entry of entries) {
            const box = entry.contentRect || {}
            setFrame({ width: Number(box.width) || 0, height: Number(box.height) || 0 })
          }
        })
        observer.observe(frameRef.current)
        return () => observer.disconnect()
      }, [mode])

      useEffect(() => {
        setNatural(null)
        setView(fitView(null, frame))
      }, [original, final])

      useEffect(() => {
        setView(fitView(natural, stageFrame))
      }, [natural && natural.width, natural && natural.height, frame.width, frame.height, mode])

      useEffect(() => {
        const node = frameRef.current
        if (!node || typeof node.addEventListener !== 'function') return () => {}
        const hold = (event) => {
          if (event && event.cancelable !== false) event.preventDefault()
        }
        node.addEventListener('wheel', hold, { passive: false })
        return () => node.removeEventListener('wheel', hold)
      }, [mode])

      const onWheel = (event) => {
        const box = event && event.currentTarget && event.currentTarget.getBoundingClientRect ? event.currentTarget.getBoundingClientRect() : { left: 0, top: 0 }
        const cursor = {
          x: (event && event.clientX ? event.clientX : 0) - (box.left || 0),
          y: (event && event.clientY ? event.clientY : 0) - (box.top || 0),
        }
        // In split mode the camera belongs to one pane: translate the right pane's
        // cursor into that pane's own coordinates so both images zoom around the
        // same picture point.
        if (mode === 'split' && paneWidth > 0) {
          if (cursor.x > paneWidth + 6) cursor.x -= paneWidth + 6
          cursor.x = Math.max(0, Math.min(paneWidth, cursor.x))
        }
        const factor = (event && event.deltaY ? event.deltaY : 0) < 0 ? 1.1 : 1 / 1.1
        setView((current) => zoomAt(current, factor, cursor))
      }

      const onPointerDown = (event) => {
        if (event && event.target && event.target.closest && event.target.closest('[data-wipe-handle]')) return
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

      const onWipePointerDown = (event) => {
        if (event) {
          event.stopPropagation()
          if (event.preventDefault) event.preventDefault()
        }
        const node = frameRef.current
        if (!node) return
        const box = node.getBoundingClientRect()
        const move = (pointerEvent) => {
          const x = ((pointerEvent.clientX || 0) - box.left) / Math.max(1, box.width)
          setWipe(Math.min(1, Math.max(0, x)))
        }
        const up = () => {
          window.removeEventListener('pointermove', move)
          window.removeEventListener('pointerup', up)
        }
        window.addEventListener('pointermove', move)
        window.addEventListener('pointerup', up)
        move(event)
      }

      const onWipeKey = (event) => {
        if (!event) return
        if (event.key === 'ArrowLeft') {
          event.preventDefault()
          setWipe(Math.max(0, wipe - 0.02))
        } else if (event.key === 'ArrowRight') {
          event.preventDefault()
          setWipe(Math.min(1, wipe + 0.02))
        }
      }

      const scale = view && view.scale ? view.scale : 1
      const offset = (view && view.offset) || { x: 0, y: 0 }
      const transformed = {
        transform: 'translate(' + offset.x + 'px, ' + offset.y + 'px) scale(' + scale + ')',
        width: natural ? natural.width : undefined,
        height: natural ? natural.height : undefined,
      }

      const onOriginalLoad = (event) => {
        if (natural) return
        const el = event && event.target ? event.target : null
        if (!el || !(el.naturalWidth > 0)) return
        setNatural({ width: el.naturalWidth, height: el.naturalHeight })
      }

      const controls = h(
        'div',
        { style: S.stageControls, onPointerDown: (event) => event.stopPropagation() },
        h('span', { style: S.stageScale, 'data-styling-stage-label': 'yes' }, Math.round(scale * 100) + '%'),
        h('button', { type: 'button', style: S.buttonQuiet, title: t('pdp.fit'), onClick: () => setView(fitView(natural, stageFrame)) }, t('pdp.fit')),
        h('button', { type: 'button', style: S.buttonQuiet, title: t('pdp.fill'), onClick: () => setView(fillView(natural, stageFrame)) }, t('pdp.fill')),
        h('button', { type: 'button', style: S.buttonQuiet, title: t('pdp.one'), onClick: () => setView(oneToOne(natural, stageFrame)) }, t('pdp.one')),
        onFullscreen
          ? h(
              'button',
              {
                type: 'button',
                style: S.buttonQuiet,
                title: fullscreen ? t('pdp.exitFullscreen') : t('pdp.fullscreenHint'),
                'aria-label': fullscreen ? t('pdp.exitFullscreen') : t('pdp.fullscreen'),
                'data-styling-button': 'stage-fullscreen',
                onClick: onFullscreen,
              },
              h(fullscreen ? IconCollapse : IconExpand, { size: 13 }),
            )
          : null,
      )

      if (mode === 'split') {
        const splitStyle = full
          ? { ...S.splitStage, height: '100%', minHeight: 0 }
          : fill
            ? { ...S.splitStage, height: '100%', minHeight: 0 }
            : S.splitStage
        return h(
          'div',
          {
            ref: frameRef,
            style: splitStyle,
            'data-styling-split': 'yes',
            'data-styling-stage-scale': String(scale),
            onWheel,
            onPointerDown,
            onPointerMove,
            onPointerUp,
            onPointerLeave: onPointerUp,
          },
          h(
            'div',
            { style: S.splitPane },
            h(
              'div',
              { style: S.splitCanvas },
              h('img', {
                src: imageUrl(original, 2048),
                alt: '',
                draggable: false,
                style: { ...S.splitImage, ...transformed, opacity: natural && frame.width > 0 ? 1 : 0 },
                onLoad: onOriginalLoad,
              }),
            ),
            h('span', { style: { ...S.label, left: 8 } }, t('pdp.before')),
          ),
          h(
            'div',
            { style: S.splitPane },
            final
              ? h(
                  'div',
                  { style: S.splitCanvas },
                  h('img', {
                    src: imageUrl(final, 2048),
                    alt: '',
                    draggable: false,
                    style: { ...S.splitImage, ...transformed, opacity: natural && frame.width > 0 ? 1 : 0 },
                  }),
                )
              : h(
                  'div',
                  { style: S.noFinal },
                  h('span', { style: S.title }, t('pdp.noFinal')),
                  h('span', { style: S.muted }, t(generated ? 'pdp.noFinal.regenerate' : 'pdp.noFinal.body')),
                ),
            final ? h('span', { style: { ...S.label, right: 8 } }, t('pdp.after')) : null,
          ),
          controls,
        )
      }

      const stageStyle = full
        ? { ...S.stage, height: '100%', minHeight: 0, border: 0, borderRadius: 0 }
        : fill
          ? { ...S.stage, height: '100%', minHeight: 0 }
          : S.stage

      return h(
        'div',
        {
          ref: frameRef,
          style: stageStyle,
          'data-styling-stage': 'yes',
          'data-styling-stage-scale': String(scale),
          onWheel,
          onPointerDown,
          onPointerMove,
          onPointerUp,
          onPointerLeave: onPointerUp,
        },
        h(
          'div',
          { style: S.stageCanvas },
          h('img', {
            src: imageUrl(original, 2048),
            alt: '',
            draggable: false,
            style: { ...S.stageImage, ...transformed, opacity: natural && frame.width > 0 ? 1 : 0 },
            onLoad: onOriginalLoad,
          }),
          final
            ? h(
                'div',
                { style: { ...S.wipeLayer, clipPath: 'inset(0 0 0 ' + (wipe * 100).toFixed(3) + '%)' }, 'data-styling-wipe-layer': 'yes' },
                h('img', {
                  src: imageUrl(final, 2048),
                  alt: '',
                  draggable: false,
                  style: { ...S.stageImage, ...transformed, opacity: natural && frame.width > 0 ? 1 : 0 },
                }),
              )
            : null,
        ),
        h('span', { style: { ...S.label, left: 8 } }, t('pdp.before')),
        final ? h('span', { style: { ...S.label, right: 8 } }, t('pdp.after')) : null,
        final
          ? h(
              'button',
              {
                type: 'button',
                'data-wipe-handle': 'yes',
                role: 'slider',
                'aria-label': t('pdp.wipe'),
                'aria-valuemin': 0,
                'aria-valuemax': 100,
                'aria-valuenow': Math.round(wipe * 100),
                tabIndex: 0,
                onPointerDown: onWipePointerDown,
                onKeyDown: onWipeKey,
                style: { ...S.wipeHandle, left: 'calc(' + (wipe * 100).toFixed(3) + '% - 1px)' },
              },
              h('span', { style: S.wipeGrip }, h(IconChevronLeft, { size: 10 }), h(IconChevronRight, { size: 10 })),
            )
          : null,
        controls,
        !final
          ? h(
              'div',
              { style: S.noFinal },
              h(IconSparkle, { size: 18 }),
              h('span', { style: S.title }, t('pdp.noFinal')),
              h('span', { style: S.body }, t(generated ? 'pdp.noFinal.regenerate' : 'pdp.noFinal.body')),
            )
          : null,
      )
    }

    // ── the PLP ────────────────────────────────────────────────────────────────
    function LookCard({ look, t, onOpen }) {
      const approvedViews = Number.isFinite(look.approvedViews) ? look.approvedViews : 0
      const viewCount = Number.isFinite(look.viewCount) ? look.viewCount : 4
      const complete = viewCount > 0 && approvedViews === viewCount
      const cover = look.coverFinal || look.coverOriginal
      return h(
        'div',
        {
          role: 'button',
          tabIndex: 0,
          style: { ...S.card, ...(look.approved ? S.cardOn : null) },
          'data-styling-card': look.id,
          'aria-label': look.name + ' · ' + replace(t('plp.viewProgress'), { approved: approvedViews, total: viewCount }),
          onClick: () => onOpen(look.id),
          onKeyDown: (event) => {
            if (!event || event.target !== event.currentTarget) return
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              onOpen(look.id)
            }
          },
        },
        h(
          'div',
          { style: S.thumb },
          cover
            ? h('img', { src: imageUrl(cover, 640), alt: '', style: S.thumbImage, loading: 'lazy', draggable: false })
            : h('div', { style: S.thumbEmpty }, h(IconLayers, { size: 20 })),
        ),
        h(
          'div',
          { style: S.cardText },
          h('span', { style: S.cardName, title: look.name }, look.name),
          h(
            'div',
            { style: S.cardMeta },
            h(
              'span',
              { style: { ...S.status, ...(look.approved ? S.statusOn : null) } },
              h('span', { style: S.dot }),
              approvedViews > 0
                ? replace(t('plp.approvedCount'), { approved: approvedViews, total: viewCount })
                : look.coverFinal
                  ? t('plp.toStyle')
                  : t('plp.noFinal'),
              complete ? h(IconCheck, { size: 12, 'aria-hidden': 'true' }) : null,
            ),
          ),
        ),
      )
    }

    function QueueDialog({ t, open, looks, queued, generated, includeApproved, setIncludeApproved, scope, setScope, pick, setPick, onClose, onQueue, busy }) {
      const cardRef = useRef(null)
      const closeRef = useRef(null)
      const previousRef = useRef(null)
      const onCloseRef = useRef(onClose)
      onCloseRef.current = onClose
      useEffect(() => {
        if (!open) return undefined
        previousRef.current = typeof document !== 'undefined' ? document.activeElement : null
        const body = typeof document !== 'undefined' ? document.body : null
        const prior = body ? body.style.overflow : ''
        if (body) body.style.overflow = 'hidden'
        const timer = setTimeout(() => {
          if (closeRef.current && typeof closeRef.current.focus === 'function') closeRef.current.focus()
        }, 0)
        const key = (event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            onCloseRef.current()
            return
          }
          if (event.key !== 'Tab' || !cardRef.current) return
          const nodes = cardRef.current.querySelectorAll(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
          )
          if (nodes.length === 0) return
          const first = nodes[0]
          const last = nodes[nodes.length - 1]
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault()
            last.focus()
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault()
            first.focus()
          }
        }
        document.addEventListener('keydown', key)
        return () => {
          clearTimeout(timer)
          document.removeEventListener('keydown', key)
          if (body) body.style.overflow = prior
          const previous = previousRef.current
          if (previous && typeof previous.focus === 'function') previous.focus()
        }
      }, [open])
      if (!open) return null
      const none = looks.length === 0
      const title = t(generated ? 'queue.regenerateTitle' : 'queue.generateTitle')
      const picked = looks.find((look) => look.id === pick) || null
      const pickedGenerated = Boolean(
        picked &&
          ((Array.isArray(picked.finals) && picked.finals.length > 0) ||
            (Array.isArray(picked.runs) && picked.runs.length > 0)),
      )
      const nextLook = queued[0] || null
      const allCount = queued.length
      const canGo = scope === 'all' ? allCount > 0 : scope === 'next' ? Boolean(nextLook) : Boolean(pick)
      const dialog = h(
        'div',
        {
          style: S.queueOverlay,
          'data-styling-overlay': 'queue',
          onMouseDown: (event) => {
            if (event.target === event.currentTarget) onClose()
          },
        },
        h(
          'div',
          {
            ref: cardRef,
            role: 'dialog',
            'aria-modal': 'true',
            'aria-labelledby': 'styling-queue-title',
            style: S.queueCard,
            'data-styling-dialog': 'queue',
          },
          h(
            'div',
            { style: S.queueHead },
            h('span', { id: 'styling-queue-title', style: S.queueTitle }, title),
            h(
              'button',
              { ref: closeRef, type: 'button', style: S.queueClose, 'data-styling-button': 'queue-close', onClick: onClose, 'aria-label': t('queue.close') },
              h(IconClose, { size: 15 }),
            ),
          ),
          h('p', { style: S.queueBody }, t('queue.body')),
          h(
            'div',
            { style: { ...S.queueSwitchRow, justifyContent: 'flex-start' } },
            h(Switch, {
              checked: includeApproved === true,
              label: t('plp.regenerateApproved'),
              hint: t('plp.regenerateApprovedHint'),
              dataName: 'dialog-include-approved',
              onChange: setIncludeApproved,
            }),
          ),
          none
            ? h('p', { style: S.queueNote }, t('queue.noLooks'))
            : h(
                'div',
                { role: 'radiogroup', 'aria-label': title, style: S.queueOptions },
                h(
                  'button',
                  {
                    type: 'button',
                    role: 'radio',
                    'aria-checked': scope === 'all',
                    'data-styling-scope': 'all',
                    style: { ...S.queueOption, ...(scope === 'all' ? S.queueOptionOn : null) },
                    onClick: () => setScope('all'),
                  },
                  h('span', { style: { ...S.queueRadio, ...(scope === 'all' ? S.queueRadioOn : null) } }),
                  h(
                    'span',
                    { style: { display: 'flex', flexDirection: 'column', minWidth: 0 } },
                    h('span', { style: S.queueOptionTitle }, t('queue.all')),
                    h(
                      'span',
                      { style: S.queueOptionHint },
                      allCount > 0 ? replace(t('queue.allHint'), { n: allCount }) : t('queue.none'),
                    ),
                  ),
                ),
                h(
                  'button',
                  {
                    type: 'button',
                    role: 'radio',
                    'aria-checked': scope === 'next',
                    'data-styling-scope': 'next',
                    style: { ...S.queueOption, ...(scope === 'next' ? S.queueOptionOn : null) },
                    onClick: () => setScope('next'),
                  },
                  h('span', { style: { ...S.queueRadio, ...(scope === 'next' ? S.queueRadioOn : null) } }),
                  h(
                    'span',
                    { style: { display: 'flex', flexDirection: 'column', minWidth: 0 } },
                    h('span', { style: S.queueOptionTitle }, t('queue.one')),
                    h(
                      'span',
                      { style: S.queueOptionHint },
                      nextLook ? replace(t('queue.oneHint'), { name: nextLook.name }) : t('queue.none'),
                    ),
                  ),
                ),
                h(
                  'button',
                  {
                    type: 'button',
                    role: 'radio',
                    'aria-checked': scope === 'one',
                    'data-styling-scope': 'one',
                    style: { ...S.queueOption, ...(scope === 'one' ? S.queueOptionOn : null) },
                    onClick: () => setScope('one'),
                  },
                  h('span', { style: { ...S.queueRadio, ...(scope === 'one' ? S.queueRadioOn : null) } }),
                  h(
                    'span',
                    { style: { display: 'flex', flexDirection: 'column', minWidth: 0 } },
                    h('span', { style: S.queueOptionTitle }, t('queue.only')),
                    h('span', { style: S.queueOptionHint }, t('queue.onlyHint')),
                  ),
                ),
              ),
          none || scope !== 'one'
            ? null
            : h(
                'label',
                { style: S.queueSelectWrap },
                h('span', { style: S.queueSelectLabel }, t('queue.pick')),
                h(
                  'select',
                  {
                    value: pick || '',
                    'data-styling-select': 'queue-look',
                    'aria-label': t('queue.pick'),
                    style: S.queueSelect,
                    onChange: (event) => setPick(event.target.value),
                  },
                  looks.map((look) =>
                    h(
                      'option',
                      { key: look.id, value: look.id },
                      look.name +
                        ' · ' +
                        String(look.approvedViews || 0) +
                        '/' +
                        String(look.viewCount || 4) +
                        (look.approved ? '' : ' · ' + t('plp.toStyle')),
                    ),
                  ),
                ),
              ),
          h('p', { style: S.queueNote }, t('queue.note')),
          h(
            'div',
            { style: S.queueFoot },
            h('button', { type: 'button', style: S.queueCancel, 'data-styling-button': 'queue-cancel', onClick: onClose, disabled: busy }, t('queue.cancel')),
            h(
              'button',
              {
                type: 'button',
                style: S.queueGo,
                'data-styling-button': 'queue-go',
                onClick: onQueue,
                disabled: busy || none || !canGo,
              },
              scope === 'one'
                ? pickedGenerated
                  ? t('queue.queueOnly')
                  : t('queue.generateOnly')
                : scope === 'next'
                  ? t('queue.queueOne')
                  : replace(t('queue.queueAll'), { n: allCount }),
            ),
          ),
        ),
      )
      if (ReactDOM && typeof ReactDOM.createPortal === 'function' && typeof document !== 'undefined') {
        return ReactDOM.createPortal(dialog, document.body)
      }
      return dialog
    }

    function StartPage(props) {
      const { t, data, busy, phase, error, typed, setTyped, onAdd, onChoose, onRetry, onRefresh, onReveal, includeApproved, setIncludeApproved, onQueue, onOpen, notice } = props
      const looks = (data && data.looks) || []
      const counts = (data && data.counts) || { total: 0, approved: 0, toStyle: 0, withFinal: 0, noFinal: 0 }
      const allLooks = [...looks].sort((a, b) => a.num - b.num)
      const queueLooks = allLooks.filter((look) => includeApproved || !look.approved)
      const queueCount = queueLooks.length
      const queueGenerated = queueLooks.some(
        (look) =>
          (Array.isArray(look.finals) && look.finals.length > 0) ||
          (Array.isArray(look.runs) && look.runs.length > 0),
      )
      const [queueOpen, setQueueOpen] = useState(false)
      const [queueScope, setQueueScope] = useState('all')
      const [queuePick, setQueuePick] = useState(null)
      const canChoose = Boolean(data && data.canChoose)
      const openQueue = () => {
        setQueueScope('all')
        setQueuePick(queueLooks[0] ? queueLooks[0].id : allLooks[0] ? allLooks[0].id : null)
        setQueueOpen(true)
      }
      const closeQueue = () => setQueueOpen(false)
      const queueAndClose = async () => {
        let ids = null
        if (queueScope === 'next') {
          if (queueLooks.length === 0) return
          ids = [queueLooks[0].id]
        } else if (queueScope === 'one') {
          if (!queuePick) return
          ids = [queuePick]
        }
        const job = await onQueue(ids)
        if (job) setQueueOpen(false)
      }
      useEffect(() => {
        if (!queueOpen) return
        if (!allLooks.some((look) => look.id === queuePick)) setQueuePick(allLooks[0] ? allLooks[0].id : null)
      }, [queueOpen, includeApproved, data])

      const addControl = h(
        'span',
        { style: { display: 'inline-flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' } },
        h(
          PaneButton,
          {
            kind: 'primary',
            onClick: () => (canChoose ? onChoose() : onAdd(typed)),
            disabled: busy,
            dataName: 'add-folder',
          },
          h(IconPlus, { size: 14 }),
          busy ? t('pane.adding') : t('pane.add'),
        ),
      )

      if (phase === 'loading') {
        return h(
          'div',
          { style: { ...S.pane, overflow: 'auto' }, 'data-styling-pane': 'loading' },
          h('div', { style: S.head }, h('span', { style: S.brand }, h('span', { style: S.brandGlyph }, h(IconShirt, { size: 16 })), h('span', { style: S.title }, t('type.label')))),
          h('div', { style: S.centre }, h('span', { style: S.muted }, t('pane.loading'))),
        )
      }

      if (phase === 'error') {
        return h(
          'div',
          { style: { ...S.pane, overflow: 'auto' }, 'data-styling-pane': 'error' },
          h('div', { style: S.head }, h('span', { style: S.title }, t('type.label'))),
          h(
            'div',
            { style: S.centre },
            h('span', { style: S.title }, t('pane.error')),
            h('span', { style: S.body }, t('pane.error.body')),
            h('span', { style: S.error }, String(error || '')),
            h(PaneButton, { onClick: onRetry }, t('pane.retry')),
          ),
        )
      }

      if (!data || !data.root) {
        return h(
          'div',
          { style: { ...S.pane, overflow: 'auto' }, 'data-styling-pane': 'empty' },
          h('div', { style: S.head }, h('span', { style: S.brand }, h('span', { style: S.brandGlyph }, h(IconShirt, { size: 16 })), h('span', { style: S.title }, t('type.label')))),
          h(
            'div',
            { style: S.centre },
            h('span', { style: S.glyph }, h(IconFolder, { size: 24 })),
            h('span', { style: S.title }, t('pane.empty.title')),
            h('span', { style: S.body }, t('pane.empty.body')),
            addControl,
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
                    onKeyDown: (event) => {
                      if (event && event.key === 'Enter') onAdd(typed)
                    },
                  }),
                  h('span', { style: S.muted }, t('pane.path.hint')),
                ),
            error ? h('span', { style: S.error }, String(error)) : null,
          ),
        )
      }

      return h(
        'div',
        { style: S.pane, 'data-styling-pane': 'plp' },
        h(
          'div',
          { style: S.top },
          h(
            'div',
            { style: S.head },
            h('span', { style: S.brand }, h('span', { style: S.brandGlyph }, h(IconShirt, { size: 16 })), h('span', { style: S.title }, t('type.label'))),
            h(
              'span',
              { style: { display: 'inline-flex', gap: 4, alignItems: 'center' } },
              h('button', { type: 'button', style: S.iconButton, title: t('pane.reveal'), onClick: onReveal }, h(IconFolder, { size: 14 })),
              h('button', { type: 'button', style: S.iconButton, title: t('pane.refresh'), onClick: onRefresh, disabled: busy }, h(IconRefresh, { size: 14 })),
            ),
          ),
          h('div', { style: S.rootRow }, h('span', { style: S.root, title: data.root }, data.root)),
          h(
            'div',
            { style: S.stats },
            h('span', { style: S.statStrong }, replace(t('pane.summary'), { n: counts.total })),
            h('span', { style: S.muted }, replace(t('pane.summary.filtered'), { approved: counts.approved, toStyle: counts.toStyle })),
            counts.noFinal > 0 ? h('span', { style: S.muted }, replace(t('pane.noFinal'), { n: counts.noFinal })) : null,
          ),
          h(
            'div',
            { style: S.bar },
            h(
              PaneButton,
              {
                kind: 'primary',
                disabled: busy || allLooks.length === 0,
                onClick: openQueue,
                dataName: 'regenerate',
                title:
                  queueCount === 0
                    ? t('plp.noneQueued')
                    : (queueGenerated ? t('plp.regenerate') : t('plp.generate')).replace('{n}', String(queueCount)),
              },
              h(IconSparkle, { size: 14 }),
              busy
                ? t('plp.regenerating')
                : queueGenerated
                  ? replace(t('plp.regenerate'), { n: queueCount })
                  : replace(t('plp.generate'), { n: queueCount }),
            ),
            h(Switch, {
              checked: includeApproved === true,
              label: t('plp.regenerateApproved'),
              hint: t('plp.regenerateApprovedHint'),
              dataName: 'include-approved',
              onChange: setIncludeApproved,
            }),
          ),
          notice ? h('div', { style: S.notice }, notice) : null,
          data.job && data.job.status === 'queued' && data.job.count > 0
            ? h('div', { style: S.notice }, replace(t('plp.queued'), { n: data.job.count }) + ' · ' + String(data.job.looks || []).split(',').slice(0, 8).join(', '))
            : null,
        ),
        h(
          'div',
          { style: S.scroll },
          looks.length === 0
            ? h('div', { style: S.centre }, h('span', { style: S.body }, t('pane.empty.body')), addControl)
            : h(
                'div',
                { style: S.grid },
                looks.map((look) =>
                  h(LookCard, {
                    key: look.id,
                    look,
                    t,
                    onOpen,
                  }),
                ),
              ),
        ),
        h(QueueDialog, {
          t,
          open: queueOpen,
          looks: allLooks,
          queued: queueLooks,
          generated: queueGenerated,
          includeApproved,
          setIncludeApproved,
          scope: queueScope,
          setScope: setQueueScope,
          pick: queuePick,
          setPick: setQueuePick,
          onClose: closeQueue,
          onQueue: queueAndClose,
          busy,
        }),
      )
    }

    // ── the PDP ────────────────────────────────────────────────────────────────
    function ProductPage(props) {
      const { t, look, phase, error, onBack, onApprove, onRegenerate, onRename, busy, notice } = props
      const [viewIndex, setViewIndex] = useState(0)
      const [wipe, setWipe] = useState(0.5)
      const [mode, setMode] = useState(() => readStored('styling:mode', 'wipe'))
      const [name, setName] = useState(look ? look.name : '')

      useEffect(() => {
        if (look) setName(look.name)
      }, [look && look.id, look && look.name])

      useEffect(() => {
        store('styling:mode', mode)
      }, [mode])

      const [fullscreen, setFullscreen] = useState(false)
      const overlayRef = useRef(null)
      const closeRef = useRef(null)
      const fullscreenButtonRef = useRef(null)
      const wasFullscreen = useRef(false)

      useEffect(() => {
        if (!fullscreen) {
          if (wasFullscreen.current) {
            wasFullscreen.current = false
            if (fullscreenButtonRef.current) fullscreenButtonRef.current.focus()
          }
          return () => {}
        }
        wasFullscreen.current = true
        const node = overlayRef.current
        if (node && typeof node.requestFullscreen === 'function') {
          node.requestFullscreen().catch(() => {})
        }
        const body = document.body
        const previous = body.style.overflow
        body.style.overflow = 'hidden'
        const onChange = () => {
          if (!document.fullscreenElement) setFullscreen(false)
        }
        document.addEventListener('fullscreenchange', onChange)
        const timer = setTimeout(() => {
          if (closeRef.current) closeRef.current.focus()
        }, 50)
        return () => {
          clearTimeout(timer)
          document.removeEventListener('fullscreenchange', onChange)
          body.style.overflow = previous
          if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => {})
          }
        }
      }, [fullscreen])

      if (phase === 'loading') {
        return h(
          'div',
          { style: { ...S.pane, overflow: 'auto' }, 'data-styling-pane': 'pdp-loading' },
          h('div', { style: S.pdpHead }, h('button', { type: 'button', style: S.buttonQuiet, onClick: onBack }, h(IconBack, { size: 14 }), t('pdp.back'))),
          h('div', { style: S.centre }, h('span', { style: S.muted }, t('pdp.loading'))),
        )
      }

      if (phase === 'error' || !look) {
        return h(
          'div',
          { style: { ...S.pane, overflow: 'auto' }, 'data-styling-pane': 'pdp-error' },
          h('div', { style: S.pdpHead }, h('button', { type: 'button', style: S.buttonQuiet, onClick: onBack }, h(IconBack, { size: 14 }), t('pdp.back'))),
          h('div', { style: S.centre }, h('span', { style: S.title }, t('pdp.gone')), h('span', { style: S.error }, String(error || ''))),
        )
      }

      const views = Array.isArray(look.views) && look.views.length > 0 ? look.views : [{ original: look.coverOriginal, final: look.coverFinal }]
      const index = Math.min(viewIndex, views.length - 1)
      const pair = views[index] || { original: look.coverOriginal, final: look.coverFinal }
      const hasFinal = Boolean(look.coverFinal)
      const viewApprovals = Array.isArray(look.viewApprovals) ? look.viewApprovals : []
      const viewApproved = viewApprovals[index] === true
      const viewGenerated =
        Boolean(pair.final) ||
        (Array.isArray(look.runs) &&
          look.runs.some((run) => run && (run.viewIndex === index || (pair.view && run.view === pair.view))))

      const modeControl = () =>
        h(
          'button',
          {
            type: 'button',
            style: S.modeButton,
            title: mode === 'wipe' ? t('pdp.split') : t('pdp.wipe'),
            'data-styling-button': 'mode',
            onClick: () => setMode(mode === 'wipe' ? 'split' : 'wipe'),
          },
          h(mode === 'wipe' ? IconLayers : IconSplit, { size: 13 }),
          h('span', null, mode === 'wipe' ? t('pdp.split') : t('pdp.wipe')),
        )

      const onOverlayKey = (event) => {
        if (!event) return
        if (event.key === 'Escape') {
          event.stopPropagation()
          setFullscreen(false)
          return
        }
        if (event.key !== 'Tab') return
        const root = overlayRef.current
        if (!root) return
        const nodes = Array.from(root.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')).filter(
          (node) => !node.disabled && node.offsetParent !== null,
        )
        if (nodes.length === 0) return
        const first = nodes[0]
        const last = nodes[nodes.length - 1]
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }

      const mainPane = h(
        'div',
        { style: S.pane, 'data-styling-pane': 'pdp' },
        h(
          'div',
          { style: S.pdpTop },
          h(
            'div',
            { style: S.pdpHead },
            h('button', { type: 'button', style: S.buttonQuiet, onClick: onBack }, h(IconBack, { size: 14 }), t('pdp.back')),
            h('input', {
              style: { ...S.nameInput, flex: '1 1 auto', minWidth: 0 },
              value: name,
              'aria-label': t('pdp.name'),
              placeholder: t('pdp.namePlaceholder'),
              onChange: (event) => setName(event.target.value),
              onBlur: () => {
                if (name.trim() !== '' && name.trim() !== look.name) onRename(look.id, name.trim())
              },
              onKeyDown: (event) => {
                if (event && event.key === 'Enter') event.currentTarget.blur()
              },
            }),
            h(
              'span',
              { style: { display: 'inline-flex', gap: 4, alignItems: 'center', flex: '0 0 auto' } },
              modeControl(),
              h(
                'button',
                {
                  ref: fullscreenButtonRef,
                  type: 'button',
                  style: S.buttonQuiet,
                  title: t('pdp.fullscreenHint'),
                  'aria-label': t('pdp.fullscreen'),
                  'data-styling-button': 'pdp-fullscreen',
                  onClick: () => setFullscreen(true),
                },
                h(IconExpand, { size: 13 }),
              ),
            ),
          ),
          h(
            'div',
            { style: S.strip, 'data-styling-strip': 'yes' },
            views.map((view, i) =>
              h(
                'button',
                {
                  key: 'view-' + i,
                  type: 'button',
                  title: replace(t('pdp.view'), { n: i + 1, total: views.length }) + (view.view ? ' · ' + view.view : ''),
                  'aria-label': replace(t('pdp.view'), { n: i + 1, total: views.length }) + (view.view ? ' · ' + view.view : ''),
                  'aria-pressed': i === index ? 'true' : 'false',
                  style: { ...S.stripItem, ...(i === index ? S.stripOn : null) },
                  onClick: () => {
                    setViewIndex(i)
                    setWipe(0.5)
                  },
                },
                h('img', { src: imageUrl(view.original, 320), alt: '', style: S.stripImage, loading: 'lazy', draggable: false }),
                viewApprovals[i] === true
                  ? h(IconCheck, { size: 13, style: S.stripCheck, 'aria-hidden': 'true' })
                  : view.final
                    ? h('span', { style: S.stripDot })
                    : null,
              ),
            ),
          ),
        ),
        h(
          'div',
          { style: S.stageWrap, 'data-styling-stage-wrap': 'yes' },
          h(WipeStage, {
            original: pair.original,
            final: pair.final,
            wipe,
            setWipe,
            mode,
            t,
            fill: true,
            fullscreen: false,
            onFullscreen: () => setFullscreen(true),
            generated: viewGenerated,
          }),
        ),
        h(
          'div',
          { style: S.pdpActions },
          h(Switch, {
            checked: viewApproved,
            label: viewApproved ? t('pdp.approvedView') : t('pdp.approveView'),
            hint: t('pdp.approveViewHint'),
            disabled: busy || !pair.final,
            dataName: 'pdp-approve-view',
            onChange: (next) => onApprove(look.id, index, next),
          }),
          h(
            PaneButton,
            {
              kind: 'primary',
              onClick: () => onRegenerate(look.id, index),
              disabled: busy,
              dataName: 'pdp-regenerate',
            },
            h(IconSparkle, { size: 14 }),
            t(viewGenerated ? 'pdp.regenerate' : 'pdp.generate'),
          ),
        ),
        h(
          'div',
          { style: S.pdpMeta },
          hasFinal ? h('span', { style: S.muted }, pair.view ? replace(t('pdp.viewName'), { n: index + 1, total: views.length, view: pair.view }) : replace(t('pdp.view'), { n: index + 1, total: views.length })) : h('span', { style: S.muted }, t('pdp.noFinal')),
          look.runs && look.runs.length > 0
            ? h('span', { style: S.muted }, replace(t('pdp.lastRun'), { when: when(look.runs[look.runs.length - 1].at) }))
            : h('span', { style: S.muted }, t('pdp.noRuns')),
          notice ? h('span', { style: S.notice }, notice) : null,
        ),
      )

      const overlay = fullscreen
        ? h(
            'div',
            {
              ref: overlayRef,
              role: 'dialog',
              'aria-modal': 'true',
              'aria-label': look.name + ' — ' + t('pdp.inspect'),
              tabIndex: -1,
              style: S.fsOverlay,
              onKeyDown: onOverlayKey,
              'data-styling-fullscreen': 'yes',
            },
            h(
              'div',
              { style: S.fsHead },
              h(
                'button',
                {
                  ref: closeRef,
                  type: 'button',
                  style: S.iconButton,
                  title: t('pdp.exitFullscreen'),
                  'aria-label': t('pdp.exitFullscreen'),
                  'data-styling-button': 'fs-close',
                  onClick: () => setFullscreen(false),
                },
                h(IconClose, { size: 15 }),
              ),
              h('span', { style: S.fsTitle }, look.name),
              h('span', { style: S.muted }, pair.view ? replace(t('pdp.viewName'), { n: index + 1, total: views.length, view: pair.view }) : replace(t('pdp.view'), { n: index + 1, total: views.length })),
              h('span', { style: { flex: '1 1 auto' } }),
              modeControl(),
            ),
            h(
              'div',
              { style: S.fsStrip, 'data-styling-fullscreen-strip': 'yes' },
              views.map((view, i) =>
                h(
                  'button',
                  {
                    key: 'fs-view-' + i,
                    type: 'button',
                    title: replace(t('pdp.view'), { n: i + 1, total: views.length }) + (view.view ? ' · ' + view.view : ''),
                    'aria-label': replace(t('pdp.view'), { n: i + 1, total: views.length }) + (view.view ? ' · ' + view.view : ''),
                    'aria-pressed': i === index ? 'true' : 'false',
                    style: { ...S.fsStripItem, ...(i === index ? S.fsStripOn : null) },
                    onClick: () => {
                      setViewIndex(i)
                      setWipe(0.5)
                    },
                  },
                  h('img', { src: imageUrl(view.original, 320), alt: '', style: S.stripImage, loading: 'lazy', draggable: false }),
                  viewApprovals[i] === true
                    ? h(IconCheck, { size: 14, style: S.stripCheck, 'aria-hidden': 'true' })
                    : view.final
                      ? h('span', { style: S.stripDot })
                      : null,
                ),
              ),
            ),
            h(
              'div',
              { style: S.fsStage, 'data-styling-fullscreen-stage': 'yes' },
              h(WipeStage, {
                original: pair.original,
                final: pair.final,
                wipe,
                setWipe,
                mode,
                t,
                full: true,
                fill: true,
                fullscreen: true,
                onFullscreen: () => setFullscreen(false),
                generated: viewGenerated,
              }),
            ),
            h(
              'div',
              { style: S.fsFoot },
              h(Switch, {
                checked: viewApproved,
                label: viewApproved ? t('pdp.approvedView') : t('pdp.approveView'),
                hint: t('pdp.approveViewHint'),
                disabled: busy || !pair.final,
                dataName: 'fs-approve-view',
                onChange: (next) => onApprove(look.id, index, next),
              }),
              h(
                PaneButton,
                {
                  kind: 'primary',
                  onClick: () => onRegenerate(look.id, index),
                  disabled: busy,
                  dataName: 'fs-regenerate',
                },
                h(IconSparkle, { size: 14 }),
                t(viewGenerated ? 'pdp.regenerate' : 'pdp.generate'),
              ),
              h('span', { style: S.muted }, hasFinal ? pair.view ? replace(t('pdp.viewName'), { n: index + 1, total: views.length, view: pair.view }) : replace(t('pdp.view'), { n: index + 1, total: views.length }) : t('pdp.noFinal')),
              notice ? h('span', { style: S.notice }, notice) : null,
            ),
          )
        : null

      return h(
        React.Fragment,
        null,
        mainPane,
        overlay && ReactDOM && typeof ReactDOM.createPortal === 'function' && typeof document !== 'undefined'
          ? ReactDOM.createPortal(overlay, document.body)
          : overlay,
      )
    }

    // ── the pane ───────────────────────────────────────────────────────────────
    function StylingPane(props) {
      const t = translatorOf(props)
      const [phase, setPhase] = useState('loading')
      const [data, setData] = useState(null)
      const [error, setError] = useState(null)
      const [busy, setBusy] = useState(false)
      const [typed, setTyped] = useState('')
      const [notice, setNotice] = useState(null)
      const [screen, setScreen] = useState('plp')
      const [selectedId, setSelectedId] = useState(null)
      const [detail, setDetail] = useState(null)
      const [detailPhase, setDetailPhase] = useState('idle')
      const [detailError, setDetailError] = useState(null)
      const [includeApproved, setIncludeApprovedState] = useState(() => readStored('styling:include-approved', '0') === '1')

      const setIncludeApproved = useCallback((next) => {
        setIncludeApprovedState(next)
        store('styling:include-approved', next ? '1' : '0')
      }, [])

      const load = useCallback(async () => {
        setPhase((current) => (current === 'ready' ? 'ready' : 'loading'))
        setError(null)
        try {
          const next = await getJson(STATE_URL)
          setData(next)
          setPhase('ready')
        } catch (err) {
          setError(String((err && err.message) || err))
          setPhase('error')
        }
      }, [])

      useEffect(() => {
        load()
      }, [load])

      const openLook = useCallback(async (id) => {
        setSelectedId(id)
        setScreen('pdp')
        setDetailPhase('loading')
        setDetailError(null)
        setDetail(null)
        try {
          const next = await getJson(DETAIL_URL + '?id=' + encodeURIComponent(id))
          setDetail(next.look)
          setDetailPhase('ready')
        } catch (err) {
          setDetailError(String((err && err.message) || err))
          setDetailPhase('error')
        }
      }, [])

      const refreshDetail = useCallback(async (id) => {
        try {
          const next = await getJson(DETAIL_URL + '?id=' + encodeURIComponent(id))
          setDetail(next.look)
          setDetailPhase('ready')
        } catch {
          // the list can still be right
        }
      }, [])

      const approve = useCallback(
        async (id, view, approved) => {
          setBusy(true)
          setNotice(null)
          // optimistic on the open look: the strip check flips now, the host is truth
          setDetail((current) => {
            if (!current || current.id !== id) return current
            const approvals = Array.isArray(current.viewApprovals) ? current.viewApprovals.slice() : Array(current.viewCount || 4).fill(false)
            approvals[view] = approved
            const approvedViews = approvals.filter(Boolean).length
            return { ...current, viewApprovals: approvals, approvedViews, approved: approvedViews > 0 }
          })
          try {
            const next = await postJson(APPROVE_URL, { id, view, approved })
            setData(next)
            await refreshDetail(id)
          } catch (err) {
            setNotice(String((err && err.message) || err))
            await load()
          } finally {
            setBusy(false)
          }
        },
        [load, refreshDetail],
      )

      const rename = useCallback(
        async (id, name) => {
          try {
            const next = await postJson(NAME_URL, { id, name })
            setData(next)
            await refreshDetail(id)
          } catch (err) {
            setNotice(String((err && err.message) || err))
          }
        },
        [refreshDetail],
      )

      const addFolder = useCallback(
        async (path) => {
          setBusy(true)
          setNotice(null)
          try {
            const next = await postJson(FOLDER_URL, { action: 'add', path })
            setData(next)
            setPhase('ready')
          } catch (err) {
            setNotice(String((err && err.message) || err))
          } finally {
            setBusy(false)
          }
        },
        [],
      )

      const chooseFolder = useCallback(async () => {
        setBusy(true)
        setNotice(null)
        try {
          const next = await postJson(FOLDER_URL, { action: 'choose' })
          setData(next)
          setPhase('ready')
          if (next && next.cancelled) setNotice(null)
        } catch (err) {
          setNotice(String((err && err.message) || err))
        } finally {
          setBusy(false)
        }
      }, [])

      const probe = useCallback(async () => {
        setBusy(true)
        setNotice(null)
        try {
          const next = await postJson(PROBE_URL, {})
          setData(next)
          setPhase('ready')
        } catch (err) {
          setNotice(String((err && err.message) || err))
        } finally {
          setBusy(false)
        }
      }, [])

      const reveal = useCallback(async () => {
        try {
          await postJson(FOLDER_URL, { action: 'reveal' })
        } catch (err) {
          setNotice(String((err && err.message) || err))
        }
      }, [])

      const queue = useCallback(
        async (looks) => {
          setBusy(true)
          setNotice(null)
          try {
            const body = Array.isArray(looks) && looks.length > 0 ? { looks } : { includeApproved }
            const job = await postJson(REGENERATE_URL, body)
            setData((current) => (current ? { ...current, job } : current))
            setNotice(job.count === 0 ? t('plp.noneQueued') : replace(t('plp.queued'), { n: job.count }))
            return job
          } catch (err) {
            setNotice(String((err && err.message) || err))
            return null
          } finally {
            setBusy(false)
          }
        },
        [includeApproved, t],
      )

      const regenerateOne = useCallback(
        async (id, view) => {
          setBusy(true)
          setNotice(null)
          try {
            const job = await postJson(REGENERATE_URL, { looks: [id], view })
            setData((current) => (current ? { ...current, job } : current))
            setNotice(job.count === 0 ? t('plp.noneQueued') : t('pdp.queuedView'))
          } catch (err) {
            setNotice(String((err && err.message) || err))
          } finally {
            setBusy(false)
          }
        },
        [t],
      )

      if (screen === 'pdp') {
        return h(ProductPage, {
          t,
          look: detail,
          phase: detailPhase,
          error: detailError,
          busy,
          notice,
          onBack: () => {
            setScreen('plp')
            setSelectedId(null)
            setDetail(null)
            setDetailPhase('idle')
            setNotice(null)
            load()
          },
          onApprove: approve,
          onRegenerate: regenerateOne,
          onRename: rename,
        })
      }

      return h(StartPage, {
        t,
        data,
        phase,
        error,
        busy,
        typed,
        setTyped,
        includeApproved,
        setIncludeApproved,
        notice,
        onAdd: addFolder,
        onChoose: chooseFolder,
        onRetry: load,
        onRefresh: probe,
        onReveal: reveal,
        onQueue: queue,
        onOpen: openLook,
      })
    }

    function countLooks(looks) {
      let approved = 0
      let toStyle = 0
      let withFinal = 0
      for (const look of looks || []) {
        if (look.approved) approved += 1
        else toStyle += 1
        if (look.coverFinal) withFinal += 1
      }
      return { total: (looks || []).length, approved, toStyle, withFinal, noFinal: (looks || []).length - withFinal }
    }

    // ── the chip and the guide card ────────────────────────────────────────────
    function StylingTitle(props) {
      const t = props && props.locale ? props.locale.bind(NS) : translatorOf(props)
      return h(
        'span',
        { style: { display: 'inline-flex', alignItems: 'center', gap: 6 }, 'data-styling-chip': 'yes' },
        h(IconShirt, { size: 16, style: S.brandGlyph }),
        t('type.label'),
      )
    }

    function StylingGuideIcon() {
      return h(IconShirt, { size: 20 })
    }

    function stylingDefinition(t) {
      return {
        id: STYLING_ID,
        kind: STYLING_KIND,
        priority: 'extension',
        title: () => t('type.label'),
        guide: [
          {
            id: 'open',
            order: 47,
            title: () => t('guide.title'),
            description: () => t('guide.description'),
            icon: StylingGuideIcon,
          },
        ],
      }
    }

    const inject = ['slots', 'locale', 'sidebarRightTabs']

    function apply(ctx) {
      const t = ctx.locale.bind(NS)
      ctx.effect(() => {
        const style = document.createElement('style')
        style.textContent =
          '.dsh-styling-scroll { scrollbar-width: thin; }\n' +
          '.dsh-styling-scroll::-webkit-scrollbar { width: 10px; height: 10px; }\n' +
          '.dsh-styling-scroll::-webkit-scrollbar-thumb { background: var(--dsw-alias-border-l3); border-radius: 6px; border: 2px solid transparent; background-clip: padding-box; }\n' +
          '.dsh-styling-scroll::-webkit-scrollbar-track { background: transparent; }\n' +
          '[data-styling-card]:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 2px; }\n' +
          '[data-styling-button]:focus-visible, [data-styling-switch]:focus-visible, [data-wipe-handle]:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 1px; }\n' +
          '[data-styling-card]:hover { border-color: var(--dsw-alias-border-l3); }\n' +
          '[data-styling-button]:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover); }\n' +
          '@media (prefers-reduced-motion: reduce) { .dsh-styling-knob { transition: none; } }\n'
        document.head.appendChild(style)
        return () => {
          style.remove()
        }
      }, 'styling.style')
      ctx.effect(() => ctx.locale.register(NS, { en: EN, zh: ZH }), 'styling.copy')
      ctx.effect(() => ctx.sidebarRightTabs.register(stylingDefinition(t)), 'styling.type')
      ctx.effect(
        () =>
          ctx.slots.inject('sidebar.right.pane.tab', () =>
            ctx.slots.register({ name: 'sidebar.right.pane.tab', key: STYLING_ID, locale: NS }, StylingPane),
          ),
        'styling.body',
      )
      ctx.effect(
        () =>
          ctx.slots.inject('sidebar.right.pane.tab.title', () =>
            ctx.slots.register({ name: 'sidebar.right.pane.tab.title', key: STYLING_ID, locale: NS }, StylingTitle),
          ),
        'styling.title',
      )
    }

    return {
      inject,
      apply,
      copy: { EN, ZH },
      components: { StartPage, ProductPage, WipeStage, LookCard },
      zoom: { ZOOM_MIN, ZOOM_MAX, clampZoom, fitScale, fillScale, centreView: centreOffset, fitView, fillView, zoomAt, panBy, oneToOne },
    }
  },
})
