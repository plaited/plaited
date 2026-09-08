import { describe, expect, test } from 'bun:test'
import { CUSTOM_PROPERTY_REF_PATTERN } from '../css.schemas.ts'
import { ajv, validatePStyle, validatePTrigger } from '../html.schemas.ts'

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
    expect(CUSTOM_PROPERTY_REF_PATTERN.test('var(--a, var(--b, red)')).toBe(true)
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

describe('CUSTOM_PROPERTY_REF_PATTERN via ajv', () => {
  const validate = ajv.compile({ type: 'string', pattern: CUSTOM_PROPERTY_REF_PATTERN.source })

  test('accepts valid var() references', () => {
    expect(validate('var(--my-prop)')).toBe(true)
    expect(validate('var(  --my-prop)')).toBe(true)
    expect(validate('var(--my-prop, red)')).toBe(true)
  })

  test('rejects non-var() values', () => {
    expect(validate('red')).toBe(false)
    expect(validate('5px')).toBe(false)
  })
})

describe('PlaitedAttributesSchema [style] refinement', () => {
  const validateStyle = (styleValue: unknown) => validatePStyle({}, styleValue)

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
    expect(validateStyle(42)).toBe(true) // non-string passes (type handled by schema)
    expect(validateStyle(null)).toBe(true)
  })

  test('accepts number values for properties that support them', () => {
    expect(validateStyle('opacity: 0.5')).toBe(true)
    expect(validateStyle('line-height: 1.5')).toBe(true)
  })
})

describe('PlaitedAttributesSchema [p-trigger] refinement', () => {
  const validateTrigger = (triggerValue: unknown) => validatePTrigger({}, triggerValue)

  test('accepts empty string', () => {
    expect(validateTrigger('')).toBe(true)
  })

  test('accepts a single pair', () => {
    expect(validateTrigger('click:save')).toBe(true)
  })

  test('accepts multiple pairs with unique keys', () => {
    expect(validateTrigger('click:save; focus:notify')).toBe(true)
  })

  test('accepts pairs with trailing semicolon', () => {
    expect(validateTrigger('click:save;')).toBe(true)
    expect(validateTrigger('click:save; focus:notify;')).toBe(true)
  })

  test('accepts whitespace around keys and values', () => {
    expect(validateTrigger('click : save')).toBe(true)
    expect(validateTrigger('click:save;  focus : notify')).toBe(true)
  })

  test('rejects a declaration without a colon', () => {
    expect(validateTrigger('clicksave')).toBe(false)
    expect(validateTrigger('click save')).toBe(false)
  })

  test('rejects a declaration with empty key', () => {
    expect(validateTrigger(':save')).toBe(false)
  })

  test('rejects a declaration with empty value', () => {
    expect(validateTrigger('click:')).toBe(false)
  })

  test('rejects duplicate keys', () => {
    expect(validateTrigger('click:save; click:delete')).toBe(false)
    expect(validateTrigger('click:save; focus:notify; click:override')).toBe(false)
  })

  test('rejects duplicate keys after trimming whitespace', () => {
    expect(validateTrigger('click:save;  click : delete')).toBe(false)
  })

  test('accepts undefined (p-trigger not set)', () => {
    expect(validateTrigger(undefined)).toBe(true)
  })

  test('rejects non-string values', () => {
    expect(validateTrigger(42)).toBe(true) // non-string passes (type handled by schema)
    expect(validateTrigger(null)).toBe(true)
  })
})
