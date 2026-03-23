#!/usr/bin/env bun

import { appendJsonlRow, resetJsonlOutput } from './jsonl-output.ts'
import {
  average,
  computeEffectiveVariantCost,
  confidenceToScore,
  countNormalizedWords,
  DEFAULT_REGENERATION_CANDIDATES_PATH,
  DEFAULT_REGENERATION_EVALS_PATH,
  gradeFromScore,
  loadRegenerationCandidates,
  normalizeWords,
  RegenerationDeterministicCheckSchema,
  type RegenerationVariantCandidate,
  RegenerationVariantCandidateSchema,
  RegenerationVariantEvaluationSchema,
} from './modnet-raw-card-regeneration-base.ts'

const parseArgs = () => {
  const args = Bun.argv.slice(2)
  let candidatesPath = DEFAULT_REGENERATION_CANDIDATES_PATH
  let outputPath = DEFAULT_REGENERATION_EVALS_PATH

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--candidates' && args[index + 1]) {
      candidatesPath = args[index + 1]!
      index += 1
      continue
    }
    if (arg === '--output' && args[index + 1]) {
      outputPath = args[index + 1]!
      index += 1
    }
  }

  return { candidatesPath, outputPath }
}

const hasSourceAnchor = (candidate: RegenerationVariantCandidate): boolean => {
  const sourceAnchors = new Set(
    [
      candidate.rawCard.title,
      candidate.rawCard.description,
      candidate.rawCard.modernAnalog,
      candidate.rawCard.coreUserJob,
      candidate.rawCard.searchQuerySeed,
    ].flatMap((value) => normalizeWords(value).filter((word) => word.length >= 4)),
  )
  const promptAnchors = new Set(
    [candidate.promptDraft.input, candidate.promptDraft.hint].flatMap((value) =>
      normalizeWords(value).filter((word) => word.length >= 4),
    ),
  )
  return Array.from(promptAnchors).some((word) => sourceAnchors.has(word))
}

export const assessRegenerationCandidate = (candidate: RegenerationVariantCandidate) => {
  const hardFailures: string[] = []
  const softWarnings: string[] = []

  const usesRetainedRawCard = Boolean(candidate.rawCard.id && candidate.rawCard.title && candidate.rawCard.description)
  const promptInputHasEnoughDetail = countNormalizedWords(candidate.promptDraft.input) >= 10
  const promptHintHasEnoughDetail = countNormalizedWords(candidate.promptDraft.hint) >= 6
  const enrichedVariantsRequireSearch =
    candidate.variantId === 'base_1'
      ? !candidate.research.usedSearch && candidate.research.searchQuery.length === 0
      : candidate.research.usedSearch &&
        candidate.research.searchQuery.length > 0 &&
        candidate.research.searchSnippetCount > 0
  const variantAvoidsResearchLite = !candidate.research.usedResearchLite
  const followUpSearchIsConditional =
    candidate.variantId === 'base_1'
      ? !candidate.research.usedTargetedFollowUpSearch
      : candidate.variantId === 'base_1_search'
        ? !candidate.research.usedTargetedFollowUpSearch
        : candidate.research.usedTargetedFollowUpSearch
          ? candidate.research.moduleShapeRecoveredFromSearch !== 'clear' &&
            candidate.research.followUpSearchQuery.length > 0
          : !candidate.research.usedLivecrawl
  const livecrawlIsConditional = candidate.research.usedLivecrawl
    ? candidate.variantId === 'base_1_search_followup_livecrawl' &&
      candidate.research.usedTargetedFollowUpSearch &&
      candidate.research.moduleShapeRecoveredFromSearch !== 'clear' &&
      candidate.research.livecrawlReason.length > 0
    : true
  const recoveredModernVocabulary =
    candidate.variantId === 'base_1'
      ? candidate.research.modernWorkflowVocabulary.length === 0
      : candidate.research.modernWorkflowVocabulary.length > 0
  const moduleShapeEscalatesWhenNeeded =
    candidate.variantId !== 'base_1_search_followup_livecrawl'
      ? true
      : candidate.research.moduleShapeRecoveredFromSearch === 'clear'
        ? !candidate.research.usedTargetedFollowUpSearch && !candidate.research.usedLivecrawl
        : candidate.research.usedTargetedFollowUpSearch
  const avoidsHandcraftedCopying = candidate.assessment.handcraftedAnchorMode !== 'copied'

  if (!usesRetainedRawCard) hardFailures.push('missing-retained-raw-card')
  if (!promptInputHasEnoughDetail) hardFailures.push('prompt-input-too-thin')
  if (!promptHintHasEnoughDetail) softWarnings.push('prompt-hint-too-thin')
  if (!enrichedVariantsRequireSearch) hardFailures.push('search-policy-mismatch')
  if (!variantAvoidsResearchLite) hardFailures.push('research-lite-not-allowed')
  if (!followUpSearchIsConditional) hardFailures.push('follow-up-search-not-conditional')
  if (!livecrawlIsConditional) hardFailures.push('livecrawl-not-conditional')
  if (!recoveredModernVocabulary) softWarnings.push('weak-modern-vocabulary')
  if (!moduleShapeEscalatesWhenNeeded) softWarnings.push('deep-variant-did-not-escalate')
  if (!avoidsHandcraftedCopying) hardFailures.push('handcrafted-copying-detected')
  if (!hasSourceAnchor(candidate)) softWarnings.push('weak-source-anchor')

  const checks = {
    usesRetainedRawCard,
    promptInputHasEnoughDetail,
    promptHintHasEnoughDetail,
    enrichedVariantsRequireSearch,
    variantAvoidsResearchLite,
    followUpSearchIsConditional,
    livecrawlIsConditional,
    recoveredModernVocabulary,
    moduleShapeEscalatesWhenNeeded,
    avoidsHandcraftedCopying,
  }

  return RegenerationDeterministicCheckSchema.parse({
    pass: hardFailures.length === 0,
    hardFailures,
    softWarnings,
    checks,
    score: average(Object.values(checks).map((value) => (value ? 1 : 0))),
  })
}

