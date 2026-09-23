// @muen/dsh-generate — browser half (Epic 61, provider-neutral).
//
// WHAT THIS REGISTERS:
//
//   the type      a `generate` page type in the right column: opened by kind, one
//                 page per pane (no `multiple` yet — see below), chip text from
//                 `type.label`.
//   its body      the keyed `sidebar.right.pane.tab` seat under this package's id.
//   its chip      the keyed `sidebar.right.pane.tab.title` seat under the same id.
//   its card      the guide entry that puts "Generate" on the right panel's start
//                 page beside "Workspace files", "New terminal" and "Browser". It is
//                 the HARNESS'S OWN standard card: no renderer of ours is registered,
//                 because a card that lists workflows stops saying what it opens
//                 (founder, 2026-09-22). Its title is the surface's own label, not a
//                 provider's (founder, 2026-09-23: "Generate with Runninghub should be
//                 Generate").
//   its settings  ONE `settings.section` page listing every provider, in the Models →
//                 Providers shape (founder, 2026-09-23: *"use the models settings
//                 design for generate settings"*): the section's own title and intro,
//                 a row per provider with a credential dot, its family and the state
//                 of its key, and one open editor card at a time whose primary field
//                 is the API key. `settings.section` is a list slot, so a plugin per
//                 provider would be one Generate page per provider, which is exactly
//                 what the founder ruled out.
//
// ONE PLUGIN, SEVERAL PROVIDERS (founder, 2026-09-22). Four are registered in the host
// half (Krea, Magnific, RunningHub, Comfy Cloud), image providers first. The pane is
// the hub: a meter per linked provider, then a card per installed workflow from every
// provider, and a card opens that workflow's surface in the same pane. The provider
// list, each provider's key and each provider's workflows come from the host over
// `/plugins/generate/providers/…`; the browser half never reads a file and never
// holds a key.
//
// WHAT MODELS DOES THAT THIS CANNOT (founder, 2026-09-23: *"it should be analogous to
// models except we don't fetch the model, we add the workflow using prompt"*): a model
// list is fetched from the provider over the API, and a workflow is installed by the
// agent from a link the user gives it. So the open card carries the install sentence
// and a Copy control instead of a discovery button — a plugin cannot type into the
// composer, and a slash command cannot start a turn (measured 2026-09-22).
//
// THE RUN IS NOT HERE. The surface renders the doors as controls, in `ui.order`, with
// the app's own bounds and defaults, and nothing is submitted: the payload gate, the
// run strip and the result are the next slice (§10, S5). The surface says so at its
// foot rather than offering a button that lies.
//
// THE KEY NEVER REACHES THIS HALF (§12 rule 2). This file has no key in state beyond
// the field being typed into, no `localStorage`, and no route that returns one: a
// save posts the value once, and every read afterwards is a balance. That is why the
// browser half cannot check whether a key is still valid — it asks the host, and the
// host answers with the account.
//
// `multiple` IS DELIBERATELY ABSENT. One pane holds every surface, so a second tab of
// the same kind would only duplicate the hub (§10).
//
// NOTHING MUEN-SPECIFIC IS IN HERE (§5 rule 1): only upstream `@deepseek-ai/*`
// services, the harness's own theme aliases, and this package's own copy.
//
// Loader format: one self-contained script registered via window.__ModuleLoader__.
// React arrives through factory(require); the right-panel registry and the slot
// registry arrive on ctx.
window.__ModuleLoader__.load({
  id: '@muen/dsh-generate',
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
    const GENERATE_ID = '@muen/dsh-generate'
    /** The kind `openTab` names and the guide card opens. */
    const GENERATE_KIND = 'generate'
    /** This package's namespace in the client locale registry. */
    const NS = 'generate'
    /**
     * The host's provider routes. One plugin, several providers (founder,
     * 2026-09-22): the list carries each provider's key state and its workflow count,
     * and everything else hangs off the provider's own id — its key, its installed
     * workflows, and one workflow by name.
     */
    const PROVIDERS_API = '/plugins/generate/providers'
    /** `<providers>/<id>/<action>`, with the id escaped: it is data, not a path. */
    const providerUrl = (id, action) => PROVIDERS_API + '/' + encodeURIComponent(id) + '/' + action

    const EN = {
      'type.label': 'Generate',
      'guide.title': 'Generate',
      'guide.description': 'Run your workflows here',
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
      // The field names its provider out loud — "Krea API key", "RunningHub API key" —
      // so the label is the provider's own label plus this suffix, and four providers
      // on one page stay tellable apart.
      'key.label.suffix': 'API key',
      'wallet.key.placeholder': 'Paste your key',
      'wallet.key.hint': 'Your key is on your account page, under',
      // The account page that issues keys is not linked from anywhere obvious; the
      // founder had to search for it (2026-09-22). So the hint ends in a link straight
      // to that page rather than directions to go and find it, and the link's own text
      // comes from the provider: its key page is a different page in every case.
      'wallet.key.getKey': 'API keys',
      'wallet.key.save': 'Save',
      'wallet.key.saving': 'Checking…',
      // A save that worked opens a confirmation. The strip is the proof, but it
      // sits above the fold of the pane and the person who just pressed Save is
      // looking at the button (founder, 2026-09-22: the balance was there and he
      // missed it). The dialog is what says the key works, that the wallet
      // answered, and where the balance now lives.
      'saved.title': 'Key valid. Wallet linked.',
      'saved.titlePlain': 'Key saved.',
      'saved.unverifiedTitle': 'Key saved, not checked.',
      'saved.close': 'Close',
      'saved.intro': 'The provider accepted the key and answered your account, so both work.',
      'saved.introPlain': 'The provider accepted the key, so it works. It is stored on this machine only.',
      'saved.unverifiedIntro': 'The provider did not confirm this key, so it is stored unchecked.',
      'saved.keyOk': 'The key works: the provider validated it before storing it.',
      'saved.keyOkPlain': 'The key works: the provider checked it before storing it.',
      'saved.walletOk': 'Your wallet is readable:',
      'saved.unverified': 'A run may be refused until the provider confirms it. The row says why.',
      'saved.where': 'The balance now sits at the top left of this panel, beside the Account link.',
      'saved.dismiss': 'Got it',
      'wallet.coins': 'coins',
      'wallet.running': 'running',
      'wallet.refresh': 'Refresh the balance',
      'wallet.notLinked': 'No key linked',
      'wallet.fromEnvironment': 'from your environment',
      'wallet.fromStore': 'stored on this machine',
      // ONE settings page for every provider (founder, 2026-09-22), so the title is
      // the surface's and each provider's own name is drawn on its own row. The page
      // is the Models → Providers shape (founder, 2026-09-23: *"use the models settings
      // design for generate settings"*): a row per provider, one open card at a time,
      // and the API key is the primary field on every card. What Models fills with a
      // fetched model list, Generate fills by installing a workflow through the agent.
      'settings.title': 'Generate',
      'settings.body': 'Each provider keeps its own key on this machine. The browser never sees it.',
      'settings.kind.image': 'Image',
      'settings.kind.workflow': 'Workflows',
      'settings.row.setup': 'Set up',
      'settings.row.edit': 'Edit',
      'settings.row.close': 'Close',
      'settings.account': 'Account',
      'settings.linked': 'Key saved',
      'settings.linked.unverified': 'Saved, not checked',
      'settings.workflows.title': 'Workflows',
      'settings.workflows.none': 'No workflows installed yet.',
      'settings.workflows.one': 'workflow installed',
      'settings.workflows.many': 'workflows installed',
      'settings.workflows.unknown': 'Workflows could not be read.',
      'settings.workflows.doors': 'inputs',
      'settings.workflows.add': 'To add one, ask the agent in chat:',
      'settings.workflows.copy': 'Copy',
      'settings.workflows.copied': 'Copied',
      // Two providers answer about a key without accepting it, and the difference
      // matters: one subscription has lapsed, and the other is an entitlement Magnific
      // never confirms. Neither is a bad key, so neither is called one.
      'note.subscription-inactive': 'The key works, but this account has no active Comfy Cloud subscription, so a run would be refused.',
      'note.not-entitled': 'Magnific answered the key but did not confirm access, so it is stored unchecked.',
      'pane.noProviders': 'This build has no providers registered.',
      // Rotation is a normal act, not an edge case: a person creates a new key on
      // RunningHub and pastes it here. The hint says the field is the way to do
      // that, and the remove dialog is the way to go back to nothing.
      'wallet.replace.hint': 'Pasting a key here replaces the one stored on this machine.',
      'remove.action': 'Remove key',
      'remove.title': 'Remove the stored key?',
      'remove.intro': 'It is deleted from this machine. The key itself still exists at the provider, so the same one can be pasted here again.',
      'remove.confirm': 'Remove key',
      'remove.cancel': 'Cancel',
      'remove.pending': 'Removing…',
      'remove.doneTitle': 'Key removed.',
      'remove.doneIntro': 'This machine no longer holds a key for this provider.',
      'remove.gone': 'The stored key is gone. Paste a key to link this provider again.',
      'remove.failed': 'The key could not be removed.',
      'settings.readOnly': 'This key comes from your environment, so it cannot be changed or unlinked here.',
      'error.keyRequired': 'Paste a key first.',
      'error.keyCharacters': 'That key has a line break or a character an API key cannot contain. Copy it again from the provider page.',
      'error.invalidKey': 'That key was not accepted.',
      'error.unreachable': 'The provider could not be reached. Check your connection and try again.',
      'error.timeout': 'The provider did not answer in time. Try again.',
      'error.unexpected': 'The provider answered in a way this plugin does not understand.',
      'error.host': 'The Generate service did not answer this request. Restart the app and try again.',
      'error.readOnly': 'That key is fixed by your environment, so it cannot be changed here.',
      'error.noCredentials': 'This harness has no credential store, so the key cannot be saved.',
      'error.generic': 'The key could not be saved.',
      'error.storedKeyRejected': 'The stored key is no longer accepted. Link a new one in Settings.',
    }

    const ZH = {
      'type.label': '生成',
      'guide.title': '生成',
      'guide.description': '在这里运行你的工作流',
      'surface.back': '全部工作流',
      'surface.loading': '正在读取工作流…',
      'surface.failed': '无法读取该工作流。',
      'surface.advanced': '高级',
      'surface.advanced.hide': '收起高级选项',
      'surface.pending': '运行功能稍后提供：付费前的载荷确认与运行状态尚未构建。',
      'card.community': '他人的应用',
      'surface.image.choose': '选择图片',
      'pane.loading': '正在检查密钥…',
      'pane.first.title': '连接服务商账户',
      'pane.first.body': '粘贴你的 API 密钥。现在就会校验，并且只保存在这台机器上。',
      'pane.first.manage': '之后可以在「设置 → 生成」里修改或移除这个密钥。设置菜单位于左侧边栏底部。',
      'pane.linked.manage': '在「设置 → 生成」里修改或移除密钥。设置菜单位于左侧边栏底部。',
      // 引号内的指令保持英文：它就是技能 whenToUse 里写的那句，翻译会让这行失去作用。
      'pane.add.hint': '要添加工作流，在对话里对智能体说：「add this RunningHub workflow <app link>」。',
      'pane.empty.title': '还没有安装应用',
      'pane.empty.body': '你添加的 RunningHub 应用会在这里打开，每个应用一张卡片。',
      'pane.list.failed': '无法读取已安装的工作流。',
      'key.label.suffix': 'API 密钥',
      'wallet.key.placeholder': '粘贴你的密钥',
      'wallet.key.hint': '密钥在你的账户页面里：',
      'wallet.key.getKey': 'API 密钥',
      'wallet.key.save': '保存',
      'wallet.key.saving': '校验中…',
      'saved.title': '密钥有效，钱包已连接。',
      'saved.titlePlain': '密钥已保存。',
      'saved.unverifiedTitle': '密钥已保存，未校验。',
      'saved.close': '关闭',
      'saved.intro': '服务商接受了密钥并返回了账户信息，两项都可用。',
      'saved.introPlain': '服务商接受了密钥，可以使用。密钥只保存在这台机器上。',
      'saved.unverifiedIntro': '服务商没有确认这个密钥，因此仅保存、未校验。',
      'saved.keyOk': '密钥可用：服务商在保存前已校验通过。',
      'saved.keyOkPlain': '密钥可用：服务商在保存前已检查过。',
      'saved.walletOk': '钱包信息可以读取：',
      'saved.unverified': '在服务商确认之前，运行可能被拒绝。原因显示在该服务商那一行。',
      'saved.where': '余额现在显示在此面板左上角，旁边就是「账户」链接。',
      'saved.dismiss': '知道了',
      'wallet.coins': '金币',
      'wallet.running': '个任务运行中',
      'wallet.refresh': '刷新余额',
      'wallet.notLinked': '未连接密钥',
      'wallet.fromEnvironment': '来自环境变量',
      'wallet.fromStore': '保存在本机',
      'settings.title': '生成',
      'settings.body': '每个服务商的密钥都保存在这台机器上，浏览器不会看到它。',
      'settings.kind.image': '图像',
      'settings.kind.workflow': '工作流',
      'settings.row.setup': '设置',
      'settings.row.edit': '编辑',
      'settings.row.close': '收起',
      'settings.account': '账户',
      'settings.linked': '密钥已保存',
      'settings.linked.unverified': '已保存，未校验',
      'settings.workflows.title': '工作流',
      'settings.workflows.none': '还没有安装工作流。',
      'settings.workflows.one': '个工作流已安装',
      'settings.workflows.many': '个工作流已安装',
      'settings.workflows.unknown': '无法读取工作流。',
      'settings.workflows.doors': '个输入',
      'settings.workflows.add': '要添加工作流，请在对话里对智能体说：',
      'settings.workflows.copy': '复制',
      'settings.workflows.copied': '已复制',
      'note.subscription-inactive': '密钥可用，但此账户没有有效的 Comfy Cloud 订阅，运行会被拒绝。',
      'note.not-entitled': 'Magnific 回应了密钥但没有确认访问权限，因此仅保存、未校验。',
      'pane.noProviders': '此版本没有注册任何服务商。',
      'wallet.replace.hint': '在这里粘贴密钥会替换本机已保存的那个。',
      'remove.action': '移除密钥',
      'remove.title': '移除已保存的密钥？',
      'remove.intro': '密钥会从这台机器上删除。服务商那边的密钥仍然存在，同一个密钥可以再次粘贴到这里。',
      'remove.confirm': '移除密钥',
      'remove.cancel': '取消',
      'remove.pending': '正在移除…',
      'remove.doneTitle': '密钥已移除。',
      'remove.doneIntro': '这台机器上不再保存该服务商的密钥。',
      'remove.gone': '已保存的密钥已删除。粘贴密钥即可重新连接该服务商。',
      'remove.failed': '密钥移除失败。',
      'settings.readOnly': '此密钥来自环境变量，无法在这里修改或解除。',
      'error.keyRequired': '请先粘贴密钥。',
      'error.keyCharacters': '这个密钥里有换行，或 API 密钥不可能包含的字符。请回到服务商页面重新复制。',
      'error.invalidKey': '该密钥未被接受。',
      'error.unreachable': '无法连接服务商，请检查网络后重试。',
      'error.timeout': '服务商没有及时响应，请重试。',
      'error.unexpected': '服务商返回了本插件无法识别的响应。',
      'error.host': 'Generate 服务没有回应这次请求。请重启应用后重试。',
      'error.readOnly': '该密钥由环境变量固定，无法在这里修改。',
      'error.noCredentials': '此环境没有凭据存储，密钥无法保存。',
      'error.generic': '密钥保存失败。',
      'error.storedKeyRejected': '已保存的密钥不再被接受。请在设置中连接新的密钥。',
    }

    /**
     * Host error codes → copy. An `http-<n>` or an unknown code falls to generic.
     *
     * `unreachable` means the request itself failed — the page could not reach this
     * app's own host. `host-error` is the other thing: the host answered, and the
     * answer was not one this page can read (a 404 with no body, say). Keeping them
     * apart is the fix for 2026-09-23, when a route the harness never matched came
     * back 404 and the pane told the founder to check his connection.
     */
    const ERROR_KEYS = {
      'key-required': 'error.keyRequired',
      'key-characters': 'error.keyCharacters',
      'invalid-key': 'error.invalidKey',
      unreachable: 'error.unreachable',
      timeout: 'error.timeout',
      'unexpected-response': 'error.unexpected',
      'host-error': 'error.host',
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
      /** A strip row's provider name. Drawn only when more than one is linked. */
      stripLabel: {
        fontWeight: 600,
        whiteSpace: 'nowrap',
        color: 'var(--dsw-alias-label-secondary)',
      },
      /**
       * THE SETTINGS PAGE, IN THE MODELS → PROVIDERS SHAPE (founder, 2026-09-23:
       * *"use the models settings design for generate settings"*).
       *
       * Every number here is the shipped Models page's own: a 720px column, a 16px
       * title over a 14px intro, 8px between rows, each row a 16px-radius card with a
       * 12/14px padding, an 8px credential dot, a 4px-radius family tag, and an editor
       * card on the platform module background at 12px radius. The plugin has no
       * stylesheet (a bundle's client half is one script), so they are inline and the
       * values are read from `ModelsSection.module.css` rather than invented.
       */
      settingsPage: {
        margin: '0 auto',
        padding: '20px 18px 28px',
        width: '100%',
        maxWidth: 720,
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        textAlign: 'left',
      },
      settingsTitle: {
        margin: 0,
        fontSize: 16,
        fontWeight: 500,
        lineHeight: '24px',
        color: 'var(--dsw-alias-label-primary)',
      },
      settingsIntro: {
        margin: 0,
        fontSize: 14,
        lineHeight: '22px',
        color: 'var(--dsw-alias-label-tertiary)',
      },
      rows: {
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        margin: '12px 0 0',
        padding: 0,
        listStyle: 'none',
      },
      rowCard: {
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        padding: '12px 14px',
        border: '.5px solid var(--dsw-alias-border-l4)',
        borderRadius: 16,
      },
      rowHead: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      },
      rowIdentity: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        minWidth: 0,
      },
      rowName: {
        fontSize: 14,
        fontWeight: 500,
        lineHeight: '22px',
        color: 'var(--dsw-alias-label-primary)',
      },
      rowTag: {
        flex: 'none',
        padding: '1px 6px',
        fontSize: 11,
        lineHeight: '16px',
        color: 'var(--dsw-alias-label-secondary)',
        border: '.5px solid var(--dsw-alias-border-l3)',
        borderRadius: 4,
      },
      rowActions: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        marginLeft: 'auto',
      },
      /** The credential dot: green answered, amber answered-with-a-caveat, red
       * refused, hollow not linked yet. Paired with the row's own sentence, because a
       * dot alone is not a fact a person can act on. */
      dot: {
        display: 'inline-block',
        flex: 'none',
        boxSizing: 'border-box',
        width: 8,
        height: 8,
        borderRadius: '50%',
      },
      dotOk: { background: 'var(--dsw-alias-state-success-primary)' },
      dotWarn: { background: 'var(--dsw-alias-state-warn-primary)' },
      dotBad: { background: 'var(--dsw-alias-state-error-primary)' },
      dotNone: { border: '.5px solid var(--dsw-alias-border-l3)' },
      rowSummary: {
        fontSize: 12,
        lineHeight: '18px',
        color: 'var(--dsw-alias-label-secondary)',
      },
      summaryWarn: { color: 'var(--dsw-alias-state-warn-label)' },
      summaryError: { color: 'var(--dsw-alias-state-error-primary)' },
      /** The open card: the Models editor's own background and radius. */
      editor: {
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        padding: '14px 16px',
        background: 'var(--dsw-alias-bg-module-platform)',
        borderRadius: 12,
      },
      fieldGroup: {
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      },
      fieldLabel: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        fontSize: 12,
        fontWeight: 500,
        lineHeight: '18px',
        color: 'var(--dsw-alias-label-secondary)',
      },
      /** The Models page's own input: 32px tall, 8px radius, a half-pixel border. */
      settingsInput: {
        boxSizing: 'border-box',
        width: '100%',
        height: 32,
        padding: '0 10px',
        font: 'inherit',
        fontSize: 14,
        lineHeight: '22px',
        color: 'var(--dsw-alias-label-primary)',
        background: 'var(--dsw-alias-bg-layer-1)',
        border: '.5px solid var(--dsw-alias-border-l4)',
        borderRadius: 8,
        outline: 'none',
      },
      /** A row's action: the Models page's secondary button at its row size. */
      secondary: {
        boxSizing: 'border-box',
        height: 28,
        padding: '0 10px',
        font: 'inherit',
        fontSize: 12,
        lineHeight: '18px',
        color: 'var(--dsw-alias-label-primary)',
        background: 'transparent',
        border: '.5px solid var(--dsw-alias-border-l3)',
        borderRadius: 14,
        cursor: 'pointer',
      },
      /** Saving a key inside a card. The pane's primary button, card-sized. */
      cardPrimary: {
        boxSizing: 'border-box',
        height: 32,
        padding: '0 14px',
        font: 'inherit',
        fontSize: 13,
        fontWeight: 600,
        color: 'var(--dsw-alias-label-primary-foreground)',
        background: 'var(--dsw-alias-button-primary-fill)',
        border: '1px solid transparent',
        borderRadius: 16,
        cursor: 'pointer',
      },
      /** Removing a key inside a card. Same colour rule as the pane's danger button. */
      cardDanger: {
        boxSizing: 'border-box',
        height: 32,
        padding: '0 14px',
        font: 'inherit',
        fontSize: 13,
        color: 'var(--dsw-alias-state-error-primary)',
        background: 'transparent',
        border: '.5px solid var(--dsw-alias-border-l3)',
        borderRadius: 16,
        cursor: 'pointer',
      },
      /** The workflow block: the analog of Models' model catalog fold. */
      workflows: {
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        paddingTop: 12,
        borderTop: '.5px solid var(--dsw-alias-border-l2)',
      },
      workflowsTitle: {
        fontSize: 12,
        fontWeight: 500,
        lineHeight: '18px',
        color: 'var(--dsw-alias-label-secondary)',
      },
      workflowsMeta: {
        margin: 0,
        fontSize: 12,
        lineHeight: '18px',
        color: 'var(--dsw-alias-label-tertiary)',
      },
      workflowList: {
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        margin: 0,
        padding: 0,
        listStyle: 'none',
      },
      workflowItem: {
        display: 'flex',
        alignItems: 'baseline',
        gap: 6,
        fontSize: 13,
        lineHeight: '20px',
        color: 'var(--dsw-alias-label-primary)',
      },
      workflowMeta: {
        fontSize: 11,
        lineHeight: '18px',
        color: 'var(--dsw-alias-label-tertiary)',
      },
      /**
       * The install prompt. Models fetches a model list; Generate cannot — a workflow
       * is installed by the agent from a link the user gives it (founder, 2026-09-23:
       * *"we don't fetch the model, we add the workflow using prompt"*). So the card
       * shows the sentence to say, and Copy puts it on the clipboard, because a plugin
       * cannot type into the composer (measured 2026-09-22).
       */
      promptRow: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 10px',
        background: 'var(--dsw-alias-bg-layer-1)',
        border: '.5px solid var(--dsw-alias-border-l1)',
        borderRadius: 8,
      },
      promptCode: {
        flex: 1,
        minWidth: 0,
        fontFamily: 'var(--ds-font-family-code, ui-monospace, SFMono-Regular, Menlo, monospace)',
        fontSize: 12,
        lineHeight: '18px',
        color: 'var(--dsw-alias-label-secondary)',
        overflowWrap: 'anywhere',
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
     * Every provider, with the state of its key.
     *
     * THE KEY NEVER REACHES THIS HALF (§12 rule 2): a save posts the value once and
     * every read afterwards is a balance. That was true of one wallet and stays true
     * of several providers — including the shape of this hook, which holds statuses
     * rather than secrets.
     */
    function useProviders() {
      const [state, setState] = React.useState({ phase: 'loading', providers: [] })
      const [busy, setBusy] = React.useState(false)
      // The last save's outcome, held by the surface rather than by the field: a
      // successful link replaces the field with the account view, so a confirmation
      // kept inside `KeyForm` would unmount with it. It is an id now, because with
      // several providers "which key was just linked" is part of the fact.
      const [confirmed, setConfirmed] = React.useState(null)

      const load = React.useCallback(async (apply) => {
        try {
          const response = await fetch(PROVIDERS_API, { headers: { accept: 'application/json' } })
          const body = await response.json()
          if (!response.ok || !body || !Array.isArray(body.providers)) {
            apply({ phase: 'failed', providers: [] })
            return
          }
          apply({ phase: 'ready', providers: body.providers })
        } catch {
          apply({ phase: 'failed', providers: [] })
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

      /** Replace one provider's row without dropping the others. */
      const replace = React.useCallback(
        (row) =>
          setState((current) => ({
            ...current,
            providers: current.providers.map((provider) => (provider.id === row.id ? { ...provider, ...row } : provider)),
          })),
        [],
      )

      const save = React.useCallback(
        async (id, key) => {
          setBusy(true)
          setConfirmed(null)
          try {
            const response = await fetch(providerUrl(id, 'key'), {
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
            if (body && body.id) replace(body)
            if (response.ok) setConfirmed(id)
            // The host answered, so this is not a network failure: a body this page
            // cannot read (a 404 with no payload, say) is `host-error`, and only a
            // thrown fetch is `unreachable`.
            return { ok: response.ok, error: response.ok ? null : (body && body.error) || 'host-error' }
          } catch {
            return { ok: false, error: 'unreachable' }
          } finally {
            setBusy(false)
          }
        },
        [replace],
      )

      const unlink = React.useCallback(
        async (id) => {
          setBusy(true)
          setConfirmed(null)
          try {
            const response = await fetch(providerUrl(id, 'key'), { method: 'DELETE', headers: { accept: 'application/json' } })
            let body = null
            try {
              body = await response.json()
            } catch {
              body = null
            }
            if (body && response.ok && body.id) replace(body)
            // The host answered, so this is not a network failure: a body this page
            // cannot read (a 404 with no payload, say) is `host-error`, and only a
            // thrown fetch is `unreachable`.
            return { ok: response.ok, error: response.ok ? null : (body && body.error) || 'host-error' }
          } catch {
            return { ok: false, error: 'unreachable' }
          } finally {
            setBusy(false)
          }
        },
        [replace],
      )

      /** A new keystroke makes the previous confirmation stale. */
      const forget = React.useCallback(() => setConfirmed(null), [])
      const reload = React.useCallback(() => load(setState), [load])

      return { phase: state.phase, providers: state.providers, busy, load: reload, save, unlink, confirmed, forget }
    }

    /**
     * Every provider's installed workflows, as one list of cards.
     *
     * ONE REQUEST PER PROVIDER, because that is where the files are: each provider
     * reads its own directory, and the host keeps them apart on purpose. A provider
     * that cannot answer is reported rather than silently missing, and the list is
     * only "failed" when nothing answered at all — which with one provider is exactly
     * the old single-route behaviour.
     */
    function useWorkflows(providers) {
      const [state, setState] = React.useState({ phase: 'loading', units: [], failed: [] })

      // THE LIST IS PASSED IN, not closed over: `load` is memoized on nothing, so a
      // captured `providers` would be the empty array from the first render forever —
      // the effect would re-run and still ask no one. (Found by verify:start.)
      const load = React.useCallback(async (list, apply) => {
        const units = []
        const failed = []
        for (const provider of list) {
          try {
            const response = await fetch(providerUrl(provider.id, 'workflows'), { headers: { accept: 'application/json' } })
            const body = await response.json()
            if (!response.ok || !body || !Array.isArray(body.entries)) {
              failed.push(provider.id)
              continue
            }
            for (const entry of body.entries) units.push({ ...entry, provider: provider.id, providerLabel: provider.label })
          } catch {
            failed.push(provider.id)
          }
        }
        apply({ phase: list.length > 0 && failed.length === list.length ? 'failed' : 'ready', units, failed })
      }, [])

      React.useEffect(() => {
        let live = true
        load(providers, (next) => {
          if (live) setState(next)
        })
        return () => {
          live = false
        }
      }, [load, providers.length])

      // The same read again, for Refresh: a host that did not answer is a state the
      // user can leave, not one they are stuck in.
      const reload = React.useCallback(() => load(providers, setState), [load, providers])
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
    function SaveDialog({ t, provider, onClose }) {
      const parts = provider ? balanceParts(t, provider) : []
      // A key the provider would not check is still saved, and saying "valid" about it
      // would be the same lie the row refuses to tell.
      const unverified = !!(provider && provider.linked && !provider.verified)
      const row = (key, text) =>
        h(
          'div',
          { key, style: S.savedRow },
          h('span', { style: S.savedCheck }, h(IconCheckOutline16, { size: 14 })),
          h('span', null, text),
        )
      const title = unverified ? t('saved.unverifiedTitle') : parts.length ? t('saved.title') : t('saved.titlePlain')
      const description = unverified ? t('saved.unverifiedIntro') : parts.length ? t('saved.intro') : t('saved.introPlain')
      return h(
        Modal,
        {
          open: true,
          onClose,
          title,
          closeLabel: t('saved.close'),
          description,
          footer: h(
            'button',
            { type: 'button', style: S.primary, 'data-generate-dismiss': 'yes', onClick: onClose },
            t('saved.dismiss'),
          ),
        },
        unverified ? row('unverified', t('saved.unverified')) : row('key', parts.length ? t('saved.keyOk') : t('saved.keyOkPlain')),
        !unverified && parts.length ? row('wallet', t('saved.walletOk') + ' ' + parts.join(' · ')) : null,
        // Where the balance went is only a fact for a provider that has one.
        !unverified && parts.length ? h('div', { style: S.savedWhere }, t('saved.where')) : null,
      )
    }

    /**
     * The key field. The error lands here, under the input, because S2's exit
     * criterion is that a bad key fails *at the field* rather than three screens
     * later inside a paid run (§9).
     *
     * It names its provider (`Krea API key`, not `API key`) and links that provider's
     * own key page, because the page is now one of several on one card list and four
     * identical fields would be four guesses.
     */
    function KeyForm({ t, provider, onSave, busy, autofocus, onEdit }) {
      const fieldId = 'generate-key-' + provider.id
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

      const keyLink = provider.keyUrl
        ? h(
            'a',
            { href: provider.keyUrl, target: '_blank', rel: 'noreferrer', style: S.hintLink },
            provider.keyPageLabel || t('wallet.key.getKey'),
          )
        : null

      return h(
        'form',
        { style: S.fieldGroup, onSubmit: submit },
        h('label', { style: S.fieldLabel, htmlFor: fieldId }, provider.label + ' ' + t('key.label.suffix')),
        h('input', {
          id: fieldId,
          style: S.settingsInput,
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
              keyLink,
            )
          : h(
              'div',
              { style: S.hint },
              t('wallet.key.hint'),
              keyLink,
            ),
        h(
          'div',
          { style: S.row },
          h(
            'button',
            { type: 'submit', style: S.cardPrimary, disabled: busy || value.trim() === '' },
            busy ? t('wallet.key.saving') : t('wallet.key.save'),
          ),
        ),
      )
    }

    /**
     * The meter (§9): what is left, whose environment it came from, and the way out to
     * top up — ONE ROW PER PROVIDER.
     *
     * Several providers is the point of the plugin now, so a single balance would have
     * to pick one and be wrong about the others. With one provider this draws exactly
     * what it always did.
     *
     * `showLabel` is what keeps that true: with one provider the row reads as a plain
     * balance, and only when there are several does the provider's name appear.
     */
    function ProviderStrip({ t, provider, showLabel }) {
      const parts = balanceParts(t, provider)
      return h(
        'div',
        { style: S.strip, 'data-generate-provider-strip': provider.id },
        showLabel ? h('span', { style: S.stripLabel }, provider.label) : null,
        // A provider with no balance endpoint says `Key saved` rather than claiming an
        // empty wallet: Krea, Magnific and Comfy Cloud have no balance route at all.
        h(
          'span',
          { style: S.stripValue },
          parts.length ? parts.join(' · ') : provider.linked ? t('settings.linked') : t('wallet.notLinked'),
        ),
        h(
          'span',
          {
            style: S.stripNote,
            // The note's own text is the contract the verify reads; matching the
            // phrase across the page would also hit the replace hint, which says
            // "the one stored on this machine" for a different reason.
            'data-generate-source': provider.source || 'none',
          },
          provider.writable === false ? t('settings.readOnly') : null,
          provider.writable !== false && provider.source === STORED_SOURCE ? t('wallet.fromStore') : null,
          provider.writable !== false && ENVIRONMENT_SOURCES.includes(provider.source) ? t('wallet.fromEnvironment') : null,
          provider.note ? t('note.' + provider.note) : null,
        ),
        provider.accountUrl
          ? h(
              'a',
              { href: provider.accountUrl, target: '_blank', rel: 'noreferrer', style: S.link },
              t('settings.account'),
              h(IconRightUpOutline16, { size: 12 }),
            )
          : null,
      )
    }

    /**
     * One workflow, whole, for the surface that renders its doors.
     *
     * The pane mounts this per open unit, keyed by provider and name, so switching
     * units mounts a fresh reader rather than reusing the previous file's state.
     */
    function useWorkflow(provider, name) {
      const [state, setState] = React.useState({ phase: 'loading', adapter: null })

      React.useEffect(() => {
        let live = true
        const read = async () => {
          try {
            const response = await fetch(providerUrl(provider, 'workflow') + '?name=' + encodeURIComponent(name), { headers: { accept: 'application/json' } })
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
          'data-generate-provider': unit.provider,
          onClick: () => onOpen(unit.provider, unit.name),
        },
        unit.cover ? h('img', { src: unit.cover, alt: '', style: S.cardCover }) : null,
        h(
          'span',
          { style: S.cardBody },
          h('span', { style: S.cardTitle }, unit.title),
          unit.blurb ? h('span', { style: S.cardBlurb }, unit.blurb) : null,
          // WHICH PROVIDER it runs on, and whose app it is: with several providers
          // the first is a fact a reader needs, and the second is one the API cannot
          // supply, so the adapter is where a person said it (§2).
          h(
            'span',
            { style: S.cardMark },
            unit.providerLabel + (unit.origin === 'community' ? ' · ' + t('card.community') : ''),
          ),
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
    function WorkflowSurface({ t, provider, name, onBack }) {
      const { phase, adapter } = useWorkflow(provider, name)
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
        { style: S.surface, 'data-generate-surface': 'ready', 'data-generate-unit': adapter.name, 'data-generate-provider': provider },
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

    /**
     * Stage two: the body, under the type's own id.
     *
     * ONE PANE HOLDS EVERY WORKFLOW SURFACE (founder, 2026-09-22). Its first screen is
     * a meter for every linked provider, then one card per installed workflow from
     * every provider; a card opens that workflow's surface in place. A provider with
     * no key contributes no cards, and the pane asks for the first key rather than
     * showing an empty list.
     */
    function GeneratePane(props) {
      const t = translatorOf(props)
      const providers = useProviders()
      const units = useWorkflows(providers.providers)
      // `null` means the user has not chosen; `{ provider, name }` opens that
      // workflow's surface; `''` is the way back to the cards.
      const [chosen, setChosen] = React.useState(null)

      // A tab may be opened at a unit by an opener that passed `params.unit` — and
      // `params.provider` when there is more than one place it could live.
      const tab = typeof props.useTabInfo === 'function' ? props.useTabInfo() : null
      const params = tab && tab.tab && tab.tab.navigation ? tab.tab.navigation.params : null
      const asked = params && typeof params.unit === 'string' ? params.unit : null
      const askedProvider = params && typeof params.provider === 'string' ? params.provider : null
      const opened =
        asked === null
          ? null
          : units.units.find((unit) => unit.name === asked && (askedProvider === null || unit.provider === askedProvider)) || null
      const active = chosen === null ? opened : chosen || null

      if (providers.phase === 'loading') {
        return h('div', { style: S.root, 'data-generate-pane': 'loading' }, h('div', { style: S.empty }, h('div', { style: S.body }, t('pane.loading'))))
      }

      const linked = providers.providers.filter((provider) => provider.linked)
      // The first-run form belongs to a WORKFLOW provider: the pane is where workflows
      // run, RunningHub and Comfy Cloud are the two that have them, and with four
      // providers registered "the first one" would otherwise be an image provider the
      // pane has nothing to run. When every workflow provider is already linked it falls
      // back to the first unlinked provider, then to the first in the registry.
      const first =
        providers.providers.find((provider) => provider.kind === 'workflow' && !provider.linked) ||
        providers.providers.find((provider) => !provider.linked) ||
        providers.providers[0] ||
        null
      const several = providers.providers.length > 1

      // No provider linked yet: the pane asks for the first one's key. That is the
      // first-run screen a new install lands on, unchanged in shape.
      if (linked.length === 0) {
        return h(
          'div',
          { style: S.root, 'data-generate-pane': 'first-run' },
          h(
            'div',
            { style: S.form, 'data-generate-first-run': 'yes' },
            h(GenerateMark, null),
            h('div', { style: S.title }, t('pane.first.title')),
            h('div', { style: S.body }, t('pane.first.body')),
            first
              ? h(KeyForm, {
                  t,
                  provider: first,
                  onSave: (key) => providers.save(first.id, key),
                  busy: providers.busy,
                  autofocus: true,
                  onEdit: providers.forget,
                })
              : h('div', { style: S.hint }, t('pane.noProviders')),
            // The pane can link a key but cannot change or remove one, so the place
            // that can is named here, where the person first meets the field.
            h(Note, {
              text: t('pane.first.manage'),
              attrs: { 'data-generate-manage-hint': 'yes' },
            }),
            // And how an app gets added, under the key directions: linking an account
            // is the first thing this screen asks for, and adding a workflow is the
            // next one, so both answers sit together (founder, 2026-09-22).
            h(Note, {
              text: t('pane.add.hint'),
              attrs: { 'data-generate-add-hint': 'yes' },
            }),
          ),
        )
      }

      const saved = providers.providers.find((provider) => provider.id === providers.confirmed) || null

      return h(
        'div',
        { style: S.root, 'data-generate-pane': active === null ? 'home' : 'unit' },
        // The link just happened. The dialog says the key works, that the provider
        // answered, and where the balance went; the strip below it is the thing the
        // dialog is pointing at.
        saved && active === null ? h(SaveDialog, { t, provider: saved, onClose: providers.forget }) : null,
        linked.map((provider) => h(ProviderStrip, { key: provider.id, t, provider, showLabel: several })),
        linked
          .filter((provider) => provider.error)
          .map((provider) =>
            h(
              'div',
              { key: provider.id, style: S.warn, role: 'alert' },
              h(IconWarningOutline16, { size: 14 }),
              // A stored key that stopped working is a different fact from a field
              // that was just typed into, and the fix is different too.
              h('span', null, provider.error === 'invalid-key' ? t('error.storedKeyRejected') : errorText(t, provider.error)),
            ),
          ),
        // ONE PANE HOLDS EVERY WORKFLOW SURFACE (founder, 2026-09-22). The first
        // screen is the cards; a card opens that workflow's surface in place, and the
        // way back is the surface's own first control.
        active === null
          ? units.units.length > 0
            ? h(
                'div',
                { style: S.cards, 'data-generate-cards': String(units.units.length) },
                units.units.map((unit) =>
                  h(UnitCard, { key: unit.provider + '/' + unit.name, t, unit, onOpen: (provider, name) => setChosen({ provider, name }) }),
                ),
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
          : h(WorkflowSurface, {
              key: active.provider + '/' + active.name,
              t,
              provider: active.provider,
              name: active.name,
              onBack: () => setChosen(''),
            }),
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
              // And under those, how to add an app: this is the screen a person lands
              // on with a linked account, so the one action that fills it has to be
              // on it, in words they can repeat into the chat.
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
                  // Both reads again: the provider statuses and the installed lists.
                  onClick: () => {
                    providers.load()
                    units.reload()
                  },
                  disabled: providers.busy,
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

    /**
     * What a provider's dot says. Four states, because "linked" is not one fact:
     *
     *   ok        the provider answered about the key
     *   unchecked the provider did not confirm it (or its subscription has lapsed)
     *   refused   the stored key was rejected, so it needs replacing
     *   none      no key on this machine yet
     */
    function providerState(provider) {
      if (!provider.linked) return { dot: 'dotNone', state: 'none' }
      if (provider.error === 'invalid-key') return { dot: 'dotBad', state: 'refused' }
      if (provider.note || !provider.verified) return { dot: 'dotWarn', state: 'unchecked' }
      return { dot: 'dotOk', state: 'ok' }
    }

    /**
     * The row's own sentence, next to its dot.
     *
     * A dot is not a fact a person can act on, so every state has a line: what is
     * linked, what the provider answered, or what it refused to confirm. A provider
     * with no balance endpoint says `Key saved` rather than showing an empty wallet.
     */
    function providerSummary(t, provider) {
      if (!provider.linked) return { text: t('wallet.notLinked'), warn: false, error: false }
      if (provider.error === 'invalid-key') return { text: t('error.storedKeyRejected'), warn: false, error: true }
      if (provider.note) return { text: t('note.' + provider.note), warn: true, error: false }
      const parts = balanceParts(t, provider)
      if (parts.length > 0) return { text: parts.join(' · '), warn: false, error: false }
      if (!provider.verified) return { text: t('settings.linked.unverified'), warn: true, error: false }
      return { text: t('settings.linked'), warn: false, error: false }
    }

    /** How many workflows a provider has, said in words. */
    function workflowCount(t, total) {
      if (total === 0) return t('settings.workflows.none')
      return total + ' ' + (total === 1 ? t('settings.workflows.one') : t('settings.workflows.many'))
    }

    /**
     * One provider's installed workflows, read when its card opens.
     *
     * Mounted by the editor, so it runs on open and not before: the list route reads a
     * directory and needs no key, but a collapsed row has no reason to ask.
     */
    function useProviderWorkflows(provider) {
      const [state, setState] = React.useState({ phase: 'loading', entries: [] })

      React.useEffect(() => {
        let live = true
        const read = async () => {
          try {
            const response = await fetch(providerUrl(provider.id, 'workflows'), { headers: { accept: 'application/json' } })
            const body = await response.json()
            if (!live) return
            if (!response.ok || !body || !Array.isArray(body.entries)) {
              setState({ phase: 'failed', entries: [] })
              return
            }
            setState({ phase: 'ready', entries: body.entries })
          } catch {
            if (live) setState({ phase: 'failed', entries: [] })
          }
        }
        read()
        return () => {
          live = false
        }
      }, [provider.id])

      return state
    }

    /**
     * The open card: the key, the account, and what is installed.
     *
     * The key is the primary field, the way it is on a Models card. Where Models puts
     * a model catalog, this puts the workflow list and the sentence that installs one
     * — a workflow cannot be fetched from an API (founder, 2026-09-23: *"we don't fetch
     * the model, we add the workflow using prompt"*), so the card shows the prompt and
     * copies it.
     */
    function ProviderEditor({ t, provider, busy, onSave, onRemove, onEdit }) {
      const work = useProviderWorkflows(provider)
      const summary = providerSummary(t, provider)
      const [copied, setCopied] = React.useState(false)

      const copy = async () => {
        try {
          if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
            await navigator.clipboard.writeText(provider.addPrompt)
            setCopied(true)
          }
        } catch {
          // The prompt is on screen either way; a refused clipboard is not an error
          // worth a message of its own.
        }
      }

      return h(
        'div',
        { style: S.editor, 'data-generate-provider-editor': provider.id },
        h(
          'div',
          {
            style: summary.error ? S.summaryError : summary.warn ? S.summaryWarn : S.rowSummary,
            'data-generate-provider-note': provider.id,
          },
          summary.text,
        ),
        provider.linked && provider.writable === false
          ? h('div', { style: S.hint }, t('settings.readOnly'))
          : h(
              React.Fragment,
              null,
              provider.linked ? h('div', { style: S.hint }, t('wallet.replace.hint')) : null,
              h(KeyForm, { t, provider, onSave, busy, onEdit }),
            ),
        h(
          'div',
          { style: S.row },
          provider.linked && provider.writable !== false
            ? h(
                'button',
                { type: 'button', style: S.cardDanger, disabled: busy, 'data-generate-remove': provider.id, onClick: onRemove },
                t('remove.action'),
              )
            : null,
          provider.accountUrl
            ? h(
                'a',
                { href: provider.accountUrl, target: '_blank', rel: 'noreferrer', style: S.link },
                t('settings.account'),
                h(IconRightUpOutline16, { size: 12 }),
              )
            : null,
        ),
        h(
          'div',
          { style: S.workflows, 'data-generate-provider-workflows': provider.id },
          h('div', { style: S.workflowsTitle }, t('settings.workflows.title')),
          h(
            'p',
            { style: S.workflowsMeta },
            work.phase === 'failed'
              ? t('settings.workflows.unknown')
              : work.phase === 'loading'
                ? t('pane.loading')
                : workflowCount(t, work.entries.length),
          ),
          work.entries.length > 0
            ? h(
                'ul',
                { style: S.workflowList },
                work.entries.map((entry) =>
                  h(
                    'li',
                    { key: entry.name, style: S.workflowItem },
                    h('span', null, entry.title || entry.name),
                    entry.doorCount > 0 ? h('span', { style: S.workflowMeta }, entry.doorCount + ' ' + t('settings.workflows.doors')) : null,
                  ),
                ),
              )
            : null,
          h(
            'div',
            { style: S.fieldGroup },
            h('div', { style: S.hint }, t('settings.workflows.add')),
            h(
              'div',
              { style: S.promptRow },
              h('code', { style: S.promptCode, 'data-generate-add-prompt': provider.id }, provider.addPrompt),
              h(
                'button',
                { type: 'button', style: S.secondary, 'data-generate-copy-prompt': provider.id, onClick: copy },
                copied ? t('settings.workflows.copied') : t('settings.workflows.copy'),
              ),
            ),
          ),
        ),
      )
    }

    /** One provider's row: its dot, its name, its family, its state and its card. */
    function ProviderRow({ t, provider, open, busy, onToggle, onSave, onRemove, onEdit }) {
      const look = providerState(provider)
      const summary = providerSummary(t, provider)
      return h(
        'li',
        { style: S.rowCard, 'data-generate-provider-card': provider.id, 'data-generate-provider-state': look.state },
        h(
          'div',
          { style: S.rowHead },
          h('span', { style: { ...S.dot, ...S[look.dot] }, 'data-generate-provider-dot': look.state, 'aria-hidden': true }),
          h(
            'span',
            { style: S.rowIdentity },
            h('span', { style: S.rowName }, provider.label),
            h('span', { style: S.rowTag }, t(provider.kind === 'image' ? 'settings.kind.image' : 'settings.kind.workflow')),
          ),
          h(
            'span',
            { style: S.rowActions },
            h(
              'button',
              {
                type: 'button',
                style: S.secondary,
                'data-generate-provider-toggle': provider.id,
                'aria-expanded': open ? 'true' : 'false',
                onClick: onToggle,
              },
              open ? t('settings.row.close') : provider.linked ? t('settings.row.edit') : t('settings.row.setup'),
            ),
          ),
        ),
        h(
          'div',
          {
            style: summary.error ? S.summaryError : summary.warn ? S.summaryWarn : S.rowSummary,
            'data-generate-provider-summary': provider.id,
          },
          summary.text,
        ),
        open ? h(ProviderEditor, { t, provider, busy, onSave, onRemove, onEdit }) : null,
      )
    }

    /**
     * The settings page: ONE page, listing every provider.
     *
     * "we should only have 1 generate settings with the different adapters" (founder,
     * 2026-09-22) — and that is the reason the providers live inside this plugin
     * instead of one plugin each: `settings.section` is a list, so a plugin per
     * provider would be one Generate page per provider.
     *
     * THE MODELS → PROVIDERS SHAPE, in full (founder, 2026-09-23: *"use the models
     * settings design for generate settings"*): the section's own title and intro, then
     * one row per provider carrying its credential dot, its name, the family it belongs
     * to and the state of its key, and one editor card open at a time with the API key
     * as the primary field. Image providers are listed before workflow providers
     * (founder: *"add image provider, then RunningHub"*), which is the registry's own
     * order and not a second sort.
     *
     * The one thing Models does and this page cannot: a model list is fetched from the
     * provider, a workflow is installed by the agent from a link, so the card carries
     * the sentence to say instead of a discovery button.
     */
    function GenerateSettings(props) {
      const t = translatorOf(props)
      const { phase, providers, busy, save, unlink, confirmed, forget } = useProviders()
      // Which card is open. `undefined` means "the page has not been touched", which is
      // what lets the first-run posture open the first unlinked provider's card — the
      // same posture Models gives a provider with no key anywhere. No effect is needed
      // and none is used: a choice, once made, is the page's.
      const [chosen, setChosen] = React.useState(undefined)
      // The provider being asked about, and whether the answer is the question or the
      // receipt. The two states are one dialog.
      const [removing, setRemoving] = React.useState(null)
      const [removeError, setRemoveError] = React.useState(null)

      if (phase === 'loading') {
        return h('div', { style: S.settingsPage }, h('div', { style: S.settingsIntro }, t('pane.loading')))
      }

      const saved = providers.find((provider) => provider.id === confirmed) || null
      const asking = removing === null ? null : providers.find((provider) => provider.id === removing.replace(/:done$/, '')) || null

      const askRemove = (id) => {
        setRemoveError(null)
        setRemoving(id)
      }
      const cancelRemove = () => {
        setRemoveError(null)
        setRemoving(null)
      }
      const confirmRemove = async () => {
        if (!asking) return
        setRemoveError(null)
        const outcome = await unlink(asking.id)
        if (outcome.ok) {
          forget()
          setRemoving(asking.id + ':done')
        } else {
          setRemoveError(outcome.error || 'unreachable')
        }
      }
      // Editing a field is the other way out of a removed key: the confirmation is
      // about the last action, so a new one takes it away.
      const edited = () => {
        forget()
        setRemoveError(null)
        if (removing !== null && removing.endsWith(':done')) setRemoving(null)
      }

      // The first unlinked provider is the one the first-run card opens, in registry
      // order: with nothing linked the page would otherwise be four closed rows and no
      // field to type into.
      const firstUnlinked = providers.find((provider) => !provider.linked) || null
      const openId = chosen !== undefined ? chosen : firstUnlinked === null ? null : firstUnlinked.id

      return h(
        'div',
        { style: S.settingsPage, 'data-generate-settings': providers.some((provider) => provider.linked) ? 'linked' : 'unlinked' },
        saved ? h(SaveDialog, { t, provider: saved, onClose: forget }) : null,
        asking
          ? h(RemoveKeyDialog, {
              t,
              stage: removing.endsWith(':done') ? 'done' : 'ask',
              busy,
              error: removeError,
              onCancel: cancelRemove,
              onRemove: confirmRemove,
              onClose: cancelRemove,
            })
          : null,
        h('h2', { style: S.settingsTitle }, t('settings.title')),
        h('p', { style: S.settingsIntro }, t('settings.body')),
        providers.length === 0 ? h('p', { style: S.settingsIntro }, t('pane.noProviders')) : null,
        h(
          'ul',
          { style: S.rows },
          providers.map((provider) =>
            h(ProviderRow, {
              key: provider.id,
              t,
              provider,
              open: openId === provider.id,
              busy,
              onToggle: () => setChosen(openId === provider.id ? null : provider.id),
              onSave: (key) => save(provider.id, key),
              onRemove: () => askRemove(provider.id),
              onEdit: edited,
            }),
          ),
        ),
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
      ctx.effect(() => ctx.locale.register(NS, { en: EN, zh: ZH }), 'generate.copy')
      ctx.effect(() => ctx.sidebarRightTabs.register(generateDefinition(t)), 'generate.type')
      ctx.effect(
        () =>
          ctx.slots.inject('sidebar.right.pane.tab', () =>
            ctx.slots.register(
              { name: 'sidebar.right.pane.tab', key: GENERATE_ID, locale: NS },
              GeneratePane,
            ),
          ),
        'generate.body',
      )
      ctx.effect(
        () =>
          ctx.slots.inject('sidebar.right.pane.tab.title', () =>
            ctx.slots.register(
              { name: 'sidebar.right.pane.tab.title', key: GENERATE_ID, locale: NS },
              GenerateTitle,
            ),
          ),
        'generate.title',
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
                id: 'generate',
                order: 17,
                // Without this the page body keeps the language it first rendered
                // in: the nav label is a thunk and re-reads, the page is not.
                locale: NS,
                label: () => t('type.label'),
              },
              GenerateSettings,
            ),
          ),
        'generate.settings',
      )
    }

    return { inject, apply }
  },
})
