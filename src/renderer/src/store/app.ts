import { create } from 'zustand'
import type { Eol, SessionState, Settings, Tab } from '@shared/types'
import { translate, type MessageKey } from '@shared/i18n'
import { DEFAULT_SETTINGS } from '../core/defaults'
import { getEditor } from '../core/editors'
import { runCommand } from '../core/commands'
import { sfx } from '../core/soundFx'

/**
 * The text of a message in the language of the user. The store must not
 * depend on the React layer, so the translation runtime is used directly.
 */
function tr(key: MessageKey, params?: Record<string, string | number>): string {
  return translate(useAppStore.getState().settings.language, key, params)
}

export type SidePanel = 'files' | 'search' | 'outline' | 'plugins' | 'problems' | 'run'

export type BottomTab = 'problems' | 'run' | 'terminal'

/** Kept for backwards compatibility with older imports. */
export type SidebarPanel = SidePanel

export interface Toast {
  id: number
  message: string
  kind: 'info' | 'error' | 'success'
}

interface AppState {
  ready: boolean
  tabs: Tab[]
  activeTabId: string | null
  settings: Settings
  workspaceRoot: string | null
  sidebarVisible: boolean
  sidePanel: SidePanel
  bottomTab: BottomTab
  bottomPanelVisible: boolean
  sidebarWidth: number
  paletteOpen: boolean
  paletteMode: 'commands' | 'files'
  compareData: { left: string; right: string; leftName: string; rightName: string } | null
  settingsOpen: boolean
  aboutOpen: boolean
  compareOpen: boolean
  charMapOpen: boolean
  welcomeOpen: boolean
  statusBarVisible: boolean
  distractionFree: boolean
  splitView: boolean
  toasts: Toast[]
  zoom: number

  // actions
  init: () => Promise<void>
  newTab: (opts?: Partial<Tab>) => string
  openPath: (path: string) => Promise<void>
  openPaths: (paths: string[]) => Promise<void>
  closeTab: (id: string) => Promise<void>
  closeAll: () => Promise<void>
  setActiveTab: (id: string) => void
  updateTab: (id: string, patch: Partial<Tab>) => void
  setTabDirty: (id: string, dirty: boolean) => void
  flushTab: (id: string) => void
  saveTab: (id: string, saveAs?: boolean) => Promise<boolean>
  saveAll: () => Promise<void>
  setSettings: (patch: Partial<Settings>) => void
  saveSettings: () => Promise<void>
  setSidePanel: (panel: SidePanel) => void
  setBottomTab: (tab: BottomTab) => void
  setBottomPanelVisible: (visible: boolean) => void
  toggleSidebar: () => void
  setPalette: (open: boolean) => void
  setPaletteMode: (mode: 'commands' | 'files') => void
  setCompareData: (data: { left: string; right: string; leftName: string; rightName: string } | null) => void
  setDialog: (which: 'settings' | 'about' | 'compare' | 'charMap' | 'welcome', open: boolean) => void
  setDistractionFree: (on: boolean) => void
  setSplitView: (on: boolean) => void
  setZoom: (z: number) => void
  toast: (message: string, kind?: Toast['kind']) => void
  dismissToast: (id: number) => void
  setWorkspaceRoot: (root: string | null) => void
  persistSession: () => Promise<void>
}

let tabSeq = 0
function nextTabId(): string {
  tabSeq += 1
  return `tab-${Date.now().toString(36)}-${tabSeq}`
}

/** File watchers, one per open file, used to detect external changes. */
const watchers = new Map<string, () => void>()

function watchFile(path: string): void {
  if (watchers.has(path)) return
  let timer: number | null = null
  const stop = window.api.fs
    .watch(path, () => {
      if (timer !== null) window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        void reloadIfChanged(path)
      }, 250)
    })
    .then((unwatch) => {
      watchers.set(path, () => {
        if (timer !== null) window.clearTimeout(timer)
        void unwatch()
        watchers.delete(path)
      })
    })
    .catch(() => undefined)
}

/** Reload the file when it changed on disk and the buffer is clean. */
async function reloadIfChanged(path: string): Promise<void> {
  const state = useAppStore.getState()
  const tab = state.tabs.find((t) => t.path?.toLowerCase() === path.toLowerCase())
  if (!tab) return
  try {
    const payload = await window.api.fs.readFile(path)
    if (payload.content === tab.content) return
    if (tab.dirty) {
      state.toast(tr('toast.fileChanged', { name: tab.name }), 'error')
      return
    }
    state.updateTab(tab.id, { content: payload.content, encoding: payload.encoding, eol: payload.eol })
    state.toast(tr('toast.fileReloaded', { name: tab.name }))
  } catch {
    state.toast(tr('toast.fileUnreadable', { name: tab.name }), 'error')
  }
}

