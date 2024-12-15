import { test, expect } from 'bun:test'
import { hexToRgb } from '../hex-to-rgb.js'

test('hexToRgb: improper hex', () => {
  //@ts-expect-error: testing invalid value
  expect(hexToRgb('8A99A8')).toBe(undefined)
})
test('hexToRgb: six digits', () => {
  expect(hexToRgb('#8A99A8')).toBe('rgb(138,153,168)')
})
test('hexToRgb: eight digits', () => {
  expect(hexToRgb('#8A99A80A')).toBe('rgba(138,153,168,0.04)')
})
