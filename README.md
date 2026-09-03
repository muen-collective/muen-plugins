# muen-plugins

Muen-authored plugins for the DeepSeek Harness (DSH) market. This is the source-of-truth repo for
`@muen/*` plugin packages. They are published as **GitHub Release tarballs** (and installed by the
standard market mechanism `dsh plugin add`), so they are versioned, updatable, and survive upstream
DSH upgrades.

This is a **monorepo**: one subdirectory per plugin, so we can keep adding plugins (and forks of
community plugins) without restructuring.

## Naming schema (keep consistent — every plugin follows this)

| Thing | Convention | Example |
|---|---|---|
| GitHub repo | `muen-collective/muen-plugins` | — |
| Source dir | `plugins/<slug>/` | `plugins/mitsu-brand/` |
| Package (`package.json` `name`) | `@muen/<slug>` | `@muen/mitsu-brand` |
| Version | `0.x.y` semver | `0.1.0` |
| Installability | `dsh.bundle.patch` + a `cordis.patch.yml` (NOT just `dsh.client`) | required |
| Market entry `url` | `.../tree/main/plugins/<slug>` (subdir of this monorepo) | `…/plugins/mitsu-brand` |
| Market entry `name` | `muen-collective/muen-plugins#<slug>` | `muen-collective/muen-plugins#mitsu-brand` |
| Market `category` | from the market's valid set (`theme`, `ui`, `docs`, `tools`, …) | `theme` |
| Market `description` | accurate one-liner (checked against source) | — |

`<slug>` is the plugin name **after** the `@muen/` scope, so the package name, source dir, and
market-entry short name all agree.

## Layout

```
plugins/
  <slug>/                @muen/<slug>  (one subdir per plugin)
    package.json         name: @muen/<slug>, dsh.bundle.patch: ./cordis.patch.yml, files
    cordis.patch.yml     inserts the plugin row (id + name)
    lib/                 the built host + client bundles (raw JS, no build step)
    README.md            accurate description of what the plugin does
```

### Adding a new plugin

1. `plugins/<new-slug>/` with `package.json` (declare `dsh.bundle.patch` + `dsh.client` if it has UI),
   `cordis.patch.yml` (row `id`/`name` = `@muen/<new-slug>`), `lib/`, `README.md`.
2. Bump `version`. Add `script`s to the root `package.json` (`pack:<slug>`).
3. To publish: tag a `v*` Release (the `release.yml` packs every plugin and attaches the `.tgz`),
   then open a PR to `awesome-dsh-plugin/awesome-dsh-plugin` adding `data/plugins/muen-collective__muen-plugins--plugins-<slug>.yml`.

### Forking a community plugin (to improve the UI)

Put it in its own subdir `plugins/<fork-slug>/`, name it `@muen/<fork-slug>`, and:

- **Credit the original author** — keep their LICENSE/copyright in your package (MIT etc.), and note
  the fork provenance in the plugin's `README.md` (a `FORK.md` like the product repo's
  `plugins/dsh-file-explorer/FORK.md`). The market's fork rule: real code that does something, and
  dependencies must point at the **original author's** repo/package — don't re-upload upstream copies
  under your account and depend on those.
- Keep the plugin generic/configurable (no Muen secrets or a specific client baked in).

## Publish (register with the DSH market)

The market (`dshmarket`) shows the curated catalog at `awesome-dsh-plugin.com/plugins.json`, which is
**generated** from `github.com/awesome-dsh-plugin/awesome-dsh-plugin`'s `data/plugins/*.yml`. To
register a plugin:

1. Push this repo to GitHub and make it **public**; add the **`dsh-plugin`** topic. The repo must be
   **≥1 day old and ≥10 commits** (CI checks this).
2. Optionally tag a Release (`v*`): `release.yml` runs `node scripts/pack-all.mjs` and attaches each
   `.tgz` to the GitHub Release (the market prefers a published npm package or a Release tarball over
   build-from-source).
3. **Open a PR** to `awesome-dsh-plugin/awesome-dsh-plugin` adding ONE file
   `data/plugins/muen-collective__muen-plugins--plugins-<slug>.yml`. Example:
   ```yaml
   url: https://github.com/muen-collective/muen-plugins/tree/main/plugins/mitsu-brand
   name: muen-collective/muen-plugins#mitsu-brand
   category: theme
   description:
     en: A configurable brand-slot plugin for DeepSeek Harness. Registers a wordmark + dot into the sidebar and conversation-hero brand slots (replacing the DeepSeek mark). Ships neutral defaults; wordmark text, colors and font are overridable per profile via the plugin's cordis config.
   ```
4. Verify from a fresh profile: `dsh plugin --profile demo add <tarball-url | github:...>`.

Update an entry the same way — edit **only your** `data/plugins/*.yml` and regenerate
(`node scripts/generate-readme.mjs`).

## Value separation

Published plugins are **neutral/generic** — no client (or Muen) brand is baked into the package.
Per-profile `config:` on a plugin's `cordis.patch.yml` row supplies the specific values (e.g. a
client's wordmark via the `mitsu-brand` row's `wordmark`/`fontFamily`/`dotColor`). The market card
can show a branded screenshot as an illustration; the shipped package stays neutral.

## History note

This repo previously held the old `@muen/mitsu-*` surface plugins (assets, docs, write, krea,
runninghub, modes, rail, settings, sidebar-tree, task-switcher, starter-pack, updater,
open-in-sidebar, browser). Those were **failed experiments and are permanently deleted** — only
`@muen/mitsu-brand` is a real first-party plugin, and everything else is sourced from the community
DSH market. Do not recreate, publish, or reference them as live plugins.

## Optional: npm

If you later prefer the `@muen` npm scope, `npm publish` each package (needs `@muen` scope ownership
+ auth) and point the catalog `url` at the npm package instead.
