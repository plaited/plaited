import type { Grader } from '../src/improve.ts'
import {
  buildWorkspaceImprovementJudgeInput,
  buildWorkspaceImprovementJudgePrompt,
  type WorkspaceImprovementJudgeInput,
  type WorkspaceImprovementJudgeResponse,
  WorkspaceImprovementJudgeResponseSchema,
} from '../src/improve.ts'
import { resolvePrimaryJudgeModel, runStructuredLlmQuery } from './structured-llm-query.ts'

export const BEHAVIORAL_SEED_JUDGE_CRITERIA = `Prefer compact, lane-bounded behavioral-seed improvements that:
- preserve durable behavioral and constitution anchors
- produce reviewable seed artifacts rather than raw source restatements
- improve downstream corpus and factory usefulness
- avoid drift into unrelated runtime or framework rewrites`

const toChangedFiles = (metadata: Record<string, unknown> | undefined) =>
  Array.isArray(metadata?.changedPaths)
    ? metadata.changedPaths.filter((value): value is string => typeof value === 'string')
    : []

const toCheckRecord = (metadata: Record<string, unknown> | undefined) => ({
  piExitCode: metadata?.piExitCode ?? null,
  validateExitCode: metadata?.validateExitCode ?? null,
  retryCount: metadata?.retryCount ?? null,
})

export const buildBehavioralSeedJudgeInput = ({
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
    patch: typeof metadata?.patch === 'string' ? metadata.patch : '',
    checks: toCheckRecord(metadata),
    program: 'dev-research/behavioral-seed/program.md',
    programText: typeof metadata?.programText === 'string' ? metadata.programText : undefined,
    slice: 'behavioral-seed',
    contextFiles: Array.isArray(metadata?.contextFiles)
      ? metadata.contextFiles.filter(
          (value): value is { path: string; content: string } =>
            typeof value === 'object' &&
            value !== null &&
            'path' in value &&
            'content' in value &&
            typeof value.path === 'string' &&
            typeof value.content === 'string',
        )
      : undefined,
    skillCatalog: Array.isArray(metadata?.skillCatalog)
      ? metadata.skillCatalog.filter(
          (value): value is { path: string; description: string } =>
            typeof value === 'object' &&
            value !== null &&
            'path' in value &&
            'description' in value &&
            typeof value.path === 'string' &&
            typeof value.description === 'string',
        )
      : undefined,
  })

export const grade: Grader = async ({ output, metadata }) => {
  const input = buildBehavioralSeedJudgeInput({
    output,
    metadata,
    task: 'Evaluate a behavioral-seed autoresearch attempt.',
  })
  const result = await runStructuredLlmQuery<WorkspaceImprovementJudgeResponse>({
    model: resolvePrimaryJudgeModel(),
    prompt: buildWorkspaceImprovementJudgePrompt({
      input,
      criteria: BEHAVIORAL_SEED_JUDGE_CRITERIA,
    }),
    schema: WorkspaceImprovementJudgeResponseSchema,
    systemPrompt:
      'You are evaluating a workspace-improvement attempt. Your first job is to find correctness, scope, and evidence problems. Return strict JSON only. Fail attempts unless the changed files, checks, and output strongly support a bounded behavioral-seed improvement.',
    workspaceReadAccess:
      typeof metadata?.cwd === 'string'
        ? {
            workspaceRoot: metadata.cwd,
            allowedRoots: ['skills/behavioral-core', 'skills/constitution', 'dev-research/behavioral-seed'],
            maxToolRounds: 3,
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
          ...(typeof metadata?.cwd === 'string' ? { workspaceRoot: metadata.cwd } : {}),
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
        ...(typeof metadata?.cwd === 'string' ? { workspaceRoot: metadata.cwd } : {}),
      },
    },
  }
}
