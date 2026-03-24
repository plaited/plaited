#!/usr/bin/env bun

import { appendJsonlRow, resetJsonlOutput } from './jsonl-output.ts'

type RegenerationEvalRow = {
  candidate: {
    rawCard: {
      id: string
      title: string
      description: string
      modernAnalog: string
      coreUserJob?: unknown
      whyRelevant?: unknown
      searchQuerySeed?: unknown
      inclusionDecision?: unknown
      likelyPatternFamily: string
      likelyStructure: string
    }
    variantId?: string
    promptDraft: {
      id?: string
      input: string
      hint: string
      metadata?: Record<string, unknown>
    }
  }
  research?: {
    usedSearch?: unknown
    usedTargetedFollowUpSearch?: unknown
    usedLivecrawl?: unknown
    searchQuery?: unknown
    followUpSearchQuery?: unknown
    searchSnippetCount?: unknown
    followUpSnippetCount?: unknown
    moduleShapeRecoveredFromSearch?: unknown
  }
  assessment?: {
    modernRelevance?: unknown
    promptQuality?: unknown
    mssPlausibility?: unknown
    seedWorthiness?: unknown
  }
  deterministicCheck?: {
    pass?: unknown
    hardFailures?: unknown
  }
  reliable?: boolean
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
    sourceScaleEstimate: number | null
    sourceScaleEstimateLabel: string | null
    antiInflationSignals: string[]
    antiInflationLevel: 'low' | 'medium' | 'high'
    slice14CandidateVariant: string | null
    generationVariantId: string | null
    sourceLikelyPatternFamily: string | null
    sourceLikelyStructure: string | null
    reliableFromSlice14: boolean
    slice14DimensionSignals: {
      modernRelevance: unknown
      promptQuality: unknown
      mssPlausibility: unknown
      seedWorthiness: unknown
    }
    recommendedFromSlice14: boolean
    generatedModuleId: string | null
    generatedModernTitle: string | null
    generatedScale: string | null
    generatedScaleValue: number | null
    generatedScaleDelta: number | null
    generatedLikelySubmodules: string[]
    generatedPromptDraftId: string | null
    generatedPromptInput: string | null
    generatedPromptHint: string | null
    researchUsedForModernization: boolean
    usedTargetedFollowupSearch: boolean
    usedLivecrawl: boolean
    searchQuery: string | null
    followUpSearchQuery: string | null
    searchSnippetCount: number | null
    followUpSnippetCount: number | null
    moduleShapeRecoveredFromSearch: string | null
    deterministicPass: boolean | null
    deterministicHardFailures: string[]
    generationLineage: {
      plannerModel: string | null
      modernizerModel: string | null
      verifierModel: string | null
      verifierScore: number | null
    }
  }
  _source: {
    title: string
    description: string
    modernAnalog: string
    coreUserJob: string | null
    whyRelevant: string | null
    searchQuerySeed: string | null
    inclusionDecision: string | null
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

const shuffle = <T>(values: T[], seed: number): T[] => {
  const next = [...values]
  let state = seed >>> 0
  const rand = () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }

  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rand() * (index + 1))
    ;[next[index], next[swapIndex]] = [next[swapIndex]!, next[index]!]
  }

  return next
}

const parseArgs = () => {
  const args = Bun.argv.slice(2)
  let trustedPath = DEFAULT_TRUSTED_EVALS
  let iffyPath = DEFAULT_IFFY_EVALS
  let outputPath = DEFAULT_OUTPUT
  let limit = 100
  let trustedTarget = 70
  let iffyTarget = 30
  let trustedTargetExplicit = false
  let iffyTargetExplicit = false
  let randomMix = false
  let includeRecommended = true
  let seed = 22

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
      trustedTargetExplicit = true
      index += 1
      continue
    }
    if (arg === '--iffy-target' && args[index + 1]) {
      iffyTarget = Math.max(0, Number(args[index + 1]!))
      iffyTargetExplicit = true
      index += 1
      continue
    }
    if (arg === '--random-mix') {
      randomMix = true
      continue
    }
    if (arg === '--include-non-recommended') {
      includeRecommended = false
      continue
    }
    if (arg === '--seed' && args[index + 1]) {
      seed = Number(args[index + 1]!)
      index += 1
    }
  }

  return {
    trustedPath,
    iffyPath,
    outputPath,
    limit,
    trustedTarget,
    iffyTarget,
    trustedTargetExplicit,
    iffyTargetExplicit,
    randomMix,
    includeRecommended,
    seed,
  }
}

const readJsonl = async (path: string): Promise<RegenerationEvalRow[]> => {
  const text = await Bun.file(path).text()
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as RegenerationEvalRow)
}

const toScaleValue = (value: unknown): number | null => {
  if (typeof value !== 'string') return null
  const match = value.match(/^S([1-8])$/i)
  return match ? Number(match[1]) : null
}

const asString = (value: unknown): string | null => (typeof value === 'string' && value.length > 0 ? value : null)

const asNumber = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null)

