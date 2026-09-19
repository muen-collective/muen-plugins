/**
 * Rendered-output and behaviour tests for the context-watchdog banner.
 *
 * The threshold policy has its own test file; this one is about the surface the
 * reader acts on, which no amount of type-checking covers: the banner must
 * register above the composer (not in it), read `Context 504K of 1M (50%)`,
 * escalate its wording with the share, offer New session / Snooze / Dismiss, name
 * the band a snooze would buy, refuse to snooze past the quality cap, and call
 * the workspace service when the reader chooses a fresh session.
 *
 * It loads the real client bundle in a Node VM with a miniature React — element
 * tree plus real `useState` slots so a click re-renders — and walks that tree.
 * No browser, no DSH runtime.
 *
 * Run with:  node --test 07-tests/unit/
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CLIENT = path.join(HERE, "..", "plugins", "dsh-context-watchdog", "lib", "client.js");

/** A widget under test, plus the module state the bundle reached through `inject`. */
function createHarness({ withHostIcons = true, withStartSession = true } = {}) {
  const source = fs.readFileSync(CLIENT, "utf8");
  const captured = {};
  const registered = {};
  const injections = {};
  const dicts = {};
  const calls = { startSession: 0 };

  const hooks = { slots: [], cursor: 0, tree: null };
  const flat = (children) =>
    children.flat(Infinity).filter((child) => child !== null && child !== undefined && child !== false && child !== true);

  const createElement = (type, props, ...children) => ({ type, props: props ?? {}, children: flat(children) });

  let render = () => {};
  const React = {
    createElement,
    useState(initial) {
      const index = hooks.cursor++;
      if (hooks.slots[index] === undefined) hooks.slots[index] = typeof initial === "function" ? initial() : initial;
      return [
        hooks.slots[index],
        (value) => {
          hooks.slots[index] = typeof value === "function" ? value(hooks.slots[index]) : value;
          render();
        },
      ];
    },
    useSyncExternalStore: (_subscribe, getSnapshot) => getSnapshot(),
    useMemo: (fn) => fn(),
    useCallback: (fn) => fn(),
    useEffect: () => {},
    Fragment: "Fragment",
  };

  const stubIcon = (name) => function StubIcon() {
    return { type: name, props: {}, children: [] };
  };

  const requireStub = (name) => {
    if (name === "react") return React;
    if (name === "@deepseek-ai/dsh-client-ui-primitives") {
      if (!withHostIcons) throw new Error("module not in the browser module table");
      return {
        IconWarningOutline16: stubIcon("IconWarningOutline16"),
        IconCloseOutline16: stubIcon("IconCloseOutline16"),
      };
    }
    throw new Error(`unexpected require: ${name}`);
  };

  const sandbox = {
    window: {
      __ModuleLoader__: { load: (mod) => (captured.mod = mod) },
      localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
      setTimeout: () => 0,
      clearTimeout: () => {},
    },
    require: requireStub,
    console,
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);

  const mod = captured.mod.factory(requireStub);
  mod.apply({
    effect: (fn) => {
      fn();
      return () => {};
    },
    inject: (services, callback) => {
      if (withStartSession && services.includes("uiWorkspace")) {
        callback({
          uiWorkspace: { startSession: () => (calls.startSession += 1) },
          effect: (fn) => {
            fn();
            return () => {};
          },
        });
      }
      return () => {};
    },
    locale: {
      register: (_ns, locale, dict) => {
        dicts[locale] = dict;
        return () => {};
      },
      bind: () => (key, params) => {
        const template = dicts.en?.[key];
        if (template === undefined) return key;
        return template.replace(/\{(\w+)\}/g, (match, name) =>
          params?.[name] === undefined ? match : String(params[name]),
        );
      },
    },
    slots: {
      inject: (_key, callback) => {
        callback();
        return () => {};
      },
      register: (options, component) => {
        registered[options.name] = component;
        injections[options.name] = typeof options.inject === "function" ? options.inject() : {};
        return () => {};
      },
    },
  });

  const Component = registered["conversation.input.dock"];
  render = () => {
    hooks.cursor = 0;
    hooks.tree = Component === undefined ? null : normalize(Component(baseProps));
  };
  let baseProps = {};

  return {
    registered,
    injections,
    dicts,
    calls,
    mount(props) {
      baseProps = Object.assign({}, injections["conversation.input.dock"], props);
      hooks.slots = [];
      render();
      return this;
    },
    rerender: () => render(),
    get tree() {
      return hooks.tree;
    },
  };
}

/** Resolve a tree the way React would: invoke function components. */
function normalize(node) {
  if (node === null || node === undefined || typeof node === "boolean") return null;
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(normalize).filter((child) => child !== null);
  if (typeof node === "object") {
    if (typeof node.type === "function") return normalize(node.type(node.props));
    return { type: node.type, props: node.props ?? {}, children: (node.children ?? []).map(normalize).filter((c) => c !== null) };
  }
  return null;
}

function textOf(node) {
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (node && typeof node === "object") return textOf(node.children);
  return "";
}

function typesOf(node, found = []) {
  if (Array.isArray(node)) {
    node.forEach((child) => typesOf(child, found));
    return found;
  }
  if (node && typeof node === "object") {
    if (typeof node.type === "string" || typeof node.type === "function") found.push(node.type);
    typesOf(node.children, found);
  }
  return found;
}

