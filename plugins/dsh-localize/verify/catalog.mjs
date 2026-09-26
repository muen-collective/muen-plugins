/**
 * verify:catalog — epic 65 L1's claims about the language catalog, asserted against the harness's
 * OWN locale runtime rather than a fake.
 *
 * The claim: **`@muen/dsh-localize` makes the languages we own selectable, without ever taking the
 * boot down.** The rules this file checks are the ones `lib/catalog.js` exists for:
 *
 *   1. the runtime's catalog starts at exactly `zh` and `en` — the measurement the whole slice is
 *      built on (0.1.7-rc.1 seeds those two and nothing else), so a harness change is caught HERE
 *      and not in a person's app;
 *   2. every language we own is ADDED and observable through `getLocale().locales`, with its own
 *      label and the `en` fallback;
 *   3. the two built-ins are KEPT, never re-registered — a second `addLanguage` for a taken id is
 *      the one guaranteed throw, and a first attempt at this work lost the whole language list by
 *      removing the call instead of guarding it;
 *   4. one bad row is REFUSED with a reason and costs nothing else: an unknown fallback, a
 *      malformed id, an empty label, a duplicate — the rest still install;
 *   5. the choice is a real preference: `setLocale('ko')` moves the active locale and writes the
 *      id through the durable scope, which is how it survives a restart;
 *   6. and the languages are USABLE, not just listed: a dictionary can be registered for one of
 *      them afterwards, which is the pairing that makes a translation visible.
 *
 * THE ORACLE IS THE SHIPPED RUNTIME. `@deepseek-ai/dsh-client-locale/lib/client.js` is a
 * `window.__ModuleLoader__` bundle — the same shape this plugin's own client is — so it loads in
 * this process under a stub loader and the real `LocaleRuntime` is instantiated here. Its host
 * scope is a fake, because that scope is the app's (a config form), and the process-local mode the
 * runtime supports with no host at all is exactly the seam this suite needs.
 *
 *   node verify/catalog.mjs
 */

// ── reporter, the bundle, and the harness's own runtime ──────────────────────

import { CLIENT, fakeScope, loadClient, loadLocaleRuntime, localeBundlePath, miniReact, primitivesStub, reporter } from './harness.mjs'

const { check, note, finish } = reporter('verify:catalog', 'epic 65 L1 (the languages we own)')

const mini = miniReact()
const ui = primitivesStub()
const client = loadClient(CLIENT, { react: mini.React, primitives: ui.primitives })
const { BUILT_IN, ID_PATTERN, LANGUAGES, catalogued, installLanguages, owned } = client

const bundlePath = localeBundlePath()
if (bundlePath === null) {
  note('the harness locale bundle was not found, so the runtime oracle is skipped (set DSH_CLIENT_LOCALE)')
  finish()
  process.exit(0)
}

const { LocaleRuntime, make } = loadLocaleRuntime(bundlePath)
const makeRuntime = (scope) => make(scope)

check('the shipped bundle carries the catalog this slice is about', typeof installLanguages === 'function' && Array.isArray(LANGUAGES) && LANGUAGES.length > 0, JSON.stringify({ languages: LANGUAGES.map((row) => row.id) }))

// ── 1. what the runtime carries by itself ────────────────────────────────────

{
  const runtime = makeRuntime(fakeScope())
  const ids = runtime.getLocale().locales.map((row) => row.id)
  check(
    'the runtime seeds exactly `zh` and `en`, which is why the language list has to be OURS',
    ids.length === 2 && ids.includes('zh') && ids.includes('en'),
    JSON.stringify(ids),
  )
  check('and `en` is the fallback root the chain has to terminate at', runtime.getLocale().active === 'en', runtime.getLocale().active)
}

// ── 2. the languages we own ──────────────────────────────────────────────────

{
  const runtime = makeRuntime(fakeScope())
  const report = installLanguages(runtime)
  const ids = runtime.getLocale().locales.map((row) => row.id)

  check(
    'every language we own is ADDED to the catalog — that is what makes it selectable',
    report.added.length === LANGUAGES.length && LANGUAGES.every((row) => report.added.includes(row.id)),
    JSON.stringify(report),
  )
  check(
    'and nothing is re-registered: no call goes to a built-in, which is the one guaranteed throw',
    report.refused.length === 0 && ids.includes('en') && ids.includes('zh') && ids.indexOf('en') === 1,
    JSON.stringify(report),
  )
  const builtInRow = installLanguages(runtime, [{ id: 'en', label: 'English', fallback: 'en' }])
  check(
    'a row naming a language the runtime already carries is KEPT, not refused and not re-added',
    builtInRow.kept.join(',') === 'en' && builtInRow.added.length === 0 && builtInRow.refused.length === 0,
    JSON.stringify(builtInRow),
  )
  check(
    'the catalog then lists them all, in registration order, after the built-ins',
    ids.join(',') === 'zh,en,' + LANGUAGES.map((row) => row.id).join(','),
    JSON.stringify(ids),
  )
  check(
    'each one is observable with its OWN label and the `en` fallback',
    LANGUAGES.every((row) => {
      const found = runtime.getLocale().locales.find((entry) => entry.id === row.id)
      return found && found.label === row.label && found.fallback === 'en'
    }),
    JSON.stringify(runtime.getLocale().locales.map((row) => [row.id, row.label, row.fallback])),
  )
  check(
    'the labels are self-described endonyms, NFC-normalised, so a person reads their own language',
    LANGUAGES.map((row) => row.label).join(',') === '한국어,日本語,Français,Deutsch,Español' &&
      LANGUAGES.every((row) => row.label === row.label.normalize('NFC') && row.label.trim() === row.label),
    JSON.stringify(LANGUAGES.map((row) => [row.id, row.label])),
  )
  check(
    'and ko/ja are the reviewed pair, with the rest catalogued but not signed off',
    LANGUAGES.filter((row) => row.reviewed).map((row) => row.id).join(',') === 'ko,ja',
    JSON.stringify(LANGUAGES.filter((row) => row.reviewed).map((row) => row.id)),
  )
}

