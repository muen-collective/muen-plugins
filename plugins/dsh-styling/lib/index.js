/**
 * @muen/dsh-styling — the host half.
 *
 * THREE JOBS:
 *   1. remember the folder a person added and probe it into one folder per look;
 *   2. answer the look list, the per-look decision, and the image bytes the pane draws;
 *   3. queue the looks that are not approved — the agent (or a runner the profile
 *      configures) does the styling; a third-party plugin cannot start an agent turn.
 *
 * THE PHOTOGRAPHS NEVER MOVE INTO THE APP. The probe creates `look NNN-originals` and
 * `look NNN-final` inside the folder the person chose, hard-linking a flat batch when
 * it has to group one. The plugin's own state lives under `<profile>/styling/`.
 *
 * THE PREFIX CARRIES NO TRAILING SLASH: the harness appends the slash itself, so a
 * registered `/plugins/styling/` answers 404 below it.
 *
 * @module @muen/dsh-styling
 */
import { createReadStream, readFileSync } from 'node:fs'
import { stat } from 'node:fs/promises'
import { dirname, extname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

import { resolveDataRoot } from './paths.js'
import { chooseStart, nativeFolders } from './folder-actions.js'
import { canPreview, previewFor } from './preview.js'
import { probe } from './scan.js'
import {
  JOB_SCHEMA,
  MANIFEST_SCHEMA,
  clearRoot,
  approvalsOf,
  approvedViewsOf,
  countsOf,
  jobPath,
  lookApproved,
  viewCountOf,
  readJob,
  readJson,
  readManifest,
  readRoot,
  readState,
  writeJob,
  writeManifest,
  writeRoot,
  writeState,
} from './state.js'

/** Matches the row id in cordis.patch.yml. */
export const name = 'styling'

const BASE = '/plugins/styling'
const STATE_PATH = BASE + '/state'
const FOLDER_PATH = BASE + '/folder'
const PROBE_PATH = BASE + '/probe'
const APPROVE_PATH = BASE + '/approve'
const NAME_PATH = BASE + '/name'
const REGENERATE_PATH = BASE + '/regenerate'
const JOB_PATH = BASE + '/job'
const DETAIL_PATH = BASE + '/detail'
const IMAGE_PATH = BASE + '/image'

const TYPE_BY_EXT = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  avif: 'image/avif',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  heic: 'image/heic',
  bmp: 'image/bmp',
}

/** A trimmed string or ''. */
function str(value) {
  return typeof value === 'string' ? value.trim() : ''
}

/** JSON answer. */
function send(res, code, body) {
  const bytes = Buffer.from(JSON.stringify(body))
  res.statusCode = code
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Content-Length', bytes.length)
  res.setHeader('Cache-Control', 'no-store')
  res.end(bytes)
}

/** One text block, the shape every tool render returns. */
function text(value) {
  return [{ type: 'text', text: String(value) }]
}

