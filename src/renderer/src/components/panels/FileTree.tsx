import type { JSX } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { DirEntry } from '@shared/types'
import { useAppStore } from '../../store/app'
import { FileIcon } from '../FileIcon'
import { useT } from '../../core/i18n'
import { FILE_FILTERS } from '../../core/defaults'

/** A tiny context menu for a file tree entry. */
function FileContextMenu({
  entry,
  onOpen,
  onCompare,
  onClose,
}: {
  entry: DirEntry
  onOpen: () => void
  onCompare: () => void
  onClose: () => void
}): JSX.Element | null {
  const t = useT()
  const showCompare = !entry.isDir
  const items = [
    { label: t('panel.filesOpen'), onClick: onOpen },
    ...(showCompare ? [{ label: t('panel.filesCompare'), onClick: onCompare }] : []),
    { label: t('panel.filesShowInFolder'), onClick: () => void window.api.fs.showInFolder(entry.path) },
  ]
  return (
    <div
      className="context-menu"
      style={{ position: 'fixed', zIndex: 2000 }}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={onClose}
    >
      {items.map((item) => (
        <button
          key={item.label}
          className="context-menu-item"
          onClick={(e) => {
            e.stopPropagation()
            item.onClick()
            onClose()
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}

interface TreeNodeProps {
  entry: DirEntry
  depth: number
  onOpen: (path: string) => void
  filter: string
  expanded: Set<string>
  toggle: (path: string) => void
  childrenOf: (path: string) => DirEntry[]
  loading: Set<string>
  setLoading: (updater: (prev: Set<string>) => Set<string>) => void
  iconTheme: string
}

function TreeNode({
  entry,
  depth,
  onOpen,
  filter,
  expanded,
  toggle,
  childrenOf,
  loading,
  setLoading,
  iconTheme,
}: TreeNodeProps): JSX.Element {
  const [children, setChildren] = useState<DirEntry[] | null>(null)
  const isOpen = expanded.has(entry.path)
  const t = useT()
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)

  const load = useCallback(async () => {
    if (children !== null || loading.has(entry.path)) return
    setLoading((prev) => new Set(prev).add(entry.path))
    try {
      const list = await window.api.fs.readDir(entry.path)
      setChildren(list)
    } catch {
      setChildren([])
    } finally {
      setLoading((prev) => {
        const next = new Set(prev)
        next.delete(entry.path)
        return next
      })
    }
  }, [children, entry.path, loading, setLoading])

  useEffect(() => {
    if (isOpen) void load()
  }, [isOpen, load])

  // Close the context menu when clicking anywhere else.
  useEffect(() => {
    const close = (): void => setMenu(null)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const matches = (name: string): boolean => filter.length === 0 || name.toLowerCase().includes(filter.toLowerCase())

  const openCompare = async (): Promise<void> => {
    setMenu(null)
    const result = await window.api.fs.openDialog({ title: t('panel.filesCompare'), filters: FILE_FILTERS })
    if (result.canceled || !result.filePath) return
    const store = useAppStore.getState()
    const left = await window.api.fs.readTextFile(entry.path)
    const right = await window.api.fs.readTextFile(result.filePath)
    store.setCompareData({
      left,
      right,
      leftName: entry.name,
      rightName: result.filePath.split(/[\\/]/).pop() ?? result.filePath,
    })
    store.setDialog('compare', true)
  }

  return (
    <div className="tree-node">
      <div
        className="panel-item"
        style={{ paddingLeft: depth * 10 }}
        onClick={() => {
          if (entry.isDir) {
            toggle(entry.path)
            void load()
          } else {
            onOpen(entry.path)
          }
        }}
        onContextMenu={(e) => {
          e.preventDefault()
          setMenu({ x: e.clientX, y: e.clientY })
        }}
        title={entry.path}
      >
        <span style={{ width: 12, display: 'inline-block', color: 'var(--fg-muted)' }}>
          {entry.isDir ? (isOpen ? '▾' : '▸') : ''}
        </span>
        <FileIcon name={entry.name} isDirectory={entry.isDir} theme={iconTheme} />
        <span className="name">{entry.name}</span>
      </div>
      {menu && (
        <FileContextMenu
          entry={entry}
          onOpen={() => {
            setMenu(null)
            if (entry.isDir) {
              toggle(entry.path)
              void load()
            } else {
              onOpen(entry.path)
            }
          }}
          onCompare={openCompare}
          onClose={() => setMenu(null)}
        />
      )}
      {isOpen && entry.isDir && (
        <div className="tree-children">
          {loading.has(entry.path) && !children && <div className="empty-state">{t('panel.loading')}</div>}
          {children?.map((child) => (
            <TreeNode
              key={child.path}
              entry={child}
              depth={depth + 1}
              onOpen={onOpen}
              filter={filter}
              expanded={expanded}
              toggle={toggle}
              childrenOf={childrenOf}
              loading={loading}
              setLoading={setLoading}
              iconTheme={iconTheme}
            />
          ))}
          {children && children.length === 0 && <div className="empty-state">{t('panel.filesEmptyLabel')}</div>}
        </div>
      )}
    </div>
  )
}

export function FileTree(): JSX.Element {
  const iconTheme = useAppStore((s) => s.settings.iconTheme)
  const openPath = useAppStore((s) => s.openPath)
  const setWorkspaceRoot = useAppStore((s) => s.setWorkspaceRoot)
  const workspaceRoot = useAppStore((s) => s.workspaceRoot)
  const toast = useAppStore((s) => s.toast)
  const [filter, setFilter] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState<Set<string>>(new Set())
  const [rootEntries, setRootEntries] = useState<DirEntry[]>([])
  const t = useT()

  const root = workspaceRoot

  useEffect(() => {
    if (!root) {
      setRootEntries([])
      return
    }
    void window.api.fs
      .readDir(root)
      .then(setRootEntries)
      .catch(() => setRootEntries([]))
  }, [root])

  const toggle = (path: string): void => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const chooseRoot = async (): Promise<void> => {
    const result = await window.api.fs.openDialog({
      title: t('panel.filesOpenFolderTitle'),
      directory: true,
    })
    const folder = result.filePaths[0]
    if (folder) {
      setWorkspaceRoot(folder)
      toast(t('panel.filesWorkspace', { name: folder.split(/[\\/]/).pop() ?? '' }), 'success')
    }
  }

  const visible = useMemo(
    () => rootEntries.filter((e) => e.isDir || matchesFilter(e.name, filter)),
    [rootEntries, filter],
  )

  if (!root) {
    return (
      <div aria-label={t('a11y.fileTree')}>
        <div className="panel-header">
          <span>{t('panel.filesExplorer')}</span>
        </div>
        <div className="empty-state">
          {t('panel.filesNoFolder')}
          <br />
          <button className="icon-btn" style={{ marginTop: 8 }} onClick={() => void chooseRoot()}>
            {t('panel.filesOpenFolder')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div aria-label={t('a11y.fileTree')}>
      <div className="panel-header">
        <span title={root}>{root.split(/[\\/]/).pop()}</span>
        <span style={{ display: 'flex', gap: 4 }}>
          <button className="icon-btn" title={t('panel.filesChangeFolder')} onClick={() => void chooseRoot()}>
            ⤓
          </button>
          <button
            className="icon-btn"
            title={t('panel.filesRefresh')}
            onClick={() => {
              void window.api.fs.readDir(root).then(setRootEntries)
            }}
          >
            ⟳
          </button>
        </span>
      </div>
      <input
        type="text"
        placeholder={t('panel.filesFilter')}
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        style={{ width: '100%', marginBottom: 6 }}
      />
      {visible.map((entry) => (
        <TreeNode
          key={entry.path}
          entry={entry}
          depth={0}
          onOpen={(p) => void openPath(p)}
          filter={filter}
          expanded={expanded}
          toggle={toggle}
          childrenOf={() => []}
          loading={loading}
          setLoading={setLoading}
          iconTheme={iconTheme}
        />
      ))}
    </div>
  )
}

function matchesFilter(name: string, filter: string): boolean {
  return filter.length === 0 || name.toLowerCase().includes(filter.toLowerCase())
}
