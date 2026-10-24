/**
 * Language server state (renderer).
 *
 * The main process owns the language servers. The renderer only sends the
 * documents to them and collects what comes back:
 *
 * - the problems of a document (the problems panel shows them),
 * - the state of every server ("starting", "ready", "error", "stopped").
 *
 * Expected preload shape (the preload owner adds this binding):
 *
 *   lsp: {
 *     start(languages: string[]): Promise<string[]>
 *     didOpen(params: { language: string; uri: string; text: string }): Promise<boolean>
 *     didChange(params: { language: string; uri: string; text: string }): Promise<boolean>
 *     didClose(params: { language: string; uri: string }): Promise<boolean>
 *     request<T>(params: { language: string; method: string; params?: unknown }): Promise<T | null>
 *     stop(language?: string): Promise<boolean>
 *     onDiagnostics(cb: (event: { language: string; uri: string; problems: LspProblem[] }) => void): () => void
 *     onStatus(cb: (event: { language: string; state: LspServerState; message?: string }) => void): () => void
 *   }
 *
 * The binding does not exist in every build, so every call is guarded and the
 * module stays usable (and importable) without a browser window.
 */

import { create } from 'zustand'

/** What a language server is doing right now. */
export type LspServerState = 'starting' | 'ready' | 'error' | 'stopped'

/** A problem of a document (the shape the problems panel expects). */
export interface LspProblem {
  /** 1 based line number. */
  line: number
  /** 1 based column. */
  column: number
  /** Character offset in the document. */
  from: number
  /** Character offset in the document. */
  to: number
  severity: 'error' | 'warning' | 'info'
  message: string
  /** The short code of the problem ("ts", "eslint", ...). */
  source: string
  /** The document the problem belongs to. */
  uri: string
}

/** The event of the main process that carries the problems of a document. */
export interface LspDiagnosticsEvent {
  language: string
  uri: string
  problems: LspProblem[]
}

/** The event of the main process that tells what a server is doing. */
export interface LspStatusEvent {
  language: string
  state: LspServerState
  message?: string
}

/** The state of the language servers. */
export interface LspState {
  /** Problems per language, keyed by the document uri. */
  problems: Record<string, LspProblem[]>
  /** Status per language. */
  status: Record<string, { state: LspServerState; message?: string }>
  /** Whether the user wants the language server for a language. */
  enabled: Record<string, boolean>
  open: (language: string, uri: string, text: string) => void
  change: (language: string, uri: string, text: string) => void
  close: (language: string, uri: string) => void
  request: <T>(language: string, method: string, params: unknown) => Promise<T | null>
  setEnabled: (language: string, enabled: boolean) => void
  problemsFor: (uri: string) => LspProblem[]
}

/**
 * The languages that know a language server.
 *
 * The list is used by the settings (the command of every language can be
 * replaced). TypeScript and JavaScript share one server, C and C++ as well.
 */
export const LSP_LANGUAGES: string[] = [
  'typescript',
  'javascript',
  'python',
  'go',
  'rust',
  'java',
  'csharp',
  'c',
  'cpp',
  'php',
  'ruby',
  'kotlin',
  'swift',
  'lua',
]

/* ------------------------------------------------------------------ *
 * The bridge
 * ------------------------------------------------------------------ */

/** The part of the preload that talks to the language servers. */
interface LspBridge {
  start?: (languages: string[]) => Promise<unknown> | unknown
  didOpen?: (params: { language: string; uri: string; text: string }) => Promise<unknown> | unknown
  didChange?: (params: { language: string; uri: string; text: string }) => Promise<unknown> | unknown
  didClose?: (params: { language: string; uri: string }) => Promise<unknown> | unknown
  request?: (params: { language: string; method: string; params?: unknown }) => Promise<unknown> | unknown
  stop?: (language?: string) => Promise<unknown> | unknown
  onDiagnostics?: (cb: (event: LspDiagnosticsEvent) => void) => (() => void) | void
  onStatus?: (cb: (event: LspStatusEvent) => void) => (() => void) | void
}

/** The bridge, if the preload exposes it. */
function lspBridge(): LspBridge | undefined {
  if (typeof window === 'undefined') return undefined
  try {
    const api = window.api as unknown as { lsp?: LspBridge } | undefined
    return api?.lsp
  } catch {
    return undefined
  }
}

/** Call a function of the bridge without ever throwing. */
function call(fn: (() => unknown) | undefined): void {
  if (typeof fn !== 'function') return
  try {
    const result: unknown = fn()
    if (result && typeof (result as Promise<unknown>).then === 'function') {
      void (result as Promise<unknown>).catch(() => undefined)
    }
  } catch {
    /* the bridge is not there (yet) */
  }
}

