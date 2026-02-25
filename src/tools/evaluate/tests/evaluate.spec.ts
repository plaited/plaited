import { describe, expect, mock, test } from 'bun:test'
import { RISK_CLASS } from '../../../agent/agent.constants.ts'
import type { AgentToolCall } from '../../../agent/agent.schemas.ts'
import type { InferenceCall } from '../../../agent/agent.types.ts'
import {
  buildRewardPrompt,
  checkSymbolicGate,
  createEvaluate,
  DANGEROUS_PREDICTION_PATTERNS,
  parseRewardScore,
} from '../evaluate.ts'

// ============================================================================
// Test helpers
// ============================================================================

const makeToolCall = (overrides: Partial<AgentToolCall> = {}): AgentToolCall => ({
  id: 'tc-1',
  name: 'bash',
  arguments: { command: 'echo hello' },
  ...overrides,
})

// ============================================================================
// checkSymbolicGate
// ============================================================================

describe('checkSymbolicGate', () => {
  test('returns blocked for dangerous prediction', () => {
    const result = checkSymbolicGate('This operation will result in deleting database records.')
    expect(result.blocked).toBe(true)
    expect(result.reason).toContain('deleting database')
  })

  test('returns not blocked for safe prediction', () => {
    const result = checkSymbolicGate('File will be written successfully to /app/config.json.')
    expect(result.blocked).toBe(false)
    expect(result.reason).toBeUndefined()
  })

  test('includes matched text in reason', () => {
    const result = checkSymbolicGate('Warning: fatal error during execution')
    expect(result.blocked).toBe(true)
    expect(result.reason).toContain('fatal error')
  })

  test('uses custom patterns when provided', () => {
    const customPatterns = [/secret leak/i, /api key exposed/i]
    const result = checkSymbolicGate('The API key exposed in output', customPatterns)
    expect(result.blocked).toBe(true)
    expect(result.reason).toContain('API key exposed')
  })

  test('returns not blocked for empty prediction', () => {
    const result = checkSymbolicGate('')
    expect(result.blocked).toBe(false)
  })

  test('case-insensitive matching', () => {
    const result = checkSymbolicGate('DROP TABLE users;')
    expect(result.blocked).toBe(true)

    const result2 = checkSymbolicGate('Kernel Panic detected')
    expect(result2.blocked).toBe(true)
  })

  test('matches word boundary for destroy', () => {
    // "destroy" should match
    const result = checkSymbolicGate('This will destroy the data.')
    expect(result.blocked).toBe(true)

    // "destroyed" should NOT match (word boundary)
    const result2 = checkSymbolicGate('The previous version was destroyed.')
    expect(result2.blocked).toBe(false)
  })

  test('default patterns array is exported', () => {
    expect(DANGEROUS_PREDICTION_PATTERNS).toBeInstanceOf(Array)
    expect(DANGEROUS_PREDICTION_PATTERNS.length).toBeGreaterThan(0)
  })
})

// ============================================================================
// buildRewardPrompt
// ============================================================================

describe('buildRewardPrompt', () => {
  test('builds system message with score scale', () => {
    const messages = buildRewardPrompt({
      prediction: 'File written successfully.',
      toolCall: makeToolCall(),
      goal: 'Write the config file',
    })

    const system = messages.find((m) => m.role === 'system')
    expect(system).toBeDefined()
    expect(system!.content).toContain('Score the predicted outcome')
    expect(system!.content).toContain('1.0')
    expect(system!.content).toContain('0.5')
    expect(system!.content).toContain('0.0')
  })

  test('includes goal, tool call, and prediction', () => {
    const messages = buildRewardPrompt({
      prediction: 'Command will list files.',
      toolCall: makeToolCall({ name: 'bash', arguments: { command: 'ls' } }),
      goal: 'List all project files',
    })

    const user = messages.find((m) => m.role === 'user')
    expect(user).toBeDefined()
    expect(user!.content).toContain('List all project files')
    expect(user!.content).toContain('bash')
    expect(user!.content).toContain('Command will list files.')
  })
})

// ============================================================================
// parseRewardScore
// ============================================================================

describe('parseRewardScore', () => {
  test('parses valid JSON score', () => {
    const result = parseRewardScore({
      choices: [{ message: { content: '{"score": 0.8, "reason": "Good progress"}' } }],
    })
    expect(result.score).toBe(0.8)
    expect(result.reason).toBe('Good progress')
  })

  test('clamps score to 0-1 range', () => {
    const high = parseRewardScore({
      choices: [{ message: { content: '{"score": 5.0}' } }],
    })
    expect(high.score).toBe(1)

    const low = parseRewardScore({
      choices: [{ message: { content: '{"score": -2.0}' } }],
    })
    expect(low.score).toBe(0)
  })

  test('defaults to 0.5 on parse failure', () => {
    const result = parseRewardScore({
      choices: [{ message: { content: 'This is not JSON' } }],
    })
    expect(result.score).toBe(0.5)
  })

  test('defaults to 0.5 when score field is missing', () => {
    const result = parseRewardScore({
      choices: [{ message: { content: '{"reason": "no score"}' } }],
    })
    expect(result.score).toBe(0.5)
  })

  test('strips think tags before parsing', () => {
    const result = parseRewardScore({
      choices: [{ message: { content: '<think>Analyzing...</think>{"score": 0.7, "reason": "On track"}' } }],
    })
    expect(result.score).toBe(0.7)
    expect(result.reason).toBe('On track')
  })

  test('defaults to 0.5 for empty response', () => {
    const result = parseRewardScore({ choices: [] })
    expect(result.score).toBe(0.5)
  })
})

