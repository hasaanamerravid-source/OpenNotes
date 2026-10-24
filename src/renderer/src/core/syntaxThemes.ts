/**
 * Syntax colour themes for the code editor.
 *
 * A theme bundles two things:
 *  - a CodeMirror `HighlightStyle` that colours the syntax tokens, and
 *  - the chrome colours of the editor (background, gutter, selection, ...).
 *
 * The matching CSS custom properties live in `syntaxThemes.css`; the
 * `data-syntax-theme` attribute on the document root picks the active set.
 */
import { HighlightStyle } from '@codemirror/language'
import { Tag, tags as t } from '@lezer/highlight'
import type { SyntaxTheme } from '@shared/types'
import './syntaxThemes.css'

/**
 * Colours of the syntax token classes of a theme.
 *
 * The palette is deliberately fine grained: every token class a grammar can
 * produce gets its own colour so that code stays readable at a glance.
 */
export interface TokenPalette {
  /** Plain identifiers and any text without a more specific class. */
  text: string
  /** Language keywords (`class`, `return`, `import`, ...). */
  keyword: string
  /** Control flow keywords (`if`, `for`, `break`, ...). */
  control: string
  /** Keywords that behave like operators (`and`, `or`, `in`, ...). */
  operatorKeyword: string
  /** Keywords that introduce a definition (`function`, `def`, `class`, ...). */
  definitionKeyword: string
  /** Operator characters. */
  operator: string
  /** Modifiers (`static`, `public`, `readonly`, ...). */
  modifier: string
  /** Constants, booleans, `null`, `self`, colour literals and units. */
  constant: string
  /** Numeric literals. */
  number: string
  /** String literals. */
  string: string
  /** Regular expressions, escapes, characters and special strings. */
  special: string
  /** HTML/XML tag names. */
  tagName: string
  /** Attribute names and attribute values. */
  attribute: string
  /** Property and field names. */
  property: string
  /** Type, class and namespace names. */
  type: string
  /** Function names. */
  function: string
  /** Methods, i.e. functions reached through a property. */
  functionProperty: string
  /** Variable names. */
  variable: string
  /** Local variables and function parameters. */
  local: string
  /** Label names (`break` / `continue` targets). */
  label: string
  /** Macro and preprocessor names. */
  macro: string
  /** Comments. */
  comment: string
  /** Keywords inside doc comments. */
  commentKeyword: string
  /** Documentation comments. */
  docComment: string
  /** Headings. */
  heading: string
  /** Emphasised text. */
  emphasis: string
  /** Strongly emphasised text. */
  strong: string
  /** Links and URLs. */
  link: string
  /** Inline code spans. */
  monospace: string
  /** Quoted text. */
  quote: string
  /** Plain content of a markup document. */
  content: string
  /** Metadata, document meta and processing instructions. */
  metadata: string
  /** Annotations. */
  annotation: string
  /** Invalid syntax. */
  invalid: string
  /** Inserted text (diffs). */
  inserted: string
  /** Deleted text (diffs). */
  deleted: string
  /** Changed text (diffs). */
  changed: string
  /** Punctuation and separators. */
  punctuation: string
  /** Brackets of every kind. */
  bracket: string
}

/** A complete syntax theme: token colours plus editor chrome colours. */
export interface SyntaxThemeDef {
  id: SyntaxTheme
  label: string
  /** true when the theme is a dark theme */
  dark: boolean
  /** The CodeMirror highlight style used for token colours. */
  style: HighlightStyle
  /** Editor chrome colours (background, foreground, cursor, selection, gutter, …). */
  editor: {
    background: string
    foreground: string
    caret: string
    selection: string
    selectionForeground?: string
    activeLine: string
    gutterBackground: string
    gutterForeground: string
    activeGutterForeground: string
    matchingBracket: string
    searchMatch: string
    indentGuide: string
    comment: string
    lineNumber: string
  }
  /** A short description shown in the settings preview. */
  description: string
}

/**
 * `commentKeyword` and `dollar` are not part of the standard Lezer
 * vocabulary. They are defined here so a grammar that emits them still gets
 * a sensible colour instead of falling back to the plain foreground.
 */
const commentKeywordTag = Tag.define('commentKeyword', t.comment)
const dollarTag = Tag.define('dollar', t.string)