/* ------------------------------------------------------------------ *
 * The store
 * ------------------------------------------------------------------ */

/** The language of every open document (the problems belong to it). */
const uriLanguage: Record<string, string> = {}

export const useLspStore = create<LspState>((set, get) => ({
  problems: {},
  status: {},
  enabled: {},

  open: (language, uri, text) => {
    if (!language || !uri) return
    subscribe()
    uriLanguage[uri] = language
    const bridge = lspBridge()
    call(() => bridge?.didOpen?.({ language, uri, text }))
  },

  change: (language, uri, text) => {
    if (!language || !uri) return
    subscribe()
    uriLanguage[uri] = language
    const bridge = lspBridge()
    call(() => bridge?.didChange?.({ language, uri, text }))
  },

  close: (language, uri) => {
    if (!uri) return
    subscribe()
    delete uriLanguage[uri]
    // The problems of a closed document are gone.
    set((s) => {
      if (!s.problems[uri]) return {}
      const problems = { ...s.problems }
      delete problems[uri]
      return { problems }
    })
    const bridge = lspBridge()
    call(() => bridge?.didClose?.({ language, uri }))
  },

  request: async <T>(language: string, method: string, params: unknown): Promise<T | null> => {
    const bridge = lspBridge()
    if (typeof bridge?.request !== 'function') return null
    try {
      const result = await bridge.request({ language, method, params })
      return (result ?? null) as T | null
    } catch {
      return null
    }
  },

  setEnabled: (language, enabled) => {
    if (!language) return
    set((s) => ({ enabled: { ...s.enabled, [language]: enabled } }))
    const bridge = lspBridge()
    if (enabled) {
      subscribe()
      call(() => bridge?.start?.([language]))
      return
    }
    // The server is stopped and the problems of its documents are dropped.
    const dropped = Object.keys(uriLanguage).filter((uri) => uriLanguage[uri] === language)
    for (const uri of dropped) delete uriLanguage[uri]
    set((s) => {
      if (dropped.length === 0) return {}
      const problems = { ...s.problems }
      for (const uri of dropped) delete problems[uri]
      return { problems }
    })
    call(() => bridge?.stop?.(language))
  },

  problemsFor: (uri) => get().problems[uri] ?? [],
}))

/* ------------------------------------------------------------------ *
 * The events of the main process
 * ------------------------------------------------------------------ */

/** The server published the problems of a document. */
function handleDiagnostics(event: LspDiagnosticsEvent): void {
  if (!event || typeof event.uri !== 'string') return
  const list = Array.isArray(event.problems) ? event.problems : []
  const problems = list.map((problem) => ({ ...problem, uri: event.uri }))
  useLspStore.setState((s) => ({ problems: { ...s.problems, [event.uri]: problems } }))
}

/** The state of a server changed. */
function handleStatus(event: LspStatusEvent): void {
  if (!event || typeof event.language !== 'string') return
  const status: { state: LspServerState; message?: string } = { state: event.state }
  if (event.message) status.message = event.message
  useLspStore.setState((s) => ({ status: { ...s.status, [event.language]: status } }))
}

let dispose: (() => void) | null = null

/** Listen to the events of the main process (only once). */
function subscribe(): void {
  if (dispose) return
  const bridge = lspBridge()
  if (!bridge) return
  try {
    const offDiagnostics = bridge.onDiagnostics?.(handleDiagnostics)
    const offStatus = bridge.onStatus?.(handleStatus)
    const stops: (() => void)[] = []
    if (typeof offDiagnostics === 'function') stops.push(offDiagnostics)
    if (typeof offStatus === 'function') stops.push(offStatus)
    // The binding has no events yet - the subscription is tried again later.
    if (stops.length === 0) return
    dispose = (): void => {
      for (const stop of stops) {
        try {
          stop()
        } catch {
          /* the window is gone */
        }
      }
    }
  } catch {
    dispose = null
  }
}

// The subscription starts as soon as the module is loaded, so that the
// problems of a server that was started elsewhere still show up. Importing
// the module without a browser (tests, scripts) must not throw.
if (typeof window !== 'undefined') {
  subscribe()
}

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

/** The problems of a document (without a React hook). */
export function lspProblemsFor(uri: string): LspProblem[] {
  return useLspStore.getState().problems[uri] ?? []
}

/** The state of the server of a language (without a React hook). */
export function lspStatusFor(language: string): { state: LspServerState; message?: string } | undefined {
  return useLspStore.getState().status[language]
}
