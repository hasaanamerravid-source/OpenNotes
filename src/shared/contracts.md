# OpenNotes — internal contracts

Everything in this document is binding for parallel workstreams. If you need to change an
interface, update the file that owns it and keep the change backwards compatible.

The document is checked against the code: the preload bridge is the only place that
talks to the main process, and the renderer never imports a node-only library.

## Process layout

```
src/main      Electron main process (node). Owns the file system and the native menus.
src/preload   contextBridge surface exposed to the renderer as `window.api`.
src/renderer  React app (browser). Owns the editor UI, tabs and plugins.
src/shared    Types and the translation catalogue shared by all layers.
```

The renderer runs with `contextIsolation: true` and `nodeIntegration: false`. It has no
access to Node.js; everything it needs is on `window.api`.

## Preload API — `window.api`

All calls are promise based except the event subscriptions and the fire-and-forget
window commands.

```ts
interface OpenNotesApi {
  info(): Promise<AppInfo>

  fs: {
    openDialog(opts: OpenDialogOptions): Promise<DialogResult>
    saveDialog(opts: SaveDialogOptions): Promise<DialogResult>
    readFile(path: string): Promise<FilePayload>
    writeFile(path: string, content: string, encoding: string, eol: Eol): Promise<void>
    readDir(path: string): Promise<DirEntry[]>
    listRecursive(root: string, maxDepth?: number): Promise<DirEntry[]>
    stat(path: string): Promise<DirEntry | null>
    exists(path: string): Promise<boolean>
    makeDir(path: string): Promise<void>
    remove(path: string): Promise<void>
    rename(from: string, to: string): Promise<void>
    copyFile(from: string, to: string): Promise<void>
    showInFolder(path: string): Promise<void>
    readTextFile(path: string): Promise<string>
    writeTextFile(path: string, text: string): Promise<void>
    /** The project wide search and the replace in every file. */
    search(request: SearchRequest): Promise<SearchResponse>
    replaceInFiles(request: ReplaceRequest): Promise<ReplaceResponse>
    watch(path: string, cb: (changed: boolean) => void): Promise<() => void>
  }

  recent: {
    list(): Promise<string[]>
    add(path: string): Promise<string[]>
    clear(): Promise<void>
  }

  session: {
    load(): Promise<SessionState | null>
    save(state: SessionState): Promise<void>
  }

  settings: {
    load(): Promise<Partial<Settings> | null>
    save(settings: Settings): Promise<void>
  }

  plugins: {
    list(): Promise<PluginManifest[]>
  }

  clipboard: {
    readText(): Promise<string>
    writeText(text: string): Promise<boolean>
  }

  shell: {
    openTerminal(cwd?: string): Promise<boolean>
    run(filePath: string): Promise<string | null>
  }

  menu: {
    setRecent(paths: string[]): Promise<boolean>
    setProfile(profile: string): Promise<boolean>
    /** Write the native menu in another language. */
    setLocale(locale: string): Promise<boolean>
  }

  run: {
    start(filePath: string, language: string, toolchain?: Record<string, string>): Promise<boolean>
    stop(): Promise<boolean>
    onOutput(cb: (event: RunEvent) => void): () => void
  }

  terminal: {
    start(cwd?: string): Promise<unknown>
    write(text: string): Promise<unknown>
    interrupt(): Promise<unknown>
    stop(): Promise<unknown>
    /** The terminal is a pipe: the size of the window cannot be changed. */
    resize(cols: number, rows: number): Promise<unknown>
    onOutput(cb: (event: unknown) => void): () => void
  }

  lsp: {
    start(languages: string[]): Promise<unknown>
    didOpen(params: { language: string; uri: string; text: string }): Promise<unknown>
    didChange(params: { language: string; uri: string; text: string }): Promise<unknown>
    didClose(params: { language: string; uri: string }): Promise<unknown>
    request(params: { language: string; method: string; params?: unknown }): Promise<unknown>
    stop(language?: string): Promise<unknown>
    configure(config: { servers?: Record<string, { command: string; args?: string[] }>; rootPath?: string | null }): Promise<unknown>
    onDiagnostics(cb: (event: unknown) => void): () => void
    onStatus(cb: (event: unknown) => void): () => void
  }

  win: {
    newWindow(): Promise<boolean>
    setMenuBar(visible: boolean): Promise<boolean>
    minimize(): void
    toggleMaximize(): void
    close(): void
    isMaximized(): Promise<boolean>
    zoom(delta: number): void
    getZoom(): Promise<number>
    setZoom(factor: number): Promise<boolean>
    setTitle(title: string): void
    /** The colour of the window while the interface is drawn. */
    setTheme(color: string): void
    onMaximizeChange(cb: (maximized: boolean) => void): () => void
  }

  /** Report a renderer failure to the log of the main process. */
  reportError(message: string): void
  /** The real path of a file that was dropped onto the window. */
  pathForFile(file: File): string

  /** Native menu / tray commands are forwarded to the renderer. */
  onCommand(cb: (id: string, payload?: unknown) => void): () => void
  /** External files that were opened with the application. */
  onOpenFiles(cb: (paths: string[]) => void): () => void
}
```

