/**
 * The identity seal (design doc §4.1) — the anti-drift mechanism, asserted.
 *
 * The whole reason this module exists: reusing a character must never re-word
 * its identity. What is checked: sealing is per-slot and per-layer, assembly
 * inserts sealed text byte-verbatim, preflight catches drift PER SLOT (a drifted
 * makeup line fails alone), and scene paragraphs are never sealed.
 */
import {
  SLOTS, CORE_SLOTS, LOOK_SLOTS, SCENE_SLOTS,
  slotLayer, hashSlot, seal, assemble, verifyAssembled,
} from '../lib/seals.js'

let failures = 0
function check(label, condition, detail) {
  if (condition) {
    console.log('  ok   ' + label)
  } else {
    failures += 1
    console.log('  FAIL ' + label + (detail ? ' -- ' + detail : ''))
  }
}

// The founder's paragraph order is the contract.
check('eight slots in the founder order', SLOTS.length === 8 && SLOTS[0] === 'overview' && SLOTS[1] === 'identity' && SLOTS[7] === 'photography', SLOTS.join(','))
check('core is slots 1–2', CORE_SLOTS.join(',') === 'overview,identity')
check('look is slots 3–5', LOOK_SLOTS.join(',') === 'makeup,hair,outfit')
check('scene is slots 6–8', SCENE_SLOTS.join(',') === 'pose,environment,photography')
check('every slot has a layer', SLOTS.every((slot) => ['core', 'look', 'scene'].includes(slotLayer(slot))))

// ── sealing ──────────────────────────────────────────────────────────────────

const paragraphs = {
  overview: 'Mitsu, an exhausted hacker.',
  identity: 'Tall, thin, pale luminous skin with visible pores.',
  makeup: 'Warm orange-red eyeshadow, dark undereye circles.',
  hair: 'Jet-black, shoulder-length, limp.',
  outfit: 'Victorian maid uniform, black wool.',
  pose: 'Half-lidded stance.',
  environment: 'A neon convenience store at night.',
  photography: 'Kodak Portra 400, shallow depth of field.',
}

const core = seal(paragraphs, { version: 1, layer: 'core' })
const look = seal(paragraphs, { version: 1, layer: 'look' })

check('core seals exactly the core slots', Object.keys(core.sealed).sort().join(',') === 'identity,overview', Object.keys(core.sealed).join(','))
check('look seals exactly the look slots', Object.keys(look.sealed).sort().join(',') === 'hair,makeup,outfit', Object.keys(look.sealed).join(','))
check('scene paragraphs are never sealed', [core, look].every((s) => !s.sealed.pose && !s.sealed.environment && !s.sealed.photography))
check('sealed text is kept verbatim', core.sealed.overview.text === paragraphs.overview)
check('a hash is recorded per slot', typeof core.sealed.identity.hash === 'string' && core.sealed.identity.hash.length === 16)
check('same text hashes the same', hashSlot(paragraphs.makeup) === look.sealed.makeup.hash)
check('different text hashes different', hashSlot(paragraphs.makeup + '!') !== look.sealed.makeup.hash)
check('empty paragraphs are not sealed', Object.keys(seal({ overview: '  ' }, { layer: 'core' }).sealed).length === 0)

// ── assembly: sealed verbatim + free scene prose ─────────────────────────────

const prompt = assemble({ core, look, scene: {
  pose: 'She lurches and slumps against the counter.',
  environment: 'Rain against the glass.',
  photography: 'Warm tungsten key light from the left.',
}, triggerWords: ['h3 people', 'portrait'] })

check('trigger words ride in front', prompt.startsWith('h3 people, portrait'), prompt.slice(0, 40))
check('core paragraph lands verbatim', prompt.includes(paragraphs.overview))
check('look paragraph lands verbatim', prompt.includes(paragraphs.outfit))
check('scene prose lands', prompt.includes('She lurches and slumps against the counter.'))
check('core precedes look precedes scene',
  prompt.indexOf(paragraphs.overview) < prompt.indexOf(paragraphs.outfit) &&
  prompt.indexOf(paragraphs.outfit) < prompt.indexOf('She lurches'))

const noLook = assemble({ core, scene: { pose: 'x' } })
check('a base-look shot assembles without a look block', !noLook.includes(paragraphs.makeup) && noLook.includes(paragraphs.overview))

// ── preflight: per-slot drift refusal ────────────────────────────────────────

check('an assembled prompt passes', verifyAssembled(prompt, core, look).ok)
check('no seals means no drift', verifyAssembled('anything').ok)

// Mutation: re-word the makeup paragraph (the exact drift the founder sees).
const drifted = prompt.replace(paragraphs.makeup, 'Soft peach blush, dewy skin.')
const afterDrift = verifyAssembled(drifted, core, look)
check('drifted look paragraph is caught', afterDrift.ok === false && afterDrift.drift.some((d) => d.slot === 'makeup'), JSON.stringify(afterDrift.drift))
check('the drift is reported as look layer', afterDrift.drift.find((d) => d.slot === 'makeup').layer === 'look')
check('undrifted slots are not flagged', !afterDrift.drift.some((d) => d.slot === 'overview') && !afterDrift.drift.some((d) => d.slot === 'hair'))

// Mutation: drift the core — the identity drift that must never spend.
const coreDrift = prompt.replace(paragraphs.identity, 'Tall, thin, luminous skin.')
const afterCore = verifyAssembled(coreDrift, core, look)
check('drifted core is caught', afterCore.ok === false && afterCore.drift.some((d) => d.slot === 'identity' && d.layer === 'core'), JSON.stringify(afterCore.drift))

// Mutation: tamper with the seal record itself (hash no longer matches text).
const tampered = { ...core, sealed: { ...core.sealed, overview: { ...core.sealed.overview, hash: 'deadbeefdeadbeef' } } }
check('a tampered seal record is caught', verifyAssembled(prompt, tampered).ok === false)

// Scene prose is never drift: changing it cannot fail preflight.
const reLit = prompt.replace('Warm tungsten key light from the left.', 'Cool teal fill from the window.')
check('re-lit scene prose is not drift', verifyAssembled(reLit, core, look).ok)

// ── the drift-free reuse loop: the same seal across two prompts ──────────────

const second = assemble({ core, look, scene: { pose: 'Different beat entirely.' } })
check('two prompts from one seal both pass', verifyAssembled(second, core, look).ok)
check('and carry identical identity text', second.includes(paragraphs.overview) && second.includes(paragraphs.identity))

console.log(failures ? '\n' + failures + ' failure(s)' : '\nseals ok')
process.exit(failures ? 1 : 0)
