/**
 * Registry of live editor handles. Commands act on the focused editor through this map
 * so that no component needs to know about CodeMirror internals.
 */
export interface EditorSelection {
  from: number
  to: number
  text: string
}

export interface EditorStats {
  lines: number
  cols: number
  selection: number
  words: number
  chars: number
  selectedChars: number
}

export interface EditorHandle {
  id: string
  mode: 'code' | 'markdown'
  focus(): void
  getSelection(): EditorSelection
  replaceSelection(text: string): void
  insertText(text: string): void
  getContent(): string
  setContent(text: string): void
  undo(): void
  redo(): void
  /** Select the whole document (optional — not every editor kind supports it). */
  selectAll?(): void
  goToLine(line: number): void
  goToOffset(offset: number): void
  stats(): EditorStats
  isDirty(): boolean
  markClean(): void
  focusSearch(query?: string): void
  openSearchPanel(replace?: boolean): void
  findNext(): void
  findPrevious(): void
  destroy(): void
}

/** All handles of a tab (a split view registers two). */
const handles = new Map<string, Set<EditorHandle>>()

/** The handle of the pane that currently has the focus. */
let activeHandle: EditorHandle | null = null

export function registerEditor(handle: EditorHandle): () => void {
  let set = handles.get(handle.id)
  if (!set) {
    set = new Set()
    handles.set(handle.id, set)
  }
  set.add(handle)
  if (!activeHandle) activeHandle = handle
  return () => {
    set?.delete(handle)
    if (set && set.size === 0) handles.delete(handle.id)
    if (activeHandle === handle) activeHandle = null
  }
}

/** Mark a pane as the focused one (used by split view). */
export function setActiveEditor(handle: EditorHandle | null): void {
  activeHandle = handle
}

export function getEditor(id: string | null | undefined): EditorHandle | undefined {
  if (!id) return undefined
  if (activeHandle && activeHandle.id === id) return activeHandle
  const set = handles.get(id)
  if (!set) return undefined
  for (const handle of set) return handle
  return undefined
}

export function getAllEditors(): EditorHandle[] {
  const out: EditorHandle[] = []
  for (const set of handles.values()) for (const handle of set) out.push(handle)
  return out
}

export function destroyEditor(id: string): void {
  const set = handles.get(id)
  if (!set) return
  for (const handle of [...set]) handle.destroy()
  handles.delete(id)
  if (activeHandle?.id === id) activeHandle = null
}

/** Word / character count for a plain text string. */
export function countStats(text: string): { words: number; chars: number } {
  const words = text.trim() ? (text.trim().match(/\S+/g) ?? []).length : 0
  return { words, chars: text.length }
}
