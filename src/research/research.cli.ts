import * as z from 'zod'
import { makeCli } from '../cli/utils/cli.ts'
import { compareResearchRuns, selectPromotionDecision } from './research.comparison.utils.ts'
import { ResearchPromotionDecisionSchema, ResearchRunComparisonSchema, ResearchRunSchema } from './research.schema.ts'

export const ResearchCliInputSchema = z
  .object({
    baseline: ResearchRunSchema.describe('Baseline research run bundle.'),
    challenger: ResearchRunSchema.describe('Challenger research run bundle.'),
    confidence: z
      .number()
      .gt(0)
      .lt(1)
      .optional()
      .default(0.95)
      .describe('Confidence level for bootstrap interval estimation.'),
    resamples: z
      .number()
      .int()
      .positive()
      .optional()
      .default(1000)
      .describe('Bootstrap resample count used to estimate confidence intervals.'),
    minPassRateDelta: z
      .number()
      .optional()
      .default(0)
      .describe('Minimum challenger pass-rate delta required for promotion.'),
    minWinDelta: z
      .number()
      .int()
      .optional()
      .default(1)
      .describe('Minimum prompt-level win delta required for promotion.'),
  })
  .describe('Input contract for post-run research comparison and promotion selection.')

export type ResearchCliInput = z.output<typeof ResearchCliInputSchema>

export const ResearchCliOutputSchema = z
  .object({
    comparison: ResearchRunComparisonSchema.describe('Head-to-head research run comparison output.'),
    decision: ResearchPromotionDecisionSchema.describe('Promotion decision derived from comparison evidence.'),
  })
  .describe('Output contract for the research comparison command.')

export type ResearchCliOutput = z.output<typeof ResearchCliOutputSchema>

export const runResearchCli = async (input: ResearchCliInput): Promise<ResearchCliOutput> => {
  const comparison = compareResearchRuns({
    baseline: input.baseline,
    challenger: input.challenger,
    confidence: input.confidence,
    resamples: input.resamples,
  })

  const decision = selectPromotionDecision({
    comparison,
    minPassRateDelta: input.minPassRateDelta,
    minWinDelta: input.minWinDelta,
  })

  return {
    comparison,
    decision,
  }
}

export const researchCli = makeCli({
  name: 'research',
  inputSchema: ResearchCliInputSchema,
  outputSchema: ResearchCliOutputSchema,
  run: runResearchCli,
})
