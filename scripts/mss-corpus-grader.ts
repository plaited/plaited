import type { Grader } from '../src/improve.ts'
import {
  buildWorkspaceImprovementJudgeInput,
  buildWorkspaceImprovementJudgePrompt,
  type WorkspaceImprovementJudgeInput,
  type WorkspaceImprovementJudgeResponse,
  WorkspaceImprovementJudgeResponseSchema,
} from '../src/improve.ts'
import { resolvePrimaryJudgeModel, runStructuredLlmQuery } from './structured-llm-query.ts'

export const MSS_CORPUS_JUDGE_CRITERIA = `Prefer lane-bounded corpus improvements that:
- produce or refine encoded/artifact outputs
- preserve source-backed structure, provenance, and retrieval value
- align to seed anchors instead of inventing unrelated ontology
- avoid support-surface drift or empty corpus changes`

const toChangedFiles = (metadata: Record<string, unknown> | undefined) =>
  Array.isArray(metadata?.changedPaths)
    ? metadata.changedPaths.filter((value): value is string => typeof value === 'string')
    : []

const toCheckRecord = (metadata: Record<string, unknown> | undefined) => ({
  piExitCode: metadata?.piExitCode ?? null,
  validateExitCode: metadata?.validateExitCode ?? null,
  retryCount: metadata?.retryCount ?? null,
})

export const buildMssCorpusJudgeInput = ({
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
    program: 'dev-research/mss-corpus/program.md',
    slice: 'mss-corpus',
  })

export const grade: Grader = async ({ output, metadata }) => {
  const workspaceRoot = typeof metadata?.cwd === 'string' ? metadata.cwd : undefined
  const input = buildMssCorpusJudgeInput({
    output,
    metadata,
    task: 'Evaluate an MSS corpus autoresearch attempt.',
  })
  const result = await runStructuredLlmQuery<WorkspaceImprovementJudgeResponse>({
    model: resolvePrimaryJudgeModel(),
    prompt: buildWorkspaceImprovementJudgePrompt({
      input,
      criteria: MSS_CORPUS_JUDGE_CRITERIA,
    }),
    schema: WorkspaceImprovementJudgeResponseSchema,
    systemPrompt:
      'You are evaluating a workspace-improvement attempt. Your first job is to find correctness, scope, and evidence problems. Return strict JSON only. Fail attempts unless the changed files, checks, and output strongly support a bounded lane-local corpus improvement.',
    workspaceReadAccess: workspaceRoot
      ? {
          workspaceRoot,
          allowedRoots: [
            'dev-research/mss-corpus',
            'dev-research/mss-corpus/program.md',
            'dev-research/mss-seed',
            'skills/mss',
            'skills/modnet-node',
            'skills/modnet-modules',
            'skills/hypergraph-memory',
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
