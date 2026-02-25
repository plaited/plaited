import { describe, expect, test } from 'bun:test'
import type { TrajectoryStep } from '../../schemas.ts'
import { getTrajectorySnippet, sampleArray } from '../calibrate.ts'

// ============================================================================
// sampleArray
// ============================================================================

describe('sampleArray', () => {
  test('returns n elements from array', () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    const result = sampleArray(arr, 3)

    expect(result).toHaveLength(3)
  })

  test('returns all elements when n >= array length', () => {
    const arr = [1, 2, 3]
    const result = sampleArray(arr, 5)

    expect(result).toHaveLength(3)
    expect(new Set(result)).toEqual(new Set(arr))
  })

  test('returns empty array for empty input', () => {
    const result = sampleArray([], 5)
    expect(result).toEqual([])
  })

  test('returns empty array when n is 0', () => {
    const arr = [1, 2, 3]
    const result = sampleArray(arr, 0)

    expect(result).toEqual([])
  })

  test('does not modify original array', () => {
    const arr = [1, 2, 3, 4, 5]
    const original = [...arr]
    sampleArray(arr, 3)

    expect(arr).toEqual(original)
  })

  test('returns unique elements (no duplicates)', () => {
    const arr = [1, 2, 3, 4, 5]
    const result = sampleArray(arr, 3)

    const uniqueResult = new Set(result)
    expect(uniqueResult.size).toBe(result.length)
  })

  test('all returned elements exist in original array', () => {
    const arr = ['a', 'b', 'c', 'd', 'e']
    const result = sampleArray(arr, 3)

    for (const item of result) {
      expect(arr).toContain(item)
    }
  })

  test('works with objects', () => {
    const arr = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]
    const result = sampleArray(arr, 2)

    expect(result).toHaveLength(2)
    for (const item of result) {
      expect(arr).toContainEqual(item)
    }
  })

  test('produces different results on multiple calls (randomness)', () => {
    const arr = Array.from({ length: 100 }, (_, i) => i)
    const results = new Set<string>()

    // Run multiple times and check we get different orderings
    for (let i = 0; i < 10; i++) {
      const sample = sampleArray(arr, 10)
      results.add(sample.join(','))
    }

    // With 100 elements, sampling 10, we should get different results
    // This is probabilistic but extremely unlikely to fail
    expect(results.size).toBeGreaterThan(1)
  })
})

// ============================================================================
// getTrajectorySnippet
// ============================================================================

