import { create } from 'zustand'

export interface StatusState {
  line: number
  col: number
  selChars: number
  selLines: number
  totalLines: number
  totalChars: number
  words: number
  mode: string
  language: string
  encoding: string
  eol: string
  dirty: boolean
  zoom: number
  /** True while the window is maximised. */
  maximized: boolean
  set: (patch: Partial<StatusState>) => void
  reset: () => void
}

const initial = {
  line: 1,
  col: 1,
  selChars: 0,
  selLines: 0,
  totalLines: 1,
  totalChars: 0,
  words: 0,
  mode: 'code',
  language: 'text',
  encoding: 'utf8',
  eol: '\n',
  dirty: false,
  zoom: 100,
  maximized: false,
}

export const useStatusStore = create<StatusState>((set) => ({
  ...initial,
  set: (patch) => set(patch),
  reset: () => set({ ...initial }),
}))
