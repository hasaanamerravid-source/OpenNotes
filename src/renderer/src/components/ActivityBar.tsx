import type { JSX } from 'react'
import { Icon, type IconName } from './Icons'
import { useAppStore, type SidePanel } from '../store/app'
import { panelAllowed } from '../core/profiles'
import { useT, type MessageKey } from '../core/i18n'

interface Entry {
  id: SidePanel
  /** The message that holds the name of the tool window. */
  key: MessageKey
  icon: IconName
}

/** The tool windows that get their own icon in the activity bar. */
const PRIMARY: Entry[] = [
  { id: 'files', key: 'panel.files', icon: 'explorer' },
  { id: 'search', key: 'panel.search', icon: 'search' },
  { id: 'outline', key: 'panel.structure', icon: 'outline' },
  { id: 'problems', key: 'panel.problems', icon: 'problems' },
  { id: 'run', key: 'panel.run', icon: 'terminal' },
  { id: 'plugins', key: 'panel.plugins', icon: 'plugins' },
]

export function ActivityBar(): JSX.Element {
  const panel = useAppStore((s) => s.sidePanel)
  const setPanel = useAppStore((s) => s.setSidePanel)
  const profile = useAppStore((s) => s.settings.profile)
  const t = useT()

  // The profile decides which tool windows are offered.
  const primary = PRIMARY.filter((entry) => panelAllowed(profile, entry.id))

  return (
    <nav className="activity-bar" aria-label={t('a11y.activityBar')}>
      {primary.map((entry) => (
        <button
          key={entry.id}
          className={`activity-item ${panel === entry.id ? 'active' : ''}`}
          title={t(entry.key)}
          aria-label={t(entry.key)}
          aria-pressed={panel === entry.id}
          onClick={() => setPanel(entry.id)}
        >
          <Icon name={entry.icon} size={19} />
        </button>
      ))}
      <div className="activity-spacer" />
    </nav>
  )
}
