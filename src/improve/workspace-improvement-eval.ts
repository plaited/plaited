import * as z from 'zod'
import {
  type WorkspaceImprovementJudgeInput,
  WorkspaceImprovementJudgeInputSchema,
  type WorkspaceImprovementJudgeOutcome,
  WorkspaceImprovementJudgeOutcomeSchema,
} from './judge-contracts.ts'
import type { GraderResult } from './trial.schemas.ts'

export const WorkspaceImprovementJudgeResponseSchema = z.object({
  pass: z.boolean(),
  score: z.number().min(0).max(1),
  reasoning: z.string(),
  dimensions: z
    .object({
      outcome: z.number().min(0).max(1).optional(),
      process: z.number().min(0).max(1).optional(),
      efficiency: z.number().min(0).max(1).optional(),
    })
    .optional(),
  outcome: WorkspaceImprovementJudgeOutcomeSchema.optional(),
})

export type WorkspaceImprovementJudgeResponse = z.infer<typeof WorkspaceImprovementJudgeResponseSchema>

export const WorkspaceImprovementMetaVerifierResponseSchema = z.object({
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
})

export type WorkspaceImprovementMetaVerifierResponse = z.infer<typeof WorkspaceImprovementMetaVerifierResponseSchema>

export const WorkspaceImprovementPromotionDecisionSchema = z.object({
  action: z.enum(['promote_one', 'manual_review', 'reject_all']),
  selectedAttempt: z.number().int().positive().optional(),
  selectedCommit: z.string().optional(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
})

export type WorkspaceImprovementPromotionDecision = z.infer<typeof WorkspaceImprovementPromotionDecisionSchema>

export const buildWorkspaceImprovementJudgeInput = ({
  task,
  candidateOutput,
  changedFiles,
  diffStat,
  patch,
  checks,
  program,
  programText,
  slice,
  contextFiles,
  skillCatalog,
}: WorkspaceImprovementJudgeInput): WorkspaceImprovementJudgeInput =>
  WorkspaceImprovementJudgeInputSchema.parse({
    evaluationTarget: 'workspace-improvement',
    task,
    candidateOutput,
    changedFiles,
    diffStat,
    patch,
    checks,
    program,
    programText,
    slice,
    contextFiles,
    skillCatalog,
  })

const formatChecks = (checks: Record<string, unknown>) =>
  Object.entries(checks)
    .map(([key, value]) => `- ${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`)
    .join('\n')

export const buildWorkspaceImprovementJudgePrompt = ({
  input,
  criteria,
}: {
  input: WorkspaceImprovementJudgeInput
  criteria: string
}) => `Evaluate this workspace-improvement attempt.

Your primary job is to find problems, missing evidence, regressions, or scope drift.
Do not approve eagerly. Return pass=true only when the changed files, checks, and candidate
output provide strong evidence of a real improvement to the target slice.
Treat empty diffs, weak evidence, support-surface drift, vague summaries, and mismatches
between changed files and claimed outcomes as failure signals.

Lane-specific criteria:
${criteria}

Task:
${input.task}

Program:
${input.program}

Slice:
${input.slice}

Program text:
${input.programText || '(not provided)'}

Available skills:
${input.skillCatalog?.map((skill) => `- ${skill.path}: ${skill.description}`).join('\n') || '(not provided)'}

Changed files:
${input.changedFiles.map((path) => `- ${path}`).join('\n') || '- none'}

Diff stat:
${input.diffStat || '(empty)'}

Checks:
${formatChecks(input.checks)}

Patch:
${input.patch || '(empty)'}

Changed file excerpts:
${input.contextFiles?.map((file) => `File: ${file.path}\n${file.content}`).join('\n\n') || '(not provided)'}

Candidate output:
${input.candidateOutput}

Return JSON with:
- pass: boolean
- score: 0..1
- reasoning: string
- dimensions: { outcome?, process?, efficiency? }
- outcome: { evaluationTarget: "workspace-improvement", judgeKind: "workspace-improvement", rubric?: { architecture?, boundedness?, focus?, quality? } }`

export const buildWorkspaceImprovementMetaVerifierPrompt = ({
  input,
  judgeResult,
  criteria,
}: {
  input: WorkspaceImprovementJudgeInput
  judgeResult: GraderResult
  criteria: string
}) => `Meta-verify this workspace-improvement judgment.

Your job is to challenge the judgment, not to agree with it by default.
Lower confidence when the pass/fail decision is weakly supported, when evidence is incomplete,
or when the reasoning does not match the changed files, checks, or candidate output.
Prefer skepticism over agreement when support is ambiguous.

Lane-specific criteria:
${criteria}

Original task:
${input.task}

Changed files:
${input.changedFiles.map((path) => `- ${path}`).join('\n') || '- none'}

Program text:
${input.programText || '(not provided)'}

Available skills:
${input.skillCatalog?.map((skill) => `- ${skill.path}: ${skill.description}`).join('\n') || '(not provided)'}

Diff stat:
${input.diffStat || '(empty)'}

Patch:
${input.patch || '(empty)'}

Changed file excerpts:
${input.contextFiles?.map((file) => `File: ${file.path}\n${file.content}`).join('\n\n') || '(not provided)'}

Checks:
${formatChecks(input.checks)}

Judge result:
${JSON.stringify(judgeResult, null, 2)}

Return JSON with:
- confidence: 0..1
- reasoning: string

Use high confidence only when the judgment is well-supported by the changed files, checks,
candidate output, and lane-specific criteria.`

export const buildWorkspaceImprovementPromotionPrompt = ({
  lane,
  program,
  attempts,
}: {
  lane: string
  program: string
  attempts: Array<{
    attempt: number
    commit?: string
    pass: boolean
    score: number
    confidence?: number
    changedFiles: string[]
    diffStat: string
    reasoning?: string
  }>
}) => `Select a promotion decision for this workspace-improvement lane.

Your job is to compare the validated attempts and decide whether one attempt should be promoted,
whether the run needs manual review, or whether all attempts should be rejected.
Do not choose a winner unless one attempt is clearly better-supported than the others.
Prefer manual review when the evidence is mixed, confidence is low, or multiple attempts appear
competitive in different ways.

Lane:
${lane}

Program:
${program}

Attempt summaries:
${attempts
  .map(
    (attempt) => `Attempt ${attempt.attempt}
- commit: ${attempt.commit ?? '(none)'}
- pass: ${attempt.pass}
- score: ${attempt.score}
- confidence: ${attempt.confidence ?? '(none)'}
- diff stat: ${attempt.diffStat || '(empty)'}
- changed files:
${attempt.changedFiles.map((path) => `  - ${path}`).join('\n') || '  - none'}
- reasoning: ${attempt.reasoning ?? '(none)'}`,
  )
  .join('\n\n')}

Return JSON with:
- action: "promote_one" | "manual_review" | "reject_all"
- selectedAttempt?: number
- selectedCommit?: string
- confidence: 0..1
- reasoning: string

Choose "promote_one" only when the selected attempt clearly deserves promotion.`

export const toWorkspaceImprovementJudgeOutcome = (outcome?: WorkspaceImprovementJudgeOutcome) => outcome
