import { Component, type ErrorInfo, type ReactNode } from 'react'
import { translate } from '@shared/i18n'
import { useAppStore } from '../store/app'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
  info: string
}

/**
 * Catches renderer exceptions so a bug shows a readable panel instead of a
 * blank window, and reports the failure to the main process log.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { error: null, info: '' }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    this.setState({ info: info.componentStack ?? '' })
    try {
      window.api?.reportError?.(String(error?.stack ?? error))
    } catch {
      /* the bridge may be gone during teardown */
    }
  }

  /** The text in the language of the interface. */
  private text(key: Parameters<typeof translate>[1]): string {
    const language = useAppStore.getState().settings.language
    return translate(language, key)
  }

  render(): ReactNode {
    const { error, info } = this.state
    if (!error) return this.props.children
    return (
      <div className="modal-backdrop">
        <div className="modal" role="dialog" aria-modal="true" aria-label={this.text('error.title')}>
          <div className="modal-header">
            <span>{this.text('error.title')}</span>
          </div>
          <div className="modal-body">
            <p className="hint">{this.text('error.filesSafe')}</p>
            <pre
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                padding: '10px',
                maxHeight: '260px',
                overflow: 'auto',
                fontSize: 11,
                whiteSpace: 'pre-wrap',
              }}
            >
              {String(error.stack ?? error.message)}
            </pre>
            {info && (
              <pre style={{ fontSize: 10, color: 'var(--fg-muted)', maxHeight: 120, overflow: 'auto' }}>
                {info.slice(0, 2000)}
              </pre>
            )}
          </div>
          <div className="modal-footer">
            <button className="icon-btn" onClick={() => window.location.reload()}>
              {this.text('error.reload')}
            </button>
            <button className="icon-btn" onClick={() => this.setState({ error: null, info: '' })}>
              {this.text('error.dismiss')}
            </button>
          </div>
        </div>
      </div>
    )
  }
}
