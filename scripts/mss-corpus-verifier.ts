import type { GraderResult, Verifier } from '../src/improve.ts'
import {
  buildWorkspaceImprovementMetaVerifierPrompt,
  type WorkspaceImprovementJudgeInput,
  type WorkspaceImprovementMetaVerifierResponse,
  WorkspaceImprovementMetaVerifierResponseSchema,
} from '../src/improve.ts'
import { MSS_CORPUS_JUDGE_CRITERIA } from './mss-corpus-grader.ts'
import { resolveMetaVerifierModel, runStructuredLlmQuery } from './structured-llm-query.ts'

export const getMssCorpusJudgeInput = (result: GraderResult): WorkspaceImprovementJudgeInput | null => {
  const judgeInput = result.outcome?.judgeSdk
  if (!judgeInput || typeof judgeInput !== 'object' || !('judgeInput' in judgeInput)) return null
  const value = judgeInput.judgeInput
  return value && typeof value === 'object' ? (value as WorkspaceImprovementJudgeInput) : null
}

export const verify: Verifier = async (result: GraderResult) => {
  const input = getMssCorpusJudgeInput(result)
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
      criteria: MSS_CORPUS_JUDGE_CRITERIA,
    }),
    schema: WorkspaceImprovementMetaVerifierResponseSchema,
    systemPrompt:
      'You are meta-verifying a workspace-improvement judgment. Return strict JSON only. Focus on trustworthiness of the judgment, not re-scoring from scratch.',
  })

  if (!response.ok) {
    return {
      confidence: 0.25,
      reasoning: response.reason,
    }
  }

  return response.value
}
