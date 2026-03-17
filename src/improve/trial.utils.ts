/**
 * Shared utilities for the trial runner.
 *
 * @remarks
 * Consolidates loading, output, worker pool, workspace, and trajectory
 * utilities. Ported from `eval/core/` and `eval/schemas/grader-loader.ts`.
 *
 * @packageDocumentation
 */

import { mkdir, rm } from 'node:fs/promises'
import type { Adapter, Grader, GraderResult, PromptCase, TrajectoryRichness, TrialResult } from './trial.schemas.ts'
import { AdapterResultSchema, GraderResultSchema, PromptCaseSchema, type TrajectoryStep } from './trial.schemas.ts'

// ============================================================================
// Path Resolution
// ============================================================================

/**
 * Resolve path relative to process.cwd().
 *
 * @remarks
 * Absolute paths (starting with /) are returned as-is.
 *
 * @public
 */
export const resolvePath = (path: string): string => {
  if (path.startsWith('/')) return path
  return `${process.cwd()}/${path}`
}

// ============================================================================
// Polyglot Loader (adapters + graders)
// ============================================================================

/** File extensions imported as ES modules */
const JS_EXTENSIONS = ['.ts', '.js', '.mjs', '.cjs']

/** Check if a file path is a JavaScript/TypeScript module */
const isJsModule = (path: string): boolean => JS_EXTENSIONS.some((ext) => path.endsWith(ext))

/**
 * Create an executable wrapper that spawns a subprocess.
 *
 * @remarks
 * Sends JSON on stdin, reads JSON from stdout. Validates output with
 * the provided schema. Non-zero exit codes are treated as errors.
 *
 * @internal
 */
const createExecWrapper = <TInput, TOutput>(
  execPath: string,
  outputSchema: { safeParse: (data: unknown) => { success: boolean; data?: TOutput; error?: { message: string } } },
): ((input: TInput) => Promise<TOutput>) => {
  return async (input: TInput): Promise<TOutput> => {
    const inputJson = JSON.stringify(input)

    const proc = Bun.spawn([execPath], {
      stdin: new TextEncoder().encode(inputJson),
      stdout: 'pipe',
      stderr: 'pipe',
    })

    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ])

    if (exitCode !== 0) {
      throw new Error(`Process exited with code ${exitCode}: ${stderr.trim() || 'No error output'}`)
    }

    const trimmed = stdout.trim()
    if (!trimmed) {
      throw new Error('Process produced no output')
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(trimmed)
    } catch {
      throw new Error(`Output is not valid JSON: ${trimmed.slice(0, 100)}`)
    }

    const result = outputSchema.safeParse(parsed)
    if (!result.success) {
      throw new Error(`Invalid output: ${result.error?.message}`)
    }

    return result.data as TOutput
  }
}

/**
 * Load a polyglot module — TS/JS modules or executable scripts.
 *
 * @remarks
 * Detection logic:
 * - `.ts`, `.js`, `.mjs`, `.cjs` → Import as ES module, extract named export
 * - Everything else → Execute as subprocess with stdin/stdout JSON protocol
 *
 * @param path - Path to the module or executable (relative or absolute)
 * @param exportName - Name of the function export to extract from TS/JS modules
 * @param outputSchema - Zod schema for validating executable output
 * @returns Loaded function
 *
 * @public
 */
export const loadPolyglot = async <TFn>(
  path: string,
  exportName: string,
  outputSchema: { safeParse: (data: unknown) => { success: boolean; data?: unknown; error?: { message: string } } },
): Promise<TFn> => {
  const resolved = resolvePath(path)

  const file = Bun.file(resolved)
  if (!(await file.exists())) {
    throw new Error(`File not found: ${resolved}`)
  }

  if (isJsModule(resolved)) {
    const mod = await import(resolved)
    if (typeof mod[exportName] !== 'function') {
      throw new Error(`Module must export a '${exportName}' function`)
    }
    return mod[exportName] as TFn
  }

  // Executable: wrap as stdin/stdout JSON protocol
  return createExecWrapper(resolved, outputSchema) as TFn
}

/**
 * Load an adapter from a file path.
 *
 * @public
 */
export const loadAdapter = (path: string): Promise<Adapter> => loadPolyglot<Adapter>(path, 'adapt', AdapterResultSchema)

/**
 * Load a grader from a file path.
 *
 * @public
 */
export const loadGrader = (path: string): Promise<Grader> => loadPolyglot<Grader>(path, 'grade', GraderResultSchema)

// ============================================================================
// JSONL Loading
// ============================================================================

