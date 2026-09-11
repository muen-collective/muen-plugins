# @muen/dsh-browser-skill

**Muen fork** of Tencent BrowserSkill's DeepSeek Harness plugin
(`@wxg-prc-cpg/browser-skill-dsh-plugin` v0.2.0, MIT — original © Tencent; LICENSE retained).
This is a **presentational re-skin only**: the browser bridge (`bsk` CLI), the `browser_*` tool set,
and the daemon protocol are unchanged from upstream.

## Why this fork exists

The stock plugin and extension render with BrowserSkill's own warm/orange palette and product
marketing, which clashes with the Mitsu/EVA surface. This fork re-skins that surface to the host
theme and makes it white-label:

1. **Overlay follows the theme** — the observation overlay maps its tokens to the host DSH/EVA
   tokens (instead of the upstream warm oklch palette).
2. **Tab icon removed** — the sidebar tab renders no BrowserSkill product mark.
3. **De-oranged** — no pulsing orange glow; control/approval UI is neutral/near-black.
4. **Rebranded** — extension manifest/popup read "Mitsumeru Browser" (extension fork built
   separately from `reskin-vs-stock.patch`; not shipped in this npm package).

## Install

```sh
dsh plugin --profile web add <path-to>/muen-dsh-browser-skill-0.1.0.tgz
```

or, while developing, add this folder directly as a link:

```sh
dsh plugin --profile web add ./plugins/dsh-browser-skill
```

Restart the harness profile afterwards (client plugins compose at boot).

Prerequisites that are **not** part of this package (unchanged upstream pieces):

- the `bsk` CLI on PATH (bridge — install per upstream README, e.g. `cargo install` / install.sh),
- the companion Chrome/Edge extension ("Mitsumeru Browser" build) loaded unpacked, which
  `bsk doctor` expects to see connected.

## Layout

- `lib/` — built host + client bundles (raw JS, no build step; keep the stock upstream built tree
  plus the re-skin in sync via `reskin-vs-stock.patch` when upstream moves).
- `cordis.patch.yml` — inserts the plugin row (`id: browserskill`, `name: '@muen/dsh-browser-skill'`).
- `LICENSE` — upstream MIT (© Tencent), kept per the fork rule.
- `FORK.md` / `reskin-vs-stock.patch` — what changed vs stock and the exact diff.
