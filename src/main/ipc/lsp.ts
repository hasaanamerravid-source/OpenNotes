/**
 * Language server host (main process).
 *
 * OpenNotes can talk to a language server (LSP) for the code it shows. The
 * main process owns the server processes: it starts them, keeps them alive
 * and speaks the JSON-RPC protocol with them. The renderer never spawns
 * anything - it only sends documents and asks for answers.
 *
 * The protocol is the one of the LSP specification, the framing is written by
 * hand (no library is used):
 *
 *   Content-Length: <n>\r\n\r\n<json>
 *
 * One server is started per language (TypeScript and JavaScript share one
 * process, C and C++ as well) and it is reused for every document of that
 * language.
 *
 * Expected preload shape (the preload owner adds this binding):
 *
 *   lsp: {
 *     start(languages: string[]): Promise<string[]>
 *     didOpen(params: { language: string; uri: string; text: string }): Promise<boolean>
 *     didChange(params: { language: string; uri: string; text: string }): Promise<boolean>
 *     didClose(params: { language: string; uri: string }): Promise<boolean>
 *     request<T>(params: { language: string; method: string; params?: unknown }): Promise<T | null>
 *     stop(language?: string): Promise<boolean>
 *     onDiagnostics(cb: (event: { language: string; uri: string; problems: LspProblem[] }) => void): () => void
 *     onStatus(cb: (event: { language: string; state: LspServerState; message?: string }) => void): () => void
 *   }
 *
 * The IPC surface of the main process:
 *
 *   lsp:start       (handle) - start the servers of the given languages
 *   lsp:didOpen     (handle) - { language, uri, text }
 *   lsp:didChange   (handle) - { language, uri, text }
 *   lsp:didClose    (handle) - { language, uri }
 *   lsp:request     (handle) - { language, method, params } -> the answer of the server
 *   lsp:stop        (handle) - stops the servers (all of them, or one language)
 *   lsp:diagnostics (event)  - { language, uri, problems }
 *   lsp:status      (event)  - { language, state, message? }
 */

