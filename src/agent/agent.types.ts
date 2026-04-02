import type { infer as Infer, ZodSafeParseError, ZodTypeAny } from 'zod'
import type { A2AClient } from '../a2a/a2a.types.ts'
import type {
  BSync,
  DefaultHandlers,
  Disconnect,
  SnapshotListener,
  Trigger,
  UseSnapshot,
} from '../behavioral/behavioral.types.ts'
import type { CONTROLLER_TO_AGENT_EVENTS, UI_ADAPTER_LIFECYCLE_EVENTS } from '../events.ts'
import type { UIClientConnectedDetail, UIClientDisconnectedDetail, UIClientErrorDetail } from '../server.ts'
import type { SnapshotEvent, UserActionMessage } from '../ui.ts'
import type { AGENT_EVENTS } from './agent.constants.ts'
import type {
  AgentPlan,
  AgentToolCall,
  AgentToolResultDetail,
  GateDecision,
  ModelUsage,
  RequestBashDetail,
  RequestDeleteFileDetail,
  RequestGlobFilesDetail,
  RequestGrepDetail,
  RequestPrimaryInferenceDetail,
  RequestReadFileDetail,
  RequestTtsInferenceDetail,
  RequestVisionInferenceDetail,
  RequestWriteFileDetail,
  ToolDefinition,
  ToolResult,
  UpdateFactoriesDetail,
} from './agent.schemas.ts'

/**
 * Initial heartbeat configuration for an agent.
 *
 * @public
 */
export type HeartbeatConfig = {
  intervalMs?: number
}

/**
 * Minimal create-agent contract for the new core.
 *
 * @public
 */
export type CreateAgentOptions = {
  id: string
  cwd: string
  workspace: string
  models: AgentModels
  env?: Record<string, string>
  factories?: Factory[]
  restrictedTriggers?: string[]
  heartbeat?: HeartbeatConfig
}

/**
 * Public handle returned by the new agent core.
 *
 * @public
 */
export type AgentHandle = {
  trigger: Trigger
  useSnapshot: UseSnapshot
}

/**
 * Spawn helper options for recursively creating agents.
 *
 * @public
 */
export type SpawnAgentOptions = CreateAgentOptions & {
  onSnapshot?: SnapshotListener
}

/**
 * Return shape for spawn-agent helper.
 *
 * @public
 */
export type SpawnedAgentHandle = AgentHandle & {
  id: string
  disconnectSnapshot?: Disconnect
}

export type Listen = (args: {
  eventType: string
  trigger: Trigger
  getLVC?: boolean
  disconnectSet: Set<Disconnect>
}) => Disconnect

export type SchemaViolationHandler<TSchema extends ZodTypeAny = ZodTypeAny> = (args: {
  key: string
  schema: TSchema
  value: unknown
  violation: ZodSafeParseError<Infer<TSchema>>
}) => void

export type Signal<TSchema extends ZodTypeAny = ZodTypeAny> = {
  set?(value?: Infer<TSchema>): void
  listen: Listen
  get(): Infer<TSchema> | undefined
  schema: TSchema
}

export type Signals = {
  set: <TSchema extends ZodTypeAny = ZodTypeAny>({
    key,
    schema,
    value,
    readOnly,
    onSchemaViolation,
  }: {
    key: string
    schema: TSchema
    value?: Infer<TSchema>
    readOnly: boolean
    onSchemaViolation?: SchemaViolationHandler<TSchema>
  }) => Signal<TSchema>
  get: (key: string) => Signal | undefined
  has: (key: string) => boolean
}

export type FactoryParams = {
  trigger: Trigger
  useSnapshot: UseSnapshot
  disconnectSet: Set<Disconnect>
  signals: Signals
}

export type Factory = (params: FactoryParams) => {
  threads?: Record<string, ReturnType<BSync>>
  handlers?: DefaultHandlers
}

export type LocalToolResultDetail = AgentToolResultDetail

export type CoreRequestPrimaryInferenceDetail = RequestPrimaryInferenceDetail
export type CoreRequestVisionInferenceDetail = RequestVisionInferenceDetail
export type CoreRequestTtsInferenceDetail = RequestTtsInferenceDetail
export type CoreRequestBashDetail = RequestBashDetail
export type CoreRequestDeleteFileDetail = RequestDeleteFileDetail
export type CoreRequestGlobFilesDetail = RequestGlobFilesDetail
export type CoreRequestGrepDetail = RequestGrepDetail
export type CoreRequestReadFileDetail = RequestReadFileDetail
export type CoreRequestWriteFileDetail = RequestWriteFileDetail

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

export type PrimaryInferenceModel = (args: {
  messages: ChatMessage[]
  tools?: ToolDefinition[]
  temperature?: number
  timeout?: number
}) => Promise<ModelResponseDetail>

