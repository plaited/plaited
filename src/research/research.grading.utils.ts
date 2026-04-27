import type {
  ResearchGrader,
  ResearchGraderInput,
  ResearchGraderResult,
  ResearchPromptResult,
} from './research.schema.ts'
import { ResearchGraderInputSchema, ResearchGraderResultSchema, ResearchPromptResultSchema } from './research.schema.ts'

export const invokeResearchGrader = async ({
  grader,
  input,
}: {
  grader: ResearchGrader
  input: ResearchGraderInput
}): Promise<ResearchGraderResult> => {
  const parsedInput = ResearchGraderInputSchema.parse(input)
  const result = await grader(parsedInput)
  return ResearchGraderResultSchema.parse(result)
}

export type NormalizedResearchPromptResult = {
  result: ResearchPromptResult
  comparisonEligible: boolean
  passEvidenceCount: number
  passEvidenceCoverage: 'none' | 'partial' | 'full'
}

const isTrialPassEvidence = (pass: boolean | undefined): pass is boolean => typeof pass === 'boolean'

const derivePromptPassMetrics = ({
  k,
  result,
}: {
  k: number
  result: ResearchPromptResult
}): {
  comparisonEligible: boolean
  passRate: number
  passAtK: number
  passExpK: number
  passEvidenceCount: number
  passEvidenceCoverage: 'none' | 'partial' | 'full'
} => {
  const passEvidence = result.trials.flatMap((trial) => (isTrialPassEvidence(trial.pass) ? [trial.pass] : []))
  const passEvidenceCount = passEvidence.length

  if (passEvidenceCount !== k) {
    if (passEvidenceCount === 0) {
      return {
        comparisonEligible: false,
        passRate: 0,
        passAtK: 0,
        passExpK: 0,
        passEvidenceCount,
        passEvidenceCoverage: 'none',
      }
    }
    return {
      comparisonEligible: false,
      passRate: 0,
      passAtK: 0,
      passExpK: 0,
      passEvidenceCount,
      passEvidenceCoverage: 'partial',
    }
  }

  const passingCount = passEvidence.filter(Boolean).length
  const passRate = passingCount / k
  const passAtK = 1 - (1 - passRate) ** k
  const passExpK = passRate ** k

  return {
    comparisonEligible: true,
    passRate,
    passAtK,
    passExpK,
    passEvidenceCount,
    passEvidenceCoverage: 'full',
  }
}

export const normalizeResearchPromptResult = (result: ResearchPromptResult): NormalizedResearchPromptResult => {
  const parsedResult = ResearchPromptResultSchema.parse(result)
  const k = parsedResult.k ?? parsedResult.trials.length
  const derivedMetrics = derivePromptPassMetrics({ k, result: parsedResult })

  if (!derivedMetrics.comparisonEligible) {
    const { passAtK: _passAtK, passExpK: _passExpK, passRate: _passRate, ...rest } = parsedResult
    return {
      result: ResearchPromptResultSchema.parse({ ...rest, k }),
      comparisonEligible: false,
      passEvidenceCount: derivedMetrics.passEvidenceCount,
      passEvidenceCoverage: derivedMetrics.passEvidenceCoverage,
    }
  }

  return {
    result: ResearchPromptResultSchema.parse({
      ...parsedResult,
      k,
      passRate: derivedMetrics.passRate,
      passAtK: derivedMetrics.passAtK,
      passExpK: derivedMetrics.passExpK,
    }),
    comparisonEligible: true,
    passEvidenceCount: derivedMetrics.passEvidenceCount,
    passEvidenceCoverage: derivedMetrics.passEvidenceCoverage,
  }
}
