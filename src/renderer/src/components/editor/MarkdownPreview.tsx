import type { JSX } from 'react'
/**
 * Markdown preview.
 *
 * The markdown is rendered with `marked` and sanitised with DOMPurify.
 */

import { useEffect, useMemo, useRef } from 'react'
import { marked } from 'marked'
import DOMPurify from 'dompurify'

export interface MarkdownPreviewProps {
  /** Markdown source. */
  source: string
  /** Called when a link is clicked. */
  onOpenLink?: (target: string) => void
  /** Extra class names for the container. */
  className?: string
}

function markedToHtml(source: string): string {
  try {
    const parsed = marked.parse(source, { async: false, gfm: true, breaks: false })
    return typeof parsed === 'string' ? parsed : ''
  } catch {
    return ''
  }
}

/** Render markdown into sanitised HTML. */
export function renderMarkdown(source: string): string {
  // Rendering a multi megabyte document would freeze the window: preview only
  // the first chunk and let the user open the file in a code editor for the rest.
  const MAX_PREVIEW = 200 * 1024
  const clipped = source.length > MAX_PREVIEW ? `${source.slice(0, MAX_PREVIEW)}\n\n…` : source
  const html = markedToHtml(clipped)
  if (!html) return ''
  try {
    return DOMPurify.sanitize(html)
  } catch {
    return html
  }
}

/** Read-only markdown preview with clickable links. */
export function MarkdownPreview({ source, onOpenLink, className }: MarkdownPreviewProps): JSX.Element {
  const html = useMemo(() => renderMarkdown(source), [source])
  const hostRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const handleClick = (event: MouseEvent): void => {
      const target = event.target as HTMLElement | null
      const anchor = target?.closest('a') as HTMLAnchorElement | null
      if (!anchor) return
      event.preventDefault()
      const href = anchor.getAttribute('href')
      if (href) onOpenLink?.(href)
    }
    host.addEventListener('click', handleClick)
    return () => host.removeEventListener('click', handleClick)
  }, [onOpenLink])

  const classes = className ? `markdown-preview ${className}` : 'markdown-preview'
  return (
    <div
      ref={hostRef}
      className={classes}
      // The HTML is sanitised by DOMPurify inside renderMarkdown.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
