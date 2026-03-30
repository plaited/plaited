import type { TrialEntry, TrialResult } from './eval.schemas.ts'
import {
  PromotionCandidateSchema,
  type PromotionDecision,
  PromotionDecisionSchema,
  type RetainedArtifact,
  RetainedArtifactSchema,
  type SelectionSignals,
  SelectionSignalsSchema,
  type Variant,
  VariantSchema,
} from './evolution.schemas.ts'

const hasToolError = (trial: TrialEntry) =>
  trial.trajectory?.some((step) => step.type === 'tool_call' && step.status === 'failed') ?? false

export const summarizeSelectionSignals = (result: TrialResult): SelectionSignals => {
  const scoredTrials = result.trials.filter((trial) => typeof trial.score === 'number')
  const scores = scoredTrials.map((trial) => trial.score as number)
  const meanScore = scores.length > 0 ? scores.reduce((sum, score) => sum + score, 0) / scores.length : undefined
  const bestScore = scores.length > 0 ? Math.max(...scores) : undefined

  return SelectionSignalsSchema.parse({
    passRate: result.passRate,
    passAtK: result.passAtK,
    passExpK: result.passExpK,
    ...(meanScore !== undefined && { meanScore }),
    ...(bestScore !== undefined && { bestScore }),
    successfulTrials: result.trials.filter((trial) => trial.pass === true).length,
    totalTrials: result.trials.length,
    timedOutTrials: result.trials.filter((trial) => trial.timedOut).length,
    nonZeroExitTrials: result.trials.filter(
      (trial) => trial.exitCode !== undefined && trial.exitCode !== null && trial.exitCode !== 0,
    ).length,
    toolErrorTrials: result.trials.filter(hasToolError).length,
  })
}

export const toPromotionCandidate = ({
  variant,
  result,
  verificationPassed,
  verificationConfidence,
  judgeScore,
  reasoning,
}: {
  variant: Variant
  result: TrialResult
  verificationPassed?: boolean
  verificationConfidence?: number
  judgeScore?: number
  reasoning?: string
}) =>
  PromotionCandidateSchema.parse({
    variantId: VariantSchema.parse(variant).id,
    commit: variant.commit,
    signals: summarizeSelectionSignals(result),
    ...(verificationPassed !== undefined && { verificationPassed }),
    ...(verificationConfidence !== undefined && { verificationConfidence }),
    ...(judgeScore !== undefined && { judgeScore }),
    ...(reasoning && { reasoning }),
  })

const promotionScore = (candidate: {
  signals: SelectionSignals
  verificationPassed?: boolean
  verificationConfidence?: number
  judgeScore?: number
}) => {
  const signalScore = candidate.signals.meanScore ?? candidate.signals.passRate ?? 0
  const verificationScore = candidate.verificationPassed === false ? -1 : (candidate.verificationConfidence ?? 0)
  const judgeScore = candidate.judgeScore ?? 0
  return signalScore + verificationScore + judgeScore
}

export const selectPromotionCandidate = ({
  candidates,
  minPassRate = 0.5,
  minVerificationConfidence = 0.6,
}: {
  candidates: Array<ReturnType<typeof toPromotionCandidate>>
  minPassRate?: number
  minVerificationConfidence?: number
}): PromotionDecision => {
  if (candidates.length === 0) {
    return PromotionDecisionSchema.parse({
      action: 'reject_all',
      confidence: 1,
      reasoning: 'No promotion candidates were provided.',
    })
  }

  const eligible = candidates.filter((candidate) => {
    const passRate = candidate.signals.passRate ?? 0
    const verificationOk =
      candidate.verificationPassed !== false &&
      (candidate.verificationConfidence === undefined || candidate.verificationConfidence >= minVerificationConfidence)

    return passRate >= minPassRate && verificationOk
  })

  if (eligible.length === 0) {
    return PromotionDecisionSchema.parse({
      action: 'reject_all',
      confidence: 0.9,
      reasoning: 'No candidate met the minimum pass-rate and verification thresholds.',
    })
  }

  const ranked = [...eligible].sort((left, right) => promotionScore(right) - promotionScore(left))
  const winner = ranked[0]!
  const runnerUp = ranked[1]
  const margin = runnerUp ? promotionScore(winner) - promotionScore(runnerUp) : promotionScore(winner)

  if (runnerUp && margin < 0.1) {
    return PromotionDecisionSchema.parse({
      action: 'manual_review',
      confidence: 0.55,
      reasoning: 'Top candidates are too close to promote automatically.',
    })
  }

  return PromotionDecisionSchema.parse({
    action: 'promote_one',
    selectedVariantId: winner.variantId,
    ...(winner.commit && { selectedCommit: winner.commit }),
    confidence: Math.min(1, 0.7 + Math.max(0, margin)),
    reasoning: 'Selected the highest-scoring verified candidate for promotion.',
  })
}

export const collectRetainedArtifacts = ({
  variant,
  result,
  decision,
}: {
  variant: Variant
  result: TrialResult
  decision: PromotionDecision
}): RetainedArtifact[] => {
  if (decision.action !== 'promote_one' || decision.selectedVariantId !== variant.id) return []

  const retained: RetainedArtifact[] = []

  if (variant.commit) {
    retained.push(
      RetainedArtifactSchema.parse({
        kind: 'accepted-commit',
        variantId: variant.id,
        commit: variant.commit,
        summary: variant.summary,
      }),
    )
  }

  for (const trial of result.trials) {
    if (!trial.trajectory || trial.trajectory.length === 0) continue

    retained.push(
      RetainedArtifactSchema.parse({
        kind: 'trajectory',
        variantId: variant.id,
        trialNum: trial.trialNum,
        summary: `Retained trajectory from trial ${trial.trialNum}`,
      }),
    )
  }

  retained.push(
    RetainedArtifactSchema.parse({
      kind: 'summary',
      variantId: variant.id,
      summary: `Retained selected variant ${variant.id} from eval result ${result.id}`,
      metadata: {
        resultId: result.id,
        passRate: result.passRate,
        passAtK: result.passAtK,
      },
    }),
  )

  return retained
}
