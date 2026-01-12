/**
 * Training utilities for trajectory generation and reward computation.
 *
 * @remarks
 * These utilities support the training pipeline:
 * - Generate trajectories from story execution traces
 * - Compute rewards from story results
 * - Format trajectories for training (JSONL)
 *
 * For structural metadata extraction, use `extractStructuralMetadata`
 * from `preference-constraints.ts`.
 */

import type { FunctionCall, StoryResult, ToolSchema, TrajectoryWithTiers } from './agent.types.ts'

// ============================================================================
// Execution Trace
// ============================================================================

/**
 * Execution trace from a story test run.
 *
 * @remarks
 * Captures the full context of a generation attempt:
 * - User intent
 * - Available tools
 * - Function calls made
 * - Final story result
 */
export type ExecutionTrace = {
  /** User intent that initiated generation */
  intent: string
  /** Tool schemas available during generation */
  toolSchemas: ToolSchema[]
  /** Function calls made by the agent */
  functionCalls: FunctionCall[]
  /** Story test result */
  storyResult: StoryResult
}

// ============================================================================
// Trajectory Types
// ============================================================================

/**
 * Base trajectory for training.
 *
 * @remarks
 * A trajectory represents a complete generation episode.
 * Used for fine-tuning the world agent model.
 */
export type Trajectory = {
  /** User intent */
  intent: string
  /** Tool calls made during generation */
  toolCalls: FunctionCall[]
  /** Story execution result */
  result: StoryResult
  /** Computed reward (0-1) */
  reward: number
}

// ============================================================================
// Trajectory Generation
// ============================================================================

/**
 * Generate a trajectory from an execution trace.
 *
 * @param trace - Execution trace from story test
 * @param weights - Optional custom reward weights
 * @returns Trajectory for training
 */
export const generateTrajectoryFromTrace = (trace: ExecutionTrace, weights?: RewardWeights): Trajectory => {
  const reward = computeReward(trace.storyResult, weights)

  return {
    intent: trace.intent,
    toolCalls: trace.functionCalls,
    result: trace.storyResult,
    reward,
  }
}

// ============================================================================
// Reward Computation
// ============================================================================

/**
 * Weights for reward computation.
 */
export type RewardWeights = {
  /** Weight for story pass/fail (default: 0.5) */
  storyWeight?: number
  /** Weight for accessibility (default: 0.3) */
  a11yWeight?: number
  /** Weight for assertion ratio (default: 0.2) */
  assertionWeight?: number
}

/**
 * Default reward weights.
 */
const DEFAULT_WEIGHTS: Required<RewardWeights> = {
  storyWeight: 0.5,
  a11yWeight: 0.3,
  assertionWeight: 0.2,
}

/**
 * Compute reward from story result.
 *
 * @param result - Story execution result
 * @param weights - Optional custom weights
 * @returns Reward value (0-1)
 *
 * @remarks
 * Default weights:
 * - Story pass/fail: 50%
 * - Accessibility: 30%
 * - Assertion ratio: 20%
 */
export const computeReward = (result: StoryResult, weights?: RewardWeights): number => {
  const w = { ...DEFAULT_WEIGHTS, ...weights }

  const storyScore = result.passed ? 1 : 0
  const a11yScore = result.a11yPassed ? 1 : 0
  const assertionScore = result.totalAssertions > 0 ? result.passedAssertions / result.totalAssertions : 1

  return storyScore * w.storyWeight + a11yScore * w.a11yWeight + assertionScore * w.assertionWeight
}

// ============================================================================
// Statistics
// ============================================================================

/**
 * Statistics for a set of trajectories.
 */
export type TrajectoryStats = {
  count: number
  meanReward: number
  passRate: number
  a11yPassRate: number
  minReward: number
  maxReward: number
}

/**
 * Compute statistics for trajectories.
 *
 * @param trajectories - Array of trajectories
 * @returns Aggregate statistics
 */
export const computeTrajectoryStats = (trajectories: Array<Trajectory | TrajectoryWithTiers>): TrajectoryStats => {
  if (trajectories.length === 0) {
    return {
      count: 0,
      meanReward: 0,
      passRate: 0,
      a11yPassRate: 0,
      minReward: 0,
      maxReward: 0,
    }
  }

  const rewards = trajectories.map((t) => t.reward ?? 0)
  const passed = trajectories.filter((t) => t.result.passed).length
  const a11yPassed = trajectories.filter((t) => t.result.a11yPassed).length

  return {
    count: trajectories.length,
    meanReward: rewards.reduce((a, b) => a + b, 0) / trajectories.length,
    passRate: passed / trajectories.length,
    a11yPassRate: a11yPassed / trajectories.length,
    minReward: Math.min(...rewards),
    maxReward: Math.max(...rewards),
  }
}

// ============================================================================
// Filtering
// ============================================================================

/**
 * Filter trajectories by minimum reward threshold.
 *
 * @param trajectories - Array of trajectories
 * @param minReward - Minimum reward threshold (0-1)
 * @returns Filtered trajectories
 */
