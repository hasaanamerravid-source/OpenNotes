/**
 * Language highlighting registry for OpenNotes.
 *
 * Every language is resolved lazily: the first call for an id builds the
 * CodeMirror extension and caches it, so opening a single file never builds
 * parsers for the other 70+ languages. Only CodeMirror is imported here.
 */
import { StreamLanguage } from '@codemirror/language'
import type { Extension } from '@codemirror/state'
import { javascript } from '@codemirror/lang-javascript'
import { python } from '@codemirror/lang-python'
import { html } from '@codemirror/lang-html'
import { css } from '@codemirror/lang-css'
import { json } from '@codemirror/lang-json'
import { markdown } from '@codemirror/lang-markdown'
import { xml } from '@codemirror/lang-xml'
import { cpp } from '@codemirror/lang-cpp'
import { rust } from '@codemirror/lang-rust'
import { php } from '@codemirror/lang-php'
import { sql } from '@codemirror/lang-sql'
import { java } from '@codemirror/lang-java'
import { yaml } from '@codemirror/lang-yaml'
import { go } from '@codemirror/lang-go'
import { shell } from '@codemirror/legacy-modes/mode/shell'
import { powerShell } from '@codemirror/legacy-modes/mode/powershell'
import { ruby } from '@codemirror/legacy-modes/mode/ruby'
import { perl } from '@codemirror/legacy-modes/mode/perl'
import { lua } from '@codemirror/legacy-modes/mode/lua'
import { swift } from '@codemirror/legacy-modes/mode/swift'
import { dockerFile } from '@codemirror/legacy-modes/mode/dockerfile'
import { nginx } from '@codemirror/legacy-modes/mode/nginx'
import { diff } from '@codemirror/legacy-modes/mode/diff'
import { toml } from '@codemirror/legacy-modes/mode/toml'
import { properties } from '@codemirror/legacy-modes/mode/properties'
import { stex } from '@codemirror/legacy-modes/mode/stex'
import { protobuf } from '@codemirror/legacy-modes/mode/protobuf'
import { clojure } from '@codemirror/legacy-modes/mode/clojure'
import { coffeeScript } from '@codemirror/legacy-modes/mode/coffeescript'
import { groovy } from '@codemirror/legacy-modes/mode/groovy'
import { tcl } from '@codemirror/legacy-modes/mode/tcl'
import { haskell } from '@codemirror/legacy-modes/mode/haskell'
import { erlang } from '@codemirror/legacy-modes/mode/erlang'
import { julia } from '@codemirror/legacy-modes/mode/julia'
import { r } from '@codemirror/legacy-modes/mode/r'
import { d } from '@codemirror/legacy-modes/mode/d'
import { fortran } from '@codemirror/legacy-modes/mode/fortran'
import { cobol } from '@codemirror/legacy-modes/mode/cobol'
import { pascal } from '@codemirror/legacy-modes/mode/pascal'
import { crystal } from '@codemirror/legacy-modes/mode/crystal'
import { vb } from '@codemirror/legacy-modes/mode/vb'
import { gas } from '@codemirror/legacy-modes/mode/gas'
import { verilog } from '@codemirror/legacy-modes/mode/verilog'
import { vhdl } from '@codemirror/legacy-modes/mode/vhdl'
import { oCaml, fSharp } from '@codemirror/legacy-modes/mode/mllike'
import { kotlin, scala, dart, objectiveC } from '@codemirror/legacy-modes/mode/clike'
import { sCSS, less } from '@codemirror/legacy-modes/mode/css'
import { haxe } from '@codemirror/legacy-modes/mode/haxe'
import { scheme } from '@codemirror/legacy-modes/mode/scheme'
import { commonLisp } from '@codemirror/legacy-modes/mode/commonlisp'
import { xml as legacyXml } from '@codemirror/legacy-modes/mode/xml'

/** Human readable label, e.g. 'C++'. */
export const LANGUAGE_LABELS: Record<string, string> = {
  text: 'Plain Text',
  markdown: 'Markdown',
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  jsx: 'JSX',
  tsx: 'TSX',
  json: 'JSON',
  yaml: 'YAML',
  toml: 'TOML',
  ini: 'INI',
  html: 'HTML',
  css: 'CSS',
  scss: 'SCSS',
  less: 'Less',
  xml: 'XML',
  python: 'Python',
  java: 'Java',
  c: 'C',
  cpp: 'C++',
  csharp: 'C#',
  rust: 'Rust',
  go: 'Go',
  php: 'PHP',
  sql: 'SQL',
  shell: 'Shell',
  bash: 'Bash',
  powershell: 'PowerShell',
  batch: 'Batch / CMD',
  ruby: 'Ruby',
  perl: 'Perl',
  lua: 'Lua',
  diff: 'Diff',
  log: 'Log',
  regexp: 'RegExp',
  csv: 'CSV',
  dockerfile: 'Dockerfile',
  makefile: 'Makefile',
  nginx: 'Nginx',
  tex: 'LaTeX',
  latex: 'LaTeX',
  kotlin: 'Kotlin',
  swift: 'Swift',
  scala: 'Scala',
  dart: 'Dart',
  vue: 'Vue',
  svelte: 'Svelte',
  astro: 'Astro',
  graphql: 'GraphQL',
  protobuf: 'Protobuf',
  hcl: 'Terraform / HCL',
  clojure: 'Clojure',
  groovy: 'Groovy',
  coffee: 'CoffeeScript',
  tcl: 'Tcl',
  awk: 'AWK',
  objectivec: 'Objective-C',
  zig: 'Zig',
  d: 'D',
  haskell: 'Haskell',
  elixir: 'Elixir',
  erlang: 'Erlang',
  ocaml: 'OCaml',
  fsharp: 'F#',
  vb: 'Visual Basic',
  pascal: 'Pascal',
  fortran: 'Fortran',
  cobol: 'COBOL',
  ada: 'Ada',
  nim: 'Nim',
  crystal: 'Crystal',
  solidity: 'Solidity',
  asm: 'Assembly',
  verilog: 'Verilog',
  vhdl: 'VHDL',
  matlab: 'MATLAB',
  r: 'R',
  julia: 'Julia',
  gdscript: 'GDScript',
  gradle: 'Gradle',
  gradlekts: 'Gradle (Kotlin)',
  elm: 'Elm',
  purescript: 'PureScript',
  haxe: 'Haxe',
  idris: 'Idris',
  agda: 'Agda',
  lean: 'Lean',
  raku: 'Raku',
  http: 'HTTP',
  rest: 'reStructuredText',
  prisma: 'Prisma',
  systemd: 'systemd unit',
  desktop: 'Desktop entry',
  gitconfig: 'Git config',
  gitignore: 'Git ignore',
  editorconfig: 'EditorConfig',
  mustache: 'Mustache',
  handlebars: 'Handlebars',
  ejs: 'EJS',
  pug: 'Pug',
  twig: 'Twig',
  liquid: 'Liquid',
  gherkin: 'Gherkin',
  robot: 'Robot Framework',
  jsonnet: 'Jsonnet',
  cue: 'CUE',
  starlark: 'Starlark',
  just: 'Justfile',
  meson: 'Meson',
  cmake: 'CMake',
  ninja: 'Ninja build',
  bazel: 'Bazel',
  wat: 'WebAssembly text',
  scad: 'OpenSCAD',
  ino: 'Arduino',
  rkt: 'Racket',
  racket: 'Racket',
  scm: 'Scheme',
  emacs: 'Emacs Lisp',
  plist: 'Property list',
  strings: 'Strings file',
  xcconfig: 'Xcode config',
  pbxproj: 'Xcode project',
  sln: 'Visual Studio solution',
  csproj: 'C# project',
  vbproj: 'VB.NET project',
  fsproj: 'F# project',
  tres: 'Godot resource',
  tscn: 'Godot scene',
  gdignore: 'Godot ignore',

  /* --- Modern language support ----------------------------------------- */

  wgsl: 'WGSL',
  gleam: 'Gleam',
  vlang: 'V (Vlang)',
  odin: 'Odin',
  rescript: 'ReScript',
  vale: 'Vale',
  carbon: 'Carbon',
}

