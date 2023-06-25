import { test, expect } from'@jest/globals'
import { parseToRgb } from '../index.js'

test('parseToRgb: improper hex', () => {
  expect(parseToRgb('8A99A8')).toBe(undefined)
})
test('parseToRgb: six digits', () => {
  expect(parseToRgb('#8A99A8')).toBe('rgb(138,153,168)')
})
test('parseToRgb: eight digits', () => {
  expect(parseToRgb('#8A99A80A')).toBe('rgba(138,153,168,0.04)')
})
