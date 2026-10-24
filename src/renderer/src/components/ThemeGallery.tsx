import type { JSX } from 'react'
import { themeGroups, resolveTheme } from '../core/themeResolver'

export interface ThemeGalleryProps {
  value: string
  onChange: (id: string) => void
}

/** A grid of every available colour theme with a small preview. */
export function ThemeGallery({ value, onChange }: ThemeGalleryProps): JSX.Element {
  const groups = themeGroups()
  return (
    <div>
      {groups.map((group) => (
        <div key={group.group} style={{ marginBottom: 14 }}>
          <div className="panel-header">
            <span>{group.group}</span>
            <span>{group.themes.length}</span>
          </div>
          <div className="theme-gallery">
            {group.themes.map((theme) => {
              const full = resolveTheme(theme.id)
              const selected = theme.id === value
              return (
                <button
                  key={theme.id}
                  className={`theme-card ${selected ? 'active' : ''}`}
                  onClick={() => onChange(theme.id)}
                  title={theme.label}
                >
                  <span
                    className="theme-card-preview"
                    style={{ background: full.editor.background, color: full.editor.foreground }}
                  >
                    <span style={{ color: full.tokens.keyword }}>if</span>{' '}
                    <span style={{ color: full.tokens.function }}>run</span>
                    <span style={{ color: full.tokens.punctuation }}>(</span>
                    <span style={{ color: full.tokens.number }}>42</span>
                    <span style={{ color: full.tokens.punctuation }}>)</span>{' '}
                    <span style={{ color: full.tokens.string }}>'hi'</span>
                  </span>
                  <span className="theme-card-name">{theme.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