/**
 * Embedding model interface — text to vector.
 *
 * @remarks
 * Tool-backing interface: the reasoning model invokes semantic search
 * via an `embed_search` tool call; the tool executor delegates to this
 * interface. Implementations swap freely across MLX, vLLM, and cloud APIs.
 *
 * Reference model: EmbeddingGemma (Gemma 3 300M base).
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
 * Tool-backing interface: the reasoning model invokes image analysis
 * via an `analyze_image` tool call; the tool executor delegates to this
 * interface. Implementations swap freely across MLX (`mlx-vlm`), vLLM,
 * and cloud APIs.
 *
 * Reference model: Qwen 2.5 VL 7B.
 *
 * @public
 */
export type Vision = {
  analyze: (image: Uint8Array, prompt: string) => Promise<VisionResponse>
}

/**
 * Structured response from voice synthesis.
 *
 * @public
 */
export type VoiceResponse = {
  /** Raw audio bytes (WAV/PCM format) */
  audio: Uint8Array
  /** Audio sample rate in Hz */
  sampleRate: number
  /** Audio duration in seconds */
  duration: number
}

/**
 * Voice model interface — text to speech audio.
 *
 * @remarks
 * Tool-backing interface: the reasoning model invokes speech synthesis
 * via a `speak` tool call; the tool executor delegates to this interface.
 * Implementations swap freely across MLX (`mlx-audio`), vLLM (`vLLM-Omni`),
 * and cloud APIs.
 *
 * Reference model: Qwen3-TTS 1.7B VoiceDesign.
 *
 * @public
 */
export type Voice = {
  speak: (text: string, options?: { voice?: string; language?: string }) => Promise<VoiceResponse>
}

export type AgentModels = {
  primary: PrimaryInferenceModel
  vision: (args: { image: Uint8Array; prompt: string; timeout?: number }) => Promise<VisionResponse>
  tts: (args: { text: string; voice?: string; language?: string; timeout?: number }) => Promise<VoiceResponse>
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
  cwd: string
  env: Record<string, string>
  signal: AbortSignal
}

/**
 * A tool implementation that executes a specific tool.
 *
 * @remarks
 * Receives parsed arguments and a cwd-scoped context with AbortSignal.
 * Returned value becomes the `output` field of a `ToolResult`.
 *
 * @public
 */
export type ToolHandler<T extends Record<string, unknown> = Record<string, unknown>> = (
  args: { timeout?: number } & T,
  ctx: ToolContext,
) => Promise<unknown>

/**
 * Executes a tool call with transport abstraction.
 *
 * @remarks
 * The pluggability seam for local and A2A tool execution.
 * Local executor calls handlers directly. Remote executors serialize
 * tool calls over the wire. Same tool code runs everywhere.
 *
 * @public
 */
export type ToolExecutor = (toolCall: AgentToolCall, signal: AbortSignal) => Promise<unknown>

// ============================================================================
// Executor Factory Options — transport-specific configuration
// ============================================================================

/**
 * Options for {@link createLocalExecutor}.
 *
 * @remarks
 * The default executor — calls ToolHandler functions directly in-process.
 *
 * @public
 */
export type CreateLocalExecutorOptions = {
  cwd: string
  env?: Record<string, string>
  handlers?: Record<string, ToolHandler>
}

/**
 * Options for {@link createA2AExecutor}.
 *
 * @remarks
 * Sends tool calls as A2A `DataPart` messages to a remote agent node.
 * The remote agent executes the tool and returns the result as a task artifact.
 *
 * @public
 */
export type CreateA2AExecutorOptions = {
  client: A2AClient
  taskTimeout?: number
}

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
  /** Origin of the message cycle: 'proactive' for tick-triggered, 'reactive' (default) for user-triggered. */
  source?: 'reactive' | 'proactive'
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
// Proactive — Sensor Factory contract (Prompt 11 adds reference implementations)
// ============================================================================

/**
 * A snapshot persisted between sensor sweeps for diff comparison.
 *
 * @public
 */
export type SensorSnapshot = {
  timestamp: string
  data: unknown
}

/**
 * Contract for a pluggable sensor.
 *
 * @remarks
 * Sensors are read-only observers — they read state, diff against the last
 * snapshot, and report deltas. The framework coordinates execution via
 * `createSensorBatchThread`. Concrete implementations (git, filesystem, HTTP)
 * are generation targets, not framework code.
 *
 * @public
 */
export type SensorFactory = {
  /** Human-readable sensor name (used in `sensor_delta` events) */
  name: string
  /** Read current state. Receives AbortSignal for timeout control. */
  read: (signal: AbortSignal) => Promise<unknown>
  /** Compare current state to previous snapshot. Returns delta or null (no change). */
  diff: (current: unknown, previous: SensorSnapshot | null) => unknown | null
  /** Path for snapshot persistence (relative to `.memory/sensors/`) */
  snapshotPath: string
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
 * `tool_result` (write_file, delete_file, bash). The handler commits both the
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
}

/**
 * Event details for the new agent core surface.
 *
 * @public
 */
export type AgentCoreEventDetails = {
  update_factories: UpdateFactoriesDetail
}

// ============================================================================
// Agent Node — public return type (adapter-facing BP primitives)
// ============================================================================

/**
 * Legacy adapter-facing agent handle retained during the refactor.
 *
 * @remarks
 * Exposes BP primitives for adapter consumption while remaining legacy
 * surfaces are trimmed away.
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
