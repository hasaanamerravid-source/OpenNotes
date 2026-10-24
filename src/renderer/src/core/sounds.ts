/**
 * UI sound themes for OpenNotes.
 *
 * Every theme is described declaratively: a `SynthSpec` says which oscillator
 * to run, how long it should ring and how it should decay. The synthesiser at
 * the bottom of this file turns that description into Web Audio nodes at
 * runtime, so the app ships no audio assets and needs no network access.
 *
 * The inspirations are all well known open source sound sets: the Sublime Text
 * notification sounds, the VS Code "sound" extensions, the i3 / awesomeWM
 * click sounds, the terminal bell/beep and the Material Design sound cues.
 * Each theme records its inspiration in `basedOn`.
 */

/** A UI moment that can produce a sound. */
export type SoundEvent =
  | 'save'
  | 'open'
  | 'close'
  | 'newTab'
  | 'error'
  | 'toggle'
  | 'command'
  | 'complete'
  | 'notification'
  | 'backspace'
  | 'toggleSidebar'

/** A tiny synthesiser description. */
export interface SynthSpec {
  /** Start frequency in Hz. */
  freq: number
  /** Optional second oscillator frequency (Hz). */
  freq2?: number
  /** Duration in seconds (0.02 - 0.6). */
  duration: number
  type: 'sine' | 'square' | 'triangle' | 'sawtooth'
  /** Peak gain of the envelope (0.05 - 0.6). */
  gain: number
  /** Optional exponential sweep target in Hz. */
  sweep?: number
  /** Optional short noise burst mixed in (0 - 1). */
  noise?: number
  /** Delay before the tone starts, in seconds. */
  delay?: number
}

export interface SoundThemeEntry {
  id: string
  label: string
  basedOn: string
  /** The events this theme plays. Missing events are silent. */
  events: Partial<Record<SoundEvent, SynthSpec>>
}

/** Id of the theme that never makes a sound. */
export const SILENT_SOUND_THEME_ID = 'silent'

/** Id of the theme used when a requested theme id is unknown. */
export const DEFAULT_SOUND_THEME_ID = 'subtle'

/** The events every non silent theme is expected to cover. */
export const REQUIRED_SOUND_EVENTS: SoundEvent[] = ['save', 'open', 'error', 'toggle', 'command']

/** Compact builder so a theme table stays readable. */
function tone(
  freq: number,
  duration: number,
  type: SynthSpec['type'],
  gain: number,
  extra: Partial<SynthSpec> = {},
): SynthSpec {
  return { freq, duration, type, gain, ...extra }
}

