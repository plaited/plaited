import { describe, expect, test } from 'bun:test'
import { GraderResultSchema } from '../../src/improve.ts'
import {
  buildJudgePrompt,
  ModnetDerivedPromptJudgeOutcomeSchema,
  toGraderResult,
} from '../modnet-prompt-derivation-judge.ts'

describe('modnet-prompt-derivation-judge', () => {
  test('returns a schema-valid grader result', () => {
    const result = toGraderResult({
      pass: true,
      score: 0.86,
      reasoning: 'Strong source fidelity and good scale fit.',
      dimensions: {
        fidelity: 0.9,
        scaleFit: 0.88,
        usefulness: 0.84,
        specificity: 0.82,
      },
    })

    expect(GraderResultSchema.parse(result)).toEqual(result)
    expect(
      ModnetDerivedPromptJudgeOutcomeSchema.parse({
        judgeKind: result.outcome?.judgeKind,
        dimensions: result.outcome?.dimensions,
      }),
    ).toEqual({
      judgeKind: 'modnet-derived-prompt',
      dimensions: {
        fidelity: 0.9,
        scaleFit: 0.88,
        usefulness: 0.84,
        specificity: 0.82,
      },
    })
  })

  test('builds continuity guardrails from deterministic continuity signals', () => {
    const prompt = buildJudgePrompt({
      task: 'Derive lower-scale candidate.',
      output: JSON.stringify(
        {
          id: 'farm-stand-s2-produce-list',
          sourceId: 'hypercard_archimedes-discovering-pi',
          targetScale: 'S2',
          input: 'List produce cards with a bounded name/price view.',
          hint: 'Derived S2 precursor for a bigger module.',
        },
        null,
        2,
      ),
      metadata: {
        sourcePrompt: {
          id: 'hypercard_archimedes-discovering-pi',
          input: 'Show all discovered approximations and calculations.',
          hint: 'Seed',
          metadata: {
            patternFamily: 'creative-tool',
            judge: {
              requiredConcepts: ['scale-S4', 'contentType-geometry', 'structure-collection'],
            },
            sourceLikelyPatternFamily: 'creative-tool',
            sourceScaleEstimateLabel: 'S4',
            generatedModernTitle: 'Pi Discovery Explorer',
            generatedPromptInput: 'Create one interactive calculation tile.',
            generatedPromptHint: 'Build a small creative tile.',
            generatedScale: 'S4',
          },
          _source: {
            title: 'Archimedes Discovering Pi',
            description: 'An interactive sequence for estimating pi.',
            coreUserJob: 'derive numerical estimation',
            whyRelevant: 'educational exploration',
          },
        },
        deterministicCheck: {
          checks: {
            familyContinuity: false,
            sourceScaleFits: false,
            avoidsGenericTemplateLanguage: false,
          },
          hardFailures: ['source-scale-too-small'],
        },
        sourceContext: {
          seedTitle: 'Pi Discovery Explorer',
          sourceScale: 'S4',
        },
        candidatePrompt: {
          id: 'hypercard_archimedes-discovering-pi-derived-s2',
        },
      },
    })

    expect(prompt).toContain('Continuity guardrails')
    expect(prompt).toContain('deterministic hard failures')
    expect(prompt).toContain('scale-fit-risk')
    expect(prompt).toContain('Archimedes/pi explorer')
    expect(prompt).toContain('source context summary')
  })
})
