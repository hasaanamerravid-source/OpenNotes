/**
 * Problems / diagnostics engine.
 *
 * The engine inspects the document of an editor and reports everything a
 * programmer would call a problem:
 *
 * - syntax errors that the Lezer grammar found (unclosed brackets,
 *   unterminated strings, unexpected tokens, ...)
 * - parse errors of data formats (`JSON.parse` for JSON)
 * - warnings that every editor knows: TODO/FIXME markers, over long lines,
 *   trailing whitespace, a missing newline at the end of the file and tabs in
 *   files whose indentation is part of the syntax.
 *
 * The analysis is completely synchronous and linear in the size of the
 * document, so it stays fast enough to run while the user types. The result
 * is capped at {@link MAX_PROBLEMS} entries so that a huge file can never
 * freeze the editor.
 *
 * The problems are pushed into the editor with {@link applyProblems}, which
 * paints a squiggly underline below the offending range.
 */

import { syntaxTree } from '@codemirror/language'
import { StateEffect, StateField, type Extension, type Range, type Text } from '@codemirror/state'
import { Decoration, EditorView, type DecorationSet } from '@codemirror/view'

export type ProblemSeverity = 'error' | 'warning' | 'info'

export interface Problem {
  /** 1 based line number. */
  line: number
  /** 1 based column. */
  column: number
  /** Character offset in the document. */
  from: number
  /** Character offset in the document. */
  to: number
  severity: ProblemSeverity
  message: string
  /** Short code, e.g. "syntax" or "todo". */
  source: string
}

/** The number of problems that are reported for a single document at most. */
export const MAX_PROBLEMS = 500

/** Lines that are longer than this are reported. */
export const MAX_LINE_LENGTH = 120

/** How many "tab indentation" problems are reported at most. */
const MAX_TAB_PROBLEMS = 20

/** Languages where the indentation is part of the syntax. */
const INDENTATION_SENSITIVE = new Set([
  'python',
  'yaml',
  'makefile',
  'coffee',
  'elm',
  'purescript',
  'idris',
  'agda',
  'lean',
  'haskell',
  'ocaml',
  'fsharp',
  'nim',
  'starlark',
  'pug',
])

/** The markers that are reported when they show up inside a comment. */
const MARKER_RE = /\b(TODO|FIXME|HACK|XXX)\b/g

/** A comment of the document. */
interface Span {
  from: number
  to: number
}

/* ------------------------------------------------------------------ *
 * Collecting
 * ------------------------------------------------------------------ */

/**
 * Documents that are bigger than this are not parsed: the syntax tree of a
 * huge file takes seconds to build and the editor would freeze while typing.
 * The cheap checks (long lines, trailing space) still run.
 */
export const MAX_DIAGNOSTIC_CHARS = 1_500_000

/**
 * Collect the problems of a document. `language` is the language id of the tab.
 */
export function collectProblems(view: EditorView, language: string): Problem[] {
  const state = view.state
  const doc = state.doc
  const huge = doc.length > MAX_DIAGNOSTIC_CHARS

  const comments: Span[] = []
  const syntaxErrors: Span[] = []
  // A big document is not parsed: the tree is built lazily by CodeMirror and
  // asking for it would block the editor for seconds.
  const tree = huge ? null : syntaxTree(state)
  if (tree && tree.length > 0) {
    tree.iterate({
      enter(node) {
        if (node.type.isError) {
          syntaxErrors.push({ from: node.from, to: node.to })
        } else if (isCommentNode(node.name)) {
          comments.push({ from: node.from, to: node.to })
        }
      },
    })
  }

  const problems: Problem[] = []
  // The whole text is only needed for the checks that look at the characters.
  const text = huge ? '' : doc.toString()

  // JSON gets a dedicated parser: its error messages are much better than
  // the ones of the generic grammar, so they replace the syntax errors.
  let handledByJson = false
  if (!huge && language === 'json') {
    const jsonProblem = collectJsonProblem(doc, text, syntaxErrors)
    if (jsonProblem) {
      problems.push(jsonProblem)
      handledByJson = true
    }
  }

  if (!handledByJson) {
    for (const error of syntaxErrors) {
      const problem = makeSyntaxProblem(doc, text, error)
      if (problem) problems.push(problem)
    }
  }

  // Java gets a dedicated local validator: common mistakes are caught even
  // when no Java language server is installed.
  if (!huge && language === 'java') {
    problems.push(...collectJavaProblems(doc, text))
  }

  // TODO/FIXME markers are only interesting inside a comment - but only when
  // the language knows about comments at all.
  const commentTokens = state.languageDataAt<unknown>('commentTokens', 0)
  const onlyInComments = tree !== null && tree.length > 0 && commentTokens.length > 0
  problems.push(...collectMarkerProblems(doc, text, comments, onlyInComments))

  problems.push(...collectLineProblems(doc, text, language))

  return limitProblems(sortProblems(problems))
}

