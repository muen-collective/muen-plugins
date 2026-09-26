/**
 * @muen/dsh-generate — host half (Epic 61, S1 + S2 + S3 + the provider registry).
 *
 * WHAT THIS IS: the keys and the install. The browser never holds a provider's key,
 * so every conversation with a provider happens here, in the host process, behind two
 * rules the epic's safety section makes imperative (§12):
 *
 *   2. The browser never sees the key. No key in page state, no key in
 *      `localStorage`, no key echoed by a route response.
 *   3. One user's key, one user's account. Nothing here reads an ambient Muen
 *      key; the reference below is the *user's* own name for their own key, and
 *      the status route reports where the value came from so the surface can say
 *      so out loud.
 *
 * ROUTES — the provider registry, one prefix, all under the plugin's own namespace
 * (S2's single wallet route became the per-provider key route when the plugin turned
 * provider-neutral):
 *
 *   GET    /plugins/generate/providers                → every provider: its key state,
 *                                                       its installed workflows, and
 *                                                       whether the panel draws it
 *   GET    /plugins/generate/providers/<id>/key       → that provider's key state
 *   POST   /plugins/generate/providers/<id>/key       → { key } — check, then store
 *   DELETE /plugins/generate/providers/<id>/key       → unlink
 *   GET    /plugins/generate/providers/<id>/workflows → what it has installed
 *   GET    /plugins/generate/providers/<id>/workflow?name=  → one workflow, whole
 *   GET    /plugins/generate/providers/<id>/hidden    → whether the panel draws it
 *   POST   /plugins/generate/providers/<id>/hidden    → { hidden } — the settings toggle
 *
 * FOUR PROVIDERS (providers.js), in the order every surface shows them: RunningHub,
 * Krea, Comfy Cloud, Magnific. Every route is provider-addressed, so a fifth provider
 * is one object in that file.
 *
 * S3 ADDS THE INSTALL, and it is two tools and two skills, not a route:
 *
 *   rh_workflow_graph       reads an app's exposed doors from RunningHub
 *   rh_adapter_validate     checks a written adapter against the live app
 *   add-rh-workflow         the skill that names the doors and confirms before
 *                           anything is written
 *   design-generate-screen  the skill that decides what the surface shows once
 *                           an adapter exists: which doors stand on the main
 *                           screen, what they are called, what the button says
 *
 * The install flow is the pane's, with no model at all (§2b, D15): the API already
 * answers with types, options, bounds, defaults and tooltips, the glossary covers
 * the label, and the agent is the polish path rather than a dependency. So the
 * tools here are read-only and the plugin writes no adapter file: the agent writes
 * it with its own file tools, which is why "nothing is written before the user
 * confirms" is structural rather than a promise.
 *
 * WHERE THE KEY LIVES (epic 61 D1): the `credentials` seam, as a
 * `CredentialRef` — the half of that service that answers "what is behind this
 * environment-variable name". Naming RunningHub's `RH_API_KEY` is what makes the
 * founder's existing env file a fallback rather than a second place to paste the key:
 * the service layers the process environment, its own writable store, and `.env`
 * files, and `set` refuses while a read-only source shadows the reference. So a
 * change that cannot take effect fails loudly instead of appearing to work while
 * the old value keeps resolving.
 *
 * THE KEY IS VALIDATED BY ONE CHEAP READ (epic 61 §9). A wrong key fails at the
 * moment it is entered, at the field, instead of three screens later inside a paid
 * run. That read is also the gate on the write: the key reaches the seam only after
 * the provider accepted it — except where a provider answers about the key without
 * accepting it, which is stored and reported unverified (providers.js).
 *
 * WHAT THIS DOES NOT DO YET: submit a task (S5), price a run (§15 D5), or render
 * the guide card's flyout (S4). It reads one account, reads one app's doors, and
 * checks one adapter file.
 *
 * @module @muen/dsh-generate
 */
import { createReadStream, readFileSync } from 'node:fs'
import { readFile, stat, statfs } from 'node:fs/promises'
import { homedir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { parseAppRef, readAppDoors } from './doors.js'
import { loadHouse } from './house.js'
import { ADAPTER_SCHEMA, adapterFromDoors, validateAdapter } from './adapter.js'
import { PROVIDERS, normalizeKey, providerById, runOptions, runninghub, uploadFile } from './providers.js'
import { readHidden, withHidden, writeHidden } from './hidden.js'
import { readChosenFolder, writeChosenFolder } from './library-path.js'
import { CAN_CHOOSE, chooseFolder, revealFile, revealFolder } from './folder-actions.js'
import { resolveDataRoot } from './paths.js'
import { listRunRecords, readRunRecord, valuesOf, whereIs } from './run-record.js'

/** Matches the row id in cordis.patch.yml. */
export const name = 'generate'

/**
 * The provider routes. One exact path answers the list, and the prefix owns
 * everything under `/providers/<id>/` — each provider's key and its workflows. A
 * distinct (kind, path) per registration is what the web server requires, and these
 * two are distinct entries in two tables.
 *
 * THE PREFIX CARRIES NO TRAILING SLASH, and that is a contract, not a style.
 * Measured against the harness's own matcher on 2026-09-23
 * (`@deepseek-ai/dsh-host-webserver`, `match()`): a prefix claims a request when
 * `pathname === prefix` or `pathname.startsWith(prefix + '/')` — the matcher appends
 * the slash itself. Register `'…/providers/'` and that second test becomes
 * `startsWith('…/providers//')`, so ONLY the bare path ever matches: every
 * `/providers/<id>/…` request falls through to the SPA fallback and comes back 404
 * with an empty body. That is the failure the founder hit on Krea — "The provider
 * could not be reached" for a request that never left the machine — and it broke
 * every provider's key, workflow list and workflow read at once.
 */
const PROVIDERS_PATH = '/plugins/generate/providers'
const PROVIDERS_PREFIX = '/plugins/generate/providers'
// Exact route, no trailing slash (the webServer rule): where finished runs save.
const LIBRARY_PATH = '/plugins/generate/library'
const TIMEOUT_MS = 15000

/** Refuse a body past this — a key is tens of bytes, and the route is reachable. */
const MAX_BODY_BYTES = 4096

/**
 * What a saved file's own extension means on the wire, for the one route that serves
 * bytes (epic 64 S1). The inverse of `library.js`'s `EXT_BY_TYPE`, written out here
 * rather than imported from the downloader: this is a route's concern, and the record
 * already carries the extension `libraryPath` chose.
 */
const TYPE_BY_EXT = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  avif: 'image/avif',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  bin: 'application/octet-stream',
}

/** A job id is what this plugin itself wrote: the record file's own stem, nothing else. */
const JOB_ID_PATTERN = /^(?=.*[A-Za-z0-9])[A-Za-z0-9._-]{1,128}$/

/**
 * The floor a provider's upload route is allowed even without a documented limit, and the
 * only thing this plugin enforces when a provider declares none. Krea declares its own (75
 * MB, its docs' number), so this is the rule for a provider that has not said.
 */
const MAX_UPLOAD_BYTES = 32 * 1024 * 1024

/** S3's two hands (§7): what the agent reads with, and what proves the file. */
const TOOL_GRAPH = 'rh_workflow_graph'
const TOOL_VALIDATE = 'rh_adapter_validate'

/**
 * The skills shipped inside this package (§5 rule 4).
 *
 * TWO, AND THEY ARE A SEQUENCE. `add-rh-workflow` names the doors and confirms before
 * anything is written — it produces the file. `design-generate-screen` decides what the
 * surface then shows: which doors stand on the main screen, what they are called, what the
 * button says, what the gate shows. Installing and designing were one document until the
 * design half grew its own rules (the five controls, the four-door main screen, the five
 * screens a workflow appears on), and a model reading one long document does the mechanical
 * half and skips the judgement half.
 */