import { BrowserWindow, ipcMain } from 'electron'
import { spawn, type ChildProcess, type SpawnOptions } from 'node:child_process'
import { existsSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

/* ------------------------------------------------------------------ *
 * Types
 * ------------------------------------------------------------------ */

/** What a language server is doing right now. */
export type LspServerState = 'starting' | 'ready' | 'error' | 'stopped'

/** A problem of a document (the shape the problems panel expects). */
export interface LspProblem {
  /** 1 based line number. */
  line: number
  /** 1 based column. */
  column: number
  /** Character offset in the document. */
  from: number
  /** Character offset in the document. */
  to: number
  severity: 'error' | 'warning' | 'info'
  message: string
  /** The short code of the problem ("ts", "eslint", ...). */
  source: string
}

/** The event that carries the problems of a document. */
export interface LspDiagnosticsEvent {
  language: string
  uri: string
  problems: LspProblem[]
}

/** The event that tells the renderer what the server is doing. */
export interface LspStatusEvent {
  language: string
  state: LspServerState
  message?: string
  /** A hint that tells the user what to install. */
  hint?: string
}

/** How a language server is started. */
export interface LspServerConfig {
  /** The program that is started. */
  command: string
  /** The arguments of the program. */
  args: string[]
  /** The folder the server is started in. */
  cwd?: string
  /** Extra environment variables for the server. */
  env?: Record<string, string>
  /** Passed to the server as `initializationOptions`. */
  initializationOptions?: unknown
}

/** What the user may change in the settings (the toolchain settings). */
export interface LspServerOverride {
  command?: string
  args?: string[]
  cwd?: string
  env?: Record<string, string>
  initializationOptions?: unknown
  /** The server is switched off for this language. */
  disabled?: boolean
}

/** The options of {@link registerLspHandlers}. */
export interface LspOptions {
  /** The servers per language (the toolchain settings fill this in). */
  servers?: Record<string, LspServerOverride>
  /** The folder that is opened as the workspace. */
  rootPath?: string | null
  /** How long a request may take (milliseconds). */
  requestTimeout?: number
  /** Where the events are sent to (the default are all windows). */
  send?: (channel: string, payload: unknown) => void
}

/* ------------------------------------------------------------------ *
 * The language servers
 * ------------------------------------------------------------------ */

/**
 * The language servers OpenNotes knows.
 *
 * The table is the default - the toolchain settings of the app can replace
 * the command and the arguments of every language.
 *
 * Notes:
 * - `jdtls` is the launcher of the Eclipse JDT Language Server (Java).
 * - `phpactor` speaks the protocol (intelephense does not, it is a plain
 *   language server for PHP that only knows diagnostics).
 * - `ruby-lsp` is the language server of Ruby (solargraph only knows the old
 *   protocol).
 */
export const LANGUAGE_SERVERS: Record<string, LspServerConfig> = {
  go: { command: 'gopls', args: [] },
  java: { command: 'jdtls', args: [] },
  csharp: { command: 'csharp-ls', args: [] },
  rust: { command: 'rust-analyzer', args: [] },
  python: { command: 'pyright-langserver', args: ['--stdio'] },
  typescript: { command: 'typescript-language-server', args: ['--stdio'] },
  javascript: { command: 'typescript-language-server', args: ['--stdio'] },
  jsx: { command: 'typescript-language-server', args: ['--stdio'] },
  tsx: { command: 'typescript-language-server', args: ['--stdio'] },
  c: { command: 'clangd', args: ['--background'] },
  cpp: { command: 'clangd', args: ['--background'] },
  php: { command: 'phpactor', args: ['language-server'] },
  ruby: { command: 'ruby-lsp', args: [] },
  kotlin: { command: 'kotlin-language-server', args: [] },
  swift: { command: 'sourcekit-lsp', args: [] },
  lua: { command: 'lua-language-server', args: [] },
}

/**
 * Languages that are served by the very same server process. The key is the
 * language that owns the process.
 */
const SHARED_SERVERS: Record<string, string> = {
  javascript: 'typescript',
  jsx: 'typescript',
  tsx: 'typescript',
  cpp: 'c',
  objectivec: 'c',
}

/** The languages that know a language server. */
export const LSP_LANGUAGES: string[] = Object.keys(LANGUAGE_SERVERS)

/** The process that serves a language. */
function serverKey(language: string): string {
  const lower = language.toLowerCase()
  return SHARED_SERVERS[lower] ?? lower
}

/** Every language that is served by the process of a key. */
function languagesOf(key: string): string[] {
  return Object.keys(LANGUAGE_SERVERS).filter((language) => serverKey(language) === key)
}

/** A hint that tells the user what to install. */
const INSTALL_HINTS: Record<string, string> = {
  gopls: 'Install it with `go install golang.org/x/tools/gopls@latest`.',
  jdtls: 'Install the Eclipse JDT Language Server and put its launcher on the PATH.',
  'csharp-ls': 'Install the C# language server and put it on the PATH.',
  'rust-analyzer': 'Install it with `rustup component add rust-analyzer`.',
  'pyright-langserver': 'Install it with `npm install -g pyright`.',
  'typescript-language-server': 'Install it with `npm install -g typescript-language-server typescript`.',
  clangd: 'Install the LLVM toolchain - clangd comes with it.',
  phpactor: 'Install it with `composer global require phpactor/phpactor`.',
  'ruby-lsp': 'Install it with `gem install ruby-lsp`.',
  'kotlin-language-server': 'Install the Kotlin language server and put it on the PATH.',
  'sourcekit-lsp': 'It is part of the Swift toolchain.',
  'lua-language-server': 'Install it with `npm install -g lua-language-server`.',
}

/* ------------------------------------------------------------------ *
 * Small helpers
 * ------------------------------------------------------------------ */

/** The text of an error. */
function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

const WINDOWS_EXTENSIONS = ['.exe', '.cmd', '.bat', '.com']

/**
 * The Microsoft Store installs empty alias files (python.exe, node.exe, ...)
 * that open the Store instead of the program. They are no interpreters.
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

/** Look for a program in the folders of the PATH. */
function findExecutable(name: string): string | null {
  if (!name) return null
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

/** Look for a program in the node_modules of the app (a local install). */
function findLocalExecutable(name: string): string | null {
  const names = process.platform === 'win32' ? [`${name}.cmd`, `${name}.exe`, name] : [name]
  let current = process.cwd()
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

/** Find a program: the PATH first, the local node_modules as a fallback. */
function resolveCommand(name: string): string | null {
  return findExecutable(name) ?? findLocalExecutable(name)
}

/**
 * Start the server.
 *
 * Windows cannot run the .cmd/.bat shims of npm without the command
 * processor, so those are started through cmd.exe.
 */
function spawnServer(
  command: string,
  args: string[],
  options: { cwd?: string; env?: Record<string, string> },
): ChildProcess {
  const resolved = resolveCommand(command)
  const env = { ...process.env, ...options.env }
  const spawnOptions: SpawnOptions = {
    cwd: options.cwd,
    env,
    shell: false,
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  }
  if (resolved && /\.(cmd|bat)$/i.test(resolved)) {
    const quote = (value: string): string => (/[\s"&|<>^]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value)
    const line = [resolved, ...args].map(quote).join(' ')
    return spawn('cmd.exe', ['/d', '/s', '/c', `"${line}"`], {
      ...spawnOptions,
      windowsVerbatimArguments: true,
    })
  }
  return spawn(resolved ?? command, args, spawnOptions)
}

/** Kill a server (and everything it started on Windows). */
function killTree(child: ChildProcess): void {
  if (!child || child.killed) return
  if (process.platform === 'win32' && child.pid !== undefined) {
    try {
      spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true })
      return
    } catch {
      /* the taskkill is a courtesy, the kill below still works */
    }
  }
  try {
    child.kill('SIGTERM')
  } catch {
    /* the process is already gone */
  }
}

/**
 * Turn a path into a `file:` uri.
 *
 * A uri stays as it is, a path (a Windows path like `C:\code\main.go` as well)
 * becomes a `file:` uri. The other schemes of the protocol (`untitled:` for
 * example) are not touched.
 */
export function toFileUri(value: string): string {
  if (!value) return ''
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) return value
  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(value)
  const isDrive = /^[a-z]:[\\/]/i.test(value)
  if (hasScheme && !isDrive) return value
  try {
    return pathToFileURL(path.resolve(value)).href
  } catch {
    return value
  }
}

/** Turn a `file:` uri into a path (a path stays as it is). */
export function fromFileUri(value: string): string {
  if (!value) return ''
  if (!/^file:\/\//i.test(value)) return value
  try {
    return fileURLToPath(value)
  } catch {
    return value
  }
}

/* ------------------------------------------------------------------ *
 * The protocol
 * ------------------------------------------------------------------ */

/** Read the length of the body out of the header of a message. */
function parseContentLength(header: string): number | null {
  for (const line of header.split('\r\n')) {
    const index = line.indexOf(':')
    if (index < 0) continue
    if (line.slice(0, index).trim().toLowerCase() !== 'content-length') continue
    const value = Number.parseInt(line.slice(index + 1).trim(), 10)
    if (Number.isFinite(value) && value >= 0) return value
  }
  return null
}

/** The capabilities of the client (what OpenNotes understands). */
const CLIENT_CAPABILITIES: Record<string, unknown> = {
  general: { positionEncodings: ['utf-16'] },
  workspace: {
    applyEdit: false,
    configuration: true,
    didChangeConfiguration: { dynamicRegistration: false },
    didChangeWatchedFiles: { dynamicRegistration: false },
    executeCommand: { dynamicRegistration: false },
    symbol: { dynamicRegistration: false },
    workspaceEdit: { documentChanges: false },
    workspaceFolders: true,
  },
  textDocument: {
    synchronization: {
      dynamicRegistration: false,
      didSave: false,
      willSave: false,
      willSaveWaitUntil: false,
    },
    publishDiagnostics: {
      relatedInformation: true,
      versionSupport: false,
      tagSupport: { valueSet: [1, 2] },
      codeDescriptionSupport: true,
      dataSupport: true,
    },
    hover: { dynamicRegistration: false, contentFormat: ['markdown', 'plaintext'] },
    completion: {
      dynamicRegistration: false,
      completionItem: {
        snippetSupport: true,
        documentationFormat: ['markdown', 'plaintext'],
        resolveSupport: { properties: ['documentation', 'detail', 'additionalTextEdits'] },
      },
    },
    definition: { dynamicRegistration: false, linkSupport: true },
    typeDefinition: { dynamicRegistration: false, linkSupport: true },
    implementation: { dynamicRegistration: false, linkSupport: true },
    references: { dynamicRegistration: false },
    documentSymbol: { dynamicRegistration: false, hierarchicalDocumentSymbolSupport: true },
    signatureHelp: { dynamicRegistration: false },
    formatting: { dynamicRegistration: false },
    rangeFormatting: { dynamicRegistration: false },
    codeAction: { dynamicRegistration: false },
    codeLens: { dynamicRegistration: false },
    rename: { dynamicRegistration: false },
    inlayHint: { dynamicRegistration: false },
  },
  window: {
    workDoneProgress: true,
    showMessage: {},
    showDocument: { support: true },
  },
  notebook: { documentSync: { dynamicRegistration: false } },
}

/** The default time a request may take. */
const DEFAULT_REQUEST_TIMEOUT = 5000

/** The time the `initialize` request may take (the server needs a moment). */
const INITIALIZE_TIMEOUT = 20000

/** What the host tells the server about the documents. */
interface HostBridge {
  onStatus: (language: string, state: LspServerState, message?: string, hint?: string) => void
  onDiagnostics: (language: string, uri: string, problems: LspProblem[]) => void
  /** The text of an open document (needed to turn positions into offsets). */
  getText: (uri: string) => string | undefined
  /** The language of an open document. */
  getLanguage: (uri: string) => string | undefined
}

/** An answer of the server. */
interface Answer {
  ok: boolean
  result?: unknown
  error?: string
}

/** A request that waits for an answer. */
interface PendingRequest {
  resolve: (answer: Answer) => void
  timer: NodeJS.Timeout
}

/** A position in a document (0 based, like the protocol wants it). */
interface Position {
  line: number
  character: number
}

/** A change of a document. */
interface TextChange {
  /** The part of the document that is replaced (missing = the whole text). */
  range?: { start: Position; end: Position }
  text: string
}

/** The position of an offset in a text. */
function positionAt(text: string, offset: number): Position {
  let line = 0
  let start = 0
  const limit = Math.min(offset, text.length)
  for (let index = 0; index < limit; index++) {
    if (text.charCodeAt(index) === 10) {
      line++
      start = index + 1
    }
  }
  return { line, character: limit - start }
}

/**
 * The difference between two texts.
 *
 * Servers that asked for incremental changes get the part of the document
 * that really changed, every other server gets the whole text.
 */
function computeChange(oldText: string, newText: string, incremental: boolean): TextChange {
  if (!incremental) return { text: newText }
  const max = Math.min(oldText.length, newText.length)
  let prefix = 0
  while (prefix < max && oldText.charCodeAt(prefix) === newText.charCodeAt(prefix)) prefix++
  let suffix = 0
  while (
    suffix < max - prefix &&
    oldText.charCodeAt(oldText.length - 1 - suffix) === newText.charCodeAt(newText.length - 1 - suffix)
  ) {
    suffix++
  }
  const oldEnd = oldText.length - suffix
  const newEnd = newText.length - suffix
  return {
    range: { start: positionAt(oldText, prefix), end: positionAt(oldText, oldEnd) },
    text: newText.slice(prefix, newEnd),
  }
}

/**
 * One language server process.
 *
 * The class knows the framing of the protocol, sends the documents and
 * answers the requests of the server.
 */
class LanguageServer {
  /** The key of the process (several languages can share one). */
  readonly key: string
  /** The languages this process serves. */
  readonly languages: string[]
  /** The command that is used. */
  readonly config: LspServerConfig
  /** What the server is doing right now. */
  state: LspServerState = 'stopped'

  private child: ChildProcess | null = null
  private buffer: Buffer = Buffer.alloc(0)
  private nextId = 1
  private pending = new Map<number, PendingRequest>()
  private ready: Promise<void> | null = null
  private rejectReady: ((error: Error) => void) | null = null
  /** How the server wants the documents (0 = none, 1 = full, 2 = changes). */
  private syncKind = 1
  /** Does the server want to know about closed documents? */
  private openClose = true

  constructor(
    key: string,
    config: LspServerConfig,
    private host: HostBridge,
    private options: LspOptions,
  ) {
    this.key = key
    this.config = config
    this.languages = languagesOf(key)
  }

  /* ----------------------------- life cycle --------------------------- */

  /** Start the server and initialize it. */
  async start(): Promise<void> {
    if (this.state === 'ready') return
    if (!this.ready) {
      this.ready = this.launch().catch((error: unknown) => {
        // A failed start may be retried later.
        this.ready = null
        throw error
      })
    }
    await this.ready
  }

  /** Spawn the process and talk to it. */
  private async launch(): Promise<void> {
    this.setState('starting')
    const command = this.config.command
    if (!command) {
      const message = `No language server command was configured for ${this.key}.`
      this.setState('error', message)
      throw new Error(message)
    }
    if (!resolveCommand(command)) {
      const message = `${command} was not found on this machine`
      this.setState('error', message, INSTALL_HINTS[command])
      throw new Error(message)
    }

    let child: ChildProcess
    try {
      child = spawnServer(command, this.config.args, {
        cwd: this.config.cwd ?? this.options.rootPath ?? undefined,
        env: this.config.env,
      })
    } catch (error) {
      const message = `Could not start ${command}: ${errorText(error)}`
      this.setState('error', message, INSTALL_HINTS[command])
      throw new Error(message)
    }
    this.child = child

    child.stdout?.on('data', (chunk: Buffer) => {
      this.onData(chunk)
    })
    child.stderr?.setEncoding('utf8')
    child.stderr?.on('data', () => {
      /* the server writes its log to stderr - it is not shown to the user */
    })
    child.on('error', (error: Error) => {
      const code = (error as NodeJS.ErrnoException).code
      const message =
        code === 'ENOENT' ? `${command} was not found on this machine` : `Could not start ${command}: ${error.message}`
      this.child = null
      this.failPending(message)
      this.setState('error', message, INSTALL_HINTS[command])
      this.rejectReady?.(new Error(message))
      this.rejectReady = null
    })
    child.on('exit', (code: number | null) => {
      this.child = null
      this.failPending('The language server stopped.')
      if (this.state !== 'stopped') {
        this.setState('stopped', code === 0 ? undefined : `The language server stopped (code ${code ?? 'unknown'}).`)
      }
      this.rejectReady?.(new Error('The language server stopped before it was ready.'))
      this.rejectReady = null
    })

    await this.initialize()
  }

  /** Send the `initialize` request and the `initialized` notification. */
  private initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.rejectReady = reject
      const root = this.options.rootPath ? path.resolve(this.options.rootPath) : null
      const rootUri = root ? toFileUri(root) : null
      const params: Record<string, unknown> = {
        processId: process.pid,
        clientInfo: { name: 'OpenNotes', version: '1.0.0' },
        locale: 'en',
        rootPath: root,
        rootUri,
        workspaceFolders: root ? [{ uri: rootUri, name: path.basename(root) }] : null,
        initializationOptions: this.config.initializationOptions ?? null,
        capabilities: CLIENT_CAPABILITIES,
        trace: 'off',
      }
      void this.sendRequest('initialize', params, INITIALIZE_TIMEOUT).then((answer) => {
        this.rejectReady = null
        if (!answer.ok) {
          const message = answer.error ?? `${this.config.command} did not start correctly.`
          this.setState('error', message)
          void this.stop()
          reject(new Error(message))
          return
        }
        this.readCapabilities(answer.result)
        this.notify('initialized', {})
        this.setState('ready')
        resolve()
      })
    })
  }

  /** Read what the server told about the documents. */
  private readCapabilities(result: unknown): void {
    const capabilities = (result as { capabilities?: { textDocumentSync?: unknown } } | undefined)?.capabilities
    const sync = capabilities?.textDocumentSync
    if (typeof sync === 'number') {
      this.syncKind = sync
      return
    }
    if (sync && typeof sync === 'object') {
      const options = sync as { change?: number; openClose?: boolean }
      if (typeof options.change === 'number') this.syncKind = options.change
      if (typeof options.openClose === 'boolean') this.openClose = options.openClose
    }
  }

  /** Stop the server (the process is killed). */
  async stop(): Promise<void> {
    const child = this.child
    this.failPending('The language server was stopped.')
    if (child) {
      try {
        if (child.stdin && !child.stdin.destroyed) {
          this.write({ jsonrpc: '2.0', id: this.nextId++, method: 'shutdown', params: null })
          this.write({ jsonrpc: '2.0', method: 'exit', params: null })
        }
      } catch {
        /* the process is already gone */
      }
    }
    this.child = null
    if (child) killTree(child)
    this.setState('stopped')
  }

  /** Remember that the state changed and tell the renderer. */
  private setState(state: LspServerState, message?: string, hint?: string): void {
    this.state = state
    for (const language of this.languages) this.host.onStatus(language, state, message, hint)
  }

  /* ------------------------------ messages ---------------------------- */

  /** Send a request to the server and wait for the answer. */
  async request(method: string, params: unknown, timeout?: number): Promise<unknown | null> {
    if (this.state !== 'ready') return null
    const answer = await this.sendRequest(
      method,
      params ?? null,
      timeout ?? this.options.requestTimeout ?? DEFAULT_REQUEST_TIMEOUT,
    )
    if (!answer.ok) return null
    return answer.result ?? null
  }

  /** Send a notification to the server (there is no answer). */
  notify(method: string, params: unknown): void {
    this.write({ jsonrpc: '2.0', method, params })
  }

  /* ----------------------------- documents ---------------------------- */

  /** Tell the server about a new document. */
  openDocument(uri: string, language: string, text: string): void {
    if (this.syncKind === 0) return
    this.notify('textDocument/didOpen', {
      textDocument: { uri, languageId: language, version: 1, text },
    })
  }

  /** Tell the server that a document changed. */
  changeDocument(uri: string, version: number, oldText: string, newText: string): void {
    if (this.syncKind === 0) return
    // Servers that asked for changes get the part of the document that
    // really changed, every other server gets the whole text.
    const change = computeChange(oldText, newText, this.syncKind === 2)
    this.notify('textDocument/didChange', {
      textDocument: { uri, version },
      contentChanges: [change],
    })
  }

  /** Tell the server that a document was closed. */
  closeDocument(uri: string): void {
    if (!this.openClose) return
    this.notify('textDocument/didClose', { textDocument: { uri } })
  }

  /** Send a request and remember it until the answer arrives. */
  private sendRequest(method: string, params: unknown, timeout: number): Promise<Answer> {
    const child = this.child
    if (!child || !child.stdin || child.stdin.destroyed) {
      return Promise.resolve({ ok: false, error: 'The language server is not running.' })
    }
    const id = this.nextId++
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        resolve({ ok: false, error: 'The language server did not answer in time.' })
      }, timeout)
      timer.unref?.()
      this.pending.set(id, { resolve, timer })
      this.write({ jsonrpc: '2.0', id, method, params })
    })
  }

  /** Write a message in the framing of the protocol. */
  private write(message: unknown): void {
    const child = this.child
    if (!child || !child.stdin || child.stdin.destroyed) return
    let body: Buffer
    try {
      body = Buffer.from(JSON.stringify(message), 'utf8')
    } catch {
      return
    }
    const header = Buffer.from(`Content-Length: ${body.length}\r\n\r\n`, 'ascii')
    try {
      child.stdin.write(Buffer.concat([header, body]))
    } catch {
      /* the server is gone */
    }
  }

  /** All waiting requests are answered with an error. */
  private failPending(error: string): void {
    for (const [, request] of this.pending) {
      clearTimeout(request.timer)
      request.resolve({ ok: false, error })
    }
    this.pending.clear()
  }

  /* ------------------------------- reading ---------------------------- */

  /** Read the bytes of the server and cut the messages out of them. */
  private onData(chunk: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, chunk])
    for (;;) {
      const index = this.buffer.indexOf('\r\n\r\n')
      if (index < 0) return
      const header = this.buffer.subarray(0, index).toString('ascii')
      const length = parseContentLength(header)
      if (length === null) {
        // A broken header is skipped, the server may recover.
        this.buffer = this.buffer.subarray(index + 4)
        continue
      }
      const start = index + 4
      if (this.buffer.length < start + length) return
      const body = this.buffer.subarray(start, start + length).toString('utf8')
      this.buffer = this.buffer.subarray(start + length)
      let message: unknown
      try {
        message = JSON.parse(body)
      } catch {
        continue
      }
      this.handleMessage(message)
    }
  }

  /** A message of the server arrived. */
  private handleMessage(message: unknown): void {
    if (!message || typeof message !== 'object') return
    const msg = message as {
      id?: number | string | null
      method?: string
      params?: unknown
      result?: unknown
      error?: unknown
    }
    if (typeof msg.method === 'string') {
      if (msg.id === undefined || msg.id === null) this.handleNotification(msg.method, msg.params)
      else this.answerRequest(msg.id, msg.method, msg.params)
      return
    }
    if (msg.id === undefined || msg.id === null) return
    const id = Number(msg.id)
    const request = this.pending.get(id)
    if (!request) return
    this.pending.delete(id)
    clearTimeout(request.timer)
    if (msg.error) {
      const error = msg.error as { message?: string }
      request.resolve({ ok: false, error: error?.message ?? 'The language server reported an error.' })
      return
    }
    request.resolve({ ok: true, result: msg.result })
  }

  /** The server asks something - the client has to answer. */
  private answerRequest(id: number | string, method: string, params: unknown): void {
    this.write({ jsonrpc: '2.0', id, result: this.answerFor(method, params) })
  }

  /** The answers of the requests the servers send. */
  private answerFor(method: string, params: unknown): unknown {
    switch (method) {
      case 'workspace/configuration': {
        const items = (params as { items?: unknown[] } | undefined)?.items
        return Array.isArray(items) ? items.map(() => ({})) : []
      }
      case 'workspace/workspaceFolders': {
        const root = this.options.rootPath ? path.resolve(this.options.rootPath) : null
        if (!root) return null
        return [{ uri: toFileUri(root), name: path.basename(root) }]
      }
      case 'workspace/applyEdit':
        return { applied: false }
      case 'client/registerCapability':
      case 'client/unregisterCapability':
      case 'window/workDoneProgress/create':
      case 'window/showMessageRequest':
      case 'workspace/semanticTokens/refresh':
      case 'workspace/codeLens/refresh':
      case 'workspace/inlayHint/refresh':
      case 'workspace/inlineValue/refresh':
      case 'workspace/diagnostic/refresh':
        return null
      default:
        return null
    }
  }

  /** A notification of the server arrived. */
  private handleNotification(method: string, params: unknown): void {
    switch (method) {
      case 'textDocument/publishDiagnostics':
        this.publishDiagnostics(params)
        break
      case 'exit':
        void this.stop()
        break
      default:
        break
    }
  }

  /** The server published the problems of a document. */
  private publishDiagnostics(params: unknown): void {
    const data = params as { uri?: string; diagnostics?: unknown[] } | undefined
    const uri = data?.uri
    if (typeof uri !== 'string') return
    const language = this.host.getLanguage(uri) ?? this.languages[0] ?? 'lsp'
    const text = this.host.getText(uri) ?? ''
    const list = Array.isArray(data?.diagnostics) ? data.diagnostics : []
    const problems: LspProblem[] = []
    for (const item of list) {
      const problem = toProblem(item, text, language)
      if (problem) problems.push(problem)
    }
    this.host.onDiagnostics(language, uri, problems)
  }
}

