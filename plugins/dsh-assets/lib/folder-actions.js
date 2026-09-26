/**
 * The two native verbs the folder row needs: pick a folder, and show one.
 *
 * A LIBRARY WHOSE FOLDERS LIVE OUTSIDE THE APP NEEDS THE OS DIALOG, or a person is asked
 * to type an absolute path from memory. The generator plugin carries the same pair for the
 * same reason; this is not an import of it (epic 63 §1: the plugins stand alone) but the
 * same contract, written down twice on purpose — the alternative is one plugin reaching
 * into another's code.
 *
 * INJECTABLE, so a verify run never pops a real dialog in someone's face:
 * `apply(ctx, { folders })`. The default is the real thing.
 *
 * @module @muen/dsh-assets/lib/folder-actions
 */
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'

/** Whether this host has a folder dialog at all. The surface hides the control when it does not. */
export const CAN_CHOOSE = process.platform === 'darwin'

/** What a cancelled dialog answers with, since osascript has no other way to say it. */
const CANCELLED = '__cancelled__'

/**
 * The AppleScript, with the start path as ARGV — never interpolated into the script, so a
 * folder called `"; rm -rf ~` is a folder name and nothing else.
 */
const CHOOSE_SCRIPT = [
  'on run argv',
  // THE COERCION IS OUTSIDE THE TRY, which is the shape this plugin's sibling proved: if it
  // throws, the failure is a failure and not a silent cancel.
  '  set startFolder to POSIX file (item 1 of argv)',
  '  try',
  '    set picked to (choose folder with prompt "Add a folder to the Assets library" default location startFolder)',
  '    return POSIX path of picked',
  '  on error number -128',
  '    return "' + CANCELLED + '"',
  '  end try',
  'end run',
].join('\n')

/**
 * A START FOLDER THAT EXISTS, because one that does not makes the dialog fail before it opens.
 *
 * This was `+ Folder`'s first real bug (founder, 2026-09-26: *"+folder in assets plugin not
 * working"*): the start path was this plugin's own root, `<profile>/assets`, and on a fresh
 * install nothing had created it yet — so AppleScript's `default location` pointed at a folder
 * that was not there, `choose folder` errored, and the press did nothing at all. The first
 * candidate that exists wins, and the person's home is the floor every machine has.
 */
export function chooseStart(candidates, { exists = existsSync, home = homedir() } = {}) {
  for (const candidate of Array.isArray(candidates) ? candidates : []) {
    if (typeof candidate !== 'string' || candidate.trim() === '') continue
    try {
      if (exists(candidate)) return candidate
    } catch {
      // A path this host cannot even ask about is not a start folder.
    }
  }
  return home
}

/**
 * Open the OS folder dialog.
 *
 * @returns {Promise<{ path: string } | { cancelled: true }>}
 */
export function chooseFolder(startPath, { run = execFile, platform = process.platform, home = homedir(), exists = existsSync } = {}) {
  return new Promise((resolve, reject) => {
    if (platform !== 'darwin') {
      reject(new Error('unsupported'))
      return
    }
    // The action takes what it is given, but never a start that is not there: the route
    // resolves one that exists (`chooseStart`), and this second guard keeps a future caller
    // from reintroducing the failure.
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
      // osascript answers with a trailing slash (`/Users/me/Desktop/`); a registry entry
      // that sometimes has one and sometimes does not would be two entries for one folder.
      resolve({ path: value.replace(/\/+$/, '') || '/' })
    })
  })
}

/** Reveal a folder (or a file inside one) in the platform's file browser. */
export function revealFolder(target, { run = execFile, platform = process.platform } = {}) {
  return new Promise((resolve, reject) => {
    const path = String(target || '')
    if (path === '') {
      reject(new Error('no path'))
      return
    }
    const [command, args] = platform === 'darwin' ? ['open', [path]] : platform === 'win32' ? ['explorer', [path]] : ['xdg-open', [path]]
    run(command, args, { timeout: 20000 }, (error) => {
      if (error) {
        reject(error)
        return
      }
      resolve({ ok: true })
    })
  })
}

/** The pair the host half uses, in the shape `apply(ctx, { folders })` injects. */
export const nativeFolders = { canChoose: CAN_CHOOSE, choose: (start) => chooseFolder(start), reveal: (target) => revealFolder(target) }