/** Build the CodeMirror highlight style of a palette. */
function buildStyle(p: TokenPalette): HighlightStyle {
  return HighlightStyle.define([
    { tag: t.name, color: p.text },
    { tag: t.comment, color: p.comment, fontStyle: 'italic' },
    { tag: [t.lineComment, t.blockComment], color: p.comment, fontStyle: 'italic' },
    { tag: t.docComment, color: p.docComment, fontStyle: 'italic' },
    { tag: commentKeywordTag, color: p.commentKeyword, fontWeight: 'bold' },
    { tag: t.string, color: p.string },
    { tag: t.docString, color: p.string },
    { tag: [t.special(t.string), t.regexp, t.escape, t.character], color: p.special },
    { tag: dollarTag, color: p.special },
    { tag: t.number, color: p.number },
    { tag: [t.integer, t.float], color: p.number },
    { tag: [t.bool, t.null, t.atom, t.self, t.unit, t.color], color: p.constant },
    { tag: t.keyword, color: p.keyword },
    { tag: t.controlKeyword, color: p.control, fontWeight: 'bold' },
    { tag: t.operatorKeyword, color: p.operatorKeyword },
    { tag: t.definitionKeyword, color: p.definitionKeyword, fontWeight: 'bold' },
    { tag: t.moduleKeyword, color: p.keyword },
    { tag: t.modifier, color: p.modifier },
    { tag: t.operator, color: p.operator },
    {
      tag: [
        t.derefOperator,
        t.arithmeticOperator,
        t.logicOperator,
        t.bitwiseOperator,
        t.compareOperator,
        t.updateOperator,
        t.definitionOperator,
        t.typeOperator,
        t.controlOperator,
      ],
      color: p.operator,
    },
    { tag: t.variableName, color: p.variable },
    { tag: t.local(t.variableName), color: p.local },
    { tag: t.definition(t.variableName), color: p.variable, fontWeight: 'bold' },
    { tag: t.function(t.variableName), color: p.function },
    { tag: t.function(t.propertyName), color: p.functionProperty },
    { tag: t.propertyName, color: p.property },
    { tag: t.definition(t.propertyName), color: p.property, fontWeight: 'bold' },
    { tag: t.attributeName, color: p.attribute },
    { tag: t.attributeValue, color: p.attribute },
    { tag: [t.typeName, t.className, t.namespace], color: p.type },
    { tag: t.tagName, color: p.tagName },
    { tag: t.labelName, color: p.label },
    { tag: t.macroName, color: p.macro },
    { tag: [t.constant(t.name), t.standard(t.name)], color: p.constant },
    { tag: t.special(t.variableName), color: p.special },
    { tag: t.punctuation, color: p.punctuation },
    { tag: t.separator, color: p.punctuation },
    { tag: t.bracket, color: p.bracket },
    { tag: [t.angleBracket, t.squareBracket, t.paren, t.brace], color: p.bracket },
    { tag: t.content, color: p.content },
    { tag: t.heading, color: p.heading, fontWeight: 'bold' },
    {
      tag: [t.heading1, t.heading2, t.heading3, t.heading4, t.heading5, t.heading6],
      color: p.heading,
      fontWeight: 'bold',
    },
    { tag: t.emphasis, color: p.emphasis, fontStyle: 'italic' },
    { tag: t.strong, color: p.strong, fontWeight: 'bold' },
    { tag: t.strikethrough, color: p.text, textDecoration: 'line-through' },
    { tag: t.link, color: p.link, textDecoration: 'underline' },
    { tag: t.url, color: p.link },
    { tag: t.monospace, color: p.monospace },
    { tag: t.list, color: p.punctuation },
    { tag: t.quote, color: p.quote, fontStyle: 'italic' },
    { tag: t.contentSeparator, color: p.punctuation },
    { tag: t.meta, color: p.metadata },
    { tag: t.documentMeta, color: p.metadata },
    { tag: t.processingInstruction, color: p.metadata },
    { tag: t.annotation, color: p.annotation },
    { tag: t.inserted, color: p.inserted },
    { tag: t.deleted, color: p.deleted },
    { tag: t.changed, color: p.changed },
    { tag: t.invalid, color: p.invalid },
  ])
}

/* ------------------------------------------------------------------ *
 * Palettes
 * ------------------------------------------------------------------ */