/** Count the problems per severity. */
export function countProblems(problems: readonly Problem[]): {
  errors: number
  warnings: number
  infos: number
} {
  let errors = 0
  let warnings = 0
  let infos = 0
  for (const problem of problems) {
    if (problem.severity === 'error') errors++
    else if (problem.severity === 'warning') warnings++
    else infos++
  }
  return { errors, warnings, infos }
}

/* ------------------------------------------------------------------ *
 * Syntax errors
 * ------------------------------------------------------------------ */

/** Is the name of a syntax node the name of a comment? */
function isCommentNode(name: string): boolean {
  return name.toLowerCase().includes('comment')
}

/** Build the problem of a single error node of the syntax tree. */
function makeSyntaxProblem(doc: Text, text: string, error: Span): Problem | null {
  const from = clamp(error.from, 0, doc.length)
  let to = clamp(error.to, 0, doc.length)
  if (to <= from && from < doc.length) to = from + 1
  const issue = analyzeSyntaxError(text, from, to)
  // An error without any explanation that only covers white space (the line
  // break at the end of a broken statement for example) is not worth showing.
  if (issue.message === 'Syntax error' && /^\s*$/.test(text.slice(error.from, error.to))) {
    return null
  }
  const line = doc.lineAt(issue.from)
  return {
    line: line.number,
    column: issue.from - line.from + 1,
    from: issue.from,
    to: issue.to,
    severity: 'error',
    message: issue.message,
    source: 'syntax',
  }
}

/** The result of the analysis of an error node. */
interface SyntaxIssue {
  message: string
  from: number
  to: number
}

/**
 * Turn an error node into a message. When the node itself does not tell much
 * (an empty node at the end of a broken block for example) the text in front
 * of it is scanned for the construct that was never closed.
 */
function analyzeSyntaxError(text: string, from: number, to: number): SyntaxIssue {
  const snippet = text.slice(from, to)
  const trimmed = snippet.trimStart()
  const first = trimmed.charAt(0)
  if (first === '"' || first === "'" || first === '`') {
    return {
      message: 'Syntax error: unterminated string literal',
      from,
      to: Math.max(to, from + 1),
    }
  }
  if (first === '(' || first === '[' || first === '{') {
    return { message: 'Syntax error: unclosed bracket', from, to: Math.max(to, from + 1) }
  }
  if (first === ')' || first === ']' || first === '}') {
    return {
      message: 'Syntax error: unexpected closing bracket',
      from,
      to: Math.max(to, from + 1),
    }
  }

  const cause = backwardIssue(text, from)
  if (cause?.kind === 'bracket') {
    return {
      message: 'Syntax error: unclosed bracket',
      from: cause.position,
      to: cause.position + 1,
    }
  }
  if (cause?.kind === 'string') {
    return {
      message: 'Syntax error: unterminated string literal',
      from: cause.position,
      to: cause.position + 1,
    }
  }
  if (!trimmed) return { message: 'Syntax error', from, to: Math.max(to, from + 1) }
  return { message: 'Unexpected token', from, to: Math.max(to, from + 1) }
}

