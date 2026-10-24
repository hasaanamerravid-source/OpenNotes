import type { JSX } from 'react'
import { useEffect, useRef } from 'react'
import { EditorState, Compartment, type Extension } from '@codemirror/state'
import {
  EditorView,
  keymap,
  drawSelection,
  highlightActiveLine,
  highlightActiveLineGutter,
  lineNumbers,
  rectangularSelection,
  crosshairCursor,
  highlightSpecialChars,
  dropCursor,
  placeholder as cmPlaceholder,
} from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab, standardKeymap, undo, redo } from '@codemirror/commands'
import {
  searchKeymap,
  highlightSelectionMatches,
  search,
  openSearchPanel,
  findNext,
  findPrevious,
  setSearchQuery,
  SearchQuery,
} from '@codemirror/search'
import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  completeAnyWord,
  completionKeymap,
  type Completion,
  type CompletionResult,
  type CompletionSource,
} from '@codemirror/autocomplete'
import { bracketMatching, foldGutter, foldKeymap, indentOnInput, indentUnit } from '@codemirror/language'
import { lintKeymap } from '@codemirror/lint'
import { syntaxHighlighting } from '@codemirror/language'
import { resolveTheme } from '../../core/themeResolver'
import type { Tab } from '@shared/types'
import { useAppStore } from '../../store/app'
import { useStatusStore } from '../../store/status'
import { registerEditor, setActiveEditor, countStats, type EditorHandle } from '../../core/editors'
import { languageExtension } from '../../core/languages'
import { registerView, joinGroup, peersOf } from '../../core/views'
import { highlightAllExtension } from '../../core/highlightAll'
import { bookmarkExtension } from '../../core/bookmarks'
import { indentGuidesExtension } from '../../core/indentGuides'

export interface CodeEditorProps {
  tab: Tab
  /** Called when the editor is ready with a handle for external commands. */
  onReady?: (handle: EditorHandle) => void
  /** Called with the full document text whenever it changes. */
  onContentChange?: (content: string) => void
  /** Called with the underlying CodeMirror view (for the minimap). */
  onViewReady?: (view: EditorView | null) => void
  /** Views sharing a group edit the same buffer (split view). */
  syncGroup?: string
}

function buildTheme(settings: {
  fontFamily: string
  fontSize: number
  tabSize: number
  syntaxTheme: string
  editorBackground: 'app' | 'theme'
}): Extension {
  const theme = resolveTheme(settings.syntaxTheme)
  const c = theme.editor
  const dark = theme.dark
  // With "app" the editor surface uses the very same colours as the rest of
  // the window, so the code area blends into the chrome. The token colours
  // always come from the syntax theme.
  const app = settings.editorBackground === 'app'
  const background = app ? 'var(--bg-editor)' : c.background
  const foreground = app ? 'var(--fg)' : c.foreground
  const gutterBackground = app ? 'var(--bg-editor)' : c.gutterBackground
  const gutterForeground = app ? 'var(--fg-muted)' : c.gutterForeground
  const activeGutterForeground = app ? 'var(--fg)' : c.activeGutterForeground
  const activeLine = app ? 'var(--bg-hover)' : c.activeLine
  const selection = app ? 'var(--sel)' : c.selection
  const caret = app ? 'var(--fg-bright)' : c.caret
  const matchingBracket = app ? 'var(--accent-soft)' : c.matchingBracket
  const searchMatch = app ? 'var(--accent-soft)' : c.searchMatch
  const indentGuide = app ? 'var(--border)' : c.indentGuide
  const lineNumber = app ? 'var(--fg-muted)' : c.lineNumber
  return EditorView.theme(
    {
      '&': {
        color: foreground,
        backgroundColor: background,
        fontSize: `${settings.fontSize}px`,
        height: '100%',
        fontFamily: settings.fontFamily,
        '--cm-tab-size': String(settings.tabSize ?? 4),
      },
      '.cm-scroller': {
        fontFamily: settings.fontFamily,
        lineHeight: '1.55',
        overflow: 'auto',
      },
      '.cm-content': { padding: '8px 0 40vh' },
      '.cm-gutters': {
        backgroundColor: gutterBackground,
        color: gutterForeground,
        border: 'none',
        minWidth: '44px',
      },
      '.cm-activeLine': { backgroundColor: activeLine },
      '.cm-activeLineGutter': {
        backgroundColor: activeLine,
        color: activeGutterForeground,
      },
      '.cm-lineNumbers .cm-gutterElement': { color: lineNumber },
      '.cm-cursor, .cm-dropCursor': { borderLeftColor: caret },
      '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
        backgroundColor: selection,
      },
      '.cm-selectionMatch': { backgroundColor: searchMatch },
      '.cm-searchMatch': { backgroundColor: searchMatch },
      '.cm-searchMatch.cm-searchMatch-selected': { backgroundColor: matchingBracket },
      '.cm-matchingBracket, &.cm-focused .cm-matchingBracket': {
        backgroundColor: matchingBracket,
        outline: `1px solid ${foreground}`,
      },
      '.cm-panels': {
        backgroundColor: gutterBackground,
        color: foreground,
        borderTop: `1px solid ${gutterForeground}`,
      },
      '.cm-panels input, .cm-panels button': {
        backgroundColor: background,
        color: foreground,
        border: `1px solid ${gutterForeground}`,
        borderRadius: '4px',
        padding: '2px 6px',
      },
      '.cm-tooltip': {
        backgroundColor: background,
        border: `1px solid ${gutterForeground}`,
        color: foreground,
      },
      '.cm-tooltip-autocomplete ul li[aria-selected]': {
        backgroundColor: selection,
        color: foreground,
      },
      '.cm-foldPlaceholder': {
        backgroundColor: gutterBackground,
        border: 'none',
        color: foreground,
        borderRadius: '4px',
        padding: '0 6px',
      },
      '.cm-indent-guides': { borderLeft: `1px solid ${indentGuide}` },
      '.cm-selectionLayer .cm-selectionBackground': { opacity: 0.25 },
      '.cm-bookmark-line': {
        background: 'rgba(249, 226, 175, 0.14)',
        boxShadow: 'inset 3px 0 0 var(--warning)',
      },
    },
    { dark },
  )
}

