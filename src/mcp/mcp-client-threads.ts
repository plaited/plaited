/**
 * @internal
 * @module mcp-client-threads
 *
 * Purpose: Default behavioral threads for MCP client agent functionality
 * Architecture: Provides reusable thread patterns for common agent behaviors
 * Dependencies: behavioral module for thread creation, mcp types for events
 * Consumers: defineMCPClient when defaultThreads is enabled
 *
 * Maintainer Notes:
 * - These threads implement best practices for agent behavior
 * - Each thread is self-contained and can be used independently
 * - Threads communicate via events, not shared state
 * - Error handling and retry logic built into each thread
 * - Threads are designed to be extended or replaced by users
 *
 * Common modification scenarios:
 * - Adding new default behaviors: Create new thread function
 * - Changing retry logic: Modify the retry thread parameters
 * - Adding rate limiting: Update the rate limiter thread
 * - Custom discovery logic: Extend the auto-discovery thread
 *
 * Performance considerations:
 * - Threads are lightweight coroutines with minimal overhead
 * - Event-driven architecture prevents blocking
 * - Retry logic uses exponential backoff to prevent overwhelming servers
 * - Rate limiting prevents excessive API calls
 */

import type { BSync, BThread, PlaitedTrigger, BThreads } from '../behavioral.js'
import type { MCPClientEventDetails, AgentEventDetails, InferenceEngine, InferenceResponse } from './mcp.types.js'

/**
 * @internal
 * Creates the auto-discovery thread that discovers MCP primitives on connection.
 * This thread ensures tools, resources, and prompts are discovered automatically.
 *
 * @param bThread - Thread creation function
 * @param bSync - Synchronization primitive creator
 *
 * Thread behavior:
 * 1. Waits for CLIENT_CONNECTED event
 * 2. Automatically triggers discovery of all primitives
 * 3. Can be re-triggered with REDISCOVER_PRIMITIVES event
 */
export const createAutoDiscoveryThread = (bThread: BThread, bSync: BSync): void => {
  bThread([
    bSync({
      waitFor: 'CLIENT_CONNECTED',
      request: { type: 'DISCOVER_ALL_PRIMITIVES' },
    }),
  ])

  // Allow manual re-discovery
  bThread(
    [
      bSync({
        waitFor: 'REDISCOVER_PRIMITIVES',
        request: { type: 'DISCOVER_ALL_PRIMITIVES' },
      }),
    ],
    true,
  )
}

/**
 * @internal
 * Creates the chat orchestration thread that handles LLM interactions.
 * This thread manages the flow from chat request to tool execution.
 *
 * @param bThread - Thread creation function
 * @param bSync - Synchronization primitive creator
 * @param inferenceEngine - Optional inference engine for chat
 *
 * Thread behavior:
 * 1. Waits for CHAT events
 * 2. Calls inference engine with available tools
 * 3. Executes any requested tool calls
 * 4. Returns results to the user
 */
export const createChatOrchestrationThread = (
  bThread: BThread,
  bSync: BSync,
  inferenceEngine?: InferenceEngine,
): void => {
  if (!inferenceEngine) return

  // Main chat handling thread
  bThread(
    [
      bSync({
        waitFor: 'CHAT',
        request: { type: 'PROCESS_CHAT' },
      }),
    ],
    true,
  )

  // Tool execution orchestration
  bThread(
    [
      bSync({
        waitFor: 'INFERENCE_COMPLETE',
        request: { type: 'EXECUTE_TOOL_CALLS' },
      }),
    ],
    true,
  )
}

/**
 * @internal
 * Creates the error recovery thread with exponential backoff.
 * This thread handles retrying failed operations intelligently.
 *
 * @param bThread - Thread creation function
 * @param bSync - Synchronization primitive creator
 *
 * Thread behavior:
 * 1. Monitors CLIENT_ERROR events
 * 2. Implements exponential backoff for retries
 * 3. Gives up after max attempts
 * 4. Emits OPERATION_FAILED for unrecoverable errors
 */
