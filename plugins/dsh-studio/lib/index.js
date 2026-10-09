// @muen/dsh-studio — host half.
//
// One prefix route, `/plugins/studio`, registered WITHOUT a trailing slash (the
// 2026-09-23 Generate lesson: a prefix with a trailing slash silently 404s
// everything below it). The router answers the project/session CRUD the pane
// needs and nothing else — every later slice (seals, prompt desk, runs, EDL)
// grows this surface, not a second one.
//
// The store is injected through `apply(ctx, config)` so no verify run touches a
// real profile: config.dataRoot pins the store the way Generate pins its
// adapters directory.
import { createStore, resolveRoot, STAGES, emptyStages, emptyShot, SESSION_SCHEMA, validateSession } from './studio-store.js'
import { complete } from './llm.js'
import { emptyBible, editParagraph, approve as approveBible, revise as reviseBible, verifyPrompt } from './bibles.js'
import { editParagraph as editRecordParagraph, approve as approveRecord, revise as reviseRecord } from './records.js'
import { parseShotDrafts, premiseFromBrief, gridTotal } from './script.js'
import { assemble, verifyAssembled } from './seals.js'
import { emptyEdl, addClip, moveClip, setTrim, splitClip, removeClip, buildFromSelects } from './edl.js'
import { detectFfmpeg, resolveTake, ffmpegArgs, runExport } from './export.js'
import { createLibrary } from './library.js'
import { createSync, githubTarget } from './sync.js'
import { sheetValues } from './sheet.js'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

export const PREFIX = '/plugins/studio'

const MAX_BODY_BYTES = 1024 * 1024 // session documents are text; 1 MB is a runaway, not a session
const MAX_PHOTO_BYTES = 30 * 1024 * 1024 // RunningHub's own upload ceiling

function json(res, code, body) {
  res.statusCode = code
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(JSON.stringify(body))
}

function readJsonBody(req) {
  return new Promise((resolve) => {
    let size = 0
    const chunks = []
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        resolve(undefined)
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      if (chunks.length === 0) return resolve({})
      try {
        const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'))
        resolve(parsed && typeof parsed === 'object' ? parsed : undefined)
      } catch {
        resolve(undefined)
      }
    })
    req.on('error', () => resolve(undefined))
  })
}

/**
 * The request body as bytes, bounded. Resolves undefined past the limit — the
 * photo uploader's reader, not the JSON one (Generate's own convention: an
 * image is megabytes of binary and is not base64'd through a JSON field).
 */
function readRawBody(req, maxBytes) {
  return new Promise((resolve) => {
    let size = 0
    let over = false
    const chunks = []
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > maxBytes) {
        over = true
        resolve(undefined)
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      if (over) return
      resolve(Buffer.concat(chunks))
    })
    req.on('error', () => resolve(undefined))
  })
}

/**
 * The route handler. Pure request→response so the suites can call it with fake
 * requests; `apply` is the only part that knows the harness exists.
 */
