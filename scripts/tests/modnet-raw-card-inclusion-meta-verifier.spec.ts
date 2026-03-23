import { describe, expect, test } from 'bun:test'
import { GraderResultSchema } from '../../src/improve.ts'
import {
  buildMetaPrompt,
  ModnetRawCardInclusionMetaOutcomeSchema,
  toGraderResult,
} from '../modnet-raw-card-inclusion-meta-verifier.ts'

describe('modnet-raw-card-inclusion-meta-verifier', () => {
  test('returns a schema-valid meta verification result', () => {
    const result = toGraderResult({
      pass: true,
      score: 0.81,
      reasoning: 'The primary inclusion result is consistent with the raw card and stays restrained.',
      dimensions: {
        consistency: 0.84,
        risk: 0.25,
        confidence: 0.8,
      },
    })

    expect(GraderResultSchema.parse(result)).toEqual(result)
    expect(
      ModnetRawCardInclusionMetaOutcomeSchema.parse({
        verifierKind: result.outcome?.verifierKind,
        dimensions: result.outcome?.dimensions,
      }),
    ).toEqual({
      verifierKind: 'modnet-raw-card-inclusion-meta-verifier',
      dimensions: {
        consistency: 0.84,
        risk: 0.25,
        confidence: 0.8,
      },
    })
  })

  test('preserves a schema-valid risky failure outcome', () => {
    const result = toGraderResult({
      pass: false,
      score: 0.29,
      reasoning: 'The primary judge invented a generic analog and did not justify retention from the raw description.',
      dimensions: {
        consistency: 0.34,
        risk: 0.89,
        confidence: 0.27,
      },
    })

    expect(GraderResultSchema.parse(result)).toEqual(result)
    expect(
      ModnetRawCardInclusionMetaOutcomeSchema.parse({
        verifierKind: result.outcome?.verifierKind,
        dimensions: result.outcome?.dimensions,
      }),
    ).toEqual({
      verifierKind: 'modnet-raw-card-inclusion-meta-verifier',
      dimensions: {
        consistency: 0.34,
        risk: 0.89,
        confidence: 0.27,
      },
    })
  })

  test('keeps obsolete-medium and thin-demo checks explicit', () => {
    const prompt = buildMetaPrompt({
      task: 'Meta-verify the judge result.',
      output: JSON.stringify({
        pass: false,
        score: 0.21,
        reasoning: 'The medium is obsolete so this should be discarded.',
        inclusionDecision: 'discard',
      }),
      metadata: {
        rawCard: {
          id: 'hypercard_audio-cass-labeler-101',
          title: 'Audio Cass. Labeler 1.0.1',
          description: 'Print multiple labels for audio cassette boxes and keep a consistent presentation.',
        },
        deterministicCheck: {
          pass: true,
        },
      },
    })

    expect(prompt).toContain('Obsolete storage, transport, or packaging formats can still imply a valid modern module')
    expect(prompt).toContain('cassette labeler -> physical media, merch, or print-label workflow')
    expect(prompt).toContain('phone-number change utility -> contact-data normalization or migration')
    expect(prompt).toContain('treats "old medium" as sufficient evidence for discard')
    expect(prompt).toContain('technique demo, script trick, or implementation sample with no bounded end-user workflow')
    expect(prompt).toContain('invented a broad modern category')
  })
})
