/* eslint-disable */
/**
 * Stress harness: large files, many tabs, odd content. The app must survive.
 * Injected with OPENNOTES_EVAL_FILE.
 */
;(async () => {
  const report = { ok: [], failed: [], notes: [] }
  const api = window.api
  const store = window.opennotes.store
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))
  const dir = 'I:/notepad/.stress'

  const step = async (name, fn) => {
    try {
      const result = await fn()
      if (result === false) report.failed.push(name + ' :: returned false')
      else report.ok.push(name)
      return result
    } catch (err) {
      report.failed.push(name + ' :: ' + (err && err.message ? err.message : String(err)))
      return null
    }
  }

  await step('fixture: 8 MB text file', async () => {
    const line = 'The quick brown fox jumps over the lazy dog. 0123456789\n'
    let chunk = ''
    while (chunk.length < 1024 * 1024) chunk += line
    await api.fs.writeTextFile(dir + '/big.txt', chunk.repeat(8))
    return true
  })
  await step('fixture: 50k line source file', async () => {
    const lines = []
    for (let i = 0; i < 50000; i++) lines.push(`export const value${i} = ${i}`)
    await api.fs.writeTextFile(dir + '/many.ts', lines.join('\n'))
    return true
  })
  await step('fixture: 2 MB markdown file', async () => {
    const chunk = '# Title\n\nSome **markdown** with `code` and [[Links]].\n\n'
    await api.fs.writeTextFile(dir + '/big.md', chunk.repeat(30000))
    return true
  })
  await step('fixture: binary file', async () => {
    const bytes = new Uint8Array(4096)
    for (let i = 0; i < bytes.length; i++) bytes[i] = i % 256
    await api.fs.writeTextFile(
      dir + '/binary.bin',
      Array.from(bytes)
        .map((b) => String.fromCharCode(b))
        .join(''),
    )
    return true
  })

  await step('open: 8 MB text file', async () => {
    const started = Date.now()
    await store.getState().openPath(dir + '/big.txt')
    await wait(2500)
    const tab = store.getState().tabs.find((t) => t.path && t.path.endsWith('big.txt'))
    report.notes.push('8 MB file took ' + (Date.now() - started) + 'ms, length=' + (tab ? tab.content.length : 0))
    return !!tab
  })
  await step('open: 50k line file', async () => {
    const started = Date.now()
    await store.getState().openPath(dir + '/many.ts')
    await wait(2500)
    const tab = store.getState().tabs.find((t) => t.path && t.path.endsWith('many.ts'))
    report.notes.push('50k line file took ' + (Date.now() - started) + 'ms')
    return !!tab && tab.content.length > 100000
  })
  await step('open: 2 MB markdown with preview', async () => {
    await store.getState().openPath(dir + '/big.md')
    await wait(2000)
    const tab = store.getState().tabs.find((t) => t.path && t.path.endsWith('big.md'))
    if (!tab) return false
    store.getState().updateTab(tab.id, { view: 'split' })
    await wait(2500)
    const preview = document.querySelector('.markdown-preview')
    report.notes.push('preview length=' + (preview ? preview.innerHTML.length : 0))
    return !!preview && preview.innerHTML.length < 2000000
  })
  await step('open: binary file is rejected gracefully', async () => {
    await store.getState().openPath(dir + '/binary.bin')
    await wait(1200)
    const toasts = store.getState().toasts
    return toasts.some((t) => /binary/i.test(t.message))
  })
  await step('open: 20 tabs in a row', async () => {
    for (let i = 0; i < 20; i++) {
      await store.getState().openPath(dir + '/big.txt')
      await wait(120)
    }
    await wait(1500)
    return store.getState().tabs.length >= 2
  })
  await step('switch between tabs quickly', async () => {
    const tabs = store.getState().tabs
    for (let round = 0; round < 3; round++) {
      for (const tab of tabs) {
        store.getState().setActiveTab(tab.id)
        await wait(40)
      }
    }
    await wait(800)
    return !!document.querySelector('.cm-content')
  })
  await step('save a huge file', async () => {
    const tab = store.getState().tabs.find((t) => t.path && t.path.endsWith('big.txt'))
    if (!tab) return false
    const started = Date.now()
    const ok = await store.getState().saveTab(tab.id)
    report.notes.push('saving 8 MB took ' + (Date.now() - started) + 'ms')
    return ok
  })
  await step('session survives many tabs', async () => {
    await store.getState().persistSession()
    await wait(500)
    return true
  })
  await step('app is still responsive', async () => {
    const started = Date.now()
    await wait(200)
    return Date.now() - started < 1000
  })

  return JSON.stringify(report)
})()
