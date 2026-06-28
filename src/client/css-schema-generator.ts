/**
 * @module css-schema-generator
 *
 * Pure CSS schema generator — takes parsed @webref/css property data, returns
 * the generated source code and counts. No I/O, no side effects.
 *
 * Each property's `syntax` is parsed with css-tree's definitionSyntax.parse,
 * then classified into one of three Zod schema shapes.
 */

import { definitionSyntax } from 'css-tree'

// ============================================================================
// Types
// ============================================================================

type PropertyClassification = 'enum' | 'enum-or-number' | 'string-or-number'

type PropertySyntax = {
  keywords: string[]
  classification: PropertyClassification
}

/**
 * A single CSS property entry from @webref/css data.
 *
 * @public
 */
export type PropertyEntry = {
  name: string
  syntax: string
  styleDeclaration: string[]
}

/**
 * Result of a schema generation run.
 *
 * @public
 */
export type GeneratedCssSchemas = {
  code: string
  propertyCount: number
  keywordEnumCount: number
}

// ============================================================================
// Constants
// ============================================================================

const KEYFRAME_ELIGIBLE_NAMES = new Set([
  'animation',
  'animation-name',
  'animationName',
  '-webkit-animation',
  'WebkitAnimation',
  'webkitAnimation',
  '-webkit-animation-name',
  'WebkitAnimationName',
  'webkitAnimationName',
])

// ============================================================================
// Core classification logic (identical to scripts/generate-css-schemas.ts)
// ============================================================================

const classifyProperty = (syntax: string): PropertySyntax => {
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

// ============================================================================
// Code generation helpers (identical to scripts/generate-css-schemas.ts)
// ============================================================================

const keywordsToEnum = (keywords: string[]): string => {
  const values = [...new Set(keywords)].map((k) => JSON.stringify(k)).join(', ')
  return `z.enum([${values}])`
}

const generateLiteralSchema = (property: PropertyEntry): string => {
  const { keywords, classification } = classifyProperty(property.syntax)

  switch (classification) {
    case 'enum':
      return keywordsToEnum(keywords)
    case 'enum-or-number':
      return `${keywordsToEnum(keywords)}.or(z.number())`
    case 'string-or-number':
      return `z.union([z.string(), z.number()])`
  }
}

const isKeyframeEligible = (name: string): boolean => KEYFRAME_ELIGIBLE_NAMES.has(name)

const generateValueSchema = (name: string, property: PropertyEntry): string => {
  const literalSchema = generateLiteralSchema(property)
  const refs = isKeyframeEligible(name) ? 'TokenRefSchema, KeyframeRefSchema' : 'TokenRefSchema'
  return `z.union([${literalSchema}, ${refs}])`
}

const generatePropertyNames = (properties: PropertyEntry[]): string[] => {
  const names = new Set<string>()
  for (const prop of properties) {
    for (const name of prop.styleDeclaration) {
      names.add(name)
    }
  }
  return [...names].sort()
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Generate CSS property schemas from parsed @webref/css data.
 *
 * @param cssJson - Parsed @webref/css JSON object with a `properties` array.
 * @returns Generated source code with property count and keyword enum count.
 *
 * @public
 */
export const generateCssSchemas = (cssJson: { properties: PropertyEntry[] }): GeneratedCssSchemas => {
  const properties: PropertyEntry[] = cssJson.properties
    .filter((p) => p.syntax)
    .map((p) => ({
      name: p.name,
      syntax: p.syntax,
      styleDeclaration: p.styleDeclaration ?? [p.name],
    }))

  const allNames = generatePropertyNames(properties)
  const propertyNameEntries = allNames.map((n) => JSON.stringify(n)).join(', ')

  const nameToProp = new Map<string, PropertyEntry>()
  for (const prop of properties) {
    for (const name of prop.styleDeclaration) {
      nameToProp.set(name, prop)
    }
  }

  const schemaCases = allNames
    .map((name) => {
      const prop = nameToProp.get(name)!
      const valueSchema = generateValueSchema(name, prop)
      return `  case ${JSON.stringify(name)}: return ${valueSchema}`
    })
    .join('\n')

  const schemaCode = `(prop: string): z.ZodTypeAny => {
  switch (prop) {
${schemaCases}
    default:
      return z.union([z.union([z.string(), z.number()]), TokenRefSchema])
  }
}`

  const typeLines = ['{']
  for (const name of allNames) {
    typeLines.push(`  ${JSON.stringify(name)}?: string | number,`)
  }
  typeLines.push('  [key: string]: string | number,')
  typeLines.push('}')
  const cssPropertiesType = typeLines.join('\n')

  const output = [
    '// @ts-nocheck',
    '/**',
    ' * Auto-generated CSS property schemas and types.',
    ' * Generated by `scripts/generate-css-schemas.ts` from @webref/css CSS property data.',
    ' * Do not edit manually.',
    ' */',
    "import { z } from 'zod'",
    "import { TokenRefSchema, KeyframeRefSchema } from './css.input-schemas.ts'",
    '',
    '/**',
    ' * Schema for valid CSS property names (kebab and camel case).',
    ' */',
    `export const cssPropertyNameSchema = z.enum([${propertyNameEntries}])`,
    '',
    '/**',
    ' * Per-property value schema lookup.',
    ' * Known properties map to their specific value schema (literal enum or',
    ' * string|number, plus TokenRefSchema for all and KeyframeRefSchema for',
    ' * animation/animation-name). Unknown properties (e.g. `--*`) return a',
    ' * catchall with TokenRefSchema.',
    ' */',
    `export const cssPropertyValueSchema = ${schemaCode}`,
    '',
    '/**',
    ' * CSS properties type — every known property key plus custom property passthrough.',
    ' * Values are string or number.',
    ' *',
    ' * @public',
    ' */',
    `export type CSSProperties = ${cssPropertiesType}`,
    '',
  ].join('\n')

  const keywordEnumCount = properties.filter((p) => classifyProperty(p.syntax).classification === 'enum').length

  return {
    code: output,
    propertyCount: properties.length,
    keywordEnumCount,
  }
}
