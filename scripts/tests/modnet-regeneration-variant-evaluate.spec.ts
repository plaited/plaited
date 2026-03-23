import { describe, expect, test } from 'bun:test'
import { chooseWinningVariant } from '../modnet-raw-card-regeneration-compare.ts'
import { evaluateRegenerationCandidate } from '../modnet-raw-card-regeneration-evaluate.ts'

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

describe('modnet-regeneration-variant-evaluate', () => {
  test('supports end-to-end winner selection for the three slice variants', () => {
    const evaluations = [
      evaluateRegenerationCandidate({
        rawCard,
        variantId: 'base_1',
        promptDraft: {
          id: 'base',
          input: 'Build a private discipline tracking module for school staff to log behavior incidents and follow-up.',
          hint: 'Keep it internal and bounded.',
        },
        research: {
          usedSearch: false,
          usedTargetedFollowUpSearch: false,
          usedLivecrawl: false,
          usedResearchLite: false,
          searchQuery: '',
          followUpSearchQuery: '',
          livecrawlReason: '',
          searchSnippetCount: 0,
          followUpSnippetCount: 0,
          modernWorkflowVocabulary: [],
          moduleShapeRecoveredFromSearch: 'unclear',
        },
        assessment: {
          modernRelevance: 'medium',
          promptQuality: 'medium',
          mssPlausibility: 'medium',
          seedWorthiness: 'medium',
          handcraftedAnchorMode: 'pattern_only',
        },
      }),
      evaluateRegenerationCandidate({
        rawCard,
        variantId: 'base_1_search',
        promptDraft: {
          id: 'search',
          input:
            'Build a private school discipline referral tracker for staff to log incidents and parent conference notes.',
          hint: 'Use an internal workflow with incident records and follow-up actions.',
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
      }),
      evaluateRegenerationCandidate({
        rawCard,
        variantId: 'base_1_search_followup_livecrawl',
        promptDraft: {
          id: 'deep',
          input:
            'Build a private school incident workflow that tracks referrals, staff actions, and parent conference preparation.',
          hint: 'Escalate retrieval only when search leaves the module shape underspecified.',
        },
        research: {
          usedSearch: true,
          usedTargetedFollowUpSearch: true,
          usedLivecrawl: true,
          usedResearchLite: false,
          searchQuery: 'student behavior incident tracking software',
          followUpSearchQuery: 'school discipline tracker parent notification incident history',
          livecrawlReason: 'initial and follow-up search still left the module shape unclear',
          searchSnippetCount: 3,
          followUpSnippetCount: 2,
          modernWorkflowVocabulary: ['incident tracking', 'discipline history', 'parent notification'],
          moduleShapeRecoveredFromSearch: 'partial',
        },
        assessment: {
          modernRelevance: 'high',
          promptQuality: 'medium',
          mssPlausibility: 'high',
          seedWorthiness: 'medium',
          handcraftedAnchorMode: 'pattern_only',
        },
      }),
    ]

    const average = (values: number[]) =>
      values.length === 0 ? 0 : Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(3))

    const summaries = ['base_1', 'base_1_search', 'base_1_search_followup_livecrawl'].map((variantId) => {
      const rows = evaluations.filter((row) => row.candidate.variantId === variantId)
      return {
        variantId: variantId as 'base_1' | 'base_1_search' | 'base_1_search_followup_livecrawl',
        label: variantId,
        totalRows: rows.length,
        reliableRows: rows.filter((row) => row.reliable).length,
        recommendedRows: rows.filter((row) => row.recommended).length,
        reliabilityRate: average(rows.map((row) => (row.reliable ? 1 : 0))),
        recommendationRate: average(rows.map((row) => (row.recommended ? 1 : 0))),
        averageQualityScore: average(rows.map((row) => row.qualityScore)),
        averageEffectiveCost: average(rows.map((row) => row.effectiveCost)) || 1,
        averageDimensionScores: {
          modernRelevance: average(rows.map((row) => row.dimensionScores.modernRelevance.score)),
          promptQuality: average(rows.map((row) => row.dimensionScores.promptQuality.score)),
          mssPlausibility: average(rows.map((row) => row.dimensionScores.mssPlausibility.score)),
          seedWorthiness: average(rows.map((row) => row.dimensionScores.seedWorthiness.score)),
        },
        targetedFollowUpRate: average(rows.map((row) => (row.candidate.research.usedTargetedFollowUpSearch ? 1 : 0))),
        livecrawlRate: average(rows.map((row) => (row.candidate.research.usedLivecrawl ? 1 : 0))),
        eligible: rows.every((row) => row.reliable),
        selectionScore: average(rows.map((row) => row.qualityScore)),
      }
    })

    expect(chooseWinningVariant(summaries)?.variantId).toBe('base_1_search')
  })
})
