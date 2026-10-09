# @muen/dsh-studio

The video production surface: **design → script → shoot → timeline → MP4**, with
a human gate at every stage and the generation engines swappable behind stable
contracts. Built against `docs/plans/94-studio-director-plugin-epic.md` (draft);
design of record: `docs/initiatives/studio-director-design.md`.

A `studio` tab in the app. Method as the navigation: a project screen with six
stage cards — Character, Outfit, Scene, Script, Shoot, Timeline.

## What is real today (M1–M11, contract-tested)

| Area | What works |
|---|---|
| Shell | projects, sequences, shots — persisted (`session.json`), reload-safe |
| BYOK seam | `ctx.get('llm')` chat completions through `/plugins/studio/llm` |
| Character | photo upload → Casting role drafts the 8-slot bible → human edits → **Approve seals the core** → Krea sheet run via Generate → result on screen |
| Outfit / Scene | look records (outfits **seal** slots 3–5 at approve), scene records gate only |
| Script | manual rows, LLM write (raw-JSON shot drafts), brief import, H3 frame-grid totals, approve gate |
| Shoot | asset binding, mechanical prompt compose (**seals verbatim**, Prompt-desk writes only the scene layer), per-slot drift preflight, confirm gate, runs through Generate (`confirmed: true`), takes filmstrip, select |
| Batch | Run-all-ready: one gate, serial runs, per-shot status pills, failures visible and non-fatal |
| Timeline | EDL (frames at 24 fps), build-from-selects, reorder / trim / split / delete / undo, host-side ops |
| Export | EDL + manifest always; **MP4 via system ffmpeg** (honest disabled state when missing) |
| Library | star a take → full recipe stored (prompt/seed/params/Look/refs), 0–5, browse filters, **Recall** prefills the desk |
| Sync | manual Push/Pull of `library.json` to the person's own GitHub (sync-target seam) |

## Install into a profile (founder acceptance)

1. The bundle lives at `plugins/dsh-studio` in this workspace (dev home per the
   repo map; promote to `muen-plugins` before any client install).
2. Add its row to the profile's `cordis.patch.yml` (backup first, never append
   past an array):

   ```yaml
   - insert:
       - id: studio
         name: '@muen/dsh-studio'
   ```

3. `node scripts/check-profile-patch.mjs` must pass.
4. Restart the app (first install is a HOST change — reload is not enough).
5. The `studio` tab appears in the strip.

## The live acceptance walk

1. **Character**: upload a person photo → *Draft with LLM* (needs a working llm
   seam) → edit paragraphs → *Approve & seal* → *Generate sheet* (needs the Krea
   key) → result image lands.
2. **Script**: write a premise → *Write with LLM* → 4 shot rows → *Approve*.
3. **Shoot**: bind the character, compose a shot's prompt → verify the sealed
   core paragraphs appear verbatim → *Generate* → *Confirm run* (the only spend)
   → take lands → pick a rating.
4. **Timeline**: *Build from selects* → reorder one clip, trim one → *Undo* →
   *Export EDL*; if ffmpeg is on the machine, *Export MP4*.
5. **Library**: star a take → row appears with the full recipe → *Recall* → the
   desk prefills the identical prompt.
6. **Batch**: *Run all ready shots* → watch per-shot pills; a forced failure
   (e.g. pull the key mid-batch) marks that shot and the batch continues.

## Honest limitations (known, not hidden)

- **No Looks / LoRA switching yet** — that is the ComfyUI-task runner slice
  (epic slice 9) and the `singularity-refmod` workflow work.
- **Batch binding**: the desk's binding (character/look/scene) is one shared set
  for the batch; per-shot bindings land with a later slice.
- **ffmpeg is detected, not bundled**; no ffmpeg → MP4 disabled with the exact
  reason, manifest still exports.
- **Preview playback is structural** (ordered take URLs, `data-preview-order`);
  in-place video scrubbing is a v2 nicety.
- `acceptance-live.mjs` baseline is failing in unrelated plugins' routes
  (2/42, capture/handoff/design-system) — tracked separately, not caused here.

## Suites

`npm run verify` — 15 suites (manifest+patch, store, seals, bibles, records,
script, shoot, edl, export, batch, library, sync, character, llm, shell). All
mutation-tested by construction: each suite drives the REAL pane through a
stubbed module loader or the REAL route handler against a temp store.
