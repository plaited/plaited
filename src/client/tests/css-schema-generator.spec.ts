/**
 * @module css-schema-generator.spec
 *
 * Tests for the extracted pure CSS schema generator function.
 */

import { expect, test } from 'bun:test'
import { generateCssSchemas } from '../css-schema-generator.ts'

test('generateCssSchemas returns expected shape', () => {
  const result = generateCssSchemas({
    properties: [
      {
        name: 'box-sizing',
        syntax: 'content-box | border-box',
        styleDeclaration: ['box-sizing'],
      },
    ],
  })
  expect(result).toHaveProperty('code')
  expect(result).toHaveProperty('propertyCount')
  expect(result).toHaveProperty('keywordEnumCount')
  expect(result.propertyCount).toBe(1)
})

test('box-sizing pure keyword → enum classification, keywordEnumCount=1', () => {
  const result = generateCssSchemas({
    properties: [{ name: 'box-sizing', syntax: 'content-box | border-box', styleDeclaration: ['box-sizing'] }],
  })
  expect(result.keywordEnumCount).toBe(1)
  expect(result.code).toContain('z.enum([')
})

test('clear pure keyword → enum', () => {
  const result = generateCssSchemas({
    properties: [
      {
        name: 'clear',
        syntax:
          'inline-start | inline-end | block-start | block-end | left | right | top | bottom | both-inline | both-block | both | none',
        styleDeclaration: ['clear'],
      },
    ],
  })
  expect(result.keywordEnumCount).toBe(1)
})

test('position has type ref → string-or-number', () => {
  const result = generateCssSchemas({
    properties: [
      {
        name: 'position',
        syntax: 'static | relative | absolute | sticky | fixed | <running()>',
        styleDeclaration: ['position'],
      },
    ],
  })
  expect(result.keywordEnumCount).toBe(0)
  expect(result.code).toContain('z.union([z.string(), z.number()])')
})

test('text-align has type ref → string-or-number', () => {
  const result = generateCssSchemas({
    properties: [
      {
        name: 'text-align',
        syntax: 'start | end | left | right | center | <string> | justify',
        styleDeclaration: ['text-align'],
      },
    ],
  })
  expect(result.keywordEnumCount).toBe(0)
})

test('overflow has property ref + multiplier → string-or-number', () => {
  const result = generateCssSchemas({
    properties: [{ name: 'overflow', syntax: "<'overflow-block'>{1,2}", styleDeclaration: ['overflow'] }],
  })
  expect(result.keywordEnumCount).toBe(0)
})

test('font-weight has type ref → string-or-number (enum-or-number eligible but forced to string-or-number)', () => {
  const result = generateCssSchemas({
    properties: [
      { name: 'font-weight', syntax: '<font-weight-absolute> | bolder | lighter', styleDeclaration: ['font-weight'] },
    ],
  })
  expect(result.keywordEnumCount).toBe(0)
})

test('margin has multiplier → string-or-number', () => {
  const result = generateCssSchemas({
    properties: [{ name: 'margin', syntax: "<'margin-top'>{1,4}", styleDeclaration: ['margin'] }],
  })
  expect(result.keywordEnumCount).toBe(0)
})

test('color has type ref → string-or-number', () => {
  const result = generateCssSchemas({
    properties: [{ name: 'color', syntax: '<color>', styleDeclaration: ['color'] }],
  })
  expect(result.keywordEnumCount).toBe(0)
})

test('display has complex syntax → string-or-number', () => {
  const result = generateCssSchemas({
    properties: [
      {
        name: 'display',
        syntax:
          '[ <display-outside> || <display-inside> ] | <display-listitem> | <display-internal> | <display-box> | <display-legacy> | grid-lanes | inline-grid-lanes | <display-outside> || [ <display-inside> | math ]',
        styleDeclaration: ['display'],
      },
    ],
  })
  expect(result.keywordEnumCount).toBe(0)
})

test('camelCase keys present via styleDeclaration', () => {
  const result = generateCssSchemas({
    properties: [
      {
        name: 'box-sizing',
        syntax: 'content-box | border-box',
        styleDeclaration: ['box-sizing', 'boxSizing'],
      },
    ],
  })
  expect(result.code).toContain('"box-sizing"')
  expect(result.code).toContain('"boxSizing"')
})

test('animation-name includes KeyframeRefSchema in value union', () => {
  const result = generateCssSchemas({
    properties: [
      {
        name: 'animation-name',
        syntax: '<custom-ident> | <string> | none',
        styleDeclaration: ['animation-name', 'animationName'],
      },
    ],
  })
  expect(result.code).toContain('TokenRefSchema, KeyframeRefSchema')
})

test('position does NOT include KeyframeRefSchema', () => {
  const result = generateCssSchemas({
    properties: [
      {
        name: 'position',
        syntax: 'static | relative | absolute | sticky | fixed | <running()>',
        styleDeclaration: ['position'],
      },
    ],
  })
  // position's value schema should only have TokenRefSchema, not KeyframeRefSchema
  const positionCase = result.code.split('\n').find((l) => l.includes('case "position"'))
  expect(positionCase).toBeTruthy()
  expect(positionCase).toContain('TokenRefSchema')
  expect(positionCase).not.toContain('KeyframeRefSchema')
})

test('default catchall includes TokenRefSchema', () => {
  const result = generateCssSchemas({
    properties: [{ name: 'color', syntax: '<color>', styleDeclaration: ['color'] }],
  })
  expect(result.code).toContain('return z.union([z.union([z.string(), z.number()]), TokenRefSchema])')
})
