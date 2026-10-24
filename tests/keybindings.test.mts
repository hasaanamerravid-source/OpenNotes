/**
 * The tests of the shortcuts.
 *
 * A shortcut that cannot be parsed is a shortcut that does not work, and a
 * shortcut that matches the wrong key runs the wrong command.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseShortcut, fromVSCode } from '../src/renderer/src/core/keybindings.ts'

test('a shortcut is read', () => {
  const shortcut = parseShortcut('Ctrl+Shift+S')
  assert.deepEqual(shortcut, { ctrl: true, shift: true, alt: false, meta: false, key: 'S' })
})

test('the names of the modifiers are understood', () => {
  assert.equal(parseShortcut('control+alt+shift+meta+k')?.ctrl, true)
  assert.equal(parseShortcut('control+alt+shift+meta+k')?.alt, true)
  assert.equal(parseShortcut('control+alt+shift+meta+k')?.shift, true)
  assert.equal(parseShortcut('control+alt+shift+meta+k')?.meta, true)
  assert.equal(parseShortcut('Cmd+S')?.meta, true)
  assert.equal(parseShortcut('Option+S')?.alt, true)
})

test('a shortcut that ends with a plus is the plus key', () => {
  // "Ctrl++" is the plus key with the control key.
  const shortcut = parseShortcut('Ctrl++')
  assert.equal(shortcut?.ctrl, true)
  assert.equal(shortcut?.key, '+')
})

test('a shortcut without a key is nothing', () => {
  assert.equal(parseShortcut(''), null)
  assert.equal(parseShortcut('Ctrl'), null)
  assert.equal(parseShortcut('   '), null)
})

test('the key of a shortcut keeps its case', () => {
  assert.equal(parseShortcut('Ctrl+F5')?.key, 'F5')
  assert.equal(parseShortcut('Ctrl+`')?.key, '`')
})

test('the shortcuts of the other editor are translated', () => {
  const imported = fromVSCode(
    JSON.stringify([
      { key: 'ctrl+s', command: 'workbench.action.files.save' },
      { key: 'ctrl+shift+p', command: 'workbench.action.showCommands' },
    ]),
  )
  assert.equal(imported['file.save'], 'Ctrl+S')
  assert.equal(imported['view.commandPalette'], 'Ctrl+Shift+P')
})

test('an unknown command of the other editor is skipped', () => {
  const imported = fromVSCode(JSON.stringify([{ key: 'ctrl+q', command: 'workbench.action.quit' }]))
  assert.deepEqual(imported, {})
})

test('a broken list does not throw', () => {
  assert.deepEqual(fromVSCode('not json'), {})
  assert.deepEqual(fromVSCode('[]'), {})
  assert.deepEqual(fromVSCode('[{"key":"ctrl+s"}]'), {})
})
