/**
 * Three-dimension grader for evaluating generated proactive node artifacts.
 *
 * @remarks
 * Evaluates generated sensors, goals, and notification channels across
 * three dimensions mapped to `GradingDimensions`:
 *
 * - **outcome** (Contract compliance): Does the code satisfy SensorFactory/GoalFactory
 *   type contracts? Parse validity, tsc check, structural contract matching.
 * - **process** (Behavioral correctness): Do generated bThreads use correct BP
 *   patterns? bSync/bThread, interrupt, repeat, waitFor predicates.
 * - **efficiency** (Integration): Does the code wire into createAgentLoop correctly?
 *   Imports, option passing, factory helpers.
 *
 * Scoring: cbrt(contract × behavioral × integration) — geometric mean penalizes
 * any zero dimension.
 *
 * @packageDocumentation
 */

import { join, resolve } from 'node:path'
import * as z from 'zod'
import type { Grader, GraderResult } from './trial.schemas.ts'

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
 * Configuration for the proactive grader.
 *
 * @public
 */
export type ProactiveGraderConfig = {
  /** Run tsc --noEmit type check (default: true) */
  typeCheck?: boolean
  /** Project root for resolving tsconfig during type checking */
  projectRoot?: string
}

// ============================================================================
// Schemas
// ============================================================================

const EvalRefSchema = z.object({
  intention: z.array(z.string()),
  static: z.array(z.string()),
  dynamic: z.array(z.string()),
})

/**
 * Metadata schema for proactive node prompt cases.
 *
 * @public
 */
export const ProactivePromptMetadataSchema = z.object({
  domain: z.string().optional(),
  subclass: z.string().optional(),
  difficulty: z.enum(['Easy', 'Medium', 'Hard']).optional(),
  eval_ref: EvalRefSchema.optional(),
  artifact_type: z.string().optional(),
  expected_types: z.array(z.string()).optional(),
})

/** Inferred type for {@link ProactivePromptMetadataSchema}. */
export type ProactivePromptMetadata = z.infer<typeof ProactivePromptMetadataSchema>

// ============================================================================
// Contract Compliance Checks (Outcome Dimension)
// ============================================================================

/**
 * Check: Parse — valid TypeScript via Bun.Transpiler.
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
 * Check: Parse each TS file in the workspace individually.
 *
 * @internal
 */
