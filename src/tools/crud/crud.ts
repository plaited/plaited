import { resolve } from 'node:path'
import { z } from 'zod'
import { TOOL_STATUS } from '../../agent/agent.constants.ts'
import type { AgentToolCall, ToolDefinition, ToolResult } from '../../agent/agent.schemas.ts'
import type { ToolContext, ToolExecutor, ToolHandler } from '../../agent/agent.types.ts'
import { BashConfigSchema, ListFilesConfigSchema, ReadFileConfigSchema, WriteFileConfigSchema } from './crud.schemas.ts'

// ============================================================================
// CLI Argument Parser
// ============================================================================

/**
 * Parse CLI arguments for a tool command.
 *
 * @remarks
 * Supports two modes:
 * - `--schema`: outputs JSON Schema for the tool and returns null
 * - `--json '{...}'`: validates input with Zod, returns parsed data
 *
 * @param args - CLI arguments array
 * @param schema - Zod schema for validation
 * @param name - Tool name for usage message
 * @returns Parsed data or null (when --schema was requested)
 *
 * @internal
 */
const parseCli = <T extends z.ZodSchema>(args: string[], schema: T, name: string): z.infer<T> | null => {
  if (args.includes('--schema')) {
    // biome-ignore lint/suspicious/noConsole: CLI stdout output
    console.log(JSON.stringify(z.toJSONSchema(schema), null, 2))
    return null
  }
  const jsonIdx = args.indexOf('--json')
  const jsonArg = args[jsonIdx + 1]
  if (jsonIdx === -1 || !jsonArg) {
    console.error(`Usage: plaited ${name} --json '{...}' | --schema`)
    process.exit(1)
  }
  const parsed = schema.safeParse(JSON.parse(jsonArg))
  if (!parsed.success) {
    console.error(JSON.stringify(parsed.error.issues, null, 2))
    process.exit(1)
  }
  return parsed.data
}

// ============================================================================
// Built-in Tool Schemas (OpenAI function-calling format)
// ============================================================================

/**
 * OpenAI-format tool definitions for the built-in tools.
 *
 * @remarks
 * Pass these to the inference call's `tools` parameter so the model
 * knows which tools are available. Consumers can merge with their
 * own tool schemas before passing to `createAgentLoop`.
 *
 * @public
 */
export const builtInToolSchemas: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read the contents of a file at the given path',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string', description: 'Relative path to the file' } },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description: 'Write content to a file at the given path, creating directories as needed',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Relative path to the file' },
          content: { type: 'string', description: 'Content to write to the file' },
        },
        required: ['path', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_files',
      description:
        'List files and directories matching a glob pattern. Returns entries with path, type (file or directory), and size in bytes for files.',
      parameters: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'Glob pattern (defaults to **/* if omitted)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'bash',
      description: 'Execute a shell command in the workspace directory',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'The shell command to execute' },
        },
        required: ['command'],
      },
    },
  },
]

// ============================================================================
// Built-in Tool Handlers
// ============================================================================

const readFile: ToolHandler = async (args, ctx) => {
  const path = args.path as string
  const resolved = resolve(ctx.workspace, path)
  return await Bun.file(resolved).text()
}

const writeFile: ToolHandler = async (args, ctx) => {
  const path = args.path as string
  const content = args.content as string
  const resolved = resolve(ctx.workspace, path)
  await Bun.write(resolved, content)
  return { written: path, bytes: content.length }
}

const listFiles: ToolHandler = async (args, ctx) => {
  const pattern = (args.pattern as string) ?? '**/*'
  const glob = new Bun.Glob(pattern)
  const entries: Array<{ path: string; type: 'file' | 'directory'; size?: number }> = []
  for await (const path of glob.scan({ cwd: ctx.workspace, onlyFiles: false })) {
    const resolved = resolve(ctx.workspace, path)
    const ref = Bun.file(resolved)
    const isFile = await ref.exists()
    entries.push(isFile ? { path, type: 'file', size: ref.size } : { path, type: 'directory' })
  }
  return entries
}

const bash: ToolHandler = async (args, ctx) => {
  const command = args.command as string
  const proc = Bun.spawn(['sh', '-c', command], {
    cwd: ctx.workspace,
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const [stdout, stderr] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text()])
  const exitCode = await proc.exited

  if (exitCode !== 0) {
    throw new Error(stderr.trim() || `Command exited with code ${exitCode}`)
  }
  return stdout.trim()
}

/** Default built-in tool handlers keyed by tool name */
const builtInHandlers: Record<string, ToolHandler> = {
  read_file: readFile,
  write_file: writeFile,
  list_files: listFiles,
  bash,
}

// ============================================================================
// Tool Executor Factory
// ============================================================================

