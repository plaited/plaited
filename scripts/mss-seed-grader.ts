import type { Grader } from '../src/improve.ts'
import {
  buildWorkspaceImprovementJudgeInput,
  buildWorkspaceImprovementJudgePrompt,
  type WorkspaceImprovementJudgeInput,
  type WorkspaceImprovementJudgeResponse,
  WorkspaceImprovementJudgeResponseSchema,
} from '../src/improve.ts'
import { resolvePrimaryJudgeModel, runStructuredLlmQuery } from './structured-llm-query.ts'

export const MSS_SEED_JUDGE_CRITERIA = `Prefer compact, lane-bounded seed improvements that:
- strengthen durable MSS and Modnet anchors
- improve seed reviewability and downstream usefulness
- avoid support-surface drift
- avoid broad speculative ontology expansion`

const toChangedFiles = (metadata: Record<string, unknown> | undefined) =>
  Array.isArray(metadata?.changedPaths)
    ? metadata.changedPaths.filter((value): value is string => typeof value === 'string')
    : []

const toCheckRecord = (metadata: Record<string, unknown> | undefined) => ({
  piExitCode: metadata?.piExitCode ?? null,
  validateExitCode: metadata?.validateExitCode ?? null,
  retryCount: metadata?.retryCount ?? null,
})

export const buildMssSeedJudgeInput = ({
  output,
  metadata,
  task,
}: {
  output: string
  metadata?: Record<string, unknown>
  task: string
}): WorkspaceImprovementJudgeInput =>
  buildWorkspaceImprovementJudgeInput({
    evaluationTarget: 'workspace-improvement',
    task,
    candidateOutput: output,
    changedFiles: toChangedFiles(metadata),
    diffStat: typeof metadata?.diffStat === 'string' ? metadata.diffStat : '',
    patch: '',
    checks: toCheckRecord(metadata),
    program: 'dev-research/mss-seed/program.md',
    slice: 'mss-seed',
  })

export const grade: Grader = async ({ output, metadata }) => {
  const workspaceRoot = typeof metadata?.cwd === 'string' ? metadata.cwd : undefined
  const input = buildMssSeedJudgeInput({
    output,
    metadata,
    task: 'Evaluate an MSS seed autoresearch attempt.',
  })
  const result = await runStructuredLlmQuery<WorkspaceImprovementJudgeResponse>({
    model: resolvePrimaryJudgeModel(),
    prompt: buildWorkspaceImprovementJudgePrompt({
      input,
      criteria: MSS_SEED_JUDGE_CRITERIA,
    }),
    schema: WorkspaceImprovementJudgeResponseSchema,
    systemPrompt:
      'You are evaluating a workspace-improvement attempt. Your first job is to find correctness, scope, and evidence problems. Return strict JSON only. Fail attempts unless the changed files, checks, and output strongly support a bounded lane-local improvement.',
    workspaceReadAccess: workspaceRoot
      ? {
          workspaceRoot,
          allowedRoots: [
            'dev-research/mss-seed',
            'dev-research/mss-seed/program.md',
            'skills/mss',
            'skills/modnet-node',
            'skills/modnet-modules',
            'docs/Structural-IA.md',
            'docs/Modnet.md',
            'docs/MODNET-IMPLEMENTATION.md',
          ],
        }
      : undefined,
  })

  if (!result.ok) {
    return {
      pass: false,
      score: 0,
      reasoning: result.reason,
      outcome: {
        evaluationTarget: 'workspace-improvement',
        judgeKind: 'workspace-improvement',
        judgeSdk: {
          judgeInput: input,
          ...(workspaceRoot ? { workspaceRoot } : {}),
        },
      },
    }
  }

  return {
    ...result.value,
    outcome: {
      ...result.value.outcome,
      judgeSdk: {
        ...(result.value.outcome?.judgeSdk ?? {}),
        judgeInput: input,
        ...(workspaceRoot ? { workspaceRoot } : {}),
      },
    },
  }
}
