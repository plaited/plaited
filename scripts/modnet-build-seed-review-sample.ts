#!/usr/bin/env bun

import { appendJsonlRow, resetJsonlOutput } from './jsonl-output.ts'

type RegenerationEvalRow = {
  candidate: {
    rawCard: {
      id: string
      title: string
      description: string
      modernAnalog: string
      likelyPatternFamily: string
      likelyStructure: string
    }
    promptDraft: {
      input: string
      hint: string
      metadata?: Record<string, unknown>
    }
  }
  recommended: boolean
  qualityScore: number
}

type SeedReviewPromptRow = {
  id: string
  input: string[]
  metadata: {
    promptSource: 'hypercard-archive'
    patternFamily: string
    modernization: string
    seedReviewProvenance: 'trusted' | 'iffy'
    regenerationQualityScore: number
  }
  _source: {
    title: string
    description: string
    modernAnalog: string
    mss: {
      scale: number | null
      structure: string
      confidence: 'medium' | 'high'
    }
  }
}

const DEFAULT_TRUSTED_EVALS = '/tmp/modnet-raw-card-regeneration-evals.trusted.full.minimax.jsonl'
const DEFAULT_IFFY_EVALS = '/tmp/modnet-raw-card-regeneration-evals.iffy.full.minimax.jsonl'
const DEFAULT_OUTPUT = '/tmp/modnet-seed-review-sample.jsonl'

const parseArgs = () => {
  const args = Bun.argv.slice(2)
  let trustedPath = DEFAULT_TRUSTED_EVALS
  let iffyPath = DEFAULT_IFFY_EVALS
  let outputPath = DEFAULT_OUTPUT
  let limit = 100
  let trustedTarget = 70
  let iffyTarget = 30

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--trusted' && args[index + 1]) {
      trustedPath = args[index + 1]!
      index += 1
      continue
    }
    if (arg === '--iffy' && args[index + 1]) {
      iffyPath = args[index + 1]!
      index += 1
      continue
    }
    if (arg === '--output' && args[index + 1]) {
      outputPath = args[index + 1]!
      index += 1
      continue
    }
    if (arg === '--limit' && args[index + 1]) {
      limit = Math.max(1, Number(args[index + 1]!))
      index += 1
      continue
    }
    if (arg === '--trusted-target' && args[index + 1]) {
      trustedTarget = Math.max(0, Number(args[index + 1]!))
      index += 1
      continue
    }
    if (arg === '--iffy-target' && args[index + 1]) {
      iffyTarget = Math.max(0, Number(args[index + 1]!))
      index += 1
    }
  }

  return { trustedPath, iffyPath, outputPath, limit, trustedTarget, iffyTarget }
}

const readJsonl = async (path: string): Promise<RegenerationEvalRow[]> => {
  const text = await Bun.file(path).text()
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as RegenerationEvalRow)
}

const scaleToNumber = (value: unknown): number | null => {
  if (typeof value !== 'string') return null
  const match = value.match(/^S([1-8])$/)
  return match ? Number(match[1]) : null
}

const toPromptRow = (row: RegenerationEvalRow, provenance: 'trusted' | 'iffy'): SeedReviewPromptRow => {
  const metadata = row.candidate.promptDraft.metadata ?? {}
  const structure =
    typeof metadata.structureCue === 'string' && metadata.structureCue.trim().length > 0
      ? metadata.structureCue
      : row.candidate.rawCard.likelyStructure

  return {
    id: row.candidate.rawCard.id,
    input: [row.candidate.promptDraft.input, row.candidate.promptDraft.hint],
    metadata: {
      promptSource: 'hypercard-archive',
      patternFamily: row.candidate.rawCard.likelyPatternFamily,
      modernization: row.candidate.rawCard.modernAnalog,
      seedReviewProvenance: provenance,
      regenerationQualityScore: row.qualityScore,
    },
    _source: {
      title: row.candidate.rawCard.title,
      description: row.candidate.rawCard.description,
      modernAnalog: row.candidate.rawCard.modernAnalog,
      mss: {
        scale: scaleToNumber(metadata.scale),
        structure,
        confidence: row.qualityScore >= 0.9 ? 'high' : 'medium',
      },
    },
  }
}

const sortRecommended = (rows: RegenerationEvalRow[]) =>
  rows
    .filter((row) => row.recommended)
    .sort(
      (left, right) =>
        right.qualityScore - left.qualityScore || left.candidate.rawCard.id.localeCompare(right.candidate.rawCard.id),
    )

const main = async () => {
  const { trustedPath, iffyPath, outputPath, limit, trustedTarget, iffyTarget } = parseArgs()
  const trustedRows = sortRecommended(await readJsonl(trustedPath))
  const iffyRows = sortRecommended(await readJsonl(iffyPath))

  const trustedSelected = trustedRows.slice(0, trustedTarget)
  const iffySelected = iffyRows.slice(0, iffyTarget)
  const combined = [
    ...trustedSelected.map((row) => toPromptRow(row, 'trusted')),
    ...iffySelected.map((row) => toPromptRow(row, 'iffy')),
  ].slice(0, limit)

  await resetJsonlOutput(outputPath)
  for (const row of combined) {
    await appendJsonlRow(outputPath, row)
  }

  console.log(
    JSON.stringify(
      {
        trustedPath,
        iffyPath,
        outputPath,
        totalRows: combined.length,
        trustedRows: combined.filter((row) => row.metadata.seedReviewProvenance === 'trusted').length,
        iffyRows: combined.filter((row) => row.metadata.seedReviewProvenance === 'iffy').length,
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
