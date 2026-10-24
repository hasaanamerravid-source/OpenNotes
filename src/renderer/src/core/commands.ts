import type { Command } from '@shared/types'

const registry = new Map<string, Command>()
const listeners = new Set<() => void>()

/** Register a single command. Later registrations replace earlier ones with the same id. */
export function registerCommand(command: Command): void {
  registry.set(command.id, command)
  listeners.forEach((l) => l())
}

/** Register a list of commands. */
export function registerCommands(commands: Command[]): void {
  commands.forEach(registerCommand)
  listeners.forEach((l) => l())
}

/** Remove a command. */
export function unregisterCommand(id: string): void {
  registry.delete(id)
  listeners.forEach((l) => l())
}

/** All registered commands. */
export function getCommands(): Command[] {
  return [...registry.values()]
}

/** Look up one command. */
export function getCommand(id: string): Command | undefined {
  return registry.get(id)
}

/**
 * The shortcuts of the commands, keyed by the id of the command.
 *
 * They are the default bindings: the keybindings of the user and the ones of
 * the project win over them.
 */
export function getShortcutMap(): Record<string, string> {
  const out: Record<string, string> = {}
  for (const command of registry.values()) {
    if (command.shortcut) out[command.id] = command.shortcut
  }
  return out
}

/**
 * The commands the native menu binds to a key itself.
 *
 * A key that the menu handles must not run the command a second time in the
 * renderer. The list comes from the main process; a command that the user has
 * bound to another key is not in it, because the menu gave up its
 * accelerator.
 */
let menuAccelerators = new Set<string>()

/** Remember the commands the native menu handles. */
export function setMenuAccelerators(commands: string[]): void {
  menuAccelerators = new Set(commands)
}

/** Does the native menu bind this command to a key? */
export function handledByMenu(command: string): boolean {
  return menuAccelerators.has(command)
}

/** Subscribe to registry changes (used by the command palette). */
export function onCommandsChanged(cb: () => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

/**
 * The commands that were used last.
 *
 * The palette shows them first: the command that is used ten times a day
 * should not have to be searched for.
 */
const recent: string[] = []

/** The commands that were used last, the newest first. */
export function getRecentCommands(): string[] {
  return [...recent]
}

/** Remember that a command was used. */
export function noteCommandUsage(id: string): void {
  const index = recent.indexOf(id)
  if (index >= 0) recent.splice(index, 1)
  recent.unshift(id)
  if (recent.length > 20) recent.length = 20
}

/**
 * Run a command by id. Ids may carry a payload suffix, e.g. `format.setLanguage:python`.
 */
export async function runCommand(id: string, payload?: unknown): Promise<void> {
  const direct = registry.get(id)
  if (direct) {
    noteCommandUsage(direct.id)
    await direct.run(payload)
    return
  }
  const [base, ...rest] = id.split(':')
  const baseCmd = registry.get(base)
  if (baseCmd) {
    noteCommandUsage(baseCmd.id)
    await baseCmd.run(rest.join(':') || payload)
    return
  }
  console.warn('[opennotes] unknown command:', id)
}
