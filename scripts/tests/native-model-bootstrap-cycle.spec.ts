import { describe, expect, test } from 'bun:test'

import { compareSummaries, parseArgs } from '../native-model-bootstrap-cycle.ts'

describe('native-model-bootstrap-cycle', () => {
  test('parseArgs reads train/eval/promotion flags', () => {
    const parsed = parseArgs([
      '--output-dir',
      './tmp/out',
      '--model',
      'mlx-community/Falcon-H1R-7B-4bit',
      '--max-seq-length',
      '384',
      '--num-layers',
      '2',
      '--iters',
      '20',
      '--promote',
      '--baseline-run-id',
      'base',
      '--tuned-run-id',
      'tuned',
    ])

    expect(parsed.outputDir).toBe('./tmp/out')
    expect(parsed.model).toBe('mlx-community/Falcon-H1R-7B-4bit')
    expect(parsed.maxSeqLength).toBe(384)
    expect(parsed.numLayers).toBe(2)
    expect(parsed.iters).toBe(20)
    expect(parsed.promote).toBe(true)
    expect(parsed.baselineRunId).toBe('base')
    expect(parsed.tunedRunId).toBe('tuned')
  })

  test('compareSummaries marks improvement and promotion candidate', () => {
    const comparison = compareSummaries({
      baseline: {
        passRate: 0.5,
        eligibleRate: 0.25,
        averageScore: 0.8,
        passedTrials: 4,
        failedTrials: 4,
        eligibleTrials: 2,
        ineligibleTrials: 6,
      },
      tuned: {
        passRate: 0.75,
        eligibleRate: 0.5,
        averageScore: 0.9,
        passedTrials: 6,
        failedTrials: 2,
        eligibleTrials: 4,
        ineligibleTrials: 4,
      },
    })

    expect(comparison.noRegression).toBe(true)
    expect(comparison.improved).toBe(true)
    expect(comparison.shouldPromote).toBe(true)
    expect(comparison.delta.passRate).toBe(0.25)
  })

  test('compareSummaries blocks promotion on regression', () => {
    const comparison = compareSummaries({
      baseline: {
        passRate: 0.75,
        eligibleRate: 0.5,
        averageScore: 0.9,
        passedTrials: 6,
        failedTrials: 2,
        eligibleTrials: 4,
        ineligibleTrials: 4,
      },
      tuned: {
        passRate: 0.5,
        eligibleRate: 0.5,
        averageScore: 0.92,
        passedTrials: 4,
        failedTrials: 4,
        eligibleTrials: 4,
        ineligibleTrials: 4,
      },
    })

    expect(comparison.noRegression).toBe(false)
    expect(comparison.shouldPromote).toBe(false)
  })

  test('parseArgs reads result-json and strategy-label flags', () => {
    const parsed = parseArgs([
      '--output-dir',
      './tmp/out',
      '--result-json',
      './tmp/native-result.json',
      '--strategy-label',
      'balanced',
    ])

    expect(parsed.resultJsonPath).toBe('./tmp/native-result.json')
    expect(parsed.strategyLabel).toBe('balanced')
  })
})