export function createHandler(store, ctx, root = { root: store.root }, config = {}) {
  return async function handle(req, res) {
    const url = new URL(req.url, 'http://localhost')
    const pathname = url.pathname
    const method = (req.method || 'GET').toUpperCase()
    if (!pathname.startsWith(PREFIX + '/') && pathname !== PREFIX) return false

    const rest = pathname.slice(PREFIX.length).replace(/^\/+/, '').split('/')
    // /projects | /projects/<pid> | /projects/<pid>/sequences | /projects/<pid>/sequences/<sid>
    // /llm — the BYOK chat seam (M2)
    try {
      // One chat completion through the harness's BYOK seam (M2). Role system
      // prompts arrive from the client already composed — this route is the
      // transport, not the prompt author.
      if (rest[0] === 'llm') {
        if (method !== 'POST') return json(res, 405, { error: 'method' }), true
        const body = await readJsonBody(req)
        if (!body) return json(res, 400, { error: 'bad-json' }), true
        const answer = await complete(ctx, {
          system: body.system,
          user: body.user,
          model: body.model,
          maxTokens: typeof body.maxTokens === 'number' && body.maxTokens > 0 ? Math.min(body.maxTokens, 8192) : 1024,
        })
        return json(res, answer.ok ? 200 : answer.code, answer), true
      }

      // The recipe library (M10): browse, star, recall. Local-first beside the
      // studio root; M11 syncs the same file to the person's own GitHub.
      // Sync (M11): manual push/pull of the library file to the person's own
      // GitHub behind the sync-target seam. Unconfigured is an honest 501 —
      // the local file is the source of truth and sync is optional.
      if (rest[0] === 'sync') {
        const libraryRoot = config.libraryRoot || path.join(store.root, '..', 'library')
        const sync = createSync({
          file: path.join(libraryRoot, 'library.json'),
          target:
            config.sync && config.sync.repo && config.sync.token
              ? githubTarget({ ...config.sync, fetchImpl: config.fetchImpl })
              : null,
        })
        if (rest[1] === 'status' && method === 'GET') {
          return json(res, 200, { ok: true, configured: sync.configured, target: sync.name }), true
        }
        if (rest[1] === 'push' && method === 'POST') {
          const answer = await sync.push()
          return json(res, answer.ok ? 200 : answer.code, answer), true
        }
        if (rest[1] === 'pull' && method === 'POST') {
          const answer = await sync.pull()
          return json(res, answer.ok ? 200 : answer.code, answer), true
        }
        return json(res, 404, { error: 'no-route' }), true
      }

      if (rest[0] === 'library') {
        const library = createLibrary(config.libraryRoot || path.join(store.root, '..', 'library'))
        const id = rest[1]
        const action = rest[2]
        if (!id) {
          if (method === 'GET') {
            const query = url.searchParams
            const answer = await library.list({
              kind: query.get('kind') || undefined,
              minRating: query.get('min') !== null ? Number(query.get('min')) : undefined,
              tag: query.get('tag') || undefined,
            })
            return json(res, 200, answer), true
          }
          if (method === 'POST') {
            const body = await readJsonBody(req)
            if (!body) return json(res, 400, { error: 'bad-json' }), true
            const answer = await library.upsert(body)
            return json(res, answer.ok ? 200 : answer.code, answer), true
          }
          return json(res, 405, { error: 'method' }), true
        }
        if (action === 'rate' && method === 'POST') {
          const body = await readJsonBody(req)
          if (!body) return json(res, 400, { error: 'bad-json' }), true
          const answer = await library.rate(id, body.rating)
          return json(res, answer.ok ? 200 : answer.code, answer), true
        }
        if (!action && method === 'GET') {
          const answer = await library.get(id)
          return json(res, answer.ok ? 200 : answer.code, answer), true
        }
        return json(res, 404, { error: 'no-route' }), true
      }

      if (rest[0] !== 'projects') {
        json(res, 404, { error: 'no-route' })
        return true
      }
      const [, pid, what, sid] = rest

      if (!pid) {
        if (method === 'GET') return json(res, 200, await store.listProjects()), true
        if (method === 'POST') {
          const body = await readJsonBody(req)
          if (!body) return json(res, 400, { error: 'bad-json' }), true
          const answer = await store.createProject({ id: body.id, name: body.name })
          return json(res, answer.ok ? 200 : answer.code, answer), true
        }
        return json(res, 405, { error: 'method' }), true
      }

      if (!what) {
        if (method === 'GET') return json(res, 200, await store.readProject(pid)), true
        return json(res, 405, { error: 'method' }), true
      }

      if (what === 'sequences') {
        if (!sid) {
          if (method === 'GET') return json(res, 200, await store.listSequences(pid)), true
          if (method === 'POST') {
            const body = await readJsonBody(req)
            if (!body) return json(res, 400, { error: 'bad-json' }), true
            const answer = await store.createSequence(pid, { id: body.id, name: body.name })
            return json(res, answer.ok ? 200 : answer.code, answer), true
          }
          return json(res, 405, { error: 'method' }), true
        }
        // Script (M5): LLM write and brief import parse into shot drafts. The
        // pane merges them into the session it PUTs — the single write path —
        // and the gate is the human reading the list. Assets, when named, ride
        // as context so beats cite what is approved.
        if (sid && rest[4] === 'script') {
          const sub = rest[5]
          if (method !== 'POST') return json(res, 405, { error: 'method' }), true
          const body = await readJsonBody(req)
          if (!body) return json(res, 400, { error: 'bad-json' }), true
          let premise = ''
          if (sub === 'draft') premise = String(body.premise || '')
          else if (sub === 'brief') premise = premiseFromBrief(body.brief)
          else return json(res, 404, { error: 'no-route' }), true
          if (premise.trim() === '') return json(res, 400, { error: 'no-premise' }), true
          const rolePath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'roles', 'script.md')
          let system = ''
          try {
            system = await readFile(rolePath, 'utf8')
          } catch {
            return json(res, 500, { error: 'role-missing' }), true
          }
          const assets = Array.isArray(body.assets) ? body.assets : []
          const user = (assets.length ? 'Approved assets: ' + assets.join(', ') + '.\n\n' : '') + premise
          const answer = await complete(ctx, { system, user, maxTokens: 1600 })
          if (!answer.ok) return json(res, answer.code, answer), true
          const parsed = parseShotDrafts(answer.text)
          if (!parsed.ok) return json(res, 422, parsed), true
          return json(res, 200, { ok: true, shots: parsed.shots, grid: gridTotal(parsed.shots.map((shot) => shot.duration_s)) }), true
        }

        // Shoot (M6): prompt compose and preflight. Composition is mechanical —
        // sealed core + sealed look inserted VERBATIM, the Prompt-desk role
        // writes only the scene layer — and preflight hash-checks the seams
        // before anything can spend.
        if (sid && rest[4] === 'shots' && rest[5]) {
          const action = rest[6]
          if (method !== 'POST') return json(res, 405, { error: 'method' }), true
          const body = await readJsonBody(req)
          if (!body) return json(res, 400, { error: 'bad-json' }), true

          const character = await store.readCharacter(pid, String(body.character || ''))
          const lookId = body.look ? await store.readRecord(pid, 'outfit', String(body.look)) : { ok: true, record: null }
          const sceneId = body.scene ? await store.readRecord(pid, 'scene', String(body.scene)) : { ok: true, record: null }

          if (action === 'preflight') {
            const drift = []
            if (character.ok && character.bible.core) drift.push(...verifyAssembled(String(body.prompt || ''), character.bible.core).drift)
            if (lookId.ok && lookId.record && lookId.record.look) drift.push(...verifyAssembled(String(body.prompt || ''), lookId.record.look).drift)
            return json(res, 200, { ok: drift.length === 0, drift }), true
          }

          if (action !== 'prompt') return json(res, 404, { error: 'no-route' }), true
          if (!character.ok || !character.bible.core) return json(res, 409, { error: 'character needs an approved core' }), true
          if (!lookId.ok) return json(res, 404, { error: 'no look' }), true
          if (lookId.record && !lookId.record.gate) return json(res, 409, { error: 'look needs approval' }), true

          const rolePath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'roles', 'prompt-desk.md')
          let system = ''
          try {
            system = await readFile(rolePath, 'utf8')
          } catch {
            return json(res, 500, { error: 'role-missing' }), true
          }
          const sceneNote = sceneId.ok && sceneId.record ? 'Scene: ' + (sceneId.record.paragraphs.environment || sceneId.record.name) : ''
          const user = [
            'Beat: ' + String(body.beat || ''),
            'Camera: ' + String(body.camera || ''),
            'Assets: ' + [character.bible.name, lookId.record && lookId.record.name, sceneId.record && sceneId.record.name].filter(Boolean).join(', '),
            sceneNote,
          ].filter(Boolean).join('\n')
          const answer = await complete(ctx, { system, user, maxTokens: 900 })
          if (!answer.ok) return json(res, answer.code, answer), true
          const scene = {}
          const parts = answer.text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
          ;['pose', 'environment', 'photography'].forEach((slot, i) => {
            scene[slot] = parts[i] || ''
          })
          const prompt = assemble({ core: character.bible.core, look: lookId.record && lookId.record.look, scene })
          // Self-check: the host assembled it, so this must pass — and if a
          // future edit path ever breaks that, the check is already here.
          const verified = verifyAssembled(prompt, character.bible.core, lookId.record && lookId.record.look)
          return json(res, 200, { ok: true, prompt, scene, drift: verified.drift }), true
        }

        // The EDL ops (M7): one implementation, host-side. The pane sends an op,
        // the host applies it through lib/edl.js, persists, and answers the new
        // document — the view keeps its undo stack of documents and PUTs one
        // back to undo. No op logic lives in the client.
        if (sid && rest[4] === 'edl' && rest[5] === 'op' && method === 'POST') {
          const body = await readJsonBody(req)
          if (!body) return json(res, 400, { error: 'bad-json' }), true
          const current = await store.readEdl(pid, sid)
          const edl = current.ok ? current.edl : emptyEdl()
          let next = edl
          if (body.op === 'add') next = addClip(edl, body)
          else if (body.op === 'move') next = moveClip(edl, body.id, body.to)
          else if (body.op === 'trim') next = setTrim(edl, body.id, body.in_f, body.out_f)
          else if (body.op === 'split') next = splitClip(edl, body.id, body.at)
          else if (body.op === 'delete') next = removeClip(edl, body.id)
          else return json(res, 400, { error: 'bad-op' }), true
          const saved = await store.writeEdl(pid, sid, next)
          return json(res, saved.ok ? 200 : saved.code, saved), true
        }

        // The first cut: every shot's select, in shot order, whole takes.
        if (sid && rest[4] === 'edl' && rest[5] === 'build' && method === 'POST') {
          const session = await store.readSession(pid, sid)
          if (!session.ok) return json(res, session.code, session), true
          const next = buildFromSelects(session.session.shots)
          const saved = await store.writeEdl(pid, sid, next)
          return json(res, saved.ok ? 200 : saved.code, saved), true
        }

        // Export (M8): status says whether MP4 is possible; the manifest always
        // exports. Takes resolve to Generate's saved bytes through its run
        // records — bytes stay Generate's, the export points at them.
        if (sid && rest[4] === 'export' && rest[5]) {
          const what = rest[5]
          const generateRoot = path.join(store.root, '..', 'generate')
          const outDir = path.join(store.root, 'projects', pid, 'exports', sid + '-' + new Date().toISOString().slice(0, 10))

          if (what === 'status' && method === 'GET') {
            const detected = await detectFfmpeg(config.ffmpegRun)
            return json(res, 200, { ok: true, ffmpeg: detected, exportDir: outDir }), true
          }

          const edlAnswer = await store.readEdl(pid, sid)
          if (!edlAnswer.ok) return json(res, edlAnswer.code, edlAnswer), true
          const resolved = []
          for (const clip of edlAnswer.edl.clips) {
            const answer = await resolveTake(clip.take, generateRoot)
            resolved.push({ clip, ...(answer.ok ? { file: answer.file } : { error: answer.error }) })
          }

          if (what === 'edl' && method === 'POST') {
            await mkdir(outDir, { recursive: true })
            const manifestPath = path.join(outDir, 'timeline.json')
            await writeFile(manifestPath, JSON.stringify({
              schema: 1,
              fps: edlAnswer.edl.fps,
              created: new Date().toISOString(),
              clips: resolved.map((entry) => ({
                id: entry.clip.id,
                label: entry.clip.label,
                in_f: entry.clip.in_f,
                out_f: entry.clip.out_f,
                take: entry.clip.take,
                file: entry.file || null,
                error: entry.error || null,
              })),
            }, null, 2) + '\n')
            return json(res, 200, { ok: true, manifest: manifestPath, exportDir: outDir }), true
          }

          if (what === 'mp4' && method === 'POST') {
            const detected = await detectFfmpeg(config.ffmpegRun)
            if (!detected.ok) return json(res, 501, { ok: false, error: 'ffmpeg not found' }), true
            const missing = resolved.filter((entry) => entry.error)
            if (missing.length) return json(res, 409, { ok: false, error: 'takes unresolved: ' + missing.map((m) => m.clip.id).join(', ') }), true
            if (resolved.length === 0) return json(res, 400, { ok: false, error: 'timeline is empty' }), true
            await mkdir(outDir, { recursive: true })
            const output = path.join(outDir, 'cut.mp4')
            const clips = resolved.map((entry) => ({ ...entry.clip, file: entry.file }))
            const result = await runExport(clips, output, { fps: edlAnswer.edl.fps, run: config.ffmpegRun })
            return json(res, result.ok ? 200 : 500, result), true
          }

          return json(res, 405, { error: 'method' }), true
        }

        // The EDL (M7): the timeline document, read and written whole.
        if (sid && rest[4] === 'edl') {
          if (method === 'GET') {
            const answer = await store.readEdl(pid, sid)
            return json(res, answer.ok ? 200 : answer.code, answer), true
          }
          if (method === 'PUT') {
            const body = await readJsonBody(req)
            if (!body) return json(res, 400, { error: 'bad-json' }), true
            const answer = await store.writeEdl(pid, sid, body)
            return json(res, answer.ok ? 200 : answer.code, answer), true
          }
          return json(res, 405, { error: 'method' }), true
        }

        if (method === 'GET') return json(res, 200, await store.readSession(pid, sid)), true
        if (method === 'PUT') {
          const body = await readJsonBody(req)
          if (!body) return json(res, 400, { error: 'bad-json' }), true
          const answer = await store.writeSession(pid, sid, body)
          return json(res, answer.ok ? 200 : answer.code, answer), true
        }
        return json(res, 405, { error: 'method' }), true
      }

      // Character bibles (M3): the Character stage's data. /characters drafts
      // through the Casting role, /characters/<cid>[/edit|/approve|/revise]
      // applies the bibles.js rules, which are where the seal lives.
      if (what === 'characters') {
        if (!sid) {
          if (method === 'GET') return json(res, 200, await store.listCharacters(pid)), true
          if (method === 'POST') {
            const body = await readJsonBody(req)
            if (!body) return json(res, 400, { error: 'bad-json' }), true
            const answer = await store.createCharacter(pid, { id: body.id, name: body.name })
            return json(res, answer.ok ? 200 : answer.code, answer), true
          }
          return json(res, 405, { error: 'method' }), true
        }
        // sid is the character id here; a fifth segment is the action.
        const action = rest[4]
        const current = await store.readCharacter(pid, sid)
        if (!current.ok) return json(res, current.code, current), true
        const bible = current.bible

        if (!action) {
          if (method === 'GET') return json(res, 200, current), true
          return json(res, 405, { error: 'method' }), true
        }

        if (action === 'draft' && method === 'POST') {
          // The Casting role through the BYOK seam. Profile override wins over
          // the shipped role file (design doc §3: roles live in lib/roles with
          // <profile>/studio/roles overrides).
          const body = await readJsonBody(req)
          if (!body) return json(res, 400, { error: 'bad-json' }), true
          const rolePath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'roles', 'casting.md')
          let system = ''
          try {
            system = await readFile(rolePath, 'utf8')
          } catch {
            return json(res, 500, { error: 'role-missing' }), true
          }
          const answer = await complete(ctx, {
            system,
            user: String(body.description || ''),
            maxTokens: 1200,
          })
          if (!answer.ok) return json(res, answer.code, answer), true
          // The role writes eight paragraphs in fixed order; the seam answers
          // text, so the split here is positional — empty paragraphs stay empty
          // rather than being invented.
          const parts = answer.text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
          const paragraphs = {}
          const slots = ['overview', 'identity', 'makeup', 'hair', 'outfit', 'pose', 'environment', 'photography']
          slots.forEach((slot, i) => {
            paragraphs[slot] = parts[i] || ''
          })
          const saved = await store.writeCharacter(pid, sid, { ...bible, paragraphs })
          return json(res, saved.ok ? 200 : saved.code, saved), true
        }

        if (action === 'edit' && method === 'POST') {
          const body = await readJsonBody(req)
          if (!body) return json(res, 400, { error: 'bad-json' }), true
          const answer = editParagraph(bible, body.slot, body.text)
          if (!answer.ok) return json(res, answer.code, answer), true
          const saved = await store.writeCharacter(pid, sid, answer.bible)
          return json(res, saved.ok ? 200 : saved.code, saved), true
        }

        if (action === 'approve' && method === 'POST') {
          const answer = approveBible(bible)
          if (!answer.ok) return json(res, answer.code, answer), true
          const saved = await store.writeCharacter(pid, sid, answer.bible)
          return json(res, saved.ok ? 200 : saved.code, saved), true
        }

        if (action === 'revise' && method === 'POST') {
          const answer = reviseBible(bible)
          const saved = await store.writeCharacter(pid, sid, answer.bible)
          return json(res, saved.ok ? 200 : saved.code, saved), true
        }

        if (action === 'sheet' && method === 'GET') {
          // The composed Krea 2 sheet payload. The pane posts `values` to
          // Generate's own run route — this plugin composes, Generate runs.
          return json(res, 200, sheetValues(bible)), true
        }

        if (action === 'photo' && method === 'POST') {
          // Raw bytes as the body (Generate's asset-route convention).
          const bytes = await readRawBody(req, MAX_PHOTO_BYTES)
          if (!bytes || bytes.length === 0) return json(res, 400, { error: 'no-bytes' }), true
          const dir = path.join(root.root, 'projects', pid, 'assets', 'characters', sid, 'photos')
          await mkdir(dir, { recursive: true })
          const file = path.join(dir, Date.now().toString(36) + '.img')
          await writeFile(file, bytes)
          return json(res, 200, { ok: true, photo: file, bytes: bytes.length }), true
        }

        return json(res, 404, { error: 'no-route' }), true
      }

      // Outfit and scene records (M4): the same loop as characters, generic
      // over kind. Outfits seal their look paragraphs at approve; scenes gate
      // only (the scene layer is LLM territory per shot).
      if (what === 'outfits' || what === 'scenes') {
        const kind = what === 'outfits' ? 'outfit' : 'scene'
        if (!sid) {
          if (method === 'GET') return json(res, 200, await store.listRecords(pid, kind)), true
          if (method === 'POST') {
            const body = await readJsonBody(req)
            if (!body) return json(res, 400, { error: 'bad-json' }), true
            const answer = await store.createRecord(pid, kind, { id: body.id, name: body.name, character: body.character })
            return json(res, answer.ok ? 200 : answer.code, answer), true
          }
          return json(res, 405, { error: 'method' }), true
        }
        const action = rest[4]
        const current = await store.readRecord(pid, kind, sid)
        if (!current.ok) return json(res, current.code, current), true
        const record = current.record

        if (!action) {
          if (method === 'GET') return json(res, 200, current), true
          return json(res, 405, { error: 'method' }), true
        }

        if (action === 'edit' && method === 'POST') {
          const body = await readJsonBody(req)
          if (!body) return json(res, 400, { error: 'bad-json' }), true
          const answer = editRecordParagraph(record, body.slot, body.text)
          if (!answer.ok) return json(res, answer.code, answer), true
          const saved = await store.writeRecord(pid, kind, sid, answer.record)
          return json(res, saved.ok ? 200 : saved.code, saved), true
        }

        if (action === 'approve' && method === 'POST') {
          const answer = approveRecord(record)
          if (!answer.ok) return json(res, answer.code, answer), true
          const saved = await store.writeRecord(pid, kind, sid, answer.record)
          return json(res, saved.ok ? 200 : saved.code, saved), true
        }

        if (action === 'revise' && method === 'POST') {
          const answer = reviseRecord(record)
          const saved = await store.writeRecord(pid, kind, sid, answer.record)
          return json(res, saved.ok ? 200 : saved.code, saved), true
        }

        return json(res, 404, { error: 'no-route' }), true
      }

      json(res, 404, { error: 'no-route' })
      return true
    } catch (error) {
      json(res, 500, { error: String((error && error.message) || error) })
      return true
    }
  }
}

export function apply(ctx, config = {}) {
  const root = resolveRoot({ config })
  const store = createStore(root.root)
  const handle = createHandler(store, ctx, { root: store.root }, config)

  const server = typeof ctx.get === 'function' ? ctx.get('webServer') : undefined
  if (!server || typeof server.register !== 'function') {
    // A profile with no web server keeps its host half loaded and its pane
    // honest: the client reports "no host" instead of throwing at mount.
    if (ctx.logger && typeof ctx.logger.warn === 'function') {
      ctx.logger.warn('studio: no webServer in ctx; routes not registered')
    }
    return { store, root }
  }

  ctx.effect(
    () => server.register({ kind: 'prefix', path: PREFIX, handler: handle }),
    'studio: routes',
  )
  return { store, root }
}

export { createStore, resolveRoot, STAGES, emptyStages, emptyShot, SESSION_SCHEMA, validateSession }
