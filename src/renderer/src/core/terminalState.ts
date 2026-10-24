/**
 * Terminal state: the output of the persistent shell.
 *
 * The main process owns the shell, the renderer only asks it to start, to
 * write a command or to interrupt it and listens for the streamed output.
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
 *
 * The binding does not exist in every build, so every call is guarded and the
 * module stays usable (and importable) without a browser window.
 *
 * The main process sends an empty stdout line when the shell has finished the
 * command (that is how the panel knows that the shell is ready again).
 */

import { create } from 'zustand'

/** The events the main process sends for the terminal. */
export interface TerminalEvent {
  type: 'stdout' | 'stderr' | 'exit' | 'error'
  text?: string
  code?: number
}

export interface TerminalLine {
  type: 'input' | 'stdout' | 'stderr' | 'system'
  text: string
}

export interface TerminalState {
  running: boolean
  cwd: string
  lines: TerminalLine[]
  history: string[]
  historyIndex: number
  /** True while a command is running (the shell did not answer yet). */
  busy: boolean
  /** Start (or restart) the shell. */
  start: (cwd?: string) => void
  /** Run a command. */
  write: (command: string) => void
  /** Stop the command that is running (Ctrl+C). */
  interrupt: () => void
  /** Stop the shell. */
  stop: () => void
  /** Clear the output. */
  clear: () => void
  /** Walk back in the history (ArrowUp), null when there is nothing. */
  historyPrev: () => string | null
  /** Walk forward in the history (ArrowDown), null when there is nothing. */
  historyNext: () => string | null
}

/** The oldest lines are dropped when the log grows too long. */
export const MAX_TERMINAL_LINES = 2000

/** The number of commands the history keeps. */
export const MAX_TERMINAL_HISTORY = 100

/** The bridge to the main process (it may be missing in an old build). */
interface TerminalBridge {
  start?: (cwd?: string) => Promise<unknown> | unknown
  write?: (text: string) => Promise<unknown> | unknown
  interrupt?: () => Promise<unknown> | unknown
  stop?: () => Promise<unknown> | unknown
  resize?: (cols: number, rows: number) => Promise<unknown> | unknown
  onOutput?: (cb: (event: TerminalEvent) => void) => (() => void) | void
}

/** The bridge, if the preload exposes it. */
function terminalBridge(): TerminalBridge | undefined {
  if (typeof window === 'undefined') return undefined
  try {
    const api = window.api as unknown as { terminal?: TerminalBridge } | undefined
    return api?.terminal
  } catch {
    return undefined
  }
}

/** The folder the main process really used (it may fall back to the home). */
function readCwd(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null
  const cwd = (value as { cwd?: unknown }).cwd
  return typeof cwd === 'string' && cwd.trim() ? cwd : null
}

/** The error message of a rejected bridge call. */
function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** Split a piece of output into lines (the last empty part is dropped). */
function toLines(text: string): string[] {
  const parts = text.split('\n')
  if (parts.length > 0 && parts[parts.length - 1] === '') parts.pop()
  return parts.map((part) => (part.endsWith('\r') ? part.slice(0, -1) : part))
}

/** Append lines to the log and drop the oldest ones. */
function append(lines: TerminalLine[], fresh: TerminalLine[]): TerminalLine[] {
  if (fresh.length === 0) return lines
  const next = lines.concat(fresh)
  return next.length > MAX_TERMINAL_LINES ? next.slice(next.length - MAX_TERMINAL_LINES) : next
}

/** A system line is always appended at the end. */
function appendSystem(lines: TerminalLine[], text: string): TerminalLine[] {
  return append(lines, [{ type: 'system', text }])
}

/** Handle one event of the main process. */
function handleEvent(event: TerminalEvent): void {
  if (!event || typeof event.type !== 'string') return
  switch (event.type) {
    case 'stdout':
      useTerminalStore.setState((s) => {
        const text = event.text ?? ''
        // An empty line means: the shell has finished the command.
        if (!text) return { busy: false }
        return {
          lines: append(
            s.lines,
            toLines(text).map((line) => ({ type: 'stdout' as const, text: line })),
          ),
        }
      })
      break
    case 'stderr':
      useTerminalStore.setState((s) => ({
        lines: append(
          s.lines,
          toLines(event.text ?? '').map((text) => ({ type: 'stderr' as const, text })),
        ),
      }))
      break
    case 'error':
      useTerminalStore.setState((s) => ({
        running: false,
        busy: false,
        lines: appendSystem(s.lines, event.text ?? 'The shell failed.'),
      }))
      break
    case 'exit':
      useTerminalStore.setState((s) => ({
        running: false,
        busy: false,
        lines: appendSystem(s.lines, 'The shell stopped.'),
      }))
      break
    default:
      break
  }
}

let dispose: (() => void) | null = null

