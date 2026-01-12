import { describe, expect, test } from 'bun:test'
import type { FunctionCall, StoryResult } from '../agent.types.ts'
import {
  computeReward,
  computeTrajectoryStats,
  filterByReward,
  filterPassing,
  formatFunctionGemmaCalls,
  formatTrajectoriesJsonl,
  generateTrajectoryFromTrace,
  parseFunctionGemmaOutput,
  parseTrajectoriesJsonl,
} from '../training-utils.ts'

// ============================================================================
// FunctionGemma Parsing Tests
// ============================================================================

describe('parseFunctionGemmaOutput', () => {
  test('parses single function call with string param', () => {
    const output = '<start_function_call>call:writeTemplate{path:<escape>button.tsx<escape>}<end_function_call>'
    const calls = parseFunctionGemmaOutput(output)

    expect(calls).toHaveLength(1)
    expect(calls[0]?.name).toBe('writeTemplate')
    expect(JSON.parse(calls[0]!.arguments)).toEqual({ path: 'button.tsx' })
  })

  test('parses multiple parameters', () => {
    const output =
      '<start_function_call>call:writeTemplate{path:<escape>button.tsx<escape>,content:<escape>export const Button = () => <button>Click</button><escape>}<end_function_call>'
    const calls = parseFunctionGemmaOutput(output)

    expect(calls).toHaveLength(1)
    expect(calls[0]?.name).toBe('writeTemplate')
    const args = JSON.parse(calls[0]!.arguments)
    expect(args.path).toBe('button.tsx')
    expect(args.content).toBe('export const Button = () => <button>Click</button>')
  })

  test('parses multiple function calls', () => {
    const output = `<start_function_call>call:writeTemplate{path:<escape>button.tsx<escape>}<end_function_call><start_function_call>call:writeStyles{path:<escape>button.css.ts<escape>}<end_function_call>`
    const calls = parseFunctionGemmaOutput(output)

    expect(calls).toHaveLength(2)
    expect(calls[0]?.name).toBe('writeTemplate')
    expect(calls[1]?.name).toBe('writeStyles')
  })

  test('parses boolean values', () => {
    const output =
      '<start_function_call>call:config{enabled:<escape>true<escape>,disabled:<escape>false<escape>}<end_function_call>'
    const calls = parseFunctionGemmaOutput(output)

    const args = JSON.parse(calls[0]!.arguments)
    expect(args.enabled).toBe(true)
    expect(args.disabled).toBe(false)
  })

  test('parses numeric values', () => {
    const output =
      '<start_function_call>call:config{count:<escape>42<escape>,ratio:<escape>3.14<escape>}<end_function_call>'
    const calls = parseFunctionGemmaOutput(output)

    const args = JSON.parse(calls[0]!.arguments)
    expect(args.count).toBe(42)
    expect(args.ratio).toBe(3.14)
  })

  test('parses JSON object values', () => {
    const output = '<start_function_call>call:config{options:<escape>{"nested": true}<escape>}<end_function_call>'
    const calls = parseFunctionGemmaOutput(output)

    const args = JSON.parse(calls[0]!.arguments)
    expect(args.options).toEqual({ nested: true })
  })

  test('parses JSON array values', () => {
    const output = '<start_function_call>call:config{items:<escape>["a", "b", "c"]<escape>}<end_function_call>'
    const calls = parseFunctionGemmaOutput(output)

    const args = JSON.parse(calls[0]!.arguments)
    expect(args.items).toEqual(['a', 'b', 'c'])
  })

  test('returns empty array for invalid output', () => {
    const output = 'This is not a function call'
    const calls = parseFunctionGemmaOutput(output)

    expect(calls).toHaveLength(0)
  })

  test('handles multiline content in escape markers', () => {
    const content = `export const Button = () => {
  return <button>Click me</button>
}`
    const output = `<start_function_call>call:writeTemplate{path:<escape>button.tsx<escape>,content:<escape>${content}<escape>}<end_function_call>`
    const calls = parseFunctionGemmaOutput(output)

    const args = JSON.parse(calls[0]!.arguments)
    expect(args.content).toBe(content)
  })

  test('handles text before and after function calls', () => {
    const output = `Here is my response:
<start_function_call>call:writeTemplate{path:<escape>button.tsx<escape>}<end_function_call>
I have created the file.`
    const calls = parseFunctionGemmaOutput(output)

    expect(calls).toHaveLength(1)
    expect(calls[0]?.name).toBe('writeTemplate')
  })
})