/** Every supported language id. */
export const LANGUAGE_IDS: string[] = Object.keys(LANGUAGE_LABELS)

/** Menu grouping used by the language picker. */
export type LanguageGroup = 'popular' | 'web' | 'systems' | 'scripting' | 'data' | 'markup' | 'other'

const GROUP_MEMBERS: Record<Exclude<LanguageGroup, 'popular' | 'other'>, string> = {
  systems:
    'java c cpp csharp go rust kotlin swift scala dart php objectivec zig d haskell elixir erlang ocaml fsharp vb pascal fortran cobol ada nim crystal solidity asm verilog vhdl matlab r julia gradle gradlekts haxe wgsl gleam vlang odin rescript vale carbon zig',
  web: 'javascript typescript jsx tsx html css scss less vue svelte astro mustache handlebars ejs pug twig liquid http rest wgsl',
  scripting:
    'python ruby perl lua shell bash powershell batch tcl awk clojure groovy coffee gdscript elm purescript idris agda lean raku gherkin robot jsonnet cue starlark just meson cmake ninja bazel wat scad ino rkt racket scm emacs',
  data: 'json yaml toml ini xml csv sql graphql protobuf hcl prisma systemd desktop gitconfig gitignore editorconfig xcconfig pbxproj sln csproj vbproj fsproj tres tscn gdignore plist strings',
  markup: 'markdown tex latex diff log regexp dockerfile nginx makefile text',
}

/** The base category of every language, ignoring the "popular" shortcut. */
export const LANGUAGE_GROUPS: Record<string, LanguageGroup> = {}
for (const [group, members] of Object.entries(GROUP_MEMBERS)) {
  for (const id of members.split(/\s+/)) if (id) LANGUAGE_GROUPS[id] = group as LanguageGroup
}

/** Ids that are shown first in the language menu. */
export const POPULAR_LANGUAGE_IDS: string[] =
  'javascript typescript jsx tsx python html css json markdown java c cpp csharp go rust php sql yaml shell'.split(' ')

const POPULAR = new Set(POPULAR_LANGUAGE_IDS)

/** Group a language for the menu: 'popular' | 'web' | 'systems' | 'scripting' | 'data' | 'markup' | 'other'. */
export function languageGroup(id: string): LanguageGroup {
  if (POPULAR.has(id)) return 'popular'
  return LANGUAGE_GROUPS[id] ?? 'other'
}

/** Label for a language id (falls back to the id). */
export function languageLabel(id: string): string {
  return LANGUAGE_LABELS[id] ?? id
}

type Factory = () => Extension
type LegacyParser = Parameters<typeof StreamLanguage.define>[0]
type CodeStream = Parameters<LegacyParser['token']>[0]

/** Split a space separated keyword list into a lookup set. */
function words(list: string): Set<string> {
  const set = new Set<string>()
  for (const word of list.split(/\s+/)) if (word) set.add(word)
  return set
}

/* ------------------------------------------------------------------ *
 * Custom modes
 * ------------------------------------------------------------------ */

interface KeywordSpec {
  name: string
  keywords: string
  types?: string
  builtins?: string
  attributes?: string
  lineComment?: string | RegExp
  blockComment?: [string, string]
  quotes?: string
  vars?: RegExp
}

/** Build a small C-family style mode from plain keyword lists. */
function keywordMode(spec: KeywordSpec): Factory {
  const keywords = words(spec.keywords)
  const types = words(spec.types ?? '')
  const builtins = words(spec.builtins ?? '')
  const attributes = words(spec.attributes ?? '')
  const quotes = spec.quotes ?? '"'
  const lineComment = spec.lineComment ?? '//'
  const block = spec.blockComment
  return () =>
    StreamLanguage.define({
      name: spec.name,
      token(stream) {
        if (stream.eatSpace()) return null
        const ch = stream.peek()
        if (ch === undefined) return null
        if (lineComment && stream.match(lineComment)) {
          stream.skipToEnd()
          return 'comment'
        }
        if (block && stream.match(block[0])) {
          while (!stream.eol()) {
            if (stream.match(block[1])) break
            stream.next()
          }
          return 'comment'
        }
        if (quotes.includes(ch)) {
          stream.next()
          while (!stream.eol()) {
            const c = stream.next()
            if (c === '\\') {
              stream.next()
              continue
            }
            if (c === ch) break
          }
          return 'string'
        }
        if (spec.vars && stream.match(spec.vars)) return 'variableName'
        if (attributes.size && stream.match(/^@@?[A-Za-z_][A-Za-z0-9_]*/)) {
          return attributes.has(stream.current()) ? 'attributeName' : 'meta'
        }
        if (stream.match(/^\d[\d_]*(?:\.\d[\d_]*)?(?:[eE][+-]?\d+)?/)) return 'number'
        if (stream.match(/^[A-Za-z_$][A-Za-z0-9_$]*/)) {
          const word = stream.current()
          if (keywords.has(word)) return 'keyword'
          if (types.has(word)) return 'typeName'
          if (builtins.has(word)) return 'variableName.special'
          return 'variableName'
        }
        if (stream.match(/^[{}()[\];,.:]/)) return 'punctuation'
        if (stream.match(/^(==|!=|<=|>=|&&|\|\||=>|->|\+=|-=|\*=|::|\.\.|<<|>>|\?\?|:=|&|\|)/)) return 'operator'
        stream.next()
        return null
      },
      languageData: {
        commentTokens: {
          ...(typeof lineComment === 'string' ? { line: lineComment } : {}),
          ...(block ? { block: { open: block[0], close: block[1] } } : {}),
        },
      },
    })
}

