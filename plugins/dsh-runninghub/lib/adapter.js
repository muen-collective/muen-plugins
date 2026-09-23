/**
 * The adapter: one JSON file per workflow (epic 61 §8), and the validator that
 * decides whether it may be listed.
 *
 * A file at `<profile>/runninghub/adapters/<name>.json` says which RunningHub app,
 * which revision, which doors it has, and how those doors should look. The doors
 * are derived from the API (lib/doors.js); the label overrides, the order, the run
 * label and the blurb are authored. Nothing else is.
 *
 * TWO RULES FROM §8 DO MOST OF THE WORK HERE:
 *
 *   17. **Everything except `title`, `variant`, door `label` overrides and the `ui`
 *       block is copied from `fieldData`.** `default`, `options`, `min`, `max`,
 *       `step`, `multiline` and `hint` are measured facts about the app, not design
 *       decisions. If one of them differs from the live app, that is a bug, and the
 *       validator reports it rather than accepting a surface that renders a control
 *       the app does not have.
 *   18. **A door is identified by `(nodeId, fieldName)`, never by `nodeId` alone.**
 *       Two doors share `942` on a real app, so the validator compares the pair and
 *       tells "this door is gone" apart from "this door is paired with the wrong
 *       field name" — the two failures have different fixes.
 *
 * The validator is read-only. It re-reads the app (that is the dry run: no coins,
 * no submit) and reports; the writer is the agent, through its own file tools,
 * after the user has confirmed the door list.
 *
 * @module @muen/dsh-runninghub/lib/adapter
 */
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { DOOR_TYPES } from './doors.js'

export const ADAPTER_SCHEMA = 'muen-rh-adapter/v1'

/** Derived from `fieldData`, so a difference is drift rather than a preference. */
const DERIVED_KEYS = ['options', 'min', 'max', 'step', 'default', 'multiline', 'hint']

const ORIGINS = ['mine', 'community']

function str(value) {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null
}

function sameValue(a, b) {
  if (Array.isArray(a) || Array.isArray(b)) return JSON.stringify(a) === JSON.stringify(b)
  return a === b
}