const SKILLS = [
  {
    name: 'add-rh-workflow',
    description:
      'Add a RunningHub AI App to the Generate panel: read the app\'s exposed inputs, name each door in the user\'s words, confirm the list, then write and validate the adapter file.',
    whenToUse:
      'Use when the user wants to add, install or register a RunningHub workflow or AI App (they give a runninghub.ai app link or an app id), or says "add workflow".',
    file: fileURLToPath(new URL('../skills/add-rh-workflow/SKILL.md', import.meta.url)),
  },
  {
    name: 'design-generate-screen',
    description:
      'Design the screens a workflow gets inside the Generate panel: which doors stand on the main screen, what each is called, the order and the advanced set, the run label, and what the payload gate and the run strip show.',
    whenToUse:
      'Use when the user wants to design, change or review how a workflow\'s screen looks in the Generate panel — which doors show, what they are called, what the button says — rather than to install one.',
    file: fileURLToPath(new URL('../skills/design-generate-screen/SKILL.md', import.meta.url)),
  },
  {
    name: 'subject-swap',
    description:
      'Swap the outfit from one photo onto a person in another using the Qwen 2.1 Image Edit workflow. The user provides two images; you run the workflow.',
    whenToUse:
      'Use when the user wants to swap, transfer or put an outfit/garment from one image onto a person in another image — "swap the outfit", "put this dress on her", "outfit swap", "subject swap", "clothing transfer".',
    file: fileURLToPath(new URL('../skills/subject-swap/SKILL.md', import.meta.url)),
  },
]

function str(value) {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null
}

/** A percent-encoded header, decoded — or left alone when it is not one. */
function safeDecode(value) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

/**
 * The user's key for one provider, resolved for a read.
 *
 * Kept apart from the route's status read so a missing key is one outcome rather than
 * an exception three calls deep, and so the two agent-facing tools (which read the
 * live app) ask for it the same way the routes do.
 */
async function resolveKey(ctx, provider) {
  const credentials = typeof ctx.get === 'function' ? ctx.get('credentials') : undefined
  if (!credentials) return { error: 'no-credentials' }
  try {
    const info = await credentials.describe(provider.keyRef)
    if (!info || !info.configured) return { error: 'no-key' }
    const resolved = await credentials.resolve(provider.keyRef)
    if (!resolved || !resolved.value) return { error: 'no-key' }
    return { key: resolved.value, source: str(info.source) || str(resolved.source) || null }
  } catch {
    return { error: 'credentials-unavailable' }
  }
}

/** JSON out, never cached, never carrying a secret. */
function send(res, status, body) {
  const text = JSON.stringify(body)
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Content-Length', Buffer.byteLength(text))
  res.end(text)
}

function methodNotAllowed(res, allow) {
  res.setHeader('Allow', allow)
  send(res, 405, { error: 'method-not-allowed' })
}

/** The request body, bounded and parsed. Resolves undefined when unusable. */
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
 * The request body as bytes, bounded. Resolves undefined when it is past the limit or the
 * request fails — the two are told apart by the caller, which knows the limit it passed.
 *
 * This is the upload's reader, not the JSON one: an image is megabytes of binary, so it is
 * not base64'd through a JSON field and parsed back. The bytes the page sends are the bytes
 * the provider gets.
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

/** One text block, the shape every tool render returns. */
function text(value) {
  return [{ type: 'text', text: String(value) }]
}

/** The one-line result a tool shows on its card. */
function line(parts) {
  return parts.filter((part) => part !== null && part !== undefined && part !== '').join(' · ')
}

/** What the root resolution answered, said out loud rather than assumed. */
function rootNote(root) {
  if (root.kind === 'override') return 'adapters directory pinned by RH_DATA_DIR'
  if (root.kind === 'profile') return 'adapters directory is inside profile "' + root.profile + '"'
  return 'no --profile was found in this process, so the adapters directory is $DSH_HOME/generate'
}

/**
 * Register the two read-only tools.
 *
 * They are registered host-wide on purpose: the install is a conversation with the
 * user's own agent, in whatever session they are in. `roles` is not used here
 * because the epic's UI is agent-facing and the gate (§12 rule 1) lives in the
 * pane, not in a role check.
 */
