# Subject swap — put an outfit on a person

Swap the outfit from one photo onto a person in another photo using the Qwen 2.1
Image Edit workflow. The user provides two images; you run the workflow.

## When to use

The user wants to see what a garment looks like on a specific person, or wants to
put an outfit from a product photo / editorial onto a different model. Triggers:
"swap the outfit", "put this dress on her", "outfit swap", "subject swap",
"clothing transfer", "what would this look like on me".

## Rules

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
- **Megapixels: 2 MP for web, 4 MP for print.** Default to 2 unless the user
  specifies print quality.

## Steps

1. Confirm both images are uploaded in the Generate panel's Qwen 2.1 Image Edit
   workflow. If not, ask the user to upload them.
2. Write the prompt using this template:

```
Swap the outfit from image 2 onto the person in image 1. Keep the person's face,
hair, skin tone, body shape, and pose exactly as they are. Transfer the garment
with full fidelity to the original materials — preserve the texture, fabric
construction, folds, draping, and color of the outfit. The garment should sit
naturally on the person's body with correct proportions, shadows, and fabric
behavior.
```

3. Add garment-specific details if the source image shows distinct textures:

```
Preserve the [specific material] texture, the [specific detail] details, and the
construction of the [specific element].
```

4. Set the aspect ratio to match the person photo.
5. Set megapixels to 2 (web) or 4 (print).
6. Press Generate.

## Common issues

- **Blacks are crushed / shadows lost:** Qwen tends to deepen blacks. If the
  result loses shadow detail, try lowering the CFG step or adding "preserve
  shadow detail and subtle tonal variations in dark areas" to the prompt.
- **Face changed:** The person photo should be the first image. If the face
  changed, the images may have been swapped.
- **Garment simplified:** Add more material-specific detail to the prompt.
