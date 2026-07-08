import { describe, expect, test } from 'bun:test'
import { CUSTOM_PROPERTY_REF_PATTERN, customPropertyRefSchema } from '..//css.constants.ts'
import { STYLE } from '../html.constants.ts'
import { PlaitedAttributesSchema } from '../html.schemas.ts'

describe('CUSTOM_PROPERTY_REF_PATTERN', () => {
  test('matches basic var() with custom property', () => {
    expect(CUSTOM_PROPERTY_REF_PATTERN.test('var(--my-prop)')).toBe(true)
  })

  test('matches var() with whitespace between paren and dashes', () => {
    expect(CUSTOM_PROPERTY_REF_PATTERN.test('var( --my-prop)')).toBe(true)
    expect(CUSTOM_PROPERTY_REF_PATTERN.test('var(  --my-prop)')).toBe(true)
  })

  test('matches var() with fallback value', () => {
    expect(CUSTOM_PROPERTY_REF_PATTERN.test('var(--my-prop, red)')).toBe(true)
    expect(CUSTOM_PROPERTY_REF_PATTERN.test('var(--my-prop, 10px)')).toBe(true)
  })

  test('matches var() with nested var() as fallback', () => {
    expect(CUSTOM_PROPERTY_REF_PATTERN.test('var(--a, var(--b))')).toBe(true)
    expect(CUSTOM_PROPERTY_REF_PATTERN.test('var(--a, var(--b, red))')).toBe(true)
  })

  test('matches var() with complex property names', () => {
    expect(CUSTOM_PROPERTY_REF_PATTERN.test('var(--_underscore)')).toBe(true)
    expect(CUSTOM_PROPERTY_REF_PATTERN.test('var(--my-custom-prop)')).toBe(true)
    expect(CUSTOM_PROPERTY_REF_PATTERN.test('var(--my-prop-123)')).toBe(true)
  })

  test('does not match non-var() values', () => {
    expect(CUSTOM_PROPERTY_REF_PATTERN.test('red')).toBe(false)
    expect(CUSTOM_PROPERTY_REF_PATTERN.test('5px')).toBe(false)
    expect(CUSTOM_PROPERTY_REF_PATTERN.test('rgb(255, 0, 0)')).toBe(false)
    expect(CUSTOM_PROPERTY_REF_PATTERN.test('calc(100% - 20px)')).toBe(false)
    expect(CUSTOM_PROPERTY_REF_PATTERN.test('')).toBe(false)
  })

  test('does not match env() - different function', () => {
    expect(CUSTOM_PROPERTY_REF_PATTERN.test('env(--my-prop)')).toBe(false)
  })
})

describe('customPropertyRefSchema', () => {
  test('accepts valid var() references', () => {
    expect(customPropertyRefSchema.safeParse('var(--my-prop)').success).toBe(true)
    expect(customPropertyRefSchema.safeParse('var(  --my-prop)').success).toBe(true)
    expect(customPropertyRefSchema.safeParse('var(--my-prop, red)').success).toBe(true)
  })

  test('rejects non-var() values', () => {
    expect(customPropertyRefSchema.safeParse('red').success).toBe(false)
    expect(customPropertyRefSchema.safeParse('5px').success).toBe(false)
  })
})

describe('PlaitedAttributesSchema [style] refinement', () => {
  // Helper to build a style-only attributes object and validate style
  const validateStyle = (styleValue: unknown) => {
    const result = PlaitedAttributesSchema.shape[STYLE].safeParse(styleValue)
    return result.success
  }

  test('accepts empty string', () => {
    expect(validateStyle('')).toBe(true)
  })

  test('accepts single valid declaration', () => {
    expect(validateStyle('color: red')).toBe(true)
  })

  test('accepts multiple valid declarations', () => {
    expect(validateStyle('color: red; margin: 10px')).toBe(true)
  })

  test('accepts declarations with trailing semicolon', () => {
    expect(validateStyle('color: red;')).toBe(true)
    expect(validateStyle('color: red; margin: 10px;')).toBe(true)
  })

  test('accepts custom properties as property names', () => {
    expect(validateStyle('--my-var: 10px')).toBe(true)
    expect(validateStyle('--custom-prop: red')).toBe(true)
  })

  test('accepts var() references as property values', () => {
    expect(validateStyle('color: var(--my-color)')).toBe(true)
    expect(validateStyle('background-color: var(--bg, blue)')).toBe(true)
  })

  test('accepts var() references for enum-only properties', () => {
    expect(validateStyle('display: var(--my-display)')).toBe(true)
    expect(validateStyle('box-sizing: var(--sizing)')).toBe(true)
    expect(validateStyle('overflow: var(--over)')).toBe(true)
  })

  test('allows unknown property names (browser-handled)', () => {
    expect(validateStyle('unknown-prop: red')).toBe(true)
    expect(validateStyle('not-a-thing: 5px')).toBe(true)
  })

  test('rejects invalid enum values', () => {
    expect(validateStyle('box-sizing: mah-box')).toBe(false)
    expect(validateStyle('visibility: nah')).toBe(false)
  })

  test('rejects malformed declarations without colon', () => {
    expect(validateStyle('color red')).toBe(false)
    expect(validateStyle('just-a-word')).toBe(false)
  })

  test('rejects declarations with empty property name', () => {
    expect(validateStyle(': red')).toBe(false)
  })

  test('rejects declarations with empty value', () => {
    expect(validateStyle('color:')).toBe(false)
  })

  test('accepts var() with whitespace between paren and dashes in value', () => {
    expect(validateStyle('color: var( --my-color )')).toBe(true)
  })

  test('accepts mixed declarations with var() and literal values', () => {
    expect(validateStyle('color: red; display: var(--disp); margin: 5px')).toBe(true)
  })

  test('accepts custom property alongside standard properties', () => {
    expect(validateStyle('color: red; --custom-margin: 10px; display: block')).toBe(true)
  })

  test('accepts undefined (style not set)', () => {
    expect(validateStyle(undefined)).toBe(true)
  })

  test('rejects non-string values', () => {
    expect(validateStyle(42)).toBe(false)
    expect(validateStyle(null)).toBe(false)
    expect(validateStyle({})).toBe(false)
    expect(validateStyle([])).toBe(false)
  })

  test('accepts number values for properties that support them', () => {
    expect(validateStyle('opacity: 0.5')).toBe(true)
    expect(validateStyle('line-height: 1.5')).toBe(true)
  })
})