/* ------------------------------------------------------------------ *
 * Problems
 * ------------------------------------------------------------------ */

/** The severity of a diagnostic (1 = error, 2 = warning, 3/4 = info). */
function severityOf(value: unknown): 'error' | 'warning' | 'info' {
  switch (value) {
    case 1:
      return 'error'
    case 2:
      return 'warning'
    default:
      return 'info'
  }
}

/** The offset of a line and a column in a text. */
function offsetAt(text: string, line: number, character: number): number {
  if (line < 0) return 0
  let start = 0
  for (let index = 0; index < line; index++) {
    const next = text.indexOf('\n', start)
    if (next < 0) return text.length
    start = next + 1
  }
  const end = text.indexOf('\n', start)
  const limit = end < 0 ? text.length : end
  return Math.min(start + Math.max(0, character), limit)
}

/** Turn a diagnostic of the server into a problem. */
function toProblem(raw: unknown, text: string, language: string): LspProblem | null {
  if (!raw || typeof raw !== 'object') return null
  const diagnostic = raw as {
    range?: {
      start?: { line?: number; character?: number }
      end?: { line?: number; character?: number }
    }
    severity?: number
    message?: string
    source?: string
  }
  const start = diagnostic.range?.start
  if (!start || typeof start.line !== 'number') return null
  const end = diagnostic.range?.end
  const from = offsetAt(text, start.line, start.character ?? 0)
  const to = Math.max(offsetAt(text, end?.line ?? start.line, end?.character ?? start.character ?? 0), from)
  return {
    line: start.line + 1,
    column: (start.character ?? 0) + 1,
    from,
    to,
    severity: severityOf(diagnostic.severity),
    message: diagnostic.message ?? '',
    source: diagnostic.source ?? language,
  }
}

