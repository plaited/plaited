#!/usr/bin/env bun

import { dirname, join } from 'node:path'
import * as z from 'zod'
import { grade as judgeReclassification } from './hypercard-reclassification-judge.ts'
import { grade as metaVerifyReclassification } from './hypercard-reclassification-meta-verifier.ts'
import { suggestMinimumScale } from './hypercard-scale-audit.ts'

type PromptRow = {
  id: string
  input: string | string[]
  metadata?: {
    promptSource?: string
    patternFamily?: string
    modernization?: string
  }
  _source?: {
    title?: string
    creator?: string
    description?: string
    source_url?: string
    mss?: {
      contentType?: string
      structure?: string
      mechanics?: string[]
      boundary?: string
      scale?: number
      confidence?: string
    }
  }
}

const DEFAULT_INPUT = join(import.meta.dir, '..', 'dev-research', 'modnet', 'catalog', 'modnet-training-prompts.jsonl')
const DEFAULT_OUTPUT = join(import.meta.dir, '..', 'tmp', 'hypercard-reclassifications.jsonl')

const ReclassificationRecordSchema = z.object({
  id: z.string(),
  title: z.string(),
  current: z.object({
    patternFamily: z.string(),
    mss: z.object({
      contentType: z.string().optional(),
      structure: z.string().optional(),
      mechanics: z.array(z.string()).optional(),
      boundary: z.string().optional(),
      scale: z.number().nullable(),
      confidence: z.string().optional(),
    }),
  }),
  heuristicPrior: z.object({
    suggestedMinimumScale: z.number().int().min(1).max(8),
    reasons: z.array(z.string()),
    scaleLooksUnderstated: z.boolean(),
  }),
  judge: z.record(z.string(), z.unknown()).optional(),
  metaVerification: z.record(z.string(), z.unknown()).optional(),
  trusted: z.boolean(),
  recommendedForSeedReview: z.boolean(),
})

const flattenInput = (value: string | string[]): string => (Array.isArray(value) ? value.join('\n\n') : value)

const parseRows = async (path: string): Promise<PromptRow[]> => {
  const text = await Bun.file(path).text()
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as PromptRow)
}

const parseArgs = () => {
  const args = Bun.argv.slice(2)
  let inputPath = DEFAULT_INPUT
  let outputPath = DEFAULT_OUTPUT
  let limit: number | null = null
  let onlyFlagged = true
  let progress = true
  let concurrency = 3

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
      continue
    }
    if (arg === '--limit' && args[index + 1]) {
      limit = Number(args[index + 1]!)
      index += 1
      continue
    }
    if (arg === '--concurrency' && args[index + 1]) {
      concurrency = Math.max(1, Number(args[index + 1]!))
      index += 1
      continue
    }
    if (arg === '--all-hypercard') {
      onlyFlagged = false
      continue
    }
    if (arg === '--quiet') {
      progress = false
    }
  }

  return { inputPath, outputPath, limit, onlyFlagged, progress, concurrency }
}

const logProgress = ({ enabled, message }: { enabled: boolean; message: string }) => {
  if (!enabled) return
  console.error(`[hypercard-reclassify] ${message}`)
}

const buildTask = (row: PromptRow) =>
  [
    'Reclassify this HyperCard-derived prompt for modnet training.',
    `Title: ${row._source?.title ?? row.id}`,
    `Current pattern family: ${row.metadata?.patternFamily ?? 'unknown'}`,
    `Current scale: ${typeof row._source?.mss?.scale === 'number' ? `S${row._source.mss.scale}` : 'unknown'}`,
  ].join('\n')

