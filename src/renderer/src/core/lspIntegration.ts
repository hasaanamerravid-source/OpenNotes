/**
 * The glue between the editor and the language servers.
 *
 * The main process runs the servers (`src/main/ipc/lsp.ts`), the renderer keeps
 * their state (`src/renderer/src/core/lspState.ts`). This module keeps both in
 * sync with the open files and turns the answers of a server into jumps inside
 * the editor.
 */

import { useEffect, useRef } from 'react'
import type { EditorView } from '@codemirror/view'
import { useAppStore } from '../store/app'
import { getView } from './views'
import { useLspStore, type LspProblem } from './lspState'
import type { Problem } from './diagnostics'

/** Turn a path into a `file:` uri (the same shape the main process uses). */
export function fileUri(filePath: string): string {
  if (!filePath) return ''
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(filePath)) return filePath
  try {
    // A `#` or a `?` in a name would be read as a fragment or a query, so
    // they are encoded.
    const normalized = filePath.replace(/\\/g, '/').replace(/#/g, '%23').replace(/\?/g, '%3F')
    const rooted = normalized.startsWith('/') ? normalized : `/${normalized}`
    return new URL(`file://${rooted}`).href
  } catch {
    return filePath
  }
}

/** Turn a `file:` uri into a path. */
export function pathFromUri(uri: string): string {
  if (!uri) return ''
  if (!/^file:\/\//i.test(uri)) return uri
  try {
    const path = decodeURIComponent(new URL(uri).pathname).replace(/^\/([a-zA-Z]:)/, '$1')
    // Windows paths use backslashes, the uri always uses slashes.
    return process.platform === 'win32' ? path.replace(/\//g, '\\') : path
  } catch {
    return uri
  }
}

/** The problems a language server published for a file. */
export function lspProblemsForPath(filePath: string): LspProblem[] {
  if (!filePath) return []
  const wanted = filePath.toLowerCase().replace(/\//g, '\\')
  const all = useLspStore.getState().problems
  const found: LspProblem[] = []
  for (const [uri, problems] of Object.entries(all)) {
    if (pathFromUri(uri).toLowerCase().replace(/\//g, '\\') === wanted) found.push(...problems)
  }
  return found
}

/** The problems of a language server as the problems of the editor. */
export function asProblems(list: LspProblem[]): Problem[] {
  return list.map((problem) => ({
    line: problem.line,
    column: problem.column,
    from: problem.from,
    to: problem.to,
    severity: problem.severity,
    message: problem.message,
    source: problem.source || 'lsp',
  }))
}

/**
 * Files bigger than this are not sent to a language server: the copy would
 * take seconds on every change.
 */
export const MAX_LSP_BYTES = 1_000_000

/**
 * Keeps the language servers in sync with the open files: a file that is
 * opened is sent to its server, a change is sent as a change and a file that is
 * closed is taken away from the server.
 */
export function useLspSync(): void {
  const activeTabId = useAppStore((s) => s.activeTabId)
  const path = useAppStore((s) => s.tabs.find((t) => t.id === s.activeTabId)?.path ?? '')
  const language = useAppStore((s) => s.tabs.find((t) => t.id === s.activeTabId)?.language ?? 'text')
  const content = useAppStore((s) => s.tabs.find((t) => t.id === s.activeTabId)?.content ?? '')
  const large = useAppStore((s) => s.tabs.find((t) => t.id === s.activeTabId)?.largeFile ?? false)
  const previous = useRef<{ uri: string; language: string } | null>(null)

  useEffect(() => {
    if (!path) return
    const uri = fileUri(path)
    const store = useLspStore.getState()
    // The file that was open before is taken away from its server.
    if (previous.current && previous.current.uri !== uri) {
      store.close(previous.current.language, previous.current.uri)
    }
    // A huge file is not sent to a server: the copy would freeze the editor.
    if (large || content.length > MAX_LSP_BYTES) {
      previous.current = { uri, language }
      return
    }
    store.open(language, uri, content)
    previous.current = { uri, language }
    // The change is sent a moment after the last keystroke: the servers are
    // much slower than the user types.
    const timer = window.setTimeout(() => {
      useLspStore.getState().change(language, uri, content)
    }, 600)
    return () => window.clearTimeout(timer)
  }, [activeTabId, path, language, content, large])

  useEffect(() => {
    const last = previous
    return () => {
      if (last.current) useLspStore.getState().close(last.current.language, last.current.uri)
    }
  }, [])
}

/** The position of the cursor in the active editor (LSP uses 0 based lines). */
export function cursorPosition(view: EditorView | undefined): { line: number; character: number } | null {
  if (!view) return null
  const head = view.state.selection.main.head
  const line = view.state.doc.lineAt(head)
  return { line: line.number - 1, character: head - line.from }
}

/** The editor of the active tab. */
export function activeView(): EditorView | undefined {
  const state = useAppStore.getState()
  return getView(state.activeTabId)
}

/** The language of the active tab. */
export function activeLanguage(): string {
  const state = useAppStore.getState()
  const tab = state.tabs.find((t) => t.id === state.activeTabId)
  return tab?.language || 'text'
}

/** The path of the active tab. */
export function activePath(): string {
  const state = useAppStore.getState()
  const tab = state.tabs.find((t) => t.id === state.activeTabId)
  return tab?.path ?? ''
}
