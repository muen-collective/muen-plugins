/**
 * Contract tests for the context-watchdog threshold policy.
 *
 * The policy is pure arithmetic, but it is load-bearing arithmetic: it decides
 * when a long session is told to start a new one, and the same defaults have to
 * behave across models with wildly different windows. A fixed count cannot do
 * that (300K never fires on a 128K model), and a bare percentage cannot either
 * (35% of a 32K window is 11K). So the rule is
 *
 *     auto :  max(FLOOR, min(percent% x contextWindow, CEILING))
 *
 * and these tests pin both bounds and the silent cases.
 *
 * The helpers live inside the client bundle's factory, so this lifts the policy
 * block out of client.js and exercises it directly — no DSH runtime, no browser.
 * The extraction boundaries are asserted, so renaming them fails here rather
 * than quietly testing nothing.
 *
 * Run with:  node --test 07-tests/unit/
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CLIENT = path.join(HERE, "..", "plugins", "dsh-context-watchdog", "lib", "client.js");

const START_MARKER = "const DEFAULTS = {";
const END_MARKER = "/** Dismissed alerts and snoozes";

function loadPolicy() {
  const source = fs.readFileSync(CLIENT, "utf8");
  const from = source.indexOf(START_MARKER);
  const to = source.indexOf(END_MARKER);
  assert.ok(from >= 0, `policy start marker missing from client.js: ${START_MARKER}`);
  assert.ok(to > from, `policy end marker missing from client.js: ${END_MARKER}`);
  const block = source.slice(from, to);
  const factory = new Function(
    "window",
    `${block}\nreturn { thresholdFor, normalize, formatTokens, DEFAULTS, LIMITS };`,
  );
  const sandbox = {
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  };
  return factory(sandbox);
}

const policy = loadPolicy();
const DEFAULTS = policy.DEFAULTS;

/** A stored policy document with the fields a test cares about overridden. */
function withPolicy(overrides) {
  return { ...DEFAULTS, ...overrides };
}

test("auto mode bounds the threshold between the floor and the ceiling", () => {
  // The ceiling binds on a large window: this is the pre-policy default, kept.
  assert.equal(policy.thresholdFor(DEFAULTS, 1000000), 300000, "1M window must still fire at 300K");
  // The percentage binds below it, so a small window is still served.
  assert.equal(policy.thresholdFor(DEFAULTS, 200000), 70000);
  assert.equal(policy.thresholdFor(DEFAULTS, 131072), 45875);
  // The floor binds when the percentage would nag absurdly early.
  assert.equal(policy.thresholdFor(DEFAULTS, 32768), 25000);
});

test("a window too small for the policy stays silent", () => {
  assert.equal(policy.thresholdFor(DEFAULTS, 8192), undefined);
  assert.equal(policy.thresholdFor(DEFAULTS, 25000), undefined, "threshold equal to the window is not a nudge");
});

test("an unknown window stays silent", () => {
  assert.equal(policy.thresholdFor(DEFAULTS, undefined), undefined);
  assert.equal(policy.thresholdFor(DEFAULTS, 0), undefined);
  assert.equal(policy.thresholdFor(DEFAULTS, Number.NaN), undefined);
});

test("percentage and ceiling interact predictably", () => {
  assert.equal(policy.thresholdFor(withPolicy({ percent: 25 }), 1000000), 250000, "below the ceiling, the percentage wins");
  assert.equal(policy.thresholdFor(withPolicy({ percent: 50 }), 1000000), 300000, "above the ceiling, the wall wins");
  assert.equal(policy.thresholdFor(withPolicy({ ceiling: 100000 }), 1000000), 100000);
});

test("fixed mode ignores the window, except when it cannot fire", () => {
  const fixed = withPolicy({ mode: "fixed", fixed: 150000 });
  assert.equal(policy.thresholdFor(fixed, 1000000), 150000);
  assert.equal(policy.thresholdFor(fixed, 150000), undefined, "a threshold at the window size can never fire");
  assert.equal(policy.thresholdFor(fixed, 131072), undefined);
});

test("stored values are clamped into the schema's limits", () => {
  assert.equal(policy.normalize({ percent: 999 }).percent, policy.LIMITS.percent[1]);
  assert.equal(policy.normalize({ percent: -5 }).percent, policy.LIMITS.percent[0]);
  assert.equal(policy.normalize({ ceiling: "abc" }).ceiling, DEFAULTS.ceiling, "a non-number falls back to the default");
  assert.equal(policy.normalize({ mode: "nonsense" }).mode, "auto");
  assert.equal(policy.normalize(null).percent, DEFAULTS.percent, "a null document normalizes to the defaults");
});

test("a stored fixed-mode document survives normalization", () => {
  // This is the shape the legacy bare-number key migrates into.
  assert.deepEqual(policy.normalize({ mode: "fixed", fixed: 250000 }), {
    mode: "fixed",
    percent: DEFAULTS.percent,
    ceiling: DEFAULTS.ceiling,
    floor: DEFAULTS.floor,
    fixed: 250000,
  });
});

test("token figures are compact and monotonic", () => {
  assert.equal(policy.formatTokens(800), "800");
  assert.equal(policy.formatTokens(312000), "312K");
  assert.equal(policy.formatTokens(1000000), "1M");
  assert.equal(policy.formatTokens(-1), null);
});
