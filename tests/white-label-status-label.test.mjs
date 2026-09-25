/**
 * Behaviour tests for the white-label status label.
 *
 * WHAT IS AT RISK: the label replaces the harness's shipped run-status line
 * ("Deep diving...") by rewriting the one text node that row renders. That copy
 * lives in @deepseek-ai/dsh-client-ui-chat's own dictionary, and the client
 * locale service refuses a second registration for a (namespace, locale) pair,
 * so there is no seam to use instead — the patch is the feature.
 *
 * That makes three things worth pinning, and none of them are type-checkable:
 *
 *   1. the write happens on the shipped copy and lands on the right node;
 *   2. a status row that is NOT the shipped copy (another plugin's, or a string
 *      React re-rendered after we wrote) is left alone;
 *   3. clearing the label puts the shipped copy back and stops watching, so the
 *      feature costs nothing when a brand does not use it.
 *
 * The section under test is loaded as real source, sliced out of the shipped
 * bundle between its two section banners, with brandValue / document /
 * MutationObserver stubbed. A miniature DOM, not jsdom: the patch touches
 * firstChild.nodeValue and one attribute selector, and nothing else.
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
const HOST = path.join(HERE, "..", "plugins", "dsh-white-label", "lib", "index.js");
const ROW_SELECTOR = '[role="status"][aria-live="polite"]';
const SHIPPED_EN = "Deep diving...";
const SHIPPED_ZH = "\u6df1\u5ea6\u6c42\u7d22\u4e2d...";

// ── the miniature DOM ──────────────────────────────────────────────────────

class TextNode {
  constructor(value) {
    this.nodeType = 3;
    this.nodeValue = value;
    this.parentNode = null;
  }
}

class Element {
  constructor(tag, attrs = {}) {
    this.nodeType = 1;
    this.tagName = tag;
    this.attrs = attrs;
    this.childNodes = [];
    this.parentNode = null;
  }
  append(...nodes) {
    for (const node of nodes) {
      node.parentNode = this;
      this.childNodes.push(node);
    }
    return this;
  }
  get firstChild() {
    return this.childNodes[0] ?? null;
  }
  matches(selector) {
    return selector === ROW_SELECTOR && this.attrs.role === "status" && this.attrs["aria-live"] === "polite";
  }
  querySelectorAll(selector) {
    const found = [];
    const walk = (node) => {
      for (const child of node.childNodes) {
        if (child.nodeType !== 1) continue;
        if (child.matches(selector)) found.push(child);
        walk(child);
      }
    };
    walk(this);
    return found;
  }
}

/** A status row exactly as ui-chat renders one: text node, then the clock span. */
function statusRow(text) {
  const row = new Element("div", { role: "status", "aria-live": "polite" });
  row.append(new TextNode(text), new Element("span", {}).append(new TextNode("7s")));
  return row;
}

// ── the harness ────────────────────────────────────────────────────────────

function createHarness() {
  const source = fs.readFileSync(CLIENT, "utf8");
  const start = source.indexOf("// \u2500\u2500 status label:");
  const end = source.indexOf("// \u2500\u2500 locale \u2500");
  assert.ok(start > -1, "the status-label section carries its banner");
  assert.ok(end > start, "the status-label section ends at the locale banner");

  const body = new Element("body");
  const documentStub = {
    nodeType: 9,
    body,
    querySelectorAll: (selector) => body.querySelectorAll(selector),
  };

  const observers = [];
  class MutationObserverStub {
    constructor(callback) {
      this.callback = callback;
      this.observed = null;
      this.disconnected = 0;
      observers.push(this);
    }
    observe(target, options) {
      this.observed = { target, options };
    }
    disconnect() {
      this.disconnected += 1;
    }
    /** Deliver one record, the way a real observer would. */
    fire(record) {
      this.callback([record]);
    }
  }

  const context = vm.createContext({
    brandValue: { statusLabel: "" },
    STATUS_LABEL_FIELD: "statusLabel",
    document: documentStub,
    MutationObserver: MutationObserverStub,
    console,
  });
  vm.runInContext(
    source.slice(start, end) +
      "\nglobalThis.__statusLabel = { applyStatusLabel, syncStatusRow, syncStatusRows };\n",
    context,
  );

  return {
    api: context.__statusLabel,
    body,
    observers,
    setLabel(value) {
      context.brandValue = { statusLabel: value };
    },
  };
}

