import { useEffect, useMemo, useState } from 'react'
import { useAppStore } from '../store/app'
import { getView } from './views'
import { applyProblems, collectProblems, type Problem } from './diagnostics'
import { asProblems, lspProblemsForPath } from './lspIntegration'
import { useLspStore } from './lspState'
import { useReferenceStore } from './lspCommands'
import { readProjectConfig, resolveServers, projectFolder } from './projectConfig'

/** The problems of the last check, so other parts (and the tests) can read them. */
let latestProblems: Problem[] = []

/**
 * The key of the last check. The problems are shown in three places (the
 * bottom panel, the sidebar and the status bar) and all of them ask for the
 * same check - it must only run once.
 */
let lastKey = ''

/** Everyone who wants to know the problems of the active file. */
const listeners = new Set<(problems: Problem[]) => void>()

/** Hand the problems to everyone who shows them. */
function publish(problems: Problem[]): void {
  latestProblems = problems
  for (const listener of listeners) {
    try {
      listener(problems)
    } catch {
      /* a listener must never break the check */
    }
  }
}

/** The problems that were detected last. */
export function currentProblems(): Problem[] {
  return latestProblems
}

/**
 * Collects the problems of the active file and marks them in the editor.
 * The check runs a moment after the last change so typing stays smooth.
 *
 * The problems of the language servers are merged in: they are the ones that
 * know the types, the unused imports and the wrong calls.
 */
export function useProblems(): Problem[] {
  const activeTabId = useAppStore((s) => s.activeTabId)
  const content = useAppStore((s) => s.tabs.find((t) => t.id === s.activeTabId)?.content ?? '')
  const language = useAppStore((s) => s.tabs.find((t) => t.id === s.activeTabId)?.language ?? 'text')
  const large = useAppStore((s) => s.tabs.find((t) => t.id === s.activeTabId)?.largeFile ?? false)
  const path = useAppStore((s) => s.tabs.find((t) => t.id === s.activeTabId)?.path ?? '')
  const lspProblems = useLspProblems(path)
  const referenceProblems = useReferenceStore((s) => s.problems)
  const [problems, setProblems] = useState<Problem[]>(latestProblems)

  useEffect(() => {
    const listener = (found: Problem[]): void => setProblems(found)
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }, [])

  useEffect(() => {
    if (large) {
      publish([])
      return
    }
    const timer = window.setTimeout(() => {
      const key = `${activeTabId}:${language}:${content.length}`
      // Another place already checked the same document.
      if (key === lastKey) return
      lastKey = key
      const view = getView(activeTabId)
      if (!view) {
        publish([])
        return
      }
      const found = collectProblems(view, language)
      publish(found)
      applyProblems(view, found)
    }, 350)
    return () => window.clearTimeout(timer)
  }, [activeTabId, content, language, large])

  // The problems of the language server are shown next to the syntax errors.
  const all = [...problems, ...lspProblems]
  return referenceProblems.length ? [...all, ...referenceProblems] : all
}

/** The problems that the language servers published for a file. */
function useLspProblems(path: string): Problem[] {
  const problems = useLspStore((s) => s.problems)
  return useMemo(() => asProblems(lspProblemsForPath(path)), [problems, path])
}

/**
 * The language servers of the project: the plain text file of the project
 * wins over the global settings. The main process is told about them, so that
 * it starts the right program.
 *
 * The folder of the project is the one from the settings; when it is empty
 * the folder of the open file is used, so that a project with a
 * `.opennotes.json` works without any configuration.
 */
export function useLspConfiguration(): void {
  const configured = useAppStore((s) => s.settings.projectFolder)
  const globals = useAppStore((s) => s.settings.lspServers)
  const activePath = useAppStore((s) => s.tabs.find((t) => t.id === s.activeTabId)?.path ?? '')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const folder = configured ?? projectFolder()
      const project = folder ? await readProjectConfig(folder) : null
      if (cancelled) return
      const servers = resolveServers(project, globals ?? {})
      try {
        await window.api.lsp?.configure?.({ servers, rootPath: folder ?? null })
      } catch {
        /* the language servers are optional */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [configured, globals, activePath])
}