const darculaPalette: TokenPalette = {
  text: '#A9B7C6',
  keyword: '#CF8E6D',
  control: '#CF8E6D',
  operatorKeyword: '#CF8E6D',
  definitionKeyword: '#CF8E6D',
  operator: '#BCBEC4',
  modifier: '#9876AA',
  constant: '#CC7832',
  number: '#2AACB8',
  string: '#6A8759',
  special: '#C77DBB',
  tagName: '#E8BF6A',
  attribute: '#BABABA',
  property: '#A9B7C6',
  type: '#56A8F5',
  function: '#FFC66D',
  functionProperty: '#FFC66D',
  variable: '#A9B7C6',
  local: '#A9B7C6',
  label: '#C77DBB',
  macro: '#C77DBB',
  comment: '#808080',
  commentKeyword: '#A9B7C6',
  docComment: '#7A7E85',
  heading: '#FFC66D',
  emphasis: '#A9B7C6',
  strong: '#FFC66D',
  link: '#287BDE',
  monospace: '#6A8759',
  quote: '#6A8759',
  content: '#A9B7C6',
  metadata: '#9876AA',
  annotation: '#BABABA',
  invalid: '#F44747',
  inserted: '#6A8759',
  deleted: '#F44747',
  changed: '#2AACB8',
  punctuation: '#A9B7C6',
  bracket: '#A9B7C6',
}

const intellijLightPalette: TokenPalette = {
  text: '#000000',
  keyword: '#0033B3',
  control: '#0033B3',
  operatorKeyword: '#0033B3',
  definitionKeyword: '#0033B3',
  operator: '#000000',
  modifier: '#871094',
  constant: '#871094',
  number: '#1750EB',
  string: '#067D17',
  special: '#067D17',
  tagName: '#0033B3',
  attribute: '#871094',
  property: '#0033B3',
  type: '#000000',
  function: '#00627A',
  functionProperty: '#00627A',
  variable: '#000000',
  local: '#000000',
  label: '#000000',
  macro: '#871094',
  comment: '#8C8C8C',
  commentKeyword: '#000000',
  docComment: '#8C8C8C',
  heading: '#000080',
  emphasis: '#000000',
  strong: '#000000',
  link: '#0000EE',
  monospace: '#000000',
  quote: '#067D17',
  content: '#000000',
  metadata: '#871094',
  annotation: '#000000',
  invalid: '#FF0000',
  inserted: '#067D17',
  deleted: '#FF0000',
  changed: '#1750EB',
  punctuation: '#000000',
  bracket: '#000000',
}

const rainbowPalette: TokenPalette = {
  text: '#D7DAE0',
  keyword: '#FF6B6B',
  control: '#FFA657',
  operatorKeyword: '#FF6B6B',
  definitionKeyword: '#F778BA',
  operator: '#79C0FF',
  modifier: '#D2A8FF',
  constant: '#FFA657',
  number: '#56D4DD',
  string: '#7EE787',
  special: '#A5A5FF',
  tagName: '#E3B341',
  attribute: '#F778BA',
  property: '#A5A5FF',
  type: '#79C0FF',
  function: '#D2A8FF',
  functionProperty: '#D2A8FF',
  variable: '#D7DAE0',
  local: '#D7DAE0',
  label: '#F778BA',
  macro: '#E3B341',
  comment: '#8B949E',
  commentKeyword: '#79C0FF',
  docComment: '#7D8590',
  heading: '#FF6B6B',
  emphasis: '#D7DAE0',
  strong: '#E3B341',
  link: '#56D4DD',
  monospace: '#7EE787',
  quote: '#7EE787',
  content: '#D7DAE0',
  metadata: '#A5A5FF',
  annotation: '#E3B341',
  invalid: '#FF6B6B',
  inserted: '#7EE787',
  deleted: '#FF6B6B',
  changed: '#E3B341',
  punctuation: '#8B949E',
  bracket: '#8B949E',
}

