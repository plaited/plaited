import type { DefaultHandlers, Disconnect, SnapshotListener, Trigger } from '../behavioral/behavioral.types.ts'
import type { CONTROLLER_TO_AGENT_EVENTS, UI_ADAPTER_LIFECYCLE_EVENTS } from '../events.ts'
import type { UIClientConnectedDetail, UIClientDisconnectedDetail, UIClientErrorDetail } from '../server.ts'
import type { SnapshotEvent, UserActionMessage } from '../ui.ts'
import type { AGENT_EVENTS } from './agent.constants.ts'

import type { AgentPlan, AgentToolCall, GateDecision, ModelUsage, ToolDefinition, ToolResult } from './agent.schemas.ts'

// ============================================================================
// Model Interface — streaming inference (from pi-mono audit decisions)
// ============================================================================

/**
 * A single message in the OpenAI chat format.
 *
 * @public
 */
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

/**
 * Executes a tool call with transport abstraction.
 *
 * @remarks
 * The pluggability seam for local, SSH, and A2A tool execution.
 * Local executor calls handlers directly. Remote executors serialize
 * tool calls over the wire. Same tool code runs everywhere.
 *
 * @public
 */
export type ToolExecutor = (toolCall: AgentToolCall, signal: AbortSignal) => Promise<unknown>

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

/**
 * Detail payload for the `task` event.
 *
 * @public
 */
export type TaskDetail = {
  prompt: string
}

/**
 * Detail payload for the `model_response` event.
 *
 * @public
 */
export type ModelResponseDetail = {
  parsed: ParsedModelResponse
  usage: ModelUsage
}

/**
 * Detail payload for the `context_ready` event (per-tool-call gate dispatch).
 *
 * @public
 */
export type ContextReadyDetail = {
  toolCall: AgentToolCall
}

/**
 * Detail payload for the `gate_rejected` event.
 *
 * @public
 */
export type GateRejectedDetail = {
  toolCall: AgentToolCall
  decision: GateDecision
}

/**
 * Detail payload for the `gate_approved` event.
 *
 * @public
 */
export type GateApprovedDetail = {
  toolCall: AgentToolCall
  tags: string[]
}

/**
 * Detail payload for the `execute` event.
 *
 * @public
 */
export type ExecuteDetail = {
  toolCall: AgentToolCall
  tags: string[]
}

/**
 * Detail payload for the `tool_result` event.
 *
 * @public
 */
export type ToolResultDetail = {
  result: ToolResult
}

/**
 * Detail payload for the `tool_progress` event.
 *
 * @public
 */
export type ToolProgressDetail = {
  toolCallId: string
  progress: unknown
}

/**
 * Detail payload for the `save_plan` event.
 *
 * @public
 */
export type SavePlanDetail = {
  plan: AgentPlan
  toolCallId?: string
}

/**
 * Detail payload for the `plan_saved` event.
 *
 * @public
 */
export type PlanSavedDetail = {
  plan: AgentPlan
}

/**
 * Detail payload for the `simulate_request` event.
 *
 * @public
 */
export type SimulateRequestDetail = {
  toolCall: AgentToolCall
  tags: string[]
}

/**
 * Detail payload for the `simulation_result` event.
 *
 * @public
 */
export type SimulationResultDetail = {
  toolCall: AgentToolCall
  prediction: string
  tags: string[]
}

/**
 * Detail payload for the `eval_approved` event.
 *
 * @public
 */
export type EvalApprovedDetail = {
  toolCall: AgentToolCall
  tags: string[]
  score?: number
}

/**
 * Detail payload for the `eval_rejected` event.
 *
 * @public
 */
export type EvalRejectedDetail = {
  toolCall: AgentToolCall
  reason: string
  score?: number
}

/**
 * Detail payload for the `message` event.
 *
 * @public
 */
export type MessageDetail = {
  content: string
}

/**
 * Detail payload for the `thinking_delta` event.
 *
 * @public
 */
export type ThinkingDeltaDetail = {
  content: string
}

/**
 * Detail payload for the `text_delta` event.
 *
 * @public
 */
export type TextDeltaDetail = {
  content: string
}

/**
 * Detail payload for the `inference_error` event.
 *
 * @public
 */
export type InferenceErrorDetail = {
  error: string
  retryable: boolean
}

// ============================================================================
// Proactive Heartbeat Event Details — tick, sensor_delta, sensor_sweep, sleep, snapshot_committed
// ============================================================================

/**
 * Detail payload for the `tick` event (periodic heartbeat).
 *
 * @public
 */
export type TickDetail = {
  tickNumber: number
  timestamp: string
}

/**
 * Detail payload for the `sensor_delta` event (single sensor change).
 *
 * @public
 */
