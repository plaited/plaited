import { describe, expect, test } from 'bun:test'
import type { TrialResult } from '../trial.schemas.ts'
import { formatTrialSummary, summarizeTrialResults } from '../trial-report.ts'

describe('summarizeTrialResults', () => {
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
            trainingAssessment: {
              eligible: true,
              richness: 'full',
              weight: 0.8,
              reasons: [],
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
            trainingAssessment: {
              eligible: false,
              richness: 'minimal',
              weight: 0,
              reasons: ['failed_grade'],
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

    const summary = summarizeTrialResults(results)

    expect(summary.promptCount).toBe(2)
    expect(summary.totalTrials).toBe(3)
    expect(summary.passedTrials).toBe(2)
    expect(summary.failedTrials).toBe(1)
    expect(summary.passRate).toBeCloseTo(0.667, 3)
    expect(summary.averageScore).toBeCloseTo(0.7, 3)
    expect(summary.eligibleTrials).toBe(1)
    expect(summary.eligibleRate).toBeCloseTo(0.333, 3)
    expect(summary.prompts[0]?.retentionLabels.retain_for_distillation).toBe(1)
    expect(summary.prompts[0]?.retentionLabels.reject).toBe(1)
    expect(summary.themes[1]?.themeId).toBe('mss-grounded-module-generation')
  })
})

describe('formatTrialSummary', () => {
  test('renders a readable markdown summary', () => {
    const output = formatTrialSummary({
      promptCount: 1,
      totalTrials: 2,
      passedTrials: 1,
      failedTrials: 1,
      passRate: 0.5,
      eligibleTrials: 1,
      eligibleRate: 0.5,
      averageScore: 0.75,
      prompts: [
        {
          id: 'module-1',
          themeId: 'mss-grounded-module-generation',
          taskType: 'module-outline',
          totalTrials: 2,
          passedTrials: 1,
          passRate: 0.5,
          eligibleTrials: 1,
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
          passRate: 0.5,
          eligibleTrials: 1,
          averageScore: 0.75,
          retentionLabels: {
            retain_for_review: 1,
          },
        },
      ],
    })

    expect(output).toContain('# Trial Summary')
    expect(output).toContain('## By Prompt')
    expect(output).toContain('module-1: theme=mss-grounded-module-generation')
    expect(output).toContain('retain_for_review=1')
  })
})
