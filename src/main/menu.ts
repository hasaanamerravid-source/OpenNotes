import { app, Menu, BrowserWindow } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import type { Profile } from '@shared/types'
import { translate, type LocaleId } from '@shared/i18n'

type Cmd = (id: string, payload?: unknown) => void

function send(id: string, payload?: unknown): void {
  const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  win?.webContents.send('menu:command', id, payload)
}

/** The language the native menu is written in. */
let locale: LocaleId = 'en'

/**
 * The keybindings of the user.
 *
 * A command that the user has bound to another key loses the accelerator of
 * the native menu: the shortcut of the user has to win, otherwise the menu
 * would swallow the key before the renderer ever sees it.
 */
let userBindings: Record<string, string> = {}

/** Read the keybindings of the user from the settings folder. */
function readUserBindings(): Record<string, string> {
  try {
    const file = path.join(app.getPath('userData'), 'keybindings.json')
    if (!fs.existsSync(file)) return {}
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const out: Record<string, string> = {}
    for (const [command, shortcut] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof shortcut === 'string' && shortcut.trim()) out[command] = shortcut.trim()
    }
    return out
  } catch {
    return {}
  }
}

/**
 * The accelerator of a command, or nothing when the user has bound the
 * command to another key.
 */
function accelerator(command: string, fallback: string): string | undefined {
  if (userBindings[command]) return undefined
  acceleratorCommands.add(command)
  return fallback
}

/**
 * The commands the native menu binds to a key.
 *
 * The renderer has to know them: a key that the menu handles must not run the
 * command a second time. A command that the user has bound to another key is
 * not in the list, because the menu gave up its accelerator.
 */
const acceleratorCommands = new Set<string>()

/** The commands the native menu binds to a key. */
export function getAcceleratorCommands(): string[] {
  return [...acceleratorCommands]
}

/** The text of a key in the language of the menu. */
function t(key: Parameters<typeof translate>[1], params?: Record<string, string | number>): string {
  return translate(locale, key, params)
}

/** Language ids offered in the Language menu. */
const LANGUAGES: [string, string][] = [
  ['Plain Text', 'text'],
  ['Markdown', 'markdown'],
  ['--- Popular ---', ''],
  ['JavaScript', 'javascript'],
  ['TypeScript', 'typescript'],
  ['JSX', 'jsx'],
  ['TSX', 'tsx'],
  ['JSON', 'json'],
  ['HTML', 'html'],
  ['CSS', 'css'],
  ['SCSS', 'scss'],
  ['Python', 'python'],
  ['Java', 'java'],
  ['C', 'c'],
  ['C++', 'cpp'],
  ['C#', 'csharp'],
  ['F#', 'fsharp'],
  ['Go', 'go'],
  ['Rust', 'rust'],
  ['Kotlin', 'kotlin'],
  ['Swift', 'swift'],
  ['Scala', 'scala'],
  ['Dart', 'dart'],
  ['PHP', 'php'],
  ['SQL', 'sql'],
  ['YAML', 'yaml'],
  ['TOML', 'toml'],
  ['XML', 'xml'],
  ['Shell', 'shell'],
  ['PowerShell', 'powershell'],
  ['Batch', 'batch'],
  ['Ruby', 'ruby'],
  ['Perl', 'perl'],
  ['Lua', 'lua'],
  ['--- Systems ---', ''],
  ['Objective-C', 'objectivec'],
  ['Assembly', 'asm'],
  ['Haskell', 'haskell'],
  ['OCaml', 'ocaml'],
  ['Elixir', 'elixir'],
  ['Erlang', 'erlang'],
  ['Julia', 'julia'],
  ['Nim', 'nim'],
  ['Zig', 'zig'],
  ['Solidity', 'solidity'],
  ['Verilog', 'verilog'],
  ['VHDL', 'vhdl'],
  ['Fortran', 'fortran'],
  ['COBOL', 'cobol'],
  ['Pascal', 'pascal'],
  ['MATLAB', 'matlab'],
  ['R', 'r'],
  ['--- Web & Data ---', ''],
  ['Vue', 'vue'],
  ['Svelte', 'svelte'],
  ['Astro', 'astro'],
  ['GraphQL', 'graphql'],
  ['Terraform / HCL', 'hcl'],
  ['Less', 'less'],
  ['INI', 'ini'],
  ['CSV', 'csv'],
  ['Diff', 'diff'],
  ['Log', 'log'],
  ['RegExp', 'regexp'],
  ['Dockerfile', 'dockerfile'],
  ['Makefile', 'makefile'],
  ['Nginx', 'nginx'],
  ['LaTeX', 'tex'],
  ['Prolog', 'prolog'],
  ['Common Lisp', 'commonlisp'],
  ['Tcl', 'tcl'],
  ['AWK', 'awk'],
  ['Groovy', 'groovy'],
  ['CoffeeScript', 'coffee'],
]

