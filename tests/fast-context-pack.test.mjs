// Pack rendering for @muen/dsh-fast-context.
//
// The retrieval's structured output becomes the `sections` a `snapshot` context
// message renders. Two rules matter more than the rest and are pinned here:
// every string that reaches the transcript is a string (a `String(undefined)` in
// a context card is a bug the model then reads), and an unusable pack produces
// nothing at all rather than a half-built row.

import assert from 'node:assert/strict'
import test from 'node:test'

import { extractPack, renderPack } from '../plugins/dsh-fast-context/lib/index.js'

const FULL = {
  workspace: { path: '/repo', name: 'repo' },
  stack: {
    languages: [{ name: 'TypeScript', share: '78%' }, { name: 'CSS' }],
    packageManager: 'pnpm',
    frameworks: ['React'],
    commands: { test: 'pnpm test', typecheck: 'pnpm typecheck' },
  },
  layout: [{ path: 'src', files: '42', note: 'app source' }],
  entryPoints: [{ path: 'src/main.ts', why: 'boots the app' }],
  keyDocs: [{ path: 'AGENTS.md', summary: 'house rules', mustFollow: ['typecheck before wrap-up'] }],
  conventions: [{ rule: 'no default exports', evidence: 'AGENTS.md:12' }],
  recentActivity: [{ commit: 'abc123', summary: 'add fast-context' }],
  unresolved: ['test coverage unknown'],
}

test('renders one named section per populated group', () => {
  const sections = renderPack(FULL, '/repo', 12000)
  assert.deepEqual(
    sections.map((section) => section.name),
    ['Workspace', 'Stack', 'Layout', 'Entry points', 'Key docs', 'Conventions', 'Recent activity', 'Unresolved'],
  )
  const stack = sections.find((section) => section.name === 'Stack')
  assert.match(stack.text, /Languages: TypeScript 78%, CSS/)
  assert.match(stack.text, /Package manager: pnpm/)
  assert.match(stack.text, /Test: pnpm test/)
})

test('layout is omitted when the child did not report one', () => {
  const withoutLayout = { ...FULL, layout: [] }
  const sections = renderPack(withoutLayout, '/repo', 12000)
  assert.equal(sections.some((section) => section.name === 'Layout'), false)
})

test('a partial pack renders only what it has', () => {
  const sections = renderPack({ workspace: { path: '/repo' } }, '/repo', 12000)
  assert.deepEqual(sections.map((section) => section.name), ['Workspace'])
})

test('an empty or unusable pack renders nothing', () => {
  assert.equal(renderPack({}, '/repo', 12000), null)
  assert.equal(renderPack(null, '/repo', 12000), null)
})

test('absent values never reach the transcript as text', () => {
  const sections = renderPack({
    workspace: { path: '/repo', name: 42 },
    stack: { languages: [{ name: 'Go', share: null }] },
    entryPoints: [{ path: 'main.go' }],
    conventions: [{ rule: 'gofmt' }],
  }, '/repo', 12000)
  for (const section of sections) {
    assert.equal(typeof section.text, 'string')
    assert.equal(section.text.includes('undefined'), false)
    assert.equal(section.text.includes('null'), false)
  }
  assert.match(sections.find((section) => section.name === 'Workspace').text, /Path: \/repo/)
})

test('the character ceiling trims the tail, never the head', () => {
  const sections = renderPack(FULL, '/repo', 120)
  const total = sections.reduce((sum, section) => sum + section.text.length, 0)
  assert.ok(total <= 120, `expected <= 120 chars, got ${total}`)
  assert.match(sections[0].text, /Path: \/repo/)
})

test('a structured result wins over the text', () => {
  const result = { structured: { workspace: { path: '/repo' } }, output: [{ type: 'text', text: 'ignored' }] }
  assert.deepEqual(extractPack(result).pack, { workspace: { path: '/repo' } })
})

test('a fenced JSON answer is recovered when structured never arrives', () => {
  const result = {
    output: [{ type: 'text', text: 'Here you go:\n```json\n{"workspace":{"path":"/repo"}}\n```' }],
  }
  assert.deepEqual(extractPack(result).pack, { workspace: { path: '/repo' } })
})

test('non-JSON text is kept verbatim rather than dropped', () => {
  const result = { output: [{ type: 'text', text: 'src/ has 42 files' }] }
  const extracted = extractPack(result)
  assert.equal(extracted.pack, null)
  assert.equal(extracted.raw, 'src/ has 42 files')
})

test('an empty result yields nothing to render', () => {
  assert.equal(extractPack(undefined).pack, null)
  assert.equal(extractPack({ output: [] }).pack, null)
})
