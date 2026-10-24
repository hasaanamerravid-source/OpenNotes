import { StateEffect, StateField, type Extension, type Range, type Text } from '@codemirror/state'
import { Decoration, EditorView, type DecorationSet } from '@codemirror/view'

/** Set (or clear) the term whose occurrences should be highlighted. */
export const setHighlightAll = StateEffect.define<string | null>()

const mark = Decoration.mark({ class: 'cm-searchMatch' })

function build(term: string | null, doc: Text): DecorationSet {
  if (!term) return Decoration.none
  const ranges: Range<Decoration>[] = []
  const text = doc.toString()
  const needle = term.toLowerCase()
  if (!needle) return Decoration.none
  const haystack = text.toLowerCase()
  let index = haystack.indexOf(needle)
  while (index >= 0) {
    ranges.push(mark.range(index, index + needle.length))
    index = haystack.indexOf(needle, index + needle.length)
  }
  return Decoration.set(ranges, true)
}

/** Highlight every occurrence of a term in the document. */
export function highlightAllExtension(): Extension {
  return StateField.define<{ term: string | null; decorations: DecorationSet }>({
    create: () => ({ term: null, decorations: Decoration.none }),
    update(value, tr) {
      let term = value.term
      let changed = false
      for (const effect of tr.effects) {
        if (effect.is(setHighlightAll)) {
          term = effect.value
          changed = true
        }
      }
      if (tr.docChanged && term) changed = true
      if (!changed) return value
      return { term, decorations: build(term, tr.state.doc) }
    },
    provide: (f) => EditorView.decorations.from(f, (v) => v.decorations),
  })
}
