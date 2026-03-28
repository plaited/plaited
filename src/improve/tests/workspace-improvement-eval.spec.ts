import { describe, expect, test } from 'bun:test'
import {
  buildWorkspaceImprovementJudgeInput,
  buildWorkspaceImprovementJudgePrompt,
  buildWorkspaceImprovementMetaVerifierPrompt,
  WorkspaceImprovementJudgeResponseSchema,
  WorkspaceImprovementMetaVerifierResponseSchema,
} from '../workspace-improvement-eval.ts'

describe('workspace-improvement-eval', () => {
  test('builds validated judge input', () => {
    const input = buildWorkspaceImprovementJudgeInput({
      evaluationTarget: 'workspace-improvement',
      task: 'Improve the mss-seed lane.',
      candidateOutput: 'Updated seed artifacts.',
      changedFiles: ['dev-research/mss-seed/seed/mss.jsonld'],
      diffStat: '1 file changed',
      patch: 'diff --git a/... b/...',
      checks: { validateExitCode: 0 },
      program: 'dev-research/mss-seed/program.md',
      slice: 'mss-seed',
    })

    expect(input.slice).toBe('mss-seed')
    expect(input.changedFiles).toContain('dev-research/mss-seed/seed/mss.jsonld')
  })

  test('builds judge prompt with criteria and patch context', () => {
    const input = buildWorkspaceImprovementJudgeInput({
      evaluationTarget: 'workspace-improvement',
      task: 'Improve the mss-corpus lane.',
      candidateOutput: 'Added encoded corpus manifest.',
      changedFiles: ['dev-research/mss-corpus/encoded/manifest.json'],
      diffStat: '1 file changed',
      patch: 'diff --git a/manifest b/manifest',
      checks: { validateExitCode: 0, piExitCode: 0 },
      program: 'dev-research/mss-corpus/program.md',
      slice: 'mss-corpus',
    })

    const prompt = buildWorkspaceImprovementJudgePrompt({
      input,
      criteria: 'Prefer source-backed encoded corpus outputs.',
    })

    expect(prompt).toContain('Prefer source-backed encoded corpus outputs.')
    expect(prompt).toContain('diff --git a/manifest b/manifest')
    expect(prompt).toContain('dev-research/mss-corpus/encoded/manifest.json')
  })

  test('builds meta-verifier prompt from judge result', () => {
    const input = buildWorkspaceImprovementJudgeInput({
      evaluationTarget: 'workspace-improvement',
      task: 'Improve the mss-seed lane.',
      candidateOutput: 'Updated seed artifacts.',
      changedFiles: ['dev-research/mss-seed/seed/mss.jsonld'],
      diffStat: '1 file changed',
      patch: 'diff --git a/... b/...',
      checks: { validateExitCode: 0 },
      program: 'dev-research/mss-seed/program.md',
      slice: 'mss-seed',
    })

    const prompt = buildWorkspaceImprovementMetaVerifierPrompt({
      input,
      judgeResult: {
        pass: true,
        score: 0.9,
        reasoning: 'Looks good.',
      },
      criteria: 'Prefer compact seed anchors.',
    })

    expect(prompt).toContain('Prefer compact seed anchors.')
    expect(prompt).toContain('"score": 0.9')
    expect(prompt).toContain('dev-research/mss-seed/seed/mss.jsonld')
  })

  test('parses judge and verifier response schemas', () => {
    expect(() =>
      WorkspaceImprovementJudgeResponseSchema.parse({
        pass: true,
        score: 0.9,
        reasoning: 'Strong bounded change.',
        outcome: {
          evaluationTarget: 'workspace-improvement',
          judgeKind: 'workspace-improvement',
        },
      }),
    ).not.toThrow()

    expect(() =>
      WorkspaceImprovementMetaVerifierResponseSchema.parse({
        confidence: 0.8,
        reasoning: 'Supported by changed files and checks.',
      }),
    ).not.toThrow()
  })
})
