import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { JSX } from 'react'

export interface CharacterMapProps {
  /** Called with the character when the user picks one. */
  onInsert?: (char: string) => void
  onClose?: () => void
}

interface CharItem {
  char: string
  code: number
}

interface CharGroupDef {
  id: string
  name: string
  items: CharItem[]
}

/** Build the items of a code point range. */
function fromRange(start: number, end: number): CharItem[] {
  const out: CharItem[] = []
  for (let code = start; code <= end; code += 1) {
    out.push({ char: String.fromCodePoint(code), code })
  }
  return out
}

/** A hand picked set of emoji. */
const EMOJI_CODES = [
  0x1f600, 0x1f601, 0x1f602, 0x1f603, 0x1f604, 0x1f605, 0x1f606, 0x1f607, 0x1f608, 0x1f609, 0x1f60a, 0x1f60b, 0x1f60d,
  0x1f60e, 0x1f612, 0x1f613, 0x1f614, 0x1f615, 0x1f618, 0x1f61a, 0x1f61b, 0x1f61c, 0x1f61d, 0x1f622, 0x1f623, 0x1f625,
  0x1f628, 0x1f62d, 0x1f630, 0x1f631, 0x1f634, 0x1f644, 0x1f64f, 0x1f680, 0x1f6a2, 0x1f4a1, 0x1f4a9, 0x1f4aa, 0x1f4c8,
  0x1f525, 0x2764, 0x1f44d, 0x1f44e, 0x1f44f, 0x1f440, 0x1f3af, 0x1f308, 0x1f31f, 0x1f31e, 0x2600, 0x2601, 0x26a0,
  0x2714, 0x2716, 0x1f984, 0x1f409, 0x1f40d, 0x1f680, 0x1f6a5, 0x1f573,
]

const GROUPS: CharGroupDef[] = [
  { id: 'basic-latin', name: 'Basic Latin', items: fromRange(0x0020, 0x007e) },
  { id: 'latin-1', name: 'Latin-1 Supplement', items: fromRange(0x00a0, 0x00ff) },
  { id: 'punctuation', name: 'Punctuation', items: fromRange(0x2000, 0x206f) },
  { id: 'arrows', name: 'Arrows', items: fromRange(0x2190, 0x21ff) },
  { id: 'math', name: 'Math Operators', items: fromRange(0x2200, 0x22ff) },
  { id: 'box', name: 'Box Drawing', items: fromRange(0x2500, 0x257f) },
  { id: 'greek', name: 'Greek', items: fromRange(0x0370, 0x03ff) },
  { id: 'cyrillic', name: 'Cyrillic', items: fromRange(0x0400, 0x04ff) },
  { id: 'currency', name: 'Currency', items: fromRange(0x20a0, 0x20bf) },
  { id: 'emoji', name: 'Emoji', items: EMOJI_CODES.map((code) => ({ char: String.fromCodePoint(code), code })) },
]

/** Format a code point the way Unicode does. */
function formatCode(code: number): string {
  return `U+${code.toString(16).toUpperCase().padStart(4, '0')}`
}

/**
 * Styles for the parts the application stylesheet does not cover. The grid and the
 * cells use the shared `.charmap-grid` / `.charmap-cell` classes.
 */
