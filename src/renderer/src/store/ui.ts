import { create } from 'zustand'

export interface PromptRequest {
  title: string
  message?: string
  defaultValue?: string
  placeholder?: string
  resolve: (value: string | null) => void
}

export interface ConfirmRequest {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  resolve: (value: boolean) => void
}

interface UiState {
  prompt: PromptRequest | null
  confirm: ConfirmRequest | null
  ask: (opts: {
    title: string
    message?: string
    defaultValue?: string
    placeholder?: string
  }) => Promise<string | null>
  askConfirm: (opts: {
    title: string
    message: string
    confirmLabel?: string
    cancelLabel?: string
  }) => Promise<boolean>
  closePrompt: () => void
  closeConfirm: () => void
}

export const useUiStore = create<UiState>((set, get) => ({
  prompt: null,
  confirm: null,

  ask: (opts) =>
    new Promise<string | null>((resolve) => {
      set({ prompt: { ...opts, resolve } })
    }),

  askConfirm: (opts) =>
    new Promise<boolean>((resolve) => {
      set({ confirm: { ...opts, resolve } })
    }),

  closePrompt: () => {
    const current = get().prompt
    set({ prompt: null })
    current?.resolve(null)
  },

  closeConfirm: () => {
    const current = get().confirm
    set({ confirm: null })
    current?.resolve(false)
  },
}))

/** Convenience helper: ask a question and resolve with the answer. */
export async function ask(title: string, message?: string, defaultValue = ''): Promise<string | null> {
  return useUiStore.getState().ask({ title, message, defaultValue })
}

export async function confirm(title: string, message: string, confirmLabel = 'OK'): Promise<boolean> {
  return useUiStore.getState().askConfirm({ title, message, confirmLabel })
}
