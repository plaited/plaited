/**
 * Tests for the training pipeline.
 *
 * @remarks
 * Covers: computeTrainingWeight, withMetaVerification (k-runs),
 * schema validation, and CLI contract (--schema).
 */

import { describe, expect, test } from 'bun:test'
import * as z from 'zod'
import type { Grader } from '../trial.schemas.ts'
import {
  DecisionStepSchema,
  GradingDimensionsSchema,
  MetaVerificationStatsSchema,
  TrainingWeightResultSchema,
} from '../training.schemas.ts'
import { computeTrainingWeight, TrainingInputSchema, TrainingOutputSchema, withMetaVerification } from '../training.ts'

// ============================================================================
// computeTrainingWeight
// ============================================================================

describe('computeTrainingWeight', () => {
  test('outcome x process', () => {
    expect(computeTrainingWeight({ outcome: 0.8, process: 0.9 })).toBeCloseTo(0.72, 10)
  })

  test('perfect scores yield 1', () => {
    expect(computeTrainingWeight({ outcome: 1.0, process: 1.0 })).toBe(1)
  })

  test('zero outcome yields 0', () => {
    expect(computeTrainingWeight({ outcome: 0, process: 0.9 })).toBe(0)
  })

  test('zero process yields 0', () => {
    expect(computeTrainingWeight({ outcome: 0.9, process: 0 })).toBe(0)
  })

  test('both zero yields 0', () => {
    expect(computeTrainingWeight({ outcome: 0, process: 0 })).toBe(0)
  })

  test('missing outcome defaults to 0', () => {
    expect(computeTrainingWeight({ process: 0.5 })).toBe(0)
  })

  test('missing process defaults to 0', () => {
    expect(computeTrainingWeight({ outcome: 0.5 })).toBe(0)
  })

  test('empty dimensions defaults to 0', () => {
    expect(computeTrainingWeight({})).toBe(0)
  })

  test('efficiency is ignored', () => {
    expect(computeTrainingWeight({ outcome: 0.8, process: 0.5, efficiency: 1.0 })).toBeCloseTo(0.4, 10)
  })
})

// ============================================================================
// withMetaVerification (k-runs)
// ============================================================================

describe('withMetaVerification', () => {
  test('consistent grader produces low stddev', async () => {
    const consistentGrader: Grader = async () => ({
      pass: true,
      score: 0.85,
      reasoning: 'Consistent result',
    })

    const wrapped = withMetaVerification(consistentGrader, 5)
    const result = await wrapped({ input: 'test', output: 'hello' })

    expect(result.pass).toBe(true)
    expect(result.score).toBeCloseTo(0.85, 10)
    expect(result.outcome).toBeDefined()
    expect(result.outcome!._metaVerification).toBeDefined()

    const stats = result.outcome!._metaVerification as {
      mean: number
      stddev: number
      min: number
      max: number
      k: number
      scores: number[]
    }
    expect(stats.mean).toBeCloseTo(0.85, 10)
    expect(stats.stddev).toBe(0)
    expect(stats.k).toBe(5)
    expect(stats.scores).toHaveLength(5)
    expect(stats.min).toBe(0.85)
    expect(stats.max).toBe(0.85)
  })

  test('flaky grader produces high stddev', async () => {
    let callCount = 0
    const flakyGrader: Grader = async () => {
      const pass = callCount++ % 2 === 0
      return { pass, score: pass ? 1.0 : 0.0 }
    }

    const wrapped = withMetaVerification(flakyGrader, 4)
    const result = await wrapped({ input: 'test', output: 'hello' })

    const stats = result.outcome!._metaVerification as { mean: number; stddev: number; min: number; max: number }
    expect(stats.mean).toBe(0.5)
    expect(stats.stddev).toBe(0.5)
    expect(stats.min).toBe(0)
    expect(stats.max).toBe(1)
    // 2 pass, 2 fail → majority vote is false (2 is not > 4/2)
    expect(result.pass).toBe(false)
  })

  test('majority vote for pass', async () => {
    let callCount = 0
    const mostlyPassGrader: Grader = async () => {
      const pass = callCount++ < 3
      return { pass, score: pass ? 1.0 : 0.0 }
    }

    const wrapped = withMetaVerification(mostlyPassGrader, 4)
    const result = await wrapped({ input: 'test', output: 'hello' })

    // 3 pass, 1 fail → 3 > 4/2 → true
    expect(result.pass).toBe(true)
  })

  test('k=1 passes through single result', async () => {
    const grader: Grader = async () => ({
      pass: true,
      score: 0.7,
      reasoning: 'Single run',
    })

    const wrapped = withMetaVerification(grader, 1)
    const result = await wrapped({ input: 'test', output: 'hello' })

    expect(result.score).toBeCloseTo(0.7, 10)
    expect(result.pass).toBe(true)

    const stats = result.outcome!._metaVerification as { stddev: number; k: number }
    expect(stats.stddev).toBe(0)
    expect(stats.k).toBe(1)
  })

  test('score is mean of k runs', async () => {
    let callCount = 0
    const gradientGrader: Grader = async () => {
      const scores = [0.2, 0.4, 0.6, 0.8, 1.0]
      const score = scores[callCount++]!
      return { pass: score > 0.5, score }
    }

    const wrapped = withMetaVerification(gradientGrader, 5)
    const result = await wrapped({ input: 'test', output: 'hello' })

    // Mean of [0.2, 0.4, 0.6, 0.8, 1.0] = 0.6
    expect(result.score).toBeCloseTo(0.6, 10)
  })

  test('reasoning includes stats summary', async () => {
    const grader: Grader = async () => ({ pass: true, score: 0.9 })

    const wrapped = withMetaVerification(grader, 3)
    const result = await wrapped({ input: 'test', output: 'hello' })

    expect(result.reasoning).toBeDefined()
    expect(result.reasoning).toContain('Meta-verification')
    expect(result.reasoning).toContain('3 runs')
    expect(result.reasoning).toContain('mean=')
    expect(result.reasoning).toContain('stddev=')
  })

  test('stats schema validates output', async () => {
    const grader: Grader = async () => ({ pass: true, score: 0.5 })

    const wrapped = withMetaVerification(grader, 3)
    const result = await wrapped({ input: 'test', output: 'hello' })

    const parsed = MetaVerificationStatsSchema.safeParse(result.outcome!._metaVerification)
    expect(parsed.success).toBe(true)
  })
})

