/**
 * Pipeline run command - execute prompts and output raw results.
 *
 * @remarks
 * Supports three modes:
 * - `schema`: Use headless adapter with schema file (full trajectory capture)
 * - `simple`: Use Bun shell with `{}` placeholder for prompt
 * - `shell`: Use Bun shell with `$PROMPT` environment variable
 *
 * Output is RawOutput JSONL suitable for piping to `extract`.
 *
 * @packageDocumentation
 */

import { parseArgs } from 'node:util'
import { loadPrompts, logProgress, writeOutput } from '../core.ts'
import { parseHeadlessConfig } from '../headless/headless.schemas.ts'
import { createSessionManager } from '../headless/headless-session-manager.ts'
import { DEFAULT_HARNESS_TIMEOUT } from '../schemas/constants.ts'
import type { RawOutput, RunConfig } from './pipeline.types.ts'

/**
 * Execute a single prompt in simple mode.
 *
 * @remarks
 * Replaces `{}` placeholder in command with the prompt text.
 * Uses Bun shell for execution.
 *
 * @param prompt - Prompt text to execute
 * @param command - Command template with `{}` placeholder
 * @param timeout - Execution timeout in milliseconds
 * @returns Object with output lines and optional stderr error
 */
const runSimple = async (
  prompt: string,
  command: string,
  timeout: number,
): Promise<{ lines: string[]; error?: string }> => {
  const escapedPrompt = prompt.replace(/'/g, "'\\''")
  const finalCmd = command.replace('{}', `'${escapedPrompt}'`)

  const proc = Bun.spawn(['sh', '-c', finalCmd], {
    stdout: 'pipe',
    stderr: 'pipe',
  })

  const timeoutId = setTimeout(() => proc.kill(), timeout)

  try {
    const [stdout, stderr] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text()])
    clearTimeout(timeoutId)
    const lines = stdout.trim().split('\n').filter(Boolean)
    return stderr.trim() ? { lines, error: stderr.trim() } : { lines }
  } catch (err) {
    clearTimeout(timeoutId)
    return { lines: [], error: err instanceof Error ? err.message : String(err) }
  }
}

/**
 * Execute a single prompt in shell mode.
 *
 * @remarks
 * Sets PROMPT environment variable and executes shell template.
 *
 * @param prompt - Prompt text to execute
 * @param template - Shell command template
 * @param timeout - Execution timeout in milliseconds
 * @returns Object with output lines and optional stderr error
 */
const runShell = async (
  prompt: string,
  template: string,
  timeout: number,
): Promise<{ lines: string[]; error?: string }> => {
  const proc = Bun.spawn(['sh', '-c', template], {
    stdout: 'pipe',
    stderr: 'pipe',
    env: { ...process.env, PROMPT: prompt },
  })

  const timeoutId = setTimeout(() => proc.kill(), timeout)

  try {
    const [stdout, stderr] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text()])
    clearTimeout(timeoutId)
    const lines = stdout.trim().split('\n').filter(Boolean)
    return stderr.trim() ? { lines, error: stderr.trim() } : { lines }
  } catch (err) {
    clearTimeout(timeoutId)
    return { lines: [], error: err instanceof Error ? err.message : String(err) }
  }
}

/**
 * Execute pipeline run with configuration object.
 *
 * @remarks
 * Processes prompts from stdin (if available) or from a file,
 * executing each and outputting RawOutput JSONL.
 *
 * @param config - Run configuration
 * @param prompts - Array of prompts to execute
 * @param outputPath - Optional output file path
 */
