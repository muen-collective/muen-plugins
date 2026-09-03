# muen-plugins

Muen-authored plugins for the DeepSeek Harness (DSH) market. This is the source-of-truth repo for
`@muen/mitsu-*` plugins: they are published as **GitHub Release tarballs** and installed by the
standard market mechanism (`dsh plugin add`), so they are versioned, updatable, and survive upstream
DSH upgrades.

## Layout

The publish repo holds **only the one first-party plugin we ship**. Everything else the harness
needs comes from the community DSH market via `install-mitsu-bundle` — not from here.

```
plugins/
  mitsu-brand/     @muen/mitsu-brand  (the only Muen plugin; bundled in the Mitsumeru DMG and listed on the market)
```

The package declares `name` (`@muen/mitsu-brand`), `version`, `files`, and `dsh.bundle`
(`cordis.patch.yml`), so it packs and installs cleanly with no build step.

> **History note:** this repo previously held the other `@muen/mitsu-*` plugins (the old "Mitsu
> surface plugins"). Those were **failed experiments** — only `@muen/mitsu-brand` is a real first-party
> plugin. They were removed permanently and are no longer published, listed, or referenced as live
> plugins anywhere. If you see them mentioned, treat it as stale.

## Publish (register with the DSH market)

The market (`dshmarket`) shows the curated catalog at `awesome-dsh-plugin.com/plugins.json`, which is
**generated** from the `github.com/awesome-dsh-plugin/awesome-dsh-plugin` repo's `data/plugins/*.yml`
(one YAML per plugin; READMEs are auto-generated). To register a plugin:

1. Push this repo to GitHub and make it **public**; add the **`dsh-plugin`** topic. The repo must be
   **≥1 day old and ≥10 commits** (CI checks this).
2. Optionally tag a Release (`v*`): `release.yml` runs `node scripts/pack-all.mjs` and attaches each
   `.tgz` to the GitHub Release (the market prefers a published npm package or a Release tarball over
   build-from-source).
3. **Open a PR** to `awesome-dsh-plugin/awesome-dsh-plugin` that adds ONE file
   `data/plugins/<owner>__<repo>.yml` (monorepo subpackage: `owner__repo--<subpath>.yml`). It declares
   `dsh.bundle` in `package.json` — already true for every plugin here. Example entry for the brand
   plugin (`category` must be from the valid set, e.g. `theme`):
   ```yaml
   url: https://github.com/muen-collective/mitsu-plugins/tree/main/plugins/mitsu-brand
   name: muen-collective/mitsu-plugins#mitsu-brand
   category: theme
   description:
     en: A configurable brand-slot plugin ... (accurate one-liner)
   ```
4. Verify from a fresh profile: `dsh plugin --profile demo add <tarball-url | github:...>`.

Update an entry the same way — edit **only your** `data/plugins/*.yml` and regenerate
(`node scripts/generate-readme.mjs`).

## Value separation

Published plugins are **neutral/generic** — no client (or Muen) brand is baked into the package.
Per-profile `config:` on a plugin's `cordis.patch.yml` row supplies the specific values (e.g. a
client's wordmark via the `mitsu-brand` row's `wordmark`/`fontFamily`/`dotColor`). The market card
can show a branded screenshot as an illustration; the shipped package stays neutral.

## Optional: npm

If you later prefer the `@muen` npm scope, `npm publish` each package (needs `@muen` scope ownership
+ auth) and point the catalog `url` at the npm package instead.
