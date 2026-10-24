import type { JSX } from 'react'
import { ICON_SHAPES, iconKindFor, type IconKind } from '../core/iconShapes'
import { iconTheme } from '../core/iconThemes'

export interface FileIconProps {
  /** File or folder name. */
  name: string
  isDirectory?: boolean
  /** Icon theme id (see core/iconThemes.ts). */
  theme?: string
  size?: number
  className?: string
}

/** Renders the file type icon of the active icon theme. */
export function FileIcon({
  name,
  isDirectory = false,
  theme = 'seti',
  size = 15,
  className,
}: FileIconProps): JSX.Element | null {
  const pack = iconTheme(theme)
  const kind: IconKind = iconKindFor(name, isDirectory)
  const path = pack.shapes?.[kind] ?? ICON_SHAPES[kind]
  if (!path) return null
  const color = pack.monochrome ? 'currentColor' : (pack.colors[kind] ?? 'currentColor')
  if (theme === 'none') return null
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      style={{ color, flex: '0 0 auto', display: 'inline-block', verticalAlign: '-2px' }}
      aria-hidden="true"
    >
      <path d={path} fill="currentColor" />
    </svg>
  )
}
