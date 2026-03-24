import { describe, expect, test } from 'bun:test'
import { GraderResultSchema } from '../../src/improve.ts'
import {
  buildMetaPrompt,
  ModnetDerivedPromptMetaOutcomeSchema,
  toGraderResult,
} from '../modnet-prompt-derivation-meta-verifier.ts'

describe('modnet-prompt-derivation-meta-verifier', () => {
  test('returns a schema-valid meta verification result', () => {
    const result = toGraderResult({
      pass: true,
      score: 0.78,
      reasoning: 'Primary judge reasoning matches the candidate and precheck.',
      dimensions: {
        consistency: 0.82,
        risk: 0.76,
        confidence: 0.79,
      },
    })

    expect(GraderResultSchema.parse(result)).toEqual(result)
    expect(
      ModnetDerivedPromptMetaOutcomeSchema.parse({
        verifierKind: result.outcome?.verifierKind,
        dimensions: result.outcome?.dimensions,
      }),
    ).toEqual({
      verifierKind: 'modnet-derived-prompt-meta-verifier',
      dimensions: {
        consistency: 0.82,
        risk: 0.76,
        confidence: 0.79,
      },
    })
  })

  test('builds prompt with continuity risks and meta-signal checks', () => {
    const prompt = buildMetaPrompt({
      task: 'Validate this derived candidate.',
      output: JSON.stringify({
        pass: true,
        score: 0.9,
        reasoning: 'Conservative precursor with bounded composition.',
      }),
      metadata: {
        sourcePrompt: {
          id: 'hypercard_klingondictionary',
          input: 'Browse terms by alphabet and show definitions.',
          metadata: {
            patternFamily: 'reference-browser',
            judge: {
              requiredConcepts: ['scale-S4', 'contentType-dictionary', 'structure-list'],
            },
            _source: {
              title: 'Klingon Dictionary',
              description: 'Explore glossary entries with cross references.',
              coreUserJob: 'look up terms',
              whyRelevant: 'reference browsing',
            },
            sourceLikelyPatternFamily: 'reference-browser',
            generatedModernTitle: 'Klingon Dictionary',
            generatedPromptInput: 'Browse glossary entries.',
            generatedPromptHint: 'Build an entry list and detail view.',
            generatedScale: 'S4',
          },
        },
        deterministicCheck: {
          checks: {
            familyContinuity: false,
            sourceScaleFits: true,
          },
          hardFailures: ['missing-source-title'],
        },
        candidatePrompt: {
          id: 'hypercard_klingondictionary-derived-s2',
          targetScale: 'S2',
          input: 'List entries and open one definition detail.',
          hint: 'Derived S2 precursor.',
        },
      },
    })

    expect(prompt).toContain('Meta-guardrails')
    expect(prompt).toContain('Seed context payload')
    expect(prompt).toContain('deterministic hard failures')
    expect(prompt).toContain('Source continuity context')
  })
})