const STYLES = `
.cm-root { display: flex; flex-direction: column; min-width: 0; height: 100%; }
.cm-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-bottom: 1px solid var(--border, #313244);
}
.cm-search { flex: 1 1 auto; min-width: 140px; }
.cm-count { color: var(--fg-muted, #8b8b9b); white-space: nowrap; }
.cm-btn {
  padding: 3px 10px;
  border: 1px solid var(--border, #313244);
  border-radius: var(--radius, 4px);
  color: var(--fg-dim, #a6adc8);
  white-space: nowrap;
}
.cm-btn:hover { background: var(--bg-hover, rgba(137, 180, 250, 0.12)); color: var(--fg, #cdd6f4); }
.cm-body { flex: 1 1 auto; overflow: auto; padding: 4px 8px 16px; outline: none; }
.cm-group { margin-bottom: 6px; }
.cm-group-head {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  text-align: left;
  font-weight: 600;
  color: inherit;
  border-bottom: 1px solid var(--border, #2e2e3e);
  padding: 4px 2px;
}
.cm-marker { width: 1em; color: var(--fg-muted, #8b8b9b); }
.cm-grid { padding: 4px 0; }
.cm-cell { position: relative; user-select: none; }
.cm-cell.cm-selected { border-color: var(--accent, #89b4fa); box-shadow: inset 0 0 0 1px var(--accent, #89b4fa); }
.cm-copy {
  position: absolute;
  top: 1px;
  right: 1px;
  padding: 0 2px;
  font-size: 9px;
  line-height: 1;
  color: var(--fg-muted, #8b8b9b);
  border-radius: 2px;
  opacity: 0;
}
.cm-cell:hover .cm-copy { opacity: 1; }
.cm-copy:hover { color: var(--accent, #89b4fa); }
.cm-empty { padding: 12px; color: var(--fg-muted, #8b8b9b); }
`

