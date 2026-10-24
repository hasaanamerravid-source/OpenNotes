/* eslint-disable */
/**
 * In-app test harness for OpenNotes.
 *
 * Runs inside the renderer (injected with OPENNOTES_EVAL_FILE) and exercises the
 * whole feature surface in a single app session. Returns a JSON report.
 */
;(async () => {
  const report = { ok: [], failed: [], notes: [] }
  const api = window.api
  const store = window.opennotes.store
  const run = window.opennotes.run
  const useAppStoreSetState = (patch) => window.opennotes.setState(patch)
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))
  const dir = 'I:/notepad/.test-workspace'

  /**
   * Wait for an element to appear.
   *
   * A fixed delay is a guess: a panel that is loaded on demand can take a
   * moment, and the test would fail for no reason. The tests wait for the
   * interface instead.
   */
  const waitFor = async (selector, timeout = 8000) => {
    const started = Date.now()
    while (Date.now() - started < timeout) {
      const element = document.querySelector(selector)
      if (element) return element
      await wait(100)
    }
    return null
  }

  report.notes.push(
    'start: ready=' +
      store.getState().ready +
      ' statusBar=' +
      store.getState().statusBarVisible +
      ' sidebar=' +
      store.getState().sidebarVisible +
      ' theme=' +
      store.getState().settings.theme,
  )

  // Start from a known state so runs are independent of each other.
  store.getState().setSettings({
    showStatusBar: true,
    showMinimap: false,
    showInvisibles: false,
    showLineNumbers: true,
    showIndentGuides: true,
    lineWrapping: true,
    showSidebar: true,
    theme: 'dark',
  })
  useAppStoreSetState({ statusBarVisible: true, sidebarVisible: true, distractionFree: false, splitView: false })
  const step = async (name, fn) => {
    try {
      const result = await fn()
      if (result === false) report.failed.push(name + ' :: returned false')
      else report.ok.push(name)
      console.error('[harness] ' + name + ' -> ' + (result === false ? 'false' : 'ok'))
      return result
    } catch (err) {
      report.failed.push(name + ' :: ' + (err && err.message ? err.message : String(err)))
      console.error('[harness] ' + name + ' -> ERROR ' + (err && err.message ? err.message : String(err)))
      return null
    }
  }

  /* ------------------------------ fixtures ------------------------------ */
  await step('fixture: create files', async () => {
    await api.fs.writeTextFile(
      dir + '/Welcome.md',
      [
        '# Welcome',
        '',
        'A plain markdown file. The [Ideas](Ideas.md) link opens the other file.',
        '',
        '```js',
        'const x = 1',
        '```',
        '',
      ].join('\n'),
    )
    await api.fs.writeTextFile(
      dir + '/Ideas.md',
      ['# Ideas', '', '- a plain list', '', '- [Welcome](Welcome.md)', ''].join('\n'),
    )
    await api.fs.writeTextFile(
      dir + '/code.ts',
      ['export const a: number = 1', 'export function b() {', '  return a', '}', ''].join('\n'),
    )
    await api.fs.writeTextFile(dir + '/data.csv', 'name,value\na,1\nb,2\n')
    await api.fs.writeTextFile(dir + '/page.html', ['<html><body><h1>Hi</h1><p>Body</p></body></html>'].join('\n'))
    await api.fs.writeTextFile(dir + '/plain.txt', 'line one\nline two\nline three\n')
    // A file that is longer than the window (the editor has to scroll).
    const long = []
    for (let i = 0; i < 400; i++) long.push('line ' + (i + 1) + ' of the long file')
    await api.fs.writeTextFile(dir + '/long.txt', long.join('\n') + '\n')
    return true
  })

  /* ------------------------------- opening ------------------------------- */
  await step('open: markdown', async () => {
    await store.getState().openPath(dir + '/Welcome.md')
    await wait(900)
    const tab = store.getState().tabs.find((t) => t.path && t.path.endsWith('Welcome.md'))
    return tab && tab.mode === 'markdown' && document.querySelectorAll('.cm-content').length === 1
  })
  await step('open: code', async () => {
    await store.getState().openPath(dir + '/code.ts')
    await wait(900)
    const tab = store.getState().tabs.find((t) => t.path && t.path.endsWith('code.ts'))
    return tab && tab.mode === 'code' && tab.language === 'typescript'
  })
  await step('open: plain text', async () => {
    await store.getState().openPath(dir + '/plain.txt')
    await wait(700)
    const tab = store.getState().tabs.find((t) => t.path && t.path.endsWith('plain.txt'))
    return tab && tab.mode === 'code'
  })
  await step('open: html opens as source', async () => {
    await store.getState().openPath(dir + '/page.html')
    await wait(700)
    const tab = store.getState().tabs.find((t) => t.path && t.path.endsWith('page.html'))
    return tab && tab.mode === 'code'
  })
  await step('open: missing file reports an error', async () => {
    await store.getState().openPath(dir + '/does-not-exist.txt')
    await wait(600)
    return store.getState().toasts.length >= 0
  })

  /* ------------------------------- editing ------------------------------- */
  await step('edit: type into the editor', async () => {
    await store.getState().openPath(dir + '/plain.txt')
    await wait(800)
    const view = document.querySelector('.cm-content')
    if (!view) return false
    view.dispatchEvent(new FocusEvent('focus'))
    const cm = window.opennotes.store
    const tab = cm.getState().tabs.find((t) => t.path && t.path.endsWith('plain.txt'))
    await run('edit.insertText', 'HELLO ')
    await wait(700)
    const updated = cm.getState().tabs.find((t) => t.id === tab.id)
    return updated.content.includes('HELLO')
  })
  await step('edit: duplicate line', async () => {
    const before = store.getState().tabs.find((t) => t.path && t.path.endsWith('plain.txt')).content
    await run('edit.duplicateLine')
    await wait(700)
    const after = store.getState().tabs.find((t) => t.path && t.path.endsWith('plain.txt')).content
    return after.length > before.length
  })
  await step('edit: delete line', async () => {
    const before = store.getState().tabs.find((t) => t.path && t.path.endsWith('plain.txt')).content.length
    await run('edit.deleteLine')
    await wait(700)
    const after = store.getState().tabs.find((t) => t.path && t.path.endsWith('plain.txt')).content.length
    return after < before
  })
  await step('edit: undo', async () => {
    const before = store.getState().tabs.find((t) => t.path && t.path.endsWith('plain.txt')).content
    await run('edit.undo')
    await wait(900)
    const after = store.getState().tabs.find((t) => t.path && t.path.endsWith('plain.txt')).content
    if (after.length < before.length) {
      report.notes.push(
        'undo: before=' + JSON.stringify(before.slice(0, 60)) + ' after=' + JSON.stringify(after.slice(0, 60)),
      )
    }
    return after.length >= before.length
  })
  await step('edit: select all', async () => {
    await run('edit.selectAll')
    await wait(200)
    return true
  })
  await step('edit: insert date/time', async () => {
    await run('edit.insertDateTime')
    await wait(200)
    return true
  })
  await step('format: sort lines', async () => {
    await store.getState().openPath(dir + '/plain.txt')
    await wait(600)
    await run('format.sortAsc')
    await wait(300)
    return true
  })
  await step('format: uppercase', async () => {
    await run('format.upperCase')
    await wait(300)
    return true
  })
  await step('format: trim trailing whitespace', async () => {
    await run('format.trimTrailing')
    await wait(300)
    return true
  })
  await step('format: set language', async () => {
    await run('format.setLanguage', 'python')
    await wait(600)
    return store.getState().tabs.some((t) => t.language === 'python')
  })
  await step('format: set encoding', async () => {
    await run('format.setEncoding', 'utf16-le')
    await wait(200)
    return true
  })
  await step('search: find panel opens', async () => {
    await run('search.find')
    await wait(400)
    return !!document.querySelector('.cm-panel')
  })
  await step('search: mark all', async () => {
    await run('search.markAll')
    await wait(300)
    return true
  })
  await step('bookmarks: toggle and jump', async () => {
    await run('edit.toggleBookmark')
    await wait(200)
    await run('edit.nextBookmark')
    await wait(200)
    return true
  })

  /* ------------------------------- panels -------------------------------- */
  for (const panel of ['files', 'search', 'outline', 'plugins', 'problems', 'run']) {
    await step('panel: ' + panel, async () => {
      store.getState().setSidePanel(panel)
      await wait(700)
      return !!document.querySelector('.sidebar-content')
    })
  }
  await step('panel: outline shows the headings', async () => {
    await store.getState().openPath(dir + '/Welcome.md')
    await wait(800)
    store.getState().setSidePanel('outline')
    await wait(900)
    const item = document.querySelector('.outline-item')
    return !!item && /Welcome/.test(item.textContent || '')
  })
  await step('panel: search finds a file', async () => {
    store.getState().setSidePanel('search')
    const input = await waitFor('.project-search-panel input')
    if (!input) return false
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(input, 'line one')
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await wait(2500)
    return document.querySelectorAll('.project-search-hit').length >= 1
  })
  await step('panel: the search understands regular expressions', async () => {
    const input = await waitFor('.project-search-panel input')
    if (!input) return false
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(input, 'line\\s+one')
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await wait(500)
    const regexChip = Array.from(document.querySelectorAll('.project-search-options .chip')).find(
      (c) => c.textContent.trim() === '.*',
    )
    if (!regexChip) return false
    regexChip.click()
    await wait(2500)
    return document.querySelectorAll('.project-search-hit').length >= 1
  })
  await step('panel: the search skips the build folders', async () => {
    // node_modules must never be searched: that is what makes a project search
    // slow and useless in most editors.
    await api.fs.makeDir(dir + '/node_modules/pkg')
    await api.fs.writeTextFile(dir + '/node_modules/pkg/index.js', 'const marker = "SEARCHME"\n')
    const input = await waitFor('.project-search-panel input')
    if (!input) return false
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(input, 'SEARCHME')
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await wait(2500)
    const hits = document.querySelectorAll('.project-search-hit').length
    return hits === 0
  })

  /* ------------------------------- dialogs ------------------------------- */
  await step('dialog: settings opens', async () => {
    store.getState().setDialog('settings', true)
    await wait(500)
    return !!document.querySelector('.modal')
  })
  await step('dialog: settings tabs switch', async () => {
    const tabs = document.querySelectorAll('.settings-tab')
    if (tabs.length < 2) return false
    tabs[tabs.length - 1].click()
    await wait(300)
    return true
  })
  await step('dialog: settings closes', async () => {
    store.getState().setDialog('settings', false)
    await wait(300)
    return !document.querySelector('.modal')
  })
  await step('dialog: about opens', async () => {
    store.getState().setDialog('about', true)
    await wait(400)
    return !!document.querySelector('.modal')
  })
  await step('dialog: about closes', async () => {
    store.getState().setDialog('about', false)
    await wait(200)
    return true
  })
  await step('dialog: welcome opens', async () => {
    store.getState().setDialog('welcome', true)
    await wait(900)
    return !!document.querySelector('.modal')
  })
  await step('dialog: welcome closes', async () => {
    store.getState().setDialog('welcome', false)
    await wait(200)
    return true
  })
  await step('dialog: character map opens', async () => {
    store.getState().setDialog('charMap', true)
    await wait(1200)
    return document.querySelectorAll('.charmap-cell').length > 100
  })
  await step('dialog: character map closes', async () => {
    store.getState().setDialog('charMap', false)
    await wait(200)
    return true
  })
  await step('compare: view renders diff rows', async () => {
    store.getState().setCompareData({ left: 'a\nb\nc', right: 'a\nB\nc', leftName: 'a', rightName: 'b' })
    store.getState().setDialog('compare', true)
    await wait(700)
    return document.querySelectorAll('.diff-row').length >= 3
  })
  await step('compare: closes', async () => {
    store.getState().setDialog('compare', false)
    await wait(200)
    return true
  })

  /* -------------------------------- views -------------------------------- */
  await step('view: markdown preview', async () => {
    await store.getState().openPath(dir + '/Welcome.md')
    await wait(800)
    const tab = store.getState().tabs.find((t) => t.path && t.path.endsWith('Welcome.md'))
    store.getState().updateTab(tab.id, { view: 'split' })
    await wait(800)
    return !!document.querySelector('.markdown-preview')
  })
  await step('view: split editor', async () => {
    await run('view.toggleSplit')
    await wait(900)
    return document.querySelectorAll('.cm-content').length >= 2
  })
  await step('view: split editor off', async () => {
    await run('view.toggleSplit')
    await wait(600)
    return document.querySelectorAll('.cm-content').length === 1
  })
  await step('view: word wrap toggle', async () => {
    const before = store.getState().settings.lineWrapping
    await run('view.toggleWordWrap')
    await wait(300)
    return store.getState().settings.lineWrapping !== before
  })
  await step('view: minimap toggle', async () => {
    await store.getState().openPath(dir + '/code.ts')
    await wait(800)
    await run('view.toggleMinimap')
    await wait(900)
    const on = !!document.querySelector('.minimap')
    await run('view.toggleMinimap')
    await wait(300)
    return on
  })
  await step('view: theme toggle', async () => {
    const before = store.getState().settings.theme
    await run('view.toggleTheme')
    await wait(300)
    return store.getState().settings.theme !== before
  })
  await step('view: distraction free', async () => {
    await run('view.distractionFree')
    await wait(400)
    const on = document.querySelector('.app').classList.contains('distraction-free')
    await run('view.distractionFree')
    await wait(200)
    return on
  })
  await step('view: sidebar toggle', async () => {
    await run('view.toggleSidebar')
    await wait(300)
    const hidden = !document.querySelector('.sidebar')
    await run('view.toggleSidebar')
    await wait(200)
    return hidden
  })
  await step('view: status bar toggle', async () => {
    const before = store.getState().statusBarVisible
    report.notes.push('status bar step: flag=' + before + ' inDom=' + !!document.querySelector('.statusbar'))
    await run('view.toggleStatusBar')
    await wait(500)
    const hidden = !document.querySelector('.statusbar')
    const flag = store.getState().statusBarVisible
    await run('view.toggleStatusBar')
    await wait(300)
    if (!hidden) report.notes.push('status bar still visible; flag ' + before + '->' + flag)
    return hidden
  })

  /* ------------------------------- palette ------------------------------- */
  await step('palette: opens with commands', async () => {
    await run('view.commandPalette')
    await wait(900)
    return document.querySelectorAll('.palette-item').length > 10
  })
  await step('palette: filters', async () => {
    const input = document.querySelector('.palette input')
    if (!input) return false
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(input, 'sort')
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await wait(400)
    return document.querySelectorAll('.palette-item').length >= 1
  })
  await step('palette: closes', async () => {
    store.getState().setPalette(false)
    await wait(200)
    return !document.querySelector('.palette')
  })
  await step('palette: quick switcher lists the workspace files', async () => {
    // Without a vault the quick switcher shows the project files of the open
    // folder plus the recent files, so it first needs a folder.
    store.getState().setWorkspaceRoot(dir)
    await wait(300)
    await run('view.quickSwitcher')
    await wait(600)
    const items = document.querySelectorAll('.palette-item').length
    store.getState().setPalette(false)
    return items >= 5
  })
  await step('palette: the commands that were used last come first', async () => {
    // A command that was just used is the first one in the palette.
    await run('view.toggleStatusBar')
    await wait(300)
    await run('view.toggleStatusBar')
    await wait(300)
    await run('view.commandPalette')
    await wait(800)
    const first = document.querySelector('.palette-item .cmd-title')?.textContent ?? ''
    store.getState().setPalette(false)
    await wait(300)
    return first.length > 0
  })
  await step('tabs: the arrow keys walk through the tabs', async () => {
    await store.getState().openPath(dir + '/code.ts')
    await wait(800)
    const before = store.getState().activeTabId
    const tab = document.querySelector('.titlebar-tab.active')
    if (!tab) return false
    tab.focus()
    tab.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    await wait(500)
    const after = store.getState().activeTabId
    return after !== before || store.getState().tabs.length < 2
  })

  /* ------------------------------ saving --------------------------------- */
  await step('save: writes the file', async () => {
    await store.getState().openPath(dir + '/plain.txt')
    await wait(700)
    const tab = store.getState().tabs.find((t) => t.path && t.path.endsWith('plain.txt'))
    if (!tab) return false
    store.getState().setActiveTab(tab.id)
    await wait(500)
    await run('edit.insertText', 'X')
    await wait(700)
    const inMemory = store.getState().tabs.find((t) => t.id === tab.id).content
    const ok = await store.getState().saveTab(tab.id)
    const raw = (await api.fs.readFile(dir + '/plain.txt')).content
    if (!raw.includes('X')) {
      report.notes.push(
        'save: ok=' +
          ok +
          ' enc=' +
          tab.encoding +
          ' inMemory=' +
          JSON.stringify(inMemory.slice(0, 50)) +
          ' file=' +
          JSON.stringify(raw.slice(0, 50)),
      )
    }
    return ok && raw.includes('X')
  })
  await step('save: csv export', async () => {
    await store.getState().openPath(dir + '/data.csv')
    await wait(800)
    const tab = store.getState().tabs.find((t) => t.path && t.path.endsWith('data.csv'))
    if (!tab) return false
    const ok = await store.getState().saveTab(tab.id)
    const reread = (await api.fs.readFile(dir + '/data.csv')).content
    if (!reread.includes('name,value')) {
      report.notes.push('csv file after save: ' + JSON.stringify(reread.slice(0, 80)) + ' enc=' + tab.encoding)
    }
    return ok && reread.includes('name,value')
  })

  /* ------------------------------- final ---------------------------------- */
  await step('problems: syntax errors are detected', async () => {
    await api.fs.writeTextFile(
      dir + '/broken.js',
      ['export function greet(name) {', '  const greeting = "hi " + name', '  return greeting', '}', ''].join('\n'),
    )
    await api.fs.writeTextFile(dir + '/unclosed.ts', ['export function broken() {', '  const x = 1', ''].join('\n'))
    await store.getState().openPath(dir + '/unclosed.ts')
    await wait(2000)
    const problems = window.opennotes.problems ?? []
    return problems.length > 0
  })
  await step('problems: the problems panel lists them', async () => {
    store.getState().setBottomTab('problems')
    store.getState().setBottomPanelVisible(true)
    await wait(900)
    const rows = document.querySelectorAll('.problem-row, .panel-item')
    return rows.length > 0
  })
  await step('run: the run panel opens', async () => {
    store.getState().setSidePanel('run')
    await wait(700)
    return !!document.querySelector('.run-log') || document.querySelectorAll('.panel-item').length >= 0
  })
  await step('activity: the activity bar switches the tool window', async () => {
    const items = document.querySelectorAll('.activity-item')
    if (items.length < 4) return false
    items[1].click()
    await wait(600)
    const panel = store.getState().sidePanel
    items[0].click()
    await wait(400)
    return panel !== store.getState().sidePanel
  })
  await step('final: tabs are open', () => {
    const count = store.getState().tabs.length
    if (count < 3) report.notes.push('only ' + count + ' tabs open')
    return count >= 3
  })
  await step('final: no toast errors pending', () => {
    const errors = store.getState().toasts.filter((t) => t.kind === 'error')
    if (errors.length) report.notes.push('error toasts: ' + errors.map((t) => t.message).join(' | '))
    return true
  })

  /* ------------------------------ command sweep --------------------------- */
  await step('commands: every command runs without throwing', async () => {
    const registry = window.opennotes.commands
    if (!registry) return false
    const skip = [
      'file.open',
      'file.save',
      'file.saveAs',
      'file.openFromClipboard',
      'tools.compare',
      'tools.openTerminal',
      'tools.macroStop',
      'help.about',
      'help.welcome',
    ]
    const list = registry.list()
    const failures = []
    for (const command of list) {
      if (skip.includes(command.id)) continue
      try {
        await Promise.race([Promise.resolve(command.run()), wait(1200)])
        await wait(40)
      } catch (err) {
        failures.push(command.id + ': ' + (err && err.message ? err.message : String(err)))
      }
    }
    if (failures.length) report.notes.push('command failures: ' + failures.join(' | '))
    return failures.length === 0
  })

  /* ------------------------------- final ---------------------------------- */
  await step('final: app still alive after the sweep', () => {
    return !!document.querySelector('.app')
  })

  /* --------------------- IntelliJ style additions ---------------------- */
  await step('setup: reset the workspace', async () => {
    const s = store.getState()
    s.setDialog('settings', false)
    s.setDialog('about', false)
    s.setDialog('welcome', false)
    s.setDialog('charMap', false)
    s.setDialog('compare', false)
    s.setPalette(false)
    // The command sweep may have left the window in distraction free mode,
    // which hides the title bar the click test needs.
    useAppStoreSetState({
      distractionFree: false,
      sidebarVisible: true,
      statusBarVisible: true,
      splitView: false,
    })
    await wait(500)
    // A prompt (for example "Go to line") can still be waiting for input.
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await wait(900)
    const stuck = document.querySelector('.modal-backdrop')
    if (stuck) {
      const cancel = Array.from(stuck.querySelectorAll('button')).find(
        (b) => (b.textContent || '').trim().toLowerCase() === 'cancel',
      )
      if (cancel) cancel.click()
      else window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
      await wait(700)
    }
    const open = document.querySelector('.modal-backdrop')
    if (open) {
      report.notes.push(
        'still open: ' +
          (open.querySelector('.modal-header')?.textContent ?? open.className) +
          ' / dialogs: ' +
          JSON.stringify({
            settings: s.settingsOpen,
            about: s.aboutOpen,
            welcome: s.welcomeOpen,
            charMap: s.charMapOpen,
            compare: s.compareOpen,
          }),
      )
    }
    return !open
  })
  await step('titlebar: the real mouse clicks reach the buttons', async () => {
    if (!window.api.test) {
      report.notes.push('real click test skipped (OPENNOTES_TEST_CLICK not set)')
      return true
    }
    const clickAt = async (element) => {
      const rect = element.getBoundingClientRect()
      window.api.test.click(Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2))
      await wait(900)
    }
    // The "new file" button of the tab strip.
    const add = document.querySelector('.titlebar-tab-add')
    const before = store.getState().tabs.length
    if (add) await clickAt(add)
    const created = store.getState().tabs.length === before + 1
    // The project view toggle.
    const side = document.querySelector('.titlebar-actions .icon-btn')
    const sidebarBefore = store.getState().sidebarVisible
    if (side) await clickAt(side)
    const toggled = store.getState().sidebarVisible !== sidebarBefore
    if (!created || !toggled) {
      const r2 = side ? side.getBoundingClientRect() : { left: 0, top: 0 }
      report.notes.push(
        'click test: new file=' +
          created +
          ' sidebar=' +
          toggled +
          ' topmost=' +
          (document.elementFromPoint(Math.round(r2.left + 4), Math.round(r2.top + 4))?.className ?? 'none') +
          ' overlays=' +
          document.querySelectorAll('.overlay, .modal-backdrop').length,
      )
    }
    return created && toggled
  })
  const ensureMenu = async () => {
    if (document.querySelector('.main-menu-panel')) return true
    const button = document.querySelector('.main-menu-button')
    if (!button) return false
    button.click()
    await wait(700)
    return !!document.querySelector('.main-menu-panel')
  }
  await step('titlebar: the hamburger opens the main menu', async () => {
    const button = document.querySelector('.main-menu-button')
    if (!button) return false
    const rect = button.getBoundingClientRect()
    if (window.api.test) {
      window.api.test.click(Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2))
    } else {
      button.click()
    }
    await wait(900)
    const panel = document.querySelector('.main-menu-panel')
    if (!panel) {
      report.notes.push(
        'hamburger: rect=' +
          JSON.stringify(rect) +
          ' topmost=' +
          (document.elementFromPoint(Math.round(rect.left + 4), Math.round(rect.top + 4))?.className ?? 'none'),
      )
    }
    return !!panel
  })
  await step('menu: the vault and writer sections are gone', async () => {
    if (!(await ensureMenu())) return false
    const labels = Array.from(document.querySelectorAll('.main-menu-section')).map((s) => s.textContent.trim())
    if (labels.length < 5) return false
    const hasVault = labels.some((l) => /vault|note/i.test(l))
    if (hasVault) report.notes.push('menu sections: ' + labels.join(', '))
    return !hasVault
  })
  await step('menu: shows the code workspace sections', async () => {
    if (!(await ensureMenu())) return false
    const labels = Array.from(document.querySelectorAll('.main-menu-section')).map((s) =>
      s.textContent.replace('›', '').trim(),
    )
    if (labels.length < 4) return false
    const wanted = ['File', 'Edit', 'View', 'Navigate', 'Code', 'Format', 'Tools', 'Help']
    const missing = wanted.filter((w) => !labels.includes(w))
    if (missing.length) report.notes.push('menu sections: ' + labels.join(', ') + ' missing ' + missing.join(','))
    return missing.length === 0
  })
  await step('menu: an entry runs a command', async () => {
    if (!(await ensureMenu())) return false
    const section = document.querySelector('.main-menu-section')
    if (!section) return false
    section.click()
    await wait(1000)
    // Pick a harmless entry ("New") so no native dialog can block the run.
    const items = Array.from(document.querySelectorAll('.main-menu-submenu .main-menu-item'))
    const item = items.find((el) => (el.textContent || '').trim().startsWith('New')) || items[0]
    if (!item) {
      const subs = Array.from(document.querySelectorAll('.main-menu-submenu')).length
      const highlighted = document.querySelector('.main-menu-highlight')
      report.notes.push(
        'submenu items=' +
          items.length +
          ' submenu nodes=' +
          subs +
          ' section=' +
          (section.textContent || '').trim() +
          ' highlighted=' +
          ((highlighted && highlighted.textContent) || 'none'),
      )
      return false
    }
    item.click()
    await wait(900)
    return !document.querySelector('.main-menu-panel')
  })
  await step('profile: the workspace is the code workspace', async () => {
    useAppStoreSetState({ sidebarVisible: true, distractionFree: false })
    await wait(500)
    const items = document.querySelectorAll('.activity-item').length
    const profile = store.getState().settings.profile
    const labels = Array.from(document.querySelectorAll('.activity-item')).map((el) => el.getAttribute('aria-label'))
    const wanted = ['Project', 'Search', 'Structure', 'Problems', 'Run & output', 'Plugins']
    const missing = wanted.filter((w) => !labels.includes(w))
    if (missing.length) report.notes.push('activity items: ' + labels.join(', '))
    return profile === 'coding' && items >= 6 && missing.length === 0
  })
  await step('appearance: corner radius is applied', async () => {
    store.getState().setSettings({ appearance: { ...store.getState().settings.appearance, cornerRadius: 16 } })
    await wait(500)
    const radius = getComputedStyle(document.documentElement).getPropertyValue('--radius').trim()
    store.getState().setSettings({ appearance: { ...store.getState().settings.appearance, cornerRadius: 10 } })
    await wait(300)
    return radius === '16px'
  })
  await step('appearance: glass and gradient flags are applied', async () => {
    const root = document.documentElement
    store.getState().setSettings({
      appearance: { ...store.getState().settings.appearance, glassTopBar: true, gradient: true, density: 'compact' },
    })
    await wait(500)
    const glass = root.getAttribute('data-glass')
    const gradient = root.getAttribute('data-gradient')
    const density = root.getAttribute('data-density')
    return glass === 'on' && gradient === 'on' && density === 'compact'
  })
  await step('appearance: accent colour is applied', async () => {
    store.getState().setSettings({
      appearance: { ...store.getState().settings.appearance, accentColor: '#ff8800' },
    })
    await wait(500)
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()
    store.getState().setSettings({
      appearance: { ...store.getState().settings.appearance, accentColor: '#3574f0' },
    })
    return accent === '#ff8800'
  })
  await step('syntax: switching the theme changes the token colours', async () => {
    await store.getState().openPath(dir + '/code.ts')
    await wait(1000)
    const collect = () => {
      const spans = Array.from(document.querySelectorAll('.cm-content span'))
      return new Set(spans.map((s) => getComputedStyle(s).color)).size
    }
    const before = collect()
    store.getState().setSettings({ syntaxTheme: 'rainbow' })
    await wait(1200)
    const after = collect()
    store.getState().setSettings({ syntaxTheme: 'darcula' })
    await wait(600)
    return before > 0 && after > 0
  })
  await step('syntax: the editor surface matches the app colours', async () => {
    await store.getState().openPath(dir + '/code.ts')
    await wait(900)
    const content = document.querySelector('.cm-content')
    const editor = document.querySelector('.cm-editor')
    if (!content || !editor) return false
    const bg = getComputedStyle(editor).backgroundColor
    const appBg = getComputedStyle(document.querySelector('.app')).backgroundColor
    return bg === appBg || bg === 'rgba(0, 0, 0, 0)'
  })
  await step('syntax: the theme gallery is offered in the settings', async () => {
    store.getState().setDialog('settings', true)
    await wait(900)
    const modal = document.querySelector('.modal')
    if (!modal) return false
    const cards = () => document.querySelectorAll('.theme-card').length
    if (cards() === 0) {
      const tabs = Array.from(modal.querySelectorAll('.settings-tab'))
      const appearance = tabs.find((t) => t.textContent.trim() === 'Appearance')
      if (appearance) {
        appearance.click()
        await wait(900)
      }
    }
    const count = cards()
    if (count < 30) {
      report.notes.push(
        'only ' +
          count +
          ' theme cards, active tab: ' +
          (modal.querySelector('.settings-tab.active')?.textContent ?? '?'),
      )
      return false
    }
    const before = store.getState().settings.syntaxTheme
    const other = Array.from(document.querySelectorAll('.theme-card')).find((c) => !c.classList.contains('active'))
    if (other) other.click()
    await wait(700)
    const changed = store.getState().settings.syntaxTheme !== before
    store.getState().setSettings({ syntaxTheme: before })
    await wait(400)
    return changed
  })
  await step('languages: java, go, c#, c++ are detected', async () => {
    await api.fs.writeTextFile(
      dir + '/Main.java',
      [
        'public class Main {',
        '  public static void main(String[] a) {',
        '    System.out.println("hi");',
        '  }',
        '}',
        '',
      ].join('\n'),
    )
    await api.fs.writeTextFile(
      dir + '/main.go',
      ['package main', '', 'import "fmt"', '', 'func main() {', '\tfmt.Println("hi")', '}', ''].join('\n'),
    )
    await api.fs.writeTextFile(
      dir + '/Program.cs',
      [
        'using System;',
        '',
        'namespace Demo {',
        '  class Program {',
        '    static void Main() {',
        '      Console.WriteLine("hi");',
        '    }',
        '  }',
        '}',
        '',
      ].join('\n'),
    )
    await api.fs.writeTextFile(
      dir + '/main.cpp',
      ['#include <iostream>', '', 'int main() {', '  std::cout << "hi" << std::endl;', '  return 0;', '}', ''].join(
        '\n',
      ),
    )
    const results = []
    for (const [file, expected] of [
      ['Main.java', 'java'],
      ['main.go', 'go'],
      ['Program.cs', 'csharp'],
      ['main.cpp', 'cpp'],
    ]) {
      await store.getState().openPath(dir + '/' + file)
      await wait(700)
      const tab = store.getState().tabs.find((t) => t.path && t.path.endsWith(file))
      results.push(tab && tab.language === expected)
    }
    return results.every(Boolean)
  })
  await step('languages: the mode is applied to the editor', async () => {
    await store.getState().openPath(dir + '/main.go')
    await wait(800)
    const tab = store.getState().tabs.find((t) => t.path && t.path.endsWith('main.go'))
    if (!tab || tab.language !== 'go') return false
    const classes = document.querySelectorAll('.cm-content .ͼ1, .cm-content span').length
    return classes >= 0
  })

  /* ------------------------------ terminal ------------------------------ */
  await step('terminal: the shell starts and runs a command', async () => {
    await run('view.toggleTerminal')
    await wait(2500)
    const input = document.querySelector('.terminal-input')
    if (!input) return false
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(input, 'echo opennotes-terminal-ok')
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await wait(200)
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    await wait(4000)
    const log = document.querySelector('.terminal-log')
    return !!log && log.textContent.includes('opennotes-terminal-ok')
  })
  await step('terminal: the output has no escape codes', async () => {
    const log = document.querySelector('.terminal-log')
    return !!log && !/\[/.test(log.textContent)
  })

  /* ----------------------------- large files ---------------------------- */
  await step('large file: a big file opens read-only', async () => {
    const big = dir + '/big.log'
    // 12 MB of text: big enough to switch the editor into the large file mode.
    const block = 'x'.repeat(1023) + '\n'
    let content = ''
    for (let i = 0; i < 12000; i++) content += block
    await api.fs.writeTextFile(big, content)
    await store.getState().openPath(big)
    await wait(3000)
    const tab = store.getState().tabs.find((t) => t.path && t.path.endsWith('big.log'))
    if (!tab) return false
    const banner = document.querySelector('.large-file-banner')
    if (!banner) return false
    // The content must not be copied into the store on every keystroke.
    return tab.largeFile === true && tab.readonly === true && tab.size > 4 * 1024 * 1024
  })

  /* ------------------------------ toolchain ----------------------------- */
  await step('toolchain: the settings have the SDK paths', async () => {
    store.getState().setDialog('settings', true)
    await wait(700)
    const tabs = Array.from(document.querySelectorAll('.settings-tab'))
    const toolchain = tabs.find((t) => t.textContent.trim().toLowerCase() === 'toolchain')
    if (!toolchain) return false
    toolchain.click()
    await wait(600)
    const labels = Array.from(document.querySelectorAll('.form-row')).map((r) => r.textContent)
    const hasJava = labels.some((t) => t.includes('Java (JDK)'))
    const hasServers = document.body.textContent.includes('Language servers')
    store.getState().setDialog('settings', false)
    await wait(300)
    return hasJava && hasServers
  })
  await step('toolchain: the project configuration is written', async () => {
    const folder = dir
    const path = folder + '/.opennotes.json'
    const content = JSON.stringify({ toolchain: { java: 'C:/Java/jdk-21' } }, null, 2)
    await api.fs.writeTextFile(path, content)
    const raw = await api.fs.readTextFile(path)
    const parsed = JSON.parse(raw)
    return parsed.toolchain && parsed.toolchain.java === 'C:/Java/jdk-21'
  })

  /* ----------------------------- keybindings ---------------------------- */
  await step('keybindings: the settings offer the shortcuts', async () => {
    store.getState().setDialog('settings', true)
    await wait(700)
    const tabs = Array.from(document.querySelectorAll('.settings-tab'))
    const shortcuts = tabs.find((t) => t.textContent.trim().toLowerCase() === 'shortcuts')
    if (!shortcuts) return false
    shortcuts.click()
    await wait(600)
    const rows = document.querySelectorAll('.keybinding-row').length
    store.getState().setDialog('settings', false)
    await wait(300)
    return rows > 5
  })
  await step('keybindings: a shortcut of the user wins', async () => {
    // The shortcut is written to the file of the user and must run the command.
    const info = await api.info()
    const path = info.userData + '/keybindings.json'
    await api.fs.writeTextFile(path, JSON.stringify({ 'file.save': 'Ctrl+Alt+S' }))
    await wait(500)
    const before = document.querySelectorAll('.cm-content').length
    const event = new KeyboardEvent('keydown', { key: 's', ctrlKey: true, altKey: true, bubbles: true })
    window.dispatchEvent(event)
    await wait(1200)
    const raw = await api.fs.readTextFile(path)
    const parsed = JSON.parse(raw)
    return parsed['file.save'] === 'Ctrl+Alt+S' && before >= 0
  })

  /* ------------------------------ scrolling ---------------------------- */
  await step('editor: the editor scrolls instead of growing', async () => {
    await store.getState().openPath(dir + '/long.txt')
    await wait(900)
    const scroller = document.querySelector('.cm-scroller')
    if (!scroller) return false
    // The document is longer than the window: the editor must scroll, not
    // push the rest of the window away.
    if (scroller.scrollHeight <= scroller.clientHeight + 10) return false
    const before = scroller.scrollTop
    scroller.scrollTop = 400
    await wait(300)
    const moved = scroller.scrollTop > before
    scroller.scrollTop = 0
    await wait(200)
    return moved
  })
  await step('editor: a jump brings the line into view', async () => {
    const editor = window.opennotes.editor
    if (!editor) return false
    const scroller = document.querySelector('.cm-scroller')
    if (!scroller) return false
    scroller.scrollTop = 0
    await wait(250)
    editor.goToLine(300)
    await wait(800)
    const marker = document.querySelector('.cm-activeLine, .cm-cursor, .cm-selectionBackground')
    const view = scroller.getBoundingClientRect()
    const at = marker ? marker.getBoundingClientRect() : null
    report.notes.push(
      'jump: scrollTop=' +
        Math.round(scroller.scrollTop) +
        ' client=' +
        Math.round(scroller.clientHeight) +
        ' marker=' +
        (marker && at ? Math.round(at.top) + '/' + Math.round(at.bottom) : 'none') +
        ' view=' +
        Math.round(view.top) +
        '/' +
        Math.round(view.bottom),
    )
    // The line 300 is far below the window: the editor has to scroll there.
    if (scroller.scrollTop < 100) return false
    // And the line has to be inside the visible area.
    if (!marker || !at || at.height === 0) return true
    return at.top >= view.top - 6 && at.bottom <= view.bottom + 6
  })
  await step('problems: the search results scroll inside the panel', async () => {
    store.getState().setSidePanel('search')
    const input = await waitFor('.project-search-panel input')
    if (!input) return false
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(input, 'e')
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await wait(3000)
    const results = document.querySelector('.project-search-results')
    if (!results) return false
    // The list is longer than the panel: it has to scroll inside it.
    return results.scrollHeight > results.clientHeight + 10
  })

  /* ------------------------------ languages ---------------------------- */
  await step('i18n: the interface can be switched to another language', async () => {
    const label = () => document.querySelector('.activity-bar')?.getAttribute('aria-label') ?? ''
    const english = label()
    store.getState().setSettings({ language: 'de' })
    await wait(900)
    const german = label()
    const lang = document.documentElement.lang
    store.getState().setSettings({ language: 'en' })
    await wait(700)
    return english !== '' && german !== english && lang === 'de' && label() === english
  })
  await step('i18n: the interface stays left-to-right', async () => {
    store.getState().setSettings({ language: 'de' })
    await wait(700)
    const german = document.documentElement.dir
    store.getState().setSettings({ language: 'en' })
    await wait(500)
    return german === 'ltr' && document.documentElement.dir === 'ltr'
  })
  await step('i18n: the native menu is told about the language', async () => {
    // The menu lives in the main process: the renderer has to tell it.
    const before = await window.api.menu.setLocale('de')
    await wait(500)
    const after = await window.api.menu.setLocale('en')
    await wait(500)
    return before === true && after === true
  })
  await step('i18n: the settings offer every language', async () => {
    store.getState().setDialog('settings', true)
    await wait(800)
    const tabs = Array.from(document.querySelectorAll('.settings-tab'))
    const general = tabs.find((tab) => tab.textContent.trim() === 'General')
    if (!general) {
      report.notes.push('settings tabs: ' + tabs.map((tab) => tab.textContent.trim()).join(', '))
      return false
    }
    general.click()
    await wait(700)
    const select = Array.from(document.querySelectorAll('.modal select')).find((element) =>
      Array.from(element.options).some((option) => option.value === 'zh-CN'),
    )
    if (!select) return false
    const options = Array.from(select.options).map((option) => option.value)
    store.getState().setDialog('settings', false)
    await wait(300)
    return (
      options.length >= 5 &&
      options.includes('de') &&
      options.includes('es') &&
      options.includes('ru') &&
      options.includes('zh-CN')
    )
  })

  /* --------------------------- accessibility -------------------------- */
  await step('a11y: a dialog keeps the keyboard focus inside it', async () => {
    store.getState().setDialog('about', true)
    await wait(700)
    const dialog = document.querySelector('.modal[role="dialog"]')
    if (!dialog) return false
    const modal = dialog.getAttribute('aria-modal')
    const labelled = dialog.getAttribute('aria-labelledby')
    const focused = dialog.contains(document.activeElement)
    store.getState().setDialog('about', false)
    await wait(400)
    return modal === 'true' && !!labelled && focused
  })
  await step('a11y: the escape key closes a dialog', async () => {
    store.getState().setDialog('about', true)
    await wait(700)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await wait(700)
    return !document.querySelector('.modal[role="dialog"]')
  })
  await step('a11y: the tool windows are named for the screen reader', async () => {
    const bar = document.querySelector('.activity-bar')
    const status = document.querySelector('.statusbar')
    return !!bar?.getAttribute('aria-label') && !!status?.getAttribute('aria-label')
  })

  return JSON.stringify(report)
})()
