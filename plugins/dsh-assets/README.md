# @muen/dsh-assets

The **Assets library** for DeepSeek Harness: an index over **the folders a person adds** — the ones their
projects already live in, outside this app — so a finished picture can be found again, read, and regenerated.

It owns no bytes. It reads the run records the Generate plugin writes (`<profile>/generate/<provider>/runs/`)
and points at the files those records saved.

## The two jobs, and which one this is

Founder, 2026-09-26, with Capture One's filter panel on screen: *"let's remove stars from MVP and add later …
The stars are used to do review of assets. It's so the user can pick the best final image that goes on the
website. **catalog is to look the og full res images that have been archived.**"*

| Job | What a person is doing | Ships |
|---|---|---|
| **Catalog** | finding an asset again and getting to its **original full-resolution file** — metadata, location, filters | **this MVP** |
| **Review** | judging a batch to pick the image for the website — stars, colour tags, keywords | later, as one layer |

So there are **no stars, no colour tags and no keyword library** here yet.

## The library starts empty and grows by folders

- **`+ Folder` adds a project folder.** It is the person's own directory, **outside this app** — Desktop,
  Documents, a drive — never inside the profile and never a `.kun`-style private store, because the file has to
  be reachable by Finder, email and AirDrop without being dug out of an application's data directory
  (*"kun creates inside .kun and it's a pain to dig it out when I need to attach or send to people"*).
- **One species of tile.** A file in an added folder is an asset. When a run record's own
  `outcome.saved[i].file` points at it, the tile carries **provenance** as well — the prompt, the provider, the
  app, the doors, the run's date. A file with no record still lists, with its own facts.
- **Identity is the path**, matched exactly against the record's saved file. No guessing from a filename.
- **Losing the registry costs the grouping, never a picture.** It is one file,
  `<profile>/assets/folders.json`.
- **A folder a person added is a place, so its name is the way there**: the glyph says what it is,
  the name is a button, and Finder opens it.
