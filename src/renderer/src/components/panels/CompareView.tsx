import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { JSX } from 'react'
import { diffLines, diffWords } from 'diff'

export interface CompareViewProps {
  /** Content of the left (old) side. */
  left: string
  /** Content of the right (new) side. */
  right: string
  leftName?: string
  rightName?: string
  onClose?: () => void
}

type RowKind = 'same' | 'added' | 'removed' | 'modified'

interface DiffRow {
  kind: RowKind
  left: string
  right: string
  leftNo: number | null
  rightNo: number | null
}

interface UnifiedRow {
  kind: 'same' | 'added' | 'removed'
  text: string
  no: number | null
  source: number
}

interface WordPart {
  text: string
  changed: boolean
}

/**
 * Styles for the parts the application stylesheet does not cover. Everything else
 * uses the shared `.compare-*` / `.diff-*` / `.charmap-*` classes.
 */
const STYLES = `
.compare-file { font-weight: 600; max-width: 32ch; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.compare-summary { color: var(--fg-muted, #8b8b9b); white-space: nowrap; }
.compare-spacer { flex: 1 1 auto; }
.compare-btn {
  padding: 3px 10px;
  border: 1px solid var(--border, #313244);
  border-radius: var(--radius, 4px);
  color: var(--fg-dim, #a6adc8);
  white-space: nowrap;
}
.compare-btn:hover { background: var(--bg-hover, rgba(137, 180, 250, 0.12)); color: var(--fg, #cdd6f4); }
.compare-group { display: inline-flex; gap: 4px; }
.cmp-cell { display: flex; gap: 8px; min-width: 0; }
.cmp-gutter { flex: 0 0 auto; min-width: 3.5em; text-align: right; color: var(--fg-muted, #6b7089); user-select: none; }
.cmp-code { flex: 1 1 auto; min-width: 0; }
.cmp-marker { flex: 0 0 auto; width: 1ch; color: var(--fg-muted, #6b7089); }
.diff-word-added { background: rgba(166, 227, 161, 0.45); border-radius: 2px; }
.diff-word-removed { background: rgba(243, 139, 168, 0.45); border-radius: 2px; text-decoration: line-through; }
.diff-flash { animation: diff-flash 1.1s ease-out; }
@keyframes diff-flash {
  from { background-color: rgba(255, 214, 102, 0.45); }
  to { background-color: transparent; }
}
.compare-unified .diff-row { grid-template-columns: 1fr; }
.compare-empty { padding: 16px; color: var(--fg-muted, #8b8b9b); }
`

/** Split a diff chunk into lines, dropping the phantom line of a trailing newline. */
function toLines(value: string): string[] {
  if (value === '') return []
  const lines = value.split(/\r\n|\n|\r/)
  if (lines.length && lines[lines.length - 1] === '') lines.pop()
  return lines
}

/**
 * Make sure both sides end with a line separator.
 *
 * `diffLines` keeps the trailing newline in its tokens, so a file without one would
 * otherwise look different from the very same file with one.
 */
function normalize(text: string): string {
  if (text === '') return '\n'
  return /\r\n$|\n$|\r$/.test(text) ? text : `${text}\n`
}

/** Build the aligned rows of the two sides. */
function buildRows(left: string, right: string): DiffRow[] {
  const parts = diffLines(normalize(left), normalize(right))
  const rows: DiffRow[] = []
  let leftNo = 0
  let rightNo = 0
  let index = 0

  while (index < parts.length) {
    const part = parts[index]
    if (part.added) {
      for (const line of toLines(part.value)) {
        rightNo += 1
        rows.push({ kind: 'added', left: '', right: line, leftNo: null, rightNo })
      }
      index += 1
      continue
    }
    if (part.removed) {
      const removed = toLines(part.value)
      const next = parts[index + 1]
      if (next && next.added) {
        // A removal directly followed by an addition is a changed line.
        const added = toLines(next.value)
        const count = Math.max(removed.length, added.length)
        for (let i = 0; i < count; i += 1) {
          const oldLine = removed[i]
          const newLine = added[i]
          if (oldLine !== undefined) leftNo += 1
          if (newLine !== undefined) rightNo += 1
          rows.push({
            kind: 'modified',
            left: oldLine ?? '',
            right: newLine ?? '',
            leftNo: oldLine !== undefined ? leftNo : null,
            rightNo: newLine !== undefined ? rightNo : null,
          })
        }
        index += 2
        continue
      }
      for (const line of removed) {
        leftNo += 1
        rows.push({ kind: 'removed', left: line, right: '', leftNo, rightNo: null })
      }
      index += 1
      continue
    }
    for (const line of toLines(part.value)) {
      leftNo += 1
      rightNo += 1
      rows.push({ kind: 'same', left: line, right: line, leftNo, rightNo })
    }
    index += 1
  }

  return rows
}

