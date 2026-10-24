import { app, ipcMain } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'
import type { Settings } from '@shared/types'

function storePath(): string {
  return path.join(app.getPath('userData'), 'settings.json')
}

/** Called after the settings were saved (the language servers use them). */
type SettingsListener = (settings: Settings) => void
const listeners: SettingsListener[] = []

/** React to a changed set of settings. */
export function onSettingsChanged(listener: SettingsListener): void {
  listeners.push(listener)
}

export function registerSettingsHandlers(): void {
  ipcMain.handle('settings:load', async (): Promise<Partial<Settings> | null> => {
    try {
      const raw = await fs.readFile(storePath(), 'utf8')
      return JSON.parse(raw) as Partial<Settings>
    } catch {
      return null
    }
  })

  ipcMain.handle('settings:save', async (_e, settings: Settings) => {
    await fs.mkdir(path.dirname(storePath()), { recursive: true })
    await fs.writeFile(storePath(), JSON.stringify(settings, null, 2), 'utf8')
    for (const listener of listeners) {
      try {
        listener(settings)
      } catch {
        /* a listener must never break the save */
      }
    }
    return true
  })
}
