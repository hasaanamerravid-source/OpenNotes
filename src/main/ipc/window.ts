import { app, ipcMain, BrowserWindow } from 'electron'

let mainWindow: BrowserWindow | null = null

export function setMainWindow(win: BrowserWindow): void {
  mainWindow = win
  win.on('maximize', () => win.webContents.send('win:maximize-change', true))
  win.on('unmaximize', () => win.webContents.send('win:maximize-change', false))
}

function target(): BrowserWindow | null {
  return BrowserWindow.getFocusedWindow() ?? mainWindow ?? BrowserWindow.getAllWindows()[0] ?? null
}

export function registerWindowHandlers(): void {
  ipcMain.on('win:minimize', () => target()?.minimize())
  ipcMain.handle('win:setMenuBar', (_e, visible: boolean) => {
    const win = target()
    if (!win) return false
    // Hiding the bar keeps all accelerators working.
    win.setMenuBarVisibility(visible)
    return true
  })
  ipcMain.on('win:toggleMaximize', () => {
    const win = target()
    if (!win) return
    if (win.isMaximized()) win.unmaximize()
    else win.maximize()
  })
  ipcMain.on('win:close', () => target()?.close())
  ipcMain.handle('win:isMaximized', () => target()?.isMaximized() ?? false)
  ipcMain.on('win:zoom', (_e, delta: number) => {
    const win = target()
    if (!win) return
    const factor = win.webContents.getZoomFactor()
    const next = Math.min(3, Math.max(0.4, factor + delta))
    win.webContents.setZoomFactor(next)
  })
  ipcMain.handle('win:getZoom', () => target()?.webContents.getZoomFactor() ?? 1)
  ipcMain.handle('win:setZoom', (_e, factor: number) => {
    const win = target()
    if (!win) return false
    win.webContents.setZoomFactor(Math.min(3, Math.max(0.4, factor)))
    return true
  })
  ipcMain.on('win:setTitle', (_e, title: string) => {
    const win = target()
    if (win) win.setTitle(title)
  })
  ipcMain.on('win:setTheme', (_e, color: string) => {
    const win = target()
    if (!win) return
    // The window frame is drawn by the application, so there is no native
    // overlay to repaint. The colour of the window itself is what the user
    // sees while the interface is being drawn.
    try {
      win.setBackgroundColor(color)
    } catch {
      /* the platform does not know the colour */
    }
  })
}

export function appVersion(): string {
  return app.getVersion()
}
