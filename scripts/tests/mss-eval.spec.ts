import { describe, expect, test } from 'bun:test'
import { buildWorkspaceImprovementJudgePrompt, buildWorkspaceImprovementMetaVerifierPrompt } from '../../src/improve.ts'
import { BEHAVIORAL_CORPUS_JUDGE_CRITERIA, buildBehavioralCorpusJudgeInput } from '../behavioral-corpus-grader.ts'
import { getBehavioralCorpusJudgeInput } from '../behavioral-corpus-verifier.ts'
import {
  BEHAVIORAL_FACTORIES_JUDGE_CRITERIA,
  buildBehavioralFactoriesJudgeInput,
} from '../behavioral-factories-grader.ts'
import { getBehavioralFactoriesJudgeInput } from '../behavioral-factories-verifier.ts'
import { BEHAVIORAL_SEED_JUDGE_CRITERIA, buildBehavioralSeedJudgeInput } from '../behavioral-seed-grader.ts'
import { getBehavioralSeedJudgeInput } from '../behavioral-seed-verifier.ts'
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
        patch: 'diff --git a/seed b/seed',
        piExitCode: 0,
        validateExitCode: 0,
        cwd: '/tmp/mss-seed-attempt',
        programText: '# Seed Program',
        contextFiles: [{ path: 'dev-research/mss-seed/seed/mss.jsonld', content: '{"@id":"mss:test"}' }],
        skillCatalog: [{ path: 'skills/mss', description: 'MSS modeling skill.' }],
      },
    })

    expect(input.slice).toBe('mss-seed')
    expect(input.program).toBe('dev-research/mss-seed/program.md')
    expect(input.changedFiles).toEqual(['dev-research/mss-seed/seed/mss.jsonld'])
    expect(input.patch).toContain('diff --git')
    expect(input.programText).toContain('# Seed Program')
    expect(input.skillCatalog?.[0]?.path).toBe('skills/mss')
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

  test('builds behavioral-factories judge input with lane metadata', () => {
    const input = buildBehavioralFactoriesJudgeInput({
      output: 'Updated factory guard summary.',
      task: 'Evaluate a behavioral-factories autoresearch attempt.',
      metadata: {
        changedPaths: ['dev-research/behavioral-factories/factories/policy-guards.json'],
        diffStat: '1 file changed',
        cwd: '/tmp/behavioral-factories-attempt',
      },
    })

    expect(input.slice).toBe('behavioral-factories')
    expect(input.program).toBe('dev-research/behavioral-factories/program.md')
    expect(input.changedFiles).toEqual(['dev-research/behavioral-factories/factories/policy-guards.json'])
  })

  test('builds behavioral-seed and behavioral-corpus judge input with lane metadata', () => {
    const seedInput = buildBehavioralSeedJudgeInput({
      output: 'Updated behavioral seed summary.',
      task: 'Evaluate a behavioral-seed autoresearch attempt.',
      metadata: {
        changedPaths: ['dev-research/behavioral-seed/seed/anchors.jsonld'],
        diffStat: '1 file changed',
      },
    })
    const corpusInput = buildBehavioralCorpusJudgeInput({
      output: 'Updated behavioral corpus summary.',
      task: 'Evaluate a behavioral-corpus autoresearch attempt.',
      metadata: {
        changedPaths: ['dev-research/behavioral-corpus/encoded/manifest.json'],
        diffStat: '1 file changed',
      },
    })

    expect(seedInput.slice).toBe('behavioral-seed')
    expect(seedInput.program).toBe('dev-research/behavioral-seed/program.md')
    expect(corpusInput.slice).toBe('behavioral-corpus')
    expect(corpusInput.program).toBe('dev-research/behavioral-corpus/program.md')
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

  test('behavioral seed and corpus prompts include lane-specific criteria', () => {
    const seedInput = buildBehavioralSeedJudgeInput({
      output: 'Updated behavioral seed summary.',
      task: 'Evaluate a behavioral-seed autoresearch attempt.',
      metadata: {
        changedPaths: ['dev-research/behavioral-seed/seed/anchors.jsonld'],
        diffStat: '1 file changed',
      },
    })
    const corpusInput = buildBehavioralCorpusJudgeInput({
      output: 'Updated behavioral corpus summary.',
      task: 'Evaluate a behavioral-corpus autoresearch attempt.',
      metadata: {
        changedPaths: ['dev-research/behavioral-corpus/encoded/manifest.json'],
        diffStat: '1 file changed',
      },
    })

    expect(
      buildWorkspaceImprovementJudgePrompt({
        input: seedInput,
        criteria: BEHAVIORAL_SEED_JUDGE_CRITERIA,
      }),
    ).toContain('behavioral-seed improvements')
    expect(
      buildWorkspaceImprovementMetaVerifierPrompt({
        input: corpusInput,
        judgeResult: {
          pass: true,
          score: 0.91,
          reasoning: 'Bounded corpus improvement.',
        },
        criteria: BEHAVIORAL_CORPUS_JUDGE_CRITERIA,
      }),
    ).toContain('behavioral-corpus improvements')
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

    const behavioralFactoriesInput = buildBehavioralFactoriesJudgeInput({
      output: 'Updated factory guard summary.',
      task: 'Evaluate a behavioral-factories autoresearch attempt.',
      metadata: {
        changedPaths: ['dev-research/behavioral-factories/factories/policy-guards.json'],
        diffStat: '1 file changed',
      },
    })

    expect(
      getBehavioralFactoriesJudgeInput({
        pass: true,
        score: 0.88,
        outcome: {
          judgeSdk: {
            judgeInput: behavioralFactoriesInput,
            workspaceRoot: '/tmp/behavioral-factories-attempt',
          },
        },
      }),
    ).toEqual(behavioralFactoriesInput)

    const behavioralSeedInput = buildBehavioralSeedJudgeInput({
      output: 'Updated behavioral seed summary.',
      task: 'Evaluate a behavioral-seed autoresearch attempt.',
      metadata: {
        changedPaths: ['dev-research/behavioral-seed/seed/anchors.jsonld'],
        diffStat: '1 file changed',
      },
    })
    const behavioralCorpusInput = buildBehavioralCorpusJudgeInput({
      output: 'Updated behavioral corpus summary.',
      task: 'Evaluate a behavioral-corpus autoresearch attempt.',
      metadata: {
        changedPaths: ['dev-research/behavioral-corpus/encoded/manifest.json'],
        diffStat: '1 file changed',
      },
    })

    expect(
      getBehavioralSeedJudgeInput({
        pass: true,
        score: 0.87,
        outcome: {
          judgeSdk: {
            judgeInput: behavioralSeedInput,
            workspaceRoot: '/tmp/behavioral-seed-attempt',
          },
        },
      }),
    ).toEqual(behavioralSeedInput)

    expect(
      getBehavioralCorpusJudgeInput({
        pass: true,
        score: 0.89,
        outcome: {
          judgeSdk: {
            judgeInput: behavioralCorpusInput,
            workspaceRoot: '/tmp/behavioral-corpus-attempt',
          },
        },
      }),
    ).toEqual(behavioralCorpusInput)
  })

  test('behavioral-factories prompts include lane-specific criteria', () => {
    const input = buildBehavioralFactoriesJudgeInput({
      output: 'Updated factory guard summary.',
      task: 'Evaluate a behavioral-factories autoresearch attempt.',
      metadata: {
        changedPaths: ['dev-research/behavioral-factories/factories/policy-guards.json'],
        diffStat: '1 file changed',
      },
    })

    const judgePrompt = buildWorkspaceImprovementJudgePrompt({
      input,
      criteria: BEHAVIORAL_FACTORIES_JUDGE_CRITERIA,
    })

    expect(judgePrompt).toContain('factory-oriented outputs')
    expect(judgePrompt).toContain('dev-research/behavioral-factories/factories/policy-guards.json')
  })
})
