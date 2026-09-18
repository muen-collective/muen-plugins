# @muen/dsh-brand-swap

A **white-label brand-swap plugin** for DeepSeek Harness — it replaces the DeepSeek brand mark
in the DSH sidebar and hero with a **per-profile identity**. Every Brand OS (mitsu, yammaman,
vent, …) configures its own identity; the plugin itself ships neutral.

Two ways to set the identity (Settings → **Brand** page):

1. **Logo upload (v0.2)** — transparent PNG logos for **light and dark themes** are uploaded in
   the Brand settings page, staged as a live preview, and applied with the **Save brand** button
   (Revert discards unsaved edits). Saved logos render in the sidebar brand seat and persist in
   the host settings doc across restarts.
2. **Wordmark config (v0.1)** — `wordmark` text + colors + font on the plugin row's `config`
   block (shown when no logo is uploaded).

Registers into four DSH slots:

- `sidebar.brand.mark` — 24×24 square mark seat (kept neutral/empty by default)
- `sidebar.brand.name` — 24 px-tall wordmark strip; a logo lockup renders here, **height-capped**
  (wide is fine, tall is not)
- `conversation.hero.brand.mark` — 34×34 square next to the hero headline above the composer
  tagline; **hidden by default** (only a genuine 34 px square mark would fit — long lockups don't)
- `conversation.hero.tagline` — the blank-session headline itself. **This seam is not shipped by
  upstream DSH**: it is added by `05-dsh-core/patches/patch-hero-brand-tagline.mjs` in the Mitsu
  fork (see "Hero tagline" below). On a harness without it, the registration is simply inert.

## Hero tagline (v0.2)

The blank-session hero shows one line — upstream's `hero.headline` ("Into the Unknown" /
探索未至之境). A brand can replace it:

- **Settings → Brand → Hero tagline** — free text (≤ 200 chars). **Empty keeps the upstream copy**:
  the occupant re-renders the text the seam hands it as `fallbackText`, so the words never vanish
  while the brand is being edited, and a stock harness still renders its own headline.
- A profile can seed a default on the plugin row's `config` (`brandTagline`); the settings field
  wins once edited. Persisted in the same `brand-swap` host settings namespace as the logos.
- Render: the occupant is a `<span>` carrying the seam's `headlineClassName`, so it inherits the
  shipped hero typography. A brand that wants a different look sets CSS variables on itself:
  `--bs-tagline-color`, `--bs-tagline-font-size`, `--bs-tagline-font-weight`,
  `--bs-tagline-letter-spacing`.
- If the seam is absent, the page says so after a save (and on open) instead of silently ignoring
  the tagline — it probes the conversation bundle for the seam marker.

Why a patch and not a plugin-only seat: DSH's client Slots service exposes `inject`/`register`
only — slot names exist in the compiled render tree, so a plugin cannot declare a new seat — and
`ctx.locale.register('conversation', …)` throws because the UI package already owns that namespace.
The patch script documents the one-line upstream equivalent.

## Logo upload (v0.2)

- Settings → **Brand** (additive `settings.section`, own locale namespace in en/zh/ko/ja).
- Two upload fields: **Light theme** and **Dark theme** (dark optional → falls back to light).
  Validation: `image/png`, ≤ 1 MB; live preview on a dark canvas (the seat these logos render
  on is dark, independent of the app theme); replace/remove per field.
- Rendering: both logos are mounted in the name seat and switched with pure CSS on DSH's resolved
  theme attribute (`body[data-ds-dark-theme]`) — follows DSH's light/dark/system preference, no
  JS theme plumbing.
- Saving: edits are staged locally and committed only by **Save brand**. Each save writes the
  every field to the plugin's `brand-swap` settings namespace in the **host settings doc**
  (durable across restarts). The host half registers that namespace synchronously at boot
  (`ctx.inject(['settings'])` + the schemastery **default** export). If no host settings service
  is available the page keeps a `localStorage` mirror and visibly warns that the save is
  local-only — nothing edits the installed bundle.
- Size guidance shown in the page: lockup artwork ≥ 48 px tall (2× of the 24 px render) with side
  padding; square marks ≥ 96 px; the render is height-capped at 24 px (sidebar) / 34 px (hero).

## Neutral by default (value separation)

No client or Muen brand is baked in. Wordmark values come from the plugin row's cordis
`config` block:

| config key | default |
|---|---|
| `wordmark` | `''` — empty means **mark only** (no word text) |
| `textColor` | `var(--dsw-alias-label-primary)` |
| `dotColor` | `var(--dsw-alias-state-business-primary)` |
| `fontFamily` | `ui-sans-serif, system-ui, sans-serif` |
| `fontSize` | `18` |
| `fontWeight` | `700` |
| `letterSpacing` | `0.02em` |
| `brandTagline` | `''` — empty keeps the upstream hero headline |

## Install

```bash
dsh plugin --profile demo add ./plugins/dsh-brand-swap
```

The client registers through the DSH slot registry and renders with inline styles + a small
injected stylesheet, so no separate CSS pipeline is needed.

## Legacy name

Before 2026-09-04 this package was authored as `@muen/mitsu-brand`. The app-bundled copy
(installed in the Mitsumeru desktop under the old identity, row id `mitsu-brand`, service
`mitsu.brand`) stays as-is until the next app release; new installs and the market artifact use
`@muen/dsh-brand-swap` (row id `brand-swap`, service `brand`).

> **Do not co-install.** `@muen/dsh-brand-swap` and the legacy `@muen/mitsu-brand` register the
> **same three brand slots** (`sidebar.brand.mark`, `sidebar.brand.name`,
> `conversation.hero.brand.mark`); the legacy copy has no hero-tagline seat. Remounting the legacy copy while this plugin is installed
> double-mounts the sidebar brand seat. Mount **exactly one** — use `@muen/dsh-brand-swap`.
