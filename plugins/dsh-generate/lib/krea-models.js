/**
 * The Krea models a section can open.
 *
 * WHY A CATALOGUE AND NOT AN ADAPTER FILE. A RunningHub adapter describes an AI App
 * somebody authored on RunningHub, and its doors are read from that app — which is why
 * installing one is the agent's job, guided by the `add-rh-workflow` skill. A Krea model
 * is KREA'S: the slug, the endpoint and the input schema are published by Krea, and no
 * user authors one. So the shipped list here is provider knowledge, like the door
 * glossary in `house.js`, and a profile extends it the same way `_house.json` extends
 * that glossary: `<profile>/generate/krea/_models.json` adds a model or overrides one by
 * name. Adding a model therefore needs no release and no RunningHub dry run — which Krea
 * has no equivalent of, because a read is free but a model's own schema is the only
 * source of truth about its doors.
 *
 * THE DOORS ARE KREA'S OWN, READ FROM KREA'S OPENAPI (2026-09-23,
 * `POST /generate/image/krea/krea-2/medium-turbo`, the page the founder's
 * `image/krea/krea-2/medium-turbo` SDK call resolves to). `additionalProperties: false`
 * and `required: [prompt, aspect_ratio, resolution]` are the API's, the `-100..100`
 * slider bounds and the `0.99` denoising default are the API's, and the creativity
 * default is this variant's own (`low`; the overview page documents `medium` for
 * `krea-2/medium` and `krea-2/large`, which is a different endpoint). Nothing here is a
 * product choice except the labels, the order, and which doors sit behind the surface's
 * one disclosure.
 *
 * THE FIELDS THAT ARE ARRAYS ARE NOT DOORS. `styles`, `image_style_references` and
 * `moodboards` are arrays of objects (a LoRA id with a strength, a URL with a strength, a
 * moodboard uuid) and the surface has four controls — text, number, select, image. They
 * arrive when the run slice (S5) can upload an asset and address a LoRA, and inventing a
 * text box that posts a bare string into `additionalProperties: false` would be a control
 * that cannot work.
 *
 * @module @muen/dsh-generate/lib/krea-models
 */
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { DOOR_TYPES } from './doors.js'

/** The schema string a profile's own `_models.json` carries. */
export const KREA_MODELS_SCHEMA = 'muen-krea-models/v1'

/** The profile layer, beside that provider's adapters. */
export const KREA_MODELS_FILE = '_models.json'

/**
 * The models Krea documents, in the shape the pane's list and surface already read.
 *
 * One today: the founder named it on 2026-09-23 (*"add this Krea model"*, with the SDK
 * call for `image/krea/krea-2/medium-turbo`). The sibling variants (`krea-2/medium`,
 * `krea-2/large`) are one object each when they are wanted.
 */
export const SHIPPED_KREA_MODELS = [
  {
    schema: KREA_MODELS_SCHEMA,
    name: 'krea-2-medium-turbo',
    title: 'Krea 2 Medium Turbo',
    variant: 'Turbo',
    blurb: 'Fastest Krea 2, at medium quality. Strongest on illustration, anime and painterly styles.',
    group: 'Text to image',
    /**
     * Whose model it is. The card says nothing for this value on purpose: "someone
     * else's app" is about a stranger's RunningHub app, and this is Krea's own model.
     */
    origin: 'krea',
    /** The SDK's own slug, exactly as the founder's call names it. */
    model: 'image/krea/krea-2/medium-turbo',
    /** Where the run slice (S5) posts it. Recorded here so it is not re-derived then. */
    endpoint: '/generate/image/krea/krea-2/medium-turbo',
    docs: 'https://www.krea.ai/docs/api-reference/krea/krea-2-turbo',
    doors: {
      prompt: {
        type: 'text',
        label: 'Prompt',
        multiline: true,
        primary: true,
        required: true,
        hint: 'What to draw. The API requires it.',
      },
      aspect_ratio: {
        type: 'select',
        label: 'Aspect ratio',
        options: ['1:1', '4:3', '3:2', '16:9', '2.35:1', '4:5', '3:4', '2:3', '9:16'],
        default: '1:1',
        required: true,
      },
      resolution: {
        type: 'select',
        label: 'Resolution',
        options: ['1K'],
        default: '1K',
        required: true,
        hint: 'Krea 2 documents one resolution: 1K.',
      },
      creativity: {
        type: 'select',
        label: 'Creativity',
        options: ['raw', 'low', 'medium', 'high'],
        // This variant's own default, per its schema. The overview page documents
        // `medium` for krea-2/medium and krea-2/large, and that is not this endpoint.
        default: 'low',
        hint: 'How far Krea expands on the prompt: raw renders only what you wrote; low fills obvious gaps; medium interprets; high takes creative liberty.',
      },
      // The three generative sliders, Krea's own numbers: an integer from -100 to 100,
      // with 0 applying no slider LoRA at all.
      intensity: {
        type: 'number',
        label: 'Intensity',
        min: -100,
        max: 100,
        step: 1,
        default: 0,
        advanced: true,
        hint: 'Stylization. Negative is muted and understated, positive is bold and heavily stylized.',
      },
      complexity: {
        type: 'number',
        label: 'Complexity',
        min: -100,
        max: 100,
        step: 1,
        default: 0,
        advanced: true,
        hint: 'How much the frame holds. Negative favors clean minimal compositions, positive favors dense ones.',
      },
      movement: {
        type: 'number',
        label: 'Movement',
        min: -100,
        max: 100,
        step: 1,
        default: 0,
        advanced: true,
        hint: 'Pose and camera energy. Negative keeps subjects static, positive adds motion.',
      },
      image_url: {
        type: 'image',
        label: 'Source image',
        advanced: true,
        hint: 'Optional. With one, generation starts from it instead of pure noise, and Strength decides how much changes.',
      },
      strength: {
        type: 'number',
        label: 'Strength',
        min: 0,
        max: 1,
        step: 0.01,
        default: 0.99,
        advanced: true,
        hint: 'Denoising when a source image is given: 0 keeps it, 1 replaces it. No effect without one.',
      },
      seed: {
        type: 'number',
        label: 'Seed',
        advanced: true,
        hint: 'The same seed and prompt reproduce a generation.',
      },
    },
    ui: {
      runLabel: 'Generate',
      order: [
        'prompt',
        'aspect_ratio',
        'resolution',
        'creativity',
        'intensity',
        'complexity',
        'movement',
        'image_url',
        'strength',
        'seed',
      ],
    },
  },
]

