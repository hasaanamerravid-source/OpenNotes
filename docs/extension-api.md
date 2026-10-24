# The plugin API

OpenNotes can be extended with plugins. A plugin is a plain JavaScript file
that adds commands to the application. Its code runs inside the renderer
process, next to the user interface.

This document describes the API exactly as it exists in the code.

| What | Where |
| --- | --- |
| Discovery of the installed plugins | `src/main/ipc/plugins.ts` |
| Loading, activation, the plugin context | `src/renderer/src/core/plugins.ts` |
| The command registry | `src/renderer/src/core/commands.ts` |
| The editor handle | `src/renderer/src/core/editors.ts` |
| The shared types (`Command`, `PluginManifest`) | `src/shared/types.ts` |
| The Plugins panel | `src/renderer/src/components/panels/PluginsPanel.tsx` |
| The bridge a plugin can use | `src/preload/index.ts` |
| The window of the renderer | `src/main/window.ts` |
| The content security policy | `src/renderer/index.html` |

## 1. What a plugin is

A plugin is a folder with a `plugin.js` file in it. The file is read as text,
evaluated as a plain script and asked for one object. That object may declare
metadata, a list of commands and two lifecycle hooks.

The evaluation happens in `evaluatePlugin()` in
`src/renderer/src/core/plugins.ts`:

```ts
const fn = new Function('module', 'exports', 'require', 'window', 'console', source)
fn(
  module,
  module.exports,
  () => {
    throw new Error('require() is not available inside plugins')
  },
  window,
  console,
)
```

Three consequences follow from this and matter when a plugin is written:

* The file is **not** an ES module: `import` is a syntax error inside a
  function body. The plugin object is exported with `module.exports = { ... }`.
  The form `exports.id = ...` works as well, and so does
  `module.exports.default = { ... }` — the loader unwraps a `default`
  property:

  ```ts
  const exported = module.exports as PluginModule
  if (exported && typeof exported === 'object' && 'default' in exported) {
    return (exported as unknown as { default: PluginModule }).default
  }
  ```

  `export default { ... }` is translated into `module.exports = { ... }` before
  the file is evaluated, so the syntax of the documentation works as well:

  ```ts
  // src/renderer/src/core/plugins.ts
  function normalizePlugin(source: string): string {
    return source.replace(/^[ \t]*export\s+default\s+/m, 'module.exports = ')
  }
  ```

* `require()` is not available. The `require` parameter throws
  `"require() is not available inside plugins"`. A plugin cannot load a Node.js
  module; everything it needs has to be in the file itself or reached through
  the bridge.
* The plugin sees the real `window` and the real `console`. It shares the
  global scope of the renderer with the application.

### The module shape

The loader accepts the following properties (`PluginModule` in
`src/renderer/src/core/plugins.ts`):

| Property | Type | Meaning |
| --- | --- | --- |
| `id` | `string` | Optional. **Not read by the loader** — the id of a plugin comes from its manifest. |
| `name` | `string` | Optional. Not read by the loader. |
| `version` | `string` | Optional. Not read by the loader. |
| `description` | `string` | Optional. Not read by the loader. |
| `commands` | `Command[]` | Commands that are registered automatically when the plugin is activated. |
| `activate` | `(ctx: PluginContext) => void` | Called when the user enables the plugin. |
| `deactivate` | `() => void` | Called when the user disables the plugin. |

Only `commands`, `activate` and `deactivate` have an effect. The name, the
version and the description shown in the Plugins panel come from the manifest
file, not from the plugin module.

## 2. Installing a plugin

### The folder layout

```
<user data folder>/
  plugins/
    word-counter/          <- one folder per plugin; the folder name is the default id
      plugin.js            <- required
      plugin.json          <- optional manifest
      settings.json        <- optional, written by the plugin itself
```

The root of the tree is `app.getPath('userData')` (`src/main/ipc/plugins.ts`).
The exact path is returned by `window.api.info().userData`; the settings
dialog prints it next to the file with the keybindings. The folder itself does
not have to exist: a missing `plugins` folder simply yields an empty list.

### The manifest

`plugin.json` is optional. When it exists it must be a JSON object; the loader
reads only four fields (`src/main/ipc/plugins.ts`):

```json
{
  "id": "word-counter",
  "name": "Word counter",
  "version": "1.0.0",
  "description": "Counts the words of the active document."
}
```

