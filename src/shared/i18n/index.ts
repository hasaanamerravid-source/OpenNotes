/**
 * The translation runtime.
 *
 * The module is deliberately free of any framework or Electron dependency so
 * that the main process (native menu), the preload bridge and the renderer can
 * all use it.
 *
 * A missing translation is not an error: the English text is used instead.
 */

import { en, type MessageKey } from './en'
import de from './locales/de.json'
import es from './locales/es.json'
import ru from './locales/ru.json'
import zhCN from './locales/zh-CN.json'

export type { MessageKey } from './en'

/**
 * A catalogue as it is written in a JSON file.
 *
 * The keys of the file are checked against the English catalogue by
 * `npm run i18n:check`: a key that does not exist there is an error, and a key
 * that is missing falls back to the English text.
 */
export type Catalogue = Partial<Record<MessageKey, string>>

/** Check that a JSON catalogue only holds known keys. */
function asCatalogue(value: Record<string, string>): Catalogue {
  return value as Catalogue
}

/** Values that can be put into a message. */
export type TranslationValue = string | number

/** The values that are put into a message. */
export type TranslationParams = Record<string, TranslationValue>

/** The languages the user interface is available in. */
export type LocaleId = 'en' | 'de' | 'es' | 'ru' | 'zh-CN'

/** The direction a language is written in. */
export type TextDirection = 'ltr' | 'rtl'

/** Everything the settings dialog needs to show a language. */
export interface LocaleInfo {
  id: LocaleId
  /** The name of the language in English. */
  englishName: string
  /** The name of the language in the language itself. */
  nativeName: string
  direction: TextDirection
  /** The language the text is written in, as an ISO code. */
  tag: string
}

/** Every language, in the order they are offered. */
export const LOCALES: LocaleInfo[] = [
  { id: 'en', englishName: 'English', nativeName: 'English', direction: 'ltr', tag: 'en' },
  { id: 'de', englishName: 'German', nativeName: 'Deutsch', direction: 'ltr', tag: 'de' },
  { id: 'es', englishName: 'Spanish', nativeName: 'Español', direction: 'ltr', tag: 'es' },
  { id: 'ru', englishName: 'Russian', nativeName: 'Русский', direction: 'ltr', tag: 'ru' },
  { id: 'zh-CN', englishName: 'Chinese (Simplified)', nativeName: '简体中文', direction: 'ltr', tag: 'zh-CN' },
]

/** The language that is used when nothing else is known. */
export const DEFAULT_LOCALE: LocaleId = 'en'

/** The catalogues of every language. */
const CATALOGUES: Record<LocaleId, Catalogue> = {
  en,
  de: asCatalogue(de),
  es: asCatalogue(es),
  ru: asCatalogue(ru),
  'zh-CN': asCatalogue(zhCN),
}

/** Is the given string a language the application knows? */
export function isLocaleId(value: unknown): value is LocaleId {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(CATALOGUES, value)
}

/** The information of a language (the fallback language when it is unknown). */
export function localeInfo(locale: string | undefined): LocaleInfo {
  const found = LOCALES.find((l) => l.id === locale)
  return found ?? LOCALES[0]
}

/** The direction a language is written in. */
export function localeDirection(locale: string | undefined): TextDirection {
  return localeInfo(locale).direction
}

/**
 * Put the values into the text. `{{name}}` becomes the value of `name`.
 */
export function interpolate(template: string, params?: TranslationParams): string {
  if (!params) return template
  return template.replace(/\{\{(\w+)\}\}/g, (match, name: string) => {
    const value = params[name]
    return value === undefined ? match : String(value)
  })
}

/**
 * The text of a key in a language. English is used for every key that has not
 * been translated yet, so a missing translation never shows a raw key.
 */
export function translate(locale: string | undefined, key: MessageKey, params?: TranslationParams): string {
  const catalogue = isLocaleId(locale) ? CATALOGUES[locale] : undefined
  const text = catalogue?.[key] ?? en[key] ?? key
  return interpolate(text, params)
}

/** The text of a key, with a fallback for keys that are not in the catalogue. */
export function translateWith(
  locale: string | undefined,
  key: MessageKey,
  fallback: string,
  params?: TranslationParams,
): string {
  const catalogue = isLocaleId(locale) ? CATALOGUES[locale] : undefined
  const text = catalogue?.[key]
  if (!text) return interpolate(fallback, params)
  return interpolate(text, params)
}

/** How much of a language is translated. */
export interface TranslationProgress {
  /** Number of translated strings. */
  done: number
  /** Number of strings in the catalogue. */
  total: number
  /** The share of translated strings, 0 - 100. */
  percent: number
}

/** How much of a language is translated (English is always complete). */
export function translationProgress(locale: string | undefined): TranslationProgress {
  const total = Object.keys(en).length
  if (!isLocaleId(locale) || locale === 'en') {
    return { done: total, total, percent: 100 }
  }
  const catalogue = CATALOGUES[locale]
  const done = Object.keys(catalogue).filter((key) => Boolean(catalogue[key as MessageKey])).length
  const percent = total === 0 ? 100 : Math.round((done / total) * 100)
  return { done, total, percent }
}

/** A date in the format of the language. */
export function formatDate(
  locale: string | undefined,
  value: number | Date,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' },
): string {
  const date = value instanceof Date ? value : new Date(value)
  try {
    return new Intl.DateTimeFormat(localeInfo(locale).tag, options).format(date)
  } catch {
    return date.toISOString().slice(0, 10)
  }
}

/** A time in the format of the language. */
export function formatTime(
  locale: string | undefined,
  value: number | Date,
  options: Intl.DateTimeFormatOptions = { timeStyle: 'short' },
): string {
  const date = value instanceof Date ? value : new Date(value)
  try {
    return new Intl.DateTimeFormat(localeInfo(locale).tag, options).format(date)
  } catch {
    return date.toISOString().slice(11, 16)
  }
}

/** A number in the format of the language. */
export function formatNumber(locale: string | undefined, value: number, options?: Intl.NumberFormatOptions): string {
  try {
    return new Intl.NumberFormat(localeInfo(locale).tag, options).format(value)
  } catch {
    return String(value)
  }
}
