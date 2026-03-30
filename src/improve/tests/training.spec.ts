/**
 * Tests for the training pipeline scoring functions.
 *
 * @remarks
 * Covers: computeTrainingWeight, scoreTrainingDimensions, withStatisticalVerification,
 * schema validation, CLI contract.
 */

import { describe, expect, test } from 'bun:test'
import * as z from 'zod'
import type { Grader } from '../eval.schemas.ts'
import {
  MetaVerificationSchema,
  TrainingAssessmentReasonSchema,
  TrainingCandidateAssessmentSchema,
  TrainingCaptureAssessmentSchema,
  TrainingCaptureReasonSchema,
  TrainingScoreInputSchema,
  TrainingScoreOutputSchema,
  TrainingScoreSchema,
} from '../training.schemas.ts'
import {
  assessTrainingCandidate,
  assessTrainingCapture,
  collectTrainingCandidates,
  computeTrainingWeight,
  scoreTrainingDimensions,
  withStatisticalVerification,
} from '../training.ts'

// ============================================================================
// computeTrainingWeight
// ============================================================================

describe('computeTrainingWeight', () => {
  test('multiplies outcome by process', () => {
    expect(computeTrainingWeight({ outcome: 0.9, process: 0.8 })).toBeCloseTo(0.72, 10)
  })

  test('perfect scores return 1', () => {
    expect(computeTrainingWeight({ outcome: 1, process: 1 })).toBe(1)
  })

  test('zero outcome returns 0', () => {
    expect(computeTrainingWeight({ outcome: 0, process: 0.9 })).toBe(0)
  })

  test('zero process returns 0', () => {
    expect(computeTrainingWeight({ outcome: 0.9, process: 0 })).toBe(0)
  })

  test('missing outcome defaults to 0', () => {
    expect(computeTrainingWeight({ process: 0.8 })).toBe(0)
  })

  test('missing process defaults to 0', () => {
    expect(computeTrainingWeight({ outcome: 0.9 })).toBe(0)
  })

  test('both missing returns 0', () => {
    expect(computeTrainingWeight({})).toBe(0)
  })

  test('ignores efficiency in weight calculation', () => {
    const withEfficiency = computeTrainingWeight({ outcome: 0.9, process: 0.8, efficiency: 1.0 })
    const withoutEfficiency = computeTrainingWeight({ outcome: 0.9, process: 0.8 })
    expect(withEfficiency).toBe(withoutEfficiency)
  })
})

// ============================================================================
// scoreTrainingDimensions
// ============================================================================

describe('scoreTrainingDimensions', () => {
  test('includes all dimensions plus computed overall', () => {
    const result = scoreTrainingDimensions({ outcome: 0.9, process: 0.8, efficiency: 0.7 })
    expect(result.outcome).toBe(0.9)
    expect(result.process).toBe(0.8)
    expect(result.efficiency).toBe(0.7)
    expect(result.overall).toBeCloseTo(0.72, 10)
  })

  test('handles partial dimensions', () => {
    const result = scoreTrainingDimensions({ outcome: 0.5 })
    expect(result.outcome).toBe(0.5)
    expect(result.process).toBeUndefined()
    expect(result.efficiency).toBeUndefined()
    expect(result.overall).toBe(0)
  })

  test('empty dimensions produce zero overall', () => {
    const result = scoreTrainingDimensions({})
    expect(result.overall).toBe(0)
  })

  test('result validates against TrainingScoreSchema', () => {
    const result = scoreTrainingDimensions({ outcome: 0.9, process: 0.8 })
    expect(() => TrainingScoreSchema.parse(result)).not.toThrow()
  })
})

// ============================================================================
// assessTrainingCandidate
// ============================================================================

