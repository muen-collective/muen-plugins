# fast-context

Pre-send workspace retrieval. One background Explore agent per new session, started the moment the
session opens and before you type. Its evidence pack is prepended to the model's first step, and a
card above the composer shows the run.

| | |
|---|---|
| **the card** | `conversation.input.dock` — `Explore · Fast Context retrieval · Running · 0:05 · Open ›`, with `Agent`, `Model` and the `Pre-Send` phase beneath it |
| **the retrieval** | `agent/created` (`source: 'startup'`) → one `spawn` child with `toolFilter: {allow: [read, grep, glob]}`, its own persona, and a JSON `outputSchema` |
| **the payload** | `agent/pre-step` (turn 1, step 1) — the pack enters as a plugin user message with `form: 'snapshot'`, so the transcript renders it as a native context row |

## Why it exists

`@muen/dsh-context-watchdog` pushes you out of a long session: `[ New session ]` appears once the
session passes `max(25K, min(35% × window, 300K))`. Good for cost, bad for warmth — the new session
knows nothing about the repo, so the first turn goes on `glob`/`grep`/`read` instead of the task.

This closes the loop:

```
watchdog:  long session  →  [ New session ]     cost
this:      blank session →  context in ~10s      warmth
```

## What the user sees

| Moment | Card |
|---|---|
| Session opens on a workspace | `Running`, elapsed timer ticking |
| ~10s later | `Ready in 11s`, then it retires after 8s |
| First message sent | Pack is prepended; the transcript shows one context row |
| Sent before the pack is ready | The step waits up to `waitMs` (8s), then proceeds without it |
| Run failed, timed out, empty workspace | Nothing. No card, no spinner, no error in the composer. |

Silence is the default. A broken retrieval is invisible; only a working one is visible.

## Install / remove

```
plugin_manager install_bundle "/Users/thuypham/muen-plugins/plugins/dsh-fast-context"
plugin_manager remove_bundle  @muen/dsh-fast-context
```

**A client-bundle edit needs an app restart, not a page reload.** The host serves a client bundle
from an in-memory copy captured at activation, so a `link:`-installed plugin's edits do not reach the
page until the app restarts (measured 2026-09-19).

## How the two halves talk

They do not. There is no custom remote, no HTTP route, no shared storage.

- **The card reads run state from the subagent catalog that already exists** —
  `useSessions(s => s.subagentsByParent[sessionId])`, the same projection the shipped subagent header
  uses. It finds its run by `label === 'Fast Context retrieval'`.
- **The card's one obligation** is opening that catalog for its session
  (`sessions.setSubagentCatalogOpen(id, true)`): the client only keeps a parent's catalog live while
  something observes it, and on a blank session nothing else does. It closes on unmount.
- **`Open`** goes through `uiWorkspace.openSession({parentSessionId, childSessionId, mode})`, the same
  address the shipped subagent catalog uses.

`ctx.remote.*` namespaces are a **fixed application selection** (`dsh-api-remotes` mounts a closed
list), so a plugin cannot add one. That is why there is no `Stop` yet: `run.dispose()` is a host
handle. Stop needs the fenced HTTP route that `@muen/dsh-theme-runtime` already demonstrates
(`ctx.webServer.register`, trust-checked), and it ships in v1.1.

## Budgets

| Budget | Default | Config key |
|---|---|---|
| Child wall clock, then `run.dispose()` | 90s | `timeoutMs` |
| First step waits for the pack | 8000 ms | `waitMs` |
| Rendered pack ceiling | 12 000 chars | `maxPackChars` |
| Concurrent retrievals, process-wide | 2 | `maxConcurrent` |
| Pack cache TTL, per workspace | 20 min | `cacheTtlMs` |
| Blank-session debounce before a run starts | 400 ms | `debounceMs` |
| Child route | inherits the session's | `provider`, `model`, `reasoningEffort` |

Row config goes on the bundle's patch entry:

```yaml
- insert:
    - id: fast-context
      name: '@muen/dsh-fast-context'
      config:
        waitMs: 4000
        debug: false
```

`debug` defaults to `true` right now and prints one line per run to the app log. Flip it to `false`
once the card is the signal you trust.

## Cache

The pack describes the workspace, not the session. Keyed by `cwd`, stamped with the mtimes of
`AGENTS.md` and `package.json`, reused for 20 minutes. The second new session in the same workspace
is instant — which is exactly the case the watchdog creates. In-memory only: the watchdog's
`New session` runs in the same process, so nothing needs to survive a restart.