function mountTools(ctx, { base, paths, root }) {
  const tools = typeof ctx.get === 'function' ? ctx.get('tools') : undefined
  if (!tools || typeof tools.register !== 'function') return false

  ctx.effect(
    () =>
      tools.register({
        name: TOOL_GRAPH,
        description:
          'Read a RunningHub AI App\'s exposed inputs (its "doors") and return everything a surface needs: each input\'s node id, field name, control type, the app\'s own options, bounds, default and tooltip, a glossary label, and a starter adapter object. Read-only: it spends no coins, submits no run, and writes no file. Use it with the app link the user pasted, before asking them to confirm anything.',
        parameters: {
          type: 'object',
          properties: {
            link: {
              type: 'string',
              description: 'The RunningHub app link or id, exactly as the user gave it (e.g. https://www.runninghub.ai/app/2072445848017002498).',
            },
            title: { type: 'string', description: 'Optional label for the starter adapter; the app\'s own name is used when omitted.' },
          },
          required: ['link'],
        },
        output: {
          schema: { type: 'object' },
          render: (_args, value) =>
            value && value.ok
              ? text(
                  line([
                    '[runninghub] ' + (value.app.webappName || value.app.appId),
                    value.app.doors.length + ' door(s)',
                    value.adaptersDir,
                  ]),
                )
              : text('[runninghub] ' + String((value && (value.detail || value.error)) || 'failed')),
        },
        async execute(args) {
          const ref = parseAppRef(args && args.link)
          if (ref.error) {
            return {
              ok: false,
              error: ref.error,
              detail:
                ref.error === 'missing-link'
                  ? 'no app link was given; ask the user for the RunningHub app link or id'
                  : 'that does not look like a RunningHub app link or id; ask for it again',
            }
          }
          const key = await resolveKey(ctx, runninghub)
          if (key.error) {
            return {
              ok: false,
              error: key.error,
              detail:
                key.error === 'no-key'
                  ? 'no RunningHub key is linked to this profile yet; the user links one in Settings → Generate, and their wallet step has to come first'
                  : 'the credentials service is unavailable in this profile, so the key cannot be read',
            }
          }
          const loaded = await loadHouse(paths.house)
          const read = await readAppDoors({ base, key: key.key, appId: ref.appId, house: loaded.house, timeoutMs: TIMEOUT_MS })
          if (read.error) {
            return {
              ok: false,
              error: read.error,
              code: read.code,
              detail:
                read.error === 'access-encrypted'
                  ? 'this app does not expose an API we can call yet; write nothing'
                  : read.detail || (read.error === 'api-error' ? 'RunningHub refused the read' : read.error),
            }
          }

          const app = read.app
          const unsupported = app.doors.filter((door) => !door.supported)
          return {
            ok: true,
            schema: ADAPTER_SCHEMA,
            root: paths.root,
            rootKind: root.kind,
            adaptersDir: paths.adapters,
            housePath: paths.house,
            houseSource: loaded.source,
            houseWarning: loaded.warning || null,
            notes: [
              rootNote(root),
              'the API declares no requiredness, so no door is marked required',
              unsupported.length > 0
                ? unsupported.length + ' input(s) use a control this plugin does not render (' +
                  unsupported.map((door) => door.fieldName).join(', ') + '); offer to drop them'
                : null,
              app.doors.some((door) => !door.fromGlossary)
                ? 'some labels came from the field name rather than the glossary; say which, and offer better ones'
                : null,
              'write nothing until the user confirms the door list',
            ].filter((note) => note !== null),
            app,
            house: {
              runLabel: loaded.house.runLabel,
              mainDoors: loaded.house.mainDoors,
              advancedFieldNames: loaded.house.advancedFieldNames,
              advancedTypes: loaded.house.advancedTypes,
              glossary: loaded.house.glossary,
              hint: loaded.house.hint,
            },
            adapter: adapterFromDoors({ app, house: loaded.house, url: ref.url, title: args && args.title ? String(args.title) : null }),
          }
        },
      }),
    'generate: tool ' + TOOL_GRAPH,
  )

  ctx.effect(
    () =>
      tools.register({
        name: TOOL_VALIDATE,
        description:
          'Check a written RunningHub adapter against the live app: every door must be a (nodeId, fieldName) pair the app exposes, every control type must be one the pane renders, and every value copied from the app (options, min, max, step, default, multiline, tooltip) must still match it. Read-only: re-reading the app is the dry run, and it spends no coins. Call it after writing the adapter file and again after every fix, until it reports ok.',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Path to the adapter JSON file that was written.' },
            adapter: { type: 'object', description: 'The adapter object itself, when it is not on disk yet.' },
          },
          required: [],
        },
        output: {
          schema: { type: 'object' },
          render: (_args, value) =>
            value && value.ok
              ? text('[runninghub] adapter ok · ' + value.doors + ' door(s) match the live app')
              : text(
                  '[runninghub] ' +
                    (value && value.problems
                      ? value.problems.length + ' problem(s): ' + value.problems.map((problem) => problem.code).join(', ')
                      : String((value && (value.detail || value.error)) || 'failed')),
                ),
        },
        async execute(args) {
          let adapter = args && args.adapter
          if (!adapter) {
            const path = args && typeof args.path === 'string' ? args.path.trim() : ''
            if (path === '') {
              return { ok: false, error: 'missing-adapter', detail: 'give the adapter file path, or the adapter object' }
            }
            let raw
            try {
              raw = await readFile(path, 'utf8')
            } catch (error) {
              return { ok: false, error: 'unreadable', detail: path + ' could not be read: ' + String((error && error.message) || error) }
            }
            try {
              adapter = JSON.parse(raw)
            } catch (error) {
              return { ok: false, error: 'invalid-json', detail: path + ' is not valid JSON: ' + String((error && error.message) || error) }
            }
          }

          const appId = adapter && adapter.source && typeof adapter.source.appId === 'string' ? adapter.source.appId.trim() : ''
          if (appId === '') {
            return {
              ok: false,
              error: 'no-app',
              problems: [{ code: 'source', detail: 'the adapter declares no source.appId, so there is no app to check it against' }],
            }
          }
          const key = await resolveKey(ctx, runninghub)
          if (key.error) return { ok: false, error: key.error, detail: 'the key could not be read, so nothing can be checked against the live app' }

          const loaded = await loadHouse(paths.house)
          const read = await readAppDoors({ base, key: key.key, appId, house: loaded.house, timeoutMs: TIMEOUT_MS })
          if (read.error) {
            return {
              ok: false,
              error: read.error,
              code: read.code,
              detail: read.detail || 'the live app could not be read, so the adapter is unverified rather than wrong',
            }
          }

          const result = validateAdapter(adapter, { app: read.app })
          return {
            ok: result.ok,
            doors: result.doors,
            problems: result.problems,
            app: { appId: read.app.appId, webappName: read.app.webappName },
            detail: result.ok
              ? 'every door matches the live app; now set provenance.dryRun to "ok" and write the file once more'
              : 'fix every problem and run this tool again',
          }
        },
      }),
    'generate: tool ' + TOOL_VALIDATE,
  )

  return true
}

/**
 * Register the shipped skills.
 *
 * Each travels inside this package (§5 rule 4: its own copy, never a dependency on
 * Muen's translation pack) and is read at apply time, so the host process serves the
 * same text that is in the repo. One skill that cannot be read is reported and skipped
 * while the other still mounts: a plugin that fails to load is worse than one with a
 * skill missing, and the two are independent installs in a profile.
 */
function mountSkill(ctx) {
  const skills = typeof ctx.get === 'function' ? ctx.get('skills') : undefined
  if (!skills || typeof skills.register !== 'function') return false
  let mounted = false
  for (const skill of SKILLS) {
    let content
    try {
      content = readFileSync(skill.file, 'utf8')
    } catch (error) {
      if (ctx.logger && typeof ctx.logger.warn === 'function') {
        ctx.logger.warn('generate: the skill file could not be read at ' + skill.file + ': ' + String((error && error.message) || error))
      }
      continue
    }
    ctx.effect(
      () =>
        skills.register({
          name: skill.name,
          description: skill.description,
          whenToUse: skill.whenToUse,
          invocation: { modelInvocable: true, userInvocable: true },
          source: 'runtime',
          provider: 'runninghub',
          path: skill.file,
          resourceBase: { kind: 'directory', path: dirname(skill.file) },
          content,
        }),
      'generate: skill ' + skill.name,
    )
    mounted = true
  }
  return mounted
}

/**
 * Mount the provider routes.
 *
 * ONE ROUTER, ONE PREFIX. The plugin owns `/plugins/generate/` and answers everything
 * under `/plugins/generate/providers`: the provider list, each provider's key, and
 * each provider's workflows. A route per provider per action would have been three
 * registrations per provider; a prefix route keeps the surface's own namespace ours
 * and puts the provider id in the path, which is where a reader expects it. The
 * prefix is registered WITHOUT a trailing slash — see `PROVIDERS_PREFIX` for the
 * measured reason.
 *
 * `credentials` is read per request rather than captured, which is what the seam asks
 * for: resolution is per call, so a credential changed elsewhere reaches the next
 * request without a restart of the plugin.
 */
