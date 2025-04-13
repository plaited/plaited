import { test, expect } from 'bun:test'
import { hashString } from 'plaited/utils'

test('hashString(): Given a string, return a hash', () => {
  expect(hashString('test')).toBe(2090756197)
})

test('hashString(): Given a empty string, return null', () => {
  expect(hashString('')).toBe(null)
})

test('hashString(): returns consistent value', () => {
  expect(hashString('hello')).toBe(hashString('hello'))
})
