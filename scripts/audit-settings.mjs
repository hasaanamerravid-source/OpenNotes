/**
 * A development helper: which settings are actually used?
 *
 * A setting that nothing reads is a promise the application does not keep.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const root = process.argv[2] ?? 'I:/notepad/src'

/** Every setting of the Settings interface. */
const source = readFileSync(join(root, 'shared', 'types.ts'), 'utf8')
const start = source.indexOf('export interface Settings {')
const body = source.slice(start, source.indexOf('\n}', start))
const settings = []
for (const match of body.matchAll(/^\s{2}([a-zA-Z][a-zA-Z0-9]*)\??:/gm)) {
  settings.push(match[1])
}

/** Every source file of the project. */
const files = []
const walk = (dir) => {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry)
    if (statSync(p).isDirectory()) walk(p)
    else if (/\.(ts|tsx)$/.test(p)) files.push(p)
  }
}
walk(root)

const sources = files
  .filter((file) => !file.endsWith(join('shared', 'types.ts')))
  .map((file) => ({ file, text: readFileSync(file, 'utf8') }))

/** The places where a setting can be read. */
const patterns = (name) => [
  new RegExp(`settings\\.${name}\\b`),
  new RegExp(`settings\\[['"\`]${name}['"\`]`),
  new RegExp(`\\{[^}]*\\b${name}\\b[^}]*\\}\\s*=\\s*[^;]*?settings`),
  new RegExp(`['"\`]${name}['"\`]\\s*:`),
]

const unused = []
for (const setting of settings) {
  const used = sources.some((entry) => patterns(setting).some((pattern) => pattern.test(entry.text)))
  if (!used) unused.push(setting)
}

console.log(`${settings.length} settings, ${unused.length} without a reader`)
for (const setting of unused) console.log('  ' + setting)
