/**
 * @module generate-css-schemas.spec
 *
 * Tests for the CSS schema generator: classification logic, generated output
 * snapshot, and per-property $ref inclusion in the switch cases.
 *
 * @remarks
 * Retargeted from scripts/generate-css-schemas.ts to
 * src/cli/css-schemas.ts after the pure-function extraction and inlining.
 */

import { expect, test } from 'bun:test'
import { generateCssSchemas, type PropertyEntry } from '../src/cli/css-schemas.ts'

const entryFor = (name: string, syntax: string): PropertyEntry => ({
  name,
  syntax,
  styleDeclaration: [name],
})

test('box-sizing is pure keyword classification', () => {
  const result = generateCssSchemas({
    properties: [entryFor('box-sizing', 'content-box | border-box')],
  })
  expect(result.keywordEnumCount).toBe(1)
})

test('position has classification string-or-number', () => {
  const result = generateCssSchemas({
    properties: [entryFor('position', 'static | relative | absolute | sticky | fixed | <running()>')],
  })
  expect(result.propertyCount).toBe(1)
  expect(result.keywordEnumCount).toBe(0)
})

test('clear is pure keyword classification', () => {
  const result = generateCssSchemas({
    properties: [
      entryFor(
        'clear',
        'inline-start | inline-end | block-start | block-end | left | right | top | bottom | both-inline | both-block | both | none',
      ),
    ],
  })
  expect(result.keywordEnumCount).toBe(1)
})

test('font-weight has classification string-or-number', () => {
  const result = generateCssSchemas({
    properties: [entryFor('font-weight', '<font-weight-absolute> | bolder | lighter')],
  })
  expect(result.keywordEnumCount).toBe(0)
})

test('color has classification string-or-number', () => {
  const result = generateCssSchemas({
    properties: [entryFor('color', '<color>')],
  })
  expect(result.keywordEnumCount).toBe(0)
})

test('display has classification string-or-number', () => {
  const result = generateCssSchemas({
    properties: [entryFor('display', '[ <display-outside> || <display-inside> ] | <display-listitem>')],
  })
  expect(result.keywordEnumCount).toBe(0)
})

test('camelCase and kebab keys generated from styleDeclaration', () => {
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

test('generated output includes TokenRefSchema everywhere and KeyframeRefSchema for animation names', async () => {
  const cssDataPath = new URL('../node_modules/@webref/css/css.json', import.meta.url)
  const cssFile = Bun.file(cssDataPath)
  const cssJson = await cssFile.json()

  const result = generateCssSchemas(cssJson)

  expect(result.code).toContain("import { TokenRefSchema, KeyframeRefSchema } from './css.input-schemas.ts'")

  expect(result.code).toContain('case "position": return z.union([z.union([z.string(), z.number()]), TokenRefSchema])')
  expect(result.code).toContain('case "color": return z.union([z.union([z.string(), z.number()]), TokenRefSchema])')

  expect(result.code).toContain('TokenRefSchema, KeyframeRefSchema')

  expect(result.code).toContain('return z.union([z.union([z.string(), z.number()]), TokenRefSchema])')

  const lines = result.code.split('\n')
  const header = lines.slice(0, 12).join('\n')
  const typeTail = lines.slice(-5).join('\n')
  expect({ header, typeTail }).toMatchSnapshot()
})
