import type { JSX } from 'react'
import { useEffect, useState } from 'react'
import { useUiStore } from '../store/ui'
import { Modal } from './Modal'
import { useT } from '../core/i18n'

export function PromptHost(): JSX.Element | null {
  const prompt = useUiStore((s) => s.prompt)
  const confirm = useUiStore((s) => s.confirm)
  const closePrompt = useUiStore((s) => s.closePrompt)
  const closeConfirm = useUiStore((s) => s.closeConfirm)
  const [value, setValue] = useState('')
  const t = useT()

  useEffect(() => {
    if (prompt) setValue(prompt.defaultValue ?? '')
  }, [prompt])

  if (prompt) {
    return (
      <Modal title={prompt.title} onClose={closePrompt} size="small">
        {prompt.message && <div className="hint">{prompt.message}</div>}
        <input
          autoFocus
          type="text"
          value={value}
          placeholder={prompt.placeholder}
          aria-label={prompt.title}
          style={{ width: '100%' }}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              prompt.resolve(value)
              useUiStore.setState({ prompt: null })
            }
          }}
        />
        <div className="modal-footer" style={{ marginTop: 12, padding: 0, borderTop: 'none' }}>
          <button className="icon-btn" onClick={closePrompt}>
            {t('common.cancel')}
          </button>
          <button
            className="icon-btn"
            onClick={() => {
              prompt.resolve(value)
              useUiStore.setState({ prompt: null })
            }}
          >
            {t('common.ok')}
          </button>
        </div>
      </Modal>
    )
  }

  if (confirm) {
    return (
      <Modal title={confirm.title} onClose={closeConfirm} size="small">
        <div className="modal-body" style={{ padding: 0 }}>
          {confirm.message}
        </div>
        <div className="modal-footer" style={{ padding: '12px 0 0', borderTop: 'none' }}>
          <button className="icon-btn" onClick={closeConfirm}>
            {confirm.cancelLabel ?? t('common.cancel')}
          </button>
          <button
            className="icon-btn"
            onClick={() => {
              confirm.resolve(true)
              useUiStore.setState({ confirm: null })
            }}
          >
            {confirm.confirmLabel ?? t('common.ok')}
          </button>
        </div>
      </Modal>
    )
  }

  return null
}
