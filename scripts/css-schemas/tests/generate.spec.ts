/**
 * @module generate.spec
 *
 * Tests for the CSS schema generator: classification logic, generated output
 * snapshot, and per-property schema in the object format.
 */

import { expect, test } from 'bun:test'
import { generateCssSchemas, type PropertyEntry } from '../generate.ts'

const entryFor = (name: string, syntax: string): PropertyEntry => ({
  name,
  syntax,
  styleDeclaration: [name],
})

// 6 hardcoded vendor entries are always added to the output
export const HARDCODED_ENTRY_COUNT = 6

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
  expect(result.propertyCount).toBe(1 + HARDCODED_ENTRY_COUNT)
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

test('only kebab-case keys from styleDeclaration, camelCase dropped', () => {
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
  expect(result.code).not.toContain('"boxSizing"')
})

test('hardcoded vendor entries appear in output', () => {
  const result = generateCssSchemas({ properties: [] })
  expect(result.code).toContain('"-webkit-user-select"')
  expect(result.code).toContain('"-webkit-appearance"')
  expect(result.code).toContain('"-webkit-backdrop-filter"')
  expect(result.code).toContain('"-webkit-box-orient"')
  expect(result.code).toContain('"-webkit-hyphens"')
  expect(result.code).toContain('"-webkit-line-clamp"')
  expect(result.propertyCount).toBe(HARDCODED_ENTRY_COUNT)
})

test('generated output uses z.object with catchall and property name/type exports', async () => {
  const cssDataPath = new URL('../../../node_modules/@webref/css/css.json', import.meta.url)
  const cssFile = Bun.file(cssDataPath)
  const cssJson = await cssFile.json()

  const result = generateCssSchemas(cssJson)

  // Uses z.object with catchall
  expect(result.code).toContain('export const cssPropertySchema = z.object({')
  expect(result.code).toContain('.catchall(z.union([z.string(), z.number()]))')

  // No switch function
  expect(result.code).not.toContain('switch (prop)')

  // Types exported
  expect(result.code).toContain('export const cssPropertyNameSchema = cssPropertySchema.keyof()')
  expect(result.code).toContain('export type CSSProperties = z.output<typeof cssPropertySchema>')

  const lines = result.code.split('\n')
  const header = lines.slice(0, 12).join('\n')
  const typeTail = lines.slice(-5).join('\n')
  expect({ header, typeTail }).toMatchSnapshot()
})

test('all properties are optional in the generated schema', async () => {
  const cssDataPath = new URL('../../../node_modules/@webref/css/css.json', import.meta.url)
  const cssFile = Bun.file(cssDataPath)
  const cssJson = await cssFile.json()

  const result = generateCssSchemas(cssJson)

  // Every property should have .optional() appended
  expect(result.code).toContain('"color": z.union([z.string(), z.number()]).optional()')
  expect(result.code).toContain('"accent-color": z.union([z.string(), z.number()]).optional()')

  // Hardcoded vendor entries also optional
  expect(result.code).toContain('"-webkit-line-clamp": z.enum([\'none\']).or(z.number()).optional()')
})
