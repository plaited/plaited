#!/usr/bin/env bun

import {
  average,
  DEFAULT_REGENERATION_COMPARE_PATH,
  DEFAULT_REGENERATION_EVALS_PATH,
  ensureParentDir,
  loadRegenerationEvaluations,
  REGENERATION_VARIANT_LABELS,
  type RegenerationVariantEvaluation,
  type RegenerationVariantId,
  RegenerationVariantIdSchema,
  VariantComparisonOutputSchema,
  VariantComparisonSummarySchema,
} from './modnet-raw-card-regeneration-base.ts'

const parseArgs = () => {
  const args = Bun.argv.slice(2)
  let inputPath = DEFAULT_REGENERATION_EVALS_PATH
  let outputPath = DEFAULT_REGENERATION_COMPARE_PATH

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--input' && args[index + 1]) {
      inputPath = args[index + 1]!
      index += 1
      continue
    }
    if (arg === '--output' && args[index + 1]) {
      outputPath = args[index + 1]!
      index += 1
    }
  }

  return { inputPath, outputPath }
}

const summarizeVariant = (variantId: RegenerationVariantId, rows: RegenerationVariantEvaluation[]) =>
  VariantComparisonSummarySchema.parse({
    variantId,
    label: REGENERATION_VARIANT_LABELS[variantId],
    totalRows: rows.length,
    reliableRows: rows.filter((row) => row.reliable).length,
    recommendedRows: rows.filter((row) => row.recommended).length,
    reliabilityRate: average(rows.map((row) => (row.reliable ? 1 : 0))),
    recommendationRate: average(rows.map((row) => (row.recommended ? 1 : 0))),
    averageQualityScore: average(rows.map((row) => row.qualityScore)),
    averageEffectiveCost: average(rows.map((row) => row.effectiveCost)) || 1,
    averageDimensionScores: {
      modernRelevance: average(rows.map((row) => row.dimensionScores.modernRelevance.score)),
      promptQuality: average(rows.map((row) => row.dimensionScores.promptQuality.score)),
      mssPlausibility: average(rows.map((row) => row.dimensionScores.mssPlausibility.score)),
      seedWorthiness: average(rows.map((row) => row.dimensionScores.seedWorthiness.score)),
    },
    targetedFollowUpRate: average(rows.map((row) => (row.candidate.research.usedTargetedFollowUpSearch ? 1 : 0))),
    livecrawlRate: average(rows.map((row) => (row.candidate.research.usedLivecrawl ? 1 : 0))),
    eligible:
      rows.length > 0 &&
      average(rows.map((row) => (row.reliable ? 1 : 0))) >= 0.67 &&
      average(rows.map((row) => row.qualityScore)) >= 0.72 &&
      average(rows.map((row) => (row.recommended ? 1 : 0))) >= 0.5,
    selectionScore: Number(
      (
        average(rows.map((row) => row.qualityScore)) * 0.6 +
        average(rows.map((row) => (row.reliable ? 1 : 0))) * 0.25 +
        average(rows.map((row) => (row.recommended ? 1 : 0))) * 0.15 -
        (average(rows.map((row) => row.effectiveCost)) || 1) * 0.08
      ).toFixed(3),
    ),
  })

export const chooseWinningVariant = (summaries: Array<ReturnType<typeof summarizeVariant>>) => {
  const eligible = summaries.filter((summary) => summary.eligible)
  if (eligible.length === 0) {
    return null
  }

  const bestQuality = Math.max(...eligible.map((summary) => summary.averageQualityScore))
  const closeBand = eligible.filter((summary) => bestQuality - summary.averageQualityScore <= 0.05)
  return closeBand.sort((left, right) => {
    if (left.averageDimensionScores.mssPlausibility !== right.averageDimensionScores.mssPlausibility) {
      return right.averageDimensionScores.mssPlausibility - left.averageDimensionScores.mssPlausibility
    }
    if (left.averageDimensionScores.promptQuality !== right.averageDimensionScores.promptQuality) {
      return right.averageDimensionScores.promptQuality - left.averageDimensionScores.promptQuality
    }
    if (left.averageEffectiveCost !== right.averageEffectiveCost) {
      return left.averageEffectiveCost - right.averageEffectiveCost
    }
    return right.selectionScore - left.selectionScore
  })[0]!
}

const main = async () => {
  const { inputPath, outputPath } = parseArgs()
  const evaluations = await loadRegenerationEvaluations(inputPath)
  const summaries = RegenerationVariantIdSchema.options.map((variantId) =>
    summarizeVariant(
      variantId,
      evaluations.filter((row) => row.candidate.variantId === variantId),
    ),
  )
  const winner = chooseWinningVariant(summaries)

  const output = VariantComparisonOutputSchema.parse({
    inputPath,
    outputPath,
    winner: winner
      ? {
          variantId: winner.variantId,
          label: winner.label,
          rationale: `choose the cheapest reliable winner within a 0.05 quality band; ${winner.label} won`,
        }
      : null,
    summaries,
  })

  await ensureParentDir(outputPath)
  await Bun.write(outputPath, `${JSON.stringify(output, null, 2)}\n`)
  console.log(JSON.stringify(output, null, 2))
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  })
}
