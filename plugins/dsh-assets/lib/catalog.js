/**
 * The catalog: what is in the folders a person added, and which of it a run made.
 *
 * ONE SPECIES OF TILE. A file in an added folder is an asset. When a run record's own
 * `outcome.saved[i].file` is that exact path, the asset also carries PROVENANCE — the
 * provider, the job, the workflow, the prompt, the doors, the run's date. A file with no
 * record is still listed, with its own facts (dimensions unknown here, so: format, bytes,
 * mtime). There is no second kind of row to explain, and identity is the path, matched
 * exactly rather than guessed from a filename.
 *
 * THE RECORDS ARE READ, NOT OWNED (epic 63 §1): the records live under the Generate
 * plugin's root and this module reads the files. The two plugins stand alone, so this
 * works with Generate absent and neither reaches into the other.
 *
 * COUNTS ARE OVER EVERYTHING SCANNED, not over the current selection: a filter row that
 * changed its own number as you clicked it would be a moving target. The response says so
 * with `countsOver: 'all'`.
 *
 * @module @muen/dsh-assets/lib/catalog
 */
import { readdir, readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'

import { imageSize } from './image-size.js'

/** What counts as a picture or a clip here. Everything else in a folder is not an asset. */
const MEDIA_EXT = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'avif', 'tif', 'tiff', 'heic', 'bmp', 'mp4', 'mov', 'webm', 'mkv', 'mp3', 'wav', 'm4a'])

/** How deep a scan goes under an added folder, and how many files it will look at. */
const MAX_DEPTH = 4
const MAX_FILES = 5000

/** The extension a path ends in, lower-cased, or ''. */
export function extOf(path) {
  const name = String(path || '').split(/[\\/]/).pop() || ''
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : ''
}

/** `2026-09-26T03:00:00.000Z` → `2026-09-26`. A date is what the filter tree groups by. */
export function dayOf(value) {
  const text = String(value || '')
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(text)
  return match ? match[1] + '-' + match[2] + '-' + match[3] : null
}

/**
 * Every run record under the records root, indexed by the exact path each one saved.
 *
 * A record that cannot be read is skipped rather than fatal: the library's job is to show
 * what is there, and a half-written record must not empty the grid. A provider is simply a
 * directory with a `runs/` in it, so a new provider needs no change here.
 */
