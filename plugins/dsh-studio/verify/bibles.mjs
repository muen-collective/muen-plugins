/**
 * Character bibles (M3): the data-level drift guard, asserted.
 *
 * The M3 loop is create → draft → edit → approve (seal core v1) → revise. What
 * is checked: approval requires complete core paragraphs and seals them; a
 * sealed core paragraph can no longer be edited without revise; approve bumps
 * the core version; and the whole loop survives the routes so the pane's calls
 * hit the same rules the module enforces.
 */
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { emptyBible, editParagraph, approve, revise, verifyPrompt } from '../lib/bibles.js'
import { createHandler, createStore } from '../lib/index.js'

let failures = 0
function check(label, condition, detail) {
  if (condition) {
    console.log('  ok   ' + label)
  } else {
    failures += 1
    console.log('  FAIL ' + label + (detail ? ' -- ' + detail : ''))
  }
}

// ── the rules ────────────────────────────────────────────────────────────────

const bible = emptyBible('mitsu', 'Mitsu')
check('a new bible has eight empty slots', Object.keys(bible.paragraphs).length === 8 && bible.paragraphs.overview === '')
check('nothing is sealed at creation', bible.core === null && bible.gate === null)

const half = editParagraph(bible, 'overview', 'Mitsu, an exhausted hacker.')
check('editing a paragraph works pre-approval', half.ok && half.bible.paragraphs.overview === 'Mitsu, an exhausted hacker.')
check('a bad slot is refused', editParagraph(bible, 'nonesuch', 'x').code === 400)

const refused = approve(half.bible)
check('approving with empty core paragraphs is refused', refused.ok === false && refused.error.includes('identity'), refused.error)

let drafted = half.bible
for (const [slot, text] of [
  ['identity', 'Tall, thin, pale luminous skin with visible pores.'],
  ['makeup', 'Warm orange-red eyeshadow.'],
  ['hair', 'Jet-black, shoulder-length.'],
  ['outfit', 'Victorian maid uniform, black wool.'],
  ['pose', 'Half-lidded stance.'],
  ['environment', 'Neon convenience store at night.'],
  ['photography', 'Kodak Portra 400.'],
]) {
  const answer = editParagraph(drafted, slot, text)
  drafted = answer.bible
}

const approved = approve(drafted)
check('approve seals the core', approved.ok && approved.bible.core !== null)
check('seal records both core paragraphs', Object.keys(approved.bible.core.sealed).sort().join(',') === 'identity,overview')
check('seal version is 1', approved.bible.core.version === 1)
check('the gate is recorded', approved.bible.gate && approved.bible.gate.coreVersion === 1 && typeof approved.bible.gate.at === 'string')

// The drift guard: a sealed core paragraph is frozen.
const blocked = editParagraph(approved.bible, 'overview', 'New wording.')
check('editing a sealed core paragraph is refused', blocked.ok === false && blocked.error.includes('sealed'), blocked.error)
const sceneEdit = editParagraph(approved.bible, 'environment', 'A different room.')
check('scene paragraphs stay editable after approval', sceneEdit.ok)

// revise → edit → approve bumps the version (drift surfaced, not absorbed).
const reopened = revise(approved.bible)
check('revise unseals', reopened.bible.core === null && reopened.bible.gate === null)
const reworded = editParagraph(reopened.bible, 'overview', 'Mitsu, running on caffeine.')
const approved2 = approve(reworded.bible)
check('re-approval bumps the core version', approved2.ok && approved2.bible.core.version === 2)

// verifyPrompt: the assembled-prompt preflight.
const goodPrompt = approved2.bible.core.sealed.overview.text + '\n\n' + approved2.bible.core.sealed.identity.text
check('a verbatim prompt passes', verifyPrompt(approved2.bible, goodPrompt).ok)
const driftPrompt = goodPrompt.replace(approved2.bible.core.sealed.overview.text, 'A stranger entirely.')
const drift = verifyPrompt(approved2.bible, driftPrompt)
check('a re-worded core paragraph is drift', drift.ok === false && drift.drift.some((d) => d.slot === 'overview'), JSON.stringify(drift.drift))