/* ------------------------------------------------------------------ *
 * Snippet completions                                                *
 * ------------------------------------------------------------------ */

/** A snippet completion that inserts a template with ${1}, ${2} tab stops. */
function snippet(label: string, body: string, detail: string): Completion {
  return {
    label,
    type: 'snippet',
    detail,
    apply: body,
  }
}

/** Snippet source for a given language id. Returns null when the language has none. */
function snippetSource(language: string): CompletionSource | null {
  const common = [
    snippet('for', 'for (${1:const i = 0}; ${1} < ${2:len}; ${1}++) {\n\t${3:// body}\n}', 'for loop'),
    snippet('while', 'while (${1:condition}) {\n\t${2:// body}\n}', 'while loop'),
    snippet('if', 'if (${1:condition}) {\n\t${2:// body}\n}', 'if statement'),
    snippet('ifelse', 'if (${1:condition}) {\n\t${2:// body}\n} else {\n\t${3:// body}\n}', 'if / else'),
    snippet('fn', 'function ${1:name}(${2:params}) {\n\t${3:// body}\n}', 'function'),
    snippet('try', 'try {\n\t${1:// body}\n} catch (${2:error}) {\n\t${3:// handle}\n}', 'try / catch'),
  ]
  const byLanguage: Record<string, Completion[]> = {
    javascript: [
      ...common,
      snippet('class', 'class ${1:Name} {\n\t${2:// body}\n}', 'class'),
      snippet('arrow', 'const ${1:name} = (${2:params}) => {\n\t${3:// body}\n}', 'arrow function'),
      snippet('promise', 'new Promise((resolve, reject) => {\n\t${1:// body}\n})', 'promise'),
    ],
    typescript: [
      ...common,
      snippet('interface', 'interface ${1:Name} {\n\t${2:// body}\n}', 'interface'),
      snippet('type', 'type ${1:Name} = ${2:// type}\n', 'type alias'),
      snippet('class', 'class ${1:Name} {\n\t${2:// body}\n}', 'class'),
    ],
    python: [
      ...common,
      snippet('def', 'def ${1:name}(${2:params}):\n\t${3:// body}\n', 'function'),
      snippet('class', 'class ${1:Name}:\n\t${2:// body}\n', 'class'),
      snippet('try', 'try:\n\t${1:// body}\nexcept ${2:Exception} as ${3:e}:\n\t${4:// handle}\n', 'try / except'),
    ],
    java: [
      ...common,
      snippet(
        'class',
        'public class ${1:Name} {\n\tpublic static void main(String[] args) {\n\t\t${2:// body}\n\t}\n}',
        'class',
      ),
      snippet('method', 'public ${1:void} ${2:name}(${3:params}) {\n\t${4:// body}\n}', 'method'),
      snippet('main', 'public static void main(String[] args) {\n\t${1:// body}\n}', 'main method'),
    ],
  }
  const list = byLanguage[language]
  if (!list) return null
  return (context): CompletionResult | null => ({ from: context.pos, options: list })
}

