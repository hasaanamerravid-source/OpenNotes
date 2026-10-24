import type { JSX } from 'react'
import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '../store/app'
import { useStatusStore } from '../store/status'
import { runCommand } from '../core/commands'
import { useProblems } from '../core/useProblems'
import { useLspStore } from '../core/lspState'
import { Icon } from './Icons'
import { ENCODING_LABELS, EOL_LABELS } from '../core/defaults'
import { languageLabel, LANGUAGE_IDS } from '../core/languages'
import { useT } from '../core/i18n'

interface MenuItem {
  label: string
  value: string
  active?: boolean
}

function usePopover(): {
  open: boolean
  setOpen: (v: boolean) => void
  el: React.RefObject<HTMLDivElement | null>
} {
  const [open, setOpen] = useState(false)
  const el = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent): void => {
      if (el.current && !el.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])
  return { open, setOpen, el }
}

function StatusMenu({
  label,
  title,
  items,
  onPick,
}: {
  label: React.ReactNode
  title: string
  items: MenuItem[]
  onPick: (value: string) => void
}): JSX.Element {
  const { open, setOpen, el } = usePopover()
  return (
    <div className="stat" ref={el} style={{ position: 'relative' }}>
      <button className="stat" title={title} onClick={() => setOpen(!open)}>
        {label}
      </button>
      {open && (
        <div
          className="palette"
          style={{
            position: 'absolute',
            bottom: '100%',
            left: 0,
            width: '240px',
            maxHeight: '50vh',
            marginBottom: '4px',
          }}
        >
          <div className="palette-list">
            {items.map((item) => (
              <div
                key={item.value}
                className={`palette-item ${item.active ? 'selected' : ''}`}
                onClick={() => {
                  setOpen(false)
                  onPick(item.value)
                }}
              >
                <span className="cmd-title">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * The state of the language server of the active file: it tells the user if
 * the server runs, if it is starting and if it is missing.
 */
function LspStatus(): JSX.Element | null {
  const language = useAppStore((s) => s.tabs.find((t) => t.id === s.activeTabId)?.language ?? '')
  const status = useLspStore((s) => s.status[language])
  const t = useT()
  if (!status) return null
  if (status.state === 'ready') {
    return (
      <span className="stat" title={t('status.lspRunning', { language })}>
        LSP ✓
      </span>
    )
  }
  if (status.state === 'starting') {
    return (
      <span className="stat" title={t('status.lspStarting', { language })}>
        LSP …
      </span>
    )
  }
  if (status.state === 'error') {
    return (
      <span className="stat" title={status.message ?? t('status.lspUnavailable')}>
        LSP ✕
      </span>
    )
  }
  return null
}

export function StatusBar(): JSX.Element {
  const status = useStatusStore()
  const tabs = useAppStore((s) => s.tabs)
  const activeTabId = useAppStore((s) => s.activeTabId)
  const updateTab = useAppStore((s) => s.updateTab)
  const setBottomPanelVisible = useAppStore((s) => s.setBottomPanelVisible)
  const setBottomTab = useAppStore((s) => s.setBottomTab)
  const problems = useProblems()
  const tab = tabs.find((t) => t.id === activeTabId)
  const t = useT()

  const encodings = Object.entries(ENCODING_LABELS).map(([value, label]) => ({
    label,
    value,
    active: tab?.encoding === value,
  }))

  const languages = LANGUAGE_IDS.map((id) => ({
    label: languageLabel(id),
    value: id,
    active: tab?.language === id,
  }))

  const eols = (Object.keys(EOL_LABELS) as string[]).map((eol) => ({
    label: EOL_LABELS[eol as keyof typeof EOL_LABELS],
    value: eol,
    active: tab?.eol === eol,
  }))

  const errors = problems.filter((p) => p.severity === 'error').length
  const warnings = problems.filter((p) => p.severity === 'warning').length

  return (
    <footer className="statusbar" aria-label={t('a11y.statusBar')}>
      <span className="stat" title={t('status.cursorPosition')}>
        {t('status.position', { line: status.line, column: status.col })}
      </span>
      {status.selChars > 0 && (
        <span className="stat" title={t('status.selectedCharacters')}>
          {t('status.selectionFormat', { chars: status.selChars, lines: status.selLines + 1 })}
        </span>
      )}
      <span className="stat" title={t('status.documentSize')}>
        {t('status.linesCount', { count: status.totalLines })} · {t('status.wordsCount', { count: status.words })} ·{' '}
        {t('status.charsCount', { count: status.totalChars })}
      </span>
      <span className="spacer" />
      {(errors > 0 || warnings > 0) && (
        <button
          className="stat"
          title={t('status.showProblems')}
          onClick={() => {
            setBottomTab('problems')
            setBottomPanelVisible(true)
          }}
        >
          <Icon name="error" size={12} /> {errors} · <Icon name="warning" size={12} /> {warnings}
        </button>
      )}
      <LspStatus />
      <StatusMenu
        title={t('status.lineEnding')}
        label={`EOL: ${tab ? EOL_LABELS[tab.eol] : 'LF (Unix)'}`}
        items={eols}
        onPick={(value) => {
          if (tab) updateTab(tab.id, { eol: value as never })
        }}
      />
      <StatusMenu
        title={t('status.encoding')}
        label={tab ? (ENCODING_LABELS[tab.encoding] ?? tab.encoding) : 'UTF-8'}
        items={encodings}
        onPick={(value) => {
          if (tab) updateTab(tab.id, { encoding: value })
        }}
      />
      <StatusMenu
        title={t('status.language')}
        label={tab ? languageLabel(tab.language) : t('status.plainText')}
        items={languages}
        onPick={(value) => {
          if (tab) updateTab(tab.id, { language: value })
        }}
      />
      <button className="stat" title={t('status.zoom')} onClick={() => void runCommand('view.zoomReset')}>
        {Math.round(status.zoom * 100)}%
      </button>
    </footer>
  )
}
