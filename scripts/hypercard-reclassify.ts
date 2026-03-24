#!/usr/bin/env bun

import { dirname, join } from 'node:path'
import * as z from 'zod'
import { grade as judgeReclassification } from './hypercard-reclassification-judge.ts'
import { grade as metaVerifyReclassification } from './hypercard-reclassification-meta-verifier.ts'
import { suggestMinimumScale } from './hypercard-scale-audit.ts'
import { appendJsonlRow, resetJsonlOutput } from './jsonl-output.ts'

type PromptRow = {
  id: string
  input: string | string[]
  metadata?: {
    promptSource?: string
    patternFamily?: string
    modernization?: string
    seedReviewProvenance?: string
    regenerationQualityScore?: number
    sourceScaleEstimate?: number | null
    sourceScaleEstimateLabel?: string | null
    sourceLikelyPatternFamily?: string | null
    sourceLikelyStructure?: string | null
    recommendedFromSlice14?: boolean
    generatedModuleId?: string | null
    generatedModernTitle?: string | null
    generatedScale?: string | null
    generatedScaleValue?: number | null
    generatedScaleDelta?: number | null
    generatedPromptDraftId?: string | null
    generatedPromptInput?: string | null
    generatedPromptHint?: string | null
    generatedLikelySubmodules?: string[]
    reliableFromSlice14?: boolean
    antiInflationLevel?: 'low' | 'medium' | 'high'
    antiInflationSignals?: string[]
    slice14DimensionSignals?: {
      modernRelevance?: unknown
      promptQuality?: unknown
      mssPlausibility?: unknown
      seedWorthiness?: unknown
    }
    slice14CandidateVariant?: string | null
    generationVariantId?: string | null
    generationLineage?: {
      plannerModel: string | null
      modernizerModel: string | null
      verifierModel: string | null
      verifierScore: number | null
    }
    researchUsedForModernization?: boolean
    usedTargetedFollowupSearch?: boolean
    usedLivecrawl?: boolean
    searchQuery?: string | null
    followUpSearchQuery?: string | null
    searchSnippetCount?: number | null
    followUpSnippetCount?: number | null
    moduleShapeRecoveredFromSearch?: string | null
    deterministicPass?: boolean | null
    deterministicHardFailures?: string[]
  }
  _source?: {
    title?: string
    creator?: string
    description?: string
    source_url?: string
    expectedExposure?: string
    modernAnalog?: string
    coreUserJob?: string
    whyRelevant?: string
    searchQuerySeed?: string
    inclusionDecision?: string
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

const formatProvenance = (value: unknown): string => {
  if (value === 'trusted' || value === 'iffy') return value
  return typeof value === 'string' ? value : 'unknown'
}

const formatScale = (value: unknown): string => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const clamped = Math.max(1, Math.min(8, Math.round(value)))
    return `S${clamped}`
  }
  return typeof value === 'string' ? value : 'unknown'
}

const formatBoolean = (value: unknown): string => {
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  return 'unknown'
}

const buildSection = (label: string, lines: string[]) =>
  [`${label}:`, ...lines.filter((line) => line.trim().length > 0).map((line) => `- ${line}`)].join('\n')

type SeedReviewLane = 'strong-trusted' | 'iffy-rescue' | 'iffy-gated' | 'unknown'

const getSeedReviewLane = (row: PromptRow): SeedReviewLane => {
  const provenance = formatProvenance(row.metadata?.seedReviewProvenance)
  const recommendedFromSlice14 = row.metadata?.recommendedFromSlice14 === true
  const reliableFromSlice14 = row.metadata?.reliableFromSlice14 === true
  const antiInflationLevel =
    row.metadata?.antiInflationLevel === 'low' ||
    row.metadata?.antiInflationLevel === 'medium' ||
    row.metadata?.antiInflationLevel === 'high'
      ? row.metadata.antiInflationLevel
      : 'low'
  const antiInflationSignals =
    Array.isArray(row.metadata?.antiInflationSignals) && row.metadata.antiInflationSignals.length > 0
      ? row.metadata.antiInflationSignals
      : []
  const quality = row.metadata?.regenerationQualityScore

  if (
    provenance === 'trusted' &&
    recommendedFromSlice14 &&
    reliableFromSlice14 &&
    typeof quality === 'number' &&
    quality >= 0.82 &&
    antiInflationLevel !== 'high'
  ) {
    return 'strong-trusted'
  }

  if (
    provenance === 'iffy' &&
    recommendedFromSlice14 &&
    antiInflationLevel === 'low' &&
    typeof quality === 'number' &&
    quality >= 0.88 &&
    antiInflationSignals.length === 0
  ) {
    return 'iffy-rescue'
  }

  if (provenance === 'iffy') {
    return 'iffy-gated'
  }

  return 'unknown'
}