/** The construct that was most likely never closed. */
function backwardIssue(text: string, from: number): { kind: 'bracket' | 'string'; position: number } | null {
  const stack: string[] = []
  const limit = Math.max(0, from - 4000)
  for (let index = from - 1; index >= limit; index--) {
    const char = text.charAt(index)
    if (char === ')' || char === ']' || char === '}') {
      stack.push(char === ')' ? '(' : char === ']' ? '[' : '{')
      continue
    }
    if (char === '(' || char === '[' || char === '{') {
      if (stack.length && stack[stack.length - 1] === char) {
        stack.pop()
        continue
      }
      return { kind: 'bracket', position: index }
    }
    if (char === '"' || char === "'" || char === '`') {
      // An apostrophe in the middle of a word ("don't") is not a string.
      if (isWordChar(text.charAt(index - 1))) continue
      if (!hasClosingQuote(text, index, char)) {
        return { kind: 'string', position: index }
      }
    }
  }
  return null
}

/** Is the character part of a word? */
function isWordChar(char: string): boolean {
  if (!char) return false
  const code = char.charCodeAt(0)
  return (code >= 48 && code <= 57) || (code >= 65 && code <= 90) || (code >= 97 && code <= 122) || char === '_'
}

/** Is there a closing quote of the same kind behind the given quote? */
function hasClosingQuote(text: string, index: number, quote: string): boolean {
  const limit = Math.min(text.length, index + 4000)
  for (let cursor = index + 1; cursor < limit; cursor++) {
    const char = text.charAt(cursor)
    if (char === '\\') {
      cursor++
      continue
    }
    if (char === quote) return true
  }
  return false
}

/* ------------------------------------------------------------------ *
 * JSON
 * ------------------------------------------------------------------ */

/**
 * Report the parse error of a JSON document. The position of the error is
 * taken from the message of the parser when it has one and from the syntax
 * tree otherwise.
 */
function collectJsonProblem(doc: Text, text: string, syntaxErrors: Span[]): Problem | null {
  let raw: string
  try {
    JSON.parse(text)
    return null
  } catch (error) {
    raw = error instanceof Error ? error.message : String(error)
  }

  let offset = -1
  const position = /position (\d+)/.exec(raw)
  if (position) {
    const parsed = Number(position[1])
    if (Number.isFinite(parsed)) offset = parsed
  }
  if (offset < 0 && syntaxErrors.length) offset = syntaxErrors[0].from
  if (offset < 0) offset = 0
  offset = clamp(offset, 0, doc.length)

  const line = doc.lineAt(offset)
  return {
    line: line.number,
    column: offset - line.from + 1,
    from: offset,
    to: Math.min(offset + 1, doc.length),
    severity: 'error',
    message: `Invalid JSON: ${cleanJsonMessage(raw)}`,
    source: 'json',
  }
}

/** Remove the redundant position information of a JSON error message. */
function cleanJsonMessage(raw: string): string {
  const message = raw
    .replace(/\s*in JSON at position \d+/, '')
    .replace(/\s*\(line \d+ column \d+\)/, '')
    .replace(/\.\.\.[\s\S]*?is not valid JSON/, '')
    .replace(/,\s*$/, '')
    .trim()
  return message || raw.trim()
}

/* ------------------------------------------------------------------ *
 * Java                                                               *
 * ------------------------------------------------------------------ */

/**
 * Local Java validator: catches common mistakes even when no Java language
 * server is installed. Runs synchronously and is cheap.
 */
