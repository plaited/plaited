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
  '-webkit-appearance': "{ type: ['string', 'number'] }",
  '-webkit-backdrop-filter': "{ type: ['string', 'number'] }",
  '-webkit-box-orient': "{ type: ['string', 'number'] }",
  '-webkit-hyphens': "{ type: ['string', 'number'] }",
  '-webkit-line-clamp': "{ anyOf: [{ type: 'string', enum: ['none'] }, { type: 'number' }] }",
  '-webkit-user-select':
    "{ anyOf: [{ type: 'string', enum: ['auto', 'text', 'none', 'contain', 'all'] }, { type: 'number' }] }",
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
  return `{ type: 'string', enum: [${values}] }`
}

const generateLiteralSchema = (property: PropertyEntry): string => {
  const { keywords, classification } = classifyProperty(property.syntax)

  switch (classification) {
    case 'enum':
      return keywordsToEnum(keywords)
    case 'enum-or-number':
      return `{ anyOf: [${keywordsToEnum(keywords)}, { type: 'number' }] }`
    case 'string-or-number':
      return `{ type: ['string', 'number'] }`
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
      objectEntries.push(`  ${JSON.stringify(name)}: ${valueSchema},`)
    }
  }

  // Add hardcoded vendor entries
  for (const [name, schema] of Object.entries(HARDCODED_VENDOR_ENTRIES)) {
    objectEntries.push(`  ${JSON.stringify(name)}: ${schema},`)
    allNames.push(name)
  }

  allNames.sort()

  const objectCode = objectEntries.join('\n')

  const output = [
    '/**',
    ' * Auto-generated CSS property schemas and types.',
    ' * Generated by `scripts/css-schemas/generate.ts` from @webref/css CSS property data.',
    ' * Do not edit manually.',
    ' */',
    "import Ajv2020 from 'ajv/dist/2020'",
    '',
    '/**',
    ' * Shared Ajv instance for CSS property value validation.',
    ' * `validateSchema` rejects structurally-broken subschemas early.',
    ' */',
    'export const ajv = new Ajv2020({ strict: false, validateSchema: true })',
    '',
    '/**',
    ' * Schema mapping kebab-case CSS property names to their value schemas.',
    ' * Unknown properties (e.g. `--*` custom properties) fall through to',
    " * `additionalProperties: { type: ['string', 'number'] }`.",
    ' */',
    `export const CSSPropertiesSchema = {
  type: 'object',
  properties: {
${objectCode}
  },
  additionalProperties: { type: ['string', 'number'] },
}`,
    '',
    '/**',
    ' * CSS properties type — every known property key plus custom property passthrough.',
    ' * Values are string or number.',
    ' *',
    ' * @public',
    ' */',
    'export type CSSProperties = Record<string, string | number>',
    '',
    '/**',
    ' * Per-property validator cache — compile lazily on first use so runtime',
    ' * cost is paid only for properties actually encountered.',
    ' */',
    'const validatorCache = new Map<string, (value: unknown) => boolean>()',
    '',
    '/**',
    ' * Validates one CSS property value against its generated schema.',
    " * Custom properties ('--*') and unknown properties pass as string/number.",
    ' */',
    'export const validateCSSValue = (property: string, value: unknown): boolean => {',
    "  if (property.startsWith('--')) return typeof value === 'string' || typeof value === 'number'",
    '  const schema = (CSSPropertiesSchema.properties as Record<string, unknown>)[property]',
    '  if (!schema) return false',
    '  let validate = validatorCache.get(property)',
    '  if (!validate) {',
    '    validate = ajv.compile(schema as object)',
    '    validatorCache.set(property, validate)',
    '  }',
    '  return validate(value)',
    '}',
    '',
  ].join('\n')

  const keywordEnumCount = properties.filter((p) => classifyProperty(p.syntax).classification === 'enum').length

  return {
    code: output,
    propertyCount: allNames.length,
    keywordEnumCount,
  }
}