/* ------------------------------------------------------------------ *
 * Parameter hints                                                    *
 * ------------------------------------------------------------------ */

/** Common function signatures shown when the user types "(" after a known name. */
const PARAM_HINTS: Record<string, string> = {
  log: 'log(message: any, ...optionalParams: any[]): void',
  warn: 'warn(message: any, ...optionalParams: any[]): void',
  error: 'error(message: any, ...optionalParams: any[]): void',
  setTimeout: 'setTimeout(callback: () => void, delay: number): number',
  setInterval: 'setInterval(callback: () => void, delay: number): number',
  fetch: 'fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>',
  parseInt: 'parseInt(string: string, radix?: number): number',
  parseFloat: 'parseFloat(string: string): number',
  Math_max: 'Math.max(...values: number[]): number',
  Math_min: 'Math.min(...values: number[]): number',
  println: 'println(message?: any): void',
  print: 'print(message?: any): void',
}

function paramHintFor(word: string): string | null {
  return PARAM_HINTS[word] ?? null
}

/**
 * The compartments are shared by every editor instance. That way two views of
 * the same document (split view) can share one state without fighting over
 * their configuration.
 */
const wrapCompartment = new Compartment()
const langCompartment = new Compartment()
const themeCompartment = new Compartment()
const editCompartment = new Compartment()
const gutterCompartment = new Compartment()
const guideCompartment = new Compartment()
const invisiblesCompartment = new Compartment()
const behaviourCompartment = new Compartment()

/** Guards the split-view state synchronisation against infinite recursion. */
let forwarding = false