/* ------------------------------------------------------------------ *
 * The host
 * ------------------------------------------------------------------ */

/** The running servers (one per language group). */
const servers = new Map<string, LanguageServer>()

/** The documents the servers know about. */
const documents = new Map<string, { language: string; text: string; version: number }>()

/** The options of the registration. */
let options: LspOptions = {}

/** The bridge between the servers and the renderer. */
const host: HostBridge = {
  onStatus: (language, state, message, hint) => {
    const event: LspStatusEvent = { language, state, message, hint }
    emit('lsp:status', event)
  },
  onDiagnostics: (language, uri, problems) => {
    const event: LspDiagnosticsEvent = { language, uri, problems }
    emit('lsp:diagnostics', event)
  },
  getText: (uri) => documents.get(uri)?.text,
  getLanguage: (uri) => documents.get(uri)?.language,
}

/** Send an event to the renderer. */
function emit(channel: string, payload: unknown): void {
  if (options.send) {
    try {
      options.send(channel, payload)
    } catch {
      /* the window is gone */
    }
    return
  }
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed()) continue
    try {
      win.webContents.send(channel, payload)
    } catch {
      /* the window is gone */
    }
  }
}

/**
 * The server configuration of a language: the table of the languages with the
 * overrides of the user on top of it.
 */
