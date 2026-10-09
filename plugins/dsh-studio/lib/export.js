// @muen/dsh-studio — export (M8).
//
// The finish line: an MP4 assembled by the host's ffmpeg from the EDL, or —
// always available — the EDL document plus a manifest of take files. No ffmpeg
// is an honest answer, not a crash: the MP4 button dies with the exact reason
// and the manifest still exports.
//
// Takes are resolved to local files through Generate's own run records
// (<profile>/generate/<provider>/runs/<jobId>.json → outcome.saved[]): bytes
// stay Generate's, this module only points at them.

import { spawn } from 'node:child_process'
import { promises as fs } from 'node:fs'
import path from 'node:path'

/** Does this machine have ffmpeg? Injectable runner keeps the suite honest. */
export function detectFfmpeg(run = defaultRun) {
  return new Promise((resolve) => {
    try {
      const proc = run('ffmpeg', ['-version'], { stdio: 'ignore' })
      let settled = false
      const done = (ok) => {
        if (settled) return
        settled = true
        resolve(ok ? { ok: true } : { ok: false, error: 'ffmpeg not found' })
      }
      proc.on('error', () => done(false))
      proc.on('exit', (code) => done(code === 0))
    } catch {
      resolve({ ok: false, error: 'ffmpeg not found' })
    }
  })
}

function defaultRun(cmd, args, options) {
  return spawn(cmd, args, options)
}

/** Resolve a take triple to a local file through Generate's run record. */
export async function resolveTake(take, generateRoot) {
  if (!take || !take.provider || !take.jobId) return { ok: false, error: 'bad take' }
  const recordPath = path.join(generateRoot, take.provider, 'runs', take.jobId + '.json')
  try {
    const record = JSON.parse(await fs.readFile(recordPath, 'utf8'))
    const saved = (record.outcome && record.outcome.saved) || record.saved || []
    const file = saved[take.index || 0] || saved[0]
    if (!file) return { ok: false, error: 'run saved no file' }
    await fs.access(file)
    return { ok: true, file }
  } catch (error) {
    return { ok: false, error: 'no run record: ' + take.jobId }
  }
}

/** Frames → ffmpeg seconds (3 decimals is finer than any 24 fps frame). */
export function frameTime(frames, fps) {
  return (Math.max(0, Number(frames) || 0) / (Number(fps) || 24)).toFixed(3)
}

/**
 * The ffmpeg argv for a concat of trimmed clips. Each clip: `-ss in -to out -i
 * file`, then concat with audio, then H.264/AAC. Pure — the suite checks this
 * line by line and the host just spawns it.
 */
export function ffmpegArgs(clips, output, { fps = 24 } = {}) {
  const args = ['-y']
  clips.forEach((clip) => {
    args.push('-ss', frameTime(clip.in_f, fps), '-to', frameTime(clip.out_f, fps), '-i', clip.file)
  })
  const inputs = clips.map((_, i) => '[' + i + ':v][' + i + ':a]').join('')
  args.push(
    '-filter_complex', inputs + 'concat=n=' + clips.length + ':v=1:a=1[v][a]',
    '-map', '[v]', '-map', '[a]',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac',
    output,
  )
  return args
}

/** Run the export. `run` is injectable so no suite ever touches a real ffmpeg. */
export function runExport(clips, output, { fps = 24, run = defaultRun } = {}) {
  return new Promise((resolve) => {
    try {
      const proc = run('ffmpeg', ffmpegArgs(clips, output, { fps }), { stdio: 'ignore' })
      let stderr = ''
      if (proc.stderr) proc.stderr.on('data', (chunk) => {
        stderr += String(chunk)
      })
      proc.on('error', () => resolve({ ok: false, error: 'ffmpeg not found' }))
      proc.on('exit', (code) =>
        resolve(code === 0 ? { ok: true, output } : { ok: false, error: 'ffmpeg exit ' + code, stderr: stderr.slice(-400) }),
      )
    } catch (error) {
      resolve({ ok: false, error: String((error && error.message) || error) })
    }
  })
}