export const runPipeline = async (
  config: RunConfig,
  prompts: Array<{ id: string; input: string | string[]; hint?: string; metadata?: Record<string, unknown> }>,
  outputPath?: string,
): Promise<void> => {
  const {
    mode,
    schemaPath,
    simpleCommand,
    shellTemplate,
    cwd,
    timeout = DEFAULT_HARNESS_TIMEOUT,
    progress = false,
  } = config

  const workingDir = cwd ?? process.cwd()
  let isFirstOutput = true

  // Clear output file if specified
  if (outputPath) {
    await Bun.write(outputPath, '')
  }

  if (mode === 'schema') {
    // Schema mode: use headless adapter
    if (!schemaPath) {
      throw new Error('Schema path required for schema mode')
    }

    const schemaFile = Bun.file(schemaPath)
    if (!(await schemaFile.exists())) {
      throw new Error(`Schema file not found: ${schemaPath}`)
    }

    const rawSchema = await schemaFile.json()
    const schema = parseHeadlessConfig(rawSchema)

    const sessions = createSessionManager({
      schema,
      timeout,
      verbose: progress,
    })

    logProgress(`Schema mode: ${schema.name}`, progress)

    for (let i = 0; i < prompts.length; i++) {
      const promptCase = prompts[i]
      if (!promptCase) continue

      logProgress(`[${i + 1}/${prompts.length}] ${promptCase.id}`, progress)

      const startTime = Date.now()
      const rawLines: string[] = []
      let error: string | undefined

      try {
        const session = await sessions.create(workingDir)
        const inputs = Array.isArray(promptCase.input) ? promptCase.input : [promptCase.input]

        for (const turnInput of inputs) {
          const result = await sessions.prompt(session.id, turnInput)
          // Collect raw JSON lines from updates
          for (const update of result.updates) {
            rawLines.push(JSON.stringify(update.raw))
          }
        }

        sessions.destroy(session.id)
      } catch (err) {
        error = err instanceof Error ? err.message : String(err)
      }

      const endTime = Date.now()

      const output: RawOutput = {
        id: promptCase.id,
        input: promptCase.input,
        hint: promptCase.hint,
        metadata: promptCase.metadata,
        rawLines,
        timing: {
          start: startTime,
          end: endTime,
          total: endTime - startTime,
        },
        ...(error && { error }),
      }

      await writeOutput(JSON.stringify(output), outputPath, !isFirstOutput)
      isFirstOutput = false
    }
  } else if (mode === 'simple') {
    // Simple mode: placeholder substitution
    if (!simpleCommand) {
      throw new Error('Command required for simple mode')
    }

    logProgress(`Simple mode: ${simpleCommand}`, progress)

    for (let i = 0; i < prompts.length; i++) {
      const promptCase = prompts[i]
      if (!promptCase) continue

      logProgress(`[${i + 1}/${prompts.length}] ${promptCase.id}`, progress)

      const startTime = Date.now()
      const inputs = Array.isArray(promptCase.input) ? promptCase.input : [promptCase.input]
      const allLines: string[] = []
      const errors: string[] = []

      for (const input of inputs) {
        const result = await runSimple(input, simpleCommand, timeout)
        allLines.push(...result.lines)
        if (result.error) errors.push(result.error)
      }

      const endTime = Date.now()

      const output: RawOutput = {
        id: promptCase.id,
        input: promptCase.input,
        hint: promptCase.hint,
        metadata: promptCase.metadata,
        rawLines: allLines,
        timing: {
          start: startTime,
          end: endTime,
          total: endTime - startTime,
        },
        ...(errors.length > 0 && { error: errors.join('\n') }),
      }

      await writeOutput(JSON.stringify(output), outputPath, !isFirstOutput)
      isFirstOutput = false
    }
  } else if (mode === 'shell') {
    // Shell mode: PROMPT env variable
    if (!shellTemplate) {
      throw new Error('Shell template required for shell mode')
    }

    logProgress(`Shell mode: ${shellTemplate}`, progress)

    for (let i = 0; i < prompts.length; i++) {
      const promptCase = prompts[i]
      if (!promptCase) continue

      logProgress(`[${i + 1}/${prompts.length}] ${promptCase.id}`, progress)

      const startTime = Date.now()
      const inputs = Array.isArray(promptCase.input) ? promptCase.input : [promptCase.input]
      const allLines: string[] = []
      const errors: string[] = []

      for (const input of inputs) {
        const result = await runShell(input, shellTemplate, timeout)
        allLines.push(...result.lines)
        if (result.error) errors.push(result.error)
      }

      const endTime = Date.now()

      const output: RawOutput = {
        id: promptCase.id,
        input: promptCase.input,
        hint: promptCase.hint,
        metadata: promptCase.metadata,
        rawLines: allLines,
        timing: {
          start: startTime,
          end: endTime,
          total: endTime - startTime,
        },
        ...(errors.length > 0 && { error: errors.join('\n') }),
      }

      await writeOutput(JSON.stringify(output), outputPath, !isFirstOutput)
      isFirstOutput = false
    }
  }

  logProgress('Done!', progress)
}

