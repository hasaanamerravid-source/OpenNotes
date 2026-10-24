/**
 * Terminal service: a persistent shell that the user can type into.
 *
 * The renderer never spawns anything itself. It asks the main process to
 * start a shell (`terminal:start`), sends the commands it types
 * (`terminal:write`), interrupts them (`terminal:interrupt`) and listens for
 * the output (`terminal:output`).
 *
 * The shell is *piped*, not a real terminal: there is no pty on Windows and
 * node-pty is not installed. That has a few consequences, and they are worth
 * knowing before the code is read:
 *
 * - The shell does not know how big the window is, so `terminal:resize` is a
 *   no-op and full screen programs (vim, less, top) do not work in here.
 * - A real Ctrl+C cannot travel over a pipe (the shell would read the byte
 *   as the start of a command). The interrupt therefore kills the process
 *   tree of the shell - the running command dies, the shell stays alive.
 * - Programs that read from stdin (`cat`, `sort` without a file, ...) take
 *   the input of the terminal away from the user.
 * - The escape sequences are removed, so the panel shows plain text only.
 *
 * Expected preload shape (the preload owner adds this binding):
 *
 *   terminal: {
 *     start(cwd?: string): Promise<unknown>
 *     write(text: string): Promise<unknown>
 *     interrupt(): Promise<unknown>
 *     stop(): Promise<unknown>
 *     resize(cols: number, rows: number): Promise<unknown>
 *     onOutput(cb: (event: TerminalEvent) => void): () => void
 *   }
 */

