/**
 * THE REVIEW MEMORY (epic 65 L6) — what was reviewed, by whom, with what verdict, and under which
 * prompt.
 *
 * WHY IT IS KEYED BY THE ENGLISH SOURCE AND NOT BY THE KEY. An overlay's entries are keyed by the
 * string that is rendered, and a locale file's keys are renamed freely; a memory keyed by an i18n key
 * would lose every verdict on a rename and re-review work that has not changed. So an entry is keyed
 * by `sourceHash(english)` — the hash of the English text itself — and the record carries the source
 * and the target it approved, because THAT is what "changed" means:
 *
 *   - the same English under a new key        → still approved (the hash did not move);
 *   - a changed English source                → a hash nothing has seen  → needs review;
 *   - a changed translation of a known source → approved for the OLD target → needs review.
 *
 * EVERY ATTEMPT IS KEPT. The dual-panel gate's rule is "no retry-until-green": a rejection is as much
 * a record as an approval, so `attempts` is appended to and never replaced. A person asking "why is
 * this flagged?" gets the history, not the last word.
 *
 * AND THE PROMPT IS VERSIONED. A verdict produced by an older reviewer is a verdict made by a
 * different standard; when the prompt changes, its approvals are `stalePrompt` rather than silently
 * still approved. That is the honest reading of "the prompt is a quality gate, so it wants an owner"
 * (epic 65 §7.3).
 */
import { createHash } from 'node:crypto'
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/** The directory under the profile that holds the verdicts. */
export const MEMORY_DIR = 'localize-memory'

/** The gate's prompt version. Bump it and every older approval asks for review again. */
export const PROMPT_VERSION = 'localize-review@1'

/** The verdicts a key can carry. */
export const VERDICTS = Object.freeze(['approved', 'flagged'])

/** The four axes the reviewer judges, in the order the evidence pack reports them. */
export const CRITERIA = Object.freeze(['accuracy', 'register', 'context', 'completeness'])

/** The hash a source string is remembered under: its trimmed, NFC-normalised text. */
export function sourceHash(source) {
  if (typeof source !== 'string') return null
  return createHash('sha256').update(source.trim().normalize('NFC'), 'utf8').digest('hex')
}

/** One plugin's memory directory, or `null` for an id that is not one path segment. */
function memoryDir(root, plugin) {
  if (typeof plugin !== 'string' || plugin === '' || /[/\\]/u.test(plugin) || plugin.includes('..')) return null
  return join(root, MEMORY_DIR, plugin)
}

/** The memory file for one plugin and language, or `null`. */
export function memoryPath(root, plugin, lang) {
  const dir = memoryDir(root, plugin)
  if (dir === null || typeof lang !== 'string' || lang === '') return null
  return join(dir, lang + '.json')
}

/** Read one memory file. Absent or unreadable is an EMPTY memory, never an error. */
export function readMemory(root, plugin, lang) {
  const path = memoryPath(root, plugin, lang)
  if (path === null) return { version: 1, prompt: PROMPT_VERSION, keys: {}, missing: true }
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8'))
    const keys = parsed && typeof parsed.keys === 'object' && parsed.keys !== null ? parsed.keys : {}
    return { ...parsed, keys, missing: false }
  } catch {
    return { version: 1, prompt: PROMPT_VERSION, keys: {}, missing: true }
  }
}

/** Write one memory file whole. */
export function writeMemory(root, plugin, lang, memory) {
  const path = memoryPath(root, plugin, lang)
  if (path === null) return { ok: false, error: 'bad-target' }
  mkdirSync(join(root, MEMORY_DIR, plugin), { recursive: true })
  writeFileSync(path, JSON.stringify({ ...memory, plugin, lang }, null, 2) + '\n', 'utf8')
  return { ok: true, path, keys: Object.keys(memory.keys || {}).length }
}

/**
 * RECORD ONE ATTEMPT. Append-only: the verdict joins `attempts`, and the entry's headline is whatever
 * the LAST verdict was — so history is kept and the current state is still readable at a glance.
 */
export function recordVerdict(root, plugin, lang, { source, target, verdict, reason = '', at = new Date().toISOString(), prompt = PROMPT_VERSION, reviewer = 'localize-review' } = {}) {
  const hash = sourceHash(source)
  if (hash === null || typeof source !== 'string' || source.trim() === '') return { ok: false, error: 'bad-source' }
  if (!VERDICTS.includes(verdict)) return { ok: false, error: 'bad-verdict' }
  const memory = readMemory(root, plugin, lang)
  const previous = memory.keys[hash] || { source, attempts: [] }
  const attempt = { at, verdict, reason, target: target ?? null, prompt, reviewer }
  const attempts = [...(previous.attempts || []), attempt]
  const entry = { source, target: target ?? null, verdict, reason, at, prompt, reviewer, attempts }
  const written = writeMemory(root, plugin, lang, {
    version: 1,
    prompt,
    reviewedAt: at,
    reviewer,
    keys: { ...memory.keys, [hash]: entry },
  })
  return { ...written, hash, verdict, attempts: attempts.length }
}

