# OpenNotes architecture

OpenNotes is a desktop text editor built with Electron, React and CodeMirror. It edits plain text, source code and Markdown notes in one window, and it talks to language servers, a shell and the file system through a narrow, typed bridge. This document describes how the pieces are arranged, what owns what, and which invariants the code relies on.

The application is split into four runtime processes and a set of child processes. The main process owns everything that touches the operating system; the renderer owns everything that touches the user.

```text
                         ┌──────────────────────────────────────────┐
                         │  main process (Node)                    │
                         │  src/main                               │
                         │    window, native menu, IPC handlers,    │
                         │    logging                              │
                         └───────────────┬──────────────────────────┘
                                         │ ipcMain (invoke / send)
                 ┌───────────────────────┼────────────────────────────┐
                 │                       │                            │
    ┌────────────▼───────────┐  ┌────────▼─────────────┐  ┌──────────▼──────────┐
    │  preload               │  │  renderer (Chromium) │  │  child processes     │
    │  src/preload           │  │  src/renderer        │  │    language servers  │
    │  contextBridge surface │→ │  React + CodeMirror  │  │    piped shell       │
    │  window.api            │  │  Zustand stores      │  │    run process       │
    └────────────────────────┘  └──────────────────────┘  └─────────────────────┘
```

## The four processes

| Process | Job | Where it lives |
| --- | --- | --- |
| Main | Creates the window, builds the native menu, serves every IPC handler, owns the settings/session/recent files, spawns and supervises the child processes, writes the crash log | `src/main/index.ts`, `src/main/menu.ts`, `src/main/ipc/*.ts` |
| Preload | The only code that can see both the renderer and Electron. It exposes `window.api` through `contextBridge` and swallows the "Object has been destroyed" errors that occur while the window is closing | `src/preload/index.ts` |
| Renderer | The user interface: React shell, tabs, panels, CodeMirror editors, the command registry, the Zustand stores, the plugin runtime | `src/renderer/src/**` |
| Child: language server | One process per language group (`gopls`, `clangd`, `typescript-language-server`, …). Started, initialised and killed by the main process | spawned in `src/main/ipc/lsp.ts` |
| Child: terminal shell | A persistent, piped shell (PowerShell, `cmd.exe` or bash) whose output is streamed to the panel | spawned in `src/main/ipc/terminal.ts` |
| Child: run process | The program that runs the active file, plus an optional compile step in front of it | spawned in `src/main/ipc/run.ts` |
| Shared | Types and the translation runtime, used by all three layers | `src/shared/types.ts`, `src/shared/i18n/index.ts` |

The renderer never spawns a process, never touches a file and never calls `ipcRenderer` directly. It asks the main process through `window.api`.

## The process model and the trust boundary

The window is created by the factory in `src/main/window.ts` (`createAppWindow()`), which every
window of the application uses — the main window and the one of the *new window* command — with
these web preferences:

```ts
webPreferences: {
  preload: path.join(__dirname, '../preload/index.js'),
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: false,
  spellcheck: true
}
```

`contextIsolation` keeps the preload and the page in separate JavaScript worlds; `nodeIntegration: false` means the renderer has no `require`, no `fs` and no `child_process`. The preload publishes exactly one global:

```ts
contextBridge.exposeInMainWorld('api', guardAll(api))
```

`guardAll` walks the whole surface and wraps every function. The wrapper catches synchronous throws and rejected promises and ignores the ones that match `/destroyed|Cannot read properties of null/i`, because Electron raises those when an IPC call races with the teardown of the window.

What the renderer may do, through the bridge:

* read and write files, list directories, open the native dialogs (`api.fs.*`);
* load and store the settings, the session and the recent files (`api.settings`, `api.session`, `api.recent`);
* start, stop and query the language servers (`api.lsp.*`);
* start the run process and the terminal shell (`api.run.*`, `api.terminal.*`);
* drive the window (minimise, maximise, close, zoom) (`api.win.*`);
* read and write the clipboard (`api.clipboard`);
* list the installed plugins (`api.plugins.list`);
* receive native menu commands and file-open requests (`api.onCommand`, `api.onOpenFiles`).

