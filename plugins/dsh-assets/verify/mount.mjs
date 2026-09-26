/**
 * verify:mount — epic 63 A1's claim, asserted rather than intended.
 *
 * The claim: **the Assets library has a door and an honest empty room.** The shipped
 * `lib/client.js` is executed in a stubbed loader and driven exactly as the browser drives
 * it: the factory is called, `apply(ctx)` runs against a recording ctx, and every
 * registration the slice claims is read back off the recorder — the tab type under our id,
 * the body and chip keys beside it, the guide entry the Start page's card comes from, the
 * glyph it draws, and the copy in both languages.
 *
 * IT ALSO RENDERS THE PANE, THREE WAYS, against a stubbed host: while the answer is in
 * flight, when the host cannot be read, and when it answers no folders. The third is the
 * empty state A1 is made of, and it is checked as TEXT plus the two paths the pane shows,
 * because "no folders yet" without saying where it looked is the shrug this slice exists to
 * avoid.
 *
 * The pieces are the plugin's shared harness (`verify/harness.mjs`), so this suite and
 * `views` drive the client half the same way rather than in two dialects.
 *
 *   node verify/mount.mjs
 */
import { miniReact, textOf, collect, loadClient, recordingCtx, reporter, net, settle } from './harness.mjs'

const PKG_NAME = '@muen/dsh-assets'
const KIND = 'assets'
const NS = 'assets'
const GUIDE_ENTRY_ID = 'open'

const { check, note, finish } = reporter('verify:mount — epic 63 A1 (the Assets card and the empty room)')

const mini = miniReact()
const { registration, exports: exports_ } = await loadClient({ React: mini.React })
check('the client half registers itself under the package name', registration && registration.id === PKG_NAME, registration && registration.id)
check('and exposes a factory that needs only react', typeof registration.factory === 'function', typeof registration.factory)
check('the factory answers inject + apply', typeof exports_.apply === 'function' && Array.isArray(exports_.inject), JSON.stringify(exports_.inject))
check('and asks for the three services it registers through', ['slots', 'locale', 'sidebarRightTabs'].every((name) => exports_.inject.includes(name)), JSON.stringify(exports_.inject))

const { ctx, seen } = recordingCtx('en')
exports_.apply(ctx)

// ── the door ────────────────────────────────────────────────────────────────

const definition = seen.types[0]
check('one tab type is registered', seen.types.length === 1, seen.types.length + ' types')
check('under our own id', definition && definition.id === PKG_NAME, definition && definition.id)
check('as the assets kind', definition && definition.kind === KIND, definition && definition.kind)
check('with the extension priority a third-party surface carries', definition && definition.priority === 'extension', definition && definition.priority)
check('and a live chip label', typeof definition.title === 'function' && definition.title() === 'Assets', definition.title && definition.title())

const guide = definition && Array.isArray(definition.guide) ? definition.guide[0] : null
check('the Start page gets exactly one entry', definition && definition.guide.length === 1, definition && definition.guide.length)
check('the entry has the id a card is opened by', guide && guide.id === GUIDE_ENTRY_ID, guide && guide.id)
check('and a live title and description', guide && typeof guide.title === 'function' && guide.title() === 'Assets' && typeof guide.description() === 'string' && guide.description().length > 0, guide && guide.title() + ' / ' + guide.description())
check('and a glyph of its own, so no cube placeholder', typeof guide.icon === 'function' && guide.icon() !== null && guide.icon() !== undefined, typeof guide.icon)

// ── the body and the chip ───────────────────────────────────────────────────

const body = seen.slots.find((slot) => slot.options.name === 'sidebar.right.pane.tab')
const chip = seen.slots.find((slot) => slot.options.name === 'sidebar.right.pane.tab.title')
check('the pane body is registered against our key', !!body && body.options.key === PKG_NAME, body && body.options.key)
check('and it carries the namespace, so its copy re-reads on a language change', !!body && body.options.locale === NS, body && body.options.locale)
check('the chip is registered against the same key', !!chip && chip.options.key === PKG_NAME, chip && chip.options.key)
check('both arrive through the slot injection the harness documents', seen.injected.includes('sidebar.right.pane.tab') && seen.injected.includes('sidebar.right.pane.tab.title'), JSON.stringify(seen.injected))
check('every registration is registered as an effect, so unloading takes it away', seen.effects.length >= 4, JSON.stringify(seen.effects))

// ── the copy, in both languages ─────────────────────────────────────────────

const table = seen.locales[0] && seen.locales[0].table
check('the copy is registered under our own namespace', seen.locales.length === 1 && seen.locales[0].ns === NS, seen.locales.length + ' registrations')
const en = (table && table.en) || {}
const zh = (table && table.zh) || {}
const enKeys = Object.keys(en).sort()
const zhKeys = Object.keys(zh).sort()
check('english and chinese cover exactly the same keys', enKeys.length > 0 && JSON.stringify(enKeys) === JSON.stringify(zhKeys), enKeys.length + ' en / ' + zhKeys.length + ' zh')
check('no string is left as its own key', enKeys.every((key) => en[key] !== key && String(en[key]).trim() !== '') && zhKeys.every((key) => zh[key] !== key && String(zh[key]).trim() !== ''), enKeys.filter((key) => en[key] === key).join(', '))
check('the empty state is written, not implied', typeof en['pane.empty.title'] === 'string' && en['pane.empty.title'].length > 0 && typeof en['pane.empty.body'] === 'string' && en['pane.empty.body'].length > 20, en['pane.empty.title'])
check('and it says nothing is copied or moved', /copied|moved/i.test(en['pane.empty.body']), en['pane.empty.body'])

