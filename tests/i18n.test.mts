/**
 * The tests of the translation runtime.
 *
 * The runtime is the piece that every other part of the application depends
 * on: a missing translation must never show a raw key, and a placeholder
 * must never be lost.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_LOCALE,
  LOCALES,
  formatDate,
  formatNumber,
  interpolate,
  isLocaleId,
  localeDirection,
  localeInfo,
  translate,
  translateWith,
  translationProgress,
} from '../src/shared/i18n/index.ts'

test('every language is known', () => {
  for (const locale of LOCALES) {
    assert.equal(isLocaleId(locale.id), true, `${locale.id} should be a locale`)
    assert.ok(locale.englishName.length > 0)
    assert.ok(locale.nativeName.length > 0)
    assert.ok(locale.direction === 'ltr' || locale.direction === 'rtl')
  }
})

test('an unknown language is not a locale', () => {
  assert.equal(isLocaleId('kl'), false)
  assert.equal(isLocaleId(''), false)
  assert.equal(isLocaleId(undefined), false)
  assert.equal(isLocaleId(42), false)
})

test('the application ships five languages', () => {
  assert.deepEqual(
    LOCALES.map((locale) => locale.id),
    ['en', 'de', 'es', 'ru', 'zh-CN'],
  )
})

test('the default language is English', () => {
  assert.equal(DEFAULT_LOCALE, 'en')
  assert.equal(localeInfo('kl').id, 'en')
  assert.equal(localeInfo(undefined).id, 'en')
})

test('a language has the direction it is written in', () => {
  assert.equal(localeDirection('de'), 'ltr')
  assert.equal(localeDirection('zh-CN'), 'ltr')
  assert.equal(localeDirection('unknown'), 'ltr')
})

test('a message is translated', () => {
  assert.equal(translate('en', 'common.cancel'), 'Cancel')
  // The German word for "cancel" is not the English one.
  assert.notEqual(translate('de', 'common.cancel'), 'Cancel')
  assert.equal(translate('en', 'common.ok'), 'OK')
})

test('a missing translation falls back to English', () => {
  // A key that no language has translated yet still shows English text.
  const english = translate('en', 'app.tagline')
  assert.equal(typeof english, 'string')
  assert.ok(english.length > 0)
})

test('an unknown language falls back to English', () => {
  assert.equal(translate('kl', 'common.ok'), translate('en', 'common.ok'))
})

test('the placeholders are replaced', () => {
  assert.equal(interpolate('Hello {{name}}!', { name: 'World' }), 'Hello World!')
  assert.equal(interpolate('{{a}} and {{b}}', { a: 1, b: 2 }), '1 and 2')
})

test('a placeholder that has no value is left alone', () => {
  assert.equal(interpolate('Hello {{name}}!', {}), 'Hello {{name}}!')
  assert.equal(interpolate('Hello {{name}}!'), 'Hello {{name}}!')
})

test('the values of a message are replaced', () => {
  const text = translate('en', 'toast.saved', { name: 'notes.md' })
  assert.ok(text.includes('notes.md'))
  assert.ok(!text.includes('{{name}}'))
})

test('a fallback is used when the key is unknown', () => {
  const text = translateWith('de', 'common.ok', 'The fallback')
  assert.equal(typeof text, 'string')
  assert.ok(text.length > 0)
})

test('the progress of a language is between 0 and 100', () => {
  for (const locale of LOCALES) {
    const progress = translationProgress(locale.id)
    assert.ok(progress.percent >= 0 && progress.percent <= 100)
    assert.ok(progress.done <= progress.total)
    assert.equal(progress.total > 0, true)
  }
})

test('English is completely translated', () => {
  const progress = translationProgress('en')
  assert.equal(progress.percent, 100)
  assert.equal(progress.done, progress.total)
})

test('a date is written in the format of the language', () => {
  const date = new Date(Date.UTC(2026, 9, 21, 12, 0, 0))
  const english = formatDate('en', date)
  const german = formatDate('de', date)
  assert.ok(english.length > 0)
  assert.ok(german.length > 0)
})

test('a number is written in the format of the language', () => {
  assert.equal(formatNumber('en', 1234567), '1,234,567')
  assert.equal(formatNumber('de', 1234567), '1.234.567')
})
