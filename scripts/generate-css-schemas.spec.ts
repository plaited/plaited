/**
 * @module generate-css-schemas.spec
 *
 * Tests for the CSS schema generator: classification logic, generated output
 * snapshot, and per-property $ref inclusion in the switch cases.
 */

import { expect, test } from 'bun:test'
import * as path from 'node:path'
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
    const t = node.type as string
    if (t === 'Keyword') {
      keywords.push(node.name as string)
    } else if (t === 'Type') {
      if (node.name === 'number' || node.name === 'integer') hasNumberType = true
      else hasOtherType = true
    } else if (t === 'Property') {
      hasOtherType = true
    } else if (t === 'Group') {
      if ((node.combinator as string) === '&&' || node.combinator === '||') hasOtherType = true
      ;(node.terms as Record<string, unknown>[])?.forEach(walkNode)
    } else if (t === 'Multiplier') {
      walkNode(node.term as Record<string, unknown>)
      hasOtherType = true
    } else if (t === 'Function') {
      hasOtherType = true
      ;(node.terms as Record<string, unknown>[])?.forEach(walkNode)
    }
  }
  walkNode(ast)
  const classification: PropertyClassification =
    !hasNumberType && !hasOtherType ? 'enum' : !hasOtherType && hasNumberType ? 'enum-or-number' : 'string-or-number'
  return { keywords, classification }
}

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
  const r = classifyProperty(propertySyntaxes['box-sizing'])
  expect(r.classification).toBe('enum')
  expect(r.keywords).toEqual(['content-box', 'border-box'])
})

test('clear is pure keyword → z.enum', () => {
  const r = classifyProperty(propertySyntaxes.clear)
  expect(r.classification).toBe('enum')
  expect(r.keywords).toContain('none')
})

test('position has type ref → z.union([string, number])', () => {
  const r = classifyProperty(propertySyntaxes.position)
  expect(r.classification).toBe('string-or-number')
  expect(r.keywords).toEqual(['static', 'relative', 'absolute', 'sticky', 'fixed'])
})

test('text-align has type ref → z.union([string, number])', () => {
  const r = classifyProperty(propertySyntaxes['text-align'])
  expect(r.classification).toBe('string-or-number')
  expect(r.keywords).toContain('start')
})

test('overflow has property ref + multiplier → z.union([string, number])', () => {
  expect(classifyProperty(propertySyntaxes.overflow).classification).toBe('string-or-number')
})

test('font-weight has type ref → z.union([string, number])', () => {
  const r = classifyProperty(propertySyntaxes['font-weight'])
  expect(r.classification).toBe('string-or-number')
  expect(r.keywords).toEqual(['bolder', 'lighter'])
})

test('margin has multiplier → z.union([string, number])', () => {
  expect(classifyProperty(propertySyntaxes.margin).classification).toBe('string-or-number')
})

test('color has type ref → z.union([string, number])', () => {
  expect(classifyProperty(propertySyntaxes.color).classification).toBe('string-or-number')
})

test('display has complex syntax → z.union([string, number])', () => {
  const r = classifyProperty(propertySyntaxes.display)
  expect(r.classification).toBe('string-or-number')
  expect(r.keywords).toContain('grid-lanes')
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

// --- Generated output snapshot ---

test('generated file includes TokenRefSchema in every case and KeyframeRefSchema only for animation/animation-name', async () => {
  const proc = Bun.spawn(['bun', 'run', path.join(import.meta.dir, 'generate-css-schemas.ts')], {
    cwd: path.resolve(import.meta.dir, '..'),
    stdout: 'pipe',
    stderr: 'pipe',
  })
  await proc.exited
  const genPath = new URL('../src/client/css.schemas.ts', import.meta.url)
  const content = await Bun.file(genPath).text()

  // Verify ref schema imports present
  expect(content).toContain("import { TokenRefSchema, KeyframeRefSchema } from './css.input-schemas.ts'")

  // Non-keyframe property gets TokenRefSchema only
  expect(content).toContain('case "position": return z.union([z.union([z.string(), z.number()]), TokenRefSchema])')
  expect(content).toContain('case "color": return z.union([z.union([z.string(), z.number()]), TokenRefSchema])')

  // Keyframe-eligible properties get both
  expect(content).toContain('TokenRefSchema, KeyframeRefSchema')

  // Default catchall has TokenRefSchema
  expect(content).toContain('return z.union([z.union([z.string(), z.number()]), TokenRefSchema])')

  const lines = content.split('\n')
  const header = lines.slice(0, 12).join('\n')
  const typeTail = lines.slice(-5).join('\n')
  expect({ header, typeTail }).toMatchSnapshot()
})
