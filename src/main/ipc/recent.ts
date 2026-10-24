import { app, ipcMain } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'

function storePath(): string {
  return path.join(app.getPath('userData'), 'recent.json')
}

async function read(): Promise<string[]> {
  try {
    const raw = await fs.readFile(storePath(), 'utf8')
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as string[]) : []
  } catch {
    return []
  }
}

async function write(list: string[]): Promise<void> {
  await fs.mkdir(path.dirname(storePath()), { recursive: true })
  await fs.writeFile(storePath(), JSON.stringify(list.slice(0, 30), null, 2), 'utf8')
}

export function registerRecentHandlers(): void {
  ipcMain.handle('recent:list', async () => read())

  ipcMain.handle('recent:add', async (_e, filePath: string) => {
    const list = await read()
    const next = [filePath, ...list.filter((p) => p.toLowerCase() !== filePath.toLowerCase())]
    await write(next)
    return next
  })

  ipcMain.handle('recent:clear', async () => {
    await write([])
    return true
  })
}
