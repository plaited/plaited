import { test, expect } from 'bun:test'
import { toId } from '../utils.js'

test('toId', () => {
  const actual = toId('Example/Element', 'basic')
  expect(actual).toBe('example-element--basic')
})
