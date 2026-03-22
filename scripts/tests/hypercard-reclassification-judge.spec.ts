import { describe, expect, test } from 'bun:test'
import { GraderResultSchema } from '../../src/improve.ts'
import {
  buildJudgePrompt,
  HypercardReclassificationJudgeOutcomeSchema,
  toGraderResult,
} from '../hypercard-reclassification-judge.ts'

describe('hypercard-reclassification-judge', () => {
  test('returns a schema-valid grader result', () => {
    const result = toGraderResult({
      pass: true,
      score: 0.84,
      reasoning: 'The stack is more suite-like than the current S2 label suggests.',
      patternFamily: 'business-process',
      mss: {
        contentType: 'work-evaluation',
        structure: 'collection',
        mechanics: ['track'],
        boundary: 'none',
        scale: 4,
        confidence: 'medium',
      },
      keepForSeedReview: true,
      rationale: 'Payroll/history/reporting looks like a richer module seed.',
      dimensions: {
        scaleFit: 0.87,
        familyFit: 0.82,
        evidenceUse: 0.86,
        modernizationValue: 0.81,
      },
    })

    expect(GraderResultSchema.parse(result)).toEqual(result)
    expect(
      HypercardReclassificationJudgeOutcomeSchema.parse({
        judgeKind: result.outcome?.judgeKind,
        patternFamily: result.outcome?.patternFamily,
        mss: result.outcome?.mss,
        keepForSeedReview: result.outcome?.keepForSeedReview,
        rationale: result.outcome?.rationale,
      }),
    ).toEqual({
      judgeKind: 'hypercard-reclassification',
      patternFamily: 'business-process',
      mss: {
        contentType: 'work-evaluation',
        structure: 'collection',
        mechanics: ['track'],
        boundary: 'none',
        scale: 4,
        confidence: 'medium',
      },
      keepForSeedReview: true,
      rationale: 'Payroll/history/reporting looks like a richer module seed.',
    })
  })

  test('builds prompt guidance that resists lexical snap-to-label errors on hard cases', () => {
    const prompt = buildJudgePrompt({
      task: 'Reclassify the HyperCard seed.',
      output: 'Create a workflow module from a keyboard stack and let people contact me.',
      metadata: {
        sourceRecord: {
          id: 'hypercard_keyboard-stack',
          title: 'KeyBoard Stack',
          description: 'A keyboard that you can play and play back melodies you recorded.',
        },
        currentClassification: {
          patternFamily: 'business-process',
          mss: {
            contentType: 'art',
            structure: 'form',
            mechanics: ['contact'],
            boundary: 'none',
            scale: 2,
            confidence: 'high',
          },
        },
        heuristicPrior: {
          suggestedMinimumScale: 2,
          reasons: ['playback tool remains a single authoring workflow'],
          scaleLooksUnderstated: false,
        },
      },
    })

    expect(prompt).toContain('Instrument-control is for operating external hardware')
    expect(prompt).toContain('Business-process beats personal-data-manager')
    expect(prompt).toContain('author contact details, or distribution notes')
    expect(prompt).toContain('S4 is rare and requires multiple distinct S3-like blocks')
    expect(prompt).toContain('Resist lexical snap-to-label errors.')
  })

  test('keeps hard-case scale and seed-worthiness guidance explicit for niche research tools', () => {
    const prompt = buildJudgePrompt({
      task: 'Reclassify the HyperCard seed.',
      output: 'Create a workflow module from a laboratory toolbox.',
      metadata: {
        sourceRecord: {
          id: 'hypercard_laboratorytoolbox',
          title: 'The Laboratory Toolbox 1.0b',
          description: 'Helps organize hypothesis testing, project stacks, data stacks, and objects.',
          modernization: 'niche',
        },
        currentClassification: {
          patternFamily: 'business-process',
          mss: {
            contentType: 'science',
            structure: 'list',
            mechanics: [],
            boundary: 'none',
            scale: 2,
            confidence: 'high',
          },
        },
        heuristicPrior: {
          suggestedMinimumScale: 3,
          reasons: ['multiple research views may imply a richer block'],
          scaleLooksUnderstated: true,
        },
      },
    })

    expect(prompt).toContain('Seed-worthiness should favor niche-gold sovereign modules')
    expect(prompt).toContain(
      '"Complete", "thorough", "powerful", or "suite-like" prose is not enough for S4 by itself.',
    )
    expect(prompt).toContain('"id": "hypercard_laboratorytoolbox"')
    expect(prompt).toContain('"modernization": "niche"')
  })
})
