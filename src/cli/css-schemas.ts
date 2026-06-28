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
 * and writes `src/client/css.schemas.ts`. Must NOT be wired into publish CI.
 *
 * @packageDocumentation
 */

import * as path from 'node:path'
import * as z from 'zod'
import { generateCssSchemas } from '../client/css-schema-generator.ts'
import { makeCli } from './cli.ts'

// ============================================================================
// Schemas
// ============================================================================

const cssSchemasInputSchema = z
  .object({
    mode: z
      .enum(['generate', 'diff'])
      .describe('generate = emit/write the file; diff = report drift vs committed file'),
    outputPath: z.string().optional().describe('Where to write on generate; defaults to src/client/css.schemas.ts'),
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

const DEFAULT_OUTPUT_PATH = 'src/client/css.schemas.ts'

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
  '  generate   Regenerate and write src/client/css.schemas.ts',
  '  diff       Compare generated output against the committed file without writing',
  '',
  'Usage:',
  '  plaited css-schemas \'{"mode":"diff"}\'',
  '  plaited css-schemas \'{"mode":"generate"}\'',
  '  plaited css-schemas \'{"mode":"generate","outputPath":"src/client/css.schemas.ts"}\'',
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