/** Short form of {@link keywordMode} for the compact language entries. */
function kw(name: string, keywords: string, extra: Partial<KeywordSpec> = {}): Factory {
  return keywordMode({ name, keywords, ...extra })
}

/* C# ---------------------------------------------------------------- */
const CSHARP_KEYWORDS =
  'namespace using class struct interface enum record void var async await new return if else for foreach while do switch case break continue try catch finally throw public private protected internal static readonly const override virtual abstract sealed partial get set value null true false this base'
const CSHARP_TYPES = 'int long short byte float double decimal bool char string object dynamic'
const CSHARP_BUILTINS =
  'Console WriteLine Write Debug List Dictionary HashSet Queue Stack Task Thread StringBuilder Math Array IEnumerable Action Func Nullable DateTime Guid File Directory Path Json Regex Exception'

interface CsState {
  mode: 'code' | 'string' | 'interp'
  quote: string
  interp: boolean
}

/** A dedicated C# mode with keywords, types, common library names and interpolated strings. */
function csharpMode(): Factory {
  const keywords = words(CSHARP_KEYWORDS)
  const types = words(CSHARP_TYPES)
  const builtins = words(CSHARP_BUILTINS)
  const code = (stream: CodeStream, state: CsState): string | null => {
    if (stream.eatSpace()) return null
    const ch = stream.peek()
    if (ch === undefined) return null
    if (stream.match('//')) {
      stream.skipToEnd()
      return 'comment'
    }
    if (stream.match('/*')) {
      while (!stream.eol()) {
        if (stream.match('*/')) break
        stream.next()
      }
      return 'comment'
    }
    if (stream.match(/^\[[A-Za-z_][\w.]*(?:\([^)]*\))?\]/)) return 'meta'
    if (stream.match(/^\$@"/) || stream.match(/^\$"/)) {
      state.mode = 'string'
      state.quote = '"'
      state.interp = true
      return 'string'
    }
    if (stream.match(/^@"/)) {
      state.mode = 'string'
      state.quote = '"'
      state.interp = false
      return 'string'
    }
    if (ch === '"' || ch === "'") {
      stream.next()
      state.mode = 'string'
      state.quote = ch
      state.interp = false
      return 'string'
    }
    if (stream.match(/^0[xX][0-9A-Fa-f_]+/)) return 'number'
    if (stream.match(/^\d[\d_]*(?:\.\d[\d_]*)?(?:[eE][+-]?\d+)?[fFdDmMuUlL]?/)) return 'number'
    if (stream.match(/^[A-Za-z_][A-Za-z0-9_]*/)) {
      const word = stream.current()
      if (keywords.has(word)) return 'keyword'
      if (types.has(word)) return 'typeName'
      if (builtins.has(word)) return 'variableName.special'
      return 'variableName'
    }
    if (stream.match(/^[{}()[\];,.:]/)) return 'punctuation'
    if (stream.match(/^(==|!=|<=|>=|&&|\|\||=>|\+\+|--|\+=|-=|\*=|\/=|\?\?|\?\.|\?\[)/)) return 'operator'
    stream.next()
    return null
  }
  return () =>
    StreamLanguage.define<CsState>({
      name: 'csharp',
      startState: () => ({ mode: 'code', quote: '"', interp: false }),
      token(stream, state) {
        if (state.mode === 'string') {
          const ch = stream.peek()
          if (ch === undefined) {
            state.mode = 'code'
            return null
          }
          if (ch === '\\') {
            stream.next()
            stream.next()
            return 'string'
          }
          if (ch === state.quote) {
            stream.next()
            if (!state.interp && stream.peek() === state.quote) {
              stream.next()
              return 'string'
            }
            state.mode = 'code'
            return 'string'
          }
          if (state.interp && ch === '{') {
            stream.next()
            state.mode = 'interp'
            return 'punctuation'
          }
          stream.next()
          return 'string'
        }
        if (state.mode === 'interp' && stream.match(/^\}/)) {
          state.mode = 'string'
          return 'punctuation'
        }
        return code(stream, state)
      },
    })
}

/* Markup flavours (Vue / Svelte / Astro) ---------------------------- */

interface MarkupSpec {
  name: string
  keywords: string
  frontmatter?: boolean
}

