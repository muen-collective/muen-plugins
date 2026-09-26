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
| `GET /plugins/assets/folders` | the registry as stored, plus **where the library is looking**: the state root and the records root, each with the rule that answered (`override` · `profile` · `home`). An empty library says where it looked rather than shrugging |

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

## Verify

```
node verify/mount.mjs
```

One suite so far. It drives the shipped client half in a stubbed loader and a recording ctx, then **renders the
pane three ways** against a stubbed host — answering, unreachable, and empty — because "no folders yet" is a
claim about this machine and has to be read as text. A skip is printed as a skip; a disagreement fails the run.
Nothing here spends coins or touches a provider.

## Not built yet

The grid, the tile, the metadata block (A3); the intake proxy that keeps a preview beside the record (S9 of
epic 64); the review layer. The plan of record is `docs/plans/63-assets-library-epic.md` in the dsh-mitsu
workspace, and the surface reference is hand-me-up-os's own `AssetPanel.tsx`
(`repeat(auto-fit, minmax(240px, 1fr))`, no breakpoints, a grid/list toggle, a filled context badge beside an
outlined size badge).