export const SOUND_THEMES: SoundThemeEntry[] = [
  {
    id: 'silent',
    label: 'Silent',
    basedOn: 'No sound at all (accessibility option)',
    events: {},
  },
  {
    id: 'subtle',
    label: 'Subtle',
    basedOn: 'VS Code "subtle" notification tone (soft, low level blips)',
    events: {
      save: tone(660, 0.09, 'sine', 0.1, { sweep: 880 }),
      open: tone(520, 0.08, 'sine', 0.09, { sweep: 700 }),
      close: tone(440, 0.08, 'sine', 0.08, { sweep: 330 }),
      newTab: tone(740, 0.06, 'sine', 0.08),
      error: tone(220, 0.16, 'sine', 0.16, { freq2: 233 }),
      toggle: tone(880, 0.05, 'sine', 0.09),
      command: tone(620, 0.07, 'sine', 0.1, { freq2: 930 }),
      complete: tone(660, 0.12, 'sine', 0.11, { freq2: 990 }),
      notification: tone(740, 0.1, 'sine', 0.11, { freq2: 1109 }),
      backspace: tone(300, 0.05, 'sine', 0.06),
      toggleSidebar: tone(500, 0.07, 'sine', 0.09, { sweep: 700 }),
    },
  },
  {
    id: 'classic',
    label: 'Classic',
    basedOn: 'Sublime Text default notification sounds (clean two note cues)',
    events: {
      save: tone(784, 0.16, 'sine', 0.18, { freq2: 1046 }),
      open: tone(523, 0.16, 'sine', 0.16, { freq2: 784 }),
      close: tone(392, 0.14, 'sine', 0.14, { freq2: 523 }),
      newTab: tone(659, 0.08, 'sine', 0.12),
      error: tone(196, 0.35, 'triangle', 0.24, { freq2: 207 }),
      toggle: tone(880, 0.07, 'sine', 0.14),
      command: tone(698, 0.12, 'sine', 0.16, { freq2: 1046 }),
      complete: tone(659, 0.24, 'sine', 0.16, { freq2: 988 }),
      notification: tone(880, 0.22, 'sine', 0.18, { freq2: 1318 }),
      backspace: tone(262, 0.05, 'sine', 0.09),
      toggleSidebar: tone(587, 0.09, 'sine', 0.13),
    },
  },
  {
    id: 'typewriter',
    label: 'Typewriter',
    basedOn: 'Typewriter / mechanical keyboard click sounds (filtered noise clacks)',
    events: {
      save: tone(180, 0.05, 'triangle', 0.1, { noise: 0.85 }),
      open: tone(220, 0.05, 'triangle', 0.1, { noise: 0.8 }),
      close: tone(160, 0.05, 'triangle', 0.09, { noise: 0.75 }),
      newTab: tone(200, 0.045, 'triangle', 0.1, { noise: 0.9 }),
      error: tone(120, 0.12, 'sawtooth', 0.18, { noise: 0.4 }),
      toggle: tone(240, 0.035, 'triangle', 0.09, { noise: 0.7 }),
      command: tone(260, 0.04, 'triangle', 0.1, { noise: 0.85 }),
      complete: tone(300, 0.05, 'triangle', 0.1, { noise: 0.6, freq2: 450 }),
      notification: tone(190, 0.07, 'triangle', 0.13, { noise: 0.9, freq2: 380 }),
      backspace: tone(140, 0.035, 'triangle', 0.1, { noise: 0.95 }),
      toggleSidebar: tone(210, 0.04, 'triangle', 0.1, { noise: 0.8 }),
    },
  },
  {
    id: 'bell',
    label: 'Bell',
    basedOn: 'Terminal bell / desk bell (metal partials with a long ring)',
    events: {
      save: tone(1046, 0.4, 'sine', 0.2, { freq2: 1568 }),
      open: tone(880, 0.45, 'sine', 0.18, { freq2: 1320 }),
      close: tone(660, 0.35, 'sine', 0.16, { freq2: 990 }),
      newTab: tone(1318, 0.25, 'sine', 0.14),
      error: tone(220, 0.5, 'square', 0.2, { freq2: 233, sweep: 180 }),
      toggle: tone(1174, 0.12, 'sine', 0.14),
      command: tone(987, 0.3, 'sine', 0.16, { freq2: 1318 }),
      complete: tone(1046, 0.5, 'sine', 0.16, { freq2: 1318 }),
      notification: tone(1318, 0.5, 'sine', 0.18, { freq2: 1975 }),
      backspace: tone(440, 0.08, 'sine', 0.1),
      toggleSidebar: tone(987, 0.18, 'sine', 0.13),
    },
  },
  {
    id: 'chime',
    label: 'Chime',
    basedOn: 'Material Design sound cues (bright, friendly bell tones)',
    events: {
      save: tone(880, 0.3, 'triangle', 0.16, { freq2: 1320 }),
      open: tone(1046, 0.34, 'triangle', 0.15, { freq2: 1568 }),
      close: tone(784, 0.28, 'triangle', 0.13, { freq2: 1046 }),
      newTab: tone(1318, 0.2, 'triangle', 0.13, { freq2: 1760 }),
      error: tone(330, 0.35, 'triangle', 0.2, { freq2: 311 }),
      toggle: tone(1174, 0.09, 'triangle', 0.12),
      command: tone(988, 0.22, 'triangle', 0.14, { freq2: 1480 }),
      complete: tone(1046, 0.4, 'triangle', 0.15, { freq2: 1568 }),
      notification: tone(1318, 0.42, 'triangle', 0.16, { freq2: 1975 }),
      backspace: tone(587, 0.06, 'triangle', 0.09),
      toggleSidebar: tone(880, 0.14, 'triangle', 0.12),
    },
  },
  {
    id: 'click',
    label: 'Click',
    basedOn: 'i3 / awesomeWM mouse click sounds (very short high clicks)',
    events: {
      save: tone(1200, 0.03, 'square', 0.12, { noise: 0.6 }),
      open: tone(1500, 0.03, 'square', 0.11, { noise: 0.5 }),
      close: tone(900, 0.03, 'square', 0.1, { noise: 0.55 }),
      newTab: tone(1800, 0.025, 'square', 0.1, { noise: 0.4 }),
      error: tone(300, 0.09, 'square', 0.18, { sweep: 200 }),
      toggle: tone(2000, 0.025, 'square', 0.1, { noise: 0.35 }),
      command: tone(1600, 0.03, 'square', 0.11, { noise: 0.45 }),
      complete: tone(2200, 0.03, 'square', 0.1, { noise: 0.3 }),
      notification: tone(1700, 0.04, 'square', 0.12, { noise: 0.4 }),
      backspace: tone(700, 0.025, 'square', 0.1, { noise: 0.65 }),
      toggleSidebar: tone(1100, 0.03, 'square', 0.1, { noise: 0.5 }),
    },
  },
  {
    id: 'pop',
    label: 'Pop',
    basedOn: 'VS Code "pop" sound extension (pitched pop with a fast rise)',
    events: {
      save: tone(880, 0.08, 'sine', 0.2, { sweep: 1320 }),
      open: tone(660, 0.08, 'sine', 0.19, { sweep: 990 }),
      close: tone(520, 0.08, 'sine', 0.17, { sweep: 330 }),
      newTab: tone(990, 0.07, 'sine', 0.17, { sweep: 1480 }),
      error: tone(300, 0.22, 'sine', 0.24, { freq2: 302, sweep: 180 }),
      toggle: tone(1200, 0.05, 'sine', 0.16, { sweep: 900 }),
      command: tone(780, 0.07, 'sine', 0.18, { sweep: 1100 }),
      complete: tone(740, 0.1, 'sine', 0.18, { sweep: 1480 }),
      notification: tone(880, 0.12, 'sine', 0.2, { freq2: 1760, sweep: 1320 }),
      backspace: tone(400, 0.05, 'sine', 0.12, { sweep: 260 }),
      toggleSidebar: tone(700, 0.08, 'sine', 0.16, { sweep: 1000 }),
    },
  },
  {
    id: 'blip',
    label: 'Blip',
    basedOn: 'Retro blip UI sounds (square wave, pitch bend, arcade style)',
    events: {
      save: tone(880, 0.05, 'square', 0.16, { sweep: 1320 }),
      open: tone(660, 0.05, 'square', 0.15, { sweep: 990 }),
      close: tone(520, 0.05, 'square', 0.14, { sweep: 330 }),
      newTab: tone(990, 0.045, 'square', 0.14, { sweep: 1480 }),
      error: tone(220, 0.18, 'square', 0.2, { sweep: 110 }),
      toggle: tone(1200, 0.04, 'square', 0.14, { sweep: 1600 }),
      command: tone(740, 0.05, 'square', 0.15, { sweep: 1100 }),
      complete: tone(880, 0.06, 'square', 0.15, { sweep: 1760 }),
      notification: tone(1046, 0.07, 'square', 0.16, { sweep: 1568 }),
      backspace: tone(440, 0.04, 'square', 0.12, { sweep: 220 }),
      toggleSidebar: tone(660, 0.05, 'square', 0.14, { sweep: 990 }),
    },
  },
  {
    id: 'synth',
    label: 'Synth',
    basedOn: 'Synthwave / retro futurist UI tones (detuned sawtooth sweeps)',
    events: {
      save: tone(440, 0.2, 'sawtooth', 0.16, { freq2: 466, sweep: 880 }),
      open: tone(330, 0.22, 'sawtooth', 0.15, { freq2: 349, sweep: 660 }),
      close: tone(220, 0.22, 'sawtooth', 0.14, { freq2: 233, sweep: 110 }),
      newTab: tone(660, 0.12, 'sawtooth', 0.14, { freq2: 698, sweep: 990 }),
      error: tone(110, 0.4, 'sawtooth', 0.2, { freq2: 116, sweep: 82 }),
      toggle: tone(880, 0.08, 'sawtooth', 0.14, { sweep: 1320 }),
      command: tone(587, 0.16, 'sawtooth', 0.15, { freq2: 622, sweep: 880 }),
      complete: tone(523, 0.3, 'sawtooth', 0.16, { freq2: 554, sweep: 1046, delay: 0.05 }),
      notification: tone(440, 0.3, 'sawtooth', 0.16, { freq2: 466, sweep: 880 }),
      backspace: tone(220, 0.07, 'sawtooth', 0.12, { sweep: 110 }),
      toggleSidebar: tone(392, 0.12, 'sawtooth', 0.14, { sweep: 587 }),
    },
  },
  {
    id: 'terminal',
    label: 'Terminal',
    basedOn: 'Terminal bell / beep (xterm and gnome-terminal BEL, dry square pulses)',
    events: {
      save: tone(1000, 0.04, 'square', 0.14),
      open: tone(750, 0.04, 'square', 0.13),
      close: tone(500, 0.04, 'square', 0.12),
      newTab: tone(1200, 0.035, 'square', 0.12),
      error: tone(200, 0.2, 'square', 0.18),
      toggle: tone(1500, 0.03, 'square', 0.12),
      command: tone(900, 0.035, 'square', 0.13),
      complete: tone(1100, 0.05, 'square', 0.14, { freq2: 1500 }),
      notification: tone(1250, 0.06, 'square', 0.15),
      backspace: tone(400, 0.025, 'square', 0.1),
      toggleSidebar: tone(700, 0.035, 'square', 0.12),
    },
  },
  {
    id: 'retro',
    label: 'Retro',
    basedOn: '8-bit game UI blips (octave stacked square waves)',
    events: {
      save: tone(523, 0.14, 'square', 0.16, { freq2: 1046 }),
      open: tone(392, 0.14, 'square', 0.15, { freq2: 784 }),
      close: tone(262, 0.16, 'square', 0.14, { freq2: 523 }),
      newTab: tone(659, 0.1, 'square', 0.14, { freq2: 1318 }),
      error: tone(175, 0.35, 'square', 0.2, { freq2: 185, sweep: 120 }),
      toggle: tone(784, 0.06, 'square', 0.14),
      command: tone(440, 0.12, 'square', 0.15, { freq2: 880 }),
      complete: tone(523, 0.24, 'square', 0.15, { freq2: 784 }),
      notification: tone(659, 0.2, 'square', 0.16, { freq2: 988 }),
      backspace: tone(330, 0.04, 'square', 0.12, { sweep: 220 }),
      toggleSidebar: tone(587, 0.08, 'square', 0.13),
    },
  },
  {
    id: 'glass',
    label: 'Glass',
    basedOn: 'Material Design glass cues (high triangle tones with a long release)',
    events: {
      save: tone(2093, 0.5, 'triangle', 0.12, { freq2: 3136 }),
      open: tone(2637, 0.5, 'triangle', 0.1),
      close: tone(1568, 0.5, 'triangle', 0.1),
      newTab: tone(3136, 0.3, 'triangle', 0.09),
      error: tone(880, 0.4, 'triangle', 0.18, { freq2: 932, sweep: 700 }),
      toggle: tone(3520, 0.16, 'triangle', 0.08),
      command: tone(2349, 0.36, 'triangle', 0.1, { freq2: 3136 }),
      complete: tone(2637, 0.55, 'triangle', 0.11, { freq2: 3520 }),
      notification: tone(3136, 0.55, 'triangle', 0.12, { freq2: 4186 }),
      backspace: tone(1760, 0.12, 'triangle', 0.07),
      toggleSidebar: tone(2093, 0.28, 'triangle', 0.09),
    },
  },
  {
    id: 'wood',
    label: 'Wood',
    basedOn: 'Wood block / kalimba taps (dry percussive knock with a click)',
    events: {
      save: tone(800, 0.09, 'sine', 0.18, { sweep: 600, noise: 0.3 }),
      open: tone(600, 0.09, 'sine', 0.16, { sweep: 450, noise: 0.3 }),
      close: tone(500, 0.08, 'sine', 0.15, { sweep: 380, noise: 0.25 }),
      newTab: tone(1000, 0.07, 'sine', 0.16, { sweep: 780, noise: 0.35 }),
      error: tone(180, 0.2, 'sine', 0.22, { sweep: 140, noise: 0.4 }),
      toggle: tone(900, 0.05, 'sine', 0.13, { noise: 0.3 }),
      command: tone(700, 0.07, 'sine', 0.15, { sweep: 560, noise: 0.3 }),
      complete: tone(1200, 0.14, 'sine', 0.15, { freq2: 1800, noise: 0.25 }),
      notification: tone(1400, 0.12, 'sine', 0.16, { freq2: 2100, noise: 0.2 }),
      backspace: tone(400, 0.05, 'sine', 0.13, { sweep: 300, noise: 0.35 }),
      toggleSidebar: tone(850, 0.08, 'sine', 0.14, { sweep: 650, noise: 0.3 }),
    },
  },
  {
    id: 'marimba',
    label: 'Marimba',
    basedOn: 'VS Code marimba sound extension (fast decay bars a fifth apart)',
    events: {
      save: tone(523, 0.22, 'sine', 0.2, { freq2: 784 }),
      open: tone(587, 0.24, 'sine', 0.19, { freq2: 880 }),
      close: tone(440, 0.2, 'sine', 0.17, { freq2: 659 }),
      newTab: tone(698, 0.16, 'sine', 0.18, { freq2: 1046 }),
      error: tone(233, 0.35, 'sine', 0.22, { freq2: 247 }),
      toggle: tone(880, 0.12, 'sine', 0.16, { freq2: 1318 }),
      command: tone(659, 0.2, 'sine', 0.18, { freq2: 987 }),
      complete: tone(784, 0.32, 'sine', 0.18, { freq2: 1174, delay: 0.05 }),
      notification: tone(880, 0.3, 'sine', 0.19, { freq2: 1318 }),
      backspace: tone(330, 0.1, 'sine', 0.12, { freq2: 494 }),
      toggleSidebar: tone(784, 0.18, 'sine', 0.16, { freq2: 1174 }),
    },
  },
  {
    id: 'pulse',
    label: 'Pulse',
    basedOn: 'Heartbeat / pulse style feedback (low thump with a body tick)',
    events: {
      save: tone(140, 0.12, 'square', 0.2, { freq2: 70, sweep: 70, noise: 0.2 }),
      open: tone(120, 0.1, 'square', 0.18, { freq2: 60, sweep: 60, noise: 0.2 }),
      close: tone(100, 0.1, 'square', 0.16, { freq2: 50, sweep: 50, noise: 0.2 }),
      newTab: tone(180, 0.07, 'square', 0.16, { freq2: 90, noise: 0.3 }),
      error: tone(90, 0.3, 'square', 0.22, { freq2: 45, sweep: 45, noise: 0.15 }),
      toggle: tone(160, 0.06, 'square', 0.15, { freq2: 80, noise: 0.25 }),
      command: tone(150, 0.08, 'square', 0.17, { freq2: 75, noise: 0.25 }),
      complete: tone(160, 0.18, 'square', 0.18, { freq2: 80, noise: 0.2 }),
      notification: tone(170, 0.2, 'square', 0.19, { freq2: 85, noise: 0.2 }),
      backspace: tone(110, 0.05, 'square', 0.14, { freq2: 55, sweep: 60, noise: 0.3 }),
      toggleSidebar: tone(130, 0.1, 'square', 0.16, { freq2: 65, noise: 0.25 }),
    },
  },
  {
    id: 'zen',
    label: 'Zen',
    basedOn: 'Singing bowl / ambient cues (very soft sine with a long fade)',
    events: {
      save: tone(396, 0.6, 'sine', 0.12),
      open: tone(330, 0.6, 'sine', 0.11),
      close: tone(262, 0.6, 'sine', 0.1),
      newTab: tone(440, 0.45, 'sine', 0.09),
      error: tone(196, 0.6, 'sine', 0.16, { freq2: 185 }),
      toggle: tone(330, 0.5, 'sine', 0.09, { freq2: 495 }),
      command: tone(440, 0.55, 'sine', 0.1),
      complete: tone(528, 0.6, 'sine', 0.11, { freq2: 792, delay: 0.04 }),
      notification: tone(440, 0.6, 'sine', 0.12, { freq2: 660 }),
      backspace: tone(220, 0.25, 'sine', 0.07),
      toggleSidebar: tone(294, 0.55, 'sine', 0.1),
    },
  },
  {
    id: 'mechanical',
    label: 'Mechanical',
    basedOn: 'Mechanical keyboard switch sounds (noise burst over a low body tone)',
    events: {
      save: tone(220, 0.06, 'triangle', 0.16, { noise: 0.9 }),
      open: tone(260, 0.06, 'triangle', 0.15, { noise: 0.85 }),
      close: tone(180, 0.06, 'triangle', 0.14, { noise: 0.8 }),
      newTab: tone(300, 0.05, 'triangle', 0.15, { noise: 0.95 }),
      error: tone(120, 0.18, 'sawtooth', 0.2, { noise: 0.5 }),
      toggle: tone(340, 0.045, 'triangle', 0.14, { noise: 0.7 }),
      command: tone(280, 0.055, 'triangle', 0.15, { noise: 0.9 }),
      complete: tone(380, 0.1, 'triangle', 0.15, { freq2: 570, noise: 0.6 }),
      notification: tone(240, 0.09, 'triangle', 0.17, { freq2: 360, noise: 0.9 }),
      backspace: tone(150, 0.04, 'triangle', 0.15, { noise: 0.95 }),
      toggleSidebar: tone(320, 0.05, 'triangle', 0.14, { noise: 0.75 }),
    },
  },
]