What the renderer may not do: start a process of its own, reach the file system without the main process, register an IPC handler, or open a window that is not drawn by the app. Navigation away from the page is blocked: `win.webContents.setWindowOpenHandler` opens the target with `shell.openExternal` and denies the window, and the same handler is installed for every web contents (`web-contents-created`).

The main process treats the renderer as untrusted but not fragile. `uncaughtException`, `unhandledRejection`, `render-process-gone`, `did-fail-load` and `preload-error` are all caught, written to `logs/opennotes.log` in the user-data folder, and the app keeps running (`recordCrash` in `src/main/index.ts`). Only one instance may run: `app.requestSingleInstanceLock()` guards the Chromium profile, and a second launch focuses the running window and opens the files it was given (`src/main/openFiles.ts`).

## The command system

Every user-visible action is a command with a stable id. The contract is in `src/shared/types.ts`:

```ts
export interface Command {
  id: string
  title: string
  category?: string
  shortcut?: string
  /** Hidden from the palette. */
  hidden?: boolean
  run: (payload?: unknown) => void | Promise<void>
}
```

The registry lives in `src/renderer/src/core/commands.ts` and is a plain `Map<string, Command>`:

| Function | Purpose |
| --- | --- |
| `registerCommand` / `registerCommands` | Add a command; a later registration replaces an earlier one with the same id |
| `unregisterCommand` | Remove a command (used when a plugin is deactivated) |
| `getCommands` / `getCommand` | Read the registry; the palette subscribes with `onCommandsChanged` |
| `runCommand(id, payload?)` | Run a command by id |
| `getShortcutMap()` | The default bindings: the `shortcut` of every command |
| `getRecentCommands()` | The commands that were used last; the palette shows them first |
| `setMenuAccelerators()` / `handledByMenu()` | The commands the native menu binds to a key itself; the renderer skips them, so a key is never handled twice |

`runCommand` accepts a payload suffix. `format.setLanguage:python` first looks for a command with that literal id, then splits on `:` and runs `format.setLanguage` with `python` as the payload. The native menu does not use that form — it sends the payload as a second argument (`send('format.setLanguage', id)`) — but the split form is available for command ids that carry a value.

A command is reachable from three places, and all three end in `runCommand`:

| Surface | Path |
| --- | --- |
| Menu | The native menu (`src/main/menu.ts`) sends `webContents.send('menu:command', id, payload)` → `api.onCommand` → `App.tsx` → `runCommand(id, payload)`. The in-app main menu (`src/renderer/src/core/menuStructure.ts`, rendered by `MainMenu.tsx`) lists the same command ids and calls `runCommand` directly; it is filtered by the active workspace profile |
| Command palette | `CommandPalette.tsx` lists `getCommands()`, filters them and calls `runCommand` |
| Keyboard | The `keydown` handler in `App.tsx` matches the user bindings first (`readKeybindingsSync()`); the accelerators of the native menu and the CodeMirror keymap that `CodeEditor.tsx` installs cover the rest |

The built-in commands are declared once, as an array in `src/renderer/src/core/builtinCommands.ts`, and installed by `registerBuiltinCommands()` during the bootstrap effect in `App.tsx`. Commands with `hidden: true` are reachable but do not appear in the palette — the file operations that carry a payload (`file.openPath`, `format.setEncoding`, `format.eol`) use that flag.

Plugins contribute commands to the same registry, so a plugin command is reachable from the palette and from the keyboard in exactly the same way as a built-in one.

## The editor abstraction

Commands must act on the focused document without knowing which editor engine is behind it. The bridge is the `EditorHandle` in `src/renderer/src/core/editors.ts`:

