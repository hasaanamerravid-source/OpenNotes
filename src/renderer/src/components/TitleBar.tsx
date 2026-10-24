import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { JSX } from 'react'
import { useAppStore } from '../store/app'
import { useStatusStore } from '../store/status'
import { runCommand } from '../core/commands'
import { MainMenu } from './MainMenu'
import { AppLogo } from './AppLogo'
import { Icon } from './Icons'
import { FileIcon } from './FileIcon'
import { useT } from '../core/i18n'

export function TitleBar(): JSX.Element {
  const tabs = useAppStore((s) => s.tabs)
  const activeTabId = useAppStore((s) => s.activeTabId)
  const sidebarVisible = useAppStore((s) => s.sidebarVisible)
  const settings = useAppStore((s) => s.settings)
  const setActiveTab = useAppStore((s) => s.setActiveTab)
  const closeTab = useAppStore((s) => s.closeTab)
  const newTab = useAppStore((s) => s.newTab)
  const iconTheme = useAppStore((s) => s.settings.iconTheme)
  const [menuOpen, setMenuOpen] = useState(false)
  const maximized = useStatusStore((s) => s.maximized)
  const active = tabs.find((t) => t.id === activeTabId)
  const showHamburger = settings.mainMenuStyle !== 'native'
  const t = useT()
  const listRef = useRef<HTMLDivElement | null>(null)

  /** Show a tab and give it the keyboard focus. */
  const focusTab = (index: number): void => {
    const tab = tabs[index]
    if (!tab) return
    setActiveTab(tab.id)
    const element = listRef.current?.querySelector<HTMLElement>(`[data-tab-id="${tab.id}"]`)
    element?.focus()
  }

  /** The arrow keys walk through the tabs, like in every other editor. */
  const onTabKeyDown = (event: React.KeyboardEvent<HTMLDivElement>, index: number): void => {
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      focusTab((index + 1) % Math.max(1, tabs.length))
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault()
      focusTab((index - 1 + tabs.length) % Math.max(1, tabs.length))
    } else if (event.key === 'Home') {
      event.preventDefault()
      focusTab(0)
    } else if (event.key === 'End') {
      event.preventDefault()
      focusTab(tabs.length - 1)
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      setActiveTab(tabs[index].id)
    } else if (event.key === 'Delete') {
      event.preventDefault()
      void closeTab(tabs[index].id)
    }
  }

  return (
    <header className="titlebar">
      {showHamburger && (
        <button
          className="main-menu-button"
          title={t('title.mainMenu')}
          aria-label={t('title.mainMenu')}
          onClick={() => setMenuOpen((v) => !v)}
        >
          <Icon name="menu" size={16} />
        </button>
      )}
      <span className="titlebar-logo" title="OpenNotes">
        <AppLogo size={17} />
      </span>

      <nav className="titlebar-tabs" role="tablist" aria-label={t('a11y.openFiles')}>
        <div className="titlebar-tab-list" ref={listRef}>
          {tabs.map((tab, index) => (
            <div
              key={tab.id}
              role="tab"
              data-tab-id={tab.id}
              aria-selected={tab.id === activeTabId}
              tabIndex={tab.id === activeTabId ? 0 : -1}
              className={`titlebar-tab ${tab.id === activeTabId ? 'active' : ''}`}
              title={tab.path ?? tab.name}
              onClick={() => setActiveTab(tab.id)}
              onKeyDown={(event) => onTabKeyDown(event, index)}
              onAuxClick={(e) => {
                if (e.button === 1) void closeTab(tab.id)
              }}
            >
              {tab.dirty && <span className="dirty-dot" title={t('common.unsavedChanges')} />}
              <FileIcon name={tab.name} theme={iconTheme} size={13} />
              <span className="label">{tab.name}</span>
              <button
                className="tab-close"
                title={t('a11y.closeTab')}
                aria-label={t('a11y.closeTab')}
                onClick={(e) => {
                  e.stopPropagation()
                  void closeTab(tab.id)
                }}
              >
                <Icon name="close" size={11} />
              </button>
            </div>
          ))}
        </div>
        <button
          className="titlebar-tab-add"
          title={t('a11y.newTab')}
          aria-label={t('a11y.newTab')}
          onClick={() => newTab()}
        >
          <Icon name="newFile" size={14} />
        </button>
      </nav>

      <div className="titlebar-drag" />

      <div className="titlebar-actions">
        <button
          className={`icon-btn ${sidebarVisible ? 'active' : ''}`}
          title={t('title.toggleProject')}
          aria-label={t('title.toggleProject')}
          onClick={() => void runCommand('view.toggleSidebar')}
        >
          <Icon name="file" />
        </button>
        <button
          className="icon-btn"
          title={t('title.openFile')}
          aria-label={t('title.openFile')}
          onClick={() => void runCommand('file.open')}
        >
          <Icon name="open" />
        </button>
        <button
          className="icon-btn"
          title={t('title.save')}
          aria-label={t('title.save')}
          onClick={() => void runCommand('file.save')}
        >
          <Icon name="save" />
        </button>
        <button
          className="icon-btn"
          title={t('title.searchInFiles')}
          aria-label={t('title.searchInFiles')}
          onClick={() => void runCommand('search.findInFiles')}
        >
          <Icon name="search" />
        </button>
        <button
          className="icon-btn"
          title={t('title.runFile')}
          aria-label={t('title.runFile')}
          onClick={() => void runCommand('tools.run')}
        >
          <Icon name="run" />
        </button>
        <button
          className="icon-btn"
          title={t('title.splitView')}
          aria-label={t('title.splitView')}
          onClick={() => void runCommand('view.toggleSplit')}
        >
          <Icon name="split" />
        </button>
        <button
          className="icon-btn"
          title={t('title.commandPalette')}
          aria-label={t('title.commandPalette')}
          onClick={() => void runCommand('view.commandPalette')}
        >
          <Icon name="search" />
        </button>
        <button
          className="icon-btn"
          title={t('title.settings')}
          aria-label={t('title.settings')}
          onClick={() => useAppStore.getState().setDialog('settings', true)}
        >
          <Icon name="settings" />
        </button>
      </div>

      {/* The window frame is drawn by the app, so the controls are ours. */}
      <div className="window-controls">
        <button
          className="window-control"
          title={t('a11y.minimize')}
          aria-label={t('a11y.minimize')}
          onClick={() => window.api.win.minimize()}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
            <path d="M0 5h10" stroke="currentColor" strokeWidth="1" />
          </svg>
        </button>
        <button
          className="window-control"
          title={maximized ? t('a11y.restore') : t('a11y.maximize')}
          aria-label={maximized ? t('a11y.restore') : t('a11y.maximize')}
          onClick={() => window.api.win.toggleMaximize()}
        >
          {maximized ? (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
              <rect x="0.5" y="2.5" width="7" height="7" stroke="currentColor" strokeWidth="1" />
              <path d="M3 2.5V0.5h7v7H7.5" stroke="currentColor" strokeWidth="1" />
            </svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
              <rect x="0.5" y="0.5" width="9" height="9" stroke="currentColor" strokeWidth="1" />
            </svg>
          )}
        </button>
        <button
          className="window-control close"
          title={t('a11y.closeWindow')}
          aria-label={t('a11y.closeWindow')}
          onClick={() => window.api.win.close()}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
            <path d="M0 0l10 10M10 0L0 10" stroke="currentColor" strokeWidth="1" />
          </svg>
        </button>
      </div>

      {menuOpen &&
        createPortal(
          <MainMenu
            open={menuOpen}
            profile="coding"
            onClose={() => setMenuOpen(false)}
            onCommand={(id, payload) => {
              void runCommand(id, payload)
            }}
          />,
          document.body,
        )}
    </header>
  )
}