/** The body as JSON, bounded. */
function readJsonBody(req, limit = 1024 * 1024) {
  return new Promise((resolveBody) => {
    let over = false
    const chunks = []
    let bytes = 0
    req.on('data', (chunk) => {
      bytes += chunk.length
      if (bytes > limit) {
        over = true
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      if (over) return resolveBody(undefined)
      try {
        const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'))
        resolveBody(parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : undefined)
      } catch {
        resolveBody(undefined)
      }
    })
    req.on('error', () => resolveBody(undefined))
  })
}

/** `~` expands; only an absolute path is a folder a person chose. */
function expandFolder(value, home) {
  const raw = str(value)
  if (raw === '' || raw.length > 4096 || raw.includes('\0')) return null
  const expanded = raw === '~' ? home : raw.startsWith('~/') ? home + raw.slice(1) : raw
  const normal = resolve(expanded)
  return normal
}

/** Confirm a path is the folder or something inside it, as a location. */
function folderHolding(target, root) {
  const wanted = typeof target === 'string' ? target.trim() : ''
  if (wanted === '' || typeof root !== 'string' || root.trim() === '') return false
  const wantedResolved = resolve(wanted)
  const rootResolved = resolve(root)
  return wantedResolved === rootResolved || wantedResolved.startsWith(rootResolved + sep)
}

/** Probe and save, preserving decisions by look id. */
async function probeAndSave(own, root) {
  const result = await probe(root)
  const manifest = { schema: MANIFEST_SCHEMA, root, looks: result.looks }
  await writeManifest(own.root, manifest)

  const state = await readState(own.root)
  const next = { ...state, looks: { ...state.looks } }
  for (const look of result.looks) {
    const previous = state.looks[look.id] && typeof state.looks[look.id] === 'object' ? state.looks[look.id] : null
    const count = viewCountOf(look)
    const previousApprovals = previous && Array.isArray(previous.viewApprovals) ? previous.viewApprovals : null
    const previousFinals = previous && Array.isArray(previous.viewFinals) ? previous.viewFinals : null
    const oldApproved = previous !== null && previous.approved === true
    const generated = previous !== null && Array.isArray(previous.runs) && previous.runs.length > 0
    const approvals = Array.from({ length: count }, (_, index) => {
      const hasFinal = Boolean(look.views && look.views[index] && look.views[index].final)
      if (!hasFinal) return false
      if (previousApprovals) {
        const hadFinal = previousFinals ? previousFinals[index] === true : false
        // A final that appeared with no run record is a copied-in approved generation.
        if (!hadFinal && !generated) return true
        return previousApprovals[index] === true
      }
      // First probe over an older state: the look-level approval covered the views
      // that already had a final; a final with no approval and no run was copied in.
      if (oldApproved) return true
      return !generated
    })
    const approvedViews = approvals.filter(Boolean).length
    next.looks[look.id] = {
      ...(previous || {}),
      approved: approvedViews > 0,
      reviewed: previous ? previous.reviewed === true : false,
      runs: previous && Array.isArray(previous.runs) ? previous.runs : [],
      final: look.coverFinal || '',
      viewApprovals: approvals,
      viewFinals: (look.views || []).map((view) => Boolean(view.final)),
    }
  }
  await writeState(own.root, next)
  return { manifest, state: next, created: result.created }
}

/** The state the pane reads. */
async function publicState(own, folders, preview) {
  const rootInfo = await readRoot(own.root)
  const manifest = await readManifest(own.root)
  const state = await readState(own.root)
  const looks = manifest.looks.map((look) => {
    const saved = state.looks[look.id] && typeof state.looks[look.id] === 'object' ? state.looks[look.id] : {}
    const approvals = approvalsOf(state, look)
    const approvedViews = approvals.filter(Boolean).length
    const viewCount = approvals.length
    return {
      ...look,
      name: typeof saved.name === 'string' && saved.name.trim() !== '' ? saved.name : look.name,
      approved: approvedViews > 0,
      approvedViews,
      viewCount,
      viewApprovals: approvals,
      reviewed: saved.reviewed === true,
      runs: saved && Array.isArray(saved.runs) ? saved.runs : [],
      hasFinal: Boolean(look.coverFinal),
    }
  })
  return {
    schema: 'muen-styling-view/v1',
    root: rootInfo ? rootInfo.root : null,
    rootKind: own.kind,
    generatedAt: manifest.generatedAt,
    looks,
    counts: countsOf(looks, state),
    job: await readJob(own.root),
    canChoose: folders.canChoose === true,
    canPreview: canPreview(preview.platform),
  }
}

/** The VL view pass the plugin ships as a skill. */
const SKILL = {
  name: 'styling-look-views',
  description:
    'Pair a look\'s originals and finals by camera view, not file order. Triggers when styling look photos, ingesting finals, or a look\'s views look mismatched.',
  whenToUse:
    'Use when styling or pairing a look\'s photos, when finals arrive without view names, or when a look\'s views look mismatched — "the side shows the back".',
  file: fileURLToPath(new URL('../skills/styling-look-views/SKILL.md', import.meta.url)),
}

/** Register the skill with the harness, when the profile has a skills service. */
function mountSkill(ctx) {
  const skills = typeof ctx.get === 'function' ? ctx.get('skills') : undefined
  if (!skills || typeof skills.register !== 'function') return false
  let content
  try {
    content = readFileSync(SKILL.file, 'utf8')
  } catch (error) {
    if (ctx.logger && typeof ctx.logger.warn === 'function') {
      ctx.logger.warn('styling: the skill file could not be read at ' + SKILL.file + ': ' + String((error && error.message) || error))
    }
    return false
  }
  ctx.effect(
    () =>
      skills.register({
        name: SKILL.name,
        description: SKILL.description,
        whenToUse: SKILL.whenToUse,
        invocation: { modelInvocable: true, userInvocable: true },
        source: 'runtime',
        provider: 'muen',
        path: SKILL.file,
        resourceBase: { kind: 'directory', path: dirname(SKILL.file) },
        content,
      }),
    'styling: skill ' + SKILL.name,
  )
  return true
}

export function apply(ctx, config = {}) {
  const own = resolveDataRoot()
  const folders = config.folders && typeof config.folders === 'object' ? config.folders : nativeFolders
  const preview = config.preview && typeof config.preview === 'object' ? config.preview : { canPreview, previewFor, platform: process.platform }
  const home = config.home || process.env.HOME || '/'
  const viewOf = () => publicState(own, folders, preview)
  // The skill is optional: a profile without a skills service still gets the
  // routes and the probe. A failed skill mount must never take the plugin down.
  try {
    mountSkill(ctx)
  } catch (error) {
    if (ctx.logger && typeof ctx.logger.warn === 'function') {
      ctx.logger.warn('styling: the view skill did not mount: ' + String((error && error.message) || error))
    }
  }

  /** GET /state — the single load. */
  const stateRoute = async (req, res) => {
    if ((req.method || 'GET').toUpperCase() !== 'GET') {
      res.setHeader('Allow', 'GET')
      return send(res, 405, { error: 'method-not-allowed' })
    }
    send(res, 200, await viewOf())
  }

  /** POST /folder — choose, add, remove. */
  const folderRoute = async (req, res) => {
    if ((req.method || 'GET').toUpperCase() !== 'POST') {
      res.setHeader('Allow', 'POST')
      return send(res, 405, { error: 'method-not-allowed' })
    }
    const body = await readJsonBody(req)
    if (body === undefined) return send(res, 400, { error: 'bad-request', detail: 'a JSON body is required' })
    const action = str(body.action)

    if (action === 'remove') {
      await clearRoot(own.root)
      await writeManifest(own.root, { schema: MANIFEST_SCHEMA, root: null, looks: [] })
      return send(res, 200, await viewOf())
    }

    let target = null
    if (action === 'choose') {
      if (folders.canChoose !== true || typeof folders.choose !== 'function') {
        return send(res, 501, { error: 'unsupported', detail: 'this host has no folder dialog; type an absolute path instead' })
      }
      const current = await readRoot(own.root)
      const start = chooseStart([current ? current.root : '', home])
      let picked
      try {
        picked = await folders.choose(start)
      } catch (error) {
        return send(res, 500, { error: 'choose-failed', detail: String((error && error.message) || error) })
      }
      if (!picked || picked.cancelled === true) return send(res, 200, { ...(await viewOf()), cancelled: true })
      target = picked.path
    } else if (action === 'add') {
      target = expandFolder(body.path, home)
    } else if (action === 'reveal') {
      const current = await readRoot(own.root)
      if (!current) return send(res, 404, { error: 'no-folder', detail: 'no folder has been added' })
      if (typeof folders.reveal !== 'function') return send(res, 501, { error: 'unsupported', detail: 'this host cannot open a file browser' })
      try {
        await folders.reveal(current.root)
      } catch (error) {
        return send(res, 500, { error: 'reveal-failed', detail: String((error && error.message) || error) })
      }
      return send(res, 200, { ok: true, root: current.root })
    } else {
      return send(res, 400, { error: 'unknown-action', detail: '"' + action + '" is not a folder action' })
    }

    if (target === null) return send(res, 400, { error: 'bad-path', detail: 'an absolute folder path' })
    let info
    try {
      info = await stat(target)
    } catch {
      return send(res, 404, { error: 'missing-folder', detail: 'that folder is not there: ' + target })
    }
    if (!info.isDirectory()) return send(res, 400, { error: 'not-a-folder', detail: 'that path is not a folder: ' + target })

    await writeRoot(own.root, target)
    try {
      await probeAndSave(own, target)
    } catch (error) {
      return send(res, 500, { error: 'probe-failed', detail: String((error && error.message) || error) })
    }
    return send(res, 200, await viewOf())
  }

  /** POST /probe — re-read the folder. */
  const probeRoute = async (req, res) => {
    if ((req.method || 'GET').toUpperCase() !== 'POST') {
      res.setHeader('Allow', 'POST')
      return send(res, 405, { error: 'method-not-allowed' })
    }
    const current = await readRoot(own.root)
    if (!current) return send(res, 400, { error: 'no-folder', detail: 'add the folder with the look photographs first' })
    try {
      const result = await probeAndSave(own, current.root)
      send(res, 200, { ...(await viewOf()), created: result.created })
    } catch (error) {
      send(res, 500, { error: 'probe-failed', detail: String((error && error.message) || error) })
    }
  }

  /** POST /approve — one look's decision. */
  const approveRoute = async (req, res) => {
    if ((req.method || 'GET').toUpperCase() !== 'POST') {
      res.setHeader('Allow', 'POST')
      return send(res, 405, { error: 'method-not-allowed' })
    }
    const body = await readJsonBody(req)
    if (body === undefined) return send(res, 400, { error: 'bad-request' })
    const id = str(body.id)
    if (id === '') return send(res, 400, { error: 'missing-id' })
    const manifest = await readManifest(own.root)
    const look = manifest.looks.find((entry) => entry.id === id)
    if (!look) return send(res, 404, { error: 'not-found', detail: 'no look ' + id })
    const state = await readState(own.root)
    const previous = state.looks[id] && typeof state.looks[id] === 'object' ? state.looks[id] : {}
    const approvals = approvalsOf(state, look)
    const view = Number.isInteger(body.view) ? body.view : null
    if (view !== null) {
      if (view < 0 || view >= approvals.length) {
        return send(res, 400, { error: 'bad-view', detail: 'view must be 0..' + String(approvals.length - 1) })
      }
      approvals[view] = body.approved === true
    } else {
      // Backwards-compatible: no view means every view that has a final.
      for (let index = 0; index < approvals.length; index += 1) {
        if (look.views[index] && look.views[index].final) approvals[index] = body.approved === true
      }
    }
    const approvedViews = approvals.filter(Boolean).length
    state.looks[id] = {
      ...previous,
      approved: approvedViews > 0,
      reviewed: true,
      final: look.coverFinal || '',
      viewApprovals: approvals,
      viewFinals: (look.views || []).map((entry) => Boolean(entry.final)),
    }
    await writeState(own.root, state)
    send(res, 200, { ok: true, ...(await viewOf()) })
  }

  /** POST /name — a name a person (or the agent) gives a look. */
  const nameRoute = async (req, res) => {
    if ((req.method || 'GET').toUpperCase() !== 'POST') {
      res.setHeader('Allow', 'POST')
      return send(res, 405, { error: 'method-not-allowed' })
    }
    const body = await readJsonBody(req)
    if (body === undefined) return send(res, 400, { error: 'bad-request' })
    const id = str(body.id)
    const label = str(body.name).slice(0, 120)
    if (id === '') return send(res, 400, { error: 'missing-id' })
    const state = await readState(own.root)
    const previous = state.looks[id] && typeof state.looks[id] === 'object' ? state.looks[id] : {}
    state.looks[id] = { ...previous, name: label }
    await writeState(own.root, state)
    send(res, 200, { ok: true, ...(await viewOf()) })
  }

  /** Build the queue from the manifest and the decisions. */
  const queueOf = async () => {
    const manifest = await readManifest(own.root)
    const state = await readState(own.root)
    return manifest.looks.filter((look) => lookApproved(state, look) !== true)
  }

  /** POST /regenerate — queue the looks that are not approved. */
  const regenerateRoute = async (req, res) => {
    if ((req.method || 'GET').toUpperCase() !== 'POST') {
      res.setHeader('Allow', 'POST')
      return send(res, 405, { error: 'method-not-allowed' })
    }
    const body = await readJsonBody(req)
    if (body === undefined) return send(res, 400, { error: 'bad-request' })
    const includeApproved = body.includeApproved === true
    const wanted = Array.isArray(body.looks) ? body.looks.map((value) => str(value)).filter((value) => value !== '') : null
    const manifest = await readManifest(own.root)
    const state = await readState(own.root)
    const looks = manifest.looks.filter((look) => {
      // A call that names looks (the PDP's "re-generate this look") means those
      // looks, approved or not. Otherwise the switch decides.
      if (wanted !== null && wanted.length > 0) return wanted.includes(look.id)
      if (includeApproved) return true
      return lookApproved(state, look) !== true
    })
    const job = {
      schema: JOB_SCHEMA,
      status: looks.length === 0 ? 'empty' : 'queued',
      includeApproved,
      root: (await readRoot(own.root) || {}).root || null,
      looks: looks.map((look) => look.id),
      count: looks.length,
      createdAt: new Date().toISOString(),
      message:
        looks.length === 0
          ? 'nothing to queue: every look is approved'
          : 'queued ' + looks.length + ' look(s) · ask the agent to run the styling queue',
    }
    await writeJob(own.root, job)
    send(res, 200, job)
  }

  /** GET /job — the last queue. */
  const jobRoute = async (req, res) => {
    if ((req.method || 'GET').toUpperCase() !== 'GET') {
      res.setHeader('Allow', 'GET')
      return send(res, 405, { error: 'method-not-allowed' })
    }
    send(res, 200, (await readJob(own.root)) || { schema: JOB_SCHEMA, status: 'idle', looks: [], count: 0 })
  }

  /** GET /detail?id= — one look, whole. */
  const detailRoute = async (req, res) => {
    if ((req.method || 'GET').toUpperCase() !== 'GET') {
      res.setHeader('Allow', 'GET')
      return send(res, 405, { error: 'method-not-allowed' })
    }
    const url = new URL(req.url || '/', 'http://127.0.0.1')
    const id = str(url.searchParams.get('id'))
    if (id === '') return send(res, 400, { error: 'missing-id' })
    const manifest = await readManifest(own.root)
    const look = manifest.looks.find((entry) => entry.id === id)
    if (!look) return send(res, 404, { error: 'not-found', detail: 'no look ' + id })
    const state = await readState(own.root)
    const saved = state.looks[id] && typeof state.looks[id] === 'object' ? state.looks[id] : {}
    const approvals = approvalsOf(state, look)
    const approvedViews = approvals.filter(Boolean).length
    send(res, 200, {
      look: {
        ...look,
        name: saved.name || look.name,
        approved: approvedViews > 0,
        approvedViews,
        viewCount: approvals.length,
        viewApprovals: approvals,
        reviewed: saved.reviewed === true,
        runs: saved && Array.isArray(saved.runs) ? saved.runs : [],
        hasFinal: Boolean(look.coverFinal),
      },
    })
  }

  /** GET /image?path=&w= — one image, path-jailed to the added folder. */
  const imageRoute = async (req, res) => {
    if ((req.method || 'GET').toUpperCase() !== 'GET') {
      res.setHeader('Allow', 'GET')
      return send(res, 405, { error: 'method-not-allowed' })
    }
    const url = new URL(req.url || '/', 'http://127.0.0.1')
    const wanted = str(url.searchParams.get('path'))
    const width = str(url.searchParams.get('w'))
    const current = await readRoot(own.root)
    if (!current) return send(res, 404, { error: 'no-folder', detail: 'no folder has been added' })
    if (!folderHolding(wanted, current.root)) return send(res, 404, { error: 'not-in-folder', detail: 'that path is not inside the added folder' })
    let info
    try {
      info = await stat(wanted)
    } catch {
      return send(res, 404, { error: 'missing-file' })
    }
    if (!info.isFile()) return send(res, 404, { error: 'not-a-file' })
    const ext = extname(wanted).slice(1).toLowerCase()
    let serve = wanted
    let type = TYPE_BY_EXT[ext] || 'application/octet-stream'
    let previewed = false
    if (width !== '') {
      const made = await preview.previewFor({
        path: wanted,
        ext,
        width: Number(width),
        cacheDir: join(own.root, 'proxies'),
        platform: preview.platform,
        run: preview.run,
      })
      if (made && made.file) {
        serve = made.file
        type = 'image/jpeg'
        previewed = true
      } else if (made && made.error === 'bad-width') {
        return send(res, 400, { error: 'bad-width', detail: 'w is between 32 and 2048' })
      }
    }
    let bytes = info.size
    try {
      bytes = (await stat(serve)).size
    } catch {
      bytes = info.size
    }
    res.statusCode = 200
    res.setHeader('Content-Type', type)
    res.setHeader('Content-Length', bytes)
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('X-Styling-Preview', previewed ? '1' : '0')
    const stream = createReadStream(serve)
    stream.on('error', () => {
      try {
        res.destroy()
      } catch {
        // socket already gone
      }
    })
    stream.pipe(res)
  }

  const mount = (server) => {
    ctx.effect(() => server.register({ kind: 'exact', path: STATE_PATH, handler: stateRoute }), 'styling: state')
    ctx.effect(() => server.register({ kind: 'exact', path: FOLDER_PATH, handler: folderRoute }), 'styling: folder')
    ctx.effect(() => server.register({ kind: 'exact', path: PROBE_PATH, handler: probeRoute }), 'styling: probe')
    ctx.effect(() => server.register({ kind: 'exact', path: APPROVE_PATH, handler: approveRoute }), 'styling: approve')
    ctx.effect(() => server.register({ kind: 'exact', path: NAME_PATH, handler: nameRoute }), 'styling: name')
    ctx.effect(() => server.register({ kind: 'exact', path: REGENERATE_PATH, handler: regenerateRoute }), 'styling: regenerate')
    ctx.effect(() => server.register({ kind: 'exact', path: JOB_PATH, handler: jobRoute }), 'styling: job')
    ctx.effect(() => server.register({ kind: 'exact', path: DETAIL_PATH, handler: detailRoute }), 'styling: detail')
    ctx.effect(() => server.register({ kind: 'exact', path: IMAGE_PATH, handler: imageRoute }), 'styling: image')
  }

  const server = typeof ctx.get === 'function' ? ctx.get('webServer') : undefined
  if (server !== undefined && server !== null) {
    mount(server)
  } else if (typeof ctx.inject === 'function') {
    ctx.inject(['webServer'], () => mount(ctx.get('webServer')))
  }

  /**
   * The agent's half of the probe. The pane can add a folder and the host probes it
   * automatically; this tool is how the agent re-probes, names looks, and queues the
   * unapproved set in a conversation.
   */
  const tools = typeof ctx.get === 'function' ? ctx.get('tools') : undefined
  if (tools && typeof tools.register === 'function') {
    ctx.effect(
      () =>
        tools.register({
          name: 'styling_probe',
          description:
            'Probe a folder of look photographs into one folder per look: `look NNN-originals` and `look NNN-final`. Flat images are grouped in batches of 4 and hard-linked into the look folders; existing look folders are paired. Saves the manifest and returns the looks. Writes no generated image and spends no coin.',
          parameters: {
            type: 'object',
            properties: {
              root: { type: 'string', description: 'Absolute path to the folder. Omit to re-probe the folder already added.' },
            },
            required: [],
          },
          output: {
            schema: { type: 'object' },
            render: (_args, value) =>
              value && value.ok
                ? text('[styling] ' + value.counts.total + ' looks · ' + value.counts.withFinal + ' with a final · ' + value.counts.toStyle + ' to style')
                : text('[styling] ' + String((value && (value.detail || value.error)) || 'failed')),
          },
          async execute(args) {
            const input = args && typeof args.root === 'string' ? expandFolder(args.root, home) : null
            const current = await readRoot(own.root)
            const root = input || (current ? current.root : null)
            if (!root) return { ok: false, error: 'no-folder', detail: 'give the absolute path to the folder with the look photographs' }
            try {
              const info = await stat(root)
              if (!info.isDirectory()) return { ok: false, error: 'not-a-folder', detail: root + ' is not a folder' }
            } catch {
              return { ok: false, error: 'missing-folder', detail: root + ' is not there' }
            }
            await writeRoot(own.root, root)
            const result = await probeAndSave(own, root)
            const view = await viewOf()
            return {
              ok: true,
              root,
              created: result.created,
              counts: view.counts,
              looks: view.looks.map((look) => ({
                id: look.id,
                name: look.name,
                originals: look.originals.length,
                finals: look.finals.length,
                coverOriginal: look.coverOriginal,
                coverFinal: look.coverFinal,
                approved: look.approved,
                approvedViews: look.approvedViews,
                viewCount: look.viewCount,
              })),
            }
          },
        }),
        'styling: tool probe',
      )

    ctx.effect(
      () =>
        tools.register({
          name: 'styling_queue',
          description:
            'Read the looks that the PLP would send to styling: every look with no approved view, unless includeApproved is true. Writes the queue file and returns it. Spends no coin.',
          parameters: {
            type: 'object',
            properties: {
              includeApproved: { type: 'boolean', description: 'Include looks already marked approved.' },
            },
            required: [],
          },
          output: {
            schema: { type: 'object' },
            render: (_args, value) =>
              value && value.ok
                ? text('[styling] queued ' + value.count + ' look(s)' + (value.count ? ': ' + value.looks.join(', ') : ''))
                : text('[styling] ' + String((value && (value.detail || value.error)) || 'failed')),
          },
          async execute(args) {
            const includeApproved = Boolean(args && args.includeApproved)
            const manifest = await readManifest(own.root)
            const state = await readState(own.root)
            const looks = manifest.looks.filter((look) => {
              if (includeApproved) return true
              return lookApproved(state, look) !== true
            })
            const job = {
              schema: JOB_SCHEMA,
              status: looks.length === 0 ? 'empty' : 'queued',
              includeApproved,
              root: (await readRoot(own.root) || {}).root || null,
              looks: looks.map((look) => look.id),
              count: looks.length,
              createdAt: new Date().toISOString(),
              message: looks.length === 0 ? 'every look is approved' : 'ask the agent to run the styling queue',
            }
            await writeJob(own.root, job)
            return { ok: true, ...job }
          },
        }),
        'styling: tool queue',
      )

    ctx.effect(
      () =>
        tools.register({
          name: 'styling_approve',
          description: 'Approve or un-approve ONE view of a look (or every view that has a final when no view is given). Approval is per view; a look is approved while at least one of its views is approved.',
          parameters: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'Look id, e.g. look-001.' },
              view: { type: 'integer', description: 'Zero-based view index, e.g. 0 for the first view. Omit to set every view that has a final.' },
              approved: { type: 'boolean', description: 'true to approve, false to send that view back to review.' },
            },
            required: ['id'],
          },
          output: {
            schema: { type: 'object' },
            render: (_args, value) =>
              text(
                value && value.ok
                  ? '[styling] ' + value.id + ' · ' + (value.view === null ? 'all views' : 'view ' + (Number(value.view) + 1)) + ' · ' + (value.approved ? 'approved' : 'to review')
                  : '[styling] failed',
              ),
          },
          async execute(args) {
            const id = str(args && args.id)
            if (id === '') return { ok: false, error: 'missing-id' }
            const manifest = await readManifest(own.root)
            const look = manifest.looks.find((entry) => entry.id === id)
            if (!look) return { ok: false, error: 'not-found', detail: 'no look ' + id }
            const state = await readState(own.root)
            const previous = state.looks[id] && typeof state.looks[id] === 'object' ? state.looks[id] : {}
            const approvals = approvalsOf(state, look)
            const view = Number.isInteger(args && args.view) ? args.view : null
            if (view !== null) {
              if (view < 0 || view >= approvals.length) return { ok: false, error: 'bad-view' }
              approvals[view] = args.approved === true
            } else {
              for (let index = 0; index < approvals.length; index += 1) {
                if (look.views[index] && look.views[index].final) approvals[index] = args.approved === true
              }
            }
            state.looks[id] = {
              ...previous,
              approved: approvals.some(Boolean),
              reviewed: true,
              viewApprovals: approvals,
              viewFinals: (look.views || []).map((entry) => Boolean(entry.final)),
            }
            await writeState(own.root, state)
            return { ok: true, id, view, approved: args.approved === true, approvedViews: approvals.filter(Boolean).length }
          },
        }),
        'styling: tool approve',
      )

    ctx.effect(
      () =>
        tools.register({
          name: 'styling_name',
          description: 'Give one look its real name (for example "patchwork beadwork") after reading its cover. The PLP and PDP show it.',
          parameters: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'Look id, e.g. look-001.' },
              name: { type: 'string', description: 'The name to show.' },
            },
            required: ['id', 'name'],
          },
          output: {
            schema: { type: 'object' },
            render: (_args, value) => text(value && value.ok ? '[styling] ' + value.id + ' → ' + value.name : '[styling] failed'),
          },
          async execute(args) {
            const id = str(args && args.id)
            const label = str(args && args.name).slice(0, 120)
            if (id === '' || label === '') return { ok: false, error: 'missing-args' }
            const state = await readState(own.root)
            const previous = state.looks[id] && typeof state.looks[id] === 'object' ? state.looks[id] : {}
            state.looks[id] = { ...previous, name: label }
            await writeState(own.root, state)
            return { ok: true, id, name: label }
          },
        }),
        'styling: tool name',
      )
  }
}
