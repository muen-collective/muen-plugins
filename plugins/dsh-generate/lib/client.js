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
//                 a row per provider with a credential dot, its family, the state
//                 of its key and what using it costs, and one open editor card at a
//                 time whose primary field
//                 is the API key. `settings.section` is a list slot, so a plugin per
//                 provider would be one Generate page per provider, which is exactly
//                 what the founder ruled out.
//
// ONE PLUGIN, SEVERAL PROVIDERS (founder, 2026-09-22). Four are registered in the host
// half, in this order everywhere: RunningHub, Krea, Comfy Cloud, Magnific (founder,
// 2026-09-23: "the order of providers is: RunningHub, Krea, Comfy Cloud", and Magnific
// left as the last row — the one key still to be tested). The pane
// is the hub: a meter per linked provider, then a card per installed workflow from every
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
      // The pane's own glyphs: a chevron per accordion header, a flow glyph on a
      // workflow card, and the plus on the header's add control. The image provider's
      // own glyph is gone with the header icon it used to fill: the header draws the
      // section's status light instead (founder, 2026-09-23).
      IconChevronDownOutline14,
      IconChevronRightOutline14,
      // The surface's way out wears a left chevron (founder, 2026-09-23: *"the All
      // workflows button should have back arrow"*). The set carries no minus glyph, so
      // the number stepper's decrement draws U+2212 as text — see `S.stepperButton`.
      IconChevronLeftOutline14,
      IconBranchOutline16,
      IconPlusOutline16,
      // The add control and the snippet it reveals are the harness's own atoms, not
      // copies: `Button` draws the capsule and `CodeBlock` draws the prompt, the same
      // pair a start-page control and an agent's code answer are made of. `Switch` is
      // the settings toggle that hides a provider from the panel, and `Tooltip` is the
      // harness's own hover bubble — the header's glyph controls wear it rather than a
      // native `title`, so a hover reads the way every other glyph in the app does.
      Button,
      CodeBlock,
      Switch,
      Tooltip,
      Modal,
      // The split run control's list: the harness's own anchored menu, whose documentation
      // names the split-button case — an anchor that wraps several controls — and which
      // hands the keyboard back to the trigger that opened it.
      Menu,
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
      // The number stepper's two glyph buttons. Both are icon-only, so each carries its
      // own label for a screen reader and its own hover tooltip.
      'surface.step.down': 'Decrease',
      'surface.step.up': 'Increase',
      // The split run control's smaller half: its accessible name and its hover tooltip.
      // The modes themselves are provider data, so nothing here names one of them.
      'run.mode': 'Run mode',
      // Where a finished run's bytes were saved, on this machine. The host does the saving,
      // so this only says what the host reported — never a path the browser guessed.
      'run.saved': 'Saved to',
      'surface.loading': 'Reading the workflow…',
      'surface.failed': 'That workflow could not be read.',
      'surface.advanced': 'Advanced',
      'surface.advanced.hide': 'Hide advanced',
      // Said where the run will be, because the form is real and nothing submits:
      // the payload gate, the run strip and the result are the next slice (§10).
      'surface.pending': 'Running comes next: the payload gate and the run strip are not built yet.',
      // S5: the gate and the run strip. The Run control's own label is adapter data
      // (`ui.runLabel`), so nothing here names a workflow or a provider.
      'run.action': 'Run',
      'run.gate.title': 'Run this?',
      'run.gate.body': 'This is exactly what will be sent. Nothing runs until you confirm it, and a run is paid.',
      'run.gate.request': 'The exact request',
      'run.gate.hide': 'Hide the request',
      'run.gate.model': 'Model',
      'run.gate.prompt': 'Prompt',
      'run.gate.to': 'Posted to',
      'run.gate.missing': 'Still empty:',
      'run.gate.refused': 'These cannot be sent yet:',
      'run.gate.confirm': 'Confirm and run',
      'run.gate.cancel': 'Cancel',
      'run.gate.starting': 'Starting…',
      'run.phase.queued': 'Queued',
      'run.phase.running': 'Running',
      'run.phase.done': 'Done',
      'run.phase.failed': 'Failed',
      'run.job': 'Run',
      'run.result.open': 'Open the image',
      'run.result.alt': 'The generated image',
      'run.again': 'Run again',
      'run.failed': 'That run failed.',
      // A run's own failures. `no-api-balance` is the same fact as the key row's note:
      // the balance is empty, the key is fine.
      'error.noBalance': 'The API balance is empty. Top it up on the provider\'s API page.',
      'error.noKey': 'No key is linked for this provider. Link one in Settings → Generate.',
      'error.tooManyJobs': 'The provider is already running as many jobs as it allows. Try again in a moment.',
      'error.badRequest': 'The provider refused the request.',
      'error.payloadIncomplete': 'A required field is still empty.',
      'error.payloadRefused': 'A value cannot be sent as it stands.',
      'error.jobGone': 'That run is no longer on the provider.',
      'card.community': 'someone else\'s app',
      'surface.image.choose': 'Choose an image',
      'surface.image.placeholder': 'Paste an image URL, or add one',
      'surface.image.uploading': 'Uploading…',
      'surface.image.failed': 'That image could not be uploaded.',
      // A list door's two controls. The add control says the door's own `addLabel` when the
      // catalogue has one (Krea's vocabulary: "Add style"), so these are the fallbacks.
      'surface.list.add': 'Add',
      'surface.list.remove': 'Remove',
      'pane.loading': 'Checking your wallet…',
      'pane.first.title': 'Link your RunningHub account',
      // Every provider switched off in Settings. The pane says so rather than looking
      // like an install that lost its workflows, and it names the page holding the
      // switches — the one place this state can be undone.
      'pane.hidden.title': 'Every provider is hidden',
      'pane.hidden.body': 'Settings → Generate lists all of them. Switch one back on to see its workflows here.',
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
      // The pane's home is a stacked accordion, one section per provider (founder,
      // 2026-09-23). A provider with nothing installed no longer draws a paragraph
      // about being empty either: it says so in one line and names the header glyph
      // whose click yields the prompt that installs one. That is also why the linked
      // screen has no separate "how to add" note any more — the glyph IS that sentence.
      'pane.section.none': 'No workflows yet',
      'pane.section.count': 'installed',
      // The family word the count line opens with. ONE WORD FOR EVERY PROVIDER
      // (founder, 2026-09-23: *"use same naming on Krea accordion (and all
      // accordions)"*) — the Krea section used to read "Image · 3 installed" while
      // RunningHub read "Workflows · …". The family tag still tells the two apart on
      // the Settings row, which is where the distinction is worth drawing; the pane's
      // count line is about how much is in the section, and settings already counts a
      // Krea section's entries as workflows too (`settings.workflows.many`).
      'pane.section.family': 'Workflows',
      // The open section of a provider with nothing installed. The empty state used to
      // BE the add control; the control moved to the header (founder, 2026-09-23:
      // *"move + workflow button as an icon button next to refresh"*), so the body says
      // what is missing and names the glyph that fixes it.
      'pane.section.empty': 'Nothing installed yet. Use + above to add one.',
      // The header's add glyph. A glyph has no text of its own, so this is both its
      // hover tooltip and its accessible name.
      'pane.add.button': 'Add a workflow',
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
      // The accordion's status light (founder, 2026-09-23): green when the section
      // is ready to run, amber when the key is good but nothing is installed, red
      // when there is no key at all. A colour alone is not a fact, so each state
      // also carries its own sentence for the dot's tooltip.
      'pane.light.ready': 'Ready: the key is linked and a workflow is installed',
      'pane.light.keyOnly': 'Key linked, no workflow installed yet',
      'pane.light.noKey': 'No key linked',
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
      // The hide switch (founder, 2026-09-23): ON means the Generate panel draws this
      // provider, so hiding is the act and the switch is reversible from the row it is
      // on. The tag is what explains an absent section.
      'settings.hide.label': 'Show in the Generate panel',
      'settings.hide.hint': 'Hidden providers keep their key and their workflows. Bring one back to see it in the panel again.',
      'settings.hide.tag': 'Hidden',
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
      // Three providers answer about a key without accepting it, and none of those
      // answers is a bad key: Comfy Cloud's subscription has lapsed, Magnific's API
      // entitlement is a 403 its own spec never defines, and Krea's API balance is
      // empty (HTTP 402 in its docs). The key is kept and the row carries the reason
      // instead of calling it invalid.
      'note.subscription-inactive': 'The key works, but this account has no active Comfy Cloud subscription, so a run would be refused.',
      'note.not-entitled': 'Magnific answered the key but did not confirm access, so it is stored unchecked.',
      'note.no-api-balance': 'The key works, but this Krea workspace has no API balance, so a run would be refused. Top it up in Krea.',
      // What using a provider costs, on its row, so the funding is visible before a run
      // is refused for it. The host sends `funding.kind` and `funding.url`; the sentence
      // and the link's label are the client's, because they are copy.
      'funding.coins': 'Runs on coins.',
      'funding.balance': 'Needs API balance — API calls are billed in USD, not compute units.',
      'funding.plan': 'Needs an active monthly plan.',
      'funding.credits': 'Needs a paid plan with credits.',
      'funding.coins.link': 'Buy coins',
      'funding.balance.link': 'Add API balance',
      'funding.plan.link': 'See plans and credits',
      'funding.credits.link': 'See plans',
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
      'surface.step.down': '减少',
      'surface.step.up': '增加',
      'run.mode': '运行模式',
      'run.saved': '已保存到',
      'surface.loading': '正在读取工作流…',
      'surface.failed': '无法读取该工作流。',
      'surface.advanced': '高级',
      'surface.advanced.hide': '收起高级选项',
      'surface.pending': '运行功能稍后提供：付费前的载荷确认与运行状态尚未构建。',
      'run.action': '运行',
      'run.gate.title': '确认运行？',
      'run.gate.body': '以下是即将发送的内容。确认之前不会运行，运行会计费。',
      'run.gate.request': '完整请求',
      'run.gate.hide': '收起请求',
      'run.gate.model': '模型',
      'run.gate.prompt': '提示词',
      'run.gate.to': '发送至',
      'run.gate.missing': '仍为空：',
      'run.gate.refused': '暂时无法发送：',
      'run.gate.confirm': '确认并运行',
      'run.gate.cancel': '取消',
      'run.gate.starting': '正在启动…',
      'run.phase.queued': '排队中',
      'run.phase.running': '运行中',
      'run.phase.done': '完成',
      'run.phase.failed': '失败',
      'run.job': '运行',
      'run.result.open': '打开图片',
      'run.result.alt': '生成的图片',
      'run.again': '再运行一次',
      'run.failed': '这次运行失败了。',
      'error.noBalance': 'API 余额为空，请到服务商的 API 页面充值。',
      'error.noKey': '该服务商还没有连接密钥，请在「设置 → Generate」中连接。',
      'error.tooManyJobs': '服务商正在运行的任务已达上限，请稍后再试。',
      'error.badRequest': '服务商拒绝了这次请求。',
      'error.payloadIncomplete': '还有必填项为空。',
      'error.payloadRefused': '有数值暂时无法发送。',
      'error.jobGone': '服务商上已经没有这次运行。',
      'card.community': '他人的应用',
      'surface.image.choose': '选择图片',
      'surface.image.placeholder': '粘贴图片链接，或添加一张图片',
      'surface.image.uploading': '正在上传…',
      'surface.image.failed': '该图片上传失败。',
      'surface.list.add': '添加',
      'surface.list.remove': '移除',
      'pane.loading': '正在检查密钥…',
      'pane.first.title': '连接服务商账户',
      'pane.hidden.title': '所有提供方都已隐藏',
      'pane.hidden.body': '在 Settings → Generate 中可以看到全部提供方，打开其中一个开关即可在此显示它的工作流。',
      'pane.first.body': '粘贴你的 API 密钥。现在就会校验，并且只保存在这台机器上。',
      'pane.first.manage': '之后可以在「设置 → 生成」里修改或移除这个密钥。设置菜单位于左侧边栏底部。',
      'pane.linked.manage': '在「设置 → 生成」里修改或移除密钥。设置菜单位于左侧边栏底部。',
      // 引号内的指令保持英文：它就是技能 whenToUse 里写的那句，翻译会让这行失去作用。
      'pane.add.hint': '要添加工作流，在对话里对智能体说：「add this RunningHub workflow <app link>」。',
      'pane.section.none': '还没有工作流',
      'pane.section.count': '个已安装',
      'pane.section.family': '工作流',
      'pane.section.empty': '尚未安装任何工作流。点击上方的 + 添加。',
      'pane.add.button': '添加工作流',
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
      'pane.light.ready': '就绪：密钥已连接，且已安装工作流',
      'pane.light.keyOnly': '密钥已连接，尚未安装工作流',
      'pane.light.noKey': '未连接密钥',
      'settings.title': '生成',
      'settings.body': '每个服务商的密钥都保存在这台机器上，浏览器不会看到它。',
      'settings.kind.image': '图像',
      'settings.kind.workflow': '工作流',
      'settings.row.setup': '设置',
      'settings.row.edit': '编辑',
      'settings.row.close': '收起',
      'settings.hide.label': '在 Generate 面板中显示',
      'settings.hide.hint': '隐藏的提供方仍保留密钥与工作流，重新打开开关即可在面板中看到它。',
      'settings.hide.tag': '已隐藏',
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
      'note.no-api-balance': '密钥可用，但此 Krea 工作区没有 API 余额，运行会被拒绝。请在 Krea 充值。',
      'funding.coins': '按金币计费。',
      'funding.balance': '需要 API 余额——API 调用按美元计费，不使用工作区算力。',
      'funding.plan': '需要一个有效的月度套餐。',
      'funding.credits': '需要含额度的付费套餐。',
      'funding.coins.link': '购买金币',
      'funding.balance.link': '充值 API 余额',
      'funding.plan.link': '查看套餐与额度',
      'funding.credits.link': '查看套餐',
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
      'no-key': 'error.noKey',
      'no-api-balance': 'error.noBalance',
      'too-many-jobs': 'error.tooManyJobs',
      'bad-request': 'error.badRequest',
      'payload-incomplete': 'error.payloadIncomplete',
      'payload-refused': 'error.payloadRefused',
      'job-not-found': 'error.jobGone',
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
      /**
       * THE SPLIT CONTROL (founder, 2026-09-23: *"RH has option to run as plus vs ultra we
       * can use this shadcn split button"*). One action and one choice that belongs to it:
       * the button runs, the segment beside it says which mode it will run in and opens the
       * list. The two halves share an edge — the action keeps its left corners, the segment
       * keeps its right ones, and the segment tucks one pixel under the action's border so
       * the seam is a single hairline rather than a double line.
       */
      splitButton: {
        display: 'inline-flex',
        alignItems: 'stretch',
        alignSelf: 'flex-start',
      },
      splitAction: {
        borderTopRightRadius: 0,
        borderBottomRightRadius: 0,
      },
      splitToggle: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        marginLeft: -1,
        borderTopLeftRadius: 0,
        borderBottomLeftRadius: 0,
      },
      /** One mode in the list: its name, then the machine that name buys. */
      menuRow: {
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        textAlign: 'left',
        whiteSpace: 'nowrap',
      },
      menuRowValue: {
        fontSize: 12,
        fontWeight: 600,
        color: 'var(--dsw-alias-label-primary)',
      },
      menuRowNote: {
        fontSize: 11,
        color: 'var(--dsw-alias-label-caption)',
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
      /** The same tag, quieter: this provider is not drawn in the panel right now. */
      rowTagHidden: {
        flex: 'none',
        padding: '1px 6px',
        fontSize: 11,
        lineHeight: '16px',
        color: 'var(--dsw-alias-label-tertiary)',
        border: '.5px dashed var(--dsw-alias-border-l2)',
        borderRadius: 4,
      },
      /** The hide switch's own cell in the row head, so the wrapper can be tagged. */
      hideSwitch: {
        flex: 'none',
        display: 'inline-flex',
        alignItems: 'center',
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
      /** The funding line under the summary: what using this provider costs. */
      rowFunding: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 11,
        lineHeight: '16px',
        color: 'var(--dsw-alias-label-tertiary)',
      },
      fundingLink: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        marginLeft: 'auto',
        color: 'var(--dsw-alias-link)',
        textDecoration: 'none',
        whiteSpace: 'nowrap',
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
      balanceValue: {
        fontWeight: 600,
        whiteSpace: 'nowrap',
      },
      balanceNote: {
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
       * The pane's home as a stacked accordion (founder, 2026-09-23): one section per
       * provider, in the registry's own order, and a section holds that provider's
       * workflows as cards.
       */
      sections: {
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: '14px 12px 2px',
      },
      /**
       * ONE SECTION IS ONE CARD (founder, 2026-09-23): the header and the body it opens
       * share a single border and radius, so expanding a section grows that card rather
       * than stacking a second one under it. The header keeps no card of its own.
       */
      section: {
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--dsw-alias-bg-layer-1)',
        border: '.5px solid var(--dsw-alias-border-l4)',
        borderRadius: 12,
        overflow: 'hidden',
      },
      sectionHead: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        boxSizing: 'border-box',
        padding: '10px 12px',
        textAlign: 'left',
        font: 'inherit',
        color: 'inherit',
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
      },
      /**
       * THE SUBHEADER (founder, 2026-09-23: *"the accordion header for generate is too
       * cluttered. remove the wallet balance, workflows counter, add/refresh icons.
       * make a subheader with separator top/bottom and move these elements into it"*).
       *
       * A second band under the header, inside the same card: one hairline above and
       * one below, holding the balance, the count line and the two glyph controls that
       * used to crowd the header. The header keeps only the status light, the
       * provider's name with its account glyph, and the chevron — one row whatever a
       * provider's numbers say. The band is drawn open or shut: the balance and the
       * count are what a person scans four collapsed sections for, and add and refresh
       * are how a collapsed one is acted on. It is NOT the toggle — only the header
       * above it folds the section.
       */
      sectionSub: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 12px',
        borderTop: '1px solid var(--dsw-alias-border-l1)',
        borderBottom: '1px solid var(--dsw-alias-border-l1)',
      },
      sectionLight: {
        flex: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 26,
        height: 26,
      },
      /**
       * The wallet balance, now the SUBHEADER's own row: it sat in a strip above the
       * accordion (founder, 2026-09-23: *"move the wall balance to row 2 below
       * accordion title"*), then in the header's second row, and now in the band under
       * the header (the same day: the header was *"too cluttered"*). The subheader is
       * ONE flex row, so the balance grows into the room the count line and the two
       * glyphs leave it and clips rather than pushing them out.
       */
      sectionBalance: {
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        flex: '1 1 auto',
        minWidth: 0,
        fontSize: 12,
        lineHeight: '18px',
        color: 'var(--dsw-alias-label-secondary)',
        // One line, always: the band clips rather than grows, so a provider's
        // explanatory note cannot deepen the section.
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      },
      /** Row 1 of a header: the provider's name and the way out to its own page. */
      sectionTitleRow: {
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        minWidth: 0,
      },
      /** The way out: a glyph beside the name, not a word under it. */
      sectionAccountIcon: {
        flex: 'none',
        display: 'inline-flex',
        alignItems: 'center',
        color: 'var(--dsw-alias-label-tertiary)',
        textDecoration: 'none',
      },
      sectionText: {
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        minWidth: 0,
        flex: 1,
      },
      sectionTitle: {
        fontSize: 14,
        fontWeight: 600,
        lineHeight: 1.4,
        color: 'var(--dsw-alias-label-primary)',
        // The header is ONE ROW and the subheader under it is one more, so nothing a
        // provider says can deepen the section (founder, 2026-09-23: the title was
        // *"too cluttered"* after an earlier *"should only be 2 rows"*): the name, the
        // balance, the count line and the notes all clip rather than wrap.
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      },
      /**
       * The count line: the subheader's own text, sitting immediately left of the add
       * glyph (founder, 2026-09-23). It takes its width from its words and never
       * shrinks — the balance beside it is the one that gives way.
       */
      sectionMeta: {
        flex: 'none',
        fontSize: 12,
        lineHeight: 1.4,
        color: 'var(--dsw-alias-label-caption)',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      },
      sectionChevron: {
        flex: 'none',
        display: 'flex',
        alignItems: 'center',
        color: 'var(--dsw-alias-label-tertiary)',
      },
      /**
       * The subheader's own controls, at the end of the band: add a workflow and
       * re-read the section, both as glyphs (founder, 2026-09-23: *"move + workflow
       * button as an icon button next to refresh"*), with the count line immediately
       * to their left.
       */
      sectionActions: {
        flex: 'none',
        display: 'flex',
        alignItems: 'center',
        gap: 2,
      },
      /**
       * What a tooltip hangs on. The primitive needs a DOM node for its own ref, and
       * the harness's `Button` is a function component that forwards none, so the
       * bubble is attached to this box around the button: the box is the button's own
       * size, and mouse and focus events reach it from the button inside.
       */
      tipAnchor: {
        flex: 'none',
        display: 'inline-flex',
      },
      sectionBody: {
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: '2px 12px 12px',
      },
      sectionCards: {
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      },
      /** The note under the accordion: where the key is managed, and nothing else. */
      sectionNotes: {
        padding: '8px 12px 0',
      },
      /**
       * One card, the harness's own start-page card (the guide's `.entry`): 24px
       * radius, a half-pixel border, a 26px glyph, a 15px title and one 13px line
       * under it — and NO thumbnail. Founder, 2026-09-23: *"the workflow card is same
       * design as dsh start page card; icon + label + 2nd row (no thumbnails)"*.
       *
       * Inline styles carry no `:hover`, so the hover value is swapped in from state
       * by the card itself (`useHover`), which is the one part of the start-page card
       * that would otherwise be lost.
       */
      startCard: {
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        // The start-page card's own size (the guide's `.entry`): 380px wide, floored at
        // 56px tall. The width is the point — the card keeps its size inside the section
        // card instead of stretching to it.
        width: 380,
        maxWidth: '100%',
        boxSizing: 'border-box',
        minHeight: 56,
        padding: '14px 20px',
        textAlign: 'left',
        font: 'inherit',
        color: 'var(--dsw-alias-label-primary)',
        background: 'var(--dsw-alias-bg-layer-1)',
        border: '.5px solid var(--dsw-alias-border-l4)',
        borderRadius: 24,
        cursor: 'pointer',
      },
      startCardHover: { background: 'var(--dsw-alias-interactive-bg-hover)' },
      startCardIcon: {
        flex: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 26,
        height: 26,
        color: 'var(--dsw-alias-label-secondary)',
      },
      /**
       * A one-colour mark, painted in the card's own colour: `currentColor` under a
       * mask. One asset, both themes, no inverse to keep in step.
       */
      startCardMark: {
        display: 'block',
        width: 24,
        height: 24,
        backgroundColor: 'currentColor',
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        maskPosition: 'center',
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
      },
      /** A mark that carries its own colours: drawn as it came, on every theme. */
      startCardLogo: {
        display: 'block',
        width: 24,
        height: 24,
        objectFit: 'contain',
      },
      startCardText: {
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
        minWidth: 0,
      },
      startCardTitle: {
        fontSize: 15,
        lineHeight: 1.4,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      },
      startCardLine: {
        fontSize: 13,
        lineHeight: 1.4,
        color: 'var(--dsw-alias-label-caption)',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      },
      /** What the add control's click reveals: the sentence, the snippet, and Copy. */
      /** The revealed prompt: the primitive draws it, this only carries the attribute. */
      promptBlock: {
        minWidth: 0,
      },
      addPrompt: {
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        padding: '0 2px 2px',
      },
      /** One workflow's surface: the form column, inside the pane, under the strip. */
      surface: {
        padding: '10px 12px 24px',
      },
      /**
       * The way out, and the room under it (founder, 2026-09-23: *"the All workflows
       * button should have back arrow … Increase gap space below"*): the chevron rides
       * with the label, and the control is a ghost button with the arrow's own width
       * reserved so the label never shifts.
       */
      surfaceHead: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 18,
      },
      /**
       * A CARD: the surface a group of controls or a piece of output is drawn on.
       *
       * REUSABLE ON PURPOSE (founder, 2026-09-23: *"let's make layout 2 cards, parameters
       * card and preview card, these are reusable components so when you build UI from
       * design.md it will be consistent"*). One definition, used by every card in this
       * plugin, so the next surface gets the same surface, radius, border and padding
       * instead of inventing its own. It follows the design system's card rules: the card
       * is a raised layer, its definition comes from the border (dark elevation carries no
       * shadow), and rows inside it separate by spacing rather than by dividers.
       *
       * The tokens are the harness's own `--dsw-alias-*` aliases, never a brand's: this
       * package runs under EVA, the stock theme and any community theme alike (§5 rule 9).
       */
      card: {
        boxSizing: 'border-box',
        background: 'var(--dsw-alias-bg-layer-2)',
        border: '1px solid var(--dsw-alias-border-l3)',
        borderRadius: 12,
        padding: '14px',
        minWidth: 0,
      },
      /**
       * PARAMETERS BESIDE THE OUTPUT (founder, 2026-09-23: *"Design for responsive, past
       * mobile breakpoint we should 2 column parameters + output preview"*). It is a
       * WRAPPING FLEX ROW, not a media query: the pane is what changes width — docked,
       * split, or fullscreen — so the breakpoint is the container's own, and the two
       * cards stack in a narrow pane and stand side by side in a wide one.
       */
      surfaceColumns: {
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'flex-start',
        gap: 16,
      },
      /** The parameters card: the doors, and the control that spends. */
      surfaceParams: {
        flex: '1 1 320px',
        minWidth: 260,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      },
      /** The preview card: what the run is doing and what it made. */
      surfaceOutput: {
        flex: '1 1 300px',
        minWidth: 240,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      },
      /**
       * The preview card's canvas: the plate the result is drawn on, shaped by the
       * workflow's own aspect door (founder, 2026-09-23: *"the aspect controls the shape of
       * preview card"*). Its `aspectRatio` is written per render from that door's current
       * value, so choosing 9:16 makes the canvas portrait before a run and keeps the
       * result in the same frame after it. It is capped in height because a portrait
       * canvas in a narrow pane would otherwise be taller than the screen.
       */
      previewFrame: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        maxHeight: '60vh',
        boxSizing: 'border-box',
        background: 'var(--dsw-alias-bg-layer-1)',
        border: '1px solid var(--dsw-alias-border-l1)',
        borderRadius: 8,
        overflow: 'hidden',
      },
      /** Where a finished run's bytes were saved: a label, then the path, clipped rather than wrapped. */
      savedLine: {
        display: 'flex',
        alignItems: 'baseline',
        gap: 6,
        minWidth: 0,
        fontSize: 11,
        lineHeight: '16px',
        color: 'var(--dsw-alias-label-caption)',
      },
      savedLabel: {
        flex: 'none',
      },
      savedPath: {
        minWidth: 0,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        color: 'var(--dsw-alias-label-tertiary)',
      },
      /** The result inside the canvas: contained, so no aspect is ever cropped. */
      previewImage: {
        display: 'block',
        width: '100%',
        height: '100%',
        objectFit: 'contain',
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
      /**
       * THE NUMBER DOOR IS A STEPPER (founder, 2026-09-23: *"for number input use the
       * correct primitive"*, with RunningHub's own form as the reference). It is the
       * same design the founder pasted — a bordered group, a square button either side,
       * the value centred between them — drawn with the harness's own `Button` and
       * theme aliases rather than by adding React Aria and Tailwind to a public plugin:
       * this package declares one external peer and no runtime dependencies, and a
       * control is not worth a second React stack inside the bundle.
       */
      stepper: {
        display: 'flex',
        alignItems: 'stretch',
        marginTop: 6,
        width: '100%',
        maxWidth: 180,
        boxSizing: 'border-box',
        background: 'var(--dsw-alias-bg-layer-1)',
        border: '1px solid var(--dsw-alias-border-l1)',
        borderRadius: 6,
        overflow: 'hidden',
      },
      /**
       * One side of the stepper. The minus is TEXT, not an icon: the harness's icon set
       * carries no minus glyph (measured 2026-09-23 — every `Icon*` export under
       * `@deepseek-ai/dsh-client-ui-primitives`), and a hand-drawn SVG for a horizontal
       * bar would be a worse answer than U+2212, which is the character the typographic
       * minus is for.
       */
      stepperButton: {
        flex: 'none',
        width: 30,
        padding: 0,
        font: 'inherit',
        fontSize: 14,
        lineHeight: 1,
        color: 'var(--dsw-alias-label-secondary)',
        background: 'transparent',
        border: 'none',
        borderRight: '1px solid var(--dsw-alias-border-l1)',
        cursor: 'pointer',
      },
      /** The increment sits on the other edge, so its border faces the other way. */
      stepperButtonUp: {
        borderRight: 'none',
        borderLeft: '1px solid var(--dsw-alias-border-l1)',
      },
      /** The value: centred, tabular, and quiet about its own edges. */
      stepperValue: {
        flex: '1 1 auto',
        minWidth: 0,
        marginTop: 0,
        padding: '7px 4px',
        textAlign: 'center',
        fontVariantNumeric: 'tabular-nums',
        background: 'transparent',
        border: 'none',
        borderRadius: 0,
      },
      /** A door the app exposes as an image slot: pick a file, or paste a URL. */
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
      /** The image door: the pick control and the URL field side by side. */
      imageRow: {
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
        flexWrap: 'wrap',
      },
      /** A file that could not be uploaded. The provider's own reason is in the attribute. */
      imageProblem: {
        flexBasis: '100%',
        marginTop: 4,
        fontSize: 11,
        color: 'var(--dsw-alias-state-error-primary)',
      },
      /**
       * A LIST DOOR: the rows, then the add control. One row is one object in the array the
       * API takes, so the row is drawn as its own bordered block rather than as a line of
       * fields that could be read as part of the row above.
       */
      list: {
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        marginTop: 6,
      },
      listRow: {
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'flex-end',
        gap: 8,
        padding: '8px 10px',
        background: 'var(--dsw-alias-bg-layer-1)',
        border: '1px solid var(--dsw-alias-border-l1)',
        borderRadius: 6,
      },
      /** One field inside a row: it grows, so two fields share the row's width. */
      listField: {
        flex: '1 1 120px',
        minWidth: 100,
      },
      /**
       * S5: the run. One column under the form — the Run control, then the strip that
       * says where the run is, then the result. Every value is a theme alias, so the
       * pane reads under EVA, the stock theme and any community theme alike.
       */
      runBlock: {
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        marginTop: 18,
        paddingTop: 14,
        borderTop: '1px solid var(--dsw-alias-border-l1)',
      },
      /**
       * The output column (founder, 2026-09-23): what the run is doing and what it made,
       * beside the parameters in a wide pane and under them in a narrow one. It draws
       * nothing at all in the form phase — `data-generate-output-empty` is how a check
       * knows the column is there and quiet rather than missing.
       */
      runOutput: {
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        minWidth: 0,
      },
      runStrip: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 10px',
        fontSize: 12,
        lineHeight: '18px',
        color: 'var(--dsw-alias-label-secondary)',
        background: 'var(--dsw-alias-bg-layer-1)',
        border: '.5px solid var(--dsw-alias-border-l1)',
        borderRadius: 8,
      },
      /** The phase, first and strongest: it is the answer to "what is happening". */
      runPhase: {
        flex: 'none',
        color: 'var(--dsw-alias-label-primary)',
        fontWeight: 600,
      },
      /** Elapsed time and the run id: facts beside the phase, never louder than it. */
      runMeta: {
        minWidth: 0,
        color: 'var(--dsw-alias-label-caption)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      },
      runFailed: {
        color: 'var(--dsw-alias-state-error-primary)',
        borderColor: 'var(--dsw-alias-state-error-primary)',
        alignItems: 'flex-start',
      },
      // `runFigure` and `runImage` used to hold the result here. The result moved into the
      // preview card's own canvas, which the aspect door shapes — see `previewFrame`.
      runLink: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        color: 'var(--dsw-alias-link)',
        textDecoration: 'none',
        whiteSpace: 'nowrap',
        fontSize: 12,
      },
      /** The gate's own rows: a label, then the value a person is about to send. */
      gateRows: {
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        marginTop: 4,
      },
      gateRow: {
        display: 'flex',
        gap: 10,
        fontSize: 12,
        lineHeight: '18px',
      },
      gateKey: {
        flex: 'none',
        width: 104,
        color: 'var(--dsw-alias-label-caption)',
      },
      gateValue: {
        minWidth: 0,
        color: 'var(--dsw-alias-label-primary)',
        overflowWrap: 'anywhere',
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
     * ONE PROVIDER LIST, READ BY EVERY SURFACE THAT DRAWS IT.
     *
     * Settings → Generate owns the hide switch and the Generate pane owns the sections,
     * and the two are mounted at once: Settings is a dialog over the app
     * (`dsh-client-ui-settings-general`, `role="dialog"`), so the pane behind it never
     * unmounts while a switch is thrown. Each held a private copy fetched when it
     * mounted, so a flipped switch moved the row it lives on and the pane kept drawing
     * the provider anyway — the only thing that made the pane ask again was restarting
     * the app (founder, 2026-09-23: *"I tested toggle and it works if I restart"*).
     * The list lives here now: one read, every mounted surface subscribed, so a hide
     * lands in the pane on the click and a key linked in the pane reaches the Settings
     * row the same way.
     *
     * READS STILL HAPPEN PER MOUNT, because the host is the one place that knows whether
     * a stored key still works. Concurrent mounts share a request, `force` asks again
     * (that is the Refresh control), and `mark` is what keeps a read that started before
     * a local change from publishing over it: the row a person just switched is newer
     * than a list already in flight.
     */
    const providerStore = (() => {
      let state = { phase: 'loading', providers: [] }
      let revision = 0
      let inflight = null
      const listeners = new Set()

      const publish = (next) => {
        state = next
        for (const listener of Array.from(listeners)) listener()
      }

      const ask = async () => {
        try {
          const response = await fetch(PROVIDERS_API, { headers: { accept: 'application/json' } })
          const body = await response.json()
          if (!response.ok || !body || !Array.isArray(body.providers)) return { phase: 'failed', providers: [] }
          return { phase: 'ready', providers: body.providers }
        } catch {
          return { phase: 'failed', providers: [] }
        }
      }

      return {
        read: () => state,
        subscribe(listener) {
          listeners.add(listener)
          return () => listeners.delete(listener)
        },
        load({ force = false } = {}) {
          if (inflight !== null && !force) return inflight
          const mark = revision
          inflight = ask().then((next) => {
            inflight = null
            if (mark === revision) publish(next)
            return next
          })
          return inflight
        },
        /** Replace one provider's row without dropping the others. */
        replace(row) {
          revision += 1
          publish({
            ...state,
            providers: state.providers.map((provider) => (provider.id === row.id ? { ...provider, ...row } : provider)),
          })
        },
      }
    })()

    /**
     * Every provider, with the state of its key.
     *
     * THE KEY NEVER REACHES THIS HALF (§12 rule 2): a save posts the value once and
     * every read afterwards is a balance. That was true of one wallet and stays true
     * of several providers — including the shape of this hook, which holds statuses
     * rather than secrets.
     */
    function useProviders() {
      const [state, setState] = React.useState(providerStore.read())
      const [busy, setBusy] = React.useState(false)
      // The last save's outcome, held by the surface rather than by the field: a
      // successful link replaces the field with the account view, so a confirmation
      // kept inside `KeyForm` would unmount with it. It is an id now, because with
      // several providers "which key was just linked" is part of the fact.
      const [confirmed, setConfirmed] = React.useState(null)

      // Subscribed before the read below starts, so a list that lands while this
      // surface is mounting still reaches it.
      React.useEffect(() => providerStore.subscribe(() => setState(providerStore.read())), [])

      // The host is asked once per mount, the way it always was.
      React.useEffect(() => {
        providerStore.load()
      }, [])

      /** Replace one provider's row without dropping the others. */
      const replace = providerStore.replace

      /**
       * The settings toggle: hide a provider from the panel, or bring it back.
       *
       * Optimistic, because the switch is the control the person is looking at: it moves
       * on the click and returns if the host refuses, which reads as "that did not
       * stick" rather than as a control that ignores you. Nothing else in the row
       * changes — a hidden provider keeps its key, its account and its adapters.
       */
      const setHidden = React.useCallback(
        async (id, hidden) => {
          replace({ id, hidden })
          try {
            const response = await fetch(providerUrl(id, 'hidden'), {
              method: 'POST',
              headers: { 'content-type': 'application/json', accept: 'application/json' },
              body: JSON.stringify({ hidden }),
            })
            if (!response.ok) throw new Error('refused')
            return { ok: true, error: null }
          } catch {
            replace({ id, hidden: !hidden })
            return { ok: false, error: 'unreachable' }
          }
        },
        [replace],
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
      // Refresh asks again rather than taking whatever read is already in flight.
      const reload = React.useCallback(() => providerStore.load({ force: true }), [])

      return { phase: state.phase, providers: state.providers, busy, load: reload, save, unlink, setHidden, confirmed, forget }
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
     * The three calls a run makes, in the order a run makes them (S5).
     *
     * THE HOST BUILDS THE BODY, NOT THIS HALF. The gate shows the request that will leave
     * the machine, so the request has to be built by the same function that sends it; a
     * preview assembled here would be a second implementation, and the two would drift
     * into a dialog that describes something else.
     *
     * The key never appears in any of this: the host reads it from the credential store
     * per call (§12 rule 2).
     */

    /** The gate's preview: free, read-only, and the exact body a confirm would post. */
    async function fetchPayload(provider, name, values, options) {
      try {
        const response = await fetch(providerUrl(provider, 'payload'), {
          method: 'POST',
          headers: { 'content-type': 'application/json', accept: 'application/json' },
          body: JSON.stringify(options ? { name, values, options } : { name, values }),
        })
        let body = null
        try {
          body = await response.json()
        } catch {
          body = null
        }
        if (!response.ok || !body) return { ok: false, error: (body && body.error) || 'host-error' }
        return { ok: true, preview: body }
      } catch {
        return { ok: false, error: 'unreachable' }
      }
    }

    /**
     * Start it. `confirmed: true` is the person's own action, recorded by the host in the
     * run's file; the route refuses a call without it, so the gate is not merely a dialog
     * this half chose to draw.
     */
    async function postRun(provider, name, values, options) {
      try {
        const response = await fetch(providerUrl(provider, 'run'), {
          method: 'POST',
          headers: { 'content-type': 'application/json', accept: 'application/json' },
          body: JSON.stringify(options ? { name, values, options, confirmed: true } : { name, values, confirmed: true }),
        })
        let body = null
        try {
          body = await response.json()
        } catch {
          body = null
        }
        if (!response.ok || !body || !body.jobId) return { ok: false, error: (body && body.error) || 'host-error', detail: body && body.detail }
        return { ok: true, jobId: body.jobId, status: body.status }
      } catch {
        return { ok: false, error: 'unreachable' }
      }
    }

    /** One poll. The host asks Krea and writes the outcome back to the run's record. */
    async function readRun(provider, jobId) {
      try {
        const response = await fetch(providerUrl(provider, 'run') + '?job=' + encodeURIComponent(jobId), {
          headers: { accept: 'application/json' },
        })
        let body = null
        try {
          body = await response.json()
        } catch {
          body = null
        }
        if (!response.ok || !body) return { ok: false, error: (body && body.error) || 'host-error' }
        // `saved` is the host's own answer about the library: where a finished run's bytes
        // were written. It travels with the poll because that is when they are written.
        return { ok: true, ...body, saved: Array.isArray(body.saved) ? body.saved : [] }
      } catch {
        return { ok: false, error: 'unreachable' }
      }
    }

    /**
     * Upload one file an image door was given, and answer the URL the door carries.
     *
     * WHY THIS IS NOT A DATA URI. Krea's fields do accept a base64 data URI, but `image_url`
     * and a style reference's `url` cap the string at 1024 characters — a photograph inlined
     * is far past that. So the file goes to the provider's asset API and the door carries the
     * URL that comes back. The key stays on the host, which is why this calls this plugin's
     * own route rather than Krea (founder, 2026-09-23: the pane must hold no key).
     *
     * The bytes ARE the body — an image is megabytes, and a JSON envelope would inflate it by
     * a third. The file's name rides in a header, percent-encoded because a header is no place
     * for a space or a quote.
     */
    async function uploadImage(provider, file) {
      let response
      try {
        response = await fetch(providerUrl(provider, 'asset'), {
          method: 'POST',
          headers: {
            'content-type': file.type || 'application/octet-stream',
            'x-file-name': encodeURIComponent(file.name || 'upload'),
          },
          body: file,
        })
      } catch {
        return { ok: false, error: 'unreachable' }
      }
      let body = null
      try {
        body = await response.json()
      } catch {
        body = null
      }
      if (!response.ok || !body || typeof body.url !== 'string') {
        return { ok: false, error: (body && body.error) || 'host-error', detail: body && body.detail }
      }
      return { ok: true, url: body.url }
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
      // A list starts empty: no row exists until a person adds one, which is why the add
      // control is the first thing the list draws and a `max` of one is respected from the
      // start rather than after a failed run.
      if (door.type === 'list') return []
      if (door.default !== undefined) return door.default
      if (door.type === 'select') return Array.isArray(door.options) && door.options.length > 0 ? door.options[0] : ''
      if (door.type === 'number') return door.min !== undefined ? door.min : ''
      return ''
    }

    /** One row of a list door, at the values the row's own doors declare. */
    function rowFor(door) {
      const row = {}
      for (const [key, field] of Object.entries(door.fields || {})) row[key] = defaultFor(field)
      return row
    }

    /**
     * What a door starts at on THIS surface: an authored starting value when the adapter
     * names one, and the app's own default otherwise.
     *
     * THE APP OWNS THE BOUNDS, THE OWNER OWNS THE STARTING VALUE (founder, 2026-09-23:
     * *"you can set 15 as the default"* — the MiniMax H3 app declares `default: 0` on its
     * duration door, and no video is zero seconds). That is why `ui.defaults` sits
     * beside the derived `default` instead of overwriting it: the validator keeps
     * comparing `default` with the app, so a re-check still notices when the app moves,
     * and the starting value is a product choice that survives that comparison.
     */
    function startFor(key, door, defaults) {
      const authored = defaults && Object.prototype.hasOwnProperty.call(defaults, key) ? defaults[key] : undefined
      return authored === undefined ? defaultFor(door) : authored
    }

    /** One card on the pane's first screen: the whole card opens that workflow. */
    /**
     * Inline styles carry no `:hover`, and the start-page card's hover background is
     * part of what makes it read as a control, so the two values are swapped from
     * state. One hook, every card in the pane.
     */
    function useHover() {
      const [hover, setHover] = React.useState(false)
      return [hover, { onMouseEnter: () => setHover(true), onMouseLeave: () => setHover(false) }]
    }

    /**
     * THE MODEL MARKS. A workflow card wears the mark of the model it runs when its
     * name says which model that is, and the generic branch glyph when it does not
     * (founder, 2026-09-23: *"can you use logo for Krea WF"*, then LobeHub's icon set
     * as the source of AI logos).
     *
     * TWO TREATMENTS, because the marks are two kinds of picture:
     *
     * - A ONE-COLOUR mark is drawn as a CSS MASK over `currentColor`, so it takes the
     *   card's own text colour and needs NO dark-theme inverse. A raw black PNG is what
     *   would have needed one; a second white copy would be a second asset to keep in
     *   step. Only its alpha is read, so the file's own colour is irrelevant.
     * - A MARK THAT CARRIES ITS OWN COLOURS is drawn as an image. Qwen is this one: the
     *   founder first asked for LobeHub's `<Qwen.Avatar>`, then picked the gradient mark
     *   instead (2026-09-23: *"qwen should be purple … `<Qwen.Color size={56} />` this
     *   one is better"*), so the tile is gone and the mark keeps its own gradient.
     *   Masking it would read its transparent counters as opaque and fill the mark in.
     *
     * Krea is the only mask: its 96px PNG has a transparent field and its alpha is the
     * shape. MiniMax and Qwen are drawn as images — the `-color` files, which is what
     * LobeHub's `Color` components render (`<Minimax.Color size={56} />`,
     * `<Qwen.Color size={56} />`; founder, 2026-09-23, picking Color over the mono and
     * Avatar forms for both).
     */
    const KREA_MARK =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAABgCAMAAADVRocKAAACE1BMVEVMaXEAAAAAAAAAAAAAAA'
      + 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
      + 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
      + 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
      + 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
      + 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
      + 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
      + 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
      + 'AAAAAAAAAAAAAAAABUSV8qAAAAsHRSTlMA5ynv0OFlLQQsARGBCR9mtPbHOEQGMmQgf4gz0YalBUOEqjq5KCdHJKdQIwr42B'
      + 'DdG3HpipMuJfPSzoliNA5b8Rqa5o0xdyq7Pi/02o6twmd0tzn9y988+rKe9fvX04BCwOQTi075PWwevMgPma9ykBZoo7Zrru'
      + 'AZmI8HbaxfVwsVsamf63Yd6lV1xRhY4gxaIlGbYcxwl9zuvVICYHlB5Um+kjfVeky4fKJqw2/BRp5YuwMAAAAJcEhZcwAAA+'
      + 'gAAAPoAbV7UmsAAAP0SURBVGje7ZrnV9RAFMUDCywCIm0XkCK9KdJVBEV67yooKkVFpYu99957772/P1FSVkI2b3Zehj2HD7'
      + '5PkN9y70mYzLy5s5L0vxZ4xXT32B043vkxqXG5ZfH15RGg1FBClhlf96BZ5e+vLbOiHwu6OnjFiJ1rdbivnCyf5QNza8lcnm'
      + 'DAESto+qngVrv0fIsb3lBJ0U8HkwqZ5adM8JrFBAMfMwOIcuGTpriBXz/BVACuani/OYYzvPpjiABEq7wKwfm8Bh2YwWYFB2'
      + 'IYIjkN1qIKMTLOQXEJpwEqAHdlnIziFj79UNzgtcyzUbyRz8COGyyVeRrOA7kMFuECsTIfxfkyUQNlnD7FufAjimOOUsgVNQ'
      + 'hX1iDc4LaoQZmMC3GDdlGDPBmX4gbHBA0KZVqL60OAmMGIQtsYBrWSyDDdocAehj4Eixh8VWERQ99PEjDQ1vwLrBs4btkg/7'
      + 'q23pax9GGA06B+dh1/lD3Vv/fdfhcpYeoD74Lmqz3RH76GTu8nW38rqWdpqDdefggeinfBlDIAbI2Ga4Gvqj3pcy/5MwZpc3'
      + '7PiwtoA8+1l7+tq9N+CK5I3G7rBc4it7/LU4BSl6n6ISR5GHYQ9W/Q9HknUo7ey7ziifqJRH1YRdPfTdUPId6AP1G/lKifSb'
      + '2BSqJBGFF/gPoKDNP0o6n6BTT9fvIcsYqkv1TyrkGyhQyhkqD/y1IKksut/8VazMI7TH1Wq8tGk+SdF+1ikPLps9WwT/LCVN'
      + 'GbqS2wfQArqQYck92Utt/LsTZWPU3XYaHaB1t1eytS+bHkD9tdid521yXyQwqKwNSbW2+6PlSnu3yIPFbNI53spJf/QrEhPd'
      + 'i2mOywesKwR/2dnKprYI37/W/8yotct3vudEqLbcOztztGqjqjQvW7+Hr3zA6CuA2a4CD7wzkR6BaRdxPY/AeltTXbzP/7/h'
      + 'QDgEG72dhKqmI02akkg5leqiPDAKbZb98BosFM2TYllhR3Jo25yIH56a/dN+J+09rMU8M0iJKs7/Q3VqiM2dJ/kESihAlWJk'
      + 'xr8OysBrp7HqIELAx57vEhOQXjnDr1PfdanAOwU8bxuMETUQPljGISNxicl1DwHm7g7+1YM1zYQDlsWunFYFaJlttx7qDEOW'
      + 'ivzugsT4jG+59l/l14PsUFKtgHFJs5DT6hCsrB6H0Uj3MaPGaPcwdqsIfTIA8T0LLNrQg+wr3sF5sLXNLwUcTgFn/vVcReEi'
      + 'dFjxrNXwVd4nFe9LBUinQXKNbzLvfj3oL5PbA2hsyjxANr45F7l9s+b51+jxJOziuUKDlgk/rnRTXppl8aGLepPO2FpS8NqJ'
      + 'uEPW+cjJu/42yMLJD+1wKvv0m/OYkd9ceRAAAAAElFTkSuQmCC'
    const QWEN_MARK =
      'data:image/svg+xml;base64,PHN2ZyBoZWlnaHQ9IjFlbSIgc3R5bGU9ImZsZXg6bm9uZTtsaW5lLWhlaWdodDoxIiB2aW'
      + 'V3Qm94PSIwIDAgMjQgMjQiIHdpZHRoPSIxZW0iIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHRpdGxlPl'
      + 'F3ZW48L3RpdGxlPjxwYXRoIGQ9Ik0xMi42MDQgMS4zNGMuMzkzLjY5Ljc4NCAxLjM4MiAxLjE3NCAyLjA3NWEuMTguMTggMC'
      + 'AwMC4xNTcuMDkxaDUuNTUyYy4xNzQgMCAuMzIyLjExLjQ0Ni4zMjdsMS40NTQgMi41N2MuMTkuMzM3LjI0LjQ3OC4wMjQuOD'
      + 'M3LS4yNi40My0uNTEzLjg2NC0uNzYgMS4zbC0uMzY3LjY1OGMtLjEwNi4xOTYtLjIyMy4yOC0uMDQuNTEybDIuNjUyIDQuNj'
      + 'M3Yy4xNzIuMzAxLjExMS40OTQtLjA0My43Ny0uNDM3Ljc4NS0uODgyIDEuNTY0LTEuMzM1IDIuMzQtLjE1OS4yNzItLjM1Mi'
      + '4zNzUtLjY4LjM3LS43NzctLjAxNi0xLjU1Mi0uMDEtMi4zMjcuMDE2YS4wOTkuMDk5IDAgMDAtLjA4MS4wNSA1NzUuMDk3ID'
      + 'U3NS4wOTcgMCAwMS0yLjcwNSA0Ljc0Yy0uMTY5LjI5My0uMzguMzYzLS43MjUuMzY0LS45OTcuMDAzLTIuMDAyLjAwNC0zLj'
      + 'AxNy4wMDJhLjUzNy41MzcgMCAwMS0uNDY1LS4yNzFsLTEuMzM1LTIuMzIzYS4wOS4wOSAwIDAwLS4wODMtLjA0OUg0Ljk4Mm'
      + 'MtLjI4NS4wMy0uNTUzLS4wMDEtLjgwNS0uMDkybC0xLjYwMy0yLjc3YS41NDMuNTQzIDAgMDEtLjAwMi0uNTRsMS4yMDctMi'
      + '4xMmEuMTk4LjE5OCAwIDAwMC0uMTk3IDU1MC45NTEgNTUwLjk1MSAwIDAxLTEuODc1LTMuMjcybC0uNzktMS4zOTVjLS4xNi'
      + '0uMzEtLjE3My0uNDk2LjA5NS0uOTY1LjQ2NS0uODEzLjkyNy0xLjYyNSAxLjM4Ny0yLjQzNi4xMzItLjIzNC4zMDQtLjMzNC'
      + '41ODQtLjMzNWEzMzguMyAzMzguMyAwIDAxMi41ODktLjAwMS4xMjQuMTI0IDAgMDAuMTA3LS4wNjNsMi44MDYtNC44OTVhLj'
      + 'Q4OC40ODggMCAwMS40MjItLjI0NmMuNTI0LS4wMDEgMS4wNTMgMCAxLjU4My0uMDA2TDExLjcwNCAxYy4zNDEtLjAwMy43Mj'
      + 'QuMDMyLjkuMzR6bS0zLjQzMi40MDNhLjA2LjA2IDAgMDAtLjA1Mi4wM0w2LjI1NCA2Ljc4OGEuMTU3LjE1NyAwIDAxLS4xMz'
      + 'UuMDc4SDMuMjUzYy0uMDU2IDAtLjA3LjAyNS0uMDQxLjA3NGw1LjgxIDEwLjE1NmMuMDI1LjA0Mi4wMTMuMDYyLS4wMzQuMD'
      + 'YzbC0yLjc5NS4wMTVhLjIxOC4yMTggMCAwMC0uMi4xMTZsLTEuMzIgMi4zMWMtLjA0NC4wNzgtLjAyMS4xMTguMDY4LjExOG'
      + 'w1LjcxNi4wMDhjLjA0NiAwIC4wOC4wMi4xMDQuMDYxbDEuNDAzIDIuNDU0Yy4wNDYuMDgxLjA5Mi4wODIuMTM5IDBsNS4wMD'
      + 'YtOC43Ni43ODMtMS4zODJhLjA1NS4wNTUgMCAwMS4wOTYgMGwxLjQyNCAyLjUzYS4xMjIuMTIyIDAgMDAuMTA3LjA2MmwyLj'
      + 'c2My0uMDJhLjA0LjA0IDAgMDAuMDM1LS4wMi4wNDEuMDQxIDAgMDAwLS4wNGwtMi45LTUuMDg2YS4xMDguMTA4IDAgMDEwLS'
      + '4xMTNsLjI5My0uNTA3IDEuMTItMS45NzdjLjAyNC0uMDQxLjAxMi0uMDYyLS4wMzUtLjA2Mkg5LjJjLS4wNTkgMC0uMDczLS'
      + '4wMjYtLjA0My0uMDc3bDEuNDM0LTIuNTA1YS4xMDcuMTA3IDAgMDAwLS4xMTRMOS4yMjUgMS43NzRhLjA2LjA2IDAgMDAtLj'
      + 'A1My0uMDMxem02LjI5IDguMDJjLjA0NiAwIC4wNTguMDIuMDM0LjA2bC0uODMyIDEuNDY1LTIuNjEzIDQuNTg1YS4wNTYuMD'
      + 'U2IDAgMDEtLjA1LjAyOS4wNTguMDU4IDAgMDEtLjA1LS4wMjlMOC40OTggOS44NDFjLS4wMi0uMDM0LS4wMS0uMDUyLjAyOC'
      + '0uMDU0bC4yMTYtLjAxMiA2LjcyMi0uMDEyeiIgZmlsbD0idXJsKCNsb2JlLWljb25zLXF3ZW4tX1JfMF8pIiBmaWxsLXJ1bG'
      + 'U9Im5vbnplcm8iPjwvcGF0aD48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9ImxvYmUtaWNvbnMtcXdlbi1fUl8wXyIgeDE9Ij'
      + 'AlIiB4Mj0iMTAwJSIgeTE9IjAlIiB5Mj0iMCUiPjxzdG9wIG9mZnNldD0iMCUiIHN0b3AtY29sb3I9IiM2MzM2RTciIHN0b3'
      + 'Atb3BhY2l0eT0iLjg0Ij48L3N0b3A+PHN0b3Agb2Zmc2V0PSIxMDAlIiBzdG9wLWNvbG9yPSIjNkY2OUY3IiBzdG9wLW9wYW'
      + 'NpdHk9Ii44NCI+PC9zdG9wPjwvbGluZWFyR3JhZGllbnQ+PC9kZWZzPjwvc3ZnPg=='
    const MINIMAX_MARK =
      'data:image/svg+xml;base64,PHN2ZyBoZWlnaHQ9IjFlbSIgc3R5bGU9ImZsZXg6bm9uZTtsaW5lLWhlaWdodDoxIiB2aW'
      + 'V3Qm94PSIwIDAgMjQgMjQiIHdpZHRoPSIxZW0iIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHRpdGxlPk'
      + '1pbmltYXg8L3RpdGxlPjxkZWZzPjxsaW5lYXJHcmFkaWVudCBpZD0ibG9iZS1pY29ucy1taW5pbWF4LV9SXzBfIiB4MT0iMC'
      + 'UiIHgyPSIxMDAuMTgyJSIgeTE9IjUwLjA1NyUiIHkyPSI1MC4wNTclIj48c3RvcCBvZmZzZXQ9IjAlIiBzdG9wLWNvbG9yPS'
      + 'IjRTIxNjdFIj48L3N0b3A+PHN0b3Agb2Zmc2V0PSIxMDAlIiBzdG9wLWNvbG9yPSIjRkU2MDNDIj48L3N0b3A+PC9saW5lYX'
      + 'JHcmFkaWVudD48L2RlZnM+PHBhdGggZD0iTTE2LjI3OCAyYzEuMTU2IDAgMi4wOTMuOTI3IDIuMDkzIDIuMDd2MTIuNTAxYS'
      + '43NC43NCAwIDAwLjc0NC43MDkuNzQuNzQgMCAwMC43NDMtLjcwOVY5LjA5OWEyLjA2IDIuMDYgMCAwMTIuMDcxLTIuMDQ5QT'
      + 'IuMDYgMi4wNiAwIDAxMjQgOS4xdjYuNTYxYS42NDkuNjQ5IDAgMDEtLjY1Mi42NDUuNjQ5LjY0OSAwIDAxLS42NTMtLjY0NV'
      + 'Y5LjFhLjc2Mi43NjIgMCAwMC0uNzY2LS43NTguNzYyLjc2MiAwIDAwLS43NjYuNzU4djcuNDcyYTIuMDM3IDIuMDM3IDAgMD'
      + 'EtMi4wNDggMi4wMjYgMi4wMzcgMi4wMzcgMCAwMS0yLjA0OC0yLjAyNnYtMTIuNWEuNzg1Ljc4NSAwIDAwLS43ODgtLjc1My'
      + '43ODUuNzg1IDAgMDAtLjc4OS43NTJsLS4wMDEgMTUuOTA0QTIuMDM3IDIuMDM3IDAgMDExMy40NDEgMjJhMi4wMzcgMi4wMz'
      + 'cgMCAwMS0yLjA0OC0yLjAyNlYxOC4wNGMwLS4zNTYuMjkyLS42NDUuNjUyLS42NDUuMzYgMCAuNjUyLjI4OS42NTIuNjQ1dj'
      + 'EuOTM0YzAgLjI2My4xNDIuNTA2LjM3Mi42MzguMjMuMTMxLjUxNC4xMzEuNzQ0IDBhLjczNC43MzQgMCAwMC4zNzItLjYzOF'
      + 'Y0LjA3YzAtMS4xNDMuOTM3LTIuMDcgMi4wOTMtMi4wN3ptLTUuNjc0IDBjMS4xNTYgMCAyLjA5My45MjcgMi4wOTMgMi4wN3'
      + 'YxMS41MjNhLjY0OC42NDggMCAwMS0uNjUyLjY0NS42NDguNjQ4IDAgMDEtLjY1Mi0uNjQ1VjQuMDdhLjc4NS43ODUgMCAwMC'
      + '0uNzg5LS43OC43ODUuNzg1IDAgMDAtLjc4OS43OHYxNC4wMTNhMi4wNiAyLjA2IDAgMDEtMi4wNyAyLjA0OCAyLjA2IDIuMD'
      + 'YgMCAwMS0yLjA3MS0yLjA0OFY5LjFhLjc2Mi43NjIgMCAwMC0uNzY2LS43NTguNzYyLjc2MiAwIDAwLS43NjYuNzU4djMuOG'
      + 'EyLjA2IDIuMDYgMCAwMS0yLjA3MSAyLjA0OUEyLjA2IDIuMDYgMCAwMTAgMTIuOXYtMS4zNzhjMC0uMzU3LjI5Mi0uNjQ2Lj'
      + 'Y1Mi0uNjQ2LjM2IDAgLjY1My4yOS42NTMuNjQ2VjEyLjljMCAuNDE4LjM0My43NTcuNzY2Ljc1N3MuNzY2LS4zMzkuNzY2LS'
      + '43NTdWOS4wOTlhMi4wNiAyLjA2IDAgMDEyLjA3LTIuMDQ4IDIuMDYgMi4wNiAwIDAxMi4wNzEgMi4wNDh2OC45ODRjMCAuND'
      + 'E5LjM0My43NTguNzY3Ljc1OC40MjMgMCAuNzY2LS4zMzkuNzY2LS43NThWNC4wN2MwLTEuMTQzLjkzNy0yLjA3IDIuMDkzLT'
      + 'IuMDd6IiBmaWxsPSJ1cmwoI2xvYmUtaWNvbnMtbWluaW1heC1fUl8wXykiIGZpbGwtcnVsZT0ibm9uemVybyI+PC9wYXRoPj'
      + 'wvc3ZnPg=='
    /**
     * Matched against what the workflow calls itself — its title and the app name it
     * was installed from — case-insensitively. First match wins, so a more specific
     * entry goes above a broader one.
     */
    const BRAND_MARKS = [
      { match: /krea/i, src: KREA_MARK, mode: 'mask' },
      { match: /qwen/i, src: QWEN_MARK, mode: 'image' },
      { match: /minimax/i, src: MINIMAX_MARK, mode: 'image' },
    ]
    function markFor(unit) {
      const haystack = String(unit.title || '') + ' ' + String(unit.webappName || '')
      return BRAND_MARKS.find((entry) => entry.match.test(haystack)) || null
    }

    /**
     * One installed workflow, as the harness's own start-page card.
     *
     * NO THUMBNAIL AND NO PROVIDER ON THE CARD (founder, 2026-09-23: *"the workflow
     * card is same design as dsh start page card; icon + label + 2nd row (no
     * thumbnails)"*). The cover the API returns is dropped: it is a screenshot of an app
     * the person has not opened, and at pane width it read as a 72px postage stamp. The
     * provider is not repeated either — the card sits inside that provider's own
     * accordion section, whose header names it — while `data-generate-provider` still
     * carries the fact for anyone reading the DOM.
     */
    function UnitCard({ t, unit, onOpen }) {
      const [hover, hoverProps] = useHover()
      const mark = markFor(unit)
      return h(
        'button',
        {
          type: 'button',
          style: hover ? { ...S.startCard, ...S.startCardHover } : S.startCard,
          'data-generate-unit': unit.name,
          'data-generate-provider': unit.provider,
          onClick: () => onOpen(unit.provider, unit.name),
          ...hoverProps,
        },
        h(
          'span',
          { style: S.startCardIcon },
          // The mark wears the unit's name for anyone reading the DOM, and is hidden
          // from the reading order because the card's own title already says it.
          mark === null
            ? h(IconBranchOutline16, { size: 24 })
            : mark.mode === 'mask'
              ? h('span', {
                  style: { ...S.startCardMark, WebkitMaskImage: `url("${mark.src}")`, maskImage: `url("${mark.src}")` },
                  'data-generate-mark': unit.name,
                  'aria-hidden': true,
                })
              : h('img', { style: S.startCardLogo, src: mark.src, alt: '', 'data-generate-mark': unit.name, 'aria-hidden': true }),
        ),
        h(
          'span',
          { style: S.startCardText },
          h('span', { style: S.startCardTitle }, unit.title),
          h('span', { style: S.startCardLine }, unitLine(t, unit)),
        ),
      )
    }

    /**
     * The card's second row: whose work it is when that is a fact, then what the app
     * does. A workflow whose file carries no description falls back to the provider's
     * own label, so the row is never blank.
     */
    function unitLine(t, unit) {
      const parts = []
      if (unit.origin === 'community') parts.push(t('card.community'))
      if (unit.blurb) parts.push(unit.blurb)
      return parts.length > 0 ? parts.join(' · ') : unit.providerLabel || ''
    }

    /**
     * AN IMAGE DOOR: a file a person picks, or a URL they paste.
     *
     * Both halves are the API's own vocabulary. Krea's `image_url` and a style reference's
     * `url` each take *"an external URL, base64 data URI, or uploaded asset URL"*
     * (its OpenAPI, read 2026-09-23), so a paste is a first-class way to fill the field, and
     * a file — which cannot be pasted — goes to the provider's upload route and comes back as
     * the URL the field carries. The one thing that is NOT a value is what a file input
     * reports on its own (`C:\fakepath\…`), which is why this control never reads it: the
     * nothing-uploaded-yet state is the button itself, and the field stays empty until the
     * upload answers.
     *
     * The value is the URL string, so a surface that only ever pastes one still works, and
     * the gate shows the same string a run would send.
     */
    function ImageField({ t, provider, id, doorKey, value, onChange, canUpload }) {
      const [phase, setPhase] = React.useState('idle')
      const [problem, setProblem] = React.useState(null)

      const pick = async (event) => {
        const file = event.target.files && event.target.files[0]
        // Clearing the input is what lets the same file be picked twice: a file input fires
        // no change event for a value it already had.
        event.target.value = ''
        if (!file) return
        setPhase('uploading')
        setProblem(null)
        const uploaded = await uploadImage(provider, file)
        if (uploaded.ok) {
          setPhase('idle')
          onChange(uploaded.url)
          return
        }
        setPhase('failed')
        setProblem(uploaded.error)
      }

      return h(
        'div',
        { style: S.imageRow, 'data-generate-image': doorKey },
        canUpload
          ? h(
              'label',
              { style: S.imageBox, htmlFor: id + '-file' },
              h(IconSparkle16, { size: 12 }),
              h('span', null, phase === 'uploading' ? t('surface.image.uploading') : t('surface.image.choose')),
              h('input', {
                id: id + '-file',
                'data-generate-upload': doorKey,
                type: 'file',
                accept: 'image/*',
                style: { display: 'none' },
                onChange: pick,
              }),
            )
          : null,
        h('input', {
          style: S.input,
          id,
          'data-generate-door': doorKey,
          type: 'text',
          value: value === undefined || value === null ? '' : value,
          placeholder: t('surface.image.placeholder'),
          onChange: (event) => onChange(event.target.value),
        }),
        phase === 'failed' ? h('div', { style: S.imageProblem, 'data-generate-upload-failed': problem || 'yes' }, t('surface.image.failed')) : null,
      )
    }

    /**
     * A SPLIT BUTTON: one action, and one choice that belongs to it.
     *
     * The founder's reference is RunningHub's own form — *"RH has option to run as plus vs
     * ultra we can use this shadcn split button"* — where Run Now sits beside a smaller
     * segment showing the machine the run will use. The pattern is the shadcn ButtonGroup +
     * DropdownMenu one; the primitives are the harness's own (`Button`-styled halves and the
     * `Menu` it anchors, whose own documentation names the split-button case), because this
     * bundle carries no Tailwind and one external peer.
     *
     * The list is a radio group in behaviour: the current mode is marked selected, choosing
     * another closes the list and hands the id back. `label` is the action's text; the
     * segment shows the current mode and carries the accessible name of the choice.
     */
    function SplitButton({ t, label, modes, value, onValue, disabled, onClick, attrs }) {
      const [open, setOpen] = React.useState(false)
      const current = modes.find((mode) => mode.id === value) || modes[0]
      const items = modes.map((mode) => ({
        id: mode.id,
        label: h(
          'div',
          { style: S.menuRow, 'data-generate-mode-row': mode.id },
          h('span', { style: S.menuRowValue }, mode.label),
          mode.description ? h('span', { style: S.menuRowNote }, mode.description) : null,
        ),
      }))
      return h(
        'div',
        { style: S.splitButton, 'data-generate-split': 'yes' },
        h('button', { type: 'button', style: { ...S.primary, ...S.splitAction }, disabled, onClick, ...attrs }, label),
        h(Menu, {
          open,
          side: 'bottom',
          align: 'end',
          items,
          selectedId: current ? current.id : undefined,
          onSelect: (id) => {
            setOpen(false)
            onValue(id)
          },
          onClose: () => setOpen(false),
          anchor: h(
            'button',
            {
              type: 'button',
              style: { ...S.primary, ...S.splitToggle },
              disabled,
              title: t('run.mode'),
              'aria-label': t('run.mode') + ': ' + (current ? current.label : ''),
              'aria-haspopup': 'true',
              'aria-expanded': open ? 'true' : 'false',
              'data-generate-mode-toggle': 'yes',
              onClick: (event) => {
                event.stopPropagation()
                setOpen((shown) => !shown)
              },
            },
            h('span', { 'data-generate-mode': current ? current.id : '' }, current ? current.label : ''),
            h(IconChevronDownOutline14, { size: 14 }),
          ),
        }),
      )
    }

    /**
     * THE ASPECT DOOR, AND THE SHAPE IT GIVES THE PREVIEW (founder, 2026-09-23: *"the
     * aspect controls the shape of preview card"*).
     *
     * Which door that is comes from the adapter, never from a guess about meaning: a
     * `preview.aspectDoor` naming a door wins, and failing that the door whose key or
     * API field name is `aspect_ratio` — which is what both kinds of workflow call it
     * (Krea's catalogue and a RunningHub app's exposed inputs).
     *
     * A value is read as a shape, not as a menu entry: `9:16`, `1:1 (Square)` and
     * `2.35:1` all carry the pair in their first characters, and the label a provider
     * hangs off it is ignored. A value that carries no pair leaves the canvas square,
     * which is the one shape that never misrepresents a workflow.
     */
    const SQUARE = { w: 1, h: 1, css: '1 / 1' }

    /** `9:16`, `1:1 (Square)`, `1024x1024` → the pair, or null when there is none. */
    function shapeFrom(value) {
      const match = /^\s*(\d+(?:\.\d+)?)\s*[:x/]\s*(\d+(?:\.\d+)?)/.exec(String(value === undefined || value === null ? '' : value))
      if (!match) return null
      const w = Number(match[1])
      const h = Number(match[2])
      if (!(w > 0) || !(h > 0)) return null
      return { w, h, css: match[1] + ' / ' + match[2] }
    }

    /** The aspect door's own key, or null when the adapter names none. */
    function aspectDoorKey(adapter) {
      if (!adapter || !adapter.doors) return null
      const declared = adapter.preview && adapter.preview.aspectDoor
      if (typeof declared === 'string' && adapter.doors[declared]) return declared
      for (const key of Object.keys(adapter.doors)) {
        const door = adapter.doors[key]
        if (door.type === 'image' || door.type === 'list') continue
        const tokens = [key, door.fieldName]
          .filter((value) => typeof value === 'string')
          .map((value) => value.replace(/[^a-z0-9]/gi, '').toLowerCase())
        if (tokens.includes('aspectratio')) return key
      }
      return null
    }

    /** The shape the preview takes right now, from the door's current value. */
    function previewShape(adapter, values) {
      const key = aspectDoorKey(adapter)
      if (key === null) return SQUARE
      const value = values ? values[key] : undefined
      return shapeFrom(value) || SQUARE
    }

    /**
     * A CARD, as a component rather than a style applied by hand.
     *
     * Every panel in a surface is this: the parameters and the preview today, whatever a
     * later surface needs tomorrow (founder, 2026-09-23: *"these are reusable components
     * so when you build UI from design.md it will be consistent"*). It carries the same
     * surface, radius, border and padding every time, and it takes the caller's layout on
     * top — the two cards differ in how wide they grow, not in what they look like.
     *
     * No visible title on either card (founder's call, 2026-09-23): the workflow's own
     * title and blurb head the parameters card as content, and the preview card is the
     * output. A card that needs a heading later can render one inside itself.
     */
    function Card({ children, style, ...attrs }) {
      return h('div', { style: { ...S.card, ...(style || {}) }, ...attrs }, children)
    }

    /**
     * One workflow's surface, inside the pane.
     *
     * §10's "doors as controls in `ui.order`, `primary` first": `label` is the
     * visible name, the app's own tooltip sits under the control, `advanced` doors
     * sit behind one disclosure, and NO node id and no field name is ever drawn —
     * those belong to the payload gate, as JSON to read.
     *
     * A LIST DOOR IS THE FIFTH CONTROL, and it is the only one that draws its own rows: a
     * Krea array field is an array of objects, so a row carries the object's own doors and
     * `advanced` decides whether the whole list sits behind the disclosure.
     */
    function WorkflowSurface({ t, provider, name, onBack, canUpload = false, runOption = null }) {
      const { phase, adapter } = useWorkflow(provider, name)
      const [values, setValues] = React.useState({})
      const [showAdvanced, setShowAdvanced] = React.useState(false)

      // Depends on the adapter arriving: the doors are what the starting values come from.
      React.useEffect(() => {
        if (phase !== 'ready' || !adapter) return
        const start = {}
        for (const key of Object.keys(adapter.doors)) start[key] = startFor(key, adapter.doors[key], adapter.defaults)
        setValues(start)
      }, [phase])

      /**
       * One top-level door's value, set. The control layer passes VALUES, not events: an
       * image door hands back a URL an upload answered, and the four native controls hand
       * back what a person typed, so the two cannot share an event-shaped callback.
       */
      const set = (key) => (next) => {
        setValues((current) => ({ ...current, [key]: next }))
      }

      // The way out wears a left chevron (founder, 2026-09-23: *"the All workflows button
      // should have back arrow"*), and the label follows it.
      const head = h(
        'div',
        { style: S.surfaceHead },
        h(
          'button',
          { type: 'button', style: { ...S.ghost, display: 'inline-flex', alignItems: 'center', gap: 4 }, 'data-generate-back': 'yes', onClick: onBack },
          h(IconChevronLeftOutline14, { size: 14 }),
          t('surface.back'),
        ),
      )

      // The run state is READ HERE, above the early return, because a hook may not be
      // called conditionally: the run outlives the loading phase, and a person who
      // started one keeps it while the surface re-renders around them.
      const run = useRun({ t, provider, adapter, values, runOption })

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
      // Whether the preview card has anything to draw yet. It is the card's own fact: an
      // empty one keeps a panel's height, so opening a surface and starting a run do not
      // change the shape of the pane around them.
      const hasOutput =
        run.phase === 'queued' || run.phase === 'running' || run.phase === 'failed' || (run.phase === 'done' && Array.isArray(run.urls) && run.urls.length > 0)
      // The canvas's shape, from the workflow's own aspect door (see `previewShape`): the
      // same door that decides what the provider is asked for decides what the person sees.
      const shape = previewShape(adapter, values)
      const hasResult = run.phase === 'done' && Array.isArray(run.urls) && run.urls.length > 0

      /** One row of a list door, at the values the row's own doors declare. */
      const addRow = (key, door) => () =>
        setValues((current) => {
          const rows = Array.isArray(current[key]) ? current[key].slice() : []
          if (typeof door.max === 'number' && rows.length >= door.max) return current
          rows.push(rowFor(door))
          return { ...current, [key]: rows }
        })

      const removeRow = (key, index) => () =>
        setValues((current) => {
          const rows = Array.isArray(current[key]) ? current[key].slice() : []
          rows.splice(index, 1)
          return { ...current, [key]: rows }
        })

      /** One field inside one row: a copy of `values`, one level down. */
      const setRowField = (key, index, fieldKey) => (next) =>
        setValues((current) => {
          const rows = Array.isArray(current[key]) ? current[key].slice() : []
          rows[index] = { ...(rows[index] || {}), [fieldKey]: next }
          return { ...current, [key]: rows }
        })

      /**
       * ONE FIELD'S CONTROL, wherever it is drawn: at the top of the form, or inside a row of
       * a list door.
       *
       * `doorKey` is always the API's own field name (`prompt`, `style_references[0].url`),
       * which is the name a value is carried under and the name the gate reports a failure
       * by — so the attribute a page is read through and the key the host builds the body
       * from are the same string.
       */
      const fieldControl = (id, doorKey, door, value, onValue, canUpload) => {
        const shared = { style: S.input, id, 'data-generate-door': doorKey, onChange: (event) => onValue(event.target.value) }
        if (door.type === 'select') {
          return h(
            'select',
            { ...shared, value },
            (door.options || []).map((option) => h('option', { key: option, value: option }, option)),
          )
        }
        if (door.type === 'number') {
          // A STEPPER, not a bare number input (founder, 2026-09-23). The value stays a
          // string on the way out, exactly as the text and select doors hand theirs over,
          // so the host's builder sees one value type from every control. The step is the
          // app's own when it declares one; the buttons stop at the app's own bounds
          // rather than letting a click post something the API would refuse.
          const step = typeof door.step === 'number' && door.step > 0 ? door.step : 1
          const current = Number(value)
          const atMin = typeof door.min === 'number' && Number.isFinite(current) && current <= door.min
          const atMax = typeof door.max === 'number' && Number.isFinite(current) && current >= door.max
          const nudge = (delta) => () => {
            const from = Number.isFinite(current) ? current : 0
            let next = from + delta * step
            if (typeof door.min === 'number') next = Math.max(door.min, next)
            if (typeof door.max === 'number') next = Math.min(door.max, next)
            // Floating steps accumulate error (0.1 three times is 0.30000000000000004),
            // so the sum is rounded to the step's own precision.
            const decimals = String(step).includes('.') ? String(step).split('.')[1].length : 0
            onValue(String(Number(next.toFixed(decimals))))
          }
          return h(
            'div',
            { style: S.stepper, 'data-generate-stepper': doorKey },
            h(
              'button',
              {
                type: 'button',
                style: S.stepperButton,
                disabled: atMin,
                title: t('surface.step.down'),
                'aria-label': t('surface.step.down'),
                'data-generate-step-down': doorKey,
                onClick: nudge(-1),
              },
              '\u2212',
            ),
            h('input', { ...shared, style: { ...S.input, ...S.stepperValue }, type: 'number', value, min: door.min, max: door.max, step }),
            h(
              'button',
              {
                type: 'button',
                style: { ...S.stepperButton, ...S.stepperButtonUp },
                disabled: atMax,
                title: t('surface.step.up'),
                'aria-label': t('surface.step.up'),
                'data-generate-step-up': doorKey,
                onClick: nudge(1),
              },
              h(IconPlusOutline16, { size: 14 }),
            ),
          )
        }
        if (door.type === 'image') {
          return h(ImageField, { id, doorKey, value, onChange: onValue, t, provider, canUpload })
        }
        return door.multiline === true
          ? h('textarea', { ...shared, style: { ...S.input, ...S.multiline }, rows: 4, value })
          : h('input', { ...shared, type: 'text', value })
      }

      /**
       * A LIST DOOR: the add control, one row per item, and a remove on each row.
       *
       * This is the fifth control, and it exists because three of Krea's own fields are
       * arrays of objects — a style is an id and a strength, a style reference is an image
       * and a strength (founder, 2026-09-23: *"we are missing a lot of fields for upload
       * image for style ref, etc.."*). A row is the only shape that can carry them: a single
       * text box would post a bare string where the API requires an object.
       *
       * `max` is the API's own `maxItems` when it declares one, so the add control is gone at
       * the limit rather than offering a row the API would refuse.
       */
      const listControl = (key, door) => {
        const rows = Array.isArray(values[key]) ? values[key] : []
        const atMax = typeof door.max === 'number' && rows.length >= door.max
        return h(
          'div',
          { style: S.list, 'data-generate-list': key },
          rows.map((row, index) =>
            h(
              'div',
              { key: index, style: S.listRow, 'data-generate-list-row': key + '[' + index + ']' },
              ...Object.entries(door.fields || {}).map(([fieldKey, field]) => {
                const path = key + '[' + index + '].' + fieldKey
                const id = 'generate-door-' + key + '-' + index + '-' + fieldKey
                return h(
                  'div',
                  { key: fieldKey, style: S.listField },
                  h('label', { style: S.label, htmlFor: id }, field.label),
                  fieldControl(id, path, field, row[fieldKey], setRowField(key, index, fieldKey), canUpload),
                )
              }),
              h(
                'button',
                {
                  type: 'button',
                  style: S.ghost,
                  'data-generate-list-remove': key + '[' + index + ']',
                  onClick: removeRow(key, index),
                },
                t('surface.list.remove'),
              ),
            ),
          ),
          atMax
            ? null
            : h(
                'button',
                { type: 'button', style: S.imageBox, 'data-generate-list-add': key, onClick: addRow(key, door) },
                h(IconSparkle16, { size: 12 }),
                h('span', null, door.addLabel || t('surface.list.add')),
              ),
        )
      }

      const control = (key) => {
        const door = adapter.doors[key]
        if (door.type === 'list') return listControl(key, door)
        const value = values[key] === undefined ? startFor(key, door, adapter.defaults) : values[key]
        return fieldControl('generate-door-' + key, key, door, value, set(key), canUpload)
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
        h(
          'div',
          { style: S.surfaceColumns, 'data-generate-columns': 'two' },
          // CARD 1 — the parameters. The workflow's own title and blurb head it as
          // content (the cards carry no headings of their own), then the doors, then the
          // control that spends, so the button sits at the foot of the form it applies to.
          h(
            Card,
            { style: S.surfaceParams, 'data-generate-column': 'params', 'data-generate-card': 'params' },
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
            adapter.runnable === true ? h(RunControl, { key: adapter.name, t, adapter, run }) : null,
          ),
          // CARD 2 — the preview. It is drawn for every ready surface, runnable or not
          // (founder, 2026-09-23: *"2 cards, parameters card and preview card"*): a
          // workflow whose run is not built yet says so here rather than leaving the panes
          // lopsided, and the pane never reflows as a run starts. Its canvas takes the
          // shape the workflow's own aspect door asks for (founder, 2026-09-23: *"the
          // aspect controls the shape of preview card"*).
          h(
            Card,
            {
              style: S.surfaceOutput,
              'data-generate-card': 'preview',
              'data-generate-run-output': adapter.name,
              ...(hasOutput ? {} : { 'data-generate-output-empty': 'yes' }),
            },
            h(
              'div',
              {
                style: { ...S.previewFrame, aspectRatio: shape.css },
                'data-generate-preview-frame': adapter.name,
                'data-generate-preview-shape': shape.w + ':' + shape.h,
                ...(adapter.runnable === true && hasResult ? { 'data-generate-result': run.urls[0] } : {}),
              },
              adapter.runnable === true && hasResult
                ? h('img', { style: S.previewImage, src: run.urls[0], alt: t('run.result.alt') })
                : null,
            ),
            adapter.runnable === true
              ? h(RunOutput, { key: adapter.name + '-out', t, adapter, run })
              : h(Note, { text: t('surface.pending'), attrs: { 'data-generate-run-pending': 'yes' } }),
          ),
        ),
      )
    }

    /**
     * The run: the gate, the wait, and the result (S5).
     *
     * THE GATE IS THE FIRST THING THE CONTROL DRAWS (§12 rule 1). The Run control does
     * not submit: it asks the host for the exact body a run would post and shows it, and
     * only a second, explicit press sends it. Cancel returns to the form with every value
     * intact, which is why the form's state lives in the surface above and this half only
     * reads it.
     *
     * THE KEY IS NOT HERE. Every call below is to this plugin's own host route; the host
     * reads the key from the credential store, builds the body, posts it, and answers with
     * a job id. That is also what makes the preview trustworthy: the dialog and the request
     * are the same function's output, not two implementations that agree today.
     *
     * ONE RUN AT A TIME, and the state owns it. A run in flight keeps its job id and its
     * start time, so the phase, the elapsed seconds and the failure all belong to the same
     * attempt. Krea's own message is shown verbatim on a failure, because a sentence this
     * plugin invented about someone else's error helps nobody.
     *
     * THE STATE IS A HOOK AND THE VIEW IS TWO PIECES (founder, 2026-09-23: *"2 column
     * parameters + output preview"*): the control that spends sits at the foot of the
     * parameters column, and the strip and the result sit in the output column beside it.
     * Splitting the state from both views is what lets one run be drawn in two places.
     */
    function useRun({ t, provider, adapter, values, runOption = null }) {
      const [run, setRun] = React.useState({ phase: 'form' })
      const [requestShown, setRequestShown] = React.useState(false)
      /**
       * THE RUN'S OWN MODE, when the provider declares one (RunningHub's `instanceType`).
       *
       * It lives with the run rather than with the doors because it is not a door: it is the
       * same choice for every app, it goes to the request's top level, and the gate has to
       * show it like anything else that changes what a run costs. `null` means "whatever the
       * provider's own fallback is", so a surface that was never touched sends a complete
       * request.
       */
      const declared = runOption && Array.isArray(runOption.modes) && runOption.modes.length > 0 ? runOption : null
      const [mode, setMode] = React.useState(null)
      const modeId = declared ? mode || declared.fallback : null
      const options = declared ? { [declared.key]: modeId } : null

      /** The label a door is drawn under, so the gate names what the form named. */
      const labelOf = (key) => {
        const door = adapter ? adapter.doors[key] : null
        return door && typeof door.label === 'string' ? door.label : key
      }

      const openGate = async () => {
        setRequestShown(false)
        setRun({ phase: 'gate', preview: null })
        const preview = await fetchPayload(provider, adapter.name, values, options)
        setRun((current) => {
          if (current.phase !== 'gate') return current
          return preview.ok ? { phase: 'gate', preview: preview.preview } : { phase: 'gate', preview: null, error: preview.error }
        })
      }

      const confirm = async () => {
        setRun((current) => ({ ...current, phase: 'starting' }))
        const started = await postRun(provider, adapter.name, values, options)
        if (!started.ok) {
          setRun({ phase: 'failed', error: started.error, detail: started.detail, startedAt: Date.now(), finishedAt: Date.now() })
          return
        }
        setRun({ phase: 'queued', jobId: started.jobId, startedAt: Date.now() })
      }

      // THE POLL. The host holds the key, so the host asks Krea; this half asks the host
      // once every two seconds until the job settles, and stops the moment it does.
      React.useEffect(() => {
        // Keyed by the JOB, not by the phase: a phase change must not restart the loop,
        // or every "queued → running" would fire another poll on the spot.
        const jobId = run.jobId
        if (typeof jobId !== 'string' || jobId === '') return undefined
        let live = true
        let settled = false
        const tick = async () => {
          if (settled) return
          const read = await readRun(provider, jobId)
          if (!live) return
          if (!read.ok) {
            settled = true
            setRun((current) => (current.jobId === jobId ? { ...current, phase: 'failed', finishedAt: Date.now(), error: read.error } : current))
            return
          }
          if (read.state === 'done') {
            settled = true
            setRun((current) =>
              current.jobId === jobId ? { ...current, phase: 'done', finishedAt: Date.now(), urls: read.urls, saved: read.saved } : current,
            )
            return
          }
          if (read.state === 'failed') {
            settled = true
            setRun((current) =>
              current.jobId === jobId
                ? {
                    ...current,
                    phase: 'failed',
                    finishedAt: Date.now(),
                    status: read.status,
                    message: read.error && read.error.message ? String(read.error.message) : null,
                  }
                : current,
            )
            return
          }
          setRun((current) => (current.jobId === jobId ? { ...current, phase: read.state } : current))
        }
        // Once now, then every two seconds: a strip that waited two seconds to say
        // anything would look like a control that did not respond.
        tick()
        const timer = setInterval(tick, 2000)
        return () => {
          live = false
          clearInterval(timer)
        }
      }, [run.jobId])

      const phase = run.phase
      const preview = run.preview || null
      const elapsed = run.startedAt ? Math.max(0, Math.round(((run.finishedAt || Date.now()) - run.startedAt) / 1000)) : 0
      return {
        ...run,
        phase,
        preview,
        elapsed,
        requestShown,
        setRequestShown,
        labelOf,
        openGate,
        confirm,
        // The provider's run option, and the mode chosen in it. A provider that declares
        // none gives `runOption: null` and the surface draws a plain run button.
        runOption: declared,
        mode: modeId,
        setMode,
        // Cancel and "run again" are the same move: back to the form, values intact.
        back: () => setRun({ phase: 'form' }),
        gateOpen: phase === 'gate' || phase === 'starting',
        blocked: preview === null || preview.missing.length > 0 || preview.refused.length > 0,
      }
    }

    /** The foot of the parameters column: the control that spends, and its gate. */
    function RunControl({ t, adapter, run }) {
      if (!adapter) return null
      const row = (key, value) =>
        h(
          'div',
          { key, style: S.gateRow, 'data-generate-gate-row': key },
          h('span', { style: S.gateKey }, key),
          h('span', { style: S.gateValue }, value),
        )
      const runLabel = adapter.runLabel || t('run.action')
      /**
       * The run's own options, as rows for the gate: named by the provider's label for the
       * choice and read from the HOST's echo of the validated option, so the gate shows what
       * would actually be sent rather than what the browser remembers choosing.
       */
      const optionRows = (state) => {
        const declared = state.runOption
        const chosen = state.preview && state.preview.options
        if (!declared || !chosen) return []
        return Object.entries(chosen).map(([key, value]) => {
          const mode = (declared.modes || []).find((entry) => entry.id === value)
          return row(declared.label || key, mode ? mode.label : String(value))
        })
      }
      return h(
        'div',
        { style: S.runBlock, 'data-generate-run-block': adapter.name },
        // A provider that declares run modes gets the split control — the action, and the
        // mode it will run in; one that declares none gets the plain button it always had.
        run.runOption
          ? h(SplitButton, {
              t,
              label: runLabel,
              modes: run.runOption.modes,
              value: run.mode,
              onValue: run.setMode,
              disabled: run.gateOpen,
              onClick: run.openGate,
              attrs: { 'data-generate-run': adapter.name, 'data-generate-run-mode': run.runOption.key },
            })
          : h(
              'button',
              {
                type: 'button',
                style: { ...S.primary, alignSelf: 'flex-start' },
                'data-generate-run': adapter.name,
                disabled: run.gateOpen,
                onClick: run.openGate,
              },
              runLabel,
            ),
        run.gateOpen
          ? h(
              Modal,
              {
                open: true,
                onClose: run.phase === 'starting' ? () => {} : run.back,
                title: t('run.gate.title'),
                closeLabel: t('saved.close'),
                description: t('run.gate.body'),
                footer: h(
                  'div',
                  { style: S.row },
                  h('button', { type: 'button', style: S.ghost, disabled: run.phase === 'starting', 'data-generate-gate-cancel': 'yes', onClick: run.back }, t('run.gate.cancel')),
                  h(
                    'button',
                    {
                      type: 'button',
                      style: S.primary,
                      disabled: run.phase === 'starting' || run.blocked,
                      'data-generate-gate-confirm': 'yes',
                      onClick: run.confirm,
                    },
                    run.phase === 'starting' ? t('run.gate.starting') : t('run.gate.confirm'),
                  ),
                ),
              },
              run.preview === null
                ? h('div', { style: S.hint, 'data-generate-gate': 'loading' }, run.phase === 'gate' && run.error ? errorText(t, run.error) : t('surface.loading'))
                : h(
                    'div',
                    { style: S.gateRows, 'data-generate-gate': adapter.name },
                    row(t('run.gate.model'), adapter.title),
                    row(t('run.gate.to'), run.preview.endpoint),
                    ...optionRows(run),
                    // The host's own rows when it sent them: it knows the labels, and a
                    // provider whose body is a node list cannot be read by key in here.
                    ...(Array.isArray(run.preview.rows)
                      ? run.preview.rows.map((entry, index) => row(entry.label + '\u0000' + index, entry.value))
                      : Object.entries(run.preview.body).map(([key, value]) => row(run.labelOf(key), String(value)))),
                    run.preview.missing.length > 0
                      ? h(
                          'div',
                          { style: S.fieldError, role: 'alert', 'data-generate-gate-missing': run.preview.missing.join(',') },
                          t('run.gate.missing') + ' ' + run.preview.missing.map(run.labelOf).join(', '),
                        )
                      : null,
                    run.preview.refused.length > 0
                      ? h(
                          'div',
                          { style: S.fieldError, role: 'alert', 'data-generate-gate-refused': run.preview.refused.map((entry) => entry.key).join(',') },
                          t('run.gate.refused') + ' ' + run.preview.refused.map((entry) => run.labelOf(entry.key) + ' (' + entry.reason + ')').join(', '),
                        )
                      : null,
                    h(
                      'button',
                      {
                        type: 'button',
                        style: { ...S.ghost, alignSelf: 'flex-start' },
                        'data-generate-gate-request': run.requestShown ? 'open' : 'closed',
                        onClick: () => run.setRequestShown((shown) => !shown),
                      },
                      run.requestShown ? t('run.gate.hide') : t('run.gate.request'),
                    ),
                    // THE RESOLVED REQUEST, as JSON to read and never to edit (§10): the
                    // gate's job is to show a person what leaves the machine.
                    run.requestShown
                      ? h(
                          'div',
                          { style: S.promptBlock, 'data-generate-gate-code': adapter.name },
                          h(CodeBlock, {
                            code: JSON.stringify(run.preview.body, null, 2),
                            copyLabel: t('settings.workflows.copy'),
                            copiedLabel: t('settings.workflows.copied'),
                          }),
                        )
                      : null,
                  ),
            )
          : null,
      )
    }

    /** The preview card's content: the phase, the failure, and the result. */
    function RunOutput({ t, adapter, run }) {
      if (!adapter) return null
      return h(
        'div',
        { style: S.runOutput },
        run.phase === 'queued' || run.phase === 'running'
          ? h(
              'div',
              { style: S.runStrip, 'data-generate-run-strip': run.phase },
              h('span', { style: S.runPhase }, t('run.phase.' + run.phase)),
              h('span', { style: S.runMeta, 'data-generate-run-elapsed': String(run.elapsed) }, run.elapsed + 's'),
              run.jobId ? h('span', { style: S.runMeta, 'data-generate-run-job': run.jobId }, t('run.job') + ' ' + run.jobId) : null,
            )
          : null,
        run.phase === 'failed'
          ? h(
              'div',
              { style: { ...S.runStrip, ...S.runFailed }, role: 'alert', 'data-generate-run-failed': run.error || 'run-failed' },
              h(
                'span',
                { style: S.gateValue },
                run.message ? run.message : run.error ? errorText(t, run.error) : t('run.failed'),
              ),
              run.jobId ? h('span', { style: S.runMeta, 'data-generate-run-job': run.jobId }, t('run.job') + ' ' + run.jobId) : null,
              h('button', { type: 'button', style: S.ghost, 'data-generate-run-again': 'yes', onClick: run.back }, t('run.again')),
            )
          : null,
        // WHERE IT LANDED. The host downloads the bytes on the terminal read (a provider's
        // link is not a result — it expires), so the pane says the path it answered with.
        run.phase === 'done' && Array.isArray(run.saved) && run.saved.length > 0
          ? h(
              'div',
              { style: S.savedLine, 'data-generate-saved': run.saved[0].file },
              h('span', { style: S.savedLabel }, t('run.saved')),
              h('span', { style: S.savedPath }, run.saved[0].file),
            )
          : null,
        run.phase === 'done' && Array.isArray(run.urls) && run.urls.length > 0
          ? h(
              'div',
              { style: S.row },
              h(
                'a',
                { style: S.runLink, href: run.urls[0], target: '_blank', rel: 'noreferrer', 'data-generate-result-url': run.urls[0] },
                t('run.result.open'),
                h(IconRightUpOutline16, { size: 12 }),
              ),
              h('button', { type: 'button', style: S.ghost, 'data-generate-run-again': 'yes', onClick: run.back }, t('run.again')),
            )
          : null,
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
    /**
     * The install prompt a section's `+` reveals: the sentence the agent's skill answers
     * to, in the harness's own code block, with the primitive's Copy control.
     *
     * A plugin cannot put text into the conversation composer and a slash command cannot
     * start a turn (measured 2026-09-22), so the pane cannot hand the job to chat itself.
     * What it can do is hand over the sentence: one click on the header's glyph reveals
     * the provider's own install prompt — the phrase the agent's skill answers to — with
     * Copy beside it (founder, 2026-09-23: *"click on + workflow is a code snippet
     * primitive"*).
     *
     * The snippet is the CODE BLOCK and not a `<code>` on a styled row, so the prompt
     * arrives in the same shape as every other code answer in this UI. The primitive's
     * own header is off: the Copy control below is the owner's, which is the case its
     * `showHeader` documents.
     */
    function AddPromptPanel({ t, provider }) {
      return h(
        'div',
        { style: S.addPrompt, 'data-generate-add-open': provider.id },
        h('div', { style: S.hint, 'data-generate-add-hint': 'yes' }, t('settings.workflows.add')),
        // The snippet is the primitive WHOLE, its header included: that bar — the
        // language slot on the left, Copy on the right — is what every code snippet in
        // this UI wears, and the primitive owns the click that copies (founder,
        // 2026-09-23: *"code snippet primitive in dsh looks like this"*). No `lang`: the
        // prompt is a sentence for the composer, not a language, so the header carries
        // the Copy control and invents no label. The primitive drops unknown props, so
        // the wrapper carries this pane's own attribute.
        h(
          'div',
          { style: S.promptBlock, 'data-generate-add-prompt': provider.id },
          h(CodeBlock, {
            code: provider.addPrompt,
            copyLabel: t('settings.workflows.copy'),
            copiedLabel: t('settings.workflows.copied'),
          }),
        ),
      )
    }

    /**
     * One provider's section of the pane's accordion: a header that names the provider
     * and says what the section holds, and a body holding its cards.
     *
     * ONE SECTION PER PROVIDER, ALL OF THEM (founder, 2026-09-23). A provider with
     * nothing installed is still a section, because a section's header is where its add
     * control lives: an install that showed only the providers that already work could
     * never be filled. A provider whose list could not be read says so instead of
     * showing the empty state, because "nothing installed" and "nothing answered" are
     * different facts.
     */
    function ProviderSection({ t, provider, units, failed, open, onToggle, onOpen, onRefresh }) {
      // Whether this section's install prompt is revealed. It lives here rather than in
      // the panel below, because the control that toggles it is in the SUBHEADER now
      // (founder, 2026-09-23: *"move + workflow button as an icon button next to
      // refresh"*, then the header decluttering that created the band) and the thing
      // it reveals is still the body's.
      const [addShown, setAddShown] = React.useState(false)
      // "Workflows · 2 installed", not "Workflows · 2 workflows installed": the line
      // says the family itself, so the count is only the number after it. The family
      // word is the same on every section (founder, 2026-09-23) — see
      // `pane.section.family`.
      const meta =
        t('pane.section.family') +
        ' · ' +
        (units.length === 0 ? t('pane.section.none') : units.length + ' ' + t('pane.section.count'))
      // The header's light (founder, 2026-09-23): green when the section is ready to
      // run, amber when a key is there and the section still is not ready — nothing
      // installed yet, or a key the provider never confirmed — and red when there is no
      // usable key. Three colours, four sentences: the colour is the state, the sentence
      // is its tooltip, and an unconfirmed key is not the same fact as an empty section.
      const look = providerState(provider).state
      const light = look === 'none' || look === 'refused' ? 'noKey' : look === 'ok' ? (units.length > 0 ? 'ready' : 'keyOnly') : 'unchecked'
      const lightStyle = { ready: S.dotOk, keyOnly: S.dotWarn, unchecked: S.dotWarn, noKey: S.dotBad }[light]
      const lightText = {
        ready: t('pane.light.ready'),
        keyOnly: t('pane.light.keyOnly'),
        // The settings row's own words for the same fact: a third sentence for
        // "amber because nothing is installed" would be a lie on a section that has
        // workflows and an unconfirmed key.
        unchecked: t('settings.linked.unverified'),
        noKey: t('pane.light.noKey'),
      }[light]
      // The wallet, read once: the balance where the provider has a balance route, and
      // the sentence the read produced where it has none.
      const parts = balanceParts(t, provider)
      return h(
        'div',
        { style: S.section, 'data-generate-section-wrap': provider.id },
        // The header is the section's toggle and it also holds the way out to the
        // provider's own page. A <button> may not contain a link, so the row carries the
        // button's ROLE rather than its tag: one toggle, with the account anchor inside.
        // It holds ONLY that now: the balance, the count line and the add/refresh
        // glyphs live in the subheader band below (founder, 2026-09-23: *"the
        // accordion header for generate is too cluttered"*).
        h(
          'div',
          {
            role: 'button',
            tabIndex: 0,
            style: S.sectionHead,
            'data-generate-section': provider.id,
            'data-generate-section-toggle': provider.id,
            'aria-expanded': open ? 'true' : 'false',
            onClick: onToggle,
            onKeyDown: (event) => {
              if (event.key !== 'Enter' && event.key !== ' ') return
              event.preventDefault()
              onToggle()
            },
          },
          // The header's marker: the status light, where it used to draw the kind.
          h(
            'span',
            { style: S.sectionLight },
            h('span', {
              style: { ...S.dot, ...lightStyle },
              title: lightText,
              'data-generate-section-state': light,
              'aria-hidden': true,
            }),
          ),
          h(
            'span',
            { style: S.sectionText },
            h(
              'span',
              { style: S.sectionTitleRow },
              h('span', { style: S.sectionTitle }, provider.label),
              // The way out to the provider's own page: the glyph beside the name it
              // belongs to, instead of a word lower down (founder, 2026-09-23). The row
              // is the toggle, so this click must not fold the section.
              provider.accountUrl
                ? h(
                    'a',
                    {
                      href: provider.accountUrl,
                      target: '_blank',
                      rel: 'noreferrer',
                      style: S.sectionAccountIcon,
                      title: t('settings.account'),
                      'aria-label': t('settings.account'),
                      'data-generate-account': provider.id,
                      onClick: (event) => event.stopPropagation(),
                    },
                    h(IconRightUpOutline16, { size: 12 }),
                  )
                : null,
            ),
          ),
          h('span', { style: S.sectionChevron }, h(open ? IconChevronDownOutline14 : IconChevronRightOutline14, { size: 14 })),
        ),
        // THE SUBHEADER (founder, 2026-09-23: *"the accordion header for generate is
        // too cluttered. remove the wallet balance, workflows counter, add/refresh
        // icons. make a subheader with separator top/bottom and move these elements
        // into it"*): a band under the header, hairline above and below, holding what
        // used to crowd the toggle row — the balance, then the count line, then the
        // add and refresh glyphs. It draws open or shut: the balance and the count are
        // what a person scans collapsed sections for, and add and refresh are how a
        // collapsed one is acted on. The header above stays the ONLY toggle, so
        // nothing in this band folds the section by being clicked, and clicks here do
        // not bubble into it — the band is the header's sibling, not its child.
        h(
          'div',
          { style: S.sectionSub, 'data-generate-section-sub': provider.id },
          h(
            'span',
            { style: S.sectionBalance, 'data-generate-provider-strip': provider.id },
            // A provider with no balance endpoint says `Key saved` rather than
            // claiming an empty wallet: Krea and Comfy Cloud have no balance route.
            h(
              'span',
              { style: S.balanceValue },
              parts.length ? parts.join(' · ') : provider.linked ? t('settings.linked') : t('wallet.notLinked'),
            ),
            h(
              'span',
              {
                style: S.balanceNote,
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
          ),
          // The count line, immediately left of the add glyph (founder, 2026-09-23:
          // *"Move Workflows 3 installed to left of + icon"*) — the two moved together.
          h('span', { style: S.sectionMeta, 'data-generate-section-meta': provider.id }, meta),
          // The section's own controls: add a workflow, then re-read the section. Both
          // are glyphs, so both carry a hover tooltip (the harness's own bubble, not a
          // native `title`) and an `aria-label` — the bubble is the sighted answer, the
          // label is the one a screen reader reads (founder, 2026-09-23: *"add tooltip
          // on hover for both"*).
          h(
            'span',
            { style: S.sectionActions },
            // A provider whose list could not be read offers no add control: "nothing is
            // installed" is not known when nothing answered, so neither is what to add.
            failed
              ? null
              : h(
                  Tooltip,
                  { label: t('pane.add.button'), side: 'bottom', delayMs: 500 },
                  h(
                    'span',
                    { style: S.tipAnchor, 'data-generate-add-tip': provider.id },
                    h(Button, {
                      variant: 'ghost',
                      size: 'sm',
                      icon: h(IconPlusOutline16, { size: 14 }),
                      'aria-label': t('pane.add.button'),
                      'aria-expanded': addShown ? 'true' : 'false',
                      'data-generate-add-button': provider.id,
                      style: { flex: 'none' },
                      onClick: (event) => {
                        // The prompt it reveals lives in the body, so a closed section
                        // opens first: a click that changed nothing visible would read
                        // as a control that does not work.
                        if (!open) onToggle()
                        setAddShown(!addShown)
                      },
                    }),
                  ),
                ),
            h(
              Tooltip,
              { label: t('wallet.refresh'), side: 'bottom', delayMs: 500 },
              h(
                'span',
                { style: S.tipAnchor, 'data-generate-refresh-tip': provider.id },
                h(Button, {
                  variant: 'ghost',
                  size: 'sm',
                  icon: h(IconRefreshOutline16, { size: 14 }),
                  'aria-label': t('wallet.refresh'),
                  'data-generate-refresh': provider.id,
                  style: { flex: 'none' },
                  onClick: () => onRefresh(),
                }),
              ),
            ),
          ),
        ),
        open
          ? h(
              'div',
              { style: S.sectionBody, 'data-generate-section-body': provider.id },
              failed
                ? h('div', { style: S.hint, 'data-generate-provider-failed': provider.id }, t('pane.list.failed'))
                : h(
                    'div',
                    {
                      style: S.sectionCards,
                      'data-generate-cards': String(units.length),
                      // The empty state is this container. Its one child is the sentence
                      // that says so and names the header glyph that fixes it, because
                      // the add control is no longer here to explain itself.
                      ...(units.length === 0 ? { 'data-generate-none': provider.id } : {}),
                    },
                    units.map((unit) => h(UnitCard, { key: unit.name, t, unit, onOpen })),
                    units.length === 0 && !addShown
                      ? h('div', { style: S.hint, 'data-generate-section-empty': provider.id }, t('pane.section.empty'))
                      : null,
                    // The revealed prompt rides at the foot of the section, not only on
                    // an empty one: a provider with three workflows still needs a way to
                    // gain a fourth, and this is the only place in the pane that says how.
                    addShown ? h(AddPromptPanel, { t, provider }) : null,
                  ),
            )
          : null,
      )
    }

    function GeneratePane(props) {
      const t = translatorOf(props)
      const providers = useProviders()
      const units = useWorkflows(providers.providers)
      // `null` means the user has not chosen; `{ provider, name }` opens that
      // workflow's surface; `''` is the way back to the cards.
      const [chosen, setChosen] = React.useState(null)
      // Which accordion section is open, in the same three states: `null` is "not
      // chosen yet" (the default below applies), `''` is "closed on purpose", and an id
      // is that provider's section.
      const [openId, setOpenId] = React.useState(null)

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

      // A provider the owner hid is not drawn HERE (founder, 2026-09-23: *"hide providers
      // that I don't use much for less visual clutter"*). Hiding is a display preference
      // and not a link: the key stays in credentials, the adapters stay on disk, and the
      // switch that brings it back is on the row in Settings → Generate.
      const shown = providers.providers.filter((provider) => provider.hidden !== true)

      // Every one of them hidden: an empty pane would read as "my workflows are gone",
      // so it says what happened and where the switches are. The settings page lists all
      // four whatever this file says, which is what keeps the state reversible.
      if (shown.length === 0) {
        return h(
          'div',
          { style: S.root, 'data-generate-pane': 'hidden' },
          h(
            'div',
            { style: S.empty, 'data-generate-all-hidden': 'yes' },
            h(GenerateMark, null),
            h('div', { style: S.title }, t('pane.hidden.title')),
            h('div', { style: S.body }, t('pane.hidden.body')),
          ),
        )
      }

      const linked = shown.filter((provider) => provider.linked)
      // The first-run form belongs to a WORKFLOW provider: the pane is where workflows
      // run, RunningHub and Comfy Cloud are the two that have them, and with four
      // providers registered "the first one" would otherwise be an image provider the
      // pane has nothing to run. When every workflow provider is already linked it falls
      // back to the first unlinked provider, then to the first in the registry.
      const first =
        shown.find((provider) => provider.kind === 'workflow' && !provider.linked) ||
        shown.find((provider) => !provider.linked) ||
        shown[0] ||
        null
      // The accordion's own bookkeeping: which units belong to which provider, and
      // which section is open before anyone has clicked. The default is the first
      // provider that actually has workflows — landing on four closed rows would hide
      // the thing the pane exists for — and failing that, the first provider.
      const unitsOf = (id) => units.units.filter((unit) => unit.provider === id)
      const openDefault = (shown.find((provider) => unitsOf(provider.id).length > 0) || shown[0] || {}).id || null
      const open = openId === null ? openDefault : openId

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
        // answered, and where the balance went; the section header's own row is the
        // thing the dialog is pointing at.
        saved && active === null ? h(SaveDialog, { t, provider: saved, onClose: providers.forget }) : null,
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
        // THE HOME SCREEN IS A STACKED ACCORDION, ONE SECTION PER PROVIDER (founder,
        // 2026-09-23). All of them, linked or not, in the registry's own order: a
        // provider with nothing installed is where its add card lives. One section is
        // open at a time — opening a second closes the first, which is what keeps a
        // four-provider pane short enough to read.
        active === null
          ? h(
              'div',
              { style: S.sections, 'data-generate-sections': String(shown.length) },
              // A host that cannot answer says so, and the sections under the sentence
              // still carry each provider's light and its balance: a failed workflow read
              // is not a reason to hide what the wallet says.
              units.phase === 'failed'
                ? h(
                    'div',
                    { style: S.empty, 'data-generate-list-failed': 'yes' },
                    h(GenerateMark, null),
                    h('div', { style: S.title }, t('pane.list.failed')),
                  )
                : null,
              shown.map((provider) =>
                h(ProviderSection, {
                  key: provider.id,
                  t,
                  provider,
                  units: unitsOf(provider.id),
                  // A read that failed for everyone fills no section with an empty state
                  // and offers no add card, because neither fact is known.
                  failed: units.phase === 'failed' || units.failed.indexOf(provider.id) !== -1,
                  open: open === provider.id,
                  onToggle: () => setOpenId(open === provider.id ? '' : provider.id),
                  onOpen: (id, name) => setChosen({ provider: id, name }),
                  // Both reads again, from the section's own header: the wallet statuses
                  // and the installed lists.
                  onRefresh: () => {
                    providers.load()
                    units.reload()
                  },
                }),
              ),
            )
          : h(WorkflowSurface, {
              key: active.provider + '/' + active.name,
              t,
              provider: active.provider,
              name: active.name,
              // Whether this provider can turn a picked file into a URL. The pane knows the
              // rows it drew, so it says; the surface does not guess from the id.
              canUpload: !!((providers.providers || []).find((row) => row.id === active.provider) || {}).upload,
              // The provider's own run modes (RunningHub's `instanceType`), on the same
              // rule: the pane read the row, so the run control draws a split button from
              // what that row declared rather than from the provider's id.
              runOption: ((providers.providers || []).find((row) => row.id === active.provider) || {}).runOption || null,
              onBack: () => setChosen(''),
            }),
        active === null
          ? h(
              'div',
              { style: S.sectionNotes },
              // The directions sit under the screen they explain, not at the top of
              // the pane: this is the surface a person returns to when they rotate
              // the key. How to ADD a workflow is no longer a sentence here — it lives
              // on the add button in each section, which is also the control that
              // hands over the prompt.
              h(Note, {
                text: t('pane.linked.manage'),
                attrs: { 'data-generate-manage-hint': 'yes' },
              }),
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

    /** One provider's row: its dot, its name, its family, its state, what it costs and
     * its card. */
    function ProviderRow({ t, provider, open, busy, onToggle, onSave, onRemove, onEdit, onHide }) {
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
            // The row says it is hidden, because the switch alone would leave a person
            // wondering where the section went.
            provider.hidden === true
              ? h('span', { style: S.rowTagHidden, 'data-generate-provider-hidden-tag': provider.id }, t('settings.hide.tag'))
              : null,
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
            // The switch sits at the far right of the row (founder, 2026-09-23: *"swap
            // position of the toggle switch / button. toggle is right justify"*), so the
            // row reads left to right as identity, action, then the display preference.
            // Its wrapper carries the tag, because the primitive takes no stray props.
            h(
              'span',
              { style: S.hideSwitch, 'data-generate-provider-hide': provider.id },
              h(Switch, {
                checked: provider.hidden !== true,
                label: t('settings.hide.label'),
                title: t('settings.hide.hint'),
                onChange: (shown) => onHide(!shown),
              }),
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
        // What it costs to run this provider, on the row rather than behind the card:
        // the founder's ask (2026-09-23) is to see the plan a provider needs before a
        // run is refused for it. `url` is the page that sells it.
        provider.funding
          ? h(
              'div',
              { style: S.rowFunding, 'data-generate-provider-funding': provider.id },
              h('span', null, t('funding.' + provider.funding.kind)),
              provider.funding.url
                ? h(
                    'a',
                    {
                      href: provider.funding.url,
                      target: '_blank',
                      rel: 'noreferrer',
                      style: S.fundingLink,
                      'data-generate-provider-funding-link': provider.id,
                    },
                    t('funding.' + provider.funding.kind + '.link'),
                    h(IconRightUpOutline16, { size: 11 }),
                  )
                : null,
            )
          : null,
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
      const { phase, providers, busy, save, unlink, setHidden, confirmed, forget } = useProviders()
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
              onHide: (hidden) => setHidden(provider.id, hidden),
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
