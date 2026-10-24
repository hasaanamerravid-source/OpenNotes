import { app, ipcMain, dialog, shell, BrowserWindow } from 'electron'
import fs from 'node:fs/promises'
import fsSync from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import iconv from 'iconv-lite'
import type {
  DirEntry,
  DialogResult,
  Eol,
  FileKind,
  FilePayload,
  OpenDialogOptions,
  SaveDialogOptions,
} from '@shared/types'

const IGNORED = new Set(['node_modules', '.git', '.svn', '.hg', 'dist', 'out', '.cache', '.next', 'target'])

/**
 * Byte order marks for encodings that need them. Without a BOM a UTF-16 file is
 * indistinguishable from binary data, so the reader would refuse to open it.
 */
const BOM: Record<string, string> = {
  'utf8-bom': '\xEF\xBB\xBF',
  'utf16-le': '\xFF\xFE',
  'utf16-be': '\xFE\xFF',
}

/** Detect the dominant line ending of a text buffer. */
export function detectEol(text: string): Eol {
  let crlf = 0
  let lf = 0
  let cr = 0
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (c === '\r') {
      if (text[i + 1] === '\n') {
        crlf++
        i++
      } else {
        cr++
      }
    } else if (c === '\n') {
      lf++
    }
  }
  if (crlf === 0 && lf === 0 && cr === 0) return '\n'
  if (crlf >= lf && crlf >= cr) return '\r\n'
  if (cr >= lf) return '\r'
  return '\n'
}

/** Normalise every line ending to \n for in-editor handling. */
export function normalizeEol(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
}

/** Apply a line ending style to \n-normalised text. */
export function applyEol(text: string, eol: Eol): string {
  if (eol === '\n') return text
  if (eol === '\r') return text.replace(/\n/g, '\r')
  return text.replace(/\n/g, '\r\n')
}

function detectBom(buf: Buffer): { encoding: string; skip: number } {
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    return { encoding: 'utf8', skip: 3 }
  }
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
    return { encoding: 'utf16-le', skip: 2 }
  }
  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) {
    return { encoding: 'utf16-be', skip: 2 }
  }
  return { encoding: 'utf8', skip: 0 }
}

export function isProbablyBinary(buf: Buffer): boolean {
  const len = Math.min(buf.length, 8000)
  for (let i = 0; i < len; i++) {
    if (buf[i] === 0) return true
  }
  return false
}

/**
 * Decode a buffer into text. The encoding comes from the byte order mark, a
 * file without one is UTF-8. Binary files are reported as such.
 */
export function decodeText(buffer: Buffer): { text: string; encoding: string; binary: boolean } {
  const { encoding, skip } = detectBom(buffer)
  // UTF-16 files are full of NUL bytes but are perfectly readable text.
  const utf16 = encoding === 'utf16-le' || encoding === 'utf16-be'
  if (!utf16 && isProbablyBinary(buffer)) {
    return { text: '', encoding: 'binary', binary: true }
  }
  return { text: iconv.decode(buffer.subarray(skip), encoding), encoding, binary: false }
}

/**
 * Encode a text back into bytes (the byte order mark of the encoding is
 * added, so that the file keeps its format).
 */
export function encodeText(text: string, encoding: string): Buffer {
  const bom = BOM[encoding]
  const body = iconv.encode(text, encoding || 'utf8')
  return bom ? Buffer.concat([Buffer.from(bom, 'binary'), body]) : body
}

/** Guess a semantic file kind from the path + content. */
export function detectKind(filePath: string, text: string): FileKind {
  const ext = path.extname(filePath).toLowerCase()
  if (['.html', '.htm', '.xhtml'].includes(ext)) return 'html'
  if (['.md', '.markdown', '.mdx', '.mdown'].includes(ext)) return 'markdown'
  if (['.csv', '.tsv'].includes(ext)) return 'csv'
  if (text.trimStart().startsWith('<')) return 'html'
  return 'text'
}

