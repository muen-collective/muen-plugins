// @muen/dsh-brand-swap — browser half (Settings → Brand page).
// Loader format: one self-contained script registered via window.__ModuleLoader__.
// React arrives via factory(require); the DSH slot registry comes from ctx.slots.
//
// White-label brand plugin: a Brand OS configures its identity through this row's
// cordis `config` (wordmark text / colors / font — legacy v0.1 path) or, from v0.2, by
// uploading transparent PNG / SVG logos + hero mark in a Settings → Brand page. Values
// are persisted via the host settings doc when a `settingsScope` is available, otherwise
// in localStorage — never by editing the installed bundle, so it survives plugin updates.
window.__ModuleLoader__.load({
  id: '@muen/dsh-brand-swap',
  factory: (require) => {
    const React = require('react')
    const h = React.createElement

    const NS = 'brand-swap'
    const LS_KEY = 'muen:brand-swap:logos'
    // Default Mitsumeru brand (production): 123x24 wordmark + cyan-blue dot.
    // dark_b.svg = white text (dark theme); light_b.svg = black text (light theme).
    const DEFAULT_BRAND_DARK = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIzIiBoZWlnaHQ9IjI0IiB2aWV3Qm94PSIwIDAgMTIzIDI0IiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPgo8cGF0aCBkPSJNMTE4LjA2NSAyMC40NjhDMTE2LjIyOSAyMC40NjggMTE0Ljc1MyAxOC45OTIgMTE0Ljc1MyAxNy4yMjhDMTE0Ljc1MyAxNS40MjggMTE2LjIyOSAxMy45NTIgMTE4LjA2NSAxMy45NTJDMTE5LjgyOSAxMy45NTIgMTIxLjM3NyAxNS40MjggMTIxLjM3NyAxNy4yMjhDMTIxLjM3NyAxOC45OTIgMTE5LjgyOSAyMC40NjggMTE4LjA2NSAyMC40NjhaIiBmaWxsPSIjMDBFRUZGIi8+CjxwYXRoIGQ9Ik0xMDguMDEgOS4xMzJIMTEwLjY5NFYyMEgxMDguMjA4TDEwOC4wMSAxOC41NDhDMTA3LjM1IDE5LjU4MiAxMDUuOTQyIDIwLjI4NiAxMDQuNDkgMjAuMjg2QzEwMS45ODIgMjAuMjg2IDEwMC41MDggMTguNTkyIDEwMC41MDggMTUuOTNWOS4xMzJIMTAzLjE5MlYxNC45ODRDMTAzLjE5MiAxNy4wNTIgMTA0LjAwNiAxNy44ODggMTA1LjUwMiAxNy44ODhDMTA3LjE5NiAxNy44ODggMTA4LjAxIDE2Ljg5OCAxMDguMDEgMTQuODNWOS4xMzJaIiBmaWxsPSJ3aGl0ZSIvPgo8cGF0aCBkPSJNOTguMzgzNiA5LjA4OFYxMS41NzRIOTcuMzkzNkM5NS40NTc2IDExLjU3NCA5NC4yNDc2IDEyLjYwOCA5NC4yNDc2IDE0LjcyVjIwSDkxLjU2MzZWOS4xNTRIOTQuMDkzNkw5NC4yNDc2IDEwLjczOEM5NC43MDk2IDkuNjYgOTUuNzQzNiA4LjkzNCA5Ny4xOTU2IDguOTM0Qzk3LjU2OTYgOC45MzQgOTcuOTQzNiA4Ljk3OCA5OC4zODM2IDkuMDg4WiIgZmlsbD0id2hpdGUiLz4KPHBhdGggZD0iTTgzLjczOTUgMjAuMjg2QzgwLjUwNTUgMjAuMjg2IDc4LjIzOTUgMTcuOTMyIDc4LjIzOTUgMTQuNTY2Qzc4LjIzOTUgMTEuMTU2IDgwLjQ2MTYgOC44MDIgODMuNjUxNiA4LjgwMkM4Ni45MDc2IDguODAyIDg4Ljk3NTUgMTAuOTggODguOTc1NSAxNC4zNjhWMTUuMTgyTDgwLjc5MTUgMTUuMjA0QzgwLjk4OTUgMTcuMTE4IDgyLjAwMTUgMTguMDg2IDgzLjc4MzUgMTguMDg2Qzg1LjI1NzUgMTguMDg2IDg2LjIyNTUgMTcuNTE0IDg2LjUzMzUgMTYuNDhIODkuMDE5NUM4OC41NTc1IDE4Ljg1NiA4Ni41Nzc1IDIwLjI4NiA4My43Mzk1IDIwLjI4NlpNODMuNjczNSAxMS4wMDJDODIuMDg5NSAxMS4wMDIgODEuMTIxNSAxMS44NiA4MC44NTc1IDEzLjQ4OEg4Ni4zMTM1Qzg2LjMxMzUgMTEuOTkyIDg1LjI3OTUgMTEuMDAyIDgzLjY3MzUgMTEuMDAyWiIgZmlsbD0id2hpdGUiLz4KPHBhdGggZD0iTTYxLjY1NjcgMjBINTguOTcyN1Y5LjEzMkg2MS40MzY3TDYxLjY1NjcgMTAuNDA4QzYyLjIwNjcgOS41MDYgNjMuMzA2NyA4LjgwMiA2NC44Njg3IDguODAyQzY2LjUxODcgOC44MDIgNjcuNjYyNyA5LjYxNiA2OC4yMzQ3IDEwLjg3QzY4Ljc4NDcgOS42MTYgNzAuMDYwNyA4LjgwMiA3MS43MTA3IDguODAyQzc0LjM1MDcgOC44MDIgNzUuODAyNyAxMC4zODYgNzUuODAyNyAxMi44OTRWMjBINzMuMTQwN1YxMy41OThDNzMuMTQwNyAxMi4wMzYgNzIuMzA0NyAxMS4yMjIgNzEuMDI4NyAxMS4yMjJDNjkuNzMwNyAxMS4yMjIgNjguNzQwNyAxMi4wNTggNjguNzQwNyAxMy44NFYyMEg2Ni4wNTY3VjEzLjU3NkM2Ni4wNTY3IDEyLjA1OCA2NS4yNDI3IDExLjI0NCA2My45NjY3IDExLjI0NEM2Mi42OTA3IDExLjI0NCA2MS42NTY3IDEyLjA4IDYxLjY1NjcgMTMuODRWMjBaIiBmaWxsPSJ3aGl0ZSIvPgo8cGF0aCBkPSJNNTMuMDc2NSA5LjEzMkg1NS43NjA1VjIwSDUzLjI3NDVMNTMuMDc2NSAxOC41NDhDNTIuNDE2NSAxOS41ODIgNTEuMDA4NSAyMC4yODYgNDkuNTU2NSAyMC4yODZDNDcuMDQ4NSAyMC4yODYgNDUuNTc0NSAxOC41OTIgNDUuNTc0NSAxNS45M1Y5LjEzMkg0OC4yNTg1VjE0Ljk4NEM0OC4yNTg1IDE3LjA1MiA0OS4wNzI1IDE3Ljg4OCA1MC41Njg1IDE3Ljg4OEM1Mi4yNjI1IDE3Ljg4OCA1My4wNzY1IDE2Ljg5OCA1My4wNzY1IDE0LjgzVjkuMTMyWiIgZmlsbD0id2hpdGUiLz4KPHBhdGggZD0iTTM0LjI0NjkgMTYuN0gzNi43OTg5QzM2LjgyMDkgMTcuNjQ2IDM3LjUyNDkgMTguMjQgMzguNzU2OSAxOC4yNEM0MC4wMTA5IDE4LjI0IDQwLjY5MjkgMTcuNzM0IDQwLjY5MjkgMTYuOTQyQzQwLjY5MjkgMTYuMzkyIDQwLjQwNjkgMTUuOTk2IDM5LjQzODkgMTUuNzc2TDM3LjQ4MDkgMTUuMzE0QzM1LjUyMjkgMTQuODc0IDM0LjU3NjkgMTMuOTUgMzQuNTc2OSAxMi4yMTJDMzQuNTc2OSAxMC4wNzggMzYuMzgwOSA4LjgwMiAzOC44ODg5IDguODAyQzQxLjMzMDkgOC44MDIgNDIuOTgwOSAxMC4yMSA0My4wMDI5IDEyLjMyMkg0MC40NTA5QzQwLjQyODkgMTEuMzk4IDM5LjgxMjkgMTAuODA0IDM4Ljc3ODkgMTAuODA0QzM3LjcyMjkgMTAuODA0IDM3LjEwNjkgMTEuMjg4IDM3LjEwNjkgMTIuMTAyQzM3LjEwNjkgMTIuNzE4IDM3LjU5MDkgMTMuMTE0IDM4LjUxNDkgMTMuMzM0TDQwLjQ3MjkgMTMuNzk2QzQyLjI5ODkgMTQuMjE0IDQzLjIyMjkgMTUuMDUgNDMuMjIyOSAxNi43MjJDNDMuMjIyOSAxOC45MjIgNDEuMzUyOSAyMC4yODYgMzguNjY4OSAyMC4yODZDMzUuOTYyOSAyMC4yODYgMzQuMjQ2OSAxOC44MzQgMzQuMjQ2OSAxNi43WiIgZmlsbD0id2hpdGUiLz4KPHBhdGggZD0iTTMwLjg2MjQgMjBIMjguMTc4NFYxMS4zNzZIMjYuMDg4NFY5LjEzMkgyOC4xNzg0VjUuNzQ0SDMwLjg2MjRWOS4xMzJIMzIuOTc0NFYxMS4zNzZIMzAuODYyNFYyMFoiIGZpbGw9IndoaXRlIi8+CjxwYXRoIGQ9Ik0yMi42MTEzIDYuOTU0QzIxLjY4NzMgNi45NTQgMjAuOTYxMyA2LjIyOCAyMC45NjEzIDUuMzI2QzIwLjk2MTMgNC40MjQgMjEuNjg3MyAzLjcyIDIyLjYxMTMgMy43MkMyMy40OTEzIDMuNzIgMjQuMjE3MyA0LjQyNCAyNC4yMTczIDUuMzI2QzI0LjIxNzMgNi4yMjggMjMuNDkxMyA2Ljk1NCAyMi42MTEzIDYuOTU0Wk0yMS4yNjkzIDIwVjkuMTMySDIzLjk1MzNWMjBIMjEuMjY5M1oiIGZpbGw9IndoaXRlIi8+CjxwYXRoIGQ9Ik00LjUwOTk4IDIwSDEuNzgxOThWMy45MThINC41MDk5OEw5LjcwMTk4IDE2LjcyMkwxNC44OTQgMy45MThIMTcuNjY2VjIwSDE0LjkzOFYxNS4wNUMxNC45MzggMTEuODE2IDE0LjkzOCAxMC44NyAxNS4wOTIgOS43MjZMMTEgMjBIOC40MDM5OEw0LjMzMzk4IDkuNzQ4QzQuNDg3OTggMTAuNzE2IDQuNTA5OTggMTIuMjM0IDQuNTA5OTggMTQuMjM2VjIwWiIgZmlsbD0id2hpdGUiLz4KPC9zdmc+Cg=="
    const DEFAULT_BRAND_LIGHT = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIzIiBoZWlnaHQ9IjI0IiB2aWV3Qm94PSIwIDAgMTIzIDI0IiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPgo8cGF0aCBkPSJNMTE4LjA2NSAyMC40NjhDMTE2LjIyOSAyMC40NjggMTE0Ljc1MyAxOC45OTIgMTE0Ljc1MyAxNy4yMjhDMTE0Ljc1MyAxNS40MjggMTE2LjIyOSAxMy45NTIgMTE4LjA2NSAxMy45NTJDMTE5LjgyOSAxMy45NTIgMTIxLjM3NyAxNS40MjggMTIxLjM3NyAxNy4yMjhDMTIxLjM3NyAxOC45OTIgMTE5LjgyOSAyMC40NjggMTE4LjA2NSAyMC40NjhaIiBmaWxsPSIjMDBFRUZGIi8+CjxwYXRoIGQ9Ik0xMDguMDEgOS4xMzJIMTEwLjY5NFYyMEgxMDguMjA4TDEwOC4wMSAxOC41NDhDMTA3LjM1IDE5LjU4MiAxMDUuOTQyIDIwLjI4NiAxMDQuNDkgMjAuMjg2QzEwMS45ODIgMjAuMjg2IDEwMC41MDggMTguNTkyIDEwMC41MDggMTUuOTNWOS4xMzJIMTAzLjE5MlYxNC45ODRDMTAzLjE5MiAxNy4wNTIgMTA0LjAwNiAxNy44ODggMTA1LjUwMiAxNy44ODhDMTA3LjE5NiAxNy44ODggMTA4LjAxIDE2Ljg5OCAxMDguMDEgMTQuODNWOS4xMzJaIiBmaWxsPSJibGFjayIvPgo8cGF0aCBkPSJNOTguMzgzNiA5LjA4OFYxMS41NzRIOTcuMzkzNkM5NS40NTc2IDExLjU3NCA5NC4yNDc2IDEyLjYwOCA5NC4yNDc2IDE0LjcyVjIwSDkxLjU2MzZWOS4xNTRIOTQuMDkzNkw5NC4yNDc2IDEwLjczOEM5NC43MDk2IDkuNjYgOTUuNzQzNiA4LjkzNCA5Ny4xOTU2IDguOTM0Qzk3LjU2OTYgOC45MzQgOTcuOTQzNiA4Ljk3OCA5OC4zODM2IDkuMDg4WiIgZmlsbD0iYmxhY2siLz4KPHBhdGggZD0iTTgzLjczOTUgMjAuMjg2QzgwLjUwNTUgMjAuMjg2IDc4LjIzOTUgMTcuOTMyIDc4LjIzOTUgMTQuNTY2Qzc4LjIzOTUgMTEuMTU2IDgwLjQ2MTYgOC44MDIgODMuNjUxNiA4LjgwMkM4Ni45MDc2IDguODAyIDg4Ljk3NTUgMTAuOTggODguOTc1NSAxNC4zNjhWMTUuMTgyTDgwLjc5MTUgMTUuMjA0QzgwLjk4OTUgMTcuMTE4IDgyLjAwMTUgMTguMDg2IDgzLjc4MzUgMTguMDg2Qzg1LjI1NzUgMTguMDg2IDg2LjIyNTUgMTcuNTE0IDg2LjUzMzUgMTYuNDhIODkuMDE5NUM4OC41NTc1IDE4Ljg1NiA4Ni41Nzc1IDIwLjI4NiA4My43Mzk1IDIwLjI4NlpNODMuNjczNSAxMS4wMDJDODIuMDg5NSAxMS4wMDIgODEuMTIxNSAxMS44NiA4MC44NTc1IDEzLjQ4OEg4Ni4zMTM1Qzg2LjMxMzUgMTEuOTkyIDg1LjI3OTUgMTEuMDAyIDgzLjY3MzUgMTEuMDAyWiIgZmlsbD0iYmxhY2siLz4KPHBhdGggZD0iTTYxLjY1NjcgMjBINTguOTcyN1Y5LjEzMkg2MS40MzY3TDYxLjY1NjcgMTAuNDA4QzYyLjIwNjcgOS41MDYgNjMuMzA2NyA4LjgwMiA2NC44Njg3IDguODAyQzY2LjUxODcgOC44MDIgNjcuNjYyNyA5LjYxNiA2OC4yMzQ3IDEwLjg3QzY4Ljc4NDcgOS42MTYgNzAuMDYwNyA4LjgwMiA3MS43MTA3IDguODAyQzc0LjM1MDcgOC44MDIgNzUuODAyNyAxMC4zODYgNzUuODAyNyAxMi44OTRWMjBINzMuMTQwN1YxMy41OThDNzMuMTQwNyAxMi4wMzYgNzIuMzA0NyAxMS4yMjIgNzEuMDI4NyAxMS4yMjJDNjkuNzMwNyAxMS4yMjIgNjguNzQwNyAxMi4wNTggNjguNzQwNyAxMy44NFYyMEg2Ni4wNTY3VjEzLjU3NkM2Ni4wNTY3IDEyLjA1OCA2NS4yNDI3IDExLjI0NCA2My45NjY3IDExLjI0NEM2Mi42OTA3IDExLjI0NCA2MS42NTY3IDEyLjA4IDYxLjY1NjcgMTMuODRWMjBaIiBmaWxsPSJibGFjayIvPgo8cGF0aCBkPSJNNTMuMDc2NSA5LjEzMkg1NS43NjA1VjIwSDUzLjI3NDVMNTMuMDc2NSAxOC41NDhDNTIuNDE2NSAxOS41ODIgNTEuMDA4NSAyMC4yODYgNDkuNTU2NSAyMC4yODZDNDcuMDQ4NSAyMC4yODYgNDUuNTc0NSAxOC41OTIgNDUuNTc0NSAxNS45M1Y5LjEzMkg0OC4yNTg1VjE0Ljk4NEM0OC4yNTg1IDE3LjA1MiA0OS4wNzI1IDE3Ljg4OCA1MC41Njg1IDE3Ljg4OEM1Mi4yNjI1IDE3Ljg4OCA1My4wNzY1IDE2Ljg5OCA1My4wNzY1IDE0LjgzVjkuMTMyWiIgZmlsbD0iYmxhY2siLz4KPHBhdGggZD0iTTM0LjI0NjkgMTYuN0gzNi43OTg5QzM2LjgyMDkgMTcuNjQ2IDM3LjUyNDkgMTguMjQgMzguNzU2OSAxOC4yNEM0MC4wMTA5IDE4LjI0IDQwLjY5MjkgMTcuNzM0IDQwLjY5MjkgMTYuOTQyQzQwLjY5MjkgMTYuMzkyIDQwLjQwNjkgMTUuOTk2IDM5LjQzODkgMTUuNzc2TDM3LjQ4MDkgMTUuMzE0QzM1LjUyMjkgMTQuODc0IDM0LjU3NjkgMTMuOTUgMzQuNTc2OSAxMi4yMTJDMzQuNTc2OSAxMC4wNzggMzYuMzgwOSA4LjgwMiAzOC44ODg5IDguODAyQzQxLjMzMDkgOC44MDIgNDIuOTgwOSAxMC4yMSA0My4wMDI5IDEyLjMyMkg0MC40NTA5QzQwLjQyODkgMTEuMzk4IDM5LjgxMjkgMTAuODA0IDM4Ljc3ODkgMTAuODA0QzM3LjcyMjkgMTAuODA0IDM3LjEwNjkgMTEuMjg4IDM3LjEwNjkgMTIuMTAyQzM3LjEwNjkgMTIuNzE4IDM3LjU5MDkgMTMuMTE0IDM4LjUxNDkgMTMuMzM0TDQwLjQ3MjkgMTMuNzk2QzQyLjI5ODkgMTQuMjE0IDQzLjIyMjkgMTUuMDUgNDMuMjIyOSAxNi43MjJDNDMuMjIyOSAxOC45MjIgNDEuMzUyOSAyMC4yODYgMzguNjY4OSAyMC4yODZDMzUuOTYyOSAyMC4yODYgMzQuMjQ2OSAxOC44MzQgMzQuMjQ2OSAxNi43WiIgZmlsbD0iYmxhY2siLz4KPHBhdGggZD0iTTMwLjg2MjQgMjBIMjguMTc4NFYxMS4zNzZIMjYuMDg4NFY5LjEzMkgyOC4xNzg0VjUuNzQ0SDMwLjg2MjRWOS4xMzJIMzIuOTc0NFYxMS4zNzZIMzAuODYyNFYyMFoiIGZpbGw9ImJsYWNrIi8+CjxwYXRoIGQ9Ik0yMi42MTEzIDYuOTU0QzIxLjY4NzMgNi45NTQgMjAuOTYxMyA2LjIyOCAyMC45NjEzIDUuMzI2QzIwLjk2MTMgNC40MjQgMjEuNjg3MyAzLjcyIDIyLjYxMTMgMy43MkMyMy40OTEzIDMuNzIgMjQuMjE3MyA0LjQyNCAyNC4yMTczIDUuMzI2QzI0LjIxNzMgNi4yMjggMjMuNDkxMyA2Ljk1NCAyMi42MTEzIDYuOTU0Wk0yMS4yNjkzIDIwVjkuMTMySDIzLjk1MzNWMjBIMjEuMjY5M1oiIGZpbGw9ImJsYWNrIi8+CjxwYXRoIGQ9Ik00LjUwOTk4IDIwSDEuNzgxOThWMy45MThINC41MDk5OEw5LjcwMTk4IDE2LjcyMkwxNC44OTQgMy45MThIMTcuNjY2VjIwSDE0LjkzOFYxNS4wNUMxNC45MzggMTEuODE2IDE0LjkzOCAxMC44NyAxNS4wOTIgOS43MjZMMTEgMjBIOC40MDM5OEw0LjMzMzk4IDkuNzQ4QzQuNDg3OTggMTAuNzE2IDQuNTA5OTggMTIuMjM0IDQuNTA5OTggMTQuMjM2VjIwWiIgZmlsbD0iYmxhY2siLz4KPC9zdmc+Cg=="

    const MAX_BYTES = 1024 * 1024 // 1 MB per image
    // Storage-side bound: base64 inflation (+~33%) over a 1 MB source, plus margin.
    const MAX_STORED = MAX_BYTES * 2
    const ACCEPT_IMAGE = 'image/png,image/svg+xml'

    // ── locale dictionaries (en / zh / ko / ja, en fallback) ──────────────
    const DICT = {
      en: {
        title: 'Brand',
        intro: 'Swap in your brand: upload logos for light and dark themes and choose the hero mark.',
        lightLabel: 'Logo — light theme',
        darkLabel: 'Logo — dark theme',
        choose: 'Choose image…',
        replace: 'Replace',
        remove: 'Remove',
        preview: 'Preview',
        sizeHint:
          'Transparent PNG or SVG. Lockups: artwork ≥ 48 px tall (2× of the 24 px render) with side padding. Square marks: ≥ 96 px. The page height-caps it — wide is fine, tall is not.',
        heroShow: 'Show hero brand mark',
        heroIconLabel: 'Square icon — 34×34',
        heroHint:
          'The hero seat above the composer only fits a square 34 px mark — wide lockups won’t fit. Upload a transparent square PNG or SVG to use it.',
        saved: 'Saved — your brand is live now.',
        saveBtn: 'Save brand',
        revertBtn: 'Revert',
        dirtyHint: 'Changes apply when you click “Save brand”.',
        localOnly: 'Warning: saved to this browser only — it will be lost when the app restarts.',
        invalidType: 'Please choose a PNG or SVG file.',
        tooLarge: 'That image is larger than 1 MB — please use a smaller export.',
        readError: 'Could not read that file — please try again.',
        notConfigured: 'No wordmark configured yet — upload a logo above or configure the row.',
        taglineLabel: 'Hero tagline',
        taglinePlaceholder: 'Into the Unknown',
        taglineHint:
          'Replaces the blank-session headline above the composer. Leave empty to keep the default. Needs the hero tagline seam (conversation.hero.tagline), added by 05-dsh-core/patches/patch-hero-brand-tagline.mjs.',
        taglineNoSeam:
          'Saved, but this harness has no hero tagline seam yet — run 05-dsh-core/patches/patch-hero-brand-tagline.mjs and restart.',
      },
      zh: {
        title: '品牌',
        intro: '换上你的品牌：上传浅色/深色主题的标志，并选择主品牌标志。',
        lightLabel: '标志 — 浅色主题',
        darkLabel: '标志 — 深色主题',
        choose: '选择图片…',
        replace: '替换',
        remove: '移除',
        preview: '预览',
        sizeHint:
          '透明 PNG 或 SVG。横向组合标志：图案高度 ≥ 48px（渲染高度 24px 的 2 倍）并留出两侧边距；方形标志 ≥ 96px。页面按高度上限显示——宽度不限，高度受限。',
        heroShow: '显示主品牌标志',
        heroIconLabel: '方形图标 — 34×34',
        heroHint: '输入框上方的主标志槽位只能容纳 34px 方形标志——横向组合标志放不下。请上传透明方形 PNG 或 SVG。',
        saved: '已保存——品牌已生效。',
        saveBtn: '保存品牌',
        revertBtn: '还原',
        dirtyHint: '修改需点击“保存品牌”后才会生效。',
        localOnly: '警告：仅保存在当前浏览器中，应用重启后会丢失。',
        invalidType: '请选择 PNG 或 SVG 文件。',
        tooLarge: '该图片超过 1MB，请用更小尺寸的文件。',
        readError: '无法读取该文件，请重试。',
        notConfigured: '尚未配置文字标识——请在上方上传标志，或设置该插件。',
        taglineLabel: '主标题标语',
        taglinePlaceholder: '探索未至之境',
        taglineHint: '替换输入框上方空白会话的主标题。留空则保持默认文案。需要主标题标语接缝（conversation.hero.tagline），由 05-dsh-core/patches/patch-hero-brand-tagline.mjs 添加。',
        taglineNoSeam: '已保存，但当前运行环境还没有主标题标语接缝——请运行 05-dsh-core/patches/patch-hero-brand-tagline.mjs 并重启。',
      },
      ko: {
        title: '브랜드',
        intro: '브랜드 교체: 라이트/다크 테마용 로고와 히어로 마크를 설정하세요.',
        lightLabel: '로고 — 라이트 테마',
        darkLabel: '로고 — 다크 테마',
        choose: '이미지 선택…',
        replace: '교체',
        remove: '제거',
        preview: '미리보기',
        sizeHint:
          '투명 PNG 또는 SVG. 가로형 로고: 그림 높이 ≥ 48px(24px 렌더의 2배) · 여백 포함. 정사각형: ≥ 96px. 높이는 제한 — 너비는 무관합니다.',
        heroShow: '히어로 브랜드 마크 표시',
        heroIconLabel: '정사각형 아이콘 — 34×34',
        heroHint: '컴포저 위 히어로 슬롯은 34px 정사각형만 맞습니다 — 넓은 가로형 로고는 안 맞아요. 투명 정사각형 PNG 또는 SVG를 업로드하세요.',
        saved: '저장됨 — 브랜드가 적용되었습니다.',
        saveBtn: '브랜드 저장',
        revertBtn: '되돌리기',
        dirtyHint: '변경 사항은 “브랜드 저장”을 누르면 적용됩니다.',
        localOnly: '경고: 이 브라우저에만 저장됨 — 앱을 다시 시작하면 사라집니다.',
        invalidType: 'PNG 또는 SVG 파일을 선택해 주세요.',
        tooLarge: '이미지가 1MB를 초과합니다. 더 작은 파일을 사용하세요.',
        readError: '파일을 읽을 수 없습니다. 다시 시도해 주세요.',
        notConfigured: '워드마크가 아직 없습니다 — 위에서 로고를 올리거나 이 구성을 설정하세요.',
        taglineLabel: '히어로 태그라인',
        taglinePlaceholder: 'Into the Unknown',
        taglineHint: '컴포저 위 빈 세션 헤드라인을 바꿉니다. 비워 두면 기본 문구가 유지됩니다. 히어로 태그라인 시접(conversation.hero.tagline)이 필요하며, 05-dsh-core/patches/patch-hero-brand-tagline.mjs 가 추가합니다.',
        taglineNoSeam: '저장했지만 이 하네스에는 히어로 태그라인 시접이 아직 없습니다 — 05-dsh-core/patches/patch-hero-brand-tagline.mjs 실행 후 재시작하세요.',
      },
      ja: {
        title: 'ブランド',
        intro: 'ブランドを差し替え: ライト/ダーク用ロゴとヒーローマークを設定します。',
        lightLabel: 'ロゴ — ライトテーマ',
        darkLabel: 'ロゴ — ダークテーマ',
        choose: '画像を選択…',
        replace: '差し替え',
        remove: '削除',
        preview: 'プレビュー',
        sizeHint:
          '透明PNGまたはSVG。横長ロゴ: 図柄の高さは48px以上(24px表示の2倍)・余白付き。正方形マーク: 96px以上。高さ上限で表示されます — 幅は自由、高さは上限までです。',
        heroShow: 'ヒーローのブランドマークを表示',
        heroIconLabel: '正方形アイコン — 34×34',
        heroHint: 'コンポーザー上のヒーロースロットは34pxの正方形のみ収まります — 横長は入りません。透明の正方形PNGまたはSVGをアップロードしてください。',
        saved: '保存しました — ブランドが反映されました。',
        saveBtn: 'ブランドを保存',
        revertBtn: '元に戻す',
        dirtyHint: '変更は「ブランドを保存」を押すと反映されます。',
        localOnly: '警告: このブラウザのみに保存 — 再起動すると失われます。',
        invalidType: 'PNG または SVG ファイルを選択してください。',
        tooLarge: '画像が1MBを超えています。より小さい書き出しを使用してください。',
        readError: 'ファイルを読み込めませんでした。もう一度お試しください。',
        notConfigured: 'ワードマーク未設定です — 上でロゴをアップロードするか、この構成を設定してください。',
        taglineLabel: 'ヒーローのタグライン',
        taglinePlaceholder: 'Into the Unknown',
        taglineHint: 'コンポーザー上の空白セッションの見出しを差し替えます。空欄なら既定の文言のままです。ヒーローのタグライン接縫（conversation.hero.tagline）が必要で、05-dsh-core/patches/patch-hero-brand-tagline.mjs が追加します。',
        taglineNoSeam: '保存しましたが、このハーネスにはヒーローのタグライン接縫がまだありません — 05-dsh-core/patches/patch-hero-brand-tagline.mjs を実行して再起動してください。',
      },
    }

    // ── persistence: settings doc when available, else localStorage ───────
    let SCOPE = null
    let VALUE = { logoLight: '', logoDark: '', heroShow: false, heroIcon: '', brandTagline: '' }
    let REV = 0
    const listeners = new Set()
    const STRING_KEYS = ['logoLight', 'logoDark', 'heroIcon'] // image data-URLs only

    function readPersisted() {
      const out = { logoLight: '', logoDark: '', heroShow: false, heroIcon: '', brandTagline: '' }
      // Whether the durable settings namespace actually carries a tagline field
      // (it does once the host schema declares it) — see the merge note below.
      let scopeHasTagline = false
      const applyString = (source, target) => {
        for (const key of STRING_KEYS) {
          if (typeof source[key] === 'string' && source[key]) target[key] = source[key]
        }
        if (typeof source.brandTagline === 'string') target.brandTagline = source.brandTagline
        if (typeof source.heroShow === 'boolean') target.heroShow = source.heroShow
        else if (source.heroShow === 'true' || source.heroShow === 'false') target.heroShow = source.heroShow === 'true'
      }
      // Read the settings scope AND the localStorage cache independently, then merge.
      // The old code bailed as soon as the scope had *any* truthy field, so if the
      // scope carried e.g. `heroShow` but the (large) SVG logo had failed to write or
      // had been truncated there, a logo that WAS in localStorage was silently dropped —
      // the brand reverted to the wordmark+dot fallback after a reload / language switch.
      const fromScope = { logoLight: '', logoDark: '', heroShow: false, heroIcon: '', brandTagline: '' }
      try {
        // The settings scope snapshot carries the namespace fields flat (plus a
        // `revision`), e.g. { logoLight, logoDark, heroShow, heroIcon, revision }.
        // Accept a legacy `{ value: {...} }` envelope too, for older runtimes.
        const snap = SCOPE && typeof SCOPE.getSnapshot === 'function'
          ? SCOPE.getSnapshot() : undefined
        const scopeValue = (snap && typeof snap === 'object'
          && snap.value && typeof snap.value === 'object')
          ? snap.value
          : snap
        if (scopeValue && typeof scopeValue === 'object') {
          applyString(scopeValue, fromScope)
          scopeHasTagline = typeof scopeValue.brandTagline === 'string'
        }
      } catch { /* scope may be mid-adoption */ }
      const fromLocal = { logoLight: '', logoDark: '', heroShow: false, heroIcon: '', brandTagline: '' }
      try {
        const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(LS_KEY)
        if (raw) {
          const parsed = JSON.parse(raw)
          if (parsed && typeof parsed === 'object') applyString(parsed, fromLocal)
        }
      } catch { /* ignore corrupt cache */ }
      // Merge per field. Never let an empty/truncated value in one store shadow a real
      // logo in the other: prefer the longer (uncorrupted) data URL for image fields.
      // Only accept genuine image data-URLs; drop anything a tampered/oversized
      // store injected (the upload cap is not a read boundary). The pick() heuristic
      // assumes longer => less-truncated, which is fine for the two mirrors the doc
      // writes, but is a heuristic rather than a correctness rule.
      const isImageDataUrl = (v) =>
        typeof v === 'string' && v.startsWith('data:image/') && v.length <= MAX_STORED
      const clean = (v) => (isImageDataUrl(v) ? v : '')
      const pick = (a, b) => {
        if (!a) return b
        if (!b) return a
        return b.length > a.length ? b : a
      }
      out.logoLight = pick(clean(fromScope.logoLight), clean(fromLocal.logoLight))
      out.logoDark = pick(clean(fromScope.logoDark), clean(fromLocal.logoDark))
      out.heroIcon = pick(clean(fromScope.heroIcon), clean(fromLocal.heroIcon))
      out.heroShow = fromScope.heroShow || fromLocal.heroShow
      // Tagline is text, not an image: "longer wins" is the wrong rule. The durable
      // scope is authoritative, so a deliberate clear ('') in the host doc is what
      // renders — otherwise a stale localStorage copy would resurrect the old line
      // after the user emptied the field. The scope snapshot always carries the
      // namespace's declared keys, so an absent key (older doc) falls back to local.
      out.brandTagline = scopeHasTagline ? fromScope.brandTagline : fromLocal.brandTagline
      return out
    }

    // Commit one field. The value is applied locally (mirrored to the port-local
    // localStorage cache) immediately so the brand updates in-session; the
    // durable host-doc write is attempted through the settings scope and its
    // outcome reported (Promise<boolean>) — the Save flow only claims “saved”
    // when the host accepted it, because a local-only copy is lost on restart.
    // Host rejections are async (namespace unregistered, read-only provider), so
    // any thenable returned by set() is awaited and its failure turned into a
    // false instead of being swallowed.
    // True only when the bound scope is the durable HOST settings doc: loopback
    // "host" persistence, ready, and writable. A "memory" scope (non-loopback
    // page) is origin-scoped and lost on the next launch, so it must be reported
    // as local-only. The controller snapshot exposes mode / status / writable.
    function isDurableScope() {
      if (!SCOPE || typeof SCOPE.getSnapshot !== 'function') return false
      try {
        const snap = SCOPE.getSnapshot() || {}
        return snap.mode === 'host' && snap.status === 'ready' && snap.writable !== false
      } catch { return false }
    }

    function persist(field, value) {
      VALUE = { ...VALUE, [field]: value }
      REV += 1
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(LS_KEY, JSON.stringify(VALUE))
        }
      } catch { /* storage may be unavailable */ }
      for (const fn of [...listeners]) fn()
      if (!SCOPE || typeof SCOPE.set !== 'function') return Promise.resolve(false)
      let outcome
      try {
        outcome = SCOPE.set(field, value)
      } catch { return Promise.resolve(false) }
      // The settings scope settles its promise even when the host write was
      // skipped or rejected (non-loopback "memory" persistence, an unregistered
      // or read-only namespace) — the failure is folded into the mirror, not
      // thrown. So never infer "saved" from the promise resolving; confirm the
      // durable host doc actually accepted the value first.
      const confirm = async (settled) => {
        try { await settled } catch { return false }
        return isDurableScope()
      }
      if (outcome && typeof outcome.then === 'function') {
        return outcome.then(confirm)
      }
      return Promise.resolve(isDurableScope())
    }

    function subscribe(fn) {
      listeners.add(fn)
      let disposed = false
      const unsub = SCOPE && typeof SCOPE.subscribe === 'function'
        ? (() => { try { return SCOPE.subscribe(() => { VALUE = readPersisted(); for (const f of [...listeners]) f() }) } catch { return null } })()
        : null
      return () => {
        if (disposed) return
        disposed = true
        listeners.delete(fn)
        if (typeof unsub === 'function') { try { unsub() } catch { /* noop */ } }
      }
    }

    function getSnapshot() {
      return VALUE
    }

    // ── theme-aware logo CSS (switches on DSH's resolved theme attribute) ──
    const CSS = [
      '.bs-logo{max-height:24px;width:auto;max-width:100%;object-fit:contain;vertical-align:middle;flex:none}',
      '.bs-logo--dark{display:none}',
      'body[data-ds-dark-theme] .bs-logo--light{display:none}',
      'body[data-ds-dark-theme] .bs-logo--dark{display:inline-block}',
      '.bs-hero{width:34px;height:34px;object-fit:contain;display:inline-block;vertical-align:middle}',
      // Hero tagline: rendered in the upstream headline text node's place inside
      // the hero row, so it inherits the shipped hero typography (handed in as
      // `headlineClassName`). These variables only let a brand tune it; a brand
      // that sets none renders exactly like the shipped headline.
      '.bs-tagline{color:var(--bs-tagline-color,inherit);font-size:var(--bs-tagline-font-size,inherit);font-weight:var(--bs-tagline-font-weight,inherit);letter-spacing:var(--bs-tagline-letter-spacing,inherit);text-align:center}',
      '.bs-brand-page{display:flex;flex-direction:column;gap:18px;max-width:620px}',
      '.bs-brand-card{border:1px solid var(--dsw-alias-border-l2);border-radius:10px;padding:14px;background:var(--dsw-alias-bg-layer-1);display:flex;flex-direction:column;gap:10px}',
      '.bs-brand-card h3{margin:0;font-size:14px;font-weight:600;color:var(--dsw-alias-label-primary)}',
      // Preview canvas matches the uploader's theme: the LIGHT-theme cell gets a
      // light canvas (its artwork is drawn for light surfaces), the DARK-theme
      // cell keeps the dark canvas. Static colors (not theme tokens) so each
      // preview reads correctly no matter which app theme is active.
      '.bs-brand-preview{min-height:64px;border:1px dashed rgba(255,255,255,.16);border-radius:8px;background:var(--dsw-static-neutral-bluish-900,#1b1b1c);display:flex;align-items:center;justify-content:center;padding:10px;overflow:hidden}',
      '.bs-brand-preview--light{background:#f4f3f0;border-color:rgba(18,18,24,.16)}',
      '.bs-brand-preview--light .bs-brand-preview--empty{color:#8a8a92}',
      '.bs-brand-preview img{max-height:44px;max-width:100%;object-fit:contain}',
      '.bs-brand-preview--empty{color:var(--dsw-alias-label-tertiary);font-size:12px}',
      '.bs-brand-hint{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:1.6;margin:0}',
      '.bs-logo-cell-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}',
      '.bs-brand-btn{font:inherit;font-size:13px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);border-radius:7px;padding:5px 12px;cursor:pointer}',
      '.bs-brand-btn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}',
      '.bs-brand-msg{font-size:13px;color:var(--dsw-alias-state-success-primary)}',
      '.bs-logo-row{display:flex;gap:12px}',
      '.bs-logo-cell{flex:1;display:flex;flex-direction:column;gap:10px;min-width:0}',
      '.bs-logo-cell-label{font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary)}',
      '.bs-switch{display:inline-flex;align-items:center;gap:10px;font-size:13px;color:var(--dsw-alias-label-primary);cursor:pointer;user-select:none}',
      '.bs-switch input{position:absolute;opacity:0;width:0;height:0;margin:0}',
      '.bs-switch .bs-switch-track{position:relative;flex:none;width:36px;height:20px;border-radius:999px;background:var(--dsw-alias-border-l2);box-shadow:inset 0 0 0 1px var(--dsw-alias-border-l2);transition:background .15s ease}',
      '.bs-switch .bs-switch-track:after{content:"";position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:var(--dsw-alias-label-primary);transition:transform .15s ease}',
      '.bs-switch input:checked + .bs-switch-track{background:var(--dsw-alias-state-business-primary);box-shadow:inset 0 0 0 1px var(--dsw-alias-state-business-primary)}',
      '.bs-switch input:checked + .bs-switch-track:after{transform:translateX(16px);background:#fff}',
      '.bs-switch input:focus-visible + .bs-switch-track{outline:2px solid var(--dsw-alias-label-tertiary);outline-offset:2px}',
      '.bs-brand-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}',
      '.bs-tagline-input{font:inherit;font-size:13px;width:100%;box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);border-radius:7px;padding:7px 10px}',
      '.bs-tagline-input:focus{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:1px}',
      '.bs-brand-btn--primary{background:var(--dsw-alias-state-business-primary);border-color:transparent;color:#fff;font-weight:600}',
      '.bs-brand-btn--primary:hover:not(:disabled){background:var(--dsw-alias-state-business-primary);filter:brightness(1.12)}',
      '.bs-brand-btn:disabled{opacity:.45;cursor:default}',
      '.bs-brand-msg--warn{color:var(--dsw-alias-state-warn-primary)}',
      '.bs-brand-msg--ok{color:var(--dsw-alias-state-success-primary)}',
    ].join('\n')

    function injectCss() {
      if (typeof document === 'undefined') return
      const tagId = '@muen/dsh-brand-swap/style.css'
      if (document.querySelector('style[data-plugin-css=' + JSON.stringify(tagId) + ']')) return
      const tag = document.createElement('style')
      tag.dataset.plugin = 'dsh-brand-swap'
      tag.dataset.pluginCss = tagId
      tag.textContent = CSS
      document.head.appendChild(tag)
    }

    function activeLang() {
      try {
        const l = (typeof document !== 'undefined' && document.documentElement.lang) || 'en'
        if (l.startsWith('zh')) return 'zh'
        if (l.startsWith('ko')) return 'ko'
        if (l.startsWith('ja')) return 'ja'
        return 'en'
      } catch { return 'en' }
    }

    // Dictionary-first translation — the locator service is not relied on for
    // these strings (using it could return the raw key instead of the value).
    function translate(key) {
      const dict = DICT[activeLang()] || DICT.en
      return dict[key] || DICT.en[key] || key
    }

    // ── does the running harness carry the `conversation.hero.tagline` seam? ──
    // The seam is added by 05-dsh-core/patches/patch-hero-brand-tagline.mjs (see
    // that script for why a plugin cannot create the slot itself). A page cannot
    // ask the slot registry whether a name is renderable, and the bundle is served
    // on an authenticated route, so an HTTP probe is both wrong and unreliable.
    // The honest signal is the occupant itself: the seam is the only caller that
    // passes `fallbackText`, so HeroTagline observing that prop IS the proof that
    // this harness renders the seat. Before the hero has ever mounted the answer
    // is simply unknown, and an unknown harness stays quiet instead of warning.
    let SEAM = 'unknown' // 'unknown' | 'present'

    // Accept PNG or SVG. SVG is rendered through an <img> data-URL, which is inert
    // Accept PNG or SVG. SVG is rendered through an <img> data-URL, which is inert
    // (no external loads or scripts), so it is safe to persist and re-render.
    function isAcceptedImage(file) {
      return file
        && (file.type === 'image/png' || file.type === 'image/svg+xml' || /\.(png|svg)$/i.test(file.name))
    }

    function apply(ctx) {
      injectCss()
      try {
        const scopeService = typeof ctx.get === 'function' ? ctx.get('settingsScope') : undefined
        SCOPE = scopeService && typeof scopeService.bind === 'function'
          ? scopeService.bind({ namespace: 'brand-swap' })
          : null
      } catch { SCOPE = null }
      VALUE = readPersisted()

      // Register own locale dictionaries when the locale service is present.
      try {
        const locale = typeof ctx.get === 'function' ? ctx.get('locale') : undefined
        if (locale && typeof locale.register === 'function') {
          const langs = { en: DICT.en, zh: DICT.zh, ko: DICT.ko, ja: DICT.ja }
          locale.register(NS, langs) // throws on duplicate (ns, locale) — single instance, safe
        }
      } catch { /* locale optional */ }

      // ── brand seats ──────────────────────────────────────────────────────
      // The brand is a single 24px-height slot rendering a PNG or SVG logo — the
      // logo IS the brand. No wordmark text, no dot fallback (removed: the bare
      // dot looked broken when no wordmark was configured).

      const SidebarName = () => {
        const logos = useSyncExternalStoreSafe(subscribe, getSnapshot)
        // Client logo wins; else fall back to the default Mitsumeru brand (blue dot).
        const light = logos.logoLight || DEFAULT_BRAND_LIGHT
        const dark = logos.logoDark || DEFAULT_BRAND_DARK
        const hasLight = Boolean(light)
        const hasDark = Boolean(dark)
        // Both present → theme-switched pair (client pair, or the default pair).
        if (hasLight && hasDark) {
          return h('span', { 'data-ls-skip': '', style: { display: 'inline-flex', alignItems: 'center', maxWidth: '100%', minWidth: 0, overflow: 'hidden' } },
            h('img', { key: 'light', className: 'bs-logo bs-logo--light', src: light, alt: '', draggable: false }),
            h('img', { key: 'dark', className: 'bs-logo bs-logo--dark', src: dark, alt: '', draggable: false }))
        }
        const src = hasLight ? light : dark
        return h('span', { 'data-ls-skip': '', style: { display: 'inline-flex', alignItems: 'center', maxWidth: '100%', minWidth: 0, overflow: 'hidden' } },
          h('img', { className: 'bs-logo', src, alt: '', draggable: false }))
      }

      const SidebarMark = () => null

      // Hero (above composer): only a square 34 px mark fits. Hidden unless the
      // Settings page enables it and a square icon is uploaded.
      const HeroMark = () => {
        const logos = useSyncExternalStoreSafe(subscribe, getSnapshot)
        if (!logos.heroShow || !logos.heroIcon) return null
        return h('img', { 'data-ls-skip': '', className: 'bs-hero', src: logos.heroIcon, alt: '', draggable: false })
      }

      // Hero tagline: occupies the `conversation.hero.tagline` seam that the
      // HeroShell patch adds in place of the headline text node. The seam is
      // additive and OPTIONAL:
      //
      //   - An empty `brandTagline` re-renders the upstream headline text handed
      //     in as `fallbackText`, so the occupant can always be registered and the
      //     words never disappear while the brand is being edited. (Registering a
      //     component that returned null would blank the headline, because a
      //     registered occupant replaces the slot's own fallback.)
      //   - On a harness WITHOUT the seam this registration simply never renders;
      //     nothing else changes, and the Settings page says so.
      const HeroTagline = ({ fallbackText, headlineClassName }) => {
        // Running means the patched HeroShell rendered this seat — see SEAM above.
        // Only the scalar is kept; owner props are live data and are not retained.
        if (SEAM !== 'present' && typeof fallbackText === 'string') {
          SEAM = 'present'
          for (const fn of [...listeners]) fn()
        }
        const logos = useSyncExternalStoreSafe(subscribe, getSnapshot)
        const text = logos.brandTagline || fallbackText
        if (!text) return null
        return h('span', {
          'data-ls-skip': '',
          className: headlineClassName ? headlineClassName + ' bs-tagline' : 'bs-tagline',
        }, text)
      }

      ctx.slots.inject('sidebar.brand.mark', () =>
        ctx.slots.inject('sidebar.brand.name', () =>
          ctx.slots.inject('conversation.hero.brand.mark', function* () {
            yield ctx.slots.register({ name: 'sidebar.brand.mark' }, SidebarMark)
            yield ctx.slots.register({ name: 'sidebar.brand.name' }, SidebarName)
            yield ctx.slots.register({ name: 'conversation.hero.brand.mark' }, HeroMark)
            // Try the tagline seat on its own so a harness without the seam (an
            // unpatched build) cannot take the three seats above down with it.
            try {
              yield ctx.slots.inject('conversation.hero.tagline', () =>
                ctx.slots.register({ name: 'conversation.hero.tagline' }, HeroTagline))
            } catch { /* seam absent → tagline is a no-op on this build */ }
          })))

      // ── Settings → Brand page (draft → explicit Save) ─────────────────────
      // Uploads and toggles are staged in local state (live previews, nothing
      // persisted). “Save brand” commits all fields through persist(), which
      // writes the host settings doc (durable) + a localStorage mirror and
      // reports whether the host write succeeded — the page warns when only the
      // browser copy was saved (lost when the app restarts and rebinds its port).
      const readFileAsDataUrl = (file, onOk, onError) => {
        const reader = new FileReader()
        reader.onload = () => onOk(String(reader.result))
        reader.onerror = () => onError(translate('readError'))
        reader.readAsDataURL(file)
      }

      const LogoCell = ({ field, label, value, onChange }) => {
        const [error, setError] = React.useState(null)
        const pick = (event) => {
          const file = event.target.files && event.target.files[0]
          event.target.value = ''
          if (!file) return
          if (!isAcceptedImage(file)) { setError(translate('invalidType')); return }
          if (file.size > MAX_BYTES) { setError(translate('tooLarge')); return }
          setError(null)
          readFileAsDataUrl(file,
            (dataUrl) => onChange(field, dataUrl),
            (message) => setError(message))
        }
        const btnLabel = value ? translate('replace') : translate('choose')
        return h('div', { className: 'bs-logo-cell' },
          h('div', { className: 'bs-logo-cell-label' }, label),
          h('div', { className: 'bs-brand-preview' + (field === 'logoLight' ? ' bs-brand-preview--light' : '') },
            value
              ? h('img', { src: value, alt: '', draggable: false })
              : h('span', { className: 'bs-brand-preview--empty' }, translate('preview'))),
          h('div', { className: 'bs-logo-cell-actions' },
            h('label', { className: 'bs-brand-btn', style: { display: 'inline-block' } },
              btnLabel,
              h('input', {
                type: 'file',
                accept: ACCEPT_IMAGE,
                style: { display: 'none' },
                onChange: pick,
              })),
            value && h('button', { className: 'bs-brand-btn', onClick: () => { onChange(field, ''); setError(null) } },
              translate('remove'))),
          error && h('div', { className: 'bs-brand-msg bs-brand-msg--warn' }, error))
      }

      const BrandSettingsPage = () => {
        const committed = useSyncExternalStoreSafe(subscribe, getSnapshot)
        const [draft, setDraft] = React.useState(() => ({ ...committed }))
        const [saving, setSaving] = React.useState(false)
        const [notice, setNotice] = React.useState(null) // { kind: 'ok'|'warn', text }
        const FIELDS = ['logoLight', 'logoDark', 'heroIcon', 'heroShow', 'brandTagline']
        const setField = (field, value) => { setDraft((d) => ({ ...d, [field]: value })); setNotice(null) }
        const dirty = FIELDS.some((key) => draft[key] !== committed[key])
        const save = async () => {
          setSaving(true)
          // Persist only the fields the user actually changed — the draft is seeded
          // from a mount-time snapshot, so writing everything would clobber a newer
          // host value (e.g. an external edit) with the stale draft.
          const dirtyKeys = FIELDS.filter((key) => draft[key] !== committed[key])
          const results = await Promise.all(dirtyKeys.map((key) => persist(key, draft[key])))
          setSaving(false)
          const hostOk = results.every(Boolean)
          setNotice({ kind: hostOk ? 'ok' : 'warn', text: translate(hostOk ? 'saved' : 'localOnly') })
          // A tagline saved onto a harness without the seam persists but cannot
          // render — say so instead of leaving a "saved" that looks broken. The
          // hero is mounted on this page, so SEAM has already been observed.
          if (hostOk && dirtyKeys.includes('brandTagline') && SEAM === 'unknown') {
            setNotice((current) => current && { ...current, text: translate('taglineNoSeam') })
          }
        }
        const revert = () => { setDraft({ ...committed }); setNotice(null) }
        return h('div', { className: 'bs-brand-page' },
          h('p', { style: { color: 'var(--dsw-alias-label-secondary)', fontSize: 13, lineHeight: 1.6, margin: 0 } },
            translate('intro')),
          h('h3', null, translate('title')),
          h('div', { className: 'bs-brand-card' },
            h('div', { className: 'bs-logo-row' },
              h(LogoCell, { field: 'logoLight', label: translate('lightLabel'), value: draft.logoLight, onChange: setField }),
              h(LogoCell, { field: 'logoDark', label: translate('darkLabel'), value: draft.logoDark, onChange: setField }))),
          h('p', { className: 'bs-brand-hint' }, translate('sizeHint')),
          h('div', { className: 'bs-brand-card' },
            h('label', { className: 'bs-switch' },
              h('input', { type: 'checkbox', checked: Boolean(draft.heroShow), onChange: (e) => setField('heroShow', e.target.checked) }),
              h('span', { className: 'bs-switch-track', 'aria-hidden': true }),
              h('span', { className: 'bs-switch-label' }, translate('heroShow'))),
            draft.heroShow && h(LogoCell, { field: 'heroIcon', label: translate('heroIconLabel'), value: draft.heroIcon, onChange: setField }),
            h('p', { className: 'bs-brand-hint' }, translate('heroHint'))),
          h('div', { className: 'bs-brand-card' },
            h('div', { className: 'bs-logo-cell-label' }, translate('taglineLabel')),
            h('input', {
              type: 'text',
              className: 'bs-tagline-input',
              maxLength: 200,
              value: draft.brandTagline || '',
              placeholder: translate('taglinePlaceholder'),
              onChange: (e) => setField('brandTagline', e.target.value),
            }),
            h('p', { className: 'bs-brand-hint' }, translate('taglineHint'))),
          h('div', { className: 'bs-brand-actions' },
            h('button', { className: 'bs-brand-btn bs-brand-btn--primary', disabled: !dirty || saving, onClick: save },
              translate('saveBtn')),
            h('button', { className: 'bs-brand-btn', disabled: !dirty || saving, onClick: revert },
              translate('revertBtn'))),
          dirty && !saving && h('p', { className: 'bs-brand-hint', style: { margin: 0 } }, translate('dirtyHint')),
          notice && h('div',
            { className: notice.kind === 'warn' ? 'bs-brand-msg bs-brand-msg--warn' : 'bs-brand-msg bs-brand-msg--ok' },
            notice.text))
      }

      ctx.slots.inject('settings.section', () =>
        ctx.slots.register({
          name: 'settings.section',
          id: 'brand',
          order: 15,
          label: () => translate('title'),
        }, BrandSettingsPage))
    }

    // useSyncExternalStore, guarded for older React builds.
    function useSyncExternalStoreSafe(sub, get) {
      return React.useSyncExternalStore
        ? React.useSyncExternalStore(sub, get, get)
        : (React.useState(get)[0])
    }

    // settingsScope is read optionally via ctx.get() so a host without the
    // service falls back to the local-only mirror (with a warning) instead of
    // blocking apply() — declaring it in inject would make the fallback dead.
    return { inject: ['slots'], apply }
  },
})
