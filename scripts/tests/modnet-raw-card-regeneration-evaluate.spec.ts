import { describe, expect, test } from 'bun:test'
import { assessRegenerationCandidate, evaluateRegenerationCandidate } from '../modnet-raw-card-regeneration-evaluate.ts'

const rawCard = {
  id: 'hypercard_school-discipline',
  title: 'School Discipline',
  description: 'Track referrals for student behavior incidents and parent conferences.',
  inclusionDecision: 'retain' as const,
  modernAnalog: 'A private student behavior referral tracker for school staff.',
  coreUserJob: 'Track incidents, referrals, and follow-up actions for a school office.',
  whyRelevant: 'The durable job is incident/referral workflow management.',
  likelyPatternFamily: 'business-process',
  likelyStructure: 'form',
  searchQuerySeed: 'school discipline referral tracking software student behavior incident',
}

describe('modnet-raw-card-regeneration-evaluate', () => {
  test('passes and recommends a grounded search variant', () => {
    const evaluation = evaluateRegenerationCandidate({
      rawCard,
      variantId: 'base_1_search',
      promptDraft: {
        id: 'school-discipline-search',
        input:
          'Build a private school discipline referral tracker for staff to log incidents and parent conference notes.',
        hint: 'Use a bounded internal workflow with clear incident records and follow-up actions.',
      },
      research: {
        usedSearch: true,
        usedTargetedFollowUpSearch: false,
        usedLivecrawl: false,
        usedResearchLite: false,
        searchQuery: 'school discipline referral tracking software student behavior incident',
        followUpSearchQuery: '',
        livecrawlReason: '',
        searchSnippetCount: 4,
        followUpSnippetCount: 0,
        modernWorkflowVocabulary: ['incident tracking', 'discipline referral', 'parent conference'],
        moduleShapeRecoveredFromSearch: 'clear',
      },
      assessment: {
        modernRelevance: 'high',
        promptQuality: 'high',
        mssPlausibility: 'high',
        seedWorthiness: 'medium',
        handcraftedAnchorMode: 'pattern_only',
      },
    })

    expect(evaluation.deterministicCheck.pass).toBe(true)
    expect(evaluation.recommended).toBe(true)
  })

  test('flags a base variant that incorrectly claims search enrichment', () => {
    const check = assessRegenerationCandidate({
      rawCard,
      variantId: 'base_1',
      promptDraft: {
        id: 'bad-base',
        input: 'Build a private discipline tracker for school staff and parent conference follow-up.',
        hint: 'Keep the workflow internal and structured.',
      },
      research: {
        usedSearch: true,
        usedTargetedFollowUpSearch: false,
        usedLivecrawl: false,
        usedResearchLite: false,
        searchQuery: 'school discipline referral tracking',
        followUpSearchQuery: '',
        livecrawlReason: '',
        searchSnippetCount: 2,
        followUpSnippetCount: 0,
        modernWorkflowVocabulary: ['discipline tracking'],
        moduleShapeRecoveredFromSearch: 'clear',
      },
      assessment: {
        modernRelevance: 'medium',
        promptQuality: 'medium',
        mssPlausibility: 'medium',
        seedWorthiness: 'low',
        handcraftedAnchorMode: 'pattern_only',
      },
    })

    expect(check.pass).toBe(false)
    expect(check.hardFailures).toContain('search-policy-mismatch')
  })

  test('requires deep variant escalation to justify livecrawl', () => {
    const check = assessRegenerationCandidate({
      rawCard,
      variantId: 'base_1_search_followup_livecrawl',
      promptDraft: {
        id: 'bad-deep',
        input: 'Build a private school incident manager with parent-facing referral records and staff follow-up.',
        hint: 'Use a clear internal workflow and keep it bounded.',
      },
      research: {
        usedSearch: true,
        usedTargetedFollowUpSearch: false,
        usedLivecrawl: true,
        usedResearchLite: false,
        searchQuery: 'student behavior incident tracking software',
        followUpSearchQuery: '',
        livecrawlReason: '',
        searchSnippetCount: 3,
        followUpSnippetCount: 0,
        modernWorkflowVocabulary: ['incident tracking', 'student behavior'],
        moduleShapeRecoveredFromSearch: 'clear',
      },
      assessment: {
        modernRelevance: 'high',
        promptQuality: 'medium',
        mssPlausibility: 'medium',
        seedWorthiness: 'medium',
        handcraftedAnchorMode: 'pattern_only',
      },
    })

    expect(check.pass).toBe(false)
    expect(check.hardFailures).toContain('follow-up-search-not-conditional')
    expect(check.hardFailures).toContain('livecrawl-not-conditional')
  })
})
