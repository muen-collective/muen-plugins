# FORK — BrowserSkill dsh-plugin → Muen `@muen/dsh-browser-skill`

**Forked from:** `@wxg-prc-cpg/browser-skill-dsh-plugin` v0.2.0 (Tencent/BrowserSkill, MIT)
**License:** MIT (upstream ⓒ Tencent; retained in `LICENSE`)
**Repo location:** `muen-collective/muen-plugins` → `plugins/dsh-browser-skill`

A re-skin of BrowserSkill's DeepSeek Harness plugin so its in-harness surface matches the **Mitsu/EVA**
theme and is **white-label** (no third-party brand). The browser bridge, the `browser_*` tool set, and
the `bsk` daemon are **unchanged** — this is a presentational re-skin only.

## What changed

1. **Overlay follows the theme** — `bsk-tokens.nomodule.css` now maps the overlay's `.bsk-obs` tokens to
   the host DSH/EVA tokens (`var(--dsw-alias-bg-layer-2)`, `--dsw-alias-label-primary`,
   `--dsw-alias-state-business-primary`, `--dsw-alias-border-l2`, `--dsw-alias-state-error-primary`)
   with neutral fallbacks, instead of the upstream warm oklch palette (the orange-brown bg). It now
   inherits the app's dark theme.
2. **Tab icon removed** — the *"Browser Skill"* tab in better-sidebar no longer renders the BrowserSkill
   product mark (the "emoji" next to the label); `TabIcon` returns `null`.
3. **De-oranged (the companion extension, `apps/extension`)** — removed the pulsing orange glow (`bsk-breathe`,
   `rgba(249,115,22,…)`) and made the bottom control button **near-black**; the approval overlays
   (Borrow / Help-request) are neutral instead of `#f97316`/`bg-orange-500`.
4. **Rebranded** — extension manifest name/description → **"Mitsumeru Browser"**, popup title + all i18n
   strings → Mitsumeru, and the icon mark → the **Mitsu** mark.

The exact re-skin diff vs the stock tree is saved as `reskin-vs-stock.patch` (re-apply with
`git apply` inside a clone of Tencent/BrowserSkill — it covers the plugin `src/` and the extension
`apps/extension`; the `lib/` bundles here are the built output of the patched plugin).

## How to swap it in (test)

1. **Remove the upstream plugin** from the profile (id `browskill` was installed from
   `@wxg-prc-cpg/browser-skill-dsh-plugin`), then add this fork:
   ```sh
   dsh plugin --profile web remove @wxg-prc-cpg/browser-skill-dsh-plugin
   dsh plugin --profile web add /Users/thuypham/muen-plugins/dist/muen-dsh-browser-skill-0.1.0.tgz
   ```
   (or `add ./plugins/dsh-browser-skill` for a dev link). Restart the profile.
2. **Extension** (built, unpacked): load `/tmp/browserskill-fork/apps/extension/dist/chrome-mv3/`
   (Brave → `chrome://extensions` → Developer mode → **Load unpacked**).
3. Keep the `bsk` CLI (`~/.local/bin/bsk`) and the extension connected.

## Verify (reskin acceptance)

- [ ] Better-sidebar surface background now matches the app theme (dark, no orange-brown).
- [ ] "Browser Skill" tab label has no icon/emoji.
- [ ] Agent Window: no pulsing orange glow while driving; the bottom button is black/neutral.
- [ ] Toolbar/popup read "Mitsumeru Browser" with the Mitsu icon (no BrowserSkill branding).

## Not in this fork / notes

- The **browser extension** (the Agent Window overlays) is forked in `reskin-vs-stock.patch` but built
  separately (`apps/extension` → `dist/chrome-mv3/`); the npm package ships the **dsh-plugin only**.
- The `bsk` CLI is still Tencent's upstream binary (the bridge — unchanged). Rebranding that is
  out of scope; it's not user-visible.
- Internal `@wxg-prc-cpg/...` strings inside the built `lib/` are invisible runtime keys (CSS tag ids,
  registry names) — they are not shown in the UI and do not need renaming in the bundle.
- If you want the extension distributed publicly, publish the built extension to the Chrome Web Store
  under a **Muen / Mitsumeru** listing (separate step, needs a CWS account).
