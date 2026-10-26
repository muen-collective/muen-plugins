# @muen/dsh-styling

The look-styling surface for DeepSeek Harness. Add the folder your look photographs
live in; the host probes it into **one folder per look**, the PLP shows every look as a
cover, and the PDP opens a **2048px before/after wipe with pan and zoom** over a strip
of the other views. The top bar queues only the looks you have not approved, with a
**regenerate approved** switch for the ones you have.

## The folder schema

```
<root>/
  look 001-originals/     IMG_8734.jpg, IMG_8735.jpg, …   (4 views)
  look 001-final/         look-001.png                     (the styled output)
  look 002-originals/
  look 002-final/
  …
```

The probe accepts `look 001-originals`, `look-001-final`, `Look_001_Originals` and
`look 1 finals`; the number is the key. When the folder is flat, the probe sorts the
images naturally, groups them in batches of four, creates the pairs, and **hard-links**
the files into the look folders — the source is not moved and the bytes are not
duplicated. A file system that refuses a link (another volume) gets a copy.

## What the surface does

| Screen | What you see |
|---|---|
| **PLP** | A grid of covers (the final when one exists, the original otherwise), the look number, the name, the status line `approved 3/4` (`4/4` with a check), and the counts. There are no thumbnail badges and no approve switch on the card. The top bar has `re-generate N` (it opens the queue dialog), the `regenerate approved` switch, and the last queue. The pane header and the right-panel tab use the Lucide **shirt**; the market icon is `assets/icon.svg`. |
| **PDP** | The look name (editable), a strip of the four views above, a 2048px stage that **fills the pane** below. The stage draws the original under the final; drag the divider to wipe, drag anywhere else to pan, scroll to zoom, with `fit` / `fill` / `1:1` at the bottom right. A single **wipe / side by side** button in the header switches the mode; side by side shares one camera, so pan and zoom move both images together. The strip marks each approved view with a check; the approve switch under the stage applies to the **selected view only**. A **fullscreen** control sits at the top right and in the stage controls. `re-generate this look` sits under the stage. |

The same stage fills the pane inline and the window in the fullscreen dialog. The
dialog requests the browser Fullscreen API where the host allows it, so the inspection
can take the whole screen; when the host refuses, the same dialog still fills the app
window. The `fill` control covers the stage (cropping) when a look wants to be larger
than `fit`. `Esc` or the × closes it, focus returns to the control, and the
body scroll is restored. The stage, the wipe, the strip and the pan/zoom are the same
components as the inline PDP — one photograph, two sizes.

**Approval is per view.** The PLP card shows approved views / total (`3/4`); `4/4`
wears a check. There is no switch on the card. The approve switch in the PDP
applies to the selected view, and the strip marks every approved view. A view with no
final cannot be approved. The header's `approved` count means a look has at least one
approved view; `4/4` is full completion.

**The queue dialog.** `re-generate N` opens a dialog with three scopes:
**all at once**, **one look at a time** (the next look; review it before the next), and
**only this look** (a dropdown of every look, approved or not). The dialog writes the
queue; it does not start an agent. The `regenerate approved` switch applies to the
first two scopes; the third can pick any look. The agent runs the queue only when
you tell it to.

**The VL view pass.** A final is paired to an original by camera view, not by its
position in the folder. The `styling-look-views` skill has the pass: label every image
`front` / `side` / `back` / `detail` with a vision-language reader, write
`views.json` in the originals and final folders, then run `styling_probe`. A
`views.json` is the authority; without one the probe falls back to position. The PDP
meta names the view (`view 2 of 4 · side`). This is what caught look 002's
`front/detail/side/back` order and look 003's women's final sitting under the men's
look.

The queue is honest about what it is: the dialog writes
`<profile>/styling/job.json` with the chosen scope and says **ask the agent to run the
styling queue**. A third-party plugin cannot start an agent turn; the agent reads the
queue with the `styling_queue` tool and runs the styling loop. The plugin owns the
review surface; the agent owns the generation.

## Host routes

All under `/plugins/styling` (exact routes; no trailing slash on the prefix):

| Route | Method | Purpose |
|---|---|---|
| `/state` | GET | root, looks, counts, last job, `canChoose` / `canPreview` |
| `/folder` | POST | `{action:'choose'\|'add'\|'remove'\|'reveal', path?}` |
| `/probe` | POST | re-read the added folder |
| `/approve` | POST | `{id, view?, approved}` — omit `view` for every view that has a final |
| `/name` | POST | `{id, name}` |
| `/regenerate` | POST | `{includeApproved?}` or `{looks:[id,…]}` — writes the queue |
| `/job` | GET | the last queue |
| `/detail` | GET | `?id=look-001` |
| `/image` | GET | `?path=…&w=32…2048` — path-jailed to the added folder, `sips` preview |

## Agent tools

`styling_probe` · `styling_queue` · `styling_approve` · `styling_name`.

The probe is also automatic on `Add folder`; the tool is how the agent re-probes and
names the looks after reading their covers. The queue tool writes the same job file the
top button writes.

## The styling loop

The top button writes `<profile>/styling/job.json` with the looks that are not approved.
The agent runs the loop with the interpreter that has `requests`:

