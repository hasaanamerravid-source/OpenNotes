# 3. Plain text files for the keybindings, the project configuration and the settings

**Status:** accepted

## Context

Three kinds of configuration decide how the application behaves:

* the **settings** — the theme, the font, the encodings, the toolchain paths, the language servers, the enabled plugins;
* the **keybindings** — which shortcut runs which command;
* the **project configuration** — the interpreter paths, the language servers, the terminal and the keybindings of one folder.

The settings belong to one person on one machine. The project configuration belongs to a team and is meant to be checked into the repository next to the code. The keybindings are in between: they are personal, but they are also worth copying to a project.

All three are read very early. The settings are read by the main process before the application is ready, because the `softwareRendering` flag has to call `app.disableHardwareAcceleration()` before the first frame. The project configuration is read when a folder is opened, and it decides which language servers are started. The keybindings have to be in memory before the first keystroke reaches the keyboard handler.

## Decision

Everything is a JSON text file on disk. Nothing is stored in a database, in a binary store or in the local storage of the renderer.

| What | Where | Written by |
| --- | --- | --- |
| The settings | `<userData>/settings.json` | `src/main/ipc/settings.ts` (`settings:load`, `settings:save`) |
| The keybindings | `<userData>/keybindings.json` | `src/renderer/src/core/keybindings.ts` (`writeKeybindings`) |
| The project configuration | `<folder>/.opennotes.json` | `src/renderer/src/core/projectConfig.ts` (`writeProjectConfig`) |

The keybindings are a flat map from a command id to a shortcut:

```json
{
  "file.save": "Ctrl+S",
  "edit.gotoLine": "Ctrl+G"
}
```

The project configuration is a small object with the same shape for every section:

```json
{
  "toolchain": { "java": "C:/Program Files/Java/jdk-21" },
  "lsp": { "go": { "command": "gopls", "args": [] } },
  "terminal": { "shell": "" },
  "run": { "python": ["-u"] },
  "keybindings": { "file.save": "Ctrl+S" }
}
```

The two keybinding sources are merged, and the project file wins: `readKeybindings` returns `{ ...global, ...project }`. The same rule applies to the toolchain (`resolveTool`) and to the language servers (`resolveServers`).

## Consequences

* The files are readable, editable and diffable. A user can change a shortcut without the application being started, and a reviewer can see what a pull request changed in `.opennotes.json`.
* The project configuration can be checked into the repository, so every member of a team uses the same JDK and the same language server.
* Nothing has to be migrated. A file from an older version is read as it is: the settings are deep-merged with `DEFAULT_SETTINGS` at start-up (`init` in `src/renderer/src/store/app.ts`), and every value that is read has a fallback (`applyAppearance` merges with `DEFAULT_APPEARANCE`, the encodings fall back to UTF-8, the line ending to CRLF). An unknown or missing key never breaks the start-up.
* A damaged file is ignored rather than fatal. `settings:load`, `session:load` and `readKeybindings` all catch the parse error and return an empty result, and `init` carries on with the defaults.
* The main process can read the settings without the renderer: `applyRendererPreferences` parses `settings.json` directly from the disk before the application is ready, because the GPU has to be disabled before the first frame.
* The shape is a contract between the layers. `Settings` and `SessionState` live in `src/shared/types.ts` and are used by the main process, the preload and the renderer; a change to a setting touches the type, the default, the settings dialog and the code that reads it.
* The writes are not atomic. `fs.writeFile` overwrites the file in place, so a crash during the write can leave a truncated file. The next start then falls back to the defaults instead of refusing to open.
* The project configuration is not searched for. The folder it is read from is `settings.projectFolder`; when that setting is empty the application falls back to the folder of the active file (`projectFolder()` in `core/projectConfig.ts`), but the language servers are only configured from the explicit setting (`useLspConfiguration` reads `settings.projectFolder` and nothing else). A team that wants the project file to apply has to name the folder in the settings.

## Alternatives considered

* **A database (SQLite or a key-value store).** It would allow transactions, a schema version and a migration chain. The data is a few kilobytes of configuration that a human is expected to read and edit; a database would make it opaque, would need a tool to inspect it, and could not be checked into a repository.
* **One opaque blob.** The simplest implementation, but the user could not change a shortcut without the application, and a team could not share the toolchain of a project.
* **JSON with a version field and a migration chain.** The right answer for a file that changes shape over many releases. The cost is a migration script that has to be kept forever, and it buys nothing here, because the deep merge with the defaults already tolerates an old file.
* **TOML or YAML.** Both are nicer to write by hand than JSON, especially for the nested project configuration. They would add a parser and a writer to the main process for a file that is read as a whole and written as a whole, and the JavaScript object model of the application fits JSON directly.
* **The local storage of the renderer.** It would keep the settings out of the user-data folder, but the main process could no longer read them before the renderer exists, and the settings would be tied to the Chromium profile rather than to the application.
