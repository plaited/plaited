import { describe, expect, test } from 'bun:test'
import { GraderResultSchema } from '../../src/improve.ts'
import {
  buildJudgePrompt,
  ModnetRawCardInclusionJudgeOutcomeSchema,
  toGraderResult,
} from '../modnet-raw-card-inclusion-judge.ts'

describe('modnet-raw-card-inclusion-judge', () => {
  test('returns a schema-valid grader result', () => {
    const result = toGraderResult({
      pass: true,
      score: 0.86,
      reasoning: 'The card has a durable modern workflow analog and the corollary stays concrete.',
      inclusionDecision: 'retain',
      modernAnalog: 'A private student incident and discipline referral tracker for a school office.',
      coreUserJob: 'Track incidents, referrals, and parent-facing records for student behavior workflows.',
      whyRelevant: 'The durable workflow is incident/referral tracking, not HyperCard-era implementation.',
      likelyPatternFamily: 'business-process',
      likelyStructure: 'form',
      searchQuerySeed: 'school discipline referral tracking software student behavior incident',
      dimensions: {
        relevance: 0.9,
        corollaryFit: 0.85,
        moduleShape: 0.82,
        restraint: 0.86,
      },
    })

    expect(GraderResultSchema.parse(result)).toEqual(result)
    expect(
      ModnetRawCardInclusionJudgeOutcomeSchema.parse({
        judgeKind: result.outcome?.judgeKind,
        inclusionDecision: result.outcome?.inclusionDecision,
        modernAnalog: result.outcome?.modernAnalog,
        coreUserJob: result.outcome?.coreUserJob,
        whyRelevant: result.outcome?.whyRelevant,
        likelyPatternFamily: result.outcome?.likelyPatternFamily,
        likelyStructure: result.outcome?.likelyStructure,
        searchQuerySeed: result.outcome?.searchQuerySeed,
      }),
    ).toEqual({
      judgeKind: 'modnet-raw-card-inclusion',
      inclusionDecision: 'retain',
      modernAnalog: 'A private student incident and discipline referral tracker for a school office.',
      coreUserJob: 'Track incidents, referrals, and parent-facing records for student behavior workflows.',
      whyRelevant: 'The durable workflow is incident/referral tracking, not HyperCard-era implementation.',
      likelyPatternFamily: 'business-process',
      likelyStructure: 'form',
      searchQuerySeed: 'school discipline referral tracking software student behavior incident',
    })
  })

  test('keeps obsolete-surface translation and generic-analog avoidance explicit', () => {
    const prompt = buildJudgePrompt({
      task: 'Evaluate the inclusion output.',
      output: JSON.stringify({
        inclusionDecision: 'retain_low_priority',
        modernAnalog: 'A private organizer on my phone that keeps everything in one place.',
      }),
      metadata: {
        rawCard: {
          id: 'macrepo_fax-router',
          title: 'Fax Router',
          description: 'Routes incoming faxes to staff and logs status for follow-up.',
        },
        deterministicCheck: {
          pass: true,
        },
      },
    })

    expect(prompt).toContain('Fax, dial-up, or era-specific transport')
    expect(prompt).toContain('obsolete surface alone is not a discard reason')
    expect(prompt).toContain('cassette labels can become merch, vinyl, or Cricut-style print-label workflows')
    expect(prompt).toContain('phone-number changes can become contact-data normalization or migration workflows')
    expect(prompt).toContain('Prefer discard only when both the historical medium is obsolete')
    expect(prompt).toContain('Niche physical or operator workflows still count')
    expect(prompt).toContain('The modern analog should stay concrete.')
    expect(prompt).toContain(
      'Fail restraint if the judge jumps from an obsolete artifact directly to a broad generic app category',
    )
    expect(prompt).toContain('The search query seed should target the modern workflow/job')
    expect(prompt).toContain('source_url or archive-page nostalgia')
  })
})
