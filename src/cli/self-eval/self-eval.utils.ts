/**
 * Shared utilities for the trial runner.
 *
 * @remarks
 * Consolidates loading, output, worker pool, workspace, and process-trace
 * utilities. Ported from `self-eval/core/` and `self-eval/schemas/grader-loader.ts`.
 *
 * @packageDocumentation
 */

import { mkdir, rm } from 'node:fs/promises'
import { SNAPSHOT_MESSAGE_KINDS } from '../../behavioral/behavioral.constants.ts'
import type { SnapshotMessage } from '../../behavioral/behavioral.schemas.ts'
import type {
  Adapter,
  Grader,
  GraderResult,
  MetaVerification,
  PlaitedTrace,
  ProcessTraceCoverage,
  PromptCase,
  TrialProcessSummary,
  TrialResult,
} from './self-eval.schemas.ts'
import {
  AdapterResultSchema,
  GraderResultSchema,
  MetaVerificationSchema,
  PromptCaseSchema,
} from './self-eval.schemas.ts'
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

/**
 * Load a verifier from a file path.
 *
 * @public
 */
export const loadVerifier = (path: string): Promise<Verifier> =>
  loadPolyglot<Verifier>(path, 'verify', MetaVerificationSchema)

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
  return parseJsonlLines<PromptCase>(await Bun.file(path).text(), 'Invalid prompt', (value) =>
    PromptCaseSchema.parse(value),
  )
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
// Snapshot Process Analysis
// ============================================================================

/**
 * Detect runtime errors from snapshot/runtime evidence plus runner state.
 *
 * @public
 */
export const hasRuntimeErrors = ({
  trace,
  runnerError,
  timedOut,
}: {
  trace?: PlaitedTrace
  runnerError?: string
  timedOut?: boolean
}): boolean => {
  const runtimeOutputErrorCount = countRuntimeOutputErrors(trace)
  const runtimeSnapshotErrorCount = countSnapshotKind(trace, SNAPSHOT_MESSAGE_KINDS.runtime_error)
  return Boolean(runnerError) || Boolean(timedOut) || runtimeOutputErrorCount > 0 || runtimeSnapshotErrorCount > 0
}

/**
 * Detect feedback handler errors from snapshot trace.
 *
 * @public
 */
export const hasFeedbackErrors = (trace?: PlaitedTrace): boolean =>
  countSnapshotKind(trace, SNAPSHOT_MESSAGE_KINDS.feedback_error) > 0

/**
 * Detect deadlocks from snapshot trace.
 *
 * @public
 */
export const hasDeadlocks = (trace?: PlaitedTrace): boolean =>
  countSnapshotKind(trace, SNAPSHOT_MESSAGE_KINDS.deadlock) > 0

/**
 * Count selected events in trace.
 *
 * @remarks
 * Prefers explicit `selectedEvents` rows when present and falls back to
 * selected bids in selection snapshots.
 *
 * @public
 */
export const countSelectedEvents = (trace?: PlaitedTrace): number => {
  const explicitCount = trace?.selectedEvents?.length ?? 0
  if (explicitCount > 0) {
    return explicitCount
  }
  return getSelectionSnapshots(trace).reduce(
    (total, snapshot) => total + snapshot.bids.filter((bid) => bid.selected).length,
    0,
  )
}

/**
 * Detect process-trace coverage level.
 *
 * @public
 */
export const detectTraceCoverage = (trace?: PlaitedTrace): ProcessTraceCoverage => {
  const snapshotCount = trace?.snapshots?.length ?? 0
  const adjacentEventCount = (trace?.selectedEvents?.length ?? 0) + (trace?.emittedEvents?.length ?? 0)
  const runtimeOutputCount = trace?.runtimeOutputs?.length ?? 0
  const adjacentEvidenceCount = adjacentEventCount + runtimeOutputCount

  if (snapshotCount === 0 && adjacentEvidenceCount === 0) {
    return 'none'
  }
  if (snapshotCount > 0 && adjacentEvidenceCount === 0) {
    return 'snapshots-only'
  }
  if (snapshotCount === 0 && adjacentEvidenceCount > 0) {
    return 'events-only'
  }
  return 'snapshots-and-events'
}

/**
 * Analyze repetition/loop patterns in selected events.
 *
 * @public
 */
export const analyzeSelectionPatterns = (
  trace?: PlaitedTrace,
): Pick<TrialProcessSummary, 'repeatedSelectionCount' | 'maxConsecutiveSelectionTypeCount'> => {
  const selectedTypes = getSelectedEventTypes(trace)
  if (selectedTypes.length === 0) {
    return {
      repeatedSelectionCount: 0,
      maxConsecutiveSelectionTypeCount: 0,
    }
  }

  let previousType: string | undefined
  let repeatedSelectionCount = 0
  let currentConsecutiveCount = 0
  let maxConsecutiveSelectionTypeCount = 0

  for (const selectedType of selectedTypes) {
    if (selectedType === previousType) {
      currentConsecutiveCount += 1
      repeatedSelectionCount += 1
    } else {
      previousType = selectedType
      currentConsecutiveCount = 1
    }
    if (currentConsecutiveCount > maxConsecutiveSelectionTypeCount) {
      maxConsecutiveSelectionTypeCount = currentConsecutiveCount
    }
  }

  return {
    repeatedSelectionCount,
    maxConsecutiveSelectionTypeCount,
  }
}

/**
 * Count bids carrying blocker attribution.
 *
 * @public
 */
export const countBlockedBids = (trace?: PlaitedTrace): number =>
  getSnapshotsWithBids(trace).reduce(
    (total, snapshot) => total + snapshot.bids.filter((bid) => bid.blockedBy).length,
    0,
  )

