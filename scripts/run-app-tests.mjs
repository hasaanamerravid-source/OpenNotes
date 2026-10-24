/**
 * Runs the in-app test harness inside OpenNotes and prints the report.
 *
 *   node scripts/run-app-tests.mjs [rounds]
 *
 * Each round boots the app, executes scripts/app-test-harness.js in the renderer
 * and reports failures. A round that dies without a report is a crash.
 */
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const electron = resolve(root, 'node_modules', 'electron', 'dist', 'electron.exe')
const harness = resolve(here, process.argv[3] ?? 'app-test-harness.js')
const rounds = Number(process.argv[2] ?? 1)

function runRound(index) {
  return new Promise((done) => {
    const userData = mkdtempSync(join(tmpdir(), `opennotes-test-${index}-`))
    const child = spawn(electron, [root], {
      env: {
        ...process.env,
        OPENNOTES_EVAL_FILE: harness,
        OPENNOTES_USERDATA: userData,
        OPENNOTES_TEST_CLICK: '1',
        OPENNOTES_NO_THROTTLE: '1',
        ELECTRON_ENABLE_LOGGING: '1',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let out = ''
    let err = ''
    const timer = setTimeout(() => {
      child.kill()
    }, 420000)

    child.stdout.on('data', (d) => {
      out += d.toString()
    })
    child.stderr.on('data', (d) => {
      err += d.toString()
    })
    child.on('exit', (code) => {
      clearTimeout(timer)
      const match = out.match(/\[eval\]\s*([\s\S]*)$/)
      let report = null
      if (match) {
        try {
          report = JSON.parse(JSON.parse(match[1].trim()))
        } catch {
          report = null
        }
      }
      if (!report) {
        // Keep the evidence of a crash: the app writes its own log there.
        const logFile = join(userData, 'logs', 'opennotes.log')
        if (existsSync(logFile)) {
          console.log('  --- app log ---')
          console.log(readFileSync(logFile, 'utf8').split('\n').slice(-25).join('\n'))
        }
      }
      try {
        rmSync(userData, { recursive: true, force: true })
      } catch {
        /* ignore */
      }
      done({ code, out, err, report })
    })
  })
}

let totalFailed = 0
let crashed = 0

for (let i = 1; i <= rounds; i++) {
  const result = await runRound(i)
  if (!result.report) {
    crashed++
    console.log(`\n=== round ${i}: CRASHED (exit ${result.code}) ===`)
    console.log(
      result.err
        .split('\n')
        .filter((l) => l.trim())
        .slice(0, 25)
        .join('\n'),
    )
    continue
  }
  const { ok, failed, notes } = result.report
  totalFailed += failed.length
  console.log(`\n=== round ${i}: ${ok.length} passed, ${failed.length} failed ===`)
  if (failed.length) failed.forEach((f) => console.log('  FAIL ' + f))
  if (notes.length) notes.forEach((n) => console.log('  NOTE ' + n))
  const stderrLines = result.err.split('\n').filter((l) => l.trim() && !l.includes('ResizeObserver'))
  if (stderrLines.length) {
    console.log('  stderr:')
    stderrLines.slice(0, 12).forEach((l) => console.log('    ' + l.slice(0, 200)))
  }
}

console.log(`\nTOTAL: ${totalFailed} failed checks, ${crashed} crashed round(s)`)
process.exit(totalFailed === 0 && crashed === 0 ? 0 : 1)
