import { describe, expect, test } from 'bun:test'
import { bootstrap, compareResearchRuns, mean, median, selectPromotionDecision } from '../research.comparison.utils.ts'

const trial = ({ duration, pass, trialNum }: { duration: number; pass?: boolean; trialNum: number }) => {
  const base = {
    trialNum,
    output: pass === undefined ? 'unknown' : pass ? 'ok' : 'fail',
    duration,
  }
  if (pass === undefined) {
    return base
  }
  return {
    ...base,
    pass,
    score: pass ? 1 : 0,
  }
}

describe('research comparison stats utilities', () => {
  test('computes mean and median', () => {
    expect(mean([1, 2, 3])).toBe(2)
    expect(median([3, 1, 2])).toBe(2)
    expect(median([1, 2, 3, 4])).toBe(2.5)
  })

  test('bootstraps confidence intervals', () => {
    const [lower, upper] = bootstrap([0, 1, 1, 0], mean, { resamples: 100, confidence: 0.8 })
    expect(lower).toBeGreaterThanOrEqual(0)
    expect(upper).toBeLessThanOrEqual(1)
    expect(lower).toBeLessThanOrEqual(upper)
  })

  test('rejects invalid bootstrap confidence', () => {
    expect(() => bootstrap([0, 1], mean, { resamples: 10, confidence: 0 })).toThrow(
      'bootstrap confidence must be greater than 0 and less than 1',
    )
    expect(() => bootstrap([0, 1], mean, { resamples: 10, confidence: 1 })).toThrow(
      'bootstrap confidence must be greater than 0 and less than 1',
    )
  })
})

