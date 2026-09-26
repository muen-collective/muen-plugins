/**
 * verify:review — epic 65 L5's claims about the reviewer, asserted rather than intended.
 *
 * The claim: **the gate ships inside the plugin, says what it judges, and leaves a record that cannot be
 * quietly rewritten.** The rules this file checks:
 *
 *   1. the skill travels in the package and the host REGISTERS it (read at apply time, so the served text is
 *      the repo's text) — with the invocation the harness needs;
 *   2. it names the four axes, the three verdicts and the profile's two stores, because a reviewer that does
 *      not say what it judges produces verdicts nobody can act on;
 *   3. it carries the gate's non-negotiables: both panels must pass, either can veto, NO RETRY-UNTIL-GREEN,
 *      and the founder as the escalation judge;
 *   4. it names the PROMPT VERSION the store actually writes, so the standard and the record cannot drift;
 *   5. and a plugin with no skills service still activates — a missing registrar is not a failed boot.
 *
 *   node verify/review.mjs
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import localize, { SKILLS, mountSkill } from '../lib/index.js'
import { MEMORY_DIR, PROMPT_VERSION } from '../lib/memory.js'

// ── reporter ─────────────────────────────────────────────────────────────────

const rows = []
const check = (label, ok, detail) => rows.push({ label, status: ok ? 'pass' : 'fail', detail: detail == null ? '' : String(detail) })

function finish() {
  let failed = 0
  process.stdout.write('\nverify:review — epic 65 L5 (the reviewer)\n')
  for (const row of rows) {
    if (row.status === 'pass') continue
    if (row.status === 'fail') failed += 1
    process.stdout.write('  FAIL  ' + row.label + (row.detail ? '  —  ' + row.detail : '') + '\n')
  }
  const passes = rows.filter((row) => row.status === 'pass').length
  process.stdout.write('  ' + passes + '/' + rows.length + ' passed\n')
  if (failed > 0) process.exitCode = 1
}

// ── 1. the skill ships and registers ─────────────────────────────────────────

const skill = SKILLS.find((row) => row.name === 'localize-review')
check('the reviewer travels inside the package, as one skill', SKILLS.length === 1 && !!skill && skill.file.endsWith(join('skills', 'localize-review', 'SKILL.md')), JSON.stringify(SKILLS.map((row) => row.file)))

const text = readFileSync(skill.file, 'utf8')
check('the file is on disk and is the text that will be served', text.length > 1200 && text.includes('# localize-review'), String(text.length))

{
  const registered = []
  const labels = []
  const ctx = {
    get: (service) => (service === 'skills' ? { register: (spec) => { registered.push(spec); return () => {} } } : undefined),
    effect: (fn, label) => { labels.push(label); fn(); return () => {} },
    on: () => {},
  }
  const mounted = mountSkill(ctx)
  check('the host registers it, with the content READ at apply time', mounted === true && registered.length === 1 && registered[0].content === text, JSON.stringify({ mounted, registered: registered.length }))
  check(
    'with the invocation, the provider and the resource base the harness needs',
    registered[0].name === 'localize-review' &&
      registered[0].invocation.modelInvocable === true &&
      registered[0].invocation.userInvocable === true &&
      registered[0].provider === 'localize' &&
      registered[0].resourceBase.kind === 'directory' &&
      registered[0].resourceBase.path === dirname(skill.file),
    JSON.stringify(registered[0].invocation),
  )
  check('and its disposer belongs to ctx.effect, so the skill leaves with the plugin', labels.includes('localize: skill localize-review'), JSON.stringify(labels))
}

// THE WIRING, not just the function: `apply` has to CALL the registrar. Testing `mountSkill` on its own
// leaves "nobody calls it" as a passing state, which is exactly what a mutation of `apply` produces.
{
  const registered = []
  const ctx = {
    get: (service) => {
      if (service === 'skills') return { register: (spec) => { registered.push(spec); return () => {} } }
      if (service === 'webServer') return { register: () => () => {} }
      return undefined
    },
    effect: (fn) => { fn(); return () => {} },
    on: () => {},
  }
  localize.apply(ctx)
  check('ACTIVATION itself registers the reviewer, so nobody has to remember to call the registrar', registered.length === 1 && registered[0].name === 'localize-review', JSON.stringify(registered.map((row) => row.name)))
}
check('a plugin with NO skills service still activates: a missing registrar is not a failed boot', mountSkill({ get: () => undefined, effect: () => {}, on: () => {} }) === false && typeof localize.apply === 'function', 'threw or registered')
check('and a plugin with no webServer service does not throw either', (() => { try { localize.apply({ get: () => undefined, effect: () => {}, on: () => {} }); return true } catch { return false } })() === true, 'threw')

// ── 2. what the reviewer promises ────────────────────────────────────────────

{
  const axes = ['accuracy', 'register', 'context', 'completeness']
  check('the four axes are named, each with what a flag means', axes.every((axis) => new RegExp('\\*\\*' + axis + '\\*\\*', 'u').test(text)), JSON.stringify(axes.filter((axis) => !text.includes('**' + axis + '**'))))
  check('the three verdicts are named', ['approved', 'flagged', 'missing'].every((verdict) => text.includes('`' + verdict + '`')), 'a verdict is unnamed')
  check(
    'and a flag must say what to write instead, which the skill says in words',
    /wrong"? is not|says what to write instead/u.test(text),
    'no rule about the quality of a flag',
  )
  check('both stores are named: the overlay and the review memory', text.includes('localizations/<plugin>/<lang>.json') && text.includes(MEMORY_DIR + '/<plugin>/<lang>.json'), 'a store is unnamed')
  check(
    'it is keyed by the hash of the English source, so a rename cannot lose a verdict',
    /hash of the \*\*English source\*\*/u.test(text) || /hash of the English source/u.test(text),
    'the key is not stated',
  )
}

// ── 3. the gate's rules, and the prompt version ──────────────────────────────

{
  check('both panels must pass', /Both must pass/u.test(text), 'unnamed')
  check('either can veto', /Either can veto/u.test(text), 'unnamed')
  check('no retry-until-green: every attempt is logged INCLUDING rejections', /No retry-until-green/u.test(text) && /INCLUDING rejections|including rejections/u.test(text), 'unnamed')
  check('and the founder is the escalation judge, tie-breaker only', /escalation judge/u.test(text) && /only theirs|tie/u.test(text), 'unnamed')
  check(
    'THE PROMPT VERSION IN THE SKILL IS THE ONE THE STORE WRITES, so the standard and the record cannot drift',
    text.includes(PROMPT_VERSION) && text.includes('PROMPT_VERSION'),
    JSON.stringify({ inSkill: text.includes(PROMPT_VERSION), prompt: PROMPT_VERSION }),
  )
  check('and the append-only rule is stated where the record is written', /APPEND-ONLY|append-only/u.test(text), 'unnamed')
}

// ── 4. the cross-plugin check is part of the job ─────────────────────────────

{
  check('the reviewer is told to compare approvals across plugins', /Cross-plugin consistency/u.test(text) && /two ways/u.test(text), 'unnamed')
  check('and the example it gives is the one the memory can catch', text.includes('Enable'), 'no example')
}

finish()