export type SensorDeltaDetail = {
  sensor: string
  delta: unknown
}

/**
 * Detail payload for the `sensor_sweep` event (batched sensor deltas).
 *
 * @public
 */
export type SensorSweepDetail = {
  deltas: SensorDeltaDetail[]
}

/**
 * Detail payload for the `sleep` event (idle after no deltas detected).
 *
 * @public
 */
export type SleepDetail = {
  durationMs: number
}

/**
 * Detail payload for the `snapshot_committed` event (git commit captured).
 *
 * @public
 */
export type SnapshotCommittedDetail = {
  sha: string
  modulePath: string
}

// ============================================================================
// Memory Lifecycle Event Details — commit_snapshot, consolidate, defrag
// ============================================================================

/**
 * Detail payload for the `commit_snapshot` event.
 *
 * @remarks
 * Requested by the `sideEffectCommit` bThread after a side-effect-producing
 * `tool_result` (write_file, edit_file, bash). The handler commits both the
 * code change and all pending `.memory/` decision files to the module's git repo.
 *
 * @public
 */
export type CommitSnapshotDetail = {
  /** Absolute path to the module root being committed */
  modulePath: string
  /** The tool_result that triggered this commit */
  toolResult: ToolResult
}

/**
 * Detail payload for the `consolidate` event.
 *
 * @remarks
 * Requested by the `sessionClose` bThread at session end.
 * Archives individual decision `.jsonld` files into `decisions.jsonl`,
 * writes `meta.jsonld` with summary + embedding, then commits.
 *
 * @public
 */
export type ConsolidateDetail = {
  /** Session ID being consolidated */
  sessionId: string
  /** Absolute path to the module's `.memory/` directory */
  memoryPath: string
}

/**
 * Detail payload for the `defrag` event.
 *
 * @remarks
 * Requested by `defragSchedule` bThread after N session completions.
 * Archives old sessions out of the working tree via `git archive`.
 *
 * @public
 */
export type DefragDetail = {
  /** Absolute path to the module's `.memory/` directory */
  memoryPath: string
}

// ============================================================================
// Re-ingestion Event Details — reingest_skill, reingest_rules, reingest_goal
// ============================================================================

/**
 * Detail payload for the `reingest_skill` event.
 *
 * @remarks
 * Triggered by a bThread when the agent modifies a skill file during
 * a session. The handler calls `ingestSkill()` to update the hypergraph
 * vertex in `.memory/skills/`.
 *
 * @public
 */
export type ReingestSkillDetail = {
  /** Absolute path to the skill directory containing SKILL.md */
  skillDir: string
  /** Absolute path to the memory directory */
  memoryDir: string
}

/**
 * Detail payload for the `reingest_rules` event.
 *
 * @remarks
 * Triggered by a bThread when the agent modifies AGENTS.md during
 * a session. The handler calls `ingestRules()` to update the hypergraph
 * RuleSet vertices in `.memory/rules/`.
 *
 * @public
 */
export type ReingestRulesDetail = {
  /** Absolute path to the AGENTS.md file */
  path: string
  /** Absolute path to the memory directory */
  memoryDir: string
}

/**
 * Detail payload for the `reingest_goal` event.
 *
 * @remarks
 * Triggered by a bThread when the agent modifies a goal factory file
 * during a session. The handler calls `ingestGoal()` to update the
 * hypergraph Goal vertex in `.memory/threads/`.
 *
 * @public
 */
export type ReingestGoalDetail = {
  /** Absolute path to the goal factory .ts file */
  path: string
  /** Absolute path to the memory directory */
  memoryDir: string
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
  // ── Proactive heartbeat events ─────────────────────────────────────
  [AGENT_EVENTS.tick]: TickDetail
  [AGENT_EVENTS.sensor_delta]: SensorDeltaDetail
  [AGENT_EVENTS.sensor_sweep]: SensorSweepDetail
  [AGENT_EVENTS.sleep]: SleepDetail
  [AGENT_EVENTS.snapshot_committed]: SnapshotCommittedDetail
  // ── Memory lifecycle events ────────────────────────────────────────
  [AGENT_EVENTS.commit_snapshot]: CommitSnapshotDetail
  [AGENT_EVENTS.consolidate]: ConsolidateDetail
  [AGENT_EVENTS.defrag]: DefragDetail
  // ── Re-ingestion events ─────────────────────────────────────────────
  [AGENT_EVENTS.reingest_skill]: ReingestSkillDetail
  [AGENT_EVENTS.reingest_rules]: ReingestRulesDetail
  [AGENT_EVENTS.reingest_goal]: ReingestGoalDetail
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
