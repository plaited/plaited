import { describe, expect, test } from 'bun:test'
import type { TrialResult } from '../eval.schemas.ts'
import type { Variant } from '../evolution.schemas.ts'
import {
  collectRetainedArtifacts,
  selectPromotionCandidate,
  summarizeSelectionSignals,
  toPromotionCandidate,
} from '../evolution.ts'

const variant: Variant = {
  id: 'candidate-a',
  commit: 'abc1234',
  summary: 'Improves retrieval policy',
  status: 'candidate',
}

const result: TrialResult = {
  id: 'eval-1',
  input: 'Find the answer',
  k: 2,
  passRate: 1,
  passAtK: 1,
  passExpK: 1,
  trials: [
    {
      trialNum: 1,
      output: 'Answer',
      duration: 10,
      pass: true,
      score: 0.9,
      trajectory: [
        { type: 'thought', content: 'plan', timestamp: 1 },
        { type: 'tool_call', name: 'search', status: 'completed', timestamp: 2 },
      ],
    },
    {
      trialNum: 2,
      output: 'Answer',
      duration: 12,
      pass: true,
      score: 0.8,
      trajectory: [{ type: 'message', content: 'done', timestamp: 3 }],
    },
  ],
}

describe('summarizeSelectionSignals', () => {
  test('derives selection metrics from trial results', () => {
    const signals = summarizeSelectionSignals(result)

    expect(signals.totalTrials).toBe(2)
    expect(signals.successfulTrials).toBe(2)
    expect(signals.passRate).toBe(1)
    expect(signals.meanScore).toBeCloseTo(0.85, 10)
    expect(signals.bestScore).toBe(0.9)
    expect(signals.toolErrorTrials).toBe(0)
  })
})

describe('selectPromotionCandidate', () => {
  test('promotes a clearly winning verified candidate', () => {
    const winner = toPromotionCandidate({
      variant,
      result,
      verificationPassed: true,
      verificationConfidence: 0.9,
      judgeScore: 0.8,
    })

    const loser = toPromotionCandidate({
      variant: { id: 'candidate-b', commit: 'def5678', status: 'candidate' },
      result: {
        ...result,
        id: 'eval-2',
        passRate: 0.5,
        trials: [
          { trialNum: 1, output: 'bad', duration: 10, pass: true, score: 0.5 },
          { trialNum: 2, output: 'bad', duration: 10, pass: false, score: 0.2 },
        ],
      },
      verificationPassed: true,
      verificationConfidence: 0.65,
      judgeScore: 0.3,
    })

    const decision = selectPromotionCandidate({ candidates: [winner, loser] })
    expect(decision.action).toBe('promote_one')
    expect(decision.selectedVariantId).toBe('candidate-a')
    expect(decision.selectedCommit).toBe('abc1234')
  })

  test('requests manual review when candidates are too close', () => {
    const first = toPromotionCandidate({
      variant,
      result,
      verificationPassed: true,
      verificationConfidence: 0.8,
      judgeScore: 0.7,
    })

    const second = toPromotionCandidate({
      variant: { id: 'candidate-b', commit: 'def5678', status: 'candidate' },
      result: { ...result, id: 'eval-2' },
      verificationPassed: true,
      verificationConfidence: 0.79,
      judgeScore: 0.7,
    })

    const decision = selectPromotionCandidate({ candidates: [first, second] })
    expect(decision.action).toBe('manual_review')
  })
})

describe('collectRetainedArtifacts', () => {
  test('retains commit, trajectory, and summary artifacts for promoted variants', () => {
    const decision = {
      action: 'promote_one' as const,
      selectedVariantId: 'candidate-a',
      selectedCommit: 'abc1234',
      confidence: 0.9,
      reasoning: 'winner',
    }

    const retained = collectRetainedArtifacts({ variant, result, decision })

    expect(retained.some((artifact) => artifact.kind === 'accepted-commit')).toBe(true)
    expect(retained.some((artifact) => artifact.kind === 'trajectory')).toBe(true)
    expect(retained.some((artifact) => artifact.kind === 'summary')).toBe(true)
  })

  test('returns no artifacts when the variant is not selected', () => {
    const decision = {
      action: 'reject_all' as const,
      confidence: 1,
      reasoning: 'none',
    }

    expect(collectRetainedArtifacts({ variant, result, decision })).toEqual([])
  })
})
