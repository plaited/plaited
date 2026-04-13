/**
 * Minimal create-agent contract for the current agent core.
 *
 * @public
 */
export type CreateAgentOptions = {
  workspace: string
  ttlMs: number
  maxKeys?: number
}

/**
 * Structured tool call emitted by model inference.
 *
 * @public
 */
export type AgentToolCall = {
  id: string
  name: string
  arguments: Record<string, unknown>
}

/**
 * Minimal OpenAI-style tool definition used by inference adapters.
 *
 * @public
 */
export type ToolDefinition = {
  type: 'function'
  function: {
    name: string
    description?: string
    parameters?: Record<string, unknown>
  }
  tags?: string[]
}

/**
 * Token accounting payload for model responses.
 *
 * @public
 */
export type ModelUsage = {
  inputTokens: number
  outputTokens: number
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
