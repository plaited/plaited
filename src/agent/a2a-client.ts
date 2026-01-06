/**
 * A2A Client Adapter.
 * Consumes external A2A-compliant agents.
 *
 * @remarks
 * Provides a simple interface to interact with A2A agents.
 * Uses native fetch for HTTP requests - no external dependencies.
 *
 * The client can be used to:
 * - Discover agent capabilities via Agent Card
 * - Send tasks and receive responses
 * - Cancel running tasks
 * - Poll for task status
 */

import type {
  A2AClientConfig,
  A2AMessage,
  A2ATask,
  AgentCard,
  JsonRpcRequest,
  JsonRpcResponse,
  Part,
  TaskCancelParams,
  TaskGetParams,
  TaskSendParams,
  TextPart,
} from './a2a.types.ts'

// ============================================================================
// A2A Client
// ============================================================================

/**
 * Creates an A2A client for interacting with external agents.
 *
 * @param config - Client configuration
 * @returns Object with methods to interact with the A2A agent
 *
 * @remarks
 * The client handles:
 * - Agent Card discovery
 * - JSON-RPC request/response
 * - Error handling and timeouts
 *
 * **Usage Pattern:**
 * ```typescript
 * const client = createA2AClient({ agentUrl: 'https://agent.example.com' })
 *
 * // Discover capabilities
 * const card = await client.getAgentCard()
 *
 * // Send a task
 * const task = await client.sendTask({
 *   id: 'task-1',
 *   message: { role: 'user', parts: [{ type: 'text', text: 'Generate a button' }] }
 * })
 *
 * // Poll for completion
 * const result = await client.getTask({ id: 'task-1' })
 * ```
 */
export const createA2AClient = (config: A2AClientConfig) => {
  const { agentUrl, authToken, timeout = 30000 } = config

  // Normalize URL
  const baseUrl = agentUrl.endsWith('/') ? agentUrl.slice(0, -1) : agentUrl

  /**
   * Make a JSON-RPC request to the agent.
   */
  const rpcCall = async <T>(method: string, params?: Record<string, unknown>): Promise<T> => {
    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      id: crypto.randomUUID(),
      method,
      params,
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    try {
      const response = await fetch(baseUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(request),
        signal: controller.signal,
      })

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status} ${response.statusText}`)
      }

      const result = (await response.json()) as JsonRpcResponse

      if ('error' in result) {
        throw new A2AError(result.error.code, result.error.message, result.error.data)
      }

      return result.result as T
    } finally {
      clearTimeout(timeoutId)
    }
  }

  return {
    /**
     * Fetch the Agent Card from the well-known endpoint.
     */
    async getAgentCard(): Promise<AgentCard> {
      const headers: Record<string, string> = {}
      if (authToken) {
        headers.Authorization = `Bearer ${authToken}`
      }

      const response = await fetch(`${baseUrl}/.well-known/agent.json`, { headers })

      if (!response.ok) {
        throw new Error(`Failed to fetch agent card: ${response.status}`)
      }

      return response.json()
    },

    /**
     * Send a task to the agent.
     *
     * @param params - Task send parameters
     * @returns The created or updated task
     */
    async sendTask(params: TaskSendParams): Promise<A2ATask> {
      return rpcCall<A2ATask>('tasks/send', params as unknown as Record<string, unknown>)
    },

    /**
     * Get task status and history.
     *
     * @param params - Task get parameters
     * @returns The task with current state
     */
    async getTask(params: TaskGetParams): Promise<A2ATask> {
      return rpcCall<A2ATask>('tasks/get', params as unknown as Record<string, unknown>)
    },

    /**
     * Cancel a running task.
     *
     * @param params - Task cancel parameters
     * @returns The canceled task
     */
    async cancelTask(params: TaskCancelParams): Promise<A2ATask> {
      return rpcCall<A2ATask>('tasks/cancel', params as unknown as Record<string, unknown>)
    },

    /**
     * Send a simple text message and wait for completion.
     * Convenience method that handles polling.
     *
     * @param text - Message text
     * @param options - Optional task ID and poll interval
     * @returns Completed task with artifacts
     */
    async sendMessage(
      text: string,
      options?: { taskId?: string; pollInterval?: number; maxWait?: number },
    ): Promise<A2ATask> {
      const taskId = options?.taskId ?? crypto.randomUUID()
      const pollInterval = options?.pollInterval ?? 1000
      const maxWait = options?.maxWait ?? 60000

      const message: A2AMessage = {
        role: 'user',
        parts: [{ type: 'text', text }],
      }

      // Send initial message
      let task = await this.sendTask({ id: taskId, message })

      // Poll for completion
      const startTime = Date.now()
      while (!isTerminalState(task.state)) {
        if (Date.now() - startTime > maxWait) {
          throw new Error(`Task ${taskId} timed out after ${maxWait}ms`)
        }

        await sleep(pollInterval)
        task = await this.getTask({ id: taskId })
      }

      return task
    },

    /**
     * Get the base URL for this client.
     */
    get url(): string {
      return baseUrl
    },
  }
}

// ============================================================================
// Helper Types and Functions
// ============================================================================

/**
 * Custom error class for A2A protocol errors.
 */
export class A2AError extends Error {
  constructor(
    public readonly code: number,
    message: string,
    public readonly data?: unknown,
  ) {
    super(message)
    this.name = 'A2AError'
  }
}

/**
 * Check if a task state is terminal.
 */
const isTerminalState = (state: string): boolean => {
  return ['completed', 'failed', 'canceled'].includes(state)
}

/**
 * Sleep helper.
 */
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Extract text from A2A message parts.
 */
export const extractText = (parts: Part[]): string => {
  return parts
    .filter((p): p is TextPart => p.type === 'text')
    .map((p) => p.text)
    .join('\n')
}

/**
 * Create a text message.
 */
export const createTextMessage = (text: string, role: 'user' | 'agent' = 'user'): A2AMessage => ({
  role,
  parts: [{ type: 'text', text }],
})

// ============================================================================
// Agent Discovery
// ============================================================================

/**
 * Discover an A2A agent from a URL.
 * Fetches the Agent Card and creates a client.
 *
 * @param url - Agent URL or domain
 * @returns Object with agent card and client
 */
export const discoverAgent = async (
  url: string,
): Promise<{
  card: AgentCard
  client: ReturnType<typeof createA2AClient>
}> => {
  // Normalize URL
  let agentUrl = url
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    agentUrl = `https://${url}`
  }

  const client = createA2AClient({ agentUrl })
  const card = await client.getAgentCard()

  return { card, client }
}

/**
 * Create A2A client type for external use.
 */
export type A2AClient = ReturnType<typeof createA2AClient>