function resolveConfig(language: string): LspServerConfig | null {
  const key = serverKey(language)
  const base = LANGUAGE_SERVERS[key]
  if (!base) return null
  const override = options.servers?.[language.toLowerCase()] ?? options.servers?.[key]
  if (override?.disabled) return null
  return {
    command: override?.command ?? base.command,
    args: override?.args ?? base.args,
    cwd: override?.cwd ?? options.rootPath ?? undefined,
    env: override?.env,
    initializationOptions: override?.initializationOptions,
  }
}

/**
 * Start the server of a language (or reuse the one that is already running).
 */
async function ensureServer(language: string): Promise<LanguageServer | null> {
  const key = serverKey(language)
  const config = resolveConfig(language)
  // A language without a server is not an error - there simply is none.
  if (!config) return null
  const existing = servers.get(key)
  if (existing) {
    if (existing.state === 'ready') return existing
    try {
      await existing.start()
      return existing
    } catch {
      return null
    }
  }
  const server = new LanguageServer(key, config, host, options)
  servers.set(key, server)
  try {
    await server.start()
    return server
  } catch {
    return null
  }
}

/** Stop the server of a language (or all of them). */
async function stopServers(language?: string): Promise<void> {
  if (!language) {
    const running = [...servers.values()]
    servers.clear()
    for (const server of running) await server.stop()
    return
  }
  const key = serverKey(language)
  const server = servers.get(key)
  if (!server) return
  servers.delete(key)
  await server.stop()
}

