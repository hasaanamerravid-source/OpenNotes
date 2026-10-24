# Testing

OpenNotes has five test suites. Three of them run without Electron, two of
them drive the real application.

| Suite | npm script | What it covers |
| --- | --- | --- |
| The unit tests | `npm run test:unit` | The pure logic: translations, transforms, shortcuts, messages |
| The in-app suite | `npm run test:app` | The feature surface in one session: editors, panels, menus, terminal, large files |
| The stress suite | `npm run test:stress` | Large files, many tabs, binary content. The application has to survive. |

There is a sixth suite for the language support:
`npm run test:languages` (`scripts/language-smoke.js`) opens a sample file for
every supported language and checks that it is detected and colourised.

## The commands

```bash
npm run test:unit       # node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --import ./scripts/register-ts.mjs --test tests/*.test.mts
npm run test:app        # node scripts/run-app-tests.mjs 1
npm run test:stress     # node scripts/run-app-tests.mjs 1 stress-harness.js
npm run test:languages  # node scripts/run-app-tests.mjs 1 language-smoke.js
npm run typecheck       # tsc --noEmit for the main and for the renderer
```

`npm run check` is the gate that runs everything that does not need a
display:

```bash
npm run format:check && npm run typecheck && npm run i18n:check && npm run test:unit && npm run build
```

The in-app suites are not part of `check` — they need a window.

## The unit tests

`tests/*.test.mts` run on the test runner of Node (`node --test`) with
`node:assert/strict`:

```ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
  assert.equal(parsed.body, '# Hello\n\nWorld')
})
```

The sources of the project are imported directly, without a build step.
`scripts/register-ts.mjs` installs the loader of `scripts/ts-hook.mjs`, which

* resolves the path aliases of the project (`@shared/*` → `src/shared`,
  `@/*` → `src/renderer/src`) and the imports without a file extension,
* leaves the TypeScript to Node, which removes the types itself,
* turns a JSON file into an ES module, so that the catalogues of the
  translation can be imported the way the bundler imports them.

| File | What it checks |
| --- | --- |
| `tests/i18n.test.mts` | `src/shared/i18n/index.ts`: the list of the locales, the fallback to English for a missing key or an unknown language, the placeholders, the direction of a right-to-left language, the progress of a language, the format of a date and of a number. |
| `tests/frontmatter.test.mts` | `src/renderer/src/core/frontmatter.ts`: the values of the frontmatter, a frontmatter without a closing fence, the number of its lines, the write-back and the round trip, the wikilinks (with an alias, twice, inside a code block), the tags (nested, inside a word), the headings (the levels, the line, inside a code block). |
| `tests/transforms.test.mts` | `src/renderer/src/core/transforms.ts`: sorting (the line ending and the trailing newline are kept), removing the duplicated and the empty lines, trimming the trailing whitespace, joining the lines, changing the case, the line numbers, and the counting of the occurrences (case, whole word, overlapping, special characters). |
| `tests/keybindings.test.mts` | `src/renderer/src/core/keybindings.ts`: reading a shortcut, the names of the modifiers, a shortcut that ends with a plus (`Ctrl++`), a shortcut without a key, and the import of the shortcuts of another editor. |

A good unit test names the behaviour, not the function:

```ts
test('a missing translation falls back to English', () => {
  const english = translate('en', 'app.tagline')
  assert.equal(typeof english, 'string')
  assert.ok(english.length > 0)
})
```

The assertions should be exact (`assert.equal` with the expected value) so
that a wrong result is named in the report. A test that only proves that
nothing threw is weak.

## The smoke tests

(removed — vault/docs features deleted) are plain Node scripts.
They are bundled with `rolldown` (`platform: 'node'`, `electron` is external)
and executed with Node, so they need neither Electron nor the application:

```js
const bundle = await rolldown({
  input: resolve(here, 'vault-smoke.ts'),
  platform: 'node',
  external: ['electron'],
})
await bundle.write({ file: out, format: 'esm' })
```

The bundle is written next to the script (`.vault-smoke.mjs`,
`.docs-smoke.mjs`) and run in a child process. The exit code of the child is
the exit code of the script.

Both use the same helper:

```ts
function check(name: string, condition: boolean, extra = ''): void {
  if (condition) console.log(`  ok   ${name}`)
  else {
    failures++
    console.log(`  FAIL ${name} ${extra}`)
  }
}
```