let toastSeq = 0

function baseTab(path: string | null, name: string): Tab {
  return {
    id: nextTabId(),
    path,
    name,
    mode: 'code',
    content: '',
    dirty: false,
    encoding: DEFAULT_SETTINGS.defaultEncoding,
    eol: DEFAULT_SETTINGS.defaultEol,
    language: 'text',
    readonly: false,
    view: 'source',
  }
}

/** Map a file name onto a language id (used for the initial highlighting). */
const EXTENSION_LANGUAGES: Record<string, string> = {
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  jsx: 'jsx',
  ts: 'typescript',
  tsx: 'tsx',
  py: 'python',
  java: 'java',
  go: 'go',
  rs: 'rust',
  rb: 'ruby',
  php: 'php',
  cs: 'csharp',
  fs: 'fsharp',
  fsi: 'fsharp',
  kt: 'kotlin',
  kts: 'kotlin',
  swift: 'swift',
  scala: 'scala',
  sc: 'scala',
  dart: 'dart',
  lua: 'lua',
  pl: 'perl',
  pm: 'perl',
  r: 'r',
  jl: 'julia',
  hs: 'haskell',
  ex: 'elixir',
  exs: 'elixir',
  erl: 'erlang',
  ml: 'ocaml',
  mli: 'ocaml',
  nim: 'nim',
  zig: 'zig',
  sol: 'solidity',
  vue: 'vue',
  svelte: 'svelte',
  astro: 'astro',
  graphql: 'graphql',
  gql: 'graphql',
  hcl: 'hcl',
  tf: 'hcl',
  tfvars: 'hcl',
  sh: 'shell',
  bash: 'bash',
  zsh: 'shell',
  fish: 'shell',
  ps1: 'powershell',
  psm1: 'powershell',
  bat: 'batch',
  cmd: 'batch',
  vb: 'vb',
  vbs: 'vb',
  proto: 'protobuf',
  clj: 'clojure',
  cljs: 'clojure',
  cljc: 'clojure',
  edn: 'clojure',
  d: 'd',
  di: 'd',
  ada: 'ada',
  adb: 'ada',
  ads: 'ada',
  cr: 'crystal',
  ltx: 'latex',
  gdscript: 'gdscript',
  gd: 'gdscript',
  elm: 'elm',
  purs: 'purescript',
  haxe: 'haxe',
  hx: 'haxe',
  idr: 'idris',
  agda: 'agda',
  lean: 'lean',
  rakumod: 'raku',
  raku: 'raku',
  p6: 'raku',
  http: 'http',
  rst: 'rest',
  prisma: 'prisma',
  service: 'systemd',
  socket: 'systemd',
  timer: 'systemd',
  mount: 'systemd',
  target: 'systemd',
  slice: 'systemd',
  scope: 'systemd',
  desktop: 'desktop',
  gitconfig: 'gitconfig',
  gitmodules: 'gitconfig',
  gitignore: 'gitignore',
  npmignore: 'gitignore',
  dockerignore: 'gitignore',
  editorconfig: 'editorconfig',
  mustache: 'mustache',
  hbs: 'handlebars',
  ejs: 'ejs',
  pug: 'pug',
  jade: 'pug',
  twig: 'twig',
  liquid: 'liquid',
  feature: 'gherkin',
  robot: 'robot',
  jsonnet: 'jsonnet',
  libsonnet: 'jsonnet',
  cue: 'cue',
  star: 'starlark',
  justfile: 'just',
  meson: 'meson',
  cmake: 'cmake',
  ninja: 'ninja',
  bzl: 'bazel',
  bazel: 'bazel',
  wat: 'wat',
  wast: 'wat',
  scad: 'scad',
  ino: 'ino',
  rkt: 'racket',
  scm: 'scm',
  plist: 'plist',
  strings: 'strings',
  xcconfig: 'xcconfig',
  pbxproj: 'pbxproj',
  sln: 'sln',
  csproj: 'csproj',
  vbproj: 'vbproj',
  fsproj: 'fsproj',
  tres: 'tres',
  tscn: 'tscn',
  html: 'html',
  htm: 'html',
  xhtml: 'html',
  css: 'css',
  scss: 'scss',
  sass: 'scss',
  less: 'less',
  json: 'json',
  jsonc: 'json',
  json5: 'json',
  xml: 'xml',
  svg: 'xml',
  yaml: 'yaml',
  yml: 'yaml',
  toml: 'toml',
  ini: 'ini',
  cfg: 'ini',
  conf: 'ini',
  properties: 'ini',
  sql: 'sql',
  csv: 'csv',
  tsv: 'csv',
  md: 'markdown',
  markdown: 'markdown',
  mdx: 'markdown',
  mdown: 'markdown',
  tex: 'tex',
  latex: 'tex',
  diff: 'diff',
  patch: 'diff',
  log: 'log',
  h: 'c',
  c: 'c',
  cc: 'cpp',
  cpp: 'cpp',
  cxx: 'cpp',
  hpp: 'cpp',
  hxx: 'cpp',
  m: 'objectivec',
  mm: 'objectivec',
  asm: 'asm',
  s: 'asm',
  v: 'verilog',
  vhd: 'vhdl',
  vhdl: 'vhdl',
  m4: 'm4',
  pro: 'prolog',
  lisp: 'commonlisp',
  el: 'emacs',
  pas: 'pascal',
  f: 'fortran',
  f90: 'fortran',
  cob: 'cobol',
  tcl: 'tcl',
  awk: 'awk',
  sed: 'sed',
  groovy: 'groovy',
  gradle: 'gradle',
  coffee: 'coffee',
  plsql: 'plsql',
}