## Languages

All seven ship inside this plugin: `en`, `zh`, `ko`, `ja`, `fr`, `de`, `es`, registered through
`locale.register(ns, locale, dict)`. `en` and `zh` are the harness's built-in ids; the other five use
the same single-locale form the language packs use, so they resolve whenever a carrier has added the
language and are inert otherwise. `@muen/dsh-muen-locales` needs **no** entry for `fast-context`.

## Deliberately not done

- **Stop.** Needs the fenced route (v1.1), see above.
- **Preview.** Wants a surface that does not exist yet. `Open` covers the same need for now.
- **A Settings row.** `enabled` is config-only. The plan's escape hatch is `config.enabled: false`.
- **The on-demand `fast_context(query)` tool.** The model-callable half of the original scope; not
  part of this slice.
- **A per-model route knob.** `provider`, `model` and `reasoningEffort` are honoured when set in
  config, and all three are empty by default so the child **inherits the session's route**. Effort
  ids come from the host's per-model catalog, so hardcoding one would be a start-time failure on any
  route that does not offer it.
- **`bash` in the child.** A read-only filter only. A bash call would raise an approval prompt in the
  middle of pre-send, which is worse than a thinner pack.

## Verified / not verified

| Check | Result |
|---|---|
| Syntax (`node --check`) | ✅ both halves |
| Host half loads and exports `{name, inject, apply}` | ✅ `name: fast-context` |
| `cordis.patch.yml` | ✅ single-document top-level array, one `insert` row (parsed with the profile's own js-yaml) |
| Pack rendering, `extractPack`, trimming | ✅ 10/10 — `07-tests`-style unit tests in `~/muen-plugins/tests/fast-context-pack.test.mjs` |
| Bundle installs and the composition survives | ✅ profile dependency `link:/Users/thuypham/muen-plugins/plugins/dsh-fast-context`, bundle last in `dsh.profile.bundles` |
| Host half mounts live | ✅ `plugin_manager list_plugins` → `include:fast-context`, `fiberPhase: active` |
| Client half loads without a restart | ✅ `conversation.input.dock` occupants gained `fast-context` at order 40, `active` |
| **The trigger, in the running app** | ✅ Observed in `~/Library/Application Support/Mitsumeru/logs/harness-*.log`: opening a session in the GUI produced `[fast-context] new session { session: 'session-37ae92f9…', cwd: '/Volumes/External SSD/mitsu' }` — `agent/created` with `source: 'startup'`, correct cwd, **before any message was sent** |
| The retrieval run, the injected pack, the card's pixels | ⚠️ **unverified** — see the restart note below |
| Trigger is pre-send, statically | ✅ `session.create` → `ensureSession` → `createOrAdopt` creates the Session *and* the Agent in one call (`dsh-api-session-controller/lib/index.js:573-590`, `:410-457`), and `sessions.announce` (`dsh-agent-loop/lib/index.js:1719`) precedes `agents.announce` (`:1721`), so `agent.header.cwd` is populated when `agent/created` fires. Corroborated by six session logs on this machine that are a header and nothing else. |

### Editing this plugin needs an app restart

Measured 2026-09-20: `plugin_manager set_bundle` (disable, then enable) does **not** re-import a
linked plugin's module. A `mounted` log line added to `lib/index.js` did not appear after a full
off/on cycle, so the host keeps the first import for the life of the process. **Restart the app to
load any edit**, host half included.

The first install was different: a bundle the manager has never imported *is* imported live, which
is why the client half appeared in the slot tree and the host half went `active` without a restart.

## Known risks

| Risk | Mitigation |
|---|---|
| The client's `subagentsByParent` entry shape differs from the host's `SubagentListEntry` | The card degrades to rendering nothing. Verify in the running page before trusting the card. |
| The `Model` row says "this session's model" rather than naming it | The catalog does not carry the child's route. Naming it needs a projection that does not exist yet. |
| Every new session costs tokens, including abandoned ones | 400 ms debounce, per-workspace cache, `enabled: false` |
| The child asks for approval | `toolFilter` is `read`/`grep`/`glob` only |
| A hardcoded `reasoningEffort` would fail on some routes | Effort ids come from the host's per-model catalog. All three route keys are empty by default, so the child inherits the parent route; pinning one is opt-in config. |

`@muen/dsh-muen-locales` needs **no** entry for `fast-context`, and it also does not conflict: that
pack registers ko/ja/fr/de/es against the *other* Muen namespaces, and this plugin owns
`fast-context` outright.