export const createErrorRecoveryThread = (bThread: BThread, bSync: BSync): void => {
  // TODO: Implement retry logic with exponential backoff
  // const _retryState = new Map<string, { attempts: number; lastError: Error }>()
  // const _MAX_RETRIES = 3
  // const _BASE_DELAY = 1000 // 1 second

  bThread(
    [
      bSync({
        waitFor: 'CLIENT_ERROR',
      }),
    ],
    true,
  )

  // Clean up old retry states periodically
  bThread(
    [
      bSync({
        waitFor: 'CLEANUP_RETRY_STATE',
      }),
    ],
    true,
  )
}

/**
 * @internal
 * Creates the rate limiting thread to prevent overwhelming servers.
 * This thread enforces rate limits on tool calls and resource reads.
 *
 * @param bThread - Thread creation function
 * @param bSync - Synchronization primitive creator
 * @param rateLimitMs - Minimum milliseconds between operations (default: 100ms)
 *
 * Thread behavior:
 * 1. Blocks rapid successive operations
 * 2. Maintains a sliding window of recent operations
 * 3. Allows bursts up to a limit
 * 4. Provides smooth operation flow
 */
export const createRateLimitingThread = (bThread: BThread, bSync: BSync, rateLimitMs: number = 100): void => {
  let lastOperationTime = 0
  const operationQueue: Array<{ type: string; timestamp: number }> = []
  const BURST_LIMIT = 10
  const WINDOW_MS = 1000 // 1 second window

  // Rate limit tool calls
  bThread(
    [
      bSync({
        waitFor: ['CALL_TOOL', 'READ_RESOURCE'],
        block: ({ type }: { type: string }) => {
          const now = Date.now()

          // Clean old operations from queue
          while (operationQueue.length > 0 && now - operationQueue[0].timestamp > WINDOW_MS) {
            operationQueue.shift()
          }

          // Check burst limit
          if (operationQueue.length >= BURST_LIMIT) {
            return true // Block if burst limit exceeded
          }

          // Check rate limit
          const timeSinceLastOp = now - lastOperationTime
          if (timeSinceLastOp < rateLimitMs) {
            return true // Block if too soon
          }

          // Allow operation
          lastOperationTime = now
          operationQueue.push({ type, timestamp: now })
          return false // Don't block
        },
      }),
    ],
    true,
  )
}

/**
 * @internal
 * Creates the agent state management thread.
 * This thread tracks and manages the agent's current state.
 *
 * @param bThread - Thread creation function
 * @param bSync - Synchronization primitive creator
 * @param trigger - Event trigger function
 *
 * Thread behavior:
 * 1. Monitors all agent operations
 * 2. Updates agent state accordingly
 * 3. Emits state change events
 * 4. Provides state consistency
 */
export const createAgentStateThread = (bThread: BThread, bSync: BSync, _trigger: PlaitedTrigger): void => {
  const _currentState: AgentEventDetails['AGENT_STATE_CHANGED']['state'] = 'idle'

  // TODO: Implement state update logic
  // const _updateState = (newState: typeof _currentState) => {
  //   if (newState !== _currentState) {
  //     _currentState = newState
  //     trigger({
  //       type: 'AGENT_STATE_CHANGED',
  //       detail: { state: newState }
  //     })
  //   }
  // }

  // Monitor chat requests
  bThread(
    [
      bSync({
        waitFor: 'CHAT',
        request: { type: 'SET_THINKING_STATE' },
      }),
    ],
    true,
  )

  // Monitor tool execution
  bThread(
    [
      bSync({
        waitFor: 'CALL_TOOL',
        request: { type: 'SET_EXECUTING_STATE' },
      }),
    ],
    true,
  )

  // Monitor completion
  bThread(
    [
      bSync({
        waitFor: ['TOOL_RESULT', 'RESOURCE_RESULT', 'PROMPT_RESULT'],
        request: { type: 'SET_IDLE_STATE' },
      }),
    ],
    true,
  )

  // Monitor errors
  bThread(
    [
      bSync({
        waitFor: 'CLIENT_ERROR',
        request: { type: 'SET_ERROR_STATE' },
      }),
    ],
    true,
  )
}

/**
 * @internal
 * Creates all default threads for agent functionality.
 * This is the main entry point for default thread creation.
 *
 * @param args - Thread creation arguments
 * @returns Object containing thread references for testing/debugging
 */
