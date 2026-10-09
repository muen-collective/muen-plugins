// @muen/dsh-studio — the identity seal (M3 core).
//
// The anti-drift mechanism (design doc §4.1). A character bible is eight
// paragraph slots (the founder's own prompt-writing order). At approval the
// core paragraphs are SEALED: hashed once, inserted byte-verbatim into every
// prompt afterwards, and never re-worded by any LLM. Look paragraphs seal per
// look record; scene paragraphs are LLM territory and carry no hash.
//
//   prompt = [slots 1–2 sealed core] + [slots 3–5 look record] + [slots 6–8 LLM]
//
// Preflight runs the hash PER SLOT: a drifted makeup line fails alone, without
// flagging a legitimately re-lit environment paragraph.
import { createHash } from 'node:crypto'

/** The founder's paragraph order (2026-10-08) — this is the slot contract. */
export const SLOTS = [
  'overview',
  'identity', // age / gender / face / build / skin
  'makeup',
  'hair',
  'outfit',
  'pose',
  'environment',
  'photography', // photography & lighting
]

/** Slots 1–2: sealed at bible approval. */
export const CORE_SLOTS = ['overview', 'identity']
/** Slots 3–5: sealed per look record; a costume change swaps these, core untouched. */
export const LOOK_SLOTS = ['makeup', 'hair', 'outfit']
/** Slots 6–8: the LLM writes these per shot; never sealed. */
export const SCENE_SLOTS = ['pose', 'environment', 'photography']

export function slotLayer(slot) {
  if (CORE_SLOTS.includes(slot)) return 'core'
  if (LOOK_SLOTS.includes(slot)) return 'look'
  return 'scene'
}

export function hashSlot(text) {
  return createHash('sha256').update(String(text), 'utf8').digest('hex').slice(0, 16)
}

/**
 * Seal a set of paragraphs. Returns `{ version, sealed: { slot: { text, hash } } }`
 * for the slots whose layer matches `layer` ('core' or 'look'). Empty paragraphs
 * are not sealed: an absent slot is a missing sentence, not a frozen one.
 */
export function seal(paragraphs, { version = 1, layer = 'core' } = {}) {
  const allowed = layer === 'look' ? LOOK_SLOTS : CORE_SLOTS
  const sealed = {}
  for (const slot of allowed) {
    const text = paragraphs && typeof paragraphs[slot] === 'string' ? paragraphs[slot].trim() : ''
    if (text === '') continue
    sealed[slot] = { text, hash: hashSlot(text) }
  }
  return { version, layer, sealed }
}

/**
 * Assemble a prompt from parts. Sealed text is inserted VERBATIM — this
 * function never passes it through anything that could re-word it. The look
 * block is optional (a base-look shot has none). Scene prose is free text the
 * caller (the Prompt-desk role output) supplies per slot.
 */
export function assemble({ core, look, scene = {}, triggerWords = [] } = {}) {
  const parts = []
  const triggers = (Array.isArray(triggerWords) ? triggerWords : [])
    .map((word) => String(word).trim())
    .filter(Boolean)
  if (triggers.length) parts.push(triggers.join(', '))

  const take = (sealSet) => {
    if (!sealSet || !sealSet.sealed) return
    for (const slot of SLOTS) {
      const entry = sealSet.sealed[slot]
      if (entry) parts.push(entry.text) // byte-verbatim, no re-flow, no trim
    }
  }
  take(core)
  take(look)

  for (const slot of SCENE_SLOTS) {
    const text = scene && typeof scene[slot] === 'string' ? scene[slot].trim() : ''
    if (text !== '') parts.push(text)
  }
  return parts.join('\n\n')
}

/**
 * Preflight: the assembled prompt must contain every sealed paragraph's exact
 * text, per slot. Returns `{ ok, drift: [{ slot, layer }] }` — the gate refuses
 * on any drift, same philosophy as the two-speed-LoRA refusal.
 */
export function verifyAssembled(prompt, ...sealSets) {
  const drift = []
  for (const sealSet of sealSets) {
    if (!sealSet || !sealSet.sealed) continue
    for (const [slot, entry] of Object.entries(sealSet.sealed)) {
      const present = typeof prompt === 'string' && prompt.includes(entry.text)
      const hashHolds = present && hashSlot(entry.text) === entry.hash
      if (!hashHolds) drift.push({ slot, layer: slotLayer(slot) })
    }
  }
  return { ok: drift.length === 0, drift }
}
