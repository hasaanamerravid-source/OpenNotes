/**
 * The state of the project wide search.
 *
 * The search itself runs in the main process (`src/main/ipc/search.ts`), so a
 * big folder never blocks the editor.
 */

import { create } from 'zustand'

/** One hit of the search. */
export interface ProjectMatch {
  path: string
  line: number
  column: number
  text: string
}

/** How the search looks for the text. */
export interface SearchOptions {
  /** The search text is a regular expression. */
  regex: boolean
  /** The case matters. */
  caseSensitive: boolean
  /** The whole word has to match. */
  wholeWord: boolean
  /** Only these files are searched (e.g. `*.ts`). */
  include: string
}

/** The state of the search. */
export interface ProjectSearchState {
  query: string
  replacement: string
  options: SearchOptions
  matches: ProjectMatch[]
  searching: boolean
  /** The folder that was searched. */
  folder: string
  /** How many files were read. */
  files: number
  /** How long the search took (milliseconds). */
  took: number
  /** The message of the last error. */
  error: string | null
  setQuery: (query: string) => void
  setReplacement: (replacement: string) => void
  setOptions: (options: Partial<SearchOptions>) => void
  search: (folder: string) => Promise<void>
  replace: (folder: string) => Promise<void>
  clear: () => void
}

/** The bridge to the main process. */
interface SearchBridge {
  search?: (request: unknown) => Promise<{ matches?: ProjectMatch[]; files?: number; took?: number; error?: string }>
  replaceInFiles?: (request: unknown) => Promise<{ changed?: number; replaced?: number; took?: number; error?: string }>
}

/** The bridge, if the preload exposes it. */
function bridge(): SearchBridge | undefined {
  if (typeof window === 'undefined') return undefined
  try {
    const api = window.api as unknown as { fs?: SearchBridge } | undefined
    return api?.fs
  } catch {
    return undefined
  }
}

/** The number of the requests that were started (the old ones are dropped). */
let sequence = 0

export const useProjectSearchStore = create<ProjectSearchState>((set, get) => ({
  query: '',
  replacement: '',
  options: { regex: false, caseSensitive: false, wholeWord: false, include: '' },
  matches: [],
  searching: false,
  folder: '',
  files: 0,
  took: 0,
  error: null,

  setQuery: (query) => set({ query }),
  setReplacement: (replacement) => set({ replacement }),
  setOptions: (options) => set({ options: { ...get().options, ...options } }),

  search: async (folder: string) => {
    const { query, options } = get()
    if (!query.trim() || !folder) {
      set({ matches: [], files: 0, took: 0, error: null })
      return
    }
    const token = ++sequence
    set({ searching: true, error: null })
    try {
      const api = bridge()
      const result = await api?.search?.({
        folder,
        query,
        ...options,
      })
      if (token !== sequence) return
      set({
        matches: result?.matches ?? [],
        files: result?.files ?? 0,
        took: result?.took ?? 0,
        searching: false,
        error: result?.error ?? null,
      })
    } catch (error) {
      if (token !== sequence) return
      set({ searching: false, error: error instanceof Error ? error.message : String(error) })
    }
  },

  replace: async (folder: string) => {
    const { query, replacement, options } = get()
    if (!query.trim() || !folder) return
    const token = ++sequence
    set({ searching: true, error: null })
    try {
      const api = bridge()
      const result = await api?.replaceInFiles?.({
        folder,
        query,
        replacement,
        ...options,
      })
      if (token !== sequence) return
      set({ searching: false, error: result?.error ?? null })
      await get().search(folder)
    } catch (error) {
      if (token !== sequence) return
      set({ searching: false, error: error instanceof Error ? error.message : String(error) })
    }
  },

  clear: () => set({ matches: [], files: 0, took: 0, error: null }),
}))
