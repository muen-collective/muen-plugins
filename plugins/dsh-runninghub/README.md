# @muen/dsh-runninghub

The Generate space for DeepSeek Harness: link your own RunningHub wallet, add a
workflow by pasting its app link, and run it in the right panel. Epic 61.

**This is S1 + S2 + S3, and S4's card: the plugin installs, the surface mounts, a RunningHub key can be
linked, a workflow can be added from its app link, and the start-page card lists what is installed and opens
one.** The pane's one-field install form and the run view (S5) are not faked here.

## What it registers

| Seat | What |
|---|---|
| `ctx.sidebarRightTabs` | a `generate` page type, id `@muen/dsh-runninghub`, priority `extension` |
| `sidebar.right.pane.tab` | the pane body, keyed by the same id |
| `sidebar.right.pane.tab.title` | the tab chip's live text |
| the type's `guide[]` | one entry, which puts the **Generate** card on the right panel's start page |
| `sidebar.right.tab.guide.entry` | the card renderer, under the same id: the installed list and its flyout (S4) |
| `/plugins/generate/adapters` | the host route the card reads that list from — a disk read, no key, no network |
| `settings.section` | one settings page, `runninghub-wallet`, where the key is changed or unlinked |
| the client locale registry | namespace `generate`, en + zh |
| `ctx.tools` | `rh_workflow_graph` (read an app's doors) and `rh_adapter_validate` (check a written adapter) |
| `ctx.skills` | `add-rh-workflow`, read from `skills/add-rh-workflow/SKILL.md` at apply time |

## The pane links; Settings manages

A fresh install lands on the pane, and the pane links a key: the first-run state is one field, validated
before it is stored. What the pane cannot do is change or remove a key — that page is the owner — so the pane
names it, twice, because a person who meets the field here would otherwise never learn where the key is
managed: *"You can change or remove this key later in Settings → Generate. The Settings menu is at the bottom of
  the left sidebar."* on the
first-run card, and the same directions again once linked, where they sit under the empty state's own line
(*"RunningHub apps you add open here, one tab each."*) rather than at the top of the pane. Both notes are led
by `IconInfoOutline14` from the harness's icon set, so they read as notes rather than as one more control.

Directions rather than a button, because a client plugin cannot open the Settings surface: the client service
catalog carries no settings service and the client event catalog no settings event, the dialog's open state
belongs to `dsh-client-ui-settings-general`'s own seat, and `layout.selectPanel()` takes main-panel ids, of
which Settings is not one. The options weighed were: keep the pane's field and name the owner (chosen), drop
the field so the pane only points (one extra navigation on first link, and the user must find Settings
themselves), or move link/replace/remove all into the pane (which contradicts S5, where the pane becomes the
workflow workspace). The wallet page's own copy already distinguishes replacing from removing.

Under those key directions, and in both pane states, sits the other half of what a new install needs — how an
app gets added:

> To add a workflow, ask the agent in chat: “add this RunningHub workflow &lt;app link&gt;”.

It is text rather than a button for the same class of reason: a third-party client plugin cannot put text
into the conversation composer, and a slash command cannot start a turn (both measured 2026-09-22). So the
pane says what to ask for and the agent's `add-rh-workflow` skill does the rest. **The quoted trigger stays
English in both dictionaries, deliberately** — it is the phrase the skill's `whenToUse` names, so translating
it would produce a sentence the user types and nothing picks up; a user may of course say it in their own
language. The line carries the same info glyph as the key directions and is read off its own node
(`data-generate-add-hint`) by the verify, so it is held by placement rather than by matching a phrase.

## The wallet (S2)

| Route | What |
|---|---|
| `GET /plugins/generate/wallet` | the wallet status — `linked`, `writable`, `source`, the account (`coins`, `money`, `currency`, `running`), an error code, and `accountUrl`. Never the key |
| `POST /plugins/generate/wallet` | `{ key }`: validated against `POST /uc/openapi/accountStatus`, then stored. Nothing is stored on a key RunningHub refuses |
| `DELETE /plugins/generate/wallet` | unlink |

`accountUrl` is `https://www.runninghub.ai/call-api/bill-task?tab=keys` — the page that issues keys and shows
the balance. It is not linked from anywhere obvious in RunningHub's product (the founder had to search for it,
2026-09-22), so the field's hint and the strip both carry the link rather than directions.
`verify/wallet.mjs` pins it.

No `type` parameter, deliberately: that page has three key types (Consumer-Membership, Enterprise-Shared,
Enterprise-Dedicated) and `type` selects one, so pinning a type would pin a capability a consumer-only account
may not have. `?tab=keys` alone was checked live and the page's own nav switches types. What each type can
call, its concurrency and its pricing are transcribed in epic 61 §9 — the short version is that a plain
membership can call the AI App and ComfyUI Workflow APIs this plugin uses.

