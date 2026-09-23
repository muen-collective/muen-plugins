/**
 * verify:mount — Epic 61 S1's claim, asserted rather than intended.
 *
 *   "the live client registration exists: the tab type is registered under our
 *    id, the body and title keys resolve, the guide entry appears" (§14)
 *
 * TWO LAYERS, and they prove different things.
 *
 *   CONTRACT (always runs). The shipped `lib/client.js` is executed in a stubbed
 *   loader and driven exactly as the browser drives it: the factory is called,
 *   `apply(ctx)` runs against a recording ctx, and every registration the slice
 *   claims is read back off the recorder — the type under our id, the manifest
 *   key `sidebar.right.pane.tab` under the same id, the chip key beside it, the
 *   guide entry the card comes from, and the copy in both languages. The pane
 *   component is then rendered with the real dictionary and its text asserted.
 *   This is source-level evidence: it proves the registration code does what S1
 *   says, not that a running harness accepted it.
 *
 *   LIVE (when the connected app answers). The running Harness Web UI is loaded
 *   in a headless Chromium and the guide card is looked for in the real DOM.
 *   This is the layer that catches "it mounted and reported success" — the
 *   dominant defect class of the 0.2.x period (§16). It needs a page: pass
 *   `--url`, or set DSH_WEB_URL, or leave it to the default below.
 *
 *   node verify/mount.mjs            contract + live (live skips if no page)
 *   node verify/mount.mjs --static   contract only
 *
 * A skip is printed as SKIP and does not fail the run; a live layer that ran and
 * disagreed DOES fail it. Nothing here spends coins or touches RunningHub.
 */
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')
const PKG_NAME = '@muen/dsh-generate'
const GENERATE_KIND = 'generate'
const NS = 'generate'
const GUIDE_ENTRY_ID = 'open'
/**
 * React, stood in for. Enough of it to render the pane once: the components use
 * `useState`, `useCallback` and `useEffect`, and effects do not run here — the
 * states behind that first render are driven in verify/wallet.mjs, which owns the
 * route they depend on.
 */
const REACT_STUB = {
  createElement: (type, props, ...children) => ({ type, props, children }),
  useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
  useCallback: (fn) => fn,
  useEffect: () => {},
  useMemo: (fn) => fn(),
  useRef: (initial) => ({ current: initial }),
}
/**
 * The shipped icon set, stood in for. An icon is a component taking
 * `{ size, className }`, and the guide draws it at 22 or 26px depending on
 * whether the entry has a description.
 */
const PRIMITIVES_STUB = {
  IconSparkle16: (props) => REACT_STUB.createElement('svg', { 'data-stub-icon': 'sparkle', ...props }),
}

const argv = process.argv.slice(2)
const flag = (name) => argv.includes(name)
const value = (name, fallback) => {
  const hit = argv.find((arg) => arg.startsWith(name + '='))
  return hit ? hit.slice(name.length + 1) : fallback
}

// ── the reporter (same shape as dsh-cms's, so a green run reads as evidence) ──

const rows = []
const check = (label, ok, detail) => rows.push({ label, status: ok ? 'pass' : 'fail', detail: detail == null ? '' : String(detail) })
const skip = (label, detail) => rows.push({ label, status: 'skip', detail: detail == null ? '' : String(detail) })
const note = (text) => rows.push({ label: text, status: 'note', detail: '' })

function finish() {
  let failed = 0
  process.stdout.write('\nverify:mount — Epic 61 S1 (install and mount)\n')
  for (const row of rows) {
    if (row.status === 'pass') continue
    if (row.status === 'note') {
      process.stdout.write('  ....  ' + row.label + '\n')
      continue
    }
    if (row.status === 'fail') failed += 1
    process.stdout.write(
      '  ' + (row.status === 'fail' ? 'FAIL' : 'SKIP') + '  ' + row.label + (row.detail ? '  —  ' + row.detail : '') + '\n',
    )
  }
  const passes = rows.filter((row) => row.status === 'pass').length
  const skips = rows.filter((row) => row.status === 'skip').length
  const total = rows.filter((row) => row.status !== 'note').length
  process.stdout.write('  ' + passes + '/' + total + ' passed' + (skips ? ', ' + skips + ' skipped' : '') + '\n')
  if (failed > 0) process.exitCode = 1
}

