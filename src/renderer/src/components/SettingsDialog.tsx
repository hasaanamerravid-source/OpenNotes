import type { JSX } from 'react'
import { useEffect, useState } from 'react'
import { useAppStore } from '../store/app'
import { DEFAULT_SETTINGS, ENCODING_LABELS, EOL_LABELS } from '../core/defaults'
import { PROFILES } from '../core/profiles'
import { themeGroups, resolveTheme } from '../core/themeResolver'
import { ThemeGallery } from './ThemeGallery'
import { FileIcon } from './FileIcon'
import { ICON_THEMES } from '../core/iconThemes'
import { SOUND_THEMES, playSound } from '../core/sounds'
import { getCommands } from '../core/commands'
import {
  fromVSCode,
  keybindingsPath,
  readKeybindings,
  setKeybindings,
  writeKeybindings,
  type Keybindings,
} from '../core/keybindings'
import { PROJECT_CONFIG_NAME, projectFolder, readProjectConfig, writeProjectConfig } from '../core/projectConfig'
import {
  commandKey,
  LOCALES,
  setLocale,
  translationProgress,
  useT,
  useTWith,
  type LocaleId,
  type MessageKey,
} from '../core/i18n'
import { Modal } from './Modal'

type Section = 'appearance' | 'icons' | 'toolchain' | 'workspace' | 'editor' | 'files' | 'shortcuts'

/** The interpreters / SDKs the user can point at. */
const TOOLCHAIN_LANGUAGES: { id: string; label: string; hint: string; placeholder: string; exe?: string }[] = [
  {
    id: 'java',
    label: 'Java (JDK)',
    hint: 'The JDK used to compile and run .java files',
    placeholder: 'C:\\Program Files\\Java\\jdk-21',
    exe: 'bin\\java.exe',
  },
  {
    id: 'node',
    label: 'Node.js',
    hint: 'The node executable',
    placeholder: 'C:\\Program Files\\nodejs\\node.exe',
    exe: 'node.exe',
  },
  {
    id: 'python',
    label: 'Python',
    hint: 'The python executable',
    placeholder: 'C:\\Python312\\python.exe',
    exe: 'python.exe',
  },
  { id: 'go', label: 'Go', hint: 'The go executable', placeholder: 'C:\\Go\\bin\\go.exe', exe: 'go.exe' },
  {
    id: 'dotnet',
    label: '.NET SDK',
    hint: 'The dotnet executable',
    placeholder: 'C:\\Program Files\\dotnet\\dotnet.exe',
    exe: 'dotnet.exe',
  },
  {
    id: 'rust',
    label: 'Rust',
    hint: 'The cargo executable',
    placeholder: '%USERPROFILE%\\.cargo\\bin\\cargo.exe',
    exe: 'cargo.exe',
  },
  { id: 'php', label: 'PHP', hint: 'The php executable', placeholder: 'C:\\php\\php.exe', exe: 'php.exe' },
  { id: 'ruby', label: 'Ruby', hint: 'The ruby executable', placeholder: 'C:\\Ruby\\bin\\ruby.exe', exe: 'ruby.exe' },
  {
    id: 'dotnet-script',
    label: 'Script',
    hint: 'The interpreter used for .csx scripts',
    placeholder: 'dotnet-script',
    exe: 'dotnet-script.exe',
  },
]

/**
 * The hints of the toolchain rows.
 *
 * The map holds the English text for now: a language that has no message yet
 * falls back to the text that is written down here.
 */
const TOOLCHAIN_HINTS: Record<string, string> = {
  java: 'The JDK used to compile and run .java files',
  node: 'The node executable',
  python: 'The python executable',
  go: 'The go executable',
  dotnet: 'The dotnet executable',
  rust: 'The cargo executable',
  php: 'The php executable',
  ruby: 'The ruby executable',
  'dotnet-script': 'The interpreter used for .csx scripts',
}

