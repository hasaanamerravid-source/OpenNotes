# OpenNotes

An **all-in-one text editor** for the desktop — the union of three tools in one app:

| Inspiration | What OpenNotes brings over |
| --- | --- |
| **Windows Notepad** | Instant start, zero clutter, word wrap, zoom, status bar, go-to-line, encodings, session restore |
| **Notepad++** | Tabbed multi-document editing, 129 syntax highlighting modes, code folding, minimap, markdown preview, find & replace with regex, bookmarks, macros, line tools (duplicate/delete/move/copy), sort/trim/join transforms, character map, compare documents |
| **Modern IDE shell** | Top-left main menu with fly-out sections, a custom window frame (minimise/maximise/close are ours, the native overlay is gone), rounded corners, gradients, a frosted-glass top bar and colour themes for the editor |

The interface speaks **five languages** — English, German, Spanish, Russian and
Simplified Chinese. See [docs/i18n.md](docs/i18n.md).

## Running it

```bash
npm install
npm run dev        # development (hot reload)
npm run build      # production bundles in out/
npm run start      # run the production build
npm run typecheck  # type-check main + renderer
npm run dist       # Windows installer (NSIS) in release/
```

Helper scripts:

```bash
node scripts/make-icon.mjs              # regenerate build/icon.png
npm run test:unit                       # the pure logic (translations, transforms, shortcuts, messages)
npm run test:app                        # drive the real app in a loop (see below)
npm run test:stress                     # large files, many tabs, odd content
npm run i18n:check                      # every language file must match the catalogue
npm run i18n:coverage                   # how much of every language is translated
node scripts/audit-settings.mjs         # which settings have no reader
npm run format                          # format the sources (prettier)
npm run check                           # everything that has to be green
powershell scripts/fetch-electron.ps1   # parallel download of the Electron runtime
```

### Driving the app from a script

The renderer exposes a small surface at `window.opennotes` (`store`, `run`, `setState`,
`commands`) and the main process understands a few environment variables, which is how the
automated suites work:

| Variable | Effect |
| --- | --- |
| `OPENNOTES_EVAL=<js>` | Evaluate an expression in the renderer after start-up and print the result |
| `OPENNOTES_EVAL_FILE=<file>` | Same, but the expression comes from a file |
| `OPENNOTES_USERDATA=<dir>` | Use another user-data folder (keeps test runs isolated) |
| `OPENNOTES_SNAPSHOT=<file.png>` | Save a screenshot of the window and exit |

`scripts/run-app-tests.mjs` boots the app, runs `scripts/app-test-harness.js` inside it and
reports the result; `scripts/stress-harness.js` does the same with large files and many tabs.
A round that dies without a report is a crash.

### Stability

The app is built to survive the usual accidents:

* only one instance may run — a second launch focuses the first instead of fighting over the
  Chromium profile (which used to crash the new process);
* IPC calls made while the window is closing are swallowed instead of throwing
  *"Object has been destroyed"*;
* a React error boundary catches renderer exceptions and shows a readable panel with a
  reload button instead of a white screen;
* very large documents open as plain source with the highlighting switched off instead of
  freezing the editor, the markdown preview is clipped, and the session file only stores
  buffers below 512 KB;
* every crash is written to `logs/opennotes.log` in the user-data folder, together with
  renderer errors and warnings.

## Layout

```
src/main          Electron main process — window, native menu, file system
  ipc/            IPC handlers (fs, session, settings, window, shell, plugins)
src/preload       contextBridge surface (window.api)
src/renderer      React application
  core/           Commands, editor registry, languages, plugins, transforms, macros
  components/     Shell, tabs, sidebar panels, editors, dialogs
  store/          Zustand stores (app state, status bar, dialogs)
src/shared        Types shared by all processes, the message catalogue
tests/            Unit tests of the pure logic
docs/             Architecture and decision records, the guide to the languages
```

## How the pieces fit together

