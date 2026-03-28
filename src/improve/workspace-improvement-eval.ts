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

export const buildWorkspaceImprovementJudgeInput = ({
  task,
  candidateOutput,
  changedFiles,
  diffStat,
  patch,
  checks,
  program,
  slice,
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
    slice,
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

Lane-specific criteria:
${criteria}

Task:
${input.task}

Program:
${input.program}

Slice:
${input.slice}

Changed files:
${input.changedFiles.map((path) => `- ${path}`).join('\n') || '- none'}

Diff stat:
${input.diffStat || '(empty)'}

Checks:
${formatChecks(input.checks)}

Patch:
${input.patch || '(empty)'}

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

Lane-specific criteria:
${criteria}

Original task:
${input.task}

Changed files:
${input.changedFiles.map((path) => `- ${path}`).join('\n') || '- none'}

Diff stat:
${input.diffStat || '(empty)'}

Checks:
${formatChecks(input.checks)}

Judge result:
${JSON.stringify(judgeResult, null, 2)}

Return JSON with:
- confidence: 0..1
- reasoning: string

Use high confidence only when the judgment is well-supported by the changed files, checks, and candidate output.`

export const toWorkspaceImprovementJudgeOutcome = (outcome?: WorkspaceImprovementJudgeOutcome) => outcome
