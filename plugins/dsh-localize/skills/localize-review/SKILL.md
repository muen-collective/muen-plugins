---
name: localize-review
description: Review a plugin's translations and record per-key verdicts — approved, flagged or missing — with the reason, in the profile's review memory.
whenToUse: Use when the user asks to review, audit or check translations for a plugin or a language ("review the Korean", "audit the ko file", "is this translation right"), or when a translation change needs a verdict before it ships.
---

# localize-review

Judge a plugin's translations one key at a time, and leave a record that outlives the session.

Supersedes the Kun skill of the same name: the verdicts now live in the **profile's review memory**
(`<profile>/localize-memory/<plugin>/<lang>.json`), keyed by the **hash of the English source**, and the
translations themselves live in the profile's overlay (`<profile>/localizations/<plugin>/<lang>.json`) or in
the owning plugin's own dictionaries. Both are the profile's, so a plugin update cannot remove either.

## Trigger

"review the Korean for `<plugin>`", "audit the ja translations", "check this translation", or a locale change
submitted for a verdict.

## Input

| Field | Required | Where |
|---|---|---|
| `plugin` | yes | the package name the strings belong to |
| `lang` | yes | the target language (`ko` and `ja` are first-class; `fr`/`de`/`es` are catalogued) |
| the map | yes | the source → target pairs to judge: the overlay for that plugin, or the plugin's own dictionary |

## Process

1. **Load the map.** For a plugin we do not own: the overlay file, or `GET /plugins/localize/overlay?plugin=<p>&lang=<l>`.
   For one of ours: its own dictionary for that language.
2. **Load what is already known.** `<profile>/localize-memory/<plugin>/<lang>.json`, and ask which keys need
   review — a key whose English source or approved target has changed comes back as changed or new, and an
   approval made under an older prompt comes back as stale. **Do not re-judge what is already approved under
   the current prompt**; the memory exists so review effort goes where something moved.
3. **Judge each remaining key on four axes**, and flag the key if any one fails:

   | Axis | Flag when |
   |---|---|
   | **accuracy** | the meaning is changed, narrowed or expanded |
   | **register** | the tone is wrong for the context — ja politeness (です/ます vs plain) or ko speech level (합니다 vs 해요) for a button, a heading, a tooltip, a label |
   | **context** | the wording does not fit the UI element it is drawn in |
   | **completeness** | the key has no translation at all |

4. **Verdicts.** `approved`, `flagged` (with the reason) or `missing`. A flagged verdict names the axis and
   says what to write instead — "활성화 is too formal for a toggle button; use 사용" is a verdict, "wrong" is not.
5. **Record every attempt.** One entry per key, keyed by the hash of the English source, holding the source,
   the target judged, the verdict, the reason and the **prompt version**. `attempts` is APPEND-ONLY.
6. **Report** the evidence pack: a summary (total / approved / flagged / missing) and one entry per key.

## The gate

Two panels judge independently (the dual-panel adversarial process), and the rules are not negotiable:

1. **Both must pass** — a key needs both panels' approval.
2. **Either can veto** — one flag blocks the key.
3. **No retry-until-green** — every attempt is logged, INCLUDING rejections. A rejection is the record of
   what was tried and why it failed; deleting it is how a gate becomes theatre.
4. **The founder is the escalation judge** — a tie between panels is theirs, and only theirs.

## Cross-plugin consistency

After a review, compare approvals across plugins: one English string approved two ways in two plugins is a
defect in one of them (`"Enable"` = `활성화` here and `사용` there). The memory makes this a read, not a
re-scan of every plugin.

## Prompt version

The prompt is a quality gate, so it is versioned: **this skill produces `localize-review@1`**, written on
every attempt, and a change to the prompt's standard re-opens the approvals it produced. When the standard
changes, bump `PROMPT_VERSION` in `lib/memory.js` AND this line together — `verify/review.mjs` fails if the two
disagree, and `lib/memory.js` then reports the older approvals as needing review rather than silently trusting
them.

## Output

The evidence pack, in the shape `evidencePack()` produces: `{ plugin, lang, reviewedAt, reviewer, prompt,
summary, keys }`, where each key is `{ verdict, en, target, note? }`.