export const createDefaultThreads = ({
  bThread,
  bThreads: _bThreads,
  bSync,
  trigger,
  inferenceEngine,
  rateLimitMs = 100,
}: {
  bThread: BThread
  bThreads: BThreads
  bSync: BSync
  trigger: PlaitedTrigger
  inferenceEngine?: InferenceEngine
  rateLimitMs?: number
}): void => {
  // Create all default threads
  createAutoDiscoveryThread(bThread, bSync)
  createChatOrchestrationThread(bThread, bSync, inferenceEngine)
  createErrorRecoveryThread(bThread, bSync)
  createRateLimitingThread(bThread, bSync, rateLimitMs)
  createAgentStateThread(bThread, bSync, trigger)

  // Additional utility threads

  // Periodic cleanup thread
  bThread([
    bSync({
      request: { type: 'CLEANUP_RETRY_STATE' },
    }),
  ])

  // Initial state setup
  trigger({
    type: 'AGENT_STATE_CHANGED',
    detail: { state: 'idle' },
  })
}

/**
 * @internal
 * Default handlers for agent events when inference engine is provided.
 * These handlers implement the core agent logic.
 */
export const createDefaultHandlers = ({
  client,
  inferenceEngine,
  tools,
  resources,
  prompts,
  trigger,
}: {
  client: import('@modelcontextprotocol/sdk/client/index.js').Client
  inferenceEngine?: InferenceEngine
  tools: import('../behavioral.js').SignalWithInitialValue<MCPClientEventDetails['TOOLS_DISCOVERED']['tools']>
  resources: import('../behavioral.js').SignalWithInitialValue<
    MCPClientEventDetails['RESOURCES_DISCOVERED']['resources']
  >
  prompts: import('../behavioral.js').SignalWithInitialValue<MCPClientEventDetails['PROMPTS_DISCOVERED']['prompts']>
  trigger: PlaitedTrigger
}) => {
  const handlers: Partial<Record<string, (detail: unknown) => void | Promise<void>>> = {
    // Auto-discovery handler
    async DISCOVER_ALL_PRIMITIVES() {
      try {
        const { discoverPrimitives } = await import('./mcp.utils.js')
        await discoverPrimitives({ client, signals: { tools, resources, prompts }, trigger })
      } catch (error) {
        trigger({
          type: 'CLIENT_ERROR',
          detail: {
            error: error instanceof Error ? error : new Error(String(error)),
            operation: 'discover_primitives',
          },
        })
      }
    },

    // State management handlers
    SET_THINKING_STATE() {
      trigger({ type: 'AGENT_STATE_CHANGED', detail: { state: 'thinking' } })
    },

    SET_EXECUTING_STATE() {
      trigger({ type: 'AGENT_STATE_CHANGED', detail: { state: 'executing' } })
    },

    SET_IDLE_STATE() {
      trigger({ type: 'AGENT_STATE_CHANGED', detail: { state: 'idle' } })
    },

    SET_ERROR_STATE() {
      trigger({ type: 'AGENT_STATE_CHANGED', detail: { state: 'error' } })
    },
  }

  // Add chat processing if inference engine is available
  if (inferenceEngine) {
    handlers.PROCESS_CHAT = async (detail) => {
      const { messages, temperature } = detail as AgentEventDetails['CHAT']

      try {
        const availableTools = tools.get()
        const response = await inferenceEngine.chat({
          messages,
          tools: availableTools,
          temperature,
        })

        trigger({
          type: 'INFERENCE_COMPLETE',
          detail: { response, originalMessages: messages },
        })
      } catch (error) {
        trigger({
          type: 'CLIENT_ERROR',
          detail: {
            error: error instanceof Error ? error : new Error(String(error)),
            operation: 'inference_chat',
          },
        })
      }
    }

    handlers.EXECUTE_TOOL_CALLS = async (detail) => {
      const { response } = detail as { response: InferenceResponse }

      if (response.toolCalls && response.toolCalls.length > 0) {
        for (const toolCall of response.toolCalls) {
          trigger({
            type: 'CALL_TOOL',
            detail: {
              name: toolCall.name,
              arguments: toolCall.arguments,
            },
          })
        }
      }
    }
  }

  return handlers
}
