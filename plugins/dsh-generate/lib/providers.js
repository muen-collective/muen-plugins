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
 * WHAT A PROVIDER OWNS: its id and label, the credential reference its key lives
 * under, the account page a person manages that key at, how to read the account a key
 * opens (which is how a key is validated before it is stored), where its own data
 * lives under the plugin root, and how to list and read its workflows.
 *
 * RunningHub is the first and only one today. Krea and Comfy Cloud are the reason
 * this file exists: each becomes one object here, and nothing in the router, the
 * settings page or the pane has to learn a new shape.
 *
 * @module @muen/dsh-generate/lib/providers
 */
import { listAdapters, readAdapter } from './adapter.js'
import { dataPaths } from './paths.js'

/** One key-validation call, which is also one balance read. */
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
 * RunningHub: the provider this plugin was built for.
 *
 * A plain membership key can list and run AI Apps and ComfyUI Workflows; only the
 * Model API and LLM need an enterprise key, so a hobby account works here.
 */
export const runninghub = {
  id: 'runninghub',
  label: 'RunningHub',
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
  accountUrl: 'https://www.runninghub.ai/call-api/bill-task?tab=keys',

  /**
   * One account read. Outcomes are kept apart on purpose:
   *
   *   { account }                 the key works
   *   { error: 'invalid-key' }    the provider answered and said no
   *   { error: 'unreachable' | 'timeout' | 'unexpected-response' | 'http-<n>' }
   *                               no answer, or one this code cannot read
   *
   * A network failure never masquerades as a bad key, and a bad key is never blamed
   * on the network: the surface can say which one happened.
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

  /** This provider's own data, under the plugin's root: one directory per provider. */
  data(root) {
    return dataPaths(root, this.id)
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

/** Every provider this build speaks to, in the order the surfaces show them. */
export const PROVIDERS = [runninghub]

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