/** Word level parts of one side of a changed line. */
function wordParts(left: string, right: string, side: 'left' | 'right'): WordPart[] {
  const parts = diffWords(left, right)
  const out: WordPart[] = []
  for (const part of parts) {
    if (side === 'left') {
      if (part.added) continue
      out.push({ text: part.value, changed: !!part.removed })
    } else {
      if (part.removed) continue
      out.push({ text: part.value, changed: !!part.added })
    }
  }
  return out
}

export function CompareView({
  left,
  right,
  leftName = 'Original',
  rightName = 'Modified',
  onClose,
}: CompareViewProps): JSX.Element {
  const [swapped, setSwapped] = useState(false)
  const [mode, setMode] = useState<'split' | 'unified'>('split')
  const [cursor, setCursor] = useState(-1)
  const [flash, setFlash] = useState(-1)

  const bodyRef = useRef<HTMLDivElement | null>(null)
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const leftText = swapped ? right : left
  const rightText = swapped ? left : right
  const leftTitle = swapped ? rightName : leftName
  const rightTitle = swapped ? leftName : rightName

  const rows = useMemo(() => buildRows(leftText, rightText), [leftText, rightText])

  const unifiedRows = useMemo<UnifiedRow[]>(() => {
    const out: UnifiedRow[] = []
    rows.forEach((row, index) => {
      if (row.kind === 'same') {
        out.push({ kind: 'same', text: row.left, no: row.leftNo, source: index })
      } else if (row.kind === 'removed') {
        out.push({ kind: 'removed', text: row.left, no: row.leftNo, source: index })
      } else if (row.kind === 'added') {
        out.push({ kind: 'added', text: row.right, no: row.rightNo, source: index })
      } else {
        if (row.leftNo !== null) out.push({ kind: 'removed', text: row.left, no: row.leftNo, source: index })
        if (row.rightNo !== null) out.push({ kind: 'added', text: row.right, no: row.rightNo, source: index })
      }
    })
    return out
  }, [rows])

  /** Indices of the rows that hold a change. */
  const changes = useMemo(
    () => rows.map((row, index) => (row.kind === 'same' ? -1 : index)).filter((index) => index >= 0),
    [rows],
  )

  const summary = useMemo(() => {
    let added = 0
    let removed = 0
    for (const row of rows) {
      if (row.kind === 'added') added += 1
      else if (row.kind === 'removed') removed += 1
      else if (row.kind === 'modified') {
        added += 1
        removed += 1
      }
    }
    return { added, removed }
  }, [rows])

  /** Word level parts of the changed lines, computed once per row. */
  const wordCache = useMemo(() => {
    const map = new Map<number, { left: WordPart[]; right: WordPart[] }>()
    rows.forEach((row, index) => {
      if (row.kind !== 'modified') return
      map.set(index, {
        left: wordParts(row.left, row.right, 'left'),
        right: wordParts(row.left, row.right, 'right'),
      })
    })
    return map
  }, [rows])

  useEffect(() => {
    setCursor(-1)
    setFlash(-1)
  }, [rows])

  useEffect(() => {
    return () => {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
    }
  }, [])

  /** Scroll the body so that the given row is centred. */
  const scrollToRow = useCallback((index: number) => {
    const container = bodyRef.current
    if (!container) return
    const element = container.querySelector<HTMLElement>(`[data-row="${index}"]`)
    if (!element) return
    const offset = element.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop
    container.scrollTop = Math.max(0, offset - container.clientHeight / 2 + element.offsetHeight / 2)
  }, [])

  const gotoChange = useCallback(
    (direction: 1 | -1) => {
      if (!changes.length) return
      const next = (cursor + direction + changes.length) % changes.length
      setCursor(next)
      const index = changes[next]
      scrollToRow(index)
      setFlash(index)
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
      flashTimerRef.current = setTimeout(() => setFlash(-1), 1200)
    },
    [changes, cursor, scrollToRow],
  )

  const renderCode = (row: DiffRow, side: 'left' | 'right', index: number): JSX.Element => {
    const text = side === 'left' ? row.left : row.right
    if (!text) return <span className="cmp-code" />
    if (row.kind !== 'modified') return <span className="cmp-code">{text}</span>
    const parts = wordCache.get(index)?.[side] ?? [{ text, changed: false }]
    return (
      <span className="cmp-code">
        {parts.map((part, partIndex) =>
          part.changed ? (
            <span key={partIndex} className={side === 'left' ? 'diff-word-removed' : 'diff-word-added'}>
              {part.text}
            </span>
          ) : (
            <span key={partIndex}>{part.text}</span>
          ),
        )}
      </span>
    )
  }

  /** Class of a row: the kind describes the change of the whole line. */
  const rowClass = (row: DiffRow, index: number): string =>
    `diff-row diff-${row.kind}${index === flash ? ' diff-flash' : ''}`

  /**
   * Class of one side of a row. The empty counterpart of an inserted or deleted
   * line stays neutral so only the changed side is tinted.
   */
  const cellClass = (row: DiffRow, side: 'left' | 'right'): string => {
    if (side === 'left') {
      return row.kind === 'removed' || row.kind === 'modified' ? 'diff-removed' : 'diff-same'
    }
    return row.kind === 'added' || row.kind === 'modified' ? 'diff-added' : 'diff-same'
  }

  return (
    <div className="compare-view">
      <style>{STYLES}</style>
      <div className="compare-header">
        <div className="compare-title">
          <span className="compare-file" title={leftTitle}>
            {leftTitle}
          </span>
          <span className="compare-summary">vs</span>
          <span className="compare-file" title={rightTitle}>
            {rightTitle}
          </span>
        </div>
        <span className="compare-summary">
          {summary.added} added, {summary.removed} removed
        </span>
        <span className="compare-spacer" />
        <div className="compare-group">
          <button
            type="button"
            className={`icon-btn${mode === 'split' ? ' active' : ''}`}
            onClick={() => setMode('split')}
          >
            Split
          </button>
          <button
            type="button"
            className={`icon-btn${mode === 'unified' ? ' active' : ''}`}
            onClick={() => setMode('unified')}
          >
            Unified
          </button>
        </div>
        <button type="button" className="icon-btn" onClick={() => gotoChange(-1)} title="Previous difference">
          ▲
        </button>
        <button type="button" className="icon-btn" onClick={() => gotoChange(1)} title="Next difference">
          ▼
        </button>
        <button type="button" className="compare-btn" onClick={() => setSwapped(!swapped)}>
          Swap sides
        </button>
        {onClose ? (
          <button type="button" className="icon-btn" onClick={onClose} title="Close">
            ✕
          </button>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <div className="compare-empty">Nothing to compare.</div>
      ) : (
        <div className={`compare-body${mode === 'unified' ? ' compare-unified' : ''}`} ref={bodyRef}>
          {mode === 'split'
            ? rows.map((row, index) => (
                <div key={index} className={rowClass(row, index)} data-row={index}>
                  <div className={`cmp-cell ${cellClass(row, 'left')}`}>
                    <span className="cmp-gutter">{row.leftNo ?? ''}</span>
                    {renderCode(row, 'left', index)}
                  </div>
                  <div className={`cmp-cell ${cellClass(row, 'right')}`}>
                    <span className="cmp-gutter">{row.rightNo ?? ''}</span>
                    {renderCode(row, 'right', index)}
                  </div>
                </div>
              ))
            : unifiedRows.map((row, index) => (
                <div
                  key={index}
                  className={`diff-row diff-${row.kind}${row.source === flash ? ' diff-flash' : ''}`}
                  data-row={row.source}
                >
                  <div className="cmp-cell">
                    <span className="cmp-gutter">{row.no ?? ''}</span>
                    <span className="cmp-marker">
                      {row.kind === 'added' ? '+' : row.kind === 'removed' ? '-' : ' '}
                    </span>
                    <span className="cmp-code">{row.text}</span>
                  </div>
                </div>
              ))}
        </div>
      )}
    </div>
  )
}
