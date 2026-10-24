/**
 * Terminal panel: the interactive shell.
 *
 * The panel is a thin view on the terminal state: the shell itself lives in
 * the main process (see `src/main/ipc/terminal.ts`). The user types a command
 * into the input at the bottom, the output shows up above it.
 *
 * The shell is piped and not a real terminal, so the panel draws its own
 * prompt and full screen programs (vim, less) do not work in here.
 */

import { useEffect, useRef, useState } from 'react'
import type { JSX, KeyboardEvent } from 'react'
import { useTerminalStore } from '@/core/terminalState'
import { useAppStore } from '@/store/app'
import { useT } from '../../core/i18n'

export interface TerminalPanelProps {
  /** The folder the shell should run in (the folder of the active file). */
  cwd?: string
}

/** The name of the shell in the prompt. */
function isWindows(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Windows/i.test(navigator.userAgent)
}

/** The last part of a path (the folder name). */
function folderName(folder: string): string {
  const parts = folder.split(/[\\/]/).filter(Boolean)
  return parts[parts.length - 1] ?? folder
}

/** The colour of a line of the log. */
function lineColor(type: 'input' | 'stdout' | 'stderr' | 'system'): string {
  if (type === 'stderr') return 'var(--danger)'
  if (type === 'system') return 'var(--fg-muted)'
  if (type === 'input') return 'var(--accent)'
  return 'var(--fg-dim)'
}

export function TerminalPanel({ cwd }: TerminalPanelProps): JSX.Element {
  const running = useTerminalStore((s) => s.running)
  const storeCwd = useTerminalStore((s) => s.cwd)
  const lines = useTerminalStore((s) => s.lines)
  const busy = useTerminalStore((s) => s.busy)
  const start = useTerminalStore((s) => s.start)
  const write = useTerminalStore((s) => s.write)
  const interrupt = useTerminalStore((s) => s.interrupt)
  const stop = useTerminalStore((s) => s.stop)
  const clear = useTerminalStore((s) => s.clear)
  const historyPrev = useTerminalStore((s) => s.historyPrev)
  const historyNext = useTerminalStore((s) => s.historyNext)
  const [value, setValue] = useState('')
  const logRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const t = useT()

  // The folder of the shell (the one that was started wins).
  const folder = storeCwd || cwd || ''
  const windows = isWindows()
  const prompt = windows ? (folder ? `PS ${folder}>` : 'PS>') : '$ '

  // Follow the output: the newest line stays in sight.
  useEffect(() => {
    const element = logRef.current
    if (element) element.scrollTop = element.scrollHeight
  }, [lines])

  // The input takes the focus, so the user can type right away.
  useEffect(() => {
    if (running) inputRef.current?.focus()
  }, [running])

  const handleSubmit = (): void => {
    const command = value
    if (!command.trim()) return
    setValue('')
    write(command)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter') {
      event.preventDefault()
      handleSubmit()
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      const previous = historyPrev()
      if (previous !== null) setValue(previous)
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      const next = historyNext()
      setValue(next ?? '')
      return
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      setValue('')
      return
    }
    // Ctrl+C interrupts the command that is running - but only when there is
    // nothing to copy, so that the copy shortcut keeps working.
    if (event.key === 'c' && event.ctrlKey && value === '' && running) {
      event.preventDefault()
      interrupt()
    }
  }

  const handleCopyPath = (): void => {
    if (!folder) return
    try {
      const api = window.api as unknown as
        { clipboard?: { writeText?: (text: string) => Promise<unknown> | unknown } } | undefined
      void Promise.resolve(api?.clipboard?.writeText?.(folder)).catch(() => undefined)
      useAppStore.getState().toast(t('panel.terminalCopied'))
    } catch {
      useAppStore.getState().toast(t('panel.terminalCopyFailed'), 'error')
    }
  }

  return (
    <div className="panel terminal-panel">
      <div className="panel-header">
        <span className="panel-title">{t('panel.terminal')}</span>
        <span className="panel-subtitle" title={folder || undefined}>
          {folder ? folderName(folder) : t('panel.terminalNoShell')}
          {busy ? t('panel.terminalRunning') : ''}
        </span>
        <span className="terminal-actions" style={{ display: 'flex', gap: '4px' }}>
          <button
            className="panel-button terminal-cwd"
            type="button"
            title={folder ? `${t('common.copy')} ${folder}` : t('panel.terminalUnknownFolder')}
            disabled={!folder}
            onClick={handleCopyPath}
          >
            {folder ? folderName(folder) : '—'}
          </button>
          <button
            className="panel-button"
            type="button"
            title={t('panel.terminalStop')}
            disabled={!running}
            onClick={interrupt}
          >
            {t('panel.terminalInterrupt')}
          </button>
          <button
            className="panel-button"
            type="button"
            title={t('panel.terminalStopShell')}
            disabled={!running}
            onClick={stop}
          >
            {t('panel.runStop')}
          </button>
          <button className="panel-button" type="button" disabled={lines.length === 0} onClick={clear}>
            {t('common.clear')}
          </button>
        </span>
      </div>

      <div className="panel-body terminal-body">
        {lines.length > 0 ? (
          <div
            className="terminal-log"
            ref={logRef}
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              lineHeight: 1.45,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              overflow: 'auto',
              minHeight: 0,
              flex: 1,
            }}
          >
            {lines.map((line, index) => (
              <div
                className={`terminal-line terminal-line-${line.type}`}
                key={`${index}-${line.type}`}
                style={{ color: lineColor(line.type) }}
              >
                {line.type === 'input' ? `${prompt}${line.text}` : line.text}
              </div>
            ))}
          </div>
        ) : null}

        {running ? (
          <div
            className={`terminal-input-row${busy ? ' terminal-busy' : ''}`}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <span
              className="terminal-prompt"
              style={{
                color: 'var(--accent)',
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                whiteSpace: 'pre',
                flex: '0 0 auto',
                maxWidth: '50%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
              title={folder || undefined}
            >
              {prompt}
            </span>
            <input
              className="terminal-input"
              ref={inputRef}
              type="text"
              value={value}
              spellCheck={false}
              autoComplete="off"
              autoCorrect="off"
              placeholder={t('panel.terminalPrompt')}
              aria-label={t('a11y.terminalInput')}
              onChange={(event) => setValue(event.target.value)}
              onKeyDown={handleKeyDown}
              style={{
                flex: '1 1 auto',
                minWidth: 0,
                padding: '4px 8px',
                borderRadius: '4px',
                border: '1px solid var(--border-strong)',
                background: 'var(--bg-input)',
                color: 'var(--fg)',
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
              }}
            />
          </div>
        ) : (
          <div className="empty-state panel-empty terminal-empty">
            <div>{t('panel.terminalNotRunning')}</div>
            <button className="panel-button" type="button" style={{ marginTop: '6px' }} onClick={() => start(cwd)}>
              {t('panel.terminalStart')}
            </button>
            <div className="hint" style={{ marginTop: '6px' }}>
              {t('panel.terminalHint', { folder: folder || 'the home directory' })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
