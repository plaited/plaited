import { type ResearchGraderInput, ResearchGraderInputSchema } from './grader.schemas.ts'
import type { ResearchGrade } from './research.schemas.ts'

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value))

const hasSignal = (value: string | undefined, minimumLength: number): boolean =>
  typeof value === 'string' && value.trim().length >= minimumLength

const includesReviewSignal = (value: string | undefined): boolean => {
  if (!value) return false
  const normalized = value.toLowerCase()
  return (
    normalized.includes('risk') ||
    normalized.includes('gap') ||
    normalized.includes('check') ||
    normalized.includes('verify') ||
    normalized.includes('unknown')
  )
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const collectTraceStrings = ({ value, sink }: { value: unknown; sink: string[] }): void => {
  if (value === null || value === undefined) return
  if (typeof value === 'string') {
    sink.push(value)
    return
  }
  if (typeof value !== 'object') return
  if (Array.isArray(value)) {
    for (const item of value) {
      collectTraceStrings({ value: item, sink })
    }
    return
  }
  for (const entry of Object.values(value)) {
    collectTraceStrings({ value: entry, sink })
  }
}

const sanitizePayloadForTraceSignals = (payload: unknown): unknown => {
  if (!isRecord(payload)) return payload
  const { researcherOutput: _ignoredResearcherOutput, ...rawPayload } = payload
  return rawPayload
}

const detectTraceSignals = (
  payloads: unknown[],
): {
  hasExecutionTraceSignal: boolean
  hasTestTraceSignal: boolean
} => {
  const traceStrings: string[] = []
  for (const payload of payloads) {
    collectTraceStrings({
      value: sanitizePayloadForTraceSignals(payload),
      sink: traceStrings,
    })
  }
  const traceText = traceStrings.join('\n').toLowerCase()
  return {
    hasExecutionTraceSignal: /(command|stdout|stderr|tool|execut|exit code|ran\b)/i.test(traceText),
    hasTestTraceSignal: /(bun test|npm test|pnpm test|pytest|vitest|jest|assert|pass|fail)/i.test(traceText),
  }
}

/**
 * Deterministic fixed grader for first-pass researcher runs.
 *
 * The scorer intentionally uses one primary scalar score and derives pass/fail
 * from that score plus required baseline evidence (non-empty final text).
 */
export const gradeResearchResult = (rawInput: ResearchGraderInput): ResearchGrade => {
  const input = ResearchGraderInputSchema.parse(rawInput)
  const contextSnapshotCount = input.contextWorkerSnapshots.length + input.reviewWorkerSnapshots.length
  const consumerSnapshotCount = input.consumerWorkerSnapshots.length
  const claimedFilesChangedDuringRunCount = input.fileWriteEvidence.claimedFilesChangedDuringRunCount
  const { hasExecutionTraceSignal, hasTestTraceSignal } = detectTraceSignals(
    input.consumerWorkerSnapshots.map((snapshot) => snapshot.payload),
  )

  const finalTextPresent = hasSignal(input.consumerResult.finalText, 20)
  const reportedFilesWrittenCount = input.consumerResult.filesWritten.length
  const hasModelAReview = hasSignal(input.modelAReview, 20)
  const hasExecutionEvidence = hasSignal(input.consumerResult.executionOutput, 8) && hasExecutionTraceSignal
  const hasTestEvidence = hasSignal(input.consumerResult.testOutput, 8) && hasTestTraceSignal

  const contextDepthScore = clamp(
    (input.contextPacket.claims.length > 0 ? 0.08 : 0) +
      (input.contextPacket.filesToRead.length > 0 ? 0.08 : 0) +
      (input.contextPacket.suggestedChecks.length > 0 ? 0.07 : 0) +
      (input.contextPacket.openQuestions.length > 0 ? 0.07 : 0) +
      (hasModelAReview ? 0.1 : 0),
    0,
    0.4,
  )

  const outputEvidenceScore = clamp(
    (finalTextPresent ? 0.35 : 0) +
      (claimedFilesChangedDuringRunCount > 0 ? 0.1 : 0) +
      (hasExecutionEvidence ? 0.07 : 0) +
      (hasTestEvidence ? 0.08 : 0),
    0,
    0.6,
  )

  const trajectoryScore = clamp(
    (contextSnapshotCount > 0 ? 0.05 : 0) +
      (consumerSnapshotCount > 0 ? 0.05 : 0) +
      (includesReviewSignal(input.modelAReview) ? 0.05 : 0),
    0,
    0.15,
  )

  const score = clamp(Number((contextDepthScore + outputEvidenceScore + trajectoryScore).toFixed(3)), 0, 1)
  const pass = finalTextPresent && hasModelAReview && score >= 0.67

  const reasoning = [
    `Task: ${input.task}`,
    `finalTextPresent=${finalTextPresent}`,
    `modelAReviewPresent=${hasModelAReview}`,
    `filesWrittenReported=${reportedFilesWrittenCount}`,
    `filesWrittenChangedDuringRun=${claimedFilesChangedDuringRunCount}`,
    `executionEvidence=${hasExecutionEvidence}`,
    `testEvidence=${hasTestEvidence}`,
    `executionTraceSignal=${hasExecutionTraceSignal}`,
    `testTraceSignal=${hasTestTraceSignal}`,
    `contextDepthScore=${contextDepthScore.toFixed(3)}`,
    `outputEvidenceScore=${outputEvidenceScore.toFixed(3)}`,
    `trajectoryScore=${trajectoryScore.toFixed(3)}`,
    `score=${score.toFixed(3)}`,
    `pass=${pass}`,
  ].join('; ')

  return {
    pass,
    score,
    reasoning,
    outcome: {
      contextDepth: contextDepthScore,
      outputEvidence: outputEvidenceScore,
      trajectory: trajectoryScore,
      modelAReviewPresent: hasModelAReview,
      filesWrittenReportedCount: reportedFilesWrittenCount,
      filesWrittenChangedDuringRunCount: claimedFilesChangedDuringRunCount,
      executionTraceSignal: hasExecutionTraceSignal,
      testTraceSignal: hasTestTraceSignal,
      contextClaims: input.contextPacket.claims.length,
      suggestedChecks: input.contextPacket.suggestedChecks.length,
      contextSnapshotCount,
      consumerSnapshotCount,
    },
  }
}