const getSeedReviewLaneSummary = (lane: SeedReviewLane) => {
  if (lane === 'strong-trusted') {
    return 'strong-trusted lane: allow compact S1-S3 with explicit source alignment'
  }
  if (lane === 'iffy-rescue') {
    return 'iffy-rescue lane: permit bounded promotion for tightly aligned S1-S2/S3 cases'
  }
  if (lane === 'iffy-gated') {
    return 'iffy-gated lane: require strong explicit source-evidence before S2-S3 promotion'
  }
  return 'unknown lane: enforce conservative defaults'
}

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
  let resume = true

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
      continue
    }
    if (arg === '--no-resume') {
      resume = false
    }
  }

  return { inputPath, outputPath, limit, onlyFlagged, progress, concurrency, resume }
}

const readExistingRecordIds = async (path: string): Promise<Set<string>> => {
  if (!(await Bun.file(path).exists())) return new Set()
  const text = await Bun.file(path).text()
  return new Set(
    text
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        try {
          const row = JSON.parse(line) as { id?: unknown }
          return typeof row.id === 'string' ? row.id : null
        } catch {
          return null
        }
      })
      .filter((id): id is string => Boolean(id)),
  )
}

const summarizeExistingRecords = async (path: string) => {
  if (!(await Bun.file(path).exists())) {
    return {
      processedCandidates: 0,
      trusted: 0,
      recommendedForSeedReview: 0,
      judgeCostUsd: 0,
      metaVerifierCostUsd: 0,
    }
  }

  const text = await Bun.file(path).text()
  const rows = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as z.infer<typeof ReclassificationRecordSchema>)

  return {
    processedCandidates: rows.length,
    trusted: rows.filter((row) => row.trusted).length,
    recommendedForSeedReview: rows.filter((row) => row.recommendedForSeedReview).length,
    judgeCostUsd: rows.reduce((sum, row) => sum + getJudgeCostUsd(asRecord(row.judge?.outcome).judgeSdk), 0),
    metaVerifierCostUsd: rows.reduce(
      (sum, row) => sum + getJudgeCostUsd(asRecord(row.metaVerification?.outcome).metaVerificationSdk),
      0,
    ),
  }
}

const countErrorRows = async (path: string): Promise<number> => {
  if (!(await Bun.file(path).exists())) return 0
  const text = await Bun.file(path).text()
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean).length
}

const logProgress = ({ enabled, message }: { enabled: boolean; message: string }) => {
  if (!enabled) return
  console.error(`[hypercard-reclassify] ${message}`)
}

const getNestedNumber = (value: unknown, key: string): number | undefined => {
  if (!value || typeof value !== 'object') return undefined
  const nested = (value as Record<string, unknown>)[key]
  return typeof nested === 'number' ? nested : undefined
}

const getJudgeCostUsd = (value: unknown): number => getNestedNumber(value, 'totalCostUsd') ?? 0

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {}

const getSummaryPath = (outputPath: string) => `${outputPath}.summary.json`

const getErrorsPath = (outputPath: string) => `${outputPath}.errors.jsonl`

