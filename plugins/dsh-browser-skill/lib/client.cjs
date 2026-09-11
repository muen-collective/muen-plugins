window.__ModuleLoader__.load({
	id: "@wxg-prc-cpg/browser-skill-dsh-plugin",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		//#region \0rolldown/runtime.js
		var __create = Object.create;
		var __defProp = Object.defineProperty;
		var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
		var __getOwnPropNames = Object.getOwnPropertyNames;
		var __getProtoOf = Object.getPrototypeOf;
		var __hasOwnProp = Object.prototype.hasOwnProperty;
		var __copyProps = (to, from, except, desc) => {
			if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
				key = keys[i];
				if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
					get: ((k) => from[k]).bind(null, key),
					enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
				});
			}
			return to;
		};
		var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule || !__hasOwnProp.call(mod, "default") ? __defProp(target, "default", {
			value: mod,
			enumerable: true
		}) : target, mod));
		//#endregion
		let react = require("react");
		react = __toESM(react, 1);
		let _deepseek_ai_dsh_client_ui_attachment = require("@deepseek-ai/dsh-client-ui-attachment");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		let react_jsx_runtime = require("react/jsx-runtime");
		let react_dom = require("react-dom");
		//#region \0bsk-css:/private/tmp/browserskill-fork/packages/dsh-plugin-browserskill/src/client/bsk-tokens.nomodule.css.mjs
		const css$3 = ".bsk-obs{color-scheme:light dark;--background:var(--dsw-alias-bg-layer-2,#1c1a26);--foreground:var(--dsw-alias-label-primary,#e6e6f0);--card:var(--dsw-alias-bg-layer-1,#1a1826);--card-foreground:var(--dsw-alias-label-primary,#e6e6f0);--primary:var(--dsw-alias-state-business-primary,#7c7cf4);--primary-foreground:#fff;--secondary:var(--dsw-alias-bg-layer-2,#211f31);--secondary-foreground:var(--dsw-alias-label-primary,#e6e6f0);--muted:var(--dsw-alias-bg-layer-2,#211f31);--muted-foreground:var(--dsw-alias-label-secondary,#a0a0b0);--accent:var(--dsw-alias-bg-layer-2,#211f31);--accent-foreground:var(--dsw-alias-label-primary,#e6e6f0);--destructive:var(--dsw-alias-state-error-primary,#f87171);--destructive-foreground:#fff;--border:var(--dsw-alias-border-l2,#2b2838);--input:var(--dsw-alias-border-l2,#2b2838);--ring:var(--dsw-alias-state-business-primary,#7c7cf4);--radius:.75rem}";
		const tagId$3 = "@wxg-prc-cpg/browser-skill-dsh-plugin/bsk-tokens.nomodule.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$3) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@wxg-prc-cpg/browser-skill-dsh-plugin";
			tag.dataset.pluginCss = tagId$3;
			tag.textContent = css$3;
			document.head.appendChild(tag);
		}
		//#endregion
		//#region \0bsk-css:/private/tmp/browserskill-fork/packages/dsh-plugin-browserskill/src/client/bsk-ui.nomodule.css.mjs
		const css$2 = "/*! tailwindcss v4.3.3 | MIT License | https://tailwindcss.com */\n@layer properties{@supports (((-webkit-hyphens:none)) and (not (margin-trim:inline))) or ((-moz-orient:inline) and (not (color:rgb(from red r g b)))){.bsk-obs *,.bsk-obs :before,.bsk-obs :after,.bsk-obs ::backdrop{--tw-rotate-x:initial;--tw-rotate-y:initial;--tw-rotate-z:initial;--tw-skew-x:initial;--tw-skew-y:initial;--tw-border-style:solid;--tw-leading:initial;--tw-font-weight:initial;--tw-tracking:initial;--tw-shadow:0 0 #0000;--tw-shadow-color:initial;--tw-shadow-alpha:100%;--tw-inset-shadow:0 0 #0000;--tw-inset-shadow-color:initial;--tw-inset-shadow-alpha:100%;--tw-ring-color:initial;--tw-ring-shadow:0 0 #0000;--tw-inset-ring-color:initial;--tw-inset-ring-shadow:0 0 #0000;--tw-ring-inset:initial;--tw-ring-offset-width:0px;--tw-ring-offset-color:#fff;--tw-ring-offset-shadow:0 0 #0000;--tw-outline-style:solid;--tw-blur:initial;--tw-brightness:initial;--tw-contrast:initial;--tw-grayscale:initial;--tw-hue-rotate:initial;--tw-invert:initial;--tw-opacity:initial;--tw-saturate:initial;--tw-sepia:initial;--tw-drop-shadow:initial;--tw-drop-shadow-color:initial;--tw-drop-shadow-alpha:100%;--tw-drop-shadow-size:initial}}}@layer theme{.bsk-obs,.bsk-obs :host{--font-sans:-apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", \"Noto Sans\", Arial, sans-serif, \"Apple Color Emoji\", \"Segoe UI Emoji\", \"Segoe UI Symbol\", \"Noto Color Emoji\";--font-mono:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace;--color-red-500:oklch(63.7% .237 25.331);--color-amber-500:oklch(76.9% .188 70.08);--color-emerald-500:oklch(69.6% .17 162.48);--spacing:.25rem;--text-xs:.75rem;--text-xs--line-height:calc(1 / .75);--text-sm:.875rem;--text-sm--line-height:calc(1.25 / .875);--font-weight-medium:500;--font-weight-semibold:600;--tracking-tight:-.025em;--leading-relaxed:1.625;--default-transition-duration:.15s;--default-transition-timing-function:cubic-bezier(.4, 0, .2, 1);--default-font-family:var(--font-sans);--default-mono-font-family:var(--font-mono)}}@layer base{.bsk-obs *,.bsk-obs :after,.bsk-obs :before,.bsk-obs ::backdrop,.bsk-obs ::file-selector-button{box-sizing:border-box;border:0 solid;margin:0;padding:0}.bsk-obs,.bsk-obs :host{-webkit-text-size-adjust:100%;tab-size:4;line-height:1.5;font-family:var(--default-font-family,-apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", \"Noto Sans\", Arial, sans-serif, \"Apple Color Emoji\", \"Segoe UI Emoji\", \"Segoe UI Symbol\", \"Noto Color Emoji\");font-feature-settings:var(--default-font-feature-settings,normal);font-variation-settings:var(--default-font-variation-settings,normal);-webkit-tap-highlight-color:transparent}.bsk-obs hr{height:0;color:inherit;border-top-width:1px}.bsk-obs abbr:where([title]){text-decoration:underline dotted}.bsk-obs h1,.bsk-obs h2,.bsk-obs h3,.bsk-obs h4,.bsk-obs h5,.bsk-obs h6{font-size:inherit;font-weight:inherit}.bsk-obs a{color:inherit;-webkit-text-decoration:inherit;text-decoration:inherit}.bsk-obs b,.bsk-obs strong{font-weight:bolder}.bsk-obs code,.bsk-obs kbd,.bsk-obs samp,.bsk-obs pre{font-family:var(--default-mono-font-family,ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace);font-feature-settings:var(--default-mono-font-feature-settings,normal);font-variation-settings:var(--default-mono-font-variation-settings,normal);font-size:1em}.bsk-obs small{font-size:80%}.bsk-obs sub,.bsk-obs sup{vertical-align:baseline;font-size:75%;line-height:0;position:relative}.bsk-obs sub{bottom:-.25em}.bsk-obs sup{top:-.5em}.bsk-obs table{text-indent:0;border-color:inherit;border-collapse:collapse}.bsk-obs :-moz-focusring:where(:not(iframe)){outline:auto}.bsk-obs progress{vertical-align:baseline}.bsk-obs summary{display:list-item}.bsk-obs ol,.bsk-obs ul,.bsk-obs menu{list-style:none}.bsk-obs img,.bsk-obs svg,.bsk-obs video,.bsk-obs canvas,.bsk-obs audio,.bsk-obs iframe,.bsk-obs embed,.bsk-obs object{vertical-align:middle;display:block}.bsk-obs img,.bsk-obs video{max-width:100%;height:auto}.bsk-obs button,.bsk-obs input,.bsk-obs select,.bsk-obs optgroup,.bsk-obs textarea,.bsk-obs ::file-selector-button{font:inherit;font-feature-settings:inherit;font-variation-settings:inherit;letter-spacing:inherit;color:inherit;opacity:1;background-color:#0000;border-radius:0}.bsk-obs :where(select:is([multiple],[size])) optgroup{font-weight:bolder}.bsk-obs :where(select:is([multiple],[size])) optgroup option{padding-inline-start:20px}.bsk-obs ::file-selector-button{margin-inline-end:4px}.bsk-obs ::placeholder{opacity:1}@supports (not ((-webkit-appearance:-apple-pay-button))) or (contain-intrinsic-size:1px){.bsk-obs ::placeholder{color:currentColor;@supports (color:color-mix(in lab, red, red)){color:color-mix(in oklab, currentcolor 50%, transparent)}}}.bsk-obs textarea{resize:vertical}.bsk-obs ::-webkit-search-decoration{-webkit-appearance:none}.bsk-obs ::-webkit-date-and-time-value{min-height:1lh;text-align:inherit}.bsk-obs ::-webkit-datetime-edit{display:inline-flex}.bsk-obs ::-webkit-datetime-edit-fields-wrapper{padding:0}.bsk-obs ::-webkit-datetime-edit,.bsk-obs ::-webkit-datetime-edit-year-field,.bsk-obs ::-webkit-datetime-edit-month-field,.bsk-obs ::-webkit-datetime-edit-day-field,.bsk-obs ::-webkit-datetime-edit-hour-field,.bsk-obs ::-webkit-datetime-edit-minute-field,.bsk-obs ::-webkit-datetime-edit-second-field,.bsk-obs ::-webkit-datetime-edit-millisecond-field,.bsk-obs ::-webkit-datetime-edit-meridiem-field{padding-block:0}.bsk-obs ::-webkit-calendar-picker-indicator{line-height:1}.bsk-obs :-moz-ui-invalid{box-shadow:none}.bsk-obs button,.bsk-obs input:where([type=button],[type=reset],[type=submit]),.bsk-obs ::file-selector-button{appearance:button}.bsk-obs ::-webkit-inner-spin-button,.bsk-obs ::-webkit-outer-spin-button{height:auto}.bsk-obs [hidden]:where(:not([hidden=until-found])){display:none!important}}@layer components;@layer utilities{.bsk-obs .collapse{visibility:collapse}.bsk-obs .invisible{visibility:hidden}.bsk-obs .visible{visibility:visible}.bsk-obs .static{position:static}.bsk-obs .col-start-2{grid-column-start:2}.bsk-obs .row-span-2{grid-row:span 2/span 2}.bsk-obs .row-start-1{grid-row-start:1}.bsk-obs .container{width:100%;@media (width>=40rem){max-width:40rem}@media (width>=48rem){max-width:48rem}@media (width>=64rem){max-width:64rem}@media (width>=80rem){max-width:80rem}@media (width>=96rem){max-width:96rem}}.bsk-obs .block{display:block}.bsk-obs .flex{display:flex}.bsk-obs .grid{display:grid}.bsk-obs .hidden{display:none}.bsk-obs .inline{display:inline}.bsk-obs .inline-flex{display:inline-flex}.bsk-obs .table{display:table}.bsk-obs .size-2{width:calc(var(--spacing) * 2);height:calc(var(--spacing) * 2)}.bsk-obs .size-9{width:calc(var(--spacing) * 9);height:calc(var(--spacing) * 9)}.bsk-obs .h-8{height:calc(var(--spacing) * 8)}.bsk-obs .h-9{height:calc(var(--spacing) * 9)}.bsk-obs .h-10{height:calc(var(--spacing) * 10)}.bsk-obs .w-fit{width:fit-content}.bsk-obs .w-full{width:100%}.bsk-obs .min-w-0{min-width:0}.bsk-obs .shrink-0{flex-shrink:0}.bsk-obs .transform{transform:var(--tw-rotate-x,) var(--tw-rotate-y,) var(--tw-rotate-z,) var(--tw-skew-x,) var(--tw-skew-y,)}.bsk-obs .resize{resize:both}.bsk-obs .auto-rows-min{grid-auto-rows:min-content}.bsk-obs .grid-rows-\\[auto_auto\\]{grid-template-rows:auto auto}.bsk-obs .flex-col{flex-direction:column}.bsk-obs .items-center{align-items:center}.bsk-obs .items-start{align-items:flex-start}.bsk-obs .justify-center{justify-content:center}.bsk-obs .gap-1{gap:var(--spacing)}.bsk-obs .gap-1\\.5{gap:calc(var(--spacing) * 1.5)}.bsk-obs .gap-2{gap:calc(var(--spacing) * 2)}.bsk-obs .gap-5{gap:calc(var(--spacing) * 5)}.bsk-obs .self-start{align-self:flex-start}.bsk-obs .justify-self-end{justify-self:flex-end}.bsk-obs .overflow-hidden{overflow:hidden}.bsk-obs .rounded-2xl{border-radius:calc(var(--radius) + 8px)}.bsk-obs .rounded-full{border-radius:3.40282e38px}.bsk-obs .rounded-xl{border-radius:calc(var(--radius) + 4px)}.bsk-obs .border{border-style:var(--tw-border-style);border-width:1px}.bsk-obs .border-input{border-color:var(--input)}.bsk-obs .border-transparent{border-color:#0000}.bsk-obs .bg-amber-500{background-color:var(--color-amber-500)}.bsk-obs .bg-background{background-color:var(--background)}.bsk-obs .bg-background\\/70{background-color:var(--background);@supports (color:color-mix(in lab, red, red)){background-color:color-mix(in oklab, var(--background) 70%, transparent)}}.bsk-obs .bg-card{background-color:var(--card)}.bsk-obs .bg-destructive{background-color:var(--destructive)}.bsk-obs .bg-emerald-500{background-color:var(--color-emerald-500)}.bsk-obs .bg-muted-foreground\\/40{background-color:var(--muted-foreground);@supports (color:color-mix(in lab, red, red)){background-color:color-mix(in oklab, var(--muted-foreground) 40%, transparent)}}.bsk-obs .bg-primary{background-color:var(--primary)}.bsk-obs .bg-red-500{background-color:var(--color-red-500)}.bsk-obs .bg-secondary{background-color:var(--secondary)}.bsk-obs .px-2{padding-inline:calc(var(--spacing) * 2)}.bsk-obs .px-3{padding-inline:calc(var(--spacing) * 3)}.bsk-obs .px-4{padding-inline:calc(var(--spacing) * 4)}.bsk-obs .px-5{padding-inline:calc(var(--spacing) * 5)}.bsk-obs .px-6{padding-inline:calc(var(--spacing) * 6)}.bsk-obs .py-0\\.5{padding-block:calc(var(--spacing) * .5)}.bsk-obs .py-1{padding-block:var(--spacing)}.bsk-obs .py-2{padding-block:calc(var(--spacing) * 2)}.bsk-obs .py-5{padding-block:calc(var(--spacing) * 5)}.bsk-obs .text-sm{font-size:var(--text-sm);line-height:var(--tw-leading,var(--text-sm--line-height))}.bsk-obs .text-xs{font-size:var(--text-xs);line-height:var(--tw-leading,var(--text-xs--line-height))}.bsk-obs .leading-none{--tw-leading:1;line-height:1}.bsk-obs .leading-relaxed{--tw-leading:var(--leading-relaxed);line-height:var(--leading-relaxed)}.bsk-obs .font-medium{--tw-font-weight:var(--font-weight-medium);font-weight:var(--font-weight-medium)}.bsk-obs .font-semibold{--tw-font-weight:var(--font-weight-semibold);font-weight:var(--font-weight-semibold)}.bsk-obs .tracking-tight{--tw-tracking:var(--tracking-tight);letter-spacing:var(--tracking-tight)}.bsk-obs .whitespace-nowrap{white-space:nowrap}.bsk-obs .text-card-foreground{color:var(--card-foreground)}.bsk-obs .text-destructive-foreground{color:var(--destructive-foreground)}.bsk-obs .text-foreground{color:var(--foreground)}.bsk-obs .text-muted-foreground{color:var(--muted-foreground)}.bsk-obs .text-primary{color:var(--primary)}.bsk-obs .text-primary-foreground{color:var(--primary-foreground)}.bsk-obs .text-secondary-foreground{color:var(--secondary-foreground)}.bsk-obs .underline-offset-4{text-underline-offset:4px}.bsk-obs .shadow-sm{--tw-shadow:0 1px 3px 0 var(--tw-shadow-color,#0000001a), 0 1px 2px -1px var(--tw-shadow-color,#0000001a);box-shadow:var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)}.bsk-obs .shadow-xs{--tw-shadow:0 1px 2px 0 var(--tw-shadow-color,#0000000d);box-shadow:var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)}.bsk-obs .ring{--tw-ring-shadow:var(--tw-ring-inset,) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color,currentcolor);box-shadow:var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)}.bsk-obs .ring-2{--tw-ring-shadow:var(--tw-ring-inset,) 0 0 0 calc(2px + var(--tw-ring-offset-width)) var(--tw-ring-color,currentcolor);box-shadow:var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)}.bsk-obs .ring-background{--tw-ring-color:var(--background)}.bsk-obs .outline{outline-style:var(--tw-outline-style);outline-width:1px}.bsk-obs .filter{filter:var(--tw-blur,) var(--tw-brightness,) var(--tw-contrast,) var(--tw-grayscale,) var(--tw-hue-rotate,) var(--tw-invert,) var(--tw-saturate,) var(--tw-sepia,) var(--tw-drop-shadow,)}.bsk-obs .transition-\\[background\\,border-color\\,box-shadow\\]{transition-property:background,border-color,box-shadow;transition-timing-function:var(--tw-ease,var(--default-transition-timing-function));transition-duration:var(--tw-duration,var(--default-transition-duration))}.bsk-obs .transition-all{transition-property:all;transition-timing-function:var(--tw-ease,var(--default-transition-timing-function));transition-duration:var(--tw-duration,var(--default-transition-duration))}.bsk-obs .transition-colors{transition-property:color,background-color,border-color,outline-color,text-decoration-color,fill,stroke,--tw-gradient-from,--tw-gradient-via,--tw-gradient-to;transition-timing-function:var(--tw-ease,var(--default-transition-timing-function));transition-duration:var(--tw-duration,var(--default-transition-duration))}.bsk-obs .outline-none{--tw-outline-style:none;outline-style:none}.bsk-obs .select-none{-webkit-user-select:none;user-select:none}.bsk-obs .peer-disabled\\:cursor-not-allowed:is(:where(.peer):disabled~*){cursor:not-allowed}.bsk-obs .peer-disabled\\:opacity-50:is(:where(.peer):disabled~*){opacity:.5}.bsk-obs .placeholder\\:text-muted-foreground::placeholder{color:var(--muted-foreground)}@media (hover:hover){.bsk-obs .hover\\:bg-accent:hover{background-color:var(--accent)}.bsk-obs .hover\\:bg-primary\\/90:hover{background-color:var(--primary)}@supports (color:color-mix(in lab, red, red)){.bsk-obs .hover\\:bg-primary\\/90:hover{background-color:color-mix(in oklab, var(--primary) 90%, transparent)}}.bsk-obs .hover\\:bg-secondary\\/80:hover{background-color:var(--secondary)}@supports (color:color-mix(in lab, red, red)){.bsk-obs .hover\\:bg-secondary\\/80:hover{background-color:color-mix(in oklab, var(--secondary) 80%, transparent)}}.bsk-obs .hover\\:text-accent-foreground:hover{color:var(--accent-foreground)}.bsk-obs .hover\\:underline:hover{text-decoration-line:underline}}.bsk-obs .focus-visible\\:border-ring:focus-visible{border-color:var(--ring)}.bsk-obs .focus-visible\\:ring-\\[3px\\]:focus-visible{--tw-ring-shadow:var(--tw-ring-inset,) 0 0 0 calc(3px + var(--tw-ring-offset-width)) var(--tw-ring-color,currentcolor);box-shadow:var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)}.bsk-obs .focus-visible\\:ring-ring\\/50:focus-visible{--tw-ring-color:var(--ring);@supports (color:color-mix(in lab, red, red)){--tw-ring-color:color-mix(in oklab, var(--ring) 50%, transparent)}}.bsk-obs .disabled\\:pointer-events-none:disabled{pointer-events:none}.bsk-obs .disabled\\:cursor-not-allowed:disabled{cursor:not-allowed}.bsk-obs .disabled\\:opacity-50:disabled{opacity:.5}.bsk-obs .has-data-\\[slot\\=card-action\\]\\:grid-cols-\\[1fr_auto\\]:has([data-slot=card-action]){grid-template-columns:1fr auto}}@property --tw-rotate-x{syntax:\"*\";inherits:false}@property --tw-rotate-y{syntax:\"*\";inherits:false}@property --tw-rotate-z{syntax:\"*\";inherits:false}@property --tw-skew-x{syntax:\"*\";inherits:false}@property --tw-skew-y{syntax:\"*\";inherits:false}@property --tw-border-style{syntax:\"*\";inherits:false;initial-value:solid}@property --tw-leading{syntax:\"*\";inherits:false}@property --tw-font-weight{syntax:\"*\";inherits:false}@property --tw-tracking{syntax:\"*\";inherits:false}@property --tw-shadow{syntax:\"*\";inherits:false;initial-value:0 0 #0000}@property --tw-shadow-color{syntax:\"*\";inherits:false}@property --tw-shadow-alpha{syntax:\"<percentage>\";inherits:false;initial-value:100%}@property --tw-inset-shadow{syntax:\"*\";inherits:false;initial-value:0 0 #0000}@property --tw-inset-shadow-color{syntax:\"*\";inherits:false}@property --tw-inset-shadow-alpha{syntax:\"<percentage>\";inherits:false;initial-value:100%}@property --tw-ring-color{syntax:\"*\";inherits:false}@property --tw-ring-shadow{syntax:\"*\";inherits:false;initial-value:0 0 #0000}@property --tw-inset-ring-color{syntax:\"*\";inherits:false}@property --tw-inset-ring-shadow{syntax:\"*\";inherits:false;initial-value:0 0 #0000}@property --tw-ring-inset{syntax:\"*\";inherits:false}@property --tw-ring-offset-width{syntax:\"<length>\";inherits:false;initial-value:0}@property --tw-ring-offset-color{syntax:\"*\";inherits:false;initial-value:#fff}@property --tw-ring-offset-shadow{syntax:\"*\";inherits:false;initial-value:0 0 #0000}@property --tw-outline-style{syntax:\"*\";inherits:false;initial-value:solid}@property --tw-blur{syntax:\"*\";inherits:false}@property --tw-brightness{syntax:\"*\";inherits:false}@property --tw-contrast{syntax:\"*\";inherits:false}@property --tw-grayscale{syntax:\"*\";inherits:false}@property --tw-hue-rotate{syntax:\"*\";inherits:false}@property --tw-invert{syntax:\"*\";inherits:false}@property --tw-opacity{syntax:\"*\";inherits:false}@property --tw-saturate{syntax:\"*\";inherits:false}@property --tw-sepia{syntax:\"*\";inherits:false}@property --tw-drop-shadow{syntax:\"*\";inherits:false}@property --tw-drop-shadow-color{syntax:\"*\";inherits:false}@property --tw-drop-shadow-alpha{syntax:\"<percentage>\";inherits:false;initial-value:100%}@property --tw-drop-shadow-size{syntax:\"*\";inherits:false}";
		const tagId$2 = "@wxg-prc-cpg/browser-skill-dsh-plugin/bsk-ui.nomodule.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$2) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@wxg-prc-cpg/browser-skill-dsh-plugin";
			tag.dataset.pluginCss = tagId$2;
			tag.textContent = css$2;
			document.head.appendChild(tag);
		}
		//#endregion
		//#region \0bsk-css:/private/tmp/browserskill-fork/packages/dsh-plugin-browserskill/src/client/BrowserInspectToolView.module.css.mjs
		const css$1 = ".dvZzbq_card{flex-direction:column;display:flex}.dvZzbq_summary{text-overflow:ellipsis;white-space:nowrap;min-width:0;color:var(--dsw-alias-label-secondary);margin-left:6px;overflow:hidden}.dvZzbq_card[data-state=error] .dvZzbq_summary{color:var(--dsw-alias-label-error)}.dvZzbq_body{flex-direction:column;gap:8px;padding:4px 0 4px 22px;display:flex}.dvZzbq_image-wrap{display:flex}.dvZzbq_inspect-button{font:inherit;color:var(--dsw-alias-label-tertiary);cursor:pointer;background:0 0;border:none;align-self:flex-start;padding:0;font-size:12px}.dvZzbq_inspect-button:hover{color:var(--dsw-alias-label-secondary)}.dvZzbq_inspect-button:focus-visible{outline:2px solid var(--dsw-alias-border-focus);outline-offset:2px;border-radius:2px}@media (prefers-reduced-motion:reduce){.dvZzbq_inspect-button{transition:none}}";
		const tagId$1 = "@wxg-prc-cpg/browser-skill-dsh-plugin/BrowserInspectToolView.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$1) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@wxg-prc-cpg/browser-skill-dsh-plugin";
			tag.dataset.pluginCss = tagId$1;
			tag.textContent = css$1;
			document.head.appendChild(tag);
		}
		var BrowserInspectToolView_module_css_default = {
			"card": "dvZzbq_card",
			"summary": "dvZzbq_summary",
			"body": "dvZzbq_body",
			"image-wrap": "dvZzbq_image-wrap",
			"inspect-button": "dvZzbq_inspect-button"
		};
		//#endregion
		//#region src/client/BrowserInspectToolView.tsx
		const TERMINAL_LABELS = {
			running: "Running",
			failed: "Failed",
			done: "Done",
			copy: "Copy",
			copied: "Copied",
			noOutput: "No output",
			collapseAria: "Collapse output",
			collapse: "Collapse",
			expandAria: (hidden) => `Expand the remaining ${hidden} output lines`,
			expand: (hidden) => `… ${hidden} more lines`
		};
		const IMAGE_LABELS = {
			image: "screenshot",
			open: "Open the original screenshot",
			openNamed: (label) => `Open screenshot ${label}`,
			loading: "Loading…",
			loadFailed: "Load failed — retry",
			lightbox: {
				dialog: "Screenshot preview",
				close: "Close preview"
			}
		};
		function firstLine(text) {
			const newline = text.indexOf("\n");
			return newline === -1 ? text : text.slice(0, newline);
		}
		/** Rebuild the command line from the logged arguments (mirrors the host presenter). */
		const INSPECT_COMMANDS = {
			observe: "observe",
			snapshot: "snapshot",
			html: "get-html",
			screenshot: "screenshot",
			console: "console",
			network: "network"
		};
		function titleOf(action) {
			return action === "html" ? "HTML" : `${action.slice(0, 1).toUpperCase()}${action.slice(1)}`;
		}
		function appendNumber(parts, flag, value) {
			if (typeof value === "number" && Number.isFinite(value)) parts.push(flag, String(value));
		}
		function commandOf(argsRaw, callId) {
			try {
				const args = JSON.parse(argsRaw);
				const action = typeof args.action === "string" ? args.action : "inspect";
				const parts = [
					"bsk",
					INSPECT_COMMANDS[action] ?? action,
					"--session"
				];
				parts.push(typeof args.session === "string" && args.session !== "" ? args.session : "(current)");
				if (action === "observe" || action === "snapshot") {
					appendNumber(parts, "--max-depth", args.maxDepth);
					appendNumber(parts, "--max-tokens", args.maxTokens);
				}
				if (action === "html" || action === "console" || action === "network") appendNumber(parts, "--tab-id", args.tabId);
				if ((action === "html" || action === "screenshot") && typeof args.ref === "string") {
					if (args.ref !== "") parts.push("--ref", args.ref);
				}
				if (action === "html") appendNumber(parts, "--max-bytes", args.maxBytes);
				if (action === "console" || action === "network") {
					appendNumber(parts, "--since", args.since);
					appendNumber(parts, "--limit", args.limit);
					appendNumber(parts, "--max-text-chars", args.maxTextChars);
				}
				if (action === "console" && args.includeStack === true) parts.push("--include-stack");
				return {
					command: parts.join(" "),
					title: titleOf(action)
				};
			} catch {
				return {
					command: argsRaw === "" ? `browser_inspect (${callId})` : `browser_inspect ${firstLine(argsRaw)}`,
					title: "Inspect"
				};
			}
		}
		/** Derive the display model from the frozen block only. */
		function viewModelOf(block) {
			const settled = "kind" in block;
			const { command, title } = commandOf((settled ? block.call?.argsRaw : block.argsRaw) ?? "", block.callId);
			if (!settled) return {
				state: "running",
				command,
				output: null,
				image: null,
				summary: command,
				title
			};
			const textBlock = block.content.find((item) => item.type === "text");
			const imageBlock = block.content.find((item) => item.type === "image");
			const output = textBlock !== void 0 && textBlock.type === "text" ? textBlock.text : null;
			const image = imageBlock !== void 0 && imageBlock.type === "image" ? imageBlock.attachment : null;
			return {
				state: block.isError ? "error" : "ok",
				command,
				output,
				image,
				summary: output !== null ? firstLine(output) : command,
				title
			};
		}
		function dotState(state) {
			switch (state) {
				case "running": return "ongoing";
				case "error": return "error";
				default: return "done";
			}
		}
		/**
		* Render one browser_inspect call: a disclosure row over a terminal block,
		* plus the screenshot image when that action returns an image attachment.
		*/
		function BrowserInspectToolView({ block, cwd, inspect, loadImage }) {
			const model = viewModelOf(block);
			const [expanded, setExpanded] = (0, react.useState)(false);
			const expandable = model.state === "running" || model.output !== null || model.image !== null;
			const open = expanded && expandable;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: BrowserInspectToolView_module_css_default.card,
				"data-tool": "browser_inspect",
				"data-state": model.state,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.DisclosureRow, {
					icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, { state: dotState(model.state) }),
					title: model.title,
					open,
					expandable,
					onToggle: () => setExpanded((value) => !value),
					expandOnRowClick: true,
					previewChevron: true,
					collapsedContent: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: BrowserInspectToolView_module_css_default.summary,
						children: model.summary
					}),
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: BrowserInspectToolView_module_css_default.body,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.TerminalBlock, {
								command: model.command,
								cwd: cwd ?? void 0,
								output: model.output ?? void 0,
								running: model.state === "running",
								labels: TERMINAL_LABELS
							}),
							model.image !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: BrowserInspectToolView_module_css_default["image-wrap"],
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_attachment.MessageImage, {
									attachment: model.image,
									load: loadImage,
									variant: "single",
									labels: IMAGE_LABELS
								})
							}) : null,
							inspect !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: BrowserInspectToolView_module_css_default["inspect-button"],
								onClick: inspect,
								children: "Inspect"
							}) : null
						]
					})
				})
			});
		}
		//#endregion
		//#region ../../node_modules/.pnpm/clsx@2.1.1/node_modules/clsx/dist/clsx.mjs
		function r(e) {
			var t, f, n = "";
			if ("string" == typeof e || "number" == typeof e) n += e;
			else if ("object" == typeof e) if (Array.isArray(e)) {
				var o = e.length;
				for (t = 0; t < o; t++) e[t] && (f = r(e[t])) && (n && (n += " "), n += f);
			} else for (f in e) e[f] && (n && (n += " "), n += f);
			return n;
		}
		function clsx() {
			for (var e, t, f = 0, n = "", o = arguments.length; f < o; f++) (e = arguments[f]) && (t = r(e)) && (n && (n += " "), n += t);
			return n;
		}
		//#endregion
		//#region ../../node_modules/.pnpm/tailwind-merge@3.6.0/node_modules/tailwind-merge/dist/bundle-mjs.mjs
		/**
		* Concatenates two arrays faster than the array spread operator.
		*/
		const concatArrays = (array1, array2) => {
			const combinedArray = new Array(array1.length + array2.length);
			for (let i = 0; i < array1.length; i++) combinedArray[i] = array1[i];
			for (let i = 0; i < array2.length; i++) combinedArray[array1.length + i] = array2[i];
			return combinedArray;
		};
		const createClassValidatorObject = (classGroupId, validator) => ({
			classGroupId,
			validator
		});
		const createClassPartObject = (nextPart = /* @__PURE__ */ new Map(), validators = null, classGroupId) => ({
			nextPart,
			validators,
			classGroupId
		});
		const CLASS_PART_SEPARATOR = "-";
		const EMPTY_CONFLICTS = [];
		const ARBITRARY_PROPERTY_PREFIX = "arbitrary..";
		const createClassGroupUtils = (config) => {
			const classMap = createClassMap(config);
			const { conflictingClassGroups, conflictingClassGroupModifiers } = config;
			const getClassGroupId = (className) => {
				if (className.startsWith("[") && className.endsWith("]")) return getGroupIdForArbitraryProperty(className);
				const classParts = className.split(CLASS_PART_SEPARATOR);
				const startIndex = classParts[0] === "" && classParts.length > 1 ? 1 : 0;
				return getGroupRecursive(classParts, startIndex, classMap);
			};
			const getConflictingClassGroupIds = (classGroupId, hasPostfixModifier) => {
				if (hasPostfixModifier) {
					const modifierConflicts = conflictingClassGroupModifiers[classGroupId];
					const baseConflicts = conflictingClassGroups[classGroupId];
					if (modifierConflicts) {
						if (baseConflicts) return concatArrays(baseConflicts, modifierConflicts);
						return modifierConflicts;
					}
					return baseConflicts || EMPTY_CONFLICTS;
				}
				return conflictingClassGroups[classGroupId] || EMPTY_CONFLICTS;
			};
			return {
				getClassGroupId,
				getConflictingClassGroupIds
			};
		};
		const getGroupRecursive = (classParts, startIndex, classPartObject) => {
			if (classParts.length - startIndex === 0) return classPartObject.classGroupId;
			const currentClassPart = classParts[startIndex];
			const nextClassPartObject = classPartObject.nextPart.get(currentClassPart);
			if (nextClassPartObject) {
				const result = getGroupRecursive(classParts, startIndex + 1, nextClassPartObject);
				if (result) return result;
			}
			const validators = classPartObject.validators;
			if (validators === null) return;
			const classRest = startIndex === 0 ? classParts.join(CLASS_PART_SEPARATOR) : classParts.slice(startIndex).join(CLASS_PART_SEPARATOR);
			const validatorsLength = validators.length;
			for (let i = 0; i < validatorsLength; i++) {
				const validatorObj = validators[i];
				if (validatorObj.validator(classRest)) return validatorObj.classGroupId;
			}
		};
		/**
		* Get the class group ID for an arbitrary property.
		*
		* @param className - The class name to get the group ID for. Is expected to be string starting with `[` and ending with `]`.
		*/
		const getGroupIdForArbitraryProperty = (className) => className.slice(1, -1).indexOf(":") === -1 ? void 0 : (() => {
			const content = className.slice(1, -1);
			const colonIndex = content.indexOf(":");
			const property = content.slice(0, colonIndex);
			return property ? ARBITRARY_PROPERTY_PREFIX + property : void 0;
		})();
		/**
		* Exported for testing only
		*/
		const createClassMap = (config) => {
			const { theme, classGroups } = config;
			return processClassGroups(classGroups, theme);
		};
		const processClassGroups = (classGroups, theme) => {
			const classMap = createClassPartObject();
			for (const classGroupId in classGroups) {
				const group = classGroups[classGroupId];
				processClassesRecursively(group, classMap, classGroupId, theme);
			}
			return classMap;
		};
		const processClassesRecursively = (classGroup, classPartObject, classGroupId, theme) => {
			const len = classGroup.length;
			for (let i = 0; i < len; i++) {
				const classDefinition = classGroup[i];
				processClassDefinition(classDefinition, classPartObject, classGroupId, theme);
			}
		};
		const processClassDefinition = (classDefinition, classPartObject, classGroupId, theme) => {
			if (typeof classDefinition === "string") {
				processStringDefinition(classDefinition, classPartObject, classGroupId);
				return;
			}
			if (typeof classDefinition === "function") {
				processFunctionDefinition(classDefinition, classPartObject, classGroupId, theme);
				return;
			}
			processObjectDefinition(classDefinition, classPartObject, classGroupId, theme);
		};
		const processStringDefinition = (classDefinition, classPartObject, classGroupId) => {
			const classPartObjectToEdit = classDefinition === "" ? classPartObject : getPart(classPartObject, classDefinition);
			classPartObjectToEdit.classGroupId = classGroupId;
		};
		const processFunctionDefinition = (classDefinition, classPartObject, classGroupId, theme) => {
			if (isThemeGetter(classDefinition)) {
				processClassesRecursively(classDefinition(theme), classPartObject, classGroupId, theme);
				return;
			}
			if (classPartObject.validators === null) classPartObject.validators = [];
			classPartObject.validators.push(createClassValidatorObject(classGroupId, classDefinition));
		};
		const processObjectDefinition = (classDefinition, classPartObject, classGroupId, theme) => {
			const entries = Object.entries(classDefinition);
			const len = entries.length;
			for (let i = 0; i < len; i++) {
				const [key, value] = entries[i];
				processClassesRecursively(value, getPart(classPartObject, key), classGroupId, theme);
			}
		};
		const getPart = (classPartObject, path) => {
			let current = classPartObject;
			const parts = path.split(CLASS_PART_SEPARATOR);
			const len = parts.length;
			for (let i = 0; i < len; i++) {
				const part = parts[i];
				let next = current.nextPart.get(part);
				if (!next) {
					next = createClassPartObject();
					current.nextPart.set(part, next);
				}
				current = next;
			}
			return current;
		};
		const isThemeGetter = (func) => "isThemeGetter" in func && func.isThemeGetter === true;
		const createLruCache = (maxCacheSize) => {
			if (maxCacheSize < 1) return {
				get: () => void 0,
				set: () => {}
			};
			let cacheSize = 0;
			let cache = Object.create(null);
			let previousCache = Object.create(null);
			const update = (key, value) => {
				cache[key] = value;
				cacheSize++;
				if (cacheSize > maxCacheSize) {
					cacheSize = 0;
					previousCache = cache;
					cache = Object.create(null);
				}
			};
			return {
				get(key) {
					let value = cache[key];
					if (value !== void 0) return value;
					if ((value = previousCache[key]) !== void 0) {
						update(key, value);
						return value;
					}
				},
				set(key, value) {
					if (key in cache) cache[key] = value;
					else update(key, value);
				}
			};
		};
		const IMPORTANT_MODIFIER = "!";
		const MODIFIER_SEPARATOR = ":";
		const EMPTY_MODIFIERS = [];
		const createResultObject = (modifiers, hasImportantModifier, baseClassName, maybePostfixModifierPosition, isExternal) => ({
			modifiers,
			hasImportantModifier,
			baseClassName,
			maybePostfixModifierPosition,
			isExternal
		});
		const createParseClassName = (config) => {
			const { prefix, experimentalParseClassName } = config;
			/**
			* Parse class name into parts.
			*
			* Inspired by `splitAtTopLevelOnly` used in Tailwind CSS
			* @see https://github.com/tailwindlabs/tailwindcss/blob/v3.2.2/src/util/splitAtTopLevelOnly.js
			*/
			let parseClassName = (className) => {
				const modifiers = [];
				let bracketDepth = 0;
				let parenDepth = 0;
				let modifierStart = 0;
				let postfixModifierPosition;
				const len = className.length;
				for (let index = 0; index < len; index++) {
					const currentCharacter = className[index];
					if (bracketDepth === 0 && parenDepth === 0) {
						if (currentCharacter === MODIFIER_SEPARATOR) {
							modifiers.push(className.slice(modifierStart, index));
							modifierStart = index + 1;
							continue;
						}
						if (currentCharacter === "/") {
							postfixModifierPosition = index;
							continue;
						}
					}
					if (currentCharacter === "[") bracketDepth++;
					else if (currentCharacter === "]") bracketDepth--;
					else if (currentCharacter === "(") parenDepth++;
					else if (currentCharacter === ")") parenDepth--;
				}
				const baseClassNameWithImportantModifier = modifiers.length === 0 ? className : className.slice(modifierStart);
				let baseClassName = baseClassNameWithImportantModifier;
				let hasImportantModifier = false;
				if (baseClassNameWithImportantModifier.endsWith(IMPORTANT_MODIFIER)) {
					baseClassName = baseClassNameWithImportantModifier.slice(0, -1);
					hasImportantModifier = true;
				} else if (baseClassNameWithImportantModifier.startsWith(IMPORTANT_MODIFIER)) {
					baseClassName = baseClassNameWithImportantModifier.slice(1);
					hasImportantModifier = true;
				}
				const maybePostfixModifierPosition = postfixModifierPosition && postfixModifierPosition > modifierStart ? postfixModifierPosition - modifierStart : void 0;
				return createResultObject(modifiers, hasImportantModifier, baseClassName, maybePostfixModifierPosition);
			};
			if (prefix) {
				const fullPrefix = prefix + MODIFIER_SEPARATOR;
				const parseClassNameOriginal = parseClassName;
				parseClassName = (className) => className.startsWith(fullPrefix) ? parseClassNameOriginal(className.slice(fullPrefix.length)) : createResultObject(EMPTY_MODIFIERS, false, className, void 0, true);
			}
			if (experimentalParseClassName) {
				const parseClassNameOriginal = parseClassName;
				parseClassName = (className) => experimentalParseClassName({
					className,
					parseClassName: parseClassNameOriginal
				});
			}
			return parseClassName;
		};
		/**
		* Sorts modifiers according to following schema:
		* - Predefined modifiers are sorted alphabetically
		* - When an arbitrary variant appears, it must be preserved which modifiers are before and after it
		*/
		const createSortModifiers = (config) => {
			const modifierWeights = /* @__PURE__ */ new Map();
			config.orderSensitiveModifiers.forEach((mod, index) => {
				modifierWeights.set(mod, 1e6 + index);
			});
			return (modifiers) => {
				const result = [];
				let currentSegment = [];
				for (let i = 0; i < modifiers.length; i++) {
					const modifier = modifiers[i];
					const isArbitrary = modifier[0] === "[";
					const isOrderSensitive = modifierWeights.has(modifier);
					if (isArbitrary || isOrderSensitive) {
						if (currentSegment.length > 0) {
							currentSegment.sort();
							result.push(...currentSegment);
							currentSegment = [];
						}
						result.push(modifier);
					} else currentSegment.push(modifier);
				}
				if (currentSegment.length > 0) {
					currentSegment.sort();
					result.push(...currentSegment);
				}
				return result;
			};
		};
		const createConfigUtils = (config) => ({
			cache: createLruCache(config.cacheSize),
			parseClassName: createParseClassName(config),
			sortModifiers: createSortModifiers(config),
			postfixLookupClassGroupIds: createPostfixLookupClassGroupIds(config),
			...createClassGroupUtils(config)
		});
		const createPostfixLookupClassGroupIds = (config) => {
			const lookup = Object.create(null);
			const classGroupIds = config.postfixLookupClassGroups;
			if (classGroupIds) for (let i = 0; i < classGroupIds.length; i++) lookup[classGroupIds[i]] = true;
			return lookup;
		};
		const SPLIT_CLASSES_REGEX = /\s+/;
		const mergeClassList = (classList, configUtils) => {
			const { parseClassName, getClassGroupId, getConflictingClassGroupIds, sortModifiers, postfixLookupClassGroupIds } = configUtils;
			/**
			* Set of classGroupIds in following format:
			* `{importantModifier}{variantModifiers}{classGroupId}`
			* @example 'float'
			* @example 'hover:focus:bg-color'
			* @example 'md:!pr'
			*/
			const classGroupsInConflict = [];
			const classNames = classList.trim().split(SPLIT_CLASSES_REGEX);
			let result = "";
			for (let index = classNames.length - 1; index >= 0; index -= 1) {
				const originalClassName = classNames[index];
				const { isExternal, modifiers, hasImportantModifier, baseClassName, maybePostfixModifierPosition } = parseClassName(originalClassName);
				if (isExternal) {
					result = originalClassName + (result.length > 0 ? " " + result : result);
					continue;
				}
				let hasPostfixModifier = !!maybePostfixModifierPosition;
				let classGroupId;
				if (hasPostfixModifier) {
					classGroupId = getClassGroupId(baseClassName.substring(0, maybePostfixModifierPosition));
					const classGroupIdWithPostfix = classGroupId && postfixLookupClassGroupIds[classGroupId] ? getClassGroupId(baseClassName) : void 0;
					if (classGroupIdWithPostfix && classGroupIdWithPostfix !== classGroupId) {
						classGroupId = classGroupIdWithPostfix;
						hasPostfixModifier = false;
					}
				} else classGroupId = getClassGroupId(baseClassName);
				if (!classGroupId) {
					if (!hasPostfixModifier) {
						result = originalClassName + (result.length > 0 ? " " + result : result);
						continue;
					}
					classGroupId = getClassGroupId(baseClassName);
					if (!classGroupId) {
						result = originalClassName + (result.length > 0 ? " " + result : result);
						continue;
					}
					hasPostfixModifier = false;
				}
				const variantModifier = modifiers.length === 0 ? "" : modifiers.length === 1 ? modifiers[0] : sortModifiers(modifiers).join(":");
				const modifierId = hasImportantModifier ? variantModifier + IMPORTANT_MODIFIER : variantModifier;
				const classId = modifierId + classGroupId;
				if (classGroupsInConflict.indexOf(classId) > -1) continue;
				classGroupsInConflict.push(classId);
				const conflictGroups = getConflictingClassGroupIds(classGroupId, hasPostfixModifier);
				for (let i = 0; i < conflictGroups.length; ++i) {
					const group = conflictGroups[i];
					classGroupsInConflict.push(modifierId + group);
				}
				result = originalClassName + (result.length > 0 ? " " + result : result);
			}
			return result;
		};
		/**
		* The code in this file is copied from https://github.com/lukeed/clsx and modified to suit the needs of tailwind-merge better.
		*
		* Specifically:
		* - Runtime code from https://github.com/lukeed/clsx/blob/v1.2.1/src/index.js
		* - TypeScript types from https://github.com/lukeed/clsx/blob/v1.2.1/clsx.d.ts
		*
		* Original code has MIT license: Copyright (c) Luke Edwards <luke.edwards05@gmail.com> (lukeed.com)
		*/
		const twJoin = (...classLists) => {
			let index = 0;
			let argument;
			let resolvedValue;
			let string = "";
			while (index < classLists.length) if (argument = classLists[index++]) {
				if (resolvedValue = toValue(argument)) {
					string && (string += " ");
					string += resolvedValue;
				}
			}
			return string;
		};
		const toValue = (mix) => {
			if (typeof mix === "string") return mix;
			let resolvedValue;
			let string = "";
			for (let k = 0; k < mix.length; k++) if (mix[k]) {
				if (resolvedValue = toValue(mix[k])) {
					string && (string += " ");
					string += resolvedValue;
				}
			}
			return string;
		};
		const createTailwindMerge = (createConfigFirst, ...createConfigRest) => {
			let configUtils;
			let cacheGet;
			let cacheSet;
			let functionToCall;
			const initTailwindMerge = (classList) => {
				const config = createConfigRest.reduce((previousConfig, createConfigCurrent) => createConfigCurrent(previousConfig), createConfigFirst());
				configUtils = createConfigUtils(config);
				cacheGet = configUtils.cache.get;
				cacheSet = configUtils.cache.set;
				functionToCall = tailwindMerge;
				return tailwindMerge(classList);
			};
			const tailwindMerge = (classList) => {
				const cachedResult = cacheGet(classList);
				if (cachedResult) return cachedResult;
				const result = mergeClassList(classList, configUtils);
				cacheSet(classList, result);
				return result;
			};
			functionToCall = initTailwindMerge;
			return (...args) => functionToCall(twJoin(...args));
		};
		const fallbackThemeArr = [];
		const fromTheme = (key) => {
			const themeGetter = (theme) => theme[key] || fallbackThemeArr;
			themeGetter.isThemeGetter = true;
			return themeGetter;
		};
		const arbitraryValueRegex = /^\[(?:(\w[\w-]*):)?(.+)\]$/i;
		const arbitraryVariableRegex = /^\((?:(\w[\w-]*):)?(.+)\)$/i;
		const fractionRegex = /^\d+(?:\.\d+)?\/\d+(?:\.\d+)?$/;
		const tshirtUnitRegex = /^(\d+(\.\d+)?)?(xs|sm|md|lg|xl)$/;
		const lengthUnitRegex = /\d+(%|px|r?em|[sdl]?v([hwib]|min|max)|pt|pc|in|cm|mm|cap|ch|ex|r?lh|cq(w|h|i|b|min|max))|\b(calc|min|max|clamp)\(.+\)|^0$/;
		const colorFunctionRegex = /^(rgba?|hsla?|hwb|(ok)?(lab|lch)|color-mix)\(.+\)$/;
		const shadowRegex = /^(inset_)?-?((\d+)?\.?(\d+)[a-z]+|0)_-?((\d+)?\.?(\d+)[a-z]+|0)/;
		const imageRegex = /^(url|image|image-set|cross-fade|element|(repeating-)?(linear|radial|conic)-gradient)\(.+\)$/;
		const isFraction = (value) => fractionRegex.test(value);
		const isNumber = (value) => !!value && !Number.isNaN(Number(value));
		const isInteger = (value) => !!value && Number.isInteger(Number(value));
		const isPercent = (value) => value.endsWith("%") && isNumber(value.slice(0, -1));
		const isTshirtSize = (value) => tshirtUnitRegex.test(value);
		const isAny = () => true;
		const isLengthOnly = (value) => lengthUnitRegex.test(value) && !colorFunctionRegex.test(value);
		const isNever = () => false;
		const isShadow = (value) => shadowRegex.test(value);
		const isImage = (value) => imageRegex.test(value);
		const isAnyNonArbitrary = (value) => !isArbitraryValue(value) && !isArbitraryVariable(value);
		const isNamedContainerQuery = (value) => value.startsWith("@container") && (value[10] === "/" && value[11] !== void 0 || value[11] === "s" && value[16] !== void 0 && value.startsWith("-size/", 10) || value[11] === "n" && value[18] !== void 0 && value.startsWith("-normal/", 10));
		const isArbitrarySize = (value) => getIsArbitraryValue(value, isLabelSize, isNever);
		const isArbitraryValue = (value) => arbitraryValueRegex.test(value);
		const isArbitraryLength = (value) => getIsArbitraryValue(value, isLabelLength, isLengthOnly);
		const isArbitraryNumber = (value) => getIsArbitraryValue(value, isLabelNumber, isNumber);
		const isArbitraryWeight = (value) => getIsArbitraryValue(value, isLabelWeight, isAny);
		const isArbitraryFamilyName = (value) => getIsArbitraryValue(value, isLabelFamilyName, isNever);
		const isArbitraryPosition = (value) => getIsArbitraryValue(value, isLabelPosition, isNever);
		const isArbitraryImage = (value) => getIsArbitraryValue(value, isLabelImage, isImage);
		const isArbitraryShadow = (value) => getIsArbitraryValue(value, isLabelShadow, isShadow);
		const isArbitraryVariable = (value) => arbitraryVariableRegex.test(value);
		const isArbitraryVariableLength = (value) => getIsArbitraryVariable(value, isLabelLength);
		const isArbitraryVariableFamilyName = (value) => getIsArbitraryVariable(value, isLabelFamilyName);
		const isArbitraryVariablePosition = (value) => getIsArbitraryVariable(value, isLabelPosition);
		const isArbitraryVariableSize = (value) => getIsArbitraryVariable(value, isLabelSize);
		const isArbitraryVariableImage = (value) => getIsArbitraryVariable(value, isLabelImage);
		const isArbitraryVariableShadow = (value) => getIsArbitraryVariable(value, isLabelShadow, true);
		const isArbitraryVariableWeight = (value) => getIsArbitraryVariable(value, isLabelWeight, true);
		const getIsArbitraryValue = (value, testLabel, testValue) => {
			const result = arbitraryValueRegex.exec(value);
			if (result) {
				if (result[1]) return testLabel(result[1]);
				return testValue(result[2]);
			}
			return false;
		};
		const getIsArbitraryVariable = (value, testLabel, shouldMatchNoLabel = false) => {
			const result = arbitraryVariableRegex.exec(value);
			if (result) {
				if (result[1]) return testLabel(result[1]);
				return shouldMatchNoLabel;
			}
			return false;
		};
		const isLabelPosition = (label) => label === "position" || label === "percentage";
		const isLabelImage = (label) => label === "image" || label === "url";
		const isLabelSize = (label) => label === "length" || label === "size" || label === "bg-size";
		const isLabelLength = (label) => label === "length";
		const isLabelNumber = (label) => label === "number";
		const isLabelFamilyName = (label) => label === "family-name";
		const isLabelWeight = (label) => label === "number" || label === "weight";
		const isLabelShadow = (label) => label === "shadow";
		const getDefaultConfig = () => {
			/**
			* Theme getters for theme variable namespaces
			* @see https://tailwindcss.com/docs/theme#theme-variable-namespaces
			*/
			const themeColor = fromTheme("color");
			const themeFont = fromTheme("font");
			const themeText = fromTheme("text");
			const themeFontWeight = fromTheme("font-weight");
			const themeTracking = fromTheme("tracking");
			const themeLeading = fromTheme("leading");
			const themeBreakpoint = fromTheme("breakpoint");
			const themeContainer = fromTheme("container");
			const themeSpacing = fromTheme("spacing");
			const themeRadius = fromTheme("radius");
			const themeShadow = fromTheme("shadow");
			const themeInsetShadow = fromTheme("inset-shadow");
			const themeTextShadow = fromTheme("text-shadow");
			const themeDropShadow = fromTheme("drop-shadow");
			const themeBlur = fromTheme("blur");
			const themePerspective = fromTheme("perspective");
			const themeAspect = fromTheme("aspect");
			const themeEase = fromTheme("ease");
			const themeAnimate = fromTheme("animate");
			/**
			* Helpers to avoid repeating the same scales
			*
			* We use functions that create a new array every time they're called instead of static arrays.
			* This ensures that users who modify any scale by mutating the array (e.g. with `array.push(element)`) don't accidentally mutate arrays in other parts of the config.
			*/
			const scaleBreak = () => [
				"auto",
				"avoid",
				"all",
				"avoid-page",
				"page",
				"left",
				"right",
				"column"
			];
			const scalePosition = () => [
				"center",
				"top",
				"bottom",
				"left",
				"right",
				"top-left",
				"left-top",
				"top-right",
				"right-top",
				"bottom-right",
				"right-bottom",
				"bottom-left",
				"left-bottom"
			];
			const scalePositionWithArbitrary = () => [
				...scalePosition(),
				isArbitraryVariable,
				isArbitraryValue
			];
			const scaleOverflow = () => [
				"auto",
				"hidden",
				"clip",
				"visible",
				"scroll"
			];
			const scaleOverscroll = () => [
				"auto",
				"contain",
				"none"
			];
			const scaleUnambiguousSpacing = () => [
				isArbitraryVariable,
				isArbitraryValue,
				themeSpacing
			];
			const scaleInset = () => [
				isFraction,
				"full",
				"auto",
				...scaleUnambiguousSpacing()
			];
			const scaleGridTemplateColsRows = () => [
				isInteger,
				"none",
				"subgrid",
				isArbitraryVariable,
				isArbitraryValue
			];
			const scaleGridColRowStartAndEnd = () => [
				"auto",
				{ span: [
					"full",
					isInteger,
					isArbitraryVariable,
					isArbitraryValue
				] },
				isInteger,
				isArbitraryVariable,
				isArbitraryValue
			];
			const scaleGridColRowStartOrEnd = () => [
				isInteger,
				"auto",
				isArbitraryVariable,
				isArbitraryValue
			];
			const scaleGridAutoColsRows = () => [
				"auto",
				"min",
				"max",
				"fr",
				isArbitraryVariable,
				isArbitraryValue
			];
			const scaleAlignPrimaryAxis = () => [
				"start",
				"end",
				"center",
				"between",
				"around",
				"evenly",
				"stretch",
				"baseline",
				"center-safe",
				"end-safe"
			];
			const scaleAlignSecondaryAxis = () => [
				"start",
				"end",
				"center",
				"stretch",
				"center-safe",
				"end-safe"
			];
			const scaleMargin = () => ["auto", ...scaleUnambiguousSpacing()];
			const scaleSizing = () => [
				isFraction,
				"auto",
				"full",
				"dvw",
				"dvh",
				"lvw",
				"lvh",
				"svw",
				"svh",
				"min",
				"max",
				"fit",
				...scaleUnambiguousSpacing()
			];
			const scaleSizingInline = () => [
				isFraction,
				"screen",
				"full",
				"dvw",
				"lvw",
				"svw",
				"min",
				"max",
				"fit",
				...scaleUnambiguousSpacing()
			];
			const scaleSizingBlock = () => [
				isFraction,
				"screen",
				"full",
				"lh",
				"dvh",
				"lvh",
				"svh",
				"min",
				"max",
				"fit",
				...scaleUnambiguousSpacing()
			];
			const scaleColor = () => [
				themeColor,
				isArbitraryVariable,
				isArbitraryValue
			];
			const scaleBgPosition = () => [
				...scalePosition(),
				isArbitraryVariablePosition,
				isArbitraryPosition,
				{ position: [isArbitraryVariable, isArbitraryValue] }
			];
			const scaleBgRepeat = () => ["no-repeat", { repeat: [
				"",
				"x",
				"y",
				"space",
				"round"
			] }];
			const scaleBgSize = () => [
				"auto",
				"cover",
				"contain",
				isArbitraryVariableSize,
				isArbitrarySize,
				{ size: [isArbitraryVariable, isArbitraryValue] }
			];
			const scaleGradientStopPosition = () => [
				isPercent,
				isArbitraryVariableLength,
				isArbitraryLength
			];
			const scaleRadius = () => [
				"",
				"none",
				"full",
				themeRadius,
				isArbitraryVariable,
				isArbitraryValue
			];
			const scaleBorderWidth = () => [
				"",
				isNumber,
				isArbitraryVariableLength,
				isArbitraryLength
			];
			const scaleLineStyle = () => [
				"solid",
				"dashed",
				"dotted",
				"double"
			];
			const scaleBlendMode = () => [
				"normal",
				"multiply",
				"screen",
				"overlay",
				"darken",
				"lighten",
				"color-dodge",
				"color-burn",
				"hard-light",
				"soft-light",
				"difference",
				"exclusion",
				"hue",
				"saturation",
				"color",
				"luminosity"
			];
			const scaleMaskImagePosition = () => [
				isNumber,
				isPercent,
				isArbitraryVariablePosition,
				isArbitraryPosition
			];
			const scaleBlur = () => [
				"",
				"none",
				themeBlur,
				isArbitraryVariable,
				isArbitraryValue
			];
			const scaleRotate = () => [
				"none",
				isNumber,
				isArbitraryVariable,
				isArbitraryValue
			];
			const scaleScale = () => [
				"none",
				isNumber,
				isArbitraryVariable,
				isArbitraryValue
			];
			const scaleSkew = () => [
				isNumber,
				isArbitraryVariable,
				isArbitraryValue
			];
			const scaleTranslate = () => [
				isFraction,
				"full",
				...scaleUnambiguousSpacing()
			];
			return {
				cacheSize: 500,
				theme: {
					animate: [
						"spin",
						"ping",
						"pulse",
						"bounce"
					],
					aspect: ["video"],
					blur: [isTshirtSize],
					breakpoint: [isTshirtSize],
					color: [isAny],
					container: [isTshirtSize],
					"drop-shadow": [isTshirtSize],
					ease: [
						"in",
						"out",
						"in-out"
					],
					font: [isAnyNonArbitrary],
					"font-weight": [
						"thin",
						"extralight",
						"light",
						"normal",
						"medium",
						"semibold",
						"bold",
						"extrabold",
						"black"
					],
					"inset-shadow": [isTshirtSize],
					leading: [
						"none",
						"tight",
						"snug",
						"normal",
						"relaxed",
						"loose"
					],
					perspective: [
						"dramatic",
						"near",
						"normal",
						"midrange",
						"distant",
						"none"
					],
					radius: [isTshirtSize],
					shadow: [isTshirtSize],
					spacing: ["px", isNumber],
					text: [isTshirtSize],
					"text-shadow": [isTshirtSize],
					tracking: [
						"tighter",
						"tight",
						"normal",
						"wide",
						"wider",
						"widest"
					]
				},
				classGroups: {
					/**
					* Aspect Ratio
					* @see https://tailwindcss.com/docs/aspect-ratio
					*/
					aspect: [{ aspect: [
						"auto",
						"square",
						isFraction,
						isArbitraryValue,
						isArbitraryVariable,
						themeAspect
					] }],
					/**
					* Container
					* @see https://tailwindcss.com/docs/container
					* @deprecated since Tailwind CSS v4.0.0
					*/
					container: ["container"],
					/**
					* Container Type
					* @see https://tailwindcss.com/docs/responsive-design#container-queries
					*/
					"container-type": [{ "@container": [
						"",
						"normal",
						"size",
						isArbitraryVariable,
						isArbitraryValue
					] }],
					/**
					* Container Name
					* @see https://tailwindcss.com/docs/responsive-design#named-containers
					*/
					"container-named": [isNamedContainerQuery],
					/**
					* Columns
					* @see https://tailwindcss.com/docs/columns
					*/
					columns: [{ columns: [
						isNumber,
						isArbitraryValue,
						isArbitraryVariable,
						themeContainer
					] }],
					/**
					* Break After
					* @see https://tailwindcss.com/docs/break-after
					*/
					"break-after": [{ "break-after": scaleBreak() }],
					/**
					* Break Before
					* @see https://tailwindcss.com/docs/break-before
					*/
					"break-before": [{ "break-before": scaleBreak() }],
					/**
					* Break Inside
					* @see https://tailwindcss.com/docs/break-inside
					*/
					"break-inside": [{ "break-inside": [
						"auto",
						"avoid",
						"avoid-page",
						"avoid-column"
					] }],
					/**
					* Box Decoration Break
					* @see https://tailwindcss.com/docs/box-decoration-break
					*/
					"box-decoration": [{ "box-decoration": ["slice", "clone"] }],
					/**
					* Box Sizing
					* @see https://tailwindcss.com/docs/box-sizing
					*/
					box: [{ box: ["border", "content"] }],
					/**
					* Display
					* @see https://tailwindcss.com/docs/display
					*/
					display: [
						"block",
						"inline-block",
						"inline",
						"flex",
						"inline-flex",
						"table",
						"inline-table",
						"table-caption",
						"table-cell",
						"table-column",
						"table-column-group",
						"table-footer-group",
						"table-header-group",
						"table-row-group",
						"table-row",
						"flow-root",
						"grid",
						"inline-grid",
						"contents",
						"list-item",
						"hidden"
					],
					/**
					* Screen Reader Only
					* @see https://tailwindcss.com/docs/display#screen-reader-only
					*/
					sr: ["sr-only", "not-sr-only"],
					/**
					* Floats
					* @see https://tailwindcss.com/docs/float
					*/
					float: [{ float: [
						"right",
						"left",
						"none",
						"start",
						"end"
					] }],
					/**
					* Clear
					* @see https://tailwindcss.com/docs/clear
					*/
					clear: [{ clear: [
						"left",
						"right",
						"both",
						"none",
						"start",
						"end"
					] }],
					/**
					* Isolation
					* @see https://tailwindcss.com/docs/isolation
					*/
					isolation: ["isolate", "isolation-auto"],
					/**
					* Object Fit
					* @see https://tailwindcss.com/docs/object-fit
					*/
					"object-fit": [{ object: [
						"contain",
						"cover",
						"fill",
						"none",
						"scale-down"
					] }],
					/**
					* Object Position
					* @see https://tailwindcss.com/docs/object-position
					*/
					"object-position": [{ object: scalePositionWithArbitrary() }],
					/**
					* Overflow
					* @see https://tailwindcss.com/docs/overflow
					*/
					overflow: [{ overflow: scaleOverflow() }],
					/**
					* Overflow X
					* @see https://tailwindcss.com/docs/overflow
					*/
					"overflow-x": [{ "overflow-x": scaleOverflow() }],
					/**
					* Overflow Y
					* @see https://tailwindcss.com/docs/overflow
					*/
					"overflow-y": [{ "overflow-y": scaleOverflow() }],
					/**
					* Overscroll Behavior
					* @see https://tailwindcss.com/docs/overscroll-behavior
					*/
					overscroll: [{ overscroll: scaleOverscroll() }],
					/**
					* Overscroll Behavior X
					* @see https://tailwindcss.com/docs/overscroll-behavior
					*/
					"overscroll-x": [{ "overscroll-x": scaleOverscroll() }],
					/**
					* Overscroll Behavior Y
					* @see https://tailwindcss.com/docs/overscroll-behavior
					*/
					"overscroll-y": [{ "overscroll-y": scaleOverscroll() }],
					/**
					* Position
					* @see https://tailwindcss.com/docs/position
					*/
					position: [
						"static",
						"fixed",
						"absolute",
						"relative",
						"sticky"
					],
					/**
					* Inset
					* @see https://tailwindcss.com/docs/top-right-bottom-left
					*/
					inset: [{ inset: scaleInset() }],
					/**
					* Inset Inline
					* @see https://tailwindcss.com/docs/top-right-bottom-left
					*/
					"inset-x": [{ "inset-x": scaleInset() }],
					/**
					* Inset Block
					* @see https://tailwindcss.com/docs/top-right-bottom-left
					*/
					"inset-y": [{ "inset-y": scaleInset() }],
					/**
					* Inset Inline Start
					* @see https://tailwindcss.com/docs/top-right-bottom-left
					* @todo class group will be renamed to `inset-s` in next major release
					*/
					start: [{
						"inset-s": scaleInset(),
						/**
						* @deprecated since Tailwind CSS v4.2.0 in favor of `inset-s-*` utilities.
						* @see https://github.com/tailwindlabs/tailwindcss/pull/19613
						*/
						start: scaleInset()
					}],
					/**
					* Inset Inline End
					* @see https://tailwindcss.com/docs/top-right-bottom-left
					* @todo class group will be renamed to `inset-e` in next major release
					*/
					end: [{
						"inset-e": scaleInset(),
						/**
						* @deprecated since Tailwind CSS v4.2.0 in favor of `inset-e-*` utilities.
						* @see https://github.com/tailwindlabs/tailwindcss/pull/19613
						*/
						end: scaleInset()
					}],
					/**
					* Inset Block Start
					* @see https://tailwindcss.com/docs/top-right-bottom-left
					*/
					"inset-bs": [{ "inset-bs": scaleInset() }],
					/**
					* Inset Block End
					* @see https://tailwindcss.com/docs/top-right-bottom-left
					*/
					"inset-be": [{ "inset-be": scaleInset() }],
					/**
					* Top
					* @see https://tailwindcss.com/docs/top-right-bottom-left
					*/
					top: [{ top: scaleInset() }],
					/**
					* Right
					* @see https://tailwindcss.com/docs/top-right-bottom-left
					*/
					right: [{ right: scaleInset() }],
					/**
					* Bottom
					* @see https://tailwindcss.com/docs/top-right-bottom-left
					*/
					bottom: [{ bottom: scaleInset() }],
					/**
					* Left
					* @see https://tailwindcss.com/docs/top-right-bottom-left
					*/
					left: [{ left: scaleInset() }],
					/**
					* Visibility
					* @see https://tailwindcss.com/docs/visibility
					*/
					visibility: [
						"visible",
						"invisible",
						"collapse"
					],
					/**
					* Z-Index
					* @see https://tailwindcss.com/docs/z-index
					*/
					z: [{ z: [
						isInteger,
						"auto",
						isArbitraryVariable,
						isArbitraryValue
					] }],
					/**
					* Flex Basis
					* @see https://tailwindcss.com/docs/flex-basis
					*/
					basis: [{ basis: [
						isFraction,
						"full",
						"auto",
						themeContainer,
						...scaleUnambiguousSpacing()
					] }],
					/**
					* Flex Direction
					* @see https://tailwindcss.com/docs/flex-direction
					*/
					"flex-direction": [{ flex: [
						"row",
						"row-reverse",
						"col",
						"col-reverse"
					] }],
					/**
					* Flex Wrap
					* @see https://tailwindcss.com/docs/flex-wrap
					*/
					"flex-wrap": [{ flex: [
						"nowrap",
						"wrap",
						"wrap-reverse"
					] }],
					/**
					* Flex
					* @see https://tailwindcss.com/docs/flex
					*/
					flex: [{ flex: [
						isNumber,
						isFraction,
						"auto",
						"initial",
						"none",
						isArbitraryValue
					] }],
					/**
					* Flex Grow
					* @see https://tailwindcss.com/docs/flex-grow
					*/
					grow: [{ grow: [
						"",
						isNumber,
						isArbitraryVariable,
						isArbitraryValue
					] }],
					/**
					* Flex Shrink
					* @see https://tailwindcss.com/docs/flex-shrink
					*/
					shrink: [{ shrink: [
						"",
						isNumber,
						isArbitraryVariable,
						isArbitraryValue
					] }],
					/**
					* Order
					* @see https://tailwindcss.com/docs/order
					*/
					order: [{ order: [
						isInteger,
						"first",
						"last",
						"none",
						isArbitraryVariable,
						isArbitraryValue
					] }],
					/**
					* Grid Template Columns
					* @see https://tailwindcss.com/docs/grid-template-columns
					*/
					"grid-cols": [{ "grid-cols": scaleGridTemplateColsRows() }],
					/**
					* Grid Column Start / End
					* @see https://tailwindcss.com/docs/grid-column
					*/
					"col-start-end": [{ col: scaleGridColRowStartAndEnd() }],
					/**
					* Grid Column Start
					* @see https://tailwindcss.com/docs/grid-column
					*/
					"col-start": [{ "col-start": scaleGridColRowStartOrEnd() }],
					/**
					* Grid Column End
					* @see https://tailwindcss.com/docs/grid-column
					*/
					"col-end": [{ "col-end": scaleGridColRowStartOrEnd() }],
					/**
					* Grid Template Rows
					* @see https://tailwindcss.com/docs/grid-template-rows
					*/
					"grid-rows": [{ "grid-rows": scaleGridTemplateColsRows() }],
					/**
					* Grid Row Start / End
					* @see https://tailwindcss.com/docs/grid-row
					*/
					"row-start-end": [{ row: scaleGridColRowStartAndEnd() }],
					/**
					* Grid Row Start
					* @see https://tailwindcss.com/docs/grid-row
					*/
					"row-start": [{ "row-start": scaleGridColRowStartOrEnd() }],
					/**
					* Grid Row End
					* @see https://tailwindcss.com/docs/grid-row
					*/
					"row-end": [{ "row-end": scaleGridColRowStartOrEnd() }],
					/**
					* Grid Auto Flow
					* @see https://tailwindcss.com/docs/grid-auto-flow
					*/
					"grid-flow": [{ "grid-flow": [
						"row",
						"col",
						"dense",
						"row-dense",
						"col-dense"
					] }],
					/**
					* Grid Auto Columns
					* @see https://tailwindcss.com/docs/grid-auto-columns
					*/
					"auto-cols": [{ "auto-cols": scaleGridAutoColsRows() }],
					/**
					* Grid Auto Rows
					* @see https://tailwindcss.com/docs/grid-auto-rows
					*/
					"auto-rows": [{ "auto-rows": scaleGridAutoColsRows() }],
					/**
					* Gap
					* @see https://tailwindcss.com/docs/gap
					*/
					gap: [{ gap: scaleUnambiguousSpacing() }],
					/**
					* Gap X
					* @see https://tailwindcss.com/docs/gap
					*/
					"gap-x": [{ "gap-x": scaleUnambiguousSpacing() }],
					/**
					* Gap Y
					* @see https://tailwindcss.com/docs/gap
					*/
					"gap-y": [{ "gap-y": scaleUnambiguousSpacing() }],
					/**
					* Justify Content
					* @see https://tailwindcss.com/docs/justify-content
					*/
					"justify-content": [{ justify: [...scaleAlignPrimaryAxis(), "normal"] }],
					/**
					* Justify Items
					* @see https://tailwindcss.com/docs/justify-items
					*/
					"justify-items": [{ "justify-items": [...scaleAlignSecondaryAxis(), "normal"] }],
					/**
					* Justify Self
					* @see https://tailwindcss.com/docs/justify-self
					*/
					"justify-self": [{ "justify-self": ["auto", ...scaleAlignSecondaryAxis()] }],
					/**
					* Align Content
					* @see https://tailwindcss.com/docs/align-content
					*/
					"align-content": [{ content: ["normal", ...scaleAlignPrimaryAxis()] }],
					/**
					* Align Items
					* @see https://tailwindcss.com/docs/align-items
					*/
					"align-items": [{ items: [...scaleAlignSecondaryAxis(), { baseline: ["", "last"] }] }],
					/**
					* Align Self
					* @see https://tailwindcss.com/docs/align-self
					*/
					"align-self": [{ self: [
						"auto",
						...scaleAlignSecondaryAxis(),
						{ baseline: ["", "last"] }
					] }],
					/**
					* Place Content
					* @see https://tailwindcss.com/docs/place-content
					*/
					"place-content": [{ "place-content": scaleAlignPrimaryAxis() }],
					/**
					* Place Items
					* @see https://tailwindcss.com/docs/place-items
					*/
					"place-items": [{ "place-items": [...scaleAlignSecondaryAxis(), "baseline"] }],
					/**
					* Place Self
					* @see https://tailwindcss.com/docs/place-self
					*/
					"place-self": [{ "place-self": ["auto", ...scaleAlignSecondaryAxis()] }],
					/**
					* Padding
					* @see https://tailwindcss.com/docs/padding
					*/
					p: [{ p: scaleUnambiguousSpacing() }],
					/**
					* Padding Inline
					* @see https://tailwindcss.com/docs/padding
					*/
					px: [{ px: scaleUnambiguousSpacing() }],
					/**
					* Padding Block
					* @see https://tailwindcss.com/docs/padding
					*/
					py: [{ py: scaleUnambiguousSpacing() }],
					/**
					* Padding Inline Start
					* @see https://tailwindcss.com/docs/padding
					*/
					ps: [{ ps: scaleUnambiguousSpacing() }],
					/**
					* Padding Inline End
					* @see https://tailwindcss.com/docs/padding
					*/
					pe: [{ pe: scaleUnambiguousSpacing() }],
					/**
					* Padding Block Start
					* @see https://tailwindcss.com/docs/padding
					*/
					pbs: [{ pbs: scaleUnambiguousSpacing() }],
					/**
					* Padding Block End
					* @see https://tailwindcss.com/docs/padding
					*/
					pbe: [{ pbe: scaleUnambiguousSpacing() }],
					/**
					* Padding Top
					* @see https://tailwindcss.com/docs/padding
					*/
					pt: [{ pt: scaleUnambiguousSpacing() }],
					/**
					* Padding Right
					* @see https://tailwindcss.com/docs/padding
					*/
					pr: [{ pr: scaleUnambiguousSpacing() }],
					/**
					* Padding Bottom
					* @see https://tailwindcss.com/docs/padding
					*/
					pb: [{ pb: scaleUnambiguousSpacing() }],
					/**
					* Padding Left
					* @see https://tailwindcss.com/docs/padding
					*/
					pl: [{ pl: scaleUnambiguousSpacing() }],
					/**
					* Margin
					* @see https://tailwindcss.com/docs/margin
					*/
					m: [{ m: scaleMargin() }],
					/**
					* Margin Inline
					* @see https://tailwindcss.com/docs/margin
					*/
					mx: [{ mx: scaleMargin() }],
					/**
					* Margin Block
					* @see https://tailwindcss.com/docs/margin
					*/
					my: [{ my: scaleMargin() }],
					/**
					* Margin Inline Start
					* @see https://tailwindcss.com/docs/margin
					*/
					ms: [{ ms: scaleMargin() }],
					/**
					* Margin Inline End
					* @see https://tailwindcss.com/docs/margin
					*/
					me: [{ me: scaleMargin() }],
					/**
					* Margin Block Start
					* @see https://tailwindcss.com/docs/margin
					*/
					mbs: [{ mbs: scaleMargin() }],
					/**
					* Margin Block End
					* @see https://tailwindcss.com/docs/margin
					*/
					mbe: [{ mbe: scaleMargin() }],
					/**
					* Margin Top
					* @see https://tailwindcss.com/docs/margin
					*/
					mt: [{ mt: scaleMargin() }],
					/**
					* Margin Right
					* @see https://tailwindcss.com/docs/margin
					*/
					mr: [{ mr: scaleMargin() }],
					/**
					* Margin Bottom
					* @see https://tailwindcss.com/docs/margin
					*/
					mb: [{ mb: scaleMargin() }],
					/**
					* Margin Left
					* @see https://tailwindcss.com/docs/margin
					*/
					ml: [{ ml: scaleMargin() }],
					/**
					* Space Between X
					* @see https://tailwindcss.com/docs/margin#adding-space-between-children
					*/
					"space-x": [{ "space-x": scaleUnambiguousSpacing() }],
					/**
					* Space Between X Reverse
					* @see https://tailwindcss.com/docs/margin#adding-space-between-children
					*/
					"space-x-reverse": ["space-x-reverse"],
					/**
					* Space Between Y
					* @see https://tailwindcss.com/docs/margin#adding-space-between-children
					*/
					"space-y": [{ "space-y": scaleUnambiguousSpacing() }],
					/**
					* Space Between Y Reverse
					* @see https://tailwindcss.com/docs/margin#adding-space-between-children
					*/
					"space-y-reverse": ["space-y-reverse"],
					/**
					* Size
					* @see https://tailwindcss.com/docs/width#setting-both-width-and-height
					*/
					size: [{ size: scaleSizing() }],
					/**
					* Inline Size
					* @see https://tailwindcss.com/docs/width
					*/
					"inline-size": [{ inline: ["auto", ...scaleSizingInline()] }],
					/**
					* Min-Inline Size
					* @see https://tailwindcss.com/docs/min-width
					*/
					"min-inline-size": [{ "min-inline": ["auto", ...scaleSizingInline()] }],
					/**
					* Max-Inline Size
					* @see https://tailwindcss.com/docs/max-width
					*/
					"max-inline-size": [{ "max-inline": ["none", ...scaleSizingInline()] }],
					/**
					* Block Size
					* @see https://tailwindcss.com/docs/height
					*/
					"block-size": [{ block: ["auto", ...scaleSizingBlock()] }],
					/**
					* Min-Block Size
					* @see https://tailwindcss.com/docs/min-height
					*/
					"min-block-size": [{ "min-block": ["auto", ...scaleSizingBlock()] }],
					/**
					* Max-Block Size
					* @see https://tailwindcss.com/docs/max-height
					*/
					"max-block-size": [{ "max-block": ["none", ...scaleSizingBlock()] }],
					/**
					* Width
					* @see https://tailwindcss.com/docs/width
					*/
					w: [{ w: [
						themeContainer,
						"screen",
						...scaleSizing()
					] }],
					/**
					* Min-Width
					* @see https://tailwindcss.com/docs/min-width
					*/
					"min-w": [{ "min-w": [
						themeContainer,
						"screen",
						"none",
						...scaleSizing()
					] }],
					/**
					* Max-Width
					* @see https://tailwindcss.com/docs/max-width
					*/
					"max-w": [{ "max-w": [
						themeContainer,
						"screen",
						"none",
						"prose",
						{ screen: [themeBreakpoint] },
						...scaleSizing()
					] }],
					/**
					* Height
					* @see https://tailwindcss.com/docs/height
					*/
					h: [{ h: [
						"screen",
						"lh",
						...scaleSizing()
					] }],
					/**
					* Min-Height
					* @see https://tailwindcss.com/docs/min-height
					*/
					"min-h": [{ "min-h": [
						"screen",
						"lh",
						"none",
						...scaleSizing()
					] }],
					/**
					* Max-Height
					* @see https://tailwindcss.com/docs/max-height
					*/
					"max-h": [{ "max-h": [
						"screen",
						"lh",
						...scaleSizing()
					] }],
					/**
					* Font Size
					* @see https://tailwindcss.com/docs/font-size
					*/
					"font-size": [{ text: [
						"base",
						themeText,
						isArbitraryVariableLength,
						isArbitraryLength
					] }],
					/**
					* Font Smoothing
					* @see https://tailwindcss.com/docs/font-smoothing
					*/
					"font-smoothing": ["antialiased", "subpixel-antialiased"],
					/**
					* Font Style
					* @see https://tailwindcss.com/docs/font-style
					*/
					"font-style": ["italic", "not-italic"],
					/**
					* Font Weight
					* @see https://tailwindcss.com/docs/font-weight
					*/
					"font-weight": [{ font: [
						themeFontWeight,
						isArbitraryVariableWeight,
						isArbitraryWeight
					] }],
					/**
					* Font Stretch
					* @see https://tailwindcss.com/docs/font-stretch
					*/
					"font-stretch": [{ "font-stretch": [
						"ultra-condensed",
						"extra-condensed",
						"condensed",
						"semi-condensed",
						"normal",
						"semi-expanded",
						"expanded",
						"extra-expanded",
						"ultra-expanded",
						isPercent,
						isArbitraryValue
					] }],
					/**
					* Font Family
					* @see https://tailwindcss.com/docs/font-family
					*/
					"font-family": [{ font: [
						isArbitraryVariableFamilyName,
						isArbitraryFamilyName,
						themeFont
					] }],
					/**
					* Font Feature Settings
					* @see https://tailwindcss.com/docs/font-feature-settings
					*/
					"font-features": [{ "font-features": [isArbitraryValue] }],
					/**
					* Font Variant Numeric
					* @see https://tailwindcss.com/docs/font-variant-numeric
					*/
					"fvn-normal": ["normal-nums"],
					/**
					* Font Variant Numeric
					* @see https://tailwindcss.com/docs/font-variant-numeric
					*/
					"fvn-ordinal": ["ordinal"],
					/**
					* Font Variant Numeric
					* @see https://tailwindcss.com/docs/font-variant-numeric
					*/
					"fvn-slashed-zero": ["slashed-zero"],
					/**
					* Font Variant Numeric
					* @see https://tailwindcss.com/docs/font-variant-numeric
					*/
					"fvn-figure": ["lining-nums", "oldstyle-nums"],
					/**
					* Font Variant Numeric
					* @see https://tailwindcss.com/docs/font-variant-numeric
					*/
					"fvn-spacing": ["proportional-nums", "tabular-nums"],
					/**
					* Font Variant Numeric
					* @see https://tailwindcss.com/docs/font-variant-numeric
					*/
					"fvn-fraction": ["diagonal-fractions", "stacked-fractions"],
					/**
					* Letter Spacing
					* @see https://tailwindcss.com/docs/letter-spacing
					*/
					tracking: [{ tracking: [
						themeTracking,
						isArbitraryVariable,
						isArbitraryValue
					] }],
					/**
					* Line Clamp
					* @see https://tailwindcss.com/docs/line-clamp
					*/
					"line-clamp": [{ "line-clamp": [
						isNumber,
						"none",
						isArbitraryVariable,
						isArbitraryNumber
					] }],
					/**
					* Line Height
					* @see https://tailwindcss.com/docs/line-height
					*/
					leading: [{ leading: [themeLeading, ...scaleUnambiguousSpacing()] }],
					/**
					* List Style Image
					* @see https://tailwindcss.com/docs/list-style-image
					*/
					"list-image": [{ "list-image": [
						"none",
						isArbitraryVariable,
						isArbitraryValue
					] }],
					/**
					* List Style Position
					* @see https://tailwindcss.com/docs/list-style-position
					*/
					"list-style-position": [{ list: ["inside", "outside"] }],
					/**
					* List Style Type
					* @see https://tailwindcss.com/docs/list-style-type
					*/
					"list-style-type": [{ list: [
						"disc",
						"decimal",
						"none",
						isArbitraryVariable,
						isArbitraryValue
					] }],
					/**
					* Text Alignment
					* @see https://tailwindcss.com/docs/text-align
					*/
					"text-alignment": [{ text: [
						"left",
						"center",
						"right",
						"justify",
						"start",
						"end"
					] }],
					/**
					* Placeholder Color
					* @deprecated since Tailwind CSS v3.0.0
					* @see https://v3.tailwindcss.com/docs/placeholder-color
					*/
					"placeholder-color": [{ placeholder: scaleColor() }],
					/**
					* Text Color
					* @see https://tailwindcss.com/docs/text-color
					*/
					"text-color": [{ text: scaleColor() }],
					/**
					* Text Decoration
					* @see https://tailwindcss.com/docs/text-decoration
					*/
					"text-decoration": [
						"underline",
						"overline",
						"line-through",
						"no-underline"
					],
					/**
					* Text Decoration Style
					* @see https://tailwindcss.com/docs/text-decoration-style
					*/
					"text-decoration-style": [{ decoration: [...scaleLineStyle(), "wavy"] }],
					/**
					* Text Decoration Thickness
					* @see https://tailwindcss.com/docs/text-decoration-thickness
					*/
					"text-decoration-thickness": [{ decoration: [
						isNumber,
						"from-font",
						"auto",
						isArbitraryVariable,
						isArbitraryLength
					] }],
					/**
					* Text Decoration Color
					* @see https://tailwindcss.com/docs/text-decoration-color
					*/
					"text-decoration-color": [{ decoration: scaleColor() }],
					/**
					* Text Underline Offset
					* @see https://tailwindcss.com/docs/text-underline-offset
					*/
					"underline-offset": [{ "underline-offset": [
						isNumber,
						"auto",
						isArbitraryVariable,
						isArbitraryValue
					] }],
					/**
					* Text Transform
					* @see https://tailwindcss.com/docs/text-transform
					*/
					"text-transform": [
						"uppercase",
						"lowercase",
						"capitalize",
						"normal-case"
					],
					/**
					* Text Overflow
					* @see https://tailwindcss.com/docs/text-overflow
					*/
					"text-overflow": [
						"truncate",
						"text-ellipsis",
						"text-clip"
					],
					/**
					* Text Wrap
					* @see https://tailwindcss.com/docs/text-wrap
					*/
					"text-wrap": [{ text: [
						"wrap",
						"nowrap",
						"balance",
						"pretty"
					] }],
					/**
					* Text Indent
					* @see https://tailwindcss.com/docs/text-indent
					*/
					indent: [{ indent: scaleUnambiguousSpacing() }],
					/**
					* Tab Size
					* @see https://tailwindcss.com/docs/tab-size
					*/
					"tab-size": [{ tab: [
						isInteger,
						isArbitraryVariable,
						isArbitraryValue
					] }],
					/**
					* Vertical Alignment
					* @see https://tailwindcss.com/docs/vertical-align
					*/
					"vertical-align": [{ align: [
						"baseline",
						"top",
						"middle",
						"bottom",
						"text-top",
						"text-bottom",
						"sub",
						"super",
						isArbitraryVariable,
						isArbitraryValue
					] }],
					/**
					* Whitespace
					* @see https://tailwindcss.com/docs/whitespace
					*/
					whitespace: [{ whitespace: [
						"normal",
						"nowrap",
						"pre",
						"pre-line",
						"pre-wrap",
						"break-spaces"
					] }],
					/**
					* Word Break
					* @see https://tailwindcss.com/docs/word-break
					*/
					break: [{ break: [
						"normal",
						"words",
						"all",
						"keep"
					] }],
					/**
					* Overflow Wrap
					* @see https://tailwindcss.com/docs/overflow-wrap
					*/
					wrap: [{ wrap: [
						"break-word",
						"anywhere",
						"normal"
					] }],
					/**
					* Hyphens
					* @see https://tailwindcss.com/docs/hyphens
					*/
					hyphens: [{ hyphens: [
						"none",
						"manual",
						"auto"
					] }],
					/**
					* Content
					* @see https://tailwindcss.com/docs/content
					*/
					content: [{ content: [
						"none",
						isArbitraryVariable,
						isArbitraryValue
					] }],
					/**
					* Background Attachment
					* @see https://tailwindcss.com/docs/background-attachment
					*/
					"bg-attachment": [{ bg: [
						"fixed",
						"local",
						"scroll"
					] }],
					/**
					* Background Clip
					* @see https://tailwindcss.com/docs/background-clip
					*/
					"bg-clip": [{ "bg-clip": [
						"border",
						"padding",
						"content",
						"text"
					] }],
					/**
					* Background Origin
					* @see https://tailwindcss.com/docs/background-origin
					*/
					"bg-origin": [{ "bg-origin": [
						"border",
						"padding",
						"content"
					] }],
					/**
					* Background Position
					* @see https://tailwindcss.com/docs/background-position
					*/
					"bg-position": [{ bg: scaleBgPosition() }],
					/**
					* Background Repeat
					* @see https://tailwindcss.com/docs/background-repeat
					*/
					"bg-repeat": [{ bg: scaleBgRepeat() }],
					/**
					* Background Size
					* @see https://tailwindcss.com/docs/background-size
					*/
					"bg-size": [{ bg: scaleBgSize() }],
					/**
					* Background Image
					* @see https://tailwindcss.com/docs/background-image
					*/
					"bg-image": [{ bg: [
						"none",
						{
							linear: [
								{ to: [
									"t",
									"tr",
									"r",
									"br",
									"b",
									"bl",
									"l",
									"tl"
								] },
								isInteger,
								isArbitraryVariable,
								isArbitraryValue
							],
							radial: [
								"",
								isArbitraryVariable,
								isArbitraryValue
							],
							conic: [
								isInteger,
								isArbitraryVariable,
								isArbitraryValue
							]
						},
						isArbitraryVariableImage,
						isArbitraryImage
					] }],
					/**
					* Background Color
					* @see https://tailwindcss.com/docs/background-color
					*/
					"bg-color": [{ bg: scaleColor() }],
					/**
					* Gradient Color Stops From Position
					* @see https://tailwindcss.com/docs/gradient-color-stops
					*/
					"gradient-from-pos": [{ from: scaleGradientStopPosition() }],
					/**
					* Gradient Color Stops Via Position
					* @see https://tailwindcss.com/docs/gradient-color-stops
					*/
					"gradient-via-pos": [{ via: scaleGradientStopPosition() }],
					/**
					* Gradient Color Stops To Position
					* @see https://tailwindcss.com/docs/gradient-color-stops
					*/
					"gradient-to-pos": [{ to: scaleGradientStopPosition() }],
					/**
					* Gradient Color Stops From
					* @see https://tailwindcss.com/docs/gradient-color-stops
					*/
					"gradient-from": [{ from: scaleColor() }],
					/**
					* Gradient Color Stops Via
					* @see https://tailwindcss.com/docs/gradient-color-stops
					*/
					"gradient-via": [{ via: scaleColor() }],
					/**
					* Gradient Color Stops To
					* @see https://tailwindcss.com/docs/gradient-color-stops
					*/
					"gradient-to": [{ to: scaleColor() }],
					/**
					* Border Radius
					* @see https://tailwindcss.com/docs/border-radius
					*/
					rounded: [{ rounded: scaleRadius() }],
					/**
					* Border Radius Start
					* @see https://tailwindcss.com/docs/border-radius
					*/
					"rounded-s": [{ "rounded-s": scaleRadius() }],
					/**
					* Border Radius End
					* @see https://tailwindcss.com/docs/border-radius
					*/
					"rounded-e": [{ "rounded-e": scaleRadius() }],
					/**
					* Border Radius Top
					* @see https://tailwindcss.com/docs/border-radius
					*/
					"rounded-t": [{ "rounded-t": scaleRadius() }],
					/**
					* Border Radius Right
					* @see https://tailwindcss.com/docs/border-radius
					*/
					"rounded-r": [{ "rounded-r": scaleRadius() }],
					/**
					* Border Radius Bottom
					* @see https://tailwindcss.com/docs/border-radius
					*/
					"rounded-b": [{ "rounded-b": scaleRadius() }],
					/**
					* Border Radius Left
					* @see https://tailwindcss.com/docs/border-radius
					*/
					"rounded-l": [{ "rounded-l": scaleRadius() }],
					/**
					* Border Radius Start Start
					* @see https://tailwindcss.com/docs/border-radius
					*/
					"rounded-ss": [{ "rounded-ss": scaleRadius() }],
					/**
					* Border Radius Start End
					* @see https://tailwindcss.com/docs/border-radius
					*/
					"rounded-se": [{ "rounded-se": scaleRadius() }],
					/**
					* Border Radius End End
					* @see https://tailwindcss.com/docs/border-radius
					*/
					"rounded-ee": [{ "rounded-ee": scaleRadius() }],
					/**
					* Border Radius End Start
					* @see https://tailwindcss.com/docs/border-radius
					*/
					"rounded-es": [{ "rounded-es": scaleRadius() }],
					/**
					* Border Radius Top Left
					* @see https://tailwindcss.com/docs/border-radius
					*/
					"rounded-tl": [{ "rounded-tl": scaleRadius() }],
					/**
					* Border Radius Top Right
					* @see https://tailwindcss.com/docs/border-radius
					*/
					"rounded-tr": [{ "rounded-tr": scaleRadius() }],
					/**
					* Border Radius Bottom Right
					* @see https://tailwindcss.com/docs/border-radius
					*/
					"rounded-br": [{ "rounded-br": scaleRadius() }],
					/**
					* Border Radius Bottom Left
					* @see https://tailwindcss.com/docs/border-radius
					*/
					"rounded-bl": [{ "rounded-bl": scaleRadius() }],
					/**
					* Border Width
					* @see https://tailwindcss.com/docs/border-width
					*/
					"border-w": [{ border: scaleBorderWidth() }],
					/**
					* Border Width Inline
					* @see https://tailwindcss.com/docs/border-width
					*/
					"border-w-x": [{ "border-x": scaleBorderWidth() }],
					/**
					* Border Width Block
					* @see https://tailwindcss.com/docs/border-width
					*/
					"border-w-y": [{ "border-y": scaleBorderWidth() }],
					/**
					* Border Width Inline Start
					* @see https://tailwindcss.com/docs/border-width
					*/
					"border-w-s": [{ "border-s": scaleBorderWidth() }],
					/**
					* Border Width Inline End
					* @see https://tailwindcss.com/docs/border-width
					*/
					"border-w-e": [{ "border-e": scaleBorderWidth() }],
					/**
					* Border Width Block Start
					* @see https://tailwindcss.com/docs/border-width
					*/
					"border-w-bs": [{ "border-bs": scaleBorderWidth() }],
					/**
					* Border Width Block End
					* @see https://tailwindcss.com/docs/border-width
					*/
					"border-w-be": [{ "border-be": scaleBorderWidth() }],
					/**
					* Border Width Top
					* @see https://tailwindcss.com/docs/border-width
					*/
					"border-w-t": [{ "border-t": scaleBorderWidth() }],
					/**
					* Border Width Right
					* @see https://tailwindcss.com/docs/border-width
					*/
					"border-w-r": [{ "border-r": scaleBorderWidth() }],
					/**
					* Border Width Bottom
					* @see https://tailwindcss.com/docs/border-width
					*/
					"border-w-b": [{ "border-b": scaleBorderWidth() }],
					/**
					* Border Width Left
					* @see https://tailwindcss.com/docs/border-width
					*/
					"border-w-l": [{ "border-l": scaleBorderWidth() }],
					/**
					* Divide Width X
					* @see https://tailwindcss.com/docs/border-width#between-children
					*/
					"divide-x": [{ "divide-x": scaleBorderWidth() }],
					/**
					* Divide Width X Reverse
					* @see https://tailwindcss.com/docs/border-width#between-children
					*/
					"divide-x-reverse": ["divide-x-reverse"],
					/**
					* Divide Width Y
					* @see https://tailwindcss.com/docs/border-width#between-children
					*/
					"divide-y": [{ "divide-y": scaleBorderWidth() }],
					/**
					* Divide Width Y Reverse
					* @see https://tailwindcss.com/docs/border-width#between-children
					*/
					"divide-y-reverse": ["divide-y-reverse"],
					/**
					* Border Style
					* @see https://tailwindcss.com/docs/border-style
					*/
					"border-style": [{ border: [
						...scaleLineStyle(),
						"hidden",
						"none"
					] }],
					/**
					* Divide Style
					* @see https://tailwindcss.com/docs/border-style#setting-the-divider-style
					*/
					"divide-style": [{ divide: [
						...scaleLineStyle(),
						"hidden",
						"none"
					] }],
					/**
					* Border Color
					* @see https://tailwindcss.com/docs/border-color
					*/
					"border-color": [{ border: scaleColor() }],
					/**
					* Border Color Inline
					* @see https://tailwindcss.com/docs/border-color
					*/
					"border-color-x": [{ "border-x": scaleColor() }],
					/**
					* Border Color Block
					* @see https://tailwindcss.com/docs/border-color
					*/
					"border-color-y": [{ "border-y": scaleColor() }],
					/**
					* Border Color Inline Start
					* @see https://tailwindcss.com/docs/border-color
					*/
					"border-color-s": [{ "border-s": scaleColor() }],
					/**
					* Border Color Inline End
					* @see https://tailwindcss.com/docs/border-color
					*/
					"border-color-e": [{ "border-e": scaleColor() }],
					/**
					* Border Color Block Start
					* @see https://tailwindcss.com/docs/border-color
					*/
					"border-color-bs": [{ "border-bs": scaleColor() }],
					/**
					* Border Color Block End
					* @see https://tailwindcss.com/docs/border-color
					*/
					"border-color-be": [{ "border-be": scaleColor() }],
					/**
					* Border Color Top
					* @see https://tailwindcss.com/docs/border-color
					*/
					"border-color-t": [{ "border-t": scaleColor() }],
					/**
					* Border Color Right
					* @see https://tailwindcss.com/docs/border-color
					*/
					"border-color-r": [{ "border-r": scaleColor() }],
					/**
					* Border Color Bottom
					* @see https://tailwindcss.com/docs/border-color
					*/
					"border-color-b": [{ "border-b": scaleColor() }],
					/**
					* Border Color Left
					* @see https://tailwindcss.com/docs/border-color
					*/
					"border-color-l": [{ "border-l": scaleColor() }],
					/**
					* Divide Color
					* @see https://tailwindcss.com/docs/divide-color
					*/
					"divide-color": [{ divide: scaleColor() }],
					/**
					* Outline Style
					* @see https://tailwindcss.com/docs/outline-style
					*/
					"outline-style": [{ outline: [
						...scaleLineStyle(),
						"none",
						"hidden"
					] }],
					/**
					* Outline Offset
					* @see https://tailwindcss.com/docs/outline-offset
					*/
					"outline-offset": [{ "outline-offset": [
						isNumber,
						isArbitraryVariable,
						isArbitraryValue
					] }],
					/**
					* Outline Width
					* @see https://tailwindcss.com/docs/outline-width
					*/
					"outline-w": [{ outline: [
						"",
						isNumber,
						isArbitraryVariableLength,
						isArbitraryLength
					] }],
					/**
					* Outline Color
					* @see https://tailwindcss.com/docs/outline-color
					*/
					"outline-color": [{ outline: scaleColor() }],
					/**
					* Box Shadow
					* @see https://tailwindcss.com/docs/box-shadow
					*/
					shadow: [{ shadow: [
						"",
						"none",
						themeShadow,
						isArbitraryVariableShadow,
						isArbitraryShadow
					] }],
					/**
					* Box Shadow Color
					* @see https://tailwindcss.com/docs/box-shadow#setting-the-shadow-color
					*/
					"shadow-color": [{ shadow: scaleColor() }],
					/**
					* Inset Box Shadow
					* @see https://tailwindcss.com/docs/box-shadow#adding-an-inset-shadow
					*/
					"inset-shadow": [{ "inset-shadow": [
						"none",
						themeInsetShadow,
						isArbitraryVariableShadow,
						isArbitraryShadow
					] }],
					/**
					* Inset Box Shadow Color
					* @see https://tailwindcss.com/docs/box-shadow#setting-the-inset-shadow-color
					*/
					"inset-shadow-color": [{ "inset-shadow": scaleColor() }],
					/**
					* Ring Width
					* @see https://tailwindcss.com/docs/box-shadow#adding-a-ring
					*/
					"ring-w": [{ ring: scaleBorderWidth() }],
					/**
					* Ring Width Inset
					* @see https://v3.tailwindcss.com/docs/ring-width#inset-rings
					* @deprecated since Tailwind CSS v4.0.0
					* @see https://github.com/tailwindlabs/tailwindcss/blob/v4.0.0/packages/tailwindcss/src/utilities.ts#L4158
					*/
					"ring-w-inset": ["ring-inset"],
					/**
					* Ring Color
					* @see https://tailwindcss.com/docs/box-shadow#setting-the-ring-color
					*/
					"ring-color": [{ ring: scaleColor() }],
					/**
					* Ring Offset Width
					* @see https://v3.tailwindcss.com/docs/ring-offset-width
					* @deprecated since Tailwind CSS v4.0.0
					* @see https://github.com/tailwindlabs/tailwindcss/blob/v4.0.0/packages/tailwindcss/src/utilities.ts#L4158
					*/
					"ring-offset-w": [{ "ring-offset": [isNumber, isArbitraryLength] }],
					/**
					* Ring Offset Color
					* @see https://v3.tailwindcss.com/docs/ring-offset-color
					* @deprecated since Tailwind CSS v4.0.0
					* @see https://github.com/tailwindlabs/tailwindcss/blob/v4.0.0/packages/tailwindcss/src/utilities.ts#L4158
					*/
					"ring-offset-color": [{ "ring-offset": scaleColor() }],
					/**
					* Inset Ring Width
					* @see https://tailwindcss.com/docs/box-shadow#adding-an-inset-ring
					*/
					"inset-ring-w": [{ "inset-ring": scaleBorderWidth() }],
					/**
					* Inset Ring Color
					* @see https://tailwindcss.com/docs/box-shadow#setting-the-inset-ring-color
					*/
					"inset-ring-color": [{ "inset-ring": scaleColor() }],
					/**
					* Text Shadow
					* @see https://tailwindcss.com/docs/text-shadow
					*/
					"text-shadow": [{ "text-shadow": [
						"none",
						themeTextShadow,
						isArbitraryVariableShadow,
						isArbitraryShadow
					] }],
					/**
					* Text Shadow Color
					* @see https://tailwindcss.com/docs/text-shadow#setting-the-shadow-color
					*/
					"text-shadow-color": [{ "text-shadow": scaleColor() }],
					/**
					* Opacity
					* @see https://tailwindcss.com/docs/opacity
					*/
					opacity: [{ opacity: [
						isNumber,
						isArbitraryVariable,
						isArbitraryValue
					] }],
					/**
					* Mix Blend Mode
					* @see https://tailwindcss.com/docs/mix-blend-mode
					*/
					"mix-blend": [{ "mix-blend": [
						...scaleBlendMode(),
						"plus-darker",
						"plus-lighter"
					] }],
					/**
					* Background Blend Mode
					* @see https://tailwindcss.com/docs/background-blend-mode
					*/
					"bg-blend": [{ "bg-blend": scaleBlendMode() }],
					/**
					* Mask Clip
					* @see https://tailwindcss.com/docs/mask-clip
					*/
					"mask-clip": [{ "mask-clip": [
						"border",
						"padding",
						"content",
						"fill",
						"stroke",
						"view"
					] }, "mask-no-clip"],
					/**
					* Mask Composite
					* @see https://tailwindcss.com/docs/mask-composite
					*/
					"mask-composite": [{ mask: [
						"add",
						"subtract",
						"intersect",
						"exclude"
					] }],
					/**
					* Mask Image
					* @see https://tailwindcss.com/docs/mask-image
					*/
					"mask-image-linear-pos": [{ "mask-linear": [isNumber] }],
					"mask-image-linear-from-pos": [{ "mask-linear-from": scaleMaskImagePosition() }],
					"mask-image-linear-to-pos": [{ "mask-linear-to": scaleMaskImagePosition() }],
					"mask-image-linear-from-color": [{ "mask-linear-from": scaleColor() }],
					"mask-image-linear-to-color": [{ "mask-linear-to": scaleColor() }],
					"mask-image-t-from-pos": [{ "mask-t-from": scaleMaskImagePosition() }],
					"mask-image-t-to-pos": [{ "mask-t-to": scaleMaskImagePosition() }],
					"mask-image-t-from-color": [{ "mask-t-from": scaleColor() }],
					"mask-image-t-to-color": [{ "mask-t-to": scaleColor() }],
					"mask-image-r-from-pos": [{ "mask-r-from": scaleMaskImagePosition() }],
					"mask-image-r-to-pos": [{ "mask-r-to": scaleMaskImagePosition() }],
					"mask-image-r-from-color": [{ "mask-r-from": scaleColor() }],
					"mask-image-r-to-color": [{ "mask-r-to": scaleColor() }],
					"mask-image-b-from-pos": [{ "mask-b-from": scaleMaskImagePosition() }],
					"mask-image-b-to-pos": [{ "mask-b-to": scaleMaskImagePosition() }],
					"mask-image-b-from-color": [{ "mask-b-from": scaleColor() }],
					"mask-image-b-to-color": [{ "mask-b-to": scaleColor() }],
					"mask-image-l-from-pos": [{ "mask-l-from": scaleMaskImagePosition() }],
					"mask-image-l-to-pos": [{ "mask-l-to": scaleMaskImagePosition() }],
					"mask-image-l-from-color": [{ "mask-l-from": scaleColor() }],
					"mask-image-l-to-color": [{ "mask-l-to": scaleColor() }],
					"mask-image-x-from-pos": [{ "mask-x-from": scaleMaskImagePosition() }],
					"mask-image-x-to-pos": [{ "mask-x-to": scaleMaskImagePosition() }],
					"mask-image-x-from-color": [{ "mask-x-from": scaleColor() }],
					"mask-image-x-to-color": [{ "mask-x-to": scaleColor() }],
					"mask-image-y-from-pos": [{ "mask-y-from": scaleMaskImagePosition() }],
					"mask-image-y-to-pos": [{ "mask-y-to": scaleMaskImagePosition() }],
					"mask-image-y-from-color": [{ "mask-y-from": scaleColor() }],
					"mask-image-y-to-color": [{ "mask-y-to": scaleColor() }],
					"mask-image-radial": [{ "mask-radial": [isArbitraryVariable, isArbitraryValue] }],
					"mask-image-radial-from-pos": [{ "mask-radial-from": scaleMaskImagePosition() }],
					"mask-image-radial-to-pos": [{ "mask-radial-to": scaleMaskImagePosition() }],
					"mask-image-radial-from-color": [{ "mask-radial-from": scaleColor() }],
					"mask-image-radial-to-color": [{ "mask-radial-to": scaleColor() }],
					"mask-image-radial-shape": [{ "mask-radial": ["circle", "ellipse"] }],
					"mask-image-radial-size": [{ "mask-radial": [{
						closest: ["side", "corner"],
						farthest: ["side", "corner"]
					}] }],
					"mask-image-radial-pos": [{ "mask-radial-at": scalePosition() }],
					"mask-image-conic-pos": [{ "mask-conic": [isNumber] }],
					"mask-image-conic-from-pos": [{ "mask-conic-from": scaleMaskImagePosition() }],
					"mask-image-conic-to-pos": [{ "mask-conic-to": scaleMaskImagePosition() }],
					"mask-image-conic-from-color": [{ "mask-conic-from": scaleColor() }],
					"mask-image-conic-to-color": [{ "mask-conic-to": scaleColor() }],
					/**
					* Mask Mode
					* @see https://tailwindcss.com/docs/mask-mode
					*/
					"mask-mode": [{ mask: [
						"alpha",
						"luminance",
						"match"
					] }],
					/**
					* Mask Origin
					* @see https://tailwindcss.com/docs/mask-origin
					*/
					"mask-origin": [{ "mask-origin": [
						"border",
						"padding",
						"content",
						"fill",
						"stroke",
						"view"
					] }],
					/**
					* Mask Position
					* @see https://tailwindcss.com/docs/mask-position
					*/
					"mask-position": [{ mask: scaleBgPosition() }],
					/**
					* Mask Repeat
					* @see https://tailwindcss.com/docs/mask-repeat
					*/
					"mask-repeat": [{ mask: scaleBgRepeat() }],
					/**
					* Mask Size
					* @see https://tailwindcss.com/docs/mask-size
					*/
					"mask-size": [{ mask: scaleBgSize() }],
					/**
					* Mask Type
					* @see https://tailwindcss.com/docs/mask-type
					*/
					"mask-type": [{ "mask-type": ["alpha", "luminance"] }],
					/**
					* Mask Image
					* @see https://tailwindcss.com/docs/mask-image
					*/
					"mask-image": [{ mask: [
						"none",
						isArbitraryVariable,
						isArbitraryValue
					] }],
					/**
					* Filter
					* @see https://tailwindcss.com/docs/filter
					*/
					filter: [{ filter: [
						"",
						"none",
						isArbitraryVariable,
						isArbitraryValue
					] }],
					/**
					* Blur
					* @see https://tailwindcss.com/docs/blur
					*/
					blur: [{ blur: scaleBlur() }],
					/**
					* Brightness
					* @see https://tailwindcss.com/docs/brightness
					*/
					brightness: [{ brightness: [
						isNumber,
						isArbitraryVariable,
						isArbitraryValue
					] }],
					/**
					* Contrast
					* @see https://tailwindcss.com/docs/contrast
					*/
					contrast: [{ contrast: [
						isNumber,
						isArbitraryVariable,
						isArbitraryValue
					] }],
					/**
					* Drop Shadow
					* @see https://tailwindcss.com/docs/drop-shadow
					*/
					"drop-shadow": [{ "drop-shadow": [
						"",
						"none",
						themeDropShadow,
						isArbitraryVariableShadow,
						isArbitraryShadow
					] }],
					/**
					* Drop Shadow Color
					* @see https://tailwindcss.com/docs/filter-drop-shadow#setting-the-shadow-color
					*/
					"drop-shadow-color": [{ "drop-shadow": scaleColor() }],
					/**
					* Grayscale
					* @see https://tailwindcss.com/docs/grayscale
					*/
					grayscale: [{ grayscale: [
						"",
						isNumber,
						isArbitraryVariable,
						isArbitraryValue
					] }],
					/**
					* Hue Rotate
					* @see https://tailwindcss.com/docs/hue-rotate
					*/
					"hue-rotate": [{ "hue-rotate": [
						isNumber,
						isArbitraryVariable,
						isArbitraryValue
					] }],
					/**
					* Invert
					* @see https://tailwindcss.com/docs/invert
					*/
					invert: [{ invert: [
						"",
						isNumber,
						isArbitraryVariable,
						isArbitraryValue
					] }],
					/**
					* Saturate
					* @see https://tailwindcss.com/docs/saturate
					*/
					saturate: [{ saturate: [
						isNumber,
						isArbitraryVariable,
						isArbitraryValue
					] }],
					/**
					* Sepia
					* @see https://tailwindcss.com/docs/sepia
					*/
					sepia: [{ sepia: [
						"",
						isNumber,
						isArbitraryVariable,
						isArbitraryValue
					] }],
					/**
					* Backdrop Filter
					* @see https://tailwindcss.com/docs/backdrop-filter
					*/
					"backdrop-filter": [{ "backdrop-filter": [
						"",
						"none",
						isArbitraryVariable,
						isArbitraryValue
					] }],
					/**
					* Backdrop Blur
					* @see https://tailwindcss.com/docs/backdrop-blur
					*/
					"backdrop-blur": [{ "backdrop-blur": scaleBlur() }],
					/**
					* Backdrop Brightness
					* @see https://tailwindcss.com/docs/backdrop-brightness
					*/
					"backdrop-brightness": [{ "backdrop-brightness": [
						isNumber,
						isArbitraryVariable,
						isArbitraryValue
					] }],
					/**
					* Backdrop Contrast
					* @see https://tailwindcss.com/docs/backdrop-contrast
					*/
					"backdrop-contrast": [{ "backdrop-contrast": [
						isNumber,
						isArbitraryVariable,
						isArbitraryValue
					] }],
					/**
					* Backdrop Grayscale
					* @see https://tailwindcss.com/docs/backdrop-grayscale
					*/
					"backdrop-grayscale": [{ "backdrop-grayscale": [
						"",
						isNumber,
						isArbitraryVariable,
						isArbitraryValue
					] }],
					/**
					* Backdrop Hue Rotate
					* @see https://tailwindcss.com/docs/backdrop-hue-rotate
					*/
					"backdrop-hue-rotate": [{ "backdrop-hue-rotate": [
						isNumber,
						isArbitraryVariable,
						isArbitraryValue
					] }],
					/**
					* Backdrop Invert
					* @see https://tailwindcss.com/docs/backdrop-invert
					*/
					"backdrop-invert": [{ "backdrop-invert": [
						"",
						isNumber,
						isArbitraryVariable,
						isArbitraryValue
					] }],
					/**
					* Backdrop Opacity
					* @see https://tailwindcss.com/docs/backdrop-opacity
					*/
					"backdrop-opacity": [{ "backdrop-opacity": [
						isNumber,
						isArbitraryVariable,
						isArbitraryValue
					] }],
					/**
					* Backdrop Saturate
					* @see https://tailwindcss.com/docs/backdrop-saturate
					*/
					"backdrop-saturate": [{ "backdrop-saturate": [
						isNumber,
						isArbitraryVariable,
						isArbitraryValue
					] }],
					/**
					* Backdrop Sepia
					* @see https://tailwindcss.com/docs/backdrop-sepia
					*/
					"backdrop-sepia": [{ "backdrop-sepia": [
						"",
						isNumber,
						isArbitraryVariable,
						isArbitraryValue
					] }],
					/**
					* Border Collapse
					* @see https://tailwindcss.com/docs/border-collapse
					*/
					"border-collapse": [{ border: ["collapse", "separate"] }],
					/**
					* Border Spacing
					* @see https://tailwindcss.com/docs/border-spacing
					*/
					"border-spacing": [{ "border-spacing": scaleUnambiguousSpacing() }],
					/**
					* Border Spacing X
					* @see https://tailwindcss.com/docs/border-spacing
					*/
					"border-spacing-x": [{ "border-spacing-x": scaleUnambiguousSpacing() }],
					/**
					* Border Spacing Y
					* @see https://tailwindcss.com/docs/border-spacing
					*/
					"border-spacing-y": [{ "border-spacing-y": scaleUnambiguousSpacing() }],
					/**
					* Table Layout
					* @see https://tailwindcss.com/docs/table-layout
					*/
					"table-layout": [{ table: ["auto", "fixed"] }],
					/**
					* Caption Side
					* @see https://tailwindcss.com/docs/caption-side
					*/
					caption: [{ caption: ["top", "bottom"] }],
					/**
					* Transition Property
					* @see https://tailwindcss.com/docs/transition-property
					*/
					transition: [{ transition: [
						"",
						"all",
						"colors",
						"opacity",
						"shadow",
						"transform",
						"none",
						isArbitraryVariable,
						isArbitraryValue
					] }],
					/**
					* Transition Behavior
					* @see https://tailwindcss.com/docs/transition-behavior
					*/
					"transition-behavior": [{ transition: ["normal", "discrete"] }],
					/**
					* Transition Duration
					* @see https://tailwindcss.com/docs/transition-duration
					*/
					duration: [{ duration: [
						isNumber,
						"initial",
						isArbitraryVariable,
						isArbitraryValue
					] }],
					/**
					* Transition Timing Function
					* @see https://tailwindcss.com/docs/transition-timing-function
					*/
					ease: [{ ease: [
						"linear",
						"initial",
						themeEase,
						isArbitraryVariable,
						isArbitraryValue
					] }],
					/**
					* Transition Delay
					* @see https://tailwindcss.com/docs/transition-delay
					*/
					delay: [{ delay: [
						isNumber,
						isArbitraryVariable,
						isArbitraryValue
					] }],
					/**
					* Animation
					* @see https://tailwindcss.com/docs/animation
					*/
					animate: [{ animate: [
						"none",
						themeAnimate,
						isArbitraryVariable,
						isArbitraryValue
					] }],
					/**
					* Backface Visibility
					* @see https://tailwindcss.com/docs/backface-visibility
					*/
					backface: [{ backface: ["hidden", "visible"] }],
					/**
					* Perspective
					* @see https://tailwindcss.com/docs/perspective
					*/
					perspective: [{ perspective: [
						themePerspective,
						isArbitraryVariable,
						isArbitraryValue
					] }],
					/**
					* Perspective Origin
					* @see https://tailwindcss.com/docs/perspective-origin
					*/
					"perspective-origin": [{ "perspective-origin": scalePositionWithArbitrary() }],
					/**
					* Rotate
					* @see https://tailwindcss.com/docs/rotate
					*/
					rotate: [{ rotate: scaleRotate() }],
					/**
					* Rotate X
					* @see https://tailwindcss.com/docs/rotate
					*/
					"rotate-x": [{ "rotate-x": scaleRotate() }],
					/**
					* Rotate Y
					* @see https://tailwindcss.com/docs/rotate
					*/
					"rotate-y": [{ "rotate-y": scaleRotate() }],
					/**
					* Rotate Z
					* @see https://tailwindcss.com/docs/rotate
					*/
					"rotate-z": [{ "rotate-z": scaleRotate() }],
					/**
					* Scale
					* @see https://tailwindcss.com/docs/scale
					*/
					scale: [{ scale: scaleScale() }],
					/**
					* Scale X
					* @see https://tailwindcss.com/docs/scale
					*/
					"scale-x": [{ "scale-x": scaleScale() }],
					/**
					* Scale Y
					* @see https://tailwindcss.com/docs/scale
					*/
					"scale-y": [{ "scale-y": scaleScale() }],
					/**
					* Scale Z
					* @see https://tailwindcss.com/docs/scale
					*/
					"scale-z": [{ "scale-z": scaleScale() }],
					/**
					* Scale 3D
					* @see https://tailwindcss.com/docs/scale
					*/
					"scale-3d": ["scale-3d"],
					/**
					* Skew
					* @see https://tailwindcss.com/docs/skew
					*/
					skew: [{ skew: scaleSkew() }],
					/**
					* Skew X
					* @see https://tailwindcss.com/docs/skew
					*/
					"skew-x": [{ "skew-x": scaleSkew() }],
					/**
					* Skew Y
					* @see https://tailwindcss.com/docs/skew
					*/
					"skew-y": [{ "skew-y": scaleSkew() }],
					/**
					* Transform
					* @see https://tailwindcss.com/docs/transform
					*/
					transform: [{ transform: [
						isArbitraryVariable,
						isArbitraryValue,
						"",
						"none",
						"gpu",
						"cpu"
					] }],
					/**
					* Transform Origin
					* @see https://tailwindcss.com/docs/transform-origin
					*/
					"transform-origin": [{ origin: scalePositionWithArbitrary() }],
					/**
					* Transform Style
					* @see https://tailwindcss.com/docs/transform-style
					*/
					"transform-style": [{ transform: ["3d", "flat"] }],
					/**
					* Translate
					* @see https://tailwindcss.com/docs/translate
					*/
					translate: [{ translate: scaleTranslate() }],
					/**
					* Translate X
					* @see https://tailwindcss.com/docs/translate
					*/
					"translate-x": [{ "translate-x": scaleTranslate() }],
					/**
					* Translate Y
					* @see https://tailwindcss.com/docs/translate
					*/
					"translate-y": [{ "translate-y": scaleTranslate() }],
					/**
					* Translate Z
					* @see https://tailwindcss.com/docs/translate
					*/
					"translate-z": [{ "translate-z": scaleTranslate() }],
					/**
					* Translate None
					* @see https://tailwindcss.com/docs/translate
					*/
					"translate-none": ["translate-none"],
					/**
					* Zoom
					* @see https://tailwindcss.com/docs/zoom
					*/
					zoom: [{ zoom: [
						isInteger,
						isArbitraryVariable,
						isArbitraryValue
					] }],
					/**
					* Accent Color
					* @see https://tailwindcss.com/docs/accent-color
					*/
					accent: [{ accent: scaleColor() }],
					/**
					* Appearance
					* @see https://tailwindcss.com/docs/appearance
					*/
					appearance: [{ appearance: ["none", "auto"] }],
					/**
					* Caret Color
					* @see https://tailwindcss.com/docs/just-in-time-mode#caret-color-utilities
					*/
					"caret-color": [{ caret: scaleColor() }],
					/**
					* Color Scheme
					* @see https://tailwindcss.com/docs/color-scheme
					*/
					"color-scheme": [{ scheme: [
						"normal",
						"dark",
						"light",
						"light-dark",
						"only-dark",
						"only-light"
					] }],
					/**
					* Cursor
					* @see https://tailwindcss.com/docs/cursor
					*/
					cursor: [{ cursor: [
						"auto",
						"default",
						"pointer",
						"wait",
						"text",
						"move",
						"help",
						"not-allowed",
						"none",
						"context-menu",
						"progress",
						"cell",
						"crosshair",
						"vertical-text",
						"alias",
						"copy",
						"no-drop",
						"grab",
						"grabbing",
						"all-scroll",
						"col-resize",
						"row-resize",
						"n-resize",
						"e-resize",
						"s-resize",
						"w-resize",
						"ne-resize",
						"nw-resize",
						"se-resize",
						"sw-resize",
						"ew-resize",
						"ns-resize",
						"nesw-resize",
						"nwse-resize",
						"zoom-in",
						"zoom-out",
						isArbitraryVariable,
						isArbitraryValue
					] }],
					/**
					* Field Sizing
					* @see https://tailwindcss.com/docs/field-sizing
					*/
					"field-sizing": [{ "field-sizing": ["fixed", "content"] }],
					/**
					* Pointer Events
					* @see https://tailwindcss.com/docs/pointer-events
					*/
					"pointer-events": [{ "pointer-events": ["auto", "none"] }],
					/**
					* Resize
					* @see https://tailwindcss.com/docs/resize
					*/
					resize: [{ resize: [
						"none",
						"",
						"y",
						"x"
					] }],
					/**
					* Scroll Behavior
					* @see https://tailwindcss.com/docs/scroll-behavior
					*/
					"scroll-behavior": [{ scroll: ["auto", "smooth"] }],
					/**
					* Scrollbar Thumb Color
					* @see https://tailwindcss.com/docs/scrollbar-color
					*/
					"scrollbar-thumb-color": [{ "scrollbar-thumb": scaleColor() }],
					/**
					* Scrollbar Track Color
					* @see https://tailwindcss.com/docs/scrollbar-color
					*/
					"scrollbar-track-color": [{ "scrollbar-track": scaleColor() }],
					/**
					* Scrollbar Gutter
					* @see https://tailwindcss.com/docs/scrollbar-gutter
					*/
					"scrollbar-gutter": [{ "scrollbar-gutter": [
						"auto",
						"stable",
						"both"
					] }],
					/**
					* Scrollbar Width
					* @see https://tailwindcss.com/docs/scrollbar-width
					*/
					"scrollbar-w": [{ scrollbar: [
						"auto",
						"thin",
						"none"
					] }],
					/**
					* Scroll Margin
					* @see https://tailwindcss.com/docs/scroll-margin
					*/
					"scroll-m": [{ "scroll-m": scaleUnambiguousSpacing() }],
					/**
					* Scroll Margin Inline
					* @see https://tailwindcss.com/docs/scroll-margin
					*/
					"scroll-mx": [{ "scroll-mx": scaleUnambiguousSpacing() }],
					/**
					* Scroll Margin Block
					* @see https://tailwindcss.com/docs/scroll-margin
					*/
					"scroll-my": [{ "scroll-my": scaleUnambiguousSpacing() }],
					/**
					* Scroll Margin Inline Start
					* @see https://tailwindcss.com/docs/scroll-margin
					*/
					"scroll-ms": [{ "scroll-ms": scaleUnambiguousSpacing() }],
					/**
					* Scroll Margin Inline End
					* @see https://tailwindcss.com/docs/scroll-margin
					*/
					"scroll-me": [{ "scroll-me": scaleUnambiguousSpacing() }],
					/**
					* Scroll Margin Block Start
					* @see https://tailwindcss.com/docs/scroll-margin
					*/
					"scroll-mbs": [{ "scroll-mbs": scaleUnambiguousSpacing() }],
					/**
					* Scroll Margin Block End
					* @see https://tailwindcss.com/docs/scroll-margin
					*/
					"scroll-mbe": [{ "scroll-mbe": scaleUnambiguousSpacing() }],
					/**
					* Scroll Margin Top
					* @see https://tailwindcss.com/docs/scroll-margin
					*/
					"scroll-mt": [{ "scroll-mt": scaleUnambiguousSpacing() }],
					/**
					* Scroll Margin Right
					* @see https://tailwindcss.com/docs/scroll-margin
					*/
					"scroll-mr": [{ "scroll-mr": scaleUnambiguousSpacing() }],
					/**
					* Scroll Margin Bottom
					* @see https://tailwindcss.com/docs/scroll-margin
					*/
					"scroll-mb": [{ "scroll-mb": scaleUnambiguousSpacing() }],
					/**
					* Scroll Margin Left
					* @see https://tailwindcss.com/docs/scroll-margin
					*/
					"scroll-ml": [{ "scroll-ml": scaleUnambiguousSpacing() }],
					/**
					* Scroll Padding
					* @see https://tailwindcss.com/docs/scroll-padding
					*/
					"scroll-p": [{ "scroll-p": scaleUnambiguousSpacing() }],
					/**
					* Scroll Padding Inline
					* @see https://tailwindcss.com/docs/scroll-padding
					*/
					"scroll-px": [{ "scroll-px": scaleUnambiguousSpacing() }],
					/**
					* Scroll Padding Block
					* @see https://tailwindcss.com/docs/scroll-padding
					*/
					"scroll-py": [{ "scroll-py": scaleUnambiguousSpacing() }],
					/**
					* Scroll Padding Inline Start
					* @see https://tailwindcss.com/docs/scroll-padding
					*/
					"scroll-ps": [{ "scroll-ps": scaleUnambiguousSpacing() }],
					/**
					* Scroll Padding Inline End
					* @see https://tailwindcss.com/docs/scroll-padding
					*/
					"scroll-pe": [{ "scroll-pe": scaleUnambiguousSpacing() }],
					/**
					* Scroll Padding Block Start
					* @see https://tailwindcss.com/docs/scroll-padding
					*/
					"scroll-pbs": [{ "scroll-pbs": scaleUnambiguousSpacing() }],
					/**
					* Scroll Padding Block End
					* @see https://tailwindcss.com/docs/scroll-padding
					*/
					"scroll-pbe": [{ "scroll-pbe": scaleUnambiguousSpacing() }],
					/**
					* Scroll Padding Top
					* @see https://tailwindcss.com/docs/scroll-padding
					*/
					"scroll-pt": [{ "scroll-pt": scaleUnambiguousSpacing() }],
					/**
					* Scroll Padding Right
					* @see https://tailwindcss.com/docs/scroll-padding
					*/
					"scroll-pr": [{ "scroll-pr": scaleUnambiguousSpacing() }],
					/**
					* Scroll Padding Bottom
					* @see https://tailwindcss.com/docs/scroll-padding
					*/
					"scroll-pb": [{ "scroll-pb": scaleUnambiguousSpacing() }],
					/**
					* Scroll Padding Left
					* @see https://tailwindcss.com/docs/scroll-padding
					*/
					"scroll-pl": [{ "scroll-pl": scaleUnambiguousSpacing() }],
					/**
					* Scroll Snap Align
					* @see https://tailwindcss.com/docs/scroll-snap-align
					*/
					"snap-align": [{ snap: [
						"start",
						"end",
						"center",
						"align-none"
					] }],
					/**
					* Scroll Snap Stop
					* @see https://tailwindcss.com/docs/scroll-snap-stop
					*/
					"snap-stop": [{ snap: ["normal", "always"] }],
					/**
					* Scroll Snap Type
					* @see https://tailwindcss.com/docs/scroll-snap-type
					*/
					"snap-type": [{ snap: [
						"none",
						"x",
						"y",
						"both"
					] }],
					/**
					* Scroll Snap Type Strictness
					* @see https://tailwindcss.com/docs/scroll-snap-type
					*/
					"snap-strictness": [{ snap: ["mandatory", "proximity"] }],
					/**
					* Touch Action
					* @see https://tailwindcss.com/docs/touch-action
					*/
					touch: [{ touch: [
						"auto",
						"none",
						"manipulation"
					] }],
					/**
					* Touch Action X
					* @see https://tailwindcss.com/docs/touch-action
					*/
					"touch-x": [{ "touch-pan": [
						"x",
						"left",
						"right"
					] }],
					/**
					* Touch Action Y
					* @see https://tailwindcss.com/docs/touch-action
					*/
					"touch-y": [{ "touch-pan": [
						"y",
						"up",
						"down"
					] }],
					/**
					* Touch Action Pinch Zoom
					* @see https://tailwindcss.com/docs/touch-action
					*/
					"touch-pz": ["touch-pinch-zoom"],
					/**
					* User Select
					* @see https://tailwindcss.com/docs/user-select
					*/
					select: [{ select: [
						"none",
						"text",
						"all",
						"auto"
					] }],
					/**
					* Will Change
					* @see https://tailwindcss.com/docs/will-change
					*/
					"will-change": [{ "will-change": [
						"auto",
						"scroll",
						"contents",
						"transform",
						isArbitraryVariable,
						isArbitraryValue
					] }],
					/**
					* Fill
					* @see https://tailwindcss.com/docs/fill
					*/
					fill: [{ fill: ["none", ...scaleColor()] }],
					/**
					* Stroke Width
					* @see https://tailwindcss.com/docs/stroke-width
					*/
					"stroke-w": [{ stroke: [
						isNumber,
						isArbitraryVariableLength,
						isArbitraryLength,
						isArbitraryNumber
					] }],
					/**
					* Stroke
					* @see https://tailwindcss.com/docs/stroke
					*/
					stroke: [{ stroke: ["none", ...scaleColor()] }],
					/**
					* Forced Color Adjust
					* @see https://tailwindcss.com/docs/forced-color-adjust
					*/
					"forced-color-adjust": [{ "forced-color-adjust": ["auto", "none"] }]
				},
				conflictingClassGroups: {
					"container-named": ["container-type"],
					overflow: ["overflow-x", "overflow-y"],
					overscroll: ["overscroll-x", "overscroll-y"],
					inset: [
						"inset-x",
						"inset-y",
						"inset-bs",
						"inset-be",
						"start",
						"end",
						"top",
						"right",
						"bottom",
						"left"
					],
					"inset-x": ["right", "left"],
					"inset-y": ["top", "bottom"],
					flex: [
						"basis",
						"grow",
						"shrink"
					],
					gap: ["gap-x", "gap-y"],
					p: [
						"px",
						"py",
						"ps",
						"pe",
						"pbs",
						"pbe",
						"pt",
						"pr",
						"pb",
						"pl"
					],
					px: ["pr", "pl"],
					py: ["pt", "pb"],
					m: [
						"mx",
						"my",
						"ms",
						"me",
						"mbs",
						"mbe",
						"mt",
						"mr",
						"mb",
						"ml"
					],
					mx: ["mr", "ml"],
					my: ["mt", "mb"],
					size: ["w", "h"],
					"font-size": ["leading"],
					"fvn-normal": [
						"fvn-ordinal",
						"fvn-slashed-zero",
						"fvn-figure",
						"fvn-spacing",
						"fvn-fraction"
					],
					"fvn-ordinal": ["fvn-normal"],
					"fvn-slashed-zero": ["fvn-normal"],
					"fvn-figure": ["fvn-normal"],
					"fvn-spacing": ["fvn-normal"],
					"fvn-fraction": ["fvn-normal"],
					"line-clamp": ["display", "overflow"],
					rounded: [
						"rounded-s",
						"rounded-e",
						"rounded-t",
						"rounded-r",
						"rounded-b",
						"rounded-l",
						"rounded-ss",
						"rounded-se",
						"rounded-ee",
						"rounded-es",
						"rounded-tl",
						"rounded-tr",
						"rounded-br",
						"rounded-bl"
					],
					"rounded-s": ["rounded-ss", "rounded-es"],
					"rounded-e": ["rounded-se", "rounded-ee"],
					"rounded-t": ["rounded-tl", "rounded-tr"],
					"rounded-r": ["rounded-tr", "rounded-br"],
					"rounded-b": ["rounded-br", "rounded-bl"],
					"rounded-l": ["rounded-tl", "rounded-bl"],
					"border-spacing": ["border-spacing-x", "border-spacing-y"],
					"border-w": [
						"border-w-x",
						"border-w-y",
						"border-w-s",
						"border-w-e",
						"border-w-bs",
						"border-w-be",
						"border-w-t",
						"border-w-r",
						"border-w-b",
						"border-w-l"
					],
					"border-w-x": ["border-w-r", "border-w-l"],
					"border-w-y": ["border-w-t", "border-w-b"],
					"border-color": [
						"border-color-x",
						"border-color-y",
						"border-color-s",
						"border-color-e",
						"border-color-bs",
						"border-color-be",
						"border-color-t",
						"border-color-r",
						"border-color-b",
						"border-color-l"
					],
					"border-color-x": ["border-color-r", "border-color-l"],
					"border-color-y": ["border-color-t", "border-color-b"],
					translate: [
						"translate-x",
						"translate-y",
						"translate-none"
					],
					"translate-none": [
						"translate",
						"translate-x",
						"translate-y",
						"translate-z"
					],
					"scroll-m": [
						"scroll-mx",
						"scroll-my",
						"scroll-ms",
						"scroll-me",
						"scroll-mbs",
						"scroll-mbe",
						"scroll-mt",
						"scroll-mr",
						"scroll-mb",
						"scroll-ml"
					],
					"scroll-mx": ["scroll-mr", "scroll-ml"],
					"scroll-my": ["scroll-mt", "scroll-mb"],
					"scroll-p": [
						"scroll-px",
						"scroll-py",
						"scroll-ps",
						"scroll-pe",
						"scroll-pbs",
						"scroll-pbe",
						"scroll-pt",
						"scroll-pr",
						"scroll-pb",
						"scroll-pl"
					],
					"scroll-px": ["scroll-pr", "scroll-pl"],
					"scroll-py": ["scroll-pt", "scroll-pb"],
					touch: [
						"touch-x",
						"touch-y",
						"touch-pz"
					],
					"touch-x": ["touch"],
					"touch-y": ["touch"],
					"touch-pz": ["touch"]
				},
				conflictingClassGroupModifiers: { "font-size": ["leading"] },
				postfixLookupClassGroups: ["container-type"],
				orderSensitiveModifiers: [
					"*",
					"**",
					"after",
					"backdrop",
					"before",
					"details-content",
					"file",
					"first-letter",
					"first-line",
					"marker",
					"placeholder",
					"selection"
				]
			};
		};
		const twMerge = /*#__PURE__*/ createTailwindMerge(getDefaultConfig);
		//#endregion
		//#region ../ui/src/lib/utils.ts
		function cn(...inputs) {
			return twMerge(clsx(inputs));
		}
		//#endregion
		//#region ../../node_modules/.pnpm/@remixicon+react@4.9.0_react@18.3.1/node_modules/@remixicon/react/index.mjs
		/**
		* @remixicon/react v4.1.0 - Remix Icon License 1.0
		*/
		const f1 = ({ color: C = "currentColor", size: e = 24, className: l, ...i }) => react.default.createElement("svg", {
			viewBox: "0 0 24 24",
			xmlns: "http://www.w3.org/2000/svg",
			width: e,
			height: e,
			fill: C,
			...i,
			className: "remixicon " + (l || "")
		}, react.default.createElement("path", { d: "M11.9999 13.1714L16.9497 8.22168L18.3639 9.63589L11.9999 15.9999L5.63599 9.63589L7.0502 8.22168L11.9999 13.1714Z" }));
		const s7 = ({ color: C = "currentColor", size: e = 24, className: l, ...i }) => react.default.createElement("svg", {
			viewBox: "0 0 24 24",
			xmlns: "http://www.w3.org/2000/svg",
			width: e,
			height: e,
			fill: C,
			...i,
			className: "remixicon " + (l || "")
		}, react.default.createElement("path", { d: "M9.9997 15.1709L19.1921 5.97852L20.6063 7.39273L9.9997 17.9993L3.63574 11.6354L5.04996 10.2212L9.9997 15.1709Z" }));
		const A7 = ({ color: C = "currentColor", size: e = 24, className: l, ...i }) => react.default.createElement("svg", {
			viewBox: "0 0 24 24",
			xmlns: "http://www.w3.org/2000/svg",
			width: e,
			height: e,
			fill: C,
			...i,
			className: "remixicon " + (l || "")
		}, react.default.createElement("path", { d: "M12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22ZM12 20C16.4183 20 20 16.4183 20 12C20 7.58172 16.4183 4 12 4C7.58172 4 4 7.58172 4 12C4 16.4183 7.58172 20 12 20ZM12 10.5858L14.8284 7.75736L16.2426 9.17157L13.4142 12L16.2426 14.8284L14.8284 16.2426L12 13.4142L9.17157 16.2426L7.75736 14.8284L10.5858 12L7.75736 9.17157L9.17157 7.75736L12 10.5858Z" }));
		const P7 = ({ color: C = "currentColor", size: e = 24, className: l, ...i }) => react.default.createElement("svg", {
			viewBox: "0 0 24 24",
			xmlns: "http://www.w3.org/2000/svg",
			width: e,
			height: e,
			fill: C,
			...i,
			className: "remixicon " + (l || "")
		}, react.default.createElement("path", { d: "M11.9997 10.5865L16.9495 5.63672L18.3637 7.05093L13.4139 12.0007L18.3637 16.9504L16.9495 18.3646L11.9997 13.4149L7.04996 18.3646L5.63574 16.9504L10.5855 12.0007L5.63574 7.05093L7.04996 5.63672L11.9997 10.5865Z" }));
		const Rt = ({ color: C = "currentColor", size: e = 24, className: l, ...i }) => react.default.createElement("svg", {
			viewBox: "0 0 24 24",
			xmlns: "http://www.w3.org/2000/svg",
			width: e,
			height: e,
			fill: C,
			...i,
			className: "remixicon " + (l || "")
		}, react.default.createElement("path", { d: "M12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22ZM12 20C16.4183 20 20 16.4183 20 12C20 7.58172 16.4183 4 12 4C7.58172 4 4 7.58172 4 12C4 16.4183 7.58172 20 12 20ZM11 15H13V17H11V15ZM11 7H13V13H11V7Z" }));
		const hg = ({ color: C = "currentColor", size: e = 24, className: l, ...i }) => react.default.createElement("svg", {
			viewBox: "0 0 24 24",
			xmlns: "http://www.w3.org/2000/svg",
			width: e,
			height: e,
			fill: C,
			...i,
			className: "remixicon " + (l || "")
		}, react.default.createElement("path", { d: "M21 3C21.5523 3 22 3.44772 22 4V11H20V5H4V19H10V21H3C2.44772 21 2 20.5523 2 20V4C2 3.44772 2.44772 3 3 3H21ZM21 13C21.5523 13 22 13.4477 22 14V20C22 20.5523 21.5523 21 21 21H13C12.4477 21 12 20.5523 12 20V14C12 13.4477 12.4477 13 13 13H21ZM20 15H14V19H20V15ZM6.70711 6.29289L8.95689 8.54289L11 6.5V12H5.5L7.54289 9.95689L5.29289 7.70711L6.70711 6.29289Z" }));
		const SM = ({ color: C = "currentColor", size: e = 24, className: l, ...i }) => react.default.createElement("svg", {
			viewBox: "0 0 24 24",
			xmlns: "http://www.w3.org/2000/svg",
			width: e,
			height: e,
			fill: C,
			...i,
			className: "remixicon " + (l || "")
		}, react.default.createElement("path", { d: "M22.3126 10.1753L20.8984 11.5895L20.1913 10.8824L15.9486 15.125L15.2415 18.6606L13.8273 20.0748L9.58466 15.8321L4.63492 20.7819L3.2207 19.3677L8.17045 14.4179L3.92781 10.1753L5.34202 8.76107L8.87756 8.05396L13.1202 3.81132L12.4131 3.10422L13.8273 1.69L22.3126 10.1753Z" }));
		const LN = ({ color: C = "currentColor", size: e = 24, className: l, ...i }) => react.default.createElement("svg", {
			viewBox: "0 0 24 24",
			xmlns: "http://www.w3.org/2000/svg",
			width: e,
			height: e,
			fill: C,
			...i,
			className: "remixicon " + (l || "")
		}, react.default.createElement("path", { d: "M12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22ZM12 20C16.4183 20 20 16.4183 20 12C20 7.58172 16.4183 4 12 4C7.58172 4 4 7.58172 4 12C4 16.4183 7.58172 20 12 20ZM9 9H15V15H9V9Z" }));
		//#endregion
		//#region \0bsk-css:/private/tmp/browserskill-fork/packages/dsh-plugin-browserskill/src/client/ObservationOverlay.module.css.mjs
		const css = ".ZDOl-W_card{z-index:40;pointer-events:auto;background:var(--card);border:1px solid var(--border);border-radius:var(--radius);color:var(--card-foreground);flex-direction:column;display:flex;position:fixed;overflow:hidden;box-shadow:0 8px 28px #0000002e}.ZDOl-W_body{background:var(--card);height:100%;min-height:0;color:var(--card-foreground);flex-direction:column;font-size:12px;display:flex}.ZDOl-W_sidebar-tab{flex-direction:column;height:100%;min-height:0;display:flex}.ZDOl-W_sidebar-tab>*{flex:1;min-height:0}.ZDOl-W_brand-icon{border-radius:22%;display:block}.ZDOl-W_header{user-select:none;touch-action:none;border-bottom:1px solid var(--border);align-items:center;gap:6px;padding:6px 8px;display:flex}.ZDOl-W_header[data-draggable]{cursor:move}.ZDOl-W_sidebar-tab .ZDOl-W_header{border-bottom:none}.ZDOl-W_status-text{text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0;font-weight:500;overflow:hidden}.ZDOl-W_icon-button{border-radius:calc(var(--radius) - 6px);font:inherit;color:var(--muted-foreground);cursor:pointer;background:0 0;border:none;flex:none;align-items:center;padding:2px;display:inline-flex}.ZDOl-W_icon-button:hover{color:var(--foreground);background:var(--accent)}.ZDOl-W_stage{background:var(--background);flex:1;justify-content:center;align-items:center;min-height:0;display:flex;position:relative;overflow:hidden}.ZDOl-W_thumb{object-fit:contain;max-width:100%;max-height:100%;animation:.24s ease-out ZDOl-W_bsk-obs-fade-in}@keyframes ZDOl-W_bsk-obs-fade-in{0%{opacity:0}to{opacity:1}}.ZDOl-W_placeholder{color:var(--muted-foreground);font-size:12px}.ZDOl-W_badge{color:oklch(70% .19 60);background:var(--card);border:1px solid oklch(70% .19 60);border-radius:50%;justify-content:center;align-items:center;width:16px;height:16px;display:inline-flex;position:absolute;top:6px;right:6px}.ZDOl-W_actions{z-index:3;border-top:1px solid var(--border);justify-content:space-between;align-items:center;gap:4px;min-height:32px;padding:4px 8px;display:flex;position:relative}.ZDOl-W_actions-group{align-items:center;gap:4px;display:inline-flex}.ZDOl-W_tool-wrap{display:inline-flex;position:relative}.ZDOl-W_tool-button{border-radius:calc(var(--radius) - 4px);width:28px;height:28px;color:var(--muted-foreground);cursor:pointer;background:0 0;border:none;flex:none;justify-content:center;align-items:center;padding:0;display:inline-flex}.ZDOl-W_tool-button:disabled{opacity:.4;cursor:default}.ZDOl-W_tool-button:focus-visible{outline:2px solid var(--ring);outline-offset:2px}.ZDOl-W_tool-danger,.ZDOl-W_tool-stop{color:var(--destructive)}.ZDOl-W_tool-wrap:hover .ZDOl-W_tool-button:not(:disabled){color:var(--foreground);background:var(--accent)}.ZDOl-W_tool-wrap:hover .ZDOl-W_tool-danger:not(:disabled){color:var(--destructive);background:color-mix(in oklch, var(--destructive) 18%, var(--card))}.ZDOl-W_tool-wrap:hover .ZDOl-W_tool-button:disabled{background:var(--accent)}.ZDOl-W_tool-button.ZDOl-W_tool-stop-armed,.ZDOl-W_tool-wrap:hover .ZDOl-W_tool-button.ZDOl-W_tool-stop-armed{color:var(--destructive-foreground);background:var(--destructive)}.ZDOl-W_hint{border-radius:calc(var(--radius) - 4px);background:var(--card);border:1px solid var(--border);width:max-content;max-width:220px;color:var(--muted-foreground);z-index:41;padding:4px 6px;font-size:11px;line-height:1.35;position:absolute;bottom:calc(100% + 4px);left:0;box-shadow:0 4px 14px #00000029}.ZDOl-W_hint[data-align=end]{left:auto;right:0}.ZDOl-W_resize-handle{touch-action:none;z-index:4;width:16px;height:16px;position:absolute}.ZDOl-W_resize-handle[data-corner=nw]{cursor:nwse-resize;top:0;left:0}.ZDOl-W_resize-handle[data-corner=ne]{cursor:nesw-resize;top:0;right:0}.ZDOl-W_resize-handle[data-corner=sw]{cursor:nesw-resize;bottom:0;left:0}.ZDOl-W_resize-handle[data-corner=se]{cursor:nwse-resize;bottom:0;right:0}.ZDOl-W_capsule{z-index:40;pointer-events:auto;border:1px solid var(--border);background:var(--card);color:var(--muted-foreground);cursor:pointer;border-radius:999px;align-items:center;gap:6px;padding:6px 12px;font-size:12px;display:inline-flex;position:fixed;top:64px;right:16px;box-shadow:0 4px 14px #00000029}.ZDOl-W_capsule:hover{background:var(--accent)}.ZDOl-W_strip{border-top:1px solid var(--border);gap:6px;padding:4px 8px;display:flex;overflow-x:auto}.ZDOl-W_strip-item{border-radius:calc(var(--radius) - 6px);border:1px solid var(--border);flex:none;position:relative}.ZDOl-W_strip-item[data-focused]{border-color:var(--primary)}.ZDOl-W_strip-item[data-state=error]{border-color:var(--destructive)}.ZDOl-W_strip-item[data-state=dead]{opacity:.45}.ZDOl-W_strip-main{border-radius:calc(var(--radius) - 6px);font:inherit;color:var(--muted-foreground);cursor:pointer;background:0 0;border:none;align-items:center;gap:4px;padding:3px 6px;font-size:11px;display:flex}.ZDOl-W_strip-main:hover{background:var(--accent)}.ZDOl-W_strip-thumb{background:var(--background);border-radius:3px;width:28px;height:20px;display:inline-flex;overflow:hidden}.ZDOl-W_strip-thumb img{object-fit:cover;width:100%;height:100%}.ZDOl-W_strip-thumb-empty{width:100%;height:100%}.ZDOl-W_strip-id{text-overflow:ellipsis;max-width:64px;overflow:hidden}.ZDOl-W_pin-badge{color:var(--primary)}.ZDOl-W_strip-interrupt{border:1px solid var(--destructive);background:var(--card);width:16px;height:16px;color:var(--destructive);cursor:pointer;border-radius:50%;justify-content:center;align-items:center;padding:0;display:inline-flex;position:absolute;top:-7px;right:-7px}.ZDOl-W_strip-interrupt:disabled{opacity:.4;cursor:default}.ZDOl-W_icon-button:focus-visible,.ZDOl-W_capsule:focus-visible,.ZDOl-W_strip-main:focus-visible,.ZDOl-W_strip-interrupt:focus-visible{outline:2px solid var(--ring);outline-offset:2px}@media (prefers-reduced-motion:reduce){.ZDOl-W_thumb{animation:none}}";
		const tagId = "@wxg-prc-cpg/browser-skill-dsh-plugin/ObservationOverlay.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@wxg-prc-cpg/browser-skill-dsh-plugin";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var ObservationOverlay_module_css_default = {
			"badge": "ZDOl-W_badge",
			"tool-button": "ZDOl-W_tool-button",
			"pin-badge": "ZDOl-W_pin-badge",
			"stage": "ZDOl-W_stage",
			"actions": "ZDOl-W_actions",
			"icon-button": "ZDOl-W_icon-button",
			"brand-icon": "ZDOl-W_brand-icon",
			"strip-item": "ZDOl-W_strip-item",
			"status-text": "ZDOl-W_status-text",
			"bsk-obs-fade-in": "ZDOl-W_bsk-obs-fade-in",
			"strip-id": "ZDOl-W_strip-id",
			"capsule": "ZDOl-W_capsule",
			"strip-interrupt": "ZDOl-W_strip-interrupt",
			"strip-main": "ZDOl-W_strip-main",
			"strip-thumb-empty": "ZDOl-W_strip-thumb-empty",
			"strip": "ZDOl-W_strip",
			"card": "ZDOl-W_card",
			"sidebar-tab": "ZDOl-W_sidebar-tab",
			"thumb": "ZDOl-W_thumb",
			"resize-handle": "ZDOl-W_resize-handle",
			"hint": "ZDOl-W_hint",
			"header": "ZDOl-W_header",
			"actions-group": "ZDOl-W_actions-group",
			"tool-wrap": "ZDOl-W_tool-wrap",
			"placeholder": "ZDOl-W_placeholder",
			"tool-stop-armed": "ZDOl-W_tool-stop-armed",
			"strip-thumb": "ZDOl-W_strip-thumb",
			"tool-danger": "ZDOl-W_tool-danger",
			"body": "ZDOl-W_body",
			"tool-stop": "ZDOl-W_tool-stop"
		};
		//#endregion
		//#region src/client/observation-view.ts
		/**
		* Shared view logic for the observation carriers (the floating overlay card
		* and the better-sidebar tab): the store-backed view model (snapshot, focus
		* pinning, elapsed ticker) and the Document PiP pop-out. Extracted from
		* ObservationOverlay so both carriers run the same focus/interrupt behavior
		* without duplicating hooks.
		*/
		/**
		* Auto-follow focus: the most recently touched session, but never yank focus
		* to a session whose latest action failed (errors flag the strip item, they
		* do not steal the stage) or one already reported dead.
		*/
		function focusOf(sessions) {
			if (sessions.length === 0) return void 0;
			const byRecency = [...sessions].sort((a, b) => b.since - a.since);
			return byRecency.find((s) => s.lastError === void 0 && s.dead !== true) ?? byRecency[0];
		}
		function statusOf(obs) {
			if (obs.lastError !== void 0 && obs.action === "idle") return "error";
			return obs.action === "idle" ? "idle" : "active";
		}
		function pipApi() {
			if (typeof window === "undefined") return void 0;
			return window.documentPictureInPicture;
		}
		/** Clone the host document's style/link nodes into a PiP window. */
		function cloneStylesInto(pipWindow) {
			for (const node of document.querySelectorAll("link[rel=\"stylesheet\"], style")) pipWindow.document.head.appendChild(node.cloneNode(true));
		}
		/**
		* Whether one session is visible on a surface scoped to one DSH
		* conversation: sessions started by that conversation or its descendants
		* (the lineage ancestors ride along on the entry). Untracked sessions (no
		* owner recorded) are hidden from scoped surfaces but stay in global views.
		*/
		function visibleToScope(obs, scopeId) {
			return obs.dshSessionIds?.includes(scopeId) === true;
		}
		/**
		* The store-backed observation view model. Holds the feed for the component
		* lifetime (refcounted — overlapping carriers never kill each other's
		* stream). `scopeId` narrows the view to one DSH conversation's sessions
		* (the better-sidebar tab); undefined keeps the global view (floating
		* card, PiP).
		*/
		function useObservationView(store, scopeId) {
			const snapshot = (0, react.useSyncExternalStore)(store.subscribe, store.getSnapshot);
			(0, react.useEffect)(() => {
				store.acquire();
				return () => store.release();
			}, [store]);
			const scopedSnapshot = scopeId === void 0 ? snapshot : {
				...snapshot,
				sessions: snapshot.sessions.filter((s) => visibleToScope(s, scopeId))
			};
			const [pinnedId, setPinnedId] = (0, react.useState)(null);
			const pinned = pinnedId !== null ? scopedSnapshot.sessions.find((s) => s.sessionId === pinnedId) : void 0;
			const focus = pinned ?? focusOf(scopedSnapshot.sessions);
			const onTogglePin = (0, react.useCallback)((sessionId) => {
				setPinnedId((current) => current === sessionId ? null : sessionId);
			}, []);
			const anyActive = scopedSnapshot.sessions.some((s) => s.action !== "idle");
			const [now, setNow] = (0, react.useState)(() => Date.now());
			(0, react.useEffect)(() => {
				if (!anyActive) return;
				const timer = setInterval(() => setNow(Date.now()), 1e3);
				return () => clearInterval(timer);
			}, [anyActive]);
			return {
				snapshot: scopedSnapshot,
				focus,
				pinnedId: pinned !== void 0 ? pinnedId : null,
				onTogglePin,
				now
			};
		}
		function usePip() {
			const [pipWindow, setPipWindow] = (0, react.useState)(null);
			const popOut = (0, react.useCallback)((size) => {
				const pip = pipApi();
				if (pip === void 0) return;
				pip.requestWindow(size).then((win) => {
					cloneStylesInto(win);
					win.addEventListener("pagehide", () => setPipWindow(null));
					setPipWindow(win);
				}).catch(() => {});
			}, []);
			(0, react.useEffect)(() => () => pipWindow?.close(), [pipWindow]);
			return {
				pipWindow,
				pipSupported: pipApi() !== void 0,
				popOut
			};
		}
		//#endregion
		//#region src/client/sidebar-mode.ts
		/**
		* Carrier switch for the observation view: while the better-sidebar
		* integration fiber is alive (the dsh-better-sidebar plugin provides its
		* `betterSidebar` service), the tracking view lives in a sidebar tab and the
		* floating overlay card/capsule hides itself. The flag is a tiny external
		* store so the overlay can read it through useSyncExternalStore and flip
		* without a remount when the sidebar plugin (un)loads.
		*/
		let active = false;
		const listeners = /* @__PURE__ */ new Set();
		function getSidebarMode() {
			return active;
		}
		function subscribeSidebarMode(listener) {
			listeners.add(listener);
			return () => listeners.delete(listener);
		}
		function setSidebarMode(next) {
			if (active === next) return;
			active = next;
			for (const listener of [...listeners]) listener();
		}
		//#endregion
		//#region src/client/ObservationOverlay.tsx
		const asIcon = (component) => component;
		const IconStop = asIcon(LN);
		const IconPip = asIcon(hg);
		const IconDown = asIcon(f1);
		const IconClose = asIcon(P7);
		const IconWarn = asIcon(Rt);
		const IconPin = asIcon(SM);
		const IconCloseSession = asIcon(A7);
		const IconCheck = asIcon(s7);
		const DEFAULT_SIZE = {
			w: 320,
			h: 240
		};
		const MIN_SIZE = {
			w: 240,
			h: 180
		};
		const EDGE_MARGIN = 16;
		/** Default dock: top-right, just under the shell's top bar (no spacing tokens exist in dsh 0.1). */
		const TOP_OFFSET = 64;
		function clampSize(size, viewport) {
			const maxW = viewport.w * .8;
			const maxH = viewport.h * .8;
			return {
				w: Math.min(Math.max(size.w, MIN_SIZE.w), maxW),
				h: Math.min(Math.max(size.h, MIN_SIZE.h), maxH)
			};
		}
		function clampPos(pos, size, viewport) {
			return {
				x: Math.min(Math.max(pos.x, 0), Math.max(0, viewport.w - size.w)),
				y: Math.min(Math.max(pos.y, 0), Math.max(0, viewport.h - size.h))
			};
		}
		/** Grow/shrink from one corner, keeping the opposite corner planted. */
		function applyResize(base, corner, dx, dy, viewport) {
			const size = clampSize({
				w: corner === "ne" || corner === "se" ? base.w + dx : base.w - dx,
				h: corner === "sw" || corner === "se" ? base.h + dy : base.h - dy
			}, viewport);
			return {
				pos: clampPos({
					x: corner === "nw" || corner === "sw" ? base.x + base.w - size.w : base.x,
					y: corner === "nw" || corner === "ne" ? base.y + base.h - size.h : base.y
				}, size, viewport),
				size
			};
		}
		const CORNER_LABEL = {
			nw: "top left",
			ne: "top right",
			sw: "bottom left",
			se: "bottom right"
		};
		function formatElapsed(sinceMs, nowMs) {
			const total = Math.max(0, Math.floor((nowMs - sinceMs) / 1e3));
			return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
		}
		/** Compact toolbar icon: no label, hover bubble for the name / semantics. */
		function IconAction(props) {
			const [open, setOpen] = (0, react.useState)(false);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
				className: ObservationOverlay_module_css_default["tool-wrap"],
				onPointerEnter: () => setOpen(true),
				onPointerLeave: () => setOpen(false),
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					className: cn(ObservationOverlay_module_css_default["tool-button"], props.danger === true && ObservationOverlay_module_css_default["tool-danger"]),
					disabled: props.disabled,
					"aria-label": props.label,
					onClick: props.onClick,
					children: props.children
				}), open ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: ObservationOverlay_module_css_default.hint,
					"data-align": props.align,
					role: "tooltip",
					children: props.hint
				}) : null]
			});
		}
		/** How long the stop button stays armed before the confirm click expires. */
		const STOP_ARM_MS = 3e3;
		/**
		* Stop-session button with a lightweight two-click confirm: the first click
		* arms the button (solid red, check icon, short expiry), the second executes
		* the stop. No dialog, no layout shift — and a stray single click can never
		* close an Agent Window.
		*/
		function StopSessionAction(props) {
			const { sessionId, onStop } = props;
			const [hover, setHover] = (0, react.useState)(false);
			const [armed, setArmed] = (0, react.useState)(false);
			const [stopping, setStopping] = (0, react.useState)(false);
			(0, react.useEffect)(() => {
				if (!armed) return;
				const timer = setTimeout(() => setArmed(false), STOP_ARM_MS);
				return () => clearTimeout(timer);
			}, [armed]);
			(0, react.useEffect)(() => {
				if (sessionId === void 0) setArmed(false);
			}, [sessionId]);
			const disabled = sessionId === void 0 || stopping;
			const label = stopping ? "Stopping session…" : armed ? `Confirm stop session ${sessionId ?? ""}` : `Stop session ${sessionId ?? ""}`;
			const hint = stopping ? "Closing the Agent Window…" : armed ? `Click again to stop session ${sessionId ?? ""} and close its Agent Window.` : `Stop session ${sessionId ?? ""} and close its Agent Window.`;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
				className: ObservationOverlay_module_css_default["tool-wrap"],
				onPointerEnter: () => setHover(true),
				onPointerLeave: () => setHover(false),
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					className: cn(ObservationOverlay_module_css_default["tool-button"], ObservationOverlay_module_css_default["tool-stop"], armed && ObservationOverlay_module_css_default["tool-stop-armed"]),
					disabled,
					"aria-label": label,
					"aria-pressed": armed,
					"data-armed": armed || void 0,
					onClick: () => {
						if (sessionId === void 0 || stopping) return;
						if (!armed) {
							setArmed(true);
							return;
						}
						setArmed(false);
						setStopping(true);
						onStop(sessionId).finally(() => setStopping(false));
					},
					children: armed ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconCheck, { size: 16 }) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconCloseSession, { size: 16 })
				}), hover ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: ObservationOverlay_module_css_default.hint,
					role: "tooltip",
					children: hint
				}) : null]
			});
		}
		/** Flat status dot, specced after the BSK popup's ConnectionStatusIndicator. */
		function StatusDot({ state }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: cn("size-2 shrink-0 rounded-full ring-2 ring-background", state === "active" ? "bg-emerald-500" : state === "error" ? "bg-red-500" : state === "dead" ? "bg-amber-500" : "bg-muted-foreground/40"),
				"data-state": state,
				"aria-hidden": true
			});
		}
		/** One strip item: mini frame, id, status dot, hover interrupt, pin toggle. */
		function StripItem(props) {
			const { store, obs, pinned, focused, onTogglePin } = props;
			const [hover, setHover] = (0, react.useState)(false);
			const thumbId = obs.thumbnailAttachmentId;
			(0, react.useEffect)(() => {
				store.ensureThumbnail(thumbId);
			}, [store, thumbId]);
			const thumb = store.getSnapshot().displayFrames[obs.sessionId];
			const state = obs.dead === true ? "dead" : statusOf(obs);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: ObservationOverlay_module_css_default["strip-item"],
				"data-state": state,
				"data-focused": focused || void 0,
				"data-pinned": pinned || void 0,
				onPointerEnter: () => setHover(true),
				onPointerLeave: () => setHover(false),
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					className: ObservationOverlay_module_css_default["strip-main"],
					"aria-label": `${pinned ? "Unpin" : "Pin"} session ${obs.sessionId}`,
					"aria-pressed": pinned,
					onClick: () => onTogglePin(obs.sessionId),
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: ObservationOverlay_module_css_default["strip-thumb"],
							children: thumb?.url !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("img", {
								src: thumb.url,
								alt: ""
							}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: ObservationOverlay_module_css_default["strip-thumb-empty"] })
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: ObservationOverlay_module_css_default["strip-id"],
							children: obs.sessionId
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(StatusDot, { state }),
						pinned ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconPin, {
							size: 9,
							className: ObservationOverlay_module_css_default["pin-badge"],
							"aria-label": "pinned"
						}) : null
					]
				}), hover && !pinned && obs.dead !== true ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					className: ObservationOverlay_module_css_default["strip-interrupt"],
					"aria-label": `Interrupt session ${obs.sessionId}`,
					disabled: obs.action === "idle",
					onClick: (event) => {
						event.stopPropagation();
						store.interrupt(obs.sessionId);
					},
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconStop, { size: 10 })
				}) : null]
			});
		}
		/** The floating card / PiP / sidebar-tab shared content. */
		function OverlayBody(props) {
			const { store, focus, sessions, available, pinnedId, onTogglePin, now, onPopOut, onCollapse, onClosePip, inPip, onHeaderPointerDown } = props;
			const [interrupting, setInterrupting] = (0, react.useState)(false);
			const thumbId = focus?.thumbnailAttachmentId;
			(0, react.useEffect)(() => {
				store.ensureThumbnail(thumbId);
			}, [store, thumbId]);
			const thumb = focus !== void 0 ? store.getSnapshot().displayFrames[focus.sessionId] : void 0;
			const displayUrl = thumb?.url;
			const canInterrupt = available && !interrupting && focus !== void 0 && focus.action !== "idle" && focus.dead !== true;
			const onInterrupt = () => {
				if (!canInterrupt || focus === void 0) return;
				setInterrupting(true);
				store.interrupt(focus.sessionId).finally(() => setInterrupting(false));
			};
			const statusText = !available ? "browser unavailable" : focus === void 0 ? "no session" : `${focus.sessionId} · ${focus.action === "idle" ? "idle" : focus.action} · ${formatElapsed(focus.since, now)}`;
			const state = !available ? "error" : focus !== void 0 ? statusOf(focus) : "idle";
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: cn(ObservationOverlay_module_css_default.body, "bsk-obs"),
				"data-state": state,
				"data-in-pip": inPip || void 0,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: ObservationOverlay_module_css_default.header,
						"data-testid": "obs-header",
						"data-draggable": onHeaderPointerDown !== void 0 || void 0,
						onPointerDown: onHeaderPointerDown,
						role: "presentation",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(StatusDot, { state: state === "error" ? "error" : state === "active" ? "active" : "idle" }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: ObservationOverlay_module_css_default["status-text"],
								children: statusText
							}),
							onCollapse !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: ObservationOverlay_module_css_default["icon-button"],
								"aria-label": "Collapse",
								onClick: onCollapse,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconDown, { size: 14 })
							}) : null,
							onClosePip !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: ObservationOverlay_module_css_default["icon-button"],
								"aria-label": "Close mini window",
								onClick: onClosePip,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconClose, { size: 14 })
							}) : null
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: ObservationOverlay_module_css_default.stage,
						children: [displayUrl !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("img", {
							className: ObservationOverlay_module_css_default.thumb,
							src: displayUrl,
							alt: `session ${focus?.sessionId ?? ""} view`
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: ObservationOverlay_module_css_default.placeholder,
							children: !available ? "last frame kept" : thumb?.status === "error" ? "frame unavailable" : "waiting for page"
						}), thumb?.status === "error" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: ObservationOverlay_module_css_default.badge,
							"aria-label": "thumbnail failed",
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconWarn, { size: 12 })
						}) : null]
					}),
					sessions.length >= 2 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: ObservationOverlay_module_css_default.strip,
						"data-testid": "obs-strip",
						role: "list",
						children: sessions.map((obs) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(StripItem, {
							store,
							obs,
							pinned: pinnedId === obs.sessionId,
							focused: focus?.sessionId === obs.sessionId,
							onTogglePin
						}, obs.sessionId))
					}) : null,
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: ObservationOverlay_module_css_default.actions,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: ObservationOverlay_module_css_default["actions-group"],
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconAction, {
								label: interrupting ? "Interrupting…" : "Interrupt the current browser action",
								hint: "Stop the current browser action.",
								disabled: !canInterrupt,
								danger: true,
								onClick: onInterrupt,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconStop, { size: 16 })
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(StopSessionAction, {
								sessionId: focus?.sessionId,
								onStop: (sessionId) => store.stopSession(sessionId)
							})]
						}), onPopOut !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconAction, {
							label: "Pop out into a mini window",
							hint: "Pop out into a mini window",
							align: "end",
							onClick: onPopOut,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconPip, { size: 16 })
						}) : null]
					})
				]
			});
		}
		function ObservationOverlay({ store }) {
			const { snapshot, focus, pinnedId, onTogglePin, now } = useObservationView(store);
			const sidebarMode = (0, react.useSyncExternalStore)(subscribeSidebarMode, getSidebarMode);
			const [collapsed, setCollapsed] = (0, react.useState)(false);
			const [pos, setPos] = (0, react.useState)(null);
			const [size, setSize] = (0, react.useState)(DEFAULT_SIZE);
			const { pipWindow, pipSupported, popOut } = usePip();
			const dragRef = (0, react.useRef)(null);
			const viewport = () => ({
				w: window.innerWidth,
				h: window.innerHeight
			});
			const onPointerMove = (0, react.useCallback)((event) => {
				const drag = dragRef.current;
				if (drag === null) return;
				const dx = event.clientX - drag.startX;
				const dy = event.clientY - drag.startY;
				if (drag.kind === "move") setPos(clampPos({
					x: drag.base.x + dx,
					y: drag.base.y + dy
				}, {
					w: drag.base.w,
					h: drag.base.h
				}, viewport()));
				else if (drag.corner !== void 0) {
					const next = applyResize(drag.base, drag.corner, dx, dy, viewport());
					setPos(next.pos);
					setSize(next.size);
				}
			}, []);
			const onPointerUp = (0, react.useCallback)(() => {
				dragRef.current = null;
				document.removeEventListener("pointermove", onPointerMove);
				document.removeEventListener("pointerup", onPointerUp);
			}, [onPointerMove]);
			const cardOrigin = () => {
				const vp = viewport();
				return {
					x: pos?.x ?? vp.w - size.w - EDGE_MARGIN,
					y: pos?.y ?? TOP_OFFSET,
					w: size.w,
					h: size.h
				};
			};
			const beginMove = (event) => {
				event.preventDefault();
				const rect = event.currentTarget.closest("[data-obs-card]")?.getBoundingClientRect();
				const origin = cardOrigin();
				const base = {
					x: rect?.left ?? origin.x,
					y: rect?.top ?? origin.y,
					w: rect !== void 0 && rect.width > 0 ? rect.width : origin.w,
					h: rect !== void 0 && rect.height > 0 ? rect.height : origin.h
				};
				dragRef.current = {
					kind: "move",
					startX: event.clientX,
					startY: event.clientY,
					base
				};
				setPos({
					x: base.x,
					y: base.y
				});
				document.addEventListener("pointermove", onPointerMove);
				document.addEventListener("pointerup", onPointerUp);
			};
			const beginResize = (corner) => (event) => {
				event.preventDefault();
				event.stopPropagation();
				const rect = event.currentTarget.closest("[data-obs-card]")?.getBoundingClientRect();
				const origin = cardOrigin();
				const base = {
					x: rect?.left ?? origin.x,
					y: rect?.top ?? origin.y,
					w: rect !== void 0 && rect.width > 0 ? rect.width : origin.w,
					h: rect !== void 0 && rect.height > 0 ? rect.height : origin.h
				};
				dragRef.current = {
					kind: "resize",
					corner,
					startX: event.clientX,
					startY: event.clientY,
					base
				};
				setPos({
					x: base.x,
					y: base.y
				});
				document.addEventListener("pointermove", onPointerMove);
				document.addEventListener("pointerup", onPointerUp);
			};
			const body = /* @__PURE__ */ (0, react_jsx_runtime.jsx)(OverlayBody, {
				store,
				focus,
				sessions: snapshot.sessions,
				available: snapshot.available,
				pinnedId,
				onTogglePin,
				now,
				inPip: pipWindow !== null,
				onPopOut: pipWindow === null && pipSupported ? () => popOut({
					width: size.w,
					height: size.h
				}) : void 0,
				onCollapse: pipWindow === null ? () => setCollapsed(true) : void 0,
				onClosePip: pipWindow !== null ? () => pipWindow.close() : void 0,
				onHeaderPointerDown: pipWindow === null ? beginMove : void 0
			});
			if (pipWindow !== null) return (0, react_dom.createPortal)(body, pipWindow.document.body);
			if (sidebarMode) return null;
			if (snapshot.sessions.length === 0) return null;
			if (collapsed) {
				const state = focus !== void 0 ? statusOf(focus) : "idle";
				return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					className: cn(ObservationOverlay_module_css_default.capsule, "bsk-obs"),
					"data-state": state,
					"aria-label": "Expand browser observation overlay",
					onClick: () => setCollapsed(false),
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(StatusDot, { state }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: ObservationOverlay_module_css_default["capsule-text"],
						children: [
							snapshot.sessions.length,
							" session",
							snapshot.sessions.length === 1 ? "" : "s",
							focus !== void 0 && focus.action !== "idle" ? ` · ${focus.action} · ${formatElapsed(focus.since, now)}` : ""
						]
					})]
				});
			}
			const style = pos !== null ? {
				left: pos.x,
				top: pos.y,
				width: size.w,
				height: size.h
			} : {
				right: EDGE_MARGIN,
				top: TOP_OFFSET,
				width: size.w,
				height: size.h
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: cn(ObservationOverlay_module_css_default.card, "bsk-obs"),
				style,
				"data-obs-card": true,
				"data-testid": "obs-card",
				children: [body, [
					"nw",
					"ne",
					"sw",
					"se"
				].map((corner) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: ObservationOverlay_module_css_default["resize-handle"],
					"data-corner": corner,
					"data-testid": `obs-resize-${corner}`,
					"aria-label": `Resize overlay from the ${CORNER_LABEL[corner]}`,
					role: "separator",
					"aria-valuenow": size.w,
					"aria-valuetext": `${Math.round(size.w)} by ${Math.round(size.h)} pixels`,
					"aria-valuemin": MIN_SIZE.w,
					"aria-valuemax": Math.round(viewport().w * .8),
					tabIndex: corner === "se" ? 0 : -1,
					onPointerDown: beginResize(corner),
					onKeyDown: corner === "se" ? (event) => {
						const step = 16;
						const dx = event.key === "ArrowRight" ? step : event.key === "ArrowLeft" ? -16 : 0;
						const dy = event.key === "ArrowDown" ? step : event.key === "ArrowUp" ? -16 : 0;
						if (dx === 0 && dy === 0) return;
						event.preventDefault();
						const next = applyResize(cardOrigin(), "se", dx, dy, viewport());
						setPos(next.pos);
						setSize(next.size);
					} : void 0
				}, corner))]
			});
		}
		//#endregion
		//#region src/client/observation-sidebar.tsx
		/** The tab title — "Browser Skill", distinct from the sidebar's built-in "browser" tab. */
		const TAB_TITLE = "Browser Skill";
		/** Tab strip icon: Muen fork — no brand mark; keep the tab label clean. */
		function TabIcon({ size }) {
			return null;
		}
		/** The registered tab type id (also the SidebarTab.type value). */
		const OBSERVATION_TAB_TYPE = "browserskill:observation";
		/**
		* Inert content seed carried on auto-opened tabs: its mere presence makes
		* the sidebar treat the open as a content open (expanding the hosting panel
		* so the tracking view lands in sight). Never read by our component.
		*/
		const OBSERVATION_TAB_PATH = "browser-skill:observation";
		/**
		* The observation tab body: the same OverlayBody the floating card renders,
		* minus the card chrome (no drag header, no collapse — the sidebar tab bar
		* owns those), plus the PiP pop-out upgrade. The view is scoped to the
		* sidebar's conversation: only browser sessions started by it (or its
		* descendants) show here — the floating card keeps the global view.
		*/
		function ObservationSidebarTab({ store, scopeId }) {
			const { snapshot, focus, pinnedId, onTogglePin, now } = useObservationView(store, scopeId);
			const { pipWindow, pipSupported, popOut } = usePip();
			const body = /* @__PURE__ */ (0, react_jsx_runtime.jsx)(OverlayBody, {
				store,
				focus,
				sessions: snapshot.sessions,
				available: snapshot.available,
				pinnedId,
				onTogglePin,
				now,
				inPip: pipWindow !== null,
				onPopOut: pipWindow === null && pipSupported ? () => popOut() : void 0,
				onClosePip: pipWindow !== null ? () => pipWindow.close() : void 0
			});
			if (pipWindow !== null) return (0, react_dom.createPortal)(body, pipWindow.document.body);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: ObservationOverlay_module_css_default["sidebar-tab"],
				children: body
			});
		}
		function* leafNodes(node) {
			if (node.kind === "leaf") {
				yield node;
				return;
			}
			for (const child of node.children) yield* leafNodes(child);
		}
		/** Whether a tab of our type is already open in either sidebar workbench. */
		function observationTabOpen(state) {
			if (state === void 0) return false;
			for (const root of [state.splits, state.bottomSplits]) for (const leaf of leafNodes(root)) if (leaf.tabs.some((tab) => tab.type === "browserskill:observation")) return true;
			return false;
		}
		/**
		* Register the observation sidebar tab and flip the carrier flag. Returns
		* the disposer the cordis fiber invokes when the sidebar service goes away
		* (plugin unload/HMR): the floating overlay then resumes as the carrier.
		*/
		function registerObservationSidebar(service, store) {
			setSidebarMode(true);
			store.acquire();
			const disposeTab = service.registerTab({
				id: OBSERVATION_TAB_TYPE,
				title: TAB_TITLE,
				icon: (size) => (0, react.createElement)(TabIcon, { size }),
				single: true,
				badge: (_ctx, scope) => {
					const count = store.getSnapshot().sessions.filter((s) => visibleToScope(s, scope.sessionId)).length;
					return count > 0 ? count : null;
				},
				component: (props) => (0, react.createElement)(ObservationSidebarTab, {
					store,
					scopeId: props.scope.sessionId
				})
			});
			const activeVisibleCount = () => {
				const activeId = service.getSnapshot().sessionId;
				if (activeId === void 0) return 0;
				return store.getSnapshot().sessions.filter((s) => visibleToScope(s, activeId)).length;
			};
			let previousVisible = activeVisibleCount();
			const evaluate = () => {
				const count = activeVisibleCount();
				const { state, sessionId } = service.getSnapshot();
				if (state !== void 0 && sessionId !== void 0 && service.isTabEnabled("browserskill:observation")) {
					const open = observationTabOpen(state);
					if (count > 0 && !open) service.openTab({
						type: OBSERVATION_TAB_TYPE,
						path: OBSERVATION_TAB_PATH
					});
					else if (previousVisible === 0 && count > 0 && open && state.panelOpen === false) service.openTab({
						type: OBSERVATION_TAB_TYPE,
						path: OBSERVATION_TAB_PATH
					});
				}
				previousVisible = count;
			};
			evaluate();
			const unsubscribe = store.subscribe(evaluate);
			const unsubscribeState = service.subscribeState?.(evaluate);
			return () => {
				unsubscribe();
				unsubscribeState?.();
				disposeTab();
				store.release();
				setSidebarMode(false);
			};
		}
		//#endregion
		//#region src/client/observation-store.ts
		const STATE_URL = "/bsk-observation/state";
		const EVENTS_URL = "/bsk-observation/events";
		const INTERRUPT_URL = "/bsk-observation/interrupt";
		const STOP_URL = "/bsk-observation/stop";
		function revoke(url) {
			if (url !== void 0 && typeof URL.revokeObjectURL === "function") URL.revokeObjectURL(url);
		}
		var ObservationClientStore = class {
			deps;
			sessions = /* @__PURE__ */ new Map();
			thumbs = /* @__PURE__ */ new Map();
			/** sessionId → the attachment id currently advertised for it. */
			thumbBySession = /* @__PURE__ */ new Map();
			/** sessionId → last successfully decoded frame (held across the next load). */
			lastReady = /* @__PURE__ */ new Map();
			listeners = /* @__PURE__ */ new Set();
			events;
			snapshot = {
				sessions: [],
				subscribed: false,
				thumbnails: {},
				displayFrames: {},
				available: true
			};
			available = true;
			started = false;
			/** Refcount of mounted consumers (overlay card, sidebar tab, sidebar fiber). */
			consumers = 0;
			constructor(deps) {
				this.deps = deps;
			}
			subscribe = (listener) => {
				this.listeners.add(listener);
				return () => this.listeners.delete(listener);
			};
			getSnapshot = () => this.snapshot;
			publish() {
				this.snapshot = {
					sessions: [...this.sessions.values()],
					subscribed: this.events !== void 0,
					thumbnails: Object.fromEntries(this.thumbs),
					displayFrames: this.buildDisplayFrames(),
					available: this.available
				};
				for (const listener of [...this.listeners]) listener();
			}
			/** Frame the overlay should paint for one session (last good while next loads). */
			frameFor(sessionId) {
				const attachmentId = this.thumbBySession.get(sessionId);
				const current = attachmentId !== void 0 ? this.thumbs.get(attachmentId) : void 0;
				if (current?.status === "ready" && current.url !== void 0) return current;
				const held = this.lastReady.get(sessionId);
				if (held !== void 0) return {
					status: current?.status === "error" ? "error" : "ready",
					url: held.url
				};
				return current;
			}
			buildDisplayFrames() {
				const frames = {};
				for (const sessionId of this.sessions.keys()) {
					const frame = this.frameFor(sessionId);
					if (frame !== void 0) frames[sessionId] = frame;
				}
				return frames;
			}
			sessionOf(attachmentId) {
				for (const [sessionId, id] of this.thumbBySession) if (id === attachmentId) return sessionId;
			}
			/** (Re)pull the full state: initial load and every SSE (re)open. */
			refreshState() {
				this.deps.fetchFn(STATE_URL).then(async (res) => {
					if (!res.ok) return;
					const body = await res.json();
					const sessions = body.sessions ?? [];
					this.sessions = new Map(sessions.map((s) => [s.sessionId, s]));
					const alive = new Set(sessions.map((s) => s.sessionId));
					for (const sessionId of [...this.thumbBySession.keys()]) if (!alive.has(sessionId)) this.dropThumb(sessionId);
					for (const s of sessions) this.trackThumb(s.sessionId, s.thumbnailAttachmentId);
					if (typeof body.available === "boolean") this.available = body.available;
					this.publish();
				}).catch(() => {});
			}
			/** Initial fetch + SSE subscription. Idempotent. */
			start() {
				if (this.started) return;
				this.started = true;
				this.refreshState();
				const events = this.deps.eventSourceFactory(EVENTS_URL);
				events.onmessage = (message) => {
					let event;
					try {
						event = JSON.parse(message.data);
					} catch {
						return;
					}
					this.apply(event);
				};
				events.onopen = () => {
					if (this.events === events) this.refreshState();
				};
				this.events = events;
				this.publish();
			}
			stop() {
				this.events?.close();
				this.events = void 0;
				this.started = false;
				for (const thumb of this.thumbs.values()) revoke(thumb.url);
				this.thumbs.clear();
				this.thumbBySession.clear();
				this.lastReady.clear();
				this.sessions.clear();
				this.publish();
			}
			/**
			* Hold the feed for one consumer's lifetime: the stream starts with the
			* first holder and stops with the last release. Several carriers can share
			* the store (the floating card, the better-sidebar tab, and the sidebar
			* integration fiber) without one unmount killing the others' updates.
			*/
			acquire() {
				this.consumers += 1;
				if (this.consumers === 1) this.start();
			}
			release() {
				if (this.consumers === 0) return;
				this.consumers -= 1;
				if (this.consumers === 0) this.stop();
			}
			/** Forget one session's tracked + held frames, revoking their blob URLs. */
			dropThumb(sessionId) {
				const attachmentId = this.thumbBySession.get(sessionId);
				const held = this.lastReady.get(sessionId);
				this.thumbBySession.delete(sessionId);
				this.lastReady.delete(sessionId);
				if (attachmentId !== void 0) {
					revoke(this.thumbs.get(attachmentId)?.url);
					this.thumbs.delete(attachmentId);
				}
				if (held !== void 0 && held.attachmentId !== attachmentId) {
					revoke(held.url);
					this.thumbs.delete(held.attachmentId);
				}
			}
			/**
			* Track the frame a session currently advertises. The last *ready* blob is
			* kept until the replacement decodes — dropping it on the upsert is what
			* made the overlay flash a placeholder between breaths.
			*/
			trackThumb(sessionId, attachmentId) {
				const previous = this.thumbBySession.get(sessionId);
				if (previous === attachmentId) return;
				if (attachmentId !== void 0) this.thumbBySession.set(sessionId, attachmentId);
				else this.thumbBySession.delete(sessionId);
				const heldId = this.lastReady.get(sessionId)?.attachmentId;
				if (previous !== void 0 && previous !== heldId) {
					revoke(this.thumbs.get(previous)?.url);
					this.thumbs.delete(previous);
				}
			}
			apply(event) {
				if (event.type === "reset") {
					this.sessions.clear();
					for (const thumb of this.thumbs.values()) revoke(thumb.url);
					this.thumbs.clear();
					this.thumbBySession.clear();
					this.lastReady.clear();
				} else if (event.type === "remove" && event.session !== void 0) {
					this.sessions.delete(event.session.sessionId);
					this.dropThumb(event.session.sessionId);
				} else if (event.type === "upsert" && event.session !== void 0) {
					this.sessions.set(event.session.sessionId, event.session);
					this.trackThumb(event.session.sessionId, event.session.thumbnailAttachmentId);
				} else if (event.type === "availability") this.available = event.available;
				this.publish();
			}
			/**
			* Ensure a thumbnail load is in flight for one attachment reference. New
			* frames replace the old URL only after they decode; failures keep the last
			* good frame (the caller renders `status: 'error'` as a small badge over
			* the old image).
			*/
			ensureThumbnail(attachmentId) {
				if (attachmentId === void 0 || this.thumbs.has(attachmentId)) return;
				this.thumbs.set(attachmentId, { status: "loading" });
				this.publish();
				this.deps.loadImage(attachmentId).then((url) => {
					if (!this.thumbs.has(attachmentId)) {
						revoke(url);
						return;
					}
					this.thumbs.set(attachmentId, {
						status: "ready",
						url
					});
					const sessionId = this.sessionOf(attachmentId);
					if (sessionId !== void 0) {
						const previous = this.lastReady.get(sessionId);
						if (previous !== void 0 && previous.attachmentId !== attachmentId) {
							revoke(previous.url);
							this.thumbs.delete(previous.attachmentId);
						}
						this.lastReady.set(sessionId, {
							attachmentId,
							url
						});
					}
					this.publish();
				}, () => {
					this.thumbs.set(attachmentId, { status: "error" });
					this.publish();
				});
			}
			/** Interrupt the current or named session's in-flight call. */
			async interrupt(sessionId) {
				try {
					const res = await this.deps.fetchFn(INTERRUPT_URL, {
						method: "POST",
						headers: { "content-type": "application/json" },
						body: JSON.stringify(sessionId === void 0 ? {} : { sessionId })
					});
					if (!res.ok) return false;
					return (await res.json()).interrupted === true;
				} catch {
					return false;
				}
			}
			/**
			* Stop one session and close its Agent Window. The session's removal
			* arrives through the SSE remove event — no local state is touched here.
			*/
			async stopSession(sessionId) {
				try {
					const res = await this.deps.fetchFn(STOP_URL, {
						method: "POST",
						headers: { "content-type": "application/json" },
						body: JSON.stringify({ sessionId })
					});
					if (!res.ok) return false;
					return (await res.json()).stopped === true;
				} catch {
					return false;
				}
			}
		};
		//#endregion
		//#region src/client/index.ts
		/** Required services: slots, session-scoped attachment reads, and the overlay seat. */
		const inject = ["slots", "sessions"];
		/** Resolve one durable image attachment into a browser blob URL. */
		async function loadSessionImage(sessions, sessionId, attachment) {
			const session = sessions.binding(sessionId)?.session;
			if (session === void 0) throw new Error(`screenshot toolview: session "${String(sessionId)}" is not bound`);
			const result = await session.readAttachment(attachment.attachmentId);
			if (!result.ok) throw new Error(`screenshot toolview: readAttachment failed: ${result.error.code}: ${result.error.message}`);
			const bytes = Uint8Array.from(result.value.data);
			return URL.createObjectURL(new Blob([bytes.buffer], { type: result.value.attachment.mediaType }));
		}
		/**
		* Thumbnail loader for the overlay: frames are plugin-owned runtime data
		* (never referenced by a session log, so the session-authorized RPC refuses
		* them), served by the host over the plugin's own route.
		*/
		async function overlayImageLoader(attachmentId) {
			const res = await fetch(`/bsk-observation/thumbnail/${encodeURIComponent(attachmentId)}`);
			if (!res.ok) throw new Error(`thumbnail fetch failed: ${res.status}`);
			return URL.createObjectURL(await res.blob());
		}
		/**
		* Client plugin body: register the keyed toolview and the observation overlay.
		* @param ctx - client root context.
		*/
		function apply(ctx) {
			const sessions = ctx.get("sessions");
			ctx.slots.inject("tool.call.toolview", () => ctx.slots.register({
				name: "tool.call.toolview",
				key: "browser_inspect"
			}, (props) => (0, react.createElement)(BrowserInspectToolView, {
				...props,
				loadImage: (attachment) => loadSessionImage(sessions, props.sessionId, attachment)
			})));
			const store = new ObservationClientStore({
				fetchFn: (url, init) => fetch(url, init),
				eventSourceFactory: (url) => new EventSource(url),
				loadImage: overlayImageLoader
			});
			ctx.slots.inject("shell.overlay", () => ctx.slots.register({
				name: "shell.overlay",
				id: "bsk-observation"
			}, () => (0, react.createElement)(ObservationOverlay, { store })));
			ctx.inject(["betterSidebar"], (injected) => registerObservationSidebar(injected.betterSidebar, store));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
