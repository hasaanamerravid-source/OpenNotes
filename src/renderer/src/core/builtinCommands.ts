import type { Command } from '@shared/types'
import { useAppStore } from '../store/app'
import { useUiStore } from '../store/ui'
import { getEditor } from './editors'
import { getView } from './views'
import { registerCommands, runCommand } from './commands'
import { setHighlightAll } from './highlightAll'
import { jumpToBookmark, toggleBookmarkAt } from './bookmarks'
import { changeCase, joinLines, removeDuplicateLines, sortLines, trimTrailingWhitespace } from './transforms'
import { loadMacros, playMacro, saveMacros, startRecording, type MacroEvent } from './macros'
import { languageLabel } from './languages'
import { findReferences, goToDefinition } from './lspCommands'
import { FILE_FILTERS } from './defaults'
import { cursorMatchingBracket } from '@codemirror/commands'
import { EditorSelection } from '@codemirror/state'

const store = (): ReturnType<typeof useAppStore.getState> => useAppStore.getState()

function activeTab(): ReturnType<typeof store>['tabs'][number] | undefined {
  const s = store()
  return s.tabs.find((t) => t.id === s.activeTabId)
}

function activeView(): ReturnType<typeof getView> {
  return getView(store().activeTabId)
}

/** Apply a text transform to the selection, or to the whole document. */
function applyTransform(fn: (text: string) => string): void {
  const view = activeView()
  if (view) {
    const range = view.state.selection.main
    const selected = view.state.sliceDoc(range.from, range.to)
    const hasSelection = selected.length > 0
    const target = hasSelection ? selected : view.state.doc.toString()
    const result = fn(target)
    if (result === target) return
    view.dispatch({
      changes: hasSelection
        ? { from: range.from, to: range.to, insert: result }
        : { from: 0, to: view.state.doc.length, insert: result },
    })
    return
  }
  const editor = getEditor(store().activeTabId)
  if (!editor) return
  const selection = editor.getSelection()
  const hasSelection = selection.text.length > 0
  const target = hasSelection ? selection.text : editor.getContent()
  const result = fn(target)
  if (result === target) return
  if (hasSelection) editor.replaceSelection(result)
  else editor.setContent(result)
}

const closedTabs: { path: string | null; name: string; content: string; language: string }[] = []

let recorder: { stop: () => MacroEvent[]; record: (e: MacroEvent) => void; isRecording: () => boolean } | null = null

/** Toggle a boolean setting and remember it for the next session. */
function toggleSetting(
  key:
    | 'showStatusBar'
    | 'lineWrapping'
    | 'showLineNumbers'
    | 'showMinimap'
    | 'showIndentGuides'
    | 'showInvisibles'
    | 'showSidebar',
): void {
  const settings = store().settings
  const next = !settings[key]
  store().setSettings({ [key]: next } as Partial<typeof settings>)
  void store().saveSettings()
}

/** Apply a setting and remember it for the next session. */
function setSetting(key: keyof ReturnType<typeof store>['settings'], value: unknown): void {
  store().setSettings({ [key]: value } as never)
  void store().saveSettings()
}