/** A one-line blurb from the API's description, which arrives as HTML. */
export function blurbFrom(description) {
  const text = String(description ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
  return text.length > 160 ? text.slice(0, 157).trimEnd() + '…' : text
}

/**
 * The adapter a mechanical install proposes, before a person or the agent has
 * touched it. This is what the pane shows as "what I read" (§2b step 3) and what
 * the skill starts from.
 *
 * `origin` is deliberately empty: the API carries no author (§2), so the plugin
 * cannot tell the user's own app from someone else's, and guessing is the one
 * thing §2 rule 1 forbids. The validator requires a real value, which forces the
 * decision into the confirm step instead of into a default.
 */
export function adapterFromDoors({ app, house, url = null, title = null, at = new Date().toISOString() }) {
  const doors = {}
  const order = []
  const firstFocused = app.doors.find((door) => door.supported && door.type === 'image') || app.doors.find((door) => door.supported)
  for (const door of app.doors) {
    if (!door.supported) continue
    const entry = { nodeId: door.nodeId, fieldName: door.fieldName, type: door.type, label: door.label }
    if (door.key === (firstFocused && firstFocused.key)) entry.primary = true
    if (door.advanced) entry.advanced = true
    for (const key of DERIVED_KEYS) if (door[key] !== undefined) entry[key] = door[key]
    doors[door.key] = entry
    order.push(door.key)
  }
  return {
    schema: ADAPTER_SCHEMA,
    name: '',
    title: title === null ? app.webappName || '' : title,
    variant: '',
    blurb: blurbFrom(app.description),
    group: '',
    cover: app.cover || '',
    origin: '',
    source: {
      kind: 'webapp',
      appId: app.appId,
      // The public API exposes no revision, so this is the date the doors were
      // read — recorded as what it is rather than dressed up as a version.
      revision: at.slice(0, 10),
      webappName: app.webappName || '',
      url: url || '',
      author: '',
    },
    model: '',
    doors,
    ui: { runLabel: house.runLabel, expect: '', presets: [], order },
    provenance: { writtenBy: 'agent', at, checkedAgainst: 'apiCallDemo', checkedAt: at, dryRun: '' },
  }
}

/**
 * Validate an adapter against the live app.
 *
 * Every problem names the door and the two values, because "invalid adapter" is
 * not a fix.
 *
 * @returns {{ ok: boolean, problems: Array<{code: string, door?: string, detail: string}>, doors: number }}
 */
export function validateAdapter(adapter, { app }) {
  const problems = []
  const add = (code, detail, door) => problems.push(door === undefined ? { code, detail } : { code, door, detail })

  if (!adapter || typeof adapter !== 'object' || Array.isArray(adapter)) {
    return { ok: false, problems: [{ code: 'schema', detail: 'the adapter is not an object' }], doors: 0 }
  }
  if (adapter.schema !== ADAPTER_SCHEMA) {
    add('schema', `schema must be "${ADAPTER_SCHEMA}", found ${JSON.stringify(adapter.schema ?? null)}`)
  }
  const name = str(adapter.name)
  if (name === null) add('name', 'name is required: it is the file name and the identity')
  else if (!/^[a-z0-9][a-z0-9._-]*$/.test(name)) add('name', `name "${name}" must be lower case letters, digits, dot, dash or underscore`)
  if (str(adapter.title) === null) add('title', 'title is required: it is the label the user sees')
  if (adapter.origin !== undefined && !ORIGINS.includes(adapter.origin)) {
    add('origin', `origin must be one of ${ORIGINS.join(' | ')}`)
  }
  if (!ORIGINS.includes(adapter.origin)) {
    add('origin-missing', 'origin says whose work this is and the API cannot tell us; set "mine" or "community"')
  }

  const source = adapter.source
  if (!source || typeof source !== 'object') add('source', 'source is required: it records which app and when it was read')
  else {
    if (source.kind !== 'webapp') add('source', `source.kind must be "webapp", found ${JSON.stringify(source.kind ?? null)}`)
    if (str(source.appId) === null) add('source', 'source.appId is required')
    else if (app && String(source.appId) !== String(app.appId)) {
      add('source', `source.appId ${source.appId} is not the app that was read (${app.appId})`)
    }
  }

  const doors = adapter.doors
  if (!doors || typeof doors !== 'object' || Array.isArray(doors) || Object.keys(doors).length === 0) {
    add('doors', 'doors is required and must declare at least one door')
    return { ok: false, problems, doors: 0 }
  }

  const liveByPair = new Map()
  const liveByNode = new Map()
  const liveByField = new Map()
  for (const door of app.doors) {
    liveByPair.set(door.nodeId + '/' + door.fieldName, door)
    if (!liveByNode.has(door.nodeId)) liveByNode.set(door.nodeId, door)
    if (!liveByField.has(door.fieldName)) liveByField.set(door.fieldName, door)
  }

  const keys = new Set(Object.keys(doors))
  for (const [key, entry] of Object.entries(doors)) {
    if (!entry || typeof entry !== 'object') {
      add('door', `door "${key}" is not an object`, key)
      continue
    }
    const nodeId = str(entry.nodeId)
    const fieldName = str(entry.fieldName)
    if (nodeId === null || fieldName === null) {
      add('door', 'a door needs both nodeId and fieldName; the pair is the identity', key)
      continue
    }

    const live = liveByPair.get(nodeId + '/' + fieldName)
    if (live === undefined) {
      const sameNode = liveByNode.get(nodeId)
      const sameField = liveByField.get(fieldName)
      if (sameField === undefined) {
        // The field name is on no door of this app. A node id that exists does not
        // rescue it: the pair is the identity, and half a pair is not a door.
        add(
          'unknown-door',
          sameNode === undefined
            ? `${nodeId}/${fieldName} is not exposed by this app`
            : `no door on this app is named "${fieldName}"; node ${nodeId} carries "${sameNode.fieldName}"`,
          key,
        )
      } else {
        // The field name is real, at a different node. This is the failure a
        // node-id-only check misses, and it is why the pair is compared.
        add('door-pair', `fieldName "${fieldName}" is node ${sameField.nodeId} on the live app, not node ${nodeId}`, key)
      }
      continue
    }

    if (!DOOR_TYPES.includes(entry.type)) {
      add('unsupported-type', `type ${JSON.stringify(entry.type ?? null)} is not one of ${DOOR_TYPES.join(' | ')}`, key)
    }
    for (const derived of DERIVED_KEYS) {
      const expected = live[derived]
      const actual = entry[derived]
      if (expected === undefined) {
        if (actual !== undefined) add('derived-drift', `${derived} is ${JSON.stringify(actual)} but the app declares none`, key)
        continue
      }
      if (actual === undefined) {
        add('derived-missing', `${derived} must be copied from the app: ${JSON.stringify(expected)}`, key)
        continue
      }
      if (!sameValue(actual, expected)) {
        add('derived-drift', `${derived} is ${JSON.stringify(actual)} but the app says ${JSON.stringify(expected)}`, key)
      }
    }
  }

  const ui = adapter.ui
  if (ui !== undefined) {
    if (!ui || typeof ui !== 'object' || Array.isArray(ui)) add('ui', 'ui must be an object when present')
    else {
      if (ui.runLabel !== undefined && str(ui.runLabel) === null) add('ui', 'ui.runLabel must be a non-empty string')
      if (ui.order !== undefined) {
        if (!Array.isArray(ui.order)) add('ui', 'ui.order must be an array of door keys')
        else for (const key of ui.order) if (!keys.has(key)) add('ui', `ui.order names "${key}", which no door declares`)
      }
      if (ui.presets !== undefined) {
        if (!Array.isArray(ui.presets)) add('ui', 'ui.presets must be an array')
        else {
          ui.presets.forEach((preset, index) => {
            if (!preset || typeof preset !== 'object') return add('ui', `ui.presets[${index}] is not an object`)
            if (str(preset.label) === null) add('ui', `ui.presets[${index}].label is required`)
            for (const key of Object.keys(preset.doors || {})) {
              if (!keys.has(key)) add('ui', `ui.presets[${index}] sets "${key}", which no door declares`)
            }
          })
        }
      }
    }
  }

  const provenance = adapter.provenance
  if (!provenance || typeof provenance !== 'object') add('provenance', 'provenance is required: it is what Re-check compares against')
  else {
    if (str(provenance.checkedAgainst) === null) add('provenance', 'provenance.checkedAgainst is required (apiCallDemo)')
    if (provenance.dryRun !== 'ok') {
      add('not-dry-run', 'provenance.dryRun must be "ok": an unvalidated adapter is not a capability (§8 rule 10)')
    }
  }

  return {
    ok: problems.length === 0,
    problems,
    doors: Object.keys(doors).length,
  }
}

/**
 * Every adapter on disk, as a list the guide card can draw.
 *
 * The card is a DISK READ, not a network call: the pane asks the host for this when
 * it mounts, and the host answers with what is installed right now. Nothing here
 * talks to RunningHub, so drawing the card spends no coins and cannot fail on the
 * network.
 *
 * AN ENTRY IS LISTED ONLY IF IT COULD BE OPENED. Three facts decide that, and each
 * is a rule the epic already states:
 *
 *   1. `schema` is this version (§8): a file from some future shape is not ours to read;
 *   2. `provenance.dryRun === 'ok'`: "an entry appears only after `rh_adapter_validate`
 *      passes" (§10);
 *   3. `origin` is set: the API cannot say whose app it is, so an adapter that never
 *      answered that question was never confirmed by a person (§2 rule 1).
 *
 * A file that fails one of those is REPORTED, never silently dropped — the card is
 * what the user sees, and "I installed it and it is not there" needs an answer.
 *
 * @param {string} dir - `<profile>/runninghub/adapters`
 * @returns {Promise<{ entries: Array<object>, skipped: Array<{file: string, reason: string}> }>}
 *   `entries` in a stable order (title, then variant, then name), each carrying only
 *   what a card draws.
 */
export async function listAdapters(dir, { readDirectory = readdir, readText = readFile } = {}) {
  let names
  try {
    names = await readDirectory(dir)
  } catch (error) {
    // No directory is the fresh-install case, not a failure: the card is empty.
    if (error && error.code === 'ENOENT') return { entries: [], skipped: [] }
    throw error
  }

  const entries = []
  const skipped = []
  for (const file of names.filter((name) => name.endsWith('.json')).sort()) {
    let adapter
    try {
      adapter = JSON.parse(await readText(join(dir, file), 'utf8'))
    } catch {
      skipped.push({ file, reason: 'invalid-json' })
      continue
    }
    const read = adapter && typeof adapter === 'object' && !Array.isArray(adapter) ? adapter : null
    const name = str(read && read.name) || file.slice(0, -'.json'.length)
    if (!read || read.schema !== ADAPTER_SCHEMA) {
      skipped.push({ file, reason: 'schema' })
      continue
    }
    if (!read.provenance || read.provenance.dryRun !== 'ok') {
      skipped.push({ file, reason: 'not-validated' })
      continue
    }
    if (!ORIGINS.includes(read.origin)) {
      skipped.push({ file, reason: 'origin-missing' })
      continue
    }
    entries.push({
      name,
      title: str(read.title) || name,
      blurb: str(read.blurb) || '',
      group: str(read.group) || '',
      variant: str(read.variant) || '',
      cover: str(read.cover) || '',
      origin: read.origin,
      appId: str(read.source && read.source.appId) || '',
      webappName: str(read.source && read.source.webappName) || '',
      runLabel: str(read.ui && read.ui.runLabel) || '',
      doorCount: read.doors && typeof read.doors === 'object' ? Object.keys(read.doors).length : 0,
    })
  }

  entries.sort((a, b) => order(a.title, b.title) || order(a.variant, b.variant) || order(a.name, b.name))
  return { entries, skipped }
}

/** Plain code-unit order: one answer on every machine, unlike a locale-aware sort. */
function order(a, b) {
  return a < b ? -1 : a > b ? 1 : 0
}
