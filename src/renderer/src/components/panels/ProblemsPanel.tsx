/**
 * Problems panel: the diagnostics of the file that is currently open.
 *
 * The panel mirrors what a real IDE shows: a summary of the number of
 * errors, warnings and infos, a filter box and a list of the problems that
 * can be clicked to jump to the offending place in the document.
 */

import { useMemo, useState } from 'react'
import type { JSX } from 'react'
import { countProblems, type Problem, type ProblemSeverity } from '@/core/diagnostics'
import { useT } from '../../core/i18n'

export interface ProblemsPanelProps {
  /** The problems of the active file. */
  problems: Problem[]
  /** Jump to a problem. */
  onSelect?: (problem: Problem) => void
  /** Called when the user asks for a re-check. */
  onRefresh?: () => void
}

/** The icon of a severity. */
function severityIcon(severity: ProblemSeverity): string {
  if (severity === 'error') return '⨯'
  if (severity === 'warning') return '⚠'
  return 'ℹ'
}

/** The colour of a severity. */
function severityColor(severity: ProblemSeverity): string {
  if (severity === 'error') return 'var(--danger)'
  if (severity === 'warning') return 'var(--warning)'
  return 'var(--fg-muted)'
}

/** The summary of the counts, e.g. "3 errors, 2 warnings". */
function summarize(errors: number, warnings: number, infos: number, t: ReturnType<typeof useT>): string {
  if (!errors && !warnings && !infos) return t('panel.problemsNone')
  return t('panel.problemsSummary', { errors, warnings })
}

export function ProblemsPanel({ problems, onSelect, onRefresh }: ProblemsPanelProps): JSX.Element {
  const [filter, setFilter] = useState('')
  const t = useT()

  const counts = useMemo(() => countProblems(problems), [problems])

  const visible = useMemo(() => {
    const needle = filter.trim().toLowerCase()
    if (!needle) return problems
    return problems.filter((problem) => {
      if (problem.message.toLowerCase().includes(needle)) return true
      if (problem.source.toLowerCase().includes(needle)) return true
      return `${problem.line}:${problem.column}`.includes(needle)
    })
  }, [filter, problems])

  const select = (problem: Problem): void => {
    onSelect?.(problem)
  }

  return (
    <div className="panel problems-panel">
      <div className="panel-header">
        <span className="panel-title">{t('panel.problems')}</span>
        <span className="panel-subtitle">{summarize(counts.errors, counts.warnings, counts.infos, t)}</span>
      </div>
      <div className="panel-body">
        <div className="problems-toolbar" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <input
            className="panel-input problems-filter"
            type="search"
            placeholder={t('panel.problemsFilter')}
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          />
          <button
            className="panel-button problems-refresh"
            type="button"
            title={t('panel.problemsCheckAgain')}
            aria-label={t('panel.problemsCheckAgain')}
            onClick={() => onRefresh?.()}
          >
            ⟳
          </button>
        </div>

        {visible.length === 0 ? (
          <div className="empty-state panel-empty">
            {problems.length === 0 ? t('panel.problemsEmpty') : t('panel.problemsNoMatch', { filter: filter.trim() })}
          </div>
        ) : (
          <div className="panel-list problems-list">
            {visible.map((problem, index) => (
              <div
                className="panel-item problem-row"
                key={`${problem.source}-${problem.from}-${index}`}
                role="button"
                tabIndex={0}
                title={problem.message}
                onMouseDown={(event) => {
                  // Keep the keyboard focus in the editor: the row must not
                  // take it, otherwise typing after a jump goes nowhere.
                  event.preventDefault()
                }}
                onClick={() => select(problem)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') select(problem)
                }}
              >
                <span className="problem-severity" style={{ color: severityColor(problem.severity), flex: '0 0 auto' }}>
                  {severityIcon(problem.severity)}
                </span>
                <span className="problem-location" style={{ flex: '0 0 auto', opacity: 0.8 }}>
                  {problem.line}:{problem.column}
                </span>
                <span className="name problem-message" style={{ flex: '1 1 auto', minWidth: 0 }}>
                  {problem.message}
                </span>
                <span className="count problem-source" style={{ flex: '0 0 auto' }}>
                  {problem.source}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="hint">
          {t('panel.problemsHint')}
          {problems.length > visible.length
            ? ` ${t('panel.problemsShowing', { shown: visible.length, total: problems.length })}`
            : ''}
        </div>
      </div>
    </div>
  )
}