// ── contract layer ───────────────────────────────────────────────────────────

/** Load the shipped browser script in a stubbed loader, and return its factory. */
async function loadFactory() {
  const source = await readFile(join(ROOT, 'lib/client.js'), 'utf8')
  let captured = null
  const sandbox = {
    window: {
      __ModuleLoader__: {
        load: (registration) => {
          captured = registration
        },
      },
    },
    console,
  }
  vm.createContext(sandbox)
  vm.runInContext(source, sandbox, { filename: 'lib/client.js' })
  if (!captured) throw new Error('lib/client.js never called window.__ModuleLoader__.load')
  return captured
}

/** The recording ctx the browser's own services stand in for. */
function recordingCtx(locale = 'en') {
  const seen = { effects: [], locales: [], types: [], injected: [], slots: [] }
  const dicts = new Map()
  const ctx = {
    effect: (fn, id) => {
      seen.effects.push(id)
      fn()
      return () => {}
    },
    locale: {
      register: (ns, table) => {
        seen.locales.push({ ns, table })
        dicts.set(ns, table)
        return () => {}
      },
      // `bind(ns)` resolves through the locale in force at call time — that is
      // the property that makes a language change need no re-registration, so
      // the stub has to model it rather than reach for en directly.
      bind: (ns) => {
        const table = dicts.get(ns) || {}
        const dict = table[locale] || table.en || {}
        return (key) => (Object.prototype.hasOwnProperty.call(dict, key) ? dict[key] : key)
      },
    },
    sidebarRightTabs: {
      register: (definition) => {
        seen.types.push(definition)
        return () => {}
      },
    },
    slots: {
      inject: (name, callback) => {
        seen.injected.push(name)
        callback()
        return () => {}
      },
      register: (options, component) => {
        seen.slots.push({ options, component })
        return () => {}
      },
    },
  }
  return { ctx, seen }
}

/** Every string in a rendered stub tree, in order. */
function textOf(node, out = []) {
  if (node == null || node === false) return out
  if (typeof node === 'string' || typeof node === 'number') {
    out.push(String(node))
    return out
  }
  if (Array.isArray(node)) {
    for (const child of node) textOf(child, out)
    return out
  }
  for (const child of node.children || []) textOf(child, out)
  return out
}

