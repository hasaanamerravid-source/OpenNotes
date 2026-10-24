import type { JSX } from 'react'

export type IconName =
  | 'menu'
  | 'newFile'
  | 'open'
  | 'save'
  | 'search'
  | 'settings'
  | 'run'
  | 'split'
  | 'close'
  | 'undo'
  | 'redo'
  | 'folder'
  | 'file'
  | 'chevronRight'
  | 'chevronDown'
  | 'terminal'
  | 'compare'
  | 'macro'
  | 'bookmark'
  | 'graph'
  | 'play'
  | 'explorer'
  | 'outline'
  | 'problems'
  | 'plugins'
  | 'more'
  | 'stop'
  | 'refresh'
  | 'warning'
  | 'error'
  | 'info'
  | 'git'
  | 'lock'
  | 'debug'
  | 'breakpoint'
  | 'variable'
  | 'typeHierarchy'
  | 'reference'
  | 'implementation'

const PATHS: Record<IconName, JSX.Element> = {
  menu: (
    <>
      <path d="M2 4h12M2 8h12M2 12h12" />
    </>
  ),
  newFile: (
    <>
      <path d="M9 1.5H4.5A1.5 1.5 0 0 0 3 3v10A1.5 1.5 0 0 0 4.5 14.5h7A1.5 1.5 0 0 0 13 13V5.5z" />
      <path d="M9 1.5V5a.5.5 0 0 0 .5.5H13" />
    </>
  ),
  open: (
    <>
      <path d="M1.5 3.5h4l1.5 2h7.5v8.5a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1z" />
    </>
  ),
  save: (
    <>
      <path d="M2 2.5h9.5L13.5 4.5v9H2z" />
      <path d="M4.5 2.5v4h6v-4M4.5 13.5v-4h7v4" />
    </>
  ),
  search: (
    <>
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.5 10.5 14 14" />
    </>
  ),
  settings: (
    <>
      <circle cx="8" cy="8" r="2.2" />
      <path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M12.6 3.4l-1.4 1.4M4.8 11.2l-1.4 1.4" />
    </>
  ),
  run: (
    <>
      <path d="M4 2.5 12.5 8 4 13.5z" />
    </>
  ),
  split: (
    <>
      <rect x="1.5" y="2.5" width="13" height="11" rx="1" />
      <path d="M8 2.5v11" />
    </>
  ),
  close: (
    <>
      <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />
    </>
  ),
  undo: (
    <>
      <path d="M3 7h7a3.5 3.5 0 0 1 0 7H6" />
      <path d="M5.5 4 2.5 7l3 3" />
    </>
  ),
  redo: (
    <>
      <path d="M13 7H6a3.5 3.5 0 0 0 0 7h4" />
      <path d="M10.5 4l3 3-3 3" />
    </>
  ),
  folder: (
    <>
      <path d="M1.5 12.5v-8A1 1 0 0 1 2.5 3.5h3l1.5 2h6.5a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1z" />
    </>
  ),
  file: (
    <>
      <path d="M3.5 1.5h5L12 5v9.5h-8.5z" />
    </>
  ),
  chevronRight: <path d="M6 3.5 10.5 8 6 12.5" />,
  chevronDown: <path d="M3.5 6 8 10.5 12.5 6" />,
  terminal: (
    <>
      <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" />
      <path d="M4.5 6.5 6.5 8.5 4.5 10.5M8.5 10.5h3" />
    </>
  ),
  compare: (
    <>
      <path d="M8 1.5v13" />
      <path d="M4.5 4 2 8l2.5 4M11.5 4 14 8l-2.5 4" />
    </>
  ),
  macro: (
    <>
      <circle cx="8" cy="8" r="5.5" />
      <path d="M8 5v3l2 1.5" />
    </>
  ),
  bookmark: (
    <>
      <path d="M4 1.5h8v13l-4-3-4 3z" />
    </>
  ),
  graph: (
    <>
      <circle cx="3.5" cy="4" r="1.8" />
      <circle cx="12.5" cy="6" r="1.8" />
      <circle cx="6" cy="12" r="1.8" />
      <path d="M5 4.8 10.8 5.6M11.6 7.5 7.3 10.6M4.6 5.6 5.4 10.2" />
    </>
  ),
  play: <path d="M4 2.5 12.5 8 4 13.5z" />,
  explorer: (
    <>
      <path d="M1.5 3.5h5l1.5 2h6.5v8h-13z" />
      <path d="M1.5 3.5v-1h4l1.5 1.5" />
    </>
  ),
  outline: (
    <>
      <path d="M3 2.5h10M3 6.5h10M3 10.5h10M3 14.5h6" />
    </>
  ),
  problems: (
    <>
      <path d="M8 1.8 14.6 13.4H1.4z" />
      <path d="M8 6v3.4M8 11.2v.6" />
    </>
  ),
  plugins: (
    <>
      <path d="M5.5 2v3M10.5 2v3" />
      <path d="M3 5h10v3.5a5 5 0 0 1-10 0z" />
      <path d="M8 13.5V16" />
    </>
  ),
  more: (
    <>
      <circle cx="8" cy="3" r="1" fill="currentColor" stroke="none" />
      <circle cx="8" cy="8" r="1" fill="currentColor" stroke="none" />
      <circle cx="8" cy="13" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  stop: <rect x="4" y="4" width="8" height="8" rx="1" />,
  refresh: (
    <>
      <path d="M13.5 8a5.5 5.5 0 1 1-1.7-4" />
      <path d="M13.5 1.5V5H10" />
    </>
  ),
  warning: (
    <>
      <path d="M8 2.2 14.4 13.4H1.6z" />
      <path d="M8 6.4v3.2M8 11.4v.5" />
    </>
  ),
  error: (
    <>
      <circle cx="8" cy="8" r="6" />
      <path d="M5.8 5.8 10.2 10.2M10.2 5.8 5.8 10.2" />
    </>
  ),
  info: (
    <>
      <circle cx="8" cy="8" r="6" />
      <path d="M8 7.2v4M8 4.6v.6" />
    </>
  ),
  git: (
    <>
      <path d="M12 2.5c5.2 0 9.5 4.3 9.5 9.5s-4.3 9.5-9.5 9.5S2.5 17.2 2.5 12 6.8 2.5 12 2.5M12 11.5l-2.5 2.5 1.1 1.1L12 13.6l2.5 2.5 1.1-1.1L13.1 12.5z" />
    </>
  ),
  lock: (
    <>
      <rect x="4" y="6" width="8" height="9" rx="1" />
      <path d="M8 10V8c0-1.1 0.9-2 2-2s2 0.9 2 2v2z" />
    </>
  ),
  debug: (
    <>
      <circle cx="8" cy="8" r="5" />
      <path d="M8 13V7M3 8h10" />
    </>
  ),
  breakpoint: (
    <>
      <circle cx="8" cy="8" r="4" fill="currentColor" />
      <circle cx="8" cy="8" r="1.5" fill="none" stroke="currentColor" strokeWidth="2" />
    </>
  ),
  variable: (
    <>
      <path d="M4 7h8M4 11h6M4 15h4" />
    </>
  ),
  typeHierarchy: (
    <>
      <path d="M8 4h2v2H8zM8 8h2v2H8zM8 12h2v2H8z" />
    </>
  ),
  reference: (
    <>
      <path d="M4 12h8M4 7h4M4 15h8" />
    </>
  ),
  implementation: (
    <>
      <circle cx="8" cy="4" r="1" />
      <circle cx="8" cy="8" r="1" />
      <circle cx="8" cy="12" r="1" />
      <path d="M4 16l2-2 2 2M12 4l-2 2-2-2M4 8h8M4 12h8" />
    </>
  ),
}

export interface IconProps {
  name: IconName
  size?: number
  className?: string
  title?: string
}

/** Clean line icons (1.5 px strokes on a 16 px grid). */
export function Icon({ name, size = 16, className, title }: IconProps): JSX.Element {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? 'img' : 'presentation'}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      style={{ display: 'inline-block', verticalAlign: '-3px', flex: '0 0 auto' }}
    >
      {title && <title>{title}</title>}
      {PATHS[name]}
    </svg>
  )
}
