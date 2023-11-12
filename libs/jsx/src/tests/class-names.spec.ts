import { test, expect } from 'bun:test'
import { classNames } from '../utils.js'

test('classNames', () => {
  expect(classNames('class-1', 'class-2')).toBe('class-1 class-2')
  const conditionTrue = true
  const conditionFalse = false
  expect(classNames('class-1', conditionFalse && 'class-2', conditionTrue && 'class-3')).toBe('class-1 class-3')
})