/* ------------------------------------------------------------------ *
 * The registration
 * ------------------------------------------------------------------ */

/** The languages of a payload (an array or an object with `languages`). */
function readLanguages(payload: unknown): string[] {
  if (Array.isArray(payload)) {
    return payload
      .filter((entry): entry is string => typeof entry === 'string')
      .map((entry) => entry.trim().toLowerCase())
      .filter((entry) => entry !== '')
  }
  if (payload && typeof payload === 'object') {
    const list = (payload as { languages?: unknown }).languages
    if (Array.isArray(list)) return readLanguages(list)
  }
  return []
}

/**
 * The server overrides of the options. The toolchain settings may either be
 * passed as `servers` or directly as the options.
 */
function normalizeServers(opts: LspOptions): Record<string, LspServerOverride> {
  const result: Record<string, LspServerOverride> = {}
  const known = new Set(['servers', 'rootPath', 'requestTimeout', 'send'])
  const source = opts.servers ?? {}
  for (const [key, value] of Object.entries(source)) {
    if (!value || typeof value !== 'object') continue
    result[key.trim().toLowerCase()] = value
  }
  for (const [key, value] of Object.entries(opts as Record<string, unknown>)) {
    if (known.has(key)) continue
    if (!value || typeof value !== 'object') continue
    const override = value as LspServerOverride
    if (override.command === undefined && override.args === undefined) continue
    result[key.trim().toLowerCase()] = override
  }
  return result
}