- **The card wears its own mark, not a folder** (founder, 2026-09-26: *"the icon for assets card should not be
  folder — folder is already used for workspace files, lucide icon square-sparkles or something similar"*).
  The folder glyph belongs to Workspace files and to the folders a person adds here, so the two **identity**
  places — the pane chip and the Start-page card — draw Lucide's `square-sparkles` instead, hand-drawn in this
  bundle the way the sibling plugin draws the one glyph a surface lacks. The harness ships no picture glyph at
  all; the geometry is on a 24-unit grid at stroke 1.5 so it lands on the harness's own Regular weight (1px) at
  16px. **A folder stays a folder where a folder IS the thing**: the empty room, the Finder link on a row and
  its reveal are untouched.
- **This plugin's own bookkeeping is not on screen.** The route answers with the two profile paths it
  reads (its own state root and the Generate plugin's records root) because a bug report wants them;
  the pane used to draw them, and the founder's own question retired that (2026-09-26: *"library state
  and run records are Mitsumeru system folders? … I'm not sure the purpose to showing this to user"*) —
  they are the app's business, not a person's, and nothing there is something to act on.

## Files and paths

| Path | What it is |
|---|---|
| `<profile>/assets/folders.json` | the folder registry — the only file this plugin writes |
| `<profile>/generate/<provider>/runs/*.json` | the run records it **reads** (the Generate plugin's own root) |
| `<profile>/generate/library.json` | not read here: the save-folder choice is Generate's, and a record carries the absolute path it wrote |

Two roots, one rule: the profile name comes from `argv --profile` and the harness home from `DSH_HOME`, with
`ASSETS_DATA_DIR` overriding this plugin's own root and `RH_DATA_DIR` overriding the records root. **This is a
contract, not an import** — epic 63 §1 decided the two plugins stand alone, so the library works with Generate
absent and neither reaches across.

## Routes

| Route | What it answers |
|---|---|
| `GET /plugins/assets/folders` | the registry as stored, plus **where the library is looking** — the state root and the records root, each with the rule that answered (`override` · `profile` · `home`) — and `canChoose`, whether this host has a folder dialog. An empty library says where it looked rather than shrugging |
| `POST /plugins/assets/folders` | `{ action: 'choose' }` opens the OS folder dialog (**its start folder is one that exists** — the first added folder, else the person's home: a start that is not there makes AppleScript fail before the dialog opens, which is exactly what `+ Folder` did on a fresh install); `{ action: 'add', path, label? }` adds a typed absolute path; `{ action: 'reveal', path }` shows a folder the library holds in Finder; `{ action: 'remove', path }` takes one out. Adding one twice answers `already: true`; removing or revealing one that is not there answers 404 |
| `GET /plugins/assets/catalog?context=&date=` | the tiles, the two filter groups with their counts, and the roots it looked in. A record's own settled date wins over a file's mtime; counts are over **everything scanned**, so a filter row does not move its own number |
| `GET /plugins/assets/detail?path=` | one asset, whole: dimensions (read from the file's own header), format, bytes, date, context, **where it is**, **what the file itself carries** (`carrier`: does it hold a ComfyUI graph, and how big — epic 64 S8), the run that made it, the prompt verbatim and the values it ran with. **Containment is the model**: a path outside an added folder is 404 |
| `GET /plugins/assets/file?path=` · `&w=` | the bytes of an asset the library holds — the tile's picture. Same containment, `no-store` like every other answer: a cached 200 would keep showing a picture that has been moved. **With `w=` it answers a preview** (32–2048px, made once into `<profile>/assets/proxies/` and named by the original's path+mtime+size+width), so a folder of 1,296 pictures is not 1,296 originals drawn into a wall of tiles. `X-Assets-Preview: 1` says it is the preview; **every fallback serves the picture** — a host with no resizer, a video, a failed resize — so a slow grid beats a broken one |
| `GET /plugins/assets/sync` · `POST /plugins/assets/sync` | **the optional S3-compatible sync** (epic 63 A5), and it is **off until a target is configured**: `GET` answers the target and how many keys it already holds (never the secret), `POST { action: 'target', … }` stores one or clears it with `path: null`, `POST { action: 'asset', path }` syncs one picture. The object key comes from the **bytes** (`<prefix>/<aa>/<sha256>.<ext>`, the shard the attachment store uses), so the same picture is one object however it was named; `<profile>/assets/synced.json` is the ledger that makes a **second sync a no-op without a network round trip** and is per target; the secret is a **reference** into the `credentials` seam; and a failure **never deletes the local copy** — this route only reads it, and the ledger gains a key only after the bytes are away |
| `GET /plugins/assets/view` · `POST /plugins/assets/view` | the view a person left behind: the layout, the two filters, the selected tile. **The harness does not restore tabs in this shell** (its layout store is localStorage under an origin the shell randomises with `--port 0`), so this file is what survives a reload |

The two filters are the MVP's, and the founder chose them: *"I'd ship context + date and let the search box cover
the rest"* (2026-09-26). **Context is the label of the project folder an asset lives in**; the date tree is
year → month → day, each row carrying its count.

**The prefix carries no trailing slash**, and that is a contract: the harness matches a prefix as
`pathname === prefix || pathname.startsWith(prefix + '/')` and appends the slash itself, so a registered
trailing slash makes only the bare path match and everything below it answer 404 with an empty body
(measured on this plugin's sibling, 2026-09-23).

## Slots

| Slot | Purpose |
|---|---|
| `sidebarRightTabs` | the `assets` page type, id `@muen/dsh-assets`, priority `extension` |
| `sidebar.right.pane.tab` | the pane body, keyed by the same id |
| `sidebar.right.pane.tab.title` | the chip: the library's own mark, then the name |
| the type's `guide[]` | one entry, which puts the **Assets** card on the right panel's start page — the harness's own standard card, wearing the same mark |
| the client locale registry | namespace `assets`, en + zh |

## The grid, the tile, and the metadata block

The grid is the one hand-me-up-os shipped and the founder kept: `repeat(auto-fit, minmax(240px, 1fr))`, a
240px floor, **no breakpoints** — the pane's own width is the only input. A tile is the `3/4` thumbnail, the
name, and two badges that are deliberately unlike each other: the **context is filled** (where the asset
belongs) and the **size is outlined** (how big it is). It is a button a keyboard can reach, and it is
**draggable only when there are bytes** — a row with a name and no file is still listed, and nothing invents a
file to carry.

The metadata block is what the catalog job is for. With a run behind the file it names the provider, the job,
the workflow, the app, the date it settled, **the prompt verbatim** and the values it ran with; without one it
says so and shows the file's own facts. Both cases carry **where it is**.

## Finder's switch, the dropdowns, and the three views (2026-09-26)

*"Can you copy finder switch view w segmented control using icon buttons: grid, list, filmstrip … also
use dropdown select menu primitives"* — the founder, with Finder's toolbar on screen. Both controls are the
**app's own primitives**, which is also what the design system means here: this bundle declares exactly one
peer (`@deepseek-ai/dsh-client-ui-primitives`) and cannot require `@muen/eva`'s React sources, which are a
Tailwind package the shell does not ship to plugins. So the switch is `SegmentedControl` — a `tablist` whose
white pill **slides** under the selected segment (placed arithmetically from `--dsh-segment-count` /
`--dsh-segment-index`, `transition: transform 160ms ease`) with each segment an icon button whose word is its
`title` — and each filter is `Menu`, the anchored list Settings uses for a choice, which takes its own
`anchor`, closes on a choice or an outside press, and hands the keyboard back to the trigger that opened it.

**THE THIRD VIEW IS THE ONE THE STAGE WAS BUILT FOR.** `filmstrip` draws the selected asset in A4's
`InspectStage` at the pane's width, with the catalog's frames in a one-row strip under it and the facts in
the side column — which is told `withStage: false` there, because the big picture already is the stage and
two would be silly. Nothing selected says so rather than auto-selecting the first frame (that would write to
the view file from inside a render). **The switch's three glyphs are Lucide's own — `layout-grid`, `list` and
`gallery-thumbnails`** (Finder calls the third *filmstrip*; Lucide calls the same shape *gallery-thumbnails*) —
hand-drawn in the bundle so the control carries ONE drawing style: the harness's grid and rows marks are a
different family (filled 16-unit geometry) and it ships no gallery glyph at all. All three are 24-unit at
stroke 1.5, the same grid and weight as the card's mark.

## The bar, and the two columns (the polish pass, 2026-09-26)

The founder, after using it: *"now let's UX polish"*. Four changes, none of them to what the pane knows:

- **The bar is one row** — the search, the two layouts, the two filters and the count. The two filter trees
  used to stand open between that row and the grid, so **177px of tree came before the first picture**.
- **A filter is one line until asked.** The trigger carries its name and the value it holds (`Context · All`)
  and a set filter shows a `✕` that clears it in place; the rows — with every count — are the first thing in
  the menu, because *a filter that cannot say how much is behind it is a guess, and a tree that is always open
  is a wall*.
- **The picked asset sits BESIDE the grid.** It used to render after the whole grid, so reading the asset you
  had just picked meant scrolling past every tile in the library. Now a wrapping pair — the grid `3 1 0` with a
  260px floor, the block `2 1 0` with a 240px floor, **the same pair the workflow surface settled on** — and
  below 512px of pane they stack, where the block goes back under the grid because that is the only place left.
- **The count is a sentence** (`1296 assets`, or `21 of 1296` while a filter or a search is on) instead of an
  uppercase group title.

Two smaller ones: a tile **answers the pointer** (its border brightens) and the picked one wears the app's own
accent, with the hover flag living in the pane rather than in each tile — exactly one tile is under the pointer,
and a hook per tile would make the pane's hook count depend on how many tiles are on screen. And the loading
state is now **six of the pane's own tiles** wearing `--dsw-alias-bg-skeleton`, so the grid does not jump into
place when the answer lands; its pulse is the one thing here that cannot be an inline style, so it is a class
from the single sheet the plugin injects — and `verify/mount.mjs` checks that every class it animates is
declared in that sheet, which is the rabbit the sibling plugin's undeclared spinner came out of.

**Identity only, again:** a folder stays a folder where a folder IS the thing.

## The handoff: an asset is a way back into its run (epic 64 S7)

The library is the front door, not the last step (founder, 2026-09-25: *"we designed Generate first as the
control surface … but the session starts with an asset and the user clicks regenerate"*). So a file a run made
carries a **Regenerate** control in its metadata block, and pressing it opens that run where it was made:

```
openTab('generate', { params: { run, unit, provider } })
```

**Three facts, because one cannot work.** The Generate pane opens a *workflow* tab and then shows the run
inside its series, so the call names the run, the workflow the record belongs to (`adapter` for RunningHub,
`name` for Krea) and the provider it ran on. All three are read off the record the library already holds — no
lookup is invented on the other side. **It runs nothing**: `openTab` shows a surface, and the press that spends
is still the person's own, behind Generate's own gate.

**It crosses no code.** The call is the harness's own seam, made through the tab's bound `actions.openTab` —
never an import — so this plugin works with Generate absent, which is the state a stranger installs. And absent
is said out loud:

| State | What the block draws |
|---|---|
| Generate is on the page and the record names its workflow | the **Regenerate** control |
| Generate is not installed | the metadata, plus **one sentence** — never a control that would do nothing |
| the record does not name a workflow | the other sentence, because the pane cannot open what nobody named |
| no run made the file | neither: there is no run to continue |

`verify/handoff.mjs` holds all four, drives the press, and — when the Generate plugin is beside this one —
reads its source to confirm it consumes exactly those three params. Shipped alone, that last check says so
instead of failing.

## The optional sync (epic 63 A5)

**Off by default, and that is the first rule**: nothing is sent unless a target has been configured, so a
library never phones home because it could. The target lives in `<profile>/assets/sync.json` — an https
endpoint, a bucket, a region, a prefix and an **access key id**; the secret is a *reference* into the
`credentials` seam, never a value on disk, and the status route answers whether one resolves rather than what
it is.

**Content-addressed**: the key is derived from the bytes (`<prefix>/<aa>/<sha256>.<ext>` — the same shard shape
`$DSH_HOME/attachments/v1/objects/` uses), so the same picture is one object however it was named, and the same
bytes picked in two sessions upload once. **A second sync is a no-op decided by a ledger, not by the network**:
`<profile>/assets/synced.json` records which keys a given target holds, keyed by the target as well as the
content, so a second bucket uploads everything once and a re-sync of a thousand pictures costs zero requests.
**A failed upload never deletes the local copy** — there is nothing to delete, because this half only ever
reads the picture; the failure is reported per asset and the ledger gains its key only *after* the bytes are
away, so a retry re-uploads rather than believing it already went.

**The signer is AWS Signature Version 4**, hand-rolled (no SDK), and it is verified for **structure,
determinism and the CANONICAL FORM** — the authorization header's form, the signed header list, the payload
hash, a different secret/region/day/body changing the signature, and the canonical request built to the letter
(method, URI, empty query, one lower-cased sorted line per header, the signed list, the payload hash; header
values **trimmed with runs of whitespace collapsed**, which is why `a  b` and `a b` sign the same; query
parameters sorted by name). **It is not verified against a live provider**, because no target has been ratified
(E3 is open): `@smithy/signature-v4` is present in the app's tree but its own `@smithy/protocol-http` is not, so
it cannot be driven as an oracle, and the real proof is one upload to a real bucket. The transport is a seam
(`putObject`) for exactly that reason.

**Not built: a Settings row for the target.** The route is the seam; a person configures a target by hand or
through whatever surface is decided later.

## Looking at one picture closely (epic 63 A4)

**Zoom is arithmetic, not WebGL.** The hard part — keeping the point under the cursor under the
cursor — is pure functions (`fitScale`, `fitView`, `zoomAt`, `panBy`, `oneToOne`) kept out of the
component so they can be asserted as arithmetic: `verify/inspect.mjs` checks the invariant over a
matrix of cursors and factors, not one example. **The range is the contract: 0.2 to 8, and at a
limit the view comes back UNCHANGED — scale and offset both** — which is what stops a wheel at the
floor from walking the picture a pixel at a time. `fitScale` never magnifies past 1:1 (a small
picture is shown at its own size) and a fit is deliberately NOT clamped to the zoom floor, because
a fit that refused to go below it would open a 10,000-pixel plate as a crop.

The stage sits in the metadata block, above the facts: the picture is **fitted and centred**,
the wheel zooms about the cursor, a drag pans, and **1:1 asks for the original file** — the stage
draws the `&w=1024` preview until you ask, because a grid of tiles should never cost originals.
The frame is measured with a `ResizeObserver`, so the fit follows the pane as it resizes (docked,
split, fullscreen). Compare is deliberately **not** in this slice — the OS cut it on purpose and
the founder's word is what would turn it on.

**The arithmetic is exposed on the plugin's own exports** (`zoom`) as a deliberate test seam: the
client half is one self-contained script that cannot import a sibling module, so this is what lets
the suite assert the math without rendering.

## What the picture itself carries (epic 64 S8)

A picture is not only pixels. ComfyUI writes its graph into the PNG it saves, and RunningHub
adds a provenance label — so a **canvas export** opens in a local ComfyUI while a **provider
result** does not, and a person looking at an asset deserves to know which one they have.
`lib/carrier.js` reads the file's own `tEXt` chunks and the metadata block draws **one row**:
*Graph inside — Yes, 25 nodes* / *No, only the provider's label*.

**Three answers, never two.** A PNG carrying only the label says **no graph**; a format this
cannot read (JPEG and WebP carry the same data in EXIF, which is not built) draws **no row at
all** rather than claiming there is nothing inside; and a PNG whose chunks fall past the read
bound says **not read**. The read is bounded at 1 MB, and a `.png` that is really a JPEG is
judged by its **bytes**, not its name.

**The format is shared with `@muen/dsh-generate`, the code is not** (epic 63 §1): that plugin
owns the same reading for its *export* half — writing a picture out with its graph injected, so
it opens elsewhere — and the two plugins never import each other. Measured on this machine: all
**21** PNGs the Generate plugin's runs saved carry the label and no graph; the canvas export
kept in `~/Desktop/hmu banner` carries all three chunks.

## Previews (S9)

A tile asks for `&w=320` and the host answers a small copy, **made once** into
`<profile>/assets/proxies/` and named by the original's path, mtime, size and width — so a picture replaced in
place gets a new preview, the same ask twice reads one file, and two tiles asking at once never see half a
picture (it is written elsewhere and renamed). The original is never touched: nothing is written near a
person's own folders.

The resizer is the platform's (`sips` on macOS — present everywhere, no dependency). Where there is none, the
route serves the original and says `canPreview: false`, in the registry and in the catalog. On this machine the
catalog reads **1,296 assets in 194ms** and the previews are what keep the browser from being handed all of
them.

## Verify

```
node verify/mount.mjs      # A1: the card, the registrations, the copy, the empty room,
                           #     the card's own mark (not the folder), the skeleton and
                           #     the sheet that declares what it animates                   42
node verify/intake.mjs     # A2: the folders, the records, the filters, the carrier       63
node verify/views.mjs      # A3: the grid, the tile, the metadata block, EVERY folder
                           #     control pressed through to the host, the bar, the two
                           #     columns, hover, a count in words, the segmented view
                           #     switch, the dropdown filters and the filmstrip            97
node verify/preview.mjs    # S9: the preview a tile asks for, made once                   34
node verify/handoff.mjs    # S7: an asset is a way back into its run (three facts)        28
node verify/inspect.mjs    # A4: zoom is arithmetic, and the stage uses it                    36
node verify/sync.mjs       # A5: off by default, content-addressed, failure-safe              38
```

The suites share `verify/harness.mjs`: a reporter, the server fakes, and enough React to render a
component twice (effects honoured with their dependencies) — so "what does a person see" is checked as text
and props rather than in dialects. **Its hooks are keyed by component instance** (`FilterMenu#0`), not by a
position in one flat list: a flat cursor means every hook a child adds shifts every later component's slots,
so `InspectStage` read the pane's `busy` flag as its frame and a working pane failed a suite with
`Cannot read properties of undefined`. That bit this plugin twice in one session — a `useState` per tile, then
one per filter — and each time the temptation was to bend the pane instead of the shim. It also means a
double-visited node reads its own slots again rather than corrupting a neighbour's.

A control that DRAWS is not a control that WORKS, and the suites had only ever checked the first
half: A3 deleted the `post` helper every folder action calls and left its call sites, so `+ Folder`,
the Finder link, a row's remove and the typed path all rendered and did nothing — each press threw
`ReferenceError: post is not defined` inside the handler, invisibly (founder, 2026-09-26, twice:
*"+folder in assets plugin not working"*). `views` section 7 now **presses** all four, in both the
`Button` branch the app really draws and the plain-`<button>` fallback, and reads back what the pane
asked the host for — plus that the folder a person just added is on screen without a reload.

`mount` drives the shipped client half in a stubbed loader and a recording ctx, then **renders the pane three
ways** against a stubbed host — answering, unreachable, and empty — because "no folders yet" is a claim about
this machine and has to be read as text. `intake` drives the shipped host half against temp directories: an
empty registry, adding by dialog and by path, the refusals, a file matched to a run by its **exact** path, a
loose file listed beside it, the counts, the filters, and a half-written record that must not empty the grid.
`handoff` renders the block four ways — Generate present, absent, a record with no workflow, a file with no run
— presses the control, and reads the sibling plugin's source when it is there.
A skip is printed as a skip; a disagreement fails the run. Nothing here spends coins or touches a provider.

## Not built yet

The review layer (stars, colour tags, keywords) — it waits on the founder's vocabulary research, and it is the
one MVP part this plugin does not have; A4 (zoom inspect) and A5 (the optional sync) are the other two slices
of epic 63. The plan of record is `docs/plans/63-assets-library-epic.md` in the dsh-mitsu
workspace, and the surface reference is hand-me-up-os's own `AssetPanel.tsx`
(`repeat(auto-fit, minmax(240px, 1fr))`, no breakpoints, a grid/list toggle, a filled context badge beside an
outlined size badge).
