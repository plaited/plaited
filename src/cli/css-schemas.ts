/**
 * @module css-schemas
 *
 * CSS property schema generation and drift-detection CLI command.
 *
 * Reads @webref/css data, runs the pure generator, and either writes the
 * output file (generate) or diffs against the committed file (diff).
 *
 * @remarks
 * This is a dev/operator-only command. It reads `node_modules/@webref/css/css.json`
 * and writes `src/shared/css.schemas.ts`. Must NOT be wired into publish CI.
 *
 * @packageDocumentation
 */

/// <reference path="../../scripts/types/css-tree.d.ts" />

import * as path from 'node:path'
import { definitionSyntax } from 'css-tree'
import * as z from 'zod'
import { makeCli } from './cli.ts'

// ============================================================================
// CSS Schema Generator — inlined from src/client/css-schema-generator.ts
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

const HARDCODED_VENDOR_ENTRIES: Record<string, string> = {
  '-webkit-appearance': 'z.union([z.string(), z.number()])',
  '-webkit-backdrop-filter': 'z.union([z.string(), z.number()])',
  '-webkit-box-orient': 'z.union([z.string(), z.number()])',
  '-webkit-hyphens': 'z.union([z.string(), z.number()])',
  '-webkit-line-clamp': "z.enum(['none']).or(z.number())",
  '-webkit-user-select': "z.enum(['auto', 'text', 'none', 'contain', 'all']).or(z.number())",
}

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

const generateValueSchema = (name: string, property: PropertyEntry): string => {
  return generateLiteralSchema(property)
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

/**
 * Generate CSS property schemas from parsed @webref/css data.
 *
 * Only kebab-case property names are emitted (no camelCase variants).
 * Vendor-prefixed `-webkit-*` properties from the data are excluded;
 * the specific Safari-compat entries from HARDCODED_VENDOR_ENTRIES
 * are added directly to the output.
 *
 * @param cssJson - Parsed @webref/css JSON object with a `properties` array.
 * @returns Generated source code with property count and keyword enum count.
 *
 * @public
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
  const nameToProp = new Map<string, PropertyEntry>()
  for (const prop of properties) {
    for (const name of prop.styleDeclaration) {
      nameToProp.set(name, prop)
      const valueSchema = generateValueSchema(name, prop)
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
    '// @ts-nocheck',
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
    `export const cssPropertySchema = z.object({\n${objectCode},\n}).catchall(z.union([z.string(), z.number()]))`,
    '',
    '/**',
    ' * Schema for valid CSS property names — keyof derived from cssPropertySchema.',
    ' */',
    `export const cssPropertyNameSchema = cssPropertySchema.keyof()`,
    '',
    '/**',
    ' * CSS properties type — every known property key plus custom property passthrough.',
    ' * Values are string or number.',
    ' *',
    ' * @public',
    ' */',
    'export type CSSProperties = z.output<typeof cssPropertySchema>',
    '',
  ].join('\n')

  const keywordEnumCount = properties.filter((p) => classifyProperty(p.syntax).classification === 'enum').length

  return {
    code: output,
    propertyCount: allNames.length,
    keywordEnumCount,
  }
}

// ============================================================================
// Schemas
// ============================================================================

const cssSchemasInputSchema = z
  .object({
    mode: z
      .enum(['generate', 'diff'])
      .describe('generate = emit/write the file; diff = report drift vs committed file'),
    outputPath: z.string().optional().describe('Where to write on generate; defaults to src/shared/css.schemas.ts'),
  })
  .describe('Refresh or drift-check the generated CSS property schemas from @webref/css')

const cssSchemasOutputSchema = z
  .object({
    path: z.string(),
    bytes: z.number(),
    propertyCount: z.number(),
    keywordEnumCount: z.number(),
    changed: z.boolean(),
    diff: z.string().optional(),
  })
  .describe('Result of a css-schemas generate/diff run')

// ============================================================================
// Types
// ============================================================================

/** @public */
export type CssSchemasInput = z.infer<typeof cssSchemasInputSchema>

/** @public */
export type CssSchemasOutput = z.infer<typeof cssSchemasOutputSchema>

// ============================================================================
// Defaults
// ============================================================================

const DEFAULT_OUTPUT_PATH = 'src/shared/css.schemas.ts'