export function CodeEditor({ tab, onReady, onContentChange, onViewReady, syncGroup }: CodeEditorProps): JSX.Element {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const viewRef = useRef<EditorView | null>(null)
  const changeRef = useRef(onContentChange)
  changeRef.current = onContentChange
  const syncTimer = useRef<number | null>(null)
  const settings = useAppStore((s) => s.settings)
  const setTabDirty = useAppStore((s) => s.setTabDirty)
  const statusSet = useStatusStore((s) => s.set)

  useEffect(() => {
    if (!hostRef.current) return
    let disposed = false
    const settingsNow = useAppStore.getState().settings

    const state = EditorState.create({
      doc: tab.content ?? '',
      extensions: [
        gutterCompartment.of(settingsNow.showLineNumbers ? lineNumbers() : []),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        invisiblesCompartment.of(settingsNow.showInvisibles ? highlightSpecialChars() : []),
        history(),
        drawSelection(),
        dropCursor(),
        EditorState.allowMultipleSelections.of(true),
        behaviourCompartment.of([
          settingsNow.autoIndent ? indentOnInput() : [],
          settingsNow.matchBrackets ? bracketMatching() : [],
          settingsNow.autoCloseBrackets ? closeBrackets() : [],
        ]),
        indentUnit.of(settingsNow.insertSpaces ? ' '.repeat(settingsNow.tabSize) : '\t'),
        autocompletion(),
        rectangularSelection(),
        crosshairCursor(),
        highlightSelectionMatches(),
        search({ top: true }),
        foldGutter({
          markerDOM: (open) => {
            const span = document.createElement('span')
            span.textContent = open ? '▾' : '▸'
            span.style.cursor = 'pointer'
            span.style.opacity = '0.7'
            span.style.padding = '0 4px'
            return span
          },
        }),
        keymap.of([
          ...closeBracketsKeymap,
          ...defaultKeymap,
          ...searchKeymap,
          ...historyKeymap,
          ...foldKeymap,
          ...completionKeymap,
          ...lintKeymap,
          indentWithTab,
          ...standardKeymap,
        ]),
        wrapCompartment.of(settingsNow.lineWrapping ? EditorView.lineWrapping : []),
        langCompartment.of(tab.largeFile ? [] : languageExtension(tab.language)),
        // Buffer-word completion: Ctrl+Space (and typing) complete words that
        // already appear in the current file. Added on top of any per-language
        // completion sources (e.g. markdown links) via the languageData facet.
        EditorState.languageData.of((_state, _pos, _side) => [
          { name: 'autocomplete', value: completeAnyWord },
          ...(snippetSource(tab.language) ? [{ name: 'autocomplete', value: snippetSource(tab.language) }] : []),
        ]),
        themeCompartment.of(buildTheme(settingsNow)),
        editCompartment.of([EditorState.tabSize.of(settingsNow.tabSize), EditorState.readOnly.of(tab.readonly)]),
        syntaxHighlighting(resolveTheme(settingsNow.syntaxTheme).style),
        highlightAllExtension(),
        bookmarkExtension(),
        guideCompartment.of(
          indentGuidesExtension({ tabSize: settingsNow.tabSize, enabled: settingsNow.showIndentGuides }),
        ),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            setTabDirty(tab.id, true)
            const text = update.state.doc.toString()
            changeRef.current?.(text)
            // Keep the store in sync (tab switches, session restore) without
            // re-rendering on every keystroke. Large files are skipped:
            // copying megabytes per keystroke would freeze the editor.
            if (tab.largeFile) return
            if (text.length > 2_000_000) return
            if (syncTimer.current !== null) window.clearTimeout(syncTimer.current)
            syncTimer.current = window.setTimeout(() => {
              useAppStore.getState().updateTab(tab.id, { content: text })
            }, 400)
          }
          // Split view: the other pane shows the same document, so it gets the
          // very same state (contents, selection and configuration).
          if (syncGroup && update.transactions.length > 0 && !forwarding) {
            const peers = peersOf(syncGroup, view)
            if (peers.length) {
              forwarding = true
              try {
                for (const peer of peers) {
                  if (peer.state !== update.state) peer.setState(update.state)
                }
              } catch {
                /* a pane that was closed in the meantime */
              } finally {
                forwarding = false
              }
            }
          }
          if (update.selectionSet || update.docChanged) {
            const pos = update.state.selection.main
            const line = update.state.doc.lineAt(pos.head)
            const before = update.state.doc.sliceString(0, pos.head)
            const col = pos.head - line.from + 1
            const lineNo = update.state.doc.lineAt(pos.head).number
            void before
            const text = update.state.doc.toString()
            const { words, chars } = countStats(text)
            statusSet({
              line: lineNo,
              col,
              selChars: Math.abs(pos.to - pos.from),
              selLines: update.state.doc.lineAt(pos.to).number - line.number,
              totalLines: update.state.doc.lines,
              totalChars: chars,
              words,
              dirty: true,
            })
          }
        }),
        EditorView.domEventHandlers({
          focus: () => {
            setActiveEditor(handle)
            return false
          },
          dragover: (event, view) => {
            event.preventDefault()
            view.dom.classList.add('cm-dragging')
            return false
          },
          drop: (event, view) => {
            view.dom.classList.remove('cm-dragging')
            return false
          },
          dragleave: (_event, view) => {
            view.dom.classList.remove('cm-dragging')
            return false
          },
        }),
      ],
    })

    const view = new EditorView({ state, parent: hostRef.current })
    viewRef.current = view
    if (typeof tab.cursor === 'number' && tab.cursor > 0) {
      const pos = Math.min(tab.cursor, view.state.doc.length)
      view.dispatch({ selection: { anchor: pos } })
    }
    {
      const text = view.state.doc.toString()
      const { words, chars } = countStats(text)
      statusSet({
        line: 1,
        col: 1,
        selChars: 0,
        selLines: 0,
        totalLines: view.state.doc.lines,
        totalChars: chars,
        words,
      })
    }
    if (!disposed) {
      const current = useAppStore.getState().tabs.find((t) => t.id === tab.id)
      if (current && !current.dirty) setTabDirty(tab.id, false)
    }

    const handle: EditorHandle = {
      id: tab.id,
      mode: tab.mode === 'markdown' ? 'markdown' : 'code',
      focus: () => view.focus(),
      getSelection: () => {
        const range = view.state.selection.main
        return {
          from: range.from,
          to: range.to,
          text: view.state.sliceDoc(range.from, range.to),
        }
      },
      replaceSelection: (text: string) => {
        const range = view.state.selection.main
        view.dispatch({ changes: { from: range.from, to: range.to, insert: text } })
      },
      insertText: (text: string) => view.dispatch({ changes: { from: view.state.selection.main.from, insert: text } }),
      getContent: () => view.state.doc.toString(),
      setContent: (text: string) => {
        view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } })
      },
      undo: () => {
        undo(view)
      },
      redo: () => {
        redo(view)
      },
      selectAll: () => {
        view.dispatch({ selection: { anchor: 0, head: view.state.doc.length } })
        view.focus()
      },
      goToLine: (line: number) => {
        const doc = view.state.doc
        const n = Math.max(1, Math.min(line, doc.lines))
        const pos = doc.line(n).from
        // The line is put into the middle of the window: a jump that leaves the
        // line at the edge of the screen looks like a jump that did nothing.
        view.dispatch({
          selection: { anchor: pos },
          effects: EditorView.scrollIntoView(pos, { y: 'center' }),
        })
        // Focus after the browser handled the click, so the editor keeps the
        // keyboard focus.
        view.focus()
        requestAnimationFrame(() => view.focus())
      },
      goToOffset: (offset: number) => {
        const pos = Math.max(0, Math.min(offset, view.state.doc.length))
        view.dispatch({
          selection: { anchor: pos },
          effects: EditorView.scrollIntoView(pos, { y: 'center' }),
        })
        view.focus()
      },
      stats: () => {
        const pos = view.state.selection.main
        const text = view.state.doc.toString()
        const { words, chars } = countStats(text)
        return {
          lines: view.state.doc.lines,
          cols: pos.head - view.state.doc.lineAt(pos.head).from + 1,
          selection: Math.abs(pos.to - pos.from),
          words,
          chars,
          selectedChars: view.state.sliceDoc(pos.from, pos.to).length,
        }
      },
      isDirty: () => {
        const current = useAppStore.getState().tabs.find((t) => t.id === tab.id)
        return current?.dirty ?? false
      },
      markClean: () => setTabDirty(tab.id, false),
      focusSearch: (query?: string) => {
        openSearchPanel(view)
        if (query) {
          setTimeout(() => {
            view.dispatch({ effects: setSearchQuery.of(new SearchQuery({ search: query })) })
          }, 0)
        }
      },
      openSearchPanel: (replace = false) => {
        openSearchPanel(view)
        if (replace) {
          setTimeout(() => {
            const panel = view.dom.querySelector('.cm-panel')
            const buttons = panel?.querySelectorAll('button') ?? []
            for (const button of buttons) {
              const label = `${button.textContent ?? ''} ${button.getAttribute('title') ?? ''}`.toLowerCase()
              if (label.includes('replace')) {
                button.click()
                break
              }
            }
          }, 0)
        }
      },
      findNext: () => {
        findNext(view)
      },
      findPrevious: () => {
        findPrevious(view)
      },
      destroy: () => view.destroy(),
    }

    const unregister = registerEditor(handle)
    const unregisterView = registerView(tab.id, view)
    const leaveGroup = syncGroup ? joinGroup(syncGroup, view) : undefined
    onReady?.(handle)
    onViewReady?.(view)
    view.focus()

    return () => {
      disposed = true
      if (syncTimer.current !== null) {
        window.clearTimeout(syncTimer.current)
        syncTimer.current = null
      }
      // Flush the final content and cursor position back into the store so the
      // tab can be re-created without losing anything.
      const state = useAppStore.getState()
      const cursor = view.state.selection.main.head
      state.updateTab(tab.id, { content: view.state.doc.toString(), cursor })
      unregister()
      unregisterView()
      leaveGroup?.()
      onViewReady?.(null)
      view.destroy()
      viewRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab.id])

  // Reconfigure when relevant settings change.
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    view.dispatch({
      effects: [
        wrapCompartment.reconfigure(settings.lineWrapping ? EditorView.lineWrapping : []),
        gutterCompartment.reconfigure(settings.showLineNumbers ? lineNumbers() : []),
        guideCompartment.reconfigure(
          indentGuidesExtension({ tabSize: settings.tabSize, enabled: settings.showIndentGuides }),
        ),
        invisiblesCompartment.reconfigure(settings.showInvisibles ? highlightSpecialChars() : []),
        behaviourCompartment.reconfigure([
          settings.autoIndent ? indentOnInput() : [],
          settings.matchBrackets ? bracketMatching() : [],
          settings.autoCloseBrackets ? closeBrackets() : [],
        ]),
        themeCompartment.reconfigure(buildTheme(settings)),
        editCompartment.reconfigure([
          EditorState.tabSize.of(settings.tabSize),
          indentUnit.of(settings.insertSpaces ? ' '.repeat(settings.tabSize) : '\t'),
          EditorState.readOnly.of(tab.readonly),
        ]),
      ],
    })
  }, [settings, tab.readonly])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    view.dispatch({
      effects: langCompartment.reconfigure(tab.largeFile ? [] : languageExtension(tab.language)),
    })
  }, [tab.language])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const current = view.state.doc.toString()
    const state = useAppStore.getState()
    const isDirty = state.tabs.find((t) => t.id === tab.id)?.dirty
    if (current !== (tab.content ?? '') && !isDirty) {
      // The file was reloaded from disk (or the tab was restored).
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: tab.content ?? '' } })
      state.setTabDirty(tab.id, false)
    }
  }, [tab.content, tab.id])

  return <div className="cm-host" ref={hostRef} />
}
