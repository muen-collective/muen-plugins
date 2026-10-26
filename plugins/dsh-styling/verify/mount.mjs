/**
 * The mount check. It is deliberately small and honest: it proves the two seams the
 * skill says make a pane exist at all, that the bundle parses, that the dictionaries
 * carry the same keys, and that the host registers the routes and tools the client
 * calls. It does not claim the pane renders — that needs a real page.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const client = readFileSync(join(root, 'lib', 'client.js'), 'utf8')
const host = readFileSync(join(root, 'lib', 'index.js'), 'utf8')
const patch = readFileSync(join(root, 'cordis.patch.yml'), 'utf8')

const checks = []
function check(label, fn) {
  let ok = false
  let detail = ''
  try {
    const answer = fn()
    ok = answer === true
    detail = ok ? '' : String(answer)
  } catch (error) {
    detail = String((error && error.message) || error)
  }
  checks.push({ label, ok, detail })
}

// 0. The bundle must PARSE — every other check reads it as text.
check('client bundle parses', () => {
  new vm.Script(client)
  return true
})

// 1. Both manifest blocks, or there is no pane.
check('package declares dsh.bundle.patch', () => (pkg.dsh && pkg.dsh.bundle && pkg.dsh.bundle.patch ? true : 'missing dsh.bundle.patch'))
check('package declares dsh.client', () => (pkg.dsh && pkg.dsh.client && pkg.dsh.client.platform === 'web' ? true : 'missing dsh.client.platform=web'))
check('client external is the primitives only', () => {
  const external = (pkg.dsh && pkg.dsh.client && pkg.dsh.client.external) || []
  return external.length === 1 && external[0] === '@deepseek-ai/dsh-client-ui-primitives' ? true : JSON.stringify(external)
})
check('bundle patch mounts the row', () => (patch.includes("id: styling") && patch.includes("name: '@muen/dsh-styling'") ? true : 'row missing'))

// 2. The loader contract: one script, one load, one factory.
check('one loader call with the package id', () => {
  const loads = client.match(/__ModuleLoader__\.load\(/g) || []
  return loads.length === 1 && client.includes("id: '@muen/dsh-styling'") ? true : 'load count ' + loads.length
})
check('requires only react, react-dom and the primitives', () => {
  const names = [...client.matchAll(/require\('([^']+)'\)/g)].map((match) => match[1])
  const allowed = new Set(['react', 'react-dom', '@deepseek-ai/dsh-client-ui-primitives'])
  const bad = names.filter((name) => !allowed.has(name))
  return bad.length === 0 ? true : bad.join(', ')
})
check('registers the type, the body and the title', () => {
  const wanted = ['sidebarRightTabs.register', "slots.inject('sidebar.right.pane.tab'", "slots.inject('sidebar.right.pane.tab.title'"]
  const missing = wanted.filter((needle) => !client.includes(needle))
  return missing.length === 0 ? true : missing.join(', ')
})
check('registers the locale dictionaries', () => (client.includes('ctx.locale.register(NS, { en: EN, zh: ZH })') ? true : 'missing locale.register'))

// 3. Copy coverage: every key asked for exists in both dictionaries, and the two
// dictionaries carry the same keys. This executes the factory with stubs; no render.
let captured = null
global.window = { __ModuleLoader__: { load: (spec) => { captured = spec } } }
vm.runInThisContext(client, { filename: 'lib/client.js' })
const reactStub = {
  createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
  useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
  useEffect: () => {},
  useRef: (initial) => ({ current: initial }),
  useCallback: (fn) => fn,
}
const requireStub = (name) => {
  if (name === 'react') return reactStub
  if (name === 'react-dom') return { createPortal: (node) => node }
  if (name === '@deepseek-ai/dsh-client-ui-primitives') return {}
  throw new Error('unexpected require ' + name)
}
const exportsObject = captured && captured.factory ? captured.factory(requireStub) : null

check('factory returns inject/apply/copy', () => {
  if (!exportsObject) return 'factory did not return'
  if (!Array.isArray(exportsObject.inject)) return 'inject is not an array'
  if (typeof exportsObject.apply !== 'function') return 'apply is not a function'
  if (!exportsObject.copy) return 'copy seam missing'
  return true
})
check('en and zh carry the same keys', () => {
  const en = Object.keys(exportsObject.copy.EN).sort()
  const zh = Object.keys(exportsObject.copy.ZH).sort()
  const onlyEn = en.filter((key) => !zh.includes(key))
  const onlyZh = zh.filter((key) => !en.includes(key))
  return onlyEn.length === 0 && onlyZh.length === 0 ? true : 'en-only ' + onlyEn.join(',') + ' · zh-only ' + onlyZh.join(',')
})
check('every t(key) asked for is in the dictionary', () => {
  const en = exportsObject.copy.EN
  const asked = new Set()
  const re = /\bt\('([^']+)'\)/g
  let match
  while ((match = re.exec(client)) !== null) asked.add(match[1])
  const missing = [...asked].filter((key) => !(key in en))
  return missing.length === 0 ? true : missing.join(', ')
})

// 3b. The PLP draws. StartPage is hook-free, so it can be called with a fixture
// and the whole tree walked. This catches the class of defect a source check
// cannot: a component that is undefined, a prop read that is not there, a t()
// call that returns nothing.
check('PLP renders a look card', () => {
  const components = exportsObject && exportsObject.components
  if (!components || typeof components.StartPage !== 'function') return 'components seam missing'
  const t = (key) => (exportsObject.copy.EN[key] !== undefined ? exportsObject.copy.EN[key] : key)
  const fixture = {
    id: 'look-001',
    num: 1,
    name: 'look 001',
    coverOriginal: '/tmp/looks/look 001-originals/a.jpg',
    coverFinal: null,
    finals: [],
    originals: ['/tmp/looks/look 001-originals/a.jpg'],
    views: [{ original: '/tmp/looks/look 001-originals/a.jpg', final: null }],
    approved: false,
    reviewed: false,
    runs: [],
    hasFinal: false,
  }
  const tree = components.StartPage({
    t,
    data: {
      root: '/tmp/looks',
      canChoose: true,
      canPreview: true,
      counts: { total: 1, approved: 0, toStyle: 1, withFinal: 0, noFinal: 1 },
      job: null,
      looks: [fixture],
    },
    phase: 'plp',
    error: null,
    busy: false,
    typed: '',
    setTyped: () => {},
    includeApproved: false,
    setIncludeApproved: () => {},
    notice: null,
    onAdd: () => {},
    onChoose: () => {},
    onRetry: () => {},
    onRefresh: () => {},
    onReveal: () => {},
    onQueue: () => {},
    onOpen: () => {},
    onApprove: () => {},
  })
  let seen = 0
  const walk = (node) => {
    if (node === null || node === undefined || typeof node === 'boolean') return
    if (Array.isArray(node)) {
      for (const child of node) walk(child)
      return
    }
    if (typeof node !== 'object') return
    if (typeof node.type === 'function') {
      seen += 1
      walk(node.type(node.props || {}))
      return
    }
    if (typeof node.type !== 'string') return
    seen += 1
    walk(node.children)
  }
  walk(tree)
  return seen > 5 ? true : 'tree had ' + seen + ' node(s)'
})

// 4. Host seams the client calls, and the tool names the agent sees.
check('host mounts the routes the client calls', () => {
  const wanted = ['/state', '/folder', '/probe', '/approve', '/name', '/regenerate', '/job', '/detail', '/image']
  const missing = wanted.filter((needle) => !host.includes('BASE + ' + "'" + needle + "'"))
  return missing.length === 0 ? true : missing.join(', ')
})
check('host registers the four agent tools', () => {
  const wanted = ['styling_probe', 'styling_queue', 'styling_approve', 'styling_name']
  const missing = wanted.filter((needle) => !host.includes("name: '" + needle + "'"))
  return missing.length === 0 ? true : missing.join(', ')
})
check('host path-jails the image route', () => (host.includes('folderHolding(wanted, current.root)') ? true : 'folderHolding call missing'))

// 5. The zoom arithmetic the stage depends on.
check('zoom keeps the point under the cursor', () => {
  const zoom = exportsObject && exportsObject.zoom
  if (!zoom) return 'zoom seam missing'
  const before = { scale: 1, offset: { x: 0, y: 0 } }
  const after = zoom.zoomAt(before, 2, { x: 100, y: 50 })
  // The point under (100,50) at scale 1 must still be under it at scale 2:
  // (100 - offset') / 2 === 100 with offset' = -100 → 100.
  return after.scale === 2 && Math.abs(after.offset.x + 100) < 1e-9 && Math.abs(after.offset.y + 50) < 1e-9 ? true : JSON.stringify(after)
})

const failed = checks.filter((entry) => !entry.ok)
for (const entry of checks) {
  console.log((entry.ok ? 'PASS' : 'FAIL') + '  ' + entry.label + (entry.detail ? '  — ' + entry.detail : ''))
}
console.log('')
console.log(checks.length - failed.length + '/' + checks.length + ' checks passed')
process.exit(failed.length === 0 ? 0 : 1)