The `type` parameter is account-shaped: the first value recorded here was `type=consumer` and it was wrong.
The founder's page is labelled *Enterprise Shared* on his Creator Pro tier, and whether every tier exposes an
API-keys page is unverified — epic 61 D23. If it turns out to be tier-specific, the parameterless
`/call-api/bill-task?tab=keys` is the first thing to try.

The key lives in the harness `credentials` seam as a `CredentialRef` named `RH_API_KEY`, so the value goes to
the provider's own writable store while an existing env file keeps working as the fallback. `source` is the
seam's own word for where the value came from, and it has four values, not two: `file` is the provider-managed
store (what a key pasted here becomes), `env` is the inherited process environment (`writable: false`), and
`project-env` / `user-env` are the `.env` fallbacks. The strip prints a note for those and says nothing for a
source it does not know. A read-only source that shadows the reference makes a change fail with
`409 read-only` instead of appearing to work. The failures are kept apart — `invalid-key` is a different fact
from `unreachable`, `timeout` and `unexpected-response`, and the field shows the one that happened.

The browser half never holds the key: it posts it once, then reads balances. That is why the pane cannot
judge a key by itself — it asks the host, and the host answers with the account. A stored key that later
stops working is reported as revoked, which is a different fact from a bad entry and has a different fix.

A save that worked opens the harness's own centered dialog (`Modal` from
`@deepseek-ai/dsh-client-ui-primitives`, the same one the workspace dialogs use). It says the three things a
saved key on its own does not: the key works, because RunningHub validated it before it was stored; the
wallet answered, with the balance the read returned (`8,600 coins · USD 27.473`); and where that balance now
lives — at the top left of the panel, beside the Top up link. The last line is the point. The strip had always
shown the balance, but it sits above the fold and the person who just pressed Save is looking at the button
(founder, 2026-09-22: the key linked, the strip showed the account, and he missed it). `Modal` portals to the
document body, so the confirmation is centered on the screen rather than confined to the pane it came from.
The dialog is opened by the surface, not by the field: a successful first link replaces the field with the
wallet view, so a message kept inside `KeyForm` would unmount with it. Escape, the mask, `Got it` and the next
keystroke all close it.

## Changing and removing the key

Creating a new key on RunningHub is a normal act, not an edge case, so the settings page carries both halves of
rotation rather than only the first link. Pasting a key into the field **replaces** whatever is stored — the
hint above the field says so — and the save ends in the same confirmation dialog with the new balance. The
other half is **Remove key**, under the field: it asks first (*Remove the stored key?*), says in the question
that the key itself survives on RunningHub so the same one can be pasted again, deletes nothing until the
destructive action is confirmed, and then turns into the receipt in the same dialog (*Key removed.*). Every
way out — Escape, the mask, Cancel, `Got it` — leaves the key alone unless the destructive button was pressed.
A key that came from a read-only source offers neither control, because a change there could only appear to
work (`409 read-only`).

The control lives on the settings page rather than in the pane because the pane becomes the workspace (S5) and
the wallet page is the one owner of the key. The pane's linked view still points at it when a stored key stops
being accepted.

The card's glyph is `IconSparkle16` from the harness's own icon set
(`@deepseek-ai/dsh-client-ui-primitives`), declared in `dsh.client.external`, wrapped so it is painted in the
theme's primary colour (`--dsw-alias-brand-primary`). A guide entry with no icon gets the guide's cube
placeholder, which reads as unfinished beside the shipped Browser, Terminal and Files cards; and a declared
icon with no colour of its own reads as the surrounding grey ink, the way the Browser globe does. The pattern
the shipped cards follow is that each glyph carries its own paint — Files' folder is coloured per type by a
class in its stylesheet, Terminal's card is a black rect — so Generate carries the brand's. There is no image
or photo glyph in the set; a picture-specific mark would mean hand-authoring one the way Terminal
(`TerminalGuideIcon`) and Files (`FolderSheetGlyph`) do.

## The card (S4)

The type's own `guide[]` entry is what puts a card on the start page beside
"Workspace files", "New terminal" and "Browser". The card renderer registered at
`sidebar.right.tab.guide.entry` under the same id is what makes that card list what
is installed: the host reads `<profile>/runninghub/adapters/` and answers
`/plugins/generate/adapters`, and the card draws one row per workflow.

It draws three shapes, and all three are supported installs:

| Installed | The card |
|---|---|
| none | the type's own label, and a flyout whose only row is **Add a workflow…** |
| one | that workflow's title and blurb, no chevron — the card IS the app, and clicking it opens it |
| several | the type's label, and a flyout of **capability → workflow → variant**, with Add a workflow… last |

A level of the flyout is drawn only when it has something to hold: a group with one
member and no variants becomes that row, not a parent with a single child; two
adapters sharing a title are that workflow's variants. A community app is marked as
someone else's work, because the API cannot say whose app it is and the adapter is
where a person said so.

