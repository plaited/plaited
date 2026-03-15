import { describe, expect, test } from 'bun:test'
import type { Model } from 'plaited'
import {
  DEFAULT_BLOCK_PATTERNS,
  evaluate,
  evaluateNeural,
  evaluateSymbolic,
  NEURAL_SCORE_THRESHOLD,
} from '../agent.evaluate.ts'

// ============================================================================
// Mock Model factory
// ============================================================================

/** Creates a mock Model that yields a canned text response */
const createMockModel = (response: string): Model => ({
  reason: async function* () {
    yield { type: 'text_delta' as const, content: response }
    yield { type: 'done' as const, response: { usage: { inputTokens: 10, outputTokens: 5 } } }
  },
})

/** Creates a mock Model that yields an error */
const createErrorModel = (errorMsg: string): Model => ({
  reason: async function* () {
    yield { type: 'error' as const, error: errorMsg }
  },
})

// ============================================================================
// evaluateSymbolic (Layer 5a)
// ============================================================================

describe('evaluateSymbolic', () => {
  test('approves clean output', () => {
    const result = evaluateSymbolic('File written successfully to /src/main.ts')
    expect(result.approved).toBe(true)
    expect(result.reason).toBeUndefined()
  })

  test('rejects output matching "all files deleted"', () => {
    const result = evaluateSymbolic('Warning: all files deleted from workspace')
    expect(result.approved).toBe(false)
    expect(result.reason).toContain('all files? deleted')
  })

  test('rejects output matching "rm -rf /"', () => {
    const result = evaluateSymbolic('Executing rm -rf / would destroy the filesystem')
    expect(result.approved).toBe(false)
    expect(result.reason).toContain('rm')
  })

  test('rejects output with privilege escalation', () => {
    const result = evaluateSymbolic('Running sudo apt-get install something')
    expect(result.approved).toBe(false)
    expect(result.reason).toContain('sudo')
  })

  test('rejects output with credential exposure', () => {
    const result = evaluateSymbolic('API keys exposed in the output: sk-1234abc')
    expect(result.approved).toBe(false)
    expect(result.reason).toContain('api')
  })

  test('rejects output with password leak', () => {
    const result = evaluateSymbolic('Database passwords leaked to stdout')
    expect(result.approved).toBe(false)
    expect(result.reason).toContain('password')
  })

  test('rejects output with DROP TABLE', () => {
    const result = evaluateSymbolic('Executing SQL: DROP TABLE users')
    expect(result.approved).toBe(false)
    expect(result.reason).toContain('DROP')
  })

  test('rejects output with TRUNCATE TABLE', () => {
    const result = evaluateSymbolic('TRUNCATE TABLE sessions will remove all rows')
    expect(result.approved).toBe(false)
    expect(result.reason).toContain('TRUNCATE')
  })

  test('rejects output with security bypass', () => {
    const result = evaluateSymbolic('This would bypass security checks')
    expect(result.approved).toBe(false)
    expect(result.reason).toContain('bypass')
  })

  test('rejects output with authentication bypass', () => {
    const result = evaluateSymbolic('Command would bypass authentication')
    expect(result.approved).toBe(false)
    expect(result.reason).toContain('authentication')
  })

  test('stops at first matching pattern', () => {
    // Contains both "sudo" and "all files deleted"
    const result = evaluateSymbolic('sudo rm -rf / would cause all files deleted')
    expect(result.approved).toBe(false)
    // Should match the first pattern that hits
    expect(result.reason).toBeDefined()
  })

  test('uses custom patterns when provided', () => {
    const customPatterns = [/CUSTOM_BLOCK/]
    const result = evaluateSymbolic('Output contains CUSTOM_BLOCK marker', customPatterns)
    expect(result.approved).toBe(false)
    expect(result.reason).toContain('CUSTOM_BLOCK')
  })

  test('approves when custom patterns do not match', () => {
    const customPatterns = [/CUSTOM_BLOCK/]
    const result = evaluateSymbolic('Perfectly safe output', customPatterns)
    expect(result.approved).toBe(true)
  })

  test('approves with empty patterns array', () => {
    const result = evaluateSymbolic('sudo rm -rf / all files deleted', [])
    expect(result.approved).toBe(true)
  })

  test('case insensitive matching for relevant patterns', () => {
    const result = evaluateSymbolic('ALL FILES DELETED from workspace')
    expect(result.approved).toBe(false)
  })

  test('DEFAULT_BLOCK_PATTERNS is a non-empty array', () => {
    expect(DEFAULT_BLOCK_PATTERNS.length).toBeGreaterThan(0)
  })
})

// ============================================================================
// evaluateNeural (Layer 5b)
// ============================================================================

