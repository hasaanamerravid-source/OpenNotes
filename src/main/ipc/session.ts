import { app, ipcMain } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'
import type { SessionState } from '@shared/types'

function storePath(): string {
  return path.join(app.getPath('userData'), 'session.json')
}

export function registerSessionHandlers(): void {
  ipcMain.handle('session:load', async (): Promise<SessionState | null> => {
    try {
      const raw = await fs.readFile(storePath(), 'utf8')
      return JSON.parse(raw) as SessionState
    } catch {
      return null
    }
  })

  ipcMain.handle('session:save', async (_e, state: SessionState) => {
    await fs.mkdir(path.dirname(storePath()), { recursive: true })
    await fs.writeFile(storePath(), JSON.stringify(state, null, 2), 'utf8')
    return true
  })
}
