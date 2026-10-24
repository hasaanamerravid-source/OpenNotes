/**
 * Project wide search and replace.
 *
 * The search runs in the main process: the renderer stays responsive while a
 * big folder is scanned.
 *
 * The folders that never contain source code are skipped (`node_modules`,
 * `target`, `.git`, ...) - they are the reason why a project search is slow
 * and useless in most editors.
 */

import { ipcMain } from 'electron'
import fs from 'node:fs/promises'
import type { Dirent } from 'node:fs'
import path from 'node:path'
import { decodeText, encodeText } from './fs'

/** What the user asked for. */
export interface SearchRequest {
  /** The folder that is searched. */
  folder: string
  /** The text that is searched. */
  query: string
  /** The search text is a regular expression. */
  regex?: boolean
  /** The case matters. */
  caseSensitive?: boolean
  /** The whole word has to match. */
  wholeWord?: boolean
  /** Only these files are searched (a simple glob, e.g. `*.ts`). */
  include?: string
  /** How many hits are returned at most. */
  maxResults?: number
  /** The text that replaces the hits. */
  replacement?: string
}

/** One hit. */
export interface SearchMatch {
  /** The path of the file. */
  path: string
  /** The line of the hit (1 based). */
  line: number
  /** The column of the hit (1 based). */
  column: number
  /** The whole line of the hit. */
  text: string
}

/** The answer of a search. */
export interface SearchResult {
  matches: SearchMatch[]
  /** How many files were read. */
  files: number
  /** How many files were skipped (too big or binary). */
  skipped: number
  /** True when the search stopped early (too many hits). */
  truncated: boolean
  /** How long the search took (milliseconds). */
  took: number
}

/** The answer of a replace. */
export interface ReplaceResult {
  /** How many files were changed. */
  changed: number
  /** How many hits were replaced. */
  replaced: number
  took: number
}

/** The folders that are never searched. */
const SKIPPED_FOLDERS = new Set([
  '.git',
  '.hg',
  '.svn',
  '.idea',
  '.vscode',
  '.vs',
  'node_modules',
  'bower_components',
  'jspm_packages',
  'vendor',
  'dist',
  'build',
  'out',
  'target',
  'bin',
  'obj',
  '.next',
  '.nuxt',
  '.svelte-kit',
  '.turbo',
  '.cache',
  '.parcel-cache',
  '.gradle',
  '.mvn',
  '.venv',
  'venv',
  'env',
  '__pycache__',
  '.pytest_cache',
  '.mypy_cache',
  '.tox',
  'coverage',
  'htmlcov',
  'site-packages',
  'Pods',
  'DerivedData',
  'tmp',
  'temp',
])

/** Files bigger than this are not searched. */
const MAX_FILE_BYTES = 4 * 1024 * 1024

/** The number of files that are read at most. */
const MAX_FILES = 20000

/** The number of hits that are returned at most. */
const MAX_RESULTS = 2000

/** Build the matcher of a request. */
function matcherOf(request: SearchRequest): RegExp | null {
  const query = request.query ?? ''
  if (!query) return null
  const flags = request.caseSensitive ? 'g' : 'gi'
  let source: string
  if (request.regex) {
    source = query
  } else {
    source = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }
  if (request.wholeWord) source = `\\b(?:${source})\\b`
  try {
    return new RegExp(source, flags)
  } catch {
    // A broken regular expression is searched as plain text.
    try {
      return new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags)
    } catch {
      return null
    }
  }
}

/** Does the file name match the glob of the request? */
function matchesGlob(name: string, glob: string): boolean {
  const pattern = glob.trim().toLowerCase()
  if (!pattern) return true
  if (pattern.includes('*')) {
    const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')
    try {
      return new RegExp(`^${escaped}$`).test(name.toLowerCase())
    } catch {
      return true
    }
  }
  return name.toLowerCase().endsWith(pattern)
}

/** A file that was found by the walk. */
interface FoundFile {
  path: string
  size: number
}

