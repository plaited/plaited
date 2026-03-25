#!/usr/bin/env bun

import { join } from 'node:path'

type ClassifiedRow = {
  id: string
  title?: string
  current?: {
    patternFamily?: string | null
    mss?: {
      structure?: string | null
      scale?: number | null
      confidence?: string | null
    }
  }
  heuristicPrior?: {
    suggestedMinimumScale?: number | null
    scaleLooksUnderstated?: boolean
    reasons?: string[]
  }
  trusted?: boolean
  recommendedForSeedReview?: boolean
}

type CandidateRow = {
  rawCard: {
    id: string
    title?: string
    description?: string
    coreUserJob?: string | null
    whyRelevant?: string | null
    likelyPatternFamily?: string | null
    likelyStructure?: string | null
  }
  promptDraft: {
    id?: string
    input: string | string[]
    hint?: string | null
    metadata?: {
      modernTitle?: string | null
      likelyPatternFamily?: string | null
      structureCue?: string | null
      scale?: string | null
      likelySubmodules?: string[] | null
      [key: string]: unknown
    }
  }
  research?: {
    searchQuery?: string | null
    followUpSearchQuery?: string | null
    usedSearch?: boolean
    usedTargetedFollowUpSearch?: boolean
    usedLivecrawl?: boolean
    [key: string]: unknown
  }
  assessment?: Record<string, unknown>
}

type HandcraftedRow = {
  id: string
  input: string | string[]
  hint?: string | null
  metadata?: Record<string, unknown>
}

type ParentPromptRow = {
  id: string
  input: string | string[]
  hint?: string | null
  title?: string
  description?: string
  coreUserJob?: string | null
  whyRelevant?: string | null
  likelyPatternFamily?: string | null
  likelyStructure?: string | null
  metadata?: Record<string, unknown>
  _source?: {
    title?: string
    description?: string
    coreUserJob?: string | null
    whyRelevant?: string | null
    mss?: {
      structure?: string | null
      scale?: number | null
      confidence?: string | null
    }
  }
}

type CliInput = {
  recommendedPath: string
  salvagePath: string
  trustedCandidatesPath: string
  iffyCandidatesPath: string
  handcraftedPath: string
  outputPath: string
  summaryPath: string
  minApprovedScale: number
  includeSalvage: boolean
}

const DEFAULT_RECOMMENDED = join(
  import.meta.dir,
  '..',
  'dev-research',
  'modnet',
  'catalog',
  'modnet-seed-review-classified.recommended.slice22.jsonl',
)
const DEFAULT_SALVAGE = join(
  import.meta.dir,
  '..',
  'dev-research',
  'modnet',
  'catalog',
  'modnet-seed-review-classified.salvage.slice22.jsonl',
)
const DEFAULT_TRUSTED_CANDIDATES = '/tmp/modnet-raw-card-regeneration-candidates.trusted.full.minimax.jsonl'
const DEFAULT_IFFY_CANDIDATES = '/tmp/modnet-raw-card-regeneration-candidates.iffy.full.minimax.jsonl'
const DEFAULT_HANDCRAFTED = join(
  import.meta.dir,
  '..',
  'dev-research',
  'modnet',
  'catalog',
  'modnet-training-prompts-handcrafted.jsonl',
)
const DEFAULT_OUTPUT = '/tmp/modnet-derivation-parent-pool.slice16.jsonl'

const HANDCRAFTED_PARENT_IDS = new Set([
  'farm-stand-s5-module',
  'work-table',
  'work-meeting-room',
  'home-living-room',
  'home-house',
])