Every user-visible action is a **command** with a stable id (`file.save`, `format.sortAsc`,
`view.toggleTerminal`, …). Commands are registered once in `src/renderer/src/core/builtinCommands.ts`
and are reachable from three places at once:

* the native application menu (the menu sends `menu:command` to the renderer),
* the command palette (`Ctrl+Shift+P`),
* keyboard shortcuts.

Editors register a live handle (`src/renderer/src/core/editors.ts`) so commands can act on the
focused document without knowing whether it is a CodeMirror text editor or a markdown editor.

## The languages of the interface

Every string of the interface comes from a catalogue. The English catalogue
(`src/shared/i18n/en.ts`) is the source of truth; the other languages are plain
JSON files in `src/shared/i18n/locales/`.

| | |
| --- | --- |
| **Five languages** | English, German, Spanish, Russian, Simplified Chinese |
| **The native menu too** | The menu of the operating system is written in the same language and is rebuilt when the language changes |
| **Never broken** | A key that is not translated yet falls back to English |
| **Checked** | `npm run i18n:check` proves that every language file matches the catalogue, that no value is empty and that no placeholder was lost |

The language is chosen in **Settings → General**, and the settings show how much of it is
translated.

## Accessibility

* every dialog is a real modal dialog: the keyboard focus stays inside it, the escape key
  closes it and the focus goes back to the control that opened it;
* the focus is always visible (`:focus-visible`), and the tool windows, the status bar and the
  command palette are named for the screen reader;
* the animations are switched off when the system asks for less movement
  (`prefers-reduced-motion`), or when the setting **Animations** is off.

## Disk size

| What | Size |
| --- | --- |
| The project with `node_modules` | ~510 MB (of which ~320 MB is the Electron runtime) |
| The app itself (`out/`) | ~2.2 MB |
| The renderer JavaScript | ~1.9 MB in total, ~1.7 MB of it loaded at start-up (the five languages are in it) |

`npm run clean` removes the build output, the test leftovers and — unless you pass
`-KeepElectron` — the extracted Electron runtime (~320 MB). The English locale is the only one
that is kept, which saves another 47 MB. `scripts/fetch-electron.ps1` downloads the runtime
again when it is needed.

## Performance on small machines

OpenNotes is an Electron app, so it runs in four processes. The heavy parts are loaded on
demand instead of at start-up:

* the markdown preview is its own chunk and is only fetched when a markdown file is shown;
* the compare view, the character map, the minimap and the tool panels that are not needed
  at start-up are separate chunks.

Two settings help further:

| Setting | Effect |
| --- | --- |
| **Low memory mode** | Drops the minimap and the heavy panels |
| **Software rendering** | Renders without the GPU and saves another ~100 MB (scrolling gets slower) |

Measured on the development machine (Windows 11, an ordinary laptop):

| | |
| --- | --- |
| Time until the window shows something | ~0.8 s (first paint) |
| RAM of the four processes, idle | ~330 MB |
| The JavaScript heap of the renderer | ~14 MB |
| The problems are checked | once per document, not once per place that shows them |

The number of processes is the one of Electron (browser, renderer, GPU, utility); the GPU
process disappears with the software rendering. Nothing is sent anywhere: there is no telemetry,
no update check and no account.

The installer is kept small as well: only the `en-US` locale is shipped, the app is packed
into an asar archive and the installer is compressed to the maximum.

## The launcher

OpenNotes ships with a small native launcher so the app can be started with a double click
(or from a file manager) instead of going through npm:

The launcher starts the **packaged** application (`release/win-unpacked/OpenNotes.exe`) when it
is there, and the development runtime otherwise. That has two consequences that matter on
Windows:

* the process is called **OpenNotes** in the task manager, not *Electron*;
* no console window is opened — the Electron runtime is a console program and is started with
  `CREATE_NO_WINDOW`.

The same is true for `npm run launch` and for `OpenNotes.cmd`.

```bash
npm run launch              # start the app right now
npm run launch -- notes.md  # …and open a file with it
```

### The real, installed application

```bash
npm run dist                # build the Windows installer (needs to fetch Electron once)
npm run dist:local          # build it from the Electron runtime that is already here
```