/** The name rule every identity in this plugin follows: it is a file name and a key. */
const NAME = /^[a-z0-9][a-z0-9._-]*$/

function str(value) {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null
}

function fin(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/**
 * Why one door cannot be rendered, or `null` when it can.
 *
 * The surface has four controls and each has one requirement: a select needs options to
 * select between, a number needs finite bounds when it declares any, and a starting value
 * must be one the control can actually show. A door that fails this is refused by name,
 * because a control the API would reject is worse than a missing one.
 */
function doorProblem(key, door) {
  if (!door || typeof door !== 'object' || Array.isArray(door)) return `${key} is not an object`
  if (!DOOR_TYPES.includes(door.type)) return `${key}.type ${JSON.stringify(door.type ?? null)} is not one of ${DOOR_TYPES.join(' | ')}`
  if (str(door.label) === null) return `${key}.label is required: it is what the control is called`
  if (door.type === 'select') {
    const options = Array.isArray(door.options) ? door.options.filter((option) => typeof option === 'string') : []
    if (options.length === 0) return `${key} is a select with no options`
    if (door.default !== undefined && !options.includes(door.default)) {
      return `${key}.default ${JSON.stringify(door.default)} is not one of its options`
    }
  }
  if (door.type === 'number') {
    for (const bound of ['min', 'max', 'step']) {
      if (door[bound] !== undefined && fin(door[bound]) === null) return `${key}.${bound} must be a finite number`
    }
    const start = door.default
    if (start !== undefined && fin(start) === null) return `${key}.default must be a finite number`
    if (fin(door.min) !== null && fin(start) === null) return `${key}.default is required when the door declares a minimum`
    if (fin(start) !== null) {
      if (fin(door.min) !== null && start < door.min) return `${key}.default ${start} is below its minimum of ${door.min}`
      if (fin(door.max) !== null && start > door.max) return `${key}.default ${start} is above its maximum of ${door.max}`
    }
  }
  if ((door.type === 'text' || door.type === 'image') && door.default !== undefined && typeof door.default !== 'string') {
    return `${key}.default must be a string`
  }
  return null
}

/**
 * A profile layer's contents, as models that may be drawn, and the reasons the rest may
 * not.
 *
 * Per entry, not per file: one malformed model must not take the others down, and the
 * shipped list is never at risk from a hand-edited file.
 *
 * @param {unknown} value - the parsed `_models.json`
 * @returns {{ models: Array<object>, problems: string[] }}
 */
export function normalizeModels(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { models: [], problems: ['the file is not an object'] }
  }
  if (value.schema !== KREA_MODELS_SCHEMA) {
    return { models: [], problems: [`schema must be "${KREA_MODELS_SCHEMA}", found ${JSON.stringify(value.schema ?? null)}`] }
  }
  if (!Array.isArray(value.models)) return { models: [], problems: ['models must be an array'] }

  const models = []
  const problems = []
  for (const [index, entry] of value.models.entries()) {
    const where = 'models[' + index + ']'
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      problems.push(`${where} is not an object`)
      continue
    }
    const name = str(entry.name)
    if (name === null || !NAME.test(name)) {
      problems.push(`${where}.name must be lower case letters, digits, dot, dash or underscore`)
      continue
    }
    if (str(entry.title) === null) {
      problems.push(`${where} (${name}) has no title`)
      continue
    }
    if (str(entry.model) === null || str(entry.endpoint) === null) {
      problems.push(`${name} names no model: it needs both "model" and "endpoint"`)
      continue
    }
    const doors = entry.doors
    if (!doors || typeof doors !== 'object' || Array.isArray(doors) || Object.keys(doors).length === 0) {
      problems.push(`${name} declares no doors`)
      continue
    }
    let broken = null
    for (const [key, door] of Object.entries(doors)) {
      const problem = doorProblem(key, door)
      if (problem !== null) {
        broken = `${name}: ${problem}`
        break
      }
    }
    if (broken !== null) {
      problems.push(broken)
      continue
    }
    const order = entry.ui && Array.isArray(entry.ui.order) ? entry.ui.order : []
    const named = order.find((key) => typeof key !== 'string' || !Object.prototype.hasOwnProperty.call(doors, key))
    if (named !== undefined) {
      problems.push(`${name}: ui.order names ${JSON.stringify(named)}, which no door declares`)
      continue
    }
    models.push(entry)
  }
  return { models, problems }
}