const monokaiPalette: TokenPalette = {
  text: '#F8F8F2',
  keyword: '#F92672',
  control: '#F92672',
  operatorKeyword: '#F92672',
  definitionKeyword: '#F92672',
  operator: '#F92672',
  modifier: '#F92672',
  constant: '#AE81FF',
  number: '#AE81FF',
  string: '#E6DB74',
  special: '#E6DB74',
  tagName: '#F92672',
  attribute: '#A6E22E',
  property: '#F8F8F2',
  type: '#66D9EF',
  function: '#A6E22E',
  functionProperty: '#A6E22E',
  variable: '#F8F8F2',
  local: '#F8F8F2',
  label: '#F92672',
  macro: '#F92672',
  comment: '#75715E',
  commentKeyword: '#F92672',
  docComment: '#75715E',
  heading: '#A6E22E',
  emphasis: '#F8F8F2',
  strong: '#F8F8F2',
  link: '#66D9EF',
  monospace: '#E6DB74',
  quote: '#E6DB74',
  content: '#F8F8F2',
  metadata: '#75715E',
  annotation: '#75715E',
  invalid: '#F92672',
  inserted: '#A6E22E',
  deleted: '#F92672',
  changed: '#AE81FF',
  punctuation: '#F8F8F2',
  bracket: '#F8F8F2',
}

const solarizedPalette: TokenPalette = {
  text: '#839496',
  keyword: '#859900',
  control: '#859900',
  operatorKeyword: '#859900',
  definitionKeyword: '#859900',
  operator: '#859900',
  modifier: '#93A1A1',
  constant: '#CB4B16',
  number: '#2AA198',
  string: '#2AA198',
  special: '#2AA198',
  tagName: '#268BD2',
  attribute: '#268BD2',
  property: '#268BD2',
  type: '#B58900',
  function: '#268BD2',
  functionProperty: '#268BD2',
  variable: '#839496',
  local: '#839496',
  label: '#B58900',
  macro: '#CB4B16',
  comment: '#586E75',
  commentKeyword: '#CB4B16',
  docComment: '#586E75',
  heading: '#268BD2',
  emphasis: '#839496',
  strong: '#93A1A1',
  link: '#268BD2',
  monospace: '#2AA198',
  quote: '#2AA198',
  content: '#839496',
  metadata: '#CB4B16',
  annotation: '#93A1A1',
  invalid: '#DC322F',
  inserted: '#859900',
  deleted: '#DC322F',
  changed: '#B58900',
  punctuation: '#93A1A1',
  bracket: '#93A1A1',
}

const midnightPalette: TokenPalette = {
  text: '#C8D3F5',
  keyword: '#C792EA',
  control: '#FF9CAC',
  operatorKeyword: '#C792EA',
  definitionKeyword: '#82AAFF',
  operator: '#89DDFF',
  modifier: '#F78C6C',
  constant: '#FF9CAC',
  number: '#F78C6C',
  string: '#C3E88D',
  special: '#89DDFF',
  tagName: '#FF9CAC',
  attribute: '#82AAFF',
  property: '#C8D3F5',
  type: '#82AAFF',
  function: '#82AAFF',
  functionProperty: '#89DDFF',
  variable: '#C8D3F5',
  local: '#C8D3F5',
  label: '#82AAFF',
  macro: '#C792EA',
  comment: '#676B95',
  commentKeyword: '#89DDFF',
  docComment: '#676B95',
  heading: '#C792EA',
  emphasis: '#C8D3F5',
  strong: '#82AAFF',
  link: '#89DDFF',
  monospace: '#C3E88D',
  quote: '#C3E88D',
  content: '#C8D3F5',
  metadata: '#C792EA',
  annotation: '#82AAFF',
  invalid: '#FF5370',
  inserted: '#C3E88D',
  deleted: '#FF5370',
  changed: '#FFB86C',
  punctuation: '#A6ACCD',
  bracket: '#A6ACCD',
}

/* ------------------------------------------------------------------ *
 * Themes
 * ------------------------------------------------------------------ */

