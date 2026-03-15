/**
 * Grader for evaluating generated bThread factory files.
 *
 * @remarks
 * Library function compatible with the trial runner's `Grader` interface.
 * Evaluates generated TypeScript bThread factories through multiple checks:
 * parse validity, type checking, structural validation (via validate-thread),
 * and optional spec execution. Produces `GradingDimensions`-compatible output.
 *
 * Factory files are written to a temp directory within `src/` so that
 * relative imports (e.g., `../../behavioral/behavioral.utils.ts`) resolve
 * correctly against the project's actual source tree.
 *
 * @packageDocumentation
 */

import { rmSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import * as z from 'zod'
import type { Grader, GraderResult } from './trial.schemas.ts'
import { validateThreadFactory } from './validate-thread.ts'

// ============================================================================
// Types
// ============================================================================

/**
 * Result of an individual grading check.
 *
 * @public
 */
export type GradeCheck = {
  name: string
  pass: boolean
  error?: string
}

/**
 * Configuration for the bThread grader.
 *
 * @public
 */
export type BThreadGraderConfig = {
  /** Run `tsc --noEmit` type check (default: true) */
  typeCheck?: boolean
  /** Run `validateThreadFactory` structural checks (default: true) */
  validate?: boolean
  /** Project root for resolving imports during type checking */
  projectRoot?: string
}

// ============================================================================
// Schemas
// ============================================================================

/**
 * Metadata schema for bThread prompt cases.
 *
 * @remarks
 * Carried in `PromptCase.metadata` to configure grading behavior.
 *
 * @public
 */
export const BThreadPromptMetadataSchema = z.object({
  /** Directory name matching brand — 'goals' | 'dac' | 'workflows' */
  brandDir: z.enum(['goals', 'dac', 'workflows']).default('goals'),
  /** Optional companion test file content */
  spec: z.string().optional(),
  /** Category for reporting */
  category: z.string().optional(),
})

export type BThreadPromptMetadata = z.infer<typeof BThreadPromptMetadataSchema>

// ============================================================================
// Individual Checks
// ============================================================================

/**
 * Check 1: Parse — valid TypeScript via Bun.Transpiler.
 *
 * @internal
 */
const checkParse = (source: string): GradeCheck => {
  try {
    const transpiler = new Bun.Transpiler({ loader: 'ts' })
    transpiler.transformSync(source)
    return { name: 'parse', pass: true }
  } catch (e) {
    return {
      name: 'parse',
      pass: false,
      error: e instanceof Error ? e.message : String(e),
    }
  }
}

/**
 * Check 2: Type check via tsc --noEmit.
 *
 * @remarks
 * Creates a temp `tsconfig.json` that extends the project's one, scoped
 * to only the factory file. Runs `tsc -p` so compiler options like
 * `allowImportingTsExtensions` and `lib: ESNext` are inherited.
 * Relative imports (`../../behavioral/`, `../../agent/`) resolve against
 * the real source tree because the temp dir lives inside `src/`.
 *
 * @internal
 */
const checkTypeCheck = async (tmpBase: string, projectRoot: string): Promise<GradeCheck> => {
  // Compute relative path from tmpBase to project root for extends
  const depth = tmpBase.replace(projectRoot, '').split('/').filter(Boolean).length
  const extendsPath = '../'.repeat(depth) + 'tsconfig.json'

  const tsconfigPath = join(tmpBase, 'tsconfig.json')
  await Bun.write(
    tsconfigPath,
    JSON.stringify({
      extends: extendsPath,
      include: ['./**/*.ts'],
      exclude: ['./**/*.spec.ts'],
    }),
  )

  const result = Bun.spawnSync(['bun', '--bun', 'tsc', '-p', tsconfigPath, '--noEmit'], {
    cwd: projectRoot,
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const stderr = result.stderr.toString().trim()
  const stdout = result.stdout.toString().trim()
  const output = stderr || stdout
  return {
    name: 'typeCheck',
    pass: result.exitCode === 0,
    error: result.exitCode !== 0 ? output.slice(0, 500) : undefined,
  }
}

/**
 * Check 3: Structural validation via validateThreadFactory.
 *
 * @internal
 */
const checkValidate = async (factoryPath: string): Promise<GradeCheck & { warnings: string[] }> => {
  const validation = await validateThreadFactory(factoryPath)
  return {
    name: 'validate',
    pass: validation.valid,
    error: validation.errors.length > 0 ? validation.errors.join('; ') : undefined,
    warnings: validation.warnings,
  }
}

/**
 * Check 4: Companion spec test execution.
 *
 * @internal
 */
const checkSpec = (specPath: string, cwd: string): GradeCheck => {
  const result = Bun.spawnSync(['bun', 'test', specPath], {
    cwd,
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const stderr = result.stderr.toString().trim()
  return {
    name: 'specTest',
    pass: result.exitCode === 0,
    error: result.exitCode !== 0 ? stderr.slice(0, 500) : undefined,
  }
}

// ============================================================================
// Temp Directory Management
// ============================================================================

/**
 * Resolve the project root from the grader's location.
 *
 * @internal
 */
const findProjectRoot = (): string => {
  // This file is at src/tools/bthread-grader.ts
  // Project root is two levels up
  return resolve(import.meta.dir, '../..')
}

/**
 * Create a temp directory for factory evaluation within the project tree.
 *
 * @remarks
 * Places files at `src/.bthread-grader-{id}/{brandDir}/factory.ts` so that
 * imports like `../../behavioral/behavioral.utils.ts` resolve to
 * `src/behavioral/behavioral.utils.ts`.
 *
 * @internal
 */
const createTempDir = async (
  projectRoot: string,
  brandDir: string,
  id: string,
): Promise<{ tmpBase: string; factoryDir: string }> => {
  const tmpBase = join(projectRoot, `src/.bthread-grader-${id}`)
  const factoryDir = join(tmpBase, brandDir)
  await mkdir(factoryDir, { recursive: true })
  return { tmpBase, factoryDir }
}

/**
 * Clean up temp directory.
 *
 * @internal
 */
const cleanupTempDir = (tmpBase: string): void => {
  try {
    rmSync(tmpBase, { recursive: true, force: true })
  } catch {
    // Best-effort cleanup
  }
}

// ============================================================================
// Grader Factory
// ============================================================================

/**
 * Create a bThread generation grader with configurable checks.
 *
 * @remarks
 * The returned grader writes the generated factory to a temp directory,
 * runs the configured checks, and produces a `GraderResult` with
 * `GradingDimensions` (outcome, process, efficiency).
 *
 * Metadata fields on prompt cases:
 * - `brandDir`: `'goals'` | `'dac'` | `'workflows'` — directory for brand matching (default: `'goals'`)
 * - `spec`: companion `.spec.ts` content for behavioral testing
 * - `category`: reporting category
 *
 * @param config - Grader configuration
 * @returns Grader function compatible with the trial runner
 *
 * @public
 */
export const createBThreadGrader = (config?: BThreadGraderConfig): Grader => {
  const { typeCheck = true, validate = true, projectRoot } = config ?? {}
  const root = projectRoot ?? findProjectRoot()

  return async ({ output, metadata }) => {
    const meta = BThreadPromptMetadataSchema.safeParse(metadata ?? {})
    const brandDir = meta.success ? meta.data.brandDir : 'goals'
    const specContent = meta.success ? meta.data.spec : undefined

    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const { tmpBase, factoryDir } = await createTempDir(root, brandDir, id)

    const factoryPath = join(factoryDir, 'factory.ts')
    const specPath = join(factoryDir, 'factory.spec.ts')

    try {
      // Write generated code to temp file
      await Bun.write(factoryPath, output)

      if (specContent) {
        await Bun.write(specPath, specContent)
      }

      // Run checks
      const checks: GradeCheck[] = []
      const warnings: string[] = []

      // Check 1: Parse
      checks.push(checkParse(output))

      // Check 2: Type check (only if parse passed — tsc on broken syntax is noisy)
      if (typeCheck && checks[0]!.pass) {
        checks.push(await checkTypeCheck(tmpBase, root))
      }

      // Check 3: Structural validation
      if (validate) {
        const validation = await checkValidate(factoryPath)
        checks.push(validation)
        warnings.push(...validation.warnings)
      }

      // Check 4: Spec test
      if (specContent) {
        checks.push(checkSpec(specPath, factoryDir))
      }

      return scoreChecks(checks, warnings)
    } finally {
      cleanupTempDir(tmpBase)
    }
  }
}

// ============================================================================
// Scoring
// ============================================================================

/**
 * Compute GraderResult from check results.
 *
 * @internal
 */
const scoreChecks = (checks: GradeCheck[], warnings: string[]): GraderResult => {
  const passCount = checks.filter((c) => c.pass).length
  const totalChecks = checks.length
  const score = totalChecks > 0 ? passCount / totalChecks : 0
  const pass = checks.every((c) => c.pass)

  // Outcome: binary — did the factory pass all checks?
  const outcome = pass ? 1 : 0

  // Process: weighted by check importance
  // parse + typeCheck are foundational (each worth 2x), validate + specTest are structural (1x)
  const weights: Record<string, number> = { parse: 2, typeCheck: 2, validate: 1, specTest: 1 }
  let weightedSum = 0
  let weightTotal = 0
  for (const check of checks) {
    const w = weights[check.name] ?? 1
    weightedSum += check.pass ? w : 0
    weightTotal += w
  }
  const process = weightTotal > 0 ? weightedSum / weightTotal : 0

  const reasoning = checks
    .map((c) => `${c.name}: ${c.pass ? 'PASS' : 'FAIL'}${c.error ? ` (${c.error.slice(0, 100)})` : ''}`)
    .join('; ')

  return {
    pass,
    score,
    reasoning: warnings.length > 0 ? `${reasoning}; warnings: ${warnings.join(', ')}` : reasoning,
    outcome: {
      checks: checks.map((c) => ({
        name: c.name,
        pass: c.pass,
        ...(c.error && { error: c.error }),
      })),
      ...(warnings.length > 0 && { warnings }),
    },
    dimensions: {
      outcome,
      process,
      efficiency: 1, // Static — could compare line count or structure complexity
    },
  }
}

// ============================================================================
// Default Export (polyglot loading)
// ============================================================================

/**
 * Default grader for polyglot loading via `loadGrader()`.
 *
 * @remarks
 * Exported as `grade` for the trial runner's polyglot loader convention.
 *
 * @public
 */
export const grade: Grader = createBThreadGrader()
