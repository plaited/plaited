import { describe, expect, test } from 'bun:test'
import { chooseWinningVariant } from '../modnet-raw-card-regeneration-compare.ts'

describe('modnet-raw-card-regeneration-compare', () => {
  test('prefers stronger module-shape and prompt-quality winners inside the quality band', () => {
    const winner = chooseWinningVariant([
      {
        variantId: 'base_1',
        label: 'Base 1',
        totalRows: 3,
        reliableRows: 2,
        recommendedRows: 2,
        reliabilityRate: 0.667,
        recommendationRate: 0.667,
        averageQualityScore: 0.8,
        averageEffectiveCost: 1,
        averageDimensionScores: {
          modernRelevance: 0.8,
          promptQuality: 0.78,
          mssPlausibility: 0.81,
          seedWorthiness: 0.79,
        },
        targetedFollowUpRate: 0,
        livecrawlRate: 0,
        eligible: true,
        selectionScore: 0.74,
      },
      {
        variantId: 'base_1_search',
        label: 'Base 1 + Search',
        totalRows: 3,
        reliableRows: 3,
        recommendedRows: 3,
        reliabilityRate: 1,
        recommendationRate: 1,
        averageQualityScore: 0.83,
        averageEffectiveCost: 2,
        averageDimensionScores: {
          modernRelevance: 0.85,
          promptQuality: 0.82,
          mssPlausibility: 0.83,
          seedWorthiness: 0.82,
        },
        targetedFollowUpRate: 0,
        livecrawlRate: 0,
        eligible: true,
        selectionScore: 0.81,
      },
      {
        variantId: 'base_1_search_followup_livecrawl',
        label: 'Base 1 + Search -> targeted follow-up search + conditional livecrawl',
        totalRows: 3,
        reliableRows: 3,
        recommendedRows: 3,
        reliabilityRate: 1,
        recommendationRate: 1,
        averageQualityScore: 0.86,
        averageEffectiveCost: 3.1,
        averageDimensionScores: {
          modernRelevance: 0.88,
          promptQuality: 0.84,
          mssPlausibility: 0.86,
          seedWorthiness: 0.86,
        },
        targetedFollowUpRate: 0.67,
        livecrawlRate: 0.33,
        eligible: true,
        selectionScore: 0.8,
      },
    ])

    expect(winner?.variantId).toBe('base_1_search_followup_livecrawl')
  })
})
