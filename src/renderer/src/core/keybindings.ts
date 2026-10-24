/**
 * The keybindings of the app.
 *
 * The bindings live in a plain text file (`keybindings.json` in the folder of
 * the settings), so they can be copied, changed by hand and put into a
 * project. The project file (`.opennotes.json`) wins over the global one.
 *
 * The format is simple:
 *
 * ```json
 * {
 *   "file.save": "Ctrl+S",
 *   "edit.gotoLine": "Ctrl+G"
 * }
 * ```
 *
 * The bindings of another editor can be imported: a list of
 * `{"key": "ctrl+s", "command": "..."}` objects (the format of the popular
 * editor with the blue logo) is translated with {@link fromVSCode}.
 */

import { useEffect, useState } from 'react'
import { useAppStore } from '../store/app'
import { cachedProjectConfig } from './projectConfig'

/** The shortcuts of the commands, keyed by the id of the command. */
export type Keybindings = Record<string, string>

/** The name of the file the global bindings live in. */
export const KEYBINDINGS_FILE = 'keybindings.json'

/** The commands of the other editor that OpenNotes knows. */
const VS_CODE_COMMANDS: Record<string, string> = {
  'workbench.action.files.newUntitledFile': 'file.new',
  'workbench.action.files.openFile': 'file.open',
  'workbench.action.files.save': 'file.save',
  'workbench.action.files.saveAs': 'file.saveAs',
  'workbench.action.files.saveAll': 'file.saveAll',
  'workbench.action.closeActiveEditor': 'file.close',
  'workbench.action.closeAllEditors': 'file.closeAll',
  'workbench.action.reopenClosedEditor': 'file.reopenClosed',
  'workbench.action.quickOpen': 'view.quickSwitcher',
  'workbench.action.showCommands': 'view.commandPalette',
  'workbench.action.toggleSidebarVisibility': 'view.toggleSidebar',
  'workbench.action.toggleZenMode': 'view.distractionFree',
  'workbench.action.terminal.new': 'view.toggleTerminal',
  'workbench.action.findInFiles': 'search.findInFiles',
  'workbench.action.togglePanel': 'view.toggleStatusBar',
  'actions.find': 'search.find',
  'editor.action.startFindReplaceAction': 'search.replace',
  'editor.action.nextMatchFindAction': 'search.findNext',
  'editor.action.previousMatchFindAction': 'search.findPrevious',
  'editor.action.gotoLine': 'edit.gotoLine',
  'editor.action.duplicateLines': 'edit.duplicateLine',
  'editor.action.deleteLines': 'edit.deleteLine',
  'editor.action.copyLinesDownAction': 'edit.copyLine',
  'editor.action.moveLinesUpAction': 'edit.moveLineUp',
  'editor.action.moveLinesDownAction': 'edit.moveLineDown',
  'editor.action.addCommentLine': 'edit.toggleBookmark',
  'editor.action.revealDefinition': 'editor.goToDefinition',
  'editor.action.goToReferences': 'editor.findReferences',
  'editor.action.formatDocument': 'format.format',
  'editor.action.formatSelection': 'format.format',
  'editor.action.insertLineAfter': 'edit.insertLineAfter',
  'editor.action.insertLineBefore': 'edit.insertLineBefore',
  'editor.action.transformToUppercase': 'format.upperCase',
  'editor.action.transformToLowercase': 'format.lowerCase',
  'editor.action.sortLinesAscending': 'format.sortAsc',
  'editor.action.sortLinesDescending': 'format.sortDesc',
  'editor.action.trimTrailingWhitespace': 'format.trimTrailing',
  'editor.action.joinLines': 'format.joinLines',
  'editor.action.removeDuplicateLines': 'format.removeDuplicates',
  'editor.action.commentLine': 'edit.toggleComment',
  'workbench.action.selectTheme': 'view.toggleTheme',
}

/** The keys of a shortcut, in the order they are written in. */
export interface Shortcut {
  ctrl: boolean
  shift: boolean
  alt: boolean
  meta: boolean
  key: string
}

/** Read a shortcut like "Ctrl+Shift+S". */
export function parseShortcut(shortcut: string): Shortcut | null {
  const parts = shortcut.split('+').map((part) => part.trim())
  // A shortcut can end with a plus: "Ctrl++" is the plus key.
  if (parts.length > 1 && parts[parts.length - 1] === '') {
    parts.pop()
    parts.push('+')
  }
  const named = parts.filter(Boolean)
  if (named.length === 0) return null
  const result: Shortcut = { ctrl: false, shift: false, alt: false, meta: false, key: '' }
  for (const part of named) {
    const lower = part.toLowerCase()
    if (lower === 'ctrl' || lower === 'control') result.ctrl = true
    else if (lower === 'shift') result.shift = true
    else if (lower === 'alt' || lower === 'option') result.alt = true
    else if (lower === 'meta' || lower === 'cmd' || lower === 'command' || lower === 'super') result.meta = true
    else result.key = part
  }
  if (!result.key) return null
  return result
}

/** The shortcut of a keyboard event, e.g. "ctrl+shift+s". */
export function shortcutOf(event: KeyboardEvent): string {
  const parts: string[] = []
  if (event.ctrlKey) parts.push('ctrl')
  if (event.shiftKey) parts.push('shift')
  if (event.altKey) parts.push('alt')
  if (event.metaKey) parts.push('meta')
  parts.push(event.key.toLowerCase())
  return parts.join('+')
}

