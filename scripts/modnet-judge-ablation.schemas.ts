import * as z from 'zod'
import { GraderResultSchema } from '../src/improve.ts'

export const HeldoutTaskKindSchema = z.enum([
  'raw-card-inclusion',
  'regenerated-prompt-seed-review',
  'derived-prompt-review',
])

export const HeldoutExpectationSchema = z.object({
  recommended: z.boolean(),
  rationale: z.string(),
})

export const HeldoutRowSchema = z.object({
  id: z.string(),
  taskKind: HeldoutTaskKindSchema,
  task: z.string(),
  candidateOutput: z.string(),
  metadata: z.record(z.string(), z.unknown()).default({}),
  expectation: HeldoutExpectationSchema.optional(),
})

export const JudgeModelLabelSchema = z.enum([
  'minimax-m2.7',
  'minimax-m2.5',
  'glm-5',
  'glm-5-turbo',
  'kimi-k2.5',
  'deepseek-v3.2',
  'nemotron-3-super-120b-a12b',
  'mistral-small-2603',
  'qwen3-coder-prefilter',
])

export const JudgePairSchema = z.object({
  primaryJudge: JudgeModelLabelSchema,
  metaVerifier: JudgeModelLabelSchema,
})

export const AblationSpendSchema = z.object({
  judge: z.number().min(0),
  meta: z.number().min(0),
  total: z.number().min(0),
})

export const ModnetJudgeAblationRowSchema = z.object({
  heldout: HeldoutRowSchema,
  label: z.string(),
  pair: JudgePairSchema,
  judgeResult: GraderResultSchema,
  metaResult: GraderResultSchema.optional(),
  recommended: z.boolean(),
  runtimeMs: z.number().int().min(0).optional(),
  spendUsd: AblationSpendSchema.default({
    judge: 0,
    meta: 0,
    total: 0,
  }),
})

export const ModnetJudgeAblationSummarySchema = z.object({
  label: z.string(),
  pair: JudgePairSchema,
  totalRows: z.number().int().min(0),
  recommendedRows: z.number().int().min(0),
  judgePassRows: z.number().int().min(0),
  metaPassRows: z.number().int().min(0),
  recommendationRate: z.number().min(0).max(1),
  judgePassRate: z.number().min(0).max(1),
  metaPassRate: z.number().min(0).max(1),
  averageJudgeScore: z.number().min(0).max(1),
  averageMetaScore: z.number().min(0).max(1),
  totalSpendUsd: z.number().min(0),
  averageSpendUsd: z.number().min(0),
  agreementWithExpectationRate: z.number().min(0).max(1).nullable(),
})

export const ModnetJudgeAblationReportSchema = z.object({
  inputPath: z.string(),
  outputPath: z.string(),
  generatedAt: z.string(),
  totalRows: z.number().int().min(0),
  summaries: z.array(ModnetJudgeAblationSummarySchema),
})

export type HeldoutRow = z.infer<typeof HeldoutRowSchema>
export type ModnetJudgeAblationRow = z.infer<typeof ModnetJudgeAblationRowSchema>
export type ModnetJudgeAblationSummary = z.infer<typeof ModnetJudgeAblationSummarySchema>
