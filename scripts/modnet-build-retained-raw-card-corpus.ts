#!/usr/bin/env bun

import { dirname } from 'node:path'
import * as z from 'zod'
import {
  BASE_1_VALIDATION_PLAN,
  type Base1InclusionCandidate,
  type RawPromptCard,
  RetainedRawCardCorpusRowSchema,
} from './modnet-raw-card-base.ts'
import { resolveRepoPath } from './workspace-paths.ts'

const EvaluationRowSchema = z.object({
  candidate: z.record(z.string(), z.unknown()),
  rawCard: z.record(z.string(), z.unknown()),
  judge: z.record(z.string(), z.unknown()).optional(),
  recommended: z.boolean(),
})

type EvaluationRow = z.infer<typeof EvaluationRowSchema>

const DEFAULT_INPUT = resolveRepoPath('tmp', 'modnet-raw-card-inclusion-evals.jsonl')
const DEFAULT_OUTPUT = resolveRepoPath('dev-research', 'modnet', 'catalog', 'modnet-retained-raw-card-corpus.jsonl')

const parseArgs = () => {
  const args = Bun.argv.slice(2)
  let inputPath = DEFAULT_INPUT
  let outputPath = DEFAULT_OUTPUT

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

const toRetainedRow = ({ candidate, rawCard }: { candidate: Base1InclusionCandidate; rawCard: RawPromptCard }) =>
  RetainedRawCardCorpusRowSchema.parse({
    id: rawCard.id,
    title: rawCard.title,
    description: rawCard.description,
    inclusionDecision: candidate.inclusionDecision,
    modernAnalog: candidate.modernAnalog,
    coreUserJob: candidate.coreUserJob,
    whyRelevant: candidate.whyRelevant,
    likelyPatternFamily: candidate.likelyPatternFamily,
    likelyStructure: candidate.likelyStructure,
    searchQuerySeed: candidate.searchQuerySeed,
  })

const getJudgedInclusionDecision = (row: EvaluationRow): Base1InclusionCandidate['inclusionDecision'] => {
  const outcome = row.judge?.outcome
  if (!outcome || typeof outcome !== 'object') {
    return (row.candidate as Base1InclusionCandidate).inclusionDecision
  }
  const inclusionDecision = (outcome as Record<string, unknown>).inclusionDecision
  if (
    inclusionDecision === 'retain' ||
    inclusionDecision === 'retain_low_priority' ||
    inclusionDecision === 'discard'
  ) {
    return inclusionDecision
  }
  return (row.candidate as Base1InclusionCandidate).inclusionDecision
}

const loadEvaluations = async (path: string): Promise<EvaluationRow[]> => {
  const text = await Bun.file(path).text()
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => EvaluationRowSchema.parse(JSON.parse(line)))
}

const main = async () => {
  const { inputPath, outputPath } = parseArgs()
  const evaluations = await loadEvaluations(inputPath)
  const retained = evaluations
    .filter((entry) => entry.recommended)
    .filter((entry) => getJudgedInclusionDecision(entry) !== 'discard')
    .map((entry) =>
      toRetainedRow({
        candidate: {
          ...(entry.candidate as Base1InclusionCandidate),
          inclusionDecision: getJudgedInclusionDecision(entry),
        },
        rawCard: entry.rawCard as RawPromptCard,
      }),
    )

  const outputDir = dirname(outputPath)
  if (outputDir && outputDir !== '.') {
    await Bun.$`mkdir -p ${outputDir}`.quiet()
  }

  await Bun.write(outputPath, `${retained.map((row) => JSON.stringify(row)).join('\n')}\n`)

  console.log(
    JSON.stringify(
      {
        inputPath,
        outputPath,
        totalEvaluations: evaluations.length,
        retainedRows: retained.length,
        validationPlan: BASE_1_VALIDATION_PLAN,
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