const ENCODINGS: [string, string][] = [
  ['UTF-8', 'utf8'],
  ['UTF-8 with BOM', 'utf8-bom'],
  ['UTF-16 LE', 'utf16-le'],
  ['UTF-16 BE', 'utf16-be'],
  ['Western (ANSI)', 'windows-1252'],
  ['Central European (ANSI)', 'windows-1250'],
  ['Cyrillic (ANSI)', 'windows-1251'],
  ['Greek (ANSI)', 'windows-1253'],
  ['Turkish (ANSI)', 'windows-1254'],
  ['Hebrew (ANSI)', 'windows-1255'],
  ['Arabic (ANSI)', 'windows-1256'],
  ['Thai (ANSI)', 'windows-874'],
  ['Japanese (Shift-JIS)', 'shift_jis'],
  ['Japanese (EUC-JP)', 'euc-jp'],
  ['Chinese Simplified (GBK)', 'gbk'],
  ['Chinese Traditional (Big5)', 'big5'],
  ['Korean (EUC-KR)', 'euc-kr'],
  ['OEM 437', 'cp437'],
  ['ISO 8859-1 (Latin-1)', 'iso-8859-1'],
  ['ISO 8859-2', 'iso-8859-2'],
  ['ISO 8859-15', 'iso-8859-15'],
]

