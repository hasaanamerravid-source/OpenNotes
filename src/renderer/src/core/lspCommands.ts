/**
 * The commands that use the language servers: go to definition, find
 * references and restart a server.
 *
 * The servers answer with LSP locations: a file uri and a range. The commands
 * turn them into a jump inside the editor.
 */

import { create } from 'zustand'
import { useAppStore } from '../store/app'
import { getEditor } from './editors'
import { useLspStore } from './lspState'
import { fileUri, pathFromUri } from './lspIntegration'
import type { Problem } from './diagnostics'

/** A place in a file, as the language servers describe it. */
interface LspLocation {
  uri: string
  range: { start: { line: number; character: number }; end?: { line: number; character: number } }
}

/** Read the locations out of every shape the protocol allows. */
export function readLocations(raw: unknown): LspLocation[] {
  if (!raw) return []
  const list = Array.isArray(raw) ? raw : [raw]
  const out: LspLocation[] = []
  for (const entry of list) {
    if (!entry || typeof entry !== 'object') continue
    const item = entry as Record<string, unknown>
    const uri = (item.uri ?? item.targetUri) as string | undefined
    const range = (item.range ?? item.targetSelectionRange ?? item.targetRange) as
      { start: { line: number; character: number } } | undefined
    if (!uri || !range?.start) continue
    out.push({ uri, range })
  }
  return out
}

/** The offset of a line and a column in a text. */
export function offsetOf(text: string, line: number, character: number): number {
  const lines = text.split('\n')
  let offset = 0
  for (let i = 0; i < line && i < lines.length; i++) offset += lines[i].length + 1
  return offset + character
}

/** The line and the column of an offset in a text. */
export function positionOf(text: string, offset: number): { line: number; character: number } {
  const before = text.slice(0, offset)
  const line = before.split('\n').length - 1
  const character = offset - (before.lastIndexOf('\n') + 1)
  return { line, character }
}

/** The references that the "find references" command found. */
interface ReferenceState {
  problems: Problem[]
  locations: LspLocation[]
  setProblems: (problems: Problem[], locations: LspLocation[]) => void
  clear: () => void
}

export const useReferenceStore = create<ReferenceState>((set) => ({
  problems: [],
  locations: [],
  setProblems: (problems, locations) => set({ problems, locations }),
  clear: () => set({ problems: [], locations: [] }),
}))

/** The place a reference problem points at. */
export function referenceLocation(problem: Problem): LspLocation | undefined {
  const { problems, locations } = useReferenceStore.getState()
  const index = problems.indexOf(problem)
  return index >= 0 ? locations[index] : undefined
}

/** Jump to a place a language server pointed at. */
export async function jumpTo(location: LspLocation): Promise<void> {
  const state = useAppStore.getState()
  const path = pathFromUri(location.uri)
  const line = location.range.start.line + 1
  const column = location.range.start.character

  const activeTab = state.tabs.find((t) => t.id === state.activeTabId)
  if (activeTab?.path && activeTab.path.toLowerCase() === path.toLowerCase()) {
    const editor = getEditor(activeTab.id)
    const text = activeTab.content ?? ''
    editor?.goToOffset(offsetOf(text, location.range.start.line, column))
    editor?.focus()
    return
  }

  // The place is in another file: open it and jump there.
  await state.openPath(path)
  const opened = useAppStore.getState()
  const tab = opened.tabs.find((t) => t.id === opened.activeTabId)
  if (!tab) return
  const editor = getEditor(tab.id)
  if (!editor) return
  const offset = offsetOf(tab.content ?? '', location.range.start.line, column)
  editor.goToOffset(offset)
  editor.focus()
  void line
  void column
}

/** The active file and the position of the cursor in it. */
function current(): { path: string; language: string; uri: string; line: number; character: number } | null {
  const state = useAppStore.getState()
  const tab = state.tabs.find((t) => t.id === state.activeTabId)
  if (!tab?.path) return null
  const editor = getEditor(state.activeTabId)
  if (!editor) return null
  const selection = editor.getSelection()
  const position = positionOf(tab.content ?? '', selection.from)
  return {
    path: tab.path,
    language: tab.language || 'text',
    uri: fileUri(tab.path),
    line: position.line,
    character: position.character,
  }
}

/** Ask the server of the active file where a symbol is defined. */
export async function goToDefinition(): Promise<void> {
  const state = useAppStore.getState()
  const at = current()
  if (!at) return
  const result = await useLspStore.getState().request(at.language, 'textDocument/definition', {
    textDocument: { uri: at.uri },
    position: { line: at.line, character: at.character },
  })
  const locations = readLocations(result)
  if (!locations.length) {
    state.toast(
      at.language === 'text'
        ? 'This file has no language server'
        : `No definition found (the ${at.language} server did not answer)`,
      'error',
    )
    return
  }
  await jumpTo(locations[0])
}

/** Ask the server of the active file where a symbol is used. */
export async function findReferences(): Promise<void> {
  const state = useAppStore.getState()
  const at = current()
  if (!at) return
  const result = await useLspStore.getState().request(at.language, 'textDocument/references', {
    textDocument: { uri: at.uri },
    position: { line: at.line, character: at.character },
    context: { includeDeclaration: true },
  })
  const locations = readLocations(result)
  if (!locations.length) {
    state.toast('No references found', 'error')
    return
  }
  // The references are shown in the problems panel: clicking one jumps there.
  const problems: Problem[] = locations.map((location) => ({
    line: location.range.start.line + 1,
    column: location.range.start.character + 1,
    from: 0,
    to: 0,
    severity: 'info',
    message: `${pathFromUri(location.uri).split(/[\\/]/).pop() ?? 'file'} — reference`,
    source: 'references',
  }))
  useReferenceStore.getState().setProblems(problems, locations)
  state.setBottomTab('problems')
  state.setBottomPanelVisible(true)
  state.toast(`${locations.length} reference${locations.length === 1 ? '' : 's'} found`, 'success')
}

/** The language of the active file. */
export function activeLanguageOf(): string {
  const state = useAppStore.getState()
  const tab = state.tabs.find((t) => t.id === state.activeTabId)
  return tab?.language || 'text'
}

/**
 * Jump to a problem of the problems panel: a reference of the language server
 * points at a place in a file, every other problem points at a line of the
 * file that is open.
 */
export async function jumpToProblem(problem: Problem): Promise<void> {
  const location = referenceLocation(problem)
  if (location) {
    await jumpTo(location)
    return
  }
  const state = useAppStore.getState()
  const tab = state.tabs.find((t) => t.id === state.activeTabId)
  if (!tab) return
  getEditor(tab.id)?.goToLine(problem.line)
}
