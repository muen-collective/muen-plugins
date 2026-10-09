// @muen/dsh-studio — character bibles (M3).
//
// A bible is the character's eight paragraph slots (seals.js owns the schema)
// plus its gate record. The M3 loop: create → draft (Casting role via the BYOK
// seam) → human edits → Approve (seal core v1). Later looks seal separately
// (M4); the core never re-seals without an explicit revise that bumps the
// version — that is the drift guard working at the data level.
import { seal, hashSlot, CORE_SLOTS, LOOK_SLOTS, SCENE_SLOTS, SLOTS } from './seals.js'

export function emptyBible(id, name) {
  return {
    id,
    name: typeof name === 'string' && name.trim() ? name.trim() : id,
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
    paragraphs: Object.fromEntries(SLOTS.map((slot) => [slot, ''])),
    core: null, // sealed core: { version, layer:'core', sealed: {slot:{text,hash}} }
    looks: {}, // M4: lookId -> sealed look record
    gate: null, // { by, at, coreVersion }
  }
}

/** Human edits a paragraph. Refused while sealed — revise is the only way in. */
export function editParagraph(bible, slot, text) {
  if (!SLOTS.includes(slot)) return { ok: false, code: 400, error: 'bad-slot' }
  if (bible.core && CORE_SLOTS.includes(slot)) {
    return { ok: false, code: 409, error: 'sealed: use revise to change a sealed core paragraph' }
  }
  const paragraphs = { ...bible.paragraphs, [slot]: String(text ?? '') }
  return { ok: true, bible: { ...bible, paragraphs, updated: new Date().toISOString() } }
}

/**
 * Approve + seal the core. Requires every core paragraph to be non-empty —
 * approving a half-written identity is how drift starts.
 */
export function approve(bible) {
  for (const slot of CORE_SLOTS) {
    if (!bible.paragraphs[slot] || bible.paragraphs[slot].trim() === '') {
      return { ok: false, code: 400, error: 'core paragraph empty: ' + slot }
    }
  }
  const core = seal(bible.paragraphs, { version: ((bible.core && bible.core.version) || bible.coreVersion || 0) + 1, layer: 'core' })
  const gate = { by: 'human', at: new Date().toISOString(), coreVersion: core.version }
  return { ok: true, bible: { ...bible, core, coreVersion: core.version, gate, updated: gate.at } }
}

/** Reopen the core for editing: bumps to a NEW version at next approve (coreVersion is kept). */
export function revise(bible) {
  return { ok: true, bible: { ...bible, core: null, gate: null, updated: new Date().toISOString() } }
}

/**
 * Preflight for any prompt built from this bible: the assembled text must
 * contain every sealed core paragraph verbatim (design doc §4.1 — per-slot hash,
 * the gate refuses on drift).
 */
export function verifyPrompt(bible, prompt) {
  const drift = []
  if (bible.core && bible.core.sealed) {
    for (const [slot, entry] of Object.entries(bible.core.sealed)) {
      if (!(typeof prompt === 'string' && prompt.includes(entry.text) && hashSlot(entry.text) === entry.hash)) {
        drift.push({ slot, layer: 'core' })
      }
    }
  }
  return { ok: drift.length === 0, drift }
}

export { CORE_SLOTS, LOOK_SLOTS, SCENE_SLOTS, SLOTS }
