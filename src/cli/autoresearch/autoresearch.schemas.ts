import * as z from 'zod'

export const AutoresearchTargetKindSchema = z.enum(['skill', 'factory', 'prompt-pack'])

export const AutoresearchTargetRefSchema = z.object({
  kind: AutoresearchTargetKindSchema,
  id: z.string().min(1),
  path: z.string().optional(),
})

export const AutoresearchBudgetSchema = z.object({
  maxCandidates: z.number().int().positive().optional(),
  maxAttemptsPerCandidate: z.number().int().positive().optional(),
  concurrency: z.number().int().positive().optional(),
})

export const AutoresearchPromotionModeSchema = z.enum(['none', 'candidate-only', 'activate-overlay'])

export const AutoresearchPromotionSchema = z.object({
  mode: AutoresearchPromotionModeSchema.optional(),
})

export const CandidateProposalSchema = z.object({
  id: z.string().min(1),
  summary: z.string().min(1),
  artifactPath: z.string().min(1),
})

export const CandidateValidationSchema = z.object({
  pass: z.boolean(),
  reasoning: z.string().min(1),
})

export const AutoresearchCandidateResultSchema = CandidateProposalSchema.extend({
  validation: z.enum(['passed', 'failed']),
  delta: z
    .object({
      passRate: z.number().min(0).max(1).optional(),
      passAtK: z.number().min(0).max(1).optional(),
      passExpK: z.number().min(0).max(1).optional(),
    })
    .optional(),
})

export const AutoresearchInputSchema = z.object({
  target: AutoresearchTargetRefSchema,
  adapterPath: z.string().describe('Path to adapter script (.ts/.js module or executable)'),
  promptsPath: z.string().optional().describe('Path to prompts.jsonl'),
  graderPath: z.string().optional().describe('Path to grader script'),
  workspaceDir: z.string().optional().describe('Per-prompt workspace isolation base dir'),
  outputDir: z.string().optional().describe('Directory for autoresearch run artifacts'),
  baselineResultsPath: z.string().optional().describe('Optional existing baseline results JSONL'),
  evidencePaths: z.array(z.string()).optional().describe('Optional evidence paths for observation collection'),
  budget: AutoresearchBudgetSchema.optional(),
  promotion: AutoresearchPromotionSchema.optional(),
  progress: z.boolean().optional().default(false),
})

export const AutoresearchOutputSchema = z.object({
  runId: z.string().min(1),
  target: AutoresearchTargetRefSchema,
  baselineSummary: z.object({
    passRate: z.number().min(0).max(1).optional(),
    passAtK: z.number().min(0).max(1).optional(),
    passExpK: z.number().min(0).max(1).optional(),
  }),
  candidates: z.array(AutoresearchCandidateResultSchema),
  promotion: z.object({
    decision: z.enum(['accepted', 'rejected', 'deferred']),
    candidateId: z.string().optional(),
    reasoning: z.string().min(1),
  }),
})

/** @public */
export type AutoresearchInput = z.infer<typeof AutoresearchInputSchema>

/** @public */
export type AutoresearchOutputSchemaType = z.infer<typeof AutoresearchOutputSchema>
