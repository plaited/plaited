import * as z from 'zod'

export const CompareTrialsInputSchema = z
  .object({
    baselinePath: z.string().describe('Path to baseline TrialResult JSONL'),
    challengerPath: z.string().describe('Path to challenger TrialResult JSONL'),
    baselineLabel: z.string().optional().default('baseline').describe('Display label used for baseline metrics.'),
    challengerLabel: z.string().optional().default('challenger').describe('Display label used for challenger metrics.'),
    resamples: z
      .number()
      .int()
      .positive()
      .optional()
      .default(1000)
      .describe('Bootstrap resample count used to estimate confidence intervals.'),
    confidence: z
      .number()
      .min(0)
      .max(1)
      .optional()
      .default(0.95)
      .describe('Confidence level used for interval estimation (for example 0.95).'),
  })
  .describe('Input for `compare-trials`.')

export const RunMetricsSchema = z
  .object({
    label: z.string().describe('Run label shown in reports and summary output.'),
    promptCount: z.number().int().nonnegative().describe('Number of prompt IDs compared in this run.'),
    avgPassRate: z.number().describe('Mean pass rate across prompts.'),
    avgPassAtK: z.number().describe('Mean pass@k across prompts.'),
    avgPassExpK: z.number().describe('Mean pass^k across prompts.'),
    avgFlakiness: z.number().describe('Average flakiness derived from per-prompt trial variance.'),
    avgDuration: z.number().describe('Average trial duration in milliseconds.'),
    medianDuration: z.number().describe('Median trial duration in milliseconds.'),
    passRateCI: z.tuple([z.number(), z.number()]).describe('Confidence interval for average pass rate [low, high].'),
    passAtKCI: z.tuple([z.number(), z.number()]).describe('Confidence interval for average pass@k [low, high].'),
  })
  .describe('Aggregate metrics for one evaluated run.')

export const PerPromptComparisonSchema = z
  .object({
    id: z.string().describe('Prompt identifier shared between baseline and challenger rows.'),
    baselinePassRate: z.number().nullable().describe('Baseline pass rate for this prompt, or null when unavailable.'),
    challengerPassRate: z
      .number()
      .nullable()
      .describe('Challenger pass rate for this prompt, or null when unavailable.'),
    baselinePassAtK: z.number().nullable().describe('Baseline pass@k for this prompt, or null when unavailable.'),
    challengerPassAtK: z.number().nullable().describe('Challenger pass@k for this prompt, or null when unavailable.'),
    winner: z
      .string()
      .nullable()
      .describe('Per-prompt winner label (`baseline`/`challenger`) or null for tie/insufficient data.'),
  })
  .describe('Head-to-head comparison row for a single prompt ID.')

export const CompareTrialsOutputSchema = z
  .object({
    baseline: RunMetricsSchema.describe('Aggregate metrics for the baseline run.'),
    challenger: RunMetricsSchema.describe('Aggregate metrics for the challenger run.'),
    perPrompt: z.array(PerPromptComparisonSchema).describe('Per-prompt head-to-head comparison rows.'),
    summary: z
      .object({
        baselineWins: z.number().int().nonnegative().describe('Count of prompts won by the baseline run.'),
        challengerWins: z.number().int().nonnegative().describe('Count of prompts won by the challenger run.'),
        ties: z.number().int().nonnegative().describe('Count of prompts with tied outcome.'),
        totalPrompts: z.number().int().nonnegative().describe('Total prompt IDs considered in the comparison.'),
      })
      .describe('Top-level outcome counts for the run comparison.'),
  })
  .describe('Output for `compare-trials`.')

/** @public */
export type CompareTrialsInput = z.infer<typeof CompareTrialsInputSchema>

/** @public */
export type CompareTrialsOutput = z.infer<typeof CompareTrialsOutputSchema>
