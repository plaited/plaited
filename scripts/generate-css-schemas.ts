/**
 * @module generate-css-schemas
 *
 * Generates `src/client/css.schemas.ts` from @webref/css CSS property data.
 * Each property's `syntax` is parsed with css-tree's definitionSyntax.parse,
 * then classified into one of three Zod schema shapes:
 *
 * - Pure-keyword: only Keyword AST nodes → z.enum([...keywords])
 * - Keywords + <number>/<integer> type → z.enum([...keywords]).or(z.number())
 * - Everything else → z.union([z.string(), z.number()])
 *
 * Each property's styleDeclaration array provides the kebab and camel case keys
 * emitted in the properties object schema.
 *
 * The agent emits literal CSS values only (no $refs). The resolver layer
 * ($tokenRef/$keyframeRef) is out of scope and handled by a future DB layer.
 */

import { definitionSyntax } from 'css-tree'

// --- Types ---

type PropertyClassification = 'enum' | 'enum-or-number' | 'string-or-number'
type PropertySyntax = {
  keywords: string[]
  classification: PropertyClassification
}

type PropertyEntry = {
  name: string
  syntax: string
  styleDeclaration: string[]
}

// --- Core logic ---

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

// --- Code generation ---

const keywordsToEnum = (keywords: string[]): string => {
  const values = [...new Set(keywords)].map((k) => JSON.stringify(k)).join(', ')
  return `z.enum([${values}])`
}

const generateValueSchema = (property: PropertyEntry): string => {
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

// --- Main ---

const main = async () => {
  const cssJsonPath = new URL('../node_modules/@webref/css/css.json', import.meta.url)
  const cssFile = Bun.file(cssJsonPath)
  if (!(await cssFile.exists())) {
    console.error(`@webref/css data not found at ${cssJsonPath.pathname}`)
    console.error('Run: bun add -d @webref/css css-tree')
    process.exit(1)
  }
  const cssJson = await cssFile.json()

  const properties: PropertyEntry[] = cssJson.properties
    .filter((p: Record<string, unknown>) => p.syntax)
    .map((p: Record<string, unknown>) => ({
      name: p.name as string,
      syntax: p.syntax as string,
      styleDeclaration: (p.styleDeclaration as string[]) ?? [p.name as string],
    }))

  const allNames = generatePropertyNames(properties)
  const propertyNameEntries = allNames.map((n) => JSON.stringify(n)).join(', ')

  // Build a map from styleDeclaration name → property entry for quick lookup
  const nameToProp = new Map<string, PropertyEntry>()
  for (const prop of properties) {
    for (const name of prop.styleDeclaration) {
      nameToProp.set(name, prop)
    }
  }

  // Generate the switch-based value schema lookup
  const schemaCases = allNames
    .map((name) => {
      const prop = nameToProp.get(name)!
      const valueSchema = generateValueSchema(prop)
      return `  case ${JSON.stringify(name)}: return ${valueSchema}`
    })
    .join('\n')

  const schemaCode = `(prop: string): z.ZodTypeAny => {
  switch (prop) {
${schemaCases}
    default:
      return z.union([z.string(), z.number()])
  }
}`

  // Generate CSSProperties type with known property keys (all optional)
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
    '',
    '/**',
    ' * Schema for valid CSS property names (kebab and camel case).',
    ' */',
    `export const cssPropertyNameSchema = z.enum([${propertyNameEntries}])`,
    '',
    '/**',
    ' * Per-property value schema lookup.',
    ' * Returns the appropriate Zod schema for a given CSS property name.',
    ' * Known properties map to their specific value schema.',
    ' * Unknown properties (e.g. `--*` custom properties) return a catchall.',
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

  const outputPath = new URL('../src/client/css.schemas.ts', import.meta.url)
  await Bun.write(outputPath, output)
  console.log(`Generated ${outputPath.pathname}`)
}

main()
