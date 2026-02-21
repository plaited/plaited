import { expect, test } from 'bun:test'
import { isBPEvent } from 'plaited'

test('isBPEvent: returns true for valid BPEvent with type only', () => {
  const event = { type: 'test' }

  expect(isBPEvent(event)).toBe(true)
})

test('isBPEvent: returns true for valid BPEvent with type and detail', () => {
  const event = { type: 'test', detail: { value: 42 } }

  expect(isBPEvent(event)).toBe(true)
})

test('isBPEvent: returns false for null', () => {
  expect(isBPEvent(null)).toBe(false)
})

test('isBPEvent: returns false for undefined', () => {
  expect(isBPEvent(undefined)).toBe(false)
})

test('isBPEvent: returns false for string', () => {
  expect(isBPEvent('test')).toBe(false)
})

test('isBPEvent: returns false for number', () => {
  expect(isBPEvent(42)).toBe(false)
})

test('isBPEvent: returns false for array', () => {
  expect(isBPEvent(['test'])).toBe(false)
})

test('isBPEvent: returns false for object without type property', () => {
  const obj = { detail: 'value' }

  expect(isBPEvent(obj)).toBe(false)
})

test('isBPEvent: returns false for object with non-string type', () => {
  const obj = { type: 42 }

  expect(isBPEvent(obj)).toBe(false)
})

test('isBPEvent: returns true for object with additional properties', () => {
  const event = { type: 'test', detail: 'value', extra: 'property' }

  expect(isBPEvent(event)).toBe(true)
})

test('isBPEvent: returns false for Symbol type', () => {
  const obj = { type: Symbol('test') }

  expect(isBPEvent(obj)).toBe(false)
})
