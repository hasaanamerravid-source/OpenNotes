import { app, clipboard, ipcMain } from 'electron'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { createAppWindow } from '../window'

/** Run a file with the interpreter that matches its extension. */
function runFile(filePath: string): string | null {
  const ext = path.extname(filePath).toLowerCase()
  const commands: Record<string, { cmd: string; args: string[] }> = {
    '.py': { cmd: 'python', args: [filePath] },
    '.js': { cmd: 'node', args: [filePath] },
    '.mjs': { cmd: 'node', args: [filePath] },
    '.cjs': { cmd: 'node', args: [filePath] },
    '.ts': { cmd: 'npx', args: ['tsx', filePath] },
    '.rb': { cmd: 'ruby', args: [filePath] },
    '.pl': { cmd: 'perl', args: [filePath] },
    '.lua': { cmd: 'lua', args: [filePath] },
    '.ps1': { cmd: 'powershell', args: ['-ExecutionPolicy', 'Bypass', '-File', filePath] },
    '.bat': { cmd: 'cmd', args: ['/c', filePath] },
    '.cmd': { cmd: 'cmd', args: ['/c', filePath] },
    '.sh': { cmd: 'bash', args: [filePath] },
  }
  const entry = commands[ext]
  if (!entry) return null
  const child = spawn(entry.cmd, entry.args, { cwd: path.dirname(filePath), detached: false, shell: false })
  child.on('error', (err) => console.error('[run]', err.message))
  return `${entry.cmd} ${entry.args.join(' ')}`
}

export function registerShellHandlers(): void {
  ipcMain.handle('clipboard:readText', () => clipboard.readText())
  ipcMain.handle('clipboard:writeText', (_e, text: string) => {
    clipboard.writeText(text)
    return true
  })

  ipcMain.handle('win:newWindow', () => {
    createAppWindow()
    return true
  })

  ipcMain.handle('shell:openTerminal', (_e, cwd?: string) => {
    const dir = cwd ?? app.getPath('home')
    if (process.platform === 'win32') {
      spawn('cmd.exe', ['/k', 'cd', '/d', dir], { detached: true, stdio: 'ignore' }).unref()
    } else {
      spawn(process.platform === 'darwin' ? 'open' : 'x-terminal-emulator', ['-e', `cd ${dir}`], {
        detached: true,
        stdio: 'ignore',
      }).unref()
    }
    return true
  })

  ipcMain.handle('shell:run', (_e, filePath: string) => {
    const command = runFile(filePath)
    if (!command) return null
    return command
  })
}
