# Subject swap — put an outfit on a person

Swap the outfit from one photo onto a person in another photo using the Qwen 2.1
Image Edit workflow. The user provides two images; you run the workflow.

## When to use

The user wants to see what a garment looks like on a specific person, or wants to
put an outfit from a product photo / editorial onto a different model. Triggers:
"swap the outfit", "put this dress on her", "outfit swap", "subject swap",
"clothing transfer", "what would this look like on me".

## Rules

- **One sentence, not a paragraph.** The Duo's own example on RunningHub is
  `The woman in Image 1 wears the outfit from Image 2.` and that is what produced the
  result the founder kept. Measured 2026-09-25: every run sent from the panel carried
  the long preset instead — around 400 characters about fidelity, texture, folds and
  draping — and it over-prompted the app. Text that the app's own example does not
  carry competes with the two images rather than helping them. That long analysis was the
  **AIO** workflow's method, and the AIO workflow is retired (founder, 2026-09-25: *"we
  can remove qwen AIO, I think Qwen 2.1 definitely replace"*) — the Duo is the one Qwen 2.1
  workflow here, so the long form has no home and belongs nowhere.
- **Two images required.** If only one is provided, ask for the other. Do not
  guess or reuse an image from earlier in the conversation.
- **Image 1 = the person (the target).** This is the model or person who will
  wear the outfit. Their face, body, skin tone, and pose are preserved.
- **Image 2 = the outfit (the source).** This is the garment photo, product shot,
  or editorial image containing the outfit to transfer.
- **Do not run without both images uploaded.** The workflow needs both inputs.
- **One paid run is the user's decision.** This skill submits the run via the
  Generate panel. The user sees the payload gate and confirms.
- **Aspect ratio: match the person photo.** If the person photo is portrait, use
  2:3 or 3:4. If square, use 1:1. Read the image dimensions, do not guess.
- **cfg 1 and 40 steps, and never raise cfg with an empty negative prompt.** Measured
  2026-09-25 against Qwen-Image-2.1's own card and its ComfyUI template: the app shipped
  cfg 8 and 20 steps, and cfg 8 is what produced the artifacts — block patches, blotches
  and a plastic surface. Every step down the dial improved the render; cfg 1 is the
  model's official path and cleanest, and 40 steps is the card's own default. The panel
  now opens there. *"negative_prompt: unused while cfg is 1"* is the template's own note,
  so a negative prompt only means something above cfg 1 — and raising cfg is what brings
  the artifacts back. At cfg 8 a 4.3 MP canvas was broken; the same canvas at cfg 1 is clean.
- **Megapixels: 2 for everyday, 4.3 for a final.** The model is 2K-native (3:4 is
  1792x2400 = 4.3 MP), so a bigger canvas is what keeps realism. It also costs more coins
  and it carries the reference's own texture through: at 4.3 MP the canvas is within a few
  percent of the reference, so almost nothing is resampled and any grain in image 1 passes
  through. At 2 MP the reference is resampled down and that grain averages away, which is
  the slightly airbrushed look. Size is not the fix for grain — measured: a reference 1.6x
  larger than the canvas changed nothing, and averaging the reference's texture did remove
  the grain but also the skin, hair and fabric detail. So fix grain at the source render,
  not with a prompt.

## Steps

1. Confirm both images are uploaded in the Generate panel's Qwen 2.1 Image Edit
   workflow, image 1 first. If not, ask the user to upload them.
2. Write the prompt as **one sentence that names the two images**, using the word the
   photo shows:

```
The woman in Image 1 wears the outfit from Image 2.
```

3. Add a second sentence **only if the first result dropped one specific detail**, and
   name that detail and nothing else:

```
Keep the [specific detail] of the garment in Image 2.
```

4. Set the aspect ratio to match the person photo.
5. Set megapixels to 2 (web) or 4 (print).
6. Press Generate.

## Common issues

- **An added clause moves more than its own axis.** Measured on the panel, 2026-09-25, five runs on
  one pair of images: lighting, pose, crop and backdrop each obeyed a single added sentence, and
  each one also made the dress less faithful — the control was the most detailed garment in the set.
  The pose clause invented a photographic studio with light stands in frame, and the control carried
  Image 2's shoes over with the garment while every later run dropped them. So: one clause at a
  time, and say what must NOT change as well as what must.
- **Blacks are crushed / shadows lost:** Qwen tends to deepen blacks. If the
  result loses shadow detail, try lowering the CFG step.
- **Face changed:** The person photo should be the first image. If the face
  changed, the images may have been swapped.
- **Garment simplified:** add the one clause from step 3 naming the detail that was
  lost. Do not add a paragraph: the measured failure of this workflow is too much
  text, not too little.
