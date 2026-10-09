/**
 * Export (M8): the ffmpeg seam and the honest degradation.
 *
 * What matters: the argv is exactly right (trims in seconds, concat with audio,
 * H.264/AAC), takes resolve through Generate's run records, no ffmpeg is a
 * plain refusal while the manifest still exports, and no suite ever touches a
 * real ffmpeg (the runner is injected).
 */
import { EventEmitter } from 'node:events'
import { promises as fsp } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { detectFfmpeg, resolveTake, frameTime, ffmpegArgs, runExport } from '../lib/export.js'
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

// A fake process: EventEmitter with the bits spawn exposes.
function fakeProc({ code = 0, error = false, stderr = '' } = {}) {
  const proc = new EventEmitter()
  proc.stderr = new EventEmitter()
  setTimeout(() => {
    if (error) proc.emit('error', new Error('spawn ENOENT'))
    else {
      if (stderr) proc.stderr.emit('data', Buffer.from(stderr))
      proc.emit('exit', code)
    }
  }, 0)
  return proc
}

// ---- detect ----

{
  const seen = []
  const answer = await detectFfmpeg((cmd, args) => {
    seen.push(cmd + ' ' + args.join(' '))
    return fakeProc()
  })
  check('detect answers ok when ffmpeg runs', answer.ok === true)
  check('detect asks for the version', seen[0] === 'ffmpeg -version')
}
{
  const answer = await detectFfmpeg(() => fakeProc({ error: true }))
  check('a missing ffmpeg is an honest answer', answer.ok === false && answer.error === 'ffmpeg not found', JSON.stringify(answer))
}
{
  const answer = await detectFfmpeg(() => fakeProc({ code: 1 }))
  check('a broken ffmpeg is not ok', answer.ok === false)
}

// ---- frames to seconds ----

check('frames convert to seconds at the fps', frameTime(124, 24) === '5.167' && frameTime(0, 24) === '0.000', frameTime(124, 24))

// ---- the argv ----

const clips = [
  { in_f: 0, out_f: 124, file: '/a/one.mp4' },
  { in_f: 12, out_f: 96, file: '/a/two.mp4' },
]
const args = ffmpegArgs(clips, '/out/cut.mp4', { fps: 24 })
check('every clip contributes a trimmed input', args.join(' ').includes('-ss 0.000 -to 5.167 -i /a/one.mp4') && args.join(' ').includes('-ss 0.500 -to 4.000 -i /a/two.mp4'), args.join(' '))
check('the concat filter includes audio', args.join(' ').includes('concat=n=2:v=1:a=1[v][a]'))
check('the maps pick the concat outputs', args.join(' ').includes('-map [v] -map [a]'))
check('the encode is H.264 + AAC', args.join(' ').includes('-c:v libx264') && args.join(' ').includes('-c:a aac'))
check('the output path is last', args[args.length - 1] === '/out/cut.mp4')

// ---- runExport through the injected runner ----

{
  let spawned = null
  const result = await runExport(clips, '/out/cut.mp4', {
    run: (cmd, argv) => {
      spawned = cmd + ' ' + argv.join(' ')
      return fakeProc()
    },
  })
  check('runExport spawns ffmpeg and answers ok', result.ok === true && spawned.startsWith('ffmpeg -y'))
}
{
  const result = await runExport(clips, '/out/cut.mp4', { run: () => fakeProc({ code: 1, stderr: 'bad filter' }) })
  check('a failed ffmpeg is reported with its tail', result.ok === false && result.stderr.includes('bad filter'), JSON.stringify(result))
}
{
  const result = await runExport(clips, '/out/cut.mp4', { run: () => fakeProc({ error: true }) })
  check('a missing ffmpeg at run time is honest', result.ok === false && result.error === 'ffmpeg not found')
}

// ---- takes resolve through Generate's run records ----

const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'dsh-studio-export-'))
const genRoot = path.join(tmp, 'generate')
const bytes = path.join(tmp, 'one.mp4')
await fsp.writeFile(bytes, 'fake video bytes')
await fsp.mkdir(path.join(genRoot, 'runninghub', 'runs'), { recursive: true })
await fsp.writeFile(
  path.join(genRoot, 'runninghub', 'runs', 'j1.json'),
  JSON.stringify({ jobId: 'j1', outcome: { saved: [bytes] } }),
)

