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
// ONE CLICK SPENDS (founder, 2026-09-23: *"we don't need the confirmation modal, click
// the button can just run the job"*): the surface renders the doors as controls, in
// `ui.order`, with the app's own bounds and defaults, and the run control posts the run
// the moment it is pressed. The strip beside the form reports the phase, and the result
// lands in the preview card — no dialog sits between the form and the provider.
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
    // The primitives module arrives through factory(require); `external` in
    // package.json is what lets a third-party bundle require it.
    //
    // ICON NAMES ARE NOT STABLE ACROSS HARNESS GENERATIONS. 0.1.6 shipped
    // `IconSparkle16` (glyph and size in one name); 0.1.7-rc.1 replaced the set with
    // `IconSparkleRegular`, with the size a prop instead. Destructuring only the
    // current name yields `undefined` on the other core, and React then throws #130
    // ("Element type is invalid") the moment a card or pane renders — which is
    // exactly what emptied the right panel's Start page. Each icon is resolved by
    // its current name with the legacy one as fallback, so one bundle serves either.
    const primitives = require('@deepseek-ai/dsh-client-ui-primitives')
    /** Resolve one icon by its current name, falling back to the pre-0.1.7 name. */
    const icon = (current, legacy) => primitives[current] ?? primitives[legacy]
    const {
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
      // The add control's popover is anchored and dismissed by the app's own machinery, not
      // by a second one written here: `useAnchoredPosition` is what the app's menus and job
      // lists place themselves with (it clamps to the viewport and follows a scroll), and
      // `useDismissOnOutsidePointer` is the outside-click rule every trigger-owned surface
      // in the app obeys.
      useAnchoredPosition,
      useDismissOnOutsidePointer,
    } = primitives

    /** The card's and the panel's own glyphs, resolved for both cores. */
    const IconSparkle16 = icon('IconSparkleRegular', 'IconSparkle16')
    const IconWarningOutline16 = icon('IconWarningOutlineRegular', 'IconWarningOutline16')
    const IconRightUpOutline16 = icon('IconRightUpOutlineRegular', 'IconRightUpOutline16')
    const IconRefreshOutline16 = icon('IconRefreshOutlineRegular', 'IconRefreshOutline16')
    // The run strip's spinner: the harness's own loading glyph — the one the
    // connection indicator spins (founder, 2026-09-23: *"add spinner to left of
    // Running … square shaped DSH spinner"*). Its class and keyframes are the one
    // sheet this bundle injects; see `apply`.
    const IconLoadingOutline16 = icon('IconLoadingOutlineRegular', 'IconLoadingOutline16')
    const IconCheckOutline16 = icon('IconCheckOutlineRegular', 'IconCheckOutline16')
    const IconInfoOutline14 = icon('IconInfoOutlineRegular', 'IconInfoOutline14')
    // The pane's own glyphs: a flow glyph on a workflow card, the plus on the block's add
    // control and on the header's add-tab button, and the DOWN chevron on the workflow
    // surface's advanced disclosure. The image provider's own glyph is gone with the header
    // icon it used to fill: the caption line draws the provider's status light instead
    // (founder, 2026-09-23).
    //
    // The two way-out chevrons are gone. The right one went with the accordion's fold
    // (founder, 2026-09-25), and the left one went when the pane grew a header: the surface
    // no longer carries its own ← All workflows button, because the header's first tab IS
    // that control (founder, the same day). The icon set carries no minus glyph, so the
    // number stepper's decrement draws U+2212 as text — see `S.stepperButton`.
    const IconChevronDownOutline14 = icon('IconChevronDownOutlineRegular', 'IconChevronDownOutline14')
    const IconBranchOutline16 = icon('IconBranchOutlineRegular', 'IconBranchOutline16')
    const IconPlusOutline16 = icon('IconPlusOutlineRegular', 'IconPlusOutline16')
    // THE IMAGE DOOR'S OWN GLYPHS: the link glyph on the URL button inside the drop area, and
    // the app's close glyph on the clear badge. Two glyphs, both the app's own set — the tiles
    // that used to sit under the area (Finder over Link) left with the founder's correction:
    // *"we don't need finder button since click on the drop area does same thing"*.
    const IconLinkOutline16 = icon('IconLinkOutlineRegular', 'IconLinkOutline16')
    const IconCloseOutline16 = icon('IconCloseOutlineRegular', 'IconCloseOutline16')

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
    /** Where finished runs land: the library root, read and changed in one place. */
    const LIBRARY_API = '/plugins/generate/library'

    const EN = {
      'type.label': 'Generate',
      'guide.title': 'Generate',
      'guide.description': 'Run your workflows here',
      // The pane is the HUB (founder, 2026-09-22): the start-page card is a plain
      // door, and every workflow surface lives inside this one pane. So the pane's
      // first screen is its card grid, and a card opens that workflow's surface.
      //
      // NO TAB STANDS FOR THAT SCREEN (founder, 2026-09-25: *"the dsh pattern does not have
      // all workflows, it uses add button to create new tab and uses start screen to add the
      // tab"*). The grid is the start screen, and the header's plus is how a person goes back
      // to it — so there is no "All workflows" tab, exactly as DSH has no "guide" tab beside
      // its plus.
      // Tab bar: each open workflow surface is a tab; these label the controls.
      'tabs.close': 'Close',
      // The header's add button: a bare plus, the DSH pattern, leading to that start screen.
      'tabs.add': 'Add a workflow tab',
      // The word on the button itself (founder, 2026-09-25: *"lets change + to +add to
      // keep disinction"*). The DSH strip's own add is a bare plus; this one says what
      // it does, so the two never read as the same control.
      'tabs.addLabel': 'Add',
      'tabs.running': 'Running',
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
      'strip.title': 'Session',
      'strip.loading': 'Reading the session…',
      'strip.none': 'No results yet',
      'strip.missing': 'Missing',
      'strip.offline': 'Offline',
      'strip.row.title': 'Use this result\'s values',
      'strip.row.alt': 'A result in this session',
      'surface.failed': 'That workflow could not be read.',
      'surface.advanced': 'Advanced',
      'surface.advanced.hide': 'Hide advanced',
      // Shown on a runnable-shaped surface whose provider cannot run: the run control,
      // its strip and its result are what a runnable workflow has instead.
      'surface.pending': 'This workflow cannot run yet.',
      // S5: the run. The Run control's own label is adapter data (`ui.runLabel`), so
      // nothing here names a workflow or a provider. ONE CLICK SPENDS — there is no
      // confirmation dialog any more (founder, 2026-09-23) — and this is the short
      // while between the press and the host's answer.
      'run.action': 'Generate',
      'run.starting': 'Starting…',
      'run.phase.queued': 'Queued',
      'run.phase.running': 'Running',
      'run.phase.done': 'Done',
      'run.phase.failed': 'Failed',
      'run.job': 'Run',
      'run.result.open': 'Open the image',
      'run.result.finder': 'Open in Finder',
      'run.result.finderFailed': 'That file could not be opened.',
      'run.result.alt': 'The generated image',
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
      // The image door (founder, 2026-09-25): one drop area and nothing else. The placeholder
      // belongs to the one case that still types a link — a provider with no upload route.
      'surface.image.placeholder': 'Paste an image URL',
      'surface.image.uploading': 'Uploading…',
      'surface.image.failed': 'That image could not be uploaded.',
      // A link the browser refused to load. The one honest check on a pasted link.
      'surface.image.badUrl': 'That URL did not load an image.',
      // The prompt-writing menu (founder, 2026-09-25: *"make a sparkles menu … prompt writing
      // skill"*): the glyph's own name, and the tag a skill that is not written yet wears.
      'preset.open': 'Prompt skills',
      'preset.soon': 'Coming soon',
      // The badge on a filled door. It is its accessible name and its tooltip: the badge itself
      // is a glyph in the picture's corner.
      'surface.image.remove': 'Remove',
      // The drop area's own sentence — once at rest, once while a file is over it and the only
      // thing left to do is let go.
      'surface.image.drop': 'Drag & drop, or choose a file',
      'surface.image.dropNow': 'Drop the image',
      // A door that waits its turn names the door that is next, by its own label: the drop order
      // is the order the composer receives the pictures in (founder, 2026-09-25).
      'surface.image.waitFor': 'Drop {label} first',
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
      // The block of a provider with nothing installed. The empty state used to BE the add
      // control; the control moved to the facts line (founder, 2026-09-23: *"move +
      // workflow button as an icon button next to refresh"*), so the body says what is
      // missing and names the glyph that fixes it.
      //
      // THE COUNT LINE IS GONE (founder, 2026-09-25: *"remove workflows 3 installed"*):
      // `pane.section.family`, `pane.section.count` and `pane.section.none` went with it.
      // The block already shows what it holds, because the cards are under it.
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
      // THE PROVENANCE SENTENCES ARE GONE (founder, 2026-09-25: *"remove stored on this
      // machine"*): `wallet.fromStore` and `wallet.fromEnvironment` left both dictionaries
      // with the lines that printed them. What a key's source decides — whether this page
      // may change it — is said by `settings.readOnly`. The caption line's status light
      // (founder, 2026-09-23): green when the block
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
      // Where finished runs land (founder, 2026-09-23: *"let's make save folder default
      // on desktop, and the user can click to choose a different folder"*). The host
      // answers the effective path; this row is the Capture One shape over it — a
      // clickable path, the Finder arrow, the Space left line.
      'settings.library.title': 'Save folder',
      'settings.library.hint': 'Where finished runs are saved. Defaults to your Desktop.',
      'settings.library.current': 'Saving to',
      'settings.library.placeholder': '/Users/you/Desktop',
      'settings.library.default': 'Use Desktop',
      'settings.library.choose': 'Choose a different folder',
      'settings.library.reveal': 'Open in Finder',
      'settings.library.space': 'Space left',
      'settings.library.failed': 'That folder could not be saved.',
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
      // Cancel: the button inside the run strip while a job is queued or running.
      'run.cancel': 'Cancel',
      'run.canceling': 'Cancelling…',
      'run.phase.cancelled': 'Cancelled',
      // Queue band: the counts under the preview card while a job is in flight.
      'queue.running': '{n} running',
      'queue.queued': '{n} queued',
      'queue.limit': 'Limit {n}',
    }

    const ZH = {
      'type.label': '生成',
      'guide.title': '生成',
      'guide.description': '在这里运行你的工作流',
      'tabs.close': '关闭',
      'tabs.add': '添加工作流标签页',
      'tabs.addLabel': '添加',
      'tabs.running': '运行中',
      'surface.step.down': '减少',
      'surface.step.up': '增加',
      'run.mode': '运行模式',
      'run.saved': '已保存到',
      'surface.loading': '正在读取工作流…',
      'strip.title': '本次',
      'strip.loading': '正在读取本次结果…',
      'strip.none': '还没有结果',
      'strip.missing': '已丢失',
      'strip.offline': '离线',
      'strip.row.title': '用这条结果的参数',
      'strip.row.alt': '本次的一个结果',
      'surface.failed': '无法读取该工作流。',
      'surface.advanced': '高级',
      'surface.advanced.hide': '收起高级选项',
      'surface.pending': '该工作流暂不能运行。',
      'run.action': '生成',
      'run.starting': '正在启动…',
      'run.phase.queued': '排队中',
      'run.phase.running': '运行中',
      'run.phase.done': '完成',
      'run.phase.failed': '失败',
      'run.job': '运行',
      'run.result.open': '打开图片',
      'run.result.finder': '在 Finder 中打开',
      'run.result.finderFailed': '无法打开该文件。',
      'run.result.alt': '生成的图片',
      'run.failed': '这次运行失败了。',
      'error.noBalance': 'API 余额为空，请到服务商的 API 页面充值。',
      'error.noKey': '该服务商还没有连接密钥，请在「设置 → Generate」中连接。',
      'error.tooManyJobs': '服务商正在运行的任务已达上限，请稍后再试。',
      'error.badRequest': '服务商拒绝了这次请求。',
      'error.payloadIncomplete': '还有必填项为空。',
      'error.payloadRefused': '有数值暂时无法发送。',
      'error.jobGone': '服务商上已经没有这次运行。',
      'card.community': '他人的应用',
      'surface.image.placeholder': '粘贴图片链接',
      'surface.image.uploading': '正在上传…',
      'surface.image.failed': '该图片上传失败。',
      'surface.image.badUrl': '该链接没有载入图片。',
      'preset.open': '提示词技能',
      'preset.soon': '即将推出',
      'surface.image.remove': '移除',
      'surface.image.drop': '拖拽或选择文件',
      'surface.image.dropNow': '松手即可上传',
      // 等待中的门用前一张门自己的标签说明该先放哪一张：放入顺序就是对话里收到的顺序。
      'surface.image.waitFor': '请先放入 {label}',
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
      'settings.library.title': '保存文件夹',
      'settings.library.hint': '生成结果的保存位置。默认保存到你的桌面。',
      'settings.library.current': '正在保存到',
      'settings.library.placeholder': '/Users/you/Desktop',
      'settings.library.default': '使用桌面',
      'settings.library.choose': '选择其他文件夹',
      'settings.library.reveal': '在 Finder 中打开',
      'settings.library.space': '剩余空间',
      'settings.library.failed': '该文件夹无法保存。',
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
      'run.cancel': '取消',
      'run.canceling': '正在取消…',
      'run.phase.cancelled': '已取消',
      'queue.running': '{n} 个运行中',
      'queue.queued': '{n} 个排队中',
      'queue.limit': '上限 {n}',
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
      // THE STRIP UNDER THE CANVAS (epic 64 S3): the session contained below the picture it
      // belongs to, exactly as RunningHub draws it. Forty thumbs scroll sideways; the pane
      // never grows a second page for them.
      strip: { display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 },
      stripHead: { display: 'flex', alignItems: 'baseline', gap: 6 },
      stripRows: { display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 },
      stripCount: { color: 'var(--dsw-alias-label-tertiary)', fontSize: 11 },
      stripLabel: { color: 'var(--dsw-alias-label-tertiary)', fontSize: 11.5 },
      thumb: { flex: '0 0 auto', width: 56, height: 56, padding: 0, borderRadius: 8, border: '1px solid var(--dsw-alias-border-l2)', background: 'var(--dsw-alias-bg-layer-2)', overflow: 'hidden', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
      thumbOn: { borderColor: 'var(--dsw-alias-label-tertiary)' },
      thumbImage: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
      thumbMissing: { color: 'var(--dsw-alias-label-tertiary)', fontSize: 10, textAlign: 'center', padding: 2, lineHeight: '12px' },
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
      /**
       * The tab title's own glyph (founder, 2026-09-25: *"add sparkles icon to generate tab at
       * top to match other dsh tabs"*). The guide tab draws its compass the same way: the
       * glyph first in the tertiary ink, then the label — 16px, which is that glyph's own
       * default size, so the two tab titles read at one weight.
       */
      tabTitleIcon: {
        display: 'inline-flex',
        flex: 'none',
        marginRight: 6,
        color: 'var(--dsw-alias-label-tertiary)',
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
      /**
       * TWO BUTTONS, NOT A SPLIT ONE (founder, 2026-09-25: *"the split button is a little weird,
       * make it 2 buttons: generate (filled primary) + default select (outlined primary)"*). The
       * action and the choice are the harness `Button`'s own `primary` and `outline` variants now,
       * with the same gap any pair of buttons gets — no shared border, no half-rounded corners,
       * which is what made the old segment read as one control split in two.
       */
      splitButton: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        alignSelf: 'flex-start',
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
      /** The number itself: no weight of its own, since the whole line is a quiet fact. */
      balanceValue: {
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
       * THE HOME IS A DASHBOARD, NOT A STACK OF CARDS (founder, 2026-09-25: *"it should be
       * minimal like start surface and make like dashboard"*).
       *
       * The Start surface is one centred column of entry cards on the page's own
       * background: nothing wraps a group, there are no separators and nothing folds. The
       * home keeps that shape — one light caption line per provider, one facts line under
       * it, and that provider's workflows under them as the guide's own entries. The
       * column is the guide's own 380px, centred, so the wide Generate tab and the narrow
       * right column read the same.
       */
      sections: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        // VERTICALLY CENTRED ON THE PAGE (founder, 2026-09-25: *"vertical center on page"*).
        // The Start surface centres its column and so does this one.
        //
        // `margin: auto` is how that is done SAFELY: a flex item with auto margins centres
        // itself while there is room and falls back to 0 when the content is taller than the
        // pane. `justify-content: center` would instead push the first provider off the top
        // of an overflowing pane, where no scroll reaches it. `flex: none` keeps the column
        // at its natural height so the auto margins have something to compute against.
        margin: 'auto 0',
        flex: 'none',
        // The air between one provider's block and the next is now the only thing
        // separating them, so it carries what the border used to.
        gap: 18,
        padding: '14px 12px 2px',
      },
      /**
       * ONE PROVIDER IS ONE BLOCK, AND NOTHING DRAWS ITS EDGE (founder, 2026-09-25). It
       * was a card with a border and a radius; that box plus a hairline band made the page
       * read as a form. The block is a column at the guide's own width, and the only lines
       * on the page are the cards'.
       */
      section: {
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        width: 380,
        maxWidth: '100%',
        boxSizing: 'border-box',
      },
      /**
       * The caption line: the status light and the provider's name with its account
       * glyph, and nothing clickable about the row. It is no longer a toggle — every
       * provider is always open (founder, 2026-09-25) — so it carries no chevron, no
       * `role="button"` and no pointer.
       */
      sectionHead: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        width: '100%',
        boxSizing: 'border-box',
        padding: '0 4px',
      },
      /**
       * THE FACTS LINE (founder, 2026-09-25: *"it should be minimal like start surface and
       * make like dashboard"*). This was the subheader band: the same items, with a
       * hairline above and below and a card around them. The lines and the card are gone,
       * the facts stayed, and the caption line above them names the provider.
       *
       * One flex row, so the balance grows into the room the count line and the two glyphs
       * leave it and clips rather than pushing them out.
       */
      sectionFacts: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '0 4px',
      },
      /** The status light's box, the height of the caption line's own text. */
      sectionLight: {
        flex: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 16,
        height: 16,
      },
      /**
       * The wallet balance, on the facts line under the name it belongs to (founder,
       * 2026-09-23: *"move the wall balance to row 2 below accordion title"*; it has been
       * on row 2 ever since, and only the box around it went on 2026-09-25).
       *
       * SMALL AND MUTED (founder, 2026-09-25: *"make coins usd key saved small muted font
       * color / fontsize sm"*): 11px in the caption ink, and the value lost the weight it
       * used to carry. A balance is a fact someone checks, not a number the page sells.
       */
      sectionBalance: {
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        flex: '1 1 auto',
        minWidth: 0,
        fontSize: 11,
        lineHeight: '16px',
        color: 'var(--dsw-alias-label-caption)',
        // One line, always: the line clips rather than grows, so a provider's explanatory
        // note cannot deepen the block.
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
        // A SECTION LABEL, NOT A CARD TITLE (founder, 2026-09-25): the provider's name
        // reads at the weight of a label on the page, so the six cards under it are what
        // the eye lands on.
        fontSize: 13,
        fontWeight: 500,
        lineHeight: 1.4,
        color: 'var(--dsw-alias-label-secondary)',
        // One line, always: nothing a provider says can deepen the block, so the name,
        // the balance, the count line and the notes all clip rather than wrap.
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      },
      /**
       * The facts line's own controls, at the end of the row: add a workflow and re-read
       * the block, both as glyphs (founder, 2026-09-23: *"move + workflow button as an
       * icon button next to refresh"*).
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
        // No inset: the entries sit on the same left edge as the caption above them, the
        // way the guide's own column lines up.
        padding: 0,
      },
      sectionCards: {
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      },
      /** The note under the dashboard: where the key is managed, and nothing else. */
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
      },
      /**
       * THE ADD CONTROL'S POPOVER (founder, 2026-09-25: *"click add button launch popover w
       * snippet"*). The snippet used to open inline at the foot of the block, which pushed
       * every card under it down and re-flowed the page; it floats now, anchored to the
       * glyph that opened it.
       *
       * THE SURFACE IS SOLID, NOT THE MENU'S TRANSLUCENT FILL (founder, 2026-09-25: *"fix
       * popover; it should have solid bg (its transparent now)"*). The app's menu card is
       * `--dsw-specific-menu`, which is ~50% alpha and reads through the `backdrop-filter` the
       * app's own menus carry; this card has no such filter, so it came out see-through. It
       * wears the opaque layer-2 surface and the l3 border the pane's other `Card`s wear
       * (white in the light theme, `#2c2c2e` in the dark one) with the menu's own elevation
       * over the top, so it is legible the moment it opens.
       *
       * `position: fixed` and the two coordinates come from the primitives'
       * `useAnchoredPosition`; nothing in the pane clips it.
       */
      popover: {
        position: 'fixed',
        zIndex: 100,
        width: 320,
        maxWidth: 'calc(100vw - 24px)',
        boxSizing: 'border-box',
        padding: 12,
        borderRadius: 16,
        background: 'var(--dsw-alias-bg-layer-2)',
        border: '.5px solid var(--dsw-alias-border-l3)',
        boxShadow: 'var(--dsw-elevation-prominent)',
      },
      /** One workflow's surface: the form column, inside the pane, under the header. */
      surface: {
        padding: '14px 12px 24px',
      },
      /**
       * THE HEADER, ONE ROW LOWER: the DSH strip's own pattern (founder, 2026-09-25). A tab
       * per open workflow and a plus, exactly as the strip above carries a tab per open page
       * and a plus — and the plus leads to the start screen, which is where a workflow is
       * chosen and its tab is made, the way DSH's `addTab` opens the guide. The separator
       * above this row is the DSH strip's own, so the row draws none of its own.
       */
      tabsBar: {
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        // THE SAME BREATH ABOVE AND BELOW THE TABS THE DSH STRIP TAKES (founder, 2026-09-25:
        // *"add gap spacing same as between top of viewport and top edge of panel tab
        // (generate)"*, then *"i meant same spacing top and bottom"*). The strip's own rule is
        // `padding:10px 6px 0 var(--dsh-dockkit-strip-inline-start, 10px)`, so a DSH pill sits
        // 10px under the top of the viewport; these tabs sit 10px under the DSH strip's own
        // hairline above them and 10px above whatever follows them.
        padding: '10px 8px',
        minHeight: 40,
        boxSizing: 'border-box',
        overflowX: 'auto',
        background: 'var(--dsw-alias-bg-base)',
        // NO HAIRLINE OF ITS OWN, ABOVE OR BELOW (founder, 2026-09-25: *"remove separator"*).
        // The row drew one above itself for a few hours (*"add separator below the panel tabs"*,
        // then *"move separator above the generate tabs (between files & qwen"*), which put a
        // second line directly under the DSH strip's own — the header carrying that strip already
        // draws `.5px solid var(--dsw-alias-border-l2)` — so the boundary read as one thick rule
        // rather than a divider. That line is the app's and stays; this row draws none, which is
        // where it started.
        // STICKY, LIKE THE STRIP ABOVE IT (founder, 2026-09-25: *"the generate start page
        // does not have + icon"*). The row was drawn on the start page and scrolled away with
        // the grid, so the plus vanished the moment a person looked down the card list. The
        // DSH strip never scrolls; this one does not either.
        position: 'sticky',
        top: 0,
        zIndex: 2,
      },
      /**
       * One workflow header. The geometry is the harness `Button`'s own `sm` capsule — 28px
       * tall, a 14px radius, 10px of side padding, 12px text — so a tab here reads as the
       * same control as every other capsule in the app.
       *
       * SELECTED DRAWS A BORDER AND UNSELECTED DRAWS NONE (founder, 2026-09-25). The border
       * is the primitive's own `outline` pair (`0.5px solid --dsw-alias-border-l3`), and an
       * unselected tab keeps a transparent border of the SAME width so nothing shifts
       * sideways the moment a tab becomes the active one.
       */
      tab: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 2,
        height: 28,
        boxSizing: 'border-box',
        padding: '0 6px 0 10px',
        borderRadius: 14,
        border: '.5px solid transparent',
        background: 'transparent',
        color: 'var(--dsw-alias-label-secondary)',
        flexShrink: 0,
        // THE STRIP'S OWN TYPE, NOT THE PANE'S (founder, 2026-09-25: *"the workflow tab
        // fontsize too big"*). The label inherited the pane's 14px; the DSH strip and the
        // harness `Button`'s `sm` size are 12px on an 18px line, which is what a tab is.
        fontSize: 12,
        lineHeight: '18px',
        // THE WHOLE LABEL, ALWAYS (founder, the same day: *"can we make width of tab to show
        // entire label?"*). The pill used to cap at 200px and ellipsise, which is what turned
        // two Qwen apps into one repeated "qwen-2-1-image-e…". A tab's name is the one thing it
        // has to say, so the pill is as wide as its words and the row scrolls when they do not fit.
      },
      tabSelected: {
        border: '.5px solid var(--dsw-alias-border-l3)',
        color: 'var(--dsw-alias-label-primary)',
      },
      tabHover: {
        background: 'var(--dsw-alias-interactive-bg-hover)',
      },
      /** The tab's label: a button, because choosing it is what switches the pane. */
      tabLabel: {
        border: 'none',
        background: 'transparent',
        padding: 0,
        margin: 0,
        font: 'inherit',
        color: 'inherit',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      },
      /**
       * The tab's own close: a glyph-sized button, tertiary at rest, and HIDDEN until its tab
       * is selected, hovered or focused. The visibility rule is not here — it is
       * `.dsh-generate-tabClose` in the one injected sheet, because `:hover` and
       * `:focus-within` are what reveal it and no inline style can say that (the app's own
       * `_tabClose_11olo_411` is the same rule). This object is only the box.
       */
      tabClose: {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 18,
        height: 18,
        padding: 0,
        border: 'none',
        background: 'transparent',
        borderRadius: 9,
        cursor: 'pointer',
        color: 'var(--dsw-alias-label-tertiary)',
        flex: 'none',
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
       *
       * AND THE PAIR IS TWO TO THREE, NOT ONE TO ONE (founder, 2026-09-25: *"the ratio of
       * parameters/preview try 2/5:3/5 of 5 column after a mobile breakpoint"*). A zero basis
       * with the grow factors 2 and 3 is what makes that exact: the free width is what is
       * divided, so the two cards land on 2/5 and 3/5 of the row whatever it is, and `minWidth`
       * is what decides when the row is too narrow and the cards stack instead. With an
       * authored basis the base widths would sit inside the ratio and neither card would be the
       * fraction it says.
       */
      surfaceColumns: {
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'flex-start',
        gap: 16,
      },
      /** The parameters card: the doors, and the control that spends. */
      surfaceParams: {
        flex: '2 1 0',
        minWidth: 260,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      },
      /** The preview card: what the run is doing and what it made. */
      surfaceOutput: {
        flex: '3 1 0',
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
      /**
       * THE DROP AREA (founder, 2026-09-25: *"the upload image card looks messy, make it more
       * clean with drop area + icons below for finder or link"*). The dashes belong to the thing
       * a file lands ON, and nothing else: the two ways in are tiles UNDER the area, so the door
       * reads as a target with two controls rather than a card holding a stack of fields.
       */
      imageDrop: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginTop: 6,
        padding: '22px 12px',
        border: '1px dashed var(--dsw-alias-border-l2)',
        borderRadius: 8,
        background: 'var(--dsw-alias-bg-layer-1)',
        cursor: 'pointer',
        textAlign: 'center',
      },
      /** THE SAME AREA WHILE A FILE IS OVER IT: the border lights up, so the drop lands somewhere visible. */
      imageDropOver: {
        borderColor: 'var(--dsw-alias-brand-primary)',
        background: 'var(--dsw-alias-bg-layer-2)',
      },
      /**
       * THE AREA OF A DOOR THAT IS WAITING ITS TURN. Dimmed and with no pointer, because the
       * honest answer to a drop here is "not yet" — the sentence inside says which door is next.
       */
      imageDropWait: {
        opacity: 0.55,
        cursor: 'not-allowed',
      },
      /** The area's own label: pressing anywhere in it opens the picker, so the label brings no ink. */
      imageDropLabel: {
        display: 'block',
        color: 'inherit',
        textDecoration: 'none',
      },
      /**
       * ONE DOOR'S LABEL LINE, WITH THE PRESET GLYPH AT ITS FAR END (founder, 2026-09-25: *"we
       * should add sparkles icon to fill the prompt w subject swap skill"*, then *"can you add
       * sparkles icon to the Prompt title row above prompt input box, this trigger the menu for
       * prompt writing skill. Put it justify right"*). The label stays left and `space-between`
       * pushes the one control on this line to the right edge; a door with no preset still reads
       * as a plain label, because a single child has nothing to space against.
       */
      doorLabelRow: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 6,
        minWidth: 0,
      },
      /** The preset glyph: the app's sparkle, at the size a label can carry without shouting. */
      presetButton: {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 18,
        height: 18,
        padding: 0,
        color: 'var(--dsw-alias-label-tertiary)',
        background: 'transparent',
        border: 'none',
        borderRadius: 6,
        cursor: 'pointer',
      },
      /** The glyph above the sentence, in the muted ink the app gives a placeholder mark. */
      imageDropGlyph: {
        display: 'flex',
        color: 'var(--dsw-alias-label-tertiary)',
      },
      /** The area's one sentence: what to do, in the app's own secondary ink. */
      imageDropLead: {
        fontSize: 12,
        lineHeight: '18px',
        color: 'var(--dsw-alias-label-secondary)',
      },
      /**
       * A FILLED IMAGE DOOR IS A COLUMN: the picture, then what a person does to it
       * (founder, 2026-09-24: *"the replace and remove buttons should be below"*). The
       * picture leads because it is the thing being checked before a run.
       */
      imageField: {
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        minWidth: 0,
      },
      /**
       * THE THUMBNAIL'S FRAME TAKES THE PICTURE'S OWN SHAPE (founder, 2026-09-24: *"match the
       * aspect of ref image"*). Its `aspectRatio` is written per render from the image's own
       * `naturalWidth / naturalHeight` once it loads, so a portrait garment reads as a
       * portrait and a square reference as a square — never a crop that hides what was chosen.
       * A square stands in until the first load, which is also what the neutral mark uses.
       */
      imageThumbFrame: {
        position: 'relative',
        width: '100%',
        maxWidth: 240,
        borderRadius: 8,
        border: '1px solid var(--dsw-alias-border-l1)',
        background: 'var(--dsw-alias-bg-layer-1)',
        overflow: 'hidden',
        display: 'block',
      },
      /** The picture inside the frame: it fills the frame's own shape exactly. */
      imageThumb: {
        display: 'block',
        width: '100%',
        height: '100%',
        objectFit: 'cover',
      },
      /** A door that holds a picture this surface cannot draw: a provider's opaque handle. */
      imageThumbEmpty: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        color: 'var(--dsw-alias-label-tertiary)',
      },
      /**
       * THE CLEAR BADGE, IN THE PICTURE'S OWN TOP-RIGHT CORNER (founder, 2026-09-25: *"to clear
       * the upload use a badge close icon in the top right corner"*). Clearing is a thing done TO
       * the picture, so the control sits on it rather than in a row under it — and it keeps its
       * own solid surface, because a picture can be any colour underneath.
       */
      imageClearBadge: {
        position: 'absolute',
        top: 6,
        right: 6,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 20,
        height: 20,
        padding: 0,
        color: 'var(--dsw-alias-label-primary)',
        background: 'var(--dsw-alias-bg-layer-2)',
        border: '1px solid var(--dsw-alias-border-l2)',
        borderRadius: 10,
        cursor: 'pointer',
      },
      /** The line a filled door draws only while the bytes are still on their way. */
      imageSetLine: {
        fontSize: 12,
        lineHeight: '16px',
        color: 'var(--dsw-alias-label-secondary)',
      },
      /** Two or more image doors side by side in the parameters card. */
      imageGroup: {
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
      },
      /** One image door inside the side-by-side group. */
      imageGroupItem: {
        flex: '1 1 0',
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
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
      /** The spinner the strip wears left of the phase: the loading glyph, spinning. */
      runSpin: {
        flex: 'none',
        display: 'inline-flex',
        color: 'var(--dsw-alias-label-secondary)',
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
      /**
       * THE QUEUE, one row per job. The band on top is the ACCOUNT's counts and the rows
       * under it are THIS SURFACE's jobs; they are two different facts and are never
       * reconciled.
       */
      queueList: {
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      },
      queueRow: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '6px 10px',
        fontSize: 12,
        lineHeight: '18px',
        color: 'var(--dsw-alias-label-secondary)',
        background: 'var(--dsw-alias-bg-layer-1)',
        border: '.5px solid var(--dsw-alias-border-l1)',
        borderRadius: 8,
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
        // A PROMPT CAN BE A WHOLE PAGE (founder's screenshot, 2026-09-23: the gate
        // dialog ran 2674px tall because one row carried every word of a long
        // prompt). The value scrolls inside a capped box instead of stretching the
        // dialog — short values never reach the cap — and `contain` keeps a wheel
        // over the prompt from scrolling the dialog behind it.
        maxHeight: '40vh',
        overflowY: 'auto',
        overscrollBehavior: 'contain',
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
      let state = { phase: 'loading', providers: [], library: null }
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
          if (!response.ok || !body || !Array.isArray(body.providers)) return { phase: 'failed', providers: [], library: null }
          return { phase: 'ready', providers: body.providers, library: body.library || null }
        } catch {
          return { phase: 'failed', providers: [], library: null }
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

      return { phase: state.phase, providers: state.providers, library: state.library, busy, load: reload, save, unlink, setHidden, confirmed, forget }
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
     * The `credentials` seam's own vocabulary for where a value came from —
     * `@deepseek-ai/dsh-credentials-local`, read 2026-09-22: `file` is the
     * provider-managed store, `env` the inherited process environment, `project-env`
     * and `user-env` the `.env` fallbacks. The pane used to print two of those as
     * sentences ("stored on this machine", "from your environment"); the founder had
     * them removed on 2026-09-25 (*"remove stored on this machine"*), so nothing here
     * names a source any more. The seam is still read — the facts line still carries
     * `data-generate-source` for the DOM, and `writable: false` is what says a key
     * cannot be changed from this page — but no constant is left for a sentence that
     * no longer exists.
     */

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
     * The two calls a run makes: start it, then read it back (S5).
     *
     * THE HOST BUILDS THE BODY, NOT THIS HALF — and with the confirmation dialog gone
     * (founder, 2026-09-23) there is no preview step left between the form and the run:
     * the press posts, and the host's own validation is what answers an incomplete
     * payload, as a strip failure rather than as a dialog.
     *
     * The key never appears in any of this: the host reads it from the credential store
     * per call (§12 rule 2).
     */

    /**
     * Start it. `confirmed: true` is the person's own action — the press of the run
     * control — recorded by the host in the run's file; the route refuses a call without
     * it, so a stale tab or a script cannot spend what a person never started.
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
     * provider is not repeated either — the card sits under that provider's own caption
     * line, which names it — while `data-generate-provider` still carries the fact for
     * anyone reading the DOM.
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
     * An arrow-up-out-of-a-tray, Lucide-style, at 24px. The harness ships no upload glyph — its
     * own set has `IconDownloadOutline` and nothing for the other direction — and the empty image
     * door needs one mark that says "a file comes in here". Never exported, never shared, and the
     * only hand-drawn mark left in this bundle.
     */
    function IconUpload24(props) {
      return h(
        'svg',
        {
          width: 24,
          height: 24,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.5,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          ...props,
        },
        h('path', { d: 'M12 15.5V3.5' }),
        h('path', { d: 'm7.5 8 4.5-4.5L16.5 8' }),
        h('path', { d: 'M4 15.5v3A2.5 2.5 0 0 0 6.5 21h11a2.5 2.5 0 0 0 2.5-2.5v-3' }),
      )
    }

    /**
     * AN IMAGE DOOR: a file a person picks, or a URL they paste.
     *
     * Both halves are the API's own vocabulary. Krea's `image_url` and a style reference's
     * `url` each take *"an external URL, base64 data URI, or uploaded asset URL"*
     * (its OpenAPI, read 2026-09-23), so a paste is a first-class way to fill the field, and
     * a file — which cannot be pasted — goes to the provider's upload route and comes back as
     * the value the field carries. The one thing that is NOT a value is what a file input
     * reports on its own (`C:\fakepath\…`), which is why this control never reads it: the
     * nothing-uploaded-yet state is the button itself, and the field stays empty until the
     * upload answers.
     *
     * THE THUMBNAIL IS THE FILE THE PERSON PICKED, NOT THE VALUE (measured 2026-09-24). An
     * uploaded value is only sometimes a picture URL: Krea answers one, RunningHub answers an
     * opaque `fileName` (`api/7a8b80db…`) that is a node input and nothing a browser can open.
     * Drawing the value as `<img src>` therefore put a broken image on RunningHub's doors — the
     * founder saw exactly that (*"I don't see thumbnails"*). So the preview is a blob URL of the
     * picked file itself, which is the picture in hand, and a value is only drawn when it is
     * really addressable (`http(s)`, `data:image/`, `blob:`); anything else gets a neutral mark
     * rather than a guess at a host.
     *
     * AND THE RAW VALUE LEAVES THE SCREEN ONCE A PICTURE IS SET (founder, same day: *"why is
     * api/editable?"*). An opaque provider handle is not a string a person typed, can read or
     * should edit, so a filled door shows the thumbnail with Replace and Remove, and the text
     * field returns only when the door is empty — where pasting a URL is the point.
     *
     * AND THE EMPTY DOOR IS ONE DROP AREA WITH THE URL BUTTON INSIDE IT (founder, 2026-09-25:
     * *"we don't need finder button since click on the drop area does same thing. url button should
     * be inside the drop zone, user clicks on it to get a modal for url input, paste url then it
     * fetches and populate the thumbnail"*). So there are no tiles under the area: the area is the
     * picker's own label (a press anywhere in it opens the dialog), and the one other way in is a
     * button inside it that opens `UrlDialog`. What the dialog accepts becomes the door's value and
     * the browser fetches it into the frame.
     *
     * AND A PICTURE IS CLEARED BY A BADGE ON IT (founder, the same day: *"to clear the upload use
     * a badge close icon in the top right corner"*). The row of actions under the picture is
     * gone with that: the picture carries its own way out.
     */
    function ImageField({ t, provider, id, doorKey, value, onChange, canUpload, waitFor }) {
      /**
       * AN EMPTY SECOND IMAGE WAITS FOR THE FIRST (founder, 2026-09-25: *"its drops in order not by
       * left/right position. we can disable image 2 and message user to drop image 1 first"*).
       *
       * The reason lives outside this panel. The harness's attachment tray takes every dropped file
       * at `document`, in the order the drops happened — not in the order of the doors — so a panel
       * that lets a person start with the second image hands the composer the two pictures
       * backwards. `waitFor` is the earlier door's own label; while it is set, this door takes no
       * drop, opens no picker, and says which door to fill instead.
       *
       * ONLY AN EMPTY DOOR IS HELD BACK. A door that already carries an image is never blocked, so
       * the guard cannot trap a value a person wants to clear or replace.
       */
      const blocked = typeof waitFor === 'string' && waitFor !== ''
      const [phase, setPhase] = React.useState('idle')
      const [problem, setProblem] = React.useState(null)
      /** The picked file's own bytes, as a blob URL. Revoked whenever it is replaced. */
      const [preview, setPreview] = React.useState(null)
      /** The picture's own width/height, once it has loaded. Null until then: a square stands in. */
      const [ratio, setRatio] = React.useState(null)
      /** Whether a file is currently over the area, which is what lights its border. */
      const [dragging, setDragging] = React.useState(false)
      /**
       * A URL THAT WILL NOT LOAD. Nothing here asks for a URL any more (founder, 2026-09-25:
       * *"i can't get url to work. maybe we don't need on local, user can download and upload is
       * better"*), but a provider with no upload route is still typed into, and a value saved by
       * an earlier build can still be a link — so the frame keeps the one honest answer to a link
       * the browser refuses: the neutral mark and a sentence, never a broken-image glyph.
       */
      const [urlBroken, setUrlBroken] = React.useState(false)

      // THE BLOB IS RELEASED TWICE ON PURPOSE. React runs this cleanup when `preview` changes and
      // on unmount, which is what stops a leak in the browser; the explicit calls below release
      // the same URL at the moment it is replaced or removed, so the transition is observable
      // without waiting for a React commit. Revoking an already-revoked URL is a no-op.
      React.useEffect(() => () => {
        if (preview) URL.revokeObjectURL(preview)
      }, [preview])

      const release = (url) => {
        if (url) URL.revokeObjectURL(url)
      }

      /**
       * ONE FILE IN, WHATEVER BROUGHT IT. The picker and the drop both land here, so a dragged
       * file travels the same route, preview and failure handling as a picked one.
       */
      const accept = async (file) => {
        if (!file) return
        const local = URL.createObjectURL(file)
        setPreview(local)
        // A new picture's shape is unknown until it loads; the old ratio would be a lie.
        setRatio(null)
        setPhase('uploading')
        setProblem(null)
        const uploaded = await uploadImage(provider, file)
        if (uploaded.ok) {
          setPhase('idle')
          onChange(uploaded.url)
          return
        }
        // A failed upload leaves nothing behind: the preview goes and the door stays as it was.
        release(local)
        setPreview(null)
        setRatio(null)
        setPhase('failed')
        setProblem(uploaded.error)
      }

      const pick = (event) => {
        const file = event.target.files && event.target.files[0]
        // Clearing the input is what lets the same file be picked twice: a file input fires
        // no change event for a value it already had.
        event.target.value = ''
        accept(file)
      }

      /**
       * THE DROP. `preventDefault` on drag-over is what makes an element a drop target at all —
       * without it the browser navigates to the file. The card also has to drop the highlight
       * when the pointer leaves, which `dragleave` reports; a nested child can fire it once more
       * on the way out, and the cost of that is one extra render, not a stuck border.
       */
      const overFile = (event) => {
        if (!canUpload || blocked) return
        event.preventDefault()
        if (!dragging) setDragging(true)
      }
      const leaveFile = () => {
        if (dragging) setDragging(false)
      }
      const dropFile = (event) => {
        if (!canUpload || blocked) return
        event.preventDefault()
        setDragging(false)
        const transfer = event.dataTransfer
        const file = transfer && transfer.files && transfer.files[0]
        accept(file)
      }

      const remove = () => {
        release(preview)
        setPreview(null)
        setRatio(null)
        setPhase('idle')
        setProblem(null)
        setUrlBroken(false)
        onChange('')
      }

      const busy = phase === 'uploading'
      const filled = value !== undefined && value !== null && String(value) !== ''
      // A value this surface can actually draw as itself, or null when it is a provider handle.
      const addressable = filled && /^(https?:|data:image\/|blob:)/i.test(String(value)) ? String(value) : null
      const thumb = preview || addressable
      /**
       * THE PICTURE'S OWN SHAPE, read once it loads. `naturalWidth`/`naturalHeight` are the
       * bytes' real dimensions, which is the only honest source for an aspect ratio a person
       * picked; a square stands in until the first load answers.
       */
      const readRatio = (event) => {
        const node = event && event.target
        if (node && node.naturalWidth > 0 && node.naturalHeight > 0) setRatio(node.naturalWidth / node.naturalHeight)
      }
      /** The hidden file input both Finder and the drop area open. */
      const fileInput = h('input', {
        id: id + '-file',
        'data-generate-upload': doorKey,
        type: 'file',
        accept: 'image/*',
        style: { display: 'none' },
        // A waiting door keeps its input, so the door has one shape in every state — the input is
        // simply not open yet, which is what stops the label from raising a file dialog.
        disabled: blocked,
        onChange: pick,
      })
      const failure = () =>
        phase === 'failed' ? h('div', { style: S.imageProblem, 'data-generate-upload-failed': problem || 'yes' }, t('surface.image.failed')) : null
      /**
       * A URL THAT WILL NOT LOAD. The browser is what fetches a pasted URL, so the only honest
       * check is its own answer: the frame draws the neutral mark and says what happened instead
       * of showing a broken-image glyph in the place the picture belongs.
       */
      const urlFailure = () =>
        urlBroken ? h('div', { style: S.imageProblem, 'data-generate-url-failed': doorKey }, t('surface.image.badUrl')) : null

      // FILLED — the picture with its own way out, and nothing else: no raw value on screen, and
      // the frame wears the picture's own aspect once it is known. The badge is the only control,
      // because the empty state (and its two ways in) is what a cleared door goes back to.
      if (filled || busy) {
        const drawable = urlBroken ? null : thumb
        return h(
          'div',
          { style: S.imageField, 'data-generate-image': doorKey, 'data-generate-image-set': 'yes' },
          h(
            'div',
            {
              style: { ...S.imageThumbFrame, aspectRatio: ratio === null ? '1 / 1' : String(ratio) },
              'data-generate-thumb-frame': doorKey,
            },
            drawable
              ? h('img', {
                  src: drawable,
                  style: S.imageThumb,
                  alt: '',
                  onLoad: readRatio,
                  onError: () => setUrlBroken(true),
                  'data-generate-thumb': doorKey,
                })
              : h('div', { style: S.imageThumbEmpty, 'data-generate-thumb-missing': doorKey }, h(IconSparkle16, { size: 20 })),
            h(
              'button',
              {
                type: 'button',
                style: S.imageClearBadge,
                'data-generate-image-clear': doorKey,
                'aria-label': t('surface.image.remove'),
                title: t('surface.image.remove'),
                onClick: remove,
              },
              h(IconCloseOutline16, { size: 12 }),
            ),
          ),
          busy ? h('div', { style: S.imageSetLine, 'data-generate-image-busy': doorKey }, t('surface.image.uploading')) : null,
          urlFailure(),
          failure(),
        )
      }

      // NO UPLOAD ROUTE — the plain field alone. A provider that cannot take an upload gets no
      // drop area: a control that cannot finish the job must not invite the act. This is the one
      // place a link is still typed, which is why the frame keeps a bad-link answer.
      if (!canUpload) {
        return h(
          'div',
          { style: S.imageField, 'data-generate-image': doorKey, 'data-generate-drop': 'no' },
          h('input', {
            style: { ...S.input, marginTop: 0 },
            id,
            'data-generate-door': doorKey,
            type: 'text',
            value: '',
            placeholder: t('surface.image.placeholder'),
            onChange: (event) => onChange(event.target.value),
          }),
          urlFailure(),
          failure(),
        )
      }

      // EMPTY — ONE DROP AREA AND NOTHING ELSE IN IT (founder, 2026-09-25: *"we don't need finder
      // button since click on the drop area does same thing"*, then *"i can't get url to work.
      // maybe we don't need on local, user can download and upload is better"*). The dashes wrap
      // the area, the area is the picker's own label, and a dropped file is the same upload a
      // picked one is — so the door has no second control at all.
      const dropArea = h(
        'div',
        {
          style: blocked ? { ...S.imageDrop, ...S.imageDropWait } : dragging ? { ...S.imageDrop, ...S.imageDropOver } : S.imageDrop,
          'data-generate-drop': blocked ? 'wait' : 'yes',
          ...(blocked ? { 'data-generate-drop-wait': doorKey } : {}),
          ...(dragging && !blocked ? { 'data-generate-drag-over': 'yes' } : {}),
          onDragOver: overFile,
          onDragEnter: overFile,
          onDragLeave: leaveFile,
          onDrop: dropFile,
        },
        h('span', { style: S.imageDropGlyph }, h(IconUpload24, null)),
        h(
          'div',
          { style: S.imageDropLead },
          blocked ? t('surface.image.waitFor').replace('{label}', waitFor) : dragging ? t('surface.image.dropNow') : t('surface.image.drop'),
        ),
        fileInput,
      )
      return h(
        'div',
        { style: S.imageField, 'data-generate-image': doorKey },
        h('label', { htmlFor: id + '-file', style: S.imageDropLabel, 'data-generate-drop-label': doorKey }, dropArea),
        urlFailure(),
        failure(),
      )
    }

    /**
     * THE SPARKLE AND ITS MENU (founder, 2026-09-25: *"make a sparkles menu, sparkles subject swap
     * is a prompt writing skill, we can have other skill like face swap, add object (add these
     * others but greyed for now) I just want to test UI"*).
     *
     * A component rather than a builder inside the surface, because the menu owns open state and
     * a hook may not sit inside the door loop. The rows are the harness `Menu`'s own items, so the
     * sparkle joins the app's menus: anchored under the glyph, keyboard-walked, closed by the
     * outside pointer. A `disabled` preset is a row with `disabled: true` — the primitive greys it
     * and refuses the press, and the check below refuses it a second time, so a placeholder can
     * never write anything.
     */
    function PresetSparkle({ t, doorKey, presets, onApply }) {
      const [open, setOpen] = React.useState(false)
      const items = presets.map((preset) => ({
        id: preset.label,
        icon: h(IconSparkle16, { size: 14 }),
        disabled: preset.disabled === true,
        label: h(
          'div',
          { style: S.menuRow, 'data-generate-preset-row': preset.label },
          h('span', { style: S.menuRowValue, 'data-generate-preset-state': preset.disabled === true ? 'soon' : 'ready' }, preset.label),
          preset.disabled === true ? h('span', { style: S.menuRowNote }, t('preset.soon')) : null,
        ),
      }))
      return h(Menu, {
        open,
        side: 'bottom',
        align: 'start',
        items,
        onSelect: (id) => {
          setOpen(false)
          const chosen = presets.find((preset) => preset.label === id)
          if (chosen && chosen.disabled !== true) onApply(chosen)
        },
        onClose: () => setOpen(false),
        anchor: h(
          'button',
          {
            type: 'button',
            style: S.presetButton,
            'data-generate-preset': doorKey,
            'aria-label': t('preset.open'),
            title: t('preset.open'),
            'aria-haspopup': 'true',
            'aria-expanded': open ? 'true' : 'false',
            onClick: () => setOpen((shown) => !shown),
          },
          h(IconSparkle16, { size: 14 }),
        ),
      })
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
        // THE ACTION. Filled primary, because this is the press that spends (founder, 2026-09-25:
        // *"make it 2 buttons: generate (filled primary) + default select (outlined primary)"*).
        h(Button, { variant: 'primary', size: 'md', disabled, onClick, ...attrs }, label),
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
          // THE CHOICE. Outlined primary, and it shows what is chosen rather than hiding it behind
          // a chevron alone — the mode changes what the run uses, so it is read before the press.
          anchor: h(
            Button,
            {
              variant: 'outline',
              size: 'md',
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
    /**
     * The session's own read (epic 64 S3): the runs of this workflow, newest first.
     *
     * It re-reads when a run settles — `refreshKey` is that run's job id — because the strip
     * is where a result appears, and a strip that only filled in on the next open would make
     * a person doubt the run had happened at all.
     */
    function useResults(provider, name, refreshKey) {
      // NO NAME IS AN IDLE STRIP, not a pending read: a person who arrived from the card has no
      // session yet, and "Reading the session…" forever is a lie about work nobody asked for.
      const [state, setState] = React.useState(name ? { phase: 'loading', rows: [], truncated: false } : { phase: 'idle', rows: [], truncated: false })
      React.useEffect(() => {
        if (!name) {
          setState({ phase: 'idle', rows: [], truncated: false })
          return () => {}
        }
        let live = true
        fetch('/plugins/generate/providers/' + provider + '/results?name=' + encodeURIComponent(name))
          .then((answer) => (answer.ok ? answer.json() : Promise.reject(new Error('http-' + answer.status))))
          .then((body) => {
            if (live) setState({ phase: 'ready', rows: Array.isArray(body.rows) ? body.rows : [], truncated: body.truncated === true })
          })
          .catch(() => {
            // A failed read must not shout in the middle of a form: the strip draws nothing
            // and the run controls keep working.
            if (live) setState({ phase: 'failed', rows: [], truncated: false })
          })
        return () => {
          live = false
        }
      }, [provider, name, refreshKey])
      return state
    }

    /**
     * THE FILMSTRIP (epic 64 S3): one row per run, older ones scrolling off to the right, the
     * one whose picture is on the canvas marked.
     *
     * A row whose file is gone, or on a volume that is not mounted, STAYS and says so — a gap
     * in a series is information (the founder's rule). A row whose file moved to `_trash/`
     * never arrives here at all: the host drops it, because a delete is a decision about the
     * series.
     */
    function Filmstrip({ t, provider, results, selected, onUse }) {
      const rows = results.rows || []
      if (results.phase === 'loading') {
        return h('div', { style: S.strip, 'data-generate-strip': 'loading' }, h('span', { style: S.stripLabel }, t('strip.loading')))
      }
      if (results.phase === 'failed') return null
      return h(
        'div',
        { style: S.strip, 'data-generate-strip': rows.length === 0 ? 'empty' : 'yes' },
        h(
          'div',
          { style: S.stripHead },
          h('span', { style: S.stripCount }, t('strip.title')),
          rows.length > 0 ? h('span', { style: S.stripCount }, String(rows.length)) : null,
        ),
        rows.length === 0
          ? h('span', { style: S.stripLabel, 'data-generate-strip-none': 'yes' }, t('strip.none'))
          : h(
              'div',
              { style: S.stripRows },
              ...rows.map((row) => {
                const file = (row.files || [])[0] || null
                const state = file ? file.where : 'missing'
                const gone = state === 'missing' || state === 'offline'
                return h(
                  'button',
                  {
                    key: row.jobId,
                    type: 'button',
                    title: t('strip.row.title'),
                    'aria-label': t('strip.row.alt') + ' ' + row.jobId,
                    'data-generate-strip-row': row.jobId,
                    'data-generate-strip-state': gone ? state : 'present',
                    onClick: onUse(row),
                    style: { ...S.thumb, ...(selected === row.jobId ? S.thumbOn : null) },
                  },
                  gone
                    ? h('span', { style: S.thumbMissing, 'data-generate-strip-gone': state }, state === 'offline' ? t('strip.offline') : t('strip.missing'))
                    : h('img', {
                        style: S.thumbImage,
                        src: '/plugins/generate/providers/' + provider + '/result?job=' + encodeURIComponent(row.jobId) + '&i=' + file.i,
                        alt: '',
                        loading: 'lazy',
                        draggable: false,
                      }),
                )
              }),
            ),
      )
    }

    function WorkflowSurface({ t, provider, name, canUpload = false, runOption = null, continueRun = null }) {
      const { phase, adapter } = useWorkflow(provider, name)
      const [values, setValues] = React.useState({})
      const [showAdvanced, setShowAdvanced] = React.useState(false)
      // WHICH RESULT'S PICTURE IS ON THE CANVAS (epic 64 S3), and the values that came with it.
      // `undefined` is "nothing chosen yet" and `null` is "chosen, then cleared" — which matters
      // when a tab arrives already continuing a run: its row is selected until a person says
      // otherwise, and clicking it is how they say so.
      const [selectedRow, setSelectedRow] = React.useState(undefined)

      /**
       * DEPENDS ON THE ADAPTER ARRIVING: the doors are what the starting values come from.
       *
       * THE FORM OPENS CLEAN AT THE AUTHORED DEFAULTS. It used to merge whatever was last
       * typed on top of them, which is the behaviour the founder superseded (2026-09-25):
       * *"after finding the optimal settings that should be written to md as skill
       * instructions … they should not need to find optimal parameters by doing knob turning
       * again"* — so a measured optimum lives in the skill, in the adapter's `ui.defaults` and
       * in a handoff, and a one-off tweak lives in that run's own row, which is what clicking a
       * strip row brings back. The state route still exists and still writes (the host was
       * fixed for it), but nothing reads it back into a new form.
       */
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
       *
       * Every change is debounced to the host, which writes it to a file. The next time this
       * workflow opens, the saved values are loaded on top of the defaults.
       */
      const saveTimer = React.useRef(null)
      const set = (key) => (next) => {
        setValues((current) => {
          const updated = { ...current, [key]: next }
          // Debounce the save: in a real browser setTimeout exists; in a test sandbox it
          // may not, and that is fine — the test verifies the UI, not the persistence.
          if (typeof setTimeout === 'function') {
            if (saveTimer.current) clearTimeout(saveTimer.current)
            saveTimer.current = setTimeout(() => {
              fetch(`/plugins/generate/providers/${provider}/state`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ name: adapter.name, values: updated }),
              }).catch(() => {})
            }, 500)
          }
          return updated
        })
      }

      // THE WAY OUT IS THE HEADER'S "All workflows" TAB (founder, 2026-09-25): the surface
      // used to repeat it as a ← All workflows button at the top of the form, which was the
      // same control twice on one screen once the pane grew a tab row.

      // The run state is READ HERE, above the early return, because a hook may not be
      // called conditionally: the run outlives the loading phase, and a person who
      // started one keeps it while the surface re-renders around them.
      const run = useRun({ t, provider, adapter, values, runOption })

      /**
       * THE SESSION STARTS EMPTY WHEN YOU ARRIVE FROM THE CARD (founder, 2026-09-26: *"if you
       * arrive at the workflow from the card it should be empty, the session starts from empty
       * and if arrived from asset / regenerate it shows the session"*).
       *
       * So a workflow's history is NOT on screen by default, and the strip fills from two
       * directions: a run you do in this visit joins it (its job id is remembered the moment it
       * finishes), and a tab opened to CONTINUE one arrives with `params.run` and shows the whole
       * series with that run selected. This is the surface half of epic 64 S7 — the asset's own
       * Regenerate button is not built yet, and when it lands it needs only that param.
       */
      const continues = typeof continueRun === 'string' && continueRun !== ''
      const thisVisit = React.useRef([])
      React.useEffect(() => {
        if (run.phase === 'done' && run.jobId && !thisVisit.current.includes(run.jobId)) thisVisit.current = [...thisVisit.current, run.jobId]
      }, [run.phase, run.jobId])
      // A pending run is a reason to read; nothing has happened otherwise.
      const readName = adapter && (continues || thisVisit.current.length > 0 || run.phase === 'queued' || run.phase === 'running') ? adapter.name : null
      const results = useResults(provider, readName, run.phase === 'done' ? run.jobId : '')
      // The rows on screen: the whole series when continuing one, this visit's runs otherwise.
      const rows = continues ? results.rows || [] : (results.rows || []).filter((row) => thisVisit.current.includes(row.jobId))
      // A tab opened to continue a run selects it, so the canvas shows what the person came for.
      const selectedRowId = selectedRow === undefined ? (continues ? continueRun : null) : selectedRow
      const selected = selectedRowId ? rows.find((row) => row.jobId === selectedRowId) || null : null

      /**
       * REGENERATE (epic 64 S4): a row's own values go back into the form. NOTHING RUNS — the
       * gate is not bypassed, the press that spends is still the person's own — and the
       * picture on the canvas becomes that row's, so the values and the result they made are
       * read together.
       *
       * The values are keyed by the API's field name, which is the one string both providers'
       * bodies carry; a door whose value the record does not have keeps what is on the form.
       */
      const useRow = (row) => () => {
        setSelectedRow((current) => {
          const effective = current === undefined ? (continues ? continueRun : null) : current
          return effective === row.jobId ? null : row.jobId
        })
        if (!adapter) return
        const next = {}
        for (const key of Object.keys(adapter.doors)) {
          const door = adapter.doors[key]
          const byField = door && door.fieldName !== undefined ? row.values[String(door.fieldName)] : undefined
          const byKey = row.values[key]
          if (byField !== undefined) next[key] = byField
          else if (byKey !== undefined) next[key] = byKey
        }
        if (Object.keys(next).length > 0) setValues((current) => ({ ...current, ...next }))
      }

      if (phase !== 'ready' || !adapter) {
        return h(
          'div',
          { style: S.surface, 'data-generate-surface': phase },
          h('div', { style: S.hint }, phase === 'failed' ? t('surface.failed') : t('surface.loading')),
        )
      }

      const keys = doorsInOrder(adapter)
      const main = keys.filter((key) => adapter.doors[key].advanced !== true)
      const advanced = keys.filter((key) => adapter.doors[key].advanced === true)
      // The image doors in the order this form draws them, which is the order the composer's own
      // copies arrive in — see `waitFor` below and `ImageField`'s own note.
      const imageKeys = keys.filter((key) => adapter.doors[key].type === 'image')
      // Whether the preview card has anything to draw yet. It is the card's own fact: an
      // empty one keeps a panel's height, so opening a surface and starting a run do not
      // change the shape of the pane around them.
      const hasOutput =
        run.phase === 'queued' || run.phase === 'running' || run.phase === 'failed' || (run.phase === 'done' && Array.isArray(run.urls) && run.urls.length > 0)
      // The canvas's shape, from the workflow's own aspect door (see `previewShape`): the
      // same door that decides what the provider is asked for decides what the person sees.
      const shape = previewShape(adapter, values)
      const hasResult = run.phase === 'done' && Array.isArray(run.urls) && run.urls.length > 0
      // THE CANVAS FOLLOWS THE SELECTION (epic 64 S3): picking a row shows what that run
      // made, and picking it again goes back to the latest run's own picture.
      const selectedFile = selected && Array.isArray(selected.files) && selected.files.length > 0 ? selected.files[0] : null
      const selectedGone = !!selected && (!selectedFile || selectedFile.where === 'missing' || selectedFile.where === 'offline')
      const canvasSrc = selectedFile
        ? '/plugins/generate/providers/' + provider + '/result?job=' + encodeURIComponent(selected.jobId) + '&i=' + selectedFile.i
        : adapter.runnable === true && hasResult
          ? run.urls[0]
          : null

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
      const fieldControl = (id, doorKey, door, value, onValue, canUpload, waitFor = null) => {
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
          return h(ImageField, { id, doorKey, value, onChange: onValue, t, provider, canUpload, waitFor })
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

      /**
       * WHICH DOOR AN EMPTY IMAGE IS WAITING ON, by that door's own label. The rule looks only
       * BACKWARDS, so the first image door is never held back, and it looks only at EMPTY doors, so
       * nothing already chosen is ever taken away.
       */
      const filledImage = (key) => {
        const value = values[key] === undefined ? startFor(key, adapter.doors[key], adapter.defaults) : values[key]
        return value !== undefined && value !== null && String(value) !== ''
      }
      const waitFor = (key) => {
        if (adapter.doors[key].type !== 'image') return null
        const index = imageKeys.indexOf(key)
        if (index <= 0 || filledImage(key)) return null
        const earlier = imageKeys.slice(0, index).find((k) => !filledImage(k))
        return earlier === undefined ? null : adapter.doors[earlier].label
      }

      const control = (key) => {
        const door = adapter.doors[key]
        if (door.type === 'list') return listControl(key, door)
        const value = values[key] === undefined ? startFor(key, door, adapter.defaults) : values[key]
        return fieldControl('generate-door-' + key, key, door, value, set(key), canUpload, waitFor(key))
      }

      /**
       * THE PRESET MENU (founder, 2026-09-25: *"we should add sparkles icon to fill the prompt w
       * subject swap skill to make the work faster"*, then *"make a sparkles menu, sparkles
       * subject swap is a prompt writing skill, we can have other skill like face swap, add
       * object (add these others but greyed for now) I just want to test UI"*). The sparkle sits
       * on the label line of every door a preset fills and opens the harness's own `Menu` of the
       * presets that fill THAT door: one row each, the preset's own label, and a preset the
       * adapter marks `disabled` draws greyed and chooses nothing — which is how a skill that is
       * not written yet is shown without pretending it works.
       *
       * One press fills the doors and nothing else: no run, no spend, so it needs no gate. The
       * words are the workflow's own skill's, authored on the adapter, never invented here.
       */
      const presetsFor = (key) =>
        (adapter.presets || []).filter((preset) => preset && preset.doors && Object.prototype.hasOwnProperty.call(preset.doors, key))
      const applyPreset = (preset) => {
        for (const [door, presetValue] of Object.entries(preset.doors || {})) set(door)(presetValue)
      }
      const labelLine = (key) =>
        h(
          'div',
          { style: S.doorLabelRow },
          h('label', { style: S.label, htmlFor: 'generate-door-' + key }, adapter.doors[key].label),
          presetsFor(key).length > 0 ? h(PresetSparkle, { t, doorKey: key, presets: presetsFor(key), onApply: applyPreset }) : null,
        )

      const doorRow = (key) =>
        h(
          'div',
          { key, 'data-generate-door-row': key },
          labelLine(key),
          control(key),
          adapter.doors[key].hint ? h('div', { style: S.hint }, adapter.doors[key].hint) : null,
        )

      /**
       * Render a list of doors in order, but group every run of consecutive image doors
       * into one side-by-side row (founder: the two reference images sit on the same row).
       * A lone image door renders normally, and a non-image door always breaks a run.
       */
      const renderDoors = (keys) => {
        const elements = []
        let buffer = []
        const flush = () => {
          if (buffer.length === 0) return
          if (buffer.length === 1) {
            elements.push(doorRow(buffer[0]))
          } else {
            elements.push(
              h(
                'div',
                { style: S.imageGroup, 'data-generate-image-group': buffer.join('+') },
                buffer.map((key) =>
                  h(
                    'div',
                    { key, style: S.imageGroupItem, 'data-generate-door-row': key },
                    labelLine(key),
                    control(key),
                    adapter.doors[key].hint ? h('div', { style: S.hint }, adapter.doors[key].hint) : null,
                  ),
                ),
              ),
            )
          }
          buffer = []
        }
        for (const key of keys) {
          if (adapter.doors[key].type === 'image') {
            buffer.push(key)
          } else {
            flush()
            elements.push(doorRow(key))
          }
        }
        flush()
        return elements
      }

      return h(
        'div',
        { style: S.surface, 'data-generate-surface': 'ready', 'data-generate-unit': adapter.name, 'data-generate-provider': provider },
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
            ...renderDoors(main),
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
              canvasSrc !== null && !selectedGone
                ? h('img', { style: S.previewImage, src: canvasSrc, alt: t('run.result.alt'), 'data-generate-canvas': selected ? 'selected' : 'latest' })
                : null,
              // A row whose file is gone keeps its place on the canvas as a sentence rather
              // than as a broken image box.
              selectedGone
                ? h('span', { style: S.stripMissing, 'data-generate-canvas-gone': selectedFile ? selectedFile.where : 'missing' }, selectedFile && selectedFile.where === 'offline' ? t('strip.offline') : t('strip.missing'))
                : null,
            ),
            adapter.runnable === true
              ? h(RunOutput, { key: adapter.name + '-out', t, adapter, run })
              : h(Note, { text: t('surface.pending'), attrs: { 'data-generate-run-pending': 'yes' } }),
            // THE STRIP IS THE SESSION (epic 64 §6): under the picture, in the same card.
            h(Filmstrip, { t, provider, results: { ...results, rows }, selected: selectedRowId, onUse: useRow }),
            h(RunQueue, { t, run }),
          ),
        ),
      )
    }

    /**
     * The run: one click, the wait, and the result (S5).
     *
     * ONE CLICK SPENDS (founder, 2026-09-23: *"we don't need the confirmation modal,
     * click the button can just run the job"*). There is no dialog between the form and
     * the provider: pressing the run control posts the run immediately, and the strip in
     * the output column is what reports it. The host still refuses a call without
     * `confirmed: true` — the press is that confirmation — and it still refuses a payload
     * the API would reject, so an empty required door fails as a strip error rather than
     * as a dialog that used to block the button.
     *
     * THE KEY IS NOT HERE. Every call below is to this plugin's own host route; the host
     * reads the key from the credential store, builds the body, posts it, and answers with
     * a job id.
     *
     * MANY RUNS AT ONCE, AND EACH ONE OWNS ITSELF. The array is the state: a run in flight
     * keeps its own job id and its own start time, so the phase, the elapsed seconds and the
     * failure belong to that attempt and to no other. The latest run is the one the output
     * column draws; every one in flight is a row in the queue under it (founder, 2026-09-25:
     * *"the concurrency queue should be 1 row each so we can stop each one individually"*).
     * Krea's own message is shown verbatim on a failure, because a sentence this plugin
     * invented about someone else's error helps nobody.
     *
     * THE STATE IS A HOOK AND THE VIEW IS TWO PIECES (founder, 2026-09-23: *"2 column
     * parameters + output preview"*): the control that spends sits at the foot of the
     * parameters column, and the strip and the result sit in the output column beside it.
     * Splitting the state from both views is what lets one run be drawn in two places.
     */
    function useRun({ t, provider, adapter, values, runOption = null }) {
      /**
       * CONCURRENT RUNS: the provider may allow several jobs at once (RunningHub
       * allows 3). We track an array of runs; the latest one is the "active" run
       * shown in the output column. Pressing Generate always starts a new run.
       */
      const [runs, setRuns] = React.useState([])
      /**
       * EVERY RUN GETS A NAME OF ITS OWN (founder, 2026-09-25: *"the concurrency queue
       * should be 1 row each so we can stop each one individually"*). A start is an async
       * round trip, so two presses in the air at once would both write into whatever slot
       * happened to be last when the first answer landed; `localId` is what an answer is
       * matched against, and it is also the row's React key.
       */
      const runSeq = React.useRef(0)
      /** The most recent run — the one the output column and controls draw. */
      const run = runs.length > 0 ? runs[runs.length - 1] : { phase: 'form' }
      /**
       * THE RUN'S OWN MODE, when the provider declares one (RunningHub's `instanceType`).
       */
      const declared = runOption && Array.isArray(runOption.modes) && runOption.modes.length > 0 ? runOption : null
      const [mode, setMode] = React.useState(null)
      const modeId = declared ? mode || declared.fallback : null
      const options = declared ? { [declared.key]: modeId } : null

      /** Whether the LATEST run is still going. New runs are always allowed. */
      const inFlight = run.phase === 'starting' || run.phase === 'queued' || run.phase === 'running'

      /**
       * ASK to cancel ONE run, named by its own job id (founder, 2026-09-25: *"the
       * concurrency queue should be 1 row each so we can stop each one individually"*).
       * The first cut read the latest run's id off the closure, so a second job in flight
       * had no way to be stopped. The route has always taken a job id (lib/index.js's
       * cancel action), so the row that was pressed is the row that stops. One ask is in
       * the air at a time; `cancelBusy` is the id being asked about.
       */
      const [cancelBusy, setCancelBusy] = React.useState(null)
      const cancel = async (jobId) => {
        if (typeof jobId !== 'string' || jobId === '' || cancelBusy !== null) return
        setCancelBusy(jobId)
        try {
          await fetch(providerUrl(provider, 'cancel'), {
            method: 'POST',
            headers: { 'content-type': 'application/json', accept: 'application/json' },
            body: JSON.stringify({ jobId }),
          })
        } catch {
          // Network failure — the poll will settle the state.
        } finally {
          setCancelBusy(null)
        }
      }

      // Start a new run. Always allowed — the host queues them.
      const confirm = async () => {
        runSeq.current += 1
        const localId = 'run-' + runSeq.current
        setRuns((prev) => [...prev, { localId, phase: 'starting', startedAt: Date.now() }])
        const started = await postRun(provider, adapter.name, values, options)
        setRuns((prev) =>
          prev.map((r) =>
            r.localId !== localId
              ? r
              : started.ok
                ? { ...r, phase: 'queued', jobId: started.jobId }
                : { ...r, phase: 'failed', error: started.error, detail: started.detail, finishedAt: Date.now() },
          ),
        )
      }

      // QUEUE BAND. The host reads the account's queue while a job is in flight.
      const [queue, setQueue] = React.useState(null)
      const anyInFlight = runs.some((r) => r.phase === 'starting' || r.phase === 'queued' || r.phase === 'running')
      React.useEffect(() => {
        if (!anyInFlight || !provider) return undefined
        let live = true
        const pollQueue = async () => {
          try {
            const response = await fetch(providerUrl(provider, 'queue'), { headers: { accept: 'application/json' } })
            if (!response.ok || !live) return
            const body = await response.json()
            if (body && typeof body.running === 'number') setQueue(body)
          } catch {
            // Endpoint is marked "developing" — a failure is no answer, not an error.
          }
        }
        pollQueue()
        const timer = setInterval(pollQueue, 5000)
        return () => { live = false; clearInterval(timer) }
      }, [anyInFlight, provider])
      React.useEffect(() => {
        if (!anyInFlight) setQueue(null)
      }, [anyInFlight])

      /**
       * THE POLL: ONE TIMER, EVERY JOB IN FLIGHT (founder, 2026-09-25: *"the concurrency
       * queue should be 1 row each so we can stop each one individually"*). The first cut
       * polled only the latest run, so a second and a third job were invisible until the
       * one before them settled. Each id is now read and settled on its own terms, and the
       * effect re-arms when the set of in-flight ids changes — which is exactly when the
       * set of rows to poll changes too.
       */
      const pollIds = runs
        .filter((r) => typeof r.jobId === 'string' && r.jobId !== '' && (r.phase === 'queued' || r.phase === 'running'))
        .map((r) => r.jobId)
      const pollKey = pollIds.join(',')
      React.useEffect(() => {
        const ids = pollKey === '' ? [] : pollKey.split(',')
        if (ids.length === 0) return undefined
        let live = true
        const settled = new Set()
        const tick = async () => {
          for (const jobId of ids) {
            if (settled.has(jobId)) continue
            const read = await readRun(provider, jobId)
            if (!live) return
            if (!read.ok) {
              settled.add(jobId)
              setRuns((prev) => prev.map((r) => (r.jobId === jobId ? { ...r, phase: 'failed', finishedAt: Date.now(), error: read.error } : r)))
              continue
            }
            if (read.state === 'cancelled') {
              settled.add(jobId)
              setRuns((prev) => prev.map((r) => (r.jobId === jobId ? { ...r, phase: 'cancelled', finishedAt: Date.now() } : r)))
              continue
            }
            if (read.state === 'done') {
              settled.add(jobId)
              setRuns((prev) => prev.map((r) => (r.jobId === jobId ? { ...r, phase: 'done', finishedAt: Date.now(), urls: read.urls, saved: read.saved } : r)))
              continue
            }
            if (read.state === 'failed') {
              settled.add(jobId)
              setRuns((prev) => prev.map((r) =>
                r.jobId === jobId
                  ? { ...r, phase: 'failed', finishedAt: Date.now(), status: read.status, message: read.error && read.error.message ? String(read.error.message) : null }
                  : r,
              ))
              continue
            }
            setRuns((prev) => prev.map((r) => (r.jobId === jobId ? { ...r, phase: read.state } : r)))
          }
        }
        tick()
        const timer = setInterval(tick, 2000)
        return () => { live = false; clearInterval(timer) }
      }, [pollKey, provider])

      const elapsed = run.startedAt ? Math.max(0, Math.round(((run.finishedAt || Date.now()) - run.startedAt) / 1000)) : 0
      return {
        ...run,
        elapsed,
        // Every run, oldest first, so the queue list can draw one row per job.
        runs,
        confirm,
        inFlight,
        anyInFlight,
        cancel,
        cancelBusy,
        queue,
        // The provider's run option, and the mode chosen in it. A provider that declares
        // none gives `runOption: null` and the surface draws a plain run button.
        runOption: declared,
        mode: modeId,
        setMode,
        // NO "RUN AGAIN" CONTROL (founder, 2026-09-23: *"run again button can be
        // removed"*): the parameters card never leaves the screen, so the Run button
        // under the doors IS the way to run again — press it and `confirm` starts the
        // next run with the values still in the form.
      }
    }

    /** The foot of the parameters column: the control that spends. */
    function RunControl({ t, adapter, run }) {
      if (!adapter) return null
      const runLabel = adapter.runLabel || t('run.action')
      // Always enabled: the host queues concurrent runs. The label changes while
      // the latest run is starting.
      const label = run.phase === 'starting' ? t('run.starting') : runLabel
      return h(
        'div',
        { style: S.runBlock, 'data-generate-run-block': adapter.name },
        run.runOption
          ? h(SplitButton, {
              t,
              label,
              modes: run.runOption.modes,
              value: run.mode,
              onValue: run.setMode,
              disabled: false,
              onClick: run.confirm,
              attrs: { 'data-generate-run': adapter.name, 'data-generate-run-mode': run.runOption.key },
            })
          : h(
              'button',
              {
                type: 'button',
                style: { ...S.primary, alignSelf: 'flex-start' },
                'data-generate-run': adapter.name,
                disabled: false,
                onClick: run.confirm,
              },
              label,
            ),
      )
    }

    /** The preview card's content: the phase, the failure, and the result. */
    function RunOutput({ t, adapter, run }) {
      const [finderBusy, setFinderBusy] = React.useState(false)
      const [finderFailed, setFinderFailed] = React.useState(false)
      if (!adapter) return null
      // The local file is the primary handle on a finished run; the provider URL is
      // only a fallback, so "has a file" is the branch the whole result row keys on.
      const hasLocalFile = run.phase === 'done' && Array.isArray(run.saved) && run.saved.length > 0 && !!run.saved[0].file
      // Select the saved file in Finder. Fire-and-report: the host answers whether
      // the helper started, and a failure stays on this row rather than anywhere else.
      const revealResult = async () => {
        setFinderBusy(true)
        setFinderFailed(false)
        try {
          const response = await fetch(LIBRARY_API, {
            method: 'POST',
            headers: { 'content-type': 'application/json', accept: 'application/json' },
            body: JSON.stringify({ action: 'reveal', file: run.saved[0].file }),
          })
          if (!response.ok) setFinderFailed(true)
        } catch {
          setFinderFailed(true)
        } finally {
          setFinderBusy(false)
        }
      }
      return h(
        'div',
        { style: S.runOutput },
        run.phase === 'queued' || run.phase === 'running'
          ? h(
              'div',
              { style: S.runStrip, 'data-generate-run-strip': run.phase },
              // Left of the phase, the harness's own loading glyph spinning on the class
              // this bundle injects (founder, 2026-09-23: *"add spinner to left of
              // Running"*).
              h(
                'span',
                { style: S.runSpin, 'data-generate-run-spin': run.phase, 'aria-hidden': true },
                h(IconLoadingOutline16, { size: 14, className: 'dsh-generate-spin' }),
              ),
              h('span', { style: S.runPhase }, t('run.phase.' + run.phase)),
              h('span', { style: S.runMeta, 'data-generate-run-elapsed': String(run.elapsed) }, run.elapsed + 's'),
              run.jobId ? h('span', { style: S.runMeta, 'data-generate-run-job': run.jobId }, t('run.job') + ' ' + run.jobId) : null,
              // STOP IT (founder, 2026-09-25: *"it seems like cancel button got removed"*). The
              // host route and `useRun`'s own `cancel` were both there; the control was not drawn,
              // so a run in flight had no way out on screen. It sits at the strip's end because the
              // phase, the clock and the job id are what a person reads, and this is what they press.
              h(
                'button',
                {
                  type: 'button',
                  style: { ...S.ghost, marginLeft: 'auto' },
                  'data-generate-run-cancel': run.jobId || 'yes',
                  disabled: run.cancelBusy !== null,
                  onClick: () => run.cancel(run.jobId),
                },
                run.cancelBusy === run.jobId ? t('run.canceling') : t('run.cancel'),
              ),
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
        // OPEN IN FINDER, not in the browser (founder, 2026-09-23: *"Open the image
        // opens in browser, but its more useful to open in finder"*): when the host
        // saved a local file, the control selects that file in Finder. The browser
        // link survives only as the fallback for a run whose save failed — the URL
        // is then the only thing that still exists.
        run.phase === 'done' && hasLocalFile
          ? h(
              'div',
              { style: { display: 'flex', flexDirection: 'column', gap: 4 } },
              h(
                'button',
                {
                  type: 'button',
                  style: { ...S.ghost, alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 4 },
                  'data-generate-result-finder': run.saved[0].file,
                  disabled: finderBusy,
                  onClick: revealResult,
                },
                t('run.result.finder'),
                h(IconRightUpOutline16, { size: 12 }),
              ),
              finderFailed
                ? h('div', { style: S.fieldError, role: 'alert', 'data-generate-result-finder-failed': 'yes' }, t('run.result.finderFailed'))
                : null,
            )
          : null,
        run.phase === 'done' && !hasLocalFile && Array.isArray(run.urls) && run.urls.length > 0
          ? h(
              'div',
              { style: S.row },
              h(
                'a',
                { style: S.runLink, href: run.urls[0], target: '_blank', rel: 'noreferrer', 'data-generate-result-url': run.urls[0] },
                t('run.result.open'),
                h(IconRightUpOutline16, { size: 12 }),
              ),
            )
          : null,
      )
    }

    /**
     * Queue band: how many tasks this provider's account is running and queuing,
     * plus the concurrency ceiling. Only drawn when a run is in flight (founder,
     * 2026-09-23: *"a queue component under the preview card"*).
     */
    function QueueBand({ t, run }) {
      if (!run.queue) return null
      const q = run.queue
      return h(
        'div',
        { style: { display: 'flex', gap: 12, padding: '4px 0', fontSize: 12, color: 'var(--dsw-alias-label-secondary)' }, 'data-generate-queue-band': true },
        typeof q.running === 'number' ? h('span', { 'data-generate-queue-running': String(q.running) }, t('queue.running').replace('{n}', String(q.running))) : null,
        typeof q.queued === 'number' && q.queued > 0 ? h('span', { 'data-generate-queue-queued': String(q.queued) }, t('queue.queued').replace('{n}', String(q.queued))) : null,
        typeof q.limit === 'number' ? h('span', { 'data-generate-queue-limit': String(q.limit) }, t('queue.limit').replace('{n}', String(q.limit))) : null,
      )
    }

    /**
     * THE QUEUE, ONE ROW PER JOB (founder, 2026-09-25: *"the concurrency queue should be
     * 1 row each so we can stop each one individually"*).
     *
     * Before this slice only the latest run had a face on screen: a second and third press
     * against a provider that allows three at once were invisible, and the one Cancel in
     * the strip could only ever reach the last of them. Every run in flight is now its own
     * row, with its own phase, its own clock, its own id and its own Stop.
     *
     * THE COUNTS AND THE ROWS ARE TWO DIFFERENT FACTS. The band above the rows is the
     * ACCOUNT's queue, which counts jobs this pane did not start (another tab, the
     * provider's own site); the rows are this surface's own jobs, in the order they were
     * started. They are drawn together and never reconciled — a provider that will not
     * answer leaves the band out and the rows intact.
     *
     * ONLY WHAT IS IN FLIGHT IS A ROW. A settled run is a result, and a result belongs in
     * the canvas and, next, in the strip under it — not in a queue.
     */
    function RunQueue({ t, run }) {
      const all = Array.isArray(run.runs) ? run.runs : []
      const rows = all.filter((r) => r.phase === 'starting' || r.phase === 'queued' || r.phase === 'running')
      const band = h(QueueBand, { t, run })
      if (rows.length === 0) return band
      return h(
        'div',
        { style: S.queueList, 'data-generate-queue-list': String(rows.length) },
        band,
        ...rows.map((row) =>
          h(RunQueueRow, {
            key: row.localId || row.jobId || String(row.startedAt),
            t,
            row,
            anyBusy: run.cancelBusy !== null,
            cancelBusy: run.cancelBusy,
            onCancel: run.cancel,
          }),
        ),
      )
    }

    /**
     * One job in the queue: what it is doing, how long it has been doing it, which job it
     * is, and the way to stop THIS one. A job still in `starting` has no id to stop yet,
     * so its Stop is drawn disabled rather than silently doing nothing.
     */
    function RunQueueRow({ t, row, cancelBusy, anyBusy, onCancel }) {
      const elapsed = row.startedAt ? Math.max(0, Math.round(((row.finishedAt || Date.now()) - row.startedAt) / 1000)) : 0
      return h(
        'div',
        { style: S.queueRow, 'data-generate-queue-row': row.jobId || 'starting' },
        h(
          'span',
          { style: S.runSpin, 'aria-hidden': true },
          h(IconLoadingOutline16, { size: 12, className: 'dsh-generate-spin' }),
        ),
        h('span', { style: S.runPhase }, row.phase === 'starting' ? t('run.starting') : t('run.phase.' + row.phase)),
        h('span', { style: S.runMeta, 'data-generate-queue-elapsed': String(elapsed) }, elapsed + 's'),
        row.jobId ? h('span', { style: S.runMeta, 'data-generate-queue-job': row.jobId }, t('run.job') + ' ' + row.jobId) : null,
        h(
          'button',
          {
            type: 'button',
            style: { ...S.ghost, marginLeft: 'auto' },
            'data-generate-queue-stop': row.jobId || 'starting',
            disabled: anyBusy || !row.jobId,
            onClick: () => onCancel(row.jobId),
          },
          cancelBusy === row.jobId ? t('run.canceling') : t('run.cancel'),
        ),
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
     * One provider's block on the home: a caption line that names it, a facts line that
     * says what it holds, and its workflows under them as the guide's own entries.
     *
     * ONE BLOCK PER PROVIDER, ALL OF THEM (founder, 2026-09-23). A provider with nothing
     * installed is still a block, because the facts line is where its add control lives:
     * an install that showed only the providers that already work could never be filled.
     * A provider whose list could not be read says so instead of showing the empty
     * state, because "nothing installed" and "nothing answered" are different facts.
     *
     * NOTHING FOLDS AND NOTHING IS BOXED (founder, 2026-09-25: *"it should be minimal like
     * start surface and make like dashboard"*). The section card, its chevron and its
     * toggle are gone: a block is a caption, a facts line and the entries, drawn on the
     * page's own background the way the Start surface's are.
     */
    function ProviderGroup({ t, provider, units, failed, onOpen, onRefresh }) {
      // Whether this block's install prompt is open. It lives here because the control that
      // opens it is on the facts line and the popover it opens belongs to this block.
      const [addShown, setAddShown] = React.useState(false)
      // Where the popover lands, and what closes it, are the app's own two rules — see the
      // destructure at the top of this module. The anchor is the wrapper AROUND the add
      // glyph, because the harness's `Button` forwards no ref; the root is the block, which
      // holds both the glyph and the panel, so a click on either counts as inside.
      const groupRef = React.useRef(null)
      const addRef = React.useRef(null)
      const popoverRef = React.useRef(null)
      const popoverAt = useAnchoredPosition({
        open: addShown,
        anchorRef: addRef,
        panelRef: popoverRef,
        side: 'bottom',
        align: 'end',
        gap: 8,
      })
      useDismissOnOutsidePointer(groupRef, addShown, setAddShown, popoverRef)
      // Escape closes it, the way it closes every other floating surface in the app.
      React.useEffect(() => {
        if (!addShown) return
        const onKey = (event) => {
          if (event.key === 'Escape') setAddShown(false)
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
      }, [addShown])
      // The account arrow's hover colour, swapped from state the way the workflow
      // cards do theirs: an inline style carries no `:hover` (founder, 2026-09-23:
      // *"add onhover on the website link arrow to theme primary token color"*).
      const [accountHover, accountHoverProps] = useHover()
      // The caption's light (founder, 2026-09-23): green when the block is ready to run,
      // amber when a key is there and the block still is not ready — nothing installed
      // yet, or a key the provider never confirmed — and red when there is no usable key.
      // Three colours, four sentences: the colour is the state, the sentence is its
      // tooltip, and an unconfirmed key is not the same fact as an empty block.
      const look = providerState(provider).state
      const light = look === 'none' || look === 'refused' ? 'noKey' : look === 'ok' ? (units.length > 0 ? 'ready' : 'keyOnly') : 'unchecked'
      const lightStyle = { ready: S.dotOk, keyOnly: S.dotWarn, unchecked: S.dotWarn, noKey: S.dotBad }[light]
      const lightText = {
        ready: t('pane.light.ready'),
        keyOnly: t('pane.light.keyOnly'),
        unchecked: t('settings.linked.unverified'),
        noKey: t('pane.light.noKey'),
      }[light]
      // The wallet, read once: the balance where the provider has a balance route, and
      // the sentence the read produced where it has none.
      const parts = balanceParts(t, provider)
      return h(
        'div',
        { ref: groupRef, style: S.section, 'data-generate-section-wrap': provider.id },
        // The caption line: the light, then the provider's name with the glyph that leads
        // to its own page. It carries ONLY those — everything else it used to hold lives
        // on the facts line under it.
        h(
          'div',
          {
            style: S.sectionHead,
            'data-generate-section': provider.id,
            'data-generate-section-head': provider.id,
          },
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
              // belongs to (founder, 2026-09-23). The row is not a toggle any more, so
              // this click no longer needs to stop one.
              provider.accountUrl
                ? h(
                    'a',
                    {
                      href: provider.accountUrl,
                      target: '_blank',
                      rel: 'noreferrer',
                      // Under the pointer the arrow paints the theme's primary; at rest
                      // it keeps the same tertiary ink it always had.
                      style: accountHover
                        ? { ...S.sectionAccountIcon, color: 'var(--dsw-alias-brand-primary)' }
                        : S.sectionAccountIcon,
                      title: t('settings.account'),
                      'aria-label': t('settings.account'),
                      'data-generate-account': provider.id,
                      ...accountHoverProps,
                    },
                    h(IconRightUpOutline16, { size: 12 }),
                  )
                : null,
            ),
          ),
        ),
        // THE FACTS LINE: the balance, then the add and refresh glyphs — the items the
        // subheader band carried, without the hairlines that made the page read as a form,
        // and without the count line the founder had removed (2026-09-25).
        h(
          'div',
          { style: S.sectionFacts, 'data-generate-section-facts': provider.id },
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
              // THE PROVENANCE LINE IS GONE (founder, 2026-09-25: *"remove stored on this
              // machine"*): `stored on this machine` and `from your environment` were the
              // seam's vocabulary printed at a person, and neither changes what they can do
              // here. What stays is what does: a key this page cannot change, and the
              // provider's own note when there is one to give.
              provider.writable === false ? t('settings.readOnly') : null,
              provider.note ? t('note.' + provider.note) : null,
            ),
          ),
          // The block's own controls: add a workflow, then re-read the block. Both are
          // glyphs, so both carry a hover tooltip (the harness's own bubble, not a native
          // `title`) and an `aria-label` — the bubble is the sighted answer, the label is
          // the one a screen reader reads (founder, 2026-09-23: *"add tooltip on hover for
          // both"*).
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
                    { ref: addRef, style: S.tipAnchor, 'data-generate-add-tip': provider.id },
                    h(Button, {
                      variant: 'ghost',
                      size: 'sm',
                      icon: h(IconPlusOutline16, { size: 14 }),
                      'aria-label': t('pane.add.button'),
                      'aria-expanded': addShown ? 'true' : 'false',
                      'aria-haspopup': 'dialog',
                      'data-generate-add-button': provider.id,
                      style: { flex: 'none' },
                      onClick: () => setAddShown(!addShown),
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
        // The body: this provider's workflows as the guide's entries, and the sentence that
        // says there are none. The install prompt is no longer part of it — it floats in
        // the popover below, so opening it cannot re-flow the cards.
        h(
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
                  // that says so and names the facts line's glyph that fixes it, because
                  // the add control is not here to explain itself.
                  ...(units.length === 0 ? { 'data-generate-none': provider.id } : {}),
                },
                units.map((unit) => h(UnitCard, { key: unit.name, t, unit, onOpen })),
                units.length === 0
                  ? h('div', { style: S.hint, 'data-generate-section-empty': provider.id }, t('pane.section.empty'))
                  : null,
              ),
        ),
        // THE POPOVER: the prompt the add glyph opens, on the app's own menu card. It is a
        // child of the block so a pointerdown inside it counts as inside the trigger's root,
        // and `position: fixed` puts it over the pane rather than inside its scroll box.
        addShown
          ? h(
              'div',
              {
                ref: popoverRef,
                role: 'dialog',
                'aria-label': t('pane.add.button'),
                style: popoverAt
                  ? { ...S.popover, left: popoverAt.left, top: popoverAt.top }
                  // Before the first measurement it is laid out but unpainted, so the card
                  // never flashes at the top-left corner of the window.
                  : { ...S.popover, visibility: 'hidden' },
                'data-generate-add-popover': provider.id,
              },
              h(AddPromptPanel, { t, provider }),
            )
          : null,
      )
    }

    /**
     * ONE WORKFLOW HEADER (founder, 2026-09-25: *"then below that are the generate workflows
     * headers … styling for tab is: selected=border; unselected=no border"*).
     *
     * A component rather than a builder inside the pane, because a tab owns hover state and
     * a hook may not be called from a loop: React counts hooks by position, and the row's
     * length changes every time a tab opens or closes.
     *
     * The pill is the harness `Button`'s own `sm` capsule geometry (28px tall, a 14px radius,
     * 12px text), with the label and the close as separate controls inside it — a button may
     * not contain a button, so the tab is the box and the two things you can click are the
     * children. The SELECTED tab draws the primitive's `outline` border; an unselected one
     * keeps the same border transparent, so switching tabs moves no pixel.
     *
     * Every tab here stands for an open workflow, so every one of them closes: the start
     * screen is not a tab (see the header's own comment), and it is reached with the plus.
     *
     * THE CLOSE IS HIDDEN ON AN UNSELECTED TAB (founder, 2026-09-25, with the row on screen:
     * *"the pattern in dsh is when the tab is unselected there is no close icon"*). The row of
     * `×` glyphs beside every name is what the founder saw. The app's own tab carries the rule
     * in `_tabClose_11olo_411` — `opacity:0; pointer-events:none` at rest, revealed by
     * `:hover`, `:focus-within` or the active tab — and this is that rule, moved to the class
     * `.dsh-generate-tabClose` in the one injected sheet, because `:hover` and `:focus-within`
     * are the two things inline styles cannot express. The close keeps its box either way (the
     * rule hides it, it does not remove it), so a tab never changes width when it is selected.
     */
    function WorkflowTab({ t, label, selected, name, onOpen, onClose }) {
      const [hover, hoverProps] = useHover()
      return h(
        'div',
        {
          style: {
            ...S.tab,
            ...(selected ? S.tabSelected : null),
            ...(hover && !selected ? S.tabHover : null),
          },
          'data-generate-tab-pill': name,
          'data-generate-tab-selected': selected ? 'yes' : 'no',
          ...hoverProps,
        },
        h(
          'button',
          {
            type: 'button',
            style: S.tabLabel,
            title: label,
            'data-generate-tab': name,
            onClick: onOpen,
          },
          label,
        ),
        h(
          'button',
          {
            type: 'button',
            style: S.tabClose,
            // Hidden until this tab is selected, hovered or focused — the app's own rule, in
            // the injected sheet (see this component's comment).
            className: 'dsh-generate-tabClose',
            'aria-label': t('tabs.close'),
            title: t('tabs.close'),
            'data-generate-tab-close': name,
            onClick: onClose,
          },
          '×',
        ),
      )
    }

    function GeneratePane(props) {
      const t = translatorOf(props)
      const providers = useProviders()
      const units = useWorkflows(providers.providers)
      /**
       * MULTI-WORKFLOW TABS: each opened workflow becomes a keep-alive tab.
       * `openTabs` is an array of `{ provider, name }` objects. `activeTab` is the
       * name of the visible tab, or `null` to show the card grid. All open surfaces
       * stay mounted (CSS visibility only) so form values and run state persist.
       */
      const [openTabs, setOpenTabs] = React.useState([])
      const [activeTab, setActiveTab] = React.useState(null)

      // A tab may be opened at a unit by an opener that passed `params.unit` — and
      // `params.provider` when there is more than one place it could live.
      const tab = typeof props.useTabInfo === 'function' ? props.useTabInfo() : null
      const params = tab && tab.tab && tab.tab.navigation ? tab.tab.navigation.params : null
      const asked = params && typeof params.unit === 'string' ? params.unit : null
      const askedProvider = params && typeof params.provider === 'string' ? params.provider : null
      // WHICH RUN TO CONTINUE, when the tab was opened from an ASSET rather than from a card
      // (epic 63's Regenerate: `openTab('generate', { params: { run: jobId } })`). Absent means
      // a person came in through the guide card, and the session starts empty.
      const askedRun = params && typeof params.run === 'string' && params.run.trim() !== '' ? params.run.trim() : null

      // Open a workflow tab: add it to the list if not already there, activate it.
      const openWorkflow = React.useCallback((providerId, name) => {
        setOpenTabs((prev) => {
          const exists = prev.some((t) => t.provider === providerId && t.name === name)
          return exists ? prev : [...prev, { provider: providerId, name }]
        })
        setActiveTab(name)
      }, [])

      // Close a workflow tab: remove it and switch to the card grid.
      const closeTab = React.useCallback((name) => {
        setOpenTabs((prev) => prev.filter((t) => t.name !== name))
        setActiveTab((current) => (current === name ? null : current))
      }, [])

      // Handle external opener (params.unit from a guide card). Runs synchronously
      // during render so the surface is visible on the first paint.
      if (asked !== null && openTabs.every((t) => t.name !== asked)) {
        const unit = units.units.find((u) => u.name === asked && (askedProvider === null || u.provider === askedProvider))
        if (unit) {
          openTabs.push({ provider: unit.provider, name: unit.name })
          // Sync the active tab without a state update (we are in render).
          setActiveTab(unit.name)
        }
      }

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
      // Every provider shows at once, in registry order, and nothing folds.
      const unitsOf = (id) => units.units.filter((unit) => unit.provider === id)

      /**
       * A TAB IS NAMED BY ITS WORKFLOW, NOT BY ITS FILE (founder, 2026-09-25): the adapter
       * name is what the file is called, and on screen two Qwen apps truncated to the same
       * "qwen-2-1-image-e…". The unit carries the title, so the title is the label, and the
       * name is only the fallback for a tab whose adapter has since gone.
       *
       * A WORKFLOW MAY CARRY A SHORT LABEL FOR THE TAB (founder, the same day: *"the workflow
       * tab fontsize too big, maybe we need to use different names in to make it easier to
       * read. Qwen Duo / Qwen Multi / H3 F/L / Krea Raw / Krea Turbo / Krea Medium / Krea
       * Large"*). The card keeps the name the workflow was given — a card is 380px wide and
       * the name was chosen for it — and the narrow tab reads `ui.tabLabel` when the adapter
       * authors one, falling back to that same title.
       */
      const labelOf = (open) => {
        const unit = units.units.find((candidate) => candidate.provider === open.provider && candidate.name === open.name)
        if (!unit) return open.name
        return unit.tabLabel || unit.title
      }

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
        { style: S.root, 'data-generate-pane': activeTab === null ? 'home' : 'unit' },
        // The link just happened.
        saved && activeTab === null ? h(SaveDialog, { t, provider: saved, onClose: providers.forget }) : null,
        linked
          .filter((provider) => provider.error)
          .map((provider) =>
            h(
              'div',
              { key: provider.id, style: S.warn, role: 'alert' },
              h(IconWarningOutline16, { size: 14 }),
              h('span', null, provider.error === 'invalid-key' ? t('error.storedKeyRejected') : errorText(t, provider.error)),
            ),
          ),
        // THE HEADER: THE DSH STRIP'S OWN PATTERN, ONE ROW LOWER (founder, 2026-09-25:
        // *"the separator is below the dsh tabs. then below that are the generate workflows
        // headers … styling for tab is: selected=border; unselected=no border. then add
        // button like dsh pattern"*, then *"the dsh pattern does not have all workflows, it
        // uses add button to create new tab and uses start screen to add the tab. we can
        // follow that pattern"* and *"same navigation but below the dsh navigation. same
        // pattern but below the separator"*).
        //
        // So the row carries TABS OF OPEN WORKFLOWS and a plus, exactly as the strip above it
        // carries tabs of open pages and a plus — no "All workflows" tab, because DSH has no
        // such tab either. DSH's `addTab` opens the GUIDE tab, the start screen where a page
        // is chosen and its tab made (`openTab(GUIDE_KIND, …)` in the sidebar's own actions);
        // this plus does the same thing one level down: it shows the start screen — the
        // workflow grid — and a card there is what opens a workflow's tab.
        //
        // The separator above this row is the DSH strip's own, so the row draws none of its
        // own: the workflow headers are the first thing under that line.
        //
        // THE ROW IS ONLY THERE WHEN A WORKFLOW IS OPEN (founder, 2026-09-25: *"we don't need
        // add icon here"*, on the start screen with a lone plus on an otherwise empty strip).
        // The start screen is not a tab and needs nothing beside it, so with nothing open the
        // pane goes straight from the separator to the grid. The plus stays where it means
        // something: it is how a person gets back to that start screen from a workflow.
        openTabs.length > 0
          ? h(
              'div',
              { style: S.tabsBar, 'data-generate-header': 'yes' },
              // One tab per opened workflow, named by its title (see `labelOf`).
              ...openTabs.map((wt) =>
                h(WorkflowTab, {
                  key: wt.name,
                  t,
                  label: labelOf(wt),
                  selected: activeTab === wt.name,
                  name: wt.name,
                  onOpen: () => setActiveTab(wt.name),
                  onClose: () => closeTab(wt.name),
                }),
              ),
              // THE ADD BUTTON, the DSH pattern: the plus that leads to the start screen, and
              // it SAYS SO (founder, 2026-09-25: *"lets change + to +add to keep disinction"*)
              // — a bare plus reads as the DSH strip's own add above it, and this one is not
              // that: it opens the pane's start screen, where a workflow is chosen. The glyph
              // carries the meaning and the word names it; the accessible name stays the whole
              // sentence.
              //
              // AND IT WEARS THE SAME STATE A TAB DOES (founder, the same day: *"when I click +
              // there should be border if we follow pattern"*): while the start screen is what
              // the pane is showing, it draws the primitive's own `outline` pair — the exact
              // border a selected tab draws — so "which view am I on" reads the same on both
              // controls. With a workflow selected it is a plain ghost.
              h(
                'span',
                { style: S.tipAnchor, 'data-generate-add-tab': 'yes' },
                h(
                  Button,
                  {
                    variant: activeTab === null ? 'outline' : 'ghost',
                    size: 'sm',
                    icon: h(IconPlusOutline16, { size: 14 }),
                    'aria-label': t('tabs.add'),
                    title: t('tabs.add'),
                    'data-generate-tab-add': 'yes',
                    onClick: () => setActiveTab(null),
                  },
                  t('tabs.addLabel'),
                ),
              ),
            )
          : null,
        // THE DASHBOARD: visible when no tab is active. One block per provider — the
        // caption, the facts, the entries — separated by air, not by hairlines.
        activeTab === null
          ? h(
              'div',
              { style: S.sections, 'data-generate-sections': String(shown.length) },
              units.phase === 'failed'
                ? h(
                    'div',
                    { style: S.empty, 'data-generate-list-failed': 'yes' },
                    h(GenerateMark, null),
                    h('div', { style: S.title }, t('pane.list.failed')),
                  )
                : null,
              shown.map((provider) =>
                h(ProviderGroup, {
                  key: provider.id,
                  t,
                  provider,
                  units: unitsOf(provider.id),
                  failed: units.phase === 'failed' || units.failed.indexOf(provider.id) !== -1,
                  onOpen: (id, name) => openWorkflow(id, name),
                  onRefresh: () => {
                    providers.load()
                    units.reload()
                  },
                }),
              ),
            )
          : null,
        // KEEP-ALIVE WORKFLOW SURFACES: every open tab stays mounted; only the active
        // one is visible. This preserves form values and run state when switching tabs.
        ...openTabs.map((wt) =>
          h('div', {
            key: 'surface-' + wt.name,
            style: { display: activeTab === wt.name ? 'block' : 'none' },
            'data-generate-surface-wrapper': wt.name,
          },
            h(WorkflowSurface, {
              t,
              provider: wt.provider,
              name: wt.name,
              canUpload: !!((providers.providers || []).find((row) => row.id === wt.provider) || {}).upload,
              runOption: ((providers.providers || []).find((row) => row.id === wt.provider) || {}).runOption || null,
              // The tab's own `params.run` travels down as the session to continue.
              continueRun: askedRun,
            }),
          ),
        ),
        activeTab === null
          ? h(
              'div',
              { style: S.sectionNotes },
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
    /**
     * WHERE FINISHED RUNS LAND (founder, 2026-09-23: *"let's make save folder default
     * on desktop, and the user can click to choose a different folder. in capture one
     * its like this, click on icon to open finder"*).
     *
     * The Capture One shape: one path line that says where saves go, clickable to open
     * the OS folder dialog (`{ action: 'choose' }`), an arrow glyph beside it that
     * reveals the folder in Finder (`{ action: 'reveal' }`), and the "Space left"
     * number under it. The default root is the Desktop; a host with no dialog
     * (`canChoose: false`) still shows the path as text and keeps the typed input
     * below as the way to choose. The input stays for a path nobody wants to click
     * through to, and the host validates either way — this row never claims a folder
     * the host refused.
     */
    function LibraryFolder({ t, library }) {
      const [value, setValue] = React.useState('')
      const [current, setCurrent] = React.useState(null)
      const [state, setState] = React.useState('idle')
      const shown = current || library || null
      // Seed the input once from the host's answer, without clobbering what is typed.
      const seeded = React.useRef(false)
      React.useEffect(() => {
        if (seeded.current || !library) return
        seeded.current = true
        setValue(typeof library.path === 'string' ? library.path : '')
      }, [library])

      const post = async (payload) => {
        setState('saving')
        try {
          const response = await fetch(LIBRARY_API, {
            method: 'POST',
            headers: { 'content-type': 'application/json', accept: 'application/json' },
            body: JSON.stringify(payload),
          })
          const body = await response.json()
          if (!response.ok || !body || !body.root) {
            setState('failed')
            return
          }
          setCurrent(body)
          // A folder picked in the dialog lands in the input too, so the two ways to
          // choose never show different paths.
          setValue(typeof body.path === 'string' ? body.path : '')
          setState('saved')
        } catch {
          setState('failed')
        }
      }
      const savePath = () => post({ path: value.trim() === '' ? null : value.trim() })
      const useDefault = () => {
        setValue('')
        post({ path: null })
      }
      // The two Capture One moves: the path itself opens the folder dialog, the arrow
      // reveals the folder. A cancelled dialog answers the unchanged state, so the row
      // just settles; a host with no dialog never renders the path as a button.
      const choosePath = () => post({ action: 'choose' })
      const revealPath = async () => {
        try {
          const response = await fetch(LIBRARY_API, {
            method: 'POST',
            headers: { 'content-type': 'application/json', accept: 'application/json' },
            body: JSON.stringify({ action: 'reveal' }),
          })
          if (response.ok) setState('idle')
        } catch {
          setState('failed')
        }
      }

      // "Space left" the way Capture One writes it: a number with two decimals and a
      // unit, only when the host could measure the volume. `shown` is null before the
      // host has answered at all, and an unanswered row draws no number.
      const space =
        shown && typeof shown.freeBytes === 'number' && shown.freeBytes >= 0
          ? t('settings.library.space') + ' ' + (shown.freeBytes / 1024 ** 3).toFixed(2) + ' GB'
          : null
      const rootText = shown && shown.root ? t('settings.library.current') + ' ' + shown.root : t('settings.library.current') + ' …'
      const canChoose = !!(shown && shown.canChoose)

      return h(
        'div',
        { style: S.rowCard, 'data-generate-library': 'yes' },
        h(
          'div',
          { style: S.rowHead },
          h('span', { style: S.rowIdentity }, h('span', { style: S.rowName }, t('settings.library.title'))),
        ),
        h('div', { style: S.rowSummary }, t('settings.library.hint')),
        h(
          'div',
          { style: { display: 'flex', alignItems: 'center', gap: 6 } },
          canChoose
            ? h(
                'button',
                {
                  type: 'button',
                  style: { ...S.ghost, flex: '1 1 auto', minWidth: 0, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
                  'data-generate-library-root': 'yes',
                  'data-generate-library-choose': 'yes',
                  'aria-label': t('settings.library.choose'),
                  disabled: state === 'saving',
                  onClick: choosePath,
                },
                rootText,
              )
            : h('div', { style: { ...S.hint, flex: '1 1 auto', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, 'data-generate-library-root': 'yes' }, rootText),
          shown && shown.root
            ? h(
                'button',
                {
                  type: 'button',
                  style: { ...S.ghost, flex: 'none', display: 'flex', alignItems: 'center' },
                  'data-generate-library-reveal': 'yes',
                  'aria-label': t('settings.library.reveal'),
                  disabled: state === 'saving',
                  onClick: revealPath,
                },
                h(IconRightUpOutline16, { size: 12 }),
              )
            : null,
        ),
        space ? h('div', { style: S.hint, 'data-generate-library-space': 'yes' }, space) : null,
        h(
          'div',
          { style: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' } },
          h('input', {
            style: { ...S.settingsInput, flex: '1 1 220px' },
            value,
            placeholder: t('settings.library.placeholder'),
            'aria-label': t('settings.library.title'),
            'data-generate-library-input': 'yes',
            spellCheck: false,
            autoComplete: 'off',
            onChange: (event) => {
              setValue(event.target.value)
              if (state === 'failed' || state === 'saved') setState('idle')
            },
          }),
          h(
            'button',
            { type: 'button', style: S.secondary, disabled: state === 'saving', 'data-generate-library-save': 'yes', onClick: savePath },
            t('wallet.key.save'),
          ),
          shown && shown.source === 'custom'
            ? h(
                'button',
                { type: 'button', style: S.secondary, disabled: state === 'saving', 'data-generate-library-reset': 'yes', onClick: useDefault },
                t('settings.library.default'),
              )
            : null,
        ),
        state === 'failed'
          ? h('div', { style: S.fieldError, role: 'alert', 'data-generate-library-failed': 'yes' }, t('settings.library.failed'))
          : null,
      )
    }

    function GenerateSettings(props) {
      const t = translatorOf(props)
      const { phase, providers, busy, save, unlink, setHidden, confirmed, forget, library } = useProviders()
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
        // Where these providers' runs save, under the rows it belongs to.
        h(LibraryFolder, { t, library }),
      )
    }
    /**
     * The chip's live text, with the tab's own glyph in front of it (founder, 2026-09-25:
     * *"add sparkles icon to generate tab at top to match other dsh tabs"*). The guide tab
     * draws its compass exactly this way — glyph, then label — so a Generate tab reads as one
     * of the app's own tabs rather than as a bare word. The glyph is the same sparkle the
     * start-page card wears; only the ink differs, because a tab title is chrome and the card
     * is the product's own door.
     */
    function GenerateTitle(props) {
      return h(
        React.Fragment,
        null,
        h(
          'span',
          { style: S.tabTitleIcon, 'data-generate-title-icon': 'yes', 'aria-hidden': true },
          h(IconSparkle16, { size: 16 }),
        ),
        translatorOf(props)('type.label'),
      )
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
      // THE ONE INJECTED SHEET. A bundle's client half is one script — there is no
      // stylesheet to own — so what CSS alone can do (the run strip's spinner needs
      // keyframes) travels in one <style> this effect adds and removes with the row.
      // Skipped where there is no DOM: the verify harness runs this half in Node.
      ctx.effect(() => {
        if (typeof document === 'undefined' || !document.head) return () => {}
        const style = document.createElement('style')
        style.setAttribute('data-generate-style', 'yes')
        style.textContent =
          '@keyframes dsh-generate-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }\n' +
          '.dsh-generate-spin { animation: dsh-generate-spin 0.9s linear infinite; }\n' +
          '@media (prefers-reduced-motion: reduce) { .dsh-generate-spin { animation: none; } }\n' +
          // A TAB'S CLOSE SHOWS ONLY ON THE SELECTED, THE HOVERED OR THE FOCUSED TAB (founder,
          // 2026-09-25: *"the pattern in dsh is when the tab is unselected there is no close
          // icon"*). Copied from the app's own `_tabClose_11olo_411`, which is
          // `opacity:0;pointer-events:none` at rest and `:hover` / `:focus-within` / active
          // otherwise. Opacity, not `visibility` or `display`, so the glyph keeps its 18px box
          // and a tab never changes width when it becomes the active one.
          '.dsh-generate-tabClose { opacity: 0; pointer-events: none; }\n' +
          '[data-generate-tab-pill]:hover .dsh-generate-tabClose,\n' +
          '[data-generate-tab-pill]:focus-within .dsh-generate-tabClose,\n' +
          '[data-generate-tab-pill][data-generate-tab-selected="yes"] .dsh-generate-tabClose' +
          ' { opacity: 1; pointer-events: auto; }'
        document.head.appendChild(style)
        return () => {
          style.remove()
        }
      }, 'generate.style')
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
