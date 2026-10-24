/**
 * Pure text transforms.
 *
 * Every function in this module takes plain text and returns plain text. Nothing here
 * touches the DOM, CodeMirror or the file system, which keeps the transforms easy to
 * unit test and safe to call from a command handler.
 *
 * Line endings of the input are preserved: a CRLF document stays CRLF after a
 * transform, and a trailing newline is kept where it makes sense.
 */

/** A line separator recognised by the transforms. */
type Eol = '\n' | '\r\n' | '\r'

const LINE_SPLIT = /\r\n|\n|\r/
const TRAILING_EOL = /(?:\r\n|\n|\r)$/

interface SplitText {
  eol: Eol
  lines: string[]
  /** True when the original text ended with a line separator. */
  trailing: boolean
}

/** Guess the dominant line ending of a text. */
function detectEol(text: string): Eol {
  const crlf = (text.match(/\r\n/g) ?? []).length
  const lf = (text.match(/\n/g) ?? []).length - crlf
  const cr = (text.match(/\r/g) ?? []).length - crlf
  if (crlf > 0 && crlf >= lf && crlf >= cr) return '\r\n'
  if (cr > 0 && cr > lf) return '\r'
  return '\n'
}

/** Split a text into lines, remembering the line ending and a trailing separator. */
function splitLines(text: string): SplitText {
  if (text === '') return { eol: '\n', lines: [], trailing: false }
  const eol = detectEol(text)
  const match = TRAILING_EOL.exec(text)
  const trailing = match !== null
  const body = trailing ? text.slice(0, text.length - match[0].length) : text
  return { eol, lines: body.split(LINE_SPLIT), trailing }
}

/** Re-assemble lines with the given line ending. */
function assemble(lines: string[], eol: Eol, trailing: boolean): string {
  if (!lines.length) return ''
  return lines.join(eol) + (trailing ? eol : '')
}

/**
 * Sort the lines of a text.
 *
 * The comparison is a plain lexicographic one so the result is stable and does not
 * depend on the machine locale.
 */
export function sortLines(text: string, desc = false): string {
  const { eol, lines, trailing } = splitLines(text)
  const sorted = [...lines].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
  if (desc) sorted.reverse()
  return assemble(sorted, eol, trailing)
}

/** Remove duplicated lines, keeping the first occurrence of each one. */
export function removeDuplicateLines(text: string): string {
  const { eol, lines, trailing } = splitLines(text)
  const seen = new Set<string>()
  const out: string[] = []
  for (const line of lines) {
    if (seen.has(line)) continue
    seen.add(line)
    out.push(line)
  }
  return assemble(out, eol, trailing)
}

/** Remove lines that contain nothing but whitespace. */
export function removeBlankLines(text: string): string {
  const { eol, lines, trailing } = splitLines(text)
  const out = lines.filter((line) => line.trim().length > 0)
  return assemble(out, eol, trailing)
}

/** Strip trailing spaces and tabs from every line. */
export function trimTrailingWhitespace(text: string): string {
  const { eol, lines, trailing } = splitLines(text)
  const out = lines.map((line) => line.replace(/[ \t\f\v\u00A0]+$/, ''))
  return assemble(out, eol, trailing)
}

/**
 * Join every line into a single line.
 *
 * Each line is trimmed and the lines are separated by a single space, so the result
 * reads as one continuous sentence.
 */
export function joinLines(text: string): string {
  const { lines } = splitLines(text)
  return lines.map((line) => line.trim()).join(' ')
}

/** Capitalise the first cased character of a text. */
function capitalizeFirst(text: string): string {
  const index = text.search(/\p{L}/u)
  if (index === -1) return text
  return text.slice(0, index) + text.charAt(index).toUpperCase() + text.slice(index + 1)
}

/** Flip the case of every cased character. */
function toggleCase(text: string): string {
  let out = ''
  for (const ch of text) {
    const lower = ch.toLowerCase()
    const upper = ch.toUpperCase()
    if (lower === upper) out += ch
    else if (ch === lower) out += upper
    else out += lower
  }
  return out
}

/**
 * Change the case of a text.
 *
 * - `upper` / `lower` simply transform the whole text.
 * - `title` capitalises the first letter of every word and lowercases the rest of it.
 * - `sentence` capitalises the first letter of the text.
 * - `toggle` flips the case of every character.
 */
