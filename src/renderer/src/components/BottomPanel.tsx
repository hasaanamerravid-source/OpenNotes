import { useRef, useState } from 'react'
import type { JSX } from 'react'
import { Icon, type IconName } from './Icons'

export type BottomTab = 'problems' | 'run' | 'terminal'

export interface BottomPanelProps {
  tabs: { id: BottomTab; label: string; icon: IconName; count?: number }[]
  active: BottomTab
  onSelect: (tab: BottomTab) => void
  onClose: () => void
  children: React.ReactNode
}

/** A resizable panel at the bottom of the window, like an IDE tool window. */
export function BottomPanel({ tabs, active, onSelect, onClose, children }: BottomPanelProps): JSX.Element {
  const [height, setHeight] = useState(240)
  const dragging = useRef(false)

  const startResize = (event: React.MouseEvent): void => {
    event.preventDefault()
    dragging.current = true
    const startY = event.clientY
    const startHeight = height
    const move = (e: MouseEvent): void => {
      if (!dragging.current) return
      const next = Math.max(120, Math.min(560, startHeight - (e.clientY - startY)))
      setHeight(next)
    }
    const up = (): void => {
      dragging.current = false
      document.removeEventListener('mousemove', move)
      document.removeEventListener('mouseup', up)
    }
    document.addEventListener('mousemove', move)
    document.addEventListener('mouseup', up)
  }

  return (
    <section className="bottom-panel" style={{ height }}>
      <div className="bottom-panel-resizer" onMouseDown={startResize} />
      <header className="bottom-panel-header">
        <div className="bottom-panel-tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`bottom-tab ${active === tab.id ? 'active' : ''}`}
              onClick={() => onSelect(tab.id)}
            >
              <Icon name={tab.icon} size={13} />
              {tab.label}
              {typeof tab.count === 'number' && tab.count > 0 && <span className="bottom-tab-count">{tab.count}</span>}
            </button>
          ))}
        </div>
        <button className="icon-btn" title="Close panel" onClick={onClose}>
          <Icon name="close" size={12} />
        </button>
      </header>
      <div className="bottom-panel-body">{children}</div>
    </section>
  )
}
