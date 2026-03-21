import { describe, expect, test } from 'bun:test'

import { parseInput, pickNativeWinner, pickRepoWinner } from '../program-orchestrator.ts'

describe('program-orchestrator', () => {
  test('parseInput reads repo fanout flags', () => {
    const parsed = parseInput([
      './dev-research/runtime-taxonomy/slice-2.md',
      '--lane',
      'repo',
      '--pattern',
      'fanout',
      '--agents',
      '4',
      '--adapter',
      './scripts/codex-cli-adapter.ts',
      '--judge',
      '--promote-winner',
    ])

    expect(parsed.slicePath).toBe('./dev-research/runtime-taxonomy/slice-2.md')
    expect(parsed.programPath).toBe('./dev-research/runtime-taxonomy/program.md')
    expect(parsed.lane).toBe('repo')
    expect(parsed.pattern).toBe('fanout')
    expect(parsed.agents).toBe(4)
    expect(parsed.repo.adapterPath).toBe('./scripts/codex-cli-adapter.ts')
    expect(parsed.repo.judge).toBe(true)
    expect(parsed.promoteWinner).toBe(true)
  })

  test('parseInput reads native-model flags', () => {
    const parsed = parseInput([
      './dev-research/native-model/slice-4.md',
      '--lane',
      'native-model',
      '--pattern',
      'fanout',
      '--output-dir',
      './tmp/native-out',
      '--model',
      'mlx-community/Falcon-H1R-7B-4bit',
      '--max-seq-length',
      '384',
      '--num-layers',
      '2',
      '--iters',
      '20',
    ])

    expect(parsed.programPath).toBe('./dev-research/native-model/program.md')
    expect(parsed.lane).toBe('native-model')
    expect(parsed.pattern).toBe('fanout')
    expect(parsed.native.outputDir).toBe('./tmp/native-out')
    expect(parsed.native.model).toBe('mlx-community/Falcon-H1R-7B-4bit')
    expect(parsed.native.maxSeqLength).toBe(384)
    expect(parsed.native.numLayers).toBe(2)
    expect(parsed.native.iters).toBe(20)
  })

  test('pickRepoWinner prefers keep decisions over higher revise scores', () => {
    const winner = pickRepoWinner([
      {
        label: 'revise-high-score',
        resultPath: './tmp/revise.json',
        result: {
          mode: 'repo-harness',
          sliceId: 'slice-1',
          slicePath: './dev-research/runtime-taxonomy/slice-1.md',
          programPath: './dev-research/runtime-taxonomy/program.md',
          decision: 'revise',
          changedFiles: ['src/runtime/runtime.ts'],
          diffStat: '1 file changed',
          attempt: 1,
          passed: false,
          capture: {
            eligible: false,
            richness: 'messages-only',
            reasons: ['failed_grade'],
          },
          judges: {
            final: { pass: false, score: 0.95 },
          },
        },
      },
      {
        label: 'keep-lower-score',
        resultPath: './tmp/keep.json',
        result: {
          mode: 'repo-harness',
          sliceId: 'slice-1',
          slicePath: './dev-research/runtime-taxonomy/slice-1.md',
          programPath: './dev-research/runtime-taxonomy/program.md',
          decision: 'keep',
          changedFiles: ['src/runtime/runtime.ts'],
          diffStat: '1 file changed',
          attempt: 1,
          passed: true,
          capture: {
            eligible: true,
            richness: 'full',
            reasons: [],
          },
          judges: {
            final: { pass: true, score: 0.6 },
          },
        },
      },
    ])

    expect(winner.label).toBe('keep-lower-score')
  })

  test('pickNativeWinner prefers promotion candidates', () => {
    const winner = pickNativeWinner([
      {
        label: 'no-promo',
        resultPath: './tmp/no-promo.json',
        result: {
          mode: 'native-model-bootstrap',
          outputDir: './tmp/no-promo',
          promptsPath: './prompts.jsonl',
          runsDir: './runs',
          model: 'mlx-community/Falcon-H1R-7B-4bit',
          baselineRunId: 'base',
          tunedRunId: 'tuned',
          tunedAdapterPath: './adapter',
          comparison: {
            baseline: {
              passRate: 0.25,
              eligibleRate: 0,
              averageScore: 0.79,
              passedTrials: 2,
              failedTrials: 6,
              eligibleTrials: 0,
              ineligibleTrials: 8,
            },
            tuned: {
              passRate: 0.25,
              eligibleRate: 0,
              averageScore: 0.8,
              passedTrials: 2,
              failedTrials: 6,
              eligibleTrials: 0,
              ineligibleTrials: 8,
            },
            delta: {
              passRate: 0,
              eligibleRate: 0,
              averageScore: 0.01,
              passedTrials: 0,
              failedTrials: 0,
              eligibleTrials: 0,
              ineligibleTrials: 0,
            },
            noRegression: true,
            improved: true,
            shouldPromote: false,
          },
        },
      },
      {
        label: 'promo',
        resultPath: './tmp/promo.json',
        result: {
          mode: 'native-model-bootstrap',
          outputDir: './tmp/promo',
          promptsPath: './prompts.jsonl',
          runsDir: './runs',
          model: 'mlx-community/Falcon-H1R-7B-4bit',
          baselineRunId: 'base',
          tunedRunId: 'tuned',
          tunedAdapterPath: './adapter',
          comparison: {
            baseline: {
              passRate: 0.25,
              eligibleRate: 0,
              averageScore: 0.79,
              passedTrials: 2,
              failedTrials: 6,
              eligibleTrials: 0,
              ineligibleTrials: 8,
            },
            tuned: {
              passRate: 0.5,
              eligibleRate: 0.25,
              averageScore: 0.84,
              passedTrials: 4,
              failedTrials: 4,
              eligibleTrials: 2,
              ineligibleTrials: 6,
            },
            delta: {
              passRate: 0.25,
              eligibleRate: 0.25,
              averageScore: 0.05,
              passedTrials: 2,
              failedTrials: -2,
              eligibleTrials: 2,
              ineligibleTrials: -2,
            },
            noRegression: true,
            improved: true,
            shouldPromote: true,
          },
        },
      },
    ])

    expect(winner.label).toBe('promo')
  })
})
