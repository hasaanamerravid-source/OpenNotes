import { lazy, Suspense, useRef, useState } from 'react'
import type { JSX } from 'react'
import { useAppStore, type SidePanel } from '../store/app'
import { FileTree } from './panels/FileTree'
import { getEditor } from '../core/editors'
import { panelAllowed } from '../core/profiles'
import { useProblems } from '../core/useProblems'
import { jumpToProblem as jumpToProblemRef } from '../core/lspCommands'
import type { Problem } from '../core/diagnostics'
import { useT } from '../core/i18n'

/* The tool windows are only needed when they are actually open. */
const ProjectSearchPanel = lazy(() =>
  import('./panels/ProjectSearchPanel').then((m) => ({ default: m.ProjectSearchPanel })),
)
const OutlinePanel = lazy(() => import('./panels/OutlinePanel').then((m) => ({ default: m.OutlinePanel })))
const PluginsPanel = lazy(() => import('./panels/PluginsPanel').then((m) => ({ default: m.PluginsPanel })))
const ProblemsPanel = lazy(() => import('./panels/ProblemsPanel').then((m) => ({ default: m.ProblemsPanel })))
const RunPanel = lazy(() => import('./panels/RunPanel').then((m) => ({ default: m.RunPanel })))

export function Sidebar(): JSX.Element {
  const panel = useAppStore((s) => s.sidePanel)
  const setPanel = useAppStore((s) => s.setSidePanel)
  const tabs = useAppStore((s) => s.tabs)
  const activeTabId = useAppStore((s) => s.activeTabId)
  const profile = useAppStore((s) => s.settings.profile)
  const [width, setWidth] = useState(useAppStore.getState().sidebarWidth)
  const widthRef = useRef(width)
  widthRef.current = width

  const activeTab = tabs.find((t) => t.id === activeTabId)

  const problems = useProblems()
  const jumpToProblem = (problem: Problem): void => {
    void jumpToProblemRef(problem)
  }

  const startResize = (e: React.MouseEvent): void => {
    e.preventDefault()
    const move = (ev: MouseEvent): void => {
      const next = Math.min(560, Math.max(180, ev.clientX))
      widthRef.current = next
      setWidth(next)
    }
    const up = (): void => {
      document.removeEventListener('mousemove', move)
      document.removeEventListener('mouseup', up)
      useAppStore.getState().setSettings({ sidebarWidth: widthRef.current })
    }
    document.addEventListener('mousemove', move)
    document.addEventListener('mouseup', up)
  }

  const allowed = panelAllowed(profile, panel)
  const t = useT()

  return (
    <aside className="sidebar" style={{ width }} aria-label={t('a11y.sidebar')}>
      <div className="sidebar-content">
        <Suspense fallback={<div className="empty-state">{t('common.loading')}</div>}>
          {panel === 'files' && <FileTree />}
          {panel === 'search' && <ProjectSearchPanel />}
          {panel === 'outline' && (
            <OutlinePanel
              content={activeTab?.content ?? ''}
              title={activeTab?.name}
              onOpenLine={(line) => getEditor(activeTabId)?.goToLine(Math.max(1, line))}
            />
          )}
          {panel === 'plugins' && <PluginsPanel />}
          {panel === 'problems' && <ProblemsPanel problems={problems} onSelect={jumpToProblem} />}
          {panel === 'run' && <RunPanel />}
          {!allowed && (
            <div className="empty-state">
              {t('panel.notInProfile')}
              <br />
              <button className="icon-btn" style={{ marginTop: 8 }} onClick={() => setPanel('files')}>
                {t('panel.showProject')}
              </button>
            </div>
          )}
        </Suspense>
      </div>
      <div className="sidebar-resizer" onMouseDown={startResize} />
    </aside>
  )
}
