# Design the screens for a workflow

A workflow arrives with no screen. The install reads an app and writes an adapter; this skill
decides what a person then sees — which doors stand on the main screen, what they are called,
what the button says, and what the screen does when a run fails.

It is a design pass over the adapter's authored fields, run against the pane's own rules. It
never invents a control, never invents a number, and never writes plugin code.

## Rules that do not bend

- **No node id, no field name, no parameter grid is ever drawn.** The raw request belongs to
  the host: every run records the exact payload it sent, and the surface renders none of it.
- **One press spends.** The run control posts the run the moment it is pressed — there is no
  confirmation dialog (founder, 2026-09-23) — so never tuck that press among harmless
  controls, and put the run's phase on screen right away.
- **The app or the API is the authority on numbers.** Options, bounds, steps and defaults are
  copied, never improved.
- **Four doors is the main screen.** `house.mainDoors` is 4. A fifth door is a decision to put
  to the user, not a layout problem to solve alone.
- **A workflow gets the chrome that exists.** There is no per-workflow layout. If a design
  needs a shape the pane does not have, say so and ask — do not invent one.
- **A panel is a `Card`.** A workflow surface is two of them — the parameters card and the
  preview card — and the card surface, radius, border and padding live in that one component.
  Use it, and never restate a panel's style: the next screen stays consistent with this one
  only if every panel is drawn by the same component.
- **The preview canvas takes its shape from the workflow's own aspect door.** The door named
  `aspect_ratio` — or whatever the adapter's `preview.aspectDoor` names — decides: `9:16` is a
  portrait canvas, `16:9` landscape, `1:1` square. Never hard-code a shape, and never invent an
  aspect door for a workflow that has none: that workflow gets a square canvas.
