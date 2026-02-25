/**
 * Core trajectory capture command.
 *
 * @remarks
 * Executes prompts against a CLI agent and captures full trajectories.
 * This is the foundational command - all other views derive from its output.
 *
 * Output format is always full trajectory JSONL (`CaptureResultSchema`).
 * Use `summarize` command to derive compact views.
 *
 * @packageDocumentation
 */

import { parseArgs } from 'node:util'
import {
  createWorkspaceDir,
  detectTrajectoryRichness,
  extractOutput,
  extractTrajectory,
  getInputPreview,
  hasToolErrors,
  logProgress,
  readStdinPrompts,
} from '../core.ts'
import type { ParsedUpdate } from '../headless/headless-output-parser.ts'
import type { ProcessExitInfo, PromptResult } from '../headless/headless-session-manager.ts'
import { loadGraderOrExit } from '../schemas/grader-loader.ts'
import type { CaptureResult, PromptCase, TrajectoryRichness } from '../schemas.ts'
import { type BaseExecutionConfig, executePrompts, parseConcurrency, prepareExecution } from './execution.ts'

// ============================================================================
// Re-exports for backward compatibility
// ============================================================================

// These functions are now in core/ but re-exported here for existing consumers
export {
  detectTrajectoryRichness,
  extractContent,
  extractFilePath,
  extractOutput,
  extractTrajectory,
  hasToolErrors,
  headTailPreview,
  loadPrompts,
} from '../core.ts'

// ============================================================================
// Types
// ============================================================================

/** Configuration for capture command */
export type CaptureConfig = BaseExecutionConfig

// ============================================================================
// Capture Implementation
// ============================================================================

/**
 * Execute capture with configuration object.
 *
 * @remarks
 * Creates a fresh session for each JSONL entry to ensure isolation.
 * Supports multi-turn conversations via `input: string[]`.
 *
 * @param config - Capture configuration
 * @returns Array of capture results
 */
