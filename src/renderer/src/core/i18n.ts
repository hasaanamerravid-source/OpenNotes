/**
 * The translation layer of the renderer.
 *
 * The runtime itself lives in `src/shared/i18n` so that the main process can
 * use it as well. This module adds the parts that only the renderer needs:
 * a hook that re-renders when the language changes and the plumbing that
 * tells the document (and the main process) about the new language.
 */

import { useCallback } from 'react'
import {
  DEFAULT_LOCALE,
  formatDate,
  formatNumber,
  formatTime,
  interpolate,
  isLocaleId,
  localeDirection,
  localeInfo,
  LOCALES,
  translate,
  translateWith,
  translationProgress,
  type LocaleId,
  type MessageKey,
  type TranslationParams,
} from '@shared/i18n'
import { useAppStore } from '../store/app'

export type { LocaleId, MessageKey } from '@shared/i18n'
export { LOCALES, localeInfo, translationProgress, formatDate, formatNumber, formatTime }

/** The language of the user interface. */
export function currentLocale(): LocaleId {
  const language = useAppStore.getState().settings.language
  return isLocaleId(language) ? language : DEFAULT_LOCALE
}

/**
 * The text of a key in the language of the user.
 *
 * This function does not subscribe to the store — use {@link useT} inside a
 * component, so that the component is drawn again when the language changes.
 */
export function t(key: MessageKey, params?: TranslationParams): string {
  return translate(currentLocale(), key, params)
}

/**
 * The text of a key, with a fallback for the case that the key is not in the
 * catalogue (a command that was added without a message).
 */
export function tWith(key: MessageKey, fallback: string, params?: TranslationParams): string {
  return translateWith(currentLocale(), key, fallback, params)
}

/**
 * The translator of the interface. The component that uses it is drawn again
 * when the user picks another language.
 */
export function useT(): (key: MessageKey, params?: TranslationParams) => string {
  const language = useAppStore((s) => s.settings.language)
  return useCallback((key: MessageKey, params?: TranslationParams) => translate(language, key, params), [language])
}

/**
 * The translator of the interface with a fallback, for the places where the
 * English text is known already (the menu, the command palette).
 */
export function useTWith(): (key: MessageKey, fallback: string, params?: TranslationParams) => string {
  const language = useAppStore((s) => s.settings.language)
  return useCallback(
    (key: MessageKey, fallback: string, params?: TranslationParams) => translateWith(language, key, fallback, params),
    [language],
  )
}

/**
 * The message of a command. Every command has a message of the shape
 * `cmd.<command id>`.
 */
export function commandKey(id: string): MessageKey {
  return `cmd.${id}` as MessageKey
}

/**
 * The message of a section of the main menu. Every section has a message of
 * the shape `menu.<section id>`.
 */
export function sectionKey(id: string): MessageKey {
  return `menu.${id}` as MessageKey
}

/** The language of the user interface, as a component friendly value. */
export function useLocale(): LocaleId {
  const language = useAppStore((s) => s.settings.language)
  return isLocaleId(language) ? language : DEFAULT_LOCALE
}

/**
 * Tell the document which language it is in and in which direction it is
 * written. The direction is what makes a right-to-left language look right.
 */
export function applyDocumentLocale(locale: string | undefined): void {
  const info = localeInfo(locale)
  const root = document.documentElement
  root.lang = info.tag
  root.dir = info.direction
  root.dataset.locale = info.id
}

/** Change the language of the interface and remember it. */
export async function setLocale(locale: LocaleId): Promise<void> {
  const store = useAppStore.getState()
  store.setSettings({ language: locale })
  applyDocumentLocale(locale)
  await store.saveSettings()
  // The native menu lives in the main process: it has to be rebuilt there.
  try {
    await window.api.menu.setLocale(locale)
  } catch {
    /* the menu is a nice-to-have, the interface works without it */
  }
}

/** Put the values into a text that was built by hand. */
export { interpolate }
