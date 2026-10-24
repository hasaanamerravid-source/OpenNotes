/**
 * A very small macro recorder.
 *
 * A macro is a named list of events (`insert`, `delete` or `command`) that can be
 * replayed later. Macros are persisted in `localStorage` under `opennotes.macros`.
 */

/** A single recorded action. */
export type MacroEvent = {
  type: 'insert' | 'delete' | 'command'
  value: string
}

/** A named, replayable sequence of events. */
export interface Macro {
  name: string
  events: MacroEvent[]
  createdAt: number
}

/** localStorage key the macros are stored under. */
export const MACRO_STORAGE_KEY = 'opennotes.macros'

/** Delay between two replayed events, in milliseconds. */
const PLAYBACK_DELAY = 20

/** Handle returned by `startRecording`. */
export interface MacroRecorder {
  /** Stop the recording and return the captured events. */
  stop: () => MacroEvent[]
  /** Capture an event; ignored when the recorder is not running. */
  record: (event: MacroEvent) => void
  /** True while the recorder is capturing events. */
  isRecording: () => boolean
}

/** The recorder that is currently running, if any. */
let activeRecorder: MacroRecorder | null = null

/**
 * Start recording a macro.
 *
 * The returned recorder captures events until `stop()` is called. Starting a new
 * recording stops the previous one.
 */
export function startRecording(): MacroRecorder {
  activeRecorder?.stop()
  const events: MacroEvent[] = []
  let recording = true

  const recorder: MacroRecorder = {
    record: (event: MacroEvent) => {
      if (!recording) return
      if (!event) return
      events.push({ type: event.type, value: event.value })
    },
    isRecording: () => recording,
    stop: () => {
      recording = false
      if (activeRecorder === recorder) activeRecorder = null
      return events.slice()
    },
  }

  activeRecorder = recorder
  return recorder
}

/** The recorder that is currently capturing events, if any. */
export function currentRecorder(): MacroRecorder | null {
  return activeRecorder
}

/**
 * Replay a list of events.
 *
 * The first event runs immediately, every following event is delayed by
 * `PLAYBACK_DELAY` milliseconds so the editor can keep up.
 */
export function playMacro(events: MacroEvent[], exec: (event: MacroEvent) => void): void {
  if (!events?.length) return
  let index = 0

  const tick = (): void => {
    const event = events[index]
    if (!event) return
    index += 1
    try {
      exec(event)
    } catch (err) {
      console.error('[opennotes] macro playback failed:', err)
    }
    if (index < events.length) {
      setTimeout(tick, PLAYBACK_DELAY)
    }
  }

  tick()
}

/** Type guard for macros read back from storage. */
function isMacro(value: unknown): value is Macro {
  if (!value || typeof value !== 'object') return false
  const macro = value as Partial<Macro>
  if (typeof macro.name !== 'string') return false
  if (!Array.isArray(macro.events)) return false
  if (typeof macro.createdAt !== 'number') return false
  return macro.events.every(
    (event) =>
      !!event &&
      typeof event === 'object' &&
      typeof (event as MacroEvent).value === 'string' &&
      ['insert', 'delete', 'command'].includes((event as MacroEvent).type),
  )
}

/** Persist a list of macros. */
export function saveMacros(macros: Macro[]): void {
  try {
    const clean = (macros ?? []).filter(isMacro)
    localStorage.setItem(MACRO_STORAGE_KEY, JSON.stringify(clean))
  } catch (err) {
    console.error('[opennotes] could not save macros:', err)
  }
}

/** Read the persisted macros. Returns an empty list when nothing is stored. */
export function loadMacros(): Macro[] {
  try {
    const raw = localStorage.getItem(MACRO_STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isMacro)
  } catch (err) {
    console.error('[opennotes] could not load macros:', err)
    return []
  }
}

/** Remove a macro by name. */
export function deleteMacro(name: string): void {
  const macros = loadMacros().filter((macro) => macro.name !== name)
  saveMacros(macros)
}