const THEME_INDEX = new Map<string, SoundThemeEntry>(SOUND_THEMES.map((theme) => [theme.id, theme]))

/** Look up a theme by id, falling back to the default theme. */
export function soundTheme(id: string): SoundThemeEntry {
  return THEME_INDEX.get(id) ?? THEME_INDEX.get(DEFAULT_SOUND_THEME_ID) ?? SOUND_THEMES[0]
}

/** All theme ids, in display order. */
export function soundThemeIds(): string[] {
  return SOUND_THEMES.map((theme) => theme.id)
}

/* ------------------------------------------------------------------ */
/* Runtime synthesiser                                                 */
/* ------------------------------------------------------------------ */

const ATTACK = 0.005
const MIN_DURATION = 0.02
const MAX_DURATION = 0.6

let audioContext: AudioContext | null = null
let masterGain: GainNode | null = null
let noiseBuffer: AudioBuffer | null = null
let masterVolume = 1
const live = new Set<AudioScheduledSourceNode>()

/** Create (or reuse) the shared AudioContext. Returns null when unavailable. */
function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (audioContext) return audioContext
  try {
    const scope = window as unknown as {
      AudioContext?: typeof AudioContext
      webkitAudioContext?: typeof AudioContext
    }
    const Ctor = scope.AudioContext ?? scope.webkitAudioContext
    if (!Ctor) return null
    const ctx = new Ctor()
    const gain = ctx.createGain()
    gain.gain.value = masterVolume
    gain.connect(ctx.destination)
    audioContext = ctx
    masterGain = gain
    return ctx
  } catch {
    audioContext = null
    masterGain = null
    return null
  }
}