// ── tests ──────────────────────────────────────────────────────────────────

test("replaces the shipped copy in the run-status row", () => {
  const harness = createHarness();
  const row = statusRow(SHIPPED_EN);
  harness.body.append(row);
  harness.setLabel("Muen is at work\u2026");

  harness.api.applyStatusLabel();

  assert.equal(row.firstChild.nodeValue, "Muen is at work\u2026");
  // The clock span is a sibling and is untouched.
  assert.equal(row.childNodes[1].firstChild.nodeValue, "7s");
});

test("replaces the shipped Simplified-Chinese copy too", () => {
  const harness = createHarness();
  const row = statusRow(SHIPPED_ZH);
  harness.body.append(row);
  harness.setLabel("Muen is at work\u2026");

  harness.api.applyStatusLabel();

  assert.equal(row.firstChild.nodeValue, "Muen is at work\u2026");
});

test("leaves a status row that is not the shipped copy alone", () => {
  const harness = createHarness();
  const row = statusRow("Thinking\u2026");
  harness.body.append(row);
  harness.setLabel("Muen is at work\u2026");

  harness.api.applyStatusLabel();

  assert.equal(row.firstChild.nodeValue, "Thinking\u2026");
});

test("clearing the label restores the shipped copy and stops watching", () => {
  const harness = createHarness();
  const row = statusRow(SHIPPED_EN);
  harness.body.append(row);

  harness.setLabel("Muen is at work\u2026");
  harness.api.applyStatusLabel();
  assert.equal(row.firstChild.nodeValue, "Muen is at work\u2026");
  assert.equal(harness.observers.length, 1, "a label installs one observer");

  harness.setLabel("");
  harness.api.applyStatusLabel();

  assert.equal(row.firstChild.nodeValue, SHIPPED_EN);
  assert.equal(harness.observers[0].disconnected, 1);

  // Standing down means standing down: with no label, a later row is not touched.
  const later = statusRow(SHIPPED_EN);
  harness.body.append(later);
  harness.api.applyStatusLabel();
  assert.equal(later.firstChild.nodeValue, SHIPPED_EN);
  assert.equal(harness.observers.length, 1, "no observer is installed without a label");
});

test("a changed label rewrites a row that already carries the old one", () => {
  const harness = createHarness();
  const row = statusRow(SHIPPED_EN);
  harness.body.append(row);

  harness.setLabel("Muen is at work\u2026");
  harness.api.applyStatusLabel();
  harness.setLabel("Muen is in the workshop\u2026");
  harness.api.applyStatusLabel();

  assert.equal(row.firstChild.nodeValue, "Muen is in the workshop\u2026");
});

test("the observer patches a row that mounts mid-turn, and is idempotent", () => {
  const harness = createHarness();
  harness.setLabel("Muen is at work\u2026");
  harness.api.applyStatusLabel();
  const observer = harness.observers[0];
  assert.ok(observer.observed, "the observer watches the document");
  assert.equal(observer.observed.options.subtree, true);

  const row = statusRow(SHIPPED_EN);
  harness.body.append(row);
  observer.fire({ type: "childList", addedNodes: [row] });

  assert.equal(row.firstChild.nodeValue, "Muen is at work\u2026");

  // The write is a mutation of its own; feeding it back must not write again.
  let writes = 0;
  let value = row.firstChild.nodeValue;
  Object.defineProperty(row.firstChild, "nodeValue", {
    get: () => value,
    set: (next) => { writes += 1; value = next; },
  });
  observer.fire({ type: "characterData", target: row.firstChild });
  assert.equal(writes, 0, "an already-correct row is not rewritten");
  assert.equal(row.firstChild.nodeValue, "Muen is at work\u2026");
});

