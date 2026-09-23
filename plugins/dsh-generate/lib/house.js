/**
 * The door glossary, shipped with the plugin, and the two-layer house style.
 *
 * Epic 61 §2d: naming a door is the one part of an install a machine cannot read
 * off RunningHub. `descriptionEn` and `description` come back as the raw field
 * name (`"text"`, `"aspect_ratio"`, `"Value"`), so every human label is authored
 * — and a `fieldName` is a ComfyUI-style token that repeats across apps.
 *
 * The glossary is DATA, not code (D9). Layer 1 is the default below, shipped in
 * the package so a stranger's first install opens on a usable surface instead of a
 * blank form. Layer 2 is `<profile>/runninghub/_house.json`, which adds and
 * overrides entries. Layer 3 is the adapter's own `label`, `hint` and `ui` block.
 * Later wins, per key.
 *
 * The default's vocabulary is deliberately generic (§5 rule 3): "Reference image",
 * "Prompt", "Aspect ratio" — never "Garment photo" or "Person to wear it". Fashion
 * words belong to a per-workflow proposal made by the skill, which can see what
 * the workflow does. A shipped fashion-flavoured default would be wrong for the
 * first photographer who installs it, and the default is the one artefact every
 * stranger reads.
 *
 * @module @muen/dsh-generate/lib/house
 */
import { readFile } from 'node:fs/promises'

/** The schema string written into a shipped or profile house file. */
export const HOUSE_SCHEMA = 'muen-rh-house/v1'

/**
 * The shipped default house style.
 *
 * Two rules keep it honest. An unrecognised `fieldName` is title-cased rather than
 * guessed at (§2d) — a plausible wrong label is worse than an ugly right one — and
 * every key here can be overridden per profile without touching the plugin.
 */
export const SHIPPED_HOUSE = {
  schema: HOUSE_SCHEMA,
  /** What the run button says by convention. A workflow overrides it in its `ui`. */
  runLabel: 'Generate',
  /** How many doors sit on the main screen before the rest collapse. */
  mainDoors: 4,
  /**
   * Door types that are advanced by default. Empty on purpose: a type is not a
   * judgement about importance, and the door type set is only four wide.
   */
  advancedTypes: [],
  /**
   * Field names that are advanced by default. Seeds and sampling knobs are the
   * ones a person tunes last — the epic's own example marks `Value` (a seed) and
   * `megapixels` advanced (§8), and CFG/steps/sampler are the same class.
   */
  advancedFieldNames: ['Value', 'seed', 'cfg', 'steps', 'sampler_name', 'scheduler'],
  /** Where a door's hint comes from: the API's own tooltip, or nothing. */
  hint: 'tooltip',
  /** §2d's table. `label` values only — the control always comes from the API. */
  glossary: {
    image: 'Image',
    image1: 'Image 1',
    image2: 'Image 2',
    image3: 'Image 3',
    text: 'Prompt',
    prompt: 'Prompt',
    aspect_ratio: 'Aspect ratio',
    resolution: 'Resolution',
    megapixels: 'Megapixels',
    Value: 'Seed',
    seed: 'Seed',
    upload: 'Upload',
  },
  /** Authored by the skill when a workflow earns one; never shipped with an entry. */
  presets: [],
}

/** Deep merge for plain objects and arrays. Arrays replace, they do not concatenate. */
function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Merge a profile override over the shipped default.
 *
 * Per key, not whole-file: a profile that changes one label must not lose the
 * rest of the default, which is the failure mode a "replace if present" rule
 * would have had.
 */
export function mergeHouse(shipped = SHIPPED_HOUSE, override = undefined) {
  if (!isPlainObject(override)) return { ...shipped, glossary: { ...shipped.glossary } }
  const merged = { ...shipped, ...override }
  merged.glossary = { ...shipped.glossary, ...(isPlainObject(override.glossary) ? override.glossary : {}) }
  merged.advancedFieldNames = Array.isArray(override.advancedFieldNames)
    ? override.advancedFieldNames.slice()
    : shipped.advancedFieldNames.slice()
  merged.advancedTypes = Array.isArray(override.advancedTypes) ? override.advancedTypes.slice() : shipped.advancedTypes.slice()
  merged.presets = Array.isArray(override.presets) ? override.presets.slice() : []
  return merged
}

/**
 * The profile's override, or undefined.
 *
 * A missing file is the normal case, and a malformed one is reported rather than
 * thrown: the shipped default still applies, so a typo in a hand-edited
 * `_house.json` degrades the labels instead of breaking the install.
 *
 * @returns {Promise<{ house: object, source: 'profile' | 'shipped', warning?: string }>}
 */
export async function loadHouse(housePath) {
  let text
  try {
    text = await readFile(housePath, 'utf8')
  } catch {
    return { house: mergeHouse(SHIPPED_HOUSE), source: 'shipped' }
  }
  try {
    const parsed = JSON.parse(text)
    return { house: mergeHouse(SHIPPED_HOUSE, parsed), source: 'profile' }
  } catch (error) {
    return {
      house: mergeHouse(SHIPPED_HOUSE),
      source: 'shipped',
      warning: `${housePath} is not valid JSON (${String((error && error.message) || error)}); the shipped default applied`,
    }
  }
}

/** The label for a field name: the glossary when it knows the token, else title case. */
export function glossaryLabel(fieldName, glossary = SHIPPED_HOUSE.glossary) {
  const token = String(fieldName ?? '')
  if (Object.prototype.hasOwnProperty.call(glossary, token)) {
    return { label: String(glossary[token]), fromGlossary: true }
  }
  return { label: titleCase(token), fromGlossary: false }
}

/** `raw_turbo` → `Raw turbo`, `CFG` → `CFG`. Never a guess about meaning. */
export function titleCase(token) {
  const text = String(token ?? '').trim()
  if (text === '') return ''
  const words = text.replace(/[_-]+/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').split(/\s+/)
  const first = words[0]
  const head = /^[A-Z0-9]+$/.test(first) ? first : first.charAt(0).toUpperCase() + first.slice(1)
  return [head, ...words.slice(1).map((word) => (word === word.toUpperCase() && word.length > 1 ? word : word.toLowerCase()))].join(' ')
}
