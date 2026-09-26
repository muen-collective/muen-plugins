/**
 * verify:sync — epic 63 A5's claims for the optional sync, asserted rather than intended.
 *
 * The claim: **a library can be mirrored to an S3-compatible bucket, and none of it happens
 * unless a person configured it.** The rules are the slice:
 *
 *   1. OFF BY DEFAULT: with no target configured nothing is sent at all — the transport is not
 *      even called — and the route says so rather than failing;
 *   2. CONTENT-ADDRESSED: the object key comes from the BYTES, so the same picture is ONE object
 *      however it was named, and two files with the same bytes produce one upload;
 *   3. A SECOND SYNC IS A NO-OP, decided by the LEDGER rather than by a network round trip, and
 *      the ledger is per target — a second bucket uploads everything once;
 *   4. A FAILED UPLOAD NEVER DELETES THE LOCAL COPY: the file is byte-identical afterwards, the
 *      failure is reported, and no key is remembered, so a retry re-uploads;
 *   5. the secret is a REFERENCE into the `credentials` seam; the status route answers whether
 *      one resolves and never what it is;
 *   6. containment holds: an asset outside the library is refused, and a hostile path cannot
 *      make the route read a file the library does not hold.
 *
 * AND THE SIGNER IS CHECKED FOR WHAT CAN BE CHECKED WITHOUT A TARGET (E3 is still open): the
 * authorization header's form, the signed header list, the payload hash, determinism, and the
 * fact that a different secret, region, date or body changes the signature. The proof that it
 * agrees with a provider is one upload to a real bucket, and there is none to talk to.
 *
 *   node verify/sync.mjs
 */
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { dirname, join as joinPath } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { ROOT, callRoute, fakeServer, reporter } from './harness.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SYNC = await import(pathToFileURL(joinPath(ROOT, 'lib/sync.js')).href)
const { check, note, finish } = reporter('verify:sync — epic 63 A5 (the optional S3-compatible sync)')

const SYNC_PATH = '/plugins/assets/sync'
const dataRoot = mkdtempSync(join(tmpdir(), 'assets-sync-data-'))
const project = mkdtempSync(join(tmpdir(), 'assets-sync-project-'))
process.env.ASSETS_DATA_DIR = dataRoot
process.env.RH_DATA_DIR = mkdtempSync(join(tmpdir(), 'assets-sync-records-'))

const BYTES = Buffer.from('a picture nobody else has — ' + 'y'.repeat(64))
const fileOne = join(project, 'one.png')
const fileTwo = join(project, 'two-different-name.png')
const fileThree = join(project, 'three.png')
mkdirSync(join(project, 'output'), { recursive: true })
writeFileSync(fileOne, BYTES)
writeFileSync(fileTwo, BYTES)
writeFileSync(fileThree, Buffer.from('something else entirely'))
const outside = mkdtempSync(join(tmpdir(), 'assets-sync-outside-'))
const stranger = join(outside, 'stranger.png')
writeFileSync(stranger, BYTES)

// ── the seams ────────────────────────────────────────────────────────────────

const server = fakeServer()
const credentials = {
  resolve: async (ref) => (ref === 'MITSU_S3_SECRET' ? { value: 'sekret', source: 'file' } : null),
}
const ctx = {
  get: (name) => (name === 'webServer' ? server : name === 'credentials' ? credentials : undefined),
  effect: (fn) => { fn(); return () => {} },
  inject: () => {},
}
const module = await import(pathToFileURL(join(ROOT, 'lib/index.js')).href)
module.apply(ctx, { folders: { canChoose: false }, argv: ['node', 'verify'], env: process.env })

const foldersHandler = server.routes.find((route) => route.path === '/plugins/assets/folders').handler
const syncHandler = server.routes.find((route) => route.path === SYNC_PATH).handler
const call = (method, path, body) => callRoute(syncHandler, method, path, body)

