import { BrowserWindow } from 'electron'
import path from 'node:path'
import { existsSync } from 'node:fs'

/**
 * The window factory of the application.
 *
 * Every window of OpenNotes looks the same: the frame is drawn by the
 * application itself, so the native title bar and the native overlay are
 * switched off. Having the factory in one place keeps a second window (the
 * *new window* command) identical to the first one.
 */

/** The application icon (Windows prefers an .ico, the PNG is the fallback). */
export function iconPath(): string | undefined {
  const ico = path.join(__dirname, '../../build/icon.ico')
  if (existsSync(ico)) return ico
  const png = path.join(__dirname, '../../build/icon.png')
  if (existsSync(png)) return png
  return undefined
}

/** Create a window of the application. */
export function createAppWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 520,
    minHeight: 360,
    show: false,
    backgroundColor: '#1e1e28',
    // The window frame is drawn by the app: no native title bar and no native
    // overlay, so the toolbar and the burger button are never blocked.
    titleBarStyle: 'hidden',
    autoHideMenuBar: true,
    icon: iconPath(),
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: true,
    },
  })

  win.setMenuBarVisibility(false)
  // Background windows get their timers throttled to once a minute by Chromium,
  // which makes the automated tests flaky.
  if (process.env.OPENNOTES_NO_THROTTLE === '1') win.webContents.setBackgroundThrottling(false)

  win.once('ready-to-show', () => win.show())

  if (process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void win.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  return win
}