/**
 * The models this profile can draw: the shipped list, with the profile's own file laid
 * over it by name.
 *
 * A missing file is the fresh-install case, not a failure. A file that cannot be read or
 * parsed is one skipped entry rather than an empty section: the shipped models stay
 * drawable, and the reason is reported the way a broken adapter file is.
 *
 * @param {string} root - the provider's data root, `<profile>/generate/krea`
 * @returns {Promise<{ models: Array<object>, skipped: Array<{ file: string, reason: string }> }>}
 */
export async function readKreaModels(root, { readText = readFile } = {}) {
  const merged = SHIPPED_KREA_MODELS.slice()
  if (str(root) === null) return { models: merged, skipped: [] }

  let parsed
  try {
    parsed = JSON.parse(await readText(join(root, KREA_MODELS_FILE), 'utf8'))
  } catch (error) {
    if (error && error.code === 'ENOENT') return { models: merged, skipped: [] }
    return { models: merged, skipped: [{ file: KREA_MODELS_FILE, reason: 'invalid-json' }] }
  }

  const { models, problems } = normalizeModels(parsed)
  const skipped = problems.map((reason) => ({ file: KREA_MODELS_FILE, reason }))
  if (models.length === 0) return { models: merged, skipped }

  // Later wins, per name: the profile's entry replaces the shipped one, and a new name
  // is appended in the file's own order.
  const byName = new Map(merged.map((model) => [model.name, model]))
  for (const model of models) byName.set(model.name, model)
  return { models: Array.from(byName.values()), skipped }
}

/** What a card draws — the same fields `listAdapters` reports for an installed adapter. */
export function modelEntry(model) {
  return {
    name: model.name,
    title: model.title,
    blurb: str(model.blurb) || '',
    group: str(model.group) || '',
    variant: str(model.variant) || '',
    cover: str(model.cover) || '',
    origin: model.origin,
    appId: '',
    webappName: '',
    runLabel: str(model.ui && model.ui.runLabel) || '',
    doorCount: Object.keys(model.doors).length,
  }
}

/**
 * What a surface needs — the same fields `readAdapter` returns, plus the two the run
 * slice will want (`model`, `endpoint`), so S5 does not have to re-derive them.
 */
export function modelSurface(model) {
  return {
    name: model.name,
    title: str(model.title) || model.name,
    blurb: str(model.blurb) || '',
    group: str(model.group) || '',
    variant: str(model.variant) || '',
    cover: str(model.cover) || '',
    origin: model.origin,
    runLabel: str(model.ui && model.ui.runLabel) || '',
    expect: str(model.ui && model.ui.expect) || '',
    order: model.ui && Array.isArray(model.ui.order) ? model.ui.order.filter((key) => typeof key === 'string') : [],
    defaults: model.ui && model.ui.defaults && typeof model.ui.defaults === 'object' ? model.ui.defaults : {},
    doors: model.doors,
    model: model.model,
    endpoint: model.endpoint,
    // THIS SURFACE CAN RUN (S5). A model carries its own endpoint and its doors carry the
    // API's own field names, so the host can build the body and post it.
    runnable: true,
  }
}