export function buildMenu(
  onReady: (win: BrowserWindow | null) => void,
  profile: Profile = 'all',
  language: LocaleId = 'en',
  bindings?: Record<string, string>,
): void {
  locale = language
  userBindings = bindings ?? readUserBindings()
  acceleratorCommands.clear()
  const showCodeTools = profile !== 'editing'
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: t('native.file'),
      submenu: [
        {
          label: t('cmd.file.new'),
          accelerator: accelerator('file.new', 'CmdOrCtrl+N'),
          click: () => send('file.new'),
        },
        {
          label: t('cmd.file.newWindow'),
          accelerator: accelerator('file.newWindow', 'CmdOrCtrl+Shift+N'),
          click: () => send('file.newWindow'),
        },
        { type: 'separator' },
        {
          label: t('cmd.file.open'),
          accelerator: accelerator('file.open', 'CmdOrCtrl+O'),
          click: () => send('file.open'),
        },
        { label: t('cmd.file.openFromClipboard'), click: () => send('file.openFromClipboard') },
        { label: t('menu.recentFiles'), submenu: [] },
        { type: 'separator' },
        {
          label: t('cmd.file.save'),
          accelerator: accelerator('file.save', 'CmdOrCtrl+S'),
          click: () => send('file.save'),
        },
        {
          label: t('cmd.file.saveAs'),
          accelerator: accelerator('file.saveAs', 'CmdOrCtrl+Shift+S'),
          click: () => send('file.saveAs'),
        },
        {
          label: t('cmd.file.saveAll'),
          accelerator: accelerator('file.saveAll', 'CmdOrCtrl+Alt+S'),
          click: () => send('file.saveAll'),
        },
        { type: 'separator' },
        {
          label: t('cmd.file.close'),
          accelerator: accelerator('file.close', 'CmdOrCtrl+W'),
          click: () => send('file.close'),
        },
        { label: t('cmd.file.closeAll'), click: () => send('file.closeAll') },
        { type: 'separator' },
        { label: t('native.exit'), click: () => app.quit() },
      ],
    },
    {
      label: t('native.edit'),
      submenu: [
        {
          label: t('cmd.edit.undo'),
          accelerator: accelerator('edit.undo', 'CmdOrCtrl+Z'),
          click: () => send('edit.undo'),
        },
        {
          label: t('cmd.edit.redo'),
          accelerator: accelerator('edit.redo', 'CmdOrCtrl+Y'),
          click: () => send('edit.redo'),
        },
        { type: 'separator' },
        { label: t('common.cut'), role: 'cut' },
        { label: t('common.copy'), role: 'copy' },
        { label: t('common.paste'), role: 'paste' },
        {
          label: t('cmd.edit.delete'),
          accelerator: accelerator('edit.delete', 'Delete'),
          click: () => send('edit.delete'),
        },
        {
          label: t('cmd.edit.selectAll'),
          accelerator: accelerator('edit.selectAll', 'CmdOrCtrl+A'),
          click: () => send('edit.selectAll'),
        },
        { type: 'separator' },
        {
          label: t('cmd.search.find'),
          accelerator: accelerator('search.find', 'CmdOrCtrl+F'),
          click: () => send('search.find'),
        },
        {
          label: t('cmd.search.replace'),
          accelerator: accelerator('search.replace', 'CmdOrCtrl+H'),
          click: () => send('search.replace'),
        },
        {
          label: t('cmd.search.findNext'),
          accelerator: accelerator('search.findNext', 'F3'),
          click: () => send('search.findNext'),
        },
        {
          label: t('cmd.search.findPrevious'),
          accelerator: accelerator('search.findPrevious', 'Shift+F3'),
          click: () => send('search.findPrevious'),
        },
        { type: 'separator' },
        {
          label: t('cmd.edit.gotoLine'),
          accelerator: accelerator('edit.gotoLine', 'CmdOrCtrl+G'),
          click: () => send('edit.gotoLine'),
        },
        {
          label: t('cmd.edit.duplicateLine'),
          accelerator: accelerator('edit.duplicateLine', 'CmdOrCtrl+D'),
          click: () => send('edit.duplicateLine'),
        },
        {
          label: t('cmd.edit.deleteLine'),
          accelerator: accelerator('edit.deleteLine', 'CmdOrCtrl+Shift+K'),
          click: () => send('edit.deleteLine'),
        },
        {
          label: t('cmd.edit.moveLineUp'),
          accelerator: accelerator('edit.moveLineUp', 'Alt+Shift+Up'),
          click: () => send('edit.moveLineUp'),
        },
        {
          label: t('cmd.edit.moveLineDown'),
          accelerator: accelerator('edit.moveLineDown', 'Alt+Shift+Down'),
          click: () => send('edit.moveLineDown'),
        },
        {
          label: t('cmd.edit.copyLine'),
          accelerator: accelerator('edit.copyLine', 'CmdOrCtrl+Shift+C'),
          click: () => send('edit.copyLine'),
        },
        { type: 'separator' },
        {
          label: t('cmd.edit.toggleBookmark'),
          accelerator: accelerator('edit.toggleBookmark', 'CmdOrCtrl+F2'),
          click: () => send('edit.toggleBookmark'),
        },
        {
          label: t('cmd.edit.nextBookmark'),
          accelerator: accelerator('edit.nextBookmark', 'F2'),
          click: () => send('edit.nextBookmark'),
        },
        {
          label: t('cmd.edit.prevBookmark'),
          accelerator: accelerator('edit.prevBookmark', 'Shift+F2'),
          click: () => send('edit.prevBookmark'),
        },
        { type: 'separator' },
        {
          label: t('cmd.edit.insertDateTime'),
          accelerator: accelerator('edit.insertDateTime', 'F5'),
          click: () => send('edit.insertDateTime'),
        },
      ],
    },
    {
      label: t('native.search'),
      submenu: [
        {
          label: t('cmd.search.find'),
          accelerator: accelerator('search.find', 'CmdOrCtrl+F'),
          click: () => send('search.find'),
        },
        {
          label: t('cmd.search.replace'),
          accelerator: accelerator('search.replace', 'CmdOrCtrl+H'),
          click: () => send('search.replace'),
        },
        {
          label: t('cmd.search.findInFiles'),
          accelerator: accelerator('search.findInFiles', 'CmdOrCtrl+Shift+F'),
          click: () => send('search.findInFiles'),
        },
        { type: 'separator' },
        {
          label: t('cmd.search.matchBracket'),
          accelerator: accelerator('search.matchBracket', 'CmdOrCtrl+B'),
          click: () => send('search.matchBracket'),
        },
        { label: t('cmd.search.markAll'), click: () => send('search.markAll') },
      ],
    },
    {
      label: t('native.view'),
      submenu: [
        {
          label: t('cmd.view.toggleSidebar'),
          accelerator: accelerator('view.toggleSidebar', 'CmdOrCtrl+Shift+E'),
          click: () => send('view.toggleSidebar'),
        },
        { label: t('cmd.view.toggleStatusBar'), click: () => send('view.toggleStatusBar') },
        {
          label: t('cmd.view.fullscreen'),
          accelerator: accelerator('view.fullscreen', 'F11'),
          click: () => send('view.fullscreen'),
        },
        {
          label: t('cmd.view.toggleSplit'),
          accelerator: accelerator('view.toggleSplit', 'CmdOrCtrl+Alt+S'),
          click: () => send('view.toggleSplit'),
        },
        { type: 'separator' },
        {
          label: t('cmd.view.zoomIn'),
          accelerator: accelerator('view.zoomIn', 'CmdOrCtrl+Plus'),
          click: () => send('view.zoomIn'),
        },
        {
          label: t('cmd.view.zoomOut'),
          accelerator: accelerator('view.zoomOut', 'CmdOrCtrl+-'),
          click: () => send('view.zoomOut'),
        },
        {
          label: t('cmd.view.zoomReset'),
          accelerator: accelerator('view.zoomReset', 'CmdOrCtrl+0'),
          click: () => send('view.zoomReset'),
        },
        { type: 'separator' },
        {
          label: t('cmd.view.toggleWordWrap'),
          accelerator: accelerator('view.toggleWordWrap', 'CmdOrCtrl+Alt+W'),
          click: () => send('view.toggleWordWrap'),
        },
        { label: t('cmd.view.toggleLineNumbers'), click: () => send('view.toggleLineNumbers') },
        { label: t('cmd.view.toggleMinimap'), click: () => send('view.toggleMinimap') },
        { label: t('cmd.view.toggleIndentGuides'), click: () => send('view.toggleIndentGuides') },
        { label: t('cmd.view.toggleInvisibles'), click: () => send('view.toggleInvisibles') },
        { type: 'separator' },
        { label: t('cmd.view.toggleTheme'), click: () => send('view.toggleTheme') },
        {
          label: t('cmd.view.distractionFree'),
          accelerator: accelerator('view.distractionFree', 'CmdOrCtrl+Alt+F'),
          click: () => send('view.distractionFree'),
        },
        { type: 'separator' },
        {
          label: t('cmd.view.commandPalette'),
          accelerator: accelerator('view.commandPalette', 'CmdOrCtrl+Shift+P'),
          click: () => send('view.commandPalette'),
        },
        {
          label: t('cmd.view.quickSwitcher'),
          accelerator: accelerator('view.quickSwitcher', 'CmdOrCtrl+Shift+O'),
          click: () => send('view.quickSwitcher'),
        },
      ],
    },
    {
      label: t('native.format'),
      submenu: [
        { label: t('native.encodeTo', { name: 'UTF-8 (no BOM)' }), click: () => send('format.encode', 'utf8') },
        { label: t('native.encodeTo', { name: 'UTF-8 with BOM' }), click: () => send('format.encode', 'utf8-bom') },
        { label: t('native.encodeTo', { name: 'UTF-16 LE' }), click: () => send('format.encode', 'utf16-le') },
        { label: t('native.encodeTo', { name: 'UTF-16 BE' }), click: () => send('format.encode', 'utf16-be') },
        { label: t('native.encodeTo', { name: 'Western (ANSI)' }), click: () => send('format.encode', 'windows-1252') },
        { type: 'separator' },
        { label: t('native.eolTo', { name: 'LF (Unix)' }), click: () => send('format.eol', '\n') },
        { label: t('native.eolTo', { name: 'CRLF (Windows)' }), click: () => send('format.eol', '\r\n') },
        { label: t('native.eolTo', { name: 'CR (classic Mac)' }), click: () => send('format.eol', '\r') },
        { type: 'separator' },
        { label: t('native.convertTo', { name: 'UTF-8' }), click: () => send('format.convertTo', 'utf8') },
        { label: t('native.convertTo', { name: 'UTF-16 LE' }), click: () => send('format.convertTo', 'utf16-le') },
        { type: 'separator' },
        { label: t('cmd.format.sortAsc'), click: () => send('format.sortAsc') },
        { label: t('cmd.format.sortDesc'), click: () => send('format.sortDesc') },
        { label: t('cmd.format.removeDuplicates'), click: () => send('format.removeDuplicates') },
        { label: t('cmd.format.trimTrailing'), click: () => send('format.trimTrailing') },
        { label: t('cmd.format.joinLines'), click: () => send('format.joinLines') },
        { label: t('cmd.format.upperCase'), click: () => send('format.upperCase') },
        { label: t('cmd.format.lowerCase'), click: () => send('format.lowerCase') },
        { label: t('cmd.format.titleCase'), click: () => send('format.titleCase') },
      ],
    },
    {
      label: t('native.language'),
      submenu: LANGUAGES.map(([label, id]) =>
        id === ''
          ? {
              label: t(
                label.startsWith('--- Popular')
                  ? 'native.languagePopular'
                  : label.startsWith('--- Systems')
                    ? 'native.languageSystems'
                    : 'native.languageWebData',
              ),
              enabled: false,
            }
          : { label, click: () => send('format.setLanguage', id) },
      ),
    },
    {
      label: t('native.encoding'),
      submenu: ENCODINGS.map(([label, id]) => ({
        label,
        click: () => send('format.setEncoding', id),
      })),
    },
    {
      label: t('native.tools'),
      submenu: [
        { label: t('cmd.tools.compare'), click: () => send('tools.compare') },
        { label: t('cmd.tools.macroStart'), click: () => send('tools.macroStart') },
        { label: t('cmd.tools.macroStop'), click: () => send('tools.macroStop') },
        { label: t('cmd.tools.macroPlay'), click: () => send('tools.macroPlay') },
        { type: 'separator' },
        { label: t('cmd.tools.characterMap'), click: () => send('tools.characterMap') },
        { label: t('cmd.tools.openTerminal'), visible: showCodeTools, click: () => send('tools.openTerminal') },
        { type: 'separator' },
        { label: t('cmd.tools.run'), visible: showCodeTools, click: () => send('tools.run') },
      ],
    },
    {
      label: t('native.window'),
      submenu: [
        { label: t('native.minimize'), role: 'minimize' },
        { label: t('native.zoom'), role: 'zoom' },
        { type: 'separator' },
        { label: t('native.closeWindow'), role: 'close' },
      ],
    },
    {
      label: t('native.help'),
      submenu: [
        { label: t('cmd.help.welcome'), click: () => send('help.welcome') },
        { type: 'separator' },
        { label: t('cmd.help.about'), click: () => send('help.about') },
      ],
    },
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
  onReady(BrowserWindow.getAllWindows()[0] ?? null)
  currentProfile = profile
  updateRecentMenu(recentPaths)
  // The renderer has to know which keys the menu handles itself.
  const list = getAcceleratorCommands()
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('menu:accelerators', list)
  }
}