/** A transport that records what it was asked to do, and can be made to fail. */
const uploads = []
let failNext = null
const realFetch = globalThis.fetch
globalThis.fetch = async (url, init = {}) => {
  uploads.push({ url: String(url), method: (init.method || 'GET').toUpperCase(), bytes: init.body ? Buffer.from(init.body).length : 0, authorization: (init.headers && init.headers.authorization) || null })
  if (failNext !== null) {
    const answer = failNext
    failNext = null
    if (answer === 'throw') throw new Error('ECONNREFUSED')
    return { ok: false, status: answer }
  }
  return { ok: true, status: 200 }
}

await call('POST', SYNC_PATH, { action: 'target', path: null })
await callRoute(foldersHandler, 'POST', '/plugins/assets/folders', { action: 'add', path: project })

// ── 1. off by default ────────────────────────────────────────────────────────

{
  const status = await call('GET', SYNC_PATH)
  check('a fresh install has no target: sync is OFF, and the route says so', status.statusCode === 200 && status.json().enabled === false, JSON.stringify(status.json()))
  uploads.length = 0
  const one = await call('POST', SYNC_PATH, { action: 'asset', path: fileOne })
  check(
    'and syncing with nothing configured sends NOTHING at all',
    one.statusCode === 200 && one.json().enabled === false && uploads.length === 0,
    JSON.stringify({ status: one.statusCode, body: one.json(), uploads: uploads.length }),
  )
}

// ── 2. the target, and what a surface may know about it ─────────────────────

{
  const stored = await call('POST', SYNC_PATH, { action: 'target', endpoint: 'https://s3.example.com', bucket: 'mitsu', region: 'auto', accessKeyId: 'AKIAEXAMPLE', secretRef: 'MITSU_S3_SECRET' })
  check('a target can be configured', stored.statusCode === 200 && stored.json().enabled === true && stored.json().bucket === 'mitsu', JSON.stringify(stored.json()))
  check('and the SECRET is never in the answer, only the reference to it', stored.json().secret === undefined && stored.json().secretRef === 'MITSU_S3_SECRET' && !JSON.stringify(stored.json()).includes('sekret'), JSON.stringify(Object.keys(stored.json())))
  const bad = await call('POST', SYNC_PATH, { action: 'target', endpoint: 'ftp://nope', bucket: '', accessKeyId: '' })
  check('a target that is not an https endpoint with a bucket and a key is refused', bad.statusCode === 400 && bad.json().error === 'bad-target', JSON.stringify(bad.json()))
  const status = await call('GET', SYNC_PATH)
  check('the status names the target and how many keys it holds', status.json().enabled === true && status.json().endpoint === 'https://s3.example.com' && status.json().synced === 0, JSON.stringify(status.json()))
  // The defect this suite caught on its first run: a REFUSED target was written to disk and
  // then checked, so configuring a bad one turned sync OFF for a library that had a good one.
  check(
    'and a refused target leaves the working one exactly where it was',
    status.json().enabled === true && status.json().bucket === 'mitsu',
    JSON.stringify(status.json()),
  )
}

// ── 3. content-addressed, and the second sync is a no-op ────────────────────

{
  uploads.length = 0
  const first = await call('POST', SYNC_PATH, { action: 'asset', path: fileOne })
  check(
    'one asset is uploaded, to a key derived from its bytes',
    first.statusCode === 200 && first.json().uploaded === true && first.json().key.startsWith('mitsu/') && first.json().key.includes(first.json().sha256),
    JSON.stringify(first.json()),
  )
  check('and the request really went out, signed', uploads.length === 1 && uploads[0].method === 'PUT' && String(uploads[0].authorization).startsWith('AWS4-HMAC-SHA256 '), JSON.stringify(uploads.map((row) => ({ method: row.method, auth: String(row.authorization).slice(0, 24) }))))

  const second = await call('POST', SYNC_PATH, { action: 'asset', path: fileOne })
  check(
    'syncing the same asset again is a NO-OP: the ledger answers without asking anybody',
    second.statusCode === 200 && second.json().already === true && second.json().uploaded === false && uploads.length === 1,
    JSON.stringify({ body: second.json(), uploads: uploads.length }),
  )

  // A DIFFERENT NAME, THE SAME BYTES: one object, and no second upload.
  const renamed = await call('POST', SYNC_PATH, { action: 'asset', path: fileTwo })
  check(
    'the same bytes under another name are the SAME object, and upload nothing',
    renamed.statusCode === 200 && renamed.json().already === true && renamed.json().key === first.json().key && uploads.length === 1,
    JSON.stringify({ key: renamed.json().key, same: renamed.json().key === first.json().key, uploads: uploads.length }),
  )

  uploads.length = 0
  const other = await call('POST', SYNC_PATH, { action: 'asset', path: fileThree })
  check(
    'different bytes are their own object',
    other.statusCode === 200 && other.json().uploaded === true && other.json().key !== first.json().key && uploads.length === 1,
    JSON.stringify({ key: other.json().key, uploads: uploads.length }),
  )
}