The result is a normal Windows application:

| | |
| --- | --- |
| `release/OpenNotes-1.0.0-Setup.exe` | The NSIS installer (~105 MB) — it installs OpenNotes, adds it to the Start menu and the desktop, and registers the file types |
| `release/win-unpacked/OpenNotes.exe` | The unpacked application, ready to run |

**Where to click:**

| File | What it does |
| --- | --- |
| `OpenNotes.cmd` (Windows) / `OpenNotes.sh` (Linux/macOS) | Double click it — starts the editor |
| `bin/opennotes-launcher.exe` | The native launcher, also on your **desktop** and in the **Start menu** |
| `npm run launch` | The same, from a terminal |

A shortcut is created for you:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/create-shortcut.ps1 `
  -Launcher "$PWD\bin\opennotes-launcher.exe" -Icon "$PWD\build\icon.ico"
```

It puts **OpenNotes** on the desktop and in the Start menu, with the app icon.
`scripts/launch.mjs` uses the compiled launcher when it exists and falls back to the Electron
runtime directly, so it always works.

The native launcher is a small C++ program built with **CMake**:

```bash
npm run launcher:configure   # cmake -S . -B build-launcher
npm run launcher:build       # cmake --build build-launcher --config Release
npm run launcher:install     # copies the launcher and creates a shortcut
```

It finds the Electron runtime and the application folder relative to its own location, starts
the app and forwards every argument (so `opennotes-launcher notes.md src/` opens both). On
Windows the install step also creates a Start-menu and desktop shortcut with the OpenNotes
icon; on Linux a `.desktop` file is installed.

Building it needs CMake and a C++ compiler (MSVC, MinGW or Clang). The Windows resource with
the application icon is only added when a resource compiler (`rc.exe` or `windres.exe`) is
installed — otherwise the launcher is built without an embedded icon.

CMake targets:

| Target | What it does |
| --- | --- |
| `opennotes-launcher` | The native launcher executable |
| `opennotes-bundle` | Builds the Electron bundles (`npm run build`) |
| `opennotes-run` | Builds the launcher and starts OpenNotes with it |

## The window

The app draws its own window frame, the way a native editor does:

```
[☰] [◧] [main.go ×] [broken.js ×] [+]        [actions]  [—][□][✕]
```

* an **activity bar** on the far left opens the tool windows: Project, Search, Structure,
  Problems, Run and Plugins;
* the **file tabs live in the title bar**, so the editor gets the whole window;
* the **minimise / maximise / close** buttons are ours, so nothing of the operating system can
  overlap the toolbar;
* a **bottom panel** holds the **Problems** and the **Run** output, and the status bar shows the
  error and warning count.

## Problems and error detection

The editor checks the open file continuously (a few milliseconds for a 10 000 line file) and
reports:

| Kind | Severity | Example |
| --- | --- | --- |
| Syntax error from the language grammar | error | `Syntax error: unclosed bracket`, `unterminated string literal` |
| Invalid JSON (with the position) | error | `Invalid JSON: Unexpected token '}'` |
| TODO / FIXME / HACK marker in a comment | warning | `Contains a TODO/FIXME marker` |
| Line longer than 120 characters | warning | `Line is longer than 120 characters` |
| Trailing whitespace | info | `Trailing whitespace` |
| Missing newline at the end of the file | info | `No newline at the end of the file` |
| Tabs in an indentation sensitive language | info | `Tab character used for indentation` |

The problems are listed in the bottom panel (filterable, click to jump) and marked with a
squiggly underline in the editor. The status bar shows `0 errors · 1 warning`.

## Running a file

**Run** (the ▶ button in the title bar, or `tools.run`) executes the active file in a real
process and streams the output into the Run panel:

| Language | How it runs |
| --- | --- |
| JavaScript | `node <file>` |
| TypeScript | the local `tsx` (never downloads anything) |
| Python | `python` / `py -3` |
| Go | `go run <file>` |
| Rust | `cargo run` in the nearest crate |
| C / C++ | compiled with `gcc`/`clang++` into a temp binary, then run |
| C# | `dotnet run` for the nearest project |
| Java | `java <file>` (single file mode) |
| PHP, Ruby, Lua, Batch, PowerShell, Shell | the matching interpreter |

If the interpreter is missing you get a plain sentence ("Python was not found on this machine.
Install Python and try again.") instead of a stack trace.

## The terminal

The bottom panel has a **Terminal** tab (`Ctrl+`` ` or `view.toggleTerminal`). It is a real shell
that keeps its state — the folder, the environment variables and the history stay where you left
them:

| | |
| --- | --- |
| **Windows** | `powershell.exe` (or `cmd.exe` when PowerShell is missing) |
| **Linux / macOS** | `bash` (or `sh`) |

Type a command, press Enter, the output appears above the prompt. `ArrowUp` / `ArrowDown` walk
through the history, `Escape` clears the input, `Ctrl+C` stops the command that is running (the
shell stays alive). The escape codes of the programs are removed, so the output is plain text.

It is a *piped* shell and not a full terminal: the programs that draw a full screen (`vim`,
`less`, `top`) do not work in it, and the size of the window cannot be changed.

## The toolchain of a project (SDK, JDK, …)

Every project can bring its own interpreters and its own language servers. The settings
(**Settings → Toolchain**) hold the global defaults, a project overrides them in a plain text
file — `.opennotes.json` in the project folder:

```json
{
  "toolchain": {
    "java": "C:/Program Files/Java/jdk-21",
    "node": "C:/Program Files/nodejs/node.exe",
    "python": "C:/Python312/python.exe"
  },
  "lsp": {
    "go": { "command": "gopls", "args": [] }
  },
  "terminal": { "shell": "" },
  "keybindings": { "file.save": "Ctrl+S" }
}
```

A JDK may be given as a folder — the `bin` folder inside it is used. The paths are used when a
file is **run** and when a language server is started. The file is meant to be checked into the
project: everybody on the team uses the same SDK.

## Language servers (LSP)

OpenNotes speaks the Language Server Protocol itself (no extra library): it starts the server of
a language, keeps the document in sync and shows what the server reports.

| Language | Server (if it is installed) |
| --- | --- |
| Go | `gopls` |
| Java | `jdtls` (Eclipse JDT Language Server) |
| TypeScript / JavaScript | `typescript-language-server` |
| Python | `pyright-langserver` |
| Rust | `rust-analyzer` |
| C / C++ | `clangd` |
| C# | `csharp-ls` |
| PHP | `phpactor` |
| Ruby | `ruby-lsp` |
| Kotlin, Swift, Lua | `kotlin-language-server`, `sourcekit-lsp`, `lua-language-server` |

The command and the arguments of every server can be changed in the settings and in the project
file. The problems of the server appear in the **Problems** panel next to the syntax errors,
**Go to definition** (`F12`) and **Find references** (`Shift+F12`) work as soon as the server
answers. A server that is not installed is reported in the status bar (`LSP ✕`) — it never
breaks the editor.

## Large files

A file of 100 MB does not have to be a crash:

| Size | What happens |
| --- | --- |
| up to 4 MB | normal editing with syntax highlighting |
| up to 24 MB | editing without highlighting, the content is not copied on every keystroke |
| more than 24 MB | the editor shows the first 24 MB read-only, with a banner that says how much is missing |

The syntax tree of a huge file is never built (that is what freezes the editors), the problems
are skipped and the file is not written back to the store while you type.

## Search in files

The **Search** tool window searches the whole project:

* regular expressions (the `.*` button), whole words (`ab`), case sensitivity (`Aa`);
* a file filter (`*.ts`);
* the folders that hold no source code (`node_modules`, `target`, `dist`, `.git`, `__pycache__`, …)
  are skipped — they are the reason why a project search is slow and useless in most editors;
* **replace** writes the change into every file that matched (the encoding of the file is kept).

## The shortcuts

Every command has a shortcut, and the shortcut of the user wins over it. The shortcuts live in a
plain text file: `keybindings.json` in the folder of the settings. It is a simple map, so it can
be changed by hand and put into a project:

```json
{
  "file.save": "Ctrl+S",
  "edit.gotoLine": "Ctrl+G",
  "view.toggleTerminal": "Ctrl+`"
}
```

A project can change them in its own `.opennotes.json` (the key `keybindings`). The shortcuts of
another editor can be imported: paste the list of `{"key": "ctrl+s", "command": "…"}` objects into
**Settings → Shortcuts → Import** and the known commands are translated.

A key is handled exactly once: the editor knows better what `Ctrl+Z` means in a text, the native
menu handles the keys it has an accelerator for, and only then the shortcut of a command is used.
A command that the user has bound to another key loses the accelerator of the native menu, so the
shortcut of the user really works.

The complete list is in [docs/keyboard-shortcuts.md](docs/keyboard-shortcuts.md).

## The main menu

The window is drawn by the app: a top-left menu button opens a main menu with **File, Edit,
View, Navigate, Code, Format, Tools** and **Help** — hovering a section opens its fly-out with
the shortcuts on the right. The file tabs live in the title bar (like a browser), and the
minimise / maximise / close buttons are ours, so nothing of the operating system can overlap
them. Every command in the menu is also available in the command palette.

The tabs of the title bar scroll when there are more of them than the window can show; the
button that opens a new file always stays visible. The arrow keys walk through the tabs, and
`Alt` with the arrow keys switches the tab from anywhere in the window.

## Workspace profiles

The pill next to the logo switches the workspace between three profiles:

| Profile | Shows |
| --- | --- |
| **Text editing** | Documents, formatting and writing tools — the Notepad side of OpenNotes |
| **Coding** | Navigation, code tools, language modes, project views — the IDE side |
| **Everything** | All panels and commands at once |

The profile also decides which sections the main menu and the native menu show. Every command
stays reachable through the command palette in every profile. The current build ships the
**code** workspace as the default.

## Appearance

Everything about the look is live-editable in **Settings → Appearance**:

* corner radius (0–18 px) for buttons, panels, tabs and dialogs
* frosted **glass top bar** with adjustable blur (0–30 px) and opacity
* a colour **gradient** behind the top bar (two pickers)
* accent colour, density (compact / cozy / comfortable), tab shape (rounded / pill / underline)
* soft shadows and animations

## Syntax colours

**50 colour themes** for the code editor. The palettes come from well-known open-source
projects (the credit is kept on each theme), but the names you see are our own: *OpenNotes
Dark*, *OpenNotes Light*, *Surface*, *Frost*, *Carbon*, *Onyx*, *Slate*, *Dracula*, *Monokai*,
*Solarized*, *Tokyo Night*, *Gruvbox*, *Catppuccin*, *Ayu*, *Hopscotch*, *Nightfox*,
*Rose Pine*, *Everforest*, *Tomorrow*, *XQ* and more. Every theme carries its own token colours
and editor chrome, and the settings show a live gallery.

The **editor surface** can either match the app chrome (so the code area blends into the
window) or use the theme's own background — **Settings → Appearance → Editor surface**.

**129 languages** are highlighted. Among them Java, Go, C, C++, C#, F#, Kotlin, Swift, Scala,
Dart, Rust, PHP, Ruby, Perl, Lua, Haskell, Elixir, Erlang, OCaml, Zig, Solidity, Objective-C,
GDScript, Gradle (Groovy and Kotlin DSL), Elm, PureScript, Haxe, Idris, Agda, Lean, Raku, Vue,
Svelte, Astro, GraphQL, Terraform/HCL, SQL, YAML, TOML, Dockerfiles, Makefiles, CMake, Meson,
Ninja, Bazel, LaTeX, Mustache/Handlebars/EJS/Pug/Twig/Liquid, reStructuredText, HTTP, Prisma,
Gherkin, Robot Framework, JSONnet, CUE, Starlark, Systemd units, Desktop entries, Git config,
EditorConfig, WebAssembly text, OpenSCAD, Arduino, Racket, Scheme, Emacs Lisp, property lists,
Visual Studio projects, Xcode projects and Godot resources.

Java, C/C++, Go, JavaScript, TypeScript, Python, PHP, Rust, SQL, YAML, HTML, CSS, JSON, XML and
Markdown use the official CodeMirror grammars; the rest come from the CodeMirror legacy modes or
from dedicated modes written for this app (a full C# mode with interpolated strings, plus Go,
Rust, Kotlin, Swift, Scala, Dart, Objective-C, F#, Solidity, HCL, GraphQL, Vue, Svelte, Astro,
GDScript, Elm, MATLAB, AWK, Makefile, Batch, CSV, Log and more).

Every language is also listed in the **Language** menu, so you can override the detection for
any file, and the file icons in the tree and tab bar use the same language table.

## Icons and sounds

* **35 file icon themes** (Seti, Material, Material Filled, Minimal, Classic, Devicons,
  Nerd Font, Eclipse, IDE Classic, Repository, Flat, Monochrome, Frost, Dracula, Carbon,
  Gruvbox, Solarized, Tomorrow, Catppuccin, Ayu, Everforest, Hopscotch, Nightfox, Tokyo Night,
  Mocha, Poimandres, Rose Pine, Papercolor, Onyx, …) with 38 hand-drawn file type shapes —
  Java, Go, Rust, Python, C++, C#, PHP, Ruby, Swift, SQL, Shell, HTML, CSS, JSON, YAML, XML,
  Markdown, Docker, Git and more.
* **18 sound themes** (Silent, Subtle, Classic, Typewriter, Bell, Chime, Click, Pop, Blip,
  Synth, Terminal, Retro, Glass, Wood, Marimba, Pulse, Zen, Mechanical) — all **synthesised in
  the browser**, no audio files are shipped. Off by default, with a volume slider and a test
  button per theme.

## Document formats

| Format | Open | Save |
| --- | --- | --- |
| Plain text / code | ✅ | ✅ (any of 20+ encodings, LF/CRLF/CR) |
| Markdown | ✅ + live preview | ✅ |
| HTML | ✅ | ✅ |
| CSV / TSV | ✅ | ✅ |

Encoding detection (BOM aware) happens on open; the encoding and line ending are shown in the
status bar and can be changed per tab and converted on disk from the **Format** menu.

## Plugins

Drop a folder with a `plugin.js` into the `plugins` directory of the OpenNotes user-data folder and
enable it from the **Plugins** panel. A plugin exports commands and an `activate` hook:

```js
export default {
  id: 'hello',
  name: 'Hello',
  commands: [{ id: 'hello.greet', title: 'Say hello', run: () => console.log('hello') }],
  activate(ctx) {
    ctx.commands.register({ id: 'hello.hello', title: 'Hello!', run: () => ctx.toast('Hello!') })
  }
}
```

The whole plugin API is described in [docs/extension-api.md](docs/extension-api.md).

## Documentation

| File | What it answers |
| --- | --- |
| [docs/architecture.md](docs/architecture.md) | How the application is put together: the processes, the trust boundary, the command system, the editor abstraction, the state, the file system, the documents, the language servers, the search, the terminal, the plugins, the languages and the performance rules. |
| [docs/i18n.md](docs/i18n.md) | How the translation works and how to add a language or a new string. |
| [docs/extension-api.md](docs/extension-api.md) | The plugin API. |
| [docs/keyboard-shortcuts.md](docs/keyboard-shortcuts.md) | Every shortcut, and where it comes from. |
| [docs/testing.md](docs/testing.md) | The test suites and the rules for writing a test. |
| [docs/adr/](docs/adr) | The decisions that are not obvious from the code: the window frame, the language server client, the plain text configuration files. |
| [src/shared/contracts.md](src/shared/contracts.md) | The interfaces between the layers. |
| [CHANGELOG.md](CHANGELOG.md) | What changed. |