/** Does the event match the shortcut? */
export function matchesShortcut(event: KeyboardEvent, shortcut: string): boolean {
  const parsed = parseShortcut(shortcut)
  if (!parsed) return false
  if (parsed.ctrl !== event.ctrlKey) return false
  if (parsed.shift !== event.shiftKey) return false
  if (parsed.alt !== event.altKey) return false
  if (parsed.meta !== event.metaKey) return false
  const wanted = parsed.key.length === 1 ? parsed.key.toLowerCase() : parsed.key.toLowerCase()
  const pressed = event.key.length === 1 ? event.key.toLowerCase() : event.key.toLowerCase()
  return wanted === pressed
}

/**
 * Translate the keybindings of the other editor (the format with "key" and
 * "command" objects) into the commands of OpenNotes.
 */
export function fromVSCode(text: string): Keybindings {
  const out: Keybindings = {}
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return out
  }
  const list = Array.isArray(parsed) ? parsed : []
  for (const entry of list) {
    if (!entry || typeof entry !== 'object') continue
    const item = entry as { key?: unknown; command?: unknown }
    const key = typeof item.key === 'string' ? item.key : ''
    const command = typeof item.command === 'string' ? item.command : ''
    if (!key || !command) continue
    // The conditions of the other editor are not supported: a binding that
    // only works in a special situation is skipped.
    const ours = VS_CODE_COMMANDS[command]
    if (!ours) continue
    const shortcut = key
      .split('+')
      .map((part) => {
        const lower = part.trim().toLowerCase()
        if (lower === 'ctrl') return 'Ctrl'
        if (lower === 'shift') return 'Shift'
        if (lower === 'alt') return 'Alt'
        if (lower === 'cmd' || lower === 'meta' || lower === 'super') return 'Meta'
        if (lower === 'space') return 'Space'
        if (lower === 'escape') return 'Escape'
        if (lower === 'enter' || lower === 'return') return 'Enter'
        if (lower === 'tab') return 'Tab'
        if (lower === 'backspace') return 'Backspace'
        if (lower === 'delete') return 'Delete'
        if (lower === 'up') return 'ArrowUp'
        if (lower === 'down') return 'ArrowDown'
        if (lower === 'left') return 'ArrowLeft'
        if (lower === 'right') return 'ArrowRight'
        if (lower === 'home') return 'Home'
        if (lower === 'end') return 'End'
        if (lower === 'pageup') return 'PageUp'
        if (lower === 'pagedown') return 'PageDown'
        return part.trim().length === 1 ? part.trim().toUpperCase() : part.trim()
      })
      .join('+')
    out[ours] = shortcut
  }
  return out
}

/** The folder the settings and the keybindings live in. */
let userDataFolder = ''

/** Remember the folder of the settings. */
export function setUserDataFolder(folder: string): void {
  userDataFolder = folder
}

/** The folder of the settings (it is asked for once). */
export async function ensureUserDataFolder(): Promise<string> {
  if (userDataFolder) return userDataFolder
  try {
    const info = await window.api.info()
    userDataFolder = info.userData ?? ''
  } catch {
    /* the info is optional */
  }
  return userDataFolder
}

/** The path of the global keybindings file. */
export function keybindingsPath(): string {
  return userDataFolder ? `${userDataFolder}\\${KEYBINDINGS_FILE}` : KEYBINDINGS_FILE
}

/** Read the keybindings of the app (the global file and the project file). */
export async function readKeybindings(): Promise<Keybindings> {
  await ensureUserDataFolder()
  let global: Keybindings = {}
  try {
    const text = await window.api.fs.readTextFile(keybindingsPath())
    const parsed = JSON.parse(text) as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      for (const [command, shortcut] of Object.entries(parsed as Record<string, unknown>)) {
        if (typeof shortcut === 'string' && shortcut.trim()) global[command] = shortcut.trim()
      }
    }
  } catch {
    /* there is no keybindings file yet */
  }
  const project = cachedProjectConfig()?.keybindings
  return project ? { ...global, ...project } : global
}

/** Write the global keybindings file. */
export async function writeKeybindings(bindings: Keybindings): Promise<void> {
  const text = `${JSON.stringify(bindings, null, 2)}\n`
  await window.api.fs.writeTextFile(keybindingsPath(), text)
  // The native menu has to know: a command that the user has bound to
  // another key loses its accelerator, otherwise the menu would swallow the
  // key before the renderer ever sees it.
  try {
    await window.api.menu.setKeybindings(bindings)
  } catch {
    /* the menu is a nice-to-have, the shortcuts work without it */
  }
}

/** The keybindings that are in use right now. */
let currentBindings: Keybindings = {}

/** Remember the bindings (the keyboard handler needs them right away). */
export function setKeybindings(bindings: Keybindings): void {
  currentBindings = bindings
}

/** The bindings that are in use right now (without waiting for the file). */
export function readKeybindingsSync(): Keybindings {
  return currentBindings
}

/** The keybindings that are in use right now. */
export function useKeybindings(): Keybindings {
  const [bindings, setBindings] = useState<Keybindings>(currentBindings)
  const activeTabId = useAppStore((s) => s.activeTabId)
  useEffect(() => {
    let cancelled = false
    void readKeybindings().then((loaded) => {
      if (cancelled) return
      setKeybindings(loaded)
      setBindings(loaded)
    })
    return () => {
      cancelled = true
    }
  }, [activeTabId])
  return bindings
}
