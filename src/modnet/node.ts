/**
 * createNode — composes server + agent loop + A2A into a running modnet node.
 *
 * @remarks
 * This is the integration point between the three pillars:
 * - `createAgentLoop()` — BP-orchestrated 6-step pipeline
 * - `createServer()` — thin I/O server with WebSocket, replay buffer, CSP
 * - `createA2AHandler()` — JSON-RPC A2A protocol binding
 *
 * The A2A bridge converts A2A `sendMessage` calls into agent pipeline events:
 * `client_connected` → `task` → (pipeline runs) → `message` → `client_disconnected`
 *
 * @public
 */

import { TASK_STATE } from '../a2a/a2a.constants.ts'
import type { Task } from '../a2a/a2a.schemas.ts'
import { createA2AHandler } from '../a2a/a2a.server.ts'
import type { A2AOperationHandlers } from '../a2a/a2a.types.ts'
import { AGENT_EVENTS } from '../agent/agent.constants.ts'
import { createAgentLoop } from '../agent/agent.loop.ts'
import type { MessageDetail } from '../agent/agent.types.ts'
import { UI_ADAPTER_LIFECYCLE_EVENTS } from '../events.ts'
import { createServer } from '../server/server.ts'
import type { CreateNodeOptions, NodeHandle } from './node.types.ts'

/**
 * Creates a running modnet node: agent loop + HTTP/WS server + optional A2A.
 *
 * @param options - Node configuration
 * @returns {@link NodeHandle} with agent, server, optional a2a, and destroy
 *
 * @public
 */
export const createNode = async ({
  model,
  tools,
  toolExecutor,
  constitution,
  goals,
  memoryPath,
  port = 0,
  tls,
  allowedOrigins,
  validateSession = () => true,
  agentCard,
  a2aAuthenticate,
  systemPrompt,
  embedder,
  maxIterations,
}: CreateNodeOptions): Promise<NodeHandle> => {
  // ── Agent loop ──────────────────────────────────────────────────────────
  const agent = await createAgentLoop({
    model,
    tools,
    toolExecutor,
    constitution,
    goals,
    memoryPath,
    ...(systemPrompt && { systemPrompt }),
    ...(embedder && { embedder }),
    ...(maxIterations && { maxIterations }),
  })

  // ── A2A handler (optional — only when agentCard is provided) ────────────
  let a2aHandler: ReturnType<typeof createA2AHandler> | undefined

  if (agentCard) {
    const handlers: A2AOperationHandlers = {
      async sendMessage(params, signal) {
        const taskId = crypto.randomUUID()
        const sessionId = `a2a:${taskId}`

        // Extract text from the first text part of the message
        const textPart = params.message.parts.find((p) => p.kind === 'text')
        const prompt = textPart && 'text' in textPart ? textPart.text : ''

        // Subscribe for the message response before triggering
        const messagePromise = new Promise<string>((resolve, reject) => {
          const timeout = setTimeout(() => {
            disconnect()
            reject(new Error('A2A task timed out'))
          }, 120_000)

          signal.addEventListener(
            'abort',
            () => {
              clearTimeout(timeout)
              disconnect()
              reject(new Error('A2A task aborted'))
            },
            { once: true },
          )

          const disconnect = agent.subscribe({
            [AGENT_EVENTS.message](detail: unknown) {
              clearTimeout(timeout)
              disconnect()
              resolve((detail as MessageDetail).content)
            },
          })
        })

        // Unlock session gate → trigger task → await response
        agent.trigger({
          type: UI_ADAPTER_LIFECYCLE_EVENTS.client_connected,
          detail: { sessionId, source: 'a2a', isReconnect: false },
        })
        agent.trigger({ type: AGENT_EVENTS.task, detail: { prompt } })

        try {
          const content = await messagePromise

          // Clean up: disconnect the virtual session
          agent.trigger({
            type: UI_ADAPTER_LIFECYCLE_EVENTS.client_disconnected,
            detail: { sessionId, code: 1000, reason: 'A2A task complete' },
          })

          return {
            kind: 'task',
            id: taskId,
            contextId: params.message.contextId,
            status: { state: TASK_STATE.completed },
            artifacts: [
              {
                artifactId: crypto.randomUUID(),
                parts: [{ kind: 'text' as const, text: content }],
              },
            ],
          } satisfies Task
        } catch (error) {
          agent.trigger({
            type: UI_ADAPTER_LIFECYCLE_EVENTS.client_disconnected,
            detail: { sessionId, code: 1011, reason: 'A2A task failed' },
          })

          return {
            kind: 'task',
            id: taskId,
            contextId: params.message.contextId,
            status: {
              state: TASK_STATE.failed,
              message: {
                kind: 'message',
                messageId: crypto.randomUUID(),
                role: 'agent',
                parts: [
                  {
                    kind: 'text' as const,
                    text: error instanceof Error ? error.message : String(error),
                  },
                ],
              },
            },
          } satisfies Task
        }
      },
    }

    a2aHandler = createA2AHandler({
      card: agentCard,
      handlers,
      authenticate: a2aAuthenticate,
    })
  }

  // ── Server ──────────────────────────────────────────────────────────────
  const server = createServer({
    trigger: agent.trigger,
    routes: { ...(a2aHandler?.routes ?? {}) },
    port,
    tls,
    allowedOrigins,
    validateSession,
  })

  // ── Destroy ─────────────────────────────────────────────────────────────
  const destroy = () => {
    server.stop(true)
    agent.destroy()
  }

  return {
    agent,
    server,
    ...(a2aHandler && { a2a: a2aHandler }),
    destroy,
  }
}
