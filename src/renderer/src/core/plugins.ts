import type { Command, PluginManifest } from '@shared/types'
import { registerCommand, unregisterCommand, getCommands, runCommand } from './commands'
import { getEditor } from './editors'

export interface PluginContext {
  api: typeof window.api
  commands: {
    register: (command: Command) => void
    unregister: (id: string) => void
    list: () => Command[]
    run: (id: string, payload?: unknown) => Promise<void>
  }
  editor: typeof getEditor
  toast: (message: string, kind?: 'info' | 'error' | 'success') => void
}

export interface PluginModule {
  id?: string
  name?: string
  version?: string
  description?: string
  commands?: Command[]
  activate?: (ctx: PluginContext) => void
  deactivate?: () => void
}

export interface LoadedPlugin {
  manifest: PluginManifest
  module: PluginModule
  active: boolean
  error?: string
}

const loaded = new Map<string, LoadedPlugin>()
const commandIds = new Map<string, string[]>()

function buildContext(manifest: PluginManifest): PluginContext {
  return {
    api: window.api,
    commands: {
      register: (command) => registerCommand(command),
      unregister: (id) => unregisterCommand(id),
      list: () => getCommands(),
      run: (id, payload) => runCommand(id, payload),
    },
    editor: getEditor,
    toast: (message, kind) => {
      window.dispatchEvent(new CustomEvent('opennotes:toast', { detail: { message, kind } }))
    },
  }
}

/**
 * Evaluate a plugin source and return its exported module object.
 *
 * The plugin is a plain script, so `export default { … }` is translated into
 * `module.exports = { … }`: that is the syntax the documentation shows.
 */
export function evaluatePlugin(source: string): PluginModule {
  const module = { exports: {} as PluginModule }
  const fn = new Function('module', 'exports', 'require', 'window', 'console', normalizePlugin(source))
  fn(
    module,
    module.exports,
    () => {
      throw new Error('require() is not available inside plugins')
    },
    window,
    console,
  )
  const exported = module.exports as PluginModule
  if (exported && typeof exported === 'object' && 'default' in exported) {
    return (exported as unknown as { default: PluginModule }).default
  }
  return exported
}

/** Translate the export syntax of a plugin into the one of a script. */
function normalizePlugin(source: string): string {
  return source.replace(/^[ \t]*export\s+default\s+/m, 'module.exports = ')
}

/** Discover all installed plugins. */
export async function discoverPlugins(): Promise<PluginManifest[]> {
  try {
    return await window.api.plugins.list()
  } catch {
    return []
  }
}

/** Load (but do not activate) every installed plugin. */
export async function loadAllPlugins(): Promise<LoadedPlugin[]> {
  const manifests = await discoverPlugins()
  for (const manifest of manifests) {
    if (loaded.has(manifest.id)) continue
    try {
      const module = evaluatePlugin(manifest.source)
      loaded.set(manifest.id, { manifest, module, active: false })
    } catch (err) {
      loaded.set(manifest.id, {
        manifest,
        module: {},
        active: false,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }
  return [...loaded.values()]
}

/** Activate a plugin by id. */
export function activatePlugin(id: string): string | null {
  const entry = loaded.get(id)
  if (!entry) return `Plugin "${id}" is not installed.`
  if (entry.active) return null
  if (entry.error) return entry.error
  const ids: string[] = []
  try {
    for (const command of entry.module.commands ?? []) {
      registerCommand(command)
      ids.push(command.id)
    }
    commandIds.set(id, ids)
    entry.module.activate?.(buildContext(entry.manifest))
    entry.active = true
    return null
  } catch (err) {
    // A plugin that cannot be activated must not leave its commands behind.
    for (const commandId of ids) unregisterCommand(commandId)
    commandIds.delete(id)
    return err instanceof Error ? err.message : String(err)
  }
}

/** Deactivate a plugin by id. */
export function deactivatePlugin(id: string): void {
  const entry = loaded.get(id)
  if (!entry) return
  try {
    entry.module.deactivate?.()
  } catch {
    /* ignore */
  }
  for (const commandId of commandIds.get(id) ?? []) unregisterCommand(commandId)
  commandIds.delete(id)
  entry.active = false
}

/** Activate the plugins listed in the settings. */
export async function activateEnabledPlugins(ids: string[]): Promise<void> {
  await loadAllPlugins()
  for (const id of ids) {
    const error = activatePlugin(id)
    if (error) console.warn(`[plugin ${id}] ${error}`)
  }
}

export function getLoadedPlugins(): LoadedPlugin[] {
  return [...loaded.values()]
}
