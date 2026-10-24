import type { Profile } from '@shared/types'

export interface MenuItem {
  /** Command id that is executed. */
  id: string
  label: string
  /** Optional keyboard shortcut shown on the right. */
  shortcut?: string
  /** Render as a separator line. */
  separator?: boolean
  /** Disabled entries. */
  disabled?: boolean
  /** Sub entries (rendered as a sub menu). */
  items?: MenuItem[]
}

export interface MenuSection {
  /** Section id, also used as the command prefix. */
  id: string
  label: string
  items: MenuItem[]
}

/** Every profile. */
const ALL_PROFILES: Profile[] = ['editing', 'coding', 'all']

/** Build a separator line. */
function sep(id: string): MenuItem {
  return { id, label: '', separator: true }
}

/** Which profiles show a top level section. */
const SECTION_PROFILES: Record<string, Profile[]> = {
  file: ALL_PROFILES,
  edit: ALL_PROFILES,
  view: ALL_PROFILES,
  navigate: ['coding', 'all'],
  code: ['coding', 'all'],
  format: ALL_PROFILES,
  tools: ALL_PROFILES,
  window: ['all'],
  help: ALL_PROFILES,
}

/** Items that only make sense in some profiles. */
const ITEM_PROFILES: Record<string, Profile[]> = {
  'view.toggleMinimap': ['coding', 'all'],
  'view.toggleIndentGuides': ['coding', 'all'],
  'view.toggleInvisibles': ['coding', 'all'],
  'view.toggleSplit': ['coding', 'all'],
  'tools.openTerminal': ['coding', 'all'],
  'tools.run': ['coding', 'all'],
  'edit.toggleBookmark': ['coding', 'all'],
  'edit.duplicateLine': ['coding', 'all'],
  'edit.deleteLine': ['coding', 'all'],
  'edit.moveLineUp': ['coding', 'all'],
  'edit.moveLineDown': ['coding', 'all'],
  'edit.copyLine': ['coding', 'all'],
  'search.markAll': ['coding', 'all'],
  'search.matchBracket': ['coding', 'all'],
}

/** Items that move to another section depending on the profile. */
const HIDDEN_ITEMS: Record<Profile, Record<string, string[]>> = {
  editing: {},
  coding: {},
  all: {
    view: ['view.toggleSidebar', 'view.toggleStatusBar', 'view.distractionFree'],
  },
}

