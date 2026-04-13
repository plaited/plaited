import * as z from 'zod'

export const AutoresearchModuleModeSchema = z.enum(['off', 'observe', 'candidate', 'promote'])

export const ImprovementTargetSchema = z.object({
  kind: z.enum(['skill', 'module', 'prompt-pack', 'search-policy', 'verification-policy']),
  id: z.string().min(1),
  path: z.string().optional(),
})

export const ImprovementJobSchema = z.object({
  id: z.string().min(1),
  target: ImprovementTargetSchema,
  reason: z.string().min(1),
  source: z.enum(['heartbeat', 'eval-failure', 'verification-failure', 'user-request']),
  createdAt: z.number(),
  evidenceRefs: z.array(z.string()),
})

export const ActiveAutoresearchRunSchema = z.object({
  id: z.string().min(1),
  jobId: z.string().min(1),
  target: ImprovementTargetSchema,
  startedAt: z.number(),
  phase: z.enum(['baseline', 'cluster', 'propose', 'validate', 'judge', 'promote']),
})

export const PromotionDecisionSchema = z.object({
  runId: z.string().min(1),
  candidateId: z.string().min(1).optional(),
  target: ImprovementTargetSchema,
  decision: z.enum(['accepted', 'rejected', 'deferred', 'reverted']),
  reasoning: z.string().min(1),
  delta: z
    .object({
      passRate: z.number().optional(),
      passAtK: z.number().optional(),
      score: z.number().optional(),
    })
    .optional(),
  createdAt: z.number(),
})

export const AutoresearchModulePolicySchema = z.object({
  mode: AutoresearchModuleModeSchema,
  maxConcurrentRuns: z.number().int().positive(),
  cooldownMs: z.number().int().nonnegative(),
  minimumFailureCount: z.number().int().positive(),
  minimumEvalDelta: z.number().nonnegative(),
  allowTargets: z.array(ImprovementTargetSchema.shape.kind),
  allowAutoActivate: z.boolean(),
})