import { BrowserWindow, ipcMain } from 'electron'
import { execFile, spawn, type ChildProcess } from 'node:child_process'
import { existsSync, statSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

/* --------------------------------- types -------------------------------- */

/** The events the main process sends to the renderer. */
export interface TerminalEvent {
  type: 'stdout' | 'stderr' | 'exit' | 'error'
  text?: string
  code?: number
}

/** The request of `terminal:start` (a plain path is accepted as well). */
export interface TerminalStartRequest {
  cwd?: string
}

/** The answer of `terminal:start`. */
export interface TerminalStartResult {
  ok: boolean
  /** The folder the shell really runs in. */
  cwd: string
  /** The kind of the shell that was started. */
  shell: string
  error?: string
}

/* -------------------------------- the shell ------------------------------ */

type ShellKind = 'powershell' | 'cmd' | 'bash'

interface ShellSpec {
  kind: ShellKind
  cmd: string
  args: string[]
  /** Prints the token that tells us that the command is done. */
  marker: (token: string) => string
  /** The line that is written when the user presses Ctrl+C. */
  interrupt: string
  /** The line ending the shell expects. */
  eol: string
}

/** Look for an executable on the PATH (and in the Windows system folders). */
function findExecutable(name: string): string | null {
  const dirs = (process.env.PATH ?? '').split(path.delimiter).filter(Boolean)
  for (const dir of dirs) {
    const candidate = path.join(dir, name)
    try {
      if (existsSync(candidate)) return candidate
    } catch {
      /* an unreadable PATH entry is skipped */
    }
  }
  return null
}

/** The PowerShell of the system (the newer pwsh is used as a second choice). */
function findPowerShell(): string | null {
  if (process.platform === 'win32') {
    const systemRoot = process.env.SystemRoot
    if (systemRoot) {
      const classic = path.join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
      try {
        if (existsSync(classic)) return classic
      } catch {
        /* the folder cannot be read, the PATH is used instead */
      }
    }
    return findExecutable('powershell.exe') ?? findExecutable('pwsh.exe')
  }
  return findExecutable('pwsh')
}

/**
 * Pick the shell of the platform.
 *
 * PowerShell is the first choice on Windows: `powershell.exe -Command -`
 * reads the commands from stdin, one line at a time, and stays alive.
 */
function pickShell(): ShellSpec {
  if (process.platform === 'win32') {
    const powershell = findPowerShell()
    if (powershell) {
      return {
        kind: 'powershell',
        cmd: powershell,
        // -NonInteractive keeps PowerShell from asking the user a question.
        args: ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', '-'],
        marker: (token) => `Write-Output "${token}"`,
        // The ETX byte inside a comment: the shell ignores the whole line.
        interrupt: '#\u0003\n',
        eol: '\n',
      }
    }
    return {
      kind: 'cmd',
      cmd: 'cmd.exe',
      // /Q hides the command, /K keeps the shell alive. The prompt is given a
      // name of its own, so that it can be told apart from the output.
      args: ['/Q', '/K', `PROMPT ${CMD_PROMPT_PREFIX}`],
      marker: (token) => `echo ${token}`,
      interrupt: 'rem \u0003\r\n',
      eol: '\r\n',
    }
  }
  const bash = findExecutable('bash')
  return {
    kind: 'bash',
    cmd: bash ?? '/bin/sh',
    args: bash ? ['--norc', '--noprofile'] : [],
    marker: (token) => `echo ${token}`,
    interrupt: '#\u0003\n',
    eol: '\n',
  }
}

/* -------------------------------- cleaning ------------------------------- */

/** The escape sequences of the terminal (colours, cursor moves, ...). */
const ANSI_PATTERN = /\u001B\][\s\S]*?(?:\u0007|\u001B\\)|\u001B\[[0-?]*[ -/]*[@-~]|\u001B[@-Z\\-_]/g

/** The control characters that would confuse the panel (tab and newline stay). */
const CONTROL_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g

/**
 * The prompt of the cmd.exe fallback.
 *
 * cmd.exe writes its prompt in front of the output of the command (on the
 * same line), so the prompt needs a name that cannot be mistaken for the
 * output of a command.
 */
const CMD_PROMPT_PREFIX = '__OPENNOTES_PROMPT__'

/** The size of the buffer of a line that never ends (the output is streamed). */
const MAX_PENDING = 64 * 1024

/**
 * Remove the escape sequences and the control characters.
 *
 * A lone carriage return is dropped as well: it is used to overwrite a line
 * (progress bars) and the panel cannot repeat that.
 */
function cleanText(text: string): string {
  return text.replace(ANSI_PATTERN, '').replace(/\r\n/g, '\n').replace(/\r/g, '').replace(CONTROL_PATTERN, '')
}

/* ------------------------------ the terminal ----------------------------- */

interface ActiveTerminal {
  token: number
  child: ChildProcess
  win: BrowserWindow | null
  spec: ShellSpec
  /** The token that marks the end of a command. */
  marker: string
  /** True while a command is running. */
  busy: boolean
  /** The part of the output that is not a complete line yet. */
  pendingOut: string
  pendingErr: string
}

let current: ActiveTerminal | null = null
let tokenSeq = 0

/** Send an event to the renderer (the window may be gone already). */
function send(win: BrowserWindow | null, event: TerminalEvent): void {
  if (!win || win.isDestroyed()) return
  try {
    win.webContents.send('terminal:output', event)
  } catch {
    /* the window went away, the shell is stopped anyway */
  }
}

/**
 * Send a piece of output to the renderer.
 *
 * The marker line (the end of a command) and the prompt of cmd.exe are
 * removed here - the panel draws its own prompt. The empty line that follows
 * the marker tells the renderer that the shell is ready again.
 */
function sendOutput(terminal: ActiveTerminal, type: 'stdout' | 'stderr', text: string): void {
  if (!text) return
  const isCmd = terminal.spec.kind === 'cmd'
  const lines: string[] = []
  const hadPrompt: boolean[] = []
  for (const part of text.split('\n')) {
    const line = part.replace(/\r/g, '')
    if (isCmd && line.startsWith(CMD_PROMPT_PREFIX)) {
      lines.push(line.slice(CMD_PROMPT_PREFIX.length))
      hadPrompt.push(true)
      continue
    }
    lines.push(line)
    hadPrompt.push(false)
  }

  const kept: string[] = []
  let ready = false
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    if (line.trim() === terminal.marker) {
      // The command is done.
      terminal.busy = false
      ready = true
      continue
    }
    if (isCmd && line === '') {
      // cmd.exe writes a line of its own after every command.
      const next = index + 1
      if (next >= lines.length || hadPrompt[next]) continue
    }
    kept.push(line)
  }
  if (ready) send(terminal.win, { type: 'stdout', text: '' })
  const out = kept.join('\n')
  if (!out) return
  send(terminal.win, { type, text: out })
}