const asBoolean = (value: unknown): boolean | null => (typeof value === 'boolean' ? value : null)

const sourceScaleEstimateFromRaw = (row: RegenerationEvalRow): number | null => {
  const evidence = [
    row.candidate.rawCard.title,
    row.candidate.rawCard.description,
    row.candidate.rawCard.modernAnalog,
    row.candidate.rawCard.likelyPatternFamily,
    row.candidate.rawCard.likelyStructure,
  ]
    .join(' ')
    .toLowerCase()

  let estimate = 1

  if (/(suite|suite-like|module|modules|connected|network|community|forum|board|stream|pipeline)/.test(evidence)) {
    estimate = Math.max(estimate, 3)
  }

  if (/(list|catalog|inventory|ledger|project|schedule|calendar|tracker|report|archive|library)/.test(evidence)) {
    estimate = Math.max(estimate, 2)
  }

  if (/(sub-?project|subproject|object graph|matrix|transfer|summary|category|batch|multiple views)/.test(evidence)) {
    estimate = Math.max(estimate, 3)
  }

  if (/(portfolio|suite|toolkit|suite of|collection of)/.test(evidence)) {
    estimate = Math.max(estimate, 2)
  }

  if (/(game|simulation|music|lab|lab toolbox|creative|art|photo|video)/.test(evidence)) {
    estimate = Math.max(estimate, 2)
  }

  return Math.min(8, estimate)
}

const antiInflationSignals = ({
  sourceScale,
  generatedScale,
  quality,
  recommended,
}: {
  sourceScale: number | null
  generatedScale: number | null
  quality: number
  recommended: boolean
}): string[] => {
  const reasons: string[] = []

  if (sourceScale === null) {
    reasons.push('source scale estimate unavailable')
  } else if (generatedScale === null) {
    reasons.push('generated scale unavailable')
  } else if (generatedScale - sourceScale >= 3) {
    reasons.push(`anti-inflation: generated S${generatedScale} overreaches estimated source S${sourceScale}`)
  }

  if (!recommended) {
    reasons.push('slice14 recommended=false, require stronger evidence before promotion')
  }

  if (quality < 0.7) {
    reasons.push(`slice14 quality is modest (${quality.toFixed(2)})`)
  }

  return reasons.length === 0 ? ['no obvious inflation risks'] : reasons
}

