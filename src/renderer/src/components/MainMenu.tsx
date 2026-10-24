import type { JSX, KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent } from 'react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Profile } from '@shared/types'
import { itemsForProfile, sectionsForProfile } from '../core/menuStructure'
import type { MenuItem, MenuSection } from '../core/menuStructure'
import { commandKey, sectionKey, useTWith } from '../core/i18n'

export interface MainMenuProps {
  open: boolean
  onClose: () => void
  profile: Profile
  /** Execute a command by id. */
  onCommand: (id: string, payload?: unknown) => void
  /** Where the panel is anchored (the hamburger button). */
  anchor?: 'left' | 'right'
  className?: string
}

/** Styles for the menu. Plain CSS, scoped to `.main-menu`. */
const MENU_CSS = `
.main-menu {
  position: fixed;
  inset: 0;
  z-index: 1200;
}
.main-menu-panel {
  position: absolute;
  top: 6px;
  min-width: 200px;
  max-width: 340px;
  padding: 5px;
  display: flex;
  flex-direction: column;
  gap: 1px;
  border-radius: 10px;
  border: 1px solid var(--border-strong, #45475a);
  background: var(--bg-elevated, #181825);
  box-shadow: 0 18px 44px rgba(0, 0, 0, 0.45);
  color: var(--fg, #cdd6f4);
  font-family: var(--font-ui);
  font-size: 13px;
  outline: none;
  user-select: none;
}
.main-menu-left .main-menu-panel { left: 8px; }
.main-menu-right .main-menu-panel { right: 8px; }
.main-menu-section {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 6px 10px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.main-menu-section:hover,
.main-menu-highlight {
  background: var(--bg-active, #34344a);
  color: var(--fg, #cdd6f4);
}
.main-menu-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 5px 10px;
  border-radius: 6px;
  cursor: pointer;
  color: var(--fg-dim, #a6adc8);
  white-space: nowrap;
}
.main-menu-item:hover {
  background: var(--bg-hover, #2b2b3d);
}
.main-menu-item.main-menu-highlight {
  background: var(--bg-active, #34344a);
  color: var(--fg, #cdd6f4);
}
.main-menu-item-disabled {
  opacity: 0.45;
  cursor: default;
}
.main-menu-item-label {
  flex: 1 1 auto;
  overflow: hidden;
  text-overflow: ellipsis;
}
.main-menu-item-shortcut {
  flex: 0 0 auto;
  margin-left: 18px;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--fg-muted, #6b7089);
}
.main-menu-separator {
  height: 1px;
  margin: 4px 8px;
  background: var(--border, #313244);
}
.main-menu-submenu {
  position: absolute;
  left: 100%;
  top: 0;
  min-width: 230px;
  max-height: calc(100vh - 24px);
  overflow-y: auto;
  padding: 5px;
  border-radius: 10px;
  border: 1px solid var(--border-strong, #45475a);
  background: var(--bg-elevated, #181825);
  box-shadow: 0 18px 44px rgba(0, 0, 0, 0.45);
  color: var(--fg, #cdd6f4);
  z-index: 1;
}
`

/** True when the entry can be highlighted and executed. */
function isSelectable(item: MenuItem | undefined): item is MenuItem {
  return !!item && !item.separator && !item.disabled
}

/** Index of the first entry that can be highlighted. */
function firstEnabledIndex(items: MenuItem[]): number {
  const index = items.findIndex((item) => isSelectable(item))
  return index >= 0 ? index : 0
}

/** Next entry that can be highlighted, skipping separators and disabled rows. */
function stepIndex(items: MenuItem[], from: number, dir: 1 | -1): number {
  if (!items.length) return 0
  let index = from
  for (let step = 0; step < items.length; step++) {
    index = (index + dir + items.length) % items.length
    if (isSelectable(items[index])) return index
  }
  return from
}

