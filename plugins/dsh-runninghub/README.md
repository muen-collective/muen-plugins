# @muen/dsh-runninghub

The Generate space for DeepSeek Harness: link your own RunningHub wallet, add a
workflow, and run it in the right panel. Epic 61.

**This is S1 + S2: the plugin installs, the surface mounts, and a RunningHub key can be linked.** The pane is
the wallet and an empty state; the workflow list, the install flow and the run view are S3–S5 and are not
faked here.

## What it registers

| Seat | What |
|---|---|
| `ctx.sidebarRightTabs` | a `generate` page type, id `@muen/dsh-runninghub`, priority `extension` |
| `sidebar.right.pane.tab` | the pane body, keyed by the same id |
| `sidebar.right.pane.tab.title` | the tab chip's live text |
| the type's `guide[]` | one entry, which puts the **Generate** card on the right panel's start page |
| `settings.section` | one settings page, `runninghub-wallet`, where the key is changed or unlinked |
| the client locale registry | namespace `generate`, en + zh |

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

It uses the standard guide card. The categorized flyout (the app picker) is S4
and registers a renderer at `sidebar.right.tab.guide.entry` under the same id.

`multiple` is absent on purpose: with it, the param-less guide card would open a
new tab on every click. One page per pane is right until a tab carries a unit's
params (S5, D17).

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
node verify/mount.mjs --static   # registration only
```

`verify/mount.mjs` runs the shipped `lib/client.js` in a stubbed loader and reads every registration back off
a recording ctx. `verify/wallet.mjs` imports `lib/index.js`, mounts the route against a recording web server, and
drives it with a stubbed RunningHub and a recording credentials seam — including the rule that no response
body ever carries a key. Its fixtures use the seam's real `source` values (`file`, `env`); they said
`store`/`environment` until 2026-09-22, strings the seam never emits, which is how the strip came to call a
pasted key "from your environment" while every check stayed green. `verify/save-confirmation.mjs` renders the
shipped components with React stood in for by a shim with working hooks and a stubbed `fetch`, presses Save
and Remove key, and reads what the surface does next: a confirmation dialog naming the key, the wallet read
and where the balance went, nothing at all for a refused key, a dialog that closes on dismiss or on the next
keystroke, the strip's note for each real `source` value, the fresh-install and linked panes both naming
Settings → Generate as the place the key is managed (with the info glyph, and the linked note inside the empty
state rather than beside the strip), and for rotation a question that deletes nothing
until it is answered, declined without a `DELETE` leaving the wallet linked, and a receipt in the same dialog
once it is. `node verify/save-confirmation.mjs --show` prints the dialog's lines in order, which is how the
copy is read without restarting the app. A skip is printed as `SKIP`; a layer that ran and disagreed fails the
run.

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