A call that happens while the window is being closed is swallowed by the bridge instead of
throwing *Object has been destroyed* into the renderer.

## Renderer command system

Every user-visible action is a **command** with a stable `id` (`file.save`,
`format.sortAsc`, …). The command registry lives in `src/renderer/src/core/commands.ts`:

```ts
registerCommand({ id, title, category, shortcut, run })
unregisterCommand(id: string)
runCommand(id, payload?)
getCommands(): Command[]
```

The native menu, the command palette and the keyboard map all dispatch by id, so a new
feature only needs one registration to be reachable from every surface.

The titles of the commands are translated: every command has a message of the shape
`cmd.<command id>` in the catalogue of `src/shared/i18n/en.ts`.

## Editor registry

`src/renderer/src/core/editors.ts` keeps a live handle per open tab so that commands can
act on the focused editor without prop drilling:

```ts
interface EditorHandle {
  id: string
  mode: 'code' | 'markdown'
  focus(): void
  getSelection(): { from: number; to: number; text: string }
  replaceSelection(text: string): void
  insertText(text: string): void
  getContent(): string
  setContent(text: string): void
  undo(): void
  redo(): void
  selectAll?(): void
  goToLine(line: number): void
  goToOffset(offset: number): void
  stats(): { lines: number; cols: number; selection: number; words: number; chars: number }
  isDirty(): boolean
  markClean(): void
  focusSearch(query?: string): void
  openSearchPanel(replace?: boolean): void
  findNext(): void
  findPrevious(): void
  destroy(): void
}
getEditor(id: string): EditorHandle | undefined
getAllEditors(): EditorHandle[]
```

## Plugins

`src/renderer/src/core/plugins.ts` exposes a small runtime for user plugins (JS modules in
the `plugins` directory of the user data folder). A plugin exports:

```ts
export default {
  id: 'my-plugin',
  name: 'My Plugin',
  version?: string
  description?: string
  commands?: Command[],
  /** Called when the plugin is enabled. */
  activate(ctx: PluginContext): void
  deactivate?(): void
}

interface PluginContext {
  api: typeof window.api
  commands: {
    register(command: Command): void
    unregister(id: string): void
    list(): Command[]
    run(id: string, payload?: unknown): Promise<void>
  }
  editor: typeof getEditor
  toast(message: string, kind?: 'info' | 'error' | 'success'): void
}
```

A plugin runs in the renderer and has the same rights as the interface: it is installed by
the user, from a folder the user put there.

## Translation

`src/shared/i18n/` holds the message catalogue and the runtime:

- `en.ts` is the source of truth: every user-visible string has a key there.
- `locales/<language>.json` holds the translations. A key that is missing falls back to
  English, a key that does not exist in `en.ts` is an error.
- `index.ts` is the runtime: `translate`, `interpolate`, `formatDate`, `formatNumber` and
  the list of the languages. It has no framework dependency, so the main process uses it
  for the native menu.

The renderer adds `src/renderer/src/core/i18n.ts` with the `useT()` hook, the language
switch (`setLocale`) and the plumbing that sets `lang` and `dir` on the document.
`npm run i18n:check` proves that every language file matches the English catalogue.
