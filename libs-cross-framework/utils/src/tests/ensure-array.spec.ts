import { test, expect } from 'bun:test'
import { ensureArray } from '../index.js'

test('ensureArray(): return an array either empty, with a single value or the original array', () => {
  expect(ensureArray(['a', 'b', 'c'])).toEqual(['a', 'b', 'c'])
  expect(ensureArray('a')).toEqual(['a'])
  expect(ensureArray()).toEqual([])
})
