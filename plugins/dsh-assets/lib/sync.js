/**
 * The optional sync (epic 63 A5): the library mirrored to an S3-compatible bucket.
 *
 * OFF BY DEFAULT, AND THAT IS THE FIRST RULE. Nothing here runs unless a target has been
 * configured, and the config lives in `<profile>/assets/sync.json` — absent means off, not
 * "ask the network". A library that phoned home because it could would be a different product.
 *
 * CONTENT-ADDRESSED. The object key is derived from the bytes — `<prefix>/<aa>/<sha256>.<ext>`
 * — so the same picture uploaded twice is ONE object however it was named, however many times
 * it was picked, and whichever session it came from. That is the same rule the attachment store
 * uses (`$DSH_HOME/attachments/v1/objects/<sha[0:2]>/<sha>`), so the two are copies of one idea
 * rather than two.
 *
 * A SECOND SYNC IS A NO-OP — and it is the LEDGER that says so, not a network round trip:
 * `<profile>/assets/synced.json` records which keys this target already holds, so a re-sync
 * answers `already: true` without asking anybody. That matters because the alternative is a
 * HEAD per asset per sync, and a library of a thousand pictures should not cost a thousand
 * requests to learn that nothing changed. The ledger is keyed by the TARGET as well as the
 * content: syncing to a second bucket uploads everything once, which is the truth.
 *
 * A FAILED UPLOAD NEVER DELETES THE LOCAL COPY — there is nothing to delete, because this
 * module only ever READS the picture. That is the property stated as a rule rather than as a
 * promise: the person's file is not this module's to touch, a failure is recorded per asset,
 * and the ledger is written only after the bytes are away, so a retry re-uploads.
 *
 * THE SECRET IS NOT IN THE CONFIG FILE. The config carries an endpoint, a bucket, a region, a
 * prefix and an ACCESS KEY ID; the secret itself is a reference into the `credentials` seam,
 * the same home the Generate plugin's provider keys use, and the status route answers whether
 * one resolves rather than what it is.
 *
 * WHAT IS NOT PROVEN HERE (E3 is open). The SigV4 signer below is verified for STRUCTURE and
 * DETERMINISM — the form of the authorization header, the payload hash, and the same input
 * producing the same signature — and NOT against a live provider, because no target has been
 * ratified. The transport is a seam (`putObject`) for exactly that reason: the suite drives the
 * engine with a fake, and the day a target exists the signer's real proof is one upload.
 *
 * @module @muen/dsh-assets/lib/sync
 */
import { createHash, createHmac } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

/** Where the target lives and where the ledger of what is already there lives. */
export const SYNC_FILE = 'sync.json'
export const SYNCED_FILE = 'synced.json'
export const SYNC_SCHEMA = 'muen-assets-sync/v1'

/** A cap on the ledger, so a library that grows forever does not grow one file forever. */
const MAX_LEDGER_KEYS = 20000

/** The service every S3-compatible provider signs as. */
const SERVICE = 's3'

/** A path segment nobody can climb out of. */
function safe(part, fallback = 'x') {
  const text = String(part === undefined || part === null ? '' : part)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^[.-]+/, '')
    .replace(/[.-]+$/, '')
  return text === '' ? fallback : text
}

/** `sha256` of a buffer, hex. The content address every store in this product agrees on. */
export function sha256Hex(bytes) {
  return createHash('sha256').update(Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes || [])).digest('hex')
}

/**
 * The object key for one asset: the same bytes get the same key, always.
 *
 * The `aa/` shard is the first two hex characters, because S3-compatible stores list and
 * throttle better when keys do not all begin alike — and because it is what the attachment
 * store already does, so a person who has looked at one has seen the other.
 */
