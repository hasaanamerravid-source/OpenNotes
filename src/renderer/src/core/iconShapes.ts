/**
 * Shared SVG shape library for the file tree and tab bar.
 *
 * Every shape is plain SVG path data on a `0 0 24 24` viewBox. The renderer
 * builds the `<svg>` element itself, so this module never touches the DOM.
 *
 * Authoring rules (important for the renderer):
 *  - The paths are meant to be painted with `fill`, never with `stroke`.
 *    Detail is drawn with filled sub-paths (thick "brush strokes") instead.
 *  - Sub-paths are combined with the default `nonzero` fill rule, so a hole
 *    is made by giving the inner contour the opposite winding direction.
 *  - Shapes stay inside the 24x24 box and are legible at 16 px.
 *
 * The silhouettes follow the visual language of the popular open source icon
 * packs (Seti UI, Material Design Icons, Devicons, Minimal, File Icons for
 * VS Code, Nerd Font) - see `iconThemes.ts` for the per-theme credits.
 */

/** The file kinds OpenNotes knows about. */
export type IconKind =
  | 'folder'
  | 'folder-open'
  | 'file'
  | 'code'
  | 'text'
  | 'markdown'
  | 'data'
  | 'config'
  | 'image'
  | 'video'
  | 'audio'
  | 'font'
  | 'archive'
  | 'binary'
  | 'pdf'
  | 'spreadsheet'
  | 'presentation'
  | 'java'
  | 'kotlin'
  | 'go'
  | 'rust'
  | 'python'
  | 'cpp'
  | 'csharp'
  | 'php'
  | 'ruby'
  | 'swift'
  | 'sql'
  | 'shell'
  | 'html'
  | 'css'
  | 'json'
  | 'yaml'
  | 'xml'
  | 'markdown-file'
  | 'lock'
  | 'docker'
  | 'git'

/** All kinds in display order - handy for building palettes. */
export const ICON_KINDS: IconKind[] = [
  'folder',
  'folder-open',
  'file',
  'code',
  'text',
  'markdown',
  'data',
  'config',
  'image',
  'video',
  'audio',
  'font',
  'archive',
  'binary',
  'pdf',
  'spreadsheet',
  'presentation',
  'java',
  'kotlin',
  'go',
  'rust',
  'python',
  'cpp',
  'csharp',
  'php',
  'ruby',
  'swift',
  'sql',
  'shell',
  'html',
  'css',
  'json',
  'yaml',
  'xml',
  'markdown-file',
  'lock',
  'docker',
  'git',
]

/**
 * A document sheet with a folded corner, drawn as an outline.
 * Reused by most language icons.
 */
const PAGE = 'M5 2 L14 2 L19 7 L19 22 L5 22 Z M7 4 L7 20 L17 20 L17 8.5 L12.5 4 Z'

/** A rectangular frame (picture frame, table, screen). */
const FRAME = 'M3 4 L21 4 L21 20 L3 20 Z M5 6 L5 18 L19 18 L19 6 Z'

