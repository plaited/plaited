/**
 * Trajectory generation utilities for training data.
 * Converts agent execution traces into training trajectories.
 */

import type { FunctionCall, StoryResult, ToolResult, ToolSchema, Trajectory, TrajectoryMessage } from './agent.types.ts'
import { createTrajectory } from './compute-rewards.ts'

/**
 * Minimal story metadata needed for intent extraction.
 */
export type StoryInfo = {
  /** Export name from the story file (e.g., "PrimaryButton") */
  exportName: string
  /** File path to the story */
  filePath: string
  /** Optional description from TSDoc or meta */
  description?: string
}

/**
 * Extracts a natural language intent from story metadata.
 * Converts PascalCase/camelCase export names to readable phrases.
 *
 * @param story Story metadata
 * @returns Natural language intent string
 *
 * @remarks
 * Priority order:
 * 1. Explicit description if provided
 * 2. Parsed export name (PascalCase → words)
 * 3. File path as fallback
 */
export const extractIntent = (story: StoryInfo): string => {
  // Use explicit description if available
  if (story.description) {
    return story.description
  }

  // Parse PascalCase/camelCase to words, keeping acronyms together
  // "PrimaryButton" → "primary button"
  // "UIButton" → "ui button"
  // "IconButtonWithTooltip" → "icon button with tooltip"
  const words = story.exportName
    // Insert space before uppercase that follows lowercase
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    // Insert space before last capital of consecutive capitals followed by lowercase
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .toLowerCase()

  // Construct intent phrase
  return `Create a ${words}`
}

/**
 * A tool call with its corresponding result.
 */
export type ToolExecution = {
  /** The function call made by the model */
  call: FunctionCall
  /** The result of executing the tool */
  result: ToolResult
  /** Unique identifier for this tool call */
  id: string
}

/**
 * Represents a recorded agent execution for trajectory generation.
 * Supports multi-turn conversations with tool results.
 */
export type ExecutionTrace = {
  /** The user's original intent */
  intent: string
  /** Tool schemas provided to the model */
  toolSchemas: ToolSchema[]
  /** Function calls made by the model (legacy single-turn format) */
  functionCalls?: FunctionCall[]
  /** Tool executions with results (multi-turn format) */
  toolExecutions?: ToolExecution[]
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
 * Escapes a value for FunctionGemma format.
 */
const escapeGemmaValue = (value: unknown): string => {
  const str = typeof value === 'string' ? value : JSON.stringify(value)
  return `<escape>${str}<escape>`
}

/**
 * Formats function calls in FunctionGemma format.
 * Uses the model's native format: <start_function_call>call:name{args}<end_function_call>
 */
const formatFunctionCalls = (calls: FunctionCall[]): string => {
  return calls
    .map((c) => {
      const args = JSON.parse(c.arguments) as Record<string, unknown>
      const argPairs = Object.entries(args)
        .map(([key, value]) => `${key}:${escapeGemmaValue(value)}`)
        .join(',')
      return `<start_function_call>call:${c.name}{${argPairs}}<end_function_call>`
    })
    .join('')
}

/**
 * Parses FunctionGemma format back to FunctionCall array.
 * Inverse of formatFunctionCalls for model response parsing.
 */
export const parseFunctionGemmaOutput = (output: string): FunctionCall[] => {
  const calls: FunctionCall[] = []
  // Match function calls - use non-greedy match up to end marker
  const regex = /<start_function_call>call:(\w+)\{([\s\S]*?)\}<end_function_call>/g

  for (const match of output.matchAll(regex)) {
    const name = match[1]!
    const argsStr = match[2]!

    // Parse arguments from key:<escape>value<escape> format
    // Use [\s\S]*? to match any character including newlines
    const args: Record<string, unknown> = {}
    const argRegex = /(\w+):<escape>([\s\S]*?)<escape>/g

    for (const argMatch of argsStr.matchAll(argRegex)) {
      const key = argMatch[1]!
      let value: unknown = argMatch[2]!
      // Try to parse JSON values (objects, arrays, numbers, booleans)
      try {
        value = JSON.parse(value as string)
      } catch {
        // Keep as string if not valid JSON
      }
      args[key] = value
    }

    calls.push({
      name,
      arguments: JSON.stringify(args),
    })
  }

  return calls
}

/**
 * Generates a unique tool call ID.
 */
const generateToolCallId = (index: number): string => `call_${index.toString().padStart(4, '0')}`

/**
 * Generates a trajectory from an execution trace.
 * Supports both legacy single-turn and multi-turn formats.
 *
 * @param trace The recorded execution trace
 * @returns A trajectory ready for training
 *
 * @remarks
 * If `toolExecutions` is provided, generates multi-turn format with tool results.
 * Otherwise falls back to legacy single-turn format using `functionCalls`.
 */
export const generateTrajectoryFromTrace = (trace: ExecutionTrace): Trajectory => {
  const systemContent = trace.systemPrompt ?? formatToolContext(trace.toolSchemas)

  const messages: TrajectoryMessage[] = [
    { role: 'system', content: systemContent },
    { role: 'user', content: trace.intent },
  ]

  // Multi-turn format with tool results (using FunctionGemma format)
  if (trace.toolExecutions && trace.toolExecutions.length > 0) {
    for (const execution of trace.toolExecutions) {
      // Assistant's tool call in FunctionGemma format
      messages.push({
        role: 'assistant',
        content: formatFunctionCalls([execution.call]),
      })

      // Tool result
      messages.push({
        role: 'tool',
        tool_call_id: execution.id,
        name: execution.call.name,
        content: JSON.stringify(execution.result),
      })
    }
  } else if (trace.functionCalls && trace.functionCalls.length > 0) {
    // Legacy single-turn format
    messages.push({
      role: 'assistant',
      content: formatFunctionCalls(trace.functionCalls),
    })
  }

  return createTrajectory(messages, trace.storyResult)
}

/**
 * Creates tool executions from function calls and results.
 * Utility for converting separate arrays into ToolExecution format.
 *
 * @param calls Array of function calls
 * @param results Array of tool results (must match calls length)
 * @returns Array of ToolExecution objects with generated IDs
 */
export const createToolExecutions = (calls: FunctionCall[], results: ToolResult[]): ToolExecution[] => {
  if (calls.length !== results.length) {
    throw new Error(`Mismatched calls (${calls.length}) and results (${results.length})`)
  }

  return calls.map((call, index) => ({
    call,
    result: results[index]!,
    id: generateToolCallId(index),
  }))
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
