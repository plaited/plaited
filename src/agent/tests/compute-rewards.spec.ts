import { describe, expect, test } from 'bun:test'
import type { StoryResult, Trajectory } from '../agent.types.ts'
import {
  computeReward,
  computeTrajectoryStats,
  createTrajectory,
  filterByReward,
  formatTrajectoriesJsonl,
} from '../compute-rewards.ts'

describe('computeReward', () => {
  test('returns 1.0 for perfect result', () => {
    const result: StoryResult = {
      passed: true,
      totalAssertions: 5,
      passedAssertions: 5,
      a11yPassed: true,
      errors: [],
    }

    expect(computeReward(result)).toBe(1.0)
  })

  test('returns 0.0 for complete failure', () => {
    const result: StoryResult = {
      passed: false,
      totalAssertions: 5,
      passedAssertions: 0,
      a11yPassed: false,
      errors: ['All assertions failed'],
    }

    expect(computeReward(result)).toBe(0.0)
  })

  test('computes weighted reward correctly', () => {
    const result: StoryResult = {
      passed: true, // 0.5 * 1.0 = 0.5
      totalAssertions: 10,
      passedAssertions: 5, // 0.2 * 0.5 = 0.1
      a11yPassed: false, // 0.3 * 0.0 = 0.0
      errors: [],
    }

    // 0.5 + 0.1 + 0.0 = 0.6
    expect(computeReward(result)).toBeCloseTo(0.6, 2)
  })

  test('handles zero assertions', () => {
    const result: StoryResult = {
      passed: true,
      totalAssertions: 0,
      passedAssertions: 0,
      a11yPassed: true,
      errors: [],
    }

    // 0.5 + 0.3 + 0.0 = 0.8
    expect(computeReward(result)).toBeCloseTo(0.8, 2)
  })

  test('uses custom weights', () => {
    const result: StoryResult = {
      passed: true,
      totalAssertions: 1,
      passedAssertions: 1,
      a11yPassed: true,
      errors: [],
    }

    const reward = computeReward(result, {
      storyWeight: 1.0,
      a11yWeight: 0.0,
      assertionWeight: 0.0,
    })

    expect(reward).toBe(1.0)
  })

  test('clamps reward to [0, 1]', () => {
    const result: StoryResult = {
      passed: true,
      totalAssertions: 1,
      passedAssertions: 1,
      a11yPassed: true,
      errors: [],
    }

    // Weights that would exceed 1.0
    const reward = computeReward(result, {
      storyWeight: 0.8,
      a11yWeight: 0.8,
      assertionWeight: 0.8,
    })

    expect(reward).toBeLessThanOrEqual(1.0)
  })
})

describe('createTrajectory', () => {
  test('creates trajectory with computed reward', () => {
    const messages = [
      { role: 'user' as const, content: 'Create a button' },
      { role: 'assistant' as const, content: '{ "function": "writeTemplate" }' },
    ]

    const result: StoryResult = {
      passed: true,
      totalAssertions: 1,
      passedAssertions: 1,
      a11yPassed: true,
      errors: [],
    }

    const trajectory = createTrajectory(messages, result)

    expect(trajectory.messages).toEqual(messages)
    expect(trajectory.reward).toBe(1.0)
    expect(trajectory.storyResult).toEqual(result)
  })
})

describe('formatTrajectoriesJsonl', () => {
  test('formats trajectories as JSONL', () => {
    const trajectories: Trajectory[] = [
      {
        messages: [{ role: 'user', content: 'test1' }],
        reward: 0.8,
      },
      {
        messages: [{ role: 'user', content: 'test2' }],
        reward: 0.9,
      },
    ]

    const jsonl = formatTrajectoriesJsonl(trajectories)
    const lines = jsonl.split('\n')

    expect(lines).toHaveLength(2)
    expect(JSON.parse(lines[0]!).reward).toBe(0.8)
    expect(JSON.parse(lines[1]!).reward).toBe(0.9)
  })

  test('handles empty array', () => {
    expect(formatTrajectoriesJsonl([])).toBe('')
  })
})

describe('filterByReward', () => {
  test('filters trajectories below threshold', () => {
    const trajectories: Trajectory[] = [
      { messages: [], reward: 0.3 },
      { messages: [], reward: 0.5 },
      { messages: [], reward: 0.7 },
      { messages: [], reward: 0.9 },
    ]

    const filtered = filterByReward(trajectories, 0.5)

    expect(filtered).toHaveLength(3)
    expect(filtered.every((t) => t.reward >= 0.5)).toBe(true)
  })

  test('uses default threshold of 0.5', () => {
    const trajectories: Trajectory[] = [
      { messages: [], reward: 0.4 },
      { messages: [], reward: 0.6 },
    ]

    const filtered = filterByReward(trajectories)

    expect(filtered).toHaveLength(1)
    expect(filtered[0]!.reward).toBe(0.6)
  })
})

describe('computeTrajectoryStats', () => {
  test('computes statistics for trajectory set', () => {
    const trajectories: Trajectory[] = [
      {
        messages: [],
        reward: 0.5,
        storyResult: { passed: true, totalAssertions: 1, passedAssertions: 1, a11yPassed: true, errors: [] },
      },
      {
        messages: [],
        reward: 0.8,
        storyResult: { passed: true, totalAssertions: 1, passedAssertions: 1, a11yPassed: false, errors: [] },
      },
      {
        messages: [],
        reward: 0.3,
        storyResult: { passed: false, totalAssertions: 1, passedAssertions: 0, a11yPassed: true, errors: ['failed'] },
      },
    ]

    const stats = computeTrajectoryStats(trajectories)

    expect(stats.count).toBe(3)
    expect(stats.meanReward).toBeCloseTo(0.533, 2)
    expect(stats.minReward).toBe(0.3)
    expect(stats.maxReward).toBe(0.8)
    expect(stats.passRate).toBeCloseTo(0.667, 2)
    expect(stats.a11yPassRate).toBeCloseTo(0.667, 2)
  })

  test('handles empty array', () => {
    const stats = computeTrajectoryStats([])

    expect(stats.count).toBe(0)
    expect(stats.meanReward).toBe(0)
    expect(stats.passRate).toBe(0)
  })
})
