/**
 * The providers this plugin speaks to.
 *
 * ONE PLUGIN, SEVERAL PROVIDERS (founder, 2026-09-22: *"we need to rethink the
 * generate plugin to be able to use different providers, it should work like the
 * providers settings"*). Settings → Models → Providers is one page listing many
 * providers; Generate works the same way — one plugin, one settings page, one pane,
 * and a provider is an object in this file.
 *
 * WHY NOT A PLUGIN PER PROVIDER, measured the same day:
 *
 *   1. `settings.section` is a LIST slot — one page per registrant — so a plugin per
 *      provider would put a second (and third) Generate page in Settings, and reusing
 *      our id would REPLACE our page instead of adding to it;
 *   2. a third-party client plugin cannot declare its own slot (the client `slots`
 *      service exposes `register`, `registerFactory` and `inject` only), so "one page
 *      that several plugins contribute to" has no seam in this harness today.
 *
 * WHAT A PROVIDER OWNS: its id and label, the family it belongs to (`kind`, which is
 * all the settings page needs to order the list Image first and Workflows second),
 * the credential reference its key lives under, the account page that issues that
 * key, the page a person manages the account at, the prompt that installs one of its
 * workflows, how to read the account a key opens (which is how a key is validated
 * before it is stored), where its own data lives under the plugin root, and how to
 * list and read its workflows.
 *
 * FOUR PROVIDERS, IN THE ORDER THE SURFACES SHOW THEM (founder, 2026-09-23: *"add
 * image provider, then RunningHub … I have accounts at Krea API and I can make
 * account Magnific for 1 month to test … I also have account Comfy Cloud"*):
 *
 *   krea         image      https://api.krea.ai
 *   magnific     image      https://api.magnific.com
 *   runninghub   workflow   https://www.runninghub.ai
 *   comfycloud   workflow   https://cloud.comfy.org
 *
 * EACH KEY CHECK IS ONE CHEAP AUTHENTICATED READ, researched 2026-09-23 and cited on
 * the provider itself. Two facts shaped the contract:
 *
 *   - only RunningHub can report a balance. Krea, Magnific and Comfy Cloud publish no
 *     account endpoint at all (Krea's own docs: *"There is no public endpoint for
 *     checking your balance programmatically"*), so `account` is whatever the check
 *     could read and the surface must not promise a number it cannot get;
 *   - a provider may answer about the key without accepting it, in which case the key
 *     is real but unverified. Magnific answers `403` with an undocumented body, and
 *     Comfy Cloud answers `429` for a key whose subscription is inactive. Both are
 *     stored — the founder's rule, 2026-09-23: *"store it and mark it unverified"* —
 *     and the row says which of the two happened rather than calling a real key bad.
 *
 * WHAT A CHECK MAY ANSWER, one shape for every provider:
 *
 *   { account }                 the provider answered about this key; store it
 *   { unverified: true, note }  the key could not be checked; store it, say so
 *   { error: 'invalid-key' }    the provider answered and said no; store nothing
 *   { error: 'unreachable' | 'timeout' | 'unexpected-response' | 'http-<n>' }
 *                               no answer, or one this code cannot read; store nothing
 *
 * @module @muen/dsh-generate/lib/providers
 */
import { listAdapters, readAdapter } from './adapter.js'
import { dataPaths } from './paths.js'

/** One key check: long enough for a cold API, short enough to fail at the field. */
const TIMEOUT_MS = 15000

function str(value) {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null
}