const processCandidate = async ({
  row,
  heuristic,
  flagged,
  index,
  total,
  progress,
}: {
  row: PromptRow
  heuristic: ReturnType<typeof suggestMinimumScale>
  flagged: boolean
  index: number
  total: number
  progress: boolean
}) => {
  const currentScale = typeof row._source?.mss?.scale === 'number' ? row._source.mss.scale : null
  const metadata = {
    sourceRecord: {
      id: row.id,
      title: row._source?.title ?? row.id,
      creator: row._source?.creator ?? null,
      description: row._source?.description ?? '',
      sourceUrl: row._source?.source_url ?? null,
      generatedPrompt: flattenInput(row.input),
    },
    currentClassification: {
      patternFamily: row.metadata?.patternFamily ?? 'unknown',
      mss: row._source?.mss ?? {},
    },
    heuristicPrior: {
      suggestedMinimumScale: heuristic.suggestedScale,
      reasons: heuristic.reasons,
      scaleLooksUnderstated: flagged,
      modernization: row.metadata?.modernization ?? null,
    },
  }

  logProgress({
    enabled: progress,
    message: `candidate ${index + 1}/${total}: ${row.id} judge`,
  })
  const judge = await judgeReclassification({
    input: buildTask(row),
    output: flattenInput(row.input),
    metadata,
  })

  let metaVerification: Record<string, unknown> | undefined
  if (judge.pass) {
    logProgress({
      enabled: progress,
      message: `candidate ${index + 1}/${total}: ${row.id} meta-verifier`,
    })
    metaVerification = await metaVerifyReclassification({
      input: buildTask(row),
      output: JSON.stringify(judge, null, 2),
      metadata: {
        ...metadata,
        judgeResult: judge,
      },
    })
  } else {
    logProgress({
      enabled: progress,
      message: `candidate ${index + 1}/${total}: ${row.id} meta-verifier skipped (judge failed)`,
    })
  }

  const judgeOutcome = (judge.outcome ?? {}) as Record<string, unknown>
  const keepForSeedReview = judgeOutcome.keepForSeedReview === true
  const trusted = judge.pass && (metaVerification ? metaVerification.pass === true : false)

  logProgress({
    enabled: progress,
    message: `candidate ${index + 1}/${total}: ${row.id} done trusted=${trusted} seed=${trusted && keepForSeedReview}`,
  })

  return ReclassificationRecordSchema.parse({
    id: row.id,
    title: row._source?.title ?? row.id,
    current: {
      patternFamily: row.metadata?.patternFamily ?? 'unknown',
      mss: {
        contentType: row._source?.mss?.contentType,
        structure: row._source?.mss?.structure,
        mechanics: row._source?.mss?.mechanics,
        boundary: row._source?.mss?.boundary,
        scale: currentScale,
        confidence: row._source?.mss?.confidence,
      },
    },
    heuristicPrior: {
      suggestedMinimumScale: heuristic.suggestedScale,
      reasons: heuristic.reasons,
      scaleLooksUnderstated: flagged,
    },
    judge,
    ...(metaVerification ? { metaVerification } : {}),
    trusted,
    recommendedForSeedReview: trusted && keepForSeedReview,
  })
}

const runConcurrent = async <T, R>({
  items,
  concurrency,
  worker,
}: {
  items: T[]
  concurrency: number
  worker: (item: T, index: number) => Promise<R>
}): Promise<R[]> => {
  const results = new Array<R>(items.length)
  let nextIndex = 0

  const runWorker = async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex
      nextIndex += 1
      results[currentIndex] = await worker(items[currentIndex]!, currentIndex)
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => runWorker())
  await Promise.all(workers)
  return results
}

const main = async () => {
  const { inputPath, outputPath, limit, onlyFlagged, progress, concurrency } = parseArgs()
  logProgress({ enabled: progress, message: `loading catalog from ${inputPath}` })
  const rows = await parseRows(inputPath)
  const hypercardRows = rows.filter((row) => row.metadata?.promptSource === 'hypercard-archive')

  const candidates = hypercardRows
    .map((row) => {
      const heuristic = suggestMinimumScale(row)
      const currentScale = typeof row._source?.mss?.scale === 'number' ? row._source.mss.scale : null
      return {
        row,
        heuristic,
        flagged: currentScale === null ? false : heuristic.suggestedScale > currentScale,
      }
    })
    .filter((entry) => (onlyFlagged ? entry.flagged : true))
    .slice(0, limit ?? Number.POSITIVE_INFINITY)

  logProgress({
    enabled: progress,
    message: `selected ${candidates.length} hypercard candidate(s) from ${hypercardRows.length} total (concurrency=${concurrency})`,
  })
  const records = await runConcurrent({
    items: candidates,
    concurrency,
    worker: (candidate, index) =>
      processCandidate({
        row: candidate.row,
        heuristic: candidate.heuristic,
        flagged: candidate.flagged,
        index,
        total: candidates.length,
        progress,
      }),
  })

  const outputDir = dirname(outputPath)
  if (outputDir && outputDir !== '.') {
    await Bun.$`mkdir -p ${outputDir}`.quiet()
  }

  await Bun.write(outputPath, `${records.map((entry) => JSON.stringify(entry)).join('\n')}\n`)
  logProgress({ enabled: progress, message: `wrote ${records.length} record(s) to ${outputPath}` })

  const trusted = records.filter((entry) => entry.trusted).length
  const seedReview = records.filter((entry) => entry.recommendedForSeedReview).length

  console.log(
    JSON.stringify(
      {
        inputPath,
        outputPath,
        scannedHypercardRows: hypercardRows.length,
        processedCandidates: records.length,
        trusted,
        recommendedForSeedReview: seedReview,
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
