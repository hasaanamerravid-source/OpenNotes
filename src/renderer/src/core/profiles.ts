import type { Profile } from '@shared/types'

export interface ProfileInfo {
  id: Profile
  label: string
  description: string
  /** Short badge shown in the title bar. */
  badge: string
}

export const PROFILES: ProfileInfo[] = [
  {
    id: 'editing',
    label: 'Text editing',
    description: 'Notepad style: documents, formatting and the tools you need to write.',
    badge: 'Editing',
  },
  {
    id: 'coding',
    label: 'Coding',
    description: 'IDE style: navigation, code tools, language modes and project views.',
    badge: 'Coding',
  },
  {
    id: 'all',
    label: 'Everything',
    description: 'All panels and commands at once — the full OpenNotes feature set.',
    badge: 'Full',
  },
]

export function profileInfo(id: Profile): ProfileInfo {
  return PROFILES.find((p) => p.id === id) ?? PROFILES[2]
}

/** Panels of the sidebar that belong to a profile. */
export function panelAllowed(profile: Profile, panel: string): boolean {
  switch (panel) {
    case 'files':
    case 'search':
    case 'outline':
    case 'problems':
    case 'run':
    case 'plugins':
      // The code tools are always available.
      return true
    default:
      return true
  }
}

/** Extra toolbar entries of the title bar for a profile. */
export function toolbarForProfile(profile: Profile): string[] {
  if (profile === 'editing') return ['new', 'open', 'save', 'palette']
  if (profile === 'coding') return ['new', 'open', 'save', 'search', 'palette', 'run', 'split']
  return ['new', 'open', 'save', 'search', 'palette', 'run', 'split', 'settings']
}

/** Whether the code oriented menus are shown. */
export function showsCodeTools(profile: Profile): boolean {
  return profile !== 'editing'
}