/** The languages that can have a language server. */
const LSP_LANGUAGES = [
  'go',
  'java',
  'typescript',
  'javascript',
  'python',
  'rust',
  'csharp',
  'cpp',
  'php',
  'ruby',
  'kotlin',
  'swift',
  'lua',
]

const SHORTCUTS: [MessageKey, string][] = [
  ['cmd.file.new', 'Ctrl+N'],
  ['cmd.file.open', 'Ctrl+O'],
  ['settings.shortcutSave', 'Ctrl+S / Ctrl+Shift+S'],
  ['cmd.view.commandPalette', 'Ctrl+Shift+P'],
  ['cmd.view.quickSwitcher', 'Ctrl+Shift+O'],
  ['settings.shortcutFind', 'Ctrl+F / Ctrl+H'],
  ['cmd.edit.gotoLine', 'Ctrl+G'],
  ['cmd.view.toggleSidebar', 'Ctrl+Shift+E'],
  ['cmd.view.toggleSplit', 'Ctrl+Alt+S'],
  ['cmd.view.distractionFree', 'Ctrl+Alt+F'],
  ['cmd.edit.duplicateLine', 'Ctrl+D'],
  ['cmd.edit.deleteLine', 'Ctrl+Shift+K'],
  ['settings.shortcutMove', 'Alt+Shift+Up / Down'],
  ['cmd.edit.copyLine', 'Ctrl+Shift+C'],
  ['cmd.edit.toggleBookmark', 'Ctrl+F2'],
  ['settings.shortcutBookmarks', 'F2 / Shift+F2'],
  ['cmd.edit.selectAllOccurrences', 'Ctrl+Shift+L'],
  ['cmd.edit.insertDateTime', 'F5'],
  ['cmd.view.fullscreen', 'F11'],
]

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }): JSX.Element {
  return (
    <div className="form-row">
      <div>
        <div>{label}</div>
        {hint && <div className="hint">{hint}</div>}
      </div>
      <div className="control">{children}</div>
    </div>
  )
}