// ============================================================================
// Minimal line diff — upgrade to `diff` npm pkg if richer output needed
// ============================================================================

/**
 * Produce a minimal unified-style line diff between two strings.
 * MINIMAL: line-diff, upgrade to `diff` npm pkg if richer output needed.
 */
const lineDiff = (a: string, b: string): string => {
  if (a === b) return ''

  const aLines = a.split('\n')
  const bLines = b.split('\n')
  const maxLen = Math.max(aLines.length, bLines.length)
  const lines: string[] = []

  for (let i = 0; i < maxLen; i++) {
    const aLine = aLines[i]
    const bLine = bLines[i]
    if (aLine === bLine) {
      if (aLine !== undefined) lines.push(` ${aLine}`)
    } else {
      if (aLine !== undefined) lines.push(`-${aLine}`)
      if (bLine !== undefined) lines.push(`+${bLine}`)
    }
  }

  return ['--- original', '+++ generated', ...lines].join('\n')
}

// ============================================================================
// Handler
// ============================================================================

const runCssSchemas = async (input: CssSchemasInput, flags: { dryRun: boolean }): Promise<CssSchemasOutput> => {
  const cssDataPath = path.resolve('node_modules/@webref/css/css.json')
  const cssFile = Bun.file(cssDataPath)
  if (!(await cssFile.exists())) {
    throw new Error('@webref/css not installed — run `bun add -d @webref/css css-tree` from a repo checkout.')
  }
  const cssJson = await cssFile.json()

  const { code: rawCode, propertyCount, keywordEnumCount } = generateCssSchemas(cssJson)

  // Format through biome to match git pre-commit hook style
  const tmpFile = path.resolve('/tmp/.css-schemas-tmp.ts')
  await Bun.$`mkdir -p ${path.dirname(tmpFile)}`.quiet().nothrow()
  await Bun.write(tmpFile, rawCode)
  const fmtResult = await Bun.$`bunx biome check --write --unsafe ${tmpFile}`.quiet().nothrow()
  const code = fmtResult.exitCode === 0 ? await Bun.file(tmpFile).text() : rawCode
  await Bun.write(tmpFile, '').catch(() => {})

  const encoder = new TextEncoder()
  const bytes = encoder.encode(code).length

  const outputPath = input.outputPath ?? DEFAULT_OUTPUT_PATH
  const committedFile = Bun.file(outputPath)
  const committedExists = await committedFile.exists()

  if (input.mode === 'generate') {
    let changed = true
    if (committedExists) {
      const existingContent = await committedFile.text()
      changed = existingContent !== code
    }

    if (!flags.dryRun) {
      await Bun.write(outputPath, code)
    }

    return { path: outputPath, bytes, propertyCount, keywordEnumCount, changed }
  }

  // mode: 'diff'
  if (!committedExists) {
    return { path: outputPath, bytes, propertyCount, keywordEnumCount, changed: true, diff: lineDiff('', code) }
  }

  const committed = await committedFile.text()
  const changed = committed !== code

  return {
    path: outputPath,
    bytes,
    propertyCount,
    keywordEnumCount,
    changed,
    diff: changed ? lineDiff(committed, code) : undefined,
  }
}

// ============================================================================
// CLI export
// ============================================================================

const HELP_TEXT = [
  'Refresh or drift-check the generated CSS property schemas from @webref/css.',
  '',
  'Modes:',
  '  generate   Regenerate and write src/shared/css.schemas.ts',
  '  diff       Compare generated output against the committed file without writing',
  '',
  'Usage:',
  '  plaited css-schemas \'{"mode":"diff"}\'',
  '  plaited css-schemas \'{"mode":"generate"}\'',
  '  plaited css-schemas \'{"mode":"generate","outputPath":"src/shared/css.schemas.ts"}\'',
  '',
  'Requirements:',
  '  - Must run from a repo checkout with @webref/css and css-tree installed (devDeps)',
  '  - Do NOT wire this command into publish CI',
  '  - Always review the diff before committing generated output',
].join('\n')

export const cssSchemasCli = makeCli({
  name: 'css-schemas',
  inputSchema: cssSchemasInputSchema,
  outputSchema: cssSchemasOutputSchema,
  help: HELP_TEXT,
  run: runCssSchemas,
})
