#!/usr/bin/env bun

import { dirname } from 'node:path'
import * as z from 'zod'
import { loadJsonlRows, RetainedRawCardCorpusRowSchema } from './modnet-raw-card-base.ts'
import { resolveRepoPath } from './workspace-paths.ts'

export const RegenerationVariantIdSchema = z.enum(['base_1', 'base_1_search', 'base_1_search_followup_livecrawl'])

export const REGENERATION_VARIANT_LABELS: Record<z.infer<typeof RegenerationVariantIdSchema>, string> = {
  base_1: 'Base 1',
  base_1_search: 'Base 1 + Search',
  base_1_search_followup_livecrawl: 'Base 1 + Search -> targeted follow-up search + conditional livecrawl',
}

export const ConfidenceSchema = z.enum(['low', 'medium', 'high'])
export const ShapeRecoverySchema = z.enum(['unclear', 'partial', 'clear'])
export const HandcraftedAnchorModeSchema = z.enum(['pattern_only', 'light_lexical_overlap', 'copied'])
export const RegenerationGradeSchema = z.enum(['keep', 'revise', 'reject'])

export const RegeneratedPromptDraftSchema = z.object({
  id: z.string(),
  input: z.string(),
  hint: z.string(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export const RegenerationResearchTraceSchema = z.object({
  usedSearch: z.boolean(),
  usedTargetedFollowUpSearch: z.boolean(),
  usedLivecrawl: z.boolean(),
  usedResearchLite: z.boolean().default(false),
  searchQuery: z.string().default(''),
  followUpSearchQuery: z.string().default(''),
  livecrawlReason: z.string().default(''),
  searchSnippetCount: z.number().int().min(0),
  followUpSnippetCount: z.number().int().min(0),
  modernWorkflowVocabulary: z.array(z.string()),
  moduleShapeRecoveredFromSearch: ShapeRecoverySchema,
})

export const RegenerationAssessmentSignalsSchema = z.object({
  modernRelevance: ConfidenceSchema,
  promptQuality: ConfidenceSchema,
  mssPlausibility: ConfidenceSchema,
  seedWorthiness: ConfidenceSchema,
  handcraftedAnchorMode: HandcraftedAnchorModeSchema,
})

export const RegenerationVariantCandidateSchema = z.object({
  rawCard: RetainedRawCardCorpusRowSchema,
  variantId: RegenerationVariantIdSchema,
  promptDraft: RegeneratedPromptDraftSchema,
  research: RegenerationResearchTraceSchema,
  assessment: RegenerationAssessmentSignalsSchema,
})

export const RegenerationDimensionSummarySchema = z.object({
  grade: RegenerationGradeSchema,
  score: z.number().min(0).max(1),
  reasons: z.array(z.string()).min(1),
})

export const RegenerationDeterministicCheckSchema = z.object({
  pass: z.boolean(),
  hardFailures: z.array(z.string()),
  softWarnings: z.array(z.string()),
  checks: z.object({
    usesRetainedRawCard: z.boolean(),
    promptInputHasEnoughDetail: z.boolean(),
    promptHintHasEnoughDetail: z.boolean(),
    enrichedVariantsRequireSearch: z.boolean(),
    variantAvoidsResearchLite: z.boolean(),
    followUpSearchIsConditional: z.boolean(),
    livecrawlIsConditional: z.boolean(),
    recoveredModernVocabulary: z.boolean(),
    moduleShapeEscalatesWhenNeeded: z.boolean(),
    avoidsHandcraftedCopying: z.boolean(),
  }),
  score: z.number().min(0).max(1),
})

export const RegenerationVariantEvaluationSchema = z.object({
  candidate: RegenerationVariantCandidateSchema,
  deterministicCheck: RegenerationDeterministicCheckSchema,
  dimensionScores: z.object({
    modernRelevance: RegenerationDimensionSummarySchema,
    promptQuality: RegenerationDimensionSummarySchema,
    mssPlausibility: RegenerationDimensionSummarySchema,
    seedWorthiness: RegenerationDimensionSummarySchema,
  }),
  qualityScore: z.number().min(0).max(1),
  effectiveCost: z.number().positive(),
  reliable: z.boolean(),
  recommended: z.boolean(),
})

export const VariantComparisonSummarySchema = z.object({
  variantId: RegenerationVariantIdSchema,
  label: z.string(),
  totalRows: z.number().int().min(0),
  reliableRows: z.number().int().min(0),
  recommendedRows: z.number().int().min(0),
  reliabilityRate: z.number().min(0).max(1),
  recommendationRate: z.number().min(0).max(1),
  averageQualityScore: z.number().min(0).max(1),
  averageEffectiveCost: z.number().positive(),
  averageDimensionScores: z.object({
    modernRelevance: z.number().min(0).max(1),
    promptQuality: z.number().min(0).max(1),
    mssPlausibility: z.number().min(0).max(1),
    seedWorthiness: z.number().min(0).max(1),
  }),
  targetedFollowUpRate: z.number().min(0).max(1),
  livecrawlRate: z.number().min(0).max(1),
  eligible: z.boolean(),
  selectionScore: z.number(),
})

export const VariantComparisonOutputSchema = z.object({
  inputPath: z.string(),
  outputPath: z.string(),
  winner: z
    .object({
      variantId: RegenerationVariantIdSchema,
      label: z.string(),
      rationale: z.string(),
    })
    .nullable(),
  summaries: z.array(VariantComparisonSummarySchema),
})

export type RegenerationVariantCandidate = z.infer<typeof RegenerationVariantCandidateSchema>
export type RegenerationVariantEvaluation = z.infer<typeof RegenerationVariantEvaluationSchema>
export type VariantComparisonSummary = z.infer<typeof VariantComparisonSummarySchema>
export type RegenerationVariantId = z.infer<typeof RegenerationVariantIdSchema>
export type Confidence = z.infer<typeof ConfidenceSchema>

export const DEFAULT_RETAINED_RAW_CARD_PATH = resolveRepoPath(
  'dev-research',
  'modnet',
  'catalog',
  'modnet-retained-raw-card-corpus.jsonl',
)

export const DEFAULT_REGENERATION_CANDIDATES_PATH = resolveRepoPath(
  'tmp',
  'modnet-raw-card-regeneration-candidates.jsonl',
)

export const DEFAULT_REGENERATION_EVALS_PATH = resolveRepoPath('tmp', 'modnet-raw-card-regeneration-evals.jsonl')

export const DEFAULT_REGENERATION_COMPARE_PATH = resolveRepoPath('tmp', 'modnet-regeneration-variant-compare.json')

export const average = (values: number[]): number =>
  values.length === 0 ? 0 : Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(3))

export const normalizeWords = (value: string): string[] =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)

export const countNormalizedWords = (value: string): number => normalizeWords(value).length

export const confidenceToScore = (value: Confidence): number => {
  switch (value) {
    case 'high':
      return 1
    case 'medium':
      return 0.7
    case 'low':
      return 0.35
  }
}

export const gradeFromScore = (score: number): z.infer<typeof RegenerationGradeSchema> => {
  if (score >= 0.8) return 'keep'
  if (score >= 0.55) return 'revise'
  return 'reject'
}

export const computeEffectiveVariantCost = (candidate: RegenerationVariantCandidate): number => {
  const baseCost = candidate.variantId === 'base_1' ? 1 : candidate.variantId === 'base_1_search' ? 2 : 2.25
  const followUpCost = candidate.research.usedTargetedFollowUpSearch ? 0.55 : 0
  const livecrawlCost = candidate.research.usedLivecrawl ? 1.1 : 0
  return Number((baseCost + followUpCost + livecrawlCost).toFixed(3))
}

export const ensureParentDir = async (path: string) => {
  const outputDir = dirname(path)
  if (outputDir && outputDir !== '.') {
    await Bun.$`mkdir -p ${outputDir}`.quiet()
  }
}

export const loadRetainedRawCardRows = async () =>
  loadJsonlRows(DEFAULT_RETAINED_RAW_CARD_PATH, RetainedRawCardCorpusRowSchema)

export const loadRegenerationCandidates = async (path: string) =>
  loadJsonlRows(path, RegenerationVariantCandidateSchema)

export const loadRegenerationEvaluations = async (path: string) =>
  loadJsonlRows(path, RegenerationVariantEvaluationSchema)
