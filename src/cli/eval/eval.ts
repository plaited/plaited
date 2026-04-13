/**
 * Trial runner — library function and CLI handler.
 *
 * @remarks
 * Runs prompts against an adapter k times, optionally grades results,
 * and computes pass@k/pass^k metrics. Library API is primary —
 * `runTrial({ adapter, prompts, grader, k })` works in-process.
 * CLI resolves paths to functions, then delegates to `runTrial`.
 *
 * @packageDocumentation
 */

import * as z from 'zod'
import { parseCli } from '../utils/cli.ts'
import { DEFAULT_K, DEFAULT_TIMEOUT } from './eval.constants.ts'
import type { Adapter, Grader, PromptCase, TrialEntry, TrialResult } from './eval.schemas.ts'
import { TrialResultSchema } from './eval.schemas.ts'
import {
  createWorkspaceDir,
  createWriteMutex,
  loadAdapter,
  loadGrader,
  loadPrompts,
  logProgress,
  readStdinPrompts,
  runWorkerPool,
  writeOutput,
} from './eval.utils.ts'

// ============================================================================
// Pass@k / Pass^k Calculation
// ============================================================================

/**
 * Calculate pass@k: probability of at least one pass in k samples.
 *
 * @remarks
 * Simplified formula when n = k: `1 - (1 - passRate)^k`
 *
 * @public
 */
export const calculatePassAtK = (passes: number, k: number): number => {
  if (passes >= k) return 1
  if (passes === 0) return 0
  const passRate = passes / k
  return 1 - (1 - passRate) ** k
}

/**
 * Calculate pass^k: probability of all k samples passing.
 *
 * @remarks
 * Simply `passRate^k`.
 *
 * @public
 */
export const calculatePassExpK = (passes: number, k: number): number => {
  if (passes === k) return 1
  if (passes === 0) return 0
  const passRate = passes / k
  return passRate ** k
}

// ============================================================================
// Library API
// ============================================================================

/** Configuration for `runTrial` */
export type TrialConfig = {
  adapter: Adapter
  prompts: PromptCase[]
  grader?: Grader
  k?: number
  outputPath?: string
  cwd?: string
  timeout?: number
  concurrency?: number
  workspaceDir?: string
  progress?: boolean
  append?: boolean
  debug?: boolean
}

/**
 * Run trials against an adapter.
 *
 * @remarks
 * For each prompt, runs the adapter k times. Optionally grades each run
 * and computes pass@k/pass^k metrics. Writes results as JSONL when
 * `outputPath` is provided. Always returns the full result array.
 *
 * @public
 */
export const runTrial = async (config: TrialConfig): Promise<TrialResult[]> => {
  const {
    adapter,
    prompts,
    grader,
    k = DEFAULT_K,
    outputPath,
    cwd,
    timeout = DEFAULT_TIMEOUT,
    concurrency = 1,
    workspaceDir,
    progress = false,
    append = false,
  } = config

  const writeMutex = outputPath ? createWriteMutex() : undefined

  // Initialize output file
  if (outputPath && !append) {
    await Bun.write(outputPath, '')
  }

  logProgress(`Running ${prompts.length} prompt(s), k=${k} (${prompts.length * k} total executions)`, progress)
  if (concurrency > 1) {
    logProgress(`Concurrency: ${concurrency} workers`, progress)
  }
  if (workspaceDir) {
    logProgress(`Workspace: ${workspaceDir}`, progress)
  }

  const processPrompt = async (promptCase: PromptCase, index: number): Promise<TrialResult> => {
    logProgress(`[${index + 1}/${prompts.length}] ${promptCase.id}: Running ${k} trial(s)...`, progress)

    const entries: TrialEntry[] = []
    const effectiveTimeout = promptCase.timeout ?? timeout

    for (let trialNum = 1; trialNum <= k; trialNum++) {
      const promptCwd = workspaceDir
        ? await createWorkspaceDir(workspaceDir, `${promptCase.id}-trial-${trialNum}`)
        : cwd

      const start = Date.now()
      let timeoutId: ReturnType<typeof setTimeout> | undefined

      try {
        const adapterPromise = adapter({ prompt: promptCase.input, cwd: promptCwd })
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error('Trial timed out')), effectiveTimeout)
        })
        const adapterResult = await Promise.race([adapterPromise, timeoutPromise])
        if (timeoutId) {
          clearTimeout(timeoutId)
          timeoutId = undefined
        }

        const duration = Date.now() - start

        const entry: TrialEntry = {
          trialNum,
          output: adapterResult.output,
          duration,
          ...(adapterResult.trajectory && { trajectory: adapterResult.trajectory }),
          ...(adapterResult.capture && { capture: adapterResult.capture }),
          ...(adapterResult.timing && { timing: adapterResult.timing }),
          ...(adapterResult.exitCode !== undefined && { exitCode: adapterResult.exitCode }),
          ...(adapterResult.timedOut && { timedOut: true }),
        }

        // Grade if grader provided
        if (grader) {
          const graderResult = await grader({
            input: promptCase.input,
            output: adapterResult.output,
            hint: promptCase.hint,
            trajectory: adapterResult.trajectory,
            metadata: promptCase.metadata,
            cwd: promptCwd,
          })
          entry.pass = graderResult.pass
          entry.score = graderResult.score
          entry.reasoning = graderResult.reasoning
          if (graderResult.outcome) {
            entry.outcome = graderResult.outcome
          }
          if (graderResult.dimensions) {
            entry.dimensions = graderResult.dimensions
          }
        }

        entries.push(entry)
        logProgress(
          `  Trial ${trialNum}/${k}: ${entry.pass === undefined ? '?' : entry.pass ? 'PASS' : 'FAIL'}`,
          progress,
        )
      } catch (error) {
        if (timeoutId) {
          clearTimeout(timeoutId)
          timeoutId = undefined
        }
        const duration = Date.now() - start
        const isTimeout = error instanceof Error && error.message === 'Trial timed out'

        entries.push({
          trialNum,
          output: '',
          duration,
          ...(isTimeout && { timedOut: true }),
          pass: false,
          reasoning: `Error: ${error instanceof Error ? error.message : String(error)}`,
        })
        logProgress(`  Trial ${trialNum}/${k}: ERROR`, progress)
      }
    }

    // Build result
    const result: TrialResult = {
      id: promptCase.id,
      input: promptCase.input,
      ...(promptCase.hint && { hint: promptCase.hint }),
      k,
      trials: entries,
      ...(promptCase.metadata && { metadata: promptCase.metadata }),
    }

    // Calculate metrics if grader was used
    if (grader) {
      const passes = entries.filter((t) => t.pass).length
      result.passRate = passes / k
      result.passAtK = calculatePassAtK(passes, k)
      result.passExpK = calculatePassExpK(passes, k)
    }

    // Write result immediately (mutex for concurrent writes)
    if (outputPath && writeMutex) {
      await writeMutex.write(async () => {
        await writeOutput(JSON.stringify(result), outputPath, true)
      })
    }

    if (grader && progress) {
      logProgress(
        `  => ${promptCase.id}: passRate=${(result.passRate ?? 0).toFixed(2)}, pass@${k}=${(result.passAtK ?? 0).toFixed(2)}`,
        true,
      )
    }

    return result
  }

  const { results } = await runWorkerPool(prompts, processPrompt, { concurrency })

  // If no outputPath, write all results to stdout
  if (!outputPath) {
    for (const result of results) {
      await writeOutput(JSON.stringify(result))
    }
  }

  logProgress(`Done. ${results.length} result(s).`, progress)

  return results
}

