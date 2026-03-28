import * as z from 'zod'
import { TrajectoryStepSchema } from '../agent/agent.schemas.ts'
import { GraderResultSchema, PromptCaseSchema, TimingSchema } from './trial.schemas.ts'

export const EvaluationTargetSchema = z.enum(['workspace-improvement', 'trial-result'])
export type EvaluationTarget = z.infer<typeof EvaluationTargetSchema>

export const RetainedOutputSuitabilityLabelSchema = z.enum([
  'framework-improvement',
  'native-model-distillation',
  'ui-module-generation-corpus',
  'constitution-governance-corpus',
])
export type RetainedOutputSuitabilityLabel = z.infer<typeof RetainedOutputSuitabilityLabelSchema>

export const RetainedOutputSuitabilitySchema = z.object({
  suitable: z.array(RetainedOutputSuitabilityLabelSchema),
  unsuitable: z.array(RetainedOutputSuitabilityLabelSchema).default([]),
  notes: z.string().optional(),
})
export type RetainedOutputSuitability = z.infer<typeof RetainedOutputSuitabilitySchema>

const WorkspaceJudgeChecksSchema = z.record(z.string(), z.unknown())
const WorkspaceContextFileSchema = z.object({
  path: z.string(),
  content: z.string(),
})
export type WorkspaceContextFile = z.infer<typeof WorkspaceContextFileSchema>

const WorkspaceSkillSummarySchema = z.object({
  path: z.string(),
  description: z.string(),
})
export type WorkspaceSkillSummary = z.infer<typeof WorkspaceSkillSummarySchema>

export const WorkspaceImprovementJudgeInputSchema = z.object({
  evaluationTarget: z.literal('workspace-improvement'),
  task: z.string(),
  candidateOutput: z.string(),
  changedFiles: z.array(z.string()),
  diffStat: z.string(),
  patch: z.string(),
  checks: WorkspaceJudgeChecksSchema,
  program: z.string(),
  programText: z.string().optional(),
  slice: z.string(),
  contextFiles: z.array(WorkspaceContextFileSchema).optional(),
  skillCatalog: z.array(WorkspaceSkillSummarySchema).optional(),
})
export type WorkspaceImprovementJudgeInput = z.infer<typeof WorkspaceImprovementJudgeInputSchema>

export const WorkspaceImprovementJudgeRubricSchema = z.object({
  architecture: z.number().min(0).max(1),
  boundedness: z.number().min(0).max(1),
  focus: z.number().min(0).max(1),
  quality: z.number().min(0).max(1),
})
export type WorkspaceImprovementJudgeRubric = z.infer<typeof WorkspaceImprovementJudgeRubricSchema>

export const WorkspaceImprovementJudgeOutcomeSchema = z.object({
  evaluationTarget: z.literal('workspace-improvement'),
  judgeKind: z.literal('workspace-improvement'),
  rubric: WorkspaceImprovementJudgeRubricSchema.optional(),
  judgeSdk: z.record(z.string(), z.unknown()).optional(),
})
export type WorkspaceImprovementJudgeOutcome = z.infer<typeof WorkspaceImprovementJudgeOutcomeSchema>

export const WorkspaceImprovementMetaVerifierRubricSchema = z.object({
  consistency: z.number().min(0).max(1),
  risk: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
})
export type WorkspaceImprovementMetaVerifierRubric = z.infer<typeof WorkspaceImprovementMetaVerifierRubricSchema>

export const WorkspaceImprovementMetaVerifierOutcomeSchema = z.object({
  evaluationTarget: z.literal('workspace-improvement'),
  judgeKind: z.literal('workspace-improvement-meta-verifier'),
  rubric: WorkspaceImprovementMetaVerifierRubricSchema.optional(),
  metaVerificationSdk: z.record(z.string(), z.unknown()).optional(),
})
export type WorkspaceImprovementMetaVerifierOutcome = z.infer<typeof WorkspaceImprovementMetaVerifierOutcomeSchema>

export const TrialJudgeInputSchema = z.object({
  evaluationTarget: z.literal('trial-result'),
  prompt: PromptCaseSchema,
  trial: z.object({
    trialNum: z.number().int().positive(),
    output: z.string(),
    duration: z.number().nonnegative(),
    trajectory: z.array(TrajectoryStepSchema).optional(),
    timing: TimingSchema.optional(),
    exitCode: z.number().nullable().optional(),
    timedOut: z.boolean().optional(),
  }),
})
export type TrialJudgeInput = z.infer<typeof TrialJudgeInputSchema>

export const TrialJudgeOutcomeSchema = z.object({
  evaluationTarget: z.literal('trial-result'),
  judgeKind: z.literal('trial-result'),
  retainedOutput: RetainedOutputSuitabilitySchema.optional(),
})
export type TrialJudgeOutcome = z.infer<typeof TrialJudgeOutcomeSchema>

export const TrialJudgeResultSchema = GraderResultSchema.extend({
  outcome: TrialJudgeOutcomeSchema.optional(),
})
export type TrialJudgeResult = z.infer<typeof TrialJudgeResultSchema>

export const TrialMetaVerifierTrustLabelSchema = z.enum(['trusted', 'needs-review', 'not-trusted'])
export type TrialMetaVerifierTrustLabel = z.infer<typeof TrialMetaVerifierTrustLabelSchema>

export const TrialMetaVerifierInputSchema = z.object({
  evaluationTarget: z.literal('trial-result'),
  judgeInput: TrialJudgeInputSchema,
  judgeResult: TrialJudgeResultSchema,
})
export type TrialMetaVerifierInput = z.infer<typeof TrialMetaVerifierInputSchema>

export const TrialMetaVerifierOutcomeSchema = z.object({
  evaluationTarget: z.literal('trial-result'),
  verifierKind: z.literal('trial-meta-verifier'),
  trustLabel: TrialMetaVerifierTrustLabelSchema,
  retainedOutput: RetainedOutputSuitabilitySchema.optional(),
})
export type TrialMetaVerifierOutcome = z.infer<typeof TrialMetaVerifierOutcomeSchema>
