import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import { useAppStore } from './store/app'
import { runCommand, getCommands } from './core/commands'
import { currentProblems } from './core/useProblems'
import { getEditor } from './core/editors'
import './styles/app.css'
import './styles/appearance.css'
import './core/syntaxThemes.css'

const container = document.getElementById('root')
if (!container) throw new Error('Root container missing')

// A small scripting surface: handy for power users and for automated checks.
;(window as unknown as { opennotes: unknown }).opennotes = {
  store: useAppStore,
  run: runCommand,
  setState: (patch: Record<string, unknown>) => useAppStore.setState(patch as never),
  commands: { list: getCommands },
  get problems() {
    return currentProblems()
  },
  get editor() {
    return getEditor(useAppStore.getState().activeTabId)
  },
}

createRoot(container).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
