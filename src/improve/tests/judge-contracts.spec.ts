import { describe, expect, test } from 'bun:test'
import {
  SelfVerificationResultSchema,
  TrialJudgeInputSchema,
  TrialJudgeResultSchema,
  TrialMetaVerifierInputSchema,
  TrialMetaVerifierOutcomeSchema,
  VerificationResultSchema,
  WorkspaceImprovementJudgeInputSchema,
  WorkspaceImprovementJudgeOutcomeSchema,
  WorkspaceImprovementMetaVerifierOutcomeSchema,
} from '../judge-contracts.ts'

describe('judge contracts', () => {
  test('distinguishes workspace-improvement judging from trial-result judging', () => {
    const workspaceInput = WorkspaceImprovementJudgeInputSchema.parse({
      evaluationTarget: 'workspace-improvement',
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

    expect(workspaceInput.evaluationTarget).toBe('workspace-improvement')
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

  test('keeps workspace-improvement judge and meta-verifier outcomes explicit', () => {
    const judgeOutcome = WorkspaceImprovementJudgeOutcomeSchema.parse({
      evaluationTarget: 'workspace-improvement',
      judgeKind: 'workspace-improvement',
      rubric: {
        architecture: 0.9,
        boundedness: 0.95,
        focus: 0.85,
        quality: 0.88,
      },
    })

    const metaOutcome = WorkspaceImprovementMetaVerifierOutcomeSchema.parse({
      evaluationTarget: 'workspace-improvement',
      judgeKind: 'workspace-improvement-meta-verifier',
      rubric: {
        consistency: 0.9,
        risk: 0.8,
        confidence: 0.75,
      },
    })

    expect(judgeOutcome.judgeKind).toBe('workspace-improvement')
    expect(metaOutcome.judgeKind).toBe('workspace-improvement-meta-verifier')
  })

  test('supports explicit verification and self-verification results', () => {
    const verification = VerificationResultSchema.parse({
      verificationTarget: 'workspace-improvement',
      passed: false,
      confidence: 0.8,
      checks: [
        {
          name: 'scope',
          kind: 'deterministic',
          passed: false,
          findings: [
            {
              code: 'out_of_scope',
              severity: 'error',
              message: 'README.md changed outside allowed roots.',
              path: 'README.md',
            },
          ],
        },
      ],
      summary: 'Attempt failed deterministic scope verification.',
    })

    const selfVerification = SelfVerificationResultSchema.parse({
      verificationTarget: 'trial-result',
      verifierKind: 'self-verification',
      passed: true,
      confidence: 0.72,
      checks: [
        {
          name: 'consistency',
          kind: 'meta-verifier',
          passed: true,
          findings: [],
        },
      ],
    })

    expect(verification.checks[0]?.findings[0]?.code).toBe('out_of_scope')
    expect(selfVerification.verifierKind).toBe('self-verification')
  })
})