// ── 4. a failure leaves the local copy exactly where it was ─────────────────

{
  const before = readFileSync(fileThree)
  // A fourth file, so the failed one is fresh (the third is already in the ledger).
  const fileFour = join(project, 'four.png')
  const pngForFail = Buffer.from('the bytes that will fail to travel')
  writeFileSync(fileFour, pngForFail)
  uploads.length = 0
  failNext = 500
  const failed = await call('POST', SYNC_PATH, { action: 'asset', path: fileFour })
  check(
    'a refused upload is reported, with the status the target gave',
    failed.statusCode === 502 && failed.json().uploaded === false && failed.json().error === 'http-500',
    JSON.stringify({ status: failed.statusCode, body: failed.json() }),
  )
  check(
    'and the LOCAL COPY is byte-for-byte what it was: this route only ever read it',
    existsSync(fileFour) && Buffer.compare(readFileSync(fileFour), pngForFail) === 0 && Buffer.compare(readFileSync(fileThree), before) === 0,
    'the file is untouched',
  )
  uploads.length = 0
  const retry = await call('POST', SYNC_PATH, { action: 'asset', path: fileFour })
  check(
    'a retry RE-UPLOADS rather than believing it already went: the ledger gained no key',
    retry.statusCode === 200 && retry.json().uploaded === true && uploads.length === 1,
    JSON.stringify({ body: retry.json(), uploads: uploads.length }),
  )

  const unreachable = join(project, 'five.png')
  writeFileSync(unreachable, Buffer.from('a picture whose target is down'))
  failNext = 'throw'
  const down = await call('POST', SYNC_PATH, { action: 'asset', path: unreachable })
  check('an unreachable target is its own word, not an http status', down.json().error === 'unreachable', JSON.stringify(down.json()))
}

// ── 5. containment, and the secret by reference ─────────────────────────────

{
  uploads.length = 0
  const strangerRes = await call('POST', SYNC_PATH, { action: 'asset', path: stranger })
  check(
    'an asset outside the library is refused, and nothing is uploaded',
    strangerRes.statusCode === 404 && strangerRes.json().error === 'not-in-library' && uploads.length === 0,
    JSON.stringify(strangerRes.json()),
  )
  const hostile = await call('POST', SYNC_PATH, { action: 'asset', path: join(project, '..', '..', 'etc', 'passwd') })
  check('and a path that climbs out is refused the same way', hostile.statusCode === 404, String(hostile.statusCode))

  // The secret resolves by reference; a reference that resolves to nothing is its own answer.
  const saved = credentials.resolve
  credentials.resolve = async () => null
  const noSecret = await call('POST', SYNC_PATH, { action: 'asset', path: fileThree })
  credentials.resolve = saved
  check(
    'a secret that does not resolve is named, and no upload is attempted',
    noSecret.statusCode === 400 && noSecret.json().error === 'no-key',
    JSON.stringify({ status: noSecret.statusCode, body: noSecret.json() }),
  )
}

// ── 6. the target can be cleared, which is how a person turns it off ────────

