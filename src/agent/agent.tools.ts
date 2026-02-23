import { resolve } from 'node:path'
import { TOOL_STATUS } from './agent.constants.ts'
import type { AgentToolCall, ToolDefinition, ToolResult } from './agent.schemas.ts'
import type { ToolContext, ToolExecutor, ToolHandler } from './agent.types.ts'

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
