/**
 * Transport executor factories — local, SSH, and A2A tool execution.
 *
 * @remarks
 * Each factory returns a {@link ToolExecutor} closure that abstracts
 * the transport layer. The agent loop calls `toolExecutor(toolCall, signal)`
 * without knowing whether execution is in-process, over SSH, or via A2A.
 *
 * The CLI contract (`makeCli` in `cli.utils.ts`) ensures every tool accepts
 * JSON input with `cwd` and `timeout` fields, making remote execution
 * straightforward: serialize → transport → `bun run plaited <tool> <json>` → parse.
 *
 * @public
 */

import { $ } from 'bun'
import type { Task } from '../a2a/a2a.schemas.ts'
import type {
  CreateA2AExecutorOptions,
  CreateLocalExecutorOptions,
  CreateSshExecutorOptions,
  ToolExecutor,
} from './agent.types.ts'

// ============================================================================
// Local Executor — in-process tool handler dispatch
// ============================================================================

/**
 * Creates a local executor that calls tool handlers directly in-process.
 *
 * @remarks
 * This is the default executor used when no custom `toolExecutor` is provided.
 * Resolves the handler by tool name from the registry, then calls it with
 * the tool call arguments and a {@link ToolContext} containing the workspace
 * path and abort signal.
 *
 * @param options - Workspace path and handler registry
 * @returns A {@link ToolExecutor} that dispatches to in-process handlers
 *
 * @public
 */
export const createLocalExecutor = ({ workspace, handlers }: CreateLocalExecutorOptions): ToolExecutor => {
  return async (toolCall, signal) => {
    const handler = handlers[toolCall.name]
    if (!handler) throw new Error(`Unknown tool: ${toolCall.name}`)
    return handler(toolCall.arguments, { workspace, signal })
  }
}

// ============================================================================
// SSH Executor — remote tool execution over SSH
// ============================================================================

/**
 * Creates an SSH executor that runs tools on a remote machine via SSH.
 *
 * @remarks
 * Serializes the tool call arguments as JSON with `cwd` set to the remote
 * workspace path. Executes `bun run plaited <tool-name> <json>` on the
 * remote host via `Bun.$`. The CLI contract ensures consistent JSON in/out.
 *
 * SSH connection uses `StrictHostKeyChecking=accept-new` for TOFU
 * (Trust On First Use), consistent with the A2A known-peers trust model.
 *
 * Signal propagation: the abort signal is not forwarded. Killing the local
 * SSH process via Bun.$ subprocess management terminates the remote command.
 *
 * @param options - SSH connection details and remote workspace path
 * @returns A {@link ToolExecutor} that serializes tool calls over SSH
 *
 * @public
 */
export const createSshExecutor = ({
  host,
  port,
  username,
  privateKey,
  workspace,
}: CreateSshExecutorOptions): ToolExecutor => {
  return async (toolCall, signal) => {
    if (signal.aborted) throw new Error('Aborted before SSH execution')

    const input = JSON.stringify({ ...toolCall.arguments, cwd: workspace })
    const sshArgs = ['-o', 'StrictHostKeyChecking=accept-new']
    if (privateKey) sshArgs.push('-i', privateKey)
    if (port) sshArgs.push('-p', String(port))

    const target = `${username}@${host}`
    const remoteCmd = `bun run plaited ${toolCall.name} '${input.replace(/'/g, "'\\''")}'`

    const result = await $`ssh ${sshArgs} ${target} ${remoteCmd}`.nothrow().quiet()

    if (signal.aborted) throw new Error('Aborted during SSH execution')
    if (result.exitCode === 2) {
      throw new Error(`Invalid input for ${toolCall.name}: ${result.stderr.toString().trim()}`)
    }
    if (result.exitCode !== 0) {
      throw new Error(result.stderr.toString().trim() || `Remote tool exited with code ${result.exitCode}`)
    }
    return JSON.parse(result.stdout.toString())
  }
}

// ============================================================================
// A2A Executor — remote tool execution via Agent-to-Agent protocol
// ============================================================================

/**
 * Creates an A2A executor that sends tool calls to a remote agent node.
 *
 * @remarks
 * Packages the tool call as a `DataPart` within an A2A message and sends it
 * via `client.sendMessage()` with `blocking: true`. The remote agent
 * executes the tool and returns the result as a task artifact.
 *
 * Response extraction: looks for a `DataPart` or `TextPart` in the first
 * artifact of a completed task. DataPart returns `.data` directly;
 * TextPart is JSON-parsed.
 *
 * Timeout: uses `AbortSignal.timeout()` since A2A cancellation is a
 * separate protocol operation (`tasks/cancel`), not signal propagation.
 *
 * @param options - A2A client and optional timeout
 * @returns A {@link ToolExecutor} that sends tool calls as A2A messages
 *
 * @public
 */
export const createA2AExecutor = ({ client, taskTimeout = 30_000 }: CreateA2AExecutorOptions): ToolExecutor => {
  return async (toolCall, signal) => {
    const combinedSignal = AbortSignal.any([signal, AbortSignal.timeout(taskTimeout)])

    const result = await client.sendMessage({
      message: {
        kind: 'message',
        messageId: crypto.randomUUID(),
        role: 'user',
        parts: [
          {
            kind: 'data',
            data: { tool: toolCall.name, arguments: toolCall.arguments },
          },
        ],
      },
      configuration: { blocking: true },
    })

    // Throw if aborted while waiting
    if (combinedSignal.aborted) {
      throw new Error('A2A tool execution aborted')
    }

    // Extract tool result from response
    if (result.kind === 'task') {
      const task = result as Task
      if (task.status.state === 'failed') {
        const failMsg = task.status.message?.parts[0]
        const errorText = failMsg?.kind === 'text' ? failMsg.text : 'Remote tool execution failed'
        throw new Error(errorText)
      }
      const artifact = task.artifacts?.[0]
      if (artifact) {
        const part = artifact.parts[0]
        if (part?.kind === 'data') return part.data
        if (part?.kind === 'text') return JSON.parse(part.text)
      }
    }

    // Message response (unusual for tool execution, but handle gracefully)
    if (result.kind === 'message') {
      const part = result.parts[0]
      if (part?.kind === 'data') return part.data
      if (part?.kind === 'text') return JSON.parse(part.text)
    }

    throw new Error('Unexpected A2A response format')
  }
}
