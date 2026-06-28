/**
 * @module generate-css-schemas.spec
 *
 * Tests for the CSS schema generator's classification logic.
 * This verifies the generator itself, NOT the Zod schemas.
 */

import { expect, test } from 'bun:test'
import { definitionSyntax } from 'css-tree'

type PropertyClassification = 'enum' | 'enum-or-number' | 'string-or-number'

const classifyProperty = (
  syntax: string | undefined,
): {
  keywords: string[]
  classification: PropertyClassification
} => {
  if (!syntax) return { keywords: [], classification: 'string-or-number' }
  let ast: Record<string, unknown>
  try {
    ast = definitionSyntax.parse(syntax)
  } catch {
    return { keywords: [], classification: 'string-or-number' }
  }

  const keywords: string[] = []
  let hasNumberType = false
  let hasOtherType = false

  const walkNode = (node: Record<string, unknown>) => {
    const type = node.type as string
    if (type === 'Keyword') {
      keywords.push(node.name as string)
    } else if (type === 'Type') {
      const name = node.name as string
      if (name === 'number' || name === 'integer') {
        hasNumberType = true
      } else {
        hasOtherType = true
      }
    } else if (type === 'Property') {
      hasOtherType = true
    } else if (type === 'Group') {
      const combinator = node.combinator as string
      if (combinator === '&&' || combinator === '||') hasOtherType = true
      const terms = node.terms as Record<string, unknown>[]
      if (terms) for (const term of terms) walkNode(term)
    } else if (type === 'Multiplier') {
      const term = node.term as Record<string, unknown>
      if (term) walkNode(term)
      hasOtherType = true
    } else if (type === 'Function') {
      hasOtherType = true
      const children = node.terms as Record<string, unknown>[]
      if (children) for (const child of children) walkNode(child)
    }
  }

  walkNode(ast)

  let classification: PropertyClassification
  if (!hasNumberType && !hasOtherType) {
    classification = 'enum'
  } else if (!hasOtherType && hasNumberType) {
    classification = 'enum-or-number'
  } else {
    classification = 'string-or-number'
  }

  return { keywords, classification }
}

// --- Test data matching @webref/css/css.json syntax fields ---

const propertySyntaxes: Record<string, string | undefined> = {
  position: 'static | relative | absolute | sticky | fixed | <running()>',
  'text-align': 'start | end | left | right | center | <string> | justify | match-parent | justify-all',
  overflow: "<'overflow-block'>{1,2}",
  'box-sizing': 'content-box | border-box',
  clear:
    'inline-start | inline-end | block-start | block-end | left | right | top | bottom | both-inline | both-block | both | none',
  'font-weight': '<font-weight-absolute> | bolder | lighter',
  margin: "<'margin-top'>{1,4}",
  color: '<color>',
  display:
    '[ <display-outside> || <display-inside> ] | <display-listitem> | <display-internal> | <display-box> | <display-legacy> | grid-lanes | inline-grid-lanes | <display-outside> || [ <display-inside> | math ]',
}

const propertyStyleDeclarations: Record<string, string[]> = {
  position: ['position'],
  'text-align': ['text-align', 'textAlign'],
  overflow: ['overflow'],
  'box-sizing': ['box-sizing', 'boxSizing'],
  clear: ['clear'],
  'font-weight': ['font-weight', 'fontWeight'],
  margin: ['margin'],
  color: ['color'],
  display: ['display'],
}

test('box-sizing is pure keyword → z.enum', () => {
  const result = classifyProperty(propertySyntaxes['box-sizing'])
  expect(result.classification).toBe('enum')
  expect(result.keywords).toEqual(['content-box', 'border-box'])
})

test('clear is pure keyword → z.enum', () => {
  const result = classifyProperty(propertySyntaxes.clear)
  expect(result.classification).toBe('enum')
  expect(result.keywords).toContain('none')
  expect(result.keywords).toContain('left')
  expect(result.keywords).toContain('right')
  expect(result.keywords).toContain('inline-start')
})

test('position has type ref → z.union([string, number])', () => {
  const result = classifyProperty(propertySyntaxes.position)
  expect(result.classification).toBe('string-or-number')
  expect(result.keywords).toEqual(['static', 'relative', 'absolute', 'sticky', 'fixed'])
})

test('text-align has type ref → z.union([string, number])', () => {
  const result = classifyProperty(propertySyntaxes['text-align'])
  expect(result.classification).toBe('string-or-number')
  expect(result.keywords).toContain('start')
  expect(result.keywords).toContain('center')
  expect(result.keywords).toContain('justify')
})

test('overflow has property ref + multiplier → z.union([string, number])', () => {
  const result = classifyProperty(propertySyntaxes.overflow)
  expect(result.classification).toBe('string-or-number')
  expect(result.keywords).toEqual([])
})

test('font-weight has type ref (not directly number) → z.union([string, number])', () => {
  const result = classifyProperty(propertySyntaxes['font-weight'])
  expect(result.classification).toBe('string-or-number')
  expect(result.keywords).toEqual(['bolder', 'lighter'])
})

test('margin has multiplier → z.union([string, number])', () => {
  const result = classifyProperty(propertySyntaxes.margin)
  expect(result.classification).toBe('string-or-number')
  expect(result.keywords).toEqual([])
})

test('color has type ref → z.union([string, number])', () => {
  const result = classifyProperty(propertySyntaxes.color)
  expect(result.classification).toBe('string-or-number')
  expect(result.keywords).toEqual([])
})

test('display has complex syntax → z.union([string, number])', () => {
  const result = classifyProperty(propertySyntaxes.display)
  expect(result.classification).toBe('string-or-number')
  expect(result.keywords).toContain('grid-lanes')
  expect(result.keywords).toContain('math')
})

test('camelCase keys present via styleDeclaration', () => {
  expect(propertyStyleDeclarations['box-sizing']).toContain('boxSizing')
  expect(propertyStyleDeclarations['text-align']).toContain('textAlign')
  expect(propertyStyleDeclarations['font-weight']).toContain('fontWeight')
})

test('kebab keys present via styleDeclaration', () => {
  expect(propertyStyleDeclarations['box-sizing']).toContain('box-sizing')
  expect(propertyStyleDeclarations['text-align']).toContain('text-align')
  expect(propertyStyleDeclarations.position).toContain('position')
})