function modeForPath(p: string): { mode: Tab['mode']; language: string } {
  const lower = p.toLowerCase()
  if (/\.(md|markdown|mdx|mdown)$/.test(lower)) return { mode: 'markdown', language: 'markdown' }
  if (/\.html?$/.test(lower)) return { mode: 'code', language: 'html' }
  if (/\.gradle\.kts$/.test(lower)) return { mode: 'code', language: 'gradlekts' }
  if (/\.gdignore$/.test(lower)) return { mode: 'code', language: 'gitignore' }
  if (/\.gitignore$/.test(lower)) return { mode: 'code', language: 'gitignore' }
  // Files that are recognised by their name rather than by an extension.
  const base = lower.slice(lower.lastIndexOf('/') + 1)
  if (base === 'cmakelists.txt') return { mode: 'code', language: 'cmake' }
  if (base === 'meson.build') return { mode: 'code', language: 'meson' }
  if (base === 'justfile') return { mode: 'code', language: 'just' }
  if (base === 'build.ninja') return { mode: 'code', language: 'ninja' }
  if (base === 'gitconfig' || base === '.gitconfig') return { mode: 'code', language: 'gitconfig' }
  if (base === 'build.gradle') return { mode: 'code', language: 'gradle' }
  const ext = lower.slice(lower.lastIndexOf('.') + 1)
  if (EXTENSION_LANGUAGES[ext]) return { mode: 'code', language: EXTENSION_LANGUAGES[ext] }
  if (/(^|[\\/])dockerfile$/i.test(lower)) return { mode: 'code', language: 'dockerfile' }
  if (/(^|[\\/])makefile$/i.test(lower)) return { mode: 'code', language: 'makefile' }
  if (/(^|[\\/])nginx\.conf$/i.test(lower)) return { mode: 'code', language: 'nginx' }
  return { mode: 'code', language: 'text' }
}