```ts
export interface EditorHandle {
  id: string
  mode: 'code' | 'markdown'
  focus(): void
  getSelection(): EditorSelection
  replaceSelection(text: string): void
  insertText(text: string): void
  getContent(): string
  setContent(text: string): void
  undo(): void
  redo(): void
  selectAll?(): void
  goToLine(line: number): void
  goToOffset(offset: number): void
  stats(): EditorStats
  isDirty(): boolean
  markClean(): void
  focusSearch(query?: string): void
  openSearchPanel(replace?: boolean): void
  findNext(): void
  findPrevious(): void
  destroy(): void
}
```

The CodeMirror component `components/editor/CodeEditor.tsx` implements it for every document;
the `mode` says whether the file was opened as a markdown file (with the preview) or as source
code.

The registry is `handles: Map<string, Set<EditorHandle>>` — a tab id maps to a set, because the split view registers two handles for the same tab. `setActiveEditor` marks the pane that has the focus; `getEditor(id)` prefers the active handle and otherwise returns the first handle of the tab.

The split view is built on a second registry, `src/renderer/src/core/views.ts`, which keeps the raw CodeMirror views: `views: Map<string, EditorView>` and `groups: Map<string, Set<EditorView>>`. `joinGroup(group, view)` and `peersOf(group, self)` connect the panes of one document. In `CodeEditor.tsx` the update listener copies the whole editor state into the peers when the document changes, guarded by a module-level `forwarding` flag so the two panes cannot bounce the state back and forth.

`views.ts` is CodeMirror-specific. Commands that need more than the handle contract (duplicate line, move line, match bracket) check `getView(activeTabId)` first and fall back to the `EditorHandle`.

The renderer chooses the mode from the path: `modeForPath` in `src/renderer/src/store/app.ts` maps the extension to a language id and a mode. Markdown opens in `markdown` mode, everything else in `code` mode.

## State

Three stores hold the application state; the feature-specific stores live next to their feature.

| Store | File | Owns |
| --- | --- | --- |
| `useAppStore` | `src/renderer/src/store/app.ts` | The tabs and the active tab, the settings, the layout flags (sidebar, side panel, bottom panel, split view, distraction free, zoom), the dialog flags, the toasts, the compare data, and the file watchers |
| `useStatusStore` | `src/renderer/src/store/status.ts` | What the status bar shows: cursor line and column, selection size, line and word counts, mode, language, encoding, line ending, dirty flag, zoom, maximised flag |
| `useUiStore` | `src/renderer/src/store/ui.ts` | The modal prompts: `ask` and `askConfirm` return promises that are resolved by `PromptHost.tsx` |

The feature stores are `useLspStore` (`core/lspState.ts`), `useProjectSearchStore` (`core/projectSearch.ts`), `useTerminalStore` (`core/terminalState.ts`), `useRunStore` (`core/runState.ts`) and `useReferenceStore` (`core/lspCommands.ts`).

`useAppStore` is the only store that writes to disk. It owns the whole file lifecycle: `openPath` reads the file, detects the mode and the language, registers a watcher and adds the path to the recent list; `saveTab` flushes the editor buffer into the store, converts the line endings, writes through `api.fs.writeFile` and clears the dirty flag.

The status store is written from two places: the CodeMirror update listener (cursor, selection and counts) and an effect in `App.tsx` that copies the encoding, the line ending, the language, the mode and the dirty flag of the active tab.

### Why the session is persisted

`restoreSession` is on by default (`src/renderer/src/core/defaults.ts`). `persistSession` writes the tabs and the active tab to `<userData>/session.json` through the `session:save` IPC handler (`src/main/ipc/session.ts`). It runs every 15 seconds, on `beforeunload` and when the app is unmounted (`App.tsx`).

Two limits keep the file small and the start-up fast:

* buffers larger than 512 KB are written without their content (`MAX_CONTENT` in `persistSession`);
* on start-up, a tab whose file no longer exists is dropped, so a deleted file never opens as an empty, broken editor.

Without the session, closing the app would lose the set of open files, the active tab and the cursor position — the behaviour of a text editor is expected to survive a restart.

## The file system layer

