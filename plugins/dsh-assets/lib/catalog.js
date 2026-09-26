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
      const provenance = {
        provider,
        jobId,
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
  return { assets: kept, counts, countsOver: 'all', total: assets.length, shown: kept.length, truncated, providers: undefined }
}
