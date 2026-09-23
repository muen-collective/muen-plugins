// @muen/dsh-runninghub — browser half (Epic 61 S1, S2, and S4's card).
//
// WHAT THIS REGISTERS:
//
//   the type      a `generate` page type in the right column: opened by kind, one
//                 page per pane (no `multiple` yet — see below), chip text from
//                 `type.label`.
//   its body      the keyed `sidebar.right.pane.tab` seat under this package's id.
//   its chip      the keyed `sidebar.right.pane.tab.title` seat under the same id.
//   its card      the guide entry that puts "Generate" on the right panel's start
//                 page beside "Workspace files", "New terminal" and "Browser", and
//                 — under the same id — the card renderer at
//                 `sidebar.right.tab.guide.entry` that lists what is installed and
//                 opens one of them (S4, §10). The standard card is the fallback.
//   its settings  one `settings.section` page, which is where a key is changed or
//                 unlinked once the surface is in use (S2).
//
// THE PANE IS THE WALLET AND AN EMPTY STATE. S2's whole claim is that a key can be
// linked, validated at the field, and seen as a balance; the run view is S5 and is
// not faked here. The card's leaf selection therefore opens the pane with
// `params.unit` set, which is the seam S5 reads — the run form itself does not
// exist yet, and nothing pretends it does.
//
// THE KEY NEVER REACHES THIS HALF (§12 rule 2). This file has no key in state
// beyond the field being typed into, no `localStorage`, and no route that returns
// one: a save posts the value once, and every read afterwards is a balance. That
// is why the browser half cannot check whether the key is still valid — it asks
// the host, and the host answers with the account.
//
// `multiple` IS DELIBERATELY ABSENT. With it, every open of the kind makes a new
// tab, and the guide card — which carries no params — would duplicate itself on
// every click. One page per pane is right until a tab carries a unit's params
// (S5, D17).
//
// NOTHING MUEN-SPECIFIC IS IN HERE (§5 rule 1): only upstream `@deepseek-ai/*`
// services, the harness's own theme aliases, and this package's own copy.
//
// Loader format: one self-contained script registered via window.__ModuleLoader__.
// React arrives through factory(require); the right-panel registry and the slot
// registry arrive on ctx.
window.__ModuleLoader__.load({
  id: '@muen/dsh-runninghub',
  factory: (require) => {
    const React = require('react')
    // The harness's own icon set and its dialog, not hand-rolled glyphs or a
    // hand-rolled overlay. `external` in package.json is what lets a third-party
    // bundle require them, the same way the Browser tab takes `IconGlobeOutline14`
    // from here and the workspace dialogs take `Modal`.
    const {
      IconSparkle16,
      IconWarningOutline16,
      IconRightUpOutline16,
      IconRefreshOutline16,
      IconCheckOutline16,
      IconInfoOutline14,
      Modal,
    } = require('@deepseek-ai/dsh-client-ui-primitives')
    const h = React.createElement

    /** The implementation id: the key this type's body and title register under. */
    const GENERATE_ID = '@muen/dsh-runninghub'
    /** The kind `openTab` names and the guide card opens. */
    const GENERATE_KIND = 'generate'
    /** This package's namespace in the client locale registry. */
    const NS = 'generate'
    /** The host's wallet route. One of the three endpoints this half talks to. */
    const WALLET_API = '/plugins/generate/wallet'
    /**
     * The host's installed-workflow list. A disk read on the host, so the pane's
     * cards draw what is installed without a key, a network call or a coin.
     */
    const ADAPTERS_API = '/plugins/generate/adapters'
    /**
     * One workflow, whole. The list carries what a card draws; the surface needs the
     * doors, their bounds and `ui.order`, so it reads the file by name.
     */
    const ADAPTER_API = '/plugins/generate/adapter'

    const EN = {
      'type.label': 'Generate',
      'guide.title': 'Generate with RunningHub',
      'guide.description': 'Run your RunningHub workflows here',
      // The pane is the HUB (founder, 2026-09-22): the start-page card is a plain
      // door, and every workflow surface lives inside this one pane. So the pane's
      // first screen is its card grid, and a card opens that workflow's surface.
      'surface.back': 'All workflows',
      'surface.loading': 'Reading the workflow…',
      'surface.failed': 'That workflow could not be read.',
      'surface.advanced': 'Advanced',
      'surface.advanced.hide': 'Hide advanced',
      // Said where the run will be, because the form is real and nothing submits:
      // the payload gate, the run strip and the result are the next slice (§10).
      'surface.pending': 'Running comes next: the payload gate and the run strip are not built yet.',
      'card.community': 'someone else\'s app',
      'surface.image.choose': 'Choose an image',
      'pane.loading': 'Checking your wallet…',
      'pane.first.title': 'Link your RunningHub account',
      'pane.first.body': 'Paste your API key. It is checked now, and it stays on this machine.',
      // The pane links a key; only Settings → Generate changes or removes one. A
      // person who meets the field here would otherwise never learn where the key
      // is managed, which is exactly where they have to go to rotate it
      // (founder, 2026-09-22). Directions, because a plugin cannot open Settings,
      // and the second sentence says where Settings is — the founder's own wording,
      // after "at the foot of the sidebar" read as less clear (2026-09-22).
      'pane.first.manage': 'You can change or remove this key later in Settings → Generate. The Settings menu is at the bottom of the left sidebar.',
      'pane.linked.manage': 'Change or remove the key in Settings → Generate. The Settings menu is at the bottom of the left sidebar.',
      // How an app is added. A plugin cannot put text into the conversation
      // composer and a slash command cannot start a turn (measured 2026-09-22), so
      // the pane cannot hand the job to chat itself: it says what to ask for, and
      // the agent's add-rh-workflow skill does the rest (epic 61 §2b, D15).
      //
      // THE QUOTED TRIGGER STAYS ENGLISH IN BOTH DICTIONARIES, deliberately. It is
      // the same phrase the skill's whenToUse names, so a translator who improves
      // it here would break the instruction this line exists to give. A user may
      // say it in their own language; what must not move is the sentence we show.
      'pane.add.hint': 'To add a workflow, ask the agent in chat: “add this RunningHub workflow <app link>”.',
      'pane.empty.title': 'Nothing installed yet',
      'pane.empty.body': 'RunningHub apps you add open here, one card each.',
      // A host that did not answer is not an empty install, and saying so is the
      // difference between "add a workflow" and "something is wrong".
      'pane.list.failed': 'The installed workflows could not be read.',
      'wallet.key.label': 'RunningHub API key',
      'wallet.key.placeholder': 'Paste your key',
      'wallet.key.hint': 'Your key is on your RunningHub account page, under',
      // The account page that issues keys is not linked from anywhere obvious;
      // the founder had to search for it (2026-09-22). So the hint ends in a link
      // straight to it rather than directions to go and find it.
      'wallet.key.getKey': 'API → Keys',
      'wallet.key.save': 'Save',
      'wallet.key.saving': 'Checking…',
      // A save that worked opens a confirmation. The strip is the proof, but it
      // sits above the fold of the pane and the person who just pressed Save is
      // looking at the button (founder, 2026-09-22: the balance was there and he
      // missed it). The dialog is what says the key works, that the wallet
      // answered, and where the balance now lives.
      'saved.title': 'Key valid. Wallet linked.',
      'saved.close': 'Close',
      'saved.intro': 'RunningHub accepted the key and answered your wallet, so both work.',
      'saved.keyOk': 'The key works: RunningHub validated it before storing it.',
      'saved.walletOk': 'Your wallet is readable:',
      'saved.walletOkBare': 'Your wallet is readable.',
      'saved.where': 'The balance now sits at the top left of this panel, beside the Top up link.',
      'saved.dismiss': 'Got it',
      'wallet.coins': 'coins',
      'wallet.running': 'running',
      'wallet.topup': 'Top up',
      'wallet.refresh': 'Refresh the balance',
      'wallet.notLinked': 'No key linked',
      'wallet.fromEnvironment': 'from your environment',
      'wallet.fromStore': 'stored on this machine',
      'settings.title': 'RunningHub wallet',
      'settings.body': 'The key stays on this machine. The browser never sees it.',
      // Rotation is a normal act, not an edge case: a person creates a new key on
      // RunningHub and pastes it here. The hint says the field is the way to do
      // that, and the remove dialog is the way to go back to nothing.
      'wallet.replace.hint': 'Pasting a key here replaces the one stored on this machine.',
      'remove.action': 'Remove key',
      'remove.title': 'Remove the stored key?',
      'remove.intro': 'It is deleted from this machine. The key itself still exists on RunningHub, so the same one can be pasted here again.',
      'remove.confirm': 'Remove key',
      'remove.cancel': 'Cancel',
      'remove.pending': 'Removing…',
      'remove.doneTitle': 'Key removed.',
      'remove.doneIntro': 'This machine no longer holds a RunningHub key, and the wallet is unlinked.',
      'remove.gone': 'The stored key is gone. Paste a key to link the wallet again.',
      'remove.failed': 'The key could not be removed.',
      'settings.readOnly': 'This key comes from your environment, so it cannot be changed or unlinked here.',
      'error.keyRequired': 'Paste a key first.',
      'error.invalidKey': 'RunningHub did not accept that key.',
      'error.unreachable': 'RunningHub could not be reached. Check your connection and try again.',
      'error.timeout': 'RunningHub did not answer in time. Try again.',
      'error.unexpected': 'RunningHub answered in a way this plugin does not understand.',
      'error.readOnly': 'That key is fixed by your environment, so it cannot be changed here.',
      'error.noCredentials': 'This harness has no credential store, so the key cannot be saved.',
      'error.generic': 'The key could not be saved.',
      'error.storedKeyRejected': 'The stored key is no longer accepted. Link a new one in Settings.',
    }

    const ZH = {
      'type.label': '生成',
      'guide.title': '使用 RunningHub 生成',
      'guide.description': '在这里运行你的 RunningHub 工作流',
      'surface.back': '全部工作流',
      'surface.loading': '正在读取工作流…',
      'surface.failed': '无法读取该工作流。',
      'surface.advanced': '高级',
      'surface.advanced.hide': '收起高级选项',
      'surface.pending': '运行功能稍后提供：付费前的载荷确认与运行状态尚未构建。',
      'card.community': '他人的应用',
      'surface.image.choose': '选择图片',
      'pane.loading': '正在检查钱包…',
      'pane.first.title': '连接你的 RunningHub 账户',
      'pane.first.body': '粘贴你的 API 密钥。现在就会校验，并且只保存在这台机器上。',
      'pane.first.manage': '之后可以在「设置 → 生成」里修改或移除这个密钥。设置菜单位于左侧边栏底部。',
      'pane.linked.manage': '在「设置 → 生成」里修改或移除密钥。设置菜单位于左侧边栏底部。',
      // 引号内的指令保持英文：它就是技能 whenToUse 里写的那句，翻译会让这行失去作用。
      'pane.add.hint': '要添加工作流，在对话里对智能体说：「add this RunningHub workflow <app link>」。',
      'pane.empty.title': '还没有安装应用',
      'pane.empty.body': '你添加的 RunningHub 应用会在这里打开，每个应用一张卡片。',
      'pane.list.failed': '无法读取已安装的工作流。',
      'wallet.key.label': 'RunningHub API 密钥',
      'wallet.key.placeholder': '粘贴你的密钥',
      'wallet.key.hint': '密钥在你的 RunningHub 账户页面里：',
      'wallet.key.getKey': 'API → Keys',
      'wallet.key.save': '保存',
      'wallet.key.saving': '校验中…',
      'saved.title': '密钥有效，钱包已连接。',
      'saved.close': '关闭',
      'saved.intro': 'RunningHub 接受了密钥并返回了钱包信息，两项都可用。',
      'saved.keyOk': '密钥可用：RunningHub 在保存前已校验通过。',
      'saved.walletOk': '钱包信息可以读取：',
      'saved.walletOkBare': '钱包信息可以读取。',
      'saved.where': '余额现在显示在此面板左上角，旁边就是充值链接。',
      'saved.dismiss': '知道了',
      'wallet.coins': '金币',
      'wallet.running': '个任务运行中',
      'wallet.topup': '充值',
      'wallet.refresh': '刷新余额',
      'wallet.notLinked': '未连接密钥',
      'wallet.fromEnvironment': '来自环境变量',
      'wallet.fromStore': '保存在本机',
      'settings.title': 'RunningHub 钱包',
      'settings.body': '密钥保存在这台机器上，浏览器不会看到它。',
      'wallet.replace.hint': '在这里粘贴密钥会替换本机已保存的那个。',
      'remove.action': '移除密钥',
      'remove.title': '移除已保存的密钥？',
      'remove.intro': '密钥会从这台机器上删除。RunningHub 上的密钥仍然存在，同一个密钥可以再次粘贴到这里。',
      'remove.confirm': '移除密钥',
      'remove.cancel': '取消',
      'remove.pending': '正在移除…',
      'remove.doneTitle': '密钥已移除。',
      'remove.doneIntro': '这台机器上不再保存 RunningHub 密钥，钱包已断开连接。',
      'remove.gone': '已保存的密钥已删除。粘贴密钥即可重新连接钱包。',
      'remove.failed': '密钥移除失败。',
      'settings.readOnly': '此密钥来自环境变量，无法在这里修改或解除。',
      'error.keyRequired': '请先粘贴密钥。',
      'error.invalidKey': 'RunningHub 没有接受这个密钥。',
      'error.unreachable': '无法连接 RunningHub，请检查网络后重试。',
      'error.timeout': 'RunningHub 没有及时响应，请重试。',
      'error.unexpected': 'RunningHub 返回了本插件无法识别的响应。',
      'error.readOnly': '该密钥由环境变量固定，无法在这里修改。',
      'error.noCredentials': '此环境没有凭据存储，密钥无法保存。',
      'error.generic': '密钥保存失败。',
      'error.storedKeyRejected': '已保存的密钥不再被接受。请在设置中连接新的密钥。',
    }

    /** Host error codes → copy. An `http-<n>` or an unknown code falls to generic. */
    const ERROR_KEYS = {
      'key-required': 'error.keyRequired',
      'invalid-key': 'error.invalidKey',
      unreachable: 'error.unreachable',
      timeout: 'error.timeout',
      'unexpected-response': 'error.unexpected',
      'read-only': 'error.readOnly',
      'no-credentials': 'error.noCredentials',
      'credentials-unavailable': 'error.noCredentials',
    }

    /**
     * Harness theme aliases only (§5 rule 9), so the pane reads correctly under
     * the stock theme, under EVA, and under any community theme: every alias
     * carries its own light and dark value.
     */
    const S = {
      root: {
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        background: 'var(--dsw-alias-bg-base)',
        color: 'var(--dsw-alias-label-primary)',
        overflow: 'auto',
      },
      empty: {
        margin: 'auto',
        padding: '24px 20px 32px',
        maxWidth: 300,
        textAlign: 'center',
      },
      form: {
        margin: 'auto',
        padding: '20px 18px 28px',
        width: '100%',
        maxWidth: 320,
        boxSizing: 'border-box',
        textAlign: 'center',
      },
      /** The form itself carries no centering: its parent owns where it sits. */
      formBody: {
        display: 'block',
        textAlign: 'left',
      },
      /** A settings page: the same column, but copy reads left, not centred. */
      page: {
        margin: '0 auto',
        padding: '20px 18px 28px',
        width: '100%',
        maxWidth: 360,
        boxSizing: 'border-box',
        textAlign: 'left',
      },
      mark: {
        display: 'block',
        margin: '0 auto 14px',
        color: 'var(--dsw-alias-label-tertiary)',
      },
      title: {
        fontSize: 14,
        fontWeight: 600,
        lineHeight: 1.4,
        color: 'var(--dsw-alias-label-primary)',
      },
      body: {
        marginTop: 6,
        fontSize: 12,
        lineHeight: 1.5,
        color: 'var(--dsw-alias-label-secondary)',
      },
      field: {
        display: 'block',
        width: '100%',
        boxSizing: 'border-box',
        marginTop: 12,
        padding: '7px 9px',
        fontSize: 12,
        color: 'var(--dsw-alias-label-primary)',
        background: 'var(--dsw-alias-bg-layer-1)',
        border: '1px solid var(--dsw-alias-border-l1)',
        borderRadius: 6,
        outline: 'none',
      },
      /**
       * Directions to the one page that changes or removes the key. An info glyph
       * leads it so it reads as a note rather than as one more control, and the row
       * is centered inside the block it sits in.
       */
      manageHint: {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        gap: 5,
        marginTop: 12,
        fontSize: 11,
        lineHeight: 1.5,
        textAlign: 'left',
        color: 'var(--dsw-alias-label-tertiary)',
      },
      manageIcon: {
        display: 'inline-flex',
        flexShrink: 0,
        marginTop: 2,
      },
      label: {
        display: 'block',
        marginTop: 16,
        fontSize: 12,
        fontWeight: 600,
        color: 'var(--dsw-alias-label-primary)',
      },
      fieldError: {
        marginTop: 6,
        fontSize: 12,
        lineHeight: 1.4,
        color: 'var(--dsw-alias-state-error-primary)',
      },
      hint: {
        marginTop: 6,
        fontSize: 11,
        lineHeight: 1.4,
        color: 'var(--dsw-alias-label-tertiary)',
      },
      /** One confirmed fact inside the save dialog: a check and the sentence. */
      savedRow: {
        display: 'flex',
        alignItems: 'flex-start',
        gap: 6,
        marginTop: 10,
        fontSize: 12,
        lineHeight: 1.5,
        color: 'var(--dsw-alias-label-primary)',
      },
      savedCheck: {
        display: 'inline-flex',
        flexShrink: 0,
        marginTop: 2,
        color: 'var(--dsw-alias-state-success-primary)',
      },
      /** Where the balance went. The one line the strip could never say. */
      savedWhere: {
        marginTop: 12,
        padding: '8px 10px',
        fontSize: 12,
        lineHeight: 1.5,
        color: 'var(--dsw-alias-label-secondary)',
        background: 'var(--dsw-alias-bg-layer-1)',
        border: '1px solid var(--dsw-alias-border-l1)',
        borderRadius: 6,
      },
      hintLink: {
        marginLeft: 4,
        color: 'var(--dsw-alias-link)',
        textDecoration: 'none',
        whiteSpace: 'nowrap',
      },
      row: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginTop: 12,
      },
      primary: {
        padding: '6px 12px',
        fontSize: 12,
        fontWeight: 600,
        color: 'var(--dsw-alias-label-primary-inverted)',
        background: 'var(--dsw-alias-button-primary-fill)',
        border: '1px solid transparent',
        borderRadius: 6,
        cursor: 'pointer',
      },
      ghost: {
        padding: '6px 12px',
        fontSize: 12,
        color: 'var(--dsw-alias-label-primary)',
        background: 'transparent',
        border: '1px solid var(--dsw-alias-border-l2)',
        borderRadius: 6,
        cursor: 'pointer',
      },
      /**
       * The destructive action. The harness ships no danger button token family
       * (its own delete dialogs tint a Button from a stylesheet this bundle does
       * not have), so the state colour carries it inline: the same
       * `state-error-primary` the field error uses, as a fill with the inverted
       * label, which both themes define.
       */
      danger: {
        padding: '6px 12px',
        fontSize: 12,
        fontWeight: 600,
        color: 'var(--dsw-alias-label-primary-inverted)',
        background: 'var(--dsw-alias-state-error-primary)',
        border: '1px solid transparent',
        borderRadius: 6,
        cursor: 'pointer',
      },
      strip: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 10px',
        background: 'var(--dsw-alias-bg-layer-1)',
        borderBottom: '1px solid var(--dsw-alias-border-l1)',
        fontSize: 12,
        color: 'var(--dsw-alias-label-primary)',
      },
      stripValue: {
        fontWeight: 600,
        whiteSpace: 'nowrap',
      },
      stripNote: {
        flex: 1,
        minWidth: 0,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        fontSize: 11,
        color: 'var(--dsw-alias-label-tertiary)',
      },
      link: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        marginLeft: 'auto',
        fontSize: 11,
        color: 'var(--dsw-alias-link)',
        textDecoration: 'none',
        whiteSpace: 'nowrap',
      },
      warn: {
        display: 'flex',
        alignItems: 'flex-start',
        gap: 6,
        margin: '12px 10px 0',
        fontSize: 12,
        lineHeight: 1.4,
        color: 'var(--dsw-alias-state-warn-primary)',
      },
      /**
       * The hub: one card per installed workflow, inside the pane (founder,
       * 2026-09-22 — "this surface needs to hold all wf surfaces inside this one RH
       * plugin surface"). The card is a button, so the whole card is the target.
       */
      cards: {
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        padding: '14px 12px 2px',
      },
      card: {
        display: 'flex',
        alignItems: 'stretch',
        gap: 0,
        width: '100%',
        padding: 0,
        overflow: 'hidden',
        textAlign: 'left',
        font: 'inherit',
        color: 'inherit',
        background: 'var(--dsw-alias-bg-layer-1)',
        border: '1px solid var(--dsw-alias-border-l1)',
        borderRadius: 10,
        cursor: 'pointer',
      },
      cardCover: {
        flex: 'none',
        display: 'block',
        width: 72,
        height: 72,
        objectFit: 'cover',
        background: 'var(--dsw-alias-bg-layer-2)',
      },
      cardBody: {
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
        minWidth: 0,
        padding: '10px 12px',
      },
      cardTitle: {
        fontSize: 13,
        fontWeight: 600,
        lineHeight: 1.4,
        color: 'var(--dsw-alias-label-primary)',
      },
      cardBlurb: {
        fontSize: 11,
        lineHeight: 1.45,
        color: 'var(--dsw-alias-label-secondary)',
      },
      cardMark: {
        marginTop: 2,
        fontSize: 10,
        lineHeight: 1.4,
        color: 'var(--dsw-alias-label-tertiary)',
      },
      /** One workflow's surface: the form column, inside the pane, under the strip. */
      surface: {
        padding: '10px 12px 24px',
      },
      surfaceHead: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      },
      /** A door's control. Same field as the key form, tighter under its own label. */
      input: {
        display: 'block',
        width: '100%',
        boxSizing: 'border-box',
        marginTop: 6,
        padding: '7px 9px',
        fontSize: 12,
        fontFamily: 'inherit',
        color: 'var(--dsw-alias-label-primary)',
        background: 'var(--dsw-alias-bg-layer-1)',
        border: '1px solid var(--dsw-alias-border-l1)',
        borderRadius: 6,
        outline: 'none',
      },
      multiline: {
        minHeight: 84,
        resize: 'vertical',
        lineHeight: 1.5,
      },
      /** A door the app exposes as an image slot. Uploading lands with the run path. */
      imageBox: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginTop: 6,
        padding: '10px 12px',
        fontSize: 11,
        color: 'var(--dsw-alias-label-tertiary)',
        background: 'var(--dsw-alias-bg-layer-1)',
        border: '1px dashed var(--dsw-alias-border-l2)',
        borderRadius: 6,
        cursor: 'pointer',
      },
      /** The one disclosure that hides the parameter-ish doors (§10). */
      disclosure: {
        display: 'block',
        width: '100%',
        marginTop: 18,
        padding: '8px 10px',
        textAlign: 'left',
        font: 'inherit',
        fontSize: 11,
        color: 'var(--dsw-alias-label-secondary)',
        background: 'transparent',
        border: '1px solid var(--dsw-alias-border-l1)',
        borderRadius: 6,
        cursor: 'pointer',
      },
    }

    /** `props.t` when the slot supplies it, the key otherwise (never a blank). */
    function translatorOf(props) {
      return props && typeof props.t === 'function' ? props.t : (key) => key
    }

    function errorText(t, error) {
      if (!error) return null
      return t(ERROR_KEYS[error] || 'error.generic')
    }

    function count(value) {
      if (typeof value !== 'number' || !Number.isFinite(value)) return null
      try {
        return new Intl.NumberFormat().format(value)
      } catch {
        return String(value)
      }
    }

    /**
     * The wallet, as this half is allowed to know it: a balance and a boolean.
     * Every read goes through the host, and a save posts the key exactly once —
     * it is never kept here, so nothing in this component tree can leak it.
     */
    function useWallet() {
      const [wallet, setWallet] = React.useState(null)
      const [busy, setBusy] = React.useState(false)
      // The last save's outcome, held by the surface rather than by the field:
      // a successful link replaces the field with the wallet view, so a
      // confirmation kept inside `KeyForm` would unmount with it.
      const [confirmed, setConfirmed] = React.useState(false)

      const load = React.useCallback(async () => {
        try {
          const response = await fetch(WALLET_API, { headers: { accept: 'application/json' } })
          setWallet(await response.json())
        } catch {
          setWallet({ linked: false, writable: false, source: null, account: null, error: 'unreachable', accountUrl: null })
        }
      }, [])

      React.useEffect(() => {
        load()
      }, [load])

      const save = React.useCallback(async (key) => {
        setBusy(true)
        setConfirmed(false)
        try {
          const response = await fetch(WALLET_API, {
            method: 'POST',
            headers: { 'content-type': 'application/json', accept: 'application/json' },
            body: JSON.stringify({ key }),
          })
          let body = null
          try {
            body = await response.json()
          } catch {
            body = null
          }
          if (body) setWallet(body)
          if (response.ok) setConfirmed(true)
          return { ok: response.ok, error: response.ok ? null : (body && body.error) || 'unreachable' }
        } catch {
          return { ok: false, error: 'unreachable' }
        } finally {
          setBusy(false)
        }
      }, [])

      const unlink = React.useCallback(async () => {
        setBusy(true)
        setConfirmed(false)
        try {
          const response = await fetch(WALLET_API, { method: 'DELETE', headers: { accept: 'application/json' } })
          let body = null
          try {
            body = await response.json()
          } catch {
            body = null
          }
          if (body && response.ok) setWallet(body)
          return { ok: response.ok, error: response.ok ? null : (body && body.error) || 'unreachable' }
        } catch {
          return { ok: false, error: 'unreachable' }
        } finally {
          setBusy(false)
        }
      }, [])

      /** A new keystroke makes the previous confirmation stale. */
      const forget = React.useCallback(() => setConfirmed(false), [])

      return { wallet, busy, load, save, unlink, confirmed, forget }
    }

    /**
     * The installed workflows, as the card draws them.
     *
     * THE CARD NEVER READS A FILE ITSELF. This half has no filesystem and no idea
     * where the profile is, so the host answers `/plugins/generate/adapters` from the
     * directory the install writes into (§10). The read needs no key and no network,
     * which is why the card draws on a fresh install like every other start-page card.
     */
    function useAdapters() {
      const [state, setState] = React.useState({ phase: 'loading', entries: [], skipped: [] })

      const load = React.useCallback(async (apply) => {
        try {
          const response = await fetch(ADAPTERS_API, { headers: { accept: 'application/json' } })
          let body = null
          try {
            body = await response.json()
          } catch {
            body = null
          }
          if (!response.ok || !body || !Array.isArray(body.entries)) {
            apply({ phase: 'failed', entries: [], skipped: [] })
            return
          }
          apply({ phase: 'ready', entries: body.entries, skipped: Array.isArray(body.skipped) ? body.skipped : [] })
        } catch {
          apply({ phase: 'failed', entries: [], skipped: [] })
        }
      }, [])

      React.useEffect(() => {
        let live = true
        load((next) => {
          if (live) setState(next)
        })
        return () => {
          live = false
        }
      }, [load])

      // The same read again, for Refresh: a host that did not answer is a state the
      // user can leave, not one they are stuck in.
      const reload = React.useCallback(() => load(setState), [load])
      return { ...state, reload }
    }

    /** A quiet placeholder glyph — the surface's own, not the guide's cube. */
    function GenerateMark() {
      return h(
        'svg',
        {
          style: S.mark,
          width: 28,
          height: 28,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.5,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
          focusable: false,
        },
        h('rect', { x: 3, y: 3, width: 18, height: 18, rx: 4 }),
        h('path', { d: 'M3 15.5l4.5-4.5 3 3L15 10l6 6' }),
        h('circle', { cx: 9, cy: 8, r: 1.5 }),
      )
    }

    /**
     * One note line: the shipped info glyph and one sentence, in the panel's
     * tertiary ink.
     *
     * A component rather than four copies of the same markup, because there are now
     * two notes in two pane states and the glyph is what makes them read as notes
     * instead of as more instructions. The call site passes the data attribute the
     * verify reads the note off, rather than matching a phrase across the page.
     */
    function Note(props) {
      return h(
        'div',
        { style: S.manageHint, ...props.attrs },
        h('span', { style: S.manageIcon }, h(IconInfoOutline14, { size: 12 })),
        h('span', null, props.text),
      )
    }

    /**
     * The account as one line of text. Shared by the strip and the confirmation
     * dialog, so the number the dialog promises is the number the strip shows.
     */
    function balanceParts(t, wallet) {
      const account = (wallet && wallet.account) || {}
      const parts = []
      const coins = count(account.coins)
      if (coins !== null) parts.push(coins + ' ' + t('wallet.coins'))
      if (typeof account.money === 'number') {
        parts.push((account.currency ? account.currency + ' ' : '') + count(account.money))
      }
      if (typeof account.running === 'number' && account.running > 0) {
        parts.push(account.running + ' ' + t('wallet.running'))
      }
      return parts
    }

    /**
     * Where the `credentials` seam says the value came from, in its own words
     * (read from `@deepseek-ai/dsh-credentials-local`, 2026-09-22): `file` is the
     * provider-managed store, which is what a key pasted here becomes; `env` is
     * the inherited process environment; `project-env` and `user-env` are the
     * `.env` fallbacks. This half knew only a `store` string the seam never emits,
     * so the strip called a freshly pasted key "from your environment" on the next
     * read — the accepted feature stating a false fact about its own key. An
     * unknown source now says nothing rather than guessing.
     */
    const STORED_SOURCE = 'file'
    const ENVIRONMENT_SOURCES = ['env', 'project-env', 'user-env']

    /**
     * What a successful save has to say, in the harness's own centered dialog and
     * not in the pane's own column. Three facts, because a saved key on its own
     * says none of them: the key was validated before it was stored, the wallet
     * answered, and the balance the read produced is now at the top of the panel.
     * The last one is the whole point — the founder linked a key, saw no
     * confirmation, and only found the balance after looking away from the button
     * (2026-09-22).
     */
    function SaveDialog({ t, wallet, onClose }) {
      const parts = balanceParts(t, wallet)
      const row = (key, text) =>
        h(
          'div',
          { key, style: S.savedRow },
          h('span', { style: S.savedCheck }, h(IconCheckOutline16, { size: 14 })),
          h('span', null, text),
        )
      return h(
        Modal,
        {
          open: true,
          onClose,
          title: t('saved.title'),
          closeLabel: t('saved.close'),
          description: t('saved.intro'),
          footer: h(
            'button',
            { type: 'button', style: S.primary, 'data-generate-dismiss': 'yes', onClick: onClose },
            t('saved.dismiss'),
          ),
        },
        row('key', t('saved.keyOk')),
        row('wallet', parts.length ? t('saved.walletOk') + ' ' + parts.join(' · ') : t('saved.walletOkBare')),
        h('div', { style: S.savedWhere }, t('saved.where')),
      )
    }

    /**
     * The key field. The error lands here, under the input, because S2's exit
     * criterion is that a bad key fails *at the field* rather than three screens
     * later inside a paid run (§9).
     */
    function KeyForm({ t, onSave, busy, autofocus, accountUrl, onEdit }) {
      const [value, setValue] = React.useState('')
      const [error, setError] = React.useState(null)

      const submit = async (event) => {
        if (event) event.preventDefault()
        const key = value.trim()
        if (!key) {
          setError('key-required')
          return
        }
        const outcome = await onSave(key)
        if (outcome.ok) {
          setValue('')
          setError(null)
        } else {
          setError(outcome.error || 'unreachable')
        }
      }

      return h(
        'form',
        { style: S.formBody, onSubmit: submit },
        h('label', { style: S.label, htmlFor: 'generate-key' }, t('wallet.key.label')),
        h('input', {
          id: 'generate-key',
          style: S.field,
          type: 'password',
          value,
          autoComplete: 'off',
          spellCheck: false,
          autoFocus: !!autofocus,
          placeholder: t('wallet.key.placeholder'),
          'aria-invalid': error ? 'true' : undefined,
          onChange: (event) => {
            setValue(event.target.value)
            if (error) setError(null)
            if (typeof onEdit === 'function') onEdit()
          },
        }),
        error
          ? h(
              'div',
              { style: S.fieldError, role: 'alert' },
              h(IconWarningOutline16, { size: 12 }),
              ' ',
              errorText(t, error),
              // A field error is exactly when a user needs the page that issues
              // keys, so the link stays reachable from the failure too.
              accountUrl
                ? h(
                    'a',
                    { href: accountUrl, target: '_blank', rel: 'noreferrer', style: S.hintLink },
                    t('wallet.key.getKey'),
                  )
                : null,
            )
          : h(
              'div',
              { style: S.hint },
              t('wallet.key.hint'),
              accountUrl
                ? h(
                    'a',
                    { href: accountUrl, target: '_blank', rel: 'noreferrer', style: S.hintLink },
                    t('wallet.key.getKey'),
                  )
                : null,
            ),
        h(
          'div',
          { style: S.row },
          h(
            'button',
            { type: 'submit', style: S.primary, disabled: busy || value.trim() === '' },
            busy ? t('wallet.key.saving') : t('wallet.key.save'),
          ),
        ),
      )
    }

    /** The meter (§9): what is left, whose environment it came from, and the way out to top up. */
    function WalletStrip({ t, wallet }) {
      const parts = balanceParts(t, wallet)
      return h(
        'div',
        { style: S.strip },
        h('span', { style: S.stripValue }, parts.length ? parts.join(' · ') : t('wallet.notLinked')),
        h(
          'span',
          {
            style: S.stripNote,
            // The note's own text is the contract the verify reads; matching the
            // phrase across the page would also hit the replace hint, which says
            // "the one stored on this machine" for a different reason.
            'data-generate-source': wallet.source || 'none',
          },
          wallet.writable === false ? t('settings.readOnly') : null,
          wallet.writable !== false && wallet.source === STORED_SOURCE ? t('wallet.fromStore') : null,
          wallet.writable !== false && ENVIRONMENT_SOURCES.includes(wallet.source)
            ? t('wallet.fromEnvironment')
            : null,
        ),
        wallet.accountUrl
          ? h(
              'a',
              { href: wallet.accountUrl, target: '_blank', rel: 'noreferrer', style: S.link },
              t('wallet.topup'),
              h(IconRightUpOutline16, { size: 12 }),
            )
          : null,
      )
    }

    /**
     * One workflow, whole, for the surface that renders its doors.
     *
     * The pane mounts this per open unit, keyed by name, so switching units mounts
     * a fresh reader rather than reusing the previous file's state.
     */
    function useAdapter(name) {
      const [state, setState] = React.useState({ phase: 'loading', adapter: null })

      React.useEffect(() => {
        let live = true
        const read = async () => {
          try {
            const response = await fetch(ADAPTER_API + '?name=' + encodeURIComponent(name), { headers: { accept: 'application/json' } })
            let body = null
            try {
              body = await response.json()
            } catch {
              body = null
            }
            if (!live) return
            if (!response.ok || !body || !body.doors) {
              setState({ phase: 'failed', adapter: null })
              return
            }
            setState({ phase: 'ready', adapter: body })
          } catch {
            if (live) setState({ phase: 'failed', adapter: null })
          }
        }
        read()
        return () => {
          live = false
        }
      }, [])

      return state
    }

    /**
     * The doors in the order the surface draws them.
     *
     * `ui.order` is the author's order; the primary door leads, because that is the
     * one the user came to fill in; anything the file left out of its order is
     * appended rather than dropped, since a door the app exposes is a door the run
     * will send.
     */
    function doorsInOrder(adapter) {
      const doors = adapter.doors || {}
      const keys = Object.keys(doors)
      const declared = (Array.isArray(adapter.order) ? adapter.order : []).filter((key) => keys.includes(key))
      const all = declared.concat(keys.filter((key) => !declared.includes(key)))
      const primary = all.find((key) => doors[key].primary === true)
      if (primary === undefined) return all
      return [primary].concat(all.filter((key) => key !== primary))
    }

    /** What a door starts at: the app's default, or the first option, or nothing. */
    function defaultFor(door) {
      if (door.default !== undefined) return door.default
      if (door.type === 'select') return Array.isArray(door.options) && door.options.length > 0 ? door.options[0] : ''
      if (door.type === 'number') return door.min !== undefined ? door.min : ''
      return ''
    }

    /** One card on the pane's first screen: the whole card opens that workflow. */
    function UnitCard({ t, unit, onOpen }) {
      return h(
        'button',
        {
          type: 'button',
          style: S.card,
          'data-generate-unit': unit.name,
          onClick: () => onOpen(unit.name),
        },
        unit.cover ? h('img', { src: unit.cover, alt: '', style: S.cardCover }) : null,
        h(
          'span',
          { style: S.cardBody },
          h('span', { style: S.cardTitle }, unit.title),
          unit.blurb ? h('span', { style: S.cardBlurb }, unit.blurb) : null,
          // Whose app it is. The API cannot say, so the adapter is where a person
          // said it, and this is where a reader is told (§2).
          unit.origin === 'community' ? h('span', { style: S.cardMark }, t('card.community')) : null,
        ),
      )
    }

    /**
     * One workflow's surface, inside the pane.
     *
     * §10's "doors as controls in `ui.order`, `primary` first": `label` is the
     * visible name, the app's own tooltip sits under the control, `advanced` doors
     * sit behind one disclosure, and NO node id and no field name is ever drawn —
     * those belong to the payload gate, as JSON to read.
     *
     * THE FORM IS REAL AND NOTHING SUBMITS. Every control carries the app's own
     * bounds, options and default, and holds what the user types; the payload gate,
     * the run strip and the result are the next slice (§10, S5), and the line at the
     * foot says so rather than leaving a button that lies.
     */
    function WorkflowSurface({ t, name, onBack }) {
      const { phase, adapter } = useAdapter(name)
      const [values, setValues] = React.useState({})
      const [showAdvanced, setShowAdvanced] = React.useState(false)

      // Depends on the adapter arriving: the doors are what the defaults come from.
      React.useEffect(() => {
        if (phase !== 'ready' || !adapter) return
        const start = {}
        for (const key of Object.keys(adapter.doors)) start[key] = defaultFor(adapter.doors[key])
        setValues(start)
      }, [phase])

      const set = (key) => (event) => {
        const next = event.target.value
        setValues((current) => ({ ...current, [key]: next }))
      }

      const head = h(
        'div',
        { style: S.surfaceHead },
        h('button', { type: 'button', style: S.ghost, 'data-generate-back': 'yes', onClick: onBack }, t('surface.back')),
      )

      if (phase !== 'ready' || !adapter) {
        return h(
          'div',
          { style: S.surface, 'data-generate-surface': phase },
          head,
          h('div', { style: S.hint }, phase === 'failed' ? t('surface.failed') : t('surface.loading')),
        )
      }

      const keys = doorsInOrder(adapter)
      const main = keys.filter((key) => adapter.doors[key].advanced !== true)
      const advanced = keys.filter((key) => adapter.doors[key].advanced === true)

      const control = (key) => {
        const door = adapter.doors[key]
        const value = values[key] === undefined ? defaultFor(door) : values[key]
        const shared = { style: S.input, id: 'generate-door-' + key, 'data-generate-door': key, onChange: set(key) }
        if (door.type === 'select') {
          return h(
            'select',
            { ...shared, value },
            (door.options || []).map((option) => h('option', { key: option, value: option }, option)),
          )
        }
        if (door.type === 'number') {
          return h('input', { ...shared, type: 'number', value, min: door.min, max: door.max, step: door.step })
        }
        if (door.type === 'image') {
          // Closing an image door is local state until the run path uploads it:
          // `POST /task/openapi/upload` is part of that slice, and a picker that
          // pretended to have sent something would be worse than one that does not.
          return h(
            'label',
            { style: S.imageBox, htmlFor: 'generate-door-' + key },
            h(IconSparkle16, { size: 12 }),
            h('span', null, t('surface.image.choose')),
            h('input', { id: 'generate-door-' + key, 'data-generate-door': key, type: 'file', accept: 'image/*', style: { display: 'none' }, onChange: set(key) }),
          )
        }
        return door.multiline === true
          ? h('textarea', { ...shared, style: { ...S.input, ...S.multiline }, rows: 4, value })
          : h('input', { ...shared, type: 'text', value })
      }

      const doorRow = (key) =>
        h(
          'div',
          { key, 'data-generate-door-row': key },
          h('label', { style: S.label, htmlFor: 'generate-door-' + key }, adapter.doors[key].label),
          control(key),
          adapter.doors[key].hint ? h('div', { style: S.hint }, adapter.doors[key].hint) : null,
        )

      return h(
        'div',
        { style: S.surface, 'data-generate-surface': 'ready', 'data-generate-unit': adapter.name },
        head,
        h('div', { style: S.title }, adapter.title),
        adapter.blurb ? h('div', { style: S.body }, adapter.blurb) : null,
        ...main.map(doorRow),
        advanced.length > 0
          ? h(
              'button',
              {
                type: 'button',
                style: S.disclosure,
                'data-generate-advanced': showAdvanced ? 'open' : 'closed',
                onClick: () => setShowAdvanced((open) => !open),
              },
              (showAdvanced ? t('surface.advanced.hide') : t('surface.advanced')) + ' (' + advanced.length + ')',
            )
          : null,
        showAdvanced ? advanced.map(doorRow) : null,
        h(Note, { text: t('surface.pending'), attrs: { 'data-generate-run-pending': 'yes' } }),
      )
    }

    /** Stage two: the body, under the type's own id. */
    function GeneratePane(props) {
      const t = translatorOf(props)
      const { wallet, busy, load, save, confirmed, forget } = useWallet()
      const units = useAdapters()
      const [chosen, setChosen] = React.useState(null)

      // A tab may be opened at a unit by an opener that passed `params.unit`; the
      // card carries no params, so the first screen is normally the list. `null`
      // means "the user has not chosen yet".
      const tab = typeof props.useTabInfo === 'function' ? props.useTabInfo() : null
      const requested = tab && tab.tab && tab.tab.navigation ? tab.tab.navigation.params : null
      const asked = requested && typeof requested.unit === 'string' ? requested.unit : null
      const installed = units.entries.some((entry) => entry.name === asked)
      const active = chosen === null ? (installed ? asked : null) : chosen || null

      if (wallet === null) {
        return h('div', { style: S.root, 'data-generate-pane': 'loading' }, h('div', { style: S.empty }, h('div', { style: S.body }, t('pane.loading'))))
      }

      if (!wallet.linked) {
        return h(
          'div',
          { style: S.root, 'data-generate-pane': 'first-run' },
          h(
            'div',
            { style: S.form, 'data-generate-first-run': 'yes' },
            h(GenerateMark, null),
            h('div', { style: S.title }, t('pane.first.title')),
            h('div', { style: S.body }, t('pane.first.body')),
            h(KeyForm, { t, onSave: save, busy, autofocus: true, accountUrl: wallet.accountUrl, onEdit: forget }),
            // The pane can link a key but cannot change or remove one, so the
            // place that can is named here, where the person first meets the field.
            h(Note, {
              text: t('pane.first.manage'),
              attrs: { 'data-generate-manage-hint': 'yes' },
            }),
            // And how an app gets added, under the key directions: linking a wallet
            // is the first thing this screen asks for, and adding a workflow is the
            // next one, so both answers sit together (founder, 2026-09-22).
            h(Note, {
              text: t('pane.add.hint'),
              attrs: { 'data-generate-add-hint': 'yes' },
            }),
          ),
        )
      }

      return h(
        'div',
        { style: S.root, 'data-generate-pane': active === null ? 'home' : 'unit' },
        // The link just happened. The dialog says the key works, that the wallet
        // answered, and where the balance went; the strip below it is the thing
        // the dialog is pointing at.
        confirmed && active === null ? h(SaveDialog, { t, wallet, onClose: forget }) : null,
        h(WalletStrip, { t, wallet }),
        wallet.error
          ? h(
              'div',
              { style: S.warn, role: 'alert' },
              h(IconWarningOutline16, { size: 14 }),
              // A stored key that stopped working is a different fact from a
              // field that was just typed into, and the fix is different too.
              h('span', null, wallet.error === 'invalid-key' ? t('error.storedKeyRejected') : errorText(t, wallet.error)),
            )
          : null,
        // ONE PANE HOLDS EVERY WORKFLOW SURFACE (founder, 2026-09-22). The first
        // screen is the cards; a card opens that workflow's surface in place, and the
        // way back is the surface's own first control.
        active === null
          ? units.entries.length > 0
            ? h(
                'div',
                { style: S.cards, 'data-generate-cards': String(units.entries.length) },
                units.entries.map((unit) => h(UnitCard, { key: unit.name, t, unit, onOpen: setChosen })),
              )
            : units.phase === 'failed'
              ? h(
                  'div',
                  { style: S.empty, 'data-generate-list-failed': 'yes' },
                  h(GenerateMark, null),
                  h('div', { style: S.title }, t('pane.list.failed')),
                )
              : h(
                  'div',
                  { style: S.empty, 'data-generate-none': 'yes' },
                  h(GenerateMark, null),
                  h('div', { style: S.title }, t('pane.empty.title')),
                  h('div', { style: S.body }, t('pane.empty.body')),
                )
          : h(WorkflowSurface, { key: active, t, name: active, onBack: () => setChosen('') }),
        active === null
          ? h(
              'div',
              { style: S.cards },
              // The directions sit under the screen they explain, not at the top of
              // the pane: this is the surface a person returns to when they rotate
              // the key.
              h(Note, {
                text: t('pane.linked.manage'),
                attrs: { 'data-generate-manage-hint': 'yes' },
              }),
              // And under those, how to add an app: this is the screen a person
              // lands on with a linked wallet, so the one action that fills it has
              // to be on it, in words they can repeat into the chat.
              h(Note, {
                text: t('pane.add.hint'),
                attrs: { 'data-generate-add-hint': 'yes' },
              }),
            )
          : null,
        active === null
          ? h(
              'div',
              { style: { ...S.row, justifyContent: 'center', paddingBottom: 20 } },
              h(
                'button',
                {
                  type: 'button',
                  style: S.ghost,
                  // Both reads again: the wallet and the installed list.
                  onClick: () => {
                    load()
                    units.reload()
                  },
                  disabled: busy,
                  title: t('wallet.refresh'),
                },
                h(IconRefreshOutline16, { size: 12 }),
                ' ',
                t('wallet.refresh'),
              ),
            )
          : null,
      )
    }

    /**
     * Removing the stored key: one dialog with two states, the question and the
     * receipt. It asks first because a key is a secret that was hard to get and is
     * deleted in one click; it says afterwards that RunningHub still holds the key,
     * because that is what makes going back to a linked wallet possible at all.
     * Creation of a new key on RunningHub is the other half of rotation, and that
     * needs no dialog: the field replaces whatever is stored.
     */
    function RemoveKeyDialog({ t, stage, busy, error, onCancel, onRemove, onClose }) {
      const done = stage === 'done'
      return h(
        Modal,
        {
          open: true,
          onClose: busy ? () => {} : onClose,
          title: done ? t('remove.doneTitle') : t('remove.title'),
          closeLabel: t('saved.close'),
          description: done ? t('remove.doneIntro') : t('remove.intro'),
          footer: done
            ? h(
                'button',
                { type: 'button', style: S.primary, 'data-generate-remove-done': 'yes', onClick: onClose },
                t('saved.dismiss'),
              )
            : h(
                'div',
                { style: S.row },
                h('button', { type: 'button', style: S.ghost, disabled: busy, onClick: onCancel }, t('remove.cancel')),
                h(
                  'button',
                  {
                    type: 'button',
                    style: S.danger,
                    disabled: busy,
                    'data-generate-remove-confirm': 'yes',
                    onClick: onRemove,
                  },
                  busy ? t('remove.pending') : t('remove.confirm'),
                ),
              ),
        },
        error
          ? h(
              'div',
              { style: S.fieldError, role: 'alert' },
              h(IconWarningOutline16, { size: 12 }),
              ' ',
              errorText(t, error),
            )
          : null,
        done
          ? h(
              'div',
              { style: S.savedRow },
              h('span', { style: S.savedCheck }, h(IconCheckOutline16, { size: 14 })),
              h('span', null, t('remove.gone')),
            )
          : null,
      )
    }

    /** The settings page: where a working key is replaced or removed. */
    function GenerateSettings(props) {
      const t = translatorOf(props)
      const { wallet, busy, save, unlink, confirmed, forget } = useWallet()
      // null · 'ask' · 'done'. The question and the receipt are the same dialog.
      const [removing, setRemoving] = React.useState(null)
      const [removeError, setRemoveError] = React.useState(null)

      if (wallet === null) {
        return h('div', { style: S.page }, h('div', { style: S.body }, t('pane.loading')))
      }

      const askRemove = () => {
        setRemoveError(null)
        setRemoving('ask')
      }
      const cancelRemove = () => {
        setRemoveError(null)
        setRemoving(null)
      }
      const confirmRemove = async () => {
        setRemoveError(null)
        const outcome = await unlink()
        if (outcome.ok) {
          forget()
          setRemoving('done')
        } else {
          setRemoveError(outcome.error || 'unreachable')
        }
      }
      // Editing the field is the other way out of a removed key: the confirmation
      // is about the last action, so a new one takes it away.
      const edited = () => {
        forget()
        setRemoveError(null)
        if (removing === 'done') setRemoving(null)
      }

      return h(
        'div',
        { style: S.page, 'data-generate-settings': wallet.linked ? 'linked' : 'unlinked' },
        confirmed ? h(SaveDialog, { t, wallet, onClose: forget }) : null,
        removing ? h(RemoveKeyDialog, {
          t,
          stage: removing,
          busy,
          error: removeError,
          onCancel: cancelRemove,
          onRemove: confirmRemove,
          onClose: cancelRemove,
        }) : null,
        h('div', { style: S.title }, t('settings.title')),
        h('div', { style: S.body }, t('settings.body')),
        wallet.linked ? h(WalletStrip, { t, wallet }) : null,
        wallet.linked && wallet.writable === false
          ? h('div', { style: S.hint }, t('settings.readOnly'))
          : h(
              React.Fragment,
              null,
              wallet.linked ? h('div', { style: S.hint }, t('wallet.replace.hint')) : null,
              h(KeyForm, { t, onSave: save, busy, accountUrl: wallet.accountUrl, onEdit: edited }),
            ),
        wallet.linked && wallet.writable !== false
          ? h(
              'div',
              { style: S.row },
              h(
                'button',
                { type: 'button', style: S.ghost, disabled: busy, 'data-generate-remove': 'yes', onClick: askRemove },
                t('remove.action'),
              ),
            )
          : null,
      )
    }

    /** The chip's live text. Thunked copy is read again on every use, not captured. */
    function GenerateTitle(props) {
      return translatorOf(props)('type.label')
    }

    /**
     * The card's glyph.
     *
     * The guide draws a declared icon in the surrounding ink, which is the grey
     * the Browser globe reads as. The shipped cards that carry a colour do it
     * inside the glyph: Files' folder is painted per type by a class in its own
     * stylesheet, Terminal's card is a black rect. A bundle with no stylesheet
     * says the same thing inline, so Generate follows the pattern and paints the
     * shipped sparkle in the theme's primary — a token with its own light and
     * dark value, so the card tracks the brand under EVA and under the stock
     * theme alike (§5 rule 9).
     */
    function GenerateGuideIcon({ size = 26 } = {}) {
      return h(
        'span',
        { style: { display: 'inline-flex', color: 'var(--dsw-alias-brand-primary)' } },
        h(IconSparkle16, { size }),
      )
    }

    /** Stage one: what a `generate` page IS. */
    function generateDefinition(t) {
      return {
        id: GENERATE_ID,
        kind: GENERATE_KIND,
        // A type from outside the product, which is what this is in any DSH.
        priority: 'extension',
        title: () => t('type.label'),
        guide: [
          {
            id: 'open',
            order: 45,
            title: () => t('guide.title'),
            description: () => t('guide.description'),
            // Without one, the guide draws its cube placeholder, which reads as
            // unfinished beside the shipped cards.
            icon: GenerateGuideIcon,
          },
        ],
      }
    }

    const inject = ['slots', 'locale', 'sidebarRightTabs']

    /**
     * Every registration goes through `ctx.effect`, so unloading the row takes
     * the type, its body, its chip, its card and its settings page with it.
     * Disposal is the plugin manager's whole safety net; a bare register() would
     * leak into the next mount.
     */
    function apply(ctx) {
      const t = ctx.locale.bind(NS)
      ctx.effect(() => ctx.locale.register(NS, { en: EN, zh: ZH }), 'runninghub.copy')
      ctx.effect(() => ctx.sidebarRightTabs.register(generateDefinition(t)), 'runninghub.type')
      ctx.effect(
        () =>
          ctx.slots.inject('sidebar.right.pane.tab', () =>
            ctx.slots.register(
              { name: 'sidebar.right.pane.tab', key: GENERATE_ID, locale: NS },
              GeneratePane,
            ),
          ),
        'runninghub.body',
      )
      ctx.effect(
        () =>
          ctx.slots.inject('sidebar.right.pane.tab.title', () =>
            ctx.slots.register(
              { name: 'sidebar.right.pane.tab.title', key: GENERATE_ID, locale: NS },
              GenerateTitle,
            ),
          ),
        'runninghub.title',
      )
      // THE GUIDE CARD IS THE HARNESS'S OWN (founder, 2026-09-22). An earlier cut of
      // this slice registered a renderer at `sidebar.right.tab.guide.entry` that
      // turned the card into the installed list with a flyout. That was wrong twice
      // over: the card stopped saying what it opens (with one workflow installed it
      // became that workflow's own title), and the list belongs INSIDE the surface,
      // not on the door. So nothing is registered here, the guide draws its standard
      // card from the type's `guide[]` entry, and the pane below holds every
      // workflow surface.
      // The key is changed or unlinked here once the pane is in use (§9).
      ctx.effect(
        () =>
          ctx.slots.inject('settings.section', () =>
            ctx.slots.register(
              {
                name: 'settings.section',
                id: 'runninghub-wallet',
                order: 17,
                // Without this the page body keeps the language it first rendered
                // in: the nav label is a thunk and re-reads, the page is not.
                locale: NS,
                label: () => t('type.label'),
              },
              GenerateSettings,
            ),
          ),
        'runninghub.settings',
      )
    }

    return { inject, apply }
  },
})
