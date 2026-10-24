import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type {
  AppInfo,
  DialogResult,
  DirEntry,
  Eol,
  FilePayload,
  OpenDialogOptions,
  PluginManifest,
  SaveDialogOptions,
  SessionState,
  Settings,
} from '@shared/types'

export interface RunEvent {
  type: 'start' | 'stdout' | 'stderr' | 'exit' | 'error'
  text?: string
  code?: number
}

/**
 * Electron throws "Object has been destroyed" when an IPC call happens while the
 * window is being torn down (closing the app, reloading the renderer). Those
 * calls are harmless, so they are swallowed instead of crashing the renderer.
 */
function isDestroyedError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '')
  return /destroyed|Cannot read properties of null/i.test(message)
}

type AnyFn = (...args: unknown[]) => unknown

function guard<T>(fn: T): T {
  if (typeof fn !== 'function') return fn
  return ((...args: unknown[]) => {
    try {
      const result = (fn as AnyFn)(...args)
      if (result && typeof (result as Promise<unknown>).then === 'function') {
        return (result as Promise<unknown>).catch((error: unknown) => {
          if (isDestroyedError(error)) {
            console.warn('[opennotes] ignored a call on a destroyed context')
            return undefined
          }
          throw error
        })
      }
      return result
    } catch (error) {
      if (isDestroyedError(error)) {
        console.warn('[opennotes] ignored a call on a destroyed context')
        return undefined
      }
      throw error
    }
  }) as T
}

function guardAll<T extends Record<string, unknown>>(source: T): T {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(source)) {
    out[key] = value && typeof value === 'object' ? guardAll(value as Record<string, unknown>) : guard(value)
  }
  return out as T
}

