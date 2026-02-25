/**
 * Pipeline extract command - parse raw output into trajectories.
 *
 * @remarks
 * Converts RawOutput from `run` command into ExtractedResult with
 * parsed trajectory and final output. Uses the same schema-driven
 * parsing as the capture command.
 *
 * @packageDocumentation
 */

import { parseArgs } from 'node:util'
import { loadJsonl, logProgress, writeOutput } from '../core.ts'
import { parseHeadlessConfig } from '../headless/headless.schemas.ts'
import { createOutputParser } from '../headless/headless-output-parser.ts'
import type { TrajectoryStep } from '../schemas.ts'
import type { ExtractedResult, RawOutput } from './pipeline.types.ts'

/**
 * Extract trajectory from raw output using schema parser.
 *
 * @param rawOutput - Raw output from run command
 * @param parser - Output parser created from schema
 * @returns Extracted result with trajectory
 */
const extractFromRaw = (rawOutput: RawOutput, parser: ReturnType<typeof createOutputParser>): ExtractedResult => {
  const trajectory: TrajectoryStep[] = []
  let finalOutput = ''
  let toolErrors = false

  // Parse each raw line
  for (const line of rawOutput.rawLines) {
    // Try to parse as trajectory update
    const parsed = parser.parseLine(line)
    if (parsed) {
      const updates = Array.isArray(parsed) ? parsed : [parsed]
      for (const update of updates) {
        const timestamp = Date.now() - rawOutput.timing.start

        if (update.type === 'thought') {
          trajectory.push({
            type: 'thought',
            content: update.content ?? '',
            timestamp,
          })
        } else if (update.type === 'message') {
          trajectory.push({
            type: 'message',
            content: update.content ?? '',
            timestamp,
          })
        } else if (update.type === 'tool_call') {
          trajectory.push({
            type: 'tool_call',
            name: update.title ?? 'unknown',
            status: update.status ?? 'pending',
            timestamp,
          })
          if (update.status === 'failed') {
            toolErrors = true
          }
        } else if (update.type === 'plan') {
          trajectory.push({
            type: 'plan',
            entries: [],
            timestamp,
          })
        }
      }
    }

    // Try to parse as result
    const result = parser.parseResult(line)
    if (result.isResult) {
      finalOutput = result.content
    }
  }

  // If no explicit result, extract from messages
  if (!finalOutput) {
    finalOutput = trajectory
      .filter((step): step is TrajectoryStep & { type: 'message' } => step.type === 'message')
      .map((step) => step.content)
      .join('\n')
  }

  return {
    id: rawOutput.id,
    input: rawOutput.input,
    hint: rawOutput.hint,
    output: finalOutput,
    trajectory,
    toolErrors: toolErrors || !!rawOutput.error,
    metadata: rawOutput.metadata,
    timing: rawOutput.timing,
    ...(rawOutput.error && { error: rawOutput.error }),
  }
}

/**
 * Execute pipeline extract with configuration.
 *
 * @param schemaPath - Path to headless adapter schema
 * @param rawOutputs - Raw outputs from run command
 * @param outputPath - Optional output file path
 * @param progress - Show progress to stderr
 */
export const runExtract = async (
  schemaPath: string,
  rawOutputs: RawOutput[],
  outputPath?: string,
  progress = false,
): Promise<void> => {
  // Load and validate schema
  const schemaFile = Bun.file(schemaPath)
  if (!(await schemaFile.exists())) {
    throw new Error(`Schema file not found: ${schemaPath}`)
  }

  const rawSchema = await schemaFile.json()
  const schema = parseHeadlessConfig(rawSchema)
  const parser = createOutputParser(schema)

  logProgress(`Extracting with schema: ${schema.name}`, progress)

  let isFirstOutput = true

  // Clear output file if specified
  if (outputPath) {
    await Bun.write(outputPath, '')
  }

  for (let i = 0; i < rawOutputs.length; i++) {
    const rawOutput = rawOutputs[i]
    if (!rawOutput) continue

    logProgress(`[${i + 1}/${rawOutputs.length}] ${rawOutput.id}`, progress)

    const extracted = extractFromRaw(rawOutput, parser)

    await writeOutput(JSON.stringify(extracted), outputPath, !isFirstOutput)
    isFirstOutput = false
  }

  logProgress('Done!', progress)
}

/**
 * Read raw outputs from stdin.
 *
 * @returns Array of parsed raw outputs or null if stdin is empty
 */
const readStdinRawOutputs = async (): Promise<RawOutput[] | null> => {
  if (process.stdin.isTTY) {
    return null
  }

  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) {
    chunks.push(chunk)
  }

  const content = Buffer.concat(chunks).toString('utf-8').trim()
  if (!content) return null

  return content
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as RawOutput)
}

/**
 * Pipeline extract command CLI handler.
 *
 * @param args - Command line arguments (after 'extract')
 */
export const extract = async (args: string[]): Promise<void> => {
  const { values, positionals } = parseArgs({
    args,
    options: {
      schema: { type: 'string', short: 's' },
      output: { type: 'string', short: 'o' },
      progress: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h' },
    },
    allowPositionals: true,
  })

  if (values.help) {
    console.log(`
Usage: agent-eval-harness extract [raw.jsonl] --schema <schema.json> [options]

Parse raw output into trajectories and final output.

Arguments:
  raw.jsonl         Input file from 'run' command (or pipe from stdin)

Options:
  -s, --schema      Path to headless adapter schema (required)
  -o, --output      Output file (default: stdout)
  --progress        Show progress to stderr
  -h, --help        Show this help message

Examples:
  # From file
  agent-eval-harness extract raw.jsonl --schema claude.json -o extracted.jsonl

  # Piped from run
  agent-eval-harness run prompts.jsonl -s claude.json | agent-eval-harness extract -s claude.json

  # Full pipeline
  cat prompts.jsonl | \\
    agent-eval-harness run -s claude.json | \\
    agent-eval-harness extract -s claude.json | \\
    agent-eval-harness grade --grader ./grader.ts
`)
    return
  }

  if (!values.schema) {
    console.error('Error: --schema is required')
    process.exit(1)
  }

  // Load raw outputs from file or stdin
  const inputPath = positionals[0]
  let rawOutputs: RawOutput[]

  if (inputPath) {
    rawOutputs = await loadJsonl<RawOutput>(inputPath)
  } else {
    const stdinOutputs = await readStdinRawOutputs()
    if (!stdinOutputs || stdinOutputs.length === 0) {
      console.error('Error: No raw output provided (use file argument or pipe to stdin)')
      process.exit(1)
    }
    rawOutputs = stdinOutputs
  }

  await runExtract(values.schema, rawOutputs, values.output, values.progress)
}