The renderer talks to the file system through `api.fs`, which maps one-to-one onto the handlers in `src/main/ipc/fs.ts`.

| Call | Behaviour |
| --- | --- |
| `readFile(path)` | Returns `{ content, encoding, eol, binary, kind, size, truncated }` |
| `writeFile(path, content, encoding, eol)` | Creates the folder, applies the line ending, writes the bytes with the BOM of the encoding |
| `readTextFile` / `writeTextFile` | Plain UTF-8, used for the settings and the keybindings |
| `readDir` / `listRecursive` | Directory listings; `listRecursive` skips the ignored folders and the dot-directories and stops at a depth of 12 |
| `watch(path, cb)` | Returns the unwatch function; the main process sends `fs:changed` |

**Encodings.** The byte order mark decides the encoding: `EF BB BF` is UTF-8, `FF FE` is UTF-16 LE, `FE FF` is UTF-16 BE; a file without a mark is read as UTF-8. Everything else is decoded with `iconv-lite`, which covers the twenty-one encodings the Encoding menu offers (the Windows code pages, the Japanese and Chinese ones, the ISO ones). A file is treated as binary when it contains a NUL byte in the first 8000 bytes — UTF-16 files are exempt because they are full of NUL bytes.

**Line endings.** The editor only ever sees `\n`. `normalizeEol` rewrites the decoded text, `detectEol` records which ending dominates the file, and `applyEol` converts it back on save. The encoding and the ending are per tab and are shown in the status bar.

**Large files.** Two thresholds apply:

| Limit | Effect |
| --- | --- |
| 24 MB (`MAX_EDIT_BYTES` in `fs.ts`) | The main process reads only the first 24 MB and sets `truncated` |
| 4 MB (in `openPath`) | The tab is marked `largeFile`, made read-only, the syntax highlighting is switched off and the content is no longer copied into the store on every keystroke |

**Watchers.** `fs:watch` uses `fs.watch` per open file and pushes a `fs:changed` event. The renderer debounces the event by 250 ms, re-reads the file and compares the content: if the buffer is clean the tab is updated and a toast reports the reload, if it is dirty a toast reports that the file changed on disk and the buffer is kept.

## The document formats

Document formats are handled by `detectKind` in `fs.ts`: `.md`/`.markdown` for Markdown,
`.html`/`.htm` for HTML, `.csv`/`.tsv` for CSV/TSV, and everything else is treated as source
(`.txt`, `.ts`, `.py`, etc.). The Markdown preview (`MarkdownPreview.tsx`) renders `.md` files
with `marked` + DOMPurify; `onOpenLink` resolves relative links against the file's folder. No
conversion layer exists for `docx`/`rtf`/`odt` — those files open as text and the binary
content is shown as raw source.

## The language servers

The main process owns the servers (`src/main/ipc/lsp.ts`); the renderer only sends documents and collects the answers.

**One process per language group.** The table `LANGUAGE_SERVERS` maps a language to a command and its arguments. `SHARED_SERVERS` puts several languages on one process: JavaScript, JSX and TSX share the TypeScript server, C++ and Objective-C share `clangd`.

**The protocol is written by hand.** The framing is the one of the LSP specification:

```text
Content-Length: <n>\r\n\r\n<json>
```

`parseContentLength` reads the header, `onData` cuts the messages out of the stream buffer and `handleMessage` sorts them into a notification, a request from the server or an answer to a request. The requests of the client are tracked in a `Map` of pending requests with a timeout.

**The state machine.** A server is `starting`, `ready`, `error` or `stopped` (`LspServerState`). `setState` notifies the renderer through the `lsp:status` event for every language the process serves. The transition to `ready` happens after the `initialize` request (20 seconds to answer) and the `initialized` notification; the `textDocumentSync` capability of the answer decides whether the documents are synchronised at all (0), fully (1) or incrementally (2). `computeChange` computes the changed range when the server asked for incremental updates.