An entry is listed only if it could be opened: the schema is this version,
`provenance.dryRun` is `ok` (which is what "only after `rh_adapter_validate` passes"
means in a file), and `origin` is set. A file that fails one of those is **reported**
in the route's `skipped` list rather than dropped silently, because "I installed it
and it is not there" has to have an answer.

Selecting a workflow opens the `generate` kind with `params.unit` — the seam S5
reads to know which adapter a tab is for. The run form does not exist yet, so the tab
it opens is today's pane.

`multiple` is absent on purpose: with it, the param-less card would open a new tab on
every click. One page per pane is right until a tab carries a unit's params (S5, D17).

`Add a workflow…` opens the pane, which is where the install sentence lives today.
S4's one-field install form takes that destination over when it lands; until then the
row is a signpost, not a second install path.

## The install (S3)

An **adapter** is one JSON file that says which RunningHub app, which revision, which doors it has and how
those doors should look. The doors come from RunningHub; the words come from the glossary; everything else is
stated in the file.

| Tool | What it does |
|---|---|
| `rh_workflow_graph` | `{ link }` → the app's name, cover, tags and every exposed input, each with its node id, field name, control, the app's own options/bounds/default/tooltip, a glossary label, and a starter adapter object |
| `rh_adapter_validate` | `{ path }` or `{ adapter }` → re-reads the app (read-only: it spends nothing and submits nothing) and reports every door that is not a `(nodeId, fieldName)` pair the app exposes, every control type the pane cannot render, and every derived value that has drifted |

Both are host-side, both are read-only, and **neither writes a file**. The agent writes the adapter with its
own file tools, guided by the `add-rh-workflow` skill — which is what makes "nothing is written before the
user confirms" structural rather than a promise. The host half makes no model call, so the same two tools
serve S4's mechanical install path with no model configured at all.

A door is derived from the API and only its label is authored. `apiCallDemo` answers with `fieldData` as a
JSON string — `["STRING", {"multiline": true}]`, `["COMBO", {"options": […], "tooltip": …}]`,
`["FLOAT", {"min": 0.1, "max": 16, "step": 0.1, "default": 1}]` — so the control, the options, the bounds and
the tooltip are all measured facts. Three findings shape the code: `descriptionEn` returns the raw field name,
so it is not a label; an `IMAGE` door's `fieldData` leads with an array rather than a type string, so
`fieldType` leads the control decision; and two doors can share a `nodeId` (`942` carries both `aspect_ratio`
and `megapixels` on a real app), so the pair is the identity and the validator compares the pair. That last
one is why `door-pair` is a different failure from `unknown-door`: the fixes differ.

**Where the files go.** `<profile>/runninghub/adapters/<name>.json`, and the house style at
`<profile>/runninghub/_house.json`. The harness exposes no "profile directory" service, so the root is
resolved from two facts already in the process: the profile name in `argv` (`dsh --profile <name> app`, which
is exactly how the shell and the stock CLI spawn it) and `DSH_HOME`. `RH_DATA_DIR` overrides the whole thing.
The tool returns the resolved path with the rule that resolved it, so a wrong root is visible rather than
silent. Nothing creates the directory: in S3 the only writer is the agent.

**The house style has three layers.** The shipped default (`lib/house.js`) carries the run label convention,
the four-door main-screen budget, the advanced-by-default field names and the glossary; a profile's
`_house.json` adds and overrides entries per key; and the adapter's own `label`, `hint` and `ui` beat both. A
malformed `_house.json` warns and falls back to the shipped default rather than breaking the install. The
default's vocabulary is deliberately generic — *Image*, *Prompt*, *Aspect ratio* — never *Garment photo*: a
fashion-flavoured default would be wrong for the first photographer who installs it, and the default is the
one artefact every stranger reads. An unrecognised `fieldName` is title-cased and marked
`fromGlossary: false` rather than guessed at.

**Nothing is invented about authorship.** The API carries no author or account field, so `source.author`
stays empty until the user types one, `source.url` keeps the link they pasted, and the adapter's `origin`
(`mine` or `community`) is a question the skill asks — the validator refuses an adapter that does not say,
rather than defaulting to "mine".

**Only AI Apps, in v1.** `rh_workflow_graph` reads the AI App path (`apiCallDemo`), which the S0 probe
measured on three real apps. The ComfyUI-workflow path (`getJsonApiFormat`) is documented but unmeasured here,
and epic 61 §2 does not need it while the first source holds (D16 is moot), so nothing asks for a
`workflowId`: a ComfyUI workflow link or id is refused as an unrecognised app reference rather than
half-read.

## Install

```
plugin_manager install_bundle  target: <this directory>
```

or, from a shell:

```
dsh plugin --profile <profile> add <this directory>
```

