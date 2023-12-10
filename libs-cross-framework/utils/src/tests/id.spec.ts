import { test, expect } from 'bun:test'
import { generateId, setIdCounter, ueid } from '../index.js'

test('ueid: returns a string', () => {
  const output = ueid()
  expect(typeof output).toBe('string')
})

test('ueid: should return unique ids', () => {
  const ids = new Array(5).fill(null).map(ueid)
  const uniqued = [...new Set(ids)]

  expect(ids.length).toBe(5)
  expect(uniqued.length).toBe(5)
})

test('ueid: supports an optional prefix', () => {
  expect(ueid('a-').startsWith('a-')).toBe(true)
  expect(ueid('b-').startsWith('b-')).toBe(true)
  expect(ueid('c:').startsWith('c:')).toBe(true)
  expect(ueid('word_').startsWith('word_')).toBe(true)
})

test('generateId: should return string with iterated count', () => {
  expect(generateId()).toBe('0')
  expect(generateId()).toBe('1')
})

test('generateId: should return prefixed string with iterated count', () => {
  expect(generateId('pre-')).toBe('pre-2')
  expect(generateId('pre-')).toBe('pre-3')
})

test('generateId: should return reset prefixed string with iterated count', () => {
  setIdCounter(0)
  expect(generateId('pre-')).toBe('pre-0')
  expect(generateId('pre-')).toBe('pre-1')
})