export const runCapture = async (config: CaptureConfig): Promise<CaptureResult[]> => {
  const ctx = await prepareExecution(config)
  const {
    schema,
    prompts,
    sessions,
    resolvedOutputPath,
    resolvedWorkspaceDir,
    defaultWorkingDir,
    progress,
    grader,
    debug,
  } = ctx

  // Log progress info
  logProgress(`Loaded ${prompts.length} prompts from ${config.promptsPath ?? 'stdin'}`, progress)
  logProgress(`Schema: ${schema.name} (${config.schemaPath})`, progress)
  logProgress(`Timeout: ${ctx.effectiveTimeout}ms`, progress)
  if (ctx.concurrency > 1) {
    logProgress(`Concurrency: ${ctx.concurrency} workers`, progress)
  }
  if (resolvedWorkspaceDir) {
    logProgress(`Workspace: ${resolvedWorkspaceDir}`, progress)
  }
  if (resolvedOutputPath) {
    logProgress(`Output: ${resolvedOutputPath}`, progress)
  }
  if (debug) {
    logProgress(`Debug mode: enabled`, progress)
  }

  // Process a single prompt (used by worker pool)
  const processPrompt = async (promptCase: (typeof prompts)[number], index: number): Promise<CaptureResult> => {
    // Determine working directory (per-prompt workspace or default)
    const workingDir = resolvedWorkspaceDir
      ? await createWorkspaceDir(resolvedWorkspaceDir, promptCase.id)
      : defaultWorkingDir

    logProgress(`[${index + 1}/${prompts.length}] ${promptCase.id}: ${getInputPreview(promptCase.input)}...`, progress)

    const startTime = Date.now()
    let result: CaptureResult
    let sessionId: string | undefined

    try {
      // Create fresh session for each entry (ensures isolation)
      const sessionStart = Date.now()
      const session = await sessions.create(workingDir)
      sessionId = session.id
      const sessionCreation = Date.now() - sessionStart
      logProgress(`  Session: ${session.id}`, progress)

      // Handle string or array input
      const inputs = Array.isArray(promptCase.input) ? promptCase.input : [promptCase.input]
      const turnCount = inputs.length

      // Collect all updates from all turns
      const allUpdates: ParsedUpdate[] = []
      let lastExitInfo: ProcessExitInfo | undefined
      let lastOutput = ''

      // Execute each turn sequentially in the same session
      for (const turnInput of inputs) {
        const turnResult: PromptResult = await sessions.prompt(session.id, turnInput)
        allUpdates.push(...turnResult.updates)
        lastExitInfo = turnResult.exitInfo
        lastOutput = turnResult.output
      }

      const endTime = Date.now()
      const trajectory = extractTrajectory(allUpdates, startTime)

      // Use last turn's output or extract from trajectory
      const output = lastOutput || extractOutput(trajectory)
      const toolErrors = hasToolErrors(trajectory) || (lastExitInfo?.timedOut ?? false)
      const trajectoryRichness = detectTrajectoryRichness(trajectory)

      result = {
        id: promptCase.id,
        input: promptCase.input,
        output,
        ...(promptCase.hint && { hint: promptCase.hint }),
        trajectory,
        metadata: {
          ...promptCase.metadata,
          agent: schema.name,
          trajectoryRichness,
          turnCount,
          ...(resolvedWorkspaceDir && { workspaceDir: workingDir }),
          ...(lastExitInfo && {
            exitCode: lastExitInfo.exitCode,
            signal: lastExitInfo.signal,
            timedOut: lastExitInfo.timedOut,
          }),
        },
        timing: {
          start: startTime,
          end: endTime,
          firstResponse: trajectory.length > 0 ? trajectory[0]?.timestamp : undefined,
          sessionCreation,
          total: endTime - startTime,
        },
        toolErrors,
      }

      // Apply grader if provided
      if (grader) {
        const graderResult = await grader({
          input: promptCase.input,
          output,
          hint: promptCase.hint,
          trajectory,
          metadata: promptCase.metadata,
          cwd: session.cwd,
        })

        result.score = graderResult

        if (graderResult.outcome) {
          result.outcome = graderResult.outcome
        }
      }
    } catch (error) {
      const endTime = Date.now()
      const message = error instanceof Error ? error.message : String(error)
      const inputs = Array.isArray(promptCase.input) ? promptCase.input : [promptCase.input]

      result = {
        id: promptCase.id,
        input: promptCase.input,
        output: '',
        trajectory: [],
        metadata: {
          ...promptCase.metadata,
          agent: schema.name,
          trajectoryRichness: 'minimal' as TrajectoryRichness,
          turnCount: inputs.length,
          ...(resolvedWorkspaceDir && { workspaceDir: workingDir }),
        },
        timing: {
          start: startTime,
          end: endTime,
          sessionCreation: 0,
          total: endTime - startTime,
        },
        toolErrors: true,
        errors: [message],
      }
    } finally {
      // Always clean up session if it was created
      if (sessionId) {
        sessions.destroy(sessionId)
      }
    }

    // Write result immediately (coordinated via mutex for concurrent writes)
    await ctx.writeResult(result)

    const statusIcon = result.toolErrors ? '!' : '✓'
    const exitInfo = result.metadata?.timedOut
      ? ' - TIMEOUT'
      : result.metadata?.exitCode && result.metadata.exitCode !== 0
        ? ` - exit ${result.metadata.exitCode}`
        : ''
    logProgress(`  ${statusIcon} ${promptCase.id} (${result.timing.total}ms)${exitInfo}`, progress)

    return result
  }

  // Run with worker pool
  return executePrompts(ctx, processPrompt)
}

// ============================================================================
// CLI Entry Point
// ============================================================================

/**
 * Capture command CLI handler.
 *
 * @param args - Command line arguments (after 'capture')
 */