The output is a list of `ok` and `FAIL` lines, and the exit code is `1` when
a check failed.

| File | What it checks |
| --- | --- |
| `scripts/vault-smoke.ts` | `parseFrontmatter`, `stringifyFrontmatter`, `extractWikiLinks`, `extractTags` and `extractHeadings` from `src/renderer/src/core/frontmatter.ts`: the values of the frontmatter, the links with and without a path, the nested tags, the tags inside a code span are ignored, the levels of the headings, and the round trip. |
| `scripts/docs-smoke.ts` | `detectDocFormat`, `readDocument`, `writeDocument` and `documentToMarkdown` from `src/main/docs/index.ts`: the detection of docx, odt, rtf, md and csv, and a round trip of every format (write, read, compare). |

The documents are written into a temporary folder (`mkdtemp`), so nothing is
left behind.

## The in-app suite

`scripts/app-test-harness.js` is executed inside the renderer of a real
Electron window. `scripts/run-app-tests.mjs` starts the application, injects
the script and prints the report.

### The runner

```bash
node scripts/run-app-tests.mjs [rounds] [harness]
```

* `rounds` — how often the application is started (default `1`). More rounds
  shake out the problems that only appear when the state is not fresh.
* `harness` — the file with the script that runs inside the renderer. The name
  is resolved relative to `scripts/`, the default is `app-test-harness.js`.

```bash
node scripts/run-app-tests.mjs 3                 # the in-app harness, three times
node scripts/run-app-tests.mjs 1 stress-harness.js
node scripts/run-app-tests.mjs 1 my-harness.js    # a harness of your own
```

Every round gets its own user-data folder (`mkdtemp` in the temporary
directory), so the runs do not touch the settings of the user and do not
influence each other. The folder is deleted when the round is over.

The application is started with these environment variables:

| Variable | Effect |
| --- | --- |
| `OPENNOTES_EVAL_FILE` | The script that is executed in the renderer after the start-up. |
| `OPENNOTES_USERDATA` | The user-data folder of this round. |
| `OPENNOTES_TEST_CLICK` | `1` enables `window.api.test.click(x, y)`, a real mouse click at window coordinates. |
| `OPENNOTES_NO_THROTTLE` | `1` turns the background throttling of the window off, so a background tab is not slowed down. |
| `ELECTRON_ENABLE_LOGGING` | `1` writes the log of Chromium to the standard error output. |

`OPENNOTES_EVAL` (an expression instead of a file) and `OPENNOTES_SNAPSHOT`
(a screenshot) are the other two debugging helpers of `src/main/index.ts`. A
round is killed after 420 seconds.

### The report

The harness returns one object:

```js
{ ok: ['name of the step', ...], failed: ['name of the step :: reason', ...], notes: ['free text', ...] }
```

`scripts/run-app-tests.mjs` prints it like this (the counts are the length of
the two arrays):

```
=== round 1: 88 passed, 1 failed ===
  FAIL save: writes the file :: returned false
  NOTE start: ready=true statusBar=true sidebar=true theme=dark
  stderr:
    ...
TOTAL: 1 failed checks, 0 crashed round(s)
```

* A line that starts with `FAIL` is a step that did not pass. The text behind
  `::` is the reason.
* A line that starts with `NOTE` is free text that the harness wrote into the
  `notes` array. It is used for diagnostics: the state at the start of the
  run, the time a slow operation took, the values that explain a failure.
* The first twelve lines of the standard error output follow, without the
  lines of the `ResizeObserver`.
* The last line is the summary. The exit code is `0` when no check failed and
  no round crashed, otherwise `1`.

A round that dies without a report is a crash. The runner prints the tail of
the application log in that case:

```
  --- app log ---
2026-01-01 09:00:00.000 APP START 1.0.0 electron 44.9.0
2026-01-01 09:00:03.500 CRASH [renderer] ...
=== round 1: CRASHED (exit 1) ===
```

### The helpers

The harness reaches into the application through the scripting surface of the
renderer (`src/renderer/src/main.tsx`):

