/**
 * The BYOK chat seam (M2), asserted rather than intended.
 *
 * `lib/llm.js` rides the harness's `ctx.get('llm')` service — the same seam
 * dsh-recall's auto-propose uses. What is checked here is the contract, not the
 * provider: messages are shaped correctly (system first, then user), stream
 * chunks accumulate and stop at `finish`, a profile with no llm service answers
 * `no-llm` instead of throwing, and the /llm route refuses non-POST.
 */
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { complete } from '../lib/llm.js'
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

/** A fake llm service that records the call and streams a scripted answer. */
function fakeLlm(answer = 'hello', { throwError } = {}) {
  const calls = []
  return {
    calls,
    ctx: {
      get: (key) => (key === 'llm' ? {
        stream: (request) => {
          calls.push(request)
          return (async function* () {
            if (throwError) throw new Error(throwError)
            yield { type: 'text', text: answer.slice(0, 3) }
            yield { type: 'text', text: answer.slice(3) }
            yield { type: 'finish', reason: 'stop' }
            yield { type: 'text', text: 'NEVER' } // must not be read after finish
          })()
        },
      } : undefined),
    },
  }
}

// ── the seam call ────────────────────────────────────────────────────────────

const good = fakeLlm('hello world')
const answered = await complete(good.ctx, { system: 'You are the prompt desk.', user: 'Write a shot.', maxTokens: 64 })
check('completion answers ok', answered.ok && answered.text === 'hello world', JSON.stringify(answered))
check('the stream stops at finish', !String(answered.text).includes('NEVER'))
check('one stream call happened', good.calls.length === 1)

const request = good.calls[0]
check('system message comes first', request.messages[0].role === 'system', JSON.stringify(request.messages.map((m) => m.role)))
check('system text is carried verbatim', request.messages[0].content[0].text === 'You are the prompt desk.')
check('user message is second', request.messages[1].role === 'user' && request.messages[1].content[0].text === 'Write a shot.')
check('maxTokens is carried', request.maxTokens === 64)

const noSystem = fakeLlm('x')
await complete(noSystem.ctx, { user: 'only user' })
check('no system prompt sends no system message', noSystem.calls[0].messages.length === 1 && noSystem.calls[0].messages[0].role === 'user')

const withModel = fakeLlm('x')
await complete(withModel.ctx, { user: 'u', model: 'some-model' })
check('model rides along when named', withModel.calls[0].model === 'some-model')
const noModel = fakeLlm('x')
await complete(noModel.ctx, { user: 'u' })
check('no model key when unnamed', !('model' in noModel.calls[0]))

// ── honest failures ──────────────────────────────────────────────────────────

const bare = { get: () => undefined }
const noLlm = await complete(bare, { user: 'hi' })
check('no llm service answers no-llm', noLlm.ok === false && noLlm.error === 'no-llm' && noLlm.code === 501, JSON.stringify(noLlm))

const emptyUser = await complete(good.ctx, { user: '   ' })
check('empty user is refused', emptyUser.ok === false && emptyUser.code === 400, JSON.stringify(emptyUser))

const boom = fakeLlm('', { throwError: 'provider exploded' })
const failed = await complete(boom.ctx, { user: 'hi' })
check('a provider error is answered, not thrown', failed.ok === false && failed.code === 502 && failed.error.includes('provider exploded'), JSON.stringify(failed))

// ── the /llm route ───────────────────────────────────────────────────────────

const dir = await mkdtemp(path.join(tmpdir(), 'dsh-studio-llm-'))
const routeLlm = fakeLlm('route answer')
const handler = createHandler(createStore(dir), routeLlm.ctx)

function fakeReq(url, { method = 'POST', body } = {}) {
  const listeners = {}
  return {
    url,
    method,
    on: (event, fn) => {
      listeners[event] = fn
    },
    destroy: () => {},
    emitBody: () => {
      if (body !== undefined && listeners.data) listeners.data(Buffer.from(JSON.stringify(body)))
      if (listeners.end) listeners.end()
    },
  }
}
function fakeRes() {
  return {
    statusCode: 0,
    headers: {},
    body: undefined,
    setHeader(key, value) {
      this.headers[key] = value
    },
    end(text) {
      this.body = text ? JSON.parse(text) : undefined
    },
  }
}

{
  const res = fakeRes()
  const req = fakeReq('/plugins/studio/llm', { body: { system: 'S', user: 'U', maxTokens: 32 } })
  const handled = handler(req, res)
  req.emitBody()
  await handled
  check('POST /llm answers 200', res.statusCode === 200, String(res.statusCode))
  check('the route returns the seam text', res.body && res.body.text === 'route answer', JSON.stringify(res.body))
  check('the route carries the prompt to the seam', routeLlm.calls[0].messages[0].content[0].text === 'S' && routeLlm.calls[0].maxTokens === 32)
}
{
  const res = fakeRes()
  const req = fakeReq('/plugins/studio/llm', { method: 'GET' })
  const handled = handler(req, res)
  req.emitBody()
  await handled
  check('GET /llm is refused 405', res.statusCode === 405, String(res.statusCode))
}
{
  const res = fakeRes()
  const req = fakeReq('/plugins/studio/llm', { body: { user: '' } })
  const handled = handler(req, res)
  req.emitBody()
  await handled
  check('an empty prompt is refused by the route', res.statusCode === 400, String(res.statusCode))
}
{
  const noService = createHandler(createStore(dir), { get: () => undefined })
  const res = fakeRes()
  const req = fakeReq('/plugins/studio/llm', { body: { user: 'U' } })
  const handled = noService(req, res)
  req.emitBody()
  await handled
  check('a profile with no llm answers no-llm through the route too', res.statusCode === 501 && res.body && res.body.error === 'no-llm', String(res.statusCode))
}

await rm(dir, { recursive: true, force: true })
console.log(failures ? '\n' + failures + ' failure(s)' : '\nllm seam ok')
process.exit(failures ? 1 : 0)
