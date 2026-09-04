# @muen/dsh-brand-swap

A **white-label brand-swap plugin** for DeepSeek Harness — it replaces the DeepSeek brand mark
in the DSH sidebar and hero with a **per-profile identity**. Every Brand OS (mitsu, yammaman,
vent, …) configures its own identity; the plugin itself ships neutral.

Two ways to set the identity (Settings → **Brand** page):

1. **Logo upload (v0.2)** — transparent PNG logos for **light and dark themes** are uploaded in
   the Brand settings page and rendered in the sidebar brand seat immediately.
2. **Wordmark config (v0.1)** — `wordmark` text + colors + font on the plugin row's `config`
   block (shown when no logo is uploaded).

Registers into three DSH slots:

- `sidebar.brand.mark` — 24×24 square mark seat (kept neutral/empty by default)
- `sidebar.brand.name` — 24 px-tall wordmark strip; a logo lockup renders here, **height-capped**
  (wide is fine, tall is not)
- `conversation.hero.brand.mark` — 34×34 square next to the hero headline above the composer
  tagline; **hidden by default** (only a genuine 34 px square mark would fit — long lockups don't)

## Logo upload (v0.2)

- Settings → **Brand** (additive `settings.section`, own locale namespace in en/zh/ko/ja).
- Two upload fields: **Light theme** and **Dark theme** (dark optional → falls back to light).
  Validation: `image/png`, ≤ 1 MB; live preview; replace/remove per field.
- Rendering: both logos are mounted in the name seat and switched with pure CSS on DSH's resolved
  theme attribute (`body[data-ds-dark-theme]`) — follows DSH's light/dark/system preference, no
  JS theme plumbing.
- Storage: PNGs are stored as data URLs in the plugin's `brand-swap` settings namespace
  (host settings doc; `localStorage` fallback if the settings scope is unavailable). Uploads
  survive plugin updates and app restarts — nothing edits the installed bundle.
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
