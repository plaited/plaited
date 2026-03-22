#!/usr/bin/env bun

import { dirname, join } from 'node:path'
import * as z from 'zod'
import { grade as judgeInclusion } from './modnet-raw-card-inclusion-judge.ts'
import { grade as metaVerifyInclusion } from './modnet-raw-card-inclusion-meta-verifier.ts'

const RawPromptCardSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
})

const InclusionDecisionSchema = z.enum(['retain', 'retain_low_priority', 'discard'])

const InclusionCandidateSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  inclusionDecision: InclusionDecisionSchema,
  modernAnalog: z.string(),
  coreUserJob: z.string(),
  whyRelevant: z.string(),
  likelyPatternFamily: z.string(),
  likelyStructure: z.string(),
  searchQuerySeed: z.string(),
})

const DeterministicCheckSchema = z.object({
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

type RawPromptCard = z.infer<typeof RawPromptCardSchema>
type InclusionCandidate = z.infer<typeof InclusionCandidateSchema>
type DeterministicCheck = z.infer<typeof DeterministicCheckSchema>
type Evaluation = z.infer<typeof EvaluationSchema>

const DEFAULT_SOURCE = join(import.meta.dir, '..', 'dev-research', 'modnet', 'catalog', 'modnet-raw-card-corpus.jsonl')
const DEFAULT_CANDIDATES = join(import.meta.dir, 'modnet-raw-card-inclusion-candidates.jsonl')
const DEFAULT_OUTPUT = join(import.meta.dir, '..', 'tmp', 'modnet-raw-card-inclusion-evals.jsonl')

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

const readJsonl = async <T>(path: string, schema: z.ZodSchema<T>): Promise<T[]> => {
  const text = await Bun.file(path).text()
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => schema.parse(JSON.parse(line)))
}

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

const parseArgs = () => {
  const args = Bun.argv.slice(2)
  let sourcePath = DEFAULT_SOURCE
  let candidatesPath = DEFAULT_CANDIDATES
  let outputPath = DEFAULT_OUTPUT
  let progress = true

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
    if (arg === '--quiet') {
      progress = false
    }
  }

  return { sourcePath, candidatesPath, outputPath, progress }
}

const summarizeDecisions = (evaluations: Evaluation[]) => {
  const counts = new Map<string, number>()
  for (const evaluation of evaluations) {
    counts.set(evaluation.candidate.inclusionDecision, (counts.get(evaluation.candidate.inclusionDecision) ?? 0) + 1)
  }

  return Object.fromEntries(Array.from(counts.entries()).sort((left, right) => right[1] - left[1]))
}

const main = async () => {
  const { sourcePath, candidatesPath, outputPath, progress } = parseArgs()
  const rawCards = await readJsonl(sourcePath, RawPromptCardSchema)
  const candidates = await readJsonl(candidatesPath, InclusionCandidateSchema)
  const sourceMap = new Map(rawCards.map((row) => [row.id, row]))
  const seenIds = new Set<string>()
  const evaluations: Evaluation[] = []

  for (const [index, candidate] of candidates.entries()) {
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

    if (!rawCard || !deterministicCheck.pass) {
      evaluations.push(
        EvaluationSchema.parse({
          candidate,
          rawCard:
            rawCard ??
            RawPromptCardSchema.parse({
              id: candidate.id,
              title: candidate.title,
              description: candidate.description,
            }),
          deterministicCheck,
          recommended: false,
        }),
      )
      continue
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

    evaluations.push(
      EvaluationSchema.parse({
        candidate,
        rawCard,
        deterministicCheck,
        judge,
        metaVerification,
        recommended: judge.pass && metaVerification.pass,
      }),
    )
  }

  const outputDir = dirname(outputPath)
  if (outputDir && outputDir !== '.') {
    await Bun.$`mkdir -p ${outputDir}`.quiet()
  }

  await Bun.write(outputPath, `${evaluations.map((row) => JSON.stringify(row)).join('\n')}\n`)

  console.log(
    JSON.stringify(
      {
        sourcePath,
        candidatesPath,
        outputPath,
        totalCandidates: evaluations.length,
        recommended: evaluations.filter((entry) => entry.recommended).length,
        blockedDeterministically: evaluations.filter((entry) => !entry.deterministicCheck.pass).length,
        decisions: summarizeDecisions(evaluations),
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
