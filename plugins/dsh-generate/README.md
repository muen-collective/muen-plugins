# @muen/dsh-generate

The Generate space for DeepSeek Harness: link your own provider account (RunningHub
today), add a workflow by pasting its app link, and open each installed workflow as a
surface inside the one Generate pane. Epic 61.

**This is S1 + S2 + S3 plus the provider registry and the pane as a hub: the plugin installs, the surface
mounts, each provider's key can be linked on the one Generate settings page, a workflow can be added from its
app link, and the pane opens on a minimal dashboard — one block per provider, a caption line and a facts line
over that provider's workflows as start-page cards — a card opening that workflow's surface inside the same pane.**
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
| `/plugins/generate/providers/<id>/results?name=&limit=` | **the session's own read** (epic 64 S3): that workflow's runs, newest first, each carrying the values it was asked for (keyed by the API's own field name, so a form can take them back) and the state of every file it saved. A run whose outputs are ALL in `_trash/` **leaves the strip** — a delete is a decision about the series — while a file that has merely gone, or is on an unmounted volume, keeps its row and reads Missing or Offline, because a gap in a series is information |
| `/plugins/generate/providers/<id>/result?job=&i=` | **the bytes of a finished run's own file** (epic 64 S1): the path comes from that run's record (`outcome.saved[i].file`), never from the query, so a caller names *which* output and cannot ask for a file this host never wrote. `404 no-result` (the run saved nothing) and `404 missing-file` (it saved it and the file has since moved) are different answers, because the asset library draws them apart |
| `/plugins/generate/providers/<id>/state?name=` | the per-workflow values the surface used to save as a person edited: `GET` them back (or `{}`), `POST { name, values }` to store. **Superseded (epic 64 S5/S6): the surface no longer writes it and nothing reads it back into a form.** The snapshot kept one person's last tweak per workflow, which is the "a one-off tweak becomes everyone's default" the founder's knob rule forbids — a **session** keeps the values that were used, and the values a form OPENS with come from the adapter's authored `ui.defaults`. The route stays mounted and tested (`verify/result.mjs`) for the record. **Broken until 2026-09-26** — see the note under the table |
| `settings.section` | exactly ONE settings page, id `generate`, listing every provider in the Models → Providers shape: a row per provider with a credential dot and its key state, one open editor card at a time, the API key as the primary field, and the install prompt where Models puts a model list |
| the client locale registry | namespace `generate`, en + zh |
| `ctx.tools` | `rh_workflow_graph` (read an app's doors) and `rh_adapter_validate` (check a written adapter) |

**The strip under the canvas is the session** (epic 64 §6, founder: *"in RH the filmstrip below the main preview
keeps it contained as a 'session'"*). One row per run of the open workflow, newest first, drawn in the preview
card under the picture; a row's file that has gone keeps its place and says **Missing** rather than vanishing; and
**clicking a row is regenerate** — that run's values go back into the form and its picture onto the canvas, while
nothing runs and no gate is bypassed, because the press that spends is still the person's own. The strip is why
the per-workflow restore was retired: the row is where a one-off tweak lives.

**And the session starts EMPTY from the card** (founder, 2026-09-26: *"if you arrive at the workflow from the
card it should be empty, the session starts from empty and if arrived from asset / regenerate it shows the
session"*). So a workflow's history is not on screen by default — and no history is even read — and the strip
fills from two directions: a run done in this visit joins it (only that run), or a tab opened to **continue** one
arrives with its params and shows the whole series with that run selected.

**The carrier: a picture can say what made it** (epic 64 S8). ComfyUI writes its graph into the PNG it
saves — `tEXt` chunks keyed **`prompt`** (the API graph: one entry per node id with its `class_type`) and
**`workflow`** (the UI graph), beside RunningHub's **`AIGC`** provenance label. `lib/carrier.js` reads that and
answers what a surface can draw: `supported` (could this format be read at all), `hasGraph`, the API graph's
**node count and class types** — the same `(nodeId, class_type)` space an adapter's doors use — the UI graph's
nodes/links/version, and the label. **A file carrying only `AIGC` reports NO GRAPH rather than an empty one**,
and a JPEG or WebP reports `supported: false` rather than "no graph", because those carry the same data in EXIF
and this reads PNG only — an empty graph, no graph, and not-read are three different facts. Measured on this
machine: **all 21 PNGs the plugin's own runs saved carry the label and no graph**, while the canvas export the
founder kept carries all three chunks (a 6,022-byte `prompt`, a 22,254-byte `workflow`, a 285-byte `AIGC`; the
API graph is keyed by node id and its `class_type` values are what a door names). **Writing is an export, not
a run**: `exportGraphPng` injects the chunks after `IHDR`, replaces a key already present rather than writing
it twice, and **refuses to write a lie** — no graph, or not a PNG, writes nothing. That is what makes a picture
from this panel open in a local ComfyUI, with the graph coming from the app that ran it rather than from the
provider.

**The carrier's route and surface are still owed**: nothing draws "this picture carries its graph" yet, and
the export has no control. The module is what they will call.

**The pane is what writes a session, and opening a form is not the same as starting work** (epic 64
S6, first half). A session is created by the **first change** to a door — not by opening a workflow, because
someone who opens a form and looks at it has not started anything, and a store that fills with empty sessions
is a store nobody can use. Every later change is written on the same 500 ms debounce the per-workflow snapshot
used, and **a run that settles is written at once**: its job id is the one thing a crash could lose from a
session, and the strip already reads that id live. The id the store answers with travels on every later write,
so an autosaving pane never has to know whether this is the first one.

**And a tab can come back to it**: `openTab('generate', { params: { session } })` (epic 64 S6) reads the
session, opens the workflow that session names — a session carries its provider and adapter, so unlike
`params.run` it needs nothing beside it — and fills the form with the values that were used **on top of** the
authored defaults, so a door the session does not mention keeps the value the adapter authored. The session's
own run ids join the strip, because the rows ARE the session, and a session that cannot be read is not an
error screen: it is a form at its defaults, which is where a person would have started anyway.

**A session is a piece of work, written down** (epic 64 S5). One file per session at
`<profile>/generate/sessions/<id>.json`, holding the workflow, the values it was run with, the
picked files (by the hash S2 kept) and the run ids those values made — the smallest honest
version of the job session, where `values`, `uploads` and `runIds` are exactly one entry of a
future `steps` array. **The run record stays the per-job truth**: a session is an index over run
ids plus the form, so no payload is written twice under two spellings, and a session whose
workflow has since been removed still lists with its runs intact — the record of the work
outlives the tool that made it. **The per-workflow `state/<workflow>.json` snapshot is
superseded**: a session's rows hold the values that were used, and the values a form OPENS with
come from the adapter's authored `ui.defaults`, because keeping a snapshot would let one
person's one-off tweak silently become everyone's default. And **a file that is not ours is
reported, not obeyed**: a newer schema or a half-written file arrives in `skipped` with its own
reason rather than being merged or failing the list.

**That handoff carries three facts, not one** (epic 64 S7). The opener is
`openTab('generate', { params: { run, unit, provider } })` — the run, the workflow it belongs to, and the
provider it ran on — because this pane opens a **workflow** tab and then shows the run inside it: a bare job id
names nothing to open, and resolving one here would duplicate what the asset already read off the record. The
Asset library sends exactly those three. And when the workflow named is not installed any more — three records
on this machine name adapters that were removed — the pane says so **by name** on the start screen rather than
landing on the grid in silence, which is the receiving half of S7's "never a dead link".

**A record's unit is under whichever name its own runner wrote** (`unitOf` in `lib/run-record.js`): RunningHub
writes `adapter`, Krea writes `name`. The strip's own read filtered on `adapter` alone, so no Krea run could
ever appear in its own workflow's series — found while wiring S7, fixed, and now pinned by a Krea fixture that
carries what production carries.

**The state route was dead, and its failure looked like a decision.** Two faults stacked: it read
`provider.root`, which no provider has (a provider's own directory is `provider.data(root.root).root`), and it
read `req.body`, which no seam sets — every POST answered `400 missing-name` and every GET threw before it
reached the disk. So the "remember the last values" behaviour never worked, which is why the founder concluded
the form should open clean (the rule that stands: a measured optimum belongs in the skill, the adapter's
`ui.defaults` and the handoff, never in what the last person typed). Both faults are fixed, and
`verify/result.mjs` holds the round trip so the route cannot quietly die again.

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

**The picked file is kept on this machine** (epic 64 S2). The handle a provider answers is not a durable
record of what went in — RunningHub's guide says the file is not hosted, and Krea's asset link has its own
lifetime — so the route hashes the bytes and writes them once under the provider's own root before the
answer goes back, and the answer carries the hash beside the handle. That copy is what a restored session
re-uploads from; without it a reopened form would hold a dead handle and the session could not say what it
was given. The profile is the right home (epic 64 §8): an upload is an input to a form, not a picture the
person made, and it has to survive the save folder being changed.

**And the image doors really upload.** Krea's `image_url` and a style reference's `url` each take *"an
external URL, base64 data URI, or uploaded asset URL"*, but a real photograph inlined as a data URI is far
past the 1024 characters those fields allow — so a picked file goes to `POST /assets` and the door carries
the `image_url` that comes back. The call needs the key and the pane holds none (§12 rule 2), so it goes
through the host: `POST /plugins/generate/providers/<id>/asset`, with the bytes as the body and the file's
name and type in headers. The provider says whether it can do this (`upload` on its registry entry, reported
as a capability in the provider list), so RunningHub's image doors draw the URL field and no pick control
until its own run slice lands.

**An empty image door is one dashed drop area and nothing else** (founder, 2026-09-25: *"the upload image
card looks messy, make it more clean with drop area + icons below for finder or link"*. Then, the same day:
*"we don't need finder button since click on the drop area does same thing"*, and *"i can't get url to work.
maybe we don't need on local, user can download and upload is better"*). What is left is the shape the
founder's reference had minus the parts he did not want: the dashed area holds one glyph and one sentence —
*Drag & drop, or choose a file* — it takes the drop, and it is a `label` for the hidden file input, so pressing
anywhere in it opens the dialog. A dropped file and a picked one travel the same upload. **There is no second
control**: the Finder tile went because the area already does it, and the URL button and its dialog went with
the founder's verdict that downloading and uploading beats pasting a link. A provider that declares no `upload`
still gets a plain field — it is the one place a link is typed, so the frame keeps an answer for a link the
browser refuses (the neutral mark and *That URL did not load an image.*, never a broken-image glyph). The glyph
above the sentence is the bundle's one hand-drawn mark (`IconUpload24`): the harness's icon set has
`IconDownloadOutline` and nothing for the other direction.

**A filled door is cleared by a badge on the picture** (founder, the same day: *"to clear the upload use a badge
close icon in the top right corner"*). The frame is the positioning context and the badge — a 20px circle
carrying the app's own close glyph, on its own solid surface so it reads over any picture — sits at its
top-right. The row of actions under the picture is gone with it: a cleared door goes back to the drop area,
which is where both ways in live.

**AN EMPTY SECOND IMAGE WAITS FOR THE FIRST** (founder, 2026-09-25: *"its drops in order not by left/right
position. we can disable image 2 and message user to drop image 1 first"*). The reason is outside the panel:
`@deepseek-ai/dsh-client-ui-attachment` listens for `drop` on `document` with no check on the drop target, so
every file dropped anywhere in the app reaches the composer's tray in the order the drops happened — not in the
order of the doors. A panel that let a person start with the second image would hand the composer the two
pictures backwards. So while an earlier image door in the same form is empty, a later **empty** one takes no
drop, opens no picker (its input is there but `disabled`), dims, and says *Drop Image 1 first* — naming the
earlier door by its own `label`, so the sentence follows any adapter's own words. The rule looks only backwards
and only at empty doors, so the first image door is never held back and a door that already holds a picture is
never blocked: the guard cannot trap a value a person wants to clear. It is a guess about the composer's order,
not a fence around the panel — a person can still drop anything onto the composer directly, and the sentence is
what makes the two agree. The panel's own handler takes `transfer.files[0]` and never stops propagation, which
is why one drop feeds both.

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
dashboard rather than at the top of the pane. Both notes are led
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

On a linked pane it is the **glyph on that provider's facts line, immediately left of refresh**
(founder, 2026-09-23: *"move + workflow button as an icon button next to refresh. also add tooltip on hover for
both"*): the glyph opens that provider's own `addPrompt` with Copy beside it as a **popover** anchored under it
(founder, 2026-09-25: *"click add button launch popover w snippet"*) — placed by the primitives'
`useAnchoredPosition`, dismissed by `useDismissOnOutsidePointer` or Escape, drawn on the opaque layer-2 card with
the l3 border and the menu's elevation (the menu's own translucent fill needs a `backdrop-filter` this bundle does
not have: *"fix popover; it should have solid bg (its transparent now)"*). Both facts-line glyphs — add
and refresh — wear the harness's own `Tooltip` on hover, not a native `title`, and carry the same words as their
`aria-label`.

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

**The home screen is a minimal dashboard** (founder, 2026-09-25: *"it should be minimal like
start surface and make like dashboard"*). It was a stacked accordion until then (founder,
2026-09-23: *"I want to try stacked accordion to each provider inside an accordion … the
workflow card is same design as dsh start page card; icon + label + 2nd row (no
thumbnails)"*), and what went is the section card, its hairlines and its fold — the facts
stayed, drawn on the page's own background:

| Screen | What it is |
|---|---|
| the header | **the DSH strip's own pattern, one row lower**: a tab per open workflow and a bare plus, directly under the DSH strip's separator and **sticky** like it (the row used to scroll away with the grid, so the plus vanished the moment a person looked down the card list). Founder, 2026-09-25: *"same navigation but below the dsh navigation. same pattern but below the separator"*, then *"the dsh pattern does not have all workflows, it uses add button to create new tab and uses start screen to add the tab"*. There is **no "All workflows" tab** — the start screen is not a tab; the plus shows it, exactly as DSH's own `addTab` opens the `guide` tab, and a card on that grid is what opens a workflow's tab. A tab is **named by its workflow's title**, never by the adapter's file name (two Qwen apps truncate to the same `qwen-2-1-image-e…`) and carries a `×`, because every tab on this row is an open workflow — and that `×` is **hidden until its tab is selected, hovered or focused**, the DSH strip's own rule (*"the pattern in dsh is when the tab is unselected there is no close icon"*, 2026-09-25: `_tabClose_11olo_411` is `opacity:0;pointer-events:none` at rest and revealed by `:hover`, `:focus-within` or the active tab; the plugin carries it as `.dsh-generate-tabClose` in its one injected sheet, and hides rather than removes the glyph so a tab never changes width when it is selected). A workflow whose title is too long for a tab authors a short one — `ui.tabLabel` (*"the workflow tab fontsize too big, maybe we need to use different names in to make it easier to read. Qwen Duo / Qwen Multi / H3 F/L / Krea Raw / Krea Turbo / Krea Medium / Krea Large"*): the **card keeps the title** and the narrow tab reads the short name, falling back to the title when none is authored. Tabs are the harness `Button`'s own `sm` capsule geometry at its own type (**12px on an 18px line**, not the pane's 14px) and **as wide as their label** — no cap, no ellipsis (`"can we make width of tab to show entire label?"`); the row scrolls when the names do not fit. The **open one draws the primitive's `outline` border** (`.5px solid --dsw-alias-border-l3`), the others keep the same border transparent so switching moves no pixel. **With nothing open there is no row at all** (founder, the same day, on the start screen with a lone plus on an otherwise empty strip: *"we don't need add icon here"*): the start screen is not a tab and needs nothing beside it, so the pane goes straight from the separator to the grid, and the plus lives only where it means something — getting back to that start screen from a workflow. The control **says what it is** — the plus glyph then the word **Add** (`tabs.addLabel`) — so it never reads as the DSH strip's own bare plus above it (*"lets change + to +add to keep disinction"*), and it wears the **same state a tab does**: the primitive's `outline` border while the start screen is the view, a plain ghost while a workflow is (*"when I click + there should be border if we follow pattern"*), so which view is showing reads the same on both controls. The row **draws no separator of its own** (*"remove separator"*): it wore a `.5px solid var(--dsw-alias-border-l2)` hairline above itself for a few hours (*"add separator below the panel tabs"*, then *"move separator above the generate tabs (between files & qwen"*), which stacked a second line on the one the header carrying the DSH strip already draws, so the boundary read as one thick rule; that app line stays, and the tabs take the **strip's own 10px of breath above and below them** (*"add gap spacing same as between top of viewport and top edge of panel tab (generate)"*, clarified as *"i meant same spacing top and bottom"*) |
| home | a centred column at the guide's own 380px, centred on the page as well as across it, on the page's own background — no card, no separator, nothing to fold — drawing **one block per provider, every one in the registry, in registry order, minus the ones switched off in Settings → Generate**: a caption line with the status light and the provider's name (plus the glyph out to its account page), then a facts line with the wallet balance (**11px, in the muted caption ink**, and no count line: founder 2026-09-25: *"make coins usd key saved small muted font color / fontsize sm"*, then *"remove workflows 3 installed"*) and two glyph controls, **add a workflow** and **refresh**, both with a hover tooltip; under them, that provider's workflows as cards; under the blocks, where the key is managed |
| a workflow card | the harness's own start-page card: **glyph + title + one line**, no thumbnail. The second row is whose app it is (when that is a fact), then the blurb; a workflow with no description falls back to the provider's name. The provider is not on the card — the caption line names it, and `data-generate-provider` carries the fact in the DOM |
| the add glyph | the add path for every block, empty or not, on the facts line beside refresh. One click opens **that provider's own install prompt** (`addPrompt`) with Copy beside it, as a **popover** anchored under the glyph, placed by the primitives' `useAnchoredPosition` and dismissed by `useDismissOnOutsidePointer` or Escape (founder, 2026-09-25: *"click add button launch popover w snippet"*). Its surface is the **opaque** layer-2 card with the l3 border and the menu's elevation — not `--dsw-specific-menu`, which is ~50% alpha and needs the `backdrop-filter` the app's own menus carry (founder, the same day: *"fix popover; it should have solid bg (its transparent now)"*). It used to open inline at the foot of the block, which pushed every card under it down |
| a block with nothing in it | one quiet line saying so and naming the glyph that fixes it (`pane.section.empty`). It stays on screen while the popover is open, because the popover is not part of the body |
| a workflow | its surface, in the same pane, UNDER the header's tab row: **doors as controls** in `ui.order` with the primary door first, the app's tooltip under each, `advanced` doors behind one disclosure, the app's own bounds/options/defaults on every control, a **number door drawn as the stepper** (minus · value · plus, stopping at the app's own bounds), and **two wrapping columns** — parameters and the run control on the left, the run's own state and its result on the right. No way-out button of its own: the header's **All workflows** tab is the way back |
| the host did not answer | that, said plainly — not a false "nothing installed". A block whose list failed says so inside its own body, and when no provider answered the pane draws the failure block instead of the dashboard |

Every block is open, because nothing folds any more (founder, 2026-09-25).
Providers are drawn whether or not they are linked, because a block is where its add
control lives — an install that showed only the providers that already work could never be
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
| `POST /plugins/generate/providers/<id>/restore` | **re-upload one kept input** (epic 64 S6): the body names a door and the `sha256` the upload copy was stored under, and the answer is a FRESH provider handle. The file is found by **scanning this provider's own `uploads/`** for a name that starts with that hash — a caller cannot ask for a path, so this route cannot read a file the library never kept. A hash nothing kept is `404 no-copy` (a different answer from a provider that refused), and a `sha256` that is not one is `400 bad-hash` |
| `/plugins/generate/sessions` | **the session store** (epic 64 S5): `GET` the list (newest first, plus every file that is NOT a session, named in `skipped`), `POST` a session to create it or update it in place, `DELETE ?id=` to remove one. One file per session at `<profile>/generate/sessions/<id>.json`, schema `muen-generate-session/v1`. The id is sanitised into a plain file name, an empty body creates nothing, and a write carrying an unknown `schema` is refused rather than stored |
| `POST /plugins/generate/providers/<id>/asset` | the upload an image door calls: the body IS the file, `X-File-Name` and `Content-Type` say what it is → `{ url, asset, kept }`. **The picked file is KEPT** (epic 64 S2) at `<provider>/uploads/<sha256>.<ext>` — content-addressed, written once however many times it is picked, the extension from the content type rather than the name, and `kept` answers `{ sha256, file, bytes, name, type, ext, existed }` beside the provider's handle. **A failed copy never fails the upload**: `kept` carries the error and the provider's answer stands, because a full disk must not stop a person from generating. Refused with `501` for a provider that declares no `upload` |

One job at a time. The host posts the body with the provider's key from the credential store and answers with a
job id; the pane polls the host every two seconds, which asks Krea and writes the outcome back. The strip says
`queued`/`running`, the elapsed seconds and the job id; a failure shows **Krea's own message verbatim** beside the
job id — and the form never left the screen, so the Run button is the way to try again. A finished run draws the
returned image with a link to it.

**RunningHub runs too, since 2026-09-23.** Its run is a different job from Krea's and it is built in
`lib/runninghub-run.js`: the payload is a **node list** built from the adapter's own `(nodeId, fieldName)` pairs
(`{ nodeId, fieldName, fieldValue }`, one entry per door that carries a value, in `ui.order`), posted to
`POST /task/openapi/ai-app/run` with the app id and — when a person chose one — the `instanceType`. The task is
read back in two calls: `POST /task/openapi/status` answers `QUEUED`/`RUNNING`/`FAILED`/`SUCCESS`, and on a
terminal state `POST /task/openapi/outputs` answers the `fileUrl`s, or `code: 805` with
`data.failedReason.exception_message` — the failing node's own words, which is what the strip shows.

**Its image doors upload, because a node list cannot carry a URL.** `POST /task/openapi/upload` (multipart:
`apiKey`, `file`, `fileType=input`) answers a `fileName` — RunningHub's own guide: *"the unique path for file
loading … must be accurately passed to the corresponding node"* — and that `fileName` is the value the door then
carries. The limit is RunningHub's 30MB, refused before the request; above it their guide points at cloud storage
and a public direct link, which is why a pasted https URL is still a legal value. A browser file path is refused
by the payload builder: no node can load a file on the person's disk.

**Whether a surface can run is the PROVIDER's fact, not the file's.** `readAdapter` no longer writes
`runnable`; the workflow route adds it from the registry, so one adapter file means the same thing under a
provider that can spend and one that cannot. Comfy Cloud and Magnific still answer `501` on both run routes and
their surfaces still say running comes next.

**A FINISHED RUN SAVES ITS BYTES, because a link is not a result** (founder, 2026-09-23: *"also for saving to
local. we should think about folder organization"*, then *"let's make save folder default on desktop, and the user
can click to choose a different folder"*). RunningHub's upload links are documented as lasting a day and its
output host's lifetime is undocumented, so on the terminal read the host downloads what the provider answered and
writes it into **one library for the install**, rooted at the save folder — a chosen folder if there is one, the
**Desktop** otherwise:

```
<save folder>/<provider>/<workflow>/<yyyymmdd>-<jobId>.<ext>
```

Provider, then workflow, then the day as a filename prefix (the founder's call): the first two are how a person
looks for a thing again — "the outfit swaps from last week" — and a tree of mostly-empty day folders would be
worse than a date you can read. The extension comes from the provider's own `fileType` when it has one, then the
URL's tail, then the response's content type. Every segment is sanitised, so a hostile job id cannot climb out
of the library, and a path that is already there is left alone — a poll may read the same terminal state twice.
**A save that fails never fails a run**: the download's error is recorded beside the outcome
(`saveErrors`), the run still reports what the provider said, and the pane draws the saved path the host
answered with. Cloudinary is the next destination — the seam is a second write the record names, never a
dependency of the run.

**THE SAVE-FOLDER ROW IS CAPTURE ONE'S SHAPE** (founder, 2026-09-23: *"in capture one its like this, click on
icon to open finder"*). Settings → Generate's Save folder row draws the path as a **button** — clicking it opens
the OS folder dialog (`POST /plugins/generate/library` with `{ action: 'choose' }`, which starts at the current
root and stores what came back; a cancel answers the unchanged state) — an arrow beside it reveals the folder in
Finder (`{ action: 'reveal' }`), and the **Space left** line under it carries the volume's free bytes from the
host's `statfs`. The state answers `canChoose`, so a host with no dialog draws the path as text and 501s the
choose; the typed input stays for a path nobody wants to click through to, and `Use Desktop` puts the default
back. The choice persists in `<profile>/generate/library.json`, beside the provider directories and nowhere near
a key.

**A run's record is provider-neutral.** `lib/run-record.js` owns where a record lives
(`<profile>/generate/<provider>/runs/<jobId>.json`), how it is written and how it is read; each runner writes its
own `schema` (`muen-krea-run/v1`, `muen-rh-run/v1`). No key is ever in one.

**The run is one state drawn in two cards** (founder, 2026-09-23: *"Design for responsive, past mobile
breakpoint we should 2 column parameters + output preview"*, then *"let's make layout 2 cards, parameters card
and preview card, these are reusable components so when you build UI from design.md it will be consistent"*).
`useRun` owns the state; `RunControl` renders the button and the gate at the foot of the parameters card,
`RunOutput` renders the phase, the failure and the link in the card beside it. The two cards are a **wrapping
flex row**, so the breakpoint is the pane's own width — docked, split or fullscreen — and they stack in a narrow
pane with no media query and no window measurement. Both are drawn by **one `Card` component** (`lib/client.js`):
the raised layer, the border, the 12px radius and the 14px padding live there once, so the next panel in this
plugin gets them by using the component rather than by copying a style. The preview card is drawn before a run
rather than after one, so opening a surface and starting a run do not change the shape of the pane. A workflow
whose run is not built yet gets its preview card too, with the sentence that says so inside it, rather than a
lopsided pane that fills in later. Neither card carries a heading of its own (founder's call): the workflow's
title and blurb head the parameters card as content.

**THE QUEUE IS ONE ROW PER JOB, AND EVERY ROW STOPS ITSELF** (founder, 2026-09-25: *"the concurrency queue
should be 1 row each so we can stop each one individually"*). `useRun` keeps the whole `runs` array, and every
job in flight is now its own row under the preview canvas (`RunQueue` / `RunQueueRow`): the spinning glyph, the
phase, that job's own clock, its job id and its own **Cancel**, which posts that row's own `jobId` to
`/providers/<id>/cancel`. The band above the rows is the **account's** counts (RunningHub's `runningCount`,
`queuedCount` and `concurrentLimit`) and the rows are this surface's own jobs: two different facts, drawn
together and never reconciled, because the account also counts jobs this pane did not start. A settled job
leaves the list — a result belongs in the canvas, not in a queue — and **one timer polls every job in flight**,
so the first job can finish while the second still runs. Each start carries a client-side `localId`, so two
presses in the air at once cannot write into the same slot. Adding a third concurrent provider needs nothing
here: the rows come from the run state, not from the provider registry.

**The aspect door shapes the preview canvas** (founder, 2026-09-23: *"the aspect controls the shape of preview
card"*). The canvas inside the preview card takes its `aspect-ratio` from the workflow's own aspect door — the
one `preview.aspectDoor` names, or failing that the door whose key or API field name is `aspect_ratio`, which is
what both kinds of workflow call it. A value is read as a pair, not as a menu entry: `9:16`, `16:9`,
`1:1 (Square)` and `2.35:1` all carry it in their first characters, and the label a provider hangs off it is
ignored. So choosing 9:16 makes the canvas portrait **before** the run and the result lands in that same frame
(`object-fit: contain`, so no aspect is ever cropped), capped at `60vh` because a portrait canvas in a narrow
pane would otherwise be taller than the screen. A workflow with no aspect door gets a **square** canvas — the one
shape that never misrepresents a workflow — rather than a guessed one. `RunOutput` no longer draws the image at
all: it draws the phase, the failure and **Open in Finder** (founder, 2026-09-23: *"Open the image opens in browser,
but its more useful to open in finder"*): when the host saved a local file, the control posts
`{ action: 'reveal', file }` and Finder selects that exact file (`open -R`; `explorer /select,` on Windows); the
browser link survives only when the save failed, because the URL is then all that exists. The canvas above it owns
the picture. There is no
"Run again" button (founder, 2026-09-23: *"run again button can be removed"*) — the parameters card never leaves
the screen, so the Run button under the doors is the way to run again.

**The run control is two buttons where the provider declares run modes** (founder, 2026-09-23: *"RH has option
to run as plus vs ultra we can use this shadcn split button"*, corrected 2026-09-25: *"the split button is a
little weird, make it 2 buttons: generate (filled primary) + default select (outlined primary)"*). RunningHub's
own OpenAPI is where the modes come from — `POST /task/openapi/ai-app/run` takes `instanceType`, *"`default` uses
24GB VRAM; `plus` uses 48GB; `ultra` uses 84GB"* — so they are **provider data**, declared on the registry entry
(`runOption`) and carried to the page with the rest of the provider's identity. They are drawn as two controls:
the action as the harness `Button`'s **filled `primary`** and the mode as an **outlined `outline`** button that
shows the mode it will use and opens the harness's own `Menu` (whose documentation names the split-button case)
with one row per mode, each naming the machine it buys. Two buttons with the ordinary gap rather than one control
split in half: no shared border, no half-rounded corners, because the choice is not part of the press.

**The mode is part of what a person confirms.** The surface sends `options` with the payload and the run, the
host reads them through `runOptions` — the provider's own declaration, so an option nobody declared or a value
outside the declared modes is refused by name rather than forwarded into somebody else's API — and the preview
echoes the validated option back, so the gate draws the host's answer rather than the browser's memory. The
chosen mode is written into the run's record beside the payload. A provider that declares no modes (Krea, Comfy
Cloud today) keeps the plain run button and sends no options at all.

**A number door is a stepper** (founder, 2026-09-23, with RunningHub's own form as the reference: *"for number
input use the correct primitive"*): a bordered group with a square decrement, the value centred in tabular
figures, and a square increment — the design the founder pasted, drawn from the harness's own `Button` and the
theme aliases rather than by adding React Aria and Tailwind to a public plugin. Each click moves by the app's own
`step` and stops at the app's own `min`/`max`, where that side's button goes dead. The minus is the character
U+2212, because the harness's icon set carries no minus glyph (measured 2026-09-23).

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
- **A one-press fill is `ui.presets`, and it draws a sparkle over a menu** (founder, 2026-09-25: *"we should
  add sparkles icon to fill the prompt w subject swap skill to make the work faster"*, then *"make a
  sparkles menu, sparkles subject swap is a prompt writing skill, we can have other skill like face swap, add
  object (add these others but greyed for now) I just want to test UI"*). A preset is `{ label, doors,
  disabled? }`: the glyph appears at the **right end of the title row** of every door the presets fill — the
  label stays left, `space-between` puts the control at the far edge — and opens the harness's own
  `Menu`, one row per preset, and choosing one writes those doors and nothing else — no run, so nothing
  spends. A preset marked `disabled: true` is drawn greyed with a *Coming soon* note and chooses nothing, which
  is how a skill that is not written yet is shown without pretending it works. **The Duo's two greyed rows were
  placeholders for testing the menu, and they are gone** (founder, 2026-09-25: *"in the sparkles menu, remove
  2nd row 'coming soon' muted color"*): the profile adapter carries one row, *Subject swap*, and the capability
  stays in validation (`lib/adapter.js`) and in `verify/start.mjs`'s own fixtures. The words come from the
  workflow's own skill, which is why the Qwen Duo adapter authors the subject-swap template: the skill and the
  row then say the same thing. The value stays ordinary text afterwards, editable like anything typed.
  **PROMPT WEIGHT IS A PROPERTY OF THE WORKFLOW, NOT OF THE TASK** (founder, 2026-09-25: *"it seems like I've
  been over prompting, Qwen 2.1 prompt is much more minimal than Qwen AIO"*). The Duo's preset is one sentence —
  *The woman in Image 1 wears the outfit from Image 2.* — because that is the app's own example and the run the
  founder kept, while every panel run before it had carried ~400 characters of instructions about fidelity and
  draping. That long form was the **AIO** workflow's method, and the founder retired the AIO workflow the same
  day (*"we can remove qwen AIO, I think Qwen 2.1 definitely replace"*): the adapter
  (`qwen-rapid-aio-subject-swap`) is gone from the profile, so the Duo is the only Qwen 2.1 workflow in the panel
  and the one sentence is the whole prompt. See `skills/subject-swap/SKILL.md`, which teaches it.
- **The strip carries the way to stop a run** (founder, 2026-09-25: *"it seems like cancel button got
  removed"*). The host's cancel action and `useRun`'s own handler were both there; the control was not drawn,
  so a run in flight had no way out on screen. It sits at the end of the running strip — the phase, the clock
  and the job id are what a person reads, and this is what they press — asks the host to cancel that job id,
  and is gone the moment the run settles. A cancel spends nothing, so it needs no gate, and the pane keeps
  polling until the provider's own status settles.
- **Five screens carry a workflow** and only one is per-workflow: the start-page card, the pane home, the
  workflow surface, the payload gate, the run strip and result. The skill walks all five so a design does not
  fight chrome it cannot change.
- **The surface is two cards in a 2:3 row** (founder, 2026-09-25: *"the ratio of parameters/preview try
  2/5:3/5 of 5 column after a mobile breakpoint"*): the parameters card takes two fifths of the pane's width
  and the preview card three, until the pane is narrower than their minima, where the wrapping row stacks them
  and each takes its own line. A zero flex basis with the grow factors 2 and 3 is what makes the fractions
  exact; the breakpoint is the pane's own width, because the pane is what resizes.
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
node verify/run.mjs              # S5 for both runners: the payload builders, the gate the route
                                 # enforces, the poll, the record, and the asset route an image door calls
node verify/skill.mjs            # both skills' order, and that the plugin has no write path
node verify/start.mjs            # the hub: the cards, the surface, one settings page, and what may be listed
node verify/mount.mjs --static   # registration only
```

`verify/mount.mjs` runs the shipped `lib/client.js` in a stubbed loader and reads every registration back off
a recording ctx. `verify/wallet.mjs` imports `lib/index.js`, mounts the route against a recording web server, and
drives it with a stubbed RunningHub and a recording credentials seam — including the rule that no response
body ever carries a key, and the save folder's own route (**132/132**): the Desktop default, the typed choice
refusing an unresolvable path, `{ action: 'choose' }` starting the (faked) dialog at the current root and
storing its answer, a cancel leaving the state alone, a non-absolute answer refused, `{ action: 'reveal' }`
opening the current root and following a reset to the default, a `501` from a host with no dialog, and a
failed reveal reported as its own error. Its fixtures use the seam's real `source` values (`file`, `env`); they said
`store`/`environment` until 2026-09-22, strings the seam never emits, which is how the strip came to call a
pasted key "from your environment" while every check stayed green — and the two sentences that bug produced
(`stored on this machine`, `from your environment`) are gone from the page as of 2026-09-25 (*"remove stored on
this machine"*), since a person cannot act on where the seam found the value; only `settings.readOnly` stays,
because it changes what they can do. `verify/save-confirmation.mjs` (**65/65**) renders the shipped components with React stood in for by a shim
with working hooks and a stubbed `fetch`, presses Save and Remove key, and reads what the surface does next: a
confirmation dialog naming the key, the wallet read and where the balance went, nothing at all for a refused
key, a dialog that closes on dismiss or on the next keystroke, no provenance sentence for either real `source`
value and the read-only sentence for the one that cannot be changed from the page,
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

`verify/run.mjs` (**79/79**) drives both runners against a temp profile and stubbed APIs: Krea's payload
builder (lists included), the gate the route enforces, the poll and the record; and RunningHub's node list in
`ui.order`, the fields it refuses (a browser file path), the run posted with its key, app id and machine, the
status call that answers in flight without asking for outputs, the outputs call that answers the files, the
failure that carries the failing node's own message, and the upload that turns a picked file into the `fileName`
an image door carries. The library is checked the same way: a finished run writes its bytes under
`library/<provider>/<workflow>/<yyyymmdd>-<jobId>.<ext>`, the record names the file, a second read of the same
terminal state neither downloads nor rewrites it, a failed download leaves the run `done` with the failure
recorded, and a hostile workflow name or job id cannot climb out of the library (mutation-tested: 78/79 with the
segment sanitiser removed, 77/79 with the save given nothing to fetch). It also drives the routes: `runOptions`
refuses an undeclared option and an out-of-list value, the workflow route serves `runnable` from the registry,
and an adapter's `source` never reaches the page.

`verify/start.mjs` (**277/277**) is the pane's own suite: it renders the shipped `lib/client.js` against the
four-provider stub and reads the whole home screen back. It holds the surface's registrations (the pane seat,
the chip, the harness's own guide card, ONE settings page), the tab title's own sparkle (founder, 2026-09-25:
*"add sparkles icon to generate tab at top to match other dsh tabs"* — the guide tab's glyph-then-label shape,
drawn in the tertiary chrome ink), the settings page's Models shape, the **header** (the row above the content, a
no row at all until a workflow is open, then a tab per open workflow with the plus beside it, each tab as wide as its name and never ellipsised, and no "All workflows" tab, the open tab bordered and the others
not, a tab named by its workflow's title and never by the file name, a workflow that authors a short `ui.tabLabel`
reading it on the tab while its card keeps the title, a card on the start screen opening a tab, the plus
returning to the start screen with the tab still on the row, and closing the open tab landing back there),
and the pane:
**one block per provider in registry order, all four whether linked or not**, each with a caption line holding
the status light and the name and a facts line holding the balance and the add and refresh glyphs — no card, no
separator and no fold anywhere on the home, no count line, and no provenance sentence either (the balance reads
at 11px in the caption ink, with no weight of its own; *"remove stored on this machine"*) — every block open on
the first paint with no click needed to reach a card,
a card carrying its workflow's title and its one-line second row with **no thumbnail**, the add glyph on the
facts line beside refresh opening that provider's own prompt as an opaque popover only when clicked (laid out of
the page flow, placed by the app's anchored hook, closed by an outside pointerdown and by Escape, and wearing a
tooltip on hover, as refresh does), an empty block saying so and naming that glyph, a failed list saying so
instead of wearing the empty state and offering no add control at all, and a workflow's doors rendered as the
app's own controls. The **Save folder row** is checked in the Capture One shape: the Desktop default drawn from the
host's own answer, the path as a button that posts `{ action: 'choose' }` and takes the dialog's answer as the
root, the reveal arrow beside it, the Space left line carrying the host's number, `Use Desktop` putting the
default back, and the typed input still working as the other way to choose. A finished or failed run is
checked for **no Run again button** — with the Run control present under the doors, which is the way back. It
also drives the host half for real over temp directories: what may be listed, and what `readAdapter` refuses.
Opening a workflow is checked through the founder's 2026-09-23 fixes as well (the surface carries **no way-out
button of its own** any more — the header's plus leads to the start screen, founder 2026-09-25): the surface is a
**wrapping row of two cards** — parameters and preview, the first
holding the doors and the run control, the second holding what the run says and makes — drawn empty before a run,
given to a workflow whose run is not built yet as well, and carrying equal background, border, radius and padding
because both come from the one `Card`; the **preview canvas** takes the shape the workflow's own aspect door
asks for (`1 / 1` on the fixture, `16 / 9` after the door is changed, and a square canvas for the catalogue entry
that has no aspect door at all); and a **number door is the stepper** — the increment moves by the app's own
`step`, and walking it down stops at the app's own floor with that button disabled. The **split run control** is
checked here too: a provider that declares run modes (RunningHub's `instanceType`) gets the segment, its rows
name the modes and the machines, choosing one moves the segment and closes the list, the payload request carries
the choice, the gate names it, and the run that starts carries it — while a provider that declares none keeps
the plain button. Mutation-tested the same day,
the card kit included: **219/220** with the kit's radius and padding changed, with either column taken off the
`Card`, or with the empty-preview marker dropped; **224/231** with the split control never drawn and **229/231**
with the chosen mode never sent; **222/223** with the canvas no longer driven by the aspect door,
with the door no longer found, or with its value no longer parsed; **216/217** with the chevron removed, the
margin under the back control zeroed, or the floor taken off the decrement; **215/217** with the columns no longer
wrapping. The 2026-09-23 save-folder and Run-again checks were mutation-tested the same day: **130/132** with the
default pointed back at a project folder, **242/243** with the Space left line dropped, **241/243** with the path
no longer a button, **242/243** with the Run again button restored on a failure, and **131/132** with `{ action:
'choose' }` starting the dialog anywhere but the current root.

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

`verify/skill.mjs` (**60/60**) mounts the plugin against a recording skills registry and reads the text the
host would serve for **both** skills: each is the shipped file byte for byte, `add-rh-workflow`'s ask comes
before its fetch and its confirmation before its write, `design-generate-screen`'s rules come before its steps
and it carries the rules the pane cannot bend (no node id or field name drawn, nothing spends without the
gate, the app is the authority on numbers, four doors on the main screen, **every panel drawn from the one
`Card`**), its five controls, its five screens and its two cards are all named, it sends an uninstalled
workflow back to the install skill, and the host half contains
no `writeFile`, `mkdir` or LLM import at all. Mutation-tested the same day the design skill landed (**56
checks**): **55/56 with the confirmation step renamed away**, **55/56 with the rule against invented authors
removed**, **55/56 with the "no node id, no field name" rule removed**, **55/56 with the gate rule removed**,
**55/56 with the four-door budget turned into "any number of doors"**, **55/56 with the opening design step
renamed**, and **55/56 with the rules moved after the steps** — every one fails on the claim it breaks, and
none of them takes a second check down with it. **57/58 with the `Card` rule removed**, the check the card kit
added when the two cards landed, **58/59 with the aspect-canvas rule removed**, and **59/60 with the split-control
rule removed**.

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