export const SYNTAX_THEMES: SyntaxThemeDef[] = [
  {
    id: 'darcula',
    label: 'OpenNotes Dark',
    dark: true,
    style: buildStyle(darculaPalette),
    editor: {
      background: '#2B2B2B',
      foreground: '#A9B7C6',
      caret: '#A9B7C6',
      selection: '#214283',
      selectionForeground: '#FFFFFF',
      activeLine: '#323232',
      gutterBackground: '#2B2B2B',
      gutterForeground: '#606366',
      activeGutterForeground: '#A9B7C6',
      matchingBracket: '#3C5C77',
      searchMatch: '#4B525E',
      indentGuide: '#3C3F41',
      comment: '#808080',
      lineNumber: '#606366',
    },
    description: 'The default dark palette: warm keywords, olive strings, soft blue types.',
  },
  {
    id: 'intellij-light',
    label: 'OpenNotes Light',
    dark: false,
    style: buildStyle(intellijLightPalette),
    editor: {
      background: '#FFFFFF',
      foreground: '#000000',
      caret: '#000000',
      selection: '#C9DFFD',
      selectionForeground: '#000000',
      activeLine: '#F2F2F2',
      gutterBackground: '#FFFFFF',
      gutterForeground: '#999999',
      activeGutterForeground: '#000000',
      matchingBracket: '#CCE8FF',
      searchMatch: '#FFE082',
      indentGuide: '#E3E3E3',
      comment: '#8C8C8C',
      lineNumber: '#999999',
    },
    description: 'A bright light palette: blue keywords, green strings, blue numbers.',
  },
  {
    id: 'rainbow',
    label: 'Rainbow',
    dark: true,
    style: buildStyle(rainbowPalette),
    editor: {
      background: '#11131C',
      foreground: '#D7DAE0',
      caret: '#FF6B6B',
      selection: '#2E3B57',
      selectionForeground: '#FFFFFF',
      activeLine: '#191C28',
      gutterBackground: '#11131C',
      gutterForeground: '#4B5263',
      activeGutterForeground: '#D7DAE0',
      matchingBracket: '#3E5C8A',
      searchMatch: '#6B5A00',
      indentGuide: '#262A38',
      comment: '#8B949E',
      lineNumber: '#4B5263',
    },
    description: 'High contrast rainbow: every token family gets its own hue.',
  },
  {
    id: 'monokai',
    label: 'Monokai',
    dark: true,
    style: buildStyle(monokaiPalette),
    editor: {
      background: '#272822',
      foreground: '#F8F8F2',
      caret: '#F8F8F2',
      selection: '#49483E',
      selectionForeground: '#F8F8F2',
      activeLine: '#3E3D32',
      gutterBackground: '#272822',
      gutterForeground: '#90908A',
      activeGutterForeground: '#C2C2BF',
      matchingBracket: '#49483E',
      searchMatch: '#6A6A5E',
      indentGuide: '#464741',
      comment: '#75715E',
      lineNumber: '#90908A',
    },
    description: 'The classic Monokai palette: pink keywords, yellow strings.',
  },
  {
    id: 'solarized',
    label: 'Solarized Dark',
    dark: true,
    style: buildStyle(solarizedPalette),
    editor: {
      background: '#002B36',
      foreground: '#839496',
      caret: '#93A1A1',
      selection: '#073642',
      selectionForeground: '#93A1A1',
      activeLine: '#073642',
      gutterBackground: '#002B36',
      gutterForeground: '#586E75',
      activeGutterForeground: '#93A1A1',
      matchingBracket: '#0E5A6B',
      searchMatch: '#0A4B58',
      indentGuide: '#073642',
      comment: '#586E75',
      lineNumber: '#586E75',
    },
    description: 'Solarized Dark: low contrast teal base with muted accents.',
  },
  {
    id: 'midnight',
    label: 'Midnight',
    dark: true,
    style: buildStyle(midnightPalette),
    editor: {
      background: '#0F1226',
      foreground: '#C8D3F5',
      caret: '#C8D3F5',
      selection: '#283055',
      selectionForeground: '#FFFFFF',
      activeLine: '#171B33',
      gutterBackground: '#0F1226',
      gutterForeground: '#454C7A',
      activeGutterForeground: '#C8D3F5',
      matchingBracket: '#2E3D7A',
      searchMatch: '#3A4A7A',
      indentGuide: '#1E2340',
      comment: '#676B95',
      lineNumber: '#454C7A',
    },
    description: 'Deep navy with cyan and magenta accents, Tokyo Night inspired.',
  },
]

/** Look up a theme by id, falling back to the default theme. */
export function syntaxTheme(id: SyntaxTheme): SyntaxThemeDef {
  return SYNTAX_THEMES.find((theme) => theme.id === id) ?? SYNTAX_THEMES[0]
}

/** All theme ids, in display order. */
export function syntaxThemeIds(): SyntaxTheme[] {
  return SYNTAX_THEMES.map((theme) => theme.id)
}