async function contract() {
  const manifest = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf8'))
  const patch = await readFile(join(ROOT, 'cordis.patch.yml'), 'utf8')

  check('package name is ' + PKG_NAME, manifest.name === PKG_NAME, manifest.name)
  const patchPath = manifest.dsh && manifest.dsh.bundle && manifest.dsh.bundle.patch
  check('manifest declares a bundle patch', patchPath === './cordis.patch.yml', patchPath)
  const client = (manifest.dsh && manifest.dsh.client) || {}
  const clientPath = (manifest.exports && manifest.exports['./client']) || ''
  check('manifest declares a web client half', client.platform === 'web', client.platform)
  check(
    'the client half injects locale + the right panel',
    Array.isArray(client.inject) &&
      client.inject.includes('@deepseek-ai/dsh-client-locale') &&
      client.inject.includes('@deepseek-ai/dsh-client-ui-sidebar-right'),
    JSON.stringify(client.inject || []),
  )
  await readFile(join(ROOT, clientPath), 'utf8').then(
    () => check('the client half file exists at ' + clientPath, true),
    (error) => check('the client half file exists at ' + clientPath, false, error.message),
  )

  // The patch is one YAML document, a top-level array, one insert row (AGENTS.md).
  const patchLines = patch.split('\n')
  const insertLines = patchLines.filter((line) => /^- insert:\s*$/.test(line))
  check('the patch has exactly one top-level insert', insertLines.length === 1, insertLines.length + ' found')
  check('no second YAML document', !patchLines.some((line) => /^---\s*$/.test(line)), 'found a ---')
  check('the patch inserts our row id', /^\s*- id: generate\s*$/m.test(patch), 'row id missing')
  check(
    'the patch inserts our package',
    patch.split('\n').some((line) => line.trim().replace(/^- /, '') === "name: '" + PKG_NAME + "'"),
    'package name missing',
  )

  const registration = await loadFactory()
  check('the loader id is ' + PKG_NAME, registration.id === PKG_NAME, registration.id)

  const required = []
  const module = registration.factory((id) => {
    required.push(id)
    if (id === 'react') return REACT_STUB
    if (id === '@deepseek-ai/dsh-client-ui-primitives') return PRIMITIVES_STUB
    throw new Error('unexpected require: ' + id)
  })
  check(
    'the client half takes its icon from the shipped set, not a local drawing',
    required.includes('@deepseek-ai/dsh-client-ui-primitives'),
    required.join(', '),
  )
  const external = (manifest.dsh.client && manifest.dsh.client.external) || []
  check(
    'the manifest declares that import as external',
    external.includes('@deepseek-ai/dsh-client-ui-primitives'),
    JSON.stringify(external),
  )
  check(
    'the module injects slots, locale and the right-panel registry',
    Array.isArray(module.inject) &&
      ['slots', 'locale', 'sidebarRightTabs'].every((key) => module.inject.includes(key)),
    JSON.stringify(module.inject || []),
  )
  check('the module exports apply', typeof module.apply === 'function', typeof module.apply)
  if (typeof module.apply !== 'function') return

  const { ctx, seen } = recordingCtx()
  module.apply(ctx)

  check('every registration is effect-scoped (disposable)', seen.effects.length >= 4, seen.effects.join(', '))

  // copy
  const copy = seen.locales.find((entry) => entry.ns === NS)
  check('the ' + NS + ' namespace registers', !!copy, JSON.stringify(seen.locales.map((l) => l.ns)))
  if (copy) {
    const en = copy.table.en || {}
    const zh = copy.table.zh || {}
    const enKeys = Object.keys(en).sort()
    const zhKeys = Object.keys(zh).sort()
    check('en copy is present and non-empty', enKeys.length > 0, enKeys.length + ' keys')
    check('zh copy is present and non-empty', zhKeys.length > 0, zhKeys.length + ' keys')
    check(
      'en and zh cover the same keys',
      enKeys.length === zhKeys.length && enKeys.every((key, index) => key === zhKeys[index]),
      'en-only: ' + enKeys.filter((key) => !(key in zh)).join(', ') + ' · zh-only: ' +
        zhKeys.filter((key) => !(key in en)).join(', '),
    )
    check(
      'no copy value is empty in either language',
      Object.values(en).every((text) => String(text).trim()) && Object.values(zh).every((text) => String(text).trim()),
      'an empty string is a leaked key',
    )
  }

  // the type
  const definition = seen.types[0]
  check('exactly one tab type registers', seen.types.length === 1, seen.types.length + ' found')
  if (definition) {
    check("the type's id is the package name", definition.id === PKG_NAME, definition.id)
    check("the type's kind is '" + GENERATE_KIND + "'", definition.kind === GENERATE_KIND, definition.kind)
    check('the type is a page type (no address patterns)', definition.patterns === undefined, 'patterns declared')
    check(
      'the type does not claim the whole kind from the shipped types',
      definition.priority === 'extension',
      definition.priority,
    )
    const t = ctx.locale.bind(NS)
    check('the chip has live text', typeof definition.title === 'function' && !!definition.title(), definition.title && definition.title())
    const entry = (definition.guide || []).find((item) => item.id === GUIDE_ENTRY_ID)
    check('the guide offers an entry (this is the card)', !!entry, JSON.stringify((definition.guide || []).map((g) => g.id)))
    if (entry) {
      check('the guide entry has a title', typeof entry.title === 'function' && !!entry.title(), entry.title && entry.title())
      check(
        'the guide entry has a description',
        typeof entry.description === 'function' && !!entry.description(),
        entry.description && entry.description(),
      )
      check('the guide entry is ordered', typeof entry.order === 'number', entry.order)
      // Without an icon the guide draws its cube placeholder, which is the
      // mismatch these checks exist to prevent coming back.
      check(
        'the guide entry declares a glyph, so no placeholder cube',
        typeof entry.icon === 'function',
        entry.icon === undefined ? 'no icon declared' : typeof entry.icon,
      )
      const glyph = typeof entry.icon === 'function' ? entry.icon({ size: 26 }) : null
      check(
        'the glyph renders at the size the guide asks for',
        !!glyph && glyph.type === 'span',
        glyph ? glyph.type : 'did not render',
      )
      const svg = glyph && Array.isArray(glyph.children) ? glyph.children[0] : null
      check(
        'the glyph is the shipped sparkle, not a local drawing',
        !!svg && svg.type === PRIMITIVES_STUB.IconSparkle16 && svg.props.size === 26,
        svg ? svg.type.name || typeof svg.type : 'no glyph inside',
      )
      check(
        'the glyph is painted in the theme primary, so it tracks the brand',
        !!glyph && glyph.props.style && glyph.props.style.color === 'var(--dsw-alias-brand-primary)',
        glyph && glyph.props.style ? glyph.props.style.color : 'no color set (it would read as the grey ink)',
      )
      check(
        'nothing in the glyph hardcodes a colour',
        !JSON.stringify(glyph || {}).match(/#[0-9a-fA-F]{3,6}/),
        'a literal colour would break under another theme',
      )
      // The guide re-reads thunked copy on every use, which is why a language
      // change needs no re-registration. A captured string would break that.
      check(
        'the guide entry reads live copy (title and description are thunks)',
        typeof entry.title === 'function' && typeof entry.description === 'function',
        typeof entry.title + '/' + typeof entry.description,
      )
    }
  }

  // stage two: the body and the chip, both under the type's own id
  const body = seen.slots.find((slot) => slot.options.name === 'sidebar.right.pane.tab')
  const title = seen.slots.find((slot) => slot.options.name === 'sidebar.right.pane.tab.title')
  check('the body registers at sidebar.right.pane.tab', !!body, JSON.stringify(seen.injected))
  check('the body is keyed by the type id', !!body && body.options.key === PKG_NAME, body && body.options.key)
  check('the body carries the locale namespace', !!body && body.options.locale === NS, body && body.options.locale)
  check('the chip registers at sidebar.right.pane.tab.title', !!title, JSON.stringify(seen.injected))
  check('the chip is keyed by the type id', !!title && title.options.key === PKG_NAME, title && title.options.key)

  // the settings page (S2), then the pane's first render
  const settings = seen.slots.find((slot) => slot.options.name === 'settings.section')
  check('the settings page registers at settings.section', !!settings, JSON.stringify(seen.injected))
  check(
    "the settings page uses an id of its own, so it sits beside the shipped pages",
    !!settings && settings.options.id === 'generate',
    settings && settings.options.id,
  )
  check(
    'the settings page carries the locale namespace',
    !!settings && settings.options.locale === NS,
    settings && settings.options.locale,
  )
  check(
    'the settings page has a labelled nav row',
    !!settings && typeof settings.options.label === 'function' && !!settings.options.label(),
    settings && settings.options.label && settings.options.label(),
  )

  // The pane is wallet-first, so its first render is the wallet read in flight.
  // The states behind it (first-run field, strip, errors) are driven for real in
  // verify/wallet.mjs, which owns the route they depend on.
  if (body && copy) {
    const t = ctx.locale.bind(NS)
    const rendered = textOf(body.component({ t }))
    check(
      'the pane opens on the wallet read, not on a blank box',
      rendered.includes(copy.table.en['pane.loading']),
      rendered.join(' | '),
    )
    check(
      'the first-run copy exists in both languages (the key field is reachable)',
      !!copy.table.en['pane.first.title'] && !!copy.table.zh['pane.first.title'],
      copy.table.en['pane.first.title'],
    )
    check(
      'every wallet failure has copy in both languages',
      ['error.invalidKey', 'error.unreachable', 'error.timeout', 'error.readOnly', 'error.noCredentials'].every(
        (key) => !!copy.table.en[key] && !!copy.table.zh[key],
      ),
      'a missing key would render as its own name at the field',
    )
    const chip = title ? textOf(title.component({ t })) : []
    check('the chip renders the type label', chip.includes(copy.table.en['type.label']), chip.join(' | '))
  }
}

// ── live layer ───────────────────────────────────────────────────────────────

function loadPuppeteer() {
  const require = createRequire(import.meta.url)
  const candidates = [
    process.env.PUPPETEER_PATH,
    'puppeteer',
    join(homedir(), '.kun/hand-me-up/node_modules/puppeteer'),
    join(HERE, '../../../../node_modules/puppeteer'),
  ].filter(Boolean)
  for (const candidate of candidates) {
    try {
      return require(candidate)
    } catch (error) {
      /* try the next candidate */
    }
  }
  return null
}

/**
 * The card, found by our own attribute rather than by a phrase.
 *
 * It used to be looked up by the text "Generate", which stopped being the card's
 * label the moment S4's card learned to degrade to a single installed workflow —
 * with one app installed, the card IS that app, and the label is its title (§10).
 * A data attribute is the card's own, so the check reads the card and not a phrase
 * that another card could also carry (the rule this plugin's verifies already
 * follow for the pane's two notes).
 */
const CARD_SELECTOR = '[data-sidebar-right-guide-entry="generate"]'

async function live(url) {
  let puppeteer
  try {
    puppeteer = loadPuppeteer()
  } catch (error) {
    puppeteer = null
  }
  if (!puppeteer) {
    skip('live: the guide card renders on the running page', 'puppeteer unavailable — install it or run with --static')
    return
  }
  let browser
  try {
    browser = await puppeteer.launch({ headless: true })
    const page = await browser.newPage()
    const pageErrors = []
    page.on('pageerror', (error) => pageErrors.push(String((error && error.message) || error)))
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
    const status = response ? response.status() : 0
    if (status === 401 || status === 403) {
      // The Web UI authenticates the window the shell opened, not a stranger's
      // browser. Only the app's own token opens it, and hunting for that token is
      // out of bounds — so this layer says what it could not check rather than
      // guessing, and the live registration is read through the harness's own
      // client inspection instead (Slots.listSubTree, `sidebar.right.pane.tab`).
      skip('live: the guide card renders on the running page', url + ' answered ' + status + ' — needs the app window’s own token')
      return
    }
    check('live: the harness answers at ' + url, !!response && response.ok(), status)
    await page.waitForFunction(() => document.body && document.body.textContent.length > 0, { timeout: 20000 })
    await new Promise((resolve) => setTimeout(resolve, 1500))

    // The right column opens from the conversation header's corner control; the
    // guide page is what it shows when no tab is open.
    const findCard = () =>
      page.evaluate((selector) => {
        const node = document.querySelector(selector)
        if (!node) return null
        const box = node.getBoundingClientRect()
        return {
          tag: node.tagName,
          text: (node.textContent || '').trim().slice(0, 120),
          w: Math.round(box.width),
          h: Math.round(box.height),
        }
      }, CARD_SELECTOR)

    let hit = await findCard()
    if (hit === null) {
      const opened = await page.evaluate(() => {
        const controls = Array.from(document.querySelectorAll('button, [role="button"]'))
        const wanted = controls.find((control) => {
          const label = (control.getAttribute('aria-label') || control.title || control.textContent || '').toLowerCase()
          return /(right|panel|sidebar)/.test(label) && !/collapse/.test(label)
        })
        if (!wanted) return false
        wanted.click()
        return true
      })
      if (opened) {
        await new Promise((resolve) => setTimeout(resolve, 1200))
        hit = await findCard()
      }
    }

    check(
      'live: the guide card (' + CARD_SELECTOR + ') renders on the running page',
      hit !== null,
      hit !== null ? JSON.stringify(hit) : 'no element with that attribute; page errors: ' + (pageErrors.join(' | ') || 'none'),
    )
    check(
      'live: the card is labelled and has size',
      hit !== null && hit.text.length > 0 && hit.w > 0 && hit.h > 0,
      hit === null ? 'no card' : JSON.stringify(hit),
    )
  } catch (error) {
    check('live: the guide card is on the running page', false, String((error && error.message) || error))
  } finally {
    if (browser) await browser.close()
  }
}

// ── run ──────────────────────────────────────────────────────────────────────

await contract()

if (flag('--static')) {
  process.stdout.write('verify:mount — live layer skipped (--static)\n')
} else {
  const url = value('--url', process.env.DSH_WEB_URL || 'http://127.0.0.1:54775')
  await live(url)
}

finish()
