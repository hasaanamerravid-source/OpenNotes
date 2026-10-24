/**
 * Run state: the output of the process that was started for a file.
 *
 * The main process owns the child process, the renderer only asks it to start
 * or stop a run and listens for the streamed output.
 *
 * Expected preload shape (the preload owner adds this binding):
 *
 *   run: {
 *     start(filePath: string, language: string): Promise<boolean>
 *     stop(): Promise<boolean>
 *     onOutput(cb: (event: RunEvent) => void): () => void
 *   }
 *
 * The binding does not exist in every build, so every call is guarded and the
 * module stays usable (and importable) without a browser window.
 */

import { create } from 'zustand'
import { useAppStore } from '../store/app'
import { cachedProjectConfig, resolveTool } from './projectConfig'

/**
 * The interpreters of the toolchain settings and of the project configuration.
 * The project file wins over the global settings.
 */
export function currentToolchain(): Record<string, string> {
  const settings = useAppStore.getState().settings
  const project = cachedProjectConfig()
  const out: Record<string, string> = {}
  for (const key of Object.keys(settings.toolchain ?? {})) {
    const value = resolveTool(key, project, settings.toolchain ?? {})
    if (value) out[key] = value
  }
  // The project may configure a tool that the global settings do not know.
  for (const [key, value] of Object.entries(project?.toolchain ?? {})) {
    if (value && !out[key]) out[key] = value
  }
  return out
}

/** The events the main process sends for a run. */
export interface RunEvent {
  type: 'start' | 'stdout' | 'stderr' | 'exit' | 'error'
  text?: string
  code?: number
}

export interface RunLine {
  type: 'stdout' | 'stderr' | 'system'
  text: string
}

export interface RunState {
  running: boolean
  filePath: string | null
  language: string | null
  lines: RunLine[]
  exitCode: number | null
  startedAt: number | null
  /** Start a run (uses window.api.run). */
  start: (filePath: string, language: string) => void
  /** Stop the running process. */
  stop: () => void
  /** Clear the output. */
  clear: () => void
}

/** The oldest lines are dropped when the log grows too long. */
export const MAX_RUN_LINES = 2000

/** The part of a line that has not been terminated yet (one buffer per stream). */
const buffers: Record<'stdout' | 'stderr', string> = { stdout: '', stderr: '' }

/** The bridge to the main process (it may be missing in an old build). */
interface RunBridge {
  start?: (filePath: string, language: string, toolchain?: Record<string, string>) => Promise<unknown> | unknown
  stop?: () => Promise<unknown> | unknown
  onOutput?: (cb: (event: RunEvent) => void) => (() => void) | void
}

/** The bridge, if the preload exposes it. */
function runBridge(): RunBridge | undefined {
  if (typeof window === 'undefined') return undefined
  try {
    const api = window.api as unknown as { run?: RunBridge } | undefined
    return api?.run
  } catch {
    return undefined
  }
}

/** Split a chunk of output into lines and append them to the log. */
function appendLines(current: RunLine[], type: 'stdout' | 'stderr', chunk: string): RunLine[] {
  const parts = (buffers[type] + chunk).split('\n')
  buffers[type] = parts.pop() ?? ''
  const fresh: RunLine[] = parts.map((text) => ({
    type,
    text: text.endsWith('\r') ? text.slice(0, -1) : text,
  }))
  if (fresh.length === 0) return current
  const lines = current.concat(fresh)
  return lines.length > MAX_RUN_LINES ? lines.slice(lines.length - MAX_RUN_LINES) : lines
}

/** A system line is always appended at the end. */
function appendSystem(lines: RunLine[], text: string): RunLine[] {
  const next = lines.concat([{ type: 'system', text }])
  return next.length > MAX_RUN_LINES ? next.slice(next.length - MAX_RUN_LINES) : next
}

/** Handle one event of the main process. */
function handleEvent(event: RunEvent): void {
  if (!event || typeof event.type !== 'string') return
  switch (event.type) {
    case 'start':
      useRunStore.setState((s) => ({
        running: true,
        startedAt: s.startedAt ?? Date.now(),
        lines: appendSystem(s.lines, event.text ? `$ ${event.text}` : 'Process started'),
      }))
      break
    case 'stdout':
      useRunStore.setState((s) => ({ lines: appendLines(s.lines, 'stdout', event.text ?? '') }))
      break
    case 'stderr':
      useRunStore.setState((s) => ({ lines: appendLines(s.lines, 'stderr', event.text ?? '') }))
      break
    case 'error':
      useRunStore.setState((s) => ({
        running: false,
        lines: appendSystem(s.lines, event.text ?? 'The run failed.'),
      }))
      break
    case 'exit':
      useRunStore.setState((s) => ({
        running: false,
        exitCode: event.code ?? null,
        lines: appendSystem(
          s.lines,
          event.code === null || event.code === undefined ? 'Process stopped.' : `Exited with code ${event.code}`,
        ),
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
  const onOutput = runBridge()?.onOutput
  if (typeof onOutput !== 'function') return
  try {
    const stop = onOutput(handleEvent)
    dispose = typeof stop === 'function' ? stop : () => undefined
  } catch {
    dispose = null
  }
}

export const useRunStore = create<RunState>((set) => ({
  running: false,
  filePath: null,
  language: null,
  lines: [],
  exitCode: null,
  startedAt: null,

  start: (filePath, language) => {
    buffers.stdout = ''
    buffers.stderr = ''
    set({
      running: true,
      filePath,
      language,
      lines: [],
      exitCode: null,
      startedAt: Date.now(),
    })
    subscribe()
    const bridge = runBridge()
    if (typeof bridge?.start !== 'function') {
      set((s) => ({
        running: false,
        lines: appendSystem(s.lines, 'The run bridge is not available in this build.'),
      }))
      return
    }
    try {
      void Promise.resolve(bridge.start(filePath, language, currentToolchain())).catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error)
        set((s) => ({
          running: false,
          lines: appendSystem(s.lines, `Could not start the process: ${message}`),
        }))
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      set((s) => ({
        running: false,
        lines: appendSystem(s.lines, `Could not start the process: ${message}`),
      }))
    }
  },

  stop: () => {
    const bridge = runBridge()
    if (typeof bridge?.stop === 'function') {
      try {
        void Promise.resolve(bridge.stop()).catch(() => undefined)
      } catch {
        /* the process is stopped anyway */
      }
    }
    set({ running: false })
  },

  clear: () => {
    buffers.stdout = ''
    buffers.stderr = ''
    set({ lines: [], exitCode: null })
  },
}))

// The subscription starts as soon as the module is loaded, so that the output
// of a run that was started elsewhere still shows up. Importing the module
// without a browser (tests, scripts) must not throw.
if (typeof window !== 'undefined') {
  subscribe()
}

/** A snapshot of the run state, for the command layer. */
export interface RunSnapshot {
  running: boolean
  filePath: string | null
  language: string | null
  lines: RunLine[]
  exitCode: number | null
  startedAt: number | null
}

/** The current run state without a React hook. */
export function runState(): RunSnapshot {
  const state = useRunStore.getState()
  return {
    running: state.running,
    filePath: state.filePath,
    language: state.language,
    lines: state.lines,
    exitCode: state.exitCode,
    startedAt: state.startedAt,
  }
}

/** Start a run for a file (used by the command layer). */
export function startRun(filePath: string, language: string): void {
  useRunStore.getState().start(filePath, language)
}

/** Stop the running process (used by the command layer). */
export function stopRun(): void {
  useRunStore.getState().stop()
}
