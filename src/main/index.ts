import { app, BrowserWindow, shell, nativeTheme, ipcMain } from 'electron'
import path from 'node:path'
import { writeFile, appendFile, mkdir, readFile } from 'node:fs/promises'
import { existsSync, appendFileSync, mkdirSync, readFileSync } from 'node:fs'
import type { Settings } from '@shared/types'

/** Append a line to the application log inside the user data folder. */
export function logLine(message: string): void {
  try {
    const dir = path.join(app.getPath('userData'), 'logs')
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    appendFileSync(path.join(dir, 'opennotes.log'), `${new Date().toISOString()} ${message}\n`)
  } catch {
    /* logging must never throw */
  }
}

/** Record an unexpected failure so a crash can be diagnosed later. */
function recordCrash(kind: string, error: unknown): void {
  const message = error instanceof Error ? `${error.message}\n${error.stack ?? ''}` : String(error)
  logLine(`CRASH [${kind}] ${message}`)
  console.error(`[opennotes] crash (${kind}):`, error)
  // Watchers and other background work must never take the app down.
  if (kind === 'uncaughtException' || kind === 'unhandledRejection') {
    console.error('[opennotes] the error was logged, the app keeps running')
  }
}
import { registerFsHandlers } from './ipc/fs'
import { registerRecentHandlers } from './ipc/recent'
import { registerSessionHandlers } from './ipc/session'
import { registerSettingsHandlers, onSettingsChanged } from './ipc/settings'
import { registerPluginHandlers } from './ipc/plugins'
import { registerShellHandlers } from './ipc/shell'
import { registerMenuHandlers } from './ipc/menu'
import { registerRunHandlers } from './ipc/run'
import { registerSearchHandlers } from './ipc/search'
import { registerTerminalHandlers } from './ipc/terminal'
import { registerWindowHandlers, setMainWindow } from './ipc/window'
import { registerLspHandlers, stopAllLspServers } from './ipc/lsp'
import { buildMenu, updateMenuLocale } from './menu'
import { createAppWindow } from './window'
import { openFilesFromArgv } from './openFiles'
import { isLocaleId } from '@shared/i18n'

let mainWindow: BrowserWindow | null = null

// The name of the application: it names the folder with the settings, the
// entry in the task bar and the group in the task manager.
app.setName('OpenNotes')

/**
 * Low end machines: rendering without the GPU saves roughly 100 MB of RAM.
 * The flag has to be read before the app becomes ready.
 */
function applyRendererPreferences(): void {
  try {
    const file = path.join(app.getPath('userData'), 'settings.json')
    if (!existsSync(file)) return
    const settings = JSON.parse(readFileSync(file, 'utf8')) as { softwareRendering?: boolean }
    if (settings.softwareRendering) {
      app.disableHardwareAcceleration()
      logLine('SOFTWARE RENDERING enabled')
    }
  } catch {
    /* the settings file is optional */
  }
}

// Tests (and portable installs) can point the app at another data folder.
if (process.env.OPENNOTES_USERDATA) {
  app.setPath('userData', process.env.OPENNOTES_USERDATA)
}
if (!process.env.OPENNOTES_USERDATA) {
  applyRendererPreferences()
}

/**
 * The language servers are configured with the toolchain settings of the app
 * and with the plain text configuration file of the project.
 */
function lspOptionsOf(settings: Partial<Settings>): {
  servers: Record<string, { command: string; args?: string[] }>
  rootPath: string | null
} {
  return {
    servers: settings.lspServers ?? {},
    rootPath: settings.projectFolder ?? null,
  }
}

/** The settings of the app, read straight from the disk. */
function readSettings(): Partial<Settings> {
  try {
    const file = path.join(app.getPath('userData'), 'settings.json')
    if (!existsSync(file)) return {}
    return JSON.parse(readFileSync(file, 'utf8')) as Partial<Settings>
  } catch {
    return {}
  }
}

