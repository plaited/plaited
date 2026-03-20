import type { Grader } from '../src/improve.ts'

type NativeModelJudgeMetadata = {
  themeId?: string
  themeName?: string
  taskType?: string
  judge?: {
    requiredConcepts?: string[]
    alignmentSignals?: string[]
    structureSignals?: string[]
    dynamicSignals?: string[]
    discouragedSignals?: string[]
  }
}

type NativeModelJudgeScores = {
  plaitedAlignment: number
  taskFulfillment: number
  structuralCorrectness: number
  dynamicCorrectness: number
  distillationSuitability: number
}

const clamp = (value: number): number => Math.max(0, Math.min(1, value))

const average = (values: number[]): number => {
  if (values.length === 0) {
    return 0
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length
}

const round = (value: number): number => Number(value.toFixed(3))

const isStringArray = (value: unknown): value is string[] => {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

const normalizeSignalText = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

const getMetadata = (metadata: Record<string, unknown> | undefined): NativeModelJudgeMetadata => {
  const rawJudge = metadata?.judge
  const judge = rawJudge && typeof rawJudge === 'object' ? (rawJudge as Record<string, unknown>) : undefined

  return {
    themeId: typeof metadata?.themeId === 'string' ? metadata.themeId : undefined,
    themeName: typeof metadata?.themeName === 'string' ? metadata.themeName : undefined,
    taskType: typeof metadata?.taskType === 'string' ? metadata.taskType : undefined,
    judge: judge
      ? {
          requiredConcepts: isStringArray(judge.requiredConcepts) ? judge.requiredConcepts : undefined,
          alignmentSignals: isStringArray(judge.alignmentSignals) ? judge.alignmentSignals : undefined,
          structureSignals: isStringArray(judge.structureSignals) ? judge.structureSignals : undefined,
          dynamicSignals: isStringArray(judge.dynamicSignals) ? judge.dynamicSignals : undefined,
          discouragedSignals: isStringArray(judge.discouragedSignals) ? judge.discouragedSignals : undefined,
        }
      : undefined,
  }
}

const scoreSignals = (
  haystack: string,
  signals: string[] | undefined,
): { score: number; matched: string[]; missing: string[] } => {
  if (!signals || signals.length === 0) {
    return {
      score: 1,
      matched: [],
      missing: [],
    }
  }

  const normalizedHaystack = normalizeSignalText(haystack)
  const matched = signals.filter((signal) => {
    const alternatives = signal
      .split('|')
      .map((candidate) => normalizeSignalText(candidate))
      .filter(Boolean)

    return alternatives.some((candidate) => normalizedHaystack.includes(candidate))
  })
  const missing = signals.filter((signal) => !matched.includes(signal))

  return {
    score: matched.length / signals.length,
    matched,
    missing,
  }
}

const getRetentionLabel = (scores: NativeModelJudgeScores, overallScore: number) => {
  const minimumDimension = Math.min(
    scores.plaitedAlignment,
    scores.taskFulfillment,
    scores.structuralCorrectness,
    scores.dynamicCorrectness,
    scores.distillationSuitability,
  )

  if (
    overallScore >= 0.85 &&
    scores.plaitedAlignment >= 0.85 &&
    scores.distillationSuitability >= 0.85 &&
    minimumDimension >= 0.65
  ) {
    return 'retain_for_distillation'
  }

  if (overallScore >= 0.8 && minimumDimension >= 0.65) {
    return 'retain_for_review'
  }

  return 'reject'
}

export const grade: Grader = async ({ output, metadata }) => {
  const text = output.trim()
  if (!text) {
    return {
      pass: false,
      score: 0,
      reasoning: 'No model output produced.',
      outcome: {
        nativeModelJudge: {
          overallScore: 0,
          retentionLabel: 'reject',
        },
      },
    }
  }

  const nativeMetadata = getMetadata(metadata)
  const lowerOutput = text.toLowerCase()
  const wordCount = text.split(/\s+/).filter(Boolean).length

  const requiredConcepts = scoreSignals(lowerOutput, nativeMetadata.judge?.requiredConcepts)
  const alignmentSignals = scoreSignals(lowerOutput, nativeMetadata.judge?.alignmentSignals)
  const structureSignals = scoreSignals(lowerOutput, nativeMetadata.judge?.structureSignals)
  const dynamicSignals = scoreSignals(lowerOutput, nativeMetadata.judge?.dynamicSignals)
  const discouragedSignals = scoreSignals(lowerOutput, nativeMetadata.judge?.discouragedSignals)

  const sectionHeadings = (text.match(/^##?\s+/gm) ?? []).length
  const bulletCount = (text.match(/^\s*[-*]\s+/gm) ?? []).length
  const hasCodeFence = text.includes('```')
  const structureBonus = average([sectionHeadings > 0 ? 1 : 0.5, bulletCount > 0 || hasCodeFence ? 1 : 0.6])

  const lengthScore = clamp(
    wordCount < 80 ? 0.45 : wordCount > 900 ? 0.65 : 0.85 + Math.min((wordCount - 80) / 500, 0.1),
  )

  const scores: NativeModelJudgeScores = {
    plaitedAlignment: round(average([requiredConcepts.score, alignmentSignals.score])),
    taskFulfillment: round(average([requiredConcepts.score, structureSignals.score])),
    structuralCorrectness: round(average([structureSignals.score, structureBonus])),
    dynamicCorrectness: round(dynamicSignals.score),
    distillationSuitability: round(
      clamp(
        average([
          lengthScore,
          discouragedSignals.matched.length > 0 ? 0.45 : 0.95,
          sectionHeadings > 0 || bulletCount > 0 || hasCodeFence ? 0.95 : 0.7,
        ]),
      ),
    ),
  }

  const overallScore = round(
    average([
      scores.plaitedAlignment,
      scores.taskFulfillment,
      scores.structuralCorrectness,
      scores.dynamicCorrectness,
      scores.distillationSuitability,
    ]),
  )
  const retentionLabel = getRetentionLabel(scores, overallScore)

  const strongestSuccess = Object.entries(scores).sort((left, right) => right[1] - left[1])[0]
  const weakestDimension = Object.entries(scores).sort((left, right) => left[1] - right[1])[0]

  return {
    pass: retentionLabel !== 'reject',
    score: overallScore,
    reasoning: [
      `strongest=${strongestSuccess?.[0] ?? 'n/a'}:${strongestSuccess?.[1] ?? 0}`,
      `weakest=${weakestDimension?.[0] ?? 'n/a'}:${weakestDimension?.[1] ?? 0}`,
      `required=${requiredConcepts.matched.length}/${nativeMetadata.judge?.requiredConcepts?.length ?? 0}`,
      `alignment=${alignmentSignals.matched.length}/${nativeMetadata.judge?.alignmentSignals?.length ?? 0}`,
    ].join(', '),
    dimensions: {
      outcome: overallScore,
      process: round(average([scores.plaitedAlignment, scores.structuralCorrectness, scores.dynamicCorrectness])),
      efficiency: scores.distillationSuitability,
    },
    outcome: {
      nativeModelJudge: {
        themeId: nativeMetadata.themeId,
        themeName: nativeMetadata.themeName,
        taskType: nativeMetadata.taskType,
        overallScore,
        dimensions: scores,
        retentionLabel,
        matchedSignals: {
          requiredConcepts: requiredConcepts.matched,
          alignmentSignals: alignmentSignals.matched,
          structureSignals: structureSignals.matched,
          dynamicSignals: dynamicSignals.matched,
          discouragedSignals: discouragedSignals.matched,
        },
        missingSignals: {
          requiredConcepts: requiredConcepts.missing,
          alignmentSignals: alignmentSignals.missing,
          structureSignals: structureSignals.missing,
          dynamicSignals: dynamicSignals.missing,
        },
      },
    },
  }
}