Then **restart the app**: a client bundle is served from an in-memory copy
captured at activation, so the card does not appear on a page reload alone
(measured 2026-09-19).

## Verify

```
node verify/mount.mjs            # registration contract (+ live page, which skips)
node verify/wallet.mjs           # the wallet routes, driven against fakes (+ live route)
node verify/save-confirmation.mjs # a save that worked, and one that was refused
node verify/adapter.mjs          # the install: doors read, adapters written and refused
node verify/skill.mjs            # the skill's order, and that the plugin has no write path
node verify/start.mjs            # the card: every install shape, and what may be listed
node verify/mount.mjs --static   # registration only
```

`verify/mount.mjs` runs the shipped `lib/client.js` in a stubbed loader and reads every registration back off
a recording ctx. `verify/wallet.mjs` imports `lib/index.js`, mounts the route against a recording web server, and
drives it with a stubbed RunningHub and a recording credentials seam — including the rule that no response
body ever carries a key. Its fixtures use the seam's real `source` values (`file`, `env`); they said
`store`/`environment` until 2026-09-22, strings the seam never emits, which is how the strip came to call a
pasted key "from your environment" while every check stayed green. `verify/save-confirmation.mjs` (**62/62**) renders the shipped components with React stood in for by a shim
with working hooks and a stubbed `fetch`, presses Save and Remove key, and reads what the surface does next: a
confirmation dialog naming the key, the wallet read and where the balance went, nothing at all for a refused
key, a dialog that closes on dismiss or on the next keystroke, the strip's note for each real `source` value,
the fresh-install and linked panes both naming Settings → Generate as the place the key is managed (with the
info glyph, and the linked note inside the empty state rather than beside the strip), **both panes telling the
user how to add a workflow, under the key directions and in that order, with the trigger phrase intact in
`zh` too**, and for rotation a question that deletes nothing until it is answered, declined without a
`DELETE` leaving the wallet linked, and a receipt in the same dialog once it is.
`node verify/save-confirmation.mjs --show` prints the dialog's lines in order — including both pane states,
which is how the copy above is read without restarting the app. A skip is printed as `SKIP`; a layer that ran
and disagreed fails the run. Mutation-tested: **58/62 with the note's info glyph removed**, **59/62 with the
add line dropped from the linked pane**, **61/62 with the two notes swapped** and **61/62 with the `zh`
trigger translated away**.

`verify/adapter.mjs` (**86/86**) drives both tools through the definitions the plugin actually registers, with
a stubbed RunningHub that answers **per app id** — a URL-blind stub would let an adapter naming one app pass
against another app's doors, which is the confusion the pair check exists to catch. Its fixtures are trimmed
copies of the committed S0 receipts, so the shapes are the shapes the live API returned, including the two
doors on node `942` and the `IMAGE` door whose `fieldData` leads with an array. It holds: the app's options,
bounds, step, default, multiline and tooltip are copied and not invented; an unrecognised field name is
title-cased and marked unpolished; an app that sets `accessEncrypted` is refused; a bad link and a missing key
fail **before any request is issued**; the API's own refusal is reported in its own words and not blamed on
the network; a good adapter passes and a wrong node id, an unknown field name, a swapped pair, a drifted
value, a missing derived value, an unrenderable type, a missing origin and an unstamped `dryRun` each fail
distinctly; an adapter with no `ui` block still passes; and no call creates the data directory. It scores
**80/86 when the validator compares `nodeId` alone instead of the pair**, **83/86 when the glossary loses the
seed label**, **84/86 when the derived values stop being compared** and **83/86 when the data root ignores
`--profile`** — the checks fail on the defects they were written for.

`verify/skill.mjs` (**36/36**) mounts the plugin against a recording skills registry and reads the text the
host would serve: it is the shipped file byte for byte, the ask comes before the fetch, the confirmation comes
before the write, the agent is told to use its own file tool, and the host half contains no `writeFile`,
`mkdir` or LLM import at all. It scores **35/36 with the confirmation step renamed away** and **35/36 with the
rule against invented authors removed**.

## Not in this package, by rule

Nothing Muen-specific sits on a stranger's path: no app id, no workflow name, no
key, no Muen service. Only upstream `@deepseek-ai/*` services, the harness's own
theme aliases (`--dsw-alias-*`), and this package's own copy — so it is a plain
Cordis plugin in any DSH (`docs/plans/61-runninghub-generate-space-epic.md` §5).

The package name is settled: **`@muen/dsh-runninghub`** (epic 61 D10/Q4, ratified
2026-09-22), so a RunningHub user searching the market finds it. The surface inside keeps
the label **Generate**, the tab kind stays `generate`, and the row id is `runninghub` —
which is also the profile directory the surface's own data lives under
(`<profile>/runninghub/`), so a later rename moves that directory with it.