| Name | What it is |
| --- | --- |
| `api` | `window.api` — the preload bridge. |
| `store` | `window.opennotes.store` — the Zustand store of the application. |
| `run` | `window.opennotes.run` — runs a command by id. |
| `useAppStoreSetState` | `window.opennotes.setState` — writes into the store without an action. |
| `wait(ms)` | A promise that resolves after the given number of milliseconds. |
| `step(name, fn)` | Runs one step. |
| `check(name, condition, extra)` | Records one assertion. |
| `report.notes.push(text)` | Adds a line of diagnostics to the report. |

`step` is the workhorse:

```js
const step = async (name, fn) => {
  try {
    const result = await fn()
    if (result === false) report.failed.push(name + ' :: returned false')
    else report.ok.push(name)
    console.error('[harness] ' + name + ' -> ' + (result === false ? 'false' : 'ok'))
    return result
  } catch (err) {
    report.failed.push(name + ' :: ' + (err && err.message ? err.message : String(err)))
    console.error('[harness] ' + name + ' -> ERROR ' + (err && err.message ? err.message : String(err)))
    return null
  }
}
```

Three things follow from this:

* An exception inside the step is caught and turned into a failed check. The
  run continues.
* Only the exact value `false` is a failure. A step that returns `undefined`
  counts as **passed**. A step must therefore end with `return true` (or with
  the value of the assertion) — a forgotten `return` silently passes.
* The step name is the name of the check. It should read like a sentence
  (`'vault: index has backlinks'`) so that a failure report names the
  behaviour that is broken.

`check` records an assertion without running it in a protected block. It does
not catch exceptions, so a `check` inside code that can throw aborts the
whole harness — and a harness that aborts looks like a crash to the runner.
Prefer `step`. (The helper is defined in `scripts/app-test-harness.js` but the
current harness does not use it.)

### What a good check asserts

A check has to be about a behaviour, not about an implementation detail, and
it has to fail when the behaviour is broken. The pattern that the harness
uses:

```js
await step('open: markdown', async () => {
  await store.getState().openPath(dir + '/Welcome.md')
  await wait(900)
  const tab = store.getState().tabs.find((t) => t.path && t.path.endsWith('Welcome.md'))
  return tab && tab.mode === 'markdown' && document.querySelectorAll('.cm-content').length === 1
})
```

* **Act** — drive the application the way a user would: through the store
  (`openPath`, `newTab`, `updateTab`), through a command
  (`await run('edit.duplicateLine')`) or through a real click.
* **Wait** — the interface is rendered by React and the editors are
  asynchronous. Give the change time to appear.
* **Assert** — check the state *and* the result in the DOM. A tab that says
  `mode === 'markdown'` is not enough: the editor has to be on the screen.
* **Return the result** — the last expression is the verdict.

A check that only proves that "nothing threw" is weak. `edit: select all` and
`format: sort lines` in the harness are examples of the minimal form; they
exist to prove that the command does not crash, not to prove the behaviour.

### The rules for a new check

1. **Never leave a modal open.** A dialog, a prompt or the palette swallows
   the keys and the clicks of every later step. Close it again in the same
   step, or use the reset step (`setup: reset the workspace`) that closes
   every dialog and dismisses a stuck modal before the interactive part of
   the run.
2. **Wait for the interface.** After an action that renders something, wait
   for it (`await wait(900)`). The editors, the vault index, the graph and
   the panels need time; a check that reads the DOM too early fails without
   a reason.
3. **Keep the run deterministic.** Create your own fixtures
   (`api.fs.writeTextFile`), reset the state that you change, and restore it
   at the end of the step. The harness must give the same result when it runs
   for the tenth time.
4. **Do not depend on the machine.** The only absolute path that may be used
   is the test vault (`I:/notepad/.test-vault`, `I:/notepad/.stress`,
   `I:/notepad/.lang-vault`). Everything else has to be relative to it or
   inside the user-data folder of the round. Do not rely on a font, on the
   size of the screen, on a locale or on a program that is installed.
5. **Do not open a native dialog.** A native file dialog blocks the
   application until a human answers it. The commands that open one are
   listed in the `skip` array of the command sweep.
6. **Do not depend on the order of the tabs.** Find a tab by its path, not by
   its index.
7. **Explain a failure in the `notes`.** When a check fails, push the values
   that explain it into `report.notes` — the note is printed under the
   failure and is often the only thing that makes the difference visible.

### The controlled inputs

A React input does not react to `input.value = 'x'`: the value has to be set
through the native setter and an `input` event has to be sent.

