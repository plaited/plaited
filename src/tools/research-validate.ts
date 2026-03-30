#!/usr/bin/env bun
/**
 * Validate dev-research program and slice markdown structure.
 *
 * @remarks
 * This is the internal structural counterpart to `validate-skill`.
 * It checks research lanes for required headings, slice numbering, and
 * program/slice consistency so bounded research docs do not silently drift.
 *
 * @public
 */

import { basename, join } from 'node:path'
import * as z from 'zod'
import { isDirectory } from '../skill/skill.utils.ts'
import { parseCli } from './cli.utils.ts'

type ResearchValidationResult = {
  valid: boolean
  path: string
  kind: 'lane' | 'program' | 'slice'
  errors: string[]
  warnings: string[]
}

const ValidateResearchInputSchema = z.object({
  paths: z.array(z.string()).optional().describe('Paths to validate (defaults to dev-research/)'),
})

const ValidateResearchOutputSchema = z.array(
  z.object({
    valid: z.boolean(),
    path: z.string(),
    kind: z.enum(['lane', 'program', 'slice']),
    errors: z.array(z.string()),
    warnings: z.array(z.string()),
  }),
)

export { ValidateResearchInputSchema, ValidateResearchOutputSchema }
export type { ResearchValidationResult }

const REQUIRED_PROGRAM_HEADINGS = [
  '## Mission',
  '## Separation From',
  '## Core Hypothesis',
  '## Acceptance Criteria',
  '## Safety',
] as const

const REQUIRED_SLICE_HEADINGS = [
  '## Target',
  '## Scope',
  '## Required',
  '## Preserve',
  '## Avoid',
  '## Acceptance Criteria',
] as const

const normalizePath = (path: string): string => path.replace(/\\/g, '/')

const extractSliceNumber = (path: string): number | null => {
  const match = basename(path).match(/^slice-(\d+)\.md$/)
  if (!match?.[1]) return null
  return Number(match[1])
}

const findSliceMentions = (markdown: string): number[] => {
  const mentions = [...markdown.matchAll(/Slice\s+(\d+):/g)]
    .map((match) => Number(match[1]))
    .filter((value) => Number.isInteger(value))
  return [...new Set(mentions)].sort((left, right) => left - right)
}

const validateHeadings = ({
  text,
  headings,
  result,
}: {
  text: string
  headings: readonly string[]
  result: ResearchValidationResult
}) => {
  for (const heading of headings) {
    if (!text.includes(heading)) {
      result.errors.push(`Missing required heading: ${heading}`)
    }
  }
}

const validateProgramFile = async (path: string): Promise<ResearchValidationResult> => {
  const result: ResearchValidationResult = {
    valid: false,
    path,
    kind: 'program',
    errors: [],
    warnings: [],
  }

  const file = Bun.file(path)
  if (!(await file.exists())) {
    result.errors.push('Missing required file: program.md')
    return result
  }

  const text = await file.text()
  if (!text.startsWith('# ')) {
    result.errors.push('Program file must start with a top-level markdown heading')
  }
  validateHeadings({ text, headings: REQUIRED_PROGRAM_HEADINGS, result })

  if (!text.includes('## Slice Progression')) {
    result.warnings.push('Missing recommended heading: ## Slice Progression')
  }

  result.valid = result.errors.length === 0
  return result
}

const validateSliceFile = async (path: string): Promise<ResearchValidationResult> => {
  const result: ResearchValidationResult = {
    valid: false,
    path,
    kind: 'slice',
    errors: [],
    warnings: [],
  }

  const file = Bun.file(path)
  if (!(await file.exists())) {
    result.errors.push(`Missing required file: ${basename(path)}`)
    return result
  }

  const text = await file.text()
  const expectedSliceNumber = extractSliceNumber(path)
  if (!text.startsWith('# Slice')) {
    result.errors.push('Slice file must start with a top-level "# Slice" heading')
  }

  if (
    expectedSliceNumber !== null &&
    !text.startsWith(`# Slice ${expectedSliceNumber}`) &&
    !text.startsWith('# Slice:')
  ) {
    result.warnings.push(`Top-level heading does not mention slice number ${expectedSliceNumber}`)
  }

  validateHeadings({ text, headings: REQUIRED_SLICE_HEADINGS, result })
  result.valid = result.errors.length === 0
  return result
}