```bash
# dry run: the exact queue, model, output path and estimate; no network call
/usr/local/bin/python3 plugins/dsh-styling/scripts/style_loop.py

# one look, for a smoke test
/usr/local/bin/python3 plugins/dsh-styling/scripts/style_loop.py --run --limit 1

# the queue the PLP wrote
/usr/local/bin/python3 plugins/dsh-styling/scripts/style_loop.py --run
```

One look uploads the cover original (Image 1) and a model reference (Image 2) to
Cloudinary, runs the RunningHub **Qwen Edit AIO · Product Fit** app (`2090168183268347906`,
nodes 232 / 235 / 248), downloads the output, archives the previous final as
`look-NNN_r<timestamp>.<ext>`, and writes the new `look-NNN.<ext>`. It resets the look to
**not approved** — a new final is not an approval — so the PLP sends it back to review.
Press **refresh** in the tab (or call `styling_probe`) to pick up the new file.

The loop is the functional first pass. Its model references are the three character
refs in `assets/models/` (`asian`, `blonde`, `indian`); the recovered Qwen 2.1 workflow
that made the four named finals, and the Anika / Freja / Amadou / Anton casting, are the
next consistency upgrade (Epic 23 T0). Review one look before running a batch.

## Install (this profile)

`package.json` in the profile lists the package as a `link:` dependency and
`@muen/dsh-styling` in `dsh.profile.bundles`; the bundle’s `cordis.patch.yml` inserts the
`styling` row. The client half is scanned from that row’s `dsh.client` declaration.

```bash
# from the profile directory
/Users/thuypham/.local/bin/dsh-pnpm add "link:/Volumes/External SSD/hand me up/plugins/dsh-styling"
```

Then add `@muen/dsh-styling` to `dsh.profile.bundles` and reload the page. A host-half
code change needs the row to be unloaded and reloaded (a profile-patch `disabled: true`
then `false` does it); a client-half change is picked up by the page’s HMR reload.

## Verify

```bash
/Users/thuypham/.nvm/versions/node/v24.16.0/bin/node verify/mount.mjs
```

17 checks: the bundle parses, both manifest blocks exist, the loader call and the three
registrations are present, the copy dictionaries agree, every `t(key)` exists, the PLP
renders from a fixture, the host mounts the routes the client calls, the four tools are
registered, the image route path-jails, and the zoom keeps the point under the cursor.

The 2048px route was measured on the running app:

```
GET /plugins/styling/image?path=…&w=2048 → 200, 1365×2048 JPEG
GET /plugins/styling/image?path=…&w=640  → 200,  426×640  JPEG
```

## Known limits

- **No generation in the plugin.** The top button queues; the agent runs the styling
  loop. That is the seam the harness gives a third-party plugin.
- **One root at a time.** The plugin remembers the last folder added; a second folder
  replaces the first (the old manifest is gone, the decisions stay keyed by look id).
- **A final is paired by its view label.** `views.json` in each folder is the
  authority; without it the probe falls back to position. A look with four originals
  and one front final shows the final on the front view and leaves the others original.
  Never move a final to a different look to force a positional match.
- **A final must live in `look NNN-final/`.** The plugin does not watch
  `hmu-lookbook/final`; a final copied into a look folder is auto-approved on the next
  probe (no run record), while a loop-generated final keeps the loop’s not-approved
  state. The 22-image zip batch and the four named finals were mapped on 2026-10-26.
- **The model roster is not yet part of the surface.** The PLP/PDP review the images;
  the casting lives in the styling loop.

## Current state on this machine

The root is `/Volumes/External SSD/hand me up/hmu-lookbook/originals`, probed into 27
looks (54 folders, 108 hard-linked original views). **14 looks have at least one approved
view; 13 have none.** The per-view progress is visible per card: look-001 `3/4`,
look-002 `4/4`, look-005 `1/4`, look-006 `1/4`, look-016 `4/4`, look-026 `1/4`;
look-003 is the men's look with no final (`0/4`). The 22-image zip batch
and the four named finals were mapped into the look tree on 2026-10-26:

| Look | Finals |
|---|---|
| look-001 | f1, f3, f4 (patchwork) |
| look-002 | b1–b4 (beige lace) |
| look-003 | — (the men's white/blue shirt; 2.png was the women's look) |
| look-004 | 8 (turquoise/pink fringe) |
| look-006 | 2 (women's white shirt + yellow floral pants; front) |
| look-005 | c1 (beige gown) |
| look-008 | Freja ivory ruffle |
| look-010 | a1–a4 (pink fringe coat) |
| look-011 | 3 (black V-neck gown) |
| look-012 | Amadou navy stripe |
| look-015 | ComfyUI (burgundy suit) |
| look-016 | Anika black lace + e1–e4 |
| look-017 | 6 (grey halter) |
| look-022 | d1 (sheer peach) |
| look-026 | Anton olive blazer |

Still to style: look-003, 007, 009, 013, 014, 018, 019, 020, 021, 023, 024, 025, 027.
Look 006 now carries the women's final 2.png on its front view (1/4).
A final must live in `look NNN-final/` to be seen; a file left in `hmu-lookbook/final`
alone is not read by the plugin. Press refresh after copying one in.