export async function readRecords(recordsRoot, { listDir = readdir, readText = readFile } = {}) {
  const byPath = new Map()
  const byJob = new Map()
  let providers = []
  try {
    providers = (await listDir(recordsRoot, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name)
  } catch {
    return { byPath, byJob, providers: [], records: 0 }
  }
  let records = 0
  for (const provider of providers) {
    let names = []
    try {
      names = await listDir(join(recordsRoot, provider, 'runs'))
    } catch {
      continue
    }
    for (const name of names) {
      if (!String(name).endsWith('.json')) continue
      let record
      try {
        record = JSON.parse(await readText(join(recordsRoot, provider, 'runs', name), 'utf8'))
      } catch {
        continue
      }
      if (!record || typeof record !== 'object') continue
      records += 1
      const jobId = String(record.jobId || String(name).replace(/\.json$/, ''))
      const outcome = record.outcome && typeof record.outcome === 'object' ? record.outcome : {}
      // The prompt rides with the record so a search can find a picture by what it was
      // asked for; it is a field on the run, not a second read of the file.
      const prompt = summariseRecord(record).prompt
      const provenance = {
        provider,
        jobId,
        prompt,
        at: String(record.at || outcome.at || '') || null,
        settledAt: String(outcome.at || '') || null,
        workflow: String(record.adapter || '') || null,
        title: String(record.title || '') || null,
        appId: record.appId === undefined || record.appId === null ? null : String(record.appId),
        status: String(outcome.status || record.status || '') || null,
        state: String(outcome.state || '') || null,
        saved: ((outcome.saved) || []).length,
      }
      byJob.set(provider + ':' + jobId, provenance)
      for (const [index, entry] of ((outcome.saved) || []).entries()) {
        if (!entry || typeof entry.file !== 'string' || entry.file === '') continue
        byPath.set(entry.file, { ...provenance, outputIndex: index, bytes: entry.bytes === undefined ? null : entry.bytes, type: String(entry.type || '') || null })
      }
    }
  }
  return { byPath, byJob, providers, records }
}

/**
 * Every media file under the added folders, with what can be said about it without opening
 * it. Depth and count are bounded, and the bound is reported rather than silent.
 */
export async function scanFolders(folders, { listDir = readdir, statFile = stat } = {}) {
  const files = []
  let truncated = false
  const walk = async (root, dir, depth) => {
    if (truncated || depth > MAX_DEPTH) return
    let entries = []
    try {
      entries = await listDir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (truncated) return
      const name = String(entry.name || '')
      if (name.startsWith('.')) continue
      const full = join(dir, name)
      if (entry.isDirectory()) {
        await walk(root, full, depth + 1)
        continue
      }
      if (!entry.isFile()) continue
      const ext = extOf(name)
      if (!MEDIA_EXT.has(ext)) continue
      if (files.length >= MAX_FILES) {
        truncated = true
        return
      }
      let info
      try {
        info = await statFile(full)
      } catch {
        continue
      }
      files.push({ path: full, name, ext, bytes: info.size, mtime: new Date(info.mtimeMs).toISOString(), folder: root.path, label: root.label || '' })
    }
  }
  for (const folder of folders) await walk(folder, folder.path, 0)
  return { files, truncated }
}

/**
 * What a run was asked for, in the shape the metadata block draws: the prompt first, then
 * the rest of the values as key/value rows.
 *
 * THE TWO PROVIDERS CARRY THEIR VALUES DIFFERENTLY, so both are read: RunningHub's body is
 * `{ webappId, nodeInfoList: [{ nodeId, fieldName, fieldValue }] }` — a door list — while
 * Krea's body is the request itself, with the prompt at the top level. Nothing is guessed: a
 * body neither shape matches yields no values rather than invented ones.
 */
export function summariseRecord(record) {
  const body = record && record.body && typeof record.body === 'object' ? record.body : null
  if (!body) return { prompt: null, values: [] }
  const values = []
  let prompt = null
  const list = Array.isArray(body.nodeInfoList) ? body.nodeInfoList : null
  if (list) {
    for (const node of list) {
      if (!node || typeof node !== 'object') continue
      const key = String(node.fieldName === undefined ? node.nodeId : node.fieldName)
      const value = node.fieldValue
      if (value === undefined || value === null || value === '') continue
      if (/prompt|text/i.test(key) && typeof value === 'string' && value.length > 8) prompt = value
      values.push({ key, value: String(value) })
    }
    return { prompt, values }
  }
  for (const [key, value] of Object.entries(body)) {
    if (value === undefined || value === null || value === '') continue
    if (typeof value === 'boolean') continue
    const text = typeof value === 'string' ? value : JSON.stringify(value)
    if (text === undefined || text === null) continue
    if (key === 'prompt' || (/prompt/i.test(key) && typeof value === 'string' && value.length > 8)) prompt = text
    values.push({ key, value: text })
  }
  return { prompt, values }
}

/**
 * Where an asset is, as far as this machine can honestly say.
 *
 * `present` — the file is here. `trashed` — the record's own path is gone but a file of the
 * same name is under the folder's `_trash/`, which is where this product's delete moves
 * things rather than unlinking them. `offline` — the path lives on a volume that is not
 * mounted. `missing` — none of the above, and saying so is the whole point.
 */
export async function whereIs(path, folder, { statFile = stat } = {}) {
  try {
    const info = await statFile(path)
    if (info.isFile()) return 'present'
  } catch {
    // Not there, which is what the rest of this function is about.
  }
  const name = String(path).split(/[\\/]/).pop() || ''
  if (folder && name !== '') {
    try {
      const info = await statFile(join(folder, '_trash', name))
      if (info.isFile()) return 'trashed'
    } catch {
      // No trash copy either.
    }
  }
  const volume = /^\/(?:Volumes|media|mnt)\/([^/]+)\//.exec(String(path))
  if (volume) {
    try {
      await statFile('/Volumes/' + volume[1])
    } catch {
      const mount = /^\/(media|mnt)\//.exec(String(path))
      if (mount) return 'offline'
    }
  }
  return 'missing'
}

/**
 * One asset, whole: what the metadata block draws when a tile is selected.
 *
 * The list stays cheap — it reads names, sizes and dates — and this is the read that opens
 * the file for its dimensions. `paths` is what makes the read safe: an asset the library
 * does not hold is refused rather than described.
 */
export async function assetDetail({ folders = [], recordsRoot, path, statFile = stat, sizeOf = imageSize } = {}) {
  const wanted = String(path || '')
  const folder = folders.find((entry) => wanted === entry.path || wanted.startsWith(entry.path.replace(/\/+$/, '') + '/'))
  if (!folder) return { error: 'not-in-library' }
  const ext = extOf(wanted)
  let info = null
  try {
    info = await statFile(wanted)
  } catch {
    info = null
  }
  const where = await whereIs(wanted, folder.path, { statFile })
  const { byPath } = await readRecords(recordsRoot, {})
  const record = byPath.get(wanted) || null
  const summary = summariseRecord(record)
  const name = wanted.split(/[\\/]/).pop() || ''
  return {
    path: wanted,
    name,
    ext,
    type: record && record.type ? record.type : ext,
    bytes: info && info.isFile() ? info.size : null,
    mtime: info && info.isFile() ? new Date(info.mtimeMs).toISOString() : null,
    date: dayOf(record && (record.settledAt || record.at)) || (info && info.isFile() ? dayOf(new Date(info.mtimeMs).toISOString()) : null),
    context: folder.label || '',
    folder: folder.path,
    where,
    dimensions: info && info.isFile() ? await sizeOf(wanted, ext) : null,
    provenance: record,
    prompt: summary.prompt,
    values: summary.values,
  }
}

/** The date tree and the context rows, each with the number of assets behind it. */
export function summarise(assets) {
  const context = new Map()
  const years = new Map()
  for (const asset of assets) {
    const key = asset.context || ''
    context.set(key, (context.get(key) || 0) + 1)
    const day = asset.date
    if (day === null) continue
    const [year, month] = day.split('-')
    if (!years.has(year)) years.set(year, { year, count: 0, months: new Map() })
    const y = years.get(year)
    y.count += 1
    if (!y.months.has(month)) y.months.set(month, { month, count: 0, days: [] })
    const m = y.months.get(month)
    m.count += 1
    const existing = m.days.find((d) => d.day === day)
    if (existing) existing.count += 1
    else m.days.push({ day, count: 1 })
  }
  return {
    context: [...context.entries()]
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value)),
    date: [...years.values()]
      .sort((a, b) => (a.year < b.year ? 1 : -1))
      .map((y) => ({
        year: y.year,
        count: y.count,
        months: [...y.months.values()]
          .sort((a, b) => (a.month < b.month ? 1 : -1))
          .map((m) => ({ month: m.month, count: m.count, days: m.days.slice().sort((a, b) => (a.day < b.day ? 1 : -1)) })),
      })),
  }
}

