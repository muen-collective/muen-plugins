# @muen/mitsu-brand

A **generic brand-slot plugin** for DeepSeek Harness — it replaces the DeepSeek brand mark in three
DSH slots with a configurable wordmark + dot mark:

- `sidebar.brand.mark`
- `sidebar.brand.name`
- `conversation.hero.brand.mark`

## Neutral by default (value separation)

The plugin ships **neutral** — no client or Muen brand is baked in. Rendered values come from the
plugin's cordis `config` row:

| config key | default |
|---|---|
| `wordmark` | `''` — empty means **mark only** (no word text) |
| `textColor` | `var(--dsw-alias-label-primary)` |
| `dotColor` | `var(--dsw-alias-state-business-primary)` |
| `fontFamily` | `ui-sans-serif, system-ui, sans-serif` |
| `fontSize` | `18` |
| `fontWeight` | `700` |
| `letterSpacing` | `0.02em` |

A profile supplies its own identity by overriding these on the `mitsu-brand` cordis row's `config`
block (e.g. a client's `wordmark` / `textColor` / `dotColor`). With no override it just shows the
neutral mark in DSH design tokens, so it's legible in light and dark.

## Install

```bash
dsh plugin --profile demo add ./plugins/mitsu-brand
```

The client registers through the DSH slot registry and renders with inline styles, so no separate
CSS pipeline is needed.
