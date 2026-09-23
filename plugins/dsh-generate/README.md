# @muen/dsh-generate

The Generate space for DeepSeek Harness: link your own provider account (RunningHub
today), add a workflow by pasting its app link, and open each installed workflow as a
surface inside the one Generate pane. Epic 61.

**This is S1 + S2 + S3 plus the provider registry and the pane as a hub: the plugin installs, the surface
mounts, each provider's key can be linked on the one Generate settings page, a workflow can be added from its
app link, and the pane opens on a meter per linked provider under a stacked accordion of provider sections,
each holding its workflows as start-page cards — a card opening that workflow's surface inside the same pane.**
The pane's one-field install form, the payload gate
and the run are not faked here.

## What it registers

| Seat | What |
|---|---|
| `ctx.sidebarRightTabs` | a `generate` page type, id `@muen/dsh-generate`, priority `extension` |
| `sidebar.right.pane.tab` | the pane body, keyed by the same id |
| `sidebar.right.pane.tab.title` | the tab chip's live text |
| the type's `guide[]` | one entry, which puts the **Generate** card on the right panel's start page — the harness's own standard card, with no renderer of ours |
| `/plugins/generate/providers` | the host route both the pane and Settings read: every provider with its key state and its workflow count |
| `/plugins/generate/providers/<id>/key` | one provider's key: `GET` its state, `POST` to link or replace, `DELETE` to unlink |
| `/plugins/generate/providers/<id>/workflows` | one provider's installed workflows — one disk read, no key, no network |
| `/plugins/generate/providers/<id>/workflow?name=` | one workflow, whole: the doors, labels, bounds and `ui.order` a surface renders |
| `settings.section` | exactly ONE settings page, id `generate`, listing every provider in the Models → Providers shape: a row per provider with a credential dot and its key state, one open editor card at a time, the API key as the primary field, and the install prompt where Models puts a model list |
| the client locale registry | namespace `generate`, en + zh |
| `ctx.tools` | `rh_workflow_graph` (read an app's doors) and `rh_adapter_validate` (check a written adapter) |

**The prefix route is registered WITHOUT a trailing slash, and that is a contract.** The harness matches a
prefix as `pathname === prefix || pathname.startsWith(prefix + '/')` (`@deepseek-ai/dsh-host-webserver`,
`match()`) — it appends the slash itself. Register `'…/providers/'` and the second test becomes
`startsWith('…/providers//')`, so only the bare path matches and every `/providers/<id>/…` request falls
through to the SPA fallback as a 404 with an empty body. That was shipped on 2026-09-23 and broke every
provider route at once; `verify/wallet.mjs` now runs its cases through a copy of the harness matcher, which
is the check that would have caught it.
| `ctx.skills` | two runtime skills, read from `skills/<name>/SKILL.md` at apply time: **`add-rh-workflow`** (install: name the doors, confirm, write the adapter) and **`design-generate-screen`** (design: which doors stand on the main screen, what they are called, what the button and the gate show) |

## Providers — one plugin, several of them

**Decided by the founder on 2026-09-22:**

> "we need to rethink the generate plugin to be able to use different providers, it should work like the
> providers settings" … "we should only have 1 generate settings with the different adapters."

A provider is one object in `lib/providers.js`: its id and label, the family it belongs to (`kind`), the
credential reference its key lives under, the page that issues that key and what that page is called, the page
a person manages the account at, the sentence that installs one of its workflows, how to read the account a key
opens (which is how a key is validated before it is stored), where its data lives under the plugin root, and how
to list and read its workflows.

**Four are registered, and the registry's own order is the order every surface shows them in (founder,
2026-09-23: *"the order of providers is: RunningHub, Krea, Comfy Cloud"*, and then *"actually you can leave
magnific as a last row, I will test another time"*):**

| Provider | Family | Host | Key check | Key page |
|---|---|---|---|---|
| RunningHub | workflow | `www.runninghub.ai` | `POST /uc/openapi/accountStatus`, `Authorization: Bearer` | runninghub.ai/call-api/bill-task?tab=keys |
| Krea | image | `api.krea.ai` | `GET /jobs`, `Authorization: Bearer` | krea.ai/settings/api-tokens |
| Comfy Cloud | workflow | `cloud.comfy.org` | `GET /api/user`, `X-API-Key` | platform.comfy.org/profile/api-keys |
| Magnific | image | `api.magnific.com` | `GET /v1/creations/recent?per_page=1`, `x-magnific-api-key` | magnific.com/user/organization/api-keys |

**Magnific sits last because its key is the one still untested.** It was registered for a one-month trial on
2026-09-23, removed the same morning when the founder's working pair turned out to be Krea and Comfy Cloud
(*"krea and comfy cloud works, you can remove magnific"*), and restored the same morning as the last row so the
trial can happen later. It is a real provider, not a disabled one: its key check runs like any other's. Being
last is a position in the registry, not a comment on the provider.

Each check was researched on 2026-09-23 against the provider's own docs and OpenAPI, and the citations live on
the provider object. Two facts shaped the contract:

- **Only RunningHub can report a balance.** Krea, Magnific and Comfy Cloud publish no account endpoint at
  all — Krea's docs say outright that balance *"cannot be read programmatically"* — so a row for those says
  `Key saved` rather than showing an empty wallet;
- **a provider can answer about a key without accepting it.** Comfy Cloud answers `429` for a key whose
  subscription is inactive, Krea answers `402` when the API balance is empty, and Magnific answers `403` with a
  response component its own spec never defines. Each means the key is real,
  and none is thrown away (founder: *"store it and mark it unverified"*): the key is stored, `verified` is
  false, and the row carries the reason (`note`). A `401` is a bad key everywhere, and a network failure is
  never reported as one.

**Why not a plugin per provider.** Two measured facts:

1. `settings.section` is a **list** slot — one page per registrant — so a plugin per provider would put a
   second (and third) Generate page in Settings, and reusing our id would *replace* our page instead of adding
   to it;
2. a third-party client plugin **cannot declare its own slot** (the client `slots` service exposes `register`,
   `registerFactory` and `inject` only), so "one page that several plugins contribute to" has no seam in this
   harness today.

**The data layout follows the same rule:** `<profile>/generate/<provider>/adapters/<name>.json`, so each
provider's own files — its adapters today, its uploads later — stay together under its own name, and the row id
(`generate`) never names a provider.

### A Krea model is not an adapter

A RunningHub adapter describes an AI App **somebody authored on RunningHub**, and its doors are read from that
app — which is why installing one is the agent's job, through `rh_workflow_graph` and `rh_adapter_validate`
(S3). A Krea model is **Krea's**: the slug, the endpoint and the input schema are published by Krea, and no
user authors one. So the models ship with the plugin, in `lib/krea-models.js`, exactly the way the door
glossary ships in `lib/house.js`, and a profile extends that list the same way `_house.json` extends the
glossary: **`<profile>/generate/krea/_models.json`** adds a model or replaces one by name.

The models are the founder's, added one at a time on 2026-09-23, each with the SDK call that names it
— `image/krea/krea-2/medium-turbo` (*"that last one was Krea 2 Turbo"*), then
`image/krea/krea-2/medium` (*"this one is Krea 2 Medium"*), then `image/krea/krea-2/large` (*"add
this krea model"*). The cards carry **Krea's own names and descriptions** (*"descriptions from Krea
website"*), and they are listed turbo first — Turbo, Medium, Large (founder, 2026-09-23: *"can you make
the order turbo/medium/large"*), and every Krea 2 variant Krea documents:

| Card | `model` / `endpoint` | Krea's own description |
|---|---|---|
| Krea 2 Turbo | `image/krea/krea-2/medium-turbo` / `POST /generate/image/krea/krea-2/medium-turbo` | The fastest Krea 2 model. Best for quickly iterating on expressive illustrations. |
| Krea 2 Medium | `image/krea/krea-2/medium` / `POST /generate/image/krea/krea-2/medium` | A smaller variant of Krea 2. Works best with illustrations and graphic design. |
| Krea 2 Large | `image/krea/krea-2/large` / `POST /generate/image/krea/krea-2/large` | More powerful version of Krea 2 optimized for expressive photorealism. |

All three endpoints accept the same public request body, so every card carries the same thirteen doors —
`verify/models.mjs` asserts that sameness, so the day one endpoint diverges the difference is a
failing check and not a silent drift:

| Fact | Value | Source |
|---|---|---|
| Required doors | `prompt`, `aspect_ratio`, `resolution` | `required:` in each schema |
| `aspect_ratio` | one of `1:1`, `4:3`, `3:2`, `16:9`, `2.35:1`, `4:5`, `3:4`, `2:3`, `9:16` | `enum` |
| `resolution` | `1K` | `enum` |
| `creativity` | `raw` \| `low` \| `medium` \| `high`, default `low` | the endpoint schema's own default |
| `intensity`, `complexity`, `movement` | integer `-100`..`100`, default `0` | the generative-slider docs |
| `image_url`, `strength` | image; `0`..`1`, default `0.99` | the img2img fields |
| `seed` | number, optional | — |
| `styles` | a LIST of `{ id, strength }`, both required, `-2`..`2` | the array schema |
| `image_style_references` | a LIST of `{ url, strength }` (`url` required, `0`..`1`, default `0.5`), at most 10 | `maxItems: 10` |
| `moodboards` | a LIST of `{ id, strength }` (`id` a uuid, `0`..`1`, default `0.23`), at most 1 | `maxItems: 1` |

`creativity` is the one place Krea's own pages disagree: all three Krea 2 endpoint schemas declare
`low`, while the overview prose calls `medium` the default for `krea-2/medium` and `krea-2/large`.
The schema wins, because the surface always sends the value it shows, and the disagreement is
recorded on the door rather than resolved silently.

The per-generation prices on Krea's own cards (2, 9 and 20 coins) are deliberately not carried: the
provider row already names the funding — a prepaid USD API balance — and this catalogue has no
price field.

**The three array fields are `list` doors, and that is the surface's fifth control** (founder, 2026-09-23:
*"we are missing a lot of fields for upload image for style ref, etc.."*, with Krea's own playground in the
screenshot). A list door carries `fields` — the doors of ONE row — so a row is drawn with the API's own
labels, bounds and defaults, and the run builds an array of objects exactly as Krea's schema says. They used
to be left out while the surface had four controls, because a text box posting a bare string into
`additionalProperties: false` cannot work; the fix was the control, not a flattened field. `max` is Krea's
own `maxItems`, which is why the add control disappears at one moodboard and stops at ten style references.

**And the image doors really upload.** Krea's `image_url` and a style reference's `url` each take *"an
external URL, base64 data URI, or uploaded asset URL"*, but a real photograph inlined as a data URI is far
past the 1024 characters those fields allow — so a picked file goes to `POST /assets` and the door carries
the `image_url` that comes back. The call needs the key and the pane holds none (§12 rule 2), so it goes
through the host: `POST /plugins/generate/providers/<id>/asset`, with the bytes as the body and the file's
name and type in headers. The provider says whether it can do this (`upload` on its registry entry, reported
as a capability in the provider list), so RunningHub's image doors draw the URL field and no pick control
until its own run slice lands.

Nothing here spends anything: a Krea model is a card and a surface, and the run is S5. What the model adds for
that slice is the two facts it will need (`model` and `endpoint`), carried through the surface route so S5 does
not have to re-derive them.

## The settings page, in the Models shape

**Decided by the founder on 2026-09-23:**

> "use the models settings design for generate settings … it should be analogous to models except we don't
> fetch the model, we add the workflow using prompt."

So `Settings → Generate` is the Models → Providers page, with the shipped page's own measurements read out of
`ModelsSection.module.css` and applied inline (a bundle's client half is one script and carries no stylesheet):
a 720px column, a 16px title over a 14px intro, 8px between rows, a 16px-radius card per provider with a
12/14px padding, an 8px credential dot, a 4px-radius family tag, and a 12px-radius editor card on the platform
module background with a 32px input.

| State | Dot | What the row says |
|---|---|---|
| linked and answered | green | the balance, when the provider has one — otherwise `Key saved` |
| linked, unverified | amber | why: no active subscription (Comfy Cloud), an empty API balance (Krea), or an entitlement Magnific never confirms |
| stored but refused | red | the key is no longer accepted; link a new one |
| no key yet | hollow | `No key linked` |

One card is open at a time, and with nothing linked the page opens the first unlinked provider's card by itself
— the posture Models gives a provider with no key anywhere. The open card carries the key field (labelled
`Krea API key`, `RunningHub API key`, …), the account link, Remove key, and the workflow block: what is
installed, by title and input count, then the install sentence and a **Copy** control.

### What using a provider costs, on its row

**Asked for by the founder on 2026-09-23** — the founder needed a monthly plan to run Comfy Cloud and asked
for the funding to be visible. So every row carries one line saying what it takes to run that provider, and a
link to the page that sells it. The host sends the fact (`funding.kind` and `funding.url`, provider data like
`keyUrl`); the sentence and the link's label are the client's copy (`funding.<kind>`, `funding.<kind>.link`),
because they are copy:

| Provider | `kind` | The row says | Link |
|---|---|---|---|
| RunningHub | `coins` | Runs on coins | runninghub.ai/call-api/bill-task |
| Krea | `balance` | Needs API balance — API calls are billed in USD, not compute units | krea.ai/app/api |
| Comfy Cloud | `plan` | Needs an active monthly plan | comfy.org/pricing |
| Magnific | `credits` | Needs a paid plan with credits | magnific.com/pricing |

Each `kind` was read off the provider's own billing page on 2026-09-23, and they are genuinely different
models rather than one word for "pay": RunningHub sells coins; **Krea has no monthly plan at all** — API calls
draw on a separate prepaid USD balance, which is why an empty one is Krea's `402`; Comfy Cloud has the monthly
plan its API key needs active (its `429`); and Magnific's API is not pay-per-use either — a paid plan grants a
credit bundle that API calls draw on, which is why its row says credits rather than a balance. No price is
written into the plugin: prices change, and the link is the page that knows.

**The one thing this page cannot copy from Models:** a model list is fetched from the provider over its API, and
a workflow is installed by the agent from a link the user gives it. So where Models has *Fetch available
models*, this page has the sentence `add this RunningHub workflow <app link>` and a Copy button — a plugin
cannot type into the composer and a slash command cannot start a turn (both measured 2026-09-22). The trigger
stays English in both dictionaries for the same reason it does in the pane: it is the phrase the skill answers
to.

## The pane links; Settings manages

A fresh install lands on the pane, and the pane links a key for the first **workflow** provider that has none —
RunningHub or Comfy Cloud, whichever comes first in the registry — because the pane is where workflows run and
an image provider has nothing for it to open. The first-run state is one field, validated before it is stored.
What the pane cannot do is change or remove a key — that page is the owner — so the pane
names it, twice, because a person who meets the field here would otherwise never learn where the key is
managed: *"You can change or remove this key later in Settings → Generate. The Settings menu is at the bottom of
  the left sidebar."* on the
first-run card, and the same directions again once linked, where they sit in their own block under the
accordion rather than at the top of the pane. Both notes are led
by `IconInfoOutline14` from the harness's icon set, so they read as notes rather than as one more control.

Directions rather than a button, because a client plugin cannot open the Settings surface: the client service
catalog carries no settings service and the client event catalog no settings event, the dialog's open state
belongs to `dsh-client-ui-settings-general`'s own seat, and `layout.selectPanel()` takes main-panel ids, of
which Settings is not one. The options weighed were: keep the pane's field and name the owner (chosen), drop
the field so the pane only points (one extra navigation on first link, and the user must find Settings
themselves), or move link/replace/remove all into the pane (which contradicts S5, where the pane becomes the
workflow workspace). The wallet page's own copy already distinguishes replacing from removing.

Under those key directions sits the other half of what a new install needs — how an
app gets added. On a fresh install it is the note:

> To add a workflow, ask the agent in chat: “add this RunningHub workflow &lt;app link&gt;”.

On a linked pane it is the **glyph in that provider's section header, immediately left of refresh**
(founder, 2026-09-23: *"move + workflow button as an icon button next to refresh. also add tooltip on hover for
both"*): the glyph reveals that provider's own `addPrompt` with Copy beside it, and a closed section opens when
it is clicked, because what it reveals is the body's. Both header glyphs — add and refresh — wear the harness's
own `Tooltip` on hover, not a native `title`, and carry the same words as their `aria-label`.

Neither control does the work: a third-party client plugin cannot put text into the conversation composer, and
a slash command cannot start a turn (both measured 2026-09-22). So the pane hands over the words and the agent's
`add-rh-workflow` skill does the rest. **The quoted trigger stays English in both dictionaries, deliberately** —
it is the phrase the skill's `whenToUse` names, so translating it would produce a sentence the user types and
nothing picks up; a user may of course say it in their own language. The fresh-install line is the note
(`data-generate-add-hint`); the linked pane's copy is the `code` node inside the panel the glyph reveals
(`data-generate-add-prompt`), and it is read off those nodes by the verify rather than by matching a phrase.

## The key (S2, now per provider)

S2 shipped one wallet route for one provider. The provider registry replaced it with one key route per
provider, so every sentence below holds for all four:

| Route | What |
|---|---|
| `GET /plugins/generate/providers/<id>/key` | that provider's key state — `linked`, `verified`, `writable`, `source`, the account (RunningHub: `coins`, `money`, `currency`, `running`), a `note` when the provider answered with a caveat, an error code, and the provider's `keyUrl` / `accountUrl`. Never the key |
| `POST /plugins/generate/providers/<id>/key` | `{ key }`: checked against that provider's own endpoint (above), then stored. Nothing is stored on a key the provider refuses; a key it will not check is stored and marked unverified |
| `DELETE /plugins/generate/providers/<id>/key` | unlink that provider |

RunningHub's `keyUrl` is `https://www.runninghub.ai/call-api/bill-task?tab=keys` — the page that issues keys and
shows the balance. It is not linked from anywhere obvious in RunningHub's product (the founder had to search for
it, 2026-09-22), so the field's hint and the strip both carry the link rather than directions.
`verify/wallet.mjs` pins it, and pins every other provider's key page as an absolute URL that is not a site
root.

No `type` parameter, deliberately: that page has three key types (Consumer-Membership, Enterprise-Shared,
Enterprise-Dedicated) and `type` selects one, so pinning a type would pin a capability a consumer-only account
may not have. `?tab=keys` alone was checked live and the page's own nav switches types. What each type can
call, its concurrency and its pricing are transcribed in epic 61 §9 — the short version is that a plain
membership can call the AI App and ComfyUI Workflow APIs this plugin uses.

The `type` parameter is account-shaped: the first value recorded here was `type=consumer` and it was wrong.
The founder's page is labelled *Enterprise Shared* on his Creator Pro tier, and whether every tier exposes an
API-keys page is unverified — epic 61 D23. If it turns out to be tier-specific, the parameterless
`/call-api/bill-task?tab=keys` is the first thing to try.

The key lives in the harness `credentials` seam as a `CredentialRef` named per provider — `RH_API_KEY`,
`KREA_API_KEY`, `COMFY_CLOUD_API_KEY`, `MAGNIFIC_API_KEY` — so the value goes to
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
`@deepseek-ai/dsh-client-ui-primitives`, the same one the workspace dialogs use). It says the things a
saved key on its own does not: the key works, because the provider validated it before it was stored, and — for
a provider that has one — that the account answered, with the balance the read returned (`8,600 coins ·
USD 27.473`), and where that balance now lives, at the top left of the panel beside the Account link. The last
line is the point. The strip had always
shown the balance, but it sits above the fold and the person who just pressed Save is looking at the button
(founder, 2026-09-22: the key linked, the strip showed the account, and he missed it). `Modal` portals to the
document body, so the confirmation is centered on the screen rather than confined to the pane it came from.
The dialog is opened by the surface, not by the field: a successful first link replaces the field with the
wallet view, so a message kept inside `KeyForm` would unmount with it. Escape, the mask, `Got it` and the next
keystroke all close it. A save the provider would not check opens the same dialog with the unverified title and
the reason, rather than claiming a validation that did not happen.

## Changing and removing the key

Creating a new key on a provider's own site is a normal act, not an edge case, so the open settings card
carries both halves of
rotation rather than only the first link. Pasting a key into the field **replaces** whatever is stored — the
hint above the field says so — and the save ends in the same confirmation dialog with the new balance or with
the unverified note. The
other half is **Remove key**, under the field: it asks first (*Remove the stored key?*), says in the question
that the key itself survives at the provider, deletes nothing until the
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

## The pane is the hub

**Decided by the founder on 2026-09-22**, after seeing the first cut take the card
over:

> "the UX is incorrect on the start page revert to Generate with RunningHub, then on
> this screen we need cards to launch the workflow UI/surface. So I think this
> surface needs to hold all wf surfaces inside this one RH plugin surface." …
> "we should only have 1 generate settings with the different adapters."

So the start-page card is the harness's own standard card, titled with the surface's
own label (**Generate** — founder, 2026-09-23: *"Generate with Runninghub should be
Generate"*; one plugin holds several providers, so the card names none of them), and the
pane holds everything else.

**The home screen is a stacked accordion** (founder, 2026-09-23: *"I want to try stacked
accordion to each provider inside an accordion … the workflow card is same design as dsh
start page card; icon + label + 2nd row (no thumbnails)"*):

| Screen | What it is |
|---|---|
| home | the wallet strip, then **one accordion section per provider — every one in the registry, in registry order, minus the ones switched off in Settings → Generate** — each header carrying the provider's status light, its name, `family · count`, and two glyph controls on the right: **add a workflow** and **refresh**, both with a hover tooltip; the open section holds that provider's workflows as cards; under the sections, where the key is managed |
| a workflow card | the harness's own start-page card: **glyph + title + one line**, no thumbnail. The second row is whose app it is (when that is a fact), then the blurb; a workflow with no description falls back to the provider's name. The provider is not on the card — the section header names it, and `data-generate-provider` carries the fact in the DOM |
| the add glyph | the add path for every section, empty or not, in the header beside refresh. One click reveals **that provider's own install prompt** (`addPrompt`) with Copy beside it — the sentence the agent's skill answers to — and opens the section if it was closed |
| an open section with nothing in it | one quiet line saying so and naming the glyph that fixes it (`pane.section.empty`). It is replaced by the prompt when the glyph is clicked |
| a workflow | its surface, in the same pane: **doors as controls** in `ui.order` with the primary door first, the app's tooltip under each, `advanced` doors behind one disclosure, the app's own bounds/options/defaults on every control, and a way back to the list |
| the host did not answer | that, said plainly — not a false "nothing installed". A section whose list failed says so inside its own body, and when no provider answered the pane draws the failure block instead of the accordion |

One section is open at a time, and the first provider that actually has workflows opens
by itself: landing on four closed rows would hide the thing the pane exists for.
Providers are drawn whether or not they are linked, because a section is where its add
card lives — an install that showed only the providers that already work could never be
filled.

### Hiding a provider, and why the switch is live

**Asked for by the founder on 2026-09-23:** *"I want a toggle inside settings to hide providers that I don't
use much for less visual clutter."* Every row in `Settings → Generate` carries a switch at its far right, ON
meaning "draw this provider in the panel"; a row switched off says **Hidden** on itself, because an absent
section explains nothing. Hiding is a display preference and never a link: the key stays in credentials, the
adapters stay on disk, the row stays on the page. The one file it writes is `<root>/providers.json`
(`{ "hidden": ["magnific"] }`), and an id nobody recognises is kept rather than forgotten — Magnific left the
registry and came back once already.

The switch and the panel are on screen at the same time (Settings is a dialog over the app), so the provider
list is **one store both surfaces subscribe to**, not a copy each. That is the fix for the founder's
2026-09-23 report — *"I tested toggle and it works if I restart"*: holding a copy each, the switch moved its
own row while the pane behind it went on drawing the provider until the app restarted. A local change now
marks the list newer than any read already in flight, so a slow host answer cannot undo a switch just thrown.

**No node id and no field name is ever drawn** (E7's acceptance gate): those belong
to the payload gate, as JSON to read, which is the next slice with the run strip and
the result. The surface says so at its foot rather than offering a button that lies.

Opening a workflow can also be driven by an opener: the tab kind takes
`params.unit` and the body opens that unit directly. The card carries no params, so
the ordinary path is the list.

`multiple` is still absent on purpose: one pane holds the surfaces, so a second tab
of the same kind would only duplicate the hub.

An entry is listed only if it could be opened: the schema is this version,
`provenance.dryRun` is `ok` (which is what "only after `rh_adapter_validate` passes"
means in a file), and `origin` is set. `readAdapter` applies the same three rules plus
a file-name check, so `?name=../…` is refused before any file is opened, and the file
must carry the name it was asked for.

## The run (S5, built for Krea on 2026-09-23)

**Asked for by the founder the same day the model landed:** *"i want s5 for krea"*.

Four rules from §12 are structure here rather than style:

- **Nothing is submitted without a person confirming a payload they have seen.** The Run control (labelled by the
  adapter's own `ui.runLabel`) opens a gate: the model, the endpoint, every value under its door's label, and —
  behind one disclosure, as JSON to read and never to edit — the exact request. Cancel returns to the form with
  every value intact.
- **The preview and the request are ONE function** (`lib/krea-run.js`, `buildRunPayload`). The browser asks the
  host for the preview, and the host posts the body it just showed; a preview assembled in the browser would be a
  second implementation, and the two would drift into a dialog that describes something else.
- **The route enforces the gate, not the dialog.** `POST …/<id>/run` refuses a call that does not carry
  `confirmed: true`, so a script, a stale tab or a future agent tool cannot spend without a person. The flag and
  the payload go into that run's own file — `<profile>/generate/krea/runs/<jobId>.json` — which is what makes
  "what did we ship and why" answerable later. **No key is ever written to it.**
- **A payload the API would reject is refused before the POST**: a select outside its `enum`, a number outside the
  app's bounds, a required door still empty, an image door holding a browser file path instead of a URL, a list
  longer than the API's own `maxItems`, and a row whose own required field is empty (named by its place —
  `styles[0].id`). A `400` from Krea is a bug in this plugin, not a way to spend a credit.

| Route | What it does |
|---|---|
| `POST /plugins/generate/providers/<id>/payload` | the gate's preview: `{ name, values }` → the exact body, what is still empty, what is refused. Free: no key, no network, nothing spent |
| `POST /plugins/generate/providers/<id>/run` | `{ name, values, confirmed: true }` → `{ jobId, status }`; anything without the flag is refused by name |
| `GET /plugins/generate/providers/<id>/run?job=<id>` | one poll → `{ state, status, urls, error }`, and the run's file gains the outcome on a terminal state |
| `POST /plugins/generate/providers/<id>/asset` | the upload an image door calls: the body IS the file, `X-File-Name` and `Content-Type` say what it is → `{ url, asset }`. Refused with `501` for a provider that declares no `upload` |

One job at a time. The host posts the body with the provider's key from the credential store and answers with a
job id; the pane polls the host every two seconds, which asks Krea and writes the outcome back. The strip says
`queued`/`running`, the elapsed seconds and the job id; a failure shows **Krea's own message verbatim** beside the
job id and a way back to the form; a finished run draws the returned image with a link to it.

**Krea is the provider that can run.** A model carries its own endpoint and its doors carry the API's own field
names, which is everything a generation needs. RunningHub's run is a different job — a workflow's node ids, and an
upload for every image door — so its surface still says running comes next, and the routes answer `501` for it
rather than pretending.

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

### Designing the screen (`design-generate-screen`)

The install produces a file; something still has to decide what a person sees. That is the second shipped
skill, and it is why there are two: a model handed one long document does the mechanical half (read the app,
write the fields) and skips the judgement half (which doors stand on the main screen, what they are called,
what the button says). Split, each document's rules are read where they apply.

The design skill is a pass over the adapter's authored fields against the pane's own rules:

- **Five controls, and the app picks one.** `image`, `text`, `number`, `select` — the adapter's vocabulary —
  plus `list`, which only a catalogue's array-of-objects field earns. A door the pane cannot draw is dropped,
  not guessed at.
- **Four doors on the main screen** (`house.mainDoors`), one of them `primary`; the rest behind the one
  disclosure `advanced` means. Seeds and sampling knobs are advanced by default.
- **The order is the work's order** — subject, references, notes — and `ui.order` beats everything.
- **The words are the profile's**: `label`, `hint`, `title`, `blurb`, `ui.runLabel`, and `ui.expect` only when
  the wait was measured or told.
- **Five screens carry a workflow** and only one is per-workflow: the start-page card, the pane home, the
  workflow surface, the payload gate, the run strip and result. The skill walks all five so a design does not
  fight chrome it cannot change.
- **It writes no plugin code.** A design that needs a shape the pane does not have is a plugin change, and the
  skill says so rather than inventing one.

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
node verify/models.mjs           # the Krea models: the catalogue, the profile layer, both routes
node verify/run.mjs              # S5 + the upload: the payload builder (lists included), the gate the route
                                 # enforces, the poll, the record, and the asset route an image door calls
node verify/skill.mjs            # both skills' order, and that the plugin has no write path
node verify/start.mjs            # the hub: the cards, the surface, one settings page, and what may be listed
node verify/mount.mjs --static   # registration only
```

`verify/mount.mjs` runs the shipped `lib/client.js` in a stubbed loader and reads every registration back off
a recording ctx. `verify/wallet.mjs` imports `lib/index.js`, mounts the route against a recording web server, and
drives it with a stubbed RunningHub and a recording credentials seam — including the rule that no response
body ever carries a key. Its fixtures use the seam's real `source` values (`file`, `env`); they said
`store`/`environment` until 2026-09-22, strings the seam never emits, which is how the strip came to call a
pasted key "from your environment" while every check stayed green. `verify/save-confirmation.mjs` (**65/65**) renders the shipped components with React stood in for by a shim
with working hooks and a stubbed `fetch`, presses Save and Remove key, and reads what the surface does next: a
confirmation dialog naming the key, the wallet read and where the balance went, nothing at all for a refused
key, a dialog that closes on dismiss or on the next keystroke, the strip's note for each real `source` value,
the fresh-install and linked panes both naming Settings → Generate as the place the key is managed (with the
info glyph, and the linked note in its own block below the sections rather than beside the strip), **the fresh
pane telling the user how to add a workflow, under the key directions, with the trigger phrase intact in `zh`
too, and the linked pane adding one through the glyph in the provider's own section header**, and for rotation a
question that deletes nothing until it is answered, declined without a `DELETE` leaving the wallet linked, and a
receipt in the same dialog once it is.
`node verify/save-confirmation.mjs --show` prints the dialog's lines in order — including both pane states,
which is how the copy above is read without restarting the app. A skip is printed as `SKIP`; a layer that ran
and disagreed fails the run. Mutation-tested while the suite held 62 checks, **before the pane became an
accordion (2026-09-23)**: **58/62 with the note's info glyph removed**, **59/62 with the
add line dropped from the linked pane**, **61/62 with the two notes swapped** and **61/62 with the `zh`
trigger translated away**. Those four mutations were not re-run against the accordion — the "add line on the
linked pane" one targets a note that no longer exists there — so treat them as the record of the earlier
suite, not as a score for this one.

`verify/start.mjs` (**205/205**) is the pane's own suite: it renders the shipped `lib/client.js` against the
four-provider stub and reads the whole home screen back. It holds the surface's registrations (the pane seat,
the chip, the harness's own guide card, ONE settings page), the settings page's Models shape, and the pane:
**one accordion section per provider in registry order, all four whether linked or not**, each header naming
its provider and its `family · count`, the section with workflows opening by itself, one section open at a time,
a card carrying its workflow's title and its one-line second row with **no thumbnail**, the add glyph in the
header beside refresh revealing that provider's own prompt only when clicked (and wearing a tooltip on hover,
as refresh does), an empty open section saying so and naming that glyph, a failed list saying so instead of
wearing the empty state and offering no add control at all, and a workflow's doors rendered as the app's own
controls. It
also drives the host half for real over temp directories: what may be listed, and what `readAdapter` refuses.

`verify/adapter.mjs` (**96/96**) drives both tools through the definitions the plugin actually registers, with
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

`verify/skill.mjs` (**56/56**) mounts the plugin against a recording skills registry and reads the text the
host would serve for **both** skills: each is the shipped file byte for byte, `add-rh-workflow`'s ask comes
before its fetch and its confirmation before its write, `design-generate-screen`'s rules come before its steps
and it carries the four rules the pane cannot bend (no node id or field name drawn, nothing spends without the
gate, the app is the authority on numbers, four doors on the main screen), its five controls and its five
screens are all named, it sends an uninstalled workflow back to the install skill, and the host half contains
no `writeFile`, `mkdir` or LLM import at all. Mutation-tested the same day the design skill landed (**56
checks**): **55/56 with the confirmation step renamed away**, **55/56 with the rule against invented authors
removed**, **55/56 with the "no node id, no field name" rule removed**, **55/56 with the gate rule removed**,
**55/56 with the four-door budget turned into "any number of doors"**, **55/56 with the opening design step
renamed**, and **55/56 with the rules moved after the steps** — every one fails on the claim it breaks, and
none of them takes a second check down with it.

## Not in this package, by rule

Nothing Muen-specific sits on a stranger's path: no app id, no workflow name, no
key, no Muen service. Only upstream `@deepseek-ai/*` services, the harness's own
theme aliases (`--dsw-alias-*`), and this package's own copy — so it is a plain
Cordis plugin in any DSH (`docs/plans/61-runninghub-generate-space-epic.md` §5).

The package name is settled: **`@muen/dsh-generate`** (epic 61 D10/Q4, ratified
2026-09-22), so a RunningHub user searching the market finds it. The surface inside keeps
the label **Generate**, the tab kind stays `generate`, and the row id is `runninghub` —
which is also the profile directory the surface's own data lives under
(`<profile>/runninghub/`), so a later rename moves that directory with it.