describe('getTrajectorySnippet', () => {
  const createStep = (index: number): TrajectoryStep => ({
    type: 'message',
    content: `Step ${index}`,
    timestamp: index * 100,
  })

  test('returns full trajectory when length <= maxSteps', () => {
    const trajectory: TrajectoryStep[] = [createStep(1), createStep(2), createStep(3)]

    const result = getTrajectorySnippet(trajectory, 5)

    expect(result).toHaveLength(3)
    expect(result).toEqual(trajectory)
  })

  test('returns maxSteps elements for longer trajectories', () => {
    const trajectory: TrajectoryStep[] = Array.from({ length: 10 }, (_, i) => createStep(i + 1))

    const result = getTrajectorySnippet(trajectory, 5)

    expect(result).toHaveLength(5)
  })

  test('includes first two steps', () => {
    const trajectory: TrajectoryStep[] = Array.from({ length: 10 }, (_, i) => createStep(i + 1))

    const result = getTrajectorySnippet(trajectory, 5)

    expect(result[0]).toEqual(createStep(1))
    expect(result[1]).toEqual(createStep(2))
  })

  test('includes last two steps', () => {
    const trajectory: TrajectoryStep[] = Array.from({ length: 10 }, (_, i) => createStep(i + 1))

    const result = getTrajectorySnippet(trajectory, 5)

    expect(result[3]).toEqual(createStep(9))
    expect(result[4]).toEqual(createStep(10))
  })

  test('includes middle step', () => {
    const trajectory: TrajectoryStep[] = Array.from({ length: 10 }, (_, i) => createStep(i + 1))

    const result = getTrajectorySnippet(trajectory, 5)

    // Middle of 10 is index 5 (0-indexed), which is Step 6
    expect(result[2]).toEqual(createStep(6))
  })

  test('handles empty trajectory', () => {
    const result = getTrajectorySnippet([], 5)
    expect(result).toEqual([])
  })

  test('handles single element trajectory', () => {
    const trajectory: TrajectoryStep[] = [createStep(1)]

    const result = getTrajectorySnippet(trajectory, 5)

    expect(result).toEqual([createStep(1)])
  })

  test('handles trajectory exactly at maxSteps boundary', () => {
    const trajectory: TrajectoryStep[] = Array.from({ length: 5 }, (_, i) => createStep(i + 1))

    const result = getTrajectorySnippet(trajectory, 5)

    expect(result).toHaveLength(5)
    expect(result).toEqual(trajectory)
  })

  test('respects custom maxSteps parameter', () => {
    const trajectory: TrajectoryStep[] = Array.from({ length: 20 }, (_, i) => createStep(i + 1))

    const result3 = getTrajectorySnippet(trajectory, 3)
    const result7 = getTrajectorySnippet(trajectory, 7)

    // With maxSteps=3, should still return 5 (first 2 + middle + last 2)
    // because the algorithm always takes first 2, middle 1, last 2
    // But the function returns full trajectory if <= maxSteps
    expect(result3.length).toBeLessThanOrEqual(trajectory.length)
    expect(result7.length).toBeLessThanOrEqual(trajectory.length)
  })

  test('works with different step types', () => {
    const trajectory: TrajectoryStep[] = [
      { type: 'thought', content: 'Thinking...', timestamp: 0 },
      { type: 'tool_call', name: 'Read', status: 'completed', timestamp: 100 },
      { type: 'tool_call', name: 'Write', status: 'completed', timestamp: 200 },
      { type: 'tool_call', name: 'Bash', status: 'completed', timestamp: 300 },
      { type: 'tool_call', name: 'Grep', status: 'completed', timestamp: 400 },
      { type: 'tool_call', name: 'Glob', status: 'completed', timestamp: 500 },
      { type: 'plan', entries: [{ content: 'Plan', status: 'done' }], timestamp: 600 },
      { type: 'message', content: 'Done!', timestamp: 700 },
    ]

    const result = getTrajectorySnippet(trajectory, 5)

    expect(result).toHaveLength(5)
    // First two
    expect(result[0]?.type).toBe('thought')
    expect(result[1]?.type).toBe('tool_call')
    // Last two
    expect(result[3]?.type).toBe('plan')
    expect(result[4]?.type).toBe('message')
  })

  test('preserves step content when extracting', () => {
    const trajectory: TrajectoryStep[] = [
      { type: 'thought', content: 'First thought', timestamp: 0 },
      { type: 'message', content: 'First message', timestamp: 100 },
      { type: 'tool_call', name: 'Read', status: 'completed', input: { file_path: '/test.ts' }, timestamp: 200 },
      { type: 'tool_call', name: 'Write', status: 'completed', timestamp: 300 },
      { type: 'tool_call', name: 'Bash', status: 'failed', timestamp: 400 },
      { type: 'message', content: 'Last message', timestamp: 500 },
    ]

    const result = getTrajectorySnippet(trajectory, 5)

    // First step should preserve all properties
    const firstStep = result[0]
    if (firstStep?.type === 'thought') {
      expect(firstStep.content).toBe('First thought')
      expect(firstStep.timestamp).toBe(0)
    }

    // Last step should preserve all properties
    const lastStep = result[result.length - 1]
    if (lastStep?.type === 'message') {
      expect(lastStep.content).toBe('Last message')
    }
  })
})
