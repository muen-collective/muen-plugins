// @muen/dsh-studio — browser half (M1 shell).
//
// One `studio` tab: the project screen. It draws the pipeline nav (six stage
// cards, the method as the information architecture — design doc §1), the
// sequences of the open project, and a minimal shot list so the session
// round-trips through the host from day one. Stage screens land in later slices;
// their cards are here with honest statuses from session.stages.
//
// Registration follows the shipped path exactly — a tab TYPE through
// `sidebarRightTabs`, body and chip through `slots` — same as dsh-generate and
// dsh-socialgrab. The pane holds no state that the host does not own: every
// session it draws comes from GET /plugins/studio/…, so it can never show
// something that is not on disk.
//
// Loader format: one self-contained script registered via window.__ModuleLoader__.
window.__ModuleLoader__.load({
  id: '@muen/dsh-studio',
  factory: (require) => {
    const React = require('react')
    const primitives = require('@deepseek-ai/dsh-client-ui-primitives')
    const h = React.createElement

    const icon = (current, legacy) => primitives[current] ?? primitives[legacy]
    // The mark: the app's own sparkle, the same glyph the Generate tab wears —
    // the studio is the surface above Generate's engine, and the family reads.
    const IconSparkle = icon('IconSparkleRegular', 'IconSparkle16')
    const IconPlus = icon('IconPlusOutlineRegular', 'IconPlusOutline16')
    const IconCheck = icon('IconCheckOutlineRegular', 'IconCheckOutline16')
    const IconWarning = icon('IconWarningOutlineRegular', 'IconWarningOutline16')

    const PLUGIN_ID = '@muen/dsh-studio'
    const KIND = 'studio'
    const NS = 'studio'
    const BASE = '/plugins/studio'

    const STAGES = ['character', 'outfit', 'scene', 'script', 'shoot', 'timeline']

    const EN = {
      'type.label': 'Studio',
      'guide.title': 'Direct a video',
      'guide.description': 'Design, script, generate and cut — one pipeline, human gates',
      'project.title': 'Projects',
      'project.create': 'New project',
      'project.name': 'Project name',
      'project.id': 'Project id',
      'project.empty': 'No projects yet. Create one to start.',
      'sequence.title': 'Sequences',
      'sequence.create': 'New sequence',
      'sequence.id': 'Sequence id',
      'sequence.empty': 'No sequences yet.',
      'sequence.shots': 'Shots',
      'stage.character': 'Character',
      'stage.outfit': 'Outfit',
      'stage.scene': 'Scene',
      'stage.script': 'Script',
      'stage.shoot': 'Shoot',
      'stage.timeline': 'Timeline',
      'stage.empty': 'Empty',
      'stage.draft': 'Draft',
      'stage.gated': 'Approved',
      'shot.add': 'Add shot',
      'shot.beat': 'Beat',
      'shot.duration': 'Sec',
      'shot.empty': 'No shots yet.',
      'nav.back': '← Back',
      'char.title': 'Characters',
      'char.name': 'Name',
      'char.create': 'New character',
      'char.description': 'Describe the person — the Casting role drafts the bible',
      'char.draft': 'Draft with LLM',
      'char.approve': 'Approve & seal',
      'char.revise': 'Revise',
      'char.sealed': 'sealed',
      'char.photo': 'Add photo',
      'char.sheet': 'Generate sheet',
      'char.empty': 'Pick a character, or create one.',
      'char.run.composing': 'Composing…',
      'char.run.running': 'Generating…',
      'char.run.done': 'Done',
      'char.run.failed': 'Failed',
      'slot.overview': 'Overview',
      'slot.identity': 'Age / gender / face / build / skin',
      'slot.makeup': 'Makeup',
      'slot.hair': 'Hair',
      'slot.outfit': 'Outfit',
      'slot.pose': 'Pose',
      'slot.environment': 'Environment',
      'slot.photography': 'Photography & lighting',
      'record.name': 'Name',
      'record.character': 'Character id',
      'record.create': 'New record',
      'record.empty': 'Pick a record, or create one.',
      'record.approve': 'Approve',
      'record.revise': 'Revise',
      'record.sealed': 'sealed',
      'script.title': 'Script',
      'script.camera': 'Camera',
      'script.premise': 'Premise — the Script role writes the shots',
      'script.write': 'Write with LLM',
      'script.brief': 'Import brief (SEO/AEO JSON or plain text)',
      'script.import': 'Import brief',
      'script.approve': 'Approve script',
      'script.gated': 'Approved',
      'script.remove': '×',
      'script.total': 'Total',
      'script.empty': 'No shots yet.',
      'script.noseq': 'Create a sequence first.',
      'shoot.noShots': 'Write the script first — shots land here.',
      'shoot.character': 'Character',
      'shoot.look': 'Outfit',
      'shoot.scene': 'Scene',
      'shoot.prompt': 'The prompt — sealed identity and look are placed by the host',
      'shoot.compose': 'Write with LLM',
      'shoot.generate': 'Generate',
      'shoot.confirm': 'Confirm run',
      'shoot.confirmNote': 'Review the prompt, then confirm — this is the only step that spends.',
      'shoot.takes': 'Takes',
      'shoot.noTakes': 'No takes yet.',
      'shoot.select': 'Select',
      'run.composing': 'Composing…',
      'run.preflight': 'Preflight…',
      'run.running': 'Running…',
      'run.batch': 'Batch running…',
      'shoot.runAll': 'Run all ready shots',
      'shoot.batchConfirm': 'Confirm batch',
      'shoot.batchNote': 'Each ready shot runs in order. A failure marks that shot and the batch continues.',
      'shoot.status.running': 'running',
      'shoot.status.done': 'done',
      'shoot.status.failed': 'failed',
      'timeline.build': 'Build from selects',
      'timeline.undo': 'Undo',
      'timeline.total': 'Total',
      'timeline.split': 'Split',
      'timeline.delete': 'Delete',
      'timeline.empty': 'Build the first cut from the shoot selects.',
      'library.title': 'Library',
      'library.open': 'Library',
      'library.recall': 'Recall',
      'library.empty': 'Star a take to remember its recipe here.',
      'library.filterAll': 'All kinds',
      'library.rating': 'rating',
      'library.push': 'Push',
      'library.pull': 'Pull',
      'library.pushed': 'Pushed to your repo.',
      'library.pulled': 'Pulled from your repo.',
      'library.syncReady': 'GitHub sync ready.',
      'library.syncOff': 'Sync not configured — recipes stay local.',
      'export.edl': 'Export EDL',
      'export.mp4': 'Export MP4',
      'export.noffmpeg': 'MP4 export unavailable — ffmpeg not found on this machine.',
      'state.nohost': 'The studio host is not answering — reload the app.',
      'state.failed': 'That did not work',
    }
    const ZH = {
      'type.label': '工作室',
      'guide.title': '导演视频',
      'guide.description': '设计、编写脚本、生成和剪辑 — 一条流水线，人工把关',
      'project.title': '项目',
      'project.create': '新建项目',
      'project.name': '项目名称',
      'project.id': '项目 id',
      'project.empty': '还没有项目。',
      'sequence.title': '序列',
      'sequence.create': '新建序列',
      'sequence.id': '序列 id',
      'sequence.empty': '还没有序列。',
      'sequence.shots': '镜头',
      'stage.character': '角色',
      'stage.outfit': '服装',
      'stage.scene': '场景',
      'stage.script': '脚本',
      'stage.shoot': '拍摄',
      'stage.timeline': '时间线',
      'stage.empty': '空',
      'stage.draft': '草稿',
      'stage.gated': '已通过',
      'shot.add': '添加镜头',
      'shot.beat': '节拍',
      'shot.duration': '秒',
      'shot.empty': '还没有镜头。',
      'nav.back': '← 返回',
      'char.title': '角色',
      'char.name': '名称',
      'char.create': '新建角色',
      'char.description': '描述人物 — Casting 角色会起草圣经',
      'char.draft': 'LLM 起草',
      'char.approve': '批准并封存',
      'char.revise': '修订',
      'char.sealed': '已封存',
      'char.photo': '添加照片',
      'char.sheet': '生成设定图',
      'char.empty': '选择一个角色，或新建一个。',
      'char.run.composing': '生成中…',
      'char.run.running': '生成中…',
      'char.run.done': '完成',
      'char.run.failed': '失败',
      'slot.overview': '概述',
      'slot.identity': '年龄 / 性别 / 面部 / 体型 / 肤质',
      'slot.makeup': '妆容',
      'slot.hair': '发型',
      'slot.outfit': '服装',
      'slot.pose': '姿态',
      'slot.environment': '环境',
      'slot.photography': '摄影与灯光',
      'record.name': '名称',
      'record.character': '角色 ID',
      'record.create': '新建',
      'record.empty': '选择一条记录，或新建一个。',
      'record.approve': '批准',
      'record.revise': '修订',
      'record.sealed': '已封存',
      'script.title': '脚本',
      'script.camera': '运镜',
      'script.premise': '前提 — Script 角色会写出镜头',
      'script.write': 'LLM 编写',
      'script.brief': '导入简报（SEO/AEO JSON 或纯文本）',
      'script.import': '导入简报',
      'script.approve': '批准脚本',
      'script.gated': '已通过',
      'script.remove': '×',
      'script.total': '总计',
      'script.empty': '还没有镜头。',
      'script.noseq': '请先创建序列。',
      'shoot.noShots': '请先编写脚本 — 镜头会出现在这里。',
      'shoot.character': '角色',
      'shoot.look': '服装',
      'shoot.scene': '场景',
      'shoot.prompt': '提示词 — 封存的身份与造型由宿主写入',
      'shoot.compose': 'LLM 编写',
      'shoot.generate': '生成',
      'shoot.confirm': '确认运行',
      'shoot.confirmNote': '检查提示词后确认 — 这是唯一会花费的步骤。',
      'shoot.takes': '成片',
      'shoot.noTakes': '还没有成片。',
      'shoot.select': '选中',
      'run.composing': '生成中…',
      'run.preflight': '预检…',
      'run.running': '运行中…',
      'run.batch': '批处理运行中…',
      'shoot.runAll': '运行全部就绪镜头',
      'shoot.batchConfirm': '确认批处理',
      'shoot.batchNote': '每个就绪镜头按顺序运行。失败只标记该镜头，批处理继续。',
      'shoot.status.running': '运行中',
      'shoot.status.done': '完成',
      'shoot.status.failed': '失败',
      'timeline.build': '从选中构建',
      'timeline.undo': '撤销',
      'timeline.total': '总计',
      'timeline.split': '分割',
      'timeline.delete': '删除',
      'timeline.empty': '从拍摄选中构建初剪。',
      'library.title': '素材库',
      'library.open': '素材库',
      'library.recall': '召回',
      'library.empty': '为成片加星，配方会保存在这里。',
      'library.filterAll': '全部类型',
      'library.rating': '评分',
      'library.push': '推送',
      'library.pull': '拉取',
      'library.pushed': '已推送到你的仓库。',
      'library.pulled': '已从你的仓库拉取。',
      'library.syncReady': 'GitHub 同步就绪。',
      'library.syncOff': '未配置同步 — 配方仅保存在本地。',
      'export.edl': '导出 EDL',
      'export.mp4': '导出 MP4',
      'export.noffmpeg': '无法导出 MP4 — 本机未找到 ffmpeg。',
      'state.nohost': '工作室服务未响应 — 请重载应用。',
      'state.failed': '操作失败',
    }

    /** Small helpers — the kit's Button is for actions; these are structure. */
    const Card = ({ children }) =>
      h(
        'div',
        {
          style: {
            background: 'var(--dsw-alias-bg-layer-2)',
            border: '.5px solid var(--dsw-alias-border-l3)',
            borderRadius: 12,
            padding: 14,
          },
        },
        children,
      )

    const StageCard = ({ t, stage, onOpen }) =>
      h(
        'div',
        {
          'data-studio-stage': stage.key,
          onClick: onOpen,
          style: {
            background: 'var(--dsw-alias-bg-layer-2)',
            border: '.5px solid var(--dsw-alias-border-l3)',
            borderRadius: 12,
            padding: 12,
            minWidth: 120,
            flex: '1 1 0',
            cursor: onOpen ? 'pointer' : 'default',
          },
        },
        h('div', { style: { fontWeight: 600, fontSize: 13 } }, t('stage.' + stage.key)),
        h(
          'div',
          {
            'data-studio-stage-status': stage.status,
            style: { fontSize: 11, color: 'var(--dsw-alias-label-tertiary)', marginTop: 4 },
          },
          t('stage.' + stage.status),
        ),
      )

    /**
     * The recipe library (M10): browse what worked, star it, recall it. Rows
     * carry the FULL recipe — prompt, params, Look — because recall's promise is
     * a payload that matches what produced a known-good take.
     */
    function LibraryStage({ t, onRecall }) {
      const [state, setState] = React.useState({ recipes: [], error: null, sync: null, syncMsg: null })
      const [filter, setFilter] = React.useState({ kind: '', min: '0' })

      const load = async (next) => {
        try {
          const query = []
          if (next.kind) query.push('kind=' + encodeURIComponent(next.kind))
          if (next.min) query.push('min=' + encodeURIComponent(next.min))
          const body = await fetch(BASE + '/library' + (query.length ? '?' + query.join('&') : '')).then((r) => r.json())
          if (!body.ok) throw new Error(body.error || 'list')
          setState((prev) => ({ ...prev, recipes: body.recipes, error: null }))
        } catch (error) {
          setState((prev) => ({ ...prev, error: String((error && error.message) || error) }))
        }
      }
      React.useEffect(() => {
        load(filter)
        fetch(BASE + '/sync/status')
          .then((r) => r.json())
          .then((body) => setState((prev) => ({ ...prev, sync: body })))
          .catch(() => {})
      }, [])

      // Manual push/pull only (design decision): the person decides when their
      // recipes travel to their own repo.
      const syncNow = async (kind) => {
        setState((prev) => ({ ...prev, syncMsg: null, error: null }))
        try {
          const body = await fetch(BASE + '/sync/' + kind, { method: 'POST', body: '{}' }).then((r) => r.json())
          if (!body.ok) throw new Error(body.error || kind)
          setState((prev) => ({ ...prev, syncMsg: kind === 'push' ? t('library.pushed') : t('library.pulled') }))
          if (kind === 'pull') load(filter)
        } catch (error) {
          setState((prev) => ({ ...prev, syncMsg: String((error && error.message) || error) }))
        }
      }

      const setAndLoad = (next) => {
        setFilter(next)
        load(next)
      }

      return h(
        'div',
        { 'data-studio': 'library', style: { display: 'flex', flexDirection: 'column', gap: 12 } },
        h('div', { style: { fontWeight: 600 } }, t('library.title')),
        state.error ? h('div', { 'data-studio-error': state.error, style: { color: 'var(--dsw-alias-label-tertiary)', fontSize: 12 } }, String(state.error)) : null,
        h(
          'div',
          { style: { display: 'flex', gap: 6, flexWrap: 'wrap' } },
          h('select', {
            'data-studio': 'library-kind',
            value: filter.kind,
            onChange: (e) => setAndLoad({ ...filter, kind: e.target.value }),
            style: { ...inputStyle, width: 110 },
          },
            h('option', { value: '' }, t('library.filterAll')),
            h('option', { value: 'video' }, 'video'),
          ),
          h('select', {
            'data-studio': 'library-min',
            value: filter.min,
            onChange: (e) => setAndLoad({ ...filter, min: e.target.value }),
            style: { ...inputStyle, width: 90 },
          },
            ['0', '1', '2', '3', '4', '5'].map((n) => h('option', { key: n, value: n }, '★'.repeat(Number(n)) || t('library.rating'))),
          ),
        ),
        state.recipes.length === 0
          ? h(Card, { 'data-studio': 'library-empty' }, h('div', { style: { color: 'var(--dsw-alias-label-tertiary)', fontSize: 12 } }, t('library.empty')))
          : h(
              'div',
              { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
              state.recipes.map((recipe) =>
                h(
                  Card,
                  { key: recipe.id, style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 } },
                  h('div', { 'data-studio-recipe': recipe.id, style: { minWidth: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flex: 1 } },
                  h('div', { style: { minWidth: 0 } },
                    h('div', { style: { fontSize: 11, color: 'var(--dsw-alias-label-tertiary)' } },
                      recipe.kind + ' · ' + recipe.provider + ' · ' + '★'.repeat(recipe.rating || 0)),
                    h('div', { 'data-studio-recipe-prompt': recipe.id, style: { fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } },
                      recipe.recipe && recipe.recipe.prompt),
                  ),
                  h('button', {
                    'data-studio-recipe-recall': recipe.id,
                    onClick: () => onRecall && onRecall(recipe),
                    style: buttonStyle,
                  }, t('library.recall')),
                  ),
                ),
              ),
            ),
        h(
          'div',
          { style: { display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' } },
          h('button', { 'data-studio': 'sync-push', onClick: () => syncNow('push'), style: buttonStyle }, t('library.push')),
          h('button', { 'data-studio': 'sync-pull', onClick: () => syncNow('pull'), style: buttonStyle }, t('library.pull')),
          h('span', { 'data-studio': 'sync-status', style: { fontSize: 11, color: 'var(--dsw-alias-label-tertiary)' } },
            state.sync
              ? state.sync.configured
                ? (state.syncMsg || t('library.syncReady'))
                : t('library.syncOff')
              : ''),
        ),
      )
    }

    /**
     * The Timeline (M7): the EDL as a strip. Every op goes to the host (one
     * implementation in lib/edl.js); the view keeps a stack of previous
     * documents so Undo is a PUT of the document before the last op. Frames at
     * the sequence fps — trims are whole frames by construction.
     */
    function TimelineStage({ t, project, session }) {
      const base = BASE + '/projects/' + project.id + '/sequences/' + session.sequence
      const [state, setState] = React.useState({ edl: null, history: [], busy: null, error: null, ffmpeg: null, exportMsg: null })
      const [playhead, setPlayhead] = React.useState(0)

      React.useEffect(() => {
        ;(async () => {
          try {
            const res = await fetch(base + '/edl')
            const body = await res.json()
            setState((prev) => ({ ...prev, edl: body.ok ? body.edl : { schema: 1, fps: 24, format: '', clips: [] } }))
          } catch (error) {
            setState((prev) => ({ ...prev, error: String((error && error.message) || error) }))
          }
        })()
      }, [])

      const edl = state.edl || { schema: 1, fps: 24, format: '', clips: [] }
      const total = edl.clips.reduce((sum, clip) => sum + (clip.out_f - clip.in_f), 0)

      const applyOp = async (body) => {
        setState((prev) => ({ ...prev, busy: body.op, error: null }))
        try {
          const res = await fetch(base + '/edl/op', { method: 'POST', body: JSON.stringify(body) })
          const answer = await res.json()
          if (!answer.ok) throw new Error(answer.error || body.op)
          setState((prev) => ({ ...prev, edl: answer.edl, history: prev.edl ? prev.history.concat([prev.edl]) : prev.history, busy: null }))
        } catch (error) {
          setState((prev) => ({ ...prev, busy: null, error: String((error && error.message) || error) }))
        }
      }

      const build = async () => {
        setState((prev) => ({ ...prev, busy: 'build', error: null }))
        try {
          const res = await fetch(base + '/edl/build', { method: 'POST', body: '{}' })
          const answer = await res.json()
          if (!answer.ok) throw new Error(answer.error || 'build')
          setState((prev) => ({ ...prev, edl: answer.edl, history: prev.edl ? prev.history.concat([prev.edl]) : prev.history, busy: null }))
        } catch (error) {
          setState((prev) => ({ ...prev, busy: null, error: String((error && error.message) || error) }))
        }
      }

      const undo = async () => {
        const previous = state.history[state.history.length - 1]
        if (!previous) return
        await fetch(base + '/edl', { method: 'PUT', body: JSON.stringify(previous) })
        setState((prev) => ({ ...prev, edl: previous, history: prev.history.slice(0, -1) }))
      }

      // Export (M8): the status line is fetched once so the MP4 button can be
      // honest about ffmpeg instead of failing at the click.
      React.useEffect(() => {
        ;(async () => {
          try {
            const body = await fetch(base + '/export/status').then((r) => r.json())
            setState((prev) => ({ ...prev, ffmpeg: body.ffmpeg }))
          } catch {
            setState((prev) => ({ ...prev, ffmpeg: { ok: false, error: 'ffmpeg not found' } }))
          }
        })()
      }, [])

      const exportAs = async (kind) => {
        setState((prev) => ({ ...prev, busy: 'export', error: null, exportMsg: null }))
        try {
          const body = await fetch(base + '/export/' + kind, { method: 'POST', body: '{}' }).then((r) => r.json())
          if (!body.ok) throw new Error(body.error || kind)
          setState((prev) => ({ ...prev, busy: null, exportMsg: body.manifest || body.output || 'ok' }))
        } catch (error) {
          setState((prev) => ({ ...prev, busy: null, error: String((error && error.message) || error) }))
        }
      }

      const clipUrl = (clip) =>
        clip.take
          ? '/plugins/generate/providers/' + clip.take.provider + '/result?job=' + encodeURIComponent(clip.take.jobId) + '&i=' + (clip.take.index || 0)
          : ''
      const previewOrder = edl.clips.map(clipUrl).join(' ')

      return h(
        'div',
        { 'data-studio': 'timeline', style: { display: 'flex', flexDirection: 'column', gap: 12 } },
        h('div', { style: { fontWeight: 600 } }, t('stage.timeline')),
        state.error ? h('div', { 'data-studio-error': state.error, style: { color: 'var(--dsw-alias-label-tertiary)', fontSize: 12 } }, String(state.error)) : null,
        h(
          'div',
          { style: { display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' } },
          h('button', { 'data-studio': 'timeline-build', onClick: build, style: buttonStyle }, t('timeline.build')),
          h('button', { 'data-studio': 'timeline-undo', onClick: undo, disabled: state.history.length === 0, style: { ...buttonStyle, opacity: state.history.length === 0 ? 0.5 : 1 } }, t('timeline.undo')),
          h('button', { 'data-studio': 'export-edl', onClick: () => exportAs('edl'), style: buttonStyle }, t('export.edl')),
          state.ffmpeg && state.ffmpeg.ok
            ? h('button', { 'data-studio': 'export-mp4', onClick: () => exportAs('mp4'), style: buttonStyle }, t('export.mp4'))
            : h('span', { 'data-studio': 'export-mp4-off', style: { fontSize: 11, color: 'var(--dsw-alias-label-tertiary)' } }, t('export.noffmpeg')),
          state.exportMsg ? h('span', { 'data-studio': 'export-msg', style: { fontSize: 11, color: 'var(--dsw-alias-label-tertiary)' } }, String(state.exportMsg)) : null,
          h('span', { style: { fontSize: 11, color: 'var(--dsw-alias-label-tertiary)' } }, '▶ '),
          h('input', {
            'data-studio': 'timeline-playhead',
            type: 'number',
            value: playhead,
            onChange: (e) => setPlayhead(e.target.value),
            style: { ...inputStyle, width: 70 },
          }),
          h('span', { 'data-studio': 'timeline-total', style: { fontSize: 11, color: 'var(--dsw-alias-label-tertiary)' } },
            t('timeline.total') + ' ' + total + ' f (' + (total / 24).toFixed(2) + ' s)'),
        ),
        edl.clips.length === 0
          ? h(Card, { 'data-studio': 'timeline-empty' }, h('div', { style: { color: 'var(--dsw-alias-label-tertiary)', fontSize: 12 } }, t('timeline.empty')))
          : h(
              'div',
              { 'data-studio': 'clip-strip', 'data-preview-order': previewOrder, style: { display: 'flex', gap: 8, flexWrap: 'wrap' } },
              edl.clips.map((clip, i) =>
                h(
                  'div',
                  { key: clip.id, 'data-studio-clip': clip.id, style: { border: '.5px solid var(--dsw-alias-border-l3)', borderRadius: 8, padding: 8, width: 200 } },
                  h('div', { style: { fontSize: 11, marginBottom: 4 } }, '[' + (i + 1) + '] ' + (clip.label || clip.id)),
                  h('div', { style: { display: 'flex', gap: 4, alignItems: 'center' } },
                    h('input', { 'data-studio-clip-in': clip.id, type: 'number', defaultValue: clip.in_f, onBlur: (e) => applyOp({ op: 'trim', id: clip.id, in_f: e.target.value, out_f: clip.out_f }), style: { ...inputStyle, width: 56 } }),
                    h('span', { style: { fontSize: 11 } }, '→'),
                    h('input', { 'data-studio-clip-out': clip.id, type: 'number', defaultValue: clip.out_f, onBlur: (e) => applyOp({ op: 'trim', id: clip.id, in_f: clip.in_f, out_f: e.target.value }), style: { ...inputStyle, width: 56 } }),
                  ),
                  h('div', { style: { display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' } },
                    h('button', { 'data-studio-clip-up': clip.id, onClick: () => applyOp({ op: 'move', id: clip.id, to: i - 1 }), disabled: i === 0, style: { ...buttonStyle, padding: '1px 6px', fontSize: 11 } }, '↑'),
                    h('button', { 'data-studio-clip-down': clip.id, onClick: () => applyOp({ op: 'move', id: clip.id, to: i + 1 }), disabled: i === edl.clips.length - 1, style: { ...buttonStyle, padding: '1px 6px', fontSize: 11 } }, '↓'),
                    h('button', { 'data-studio-clip-split': clip.id, onClick: () => applyOp({ op: 'split', id: clip.id, at: Number(playhead) }), style: { ...buttonStyle, padding: '1px 6px', fontSize: 11 } }, t('timeline.split')),
                    h('button', { 'data-studio-clip-delete': clip.id, onClick: () => applyOp({ op: 'delete', id: clip.id }), style: { ...buttonStyle, padding: '1px 6px', fontSize: 11 } }, t('timeline.delete')),
                  ),
                ),
              ),
            ),
      )
    }

    /**
     * The Shoot stage (M6): the shot desk. Bind approved assets, compose the
     * prompt mechanically (seals verbatim, the Prompt-desk role writes only the
     * scene layer), pass preflight, confirm the gate, run through Generate's
     * AI-App path, and land takes in the filmstrip — one select per shot.
     */
    function ShootStage({ t, project, session, onSaved, recall }) {
      const [state, setState] = React.useState({
        busy: null,
        error: null,
        confirming: false,
        shots: session.shots || [],
        chosen: (session.shots && session.shots[0] && session.shots[0].id) || null,
        lists: { characters: [], outfits: [], scenes: [] },
        bind: { character: '', look: '', scene: '' },
        workflow: 'minimax-h3-first-last',
      })
      const [promptText, setPromptText] = React.useState('')

      React.useEffect(() => {
        ;(async () => {
          try {
            const [c, o, s] = await Promise.all([
              fetch(BASE + '/projects/' + project.id + '/characters').then((r) => r.json()),
              fetch(BASE + '/projects/' + project.id + '/outfits').then((r) => r.json()),
              fetch(BASE + '/projects/' + project.id + '/scenes').then((r) => r.json()),
            ])
            setState((prev) => ({
              ...prev,
              lists: { characters: c.characters || [], outfits: o.records || [], scenes: s.records || [] },
            }))
          } catch (error) {
            setState((prev) => ({ ...prev, error: String((error && error.message) || error) }))
          }
        })()
      }, [])

      // Recall (M10): a recalled recipe prefills the desk so the next run
      // matches what produced the known-good take.
      React.useEffect(() => {
        if (recall && recall.recipe) {
          setPromptText(String(recall.recipe.prompt || ''))
          setState((prev) => ({
            ...prev,
            workflow: (recall.recipe.params && recall.recipe.params.workflow) || prev.workflow,
          }))
        }
      }, [recall && recall.id])

      const shot = state.shots.find((s) => s.id === state.chosen) || null

      // Star a take: the FULL recipe enters the library (prompt, params, Look).
      const starTake = async (take, rating) => {
        if (!shot) return
        await fetch(BASE + '/library', {
          method: 'POST',
          body: JSON.stringify({
            id: 'r-' + String(take.job),
            kind: 'video',
            provider: take.provider,
            jobId: String(take.job),
            recipe: {
              prompt: String(shot.prompt || promptText || ''),
              seed: null,
              params: { duration_s: shot.duration_s, workflow: state.workflow },
              look: state.bind.look || null,
              refs: [state.bind.character, state.bind.scene].filter(Boolean),
            },
            rating: Number(rating),
            tags: [],
          }),
        })
      }

      const saveSession = async (shots) => {
        const next = { ...session, shots }
        await fetch(BASE + '/projects/' + project.id + '/sequences/' + session.sequence, {
          method: 'PUT',
          body: JSON.stringify(next),
        })
        setState((prev) => ({ ...prev, shots }))
        if (onSaved) onSaved(next)
      }

      const compose = async () => {
        if (!shot) return
        setState((prev) => ({ ...prev, busy: 'composing', error: null }))
        try {
          const res = await fetch(
            BASE + '/projects/' + project.id + '/sequences/' + session.sequence + '/shots/' + shot.id + '/prompt',
            {
              method: 'POST',
              body: JSON.stringify({
                character: state.bind.character,
                look: state.bind.look || '',
                scene: state.bind.scene || '',
                beat: shot.beat,
                camera: shot.camera,
              }),
            },
          )
          const body = await res.json()
          if (!body.ok) throw new Error(body.error || 'compose')
          setPromptText(body.prompt)
          // Saved into the shot: batch readiness reads the session, not the desk.
          await saveSession(state.shots.map((s) => (s.id === shot.id ? { ...s, prompt: body.prompt } : s)))
          setState((prev) => ({ ...prev, busy: null }))
        } catch (error) {
          setState((prev) => ({ ...prev, busy: null, error: String((error && error.message) || error) }))
        }
      }

      const startRun = async () => {
        if (!shot) return
        setState((prev) => ({ ...prev, busy: 'preflight', error: null, confirming: false }))
        try {
          const check = await fetch(
            BASE + '/projects/' + project.id + '/sequences/' + session.sequence + '/shots/' + shot.id + '/preflight',
            {
              method: 'POST',
              body: JSON.stringify({
                prompt: promptText,
                character: state.bind.character,
                look: state.bind.look || '',
              }),
            },
          ).then((r) => r.json())
          if (!check.ok) throw new Error('drift: ' + (check.drift || []).map((d) => d.slot).join(', '))
          setState((prev) => ({ ...prev, busy: null, confirming: true }))
        } catch (error) {
          setState((prev) => ({ ...prev, busy: null, error: String((error && error.message) || error) }))
        }
      }

      const confirmRun = async () => {
        if (!shot) return
        setState((prev) => ({ ...prev, busy: 'running', confirming: false, error: null }))
        try {
          const provider = 'runninghub'
          const res = await fetch('/plugins/generate/providers/' + provider + '/run', {
            method: 'POST',
            body: JSON.stringify({
              name: state.workflow,
              values: { prompt: promptText, duration: shot.duration_s },
              options: {},
              confirmed: true,
            }),
          }).then((r) => r.json())
          const job = res.job || res.jobId || res.id
          if (!job) throw new Error(res.error || 'no job')
          let phase = 'queued'
          for (let i = 0; i < 90 && ['queued', 'running', 'pending'].includes(String(phase)); i += 1) {
            await new Promise((resolve) => setTimeout(resolve, 1000))
            const poll = await fetch('/plugins/generate/providers/' + provider + '/run?job=' + encodeURIComponent(job)).then((r) => r.json())
            phase = poll.phase || poll.status || poll.state || 'running'
            if (poll.url) phase = 'done'
          }
          if (String(phase) !== 'done' && String(phase) !== 'succeeded' && String(phase) !== 'complete') {
            throw new Error('run ended as ' + phase)
          }
          const take = {
            provider,
            job: String(job),
            index: 0,
            url: '/plugins/generate/providers/' + provider + '/result?job=' + encodeURIComponent(job) + '&i=0',
          }
          const takes = (shot.takes || []).concat([take])
          await saveSession(state.shots.map((s) => (s.id === shot.id ? { ...s, takes } : s)))
          setState((prev) => ({ ...prev, busy: null }))
        } catch (error) {
          setState((prev) => ({ ...prev, busy: null, error: String((error && error.message) || error) }))
        }
      }

      // Execute-all (M9): every ready shot, one at a time. The batch passes one
      // gate (the confirm row), each shot preflights again before spending, and
      // a failure marks that shot and moves on — partial failure is visible per
      // shot, never hidden and never fatal to the batch.
      const runAll = () => setState((prev) => ({ ...prev, confirmingBatch: true }))
      const confirmBatch = async () => {
        const ready = state.shots.filter((s) => String(s.prompt || '').trim() !== '')
        setState((prev) => ({ ...prev, confirmingBatch: false, busy: 'batch', batch: {} }))
        for (const s of ready) {
          setState((prev) => ({ ...prev, batch: { ...prev.batch, [s.id]: { status: 'running' } } }))
          try {
            const check = await fetch(
              BASE + '/projects/' + project.id + '/sequences/' + session.sequence + '/shots/' + s.id + '/preflight',
              {
                method: 'POST',
                body: JSON.stringify({ prompt: s.prompt, character: state.bind.character, look: state.bind.look || '' }),
              },
            ).then((r) => r.json())
            if (!check.ok) throw new Error('drift: ' + (check.drift || []).map((d) => d.slot).join(', '))
            const res = await fetch('/plugins/generate/providers/runninghub/run', {
              method: 'POST',
              body: JSON.stringify({
                name: state.workflow,
                values: { prompt: s.prompt, duration: s.duration_s },
                options: {},
                confirmed: true,
              }),
            }).then((r) => r.json())
            const job = res.job || res.jobId || res.id
            if (!job) throw new Error(res.error || 'no job')
            let phase = 'queued'
            for (let i = 0; i < 90 && ['queued', 'running', 'pending'].includes(String(phase)); i += 1) {
              await new Promise((resolve) => setTimeout(resolve, 1000))
              const poll = await fetch('/plugins/generate/providers/runninghub/run?job=' + encodeURIComponent(job)).then((r) => r.json())
              phase = poll.phase || poll.status || poll.state || 'running'
              if (poll.url) phase = 'done'
            }
            if (!['done', 'succeeded', 'complete'].includes(String(phase))) throw new Error('run ended as ' + phase)
            const take = {
              provider: 'runninghub',
              job: String(job),
              index: 0,
              url: '/plugins/generate/providers/runninghub/result?job=' + encodeURIComponent(job) + '&i=0',
            }
            const takes = (s.takes || []).concat([take])
            await saveSession(state.shots.map((other) => (other.id === s.id ? { ...other, takes } : other)))
            setState((prev) => ({ ...prev, batch: { ...prev.batch, [s.id]: { status: 'done' } } }))
          } catch (error) {
            setState((prev) => ({ ...prev, batch: { ...prev.batch, [s.id]: { status: 'failed', error: String((error && error.message) || error) } } }))
          }
        }
        setState((prev) => ({ ...prev, busy: null }))
      }

      const selectTake = async (take) => {
        if (!shot) return
        await saveSession(state.shots.map((s) => (s.id === shot.id ? { ...s, selects: [take] } : s)))
      }

      const optionList = (items, valueKey) => items.map((item) => h('option', { key: item[valueKey], value: item[valueKey] }, item.name || item[valueKey]))
      const selectStyle = { ...inputStyle, flex: '1 1 120px' }

      return h(
        'div',
        { 'data-studio': 'shoot', style: { display: 'flex', flexDirection: 'column', gap: 12 } },
        h('div', { style: { fontWeight: 600 } }, t('stage.shoot')),
        state.error ? h('div', { 'data-studio-error': state.error, style: { color: 'var(--dsw-alias-label-tertiary)', fontSize: 12 } }, String(state.error)) : null,
        state.shots.length === 0
          ? h(Card, { 'data-studio': 'shoot-empty' }, h('div', { style: { color: 'var(--dsw-alias-label-tertiary)', fontSize: 12 } }, t('shoot.noShots')))
          : h(
              'div',
              { style: { display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' } },
              h(Card, { 'data-studio': 'shot-card', style: { flex: '2 1 260px', minWidth: 260 } },
                h('div', { style: { display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 } },
                  state.shots.map((s) =>
                    h('button', {
                      key: s.id,
                      'data-studio-shot': s.id,
                      onClick: () => {
                        setPromptText(s.prompt || '')
                        setState((prev) => ({ ...prev, chosen: s.id }))
                      },
                      style: { ...buttonStyle, fontWeight: shot && shot.id === s.id ? 600 : 400 },
                    }, s.id + (state.batch && state.batch[s.id] ? ' · ' + t('shoot.status.' + state.batch[s.id].status) : '')),
                  ),
                ),
                shot ? h('div', { 'data-studio': 'shot-beat', style: { fontSize: 12, marginBottom: 8 } }, shot.beat + ' · ' + (shot.camera || '') + ' · ' + shot.duration_s + 's') : null,
                h('div', { style: { display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 } },
                  h('select', {
                    'data-studio': 'bind-character',
                    value: state.bind.character,
                    onChange: (e) => setState((prev) => ({ ...prev, bind: { ...prev.bind, character: e.target.value } })),
                    style: selectStyle,
                  }, h('option', { value: '' }, t('shoot.character')), optionList(state.lists.characters, 'id')),
                  h('select', {
                    'data-studio': 'bind-look',
                    value: state.bind.look,
                    onChange: (e) => setState((prev) => ({ ...prev, bind: { ...prev.bind, look: e.target.value } })),
                    style: selectStyle,
                  }, h('option', { value: '' }, t('shoot.look')), optionList(state.lists.outfits, 'id')),
                  h('select', {
                    'data-studio': 'bind-scene',
                    value: state.bind.scene,
                    onChange: (e) => setState((prev) => ({ ...prev, bind: { ...prev.bind, scene: e.target.value } })),
                    style: selectStyle,
                  }, h('option', { value: '' }, t('shoot.scene')), optionList(state.lists.scenes, 'id')),
                ),
                h('textarea', {
                  'data-studio': 'shoot-prompt',
                  value: promptText,
                  rows: 8,
                  placeholder: t('shoot.prompt'),
                  onChange: (e) => setPromptText(e.target.value),
                  style: { ...inputStyle, width: '100%', resize: 'vertical' },
                }),
                h('div', { style: { display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' } },
                  h('button', { 'data-studio': 'shoot-compose', onClick: compose, disabled: state.busy === 'composing', style: buttonStyle }, t('shoot.compose')),
                  h('button', { 'data-studio': 'shoot-generate', onClick: startRun, disabled: !!state.busy || !state.bind.character, style: buttonStyle }, t('shoot.generate')),
                  h('button', { 'data-studio': 'shoot-runall', onClick: runAll, disabled: !!state.busy || !state.bind.character, style: buttonStyle }, t('shoot.runAll')),
                ),
                state.confirming
                  ? h('div', { 'data-studio': 'confirm', style: { marginTop: 8, border: '.5px solid var(--dsw-alias-border-l3)', borderRadius: 8, padding: 8 } },
                      h('div', { style: { fontSize: 11, color: 'var(--dsw-alias-label-tertiary)', marginBottom: 6 } }, t('shoot.confirmNote')),
                      h('button', { 'data-studio': 'shoot-confirm', onClick: confirmRun, style: buttonStyle }, t('shoot.confirm')))
                  : null,
                state.confirmingBatch
                  ? h('div', { 'data-studio': 'batch-confirm', style: { marginTop: 8, border: '.5px solid var(--dsw-alias-border-l3)', borderRadius: 8, padding: 8 } },
                      h('div', { style: { fontSize: 11, color: 'var(--dsw-alias-label-tertiary)', marginBottom: 6 } }, t('shoot.batchNote')),
                      h('button', { 'data-studio': 'shoot-batch-confirm', onClick: confirmBatch, style: buttonStyle }, t('shoot.batchConfirm')))
                  : null,
                state.busy ? h('div', { 'data-studio': 'shoot-busy', style: { fontSize: 11, color: 'var(--dsw-alias-label-tertiary)', marginTop: 6 } }, t('run.' + state.busy)) : null,
              ),
              h(Card, { 'data-studio': 'takes-card', style: { flex: '3 1 240px', minWidth: 240 } },
                h('div', { style: { fontSize: 12, color: 'var(--dsw-alias-label-tertiary)', marginBottom: 8 } }, t('shoot.takes')),
                shot && (shot.takes || []).length === 0
                  ? h('div', { 'data-studio': 'takes-empty', style: { fontSize: 12, color: 'var(--dsw-alias-label-tertiary)' } }, t('shoot.noTakes'))
                  : h('div', { style: { display: 'flex', gap: 8, flexWrap: 'wrap' } },
                      (shot ? shot.takes || [] : []).map((take, i) =>
                        h('div', { key: take.job, 'data-studio-take': take.job, style: { border: '.5px solid var(--dsw-alias-border-l3)', borderRadius: 8, padding: 6, width: 140 } },
                          h('img', { 'data-studio-take-img': take.job, src: take.url, alt: 'take ' + (i + 1), style: { width: '100%', borderRadius: 4, display: 'block' } }),
                          h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 } },
                            h('span', { style: { fontSize: 11 } }, 'T' + (i + 1)),
                            h('button', {
                              'data-studio-take-select': take.job,
                              onClick: () => selectTake(take),
                              style: { ...buttonStyle, padding: '1px 6px', fontSize: 11, fontWeight: shot && shot.selects && shot.selects[0] && shot.selects[0].job === take.job ? 600 : 400 },
                            }, t('shoot.select')),
                          ),
                          h('select', {
                            'data-studio-take-rate': take.job,
                            defaultValue: '0',
                            onChange: (e) => starTake(take, e.target.value),
                            style: { ...inputStyle, width: 64, marginTop: 4, fontSize: 11 },
                          }, ['0', '1', '2', '3', '4', '5'].map((n) => h('option', { key: n, value: n }, '\u2605'.repeat(Number(n)) || '-'))),
                        ),
                      ),
                    ),
              ),
            ),
      )
    }

    /**
     * The Script stage (M5): the shot list, three input modes, one gate. Rows
     * edit live and save through the session PUT (the single write path); LLM
     * write and brief import land as DRAFTS the human edits before approving.
     * The total line shows H3's real 17k+5 frame grid.
     */
    function ScriptStage({ t, project, session, onSaved }) {
      const [state, setState] = React.useState({ busy: null, error: null })
      const [mode, setMode] = React.useState({ premise: '', brief: '' })

      const saveShots = async (shots, extra) => {
        const next = { ...session, ...extra, shots }
        const res = await fetch(BASE + '/projects/' + project.id + '/sequences/' + session.sequence, {
          method: 'PUT',
          body: JSON.stringify(next),
        })
        const body = await res.json()
        if (body.ok) onSaved(body.session)
        else setState((prev) => ({ ...prev, error: body.error || 'save' }))
      }

      const patchShot = (id, patch) =>
        saveShots(session.shots.map((shot) => (shot.id === id ? { ...shot, ...patch } : shot)))
      const removeShot = (id) => saveShots(session.shots.filter((shot) => shot.id !== id))
      const addShot = () => {
        const id = 's' + String(session.shots.length + 1).padStart(2, '0')
        saveShots([...session.shots, { id, beat: '', camera: '', duration_s: 5, assets: [], prompt: '', look: null, gate: null, selects: [] }])
      }

      const writeWithLlm = async (sub, payload) => {
        setState((prev) => ({ ...prev, busy: sub, error: null }))
        const res = await fetch(BASE + '/projects/' + project.id + '/sequences/' + session.sequence + '/script/' + sub, {
          method: 'POST',
          body: JSON.stringify(payload),
        })
        const body = await res.json()
        if (body.ok) {
          await saveShots(body.shots)
          setMode((prev) => ({ ...prev, premise: '', brief: '' }))
        } else {
          setState((prev) => ({ ...prev, error: body.error || sub }))
        }
        setState((prev) => ({ ...prev, busy: null }))
      }

      const approveScript = () =>
        saveShots(session.shots, { stages: { ...session.stages, script: { status: 'gated', gate: { by: 'human', at: new Date().toISOString() } } } })

      // H3's real grid: 17k+5 frames at 24 fps — 5 s renders as 124 f (5.17 s).
      const frames = session.shots.reduce((sum, shot) => sum + (shot.duration_s <= 0 ? 0 : Math.ceil((Math.max(5, Math.round(shot.duration_s * 24)) - 5) / 17) * 17 + 5), 0)
      const total = frames === 0 ? '0 s' : (Math.round((frames / 24) * 100) / 100 + ' s')

      return h(
        'div',
        { 'data-studio': 'script', style: { display: 'flex', flexDirection: 'column', gap: 12 } },
        h('div', { style: { fontWeight: 600 } }, t('script.title')),
        state.error ? h('div', { 'data-studio-error': state.error, style: { color: 'var(--dsw-alias-label-tertiary)', fontSize: 12 } }, String(state.error)) : null,

        // ── the shot rows ──────────────────────────────────────────────
        h(
          Card,
          { 'data-studio': 'shot-list' },
          session.shots.length === 0
            ? h('div', { style: { color: 'var(--dsw-alias-label-tertiary)', fontSize: 12 } }, t('script.empty'))
            : session.shots.map((shot) =>
                h('div', { key: shot.id, 'data-studio-shot': shot.id, style: { display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' } },
                  h('span', { style: { width: 28, color: 'var(--dsw-alias-label-tertiary)', fontSize: 11 } }, shot.id),
                  h('input', {
                    'data-studio-shot-beat': shot.id,
                    value: shot.beat,
                    placeholder: t('shot.beat'),
                    onChange: (e) => patchShot(shot.id, { beat: e.target.value }),
                    style: { ...inputStyle, flex: '2 1 220px' },
                  }),
                  h('input', {
                    'data-studio-shot-camera': shot.id,
                    value: shot.camera,
                    placeholder: t('script.camera'),
                    onChange: (e) => patchShot(shot.id, { camera: e.target.value }),
                    style: { ...inputStyle, flex: '1 1 120px' },
                  }),
                  h('input', {
                    'data-studio-shot-duration': shot.id,
                    type: 'number',
                    min: 4,
                    max: 15,
                    value: shot.duration_s,
                    onChange: (e) => patchShot(shot.id, { duration_s: Number(e.target.value) }),
                    style: { ...inputStyle, width: 56 },
                  }),
                  h('button', {
                    'data-studio-shot-remove': shot.id,
                    onClick: () => removeShot(shot.id),
                    style: buttonStyle,
                  }, t('script.remove')),
                ),
              ),
          h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 } },
            h('button', { 'data-studio': 'shot-add', onClick: addShot, style: buttonStyle }, t('shot.add')),
            h('div', { 'data-studio': 'script-total', style: { fontSize: 12, color: 'var(--dsw-alias-label-tertiary)' } }, t('script.total') + ' ' + total),
          ),
        ),

        // ── the three input modes ──────────────────────────────────────
        h(
          Card,
          {},
          h('div', { style: { display: 'flex', gap: 6, marginBottom: 8 } },
            h('input', {
              'data-studio': 'script-premise',
              value: mode.premise,
              placeholder: t('script.premise'),
              onChange: (e) => setMode((prev) => ({ ...prev, premise: e.target.value })),
              style: { ...inputStyle, flex: 1 },
            }),
            h('button', {
              'data-studio': 'script-write',
              onClick: () => writeWithLlm('draft', { premise: mode.premise }),
              style: buttonStyle,
            }, t('script.write')),
          ),
          h('div', { style: { display: 'flex', gap: 6 } },
            h('textarea', {
              'data-studio': 'script-brief',
              value: mode.brief,
              placeholder: t('script.brief'),
              rows: 2,
              onChange: (e) => setMode((prev) => ({ ...prev, brief: e.target.value })),
              style: { ...inputStyle, flex: 1, resize: 'vertical' },
            }),
            h('button', {
              'data-studio': 'script-import',
              onClick: () => {
                let brief = mode.brief
                try {
                  brief = JSON.parse(mode.brief)
                } catch {
                  // plain text is a fine premise too
                }
                writeWithLlm('brief', { brief })
              },
              style: buttonStyle,
            }, t('script.import')),
          ),
        ),

        // ── the gate ─────────────────────────────────────────────────
        h(
          'div',
          { style: { display: 'flex', alignItems: 'center', gap: 8 } },
          h('button', { 'data-studio': 'script-approve', onClick: approveScript, style: buttonStyle }, t('script.approve')),
          session.stages && session.stages.script && session.stages.script.status === 'gated'
            ? h('div', { 'data-studio': 'script-gated', style: { fontSize: 12, color: 'var(--dsw-alias-label-tertiary)' } }, t('script.gated'))
            : null,
        ),
      )
    }

    /**
     * The Outfit and Scene stages (M4): the M3 loop, generic over kind. Outfit
     * records carry the look-layer paragraphs (makeup/hair/outfit) and seal them
     * at approve; scene records gate only. Same editor, same gates, one model.
     */
    function RecordStage({ t, project, kind }) {
      const plural = kind === 'outfit' ? 'outfits' : 'scenes'
      const slots = kind === 'outfit' ? ['makeup', 'hair', 'outfit'] : ['environment', 'photography']
      const [state, setState] = React.useState({ phase: 'loading', records: [], chosen: null, error: null })
      const [draft, setDraft] = React.useState({ id: '', name: '', character: '' })

      const load = async () => {
        try {
          const res = await fetch(BASE + '/projects/' + project.id + '/' + plural)
          const body = await res.json()
          if (!body.ok) throw new Error(body.error || 'load')
          setState({ phase: 'ready', records: body.records, chosen: null, error: null })
        } catch (error) {
          setState((prev) => ({ ...prev, phase: 'failed', error: String((error && error.message) || error) }))
        }
      }
      React.useEffect(() => {
        load()
      }, [])

      const post = async (action, payload) => {
        const id = state.chosen && state.chosen.id
        const res = await fetch(BASE + '/projects/' + project.id + '/' + plural + '/' + id + '/' + action, {
          method: 'POST',
          body: JSON.stringify(payload || {}),
        })
        return res.json()
      }

      const createRecord = async () => {
        const id = (draft.id || draft.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64)
        if (!id || !draft.name.trim()) return
        const res = await fetch(BASE + '/projects/' + project.id + '/' + plural, {
          method: 'POST',
          body: JSON.stringify({ id, name: draft.name.trim(), character: kind === 'outfit' ? draft.character.trim() || null : null }),
        })
        const body = await res.json()
        if (body.ok) {
          setDraft({ id: '', name: '', character: '' })
          await load()
          setState((prev) => ({ ...prev, chosen: body.record }))
        } else {
          setState((prev) => ({ ...prev, error: body.error || 'create' }))
        }
      }

      const editSlot = async (slot, text) => {
        const answer = await post('edit', { slot, text })
        if (answer.ok) setState((prev) => ({ ...prev, chosen: answer.record }))
        else setState((prev) => ({ ...prev, error: answer.error || 'edit' }))
      }
      const runAction = async (action) => {
        const answer = await post(action, {})
        if (answer.ok) setState((prev) => ({ ...prev, chosen: answer.record }))
        else setState((prev) => ({ ...prev, error: answer.error || action }))
      }

      const chosen = state.chosen
      const sealed = (slot) => chosen && chosen.look && chosen.look.sealed && chosen.look.sealed[slot]

      return h(
        'div',
        { 'data-studio': 'records', 'data-record-kind': kind, style: { display: 'flex', flexDirection: 'column', gap: 12 } },
        h('div', { style: { fontWeight: 600 } }, t('stage.' + kind)),
        state.error ? h('div', { 'data-studio-error': state.error, style: { color: 'var(--dsw-alias-label-tertiary)', fontSize: 12 } }, String(state.error)) : null,
        h(
          Card,
          {},
          h('div', { style: { display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 } },
            state.records.map((r) =>
              h('button', {
                key: r.id,
                'data-studio-record': r.id,
                onClick: () => setState((prev) => ({ ...prev, chosen: r })),
                style: { ...buttonStyle, fontWeight: chosen && chosen.id === r.id ? 600 : 400 },
              }, r.name),
            ),
          ),
          h('div', { style: { display: 'flex', gap: 6, flexWrap: 'wrap' } },
            h('input', { 'data-studio': 'record-name', value: draft.name, placeholder: t('record.name'), onChange: (e) => setDraft((d) => ({ ...d, name: e.target.value })), style: inputStyle }),
            kind === 'outfit'
              ? h('input', { 'data-studio': 'record-character', value: draft.character, placeholder: t('record.character'), onChange: (e) => setDraft((d) => ({ ...d, character: e.target.value })), style: inputStyle })
              : null,
            h('button', { 'data-studio': 'record-create', onClick: createRecord, style: buttonStyle }, t('record.create')),
          ),
        ),
        chosen
          ? h(
              Card,
              { 'data-studio': 'record-card' },
              h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 } },
                h('div', { style: { fontWeight: 600 } }, chosen.name + (chosen.look ? ' · v' + chosen.look.version : '')),
                h('div', { style: { display: 'flex', gap: 6 } },
                  chosen.gate
                    ? h('button', { 'data-studio': 'record-revise', onClick: () => runAction('revise'), style: buttonStyle }, t('record.revise'))
                    : h('button', { 'data-studio': 'record-approve', onClick: () => runAction('approve'), style: buttonStyle }, t('record.approve')),
                ),
              ),
              slots.map((slot) =>
                h('div', { key: slot, style: { marginBottom: 6 } },
                  h('div', { style: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--dsw-alias-label-tertiary)' } },
                    t('slot.' + slot),
                    sealed(slot)
                      ? h('span', { 'data-studio-seal': slot, style: { fontSize: 10, border: '.5px solid var(--dsw-alias-border-l3)', borderRadius: 4, padding: '0 4px' } }, t('record.sealed') + ' v' + chosen.look.version)
                      : null,
                  ),
                  h('textarea', {
                    'data-studio-slot': slot,
                    value: chosen.paragraphs[slot] || '',
                    disabled: !!sealed(slot),
                    rows: 2,
                    onChange: (e) => setState((prev) => ({ ...prev, chosen: { ...prev.chosen, paragraphs: { ...prev.chosen.paragraphs, [slot]: e.target.value } } })),
                    onBlur: (e) => {
                      if (!sealed(slot)) editSlot(slot, e.target.value)
                    },
                    style: { ...inputStyle, width: '100%', resize: 'vertical', opacity: sealed(slot) ? 0.7 : 1 },
                  }),
                ),
              ),
            )
          : h(Card, { 'data-studio': 'record-empty' }, h('div', { style: { color: 'var(--dsw-alias-label-tertiary)', fontSize: 12 } }, t('record.empty'))),
      )
    }

    /**
     * The Character stage (M3): photo → Casting draft → human edits the eight
     * slot paragraphs → Approve (seal core v1). Sealed core slots wear their
     * badge and refuse edits; revise is the only way back in. The sheet run is
     * Generate's own run route — this plugin composes the payload (GET …/sheet)
     * and never talks to a provider directly.
     */
    function CharacterStage({ t, project }) {
      const [state, setState] = React.useState({ phase: 'loading', characters: [], chosen: null, run: null, error: null })
      const [draft, setDraft] = React.useState({ id: '', name: '', description: '' })

      const load = async () => {
        try {
          const res = await fetch(BASE + '/projects/' + project.id + '/characters')
          const body = await res.json()
          if (!body.ok) throw new Error(body.error || 'load')
          setState({ phase: 'ready', characters: body.characters, chosen: null, run: null, error: null })
        } catch (error) {
          setState((prev) => ({ ...prev, phase: 'failed', error: String((error && error.message) || error) }))
        }
      }
      React.useEffect(() => {
        load()
      }, [])

      const post = async (action, payload) => {
        const cid = state.chosen && state.chosen.id
        const res = await fetch(BASE + '/projects/' + project.id + '/characters/' + cid + '/' + action, {
          method: 'POST',
          body: JSON.stringify(payload || {}),
        })
        return res.json()
      }

      const createCharacter = async () => {
        const id = (draft.id || draft.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64)
        if (!id || !draft.name.trim()) return
        const res = await fetch(BASE + '/projects/' + project.id + '/characters', {
          method: 'POST',
          body: JSON.stringify({ id, name: draft.name.trim() }),
        })
        const body = await res.json()
        if (body.ok) {
          setDraft({ id: '', name: '', description: '' })
          await load()
          setState((prev) => ({ ...prev, chosen: body.bible }))
        } else {
          setState((prev) => ({ ...prev, error: body.error || 'create' }))
        }
      }

      const editSlot = async (slot, text) => {
        const answer = await post('edit', { slot, text })
        if (answer.ok) setState((prev) => ({ ...prev, chosen: answer.bible }))
        else setState((prev) => ({ ...prev, error: answer.error || 'edit' }))
      }
      const runAction = async (action) => {
        const answer = await post(action, {})
        if (answer.ok) setState((prev) => ({ ...prev, chosen: answer.bible }))
        else setState((prev) => ({ ...prev, error: answer.error || action }))
      }

      const uploadPhoto = async (event) => {
        const file = event && event.target && event.target.files && event.target.files[0]
        if (!file || !state.chosen) return
        await fetch(BASE + '/projects/' + project.id + '/characters/' + state.chosen.id + '/photo', {
          method: 'POST',
          body: await file.arrayBuffer(),
        })
        setState((prev) => ({ ...prev }))
      }

      const generateSheet = async () => {
        if (!state.chosen) return
        setState((prev) => ({ ...prev, run: { phase: 'composing' } }))
        const composed = await (await fetch(BASE + '/projects/' + project.id + '/characters/' + state.chosen.id + '/sheet')).json()
        if (!composed.ok) {
          setState((prev) => ({ ...prev, run: null, error: composed.error || 'sheet' }))
          return
        }
        // Generate's own run route — the same gate contract its pane uses.
        const started = await (await fetch('/plugins/generate/providers/krea/run', {
          method: 'POST',
          body: JSON.stringify({ name: composed.name, values: composed.values, options: {}, confirmed: true }),
        })).json()
        if (!started.ok) {
          setState((prev) => ({ ...prev, run: null, error: started.error || 'run' }))
          return
        }
        setState((prev) => ({ ...prev, run: { phase: 'running', jobId: started.jobId } }))
        for (let i = 0; i < 60; i += 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000))
          const poll = await (await fetch('/plugins/generate/providers/krea/run?job=' + encodeURIComponent(started.jobId))).json()
          if (!poll.ok) break
          if (poll.status === 'done' || poll.status === 'failed') {
            setState((prev) => ({ ...prev, run: { phase: poll.status, jobId: started.jobId, url: poll.url || null, error: poll.error || null } }))
            return
          }
        }
      }

      const SLOTS8 = [
        ['overview', 'core'],
        ['identity', 'core'],
        ['makeup', 'look'],
        ['hair', 'look'],
        ['outfit', 'look'],
        ['pose', 'scene'],
        ['environment', 'scene'],
        ['photography', 'scene'],
      ]

      const chosen = state.chosen
      const sealed = (slot) => chosen && chosen.core && chosen.core.sealed && chosen.core.sealed[slot]

      return h(
        'div',
        { 'data-studio': 'character', style: { display: 'flex', flexDirection: 'column', gap: 12 } },
        h('div', { style: { fontWeight: 600 } }, t('char.title')),
        state.error ? h('div', { 'data-studio-error': state.error, style: { color: 'var(--dsw-alias-label-tertiary)', fontSize: 12 } }, String(state.error)) : null,

        // ── character list + create ──────────────────────────────────────────
        h(
          Card,
          {},
          h('div', { style: { display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 } },
            state.characters.map((c) =>
              h('button', {
                key: c.id,
                'data-studio-character': c.id,
                onClick: () => setState((prev) => ({ ...prev, chosen: c })),
                style: { border: '.5px solid var(--dsw-alias-border-l3)', borderRadius: 8, padding: '3px 10px', background: 'transparent', color: 'inherit', cursor: 'pointer', fontWeight: chosen && chosen.id === c.id ? 600 : 400 },
              }, c.name),
            ),
          ),
          h('div', { style: { display: 'flex', gap: 6 } },
            h('input', { 'data-studio': 'char-name', value: draft.name, placeholder: t('char.name'), onChange: (e) => setDraft((d) => ({ ...d, name: e.target.value })), style: inputStyle }),
            h('button', { 'data-studio': 'char-create', onClick: createCharacter, style: buttonStyle }, t('char.create')),
          ),
        ),

        // ── the bible: eight slots, seal badges, gates ───────────────────────
        chosen
          ? h(
              Card,
              { 'data-studio': 'bible' },
              h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 } },
                h('div', { style: { fontWeight: 600 } }, chosen.name + (chosen.core ? ' · v' + chosen.core.version : '')),
                h('div', { style: { display: 'flex', gap: 6 } },
                  h('label', { style: buttonStyle },
                    t('char.photo'),
                    h('input', { 'data-studio': 'photo-input', type: 'file', onChange: uploadPhoto, style: { display: 'none' } }),
                  ),
                  chosen.core
                    ? h('button', { 'data-studio': 'char-revise', onClick: () => runAction('revise'), style: buttonStyle }, t('char.revise'))
                    : h('button', { 'data-studio': 'char-approve', onClick: () => runAction('approve'), style: buttonStyle }, t('char.approve')),
                ),
              ),
              SLOTS8.map(([slot, layer]) =>
                h('div', { key: slot, style: { marginBottom: 6 } },
                  h('div', { style: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--dsw-alias-label-tertiary)' } },
                    t('slot.' + slot),
                    sealed(slot)
                      ? h('span', { 'data-studio-seal': slot, style: { fontSize: 10, border: '.5px solid var(--dsw-alias-border-l3)', borderRadius: 4, padding: '0 4px' } }, t('char.sealed') + ' v' + chosen.core.version)
                      : null,
                  ),
                  h('textarea', {
                    'data-studio-slot': slot,
                    value: chosen.paragraphs[slot] || '',
                    disabled: !!sealed(slot),
                    rows: 2,
                    onChange: (e) => setState((prev) => ({ ...prev, chosen: { ...prev.chosen, paragraphs: { ...prev.chosen.paragraphs, [slot]: e.target.value } } })),
                    onBlur: (e) => {
                      if (!sealed(slot)) editSlot(slot, e.target.value)
                    },
                    style: { ...inputStyle, width: '100%', resize: 'vertical', opacity: sealed(slot) ? 0.7 : 1 },
                  }),
                ),
              ),
              // ── draft with the Casting role ──────────────────────────────────
              h('div', { style: { display: 'flex', gap: 6, marginTop: 8 } },
                h('input', { 'data-studio': 'char-description', value: draft.description, placeholder: t('char.description'), onChange: (e) => setDraft((d) => ({ ...d, description: e.target.value })), style: { ...inputStyle, flex: 1 } }),
                h('button', { 'data-studio': 'char-draft', onClick: () => post('draft', { description: draft.description }).then((a) => a.ok && setState((prev) => ({ ...prev, chosen: a.bible }))), style: buttonStyle }, t('char.draft')),
              ),
              // ── the sheet run (through Generate) ─────────────────────────────
              h('div', { style: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 } },
                h('button', { 'data-studio': 'char-sheet', onClick: generateSheet, style: buttonStyle }, t('char.sheet')),
                state.run ? h('div', { 'data-studio-run': state.run.phase, style: { fontSize: 12, color: 'var(--dsw-alias-label-tertiary)' } }, t('char.run.' + (state.run.phase === 'running' ? 'running' : state.run.phase))) : null,
              ),
              state.run && state.run.url
                ? h('div', { 'data-studio-sheet': 'result', style: { marginTop: 8 } },
                    h('img', { src: state.run.url, alt: t('char.sheet'), style: { maxWidth: '100%', borderRadius: 8 } }),
                  )
                : null,
            )
          : h(Card, { 'data-studio': 'bible-empty' }, h('div', { style: { color: 'var(--dsw-alias-label-tertiary)', fontSize: 12 } }, t('char.empty'))),
      )
    }

    const buttonStyle = { border: '.5px solid var(--dsw-alias-border-l3)', borderRadius: 8, padding: '3px 10px', background: 'transparent', color: 'inherit', cursor: 'pointer' }
    const inputStyle = { background: 'transparent', border: '.5px solid var(--dsw-alias-border-l3)', borderRadius: 8, padding: '4px 8px', color: 'inherit' }

    /**
     * The project screen. One component, host-driven state: the tree it draws is
     * a pure function of what GET answered, so the verify harness can walk it.
     */
    function StudioPane({ t }) {
      const [state, setState] = React.useState({ phase: 'loading', projects: [], project: null, session: null, error: null, view: 'project', recall: null })
      const [pick, setPick] = React.useState({ projectId: '', name: '' })

      const load = async () => {
        try {
          const res = await fetch(BASE + '/projects')
          const body = await res.json()
          if (!body.ok) throw new Error(body.error || 'load')
          const first = body.projects[0] || null
          let session = null
          if (first) {
            const seqRes = await fetch(BASE + '/projects/' + first.id + '/sequences')
            const seqBody = await seqRes.json()
            if (seqBody.ok && seqBody.sequences[0]) {
              const s = await fetch(BASE + '/projects/' + first.id + '/sequences/' + seqBody.sequences[0].id)
              const sb = await s.json()
              if (sb.ok) session = sb.session
            }
          }
          setState({ phase: 'ready', projects: body.projects, project: first, session, error: null })
        } catch (error) {
          setState({ phase: 'failed', projects: [], project: null, session: null, error: String((error && error.message) || error) })
        }
      }
      React.useEffect(() => {
        load()
      }, [])

      const createProject = async () => {
        const id = (pick.projectId || pick.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64)
        if (!id || !pick.name.trim()) return
        const res = await fetch(BASE + '/projects', {
          method: 'POST',
          body: JSON.stringify({ id, name: pick.name.trim() }),
        })
        const body = await res.json()
        if (body.ok) {
          setPick({ projectId: '', name: '' })
          await load()
        } else {
          setState((prev) => ({ ...prev, phase: 'failed', error: body.error || 'create' }))
        }
      }

      const createSequence = async () => {
        const id = 'seq-' + Date.now().toString(36)
        const res = await fetch(BASE + '/projects/' + state.project.id + '/sequences', {
          method: 'POST',
          body: JSON.stringify({ id }),
        })
        const body = await res.json()
        if (body.ok) await load()
      }

      const saveShots = async (shots) => {
        const session = { ...state.session, shots }
        setState((prev) => ({ ...prev, session }))
        await fetch(BASE + '/projects/' + state.project.id + '/sequences/' + state.session.sequence, {
          method: 'PUT',
          body: JSON.stringify(session),
        })
      }

      const addShot = () => {
        const id = 's' + String(state.session.shots.length + 1).padStart(2, '0')
        saveShots([...state.session.shots, { id, beat: '', camera: '', duration_s: 5, assets: [], prompt: '', look: null, gate: null, selects: [] }])
      }

      if (state.phase === 'loading') return h('div', { 'data-studio': 'pane' }, '…')
      if (state.phase === 'failed') {
        return h(
          'div',
          { 'data-studio': 'pane' },
          h('div', { 'data-studio-error': state.error }, t('state.failed') + ': ' + state.error),
        )
      }

      // A stage screen replaces the project screen while open (M3/M4/M5).
      if ((state.view === 'character' || state.view === 'outfit' || state.view === 'scene' || state.view === 'script' || state.view === 'shoot' || state.view === 'timeline' || state.view === 'library') && (state.project || state.view === 'library')) {
        return h(
          'div',
          { 'data-studio': 'pane', style: { padding: 16, display: 'flex', flexDirection: 'column', gap: 12, overflow: 'auto' } },
          h('button', {
            'data-studio': 'view-back',
            onClick: () => setState((prev) => ({ ...prev, view: 'project' })),
            style: { alignSelf: 'flex-start', border: '.5px solid var(--dsw-alias-border-l3)', borderRadius: 8, padding: '3px 10px', background: 'transparent', color: 'inherit', cursor: 'pointer' },
          }, t('nav.back')),
          state.view === 'library'
            ? h(LibraryStage, {
                t,
                onRecall: (recipe) => setState((prev) => ({ ...prev, view: 'shoot', recall: recipe })),
              })
            : state.view === 'character'
            ? h(CharacterStage, { t, project: state.project })
            : state.view === 'script'
              ? state.session
                ? h(ScriptStage, {
                    t,
                    project: state.project,
                    session: state.session,
                    onSaved: (session) => setState((prev) => ({ ...prev, session })),
                  })
                : h('div', { 'data-studio': 'script-noseq', style: { color: 'var(--dsw-alias-label-tertiary)', fontSize: 12 } }, t('script.noseq'))
              : state.view === 'shoot'
                ? state.session
                  ? h(ShootStage, {
                      t,
                      project: state.project,
                      session: state.session,
                      recall: state.recall,
                      onSaved: (session) => setState((prev) => ({ ...prev, session })),
                    })
                  : h('div', { 'data-studio': 'shoot-noseq', style: { color: 'var(--dsw-alias-label-tertiary)', fontSize: 12 } }, t('script.noseq'))
                : state.view === 'timeline'
                  ? state.session
                    ? h(TimelineStage, { t, project: state.project, session: state.session })
                    : h('div', { 'data-studio': 'timeline-noseq', style: { color: 'var(--dsw-alias-label-tertiary)', fontSize: 12 } }, t('script.noseq'))
                  : h(RecordStage, { t, project: state.project, kind: state.view }),
        )
      }

      const stages = STAGES.map((key) => ({
        key,
        status: (state.session && state.session.stages && state.session.stages[key] && state.session.stages[key].status) || 'empty',
      }))

      return h(
        'div',
        { 'data-studio': 'pane', style: { padding: 16, display: 'flex', flexDirection: 'column', gap: 16, overflow: 'auto' } },

        // ── pipeline nav: the method as the IA (design doc §1) ───────────────
        h(
          'div',
          { 'data-studio': 'pipeline', style: { display: 'flex', gap: 8 } },
          stages.map((stage) => h(StageCard, {
            key: stage.key,
            t,
            stage,
            onOpen: (stage.key === 'character' || stage.key === 'outfit' || stage.key === 'scene' || stage.key === 'script' || stage.key === 'shoot' || stage.key === 'timeline') && state.project
              ? () => setState((prev) => ({ ...prev, view: stage.key }))
              : undefined,
          })),
        ),

        h('div', { style: { display: 'flex', justifyContent: 'flex-end' } },
          h('button', {
            'data-studio': 'library-open',
            onClick: () => setState((prev) => ({ ...prev, view: 'library' })),
            style: { border: '.5px solid var(--dsw-alias-border-l3)', borderRadius: 8, padding: '3px 10px', background: 'transparent', color: 'inherit', cursor: 'pointer', fontSize: 12 },
          }, t('library.open')),
        ),

        // ── projects ─────────────────────────────────────────────────────────
        h(
          Card,
          {},
          h('div', { style: { fontWeight: 600, marginBottom: 8 } }, t('project.title')),
          state.projects.length === 0
            ? h('div', { 'data-studio': 'projects-empty', style: { color: 'var(--dsw-alias-label-tertiary)', fontSize: 12 } }, t('project.empty'))
            : h(
                'div',
                { 'data-studio': 'projects', style: { display: 'flex', flexDirection: 'column', gap: 4 } },
                state.projects.map((p) =>
                  h(
                    'div',
                    {
                      key: p.id,
                      'data-studio-project': p.id,
                      onClick: () => setState((prev) => ({ ...prev, project: p, session: prev.session })),
                      style: { fontSize: 13, cursor: 'pointer', fontWeight: p === state.project ? 600 : 400 },
                    },
                    p.name,
                  ),
                ),
              ),
          h(
            'div',
            { style: { display: 'flex', gap: 6, marginTop: 8 } },
            h('input', {
              'data-studio': 'project-name',
              placeholder: t('project.name'),
              value: pick.name,
              onChange: (e) => setPick((p) => ({ ...p, name: e.target.value })),
              style: { flex: 1, background: 'transparent', border: '.5px solid var(--dsw-alias-border-l3)', borderRadius: 8, padding: '4px 8px', color: 'inherit' },
            }),
            h(
              'button',
              {
                'data-studio': 'project-create',
                onClick: createProject,
                style: { display: 'inline-flex', alignItems: 'center', gap: 4, border: '.5px solid var(--dsw-alias-border-l3)', borderRadius: 8, padding: '4px 10px', background: 'transparent', color: 'inherit', cursor: 'pointer' },
              },
              IconPlus ? h(IconPlus, { width: 14, height: 14 }) : null,
              t('project.create'),
            ),
          ),
        ),

        // ── sequence + shots (M1: enough of the session to round-trip) ────────
        state.session
          ? h(
              Card,
              { 'data-studio': 'sequence' },
              h(
                'div',
                { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 } },
                h('div', { style: { fontWeight: 600 } }, t('sequence.title') + ' · ' + (state.session.sequence || '')),
                h(
                  'button',
                  {
                    'data-studio': 'shot-add',
                    onClick: addShot,
                    style: { border: '.5px solid var(--dsw-alias-border-l3)', borderRadius: 8, padding: '3px 10px', background: 'transparent', color: 'inherit', cursor: 'pointer' },
                  },
                  t('shot.add'),
                ),
              ),
              state.session.shots.length === 0
                ? h('div', { 'data-studio': 'shots-empty', style: { color: 'var(--dsw-alias-label-tertiary)', fontSize: 12 } }, t('shot.empty'))
                : h(
                    'div',
                    { 'data-studio': 'shots', style: { display: 'flex', flexDirection: 'column', gap: 4 } },
                    state.session.shots.map((shot) =>
                      h(
                        'div',
                        { key: shot.id, 'data-studio-shot': shot.id, style: { display: 'flex', gap: 8, alignItems: 'center', fontSize: 12 } },
                        h('span', { style: { width: 28, color: 'var(--dsw-alias-label-tertiary)' } }, shot.id),
                        h('input', {
                          'data-studio-shot-beat': shot.id,
                          value: shot.beat,
                          placeholder: t('shot.beat'),
                          onChange: (e) => saveShots(state.session.shots.map((s) => (s.id === shot.id ? { ...s, beat: e.target.value } : s))),
                          style: { flex: 1, background: 'transparent', border: '.5px solid var(--dsw-alias-border-l3)', borderRadius: 6, padding: '3px 8px', color: 'inherit' },
                        }),
                        h('input', {
                          'data-studio-shot-duration': shot.id,
                          type: 'number',
                          min: 1,
                          value: shot.duration_s,
                          onChange: (e) => saveShots(state.session.shots.map((s) => (s.id === shot.id ? { ...s, duration_s: Number(e.target.value) } : s))),
                          style: { width: 56, background: 'transparent', border: '.5px solid var(--dsw-alias-border-l3)', borderRadius: 6, padding: '3px 6px', color: 'inherit' },
                        }),
                      ),
                    ),
                  ),
            )
          : h(
              Card,
              { 'data-studio': 'sequence-empty' },
              h('div', { style: { color: 'var(--dsw-alias-label-tertiary)', fontSize: 12 } }, t('sequence.empty')),
              state.project
                ? h(
                    'button',
                    {
                      'data-studio': 'sequence-create',
                      onClick: createSequence,
                      style: { marginTop: 8, border: '.5px solid var(--dsw-alias-border-l3)', borderRadius: 8, padding: '3px 10px', background: 'transparent', color: 'inherit', cursor: 'pointer' },
                    },
                    t('sequence.create'),
                  )
                : null,
            ),
      )
    }

    const StudioTitle = ({ t }) =>
      h(
        'span',
        { style: { display: 'inline-flex', alignItems: 'center', gap: 4 } },
        IconSparkle ? h(IconSparkle, { width: 16, height: 16 }) : null,
        t('type.label'),
      )

    function studioDefinition(t) {
      return {
        kind: KIND,
        // The registry CALLS these (`chosen.title(address)`, `entry.title()`), so
        // they are thunks — a bare `t(...)` string crashed the whole Start guide
        // with "entry.title is not a function" (measured 2026-10-10; this one
        // entry blanked every door on the right panel's start page).
        title: () => t('type.label'),
        icon: IconSparkle ? () => h(IconSparkle, { width: 16, height: 16 }) : undefined,
        guide: [
          {
            id: 'open',
            order: 50,
            title: () => t('guide.title'),
            description: () => t('guide.description'),
            icon: IconSparkle ? () => h(IconSparkle, { width: 16, height: 16 }) : undefined,
          },
        ],
      }
    }

    const inject = ['slots', 'locale', 'sidebarRightTabs']

    function apply(ctx) {
      const t = ctx.locale.bind(NS)
      ctx.effect(() => ctx.locale.register(NS, { zh: ZH, en: EN }), 'dsh-studio.copy')
      ctx.effect(() => ctx.sidebarRightTabs.register(studioDefinition(t)), 'dsh-studio.type')
      ctx.effect(
        () =>
          ctx.slots.inject('sidebar.right.pane.tab', () =>
            ctx.slots.register({ name: 'sidebar.right.pane.tab', key: PLUGIN_ID, locale: NS }, StudioPane),
          ),
        'dsh-studio.body',
      )
      ctx.effect(
        () =>
          ctx.slots.inject('sidebar.right.pane.tab.title', () =>
            ctx.slots.register({ name: 'sidebar.right.pane.tab.title', key: PLUGIN_ID, locale: NS }, StudioTitle),
          ),
        'dsh-studio.title',
      )
    }

    return { inject, apply }
  },
})