describe('assessTrainingCandidate', () => {
  test('accepts a rich passing trajectory with sufficient weight', () => {
    const result = assessTrainingCandidate({
      trial: {
        pass: true,
        exitCode: 0,
        trajectory: [
          { type: 'thought', content: 'Plan', timestamp: 1 },
          { type: 'tool_call', name: 'read_file', status: 'completed', timestamp: 2 },
          { type: 'message', content: 'Done', timestamp: 3 },
        ],
      },
      dimensions: { outcome: 0.9, process: 0.9 },
    })

    expect(result.eligible).toBe(true)
    expect(result.richness).toBe('full')
    expect(result.weight).toBeCloseTo(0.81, 10)
    expect(result.reasons).toEqual([])
    expect(() => TrainingCandidateAssessmentSchema.parse(result)).not.toThrow()
  })

  test('rejects missing dimensions by default', () => {
    const result = assessTrainingCandidate({
      trial: {
        pass: true,
        exitCode: 0,
        trajectory: [{ type: 'message', content: 'Done', timestamp: 1 }],
      },
    })

    expect(result.eligible).toBe(false)
    expect(result.reasons).toContain('missing_dimensions')
    expect(result.richness).toBe('messages-only')
  })

  test('accepts capture evidence with thoughts even when trajectory is message-only', () => {
    const result = assessTrainingCandidate({
      trial: {
        pass: true,
        exitCode: 0,
        trajectory: [{ type: 'message', content: 'Done', timestamp: 1 }],
        capture: {
          source: 'adapter',
          format: 'mixed',
          messageCount: 1,
          thoughtCount: 2,
          toolCallCount: 0,
        },
      },
      dimensions: { outcome: 0.95, process: 0.9 },
    })

    expect(result.eligible).toBe(true)
    expect(result.richness).toBe('full')
  })

  test('rejects timed out and non-zero exit trials', () => {
    const result = assessTrainingCandidate({
      trial: {
        timedOut: true,
        exitCode: 124,
        pass: false,
        trajectory: [{ type: 'message', content: 'Timed out', timestamp: 1 }],
      },
      dimensions: { outcome: 0.9, process: 0.9 },
      minRichness: 'messages-only',
    })

    expect(result.eligible).toBe(false)
    expect(result.reasons).toContain('timed_out')
    expect(result.reasons).toContain('non_zero_exit')
    expect(result.reasons).toContain('failed_grade')
  })

  test('rejects trajectories with failed tool calls by default', () => {
    const result = assessTrainingCandidate({
      trial: {
        pass: true,
        exitCode: 0,
        trajectory: [
          { type: 'tool_call', name: 'bash', status: 'failed', timestamp: 1 },
          { type: 'message', content: 'Recovered', timestamp: 2 },
        ],
      },
      dimensions: { outcome: 0.9, process: 0.9 },
      minRichness: 'messages-only',
    })

    expect(result.eligible).toBe(false)
    expect(result.reasons).toContain('tool_error')
  })

  test('can allow tool errors and message-only traces for weaker distillation passes', () => {
    const result = assessTrainingCandidate({
      trial: {
        pass: true,
        exitCode: 0,
        trajectory: [
          { type: 'tool_call', name: 'bash', status: 'failed', timestamp: 1 },
          { type: 'message', content: 'Recovered', timestamp: 2 },
        ],
      },
      dimensions: { outcome: 0.9, process: 0.9 },
      minRichness: 'messages-only',
      allowToolErrors: true,
    })

    expect(result.eligible).toBe(true)
    expect(result.reasons).toEqual([])
  })

  test('rejects low-weight trajectories even when they pass', () => {
    const result = assessTrainingCandidate({
      trial: {
        pass: true,
        exitCode: 0,
        trajectory: [
          { type: 'thought', content: 'Messy plan', timestamp: 1 },
          { type: 'message', content: 'Done', timestamp: 2 },
        ],
      },
      dimensions: { outcome: 0.9, process: 0.1 },
      minWeight: 0.2,
    })

    expect(result.eligible).toBe(false)
    expect(result.weight).toBeCloseTo(0.09, 10)
    expect(result.reasons).toContain('low_weight')
  })
})

// ============================================================================
// assessTrainingCapture
// ============================================================================

