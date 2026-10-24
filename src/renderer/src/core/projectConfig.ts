import { useEffect, useState } from 'react'
import { useAppStore } from '../store/app'

/** The per project configuration, stored as plain JSON in the project folder. */
export interface ProjectConfig {
  /** Interpreter / SDK paths, keyed by language. */
  toolchain?: Record<string, string>
  /** Language server commands, keyed by language. */
  lsp?: Record<string, { command: string; args?: string[] }>
  /** The shell used by the terminal. */
  terminal?: { shell?: string; cwd?: string }
  /** Extra arguments for the run command, keyed by language. */
  run?: Record<string, string[]>
  /** The shortcuts of the commands, keyed by the id of the command. */
  keybindings?: Record<string, string>
}

export const PROJECT_CONFIG_NAME = '.opennotes.json'

/** The folder of a file (the path without the file name). */
export function folderOfPath(filePath: string): string | null {
  if (!filePath) return null
  const parts = filePath.split(/[\\/]/)
  parts.pop()
  return parts.join('\\') || null
}

/** The folder a project configuration belongs to. */
export function projectFolder(): string | null {
  const state = useAppStore.getState()
  const settings = state.settings
  if (settings.projectFolder) return settings.projectFolder
  const tab = state.tabs.find((t) => t.id === state.activeTabId)
  if (tab?.path) return folderOfPath(tab.path)
  return null
}

/** Read the project configuration of a folder (null when there is none). */
export async function readProjectConfig(folder: string): Promise<ProjectConfig | null> {
  try {
    const path = `${folder}\\${PROJECT_CONFIG_NAME}`
    if (!(await window.api.fs.exists(path))) return null
    const text = await window.api.fs.readTextFile(path)
    return JSON.parse(text) as ProjectConfig
  } catch {
    return null
  }
}

/** Write the project configuration of a folder. */
export async function writeProjectConfig(folder: string, config: ProjectConfig): Promise<void> {
  const path = `${folder}\\${PROJECT_CONFIG_NAME}`
  await window.api.fs.writeTextFile(path, `${JSON.stringify(config, null, 2)}\n`)
}

/** The toolchain of a language: the project file wins over the global settings. */
export function resolveTool(language: string, project: ProjectConfig | null, globals: Record<string, string>): string {
  const fromProject = project?.toolchain?.[language]
  if (fromProject) return fromProject
  return globals[language] ?? ''
}

/** The language server command of a language. */
export function resolveServer(
  language: string,
  project: ProjectConfig | null,
  globals: Record<string, { command: string; args?: string[] }>,
): { command: string; args?: string[] } | null {
  const fromProject = project?.lsp?.[language]
  if (fromProject?.command) return fromProject
  const global = globals[language]
  return global?.command ? global : null
}

/** The language servers of a project: the project file wins over the globals. */
export function resolveServers(
  project: ProjectConfig | null,
  globals: Record<string, { command: string; args?: string[] }>,
): Record<string, { command: string; args?: string[] }> {
  const out: Record<string, { command: string; args?: string[] }> = { ...globals }
  for (const [language, server] of Object.entries(project?.lsp ?? {})) {
    if (server?.command) out[language] = server
  }
  return out
}

/** Loads the project configuration of the current project folder. */
export function useProjectConfig(): ProjectConfig | null {
  const [config, setConfig] = useState<ProjectConfig | null>(null)
  const folder = projectFolder()
  const activePath = useAppStore((s) => s.tabs.find((t) => t.id === s.activeTabId)?.path ?? '')

  useEffect(() => {
    let cancelled = false
    if (!folder) {
      setConfig(null)
      cache = null
      return
    }
    void readProjectConfig(folder).then((loaded) => {
      if (cancelled) return
      cache = { folder, config: loaded }
      setConfig(loaded)
    })
    return () => {
      cancelled = true
    }
  }, [folder, activePath])

  return config
}

/** The configuration that was loaded last (the run service uses it). */
let cache: { folder: string; config: ProjectConfig | null } | null = null

/** The project configuration that is known right now. */
export function cachedProjectConfig(): ProjectConfig | null {
  return cache?.config ?? null
}
