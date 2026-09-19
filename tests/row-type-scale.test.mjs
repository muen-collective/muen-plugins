/**
 * Row type-scale contract for the two plugins that render a row into the
 * conversation flow.
 *
 * The harness publishes one convention for these rows, in
 * `@deepseek-ai/dsh-client-ui-primitives/lib/DisclosureRow.module.css`:
 *
 *     [16px leading] gap 6 [title 13/24] at the default size
 *     title size follows the secondary tier (--dsh-content-font-size-secondary:
 *     one step under the body …), and the row height, leading box, and glyph
 *     edge shift by the body px delta so the icon keeps its optical share of
 *     the line.
 *
 * A plugin row that takes the BODY tier instead (`--dsh-content-font-size`,
 * 14px by default) renders one step larger than every native row around it —
 * measured 2026-09-18: codex-fold's summary chip did exactly that, because it
 * sets `font: inherit` inline on a button inside the conversation body, and the
 * inline declaration beats the stylesheet. The fix is two-sided (inline size +
 * stylesheet), so both sides are pinned here; sized and shaded differently from
 * a native row, a folded summary reads as a rendering bug rather than a fold.
 *
 * These are source-contract assertions, not renders: the chip is built by a
 * DOM-observing fold pipeline, so a VM render would test the harness rather than
 * this contract. Run with:  node --test tests/
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const read = (plugin) =>
  fs.readFileSync(path.join(HERE, "..", "plugins", plugin, "lib", "client.js"), "utf8");

const BODY_TIER = "var(--dsh-content-font-size,";
const ROW_TIER = "var(--dsh-content-font-size-secondary, 13px)";
const DELTA = "var(--dsh-content-font-delta, 0px)";

test("the codex-fold chip takes the row tier, not the body tier", () => {
  const source = read("dsh-codex-fold");

  // Inline: this is the declaration that actually wins inside the conversation.
  assert.ok(
    source.includes(`button.style.fontSize = "${ROW_TIER}";`),
    "the chip must set its size inline — `font: inherit` alone takes the body size",
  );
  // Stylesheet: kept in agreement so either side alone still reads correctly.
  assert.ok(
    source.includes(`font: 400 ${ROW_TIER}/24px`),
    "the .dshcf-group stylesheet must also declare the row tier",
  );
  assert.equal(
    source.includes(`font: 400 ${BODY_TIER} 14px)/24px`),
    false,
    "the chip must not regress to the body tier",
  );
});

test("the codex-fold chip's metrics follow the body delta like a native row", () => {
  const source = read("dsh-codex-fold");
  const deltaMetrics = source.split(`calc(24px + ${DELTA})`).length - 1;

  assert.ok(
    deltaMetrics >= 3,
    `row height and line height must shift with the body delta (found ${deltaMetrics} of 3)`,
  );
  for (const box of ["16px", "14px", "12px"]) {
    assert.ok(
      source.includes(`calc(${box} + ${DELTA})`),
      `the ${box} leading/glyph box must shift with the body delta`,
    );
  }
});

test("the codex-fold chip is told apart by colour, not size", () => {
  const source = read("dsh-codex-fold");

  assert.ok(
    source.includes('detail.style.color = "var(--dsw-alias-label-caption'),
    "the chip's detail belongs on the caption tier",
  );
  assert.ok(
    source.includes("color: var(--dsw-alias-label-tertiary"),
    "the chip's label stays on the tertiary tier, one step under a native title",
  );
});

test("the turn-summary row must outrank the harness's own turn-process row", () => {
  const source = read("dsh-turn-summary");

  // A keyed slot refuses a same-priority duplicate instead of replacing it, so
  // without an explicit lower priority this plugin registers nothing at all —
  // silently, because the refusal is a console line and the host's own row
  // renders in its place. dsh-client-ui-slots: "lowest renders".
  assert.ok(
    source.includes("key: 'turn-process',") && source.includes("priority: -1,"),
    "the turn-process registration must shadow the host row with priority -1",
  );
});

test("the turn-summary row sits on the same grid", () => {
  const source = read("dsh-turn-summary");

  assert.ok(
    source.includes(`fontSize: '${ROW_TIER}'`),
    "the turn row must use the row tier",
  );
  assert.ok(
    source.includes(`lineHeight: 'calc(24px + ${DELTA})'`),
    "the turn row must share the native row height, delta included",
  );
  assert.equal(
    source.includes(BODY_TIER),
    false,
    "the turn row must not use the body tier",
  );
});
