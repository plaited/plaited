import { expect, test } from '@jest/globals'
import { reduceWhitespace } from '../index.js'

test('reduceWhitespace()', () => {
  expect(reduceWhitespace(`hello     world`)).toBe('hello world')
  expect(reduceWhitespace(`  hello     world  `)).toBe(' hello world ')
  expect(reduceWhitespace(`hello    
  
  world`)).toBe('hello world')
})
