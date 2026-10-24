# OpenNotes documentation

The technical documentation of OpenNotes. Every statement in these files is backed by the source; the file and the line are named where it matters.

| File | What it answers |
| --- | --- |
| [architecture.md](architecture.md) | How the application is put together: the four processes and the trust boundary, the command system, the editor abstraction, the state, the file system layer, the document formats, the language servers, the search, the terminal and the run panel, the plugins, the internationalisation, the performance rules and the build. It ends with a table that maps a kind of change to the file it belongs in. |
| [adr/0001-electron-with-a-custom-window-frame.md](adr/0001-electron-with-a-custom-window-frame.md) | Why the window frame is drawn by the application instead of the native one, and what that costs. |
| [adr/0002-a-language-server-client-without-a-library.md](adr/0002-a-language-server-client-without-a-library.md) | Why the LSP client is written by hand instead of using `vscode-languageserver-node`, and what the protocol surface therefore is. |
| [adr/0003-plain-text-files-for-everything.md](adr/0003-plain-text-files-for-everything.md) | Why the keybindings, the project configuration and the settings are plain JSON files in the user data folder, and what that buys. |
| [extension-api.md](extension-api.md) | The plugin API: what a plugin is, the context it receives during activation, the commands it can register and the bridge it can use. |
| [keyboard-shortcuts.md](keyboard-shortcuts.md) | The complete list of the keyboard shortcuts, and which of the three binding mechanisms is responsible for each of them. |
| [testing.md](testing.md) | The test suites, the commands that run them and the rules for writing a test. |
| [i18n.md](i18n.md) | The languages of the interface: how the catalogue works and how to add a language or a new string. |

## Related material in the repository

| File | What it is |
| --- | --- |
| `README.md` | The user-facing description of the application: the features, the shortcuts, the settings, the plugin format. |
| `src/shared/contracts.md` | The interfaces between the layers: the preload surface, the command system, the editor registry, the vault and the documents. |
| `src/shared/types.ts` | The types that all three processes share. |
| `scripts/app-test-harness.js` | The in-app test suite; it is the executable description of the feature surface. |

## Reading order

For a first pass, read `architecture.md` from the top: the process model, the command system and the editor abstraction explain why the rest of the code looks the way it does. The three decision records then explain the choices that are not obvious from the code alone.