/** HTML-ish mode used for the single file component formats. */
function markupMode(spec: MarkupSpec): Factory {
  const keywords = words(spec.keywords)
  const code = (stream: CodeStream): string | null => {
    if (stream.eatSpace()) return null
    if (stream.match('//')) {
      stream.skipToEnd()
      return 'comment'
    }
    if (stream.match(/^"(?:[^"\\]|\\.)*"/) || stream.match(/^'(?:[^'\\]|\\.)*'/)) return 'string'
    if (stream.match(/^\d+(?:\.\d+)?/)) return 'number'
    if (stream.match(/^[A-Za-z_$][\w$]*/)) return keywords.has(stream.current()) ? 'keyword' : 'variableName'
    stream.next()
    return null
  }
  return () =>
    StreamLanguage.define<{ inExpr: boolean; inFrontmatter: boolean }>({
      name: spec.name,
      startState: () => ({ inExpr: false, inFrontmatter: false }),
      token(stream, state) {
        if (state.inExpr) {
          if (stream.match(/^(?:\}\}|\})/)) {
            state.inExpr = false
            return 'punctuation'
          }
          return code(stream)
        }
        if (state.inFrontmatter) {
          if (stream.sol() && stream.match(/^---/)) {
            state.inFrontmatter = false
            return 'meta'
          }
          return code(stream)
        }
        if (stream.eatSpace()) return null
        if (stream.match(/^<!--/)) {
          while (!stream.eol() && !stream.match(/-->/)) stream.next()
          return 'comment'
        }
        if (spec.frontmatter && stream.sol() && stream.match(/^---/)) {
          state.inFrontmatter = true
          return 'meta'
        }
        if (stream.match(/^<\/?[A-Za-z][\w:.-]*/)) return 'tagName'
        if (stream.match(/^\/?>/)) return 'punctuation'
        if (stream.match(/^(?:\{\{|\{#|\{\/|\{:)/)) {
          state.inExpr = true
          return 'punctuation'
        }
        if (stream.match(/^[A-Za-z_:@#][\w:.$-]*(?==)/)) {
          return keywords.has(stream.current()) ? 'keyword' : 'attributeName'
        }
        if (stream.match(/^"(?:[^"\\]|\\.)*"/) || stream.match(/^'(?:[^'\\]|\\.)*'/)) return 'string'
        stream.next()
        return null
      },
    })
}

/* Small specialised modes -------------------------------------------- */

/** Comma separated values with quoted fields. */
const csvMode: Factory = () =>
  StreamLanguage.define({
    name: 'csv',
    token(stream) {
      if (stream.eatSpace()) return null
      if (stream.peek() === '"') {
        stream.next()
        while (!stream.eol()) {
          const ch = stream.next()
          if (ch === '"') {
            if (stream.peek() === '"') stream.next()
            else break
          }
        }
        return 'string'
      }
      if (stream.eat(',')) return 'punctuation'
      if (stream.match(/^[^\n,]+/)) return 'variableName'
      stream.next()
      return null
    },
    languageData: { commentTokens: { line: '#' } },
  })

/** Timestamped log files. */
const logMode: Factory = () =>
  StreamLanguage.define({
    name: 'log',
    token(stream) {
      if (stream.eatSpace()) return null
      if (stream.match(/^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?)?/)) return 'meta'
      if (stream.match(/^\[(?:TRACE|DEBUG|INFO|WARN|WARNING|ERROR|FATAL|CRITICAL)\]/i)) return 'keyword'
      if (stream.match(/^(?:TRACE|DEBUG|INFO|WARN|WARNING|ERROR|FATAL|CRITICAL)\b/i)) return 'keyword'
      if (stream.match(/^"(?:[^"\\]|\\.)*"/)) return 'string'
      if (stream.match(/^\b\d+(?:\.\d+)?\b/)) return 'number'
      if (stream.match(/^[A-Za-z_][\w.$]*/)) return 'variableName'
      stream.next()
      return null
    },
  })

/** Regular expression source. */
const regexpMode: Factory = () =>
  StreamLanguage.define({
    name: 'regexp',
    token(stream) {
      if (stream.eatSpace()) return null
      const ch = stream.peek()
      if (ch === undefined) return null
      if (stream.match(/^\/(?:\\.|[^/\\\n])*\/[gimsuy]*/)) return 'string'
      if (ch === '[') {
        while (!stream.eol() && stream.next() !== ']') {
          /* char class */
        }
        return 'bracket'
      }
      if (ch === '^' || ch === '$' || ch === '*' || ch === '+' || ch === '?') {
        stream.next()
        return 'operator'
      }
      if (ch === '\\') {
        stream.next()
        stream.next()
        return 'escape'
      }
      if (ch === '(' || ch === ')') {
        stream.next()
        return 'paren'
      }
      if (ch === '{' || ch === '}') {
        stream.next()
        return 'brace'
      }
      stream.next()
      return null
    },
  })

/* ------------------------------------------------------------------ *
 * Additional custom modes
 * ------------------------------------------------------------------ */

interface TemplateKind {
  open: string
  close: string
  style: 'expr' | 'tag' | 'comment'
}

interface TemplateSpec {
  name: string
  keywords: string
  kinds: TemplateKind[]
}

/** Delimiters of the Mustache/Handlebars family ({{ }}) and of Twig/Liquid ({# #}, {% %}). */
const MUSTACHE_KINDS: TemplateKind[] = [
  { open: '{{!', close: '}}', style: 'comment' },
  { open: '{{{', close: '}}}', style: 'expr' },
  { open: '{{', close: '}}', style: 'expr' },
]

const BRACE_KINDS: TemplateKind[] = [
  { open: '{#', close: '#}', style: 'comment' },
  { open: '{{', close: '}}', style: 'expr' },
  { open: '{%', close: '%}', style: 'tag' },
]

/** Pick a style for the text between two template delimiters. */
function templateStyle(content: string, kind: TemplateKind, keywords: Set<string>): string {
  const text = content.trim()
  if (kind.style === 'comment') return 'comment'
  if (!text) return 'punctuation'
  const head = text[0]
  if (head === '#' || head === '^' || head === '/') return 'keyword'
  if (head === '!') return 'comment'
  if (head === '>') return 'meta'
  if (head === '@') return 'attributeName'
  const word = text.split(/[\s(]/)[0]
  if (keywords.has(word)) return 'keyword'
  return kind.style === 'tag' ? 'meta' : 'variableName'
}

/** Delimiter based template languages (Mustache, Handlebars, Twig, Liquid, EJS). */
function templateMode(spec: TemplateSpec): Factory {
  const keywords = words(spec.keywords)
  const kinds = [...spec.kinds].sort((a, b) => b.open.length - a.open.length)
  return () =>
    StreamLanguage.define({
      name: spec.name,
      token(stream) {
        if (stream.eatSpace()) return null
        for (const kind of kinds) {
          if (!stream.match(kind.open)) continue
          let content = ''
          while (!stream.eol() && !stream.match(kind.close)) {
            const ch = stream.next()
            if (ch !== undefined) content += ch
          }
          stream.match(kind.close)
          return templateStyle(content, kind, keywords)
        }
        stream.next()
        return null
      },
    })
}

/** XML flavoured documents (property lists, Godot scenes and resources). */
function xmlLikeMode(name: string): Factory {
  return () =>
    StreamLanguage.define({
      name,
      token(stream) {
        if (stream.eatSpace()) return null
        if (stream.match(/^<!--/)) {
          while (!stream.eol() && !stream.match(/-->/)) stream.next()
          stream.match(/-->/)
          return 'comment'
        }
        if (stream.match(/^<\?[\s\S]*?\?>/)) return 'meta'
        if (stream.match(/^<!\[CDATA\[/)) {
          while (!stream.eol() && !stream.match(/\]\]>/)) stream.next()
          stream.match(/\]\]>/)
          return 'string'
        }
        if (stream.match(/^<!DOCTYPE[^>]*>/)) return 'meta'
        if (stream.match(/^<\/?[A-Za-z_][\w.:-]*/)) return 'tagName'
        if (stream.match(/^\/?>/)) return 'punctuation'
        if (stream.match(/^[A-Za-z_][\w.:-]*(?=\s*=)/)) return 'attributeName'
        if (stream.match(/^=/)) return 'operator'
        if (stream.match(/^"(?:[^"\\]|\\.)*"/)) return 'string'
        if (stream.match(/^'(?:[^'\\]|\\.)*'/)) return 'string'
        if (stream.match(/^-?\d+(?:\.\d+)?/)) return 'number'
        stream.next()
        return null
      },
    })
}

/** Raw HTTP requests and responses. */
const HTTP_HEADERS = words(
  'content-type authorization accept cache-control content-length content-encoding host user-agent connection set-cookie location server etag if-modified-since if-none-match range cookie referer origin content-range transfer-encoding date expires vary x-forwarded-for x-requested-with',
)

interface HttpState {
  inValue: boolean
}

const httpMode: Factory = () =>
  StreamLanguage.define<HttpState>({
    name: 'http',
    startState: () => ({ inValue: false }),
    token(stream, state) {
      if (state.inValue) {
        stream.skipToEnd()
        state.inValue = false
        return 'string'
      }
      if (stream.match(/^HTTP\/[\d.]+/)) return 'meta'
      if (stream.sol()) {
        if (stream.match(/^(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS|TRACE|CONNECT)\b/)) return 'keyword'
        if (stream.match(/^\d{3}\b/)) return 'number'
        if (stream.match(/^[A-Za-z][A-Za-z0-9-]*:/)) {
          const name = stream.current().trim().slice(0, -1).toLowerCase()
          state.inValue = true
          return HTTP_HEADERS.has(name) ? 'attributeName' : 'propertyName'
        }
      }
      if (stream.eatSpace()) return null
      if (stream.match(/^"(?:[^"\\]|\\.)*"/)) return 'string'
      if (stream.match(/^\/[^\s]*/)) return 'string'
      if (stream.match(/^[A-Za-z][\w-]*(?=\s*=)/)) return 'attributeName'
      if (stream.match(/^[\/:;=]/)) return 'punctuation'
      if (stream.match(/^\d+(?:\.\d+)*/)) return 'number'
      if (stream.match(/^[A-Za-z][\w.-]*/)) return 'variableName'
      stream.next()
      return null
    },
  })

/** reStructuredText: directives, section underlines, roles and literals. */
const REST_DIRECTIVES = words(
  'code contents include image figure note warning admonition attention caution danger error hint important tip seealso topic sidebar raw csv-table list-table math pull-quote compound container epigraph highlights pull replace unicode date role default-role title meta',
)

const restMode: Factory = () =>
  StreamLanguage.define({
    name: 'rest',
    token(stream) {
      const atLineStart = stream.sol()
      const indented = stream.eatSpace()
      if (atLineStart) {
        if (stream.match(/^\.\.\s*[A-Za-z][A-Za-z-]*/)) {
          const word = stream
            .current()
            .trim()
            .replace(/^\.\.\s*/, '')
          return REST_DIRECTIVES.has(word) ? 'keyword' : 'comment'
        }
        if (stream.match(/^\.\./)) return 'comment'
        if (!indented && stream.match(/^[=\-~^"'#*+`]{2,}/)) {
          while (stream.peek() === ' ' || stream.peek() === '\t') stream.next()
          return stream.eol() ? 'heading' : null
        }
      }
      if (stream.match(/^``[^`]*``/)) return 'string'
      if (stream.match(/^\|[^|]*\|/)) return 'string'
      if (stream.match(/^\*\*[^*]+\*\*/)) return 'strong'
      if (stream.match(/^\*[^*]+\*/)) return 'emphasis'
      if (stream.match(/^:[A-Za-z][\w-]*:/)) return 'attributeName'
      if (stream.match(/^`[^`]+`/)) return 'string'
      stream.next()
      return null
    },
  })

/** Git style ignore files: comments, patterns and negated patterns. */
const gitignoreMode: Factory = () =>
  StreamLanguage.define({
    name: 'gitignore',
    token(stream) {
      const atLineStart = stream.sol()
      if (atLineStart) {
        if (stream.match(/^#.*/)) return 'comment'
        if (stream.match(/^!/)) return 'keyword'
        if (stream.match(/^\//)) return 'punctuation'
      }
      if (stream.eatSpace()) return null
      if (stream.match(/^[^\s#!]+/)) return 'string'
      stream.next()
      return null
    },
  })

/** Apple style strings files: "key" = "value"; */
const stringsMode: Factory = () =>
  StreamLanguage.define({
    name: 'strings',
    token(stream) {
      if (stream.eatSpace()) return null
      if (stream.match(/^"(?:[^"\\]|\\.)*"/)) return 'string'
      if (stream.match(/^=/)) return 'operator'
      if (stream.match(/^;/)) return 'punctuation'
      if (stream.match(/^\/\/.*/)) return 'comment'
      if (stream.match(/^\/\*/)) {
        while (!stream.eol() && !stream.match(/\*\//)) stream.next()
        stream.match(/\*\//)
        return 'comment'
      }
      stream.next()
      return null
    },
  })

/** Visual Studio solution files. */
const slnMode: Factory = () =>
  StreamLanguage.define({
    name: 'sln',
    token(stream) {
      if (stream.eatSpace()) return null
      if (stream.match(/^(?:EndProject|EndGlobalSection|EndGlobal|GlobalSection|Global|Project)\b/)) return 'keyword'
      if (stream.match(/^[A-Za-z][\w.]*(?=\))/)) return 'meta'
      if (stream.match(/^\{[^}]*\}/)) return 'string'
      if (stream.match(/^"(?:[^"\\]|\\.)*"/)) return 'string'
      if (stream.match(/^[A-Za-z][\w.+ -]*(?=\s*\|)/)) return 'variableName'
      if (stream.match(/^[A-Za-z][\w.+-]*/)) return 'variableName'
      if (stream.match(/^[=|()]/)) return 'punctuation'
      stream.next()
      return null
    },
  })

/** Robot Framework test data. */
const robotMode: Factory = () =>
  StreamLanguage.define({
    name: 'robot',
    token(stream) {
      const atLineStart = stream.sol()
      if (stream.eatSpace()) return null
      if (atLineStart && stream.match(/^\*\*\*\s*[A-Za-z ]+\s*\*\*\*/)) return 'heading'
      if (stream.match(/^\$\{[^}]*\}/)) return 'variableName'
      if (stream.match(/^@[\w.]+/)) return 'meta'
      if (stream.match(/^\d+(?:\.\d+)?/)) return 'number'
      if (stream.match(/^[A-Za-z][A-Za-z ]*?(?=\s{2,})/)) return 'variableName.special'
      stream.next()
      return null
    },
  })

/** Pug templates: indentation based blocks and keywords. */
const PUG_KEYWORDS = words('extends include block mixin each if else while case when do unless append prepend')

const pugMode: Factory = () =>
  StreamLanguage.define({
    name: 'pug',
    token(stream) {
      const atLineStart = stream.sol()
      stream.eatSpace()
      if (atLineStart) {
        if (stream.match(/^\/\/.*/)) return 'comment'
        if (stream.match(/^[-=:]+/)) return 'punctuation'
        if (stream.match(/^[A-Za-z_][\w-]*/)) {
          const word = stream.current().trim()
          return PUG_KEYWORDS.has(word) ? 'keyword' : 'tagName'
        }
        return null
      }
      if (stream.match(/^\{[^}]*\}/)) return 'meta'
      if (stream.match(/^"(?:[^"\\]|\\.)*"/)) return 'string'
      if (stream.match(/^[\w-]+(?=\s*[=(])/)) return 'attributeName'
      stream.next()
      return null
    },
  })

/** Justfiles: recipes, variables and shell settings. */
const justMode: Factory = () =>
  StreamLanguage.define({
    name: 'just',
    token(stream) {
      if (stream.eatSpace()) return null
      if (stream.match(/^#.*/)) return 'comment'
      if (stream.match(/^(?:set|export|unexport|alias|import|mod)\b/)) return 'keyword'
      if (stream.match(/^[A-Za-z_][\w-]*(?=\s*:=)/)) return 'variableName'
      if (stream.match(/^[A-Za-z_][\w-]*(?=\s*:)/)) return 'attributeName'
      if (stream.match(/^:=/)) return 'operator'
      if (stream.match(/^:/)) return 'punctuation'
      if (stream.match(/^"(?:[^"\\]|\\.)*"/)) return 'string'
      if (stream.match(/^\d+(?:\.\d+)?/)) return 'number'
      if (stream.match(/^[A-Za-z_][\w-]*/)) return 'variableName'
      stream.next()
      return null
    },
  })

/** Plain text: no highlighting, but a real (empty) stream language. */
const plainTextMode: Factory = () =>
  StreamLanguage.define({
    name: 'text',
    token(stream) {
      stream.skipToEnd()
      return null
    },
  })

/* ------------------------------------------------------------------ *
 * Factories
 * ------------------------------------------------------------------ */

/** Official CodeMirror language packages. */
const OFFICIAL: Record<string, Factory> = {
  javascript: () => javascript(),
  typescript: () => javascript({ typescript: true }),
  jsx: () => javascript({ jsx: true }),
  tsx: () => javascript({ jsx: true, typescript: true }),
  html: () => html(),
  css: () => css(),
  json: () => json(),
  markdown: () => markdown(),
  xml: () => xml(),
  python: () => python(),
  java: () => java(),
  rust: () => rust(),
  c: () => cpp(),
  cpp: () => cpp(),
  go: () => go(),
  php: () => php(),
  sql: () => sql(),
  yaml: () => yaml(),
}

/** Ported CodeMirror 5 modes. */
const LEGACY: Record<string, Factory> = {
  scss: () => StreamLanguage.define(sCSS),
  less: () => StreamLanguage.define(less),
  kotlin: () => StreamLanguage.define(kotlin),
  scala: () => StreamLanguage.define(scala),
  dart: () => StreamLanguage.define(dart),
  objectivec: () => StreamLanguage.define(objectiveC),
  swift: () => StreamLanguage.define(swift),
  shell: () => StreamLanguage.define(shell),
  bash: () => StreamLanguage.define(shell),
  powershell: () => StreamLanguage.define(powerShell),
  ruby: () => StreamLanguage.define(ruby),
  perl: () => StreamLanguage.define(perl),
  lua: () => StreamLanguage.define(lua),
  clojure: () => StreamLanguage.define(clojure),
  coffee: () => StreamLanguage.define(coffeeScript),
  groovy: () => StreamLanguage.define(groovy),
  tcl: () => StreamLanguage.define(tcl),
  haskell: () => StreamLanguage.define(haskell),
  erlang: () => StreamLanguage.define(erlang),
  julia: () => StreamLanguage.define(julia),
  r: () => StreamLanguage.define(r),
  d: () => StreamLanguage.define(d),
  fortran: () => StreamLanguage.define(fortran),
  cobol: () => StreamLanguage.define(cobol),
  pascal: () => StreamLanguage.define(pascal),
  crystal: () => StreamLanguage.define(crystal),
  vb: () => StreamLanguage.define(vb),
  ocaml: () => StreamLanguage.define(oCaml),
  fsharp: () => StreamLanguage.define(fSharp),
  asm: () => StreamLanguage.define(gas),
  verilog: () => StreamLanguage.define(verilog),
  vhdl: () => StreamLanguage.define(vhdl),
  tex: () => StreamLanguage.define(stex),
  latex: () => StreamLanguage.define(stex),
  diff: () => StreamLanguage.define(diff),
  dockerfile: () => StreamLanguage.define(dockerFile),
  nginx: () => StreamLanguage.define(nginx),
  ini: () => StreamLanguage.define(properties),
  toml: () => StreamLanguage.define(toml),
  protobuf: () => StreamLanguage.define(protobuf),
  gradle: () => StreamLanguage.define(groovy),
  gradlekts: () => StreamLanguage.define(kotlin),
  haxe: () => StreamLanguage.define(haxe),
  raku: () => StreamLanguage.define(perl),
  systemd: () => StreamLanguage.define(properties),
  desktop: () => StreamLanguage.define(properties),
  gitconfig: () => StreamLanguage.define(properties),
  editorconfig: () => StreamLanguage.define(properties),
  xcconfig: () => StreamLanguage.define(properties),
  pbxproj: () => StreamLanguage.define(properties),
  rkt: () => StreamLanguage.define(scheme),
  racket: () => StreamLanguage.define(scheme),
  scm: () => StreamLanguage.define(scheme),
  emacs: () => StreamLanguage.define(commonLisp),
  csproj: () => StreamLanguage.define(legacyXml),
  vbproj: () => StreamLanguage.define(legacyXml),
  fsproj: () => StreamLanguage.define(legacyXml),
}

/** Hand written modes for languages without a package. */
const CUSTOM: Record<string, Factory> = {
  text: plainTextMode,
  csharp: csharpMode(),
  csv: csvMode,
  log: logMode,
  regexp: regexpMode,
  gdscript: kw(
    'gdscript',
    'func var const extends class_name signal enum export onready static self super await yield assert breakpoint if elif else for while match break continue pass return and or not in is as',
    {
      types: 'bool int float void String Array Dictionary',
      builtins: 'Vector2 Vector3 Color Node Node2D get_node print push_back',
      lineComment: '#',
      quotes: '"\'`',
    },
  ),
  elm: kw('elm', 'type alias module import exposing port as if then else case of let in infix', {
    lineComment: '--',
    quotes: '"\'`',
  }),
  purescript: kw(
    'purescript',
    'module import data type class instance where do let in case of foreign forall deriving newtype infix infixl infixr else then',
    { lineComment: '--', quotes: '"\'`' },
  ),
  idris: kw(
    'idris',
    'data module import where total interface implementation record let in case of with do prove rewrite using hiding',
    { lineComment: '--', quotes: '"\'`' },
  ),
  agda: kw('agda', 'module data record where open import postulate private abstract instance infix constructor field', {
    lineComment: '--',
    quotes: '"\'`',
  }),
  lean: kw(
    'lean',
    'theorem def structure inductive instance where open namespace lemma example end abbrev universe variable section',
    { lineComment: '--', quotes: '"\'`' },
  ),
  http: httpMode,
  rest: restMode,
  prisma: kw('prisma', 'model enum datasource generator type interface view provider output', {
    attributes: '@@map @id @default @relation @unique @updatedAt @createdAt @db @ignore @index',
  }),
  gitignore: gitignoreMode,
  gdignore: gitignoreMode,
  mustache: templateMode({ name: 'mustache', keywords: '', kinds: MUSTACHE_KINDS }),
  handlebars: templateMode({
    name: 'handlebars',
    keywords: 'if else each unless with helper partial block lookup log',
    kinds: MUSTACHE_KINDS,
  }),
  ejs: templateMode({
    name: 'ejs',
    keywords: 'if else for while let var const function return true false null',
    kinds: [
      { open: '<%#', close: '%>', style: 'comment' },
      { open: '<%=', close: '%>', style: 'expr' },
      { open: '<%-', close: '%>', style: 'expr' },
      { open: '<%', close: '%>', style: 'tag' },
    ],
  }),
  pug: pugMode,
  twig: templateMode({
    name: 'twig',
    keywords:
      'if elseif else endif for endfor set block extends include macro filter raw apply spaceless do import from as with',
    kinds: BRACE_KINDS,
  }),
  liquid: templateMode({
    name: 'liquid',
    keywords:
      'if elsif else endif unless endunless for endfor case when endcase break continue assign capture increment decrement comment endcomment raw endraw tablerow endtablerow include',
    kinds: BRACE_KINDS,
  }),
  gherkin: kw('gherkin', 'Feature Background Scenario Outline Examples Given When Then And But Rule', {
    lineComment: '#',
  }),
  robot: robotMode,
  jsonnet: kw('jsonnet', 'local function import if then else self super error assert tailstrict', {
    blockComment: ['/*', '*/'],
  }),
  cue: kw('cue', 'package import let if for in hidden or', { lineComment: '#' }),
  starlark: kw('starlark', 'def if else elif for in not and or load return pass break continue lambda while', {
    types: 'True False None',
    lineComment: '#',
  }),
  just: justMode,
  meson: kw(
    'meson',
    'project executable library dependency foreach endforeach if else elif subdir install_headers configure_file',
    { lineComment: '#' },
  ),
  cmake: kw(
    'cmake',
    'cmake_minimum_required project add_executable add_library target_link_libraries target_include_directories set include add_subdirectory if elseif else endif foreach endforeach option message install find_package add_custom_target add_custom_command add_test enable_testing set_target_properties target_compile_options target_compile_definitions configure_file list string file function macro endfunction return break continue while endwhile endmacro',
    { lineComment: '#' },
  ),
  ninja: kw('ninja', 'rule build pool default phony', { lineComment: '#' }),
  bazel: kw(
    'bazel',
    'cc_library cc_binary java_library java_binary py_library py_binary go_library proto_library load deps glob package',
    { lineComment: '#' },
  ),
  wat: kw('wat', 'module func param result local global call i32 i64 f32 f64', {
    lineComment: ';;',
    blockComment: ['(;', ';)'],
  }),
  scad: kw(
    'scad',
    'module function include use for intersection difference union cylinder sphere cube polyhedron echo translate rotate scale resize mirror color offset hull minkowski children',
    { lineComment: '#' },
  ),
  ino: kw(
    'ino',
    'void int bool float char byte long short unsigned const static struct enum union class public private protected return if else for while switch case break continue do goto new delete sizeof true false',
    {
      types: 'void int long float double boolean byte char word String',
      builtins:
        'setup loop digitalWrite digitalRead pinMode analogWrite analogRead delay tone Serial Serial2 print println HIGH LOW INPUT OUTPUT INPUT_PULLUP LED_BUILTIN',
      blockComment: ['/*', '*/'],
    },
  ),
  plist: xmlLikeMode('plist'),
  strings: stringsMode,
  sln: slnMode,
  tres: xmlLikeMode('tres'),
  tscn: xmlLikeMode('tscn'),
  zig: keywordMode({
    name: 'zig',
    keywords:
      'const var fn pub if else while for switch return break continue defer errdefer catch orelse try unreachable comptime inline export extern usingnamespace async await suspend resume nosuspend test asm and or not',
    types:
      'void bool u8 u16 u32 u64 u128 i8 i16 i32 i64 i128 f16 f32 f64 f80 f128 c_int c_uint c_long c_ulong c_longlong c_ulonglong c_short c_ushort c_char c_uchar c_void anyopaque anytype noreturn type usize isize',
    builtins: 'null undefined true false std debug print',
  }),
  elixir: keywordMode({
    name: 'elixir',
    keywords:
      'def defp defmodule defstruct defprotocol defimpl defmacro defmacrop defdelegate defguard defguardp defexception defcallback use import alias require quote unquote when and or not in fn do end case cond receive try rescue catch after raise throw with true false nil',
    types: 'atom binary bitstring boolean float integer list map number pid port reference tuple any',
    builtins: 'Enum Map Keyword List String IO Inspect Kernel Process Stream Range Date',
    lineComment: '#',
  }),
  ada: keywordMode({
    name: 'ada',
    keywords:
      'with is in others range loop end if then elsif else case when declare begin exception raise return procedure function package body type subtype record task renames constant array of access all abstract limited protected private',
    types: 'integer real boolean character string natural positive',
    lineComment: '--',
  }),
  nim: keywordMode({
    name: 'nim',
    keywords:
      'proc func method iterator template macro converter type var let const enum object tuple array set seq ref ptr nil true false return yield discard break continue raise try except finally defer import export include from importc as in is notin of shl shr and or not xor addr unsafe',
    types:
      'int int8 int16 int32 int64 uint uint8 uint16 uint32 uint64 float float32 float64 bool char string cstring pointer',
    lineComment: '#',
    quotes: '"\'`',
  }),
  solidity: keywordMode({
    name: 'solidity',
    keywords:
      'pragma solidity contract library interface function modifier constructor event error struct enum mapping returns return if else for while do break continue new delete require revert assert emit public private internal external pure view payable virtual override abstract immutable using import as is memory storage calldata anonymous unchecked this super try catch receive fallback',
    types: 'address bool string bytes byte int uint int8 int256 uint8 uint256 fixed ufixed',
    builtins:
      'msg sender value block timestamp tx origin gas wei gwei ether seconds minutes hours days now true false null',
    blockComment: ['/*', '*/'],
  }),
  hcl: keywordMode({
    name: 'hcl',
    keywords:
      'resource provider variable output module data terraform locals for_each count depends_on if else endif for endfor in dynamic each key value source type name lifecycle provisioner connection environment backend required_providers required_version true false null sensitive',
    types: 'string number bool list map object tuple set',
    lineComment: '#',
    blockComment: ['/*', '*/'],
  }),
  graphql: keywordMode({
    name: 'graphql',
    keywords:
      'query mutation subscription fragment on type interface union enum input schema scalar extend implements directive repeatable',
    types: 'Int Float String Boolean ID',
    lineComment: '#',
  }),
  matlab: keywordMode({
    name: 'matlab',
    keywords:
      'function end if elseif else switch case otherwise for while break continue return try catch global persistent classdef properties methods events parfor spmd',
    types:
      'double single int8 int16 int32 int64 uint8 uint16 uint32 uint64 logical char cell struct array table string',
    builtins:
      'zeros ones eye rand randn size length numel disp fprintf sprintf plot error warning hold figure axes sum mean std max min str2num num2str isempty exist fieldnames',
    lineComment: '%',
    quotes: '"\'`',
  }),
  awk: keywordMode({
    name: 'awk',
    keywords: 'BEGIN END if else while for do break continue next nextfile exit return delete print printf getline in',
    builtins:
      'NR NF FS OFS ORS RS FILENAME SUBSEP RSTART RLENGTH length substr index split sub gsub match sprintf sin cos atan2 exp log sqrt int rand srand tolower toupper system close',
    lineComment: '#',
  }),
  makefile: keywordMode({
    name: 'makefile',
    keywords: 'ifeq ifneq ifdef ifndef else endif include define endef export unexport override undefine vpath .PHONY',
    builtins: 'CC CXX CFLAGS LDFLAGS LDLIBS AR RANLIB RM MKDIR INSTALL',
    lineComment: '#',
    vars: /^\$[({][^)}]*[)}]/,
  }),
  batch: keywordMode({
    name: 'batch',
    keywords:
      'echo set if else goto call exit for in do rem pause start copy del md rd cd dir type cls shift defined exist errorlevel equ neq lss leq gtr geq',
    builtins: 'PATH HOME USERPROFILE TEMP COMSPEC ERRORLEVEL CD DATE TIME',
    lineComment: /^rem\b/i,
    vars: /^%[^%]+%/,
  }),
  vue: markupMode({
    name: 'vue',
    keywords:
      'v-if v-else v-else-if v-for v-show v-bind v-on v-model v-html v-text v-slot v-pre v-cloak ref reactive computed watch watchEffect onMounted onUnmounted defineProps defineEmits defineExpose setup',
  }),
  svelte: markupMode({
    name: 'svelte',
    keywords:
      'let export on bind use transition in animate class style $$props $$restProps $$slots each if else await then catch const debug html',
  }),
  astro: markupMode({
    name: 'astro',
    keywords:
      'import export const let var await async function return if else frontmatter slot component defineProps defineEmits',
    frontmatter: true,
  }),

  /* --- Modern language support ----------------------------------------- */

  /** WebGPU Shading Language */
  wgsl: keywordMode({
    name: 'wgsl',
    keywords:
      'fn struct let var const override private public if else else if while for loop break continue return discard require_assert assert select bitcast array texture texture_2d texture_2d_array texture_3d texture_cube texture_cube_array texture_multisampled_2d texture_storage_2d texture_storage_2d_array texture_depth_2d texture_depth_2d_array texture_depth_cube texture_depth_cube_array sampler sampler_comparison ptr ref alias asm atomic min max abs ceil clamp cos sin tan acos asin atan atan2 exp exp2 log log2 pow sqrt fma fwidth length distance dot cross normalize faceforward reflect refract determinant transpose inverse transpose min max clamp mix step smoothstep sign fract floor ceil round trunc',
    types:
      'bool i32 u32 f32 f16 i64 u64 abstract_int abstract_float atomic_i32 atomic_u32 vec2 vec3 vec4 mat2x2 mat2x3 mat2x4 mat3x2 mat3x3 mat3x4 mat4x2 mat4x3 mat4x4 array',
    builtins:
      'textureLoad textureStore textureSample textureSampleLevel textureSampleBias textureSampleCompare textureSampleCompareLevel textureDimensions textureNumLayers textureNumSamples textureGather textureGatherCompare',
    lineComment: '//',
    blockComment: ['/*', '*/'],
    quotes: '"',
  }),

  /** Gleam - type-safe functional language for the BEAM */
  gleam: keywordMode({
    name: 'gleam',
    keywords:
      'import as let const pub fn case if else try except with use todo panic assert type opaque external import erlang bit_array list map set dict tuple float int string dynamic result ok error nil true false and or not xor andalso orelse',
    types: 'Int Float Bool String List Map Set Tuple BitArray Result Option Dynamic Nil',
    builtins:
      'String.to_string Int.to_string Float.to_string List.map List.filter List.fold Map.keys Map.values Dict.from_list',
    lineComment: '//',
    blockComment: ['/*', '*/'],
    quotes: '"',
  }),

  /** V (Vlang) - fast compiled language */
  vlang: keywordMode({
    name: 'v',
    keywords:
      'fn struct const mut pub fn mut ref unsafe import module as if else for in match return break continue defer goto panic print println eprintln panic eprint eprintln',
    types: 'bool u8 u16 u32 u64 i8 i16 i32 i64 f32 f64 rune string &str [] []u8 []rune map array chan',
    builtins: 'println eprintln print eprint panic assert array map len cap sort sort_by reverse',
    lineComment: '//',
    blockComment: ['/*', '*/'],
    quotes: '"\'`',
  }),

  /** Odin - data-oriented programming language */
  odin: keywordMode({
    name: 'odin',
    keywords:
      'proc struct const import package when if else for while break continue return fallthrough defer using context private public foreign link_prefix link_name distinct implicit',
    types: 'bool u8 u16 u32 u64 i8 i16 i32 i64 f32 f64 rawptr string cstring rune',
    builtins: 'print println fmt complex math sort sort_by reverse append delete len cap',
    lineComment: '//',
    blockComment: ['/*', '*/'],
    quotes: '"\'`',
  }),

  /** Rescript - React-friendly ReasonML syntax */
  rescript: keywordMode({
    name: 'rescript',
    keywords:
      'let rec and switch try catch finally raise exception type module open include exception module type external val type constraint where lazy assert external val mutable method virtual private override inherit include class object end done fun function match with when try then else in if then else match begin for while downto to do done loop for of',
    types: 'int float bool string list option array tuple unit ref exn',
    builtins: 'List.map List.filter List.fold_left List.fold_right Array.map Array.iter String.length',
    lineComment: '//',
    blockComment: ['/*', '*/'],
    quotes: '"',
  }),

  /** Vale - fast, safe, easy systems language */
  vale: keywordMode({
    name: 'vale',
    keywords:
      'fn struct mut imm pure export import module as if else while for break continue return break continue assert panic if else match with where',
    types: 'bool i8 i16 i32 i64 u8 u16 u32 u64 f32 f64 str & &mut [] []mut',
    builtins: 'print println panic assert',
    lineComment: '//',
    blockComment: ['/*', '*/'],
    quotes: '"\'`',
  }),

  /** Carbon - Google's experimental C++ successor */
  carbon: keywordMode({
    name: 'carbon',
    keywords:
      'fn struct class interface let var varmut if else while for break continue return match case break continue impl impl as interface extends fn extend class interface',
    types: 'i8 i16 i32 i64 u8 u16 u32 u64 f32 f64 bool String Tuple Array Optional Result',
    builtins: 'Print Panic Assert Unreachable',
    lineComment: '//',
    blockComment: ['/*', '*/'],
    quotes: '"\'`',
  }),

  /** Zig already present, WGSL added above */
}

const FACTORIES: Record<string, Factory> = { ...OFFICIAL, ...LEGACY, ...CUSTOM }

const cache = new Map<string, Extension>()

/** Resolve a language id to a CodeMirror extension (empty array when unknown). */
export function languageExtension(id: string): Extension {
  const cached = cache.get(id)
  if (cached) return cached
  const factory = FACTORIES[id]
  if (!factory) return []
  const extension = factory()
  cache.set(id, extension)
  return extension
}
