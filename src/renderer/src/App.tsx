import type { JSX } from 'react'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { useAppStore } from './store/app'
import { useStatusStore } from './store/status'
import { TitleBar } from './components/TitleBar'
import { StatusBar } from './components/StatusBar'
import { Sidebar } from './components/Sidebar'
import { ActivityBar } from './components/ActivityBar'
import { BottomPanel } from './components/BottomPanel'
import { useProblems, useLspConfiguration } from './core/useProblems'
import { getEditor } from './core/editors'
import { jumpToProblem } from './core/lspCommands'
import { useLspSync } from './core/lspIntegration'
import { projectFolder } from './core/projectConfig'
import {
  matchesShortcut,
  readKeybindingsSync,
  setKeybindings,
  setUserDataFolder,
  useKeybindings,
} from './core/keybindings'
import { EditorPane } from './components/editor/EditorPane'
import { CommandPalette } from './components/CommandPalette'
import { SettingsDialog } from './components/SettingsDialog'
import { AboutDialog } from './components/AboutDialog'
import { WelcomeDialog } from './components/WelcomeDialog'
import { Toasts } from './components/Toasts'
import { PromptHost } from './components/PromptHost'
import { registerBuiltinCommands } from './core/builtinCommands'
import { runCommand, setMenuAccelerators, handledByMenu, getShortcutMap } from './core/commands'
import { activateEnabledPlugins } from './core/plugins'
import { applyAppearance } from './core/appearance'
import { applyDocumentLocale, useT } from './core/i18n'
import { Modal } from './components/Modal'

/* Loaded on demand — they are only needed when the user opens them. */
const LazyCompareView = lazy(() => import('./components/panels/CompareView').then((m) => ({ default: m.CompareView })))
const LazyCharacterMap = lazy(() =>
  import('./components/panels/CharacterMap').then((m) => ({ default: m.CharacterMap })),
)
const LazyProblemsPanel = lazy(() =>
  import('./components/panels/ProblemsPanel').then((m) => ({ default: m.ProblemsPanel })),
)
const LazyRunPanel = lazy(() => import('./components/panels/RunPanel').then((m) => ({ default: m.RunPanel })))
const LazyTerminalPanel = lazy(() =>
  import('./components/panels/TerminalPanel').then((m) => ({ default: m.TerminalPanel })),
)

/*
 * The commands are registered before the first render: the shortcuts of the
 * commands are the default bindings, and they have to be known before the
 * keyboard handler reads them.
 */
registerBuiltinCommands()

