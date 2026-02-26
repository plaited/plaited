/**
 * Unified eval command — runs capture (k=1) or trials (k>1).
 *
 * @remarks
 * Replaces the distinction between `capture` and `trials` with a single command.
 * `eval` with default k=1 behaves exactly like `capture`.
 * `eval -k 5` behaves exactly like `trials -k 5`.
 *
 * @packageDocumentation
 */

import { parseArgs } from 'node:util'
import { z } from 'zod'
import { readStdinPrompts } from '../core.ts'
import { loadGraderOrExit } from '../schemas/grader-loader.ts'
import type { CaptureResult, PromptCase, TrialResult } from '../schemas.ts'
import { runCapture } from './capture.ts'
import { type BaseExecutionConfig, parseConcurrency } from './execution.ts'
import { runTrials } from './trials.ts'

// ============================================================================
// Config Schema (tool genome)
// ============================================================================

export const evalConfigSchema = z.object({
  promptsPath: z.string().optional().describe('Path to prompts.jsonl file'),
  schemaPath: z.string().describe('Path to agent schema JSON file'),
  k: z.number().optional().default(1).describe('Number of runs per prompt (1 = capture, >1 = trials)'),
  outputPath: z.string().optional().describe('Output file path (default: stdout)'),
  cwd: z.string().optional().describe('Working directory for agent'),
  timeout: z.number().optional().describe('Timeout per prompt in ms'),
  progress: z.boolean().optional().default(false).describe('Show progress to stderr'),
  append: z.boolean().optional().default(false).describe('Append to output file'),
  graderPath: z.string().optional().describe('Path to grader (.ts/.js module or executable script)'),
  debug: z.boolean().optional().default(false).describe('Enable debug mode'),
  concurrency: z.number().optional().default(1).describe('Number of concurrent workers'),
  workspaceDir: z.string().optional().describe('Base directory for per-prompt workspace isolation'),
})

// ============================================================================
// Programmatic Runner
// ============================================================================

/**
 * Unified eval runner — delegates to capture (k=1) or trials (k>1).
 *
 * @param config - Eval configuration
 * @returns Array of results (CaptureResult when k=1, TrialResult when k>1)
 *
 * @public
 */
export const runEval = async (
  config: z.infer<typeof evalConfigSchema> & {
    prompts?: PromptCase[]
    grader?: BaseExecutionConfig['grader']
  },
): Promise<CaptureResult[] | TrialResult[]> => {
  const { k = 1, graderPath, ...rest } = config

  // Load grader if path provided and no grader function given
  const grader = config.grader ?? (graderPath ? await loadGraderOrExit(graderPath) : undefined)

  const baseConfig: BaseExecutionConfig = {
    ...rest,
    grader,
  }

  if (k <= 1) {
    return runCapture(baseConfig)
  }
  return runTrials({ ...baseConfig, k })
}

// ============================================================================
// CLI Handler
// ============================================================================

/**
 * Unified eval command CLI handler.
 *
 * @param args - Command line arguments (after 'eval')
 */
export const evalRun = async (args: string[]): Promise<void> => {
  // Check for --schema flag (tool genome)
  if (args.includes('--schema')) {
    // biome-ignore lint/suspicious/noConsole: CLI stdout output
    console.log(JSON.stringify(z.toJSONSchema(evalConfigSchema), null, 2))
    return
  }

  // Check for --json flag (tool genome)
  const jsonIdx = args.indexOf('--json')
  const jsonArg = args[jsonIdx + 1]
  if (jsonIdx !== -1 && jsonArg) {
    const parsed = evalConfigSchema.safeParse(JSON.parse(jsonArg))
    if (!parsed.success) {
      console.error(JSON.stringify(parsed.error.issues, null, 2))
      process.exit(1)
    }
    await runEval(parsed.data)
    return
  }

  // Legacy CLI interface (flag-based, for backward compat)
  const { values, positionals } = parseArgs({
    args,
    options: {
      schema: { type: 'string', short: 's' },
      output: { type: 'string', short: 'o' },
      k: { type: 'string', short: 'k', default: '1' },
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
    // biome-ignore lint/suspicious/noConsole: CLI stdout output
    console.log(`
Usage: plaited eval <prompts.jsonl> --schema <schema.json> [options]
       plaited eval --json '{...}'
       plaited eval --schema

Unified eval command — replaces separate capture/trials commands.
  k=1 (default): single run per prompt (capture behavior)
  k>1: multiple runs per prompt with pass@k metrics (trials behavior)

Arguments:
  prompts.jsonl     Input file with evaluation prompts

Options:
  -s, --schema      Path to agent schema JSON file (required)
  -o, --output      Output file (default: stdout)
  -k                Number of runs per prompt (default: 1)
  -c, --cwd         Working directory for agent
  -t, --timeout     Request timeout in ms (overrides schema default)
  -j, --concurrency Number of concurrent workers (default: 1)
  --stdin           Read prompts from stdin
  --workspace-dir   Base directory for per-prompt workspace isolation
  --progress        Show progress to stderr
  --append          Append to output file
  -g, --grader      Path to grader (.ts/.js module or executable script)
  --debug           Enable debug mode
  -h, --help        Show this help message

  --json            Structured JSON input (agent-facing, tool genome)
  --schema          Output JSON Schema for this command (agent-facing)

Examples:
  # Single run (capture behavior)
  plaited eval prompts.jsonl -s claude.json -o results.jsonl

  # Five runs per prompt (trials behavior)
  plaited eval prompts.jsonl -s claude.json -k 5 -o trials.jsonl

  # Agent-facing: structured input
  plaited eval --json '{"schemaPath":"claude.json","promptsPath":"prompts.jsonl","k":5}'

  # Agent-facing: discover schema
  plaited eval --schema
`)
    return
  }

  const promptsPath = positionals[0]
  const useStdin = values.stdin ?? false

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
    console.error('Example: plaited eval prompts.jsonl --schema ./claude.json')
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

  const grader = values.grader ? await loadGraderOrExit(values.grader) : undefined
  const k = Number.parseInt(values.k ?? '1', 10)

  if (k <= 1) {
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
  } else {
    await runTrials({
      promptsPath: promptsPath ?? undefined,
      prompts,
      schemaPath: values.schema,
      k,
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
}
