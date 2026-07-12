/**
 * @module css-schemas/generate
 *
 * Pure CSS property schema generator. Reads CSS property definition data
 * and produces the Zod schema source code for `src/shared/css.schemas.ts`.
 *
 * @remarks
 * This is a dev-only module used by the `run.ts` script. It is not part of
 * the published framework — it runs in CI workflows or via `bun run` scripts
 * in the repo.
 *
 * @see scripts/css-schemas/run.ts
 */

/// <reference path="../types/css-tree.d.ts" />

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
 */
export type PropertyEntry = {
  name: string
  syntax: string
  styleDeclaration: string[]
}

/**
 * Result of a schema generation run.
 */
export type GeneratedCssSchemas = {
  code: string
  propertyCount: number
  keywordEnumCount: number
}

// ============================================================================
// Hardcoded vendor entries
// ============================================================================

const HARDCODED_VENDOR_ENTRIES: Record<string, string> = {
  '-webkit-appearance': 'z.union([z.string(), z.number()])',
  '-webkit-backdrop-filter': 'z.union([z.string(), z.number()])',
  '-webkit-box-orient': 'z.union([z.string(), z.number()])',
  '-webkit-hyphens': 'z.union([z.string(), z.number()])',
  '-webkit-line-clamp': "z.enum(['none']).or(z.number())",
  '-webkit-user-select': "z.enum(['auto', 'text', 'none', 'contain', 'all']).or(z.number())",
}

// ============================================================================
// Classification helpers
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
// Generator
// ============================================================================

/**
 * Generate CSS property schemas from parsed @webref/css data.
 *
 * Only kebab-case property names are emitted (no camelCase variants).
 * Vendor-prefixed `-webkit-*` properties from the data are excluded;
 * the specific Safari-compat entries from {@link HARDCODED_VENDOR_ENTRIES}
 * are added directly to the output.
 *
 * @param cssJson - Parsed @webref/css JSON object with a `properties` array.
 * @returns Generated source code with property count and keyword enum count.
 */
export const generateCssSchemas = (cssJson: { properties: PropertyEntry[] }): GeneratedCssSchemas => {
  const properties: PropertyEntry[] = cssJson.properties
    .filter((p) => p.syntax && !p.name.startsWith('-webkit-'))
    .map((p) => {
      const sds = p.styleDeclaration ?? [p.name]
      const dashed = sds.filter((s) => s.includes('-'))
      return {
        name: p.name,
        syntax: p.syntax,
        // When kebab variants exist, use only those; otherwise keep all (single-word props like 'color')
        styleDeclaration: dashed.length > 0 ? dashed : sds,
      }
    })

  const allNames = generatePropertyNames(properties)

  // Build object entries for each kebab property name
  const objectEntries: string[] = []
  for (const prop of properties) {
    for (const name of prop.styleDeclaration) {
      const valueSchema = generateLiteralSchema(prop)
      objectEntries.push(`  ${JSON.stringify(name)}: ${valueSchema}.optional()`)
    }
  }

  // Add hardcoded vendor entries
  for (const [name, schema] of Object.entries(HARDCODED_VENDOR_ENTRIES)) {
    objectEntries.push(`  ${JSON.stringify(name)}: ${schema}.optional()`)
    allNames.push(name)
  }

  allNames.sort()

  const objectCode = objectEntries.join(',\n')

  const output = [
    '/**',
    ' * Auto-generated CSS property schemas and types.',
    ' * Generated by `scripts/generate-css-schemas.spec.ts` from @webref/css CSS property data.',
    ' * Do not edit manually.',
    ' */',
    "import { z } from 'zod'",
    '/**',
    ' * Schema mapping kebab-case CSS property names to their value schemas.',
    ' * Unknown properties (e.g. `--*` custom properties) fall through to',
    ' * the catchall: `z.union([z.string(), z.number()])`.',
    ' */',
    `export const CSSPropertiesSchema = z.object({\n${objectCode},\n}).catchall(z.union([z.string(), z.number()]))`,
    '',
    '/**',
    ' * Schema for valid CSS property names — keyof derived from cssPropertySchema.',
    ' */',
    '',
    '/**',
    ' * CSS properties type — every known property key plus custom property passthrough.',
    ' * Values are string or number.',
    ' *',
    ' * @public',
    ' */',
    'export type CSSProperties = z.output<typeof CSSPropertiesSchema>',
    '',
    `export const CSSPropertyNameSchema = CSSPropertiesSchema.keyof()`,
    '',
    `export type CSSPropertyName = z.output<typeof CSSPropertyNameSchema>`,
    '',
  ].join('\n')

  const keywordEnumCount = properties.filter((p) => classifyProperty(p.syntax).classification === 'enum').length

  return {
    code: output,
    propertyCount: allNames.length,
    keywordEnumCount,
  }
}