export const builtinCommands: Command[] = [
  /* ------------------------------- File ------------------------------ */
  {
    id: 'file.new',
    title: 'New file',
    category: 'File',
    shortcut: 'Ctrl+N',
    run: () => {
      store().newTab()
    },
  },
  {
    id: 'file.newWindow',
    title: 'New window',
    category: 'File',
    run: () => {
      void window.api.win.newWindow()
    },
  },
  {
    id: 'file.open',
    title: 'Open file…',
    category: 'File',
    shortcut: 'Ctrl+O',
    run: async () => {
      const result = await window.api.fs.openDialog({ title: 'Open file', filters: FILE_FILTERS })
      if (result.canceled) return
      await store().openPaths(result.filePaths)
    },
  },
  {
    id: 'file.openFromClipboard',
    title: 'Open path from clipboard',
    category: 'File',
    run: async () => {
      const text = await window.api.clipboard.readText()
      const path = text.trim().replace(/^"|"$/g, '')
      if (path) await store().openPath(path)
    },
  },
  {
    id: 'file.openPath',
    title: 'Open path',
    category: 'File',
    hidden: true,
    run: async (payload?: unknown) => {
      const path = String(payload ?? '')
      if (path) await store().openPath(path)
    },
  },
  {
    id: 'file.openRecent',
    title: 'Open recent file',
    category: 'File',
    hidden: true,
    run: async (payload?: unknown) => {
      const path = String(payload ?? '')
      if (path) await store().openPath(path)
    },
  },
  {
    id: 'file.save',
    title: 'Save',
    category: 'File',
    shortcut: 'Ctrl+S',
    run: async () => {
      const id = store().activeTabId
      if (id) await store().saveTab(id)
    },
  },
  {
    id: 'file.saveAs',
    title: 'Save as…',
    category: 'File',
    shortcut: 'Ctrl+Shift+S',
    run: async () => {
      const id = store().activeTabId
      if (id) await store().saveTab(id, true)
    },
  },
  {
    id: 'file.saveAll',
    title: 'Save all',
    category: 'File',
    run: async () => {
      await store().saveAll()
    },
  },
  {
    id: 'file.close',
    title: 'Close tab',
    category: 'File',
    shortcut: 'Ctrl+W',
    run: async () => {
      const tab = activeTab()
      const id = store().activeTabId
      if (!id) return
      if (tab) {
        const editor = getEditor(id)
        closedTabs.push({
          path: tab.path,
          name: tab.name,
          content: editor ? editor.getContent() : tab.content,
          language: tab.language,
        })
      }
      await store().closeTab(id)
    },
  },
  {
    id: 'file.closeAll',
    title: 'Close all tabs',
    category: 'File',
    run: async () => {
      await store().closeAll()
    },
  },
  {
    id: 'file.reopenClosed',
    title: 'Reopen closed tab',
    category: 'File',
    shortcut: 'Ctrl+Shift+T',
    run: () => {
      const last = closedTabs.pop()
      if (!last) return
      const id = store().newTab({ path: last.path, name: last.name, content: last.content, language: last.language })
      void id
    },
  },

  /* ------------------------------- Edit ------------------------------ */
  {
    id: 'edit.undo',
    title: 'Undo',
    category: 'Edit',
    shortcut: 'Ctrl+Z',
    run: () => {
      const editor = getEditor(store().activeTabId)
      editor?.undo()
    },
  },
  {
    id: 'edit.redo',
    title: 'Redo',
    category: 'Edit',
    shortcut: 'Ctrl+Y',
    run: () => {
      const editor = getEditor(store().activeTabId)
      editor?.redo()
    },
  },
  {
    id: 'edit.delete',
    title: 'Delete selection',
    category: 'Edit',
    run: () => {
      const editor = getEditor(store().activeTabId)
      editor?.replaceSelection('')
    },
  },
  {
    id: 'edit.selectAll',
    title: 'Select all',
    category: 'Edit',
    shortcut: 'Ctrl+A',
    run: () => {
      const view = activeView()
      if (view) {
        view.dispatch({ selection: { anchor: 0, head: view.state.doc.length } })
        view.focus()
        return
      }
      const editor = getEditor(store().activeTabId)
      if (!editor) return
      if (editor.selectAll) {
        editor.selectAll()
        return
      }
      // Rich text: fall back to the native selection of the editable area.
      document.execCommand('selectAll')
    },
  },
  {
    id: 'edit.gotoLine',
    title: 'Go to line…',
    category: 'Edit',
    shortcut: 'Ctrl+G',
    run: async () => {
      const answer = await useUiStore.getState().ask({
        title: 'Go to line',
        message: 'Enter a line number',
        defaultValue: '1',
      })
      if (answer === null) return
      const line = Number.parseInt(answer, 10)
      if (Number.isNaN(line)) return
      const editor = getEditor(store().activeTabId)
      editor?.goToLine(line)
    },
  },
  {
    id: 'editor.goToDefinition',
    title: 'Go to definition',
    category: 'Editor',
    shortcut: 'F12',
    run: async () => {
      await goToDefinition()
    },
  },
  {
    id: 'editor.findReferences',
    title: 'Find references',
    category: 'Editor',
    shortcut: 'Shift+F12',
    run: async () => {
      await findReferences()
    },
  },
  {
    id: 'edit.duplicateLine',
    title: 'Duplicate line',
    category: 'Edit',
    shortcut: 'Ctrl+D',
    run: () => {
      const view = activeView()
      if (!view) return
      const range = view.state.selection.main
      const start = view.state.doc.lineAt(range.from)
      const end = view.state.doc.lineAt(range.to)
      const text = view.state.doc.sliceString(start.from, end.to)
      view.dispatch({ changes: { from: end.to, insert: `\n${text}` } })
    },
  },
  {
    id: 'edit.deleteLine',
    title: 'Delete line',
    category: 'Edit',
    shortcut: 'Ctrl+Shift+K',
    run: () => {
      const view = activeView()
      if (!view) return
      const range = view.state.selection.main
      const start = view.state.doc.lineAt(range.from)
      const end = view.state.doc.lineAt(range.to)
      const to = end.to < view.state.doc.length ? end.to + 1 : end.to
      view.dispatch({ changes: { from: start.from, to } })
    },
  },
  {
    id: 'edit.moveLineUp',
    title: 'Move line up',
    category: 'Edit',
    shortcut: 'Alt+Shift+Up',
    run: () => {
      const view = activeView()
      if (!view) return
      const range = view.state.selection.main
      const line = view.state.doc.lineAt(range.from)
      if (line.number === 1) return
      const above = view.state.doc.lineAt(line.from - 1)
      const text = view.state.doc.sliceString(line.from, line.to)
      view.dispatch({
        changes: { from: above.from, to: line.to, insert: `${text}\n${above.text}` },
        selection: { anchor: range.from + 1 },
      })
    },
  },
  {
    id: 'edit.moveLineDown',
    title: 'Move line down',
    category: 'Edit',
    shortcut: 'Alt+Shift+Down',
    run: () => {
      const view = activeView()
      if (!view) return
      const range = view.state.selection.main
      const line = view.state.doc.lineAt(range.from)
      if (line.number === view.state.doc.lines) return
      const below = view.state.doc.lineAt(line.to + 1)
      const text = view.state.doc.sliceString(line.from, line.to)
      view.dispatch({
        changes: { from: line.from, to: below.to, insert: `${below.text}\n${text}` },
        selection: { anchor: range.from + 1 },
      })
    },
  },
  {
    id: 'edit.copyLine',
    title: 'Copy line',
    category: 'Edit',
    shortcut: 'Ctrl+Shift+C',
    run: () => {
      const view = activeView()
      if (!view) return
      const range = view.state.selection.main
      const start = view.state.doc.lineAt(range.from)
      const end = view.state.doc.lineAt(range.to)
      const text = view.state.doc.sliceString(start.from, end.to)
      void window.api.clipboard.writeText(text)
    },
  },
  {
    id: 'edit.insertText',
    title: 'Insert text',
    category: 'Edit',
    hidden: true,
    run: (payload?: unknown) => {
      const text = String(payload ?? '')
      if (!text) return
      getEditor(store().activeTabId)?.insertText(text)
    },
  },
  {
    id: 'edit.insertDateTime',
    title: 'Insert date/time',
    category: 'Edit',
    shortcut: 'F5',
    run: () => {
      const now = new Date()
      const stamp = now.toLocaleString()
      const editor = getEditor(store().activeTabId)
      editor?.insertText(stamp)
    },
  },
  {
    id: 'edit.selectAllOccurrences',
    title: 'Select all occurrences',
    category: 'Edit',
    shortcut: 'Ctrl+Shift+L',
    run: () => {
      const view = activeView()
      if (!view) return
      const { state } = view
      const main = state.selection.main
      const text = state.sliceDoc(main.from, main.to)
      if (!text.length) return
      // Find every occurrence of the selected text and put a cursor on each.
      const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const re = new RegExp(escaped, 'g')
      const doc = state.doc.toString()
      const ranges: number[] = []
      let match: RegExpExecArray | null
      while ((match = re.exec(doc))) ranges.push(match.index)
      if (ranges.length <= 1) return
      const selection = EditorSelection.create(
        ranges.map((from) => EditorSelection.cursor(from, from + text.length)),
        0,
      )
      view.dispatch({ selection })
      view.focus()
    },
  },

  /* ------------------------------ Search ----------------------------- */
  {
    id: 'search.find',
    title: 'Find…',
    category: 'Search',
    shortcut: 'Ctrl+F',
    run: () => {
      getEditor(store().activeTabId)?.focusSearch()
    },
  },
  {
    id: 'search.replace',
    title: 'Replace…',
    category: 'Search',
    shortcut: 'Ctrl+H',
    run: () => {
      getEditor(store().activeTabId)?.openSearchPanel(true)
    },
  },
  {
    id: 'search.findNext',
    title: 'Find next',
    category: 'Search',
    shortcut: 'F3',
    run: () => {
      getEditor(store().activeTabId)?.findNext()
    },
  },
  {
    id: 'search.findPrevious',
    title: 'Find previous',
    category: 'Search',
    shortcut: 'Shift+F3',
    run: () => {
      getEditor(store().activeTabId)?.findPrevious()
    },
  },
  {
    id: 'search.findInFiles',
    title: 'Find in files',
    category: 'Search',
    shortcut: 'Ctrl+Shift+F',
    run: () => {
      store().setSidePanel('search')
    },
  },
  {
    id: 'search.matchBracket',
    title: 'Go to matching bracket',
    category: 'Search',
    shortcut: 'Ctrl+B',
    run: () => {
      const view = activeView()
      if (!view) return
      cursorMatchingBracket(view)
    },
  },
  {
    id: 'search.markAll',
    title: 'Mark all occurrences',
    category: 'Search',
    run: async () => {
      const view = activeView()
      if (!view) return
      const selection = view.state.sliceDoc(view.state.selection.main.from, view.state.selection.main.to)
      const term =
        selection || (await useUiStore.getState().ask({ title: 'Mark all occurrences', message: 'Search for' })) || ''
      if (!term) return
      view.dispatch({ effects: setHighlightAll.of(term) })
    },
  },

  /* ----------------------------- Bookmarks --------------------------- */
  {
    id: 'edit.toggleBookmark',
    title: 'Toggle bookmark',
    category: 'Edit',
    shortcut: 'Ctrl+F2',
    run: () => {
      const view = activeView()
      if (!view) return
      toggleBookmarkAt(view)
    },
  },
  {
    id: 'edit.nextBookmark',
    title: 'Next bookmark',
    category: 'Edit',
    shortcut: 'F2',
    run: () => {
      const view = activeView()
      if (!view) return
      jumpToBookmark(view, 1)
    },
  },
  {
    id: 'edit.prevBookmark',
    title: 'Previous bookmark',
    category: 'Edit',
    shortcut: 'Shift+F2',
    run: () => {
      const view = activeView()
      if (!view) return
      jumpToBookmark(view, -1)
    },
  },

  /* ------------------------------- View ------------------------------ */
  {
    id: 'view.toggleSidebar',
    title: 'Toggle sidebar',
    category: 'View',
    shortcut: 'Ctrl+Shift+E',
    run: () => {
      store().toggleSidebar()
    },
  },
  {
    id: 'view.toggleStatusBar',
    title: 'Toggle status bar',
    category: 'View',
    run: () => {
      const visible = !store().statusBarVisible
      store().setSettings({ showStatusBar: visible })
      void store().saveSettings()
      useAppStore.setState({ statusBarVisible: visible })
    },
  },
  {
    id: 'view.fullscreen',
    title: 'Toggle full screen',
    category: 'View',
    shortcut: 'F11',
    run: () => {
      if (document.fullscreenElement) void document.exitFullscreen()
      else void document.documentElement.requestFullscreen()
    },
  },
  {
    id: 'view.zoomIn',
    title: 'Zoom in',
    category: 'View',
    shortcut: 'Ctrl++',
    run: () => {
      window.api.win.zoom(0.1)
    },
  },
  {
    id: 'view.zoomOut',
    title: 'Zoom out',
    category: 'View',
    shortcut: 'Ctrl+-',
    run: () => {
      window.api.win.zoom(-0.1)
    },
  },
  {
    id: 'view.zoomReset',
    title: 'Reset zoom',
    category: 'View',
    shortcut: 'Ctrl+0',
    run: () => {
      void window.api.win.setZoom(1)
    },
  },
  {
    id: 'view.toggleWordWrap',
    title: 'Toggle word wrap',
    category: 'View',
    run: () => {
      toggleSetting('lineWrapping')
    },
  },
  {
    id: 'view.toggleLineNumbers',
    title: 'Toggle line numbers',
    category: 'View',
    run: () => {
      toggleSetting('showLineNumbers')
    },
  },
  {
    id: 'view.toggleMinimap',
    title: 'Toggle minimap',
    category: 'View',
    run: () => {
      toggleSetting('showMinimap')
    },
  },
  {
    id: 'view.toggleIndentGuides',
    title: 'Toggle indent guides',
    category: 'View',
    run: () => {
      toggleSetting('showIndentGuides')
    },
  },
  {
    id: 'view.toggleInvisibles',
    title: 'Toggle invisibles',
    category: 'View',
    run: () => {
      toggleSetting('showInvisibles')
    },
  },
  {
    id: 'view.toggleTheme',
    title: 'Toggle dark / light theme',
    category: 'View',
    run: () => {
      const next = store().settings.theme === 'dark' ? 'light' : 'dark'
      store().setSettings({ theme: next })
      void store().saveSettings()
    },
  },
  {
    id: 'view.distractionFree',
    title: 'Distraction free mode',
    category: 'View',
    // Ctrl+Shift+F belongs to the search in files.
    shortcut: 'Ctrl+Alt+F',
    run: () => {
      store().setDistractionFree(!store().distractionFree)
    },
  },
  {
    id: 'view.toggleSplit',
    title: 'Toggle split view',
    category: 'View',
    shortcut: 'Ctrl+Alt+S',
    run: () => {
      store().setSplitView(!store().splitView)
    },
  },
  {
    id: 'view.commandPalette',
    title: 'Command palette…',
    category: 'View',
    shortcut: 'Ctrl+Shift+P',
    run: () => {
      store().setPaletteMode('commands')
    },
  },
  {
    id: 'view.quickSwitcher',
    title: 'Quick switcher (files & notes)',
    category: 'View',
    shortcut: 'Ctrl+Shift+O',
    run: () => {
      store().setPaletteMode('files')
    },
  },

  /* ------------------------------ Format ----------------------------- */
  {
    id: 'format.setLanguage',
    title: 'Set language',
    category: 'Format',
    hidden: true,
    run: (payload?: unknown) => {
      const id = String(payload ?? '')
      const tab = activeTab()
      if (!tab || !id) return
      store().updateTab(tab.id, { language: id })
      store().toast(`Language: ${languageLabel(id)}`)
    },
  },
  {
    id: 'format.setEncoding',
    title: 'Set encoding',
    category: 'Format',
    hidden: true,
    run: (payload?: unknown) => {
      const id = String(payload ?? '')
      const tab = activeTab()
      if (!tab || !id) return
      store().updateTab(tab.id, { encoding: id })
      store().toast(`Encoding: ${id}`)
    },
  },
  {
    id: 'format.encode',
    title: 'Encode with…',
    category: 'Format',
    hidden: true,
    run: (payload?: unknown) => {
      const id = String(payload ?? '')
      const tab = activeTab()
      if (!tab || !id) return
      store().updateTab(tab.id, { encoding: id })
      store().toast(`Save will use ${id}`)
    },
  },
  {
    id: 'format.convertTo',
    title: 'Convert file encoding to…',
    category: 'Format',
    hidden: true,
    run: async (payload?: unknown) => {
      const id = String(payload ?? '')
      const tab = activeTab()
      if (!tab?.path || !id) return
      const payloadFile = await window.api.fs.readFile(tab.path)
      await window.api.fs.writeFile(tab.path, payloadFile.content, id, tab.eol)
      store().updateTab(tab.id, { encoding: id })
      store().toast(`Converted to ${id}`, 'success')
    },
  },
  {
    id: 'format.eol',
    title: 'Convert line endings to…',
    category: 'Format',
    hidden: true,
    run: (payload?: unknown) => {
      const eol = String(payload ?? '\n') as '\n' | '\r\n' | '\r'
      const tab = activeTab()
      if (!tab) return
      store().updateTab(tab.id, { eol })
      store().toast(`Line endings: ${eol === '\n' ? 'LF' : eol === '\r\n' ? 'CRLF' : 'CR'}`)
    },
  },
  {
    id: 'format.sortAsc',
    title: 'Sort lines ascending',
    category: 'Format',
    run: () => applyTransform((text) => sortLines(text, false)),
  },
  {
    id: 'format.sortDesc',
    title: 'Sort lines descending',
    category: 'Format',
    run: () => applyTransform((text) => sortLines(text, true)),
  },
  {
    id: 'format.removeDuplicates',
    title: 'Remove duplicate lines',
    category: 'Format',
    run: () => applyTransform(removeDuplicateLines),
  },
  {
    id: 'format.trimTrailing',
    title: 'Trim trailing whitespace',
    category: 'Format',
    run: () => applyTransform(trimTrailingWhitespace),
  },
  {
    id: 'format.joinLines',
    title: 'Join lines',
    category: 'Format',
    run: () => applyTransform(joinLines),
  },
  {
    id: 'format.upperCase',
    title: 'UPPERCASE selection',
    category: 'Format',
    run: () => applyTransform((text) => changeCase(text, 'upper')),
  },
  {
    id: 'format.lowerCase',
    title: 'lowercase selection',
    category: 'Format',
    run: () => applyTransform((text) => changeCase(text, 'lower')),
  },
  {
    id: 'format.titleCase',
    title: 'Title Case selection',
    category: 'Format',
    run: () => applyTransform((text) => changeCase(text, 'title')),
  },

  /* ------------------------------ Tools ------------------------------ */
  {
    id: 'tools.compare',
    title: 'Compare with another file…',
    category: 'Tools',
    run: async () => {
      const tab = activeTab()
      if (!tab) return
      const result = await window.api.fs.openDialog({ title: 'Compare with…', filters: FILE_FILTERS })
      if (result.canceled || !result.filePath) return
      const left = tab.path ? (await window.api.fs.readFile(tab.path)).content : tab.content
      const right = (await window.api.fs.readFile(result.filePath)).content
      store().setCompareData({
        left,
        right,
        leftName: tab.name,
        rightName: result.filePath.split(/[\\/]/).pop() ?? result.filePath,
      })
      store().setDialog('compare', true)
    },
  },
  {
    id: 'tools.macroStart',
    title: 'Start recording macro',
    category: 'Tools',
    run: () => {
      if (recorder) return
      recorder = startRecording()
      store().toast('Recording macro…', 'success')
    },
  },
  {
    id: 'tools.macroStop',
    title: 'Stop recording macro',
    category: 'Tools',
    run: async () => {
      if (!recorder) return
      const events = recorder.stop()
      recorder = null
      if (!events.length) {
        store().toast('Macro recorded no events')
        return
      }
      const name = await useUiStore.getState().ask({
        title: 'Save macro',
        message: 'Macro name',
        defaultValue: `Macro ${new Date().toLocaleTimeString()}`,
      })
      if (!name) return
      const macros = loadMacros()
      macros.push({ name, events, createdAt: Date.now() })
      saveMacros(macros)
      store().toast(`Macro "${name}" saved`, 'success')
    },
  },
  {
    id: 'tools.macroPlay',
    title: 'Play macro…',
    category: 'Tools',
    run: async () => {
      const macros = loadMacros()
      if (!macros.length) {
        store().toast('No macros recorded yet')
        return
      }
      const name = await useUiStore.getState().ask({
        title: 'Play macro',
        message: macros.map((m) => m.name).join(', '),
        defaultValue: macros[0].name,
      })
      const macro = macros.find((m) => m.name === name)
      if (!macro) return
      playMacro(macro.events, (event) => {
        if (event.type === 'insert') {
          getEditor(store().activeTabId)?.insertText(event.value)
        }
      })
    },
  },
  {
    id: 'tools.stopRun',
    title: 'Stop the running process',
    category: 'Tools',
    run: () => {
      void window.api.run?.stop?.()
    },
  },
  {
    id: 'tools.characterMap',
    title: 'Character map…',
    category: 'Tools',
    run: () => {
      store().setDialog('charMap', true)
    },
  },
  {
    id: 'tools.openTerminal',
    title: 'Open terminal here',
    category: 'Tools',
    run: () => {
      const tab = activeTab()
      const cwd = tab?.path ? tab.path.replace(/[\\/][^\\/]*$/, '') : undefined
      void window.api.shell.openTerminal(cwd)
    },
  },
  {
    id: 'view.toggleTerminal',
    title: 'Show the integrated terminal',
    category: 'View',
    shortcut: 'Ctrl+`',
    run: async () => {
      const state = store()
      state.setBottomTab('terminal')
      state.setBottomPanelVisible(true)
      const { useTerminalStore } = await import('./terminalState')
      const terminal = useTerminalStore.getState()
      if (!terminal.running) terminal.start(terminal.cwd || undefined)
    },
  },
  {
    id: 'terminal.clear',
    title: 'Clear the terminal',
    category: 'Tools',
    run: async () => {
      const { useTerminalStore } = await import('./terminalState')
      useTerminalStore.getState().clear()
    },
  },
  {
    id: 'terminal.restart',
    title: 'Restart the shell',
    category: 'Tools',
    run: async () => {
      const { useTerminalStore } = await import('./terminalState')
      const terminal = useTerminalStore.getState()
      terminal.stop()
      terminal.start(terminal.cwd || undefined)
    },
  },
  {
    id: 'tools.run',
    title: 'Run current file',
    category: 'Tools',
    run: async () => {
      const state = store()
      const tab = state.tabs.find((t) => t.id === state.activeTabId)
      if (!tab?.path) {
        state.toast('Save the file before running it', 'error')
        return
      }
      const { useRunStore } = await import('./runState')
      useRunStore.getState().start(tab.path, tab.language)
      state.setBottomTab('run')
      state.setBottomPanelVisible(true)
    },
  },

  /* ------------------------------- Help ------------------------------ */
  {
    id: 'help.about',
    title: 'About OpenNotes',
    category: 'Help',
    run: () => {
      store().setDialog('about', true)
    },
  },
  {
    id: 'help.welcome',
    title: 'Welcome & keyboard shortcuts',
    category: 'Help',
    run: () => {
      store().setDialog('welcome', true)
    },
  },
]

/** Register every built-in command. */
export function registerBuiltinCommands(): void {
  registerCommands(builtinCommands)
}