**The diagnostics.** `textDocument/publishDiagnostics` is converted by `toProblem` into the shape the problems panel expects: a 1-based line and column, the character offsets (`from`, `to`), the severity, the message and the source. The offsets are computed against the text the main process keeps for every open document, which is why the host bridge exposes `getText` and `getLanguage`.

**The renderer side.** `src/renderer/src/core/lspState.ts` holds the problems per document uri and the status per language, and it subscribes to the two events of the main process. `src/renderer/src/core/lspIntegration.ts` keeps the servers in sync with the open files: a document is sent when it is opened, a change is sent 600 ms after the last keystroke, and the previous document is taken away from its server when the tab changes. Files larger than 1 MB (`MAX_LSP_BYTES`) are never sent.

**The commands.** `src/renderer/src/core/lspCommands.ts` implements `editor.goToDefinition` (F12) and `editor.findReferences` (Shift+F12). A definition in the current file moves the cursor; a definition in another file opens that file and jumps into it. The references are shown as problems in the bottom panel, where clicking one jumps to the place.

**The configuration.** The command of every server can be replaced in the settings (`lspServers`) and in the project file (`.opennotes.json`, key `lsp`). `resolveServers` in `core/projectConfig.ts` merges the two, the project file wins, and `useLspConfiguration` sends the result to the main process with `lsp:configure`. A server whose command or arguments changed is stopped and started again with the new command.

**Finding the program.** `resolveCommand` looks in the `PATH` first (with the Windows extensions `.exe`, `.cmd`, `.bat`, `.com`) and then in the `node_modules/.bin` of the folder and its parents. The empty alias files of the Microsoft Store are skipped, and a `.cmd`/`.bat` shim is started through `cmd.exe` because Windows cannot run it directly. A server that is not installed produces a status event with an install hint, not a crash.

## The search

The project-wide search runs in the main process (`src/main/ipc/search.ts`) so that the renderer stays responsive. The state of the panel is in `src/renderer/src/core/projectSearch.ts`.

The request carries the folder, the query and four options: regular expression, case sensitive, whole word and a file filter (`*.ts`). The matcher is a `RegExp`; a query that is not a regular expression is escaped, the whole-word option wraps it in `\b(?:…)\b`, and an expression that does not compile is searched as plain text.

What the walk skips:

| Rule | Value |
| --- | --- |
| Directories | A fixed list of 38 build and version-control folders (`node_modules`, `target`, `dist`, `.git`, `__pycache__`, `site-packages`, …) |
| Hidden entries | Every name that starts with a dot, except `.github` |
| File size | Files above 4 MB |
| Number of files | 20 000 |
| Number of results | 2 000 |
| Matches per file | 200 |
| Binary files | Counted as skipped, never searched |

The files are read by eight workers at the same time, because a project is a lot of small files and reading them one by one would take minutes.

The replace writes every file back with `encodeText(next, decoded.encoding)`, so a UTF-16 file stays UTF-16.

## The terminal and the run panel

### The terminal

The integrated terminal is a *piped* shell, not a pty. `src/main/ipc/terminal.ts` documents the consequences, and they are visible in the code:

* **No size.** `terminal:resize` is a no-op (`ipcMain.handle('terminal:resize', () => true)`), so the shell does not know how big the window is and the full-screen programs (`vim`, `less`, `top`) cannot work.
* **No real Ctrl+C.** A byte `0x03` cannot travel over a pipe — the shell would read it as the start of a command. The interrupt therefore writes the byte inside a comment (so the shell ignores it) and kills the process tree of the shell. The command dies, the shell stays alive and prints its prompt again.
* **The escape sequences are removed.** `cleanText` strips the ANSI sequences and the control characters, so the panel shows plain text only.
* **stdin belongs to the program.** A command that reads from stdin (`cat` without a file) takes the input away from the user.