function createWindow(): BrowserWindow {
  // Every window of the application is created by the same factory, so that a
  // second window looks exactly like the first one.
  const win = createAppWindow()
  setMainWindow(win)

  // Surface renderer problems in the terminal (helpful when running from a shell).
  win.webContents.on('console-message', (event: unknown) => {
    const e = event as { level?: string | number; message?: string; lineNumber?: number; sourceId?: string }
    const level = e?.level
    const message = e?.message ?? ''
    // Benign Chromium notice, not an application error.
    if (message.includes('ResizeObserver loop')) return
    if (level === 'error' || level === 3) {
      console.error('[renderer]', message)
      logLine(`RENDERER ERROR ${message} (${e.sourceId ?? ''}:${e.lineNumber ?? 0})`)
    } else if (level === 'warning' || level === 2) {
      logLine(`RENDERER WARN ${message}`)
    }
  })
  win.webContents.on('render-process-gone', (_event, details) => {
    console.error('[renderer gone]', details)
    recordCrash('render-process-gone', JSON.stringify(details))
  })
  win.webContents.on('did-fail-load', (_event, code, description) => {
    console.error('[load failed]', code, description)
    recordCrash('did-fail-load', `${code} ${description}`)
  })
  win.webContents.on('preload-error', (_event, preloadPath, error) => {
    console.error('[preload error]', preloadPath, error)
    recordCrash('preload-error', `${preloadPath}: ${String(error)}`)
  })

  // Debug helper: OPENNOTES_SNAPSHOT=<file.png> captures the window and exits.
  const snapshot = process.env.OPENNOTES_SNAPSHOT
  if (snapshot) {
    const delay = Number(process.env.OPENNOTES_SNAPSHOT_DELAY ?? 3500)
    win.webContents.once('did-finish-load', () => {
      setTimeout(() => {
        void win.webContents.capturePage().then(async (image) => {
          await writeFile(snapshot, image.toPNG())
          console.log('[snapshot]', snapshot)
          app.quit()
        })
      }, delay)
    })
  }

  // Debug helper: OPENNOTES_EVAL=<expression> evaluates JS in the renderer and logs it.
  const probe = process.env.OPENNOTES_EVAL
  const probeFile = process.env.OPENNOTES_EVAL_FILE
  if (probe || probeFile) {
    win.webContents.once('did-finish-load', () => {
      setTimeout(() => {
        const run = (code: string): void => {
          void win.webContents
            .executeJavaScript(code, true)
            .then((result) => {
              console.log('[eval]', JSON.stringify(result))
              // A script may ask to keep the app open (used with snapshots).
              if (result !== 'KEEP_ALIVE') app.quit()
            })
            .catch((err) => {
              console.error('[eval-error]', err)
              app.quit()
            })
        }
        if (probeFile) {
          void readFile(probeFile, 'utf8')
            .then(run)
            .catch((err) => {
              console.error('[eval-error]', err)
              app.quit()
            })
        } else if (probe) {
          run(probe)
        }
      }, 2500)
    })
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  return win
}

// Only one instance may run: a second launch would fight over the Chromium
// profile in the user data folder and crash.
const singleInstance = app.requestSingleInstanceLock()
if (!singleInstance) {
  app.quit()
} else {
  app.on('second-instance', (_event, argv) => {
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
    // Files that were passed to the second launch are opened in the running app.
    const files = openFilesFromArgv(argv)
    if (files.length) {
      mainWindow.webContents.send('opennotes:open-files', files)
    }
  })

  app.whenReady().then(async () => {
    // Group the taskbar entries under the app identity (Windows).
    app.setAppUserModelId('dev.opennotes.app')
    process.on('uncaughtException', (error) => recordCrash('uncaughtException', error))
    process.on('unhandledRejection', (reason) => recordCrash('unhandledRejection', reason))
    logLine(`APP START ${app.getVersion()} electron ${process.versions.electron}`)

    ipcMain.on('app:error', (_event, message: string) => {
      recordCrash('renderer', message)
    })

    // Test helper: simulate a real mouse click at window coordinates. Synthetic
    // DOM clicks cannot prove that a control is not swallowed by a window drag
    // region, a real input event can.
    if (process.env.OPENNOTES_TEST_CLICK === '1') {
      ipcMain.on('test:click', (_event, x: number, y: number) => {
        // The click always goes to the main window: a second window (the
        // "new window" command) may have the focus, and the test drives the
        // window that runs the suite.
        const win = mainWindow ?? BrowserWindow.getFocusedWindow()
        if (!win) return
        win.webContents.sendInputEvent({ type: 'mouseDown', x, y, button: 'left', clickCount: 1 })
        win.webContents.sendInputEvent({ type: 'mouseUp', x, y, button: 'left', clickCount: 1 })
      })
      // The same for the keyboard: a real key press shows whether the native
      // menu swallows the accelerator before the renderer sees it.
      ipcMain.on('test:key', (_event, key: string, modifiers: string[] = []) => {
        const win = mainWindow ?? BrowserWindow.getFocusedWindow()
        if (!win) return
        win.webContents.sendInputEvent({
          type: 'keyDown',
          keyCode: key,
          modifiers: modifiers as never,
        })
        win.webContents.sendInputEvent({ type: 'keyUp', keyCode: key, modifiers: modifiers as never })
      })
    }

    registerFsHandlers()
    registerRecentHandlers()
    registerSessionHandlers()
    registerSettingsHandlers()
    registerPluginHandlers()
    registerShellHandlers()
    registerMenuHandlers()
    registerRunHandlers()
    registerSearchHandlers()
    registerTerminalHandlers()
    registerWindowHandlers()

    // The language servers read the toolchain settings; a changed setting is
    // applied at once.
    registerLspHandlers(lspOptionsOf(readSettings()))
    onSettingsChanged((settings) => {
      registerLspHandlers(lspOptionsOf(settings))
      // The native menu follows the language of the interface.
      if (isLocaleId(settings.language)) updateMenuLocale(settings.language)
      logLine('LSP CONFIG updated')
    })

    // The project may bring its own language servers (the plain text file of
    // the project wins over the global settings).
    ipcMain.handle(
      'lsp:configure',
      (
        _event,
        config: { servers?: Record<string, { command: string; args?: string[] }>; rootPath?: string | null },
      ) => {
        registerLspHandlers({
          servers: config.servers ?? {},
          rootPath: config.rootPath ?? null,
        })
        logLine(`LSP CONFIG from project: ${Object.keys(config.servers ?? {}).length} servers`)
        return true
      },
    )

    mainWindow = createWindow()
    const savedSettings = readSettings()
    buildMenu(() => mainWindow, 'coding', isLocaleId(savedSettings.language) ? savedSettings.language : 'en')
    logLine('WINDOW CREATED')

    const files = openFilesFromArgv(process.argv)
    if (files.length) {
      mainWindow.webContents.once('did-finish-load', () => {
        mainWindow?.webContents.send('opennotes:open-files', files)
      })
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) mainWindow = createWindow()
    })
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// The language servers are child processes: they must not outlive the app.
app.on('before-quit', () => {
  void stopAllLspServers()
})

app.on('web-contents-created', (_event, contents) => {
  contents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })
})

export { mainWindow, nativeTheme }
