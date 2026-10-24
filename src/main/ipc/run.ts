/**
 * Run service: starts a program for a file and streams its output back to the
 * renderer.
 *
 * The renderer never spawns anything itself. It asks the main process to run a
 * file (`run:start`) and receives the output through `run:output` events.
 * Only one run is active at a time: starting a new one stops the previous.
 */

import { BrowserWindow, ipcMain } from 'electron'
import { spawn, type ChildProcess, type SpawnOptions } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export interface RunRequest {
  filePath: string
  /** The language id of the file. */
  language: string
  /**
   * The interpreters the user configured (the toolchain settings and the
   * project configuration). The key is the language, the value the path of the
   * program (a folder of a JDK is fine too).
   */
  toolchain?: Record<string, string>
}

export interface RunEvent {
  type: 'start' | 'stdout' | 'stderr' | 'exit' | 'error'
  text?: string
  code?: number
}

/* --------------------------------- types -------------------------------- */

interface CommandSpec {
  cmd: string
  args: string[]
  cwd: string
  /** Extra environment variables for the child process. */
  env?: NodeJS.ProcessEnv
}

/** A step that has to succeed before the program itself is started. */
interface PrepareStep {
  spec: CommandSpec
  /** Collect the output instead of streaming it to the panel. */
  capture?: boolean
  /** Return a message to abort the run, or null to continue. */
  check?: (output: string) => string | null
}

interface RunPlan {
  /** The command line that is shown in the output panel. */
  display: string
  prepare?: PrepareStep
  command: CommandSpec
  /** Files that are deleted when the run ends. */
  cleanup?: string[]
}

type PlanResult = { ok: true; plan: RunPlan } | { ok: false; error: string }

type Runner = (filePath: string, request: RunRequest) => PlanResult | Promise<PlanResult>

/**
 * The program that runs a file: the one the user configured in the toolchain
 * settings (or in the project configuration) wins over the one on the PATH.
 *
 * A folder is accepted as well: the program is then looked up in its `bin`
 * folder (that is how a JDK is configured).
 */
function toolPath(request: RunRequest, key: string, name: string): string {
  const configured = request.toolchain?.[key]?.trim()
  if (!configured) return name
  try {
    if (!existsSync(configured)) return name
    if (statSync(configured).isDirectory()) {
      const exe = process.platform === 'win32' ? `${name}.exe` : name
      const candidate = path.join(configured, 'bin', exe)
      if (existsSync(candidate)) return candidate
    }
    return configured
  } catch {
    return name
  }
}

/* ------------------------------- messages ------------------------------ */

/** Friendly names for the tools the runner needs. */
const TOOL_NAMES: Record<string, string> = {
  node: 'Node.js',
  npx: 'npm',
  tsx: 'the tsx runner',
  python: 'Python',
  python3: 'Python 3',
  py: 'Python',
  go: 'Go',
  cargo: 'Rust (Cargo)',
  gcc: 'GCC',
  'g++': 'a C++ compiler (g++)',
  clang: 'Clang',
  'clang++': 'Clang++',
  dotnet: 'the .NET SDK',
  java: 'Java',
  php: 'PHP',
  ruby: 'Ruby',
  lua: 'Lua',
  cmd: 'the Windows command processor',
  'cmd.exe': 'the Windows command processor',
  powershell: 'PowerShell',
  pwsh: 'PowerShell',
  bash: 'Bash',
}

/** A missing interpreter must not show up as a stack trace. */
function missingToolMessage(command: string): string {
  const label = TOOL_NAMES[command] ?? command
  return `${label} was not found on this machine. Install ${label} and try again.`
}

const NOT_RUNNABLE = 'This file type cannot be executed.'
const TSX_MISSING =
  'The tsx runner is not installed. Install it with `npm install -D tsx` in the project folder and try again.'

/* ------------------------------- executables ---------------------------- */

const WINDOWS_EXTENSIONS = ['.exe', '.cmd', '.bat', '.com']

