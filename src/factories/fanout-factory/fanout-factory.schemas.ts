import * as z from 'zod'

export const FanoutStrategySchema = z.enum(['parallel_validation', 'repair_compare', 'exploration'])
export type FanoutStrategy = z.infer<typeof FanoutStrategySchema>

export const FanoutAttemptStatusSchema = z.enum([
  'pending',
  'running',
  'validated',
  'failed',
  'blocked',
  'discarded',
  'promoted',
  'merged',
])
export type FanoutAttemptStatus = z.infer<typeof FanoutAttemptStatusSchema>

export const FanoutAttemptSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  workspace: z.string().min(1),
  statusArtifactPath: z.string().min(1),
  diffSummary: z.string().optional(),
  validationSummary: z.string().optional(),
  status: FanoutAttemptStatusSchema,
})
export type FanoutAttempt = z.infer<typeof FanoutAttemptSchema>

export const FanoutRecommendationSchema = z.object({
  recommendedCount: z.number().int().min(1).max(4),
  reason: z.string().min(1),
})
export type FanoutRecommendation = z.infer<typeof FanoutRecommendationSchema>

export const FanoutDispositionSchema = z.enum(['promote', 'merge', 'discard_others'])
export type FanoutDisposition = z.infer<typeof FanoutDispositionSchema>

export const FanoutWinnerSchema = z.object({
  attemptId: z.string().min(1),
  disposition: FanoutDispositionSchema,
  rationale: z.string().min(1),
  selectedAt: z.number().int().nonnegative(),
})
export type FanoutWinner = z.infer<typeof FanoutWinnerSchema>

export const FanoutStateSchema = z.object({
  goal: z.string().min(1).optional(),
  strategy: FanoutStrategySchema.optional(),
  attempts: z.array(FanoutAttemptSchema),
  recommendation: FanoutRecommendationSchema.optional(),
  winner: FanoutWinnerSchema.nullable(),
})
export type FanoutState = z.infer<typeof FanoutStateSchema>

export const StartFanoutDetailSchema = z.object({
  goal: z.string().min(1),
  count: z.number().int().min(2).max(4),
  strategy: FanoutStrategySchema.default('parallel_validation'),
})
export type StartFanoutDetail = z.infer<typeof StartFanoutDetailSchema>

export const UpdateFanoutAttemptDetailSchema = z.object({
  attemptId: z.string().min(1),
  status: FanoutAttemptStatusSchema,
  diffSummary: z.string().min(1).optional(),
  validationSummary: z.string().min(1).optional(),
})
export type UpdateFanoutAttemptDetail = z.infer<typeof UpdateFanoutAttemptDetailSchema>

export const SelectFanoutWinnerDetailSchema = z.object({
  attemptId: z.string().min(1),
  disposition: FanoutDispositionSchema,
  rationale: z.string().min(1),
})
export type SelectFanoutWinnerDetail = z.infer<typeof SelectFanoutWinnerDetailSchema>
