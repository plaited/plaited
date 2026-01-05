/**
 * Trajectory generation utilities for training data.
 * Converts agent execution traces into training trajectories.
 */

import type { FunctionCall, StoryResult, ToolSchema, Trajectory, TrajectoryMessage } from './agent.types.ts'
import { createTrajectory } from './compute-rewards.ts'

/**
 * Represents a recorded agent execution for trajectory generation.
 */
export type ExecutionTrace = {
  /** The user's original intent */
  intent: string
  /** Tool schemas provided to the model */
  toolSchemas: ToolSchema[]
  /** Function calls made by the model */
  functionCalls: FunctionCall[]
  /** Story execution result */
  storyResult: StoryResult
  /** Optional system prompt used */
  systemPrompt?: string
}

/**
 * Formats tool schemas as a system prompt context.
 */
const formatToolContext = (schemas: ToolSchema[]): string => {
  const toolDescriptions = schemas
    .map((s) => {
      const params = Object.entries(s.parameters.properties)
        .map(([name, prop]) => `  - ${name}: ${prop.type}${prop.description ? ` (${prop.description})` : ''}`)
        .join('\n')
      return `${s.name}: ${s.description}\nParameters:\n${params}`
    })
    .join('\n\n')

  return `You are a UI generation agent. Generate templates using the available tools.

Available tools:
${toolDescriptions}`
}

/**
 * Formats function calls as assistant message content.
 */
const formatFunctionCalls = (calls: FunctionCall[]): string => {
  return JSON.stringify(
    calls.map((c) => ({
      function: c.name,
      arguments: JSON.parse(c.arguments),
    })),
    null,
    2,
  )
}

/**
 * Generates a trajectory from an execution trace.
 *
 * @param trace The recorded execution trace
 * @returns A trajectory ready for training
 *
 * @example
 * ```typescript
 * const trace: ExecutionTrace = {
 *   intent: 'Create a primary button',
 *   toolSchemas: [...],
 *   functionCalls: [{ name: 'writeTemplate', arguments: '...' }],
 *   storyResult: { passed: true, ... }
 * }
 *
 * const trajectory = generateTrajectoryFromTrace(trace)
 * ```
 */
export const generateTrajectoryFromTrace = (trace: ExecutionTrace): Trajectory => {
  const systemContent = trace.systemPrompt ?? formatToolContext(trace.toolSchemas)

  const messages: TrajectoryMessage[] = [
    { role: 'system', content: systemContent },
    { role: 'user', content: trace.intent },
    { role: 'assistant', content: formatFunctionCalls(trace.functionCalls) },
  ]

  return createTrajectory(messages, trace.storyResult)
}

/**
 * Generates trajectories from multiple execution traces.
 *
 * @param traces Array of execution traces
 * @returns Array of trajectories
 */
export const generateTrajectories = (traces: ExecutionTrace[]): Trajectory[] => {
  return traces.map(generateTrajectoryFromTrace)
}

/**
 * Configuration for batch trajectory generation from story files.
 */
export type BatchConfig = {
  /** Glob pattern for story files */
  storyPattern: string
  /** Function to run a story and get trace */
  runStory: (path: string) => Promise<ExecutionTrace>
  /** Optional filter for which stories to include */
  filter?: (path: string) => boolean
}

/**
 * Generates trajectories from a batch of story files.
 * Useful for creating training datasets from existing stories.
 *
 * @param config Batch configuration
 * @returns Promise resolving to array of trajectories
 */
export const generateTrajectoriesFromStories = async (config: BatchConfig): Promise<Trajectory[]> => {
  const glob = new Bun.Glob(config.storyPattern)
  const trajectories: Trajectory[] = []

  for await (const path of glob.scan()) {
    if (config.filter && !config.filter(path)) {
      continue
    }

    try {
      const trace = await config.runStory(path)
      const trajectory = generateTrajectoryFromTrace(trace)
      trajectories.push(trajectory)
    } catch (error) {
      console.warn(`Failed to generate trajectory for ${path}:`, error)
    }
  }

  return trajectories
}