export const filterByReward = <T extends Trajectory | TrajectoryWithTiers>(trajectories: T[], minReward: number): T[] =>
  trajectories.filter((t) => (t.reward ?? 0) >= minReward)

/**
 * Filter to only passing trajectories.
 *
 * @param trajectories - Array of trajectories
 * @returns Trajectories where story passed
 */
export const filterPassing = <T extends Trajectory | TrajectoryWithTiers>(trajectories: T[]): T[] =>
  trajectories.filter((t) => t.result.passed)

// ============================================================================
// Formatting
// ============================================================================

/**
 * Format trajectories as JSONL for training.
 *
 * @param trajectories - Array of trajectories
 * @returns JSONL string (one JSON object per line)
 */
export const formatTrajectoriesJsonl = (trajectories: Array<Trajectory | TrajectoryWithTiers>): string =>
  trajectories.map((t) => JSON.stringify(t)).join('\n')

/**
 * Parse JSONL back to trajectories.
 *
 * @param jsonl - JSONL string
 * @returns Array of trajectories
 */
export const parseTrajectoriesJsonl = (jsonl: string): Trajectory[] =>
  jsonl
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as Trajectory)

// ============================================================================
// FunctionGemma Format Parsing
// ============================================================================

/**
 * Parse FunctionGemma model output back to FunctionCall array.
 *
 * @param output - Raw model output string
 * @returns Array of parsed function calls
 *
 * @remarks
 * FunctionGemma uses a specific format for function calls:
 * ```
 * <start_function_call>call:toolName{param:<escape>value<escape>}<end_function_call>
 * ```
 *
 * This parser:
 * - Extracts all function calls between delimiters
 * - Parses the function name after `call:`
 * - Handles `<escape>` markers around parameter values
 * - Converts parameters to JSON string format
 *
 * @example
 * ```typescript
 * const output = '<start_function_call>call:writeTemplate{path:<escape>button.tsx<escape>}<end_function_call>'
 * const calls = parseFunctionGemmaOutput(output)
 * // Returns: [{ name: 'writeTemplate', arguments: '{"path":"button.tsx"}' }]
 * ```
 */
export const parseFunctionGemmaOutput = (output: string): FunctionCall[] => {
  const calls: FunctionCall[] = []

  // Match all function calls between delimiters
  const callPattern = /<start_function_call>([\s\S]*?)<end_function_call>/g

  for (const match of output.matchAll(callPattern)) {
    const callContent = match[1]?.trim()
    if (!callContent) continue

    // Parse the call:name{params} format
    const callMatch = callContent.match(/^call:(\w+)\{([\s\S]*)\}$/)
    if (!callMatch) continue

    const name = callMatch[1]!
    const paramsStr = callMatch[2]!

    // Parse parameters with <escape> markers
    const args = parseEscapedParams(paramsStr)

    calls.push({
      name,
      arguments: JSON.stringify(args),
    })
  }

  return calls
}

/**
 * Parse parameter string with `<escape>` markers.
 *
 * @internal
 */
const parseEscapedParams = (paramsStr: string): Record<string, unknown> => {
  const args: Record<string, unknown> = {}

  // Match param:<escape>value<escape> patterns
  // Values can contain commas, so we need to handle nested escape markers
  const paramPattern = /(\w+):<escape>([\s\S]*?)<escape>/g

  for (const match of paramsStr.matchAll(paramPattern)) {
    const key = match[1]!
    let value: unknown = match[2]!

    // Try to parse as JSON for nested objects/arrays
    if (typeof value === 'string') {
      const trimmed = value.trim()
      if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
        try {
          value = JSON.parse(trimmed)
        } catch {
          // Keep as string if not valid JSON
        }
      } else if (trimmed === 'true') {
        value = true
      } else if (trimmed === 'false') {
        value = false
      } else if (/^-?\d+$/.test(trimmed)) {
        value = parseInt(trimmed, 10)
      } else if (/^-?\d+\.\d+$/.test(trimmed)) {
        value = parseFloat(trimmed)
      }
    }

    args[key] = value
  }

  return args
}

/**
 * Format function calls to FunctionGemma format.
 *
 * @param calls - Array of function calls
 * @returns FunctionGemma formatted string
 *
 * @remarks
 * Inverse of `parseFunctionGemmaOutput`. Used for generating
 * training data in the expected model format.
 */
export const formatFunctionGemmaCalls = (calls: FunctionCall[]): string =>
  calls
    .map((call) => {
      const args = JSON.parse(call.arguments) as Record<string, unknown>
      const paramsStr = Object.entries(args)
        .map(([key, value]) => {
          const valueStr = typeof value === 'string' ? value : JSON.stringify(value)
          return `${key}:<escape>${valueStr}<escape>`
        })
        .join(',')

      return `<start_function_call>call:${call.name}{${paramsStr}}<end_function_call>`
    })
    .join('')
