/**
 * A2A Server Adapter.
 * Presents a world agent as an A2A-compliant agent.
 *
 * @remarks
 * Uses useBehavioral to coordinate A2A protocol handling with the
 * underlying world agent. The server exposes:
 * - GET /.well-known/agent.json - Agent Card
 * - POST / - JSON-RPC 2.0 endpoint for tasks
 *
 * No external dependencies - uses Bun.serve for HTTP.
 */

import { useBehavioral } from '../main/use-behavioral.ts'
import type {
  A2AAdapterConfig,
  A2ALogger,
  A2AMessage,
  A2ATask,
  AgentCard,
  Artifact,
  JsonRpcErrorResponse,
  JsonRpcRequest,
  JsonRpcSuccessResponse,
  Part,
  TaskCancelParams,
  TaskGetParams,
  TaskSendParams,
  TaskState,
  TextPart,
} from './a2a.types.ts'

import type { AgentContext } from './agent.types.ts'

// ============================================================================
// Noop Logger
// ============================================================================

/** Default no-op logger */
const noopLogger: A2ALogger = {
  info: () => {},
  error: () => {},
}

// ============================================================================
// A2A Server Event Types
// ============================================================================

/**
 * Event types for the A2A server behavioral program.
 */
type A2AServerEvents = {
  /** Incoming task request */
  taskReceived: { taskId: string; message: A2AMessage }
  /** Task state changed */
  taskStateChanged: { taskId: string; state: TaskState; message?: A2AMessage }
  /** Artifact produced */
  artifactProduced: { taskId: string; artifact: Artifact }
  /** Task completed */
  taskCompleted: { taskId: string; artifacts: Artifact[] }
  /** Task failed */
  taskFailed: { taskId: string; error: string }
  /** Task canceled */
  taskCanceled: { taskId: string }
}

/**
 * Context for A2A server.
 */
type A2AServerContext = AgentContext & {
  /** Agent card configuration */
  card: AgentCard
}

// ============================================================================
// Task Store
// ============================================================================

/**
 * In-memory task storage.
 * For production, replace with persistent storage.
 */
const createTaskStore = () => {
  const tasks = new Map<string, A2ATask>()

  return {
    get: (id: string) => tasks.get(id),

    create: (id: string, message: A2AMessage): A2ATask => {
      const task: A2ATask = {
        id,
        state: 'submitted',
        messages: [message],
        artifacts: [],
      }
      tasks.set(id, task)
      return task
    },

    updateState: (id: string, state: TaskState, message?: A2AMessage) => {
      const task = tasks.get(id)
      if (task) {
        task.state = state
        if (message) task.messages.push(message)
      }
      return task
    },

    addArtifact: (id: string, artifact: Artifact) => {
      const task = tasks.get(id)
      if (task) {
        task.artifacts.push(artifact)
      }
      return task
    },

    delete: (id: string) => tasks.delete(id),
  }
}

// ============================================================================
// Message Conversion
// ============================================================================

/**
 * Extract text content from A2A message parts.
 */
const extractTextFromParts = (parts: Part[]): string => {
  return parts
    .filter((p): p is TextPart => p.type === 'text')
    .map((p) => p.text)
    .join('\n')
}

/**
 * Create A2A message from text.
 */
const createAgentMessage = (text: string): A2AMessage => ({
  role: 'agent',
  parts: [{ type: 'text', text }],
})

// ============================================================================
// JSON-RPC Helpers
// ============================================================================

const jsonRpcSuccess = (id: string | number, result: unknown): JsonRpcSuccessResponse => ({
  jsonrpc: '2.0',
  id,
  result,
})

const jsonRpcError = (
  id: string | number | null,
  code: number,
  message: string,
  data?: unknown,
): JsonRpcErrorResponse => ({
  jsonrpc: '2.0',
  id,
  error: { code, message, data },
})

// Standard JSON-RPC error codes
const PARSE_ERROR = -32700
const INVALID_REQUEST = -32600
const METHOD_NOT_FOUND = -32601
const _INVALID_PARAMS = -32602
const INTERNAL_ERROR = -32603

// A2A-specific error codes
const TASK_NOT_FOUND = -32001
const TASK_NOT_CANCELABLE = -32002

