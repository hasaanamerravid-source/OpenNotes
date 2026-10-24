import type { JSX } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { getCommands, getRecentCommands, runCommand } from '../core/commands'
import { useAppStore } from '../store/app'
import { commandKey, useT, useTWith } from '../core/i18n'

export type PaletteMode = 'commands' | 'files'

function fuzzyScore(query: string, text: string): number {
  if (!query) return 0
  const q = query.toLowerCase()
  const t = text.toLowerCase()
  if (t.startsWith(q)) return 1000 - t.length
  const direct = t.indexOf(q)
  if (direct >= 0) return 500 - direct - t.length * 0.1
  let score = 0
  let ti = 0
  for (const ch of q) {
    const found = t.indexOf(ch, ti)
    if (found < 0) return -1
    score += 20 - Math.min(15, found - ti)
    ti = found + 1
  }
  return score
}

interface PaletteProps {
  open: boolean
  mode: PaletteMode
  onClose: () => void
}

export function CommandPalette({ open, mode, onClose }: PaletteProps): JSX.Element | null {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const workspaceRoot = useAppStore((s) => s.workspaceRoot)
  const openPath = useAppStore((s) => s.openPath)
  const recentFiles = useAppStore((s) => s.settings.recentFiles)
  const t = useT()
  const tWith = useTWith()
  const [projectFiles, setProjectFiles] = useState<string[]>([])
  const [projectRoot, setProjectRoot] = useState<string | null>(null)

  /** Load every file of the current project folder once, so the quick
   * switcher can jump to any file, not just the recent ones.
   * This is what makes OpenNotes usable as a code editor: Ctrl+Shift+O finds
   * every file in the folder. */
  useEffect(() => {
    if (mode !== 'files') return
    const root = workspaceRoot ?? ''
    if (!root || root === projectRoot) return
    setProjectRoot(root)
    void (async () => {
      try {
        const entries = await window.api.fs.listRecursive(root, 12)
        const files = entries
          .filter((e) => !e.isDir)
          .map((e) => e.path)
          // Skip the folders that hold no source code: listing tens of
          // thousands of node_modules files would make the switcher useless.
          .filter(
            (p) => !/[\\/](node_modules|target|dist|build|out|.git|__pycache__|.next|.nuxt|coverage)[\\/]/.test(p),
          )
          .slice(0, 5000)
        setProjectFiles(files)
      } catch {
        /* listing the folder is a nice-to-have */
      }
    })()
    return () => {
      setProjectFiles([])
      setProjectRoot(null)
    }
  }, [mode, workspaceRoot, projectRoot])

  useEffect(() => {
    if (open) {
      setQuery('')
      setSelected(0)
      setTimeout(() => inputRef.current?.focus(), 10)
    }
  }, [open, mode])

  const items = useMemo(() => {
    if (mode === 'commands') {
      const recentIds = getRecentCommands()
      return getCommands()
        .filter((c) => !c.hidden)
        .map((c) => ({
          id: c.id,
          title: tWith(commandKey(c.id), c.title),
          category: c.category ?? '',
          shortcut: c.shortcut ?? '',
        }))
        .map((c) => ({ ...c, score: fuzzyScore(query, `${c.category} ${c.title}`) }))
        .filter((c) => c.score >= 0)
        .sort((a, b) => {
          // The commands that were used last come first, as long as the user
          // has not typed anything: a search is a search.
          if (query) return b.score - a.score
          const aRecent = recentIds.indexOf(a.id)
          const bRecent = recentIds.indexOf(b.id)
          if (aRecent >= 0 && bRecent >= 0) return aRecent - bRecent
          if (aRecent >= 0) return -1
          if (bRecent >= 0) return 1
          return b.score - a.score
        })
        .slice(0, 60)
    }
    const recent = recentFiles.map((f) => ({
      id: f,
      title: f.split(/[\\/]/).pop() ?? f,
      category: f,
      shortcut: '',
    }))
    const files = projectFiles.map((p) => ({
      id: p,
      title: p.split(/[\\/]/).pop() ?? p,
      category: p,
      shortcut: '',
    }))
    return [...recent, ...files]
      .map((c) => ({ ...c, score: fuzzyScore(query, `${c.category} ${c.title}`) }))
      .filter((c) => c.score >= 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 60)
  }, [mode, query, recentFiles, projectFiles, tWith])

  useEffect(() => {
    setSelected(0)
  }, [query])

  if (!open) return null

  const activate = (index: number): void => {
    const item = items[index]
    if (!item) return
    onClose()
    if (mode === 'commands') {
      void runCommand(item.id)
    } else {
      void openPath(item.id)
    }
  }

  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="palette" onMouseDown={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          type="text"
          value={query}
          aria-label={t('a11y.palette')}
          placeholder={mode === 'commands' ? t('palette.commandPlaceholder') : t('palette.filePlaceholder')}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setSelected((s) => Math.min(items.length - 1, s + 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setSelected((s) => Math.max(0, s - 1))
            } else if (e.key === 'Enter') {
              e.preventDefault()
              activate(selected)
            } else if (e.key === 'Escape') {
              e.preventDefault()
              onClose()
            }
          }}
        />
        <div className="palette-list">
          {items.length === 0 && <div className="palette-empty">{t('palette.noMatches')}</div>}
          {items.map((item, index) => (
            <div
              key={`${item.category}-${item.id}`}
              className={`palette-item ${index === selected ? 'selected' : ''}`}
              onMouseEnter={() => setSelected(index)}
              onClick={() => activate(index)}
            >
              <span className="cmd-title">{item.title}</span>
              {item.category && <span className="cmd-category">{item.category}</span>}
              {item.shortcut && <span className="kbd">{item.shortcut}</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
