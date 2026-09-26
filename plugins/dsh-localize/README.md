# @muen/dsh-localize

**One plugin for language** (epic 65): the languages we own are added to DeepSeek Harness's shared
catalog, and a globe beside Settings switches between them. Neutral — no brand or client is baked in.

Supersedes `@muen/dsh-language-switcher` (deleted) and the withdrawn ko/ja pack. See
`docs/plans/65-muen-localize-epic.md` in the workspace for the whole epic.

## What it does

**The catalog.** `locale.register(ns, locale, dict)` stores strings and **does not make a language
selectable** — the picker lists the catalog, and the catalog is filled by
`locale.addLanguage({ id, label, fallback })`. Measured in the installed
`@deepseek-ai/dsh-client-locale` (0.1.7-rc.1) and again in the 0.2.3 target: the runtime seeds the
catalog with **`zh` and `en` only**, `addLanguage` **throws** when the id is taken or the fallback is
not yet registered, and the chain must terminate at English. A dictionary registered for a language
nobody added is dead weight.

So `lib/client.js` adds only what is missing, keeps a built-in instead of re-registering it, and
**refuses a row it cannot defend with a reason** — `unknown-fallback`, `bad-id`, `bad-label`,
`duplicate-row` — rather than throwing during activation. One bad row must not cost a person the rest
of the picker.

| id | label | fallback | reviewed |
|---|---|---|---|
| `ko` | 한국어 | `en` | yes |
| `ja` | 日本語 | `en` | yes |
| `fr` | Français | `en` | no |
| `de` | Deutsch | `en` | no |
| `es` | Español | `en` | no |

`reviewed` is data about the **translation**, never about whether the language may be chosen: hiding
an unreviewed language would take the choice away from the person whose language it is. `en` and `zh`
belong to the runtime and are never re-registered.

**The globe.** At `sidebar.footer.action` (id `localize`, order 5 — the sidebar foot, beside
Settings). It lists the **catalog**, not a constant: every row is a language the harness will accept,
drawn with the label that language calls itself, and a language added to the catalog *after*
activation appears with no change here. The trigger is the app's own `IconGlobeOutlineRegular` and the
app's own `Menu`; choosing a row is `locale.setLocale`, which persists the choice through the
harness's own preference scope.

**The Settings row is not ours.** The harness's locale plugin already draws Settings → General →
Language from the same catalog, so a second row from us would be two rows listing the same languages.
What this plugin contributes to that page is the languages themselves.

## Verify

```
node verify/catalog.mjs   # the languages we own, against the HARNESS'S OWN LocaleRuntime (22 checks)
node verify/mount.mjs     # the bundle, the globe and its activation (27 checks)
```

Both suites load the shipped `lib/client.js` rather than a copy of it, and `verify/catalog.mjs`
instantiates the real `LocaleRuntime` from the installed harness — `DSH_CLIENT_LOCALE` points at
another build, and a machine without the bundle skips those checks with a note.

## Still to come (epic 65)

- **L3** — the four Muen plugins carry real dictionaries in the languages we own, with a coverage
  check that fails on a missing key instead of falling back silently.
- **L4** — the overlay: per-plugin locale JSON at `<profile>/localizations/<plugin>/<lang>.json` for
  third-party plugins whose strings are hardcoded.
- **L5/L6** — the review skill and the memory keyed by a hash of the English source.
- **L7** — the carrier we actually run: the profile currently pins the community
  `dsh-multi-lang-ui`, while our frozen fork sits unused.
- **Installing it here**: the plugin is not in the mitsu profile yet.