export const evaluateRegenerationCandidate = (candidate: RegenerationVariantCandidate) => {
  const deterministicCheck = assessRegenerationCandidate(candidate)

  const dimensionScores = {
    modernRelevance: {
      score: confidenceToScore(candidate.assessment.modernRelevance),
      reasons: [
        `modern relevance signaled as ${candidate.assessment.modernRelevance}`,
        candidate.research.usedSearch ? 'current vocabulary recovered through search' : 'no search enrichment used',
      ],
    },
    promptQuality: {
      score:
        candidate.assessment.handcraftedAnchorMode === 'copied'
          ? 0.2
          : confidenceToScore(candidate.assessment.promptQuality),
      reasons: [
        `prompt quality signaled as ${candidate.assessment.promptQuality}`,
        `handcrafted anchor mode is ${candidate.assessment.handcraftedAnchorMode}`,
      ],
    },
    mssPlausibility: {
      score: confidenceToScore(candidate.assessment.mssPlausibility),
      reasons: [
        `MSS plausibility signaled as ${candidate.assessment.mssPlausibility}`,
        `module shape recovered from search is ${candidate.research.moduleShapeRecoveredFromSearch}`,
      ],
    },
    seedWorthiness: {
      score: confidenceToScore(candidate.assessment.seedWorthiness),
      reasons: [
        `seed-worthiness signaled as ${candidate.assessment.seedWorthiness}`,
        candidate.research.usedLivecrawl
          ? 'extra retrieval was used only after escalation'
          : 'no default livecrawl cost',
      ],
    },
  }

  const qualityScore = average([
    dimensionScores.modernRelevance.score,
    dimensionScores.promptQuality.score,
    dimensionScores.mssPlausibility.score,
    dimensionScores.seedWorthiness.score,
  ])
  const reliable = deterministicCheck.pass && qualityScore >= 0.72
  const recommended =
    reliable &&
    qualityScore >= 0.78 &&
    dimensionScores.modernRelevance.score >= 0.7 &&
    dimensionScores.mssPlausibility.score >= 0.7

  return RegenerationVariantEvaluationSchema.parse({
    candidate: RegenerationVariantCandidateSchema.parse(candidate),
    deterministicCheck,
    dimensionScores: {
      modernRelevance: {
        grade: gradeFromScore(dimensionScores.modernRelevance.score),
        score: dimensionScores.modernRelevance.score,
        reasons: dimensionScores.modernRelevance.reasons,
      },
      promptQuality: {
        grade: gradeFromScore(dimensionScores.promptQuality.score),
        score: dimensionScores.promptQuality.score,
        reasons: dimensionScores.promptQuality.reasons,
      },
      mssPlausibility: {
        grade: gradeFromScore(dimensionScores.mssPlausibility.score),
        score: dimensionScores.mssPlausibility.score,
        reasons: dimensionScores.mssPlausibility.reasons,
      },
      seedWorthiness: {
        grade: gradeFromScore(dimensionScores.seedWorthiness.score),
        score: dimensionScores.seedWorthiness.score,
        reasons: dimensionScores.seedWorthiness.reasons,
      },
    },
    qualityScore,
    effectiveCost: computeEffectiveVariantCost(candidate),
    reliable,
    recommended,
  })
}

const main = async () => {
  const { candidatesPath, outputPath } = parseArgs()
  const candidates = await loadRegenerationCandidates(candidatesPath)
  await resetJsonlOutput(outputPath)
  let reliable = 0
  let recommended = 0

  for (const candidate of candidates) {
    const evaluation = evaluateRegenerationCandidate(candidate)
    await appendJsonlRow(outputPath, evaluation)
    if (evaluation.reliable) reliable += 1
    if (evaluation.recommended) recommended += 1
  }

  console.log(
    JSON.stringify(
      {
        candidatesPath,
        outputPath,
        totalCandidates: candidates.length,
        reliable,
        recommended,
      },
      null,
      2,
    ),
  )
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  })
}