The shell is chosen by the platform: PowerShell (`-NoLogo -NoProfile -NonInteractive -Command -`) on Windows, `cmd.exe` as the fallback, `bash` (or `/bin/sh`) elsewhere. The command is followed by a marker (`__OPENNOTES_DONE_<pid>_<n>__`) that the shell prints when it is done; the marker line is removed from the output and an empty stdout line tells the renderer that the shell is ready again. The panel keeps the last 2000 lines and the last 100 commands of the history.

### The run panel

`src/main/ipc/run.ts` starts a program for the active file. The runner table maps a language id to a plan; the plan holds the command, an optional preparation step and the files that have to be deleted afterwards.

| Language | How it runs |
| --- | --- |
| JavaScript, JSX | `node <file>` |
| TypeScript, TSX | The `tsx` of the local `node_modules/.bin`, otherwise `tsx` from the `PATH`, otherwise `npx --no-install tsx` with `npm_config_offline` set, so nothing is ever downloaded |
| Python | `python`, `py -3` or `python3`, whichever exists |
| Go | `go run <file>` |
| Rust | `cargo run` in the nearest crate (`Cargo.toml`) |
| C, C++ | Compiled with `gcc`/`clang` into a temporary binary in the system temporary folder, then executed; the binary is deleted when the run ends |
| C# | `dotnet run --project <nearest .csproj>` |
| Java | `java <file>`; the version is checked first, because a single file needs Java 11 |
| PHP, Ruby, Lua, Batch, PowerShell, Shell | The matching interpreter |

The interpreter of the toolchain settings wins over the one on the `PATH`; a configured folder is accepted as well, and its `bin` subfolder is used (`toolPath`). A missing interpreter produces a sentence ("Python was not found on this machine. Install Python and try again."), not a stack trace. Only one run is active at a time — starting a new one stops the previous.

## The plugin system

A plugin is a folder in `<userData>/plugins/<id>/` with a `plugin.js` and an optional `plugin.json`. The main process discovers them and returns the source (`src/main/ipc/plugins.ts`); the manifest fields fall back to the folder name and the version `0.0.0`.

The renderer evaluates the source with `new Function('module', 'exports', 'require', 'window', 'console', source)` (`src/renderer/src/core/plugins.ts`). `require` is replaced by a function that throws, so a plugin cannot pull in a module. The evaluation result is the module, either as `module.exports` or as its `default` export.

A plugin module may export:

```ts
interface PluginModule {
  id?: string
  name?: string
  version?: string
  description?: string
  commands?: Command[]
  activate?: (ctx: PluginContext) => void
  deactivate?: () => void
}
```

The context the plugin receives during activation:

| Member | What it gives the plugin |
| --- | --- |
| `api` | The whole `window.api` surface |
| `commands.register` / `unregister` / `list` / `run` | The command registry of the application |
| `editor` | `getEditor(id)`, the handle of a tab |
| `toast(message, kind)` | A notification in the corner of the window |

The commands a plugin declares are registered when the plugin is activated, and their ids are remembered so that they can be removed again when the plugin is deactivated. The plugins listed in `settings.plugins` are activated once the store is ready (`activateEnabledPlugins` in `App.tsx`). A plugin that throws during the evaluation or the activation is reported in the console and does not stop the application.

## The internationalisation

The translation runtime lives in `src/shared/i18n/index.ts` and has no framework or Electron dependency, so the main process can use it as well as the renderer.