/** Listen to the output events of the main process (only once). */
function subscribe(): void {
  if (dispose) return
  const onOutput = terminalBridge()?.onOutput
  if (typeof onOutput !== 'function') return
  try {
    const stop = onOutput(handleEvent)
    dispose = typeof stop === 'function' ? stop : () => undefined
  } catch {
    dispose = null
  }
}

export const useTerminalStore = create<TerminalState>((set, get) => ({
  running: false,
  cwd: '',
  lines: [],
  history: [],
  historyIndex: -1,
  busy: false,

  start: (cwd) => {
    const folder = (cwd ?? '').trim()
    set((s) => ({
      running: true,
      busy: false,
      cwd: folder || s.cwd,
      historyIndex: -1,
      lines: appendSystem(s.lines, folder ? `Shell started in ${folder}` : 'Shell started'),
    }))
    subscribe()
    const bridge = terminalBridge()
    if (typeof bridge?.start !== 'function') {
      set((s) => ({
        running: false,
        lines: appendSystem(s.lines, 'The terminal bridge is not available in this build.'),
      }))
      return
    }
    try {
      void Promise.resolve(bridge.start(folder || undefined))
        .then((value) => {
          // The main process may use another folder (the home directory).
          const actual = readCwd(value)
          if (actual) set({ cwd: actual })
        })
        .catch((error: unknown) => {
          set((s) => ({
            running: false,
            lines: appendSystem(s.lines, `Could not start the shell: ${errorMessage(error)}`),
          }))
        })
    } catch (error) {
      set((s) => ({
        running: false,
        lines: appendSystem(s.lines, `Could not start the shell: ${errorMessage(error)}`),
      }))
    }
  },

  write: (command) => {
    if (!command.trim()) return
    set((s) => ({
      lines: append(s.lines, [{ type: 'input', text: command }]),
      // The history keeps the commands in the order they were typed, so that
      // ArrowUp can walk through it backwards.
      history: s.history.concat(command).slice(-MAX_TERMINAL_HISTORY),
      historyIndex: -1,
      busy: true,
    }))
    const bridge = terminalBridge()
    if (typeof bridge?.write !== 'function') {
      set((s) => ({
        lines: appendSystem(s.lines, 'The terminal bridge is not available in this build.'),
      }))
      return
    }
    try {
      void Promise.resolve(bridge.write(command))
        .then((value) => {
          // The main process says that there is no shell.
          if (value === false) {
            set((s) => ({
              running: false,
              lines: appendSystem(s.lines, 'The shell is not running.'),
            }))
          }
        })
        .catch((error: unknown) => {
          set((s) => ({
            lines: appendSystem(s.lines, `Could not run the command: ${errorMessage(error)}`),
          }))
        })
    } catch (error) {
      set((s) => ({
        lines: appendSystem(s.lines, `Could not run the command: ${errorMessage(error)}`),
      }))
    }
  },

  interrupt: () => {
    const bridge = terminalBridge()
    if (typeof bridge?.interrupt !== 'function') return
    try {
      void Promise.resolve(bridge.interrupt()).catch(() => undefined)
    } catch {
      /* the command is killed anyway */
    }
  },

  stop: () => {
    const bridge = terminalBridge()
    if (typeof bridge?.stop === 'function') {
      try {
        void Promise.resolve(bridge.stop()).catch(() => undefined)
      } catch {
        /* the shell is stopped anyway */
      }
    }
    set({ running: false, busy: false })
  },

  clear: () => {
    set({ lines: [] })
  },

  historyPrev: () => {
    const state = get()
    if (state.history.length === 0) return null
    const index = state.historyIndex < 0 ? state.history.length - 1 : Math.max(0, state.historyIndex - 1)
    set({ historyIndex: index })
    return state.history[index]
  },

  historyNext: () => {
    const state = get()
    if (state.historyIndex < 0) return null
    const index = state.historyIndex + 1
    if (index >= state.history.length) {
      set({ historyIndex: -1 })
      return null
    }
    set({ historyIndex: index })
    return state.history[index]
  },
}))

// The subscription starts as soon as the module is loaded, so that the output
// of a shell that was started elsewhere still shows up. Importing the module
// without a browser (tests, scripts) must not throw.
if (typeof window !== 'undefined') {
  subscribe()
}

/** A snapshot of the terminal state, for the command layer. */
export interface TerminalSnapshot {
  running: boolean
  cwd: string
  lines: TerminalLine[]
  history: string[]
  historyIndex: number
  busy: boolean
}

/** The current terminal state without a React hook. */
export function terminalState(): TerminalSnapshot {
  const state = useTerminalStore.getState()
  return {
    running: state.running,
    cwd: state.cwd,
    lines: state.lines,
    history: state.history,
    historyIndex: state.historyIndex,
    busy: state.busy,
  }
}

/** Start the shell (used by the command layer). */
export function startTerminal(cwd?: string): void {
  useTerminalStore.getState().start(cwd)
}

/** Stop the shell (used by the command layer). */
export function stopTerminal(): void {
  useTerminalStore.getState().stop()
}
