/**
 * Language registry.
 *
 * The actual modes live in `languageModes.ts`; this module keeps the historic
 * import path working and re-exports the public API.
 */
export {
  LANGUAGE_LABELS,
  LANGUAGE_IDS,
  LANGUAGE_GROUPS,
  POPULAR_LANGUAGE_IDS,
  languageExtension,
  languageLabel,
  languageGroup,
  type LanguageGroup,
} from './languageModes'