const parseArgs = (): CliInput => {
  const args = Bun.argv.slice(2)
  let recommendedPath = DEFAULT_RECOMMENDED
  let salvagePath = DEFAULT_SALVAGE
  let trustedCandidatesPath = DEFAULT_TRUSTED_CANDIDATES
  let iffyCandidatesPath = DEFAULT_IFFY_CANDIDATES
  let handcraftedPath = DEFAULT_HANDCRAFTED
  let outputPath = DEFAULT_OUTPUT
  let minApprovedScale = 2
  let includeSalvage = true

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--recommended' && args[index + 1]) {
      recommendedPath = args[index + 1]!
      index += 1
      continue
    }
    if (arg === '--salvage' && args[index + 1]) {
      salvagePath = args[index + 1]!
      index += 1
      continue
    }
    if (arg === '--trusted-candidates' && args[index + 1]) {
      trustedCandidatesPath = args[index + 1]!
      index += 1
      continue
    }
    if (arg === '--iffy-candidates' && args[index + 1]) {
      iffyCandidatesPath = args[index + 1]!
      index += 1
      continue
    }
    if (arg === '--handcrafted' && args[index + 1]) {
      handcraftedPath = args[index + 1]!
      index += 1
      continue
    }
    if (arg === '--output' && args[index + 1]) {
      outputPath = args[index + 1]!
      index += 1
      continue
    }
    if (arg === '--min-approved-scale' && args[index + 1]) {
      minApprovedScale = Math.max(1, Math.min(8, Number(args[index + 1]!)))
      index += 1
      continue
    }
    if (arg === '--recommended-only') {
      includeSalvage = false
    }
  }

  return {
    recommendedPath,
    salvagePath,
    trustedCandidatesPath,
    iffyCandidatesPath,
    handcraftedPath,
    outputPath,
    summaryPath: `${outputPath}.summary.json`,
    minApprovedScale,
    includeSalvage,
  }
}

const readJsonl = async <T>(path: string): Promise<T[]> => {
  const text = await Bun.file(path).text()
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T)
}

const parseScaleLabel = (value: string | null | undefined): number | null => {
  if (!value) return null
  const match = /(?:^|[^\w])S([1-8])(?:[^\w]|$)/i.exec(value)
  return match ? Number(match[1]!) : null
}

const currentScale = (row: ClassifiedRow): number | null => {
  const classified = row.current?.mss?.scale
  return typeof classified === 'number' && Number.isFinite(classified) ? classified : null
}

const buildCandidateMap = (rows: CandidateRow[]): Map<string, CandidateRow> =>
  new Map(rows.map((row) => [row.rawCard.id, row]))

const buildParentRow = ({
  classified,
  candidate,
  provenance,
}: {
  classified: ClassifiedRow
  candidate: CandidateRow
  provenance: 'recommended' | 'salvage'
}): ParentPromptRow => {
  const classifiedScale = currentScale(classified)
  const generatedScale = candidate.promptDraft.metadata?.scale ?? null
  const generatedScaleValue = parseScaleLabel(generatedScale)
  const sourceScaleEstimate = classified.heuristicPrior?.suggestedMinimumScale ?? classifiedScale ?? null

  return {
    id: classified.id,
    input: candidate.promptDraft.input,
    hint: candidate.promptDraft.hint ?? null,
    title: candidate.promptDraft.metadata?.modernTitle ?? classified.title ?? candidate.rawCard.title ?? classified.id,
    description: candidate.rawCard.description ?? '',
    coreUserJob: candidate.rawCard.coreUserJob ?? null,
    whyRelevant: candidate.rawCard.whyRelevant ?? null,
    likelyPatternFamily:
      classified.current?.patternFamily ??
      candidate.promptDraft.metadata?.likelyPatternFamily ??
      candidate.rawCard.likelyPatternFamily ??
      null,
    likelyStructure: classified.current?.mss?.structure ?? candidate.rawCard.likelyStructure ?? null,
    metadata: {
      patternFamily:
        classified.current?.patternFamily ??
        candidate.promptDraft.metadata?.likelyPatternFamily ??
        candidate.rawCard.likelyPatternFamily ??
        null,
      sourceLikelyPatternFamily: candidate.rawCard.likelyPatternFamily ?? null,
      sourceLikelyStructure: candidate.rawCard.likelyStructure ?? null,
      generatedModernTitle: candidate.promptDraft.metadata?.modernTitle ?? null,
      generatedPromptInput:
        typeof candidate.promptDraft.input === 'string'
          ? candidate.promptDraft.input
          : candidate.promptDraft.input.join(' '),
      generatedPromptHint: candidate.promptDraft.hint ?? null,
      generatedScale,
      generatedScaleValue,
      generatedScaleLabel: generatedScale,
      sourceScaleEstimate,
      sourceScaleEstimateLabel: sourceScaleEstimate === null ? null : `S${sourceScaleEstimate}`,
      generatedLikelyPatternFamily: candidate.promptDraft.metadata?.likelyPatternFamily ?? null,
      generatedLikelyStructure:
        candidate.promptDraft.metadata?.structureCue ??
        classified.current?.mss?.structure ??
        candidate.rawCard.likelyStructure ??
        null,
      provenance,
      trusted: classified.trusted ?? false,
      recommendedForSeedReview: classified.recommendedForSeedReview ?? false,
      seedReviewCurrentScale: classifiedScale,
      seedReviewCurrentStructure: classified.current?.mss?.structure ?? null,
      seedReviewCurrentConfidence: classified.current?.mss?.confidence ?? null,
      heuristicSuggestedMinimumScale: classified.heuristicPrior?.suggestedMinimumScale ?? null,
      heuristicScaleLooksUnderstated: classified.heuristicPrior?.scaleLooksUnderstated ?? false,
      heuristicReasons: classified.heuristicPrior?.reasons ?? [],
      regenerationVariantId:
        candidate.promptDraft.metadata?.variantId ?? candidate.promptDraft.metadata?.sourceId ?? null,
      likelySubmodules: candidate.promptDraft.metadata?.likelySubmodules ?? [],
      researchUsedSearch: candidate.research?.usedSearch ?? false,
      researchUsedFollowUpSearch: candidate.research?.usedTargetedFollowUpSearch ?? false,
      researchUsedLivecrawl: candidate.research?.usedLivecrawl ?? false,
      assessment: candidate.assessment ?? {},
      promptSource: 'approved-regenerated-seed',
    },
    _source: {
      title: candidate.rawCard.title ?? classified.title,
      description: candidate.rawCard.description ?? '',
      coreUserJob: candidate.rawCard.coreUserJob ?? null,
      whyRelevant: candidate.rawCard.whyRelevant ?? null,
      mss: {
        structure: classified.current?.mss?.structure ?? candidate.rawCard.likelyStructure ?? null,
        scale: classifiedScale,
        confidence: classified.current?.mss?.confidence ?? null,
      },
    },
  }
}