/**
 * The Microsoft Store installs empty alias files (python.exe, node.exe, …)
 * that open the Store instead of the program. They are not interpreters.
 */
function isStoreAlias(file: string): boolean {
  if (process.platform !== 'win32') return false
  if (!/microsoft[\\/]windowsapps/i.test(file)) return false
  try {
    return statSync(file).size === 0
  } catch {
    return false
  }
}

/** Find an executable on the PATH (Windows also looks for the PATHEXT files). */
function findExecutable(name: string): string | null {
  if (path.isAbsolute(name)) return existsSync(name) ? name : null
  const dirs = (process.env.PATH ?? '').split(path.delimiter).filter(Boolean)
  const hasExtension = /\.(exe|cmd|bat|com)$/i.test(name)
  const extensions = process.platform === 'win32' && !hasExtension ? WINDOWS_EXTENSIONS : ['']
  for (const dir of dirs) {
    for (const extension of extensions) {
      const candidate = path.join(dir, name + extension)
      try {
        if (!existsSync(candidate)) continue
        if (isStoreAlias(candidate)) continue
        return candidate
      } catch {
        /* an unreadable PATH entry is skipped */
      }
    }
  }
  return null
}

/** Is the tool installed? */
function hasExecutable(name: string): boolean {
  return findExecutable(name) !== null
}

/** Look for a locally installed CLI (node_modules/.bin) in the folder tree. */
function findLocalBin(dir: string, name: string): string | null {
  const names = process.platform === 'win32' ? [`${name}.cmd`, `${name}.exe`, name] : [name]
  let current = dir
  for (;;) {
    const bin = path.join(current, 'node_modules', '.bin')
    for (const candidate of names) {
      const full = path.join(bin, candidate)
      try {
        if (existsSync(full)) return full
      } catch {
        /* keep looking */
      }
    }
    const parent = path.dirname(current)
    if (parent === current) break
    current = parent
  }
  return null
}

/** Walk up the folder tree and return the first folder that holds `name`. */
function findUp(dir: string, name: string): string | null {
  let current = dir
  for (;;) {
    const candidate = path.join(current, name)
    try {
      if (existsSync(candidate)) return candidate
    } catch {
      /* keep looking */
    }
    const parent = path.dirname(current)
    if (parent === current) break
    current = parent
  }
  return null
}

/** Find the folder of the nearest *.csproj file. */
function findProject(dir: string): string | null {
  let current = dir
  for (;;) {
    try {
      const found = readdirSync(current).find((entry) => entry.toLowerCase().endsWith('.csproj'))
      if (found) return path.join(current, found)
    } catch {
      /* an unreadable folder is skipped */
    }
    const parent = path.dirname(current)
    if (parent === current) break
    current = parent
  }
  return null
}

/* -------------------------------- spawning ------------------------------ */

/** Windows needs cmd.exe to run the .cmd/.bat shims of npm and friends. */
function isWindowsShim(file: string): boolean {
  return process.platform === 'win32' && /\.(cmd|bat)$/i.test(file)
}

function quoteWindows(value: string): string {
  return `"${value.replace(/"/g, '""')}"`
}

/**
 * Start a command. The shell is never used, except for the Windows shims
 * which are started through cmd.exe with verbatim arguments.
 */
