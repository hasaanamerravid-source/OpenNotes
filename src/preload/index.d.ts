import type { OpenNotesApi } from './index'

declare global {
  interface Window {
    api: OpenNotesApi
  }
}

export {}
