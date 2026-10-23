# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Removed

- **Obsidian-style vault features** (vault index, wikilinks, backlinks, tags,
  graph, frontmatter, heading extraction, daily notes).
- **LibreOffice Writer / Word features** (WYSIWYG `Tiptap`, `.docx`/`.rtf`/`.odt`
  conversion via `mammoth`/`docx`/`jszip`, print / PDF export).
- **Locale trim**: `fr`, `ja`, `pt-BR`, `ar` removed; kept `en`, `de`, `es`, `ru`,
  `zh-CN`. All translations, settings, native menu and tests updated.
- **Unused modules / deps**: `core/vault.ts`, `core/wikilinks.ts`,
  `core/richText.ts`, `core/frontmatter.ts`, `RichTextEditor`/`RichToolbar`,
  `BacklinksPanel`/`TagPanel`/`GraphView`/`SearchPanel`, `main/docs/`,
  16 `@tiptap/*`, `docx`, `jszip`, `mammoth`, `tests/frontmatter.test.mts`.
- **Build packaging** (`build.files`) reduced to `out/**/*`, `package.json`,
  `node_modules/iconv-lite/**/*`, `node_modules/safer-buffer/**/*`; `npm install`
  dropped 81 packages.

### Added

- **Five-language interface** (`en`, `de`, `es`, `ru`, `zh-CN`) — `npm run i18n:check` green (537/537 × 4).
- Leaner `EditorPane` (`MarkdownPreview` plain `marked` + DOMPurify,
  `OutlinePanel` local `extractHeadings`, `FileTree` no `vaultRoot`),
  real working buttons (`file.open`, `commandPalette`, `quickSwitcher`).
  - The English catalogue (`src/shared/i18n/en.ts`) is the source of truth.
  - The other languages are plain JSON files in `src/shared/i18n/locales/`.
  - A key that is not translated yet falls back to English, so a half finished
    translation never breaks the application.
  - `npm run i18n:check` proves that every language file matches the English
    catalogue; `npm run i18n:coverage` shows how much is translated.
- Every dialog of the application keeps the keyboard focus inside it, closes
  with the escape key and gives the focus back to the control that opened it.
- The keyboard focus is visible everywhere, and the animations are switched
  off when the system asks for less movement.
- A unit test suite that runs the pure logic of the application without a
  window: `npm run test:unit`.
- A formatter with the settings of the project: `npm run format`.

### Changed

- The native menu is written in the language of the interface and is rebuilt
  when the language changes.
- Every window of the application is created by the same factory, so a second
  window looks exactly like the first one.
- The language servers of a project are now also found when the project
  folder is not named in the settings, but can be derived from the open file.
- The list of the tabs scrolls when there are more tabs than the window can
  show; the button that opens a new file always stays visible.
- The tabs can be walked through with the arrow keys (`Alt` with the arrow
  keys switches the tab from anywhere in the window).
- A jump to a line puts the line into the middle of the window.
- The shortcut of a command is a real shortcut now: the keys that only the
  commands declare (`F12`, `Shift+F12`, `Ctrl+`` `, `Ctrl+Shift+T`) work.
- The shortcut of the user wins over the accelerator of the native menu: the
  menu gives up its accelerator for a command that the user has bound.
- A key is never handled twice: the editor, the native menu and the window
  take turns, and only the first one that handles a key acts.

### Fixed

- A `[[wikilink]]` inside a code block is an example and no longer counted
  as a link of the vault.
- The message of a plugin (`ctx.toast(...)`) is shown again.
- A plugin that cannot be activated no longer leaves its commands behind.
- A plugin may use `export default { … }`, the syntax of the documentation.
- `Ctrl++` can be used as a shortcut (the plus key).
- `Alt` with the arrow keys switches the tab, even without `Ctrl`.
- `Ctrl+Shift+F` belongs to the search in files; the distraction free mode
  moved to `Ctrl+Alt+F`.
- The colour of the window follows the theme again; the call to the removed
  native overlay is gone.
- The launcher starts the packaged application (the process is called
  *OpenNotes* in the task manager) and opens no console window.

## [1.0.0] - 2026-10-19

The first public release.

### Added

- A text editor for code, plain text and Markdown with 129 languages,
  50 colour themes, code folding, a minimap and a find panel.
- Rich text editing for Word (`.docx`), OpenDocument (`.odt`), RTF, HTML and
  CSV, with printing and PDF export.
- Vaults: folders of notes with `[[wikilinks]]`, backlinks, tags, a heading
  outline, a graph and daily notes.
- An integrated terminal, a run panel and 35+ file icon themes.
- Language servers: go to definition, find references, the diagnostics of the
  server in the problems panel.
- A project wide search with regular expressions and a replace in every file.
- A command palette, a quick switcher and a main menu that is drawn by the
  application.
- 18 sound themes that are synthesised in the browser — no audio files are
  shipped.
- A native launcher, so the application can be started with a double click.