/** SVG path data (viewBox "0 0 24 24") for a kind. */
export const ICON_SHAPES: Record<IconKind, string> = {
  /* ---------------------------------------------------------------- files */
  folder: 'M2 6 L9 6 L11 8 L22 8 L22 20 L2 20 Z M4 10 L4 18 L20 18 L20 10 Z',
  'folder-open': 'M2 6 L9 6 L11 8 L21 8 L21 10 L4 10 L4 20 L2 20 Z M6 11 L22 11 L18 20 L2 20 Z',
  file: PAGE,
  code: PAGE + ' M10 9 L7.4 12 L10 15 L11 14 L9.4 12 L11 10 Z' + ' M14 9 L16.6 12 L14 15 L13 14 L14.6 12 L13 10 Z',
  text:
    PAGE +
    ' M8 9 L16 9 L16 10.5 L8 10.5 Z' +
    ' M8 12 L16 12 L16 13.5 L8 13.5 Z' +
    ' M8 15 L16 15 L16 16.5 L8 16.5 Z' +
    ' M8 18 L12.5 18 L12.5 19.5 L8 19.5 Z',
  markdown:
    PAGE +
    ' M7.6 9 L9 9 L9 16 L7.6 16 Z' +
    ' M15 9 L16.4 9 L16.4 16 L15 16 Z' +
    ' M9 9 L10.4 9 L12 13.4 L10.6 13.4 Z' +
    ' M15 9 L13.6 9 L12 13.4 L13.4 13.4 Z',
  'markdown-file':
    'M3 2 L21 2 L21 22 L3 22 Z M5 4 L5 20 L19 20 L19 4 Z' +
    ' M7 7 L8.6 7 L8.6 12.6 L7 12.6 Z' +
    ' M15.4 7 L17 7 L17 12.6 L15.4 12.6 Z' +
    ' M8.6 7 L10.2 7 L12 12 L10.4 12 Z' +
    ' M15.4 7 L13.8 7 L12 12 L13.6 12 Z' +
    ' M10.9 15 L13.1 15 L13.1 16.6 L14.8 16.6 L12 19 L9.2 16.6 L10.9 16.6 Z',
  data:
    FRAME +
    ' M5 6 L19 6 L19 8.4 L5 8.4 Z' +
    ' M9.4 8.4 L10.6 8.4 L10.6 18 L9.4 18 Z' +
    ' M14.4 8.4 L15.6 8.4 L15.6 18 L14.4 18 Z' +
    ' M5 13.2 L19 13.2 L19 14.4 L5 14.4 Z',
  spreadsheet:
    FRAME +
    ' M11 6 L13 6 L13 18 L11 18 Z' +
    ' M15 6 L17 6 L17 18 L15 18 Z' +
    ' M5 10 L19 10 L19 11.4 L5 11.4 Z' +
    ' M5 14.4 L19 14.4 L19 15.8 L5 15.8 Z',
  presentation:
    'M3 4 L21 4 L21 16 L3 16 Z M5 6 L5 14 L19 14 L19 6 Z' +
    ' M11 16 L13 16 L13 19 L11 19 Z' +
    ' M8 19 L16 19 L16 21 L8 21 Z' +
    ' M7 12 L8.6 12 L8.6 8 L7 8 Z' +
    ' M10.5 12 L12.1 12 L12.1 6.5 L10.5 6.5 Z' +
    ' M14 12 L15.6 12 L15.6 9.5 L14 9.5 Z',
  pdf: PAGE + ' M8 9.5 L14 9.5 L14 11 L8 11 Z' + ' M8 13 L16 13 L16 17.5 L8 17.5 Z',
  config:
    'M12 5.5 A6.5 6.5 0 1 1 12 18.5 A6.5 6.5 0 1 1 12 5.5 Z' +
    ' M9.4 12 A2.6 2.6 0 1 0 14.6 12 A2.6 2.6 0 1 0 9.4 12 Z' +
    ' M10.4 1 L13.6 1 L13.6 6.5 L10.4 6.5 Z' +
    ' M17.5 10.4 L23 10.4 L23 13.6 L17.5 13.6 Z' +
    ' M10.4 17.5 L13.6 17.5 L13.6 23 L10.4 23 Z' +
    ' M1 10.4 L4.5 10.4 L4.5 13.6 L1 13.6 Z' +
    ' M15.3 5.3 L18.7 5.3 L18.7 8.7 L15.3 8.7 Z' +
    ' M5.3 5.3 L8.7 5.3 L8.7 8.7 L5.3 8.7 Z' +
    ' M15.3 15.3 L18.7 15.3 L18.7 18.7 L15.3 18.7 Z' +
    ' M5.3 15.3 L8.7 15.3 L8.7 18.7 L5.3 18.7 Z',
  lock:
    'M5 10 L19 10 L19 21 L5 21 Z M7 12 L7 19 L17 19 L17 12 Z' +
    ' M10.5 15.7 A1.5 1.5 0 1 1 13.5 15.7 A1.5 1.5 0 1 1 10.5 15.7 Z' +
    ' M8 10 L8 7.5 A4 4 0 0 1 16 7.5 L16 10 L14 10 L14 7.5 A2 2 0 0 0 10 7.5 L10 10 Z',
  archive:
    'M4 3 L20 3 L20 21 L4 21 Z M6 5 L6 19 L18 19 L18 5 Z' +
    ' M11 5 L13 5 L13 16 L11 16 Z' +
    ' M10.6 16 L13.4 16 L13.4 19 L10.6 19 Z' +
    ' M9 6.5 L11 6.5 L11 8 L9 8 Z' +
    ' M13 9 L15 9 L15 10.5 L13 10.5 Z' +
    ' M9 11 L11 11 L11 12.5 L9 12.5 Z' +
    ' M13 13 L15 13 L15 14.5 L13 14.5 Z',
  binary:
    'M6 6 L18 6 L18 18 L6 18 Z M9.5 9.5 L9.5 14.5 L14.5 14.5 L14.5 9.5 Z' +
    ' M11 11 L13 11 L13 13 L11 13 Z' +
    ' M2 8 L6 8 L6 9.6 L2 9.6 Z M2 11.2 L6 11.2 L6 12.8 L2 12.8 Z M2 14.4 L6 14.4 L6 16 L2 16 Z' +
    ' M18 8 L22 8 L22 9.6 L18 9.6 Z M18 11.2 L22 11.2 L22 12.8 L18 12.8 Z M18 14.4 L22 14.4 L22 16 L18 16 Z' +
    ' M8 2 L9.6 2 L9.6 6 L8 6 Z M11.2 2 L12.8 2 L12.8 6 L11.2 6 Z M14.4 2 L16 2 L16 6 L14.4 6 Z' +
    ' M8 18 L9.6 18 L9.6 22 L8 22 Z M11.2 18 L12.8 18 L12.8 22 L11.2 22 Z M14.4 18 L16 18 L16 22 L14.4 22 Z',
  docker:
    'M13 6.6 L15.8 6.6 L15.8 9.6 L13 9.6 Z' +
    ' M9.2 11 L12 11 L12 14 L9.2 14 Z' +
    ' M14 11 L16.8 11 L16.8 14 L14 14 Z' +
    ' M3.4 15.4 L6.2 15.4 L6.2 18.4 L3.4 18.4 Z' +
    ' M8.2 15.4 L11 15.4 L11 18.4 L8.2 18.4 Z' +
    ' M13 15.4 L15.8 15.4 L15.8 18.4 L13 18.4 Z' +
    ' M15.8 15.4 L21 15.4 L21 16.6 L19 18.4 L15.8 18.4 Z',
  git:
    'M15.6 5.5 A2.4 2.4 0 1 1 20.4 5.5 A2.4 2.4 0 1 1 15.6 5.5 Z' +
    ' M15.6 18.5 A2.4 2.4 0 1 1 20.4 18.5 A2.4 2.4 0 1 1 15.6 18.5 Z' +
    ' M3.6 12 A2.4 2.4 0 1 1 8.4 12 A2.4 2.4 0 1 1 3.6 12 Z' +
    ' M17 5.5 L19 5.5 L19 18.5 L17 18.5 Z' +
    ' M6 11 L18 11 L18 13 L6 13 Z',

  /* --------------------------------------------------------------- media */
  image:
    FRAME +
    ' M6.9 9 A1.5 1.5 0 1 1 9.9 9 A1.5 1.5 0 1 1 6.9 9 Z' +
    ' M5.6 17.6 L9.6 11.8 L12.6 15.4 L15.2 12.4 L18.6 17.6 Z',
  video:
    'M2 3 L22 3 L22 21 L2 21 Z M4 5 L4 19 L20 19 L20 5 Z' +
    ' M5.4 6 L7.4 6 L7.4 8.5 L5.4 8.5 Z M5.4 10.25 L7.4 10.25 L7.4 12.75 L5.4 12.75 Z M5.4 14.5 L7.4 14.5 L7.4 17 L5.4 17 Z' +
    ' M16.6 6 L18.6 6 L18.6 8.5 L16.6 8.5 Z M16.6 10.25 L18.6 10.25 L18.6 12.75 L16.6 12.75 Z M16.6 14.5 L18.6 14.5 L18.6 17 L16.6 17 Z' +
    ' M10.5 7.8 L15.5 12 L10.5 16.2 Z',
  audio:
    'M4.4 17 A2.6 2 0 1 1 9.6 17 A2.6 2 0 1 1 4.4 17 Z' +
    ' M13.9 15 A2.6 2 0 1 1 19.1 15 A2.6 2 0 1 1 13.9 15 Z' +
    ' M9 6 L10.6 6 L10.6 17 L9 17 Z' +
    ' M18 4 L19.6 4 L19.6 15 L18 15 Z' +
    ' M9 6 L19.6 4 L19.6 7 L9 9 Z',
  font: 'M12 3 L21 21 L17.2 21 L15.6 16.8 L8.4 16.8 L6.8 21 L3 21 Z' + ' M12 9.5 L9.8 14 L14.2 14 Z',

  /* ------------------------------------------------------------ languages */
  java:
    PAGE +
    ' M8.8 12.6 L15.2 12.6 L14.4 17.2 L9.6 17.2 Z' +
    ' M8 18.4 L16 18.4 L16 19.8 L8 19.8 Z' +
    ' M10 8.6 L11.3 8.6 L11.3 11.4 L10 11.4 Z' +
    ' M12.9 8.6 L14.2 8.6 L14.2 11.4 L12.9 11.4 Z',
  kotlin:
    PAGE +
    ' M8.4 8.6 L9.8 8.6 L9.8 18.6 L8.4 18.6 Z' +
    ' M9.4 13.4 L13.6 8.6 L14.8 8.6 L10.6 13.4 Z' +
    ' M9.4 13.4 L10.6 13.4 L14.8 18.6 L13.6 18.6 Z',
  go:
    PAGE +
    ' M16.4 9 L8.4 9 L8.4 17 L16.4 17 L16.4 13.4 L10 13.4 L10 10.6 L16.4 10.6 Z' +
    ' M11.6 12.2 L16.4 12.2 L16.4 13.4 L11.6 13.4 Z',
  rust:
    PAGE +
    ' M8 8.8 L13.6 8.8 L16 11.2 L16 12.8 L13.8 14.4 L16 17.2 L13.4 17.2 L11 14.4 L9.8 14.4 L9.8 17.2 L8 17.2 Z' +
    ' M9.8 13.4 L12.8 13.4 L14 12 L12.8 10.8 L9.8 10.8 Z',
  python:
    PAGE +
    ' M7.8 8.6 L15.6 8.6 L15.6 11.6 L10.6 11.6 L10.6 13.6 L7.8 13.6 Z' +
    ' M16.2 18.2 L8.4 18.2 L8.4 15.2 L13.4 15.2 L13.4 13.2 L16.2 13.2 Z',
  cpp:
    PAGE +
    ' M11.2 11.2 L10 10 L8.6 10 L7.4 11.2 L7.4 16.6 L8.6 17.8 L10 17.8 L11.2 16.6 L11.2 15.4 L10.2 16 L9.4 16 L8.8 15.4 L8.8 12.4 L9.4 11.8 L10.2 11.8 L11.2 12.4 Z' +
    ' M13.6 8.8 L14.7 8.8 L14.7 10 L15.8 10 L15.8 11.1 L14.7 11.1 L14.7 12.3 L13.6 12.3 L13.6 11.1 L12.5 11.1 L12.5 10 L13.6 10 Z' +
    ' M13.6 13.6 L14.7 13.6 L14.7 14.8 L15.8 14.8 L15.8 15.9 L14.7 15.9 L14.7 17.1 L13.6 17.1 L13.6 15.9 L12.5 15.9 L12.5 14.8 L13.6 14.8 Z',
  csharp:
    PAGE +
    ' M11 11.2 L9.8 10 L8.4 10 L7.4 11.2 L7.4 16.6 L8.4 17.8 L9.8 17.8 L11 16.6 L11 15.4 L10 16 L9.2 16 L8.6 15.4 L8.6 12.4 L9.2 11.8 L10 11.8 L11 12.4 Z' +
    ' M12.8 9.6 L14 9.6 L14 17.4 L12.8 17.4 Z' +
    ' M15.6 9.6 L16.8 9.6 L16.8 17.4 L15.6 17.4 Z' +
    ' M12.2 11.4 L17 11.4 L17 12.6 L12.2 12.6 Z' +
    ' M12.2 14.8 L17 14.8 L17 16 L12.2 16 Z',
  php:
    PAGE +
    ' M12 9.6 A4.8 3.4 0 1 1 12 16.4 A4.8 3.4 0 1 1 12 9.6 Z' +
    ' M12 11 A3.1 1.9 0 1 0 12 15 A3.1 1.9 0 1 0 12 11 Z',
  ruby:
    PAGE +
    ' M12 8.2 L16.8 12.8 L15 18.4 L9 18.4 L7.2 12.8 Z' +
    ' M12 10.28 L9.12 13.4 L10.2 16.4 L13.8 16.4 L14.88 13.4 Z',
  swift:
    PAGE + ' M7 16.4 L12.4 8.6 L13.9 9.8 L12.6 11.6 L16.8 9.8 L16.8 11.6 L10.6 14.6 L13.8 13.4 L15 14.8 L8.4 17.8 Z',
  sql:
    PAGE +
    ' M12 8.4 A4.4 1.9 0 1 1 12 12.2 A4.4 1.9 0 1 1 12 8.4 Z' +
    ' M12 9.8 A2.7 0.9 0 1 0 12 11.4 A2.7 0.9 0 1 0 12 9.8 Z' +
    ' M7.6 10.2 L9.1 10.2 L9.1 16.4 L7.6 16.4 Z' +
    ' M14.9 10.2 L16.4 10.2 L16.4 16.4 L14.9 16.4 Z' +
    ' M7.6 16.4 L16.4 16.4 A4.4 1.9 0 0 1 7.6 16.4 Z',
  shell: PAGE + ' M9 9.8 L14 12.8 L9 15.8 L8 14.6 L11.4 12.8 L8 11 Z' + ' M15 14.8 L18.4 14.8 L18.4 16 L15 16 Z',
  html:
    PAGE +
    ' M12 9 L15.8 10.8 L15.8 13.2 L12 17 L8.2 13.2 L8.2 10.8 Z' +
    ' M12 10.6 L9.8 11.6 L9.8 12.8 L12 15 L14.2 12.8 L14.2 11.6 Z',
  css:
    PAGE +
    ' M10.4 8.6 L11.4 8.6 L11 18.4 L10 18.4 Z' +
    ' M13.4 8.6 L14.4 8.6 L14 18.4 L13 18.4 Z' +
    ' M8.6 11.6 L15.8 11.6 L15.6 13 L8.4 13 Z' +
    ' M8.2 15 L15.4 15 L15.2 16.4 L8 16.4 Z',
  json:
    PAGE +
    ' M7.6 8.6 L10.4 8.6 L10.4 9.8 L8.6 9.8 L8.6 11.6 L10.4 11.6 L10.4 12.8 L8.6 12.8 L8.6 14.6 L10.4 14.6 L10.4 15.8 L7.6 15.8 Z' +
    ' M16.4 8.6 L13.6 8.6 L13.6 9.8 L15.4 9.8 L15.4 11.6 L13.6 11.6 L13.6 12.8 L15.4 12.8 L15.4 14.6 L13.6 14.6 L13.6 15.8 L16.4 15.8 Z',
  yaml: PAGE + ' M8.4 9 L10 9 L12 12.4 L14 9 L15.6 9 L12.8 14 L12.8 18.4 L11.2 18.4 L11.2 14 Z',
  xml:
    PAGE +
    ' M10.4 9.8 L8 12.8 L10.4 15.8 L10.4 14.6 L9.3 12.8 L10.4 11 Z' +
    ' M13.6 9.8 L16 12.8 L13.6 15.8 L13.6 14.6 L14.7 12.8 L13.6 11 Z' +
    ' M12.4 9.4 L13.1 9.4 L11.5 16.2 L10.8 16.2 Z',
}

