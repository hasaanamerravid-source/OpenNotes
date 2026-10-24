/**
 * Starts OpenNotes.
 *
 * The packaged application is preferred: its process is called "OpenNotes",
 * while the development runtime is "electron.exe". When the application has
 * not been packaged yet, the native CMake launcher is used (if it has been
 * built), and the Electron runtime otherwise.
 *
 * Every argument is forwarded, so files can be opened from the command line
 * or a file manager.
 *
 *   node scripts/launch.mjs [file ...]
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const args = process.argv.slice(2)

/** The packaged application: the process is called "OpenNotes". */
const packaged = [
  process.env.OPENNOTES_APP,
  join(root, 'release', 'win-unpacked', 'OpenNotes.exe'),
  join(root, 'release', 'linux-unpacked', 'opennotes'),
  join(root, 'release', 'OpenNotes.exe'),
  join(root, 'OpenNotes.exe'),
].filter(Boolean)

/** The native launcher, when it has been built. */
const launchers = [
  join(root, 'build-launcher', 'Release', 'opennotes-launcher.exe'),
  join(root, 'build-launcher', 'opennotes-launcher.exe'),
  join(root, 'build-launcher', 'Debug', 'opennotes-launcher.exe'),
  join(root, 'bin', 'opennotes-launcher.exe'),
  join(root, 'build-launcher', 'opennotes-launcher'),
  join(root, 'bin', 'opennotes-launcher'),
]

/** The development runtime. */
const runtime = process.env.OPENNOTES_ELECTRON ?? join(root, 'node_modules', 'electron', 'dist', 'electron.exe')

const app = packaged.find((path) => existsSync(path))
const launcher = launchers.find((path) => existsSync(path))

/**
 * Start a program without a console window and without waiting for it: the
 * launcher hands the work over and gets out of the way.
 */
function start(program, programArgs) {
  const child = spawn(program, programArgs, {
    stdio: 'ignore',
    detached: true,
    windowsHide: true,
  })
  child.unref()
  console.log(`OpenNotes started (${program})`)
}

if (app) {
  start(app, args)
} else if (launcher) {
  start(launcher, args)
} else if (existsSync(runtime)) {
  console.log('OpenNotes started (development runtime — build the installer for the real application)')
  start(runtime, [root, ...args])
} else {
  console.error('The Electron runtime is missing. Run "npm install" first.')
  process.exit(1)
}
