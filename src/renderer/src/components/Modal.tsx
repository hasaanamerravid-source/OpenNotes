import type { JSX, ReactNode } from 'react'
import { useEffect, useId, useRef } from 'react'
import { useT } from '../core/i18n'

/**
 * The elements that can hold the keyboard focus.
 */
const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

export interface ModalProps {
  /** The title of the dialog; it names the dialog for the screen reader. */
  title: string
  /** Called when the dialog is closed (the button, the escape key, the backdrop). */
  onClose: () => void
  children: ReactNode
  /** The buttons at the bottom of the dialog. */
  footer?: ReactNode
  /** A row of tabs below the title (the settings dialog has one). */
  tabs?: ReactNode
  /** A small dialog is used for the prompts. */
  size?: 'small' | 'normal'
  className?: string
}

/**
 * A dialog of the application.
 *
 * Every dialog of OpenNotes is a modal one:
 *
 * * the keyboard focus stays inside it (the tab key cycles through it),
 * * the escape key closes it,
 * * the focus goes back to the control that opened it,
 * * it is announced as a dialog with its title.
 */
export function Modal({ title, onClose, children, footer, tabs, size = 'normal', className }: ModalProps): JSX.Element {
  const panelRef = useRef<HTMLDivElement | null>(null)
  const titleId = useId()
  const t = useT()

  useEffect(() => {
    // The control that opened the dialog gets the focus back when it closes.
    const opener = document.activeElement as HTMLElement | null
    const panel = panelRef.current
    if (panel) {
      const first = panel.querySelector<HTMLElement>(FOCUSABLE)
      ;(first ?? panel).focus()
    }
    return () => {
      if (opener && document.contains(opener)) opener.focus()
    }
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
        return
      }
      if (event.key !== 'Tab') return
      const panel = panelRef.current
      if (!panel) return
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (element) => element.offsetParent !== null || element === document.activeElement,
      )
      if (!focusable.length) {
        event.preventDefault()
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement as HTMLElement | null
      if (event.shiftKey && (active === first || !panel.contains(active))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }
    // The listener sits on the window: a key that is sent to the window
    // itself never reaches the document.
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        ref={panelRef}
        className={`modal ${size === 'small' ? 'small' : ''} ${className ?? ''}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <span id={titleId}>{title}</span>
          <button className="icon-btn" aria-label={t('common.close')} onClick={onClose}>
            ×
          </button>
        </div>
        {tabs}
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  )
}