/**
 * Creates a `ToolExecutor` that dispatches tool calls to registered handlers.
 *
 * @remarks
 * - Merges custom tools over built-in tools (custom overrides built-in)
 * - Unknown tools return a `failed` ToolResult (not an exception)
 * - Each tool call is timed (duration in ms)
 * - Filesystem/network containment is enforced by the deployment sandbox,
 *   not by the tool handlers themselves
 *
 * @param options.workspace - The workspace root directory for tool execution
 * @param options.tools - Optional custom tool handlers that override built-ins
 * @returns A `ToolExecutor` function
 *
 * @public
 */
export const createToolExecutor = ({
  workspace,
  tools,
}: {
  workspace: string
  tools?: Record<string, ToolHandler>
}): ToolExecutor => {
  const handlers: Record<string, ToolHandler> = { ...builtInHandlers, ...tools }
  const ctx: ToolContext = { workspace }

  return async (toolCall: AgentToolCall): Promise<ToolResult> => {
    const handler = handlers[toolCall.name]
    const startTime = Date.now()

    if (!handler) {
      return {
        toolCallId: toolCall.id,
        name: toolCall.name,
        status: TOOL_STATUS.failed,
        error: `Unknown tool: "${toolCall.name}"`,
        duration: Date.now() - startTime,
      }
    }

    try {
      const output = await handler(toolCall.arguments, ctx)
      return {
        toolCallId: toolCall.id,
        name: toolCall.name,
        status: TOOL_STATUS.completed,
        output,
        duration: Date.now() - startTime,
      }
    } catch (error) {
      return {
        toolCallId: toolCall.id,
        name: toolCall.name,
        status: TOOL_STATUS.failed,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      }
    }
  }
}

// ============================================================================
// CLI Handlers (tool genome pattern)
// ============================================================================

/**
 * CLI handler for the read_file tool.
 *
 * @remarks
 * Supports `--schema` (outputs JSON Schema) and `--json '{...}'`
 * (validates with Zod, reads file, outputs JSON).
 *
 * @param args - CLI arguments
 *
 * @public
 */
export const readFileCli = async (args: string[]): Promise<void> => {
  const config = parseCli(args, ReadFileConfigSchema, 'read-file')
  if (!config) return
  const resolved = resolve(process.cwd(), config.path)
  const content = await Bun.file(resolved).text()
  // biome-ignore lint/suspicious/noConsole: CLI stdout output
  console.log(JSON.stringify({ content }))
}

/**
 * CLI handler for the write_file tool.
 *
 * @remarks
 * Supports `--schema` (outputs JSON Schema) and `--json '{...}'`
 * (validates with Zod, writes file, outputs JSON).
 *
 * @param args - CLI arguments
 *
 * @public
 */
export const writeFileCli = async (args: string[]): Promise<void> => {
  const config = parseCli(args, WriteFileConfigSchema, 'write-file')
  if (!config) return
  const resolved = resolve(process.cwd(), config.path)
  await Bun.write(resolved, config.content)
  // biome-ignore lint/suspicious/noConsole: CLI stdout output
  console.log(JSON.stringify({ written: config.path, bytes: config.content.length }))
}

/**
 * CLI handler for the list_files tool.
 *
 * @remarks
 * Supports `--schema` (outputs JSON Schema) and `--json '{...}'`
 * (validates with Zod, lists files, outputs JSON).
 *
 * @param args - CLI arguments
 *
 * @public
 */
export const listFilesCli = async (args: string[]): Promise<void> => {
  const config = parseCli(args, ListFilesConfigSchema, 'list-files')
  if (!config) return
  const pattern = config.pattern ?? '**/*'
  const cwd = process.cwd()
  const glob = new Bun.Glob(pattern)
  const entries: Array<{ path: string; type: 'file' | 'directory'; size?: number }> = []
  for await (const path of glob.scan({ cwd, onlyFiles: false })) {
    const resolved = resolve(cwd, path)
    const ref = Bun.file(resolved)
    const isFile = await ref.exists()
    entries.push(isFile ? { path, type: 'file', size: ref.size } : { path, type: 'directory' })
  }
  // biome-ignore lint/suspicious/noConsole: CLI stdout output
  console.log(JSON.stringify(entries))
}

/**
 * CLI handler for the bash tool.
 *
 * @remarks
 * Supports `--schema` (outputs JSON Schema) and `--json '{...}'`
 * (validates with Zod, executes command, outputs JSON).
 *
 * @param args - CLI arguments
 *
 * @public
 */
export const bashCli = async (args: string[]): Promise<void> => {
  const config = parseCli(args, BashConfigSchema, 'bash')
  if (!config) return
  const cwd = process.cwd()
  const proc = Bun.spawn(['sh', '-c', config.command], {
    cwd,
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const [stdout, stderr] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text()])
  const exitCode = await proc.exited

  if (exitCode !== 0) {
    console.error(JSON.stringify({ error: stderr.trim() || `Command exited with code ${exitCode}`, exitCode }))
    process.exit(1)
  }
  // biome-ignore lint/suspicious/noConsole: CLI stdout output
  console.log(JSON.stringify({ stdout: stdout.trim(), exitCode }))
}
