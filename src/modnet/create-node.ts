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
import { createA2AHandler } from '../a2a/create-a2a-handler.ts'
import type { A2AOperationHandlers } from '../a2a/a2a.types.ts'
import { AGENT_EVENTS } from '../agent/agent.constants.ts'
import { createAgentLoop } from '../agent/create-agent-loop.ts'
import type { MessageDetail } from '../agent/agent.types.ts'
import { UI_ADAPTER_LIFECYCLE_EVENTS } from '../events.ts'
import { createServer } from '../server/server.ts'
import type { ServerHandle } from '../server/server.types.ts'
import type { CreateNodeOptions, NodeHandle } from './modnet.types.ts'

type ProactivePushHandlers = {
  [UI_ADAPTER_LIFECYCLE_EVENTS.client_connected]: (detail: unknown) => void
  [UI_ADAPTER_LIFECYCLE_EVENTS.client_disconnected]: (detail: unknown) => void
  [AGENT_EVENTS.message]: (detail: unknown) => void
}

/**
 * Creates the event handlers that fan proactive agent messages out to every
 * currently connected UI session.
 *
 * @internal
 */
export const createProactivePushHandlers = (server: Pick<ServerHandle, 'send'>): ProactivePushHandlers => {
  const activeSessionIds = new Set<string>()

  return {
    [UI_ADAPTER_LIFECYCLE_EVENTS.client_connected](detail: unknown) {
      activeSessionIds.add((detail as { sessionId: string }).sessionId)
    },
    [UI_ADAPTER_LIFECYCLE_EVENTS.client_disconnected](detail: unknown) {
      activeSessionIds.delete((detail as { sessionId: string }).sessionId)
    },
    [AGENT_EVENTS.message](detail: unknown) {
      const msg = detail as MessageDetail
      if (msg.source !== 'proactive') return

      const payload = JSON.stringify({ type: 'notification', content: msg.content })
      for (const sessionId of activeSessionIds) {
        server.send(sessionId, payload)
      }
    },
  }
}

const connectVirtualSession = (agent: Pick<NodeHandle['agent'], 'trigger'>, sessionId: string) => {
  agent.trigger({
    type: UI_ADAPTER_LIFECYCLE_EVENTS.client_connected,
    detail: { sessionId, source: 'a2a', isReconnect: false },
  })
}

const disconnectVirtualSession = (
  agent: Pick<NodeHandle['agent'], 'trigger'>,
  sessionId: string,
  detail: { code: number; reason: string },
) => {
  agent.trigger({
    type: UI_ADAPTER_LIFECYCLE_EVENTS.client_disconnected,
    detail: { sessionId, ...detail },
  })
}

const extractPrompt = (message: { parts: Array<{ kind: string }> }) => {
  const textPart = message.parts.find((part) => part.kind === 'text')
  return textPart && 'text' in textPart ? textPart.text : ''
}

const createCompletedTask = ({
  taskId,
  contextId,
  content,
}: {
  taskId: string
  contextId: string | undefined
  content: string
}) =>
  ({
    kind: 'task',
    id: taskId,
    contextId,
    status: { state: TASK_STATE.completed },
    artifacts: [
      {
        artifactId: crypto.randomUUID(),
        parts: [{ kind: 'text' as const, text: content }],
      },
    ],
  }) satisfies Task

const createFailedTask = ({
  taskId,
  contextId,
  error,
}: {
  taskId: string
  contextId: string | undefined
  error: unknown
}) =>
  ({
    kind: 'task',
    id: taskId,
    contextId,
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
  }) satisfies Task

const waitForAgentMessage = ({
  agent,
  signal,
}: {
  agent: Pick<NodeHandle['agent'], 'subscribe'>
  signal: AbortSignal
}) =>
  new Promise<string>((resolve, reject) => {
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
  proactive,
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
    ...(proactive && { proactive }),
  })

  // ── A2A handler (optional — only when agentCard is provided) ────────────
  let a2aHandler: ReturnType<typeof createA2AHandler> | undefined

  if (agentCard) {
    const handlers: A2AOperationHandlers = {
      async sendMessage(params, signal) {
        const taskId = crypto.randomUUID()
        const sessionId = `a2a:${taskId}`
        const prompt = extractPrompt(params.message)
        const messagePromise = waitForAgentMessage({ agent, signal })

        connectVirtualSession(agent, sessionId)
        agent.trigger({ type: AGENT_EVENTS.task, detail: { prompt } })

        try {
          const content = await messagePromise

          disconnectVirtualSession(agent, sessionId, { code: 1000, reason: 'A2A task complete' })
          return createCompletedTask({ taskId, contextId: params.message.contextId, content })
        } catch (error) {
          disconnectVirtualSession(agent, sessionId, { code: 1011, reason: 'A2A task failed' })
          return createFailedTask({ taskId, contextId: params.message.contextId, error })
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

  // ── Proactive push routing ───────────────────────────────────────────────
  // Track active session for routing proactive messages to WebSocket clients
  const pushDisconnect = agent.subscribe(createProactivePushHandlers(server))

  // ── Destroy ─────────────────────────────────────────────────────────────
  const destroy = () => {
    pushDisconnect()
    server.stop(true)
    agent.destroy()
  }

  return {
    agent,
    server,
    ...(a2aHandler && { a2a: a2aHandler }),
    ...(agent.heartbeat && { heartbeat: agent.heartbeat }),
    destroy,
  }
}
