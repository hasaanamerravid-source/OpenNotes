# Keyboard shortcuts

This is the complete reference of the keyboard shortcuts of OpenNotes. Every
entry is taken from the code; the **where** column names the files that define
the binding.

## Where a shortcut comes from

A shortcut can be written down in three different places. They are independent
of each other and are read in this order:

| Source | Where | Format |
| --- | --- | --- |
| The built-in one | `src/renderer/src/core/builtinCommands.ts`, the `shortcut` property of a command | A string such as `Ctrl+Shift+S`. |
| The file of the user | `keybindings.json` in the user-data folder | A flat map of the id of a command to a key combination. |
| The file of the project | `.opennotes.json` in the project folder, under `keybindings` | The same flat map. |

The project file wins over the file of the user. `readKeybindings()` in
`src/renderer/src/core/keybindings.ts` merges the two:

```ts
const project = cachedProjectConfig()?.keybindings
return project ? { ...global, ...project } : global
```

The built-in `shortcut` is the **default binding**. It is shown in the command
palette, in the settings dialog and in the menus, and it binds a key: the
keymap of the application falls back to it when neither the editor nor the
native menu has handled the key press.

A command that the user has bound to another key loses the accelerator of the
native menu (`accelerator()` in `src/main/menu.ts`), so the shortcut of the
user really wins: the menu would otherwise swallow the key before the
renderer ever sees it.

### The three mechanisms that dispatch a key

| Mechanism | Where | What it binds |
| --- | --- | --- |
| The native accelerators | `src/main/menu.ts` | The Electron menu registers the accelerator. The key press is sent to the renderer as `menu:command` and executed with `runCommand(id, payload)` (`src/renderer/src/App.tsx`). This is what makes most of the built-in shortcuts work. |
| The keymap of the application | `src/renderer/src/App.tsx` | A single `keydown` listener on `window`. It closes the palette, switches the tabs and dispatches the shortcuts of the user and the default ones. |
| The keymap of the editor | `src/renderer/src/components/editor/CodeEditor.tsx` | CodeMirror installs `closeBracketsKeymap`, `defaultKeymap`, `searchKeymap`, `historyKeymap`, `foldKeymap`, `completionKeymap`, `lintKeymap`, `indentWithTab` and `standardKeymap`. They work while the editor has the focus. |

A key is handled exactly once:

1. the shortcuts of the user are checked first, and the key press is consumed
   there (`preventDefault` and `stopPropagation`);
2. a key that the editor has already handled (`e.defaultPrevented`) is left
   alone — the editor knows better what `Ctrl+Z` means in a text;
3. a command that the native menu binds to a key is skipped
   (`handledByMenu()`), because the menu has already run it;
4. only then the default binding of a command is used.

### The files of the tables

| Abbreviation | File |
| --- | --- |
| `builtinCommands.ts` | `src/renderer/src/core/builtinCommands.ts` |
| `menu.ts` | `src/main/menu.ts` (the native menu) |
| `menuStructure.ts` | `src/renderer/src/core/menuStructure.ts` (the in-app menu) |
| `App.tsx` | `src/renderer/src/App.tsx` |

`CmdOrCtrl` in the native menu means `Ctrl` on Windows and Linux and `Cmd` on
macOS. `builtinCommands.ts` always writes `Ctrl`, even on macOS.

## File

