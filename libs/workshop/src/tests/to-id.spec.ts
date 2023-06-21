import { test, expect } from 'bun:test'
import { toId } from '../to-id.js'

test('toId', () => {
  const actual = toId('Example/Element', 'basic')
  expect(actual).toBe('example-element--basic')
})