export function apply(ctx, config = {}) {
  const base = str(config.base) || str(process.env.RH_BASE) || null

  /**
   * The two native folder verbs (lib/folder-actions.js): the OS dialog that picks a
   * folder, and the reveal that opens the current one in Finder. They arrive through
   * the config so a verify run injects fakes — a test must never pop a real dialog on
   * the founder's screen — and `canChoose` is whether a dialog can run on this host.
   */
  const folders = config.folders || { choose: chooseFolder, reveal: revealFolder, revealFile, canChoose: CAN_CHOOSE }

  // Resolved before the routes mount, because the provider routes answer from these
  // directories and the tools below report the same resolution (§4: one root, said
  // out loud once).
  const root = resolveDataRoot()

  /**
   * The host one provider is asked at.
   *
   * `config.base` / `RH_BASE` predates the second provider and stays what it was: an
   * override for the verify scripts and a pinned deployment. With four providers it
   * can only name RunningHub's host — one override cannot mean four hosts, and letting
   * it rewrite every provider would send Krea's key to RunningHub's server.
   */
  const baseFor = (provider) => (provider.id === 'runninghub' ? base || provider.base : provider.base)

  /**
   * What every row says about a provider, whatever the state of its key.
   *
   * The page's own copy comes from here rather than from the browser half, because it
   * is provider data: the label, the family the settings page tags it with, the page
   * that issues the key and what that page is called, the page a person manages the
   * account at, what using the provider costs (`funding` — the row draws the sentence
   * from its `kind` and links its `url`), and the sentence that installs one of
   * its workflows. No key and no credential reference: a route answers a page.
   *
   * `runOption` travels with the identity because it is the provider's own vocabulary —
   * RunningHub's `instanceType` (24/48/84GB) is the one today — so the surface draws its
   * split button from a declaration rather than from a name it guessed.
   */
  const identity = (provider) => ({
    id: provider.id,
    label: provider.label,
    kind: provider.kind,
    keyPageLabel: provider.keyPageLabel,
    keyUrl: provider.keyUrl,
    accountUrl: provider.accountUrl,
    funding: provider.funding,
    addPrompt: provider.addPrompt,
    runOption: provider.runOption,
  })

  /**
   * The key state of one provider: what the pane and Settings both read.
   *
   * `linked` is "a value resolves"; `verified` is "the provider answered about it".
   * They are two facts, and a provider can hold the first without the second: a key
   * whose subscription has lapsed (Comfy Cloud's 429), whose API balance is empty
   * (Krea's 402), or whose entitlement Magnific never confirms (its 403) is stored and
   * reported unverified rather than thrown away (founder,
   * 2026-09-23: *"store it and mark it unverified"*). `note` carries the caveat when
   * there is one.
   */
  const keyStatus = async (provider) => {
    const empty = { ...identity(provider), linked: false, verified: false, writable: false, source: null, account: null, note: null, error: null }
    const credentials = typeof ctx.get === 'function' ? ctx.get('credentials') : undefined
    if (!credentials) return { ...empty, error: 'no-credentials' }

    let info
    try {
      info = await credentials.describe(provider.keyRef)
    } catch {
      return { ...empty, error: 'credentials-unavailable' }
    }
    if (!info || !info.configured) return { ...empty, writable: !!info.writable }

    let resolved
    try {
      resolved = await credentials.resolve(provider.keyRef)
    } catch {
      return { ...empty, writable: !!info.writable, error: 'credentials-unavailable' }
    }
    if (!resolved || !resolved.value) return { ...empty, writable: !!info.writable }

    const probe = await provider.account({ base: baseFor(provider), key: resolved.value })
    return {
      ...empty,
      linked: true,
      verified: !!probe.account,
      writable: !!info.writable,
      source: str(info.source) || str(resolved.source) || null,
      account: probe.account || null,
      note: probe.note || null,
      error: probe.error || null,
    }
  }

  /** Every provider, with its key state, how many workflows it has, and its switch. */
  const providerList = async () => {
    const hidden = await readHidden(root.root)
    const rows = []
    for (const provider of PROVIDERS) {
      const status = await keyStatus(provider)
      const paths = provider.data(root.root)
      let workflows = 0
      try {
        const listed = await provider.listWorkflows({ dir: paths.adapters, root: root.root })
        workflows = listed.entries.length
      } catch {
        // A provider whose directory cannot be read is still a provider: the key
        // state is what this route is for, and the workflow count is a courtesy.
        workflows = null
      }
      // `upload` is a capability, not a status: a provider that can turn a picked file into
      // a URL says so, and the pane draws the pick control only where it is true. RunningHub
      // uploads per image door as part of its own run slice, so it answers false until then.
      rows.push({ ...status, workflows, hidden: hidden.includes(provider.id), upload: !!provider.upload })
    }
    return { providers: rows }
  }

  /**
   * The settings toggle: whether the Generate panel draws this provider.
   *
   * It writes one id to one small file and changes nothing else — no credential is
   * touched, no adapter is moved, no route stops answering for it. The row itself stays
   * in Settings, which is what makes the switch reversible from where it was thrown.
   */
  const providerHidden = async (provider, req, res) => {
    const method = (req.method || 'GET').toUpperCase()

    if (method === 'GET') {
      const hidden = await readHidden(root.root)
      send(res, 200, { id: provider.id, hidden: hidden.includes(provider.id), hiddenIds: hidden })
      return
    }

    if (method !== 'POST') {
      methodNotAllowed(res, 'GET, POST')
      return
    }

    const body = await readJsonBody(req)
    if (body === undefined || typeof body.hidden !== 'boolean') {
      send(res, 400, { error: 'bad-request', detail: '"hidden" must be true or false' })
      return
    }

    const current = await readHidden(root.root)
    const next = await writeHidden(root.root, withHidden(current, provider.id, body.hidden))
    send(res, 200, { id: provider.id, hidden: body.hidden, hiddenIds: next })
  }

  /** One provider's key: read, link, or remove. The wallet route, per provider. */
  const providerKey = async (provider, req, res) => {
    const method = (req.method || 'GET').toUpperCase()
    const credentials = typeof ctx.get === 'function' ? ctx.get('credentials') : undefined

    if (method === 'GET') {
      send(res, 200, await keyStatus(provider))
      return
    }

    if (method === 'POST') {
      const body = await readJsonBody(req)
      if (body === undefined) {
        send(res, 400, { error: 'bad-request' })
        return
      }
      // A key the wire cannot carry is refused here, with its own reason: a pasted
      // line break or smart quote used to come back as "the provider could not be
      // reached", which blamed the network for a request that was never made.
      const shape = normalizeKey(body.key)
      if (shape.error) {
        send(res, 400, { error: shape.error })
        return
      }
      const key = shape.key
      const probe = await provider.account({ base: baseFor(provider), key })
      // A key the provider could not check is still the user's key: it is stored and
      // the row reports it unverified. A key the provider REFUSED is never stored —
      // an unvalidated secret is worse than no secret.
      if (!probe.account && probe.unverified !== true) {
        send(res, probe.error === 'invalid-key' ? 400 : 502, {
          ...identity(provider),
          linked: false,
          verified: false,
          writable: true,
          source: null,
          account: null,
          note: null,
          error: probe.error,
        })
        return
      }
      if (!credentials) {
        send(res, 503, { error: 'no-credentials' })
        return
      }
      try {
        await credentials.set(provider.keyRef, key)
      } catch (error) {
        // The seam refuses while a read-only source shadows the reference. Say
        // which, because "the key did not change" is otherwise unexplainable.
        send(res, 409, {
          ...identity(provider),
          linked: true,
          verified: !!probe.account,
          writable: false,
          source: null,
          account: probe.account || null,
          note: probe.note || null,
          error: 'read-only',
          detail: String((error && error.message) || error),
        })
        return
      }
      send(res, 200, {
        ...identity(provider),
        linked: true,
        verified: !!probe.account,
        writable: true,
        // The seam's own word for the value it manages: a `credentials` read after
        // this save reports `file`, and the surface's note is keyed on that. It said
        // `store` here until 2026-09-22, which no read ever confirms — the strip then
        // called a pasted key "from your environment".
        source: 'file',
        account: probe.account || null,
        note: probe.note || null,
        error: null,
      })
      return
    }

    if (method === 'DELETE') {
      if (!credentials) {
        send(res, 503, { error: 'no-credentials' })
        return
      }
      try {
        await credentials.unset(provider.keyRef)
      } catch (error) {
        send(res, 409, {
          ...identity(provider),
          linked: true,
          verified: false,
          writable: false,
          source: null,
          account: null,
          note: null,
          error: 'read-only',
          detail: String((error && error.message) || error),
        })
        return
      }
      send(res, 200, await keyStatus(provider))
      return
    }

    methodNotAllowed(res, 'GET, POST, DELETE')
  }

  /**
   * One provider's workflows: the list the pane's cards are drawn from.
   *
   * A read of one directory, so it needs no key, no network and no account — the
   * cards draw on a fresh install, before anything is linked.
   */
  const providerWorkflows = async (provider, res) => {
    try {
      send(res, 200, await provider.listWorkflows({ dir: provider.data(root.root).adapters, root: root.root }))
    } catch (error) {
      // The directory exists but cannot be read: a permission or a filesystem
      // problem, not an empty install, and the two must not look alike.
      send(res, 500, { entries: [], skipped: [], error: 'unreadable', detail: String((error && error.message) || error) })
    }
  }

  /**
   * One workflow, as the surface that renders it needs it.
   *
   * The name arrives in the query string, so it is validated before any file is
   * opened and the answer says which failure it was: a bad name is the caller's
   * mistake, a missing file is an empty slot, and a file that is not a listable
   * adapter is neither.
   */
  const providerWorkflow = async (provider, url, res) => {
    const read = await provider.readWorkflow({ dir: provider.data(root.root).adapters, root: root.root, name: url.searchParams.get('name') })
    if (read.error) {
      const status = read.error === 'not-found' ? 404 : read.error === 'bad-name' ? 400 : 500
      send(res, status, { error: read.error, detail: read.detail || null })
      return
    }
    // `runnable`, `canCancel` and `canQueue` are the PROVIDER's facts, added here
    // rather than in the adapter file: an adapter describes an app, and whether this
    // plugin can spend on it — or stop it, or read the account's queue — is a property
    // of the provider behind it (Krea could always run; RunningHub could not until
    // 2026-09-23; cancel and queue arrived the same day). The surface draws the run
    // control, the cancel button and the queue band from these flags, so a provider
    // that has none keeps saying so instead of offering controls that would 501.
    send(res, 200, {
      ...read.adapter,
      runnable: provider.runnable === true,
      canCancel: typeof provider.cancelRun === 'function',
      canQueue: typeof provider.queueStatus === 'function',
    })
  }

  /**
   * The upload: one file a person picked, turned into the URL a door carries.
   *
   * The pane holds no key (§12 rule 2), so the file comes here and this goes to the
   * provider. The bytes ARE the request body and the file's name and type ride in headers,
   * because an image is megabytes of binary and a JSON envelope would only inflate it. The
   * name is percent-encoded by the caller — a header is no place for a space or a quote.
   *
   * Nothing here is a generation, so nothing here is billed: Krea's assets are free to
   * upload, and a run is still the only thing the gate guards.
   */
  const providerAsset = async (provider, req, res) => {
    if ((req.method || 'GET').toUpperCase() !== 'POST') {
      methodNotAllowed(res, 'POST')
      return
    }
    if (!provider.upload || typeof provider.upload !== 'object') {
      send(res, 501, { error: 'unsupported', detail: 'this provider has no upload path yet' })
      return
    }
    const limit = Number.isFinite(provider.upload.limitBytes) ? provider.upload.limitBytes : MAX_UPLOAD_BYTES
    const bytes = await readRawBody(req, limit)
    if (bytes === undefined) {
      send(res, 413, { error: 'too-large', detail: 'the file is past this provider\'s own limit of ' + limit + ' bytes' })
      return
    }
    if (bytes.length === 0) {
      send(res, 400, { error: 'bad-request', detail: 'the request body is the file itself' })
      return
    }
    const type = str(req.headers['content-type']) || 'application/octet-stream'
    const rawName = str(req.headers['x-file-name'])
    const name = rawName === null ? 'upload' : safeDecode(rawName)
    const key = await providerKeyValue(provider)
    if (key.error) {
      send(res, key.error === 'no-key' ? 400 : 500, { error: key.error })
      return
    }
    const uploaded = await uploadFile(provider, { key: key.key, name, type, bytes })
    if (uploaded.error) {
      const status =
        uploaded.error === 'invalid-key' ? 401 : uploaded.error === 'no-api-balance' ? 402 : uploaded.error === 'too-large' ? 413 : 502
      send(res, status, uploaded)
      return
    }
    send(res, 200, uploaded)
  }

  /**
   * The provider's own key, resolved for a run.
   *
   * The pane never holds a key (§12 rule 2), so the host reads it here and puts it in one
   * header. `resolve` is the same seam the key check uses; the difference is that this one
   * is called per run rather than per page.
   */
  const providerKeyValue = async (provider) => {
    const credentials = typeof ctx.get === 'function' ? ctx.get('credentials') : undefined
    if (!credentials) return { error: 'no-credentials' }
    let resolved
    try {
      resolved = await credentials.resolve(provider.keyRef)
    } catch {
      return { error: 'credentials-unavailable' }
    }
    if (!resolved || !resolved.value) return { error: 'no-key' }
    return { key: resolved.value }
  }

  /**
   * The gate's preview: what this surface WOULD post, and nothing else.
   *
   * Read-only and free. It exists so the dialog a person sees and the request that leaves
   * the machine are built by one function — a preview assembled in the browser would be a
   * second implementation of the payload, and the two would drift.
   */
  const providerPayload = async (provider, req, res) => {
    if (typeof provider.previewRun !== 'function') {
      send(res, 501, { error: 'unsupported', detail: 'this provider has no run path yet' })
      return
    }
    const body = await readJsonBody(req)
    if (body === undefined) {
      send(res, 400, { error: 'bad-request', detail: 'a JSON body is required' })
      return
    }
    const chosen = runOptions(provider, body.options)
    if (!chosen.ok) {
      send(res, 400, { error: 'bad-option', detail: chosen.detail })
      return
    }
    const preview = await provider.previewRun({ root: provider.data(root.root).root, name: body.name, values: body.values, options: chosen.options })
    if (preview.error) {
      send(res, preview.error === 'not-found' ? 404 : 400, preview)
      return
    }
    // The options the request WILL carry are echoed back with it, so the gate draws what
    // the host would send rather than what the browser remembers choosing.
    send(res, 200, { ...preview, options: chosen.options })
  }

  /**
   * Start a run.
   *
   * THE GATE IS ENFORCED HERE, NOT IN THE DIALOG (§12 rule 1): a call that does not carry
   * `confirmed: true` is refused, so nothing that skipped a person — a script, a future
   * agent tool, a stale tab — can spend a credit. The flag is the record of that person's
   * action, and it is written into the run's own file beside the payload they saw.
   */
  const providerRun = async (provider, req, res) => {
    const method = (req.method || 'GET').toUpperCase()
    if (typeof provider.startRun !== 'function' || typeof provider.readRun !== 'function') {
      send(res, 501, { error: 'unsupported', detail: 'this provider has no run path yet' })
      return
    }

    if (method === 'GET') {
      const url = new URL(req.url || '/', 'http://127.0.0.1')
      const jobId = url.searchParams.get('job')
      if (str(jobId) === null) {
        send(res, 400, { error: 'bad-request', detail: '?job=<id> names the run to read' })
        return
      }
      const key = await providerKeyValue(provider)
      if (key.error) {
        send(res, key.error === 'no-key' ? 400 : 500, { error: key.error })
        return
      }
      const read = await provider.readRun({
        root: provider.data(root.root).root,
        // Where a finished run's bytes go, asked fresh on every poll: a folder the
        // person chose in Settings wins, else the Desktop default (lib/library.js
        // keeps the provider/workflow/day shape under whatever root answers).
        libraryRoot: (await libraryState()).root,
        jobId,
        key: key.key,
      })
      if (read.error === 'job-not-found') {
        send(res, 404, read)
        return
      }
      if (read.error) {
        send(res, read.error === 'invalid-key' ? 401 : 502, read)
        return
      }
      send(res, 200, read)
      return
    }

    if (method !== 'POST') {
      methodNotAllowed(res, 'GET, POST')
      return
    }

    const body = await readJsonBody(req)
    if (body === undefined) {
      send(res, 400, { error: 'bad-request', detail: 'a JSON body is required' })
      return
    }
    if (body.confirmed !== true) {
      send(res, 400, {
        error: 'not-confirmed',
        detail: 'a run starts only from the gate: post the payload a person confirmed, with confirmed: true',
      })
      return
    }
    const key = await providerKeyValue(provider)
    if (key.error) {
      send(res, key.error === 'no-key' ? 400 : 500, { error: key.error })
      return
    }
    // The same declaration the preview was read through: a run carries the options the gate
    // showed, and one the provider never declared is refused here.
    const chosen = runOptions(provider, body.options)
    if (!chosen.ok) {
      send(res, 400, { error: 'bad-option', detail: chosen.detail })
      return
    }
    const started = await provider.startRun({
      root: provider.data(root.root).root,
      name: body.name,
      values: body.values,
      options: chosen.options,
      key: key.key,
    })
    if (started.error) {
      const status =
        started.error === 'not-found'
          ? 404
          : started.error === 'invalid-key'
            ? 401
            : started.error === 'no-api-balance'
              ? 402
              : started.error === 'too-many-jobs'
                ? 429
                : started.error === 'payload-incomplete' || started.error === 'payload-refused' || started.error === 'bad-request'
                  ? 400
                  : 502
      send(res, status, started)
      return
    }
    send(res, 200, started)
  }

  /**
   * ASK to cancel a run. No `confirmed` flag: a cancel spends nothing, it stops spend —
   * a gate in front of it would be a dialog that protects nothing. The answer is
   * fire-and-ask (the API accepts the request, it does not promise the GPU stopped),
   * so `200 { ok: true }` means "asked", and the pane keeps polling until the status
   * itself settles — a cancel that raced a finishing task still shows the result.
   */
  const providerCancel = async (provider, req, res) => {
    const method = (req.method || 'POST').toUpperCase()
    if (method !== 'POST') {
      methodNotAllowed(res, 'POST')
      return
    }
    if (typeof provider.cancelRun !== 'function') {
      send(res, 501, { error: 'unsupported', detail: 'this provider cannot cancel a run' })
      return
    }
    const body = await readJsonBody(req)
    if (body === undefined) {
      send(res, 400, { error: 'bad-request', detail: 'a JSON body is required' })
      return
    }
    const jobId = str(body.jobId)
    if (jobId === null) {
      send(res, 400, { error: 'bad-request', detail: 'jobId names the run to cancel' })
      return
    }
    const key = await providerKeyValue(provider)
    if (key.error) {
      send(res, key.error === 'no-key' ? 400 : 500, { error: key.error })
      return
    }
    const cancelled = await provider.cancelRun({ jobId, key: key.key })
    if (cancelled.error) {
      // 807 — the task is already gone (finished, or cancelled before): an answer the
      // pane turns into "settle on the next poll", not an error to shout about.
      const status = cancelled.error === 'job-not-found' ? 404 : cancelled.error === 'invalid-key' ? 401 : 502
      send(res, status, cancelled)
      return
    }
    send(res, 200, { ok: true })
  }

  /**
   * READ the account's queue for the band under the preview card: how many tasks run,
   * how many wait, the key's concurrency ceiling. A GET like every read, and every
   * failure answers its own error — the band treats any non-200 as "no band" rather
   * than as a message, because their spec marks this endpoint `developing` and a
   * component showing nothing is the honest answer to an endpoint that says nothing.
   */
  const providerQueue = async (provider, req, res) => {
    const method = (req.method || 'GET').toUpperCase()
    if (method !== 'GET') {
      methodNotAllowed(res, 'GET')
      return
    }
    if (typeof provider.queueStatus !== 'function') {
      send(res, 501, { error: 'unsupported', detail: 'this provider has no queue endpoint' })
      return
    }
    const key = await providerKeyValue(provider)
    if (key.error) {
      send(res, key.error === 'no-key' ? 400 : 500, { error: key.error })
      return
    }
    const queue = await provider.queueStatus({ key: key.key })
    if (queue.error) {
      send(res, queue.error === 'invalid-key' ? 401 : 502, queue)
      return
    }
    send(res, 200, queue)
  }

  /**
   * Per-workflow state persist. The surface saves every value change, and opens with the
   * last-saved values — so a person who switches the aspect ratio once keeps it the next
   * time they open the same workflow. The file lives at
   * `<profile>/<provider>/state/<workflow-name>.json`, and the route is method-agnostic:
   * GET returns the saved values (or {}), POST writes them.
   */
  const providerState = async (provider, req, res) => {
    const method = (req.method || 'GET').toUpperCase()
    const url = new URL(req.url || '/', 'http://127.0.0.1')
    // THE BODY IS THIS ROUTE'S JOB TO READ. Every other POST route in this file calls
    // `readJsonBody` itself; this one used to read `req.body`, which no seam ever sets — so
    // a write answered 400 `missing-name` no matter what the page sent, and the surface's
    // per-value save could never land. Found by verify/result.mjs, 2026-09-26.
    const body = method === 'POST' ? await readJsonBody(req) : undefined
    if (method === 'POST' && body === undefined) {
      send(res, 400, { error: 'bad-request', detail: 'a JSON body is required' })
      return
    }
    const name = method === 'GET'
      ? str(url.searchParams.get('name'))
      : str(body && body.name)
    if (!name) {
      send(res, 400, { error: 'missing-name', detail: 'a workflow name is required' })
      return
    }
    const stateDir = join(provider.data(root.root).root, 'state')
    const file = join(stateDir, name + '.json')

    if (method === 'GET') {
      try {
        const data = await readFile(file, 'utf8')
        send(res, 200, JSON.parse(data))
      } catch {
        send(res, 200, {})
      }
      return
    }

    if (method === 'POST') {
      const values = body && body.values
      if (!values || typeof values !== 'object' || Array.isArray(values)) {
        send(res, 400, { error: 'missing-values', detail: 'values must be an object' })
        return
      }
      const { mkdir, writeFile } = await import('node:fs/promises')
      await mkdir(stateDir, { recursive: true })
      await writeFile(file, JSON.stringify(values, null, 2))
      send(res, 200, { ok: true })
      return
    }

    methodNotAllowed(res, 'GET,POST')
  }

  /**
   * The strip's own read (epic 64 S3): the runs of ONE workflow, newest first, each carrying
   * the values it was asked for and the state of the files it saved.
   *
   * THE RECORD IS THE INDEX. Nothing else is consulted and nothing is written: a directory
   * read and one parse per record is the whole cost, which is what "fine into the
   * thousands" means in practice.
   *
   * TWO STATES DROP AN OUTPUT, ONE KEEPS IT. A file that has moved to `_trash/` takes its
   * OUTPUT out of the row — a delete is a decision about the series, and the library shows
   * the same asset as Trashed. A file that is merely gone, or on a volume that is not
   * mounted, keeps both the row and the output, reading Missing or Offline, because a gap in
   * a series is information a person needs. A row whose outputs are ALL trashed leaves the
   * strip entirely.
   *
   * `values` is keyed by the API's own field name, which is the one string that survives both
   * providers' bodies and the one a form can take back (see `valuesOf`).
   */
  const providerResults = async (provider, url, res) => {
    const name = str(url.searchParams.get('name'))
    if (!name) {
      send(res, 400, { error: 'missing-name', detail: 'a workflow name is required' })
      return
    }
    // `str` answers null for an absent or empty value — the default is the ABSENT case, which
    // is exactly what a first call sends. (A missing limit used to be refused as `bad-limit`,
    // which the live probe in verify/result.mjs caught.)
    const limitRaw = str(url.searchParams.get('limit'))
    const limit = limitRaw === null ? 60 : Number.isFinite(Number(limitRaw)) && limitRaw !== '' ? Number(limitRaw) : Number.NaN
    if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
      send(res, 400, { error: 'bad-limit', detail: 'limit is 1..500' })
      return
    }
    const listed = await listRunRecords(provider.data(root.root).root, { limit })
    const rows = []
    for (const record of listed.records) {
      if (str(record.adapter) !== name) continue
      const outcome = record.outcome && typeof record.outcome === 'object' ? record.outcome : {}
      const saved = Array.isArray(outcome.saved) ? outcome.saved : []
      const files = []
      for (const [index, entry] of saved.entries()) {
        if (!entry || typeof entry.file !== 'string' || entry.file === '') continue
        files.push({
          i: index,
          where: await whereIs(entry.file),
          type: str(entry.type) || null,
          bytes: typeof entry.bytes === 'number' ? entry.bytes : null,
          path: entry.file,
          url: str(entry.url) || null,
        })
      }
      const visible = files.filter((file) => file.where !== 'trashed')
      // Every output trashed: the row leaves the strip, because that is what a delete means.
      if (files.length > 0 && visible.length === 0) continue
      rows.push({
        jobId: String(record.jobId || ''),
        at: str(record.at) || null,
        settledAt: str(outcome.at) || null,
        status: str(outcome.status || record.status) || null,
        state: str(outcome.state) || null,
        values: valuesOf(record),
        files: visible,
        error: str(outcome.error) || null,
      })
    }
    send(res, 200, { name, rows, total: listed.total, truncated: listed.truncated })
  }

  /**
   * The bytes of a finished run's own file (epic 64 S1) — the one route the asset library
   * and the session strip both draw from.
   *
   * THE PATH COMES FROM THE RECORD, NEVER FROM THE QUERY. `?job=<jobId>&i=<index>` names
   * *which* saved output; the file is whatever the host itself wrote into that run's
   * `outcome.saved[i].file`. So a caller cannot ask for a file this plugin never produced,
   * and there is no path parameter to climb with. A job id is still checked against the
   * shape the record writer uses before it is joined into a path, because a `..` in a job
   * id would otherwise walk out of the runs directory (`readRunRecord` joins it blind).
   *
   * THE TWO ABSENCES ARE DIFFERENT ANSWERS. A run that saved nothing answers 404
   * `no-result` with the provider's own reason; a run whose file has since been moved or
   * trashed answers 404 `missing-file` with the path. The library draws those apart — one
   * is "this run produced nothing", the other is "it was here and it is not" — and neither
   * is the empty 404 the SPA fallback would give.
   *
   * `no-store`, like every other answer this plugin gives: a cached 200 would keep showing
   * a file that has been moved, and the library's whole job is to say where a thing is.
   */
  const providerResult = async (provider, url, res) => {
    const jobId = str(url.searchParams.get('job'))
    if (!JOB_ID_PATTERN.test(jobId) || jobId.includes('..')) {
      send(res, 400, { error: 'bad-job', detail: 'a job id is letters, digits, dot, dash or underscore' })
      return
    }
    const raw = url.searchParams.get('i')
    const index = raw === null || raw === '' ? 0 : Number(raw)
    if (!Number.isInteger(index) || index < 0 || index > 999) {
      send(res, 400, { error: 'bad-index', detail: 'i is the index of a saved output' })
      return
    }

    const record = await readRunRecord(provider.data(root.root).root, jobId)
    if (!record) {
      send(res, 404, { error: 'no-record', detail: 'this install has no run ' + jobId })
      return
    }

    const outcome = record.outcome && typeof record.outcome === 'object' ? record.outcome : {}
    const saved = Array.isArray(outcome.saved) ? outcome.saved : []
    const entry = saved[index]
    if (!entry || typeof entry.file !== 'string' || entry.file === '') {
      send(res, 404, {
        error: 'no-result',
        detail: str(outcome.error) || 'this run saved no file at index ' + index,
        state: str(outcome.state),
      })
      return
    }

    const file = entry.file
    const absolute = file.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(file)
    if (!absolute || file.length > 4096 || file.includes('\0')) {
      send(res, 404, { error: 'missing-file', detail: 'the record names a path this host cannot serve' })
      return
    }

    let info
    try {
      info = await stat(file)
    } catch {
      send(res, 404, { error: 'missing-file', detail: 'the file is not where the record says: ' + file })
      return
    }
    if (!info.isFile()) {
      send(res, 404, { error: 'missing-file', detail: 'not a file: ' + file })
      return
    }

    res.statusCode = 200
    res.setHeader('Content-Type', TYPE_BY_EXT[str(entry.type).toLowerCase()] || 'application/octet-stream')
    res.setHeader('Content-Length', info.size)
    res.setHeader('Cache-Control', 'no-store')
    const stream = createReadStream(file)
    // A file that vanishes between the stat and the read: the headers are already gone, so
    // the only honest end is a broken response rather than a lie with a length in it.
    stream.on('error', () => {
      try { res.destroy() } catch { /* the socket is already gone */ }
    })
    stream.pipe(res)
  }

  /** `/providers/<id>/<action>`, with the provider resolved before any work happens. */
  const route = async (req, res) => {
    const url = new URL(req.url || '/', 'http://127.0.0.1')
    // The matcher hands over the tail WITH its leading slash: `/providers/krea/key`
    // arrives here as `/krea/key`. Strip it, so the bare prefix (`''`) and the
    // trailing-slash form (`/`) both mean "the list" instead of "provider ''".
    const tail = url.pathname.slice(PROVIDERS_PREFIX.length).replace(/^\/+/, '')
    const [id, action] = tail.split('/')

    if (action === undefined || action === '') {
      // The bare `/providers/` answers the same list as the exact route, so a caller
      // that adds the slash is not punished for it.
      send(res, 200, await providerList())
      return
    }

    const provider = providerById(id)
    if (!provider) {
      send(res, 404, { error: 'unknown-provider', detail: 'no provider is registered as "' + String(id) + '"' })
      return
    }

    if (action === 'key') {
      await providerKey(provider, req, res)
      return
    }

    if (action === 'hidden') {
      await providerHidden(provider, req, res)
      return
    }

    // The upload a door's image control calls before a run: a file in, a URL out.
    if (action === 'asset') {
      await providerAsset(provider, req, res)
      return
    }

    // The gate and the run. Both own their methods: the preview is a POST of the values a
    // person is looking at, and the run route answers a GET (one poll) as well as the POST
    // that starts it.
    if (action === 'payload') {
      await providerPayload(provider, req, res)
      return
    }

    if (action === 'run') {
      await providerRun(provider, req, res)
      return
    }

    // Per-workflow state persist: the surface writes every value change, and opens with the
    // last-saved values — so a person who switches the aspect ratio once keeps it the next
    // time they open the same workflow.
    if (action === 'state') {
      await providerState(provider, req, res)
      return
    }

    // The strip's own read (epic 64 S3): one workflow's runs, newest first.
    if (action === 'results') {
      if ((req.method || 'GET').toUpperCase() !== 'GET') {
        methodNotAllowed(res, 'GET')
        return
      }
      await providerResults(provider, url, res)
      return
    }

    // The bytes of a finished run's own file (epic 64 S1). GET only, and the query names
    // WHICH saved output rather than a path — see `providerResult`.
    if (action === 'result') {
      if ((req.method || 'GET').toUpperCase() !== 'GET') {
        methodNotAllowed(res, 'GET')
        return
      }
      await providerResult(provider, url, res)
      return
    }

    // The cancel the preview's strip asks for, and the queue the band under it reads.
    // Capability is method-presence, the same rule as the run above: a provider
    // without the method answers 501, and the workflow answer's `canCancel` /
    // `canQueue` flags tell the surface whether to draw either control at all
    // (founder, 2026-09-23: *"lets design a cancel button inside the preview & a
    // queue component under the preview card"*).
    if (action === 'cancel') {
      await providerCancel(provider, req, res)
      return
    }

    if (action === 'queue') {
      await providerQueue(provider, req, res)
      return
    }

    const method = (req.method || 'GET').toUpperCase()
    if (method !== 'GET') {
      methodNotAllowed(res, 'GET')
      return
    }
    if (action === 'workflows') {
      await providerWorkflows(provider, res)
      return
    }
    if (action === 'workflow') {
      await providerWorkflow(provider, url, res)
      return
    }

    send(res, 404, { error: 'unknown-action', detail: '"' + String(action) + '" is not a provider route' })
  }

  const list = async (req, res) => {
    if ((req.method || 'GET').toUpperCase() !== 'GET') {
      methodNotAllowed(res, 'GET')
      return
    }
    // The library answer rides the list the settings page already reads: one request
    // for the provider rows AND for where their runs save, so there is no second fetch
    // to stub or to fail.
    send(res, 200, { ...(await providerList()), library: await libraryState() })
  }

  /**
   * WHERE A FINISHED RUN'S BYTES LAND, answered fresh on every read (founder,
   * 2026-09-23: *"let's make save folder default on desktop, and the user can click
   * to choose a different folder"*).
   *
   * A folder the person chose in Settings → Generate wins; it is stored in
   * `<root>/library.json`, so the choice survives restarts and sits nowhere near a
   * key. With no choice the bytes go to THE DESKTOP — the one folder that is always
   * there, always visible, and never buried inside the harness's own install. The
   * project-folder default this replaced is gone: a save nobody can find is the
   * failure this row exists to prevent.
   */
  async function chosenFolder() {
    return readChosenFolder(root.root)
  }

  /** `~/Desktop` and `~` expand; every other path is taken as written. */
  function expandFolder(path) {
    if (path === '~') return homedir()
    if (path.startsWith('~/')) return join(homedir(), path.slice(2))
    return path
  }

  /** The default save folder: the Desktop of whoever runs this install. */
  function desktopFolder() {
    return join(homedir(), 'Desktop')
  }

  /**
   * Space left on the volume that holds the root (Capture One's own "Space Left"
   * line, from the founder's reference screenshot). Null when the folder does not
   * exist yet — a chosen path is stored before it is ever written into, and a
   * missing folder is not an error, it just has no number to show.
   */
  async function freeBytesOf(path) {
    try {
      const stats = await statfs(path)
      return Number(stats.bavail) * Number(stats.bsize)
    } catch {
      return null
    }
  }

  async function libraryState() {
    const custom = await chosenFolder()
    const resolved = custom !== null ? expandFolder(custom) : desktopFolder()
    return {
      path: custom,
      root: resolved,
      source: custom !== null ? 'custom' : 'desktop',
      // Whether the OS dialog behind the clickable path can run on this host, so the
      // browser half knows when the path is a button and when it is only text.
      canChoose: folders.canChoose === true,
      freeBytes: await freeBytesOf(resolved),
    }
  }

  async function writeLibraryFile(path) {
    await writeChosenFolder(root.root, path)
  }

  /**
   * GET answers the state. POST takes three shapes: `{ path }` stores a typed folder
   * (`null` goes back to the Desktop default), `{ action: 'choose' }` opens the OS
   * folder dialog starting at the current root and stores what came back, and
   * `{ action: 'reveal' }` opens the current root in the file browser (founder:
   * *"click on icon to open finder"*). A cancelled dialog answers the unchanged
   * state — cancelling is not an error.
   */
  const libraryRoute = async (req, res) => {
    const method = (req.method || 'GET').toUpperCase()
    if (method === 'GET') {
      send(res, 200, await libraryState())
      return
    }
    if (method !== 'POST') {
      methodNotAllowed(res, 'GET, POST')
      return
    }
    const body = await readJsonBody(req)
    if (body === undefined) {
      send(res, 400, { error: 'bad-request', detail: 'a JSON body is required' })
      return
    }
    if (body.action === 'reveal') {
      // With `file`, this is the finished run's own control: select that file in
      // Finder (founder, 2026-09-23: *"Open the image opens in browser, but its more
      // useful to open in finder"*). Without it, reveal the current root (the Save
      // folder row's arrow). The file is validated as an absolute path but not
      // contained to the root: the save folder may have been re-pointed since that
      // file was written, and revealing a path does not write one.
      const file = typeof body.file === 'string' ? body.file.trim() : null
      if (file !== null) {
        const absolute = file.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(file)
        if (file === '' || file.length > 4096 || file.includes('\0') || !absolute) {
          send(res, 400, { error: 'bad-path', detail: 'an absolute file path' })
          return
        }
        try {
          await folders.revealFile(file)
          send(res, 200, { ok: true })
        } catch (error) {
          send(res, 500, { error: 'reveal-failed', detail: String((error && error.message) || error) })
        }
        return
      }
      try {
        await folders.reveal((await libraryState()).root)
        send(res, 200, { ok: true })
      } catch (error) {
        send(res, 500, { error: 'reveal-failed', detail: String((error && error.message) || error) })
      }
      return
    }
    if (body.action === 'choose') {
      if (folders.canChoose !== true) {
        send(res, 501, { error: 'unsupported', detail: 'this host has no folder dialog' })
        return
      }
      let picked
      try {
        picked = await folders.choose((await libraryState()).root)
      } catch (error) {
        send(res, 500, { error: 'choose-failed', detail: String((error && error.message) || error) })
        return
      }
      if (picked && picked.cancelled === true) {
        send(res, 200, await libraryState())
        return
      }
      const pickedPath = picked && typeof picked.path === 'string' ? picked.path.trim() : ''
      if (pickedPath === '' || pickedPath.length > 4096 || pickedPath.includes('\0') || !pickedPath.startsWith('/')) {
        send(res, 400, { error: 'bad-path', detail: 'the dialog answered with no absolute folder' })
        return
      }
      await writeLibraryFile(pickedPath)
      send(res, 200, await libraryState())
      return
    }
    if (body.path === null) {
      await writeLibraryFile(null)
      send(res, 200, await libraryState())
      return
    }
    const path = typeof body.path === 'string' ? body.path.trim() : ''
    const absolute = path.startsWith('/') || path.startsWith('~') || /^[a-zA-Z]:[\\/]/.test(path)
    if (path === '' || path.length > 4096 || path.includes('\0') || !absolute) {
      send(res, 400, { error: 'bad-path', detail: 'an absolute folder path, or null for the default folder' })
      return
    }
    await writeLibraryFile(path)
    send(res, 200, await libraryState())
  }

  const mount = (server) => {
    if (!server || typeof server.register !== 'function') return
    ctx.effect(() => server.register({ kind: 'exact', path: PROVIDERS_PATH, handler: list }), 'generate: providers')
    ctx.effect(() => server.register({ kind: 'prefix', path: PROVIDERS_PREFIX, handler: route }), 'generate: provider routes')
    ctx.effect(() => server.register({ kind: 'exact', path: LIBRARY_PATH, handler: libraryRoute }), 'generate: library')
  }

  const server = typeof ctx.get === 'function' ? ctx.get('webServer') : undefined
  if (server) mount(server)
  else if (typeof ctx.inject === 'function') {
    try {
      ctx.inject(['webServer'], () => mount(ctx.get('webServer')))
    } catch {
      // A profile with no web server at all: the pane reports it, nothing throws.
    }
  }

  // S3: the install. Both registrations are optional in the same way the web server
  // is — a profile without the tools or skills service still gets the routes, and a
  // missing registration is reported rather than thrown.
  const mountOptional = (name, register) => {
    if (register()) return
    if (typeof ctx.inject !== 'function') return
    try {
      ctx.inject([name], () => register())
    } catch {
      // The service never arrives in this profile. Nothing to report to a page.
    }
  }
  mountOptional('tools', () => mountTools(ctx, { base: base || runninghub.base, paths: runninghub.data(root.root), root }))
  mountOptional('skills', () => mountSkill(ctx))
}