export function CharacterMap({ onInsert, onClose }: CharacterMapProps): JSX.Element {
  const [query, setQuery] = useState('')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [selected, setSelected] = useState(0)
  const [columns, setColumns] = useState(12)
  const [copied, setCopied] = useState<string | null>(null)
  const bodyRef = useRef<HTMLDivElement | null>(null)
  const searchRef = useRef<HTMLInputElement | null>(null)
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const needle = query.trim().toLowerCase()

  const groups = useMemo(() => {
    if (!needle) return GROUPS
    return GROUPS.map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        const code = formatCode(item.code)
        return (
          item.char.toLowerCase().includes(needle) ||
          code.toLowerCase().includes(needle) ||
          code.slice(2).toLowerCase().includes(needle)
        )
      }),
    })).filter((group) => group.items.length > 0)
  }, [needle])

  const isOpen = useCallback((id: string): boolean => (needle ? true : !collapsed.has(id)), [collapsed, needle])

  /** All characters of the visible groups, in the order they are painted. */
  const visible = useMemo(() => {
    const out: CharItem[] = []
    for (const group of groups) {
      if (!isOpen(group.id)) continue
      for (const item of group.items) out.push(item)
    }
    return out
  }, [groups, isOpen])

  /** Position of every character inside the visible list. */
  const indexOf = useMemo(() => {
    const map = new Map<CharItem, number>()
    visible.forEach((item, index) => map.set(item, index))
    return map
  }, [visible])

  const toggleGroup = useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const insert = useCallback(
    (char: string) => {
      onInsert?.(char)
    },
    [onInsert],
  )

  const copy = useCallback(async (char: string) => {
    try {
      await navigator.clipboard.writeText(char)
      setCopied(char)
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
      copyTimerRef.current = setTimeout(() => setCopied(null), 900)
    } catch (err) {
      console.error('[opennotes] could not copy the character:', err)
    }
  }, [])

  // Measure how many characters fit in one row so the arrow keys can navigate.
  useLayoutEffect(() => {
    const body = bodyRef.current
    if (!body) return
    const measure = (): void => {
      const grid = body.querySelector<HTMLElement>('.charmap-grid')
      if (!grid) {
        setColumns(1)
        return
      }
      const cells = Array.from(grid.querySelectorAll<HTMLElement>('.charmap-cell'))
      if (!cells.length) {
        setColumns(1)
        return
      }
      const top = cells[0].offsetTop
      let count = 0
      for (const cell of cells) {
        if (cell.offsetTop !== top) break
        count += 1
      }
      setColumns(Math.max(1, count))
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => requestAnimationFrame(measure))
    observer.observe(body)
    return () => observer.disconnect()
  }, [visible.length, needle])

  // Keep the selection inside the visible range.
  useEffect(() => {
    if (selected >= visible.length) setSelected(Math.max(0, visible.length - 1))
  }, [selected, visible.length])

  // Scroll the selected character into view.
  useEffect(() => {
    const body = bodyRef.current
    if (!body) return
    const cell = body.querySelector<HTMLElement>(`[data-index="${selected}"]`)
    cell?.scrollIntoView({ block: 'nearest' })
  }, [selected])

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
    }
  }, [])

  const move = useCallback(
    (delta: number) => {
      if (!visible.length) return
      setSelected((prev) => {
        const next = prev + delta
        if (next < 0) return 0
        if (next >= visible.length) return visible.length - 1
        return next
      })
    },
    [visible.length],
  )

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      switch (event.key) {
        case 'ArrowRight':
          event.preventDefault()
          move(1)
          break
        case 'ArrowLeft':
          event.preventDefault()
          move(-1)
          break
        case 'ArrowDown':
          event.preventDefault()
          move(columns)
          break
        case 'ArrowUp':
          event.preventDefault()
          move(-columns)
          break
        case 'Home':
          event.preventDefault()
          setSelected(0)
          break
        case 'End':
          event.preventDefault()
          setSelected(Math.max(0, visible.length - 1))
          break
        case 'Enter': {
          event.preventDefault()
          const item = visible[selected]
          if (item) insert(item.char)
          break
        }
        case 'Escape':
          event.preventDefault()
          if (query) setQuery('')
          else searchRef.current?.blur()
          break
        default:
          break
      }
    },
    [columns, insert, move, query, selected, visible],
  )

  return (
    <div className="cm-root">
      <style>{STYLES}</style>
      <div className="cm-header">
        <input
          ref={searchRef}
          className="cm-search"
          type="text"
          value={query}
          placeholder="Search characters or code points (e.g. arrow, U+2190)"
          onChange={(event) => {
            setQuery(event.target.value)
            setSelected(0)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setQuery('')
              return
            }
            // Up and down navigate the grid while the search box keeps the focus.
            if (event.key === 'ArrowDown') {
              event.preventDefault()
              move(columns)
              return
            }
            if (event.key === 'ArrowUp') {
              event.preventDefault()
              move(-columns)
              return
            }
            if (event.key === 'Enter') {
              event.preventDefault()
              const item = visible[selected]
              if (item) insert(item.char)
            }
          }}
        />
        <span className="cm-count">
          {visible.length} character{visible.length === 1 ? '' : 's'}
        </span>
        {copied ? <span className="cm-count">Copied {copied}</span> : null}
        {onClose ? (
          <button type="button" className="cm-btn" onClick={onClose} title="Close">
            ✕
          </button>
        ) : null}
      </div>

      <div className="cm-body" ref={bodyRef} tabIndex={0} onKeyDown={handleKeyDown}>
        {groups.length === 0 ? <div className="cm-empty">No character matches “{query}”.</div> : null}

        {groups.map((group) => {
          const open = isOpen(group.id)
          return (
            <section className="cm-group" key={group.id}>
              <button
                type="button"
                className="cm-group-head"
                onClick={() => toggleGroup(group.id)}
                aria-expanded={open}
              >
                <span className="cm-marker">{open ? '▾' : '▸'}</span>
                <span>{group.name}</span>
                <span className="cm-count">({group.items.length})</span>
              </button>
              {open ? (
                <div className="charmap-grid cm-grid">
                  {group.items.map((item) => {
                    const flatIndex = indexOf.get(item) ?? -1
                    return (
                      <div
                        key={item.code}
                        className={`charmap-cell cm-cell${flatIndex === selected ? ' cm-selected' : ''}`}
                        data-index={flatIndex}
                        role="button"
                        tabIndex={-1}
                        title={`${item.char}  ${formatCode(item.code)}`}
                        onClick={() => insert(item.char)}
                      >
                        <span className="glyph">{item.char}</span>
                        <span className="code">{formatCode(item.code)}</span>
                        <button
                          type="button"
                          className="cm-copy"
                          title="Copy to clipboard"
                          onClick={(event) => {
                            event.stopPropagation()
                            void copy(item.char)
                          }}
                        >
                          ⧉
                        </button>
                      </div>
                    )
                  })}
                </div>
              ) : null}
            </section>
          )
        })}
      </div>
    </div>
  )
}