// ============================================================================
// A2A Server Factory
// ============================================================================

/**
 * Creates an A2A server behavioral program.
 *
 * @param config - Server configuration including agent card
 * @returns Async function that starts the server
 *
 * @remarks
 * The server uses useBehavioral to coordinate:
 * - Incoming HTTP requests → events
 * - Task lifecycle management
 * - World agent delegation
 *
 * **Endpoints:**
 * - `GET /.well-known/agent.json` - Returns Agent Card
 * - `POST /` - JSON-RPC 2.0 for task operations
 *
 * **JSON-RPC Methods:**
 * - `tasks/send` - Create or continue a task
 * - `tasks/get` - Get task status and history
 * - `tasks/cancel` - Cancel a running task
 */
export const useA2AServer = ({ card, port = 3001, basePath = '', logger = noopLogger }: A2AAdapterConfig) => {
  const taskStore = createTaskStore()

  return useBehavioral<A2AServerEvents, A2AServerContext>({
    publicEvents: ['taskReceived', 'taskCompleted', 'taskFailed'],

    async bProgram({ trigger, bThreads, bSync, bThread, tools, model }) {
      // Coordinate task lifecycle
      bThreads.set({
        /**
         * Track task state transitions.
         * Ensures proper lifecycle: submitted → working → completed/failed
         */
        taskLifecycle: bThread(
          [
            bSync({ waitFor: 'taskReceived' }),
            bSync({
              waitFor: ({ type }) => type === 'taskCompleted' || type === 'taskFailed' || type === 'taskCanceled',
            }),
          ],
          true,
        ),

        /**
         * Block invalid state transitions.
         */
        blockInvalidTransitions: bThread(
          [
            bSync({
              block: ({ type, detail }) => {
                if (type !== 'taskStateChanged') return false
                const task = taskStore.get(detail.taskId)
                if (!task) return true // Block if task doesn't exist

                // Block transitions from terminal states
                const terminalStates: TaskState[] = ['completed', 'failed', 'canceled']
                return terminalStates.includes(task.state)
              },
            }),
          ],
          true,
        ),
      })

      // JSON-RPC method handlers
      const handleTaskSend = async (params: TaskSendParams) => {
        const { id, message } = params

        // Get or create task
        let task = taskStore.get(id)
        if (task) {
          task.messages.push(message)
        } else {
          task = taskStore.create(id, message)
          trigger({ type: 'taskReceived', detail: { taskId: id, message } })
        }

        // Update to working state
        taskStore.updateState(id, 'working')
        trigger({
          type: 'taskStateChanged',
          detail: { taskId: id, state: 'working' },
        })

        // Extract intent and call model
        const intent = extractTextFromParts(message.parts)

        try {
          const response = await model.chatCompletion({
            messages: [{ role: 'user', content: intent }],
            tools: tools.schemas,
          })

          // Execute tool calls
          const artifacts: Artifact[] = []
          if (response.tool_calls) {
            for (const call of response.tool_calls) {
              const result = await tools.execute(call)
              if (result.success && result.data) {
                artifacts.push({
                  name: call.name,
                  parts: [{ type: 'data', data: result.data as Record<string, unknown> }],
                })
              }
            }
          }

          // Complete task
          taskStore.updateState(id, 'completed', createAgentMessage('Task completed successfully'))
          for (const artifact of artifacts) {
            taskStore.addArtifact(id, artifact)
          }

          trigger({ type: 'taskCompleted', detail: { taskId: id, artifacts } })

          return taskStore.get(id)
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          taskStore.updateState(id, 'failed', createAgentMessage(`Error: ${errorMessage}`))
          trigger({ type: 'taskFailed', detail: { taskId: id, error: errorMessage } })

          return taskStore.get(id)
        }
      }

      const handleTaskGet = (params: TaskGetParams) => {
        const task = taskStore.get(params.id)
        if (!task) {
          throw { code: TASK_NOT_FOUND, message: 'Task not found' }
        }

        // Apply history length limit if specified
        if (params.historyLength !== undefined) {
          return {
            ...task,
            messages: task.messages.slice(-params.historyLength),
          }
        }

        return task
      }

      const handleTaskCancel = (params: TaskCancelParams) => {
        const task = taskStore.get(params.id)
        if (!task) {
          throw { code: TASK_NOT_FOUND, message: 'Task not found' }
        }

        const cancelableStates: TaskState[] = ['submitted', 'working', 'input-required']
        if (!cancelableStates.includes(task.state)) {
          throw { code: TASK_NOT_CANCELABLE, message: 'Task cannot be canceled' }
        }

        taskStore.updateState(params.id, 'canceled')
        trigger({ type: 'taskCanceled', detail: { taskId: params.id } })

        return taskStore.get(params.id)
      }

      // Handle JSON-RPC request
      const handleJsonRpc = async (request: JsonRpcRequest) => {
        try {
          switch (request.method) {
            case 'tasks/send':
              return jsonRpcSuccess(request.id, await handleTaskSend(request.params as TaskSendParams))

            case 'tasks/get':
              return jsonRpcSuccess(request.id, handleTaskGet(request.params as TaskGetParams))

            case 'tasks/cancel':
              return jsonRpcSuccess(request.id, handleTaskCancel(request.params as TaskCancelParams))

            default:
              return jsonRpcError(request.id, METHOD_NOT_FOUND, `Method not found: ${request.method}`)
          }
        } catch (error) {
          if (error && typeof error === 'object' && 'code' in error && 'message' in error) {
            return jsonRpcError(request.id, error.code as number, error.message as string)
          }
          return jsonRpcError(request.id, INTERNAL_ERROR, error instanceof Error ? error.message : 'Internal error')
        }
      }

      // Start HTTP server
      Bun.serve({
        port,
        async fetch(req) {
          const url = new URL(req.url)
          const path = url.pathname.replace(basePath, '')

          // CORS headers
          const corsHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          }

          // Handle preflight
          if (req.method === 'OPTIONS') {
            return new Response(null, { status: 204, headers: corsHeaders })
          }

          // Agent Card endpoint
          if (path === '/.well-known/agent.json' && req.method === 'GET') {
            return Response.json(card, { headers: corsHeaders })
          }

          // JSON-RPC endpoint
          if (path === '/' && req.method === 'POST') {
            try {
              const body = await req.json()

              // Validate JSON-RPC structure
              if (!body.jsonrpc || body.jsonrpc !== '2.0' || !body.method) {
                return Response.json(jsonRpcError(body.id ?? null, INVALID_REQUEST, 'Invalid JSON-RPC request'), {
                  headers: corsHeaders,
                })
              }

              const response = await handleJsonRpc(body as JsonRpcRequest)
              return Response.json(response, { headers: corsHeaders })
            } catch {
              return Response.json(jsonRpcError(null, PARSE_ERROR, 'Parse error'), {
                headers: corsHeaders,
              })
            }
          }

          return new Response('Not Found', { status: 404, headers: corsHeaders })
        },
      })

      logger.info(`A2A Server running at http://localhost:${port}`)
      logger.info(`Agent Card: http://localhost:${port}/.well-known/agent.json`)

      // Return handlers (mostly for internal coordination)
      return {
        taskReceived({ taskId }) {
          logger.info(`Task received: ${taskId}`)
        },

        taskStateChanged({ taskId, state }) {
          logger.info(`Task ${taskId}: ${state}`)
        },

        artifactProduced({ taskId, artifact }) {
          logger.info(`Task ${taskId} produced artifact: ${artifact.name}`)
        },

        taskCompleted({ taskId }) {
          logger.info(`Task ${taskId} completed`)
        },

        taskFailed({ taskId, error }) {
          logger.error(`Task ${taskId} failed: ${error}`)
        },

        taskCanceled({ taskId }) {
          logger.info(`Task ${taskId} canceled`)
        },
      }
    },
  })
}

/**
 * Helper to create an Agent Card for the world agent.
 */
export const createAgentCard = ({
  name,
  description,
  url,
  skills,
}: {
  name: string
  description: string
  url: string
  skills: Array<{ id: string; name: string; description: string }>
}): AgentCard => ({
  name,
  description,
  url,
  version: '1.0',
  skills: skills.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
  })),
  defaultInputModes: ['text/plain'],
  defaultOutputModes: ['text/plain', 'application/json'],
})
