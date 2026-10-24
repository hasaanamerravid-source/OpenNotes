/**
 * A small loader that lets Node run the TypeScript sources of the project
 * directly, without a build step and without another dependency.
 *
 * It does three things:
 *
 * 1. It resolves the path aliases of the project (`@shared/*`, `@/*`) and the
 *    imports that have no file extension.
 * 2. It leaves the TypeScript files to Node, which removes the types itself.
 * 3. It turns a JSON file into an ES module, so that the catalogues of the
 *    translation can be imported the same way the bundler does it.
 *
 * The hook is registered by `scripts/register-ts.mjs`.
 */
import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, resolve as resolvePath } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolvePath(dirname(fileURLToPath(import.meta.url)), '..')

/** The aliases of the project, the same as in tsconfig.web.json. */
const ALIASES = [
  ['@shared/', resolvePath(root, 'src', 'shared') + '/'],
  ['@/', resolvePath(root, 'src', 'renderer', 'src') + '/'],
]

/** The files that are tried when a file is imported without an extension. */
const EXTENSIONS = ['.ts', '.tsx', '.mts', '.mjs', '.js', '.json']

/** Find the file of an import that has no extension. */
function findFile(base) {
  if (existsSync(base)) {
    try {
      if (statSync(base).isDirectory()) return findFile(resolvePath(base, 'index'))
    } catch {
      /* not a file */
    }
    return base
  }
  for (const extension of EXTENSIONS) {
    const candidate = base + extension
    if (existsSync(candidate)) return candidate
  }
  for (const extension of EXTENSIONS) {
    const candidate = resolvePath(base, 'index' + extension)
    if (existsSync(candidate)) return candidate
  }
  return null
}

/** Resolve an import to a file on disk. */
export function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('.') || specifier.startsWith('/')) {
    const parentPath = context.parentURL ? fileURLToPath(context.parentURL) : resolvePath(root, 'index.js')
    const found = findFile(resolvePath(dirname(parentPath), specifier))
    if (found) return { url: pathToFileURL(found).href, shortCircuit: true }
  }
  for (const [prefix, target] of ALIASES) {
    if (specifier.startsWith(prefix)) {
      const found = findFile(target + specifier.slice(prefix.length))
      if (found) return { url: pathToFileURL(found).href, shortCircuit: true }
    }
  }
  return nextResolve(specifier, context)
}

/** Load a file: JSON becomes a module, TypeScript is handled by Node itself. */
export function load(url, context, nextLoad) {
  if (url.startsWith('file:') && url.endsWith('.json')) {
    const source = readFileSync(fileURLToPath(url), 'utf8')
    return { format: 'module', source: `export default ${source};\n`, shortCircuit: true }
  }
  return nextLoad(url, context)
}
