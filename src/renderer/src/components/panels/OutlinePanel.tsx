/**
 * Outline panel: heading tree of the markdown document that is currently open.
 */

import { useMemo } from 'react'
import type { JSX } from 'react'
import { useT } from '../../core/i18n'

export interface OutlinePanelProps {
  /** Full text of the document that is open. */
  content: string
  /** Name of the document (as a subtitle). */
  title?: string
  onOpenLine?: (line: number) => void
}

interface OutlineEntry {
  text: string
  level: number
  line: number
  depth: number
}

interface Heading {
  level: number
  text: string
  line: number
}

/** Blank out fenced code blocks and inline code, keeping line structure. */
function maskCode(lines: string[]): string[] {
  const out: string[] = []
  let inFence = false
  let fenceChar = ''
  for (const line of lines) {
    const fence = /^\s*(`{3,}|~{3,})/.exec(line)
    if (fence) {
      const marker = fence[1][0]
      if (!inFence) {
        inFence = true
        fenceChar = marker
        out.push(' '.repeat(line.length))
        continue
      }
      if (marker === fenceChar) {
        inFence = false
        fenceChar = ''
      }
      out.push(' '.repeat(line.length))
      continue
    }
    if (inFence) {
      out.push(' '.repeat(line.length))
      continue
    }
    out.push(line.replace(/(`+)(?:[^`]|`(?!`))*?\1/g, (match) => ' '.repeat(match.length)))
  }
  return out
}

/** Collect ATX (`# Title`) headings of the document. */
function extractHeadings(source: string): Heading[] {
  const lines = source.split(/\r?\n/)
  const masked = maskCode(lines)
  const out: Heading[] = []
  for (let i = 0; i < masked.length; i++) {
    const atx = /^ {0,3}(#{1,6})[ \t]+(.*?)[ \t]*$/.exec(masked[i])
    if (atx) {
      const text = atx[2].replace(/[ \t]+#+[ \t]*$/, '').trim()
      out.push({ level: atx[1].length, text, line: i + 1 })
    }
  }
  return out
}

export function OutlinePanel({ content, title, onOpenLine }: OutlinePanelProps): JSX.Element {
  const headings = useMemo(() => extractHeadings(content), [content])
  const t = useT()

  const entries = useMemo<OutlineEntry[]>(() => {
    const stack: number[] = []
    const out: OutlineEntry[] = []
    for (const heading of headings) {
      while (stack.length && stack[stack.length - 1] >= heading.level) stack.pop()
      stack.push(heading.level)
      out.push({
        text: heading.text,
        level: heading.level,
        line: heading.line,
        depth: Math.max(0, stack.length - 1),
      })
    }
    return out
  }, [headings])

  return (
    <div className="panel outline-panel">
      <div className="panel-header">
        <span className="panel-title">{t('panel.outline')}</span>
        <span className="panel-subtitle">{title ?? ''}</span>
      </div>
      <div className="panel-body">
        {entries.length === 0 ? (
          <div className="empty-state panel-empty">{t('panel.outlineEmpty')}</div>
        ) : (
          <div className="panel-list outline-list">
            {entries.map((entry, position) => (
              <div
                className="panel-item outline-item"
                key={`${entry.line}-${position}`}
                role="button"
                tabIndex={0}
                title={t('panel.outlineLine', { line: entry.line })}
                data-line={entry.line}
                style={{ paddingLeft: `${entry.depth * 14}px` }}
                onClick={() => onOpenLine?.(entry.line)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') onOpenLine?.(entry.line)
                }}
              >
                <span className="name">{entry.text || t('panel.outlineUntitled')}</span>
                <span className="count">H{entry.level}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