/** Take a piece of output apart and send the complete lines. */
function handleChunk(terminal: ActiveTerminal, type: 'stdout' | 'stderr', chunk: string): void {
  const clean = cleanText(chunk)
  const pending = type === 'stdout' ? terminal.pendingOut : terminal.pendingErr
  const combined = pending + clean
  const lastBreak = combined.lastIndexOf('\n')
  if (lastBreak < 0) {
    if (combined.length > MAX_PENDING) {
      // A line that never ends: it is sent as it is, so that the buffer of
      // the main process cannot grow without a limit.
      sendOutput(terminal, type, combined + '\n')
      if (type === 'stdout') terminal.pendingOut = ''
      else terminal.pendingErr = ''
      return
    }
    if (type === 'stdout') terminal.pendingOut = combined
    else terminal.pendingErr = combined
    return
  }
  const rest = combined.slice(lastBreak + 1)
  if (type === 'stdout') terminal.pendingOut = rest
  else terminal.pendingErr = rest
  sendOutput(terminal, type, combined.slice(0, lastBreak + 1))
}

/** Write a text to the shell. */
function writeToShell(terminal: ActiveTerminal, text: string): void {
  const stdin = terminal.child.stdin
  if (!stdin || stdin.destroyed || stdin.writableEnded) return
  try {
    stdin.write(text)
  } catch {
    /* the shell is gone */
  }
}

/**
 * Send a command to the shell.
 *
 * The marker follows the command: the shell runs the commands of its stdin
 * one after the other, so the marker is printed when the command is done.
 * That is how the main process knows that the shell is busy again.
 */
function writeCommand(terminal: ActiveTerminal, command: string): void {
  const eol = terminal.spec.eol
  const lines = command.replace(/\r\n/g, '\n').replace(/\r/g, '').split('\n')
  const payload = lines.map((line) => line.replace(CONTROL_PATTERN, '') + eol).join('')
  writeToShell(terminal, payload)
  terminal.busy = true
  writeToShell(terminal, terminal.spec.marker(terminal.marker) + eol)
}

/** A token that no command of the user can produce by accident. */
function makeMarker(): string {
  return `__OPENNOTES_DONE_${process.pid}_${++tokenSeq}__`
}

/* ---------------------------- process handling --------------------------- */

interface ProcessRow {
  pid: number
  ppid: number
  name: string
}

/** All the processes of the machine (Windows). */
function listWindowsProcesses(): Promise<ProcessRow[]> {
  return new Promise((resolve) => {
    execFile(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        'Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,Name | ConvertTo-Json -Compress',
      ],
      { windowsHide: true, maxBuffer: 16 * 1024 * 1024 },
      (error, stdout) => {
        if (error) {
          resolve([])
          return
        }
        try {
          const parsed: unknown = JSON.parse(stdout.trim() || '[]')
          const list = Array.isArray(parsed) ? parsed : [parsed]
          const rows: ProcessRow[] = []
          for (const item of list) {
            const row = item as { ProcessId?: number; ParentProcessId?: number; Name?: string }
            rows.push({
              pid: Number(row.ProcessId ?? 0),
              ppid: Number(row.ParentProcessId ?? 0),
              name: String(row.Name ?? ''),
            })
          }
          resolve(rows)
        } catch {
          resolve([])
        }
      },
    )
  })
}

