/**
 * Behaviour tests for the white-label plugin's string lookup.
 *
 * WHAT IS AT RISK: the plugin's own DICT holds exactly `en` and `zh`, because
 * those are the harness's only built-in locale ids. Every other language comes
 * from a language pack (@muen/dsh-muen-locales registers ko/ja/fr/de/es for
 * `settings.white-label`; the dsh-multi-lang-ui carrier wraps `locale.translate`
 * for its own). A pack can only reach this plugin through the locale service, so
 * a `translate()` that answers from a local table instead — or from
 * `documentElement.lang` — makes the Brand page ignore the language picker
 * entirely. That is the bug this file pins shut (measured 2026-09-20: the page
 * rendered English, and Chinese whenever `documentElement.lang` still read `zh*`,
 * while the pack held all 44 keys in five languages).
 *
 * The lookup section is loaded as real source, sliced out of the shipped bundle
 * between its two banners, with a `document` stub.
 *
 * Run with:  node --test tests/*.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CLIENT = path.join(HERE, "..", "plugins", "dsh-white-label", "lib", "client.js");

/** Load the locale section, with `documentElement.lang` under our control. */
function createHarness(lang) {
  const source = fs.readFileSync(CLIENT, "utf8");
  const start = source.indexOf("// \u2500\u2500 locale \u2500");
  const end = source.indexOf("// Written from inside apply(), never at module scope.");
  assert.ok(start > -1, "the locale section carries its banner");
  assert.ok(end > start, "the locale section ends before the marker");

  const documentStub = { documentElement: { lang } };
  const context = vm.createContext({ document: documentStub, console });

  // WL_TRANSLATE is a script-lexical binding, so only code appended to the same
  // script can reach it — which is exactly the seam apply() uses.
  vm.runInContext(
    source.slice(start, end) +
      "\nglobalThis.__locale = { translate, bind(fn) { WL_TRANSLATE = fn } };\n",
    context,
  );

  return { api: context.__locale, documentStub };
}

test("falls back to the local table before a locale service is bound", () => {
  const zh = createHarness("zh");
  assert.equal(zh.api.translate("accent.title"), "\u5f3a\u8c03\u8272");
  assert.equal(zh.api.translate("mode.dark"), "\u6df1\u8272");

  const en = createHarness("en");
  assert.equal(en.api.translate("accent.title"), "Accent");
});

test("a bound locale service wins over documentElement.lang", () => {
  const harness = createHarness("zh");
  // What the service returns for ko once the pack's dictionary is registered.
  harness.api.bind((key) => (key === "accent.title" ? "\uac15\uc870 \uc0c9" : key));

  assert.equal(harness.api.translate("accent.title"), "\uac15\uc870 \uc0c9");
});

test("a key the service does not know still resolves from the local table", () => {
  const harness = createHarness("zh");
  harness.api.bind((key) => key);

  assert.equal(harness.api.translate("mode.dark"), "\u6df1\u8272");
});

test("a language switch is read at call time, not captured at bind time", () => {
  const harness = createHarness("en");
  let active = "en";
  harness.api.bind((key) => (active === "ja" ? "\u30a2\u30af\u30bb\u30f3\u30c8" : key));

  assert.equal(harness.api.translate("accent.title"), "Accent");
  active = "ja";
  assert.equal(harness.api.translate("accent.title"), "\u30a2\u30af\u30bb\u30f3\u30c8");
});
