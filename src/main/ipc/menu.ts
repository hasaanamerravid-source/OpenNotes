import { ipcMain } from 'electron'
import {
  updateRecentMenu,
  updateMenuProfile,
  updateMenuLocale,
  updateMenuKeybindings,
  getAcceleratorCommands,
} from '../menu'
import type { Profile } from '@shared/types'
import { isLocaleId } from '@shared/i18n'

export function registerMenuHandlers(): void {
  ipcMain.handle('menu:recent', (_e, paths: string[]) => {
    updateRecentMenu(Array.isArray(paths) ? paths : [])
    return true
  })
  ipcMain.handle('menu:profile', (_e, profile: Profile) => {
    updateMenuProfile(profile)
    return true
  })
  ipcMain.handle('menu:locale', (_e, locale: string) => {
    if (!isLocaleId(locale)) return false
    updateMenuLocale(locale)
    return true
  })
  ipcMain.handle('menu:keybindings', (_e, bindings: Record<string, string>) => {
    if (!bindings || typeof bindings !== 'object') return false
    updateMenuKeybindings(bindings)
    return true
  })
  ipcMain.handle('menu:accelerators', () => getAcceleratorCommands())
}
