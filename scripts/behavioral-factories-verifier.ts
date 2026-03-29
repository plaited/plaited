import type { GraderResult, Verifier } from '../src/improve.ts'
import {
  buildWorkspaceImprovementMetaVerifierPrompt,
  type WorkspaceImprovementJudgeInput,
  type WorkspaceImprovementMetaVerifierResponse,
  WorkspaceImprovementMetaVerifierResponseSchema,
} from '../src/improve.ts'
import { BEHAVIORAL_FACTORIES_JUDGE_CRITERIA } from './behavioral-factories-grader.ts'
import { resolveMetaVerifierModel, runStructuredLlmQuery } from './structured-llm-query.ts'

export const getBehavioralFactoriesJudgeInput = (result: GraderResult): WorkspaceImprovementJudgeInput | null => {
  const judgeInput = result.outcome?.judgeSdk
  if (!judgeInput || typeof judgeInput !== 'object' || !('judgeInput' in judgeInput)) return null
  const value = judgeInput.judgeInput
  return value && typeof value === 'object' ? (value as WorkspaceImprovementJudgeInput) : null
}

export const verify: Verifier = async (result: GraderResult) => {
  const input = getBehavioralFactoriesJudgeInput(result)
  const workspaceRoot =
    typeof result.outcome?.judgeSdk === 'object' &&
    result.outcome?.judgeSdk &&
    'workspaceRoot' in result.outcome.judgeSdk &&
    typeof result.outcome.judgeSdk.workspaceRoot === 'string'
      ? result.outcome.judgeSdk.workspaceRoot
      : undefined
  if (!input) {
    return {
      confidence: 0.2,
      reasoning: 'Missing workspace judge input in grader outcome.',
    }
  }

  const response = await runStructuredLlmQuery<WorkspaceImprovementMetaVerifierResponse>({
    model: resolveMetaVerifierModel(),
    prompt: buildWorkspaceImprovementMetaVerifierPrompt({
      input,
      judgeResult: result,
      criteria: BEHAVIORAL_FACTORIES_JUDGE_CRITERIA,
    }),
    schema: WorkspaceImprovementMetaVerifierResponseSchema,
    systemPrompt:
      'You are meta-verifying a workspace-improvement judgment. Return strict JSON only. Be skeptical. Treat the lane program as the contract. Use search on retained seed/corpus JSON-LD artifacts when semantic evidence matters, and use read_file for markdown or source surfaces. Lower confidence unless the judgment is clearly supported by the changed files, checks, output, reasoning, and artifact evidence.',
    workspaceReadAccess: workspaceRoot
      ? {
          workspaceRoot,
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

  if (!response.ok) {
    return {
      confidence: 0.25,
      reasoning: response.reason,
    }
  }

  return response.value
}
