---
id: styling-look-views
name: styling-look-views
layer: process
audience: collaborator
description: Pair a look's originals and finals by camera view, not file order. Triggers when styling look photos, ingesting finals, or a look's views are mismatched — "the side view shows the back", "determine the view", "pair the finals". The VL (vision-language) pass labels every image front/side/back/detail before any pairing.
requires: The look's originals and finals folders, and a vision-capable reader for each image (the agent's own image reading or a vision model).
produces: A views.json in each folder and a re-probed manifest whose views pair front↔front, side↔side, back↔back, detail↔detail. The gate is the PDP: stepping the strip shows the same camera view on both sides of the wipe.
---

# Pair looks by camera view, not file order

A folder's sort order is not the camera. In look 002 the finals arrived as
`b1, b2, b3, b4 = front, detail, side, back`; positional pairing put the detail
on the side view and the side on the back. The invariant: **every image is
labelled by view first, and only then paired**. The cover is always the front.

## 1. Run the VL (vision-language) pass on every image

Open each original and each final. For each image assign exactly one:

| View | What it looks like |
|---|---|
| `front` | the model faces the camera, full or near-full body |
| `side` | the model is in profile (left or right) |
| `back` | the model faces away |
| `detail` | a close crop of the garment with no full body — even if it is a front crop |

A 3/4 turn toward the camera is `front`; a 3/4 turn away is `back`. If a vision
model is doing the pass, the whole prompt is:

> You are labelling a fashion lookbook image by camera view. Choose exactly one
> word: front, side, back, detail. A close crop of the garment is detail even if
> it shows the front. Answer with one word.

Write one `views.json` per folder, keyed by the exact basenames:

```json
// look 002-originals/views.json
{ "IMG_8745.jpg": "front", "IMG_8747.jpg": "side", "IMG_8748.jpg": "back", "IMG_8751.jpg": "detail" }
```

```json
// look 002-final/views.json
{ "b1.png": "front", "b2.png": "detail", "b3.png": "side", "b4.png": "back" }
```

**Check:** every image in both folders has one of the four labels; no image is
left unlabelled, and every label is a view, not a filename description.

## 2. Pair by view, never by position

Call `styling_probe` after writing the files. The host reads both `views.json`
files and pairs by label: a final joins the original with the same view. A view
with no final stays original — it is never filled with a different view. The
cover final is the pair whose view is `front`. A folder with no `views.json`
still falls back to positional pairing, which is the old behaviour, not a
silent guess.

**Check:** the manifest's `views` read front↔front, side↔side, back↔back,
detail↔detail, and `coverFinal` is the front final. `look 002` pairs
`IMG_8745↔b1`, `IMG_8747↔b3`, `IMG_8748↔b4`, `IMG_8751↔b2`.

## 3. Verify on the PDP

Open the look and step every strip thumbnail. At each step the wipe must show
the same camera angle on both sides: front under front, side under side, back
under back, detail under detail. The meta line names the view. A look is only
approved per view after this check; a mismatched pair is never approved.

**Check:** no strip step has a different view on the left and right; the cover
thumbnail is the front; the view labels in the PDP match the labels in
`views.json`.

## Boundaries

- Never infer a view from a final's position in the folder. `b2` is not "the
  second view" unless the VL pass says so.
- Never substitute a detail or a front crop for a missing side or back.
- Never rename or reorder finals to force a positional match; label them.
- Never approve a view while the two sides of its wipe show different angles.
- The labels are evidence, not decoration: a wrong label is a wrong pair.

## Delivery

Report the two `views.json` paths, the pairing table (original → final → view),
and the PDP step where each pair was checked. List any image left unlabelled
instead of guessing it.
