/**
 * The panel of the project wide search.
 *
 * The user types a text (or a regular expression), sees every hit of the
 * project and can jump to it. The folders that hold no source code
 * (`node_modules`, `target`, ...) are skipped by the search.
 */

import { useEffect, useMemo, useState } from 'react'
import type { JSX } from 'react'
import { useProjectSearchStore } from '@/core/projectSearch'
import { useAppStore } from '@/store/app'
import { folderOfPath } from '@/core/projectConfig'
import { getEditor } from '@/core/editors'
import { useT } from '../../core/i18n'

/** The name of a path without the folders. */
function fileName(path: string): string {
  const parts = path.split(/[\\/]/).filter(Boolean)
  return parts[parts.length - 1] ?? path
}

/** The folder of a path without the file name. */
function folderOf(path: string): string {
  const parts = path.split(/[\\/]/).filter(Boolean)
  parts.pop()
  return parts.join('/')
}

export function ProjectSearchPanel(): JSX.Element {
  const query = useProjectSearchStore((s) => s.query)
  const replacement = useProjectSearchStore((s) => s.replacement)
  const options = useProjectSearchStore((s) => s.options)
  const matches = useProjectSearchStore((s) => s.matches)
  const searching = useProjectSearchStore((s) => s.searching)
  const files = useProjectSearchStore((s) => s.files)
  const took = useProjectSearchStore((s) => s.took)
  const error = useProjectSearchStore((s) => s.error)
  const setQuery = useProjectSearchStore((s) => s.setQuery)
  const setReplacement = useProjectSearchStore((s) => s.setReplacement)
  const setOptions = useProjectSearchStore((s) => s.setOptions)
  const search = useProjectSearchStore((s) => s.search)
  const replace = useProjectSearchStore((s) => s.replace)
  const clear = useProjectSearchStore((s) => s.clear)
  const openPath = useAppStore((s) => s.openPath)
  const activePath = useAppStore((s) => s.tabs.find((t) => t.id === s.activeTabId)?.path ?? '')
  const projectFolderSetting = useAppStore((s) => s.settings.projectFolder)
  const [replaceOpen, setReplaceOpen] = useState(false)
  const t = useT()

  const folder = projectFolderSetting || folderOfPath(activePath) || ''

  // The search runs again when the options change.
  useEffect(() => {
    if (!query.trim() || !folder) return
    const timer = window.setTimeout(() => {
      void search(folder)
    }, 250)
    return () => window.clearTimeout(timer)
  }, [query, options, folder])

  // The hits are grouped by file.
  const grouped = useMemo(() => {
    const map = new Map<string, { path: string; hits: typeof matches }>()
    for (const match of matches) {
      const entry = map.get(match.path)
      if (entry) entry.hits.push(match)
      else map.set(match.path, { path: match.path, hits: [match] })
    }
    return [...map.values()]
  }, [matches])

  const jump = async (path: string, line: number): Promise<void> => {
    await openPath(path)
    await new Promise((resolve) => window.setTimeout(resolve, 250))
    const state = useAppStore.getState()
    const tab = state.tabs.find((t) => t.id === state.activeTabId)
    if (!tab) return
    getEditor(tab.id)?.goToLine(line)
    getEditor(tab.id)?.focus()
  }

  if (!folder) {
    return (
      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">{t('panel.search')}</span>
        </div>
        <div className="empty-state">{t('panel.searchOpenFileFirst')}</div>
      </div>
    )
  }

  return (
    <div className="panel project-search-panel">
      <div className="panel-header">
        <span className="panel-title">{t('panel.search')}</span>
        <span className="panel-subtitle">
          {searching
            ? t('panel.searching')
            : matches.length > 0
              ? t('panel.searchHits', { count: matches.length, files: grouped.length })
              : ''}
        </span>
      </div>

      <div className="panel-body" style={{ padding: '8px 10px' }}>
        <div className="project-search-row">
          <input
            className="panel-input"
            type="text"
            placeholder={t('panel.searchPlaceholder')}
            aria-label={t('a11y.searchInput')}
            value={query}
            spellCheck={false}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void search(folder)
            }}
          />
        </div>

        <div className="project-search-options">
          <button
            className={`chip${options.regex ? ' active' : ''}`}
            type="button"
            title={t('panel.searchRegex')}
            onClick={() => setOptions({ regex: !options.regex })}
          >
            .*
          </button>
          <button
            className={`chip${options.caseSensitive ? ' active' : ''}`}
            type="button"
            title={t('panel.searchCase')}
            onClick={() => setOptions({ caseSensitive: !options.caseSensitive })}
          >
            Aa
          </button>
          <button
            className={`chip${options.wholeWord ? ' active' : ''}`}
            type="button"
            title={t('panel.searchWholeWord')}
            onClick={() => setOptions({ wholeWord: !options.wholeWord })}
          >
            ab
          </button>
          <input
            className="panel-input project-search-glob"
            type="text"
            placeholder="*.ts"
            value={options.include}
            title={t('panel.searchGlob')}
            onChange={(event) => setOptions({ include: event.target.value })}
          />
          <button
            className="chip"
            type="button"
            title={t('panel.searchReplaceAll')}
            onClick={() => setReplaceOpen((open) => !open)}
          >
            {t('common.replace')}
          </button>
        </div>

        {replaceOpen && (
          <div className="project-search-row" style={{ marginTop: '6px' }}>
            <input
              className="panel-input"
              type="text"
              placeholder={t('panel.searchReplaceWith')}
              value={replacement}
              spellCheck={false}
              onChange={(event) => setReplacement(event.target.value)}
            />
            <button
              className="panel-button"
              type="button"
              onClick={() => {
                void replace(folder)
              }}
            >
              {t('common.replaceAll')}
            </button>
          </div>
        )}

        {error && (
          <div className="hint" style={{ color: 'var(--danger)' }}>
            {error}
          </div>
        )}

        {matches.length === 0 && query.trim() && !searching ? (
          <div className="empty-state">{t('panel.searchNoResults')}</div>
        ) : null}

        <div className="project-search-results">
          {grouped.map((group) => (
            <div key={group.path} className="project-search-file">
              <div className="project-search-file-name" title={group.path}>
                <span className="name">{fileName(group.path)}</span>
                <span className="hint">{folderOf(group.path)}</span>
                <span className="hint">{group.hits.length}</span>
              </div>
              {group.hits.map((hit, index) => (
                <div
                  key={`${hit.line}-${hit.column}-${index}`}
                  className="project-search-hit"
                  role="button"
                  tabIndex={0}
                  onClick={() => void jump(hit.path, hit.line)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') void jump(hit.path, hit.line)
                  }}
                >
                  <span className="project-search-line">{hit.line}</span>
                  <span className="project-search-text">{hit.text.trim()}</span>
                </div>
              ))}
            </div>
          ))}
        </div>

        {matches.length > 0 && (
          <div className="hint" style={{ marginTop: '6px' }}>
            {t('panel.searchDuration', { files, ms: took })}
            <button className="chip" type="button" style={{ marginLeft: '8px' }} onClick={clear}>
              {t('common.clear')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
