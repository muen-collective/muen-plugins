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
| `POST /plugins/assets/folders` | `{ action: 'choose' }` opens the OS folder dialog (a cancelled dialog answers the unchanged registry, not an error); `{ action: 'add', path, label? }` adds a typed absolute path; `{ action: 'remove', path }` takes one out. Adding one twice answers `already: true`; removing one that is not there answers 404 |
| `GET /plugins/assets/catalog?context=&date=` | the tiles, the two filter groups with their counts, and the roots it looked in. A record's own settled date wins over a file's mtime; counts are over **everything scanned**, so a filter row does not move its own number |
| `GET /plugins/assets/detail?path=` | one asset, whole: dimensions (read from the file's own header), format, bytes, date, context, **where it is**, the run that made it, the prompt verbatim and the values it ran with. **Containment is the model**: a path outside an added folder is 404 |
| `GET /plugins/assets/file?path=` | the bytes of an asset the library holds — the tile's picture. Same containment, `no-store` like every other answer: a cached 200 would keep showing a picture that has been moved |
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
| `sidebar.right.pane.tab.title` | the chip: the folder glyph, then the name |
| the type's `guide[]` | one entry, which puts the **Assets** card on the right panel's start page — the harness's own standard card |
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

## Verify

```
node verify/mount.mjs      # A1: the card, the registrations, the copy, the empty room   30
node verify/intake.mjs     # A2: the folders, the records, the two filters               47
node verify/views.mjs      # A3: the grid, the tile, the metadata block, the search      34
```

The three suites share `verify/harness.mjs`: a reporter, the server fakes, and enough React to render a
component twice (hooks in call order, effects honoured with their dependencies) — so "what does a person see"
is checked as text and props rather than in three dialects.

`mount` drives the shipped client half in a stubbed loader and a recording ctx, then **renders the pane three
ways** against a stubbed host — answering, unreachable, and empty — because "no folders yet" is a claim about
this machine and has to be read as text. `intake` drives the shipped host half against temp directories: an
empty registry, adding by dialog and by path, the refusals, a file matched to a run by its **exact** path, a
loose file listed beside it, the counts, the filters, and a half-written record that must not empty the grid.
A skip is printed as a skip; a disagreement fails the run. Nothing here spends coins or touches a provider.

## Not built yet

The **intake proxy** (epic 64 S9) that keeps a small preview beside the record so a grid of 300 tiles does not
read 300 originals; the review layer (stars, colour tags, keywords); the session strip that draws the same tile
in a rail; the intake proxy that keeps a preview beside the record (S9 of
epic 64); the review layer. The plan of record is `docs/plans/63-assets-library-epic.md` in the dsh-mitsu
workspace, and the surface reference is hand-me-up-os's own `AssetPanel.tsx`
(`repeat(auto-fit, minmax(240px, 1fr))`, no breakpoints, a grid/list toggle, a filled context badge beside an
outlined size badge).