/** All sections, ordered the way a modern IDE orders its main menu. */
export const MENU_SECTIONS: MenuSection[] = [
  {
    id: 'file',
    label: 'File',
    items: [
      { id: 'file.new', label: 'New', shortcut: 'Ctrl+N' },
      { id: 'file.newWindow', label: 'New Window' },
      sep('file.sep1'),
      { id: 'file.open', label: 'Open…', shortcut: 'Ctrl+O' },
      { id: 'file.openFromClipboard', label: 'Open Path from Clipboard' },
      sep('file.sep2'),
      { id: 'file.save', label: 'Save', shortcut: 'Ctrl+S' },
      { id: 'file.saveAs', label: 'Save As…', shortcut: 'Ctrl+Shift+S' },
      { id: 'file.saveAll', label: 'Save All' },
      sep('file.sep3'),
      { id: 'file.close', label: 'Close', shortcut: 'Ctrl+W' },
      { id: 'file.closeAll', label: 'Close All' },
      { id: 'file.reopenClosed', label: 'Reopen Closed Tab', shortcut: 'Ctrl+Shift+T' },
    ],
  },
  {
    id: 'edit',
    label: 'Edit',
    items: [
      { id: 'edit.undo', label: 'Undo', shortcut: 'Ctrl+Z' },
      { id: 'edit.redo', label: 'Redo', shortcut: 'Ctrl+Y' },
      sep('edit.sep1'),
      { id: 'edit.delete', label: 'Delete Selection' },
      { id: 'edit.selectAll', label: 'Select All', shortcut: 'Ctrl+A' },
      sep('edit.sep2'),
      { id: 'edit.gotoLine', label: 'Go to Line…', shortcut: 'Ctrl+G' },
      { id: 'edit.insertDateTime', label: 'Insert Date/Time', shortcut: 'F5' },
      sep('edit.sep3'),
      { id: 'search.find', label: 'Find…', shortcut: 'Ctrl+F' },
      { id: 'search.replace', label: 'Replace…', shortcut: 'Ctrl+H' },
      { id: 'search.findNext', label: 'Find Next', shortcut: 'F3' },
      { id: 'search.findPrevious', label: 'Find Previous', shortcut: 'Shift+F3' },
    ],
  },
  {
    id: 'view',
    label: 'View',
    items: [
      { id: 'view.toggleSidebar', label: 'Toggle Sidebar', shortcut: 'Ctrl+Shift+E' },
      { id: 'view.toggleStatusBar', label: 'Toggle Status Bar' },
      sep('view.sep1'),
      { id: 'view.toggleWordWrap', label: 'Toggle Word Wrap' },
      { id: 'view.toggleLineNumbers', label: 'Toggle Line Numbers' },
      { id: 'view.toggleMinimap', label: 'Toggle Minimap' },
      sep('view.sep2'),
      { id: 'view.toggleTheme', label: 'Toggle Dark / Light Theme' },
      { id: 'view.distractionFree', label: 'Distraction Free Mode' },
      sep('view.sep3'),
      { id: 'view.commandPalette', label: 'Command Palette…', shortcut: 'Ctrl+Shift+P' },
      { id: 'view.quickSwitcher', label: 'Quick Switcher…', shortcut: 'Ctrl+Shift+O' },
    ],
  },
  {
    id: 'navigate',
    label: 'Navigate',
    items: [
      { id: 'search.findInFiles', label: 'Find in Files…', shortcut: 'Ctrl+Shift+F' },
      { id: 'view.quickSwitcher', label: 'Quick Switcher…', shortcut: 'Ctrl+Shift+O' },
      { id: 'view.commandPalette', label: 'Command Palette…', shortcut: 'Ctrl+Shift+P' },
      sep('navigate.sep1'),
      { id: 'edit.gotoLine', label: 'Go to Line…', shortcut: 'Ctrl+G' },
      sep('navigate.sep2'),
      { id: 'edit.nextBookmark', label: 'Next Bookmark', shortcut: 'F2' },
      { id: 'edit.prevBookmark', label: 'Previous Bookmark', shortcut: 'Shift+F2' },
    ],
  },
  {
    id: 'code',
    label: 'Code',
    items: [
      { id: 'edit.toggleBookmark', label: 'Toggle Bookmark', shortcut: 'Ctrl+F2' },
      sep('code.sep1'),
      { id: 'edit.duplicateLine', label: 'Duplicate Line', shortcut: 'Ctrl+D' },
      { id: 'edit.deleteLine', label: 'Delete Line', shortcut: 'Ctrl+Shift+K' },
      { id: 'edit.copyLine', label: 'Copy Line', shortcut: 'Ctrl+Shift+C' },
      sep('code.sep2'),
      { id: 'edit.moveLineUp', label: 'Move Line Up', shortcut: 'Alt+Shift+Up' },
      { id: 'edit.moveLineDown', label: 'Move Line Down', shortcut: 'Alt+Shift+Down' },
      sep('code.sep3'),
      { id: 'format.setLanguage', label: 'Set Language…' },
      { id: 'format.setEncoding', label: 'Set Encoding…' },
      sep('code.sep4'),
      { id: 'search.matchBracket', label: 'Go to Matching Bracket', shortcut: 'Ctrl+B' },
      { id: 'search.markAll', label: 'Mark All Occurrences' },
      sep('code.sep5'),
      { id: 'view.toggleSplit', label: 'Toggle Split View', shortcut: 'Ctrl+Alt+S' },
      { id: 'view.toggleInvisibles', label: 'Toggle Invisibles' },
      { id: 'view.toggleIndentGuides', label: 'Toggle Indent Guides' },
    ],
  },
  {
    id: 'format',
    label: 'Format',
    items: [
      { id: 'format.setLanguage', label: 'Set Language…' },
      { id: 'format.setEncoding', label: 'Set Encoding…' },
      { id: 'format.encode', label: 'Encode with…' },
      { id: 'format.convertTo', label: 'Convert File Encoding to…' },
      { id: 'format.eol', label: 'Convert Line Endings to…' },
      sep('format.sep1'),
      { id: 'format.sortAsc', label: 'Sort Lines Ascending' },
      { id: 'format.sortDesc', label: 'Sort Lines Descending' },
      { id: 'format.removeDuplicates', label: 'Remove Duplicate Lines' },
      { id: 'format.trimTrailing', label: 'Trim Trailing Whitespace' },
      { id: 'format.joinLines', label: 'Join Lines' },
      sep('format.sep2'),
      { id: 'format.upperCase', label: 'UPPERCASE' },
      { id: 'format.lowerCase', label: 'lowercase' },
      { id: 'format.titleCase', label: 'Title Case' },
    ],
  },
  {
    id: 'tools',
    label: 'Tools',
    items: [
      { id: 'tools.compare', label: 'Compare with Another File…' },
      sep('tools.sep1'),
      { id: 'tools.macroStart', label: 'Start Recording Macro' },
      { id: 'tools.macroStop', label: 'Stop Recording Macro' },
      { id: 'tools.macroPlay', label: 'Play Macro…' },
      sep('tools.sep2'),
      { id: 'tools.characterMap', label: 'Character Map…' },
      { id: 'tools.openTerminal', label: 'Open Terminal Here' },
      { id: 'tools.run', label: 'Run Current File' },
    ],
  },
  {
    id: 'window',
    label: 'Window',
    items: [
      { id: 'view.toggleSidebar', label: 'Toggle Sidebar', shortcut: 'Ctrl+Shift+E' },
      { id: 'view.toggleStatusBar', label: 'Toggle Status Bar' },
      { id: 'view.fullscreen', label: 'Toggle Full Screen', shortcut: 'F11' },
      sep('window.sep1'),
      { id: 'view.zoomIn', label: 'Zoom In', shortcut: 'Ctrl++' },
      { id: 'view.zoomOut', label: 'Zoom Out', shortcut: 'Ctrl+-' },
      { id: 'view.zoomReset', label: 'Reset Zoom', shortcut: 'Ctrl+0' },
      sep('window.sep2'),
      { id: 'view.distractionFree', label: 'Distraction Free Mode' },
    ],
  },
  {
    id: 'help',
    label: 'Help',
    items: [
      { id: 'help.welcome', label: 'Welcome & Keyboard Shortcuts' },
      { id: 'help.about', label: 'About OpenNotes' },
    ],
  },
]

/** Items of a section for a profile. */
export function itemsForProfile(section: MenuSection, profile: Profile): MenuItem[] {
  const allowed = SECTION_PROFILES[section.id] ?? ALL_PROFILES
  if (!allowed.includes(profile)) return []
  const hidden = HIDDEN_ITEMS[profile]?.[section.id] ?? []
  return section.items.filter((item) => {
    if (hidden.includes(item.id)) return false
    const itemAllowed = ITEM_PROFILES[item.id]
    if (itemAllowed && !itemAllowed.includes(profile)) return false
    return true
  })
}

/** Sections that belong to a profile. */
export function sectionsForProfile(profile: Profile): MenuSection[] {
  return MENU_SECTIONS.filter((section) => (SECTION_PROFILES[section.id] ?? ALL_PROFILES).includes(profile)).map(
    (section) => ({
      ...section,
      items: itemsForProfile(section, profile),
    }),
  )
}