| Field | Default when it is missing |
| --- | --- |
| `id` | The name of the folder |
| `name` | The name of the folder |
| `version` | `0.0.0` |
| `description` | The empty string |

The `id` is the key under which the plugin is enabled: it is written to
`settings.plugins` in `settings.json` and it is the id that
`activatePlugin(id)` and `deactivatePlugin(id)` expect.

The manifest is parsed with `JSON.parse` inside a `try` block. A file with
invalid JSON does not break the plugin: the manifest falls back to the
defaults.

### Discovery

`plugins:list` (`src/main/ipc/plugins.ts`) reads every entry of the `plugins`
folder. For each entry it:

1. reads `<folder>/plugin.js` — if the file cannot be read the entry is
   skipped silently, so a folder without a `plugin.js` is not a plugin;
2. reads `<folder>/plugin.json` — optional, see above;
3. returns a `PluginManifest`:

```ts
export interface PluginManifest {
  id: string
  name: string
  version: string
  description: string
  path: string   // the absolute path of the plugin folder
  source: string // the text of plugin.js
}
```

The renderer calls this through `window.api.plugins.list()`. `discoverPlugins()`
in `src/renderer/src/core/plugins.ts` wraps the call and returns an empty list
when it fails.

### Enabling and disabling

The Plugins panel (`src/renderer/src/components/panels/PluginsPanel.tsx`) is
the only place where a plugin is switched on or off. The panel is reachable
from the activity bar (the **Plugins** tool window).

* **Enable** calls `activatePlugin(manifest.id)`. If the plugin throws, the
  error message is shown as an error toast and the plugin stays disabled.
  Otherwise the id is appended to `settings.plugins` and the settings are
  written to `settings.json`. Note that the commands of `module.commands` are
  registered *before* `activate` runs, so when `activate` throws they stay in
  the registry although the plugin is shown as disabled. They are removed by
  `deactivatePlugin`.
* **Disable** calls `deactivatePlugin(manifest.id)`, removes the id from
  `settings.plugins` and writes the settings again.

At start-up `App.tsx` calls `activateEnabledPlugins(settings.plugins)` after
the initialisation of the store:

```ts
export async function activateEnabledPlugins(ids: string[]): Promise<void> {
  await loadAllPlugins()
  for (const id of ids) {
    const error = activatePlugin(id)
    if (error) console.warn(`[plugin ${id}] ${error}`)
  }
}
```

A plugin that fails to activate is reported on the console; the application
starts anyway.

### The lifecycle

```
loadAllPlugins()            evaluate plugin.js of every installed plugin
  └─ evaluatePlugin()       → the module object, or an error message
activatePlugin(id)
  ├─ registerCommand()      for every command of module.commands
  └─ module.activate(ctx)   the context is built here
deactivatePlugin(id)
  ├─ module.deactivate()
  └─ unregisterCommand()    for every command of module.commands
```

`loadAllPlugins()` evaluates every plugin but activates nothing, so a broken
plugin cannot stop the application from starting. The error message of a
plugin that could not be evaluated is kept in `LoadedPlugin.error` and shown
next to the name of the plugin in the panel.

The commands of `module.commands` are registered before `activate` is called
and are unregistered when the plugin is deactivated. Commands that the plugin
registers itself with `ctx.commands.register(...)` are **not** unregistered
automatically — a plugin that registers commands in `activate` has to remove
them in `deactivate` with `ctx.commands.unregister(id)`.

## 3. The context object

`activate(ctx)` receives one object with four members. This is the complete
surface (`PluginContext` in `src/renderer/src/core/plugins.ts`):

```ts
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
```

