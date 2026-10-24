import { StateEffect, StateField, type Extension, type Range } from '@codemirror/state'
import { Decoration, EditorView } from '@codemirror/view'

/** Toggle a bookmark on the given 1-based line number. */
export const toggleBookmark = StateEffect.define<number>()

/** The set of bookmarked line numbers of a document. */
export const bookmarkField = StateField.define<Set<number>>({
  create: () => new Set(),
  update: (value, tr) => {
    let next: Set<number> | null = null
    for (const effect of tr.effects) {
      if (effect.is(toggleBookmark)) {
        next = next ?? new Set(value)
        if (next.has(effect.value)) next.delete(effect.value)
        else next.add(effect.value)
      }
    }
    return next ?? value
  },
  provide: (f) =>
    EditorView.decorations.compute([f], (state) => {
      const marks: Range<Decoration>[] = []
      const set = state.field(f)
      for (const line of set) {
        if (line < 1 || line > state.doc.lines) continue
        marks.push(Decoration.line({ class: 'cm-bookmark-line' }).range(state.doc.line(line).from))
      }
      return Decoration.set(marks, true)
    }),
})

/** The CodeMirror extension that powers bookmarks. */
export function bookmarkExtension(): Extension {
  return bookmarkField
}

/** Toggle the bookmark on the current line. */
export function toggleBookmarkAt(view: EditorView): void {
  const line = view.state.doc.lineAt(view.state.selection.main.head).number
  view.dispatch({ effects: toggleBookmark.of(line) })
}

/** Jump to the next (direction 1) or previous (direction -1) bookmark. */
export function jumpToBookmark(view: EditorView, direction: 1 | -1): void {
  const bookmarks = [...view.state.field(bookmarkField)].sort((a, b) => a - b)
  if (!bookmarks.length) return
  const current = view.state.doc.lineAt(view.state.selection.main.head).number
  let target: number | undefined
  if (direction === 1) {
    target = bookmarks.find((line) => line > current) ?? bookmarks[0]
  } else {
    const before = bookmarks.filter((line) => line < current)
    target = before.length ? before[before.length - 1] : bookmarks[bookmarks.length - 1]
  }
  const pos = view.state.doc.line(target).from
  view.dispatch({ selection: { anchor: pos }, scrollIntoView: true })
  view.focus()
}

/** All bookmarked lines of a document. */
export function bookmarksOf(view: EditorView): number[] {
  return [...view.state.field(bookmarkField)].sort((a, b) => a - b)
}
