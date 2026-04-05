import * as z from 'zod'

export const CompareTrialsInputSchema = z.object({
  baselinePath: z.string().describe('Path to baseline TrialResult JSONL'),
  challengerPath: z.string().describe('Path to challenger TrialResult JSONL'),
  baselineLabel: z.string().optional().default('baseline'),
  challengerLabel: z.string().optional().default('challenger'),
  resamples: z.number().int().positive().optional().default(1000),
  confidence: z.number().min(0).max(1).optional().default(0.95),
})

export const RunMetricsSchema = z.object({
  label: z.string(),
  promptCount: z.number().int().nonnegative(),
  avgPassRate: z.number(),
  avgPassAtK: z.number(),
  avgPassExpK: z.number(),
  avgFlakiness: z.number(),
  avgDuration: z.number(),
  medianDuration: z.number(),
  passRateCI: z.tuple([z.number(), z.number()]),
  passAtKCI: z.tuple([z.number(), z.number()]),
})

export const PerPromptComparisonSchema = z.object({
  id: z.string(),
  baselinePassRate: z.number().nullable(),
  challengerPassRate: z.number().nullable(),
  baselinePassAtK: z.number().nullable(),
  challengerPassAtK: z.number().nullable(),
  winner: z.string().nullable(),
})

export const CompareTrialsOutputSchema = z.object({
  baseline: RunMetricsSchema,
  challenger: RunMetricsSchema,
  perPrompt: z.array(PerPromptComparisonSchema),
  summary: z.object({
    baselineWins: z.number().int().nonnegative(),
    challengerWins: z.number().int().nonnegative(),
    ties: z.number().int().nonnegative(),
    totalPrompts: z.number().int().nonnegative(),
  }),
})

/** @public */
export type CompareTrialsInput = z.infer<typeof CompareTrialsInputSchema>

/** @public */
export type CompareTrialsOutput = z.infer<typeof CompareTrialsOutputSchema>
