import type {
  Agent,
  AgentSideConnection,
  AuthenticateRequest,
  AuthenticateResponse,
  CancelNotification,
  InitializeRequest,
  InitializeResponse,
  LoadSessionRequest,
  LoadSessionResponse,
  NewSessionRequest,
  NewSessionResponse,
  PromptRequest,
  PromptResponse,
  SessionNotification,
  ToolKind,
} from '@agentclientprotocol/sdk'
import { PROTOCOL_VERSION } from '@agentclientprotocol/sdk'

import type { Disconnect } from '../behavioral/behavioral.types.ts'
import { AGENT_EVENTS, RISK_TAG } from './agent.constants.ts'
import type { AgentNode } from './agent.types.ts'

// ============================================================================
// Types
// ============================================================================

/**
 * Options for creating an ACP adapter.
 *
 * @param resolveNode - Resolves a target AgentNode by name. Called on each new session.
 *
 * @public
 */
export type CreateAcpAdapterOptions = {
  resolveNode: (name?: string) => AgentNode | Promise<AgentNode>
}

/** Internal session state for a connected ACP session. */
type AcpSession = {
  node: AgentNode
  disconnect: Disconnect
  pendingPrompt: AbortController | null
}

// ============================================================================
// Tool Kind Mapping
// ============================================================================

/** Map agent built-in tool names to ACP ToolKind for UI presentation. */
const TOOL_KIND_MAP: Record<string, ToolKind> = {
  read_file: 'read',
  write_file: 'edit',
  edit_file: 'edit',
  list_files: 'search',
  bash: 'execute',
  lsp: 'read',
  search: 'search',
}

const toolKindFor = (name: string): ToolKind => TOOL_KIND_MAP[name] ?? 'other'

// ============================================================================
// Adapter Factory
// ============================================================================

/**
 * Creates an ACP Agent implementation that bridges to an AgentNode.
 *
 * @remarks
 * The adapter translates between the ACP protocol (JSON-RPC over stdio)
 * and the AgentNode interface (trigger/subscribe). It follows the same
 * pattern as `src/server/server.ts` but for editor transports instead
 * of WebSocket.
 *
 * BP events are mapped to ACP session updates:
 * - `thinking_delta` → `agent_thought_chunk`
 * - `text_delta` → `agent_message_chunk`
 * - `execute` → `tool_call` (in_progress)
 * - `tool_result` → `tool_call_update` (completed)
 * - `gate_rejected` → `tool_call_update` (completed + error)
 * - `message` → resolves the prompt with `end_turn`
 * - `inference_error` → resolves the prompt with `error` stop reason (max_tokens)
 *
 * Non-workspace risk tags trigger `conn.requestPermission()` for user consent.
 * A2A inbound/outbound traffic is observed via `conn.extNotification()`.
 *
 * @param options - Adapter configuration
 * @returns A function that, given an `AgentSideConnection`, returns an `Agent`
 *
 * @public
 */
