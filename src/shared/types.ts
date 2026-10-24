/**
 * Shared type contracts for OpenNotes.
 * Used by main process, preload bridge and renderer.
 */

/** How a document is edited. */
export type EditorMode = 'code' | 'markdown'

/** Line ending style of a text file. */
export type Eol = '\n' | '\r\n' | '\r'

/** A single editor tab. */
export interface Tab {
  id: string
  /** Absolute path on disk, null for untitled buffers. */
  path: string | null
  /** Display name (file name or "Untitled"). */
  name: string
  mode: EditorMode
  /** Plain text content (code/markdown modes). */
  content: string
  /** Unsaved changes present. */
  dirty: boolean
  /** Character encoding of the backing file. */
  encoding: string
  eol: Eol
  /** Language id used for syntax highlighting. */
  language: string
  readonly: boolean
  /** Markdown view mode. */
  view: 'source' | 'preview' | 'split'
  /** Restored cursor position. */
  cursor?: number
  scroll?: number
  /** Size of the file on disk in bytes. */
  size?: number
  /** The file is too big to edit: it is shown read-only, without highlighting. */
  largeFile?: boolean
  /** Number of bytes that are not shown (the file was truncated). */
  truncatedBytes?: number
}

/** Result of reading a text file. */
export interface FilePayload {
  path: string
  content: string
  encoding: string
  eol: Eol
  binary: boolean
  /** Detected mime-ish type: 'text' | 'html' | 'markdown' | 'csv' */
  kind: FileKind
  /** Size of the file on disk in bytes. */
  size: number
  /** True when the file was larger than the editor can hold: the content is a prefix. */
  truncated: boolean
}

export type FileKind = 'text' | 'html' | 'markdown' | 'csv' | 'binary'

/** Directory listing entry. */
export interface DirEntry {
  name: string
  path: string
  isDir: boolean
  size: number
  mtime: number
}

/** Options for the native open dialog. */
export interface OpenDialogOptions {
  title?: string
  defaultPath?: string
  filters?: { name: string; extensions: string[] }[]
  multiSelections?: boolean
  /** Pick a folder instead of a file. */
  directory?: boolean
}

/** Options for the native save dialog. */
export interface SaveDialogOptions {
  title?: string
  defaultPath?: string
  filters?: { name: string; extensions: string[] }[]
}

/** Result of a dialog. */
export interface DialogResult {
  canceled: boolean
  filePaths: string[]
  filePath: string | null
}

/** Persisted application session. */
export interface SessionState {
  tabs: Tab[]
  activeTabId: string | null
  windowBounds?: { x?: number; y?: number; width: number; height: number }
}

/** Which feature profile the editor shows. */
export type Profile = 'editing' | 'coding' | 'all'

/** How the application menu is presented. */
export type MainMenuStyle = 'hamburger' | 'native' | 'both'

/** Syntax colour theme of the code editor. */
export type SyntaxTheme = 'darcula' | 'intellij-light' | 'rainbow' | 'monokai' | 'solarized' | 'midnight'

/** Look and feel options, all live-editable. */
export interface Appearance {
  /** Corner radius of buttons, panels, dialogs and tabs (0 - 18 px). */
  cornerRadius: number
  /** Frosted glass effect for the top bar. */
  glassTopBar: boolean
  /** Blur radius of the glass effect (0 - 30 px). */
  glassBlur: number
  /** Background transparency of the glass effect (0 - 1). */
  glassOpacity: number
  /** Gradient behind the top bar. */
  gradient: boolean
  gradientFrom: string
  gradientTo: string
  /** Accent colour used for highlights and focus. */
  accentColor: string
  /** Component density. */
  density: 'compact' | 'cozy' | 'comfortable'
  /** Rounded tab shape. */
  tabStyle: 'rounded' | 'underline' | 'pill'
  /** Show the round window buttons / toolbar icons. */
  showToolbarIcons: boolean
  /** Draw a soft shadow below panels and dialogs. */
  softShadows: boolean
  /** Animate the transitions. */
  animations: boolean
}

/** How the editor surface is painted. */
export type EditorBackground = 'app' | 'theme'

/** User settings (persisted as JSON). */
export interface Settings {
  theme: 'light' | 'dark' | 'system'
  /** Language of the user interface (see shared/i18n). */
  language: string
  /** Paint the editor surface with the app colours instead of the theme's own. */
  editorBackground: EditorBackground
  /** File icon theme id. */
  iconTheme: string
  /** Interpreter / SDK paths, keyed by language (java, node, python, go, dotnet, rust, …). */
  toolchain: Record<string, string>
  /** Language server commands, keyed by language. */
  lspServers: Record<string, { command: string; args?: string[] }>
  /** The folder that holds the project configuration (`.opennotes.json`). */
  projectFolder: string | null
  /** Sound theme id. */
  soundTheme: string
  /** 0 = mute, 1 = full. */
  soundVolume: number
  soundsEnabled: boolean
  /** Trade features for a smaller memory footprint (low end machines). */
  lowMemory: boolean
  /** Render without the GPU — saves ~100 MB of RAM, slower scrolling. */
  softwareRendering: boolean
  /** Which feature profile is active: plain editing, coding, or everything. */
  profile: Profile
  /** How the application menu is shown. */
  mainMenuStyle: MainMenuStyle
  /** Colour theme of the code editor (see core/themePack.ts). */
  syntaxTheme: string
  appearance: Appearance
  fontFamily: string
  fontSize: number
  tabSize: number
  insertSpaces: boolean
  lineWrapping: boolean
  showLineNumbers: boolean
  showInvisibles: boolean
  showMinimap: boolean
  showIndentGuides: boolean
  highlightActiveLine: boolean
  matchBrackets: boolean
  autoCloseBrackets: boolean
  autoIndent: boolean
  formatOnSave: boolean
  trimTrailingWhitespace: boolean
  defaultEncoding: string
  defaultEol: Eol
  restoreSession: boolean
  autosaveInterval: number
  spellcheck: boolean
  minimapWidth: number
  showStatusBar: boolean
  showSidebar: boolean
  sidebarWidth: number
  recentFiles: string[]
  plugins: string[]
}

/** Command executed from the palette, menu or keyboard map. */
export interface Command {
  id: string
  title: string
  category?: string
  shortcut?: string
  /** Hidden from the palette. */
  hidden?: boolean
  run: (payload?: unknown) => void | Promise<void>
}

/** Information about the running environment. */
export interface AppInfo {
  version: string
  electron: string
  chrome: string
  node: string
  platform: string
  home: string
  temp: string
  /** The folder the settings and the keybindings live in. */
  userData: string
}

/** A user plugin discovered in the plugins directory. */
export interface PluginManifest {
  id: string
  name: string
  version: string
  description: string
  path: string
  source: string
}