const validateLaneDirectory = async (laneDir: string): Promise<ResearchValidationResult[]> => {
  const normalizedLaneDir = normalizePath(laneDir)
  const results: ResearchValidationResult[] = []
  const programPath = join(normalizedLaneDir, 'program.md')
  const programResult = await validateProgramFile(programPath)
  results.push({
    valid: programResult.valid,
    path: normalizedLaneDir,
    kind: 'lane',
    errors: [...programResult.errors],
    warnings: [...programResult.warnings],
  })
  results.push(programResult)

  const entries = await Array.fromAsync(new Bun.Glob('slice-*.md').scan({ cwd: normalizedLaneDir, absolute: true }))
  const slicePaths = entries.map(normalizePath).sort()

  if (slicePaths.length === 0) {
    results[0]!.errors.push('Missing slice-*.md files')
  }

  const sliceNumbers = slicePaths
    .map(extractSliceNumber)
    .filter((value): value is number => value !== null)
    .sort((a, b) => a - b)
  if (sliceNumbers.length > 0) {
    const expected = Array.from({ length: sliceNumbers.at(-1)! }, (_, index) => index + 1)
    const missing = expected.filter((value) => !sliceNumbers.includes(value))
    if (missing.length > 0) {
      results[0]!.errors.push(`Missing slice numbers: ${missing.join(', ')}`)
    }
  }

  for (const slicePath of slicePaths) {
    results.push(await validateSliceFile(slicePath))
  }

  if (await Bun.file(programPath).exists()) {
    const programText = await Bun.file(programPath).text()
    const mentions = findSliceMentions(programText)
    const missingMentions = sliceNumbers.filter((value) => !mentions.includes(value))
    if (missingMentions.length > 0) {
      results[0]!.warnings.push(`Slice progression does not mention slices: ${missingMentions.join(', ')}`)
    }
  }

  results[0]!.valid = results[0]!.errors.length === 0
  return results
}

const resolveLaneTargets = async (paths: string[], cwd: string): Promise<string[]> => {
  const targets: string[] = []

  for (const inputPath of paths) {
    const fullPath = inputPath.startsWith('/') ? inputPath : join(cwd, inputPath)
    const normalized = normalizePath(fullPath)
    if (!(await isDirectory(normalized))) {
      targets.push(normalized)
      continue
    }

    if (await Bun.file(join(normalized, 'program.md')).exists()) {
      targets.push(normalized)
      continue
    }

    const lanes = await Array.fromAsync(new Bun.Glob('*/program.md').scan({ cwd: normalized, absolute: true }))
    targets.push(...lanes.map((path) => normalizePath(path.replace(/\/program\.md$/, ''))))
  }

  return [...new Set(targets)].sort()
}

/**
 * CLI entry point for research markdown validation.
 *
 * @public
 */
export const validateResearchCli = async (args: string[]) => {
  if (args.includes('--help') || args.includes('-h')) {
    // biome-ignore lint/suspicious/noConsole: CLI output
    console.log(`plaited validate-research
Validate dev-research program.md and slice-*.md structure

Usage: plaited validate-research '<json>' [options]
       echo '<json>' | plaited validate-research

Input (JSON):
  paths    string[]   Paths to validate (default: dev-research/)

Options:
  --schema <input|output>  Print JSON Schema and exit
  -h, --help               Show this help

Exit codes:
  0  All research docs structurally valid (or --schema/--help)
  1  Structural validation errors found
  2  Bad input or tool error`)
    return
  }

  const input = await parseCli(args.length === 0 && process.stdin.isTTY ? ['{}'] : args, ValidateResearchInputSchema, {
    name: 'validate-research',
    outputSchema: ValidateResearchOutputSchema,
  })

  const searchPaths = input.paths?.length ? input.paths : ['dev-research']
  const laneDirs = await resolveLaneTargets(searchPaths, process.cwd())

  const results = (await Promise.all(laneDirs.map((laneDir) => validateLaneDirectory(laneDir)))).flat()
  // biome-ignore lint/suspicious/noConsole: CLI output
  console.log(JSON.stringify(results, null, 2))
  if (results.some((result) => !result.valid)) process.exit(1)
}

if (import.meta.main) {
  await validateResearchCli(Bun.argv.slice(2))
}