/** Walk the folder and collect the files that may be searched. */
async function collectFiles(folder: string, glob: string, limit: number): Promise<FoundFile[]> {
  const out: FoundFile[] = []
  const queue: string[] = [folder]
  while (queue.length > 0 && out.length < limit) {
    const current = queue.shift()
    if (!current) break
    let entries: Dirent[]
    try {
      entries = await fs.readdir(current, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      if (out.length >= limit) break
      const full = path.join(current, entry.name)
      if (entry.isDirectory()) {
        if (SKIPPED_FOLDERS.has(entry.name.toLowerCase())) continue
        if (entry.name.startsWith('.') && entry.name.length > 1 && !entry.name.startsWith('.github')) continue
        queue.push(full)
        continue
      }
      if (!entry.isFile()) continue
      if (entry.name.startsWith('.') && entry.name.length > 1) continue
      if (!matchesGlob(entry.name, glob)) continue
      try {
        const stats = await fs.stat(full)
        if (stats.size > MAX_FILE_BYTES) continue
        out.push({ path: full, size: stats.size })
      } catch {
        /* an unreadable file is skipped */
      }
    }
  }
  return out
}

/** The line and the column of an offset inside a text. */
function positionOf(text: string, offset: number): { line: number; column: number } {
  let line = 1
  let lineStart = 0
  for (let i = 0; i < offset; i++) {
    if (text.charCodeAt(i) === 10) {
      line++
      lineStart = i + 1
    }
  }
  return { line, column: offset - lineStart + 1 }
}

/** Search in the files of a folder. */
export async function searchInFiles(request: SearchRequest): Promise<SearchResult> {
  const started = Date.now()
  const matches: SearchMatch[] = []
  const matcher = matcherOf(request)
  if (!matcher || !request.folder) {
    return { matches, files: 0, skipped: 0, truncated: false, took: Date.now() - started }
  }
  const limit = Math.min(request.maxResults ?? MAX_RESULTS, MAX_RESULTS)
  const files = await collectFiles(request.folder, request.include ?? '', MAX_FILES)

  // The files are read by a few workers at the same time: a project is a lot
  // of small files and one by one would take minutes.
  const found: SearchMatch[][] = files.map(() => [])
  const skipped = new Array(files.length).fill(0)
  let cursor = 0
  const worker = async (): Promise<void> => {
    for (;;) {
      const index = cursor++
      if (index >= files.length) return
      if (matches.length >= limit) return
      const file = files[index]
      let text: string
      try {
        const buffer = await fs.readFile(file.path)
        const decoded = decodeText(buffer)
        if (decoded.binary) {
          skipped[index] = 1
          continue
        }
        text = decoded.text
      } catch {
        skipped[index] = 1
        continue
      }
      matcher.lastIndex = 0
      let match = matcher.exec(text)
      while (match !== null) {
        const at = match.index
        const position = positionOf(text, at)
        const lineStart = text.lastIndexOf('\n', at) + 1
        let lineEnd = text.indexOf('\n', at)
        if (lineEnd < 0) lineEnd = text.length
        found[index].push({
          path: file.path,
          line: position.line,
          column: position.column,
          text: text.slice(lineStart, lineEnd).slice(0, 400),
        })
        if (found[index].length >= 200) break
        // An empty match would loop forever.
        matcher.lastIndex = at + Math.max(1, match[0].length)
        match = matcher.exec(text)
      }
    }
  }
  await Promise.all(Array.from({ length: 8 }, () => worker()))

  for (const list of found) {
    for (const match of list) {
      if (matches.length >= limit) break
      matches.push(match)
    }
  }
  return {
    matches,
    files: files.length,
    skipped: skipped.reduce((sum, value) => sum + value, 0),
    truncated: matches.length >= limit,
    took: Date.now() - started,
  }
}

/** Replace the hits in the files of a folder. */
export async function replaceInFiles(request: SearchRequest): Promise<ReplaceResult> {
  const started = Date.now()
  const matcher = matcherOf(request)
  if (!matcher || !request.folder) return { changed: 0, replaced: 0, took: Date.now() - started }
  const files = await collectFiles(request.folder, request.include ?? '', MAX_FILES)
  let changed = 0
  let replaced = 0
  for (const file of files) {
    let buffer: Buffer
    try {
      buffer = await fs.readFile(file.path)
    } catch {
      continue
    }
    const decoded = decodeText(buffer)
    if (decoded.binary) continue
    const text = decoded.text
    matcher.lastIndex = 0
    if (!matcher.test(text)) {
      matcher.lastIndex = 0
      continue
    }
    matcher.lastIndex = 0
    const count = countMatches(text, matcher)
    const next = text.replace(matcher, request.replacement ?? '')
    try {
      // The file keeps its encoding (a UTF-16 file stays UTF-16).
      await fs.writeFile(file.path, encodeText(next, decoded.encoding))
      changed++
      replaced += count
    } catch {
      /* a file that cannot be written is skipped */
    }
  }
  return { changed, replaced, took: Date.now() - started }
}

/** How often does the matcher hit? */
function countMatches(text: string, matcher: RegExp): number {
  let count = 0
  matcher.lastIndex = 0
  let found = matcher.exec(text)
  while (found !== null) {
    count++
    matcher.lastIndex = found.index + Math.max(1, found[0].length)
    found = matcher.exec(text)
  }
  matcher.lastIndex = 0
  return count
}

/** Register the handlers of the project search. */
export function registerSearchHandlers(): void {
  ipcMain.handle('fs:search', async (_event, request: SearchRequest): Promise<SearchResult> => {
    try {
      return await searchInFiles(request)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return { matches: [], files: 0, skipped: 0, truncated: false, took: 0, error: message } as SearchResult
    }
  })

  ipcMain.handle('fs:replaceInFiles', async (_event, request: SearchRequest): Promise<ReplaceResult> => {
    try {
      return await replaceInFiles(request)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return { changed: 0, replaced: 0, took: 0, error: message } as ReplaceResult
    }
  })
}