const api = {
  info: (): Promise<AppInfo> => ipcRenderer.invoke('app:info'),
  fs: {
    openDialog: (opts: OpenDialogOptions): Promise<DialogResult> => ipcRenderer.invoke('fs:openDialog', opts),
    saveDialog: (opts: SaveDialogOptions): Promise<DialogResult> => ipcRenderer.invoke('fs:saveDialog', opts),
    readFile: (p: string): Promise<FilePayload> => ipcRenderer.invoke('fs:readFile', p),
    writeFile: (p: string, content: string, encoding: string, eol: Eol): Promise<void> =>
      ipcRenderer.invoke('fs:writeFile', p, content, encoding, eol),
    readDir: (p: string): Promise<DirEntry[]> => ipcRenderer.invoke('fs:readDir', p),
    listRecursive: (p: string, maxDepth?: number): Promise<DirEntry[]> =>
      ipcRenderer.invoke('fs:listRecursive', p, maxDepth),
    stat: (p: string): Promise<DirEntry | null> => ipcRenderer.invoke('fs:stat', p),
    exists: (p: string): Promise<boolean> => ipcRenderer.invoke('fs:exists', p),
    makeDir: (p: string): Promise<void> => ipcRenderer.invoke('fs:makeDir', p),
    remove: (p: string): Promise<void> => ipcRenderer.invoke('fs:remove', p),
    rename: (from: string, to: string): Promise<void> => ipcRenderer.invoke('fs:rename', from, to),
    copyFile: (from: string, to: string): Promise<void> => ipcRenderer.invoke('fs:copyFile', from, to),
    showInFolder: (p: string): Promise<void> => ipcRenderer.invoke('fs:showInFolder', p),
    readTextFile: (p: string): Promise<string> => ipcRenderer.invoke('fs:readTextFile', p),
    writeTextFile: (p: string, text: string): Promise<void> => ipcRenderer.invoke('fs:writeTextFile', p, text),
    search: (request: {
      folder: string
      query: string
      regex?: boolean
      caseSensitive?: boolean
      wholeWord?: boolean
      include?: string
      maxResults?: number
    }): Promise<unknown> => ipcRenderer.invoke('fs:search', request),
    replaceInFiles: (request: {
      folder: string
      query: string
      replacement: string
      regex?: boolean
      caseSensitive?: boolean
      wholeWord?: boolean
      include?: string
    }): Promise<unknown> => ipcRenderer.invoke('fs:replaceInFiles', request),
    watch: (p: string, cb: (changed: boolean) => void): Promise<() => void> => {
      ipcRenderer.on('fs:changed', (_e, changedPath: string) => {
        if (changedPath === p) cb(true)
      })
      void ipcRenderer.invoke('fs:watch', p)
      return Promise.resolve(() => {
        void ipcRenderer.invoke('fs:unwatch', p)
      })
    },
  },

  recent: {
    list: (): Promise<string[]> => ipcRenderer.invoke('recent:list'),
    add: (p: string): Promise<string[]> => ipcRenderer.invoke('recent:add', p),
    clear: (): Promise<void> => ipcRenderer.invoke('recent:clear'),
  },

  session: {
    load: (): Promise<SessionState | null> => ipcRenderer.invoke('session:load'),
    save: (state: SessionState): Promise<void> => ipcRenderer.invoke('session:save', state),
  },

  settings: {
    load: (): Promise<Partial<Settings> | null> => ipcRenderer.invoke('settings:load'),
    save: (settings: Settings): Promise<void> => ipcRenderer.invoke('settings:save', settings),
  },

  plugins: {
    list: (): Promise<PluginManifest[]> => ipcRenderer.invoke('plugins:list'),
  },

  clipboard: {
    readText: (): Promise<string> => ipcRenderer.invoke('clipboard:readText'),
    writeText: (text: string): Promise<boolean> => ipcRenderer.invoke('clipboard:writeText', text),
  },

  shell: {
    openTerminal: (cwd?: string): Promise<boolean> => ipcRenderer.invoke('shell:openTerminal', cwd),
    run: (filePath: string): Promise<string | null> => ipcRenderer.invoke('shell:run', filePath),
  },

  menu: {
    setRecent: (paths: string[]): Promise<boolean> => ipcRenderer.invoke('menu:recent', paths),
    setProfile: (profile: string): Promise<boolean> => ipcRenderer.invoke('menu:profile', profile),
    /** Write the native menu in another language. */
    setLocale: (locale: string): Promise<boolean> => ipcRenderer.invoke('menu:locale', locale),
    /** The keybindings of the user: a bound command loses its accelerator. */
    setKeybindings: (bindings: Record<string, string>): Promise<boolean> =>
      ipcRenderer.invoke('menu:keybindings', bindings),
    /** The commands the native menu binds to a key itself. */
    accelerators: (): Promise<string[]> => ipcRenderer.invoke('menu:accelerators'),
  },

  /** Run the active file and stream its output back. */
  run: {
    start: (filePath: string, language: string, toolchain?: Record<string, string>): Promise<boolean> =>
      ipcRenderer.invoke('run:start', { filePath, language, toolchain }),
    stop: (): Promise<boolean> => ipcRenderer.invoke('run:stop'),
    onOutput: (cb: (event: RunEvent) => void): (() => void) => {
      const listener = (_e: unknown, payload: RunEvent): void => cb(payload)
      ipcRenderer.on('run:output', listener)
      return () => ipcRenderer.removeListener('run:output', listener)
    },
  },

  /** The integrated terminal (a shell with a pipe). */
  terminal: {
    start: (cwd?: string): Promise<unknown> => ipcRenderer.invoke('terminal:start', { cwd }),
    write: (text: string): Promise<unknown> => ipcRenderer.invoke('terminal:write', { text }),
    interrupt: (): Promise<unknown> => ipcRenderer.invoke('terminal:interrupt'),
    stop: (): Promise<unknown> => ipcRenderer.invoke('terminal:stop'),
    resize: (cols: number, rows: number): Promise<unknown> => ipcRenderer.invoke('terminal:resize', cols, rows),
    onOutput: (cb: (event: unknown) => void): (() => void) => {
      const listener = (_e: unknown, payload: unknown): void => cb(payload)
      ipcRenderer.on('terminal:output', listener)
      return () => ipcRenderer.removeListener('terminal:output', listener)
    },
  },

  /** The language servers (LSP). */
  lsp: {
    start: (languages: string[]): Promise<unknown> => ipcRenderer.invoke('lsp:start', languages),
    didOpen: (params: { language: string; uri: string; text: string }): Promise<unknown> =>
      ipcRenderer.invoke('lsp:didOpen', params),
    didChange: (params: { language: string; uri: string; text: string }): Promise<unknown> =>
      ipcRenderer.invoke('lsp:didChange', params),
    didClose: (params: { language: string; uri: string }): Promise<unknown> =>
      ipcRenderer.invoke('lsp:didClose', params),
    request: (params: { language: string; method: string; params?: unknown }): Promise<unknown> =>
      ipcRenderer.invoke('lsp:request', params),
    stop: (language?: string): Promise<unknown> => ipcRenderer.invoke('lsp:stop', language ?? null),
    configure: (config: {
      servers?: Record<string, { command: string; args?: string[] }>
      rootPath?: string | null
    }): Promise<unknown> => ipcRenderer.invoke('lsp:configure', config),
    onDiagnostics: (cb: (event: unknown) => void): (() => void) => {
      const listener = (_e: unknown, payload: unknown): void => cb(payload)
      ipcRenderer.on('lsp:diagnostics', listener)
      return () => ipcRenderer.removeListener('lsp:diagnostics', listener)
    },
    onStatus: (cb: (event: unknown) => void): (() => void) => {
      const listener = (_e: unknown, payload: unknown): void => cb(payload)
      ipcRenderer.on('lsp:status', listener)
      return () => ipcRenderer.removeListener('lsp:status', listener)
    },
  },

  /** Report a renderer failure to the main process log. */
  reportError: (message: string): void => {
    ipcRenderer.send('app:error', message)
  },

  /** Test helper: a real mouse click at window coordinates. */
  test:
    process.env.OPENNOTES_TEST_CLICK === '1'
      ? {
          click: (x: number, y: number): void => {
            ipcRenderer.send('test:click', x, y)
          },
          key: (key: string, modifiers: string[] = []): void => {
            ipcRenderer.send('test:key', key, modifiers)
          },
        }
      : undefined,

  win: {
    newWindow: (): Promise<boolean> => ipcRenderer.invoke('win:newWindow'),
    setMenuBar: (visible: boolean): Promise<boolean> => ipcRenderer.invoke('win:setMenuBar', visible),
    minimize: (): void => ipcRenderer.send('win:minimize'),
    toggleMaximize: (): void => ipcRenderer.send('win:toggleMaximize'),
    close: (): void => ipcRenderer.send('win:close'),
    isMaximized: (): Promise<boolean> => ipcRenderer.invoke('win:isMaximized'),
    zoom: (delta: number): void => ipcRenderer.send('win:zoom', delta),
    getZoom: (): Promise<number> => ipcRenderer.invoke('win:getZoom'),
    setZoom: (factor: number): Promise<boolean> => ipcRenderer.invoke('win:setZoom', factor),
    setTitle: (title: string): void => ipcRenderer.send('win:setTitle', title),
    setTheme: (color: string): void => ipcRenderer.send('win:setTheme', color),
    onMaximizeChange: (cb: (maximized: boolean) => void): (() => void) => {
      const listener = (_e: unknown, maximized: boolean): void => cb(maximized)
      ipcRenderer.on('win:maximize-change', listener)
      return () => ipcRenderer.removeListener('win:maximize-change', listener)
    },
  },

  onCommand: (cb: (id: string, payload?: unknown) => void): (() => void) => {
    const listener = (_e: unknown, id: string, payload?: unknown): void => cb(id, payload)
    ipcRenderer.on('menu:command', listener)
    return () => ipcRenderer.removeListener('menu:command', listener)
  },

  /** The commands the native menu binds to a key (it changes with the menu). */
  onMenuAccelerators: (cb: (commands: string[]) => void): (() => void) => {
    const listener = (_e: unknown, commands: string[]): void => cb(commands)
    ipcRenderer.on('menu:accelerators', listener)
    return () => ipcRenderer.removeListener('menu:accelerators', listener)
  },

  onOpenFiles: (cb: (paths: string[]) => void): (() => void) => {
    const listener = (_e: unknown, paths: string[]): void => cb(paths)
    ipcRenderer.on('opennotes:open-files', listener)
    return () => ipcRenderer.removeListener('opennotes:open-files', listener)
  },

  /** Resolve the real path of a File dropped onto the window (Electron 32+). */
  pathForFile: (file: File): string => {
    try {
      return webUtils.getPathForFile(file)
    } catch {
      return file.name
    }
  },
}

contextBridge.exposeInMainWorld('api', guardAll(api))

export type OpenNotesApi = typeof api
