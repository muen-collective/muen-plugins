// @muen/dsh-studio — the Script stage (M5).
//
// Three input modes land in one shape: the session's shot rows. Manual typing
// is the client's own editing; LLM write and brief import parse into shot drafts
// HERE (host-side, one parser) and the pane merges them into the session it
// already PUTs. The gate is the human reading the list — nothing here spends.
//
// The duration total shows H3's real frame grid (17k+5 at 24 fps: 5 s renders as
// 124 frames = 5.17 s) so the founder reads what a render will actually hold.

export const FPS = 24

/** The 17k+5 grid: the smallest frame count on the grid that covers `seconds`. */
export function framesFor(seconds) {
  const raw = Math.max(0, Math.round(Number(seconds) * FPS))
  if (raw <= 5) return raw === 0 ? 0 : 5
  return Math.ceil((raw - 5) / 17) * 17 + 5
}

/** What a list of durations actually renders as. */
export function gridTotal(durations) {
  let frames = 0
  for (const duration of durations) frames += framesFor(duration)
  return { frames, seconds: Math.round((frames / FPS) * 100) / 100 }
}

/** One draft shot, validated into the session's shot shape. */
function draftShot(raw, index) {
  if (!raw || typeof raw !== 'object') return null
  const beat = typeof raw.beat === 'string' ? raw.beat.trim() : ''
  if (beat === '') return null
  const duration = Number(raw.duration_s)
  return {
    id: 's' + String(index + 1).padStart(2, '0'),
    beat,
    camera: typeof raw.camera === 'string' ? raw.camera.trim() : '',
    duration_s: Number.isFinite(duration) && duration >= 1 && duration <= 60 ? Math.round(duration) : 5,
    assets: [],
    prompt: '',
    look: null,
    gate: null,
    selects: [],
  }
}

/**
 * Parse a Script-role answer into shot drafts. The role returns raw JSON — the
 * parse strips fences defensively but never guesses past an unparseable answer:
 * `{ ok: false }` is the honest answer, not an empty success.
 */
export function parseShotDrafts(text) {
  if (typeof text !== 'string' || text.trim() === '') return { ok: false, error: 'empty' }
  let source = text.trim()
  const fenced = source.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenced) source = fenced[1].trim()
  const start = source.indexOf('[')
  const end = source.lastIndexOf(']')
  if (start < 0 || end <= start) return { ok: false, error: 'no-array' }
  let parsed
  try {
    parsed = JSON.parse(source.slice(start, end + 1))
  } catch {
    return { ok: false, error: 'bad-json' }
  }
  if (!Array.isArray(parsed)) return { ok: false, error: 'not-an-array' }
  const shots = []
  parsed.forEach((raw, index) => {
    const shot = draftShot(raw, index)
    if (shot) shots.push(shot)
  })
  if (shots.length === 0) return { ok: false, error: 'no-shots' }
  return { ok: true, shots }
}

/**
 * A brief becomes a premise. The okotokoto SEO/AEO contract carries a
 * `premise`/`summary`-ish field somewhere; v1 takes the first string field it
 * recognizes and otherwise hands the whole brief to the role as context. The
 * full brief parsing belongs to the SEO plugin — this is the handoff seam.
 */
export function premiseFromBrief(brief) {
  if (typeof brief === 'string') return brief.trim()
  if (!brief || typeof brief !== 'object') return ''
  for (const key of ['premise', 'summary', 'brief', 'title']) {
    if (typeof brief[key] === 'string' && brief[key].trim() !== '') return brief[key].trim()
  }
  return JSON.stringify(brief).slice(0, 2000)
}