export function changeCase(text: string, mode: 'upper' | 'lower' | 'title' | 'sentence' | 'toggle'): string {
  switch (mode) {
    case 'upper':
      return text.toUpperCase()
    case 'lower':
      return text.toLowerCase()
    case 'title':
      return text.replace(
        /(^|[^\p{L}\p{N}])(\p{L}[\p{L}\p{M}]*)/gu,
        (_match, prefix: string, word: string) => prefix + word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
      )
    case 'sentence':
      return capitalizeFirst(text)
    case 'toggle':
      return toggleCase(text)
    default:
      return text
  }
}

/**
 * Prefix every line with its line number.
 *
 * Numbers are right aligned so they line up in the gutter, and separated from the
 * line content by a tab. `removeLineNumbers` undoes this transformation.
 */
export function insertLineNumbers(text: string, startAt = 1): string {
  const { eol, lines, trailing } = splitLines(text)
  if (!lines.length) return ''
  const start = Number.isFinite(startAt) ? Math.trunc(startAt) : 1
  const width = String(start + lines.length - 1).length
  const out = lines.map((line, index) => {
    const number = String(start + index).padStart(width, ' ')
    return `${number}\t${line}`
  })
  return assemble(out, eol, trailing)
}

/**
 * Strip a leading line number from every line.
 *
 * Accepts `<number><tab>`, `<number><space>` and the padded variant produced by
 * `insertLineNumbers` (`<spaces><number><tab>`).
 */
export function removeLineNumbers(text: string): string {
  const { eol, lines, trailing } = splitLines(text)
  const out = lines.map((line) => line.replace(/^[ \t]*\d+[ \t]/, ''))
  return assemble(out, eol, trailing)
}

/** Escape a string so it can be embedded in a regular expression. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Build a matcher for a literal needle.
 *
 * Returns `null` for an empty needle so callers can bail out early.
 */
function buildMatcher(needle: string, caseSensitive: boolean, wholeWord: boolean): RegExp | null {
  if (!needle) return null
  const body = escapeRegExp(needle)
  const pattern = wholeWord ? `(?<![\\p{L}\\p{N}_])${body}(?![\\p{L}\\p{N}_])` : body
  return new RegExp(pattern, caseSensitive ? 'gu' : 'giu')
}

/**
 * Count how often a literal string occurs in a text.
 *
 * Matches do not overlap. With `wholeWord` the match must not be surrounded by
 * letters, digits or underscores.
 */
export function countOccurrences(text: string, needle: string, caseSensitive = true, wholeWord = false): number {
  const matcher = buildMatcher(needle, caseSensitive, wholeWord)
  if (!matcher) return 0
  let count = 0
  let match = matcher.exec(text)
  while (match !== null) {
    count += 1
    match = matcher.exec(text)
  }
  return count
}

/** Offsets of the first character of every line. */
function lineStarts(text: string): number[] {
  const starts = [0]
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    if (char === '\n') {
      starts.push(i + 1)
    } else if (char === '\r') {
      if (text[i + 1] === '\n') i += 1
      starts.push(i + 1)
    }
  }
  return starts
}

/** Index of the line that owns the given offset. */
function lineIndexAt(starts: number[], offset: number): number {
  let low = 0
  let high = starts.length - 1
  while (low < high) {
    const mid = (low + high + 1) >> 1
    if (starts[mid] <= offset) low = mid
    else high = mid - 1
  }
  return low
}

/**
 * Locate every occurrence of a literal string in a text.
 *
 * Line and column numbers are 1-based, `length` is the length of the matched text.
 */
export function highlightMatches(
  text: string,
  needle: string,
  caseSensitive = true,
): { line: number; col: number; length: number }[] {
  const matcher = buildMatcher(needle, caseSensitive, false)
  if (!matcher) return []
  const starts = lineStarts(text)
  const out: { line: number; col: number; length: number }[] = []
  let match = matcher.exec(text)
  while (match !== null) {
    const index = match.index
    const line = lineIndexAt(starts, index)
    out.push({ line: line + 1, col: index - starts[line] + 1, length: match[0].length })
    match = matcher.exec(text)
  }
  return out
}