// ── the routes carry the same rules ──────────────────────────────────────────

const dir = await mkdtemp(path.join(tmpdir(), 'dsh-studio-bible-'))
const llmCalls = []
const ctx = {
  get: (key) =>
    key === 'llm'
      ? {
          stream: (request) => {
            llmCalls.push(request)
            return (async function* () {
              yield { type: 'text', text: ['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight'].join('\n\n') }
              yield { type: 'finish' }
            })()
          },
        }
      : undefined,
}
const store = createStore(dir)
const handler = createHandler(store, ctx)
await store.createProject({ id: 'demo', name: 'Demo' })

function fakeReq(url, { method = 'POST', body } = {}) {
  const listeners = {}
  // Body events may be emitted before the handler attaches listeners (some
  // routes await the store first), so buffer and replay on attach.
  const pending = []
  let ended = false
  return {
    url,
    method,
    on: (event, fn) => {
      listeners[event] = fn
      if (event === 'data') {
        for (const chunk of pending) fn(chunk)
      }
      if (event === 'end' && ended) fn()
    },
    destroy: () => {},
    emitBody: () => {
      if (body !== undefined) {
        const chunk = Buffer.from(JSON.stringify(body))
        pending.push(chunk)
        if (listeners.data) listeners.data(chunk)
      }
      ended = true
      if (listeners.end) listeners.end()
    },
  }
}
function fakeRes() {
  return {
    statusCode: 0,
    body: undefined,
    setHeader() {},
    end(text) {
      this.body = text ? JSON.parse(text) : undefined
    },
  }
}
async function call(url, options) {
  const res = fakeRes()
  const req = fakeReq(url, options)
  const handled = handler(req, res)
  req.emitBody()
  await handled
  return res
}

{
  const res = await call('/plugins/studio/projects/demo/characters', { body: { id: 'mitsu', name: 'Mitsu' } })
  check('POST /characters creates a bible', res.statusCode === 200 && res.body.bible.id === 'mitsu', String(res.statusCode))
}
{
  const res = await call('/plugins/studio/projects/demo/characters/mitsu/draft', { body: { description: 'An exhausted hacker.' } })
  check('draft fills the eight slots through the seam', res.statusCode === 200 && res.body.bible.paragraphs.overview === 'One' && res.body.bible.paragraphs.photography === 'Eight', JSON.stringify(res.body && res.body.bible && res.body.bible.paragraphs))
  check('the Casting role rode as the system message', llmCalls[0].messages[0].role === 'system' && llmCalls[0].messages[0].content[0].text.includes('character bible'))
}
{
  const res = await call('/plugins/studio/projects/demo/characters/mitsu/edit', { body: { slot: 'overview', text: 'Edited by human.' } })
  check('edit persists through the route', res.statusCode === 200 && res.body.bible.paragraphs.overview === 'Edited by human.')
}
{
  const res = await call('/plugins/studio/projects/demo/characters/mitsu/approve', {})
  check('approve seals through the route', res.statusCode === 200 && res.body.bible.core.version === 1)
}
{
  const res = await call('/plugins/studio/projects/demo/characters/mitsu/edit', { body: { slot: 'overview', text: 'Drift attempt.' } })
  check('the route refuses editing a sealed core paragraph', res.statusCode === 409, String(res.statusCode))
}
{
  const res = await call('/plugins/studio/projects/demo/characters/mitsu/revise', {})
  check('revise reopens through the route', res.statusCode === 200 && res.body.bible.core === null)
}
{
  const res = await call('/plugins/studio/projects/demo/characters/ghost', {})
  check('an unknown character is 404', res.statusCode === 404, String(res.statusCode))
}

await rm(dir, { recursive: true, force: true })
console.log(failures ? '\n' + failures + ' failure(s)' : '\nbibles ok')
process.exit(failures ? 1 : 0)