// ── 3. idempotence: running twice is not a second registration ───────────────

{
  const runtime = makeRuntime(fakeScope())
  installLanguages(runtime)
  const before = runtime.getLocale().locales.map((row) => row.id).join(',')
  const again = installLanguages(runtime)
  check(
    'a second install adds nothing and refuses nothing — activation runs once, but it may be re-entered',
    again.added.length === 0 && again.refused.length === 0 && again.kept.length === LANGUAGES.length,
    JSON.stringify(again),
  )
  check('and the catalog is untouched by it', runtime.getLocale().locales.map((row) => row.id).join(',') === before, runtime.getLocale().locales.map((row) => row.id).join(','))
}

// ── 4. one bad row costs nothing else ────────────────────────────────────────

{
  const runtime = makeRuntime(fakeScope())
  const rowsIn = [
    { id: 'ko', label: '한국어', fallback: 'en' },
    { id: 'xx', label: 'Unknown fallback', fallback: 'nope' },
    { id: 'not a tag!', label: 'Bad id', fallback: 'en' },
    { id: 'zz', label: '   ', fallback: 'en' },
    { id: 'ja', label: '日本語', fallback: 'en' },
    { id: 'ko', label: '한국어 again', fallback: 'en' },
  ]
  const report = installLanguages(runtime, rowsIn)
  check(
    'an unknown fallback, a malformed id and an empty label are each REFUSED with a reason, never thrown',
    report.refused.map((row) => row.reason).join('|') === 'unknown-fallback|bad-id|bad-label|duplicate-row',
    JSON.stringify(report.refused),
  )
  check(
    'and the rows around them still install',
    report.added.join(',') === 'ko,ja' && runtime.getLocale().locales.map((row) => row.id).includes('ja'),
    JSON.stringify({ added: report.added, ids: runtime.getLocale().locales.map((row) => row.id) }),
  )
}

// ── 5. the choice is a real, durable preference ──────────────────────────────

{
  const scope = fakeScope()
  const runtime = makeRuntime(scope)
  installLanguages(runtime)
  runtime.setLocale('ko')
  check('choosing a language we added moves the active locale', runtime.getLocale().active === 'ko', runtime.getLocale().active)
  check(
    'and it is written through the durable scope, which is how it survives a restart',
    scope.state.value && scope.state.value.preference === 'ko',
    JSON.stringify(scope.state.value),
  )
  const restarted = makeRuntime(fakeScope('ja'))
  installLanguages(restarted)
  check(
    'a runtime built over a stored preference adopts it as its active locale',
    restarted.getLocale().active === 'ja',
    restarted.getLocale().active,
  )
  const tooEarly = new LocaleRuntime({ emit: () => {}, effect: () => {} }, fakeScope('ko'), undefined)
  check(
    'and a stored language is held until its definition arrives, rather than losing the choice',
    tooEarly.getLocale().active === 'en' && installLanguages(tooEarly).added.includes('ko') && tooEarly.getLocale().active === 'ko',
    JSON.stringify({ active: tooEarly.getLocale().active }),
  )
}

// ── 6. the languages are USABLE, not merely listed ───────────────────────────

{
  const runtime = makeRuntime(fakeScope())
  installLanguages(runtime)
  let registered = null
  try {
    runtime.register('dsh-localize', 'ko', { 'globe.label': '언어' })
    registered = 'ok'
  } catch (error) {
    registered = String((error && error.message) || error)
  }
  check(
    'a dictionary registers for a language we added — the pairing that makes a translation visible',
    registered === 'ok',
    registered,
  )
  let second = null
  try {
    runtime.register('dsh-localize', 'ko', { 'globe.label': '언어' })
    second = 'ok'
  } catch (error) {
    second = String((error && error.message) || error)
  }
  check(
    'and the same (namespace, language) twice is refused BY THE RUNTIME, which is why we register once',
    second !== 'ok' && /already has locale/u.test(second),
    second,
  )
}

// ── 7. this machine's own facts, read-only ───────────────────────────────────

{
  const runtime = makeRuntime(fakeScope())
  const ids = runtime.getLocale().locales.map((row) => row.id)
  check(
    'the language list is data: adding a language is one row, and every row survives the runtime\'s own id rule',
    LANGUAGES.every((row) => ID_PATTERN.test(row.id) && ID_PATTERN.test(row.fallback)) && owned('ko') && !owned('en') && !owned('zh'),
    JSON.stringify({ ids, builtIn: BUILT_IN }),
  )
  check(
    'and the catalog this module reads back is the runtime\'s, not a copy of it',
    catalogued(runtime).has('en') && catalogued(runtime).has('zh') && !catalogued(runtime).has('ko'),
    JSON.stringify([...catalogued(runtime)]),
  )
}

note('oracle: ' + bundlePath)
finish()
