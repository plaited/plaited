import type { infer as Infer, ZodSafeParseError, ZodTypeAny } from 'zod'
import type {
  AddBThreads,
  BPListener,
  BSync,
  DefaultHandlers,
  Disconnect,
  Trigger,
  UseSnapshot,
} from '../behavioral/behavioral.types.ts'
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
 * @remarks
 * `createAgent()` exposes host `trigger` on the public handle and module
 * `emit` through `ModuleParams`.
 *
 * @public
 */
export type CreateAgentOptions = {
  cwd: string
  workspace: string
  models: AgentModels
  env?: Record<string, string>
  modules?: Module[]
  heartbeat?: HeartbeatConfig
  contextMemory?: {
    ttlMs?: number
    maxKeys?: number
  }
}

/**
 * Public handle returned by the new agent core.
 *
 * @remarks
 * `trigger` is the orchestration entrypoint for the runtime.
 *
 * @public
 */
export type AgentHandle = {
  trigger: Trigger
  useSnapshot: UseSnapshot
}

/**
 * Listener signature used by signals and computed values.
 *
 * @public
 */
export type Listen = (eventType: string | (() => void), getLVC?: boolean) => Disconnect

/**
 * Handler invoked when a signal value fails schema validation.
 *
 * @template TSchema - Schema used to validate the signal.
 *
 * @public
 */
export type SchemaViolationHandler<TSchema extends ZodTypeAny = ZodTypeAny> = (args: {
  key: string
  schema: TSchema
  value: unknown
  violation: ZodSafeParseError<Infer<TSchema>>
}) => void

/**
 * Mutable schema-aware signal used by the agent runtime.
 *
 * @template TSchema - Schema used to validate stored values.
 *
 * @public
 */
export type Signal<TSchema extends ZodTypeAny = ZodTypeAny> = {
  set?(value?: Infer<TSchema>): void
  listen: Listen
  get(): Infer<TSchema> | undefined
  schema: TSchema
}

/**
 * Module for readonly computed signals derived from other signals.
 *
 * @public
 */
export type Computed = <T>(
  compute: () => T,
  deps: Signal[],
) => {
  get: () => T
  listen: Listen
}

/**
 * Signal registry exposed to installed modules.
 *
 * @public
 */
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

/**
 * Context object passed to installed modules.
 *
 * @public
 */
export type ModuleParams = {
  moduleId: string
  /** Module ingress surface injected into installed modules. */
  emit: Trigger
  /** Replay-safe read of the last selected event detail for a listener. */
  last: (listener: BPListener) => unknown
  /** Runtime thread installation surface for module-scoped dynamic threads. */
  addThreads: AddBThreads
  useSnapshot: UseSnapshot
}

/**
 * Module signature used to install agent behavior.
 *
 * @public
 */
export type Module = (params: ModuleParams) => {
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

/**
 * Primary inference function used by the agent runtime.
 *
 * @public
 */
export type PrimaryInferenceModel = (args: {
  messages: ChatMessage[]
  tools?: ToolDefinition[]
  temperature?: number
  timeout?: number
}) => Promise<ModelResponseDetail>

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
 * Model providers configured for an agent instance.
 *
 * @public
 */
export type AgentModels = {
  primary: PrimaryInferenceModel
  tts: (args: { text: string; voice?: string; language?: string; timeout?: number }) => Promise<VoiceResponse>
}

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