const checkParseFiles = async (cwd: string): Promise<GradeCheck> => {
  const result = Bun.spawnSync(
    ['find', cwd, '-name', '*.ts', '-not', '-name', '*.spec.ts', '-not', '-path', '*/node_modules/*'],
    { stdout: 'pipe', stderr: 'pipe' },
  )
  const files = result.stdout.toString().trim().split('\n').filter(Boolean)

  if (files.length === 0) {
    return { name: 'parse', pass: false, error: 'no .ts files found' }
  }

  const transpiler = new Bun.Transpiler({ loader: 'ts' })
  const errors: string[] = []

  for (const file of files) {
    try {
      const source = await Bun.file(file).text()
      transpiler.transformSync(source)
    } catch (e) {
      const shortPath = file.replace(`${cwd}/`, '')
      errors.push(`${shortPath}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  if (errors.length > 0) {
    return {
      name: 'parse',
      pass: false,
      error: `${errors.length}/${files.length} files failed: ${errors[0]!.slice(0, 200)}`,
    }
  }

  return { name: 'parse', pass: true }
}

/**
 * Check: Type check via tsc --noEmit.
 *
 * @internal
 */
const checkTypeCheck = async (cwd: string, projectRoot: string): Promise<GradeCheck> => {
  const hasNodeModules =
    (await Bun.file(join(cwd, 'node_modules')).exists()) || (await Bun.file(join(projectRoot, 'node_modules')).exists())
  if (!hasNodeModules) {
    return { name: 'typeCheck', pass: true }
  }

  const tsconfigPath = join(cwd, 'tsconfig.json')
  const tsconfigExists = await Bun.file(tsconfigPath).exists()

  if (!tsconfigExists) {
    // Compute relative path from cwd to project root for extends
    const depth = cwd.replace(projectRoot, '').split('/').filter(Boolean).length
    const extendsPath = `${'../'.repeat(depth)}tsconfig.json`

    await Bun.write(
      tsconfigPath,
      JSON.stringify({
        extends: extendsPath,
        include: ['./**/*.ts'],
        exclude: ['./**/*.spec.ts'],
      }),
    )
  }

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
 * Check: SensorFactory contract — code defines object with name, read, diff, snapshotPath.
 *
 * @internal
 */
const checkSensorContract = (code: string): GradeCheck => {
  const indicators = [
    { field: 'name', patterns: [/name\s*:/] },
    { field: 'read', patterns: [/read\s*[:(]/, /read\s*:\s*async/, /async\s+read\s*\(/] },
    { field: 'diff', patterns: [/diff\s*[:(]/, /diff\s*:\s*\(/, /diff\s*\(/] },
    { field: 'snapshotPath', patterns: [/snapshotpath\s*:/i] },
  ]

  const missing: string[] = []
  for (const { field, patterns } of indicators) {
    const found = patterns.some((p) => p.test(code))
    if (!found) {
      missing.push(field)
    }
  }

  if (missing.length > 0) {
    return { name: 'sensorContract', pass: false, error: `missing SensorFactory fields: ${missing.join(', ')}` }
  }
  return { name: 'sensorContract', pass: true }
}

/**
 * Check: GoalFactory contract — code uses createGoal with branded factory pattern.
 *
 * @internal
 */
const checkGoalContract = (code: string): GradeCheck => {
  const hasCreateGoal = /createGoal\s*\(/.test(code)
  const hasBrandLiteral = /\$\s*:\s*['"`]🎯['"`]/.test(code)
  const hasCreate = /create\s*:\s*\(/.test(code) || /create\s*\(\s*trigger/.test(code)

  if (hasCreateGoal) {
    return { name: 'goalContract', pass: true }
  }

  if (hasBrandLiteral && hasCreate) {
    return { name: 'goalContract', pass: true }
  }

  return {
    name: 'goalContract',
    pass: false,
    error: 'no GoalFactory found — expected createGoal() call or { $: "🎯", create: ... } pattern',
  }
}

// ============================================================================
// Behavioral Correctness Checks (Process Dimension)
// ============================================================================

/**
 * Check: bThread usage — code uses bThread() from behavioral utils.
 *
 * @internal
 */
const checkBThread = (code: string): GradeCheck => {
  const hasBThread = /bThread\s*\(/.test(code)
  if (!hasBThread) {
    return { name: 'bThread', pass: false, error: 'no bThread() call found' }
  }
  return { name: 'bThread', pass: true }
}

/**
 * Check: bSync usage — code uses bSync() for synchronization points.
 *
 * @internal
 */
const checkBSync = (code: string): GradeCheck => {
  const hasBSync = /bSync\s*\(/.test(code)
  if (!hasBSync) {
    return { name: 'bSync', pass: false, error: 'no bSync() call found' }
  }
  return { name: 'bSync', pass: true }
}

/**
 * Check: repeat pattern — goals should use repeat: true for continuous monitoring.
 *
 * @internal
 */
const checkRepeat = (code: string): GradeCheck => {
  // Allow trailing comma before closing paren: bThread([...], true,\n)
  const hasRepeatTrue = /,\s*true\s*,?\s*\)/.test(code) || /repeat\s*:\s*true/.test(code)
  const hasRepeatPredicate = /,\s*\(\s*\)\s*=>/.test(code)
  if (!hasRepeatTrue && !hasRepeatPredicate) {
    return { name: 'repeat', pass: false, error: 'no repeat parameter found on bThread — goals need repeat: true' }
  }
  return { name: 'repeat', pass: true }
}

/**
 * Check: waitFor pattern — bSync uses waitFor for event listening.
 *
 * @internal
 */
const checkWaitFor = (code: string): GradeCheck => {
  const hasWaitFor = /waitFor\s*:/.test(code)
  if (!hasWaitFor) {
    return { name: 'waitFor', pass: false, error: 'no waitFor found in bSync — goals need to listen for events' }
  }
  return { name: 'waitFor', pass: true }
}

/**
 * Check: sensor_delta event handling — goal watches for sensor changes.
 *
 * @internal
 */
const checkSensorDeltaHandling = (code: string): GradeCheck => {
  const hasSensorDelta = /sensor_delta/.test(code) || /AGENT_EVENTS\.sensor_delta/.test(code)
  if (!hasSensorDelta) {
    return { name: 'sensorDeltaHandling', pass: false, error: 'no sensor_delta event reference found' }
  }
  return { name: 'sensorDeltaHandling', pass: true }
}

/**
 * Check: AbortSignal usage — sensor read() should accept AbortSignal.
 *
 * @internal
 */
const checkAbortSignal = (code: string): GradeCheck => {
  const hasSignal =
    /signal\s*:\s*AbortSignal/.test(code) || /signal\s*:.*AbortSignal/.test(code) || /\(signal/.test(code)
  if (!hasSignal) {
    return { name: 'abortSignal', pass: false, error: 'sensor read() should accept AbortSignal parameter' }
  }
  return { name: 'abortSignal', pass: true }
}

// ============================================================================
// Integration Checks (Efficiency Dimension)
// ============================================================================

/**
 * Check: Imports — code imports from correct plaited source paths.
 *
 * @internal
 */
const checkImports = (code: string): GradeCheck => {
  const hasBehavioralImport = /from\s+['"].*behavioral/.test(code) || /import.*from\s+['"].*behavioral/.test(code)
  const hasAgentImport = /from\s+['"].*agent/.test(code) || /import.*from\s+['"].*agent/.test(code)

  if (!hasBehavioralImport && !hasAgentImport) {
    return {
      name: 'imports',
      pass: false,
      error: 'no imports from behavioral/ or agent/ — proactive artifacts must use framework types',
    }
  }
  return { name: 'imports', pass: true }
}

/**
 * Check: Task event wiring — goal requests a 'task' event for triggering actions.
 *
 * @internal
 */
const checkTaskWiring = (code: string): GradeCheck => {
  const hasTaskRequest =
    /request\s*:.*type\s*:\s*['"`]task['"`]/.test(code) ||
    /request\s*:.*AGENT_EVENTS\.task/.test(code) ||
    /type\s*:\s*['"`]task['"`]/.test(code) ||
    // AGENT_EVENTS.task used as the type value (may be on a separate line)
    /AGENT_EVENTS\.task/.test(code)
  if (!hasTaskRequest) {
    return { name: 'taskWiring', pass: false, error: 'goal should request a task event to trigger agent action' }
  }
  return { name: 'taskWiring', pass: true }
}

/**
 * Check eval_ref items against code using keyword matching.
 *
 * @internal
 */
const gradeEvalItems = (
  code: string,
  items: string[],
): { score: number; results: Array<{ item: string; pass: boolean }> } => {
  if (items.length === 0) return { score: 1, results: [] }

  const stopWords = new Set([
    'the',
    'and',
    'with',
    'for',
    'that',
    'this',
    'from',
    'has',
    'via',
    'its',
    'should',
    'does',
    'can',
    'are',
    'was',
    'not',
    'but',
    'between',
    'through',
    'each',
    'all',
    'any',
    'into',
    'per',
    'using',
    'shows',
    'allows',
    'supports',
  ])

  const results: Array<{ item: string; pass: boolean }> = []

  for (const item of items) {
    const lower = code.toLowerCase()
    const terms = item
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length >= 3 && !stopWords.has(t))

    if (terms.length === 0) {
      results.push({ item, pass: true })
      continue
    }

    const matched = terms.filter((term) => {
      if (lower.includes(term)) return true
      const stem = term.replace(/(s|es|ed|ing|tion|ment|ness|able|ible)$/, '')
      return stem.length >= 3 && lower.includes(stem)
    })
    results.push({ item, pass: matched.length / terms.length >= 0.5 })
  }

  const passCount = results.filter((r) => r.pass).length
  return { score: passCount / items.length, results }
}

// ============================================================================
// Source Collection
// ============================================================================

/**
 * Collect all TypeScript source files from a directory.
 *
 * @internal
 */
const collectSource = async (cwd: string): Promise<string> => {
  const result = Bun.spawnSync(
    ['find', cwd, '-name', '*.ts', '-not', '-name', '*.spec.ts', '-not', '-path', '*/node_modules/*'],
    { stdout: 'pipe', stderr: 'pipe' },
  )
  const files = result.stdout.toString().trim().split('\n').filter(Boolean)
  const sources: string[] = []

  for (const file of files) {
    const content = await Bun.file(file).text()
    sources.push(`// === ${file} ===\n${content}`)
  }

  return sources.join('\n\n')
}

// ============================================================================
// Scoring
// ============================================================================

/**
 * Compute composite GraderResult from three dimension scores.
 *
 * @internal
 */
const scoreProactive = (
  contractChecks: GradeCheck[],
  behavioralChecks: GradeCheck[],
  integrationChecks: GradeCheck[],
  evalRefResults: {
    intention: { score: number; results: Array<{ item: string; pass: boolean }> }
    static: { score: number; results: Array<{ item: string; pass: boolean }> }
    dynamic: { score: number; results: Array<{ item: string; pass: boolean }> }
  },
): GraderResult => {
  // Contract (outcome): weighted — parse and typeCheck are foundational (2x)
  const contractWeights: Record<string, number> = { parse: 2, typeCheck: 2, sensorContract: 1, goalContract: 1 }
  let contractWeightedSum = 0
  let contractWeightTotal = 0
  for (const check of contractChecks) {
    const w = contractWeights[check.name] ?? 1
    contractWeightedSum += check.pass ? w : 0
    contractWeightTotal += w
  }
  const contractScore = contractWeightTotal > 0 ? contractWeightedSum / contractWeightTotal : 0

  // Behavioral (process): all checks equally weighted
  const behavioralPassCount = behavioralChecks.filter((c) => c.pass).length
  const behavioralScore = behavioralChecks.length > 0 ? behavioralPassCount / behavioralChecks.length : 1

  // Integration (efficiency): all checks equally weighted
  const integrationPassCount = integrationChecks.filter((c) => c.pass).length
  const integrationScore = integrationChecks.length > 0 ? integrationPassCount / integrationChecks.length : 1

  // Blend structural checks with eval_ref keyword matching
  // Contract gets 60% structural + 40% eval_ref.static
  // Behavioral gets 60% structural + 40% eval_ref.dynamic
  // Integration gets 60% structural + 40% eval_ref.intention
  const blendedContract = contractScore * 0.6 + evalRefResults.static.score * 0.4
  const blendedBehavioral = behavioralScore * 0.6 + evalRefResults.dynamic.score * 0.4
  const blendedIntegration = integrationScore * 0.6 + evalRefResults.intention.score * 0.4

  // Composite: geometric mean of three dimensions
  const composite = Math.cbrt(blendedContract * blendedBehavioral * blendedIntegration)
  const pass = composite >= 0.5

  // Reasoning summary
  const formatChecks = (checks: GradeCheck[]) =>
    checks.map((c) => `${c.name}: ${c.pass ? 'PASS' : 'FAIL'}${c.error ? ` (${c.error.slice(0, 80)})` : ''}`).join('; ')

  const contractSummary = `contract: ${formatChecks(contractChecks)}`
  const behavioralSummary = `behavioral: ${formatChecks(behavioralChecks)}`
  const integrationSummary = `integration: ${formatChecks(integrationChecks)}`

  return {
    pass,
    score: composite,
    reasoning: `${contractSummary}; ${behavioralSummary}; ${integrationSummary}`,
    outcome: {
      contract: {
        score: blendedContract,
        checks: contractChecks.map((c) => ({
          name: c.name,
          pass: c.pass,
          ...(c.error && { error: c.error }),
        })),
      },
      behavioral: {
        score: blendedBehavioral,
        checks: behavioralChecks.map((c) => ({
          name: c.name,
          pass: c.pass,
          ...(c.error && { error: c.error }),
        })),
      },
      integration: {
        score: blendedIntegration,
        checks: integrationChecks.map((c) => ({
          name: c.name,
          pass: c.pass,
          ...(c.error && { error: c.error }),
        })),
      },
      eval_ref: {
        intention: evalRefResults.intention,
        static: evalRefResults.static,
        dynamic: evalRefResults.dynamic,
      },
    },
    dimensions: {
      outcome: blendedContract,
      process: blendedBehavioral,
      efficiency: blendedIntegration,
    },
  }
}

// ============================================================================
// Grader Factory
// ============================================================================

/**
 * Resolve the project root from the grader's location.
 *
 * @internal
 */
const findProjectRoot = (): string => resolve(import.meta.dir, '../..')

/**
 * Create a proactive artifact grader with configurable checks.
 *
 * @remarks
 * Three-dimension grading adapted for proactive node artifacts:
 *
 * 1. **Contract compliance** (outcome): SensorFactory/GoalFactory type contracts.
 *    Parse validity, tsc check, structural contract matching.
 *
 * 2. **Behavioral correctness** (process): BP pattern usage — bSync/bThread,
 *    interrupt, repeat, waitFor predicates, sensor_delta handling.
 *
 * 3. **Integration** (efficiency): Framework wiring — correct imports,
 *    task event wiring, factory helper usage.
 *
 * Composite score uses geometric mean: cbrt(contract × behavioral × integration).
 *
 * @param config - Grader configuration
 * @returns Grader function compatible with the trial runner
 *
 * @public
 */
export const createProactiveGrader = (config?: ProactiveGraderConfig): Grader => {
  const { typeCheck = true, projectRoot } = config ?? {}
  const root = projectRoot ?? findProjectRoot()

  return async ({ output, metadata, cwd }) => {
    const meta = ProactivePromptMetadataSchema.safeParse(metadata ?? {})
    const evalRef = meta.success ? meta.data.eval_ref : undefined
    const expectedTypes = meta.success ? (meta.data.expected_types ?? []) : []

    // Determine working directory
    const workDir = cwd ?? join(root, `src/.proactive-grader-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)
    const useTempDir = !cwd

    try {
      if (useTempDir) {
        await Bun.$`mkdir -p ${workDir}`.quiet()
        await Bun.write(join(workDir, 'proactive-artifact.ts'), output)
      }

      // Collect all source code for analysis
      const allSource = cwd ? await collectSource(cwd) : output

      // === Dimension 1: Contract Compliance (outcome) ===
      const contractChecks: GradeCheck[] = []

      // Parse check
      if (cwd) {
        contractChecks.push(await checkParseFiles(cwd))
      } else {
        contractChecks.push(output ? checkParse(output) : { name: 'parse', pass: false, error: 'no source found' })
      }

      // Type check (only if parse passed)
      if (typeCheck && cwd && contractChecks[0]!.pass) {
        contractChecks.push(await checkTypeCheck(cwd, root))
      }

      // SensorFactory contract check (if expected)
      if (expectedTypes.includes('SensorFactory')) {
        contractChecks.push(checkSensorContract(allSource))
      }

      // GoalFactory contract check (if expected)
      if (expectedTypes.includes('GoalFactory')) {
        contractChecks.push(checkGoalContract(allSource))
      }

      // === Dimension 2: Behavioral Correctness (process) ===
      const behavioralChecks: GradeCheck[] = []

      // Only check BP patterns if goals are expected
      if (expectedTypes.includes('GoalFactory')) {
        behavioralChecks.push(checkBThread(allSource))
        behavioralChecks.push(checkBSync(allSource))
        behavioralChecks.push(checkRepeat(allSource))
        behavioralChecks.push(checkWaitFor(allSource))
        behavioralChecks.push(checkSensorDeltaHandling(allSource))
      }

      // AbortSignal check if sensors are expected
      if (expectedTypes.includes('SensorFactory')) {
        behavioralChecks.push(checkAbortSignal(allSource))
      }

      // === Dimension 3: Integration (efficiency) ===
      const integrationChecks: GradeCheck[] = []

      integrationChecks.push(checkImports(allSource))

      // Task wiring check if goals are expected
      if (expectedTypes.includes('GoalFactory')) {
        integrationChecks.push(checkTaskWiring(allSource))
      }

      // === eval_ref keyword matching ===
      const intentionResults = gradeEvalItems(allSource, evalRef?.intention ?? [])
      const staticResults = gradeEvalItems(allSource, evalRef?.static ?? [])
      const dynamicResults = gradeEvalItems(allSource, evalRef?.dynamic ?? [])

      return scoreProactive(contractChecks, behavioralChecks, integrationChecks, {
        intention: intentionResults,
        static: staticResults,
        dynamic: dynamicResults,
      })
    } finally {
      if (useTempDir) {
        Bun.$`rm -rf ${workDir}`.quiet().nothrow()
      }
    }
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
 * Uses keyword matching for eval_ref grading (no LLM judge).
 *
 * @public
 */
export const grade: Grader = createProactiveGrader()