* **The catalogue.** `src/shared/i18n/en.ts` is the source of truth. The other locales are JSON files in `src/shared/i18n/locales/`. A catalogue is typed as `Partial<Record<MessageKey, string>>`, so a key that does not exist in the English catalogue is a type error.
* **The fallbacks.** `translate(locale, key, params)` returns `catalogue[key] ?? en[key] ?? key`: the English text when the translation is missing, the raw key when even the English text is missing. `translateWith(locale, key, fallback, params)` is used where the English text is known already, for example in the command palette.
* **The placeholders** are written as `{{name}}` and replaced by `interpolate`.
* **The languages.** `en`, `de`, `es`, `ru`, `zh-CN`. `LOCALES` carries the English name, the native name, the direction (`ltr`) and the BCP 47 tag of each one.
* **The direction.** `applyDocumentLocale` sets `lang` and `dir` on the document element. All shipped languages are left-to-right (`ltr`).
* **The native menu.** The menu is built in the main process (`src/main/menu.ts`) and its labels come from the same runtime. `buildMenu(profile, language)` is called at start-up, `updateMenuLocale(language)` rebuilds it when the settings change, and `menu:locale` lets the renderer ask for it directly. The profile (`coding` / `editing` / `all`) decides which menu sections and panel entries are shown.
* **The accelerators.** A command that the user has bound to another key loses the accelerator of the native menu (`accelerator()` in `src/main/menu.ts`), so the shortcut of the user really wins. The list of the commands the menu still binds is sent to the renderer, which skips them: a key is handled exactly once.
* **The settings.** **Settings → General** offers the languages with their native names and shows how much of each one is translated (`translationProgress`).
* **The toolkit.** `scripts/i18n.mjs` writes a template for a new language (`template`), checks the existing ones (`check` — unknown keys, empty values and missing placeholders are reported), prints the coverage (`coverage`), lists the missing keys of a language (`missing`) and merges a translation into a language file (`fill`).

## The performance rules

**The heavy panels are loaded on demand.** `App.tsx` lazy-loads the compare view, the character map, the problems panel, the run panel and the terminal panel. `EditorPane.tsx` lazy-loads the Markdown preview and the minimap.

**The thresholds.**

| Threshold | Where | Effect |
| --- | --- | --- |
| 24 MB | `MAX_EDIT_BYTES` in `fs.ts` | Only the prefix is read; the tab reports `truncated` |
| 4 MB | `openPath` in `store/app.ts` | The tab is read-only, the highlighting is off, the content is not copied into the store on every keystroke |
| 2 MB | `CodeEditor.tsx` | The content is not written back into the store while typing |
| 1.5 M characters | `MAX_DIAGNOSTIC_CHARS` in `diagnostics.ts` | The syntax tree is not built; the cheap checks still run |
| 1 MB | `MAX_LSP_BYTES` in `lspIntegration.ts` | The document is not sent to a language server |

**The problems are collected once.** `useProblems` caches the last check under a key built from the tab, the language and the length of the content, and publishes the result to the bottom panel, the sidebar and the status bar through one listener set. The check runs 350 ms after the last change.

**Low memory mode** (`settings.lowMemory`) removes the minimap; the check is in `EditorPane.tsx`.

**Software rendering** (`settings.softwareRendering`) calls `app.disableHardwareAcceleration()` before the app becomes ready. The flag has to be read from `<userData>/settings.json` directly, because the renderer does not exist yet at that point (`applyRendererPreferences` in `src/main/index.ts`). The rendering then happens on the CPU, which saves roughly 100 MB of memory at the price of slower scrolling.

## The build

**electron-vite** (`electron.vite.config.ts`) builds three bundles:

| Bundle | Input | Output | Notes |
| --- | --- | --- | --- |
| Main | `src/main/index.ts` | `out/main/index.js` | `externalizeDepsPlugin` keeps `iconv-lite` / `safer-buffer` external |
| Preload | `src/preload/index.ts` | `out/preload/index.js` | Same |
| Renderer | `src/renderer/index.html` | `out/renderer/` | `root` is `src/renderer`; the aliases `@` → `src/renderer/src` and `@shared` → `src/shared` |

A small Vite plugin strips the `crossorigin` attribute from the generated HTML, because a module script loaded from `file://` fails the CORS check with it.

**The type check** is split in two: `tsconfig.node.json` covers the main process, the preload and the shared code, `tsconfig.web.json` covers the renderer, the shared code and the declaration of the preload surface. `npm run typecheck` runs both.

**electron-builder** (`package.json`) produces the installer: `appId` `dev.opennotes.app`, `asar` packing, maximum compression, only the `en-US` Electron locale, an NSIS installer on Windows, a DMG on macOS, an AppImage and a deb package on Linux. The `files` list is reduced to `out/**/*`, `package.json`, `node_modules/iconv-lite/**/*`, and `node_modules/safer-buffer/**/*`.

