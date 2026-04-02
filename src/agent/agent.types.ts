import type { infer as Infer, ZodSafeParseError, ZodTypeAny } from 'zod'
import type { BSync, DefaultHandlers, Disconnect, Trigger, UseSnapshot } from '../behavioral/behavioral.types.ts'
import type { AgentToolCall, ModelUsage, ToolDefinition } from './agent.schemas.ts'

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

export type Listen = (eventType: string | (() => void), getLVC?: boolean) => Disconnect

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

export type Computed = <T>(
  compute: () => T,
  deps: Signal[],
) => {
  get: () => T
  listen: Listen
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
  signals: Signals
  computed: Computed
}

export type Factory = (params: FactoryParams) => {
  threads?: Record<string, ReturnType<BSync>>
  handlers?: DefaultHandlers
}

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

export type PrimaryInferenceModel = (args: {
  messages: ChatMessage[]
  tools?: ToolDefinition[]
  temperature?: number
  timeout?: number
}) => Promise<ModelResponseDetail>

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

/**
 * Detail payload for the `model_response` event.
 *
 * @public
 */
export type ModelResponseDetail = {
  parsed: ParsedModelResponse
  usage: ModelUsage
}
