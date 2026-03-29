import type { Grader } from '../src/improve.ts'
import {
  buildWorkspaceImprovementJudgeInput,
  buildWorkspaceImprovementJudgePrompt,
  type WorkspaceImprovementJudgeInput,
  type WorkspaceImprovementJudgeResponse,
  WorkspaceImprovementJudgeResponseSchema,
} from '../src/improve.ts'
import { resolvePrimaryJudgeModel, runStructuredLlmQuery } from './structured-llm-query.ts'

export const BEHAVIORAL_FACTORIES_JUDGE_CRITERIA = `Prefer lane-bounded behavioral-factory improvements that:
- preserve the retained seed -> corpus -> factory dependency order
- produce deterministic, reviewable factory-oriented outputs
- improve traceability from memory-facing inputs to factory outputs
- avoid drift into upstream seed/corpus regeneration or unrelated runtime rewrites`

const toChangedFiles = (metadata: Record<string, unknown> | undefined) =>
  Array.isArray(metadata?.changedPaths)
    ? metadata.changedPaths.filter((value): value is string => typeof value === 'string')
    : []

const toCheckRecord = (metadata: Record<string, unknown> | undefined) => ({
  piExitCode: metadata?.piExitCode ?? null,
  validateExitCode: metadata?.validateExitCode ?? null,
  retryCount: metadata?.retryCount ?? null,
})

export const buildBehavioralFactoriesJudgeInput = ({
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
    program: 'dev-research/behavioral-factories/program.md',
    programText: typeof metadata?.programText === 'string' ? metadata.programText : undefined,
    slice: 'behavioral-factories',
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
  const input = buildBehavioralFactoriesJudgeInput({
    output,
    metadata,
    task: 'Evaluate a behavioral-factories autoresearch attempt.',
  })
  const result = await runStructuredLlmQuery<WorkspaceImprovementJudgeResponse>({
    model: resolvePrimaryJudgeModel(),
    prompt: buildWorkspaceImprovementJudgePrompt({
      input,
      criteria: BEHAVIORAL_FACTORIES_JUDGE_CRITERIA,
    }),
    schema: WorkspaceImprovementJudgeResponseSchema,
    systemPrompt:
      'You are evaluating a workspace-improvement attempt. Your first job is to find correctness, scope, and evidence problems. Return strict JSON only. Treat the lane program as the contract. Use search on retained seed/corpus JSON-LD artifacts when semantic evidence matters, and use read_file for markdown or source surfaces. Fail attempts unless the changed files, checks, output, and artifact evidence strongly support a bounded behavioral-factories improvement.',
    workspaceReadAccess:
      typeof metadata?.cwd === 'string'
        ? {
            workspaceRoot: metadata.cwd,
            allowedRoots: [
              'dev-research/behavioral-factories',
              'dev-research/mss-seed',
              'dev-research/mss-corpus',
              'dev-research/behavioral-seed',
              'dev-research/behavioral-corpus',
              'skills/behavioral-core',
              'skills/constitution',
              'skills/hypergraph-memory',
              'skills/mss',
              'skills/modnet-node',
              'skills/modnet-modules',
              'src/behavioral',
              'src/agent',
            ],
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
