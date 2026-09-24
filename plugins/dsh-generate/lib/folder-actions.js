/**
 * The Save folder row's two native verbs (founder, 2026-09-23: *"let's make save
 * folder default on desktop, and the user can click to choose a different folder.
 * in capture one its like this, click on icon to open finder"*): reveal the folder
 * that is already chosen, and let a person choose another one through the operating
 * system's own dialog instead of typing a path.
 *
 * Both run OUT HERE rather than in lib/index.js for the same reason the storage does
 * (see lib/library-path.js): the entry file reads files and registers routes, and the
 * verbs that touch the machine beside it live in their own module. Tests reach them
 * through `apply`'s config — a verify run must never pop a real folder dialog on the
 * founder's screen.
 *
 * The start folder travels as an ARGV item, never interpolated into the AppleScript,
 * so a path with a quote in it cannot rewrite the script it is passed to.
 *
 * @module @muen/dsh-generate/lib/folder-actions
 */
import { execFile } from 'node:child_process'
import { dirname } from 'node:path'

/** Whether `chooseFolder` can run here: the dialog is macOS-only today. */
export const CAN_CHOOSE = process.platform === 'darwin'

/**
 * Reveal `path` in the file browser the platform actually has — Finder, Explorer,
 * the desktop portal. Resolves with the path once the helper has been started;
 * rejects when it could not be started (a reveal that fails is the row's own
 * failure line, never a run's).
 */
export function revealFolder(path) {
  const [command, args] =
    process.platform === 'darwin'
      ? ['open', [path]]
      : process.platform === 'win32'
        ? ['explorer', [path]]
        : ['xdg-open', [path]]
  return new Promise((resolve, reject) => {
    execFile(command, args, { windowsHide: true }, (error) => (error ? reject(error) : resolve(path)))
  })
}

/**
 * Reveal one FILE, selected in its folder — the finished run's "Open in Finder"
 * (founder, 2026-09-23: *"Open the image opens in browser, but its more useful to
 * open in finder"*). macOS selects the file (`open -R`), Windows selects it too
 * (`explorer /select,`), and the Linux portal opens the containing folder, which is
 * the closest it comes. Resolves with the file's path.
 */
export function revealFile(path) {
  const [command, args] =
    process.platform === 'darwin'
      ? ['open', ['-R', path]]
      : process.platform === 'win32'
        ? ['explorer', ['/select,' + path]]
        : ['xdg-open', [dirname(path)]]
  return new Promise((resolve, reject) => {
    execFile(command, args, { windowsHide: true }, (error) => (error ? reject(error) : resolve(path))
    )
  })
}

/**
 * A native folder chooser starting at `defaultPath`.
 *
 * Resolves `{ path }` for a folder the person picked (POSIX path, trailing slash
 * dropped — `/` itself is kept), `{ cancelled: true }` when they backed out, and
 * rejects when osascript failed for any other reason. Cancellation is its own answer
 * because it is not a failure: the row goes back to idle and nothing is stored.
 */
export function chooseFolder(defaultPath) {
  if (!CAN_CHOOSE) return Promise.reject(new Error('unsupported'))
  // The prompt is a fixed literal; only the start folder arrives from outside, as argv.
  const script = [
    'on run argv',
    '  set startFolder to POSIX file (item 1 of argv)',
    '  try',
    '    set picked to (choose folder with prompt "Choose where finished runs are saved" default location startFolder)',
    '    return POSIX path of picked',
    '  on error number -128',
    '    return "__CANCELLED__"',
    '  end try',
    'end run',
  ].join('\n')
  return new Promise((resolve, reject) => {
    execFile('osascript', ['-e', script, defaultPath], { windowsHide: true }, (error, stdout) => {
      const out = String(stdout || '').trim()
      if (out === '__CANCELLED__') {
        resolve({ cancelled: true })
        return
      }
      if (error || out === '') {
        reject(error || new Error('empty-path'))
        return
      }
      const path = out.length > 1 && out.endsWith('/') ? out.slice(0, -1) : out
      resolve({ path })
    })
  })
}
