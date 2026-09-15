// @muen/dsh-muen-plugins — browser half.
// Registers the Settings → Plugins "Muen plugins" tab (replaces the community
// "Plugin market" tab) and renders the Muen catalog: card 1 = "Muen Plugin"
// (the delivery mechanism), then the delivered Muen plugins. Each card shows a
// greyed / disabled switch (delivered, not user-toggleable in this version)
// plus a short description and the delivery-mechanism blurb.
window.__ModuleLoader__.load({
  id: "@muen/dsh-muen-plugins",
  factory: (require) => {
    const React = require("react");
    const h = React.createElement;

    const NS = "muen-plugins";

    const DICT = {
      en: {
        title: "Muen Plugins",
        intro:
          "Muen plugins are curated, tested, and delivered to this Mitsumeru install through the built-in update mechanism. They ship enabled. Some plugins can also be installed by hand — those survive app updates and appear here alongside the delivered set.",
        mech: "Muen Plugin",
        mechDesc: "Delivers & updates the Muen plugin set to this install.",
        delivered: "Delivered",
        tooltip: "Delivered — managed by Muen (not user-toggleable in this version)",
        handInstalled: "Installed",
        handTooltip: "Installed — survives app updates (user-installed plugin)",
        catalog: "Catalog",
      },
      zh: {
        title: "Muen 插件",
        intro:
          "Muen 插件经筛选、测试后通过内置更新机制交付到本 Mitsumeru 安装。它们默认启用。部分插件也可手动安装——手动安装的插件会在更新后保留，并与交付的插件一起显示在此处。",
        mech: "Muen Plugin",
        mechDesc: "向本安装交付并更新 Muen 插件集。",
        delivered: "已交付",
        tooltip: "已交付 — 由 Muen 管理（此版本不可由用户切换）",
        handInstalled: "已安装",
        handTooltip: "已安装 — 更新后保留（用户手动安装的插件）",
        catalog: "目录",
      },
    };

    // Muen catalog. Card 1 = "Muen Plugin" (delivery mechanism); then the set.
    // Plugins with `installed: true` are hand-installed (survive updates),
    // not bundled by the app. The switch shows a different tooltip for those.
    const MUEN_PLUGINS = [
      { id: "muen-plugins", name: "mech", desc: "mechDesc", mech: true },
      { id: "dsh-white-label", name: "White label", desc: "Appearance plugin — per-mode accent colour + brand icon/logo swap. Reads brand files from the profile's brand folder. Survives app updates.", installed: true },
      { id: "dsh-brand-mitsumeru", name: "Mitsumeru brand", desc: "Default Mitsumeru wordmark + cyan-blue dot (the product mark)." },
      { id: "dsh-eva-theme", name: "EVA theme", desc: "EVA-themed colour scheme for dark and light modes." },
      { id: "dsh-language-switcher", name: "Language & translation", desc: "Language switch + fix-translation overrides." },
    ];

    const css = [
      ".mp-root{display:flex;flex-direction:column;gap:14px;max-width:720px}",
      ".mp-head{margin:0;font-size:16px;font-weight:600;color:var(--dsw-alias-label-primary)}",
      ".mp-intro{margin:0;font-size:13px;line-height:1.6;color:var(--dsw-alias-label-tertiary)}",
      ".mp-cards{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:10px}",
      ".mp-card{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);border-radius:12px;padding:12px 14px;display:flex;align-items:center;gap:12px}",
      ".mp-body{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}",
      ".mp-name{font-size:14px;font-weight:600;color:var(--dsw-alias-label-primary)}",
      ".mp-desc{font-size:12px;line-height:1.5;color:var(--dsw-alias-label-tertiary)}",
      ".mp-switch{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);border-radius:99px;flex-shrink:0;width:38px;height:22px;padding:0;position:relative;opacity:.5;cursor:default}",
      ".mp-switch .mp-knob{background:var(--dsw-alias-label-tertiary);border-radius:99px;width:16px;height:16px;position:absolute;top:2px;left:18px}",
    ].join("\n");
    function injectCss() {
      if (typeof document === "undefined") return;
      if (document.querySelector('style[data-plugin-css="@muen/dsh-muen-plugins"]')) return;
      const tag = document.createElement("style");
      tag.dataset.pluginCss = "@muen/dsh-muen-plugins";
      tag.textContent = css;
      document.head.appendChild(tag);
    }

    const Switch = ({ title }) =>
      h("span", { className: "mp-switch", title, role: "switch", "aria-checked": "true", "aria-disabled": "true" },
        h("span", { className: "mp-knob" }));

    const MuenPluginsTab = ({ t }) =>
      h("div", { className: "mp-root" },
        h("h2", { className: "mp-head" }, t("title")),
        h("p", { className: "mp-intro" }, t("intro")),
        h("ul", { className: "mp-cards" },
          MUEN_PLUGINS.map((p) =>
            h("li", { key: p.id, className: "mp-card" },
              h("div", { className: "mp-body" },
                h("div", { className: "mp-name" }, p.mech ? t("mech") : p.name),
                h("div", { className: "mp-desc" }, p.mech ? t("mechDesc") : p.desc)),
              h(Switch, { title: p.installed ? t("handTooltip") : t("tooltip") })))));

    function apply(ctx) {
      injectCss();
      try {
        const locale = typeof ctx.get === "function" ? ctx.get("locale") : undefined;
        if (locale && typeof locale.register === "function") locale.register(NS, DICT); // single instance
      } catch { /* locale optional */ }
      let t;
      try {
        const locale = typeof ctx.get === "function" ? ctx.get("locale") : undefined;
        t = locale && typeof locale.bind === "function" ? locale.bind(NS) : (k) => DICT.en[k] || k;
      } catch { t = (k) => DICT.en[k] || k; }

      ctx.slots.inject("settings.section", () =>
        ctx.slots.register({
          name: "settings.section",
          id: "muen-plugins",
          order: 40,
          label: () => t("title"),
          locale: NS,
          inject: () => ({ t }),
        }, () => h(MuenPluginsTab, { t })));
    }

    return { inject: ["slots"], apply };
  }
});