// ── the pane, rendered against three hosts ──────────────────────────────────

const renderPane = async (fetchImpl) => {
  net.fetch = fetchImpl
  try {
    mini.clear()
    let tree = null
    // Two passes: the first starts the read, the second draws what it answered.
    for (let pass = 0; pass < 2; pass += 1) {
      mini.reset()
      tree = body.component({ locale: { bind: () => (key) => en[key] || key } })
      mini.runEffects()
      await settle()
    }
    if (process.env.DEBUG_RENDER) console.log('  [debug] state =', JSON.stringify(mini.peek()))
    mini.reset()
    tree = body.component({ locale: { bind: () => (key) => en[key] || key } })
    return textOf(tree).join(' | ')
  } finally {
    net.fetch = () => Promise.reject(new Error('no stub installed'))
  }
}

{
  const text = await renderPane(() => new Promise(() => {}))
  check('while the host is answering, the pane says it is reading', text.includes('Reading folders'), text.slice(0, 80))
}

{
  const text = await renderPane(() => Promise.reject(new Error('ECONNREFUSED')))
  check('when the host cannot be read, the pane says so rather than showing an empty library', text.includes('could not be read') && text.includes('ECONNREFUSED'), text.slice(0, 120))
}

{
  const text = await renderPane(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ folders: [], root: '/Users/someone/Library/Application Support/Mitsumeru/mitsu-dsh/profiles/mitsu/assets', recordsRoot: '/Users/someone/Library/Application Support/Mitsumeru/mitsu-dsh/profiles/mitsu/generate' }),
    }),
  )
  check('with no folders, the pane draws the empty state', text.includes('No folders yet'), text.slice(0, 120))
  check('and it says what to do next', /Add the folder/i.test(text), text.slice(0, 200))
  check('and the library\'s own bookkeeping is NOT on screen', !text.includes('profiles/mitsu/assets') && !text.includes('profiles/mitsu/generate') && !text.includes('Library state'), text.slice(0, 200))
  check('the way in is drawn: one control, named Folder', text.includes('Folder'), text.slice(0, 160))
}

{
  const text = await renderPane((url) =>
    Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve(
          String(url).includes('/catalog')
            ? { assets: [], counts: { context: [{ value: 'yammaman', count: 0 }], date: [] }, total: 0, folders: [] }
            : { folders: [{ path: '/Users/someone/Desktop/yammaman', label: 'yammaman', addedAt: '2026-09-26T00:00:00.000Z' }], root: '/p/assets', recordsRoot: '/p/generate' },
        ),
    }),
  )
  check('with a folder added, the pane lists it instead of the empty state', text.includes('yammaman') && !text.includes('No folders yet'), text.slice(0, 160))
}

// ── the chip renders, and it wears the library's OWN mark ───────────────────

/**
 * THE MARK IS PART OF THE CLAIM (founder, 2026-09-26: *"the icon for assets card should not be
 * folder — folder is already used for workspace files"*). Two identity places draw it: this chip
 * and the Start-page card. A folder stays a folder where a folder IS the thing — the empty room,
 * the Finder link on a row and its reveal — so the suite asserts the identity places carry the
 * mark and NOT the folder glyph Workspace already uses.
 */
const marks = (tree) => collect(tree, (node) => node.props && node.props['data-assets-mark'] === 'yes')
const folderGlyphs = (tree) => collect(tree, (node) => node.props && node.props['data-stub-icon'] === 'folder')

{
  const tree = chip.component({ locale: { bind: () => (key) => en[key] || key } })
  const text = textOf(tree).join('')
  check('the chip draws the name', text.includes('Assets'), text)
  const mark = marks(tree)
  check('and the library’s own mark', mark.length === 1, mark.length + ' mark(s)')
  check('which is NOT the folder Workspace already uses', folderGlyphs(tree).length === 0, folderGlyphs(tree).length + ' folder glyph(s)')
  check(
    'and it is a real glyph: a 24-unit grid drawn at 16px, currentColor, stroke 1.5 — the harness’s own Regular weight',
    !!mark[0] && mark[0].type === 'svg' && mark[0].props.viewBox === '0 0 24 24' && mark[0].props.width === 16 && mark[0].props.height === 16 && mark[0].props.stroke === 'currentColor' && mark[0].props.strokeWidth === 1.5 && mark[0].children.length === 4,
    JSON.stringify(mark[0] && { viewBox: mark[0].props.viewBox, size: mark[0].props.width, stroke: mark[0].props.stroke, strokeWidth: mark[0].props.strokeWidth, paths: mark[0].children.length }),
  )
}

{
  const tree = guide.icon()
  const mark = marks(tree)
  check('the Start-page card wears the same mark, not a second Workspace folder', mark.length === 1 && folderGlyphs(tree).length === 0, mark.length + ' mark(s) / ' + folderGlyphs(tree).length + ' folder glyph(s)')
}

note('the live layer is the founder’s eyes: the Assets card on the Start page, carrying its own mark')

finish()