function num(value) {
  if (value === undefined || value === null || value === '') return null
  const parsed = typeof value === 'number' ? value : Number(String(value).trim())
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * Every space a paste can carry, the Unicode ones included: a browser clipboard brings
 * back a non-breaking space or a zero-width space often enough that the field has met
 * one. No API key contains a space, so these are removed rather than refused.
 */
const PASTE_SPACE = /[\s\u00a0\u1680\u2000-\u200b\u2028\u2029\u202f\u205f\u3000\ufeff]/g

/**
 * What a pasted key has to be before it can be sent at all.
 *
 * MEASURED 2026-09-23 in the app's own runtime: `fetch` THROWS on a header value that
 * carries a line break or a character above U+00FF — a key copied out of a chat
 * message, with a smart quote in it, is enough. The throw was caught and reported as
 * `unreachable`, so the pane blamed the network for a key that never left the
 * machine. So the value is settled before it is sent: the spaces and line breaks a
 * paste drags along are removed (no API key contains one, and a key wrapped over two
 * lines is the real key once joined), and whatever is left that the wire cannot carry
 * is refused by name instead of being sent. The same rule applies to every provider,
 * because the header is the same everywhere.
 *
 * @returns {{ key: string } | { error: 'key-required' | 'key-characters' }}
 */
export function normalizeKey(raw) {
  const stripped = String(raw === undefined || raw === null ? '' : raw).replace(PASTE_SPACE, '')
  if (stripped === '') return { error: 'key-required' }
  for (const character of stripped) {
    const code = character.codePointAt(0)
    const control = code < 0x20 || code === 0x7f
    if (control || code > 0xff) return { error: 'key-characters' }
  }
  return { key: stripped }
}

/**
 * One authenticated GET, judged the same way for every provider.
 *
 * The two failures are kept apart on purpose: a network failure never masquerades as
 * a bad key, and a bad key is never blamed on the network. A body that is not JSON is
 * not an error here — the caller decides, because "not JSON" is an unexpected answer
 * for one provider and impossible for another.
 *
 * @returns {{ status: number, ok: boolean, payload: unknown } | { error: 'timeout' | 'unreachable' }}
 */
async function getJson(url, headers, { timeoutMs = TIMEOUT_MS, fetchImpl = fetch } = {}) {
  let response
  try {
    response = await fetchImpl(url, {
      method: 'GET',
      headers: { Accept: 'application/json', ...headers },
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (error) {
    const kind = error && error.name
    return { error: kind === 'TimeoutError' || kind === 'AbortError' ? 'timeout' : 'unreachable' }
  }
  let payload = null
  try {
    payload = JSON.parse(await response.text())
  } catch {
    payload = null
  }
  return { status: response.status, ok: response.ok, payload }
}

/**
 * The three things every provider does the same way: where its own data lives, what
 * it has installed, and how one of those is read.
 *
 * Takes the id rather than reading it off `this`: a provider is assembled from this
 * helper at module load, and passing the id keeps `this` out of the data paths.
 */
function adapterBacked(id) {
  return {
    /** This provider's own data, under the plugin's root: one directory per provider. */
    data(root) {
      return dataPaths(root, id)
    },

    /** The installed workflows of this provider: the list a card is drawn from. */
    listWorkflows({ dir }) {
      return listAdapters(dir)
    },

    /** One workflow, whole: the doors a surface renders. */
    readWorkflow({ dir, name }) {
      return readAdapter(dir, name)
    },
  }
}

/**
 * The account as RunningHub reports it. Field names are the API's, values are
 * normalized, and nothing else from the response is kept.
 * @see https://www.runninghub.ai/runninghub-api-doc-en/api-425761030
 */
function accountOf(data) {
  const raw = data && typeof data === 'object' ? data : {}
  return {
    coins: num(raw.remainCoins),
    money: num(raw.remainMoney),
    currency: str(raw.currency),
    running: num(raw.currentTaskCounts),
    apiType: str(raw.apiType),
  }
}

/**
 * RunningHub: the provider this plugin was built for, and the only one that can say
 * what a key is worth.
 *
 * A plain membership key can list and run AI Apps and ComfyUI Workflows; only the
 * Model API and LLM need an enterprise key, so a hobby account works here.
 */
export const runninghub = {
  id: 'runninghub',
  label: 'RunningHub',
  /** What this provider makes. The settings page orders Image before Workflows. */
  kind: 'workflow',
  /** The credential reference. A `CredentialRef` is the environment-variable-name
   * half of the credentials seam, so this string is also the name a person may
   * already have set — which is the point (epic 61 D1). */
  keyRef: 'RH_API_KEY',
  base: 'https://www.runninghub.ai',
  accountPath: '/uc/openapi/accountStatus',
  /**
   * One page, two jobs: the key list is there (`tab=keys`) and so is the billing
   * balance (`bill-task`). No separate billing deep link is published, and inventing
   * one would be worse than landing the person on the page that has both.
   */
  keyUrl: 'https://www.runninghub.ai/call-api/bill-task?tab=keys',
  keyPageLabel: 'API → Keys',
  accountUrl: 'https://www.runninghub.ai/call-api/bill-task',
  /**
   * How one of this provider's workflows is installed: the sentence the user says to
   * the agent. A plugin cannot type into the composer and neither can a slash command
   * start a turn (measured 2026-09-22), so the surface shows this and the
   * `add-rh-workflow` skill does the work.
   */
  addPrompt: 'add this RunningHub workflow <app link>',

  /**
   * One account read. `code: 0` is the API's yes; a non-zero code is its no. The
   * outcomes are the shared four above.
   */
  async account({ base = this.base, key, timeoutMs = TIMEOUT_MS, fetchImpl = fetch } = {}) {
    let response
    try {
      response = await fetchImpl(base + this.accountPath, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({ apikey: key }),
        signal: AbortSignal.timeout(timeoutMs),
      })
    } catch (error) {
      const kind = error && error.name
      return { error: kind === 'TimeoutError' || kind === 'AbortError' ? 'timeout' : 'unreachable' }
    }
    let payload = null
    try {
      payload = JSON.parse(await response.text())
    } catch {
      payload = null
    }
    if (payload === null || typeof payload.code !== 'number') {
      return { error: response.ok ? 'unexpected-response' : 'http-' + response.status }
    }
    if (payload.code !== 0) return { error: 'invalid-key' }
    return { account: accountOf(payload.data) }
  },

  ...adapterBacked('runninghub'),
}

/**
 * Krea: the image provider, and the first one whose key proves itself by listing.
 *
 * THE CHECK IS `GET /jobs` (docs: *"Returns jobs belonging to the authenticated
 * user"*), the cheapest authenticated read the API has. It is also the ONLY thing
 * that can be checked: researched 2026-09-23, the 117-path spec has no `/me`,
 * `/account`, `/credits`, `/balance` or `/keys` route — all five answer 404 — the
 * official SDK exposes no account call, and the docs say outright that balance
 * *"cannot be read programmatically"*. So `account` carries what the read proves and
 * nothing is invented.
 *
 * Reading jobs is not billed: the docs bill completed generations, not reads.
 */
export const krea = {
  id: 'krea',
  label: 'Krea',
  kind: 'image',
  keyRef: 'KREA_API_KEY',
  base: 'https://api.krea.ai',
  keyUrl: 'https://www.krea.ai/settings/api-tokens',
  keyPageLabel: 'API tokens',
  /** Where the API balance is topped up. The docs call it a separate USD balance from
   * the app's own compute units, so this is the page that matters for a run. */
  accountUrl: 'https://www.krea.ai/app/api',
  addPrompt: 'add this Krea model <model name>',

  async account({ base = this.base, key, timeoutMs = TIMEOUT_MS, fetchImpl = fetch } = {}) {
    const read = await getJson(base + '/jobs', { Authorization: `Bearer ${key}` }, { timeoutMs, fetchImpl })
    if (read.error) return { error: read.error }
    // 401 for a missing, malformed or revoked key. The spec says the body is
    // `{ error }` while the live API answers `{ message: "Unauthorized" }`, so the
    // status decides and the body is never read for it.
    if (read.status === 401) return { error: 'invalid-key' }
    if (!read.ok) return { error: 'http-' + read.status }
    if (!read.payload || !Array.isArray(read.payload.items)) return { error: 'unexpected-response' }
    return { account: { jobs: read.payload.items.length } }
  },

  ...adapterBacked('krea'),
}

/**
 * Magnific: the image enhancer.
 *
 * THE CHECK IS `GET /v1/creations/recent?per_page=1` — the one read the docs say
 * *"does not consume credits"*, and the only free call that resolves identity from
 * the key. Researched 2026-09-23: no balance, credits or plan endpoint exists in the
 * 360-path spec, so this provider can never report a number.
 *
 * 401 IS "BAD KEY"; 403 IS NOT. The spec references a `403-forbidden` response
 * component it never defines, so a 403 has no documented meaning: it may be a valid
 * key without API entitlement. Calling that key invalid would be a guess, and
 * throwing it away would lose a key the user owns, so it is stored and the row says
 * it was not checked.
 */
export const magnific = {
  id: 'magnific',
  label: 'Magnific',
  kind: 'image',
  keyRef: 'MAGNIFIC_API_KEY',
  base: 'https://api.magnific.com',
  keyUrl: 'https://www.magnific.com/user/organization/api-keys',
  keyPageLabel: 'API keys',
  /** No billing page is documented well enough to link: every dashboard URL the docs
   * cite answers 403 to a non-browser client, so the card links the key page only. */
  accountUrl: null,
  addPrompt: 'add this Magnific tool <tool name>',

  async account({ base = this.base, key, timeoutMs = TIMEOUT_MS, fetchImpl = fetch } = {}) {
    const read = await getJson(
      base + '/v1/creations/recent?per_page=1',
      { 'x-magnific-api-key': key },
      { timeoutMs, fetchImpl },
    )
    if (read.error) return { error: read.error }
    if (read.status === 401) return { error: 'invalid-key' }
    if (read.status === 403) return { unverified: true, note: 'not-entitled' }
    if (!read.ok) return { error: 'http-' + read.status }
    if (!read.payload || !Array.isArray(read.payload.data)) return { error: 'unexpected-response' }
    const first = read.payload.data[0]
    return { account: { userId: first ? num(first.user_id) : null } }
  },

  ...adapterBacked('magnific'),
}

/**
 * Comfy Cloud: the hosted ComfyUI, and the second workflow provider.
 *
 * THE CHECK IS `GET /api/user` with `X-API-Key` — documented as *"information about
 * the currently authenticated user"*, and the only account route the v1 spec has.
 * Researched 2026-09-23: `/api/me`, `/api/credits` and `/api/org` do not exist, and
 * the documented body is `{ status }` alone.
 *
 * 429 IS NOT A BAD KEY. The v1 docs give it one meaning — *"the API key is on an
 * inactive subscription"* — which means the key is real. It is stored, and the row
 * says the subscription is what is missing: a v2 job submission would still fail, so
 * saying "linked" without that note would be the lie.
 */
export const comfycloud = {
  id: 'comfycloud',
  label: 'Comfy Cloud',
  kind: 'workflow',
  keyRef: 'COMFY_CLOUD_API_KEY',
  base: 'https://cloud.comfy.org',
  keyUrl: 'https://platform.comfy.org/profile/api-keys',
  keyPageLabel: 'API keys',
  /** Subscription and credits live in the platform console, which is where the key
   * page is and the only Comfy-owned URL the docs cite for an account. */
  accountUrl: 'https://platform.comfy.org',
  addPrompt: 'add this Comfy Cloud workflow <workflow file>',

  async account({ base = this.base, key, timeoutMs = TIMEOUT_MS, fetchImpl = fetch } = {}) {
    const read = await getJson(base + '/api/user', { 'X-API-Key': key }, { timeoutMs, fetchImpl })
    if (read.error) return { error: read.error }
    if (read.status === 401) return { error: 'invalid-key' }
    if (read.status === 429) return { account: { status: 'inactive' }, note: 'subscription-inactive' }
    if (!read.ok) return { error: 'http-' + read.status }
    const status = read.payload ? str(read.payload.status) : null
    if (status === null) return { error: 'unexpected-response' }
    return { account: { status } }
  },

  ...adapterBacked('comfycloud'),
}

/**
 * Every provider this build speaks to, in the order the surfaces show them:
 * the image providers first, then the workflow providers (founder, 2026-09-23).
 */
export const PROVIDERS = [krea, magnific, runninghub, comfycloud]

/**
 * One provider by id, or null.
 *
 * The id arrives from the page, so an unknown one is a normal answer rather than an
 * exception: the router turns it into a 404 that names what it did not find.
 */
export function providerById(id) {
  const wanted = str(id)
  if (wanted === null) return null
  return PROVIDERS.find((provider) => provider.id === wanted) || null
}
