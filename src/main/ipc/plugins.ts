import { app, ipcMain } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'
import type { PluginManifest } from '@shared/types'

function pluginsRoot(): string {
  return path.join(app.getPath('userData'), 'plugins')
}

/**
 * Discover user plugins. Each plugin lives in <userData>/plugins/<id>/plugin.js
 * and may ship a plugin.json manifest next to it.
 */
export function registerPluginHandlers(): void {
  ipcMain.handle('plugins:list', async (): Promise<PluginManifest[]> => {
    const root = pluginsRoot()
    let dirs: string[] = []
    try {
      dirs = await fs.readdir(root)
    } catch {
      return []
    }
    const out: PluginManifest[] = []
    for (const dir of dirs) {
      const pluginDir = path.join(root, dir)
      const entry = path.join(pluginDir, 'plugin.js')
      try {
        const source = await fs.readFile(entry, 'utf8')
        let manifest: Partial<PluginManifest> = {}
        try {
          manifest = JSON.parse(
            await fs.readFile(path.join(pluginDir, 'plugin.json'), 'utf8'),
          ) as Partial<PluginManifest>
        } catch {
          /* manifest is optional */
        }
        out.push({
          id: manifest.id ?? dir,
          name: manifest.name ?? dir,
          version: manifest.version ?? '0.0.0',
          description: manifest.description ?? '',
          path: pluginDir,
          source,
        })
      } catch {
        /* not a plugin */
      }
    }
    return out
  })
}