// ============================================================================
// Schema Validation
// ============================================================================

describe('training schemas', () => {
  test('GradingDimensionsSchema re-export works', () => {
    const result = GradingDimensionsSchema.parse({
      outcome: 0.95,
      process: 0.8,
      efficiency: 0.6,
    })
    expect(result.outcome).toBe(0.95)
  })

  test('DecisionStepSchema re-export works', () => {
    const result = DecisionStepSchema.parse({
      type: 'decision',
      bids: [
        {
          thread: 'taskGate',
          trigger: false,
          selected: true,
          type: 'task',
          priority: 0,
        },
      ],
      timestamp: Date.now(),
    })
    expect(result.type).toBe('decision')
    expect(result.bids).toHaveLength(1)
  })

  test('MetaVerificationStatsSchema validates', () => {
    const result = MetaVerificationStatsSchema.parse({
      mean: 0.8,
      stddev: 0.1,
      min: 0.6,
      max: 1.0,
      k: 5,
      scores: [0.6, 0.7, 0.8, 0.9, 1.0],
    })
    expect(result.mean).toBe(0.8)
    expect(result.scores).toHaveLength(5)
  })

  test('TrainingWeightResultSchema validates', () => {
    const result = TrainingWeightResultSchema.parse({
      weight: 0.72,
      outcome: 0.8,
      process: 0.9,
    })
    expect(result.weight).toBe(0.72)
  })

  test('TrainingWeightResultSchema rejects weight > 1', () => {
    expect(() =>
      TrainingWeightResultSchema.parse({
        weight: 1.5,
        outcome: 0.8,
        process: 0.9,
      }),
    ).toThrow()
  })

  test('TrainingWeightResultSchema rejects negative weight', () => {
    expect(() =>
      TrainingWeightResultSchema.parse({
        weight: -0.1,
        outcome: 0.8,
        process: 0.9,
      }),
    ).toThrow()
  })
})

// ============================================================================
// CLI Contract
// ============================================================================

describe('CLI contract', () => {
  test('--schema input emits JSON Schema', () => {
    const schema = z.toJSONSchema(TrainingInputSchema)
    expect(schema.type).toBe('object')
    const props = schema.properties as Record<string, unknown>
    expect(props.outcome).toBeDefined()
    expect(props.process).toBeDefined()
    expect(props.efficiency).toBeDefined()
  })

  test('--schema output emits JSON Schema', () => {
    const schema = z.toJSONSchema(TrainingOutputSchema)
    expect(schema.type).toBe('object')
    const props = schema.properties as Record<string, unknown>
    expect(props.weight).toBeDefined()
    expect(props.outcome).toBeDefined()
    expect(props.process).toBeDefined()
  })

  test('TrainingInputSchema validates correct input', () => {
    const result = TrainingInputSchema.safeParse({
      outcome: 0.8,
      process: 0.9,
    })
    expect(result.success).toBe(true)
  })

  test('TrainingInputSchema accepts optional efficiency', () => {
    const result = TrainingInputSchema.parse({
      outcome: 0.8,
      process: 0.9,
      efficiency: 0.5,
    })
    expect(result.efficiency).toBe(0.5)
  })

  test('TrainingInputSchema rejects out-of-range values', () => {
    expect(
      TrainingInputSchema.safeParse({
        outcome: 1.5,
        process: 0.5,
      }).success,
    ).toBe(false)
  })

  test('TrainingInputSchema rejects missing required fields', () => {
    expect(TrainingInputSchema.safeParse({ outcome: 0.5 }).success).toBe(false)
    expect(TrainingInputSchema.safeParse({ process: 0.5 }).success).toBe(false)
    expect(TrainingInputSchema.safeParse({}).success).toBe(false)
  })
})
