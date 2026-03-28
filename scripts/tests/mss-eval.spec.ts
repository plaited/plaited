import { describe, expect, test } from 'bun:test'
import { buildWorkspaceImprovementJudgePrompt, buildWorkspaceImprovementMetaVerifierPrompt } from '../../src/improve.ts'
import { buildMssCorpusJudgeInput, MSS_CORPUS_JUDGE_CRITERIA } from '../mss-corpus-grader.ts'
import { getMssCorpusJudgeInput } from '../mss-corpus-verifier.ts'
import { buildMssSeedJudgeInput, MSS_SEED_JUDGE_CRITERIA } from '../mss-seed-grader.ts'
import { getMssSeedJudgeInput } from '../mss-seed-verifier.ts'

describe('mss eval builders', () => {
  test('builds mss-seed judge input with lane metadata', () => {
    const input = buildMssSeedJudgeInput({
      output: 'Updated seed artifact summary.',
      task: 'Evaluate an MSS seed autoresearch attempt.',
      metadata: {
        changedPaths: ['dev-research/mss-seed/seed/mss.jsonld'],
        diffStat: '1 file changed',
        piExitCode: 0,
        validateExitCode: 0,
        cwd: '/tmp/mss-seed-attempt',
      },
    })

    expect(input.slice).toBe('mss-seed')
    expect(input.program).toBe('dev-research/mss-seed/program.md')
    expect(input.changedFiles).toEqual(['dev-research/mss-seed/seed/mss.jsonld'])
  })

  test('builds mss-corpus judge input with lane metadata', () => {
    const input = buildMssCorpusJudgeInput({
      output: 'Updated encoded corpus summary.',
      task: 'Evaluate an MSS corpus autoresearch attempt.',
      metadata: {
        changedPaths: ['dev-research/mss-corpus/encoded/manifest.json'],
        diffStat: '1 file changed',
        cwd: '/tmp/mss-corpus-attempt',
      },
    })

    expect(input.slice).toBe('mss-corpus')
    expect(input.program).toBe('dev-research/mss-corpus/program.md')
    expect(input.changedFiles).toEqual(['dev-research/mss-corpus/encoded/manifest.json'])
  })

  test('shared judge and verifier prompts include lane-specific criteria', () => {
    const input = buildMssSeedJudgeInput({
      output: 'Updated seed artifact summary.',
      task: 'Evaluate an MSS seed autoresearch attempt.',
      metadata: {
        changedPaths: ['dev-research/mss-seed/seed/mss.jsonld'],
        diffStat: '1 file changed',
      },
    })

    const judgePrompt = buildWorkspaceImprovementJudgePrompt({
      input,
      criteria: MSS_SEED_JUDGE_CRITERIA,
    })
    const verifierPrompt = buildWorkspaceImprovementMetaVerifierPrompt({
      input,
      judgeResult: {
        pass: true,
        score: 0.92,
        reasoning: 'Bounded seed improvement.',
      },
      criteria: MSS_CORPUS_JUDGE_CRITERIA,
    })

    expect(judgePrompt).toContain('compact, lane-bounded seed improvements')
    expect(judgePrompt).toContain('dev-research/mss-seed/seed/mss.jsonld')
    expect(verifierPrompt).toContain('corpus improvements')
    expect(verifierPrompt).toContain('"score": 0.92')
  })

  test('recovers preserved judge input for seed and corpus verifiers', () => {
    const seedInput = buildMssSeedJudgeInput({
      output: 'Updated seed artifact summary.',
      task: 'Evaluate an MSS seed autoresearch attempt.',
      metadata: {
        changedPaths: ['dev-research/mss-seed/seed/mss.jsonld'],
        diffStat: '1 file changed',
      },
    })
    const corpusInput = buildMssCorpusJudgeInput({
      output: 'Updated encoded corpus summary.',
      task: 'Evaluate an MSS corpus autoresearch attempt.',
      metadata: {
        changedPaths: ['dev-research/mss-corpus/encoded/manifest.json'],
        diffStat: '1 file changed',
      },
    })

    expect(
      getMssSeedJudgeInput({
        pass: true,
        score: 0.9,
        outcome: {
          judgeSdk: {
            judgeInput: seedInput,
            workspaceRoot: '/tmp/mss-seed-attempt',
          },
        },
      }),
    ).toEqual(seedInput)

    expect(
      getMssCorpusJudgeInput({
        pass: true,
        score: 0.91,
        outcome: {
          judgeSdk: {
            judgeInput: corpusInput,
            workspaceRoot: '/tmp/mss-corpus-attempt',
          },
        },
      }),
    ).toEqual(corpusInput)
  })
})