/** The profile the native menu was built for. */
let currentProfile: Profile = 'all'

/** Rebuild the native menu for a different profile. */
export function updateMenuProfile(profile: Profile): void {
  if (profile === currentProfile) return
  currentProfile = profile
  // Rebuild from the template with the new profile.
  buildMenu(() => null, profile, locale, userBindings)
  updateRecentMenu(recentPaths)
}

/** Rebuild the native menu in another language. */
export function updateMenuLocale(language: LocaleId): void {
  if (language === locale) return
  buildMenu(() => null, currentProfile, language, userBindings)
  updateRecentMenu(recentPaths)
}

/**
 * Rebuild the native menu with the keybindings of the user.
 *
 * A command that the user has bound to another key loses the accelerator of
 * the menu: the shortcut of the user has to win.
 */
export function updateMenuKeybindings(bindings: Record<string, string>): void {
  userBindings = bindings ?? {}
  buildMenu(() => null, currentProfile, locale, userBindings)
  updateRecentMenu(recentPaths)
}

/** Remembered recent files so the menu can be rebuilt. */
let recentPaths: string[] = []

/** Refresh the "Recent Files" submenu from the renderer. */
export function updateRecentMenu(paths: string[]): void {
  recentPaths = paths
  const menu = Menu.getApplicationMenu()
  if (!menu) return
  // The first top level menu is the file menu; the recent files are the
  // entry with the translated label.
  const fileMenu = menu.items[0]
  if (!fileMenu) return
  const recent = fileMenu.submenu?.items.find(
    (i) => i.submenu && i.submenu.items.length >= 0 && i.label === t('menu.recentFiles'),
  )
  if (!recent) return
  const items: Electron.MenuItemConstructorOptions[] = paths.length
    ? paths.map((p) => ({ label: p, click: () => send('file.openPath', p) }))
    : [{ label: t('menu.empty'), enabled: false }]
  recent.submenu = Menu.buildFromTemplate(items)
  Menu.setApplicationMenu(menu)
}