export const useAppStore = create<AppState>((set, get) => ({
  ready: false,
  tabs: [],
  activeTabId: null,
  settings: { ...DEFAULT_SETTINGS },
  workspaceRoot: null,
  sidebarVisible: true,
  sidePanel: 'files',
  bottomTab: 'problems',
  bottomPanelVisible: false,
  sidebarWidth: DEFAULT_SETTINGS.sidebarWidth,
  paletteOpen: false,
  paletteMode: 'commands',
  compareData: null,
  settingsOpen: false,
  aboutOpen: false,
  compareOpen: false,
  charMapOpen: false,
  welcomeOpen: false,
  statusBarVisible: true,
  distractionFree: false,
  splitView: false,
  toasts: [],
  zoom: 1,

  init: async () => {
    const stored = await window.api.settings.load()
    // Deep merge: an older settings file must not leave gaps that would break
    // the interface.
    const settings: Settings = {
      ...DEFAULT_SETTINGS,
      ...(stored ?? {}),
      appearance: {
        ...DEFAULT_SETTINGS.appearance,
        ...((stored?.appearance ?? {}) as Record<string, unknown>),
      } as typeof DEFAULT_SETTINGS.appearance,
    }
    // The note taking profiles were retired: OpenNotes is a code workspace.
    settings.profile = 'coding'

    // Drop every recent entry that points at a missing file: a deleted recent
    // file must never break the start-up.
    const stillThere: string[] = []
    for (const file of settings.recentFiles ?? []) {
      if (await window.api.fs.exists(file)) stillThere.push(file)
    }
    settings.recentFiles = stillThere.slice(0, 20)
    if (!settings.syntaxTheme) settings.syntaxTheme = DEFAULT_SETTINGS.syntaxTheme

    set({
      settings,
      sidebarWidth: settings.sidebarWidth,
      sidebarVisible: settings.showSidebar,
      statusBarVisible: settings.showStatusBar,
    })
    window.api.recent.list().then((files) => {
      set((s) => ({ settings: { ...s.settings, recentFiles: files } }))
    })
    if (settings.restoreSession) {
      const session = await window.api.session.load()
      if (session?.tabs?.length) {
        // Only restore tabs whose file still exists — a deleted file would
        // otherwise show up as an empty, broken editor.
        const tabs: Tab[] = []
        for (const tab of session.tabs) {
          if (!tab.path) {
            tabs.push(tab)
            continue
          }
          if (await window.api.fs.exists(tab.path)) tabs.push(tab)
        }
        if (tabs.length) {
          const active = tabs.find((t) => t.id === session.activeTabId) ?? tabs[0]
          set({ tabs, activeTabId: active.id })
        }
      }
    }
    set({ ready: true })
  },

  newTab: (opts) => {
    const tab: Tab = { ...baseTab(null, tr('common.untitled')), ...opts }
    set((s) => ({ tabs: [...s.tabs, tab], activeTabId: tab.id }))
    return tab.id
  },

  openPath: async (path) => {
    const { tabs } = get()
    const existing = tabs.find((t) => t.path?.toLowerCase() === path.toLowerCase())
    if (existing) {
      set({ activeTabId: existing.id })
      return
    }
    try {
      const { mode, language } = modeForPath(path)
      const name = path.split(/[\\/]/).pop() ?? path
      const tab = baseTab(path, name)
      tab.mode = mode
      tab.language = language

      const payload = await window.api.fs.readFile(path)
      if (payload.binary) {
        get().toast(tr('toast.binaryFile'), 'error')
        return
      }
      tab.content = payload.content
      tab.encoding = payload.encoding
      tab.eol = payload.eol
      tab.size = payload.size
      // Very large files are shown read-only and without highlighting: parsing
      // hundreds of megabytes would freeze the editor.
      if (payload.size > 4 * 1024 * 1024) {
        tab.largeFile = true
        tab.readonly = true
        tab.truncatedBytes = payload.truncated ? payload.size - payload.content.length : 0
        get().toast(tr('toast.largeFile', { size: Math.round(payload.size / 1024 / 1024) }), 'error')
      }
      if (payload.kind === 'markdown') {
        tab.mode = 'markdown'
        tab.language = 'markdown'
      }

      set((s) => ({ tabs: [...s.tabs, tab], activeTabId: tab.id }))
      if (path) watchFile(path)
      sfx('open')
      await window.api.recent.add(path)
      const files = await window.api.recent.list()
      set((s) => ({ settings: { ...s.settings, recentFiles: files } }))
    } catch (err) {
      get().toast(tr('toast.couldNotOpen', { name: path, error: String(err) }), 'error')
    }
  },

  openPaths: async (paths) => {
    for (const p of paths) await get().openPath(p)
  },

  closeTab: async (id) => {
    const tab = get().tabs.find((t) => t.id === id)
    if (!tab) return
    if (tab.dirty) {
      const choice = window.confirm(
        tr('dialog.confirm.unsaved.message', { name: tab.name }) + '\n\n' + tr('dialog.confirm.unsaved.hint'),
      )
      if (choice) {
        const ok = await get().saveTab(id)
        if (!ok) return
      }
    }
    if (tab.path) {
      const stop = watchers.get(tab.path)
      if (stop) stop()
    }
    set((s) => {
      const index = s.tabs.findIndex((t) => t.id === id)
      const tabs = s.tabs.filter((t) => t.id !== id)
      const activeTabId = s.activeTabId === id ? (tabs[index]?.id ?? tabs[index - 1]?.id ?? null) : s.activeTabId
      return { tabs, activeTabId }
    })
  },

  closeAll: async () => {
    for (const t of [...get().tabs]) await get().closeTab(t.id)
  },

  setActiveTab: (id) => set({ activeTabId: id }),

  updateTab: (id, patch) => set((s) => ({ tabs: s.tabs.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),

  setTabDirty: (id, dirty) =>
    set((s) => ({ tabs: s.tabs.map((t) => (t.id === id && t.dirty !== dirty ? { ...t, dirty } : t)) })),

  flushTab: (id) => {
    const editor = getEditor(id)
    const tab = get().tabs.find((t) => t.id === id)
    if (!editor || !tab) return
    get().updateTab(id, { content: editor.getContent() })
  },

  saveTab: async (id, saveAs = false) => {
    const { tabs } = get()
    const tab = tabs.find((t) => t.id === id)
    if (!tab) return false
    get().flushTab(id)
    const fresh = get().tabs.find((t) => t.id === id)
    if (!fresh) return false

    let target = fresh.path
    if (!target || saveAs) {
      const suggested = fresh.path ? fresh.path : fresh.name
      const result = await window.api.fs.saveDialog({
        title: 'Save file',
        defaultPath: suggested,
        filters: [
          { name: 'All Files', extensions: ['*'] },
          { name: 'Markdown', extensions: ['md'] },
          { name: 'HTML', extensions: ['html', 'htm'] },
          { name: 'Text', extensions: ['txt'] },
        ],
      })
      if (result.canceled || !result.filePath) return false
      target = result.filePath
    }

    try {
      const settings = get().settings
      let content = fresh.content
      if (settings.trimTrailingWhitespace) {
        content = content
          .split('\n')
          .map((line) => line.replace(/[ \t]+$/, ''))
          .join('\n')
      }
      await window.api.fs.writeFile(target, content, fresh.encoding, fresh.eol)
      get().updateTab(id, {
        path: target,
        name: target.split(/[\\/]/).pop() ?? target,
        dirty: false,
      })
      get().toast(tr('toast.saved', { name: target.split(/[\\/]/).pop() ?? target }), 'success')
      sfx('save')
      await window.api.recent.add(target)
      const files = await window.api.recent.list()
      set((s) => ({ settings: { ...s.settings, recentFiles: files } }))
      return true
    } catch (err) {
      get().toast(tr('toast.saveFailed', { error: String(err) }), 'error')
      return false
    }
  },

  saveAll: async () => {
    for (const tab of get().tabs) {
      if (tab.dirty) await get().saveTab(tab.id)
    }
  },

  setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

  saveSettings: async () => {
    await window.api.settings.save(get().settings)
  },

  setSidePanel: (panel) => set({ sidePanel: panel, sidebarVisible: true }),
  setBottomTab: (tab) => set({ bottomTab: tab, bottomPanelVisible: true }),
  setBottomPanelVisible: (visible) => set({ bottomPanelVisible: visible }),
  toggleSidebar: () => set((s) => ({ sidebarVisible: !s.sidebarVisible })),
  setPalette: (open) => set({ paletteOpen: open }),
  setPaletteMode: (mode) => set({ paletteMode: mode, paletteOpen: true }),
  setCompareData: (data) => set({ compareData: data }),
  setDialog: (which, open) => {
    if (which === 'settings') set({ settingsOpen: open })
    if (which === 'about') set({ aboutOpen: open })
    if (which === 'compare') set({ compareOpen: open })
    if (which === 'charMap') set({ charMapOpen: open })
    if (which === 'welcome') set({ welcomeOpen: open })
  },
  setDistractionFree: (on) => set({ distractionFree: on }),
  setSplitView: (on) => set({ splitView: on }),
  setZoom: (z) => set({ zoom: z }),

  toast: (message, kind = 'info') => {
    toastSeq += 1
    const id = toastSeq
    set((s) => ({ toasts: [...s.toasts, { id, message, kind }] }))
    if (kind === 'error') sfx('error')
    setTimeout(() => get().dismissToast(id), 3500)
  },

  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  setWorkspaceRoot: (root) => set({ workspaceRoot: root }),

  persistSession: async () => {
    const { tabs, activeTabId, settings } = get()
    if (!settings.restoreSession) return
    // Keep the session file small: very large buffers are not worth persisting
    // and would slow every start-up down.
    const MAX_CONTENT = 512 * 1024
    const state: SessionState = {
      tabs: tabs.map((t) => ({
        ...t,
        content: t.content.length > MAX_CONTENT ? '' : t.content,
      })),
      activeTabId,
    }
    try {
      await window.api.session.save(state)
    } catch {
      /* a failed session write must never break the app */
    }
  },
}))

export { modeForPath }
export type { Tab }
export const selectActiveTab = (s: AppState): Tab | undefined => s.tabs.find((t) => t.id === s.activeTabId)
export { runCommand }
export type { Eol }
