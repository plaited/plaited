/**
 * Shared CLI utilities for the plaited toolbox.
 *
 * @remarks
 * Implements the CLI tool pattern: JSON positional arg or stdin pipe,
 * `--schema input|output` for discovery, `--help` for usage, exit codes 0/1/2.
 *
 * @internal
 */

import * as z from 'zod'
import type { ToolContext, ToolHandler } from '../agent/agent.types.ts'

// ============================================================================
// External Binary Check
// ============================================================================

/**
 * Assert that a required external binary is on PATH.
 *
 * @remarks
 * Call at handler registration time (module load) so missing dependencies
 * surface at startup, not mid-task. Returns the resolved path for logging.
 *
 * @public
 */
export const ensureTool = (name: string): string => {
  const path = Bun.which(name)
  if (!path) throw new Error(`Required tool '${name}' not found on PATH. Install it or add it to your node's setup.`)
  return path
}

// ============================================================================
// CLI Context Schema (shared execution context for all makeCli tools)
// ============================================================================

const CliContextSchema = z.object({
  cwd: z.string().optional().describe('Working directory (default: process.cwd())'),
  timeout: z.number().optional().describe('AbortSignal timeout in ms (default: 300000)'),
})

// ============================================================================
// Raw Input Extraction (shared plumbing)
// ============================================================================

/**
 * Extract and parse raw JSON from CLI args or stdin.
 *
 * @remarks
 * Handles `--help`, `--schema`, positional JSON arg, and stdin pipe.
 * Calls `process.exit()` on meta flags and bad input — only returns
 * on valid JSON.
 *
 * @internal
 */
const parseRawCliInput = async (
  args: string[],
  schema: z.ZodSchema,
  options: { name: string; outputSchema?: z.ZodSchema },
): Promise<unknown> => {
  if (args.includes('--help') || args.includes('-h')) {
    console.error(`Usage: plaited ${options.name} '<json>' | --schema input`)
    process.exit(0)
  }

  const schemaIdx = args.indexOf('--schema')
  if (schemaIdx !== -1) {
    const target = args[schemaIdx + 1]
    if (target === 'output' && options.outputSchema) {
      // biome-ignore lint/suspicious/noConsole: CLI stdout output
      console.log(JSON.stringify(z.toJSONSchema(options.outputSchema), null, 2))
    } else {
      // biome-ignore lint/suspicious/noConsole: CLI stdout output
      console.log(JSON.stringify(z.toJSONSchema(schema), null, 2))
    }
    process.exit(0)
  }

  const positionals = args.filter((arg) => !arg.startsWith('--'))
  let rawInput: string | undefined

  if (positionals.length > 0) {
    rawInput = positionals[0]
  } else if (!process.stdin.isTTY) {
    const stdinData = await Bun.stdin.text()
    if (stdinData.trim()) rawInput = stdinData.trim()
  }

  if (!rawInput) {
    console.error(`Usage: plaited ${options.name} '<json>' | --schema input`)
    process.exit(2)
  }

  try {
    return JSON.parse(rawInput)
  } catch {
    console.error('Invalid JSON input')
    process.exit(2)
  }
}

// ============================================================================
// CLI Input Parser
// ============================================================================

/**
 * Parse CLI input following the CLI tool pattern.
 *
 * @remarks
 * - `--help` / `-h`: prints usage, exits 0
 * - `--schema input`: emits input JSON Schema, exits 0
 * - `--schema output`: emits output JSON Schema (if provided), exits 0
 * - First positional arg or stdin pipe: JSON validated with Zod
 * - Exit 2 on bad input
 *
 * @internal
 */
export const parseCli = async <T extends z.ZodSchema>(
  args: string[],
  schema: T,
  options: { name: string; outputSchema?: z.ZodSchema },
): Promise<z.infer<T>> => {
  const raw = await parseRawCliInput(args, schema, options)
  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    console.error(JSON.stringify(parsed.error.issues, null, 2))
    process.exit(2)
  }
  return parsed.data
}

// ============================================================================
// CLI Handler Factory
// ============================================================================

/**
 * Create a CLI handler that delegates to a ToolHandler.
 *
 * @remarks
 * Extracts `workspace` and `timeout` from JSON input before validating
 * the remaining fields against the tool schema. This keeps execution
 * context explicit rather than relying on `process.cwd()`.
 *
 * - `cwd` — working directory for the tool (default: `process.cwd()`)
 * - `timeout` — AbortSignal timeout in ms (default: `300_000`)
 *
 * @internal
 */
export const makeCli =
  (handler: ToolHandler, schema: z.ZodObject<z.ZodRawShape>, name: string) =>
  async (args: string[]): Promise<void> => {
    // Handle --help before parseRawCliInput for richer output
    if (args.includes('--help') || args.includes('-h')) {
      console.error(
        [
          `Usage: plaited ${name} '<json>' | --schema input`,
          '',
          'Context (all tools):',
          '  cwd        string    Working directory (default: process.cwd())',
          '  timeout    number    AbortSignal timeout in ms (default: 300000)',
          '',
          'Options:',
          '  --schema <input|output>  Print JSON Schema and exit',
          '  -h, --help               Show this help',
        ].join('\n'),
      )
      process.exit(0)
    }

    // Compose CLI schema (tool fields + context fields) for --schema discovery
    const cliSchema = schema.extend(CliContextSchema.shape)
    const raw = await parseRawCliInput(args, cliSchema, { name })

    // Extract execution context before tool schema validation
    const { cwd: inputCwd, timeout: inputTimeout, ...toolArgs } = raw as Record<string, unknown>
    const workspace = typeof inputCwd === 'string' ? inputCwd : process.cwd()
    const timeout = typeof inputTimeout === 'number' ? inputTimeout : 300_000

    const parsed = schema.safeParse(toolArgs)
    if (!parsed.success) {
      console.error(JSON.stringify(parsed.error.issues, null, 2))
      process.exit(2)
    }

    const ctx: ToolContext = { workspace, signal: AbortSignal.timeout(timeout) }
    try {
      const output = await handler(parsed.data as Record<string, unknown>, ctx)
      // biome-ignore lint/suspicious/noConsole: CLI stdout output
      console.log(JSON.stringify(output))
    } catch (error) {
      console.error(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }))
      process.exit(1)
    }
  }