const parseJsonlLines = <T>(
  content: string,
  errorPrefix: string,
  parseLine: (value: unknown) => T = (value) => value as T,
): T[] =>
  content
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line, index) => {
      try {
        return parseLine(JSON.parse(line))
      } catch (error) {
        throw new Error(`${errorPrefix} at line ${index + 1}: ${error instanceof Error ? error.message : error}`)
      }
    })

/**
 * Load raw JSONL file as parsed JSON objects.
 *
 * @public
 */
export const loadJsonl = async <T = unknown>(path: string): Promise<T[]> => {
  return parseJsonlLines<T>(await Bun.file(path).text(), 'Invalid JSON')
}

/**
 * Load prompts from a JSONL file with schema validation.
 *
 * @public
 */
export const loadPrompts = async (path: string): Promise<PromptCase[]> => {
  return parseJsonlLines<PromptCase>(await Bun.file(path).text(), 'Invalid prompt', (value) => PromptCaseSchema.parse(value))
}

/**
 * Read prompts from stdin as JSONL.
 *
 * @returns Parsed prompt cases, or null if stdin is a TTY
 *
 * @public
 */
export const readStdinPrompts = async (): Promise<PromptCase[] | null> => {
  if (process.stdin.isTTY) {
    return null
  }

  const content = (await Bun.stdin.text()).trim()
  if (!content) return null

  return parseJsonlLines<PromptCase>(content, 'Invalid stdin prompt', (value) => PromptCaseSchema.parse(value))
}

// ============================================================================
// Output Utilities
// ============================================================================

/**
 * Write output line to stdout or file.
 *
 * @public
 */
export const writeOutput = async (line: string, outputPath?: string, append?: boolean): Promise<void> => {
  if (outputPath) {
    if (append) {
      const file = Bun.file(outputPath)
      const existing = (await file.exists()) ? await file.text() : ''
      await Bun.write(outputPath, `${existing}${line}\n`)
    } else {
      await Bun.write(outputPath, `${line}\n`)
    }
  } else {
    // biome-ignore lint/suspicious/noConsole: CLI stdout output
    console.log(line)
  }
}

/**
 * Log progress message to stderr.
 *
 * @public
 */
export const logProgress = (message: string, showProgress: boolean): void => {
  if (showProgress) {
    console.error(message)
  }
}

/**
 * Get preview text for input (handles string or array).
 *
 * @public
 */
// ============================================================================
// Worker Pool
// ============================================================================

/** Progress callback for worker pool */
export type ProgressCallback<T> = (completed: number, total: number, result?: T, error?: Error) => void

/** Worker pool options */
export type WorkerPoolOptions<T> = {
  concurrency: number
  onProgress?: ProgressCallback<T>
}

/** Worker pool result */
export type WorkerPoolResult<T> = {
  results: T[]
  errors: Array<{ index: number; error: Error }>
}

/**
 * Execute tasks in parallel with concurrency limit.
 *
 * @remarks
 * Semaphore-style work distribution. Results collected in completion order.
 *
 * @public
 */
export const runWorkerPool = async <TItem, TResult>(
  items: TItem[],
  worker: (item: TItem, index: number) => Promise<TResult>,
  options: WorkerPoolOptions<TResult>,
): Promise<WorkerPoolResult<TResult>> => {
  const { concurrency, onProgress } = options
  const results: TResult[] = []
  const errors: Array<{ index: number; error: Error }> = []

  if (concurrency === 1) {
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (item === undefined) continue

      try {
        const result = await worker(item, i)
        results.push(result)
        onProgress?.(results.length + errors.length, items.length, result)
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err))
        errors.push({ index: i, error })
        onProgress?.(results.length + errors.length, items.length, undefined, error)
      }
    }
    return { results, errors }
  }

  let nextIndex = 0
  let completed = 0
  const mutex = { lock: Promise.resolve() }

  const getNextItem = (): { item: TItem; index: number } | undefined => {
    while (nextIndex < items.length) {
      const index = nextIndex++
      const item = items[index]
      if (item !== undefined) {
        return { item, index }
      }
    }
    return undefined
  }

  const runSingleWorker = async (): Promise<void> => {
    let work = getNextItem()
    while (work) {
      const { item, index } = work
      try {
        const result = await worker(item, index)
        await new Promise<void>((resolve) => {
          mutex.lock = mutex.lock.then(() => {
            results.push(result)
            completed++
            onProgress?.(completed, items.length, result)
            resolve()
          })
        })
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err))
        await new Promise<void>((resolve) => {
          mutex.lock = mutex.lock.then(() => {
            errors.push({ index, error })
            completed++
            onProgress?.(completed, items.length, undefined, error)
            resolve()
          })
        })
      }
      work = getNextItem()
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => runSingleWorker())
  await Promise.all(workers)

  return { results, errors }
}

