import { describe, expect, test } from 'bun:test'
import type { TrialResult } from '../eval.schemas.ts'
import { formatEvalSummary, summarizeEvalResults } from '../eval-report.ts'

describe('summarizeEvalResults', () => {
  test('aggregates prompt and theme scores', () => {
    const results: TrialResult[] = [
      {
        id: 'module-1',
        input: 'prompt 1',
        k: 2,
        passRate: 0.5,
        trials: [
          {
            trialNum: 1,
            output: 'ok',
            duration: 10,
            pass: true,
            score: 0.9,
            outcome: {
              nativeModelJudge: {
                retentionLabel: 'retain_for_distillation',
              },
            },
          },
          {
            trialNum: 2,
            output: 'bad',
            duration: 12,
            pass: false,
            score: 0.4,
            outcome: {
              nativeModelJudge: {
                retentionLabel: 'reject',
              },
            },
          },
        ],
        metadata: {
          themeId: 'mss-grounded-module-generation',
          taskType: 'module-outline',
        },
      },
      {
        id: 'ui-1',
        input: 'prompt 2',
        k: 1,
        passRate: 1,
        trials: [
          {
            trialNum: 1,
            output: 'great',
            duration: 8,
            pass: true,
            score: 0.8,
            outcome: {
              nativeModelJudge: {
                retentionLabel: 'retain_for_review',
              },
            },
          },
        ],
        metadata: {
          themeId: 'controller-compatible-ui-generation',
          taskType: 'controller-ui-outline',
        },
      },
    ]

    const summary = summarizeEvalResults(results)

    expect(summary.promptCount).toBe(2)
    expect(summary.totalTrials).toBe(3)
    expect(summary.passedTrials).toBe(2)
    expect(summary.failedTrials).toBe(1)
    expect(summary.passRate).toBeCloseTo(0.667, 3)
    expect(summary.averageScore).toBeCloseTo(0.7, 3)
    expect(summary.prompts[0]?.failedTrials).toBe(1)
    expect(summary.prompts[0]?.retentionLabels.retain_for_distillation).toBe(1)
    expect(summary.prompts[0]?.retentionLabels.reject).toBe(1)
    expect(summary.themes[1]?.themeId).toBe('mss-grounded-module-generation')
  })
})

describe('formatEvalSummary', () => {
  test('renders a readable markdown summary', () => {
    const output = formatEvalSummary({
      promptCount: 1,
      totalTrials: 2,
      passedTrials: 1,
      failedTrials: 1,
      passRate: 0.5,
      averageScore: 0.75,
      prompts: [
        {
          id: 'module-1',
          themeId: 'mss-grounded-module-generation',
          taskType: 'module-outline',
          totalTrials: 2,
          passedTrials: 1,
          failedTrials: 1,
          passRate: 0.5,
          averageScore: 0.75,
          retentionLabels: {
            retain_for_review: 1,
          },
        },
      ],
      themes: [
        {
          themeId: 'mss-grounded-module-generation',
          promptCount: 1,
          totalTrials: 2,
          passedTrials: 1,
          failedTrials: 1,
          passRate: 0.5,
          averageScore: 0.75,
          retentionLabels: {
            retain_for_review: 1,
          },
        },
      ],
    })

    expect(output).toContain('# Eval Summary')
    expect(output).toContain('## By Prompt')
    expect(output).toContain('Validation passed trials: 1')
    expect(output).toContain('module-1: theme=mss-grounded-module-generation')
    expect(output).toContain('validation=1/2 (0.500)')
    expect(output).toContain('retain_for_review=1')
  })
})