/**
 * Count bids carrying interrupter attribution.
 *
 * @public
 */
export const countInterruptedBids = (trace?: PlaitedTrace): number =>
  getSnapshotsWithBids(trace).reduce(
    (total, snapshot) => total + snapshot.bids.filter((bid) => bid.interrupts).length,
    0,
  )

/**
 * Build a snapshot-native process summary for one trial.
 *
 * @public
 */
export const summarizeTrialProcess = ({
  trace,
  runnerError,
  timedOut,
}: {
  trace?: PlaitedTrace
  runnerError?: string
  timedOut?: boolean
}): TrialProcessSummary => {
  const coverage = detectTraceCoverage(trace)
  const snapshotCount = trace?.snapshots?.length ?? 0
  const selectionCount = countSnapshotKind(trace, SNAPSHOT_MESSAGE_KINDS.selection)
  const selectedEventCount = countSelectedEvents(trace)
  const emittedEventCount = trace?.emittedEvents?.length ?? 0
  const deadlockCount = countSnapshotKind(trace, SNAPSHOT_MESSAGE_KINDS.deadlock)
  const feedbackErrorCount = countSnapshotKind(trace, SNAPSHOT_MESSAGE_KINDS.feedback_error)
  const runtimeSnapshotErrorCount = countSnapshotKind(trace, SNAPSHOT_MESSAGE_KINDS.runtime_error)
  const runtimeOutputCount = trace?.runtimeOutputs?.length ?? 0
  const runtimeOutputErrorCount = countRuntimeOutputErrors(trace)
  const blockedBidCount = countBlockedBids(trace)
  const interruptedBidCount = countInterruptedBids(trace)
  const { repeatedSelectionCount, maxConsecutiveSelectionTypeCount } = analyzeSelectionPatterns(trace)
  const runnerErrorCount = runnerError ? 1 : 0
  const runnerTimeoutCount = timedOut ? 1 : 0
  const runtimeErrorCount = runtimeSnapshotErrorCount + runtimeOutputErrorCount + runnerErrorCount + runnerTimeoutCount

  return {
    coverage,
    snapshotCount,
    selectionCount,
    selectedEventCount,
    emittedEventCount,
    deadlockCount,
    feedbackErrorCount,
    runtimeErrorCount,
    runtimeOutputCount,
    runtimeOutputErrorCount,
    blockedBidCount,
    interruptedBidCount,
    repeatedSelectionCount,
    maxConsecutiveSelectionTypeCount,
    runnerErrorCount,
    runnerTimeoutCount,
    deadlockDetected: deadlockCount > 0,
    feedbackErrorDetected: feedbackErrorCount > 0,
    runtimeErrorDetected: hasRuntimeErrors({ trace, runnerError, timedOut }),
  }
}

type SnapshotWithBids = Extract<SnapshotMessage, { bids: Array<{ blockedBy?: unknown; interrupts?: unknown }> }>
type SelectionSnapshotMessage = Extract<SnapshotMessage, { kind: 'selection' }>

const countSnapshotKind = (trace: PlaitedTrace | undefined, kind: SnapshotMessage['kind']): number =>
  (trace?.snapshots ?? []).filter((snapshot) => snapshot.kind === kind).length

const getSnapshotsWithBids = (trace?: PlaitedTrace): SnapshotWithBids[] =>
  (trace?.snapshots ?? []).filter((snapshot): snapshot is SnapshotWithBids => 'bids' in snapshot)

const getSelectionSnapshots = (trace?: PlaitedTrace): SelectionSnapshotMessage[] =>
  (trace?.snapshots ?? []).filter(
    (snapshot): snapshot is SelectionSnapshotMessage => snapshot.kind === SNAPSHOT_MESSAGE_KINDS.selection,
  )

const getSelectedEventTypes = (trace?: PlaitedTrace): string[] => {
  const explicitSelectedTypes = (trace?.selectedEvents ?? []).map((event) => event.type)
  if (explicitSelectedTypes.length > 0) {
    return explicitSelectedTypes
  }
  return getSelectionSnapshots(trace).flatMap((snapshot) =>
    snapshot.bids.filter((bid) => bid.selected).map((bid) => bid.type),
  )
}

const countRuntimeOutputErrors = (trace?: PlaitedTrace): number =>
  (trace?.runtimeOutputs ?? []).filter((output) => output.status === 'error' || Boolean(output.error)).length

// ============================================================================
// Meta-Verification
// ============================================================================

/** Verifier function that scores a grader's output */
export type Verifier = (result: GraderResult) => Promise<MetaVerification>

/**
 * Wrap a grader with meta-verification.
 *
 * @remarks
 * The verifier scores the grader's own output, producing a confidence
 * signal and optional reasoning. The result is stored in the optional
 * top-level `metaVerification` field on the grader result, allowing downstream
 * consumers to filter or weight results by grader confidence.
 *
 * This catches hallucinated scores, inconsistent reasoning, and
 * grader failures before they corrupt training signal.
 *
 * @param grader - The grader function to wrap
 * @param verifier - Function that evaluates the grader's output
 * @returns Wrapped grader that includes meta-verification on the result
 *
 * @public
 */
export const withMetaVerification = (grader: Grader, verifier: Verifier): Grader => {
  return async (params) => {
    const result = await grader(params)
    const verification = await verifier(result)
    return {
      ...result,
      metaVerification: verification,
    }
  }
}

// ============================================================================
// Eval Result Persistence
// ============================================================================

/**
 * Persist trial results to retained memory as JSONL.
 *
 * @remarks
 * Writes `TrialResult[]` as JSONL to `.memory/evals/trial-{timestamp}.jsonl`,
 * and returns its path for callers that want to stage or process it later.
 * Results become queryable via retained artifact text search and downstream
 * indexing.
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
