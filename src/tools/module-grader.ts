/**
 * Three-dimension grader for evaluating generated modnet modules.
 *
 * @remarks
 * Adapted from MiniAppBench methodology. Evaluates generated modules across
 * three dimensions mapped to `GradingDimensions`:
 *
 * - **outcome** (Intention): Does the module fulfill eval_ref.intention items?
 *   Uses LLM-as-judge if provided, otherwise keyword matching.
 * - **process** (Static): Package structure, types, SKILL.md, modnet field.
 *   Fully automated checks.
 * - **efficiency** (Dynamic): Event handlers, state management, UI rendering.
 *   Code analysis fallback when Playwright is unavailable.
 *
 * Scoring: intention (0-1) × static (0-1) × dynamic (0-1) → composite score.
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
 * Judge function for LLM-as-judge intention grading.
 *
 * @remarks
 * Receives the generated code and a checklist item, returns whether
 * the code fulfills that intention.
 *
 * @public
 */
export type IntentionJudge = (params: {
  code: string
  intentionItem: string
  context?: string
}) => Promise<{ pass: boolean; reasoning?: string }>

/**
 * Configuration for the module grader.
 *
 * @public
 */
export type ModuleGraderConfig = {
  /** LLM-as-judge function for intention grading (falls back to keyword matching) */
  judge?: IntentionJudge
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

const MssSchema = z.object({
  contentType: z.string(),
  structure: z.string(),
  mechanics: z.array(z.string()).optional(),
  boundary: z.enum(['all', 'none', 'ask', 'paid']),
  scale: z.number(),
})

/**
 * Metadata schema for module generation prompt cases.
 *
 * @public
 */
export const ModulePromptMetadataSchema = z.object({
  domain: z.string().optional(),
  subclass: z.string().optional(),
  difficulty: z.enum(['Easy', 'Medium', 'Hard']).optional(),
  eval_ref: EvalRefSchema.optional(),
  mss: MssSchema.optional(),
  dependencies: z.array(z.string()).optional(),
})

/** Inferred type for {@link ModulePromptMetadataSchema}. */
export type ModulePromptMetadata = z.infer<typeof ModulePromptMetadataSchema>

// ============================================================================
// Static Checks (Process Dimension)
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
 * @remarks
 * Concatenated source fails to parse due to duplicate exports/imports.
 * This checks each file independently and reports aggregate results.
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
 * Check: Type check via tsc --noEmit in a temp directory.
 *
 * @internal
 */
const checkTypeCheck = async (cwd: string, projectRoot: string): Promise<GradeCheck> => {
  // Skip tsc for isolated workspaces without installed dependencies —
  // tsc can't resolve external imports (e.g., 'plaited') without node_modules.
  // Parse check (Bun.Transpiler) already validates syntax.
  const hasNodeModules =
    (await Bun.file(join(cwd, 'node_modules')).exists()) || (await Bun.file(join(projectRoot, 'node_modules')).exists())
  if (!hasNodeModules) {
    return { name: 'typeCheck', pass: true }
  }

  const tsconfigPath = join(cwd, 'tsconfig.json')
  const tsconfigExists = await Bun.file(tsconfigPath).exists()

  if (!tsconfigExists) {
    // Create a minimal tsconfig for checking
    await Bun.write(
      tsconfigPath,
      JSON.stringify({
        compilerOptions: {
          target: 'ESNext',
          module: 'ESNext',
          moduleResolution: 'bundler',
          strict: true,
          noEmit: true,
          skipLibCheck: true,
          allowImportingTsExtensions: true,
        },
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
 * Check: package.json has modnet field with correct MSS tags.
 *
 * @internal
 */
const checkModnetField = async (cwd: string, expectedMss?: z.infer<typeof MssSchema>): Promise<GradeCheck> => {
  const pkgPath = join(cwd, 'package.json')
  const exists = await Bun.file(pkgPath).exists()
  if (!exists) {
    return { name: 'modnetField', pass: false, error: 'package.json not found' }
  }

  try {
    const pkg = await Bun.file(pkgPath).json()
    if (!pkg.modnet) {
      return { name: 'modnetField', pass: false, error: 'missing modnet field in package.json' }
    }

    const parsed = MssSchema.safeParse(pkg.modnet)
    if (!parsed.success) {
      return {
        name: 'modnetField',
        pass: false,
        error: `invalid modnet field: ${parsed.error.issues.map((i) => i.message).join(', ')}`,
      }
    }

    // If expected MSS provided, check key fields match
    if (expectedMss) {
      const mismatches: string[] = []
      if (parsed.data.contentType !== expectedMss.contentType) {
        mismatches.push(`contentType: got ${parsed.data.contentType}, expected ${expectedMss.contentType}`)
      }
      if (parsed.data.structure !== expectedMss.structure) {
        mismatches.push(`structure: got ${parsed.data.structure}, expected ${expectedMss.structure}`)
      }
      if (parsed.data.boundary !== expectedMss.boundary) {
        mismatches.push(`boundary: got ${parsed.data.boundary}, expected ${expectedMss.boundary}`)
      }
      if (mismatches.length > 0) {
        return { name: 'modnetField', pass: false, error: mismatches.join('; ') }
      }
    }

    return { name: 'modnetField', pass: true }
  } catch (e) {
    return {
      name: 'modnetField',
      pass: false,
      error: e instanceof Error ? e.message : String(e),
    }
  }
}

/**
 * Check: SKILL.md exists with required frontmatter.
 *
 * @internal
 */
const checkSkillMd = async (cwd: string): Promise<GradeCheck> => {
  // Look for SKILL.md in skills/*/ subdirectories
  const result = Bun.spawnSync(['find', cwd, '-name', 'SKILL.md', '-maxdepth', '3'], {
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const files = result.stdout.toString().trim().split('\n').filter(Boolean)

  if (files.length === 0) {
    return { name: 'skillMd', pass: false, error: 'no SKILL.md found' }
  }

  // Check first SKILL.md has frontmatter with name and description
  const content = await Bun.file(files[0]!).text()
  const hasFrontmatter = content.startsWith('---')
  if (!hasFrontmatter) {
    return { name: 'skillMd', pass: false, error: 'SKILL.md missing frontmatter' }
  }

  const frontmatterEnd = content.indexOf('---', 3)
  if (frontmatterEnd === -1) {
    return { name: 'skillMd', pass: false, error: 'SKILL.md frontmatter not closed' }
  }

  const frontmatter = content.slice(3, frontmatterEnd)
  const hasName = /^name:/m.test(frontmatter)
  const hasDescription = /^description:/m.test(frontmatter)

  if (!hasName || !hasDescription) {
    const missing = [!hasName && 'name', !hasDescription && 'description'].filter(Boolean)
    return { name: 'skillMd', pass: false, error: `SKILL.md missing: ${missing.join(', ')}` }
  }

  return { name: 'skillMd', pass: true }
}

/**
 * Check: Expected dependencies are in package.json.
 *
 * @internal
 */
const checkDependencies = async (cwd: string, expectedDeps: string[]): Promise<GradeCheck> => {
  if (expectedDeps.length === 0) {
    return { name: 'dependencies', pass: true }
  }

  const pkgPath = join(cwd, 'package.json')
  const exists = await Bun.file(pkgPath).exists()
  if (!exists) {
    return { name: 'dependencies', pass: false, error: 'package.json not found' }
  }

  const pkg = await Bun.file(pkgPath).json()
  const allDeps = { ...pkg.dependencies, ...pkg.devDependencies }
  const missing = expectedDeps.filter((dep) => !(dep in allDeps))

  if (missing.length > 0) {
    return { name: 'dependencies', pass: false, error: `missing: ${missing.join(', ')}` }
  }

  return { name: 'dependencies', pass: true }
}

// ============================================================================
// Intention Checks (Outcome Dimension)
// ============================================================================

/**
 * Grade intention items against generated code using LLM judge or keyword matching.
 *
 * @internal
 */
const gradeIntention = async (
  code: string,
  items: string[],
  judge?: IntentionJudge,
): Promise<{ score: number; results: Array<{ item: string; pass: boolean; reasoning?: string }> }> => {
  if (items.length === 0) return { score: 1, results: [] }

  const results: Array<{ item: string; pass: boolean; reasoning?: string }> = []

  for (const item of items) {
    if (judge) {
      const result = await judge({ code, intentionItem: item })
      results.push({ item, ...result })
    } else {
      // Keyword matching fallback: extract key terms and check presence
      const pass = matchIntentionKeywords(code, item)
      results.push({ item, pass, reasoning: 'keyword match' })
    }
  }

  const passCount = results.filter((r) => r.pass).length
  return { score: passCount / items.length, results }
}

/**
 * Simple keyword matching for intention items when no LLM judge is available.
 *
 * @internal
 */
const matchIntentionKeywords = (code: string, item: string): boolean => {
  const lower = code.toLowerCase()
  // Extract meaningful terms (3+ chars, not common words)
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
  const terms = item
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !stopWords.has(t))

  if (terms.length === 0) return true

  // Stem-aware matching: check if the code contains the term or its stem
  const matched = terms.filter((term) => {
    // Direct match
    if (lower.includes(term)) return true
    // Stem match: strip common suffixes and check
    const stem = term.replace(/(s|es|ed|ing|tion|ment|ness|able|ible)$/, '')
    if (stem.length >= 3 && lower.includes(stem)) return true
    // Also check if any word in code starts with the stem
    return stem.length >= 4 && lower.includes(stem)
  })
  return matched.length / terms.length >= 0.5
}

// ============================================================================
// Dynamic Checks (Efficiency Dimension)
// ============================================================================

/**
 * Analyze code for dynamic behavior indicators.
 *
 * @remarks
 * Checks for event handlers, state management patterns, and UI rendering
 * code. Falls back to code analysis when Playwright is unavailable.
 *
 * @internal
 */
const gradeDynamic = async (
  code: string,
  items: string[],
): Promise<{ score: number; results: Array<{ item: string; pass: boolean }> }> => {
  if (items.length === 0) return { score: 1, results: [] }

  const results: Array<{ item: string; pass: boolean }> = []

  for (const item of items) {
    const pass = matchDynamicIndicator(code, item)
    results.push({ item, pass })
  }

  const passCount = results.filter((r) => r.pass).length
  return { score: passCount / items.length, results }
}

/**
 * Check if code contains indicators that a dynamic behavior is implemented.
 *
 * @internal
 */
const matchDynamicIndicator = (code: string, item: string): boolean => {
  const lower = code.toLowerCase()
  const itemLower = item.toLowerCase()

  // Map common dynamic behaviors to code patterns
  const patterns: Array<{ keywords: string[]; codeIndicators: string[] }> = [
    {
      keywords: ['form', 'input', 'validates', 'accepts'],
      codeIndicators: [
        '<form',
        '<input',
        'onsubmit',
        'onchange',
        'oninput',
        'handlesubmit',
        'formdata',
        'addeventlistener',
      ],
    },
    {
      keywords: ['click', 'button', 'toggle', 'opens'],
      codeIndicators: ['onclick', 'click', 'addeventlistener', 'handleclick', '<button'],
    },
    {
      keywords: ['renders', 'displays', 'shows', 'appears'],
      codeIndicators: ['innerhtml', 'textcontent', 'appendchild', 'createelement', 'render', 'template', 'html`'],
    },
    {
      keywords: ['updates', 'changes', 'transitions'],
      codeIndicators: ['setstate', 'state', 'update', 'mutation', 'signal', 'store', 'reactive'],
    },
    {
      keywords: ['filter', 'search', 'narrows'],
      codeIndicators: ['filter(', '.filter', 'search', 'query', 'match'],
    },
    {
      keywords: ['sort', 'order', 'reorder'],
      codeIndicators: ['sort(', '.sort', 'comparefn', 'sortby', 'order'],
    },
    {
      keywords: ['chart', 'plot', 'graph', 'visualization'],
      codeIndicators: [
        '<svg',
        '<canvas',
        'bindingcontext',
        'binddata',
        'bindgroup',
        'bindnode',
        'bindattr',
        'bindprop',
        'bindtext',
      ],
    },
    {
      keywords: ['download', 'export', 'save'],
      codeIndicators: ['download', 'blob', 'todataurl', 'createobjecturl', 'filesaver', 'bun.write'],
    },
    {
      keywords: ['drag', 'reorder', 'move'],
      codeIndicators: ['draggable', 'ondragstart', 'ondragover', 'ondrop', 'dragend'],
    },
    {
      keywords: ['persist', 'load', 'store'],
      codeIndicators: ['localstorage', 'bun.write', 'bun.file', 'readfile', 'writefile', 'jsonl', 'data/'],
    },
    {
      keywords: ['oscillates', 'oscillat', 'frequency', 'pendulum', 'harmonic', 'parabolic', 'trajectory'],
      codeIndicators: [
        'math.cos',
        'math.sin',
        'math.sqrt',
        'requestanimationframe',
        'omega',
        'oscillat',
        'frequency',
        'freq',
        'angular',
        'pendulum',
        'trajectory',
      ],
    },
  ]

  // Check if any pattern group matches both the item and the code
  for (const { keywords, codeIndicators } of patterns) {
    const itemMatches = keywords.some((kw) => itemLower.includes(kw))
    if (itemMatches) {
      const codeMatches = codeIndicators.some((ci) => lower.includes(ci))
      if (codeMatches) return true
    }
  }

  // Fallback: extract key terms from the item and check code
  return matchIntentionKeywords(code, item)
}

// ============================================================================
// File Collection
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
const scoreModule = (
  intentionScore: number,
  staticChecks: GradeCheck[],
  dynamicScore: number,
  details: {
    intentionResults: Array<{ item: string; pass: boolean; reasoning?: string }>
    dynamicResults: Array<{ item: string; pass: boolean }>
  },
): GraderResult => {
  // Static: weighted — parse and typeCheck are foundational (2x)
  const weights: Record<string, number> = {
    parse: 2,
    typeCheck: 2,
    modnetField: 1,
    skillMd: 1,
    dependencies: 1,
  }
  let weightedSum = 0
  let weightTotal = 0
  for (const check of staticChecks) {
    const w = weights[check.name] ?? 1
    weightedSum += check.pass ? w : 0
    weightTotal += w
  }
  const staticScore = weightTotal > 0 ? weightedSum / weightTotal : 0

  // Composite: geometric mean of three dimensions (penalizes any zero dimension)
  const composite = Math.cbrt(intentionScore * staticScore * dynamicScore)
  const pass = composite >= 0.5

  // Reasoning summary
  const staticSummary = staticChecks
    .map((c) => `${c.name}: ${c.pass ? 'PASS' : 'FAIL'}${c.error ? ` (${c.error.slice(0, 80)})` : ''}`)
    .join('; ')

  const intentionSummary = `intention: ${details.intentionResults.filter((r) => r.pass).length}/${details.intentionResults.length} items`
  const dynamicSummary = `dynamic: ${details.dynamicResults.filter((r) => r.pass).length}/${details.dynamicResults.length} items`

  return {
    pass,
    score: composite,
    reasoning: `${intentionSummary}; ${staticSummary}; ${dynamicSummary}`,
    outcome: {
      intention: {
        score: intentionScore,
        results: details.intentionResults,
      },
      static: {
        score: staticScore,
        checks: staticChecks.map((c) => ({
          name: c.name,
          pass: c.pass,
          ...(c.error && { error: c.error }),
        })),
      },
      dynamic: {
        score: dynamicScore,
        results: details.dynamicResults,
      },
    },
    dimensions: {
      outcome: intentionScore,
      process: staticScore,
      efficiency: dynamicScore,
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
 * Create a module generation grader with configurable checks.
 *
 * @remarks
 * Three-dimension grading adapted from MiniAppBench:
 *
 * 1. **Intention** (outcome): LLM-as-judge checks `eval_ref.intention` items
 *    against generated code. Falls back to keyword matching if no judge provided.
 *
 * 2. **Static** (process): Automated checks — parse validity, tsc, package.json
 *    modnet field, SKILL.md presence, dependency verification.
 *
 * 3. **Dynamic** (efficiency): Code analysis for event handlers, state management,
 *    and UI rendering patterns matching `eval_ref.dynamic` items.
 *
 * Composite score uses geometric mean: cbrt(intention × static × dynamic).
 *
 * @param config - Grader configuration
 * @returns Grader function compatible with the trial runner
 *
 * @public
 */
export const createModuleGrader = (config?: ModuleGraderConfig): Grader => {
  const { judge, typeCheck = true, projectRoot } = config ?? {}
  const root = projectRoot ?? findProjectRoot()

  return async ({ output, metadata, cwd }) => {
    const meta = ModulePromptMetadataSchema.safeParse(metadata ?? {})
    const evalRef = meta.success ? meta.data.eval_ref : undefined
    const expectedMss = meta.success ? meta.data.mss : undefined
    const expectedDeps = meta.success ? (meta.data.dependencies ?? []) : []

    // Determine working directory — prefer cwd from trial runner (workspace isolation)
    const workDir = cwd ?? join(root, `src/.module-grader-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)
    const useTempDir = !cwd

    try {
      if (useTempDir) {
        await Bun.$`mkdir -p ${workDir}`.quiet()
        await Bun.write(join(workDir, 'module.ts'), output)
      }

      // Collect all source code for analysis
      const allSource = cwd ? await collectSource(cwd) : output

      // === Dimension 1: Intention (outcome) ===
      const { score: intentionScore, results: intentionResults } = await gradeIntention(
        allSource,
        evalRef?.intention ?? [],
        judge,
      )

      // === Dimension 2: Static (process) ===
      const staticChecks: GradeCheck[] = []

      // Parse check — per-file when workspace is available (concatenated source
      // fails due to duplicate exports), fallback to raw output otherwise
      if (cwd) {
        staticChecks.push(await checkParseFiles(cwd))
      } else {
        staticChecks.push(output ? checkParse(output) : { name: 'parse', pass: false, error: 'no source found' })
      }

      // Type check (skip if parse failed)
      if (typeCheck && cwd && staticChecks[0]!.pass) {
        staticChecks.push(await checkTypeCheck(cwd, root))
      }

      // Modnet field check
      if (cwd) {
        staticChecks.push(await checkModnetField(cwd, expectedMss))
      }

      // SKILL.md check
      if (cwd) {
        staticChecks.push(await checkSkillMd(cwd))
      }

      // Dependencies check
      if (cwd && expectedDeps.length > 0) {
        staticChecks.push(await checkDependencies(cwd, expectedDeps))
      }

      // === Dimension 3: Dynamic (efficiency) ===
      const { score: dynamicScore, results: dynamicResults } = await gradeDynamic(allSource, evalRef?.dynamic ?? [])

      return scoreModule(intentionScore, staticChecks, dynamicScore, {
        intentionResults,
        dynamicResults,
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
 * Uses keyword matching for intention grading (no LLM judge).
 *
 * @public
 */
export const grade: Grader = createModuleGrader()