| Action | Shortcut | Where it is defined |
| --- | --- | --- |
| New file (`file.new`) | `Ctrl+N` | `builtinCommands.ts` · `menu.ts` (`CmdOrCtrl+N`) · `menuStructure.ts` |
| New window (`file.newWindow`) | `CmdOrCtrl+Shift+N` | `menu.ts` — no `shortcut` in `builtinCommands.ts` |
| Open file… (`file.open`) | `Ctrl+O` | `builtinCommands.ts` · `menu.ts` (`CmdOrCtrl+O`) · `menuStructure.ts` |
| Save (`file.save`) | `Ctrl+S` | `builtinCommands.ts` · `menu.ts` (`CmdOrCtrl+S`) · `menuStructure.ts` |
| Save as… (`file.saveAs`) | `Ctrl+Shift+S` | `builtinCommands.ts` · `menu.ts` (`CmdOrCtrl+Shift+S`) · `menuStructure.ts` |
| Save all (`file.saveAll`) | `CmdOrCtrl+Alt+S` | `menu.ts` — no `shortcut` in `builtinCommands.ts` |
| Close tab (`file.close`) | `Ctrl+W` | `builtinCommands.ts` · `menu.ts` (`CmdOrCtrl+W`) · `menuStructure.ts` |
| Reopen closed tab (`file.reopenClosed`) | `Ctrl+Shift+T` | `builtinCommands.ts` · `menuStructure.ts` — **not bound**, see [Not bound](#not-bound) |

Without a shortcut: `file.openFromClipboard`, `file.openPath`, `file.openRecent`,
`file.closeAll`,
`file.exportMarkdown`.

## Edit

| Action | Shortcut | Where it is defined |
| --- | --- | --- |
| Undo (`edit.undo`) | `Ctrl+Z` | `builtinCommands.ts` · `menu.ts` (`CmdOrCtrl+Z`) · `menuStructure.ts` |
| Redo (`edit.redo`) | `Ctrl+Y` | `builtinCommands.ts` · `menu.ts` (`CmdOrCtrl+Y`) · `menuStructure.ts` |
| Delete selection (`edit.delete`) | `Delete` | `menu.ts` — no `shortcut` in `builtinCommands.ts` |
| Select all (`edit.selectAll`) | `Ctrl+A` | `builtinCommands.ts` · `menu.ts` (`CmdOrCtrl+A`) · `menuStructure.ts` |
| Go to line… (`edit.gotoLine`) | `Ctrl+G` | `builtinCommands.ts` · `menu.ts` (`CmdOrCtrl+G`) · `menuStructure.ts` |
| Duplicate line (`edit.duplicateLine`) | `Ctrl+D` | `builtinCommands.ts` · `menu.ts` (`CmdOrCtrl+D`) · `menuStructure.ts` |
| Delete line (`edit.deleteLine`) | `Ctrl+Shift+K` | `builtinCommands.ts` · `menu.ts` (`CmdOrCtrl+Shift+K`) · `menuStructure.ts` |
| Move line up (`edit.moveLineUp`) | `Alt+Shift+Up` | `builtinCommands.ts` · `menu.ts` (`Alt+Shift+Up`) · `menuStructure.ts` |
| Move line down (`edit.moveLineDown`) | `Alt+Shift+Down` | `builtinCommands.ts` · `menu.ts` (`Alt+Shift+Down`) · `menuStructure.ts` |
| Copy line (`edit.copyLine`) | `Ctrl+Shift+C` | `builtinCommands.ts` · `menu.ts` (`CmdOrCtrl+Shift+C`) · `menuStructure.ts` |
| Insert date/time (`edit.insertDateTime`) | `F5` | `builtinCommands.ts` · `menu.ts` (`F5`) · `menuStructure.ts` |

Without a shortcut: the hidden `edit.insertText`.

## Search

| Action | Shortcut | Where it is defined |
| --- | --- | --- |
| Find… (`search.find`) | `Ctrl+F` | `builtinCommands.ts` · `menu.ts` (`CmdOrCtrl+F`) · `menuStructure.ts` |
| Replace… (`search.replace`) | `Ctrl+H` | `builtinCommands.ts` · `menu.ts` (`CmdOrCtrl+H`) · `menuStructure.ts` |
| Find next (`search.findNext`) | `F3` | `builtinCommands.ts` · `menu.ts` (`F3`) · `menuStructure.ts` |
| Find previous (`search.findPrevious`) | `Shift+F3` | `builtinCommands.ts` · `menu.ts` (`Shift+F3`) · `menuStructure.ts` |
| Find in files (vault) (`search.findInFiles`) | `Ctrl+Shift+F` | `builtinCommands.ts` · `menu.ts` (`CmdOrCtrl+Shift+F`, only visible in the profiles `editing` and `all`) · `menuStructure.ts` |
| Go to matching bracket (`search.matchBracket`) | `Ctrl+B` | `builtinCommands.ts` · `menu.ts` (`CmdOrCtrl+B`) · `menuStructure.ts` |

Without a shortcut: `search.markAll`.

## View

| Action | Shortcut | Where it is defined |
| --- | --- | --- |
| Toggle sidebar (`view.toggleSidebar`) | `Ctrl+Shift+E` | `builtinCommands.ts` · `menu.ts` (`CmdOrCtrl+Shift+E`) · `menuStructure.ts` |
| Toggle full screen (`view.fullscreen`) | `F11` | `builtinCommands.ts` · `menu.ts` (`F11`) · `menuStructure.ts` |
| Zoom in (`view.zoomIn`) | `Ctrl++` | `builtinCommands.ts` · `menu.ts` (`CmdOrCtrl+Plus`) · `menuStructure.ts` |
| Zoom out (`view.zoomOut`) | `Ctrl+-` | `builtinCommands.ts` · `menu.ts` (`CmdOrCtrl+-`) · `menuStructure.ts` |
| Reset zoom (`view.zoomReset`) | `Ctrl+0` | `builtinCommands.ts` · `menu.ts` (`CmdOrCtrl+0`) · `menuStructure.ts` |
| Toggle word wrap (`view.toggleWordWrap`) | `CmdOrCtrl+Alt+W` | `menu.ts` — no `shortcut` in `builtinCommands.ts` |
| Distraction free mode (`view.distractionFree`) | `Ctrl+Shift+F` | `builtinCommands.ts` — `menu.ts` binds `CmdOrCtrl+Alt+F`, see [Not bound](#not-bound) |
| Toggle split view (`view.toggleSplit`) | `Ctrl+Alt+S` | `builtinCommands.ts` · `menu.ts` (`CmdOrCtrl+Alt+S`) · `menuStructure.ts` |
| Command palette… (`view.commandPalette`) | `Ctrl+Shift+P` | `builtinCommands.ts` · `menu.ts` (`CmdOrCtrl+Shift+P`) · `menuStructure.ts` |
| Quick switcher (files & notes) (`view.quickSwitcher`) | `Ctrl+Shift+O` | `builtinCommands.ts` · `menu.ts` (`CmdOrCtrl+Shift+O`) · `menuStructure.ts` |

Without a shortcut: `view.toggleStatusBar`, `view.toggleLineNumbers`,
`view.toggleMinimap`, `view.toggleIndentGuides`, `view.toggleInvisibles`,
`view.toggleTheme`.

The command `view.toggleTerminal` has the category `View` but belongs to the
terminal; it is listed under [Terminal](#terminal).

## Navigate

| Action | Shortcut | Where it is defined |
| --- | --- | --- |
| Next bookmark (`edit.nextBookmark`) | `F2` | `builtinCommands.ts` · `menu.ts` (`F2`) · `menuStructure.ts` |
| Previous bookmark (`edit.prevBookmark`) | `Shift+F2` | `builtinCommands.ts` · `menu.ts` (`Shift+F2`) · `menuStructure.ts` |
| Switch to the next tab | `Ctrl+Tab` | `App.tsx` |
| Switch to the previous tab | `Ctrl+Shift+Tab` | `App.tsx` |
| Switch to tab 1 … 9 | `Ctrl+1` … `Ctrl+9` | `App.tsx` |
| Switch to the previous tab | `Ctrl+Alt+Left` | `App.tsx` — see [Not bound](#not-bound) |
| Switch to the next tab | `Ctrl+Alt+Right` | `App.tsx` — see [Not bound](#not-bound) |
| Close the command palette | `Escape` | `App.tsx` |
| Close a dialog | `Escape` | `src/renderer/src/components/Modal.tsx` |

The tab shortcuts are handled by the single `keydown` listener of
`src/renderer/src/App.tsx`. They only work with `Ctrl` (or `Cmd`), because the
handler returns early when neither is pressed:

```ts
if (!ctrl) return
```

The modal handler in `src/renderer/src/components/Modal.tsx` listens in the
capture phase, so `Escape` closes a dialog before the application keymap sees
it.

## Code

| Action | Shortcut | Where it is defined |
| --- | --- | --- |
| Toggle bookmark (`edit.toggleBookmark`) | `Ctrl+F2` | `builtinCommands.ts` · `menu.ts` (`CmdOrCtrl+F2`) · `menuStructure.ts` |
| Duplicate line (`edit.duplicateLine`) | `Ctrl+D` | `builtinCommands.ts` · `menu.ts` (`CmdOrCtrl+D`) · `menuStructure.ts` |
| Delete line (`edit.deleteLine`) | `Ctrl+Shift+K` | `builtinCommands.ts` · `menu.ts` (`CmdOrCtrl+Shift+K`) · `menuStructure.ts` |
| Copy line (`edit.copyLine`) | `Ctrl+Shift+C` | `builtinCommands.ts` · `menu.ts` (`CmdOrCtrl+Shift+C`) · `menuStructure.ts` |
| Move line up (`edit.moveLineUp`) | `Alt+Shift+Up` | `builtinCommands.ts` · `menu.ts` (`Alt+Shift+Up`) · `menuStructure.ts` |
| Move line down (`edit.moveLineDown`) | `Alt+Shift+Down` | `builtinCommands.ts` · `menu.ts` (`Alt+Shift+Down`) · `menuStructure.ts` |
| Go to definition (`editor.goToDefinition`) | `F12` | `builtinCommands.ts` — **not bound**, see [Not bound](#not-bound) |
| Find references (`editor.findReferences`) | `Shift+F12` | `builtinCommands.ts` — **not bound**, see [Not bound](#not-bound) |

The category of `editor.goToDefinition` and `editor.findReferences` is
`Editor`. They are not in any menu — neither in the native menu
(`src/main/menu.ts`) nor in the in-app menu (`menuStructure.ts`). They are
only reachable through the command palette and through `runCommand`.

The commands `edit.duplicateLine`, `edit.deleteLine`, `edit.copyLine`,
`edit.moveLineUp`, `edit.moveLineDown`, `edit.toggleBookmark`,
`search.matchBracket`, `search.markAll`, `view.toggleSplit`,
`view.toggleMinimap`, `view.toggleIndentGuides`, `view.toggleInvisibles`,
`tools.openTerminal` and `tools.run` are only shown in the profiles `coding`
and `all` (`ITEM_PROFILES` in `menuStructure.ts`).

## Format

No command of the Format group has a shortcut. The group contains the
encoding and line-ending commands (`format.setLanguage`, `format.setEncoding`,
`format.encode`, `format.convertTo`, `format.eol`) and the text transforms
(`format.sortAsc`, `format.sortDesc`, `format.removeDuplicates`,
`format.trimTrailing`, `format.joinLines`, `format.upperCase`,
`format.lowerCase`, `format.titleCase`). All of them are in the Format section
of the in-app menu (`menuStructure.ts`). In the native menu
(`src/main/menu.ts`) the text transforms and the encoding commands are in the
Format menu, `format.setLanguage` is in the Language menu and
`format.setEncoding` in the Encoding menu. Any of them can be given a
shortcut with `keybindings.json`.

`format.setLanguage` and `format.setEncoding` are marked `hidden`, so they do
not appear in the command palette; the other commands of the group do.

## Tools

No command of the Tools group has a shortcut. The group contains
`tools.compare`, `tools.macroStart`, `tools.macroStop`, `tools.macroPlay`,
`tools.stopRun`, `tools.characterMap`, `tools.openTerminal` and `tools.run`.

## Terminal

| Action | Shortcut | Where it is defined |
| --- | --- | --- |
| Show the integrated terminal (`view.toggleTerminal`) | ``Ctrl+` `` | `builtinCommands.ts` — **not bound**, see [Not bound](#not-bound) |
| Run the line in the terminal | `Enter` | `src/renderer/src/components/panels/TerminalPanel.tsx` |
| The previous command | `ArrowUp` | `src/renderer/src/components/panels/TerminalPanel.tsx` |
| The next command | `ArrowDown` | `src/renderer/src/components/panels/TerminalPanel.tsx` |
| Clear the line | `Escape` | `src/renderer/src/components/panels/TerminalPanel.tsx` |
| Interrupt the running command | `Ctrl+C` | `src/renderer/src/components/panels/TerminalPanel.tsx` — only when the line is empty, so that the copy shortcut keeps working |

`terminal.clear` and `terminal.restart` have no shortcut.

## Vault

No command of the Vault group has a shortcut in `builtinCommands.ts`. The
native menu registers three accelerators for it (`src/main/menu.ts`):

| Action | Shortcut | Where it is defined |
| --- | --- | --- |
| Open a vault… (`vault.openVault`) | `CmdOrCtrl+Shift+V` | `menu.ts` — only visible in the profiles `editing` and `all` |
| New note in vault… (`vault.createNote`) | `CmdOrCtrl+Alt+N` | `menu.ts` — only visible in the profiles `editing` and `all` |
| Open today's daily note (`vault.dailyNote`) | `CmdOrCtrl+Alt+D` | `menu.ts` — only visible in the profiles `editing` and `all` |

`vault.createSample`, `vault.closeVault`, `vault.refresh` and
`vault.openLink` have no shortcut.

## Help

No command of the Help group has a shortcut. `help.welcome` and `help.about`
are in the Help menu (`menuStructure.ts`) and in the native menu (`menu.ts`).

## The editor

The shortcuts that belong to the editor are the ones of CodeMirror. They are
installed in `src/renderer/src/components/editor/CodeEditor.tsx` and work
while the editor has the focus:

```ts
keymap.of([
  ...closeBracketsKeymap,
  ...defaultKeymap,
  ...searchKeymap,
  ...historyKeymap,
  ...foldKeymap,
  ...completionKeymap,
  ...lintKeymap,
  indentWithTab,
  ...standardKeymap,
]),
```

| Keymap | What it covers |
| --- | --- |
| `closeBracketsKeymap` | Closing brackets and quotes while typing. |
| `defaultKeymap` | The default editing commands of CodeMirror: cursor movement, select all, undo of the last input. |
| `searchKeymap` | The search panel of the editor: open it, find the next or the previous match, select all matches. |
| `historyKeymap` | Undo and redo. |
| `foldKeymap` | Folding and unfolding the code. |
| `completionKeymap` | The completion of the language. |
| `lintKeymap` | The diagnostics of the language. |
| `indentWithTab` | `Tab` indents instead of leaving the editor. |
| `standardKeymap` | The standard editing commands of CodeMirror: indent and outdent, toggle the comment of a line, redo. |

The exact key of each command is defined by the CodeMirror packages in
`node_modules`, not by OpenNotes. `Mod` stands for `Ctrl` on Windows and Linux
and for `Cmd` on macOS.

## Changing a shortcut

### The file of the user

The shortcuts of the user live in `keybindings.json` in the folder of the
settings — the same folder that holds `settings.json`. The path is printed in
the settings dialog (**Settings ▸ Shortcuts**) and is returned by
`window.api.info().userData`.

The format is a flat map of the id of a command and the key combination:

```json
{
  "file.save": "Ctrl+S",
  "edit.gotoLine": "Ctrl+G",
  "file.saveAll": "Ctrl+Alt+S"
}
```

The rules of the parser (`src/renderer/src/core/keybindings.ts`):

* the parts of the combination are separated by `+`;
* `ctrl` (or `control`), `shift`, `alt` (or `option`) and `meta` (or `cmd`,
  `command`, `super`) are the modifiers;
* everything else is the key itself;
* the match is exact: a binding with `Ctrl` only fires when `Ctrl` is pressed
  and `Shift`, `Alt` and `Meta` are not.

The bindings of the user are read at start-up and whenever the active tab
changes (`useKeybindings`). They are checked **first** in the key handler and
the key press is consumed there, so a binding of the user replaces the
shortcut of the command it names.

The file can also be edited by hand: the settings dialog writes it as soon as
a field is changed, and the import button merges a list of
`{"key": "ctrl+s", "command": "..."}` objects (the format of the editor with
the blue logo) into it. `fromVSCode()` translates the names of that format
into the ids of OpenNotes and skips every command it does not know.

### The file of the project

A project can carry its own shortcuts in `.opennotes.json` in the project
folder:

```json
{
  "keybindings": {
    "file.save": "Ctrl+Alt+S",
    "search.findInFiles": "Ctrl+Shift+F"
  }
}
```

The project file wins over the global file (`readKeybindings` merges the two
with `{ ...global, ...project }`).

### The settings dialog

**Settings ▸ Shortcuts** lists every command that has a shortcut and writes
the change into `keybindings.json` immediately. Only the commands that are not
hidden are listed — the list is built from
`getCommands().filter((command) => command.shortcut && !command.hidden)`.

## The commands that only the window binds

The commands below have no accelerator in the native menu. The keymap of the
application binds them, so the declared shortcut works.

| Action | Shortcut | Note |
| --- | --- | --- |
| Reopen closed tab (`file.reopenClosed`) | `Ctrl+Shift+T` | |
| Go to definition (`editor.goToDefinition`) | `F12` | Needs a language server. |
| Find references (`editor.findReferences`) | `Shift+F12` | Needs a language server. |
| Show the integrated terminal (`view.toggleTerminal`) | ``Ctrl+` `` | |
| Zoom in (`view.zoomIn`) | `Ctrl++` | The plus key is understood. |

Two points that were fixed along the way:

* `Ctrl+Shift+F` was declared twice — for `search.findInFiles` and for
  `view.distractionFree`. The distraction free mode moved to `Ctrl+Alt+F`,
  which is what the native menu binds.
* `Alt` with the arrow keys switches the tab on its own. Before, the key
  handler insisted on `Ctrl` before it looked at the arrow keys.
