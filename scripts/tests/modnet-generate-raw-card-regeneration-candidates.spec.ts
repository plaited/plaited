import { describe, expect, test } from 'bun:test'
import {
  buildPromptDraft,
  createBaseVariantCandidate,
  recoverModuleShape,
} from '../modnet-generate-raw-card-regeneration-candidates.ts'

const row = {
  id: 'hypercard_school-discipline',
  title: 'School Discipline',
  description: 'Track referrals for student behavior incidents and parent conferences.',
  inclusionDecision: 'retain' as const,
  modernAnalog: 'student behavior referral and incident tracking module for schools',
  coreUserJob: 'record, manage, customize, and print student discipline referrals for follow-up and parent conferences',
  whyRelevant: 'This is a durable education admin records workflow.',
  likelyPatternFamily: 'education admin records and incident workflow',
  likelyStructure: 'form',
  searchQuerySeed: 'student discipline referral tracking parent conference incident record workflow',
}

describe('modnet-generate-raw-card-regeneration-candidates', () => {
  test('creates a base variant without search enrichment', () => {
    const candidate = createBaseVariantCandidate(row)

    expect(candidate.variantId).toBe('base_1')
    expect(candidate.research.usedSearch).toBe(false)
    expect(candidate.research.usedResearchLite).toBe(false)
    expect(candidate.promptDraft.input).toContain('student behavior referral')
  })

  test('recovers a clear module shape from structured workflow snippets', () => {
    const shape = recoverModuleShape({
      rawCard: row,
      snippets: [
        'Incident referral form with follow-up workflow and student records.',
        'Printable conference report with status tracking and behavior history.',
      ],
    })

    expect(shape).toBe('clear')
  })

  test('builds enriched prompts with workflow vocabulary instead of handcrafted copying', () => {
    const draft = buildPromptDraft({
      row,
      variantId: 'base_1_search',
      vocab: ['incident', 'referral', 'conference', 'tracking'],
      structureCue: 'collection',
    })

    expect(draft.input).toContain('collection workflow')
    expect(draft.hint).toContain('current workflow vocabulary')
    expect(draft.id).toBe('hypercard_school-discipline-base_1_search')
  })
})
