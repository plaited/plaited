import { describe, expect, test } from 'bun:test'

import {
  buildRepoFanoutArgs,
  parseInput,
  pickNativeWinner,
  pickRepoWinner,
  pickSkillWinner,
} from '../program-orchestrator.ts'

const createTrialSummary = ({
  passRate,
  eligibleRate,
  averageScore,
  passedTrials,
  failedTrials,
  eligibleTrials,
  ineligibleTrials,
  totalTrials,
}: {
  passRate: number
  eligibleRate: number
  averageScore: number
  passedTrials: number
  failedTrials: number
  eligibleTrials: number
  ineligibleTrials: number
  totalTrials: number
}) => ({
  promptCount: 1,
  totalTrials,
  passedTrials,
  failedTrials,
  passRate,
  eligibleTrials,
  ineligibleTrials,
  eligibleRate,
  averageScore,
  trainingReasons: {},
  richness: {
    full: 0,
    minimal: 0,
    'messages-only': 0,
  },
  prompts: [],
  themes: [],
})

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

  test('parseInput reads skills flags', () => {
    const parsed = parseInput([
      './dev-research/skills/slice-1.md',
      '--lane',
      'skills',
      '--pattern',
      'fanout',
      '--skill-path',
      './skills/generative-ui',
      '--mode',
      'trigger',
      '--adapter',
      './scripts/codex-cli-adapter.ts',
      '--grader-path',
      './scripts/claude-code-judge.ts',
      '--baseline',
      'without-skill',
      '--use-worktree',
      '--agents',
      '2',
      '--k',
      '2',
    ])

    expect(parsed.programPath).toBe('./dev-research/skills/program.md')
    expect(parsed.lane).toBe('skills')
    expect(parsed.pattern).toBe('fanout')
    expect(parsed.skills.skillPath).toBe('./skills/generative-ui')
    expect(parsed.skills.mode).toBe('trigger')
    expect(parsed.skills.adapterPath).toBe('./scripts/codex-cli-adapter.ts')
    expect(parsed.skills.graderPath).toBe('./scripts/claude-code-judge.ts')
    expect(parsed.skills.baseline).toBe('without-skill')
    expect(parsed.skills.useWorktree).toBe(true)
    expect(parsed.skills.k).toBe(2)
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

  test('pickSkillWinner prefers stronger with-skill pass rate and delta', () => {
    const winner = pickSkillWinner([
      {
        label: 'weaker',
        resultPath: './tmp/weaker.json',
        result: {
          skillPath: './skills/demo',
          mode: 'trigger',
          baseline: 'without-skill',
          promptsPath: './skills/demo/evals/trigger-prompts.jsonl',
          runDir: './skills/demo/evals/runs/a',
          benchmarkPath: './skills/demo/evals/runs/a/benchmark.json',
          resultsMarkdownPath: './skills/demo/evals/runs/a/RESULTS.md',
          latestBenchmarkPath: './skills/demo/evals/benchmark.json',
          latestResultsPath: './skills/demo/evals/RESULTS.md',
          latestRunPath: './skills/demo/evals/latest-run.json',
          runs: [
            {
              label: 'with-skill',
              cwd: '.',
              resultsPath: './with/results.jsonl',
              summaryPath: './with/summary.md',
              summaryJsonPath: './with/summary.json',
              summary: createTrialSummary({
                passRate: 0.5,
                eligibleRate: 0,
                averageScore: 0.7,
                passedTrials: 1,
                failedTrials: 1,
                eligibleTrials: 0,
                ineligibleTrials: 2,
                totalTrials: 2,
              }),
            },
            {
              label: 'without-skill',
              cwd: '.',
              resultsPath: './without/results.jsonl',
              summaryPath: './without/summary.md',
              summaryJsonPath: './without/summary.json',
              summary: createTrialSummary({
                passRate: 0.25,
                eligibleRate: 0,
                averageScore: 0.6,
                passedTrials: 1,
                failedTrials: 3,
                eligibleTrials: 0,
                ineligibleTrials: 4,
                totalTrials: 4,
              }),
            },
          ],
        },
      },
      {
        label: 'stronger',
        resultPath: './tmp/stronger.json',
        result: {
          skillPath: './skills/demo',
          mode: 'trigger',
          baseline: 'without-skill',
          promptsPath: './skills/demo/evals/trigger-prompts.jsonl',
          runDir: './skills/demo/evals/runs/b',
          benchmarkPath: './skills/demo/evals/runs/b/benchmark.json',
          resultsMarkdownPath: './skills/demo/evals/runs/b/RESULTS.md',
          latestBenchmarkPath: './skills/demo/evals/benchmark.json',
          latestResultsPath: './skills/demo/evals/RESULTS.md',
          latestRunPath: './skills/demo/evals/latest-run.json',
          runs: [
            {
              label: 'with-skill',
              cwd: '.',
              resultsPath: './with/results.jsonl',
              summaryPath: './with/summary.md',
              summaryJsonPath: './with/summary.json',
              summary: createTrialSummary({
                passRate: 1,
                eligibleRate: 0.5,
                averageScore: 0.9,
                passedTrials: 2,
                failedTrials: 0,
                eligibleTrials: 1,
                ineligibleTrials: 1,
                totalTrials: 2,
              }),
            },
            {
              label: 'without-skill',
              cwd: '.',
              resultsPath: './without/results.jsonl',
              summaryPath: './without/summary.md',
              summaryJsonPath: './without/summary.json',
              summary: createTrialSummary({
                passRate: 0.25,
                eligibleRate: 0,
                averageScore: 0.5,
                passedTrials: 1,
                failedTrials: 3,
                eligibleTrials: 0,
                ineligibleTrials: 4,
                totalTrials: 4,
              }),
            },
          ],
        },
      },
    ])

    expect(winner.label).toBe('stronger')
  })

  test('buildRepoFanoutArgs disables push for subprocess candidates', () => {
    const input = parseInput([
      './dev-research/runtime-taxonomy/slice-2.md',
      '--lane',
      'repo',
      '--pattern',
      'fanout',
      '--agents',
      '3',
      '--judge',
    ])

    const args = buildRepoFanoutArgs({
      input,
      resultPath: './tmp/agent-1.json',
      strategyNote: 'Prefer deleting unnecessary abstractions first.',
    })

    expect(args).toContain('--no-push')
    expect(args).not.toContain('--push')
    expect(args).not.toContain('--commit')
  })
})