/** Every element carrying a given `data-context-watchdog` marker. */
function byMarker(node, marker, found = []) {
  if (Array.isArray(node)) {
    node.forEach((child) => byMarker(child, marker, found));
    return found;
  }
  if (node && typeof node === "object") {
    if (node.props && node.props["data-context-watchdog"] === marker) found.push(node);
    byMarker(node.children, marker, found);
  }
  return found;
}

const HALF = { projectedTokens: 504000, pressureTokens: 500000, contextWindow: 1000000 };
const CRITICAL = { projectedTokens: 900000, contextWindow: 1000000 };

test("the banner registers above the composer, and no longer in it", () => {
  const harness = createHarness();
  assert.ok(typeof harness.registered["conversation.input.dock"] === "function", "banner seat");
  assert.equal(harness.registered["conversation.composer.dock"], undefined, "the chip seat is gone");
  assert.ok(typeof harness.registered["settings.general.item"] === "function", "policy row seat");
});

test("it reads Context 504K of 1M (50%) and escalates the wording", () => {
  const harness = createHarness().mount({ useProjection: () => HALF, sessionId: "s1" });
  const text = textOf(harness.tree);
  assert.match(text, /Context 504K of 1M \(50%\)/);
  assert.match(text, /Recommended/, "50% is the recommendation band");
  assert.doesNotMatch(text, /Compaction is likely/);
});

test("it offers the three choices and uses the app's own glyphs", () => {
  const harness = createHarness().mount({ useProjection: () => HALF, sessionId: "s2" });
  assert.equal(byMarker(harness.tree, "new-session").length, 1);
  assert.equal(byMarker(harness.tree, "snooze").length, 1);
  assert.equal(byMarker(harness.tree, "dismiss").length, 1);
  const types = typesOf(harness.tree);
  assert.ok(types.includes("IconWarningOutline16"));
  assert.ok(types.includes("IconCloseOutline16"));
});

test("with no host icon set it falls back to the inlined triangle", () => {
  const harness = createHarness({ withHostIcons: false }).mount({ useProjection: () => HALF, sessionId: "s3" });
  const types = typesOf(harness.tree);
  assert.ok(types.includes("svg"), "an inline svg carries the warning");
  assert.ok(!types.includes("IconWarningOutline16"));
});

test("New session calls the workspace service and clears the banner", () => {
  const harness = createHarness().mount({ useProjection: () => HALF, sessionId: "s4" });
  const [button] = byMarker(harness.tree, "new-session");
  button.props.onClick();
  assert.equal(harness.calls.startSession, 1, "the primary action is wired to uiWorkspace.startSession");
  harness.rerender();
  assert.equal(harness.tree, null, "choosing a fresh session stops the alert for this session");
});

test("the snooze menu names a band past where the reader already is, and taking it hides the banner", () => {
  const harness = createHarness().mount({ useProjection: () => HALF, sessionId: "s5" });
  byMarker(harness.tree, "snooze")[0].props.onClick();
  const [band] = byMarker(harness.tree, "snooze-band");
  // Trigger 300K, reader at 504K: the band is one 10% step past 504K, not 400K —
  // a snooze that lands behind the current usage would be void the moment it is taken.
  assert.match(textOf(band), /Until 604K/);
  assert.match(textOf(byMarker(harness.tree, "snooze-time")[0]), /20 minutes/);
  band.props.onClick();
  harness.rerender();
  assert.equal(harness.tree, null);
});

test("past the quality cap the band snooze is refused", () => {
  const harness = createHarness().mount({ useProjection: () => CRITICAL, sessionId: "s6" });
  assert.match(textOf(harness.tree), /Compaction is likely/);
  byMarker(harness.tree, "snooze")[0].props.onClick();
  const [band] = byMarker(harness.tree, "snooze-band");
  assert.equal(band.props.disabled, true, "85% and beyond cannot be snoozed away");
  assert.match(textOf(band), /cannot be snoozed/);
});

test("it stays silent below the threshold, without a window, and without the hook", () => {
  const below = { projectedTokens: 200000, contextWindow: 1000000 };
  assert.equal(createHarness().mount({ useProjection: () => below, sessionId: "s7" }).tree, null);
  const unknown = { projectedTokens: 504000 };
  assert.equal(createHarness().mount({ useProjection: () => unknown, sessionId: "s8" }).tree, null);
  assert.equal(createHarness().mount({ sessionId: "s9" }).tree, null);
});

test("the banner is centred and sized like the composer card", () => {
  const harness = createHarness().mount({ useProjection: () => HALF, sessionId: "s10" });
  const [banner] = byMarker(harness.tree, "banner");
  const style = banner.props.style;
  // The card's own cap …
  assert.equal(style.maxWidth, "var(--dsh-composer-card-max-width)");
  // … less the side clearance the card's wrapper pads by, so the two agree on a
  // narrow window as well as a wide one …
  assert.match(style.width, /calc\(100% - 2 \* var\(--dsh-composer-side-clearance\)\)/);
  // … and centred: a capped entry in a stretching stack otherwise sits at the
  // stack's start, which is exactly how this was misaligned once.
  assert.match(style.margin, /^0 auto/);
  assert.equal(style.boxSizing, "border-box");
});

test("both locales carry the banner copy", () => {
  const harness = createHarness();
  assert.equal(harness.dicts.en.title, "Context {used} of {window} ({percent}%)");
  assert.equal(harness.dicts.zh.newSession, "新会话");
  assert.match(harness.dicts.zh.snoozeBand, /\{tokens\}/);
});