/**
 * WHAT NEEDS REVIEW, and what does not.
 *
 * `map` is the translation being judged (source → target), so this is the question the gate asks:
 * given what we already know, which keys must a person or a panel look at again?
 *
 *   approved          — a verdict under THIS prompt, for THIS source and THIS target
 *   stalePrompt       — approved, but by an older prompt: the standard moved
 *   changed           — approved for a different target than the one on the table now
 *   flagged           — judged, and found wanting (the reason is in the memory)
 *   new               — this source has never been judged
 */
export function reviewState(memory, map, { prompt = PROMPT_VERSION } = {}) {
  const keys = (memory && memory.keys) || {}
  const state = { approved: [], stalePrompt: [], changed: [], flagged: [], new: [] }
  for (const [source, target] of Object.entries(map || {})) {
    const hash = sourceHash(source)
    const entry = keys[hash]
    if (entry === undefined) {
      state.new.push(source)
      continue
    }
    if (entry.verdict === 'flagged') {
      state.flagged.push(source)
      continue
    }
    if (entry.prompt !== prompt) {
      state.stalePrompt.push(source)
      continue
    }
    if (entry.target !== target) {
      state.changed.push(source)
      continue
    }
    state.approved.push(source)
  }
  return state
}

/** The evidence pack the reviewer produces, in the reference's own shape. */
export function evidencePack({ plugin, lang, map, reviewer = 'localize-review', at = new Date().toISOString(), prompt = PROMPT_VERSION } = {}) {
  const keys = {}
  let approved = 0
  let missing = 0
  for (const [source, target] of Object.entries(map || {})) {
    if (target === undefined || target === null || String(target).trim() === '') {
      keys[source] = { verdict: 'missing', en: source, target: null, note: 'no translation for this source' }
      missing += 1
      continue
    }
    keys[source] = { verdict: 'approved', en: source, target }
    approved += 1
  }
  return {
    plugin,
    lang,
    reviewedAt: at,
    reviewer,
    prompt,
    summary: { total: Object.keys(keys).length, approved, flagged: 0, missing },
    keys,
  }
}

/**
 * CROSS-PLUGIN CONSISTENCY (epic 65 §3 layer 3, and the reason the memory exists): one English string
 * rendered two ways in two plugins. Only APPROVED entries are compared — a flagged one is already
 * known to be wrong, and reporting it as a disagreement would be noise.
 */
export function crossPluginConflicts(rows) {
  const bySource = new Map()
  for (const row of rows || []) {
    for (const [hash, entry] of Object.entries((row.memory && row.memory.keys) || {})) {
      if (entry.verdict !== 'approved' || entry.target === null) continue
      if (!bySource.has(hash)) bySource.set(hash, { source: entry.source, targets: new Map() })
      bySource.get(hash).targets.set(row.plugin, entry.target)
    }
  }
  const conflicts = []
  for (const [hash, row] of bySource) {
    const distinct = new Set(row.targets.values())
    if (distinct.size > 1) conflicts.push({ hash, source: row.source, targets: Object.fromEntries(row.targets) })
  }
  return conflicts
}

/**
 * THE QUESTION THE FOUNDER CAN ASK: what still needs review, everywhere?
 *
 * Every memory file under the profile is read, and each one is answered against the translation on
 * the table now — so a language whose translations have moved asks for review again, which is the
 * whole point of remembering.
 */
export function unreviewed(root, maps = {}) {
  const base = join(root, MEMORY_DIR)
  const rows = []
  let plugins = []
  try {
    plugins = readdirSync(base, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name)
  } catch {
    return rows
  }
  for (const plugin of plugins.sort()) {
    let files = []
    try {
      files = readdirSync(join(base, plugin))
    } catch {
      continue
    }
    for (const file of files.sort()) {
      if (!file.endsWith('.json')) continue
      const lang = file.slice(0, -'.json'.length)
      const memory = readMemory(root, plugin, lang)
      const map = maps[plugin] && maps[plugin][lang] ? maps[plugin][lang] : null
      const state = map === null ? null : reviewState(memory, map)
      // TWO DIFFERENT QUESTIONS, KEPT APART: `counts` is what the MEMORY holds (what has been judged),
      // and `state` is what the map ON THE TABLE still needs. A language can hold two approvals and
      // still need review for both, and conflating the two would hide exactly that.
      const counts = { approved: 0, stalePrompt: 0, changed: 0, flagged: 0, new: 0 }
      for (const [hash, entry] of Object.entries(memory.keys || {})) {
        if (entry.verdict === 'flagged') counts.flagged += 1
        else if (entry.prompt !== PROMPT_VERSION) counts.stalePrompt += 1
        else counts.approved += 1
      }
      rows.push({
        plugin,
        lang,
        remembered: Object.keys(memory.keys || {}).length,
        counts,
        state,
        needsReview: state === null ? null : [...state.new, ...state.changed, ...state.stalePrompt, ...state.flagged],
      })
    }
  }
  return rows
}