export function MainMenu({
  open,
  onClose,
  profile,
  onCommand,
  anchor = 'left',
  className,
}: MainMenuProps): JSX.Element | null {
  const sections = useMemo(() => sectionsForProfile(profile), [profile])
  const t = useTWith()
  const [activeSection, setActiveSection] = useState(0)
  const [openSection, setOpenSection] = useState<number | null>(null)
  const [itemIndex, setItemIndex] = useState(0)
  const [nestedId, setNestedId] = useState<string | null>(null)
  const [subTop, setSubTop] = useState(0)
  const [nestedTop, setNestedTop] = useState(0)
  const [nestedLeft, setNestedLeft] = useState(0)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const subRef = useRef<HTMLDivElement | null>(null)
  const sectionRefs = useRef<(HTMLButtonElement | null)[]>([])
  const itemRefs = useRef<(HTMLDivElement | null)[]>([])
  const nestedItemRefs = useRef<(HTMLDivElement | null)[]>([])

  const openSectionData = useMemo<MenuSection | undefined>(
    () => (openSection === null ? undefined : sections[openSection]),
    [openSection, sections],
  )
  const openItems = useMemo<MenuItem[]>(
    () => (openSectionData ? itemsForProfile(openSectionData, profile) : []),
    [openSectionData, profile],
  )
  const nestedItems = useMemo<MenuItem[]>(() => {
    const parent = openItems.find((item) => item.id === nestedId)
    return parent?.items ?? []
  }, [openItems, nestedId])

  /* --------------------------- open / reset --------------------------- */

  useEffect(() => {
    if (!open) return
    setActiveSection(0)
    setOpenSection(null)
    setItemIndex(0)
    setNestedId(null)
    const frame = window.requestAnimationFrame(() => panelRef.current?.focus())
    return () => window.cancelAnimationFrame(frame)
  }, [open])

  useEffect(() => {
    if (openSection !== null && openSection >= sections.length) setOpenSection(null)
  }, [openSection, sections])

  /* ----------------------------- measuring ---------------------------- */

  const measure = useCallback((): void => {
    const panel = panelRef.current
    if (!panel) return
    const base = panel.getBoundingClientRect()
    if (openSection !== null) {
      const button = sectionRefs.current[openSection]
      if (button) {
        let top = Math.round(button.getBoundingClientRect().top - base.top)
        const sub = subRef.current
        if (sub) {
          // Keep the fly out inside the window.
          const room = window.innerHeight - sub.offsetHeight - 12 - base.top
          top = Math.max(0, Math.min(top, room))
        }
        setSubTop(top)
      }
    }
    if (nestedId) {
      const index = openItems.findIndex((item) => item.id === nestedId)
      const row = index >= 0 ? itemRefs.current[index] : null
      if (row) {
        setNestedTop(Math.round(row.getBoundingClientRect().top - base.top))
        setNestedLeft(Math.round(base.width))
      }
    }
  }, [openSection, nestedId, openItems])

  useLayoutEffect(() => {
    measure()
  }, [measure])

  useEffect(() => {
    if (!open) return
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [open, measure])

  /* ------------------------------ actions ----------------------------- */

  const runItem = (item: MenuItem | undefined): void => {
    if (!isSelectable(item)) return
    if (item.items && item.items.length > 0) {
      setNestedId(item.id)
      return
    }
    onCommand(item.id)
    onClose()
  }

  const openSubmenu = (index: number): void => {
    const section = sections[index]
    if (!section) return
    const items = itemsForProfile(section, profile)
    setActiveSection(index)
    setOpenSection(index)
    setNestedId(null)
    setItemIndex(firstEnabledIndex(items))
  }

  /* ------------------------------ keyboard ---------------------------- */

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>): void => {
    const key = event.key
    if (key === 'Escape' || key === 'Tab') {
      event.preventDefault()
      event.stopPropagation()
      onClose()
      return
    }
    if (key === 'ArrowDown' || key === 'ArrowUp') {
      event.preventDefault()
      const dir = key === 'ArrowDown' ? 1 : -1
      if (openSection === null) {
        openSubmenu(sections.length ? (dir === 1 ? 0 : sections.length - 1) : 0)
        return
      }
      setItemIndex((current) => stepIndex(openItems, current, dir))
      setNestedId(null)
      return
    }
    if (key === 'ArrowRight') {
      if (openSection === null) {
        event.preventDefault()
        openSubmenu(activeSection)
      }
      return
    }
    if (key === 'ArrowLeft') {
      if (openSection !== null) {
        event.preventDefault()
        setOpenSection(null)
        setNestedId(null)
      }
      return
    }
    if (key === 'Enter') {
      event.preventDefault()
      if (openSection === null) {
        openSubmenu(activeSection)
        return
      }
      runItem(openItems[itemIndex])
    }
  }

  /* ------------------------------ rendering --------------------------- */

  if (!open) return null

  const rootClass = ['main-menu', `main-menu-${anchor}`, className].filter(Boolean).join(' ')

  const renderRow = (item: MenuItem, index: number, nested: boolean): JSX.Element => {
    if (item.separator) {
      return <div key={`${item.id}-${index}`} className="main-menu-separator" role="separator" />
    }
    const highlighted = index === itemIndex
    const hasChildren = !!item.items && item.items.length > 0
    const setRef = (el: HTMLDivElement | null): void => {
      if (nested) nestedItemRefs.current[index] = el
      else itemRefs.current[index] = el
    }
    return (
      <div
        key={`${item.id}-${index}`}
        ref={setRef}
        role="menuitem"
        aria-disabled={item.disabled ? true : undefined}
        className={[
          'main-menu-item',
          highlighted ? 'main-menu-highlight' : '',
          item.disabled ? 'main-menu-item-disabled' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        onMouseEnter={() => {
          setItemIndex(index)
          setNestedId(hasChildren ? item.id : null)
        }}
        onClick={() => runItem(item)}
      >
        <span className="main-menu-item-label">{t(commandKey(item.id), item.label)}</span>
        {item.shortcut && <span className="main-menu-item-shortcut kbd">{item.shortcut}</span>}
        {hasChildren && <span className="main-menu-item-shortcut">›</span>}
      </div>
    )
  }

  return (
    <div
      className={rootClass}
      onMouseDown={(event: ReactMouseEvent<HTMLDivElement>) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <style href="opennotes-main-menu" precedence="opennotes-main-menu">
        {MENU_CSS}
      </style>
      <div
        ref={panelRef}
        className="main-menu-panel"
        role="menubar"
        aria-label="Main menu"
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        onMouseDown={(event: ReactMouseEvent<HTMLDivElement>) => event.stopPropagation()}
      >
        {sections.map((section, index) => (
          <button
            key={section.id}
            ref={(el) => {
              sectionRefs.current[index] = el
            }}
            type="button"
            role="menuitem"
            aria-haspopup="menu"
            aria-expanded={openSection === index}
            tabIndex={-1}
            className={[
              'main-menu-section',
              openSection === index ? 'main-menu-highlight' : '',
              activeSection === index && openSection === null ? 'main-menu-highlight' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => openSubmenu(index)}
            onMouseEnter={() => openSubmenu(index)}
          >
            <span className="main-menu-item-label">{t(sectionKey(section.id), section.label)}</span>
            <span className="main-menu-item-shortcut">›</span>
          </button>
        ))}

        {openSectionData && (
          <div
            ref={subRef}
            className="main-menu-submenu"
            role="menu"
            aria-label={openSectionData.label}
            style={{ top: subTop }}
          >
            {openItems.map((item, index) => renderRow(item, index, false))}
          </div>
        )}

        {nestedId && nestedItems.length > 0 && (
          <div
            className="main-menu-submenu"
            role="menu"
            aria-label={nestedId}
            style={{ top: nestedTop, left: nestedLeft }}
          >
            {nestedItems.map((item, index) => renderRow(item, index, true))}
          </div>
        )}
      </div>
    </div>
  )
}
