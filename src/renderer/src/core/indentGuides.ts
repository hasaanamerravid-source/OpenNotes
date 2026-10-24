import { StateField, type Extension, type Range } from '@codemirror/state'
import { Decoration, EditorView } from '@codemirror/view'

/**
 * Indent guides: the leading whitespace of every indented line gets a subtle
 * vertical rule every `tabSize` columns, like Notepad++ does.
 */
export function indentGuidesExtension(options: { tabSize: number; enabled: boolean }): Extension {
  return StateField.define<Range<Decoration>[]>({
    create: () => [],
    update: (value, tr) => {
      if (!options.enabled) return []
      if (!tr.docChanged && value.length) return value
      return buildGuides(tr.state, options.tabSize)
    },
    provide: (f) => EditorView.decorations.from(f, (marks) => Decoration.set(marks, true)),
  })
}

function buildGuides(
  state: { doc: { lines: number; line(n: number): { from: number; text: string } } },
  tabSize: number,
): Range<Decoration>[] {
  const marks: Range<Decoration>[] = []
  const limit = Math.min(state.doc.lines, 5000)
  const guide = Decoration.mark({ class: 'cm-indent-guides' })
  for (let i = 1; i <= limit; i++) {
    const line = state.doc.line(i)
    const text = line.text
    let indent = 0
    while (indent < text.length && (text[indent] === ' ' || text[indent] === '\t')) indent++
    if (indent < tabSize) continue
    marks.push(guide.range(line.from, line.from + indent))
  }
  return marks
}