const toPromptRow = (row: RegenerationEvalRow, provenance: 'trusted' | 'iffy'): SeedReviewPromptRow => {
  const metadata = row.candidate.promptDraft.metadata ?? {}
  const generatedScale = typeof metadata.scale === 'string' ? metadata.scale : null
  const generatedScaleValue = toScaleValue(generatedScale)
  const sourceLikelyPatternFamily = asString(row.candidate.rawCard.likelyPatternFamily)
  const sourceLikelyStructure = asString(row.candidate.rawCard.likelyStructure)
  const structure =
    typeof metadata.structureCue === 'string' && metadata.structureCue.trim().length > 0
      ? metadata.structureCue
      : row.candidate.rawCard.likelyStructure
  const sourceScaleEstimate = sourceScaleEstimateFromRaw(row)
  const generationVariant = asString(row.candidate.variantId) ?? asString(metadata.variantId) ?? null
  const generatedScaleDelta =
    sourceScaleEstimate === null || generatedScaleValue === null ? null : generatedScaleValue - sourceScaleEstimate
  const antiInflation = antiInflationSignals({
    sourceScale: sourceScaleEstimate,
    generatedScale: generatedScaleValue,
    quality: row.qualityScore,
    recommended: row.recommended,
  })
  const antiInflationLevel: 'low' | 'medium' | 'high' =
    antiInflation.length <= 1 ? 'low' : antiInflation.length === 2 ? 'medium' : 'high'
  const coreUserJob = asString(row.candidate.rawCard.coreUserJob)
  const whyRelevant = asString(row.candidate.rawCard.whyRelevant)
  const searchQuerySeed = asString(row.candidate.rawCard.searchQuerySeed)
  const inclusionDecision = asString(row.candidate.rawCard.inclusionDecision)

  return {
    id: row.candidate.rawCard.id,
    input: [row.candidate.promptDraft.input, row.candidate.promptDraft.hint],
    metadata: {
      promptSource: 'hypercard-archive',
      patternFamily: row.candidate.rawCard.likelyPatternFamily,
      modernization: row.candidate.rawCard.modernAnalog,
      seedReviewProvenance: provenance,
      regenerationQualityScore: row.qualityScore,
      sourceScaleEstimate,
      sourceScaleEstimateLabel: sourceScaleEstimate === null ? null : `S${sourceScaleEstimate}`,
      antiInflationLevel,
      antiInflationSignals: antiInflation,
      sourceLikelyPatternFamily,
      sourceLikelyStructure,
      generationVariantId: generationVariant,
      reliableFromSlice14: row.reliable === true,
      slice14DimensionSignals: {
        modernRelevance: row.assessment?.modernRelevance ?? null,
        promptQuality: row.assessment?.promptQuality ?? null,
        mssPlausibility: row.assessment?.mssPlausibility ?? null,
        seedWorthiness: row.assessment?.seedWorthiness ?? null,
      },
      slice14CandidateVariant: generationVariant,
      recommendedFromSlice14: row.recommended,
      generatedModuleId: typeof metadata.mssModule === 'string' ? metadata.mssModule : null,
      generatedModernTitle: typeof metadata.modernTitle === 'string' ? metadata.modernTitle : null,
      generatedScale,
      generatedScaleValue,
      generatedScaleDelta,
      generatedPromptDraftId: typeof row.candidate.promptDraft.id === 'string' ? row.candidate.promptDraft.id : null,
      generatedPromptInput: row.candidate.promptDraft.input,
      generatedPromptHint: row.candidate.promptDraft.hint,
      generatedLikelySubmodules: Array.isArray(metadata.likelySubmodules)
        ? metadata.likelySubmodules.filter((value): value is string => typeof value === 'string')
        : [],
      researchUsedForModernization: asBoolean(row.research?.usedSearch) ?? true,
      usedTargetedFollowupSearch: asBoolean(row.research?.usedTargetedFollowUpSearch) ?? false,
      usedLivecrawl: asBoolean(row.research?.usedLivecrawl) ?? false,
      searchQuery: asString(row.research?.searchQuery),
      followUpSearchQuery: asString(row.research?.followUpSearchQuery),
      searchSnippetCount: asNumber(row.research?.searchSnippetCount),
      followUpSnippetCount: asNumber(row.research?.followUpSnippetCount),
      moduleShapeRecoveredFromSearch: asString(row.research?.moduleShapeRecoveredFromSearch) ?? 'unknown',
      deterministicPass: asBoolean(row.deterministicCheck?.pass) ?? null,
      deterministicHardFailures:
        Array.isArray(row.deterministicCheck?.hardFailures) &&
        row.deterministicCheck.hardFailures.every((value): value is string => typeof value === 'string')
          ? row.deterministicCheck.hardFailures
          : [],
      generationLineage: {
        plannerModel: asString(metadata.plannerModel),
        modernizerModel: asString(metadata.modernizerModel),
        verifierModel: asString(metadata.verifierModel),
        verifierScore:
          typeof metadata.verifierScore === 'number' && Number.isFinite(metadata.verifierScore)
            ? metadata.verifierScore
            : null,
      },
    },
    _source: {
      title: row.candidate.rawCard.title,
      description: row.candidate.rawCard.description,
      modernAnalog: row.candidate.rawCard.modernAnalog,
      coreUserJob,
      whyRelevant,
      searchQuerySeed,
      inclusionDecision,
      mss: {
        scale: sourceScaleEstimate,
        structure,
        confidence: row.qualityScore >= 0.9 ? 'high' : 'medium',
      },
    },
  }
}

const sortRowsForSeedReview = ({
  rows,
  includeRecommended,
}: {
  rows: RegenerationEvalRow[]
  includeRecommended: boolean
}) =>
  rows
    .filter((row) => row.recommended === includeRecommended)
    .sort(
      (left, right) =>
        right.qualityScore - left.qualityScore || left.candidate.rawCard.id.localeCompare(right.candidate.rawCard.id),
    )

const main = async () => {
  const {
    trustedPath,
    iffyPath,
    outputPath,
    limit,
    trustedTarget,
    iffyTarget,
    trustedTargetExplicit,
    iffyTargetExplicit,
    randomMix,
    includeRecommended,
    seed,
  } = parseArgs()
  const trustedRows = sortRowsForSeedReview({
    rows: await readJsonl(trustedPath),
    includeRecommended,
  })
  const iffyRows = sortRowsForSeedReview({
    rows: await readJsonl(iffyPath),
    includeRecommended,
  })

  const normalizedTrustedTarget = trustedTargetExplicit || iffyTargetExplicit ? trustedTarget : Math.round(limit * 0.7)
  const normalizedIffyTarget =
    trustedTargetExplicit || iffyTargetExplicit ? iffyTarget : Math.max(0, limit - normalizedTrustedTarget)

  const trustedSelected = trustedRows.slice(0, normalizedTrustedTarget)
  const iffySelected = iffyRows.slice(0, normalizedIffyTarget)
  const combinedBase = [
    ...trustedSelected.map((row) => toPromptRow(row, 'trusted')),
    ...iffySelected.map((row) => toPromptRow(row, 'iffy')),
  ]
  const combined = (randomMix ? shuffle(combinedBase, seed) : combinedBase).slice(0, limit)

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
        trustedTarget: normalizedTrustedTarget,
        iffyTarget: normalizedIffyTarget,
        trustedRows: combined.filter((row) => row.metadata.seedReviewProvenance === 'trusted').length,
        iffyRows: combined.filter((row) => row.metadata.seedReviewProvenance === 'iffy').length,
        randomMix,
        includeRecommended,
        seed,
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