```js
const input = document.querySelector('.project-search-panel input')
const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
setter.call(input, 'line one')
input.dispatchEvent(new Event('input', { bubbles: true }))
```

The same pattern is used for the palette, for the search panel and for the
terminal input.

### The command sweep

One step runs every registered command and collects the failures:

```js
const list = registry.list()
const failures = []
for (const command of list) {
  if (skip.includes(command.id)) continue
  try {
    await Promise.race([Promise.resolve(command.run()), wait(1200)])
    await wait(40)
  } catch (err) {
    failures.push(command.id + ': ' + (err && err.message ? err.message : String(err)))
  }
}
```

A command that hangs is cut off after 1.2 seconds. A new command that opens a
native dialog has to be added to the `skip` array, otherwise the sweep
blocks the run. The commands in the list are `file.open`, `file.save`,
`file.saveAs`, `file.exportPdf`, `file.print`, `file.openFromClipboard`,
`vault.openVault`, `vault.createSample`, `vault.createNote`, `tools.compare`,
`tools.openTerminal`, `tools.macroStop`, `help.about`, `help.welcome` and
`file.exportMarkdown`.

### The real mouse clicks

With `OPENNOTES_TEST_CLICK=1` the harness can send a real mouse click at
window coordinates:

```js
const rect = element.getBoundingClientRect()
window.api.test.click(Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2))
```

This proves that a control is not swallowed by a drag region of the custom
window frame — something a synthetic `element.click()` cannot show.

## The stress suite

`scripts/stress-harness.js` uses the same `step` helper and the same report
format. It creates the following fixtures and opens them:

| Fixture | What it proves |
| --- | --- |
| An 8 MB text file | The editor opens it; the time is written into the `notes`. |
| A source file with 50 000 lines | The editor opens it and holds the content. |
| A 2 MB markdown file | The preview is clipped instead of freezing. |
| A binary file | The application refuses it gracefully and shows a toast. |
| 20 tabs in a row | The tab bar survives. |
| A fast switch between all tabs | The application stays responsive. |
| Saving the 8 MB file | The save works and is measured. |
| `persistSession()` | The session is written. |

The suite does not fail on a slow machine: it measures the time and writes it
into the `notes` instead of asserting a limit.

## Diagnosing a failure

1. **Read the report.** A `FAIL` line names the step and the reason. A step
   that ends with `:: returned false` did not find what it looked for; a step
   with a message threw an exception.
2. **Read the notes.** The `notes` of the run carry the state that explains
   the failure: the state at the start of the run, the values of the failed
   assertion, the time an operation took.
3. **Read the log of the application.** The log is in the user-data folder:
   `logs/opennotes.log`. It holds the start of the application (`APP START`),
   the crashes (`CRASH [uncaughtException]`, `CRASH [renderer]`) and the
   messages of the renderer (`RENDERER ERROR`, `RENDERER WARN`). The runner
   prints the last 25 lines of that file when a round crashed. The path of
   the folder is the one that `OPENNOTES_USERDATA` points to; in a normal
   installation it is the user-data folder of the application.
4. **Read the standard error output.** The runner prints the first twelve
   lines of it. The lines of the `ResizeObserver` are filtered out because
   they are noise.
5. **Run it again.** A single round is cheap; three rounds
   (`node scripts/run-app-tests.mjs 3`) show whether the failure is a race.

## The test data

The harnesses write into three folders in the repository:

| Folder | Written by |
| --- | --- |
| `.test-vault` | `scripts/app-test-harness.js` |
| `.stress` | `scripts/stress-harness.js` |
| `.lang-vault` | `scripts/language-smoke.js` |

`npm run clean` removes the first two of them (together with `.demo` and
`.probe-vault`). The folder `.lang-vault` is not in the list of
`scripts/clean.ps1` and has to be deleted by hand.

## The translation files

`scripts/i18n.mjs` is not a test suite, but it checks the language files
against the English catalogue, which is the source of truth
(`src/shared/i18n/en.ts`):

```bash
node scripts/i18n.mjs check               # every language file
node scripts/i18n.mjs coverage [locale]   # how much is translated
node scripts/i18n.mjs template <locale>   # a template for a new language
```

`check` reports unknown keys, empty values and missing `{{placeholders}}`
and exits with `1` when it finds a problem.
