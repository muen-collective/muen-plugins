/**
 * THE THIRD NATIVE VERB: put a file in the trash, the way the platform's own file manager does.
 *
 * DELETING IS NOT REMOVING. Finder's Delete moves the file to the Trash, where it stays until a
 * person empties it; `rm` is a different, unrecoverable act that Finder hides behind a modifier key.
 * The founder asked for the first one (2026-09-26: *"a feature to delete the asset as if I am
 * deleting from finder"*), so this module only ever TRASHES — there is no `unlink` here, and a host
 * whose platform has no trash verb is told `unsupported` rather than handed a deletion it cannot
 * take back. A library of a person's own photographs is exactly the wrong place to be thorough.
 *
 * THREE VERBS, ONE MEANING. macOS goes through Finder itself, which is what makes Put Back work and
 * what handles a file on an external volume (each volume has its own Trash — a hand-rolled
 * `~/.Trash` rename gets the first wrong and the second impossible). Linux has `gio trash`, which
 * writes the XDG `.trashinfo` beside the file. Windows has the Recycle Bin through .NET.
 *
 * PATHS ARE ARGV, NEVER INTERPOLATED, for the reason the folder dialog gives: a file called
 * `"; rm -rf ~` is a file name and nothing else. On macOS and Windows the path is passed as an
 * argument to a script that reads `argv`; no string is ever built by concatenating it.
 *
 * INJECTABLE, so no verify run moves a real file: `apply(ctx, { trash })`, and the default is the
 * real thing. `canTrash` is reported to the surface, which hides the control when it is false.
 *
 * @module @muen/dsh-assets/lib/trash
 */
import { execFile } from 'node:child_process'

/** The platforms this host can trash on. `canTrash` is this, for the surface. */
export function canTrash(platform = process.platform) {
  return platform === 'darwin' || platform === 'linux' || platform === 'win32'
}

/**
 * Finder's own delete, so the file lands in the Trash this machine actually uses.
 *
 * `delete POSIX file (item 1 of argv)` answers with a reference to the trashed item; the script
 * returns a word rather than the reference so the answer is a fact and not an AppleScript object.
 */
const FINDER_DELETE = [
  'on run argv',
  '  tell application "Finder" to delete POSIX file (item 1 of argv)',
  '  return "trashed"',
  'end run',
].join('\n')

/** The .NET call behind Windows' own recycle, with the same "only on error" dialogs Explorer uses. */
const POWERSHELL_DELETE =
  'Add-Type -AssemblyName Microsoft.VisualBasic; ' +
  '[Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile($args[0], "OnlyErrorDialogs", "SendToRecycleBin")'

/** Where the file goes, said in the platform's own words — the pane prints this verbatim. */
const WHERE = { darwin: 'Trash', linux: 'Trash', win32: 'Recycle Bin' }

/**
 * Put one file in the trash.
 *
 * @param {string} target An absolute, resolved path the caller has already proved is inside a
 *   folder this library holds (see `deletableIn`) — this function does no policy of its own.
 * @returns {Promise<{ ok: true, where: string } | { ok: false, error: string, detail: string }>}
 */
export function trashFile(target, { run = execFile, platform = process.platform } = {}) {
  return new Promise((resolve) => {
    const path = String(target || '')
    if (path === '') {
      resolve({ ok: false, error: 'bad-request', detail: 'no path' })
      return
    }
    let command = null
    let args = null
    if (platform === 'darwin') {
      command = 'osascript'
      args = ['-e', FINDER_DELETE, path]
    } else if (platform === 'linux') {
      command = 'gio'
      args = ['trash', path]
    } else if (platform === 'win32') {
      command = 'powershell'
      args = ['-NoProfile', '-NonInteractive', '-Command', POWERSHELL_DELETE, path]
    } else {
      // NO SECOND-CLASS DELETE. A destructive verb this host cannot take back is refused by name.
      resolve({ ok: false, error: 'unsupported', detail: 'this host has no trash verb: ' + String(platform) })
      return
    }
    run(command, args, { timeout: 30000, windowsHide: true }, (error, stdout) => {
      if (error) {
        resolve({ ok: false, error: 'trash-failed', detail: String((error && error.message) || error) })
        return
      }
      resolve({ ok: true, where: WHERE[platform], detail: String(stdout || '').trim() })
    })
  })
}

/** The verb the host half uses, in the shape `apply(ctx, { trash })` injects. */
export const nativeTrash = { canTrash: canTrash(), trash: (path) => trashFile(path) }
