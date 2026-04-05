import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { TrialResult } from '../eval/eval.schemas.ts'
import { runTrial } from '../eval/eval.ts'
import type {
  AutoresearchCandidateResult,
  AutoresearchOutput,
  AutoresearchTargetHandler,
  RunAutoresearchConfig,
} from './autoresearch.types.ts'
import {
  buildAutoresearchRunId,
  loadBaselineResults,
  normalizeAutoresearchBudget,
  normalizeAutoresearchPromotion,
  resolveAutoresearchOutputDir,
  summarizeTrialResults,
  writeAutoresearchArtifacts,
} from './autoresearch.utils.ts'
import { factoryTargetHandler } from './targets/factory-target.ts'
import { skillTargetHandler } from './targets/skill-target.ts'

const TARGET_HANDLERS: Record<string, AutoresearchTargetHandler> = {
  skill: skillTargetHandler,
  factory: factoryTargetHandler,
}

const getTargetHandler = (kind: string): AutoresearchTargetHandler => {
  const handler = TARGET_HANDLERS[kind]
  if (!handler) {
    throw new Error(`Unsupported autoresearch target kind: ${kind}`)
  }
  return handler
}

const ensureOutputLayout = async (outputDir: string): Promise<void> => {
  await mkdir(outputDir, { recursive: true })
  await mkdir(join(outputDir, 'candidates'), { recursive: true })
}

const compareCandidateResults = ({
  baselineResults,
  candidateResults,
}: {
  baselineResults: TrialResult[]
  candidateResults: TrialResult[]
}): {
  passRate?: number
  passAtK?: number
  passExpK?: number
} => {
  const baselineSummary = summarizeTrialResults(baselineResults)
  const candidateSummary = summarizeTrialResults(candidateResults)

  return {
    passRate:
      candidateSummary.passRate !== undefined && baselineSummary.passRate !== undefined
        ? candidateSummary.passRate - baselineSummary.passRate
        : undefined,
    passAtK:
      candidateSummary.passAtK !== undefined && baselineSummary.passAtK !== undefined
        ? candidateSummary.passAtK - baselineSummary.passAtK
        : undefined,
    passExpK:
      candidateSummary.passExpK !== undefined && baselineSummary.passExpK !== undefined
        ? candidateSummary.passExpK - baselineSummary.passExpK
        : undefined,
  }
}

/**
 * Runs a bounded autoresearch cycle around eval, observation collection, and
 * candidate validation.
 *
 * @public
 */
export const runAutoresearch = async (config: RunAutoresearchConfig): Promise<AutoresearchOutput> => {
  const {
    adapter,
    baselineResultsPath,
    evidencePaths = [],
    grader,
    outputDir: requestedOutputDir,
    progress = false,
    prompts,
    promotion,
    target,
    workspaceDir,
  } = config

  const budget = normalizeAutoresearchBudget(config.budget)
  const normalizedPromotion = normalizeAutoresearchPromotion(promotion)
  const runId = buildAutoresearchRunId(target)
  const outputDir = resolveAutoresearchOutputDir({
    outputDir: requestedOutputDir,
    runId,
  })
  const handler = getTargetHandler(target.kind)

  await ensureOutputLayout(outputDir)

  const baselineResults =
    (await loadBaselineResults(baselineResultsPath)) ??
    (await runTrial({
      adapter,
      prompts,
      grader,
      workspaceDir,
      concurrency: budget.concurrency,
      progress,
      outputPath: join(outputDir, 'baseline.jsonl'),
    }))

  const baselineSummary = summarizeTrialResults(baselineResults)
  const observations = await handler.collectObservations({
    target,
    evidencePaths,
    baselineResults,
  })
  const proposals = await handler.proposeCandidates({
    target,
    observations,
    outputDir,
    budget,
  })

  const candidates: AutoresearchCandidateResult[] = []

  for (const proposal of proposals) {
    const validation = await handler.validateCandidate({
      target,
      candidate: proposal,
    })

    if (!validation.pass) {
      candidates.push({
        ...proposal,
        validation: 'failed',
      })
      continue
    }

    const candidateResults = await runTrial({
      adapter,
      prompts,
      grader,
      workspaceDir,
      concurrency: budget.concurrency,
      progress,
    })

    candidates.push({
      ...proposal,
      validation: 'passed',
      delta: compareCandidateResults({
        baselineResults,
        candidateResults,
      }),
    })
  }

  const acceptedCandidate = candidates.find(
    (candidate) => candidate.validation === 'passed' && (candidate.delta?.passRate ?? 0) > 0,
  )

  const promotionDecision = acceptedCandidate
    ? {
        decision: 'accepted' as const,
        candidateId: acceptedCandidate.id,
        reasoning: `Candidate ${acceptedCandidate.id} improved passRate over baseline.`,
      }
    : {
        decision: 'deferred' as const,
        reasoning:
          candidates.length === 0
            ? 'No candidates were proposed; retained observations and baseline artifacts only.'
            : 'No validated candidate improved the measured baseline enough to promote.',
      }

  if (acceptedCandidate && normalizedPromotion.mode !== 'none') {
    await handler.applyCandidate({
      target,
      candidate: acceptedCandidate,
      mode: normalizedPromotion.mode,
    })
  }

  const result: AutoresearchOutput = {
    runId,
    target,
    baselineSummary,
    candidates,
    promotion: promotionDecision,
  }

  await writeAutoresearchArtifacts({
    outputDir,
    run: {
      runId,
      target,
      baselineSummary,
    },
    baselineResults,
    observations,
    candidates,
    promotion: promotionDecision,
  })

  return result
}