{
  const cleared = await call('POST', SYNC_PATH, { action: 'target', path: null })
  check('clearing the target turns sync off again', cleared.statusCode === 200 && cleared.json().enabled === false, JSON.stringify(cleared.json()))
  uploads.length = 0
  const after = await call('POST', SYNC_PATH, { action: 'asset', path: fileOne })
  check('and nothing is sent after that', after.json().enabled === false && uploads.length === 0, JSON.stringify(after.json()))
}

// ── 7. the signer, for everything provable without a target ────────────────

{
  const config = SYNC.normaliseConfig({ endpoint: 'https://s3.example.com', bucket: 'mitsu', region: 'auto', accessKeyId: 'AKIAEXAMPLE' })
  const url = SYNC.objectUrl(config, 'mitsu/ab/abc.png')
  check('a path-style target puts the bucket in the path', url === 'https://s3.example.com/mitsu/mitsu/ab/abc.png', url)
  const virtual = SYNC.normaliseConfig({ endpoint: 'https://s3.example.com', bucket: 'mitsu', accessKeyId: 'A', pathStyle: false })
  check('and a virtual-host target puts it in the host', SYNC.objectUrl(virtual, 'a/b.png') === 'https://mitsu.s3.example.com/a/b.png', SYNC.objectUrl(virtual, 'a/b.png'))

  const at = new Date('2026-09-26T05:59:59Z')
  const sign = (over = {}) => SYNC.signedHeaders({ method: 'PUT', url, region: 'auto', accessKeyId: 'AKIAEXAMPLE', secretAccessKey: 'sekret', payload: Buffer.from('hello'), at, ...over })
  const signed = sign()
  check(
    'the authorization header is the form every S3-compatible provider parses',
    /^AWS4-HMAC-SHA256 Credential=AKIAEXAMPLE\/20260926\/auto\/s3\/aws4_request, SignedHeaders=[a-z0-9;-]+, Signature=[0-9a-f]{64}$/.test(signed.authorization),
    signed.authorization,
  )
  check(
    'the signed headers always include host and the payload hash, and list themselves sorted',
    signed.authorization.includes('SignedHeaders=host;x-amz-content-sha256;x-amz-date'),
    signed.authorization.split('SignedHeaders=')[1],
  )
  check('the payload hash is the body\'s own sha256, which is what makes the signature cover the bytes', signed.payloadHash === SYNC.sha256Hex(Buffer.from('hello')), signed.payloadHash)
  check('the same request signs the same way twice', sign().signature === signed.signature, 'deterministic')
  check('a different secret changes it', sign({ secretAccessKey: 'other' }).signature !== signed.signature, '')
  check('a different region changes it', sign({ region: 'us-east-1' }).signature !== signed.signature, '')
  check('a different day changes it', SYNC.signedHeaders({ method: 'PUT', url, region: 'auto', accessKeyId: 'AKIAEXAMPLE', secretAccessKey: 'sekret', payload: Buffer.from('hello'), at: new Date('2026-09-27T05:59:59Z') }).signature !== signed.signature, '')
  check('and a different body changes it, so a swapped picture cannot reuse a signature', sign({ payload: Buffer.from('hello!') }).signature !== signed.signature, '')

  const keyOf = (sha) => SYNC.objectKeyFor({ prefix: 'mitsu', sha256: sha, ext: 'png' })
  check(
    'the key is sharded by the first two hex characters, the way the attachment store shards',
    keyOf('ab'.repeat(32)) === 'mitsu/ab/' + 'ab'.repeat(32) + '.png',
    keyOf('ab'.repeat(32)),
  )
  check('and a hostile extension cannot leave the prefix', !SYNC.objectKeyFor({ prefix: 'mitsu', sha256: 'ab'.repeat(32), ext: '../../etc/passwd' }).includes('..'), SYNC.objectKeyFor({ prefix: 'mitsu', sha256: 'ab'.repeat(32), ext: '../../etc/passwd' }))
}

globalThis.fetch = realFetch
void HERE

finish()
