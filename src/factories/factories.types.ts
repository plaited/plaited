import type { AgentToolCall, ToolDefinition } from '../agent/agent.schemas.ts'
import type { AgentFactory, ChatMessage, Model, ToolExecutor } from '../agent/agent.types.ts'

/**
 * A named predicate for factory-level tool call validation.
 *
 * @public
 */
export type ConstitutionPredicate = {
  name: string
  check: (toolCall: AgentToolCall) => boolean
}

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

/**
 * Options for creating the default gate/execute factory.
 *
 * @public
 */
export type CreateGateExecuteFactoryOptions = {
  tools: ToolDefinition[]
  toolExecutor: ToolExecutor
  constitutionPredicates?: ConstitutionPredicate[]
}

/**
 * Factory creator that returns the default gate/execute behavior.
 *
 * @public
 */
export type GateExecuteFactoryCreator = (options: CreateGateExecuteFactoryOptions) => AgentFactory

/**
 * Options for creating the default simulation/evaluation factory.
 *
 * @public
 */
export type CreateSimulationEvaluationFactoryOptions = {
  model: Model
  getGoal: () => string
  getHistory: () => ChatMessage[]
}

/**
 * Factory creator that returns the simulation/evaluation behavior.
 *
 * @public
 */
export type SimulationEvaluationFactoryCreator = (options: CreateSimulationEvaluationFactoryOptions) => AgentFactory

/**
 * Options for creating a runtime snapshot capture factory.
 *
 * @public
 */
export type CreateSnapshotContextFactoryOptions = {
  tableName?: string
}

/**
 * Factory creator that records snapshots into runtime SQLite context.
 *
 * @public
 */
export type SnapshotContextFactoryCreator = (options?: CreateSnapshotContextFactoryOptions) => AgentFactory
