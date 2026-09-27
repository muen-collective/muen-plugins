# @muen/dsh-composer-race

Two soft dots race around the composer's edge while the addressed agent is working. They start
together on the same line; purple is the faster one and crosses first, then holds the line until
green arrives — and green's arrival is what starts the next race.

Client-only. It replaces nothing, stores nothing, adds no settings row, and touches no
composer markup — one hidden marker inside the composer card plus one stylesheet.

```
[data-composer-card]:has([data-muen-race="on"])::before   /* green — the slower dot  */
[data-composer-card]:has([data-muen-race="on"])::after    /* purple — the leader     */
  { … conic-gradient comet from the same start angle, masked to a 2.5px ring … }
```

## Why it survives a harness upgrade

Both hooks it rides are **semantic**, not per-build:

| What it needs | What it uses | Why not the obvious alternative |
|---|---|---|
| the composer box | `[data-composer-card]` | the class beside it is a per-build hash (`uV2eYG_card`), so a class-keyed rule dies on the next harness release |
| to reach the box from the marker | `:has()` | already used 54 times by the shipped CSS, so it is proven in this Chromium |
| a seat inside the box | `conversation.input.overlay` | a harness-declared `list` slot (scope `session`) rendered as the card's **first child** through `overlayAnchor` — that is what it exists for |
| "the agent is working" | `running`, off the session lifecycle hook the slots runtime hands every session-scoped entry | it is **not** a data attribute: `data-phase` is the layout phase (hero/settling/active) and `data-composer-composing` is IME composition |
| the selected theme | `ctx.theme` through the seat entry's own inject face (`hooks: { theme }` → `useTheme`) | the preference id exists nowhere in the DOM, and no standard-kit `useTheme` is contributed — the entry inject is the channel the shipped `ui-settings-account` / `ui-sidebar-terminal` rows use |

`conversation.composer` is the composer **takeover** chain slot; this plugin deliberately
does not use it. The seats it does use are additive, like the built-in queue dock
(`conversation.input.dock`, order 20) and `@muen/dsh-context-watchdog` (order 30).

## What the spike measured (2026-09-26, harness 0.1.7-rc.1)

- **Nothing named `race` exists in EVA.** `packages/eva` has no `race`/`racing` and `theme.css`
  is 160 lines of tokens with **zero** `@keyframes`; the separate `eva design system` root has
  none either. This animation is new work, not a port of an existing EVA asset.
- **The harness does have a motion vocabulary**, including a composer-local one:
  `@keyframes uV2eYG_input-pending` (an 8×8 pulsing dot — `uV2eYG_pending`), plus
  `eGxaPq_dsh-turn-mark-busy`, `dsh-text-shimmer`, `dsh-state-dot-spin`, and the sweep
  animations. So the composer already signals "pending" with a dot; this plugin adds the
  border without removing that.
- **The card is animate-ready by construction**: `border:0`, `border-radius:22px`,
  `position:relative`, its ring drawn by `--dsw-elevation-stroke-color` + `box-shadow`. The
  overlay is `inset:0` + `border-radius:inherit`, so nothing about the card is overridden.
- **A third-party plugin really can read session state here.** Not inferred: `running` is the
  fact the composer itself uses to turn Send into Stop (`primaryStops = running && …`); the
  slots contract documents the standard kit as "session lifecycle hook, projection hook, and
  Session identity"; and shipped Muen plugins already consume it as props —
  `@muen/dsh-context-watchdog` (`props.useProjection`, `props.sessionId`),
  `@muen/dsh-fast-context` (`props.useSessions`), `@muen/dsh-changes-card` and
  `@muen/dsh-turn-summary` (`props.useChat`).

The one residual unknown is which name the runtime hands a **third-party** entry: the
built-in queue dock reads `useSession`, while the Muen precedents show `useSessions`. The
entry guards on whichever arrives (and falls back to the plural store read at its own
session id), so either runtime works; the app start proves which one fires.

## The EVA design: a race

Two soft dots, each trailing a comet tail, start together at the top-left corner of the card — which is also
the finish, because a lap ends where it began. Purple crosses at **62% of the cycle** and holds
the line. Green laps for the whole cycle; its arrival is the finish, and the next lap starts from
the same point for both. So the cycle *is* green's lap, and the race resets the moment the slower
dot lands.

The pair is EVA Unit 01's brand triad — `--primary` `#765898` (the purple EVA's own documented
glow halo is built from it) and `--secondary` `#52d053` (EVA green) — carrying their hexes as
fallbacks, so the look holds even in a profile that never loaded the EVA tokens. Purple is
painted above green, because at the start line (top-left corner) the two dots are coincident and the leader should
not be the one covered.

## Theme alignment: the selected theme picks the pair

The accepted design *is* EVA Dark, so that pair is the sheet's base. What the theme then
decides is which pair the dots wear — the marker carries the selected theme's id as
`[data-muen-race-theme]`, and two `:has()` rules re-ink **both** card variables:

| Selected theme (Settings → Appearance) | Marker attribute | The pair |
|---|---|---|
| **EVA Dark** (`eva-01`) | `eva-01` | base pair — purple `#765898` + green `#52d053` (no override rule needed) |
| **EVA Light** (`eva-00`) | `eva-00` | dark blue `#000864` + light blue `#00C4FF` |
| **Regular** (`light` / `dark` / `system`, or any non-EVA skin) | `regular` | `--dsw-alias-state-business-primary` on **both** dots — the theme's own accent (DeepSeek blue under stock light/dark, a white-label accent if one is set) |

How the preference reaches a hidden marker:

- **`ctx.theme`, not a DOM probe.** The preference id exists nowhere in the DOM, so the plugin
  declares the `theme` service (`inject: ['slots', 'theme']`), and the seat entry's own
  `inject: () => ({ hooks: { theme: … } })` hands the component a `useTheme` selector hook —
  the exact channel `ui-settings-account` and `ui-sidebar-terminal` use to read the theme
  snapshot inside a slot. It subscribes to `theme/change`, so a switch repaints live.
- **CSS does the mapping.** `themeAttr()` maps `preference → eva-01 | eva-00 | regular`
  (`undefined`/absent → the base pair), the marker writes it as one attribute, and the sheet's
  two override rules re-ink `--muen-race-ink-a/b` on the card. The comet gradients, the glow
  stops and the freeze strip all read those two variables, so nothing else changes. No DOM
  writes to the card, no global override layer — the same marker + stylesheet shape as before.
- **A profile can still retune.** The theme map sits between the base declaration and a
  profile's own `--muen-race-ink-*` rules; a later sheet that re-declares the variables on
  `[data-composer-card]` wins over both.

`package.json` adds `@deepseek-ai/dsh-client-ui-theme` to `dsh.client.inject` so the bundle
graph loads the theme provider before this one; on a host with no theme service the entry
registers without an inject face and the base pair renders (the verify suite covers that).

The blur is EVA's glow language rather than a new one. DESIGN.md documents the dark halo as
1px + 16px + 48px of `rgba(118,88,152,{0.4,0.3,0.25})`, so each dot carries a three-stop
`drop-shadow` bloom at those alphas (tightened to 4/16/32px for a 2.5px ring) plus a half-pixel
blur. This sheet has no other shadow.

Motion follows DESIGN.md "Motion" — calm and short, standard easing only, no overshoot: a linear
lap, no bounce into the finish.

Every number is one variable on `[data-composer-card]`, so a profile retunes it without forking:

| Variable | Default | What it does |
|---|---|---|
| `--muen-race-ink-a` | `var(--primary,#765898)` | the leader dot — EVA Dark purple as shipped; the theme map may re-ink it |
| `--muen-race-ink-b` | `var(--secondary,#52d053)` | the slower dot — EVA Dark green as shipped; the theme map may re-ink it |
| `--muen-race-ring` | `2.5px` | ring thickness |
| `--muen-race-duration` | `3.2s` | the cycle, which is green's lap. Purple's 1.98s lap is a share of it |

**One number is baked:** purple's 62% crossing point, in `@keyframes muen-race-lead`. CSS cannot
take a `var()` in a keyframe selector, so changing how far ahead purple gets means editing that
percentage — and the comment in `lib/client.js` names both places. One cycle variable and one
keyframe timeline is what keeps the two dots from drifting out of sync and restarting out of step.

**DESIGN.md Resolved #2, said out loud:** `--secondary` is identity, and a *status* reading of
"running" is `--success`. This is a brand gesture, not a status readout, so the EVA pairing is
the default — but a profile that wants it read as status sets both inks to `var(--success)`.

`prefers-reduced-motion: reduce` stops the race but keeps both dots visible, parked apart (the
leader on the line, green half a turn on) — the border still reads as active, and the
"instant / opacity-only" fallback that rule names is honoured. `@property --muen-race-angle`
drives the conic angle: supported by the Electron Chromium this app ships (the engine that also
supports the `:has()` the harness relies on), and where it is not, the sheet degrades to a static
comet rather than breaking.

## Install

```sh
dsh plugin --profile mitsu add "/Volumes/External SSD/mitsu/plugins/dsh-composer-race"
```

Then **restart the app**: adding a bundle row is a host-side change. After that, client edits
to this bundle are live on reload (the modules registry re-reads a `link:`ed bundle's file and
recomposes a new rev).

## Verify

```sh
node verify/race.mjs           # 56 checks, offline
node verify/race.mjs --show    # print the injected stylesheet
node scripts/check-plugin-suites.mjs --plugin dsh-composer-race --all   # from the workspace root
```

## Look at it without installing

```sh
node preview.mjs                       # writes /tmp/dsh-composer-race-preview.html
                                       #   and prints the serve + open lines below
cd /tmp && python3 -m http.server 8899 --bind 127.0.0.1
open http://127.0.0.1:8899/dsh-composer-race-preview.html
```

⚠️ **Serve the directory the file was written to.** `preview.mjs` prints the `serve` and `open`
lines together for exactly this reason: the server root and the requested file name have to name
the same directory, and a server rooted anywhere else answers 404 for it while looking perfectly
healthy. That is what happened on 2026-09-27 — a server rooted at `/tmp/race-preview` was asked
for `/dsh-composer-race-preview.html`.

The preview harvests the stylesheet out of `lib/client.js`, so it cannot drift from the plugin,
and the mock markup reproduces the two facts the sheet depends on — a `[data-composer-card]` box
with a hidden `[data-muen-race="on"]` marker inside it. Because a race cannot be judged from one
still, the page also renders **the same race frozen at 0 / 31 / 62 / 90%**, with each dot's angle
computed from the sheet's own cycle length and crossing point — that strip is the part to review —
plus **one row per theme** (EVA Dark / EVA Light / Regular) at the 62% crossing, each marker
carrying the attribute the app would write, so the theme pair can be judged too. The small dot
inside each mock card is the composer's own pending indicator, not the race; the race is the
light on the border.

## Status

**Design accepted** (2026-09-26 review); the theme alignment landed the same day — EVA Dark /
EVA Light / Regular now pick the pair through `[data-muen-race-theme]` (see "Theme alignment"
above). Built as a dev bundle in the product workspace; not yet installed in a profile. It is a
generic capability with no client identity, so its canonical home is `muen-plugins` as
`@muen/dsh-composer-race` — promote it by normalizing to that repo's layout and retiring this
copy.
