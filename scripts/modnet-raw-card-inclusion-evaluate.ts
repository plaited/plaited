#!/usr/bin/env bun

import { dirname } from 'node:path'
import * as z from 'zod'
import { appendJsonlRow, resetJsonlOutput } from './jsonl-output.ts'
import {
  type Base1InclusionCandidate as InclusionCandidate,
  Base1InclusionCandidateSchema as InclusionCandidateSchema,
  loadJsonlRows,
  type RawPromptCard,
  RawPromptCardSchema,
} from './modnet-raw-card-base.ts'
import { grade as judgeInclusion } from './modnet-raw-card-inclusion-judge.ts'
import { grade as metaVerifyInclusion } from './modnet-raw-card-inclusion-meta-verifier.ts'
import { resolveRepoPath } from './workspace-paths.ts'

export const DeterministicCheckSchema = z.object({
  pass: z.boolean(),
  hardFailures: z.array(z.string()),
  softWarnings: z.array(z.string()),
  checks: z.object({
    sourceExists: z.boolean(),
    idIsUnique: z.boolean(),
    titleHasEnoughDetail: z.boolean(),
    descriptionHasEnoughDetail: z.boolean(),
    candidateMatchesSourceText: z.boolean(),
    retainedRowsHaveSearchSeed: z.boolean(),
    avoidsGenericModernAnalog: z.boolean(),
  }),
  score: z.number().min(0).max(1),
})

const EvaluationSchema = z.object({
  candidate: InclusionCandidateSchema,
  rawCard: RawPromptCardSchema,
  deterministicCheck: DeterministicCheckSchema,
  judge: z.record(z.string(), z.unknown()).optional(),
  metaVerification: z.record(z.string(), z.unknown()).optional(),
  recommended: z.boolean(),
})

type DeterministicCheck = z.infer<typeof DeterministicCheckSchema>
type Evaluation = z.infer<typeof EvaluationSchema>

const DEFAULT_SOURCE = resolveRepoPath('dev-research', 'modnet', 'catalog', 'modnet-raw-card-corpus.jsonl')
const DEFAULT_CANDIDATES = resolveRepoPath('scripts', 'modnet-raw-card-inclusion-candidates.jsonl')
const DEFAULT_OUTPUT = resolveRepoPath('tmp', 'modnet-raw-card-inclusion-evals.jsonl')

const GENERIC_ANALOG_PATTERNS = [
  'private organizer on my phone',
  'keeps everything in one place',
  'lets me share only when i choose',
  'private reference organizer',
]

const normalizeWord = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

const buildLexicalAnchorSet = (rawCard: RawPromptCard): Set<string> =>
  new Set(
    normalizeWord(`${rawCard.title} ${rawCard.description}`)
      .split(/\s+/)
      .filter((token) => token.length >= 4),
  )

export const assessInclusionCandidate = ({
  candidate,
  rawCard,
  seenIds,
}: {
  candidate: InclusionCandidate
  rawCard?: RawPromptCard
  seenIds: Set<string>
}): DeterministicCheck => {
  const hardFailures: string[] = []
  const softWarnings: string[] = []

  const sourceExists = Boolean(rawCard)
  if (!sourceExists) {
    hardFailures.push(`missing-source:${candidate.id}`)
  }

  const idIsUnique = !seenIds.has(candidate.id)
  if (!idIsUnique) {
    hardFailures.push(`duplicate-id:${candidate.id}`)
  }

  const titleHasEnoughDetail = normalizeWord(candidate.title).split(/\s+/).filter(Boolean).length >= 2
  if (!titleHasEnoughDetail) {
    hardFailures.push('title-too-short')
  }

  const descriptionHasEnoughDetail = normalizeWord(candidate.description).split(/\s+/).filter(Boolean).length >= 6
  if (!descriptionHasEnoughDetail) {
    hardFailures.push('description-too-short')
  }

  const sourceAnchors = rawCard ? buildLexicalAnchorSet(rawCard) : new Set<string>()
  const candidateAnchors = new Set(
    normalizeWord(`${candidate.modernAnalog} ${candidate.coreUserJob} ${candidate.whyRelevant}`)
      .split(/\s+/)
      .filter((token) => token.length >= 4),
  )
  const candidateMatchesSourceText = Array.from(candidateAnchors).some((token) => sourceAnchors.has(token))
  if (sourceExists && !candidateMatchesSourceText) {
    softWarnings.push('weak-source-anchor')
  }

  const retainedRowsHaveSearchSeed =
    candidate.inclusionDecision === 'discard' ||
    normalizeWord(candidate.searchQuerySeed).split(/\s+/).filter(Boolean).length >= 3
  if (!retainedRowsHaveSearchSeed) {
    hardFailures.push('missing-search-query-seed')
  }

  const combinedAnalog = normalizeWord(candidate.modernAnalog)
  const avoidsGenericModernAnalog = !GENERIC_ANALOG_PATTERNS.some((pattern) =>
    combinedAnalog.includes(normalizeWord(pattern)),
  )
  if (!avoidsGenericModernAnalog) {
    softWarnings.push('generic-modern-analog')
  }

  const passedChecks = [
    sourceExists,
    idIsUnique,
    titleHasEnoughDetail,
    descriptionHasEnoughDetail,
    candidateMatchesSourceText,
    retainedRowsHaveSearchSeed,
    avoidsGenericModernAnalog,
  ].filter(Boolean).length

  return DeterministicCheckSchema.parse({
    pass: hardFailures.length === 0,
    hardFailures,
    softWarnings,
    checks: {
      sourceExists,
      idIsUnique,
      titleHasEnoughDetail,
      descriptionHasEnoughDetail,
      candidateMatchesSourceText,
      retainedRowsHaveSearchSeed,
      avoidsGenericModernAnalog,
    },
    score: Number((passedChecks / 7).toFixed(3)),
  })
}

