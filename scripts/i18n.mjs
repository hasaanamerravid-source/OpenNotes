/**
 * The translation toolkit.
 *
 *   node scripts/i18n.mjs template            write a template for a new language
 *   node scripts/i18n.mjs check               check every language file
 *   node scripts/i18n.mjs coverage [locale]   how much is translated
 *
 * The English catalogue (`src/shared/i18n/en.ts`) is the source of truth. The
 * other languages are plain JSON files; a key that is missing falls back to
 * English, a key that is unknown is an error.
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const i18nDir = resolve(root, 'src', 'shared', 'i18n')
const localesDir = resolve(i18nDir, 'locales')
const enFile = resolve(i18nDir, 'en.ts')

/** Read the English catalogue out of the TypeScript source. */
function readEnglish() {
  const source = readFileSync(enFile, 'utf8')
  const body = source.slice(source.indexOf('export const en = {'), source.indexOf('} as const'))
  const entries = []
  const re = /^\s{2}'([^']+)':\s*'((?:[^'\\]|\\.)*)',?\s*$/gm
  let match
  while ((match = re.exec(body))) {
    entries.push([match[1], match[2].replace(/\\'/g, "'").replace(/\\\\/g, '\\')])
  }
  if (!entries.length) throw new Error('no messages found in ' + enFile)
  return entries
}

const english = readEnglish()
const keys = english.map(([key]) => key)
const englishMap = new Map(english)

/** Every language file that is present. */
function localeFiles() {
  if (!existsSync(localesDir)) return []
  return readdirSync(localesDir)
    .filter((name) => name.endsWith('.json'))
    .sort()
}

function command() {
  const action = process.argv[2] ?? 'check'

  if (action === 'template') {
    const target = process.argv[3]
    if (!target) {
      console.error('usage: node scripts/i18n.mjs template <locale-id>')
      process.exit(1)
    }
    const file = resolve(localesDir, `${target}.json`)
    const catalogue = {}
    for (const [key, value] of english) catalogue[key] = value
    writeFileSync(file, JSON.stringify(catalogue, null, 2) + '\n', 'utf8')
    console.log(`wrote ${file} (${keys.length} keys)`)
    return
  }

  if (action === 'check') {
    let problems = 0
    for (const name of localeFiles()) {
      const file = resolve(localesDir, name)
      let data
      try {
        data = JSON.parse(readFileSync(file, 'utf8'))
      } catch (err) {
        console.error(`FAIL ${name}: ${err.message}`)
        problems++
        continue
      }
      const unknown = Object.keys(data).filter((key) => !englishMap.has(key))
      const missing = keys.filter((key) => !(key in data))
      const empty = Object.keys(data).filter((key) => typeof data[key] !== 'string' || !data[key].trim())
      const placeholders = []
      for (const [key, value] of Object.entries(data)) {
        const wanted = new Set((englishMap.get(key) ?? '').match(/\{\{\w+\}\}/g) ?? [])
        const got = new Set(String(value).match(/\{\{\w+\}\}/g) ?? [])
        for (const token of wanted) {
          if (!got.has(token)) placeholders.push(`${key} (${token})`)
        }
      }
      const percent = Math.round(((keys.length - missing.length) / keys.length) * 100)
      const status = unknown.length || empty.length || placeholders.length ? 'WARN' : ' ok '
      console.log(
        `${status} ${name.padEnd(12)} ${String(percent).padStart(3)}%  ${keys.length - missing.length}/${keys.length} keys`,
      )
      if (unknown.length) {
        console.log('     unknown keys: ' + unknown.join(', '))
        problems++
      }
      if (empty.length) {
        console.log('     empty values: ' + empty.join(', '))
        problems++
      }
      if (placeholders.length) {
        console.log('     missing placeholders: ' + placeholders.join(', '))
        problems++
      }
    }
    if (problems) {
      console.error(`\n${problems} problem(s) found`)
      process.exit(1)
    }
    console.log('\nevery language file is consistent with the English catalogue')
    return
  }

  if (action === 'missing') {
    // The keys of a language that have not been translated yet, with the
    // English text, so that a translator only has to fill in the value.
    const target = process.argv[3]
    if (!target) {
      console.error('usage: node scripts/i18n.mjs missing <locale>')
      process.exit(1)
    }
    const file = resolve(localesDir, `${target}.json`)
    const data = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {}
    const missing = {}
    for (const [key, value] of english) {
      if (!(key in data)) missing[key] = value
    }
    console.log(JSON.stringify(missing, null, 2))
    return
  }

  if (action === 'fill') {
    // Merge a file of translations into a language file:
    //   node scripts/i18n.mjs fill de translations-de.json
    const target = process.argv[3]
    const source = process.argv[4]
    if (!target || !source) {
      console.error('usage: node scripts/i18n.mjs fill <locale> <translations.json>')
      process.exit(1)
    }
    const file = resolve(localesDir, `${target}.json`)
    const data = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {}
    const additions = JSON.parse(readFileSync(resolve(source), 'utf8'))
    let added = 0
    let skipped = 0
    for (const [key, value] of Object.entries(additions)) {
      if (!englishMap.has(key)) {
        console.error(`unknown key: ${key}`)
        skipped++
        continue
      }
      if (typeof value !== 'string' || !value.trim()) {
        console.error(`empty value: ${key}`)
        skipped++
        continue
      }
      data[key] = value
      added++
    }
    // The order of the English catalogue is the order of the file.
    const ordered = {}
    for (const [key] of english) {
      if (key in data) ordered[key] = data[key]
    }
    writeFileSync(file, JSON.stringify(ordered, null, 2) + '\n', 'utf8')
    console.log(`${target}: ${added} added, ${skipped} skipped, ${Object.keys(ordered).length} keys in total`)
    return
  }

  if (action === 'coverage') {
    const only = process.argv[3]
    for (const name of localeFiles()) {
      if (only && !name.startsWith(only)) continue
      const data = JSON.parse(readFileSync(resolve(localesDir, name), 'utf8'))
      const done = keys.filter((key) => typeof data[key] === 'string' && data[key].trim()).length
      const percent = Math.round((done / keys.length) * 100)
      console.log(`${name.padEnd(12)} ${String(percent).padStart(3)}%  ${done}/${keys.length}`)
    }
    return
  }

  console.error('unknown command: ' + action)
  process.exit(1)
}

command()
