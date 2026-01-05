/**
 * Reward computation utilities for training the world agent.
 * Converts story execution results into reward signals.
 */

import type { RewardConfig, StoryResult, Trajectory, TrajectoryMessage } from './agent.types.ts'

/**
 * Default weights for reward computation.
 */
const DEFAULT_WEIGHTS: Required<RewardConfig> = {
  storyWeight: 0.5,
  a11yWeight: 0.3,
  assertionWeight: 0.2,
}

/**
 * Computes a reward signal from a story result.
 *
 * @param result The story execution result
 * @param config Optional weight configuration
 * @returns A reward value between 0.0 and 1.0
 *
 * @remarks
 * The reward is computed as a weighted sum of:
 * - Story pass/fail (binary)
 * - Accessibility pass/fail (binary)
 * - Assertion ratio (continuous)
 *
 * @example
 * ```typescript
 * const result: StoryResult = {
 *   passed: true,
 *   totalAssertions: 5,
 *   passedAssertions: 4,
 *   a11yPassed: true,
 *   errors: []
 * }
 *
 * const reward = computeReward(result)
 * // reward ≈ 0.5 + 0.3 + (4/5 * 0.2) = 0.96
 * ```
 */
export const computeReward = (result: StoryResult, config?: RewardConfig): number => {
  const weights = { ...DEFAULT_WEIGHTS, ...config }

  const storyScore = result.passed ? 1.0 : 0.0
  const a11yScore = result.a11yPassed ? 1.0 : 0.0
  const assertionScore = result.totalAssertions > 0 ? result.passedAssertions / result.totalAssertions : 0.0

  const reward =
    storyScore * weights.storyWeight + a11yScore * weights.a11yWeight + assertionScore * weights.assertionWeight

  // Clamp to [0, 1]
  return Math.max(0, Math.min(1, reward))
}

/**
 * Creates a trajectory from generation context and story result.
 *
 * @param messages The conversation messages leading to generation
 * @param result The story execution result
 * @param config Optional reward weight configuration
 * @returns A complete trajectory for training
 */
export const createTrajectory = (
  messages: TrajectoryMessage[],
  result: StoryResult,
  config?: RewardConfig,
): Trajectory => {
  return {
    messages,
    reward: computeReward(result, config),
    storyResult: result,
  }
}

/**
 * Formats trajectories as JSONL for training.
 *
 * @param trajectories Array of trajectories to format
 * @returns JSONL string with one trajectory per line
 */
export const formatTrajectoriesJsonl = (trajectories: Trajectory[]): string => {
  return trajectories.map((t) => JSON.stringify(t)).join('\n')
}

/**
 * Filters trajectories by minimum reward threshold.
 * Useful for filtering out low-quality examples.
 *
 * @param trajectories Array of trajectories to filter
 * @param minReward Minimum reward threshold (default: 0.5)
 * @returns Trajectories with reward >= minReward
 */
export const filterByReward = (trajectories: Trajectory[], minReward = 0.5): Trajectory[] => {
  return trajectories.filter((t) => t.reward >= minReward)
}

/**
 * Computes aggregate statistics for a set of trajectories.
 *
 * @param trajectories Array of trajectories to analyze
 * @returns Statistics about the trajectory set
 */
export const computeTrajectoryStats = (
  trajectories: Trajectory[],
): {
  count: number
  meanReward: number
  minReward: number
  maxReward: number
  passRate: number
  a11yPassRate: number
} => {
  if (trajectories.length === 0) {
    return {
      count: 0,
      meanReward: 0,
      minReward: 0,
      maxReward: 0,
      passRate: 0,
      a11yPassRate: 0,
    }
  }

  const rewards = trajectories.map((t) => t.reward)
  const passed = trajectories.filter((t) => t.storyResult?.passed).length
  const a11yPassed = trajectories.filter((t) => t.storyResult?.a11yPassed).length

  return {
    count: trajectories.length,
    meanReward: rewards.reduce((a, b) => a + b, 0) / rewards.length,
    minReward: Math.min(...rewards),
    maxReward: Math.max(...rewards),
    passRate: passed / trajectories.length,
    a11yPassRate: a11yPassed / trajectories.length,
  }
}