export function SettingsDialog(): JSX.Element | null {
  const open = useAppStore((s) => s.settingsOpen)
  const setDialog = useAppStore((s) => s.setDialog)
  const settings = useAppStore((s) => s.settings)
  const setSettings = useAppStore((s) => s.setSettings)
  const saveSettings = useAppStore((s) => s.saveSettings)
  const toast = useAppStore((s) => s.toast)
  const t = useT()
  const tWith = useTWith()
  const [section, setSection] = useState<Section>('appearance')
  const [importText, setImportText] = useState('')
  const [bindings, setBindings] = useState<Keybindings>({})
  const commandsWithShortcuts = getCommands().filter((command) => command.shortcut && !command.hidden)
  const progress = translationProgress(settings.language)

  // The shortcuts of the user are read when the tab is opened.
  useEffect(() => {
    if (section !== 'shortcuts') return
    void readKeybindings().then(setBindings)
  }, [section])

  if (!open) return null

  const close = (): void => {
    setDialog('settings', false)
    void saveSettings()
  }

  const patch = (partial: Partial<typeof settings>): void => {
    setSettings(partial)
    void saveSettings()
  }

  const patchAppearance = (partial: Partial<typeof settings.appearance>): void => {
    setSettings({ appearance: { ...settings.appearance, ...partial } })
  }

  return (
    <Modal
      title={t('settings.title')}
      onClose={close}
      tabs={
        <div className="settings-tabs" role="tablist" aria-label={t('settings.title')}>
          {(
            [
              ['appearance', 'settings.tab.appearance'],
              ['icons', 'settings.tab.icons'],
              ['toolchain', 'settings.tab.toolchain'],
              ['workspace', 'settings.tab.general'],
              ['editor', 'settings.tab.editor'],
              ['files', 'settings.tab.files'],
              ['shortcuts', 'settings.tab.shortcuts'],
            ] as [Section, MessageKey][]
          ).map(([id, label]) => (
            <div
              key={id}
              role="tab"
              aria-selected={section === id}
              className={`settings-tab ${section === id ? 'active' : ''}`}
              onClick={() => setSection(id)}
            >
              {t(label)}
            </div>
          ))}
        </div>
      }
      footer={
        <button className="icon-btn" onClick={close}>
          {t('common.close')}
        </button>
      }
    >
      {section === 'appearance' && (
        <>
          <Row label={t('settings.theme')} hint={t('settings.themeHint')}>
            <select value={settings.theme} onChange={(e) => patch({ theme: e.target.value as never })}>
              <option value="dark">{t('settings.themeDark')}</option>
              <option value="light">{t('settings.themeLight')}</option>
              <option value="system">{t('settings.themeSystem')}</option>
            </select>
          </Row>
          <Row label={t('settings.fontFamily')}>
            <input
              type="text"
              value={settings.fontFamily}
              onChange={(e) => setSettings({ fontFamily: e.target.value })}
            />
          </Row>
          <Row label={t('settings.fontSize')}>
            <input
              type="number"
              min={8}
              max={40}
              value={settings.fontSize}
              onChange={(e) => setSettings({ fontSize: Number(e.target.value) })}
            />
          </Row>
          <Row label={t('settings.editorBackground')} hint={t('settings.editorBackgroundHint')}>
            <select
              value={settings.editorBackground}
              onChange={(e) => patch({ editorBackground: e.target.value as never })}
            >
              <option value="app">{t('settings.editorBackgroundApp')}</option>
              <option value="theme">{t('settings.editorBackgroundTheme')}</option>
            </select>
          </Row>
          <div className="panel-header" style={{ marginTop: 10 }}>
            <span>{t('settings.syntaxTheme')}</span>
            <span>
              {t('settings.themeCount', {
                count: themeGroups().reduce((sum, g) => sum + g.themes.length, 0),
              })}
            </span>
          </div>
          <ThemeGallery
            value={settings.syntaxTheme}
            onChange={(id) => {
              setSettings({ syntaxTheme: id })
              void saveSettings()
            }}
          />
          <div style={{ margin: '4px 0 14px' }}>
            <div className="syntax-theme-preview" data-syntax-theme={settings.syntaxTheme}>
              <span className="tok-keyword">function</span> <span className="tok-function">greet</span>(
              <span className="tok-type">User</span> <span className="tok-property">name</span>) {'{'}
              <br />
              &nbsp;&nbsp;<span className="tok-comment">// say hello</span>
              <br />
              &nbsp;&nbsp;<span className="tok-keyword">return</span>{' '}
              <span className="tok-string">
                `Hello ${'{'}name{'}'}`
              </span>
              <br />
              {'}'}
              <br />
              <span className="tok-number">42</span> <span className="tok-tag">&lt;tag</span>{' '}
              <span className="tok-string">"value"</span> <span className="tok-tag">/&gt;</span>
            </div>
            <div className="hint">
              {resolveTheme(settings.syntaxTheme).label} — {resolveTheme(settings.syntaxTheme).basedOn}
            </div>
          </div>
          <Row label={t('settings.cornerRadius')} hint={t('settings.cornerRadiusHint')}>
            <input
              type="range"
              min={0}
              max={18}
              step={1}
              value={settings.appearance.cornerRadius}
              onChange={(e) => patchAppearance({ cornerRadius: Number(e.target.value) })}
              style={{ minWidth: 220 }}
            />
            <span style={{ width: 34, textAlign: 'right' }}>{settings.appearance.cornerRadius} px</span>
          </Row>
          <Row label={t('settings.glassTopBar')} hint={t('settings.glassTopBarHint')}>
            <input
              type="checkbox"
              checked={settings.appearance.glassTopBar}
              onChange={(e) => patchAppearance({ glassTopBar: e.target.checked })}
            />
          </Row>
          <Row label={t('settings.glassBlur')}>
            <input
              type="range"
              min={0}
              max={30}
              value={settings.appearance.glassBlur}
              onChange={(e) => patchAppearance({ glassBlur: Number(e.target.value) })}
              style={{ minWidth: 220 }}
            />
            <span style={{ width: 34, textAlign: 'right' }}>{settings.appearance.glassBlur} px</span>
          </Row>
          <Row label={t('settings.glassOpacity')}>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(settings.appearance.glassOpacity * 100)}
              onChange={(e) => patchAppearance({ glassOpacity: Number(e.target.value) / 100 })}
              style={{ minWidth: 220 }}
            />
            <span style={{ width: 34, textAlign: 'right' }}>{Math.round(settings.appearance.glassOpacity * 100)}%</span>
          </Row>
          <Row label={t('settings.gradient')} hint={t('settings.gradientHint')}>
            <input
              type="checkbox"
              checked={settings.appearance.gradient}
              onChange={(e) => patchAppearance({ gradient: e.target.checked })}
            />
          </Row>
          <Row label={t('settings.gradientColours')}>
            <input
              type="color"
              value={settings.appearance.gradientFrom}
              onChange={(e) => patchAppearance({ gradientFrom: e.target.value })}
            />
            <input
              type="color"
              value={settings.appearance.gradientTo}
              onChange={(e) => patchAppearance({ gradientTo: e.target.value })}
            />
          </Row>
          <Row label={t('settings.accentColor')} hint={t('settings.accentColorHint')}>
            <input
              type="color"
              value={settings.appearance.accentColor}
              onChange={(e) => patchAppearance({ accentColor: e.target.value })}
            />
          </Row>
          <Row label={t('settings.density')}>
            <select
              value={settings.appearance.density}
              onChange={(e) => patchAppearance({ density: e.target.value as never })}
            >
              <option value="compact">{t('settings.densityCompact')}</option>
              <option value="cozy">{t('settings.densityCozy')}</option>
              <option value="comfortable">{t('settings.densityComfortable')}</option>
            </select>
          </Row>
          <Row label={t('settings.tabStyle')}>
            <select
              value={settings.appearance.tabStyle}
              onChange={(e) => patchAppearance({ tabStyle: e.target.value as never })}
            >
              <option value="rounded">{t('settings.tabStyleRounded')}</option>
              <option value="pill">{t('settings.tabStylePill')}</option>
              <option value="underline">{t('settings.tabStyleUnderline')}</option>
            </select>
          </Row>
          <Row label={t('settings.softShadows')}>
            <input
              type="checkbox"
              checked={settings.appearance.softShadows}
              onChange={(e) => patchAppearance({ softShadows: e.target.checked })}
            />
          </Row>
          <Row label={t('settings.animations')}>
            <input
              type="checkbox"
              checked={settings.appearance.animations}
              onChange={(e) => patchAppearance({ animations: e.target.checked })}
            />
          </Row>
          <Row label={t('settings.lowMemory')} hint={t('settings.lowMemoryHint')}>
            <input
              type="checkbox"
              checked={settings.lowMemory}
              onChange={(e) => patch({ lowMemory: e.target.checked })}
            />
          </Row>
          <Row label={t('settings.softwareRendering')} hint={t('settings.softwareRenderingHint')}>
            <input
              type="checkbox"
              checked={settings.softwareRendering}
              onChange={(e) => patch({ softwareRendering: e.target.checked })}
            />
          </Row>
          <Row label={t('settings.showStatusBar')}>
            <input
              type="checkbox"
              checked={settings.showStatusBar}
              onChange={(e) => {
                setSettings({ showStatusBar: e.target.checked })
                useAppStore.setState({ statusBarVisible: e.target.checked })
                void saveSettings()
              }}
            />
          </Row>
          <Row label={t('settings.showSidebarOnStart')}>
            <input
              type="checkbox"
              checked={settings.showSidebar}
              onChange={(e) => {
                setSettings({ showSidebar: e.target.checked })
                useAppStore.setState({ sidebarVisible: e.target.checked })
                void saveSettings()
              }}
            />
          </Row>
          <div style={{ marginTop: 14 }}>
            <div className="panel-header">
              <span>{t('settings.preview')}</span>
            </div>
            <div className="appearance-preview">
              <div className="preview-top">
                <span className="preview-dot" />
                <span style={{ fontSize: 11, color: '#fff' }}>OpenNotes</span>
              </div>
              <div className="preview-body">
                <div className="preview-panel" />
                <div className="preview-button">{t('settings.previewButton')}</div>
              </div>
            </div>
          </div>
        </>
      )}

      {section === 'icons' && (
        <>
          <div className="panel-header">
            <span>{t('settings.fileIcons')}</span>
            <span>{t('settings.themeCount', { count: ICON_THEMES.length })}</span>
          </div>
          <div className="icon-gallery">
            {ICON_THEMES.map((theme) => (
              <button
                key={theme.id}
                className={`icon-card ${settings.iconTheme === theme.id ? 'active' : ''}`}
                onClick={() => patch({ iconTheme: theme.id })}
                title={theme.basedOn}
              >
                <span style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                  <FileIcon name="Main.java" theme={theme.id} size={15} />
                  <FileIcon name="app.ts" theme={theme.id} size={15} />
                  <FileIcon name="notes.md" theme={theme.id} size={15} />
                  <FileIcon name="data.json" theme={theme.id} size={15} />
                </span>
                <span className="name">{theme.label}</span>
              </button>
            ))}
          </div>
          <div className="hint" style={{ marginTop: 8 }}>
            {ICON_THEMES.find((t) => t.id === settings.iconTheme)?.basedOn}
          </div>

          <div className="panel-header" style={{ marginTop: 18 }}>
            <span>{t('settings.sounds')}</span>
            <span>{t('settings.themeCount', { count: SOUND_THEMES.length })}</span>
          </div>
          <Row label={t('settings.playSounds')}>
            <input
              type="checkbox"
              checked={settings.soundsEnabled}
              onChange={(e) => patch({ soundsEnabled: e.target.checked })}
            />
          </Row>
          <Row label={t('settings.soundVolume')}>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(settings.soundVolume * 100)}
              onChange={(e) => setSettings({ soundVolume: Number(e.target.value) / 100 })}
              style={{ minWidth: 220 }}
            />
            <span style={{ width: 34, textAlign: 'right' }}>{Math.round(settings.soundVolume * 100)}%</span>
          </Row>
          <div className="icon-gallery" style={{ marginTop: 6 }}>
            {SOUND_THEMES.map((theme) => (
              <button
                key={theme.id}
                className={`icon-card ${settings.soundTheme === theme.id ? 'active' : ''}`}
                onClick={() => {
                  setSettings({ soundTheme: theme.id })
                  void saveSettings()
                  playSound('save', theme.id, 0.5)
                }}
                title={theme.basedOn}
              >
                <span className="name">{theme.label}</span>
                <span
                  style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--fg-muted)' }}
                  onClick={(e) => {
                    e.stopPropagation()
                    playSound('complete', theme.id, 0.5)
                  }}
                >
                  {t('settings.testSound')}
                </span>
              </button>
            ))}
          </div>
          <div className="hint" style={{ marginTop: 8 }}>
            {t('settings.soundsHint')}
          </div>
        </>
      )}

      {section === 'toolchain' && (
        <>
          <div className="panel-header">
            <span>{t('settings.toolchainTitle')}</span>
            <span>{t('settings.toolchainPaths')}</span>
          </div>
          <div className="hint" style={{ marginTop: 0, marginBottom: 10 }}>
            {t('settings.toolchainHintLong')}
          </div>
          {TOOLCHAIN_LANGUAGES.map((entry) => (
            <Row key={entry.id} label={entry.label} hint={TOOLCHAIN_HINTS[entry.id] ?? entry.hint}>
              <input
                type="text"
                placeholder={entry.placeholder}
                value={settings.toolchain[entry.id] ?? ''}
                style={{ minWidth: 280 }}
                onChange={(e) => setSettings({ toolchain: { ...settings.toolchain, [entry.id]: e.target.value } })}
              />
              <button
                className="icon-btn"
                title={t('common.browse')}
                onClick={async () => {
                  const result = await window.api.fs.openDialog({
                    title: t('settings.selectFolder', { name: entry.label }),
                    directory: true,
                  })
                  const folder = result.filePaths[0]
                  if (!folder) return
                  const exe = entry.exe
                  const path = exe ? `${folder}\\${exe}` : folder
                  setSettings({ toolchain: { ...settings.toolchain, [entry.id]: path } })
                  void saveSettings()
                }}
              >
                …
              </button>
            </Row>
          ))}

          <div className="panel-header" style={{ marginTop: 16 }}>
            <span>{t('settings.lspServers')}</span>
            <span>LSP</span>
          </div>
          <div className="hint" style={{ marginTop: 0, marginBottom: 10 }}>
            {t('settings.lspServersHintLong')}
          </div>
          {LSP_LANGUAGES.map((language) => (
            <Row key={language} label={language}>
              <input
                type="text"
                placeholder={t('settings.defaultValue')}
                value={settings.lspServers[language]?.command ?? ''}
                style={{ minWidth: 280 }}
                onChange={(e) =>
                  setSettings({
                    lspServers: {
                      ...settings.lspServers,
                      [language]: { command: e.target.value, args: settings.lspServers[language]?.args },
                    },
                  })
                }
              />
            </Row>
          ))}

          <div className="panel-header" style={{ marginTop: 16 }}>
            <span>{t('panel.files')}</span>
          </div>
          <Row label={t('settings.projectFolder')} hint={t('settings.projectFolderHint')}>
            <input
              type="text"
              placeholder={t('settings.projectFolderPlaceholder')}
              value={settings.projectFolder ?? ''}
              style={{ minWidth: 280 }}
              onChange={(e) => setSettings({ projectFolder: e.target.value || null })}
            />
            <button
              className="icon-btn"
              title={t('common.browse')}
              onClick={async () => {
                const result = await window.api.fs.openDialog({
                  title: t('settings.selectProjectFolder'),
                  directory: true,
                })
                const folder = result.filePaths[0]
                if (!folder) return
                setSettings({ projectFolder: folder })
                void saveSettings()
              }}
            >
              …
            </button>
          </Row>
          <Row label={t('settings.configurationFile')} hint={t('settings.configurationFileHint')}>
            <span className="hint" style={{ textAlign: 'right' }}>
              {projectFolder() ? `${projectFolder()}\\${PROJECT_CONFIG_NAME}` : t('settings.noProjectFolder')}
            </span>
            <button
              className="icon-btn"
              title={t('settings.createProjectConfig')}
              onClick={async () => {
                const folder = projectFolder()
                if (!folder) return
                const existing = (await readProjectConfig(folder)) ?? {}
                await writeProjectConfig(folder, {
                  toolchain: { ...settings.toolchain, ...(existing.toolchain ?? {}) },
                  lsp: { ...settings.lspServers, ...(existing.lsp ?? {}) },
                  terminal: existing.terminal,
                  run: existing.run,
                })
                patch({ projectFolder: folder })
                toast(t('settings.projectConfigWritten'), 'success')
              }}
            >
              {t('common.save')}
            </button>
          </Row>
        </>
      )}

      {section === 'workspace' && (
        <>
          <Row label={t('settings.language')} hint={t('settings.languageHint')}>
            <select
              value={settings.language}
              onChange={(e) => {
                const locale = e.target.value as LocaleId
                void setLocale(locale)
              }}
            >
              {LOCALES.map((locale) => (
                <option key={locale.id} value={locale.id}>
                  {locale.nativeName} — {locale.englishName}
                </option>
              ))}
            </select>
          </Row>
          <Row
            label={t('settings.translationStatus')}
            hint={t('settings.translationProgress', {
              percent: progress.percent,
              done: progress.done,
              total: progress.total,
            })}
          >
            <span className="hint" style={{ textAlign: 'right' }}>
              {progress.percent}%
            </span>
          </Row>
          <Row label={t('settings.workspace')} hint={t('settings.workspaceHint')}>
            <span className="hint" style={{ maxWidth: 320, textAlign: 'right' }}>
              {t('settings.workspaceCoding')}
            </span>
          </Row>
          <Row label={t('settings.mainMenu')} hint={t('settings.mainMenuHint')}>
            <select value={settings.mainMenuStyle} onChange={(e) => patch({ mainMenuStyle: e.target.value as never })}>
              <option value="hamburger">{t('settings.menuHamburger')}</option>
              <option value="native">{t('settings.menuNative')}</option>
              <option value="both">{t('settings.menuBoth')}</option>
            </select>
          </Row>
          <div className="hint">
            The native Windows menu bar stays reachable with the <kbd>Alt</kbd> key, exactly like other open-source
            editors. Every command is also available in the command palette (<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+
            <kbd>P</kbd>).
          </div>
        </>
      )}

      {section === 'editor' && (
        <>
          <Row label={t('settings.lineWrapping')}>
            <input
              type="checkbox"
              checked={settings.lineWrapping}
              onChange={(e) => setSettings({ lineWrapping: e.target.checked })}
            />
          </Row>
          <Row label={t('settings.showLineNumbers')}>
            <input
              type="checkbox"
              checked={settings.showLineNumbers}
              onChange={(e) => setSettings({ showLineNumbers: e.target.checked })}
            />
          </Row>
          <Row label={t('settings.showInvisibles')}>
            <input
              type="checkbox"
              checked={settings.showInvisibles}
              onChange={(e) => setSettings({ showInvisibles: e.target.checked })}
            />
          </Row>
          <Row label={t('settings.showMinimap')}>
            <input
              type="checkbox"
              checked={settings.showMinimap}
              onChange={(e) => setSettings({ showMinimap: e.target.checked })}
            />
          </Row>
          <Row label={t('settings.showIndentGuides')}>
            <input
              type="checkbox"
              checked={settings.showIndentGuides}
              onChange={(e) => setSettings({ showIndentGuides: e.target.checked })}
            />
          </Row>
          <Row label={t('settings.highlightActiveLine')}>
            <input
              type="checkbox"
              checked={settings.highlightActiveLine}
              onChange={(e) => setSettings({ highlightActiveLine: e.target.checked })}
            />
          </Row>
          <Row label={t('settings.matchBrackets')}>
            <input
              type="checkbox"
              checked={settings.matchBrackets}
              onChange={(e) => setSettings({ matchBrackets: e.target.checked })}
            />
          </Row>
          <Row label={t('settings.autoCloseBrackets')}>
            <input
              type="checkbox"
              checked={settings.autoCloseBrackets}
              onChange={(e) => setSettings({ autoCloseBrackets: e.target.checked })}
            />
          </Row>
          <Row label={t('settings.autoIndent')}>
            <input
              type="checkbox"
              checked={settings.autoIndent}
              onChange={(e) => setSettings({ autoIndent: e.target.checked })}
            />
          </Row>
          <Row label={t('settings.trimTrailingWhitespace')}>
            <input
              type="checkbox"
              checked={settings.trimTrailingWhitespace}
              onChange={(e) => setSettings({ trimTrailingWhitespace: e.target.checked })}
            />
          </Row>
          <Row label={t('settings.tabSize')}>
            <input
              type="number"
              min={1}
              max={16}
              value={settings.tabSize}
              onChange={(e) => setSettings({ tabSize: Number(e.target.value) })}
            />
          </Row>
          <Row label={t('settings.insertSpaces')}>
            <input
              type="checkbox"
              checked={settings.insertSpaces}
              onChange={(e) => setSettings({ insertSpaces: e.target.checked })}
            />
          </Row>
          <Row label={t('settings.spellcheck')}>
            <input
              type="checkbox"
              checked={settings.spellcheck}
              onChange={(e) => setSettings({ spellcheck: e.target.checked })}
            />
          </Row>
        </>
      )}

      {section === 'files' && (
        <>
          <Row label={t('settings.defaultEncoding')}>
            <select value={settings.defaultEncoding} onChange={(e) => setSettings({ defaultEncoding: e.target.value })}>
              {Object.entries(ENCODING_LABELS)
                .filter(([key]) => key !== 'binary')
                .map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
            </select>
          </Row>
          <Row label={t('settings.defaultEol')}>
            <select value={settings.defaultEol} onChange={(e) => setSettings({ defaultEol: e.target.value as never })}>
              {Object.entries(EOL_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </Row>
          <Row label={t('settings.restoreSession')}>
            <input
              type="checkbox"
              checked={settings.restoreSession}
              onChange={(e) => setSettings({ restoreSession: e.target.checked })}
            />
          </Row>
          <Row label={t('settings.autosave')}>
            <input
              type="number"
              min={0}
              max={600}
              value={settings.autosaveInterval}
              onChange={(e) => setSettings({ autosaveInterval: Number(e.target.value) })}
            />
          </Row>
          <Row label={t('settings.defaultLanguage')}>
            <span className="hint" style={{ maxWidth: 320, textAlign: 'right' }}>
              {t('settings.defaultLanguageHint')}
            </span>
          </Row>
          <div className="form-row">
            <div>
              <div>{t('settings.resetAll')}</div>
              <div className="hint">{t('settings.resetAllHint')}</div>
            </div>
            <div className="control">
              <button
                className="icon-btn"
                onClick={() => {
                  setSettings({ ...DEFAULT_SETTINGS })
                  void saveSettings()
                }}
              >
                {t('common.reset')}
              </button>
            </div>
          </div>
        </>
      )}

      {section === 'shortcuts' && (
        <>
          <div className="hint" style={{ marginTop: 0, marginBottom: 10 }}>
            {t('settings.keybindingsHintLong')} <code>{keybindingsPath()}</code>
          </div>
          <div className="form-row">
            <div>
              <div>{t('settings.keybindingImportTitle')}</div>
              <div className="hint">{t('settings.keybindingImportHint2')}</div>
            </div>
            <div className="control" style={{ display: 'flex', gap: '6px' }}>
              <input
                type="text"
                placeholder='[ { "key": "ctrl+s", "command": "..." } ]'
                value={importText}
                style={{ minWidth: 280 }}
                onChange={(e) => setImportText(e.target.value)}
              />
              <button
                className="icon-btn"
                title={t('common.import')}
                onClick={() => {
                  const imported = fromVSCode(importText)
                  const names = Object.keys(imported)
                  if (!names.length) {
                    toast(t('settings.keybindingImportFailed'), 'error')
                    return
                  }
                  void readKeybindings().then(async (current) => {
                    const next = { ...current, ...imported }
                    await writeKeybindings(next)
                    setKeybindings(next)
                    toast(t('settings.keybindingImported', { count: names.length }), 'success')
                  })
                }}
              >
                {t('common.import')}
              </button>
            </div>
          </div>
          <div className="form-row">
            <div>
              <div>{t('settings.keybindings')}</div>
              <div className="hint">{t('settings.keybindingsChangeHint')}</div>
            </div>
            <div className="control" style={{ minWidth: 280, maxHeight: 260, overflow: 'auto' }}>
              {commandsWithShortcuts.map((command) => (
                <div key={command.id} className="keybinding-row">
                  <span className="name" title={command.id}>
                    {tWith(commandKey(command.id), command.title)}
                  </span>
                  <input
                    type="text"
                    className="keybinding-input"
                    value={bindings[command.id] ?? command.shortcut ?? ''}
                    onChange={(e) => {
                      const next = { ...bindings }
                      if (e.target.value.trim()) next[command.id] = e.target.value.trim()
                      else delete next[command.id]
                      setBindings(next)
                      setKeybindings(next)
                      void writeKeybindings(next)
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
          <table className="kbd-table">
            <tbody>
              {SHORTCUTS.map(([name, keys]) => (
                <tr key={name}>
                  <td>{t(name)}</td>
                  <td>
                    <kbd>{keys}</kbd>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </Modal>
  )
}
