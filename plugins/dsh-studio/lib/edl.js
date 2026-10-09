// @muen/dsh-studio — the EDL (M7).
//
// The timeline is a decision list, not media: ordered clips that REFERENCE
// takes (provider/jobId/index) with frame in/out. Frames, not seconds — the
// sequence runs at fps and every trim snaps to a whole frame so a concat can
// never land between samples. All ops are pure: undo is the caller keeping the
// previous document, which is what makes it one undo button.

export const EDL_SCHEMA = 1
export const DEFAULT_FPS = 24

export function emptyEdl(fps = DEFAULT_FPS) {
  return { schema: EDL_SCHEMA, fps, format: '', clips: [] }
}

/** Whole frames only; a half frame is a bug, not a feature. */
export function snapFrame(frame) {
  const n = Number(frame)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.round(n))
}

function nextId(clips) {
  const used = new Set(clips.map((clip) => clip.id))
  let n = clips.length + 1
  while (used.has('c' + n)) n += 1
  return 'c' + n
}

/** Append a clip. `sourceFrames` bounds the trim window when known. */
export function addClip(edl, { take, in_f = 0, out_f = null, label = '', sourceFrames = null }) {
  const total = sourceFrames ? snapFrame(sourceFrames) : null
  const start = Math.min(snapFrame(in_f), total !== null ? Math.max(0, total - 1) : Infinity)
  const end = total !== null ? Math.min(snapFrame(out_f === null ? total : out_f), total) : snapFrame(out_f === null ? start + 1 : out_f)
  const clip = {
    id: nextId(edl.clips),
    take: take || null,
    in_f: start,
    out_f: Math.max(start + 1, end),
    label: String(label || ''),
    // Persisted so setTrim can clamp against the real source length later.
    sourceFrames: total !== null ? total : undefined,
  }
  return { ...edl, clips: edl.clips.concat([clip]) }
}

/** Move a clip to `index` (0-based). */
export function moveClip(edl, id, index) {
  const from = edl.clips.findIndex((clip) => clip.id === id)
  if (from < 0) return edl
  const clips = edl.clips.slice()
  const [clip] = clips.splice(from, 1)
  const to = Math.max(0, Math.min(Number(index) || 0, clips.length))
  clips.splice(to, 0, clip)
  return { ...edl, clips }
}

/** Set a clip's in/out, snapped and clamped to a real window. */
export function setTrim(edl, id, in_f, out_f) {
  return {
    ...edl,
    clips: edl.clips.map((clip) => {
      if (clip.id !== id) return clip
      const total = clip.sourceFrames ? snapFrame(clip.sourceFrames) : Infinity
      const start = Math.max(0, Math.min(snapFrame(in_f), total - 1))
      const end = Math.max(start + 1, Math.min(snapFrame(out_f), total))
      return { ...clip, in_f: start, out_f: end }
    }),
  }
}

/** Split at a frame inside the clip; the two pieces share the take. */
export function splitClip(edl, id, atFrame) {
  const index = edl.clips.findIndex((clip) => clip.id === id)
  if (index < 0) return edl
  const clip = edl.clips[index]
  const at = snapFrame(atFrame)
  if (at <= clip.in_f || at >= clip.out_f) return edl
  const left = { ...clip, out_f: at }
  const right = { ...clip, id: nextId(edl.clips), in_f: at }
  const clips = edl.clips.slice()
  clips.splice(index, 1, left, right)
  return { ...edl, clips }
}

export function removeClip(edl, id) {
  return { ...edl, clips: edl.clips.filter((clip) => clip.id !== id) }
}

export function totalFrames(edl) {
  return edl.clips.reduce((sum, clip) => sum + (clip.out_f - clip.in_f), 0)
}

/**
 * Build the first cut: every shot's select, in shot order, whole-take. The
 * founder trims from here — this is the "pick-and-order IS the edit" moment.
 */
export function buildFromSelects(shots, fps = DEFAULT_FPS) {
  let edl = emptyEdl(fps)
  for (const shot of shots || []) {
    const take = shot.selects && shot.selects[0]
    if (!take) continue
    edl = addClip(edl, {
      take: { provider: take.provider, jobId: take.job, index: take.index || 0 },
      in_f: 0,
      out_f: null,
      label: shot.id + ' · ' + (shot.beat || '').slice(0, 40),
      sourceFrames: shot.duration_s ? Math.round(shot.duration_s * fps) : null,
    })
  }
  return edl
}

/** What the host accepts. A bad EDL is refused whole — never half-written. */
export function validateEdl(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return { ok: false, code: 400, error: 'not-an-object' }
  if (payload.schema !== EDL_SCHEMA) return { ok: false, code: 400, error: 'schema' }
  const fps = Number(payload.fps)
  if (!Number.isFinite(fps) || fps <= 0) return { ok: false, code: 400, error: 'fps' }
  if (!Array.isArray(payload.clips)) return { ok: false, code: 400, error: 'clips' }
  const seen = new Set()
  for (const clip of payload.clips) {
    if (!clip || typeof clip !== 'object') return { ok: false, code: 400, error: 'clip' }
    if (typeof clip.id !== 'string' || clip.id === '' || seen.has(clip.id)) return { ok: false, code: 400, error: 'clip.id' }
    seen.add(clip.id)
    const inF = Number(clip.in_f)
    const outF = Number(clip.out_f)
    if (!Number.isInteger(inF) || !Number.isInteger(outF) || inF < 0 || outF <= inF) return { ok: false, code: 400, error: 'clip range' }
  }
  return { ok: true }
}