describe('assessTrainingCapture', () => {
  test('accepts a full clean trace', () => {
    const result = assessTrainingCapture({
      trial: {
        exitCode: 0,
        trajectory: [
          { type: 'thought', content: 'Plan', timestamp: 1 },
          { type: 'tool_call', name: 'read_file', status: 'completed', timestamp: 2 },
          { type: 'message', content: 'Done', timestamp: 3 },
        ],
      },
    })

    expect(result.eligible).toBe(true)
    expect(result.richness).toBe('full')
    expect(result.reasons).toEqual([])
    expect(() => TrainingCaptureAssessmentSchema.parse(result)).not.toThrow()
  })

  test('uses capture evidence when trajectory lacks rich steps', () => {
    const result = assessTrainingCapture({
      trial: {
        exitCode: 0,
        trajectory: [{ type: 'message', content: 'Done', timestamp: 1 }],
        capture: {
          source: 'adapter',
          format: 'jsonl-event-stream',
          eventCount: 6,
          messageCount: 1,
          thoughtCount: 1,
          toolCallCount: 0,
        },
      },
    })

    expect(result.eligible).toBe(true)
    expect(result.richness).toBe('full')
    expect(result.reasons).toEqual([])
  })

  test('rejects timed out traces with non-zero exit', () => {
    const result = assessTrainingCapture({
      trial: {
        timedOut: true,
        exitCode: 124,
        trajectory: [{ type: 'message', content: 'Timed out', timestamp: 1 }],
      },
      minRichness: 'messages-only',
    })

    expect(result.eligible).toBe(false)
    expect(result.reasons).toContain('timed_out')
    expect(result.reasons).toContain('non_zero_exit')
  })

  test('rejects failed tool calls by default', () => {
    const result = assessTrainingCapture({
      trial: {
        exitCode: 0,
        trajectory: [
          { type: 'tool_call', name: 'bash', status: 'failed', timestamp: 1 },
          { type: 'message', content: 'Recovered', timestamp: 2 },
        ],
      },
      minRichness: 'messages-only',
    })

    expect(result.eligible).toBe(false)
    expect(result.reasons).toContain('tool_error')
  })

  test('can allow tool errors for weaker raw-capture passes', () => {
    const result = assessTrainingCapture({
      trial: {
        exitCode: 0,
        trajectory: [
          { type: 'tool_call', name: 'bash', status: 'failed', timestamp: 1 },
          { type: 'message', content: 'Recovered', timestamp: 2 },
        ],
      },
      minRichness: 'messages-only',
      allowToolErrors: true,
    })

    expect(result.eligible).toBe(true)
    expect(result.reasons).toEqual([])
  })

  test('schema validates capture reasons', () => {
    expect(() => TrainingCaptureReasonSchema.parse('tool_error')).not.toThrow()
  })
})

// ============================================================================
// collectTrainingCandidates
// ============================================================================

describe('collectTrainingCandidates', () => {
  test('returns only eligible trials with trajectories', () => {
    const candidates = collectTrainingCandidates([
      {
        id: 'kept',
        input: 'Prompt',
        k: 2,
        metadata: { source: 'eval' },
        trials: [
          {
            trialNum: 1,
            output: 'Good output',
            duration: 10,
            trajectory: [
              { type: 'thought', content: 'Plan', timestamp: 1 },
              { type: 'message', content: 'Done', timestamp: 2 },
            ],
            dimensions: { outcome: 0.9, process: 0.8 },
            trainingAssessment: {
              eligible: true,
              richness: 'full',
              score: { outcome: 0.9, process: 0.8, overall: 0.72 },
              weight: 0.72,
              reasons: [],
            },
          },
          {
            trialNum: 2,
            output: 'Rejected output',
            duration: 12,
            trajectory: [{ type: 'message', content: 'Nope', timestamp: 3 }],
            trainingAssessment: {
              eligible: false,
              richness: 'messages-only',
              weight: 0,
              reasons: ['failed_grade'],
            },
          },
        ],
      },
      {
        id: 'missing-trajectory',
        input: 'Prompt 2',
        k: 1,
        trials: [
          {
            trialNum: 1,
            output: 'No trajectory',
            duration: 8,
            trainingAssessment: {
              eligible: true,
              richness: 'full',
              weight: 0.9,
              reasons: [],
            },
          },
        ],
      },
    ])

    expect(candidates).toHaveLength(1)
    expect(candidates[0]!.id).toBe('kept')
    expect(candidates[0]!.trialNum).toBe(1)
    expect(candidates[0]!.trajectory).toHaveLength(2)
    expect(candidates[0]!.assessment.weight).toBeCloseTo(0.72, 10)
    expect(candidates[0]!.metadata).toEqual({ source: 'eval' })
  })
})

// ============================================================================
// withStatisticalVerification
// ============================================================================