function spawnSpec(spec: CommandSpec, options: SpawnOptions): ChildProcess {
  const environment = spec.env ? { ...process.env, ...spec.env } : process.env
  const resolved = findExecutable(spec.cmd)
  if (resolved && isWindowsShim(resolved)) {
    const line = [resolved, ...spec.args].map((part) => (/[\s"&|<>^]/.test(part) ? quoteWindows(part) : part)).join(' ')
    return spawn('cmd.exe', ['/d', '/s', '/c', `"${line}"`], {
      ...options,
      cwd: spec.cwd,
      env: environment,
      shell: false,
      windowsVerbatimArguments: true,
    })
  }
  return spawn(spec.cmd, spec.args, { ...options, cwd: spec.cwd, env: environment, shell: false })
}

/** Translate a spawn failure into a message the user can act on. */
function friendlySpawnError(command: string, error: unknown): string {
  const code = (error as NodeJS.ErrnoException | undefined)?.code
  if (code === 'ENOENT') return missingToolMessage(command)
  const message = error instanceof Error ? error.message : String(error)
  return `Could not start ${command}: ${message}`
}

/* --------------------------------- runners ------------------------------ */

function ok(plan: RunPlan): PlanResult {
  return { ok: true, plan }
}

function fail(error: string): PlanResult {
  return { ok: false, error }
}

function nodeRunner(filePath: string, request: RunRequest): PlanResult {
  const node = toolPath(request, 'node', 'node')
  if (!hasExecutable(node)) return fail(missingToolMessage('node'))
  return ok({
    display: `node ${filePath}`,
    command: { cmd: node, args: [filePath], cwd: path.dirname(filePath) },
  })
}

/**
 * TypeScript needs a loader. The locally installed tsx is used directly so
 * that nothing is ever downloaded; `npx --no-install` is the fallback.
 */
function tsxRunner(filePath: string, request: RunRequest): PlanResult {
  const dir = path.dirname(filePath)
  const local = findLocalBin(dir, 'tsx')
  if (local) {
    return ok({
      display: `tsx ${filePath}`,
      command: { cmd: local, args: [filePath], cwd: dir },
    })
  }
  if (hasExecutable('tsx')) {
    return ok({
      display: `tsx ${filePath}`,
      command: { cmd: 'tsx', args: [filePath], cwd: dir },
    })
  }
  if (hasExecutable('npx')) {
    const node = toolPath(request, 'node', 'node')
    return ok({
      display: `npx --no-install tsx ${filePath}`,
      command: {
        cmd: 'npx',
        args: ['--no-install', 'tsx', filePath],
        cwd: dir,
        // npx must never reach the network: --no-install refuses to install
        // anything and the offline mode keeps npm from asking the registry.
        env: {
          ...process.env,
          npm_config_offline: 'true',
          npm_config_update_notifier: 'false',
          // The configured node is used for npx as well.
          ...(node !== 'node' ? { PATH: `${path.dirname(node)}${path.delimiter}${process.env.PATH ?? ''}` } : {}),
        },
      },
    })
  }
  return fail(TSX_MISSING)
}

function pythonRunner(filePath: string, request: RunRequest): PlanResult {
  const dir = path.dirname(filePath)
  const python = toolPath(request, 'python', 'python')
  if (hasExecutable(python)) {
    return ok({
      display: `python ${filePath}`,
      command: { cmd: python, args: [filePath], cwd: dir },
    })
  }
  if (python === 'python' && process.platform === 'win32' && hasExecutable('py')) {
    return ok({
      display: `py -3 ${filePath}`,
      command: { cmd: 'py', args: ['-3', filePath], cwd: dir },
    })
  }
  if (hasExecutable('python3')) {
    return ok({
      display: `python3 ${filePath}`,
      command: { cmd: 'python3', args: [filePath], cwd: dir },
    })
  }
  return fail(missingToolMessage('python'))
}

function goRunner(filePath: string, request: RunRequest): PlanResult {
  const go = toolPath(request, 'go', 'go')
  if (!hasExecutable(go)) return fail(missingToolMessage('go'))
  return ok({
    display: `go run ${filePath}`,
    command: { cmd: go, args: ['run', filePath], cwd: path.dirname(filePath) },
  })
}

function rustRunner(filePath: string, request: RunRequest): PlanResult {
  const manifest = findUp(path.dirname(filePath), 'Cargo.toml')
  if (!manifest) {
    return fail(
      'This Rust file is not part of a Cargo project. Open the folder with the Cargo.toml and run the project instead.',
    )
  }
  const cargo = toolPath(request, 'rust', 'cargo')
  if (!hasExecutable(cargo)) return fail(missingToolMessage('cargo'))
  const dir = path.dirname(manifest)
  return ok({
    display: `cargo run (${dir})`,
    command: { cmd: cargo, args: ['run'], cwd: dir },
  })
}

/** A unique place for a compiled program. */
function tempBinaryPath(source: string): string {
  const base =
    path
      .basename(source, path.extname(source))
      .replace(/[^a-z0-9_-]/gi, '_')
      .slice(0, 40) || 'program'
  const suffix = Math.random().toString(36).slice(2, 8)
  const extension = process.platform === 'win32' ? '.exe' : ''
  return path.join(os.tmpdir(), `opennotes-${base}-${suffix}${extension}`)
}

function compiledRunner(filePath: string, kind: 'c' | 'cpp'): PlanResult {
  const compilers = kind === 'c' ? ['gcc', 'clang'] : ['g++', 'clang++']
  const compiler = compilers.find((name) => hasExecutable(name))
  if (!compiler) {
    const label = kind === 'c' ? 'a C compiler (GCC or Clang)' : 'a C++ compiler (g++ or Clang++)'
    return fail(`${label} was not found on this machine. Install ${label} and try again.`)
  }
  const dir = path.dirname(filePath)
  const binary = tempBinaryPath(filePath)
  return ok({
    display: `${compiler} ${filePath} && ${binary}`,
    prepare: { spec: { cmd: compiler, args: [filePath, '-o', binary], cwd: dir } },
    command: { cmd: binary, args: [], cwd: dir },
    cleanup: [binary],
  })
}

function csharpRunner(filePath: string, request: RunRequest): PlanResult {
  const project = findProject(path.dirname(filePath))
  if (!project) {
    return fail(
      'No .csproj file was found next to this file. dotnet script is not available - open the project folder and run it with "dotnet run" instead.',
    )
  }
  const dotnet = toolPath(request, 'dotnet', 'dotnet')
  if (!hasExecutable(dotnet)) return fail(missingToolMessage('dotnet'))
  const dir = path.dirname(project)
  return ok({
    display: `dotnet run (${path.basename(project)})`,
    command: { cmd: dotnet, args: ['run', '--project', project], cwd: dir },
  })
}

/** Does the Java file contain a main method? */
function hasMainMethod(filePath: string): boolean {
  try {
    const source = readFileSync(filePath, 'utf8')
    return /\bvoid\s+main\s*\(/.test(source)
  } catch {
    /* an unreadable file is left to the java runtime */
    return true
  }
}

/** Java 11 can run a single source file, older versions cannot. */
function checkJavaVersion(output: string): string | null {
  const match = output.match(/version\s+"([\d._]+)"/)
  if (!match) return null
  const parts = match[1].split(/[._]/)
  const major = Number(parts[0])
  if (!Number.isFinite(major)) return null
  if (major === 1) {
    const minor = Number(parts[1] ?? '0')
    return minor >= 8 ? null : 'Java 8 or older cannot run a single file. Java 11 or newer is required.'
  }
  return major >= 11 ? null : 'Java 11 or newer is required to run a single file.'
}

function javaRunner(filePath: string, request: RunRequest): PlanResult {
  const java = toolPath(request, 'java', 'java')
  if (!hasExecutable(java)) return fail(missingToolMessage('java'))
  if (!hasMainMethod(filePath)) {
    return fail('This Java file has no main class. Build the project first and run the compiled class instead.')
  }
  const dir = path.dirname(filePath)
  return ok({
    display: `java ${filePath}`,
    prepare: {
      spec: { cmd: java, args: ['-version'], cwd: dir },
      capture: true,
      check: checkJavaVersion,
    },
    command: { cmd: java, args: [filePath], cwd: dir },
  })
}

function phpRunner(filePath: string, request: RunRequest): PlanResult {
  const php = toolPath(request, 'php', 'php')
  if (!hasExecutable(php)) return fail(missingToolMessage('php'))
  return ok({
    display: `php ${filePath}`,
    command: { cmd: php, args: [filePath], cwd: path.dirname(filePath) },
  })
}

function rubyRunner(filePath: string, request: RunRequest): PlanResult {
  const ruby = toolPath(request, 'ruby', 'ruby')
  if (!hasExecutable(ruby)) return fail(missingToolMessage('ruby'))
  return ok({
    display: `ruby ${filePath}`,
    command: { cmd: ruby, args: [filePath], cwd: path.dirname(filePath) },
  })
}

function luaRunner(filePath: string): PlanResult {
  if (!hasExecutable('lua')) return fail(missingToolMessage('lua'))
  return ok({
    display: `lua ${filePath}`,
    command: { cmd: 'lua', args: [filePath], cwd: path.dirname(filePath) },
  })
}

function batchRunner(filePath: string): PlanResult {
  const cmd = process.platform === 'win32' ? 'cmd.exe' : 'cmd'
  if (!hasExecutable(cmd)) return fail(missingToolMessage(cmd))
  return ok({
    display: `cmd /c ${filePath}`,
    command: { cmd, args: ['/c', filePath], cwd: path.dirname(filePath) },
  })
}

function powershellRunner(filePath: string): PlanResult {
  const shell = hasExecutable('powershell') ? 'powershell' : hasExecutable('pwsh') ? 'pwsh' : null
  if (!shell) return fail(missingToolMessage('powershell'))
  const args = shell === 'powershell' ? ['-ExecutionPolicy', 'Bypass', '-File', filePath] : ['-File', filePath]
  return ok({
    display: `${shell} ${args.join(' ')}`,
    command: { cmd: shell, args, cwd: path.dirname(filePath) },
  })
}

/** Git Bash and the other bash builds on Windows. */
function findBash(): string | null {
  if (process.platform !== 'win32') return findExecutable('bash')
  const candidates = [
    process.env.ProgramFiles ? path.join(process.env.ProgramFiles, 'Git', 'bin', 'bash.exe') : null,
    process.env['ProgramFiles(x86)'] ? path.join(process.env['ProgramFiles(x86)'], 'Git', 'bin', 'bash.exe') : null,
    process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Programs', 'Git', 'bin', 'bash.exe') : null,
  ]
  for (const candidate of candidates) {
    if (candidate && existsSync(candidate)) return candidate
  }
  return findExecutable('bash')
}

function shellRunner(filePath: string): PlanResult {
  const bash = findBash()
  if (!bash) {
    return fail('Bash was not found on this machine. Install Git Bash (or another shell) and try again.')
  }
  // Bash on Windows needs forward slashes, otherwise it reads the path as
  // escape sequences.
  const target = process.platform === 'win32' ? filePath.replace(/\\/g, '/') : filePath
  return ok({
    display: `bash ${target}`,
    command: { cmd: bash, args: [target], cwd: path.dirname(filePath) },
  })
}

/** The runner table: one entry per language id. */
const RUNNERS: Record<string, Runner> = {
  javascript: nodeRunner,
  jsx: nodeRunner,
  typescript: tsxRunner,
  tsx: tsxRunner,
  python: pythonRunner,
  go: goRunner,
  rust: rustRunner,
  c: (filePath) => compiledRunner(filePath, 'c'),
  cpp: (filePath) => compiledRunner(filePath, 'cpp'),
  csharp: csharpRunner,
  java: javaRunner,
  php: phpRunner,
  ruby: rubyRunner,
  lua: luaRunner,
  batch: batchRunner,
  powershell: powershellRunner,
  shell: shellRunner,
  bash: shellRunner,
}

/** Files that never contain a program. */
const NOT_RUNNABLE_LANGUAGES = new Set([
  'html',
  'xml',
  'markdown',
  'text',
  'plaintext',
  'json',
  'jsonc',
  'yaml',
  'toml',
  'ini',
  'css',
  'scss',
  'less',
  'sql',
  'csv',
  'tsv',
  'diff',
  'latex',
  'tex',
  'log',
  'rest',
  'dockerfile',
  'makefile',
  'gitignore',
  'gitconfig',
])

/** Used when the language id of a file is unknown. */
const EXTENSION_LANGUAGES: Record<string, string> = {
  '.js': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.jsx': 'jsx',
  '.ts': 'typescript',
  '.tsx': 'tsx',
  '.py': 'python',
  '.go': 'go',
  '.rs': 'rust',
  '.c': 'c',
  '.h': 'c',
  '.cc': 'cpp',
  '.cpp': 'cpp',
  '.cxx': 'cpp',
  '.cs': 'csharp',
  '.java': 'java',
  '.php': 'php',
  '.rb': 'ruby',
  '.lua': 'lua',
  '.bat': 'batch',
  '.cmd': 'batch',
  '.ps1': 'powershell',
  '.psm1': 'powershell',
  '.sh': 'shell',
  '.bash': 'shell',
}

/** Pick the runner for a file. */
async function resolvePlan(request: RunRequest): Promise<PlanResult> {
  const filePath = typeof request?.filePath === 'string' ? request.filePath.trim() : ''
  if (!filePath) return fail('There is no file to run.')
  if (!existsSync(filePath)) return fail(`The file ${filePath} does not exist.`)

  const language = (request.language ?? '').toLowerCase()
  if (NOT_RUNNABLE_LANGUAGES.has(language)) return fail(NOT_RUNNABLE)

  const extension = path.extname(filePath).toLowerCase()
  const runner = RUNNERS[language] ?? RUNNERS[EXTENSION_LANGUAGES[extension] ?? '']
  if (!runner) return fail(NOT_RUNNABLE)

  try {
    return await runner(filePath, request)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return fail(`Could not run the file: ${message}`)
  }
}

/* ------------------------------- the runner ---------------------------- */

interface ActiveRun {
  token: number
  child: ChildProcess | null
  win: BrowserWindow | null
  cleanup: string[]
}

let current: ActiveRun | null = null
let tokenSeq = 0

/** Send an event to the renderer (the window may be gone already). */
function send(win: BrowserWindow | null, event: RunEvent): void {
  if (!win || win.isDestroyed()) return
  try {
    win.webContents.send('run:output', event)
  } catch {
    /* the window went away, the run is stopped anyway */
  }
}

/** Kill the child process (and everything it started on Windows). */
function killChild(child: ChildProcess | null): void {
  if (!child || child.killed || child.pid === undefined) return
  if (process.platform === 'win32') {
    try {
      spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true })
    } catch {
      child.kill()
    }
    return
  }
  try {
    process.kill(-child.pid, 'SIGTERM')
  } catch {
    try {
      child.kill('SIGTERM')
    } catch {
      /* the process is already gone */
    }
  }
}

/** Delete the files that were created for a run. */
function cleanupFiles(files: string[]): void {
  for (const file of files) {
    try {
      rmSync(file, { force: true })
    } catch {
      /* a leftover temp file is not worth an error */
    }
  }
}

/** Stop the running process (if there is one). */
function stopRun(): void {
  const run = current
  current = null
  if (!run) return
  killChild(run.child)
  run.child = null
  send(run.win, { type: 'exit' })
  cleanupFiles(run.cleanup)
}

interface ExecuteResult {
  code: number | null
  error?: string
  output: string
}

/** Run a command and collect its output. */
function execute(
  run: ActiveRun,
  spec: CommandSpec,
  handlers: { capture?: boolean; onStdout: (text: string) => void; onStderr: (text: string) => void },
): Promise<ExecuteResult> {
  return new Promise((resolve) => {
    let child: ChildProcess
    try {
      child = spawnSpec(spec, {
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
        // On unix the child becomes the leader of its own process group, so
        // that the whole group can be stopped again.
        detached: process.platform !== 'win32',
      })
    } catch (error) {
      resolve({ code: null, error: friendlySpawnError(spec.cmd, error), output: '' })
      return
    }
    run.child = child
    let output = ''
    child.stdout?.setEncoding('utf8')
    child.stdout?.on('data', (chunk: string) => {
      if (handlers.capture) {
        output += chunk
        return
      }
      handlers.onStdout(chunk)
    })
    child.stderr?.setEncoding('utf8')
    child.stderr?.on('data', (chunk: string) => {
      if (handlers.capture) {
        output += chunk
        return
      }
      handlers.onStderr(chunk)
    })
    child.on('error', (error) => {
      resolve({ code: null, error: friendlySpawnError(spec.cmd, error), output })
    })
    child.on('close', (code) => {
      resolve({ code: code ?? null, output })
    })
  })
}

/** Start the plan and stream everything that happens. */
async function executePlan(run: ActiveRun, plan: RunPlan): Promise<void> {
  const onStdout = (text: string): void => send(run.win, { type: 'stdout', text })
  const onStderr = (text: string): void => {
    send(run.win, { type: 'stderr', text })
    // npx explains a missing package in its own words - say it better.
    if (plan.command.cmd === 'npx' && /could not determine executable|missing packages|no YES option/i.test(text)) {
      send(run.win, { type: 'error', text: TSX_MISSING })
    }
  }

  if (plan.prepare) {
    const prepared = await execute(run, plan.prepare.spec, {
      capture: plan.prepare.capture === true,
      onStdout,
      onStderr,
    })
    if (current?.token !== run.token) return
    let problem: string | null = null
    if (prepared.error) {
      problem = prepared.error
    } else if (plan.prepare.check) {
      problem = plan.prepare.check(prepared.output)
    }
    if (problem) {
      send(run.win, { type: 'error', text: problem })
      current = null
      run.child = null
      cleanupFiles(run.cleanup)
      send(run.win, { type: 'exit', code: prepared.code ?? undefined })
      return
    }
    // A failed compile step stops the run, the program does not exist.
    if (prepared.code !== 0) {
      current = null
      run.child = null
      cleanupFiles(run.cleanup)
      send(run.win, { type: 'exit', code: prepared.code ?? undefined })
      return
    }
  }

  const result = await execute(run, plan.command, { onStdout, onStderr })
  if (current?.token !== run.token) return
  current = null
  run.child = null
  cleanupFiles(run.cleanup)
  if (result.error) {
    send(run.win, { type: 'error', text: result.error })
    send(run.win, { type: 'exit' })
    return
  }
  send(run.win, { type: 'exit', code: result.code ?? undefined })
}

/** Start a run for a plan. */
function startRun(win: BrowserWindow | null, plan: RunPlan): void {
  tokenSeq += 1
  const run: ActiveRun = { token: tokenSeq, child: null, win, cleanup: plan.cleanup ?? [] }
  current = run
  send(win, { type: 'start', text: plan.display })
  if (win) {
    win.once('closed', () => {
      if (current?.token === run.token) stopRun()
    })
  }
  void executePlan(run, plan)
}

/* -------------------------------- handlers ------------------------------ */

export function registerRunHandlers(): void {
  ipcMain.handle('run:start', async (event, request: RunRequest) => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender) ?? null
      // Only one run at a time: the old one is stopped first.
      stopRun()
      const plan = await resolvePlan(request)
      if (!plan.ok) {
        send(win, { type: 'error', text: plan.error })
        return false
      }
      startRun(win, plan.plan)
      return true
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      send(BrowserWindow.fromWebContents(event.sender) ?? null, { type: 'error', text: message })
      return false
    }
  })

  ipcMain.handle('run:stop', () => {
    stopRun()
    return true
  })
}