/** All the processes of the machine (Linux, macOS). */
function listPosixProcesses(): Promise<ProcessRow[]> {
  return new Promise((resolve) => {
    execFile('ps', ['-Ao', 'pid=,ppid=,comm='], { maxBuffer: 8 * 1024 * 1024 }, (error, stdout) => {
      if (error) {
        resolve([])
        return
      }
      const rows: ProcessRow[] = []
      for (const line of stdout.split('\n')) {
        const parts = line.trim().split(/\s+/)
        if (parts.length < 3) continue
        const pid = Number(parts[0])
        const ppid = Number(parts[1])
        if (!Number.isFinite(pid) || !Number.isFinite(ppid)) continue
        rows.push({ pid, ppid, name: parts.slice(2).join(' ') })
      }
      resolve(rows)
    })
  })
}

/** The children of a process (the deepest ones come last). */
function descendantsOf(rows: ProcessRow[], rootPid: number): ProcessRow[] {
  const children = new Map<number, ProcessRow[]>()
  for (const row of rows) {
    const list = children.get(row.ppid)
    if (list) list.push(row)
    else children.set(row.ppid, [row])
  }
  const found: ProcessRow[] = []
  const stack: number[] = [rootPid]
  const seen = new Set<number>([rootPid])
  while (stack.length > 0) {
    const pid = stack.pop() as number
    for (const child of children.get(pid) ?? []) {
      if (seen.has(child.pid)) continue
      seen.add(child.pid)
      found.push(child)
      stack.push(child.pid)
    }
  }
  return found
}

/** Kill a process with its children (Windows). */
function taskkill(pid: number): Promise<void> {
  return new Promise((resolve) => {
    execFile('taskkill', ['/pid', String(pid), '/T', '/F'], { windowsHide: true }, () => resolve())
  })
}

/**
 * Kill everything the shell has started, but not the shell itself.
 *
 * This is the real Ctrl+C: the shell is busy with a command and cannot read
 * the ETX byte that is written to its stdin.
 */
async function killCommandTree(terminal: ActiveTerminal): Promise<void> {
  const pid = terminal.child.pid
  if (!pid) return
  if (process.platform === 'win32') {
    const rows = await listWindowsProcesses()
    const victims = descendantsOf(rows, pid).filter((row) => !/^conhost\.exe$/i.test(row.name))
    // The deepest process comes first, so the parents are not killed too early.
    for (const victim of victims.reverse()) await taskkill(victim.pid)
    return
  }
  const rows = await listPosixProcesses()
  const victims = descendantsOf(rows, pid)
  for (const victim of victims.reverse()) {
    try {
      process.kill(victim.pid, 'SIGKILL')
    } catch {
      /* the process is already gone */
    }
  }
}

/** Kill the shell with everything it has started. */
function killShell(child: ChildProcess): void {
  if (!child || child.killed || child.pid === undefined) return
  if (process.platform === 'win32') {
    void taskkill(child.pid)
    return
  }
  try {
    child.kill('SIGKILL')
  } catch {
    /* the process is already gone */
  }
}

/* ------------------------------- the shell ------------------------------- */

/** The folder the shell should run in. */
function resolveCwd(requested: string | undefined): string {
  if (requested) {
    try {
      const resolved = path.resolve(requested)
      if (existsSync(resolved) && statSync(resolved).isDirectory()) return resolved
    } catch {
      /* the folder cannot be used, the home directory is used instead */
    }
  }
  return os.homedir()
}