describe('formatFunctionGemmaCalls', () => {
  test('formats single function call', () => {
    const calls: FunctionCall[] = [{ name: 'writeTemplate', arguments: JSON.stringify({ path: 'button.tsx' }) }]
    const output = formatFunctionGemmaCalls(calls)

    expect(output).toBe('<start_function_call>call:writeTemplate{path:<escape>button.tsx<escape>}<end_function_call>')
  })

  test('formats multiple parameters', () => {
    const calls: FunctionCall[] = [
      { name: 'writeTemplate', arguments: JSON.stringify({ path: 'button.tsx', content: 'code' }) },
    ]
    const output = formatFunctionGemmaCalls(calls)

    expect(output).toContain('path:<escape>button.tsx<escape>')
    expect(output).toContain('content:<escape>code<escape>')
  })

  test('formats multiple function calls', () => {
    const calls: FunctionCall[] = [
      { name: 'writeTemplate', arguments: JSON.stringify({ path: 'a.tsx' }) },
      { name: 'writeStyles', arguments: JSON.stringify({ path: 'b.css.ts' }) },
    ]
    const output = formatFunctionGemmaCalls(calls)

    expect(output).toContain('<start_function_call>call:writeTemplate')
    expect(output).toContain('<start_function_call>call:writeStyles')
  })

  test('round-trips with parseFunctionGemmaOutput', () => {
    const original: FunctionCall[] = [
      { name: 'writeTemplate', arguments: JSON.stringify({ path: 'button.tsx', enabled: true, count: 5 }) },
    ]
    const formatted = formatFunctionGemmaCalls(original)
    const parsed = parseFunctionGemmaOutput(formatted)

    expect(parsed).toHaveLength(1)
    expect(parsed[0]?.name).toBe('writeTemplate')
    expect(JSON.parse(parsed[0]!.arguments)).toEqual({ path: 'button.tsx', enabled: true, count: 5 })
  })
})

// ============================================================================
// Reward Computation Tests
// ============================================================================

describe('computeReward', () => {
  test('computes perfect reward for passing story', () => {
    const result: StoryResult = {
      passed: true,
      a11yPassed: true,
      totalAssertions: 5,
      passedAssertions: 5,
      errors: [],
    }
    const reward = computeReward(result)

    expect(reward).toBe(1)
  })

  test('computes zero reward for failing story', () => {
    const result: StoryResult = {
      passed: false,
      a11yPassed: false,
      totalAssertions: 5,
      passedAssertions: 0,
      errors: ['Failed'],
    }
    const reward = computeReward(result)

    expect(reward).toBe(0)
  })

  test('computes partial reward', () => {
    const result: StoryResult = {
      passed: true,
      a11yPassed: false,
      totalAssertions: 4,
      passedAssertions: 2,
      errors: [],
    }
    // story: 1 * 0.5 = 0.5
    // a11y: 0 * 0.3 = 0
    // assertions: 0.5 * 0.2 = 0.1
    const reward = computeReward(result)

    expect(reward).toBeCloseTo(0.6)
  })

  test('respects custom weights', () => {
    const result: StoryResult = {
      passed: true,
      a11yPassed: true,
      totalAssertions: 0,
      passedAssertions: 0,
      errors: [],
    }
    const reward = computeReward(result, {
      storyWeight: 0.3,
      a11yWeight: 0.5,
      assertionWeight: 0.2,
    })

    // story: 1 * 0.3 = 0.3
    // a11y: 1 * 0.5 = 0.5
    // assertions: 1 * 0.2 = 0.2 (no assertions = 1)
    expect(reward).toBe(1)
  })
})

// ============================================================================
// Trajectory Generation Tests
// ============================================================================

