/**
 * Type definitions for the Plaited World Agent infrastructure.
 * Provides types for tool execution, constraints, trajectories, and rewards.
 *
 * @remarks
 * The world agent uses behavioral programming (useBehavioral) to coordinate
 * tool execution with runtime constraints. This differs from class-based
 * agent frameworks by using bThreads for coordination.
 */

import type { EventDetails, Handlers } from '../main/behavioral.types.ts'

/**
 * Represents a function call from the model.
 * Matches the structure returned by HuggingFace inference API.
 */
export type FunctionCall = {
  /** Name of the function to execute */
  name: string
  /** JSON-encoded arguments for the function */
  arguments: string
}

/**
 * Represents the result of executing a tool.
 */
export type ToolResult = {
  /** Whether the tool execution succeeded */
  success: boolean
  /** Result data if successful */
  data?: unknown
  /** Error message if failed */
  error?: string
}

/**
 * Handler function for a registered tool.
 */
export type ToolHandler = (args: Record<string, unknown>) => ToolResult | Promise<ToolResult>

/**
 * Schema definition for a tool, used to inform the model.
 */
export type ToolSchema = {
  /** Tool name matching the handler registration */
  name: string
  /** Human-readable description of what the tool does */
  description: string
  /** JSON Schema for the tool's parameters */
  parameters: {
    type: 'object'
    properties: Record<string, { type: string; description?: string }>
    required?: string[]
  }
}

/**
 * Registry for managing tools available to the agent.
 */
export type ToolRegistry = {
  /** Register a new tool handler */
  register: (name: string, handler: ToolHandler, schema: ToolSchema) => void
  /** Execute a function call from the model */
  execute: (call: FunctionCall) => Promise<ToolResult>
  /** Get all registered tool schemas for model context */
  schemas: ToolSchema[]
}

/**
 * Result of running a story for reward computation.
 */
export type StoryResult = {
  /** Whether all story assertions passed */
  passed: boolean
  /** Total number of assertions */
  totalAssertions: number
  /** Number of passed assertions */
  passedAssertions: number
  /** Whether accessibility checks passed */
  a11yPassed: boolean
  /** Detailed error messages if any */
  errors: string[]
}

/**
 * A single message in a training trajectory.
 */
export type TrajectoryMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/**
 * A complete trajectory for training, includes messages and reward.
 */
export type Trajectory = {
  /** Conversation messages leading to the generation */
  messages: TrajectoryMessage[]
  /** Computed reward signal (0.0 to 1.0) */
  reward: number
  /** Story result that informed the reward */
  storyResult?: StoryResult
}

/**
 * Configuration for reward computation.
 */
export type RewardConfig = {
  /** Weight for story pass/fail (default: 0.5) */
  storyWeight?: number
  /** Weight for accessibility score (default: 0.3) */
  a11yWeight?: number
  /** Weight for assertion ratio (default: 0.2) */
  assertionWeight?: number
}

/**
 * Event types for the world agent behavioral program.
 */
export type AgentEventTypes = {
  /** User intent to generate UI */
  generate: { intent: string }
  /** Tool calls from model response */
  toolCall: { calls: FunctionCall[] }
  /** Result of tool execution */
  toolResult: { name: string; result: ToolResult }
  /** Story execution completed */
  storyResult: StoryResult
  /** Validation request */
  validate: { content: string }
  /** Validation result */
  validated: { valid: boolean; errors: string[] }
}

/**
 * Agent events as BPEvents for behavioral programming.
 */
export type AgentEvents = EventDetails & AgentEventTypes

/**
 * Context passed to the world agent bProgram.
 */
export type AgentContext = {
  /** Tool registry for executing function calls */
  tools: ToolRegistry
  /** Model client for generating responses */
  model: {
    chatCompletion: (args: {
      messages: TrajectoryMessage[]
      tools?: ToolSchema[]
    }) => Promise<{ tool_calls?: FunctionCall[] }>
  }
}

/**
 * Handlers returned by the world agent bProgram.
 */
export type AgentHandlers = Handlers<AgentEventTypes>