const main = async () => {
  const input = parseArgs()

  const [recommendedRows, salvageRows, trustedCandidates, iffyCandidates, handcraftedRows] = await Promise.all([
    readJsonl<ClassifiedRow>(input.recommendedPath),
    readJsonl<ClassifiedRow>(input.salvagePath),
    readJsonl<CandidateRow>(input.trustedCandidatesPath),
    readJsonl<CandidateRow>(input.iffyCandidatesPath),
    readJsonl<HandcraftedRow>(input.handcraftedPath),
  ])

  const candidateMap = buildCandidateMap([...trustedCandidates, ...iffyCandidates])
  const classifiedRows = [
    ...recommendedRows.map((row) => ({ row, provenance: 'recommended' as const })),
    ...(input.includeSalvage ? salvageRows.map((row) => ({ row, provenance: 'salvage' as const })) : []),
  ]

  const missingCandidateIds: string[] = []
  const approvedSeedParents = classifiedRows
    .filter(({ row }) => row.recommendedForSeedReview === true)
    .filter(({ row }) => {
      const scale = currentScale(row)
      return scale !== null && scale >= input.minApprovedScale
    })
    .flatMap(({ row, provenance }) => {
      const candidate = candidateMap.get(row.id)
      if (!candidate) {
        missingCandidateIds.push(row.id)
        return []
      }
      return [buildParentRow({ classified: row, candidate, provenance })]
    })

  const handcraftedParents = handcraftedRows
    .filter((row) => HANDCRAFTED_PARENT_IDS.has(row.id))
    .map<ParentPromptRow>((row) => ({
      id: row.id,
      input: row.input,
      hint: row.hint ?? null,
      title: row.id,
      metadata: {
        ...(row.metadata ?? {}),
        promptSource: 'handcrafted-parent',
        handcraftedParentEligible: true,
      },
    }))

  const allRows = [...approvedSeedParents, ...handcraftedParents]
  const jsonl = `${allRows.map((row) => JSON.stringify(row)).join('\n')}\n`
  await Bun.write(input.outputPath, jsonl)

  const summary = {
    outputPath: input.outputPath,
    totalParents: allRows.length,
    approvedSeedParents: approvedSeedParents.length,
    handcraftedParents: handcraftedParents.length,
    minApprovedScale: input.minApprovedScale,
    includeSalvage: input.includeSalvage,
    missingCandidateIds,
  }
  await Bun.write(input.summaryPath, `${JSON.stringify(summary, null, 2)}\n`)

  console.log(JSON.stringify(summary, null, 2))
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  })
}