describe('withStatisticalVerification', () => {
  test('runs grader k times and computes mean score', async () => {
    const grader: Grader = async () => ({ pass: true, score: 0.8 })
    const wrapped = withStatisticalVerification(grader, 3)

    const result = await wrapped({ input: 'test', output: 'hello' })

    expect(result.score).toBeCloseTo(0.8, 10)
    expect(result.pass).toBe(true)
  })

  test('consistent grader has zero stddev', async () => {
    const grader: Grader = async () => ({ pass: true, score: 0.9 })
    const wrapped = withStatisticalVerification(grader, 5)

    const result = await wrapped({ input: 'test', output: 'hello' })

    expect(result.outcome).toBeDefined()
    const meta = result.outcome!._metaVerification as z.infer<typeof MetaVerificationSchema>
    expect(meta.stddev).toBe(0)
    expect(meta.mean).toBe(0.9)
    expect(meta.min).toBe(0.9)
    expect(meta.max).toBe(0.9)
    expect(meta.k).toBe(5)
    expect(meta.scores).toHaveLength(5)
  })

  test('detects flaky grader via high stddev', async () => {
    let callCount = 0
    const flakyGrader: Grader = async () => {
      callCount++
      const score = callCount % 2 === 0 ? 1.0 : 0.0
      return { pass: score > 0.5, score }
    }

    const wrapped = withStatisticalVerification(flakyGrader, 4)
    const result = await wrapped({ input: 'test', output: 'hello' })

    const meta = result.outcome!._metaVerification as z.infer<typeof MetaVerificationSchema>
    expect(meta.stddev).toBeGreaterThan(0.4)
    expect(meta.min).toBe(0)
    expect(meta.max).toBe(1)
  })

  test('majority vote for pass/fail', async () => {
    let callCount = 0
    const grader: Grader = async () => {
      callCount++
      // 3 pass, 2 fail → majority pass
      const pass = callCount <= 3
      return { pass, score: pass ? 1.0 : 0.0 }
    }

    const wrapped = withStatisticalVerification(grader, 5)
    const result = await wrapped({ input: 'test', output: 'hello' })

    expect(result.pass).toBe(true)
  })

  test('majority vote fails when fewer than half pass', async () => {
    let callCount = 0
    const grader: Grader = async () => {
      callCount++
      // 1 pass, 4 fail → majority fail
      const pass = callCount === 1
      return { pass, score: pass ? 1.0 : 0.0 }
    }

    const wrapped = withStatisticalVerification(grader, 5)
    const result = await wrapped({ input: 'test', output: 'hello' })

    expect(result.pass).toBe(false)
  })

  test('preserves base result reasoning and dimensions', async () => {
    const grader: Grader = async () => ({
      pass: true,
      score: 0.9,
      reasoning: 'Looks good',
      dimensions: { outcome: 0.95, process: 0.85 },
    })

    const wrapped = withStatisticalVerification(grader, 3)
    const result = await wrapped({ input: 'test', output: 'hello' })

    expect(result.reasoning).toBe('Looks good')
    expect(result.dimensions).toBeDefined()
    expect(result.dimensions!.outcome).toBe(0.95)
    expect(result.dimensions!.process).toBe(0.85)
  })

  test('preserves existing outcome fields', async () => {
    const grader: Grader = async () => ({
      pass: true,
      score: 1.0,
      outcome: { matchType: 'exact', details: 'perfect' },
    })

    const wrapped = withStatisticalVerification(grader, 2)
    const result = await wrapped({ input: 'test', output: 'hello' })

    expect(result.outcome).toBeDefined()
    expect(result.outcome!.matchType).toBe('exact')
    expect(result.outcome!.details).toBe('perfect')
    expect(result.outcome!._metaVerification).toBeDefined()
  })

  test('k=1 produces single-run statistics', async () => {
    const grader: Grader = async () => ({ pass: true, score: 0.7 })
    const wrapped = withStatisticalVerification(grader, 1)

    const result = await wrapped({ input: 'test', output: 'hello' })

    const meta = result.outcome!._metaVerification as z.infer<typeof MetaVerificationSchema>
    expect(meta.k).toBe(1)
    expect(meta.mean).toBe(0.7)
    expect(meta.stddev).toBe(0)
    expect(meta.min).toBe(0.7)
    expect(meta.max).toBe(0.7)
    expect(meta.scores).toEqual([0.7])
  })

  test('meta-verification validates against schema', async () => {
    const grader: Grader = async () => ({ pass: true, score: 0.8 })
    const wrapped = withStatisticalVerification(grader, 3)

    const result = await wrapped({ input: 'test', output: 'hello' })

    expect(() => MetaVerificationSchema.parse(result.outcome!._metaVerification)).not.toThrow()
  })
})

