import path from 'node:path'

/** Extract file paths passed on the command line (Windows / Linux / macOS). */
export function openFilesFromArgv(argv: string[]): string[] {
  const args = argv.slice(1).filter((a) => !a.startsWith('-'))
  const out: string[] = []
  for (const arg of args) {
    if (arg.startsWith('--')) continue
    const ext = path.extname(arg)
    if (ext && ext.length <= 6) out.push(path.resolve(arg))
  }
  return out
}
