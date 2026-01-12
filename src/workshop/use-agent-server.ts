/**
 * @internal
 * Agent server for workshop integration.
 * Provides IPC communication between the agent and workshop test runner.
 */

import type { FunctionCall, StoryResult, ToolRegistry, ToolResult } from '../agent/agent.types.ts'
import { createContextBudget } from '../agent/context-budget.ts'
import { createToolRegistry } from '../agent/tools.ts'
import { registerWorkflowConstraints } from '../agent/workflow-constraints.ts'
import { useBehavioral } from '../main.ts'

/**
 * @internal
 * Agent server event types for workshop integration.
 */
type AgentServerEvents = {
  /** Generate UI from an intent */
  generate: { intent: string }
  /** Tool execution request */
  toolCall: { calls: FunctionCall[] }
  /** Tool execution result */
  toolResult: { name: string; result: ToolResult }
  /** Story execution result from test runner */
  storyResult: StoryResult
  /** Server shutdown */
  shutdown: undefined
}

/**
 * @internal
 * Agent server context configuration.
 */
type AgentServerContext = {
  /** Output directory for generated files */
  outputDir: string
  /** Port for WebSocket communication */
  port?: number
  /** Story runner function */
  runStory?: (path: string) => Promise<StoryResult>
  /** Custom tool registry (optional) */
  tools?: ToolRegistry
}

/**
 * @internal
 * Message format for IPC communication.
 */
type IPCMessage = {
  type: string
  payload: unknown
}

/**
 * Creates an agent server for workshop integration.
 * Bridges the world agent with the workshop test runner via WebSocket IPC.
 *
 * @param outputDir - Directory for generated template files
 * @param port - WebSocket server port (default: 3100)
 * @param runStory - Function to execute story tests
 * @param tools - Optional custom tool registry
 *
 * @returns Trigger function for sending events to the agent
 *
 * @remarks
 * The agent server:
 * - Listens for generation requests from the workshop
 * - Executes tool calls and reports results
 * - Integrates with story runner for validation feedback
 * - Uses bThread constraints for blocking invalid generations
 */
export const useAgentServer = useBehavioral<AgentServerEvents, AgentServerContext>({
  publicEvents: ['generate', 'storyResult', 'shutdown'],

  async bProgram({ trigger, bThreads, bSync, bThread, outputDir, port = 3100, runStory, tools: customTools }) {
    // Initialize tool registry
    const tools = customTools ?? createToolRegistry()

    // Register default tools if not provided
    if (!customTools) {
      tools.register(
        'writeTemplate',
        async (args) => {
          const { path, content } = args as { path: string; content: string }
          const fullPath = `${outputDir}/${path}`

          try {
            await Bun.write(fullPath, content)
            return { success: true, data: { path: fullPath } }
          } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : String(error) }
          }
        },
        {
          name: 'writeTemplate',
          description: 'Write a JSX template file',
          parameters: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'Relative file path' },
              content: { type: 'string', description: 'Template content' },
            },
            required: ['path', 'content'],
          },
        },
      )

      tools.register(
        'writeStory',
        async (args) => {
          const { path, content } = args as { path: string; content: string }
          const fullPath = `${outputDir}/${path}`

          try {
            await Bun.write(fullPath, content)
            return { success: true, data: { path: fullPath } }
          } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : String(error) }
          }
        },
        {
          name: 'writeStory',
          description: 'Write a story file for testing',
          parameters: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'Relative file path' },
              content: { type: 'string', description: 'Story content' },
            },
            required: ['path', 'content'],
          },
        },
      )

      if (runStory) {
        tools.register(
          'runStory',
          async (args) => {
            const { path } = args as { path: string }

            try {
              const result = await runStory(path)
              trigger({ type: 'storyResult', detail: result })
              return { success: true, data: result }
            } catch (error) {
              return { success: false, error: error instanceof Error ? error.message : String(error) }
            }
          },
          {
            name: 'runStory',
            description: 'Execute a story file and return test results',
            parameters: {
              type: 'object',
              properties: {
                path: { type: 'string', description: 'Path to story file' },
              },
              required: ['path'],
            },
          },
        )
      }
    }

    // Register workflow constraints
    const contextBudget = createContextBudget()
    registerWorkflowConstraints(bThreads, bSync, bThread, { contextBudget })

    // Track connected clients
    const clients = new Set<WebSocket>()

    // Start WebSocket server
    const server = Bun.serve({
      port,
      fetch(req, server) {
        // Upgrade to WebSocket
        if (server.upgrade(req)) {
          return
        }
        return new Response('Agent server running', { status: 200 })
      },
      websocket: {
        open(ws) {
          clients.add(ws as unknown as WebSocket)
          console.log(`[agent-server] Client connected (${clients.size} total)`)
        },
        message(_ws, message) {
          try {
            const data = JSON.parse(message.toString()) as IPCMessage

            // Forward to trigger
            if (data.type === 'generate') {
              trigger({ type: 'generate', detail: data.payload as { intent: string } })
            }
          } catch (error) {
            console.error('[agent-server] Invalid message:', error)
          }
        },
        close(ws) {
          clients.delete(ws as unknown as WebSocket)
          console.log(`[agent-server] Client disconnected (${clients.size} remaining)`)
        },
      },
    })

    console.log(`[agent-server] Listening on ws://localhost:${port}`)

    // Broadcast helper
    const broadcast = (type: string, payload: unknown) => {
      const message = JSON.stringify({ type, payload })
      for (const client of clients) {
        ;(client as unknown as { send: (msg: string) => void }).send(message)
      }
    }

    return {
      async generate({ intent }) {
        console.log(`[agent-server] Generate request: ${intent}`)
        broadcast('generating', { intent })

        // In production, this would call the ML model
        // For now, emit a placeholder toolCall
        broadcast('status', { message: 'Agent would call model here' })
      },

      async toolCall({ calls }) {
        for (const call of calls) {
          console.log(`[agent-server] Executing tool: ${call.name}`)
          const result = await tools.execute(call)
          trigger({ type: 'toolResult', detail: { name: call.name, result } })
        }
      },

      toolResult({ name, result }) {
        console.log(`[agent-server] Tool result: ${name} -> ${result.success ? 'success' : 'failed'}`)
        broadcast('toolResult', { name, result })
      },

      storyResult(result) {
        console.log(`[agent-server] Story result: ${result.passed ? 'passed' : 'failed'}`)
        broadcast('storyResult', result)
      },

      async shutdown() {
        console.log('[agent-server] Shutting down...')
        server.stop()
        clients.clear()
      },
    }
  },
})