// ============================================================================
// createEvaluate
// ============================================================================

describe('createEvaluate', () => {
  test('runs symbolic gate for side_effects risk class', async () => {
    const mockInference: InferenceCall = async () => ({
      choices: [{ message: { content: '{"score": 0.9}' } }],
    })

    const evaluate = createEvaluate({ inferenceCall: mockInference, model: 'test' })
    const result = await evaluate({
      toolCall: makeToolCall(),
      prediction: 'File written successfully.',
      riskClass: RISK_CLASS.side_effects,
      history: [],
    })

    expect(result.approved).toBe(true)
  })

  test('rejects on symbolic gate match', async () => {
    const mockInference: InferenceCall = async () => ({
      choices: [{ message: { content: '{"score": 0.9}' } }],
    })

    const evaluate = createEvaluate({ inferenceCall: mockInference, model: 'test' })
    const result = await evaluate({
      toolCall: makeToolCall(),
      prediction: 'This will cause data loss in production.',
      riskClass: RISK_CLASS.side_effects,
      history: [],
    })

    expect(result.approved).toBe(false)
    expect(result.reason).toContain('data loss')
  })

  test('skips neural scorer for side_effects (no goal)', async () => {
    const mockInference = mock(async () => ({
      choices: [{ message: { content: '{"score": 0.1}' } }],
    })) as unknown as InferenceCall

    const evaluate = createEvaluate({ inferenceCall: mockInference, model: 'test' })
    const result = await evaluate({
      toolCall: makeToolCall(),
      prediction: 'File written successfully.',
      riskClass: RISK_CLASS.side_effects,
      history: [],
      // no goal
    })

    // Should approve without calling inference (symbolic gate passed, no neural scorer for side_effects)
    expect(result.approved).toBe(true)
    expect(mockInference).not.toHaveBeenCalled()
  })

  test('runs neural scorer for high_ambiguity with goal', async () => {
    const mockInference = mock(async () => ({
      choices: [{ message: { content: '{"score": 0.8, "reason": "Good progress"}' } }],
    })) as unknown as InferenceCall

    const evaluate = createEvaluate({ inferenceCall: mockInference, model: 'test' })
    const result = await evaluate({
      toolCall: makeToolCall(),
      prediction: 'Command executed successfully.',
      riskClass: RISK_CLASS.high_ambiguity,
      history: [],
      goal: 'Deploy the application',
    })

    expect(result.approved).toBe(true)
    expect(result.score).toBe(0.8)
    expect(mockInference).toHaveBeenCalledTimes(1)
  })

  test('rejects when score below threshold', async () => {
    const mockInference: InferenceCall = async () => ({
      choices: [{ message: { content: '{"score": 0.2, "reason": "Off track"}' } }],
    })

    const evaluate = createEvaluate({ inferenceCall: mockInference, model: 'test', scoreThreshold: 0.5 })
    const result = await evaluate({
      toolCall: makeToolCall(),
      prediction: 'The command output was unexpected.',
      riskClass: RISK_CLASS.high_ambiguity,
      history: [],
      goal: 'Deploy the application',
    })

    expect(result.approved).toBe(false)
    expect(result.score).toBe(0.2)
  })

  test('approves when score meets threshold', async () => {
    const mockInference: InferenceCall = async () => ({
      choices: [{ message: { content: '{"score": 0.5, "reason": "On track"}' } }],
    })

    const evaluate = createEvaluate({ inferenceCall: mockInference, model: 'test', scoreThreshold: 0.5 })
    const result = await evaluate({
      toolCall: makeToolCall(),
      prediction: 'The command is running.',
      riskClass: RISK_CLASS.high_ambiguity,
      history: [],
      goal: 'Deploy the application',
    })

    expect(result.approved).toBe(true)
    expect(result.score).toBe(0.5)
  })

  test('skips neural scorer when no goal for high_ambiguity', async () => {
    const mockInference = mock(async () => ({
      choices: [{ message: { content: '{"score": 0.1}' } }],
    })) as unknown as InferenceCall

    const evaluate = createEvaluate({ inferenceCall: mockInference, model: 'test' })
    const result = await evaluate({
      toolCall: makeToolCall(),
      prediction: 'Command executed.',
      riskClass: RISK_CLASS.high_ambiguity,
      history: [],
      // no goal
    })

    expect(result.approved).toBe(true)
    expect(mockInference).not.toHaveBeenCalled()
  })
})
