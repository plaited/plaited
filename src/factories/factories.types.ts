import type { ToolDefinition } from '../agent/agent.schemas.ts'
import type { AgentFactory, ChatMessage, Model } from '../agent/agent.types.ts'

/**
 * Context assembled for an inference request.
 *
 * @public
 */
export type InferenceContext = {
  messages: ChatMessage[]
}

/**
 * Options for creating the default inference factory.
 *
 * @public
 */
export type CreateInferenceFactoryOptions = {
  model: Model
  tools?: ToolDefinition[]
  buildContext: () => InferenceContext
  timeoutMs?: number
  temperature?: number
  maxRetries?: number
  initialRetryDelayMs?: number
}

/**
 * Factory creator that returns an executable agent factory.
 *
 * @public
 */
export type InferenceFactoryCreator = (options: CreateInferenceFactoryOptions) => AgentFactory
