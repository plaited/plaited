import { describe, expect, test } from 'bun:test'
import {
  buildWorkspaceImprovementJudgeInput,
  buildWorkspaceImprovementJudgePrompt,
  buildWorkspaceImprovementMetaVerifierPrompt,
  buildWorkspaceImprovementPromotionPrompt,
  WorkspaceImprovementJudgeResponseSchema,
  WorkspaceImprovementMetaVerifierResponseSchema,
  WorkspaceImprovementPromotionDecisionSchema,
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
      programText: '# MSS Seed Program\n\nSeed contract.',
      slice: 'mss-seed',
      contextFiles: [{ path: 'dev-research/mss-seed/seed/mss.jsonld', content: '{"@id":"mss:test"}' }],
      skillCatalog: [{ path: 'skills/mss', description: 'MSS modeling skill.' }],
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
      programText: '# MSS Corpus Program\n\nCorpus contract.',
      slice: 'mss-corpus',
      contextFiles: [{ path: 'dev-research/mss-corpus/encoded/manifest.json', content: '{"ok":true}' }],
      skillCatalog: [{ path: 'skills/mss', description: 'MSS modeling skill.' }],
    })

    const prompt = buildWorkspaceImprovementJudgePrompt({
      input,
      criteria: 'Prefer source-backed encoded corpus outputs.',
    })

    expect(prompt).toContain('Prefer source-backed encoded corpus outputs.')
    expect(prompt).toContain('diff --git a/manifest b/manifest')
    expect(prompt).toContain('dev-research/mss-corpus/encoded/manifest.json')
    expect(prompt).toContain('# MSS Corpus Program')
    expect(prompt).toContain('skills/mss: MSS modeling skill.')
    expect(prompt).toContain('Your primary job is to find problems')
    expect(prompt).toContain('Do not approve eagerly')
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
      programText: '# MSS Seed Program\n\nSeed contract.',
      slice: 'mss-seed',
      contextFiles: [{ path: 'dev-research/mss-seed/seed/mss.jsonld', content: '{"@id":"mss:test"}' }],
      skillCatalog: [{ path: 'skills/mss', description: 'MSS modeling skill.' }],
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
    expect(prompt).toContain('# MSS Seed Program')
    expect(prompt).toContain('skills/mss: MSS modeling skill.')
    expect(prompt).toContain('challenge the judgment')
    expect(prompt).toContain('Prefer skepticism over agreement')
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

    expect(() =>
      WorkspaceImprovementPromotionDecisionSchema.parse({
        action: 'promote_one',
        selectedAttempt: 3,
        selectedCommit: 'abc123',
        confidence: 0.85,
        reasoning: 'Attempt 3 is the clearest winner.',
      }),
    ).not.toThrow()
  })

  test('builds promotion prompt with attempt summaries', () => {
    const prompt = buildWorkspaceImprovementPromotionPrompt({
      lane: 'mss-seed',
      program: 'dev-research/mss-seed/program.md',
      attempts: [
        {
          attempt: 2,
          commit: 'abc123',
          pass: true,
          score: 0.91,
          confidence: 0.84,
          changedFiles: ['dev-research/mss-seed/seed/mss.jsonld'],
          diffStat: '1 file changed',
          reasoning: 'Strong bounded seed improvement.',
        },
      ],
    })

    expect(prompt).toContain('Select a promotion decision')
    expect(prompt).toContain('Attempt 2')
    expect(prompt).toContain('abc123')
    expect(prompt).toContain('manual review')
  })
})