const buildTask = (row: PromptRow) =>
  [
    'Promotion review for regenerated HyperCard-derived seed candidates.',
    'This is not a first-pass modernization task. The prompt was already regenerated in Slice 14.',
    'Judge whether the regenerated seed is trustworthy enough to move through curation and lower-scale derivation.',
    'Return true only when source evidence and regeneration scope remain aligned without overbuilding scale or family.',
    '',
    buildSection('Promotion framing', [
      `Title: ${row._source?.title ?? row.id}`,
      `Seed-review lane: ${getSeedReviewLaneSummary(getSeedReviewLane(row))}`,
      'Review objective: trustworthiness for seed review, then future derivation to S1-S2 candidates.',
      'Do not require exceptional novelty or large scale by default. Promotion suitability can come from bounded reusable module value.',
      `Seed provenance: ${formatProvenance(row.metadata?.seedReviewProvenance)}`,
      `Slice 14 recommended: ${row.metadata?.recommendedFromSlice14 === true ? 'true' : 'false'}`,
      `Slice 14 reliable: ${row.metadata?.reliableFromSlice14 === true ? 'true' : 'false'}`,
      `Slice 14 signals: modernRelevance=${String(row.metadata?.slice14DimensionSignals?.modernRelevance ?? 'unknown')}, promptQuality=${String(
        row.metadata?.slice14DimensionSignals?.promptQuality ?? 'unknown',
      )}, mssPlausibility=${String(row.metadata?.slice14DimensionSignals?.mssPlausibility ?? 'unknown')}, seedWorthiness=${String(
        row.metadata?.slice14DimensionSignals?.seedWorthiness ?? 'unknown',
      )}`,
      `Slice 14 quality score: ${
        typeof row.metadata?.regenerationQualityScore === 'number'
          ? row.metadata.regenerationQualityScore.toFixed(3)
          : 'unknown'
      }`,
      `Generated prompt id: ${row.metadata?.generatedPromptDraftId ?? 'unknown'}`,
      `Generated module identity: ${row.metadata?.generatedModuleId ?? 'not supplied'}`,
      `Generated modern title: ${row.metadata?.generatedModernTitle ?? 'not supplied'}`,
      `Generated scale: ${row.metadata?.generatedScale ?? 'unknown'} (${formatScale(row.metadata?.generatedScaleValue)})`,
      `Current source scale: ${typeof row._source?.mss?.scale === 'number' ? `S${row._source.mss.scale}` : 'unknown'}`,
      `Expected modern pattern: ${row.metadata?.modernization ?? 'not supplied'}`,
      `Pattern family from record: ${row.metadata?.patternFamily ?? 'unknown'}`,
      `Recommended likely submodules: ${
        Array.isArray(row.metadata?.generatedLikelySubmodules) && row.metadata.generatedLikelySubmodules.length > 0
          ? row.metadata.generatedLikelySubmodules.join(', ')
          : 'none listed'
      }`,
      `Slice 14 deterministic signals: pass=${formatBoolean(row.metadata?.deterministicPass)}, hardFailures=${
        Array.isArray(row.metadata?.deterministicHardFailures) && row.metadata.deterministicHardFailures.length > 0
          ? row.metadata.deterministicHardFailures.join('|')
          : 'none'
      }`,
    ]),
    '',
    buildSection('HyperCard provenance evidence', [
      `Source URL: ${row._source?.source_url ?? 'unknown'}`,
      `Creator: ${row._source?.creator ?? 'unknown'}`,
      `Description: ${row._source?.description ?? 'none provided'}`,
      `Modern Analog: ${row._source?.modernAnalog ?? 'none provided'}`,
      `Expected exposure: ${row._source?.expectedExposure ?? 'unknown'}`,
      `Core user job: ${row._source?.coreUserJob ?? 'none provided'}`,
      `Why relevant: ${row._source?.whyRelevant ?? 'none provided'}`,
    ]),
    buildSection('Reconstruction context', [
      `Search seed: ${row._source?.searchQuerySeed ?? 'none provided'}`,
      `Inclusion decision: ${row._source?.inclusionDecision ?? 'unknown'}`,
    ]),
    '',
    buildSection('Modernization-search evidence', [
      `Research modernization run: used=${formatBoolean(row.metadata?.researchUsedForModernization)}`,
      `Targeted follow-up search: ${formatBoolean(row.metadata?.usedTargetedFollowupSearch)}`,
      `Livecrawl used: ${formatBoolean(row.metadata?.usedLivecrawl)}`,
      `Search snippets: primary=${row.metadata?.searchSnippetCount ?? 'unknown'}, followup=${row.metadata?.followUpSnippetCount ?? 'unknown'}`,
      `Search query: ${row.metadata?.searchQuery ?? 'unknown'}`,
      `Follow-up query: ${row.metadata?.followUpSearchQuery ?? 'unknown'}`,
      `Recovered shape: ${row.metadata?.moduleShapeRecoveredFromSearch ?? 'unknown'}`,
      `Generated variant: ${row.metadata?.generationVariantId ?? 'unknown'}`,
    ]),
    '',
    buildSection('Promotion hard constraints', [
      `Lane policy: ${getSeedReviewLaneSummary(getSeedReviewLane(row))}.`,
      'Bounded reusable modules (especially S1-S2) are valid promotion candidates when source evidence and mechanisms are clear.',
      'A modest but well-aligned reusable seed can still pass even when it is not a high-scale suite or unusually novel artifact.',
      'Reject candidates that overinflate scale, family, or mechanics from modest source scope.',
      'Require conservative scale: if regenerated scale exceeds source scale by 2+ levels, only promote with explicit multi-block evidence.',
      'Words like "suite", "platform", and "complete" are insufficient without concrete coordinated-module proof.',
      `Anti-inflation risk: ${
        Array.isArray(row.metadata?.antiInflationSignals) && row.metadata.antiInflationSignals.length > 0
          ? row.metadata.antiInflationSignals.join(' | ')
          : 'no explicit anti-inflation signals'
      }`,
    ]),
    '',
    buildSection('Regenerated-provenance summary', [
      `Source scale estimate: ${row.metadata?.sourceScaleEstimate ?? 'unknown'} (${
        row.metadata?.sourceScaleEstimateLabel ?? 'not computed'
      })`,
      `Source likely pattern family: ${row.metadata?.sourceLikelyPatternFamily ?? 'unknown'}`,
      `Source likely structure: ${row.metadata?.sourceLikelyStructure ?? 'unknown'}`,
      `Generated scale delta: ${row.metadata?.generatedScaleDelta ?? 'unknown'}`,
      `Generated scale: ${row.metadata?.generatedScale ?? 'unknown'}`,
      `Generated lineages: planner=${
        row.metadata?.generationLineage?.plannerModel ?? 'unknown'
      }, modernizer=${row.metadata?.generationLineage?.modernizerModel ?? 'unknown'}, verifier=${
        row.metadata?.generationLineage?.verifierModel ?? 'unknown'
      }, verifier-score=${row.metadata?.generationLineage?.verifierScore ?? 'unknown'}`,
    ]),
    '',
    buildSection('Regenerated prompt text', [
      `Input: ${row.input ? flattenInput(row.input) : 'missing regenerated input'}`,
      `Hint: ${row.metadata?.generatedPromptHint ?? 'missing regenerated hint'}`,
    ]),
  ].join('\n')