describe('compareResearchRuns', () => {
  test('compares trial-only inputs when top-level aggregates are absent', () => {
    const comparison = compareResearchRuns({
      baseline: {
        label: 'baseline',
        results: [
          { id: 'p1', input: 'alpha', trials: [trial({ trialNum: 1, pass: false, duration: 10 })] },
          {
            id: 'p2',
            input: 'beta',
            trials: [
              trial({ trialNum: 1, pass: true, duration: 18 }),
              trial({ trialNum: 2, pass: false, duration: 20 }),
            ],
          },
        ],
      },
      challenger: {
        label: 'challenger',
        results: [
          {
            id: 'p1',
            input: 'alpha',
            trials: [trial({ trialNum: 1, pass: true, duration: 9 })],
          },
          {
            id: 'p2',
            input: 'beta',
            trials: [
              trial({ trialNum: 1, pass: true, duration: 14 }),
              trial({ trialNum: 2, pass: false, duration: 16 }),
            ],
          },
        ],
      },
      resamples: 100,
      confidence: 0.8,
    })

    expect(comparison.summary.baselineWins).toBe(0)
    expect(comparison.summary.challengerWins).toBe(1)
    expect(comparison.summary.ties).toBe(1)
    expect(comparison.summary.totalPrompts).toBe(2)
    expect(comparison.baseline.comparablePromptCount).toBe(2)
    expect(comparison.challenger.comparablePromptCount).toBe(2)
    expect(comparison.baseline.avgPassRate).toBe(0.25)
    expect(comparison.challenger.avgPassRate).toBe(0.75)
    expect(comparison.perPrompt[0]?.baselinePassRate).toBe(0)
    expect(comparison.perPrompt[0]?.challengerPassRate).toBe(1)
  })

  test('accepts consistent aggregate plus trial-backed inputs', () => {
    const comparison = compareResearchRuns({
      baseline: {
        label: 'baseline',
        results: [
          {
            id: 'p1',
            input: 'alpha',
            passRate: 0.5,
            passAtK: 1,
            passExpK: 0.75,
            trials: [
              trial({ trialNum: 1, pass: true, duration: 10 }),
              trial({ trialNum: 2, pass: false, duration: 12 }),
            ],
          },
        ],
      },
      challenger: {
        label: 'challenger',
        results: [
          {
            id: 'p1',
            input: 'alpha',
            passRate: 1,
            passAtK: 1,
            passExpK: 1,
            trials: [trial({ trialNum: 1, pass: true, duration: 9 }), trial({ trialNum: 2, pass: true, duration: 11 })],
          },
        ],
      },
      resamples: 100,
      confidence: 0.8,
    })

    expect(comparison.summary.totalPrompts).toBe(1)
    expect(comparison.perPrompt[0]?.baselinePassRate).toBe(0.5)
    expect(comparison.perPrompt[0]?.challengerPassRate).toBe(1)
    expect(comparison.perPrompt[0]?.baselinePassAtK).toBe(0.75)
    expect(comparison.perPrompt[0]?.challengerPassAtK).toBe(1)
    expect(comparison.perPrompt[0]?.winner).toBe('challenger')
  })

  test('normalizes inconsistent aggregate values to trial-derived values', () => {
    const comparison = compareResearchRuns({
      baseline: {
        label: 'baseline',
        results: [
          {
            id: 'p1',
            input: 'alpha',
            passRate: 0,
            passAtK: 0,
            passExpK: 0,
            trials: [trial({ trialNum: 1, pass: true, duration: 8 }), trial({ trialNum: 2, pass: true, duration: 7 })],
          },
        ],
      },
      challenger: {
        label: 'challenger',
        results: [
          {
            id: 'p1',
            input: 'alpha',
            passRate: 1,
            passAtK: 1,
            passExpK: 1,
            trials: [
              trial({ trialNum: 1, pass: false, duration: 8 }),
              trial({ trialNum: 2, pass: false, duration: 7 }),
            ],
          },
        ],
      },
      resamples: 100,
      confidence: 0.8,
    })

    expect(comparison.perPrompt[0]?.baselinePassRate).toBe(1)
    expect(comparison.perPrompt[0]?.challengerPassRate).toBe(0)
    expect(comparison.perPrompt[0]?.winner).toBe('baseline')
  })

  test('classifies prompts as insufficient when trials have no pass/fail evidence', () => {
    const comparison = compareResearchRuns({
      baseline: {
        label: 'baseline',
        results: [
          {
            id: 'p1',
            input: 'alpha',
            passRate: 1,
            passAtK: 1,
            passExpK: 1,
            trials: [trial({ trialNum: 1, duration: 10 })],
          },
        ],
      },
      challenger: {
        label: 'challenger',
        results: [
          {
            id: 'p1',
            input: 'alpha',
            trials: [trial({ trialNum: 1, pass: true, duration: 10 })],
          },
        ],
      },
      resamples: 100,
      confidence: 0.8,
    })

    expect(comparison.summary.insufficientData).toBe(1)
    expect(comparison.baseline.comparablePromptCount).toBe(0)
    expect(comparison.perPrompt[0]?.winner).toBe('insufficient_data')
    expect(comparison.perPrompt[0]?.baselinePassRate).toBeNull()
  })

  test('classifies prompts as insufficient when trials have partial pass/fail coverage', () => {
    const comparison = compareResearchRuns({
      baseline: {
        label: 'baseline',
        results: [
          {
            id: 'p1',
            input: 'alpha',
            trials: [trial({ trialNum: 1, pass: true, duration: 10 }), trial({ trialNum: 2, duration: 12 })],
          },
        ],
      },
      challenger: {
        label: 'challenger',
        results: [
          {
            id: 'p1',
            input: 'alpha',
            trials: [trial({ trialNum: 1, pass: true, duration: 9 }), trial({ trialNum: 2, pass: true, duration: 11 })],
          },
        ],
      },
      resamples: 100,
      confidence: 0.8,
    })

    expect(comparison.summary.insufficientData).toBe(1)
    expect(comparison.baseline.comparablePromptCount).toBe(0)
    expect(comparison.challenger.comparablePromptCount).toBe(1)
    expect(comparison.perPrompt[0]?.winner).toBe('insufficient_data')
    expect(comparison.perPrompt[0]?.baselinePassRate).toBeNull()
    expect(comparison.perPrompt[0]?.challengerPassRate).toBe(1)
  })

  test('supports mixed aggregated and trial-only prompt rows in one comparison', () => {
    const comparison = compareResearchRuns({
      baseline: {
        label: 'baseline',
        results: [
          {
            id: 'p1',
            input: 'alpha',
            passRate: 0.5,
            passAtK: 1,
            passExpK: 0.75,
            trials: [
              trial({ trialNum: 1, pass: true, duration: 10 }),
              trial({ trialNum: 2, pass: false, duration: 12 }),
            ],
          },
          {
            id: 'p2',
            input: 'beta',
            trials: [
              trial({ trialNum: 1, pass: false, duration: 12 }),
              trial({ trialNum: 2, pass: false, duration: 13 }),
            ],
          },
        ],
      },
      challenger: {
        label: 'challenger',
        results: [
          {
            id: 'p1',
            input: 'alpha',
            trials: [
              trial({ trialNum: 1, pass: true, duration: 10 }),
              trial({ trialNum: 2, pass: false, duration: 11 }),
            ],
          },
          {
            id: 'p2',
            input: 'beta',
            passRate: 1,
            passAtK: 1,
            passExpK: 1,
            trials: [trial({ trialNum: 1, pass: true, duration: 9 }), trial({ trialNum: 2, pass: true, duration: 9 })],
          },
        ],
      },
      resamples: 100,
      confidence: 0.8,
    })

    expect(comparison.summary.baselineWins).toBe(0)
    expect(comparison.summary.challengerWins).toBe(1)
    expect(comparison.summary.ties).toBe(1)
    expect(comparison.summary.insufficientData).toBe(0)
  })

  test('rejects confidence edge-case values', () => {
    expect(() =>
      compareResearchRuns({
        baseline: {
          label: 'baseline',
          results: [{ id: 'p1', input: 'alpha', trials: [trial({ trialNum: 1, pass: true, duration: 1 })] }],
        },
        challenger: {
          label: 'challenger',
          results: [{ id: 'p1', input: 'alpha', trials: [trial({ trialNum: 1, pass: true, duration: 1 })] }],
        },
        resamples: 10,
        confidence: 1,
      }),
    ).toThrow('bootstrap confidence must be greater than 0 and less than 1')

    expect(() =>
      compareResearchRuns({
        baseline: {
          label: 'baseline',
          results: [{ id: 'p1', input: 'alpha', trials: [trial({ trialNum: 1, pass: true, duration: 1 })] }],
        },
        challenger: {
          label: 'challenger',
          results: [{ id: 'p1', input: 'alpha', trials: [trial({ trialNum: 1, pass: true, duration: 1 })] }],
        },
        resamples: 10,
        confidence: Number.NaN,
      }),
    ).toThrow('bootstrap confidence must be greater than 0 and less than 1')
  })
})

