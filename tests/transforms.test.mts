/**
 * The tests of the text transforms.
 *
 * The transforms are used by the commands of the Format menu. A mistake here
 * changes the content of a file, so the rules about line endings and about
 * the trailing newline are checked as well.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  changeCase,
  countOccurrences,
  insertLineNumbers,
  joinLines,
  removeBlankLines,
  removeDuplicateLines,
  removeLineNumbers,
  sortLines,
  trimTrailingWhitespace,
} from '../src/renderer/src/core/transforms.ts'

test('the lines are sorted', () => {
  assert.equal(sortLines('b\na\nc'), 'a\nb\nc')
  assert.equal(sortLines('b\na\nc', true), 'c\nb\na')
})

test('the sorting keeps the line ending', () => {
  assert.equal(sortLines('b\r\na\r\nc\r\n'), 'a\r\nb\r\nc\r\n')
  assert.equal(sortLines('b\r\na\r\nc'), 'a\r\nb\r\nc')
})

test('the sorting keeps a trailing newline', () => {
  assert.equal(sortLines('b\na\n'), 'a\nb\n')
  assert.equal(sortLines('b\na'), 'a\nb')
})

test('the sorting of an empty text is empty', () => {
  assert.equal(sortLines(''), '')
})

test('the duplicated lines are removed', () => {
  assert.equal(removeDuplicateLines('a\nb\na\nc\nb'), 'a\nb\nc')
})

test('the empty lines are removed', () => {
  assert.equal(removeBlankLines('a\n\n   \nb'), 'a\nb')
})

test('the trailing whitespace is removed', () => {
  assert.equal(trimTrailingWhitespace('a  \nb\t\nc'), 'a\nb\nc')
})

test('the lines are joined into one line', () => {
  assert.equal(joinLines('a\n  b  \nc'), 'a b c')
})

test('the case is changed', () => {
  assert.equal(changeCase('hello world', 'upper'), 'HELLO WORLD')
  assert.equal(changeCase('HELLO WORLD', 'lower'), 'hello world')
  assert.equal(changeCase('hello world', 'title'), 'Hello World')
  assert.equal(changeCase('hello world', 'sentence'), 'Hello world')
  assert.equal(changeCase('Hello World', 'toggle'), 'hELLO wORLD')
})

test('the line numbers are inserted and removed again', () => {
  const source = 'first\nsecond\nthird'
  const numbered = insertLineNumbers(source)
  assert.equal(numbered, '1\tfirst\n2\tsecond\n3\tthird')
  assert.equal(removeLineNumbers(numbered), source)
})

test('the line numbers can start somewhere else', () => {
  assert.equal(insertLineNumbers('a\nb', 9), ' 9\ta\n10\tb')
  assert.equal(removeLineNumbers(' 9\ta\n10\tb'), 'a\nb')
})

test('the occurrences of a text are counted', () => {
  assert.equal(countOccurrences('one two one', 'one'), 2)
  assert.equal(countOccurrences('one two one', 'ONE'), 0)
  assert.equal(countOccurrences('one two one', 'ONE', false), 2)
  assert.equal(countOccurrences('one two one', ''), 0)
})

test('the occurrences do not overlap', () => {
  assert.equal(countOccurrences('aaaa', 'aa'), 2)
})

test('a whole word is counted as a word', () => {
  assert.equal(countOccurrences('cat category', 'cat'), 2)
  assert.equal(countOccurrences('cat category', 'cat', true, true), 1)
})

test('a needle with a special character is found literally', () => {
  assert.equal(countOccurrences('a.b axb', 'a.b'), 1)
  assert.equal(countOccurrences('a+b axb', 'a+b'), 1)
})