/** Are two argument lists the same? */
function sameArgs(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  return a.every((entry, index) => entry === b[index])
}

/** Register a handler (an old one is removed first). */
function handle(channel: string, listener: (event: unknown, payload: unknown) => unknown): void {
  ipcMain.removeHandler(channel)
  ipcMain.handle(channel, listener)
}

/**
 * Register the handlers of the language servers.
 *
 * The options let the user replace the command and the arguments of every
 * language (the toolchain settings of the app fill this in).
 */
export function registerLspHandlers(opts: LspOptions = {}): void {
  options = { ...opts, servers: normalizeServers(opts) }

  // A server whose command changed is stopped: it is started again with the
  // new command the next time a document of its language is opened.
  for (const [key, server] of servers) {
    const language = server.languages[0]
    if (!language) continue
    const config = resolveConfig(language)
    if (!config) continue
    if (config.command === server.config.command && sameArgs(config.args, server.config.args)) continue
    servers.delete(key)
    void server.stop()
  }

  handle('lsp:start', async (_event: unknown, payload: unknown) => {
    const languages = readLanguages(payload)
    const started: string[] = []
    for (const language of languages) {
      const server = await ensureServer(language)
      if (server) started.push(language)
    }
    return started
  })

  handle('lsp:didOpen', async (_event: unknown, payload: unknown) => {
    const data = payload as { language?: string; uri?: string; text?: string } | undefined
    const language = (data?.language ?? '').trim().toLowerCase()
    const uri = toFileUri(data?.uri ?? '')
    if (!language || !uri) return false
    const server = await ensureServer(language)
    if (!server) return false
    const text = data?.text ?? ''
    documents.set(uri, { language, text, version: 1 })
    server.openDocument(uri, language, text)
    return true
  })

  handle('lsp:didChange', async (_event: unknown, payload: unknown) => {
    const data = payload as { language?: string; uri?: string; text?: string } | undefined
    const language = (data?.language ?? '').trim().toLowerCase()
    const uri = toFileUri(data?.uri ?? '')
    if (!language || !uri) return false
    const server = await ensureServer(language)
    if (!server) return false
    const text = data?.text ?? ''
    const known = documents.get(uri)
    const version = (known?.version ?? 0) + 1
    documents.set(uri, { language, text, version })
    server.changeDocument(uri, version, known?.text ?? '', text)
    return true
  })

  handle('lsp:didClose', async (_event: unknown, payload: unknown) => {
    const data = payload as { language?: string; uri?: string } | undefined
    const language = (data?.language ?? '').trim().toLowerCase()
    const uri = toFileUri(data?.uri ?? '')
    if (!uri) return false
    documents.delete(uri)
    const server = language ? servers.get(serverKey(language)) : undefined
    server?.closeDocument(uri)
    return true
  })

  handle('lsp:request', async (_event: unknown, payload: unknown) => {
    const data = payload as { language?: string; method?: string; params?: unknown } | undefined
    const language = (data?.language ?? '').trim().toLowerCase()
    const method = (data?.method ?? '').trim()
    if (!language || !method) return null
    const server = await ensureServer(language)
    if (!server) return null
    return server.request(method, data?.params ?? null)
  })

  handle('lsp:stop', async (_event: unknown, payload: unknown) => {
    const language =
      typeof payload === 'string'
        ? payload.trim().toLowerCase()
        : ((payload as { language?: string } | undefined)?.language ?? '').trim().toLowerCase()
    await stopServers(language || undefined)
    return true
  })
}

/** Stop every server (the app is going down). */
export async function stopAllLspServers(): Promise<void> {
  await stopServers()
}
