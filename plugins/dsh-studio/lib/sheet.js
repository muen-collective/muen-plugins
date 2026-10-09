// @muen/dsh-studio — the character-sheet composer (M3).
//
// The bible becomes a Krea 2 character sheet prompt here: sealed paragraphs in
// their slot order + the 4-panel grid grammar (from the founder's frozen Krea
// guide — the TEMPLATE is generic and ships here; a character's values never do,
// decision 58). Host-side on purpose: the pane asks for the composed prompt, so
// there is one composition and one place for the grammar to change.

import { SLOTS } from './seals.js'

/**
 * The panel grid, from the Krea guide's reference-sheet structure. Generic
 * composition instructions — the subject description carries the specifics.
 */
export const PANEL_GRAMMAR = [
  'Panel grid, 2×2: top left — close-up portrait, face and neck crop, neutral expression, catchlights in eyes.',
  'Top right — full front, standing, arms relaxed, symmetrical, full body proportions visible.',
  'Bottom left — three-quarter side view turned away, looking back over the shoulder.',
  'Bottom right — medium shot, waist up, hands clasped, garment texture in focus.',
  'Clean off-white seamless studio background, soft diffused studio lighting with subtle rim light on hair and shoulders, 50–85mm equivalent, consistent focal length across panels.',
  'Photorealistic, high-end film stock emulation, visible skin texture and pores, zero airbrushing.',
].join(' ')

/**
 * Compose the sheet prompt: paragraphs first (slot order, the identity
 * sentence), then the panel grammar. Sealed paragraphs are included VERBATIM —
 * same rule as every other assembly in this plugin.
 */
export function sheetPrompt(bible, { panels = PANEL_GRAMMAR } = {}) {
  const parts = []
  for (const slot of SLOTS) {
    const text = bible && bible.paragraphs && typeof bible.paragraphs[slot] === 'string'
      ? bible.paragraphs[slot].trim()
      : ''
    if (text !== '') parts.push(text)
  }
  parts.push(panels)
  return parts.join('\n\n')
}

/**
 * The door values for Generate's Krea 2 run (POST /plugins/generate/providers/<id>/run
 * with { name, values, confirmed: true }). The character-sheet defaults come
 * from the founder's guide: 3:4 sheets. A profile may override the model name.
 */
export function sheetValues(bible, { model = 'krea-2-large', overrides = {} } = {}) {
  return {
    name: model,
    values: {
      prompt: sheetPrompt(bible),
      aspect_ratio: '3:4',
      resolution: '1K',
      creativity: 'low', // reference sheets want the input followed, not reinterpreted
      ...overrides,
    },
  }
}
