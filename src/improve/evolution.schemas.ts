import * as z from 'zod'

export const VariantStatusSchema = z.enum(['candidate', 'survived', 'promoted', 'rejected'])
export type VariantStatus = z.infer<typeof VariantStatusSchema>

export const VariantLineageSchema = z.object({
  parentIds: z.array(z.string()).default([]),
  mutation: z.string().optional(),
  generation: z.number().int().nonnegative().optional(),
})
export type VariantLineage = z.infer<typeof VariantLineageSchema>

export const VariantSchema = z.object({
  id: z.string(),
  packagePath: z.string().optional(),
  commit: z.string().optional(),
  lane: z.string().optional(),
  summary: z.string().optional(),
  status: VariantStatusSchema.default('candidate'),
  lineage: VariantLineageSchema.optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})
export type Variant = z.infer<typeof VariantSchema>

export const SelectionSignalsSchema = z.object({
  passRate: z.number().min(0).max(1).optional(),
  passAtK: z.number().min(0).max(1).optional(),
  passExpK: z.number().min(0).max(1).optional(),
  meanScore: z.number().min(0).max(1).optional(),
  bestScore: z.number().min(0).max(1).optional(),
  successfulTrials: z.number().int().nonnegative(),
  totalTrials: z.number().int().positive(),
  timedOutTrials: z.number().int().nonnegative(),
  nonZeroExitTrials: z.number().int().nonnegative(),
  toolErrorTrials: z.number().int().nonnegative(),
})
export type SelectionSignals = z.infer<typeof SelectionSignalsSchema>

export const PromotionCandidateSchema = z.object({
  variantId: z.string(),
  commit: z.string().optional(),
  signals: SelectionSignalsSchema,
  verificationPassed: z.boolean().optional(),
  verificationConfidence: z.number().min(0).max(1).optional(),
  judgeScore: z.number().min(0).max(1).optional(),
  reasoning: z.string().optional(),
})
export type PromotionCandidate = z.infer<typeof PromotionCandidateSchema>

export const PromotionDecisionSchema = z.object({
  action: z.enum(['promote_one', 'manual_review', 'reject_all']),
  selectedVariantId: z.string().optional(),
  selectedCommit: z.string().optional(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
})
export type PromotionDecision = z.infer<typeof PromotionDecisionSchema>

export const RetainedArtifactKindSchema = z.enum([
  'accepted-commit',
  'accepted-patch',
  'trajectory',
  'summary',
  'factory',
  'skill',
  'dataset-row',
  'adapter-config',
])
export type RetainedArtifactKind = z.infer<typeof RetainedArtifactKindSchema>

export const RetainedArtifactSchema = z.object({
  kind: RetainedArtifactKindSchema,
  variantId: z.string(),
  trialNum: z.number().int().positive().optional(),
  commit: z.string().optional(),
  path: z.string().optional(),
  summary: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})
export type RetainedArtifact = z.infer<typeof RetainedArtifactSchema>