// ============================================================================
// Schema Validation
// ============================================================================

describe('TrainingScoreSchema', () => {
  test('validates complete training score', () => {
    const result = TrainingScoreSchema.parse({
      outcome: 0.9,
      process: 0.8,
      efficiency: 0.7,
      overall: 0.72,
    })
    expect(result.overall).toBe(0.72)
  })

  test('requires overall field', () => {
    expect(() =>
      TrainingScoreSchema.parse({
        outcome: 0.9,
        process: 0.8,
      }),
    ).toThrow()
  })

  test('inherits optional dimensions from GradingDimensionsSchema', () => {
    const result = TrainingScoreSchema.parse({ overall: 0 })
    expect(result.outcome).toBeUndefined()
    expect(result.process).toBeUndefined()
    expect(result.efficiency).toBeUndefined()
    expect(result.overall).toBe(0)
  })

  test('rejects overall below 0', () => {
    expect(() => TrainingScoreSchema.parse({ overall: -0.1 })).toThrow()
  })

  test('rejects overall above 1', () => {
    expect(() => TrainingScoreSchema.parse({ overall: 1.5 })).toThrow()
  })
})

describe('MetaVerificationSchema', () => {
  test('validates complete meta-verification', () => {
    const result = MetaVerificationSchema.parse({
      mean: 0.85,
      stddev: 0.05,
      min: 0.8,
      max: 0.9,
      k: 5,
      scores: [0.8, 0.85, 0.85, 0.9, 0.85],
    })
    expect(result.mean).toBe(0.85)
    expect(result.k).toBe(5)
    expect(result.scores).toHaveLength(5)
  })

  test('requires all fields', () => {
    expect(() => MetaVerificationSchema.parse({ mean: 0.5 })).toThrow()
  })

  test('rejects negative stddev', () => {
    expect(() =>
      MetaVerificationSchema.parse({
        mean: 0.5,
        stddev: -1,
        min: 0.5,
        max: 0.5,
        k: 1,
        scores: [0.5],
      }),
    ).toThrow()
  })

  test('rejects non-positive k', () => {
    expect(() =>
      MetaVerificationSchema.parse({
        mean: 0.5,
        stddev: 0,
        min: 0.5,
        max: 0.5,
        k: 0,
        scores: [],
      }),
    ).toThrow()
  })
})

describe('TrainingAssessmentReasonSchema', () => {
  test('accepts known assessment reasons', () => {
    expect(TrainingAssessmentReasonSchema.parse('tool_error')).toBe('tool_error')
    expect(TrainingAssessmentReasonSchema.parse('low_weight')).toBe('low_weight')
  })

  test('rejects unknown assessment reasons', () => {
    expect(() => TrainingAssessmentReasonSchema.parse('bad_reason')).toThrow()
  })
})

// ============================================================================
// CLI Contract
// ============================================================================

describe('CLI contract', () => {
  test('--schema input emits JSON Schema', () => {
    const schema = z.toJSONSchema(TrainingScoreInputSchema)
    expect(schema.type).toBe('object')
    expect(schema.properties).toBeDefined()
    const props = schema.properties as Record<string, unknown>
    expect(props.outcome).toBeDefined()
    expect(props.process).toBeDefined()
    expect(props.efficiency).toBeDefined()
  })

  test('--schema output emits JSON Schema', () => {
    const schema = z.toJSONSchema(TrainingScoreOutputSchema)
    expect(schema.type).toBe('object')
    expect(schema.properties).toBeDefined()
    const props = schema.properties as Record<string, unknown>
    expect(props.overall).toBeDefined()
  })

  test('TrainingScoreInputSchema validates correct input', () => {
    const result = TrainingScoreInputSchema.safeParse({
      outcome: 0.9,
      process: 0.8,
      efficiency: 0.7,
    })
    expect(result.success).toBe(true)
  })

  test('TrainingScoreInputSchema accepts empty object', () => {
    const result = TrainingScoreInputSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  test('TrainingScoreInputSchema rejects out-of-range values', () => {
    const result = TrainingScoreInputSchema.safeParse({ outcome: 2.0 })
    expect(result.success).toBe(false)
  })
})