/** Start a shell (an old one is stopped first). */
function startTerminal(win: BrowserWindow | null, requested: string | undefined): TerminalStartResult {
  // The old shell is replaced, so the renderer must not see an exit event.
  stopTerminal(false)
  const spec = pickShell()
  const dir = resolveCwd(requested)
  let child: ChildProcess
  try {
    child = spawn(spec.cmd, spec.args, {
      cwd: dir,
      env: process.env,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: false,
      windowsHide: true,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    send(win, { type: 'error', text: `Could not start the shell: ${message}` })
    return { ok: false, cwd: dir, shell: spec.kind, error: message }
  }

  const terminal: ActiveTerminal = {
    token: ++tokenSeq,
    child,
    win,
    spec,
    marker: makeMarker(),
    busy: false,
    pendingOut: '',
    pendingErr: '',
  }
  current = terminal

  child.stdout?.setEncoding('utf8')
  child.stdout?.on('data', (chunk: string) => handleChunk(terminal, 'stdout', chunk))
  child.stderr?.setEncoding('utf8')
  child.stderr?.on('data', (chunk: string) => handleChunk(terminal, 'stderr', chunk))

  child.on('error', (error) => {
    send(win, { type: 'error', text: `The shell failed: ${error.message}` })
  })

  child.on('close', (code) => {
    // The last line of the shell is shown as well.
    if (terminal.pendingOut) {
      sendOutput(terminal, 'stdout', terminal.pendingOut)
      terminal.pendingOut = ''
    }
    if (terminal.pendingErr) {
      sendOutput(terminal, 'stderr', terminal.pendingErr)
      terminal.pendingErr = ''
    }
    if (current?.token !== terminal.token) return
    current = null
    send(win, { type: 'exit', code: code ?? undefined })
  })

  if (win) {
    win.once('closed', () => {
      if (current?.token === terminal.token) stopTerminal()
    })
  }

  return { ok: true, cwd: dir, shell: spec.kind }
}

/**
 * Stop the shell.
 *
 * @param notify The renderer gets an exit event (a restart does not need
 *   one: the shell is replaced by another one).
 */
function stopTerminal(notify = true): void {
  const terminal = current
  current = null
  if (!terminal) return
  killShell(terminal.child)
  if (notify) send(terminal.win, { type: 'exit' })
}

/* -------------------------------- requests ------------------------------- */

/** The folder of a start request (a plain string is accepted as well). */
function readCwd(request: unknown): string | undefined {
  if (typeof request === 'string') return request.trim() || undefined
  if (request && typeof request === 'object') {
    const cwd = (request as { cwd?: unknown }).cwd
    if (typeof cwd === 'string') return cwd.trim() || undefined
  }
  return undefined
}

/** The text of a write request (a plain string is accepted as well). */
function readText(request: unknown): string {
  if (typeof request === 'string') return request
  if (request && typeof request === 'object') {
    const payload = request as { text?: unknown; command?: unknown }
    if (typeof payload.text === 'string') return payload.text
    if (typeof payload.command === 'string') return payload.command
  }
  return ''
}

/* -------------------------------- handlers ------------------------------- */

export function registerTerminalHandlers(): void {
  ipcMain.handle('terminal:start', (event, request?: TerminalStartRequest | string) => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender) ?? null
      const result = startTerminal(win, readCwd(request))
      if (!result.ok) {
        send(win, { type: 'error', text: result.error ?? 'The shell could not be started.' })
      }
      return result
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      send(BrowserWindow.fromWebContents(event.sender) ?? null, {
        type: 'error',
        text: `Could not start the shell: ${message}`,
      })
      return { ok: false, cwd: '', shell: '', error: message } satisfies TerminalStartResult
    }
  })

  ipcMain.handle('terminal:write', (_event, request?: unknown) => {
    const terminal = current
    if (!terminal) return false
    const command = readText(request)
    if (!command.trim()) return true
    writeCommand(terminal, command)
    return true
  })

  ipcMain.handle('terminal:interrupt', () => {
    const terminal = current
    if (!terminal) return false
    // The classic Ctrl+C byte. Over a pipe it cannot raise an interrupt, and
    // the shell would run it as a command, so it goes into a comment.
    writeToShell(terminal, terminal.spec.interrupt)
    // The real interrupt: the command that is running is killed, the shell
    // stays alive and prints its prompt again.
    void killCommandTree(terminal)
    return true
  })

  ipcMain.handle('terminal:stop', () => {
    stopTerminal()
    return true
  })

  // A piped shell has no size: the panel uses this to lay itself out.
  ipcMain.handle('terminal:resize', () => true)
}
