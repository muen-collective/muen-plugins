/**
 * Host-half verification — no harness, no app.
 *
 * Mounts the real `apply()` against a fake ctx (a web server seam and a tool seam),
 * then drives it over real HTTP. This is the gate for the two things that actually
 * break plugins: a route that never registers, and a tool that reads a store the
 * page does not write.
 *
 *   node verify/host.mjs
 */
import http from 'node:http'
import { promises as fsp } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { apply } from '../lib/index.js'

const checks = []
function check(name, condition, detail) {
  checks.push({ name, ok: Boolean(condition), detail })
  console.log(`${condition ? '  ok ' : '  FAIL'}  ${name}${condition ? '' : '  <-- ' + (detail ?? '')}`)
}

const dir = await mkdtemp(join(tmpdir(), 'muen-board-'))

/* ----- fake harness ----- */
const tools = new Map()
const fakeCtx = {
  logger: { warn: (m) => console.log('  warn:', m) },
  get(name) {
    if (name === 'tools') {
      return { register: (def) => (tools.set(def.name, def), () => undefined) }
    }
    if (name === 'webServer') {
      return {
        register: ({ handler }) => {
          fakeCtx._handler = handler
          return () => undefined
        },
      }
    }
    return undefined
  },
  effect(fn) {
    fn()
  },
}

const mounted = apply(fakeCtx, { dir })
check('apply() mounts the routes', mounted.routes === true, JSON.stringify(mounted))
check('apply() mounts both tools', mounted.tools === true && tools.size === 2, `tools=${tools.size}`)

/* ----- serve the registered handler over real HTTP ----- */
const server = http.createServer(async (req, res) => {
  const handled = await fakeCtx._handler(req, res)
  if (!handled) {
    res.writeHead(404)
    res.end('not ours')
  }
})
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const base = `http://127.0.0.1:${server.address().port}`

const get = async (p) => {
  const res = await fetch(base + p)
  const type = res.headers.get('content-type') || ''
  const body = type.includes('json') ? await res.json() : await res.text()
  return { status: res.status, body, type }
}

/* ----- the page ----- */
const page = await get('/plugins/board/')
check('GET /plugins/board/ serves html', page.status === 200 && page.type.includes('text/html'), page.status)
check(
  'the page carries the resolved prefix',
  String(page.body).includes("const PREFIX = '/plugins/board'"),
  'the page does not know where its own API lives',
)
check('the page has no unsubstituted token', !String(page.body).includes('__PREFIX__'), 'token left in place')

/* ----- a path outside the prefix is not ours ----- */
{
  const res = await fetch(base + '/plugins/other/thing')
  check('foreign path is not handled', res.status === 404, res.status)
}

/* ----- the store starts empty ----- */
const empty = await get('/plugins/board/api/state')
check('store starts at revision 0', empty.status === 200 && empty.body.revision === 0, JSON.stringify(empty.body))

/* ----- what the page writes, the tool reads ----- */
const saved = await fetch(base + '/plugins/board/api/state', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    elements: [
      { id: 'r1', kind: 'rect', x: 20, y: 30, w: 200, h: 90, label: 'hero, full width' },
      { id: 't1', kind: 'text', x: 20, y: 140, w: 220, h: 19, label: 'logo smaller' },
      { id: 'd1', kind: 'draw', x: 40, y: 40, points: [[40, 40], [90, 70], [140, 50]] },
      { id: 'bad', kind: 'nope' },
    ],
  }),
})
const savedBody = await saved.json()
check('POST bumps the revision', saved.status === 200 && savedBody.revision === 1, JSON.stringify(savedBody))
check('POST drops an unknown kind', savedBody.elements.length === 3, `kept ${savedBody.elements.length}`)

const read = tools.get('board_read')
const readOut = await read.execute({})
check('board_read sees what the page wrote', readOut.ok && readOut.revision === 1 && readOut.elements.length === 3, JSON.stringify(readOut.elements?.length))
check('board_read summarises a box with its bbox', JSON.stringify(readOut.elements[0].bbox) === '[20,30,200,90]', JSON.stringify(readOut.elements[0]))
check('board_read keeps the label as an instruction', readOut.elements[0].label === 'hero, full width', JSON.stringify(readOut.elements[0].label))
check('board_read reports a scribble as points+bbox', readOut.elements[2].kind === 'scribble' && readOut.elements[2].points === 3, JSON.stringify(readOut.elements[2]))

/* ----- what the tool writes, the page reads ----- */
const write = tools.get('board_apply')
const applied = await write.execute({
  ops: [
    { op: 'add', element: { kind: 'rect', x: 300, y: 300, w: 100, h: 40, label: 'button' } },
    { op: 'delete', id: 't1' },
  ],
})
check('board_apply reports what it did', applied.ok && applied.applied === 2 && applied.count === 3, JSON.stringify(applied))

const afterAgent = await get('/plugins/board/api/state')
check('the page sees the agent write', afterAgent.body.revision === 2 && afterAgent.body.elements.length === 3, JSON.stringify({ rev: afterAgent.body.revision, n: afterAgent.body.elements.length }))
check('the deleted shape is gone', !afterAgent.body.elements.some((e) => e.id === 't1'), 't1 survived')

/* ----- an empty op list is refused, not silently accepted ----- */
const noops = await write.execute({ ops: [] })
check('board_apply refuses an empty op list', noops.ok === false && noops.detail, JSON.stringify(noops))

/* ----- bad json is a 400, not a 500 ----- */
{
  const res = await fetch(base + '/plugins/board/api/state', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{not json',
  })
  check('bad JSON is a 400', res.status === 400, res.status)
}

/* ----- the file is the single store ----- */
const onDisk = JSON.parse(await fsp.readFile(join(dir, 'board.json'), 'utf8'))
check('one file holds the board', onDisk.revision === 2 && onDisk.elements.length === 3, JSON.stringify({ rev: onDisk.revision, n: onDisk.elements.length }))

server.close()
await rm(dir, { recursive: true, force: true })

const failed = checks.filter((c) => !c.ok)
console.log(`\n${checks.length - failed.length}/${checks.length} passed`)
process.exit(failed.length ? 1 : 0)