/**
 * Read prompts from stdin if available.
 *
 * @returns Array of parsed prompts or null if stdin is empty
 */
const readStdinPrompts = async (): Promise<Array<{ id: string; input: string | string[]; hint?: string }> | null> => {
  // Check if stdin has data (not a TTY)
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
    .map((line) => JSON.parse(line))
}

/**
 * Pipeline run command CLI handler.
 *
 * @param args - Command line arguments (after 'run')
 */
export const run = async (args: string[]): Promise<void> => {
  const { values, positionals } = parseArgs({
    args,
    options: {
      schema: { type: 'string', short: 's' },
      simple: { type: 'string' },
      shell: { type: 'string' },
      output: { type: 'string', short: 'o' },
      cwd: { type: 'string', short: 'c' },
      timeout: { type: 'string', short: 't' },
      progress: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h' },
    },
    allowPositionals: true,
  })

  if (values.help) {
    console.log(`
Usage: agent-eval-harness run [prompts.jsonl] [options]

Execute prompts and output raw results for pipeline processing.

Arguments:
  prompts.jsonl     Input file (or pipe from stdin)

Modes (choose one):
  -s, --schema      Path to headless adapter schema (recommended)
  --simple          Command template with {} placeholder
  --shell           Shell template with $PROMPT env variable

Options:
  -o, --output      Output file (default: stdout)
  -c, --cwd         Working directory for agent
  -t, --timeout     Request timeout in ms (default: ${DEFAULT_HARNESS_TIMEOUT})
  --progress        Show progress to stderr
  -h, --help        Show this help message

Examples:
  # Schema mode (recommended)
  agent-eval-harness run prompts.jsonl --schema claude.json | agent-eval-harness extract

  # Simple mode with placeholder
  agent-eval-harness run prompts.jsonl --simple "claude -p {} --output-format stream-json"

  # Shell mode with env variable
  agent-eval-harness run prompts.jsonl --shell 'claude -p "$PROMPT" --output-format stream-json'

  # Pipe from stdin
  cat prompts.jsonl | agent-eval-harness run --schema claude.json
`)
    return
  }

  // Determine mode
  let mode: 'schema' | 'simple' | 'shell'
  if (values.schema) {
    mode = 'schema'
  } else if (values.simple) {
    mode = 'simple'
  } else if (values.shell) {
    mode = 'shell'
  } else {
    console.error('Error: Must specify --schema, --simple, or --shell mode')
    process.exit(1)
  }

  // Load prompts from file or stdin
  const promptsPath = positionals[0]
  let prompts: Array<{ id: string; input: string | string[]; hint?: string; metadata?: Record<string, unknown> }>

  if (promptsPath) {
    prompts = await loadPrompts(promptsPath)
  } else {
    const stdinPrompts = await readStdinPrompts()
    if (!stdinPrompts || stdinPrompts.length === 0) {
      console.error('Error: No prompts provided (use file argument or pipe to stdin)')
      process.exit(1)
    }
    prompts = stdinPrompts
  }

  await runPipeline(
    {
      mode,
      schemaPath: values.schema,
      simpleCommand: values.simple,
      shellTemplate: values.shell,
      cwd: values.cwd,
      timeout: values.timeout ? Number.parseInt(values.timeout, 10) : undefined,
      progress: values.progress,
    },
    prompts,
    values.output,
  )
}