/** A short buffer of white noise, reused for every percussive burst. */
function getNoiseBuffer(ctx: AudioContext): AudioBuffer {
  if (noiseBuffer && noiseBuffer.sampleRate === ctx.sampleRate) return noiseBuffer
  const length = Math.max(1, Math.floor(ctx.sampleRate * 0.5))
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1
  noiseBuffer = buffer
  return buffer
}

/** Remember a source node so `stopSounds` can silence it. */
function track(node: AudioScheduledSourceNode): void {
  live.add(node)
  node.onended = () => {
    live.delete(node)
  }
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.max(min, Math.min(max, value))
}

/**
 * Play an event with the given theme. Never throws.
 *
 * @param event   the UI moment to react to
 * @param themeId id of the theme to use
 * @param volume  0 - 1, applied to the master gain
 */
export function playSound(event: SoundEvent, themeId: string, volume = 1): void {
  try {
    const level = clamp(volume, 0, 1)
    masterVolume = level
    if (level <= 0) return

    const theme = soundTheme(themeId)
    if (theme.id === SILENT_SOUND_THEME_ID) return

    const spec = theme.events[event]
    if (!spec) return

    const ctx = getContext()
    if (!ctx || !masterGain) return

    if (ctx.state === 'suspended') {
      const resumed = ctx.resume()
      if (resumed && typeof resumed.catch === 'function') resumed.catch(() => undefined)
    }

    masterGain.gain.setValueAtTime(level, ctx.currentTime)

    const now = ctx.currentTime
    const start = now + Math.max(0, spec.delay ?? 0)
    const duration = clamp(spec.duration, MIN_DURATION, MAX_DURATION)
    const peak = clamp(spec.gain, 0.01, 0.9)
    const stopAt = start + duration + 0.02

    const env = ctx.createGain()
    env.gain.setValueAtTime(0.0001, start)
    env.gain.exponentialRampToValueAtTime(peak, start + ATTACK)
    env.gain.exponentialRampToValueAtTime(0.0001, start + duration)
    env.connect(masterGain)

    const primary = ctx.createOscillator()
    primary.type = spec.type
    primary.frequency.setValueAtTime(Math.max(1, spec.freq), start)
    if (spec.sweep && spec.sweep > 0) {
      primary.frequency.exponentialRampToValueAtTime(Math.max(1, spec.sweep), start + duration)
    }
    primary.connect(env)
    primary.start(start)
    primary.stop(stopAt)
    track(primary)

    if (spec.freq2 && spec.freq2 > 0) {
      const second = ctx.createOscillator()
      second.type = spec.type
      second.frequency.setValueAtTime(Math.max(1, spec.freq2), start)
      if (spec.sweep && spec.sweep > 0) {
        const ratio = spec.freq2 / Math.max(1, spec.freq)
        second.frequency.exponentialRampToValueAtTime(Math.max(1, spec.sweep * ratio), start + duration)
      }
      const mix = ctx.createGain()
      mix.gain.value = 0.6
      second.connect(mix)
      mix.connect(env)
      second.start(start)
      second.stop(stopAt)
      track(second)
    }

    if (spec.noise && spec.noise > 0) {
      const source = ctx.createBufferSource()
      source.buffer = getNoiseBuffer(ctx)
      const filter = ctx.createBiquadFilter()
      filter.type = 'bandpass'
      filter.frequency.value = clamp(spec.freq * 3, 400, 8000)
      filter.Q.value = 1.2
      const burst = ctx.createGain()
      const burstDur = Math.min(duration, 0.08)
      const burstLevel = Math.max(0.0002, Math.min(1, spec.noise) * peak * 0.9)
      burst.gain.setValueAtTime(0.0001, start)
      burst.gain.exponentialRampToValueAtTime(burstLevel, start + 0.003)
      burst.gain.exponentialRampToValueAtTime(0.0001, start + burstDur)
      source.connect(filter)
      filter.connect(burst)
      burst.connect(masterGain)
      const offset = Math.random() * Math.max(0, source.buffer.duration - burstDur)
      source.start(start, offset, burstDur)
      source.stop(start + burstDur + 0.02)
      track(source)
    }
  } catch {
    // Sound is a nicety: never let it break the app.
  }
}

/** Stop everything (used when the app is muted). */
export function stopSounds(): void {
  try {
    for (const node of live) {
      try {
        node.stop()
      } catch {
        // Already stopped.
      }
      try {
        node.disconnect()
      } catch {
        // Not connected.
      }
    }
    live.clear()
    if (masterGain && audioContext) {
      masterGain.gain.setValueAtTime(masterVolume, audioContext.currentTime)
    }
  } catch {
    // Nothing to stop.
  }
}
