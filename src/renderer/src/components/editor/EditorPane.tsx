import type { JSX } from 'react'
import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react'
import type { EditorView } from '@codemirror/view'
import { useAppStore } from '../../store/app'
import { CodeEditor } from './CodeEditor'
import { runCommand } from '../../core/commands'
import { AppLogo } from '../AppLogo'
import { Icon } from '../Icons'

/*
 * Heavy parts of the UI are loaded on demand: the markdown preview and the
 * minimap are not needed to open a text file, and on a small machine every
 * megabyte of JavaScript counts.
 */
const MarkdownPreview = lazy(() => import('./MarkdownPreview').then((m) => ({ default: m.MarkdownPreview })))
const Minimap = lazy(() => import('./Minimap').then((m) => ({ default: m.Minimap })))

function Loading(): JSX.Element {
  return <div className="empty-state">Loading…</div>
}

function ViewSwitcher({
  view,
  onChange,
}: {
  view: string
  onChange: (v: 'source' | 'preview' | 'split') => void
}): JSX.Element {
  const options: { id: 'source' | 'preview' | 'split'; label: string }[] = [
    { id: 'source', label: 'Source' },
    { id: 'split', label: 'Split' },
    { id: 'preview', label: 'Preview' },
  ]
  return (
    <div style={{ display: 'flex', gap: 2, padding: '2px 6px', background: 'var(--bg-elevated)' }}>
      {options.map((o) => (
        <button
          key={o.id}
          className={`tb-btn ${view === o.id ? 'active' : ''}`}
          onClick={() => onChange(o.id)}
          title={`${o.label} view`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function EditorPane(): JSX.Element {
  const tabs = useAppStore((s) => s.tabs)
  const activeTabId = useAppStore((s) => s.activeTabId)
  const updateTab = useAppStore((s) => s.updateTab)
  const setTabDirty = useAppStore((s) => s.setTabDirty)
  const settings = useAppStore((s) => s.settings)
  const splitView = useAppStore((s) => s.splitView)
  const tab = tabs.find((t) => t.id === activeTabId)

  const viewRef = useRef<EditorView | null>(null)
  const [source, setSource] = useState('')
  const splitRatio = useRef(0.5)
  const splitRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    // Read the freshest content from the store: the previous editor flushes its
    // buffer into the store while unmounting, so the preview is never stale.
    const fresh = useAppStore.getState().tabs.find((t) => t.id === activeTabId)
    setSource(fresh?.content ?? '')
    viewRef.current = null
  }, [activeTabId])

  const handleContentChange = useCallback((text: string) => {
    setSource(text)
  }, [])

  if (!tab) {
    return (
      <div className="editor-pane" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div className="empty-state" style={{ textAlign: 'center' }}>
          <div style={{ marginBottom: 12 }}>
            <AppLogo size={56} />
          </div>
          <h2 style={{ color: 'var(--fg-dim)' }}>OpenNotes</h2>
          <p>All-in-one text editor — code, markdown and plain text.</p>
          <p>
            <kbd>Ctrl</kbd>+<kbd>N</kbd> new · <kbd>Ctrl</kbd>+<kbd>O</kbd> open · <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+
            <kbd>P</kbd> command palette
          </p>
          <button className="icon-btn" style={{ marginTop: 10 }} onClick={() => void runCommand('file.open')}>
            Open a file…
          </button>
        </div>
      </div>
    )
  }

  const startSplitDrag = (e: React.MouseEvent): void => {
    e.preventDefault()
    const container = splitRef.current?.parentElement
    if (!container) return
    const move = (ev: MouseEvent): void => {
      const rect = container.getBoundingClientRect()
      splitRatio.current = Math.min(0.85, Math.max(0.15, (ev.clientX - rect.left) / rect.width))
      if (splitRef.current) splitRef.current.style.flexBasis = `${splitRatio.current * 100}%`
    }
    const up = (): void => {
      document.removeEventListener('mousemove', move)
      document.removeEventListener('mouseup', up)
    }
    document.addEventListener('mousemove', move)
    document.addEventListener('mouseup', up)
  }

  const showSource = tab.view !== 'preview'
  const showPreview = tab.view !== 'source' && tab.mode === 'markdown'
  const largeFile = tab.largeFile

  /** Resolve a relative link of the preview against the folder of the file. */
  const openRelativeLink = (target: string): void => {
    const clean = target.replace(/^#.*$/, '')
    if (!clean) return
    if (/^[a-z]+:\/\//i.test(clean)) {
      window.open(clean)
      return
    }
    const dir = tab.path ? tab.path.replace(/[\\/][^\\/]*$/, '') : (useAppStore.getState().workspaceRoot ?? '')
    if (!dir) return
    void useAppStore.getState().openPath(`${dir}/${clean.replace(/^\.\//, '')}`)
  }

  return (
    <div className="editor-pane">
      {largeFile && (
        <div className="large-file-banner">
          <Icon name="warning" size={13} />
          <span>
            Large file
            {tab.size ? ` (${(tab.size / 1024 / 1024).toFixed(1)} MB)` : ''} — opened read-only, syntax highlighting is
            off
            {tab.truncatedBytes
              ? `, showing the first ${(tab.size ? (tab.size - tab.truncatedBytes) / 1024 / 1024 : 0).toFixed(0)} MB`
              : ''}
            .
          </span>
        </div>
      )}
      {tab.mode === 'markdown' && <ViewSwitcher view={tab.view} onChange={(v) => updateTab(tab.id, { view: v })} />}
      <div className="split-view">
        {showSource && (
          <div className="editor-pane">
            <CodeEditor
              tab={tab}
              onContentChange={handleContentChange}
              onViewReady={(view) => {
                viewRef.current = view
              }}
              syncGroup={splitView ? `split-${tab.id}` : undefined}
            />
            {settings.showMinimap && !settings.lowMemory && (
              <Suspense fallback={null}>
                <Minimap getView={() => viewRef.current} width={settings.minimapWidth} />
              </Suspense>
            )}
          </div>
        )}
        {showSource && splitView && <div className="split-divider" title="Both panes edit the same buffer" />}
        {showSource && splitView && (
          <div className="editor-pane">
            <CodeEditor tab={tab} onContentChange={handleContentChange} syncGroup={`split-${tab.id}`} />
          </div>
        )}
        {showSource && showPreview && (
          <div className="split-divider" ref={splitRef} onMouseDown={startSplitDrag} title="Drag to resize" />
        )}
        {showPreview && (
          <div className="editor-pane">
            <Suspense fallback={<Loading />}>
              <MarkdownPreview source={source} onOpenLink={openRelativeLink} />
            </Suspense>
          </div>
        )}
      </div>
    </div>
  )
}