describe('generateTrajectoryFromTrace', () => {
  test('generates trajectory with computed reward', () => {
    const trace = {
      intent: 'Create a button',
      toolSchemas: [],
      functionCalls: [{ name: 'writeTemplate', arguments: '{}' }],
      storyResult: {
        passed: true,
        a11yPassed: true,
        totalAssertions: 1,
        passedAssertions: 1,
        errors: [],
      },
    }
    const trajectory = generateTrajectoryFromTrace(trace)

    expect(trajectory.intent).toBe('Create a button')
    expect(trajectory.toolCalls).toHaveLength(1)
    expect(trajectory.reward).toBe(1)
  })
})

// ============================================================================
// Statistics Tests
// ============================================================================

describe('computeTrajectoryStats', () => {
  test('computes stats for trajectories', () => {
    const trajectories = [
      {
        intent: 'a',
        toolCalls: [],
        result: { passed: true, a11yPassed: true, totalAssertions: 1, passedAssertions: 1, errors: [] },
        reward: 1,
      },
      {
        intent: 'b',
        toolCalls: [],
        result: { passed: false, a11yPassed: true, totalAssertions: 1, passedAssertions: 0, errors: ['failed'] },
        reward: 0.5,
      },
    ]
    const stats = computeTrajectoryStats(trajectories)

    expect(stats.count).toBe(2)
    expect(stats.meanReward).toBe(0.75)
    expect(stats.passRate).toBe(0.5)
    expect(stats.a11yPassRate).toBe(1)
    expect(stats.minReward).toBe(0.5)
    expect(stats.maxReward).toBe(1)
  })

  test('handles empty array', () => {
    const stats = computeTrajectoryStats([])

    expect(stats.count).toBe(0)
    expect(stats.meanReward).toBe(0)
  })
})

// ============================================================================
// Filtering Tests
// ============================================================================

describe('filterByReward', () => {
  test('filters trajectories by minimum reward', () => {
    const trajectories = [
      {
        intent: 'a',
        toolCalls: [],
        result: { passed: true, a11yPassed: true, totalAssertions: 0, passedAssertions: 0, errors: [] },
        reward: 0.8,
      },
      {
        intent: 'b',
        toolCalls: [],
        result: { passed: true, a11yPassed: true, totalAssertions: 0, passedAssertions: 0, errors: [] },
        reward: 0.4,
      },
    ]
    const filtered = filterByReward(trajectories, 0.5)

    expect(filtered).toHaveLength(1)
    expect(filtered[0]?.intent).toBe('a')
  })
})

describe('filterPassing', () => {
  test('filters to passing trajectories', () => {
    const trajectories = [
      {
        intent: 'a',
        toolCalls: [],
        result: { passed: true, a11yPassed: true, totalAssertions: 0, passedAssertions: 0, errors: [] },
        reward: 1,
      },
      {
        intent: 'b',
        toolCalls: [],
        result: { passed: false, a11yPassed: true, totalAssertions: 0, passedAssertions: 0, errors: ['failed'] },
        reward: 0.5,
      },
    ]
    const filtered = filterPassing(trajectories)

    expect(filtered).toHaveLength(1)
    expect(filtered[0]?.intent).toBe('a')
  })
})

// ============================================================================
// JSONL Formatting Tests
// ============================================================================

describe('formatTrajectoriesJsonl', () => {
  test('formats trajectories as JSONL', () => {
    const trajectories = [
      {
        intent: 'a',
        toolCalls: [],
        result: { passed: true, a11yPassed: true, totalAssertions: 0, passedAssertions: 0, errors: [] },
        reward: 1,
      },
      {
        intent: 'b',
        toolCalls: [],
        result: { passed: true, a11yPassed: true, totalAssertions: 0, passedAssertions: 0, errors: [] },
        reward: 1,
      },
    ]
    const jsonl = formatTrajectoriesJsonl(trajectories)
    const lines = jsonl.split('\n')

    expect(lines).toHaveLength(2)
    expect(JSON.parse(lines[0]!).intent).toBe('a')
    expect(JSON.parse(lines[1]!).intent).toBe('b')
  })
})

describe('parseTrajectoriesJsonl', () => {
  test('parses JSONL back to trajectories', () => {
    const jsonl = '{"intent":"a","reward":1}\n{"intent":"b","reward":0.5}'
    const trajectories = parseTrajectoriesJsonl(jsonl)

    expect(trajectories).toHaveLength(2)
    expect(trajectories[0]?.intent).toBe('a')
    expect(trajectories[1]?.intent).toBe('b')
  })
})