export default function App(): JSX.Element {
  const ready = useAppStore((s) => s.ready)
  const init = useAppStore((s) => s.init)
  const settings = useAppStore((s) => s.settings)
  const tabs = useAppStore((s) => s.tabs)
  const activeTabId = useAppStore((s) => s.activeTabId)
  const paletteOpen = useAppStore((s) => s.paletteOpen)
  const paletteMode = useAppStore((s) => s.paletteMode)
  const setPalette = useAppStore((s) => s.setPalette)
  const sidebarVisible = useAppStore((s) => s.sidebarVisible)
  const statusBarVisible = useAppStore((s) => s.statusBarVisible)
  const distractionFree = useAppStore((s) => s.distractionFree)
  const compareOpen = useAppStore((s) => s.compareOpen)
  const compareData = useAppStore((s) => s.compareData)
  const charMapOpen = useAppStore((s) => s.charMapOpen)
  const setDialog = useAppStore((s) => s.setDialog)
  const setActiveTab = useAppStore((s) => s.setActiveTab)
  const toast = useAppStore((s) => s.toast)
  const [dragging, setDragging] = useState(false)
  const bottomTab = useAppStore((s) => s.bottomTab)
  const bottomPanelVisible = useAppStore((s) => s.bottomPanelVisible)
  const setBottomTab = useAppStore((s) => s.setBottomTab)
  const setBottomPanelVisible = useAppStore((s) => s.setBottomPanelVisible)
  const problems = useProblems()
  const t = useT()
  useLspSync()
  useLspConfiguration()

  // The shell starts as soon as the terminal is opened.
  useEffect(() => {
    if (bottomTab !== 'terminal') return
    void import('./core/terminalState').then(({ useTerminalStore }) => {
      const terminal = useTerminalStore.getState()
      if (!terminal.running) terminal.start(projectFolder() ?? undefined)
    })
  }, [bottomTab])
  const statusSet = useStatusStore((s) => s.set)
  const statusReset = useStatusStore((s) => s.reset)
  const initRef = useRef(false)
  const keybindings = useKeybindings()

  /* ---------------------------- bootstrap --------------------------- */
  useEffect(() => {
    if (initRef.current) return
    initRef.current = true
    void init().then(() => {
      const s = useAppStore.getState()
      void activateEnabledPlugins(s.settings.plugins)
    })
    // The folder of the settings holds the keybindings file.
    void window.api.info().then((info) => {
      setUserDataFolder(info.userData)
    })
    // The native menu handles some of the keys itself.
    void window.api.menu
      .accelerators()
      .then(setMenuAccelerators)
      .catch(() => undefined)
    const stop = window.api.onMenuAccelerators(setMenuAccelerators)
    return stop
  }, [init])

  // The shortcuts of the user are kept in the keyboard handler.
  useEffect(() => {
    setKeybindings(keybindings)
  }, [keybindings])

  // A plugin shows a message with `ctx.toast(...)`.
  useEffect(() => {
    const onToast = (event: Event): void => {
      const detail = (event as CustomEvent<{ message?: string; kind?: 'info' | 'error' | 'success' }>).detail
      if (!detail?.message) return
      toast(detail.message, detail.kind ?? 'info')
    }
    window.addEventListener('opennotes:toast', onToast)
    return () => window.removeEventListener('opennotes:toast', onToast)
  }, [toast])

  /* ------------------------------ theme ----------------------------- */
  useEffect(() => {
    const root = document.documentElement
    const apply = (): void => {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      const theme = settings.theme === 'system' ? (prefersDark ? 'dark' : 'light') : settings.theme
      root.setAttribute('data-theme', theme)
      window.api.win.setTheme(theme === 'dark' ? '#1e1e28' : '#f6f8fa')
    }
    apply()
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [settings.theme])

  /* ----------------------------- language --------------------------- */
  // The document knows which language it is in, so that the screen reader and
  // the browser pick the right spelling rules and the right direction.
  useEffect(() => {
    applyDocumentLocale(settings.language)
  }, [settings.language])

  /* ---------------------------- appearance --------------------------- */
  useEffect(() => {
    applyAppearance(settings)
  }, [settings.appearance, settings.syntaxTheme])

  /* --------------------------- menu visibility ----------------------- */
  useEffect(() => {
    // The native Windows menu bar is always reachable with Alt, like in other
    // Windows editors; it only stays visible when the user asks for it.
    const visible = settings.mainMenuStyle === 'native' || settings.mainMenuStyle === 'both'
    void window.api.win.setMenuBar(visible)
  }, [settings.mainMenuStyle])

  /* --------------------------- window state --------------------------- */
  useEffect(() => {
    return window.api.win.onMaximizeChange((maximized) => {
      statusSet({ maximized })
    })
  }, [statusSet])

  /* --------------------------- native menu --------------------------- */
  useEffect(() => {
    void window.api.menu.setProfile(settings.profile)
  }, [settings.profile])

  /* --------------------------- window title ------------------------- */
  useEffect(() => {
    const tab = tabs.find((t) => t.id === activeTabId)
    const name = tab ? `${tab.dirty ? '● ' : ''}${tab.name}` : 'OpenNotes'
    window.api.win.setTitle(`${name} — OpenNotes`)
  }, [tabs, activeTabId])

  /* ------------------------ native menu commands -------------------- */
  useEffect(() => {
    return window.api.onCommand((id, payload) => {
      void runCommand(id, payload)
    })
  }, [])

  const recentFiles = useAppStore((s) => s.settings.recentFiles)
  useEffect(() => {
    void window.api.menu.setRecent(recentFiles)
  }, [recentFiles])

  useEffect(() => {
    return window.api.onOpenFiles((paths) => {
      void useAppStore.getState().openPaths(paths)
    })
  }, [])

  /* --------------------------- keyboard ----------------------------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const ctrl = e.ctrlKey || e.metaKey
      const s = useAppStore.getState()

      if (e.key === 'Escape' && s.paletteOpen) {
        s.setPalette(false)
        return
      }

      // The shortcuts of the user come first: they can replace any shortcut.
      const bindings = readKeybindingsSync()
      for (const [command, shortcut] of Object.entries(bindings)) {
        if (!matchesShortcut(e, shortcut)) continue
        // The native menu handles some of the keys itself: the command must
        // not run a second time.
        if (handledByMenu(command)) return
        e.preventDefault()
        e.stopPropagation()
        void runCommand(command)
        return
      }

      // The editor has already handled the key (undo, select all, …): the
      // command of the app must not run a second time.
      if (e.defaultPrevented) return

      // The shortcuts of the commands are the default bindings.
      for (const [command, shortcut] of Object.entries(getShortcutMap())) {
        if (!matchesShortcut(e, shortcut)) continue
        if (handledByMenu(command)) return
        e.preventDefault()
        e.stopPropagation()
        void runCommand(command)
        return
      }

      // Alt with the arrow keys walks through the tabs.
      if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault()
        const list = s.tabs
        if (list.length < 2) return
        const index = list.findIndex((t) => t.id === s.activeTabId)
        const next = e.key === 'ArrowRight' ? (index + 1) % list.length : (index - 1 + list.length) % list.length
        s.setActiveTab(list[next].id)
        return
      }

      if (!ctrl) return

      if (e.key === 'Tab') {
        e.preventDefault()
        const list = s.tabs
        if (list.length < 2) return
        const index = list.findIndex((t) => t.id === s.activeTabId)
        const next = e.shiftKey ? (index - 1 + list.length) % list.length : (index + 1) % list.length
        s.setActiveTab(list[next].id)
        return
      }
      if (e.key >= '1' && e.key <= '9') {
        const index = Number(e.key) - 1
        if (s.tabs[index]) {
          e.preventDefault()
          s.setActiveTab(s.tabs[index].id)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  /* --------------------------- drag & drop --------------------------- */
  useEffect(() => {
    const onDragOver = (e: DragEvent): void => {
      e.preventDefault()
      setDragging(true)
    }
    const onDragLeave = (e: DragEvent): void => {
      if (e.relatedTarget === null) setDragging(false)
    }
    const onDrop = (e: DragEvent): void => {
      e.preventDefault()
      setDragging(false)
      const files = Array.from(e.dataTransfer?.files ?? [])
      const paths = files.map((f) => window.api.pathForFile(f)).filter(Boolean)
      if (paths.length) void useAppStore.getState().openPaths(paths)
    }
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('dragleave', onDragLeave)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('dragleave', onDragLeave)
      window.removeEventListener('drop', onDrop)
    }
  }, [])

  /* ------------------------- session + autosave ---------------------- */
  useEffect(() => {
    const persist = (): void => {
      void useAppStore.getState().persistSession()
    }
    const timer = window.setInterval(persist, 15000)
    window.addEventListener('beforeunload', persist)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('beforeunload', persist)
      persist()
    }
  }, [])

  useEffect(() => {
    const interval = settings.autosaveInterval
    if (!interval) return
    const timer = window.setInterval(() => {
      void useAppStore.getState().saveAll()
    }, interval * 1000)
    return () => window.clearInterval(timer)
  }, [settings.autosaveInterval])

  /* ------------------------------- zoom ------------------------------ */
  useEffect(() => {
    const timer = window.setInterval(() => {
      void window.api.win
        .getZoom()
        .then((zoom) => {
          if (typeof zoom === 'number') statusSet({ zoom })
        })
        .catch(() => undefined)
    }, 2000)
    return () => window.clearInterval(timer)
  }, [statusSet])

  /* ------------------------- status bar sync ------------------------- */
  useEffect(() => {
    const tab = tabs.find((t) => t.id === activeTabId)
    statusSet({
      encoding: tab?.encoding ?? 'utf8',
      eol: tab?.eol ?? '\n',
      language: tab?.language ?? 'text',
      mode: tab?.mode ?? 'code',
      dirty: tab?.dirty ?? false,
    })
  }, [tabs, activeTabId, statusSet])

  useEffect(() => {
    if (!tabs.length) statusReset()
  }, [tabs.length, statusReset])

  const active = tabs.find((t) => t.id === activeTabId)

  return (
    <div className={`app ${distractionFree ? 'distraction-free' : ''} ${dragging ? 'dragging' : ''}`}>
      <TitleBar />
      <div className="app-body">
        {!distractionFree && <ActivityBar />}
        {sidebarVisible && !distractionFree && <Sidebar />}
        <main className="app-main">
          {compareOpen && compareData ? (
            <Suspense fallback={<div className="empty-state">Loading…</div>}>
              <LazyCompareView
                left={compareData.left}
                right={compareData.right}
                leftName={compareData.leftName}
                rightName={compareData.rightName}
                onClose={() => setDialog('compare', false)}
              />
            </Suspense>
          ) : (
            <EditorPane />
          )}
        </main>
      </div>
      {!distractionFree && bottomPanelVisible && (
        <BottomPanel
          tabs={[
            { id: 'problems', label: 'Problems', icon: 'problems', count: problems.length },
            { id: 'run', label: 'Run', icon: 'terminal' },
            { id: 'terminal', label: 'Terminal', icon: 'terminal' },
          ]}
          active={bottomTab}
          onSelect={setBottomTab}
          onClose={() => setBottomPanelVisible(false)}
        >
          <Suspense fallback={<div className="empty-state">Loading…</div>}>
            {bottomTab === 'problems' ? (
              <LazyProblemsPanel
                problems={problems}
                onSelect={(problem) => {
                  void jumpToProblem(problem)
                }}
              />
            ) : bottomTab === 'terminal' ? (
              <LazyTerminalPanel cwd={projectFolder() ?? undefined} />
            ) : (
              <LazyRunPanel
                onRun={() => {
                  const state = useAppStore.getState()
                  const tab = state.tabs.find((t) => t.id === state.activeTabId)
                  if (tab?.path) void runCommand('tools.run')
                }}
                onStop={() => void runCommand('tools.stopRun')}
              />
            )}
          </Suspense>
        </BottomPanel>
      )}
      {statusBarVisible && !distractionFree && <StatusBar />}

      <CommandPalette open={paletteOpen} mode={paletteMode} onClose={() => setPalette(false)} />
      <SettingsDialog />
      <AboutDialog />
      <WelcomeDialog />
      <PromptHost />
      <Toasts />

      {charMapOpen && (
        <Modal title={t('dialog.charMap.title')} onClose={() => setDialog('charMap', false)}>
          <Suspense fallback={<div className="empty-state">{t('common.loading')}</div>}>
            <LazyCharacterMap
              onInsert={(char) => {
                void runCommand('edit.insertText', char)
              }}
              onClose={() => setDialog('charMap', false)}
            />
          </Suspense>
        </Modal>
      )}

      {dragging && <div className="drag-overlay">{t('title.dropFiles')}</div>}
      {!ready && (
        <div className="modal-backdrop">
          <div className="modal small" role="dialog" aria-modal="true" aria-label={t('app.name')}>
            <div className="modal-body">{t('common.loading')}</div>
          </div>
        </div>
      )}
    </div>
  )
}
