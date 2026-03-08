import type { DefaultHandlers, Disconnect, SnapshotListener, Trigger } from '../behavioral/behavioral.types.ts'
import type { CONTROLLER_TO_AGENT_EVENTS, UI_ADAPTER_LIFECYCLE_EVENTS } from '../events.ts'
import type { UIClientConnectedDetail, UIClientDisconnectedDetail, UIClientErrorDetail } from '../server.ts'
import type { SnapshotEvent, UserActionMessage } from '../ui.ts'
import type { AGENT_EVENTS } from './agent.constants.ts'

import type { AgentPlan, AgentToolCall, GateDecision, ModelUsage, ToolDefinition, ToolResult } from './agent.schemas.ts'

// ============================================================================
// Model Interface — streaming inference (from pi-mono audit decisions)
// ============================================================================

/** A single message in the OpenAI chat format */
export type ChatMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content?: string | null
  tool_calls?: unknown[]
  tool_call_id?: string
}

/**
 * A chunk from the model inference stream.
 *
 * @remarks
 * Returned by `Model.reason()` as `AsyncIterable<ModelDelta>`.
 * The inference handler consumes these privately and triggers
 * BP events per chunk for progressive UI rendering.
 *
 * - `thinking_delta` — reasoning/CoT content
 * - `text_delta` — user-facing response content
 * - `toolcall_delta` — partial tool call (accumulated privately by handler)
 * - `done` — stream complete, includes final `ModelResponse` with usage
 * - `error` — inference error (may be retryable)
 *
 * @public
 */
export type ModelDelta =
  | { type: 'thinking_delta'; content: string }
  | { type: 'text_delta'; content: string }
  | { type: 'toolcall_delta'; id: string; name?: string; arguments?: string }
  | { type: 'done'; response: ModelResponse }
  | { type: 'error'; error: string }

/**
 * Final response metadata from a completed inference stream.
 *
 * @public
 */
export type ModelResponse = {
  usage: ModelUsage
}

/**
 * Primary model interface — reasoning and tool calling.
 *
 * @remarks
 * Returns `AsyncIterable<ModelDelta>` for streaming. The inference handler
 * consumes the stream, accumulates tool call arguments privately, and
 * triggers BP events per chunk for progressive UI. On `done`, the handler
 * triggers `model_response` with the complete `ParsedModelResponse`.
 *
 * OpenAI-compatible API is the wire format — llama.cpp, vLLM, Ollama
 * all support `/v1/chat/completions` with `stream: true`.
 *
 * @public
 */
export type Model = {
  reason: (args: {
    messages: ChatMessage[]
    tools?: ToolDefinition[]
    temperature?: number
    signal: AbortSignal
  }) => AsyncIterable<ModelDelta>
}

/**
 * Embedding model interface — text to vector.
 *
 * @remarks
 * Infrastructure called by handlers, NOT a tool call.
 * Perception (input processing), no side effects, no safety gating.
 *
 * @public
 */
export type Indexer = {
  embed: (text: string) => Promise<Float32Array>
}

/**
 * Structured response from the vision model.
 *
 * @public
 */
export type VisionResponse = {
  description: string
  metadata?: Record<string, unknown>
}

/**
 * Vision model interface — image to structured description.
 *
 * @remarks
 * Infrastructure called by handlers, NOT a tool call.
 * Perception (input processing), no side effects, no safety gating.
 *
 * @public
 */
export type Vision = {
  analyze: (image: Uint8Array, prompt: string) => Promise<VisionResponse>
}

// ============================================================================
// Tool Context + Handler
// ============================================================================

/**
 * Context passed to tool handlers.
 *
 * @remarks
 * `signal` propagates from BP interrupt → AbortSignal → tool subprocess.
 *
 * @public
 */
export type ToolContext = {
  workspace: string
  signal: AbortSignal
}

/**
 * A tool implementation that executes a specific tool.
 *
 * @remarks
 * Receives parsed arguments and a workspace context with AbortSignal.
 * Returned value becomes the `output` field of a `ToolResult`.
 *
 * @public
 */
export type ToolHandler = (args: Record<string, unknown>, ctx: ToolContext) => Promise<unknown>

// ============================================================================
// Parsed Model Response
// ============================================================================

/**
 * Structured output extracted from a completed model inference.
 *
 * @remarks
 * The inference handler accumulates `ModelDelta` chunks privately,
 * then constructs this on the `done` delta. Triggered as the
 * `model_response` BP event detail.
 *
 * @public
 */
export type ParsedModelResponse = {
  thinking: string | null
  toolCalls: AgentToolCall[]
  message: string | null
}

// ============================================================================
// Agent Event Details — documents the event vocabulary and detail shapes
// ============================================================================

/** Detail payload for the `task` event */
export type TaskDetail = {
  prompt: string
}

/** Detail payload for the `model_response` event */
export type ModelResponseDetail = {
  parsed: ParsedModelResponse
  usage: ModelUsage
}

/** Detail payload for the `context_ready` event (per-tool-call gate dispatch) */
export type ContextReadyDetail = {
  toolCall: AgentToolCall
}

/** Detail payload for the `gate_rejected` event */
export type GateRejectedDetail = {
  toolCall: AgentToolCall
  decision: GateDecision
}

/** Detail payload for the `gate_approved` event */
export type GateApprovedDetail = {
  toolCall: AgentToolCall
  tags: string[]
}

/** Detail payload for the `execute` event */
export type ExecuteDetail = {
  toolCall: AgentToolCall
  tags: string[]
}

/** Detail payload for the `tool_result` event */
export type ToolResultDetail = {
  result: ToolResult
}

/** Detail payload for the `tool_progress` event */
export type ToolProgressDetail = {
  toolCallId: string
  progress: unknown
}