test("locale keys and the Host schema carry the field", () => {
  const source = fs.readFileSync(CLIENT, "utf8");
  // Both shipped languages must name the row, or it renders raw keys. The two
  // dictionaries must also stay in step: a key added to en alone renders English
  // in a Chinese UI, which reads as a broken plugin.
  const dictStart = source.indexOf("const DICT = {");
  const dictEnd = source.indexOf("function activeLang()");
  assert.ok(dictStart > -1 && dictEnd > dictStart, "the dictionary is present in the bundle");
  const context = vm.createContext({});
  vm.runInContext(source.slice(dictStart, dictEnd) + "\nglobalThis.__DICT = DICT;\n", context);
  const dict = context.__DICT;
  for (const key of ["upload.statusLabel", "upload.statusLabelPlaceholder", "upload.statusLabelHint"]) {
    assert.ok(dict.en[key], `en has ${key}`);
    assert.ok(dict.zh[key], `zh has ${key}`);
  }
  assert.deepEqual(
    Object.keys(dict.zh).sort(),
    Object.keys(dict.en).sort(),
    "en and zh carry the same key set",
  );

  // The value is only durable if the HOST declares it: the settings scope
  // resolves namespaces the Host declares, and a field the schema does not
  // declare is dropped rather than stored.
  //
  // The declaration that matters on a 0.1.7+ core is the entry's volatile Config,
  // not BRAND_SETTINGS_SCHEMA — the latter is the 0.1.6 register path. Both must
  // carry the field, so assert the volatile one specifically.
  const host = fs.readFileSync(HOST, "utf8");
  assert.match(host, /statusLabel: z\.string\(\)[^\n]*\.volatile\(\)/, "the Host volatile Config declares statusLabel");
  assert.match(host, /^\s*statusLabel: '',$/m, "the Host base document declares statusLabel");
});

test("the durable namespace is the entry id, not the 0.1.6 name", () => {
  // The regression that lost the brand. On 0.1.7+ the settings service has no
  // `register`, so a namespace named by the plugin is one nothing serves; a
  // plugin's namespace is its PROFILE ENTRY ID. Asking for the wrong one is
  // SILENT: the form reports `status: 'unavailable'`, nothing logs, and the brand
  // falls back to the localStorage mirror a restart wipes.
  const client = fs.readFileSync(CLIENT, "utf8");
  const host = fs.readFileSync(HOST, "utf8");

  assert.match(client, /const BRAND_SCOPE_ENTRY = "white-label"/, "the client names the entry id");
  assert.match(client, /const BRAND_SCOPE_NAMESPACE = "white-label-brand"/, "and keeps the legacy name for a 0.1.6 core");
  assert.match(client, /legacy \? BRAND_SCOPE_NAMESPACE : BRAND_SCOPE_ENTRY/, "and picks by generation rather than always the legacy name");

  // The id the client asks for must be the id the patch layer mounts. The rows
  // here are list items under `insert:`, so the marker is part of the line.
  const patchPath = path.join(HERE, "..", "plugins", "dsh-white-label", "cordis.patch.yml");
  const ids = [...fs.readFileSync(patchPath, "utf8").matchAll(/^\s*(?:-\s+)?id:\s*(\S+)\s*$/gm)].map((m) => m[1]);
  assert.ok(ids.includes("white-label"), `cordis.patch.yml mounts white-label (found ${ids.join(", ")})`);

  // A core without `register` must not be allowed to throw at it: the throw was
  // swallowed into the catch that existed for a taken namespace, which is why
  // this stayed invisible.
  assert.match(host, /typeof settingsCtx\.settings\?\.register === 'function'/, "the 0.1.6 register call is capability-guarded");
});

test("the accent is durable through the same document as the brand", () => {
  // The accent was reset by the same mechanism. Leaving it in localStorage only
  // would reproduce the loss for anyone who picked a colour.
  const host = fs.readFileSync(HOST, "utf8");
  const client = fs.readFileSync(CLIENT, "utf8");
  for (const field of ["accentLight", "accentDark"]) {
    assert.match(host, new RegExp(`${field}: z\\.string\\(\\)[^\\n]*\\.volatile\\(\\)`), `the volatile Config declares ${field}`);
  }
  assert.match(client, /setAccent:[\s\S]*?persistBrand\(/, "setAccent writes through to the durable document");
  assert.match(client, /clearAccent:[\s\S]*?persistBrand\(/, "clearAccent writes through to the durable document");
  // The mirror still decides when the durable scope has no opinion, which is the
  // only path on a core whose settings service is absent.
  assert.match(client, /accentStorage\.read\(\)\[key\]/, "the localStorage mirror remains the fallback");
});