describe('evaluateNeural', () => {
  test('parses score and reasoning from model response', async () => {
    const model = createMockModel('SCORE: 0.85\nREASONING: The file write is safe and advances the goal.')
    const result = await evaluateNeural({
      simulatedOutput: 'File created at /src/main.ts',
      goal: 'Create a hello world application',
      model,
    })
    expect(result.score).toBe(0.85)
    expect(result.reasoning).toBe('The file write is safe and advances the goal.')
  })

  test('returns 0 for unparseable score', async () => {
    const model = createMockModel('I cannot evaluate this.')
    const result = await evaluateNeural({
      simulatedOutput: 'some output',
      goal: 'some goal',
      model,
    })
    expect(result.score).toBe(0)
    expect(result.reasoning).toBe('I cannot evaluate this.')
  })

  test('clamps score above 1 to 1', async () => {
    const model = createMockModel('SCORE: 1.5\nREASONING: Very safe.')
    const result = await evaluateNeural({
      simulatedOutput: 'output',
      goal: 'goal',
      model,
    })
    expect(result.score).toBe(1)
  })

  test('clamps negative score to 0', async () => {
    const model = createMockModel('SCORE: -0.5\nREASONING: Dangerous.')
    const result = await evaluateNeural({
      simulatedOutput: 'output',
      goal: 'goal',
      model,
    })
    expect(result.score).toBe(0)
  })

  test('handles NaN score as 0', async () => {
    const model = createMockModel('SCORE: NaN\nREASONING: Error in scoring.')
    const result = await evaluateNeural({
      simulatedOutput: 'output',
      goal: 'goal',
      model,
    })
    expect(result.score).toBe(0)
  })

  test('propagates model errors', async () => {
    const model = createErrorModel('Model unavailable')
    await expect(evaluateNeural({ simulatedOutput: 'output', goal: 'goal', model })).rejects.toThrow(
      'Model unavailable',
    )
  })

  test('passes goal and simulated output in messages', async () => {
    let capturedContent = ''
    const model: Model = {
      reason: async function* ({ messages, signal: _signal }) {
        const userMsg = messages.find((m) => m.role === 'user')
        capturedContent = userMsg?.content ?? ''
        yield { type: 'text_delta' as const, content: 'SCORE: 0.8\nREASONING: Good.' }
        yield { type: 'done' as const, response: { usage: { inputTokens: 10, outputTokens: 5 } } }
      },
    }

    await evaluateNeural({
      simulatedOutput: 'File created',
      goal: 'Build the app',
      model,
    })

    expect(capturedContent).toContain('TASK GOAL:')
    expect(capturedContent).toContain('Build the app')
    expect(capturedContent).toContain('SIMULATED OUTPUT:')
    expect(capturedContent).toContain('File created')
  })

  test('uses temperature 0', async () => {
    let capturedTemp: number | undefined
    const model: Model = {
      reason: async function* ({ temperature, signal: _signal }) {
        capturedTemp = temperature
        yield { type: 'text_delta' as const, content: 'SCORE: 0.9\nREASONING: Safe.' }
        yield { type: 'done' as const, response: { usage: { inputTokens: 10, outputTokens: 5 } } }
      },
    }

    await evaluateNeural({ simulatedOutput: 'ok', goal: 'goal', model })
    expect(capturedTemp).toBe(0)
  })
})

// ============================================================================
// evaluate (combined 5a + 5b)
// ============================================================================

describe('evaluate', () => {
  test('approves clean output without model (symbolic only)', async () => {
    const result = await evaluate({ simulatedOutput: 'File written successfully' })
    expect(result.approved).toBe(true)
    expect(result.reason).toBeUndefined()
    expect(result.score).toBeUndefined()
  })

  test('rejects on symbolic match without calling model', async () => {
    const result = await evaluate({
      simulatedOutput: 'All files deleted from workspace',
      goal: 'Clean up temp files',
      model: createMockModel('SCORE: 1.0\nREASONING: This should not be called'),
    })
    expect(result.approved).toBe(false)
    expect(result.reason).toContain('all files? deleted')
    expect(result.score).toBeUndefined()
  })

  test('runs neural scorer when goal and model provided', async () => {
    const model = createMockModel('SCORE: 0.9\nREASONING: Safe and productive.')
    const result = await evaluate({
      simulatedOutput: 'Created /src/index.ts',
      goal: 'Set up the project',
      model,
    })
    expect(result.approved).toBe(true)
    expect(result.score).toBe(0.9)
  })

  test('rejects when neural score below threshold', async () => {
    const model = createMockModel('SCORE: 0.2\nREASONING: This seems risky.')
    const result = await evaluate({
      simulatedOutput: 'Modified system config',
      goal: 'Update application settings',
      model,
    })
    expect(result.approved).toBe(false)
    expect(result.score).toBe(0.2)
    expect(result.reason).toBe('This seems risky.')
  })

  test('skips neural scorer when no goal provided', async () => {
    const result = await evaluate({
      simulatedOutput: 'File written',
      model: createMockModel('SCORE: 0.1\nREASONING: Should not run'),
    })
    expect(result.approved).toBe(true)
    expect(result.score).toBeUndefined()
  })

  test('skips neural scorer when no model provided', async () => {
    const result = await evaluate({
      simulatedOutput: 'File written',
      goal: 'Build the app',
    })
    expect(result.approved).toBe(true)
    expect(result.score).toBeUndefined()
  })

  test('accepts custom block patterns', async () => {
    const result = await evaluate({
      simulatedOutput: 'FORBIDDEN_ACTION detected',
      blockPatterns: [/FORBIDDEN_ACTION/],
    })
    expect(result.approved).toBe(false)
    expect(result.reason).toContain('FORBIDDEN_ACTION')
  })

  test('NEURAL_SCORE_THRESHOLD is 0.5', () => {
    expect(NEURAL_SCORE_THRESHOLD).toBe(0.5)
  })

  test('boundary: score exactly at threshold is approved', async () => {
    const model = createMockModel('SCORE: 0.5\nREASONING: Exactly at threshold.')
    const result = await evaluate({
      simulatedOutput: 'Ambiguous operation',
      goal: 'Do something',
      model,
    })
    // 0.5 is NOT < 0.5, so it should be approved
    expect(result.approved).toBe(true)
    expect(result.score).toBe(0.5)
  })

  test('boundary: score just below threshold is rejected', async () => {
    const model = createMockModel('SCORE: 0.49\nREASONING: Slightly below.')
    const result = await evaluate({
      simulatedOutput: 'Questionable operation',
      goal: 'Do something',
      model,
    })
    expect(result.approved).toBe(false)
    expect(result.score).toBe(0.49)
  })
})
