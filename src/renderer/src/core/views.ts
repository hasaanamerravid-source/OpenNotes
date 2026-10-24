import type { EditorView } from '@codemirror/view'

const views = new Map<string, EditorView>()

/** Views that share the same document (split view). */
const groups = new Map<string, Set<EditorView>>()

/** Keep a reference to the live CodeMirror view of a tab. */
export function registerView(id: string, view: EditorView): () => void {
  views.set(id, view)
  return () => {
    if (views.get(id) === view) views.delete(id)
  }
}

export function getView(id: string | null | undefined): EditorView | undefined {
  if (!id) return undefined
  return views.get(id)
}

export function getAllViews(): EditorView[] {
  return [...views.values()]
}

/** Join a view to a split group. */
export function joinGroup(group: string, view: EditorView): () => void {
  let set = groups.get(group)
  if (!set) {
    set = new Set()
    groups.set(group, set)
  }
  set.add(view)
  return () => {
    set?.delete(view)
    if (set && set.size === 0) groups.delete(group)
  }
}

/** All other views that belong to the same split group. */
export function peersOf(group: string, self: EditorView): EditorView[] {
  const set = groups.get(group)
  if (!set) return []
  return [...set].filter((v) => v !== self)
}