const createTaskDescription = (candidate: InclusionCandidate) =>
  [
    'Evaluate whether this raw-card inclusion result is trustworthy enough to keep in the modnet prompt pipeline.',
    `Card id: ${candidate.id}`,
    `Inclusion decision: ${candidate.inclusionDecision}`,
  ].join('\n')

const logProgress = ({ enabled, message }: { enabled: boolean; message: string }) => {
  if (enabled) {
    console.error(`[modnet-raw-inclusion] ${message}`)
  }
}

const toSummaryPath = (outputPath: string) => `${outputPath}.summary.json`

const parseArgs = () => {
  const args = Bun.argv.slice(2)
  let sourcePath = DEFAULT_SOURCE
  let candidatesPath = DEFAULT_CANDIDATES
  let outputPath = DEFAULT_OUTPUT
  let progress = true
  let concurrency = 5

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--source' && args[index + 1]) {
      sourcePath = args[index + 1]!
      index += 1
      continue
    }
    if (arg === '--candidates' && args[index + 1]) {
      candidatesPath = args[index + 1]!
      index += 1
      continue
    }
    if (arg === '--output' && args[index + 1]) {
      outputPath = args[index + 1]!
      index += 1
      continue
    }
    if (arg === '--concurrency' && args[index + 1]) {
      concurrency = Math.max(1, Number(args[index + 1]!))
      index += 1
      continue
    }
    if (arg === '--quiet') {
      progress = false
    }
  }

  return { sourcePath, candidatesPath, outputPath, progress, concurrency }
}

const getNestedNumber = (value: unknown, key: string): number | undefined => {
  if (!value || typeof value !== 'object') return undefined
  const nested = (value as Record<string, unknown>)[key]
  return typeof nested === 'number' ? nested : undefined
}

const getCostUsd = (value: unknown, path: 'judgeSdk' | 'metaVerificationSdk'): number => {
  if (!value || typeof value !== 'object') return 0
  const outcome = (value as Record<string, unknown>).outcome
  if (!outcome || typeof outcome !== 'object') return 0
  return getNestedNumber((outcome as Record<string, unknown>)[path], 'totalCostUsd') ?? 0
}

const getJudgedInclusionDecision = (judge: unknown): InclusionCandidate['inclusionDecision'] | undefined => {
  if (!judge || typeof judge !== 'object') return undefined
  const outcome = (judge as Record<string, unknown>).outcome
  if (!outcome || typeof outcome !== 'object') return undefined
  const inclusionDecision = (outcome as Record<string, unknown>).inclusionDecision
  if (
    inclusionDecision === 'retain' ||
    inclusionDecision === 'retain_low_priority' ||
    inclusionDecision === 'discard'
  ) {
    return inclusionDecision
  }
  return undefined
}

const runConcurrent = async <T>({
  items,
  concurrency,
  worker,
}: {
  items: T[]
  concurrency: number
  worker: (item: T, index: number) => Promise<void>
}): Promise<void> => {
  let nextIndex = 0

  const runWorker = async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex
      nextIndex += 1
      await worker(items[currentIndex]!, currentIndex)
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => runWorker()))
}