{
  const answer = await resolveTake({ provider: 'runninghub', jobId: 'j1', index: 0 }, genRoot)
  check('a take resolves to its saved bytes', answer.ok && answer.file === bytes, JSON.stringify(answer))
}
{
  const answer = await resolveTake({ provider: 'runninghub', jobId: 'ghost', index: 0 }, genRoot)
  check('an unknown run does not resolve', answer.ok === false)
}
{
  const answer = await resolveTake({}, genRoot)
  check('a malformed take does not resolve', answer.ok === false)
}

// ---- routes through the real handler, ffmpeg injected ----

const store = createStore(path.join(tmp, 'studio'))
await store.createProject({ id: 'demo', name: 'Demo' })
await store.createSequence('demo', { id: 's1', name: 'Cut' })
await store.writeEdl('demo', 's1', {
  schema: 1,
  fps: 24,
  format: '',
  clips: [{ id: 'c1', take: { provider: 'runninghub', jobId: 'j1', index: 0 }, in_f: 0, out_f: 124, label: 'A' }],
})
const spawns = []
const handler = createHandler(store, { get: () => undefined }, { root: store.root }, {
  ffmpegRun: (cmd, argv) => {
    spawns.push(cmd + ' ' + argv.join(' '))
    return fakeProc()
  },
})

function fakeReq(url, { method = 'POST', body = {} } = {}) {
  const listeners = {}
  const pending = []
  let ended = false
  return {
    url,
    method,
    on: (event, fn) => {
      listeners[event] = fn
      if (event === 'data') for (const chunk of pending) fn(chunk)
      if (event === 'end' && ended) fn()
    },
    destroy: () => {},
    emitBody: () => {
      const chunk = Buffer.from(JSON.stringify(body))
      pending.push(chunk)
      if (listeners.data) listeners.data(chunk)
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
  const res = await call('/plugins/studio/projects/demo/sequences/s1/export/status', { method: 'GET' })
  check('status reports ffmpeg found', res.statusCode === 200 && res.body.ffmpeg.ok === true, JSON.stringify(res.body))
}
{
  const res = await call('/plugins/studio/projects/demo/sequences/s1/export/edl')
  check('the manifest exports', res.statusCode === 200 && res.body.manifest.endsWith('timeline.json'), JSON.stringify(res.body))
  const manifest = JSON.parse(await fsp.readFile(res.body.manifest, 'utf8'))
  check('the manifest carries take files by reference', manifest.clips[0].file === bytes && manifest.clips[0].take.jobId === 'j1')
}
{
  const res = await call('/plugins/studio/projects/demo/sequences/s1/export/mp4')
  check('the MP4 export runs', res.statusCode === 200 && res.body.ok === true, JSON.stringify(res.body))
  const exportSpawns = spawns.filter((line) => line.includes('-y -ss'))
  check('the spawned line trims and concats', exportSpawns.length === 1 && exportSpawns[0].includes('-to 5.167') && exportSpawns[0].includes('concat=n=1'), spawns.join(' | '))
}

// no ffmpeg: honest 501, manifest still exports
const bare = createHandler(store, { get: () => undefined }, { root: store.root }, {
  ffmpegRun: () => fakeProc({ error: true }),
})
{
  const res = fakeRes()
  await bare(fakeReq('/plugins/studio/projects/demo/sequences/s1/export/mp4'), res)
  check('no ffmpeg is an honest 501', res.statusCode === 501 && res.body.error === 'ffmpeg not found', JSON.stringify(res.body))
}
{
  const res = fakeRes()
  const req = fakeReq('/plugins/studio/projects/demo/sequences/s1/export/edl')
  const handled = bare(req, res)
  req.emitBody()
  await handled
  check('and the manifest still exports without ffmpeg', res.statusCode === 200 && res.body.manifest.endsWith('timeline.json'))
}

await fsp.rm(tmp, { recursive: true, force: true })
console.log(failures ? '\n' + failures + ' failure(s)' : '\nexport ok')
process.exit(failures ? 1 : 0)