const deriveCalibrationCues = (row: PromptRow, heuristic: ReturnType<typeof suggestMinimumScale>) => {
  const title = (row._source?.title ?? '').toLowerCase()
  const description = (row._source?.description ?? '').toLowerCase()
  const generatedPrompt = flattenInput(row.input).toLowerCase()
  const evidence = [title, description, generatedPrompt].filter(Boolean).join(' ')
  const cues: string[] = []
  const lane = getSeedReviewLane(row)
  const sourceScale = typeof row._source?.mss?.scale === 'number' ? row._source.mss.scale : null
  const generatedScale =
    typeof row.metadata?.generatedScaleValue === 'number'
      ? row.metadata.generatedScaleValue
      : typeof row.metadata?.generatedScale === 'string'
        ? Number(row.metadata.generatedScale.replace(/^S/i, ''))
        : null
  const recommendedFromSlice14 = row.metadata?.recommendedFromSlice14 === true
  const slice14Reliable = row.metadata?.reliableFromSlice14 === true
  const hasDeterministicFailures =
    Array.isArray(row.metadata?.deterministicHardFailures) && row.metadata.deterministicHardFailures.length > 0
  const antiInflationSignals =
    Array.isArray(row.metadata?.antiInflationSignals) && row.metadata.antiInflationSignals.length > 0
      ? row.metadata.antiInflationSignals
      : []
  const antiInflationLevel =
    row.metadata?.antiInflationLevel === 'low' ||
    row.metadata?.antiInflationLevel === 'medium' ||
    row.metadata?.antiInflationLevel === 'high'
      ? row.metadata.antiInflationLevel
      : 'low'

  if (/(inventory|vendor|payment|budget|cost|ledger|tax|summary|project costing|job costing)/.test(evidence)) {
    cues.push(
      'Operational workflow evidence is present. Favor business-process over personal-data-manager unless the source is primarily about household or personal record keeping.',
    )
  }

  if (
    /(household|owner|personal)/.test(evidence) &&
    /(inventory|vendor|payment|budget|cost|project|tax)/.test(evidence)
  ) {
    cues.push(
      'Household or owner-facing examples appear as usage context, but they do not override an underlying operational workflow classification.',
    )
  }

  if (/(project stacks|sub-projects|subprojects|categories|summary|objects)/.test(evidence)) {
    cues.push(
      'Review non-collection structures carefully: project/subproject language can imply hierarchy, category summaries can imply matrix, and object/data stack phrasing may still remain a specific S2 workflow rather than a generic collection.',
    )
  }

  if (/(dialog entry|form|entry control|record each payment|maintain|update)/.test(evidence)) {
    cues.push('Form may fit better than collection when the dominant loop is entering or editing operational records.')
  }

  if (/(list|listing|print|printable|menu driven|categories of software lists)/.test(evidence)) {
    cues.push(
      'List may fit better than collection when the core experience is maintaining, generating, or printing ordered records.',
    )
  }

  if (/(hypothesis|researcher|experiment|project stacks build info and data stacks)/.test(evidence)) {
    cues.push(
      'Niche research tooling can be seed-worthy if the structure is reusable, but do not inflate scale or seed value from "powerful" or "complete" marketing language alone.',
    )
  }

  if (lane === 'iffy-gated') {
    cues.push(
      'Seed-review lane is iffy-gated: default to conservative promotion and require direct source-alignment proof for any scope expansion.',
    )
  }

  if (lane === 'strong-trusted') {
    cues.push(
      'Seed-review lane is strong-trusted: allow compact S1-S2 or cautious S3 when mechanisms and boundaries stay source-aligned.',
    )
  }

  if (slice14Reliable === false && !recommendedFromSlice14) {
    cues.push(
      'Slice 14 reliability concern: do not trust a broad promotion unless direct source-evidence alignment is explicit.',
    )
  }

  if (lane === 'iffy-rescue') {
    cues.push(
      'Iffy-rescue lane: promotion can pass on tightly aligned compact candidates with clear mechanisms and low anti-inflation profile.',
    )
  }

  if (sourceScale !== null && generatedScale !== null && generatedScale - sourceScale >= 2) {
    cues.push(
      `Scale drift risk: regenerated scale S${generatedScale} exceeds source-scale estimate S${sourceScale}; require evidence of coordinated blocks before keepForSeedReview.`,
    )
  }

  if (antiInflationLevel === 'high') {
    cues.push('Anti-inflation warning is high; reject scale and family expansion without explicit evidence.')
  }

  if (antiInflationSignals.length > 0) {
    cues.push(`Slice-15 anti-inflation signals: ${antiInflationSignals.join(' | ')}`)
  }

  if (
    typeof row.metadata?.sourceLikelyPatternFamily === 'string' &&
    typeof row.metadata?.patternFamily === 'string' &&
    row.metadata.sourceLikelyPatternFamily !== row.metadata.patternFamily
  ) {
    cues.push(
      `Source pattern family hypothesis is ${row.metadata.sourceLikelyPatternFamily}; verify no drift if current family is ${row.metadata.patternFamily}.`,
    )
  }

  if (row.metadata?.usedTargetedFollowupSearch === false && row.metadata?.researchUsedForModernization === true) {
    cues.push(
      'No targeted follow-up search was run; avoid scale/pattern expansion not directly justified by source description.',
    )
  }

  if (hasDeterministicFailures) {
    cues.push(
      'Generation-level deterministic checks reported issues; prioritize consistency and avoid false positives.',
    )
  }

  if (heuristic.suggestedScale <= 2) {
    cues.push(
      'The scale heuristic does not by itself justify promotion beyond S2. Require concrete evidence before raising scale or seed-worthiness.',
    )
  }

  return cues
}

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
  const generatedScale =
    typeof row.metadata?.generatedScaleValue === 'number'
      ? row.metadata.generatedScaleValue
      : typeof row.metadata?.generatedScale === 'string'
        ? Number(row.metadata.generatedScale.replace(/^S/i, ''))
        : null
  const provenance = formatProvenance(row.metadata?.seedReviewProvenance)
  const scaleDrift = currentScale !== null && generatedScale !== null ? generatedScale - currentScale : null
  const antiInflationLevel =
    row.metadata?.antiInflationLevel === 'low' ||
    row.metadata?.antiInflationLevel === 'medium' ||
    row.metadata?.antiInflationLevel === 'high'
      ? row.metadata.antiInflationLevel
      : scaleDrift !== null && scaleDrift >= 2
        ? 'medium'
        : 'low'
  const antiInflationSignals =
    Array.isArray(row.metadata?.antiInflationSignals) && row.metadata.antiInflationSignals.length > 0
      ? row.metadata.antiInflationSignals
      : []
  const hasDeterministicFailures =
    Array.isArray(row.metadata?.deterministicHardFailures) && row.metadata.deterministicHardFailures.length > 0
  const metadata = {
    sourceRecord: {
      id: row.id,
      title: row._source?.title ?? row.id,
      creator: row._source?.creator ?? null,
      description: row._source?.description ?? '',
      sourceUrl: row._source?.source_url ?? null,
      expectedExposure: row._source?.expectedExposure ?? null,
      modernAnalog: row._source?.modernAnalog ?? null,
      modernization: row.metadata?.modernization ?? null,
      sourceScaleEstimate: row.metadata?.sourceScaleEstimate ?? null,
      sourceScaleEstimateLabel: row.metadata?.sourceScaleEstimateLabel ?? null,
      sourceLikelyPatternFamily: row.metadata?.sourceLikelyPatternFamily ?? null,
      sourceLikelyStructure: row.metadata?.sourceLikelyStructure ?? null,
      generatedPrompt: row.metadata?.generatedPromptInput ?? flattenInput(row.input),
      generatedPromptHint: row.metadata?.generatedPromptHint ?? null,
      seedReviewContext: {
        reviewKind: 'regenerated-seed-promotion-review',
        provenance: row.metadata?.seedReviewProvenance ?? 'unknown',
        recommendedFromSlice14: row.metadata?.recommendedFromSlice14 === true,
        regenerationQualityScore:
          typeof row.metadata?.regenerationQualityScore === 'number' ? row.metadata.regenerationQualityScore : null,
        antiInflationLevel,
        antiInflationSignals,
        sourceScale: currentScale,
        scaleDrift,
        seedReviewLane: getSeedReviewLane(row),
        sourceScaleEstimate: row.metadata?.sourceScaleEstimate ?? null,
        sourceScaleEstimateLabel: row.metadata?.sourceScaleEstimateLabel ?? null,
        sourceLikelyPatternFamily: row.metadata?.sourceLikelyPatternFamily ?? null,
        sourceLikelyStructure: row.metadata?.sourceLikelyStructure ?? null,
        generatedScaleDelta: row.metadata?.generatedScaleDelta ?? null,
        generatedModernTitle: row.metadata?.generatedModernTitle ?? null,
        generatedModuleId: row.metadata?.generatedModuleId ?? null,
        generatedScale: row.metadata?.generatedScale ?? null,
        generatedScaleValue: row.metadata?.generatedScaleValue ?? null,
        generatedLikelySubmodules: Array.isArray(row.metadata?.generatedLikelySubmodules)
          ? row.metadata.generatedLikelySubmodules
          : [],
        generatedPromptInput: row.metadata?.generatedPromptInput ?? flattenInput(row.input),
        generatedPromptHint: row.metadata?.generatedPromptHint ?? null,
        generatedPromptDraftId: row.metadata?.generatedPromptDraftId ?? null,
        generationVariantId: row.metadata?.generationVariantId ?? row.metadata?.slice14CandidateVariant ?? null,
        researchUsedForModernization: row.metadata?.researchUsedForModernization ?? true,
        usedTargetedFollowupSearch: row.metadata?.usedTargetedFollowupSearch ?? false,
        usedLivecrawl: row.metadata?.usedLivecrawl ?? false,
        searchQuery: row.metadata?.searchQuery ?? null,
        followUpSearchQuery: row.metadata?.followUpSearchQuery ?? null,
        searchSnippetCount: row.metadata?.searchSnippetCount ?? null,
        followUpSnippetCount: row.metadata?.followUpSnippetCount ?? null,
        moduleShapeRecoveredFromSearch: row.metadata?.moduleShapeRecoveredFromSearch ?? null,
        deterministicPass: row.metadata?.deterministicPass ?? null,
        deterministicHardFailures:
          Array.isArray(row.metadata?.deterministicHardFailures) && row.metadata.deterministicHardFailures.length > 0
            ? row.metadata.deterministicHardFailures
            : [],
        generationLineage:
          row.metadata?.generationLineage !== undefined
            ? {
                plannerModel: row.metadata.generationLineage.plannerModel ?? null,
                modernizerModel: row.metadata.generationLineage.modernizerModel ?? null,
                verifierModel: row.metadata.generationLineage.verifierModel ?? null,
                verifierScore: row.metadata.generationLineage.verifierScore ?? null,
              }
            : null,
        coreUserJob: row._source?.coreUserJob ?? null,
        whyRelevant: row._source?.whyRelevant ?? null,
        searchQuerySeed: row._source?.searchQuerySeed ?? null,
        inclusionDecision: row._source?.inclusionDecision ?? null,
      },
    },
    currentClassification: {
      patternFamily: row.metadata?.patternFamily ?? 'unknown',
      mss: {
        ...(row._source?.mss ?? {}),
        regeneratedScale: row.metadata?.generatedScale ?? null,
        regeneratedLikelySubmodules: Array.isArray(row.metadata?.generatedLikelySubmodules)
          ? row.metadata.generatedLikelySubmodules
          : [],
      },
    },
    heuristicPrior: {
      suggestedMinimumScale: heuristic.suggestedScale,
      reasons: heuristic.reasons,
      scaleLooksUnderstated: flagged,
      modernization: row.metadata?.modernization ?? null,
      seedReviewProvenance: row.metadata?.seedReviewProvenance ?? 'unknown',
      recommendedFromSlice14: row.metadata?.recommendedFromSlice14 === true,
      regenerationQualityScore:
        typeof row.metadata?.regenerationQualityScore === 'number' ? row.metadata.regenerationQualityScore : null,
      generatedScale: row.metadata?.generatedScale ?? null,
      generatedScaleValue: row.metadata?.generatedScaleValue ?? null,
      sourceScale: currentScale,
      scaleDrift,
      provenanceBias: provenance,
      slice14Reliable: row.metadata?.reliableFromSlice14 === true,
      slice14Signals: {
        modernRelevance: row.metadata?.slice14DimensionSignals?.modernRelevance,
        promptQuality: row.metadata?.slice14DimensionSignals?.promptQuality,
        mssPlausibility: row.metadata?.slice14DimensionSignals?.mssPlausibility,
        seedWorthiness: row.metadata?.slice14DimensionSignals?.seedWorthiness,
      },
      promptInputLength: flattenInput(row.input).length,
      antiInflationRisk:
        antiInflationLevel === 'high'
          ? 'high'
          : antiInflationSignals.length > 0
            ? 'medium'
            : scaleDrift !== null && scaleDrift >= 2
              ? 'high'
              : 'low',
      antiInflationLevel,
      antiInflationSignals,
      sourceScaleEstimate: row.metadata?.sourceScaleEstimate ?? null,
      sourceScaleEstimateLabel: row.metadata?.sourceScaleEstimateLabel ?? null,
      sourceLikelyPatternFamily: row.metadata?.sourceLikelyPatternFamily ?? null,
      sourceLikelyStructure: row.metadata?.sourceLikelyStructure ?? null,
      generationLineage:
        row.metadata?.generationLineage !== undefined
          ? {
              plannerModel: row.metadata.generationLineage.plannerModel ?? null,
              modernizerModel: row.metadata.generationLineage.modernizerModel ?? null,
              verifierModel: row.metadata.generationLineage.verifierModel ?? null,
              verifierScore: row.metadata.generationLineage.verifierScore ?? null,
            }
          : null,
    },
    calibrationCues: deriveCalibrationCues(row, heuristic),
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
  const judgeOutcome = asRecord(judge.outcome)
  const judgeDimensions = asRecord(judgeOutcome.dimensions)
  const judgeMss = asRecord(judgeOutcome.mss)

  let metaVerification: Record<string, unknown> | undefined
  if (judge.pass) {
    logProgress({
      enabled: progress,
      message: `candidate ${index + 1}/${total}: ${row.id} meta-verifier`,
    })
    metaVerification = (await metaVerifyReclassification({
      input: buildTask(row),
      output: JSON.stringify(judge, null, 2),
      metadata: {
        ...metadata,
        judgeResult: judge,
        metaVerifierPolicy: {
          candidateId: row.id,
          antiInflationLevel,
          antiInflationSignalCount: antiInflationSignals.length,
          antiInflationSignals,
          provenance,
          seedReviewLane: getSeedReviewLane(row),
          deterministicPass: row.metadata?.deterministicPass ?? null,
          hasDeterministicHardFailures: hasDeterministicFailures,
          sourceScale: currentScale,
          generatedScale,
          scaleDrift,
          recommendedFromSlice14: row.metadata?.recommendedFromSlice14 === true,
          reliableFromSlice14: row.metadata?.reliableFromSlice14 === true,
          reviewObjective: 'seed-review',
          antiInflationPolicy:
            antiInflationLevel === 'high' ? 'require-mechanism-evidence' : 'require-concrete-evidence',
          judgePass: judge.pass,
          judgeScore: judge.score,
          judgeReasoning: judge.reasoning,
          judgeKeepForSeedReview: judgeOutcome.keepForSeedReview === true,
          judgePatternFamily: typeof judgeOutcome.patternFamily === 'string' ? judgeOutcome.patternFamily : null,
          judgeScale: typeof judgeMss.scale === 'number' ? judgeMss.scale : null,
          judgeConsistency: typeof judgeDimensions.consistency === 'number' ? judgeDimensions.consistency : null,
          judgeEvidenceFit: typeof judgeDimensions.evidenceUse === 'number' ? judgeDimensions.evidenceUse : null,
          judgeScaleFit: typeof judgeDimensions.scaleFit === 'number' ? judgeDimensions.scaleFit : null,
          judgeFamilyFit: typeof judgeDimensions.familyFit === 'number' ? judgeDimensions.familyFit : null,
        },
      },
    })) as unknown as Record<string, unknown>
  } else {
    logProgress({
      enabled: progress,
      message: `candidate ${index + 1}/${total}: ${row.id} meta-verifier skipped (judge failed)`,
    })
  }

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

const main = async () => {
  const { inputPath, outputPath, limit, onlyFlagged, progress, concurrency, resume } = parseArgs()
  logProgress({ enabled: progress, message: `loading catalog from ${inputPath}` })
  const rows = await parseRows(inputPath)
  const hypercardRows = rows.filter((row) => row.metadata?.promptSource === 'hypercard-archive')

  const allCandidates = hypercardRows
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

  const outputDir = dirname(outputPath)
  if (outputDir && outputDir !== '.') {
    await Bun.$`mkdir -p ${outputDir}`.quiet()
  }

  const errorsPath = getErrorsPath(outputPath)
  const summaryPath = getSummaryPath(outputPath)

  const existingIds = resume ? await readExistingRecordIds(outputPath) : new Set<string>()
  const candidates = allCandidates.filter((entry) => !existingIds.has(entry.row.id))

  logProgress({
    enabled: progress,
    message: `selected ${candidates.length} pending hypercard candidate(s) from ${hypercardRows.length} total (concurrency=${concurrency}, resume=${resume})`,
  })

  if (resume) {
    if (!(await Bun.file(errorsPath).exists())) {
      await resetJsonlOutput(errorsPath)
    }
  } else {
    await resetJsonlOutput(outputPath)
    await resetJsonlOutput(errorsPath)
  }

  const existingSummary = resume
    ? await summarizeExistingRecords(outputPath)
    : {
        processedCandidates: 0,
        trusted: 0,
        recommendedForSeedReview: 0,
        judgeCostUsd: 0,
        metaVerifierCostUsd: 0,
      }

  let processedCandidates = existingSummary.processedCandidates
  let failedCandidates = resume ? await countErrorRows(errorsPath) : 0
  let trusted = existingSummary.trusted
  let seedReview = existingSummary.recommendedForSeedReview
  let judgeCostUsd = existingSummary.judgeCostUsd
  let metaVerifierCostUsd = existingSummary.metaVerifierCostUsd
  let lastFailure: { id: string; message: string } | null = null
  let writeQueue = Promise.resolve()

  const writeSummary = async () => {
    const totalCostUsd = judgeCostUsd + metaVerifierCostUsd
    await Bun.write(
      summaryPath,
      `${JSON.stringify(
        {
          inputPath,
          outputPath,
          errorsPath,
          scannedHypercardRows: hypercardRows.length,
          selectedCandidates: allCandidates.length,
          pendingCandidates: candidates.length,
          processedCandidates,
          failedCandidates,
          trusted,
          recommendedForSeedReview: seedReview,
          spendUsd: {
            judge: Number(judgeCostUsd.toFixed(6)),
            metaVerifier: Number(metaVerifierCostUsd.toFixed(6)),
            total: Number(totalCostUsd.toFixed(6)),
          },
          lastFailure,
          updatedAt: new Date().toISOString(),
        },
        null,
        2,
      )}\n`,
    )
  }

  await writeSummary()

  const recordSuccess = (entry: z.infer<typeof ReclassificationRecordSchema>) => {
    writeQueue = writeQueue.then(async () => {
      await appendJsonlRow(outputPath, entry)
      processedCandidates += 1
      if (entry.trusted) trusted += 1
      if (entry.recommendedForSeedReview) seedReview += 1
      judgeCostUsd += getJudgeCostUsd(asRecord(entry.judge?.outcome).judgeSdk)
      metaVerifierCostUsd += getJudgeCostUsd(asRecord(entry.metaVerification?.outcome).metaVerificationSdk)
      await writeSummary()
    })
    return writeQueue
  }

  const recordFailure = (candidateId: string, error: unknown) => {
    const message = error instanceof Error ? error.message : String(error)
    writeQueue = writeQueue.then(async () => {
      failedCandidates += 1
      lastFailure = { id: candidateId, message }
      await appendJsonlRow(errorsPath, {
        id: candidateId,
        error: message,
      })
      await writeSummary()
    })
    return writeQueue
  }

  let nextIndex = 0
  const runWorker = async () => {
    while (nextIndex < candidates.length) {
      const currentIndex = nextIndex
      nextIndex += 1
      const candidate = candidates[currentIndex]!
      try {
        const record = await processCandidate({
          row: candidate.row,
          heuristic: candidate.heuristic,
          flagged: candidate.flagged,
          index: currentIndex,
          total: candidates.length,
          progress,
        })
        await recordSuccess(record)
      } catch (error: unknown) {
        logProgress({
          enabled: progress,
          message: `candidate ${currentIndex + 1}/${candidates.length}: ${candidate.row.id} failed ${
            error instanceof Error ? error.message : String(error)
          }`,
        })
        await recordFailure(candidate.row.id, error)
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, candidates.length) }, () => runWorker())
  await Promise.all(workers)
  await writeQueue

  logProgress({
    enabled: progress,
    message: `wrote ${processedCandidates} record(s) to ${outputPath}${failedCandidates > 0 ? ` with ${failedCandidates} failure(s)` : ''}`,
  })

  const totalCostUsd = judgeCostUsd + metaVerifierCostUsd

  console.log(
    JSON.stringify(
      {
        inputPath,
        outputPath,
        errorsPath,
        summaryPath,
        scannedHypercardRows: hypercardRows.length,
        processedCandidates,
        failedCandidates,
        trusted,
        recommendedForSeedReview: seedReview,
        spendUsd: {
          judge: Number(judgeCostUsd.toFixed(6)),
          metaVerifier: Number(metaVerifierCostUsd.toFixed(6)),
          total: Number(totalCostUsd.toFixed(6)),
        },
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