/** Detail payload for the `save_plan` event */
export type SavePlanDetail = {
  plan: AgentPlan
  toolCallId?: string
}

/** Detail payload for the `plan_saved` event */
export type PlanSavedDetail = {
  plan: AgentPlan
}

/** Detail payload for the `simulate_request` event */
export type SimulateRequestDetail = {
  toolCall: AgentToolCall
  tags: string[]
}

/** Detail payload for the `simulation_result` event */
export type SimulationResultDetail = {
  toolCall: AgentToolCall
  prediction: string
  tags: string[]
}

/** Detail payload for the `eval_approved` event */
export type EvalApprovedDetail = {
  toolCall: AgentToolCall
  tags: string[]
  score?: number
}

/** Detail payload for the `eval_rejected` event */
export type EvalRejectedDetail = {
  toolCall: AgentToolCall
  reason: string
  score?: number
}

/** Detail payload for the `message` event */
export type MessageDetail = {
  content: string
}

/** Detail payload for the `thinking_delta` event */
export type ThinkingDeltaDetail = {
  content: string
}

/** Detail payload for the `text_delta` event */
export type TextDeltaDetail = {
  content: string
}

/** Detail payload for the `inference_error` event */
export type InferenceErrorDetail = {
  error: string
  retryable: boolean
}

/**
 * Documents the full event vocabulary and expected detail shapes.
 *
 * @remarks
 * Covers UI adapter events (`UI_ADAPTER_LIFECYCLE_EVENTS`, `CONTROLLER_TO_AGENT_EVENTS`) with
 * concrete detail types from their respective modules, and pipeline events
 * (`AGENT_EVENTS`) with agent-owned detail types.
 *
 * Not used as a generic parameter — `behavioral()` is unparameterized and handlers
 * self-validate with Zod where needed. Kept as a reference type for documentation
 * and test authoring.
 *
 * @public
 */
export type AgentEventDetails = {
  // ── UI adapter events ──────────────────────────────────────────────
  [UI_ADAPTER_LIFECYCLE_EVENTS.client_connected]: UIClientConnectedDetail
  [UI_ADAPTER_LIFECYCLE_EVENTS.client_disconnected]: UIClientDisconnectedDetail
  [UI_ADAPTER_LIFECYCLE_EVENTS.client_error]: UIClientErrorDetail
  [CONTROLLER_TO_AGENT_EVENTS.user_action]: UserActionMessage['detail']
  [CONTROLLER_TO_AGENT_EVENTS.snapshot]: SnapshotEvent['detail']
  // ── Pipeline events ───────────────────────────────────────────────
  [AGENT_EVENTS.task]: TaskDetail
  [AGENT_EVENTS.context_ready]: ContextReadyDetail
  [AGENT_EVENTS.invoke_inference]: undefined
  [AGENT_EVENTS.model_response]: ModelResponseDetail
  [AGENT_EVENTS.gate_rejected]: GateRejectedDetail
  [AGENT_EVENTS.gate_approved]: GateApprovedDetail
  [AGENT_EVENTS.simulate_request]: SimulateRequestDetail
  [AGENT_EVENTS.simulation_result]: SimulationResultDetail
  [AGENT_EVENTS.eval_approved]: EvalApprovedDetail
  [AGENT_EVENTS.eval_rejected]: EvalRejectedDetail
  [AGENT_EVENTS.execute]: ExecuteDetail
  [AGENT_EVENTS.tool_result]: ToolResultDetail
  [AGENT_EVENTS.tool_progress]: ToolProgressDetail
  [AGENT_EVENTS.save_plan]: SavePlanDetail
  [AGENT_EVENTS.plan_saved]: PlanSavedDetail
  [AGENT_EVENTS.message]: MessageDetail
  [AGENT_EVENTS.loop_complete]: undefined
  [AGENT_EVENTS.thinking_delta]: ThinkingDeltaDetail
  [AGENT_EVENTS.text_delta]: TextDeltaDetail
  [AGENT_EVENTS.inference_error]: InferenceErrorDetail
}

// ============================================================================
// Agent Node — public return type (adapter-facing BP primitives)
// ============================================================================

/**
 * Return type of `createAgentLoop`.
 *
 * @remarks
 * Exposes BP primitives for adapter consumption. Adapters connect via
 * `subscribe` (event handlers) and inject lifecycle events via a restricted
 * `trigger`. The agent loop coordinates the pipeline internally; adapters
 * build their own views (trajectory recording, persistence, streaming).
 *
 * - `trigger` — restricted to `task`, `client_connected`, `disconnected`
 * - `subscribe` — register fire-and-forget event handlers, returns disconnect
 * - `snapshot` — observe BP engine decisions (selection, blocking, interrupts)
 * - `destroy` — tear down all subscriptions
 *
 * @public
 */
export type AgentNode = {
  trigger: Trigger
  subscribe: (handlers: DefaultHandlers) => Disconnect
  snapshot: (listener: SnapshotListener) => Disconnect
  destroy: () => void
}

// ============================================================================
// Diagnostic Entry — non-selection snapshot messages
// ============================================================================

/**
 * A diagnostic entry captured from non-selection snapshot messages.
 *
 * @remarks
 * Stored in an in-memory ring buffer. Includes feedback handler errors,
 * restricted trigger rejections, and duplicate thread warnings.
 *
 * @public
 */
export type DiagnosticEntry =
  | { kind: 'feedback_error'; type: string; detail?: unknown; error: string; timestamp: number }
  | { kind: 'restricted_trigger_error'; type: string; detail?: unknown; error: string; timestamp: number }
  | { kind: 'bthreads_warning'; thread: string; warning: string; timestamp: number }