/**
 * The library as the surface reads it: the tiles, the counts, and where it looked.
 *
 * @param {object} options
 * @param {Array} options.folders - the registry (each `{ path, label }`)
 * @param {string} options.recordsRoot - the Generate plugin's root
 * @param {string} [options.context] - keep one context (the folder's label)
 * @param {string} [options.date] - keep one day (`YYYY-MM-DD`)
 */
export async function readCatalog({ folders = [], recordsRoot, context = null, date = null, listDir = readdir, readFileImpl = readFile, statFile = stat } = {}) {
  const { byPath } = await readRecords(recordsRoot, { listDir, readText: readFileImpl })
  const { files, truncated } = await scanFolders(folders, { listDir, statFile })
  const assets = files.map((file) => {
    const record = byPath.get(file.path) || null
    return {
      path: file.path,
      name: file.name,
      ext: file.ext,
      type: record && record.type ? record.type : file.ext,
      bytes: file.bytes,
      mtime: file.mtime,
      // A RECORD'S OWN DATE WINS: it says when the run settled, which is what a person
      // remembers, and mtime can be anything a copy tool left behind.
      date: dayOf(record && (record.settledAt || record.at)) || dayOf(file.mtime),
      context: file.label || '',
      folder: file.folder,
      hasRecord: record !== null,
      provenance: record,
    }
  })
  const counts = summarise(assets)
  const kept = assets.filter((asset) => (context === null || asset.context === context) && (date === null || asset.date === date))
  kept.sort((a, b) => (a.date === b.date ? String(b.mtime).localeCompare(String(a.mtime)) : String(b.date).localeCompare(String(a.date))))
  // The list is deliberately light — names, sizes, dates — and `assetDetail` is the read
  // that opens a file for its dimensions. So no `dimensions` field here on purpose.
  return { assets: kept, counts, countsOver: 'all', total: assets.length, shown: kept.length, truncated }
}
