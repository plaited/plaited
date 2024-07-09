import { expect, test } from 'bun:test'
import { reduceWhitespace } from '../reduce-whitespace.js'

test('reduceWhitespace()', () => {
  expect(reduceWhitespace(`hello     world`)).toBe('hello world')
  expect(reduceWhitespace(`  hello     world  `)).toBe(' hello world ')
  expect(
    reduceWhitespace(`hello    
  
  world`),
  ).toBe('hello world')
})
