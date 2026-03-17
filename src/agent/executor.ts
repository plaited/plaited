/**
 * Transport executor factories — local-first tool execution with A2A as the
 * remote modnet transport.
 *
 * @remarks
 * Each factory returns a {@link ToolExecutor} closure that abstracts
 * the transport layer. The agent loop calls `toolExecutor(toolCall, signal)`
 * without knowing whether execution is in-process or remote.
 *
 * Local execution is the primary path for the personal node runtime.
 * A2A is the remote transport for modnet-to-modnet execution.
 *
 * @public
 */

import type { Task } from '../a2a/a2a.schemas.ts'
import type {
  CreateA2AExecutorOptions,
  CreateLocalExecutorOptions,
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