// ============================================================================
// CLI Schema + Handler
// ============================================================================

/**
 * CLI input schema for the eval command.
 *
 * @public
 */
export const EvalInputSchema = z.object({
  adapterPath: z.string().describe('Path to adapter script (.ts/.js module or executable)'),
  promptsPath: z.string().optional().describe('Path to prompts.jsonl'),
  outputPath: z.string().optional().describe('Output file (default: stdout)'),
  k: z.number().optional().default(1).describe('Trials per prompt'),
  graderPath: z.string().optional().describe('Path to grader script'),
  cwd: z.string().optional().describe('Working directory for adapter'),
  timeout: z.number().optional().describe('Timeout per prompt in ms'),
  concurrency: z.number().optional().default(1).describe('Concurrent workers'),
  workspaceDir: z.string().optional().describe('Per-prompt workspace isolation base dir'),
  progress: z.boolean().optional().default(false).describe('Show progress to stderr'),
  append: z.boolean().optional().default(false).describe('Append to output file'),
  debug: z.boolean().optional().default(false).describe('Enable debug mode'),
})

/** CLI output schema (array of TrialResult) */
export const EvalOutputSchema = z.array(TrialResultSchema)

/**
 * CLI handler for the eval command.
 *
 * @remarks
 * Uses `parseCli` for input parsing, then resolves paths → functions
 * and delegates to `runTrial`. Custom execution handles partial failures,
 * concurrent workers, and progress reporting.
 *
 * @public
 */
export const evalCli = async (args: string[]): Promise<void> => {
  const input = await parseCli(args, EvalInputSchema, {
    name: 'eval',
    outputSchema: EvalOutputSchema,
  })

  // Resolve adapter path → function
  const adapter = await loadAdapter(input.adapterPath)

  // Resolve grader path → function (optional)
  const grader = input.graderPath ? await loadGrader(input.graderPath) : undefined

  // Load prompts from file or stdin
  let prompts: PromptCase[]
  if (input.promptsPath) {
    prompts = await loadPrompts(input.promptsPath)
  } else {
    const stdinPrompts = await readStdinPrompts()
    if (!stdinPrompts || stdinPrompts.length === 0) {
      console.error('Error: promptsPath required or pipe prompts via stdin')
      process.exit(2)
    }
    prompts = stdinPrompts
  }

  await runTrial({
    adapter,
    prompts,
    grader,
    k: input.k,
    outputPath: input.outputPath,
    cwd: input.cwd,
    timeout: input.timeout,
    concurrency: input.concurrency,
    workspaceDir: input.workspaceDir,
    progress: input.progress,
    append: input.append,
    debug: input.debug,
  })
}
