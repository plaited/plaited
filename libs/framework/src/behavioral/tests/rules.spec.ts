import { test, expect } from 'bun:test'
import { bProgram } from '../b-program.js'
import { thread, sync } from '../rules-function.js'

test('rules', () => {
  const { rules } = bProgram()
  rules.set({
    addHot: thread(
      sync({ request: { type: 'hot' } }),
    ),
  })
  expect(rules.has('addHot')).toBe(true)
  expect(rules.delete('addHot')).toBe(true)
  expect(rules.delete('addCold')).toBe(false)
  expect(rules.has('addHot')).toBe(false)
  rules.set({
    addHot: thread(
      sync({ request: { type: 'hot' } }),
    ),
    addCold: thread(
      sync({ request: { type: 'cold' } }),
    ),
  })
  expect(rules.has('addHot')).toBe(true)
  expect(rules.has('addHot')).toBe(true)
  rules.clear()
  expect(rules.has('addHot')).toBe(false)
  expect(rules.has('addHot')).toBe(false)
})