const main = async () => {
  const { sourcePath, candidatesPath, outputPath, progress, concurrency } = parseArgs()
  const outputDir = dirname(outputPath)
  if (outputDir && outputDir !== '.') {
    await Bun.$`mkdir -p ${outputDir}`.quiet()
  }
  const rawCards = await loadJsonlRows(sourcePath, RawPromptCardSchema)
  const candidates = await loadJsonlRows(candidatesPath, InclusionCandidateSchema)
  await resetJsonlOutput(outputPath)
  const summaryPath = toSummaryPath(outputPath)

  const sourceMap = new Map(rawCards.map((row) => [row.id, row]))
  const seenIds = new Set<string>()
  const prechecked = candidates.map((candidate, index) => {
    logProgress({
      enabled: progress,
      message: `candidate ${index + 1}/${candidates.length}: ${candidate.id} precheck`,
    })

    const rawCard = sourceMap.get(candidate.id)
    const deterministicCheck = assessInclusionCandidate({
      candidate,
      rawCard,
      seenIds,
    })
    seenIds.add(candidate.id)
    return {
      candidate,
      rawCard:
        rawCard ??
        RawPromptCardSchema.parse({
          id: candidate.id,
          title: candidate.title,
          description: candidate.description,
        }),
      deterministicCheck,
    }
  })

  const decisions = new Map<string, number>()
  let totalCandidates = 0
  let recommendedCount = 0
  let blockedDeterministically = 0
  let judgeSpendUsd = 0
  let metaVerifierSpendUsd = 0
  let writeQueue = Promise.resolve()
  const startedAt = new Date().toISOString()

  const writeSummary = async () => {
    const summary = {
      sourcePath,
      candidatesPath,
      outputPath,
      summaryPath,
      totalRows: candidates.length,
      completed: totalCandidates,
      recommended: recommendedCount,
      blockedDeterministically,
      decisions: Object.fromEntries(Array.from(decisions.entries()).sort((left, right) => right[1] - left[1])),
      spendUsd: {
        judge: Number(judgeSpendUsd.toFixed(6)),
        metaVerifier: Number(metaVerifierSpendUsd.toFixed(6)),
        total: Number((judgeSpendUsd + metaVerifierSpendUsd).toFixed(6)),
      },
      startedAt,
      updatedAt: new Date().toISOString(),
    }

    await Bun.write(summaryPath, `${JSON.stringify(summary, null, 2)}\n`)
  }

  await writeSummary()

  await runConcurrent({
    items: prechecked,
    concurrency,
    worker: async ({ candidate, rawCard, deterministicCheck }, index) => {
      const finalizeEvaluation = async (evaluation: Evaluation): Promise<void> => {
        totalCandidates += 1
        if (evaluation.recommended) recommendedCount += 1
        if (!evaluation.deterministicCheck.pass) blockedDeterministically += 1
        decisions.set(
          evaluation.candidate.inclusionDecision,
          (decisions.get(evaluation.candidate.inclusionDecision) ?? 0) + 1,
        )
        judgeSpendUsd += getCostUsd(evaluation.judge, 'judgeSdk')
        metaVerifierSpendUsd += getCostUsd(evaluation.metaVerification, 'metaVerificationSdk')
        writeQueue = writeQueue.then(async () => {
          await appendJsonlRow(outputPath, evaluation)
          await writeSummary()
        })
        await writeQueue
      }

      if (!sourceMap.get(candidate.id) || !deterministicCheck.pass) {
        await finalizeEvaluation(
          EvaluationSchema.parse({
            candidate,
            rawCard,
            deterministicCheck,
            recommended: false,
          }),
        )
        return
      }

      const task = createTaskDescription(candidate)
      const metadata = {
        rawCard,
        deterministicCheck,
      }

      logProgress({
        enabled: progress,
        message: `candidate ${index + 1}/${candidates.length}: ${candidate.id} judge`,
      })
      const judge = await judgeInclusion({
        input: task,
        output: JSON.stringify(candidate, null, 2),
        metadata,
      })
      logProgress({
        enabled: progress,
        message: `candidate ${index + 1}/${candidates.length}: ${candidate.id} meta-verifier`,
      })
      const metaVerification = await metaVerifyInclusion({
        input: task,
        output: JSON.stringify(judge, null, 2),
        metadata: {
          ...metadata,
          judgeResult: judge,
        },
      })

      await finalizeEvaluation(
        EvaluationSchema.parse({
          candidate,
          rawCard,
          deterministicCheck,
          judge,
          metaVerification,
          recommended:
            metaVerification.pass && (getJudgedInclusionDecision(judge) ?? candidate.inclusionDecision) !== 'discard',
        }),
      )
      return
    },
  })
  console.log(
    JSON.stringify(
      {
        sourcePath,
        candidatesPath,
        outputPath,
        summaryPath,
        totalCandidates,
        recommended: recommendedCount,
        blockedDeterministically,
        decisions: Object.fromEntries(Array.from(decisions.entries()).sort((left, right) => right[1] - left[1])),
        spendUsd: {
          judge: Number(judgeSpendUsd.toFixed(6)),
          metaVerifier: Number(metaVerifierSpendUsd.toFixed(6)),
          total: Number((judgeSpendUsd + metaVerifierSpendUsd).toFixed(6)),
        },
        startedAt,
        updatedAt: new Date().toISOString(),
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
