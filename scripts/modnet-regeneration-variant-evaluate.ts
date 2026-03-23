#!/usr/bin/env bun

import {
  DEFAULT_REGENERATION_CANDIDATES_PATH,
  DEFAULT_REGENERATION_COMPARE_PATH,
  ensureParentDir,
  loadRegenerationCandidates,
  VariantComparisonOutputSchema,
} from './modnet-raw-card-regeneration-base.ts'
import { chooseWinningVariant } from './modnet-raw-card-regeneration-compare.ts'
import { evaluateRegenerationCandidate } from './modnet-raw-card-regeneration-evaluate.ts'

const parseArgs = () => {
  const args = Bun.argv.slice(2)
  let candidatesPath = DEFAULT_REGENERATION_CANDIDATES_PATH
  let outputPath = DEFAULT_REGENERATION_COMPARE_PATH

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

const main = async () => {
  const { candidatesPath, outputPath } = parseArgs()
  const candidates = await loadRegenerationCandidates(candidatesPath)
  const evalOutputPath = outputPath.replace(/\.json$/u, '.evals.jsonl')
  const evaluations = candidates.map(evaluateRegenerationCandidate)

  await ensureParentDir(evalOutputPath)
  await Bun.write(evalOutputPath, `${evaluations.map((row) => JSON.stringify(row)).join('\n')}\n`)

  const summaries = Array.from(new Set(evaluations.map((row) => row.candidate.variantId))).map((variantId) => {
    const rows = evaluations.filter((row) => row.candidate.variantId === variantId)
    const average = (values: number[]) =>
      values.length === 0 ? 0 : Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(3))

    return {
      variantId,
      label:
        variantId === 'base_1'
          ? 'Base 1'
          : variantId === 'base_1_search'
            ? 'Base 1 + Search'
            : 'Base 1 + Search -> targeted follow-up search + conditional livecrawl',
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
    }
  })

  const winner = chooseWinningVariant(summaries)
  const output = VariantComparisonOutputSchema.parse({
    inputPath: candidatesPath,
    outputPath,
    winner: winner
      ? {
          variantId: winner.variantId,
          label: winner.label,
          rationale: `winner selected from ${summaries.length} variant summaries using cheapest-reliable policy`,
        }
      : null,
    summaries,
  })

  await ensureParentDir(outputPath)
  await Bun.write(outputPath, `${JSON.stringify(output, null, 2)}\n`)
  console.log(JSON.stringify({ output, evalOutputPath }, null, 2))
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  })
}