function collectJavaProblems(doc: Text, text: string): Problem[] {
  const problems: Problem[] = []

  // A Java source file should declare at least one class / interface / enum / record.
  if (!/\b(class|interface|enum|record)\s+[A-Za-z_$][\w$]*/.test(text)) {
    const line = doc.lineAt(0)
    problems.push({
      line: line.number,
      column: 1,
      from: 0,
      to: Math.min(doc.length, 80),
      severity: 'warning',
      message: 'No class, interface, enum or record declaration found in this Java file',
      source: 'java',
    })
  }

  // Check for missing semicolons after field declarations and simple statements.
  // This is heuristic: look for lines that end with a type-like word but no
  // semicolon, closing brace, or annotation.
  const lines = text.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trimEnd()
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) continue
    if (trimmed.endsWith(';') || trimmed.endsWith('{') || trimmed.endsWith('}') || trimmed.endsWith(':')) continue
    if (trimmed.startsWith('import ') || trimmed.startsWith('package ')) continue
    if (trimmed.startsWith('@')) continue
    if (
      /^(if|else|for|while|do|switch|case|try|catch|finally|return|throw|break|continue|synchronized)\b/.test(trimmed)
    )
      continue
    // A line that starts with a type keyword and looks like a declaration but
    // has no semicolon is likely missing one.
    if (
      /^\s*(public|private|protected|static|final|\s)*(int|long|short|byte|float|double|boolean|char|String|void|List|Map|Set)\s+[\w$]+\s*[=,]/.test(
        trimmed,
      )
    ) {
      const from = doc.lineAt(i + 1).from + trimmed.length - 1
      problems.push({
        line: i + 1,
        column: trimmed.length,
        from,
        to: Math.min(from + 1, doc.length),
        severity: 'error',
        message: 'Missing semicolon at end of statement',
        source: 'java',
      })
    }
  }

  return problems
}

/* ------------------------------------------------------------------ *
 * Markers                                                            *
 * ------------------------------------------------------------------ */

/** Report the TODO/FIXME/HACK/XXX markers of the document. */
function collectMarkerProblems(doc: Text, text: string, comments: Span[], onlyInComments: boolean): Problem[] {
  const problems: Problem[] = []
  const reportedLines = new Set<number>()
  MARKER_RE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = MARKER_RE.exec(text)) !== null) {
    const from = match.index
    if (onlyInComments && !insideComment(comments, from)) continue
    const line = doc.lineAt(from)
    // Only the first marker of a line is reported.
    if (reportedLines.has(line.number)) continue
    reportedLines.add(line.number)
    problems.push({
      line: line.number,
      column: from - line.from + 1,
      from,
      to: from + match[0].length,
      severity: 'warning',
      message: markerMessage(match[1]),
      source: 'todo',
    })
  }
  return problems
}

/** The message of a marker. */
function markerMessage(marker: string): string {
  if (marker === 'TODO' || marker === 'FIXME') return 'Contains a TODO/FIXME marker'
  return `Contains a ${marker} marker`
}

/** Is the offset inside one of the comment spans? */
function insideComment(comments: Span[], offset: number): boolean {
  let low = 0
  let high = comments.length - 1
  while (low <= high) {
    const mid = (low + high) >> 1
    const span = comments[mid]
    if (offset < span.from) high = mid - 1
    else if (offset >= span.to) low = mid + 1
    else return true
  }
  return false
}

/* ------------------------------------------------------------------ *
 * Line based problems
 * ------------------------------------------------------------------ */

/** Report the problems that every line of the document can have. */
function collectLineProblems(doc: Text, text: string, language: string): Problem[] {
  const problems: Problem[] = []
  const length = text.length
  const tabsRelevant = INDENTATION_SENSITIVE.has(language)
  let tabProblems = 0
  let lineNumber = 1
  let lineStart = 0

  while (lineStart <= length) {
    let end = lineStart
    while (end < length && text.charCodeAt(end) !== 10) end++
    // A carriage return is part of the line break, not of the line.
    let contentEnd = end
    if (contentEnd > lineStart && text.charCodeAt(contentEnd - 1) === 13) contentEnd--

    if (contentEnd - lineStart > MAX_LINE_LENGTH) {
      problems.push({
        line: lineNumber,
        column: 1,
        from: lineStart,
        to: contentEnd,
        severity: 'warning',
        message: `Line is longer than ${MAX_LINE_LENGTH} characters`,
        source: 'line-length',
      })
    }

    let whitespaceStart = contentEnd
    while (whitespaceStart > lineStart) {
      const code = text.charCodeAt(whitespaceStart - 1)
      if (code === 32 || code === 9) whitespaceStart--
      else break
    }
    if (whitespaceStart < contentEnd) {
      problems.push({
        line: lineNumber,
        column: whitespaceStart - lineStart + 1,
        from: whitespaceStart,
        to: contentEnd,
        severity: 'info',
        message: 'Trailing whitespace',
        source: 'whitespace',
      })
    }

    if (tabsRelevant && tabProblems < MAX_TAB_PROBLEMS) {
      let index = lineStart
      while (index < contentEnd) {
        const code = text.charCodeAt(index)
        if (code === 32) index++
        else if (code === 9) {
          problems.push({
            line: lineNumber,
            column: index - lineStart + 1,
            from: index,
            to: index + 1,
            severity: 'info',
            message: 'Tab character used for indentation',
            source: 'indentation',
          })
          tabProblems++
          break
        } else break
      }
    }

    if (end >= length) break
    lineStart = end + 1
    lineNumber++
  }

  if (length > 0 && text.charCodeAt(length - 1) !== 10) {
    const lastLine = doc.lineAt(length - 1)
    problems.push({
      line: lastLine.number,
      column: length - lastLine.from,
      from: length - 1,
      to: length,
      severity: 'info',
      message: 'No newline at the end of the file',
      source: 'eof',
    })
  }

  return problems
}

