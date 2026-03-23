import { describe, expect, test } from 'bun:test'
import { assessInclusionCandidate } from '../modnet-raw-card-inclusion-evaluate.ts'

describe('modnet-raw-card-inclusion-evaluate', () => {
  test('passes a grounded retained candidate', () => {
    const check = assessInclusionCandidate({
      candidate: {
        id: 'hypercard_school-discipline',
        title: 'School Discipline',
        description:
          'Track school discipline referrals, parent conference notes, and follow-up incident actions for students.',
        inclusionDecision: 'retain',
        modernAnalog: 'A private student incident and discipline referral tracker for a school office.',
        coreUserJob: 'Track incidents, referrals, and parent-facing records for student behavior workflows.',
        whyRelevant: 'The durable workflow is incident/referral tracking, not HyperCard-era implementation.',
        likelyPatternFamily: 'business-process',
        likelyStructure: 'form',
        searchQuerySeed: 'school discipline referral tracking software student behavior incident',
      },
      rawCard: {
        id: 'hypercard_school-discipline',
        title: 'School Discipline',
        description:
          'Track school discipline referrals, parent conference notes, and follow-up incident actions for students.',
      },
      seenIds: new Set<string>(),
    })

    expect(check.pass).toBe(true)
    expect(check.softWarnings).toEqual([])
  })

  test('flags generic analogs and missing search seeds', () => {
    const check = assessInclusionCandidate({
      candidate: {
        id: 'fax-router',
        title: 'Fax Router',
        description: 'Routes incoming faxes to staff and logs status for follow-up.',
        inclusionDecision: 'retain_low_priority',
        modernAnalog: 'A private organizer on my phone that keeps everything in one place.',
        coreUserJob: 'Organize things.',
        whyRelevant: 'It is useful.',
        likelyPatternFamily: 'business-process',
        likelyStructure: 'form',
        searchQuerySeed: '',
      },
      rawCard: {
        id: 'fax-router',
        title: 'Fax Router',
        description: 'Routes incoming faxes to staff and logs status for follow-up.',
      },
      seenIds: new Set<string>(),
    })

    expect(check.pass).toBe(false)
    expect(check.hardFailures).toContain('missing-search-query-seed')
    expect(check.softWarnings).toContain('generic-modern-analog')
  })
})