// ============================================================================
// Write Mutex
// ============================================================================

/** Mutex for coordinated file writes */
export type WriteMutex = {
  write: (fn: () => Promise<void>) => Promise<void>
}

/**
 * Create a write mutex for coordinated JSONL output.
 *
 * @public
 */
export const createWriteMutex = (): WriteMutex => {
  let chain = Promise.resolve()
  return {
    write: (fn: () => Promise<void>): Promise<void> => {
      chain = chain.then(fn, fn)
      return chain
    },
  }
}

// ============================================================================
// Workspace Directory
// ============================================================================

/**
 * Create an isolated workspace directory for a prompt.
 *
 * @public
 */
export const createWorkspaceDir = async (baseDir: string, promptId: string): Promise<string> => {
  const sanitizedId = promptId.replace(/[<>:"/\\|?*]/g, '_')
  const workspaceDir = `${baseDir}/prompt-${sanitizedId}`
  // Clear any leftover files from previous runs to prevent workspace contamination
  await rm(workspaceDir, { recursive: true, force: true })
  await mkdir(workspaceDir, { recursive: true })
  return workspaceDir
}

// ============================================================================
// Trajectory Analysis
// ============================================================================

/**
 * Check if any tool calls failed in trajectory.
 *
 * @public
 */
export const hasToolErrors = (trajectory: TrajectoryStep[]): boolean =>
  trajectory.some((step) => step.type === 'tool_call' && step.status === 'failed')

/**
 * Detect trajectory richness level.
 *
 * @remarks
 * Single-pass with early exit:
 * - `full`: Has thoughts, tool calls, or plans
 * - `messages-only`: Only message steps
 * - `minimal`: Empty or no recognized content
 *
 * @public
 */
export const detectRichness = (trajectory: TrajectoryStep[]): TrajectoryRichness => {
  let hasMessages = false

  for (const step of trajectory) {
    if (step.type === 'thought' || step.type === 'tool_call' || step.type === 'plan' || step.type === 'decision') {
      return 'full'
    }
    if (step.type === 'message') {
      hasMessages = true
    }
  }

  return hasMessages ? 'messages-only' : 'minimal'
}

// ============================================================================
// Meta-Verification
// ============================================================================

/** Meta-verification result from a verifier function */
export type MetaVerification = {
  confidence: number
  reasoning?: string
}

/** Verifier function that scores a grader's output */
export type Verifier = (result: GraderResult) => Promise<MetaVerification>

/**
 * Wrap a grader with meta-verification.
 *
 * @remarks
 * The verifier scores the grader's own output, producing a confidence
 * signal and optional reasoning. The result is stored in
 * `outcome._metaVerification` on the grader result, allowing downstream
 * consumers to filter or weight results by grader confidence.
 *
 * This catches hallucinated scores, inconsistent reasoning, and
 * grader failures before they corrupt training signal.
 *
 * @param grader - The grader function to wrap
 * @param verifier - Function that evaluates the grader's output
 * @returns Wrapped grader that includes meta-verification in outcome
 *
 * @public
 */
export const withMetaVerification = (grader: Grader, verifier: Verifier): Grader => {
  return async (params) => {
    const result = await grader(params)
    const verification = await verifier(result)
    return {
      ...result,
      outcome: {
        ...result.outcome,
        _metaVerification: verification,
      },
    }
  }
}

// ============================================================================
// Eval Result Persistence
// ============================================================================

/**
 * Persist trial results to the hypergraph memory as JSONL.
 *
 * @remarks
 * Writes `TrialResult[]` as JSONL to `.memory/evals/trial-{timestamp}.jsonl`,
 * and returns its path for callers that want to stage or process it later.
 * Results become queryable via the
 * hypergraph's text layer (`grep -rl`) and structural layer.
 *
 * Only grading results are persisted — generated code artifacts are ephemeral.
 *
 * @param results - Trial results to persist
 * @param memoryPath - Path to the `.memory/` directory
 *
 * @public
 */
export const persistTrialResults = async (
  results: TrialResult[],
  memoryPath: string,
): Promise<{ path: string; timestamp: string }> => {
  const { join } = await import('node:path')
  const evalDir = join(memoryPath, 'evals')
  await mkdir(evalDir, { recursive: true })

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const filePath = join(evalDir, `trial-${timestamp}.jsonl`)
  const content = `${results.map((r) => JSON.stringify(r)).join('\n')}\n`
  await Bun.write(filePath, content)

  return { path: filePath, timestamp }
}