/* ------------------------------------------------------------------ *
 * Sorting and limiting
 * ------------------------------------------------------------------ */

/** Sort the problems by line and column. */
function sortProblems(problems: Problem[]): Problem[] {
  return problems.sort((a, b) => a.line - b.line || a.column - b.column || a.from - b.from)
}

/**
 * Cap the number of problems. Errors are never dropped: they are kept first
 * and the remaining room is filled with the other problems.
 */
function limitProblems(problems: Problem[]): Problem[] {
  if (problems.length <= MAX_PROBLEMS) return problems
  const errors = problems.filter((problem) => problem.severity === 'error')
  const others = problems.filter((problem) => problem.severity !== 'error')
  return sortProblems([...errors, ...others].slice(0, MAX_PROBLEMS))
}

/** Keep a number inside a range. */
function clamp(value: number, min: number, max: number): number {
  if (value < min) return min
  if (value > max) return max
  return value
}

/* ------------------------------------------------------------------ *
 * Markers in the editor
 * ------------------------------------------------------------------ */

/** Effect that replaces the markers of the editor. */
const setProblems = StateEffect.define<Problem[]>()

/** The decorations that paint the problems. */
const problemField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(value, tr) {
    let next = value.map(tr.changes)
    for (const effect of tr.effects) {
      if (!effect.is(setProblems)) continue
      const marks: Range<Decoration>[] = []
      const length = tr.newDoc.length
      for (const problem of effect.value) {
        const from = clamp(problem.from, 0, length)
        const to = clamp(Math.max(problem.to, from + 1), 0, length)
        if (to <= from) continue
        marks.push(Decoration.mark({ class: `cm-problem-range cm-problem-${problem.severity}` }).range(from, to))
      }
      next = Decoration.set(marks, true)
    }
    return next
  },
  provide: (field) => EditorView.decorations.from(field),
})

/** The look of the problem markers. */
const problemTheme = EditorView.baseTheme({
  '.cm-problem-range': {
    textDecoration: 'underline wavy',
    textDecorationSkipInk: 'none',
    textDecorationThickness: '1px',
  },
  '.cm-problem-error': { textDecorationColor: 'var(--danger)' },
  '.cm-problem-warning': { textDecorationColor: 'var(--warning)' },
  '.cm-problem-info': { textDecorationColor: 'var(--fg-muted)' },
})

/**
 * The CodeMirror extension that paints the problem markers. It is installed
 * automatically by {@link applyProblems}, but it can also be added to the
 * editor up front.
 */
export function diagnosticsExtension(): Extension {
  return [problemField, problemTheme]
}

/** Make sure that the extension is part of the state of the editor. */
function ensureInstalled(view: EditorView): void {
  if (view.state.field(problemField, false)) return
  view.dispatch({ effects: StateEffect.appendConfig.of(diagnosticsExtension()) })
}

/**
 * Push the problems into the editor so the ranges get a squiggly underline.
 */
export function applyProblems(view: EditorView, problems: Problem[]): void {
  ensureInstalled(view)
  view.dispatch({ effects: setProblems.of(problems) })
}

/** Clear the markers. */
export function clearProblems(view: EditorView): void {
  if (!view.state.field(problemField, false)) return
  view.dispatch({ effects: setProblems.of([]) })
}