| Member | Type | What it does |
| --- | --- | --- |
| `ctx.api` | `typeof window.api` | The complete preload bridge (see below). |
| `ctx.commands.register(command)` | `(command: Command) => void` | Registers a command. A later registration with the same id replaces the earlier one. |
| `ctx.commands.unregister(id)` | `(id: string) => void` | Removes a command from the registry. |
| `ctx.commands.list()` | `() => Command[]` | All registered commands, the built-in ones included. |
| `ctx.commands.run(id, payload?)` | `(id, payload?) => Promise<void>` | Runs a command by id. An unknown id is logged with `console.warn('[opennotes] unknown command:', id)`. |
| `ctx.editor(tabId)` | `(id: string \| null \| undefined) => EditorHandle \| undefined` | The live editor handle of a tab. |
| `ctx.toast(message, kind?)` | `(message: string, kind?: 'info' \| 'error' \| 'success') => void` | Shows a message in the corner of the window — see [the note below](#ctxtoast). |

### `ctx.commands`

The registry behind `ctx.commands` is the one of
`src/renderer/src/core/commands.ts`. It is shared with the command palette,
with the two menus and with the built-in commands, so a command that a plugin
registers is reachable from the palette (`Ctrl+Shift+P`) like every other
command.

The shape of a command is `Command` from `src/shared/types.ts`:

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

| Field | Meaning |
| --- | --- |
| `id` | The stable name of the command. Use a prefix of your own (`word-counter.stats`) so that the id cannot collide with a built-in command. |
| `title` | The text shown in the palette and in the menus. |
| `category` | The group in the palette. It is free text. |
| `shortcut` | The key combination **shown** in the palette. It is a label; it does not bind a key by itself. See [Keyboard shortcuts](keyboard-shortcuts.md). |
| `hidden` | `true` keeps the command out of the palette. It is still reachable through `ctx.commands.run(id)`. |
| `run(payload?)` | The work. It may return a promise. |

`ctx.commands.run` understands a payload suffix. In `runCommand(id, payload)`
the id is first looked up as a whole; when there is no command with that
literal id, the part before the first `:` is looked up and the rest is passed
as the payload:

```ts
const [base, ...rest] = id.split(':')
const baseCmd = registry.get(base)
if (baseCmd) {
  await baseCmd.run(rest.join(':') || payload)
  return
}
```

So `ctx.commands.run('format.setLanguage:python')` calls the command
`format.setLanguage` with the string `python`.

### `ctx.editor`

`ctx.editor` is the function `getEditor` of
`src/renderer/src/core/editors.ts`. It returns the handle of the editor of a
tab, or `undefined` when there is no id or no editor for it:

```ts
export function getEditor(id: string | null | undefined): EditorHandle | undefined {
  if (!id) return undefined
  if (activeHandle && activeHandle.id === id) return activeHandle
  const set = handles.get(id)
  if (!set) return undefined
  for (const handle of set) return handle
  return undefined
}
```

The id of a tab is the id of the editor handle as well (`handle.id === tab.id`
in `CodeEditor.tsx` and `RichTextEditor.tsx`). To find the tab that is in the
focus, read the state of the renderer:

```js
const tabId = window.opennotes.store.getState().activeTabId
const handle = ctx.editor(tabId)
if (!handle) return
```

`window.opennotes` is the scripting surface of the renderer, defined in
`src/renderer/src/main.tsx`:

```ts
;(window as unknown as { opennotes: unknown }).opennotes = {
  store: useAppStore,
  run: runCommand,
  setState: (patch: Record<string, unknown>) => useAppStore.setState(patch as never),
  commands: { list: getCommands },
  get problems() {
    return currentProblems()
  },
  get editor() {
    return getEditor(useAppStore.getState().activeTabId)
  },
}
```

A plugin runs in the renderer and can therefore use it: `window.opennotes.store`
is the Zustand store of the application, `window.opennotes.run` runs a command,
`window.opennotes.editor` is the handle of the active tab.

#### The editor handle

`EditorHandle` (`src/renderer/src/core/editors.ts`):

| Member | Signature | Notes |
| --- | --- | --- |
| `id` | `string` | The id of the tab. |
| `mode` | `'code' \| 'markdown' \| 'rich'` | The kind of the editor. |
| `focus()` | `() => void` | Moves the keyboard focus into the editor. |
| `getSelection()` | `() => EditorSelection` | `{ from, to, text }` — the offsets are plain-text offsets. |
| `replaceSelection(text)` | `(text: string) => void` | Replaces the selection. |
| `insertText(text)` | `(text: string) => void` | Inserts at the cursor. |
| `getContent()` | `() => string` | The plain text of the document. |
| `getHtml()` | `() => string` | The HTML of the document (only meaningful in the rich editor). |
| `setContent(text)` | `(text: string) => void` | Replaces the whole document with plain text. |
| `setHtml(html)` | `(html: string) => void` | Replaces the whole document with HTML. |
| `undo()` | `() => void` | |
| `redo()` | `() => void` | |
| `selectAll?()` | `() => void` | **Optional.** The CodeMirror editor has it, the rich-text editor does not — always test for it. |
| `goToLine(line)` | `(line: number) => void` | 1-based. |
| `goToOffset(offset)` | `(offset: number) => void` | The offset in the plain text. |
| `stats()` | `() => EditorStats` | `{ lines, cols, selection, words, chars, selectedChars }`. |
| `isDirty()` | `() => boolean` | Whether the tab has unsaved changes. |
| `markClean()` | `() => void` | Clears the "dirty" flag of the tab. |
| `focusSearch(query?)` | `(query?: string) => void` | Opens the search panel of the editor, optionally with a query. |
| `openSearchPanel(replace?)` | `(replace?: boolean) => void` | Opens the search panel; `true` switches it to the replace mode. |
| `findNext()` | `() => void` | |
| `findPrevious()` | `() => void` | |
| `destroy()` | `() => void` | Destroys the editor. A plugin should not call it. |

The handle is registered by the editor component and removed when the tab is
closed, so a plugin must fetch it again for every use instead of keeping it.

### `ctx.toast`

```js
ctx.toast('The document was saved.', 'success')
```

The second argument is one of `'info'` (the default), `'error'` and
`'success'`. The message is meant for the corner of the window, where the
toasts of the application disappear after a few seconds.

> **Known issue.** `ctx.toast()` dispatches a DOM event instead of writing
> into the store of the application:
>
> ```ts
> toast: (message, kind) => {
>   window.dispatchEvent(new CustomEvent('opennotes:toast', { detail: { message, kind } }))
> },
> ```
>
> No component in the application subscribes to `opennotes:toast` — the only
> occurrence of that name in `src/` is the dispatch itself — so nothing is
> shown at the moment.
>
> The working way to show a toast today is the store, which the plugin can
> reach through `window.opennotes`:
>
> ```js
> window.opennotes.store.getState().toast('The document was saved.', 'success')
> ```
>
> The signature is `toast(message: string, kind?: 'info' | 'error' | 'success')`
> (`src/renderer/src/store/app.ts`). The example plugin below uses the store
> for that reason.

### `ctx.api`

`ctx.api` is the object that the preload script exposes as `window.api`
(`src/preload/index.ts`). It is the only way from the renderer to the main
process. The groups:

| Group | What it does |
| --- | --- |
| `api.info()` | Version, Electron version, platform and the path of the user-data folder. |
| `api.fs` | `openDialog`, `saveDialog`, `readFile`, `writeFile`, `readDir`, `listRecursive`, `stat`, `exists`, `makeDir`, `remove`, `rename`, `copyFile`, `showInFolder`, `readTextFile`, `writeTextFile`, `search`, `replaceInFiles`, `watch`. |
| `api.recent` | `list`, `add`, `clear` — the list of the recently opened files. |
| `api.docs` | `read`, `write`, `toMarkdown`, `detect` — the document converters (rtf, docx, odt, html, csv, markdown). |
| `api.session` | `load`, `save` — the session file with the open tabs. |
| `api.settings` | `load`, `save` — the settings of the application. |
| `api.plugins` | `list` — the installed plugins. |
| `api.clipboard` | `readText`, `writeText`. |
| `api.shell` | `openTerminal`, `run`. |
| `api.menu` | `setRecent`, `setProfile`, `setLocale`. |
| `api.run` | `start`, `stop`, `onOutput` — runs the active file. |
| `api.terminal` | `start`, `write`, `interrupt`, `stop`, `resize`, `onOutput`. |
| `api.lsp` | `start`, `didOpen`, `didChange`, `didClose`, `request`, `stop`, `configure`, `onDiagnostics`, `onStatus`. |
| `api.win` | `newWindow`, `setMenuBar`, `minimize`, `toggleMaximize`, `close`, `isMaximized`, `zoom`, `getZoom`, `setZoom`, `setTitle`, `setTheme`, `onMaximizeChange`. |
| `api.reportError(message)` | Writes a message into the log of the application. |
| `api.onCommand(cb)` | Subscribes to the commands that the native menu sends. |
| `api.onOpenFiles(cb)` | Files that were opened from the outside (a second instance of the application, for example). |
| `api.pathForFile(file)` | The real path of a file that was dropped on the window. |
| `api.test` | Only present when the application was started with `OPENNOTES_TEST_CLICK=1`. A test helper, not part of the plugin API. |

Every call goes through a guard that swallows the "Object has been destroyed"
error of a window that is closing.

## 4. The settings of a plugin

The plugin API has no dedicated settings store. What the application itself
stores for a plugin is the **list of the enabled plugin ids**
(`settings.plugins`, an array of strings in `settings.json`). That is the only
plugin related field in `Settings` (`src/shared/types.ts`).

A plugin that needs its own settings writes them itself. The recommended place
is a JSON file in the folder of the plugin, because the path of the folder is
known and the file is removed together with the plugin:

```js
async function settingsPath() {
  const info = await ctx.api.info()
  return `${info.userData}\\plugins\\word-counter\\settings.json`
}
```

`api.fs.writeTextFile` creates the folder of the file if it does not exist
(`src/main/ipc/fs.ts`), so no `makeDir` is needed. `api.fs.readTextFile`
rejects when the file does not exist — catch it and fall back to the defaults.

> **Do not use `api.settings.save()` for the settings of a plugin.** The
> handler writes the object it receives as the whole `settings.json`
> (`src/main/ipc/settings.ts`), so a plugin that calls it with its own object
> destroys the settings of the application.

## 5. A complete plugin

The following plugin is complete and working. It counts the words of the
active document, inserts the result into the document, keeps a threshold in
its own settings file and removes the commands it registered when it is
disabled.

Save it as `plugin.js` in `<user data>/plugins/word-counter/`:

```js
/**
 * OpenNotes plugin: word counter.
 *
 * Installation:
 *   1. create the folder <user data>/plugins/word-counter/
 *   2. put this file there as plugin.js
 *   3. enable the plugin in the Plugins panel
 *
 * The file is evaluated with `new Function(...)`, so it is a plain script and
 * not an ES module: the plugin object is exported with `module.exports = ...`.
 */

const PLUGIN_ID = 'word-counter'

/** The context of the plugin; it is filled by activate(). */
let ctx = null

/** Show a message in the corner of the window. */
function toast(message, kind) {
  window.opennotes.store.getState().toast(message, kind)
}

/** The editor of the tab that is in the focus, or undefined. */
function activeEditor() {
  if (!ctx) return undefined
  const tabId = window.opennotes.store.getState().activeTabId
  return ctx.editor(tabId)
}

/** The file with the settings of this plugin. */
async function settingsPath() {
  const info = await ctx.api.info()
  return `${info.userData}\\plugins\\${PLUGIN_ID}\\settings.json`
}

/** The settings of this plugin (the defaults when there is no file yet). */
async function loadSettings() {
  try {
    const text = await ctx.api.fs.readTextFile(await settingsPath())
    const parsed = JSON.parse(text)
    const threshold = Number(parsed.threshold)
    return { threshold: Number.isFinite(threshold) ? threshold : 100 }
  } catch {
    return { threshold: 100 }
  }
}

/** Write the settings of this plugin. */
async function saveSettings(settings) {
  await ctx.api.fs.writeTextFile(await settingsPath(), JSON.stringify(settings, null, 2))
}

module.exports = {
  id: PLUGIN_ID,
  name: 'Word counter',
  version: '1.0.0',
  description: 'Counts the words of the active document.',

  /* These commands are registered when the plugin is activated. */
  commands: [
    {
      id: 'word-counter.stats',
      title: 'Word count: statistics of the active document',
      category: 'Word count',
      run: async () => {
        const editor = activeEditor()
        if (!editor) {
          toast('There is no open document.', 'error')
          return
        }
        const stats = editor.stats()
        const settings = await loadSettings()
        const message =
          `${stats.words} words, ${stats.chars} characters, ${stats.lines} lines. ` +
          `The threshold is ${settings.threshold}.`
        toast(message, 'success')
        console.log('[word-counter] ' + message)
      }
    }
  ],

  /* Called when the user enables the plugin. */
  activate(context) {
    ctx = context

    context.commands.register({
      id: 'word-counter.insert',
      title: 'Word count: insert the number of words',
      category: 'Word count',
      run: async () => {
        const editor = activeEditor()
        if (!editor) return
        const count = editor.stats().words
        editor.insertText(String(count))

        const settings = await loadSettings()
        if (count >= settings.threshold) {
          toast(`The document has ${count} words.`, 'success')
        }
      }
    })

    context.commands.register({
      id: 'word-counter.setThreshold',
      title: 'Word count: set the threshold',
      category: 'Word count',
      run: async (payload) => {
        const settings = await loadSettings()
        // The payload is the new threshold. Without a payload the current
        // value is only reported.
        const value = Number(payload)
        if (Number.isFinite(value)) {
          settings.threshold = value
          await saveSettings(settings)
        }
        toast(`The threshold is ${settings.threshold} words.`, 'success')
      }
    })
  },

  /* Called when the user disables the plugin. */
  deactivate() {
    /* The commands that were registered in activate() have to be removed
       by hand; the commands of the `commands` list are removed by the app. */
    ctx?.commands.unregister('word-counter.insert')
    ctx?.commands.unregister('word-counter.setThreshold')
    ctx = null
  }
}
```

Points to note:

* `module.exports = { ... }` — not `export default`.
* `ctx` is captured in `activate` because the commands of the `commands` list
  need it as well.
* `window.opennotes.store.getState().activeTabId` finds the tab that is in
  the focus; `ctx.editor(tabId)` returns its editor handle.
* `editor.stats()` returns `{ lines, cols, selection, words, chars,
  selectedChars }`.
* The commands that are registered in `activate` are removed in `deactivate`.
* The settings of the plugin live in `settings.json` next to `plugin.js`.
* A plugin command can be given a key: write its id into `keybindings.json`
  in the user-data folder, for example
  `{ "word-counter.insert": "Ctrl+Alt+W" }`.

### A shorter plugin

A plugin without an editor and without settings only needs the command list:

```js
module.exports = {
  commands: [
    {
      id: 'hello.greet',
      title: 'Say hello',
      category: 'Hello',
      run: () => console.log('hello')
    }
  ]
}
```

## 6. The security boundary

A plugin is **not** sandboxed.

* The source is evaluated with `new Function` inside the renderer process.
  A plugin therefore has the same rights as the user interface: it can read
  and change the whole document, read the clipboard, manipulate the DOM of
  the application and call everything the preload bridge exposes.
* `require` is blocked, but that is the only limit of the plugin itself. The
  window is created with `contextIsolation: true`, `nodeIntegration: false`
  and `sandbox: false` (`src/main/window.ts`), so a plugin has no direct
  access to Node.js — the bridge is the only way into the main process.
* The bridge does not restrict what a plugin may do. `ctx.api.fs` reaches
  every file the user can reach, `ctx.api.shell.openTerminal` opens a shell
  and `ctx.api.run.start` runs a program. The bridge only swallows the
  "Object has been destroyed" error of a window that is closing.
* The renderer runs with a content security policy
  (`src/renderer/index.html`): `default-src 'self' file:; img-src 'self' data:
  blob: file:; style-src 'self' 'unsafe-inline' file:; font-src 'self' data:
  file:; script-src 'self' 'unsafe-eval' file:`. A plugin cannot load a script
  or a style from the network. `script-src` contains `'unsafe-eval'`, which is
  what makes the evaluation of the plugin source possible at all.
* The plugins are not signed and not verified. Any `plugin.js` in the
  `plugins` folder of the user-data folder is loaded and evaluated.
* A plugin that throws is caught: the message is shown in the Plugins panel
  and the application keeps running. A plugin that loops, however, blocks the
  renderer like any other code in the renderer.

Install a plugin only when you trust its source.

## 7. Troubleshooting

| Symptom | Cause |
| --- | --- |
| The plugin does not appear in the panel | There is no `plugin.js` in the folder, or the folder is not in the `plugins` folder of the user-data folder. |
| The panel shows an error message | The file could not be evaluated — a syntax error is the usual reason. `export default` is a syntax error here, `module.exports = { ... }` is not. |
| The plugin is enabled but the commands are missing | The commands are in `activate` and the plugin was never activated, or `activate` threw before the registration. |
| `ctx.toast(...)` shows nothing | See [the note above](#ctxtoast). Use `window.opennotes.store.getState().toast(...)` instead. |
| The shortcut in the palette does nothing | The `shortcut` of a command is a label. A shortcut only works when it is in the native menu or in `keybindings.json` — see [Keyboard shortcuts](keyboard-shortcuts.md). |
| The plugin lost its settings | The settings were written into `settings.json` of the application instead of into the folder of the plugin — that file is overwritten by the application. |
