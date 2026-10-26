/**
 * The two native verbs the Add folder control needs: choose a folder, and show one.
 *
 * The plugin's source folder is the person's own, outside this app. The OS dialog is
 * the way in on macOS; a host without it hides the control and lets the path be typed.
 * Injectable so a verify run never pops a real dialog.
 *
 * @module @muen/dsh-styling/lib/folder-actions
 */
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'

export const CAN_CHOOSE = process.platform === 'darwin'
const CANCELLED = '__cancelled__'

const CHOOSE_SCRIPT = [
  'on run argv',
  '  set startFolder to POSIX file (item 1 of argv)',
  '  try',
  '    set picked to (choose folder with prompt "Add the folder with the look photographs" default location startFolder)',
  '    return POSIX path of picked',
  '  on error number -128',
  '    return "' + CANCELLED + '"',
  '  end try',
  'end run',
].join('\n')

export function chooseStart(candidates, { exists = existsSync, home = homedir() } = {}) {
  for (const candidate of Array.isArray(candidates) ? candidates : []) {
    if (typeof candidate !== 'string' || candidate.trim() === '') continue
    try {
      if (exists(candidate)) return candidate
    } catch {
      // not a start folder
    }
  }
  return home
}

export function chooseFolder(startPath, { run = execFile, platform = process.platform, home = homedir(), exists = existsSync } = {}) {
  return new Promise((resolve, reject) => {
    if (platform !== 'darwin') {
      reject(new Error('unsupported'))
      return
    }
    const start = chooseStart([startPath], { exists, home })
    run('osascript', ['-e', CHOOSE_SCRIPT, start], { timeout: 120000, windowsHide: true }, (error, stdout) => {
      if (error) {
        reject(error)
        return
      }
      const value = String(stdout === undefined || stdout === null ? '' : stdout).trim()
      if (value === '' || value === CANCELLED) {
        resolve({ cancelled: true })
        return
      }
      resolve({ path: value.replace(/\/+$/, '') || '/' })
    })
  })
}

export function revealFolder(target, { run = execFile, platform = process.platform } = {}) {
  return new Promise((resolve, reject) => {
    const path = String(target || '')
    if (path === '') {
      reject(new Error('no path'))
      return
    }
    const [command, args] = platform === 'darwin' ? ['open', [path]] : platform === 'win32' ? ['explorer', [path]] : ['xdg-open', [path]]
    run(command, args, { timeout: 20000 }, (error) => (error ? reject(error) : resolve({ ok: true })))
  })
}

export const nativeFolders = {
  canChoose: CAN_CHOOSE,
  choose: (start) => chooseFolder(start),
  reveal: (target) => revealFolder(target),
}
