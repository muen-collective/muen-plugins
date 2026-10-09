// @muen/dsh-studio — the sync-target seam (M11).
//
// The recipe library travels to storage the PERSON owns: a private repo in
// their own GitHub account, PAT from the credential store. This is a seam, not
// a GitHub plugin — GitHub is the first target behind an interface small enough
// that S3/folder/anything can implement it later. Manual push/pull only (the
// design decision: auto-sync per star would spam history). Offline is honest:
// the local file is the source of truth and sync is optional.

import { promises as fs } from 'node:fs'

/**
 * GitHub Contents API target. One file in one repo on one branch.
 * `fetchImpl` injectable — the suite drives a fake API, no network.
 */
export function githubTarget({ repo, branch = 'main', filePath = 'library.json', token, fetchImpl } = {}) {
  const impl = fetchImpl || globalThis.fetch
  const api = 'https://api.github.com/repos/' + repo + '/contents/' + filePath
  const headers = {
    accept: 'application/vnd.github+json',
    authorization: 'Bearer ' + token,
    'content-type': 'application/json',
  }
  if (!repo || !token) return null

  return {
    name: 'github',
    async pull() {
      try {
        const res = await impl(api + '?ref=' + encodeURIComponent(branch), { headers })
        if (res.status === 404) return { ok: false, code: 404, error: 'no remote file yet' }
        if (!res.ok) return { ok: false, code: 502, error: 'github ' + res.status }
        const body = await res.json()
        const content = Buffer.from(String(body.content || ''), 'base64').toString('utf8')
        return { ok: true, content, sha: body.sha }
      } catch (error) {
        return { ok: false, code: 502, error: 'offline: ' + String((error && error.message) || error) }
      }
    },
    async push(content) {
      try {
        // Contents API updates need the current sha; learn it first (404 = create).
        const current = await impl(api + '?ref=' + encodeURIComponent(branch), { headers })
        let sha
        if (current.ok) sha = (await current.json()).sha
        const res = await impl(api, {
          method: 'PUT',
          headers,
          body: JSON.stringify({
            message: 'studio library sync',
            content: Buffer.from(String(content), 'utf8').toString('base64'),
            branch,
            ...(sha ? { sha } : {}),
          }),
        })
        if (!res.ok) return { ok: false, code: 502, error: 'github ' + res.status }
        const body = await res.json()
        return { ok: true, sha: body.content && body.content.sha }
      } catch (error) {
        return { ok: false, code: 502, error: 'offline: ' + String((error && error.message) || error) }
      }
    },
  }
}

/** The seam around one local file and one target. */
export function createSync({ file, target }) {
  return {
    configured: !!target,
    name: target ? target.name : null,

    async push() {
      if (!target) return { ok: false, code: 501, error: 'sync not configured' }
      let content
      try {
        content = await fs.readFile(file, 'utf8')
      } catch {
        return { ok: false, code: 404, error: 'no local library yet' }
      }
      return target.push(content)
    },

    async pull() {
      if (!target) return { ok: false, code: 501, error: 'sync not configured' }
      const answer = await target.pull()
      if (!answer.ok) return answer
      await fs.mkdir(file.replace(/[/\\][^/\\]+$/, ''), { recursive: true }).catch(() => {})
      const tmp = file + '.tmp'
      await fs.writeFile(tmp, answer.content, 'utf8')
      await fs.rename(tmp, file)
      return answer
    },
  }
}