/** File name (without extension) to kind, for well known dot files. */
const SPECIAL_NAMES: Record<string, IconKind> = {
  dockerfile: 'docker',
  containerfile: 'docker',
  'docker-compose.yml': 'yaml',
  'docker-compose.yaml': 'yaml',
  '.gitignore': 'git',
  '.gitattributes': 'git',
  '.gitmodules': 'git',
  '.git': 'git',
  '.env': 'config',
  '.env.local': 'config',
  '.editorconfig': 'config',
  '.npmrc': 'config',
  '.yarnrc': 'config',
  '.babelrc': 'config',
  '.eslintrc': 'config',
  '.prettierrc': 'config',
  makefile: 'config',
  'cmakelists.txt': 'config',
  license: 'text',
  licence: 'text',
  readme: 'text',
  codeowners: 'text',
}

/** Extension (without the dot, lower case) to kind. */
const EXTENSION_KINDS: Record<string, IconKind> = {
  /* code */
  ts: 'code',
  tsx: 'code',
  js: 'code',
  jsx: 'code',
  mjs: 'code',
  cjs: 'code',
  vue: 'code',
  svelte: 'code',
  astro: 'code',
  dart: 'code',
  lua: 'code',
  pl: 'code',
  r: 'code',
  jl: 'code',
  scala: 'code',
  hs: 'code',
  ex: 'code',
  exs: 'code',
  erl: 'code',
  sol: 'code',
  /* markup + data */
  json: 'json',
  jsonc: 'json',
  json5: 'json',
  html: 'html',
  htm: 'html',
  xhtml: 'html',
  css: 'css',
  scss: 'css',
  sass: 'css',
  less: 'css',
  md: 'markdown',
  markdown: 'markdown',
  mdx: 'markdown-file',
  txt: 'text',
  text: 'text',
  log: 'text',
  rtf: 'text',
  doc: 'text',
  docx: 'text',
  odt: 'text',
  csv: 'data',
  tsv: 'data',
  graphql: 'data',
  gql: 'data',
  xml: 'xml',
  svg: 'image',
  yml: 'yaml',
  yaml: 'yaml',
  toml: 'config',
  ini: 'config',
  cfg: 'config',
  conf: 'config',
  properties: 'config',
  env: 'config',
  tf: 'config',
  tfvars: 'config',
  /* languages */
  py: 'python',
  pyw: 'python',
  ipynb: 'python',
  go: 'go',
  rs: 'rust',
  java: 'java',
  kt: 'kotlin',
  kts: 'kotlin',
  c: 'cpp',
  h: 'cpp',
  cpp: 'cpp',
  cc: 'cpp',
  cxx: 'cpp',
  hpp: 'cpp',
  hh: 'cpp',
  cs: 'csharp',
  fs: 'csharp',
  fsx: 'csharp',
  php: 'php',
  phtml: 'php',
  rb: 'ruby',
  erb: 'ruby',
  swift: 'swift',
  m: 'swift',
  mm: 'swift',
  sql: 'sql',
  sh: 'shell',
  bash: 'shell',
  zsh: 'shell',
  fish: 'shell',
  ps1: 'shell',
  bat: 'shell',
  cmd: 'shell',
  /* packages + media */
  wasm: 'binary',
  zip: 'archive',
  tar: 'archive',
  gz: 'archive',
  bz2: 'archive',
  xz: 'archive',
  '7z': 'archive',
  rar: 'archive',
  png: 'image',
  jpg: 'image',
  jpeg: 'image',
  gif: 'image',
  webp: 'image',
  ico: 'image',
  bmp: 'image',
  tif: 'image',
  tiff: 'image',
  mp3: 'audio',
  wav: 'audio',
  ogg: 'audio',
  flac: 'audio',
  m4a: 'audio',
  mp4: 'video',
  mov: 'video',
  webm: 'video',
  mkv: 'video',
  avi: 'video',
  pdf: 'pdf',
  xls: 'spreadsheet',
  xlsx: 'spreadsheet',
  ods: 'spreadsheet',
  ppt: 'presentation',
  pptx: 'presentation',
  odp: 'presentation',
  ttf: 'font',
  otf: 'font',
  woff: 'font',
  woff2: 'font',
  eot: 'font',
  lock: 'lock',
  gitignore: 'git',
  gitattributes: 'git',
  gitmodules: 'git',
  dockerfile: 'docker',
}

/**
 * Map a file name / extension onto a kind.
 *
 * Directories always map to `'folder'`; the renderer can swap in
 * `'folder-open'` itself when the directory is expanded.
 */
export function iconKindFor(fileName: string, isDirectory: boolean): IconKind {
  if (isDirectory) return 'folder'
  const name = fileName.trim().toLowerCase()
  if (name.length === 0) return 'file'

  const special = SPECIAL_NAMES[name]
  if (special) return special

  if (name.startsWith('dockerfile')) return 'docker'
  if (name.startsWith('makefile')) return 'config'

  const dot = name.lastIndexOf('.')
  if (dot <= 0) return 'file'

  const extension = name.slice(dot + 1)
  if (extension.length === 0) return 'file'
  return EXTENSION_KINDS[extension] ?? 'file'
}