function toEntry(p: string, stats: fsSync.Stats): DirEntry {
  return {
    name: path.basename(p),
    path: p,
    isDir: stats.isDirectory(),
    size: stats.size,
    mtime: stats.mtimeMs,
  }
}

function focusedWindow(): BrowserWindow | null {
  return BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? null
}

const watchers = new Map<string, fsSync.FSWatcher>()

export function registerFsHandlers(): void {
  ipcMain.handle('fs:openDialog', async (_e, opts: OpenDialogOptions): Promise<DialogResult> => {
    const win = focusedWindow()
    const props: Electron.OpenDialogOptions['properties'] = opts?.directory
      ? ['openDirectory', 'createDirectory']
      : opts?.multiSelections
        ? ['openFile', 'multiSelections', 'createDirectory']
        : ['openFile', 'createDirectory']
    const result = win
      ? await dialog.showOpenDialog(win, {
          title: opts?.title,
          defaultPath: opts?.defaultPath,
          filters: opts?.filters,
          properties: props,
        })
      : await dialog.showOpenDialog({
          title: opts?.title,
          defaultPath: opts?.defaultPath,
          filters: opts?.filters,
          properties: props,
        })
    return { canceled: result.canceled, filePaths: result.filePaths, filePath: result.filePaths[0] ?? null }
  })

  ipcMain.handle('fs:saveDialog', async (_e, opts: SaveDialogOptions): Promise<DialogResult> => {
    const win = focusedWindow()
    const result = win
      ? await dialog.showSaveDialog(win, { title: opts?.title, defaultPath: opts?.defaultPath, filters: opts?.filters })
      : await dialog.showSaveDialog({ title: opts?.title, defaultPath: opts?.defaultPath, filters: opts?.filters })
    return {
      canceled: result.canceled,
      filePaths: result.filePath ? [result.filePath] : [],
      filePath: result.filePath ?? null,
    }
  })

  /**
   * Files bigger than this are not read completely: the editor shows a prefix
   * of them instead of trying to hold hundreds of megabytes.
   */
  const MAX_EDIT_BYTES = 24 * 1024 * 1024

  ipcMain.handle('fs:readFile', async (_e, filePath: string): Promise<FilePayload> => {
    let handle: fs.FileHandle | null = null
    let size = 0
    let buffer: Buffer
    try {
      handle = await fs.open(filePath, 'r')
      const stats = await handle.stat()
      size = stats.size
      const limit = Math.min(size, MAX_EDIT_BYTES)
      buffer = Buffer.alloc(limit)
      if (limit > 0) await handle.read(buffer, 0, limit, 0)
    } catch {
      return {
        path: filePath,
        content: '',
        encoding: 'utf8',
        eol: '\n',
        binary: false,
        kind: 'text',
        size: 0,
        truncated: false,
      }
    } finally {
      await handle?.close()
    }

    const { encoding, skip } = detectBom(buffer)
    // UTF-16 files are full of NUL bytes but are perfectly readable text.
    const utf16 = encoding === 'utf16-le' || encoding === 'utf16-be'
    if (!utf16 && isProbablyBinary(buffer)) {
      return {
        path: filePath,
        content: '',
        encoding: 'binary',
        eol: '\n',
        binary: true,
        kind: 'binary',
        size,
        truncated: false,
      }
    }
    const body = buffer.subarray(skip)
    const decoded = iconv.decode(body, encoding)
    return {
      path: filePath,
      content: normalizeEol(decoded),
      encoding,
      eol: detectEol(decoded),
      binary: false,
      kind: detectKind(filePath, decoded),
      size,
      truncated: size > MAX_EDIT_BYTES,
    }
  })

  ipcMain.handle('fs:writeFile', async (_e, filePath: string, content: string, encoding: string, eol: Eol) => {
    const payload = applyEol(normalizeEol(content), eol ?? '\n')
    const bom = BOM[encoding]
    const body = iconv.encode(payload, encoding || 'utf8')
    const buf = bom ? Buffer.concat([Buffer.from(bom, 'binary'), body]) : body
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, buf)
  })

  ipcMain.handle('fs:readDir', async (_e, dir: string): Promise<DirEntry[]> => {
    let names: string[]
    try {
      names = await fs.readdir(dir)
    } catch {
      return []
    }
    const entries: DirEntry[] = []
    for (const name of names) {
      const p = path.join(dir, name)
      try {
        entries.push(toEntry(p, await fs.stat(p)))
      } catch {
        /* ignore unreadable entries */
      }
    }
    entries.sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
    })
    return entries
  })

  ipcMain.handle('fs:listRecursive', async (_e, root: string, maxDepth = 12): Promise<DirEntry[]> => {
    const out: DirEntry[] = []
    const walk = async (dir: string, depth: number): Promise<void> => {
      if (depth > maxDepth) return
      let names: string[]
      try {
        names = await fs.readdir(dir)
      } catch {
        return
      }
      for (const name of names) {
        if (IGNORED.has(name) || name.startsWith('.')) continue
        const p = path.join(dir, name)
        let stats: fsSync.Stats
        try {
          stats = await fs.stat(p)
        } catch {
          continue
        }
        out.push(toEntry(p, stats))
        if (stats.isDirectory()) await walk(p, depth + 1)
      }
    }
    await walk(root, 0)
    return out
  })

  ipcMain.handle('fs:stat', async (_e, p: string): Promise<DirEntry | null> => {
    try {
      return toEntry(p, await fs.stat(p))
    } catch {
      return null
    }
  })

  ipcMain.handle('fs:exists', async (_e, p: string): Promise<boolean> => {
    try {
      await fs.access(p)
      return true
    } catch {
      return false
    }
  })

  ipcMain.handle('fs:makeDir', async (_e, p: string) => {
    await fs.mkdir(p, { recursive: true })
  })

  ipcMain.handle('fs:remove', async (_e, p: string) => {
    await fs.rm(p, { recursive: true, force: true })
  })

  ipcMain.handle('fs:rename', async (_e, from: string, to: string) => {
    await fs.rename(from, to)
  })

  ipcMain.handle('fs:copyFile', async (_e, from: string, to: string) => {
    await fs.copyFile(from, to)
  })

  ipcMain.handle('fs:showInFolder', async (_e, p: string) => {
    shell.showItemInFolder(p)
  })

  ipcMain.handle('fs:readTextFile', async (_e, p: string): Promise<string> => fs.readFile(p, 'utf8'))

  ipcMain.handle('fs:writeTextFile', async (_e, p: string, text: string) => {
    await fs.mkdir(path.dirname(p), { recursive: true })
    await fs.writeFile(p, text, 'utf8')
  })

  ipcMain.handle('fs:watch', async (event, p: string) => {
    try {
      const watcher = fsSync.watch(p, () => {
        if (!event.sender.isDestroyed()) event.sender.send('fs:changed', p)
      })
      // A watcher can fail later (deleted file, network drive, too many
      // handles). Without a listener the 'error' event would take the whole
      // application down.
      watcher.on('error', (error: NodeJS.ErrnoException) => {
        console.warn('[opennotes] watcher stopped:', p, error?.message ?? error)
        watcher.close()
        watchers.delete(p)
      })
      watchers.set(p, watcher)
    } catch (error) {
      console.warn('[opennotes] cannot watch', p, error)
    }
    return true
  })

  ipcMain.handle('fs:unwatch', async (_e, p: string) => {
    const watcher = watchers.get(p)
    if (watcher) {
      try {
        watcher.close()
      } catch {
        /* already closed */
      }
    }
    watchers.delete(p)
  })

  ipcMain.handle('app:info', async () => ({
    version: app.getVersion(),
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
    platform: process.platform,
    home: os.homedir(),
    temp: os.tmpdir(),
    userData: app.getPath('userData'),
  }))
}
