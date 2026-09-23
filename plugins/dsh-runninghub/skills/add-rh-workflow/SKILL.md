# Add a RunningHub workflow

Turn a RunningHub AI App into a surface inside the Generate panel. The plugin reads
the app's exposed inputs; you name them in the user's language, confirm the list,
and write one adapter file.

The user may also do this from the pane's `Add a workflow…` field, which runs the
mechanical half with no model at all. This skill is the polish path: you can ask
which door is the subject and which is the reference, write a run label that says
what the workflow does, and drop the doors that are noise. Both paths write the
same adapter shape, and an adapter either of them writes must pass
`rh_adapter_validate`.

## Rules that do not bend

- **Ask for the link before you fetch anything.** If no app link or id has been
  given, ask for it and stop. Never guess an app id, never pick one from memory,
  never fetch first and ask afterwards.
- **Write nothing until the user has confirmed the door list.** The install is one
  screen of plain words, then a file. Text in the conversation is not a
  confirmation; neither is silence.
- **Never invent an author.** The API carries no author or account field, so the
  attribution is the link the user pasted. If the app is not theirs, ask whether
  they want a name recorded, and leave `source.author` empty if they do not.
- **Copy the app's numbers, do not improve them.** `options`, `min`, `max`, `step`,
  `multiline`, `default` and `hint` are facts about the app. The validator compares
  them against the live app and fails the adapter when one differs.
- **One paid run is the user's decision, not yours.** This skill never submits a
  run. It writes a surface; running it happens in the panel, behind the payload
  gate.

## 1. Ask for the link

Ask for the RunningHub app link (or its id). A link looks like
`https://www.runninghub.ai/app/2072445848017002498`. The user may also give a bare
id.

If the wallet is not linked yet, say so and point at Settings → Generate before
continuing: the read below needs their key, and this plugin never holds an ambient
one.

## 2. Read the doors

Call `rh_workflow_graph` with the link. It answers with the app's name, its cover,
and every exposed input as a door:

- `key` — the semantic key the adapter will use
- `label` — the glossary's word for that field name, or the field name title-cased
  (`fromGlossary: false` marks the ones no glossary entry covers — flag those)
- `type` — `image`, `text`, `number` or `select`; `supported: false` means this
  plugin cannot render it
- the app's own numbers: `options`, `min`, `max`, `step`, `default`, `multiline`
- `hint` — the app's tooltip, when it has one
- `advanced` — the house style's judgement, which you may change
- `fieldData` — the API's raw string, so nothing has to be taken on trust

The tool also returns `adaptersDir` (where the file goes), `housePath` (the
profile's house-style override, if the user has one) and the house style in force.
If the user has a `_house.json`, its vocabulary wins over the shipped default —
read it before you write labels.

## 3. Say what you read, in plain words

Write the door list out for the user as a short list, not as JSON. For each door:
its label, its control, and what it will accept (the options, the range, the
default). Name the door that will take focus.

Then do the part only you can do:

- **Name the doors in the user's words.** "Garment photo", "Person to wear it",
  "Notes" — not `image`, `image`, `text`. Keep the plugin default's vocabulary when
  the workflow is generic.
- **Say which doors matter.** Mark the noise — raw seed, CFG, steps, sampler — as
  `advanced` so they collapse. Four doors is the house default for the main screen.
- **Order them the way the work happens**: the subject first, then the references,
  then the notes.
- **Choose the run label**: "Swap the outfit", not "Generate", when the workflow
  does something specific.
- **Say what to expect** ("about 40 seconds") only if the user tells you or you can
  measure it. Do not guess a duration.
- **Propose a title and a blurb**: the title is the harness's own name for the app
  and may name the engine; the blurb is one line. The RunningHub name is kept in
  `source.webappName` and is never the label.
- **Ask about the app's origin** — the user's own, or someone else's. Set `origin`
  to `mine` or `community`; a community entry is marked as someone else's work in
  the panel, and that marking is the point.

Three things to raise rather than decide alone:

- a door whose `fromGlossary` is false: say the label is unpolished and offer yours
- a door with `supported: false`: say this plugin cannot render it and offer to drop
  it, or to leave the workflow alone for now
- a door whose options or bounds look wrong for the workflow: the app is the
  authority, so say what the app reports and ask before changing anything

## 4. Wait for the confirmation

Stop here and let the user answer. They may rename doors, drop some, mark others
advanced, or correct the order. If they ask for something the app does not support,
say which door blocks it.

## 5. Write the adapter

Write one file to `<adaptersDir>/<name>.json`. `name` is lower-case, dashed, and
stable — it is the file name and the identity (§8 rule 1: republishing under the
same name with a new `appId` moves nothing in the UI). Start from the object
`rh_workflow_graph` returns under `adapter` and change only what the user decided:

- `name`, `title`, `blurb`, `group`, `model`, `variant` — authored
- `origin` — `mine` or `community`, from the user
- `source` — keep `appId`, `webappName`, `url`, `revision`, `checkedAt` as the tool
  gave them
- `doors` — the app's `nodeId`, `fieldName`, and every derived value, byte for byte;
  your `label`, `advanced`, `primary` and ordering on top
- `ui` — `runLabel`, `expect`, `presets`, `order`
- `provenance.dryRun` — `""` for now; step 6 decides it

Use your ordinary file write tool. Nothing writes this file for you.

## 6. Validate, then fix

Call `rh_adapter_validate` with the file path. It re-reads the app — read-only, so
it spends nothing and submits nothing — and reports every problem with the door and
both values:

| Problem | What it means | Fix |
|---|---|---|
| `unknown-door` | the pair is not on the app any more | drop the door, or re-read the app |
| `door-pair` | node and field name both exist, but not together | correct the pair — this is the one a `nodeId`-only check misses |
| `derived-drift` / `derived-missing` | a number differs from the app | copy the app's value; do not keep yours |
| `unsupported-type` | the type is not one of the four the pane renders | drop the door |
| `origin-missing` | nobody said whose work this is | ask, then set it |
| `not-dry-run` | `provenance.dryRun` is not `ok` | set it once the validator passes |

Fix and re-run until it reports `ok`. Then set `provenance.dryRun` to `ok` and write
the file once more. An adapter that does not pass is not listed, so a green
validator is the difference between a surface and a file.

## 7. Report

Tell the user: what was installed, what it is called, which doors it shows, and
where the file is. Then say how to open it — the Generate card on the right panel's
start page lists what is installed, and selecting it opens that app's own tab.

If this was a community app, say so, and say that the author can change the app
under the saved surface: `rh_adapter_validate` re-read against the app is how drift
is found later.

## What this skill does not do

It does not publish anything to RunningHub (the public API cannot create or update
an app), it does not run a workflow, and it does not spend coins. It writes one
file that describes a surface.
