import { expect, test } from 'bun:test'
import { createHostStyles, createStyles, joinStyles } from 'plaited/ui'
import { createHash, isElementStylesObject, isHostStylesObject, isStylesObject } from '../css.utils.ts'

test('createHash: produces consistent hash from strings', () => {
  const a = createHash('color', 'blue')
  const b = createHash('color', 'blue')
  expect(a).toBe(b)
})

test('createHash: produces different hashes for different inputs', () => {
  const a = createHash('color', 'blue')
  const b = createHash('color', 'red')
  expect(a).not.toBe(b)
})

test('createHash: result starts with underscore', () => {
  const hash = createHash('test')
  expect(hash?.startsWith('_')).toBe(true)
})

test('isElementStylesObject: returns true for valid ElementStylesObject', () => {
  const elementStyles = createStyles({
    button: {
      color: 'blue',
      padding: '10px',
    },
  })
  expect(isElementStylesObject(elementStyles.button)).toBe(true)
})

test('isElementStylesObject: returns false for HostStylesObject', () => {
  const hostStyles = createHostStyles({
    color: 'red',
  })
  expect(isElementStylesObject(hostStyles)).toBe(false)
})

test('isElementStylesObject: returns false for invalid inputs', () => {
  expect(isElementStylesObject(null)).toBe(false)
  expect(isElementStylesObject(undefined)).toBe(false)
  expect(isElementStylesObject('string')).toBe(false)
  expect(isElementStylesObject(123)).toBe(false)
  expect(isElementStylesObject({})).toBe(false)
  expect(isElementStylesObject({ classNames: 'not-array' })).toBe(false)
  expect(isElementStylesObject({ stylesheets: [] })).toBe(false)
  expect(isElementStylesObject({ classNames: [], stylesheets: 'not-array' })).toBe(false)
})

test('isHostStylesObject: returns true for valid HostStylesObject', () => {
  const hostStyles = createHostStyles({
    color: 'red',
    padding: '20px',
  })
  expect(isHostStylesObject(hostStyles)).toBe(true)
})

test('isHostStylesObject: returns false for ElementStylesObject', () => {
  const elementStyles = createStyles({
    button: {
      color: 'blue',
    },
  })
  expect(isHostStylesObject(elementStyles.button)).toBe(false)
})

test('isHostStylesObject: returns false for invalid inputs', () => {
  expect(isHostStylesObject(null)).toBe(false)
  expect(isHostStylesObject(undefined)).toBe(false)
  expect(isHostStylesObject('string')).toBe(false)
  expect(isHostStylesObject(123)).toBe(false)
  expect(isHostStylesObject({})).toBe(false)
  expect(isHostStylesObject({ classNames: [] })).toBe(false)
  expect(isHostStylesObject({ stylesheets: 'not-array' })).toBe(false)
  expect(isHostStylesObject({ classNames: [], stylesheets: [] })).toBe(false)
})

test('isStylesObject: returns true for ElementStylesObject', () => {
  const elementStyles = createStyles({
    button: {
      color: 'blue',
    },
  })
  expect(isStylesObject(elementStyles.button)).toBe(true)
})

test('isStylesObject: returns true for HostStylesObject', () => {
  const hostStyles = createHostStyles({
    color: 'red',
  })
  expect(isStylesObject(hostStyles)).toBe(true)
})

test('isStylesObject: returns true for joined styles', () => {
  const elementStyles = createStyles({
    button: {
      color: 'blue',
    },
  })
  const hostStyles = createHostStyles({
    padding: '10px',
  })
  const joined = joinStyles(elementStyles.button, hostStyles)
  expect(isStylesObject(joined)).toBe(true)
})

test('isStylesObject: returns false for invalid inputs', () => {
  expect(isStylesObject(null)).toBe(false)
  expect(isStylesObject(undefined)).toBe(false)
  expect(isStylesObject('string')).toBe(false)
  expect(isStylesObject(123)).toBe(false)
  expect(isStylesObject({})).toBe(false)
  expect(isStylesObject({ random: 'object' })).toBe(false)
})
