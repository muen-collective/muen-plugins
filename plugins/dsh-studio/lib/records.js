// @muen/dsh-studio — outfit and scene records (M4).
//
// The shared loop from M3, parameterized by kind. An OUTFIT is a look-layer
// record: its paragraphs are slots 3–5 (makeup/hair/outfit) and Approve seals
// them per look — the design doc §4.1 "new costume = new look record, same
// core". A SCENE is gate-stamped but never sealed: the scene layer belongs to
// the LLM per shot, and the card is approved data, not identity.
import { seal, hashSlot, LOOK_SLOTS } from './seals.js'

export const RECORD_KINDS = {
  outfit: { slots: ['makeup', 'hair', 'outfit'], sealed: true, required: ['outfit'] },
  scene: { slots: ['environment', 'photography'], sealed: false, required: ['environment'] },
}

export function kindConfig(kind) {
  return RECORD_KINDS[kind] || null
}

export function emptyRecord(kind, id, name, { character = null } = {}) {
  const config = kindConfig(kind)
  if (!config) return null
  return {
    kind,
    id,
    name: typeof name === 'string' && name.trim() ? name.trim() : id,
    character, // outfits bind a character id; scenes keep null
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
    paragraphs: Object.fromEntries(config.slots.map((slot) => [slot, ''])),
    look: null, // sealed look record (outfits)
    lookVersion: 0,
    gate: null,
  }
}

export function editParagraph(record, slot, text) {
  const config = kindConfig(record.kind)
  if (!config || !config.slots.includes(slot)) return { ok: false, code: 400, error: 'bad-slot' }
  if (record.look && record.look.sealed && record.look.sealed[slot]) {
    return { ok: false, code: 409, error: 'sealed: use revise to change a sealed paragraph' }
  }
  return { ok: true, record: { ...record, paragraphs: { ...record.paragraphs, [slot]: String(text ?? '') }, updated: new Date().toISOString() } }
}

/** Approve: required paragraphs present; outfits seal the look, scenes gate only. */
export function approve(record) {
  const config = kindConfig(record.kind)
  if (!config) return { ok: false, code: 400, error: 'bad-kind' }
  for (const slot of config.required) {
    if (!record.paragraphs[slot] || record.paragraphs[slot].trim() === '') {
      return { ok: false, code: 400, error: 'paragraph empty: ' + slot }
    }
  }
  const at = new Date().toISOString()
  if (config.sealed) {
    const prior = Math.max((record.look && record.look.version) || 0, record.lookVersion || 0)
    const look = seal(record.paragraphs, { version: prior + 1, layer: 'look' })
    return {
      ok: true,
      record: { ...record, look, lookVersion: look.version, gate: { by: 'human', at, lookVersion: look.version }, updated: at },
    }
  }
  return { ok: true, record: { ...record, gate: { by: 'human', at }, updated: at } }
}

export function revise(record) {
  return { ok: true, record: { ...record, look: null, gate: null, updated: new Date().toISOString() } }
}

/** Per-slot preflight for prompts composed with this record. */
export function verifyPrompt(record, prompt) {
  const drift = []
  if (record.look && record.look.sealed) {
    for (const [slot, entry] of Object.entries(record.look.sealed)) {
      if (!(typeof prompt === 'string' && prompt.includes(entry.text) && hashSlot(entry.text) === entry.hash)) {
        drift.push({ slot, layer: 'look' })
      }
    }
  }
  return { ok: drift.length === 0, drift }
}

export { LOOK_SLOTS }