export const createAcpAdapter = (options: CreateAcpAdapterOptions) => {
  const { resolveNode } = options

  return (conn: AgentSideConnection): Agent => {
    const sessions = new Map<string, AcpSession>()

    /** Generate a random session ID. */
    const generateSessionId = () =>
      Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')

    // ── Agent Interface ──────────────────────────────────────────────────

    const agent: Agent = {
      async initialize(_params: InitializeRequest): Promise<InitializeResponse> {
        return {
          protocolVersion: PROTOCOL_VERSION,
          agentCapabilities: {
            loadSession: false,
            promptCapabilities: {
              image: false,
              audio: false,
              embeddedContext: true,
            },
          },
          agentInfo: {
            name: 'plaited',
            version: '0.1.0',
          },
        }
      },

      async authenticate(_params: AuthenticateRequest): Promise<AuthenticateResponse> {
        // SSH provides admin credentials — no additional auth needed
        return {}
      },

      async newSession(params: NewSessionRequest): Promise<NewSessionResponse> {
        const sessionId = generateSessionId()
        const node = await resolveNode(params.cwd)

        // Subscribe to A2A traffic observation
        const disconnect = node.subscribe({
          a2a_inbound(detail: unknown) {
            conn.extNotification('plaited/a2a_inbound', (detail ?? {}) as Record<string, unknown>)
          },
          a2a_outbound(detail: unknown) {
            conn.extNotification('plaited/a2a_outbound', (detail ?? {}) as Record<string, unknown>)
          },
        })

        // Signal the node that a client has connected
        node.trigger({
          type: 'client_connected',
          detail: { sessionId, source: 'acp', isReconnect: false },
        })

        sessions.set(sessionId, { node, disconnect, pendingPrompt: null })
        return { sessionId }
      },

      async loadSession(_params: LoadSessionRequest): Promise<LoadSessionResponse> {
        // loadSession capability is false — this should not be called
        throw new Error('loadSession is not supported')
      },

      async prompt(params: PromptRequest): Promise<PromptResponse> {
        const session = sessions.get(params.sessionId)
        if (!session) {
          throw new Error(`Session ${params.sessionId} not found`)
        }

        // Abort any previously pending prompt
        session.pendingPrompt?.abort()
        session.pendingPrompt = new AbortController()
        const { signal } = session.pendingPrompt

        // Extract text from the prompt content blocks
        const promptText = params.prompt
          .map((block) => {
            if (block.type === 'text') return block.text
            if (block.type === 'resource' && 'text' in block.resource) return block.resource.text
            return ''
          })
          .filter(Boolean)
          .join('\n')

        try {
          const result = await runPromptTurn(conn, session, params.sessionId, promptText, signal)
          session.pendingPrompt = null
          return result
        } catch {
          if (signal.aborted) {
            session.pendingPrompt = null
            return { stopReason: 'cancelled' }
          }
          throw new Error('Prompt processing failed')
        }
      },

      async cancel(params: CancelNotification): Promise<void> {
        const session = sessions.get(params.sessionId)
        session?.pendingPrompt?.abort()
      },
    }

    // Clean up sessions when the connection closes
    conn.signal.addEventListener('abort', () => {
      for (const [sessionId, session] of sessions) {
        session.node.trigger({
          type: 'client_disconnected',
          detail: { sessionId, code: 1000, reason: 'ACP connection closed' },
        })
        session.disconnect()
        sessions.delete(sessionId)
      }
    })

    return agent
  }
}

// ============================================================================
// Prompt Turn Execution
// ============================================================================

/**
 * Runs a single prompt turn: triggers a task on the AgentNode, subscribes
 * to pipeline events, bridges them to ACP session updates, and resolves
 * when the agent completes the turn.
 */
