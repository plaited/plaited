/**
 * Shared execution utilities for capture and trials commands.
 *
 * @remarks
 * Extracts common setup logic: schema loading, prompt loading, path resolution,
 * session manager creation, output initialization, and worker pool execution.
 *
 * @packageDocumentation
 */

import { mkdir } from 'node:fs/promises'
import { createWriteMutex, loadPrompts, logProgress, resolvePath, runWorkerPool, writeOutput } from '../core.ts'
import { type HeadlessAdapterConfig, parseHeadlessConfig } from '../headless/headless.schemas.ts'
import { createSessionManager, type SessionManager } from '../headless/headless-session-manager.ts'
import { DEFAULT_HARNESS_TIMEOUT } from '../schemas/constants.ts'
import type { Grader, PromptCase } from '../schemas.ts'

// ============================================================================
// Types
// ============================================================================

/** Base configuration shared by capture and trials commands */
export type BaseExecutionConfig = {
  /** Path to prompts.jsonl file (required unless prompts provided) */
  promptsPath?: string
  /** Path to agent schema JSON file */
  schemaPath: string
  /** Pre-loaded prompt cases (from stdin); skips file loading when set */
  prompts?: PromptCase[]
  /** Output file path (undefined for stdout) */
  outputPath?: string
  /** Working directory for agent */
  cwd?: string
  /** Timeout per prompt in milliseconds (overrides schema default) */
  timeout?: number
  /** Show progress to stderr */
  progress?: boolean
  /** Append to output file instead of overwriting */
  append?: boolean
  /** Optional grader function */
  grader?: Grader
  /** Enable debug mode */
  debug?: boolean
  /** Number of concurrent workers (default: 1 for sequential) */
  concurrency?: number
  /** Base directory for per-prompt workspace isolation */
  workspaceDir?: string
}

/** Prepared execution context returned by prepareExecution */
export type ExecutionContext = {
  /** Parsed and validated headless adapter schema */
  schema: HeadlessAdapterConfig
  /** Loaded and validated prompt cases */
  prompts: PromptCase[]
  /** Session manager for creating/destroying agent sessions */
  sessions: SessionManager
  /** Resolved absolute output path (undefined for stdout) */
  resolvedOutputPath?: string
  /** Resolved absolute workspace directory path */
  resolvedWorkspaceDir?: string
  /** Effective timeout in milliseconds */
  effectiveTimeout: number
  /** Default working directory for agent sessions */
  defaultWorkingDir: string
  /** Number of concurrent workers */
  concurrency: number
  /** Whether to show progress output */
  progress: boolean
  /** Optional grader function */
  grader?: Grader
  /** Whether debug mode is enabled */
  debug: boolean
  /** Write a result object as JSONL, coordinated via mutex */
  writeResult: (result: unknown) => Promise<void>
}

// ============================================================================
// Execution Setup
// ============================================================================

/**
 * Prepare execution context from base configuration.
 *
 * @remarks
 * Handles all shared setup: schema loading/validation, prompt loading,
 * path resolution, session manager creation, output file initialization,
 * workspace directory creation, and write mutex coordination.
 *
 * @param config - Base execution configuration
 * @returns Prepared execution context
 * @throws Error if schema file not found, invalid, or prompts missing
 *
 * @public
 */
export const prepareExecution = async (config: BaseExecutionConfig): Promise<ExecutionContext> => {
  const {
    promptsPath,
    schemaPath,
    outputPath,
    cwd,
    timeout,
    progress = false,
    append = false,
    grader,
    debug = false,
    concurrency = 1,
    workspaceDir,
  } = config

  // Validate prompt source
  if (!config.prompts && !promptsPath) {
    throw new Error('Either promptsPath or prompts must be provided')
  }

  // Load and validate schema
  const schemaFile = Bun.file(schemaPath)
  if (!(await schemaFile.exists())) {
    throw new Error(`Schema file not found: ${schemaPath}`)
  }

  let schema: HeadlessAdapterConfig
  try {
    const rawSchema = await schemaFile.json()
    schema = parseHeadlessConfig(rawSchema)
  } catch (error) {
    throw new Error(`Invalid schema: ${error instanceof Error ? error.message : String(error)}`)
  }

  // Load prompts
  const prompts = config.prompts ?? (await loadPrompts(promptsPath!))

  // Resolve paths
  const resolvedOutputPath = outputPath ? resolvePath(outputPath) : undefined
  const resolvedWorkspaceDir = workspaceDir ? resolvePath(workspaceDir) : undefined

  // Determine effective timeout (CLI flag > schema default > harness default)
  const schemaTimeout = 'timeout' in schema ? schema.timeout : undefined
  const effectiveTimeout = timeout ?? schemaTimeout ?? DEFAULT_HARNESS_TIMEOUT

  // Create session manager
  const sessions = createSessionManager({
    schema,
    timeout: effectiveTimeout,
    verbose: progress,
    debug,
  })

  // Initialize output file (clear if not appending)
  if (resolvedOutputPath && !append) {
    await Bun.write(resolvedOutputPath, '')
  }

  // Create workspace base directory if specified
  if (resolvedWorkspaceDir) {
    await mkdir(resolvedWorkspaceDir, { recursive: true })
  }

  const defaultWorkingDir = cwd ?? process.cwd()

  // Create write mutex with closure for coordinated result writing
  const writeMutex = createWriteMutex()
  let isFirstOutput = true

  const writeResult = async (result: unknown) => {
    await writeMutex.write(async () => {
      const formatted = JSON.stringify(result)
      await writeOutput(formatted, resolvedOutputPath, !isFirstOutput)
      isFirstOutput = false
    })
  }

  return {
    schema,
    prompts,
    sessions,
    resolvedOutputPath,
    resolvedWorkspaceDir,
    effectiveTimeout,
    defaultWorkingDir,
    concurrency,
    progress,
    grader,
    debug,
    writeResult,
  }
}

// ============================================================================
// Worker Pool Execution
// ============================================================================

/**
 * Execute prompts through a worker pool with progress logging.
 *
 * @remarks
 * Common wrapper for the runWorkerPool pattern used by both capture and trials.
 * Handles progress callbacks, error logging, and completion logging.
 *
 * @param ctx - Execution context from prepareExecution
 * @param processFn - Function to process each prompt
 * @returns Array of results
 *
 * @public
 */
export const executePrompts = async <T>(
  ctx: ExecutionContext,
  processFn: (promptCase: PromptCase, index: number) => Promise<T>,
): Promise<T[]> => {
  const { results, errors } = await runWorkerPool(ctx.prompts, processFn, {
    concurrency: ctx.concurrency,
    onProgress: (completed, total) => {
      logProgress(`Progress: ${completed}/${total} prompts completed`, ctx.progress)
    },
  })

  if (errors.length > 0) {
    logProgress(`Completed with ${errors.length} error(s)`, ctx.progress)
  }

  logProgress('Done!', ctx.progress)
  return results
}

// ============================================================================
// CLI Helpers
// ============================================================================

/**
 * Parse and validate concurrency CLI argument.
 *
 * @param value - Raw string value from parseArgs
 * @returns Validated positive integer (default: 1)
 *
 * @public
 */
export const parseConcurrency = (value: string | undefined): number => {
  if (!value) return 1
  const parsed = Number.parseInt(value, 10)
  if (Number.isNaN(parsed) || parsed < 1) {
    console.error('Error: --concurrency must be a positive integer')
    process.exit(1)
  }
  return parsed
}