**The native launcher** (`launcher/main.cpp`, `CMakeLists.txt`) is a small C++17 program that finds the Electron runtime and the application folder next to itself, starts the app and forwards the arguments, so a double click on a file opens it in the editor. The CMake targets are `opennotes-launcher`, `opennotes-bundle` (which runs `npm run build`) and `opennotes-run`. `scripts/launch.mjs` uses the compiled launcher when it exists and falls back to the Electron runtime.

**The test harnesses** drive the real application:

| Script | What it does |
| --- | --- |
| `scripts/run-app-tests.mjs` | Boots the real Electron app with `OPENNOTES_EVAL_FILE`, `OPENNOTES_USERDATA` and `OPENNOTES_TEST_CLICK`, runs the harness in the renderer and reads the JSON report; a round that dies without a report is a crash |
| `scripts/app-test-harness.js` | Exercises the feature surface: editors, panels, dialogs, menus, terminal, large files, keybindings, search (test fixtures: `.test-workspace`, `.lang-workspace`) |
| `scripts/stress-harness.js` | Large files, many tabs, odd content (`.stress`) |
| `scripts/i18n.mjs` | The translation toolkit |

The renderer exposes a small scripting surface at `window.opennotes` (`store`, `run`, `setState`, `commands`, `problems`, `editor`); it is what the harnesses use.

## Where to put new code

| Kind of change | File |
| --- | --- |
| A new user action | An entry in the array `builtinCommands` in `src/renderer/src/core/builtinCommands.ts` |
| A new native menu entry | The template in `src/main/menu.ts` (send the command id) and, if it belongs to the in-app menu, `src/renderer/src/core/menuStructure.ts` |
| A new entry in the in-app main menu | `src/renderer/src/core/menuStructure.ts` |
| A new file operation | A handler in `src/main/ipc/fs.ts` and the matching method in the `fs` object in `src/preload/index.ts` |
| A new document format | A converter in `src/main/docs/`, a case in `detectDocFormat` and `readDocument`/`writeDocument` in `src/main/docs/index.ts`, and a case in the `DocFormat` type in `src/shared/types.ts` |
| A new IPC capability | A handler in the matching `src/main/ipc/*.ts`, the method in `src/preload/index.ts` and the type in `src/shared/types.ts` |
| A new language server | The table `LANGUAGE_SERVERS` in `src/main/ipc/lsp.ts` and the list `LSP_LANGUAGES` in `src/renderer/src/core/lspState.ts` |
| A new editor command that needs the CodeMirror API | `src/renderer/src/core/builtinCommands.ts`; use `getView(activeTabId)` when the handle contract is not enough |
| A new pure text operation | `src/renderer/src/core/transforms.ts` (no DOM, no CodeMirror, no file system) |
| A new syntax rule or theme | `src/renderer/src/core/languageModes.ts`, `syntaxThemes.ts` or `themePack.ts` |
| A new panel | `src/renderer/src/components/panels/`, registered in `src/renderer/src/components/Sidebar.tsx` and in the `SidePanel` type of `src/renderer/src/store/app.ts` |
| A new string in the interface | `src/shared/i18n/en.ts`, then `node scripts/i18n.mjs template <locale>` for the other languages |
| A new setting | The `Settings` interface in `src/shared/types.ts`, a default in `src/renderer/src/core/defaults.ts`, the control in `src/renderer/src/components/SettingsDialog.tsx` and the effect that reads it |
| A new persistent file | A handler in `src/main/ipc/` that writes into `app.getPath('userData')` |
| A new plugin capability | The `PluginContext` in `src/renderer/src/core/plugins.ts` and the bridge in `src/preload/index.ts` |

The contracts between the layers are written down in `src/shared/contracts.md`. The decisions that shape the code are recorded in `docs/adr/`.