const runPromptTurn = (
  conn: AgentSideConnection,
  session: AcpSession,
  sessionId: string,
  promptText: string,
  signal: AbortSignal,
): Promise<PromptResponse> =>
  new Promise<PromptResponse>((resolve, reject) => {
    const { node } = session

    // Abort listener — reject if cancelled before completion
    const onAbort = () => reject(new Error('cancelled'))
    signal.addEventListener('abort', onAbort, { once: true })

    /** Send a session update, swallowing errors if connection is closed. */
    const update = (u: SessionNotification['update']) => {
      conn.sessionUpdate({ sessionId, update: u }).catch(() => {})
    }

    // Track in-flight tool calls needing permission
    const pendingPermissions = new Map<string, { resolve: (approved: boolean) => void }>()

    // Subscribe to agent events for this turn
    const disconnect = node.subscribe({
      // ── Streaming deltas ─────────────────────────────────────────────
      [AGENT_EVENTS.thinking_delta](detail: { content: string }) {
        update({
          sessionUpdate: 'agent_thought_chunk',
          content: { type: 'text', text: detail.content },
        })
      },

      [AGENT_EVENTS.text_delta](detail: { content: string }) {
        update({
          sessionUpdate: 'agent_message_chunk',
          content: { type: 'text', text: detail.content },
        })
      },

      // ── Tool lifecycle ───────────────────────────────────────────────
      [AGENT_EVENTS.execute](detail: {
        toolCall: { id: string; name: string; arguments: Record<string, unknown> }
        tags: string[]
      }) {
        update({
          sessionUpdate: 'tool_call',
          toolCallId: detail.toolCall.id,
          title: detail.toolCall.name,
          kind: toolKindFor(detail.toolCall.name),
          status: 'in_progress',
          rawInput: detail.toolCall.arguments,
        })
      },

      [AGENT_EVENTS.tool_result](detail: { result: { tool_call_id: string; output: unknown } }) {
        update({
          sessionUpdate: 'tool_call_update',
          toolCallId: detail.result.tool_call_id,
          status: 'completed',
          rawOutput: detail.result.output,
          content: [
            {
              type: 'content' as const,
              content: {
                type: 'text' as const,
                text:
                  typeof detail.result.output === 'string'
                    ? detail.result.output
                    : JSON.stringify(detail.result.output, null, 2),
              },
            },
          ],
        })
      },

      [AGENT_EVENTS.gate_rejected](detail: { toolCall: { id: string; name: string }; decision: { reason: string } }) {
        update({
          sessionUpdate: 'tool_call_update',
          toolCallId: detail.toolCall.id,
          status: 'completed',
          rawOutput: { error: detail.decision.reason },
          content: [
            {
              type: 'content' as const,
              content: {
                type: 'text' as const,
                text: `Gate rejected: ${detail.decision.reason}`,
              },
            },
          ],
        })
      },

      // ── Permission bridging ──────────────────────────────────────────
      [AGENT_EVENTS.gate_approved](detail: {
        toolCall: { id: string; name: string; arguments: Record<string, unknown> }
        tags: string[]
      }) {
        const hasNonWorkspaceTags = detail.tags.some((tag) => tag !== RISK_TAG.workspace)

        if (!hasNonWorkspaceTags) return

        // Request permission from the editor user for non-workspace operations
        const toolCallId = detail.toolCall.id
        update({
          sessionUpdate: 'tool_call',
          toolCallId,
          title: detail.toolCall.name,
          kind: toolKindFor(detail.toolCall.name),
          status: 'pending',
          rawInput: detail.toolCall.arguments,
        })

        conn
          .requestPermission({
            sessionId,
            toolCall: {
              toolCallId,
              title: detail.toolCall.name,
              kind: toolKindFor(detail.toolCall.name),
              status: 'pending',
              rawInput: detail.toolCall.arguments,
            },
            options: [
              { kind: 'allow_once', name: 'Allow', optionId: 'allow' },
              { kind: 'reject_once', name: 'Deny', optionId: 'deny' },
            ],
          })
          .then((response) => {
            const pending = pendingPermissions.get(toolCallId)
            if (response.outcome.outcome === 'cancelled') {
              pending?.resolve(false)
            } else {
              pending?.resolve(response.outcome.optionId === 'allow')
            }
            pendingPermissions.delete(toolCallId)
          })
          .catch(() => {
            pendingPermissions.get(toolCallId)?.resolve(false)
            pendingPermissions.delete(toolCallId)
          })
      },

      // ── Plan updates ─────────────────────────────────────────────────
      [AGENT_EVENTS.plan_saved](detail: { plan: { goal: string; steps: Array<{ id: string; intent: string }> } }) {
        update({
          sessionUpdate: 'plan',
          entries: detail.plan.steps.map((step) => ({
            content: step.intent,
            priority: 'medium' as const,
            status: 'pending' as const,
          })),
        })
      },

      // ── Turn completion ──────────────────────────────────────────────
      [AGENT_EVENTS.message](_detail: { content: string }) {
        signal.removeEventListener('abort', onAbort)
        disconnect()
        resolve({ stopReason: 'end_turn' })
      },

      [AGENT_EVENTS.inference_error](detail: { error: string; retryable: boolean }) {
        if (!detail.retryable) {
          signal.removeEventListener('abort', onAbort)
          disconnect()
          // Send the error as a final message chunk before resolving
          update({
            sessionUpdate: 'agent_message_chunk',
            content: { type: 'text', text: `Error: ${detail.error}` },
          })
          resolve({ stopReason: 'end_turn' })
        }
      },
    })

    // Trigger the task on the agent node
    node.trigger({
      type: AGENT_EVENTS.task,
      detail: { prompt: promptText },
    })
  })
