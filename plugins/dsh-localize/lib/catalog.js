'use strict'

/**
 * THE LANGUAGE CATALOG (epic 65 L1) — the languages this plugin adds to the harness's shared
 * catalog, and the one place their ids, labels and fallbacks are written down.
 *
 * WHY A TABLE AND A CALL, not a dictionary: `locale.register(ns, locale, dict)` stores strings and
 * **does not make a language selectable**. The picker lists the catalog, and the catalog is filled
 * by `locale.addLanguage({ id, label, fallback })` — measured 2026-09-26 in
 * `@deepseek-ai/dsh-client-locale/lib/client.js` (0.1.7-rc.1), where the runtime seeds the catalog
 * with **`zh` and `en`** only, `addLanguage` **throws** when the id is taken or the fallback is not
 * yet registered, and the fallback chain must terminate at English. A dictionary registered for a
 * language nobody added is dead weight; that is exactly the trap the reverted first attempt fell
 * into (see the epic's §2).
 *
 * SO THIS MODULE IS DEFENSIVE BY CONSTRUCTION. It adds only what is missing, it refuses a row it
 * cannot defend (a malformed id, an empty label, a fallback that is not in the catalog) with a
 * reason instead of taking the boot down with it, and it reports what it did. `addLanguage` is
 * called exactly once per language that needs it, because a second call for a language already in
 * the catalog is the one guaranteed way to throw during activation.
 */

/** Accepted BCP 47-style ids — the same shape the runtime validates against. */
const ID_PATTERN = /^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/u

/**
 * THE LANGUAGES WE OWN, and the fallback each one degrades to.
 *
 * `label` is SELF-DESCRIBED — a person looking for their own language reads it in that language,
 * not in the one they cannot read (`한국어`, not "Korean"). `reviewed` says whether a native speaker
 * has signed the translations off (epic 65 §7.1: catalog all six so a French user can actually pick
 * French, review ko/ja). It is data about the TRANSLATION's state, never about whether the language
 * may be chosen — hiding an unreviewed language would take the choice away from the person whose
 * language it is.
 */
const LANGUAGES = Object.freeze([
  Object.freeze({ id: 'ko', label: '한국어', fallback: 'en', reviewed: true }),
  Object.freeze({ id: 'ja', label: '日本語', fallback: 'en', reviewed: true }),
  Object.freeze({ id: 'fr', label: 'Français', fallback: 'en', reviewed: false }),
  Object.freeze({ id: 'de', label: 'Deutsch', fallback: 'en', reviewed: false }),
  Object.freeze({ id: 'es', label: 'Español', fallback: 'en', reviewed: false }),
])

/** The ids the runtime carries itself; a row naming one of these is kept, never re-registered. */
const BUILT_IN = Object.freeze(['en', 'zh'])

/** Lower-cased id of every language the service currently lists. */
function catalogued(service) {
  try {
    const snapshot = service.getLocale()
    const locales = snapshot && Array.isArray(snapshot.locales) ? snapshot.locales : []
    return new Set(locales.map((row) => String(row && row.id).toLowerCase()))
  } catch {
    // A service that cannot answer has nothing to keep — the add calls then answer for themselves.
    return new Set()
  }
}

/** Why one row cannot be offered, or `null` when it can. */
function refuseReason(row, known) {
  if (row === null || typeof row !== 'object') return 'not-a-row'
  if (typeof row.id !== 'string' || !ID_PATTERN.test(row.id)) return 'bad-id'
  if (typeof row.label !== 'string' || row.label.trim() === '') return 'bad-label'
  if (typeof row.fallback !== 'string' || row.fallback.trim() === '') return 'bad-fallback'
  if (!known.has(row.fallback.toLowerCase())) return 'unknown-fallback'
  return null
}

/**
 * Offer every language the service does not already list.
 *
 * Answers `{ added, kept, refused, catalog }` — `added` and `kept` as ids, `refused` as
 * `{ id, reason }`, and `catalog` the id list afterwards. Nothing here throws: a language that
 * cannot be added is a line in a report, and the ones that can be are added, because a single bad
 * row must not cost a person the rest of the picker.
 */
function installLanguages(service, languages = LANGUAGES) {
  const added = []
  const kept = []
  const refused = []
  const known = catalogued(service)
  // The ids this TABLE has already offered. A repeat is our own data error, and it is refused
  // rather than folded into `kept`: keeping it would hide a typo behind the service's silence.
  const offered = new Set()

  for (const row of languages) {
    const id = row && typeof row.id === 'string' ? row.id : null
    const reason = refuseReason(row, known)
    if (reason !== null) {
      refused.push({ id, reason })
      continue
    }
    if (offered.has(id.toLowerCase())) {
      refused.push({ id, reason: 'duplicate-row' })
      continue
    }
    if (known.has(id.toLowerCase())) {
      offered.add(id.toLowerCase())
      kept.push(id)
      continue
    }
    try {
      service.addLanguage({ id: row.id, label: row.label, fallback: row.fallback })
      known.add(id.toLowerCase())
      offered.add(id.toLowerCase())
      added.push(id)
    } catch (error) {
      // The service is the authority on what it will take; its own words are the reason.
      refused.push({ id, reason: String((error && error.message) || error) })
    }
  }

  return { added, kept, refused, catalog: [...known] }
}

/** True when a language id is one this table owns (so a caller can tell ours from the runtime's). */
function owned(id) {
  return LANGUAGES.some((row) => row.id.toLowerCase() === String(id).toLowerCase())
}

module.exports = { LANGUAGES, BUILT_IN, ID_PATTERN, installLanguages, catalogued, owned }
