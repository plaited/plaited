#!/usr/bin/env bun

import { dirname } from 'node:path'
import {
  ModnetJudgeAblationReportSchema,
  type ModnetJudgeAblationRow,
  ModnetJudgeAblationRowSchema,
  type ModnetJudgeAblationSummary,
} from './modnet-judge-ablation.schemas.ts'

const DEFAULT_INPUT_PATH = '/tmp/modnet-judge-ablation.jsonl'
const DEFAULT_OUTPUT_PATH = '/tmp/modnet-judge-ablation-report.json'

const parseArgs = (args: string[]) => {
  let inputPath = DEFAULT_INPUT_PATH
  let outputPath = DEFAULT_OUTPUT_PATH

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

const average = (values: number[]): number =>
  values.length === 0 ? 0 : Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(3))

export const summarizeAblationRows = (rows: ModnetJudgeAblationRow[]): ModnetJudgeAblationSummary[] => {
  const labels = Array.from(new Set(rows.map((row) => row.label)))

  return labels
    .map((label) => {
      const bucket = rows.filter((row) => row.label === label)
      const pair = bucket[0]!.pair
      const expectedRows = bucket.filter((row) => row.heldout.expectation)
      const agreementCount = expectedRows.filter(
        (row) => row.heldout.expectation?.recommended === row.recommended,
      ).length

      return {
        label,
        pair,
        totalRows: bucket.length,
        recommendedRows: bucket.filter((row) => row.recommended).length,
        judgePassRows: bucket.filter((row) => row.judgeResult.pass).length,
        metaPassRows: bucket.filter((row) => row.metaResult?.pass === true).length,
        recommendationRate: average(bucket.map((row) => (row.recommended ? 1 : 0))),
        judgePassRate: average(bucket.map((row) => (row.judgeResult.pass ? 1 : 0))),
        metaPassRate: average(bucket.map((row) => (row.metaResult?.pass === true ? 1 : 0))),
        averageJudgeScore: average(bucket.map((row) => row.judgeResult.score)),
        averageMetaScore: average(bucket.map((row) => row.metaResult?.score ?? 0)),
        totalSpendUsd: Number(bucket.reduce((sum, row) => sum + row.spendUsd.total, 0).toFixed(6)),
        averageSpendUsd: average(bucket.map((row) => row.spendUsd.total)),
        agreementWithExpectationRate: expectedRows.length > 0 ? average([agreementCount / expectedRows.length]) : null,
      } satisfies ModnetJudgeAblationSummary
    })
    .sort((left, right) => right.recommendationRate - left.recommendationRate)
}

const ensureParentDir = async (path: string) => {
  const parent = dirname(path)
  if (parent && parent !== '.') {
    await Bun.$`mkdir -p ${parent}`.quiet()
  }
}

const loadRows = async (path: string): Promise<ModnetJudgeAblationRow[]> => {
  const text = await Bun.file(path).text()
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => ModnetJudgeAblationRowSchema.parse(JSON.parse(line)))
}

const main = async () => {
  const { inputPath, outputPath } = parseArgs(Bun.argv.slice(2))
  const rows = await loadRows(inputPath)
  const report = ModnetJudgeAblationReportSchema.parse({
    inputPath,
    outputPath,
    generatedAt: new Date().toISOString(),
    totalRows: rows.length,
    summaries: summarizeAblationRows(rows),
  })

  await ensureParentDir(outputPath)
  await Bun.write(outputPath, `${JSON.stringify(report, null, 2)}\n`)
  console.log(JSON.stringify(report, null, 2))
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  })
}