- **A provider that declares run modes gets the split run control.** Its `runOption` (the
  registry's, never the adapter's — RunningHub's `instanceType` is the one today) becomes the
  segment beside the action, and the chosen mode travels with the run, because it
  changes what the run uses. A provider that declares none gets the plain button: never draw a
  segment that opens an empty list.
- **Copy is the profile's language, and data.** Labels are authored words. The plugin's own
  sentences come from `ctx.locale` under namespace `generate`.
- **The visual layer is the harness's own.** `--dsw-alias-*` tokens only: no EVA token name, no
  brand mark, no client name in the source.

## 1. Say what the person is making, and who they are

One line, in their words — "swap the outfit on a photo", not "image-to-image". If you cannot
say it, ask; a screen designed for a vague job fits nothing.

Then name the reader, because it decides the whole shape:

- **Casual** — one button. The defaults carry the run, the doors stay behind the disclosure.
- **Operator** — exposed controls. The doors are the workshop, the prompt is a field.

The most common case for an installed workflow is casual: the app is the craft, and the person
brought an image. Say which one you are designing for and let the user correct you.

## 2. Read what the screen will draw

Design from facts, never from the app's name. Read the workflow whole:

- the route `GET /plugins/generate/providers/<id>/workflow?name=<name>` for a workflow the
  pane already holds,
- or `rh_workflow_graph` for an app that has not been installed yet.

You get its doors, each with the control the pane will render, the app's own `options`, `min`,
`max`, `step`, `default` and tooltip, and the labels the glossary proposed. Design starts here.

## 3. Map every door to its control

The pane draws five controls. Which one a door gets is not a choice — it comes from the app:

| Control | A door gets it when | What a person does |
|---|---|---|
| `image` | the field holds a picture | drops a file or picks one; the door becomes a URL |
| `text` | the field is a string | types, or writes several lines when `multiline` |
| `number` | the field is a number | steps within the app's own `min`/`max`/`step` |
| `select` | the field has `options` | picks one of the app's own options |
| `list` | the field is an array of objects | adds a row at a time, each row carrying its own doors |

A door whose type the pane cannot draw is dropped, not guessed at. Say which doors you dropped
and why.

## 4. Order and rank the doors

- **The subject first, then the references, then the notes.** That is the order the work
  happens in.
- **One door takes focus** — the one the person came to change. Mark it `primary`.
- **Four doors on the main screen.** The rest collapse behind one disclosure, which is what
  `advanced` means.
- **Seeds and sampling knobs are advanced by default** (`Value`, `seed`, `cfg`, `steps`,
  `sampler_name`, `scheduler`). Nobody tunes a sampler before seeing one result.
- **`ui.order` wins over everything** when the adapter declares it.

## 5. Write the words

For each door: its `label` and, when the app has a tooltip, the `hint` under it. Keep the
glossary's generic words when the workflow is generic ("Reference image", "Prompt") and use the
trade's words when the workflow is specific ("Garment photo", "Person to wear it").

Then the workflow's own words:

- **`title`** — the harness's name for the app. It may name the engine.
- **`blurb`** — one line on the card, under whose app it is.
- **`ui.runLabel`** — what the button says. "Swap the outfit", not "Generate", when the
  workflow does something specific.
- **`ui.expect`** — the wait, only if the user told you or you measured it. Never a guess.

## 6. Decide where it opens

The app's own `default` is what the door opens at, and it stays compared by the validator. The
one authored number is `ui.defaults`, keyed by door key, for the case where the app's declared
default is a placeholder nobody would start at:

```json
"ui": { "defaults": { "duration": 15 } }
```

The value must still fit the door — an option the app offers, or inside the app's own range.

## 7. Walk the screens

Four surfaces carry a workflow. Only the third is per-workflow; the rest are chrome, and the
rules are here so a design does not fight them.

| Screen | What it shows | What it never shows |
|---|---|---|
| the start-page card | the surface's own label (**Generate**) and one line | a workflow list, a thumbnail, stats |
| the pane home | one accordion section per provider, in registry order, minus the hidden ones: each header carries the provider's name and its chevron, the open section's band below it carries the wallet balance, `family · count` and the add and refresh glyphs, and the open section holds its workflows as cards | a workflow's doors |
| the workflow surface | two cards that wrap: the parameters card (the workflow's title and blurb, the doors as controls in `ui.order` primary first, the app's tooltip under each, advanced doors behind one disclosure, the app's own bounds and options on every control, the run control at its foot) and the preview card (the run's state and its result) — plus a way back | a node id, a field name, an engine metadata row (the `title` may name the engine; nothing else renders model metadata), a panel that is not a `Card`, a card heading of its own |
| the run strip and result | `queued`/`running` with the spinning loading glyph, the elapsed time, the job id; a failure shows the provider's message verbatim beside the job id (the form never left the screen, so the run control is the way to try again — there is no Run again button); a finished run draws the result with a link to it | a progress bar with no number behind it, a Run again button |

The empty and failure states are part of the design, not an afterthought: a section that
answered nothing says so inside its own body, a workflow that cannot run says which door is
missing rather than opening a broken form, and a provider that refused a key says why on its
Settings row.

## 8. Check it on the page

The founder's eyes are the acceptance gate. Before you hand it over:

- Open the pane and read the workflow's screen at both a linked and an unlinked provider.
- Press the run control: the run must start on that press — the strip appears and the control
  disables itself — and a second press while it is in flight must post nothing.
- If you hold the plugin source, this repo's checks are the mechanical half: `node
  verify/save-confirmation.mjs --show` prints the pane's states so the copy is read without a
  restart, `node verify/run.mjs` drives the host's payload and run routes, `node
  verify/start.mjs` drives the pane.
- A `link:`-installed plugin's edits do not reach the page until the app restarts. Say that a
  restart is owed instead of claiming the screen is live.

## 9. Report

Tell the user: what workflow this is, what a person sees on its screen in one paragraph, which
doors are on the main screen, what the button says, which doors you marked advanced, and what
you left out and why. Name anything you want them to decide.

## What this skill does not do

It does not install a workflow — if there is no adapter yet, that is `add-rh-workflow`, and its
validator is what proves the file. It does not run a workflow and never spends coins. It does
not write plugin code: a design that needs new chrome is a plugin change, and that is a
conversation first.