describe('selectPromotionDecision', () => {
  test('promotes challenger when comparison gates pass on normalized trial data', () => {
    const comparison = compareResearchRuns({
      baseline: {
        label: 'baseline',
        results: [
          { id: 'p1', input: 'alpha', trials: [trial({ trialNum: 1, pass: false, duration: 10 })] },
          { id: 'p2', input: 'beta', trials: [trial({ trialNum: 1, pass: false, duration: 20 })] },
        ],
      },
      challenger: {
        label: 'challenger',
        results: [
          { id: 'p1', input: 'alpha', trials: [trial({ trialNum: 1, pass: true, duration: 9 })] },
          { id: 'p2', input: 'beta', trials: [trial({ trialNum: 1, pass: true, duration: 9 })] },
        ],
      },
      resamples: 100,
      confidence: 0.8,
    })

    const decision = selectPromotionDecision({
      comparison,
      minWinDelta: 1,
      minPassRateDelta: 0.05,
    })

    expect(decision.decision).toBe('promote_challenger')
    expect(decision.winner).toBe('challenger')
    expect(decision.winDelta).toBe(2)
  })

  test('keeps baseline when challenger does not clear thresholds', () => {
    const comparison = compareResearchRuns({
      baseline: {
        label: 'baseline',
        results: [
          { id: 'p1', input: 'alpha', trials: [trial({ trialNum: 1, pass: true, duration: 10 })] },
          { id: 'p2', input: 'beta', trials: [trial({ trialNum: 1, pass: true, duration: 11 })] },
        ],
      },
      challenger: {
        label: 'challenger',
        results: [
          { id: 'p1', input: 'alpha', trials: [trial({ trialNum: 1, pass: true, duration: 10 })] },
          { id: 'p2', input: 'beta', trials: [trial({ trialNum: 1, pass: true, duration: 11 })] },
        ],
      },
      resamples: 100,
      confidence: 0.8,
    })

    const decision = selectPromotionDecision({
      comparison,
      minWinDelta: 1,
      minPassRateDelta: 0.01,
    })

    expect(decision.decision).toBe('keep_baseline')
    expect(decision.winner).toBe('baseline')
    expect(decision.winDelta).toBe(0)
  })

  test('does not promote challenger when no prompts are comparable', () => {
    const comparison = compareResearchRuns({
      baseline: {
        label: 'baseline',
        results: [
          {
            id: 'p1',
            input: 'alpha',
            trials: [trial({ trialNum: 1, pass: true, duration: 10 }), trial({ trialNum: 2, duration: 11 })],
          },
        ],
      },
      challenger: {
        label: 'challenger',
        results: [
          {
            id: 'p1',
            input: 'alpha',
            trials: [
              trial({ trialNum: 1, pass: true, duration: 10 }),
              trial({ trialNum: 2, pass: true, duration: 10 }),
            ],
          },
        ],
      },
      resamples: 100,
      confidence: 0.8,
    })

    const decision = selectPromotionDecision({
      comparison,
      minWinDelta: 0,
      minPassRateDelta: 0,
    })

    expect(comparison.summary.insufficientData).toBe(1)
    expect(decision.decision).toBe('keep_baseline')
    expect(decision.winner).toBe('baseline')
  })
})