export function objectKeyFor({ prefix = '', sha256, ext = 'bin' }) {
  const head = safe(sha256, 'unhashed').slice(0, 2)
  const name = safe(sha256, 'unhashed')
  const tail = String(ext || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin'
  const parts = [String(prefix || '').replace(/^\/+|\/+$/g, ''), head, name + '.' + tail].filter((part) => part !== '')
  return parts.join('/')
}

// ── the config, and what the surface may know about it ───────────────────────

/** A target as stored: everything but the secret. */
export function normaliseConfig(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null
  if (input.enabled === false) return null
  const endpoint = String(input.endpoint || '').trim()
  const bucket = String(input.bucket || '').trim()
  const region = String(input.region || '').trim() || 'auto'
  const accessKeyId = String(input.accessKeyId || '').trim()
  if (endpoint === '' || bucket === '' || accessKeyId === '') return null
  if (!/^https?:\/\//.test(endpoint)) return null
  return {
    schema: SYNC_SCHEMA,
    enabled: true,
    endpoint: endpoint.replace(/\/+$/, ''),
    bucket,
    region,
    accessKeyId,
    prefix: String(input.prefix || 'mitsu').replace(/^\/+|\/+$/g, '') || 'mitsu',
    // The secret is a REFERENCE, never a value: the credentials seam holds it.
    secretRef: String(input.secretRef || 'MITSU_S3_SECRET').trim(),
    // Path-style addressing is what MinIO and most self-hosted targets want; a provider that
    // wants virtual-host style gets it by saying so.
    pathStyle: input.pathStyle !== false,
  }
}

/** What a surface is allowed to know: the target, never the secret. */
export function publicConfig(config) {
  if (config === null) return { enabled: false }
  return {
    enabled: true,
    endpoint: config.endpoint,
    bucket: config.bucket,
    region: config.region,
    prefix: config.prefix,
    accessKeyId: config.accessKeyId,
    secretRef: config.secretRef,
    pathStyle: config.pathStyle,
  }
}

/** The target as stored, or `null` when sync is off (which includes "no file"). */
export async function readSyncConfig(root, { readText = readFile } = {}) {
  try {
    const parsed = JSON.parse(await readText(join(root, SYNC_FILE), 'utf8'))
    return normaliseConfig(parsed)
  } catch {
    return null
  }
}

/** Store the target, or turn sync off with `null`. */
export async function writeSyncConfig(root, config, { makeDir = mkdir, writeText = writeFile } = {}) {
  await makeDir(root, { recursive: true })
  const body = config === null ? { schema: SYNC_SCHEMA, enabled: false } : config
  await writeText(join(root, SYNC_FILE), JSON.stringify(body, null, 2) + '\n', 'utf8')
  return body
}

// ── the ledger of what the target already holds ──────────────────────────────

/** One key per target, so a second bucket uploads everything once. */
export function ledgerId(config) {
  return sha256Hex(Buffer.from(config.endpoint + '\n' + config.bucket + '\n' + config.prefix)).slice(0, 16)
}

export async function readLedger(root, { readText = readFile } = {}) {
  try {
    const parsed = JSON.parse(await readText(join(root, SYNCED_FILE), 'utf8'))
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { schema: SYNC_SCHEMA, targets: {} }
    return { schema: SYNC_SCHEMA, targets: parsed.targets && typeof parsed.targets === 'object' ? parsed.targets : {} }
  } catch {
    return { schema: SYNC_SCHEMA, targets: {} }
  }
}

export async function writeLedger(root, ledger, { makeDir = mkdir, writeText = writeFile } = {}) {
  await makeDir(root, { recursive: true })
  await writeText(join(root, SYNCED_FILE), JSON.stringify(ledger, null, 2) + '\n', 'utf8')
  return ledger
}

/** Record one key against one target. The ledger is capped: an old shard is dropped whole. */
export function rememberKey(ledger, id, key) {
  const targets = { ...(ledger.targets || {}) }
  const keys = Array.isArray(targets[id]) ? targets[id].slice() : []
  if (!keys.includes(key)) keys.push(key)
  targets[id] = keys.length > MAX_LEDGER_KEYS ? keys.slice(keys.length - MAX_LEDGER_KEYS) : keys
  return { schema: SYNC_SCHEMA, targets }
}

export function ledgerHas(ledger, id, key) {
  const keys = ledger.targets && Array.isArray(ledger.targets[id]) ? ledger.targets[id] : []
  return keys.includes(key)
}

// ── the transport: SigV4, the way every S3-compatible provider wants it ──────

const hmac = (key, data) => createHmac('sha256', key).update(data).digest()
const hex = (buffer) => Buffer.from(buffer).toString('hex')

/** `20260926T055959Z` and `20260926`, from one timestamp. */
export function amzDates(at = new Date()) {
  const iso = new Date(at).toISOString().replace(/[:-]|\.\d{3}/g, '')
  return { amzDate: iso, shortDate: iso.slice(0, 8) }
}

/**
 * The AWS Signature Version 4 headers for one request.
 *
 * THE CANONICAL REQUEST IS THE WHOLE ALGORITHM: the method, the URI, the query in sorted order,
 * the signed headers lower-cased and sorted, and the payload's own hash, each on its own line.
 * Two things about it are easy to get subtly wrong and are therefore explicit here: the URI is
 * encoded twice (once by the caller, once by the canonicaliser) and `host` is always signed.
 */
export function signedHeaders({ method = 'PUT', url, region, accessKeyId, secretAccessKey, payload = Buffer.alloc(0), at = new Date(), extraHeaders = {} } = {}) {
  const target = new URL(url)
  const payloadHash = sha256Hex(payload)
  const { amzDate, shortDate } = amzDates(at)
  const headers = { host: target.host, 'x-amz-content-sha256': payloadHash, 'x-amz-date': amzDate }
  for (const [name, value] of Object.entries(extraHeaders)) headers[String(name).toLowerCase()] = String(value)

  const names = Object.keys(headers).sort()
  const canonicalHeaders = names.map((name) => name + ':' + headers[name].trim() + '\n').join('')
  const signedNames = names.join(';')
  const canonicalQuery = [...target.searchParams.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([name, value]) => encodeURIComponent(name) + '=' + encodeURIComponent(value))
    .join('&')
  // The canonical URI is encoded TWICE in AWS's own examples — the caller encodes the key, and
  // the canonicaliser encodes what it was given — which is why `objectUrl` already escaped each
  // segment and nothing escapes it again here.
  const canonicalRequest = [method.toUpperCase(), target.pathname, canonicalQuery, canonicalHeaders, signedNames, payloadHash].join('\n')

  const scope = shortDate + '/' + region + '/' + SERVICE + '/aws4_request'
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256Hex(Buffer.from(canonicalRequest, 'utf8'))].join('\n')
  const signingKey = hmac(hmac(hmac(hmac('AWS4' + secretAccessKey, shortDate), region), SERVICE), 'aws4_request')
  const signature = hex(hmac(signingKey, stringToSign))

  return {
    ...headers,
    authorization: 'AWS4-HMAC-SHA256 Credential=' + accessKeyId + '/' + scope + ', SignedHeaders=' + signedNames + ', Signature=' + signature,
    signature,
    canonicalRequest,
    stringToSign,
    payloadHash,
  }
}

/** The URL one object is written to, under path-style or virtual-host addressing. */
export function objectUrl(config, key) {
  const encoded = String(key).split('/').map((segment) => encodeURIComponent(segment)).join('/')
  if (config.pathStyle) return config.endpoint + '/' + encodeURIComponent(config.bucket) + '/' + encoded
  const target = new URL(config.endpoint)
  return target.protocol + '//' + config.bucket + '.' + target.host + '/' + encoded
}

/**
 * Put one object. The default transport is a signed PUT; a test injects its own.
 *
 * The answer is small and total: `{ ok: true }`, or `{ ok: false, error, detail }` where the
 * error is a word a surface can say out loud — `unreachable`, `http-403`, `timeout`.
 */
export async function putObject({ config, secretAccessKey, key, bytes, contentType = 'application/octet-stream', fetchImpl = fetch, timeoutMs = 30000, at = new Date() } = {}) {
  const url = objectUrl(config, key)
  const headers = signedHeaders({ method: 'PUT', url, region: config.region, accessKeyId: config.accessKeyId, secretAccessKey, payload: bytes, at, extraHeaders: { 'content-type': contentType } })
  let response
  try {
    response = await fetchImpl(url, {
      method: 'PUT',
      headers: {
        authorization: headers.authorization,
        'content-type': contentType,
        'x-amz-content-sha256': headers['x-amz-content-sha256'],
        'x-amz-date': headers['x-amz-date'],
      },
      body: bytes,
      signal: typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(timeoutMs) : undefined,
    })
  } catch (error) {
    const kind = error && error.name
    return { ok: false, error: kind === 'TimeoutError' || kind === 'AbortError' ? 'timeout' : 'unreachable', detail: String((error && error.message) || error) }
  }
  if (!response || response.ok !== true) {
    return { ok: false, error: 'http-' + String((response && response.status) || 0), detail: 'the target refused the upload' }
  }
  return { ok: true, key, url }
}

// ── the engine ───────────────────────────────────────────────────────────────

/** The extension an object is filed under: the asset's own, or the content type's. */
export function extFor(ext) {
  const text = String(ext || '').toLowerCase()
  if (text === 'jpeg' || text === 'jpg') return 'jpg'
  return /^[a-z0-9]{2,5}$/.test(text) ? text : 'bin'
}

/**
 * Sync one asset's bytes.
 *
 * Reads the file (never writes it), hashes it, asks the LEDGER whether this target already
 * holds that key, and uploads only when it does not. The ledger is written only AFTER the bytes
 * are away, so a failure leaves both the picture and the record of what is synced exactly as
 * they were — which is what makes a retry a retry rather than a guess.
 *
 * @returns {Promise<{ already: boolean, uploaded: boolean, key: string, sha256: string, bytes: number, error?: string, detail?: string }>}
 */
export async function syncAsset({
  root,
  config,
  path,
  ext,
  secretAccessKey,
  readBytes = readFile,
  fetchImpl = fetch,
  ledger = null,
  writeLedgerImpl = writeLedger,
  at = new Date(),
} = {}) {
  if (config === null) return { already: false, uploaded: false, key: '', sha256: '', bytes: 0, error: 'disabled', detail: 'no sync target is configured' }
  let bytes
  try {
    bytes = await readBytes(path)
  } catch (error) {
    return { already: false, uploaded: false, key: '', sha256: '', bytes: 0, error: 'unreadable', detail: String((error && error.message) || error) }
  }
  const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes)
  const sha256 = sha256Hex(buffer)
  const key = objectKeyFor({ prefix: config.prefix, sha256, ext: extFor(ext) })
  const id = ledgerId(config)
  const state = ledger === null ? await readLedger(root) : ledger
  if (ledgerHas(state, id, key)) return { already: true, uploaded: false, key, sha256, bytes: buffer.length }

  const sent = await putObject({ config, secretAccessKey, key, bytes: buffer, fetchImpl, at })
  if (sent.ok !== true) return { already: false, uploaded: false, key, sha256, bytes: buffer.length, error: sent.error, detail: sent.detail }
  // The ledger gains the key only now. A crash between the PUT and this line costs one
  // re-upload of bytes that are content-addressed, which is the harmless direction to fail.
  await writeLedgerImpl(root, rememberKey(state, id, key))
  return { already: false, uploaded: true, key, sha256, bytes: buffer.length }
}
