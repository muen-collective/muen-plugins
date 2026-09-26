/**
 * THE STRING SCAN (epic 65 L4) — the first half of translating a plugin we do not own.
 *
 * An overlay is keyed by the ENGLISH SOURCE STRING, so before anything can be translated, the source
 * strings have to be found: they are string literals inside a compiled `lib/client.js`, sitting among
 * CSS, module ids, data attributes and one-letter keys. This module is the sieve.
 *
 * IT IS A HEURISTIC, AND IT IS DELIBERATELY BRITTLE IN ONE DIRECTION: it would rather offer a
 * borderline string for a person to skip than miss a sentence the UI renders. The filter's rules are
 * the test surface — every one of them is checked against a fixture whose answer is known, because a
 * scan that quietly stops finding strings looks exactly like a plugin with nothing to translate.
 *
 * It reads TEXT, never executing the bundle: a scan must not run a stranger's code.
 */

/** CJK ranges: kana, CJK ideographs, Hangul. A hardcoded Chinese or Korean UI is the other case. */
const CJK = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af]/u

/** Tokens that mean "this literal is code, not copy" wherever they appear. */
const CODE_MARKERS = [
  '://', // a URL or a scheme
  '--dsw-', // a CSS variable
  'data-', // an attribute name
  'aria-', // an accessibility attribute
  'node_modules',
  'application/json',
  '@deepseek-ai',
  'require(',
  'function',
  'undefined',
  'object-fit',
  'var(--',
]

/** A whole-literal shape that is code: an identifier, a module id, a path, a number, a CSS value. */
const CODE_SHAPES = [
  /^[a-z][A-Za-z0-9_$]*$/u, // one lowercase word: `button`, `disabled`, `client`
  // NOT a bare `^[A-Z][A-Za-z0-9_$]*$`: every single-word LABEL has that shape (`Save`, `OK`), so that
  // rule silently rejected all of them. Symbol-like CamelCase is caught by `isSymbolLike` instead.
  // A module id, a path or a filename — which means it has to CONTAIN a separator. Without this
  // lookahead the shape matches every bare word (`Save`), which is how the first version of this
  // filter rejected every single-word label it was written to find.
  /^(?=.*[./@_-])[A-Za-z0-9_$./@-]+$/u,
  /^[\d\s.,:;%()#+-]+$/u, // numbers and punctuation
  /^\.?[A-Za-z-]+\s*\{/u, // the start of a CSS rule
  /^[a-z-]+:\s*[^;]+;?$/u, // one CSS declaration
  /^#[0-9a-fA-F]{3,8}$/u, // a colour
  /^(rgba?|hsla?)\(/u, // a colour function
  /^[0-9.]+(px|em|rem|vh|vw|%|s|ms)$/u, // a measurement
]

/**
 * Short capitals that are ABBREVIATIONS rather than labels. `OK` and `Save` are drawn on buttons and
 * belong in the map; `ID`, `URL` and `px` are not copy and never do. A two-letter word is only a
 * label when it is not one of these.
 */
const CODE_ABBREVIATIONS = new Set(['ID', 'UI', 'URL', 'URI', 'API', 'GB', 'MB', 'KB', 'MS', 'PX', 'EM', 'REM', 'CSS', 'DOM', 'RGB', 'RGBA', 'HSV', 'HSL', 'SVG', 'PNG', 'JPG', 'JPEG', 'GIF', 'WEBP', 'JSON', 'HTML', 'XML', 'SQL', 'IPC', 'CLI', 'HTTP', 'HTTPS', 'OS', 'SDK', 'CPU', 'GPU', 'RAM', 'SSD', 'TLS', 'SSH', 'DNS', 'EOF'])

/** A CamelCase identifier of three words or more is a symbol, not a label. */
function isSymbolLike(value) {
  return /^[A-Za-z]+(?:[A-Z][a-z0-9]+){1,}$/u.test(value) && !value.includes(' ')
}

/**
 * Would this literal be drawn as words on screen?
 *
 * The positive rules are the two ways UI copy arrives: a sentence (two or more words), or a single
 * capitalised word of three or more letters (`Save`, `Cancel`) — and anything carrying CJK, because a
 * Chinese-market plugin's hardcoded text is exactly what a person wants translated.
 */
function looksLikeUiCopy(value) {
  if (typeof value !== 'string') return false
  const text = value.trim()
  if (text.length < 2 || text.length > 300) return false
  if (!/[A-Za-z\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af]/u.test(text)) return false
  if (CODE_MARKERS.some((marker) => text.includes(marker))) return false
  if (CODE_SHAPES.some((shape) => shape.test(text))) return false
  if (isSymbolLike(text) && text.length > 8) return false
  const words = text.split(/\s+/u).filter(Boolean)
  if (CJK.test(text)) return true
  if (words.length >= 2) return true
  // One word: a label when it is capitalised and not an abbreviation (`Save` and `OK` are drawn on
  // buttons; `px`, `sm` and `URL` are not).
  return /^[A-Z][A-Za-z'’-]{1,}$/u.test(text) && !CODE_ABBREVIATIONS.has(text.toUpperCase())
}

/**
 * Every string literal in a source file, in order, with comments and regex literals skipped so their
 * contents cannot be mistaken for copy.
 */
function stringLiterals(source) {
  const found = []
  let index = 0
  let previousSignificant = ''
  while (index < source.length) {
    const ch = source[index]
    const next = source[index + 1]
    if (ch === '/' && next === '/') {
      index = source.indexOf('\n', index)
      if (index === -1) break
      continue
    }
    if (ch === '/' && next === '*') {
      const end = source.indexOf('*/', index + 2)
      index = end === -1 ? source.length : end + 2
      continue
    }
    if (ch === '/' && previousSignificant !== '' && /[=(,:[!&|?{};+\-*%<>~^]/u.test(previousSignificant)) {
      // A regex literal, by its position: after an operator, never after a value.
      index += 1
      let inClass = false
      while (index < source.length) {
        const inner = source[index]
        if (inner === '\\') index += 2
        else if (inner === '[') { inClass = true; index += 1 }
        else if (inner === ']') { inClass = false; index += 1 }
        else if (inner === '/' && !inClass) { index += 1; break }
        else if (inner === '\n') break
        else index += 1
      }
      continue
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      const quote = ch
      let value = ''
      index += 1
      while (index < source.length) {
        const inner = source[index]
        if (inner === '\\') {
          value += source.slice(index, index + 2)
          index += 2
          continue
        }
        if (inner === quote) break
        // A template literal with a substitution is not one string; keep the parts as text.
        value += inner
        index += 1
      }
      found.push(value)
      index += 1
      previousSignificant = quote
      continue
    }
    if (!/\s/u.test(ch)) previousSignificant = ch
    index += 1
  }
  return found
}

/**
 * The candidates in one bundle's text: deduplicated, sorted, and capped so a pathological file cannot
 * become an unbounded map. `limit` is a guard rail, not a target.
 */
function scanStrings(source, { limit = 2000 } = {}) {
  if (typeof source !== 'string' || source === '') return []
  const seen = new Set()
  for (const literal of stringLiterals(source)) {
    if (seen.size >= limit) break
    if (looksLikeUiCopy(literal)) seen.add(literal.trim())
  }
  return [...seen].sort((a, b) => a.localeCompare(b))
}

export { CJK, CODE_MARKERS, CODE_SHAPES, CODE_ABBREVIATIONS, looksLikeUiCopy, stringLiterals, scanStrings }
