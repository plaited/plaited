import { describe, expect, test } from 'bun:test'
import {
  RepoImprovementJudgeInputSchema,
  RepoImprovementJudgeOutcomeSchema,
  RepoImprovementMetaVerifierOutcomeSchema,
  TrialJudgeInputSchema,
  TrialJudgeResultSchema,
  TrialMetaVerifierInputSchema,
  TrialMetaVerifierOutcomeSchema,
} from '../judge-contracts.ts'

describe('judge contracts', () => {
  test('distinguishes repo-improvement judging from trial-result judging', () => {
    const repoInput = RepoImprovementJudgeInputSchema.parse({
      evaluationTarget: 'repo-improvement',
      task: 'Implement the slice',
      candidateOutput: 'Updated improve contracts.',
      changedFiles: ['src/improve/judge-contracts.ts'],
      diffStat: '1 file changed',
      patch: 'diff --git a/src/improve/judge-contracts.ts',
      checks: {
        typecheck: { passed: true },
      },
      program: '# Program',
      slice: '# Slice',
    })

    const trialInput = TrialJudgeInputSchema.parse({
      evaluationTarget: 'trial-result',
      prompt: {
        id: 'module-ui-1',
        input: 'Build a module and UI',
        metadata: { lane: 'native-model' },
      },
      trial: {
        trialNum: 1,
        output: 'Generated module and UI.',
        duration: 1200,
        timing: { total: 1100, inputTokens: 400, outputTokens: 800 },
      },
    })

    expect(repoInput.evaluationTarget).toBe('repo-improvement')
    expect(trialInput.evaluationTarget).toBe('trial-result')
  })

  test('supports retained-output suitability labels for trial judging', () => {
    const judgeResult = TrialJudgeResultSchema.parse({
      pass: true,
      score: 0.84,
      reasoning: 'Strong module generation with usable UI wiring.',
      outcome: {
        evaluationTarget: 'trial-result',
        judgeKind: 'trial-result',
        retainedOutput: {
          suitable: ['native-model-distillation', 'ui-module-generation-corpus'],
          unsuitable: ['framework-improvement'],
          notes: 'Good for producer behavior, not for repo mutation.',
        },
      },
    })

    const metaInput = TrialMetaVerifierInputSchema.parse({
      evaluationTarget: 'trial-result',
      judgeInput: {
        evaluationTarget: 'trial-result',
        prompt: {
          id: 'module-ui-1',
          input: 'Build a module and UI',
        },
        trial: {
          trialNum: 1,
          output: 'Generated module and UI.',
          duration: 1200,
        },
      },
      judgeResult,
    })

    const metaOutcome = TrialMetaVerifierOutcomeSchema.parse({
      evaluationTarget: 'trial-result',
      verifierKind: 'trial-meta-verifier',
      trustLabel: 'trusted',
      retainedOutput: {
        suitable: ['native-model-distillation'],
        unsuitable: ['constitution-governance-corpus'],
        notes: 'Retain for native-model curation, not governance examples.',
      },
    })

    expect(metaInput.judgeResult.outcome?.retainedOutput?.suitable).toContain('native-model-distillation')
    expect(metaOutcome.trustLabel).toBe('trusted')
  })

  test('keeps repo-improvement judge and meta-verifier outcomes explicit', () => {
    const judgeOutcome = RepoImprovementJudgeOutcomeSchema.parse({
      evaluationTarget: 'repo-improvement',
      judgeKind: 'repo-improvement',
      rubric: {
        architecture: 0.9,
        boundedness: 0.95,
        focus: 0.85,
        quality: 0.88,
      },
    })

    const metaOutcome = RepoImprovementMetaVerifierOutcomeSchema.parse({
      evaluationTarget: 'repo-improvement',
      judgeKind: 'repo-improvement-meta-verifier',
      rubric: {
        consistency: 0.9,
        risk: 0.8,
        confidence: 0.75,
      },
    })

    expect(judgeOutcome.judgeKind).toBe('repo-improvement')
    expect(metaOutcome.judgeKind).toBe('repo-improvement-meta-verifier')
  })
})
