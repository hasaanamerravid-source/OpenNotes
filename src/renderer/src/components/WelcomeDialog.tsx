import type { JSX } from 'react'
import { useAppStore } from '../store/app'
import { runCommand } from '../core/commands'
import { Modal } from './Modal'
import { useT } from '../core/i18n'
import type { MessageKey } from '@shared/i18n'

/** The shortcuts that are shown when the application starts. */
const SHORTCUTS: [MessageKey, string][] = [
  ['cmd.file.new', 'Ctrl+N'],
  ['cmd.file.open', 'Ctrl+O'],
  ['settings.shortcutSave', 'Ctrl+S / Ctrl+Shift+S'],
  ['cmd.view.commandPalette', 'Ctrl+Shift+P'],
  ['cmd.view.quickSwitcher', 'Ctrl+Shift+O'],
  ['settings.shortcutFind', 'Ctrl+F / Ctrl+H'],
  ['cmd.edit.gotoLine', 'Ctrl+G'],
  ['cmd.view.toggleSidebar', 'Ctrl+Shift+E'],
  ['cmd.view.distractionFree', 'Ctrl+Alt+F'],
  ['cmd.edit.duplicateLine', 'Ctrl+D'],
  ['cmd.view.fullscreen', 'F11'],
]

/** The commands that are offered when the application starts. */
const ACTIONS: [string, MessageKey][] = [
  ['file.new', 'welcome.action.new'],
  ['file.open', 'welcome.action.open'],
  ['file.openFromClipboard', 'welcome.action.clipboard'],
  ['view.commandPalette', 'welcome.action.commands'],
]

export function WelcomeDialog(): JSX.Element | null {
  const open = useAppStore((s) => s.welcomeOpen)
  const setDialog = useAppStore((s) => s.setDialog)
  const recent = useAppStore((s) => s.settings.recentFiles)
  const t = useT()

  if (!open) return null

  const close = (): void => setDialog('welcome', false)

  return (
    <Modal
      title={t('dialog.welcome.title')}
      onClose={close}
      footer={
        <button className="icon-btn" onClick={close}>
          {t('common.close')}
        </button>
      }
    >
      <p className="hint">{t('dialog.welcome.subtitle')}</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <div>
          <h3>{t('welcome.start')}</h3>
          {ACTIONS.map(([id, key]) => (
            <button key={id} className="panel-item" onClick={() => void runCommand(id)}>
              <span className="name">{t(key)}</span>
            </button>
          ))}
          {recent.length > 0 && (
            <>
              <h3>{t('welcome.recentFiles')}</h3>
              {recent.slice(0, 8).map((file) => (
                <button
                  key={file}
                  className="panel-item"
                  title={file}
                  onClick={() => void runCommand('file.openPath', file)}
                >
                  <span className="name">{file.split(/[\\/]/).pop()}</span>
                  <span className="count">{file}</span>
                </button>
              ))}
            </>
          )}
        </div>
        <div>
          <h3>{t('welcome.shortcuts')}</h3>
          <table className="kbd-table">
            <tbody>
              {SHORTCUTS.map(([key, keys]) => (
                <tr key={key}>
                  <td>{t(key)}</td>
                  <td>
                    <kbd>{keys}</kbd>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  )
}
