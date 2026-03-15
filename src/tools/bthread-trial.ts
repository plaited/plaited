/**
 * Trial configuration for bThread generation evaluation.
 *
 * @remarks
 * Wires the bThread grader with the trial runner to evaluate bThread
 * generation reliability. Provides both a library function for in-process
 * use and a CLI handler for command-line execution.
 *
 * Prompt cases are loaded from a JSONL file where each line includes
 * the generation prompt, expected behavior hints, and optional
 * companion test content in metadata.
 *
 * @packageDocumentation
 */

import { resolve } from 'node:path'
import * as z from 'zod'
import { createBThreadGrader, type BThreadGraderConfig } from './bthread-grader.ts'
import { parseCli } from './cli.utils.ts'
import type { PromptCase, TrialResult } from './trial.schemas.ts'
import { TrialResultSchema } from './trial.schemas.ts'
import { runTrial } from './trial.ts'
import { loadPrompts } from './trial.utils.ts'

// ============================================================================
// Types
// ============================================================================

/**
 * Configuration for bThread generation trials.
 *
 * @public
 */
export type BThreadTrialConfig = {
  /** Path to prompts JSONL file */
  promptsPath?: string
  /** Prompt cases (alternative to promptsPath) */
  prompts?: PromptCase[]
  /** Trials per prompt (default: 5) */
  k?: number
  /** Output JSONL file path */
  outputPath?: string
  /** Concurrent workers (default: 1) */
  concurrency?: number
  /** Show progress to stderr */
  progress?: boolean
  /** Grader configuration */
  graderConfig?: BThreadGraderConfig
  /** Adapter function that generates bThread code from a prompt */
  adapter: (input: { prompt: string | string[]; cwd?: string }) => Promise<{ output: string }>
}

// ============================================================================
// Library API
// ============================================================================

/** Default k for bThread trials (dev mode) */
const DEFAULT_BTHREAD_K = 5

/**
 * Run bThread generation trials.
 *
 * @remarks
 * Evaluates an adapter's ability to generate valid bThread factories.
 * Uses `createBThreadGrader` for multi-dimensional grading and the
 * trial runner for pass@k metrics.
 *
 * @param config - Trial configuration
 * @returns Array of trial results with pass@k metrics
 *
 * @public
 */
export const runBThreadTrial = async (config: BThreadTrialConfig): Promise<TrialResult[]> => {
  const {
    promptsPath,
    prompts: inlinePrompts,
    k = DEFAULT_BTHREAD_K,
    outputPath,
    concurrency = 1,
    progress = false,
    graderConfig,
    adapter,
  } = config

  // Load prompts from file or use inline
  let prompts: PromptCase[]
  if (inlinePrompts) {
    prompts = inlinePrompts
  } else if (promptsPath) {
    prompts = await loadPrompts(promptsPath)
  } else {
    // Default: load from bundled prompts
    const defaultPath = resolve(import.meta.dir, 'tests/fixtures/bthread-prompts/prompts.jsonl')
    prompts = await loadPrompts(defaultPath)
  }

  const grader = createBThreadGrader(graderConfig)

  return runTrial({
    adapter,
    prompts,
    grader,
    k,
    outputPath,
    concurrency,
    progress,
  })
}

// ============================================================================
// CLI
// ============================================================================

const BThreadTrialInputSchema = z.object({
  adapterPath: z.string().describe('Path to adapter script that generates bThread code'),
  promptsPath: z.string().optional().describe('Path to prompts.jsonl (default: bundled prompts)'),
  outputPath: z.string().optional().describe('Output JSONL file path'),
  k: z.number().optional().default(DEFAULT_BTHREAD_K).describe('Trials per prompt'),
  concurrency: z.number().optional().default(1).describe('Concurrent workers'),
  progress: z.boolean().optional().default(false).describe('Show progress to stderr'),
  typeCheck: z.boolean().optional().default(true).describe('Run tsc --noEmit type check'),
  validate: z.boolean().optional().default(true).describe('Run validateThreadFactory checks'),
})

const BThreadTrialOutputSchema = z.array(TrialResultSchema)

/**
 * CLI handler for bThread generation trials.
 *
 * @public
 */
export const bthreadTrialCli = async (args: string[]): Promise<void> => {
  const { loadAdapter } = await import('./trial.utils.ts')

  const input = await parseCli(args, BThreadTrialInputSchema, {
    name: 'bthread-trial',
    outputSchema: BThreadTrialOutputSchema,
  })

  const adapter = await loadAdapter(input.adapterPath)

  const results = await runBThreadTrial({
    adapter,
    promptsPath: input.promptsPath,
    outputPath: input.outputPath,
    k: input.k,
    concurrency: input.concurrency,
    progress: input.progress,
    graderConfig: {
      typeCheck: input.typeCheck,
      validate: input.validate,
    },
  })

  // Print summary if not writing to file
  if (!input.outputPath) {
    for (const result of results) {
      // biome-ignore lint/suspicious/noConsole: CLI output
      console.log(JSON.stringify(result))
    }
  }
}