export const capture = async (args: string[]): Promise<void> => {
  const { values, positionals } = parseArgs({
    args,
    options: {
      schema: { type: 'string', short: 's' },
      output: { type: 'string', short: 'o' },
      cwd: { type: 'string', short: 'c' },
      timeout: { type: 'string', short: 't' },
      progress: { type: 'boolean', default: false },
      append: { type: 'boolean', default: false },
      grader: { type: 'string', short: 'g' },
      debug: { type: 'boolean', default: false },
      stdin: { type: 'boolean', default: false },
      concurrency: { type: 'string', short: 'j' },
      'workspace-dir': { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
    allowPositionals: true,
  })

  if (values.help) {
    console.log(`
Usage: agent-eval-harness capture <prompts.jsonl> --schema <schema.json> [options]
       cat prompts.jsonl | agent-eval-harness capture --stdin --schema <schema.json> [options]

Arguments:
  prompts.jsonl     Input file with evaluation prompts

Options:
  -s, --schema      Path to agent schema JSON file (required)
  -o, --output      Output file (default: stdout)
  -c, --cwd         Working directory for agent
  -t, --timeout     Request timeout in ms (overrides schema default)
  -j, --concurrency Number of concurrent workers (default: 1)
  --stdin           Read prompts from stdin (mutually exclusive with file arg)
  --workspace-dir   Base directory for per-prompt workspace isolation
  --progress        Show progress to stderr
  --append          Append to output file instead of overwriting
  -g, --grader      Path to grader (.ts/.js module or executable script)
  --debug           Enable debug mode (shows raw output, JSONPath matching)
  -h, --help        Show this help message

Output Format:
  Full trajectory JSONL with toolErrors indicator.
  Use 'agent-eval-harness summarize' to derive compact views.

Exit Info (in metadata):
  exitCode      Process exit code (null if killed/timed out)
  signal        Signal that killed process (if any)
  timedOut      true if process was killed due to timeout

Graders:
  TS/JS modules must export a 'grade' function.
  Executable scripts (Python, etc.) use stdin/stdout JSON protocol.

Parallelization:
  Use -j/--concurrency to run multiple prompts in parallel.
  Each prompt gets its own agent session for isolation.
  Results are written as they complete (order may differ from input).

  Memory: Stream-mode agents (e.g. Claude Code) spawn real subprocesses
  at ~400-500MB RSS each. With -j 8 that is 3-4GB of resident memory.
  In memory-constrained environments (Docker, CI) this can cause OOM kills.
  Use --stdin to pipe prompts for container-level orchestration.

Workspace Isolation:
  Use --workspace-dir to create per-prompt directories.
  Each prompt runs in {workspace-dir}/prompt-{id}/.
  Useful for code generation tasks requiring filesystem isolation.

Examples:
  # Basic capture with schema
  agent-eval-harness capture prompts.jsonl --schema claude.json -o results.jsonl

  # Run 4 prompts in parallel
  agent-eval-harness capture prompts.jsonl -s claude.json -j 4 -o results.jsonl

  # With workspace isolation for code generation
  agent-eval-harness capture prompts.jsonl -s claude.json -j 4 \\
    --workspace-dir ./workspaces -o results.jsonl

  # With TypeScript grader
  agent-eval-harness capture prompts.jsonl -s claude.json --grader ./grader.ts -o results.jsonl

  # With debug mode
  agent-eval-harness capture prompts.jsonl -s claude.json --debug -o results.jsonl

  # Read prompts from stdin (container orchestration)
  cat prompts.jsonl | agent-eval-harness capture --stdin -s claude.json -o results.jsonl
`)
    return
  }

  const promptsPath = positionals[0]
  const useStdin = values.stdin ?? false

  // Mutual exclusivity: --stdin and positional file
  if (useStdin && promptsPath) {
    console.error('Error: --stdin and prompts file argument are mutually exclusive')
    process.exit(1)
  }

  if (!useStdin && !promptsPath) {
    console.error('Error: prompts.jsonl path is required (or use --stdin)')
    process.exit(1)
  }

  if (!values.schema) {
    console.error('Error: --schema is required')
    console.error('Example: agent-eval-harness capture prompts.jsonl --schema ./claude.json')
    process.exit(1)
  }

  // Read prompts from stdin if requested
  let prompts: PromptCase[] | undefined
  if (useStdin) {
    const stdinPrompts = await readStdinPrompts()
    if (!stdinPrompts || stdinPrompts.length === 0) {
      console.error('Error: no prompts received on stdin')
      process.exit(1)
    }
    prompts = stdinPrompts
  }

  // Load grader if specified
  const grader = values.grader ? await loadGraderOrExit(values.grader) : undefined

  await runCapture({
    promptsPath: promptsPath ?? undefined,
    prompts,
    schemaPath: values.schema,
    outputPath: values.output,
    cwd: values.cwd,
    timeout: values.timeout ? Number.parseInt(values.timeout, 10) : undefined,
    progress: values.progress ?? false,
    append: values.append ?? false,
    grader,
    debug: values.debug ?? false,
    concurrency: parseConcurrency(values.concurrency),
    workspaceDir: values['workspace-dir'],
  })
}
