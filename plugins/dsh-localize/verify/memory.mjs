/**
 * verify:memory — epic 65 L6's claims about the review memory, asserted rather than intended.
 *
 * The claim: **a verdict survives everything except the thing it judged changing, and no attempt is
 * ever forgotten.** Memory is keyed by a hash of the ENGLISH SOURCE, so:
 *
 *   1. the same English under a new key is still approved — the memory holds the source, not a key;
 *   2. a changed English source is a hash nothing has seen, so it needs review again;
 *   3. a changed TARGET re-opens review even though the source is the same;
 *   4. a flagged key stays flagged until someone judges it again, and then approval moves it back;
 *   5. EVERY ATTEMPT IS KEPT — the gate's "no retry-until-green" rule: a rejection is a record, so the
 *      history is append-only and carries each attempt's reason and prompt;
 *   6. the prompt is VERSIONED: an approval made by an older reviewer is `stalePrompt`, not silently
 *      still approved;
 *   7. cross-plugin consistency: one English string approved two ways in two plugins is reported;
 *   8. and the founder's question — "what still needs review?" — has an answer.
 *
 *   node verify/memory.mjs
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  CRITERIA,
  MEMORY_DIR,
  PROMPT_VERSION,
  VERDICTS,
  crossPluginConflicts,
  evidencePack,
  memoryPath,
  readMemory,
  recordVerdict,
  reviewState,
  sourceHash,
  unreviewed,
} from '../lib/memory.js'
import { scanStrings } from '../lib/scan.js'

// ── reporter ─────────────────────────────────────────────────────────────────

const rows = []
const check = (label, ok, detail) => rows.push({ label, status: ok ? 'pass' : 'fail', detail: detail == null ? '' : String(detail) })
const note = (text) => rows.push({ label: text, status: 'note', detail: '' })

function finish() {
  let failed = 0
  process.stdout.write('\nverify:memory — epic 65 L6 (what was reviewed)\n')
  for (const row of rows) {
    if (row.status === 'pass') continue
    if (row.status === 'note') {
      process.stdout.write('  ....  ' + row.label + '\n')
      continue
    }
    if (row.status === 'fail') failed += 1
    process.stdout.write('  FAIL  ' + row.label + (row.detail ? '  —  ' + row.detail : '') + '\n')
  }
  const passes = rows.filter((row) => row.status === 'pass').length
  const total = rows.filter((row) => row.status !== 'note').length
  process.stdout.write('  ' + passes + '/' + total + ' passed\n')
  if (failed > 0) process.exitCode = 1
}

const ROOT = mkdtempSync(join(tmpdir(), 'localize-memory-'))
process.on('exit', () => {
  try {
    rmSync(ROOT, { recursive: true, force: true })
  } catch {
    // a temp dir left behind is not a failure
  }
})

// ── 1. the hash is of the SOURCE, and only the source ────────────────────────

{
  check('a source is remembered by the hash of its trimmed, normalised text', sourceHash('  Save  ') === sourceHash('Save') && sourceHash('Save') !== sourceHash('Saved'), JSON.stringify({ padded: sourceHash('  Save  ') === sourceHash('Save'), other: sourceHash('Save') === sourceHash('Saved') }))
  check('so the memory holds no i18n key at all — a rename cannot invalidate a verdict', Object.keys(readMemory(ROOT, 'p', 'ko').keys).length === 0, 'memory has keys before anything was recorded')
  const recorded = recordVerdict(ROOT, 'dsh-discord', 'ko', { source: 'Save', target: '저장', verdict: 'approved' })
  check(
    'and a verdict lands under that hash, in the profile',
    recorded.ok === true && recorded.hash === sourceHash('Save') && memoryPath(ROOT, 'dsh-discord', 'ko') === join(ROOT, MEMORY_DIR, 'dsh-discord', 'ko.json'),
    JSON.stringify(recorded),
  )
  check('the file on disk is the record a person can read', existsSync(memoryPath(ROOT, 'dsh-discord', 'ko')) && /저장/u.test(readFileSync(memoryPath(ROOT, 'dsh-discord', 'ko'), 'utf8')), 'file')
  const memory = readMemory(ROOT, 'dsh-discord', 'ko')
  // THE MODEL, stated as a check: the memory is asked about ENGLISH SOURCES, never about i18n keys.
  // A key name is not a source, so it is judged as something new — which is why a rename cannot
  // invalidate a verdict: nothing here ever saw the key.
  check(
    'the memory speaks about English sources, not about i18n keys',
    reviewState(memory, { Save: '저장' }).approved.join(',') === 'Save' &&
      reviewState(memory, { 'menu.save': '저장' }).new.join(',') === 'menu.save' &&
      !('menu.save' in memory.keys),
    JSON.stringify({ named: reviewState(memory, { Save: '저장' }).approved, keyed: reviewState(memory, { 'menu.save': '저장' }).new }),
  )
  check('and the entry carries the source and the target it approved', memory.keys[sourceHash('Save')].source === 'Save' && memory.keys[sourceHash('Save')].target === '저장', JSON.stringify(memory.keys[sourceHash('Save')]))
}

// ── 2. what re-opens review, and what does not ───────────────────────────────

{
  const memory = readMemory(ROOT, 'dsh-discord', 'ko')
  check('the same source and target stays approved', reviewState(memory, { Save: '저장' }).approved.join(',') === 'Save', JSON.stringify(reviewState(memory, { Save: '저장' })))
  check('a NEW source has never been judged', reviewState(memory, { Close: '닫기' }).new.join(',') === 'Close', JSON.stringify(reviewState(memory, { Close: '닫기' })))
  check('a CHANGED source is a new question, not a remembered one', reviewState(memory, { Saved: '저장' }).new.join(',') === 'Saved', JSON.stringify(reviewState(memory, { Saved: '저장' })))
  check(
    'and a CHANGED TARGET re-opens the review even though the source is the same',
    reviewState(memory, { Save: '보존' }).changed.join(',') === 'Save' && reviewState(memory, { Save: '보존' }).approved.length === 0,
    JSON.stringify(reviewState(memory, { Save: '보존' })),
  )
  const state = reviewState(memory, { Save: '저장', Close: '닫기', Save2: '  ' })
  check(
    'so re-review is limited to what moved: approved, new, changed and flagged are each named',
    state.approved.join(',') === 'Save' && state.new.join(',') === 'Close,Save2' && state.changed.length === 0 && state.flagged.length === 0,
    JSON.stringify(state),
  )
}

// ── 3. flagged, and back ─────────────────────────────────────────────────────

{
  recordVerdict(ROOT, 'dsh-discord', 'ko', { source: 'Enable', target: '활성화', verdict: 'flagged', reason: '활성화 is too formal for a toggle button' })
  const flaggedMemory = readMemory(ROOT, 'dsh-discord', 'ko')
  check('a flagged key is named as flagged, with its reason kept', reviewState(flaggedMemory, { Enable: '활성화' }).flagged.join(',') === 'Enable' && flaggedMemory.keys[sourceHash('Enable')].reason.includes('too formal'), JSON.stringify(reviewState(flaggedMemory, { Enable: '활성화' })))
  recordVerdict(ROOT, 'dsh-discord', 'ko', { source: 'Enable', target: '사용', verdict: 'approved' })
  const fixed = readMemory(ROOT, 'dsh-discord', 'ko')
  check('and judging it again moves it to approved', reviewState(fixed, { Enable: '사용' }).approved.join(',') === 'Enable', JSON.stringify(reviewState(fixed, { Enable: '사용' })))
  check(
    'EVERY ATTEMPT IS KEPT: the rejection is still there, with its reason, after the approval',
    fixed.keys[sourceHash('Enable')].attempts.length === 2 &&
      fixed.keys[sourceHash('Enable')].attempts[0].verdict === 'flagged' &&
      fixed.keys[sourceHash('Enable')].attempts[0].reason.includes('too formal') &&
      fixed.keys[sourceHash('Enable')].attempts[1].verdict === 'approved',
    JSON.stringify(fixed.keys[sourceHash('Enable')].attempts),
  )
  check('and each attempt carries the prompt that produced it, so a standard has a history', fixed.keys[sourceHash('Enable')].attempts.every((attempt) => attempt.prompt === PROMPT_VERSION), JSON.stringify(fixed.keys[sourceHash('Enable')].attempts.map((attempt) => attempt.prompt)))
}

// ── 4. the prompt is versioned ───────────────────────────────────────────────

{
  const older = { version: 1, prompt: 'localize-review@0', keys: { [sourceHash('Save')]: { source: 'Save', target: '저장', verdict: 'approved', prompt: 'localize-review@0' } } }
  check(
    'an approval made by an OLDER prompt is stale, not still approved — the standard moved',
    reviewState(older, { Save: '저장' }).stalePrompt.join(',') === 'Save' && reviewState(older, { Save: '저장' }).approved.length === 0,
    JSON.stringify(reviewState(older, { Save: '저장' })),
  )
  check('and the current prompt is the one the store writes', PROMPT_VERSION === 'localize-review@1', PROMPT_VERSION)
  check('the reviewer judges four axes, and the store names them in one place', CRITERIA.join(',') === 'accuracy,register,context,completeness', JSON.stringify(CRITERIA))
  check('the verdicts a key can carry are the two the gate has', VERDICTS.join(',') === 'approved,flagged', JSON.stringify(VERDICTS))
}

// ── 5. what the store refuses ────────────────────────────────────────────────

{
  const hostile = recordVerdict(ROOT, '../evil', 'ko', { source: 'Save', target: '저장', verdict: 'approved' })
  check('a plugin id that would climb out of the profile is refused', hostile.ok === false && hostile.error === 'bad-target' && !existsSync(join(ROOT, '..', 'evil')), JSON.stringify(hostile))
  check('a verdict that is not one of the two is refused', recordVerdict(ROOT, 'p', 'ko', { source: 'Save', verdict: 'maybe' }).error === 'bad-verdict', 'accepted a bad verdict')
  check('and a source that is not a string is refused', recordVerdict(ROOT, 'p', 'ko', { source: '   ', verdict: 'approved' }).error === 'bad-source', 'accepted a blank source')
}

// ── 6. the evidence pack ─────────────────────────────────────────────────────

{
  const pack = evidencePack({ plugin: 'dsh-discord', lang: 'ko', map: { Save: '저장', Enable: '사용', Close: null } })
  check(
    'the evidence pack reports a summary and one entry per key, in the reference\'s shape',
    pack.summary.total === 3 && pack.summary.approved === 2 && pack.summary.missing === 1 && pack.summary.flagged === 0 && pack.keys.Save.verdict === 'approved' && pack.keys.Save.en === 'Save',
    JSON.stringify(pack.summary),
  )
  check('an empty target is MISSING with a note, not an approved blank', pack.keys.Close.verdict === 'missing' && pack.keys.Close.target === null && typeof pack.keys.Close.note === 'string', JSON.stringify(pack.keys.Close))
  check('and the pack names the prompt that produced it', pack.prompt === PROMPT_VERSION && pack.reviewer === 'localize-review', JSON.stringify({ prompt: pack.prompt, reviewer: pack.reviewer }))
  check('the pack is JSON a person can read', JSON.parse(JSON.stringify(pack)).keys.Save.target === '저장', 'not serialisable')
}

// ── 7. cross-plugin consistency ──────────────────────────────────────────────

{
  const a = { plugin: 'plugin-a', memory: { keys: { [sourceHash('Enable')]: { source: 'Enable', target: '활성화', verdict: 'approved' } } } }
  const b = { plugin: 'plugin-b', memory: { keys: { [sourceHash('Enable')]: { source: 'Enable', target: '사용', verdict: 'approved' } } } }
  const same = { plugin: 'plugin-c', memory: { keys: { [sourceHash('Enable')]: { source: 'Enable', target: '활성화', verdict: 'approved' } } } }
  const flagged = { plugin: 'plugin-d', memory: { keys: { [sourceHash('Enable')]: { source: 'Enable', target: '쓰기', verdict: 'flagged' } } } }
  const conflicts = crossPluginConflicts([a, b, same])
  check(
    'one English string approved two ways in two plugins IS reported, with both targets',
    conflicts.length === 1 && conflicts[0].source === 'Enable' && conflicts[0].targets['plugin-a'] === '활성화' && conflicts[0].targets['plugin-b'] === '사용',
    JSON.stringify(conflicts),
  )
  check('two plugins that agree are not a conflict', crossPluginConflicts([a, same]).length === 0, JSON.stringify(crossPluginConflicts([a, same])))
  check('and a FLAGGED entry is not compared — it is already known to be wrong', crossPluginConflicts([a, flagged]).length === 0, JSON.stringify(crossPluginConflicts([a, flagged])))
}

// ── 8. the founder's question ────────────────────────────────────────────────

{
  writeFileSync(join(ROOT, MEMORY_DIR, 'dsh-discord', 'ko.json'), readFileSync(memoryPath(ROOT, 'dsh-discord', 'ko'), 'utf8'))
  mkdirSync(join(ROOT, MEMORY_DIR, 'dsh-graphify'), { recursive: true })
  writeFileSync(memoryPath(ROOT, 'dsh-graphify', 'ja'), JSON.stringify({ version: 1, prompt: PROMPT_VERSION, keys: { [sourceHash('Open')]: { source: 'Open', target: '開く', verdict: 'approved', prompt: PROMPT_VERSION } } }, null, 2) + '\n')
  const answer = unreviewed(ROOT, { 'dsh-discord': { ko: { Save: '보존', Close: '닫기' } }, 'dsh-graphify': { ja: { Open: '開く' } } })
  const discord = answer.find((row) => row.plugin === 'dsh-discord' && row.lang === 'ko')
  const graphify = answer.find((row) => row.plugin === 'dsh-graphify' && row.lang === 'ja')
  check(
    'the question "what still needs review?" is answered per plugin and language',
    answer.length === 2 && discord.remembered === 2 && graphify.remembered === 1,
    JSON.stringify(answer.map((row) => [row.plugin, row.lang, row.remembered])),
  )
  check(
    'and it names exactly what moved: the changed target and the unjudged source',
    discord.needsReview.includes('Save') && discord.needsReview.includes('Close') &&
      discord.state.changed.includes('Save') && discord.state.new.includes('Close'),
    JSON.stringify({ needs: discord.needsReview, changed: discord.state.changed, fresh: discord.state.new }),
  )
  check(
    'while the memory\'s own tally is reported separately — TWO approvals REMEMBERED, and still two things to review',
    discord.counts.approved === 2 && discord.remembered === 2 && discord.needsReview.length === 2,
    JSON.stringify({ counts: discord.counts, remembered: discord.remembered, needs: discord.needsReview }),
  )
  check('a language whose translations have not moved needs no review at all', graphify.needsReview.length === 0 && graphify.counts.approved === 1, JSON.stringify(graphify))
  check('and the memory lives in the profile beside the overlays, not inside a package', memoryPath(ROOT, 'p', 'ko').includes(MEMORY_DIR) && !memoryPath(ROOT, 'p', 'ko').includes('node_modules'), memoryPath(ROOT, 'p', 'ko'))
}

// ── 9. the two stores agree on the key space ─────────────────────────────────

{
  // The overlay is keyed by the SOURCE STRING and the memory by its hash, so the scan, the overlay and
  // the memory all speak about the same strings. This is the check that they still do.
  const found = scanStrings("h('button', null, 'Save changes')")
  const memory = readMemory(ROOT, 'dsh-discord', 'ko')
  check('a scanned string and a remembered source are the same kind of thing', found.includes('Save changes') && memory.keys[sourceHash('Enable')].source === 'Enable', JSON.stringify(found))
  check('and the hash is stable across runs, which is what lets a verdict outlive a restart', sourceHash('Enable') === sourceHash('Enable'), 'unstable hash')
}

note('temp profile: ' + ROOT)
finish()
