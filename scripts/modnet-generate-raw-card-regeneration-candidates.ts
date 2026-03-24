#!/usr/bin/env bun
import * as z from 'zod'
import { fetchSearchResults } from '../node_modules/@youdotcom-oss/api/src/main.ts'
import { appendJsonlRow, resetJsonlOutput } from './jsonl-output.ts'
import { type RetainedRawCardCorpusRow, RetainedRawCardCorpusRowSchema } from './modnet-raw-card-base.ts'
import {
  DEFAULT_REGENERATION_CANDIDATES_PATH,
  DEFAULT_RETAINED_RAW_CARD_PATH,
  loadRetainedRawCardRows,
  type RegenerationModernizerOutput,
  RegenerationModernizerOutputSchema,
  type RegenerationModernizerVerificationOutput,
  RegenerationModernizerVerificationOutputSchema,
  type RegenerationPlannerInitialOutput,
  RegenerationPlannerInitialOutputSchema,
  type RegenerationPlannerRefinementOutput,
  RegenerationPlannerRefinementOutputSchema,
  type RegenerationVariantCandidate,
  RegenerationVariantCandidateSchema,
  type RegenerationVariantId,
  RegenerationVariantIdSchema,
} from './modnet-raw-card-regeneration-base.ts'
import { runStructuredLlmQuery } from './structured-llm-query.ts'

type SearchWebResult = {
  title?: unknown
  description?: unknown
  snippets?: unknown
  contents?: unknown
}

type SearchResponse = {
  results?: {
    web?: SearchWebResult[]
  }
}

type SearchSummary = {
  searchQuery: string
  searchSnippetCount: number
  modernWorkflowVocabulary: string[]
  moduleShapeRecoveredFromSearch: 'unclear' | 'partial' | 'clear'
}

type VariantResearchTrace = RegenerationVariantCandidate['research']
type RowFailureRecord = {
  sourceId: string
  variantIds: RegenerationVariantId[]
  error: string
  failedAt: string
}

const DEFAULT_SEARCH_COUNT = 5
const TARGET_VOCAB_LIMIT = 8
const MAX_YOU_RETRIES = 3
const INITIAL_YOU_BACKOFF_MS = 1_000
const MODEL_STAGE_TIMEOUT_MS = 90_000
const MAX_MODEL_STAGE_RETRIES = 2
const INITIAL_MODEL_STAGE_BACKOFF_MS = 1_000
const MAX_MODEL_STAGE_BACKOFF_MS = 9_999
const DEFAULT_PLANNER_MODEL = 'minimax/minimax-m2.5'
const DEFAULT_MODERNIZER_MODEL = 'minimax/minimax-m2.5'
const DEFAULT_VERIFIER_MODEL = 'minimax/minimax-m2.7'

const parseArgs = () => {
  const args = Bun.argv.slice(2)
  let inputPath = DEFAULT_RETAINED_RAW_CARD_PATH
  let outputPath = DEFAULT_REGENERATION_CANDIDATES_PATH
  let limit: number | undefined
  let concurrency = 1
  let quiet = false
  let variantIds: RegenerationVariantId[] | undefined
  let resume = true
  let plannerModel: string | undefined
  let modernizerModel: string | undefined
  let verifierModel: string | undefined

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
      limit = Math.max(1, Number(args[index + 1]!))
      index += 1
      continue
    }
    if (arg === '--concurrency' && args[index + 1]) {
      concurrency = Math.max(1, Number(args[index + 1]!))
      index += 1
      continue
    }
    if (arg === '--variant' && args[index + 1]) {
      const variantId = RegenerationVariantIdSchema.parse(args[index + 1]!)
      variantIds = dedupe([...(variantIds ?? []), variantId])
      index += 1
      continue
    }
    if (arg === '--planner-model' && args[index + 1]) {
      plannerModel = args[index + 1]!.trim()
      index += 1
      continue
    }
    if (arg === '--modernizer-model' && args[index + 1]) {
      modernizerModel = args[index + 1]!.trim()
      index += 1
      continue
    }
    if (arg === '--verifier-model' && args[index + 1]) {
      verifierModel = args[index + 1]!.trim()
      index += 1
      continue
    }
    if (arg === '--no-resume') {
      resume = false
      continue
    }
    if (arg === '--quiet') {
      quiet = true
    }
  }

  return {
    inputPath,
    outputPath,
    limit,
    concurrency,
    quiet,
    variantIds,
    resume,
    plannerModel,
    modernizerModel,
    verifierModel,
  }
}

const normalizeText = (value: string): string => value.replace(/\s+/g, ' ').trim()

const normalizeToken = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

const splitTokens = (value: string): string[] => normalizeToken(value).split(/\s+/).filter(Boolean)

const dedupe = <T>(values: T[]): T[] => Array.from(new Set(values))

const hasUsefulQueryTerms = (value: string): boolean => {
  const tokens = splitTokens(value)
  if (tokens.length < 3) return false
  return tokens.some((token) => /[a-z]/.test(token))
}

export const chooseSearchQuery = ({ preferred, fallback }: { preferred: string; fallback: string }): string => {
  const normalizedPreferred = normalizeText(preferred)
  if (hasUsefulQueryTerms(normalizedPreferred)) return normalizedPreferred
  return normalizeText(fallback)
}

const stopwords = new Set([
  'that',
  'this',
  'with',
  'from',
  'into',
  'your',
  'their',
  'about',
  'while',
  'using',
  'used',
  'when',
  'where',
  'there',
  'have',
  'over',
  'under',
  'more',
  'less',
  'very',
  'will',
  'only',
  'than',
  'then',
  'also',
  'after',
  'before',
  'mode',
  'tool',
  'tools',
  'software',
  'system',
  'systems',
  'platform',
  'platforms',
  'app',
  'apps',
  'module',
  'modules',
])

const structureSignals: Array<[string, string]> = [
  ['form', 'form'],
  ['forms', 'form'],
  ['record', 'collection'],
  ['records', 'collection'],
  ['history', 'collection'],
  ['tracker', 'collection'],
  ['tracking', 'collection'],
  ['workflow', 'steps'],
  ['wizard', 'steps'],
  ['schedule', 'matrix'],
  ['calendar', 'matrix'],
  ['dashboard', 'collection'],
  ['catalog', 'list'],
  ['directory', 'list'],
  ['reader', 'hypertext'],
  ['annotated', 'hypertext'],
  ['hierarchy', 'hierarchy'],
  ['nested', 'hierarchy'],
]

const extractTopVocabulary = (texts: string[]): string[] => {
  const counts = new Map<string, number>()
  for (const text of texts) {
    for (const token of splitTokens(text)) {
      if (token.length < 4 || stopwords.has(token) || /^\d+$/.test(token)) continue
      counts.set(token, (counts.get(token) ?? 0) + 1)
    }
  }

  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, TARGET_VOCAB_LIMIT)
    .map(([token]) => token)
}

export const recoverModuleShape = ({
  snippets,
  rawCard,
}: {
  snippets: string[]
  rawCard: RetainedRawCardCorpusRow
}): SearchSummary['moduleShapeRecoveredFromSearch'] => {
  const combined = normalizeToken([rawCard.title, rawCard.description, rawCard.likelyStructure, ...snippets].join(' '))
  const uniqueSignals = new Set(
    structureSignals.filter(([signal]) => combined.includes(signal)).map(([, structure]) => structure),
  )

  if (uniqueSignals.size >= 2) return 'clear'
  if (uniqueSignals.size === 1) return 'partial'
  return 'unclear'
}

const inferStructureCue = (row: RetainedRawCardCorpusRow, vocab: string[]): string => {
  const source = normalizeToken([row.likelyStructure, row.description, ...vocab].join(' '))
  for (const [signal, structure] of structureSignals) {
    if (source.includes(signal)) return structure
  }
  return row.likelyStructure
}

export const buildPromptDraft = ({
  row,
  variantId,
  vocab,
  structureCue,
}: {
  row: RetainedRawCardCorpusRow
  variantId: RegenerationVariantId
  vocab: string[]
  structureCue: string
}) => {
  const workflowTerms = vocab.length > 0 ? vocab.slice(0, 4).join(', ') : row.searchQuerySeed
  const boundedShape = `${row.likelyPatternFamily} with ${structureCue} structure`
  const input =
    variantId === 'base_1'
      ? `Build a bounded ${row.modernAnalog} for my own node. It should help me ${row.coreUserJob}. Recover one concrete module, not a broad product suite.`
      : `Build a bounded modern ${row.modernAnalog} for my own node. It should help me ${row.coreUserJob} and use a clear ${structureCue} workflow shaped around ${workflowTerms}. Recover one concrete module, not a broad product suite. Search evidence may refine modern wording and structure, but it must not replace the retained row's core user job.`
  const hint =
    variantId === 'base_1'
      ? `Keep it bounded, recoverable, and consistent with ${boundedShape}. Prefer a sovereign/local-first module over a generic cloud or team product. Do not inflate a thin utility into a platform.`
      : `Stay close to the retained card job, keep the MSS shape recoverable, and avoid copying handcrafted wording while using current workflow vocabulary such as ${workflowTerms}. Prefer a sovereign/local-first module over a generic cloud or team product. If the original medium is obsolete, preserve the durable user job rather than copying nostalgia or over-generalizing into a vague organizer. Search should only sharpen the module shape or modern vocabulary; if search is noisy or generic, fall back to the retained row rather than inventing a broader product.`

  return {
    id: `${row.id}-${variantId}`,
    input: normalizeText(input),
    hint: normalizeText(hint),
    metadata: {
      sourceId: row.id,
      variantId,
      likelyPatternFamily: row.likelyPatternFamily,
      structureCue,
    },
  }
}

const sleep = async (ms: number) => {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

const computeBackoffMs = (attempt: number) =>
  Math.floor(Math.random() * Math.min(MAX_MODEL_STAGE_BACKOFF_MS, INITIAL_MODEL_STAGE_BACKOFF_MS * 2 ** attempt))

const getYouUserAgent = () => 'Plaited/7.x (You.com)'

const withTimeout = async <T>({
  label,
  operation,
  timeoutMs = MODEL_STAGE_TIMEOUT_MS,
}: {
  label: string
  operation: () => Promise<T>
  timeoutMs?: number
}): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs)
  })

  try {
    return await Promise.race([operation(), timeoutPromise])
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}

const isRetryableStageFailure = (reason: string): boolean => {
  const normalized = reason.toLowerCase()
  return (
    normalized.includes('timed out') ||
    normalized.includes('429') ||
    normalized.includes('500') ||
    normalized.includes('502') ||
    normalized.includes('503') ||
    normalized.includes('504') ||
    normalized.includes('zlib') ||
    normalized.includes('decompression') ||
    normalized.includes('no json object found') ||
    normalized.includes('unexpected token') ||
    normalized.includes('invalid input') ||
    normalized.includes('json') ||
    normalized.includes('structured llm query exhausted validation retries')
  )
}

const runRetriableStage = async <T>({
  label,
  operation,
  isRetryableResult,
  timeoutMs = MODEL_STAGE_TIMEOUT_MS,
  onRetry,
}: {
  label: string
  operation: () => Promise<T>
  isRetryableResult?: (result: T) => boolean
  timeoutMs?: number
  onRetry?: (message: string) => void
}): Promise<T> => {
  let lastResult: T | undefined
  for (let attempt = 0; attempt <= MAX_MODEL_STAGE_RETRIES; attempt += 1) {
    try {
      const result = await withTimeout({ label, operation, timeoutMs })
      lastResult = result
      if (isRetryableResult?.(result) && attempt < MAX_MODEL_STAGE_RETRIES) {
        const backoffMs = computeBackoffMs(attempt)
        onRetry?.(`${label} retrying after empty/invalid result in ${backoffMs}ms`)
        await sleep(backoffMs)
        continue
      }
      return result
    } catch (error) {
      const reason = normalizeText(error instanceof Error ? error.message : String(error))
      if (attempt < MAX_MODEL_STAGE_RETRIES && isRetryableStageFailure(reason)) {
        const backoffMs = computeBackoffMs(attempt)
        onRetry?.(`${label} retrying after error in ${backoffMs}ms: ${reason}`)
        await sleep(backoffMs)
        continue
      }
      throw error
    }
  }

  return lastResult as T
}

export const runYouSearch = async ({
  query,
  livecrawl,
}: {
  query: string
  livecrawl: boolean
}): Promise<{ snippets: string[]; usedLivecrawl: boolean }> => {
  let attempt = 0
  let payload: SearchResponse | undefined

  while (attempt <= MAX_YOU_RETRIES) {
    try {
      payload = (await fetchSearchResults({
        searchQuery: {
          query,
          count: DEFAULT_SEARCH_COUNT,
          ...(livecrawl
            ? {
                livecrawl: 'web',
                livecrawl_formats: 'markdown',
              }
            : {}),
        },
        YDC_API_KEY: process.env.YDC_API_KEY,
        getUserAgent: getYouUserAgent,
      })) as SearchResponse
      break
    } catch (error) {
      const reason = normalizeText(error instanceof Error ? error.message : String(error))
      const transient =
        reason.includes('500') ||
        reason.includes('502') ||
        reason.includes('503') ||
        reason.includes('504') ||
        reason.toLowerCase().includes('zlib') ||
        reason.toLowerCase().includes('decompression')

      if (transient && attempt < MAX_YOU_RETRIES) {
        const backoffMs = INITIAL_YOU_BACKOFF_MS * 2 ** attempt
        await sleep(backoffMs)
        attempt += 1
        continue
      }

      throw new Error(`You.com search failed: ${reason}`)
    }
  }

  if (!payload) {
    throw new Error(`You.com search failed after ${MAX_YOU_RETRIES + 1} attempts`)
  }

  const results = Array.isArray(payload.results?.web) ? payload.results?.web : []
  const snippets = results
    .flatMap((result) => {
      const values: string[] = []
      if (typeof result.description === 'string') values.push(result.description)
      if (Array.isArray(result.snippets)) {
        values.push(...result.snippets.filter((value): value is string => typeof value === 'string'))
      }
      if (livecrawl && result.contents && typeof result.contents === 'object') {
        const markdown = (result.contents as Record<string, unknown>).markdown
        if (typeof markdown === 'string') {
          values.push(markdown.slice(0, 1200))
        }
      }
      return values
    })
    .map(normalizeText)
    .filter(Boolean)

  return {
    snippets,
    usedLivecrawl: livecrawl,
  }
}

const buildFollowUpQuery = (row: RetainedRawCardCorpusRow, vocab: string[]) =>
  normalizeText([row.modernAnalog, row.coreUserJob, ...vocab.slice(0, 4)].join(' '))

const toSummaryPath = (outputPath: string) => `${outputPath}.summary.json`
const toErrorPath = (outputPath: string) => `${outputPath}.errors.jsonl`

const truncateForPrompt = (value: string, maxLength = 500): string =>
  value.length <= maxLength ? value : `${value.slice(0, maxLength - 1).trimEnd()}…`

const formatSnippetBlock = (snippets: string[]): string =>
  snippets
    .slice(0, 6)
    .map((snippet, index) => `${index + 1}. ${truncateForPrompt(normalizeText(snippet), 320)}`)
    .join('\n')

const loadExistingCandidates = async (outputPath: string): Promise<RegenerationVariantCandidate[]> => {
  const file = Bun.file(outputPath)
  if (!(await file.exists())) return []
  const text = await file.text()
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => RegenerationVariantCandidateSchema.parse(JSON.parse(line)))
}

const buildPlannerInitialPrompt = (row: RetainedRawCardCorpusRow): string =>
  `You are planning a cheap modernization search for one retained historical software card.

Goal:
- recover a credible modern bounded module, not a broad product suite
- preserve the retained row's core job
- improve the initial search query before retrieval

Rules:
- treat the retained row as the source of truth
- obsolete medium does not mean the job is obsolete
- avoid generic SaaS or team-product inflation
- return only fields that stay close to the retained evidence

Retained row:
${JSON.stringify(
  {
    id: row.id,
    title: row.title,
    description: truncateForPrompt(row.description, 1200),
    inclusionDecision: row.inclusionDecision,
    modernAnalog: row.modernAnalog,
    coreUserJob: row.coreUserJob,
    likelyPatternFamily: row.likelyPatternFamily,
    likelyStructure: row.likelyStructure,
    searchQuerySeed: row.searchQuerySeed,
  },
  null,
  2,
)}`.trim()

const buildPlannerRefinementPrompt = ({
  row,
  initialPlan,
  initialQuery,
  initialSnippets,
  aggregateSnippets,
  variantId,
}: {
  row: RetainedRawCardCorpusRow
  initialPlan: RegenerationPlannerInitialOutput | null
  initialQuery: string
  initialSnippets: string[]
  aggregateSnippets: string[]
  variantId: RegenerationVariantId
}): string =>
  `You are refining a modernization plan for one retained historical software card after search.

Goal:
- decide whether the modernization is credible
- decide whether follow-up search is needed
- decide whether livecrawl is needed
- produce a bounded final prompt draft for one module

Rules:
- preserve the retained row's core job
- use search only to sharpen modern wording and structure
- do not let noisy search redefine the task
- avoid vague organizer/productivity fallback language
- prefer one bounded sovereign/local-first module
- if the evidence is weak, stay restrained rather than inflating the concept

Variant:
- ${variantId}

Retained row:
${JSON.stringify(
  {
    id: row.id,
    title: row.title,
    description: truncateForPrompt(row.description, 1200),
    inclusionDecision: row.inclusionDecision,
    modernAnalog: row.modernAnalog,
    coreUserJob: row.coreUserJob,
    likelyPatternFamily: row.likelyPatternFamily,
    likelyStructure: row.likelyStructure,
    searchQuerySeed: row.searchQuerySeed,
  },
  null,
  2,
)}

Initial planner output:
${JSON.stringify(initialPlan, null, 2)}

Initial search query:
${initialQuery}

Initial search snippets:
${formatSnippetBlock(initialSnippets) || 'none'}

Current aggregate snippets:
${formatSnippetBlock(aggregateSnippets) || 'none'}`.trim()

const buildModernizerPrompt = ({
  row,
  initialQuery,
  followUpQuery,
  aggregateSnippets,
}: {
  row: RetainedRawCardCorpusRow
  initialQuery: string
  followUpQuery: string
  aggregateSnippets: string[]
}): string =>
  `You are modernizing a historical HyperCard software card into a present-day bounded module.

Context:
- HyperCard was a classic Macintosh stack/card platform used heavily in the late 1980s and 1990s.
- The source row is historical. The original platform and medium may be obsolete.
- Your job is to recover the durable modern workflow and shape it into one bounded MSS-style module.

Rules:
- Preserve the core job from the retained row.
- Do not drift into nostalgia, generic SaaS, or a broad suite.
- Prefer one bounded sovereign/local-first module.
- Derive realistic scale and submodules from the evidence, not from ambition.

Return:
- a modernized card description
- one bounded prompt draft
- MSS/module structure hints

Retained row:
${JSON.stringify(
  {
    id: row.id,
    title: row.title,
    description: truncateForPrompt(row.description, 1400),
    inclusionDecision: row.inclusionDecision,
    modernAnalog: row.modernAnalog,
    coreUserJob: row.coreUserJob,
    likelyPatternFamily: row.likelyPatternFamily,
    likelyStructure: row.likelyStructure,
    searchQuerySeed: row.searchQuerySeed,
  },
  null,
  2,
)}

Search context:
${JSON.stringify(
  {
    initialQuery,
    followUpQuery,
    snippets: aggregateSnippets.slice(0, 8).map((snippet) => truncateForPrompt(normalizeText(snippet), 320)),
  },
  null,
  2,
)}`.trim()

const buildModernizerVerifierPrompt = ({
  row,
  modernization,
}: {
  row: RetainedRawCardCorpusRow
  modernization: RegenerationModernizerOutput
}): string =>
  `You are verifying whether a modernized module proposal stays faithful to a retained historical software card.

Goal:
- block inflated or incoherent modernization
- check whether scale and submodules make sense
- check whether the prompt remains bounded and realistic

Rules:
- preserved durable job matters more than historical packaging
- reject broad suites or vague productivity-product inflation
- reject submodules that feel like a roadmap instead of one module

Return exactly one JSON object with these fields:
- pass: boolean
- score: number from 0 to 1
- rationale: short string
- scalePlausible: boolean
- submodulesCoherent: boolean
- promptBounded: boolean

Retained row:
${JSON.stringify(
  {
    id: row.id,
    title: row.title,
    description: truncateForPrompt(row.description, 1200),
    modernAnalog: row.modernAnalog,
    coreUserJob: row.coreUserJob,
    likelyPatternFamily: row.likelyPatternFamily,
    likelyStructure: row.likelyStructure,
  },
  null,
  2,
)}

Modernized proposal:
${JSON.stringify(modernization, null, 2)}`.trim()

const buildAssessment = ({
  variantId,
  shape,
  usedLivecrawl,
}: {
  variantId: RegenerationVariantId
  shape: SearchSummary['moduleShapeRecoveredFromSearch']
  usedLivecrawl: boolean
}): RegenerationVariantCandidate['assessment'] => ({
  modernRelevance: variantId === 'base_1' ? 'medium' : 'high',
  promptQuality: shape === 'clear' ? 'high' : variantId === 'base_1' ? 'medium' : 'medium',
  mssPlausibility: shape === 'clear' ? 'high' : shape === 'partial' ? 'medium' : 'low',
  seedWorthiness: usedLivecrawl ? 'high' : variantId === 'base_1' ? 'low' : 'medium',
  handcraftedAnchorMode: 'pattern_only',
})

export const createBaseVariantCandidate = (row: RetainedRawCardCorpusRow): RegenerationVariantCandidate =>
  RegenerationVariantCandidateSchema.parse({
    rawCard: RetainedRawCardCorpusRowSchema.parse(row),
    variantId: 'base_1',
    promptDraft: buildPromptDraft({
      row,
      variantId: 'base_1',
      vocab: [],
      structureCue: row.likelyStructure,
    }),
    research: {
      usedSearch: false,
      usedTargetedFollowUpSearch: false,
      usedLivecrawl: false,
      usedResearchLite: false,
      searchQuery: '',
      followUpSearchQuery: '',
      livecrawlReason: '',
      searchSnippetCount: 0,
      followUpSnippetCount: 0,
      modernWorkflowVocabulary: [],
      moduleShapeRecoveredFromSearch: 'unclear',
    },
    assessment: buildAssessment({
      variantId: 'base_1',
      shape: 'unclear',
      usedLivecrawl: false,
    }),
  })

const runPlannerInitial = async ({
  model,
  row,
}: {
  model: string
  row: RetainedRawCardCorpusRow
}): Promise<RegenerationPlannerInitialOutput | null> => {
  const result = await runStructuredLlmQuery<RegenerationPlannerInitialOutput>({
    model,
    prompt: buildPlannerInitialPrompt(row),
    schema: z.toJSONSchema(RegenerationPlannerInitialOutputSchema),
  })

  if (!result.ok) return null
  const parsed = RegenerationPlannerInitialOutputSchema.safeParse(result.value)
  return parsed.success ? parsed.data : null
}

const runPlannerRefinement = async ({
  model,
  row,
  initialPlan,
  initialQuery,
  initialSnippets,
  aggregateSnippets,
  variantId,
}: {
  model: string
  row: RetainedRawCardCorpusRow
  initialPlan: RegenerationPlannerInitialOutput | null
  initialQuery: string
  initialSnippets: string[]
  aggregateSnippets: string[]
  variantId: RegenerationVariantId
}): Promise<RegenerationPlannerRefinementOutput | null> => {
  const result = await runStructuredLlmQuery<RegenerationPlannerRefinementOutput>({
    model,
    prompt: buildPlannerRefinementPrompt({
      row,
      initialPlan,
      initialQuery,
      initialSnippets,
      aggregateSnippets,
      variantId,
    }),
    schema: z.toJSONSchema(RegenerationPlannerRefinementOutputSchema),
  })

  if (!result.ok) return null
  const parsed = RegenerationPlannerRefinementOutputSchema.safeParse(result.value)
  return parsed.success ? parsed.data : null
}

const runModernizer = async ({
  model,
  row,
  initialQuery,
  followUpQuery,
  aggregateSnippets,
}: {
  model: string
  row: RetainedRawCardCorpusRow
  initialQuery: string
  followUpQuery: string
  aggregateSnippets: string[]
}): Promise<RegenerationModernizerOutput | null> => {
  const result = await runStructuredLlmQuery<RegenerationModernizerOutput>({
    model,
    prompt: buildModernizerPrompt({
      row,
      initialQuery,
      followUpQuery,
      aggregateSnippets,
    }),
    schema: z.toJSONSchema(RegenerationModernizerOutputSchema),
  })

  if (!result.ok) return null
  const parsed = RegenerationModernizerOutputSchema.safeParse(result.value)
  return parsed.success ? parsed.data : null
}

const runModernizerVerifier = async ({
  model,
  row,
  modernization,
}: {
  model: string
  row: RetainedRawCardCorpusRow
  modernization: RegenerationModernizerOutput
}): Promise<{
  verification: RegenerationModernizerVerificationOutput | null
  failureReason: string
}> => {
  const result = await runStructuredLlmQuery<RegenerationModernizerVerificationOutput>({
    model,
    prompt: buildModernizerVerifierPrompt({
      row,
      modernization,
    }),
    schema: z.toJSONSchema(RegenerationModernizerVerificationOutputSchema),
  })

  if (!result.ok) {
    return {
      verification: null,
      failureReason: result.reason,
    }
  }
  const parsed = RegenerationModernizerVerificationOutputSchema.safeParse(result.value)
  if (!parsed.success) {
    return {
      verification: null,
      failureReason: parsed.error.issues.map((issue) => issue.message).join('; '),
    }
  }
  return {
    verification: parsed.data,
    failureReason: '',
  }
}

export const createSearchVariantCandidate = async ({
  row,
  deep,
  plannerModel,
  modernizerModel,
  verifierModel,
  onProgress,
}: {
  row: RetainedRawCardCorpusRow
  deep: boolean
  plannerModel?: string
  modernizerModel?: string
  verifierModel?: string
  onProgress?: (message: string) => void
}): Promise<RegenerationVariantCandidate> => {
  const variantId: RegenerationVariantId = deep ? 'base_1_search_followup_livecrawl' : 'base_1_search'
  const planner = plannerModel?.trim() ? plannerModel.trim() : DEFAULT_PLANNER_MODEL
  const modernizer = modernizerModel?.trim() ? modernizerModel.trim() : DEFAULT_MODERNIZER_MODEL
  const verifier = verifierModel?.trim() ? verifierModel.trim() : DEFAULT_VERIFIER_MODEL
  onProgress?.(`planner:initial ${planner}`)
  const initialPlan = planner
    ? await runRetriableStage({
        label: `${row.id} planner initial`,
        operation: () =>
          runPlannerInitial({
            model: planner,
            row,
          }),
        isRetryableResult: (result) => result === null,
        onRetry: onProgress,
      })
    : null
  onProgress?.(`planner:initial:done ${planner}`)
  const initialQuery = chooseSearchQuery({
    preferred: initialPlan?.initialSearchQuery || '',
    fallback: row.searchQuerySeed,
  })
  onProgress?.(`search:initial ${initialQuery}`)
  const initial = await runYouSearch({
    query: initialQuery,
    livecrawl: false,
  })
  onProgress?.(`search:initial:done ${initialQuery}`)
  const initialVocab = extractTopVocabulary(initial.snippets)
  const initialShape = recoverModuleShape({ snippets: initial.snippets, rawCard: row })

  onProgress?.(`planner:refine-initial ${planner}`)
  const preliminaryPlan = planner
    ? await runRetriableStage({
        label: `${row.id} planner refinement initial`,
        operation: () =>
          runPlannerRefinement({
            model: planner,
            row,
            initialPlan,
            initialQuery,
            initialSnippets: initial.snippets,
            aggregateSnippets: initial.snippets,
            variantId,
          }),
        isRetryableResult: (result) => result === null,
        onRetry: onProgress,
      })
    : null
  onProgress?.(`planner:refine-initial:done ${planner}`)

  let followUpQuery = ''
  let followUpSnippetCount = 0
  let livecrawlReason = ''
  let usedTargetedFollowUpSearch = false
  let usedLivecrawl = false
  let aggregateSnippets = [...initial.snippets]
  let shape = initialShape

  const plannerWantsFollowUp = preliminaryPlan?.needsFollowUpSearch ?? false
  const plannerWantsLivecrawl = preliminaryPlan?.needsLivecrawl ?? false

  if (deep && (initialShape !== 'clear' || plannerWantsFollowUp || plannerWantsLivecrawl)) {
    usedTargetedFollowUpSearch = true
    followUpQuery = chooseSearchQuery({
      preferred: preliminaryPlan?.followUpSearchQuery || '',
      fallback: buildFollowUpQuery(row, initialVocab),
    })
    onProgress?.(`search:follow-up ${followUpQuery}`)
    const followUp = await runYouSearch({ query: followUpQuery, livecrawl: false })
    aggregateSnippets = aggregateSnippets.concat(followUp.snippets)
    followUpSnippetCount = followUp.snippets.length
    shape = recoverModuleShape({ snippets: aggregateSnippets, rawCard: row })
    onProgress?.(`search:follow-up:done ${followUpQuery}`)

    if (shape !== 'clear' || plannerWantsLivecrawl) {
      usedLivecrawl = true
      livecrawlReason = 'initial and follow-up search still left the module shape unclear'
      onProgress?.(`search:livecrawl ${followUpQuery || row.searchQuerySeed}`)
      const livecrawl = await runYouSearch({ query: followUpQuery || row.searchQuerySeed, livecrawl: true })
      aggregateSnippets = aggregateSnippets.concat(livecrawl.snippets)
      shape = recoverModuleShape({ snippets: aggregateSnippets, rawCard: row })
      onProgress?.(`search:livecrawl:done ${followUpQuery || row.searchQuerySeed}`)
    }
  }

  onProgress?.(`planner:refine-final ${planner}`)
  const finalPlan = planner
    ? await runRetriableStage({
        label: `${row.id} planner refinement final`,
        operation: () =>
          runPlannerRefinement({
            model: planner,
            row,
            initialPlan,
            initialQuery,
            initialSnippets: initial.snippets,
            aggregateSnippets,
            variantId,
          }),
        isRetryableResult: (result) => result === null,
        onRetry: onProgress,
      })
    : null
  onProgress?.(`planner:refine-final:done ${planner}`)

  onProgress?.(`modernizer ${modernizer}`)
  const modernization = await runRetriableStage({
    label: `${row.id} modernizer`,
    operation: () =>
      runModernizer({
        model: modernizer,
        row,
        initialQuery,
        followUpQuery,
        aggregateSnippets,
      }),
    isRetryableResult: (result) => result === null,
    onRetry: onProgress,
  })
  onProgress?.(`modernizer:done ${modernizer}`)
  onProgress?.(`verifier ${verifier}`)
  const modernizationVerificationResult = modernization
    ? await runRetriableStage({
        label: `${row.id} modernizer verifier`,
        operation: () =>
          runModernizerVerifier({
            model: verifier,
            row,
            modernization,
          }),
        isRetryableResult: (result) => result.verification === null && result.failureReason.length > 0,
        onRetry: onProgress,
      })
    : null
  onProgress?.(`verifier:done ${verifier}`)
  const modernizationVerification = modernizationVerificationResult?.verification ?? null
  const verifierFailureReason = modernizationVerificationResult?.failureReason ?? ''

  const vocab = extractTopVocabulary(aggregateSnippets)
  const structureCue = normalizeText(
    modernization?.likelyStructure ||
      finalPlan?.likelyStructure ||
      initialPlan?.likelyStructure ||
      inferStructureCue(row, vocab),
  )
  const plannerMetadata = {
    plannerModel: planner,
    plannerInitialUsed: Boolean(initialPlan),
    plannerRefinementUsed: Boolean(finalPlan || preliminaryPlan),
    plannerFinalPromptUsed: Boolean(finalPlan?.promptInput.trim() && finalPlan?.promptHint.trim()),
    plannerFallbackReason:
      finalPlan && finalPlan.promptInput.trim() && finalPlan.promptHint.trim()
        ? ''
        : 'planner-final-prompt-missing-or-empty',
    modernizerModel: modernizer,
    modernizerUsed: Boolean(modernization),
    verifierModel: verifier,
    verifierUsed: Boolean(modernizationVerification),
    verifierPass: modernizationVerification?.pass ?? false,
    verifierScore: modernizationVerification?.score ?? 0,
    verifierFallbackReason: modernizationVerification
      ? ''
      : verifierFailureReason || (modernization ? 'verifier-missing' : 'modernizer-or-verifier-missing'),
  }

  const research: VariantResearchTrace = {
    usedSearch: true,
    usedTargetedFollowUpSearch,
    usedLivecrawl,
    usedResearchLite: false,
    searchQuery: initialQuery,
    followUpSearchQuery: followUpQuery,
    livecrawlReason,
    searchSnippetCount: initial.snippets.length,
    followUpSnippetCount,
    modernWorkflowVocabulary: vocab,
    moduleShapeRecoveredFromSearch: shape,
  }

  const fallbackDraft = buildPromptDraft({
    row: {
      ...row,
      modernAnalog: normalizeText(
        modernization?.modernAnalog || finalPlan?.modernAnalog || initialPlan?.modernAnalog || row.modernAnalog,
      ),
      coreUserJob: normalizeText(
        modernization?.coreUserJob || finalPlan?.coreUserJob || initialPlan?.coreUserJob || row.coreUserJob,
      ),
    },
    variantId,
    vocab,
    structureCue,
  })

  return RegenerationVariantCandidateSchema.parse({
    rawCard: RetainedRawCardCorpusRowSchema.parse(row),
    variantId,
    promptDraft:
      modernization &&
      modernizationVerification?.pass &&
      modernization.promptInput.trim() &&
      modernization.promptHint.trim()
        ? {
            id: `${row.id}-${variantId}`,
            input: normalizeText(modernization.promptInput),
            hint: normalizeText(modernization.promptHint),
            metadata: {
              sourceId: row.id,
              variantId,
              likelyPatternFamily: row.likelyPatternFamily,
              structureCue,
              modernTitle: normalizeText(modernization.modernTitle),
              mssModule: normalizeText(modernization.mssModule),
              scale: modernization.scale,
              likelySubmodules: modernization.likelySubmodules,
              ...plannerMetadata,
            },
          }
        : {
            ...fallbackDraft,
            metadata: {
              ...(fallbackDraft.metadata ?? {}),
              ...plannerMetadata,
            },
          },
    research,
    assessment: buildAssessment({
      variantId,
      shape:
        modernizationVerification?.pass && modernization
          ? modernization.scale === 'S1' || modernization.scale === 'S2'
            ? 'clear'
            : shape
          : shape,
      usedLivecrawl,
    }),
  })
}

const logProgress = (enabled: boolean, message: string) => {
  if (enabled) {
    console.error(`[modnet-regeneration-gen] ${message}`)
  }
}

const runConcurrent = async <T>({
  items,
  concurrency,
  worker,
  onWorkerError,
}: {
  items: T[]
  concurrency: number
  worker: (item: T, index: number) => Promise<void>
  onWorkerError?: (error: unknown, item: T, index: number) => Promise<void> | void
}) => {
  let nextIndex = 0

  const runWorker = async () => {
    while (true) {
      const currentIndex = nextIndex
      nextIndex += 1
      const item = items[currentIndex]
      if (!item) return
      try {
        await worker(item, currentIndex)
      } catch (error) {
        await onWorkerError?.(error, item, currentIndex)
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => runWorker()))
}

const main = async () => {
  const {
    inputPath,
    outputPath,
    limit,
    concurrency,
    quiet,
    variantIds,
    resume,
    plannerModel,
    modernizerModel,
    verifierModel,
  } = parseArgs()
  const summaryPath = toSummaryPath(outputPath)
  const errorPath = toErrorPath(outputPath)
  const allRows =
    inputPath === DEFAULT_RETAINED_RAW_CARD_PATH
      ? await loadRetainedRawCardRows()
      : await (async () => {
          const text = await Bun.file(inputPath).text()
          return text
            .split(/\n+/)
            .map((line) => line.trim())
            .filter(Boolean)
            .map((line) => RetainedRawCardCorpusRowSchema.parse(JSON.parse(line)))
        })()
  const rows = typeof limit === 'number' ? allRows.slice(0, limit) : allRows
  const selectedVariantIds =
    variantIds && variantIds.length > 0
      ? variantIds
      : (['base_1', 'base_1_search', 'base_1_search_followup_livecrawl'] as RegenerationVariantId[])
  const existingCandidates = resume ? await loadExistingCandidates(outputPath) : []
  if (!resume || existingCandidates.length === 0) {
    await resetJsonlOutput(outputPath)
    await resetJsonlOutput(errorPath)
  }
  const byVariant = new Map<RegenerationVariantId, number>()
  for (const candidate of existingCandidates) {
    byVariant.set(candidate.variantId, (byVariant.get(candidate.variantId) ?? 0) + 1)
  }
  let generatedCandidates = existingCandidates.length
  let failedRows = 0
  let lastFailure: RowFailureRecord | null = null
  const completedBySourceId = new Map<string, Set<RegenerationVariantId>>()
  for (const candidate of existingCandidates) {
    const completed = completedBySourceId.get(candidate.rawCard.id) ?? new Set<RegenerationVariantId>()
    completed.add(candidate.variantId)
    completedBySourceId.set(candidate.rawCard.id, completed)
  }
  const pendingRows = rows.filter((row) => {
    const completed = completedBySourceId.get(row.id)
    if (!completed) return true
    return selectedVariantIds.some((variantId) => !completed.has(variantId))
  })

  const writeSummary = async () => {
    await Bun.write(
      summaryPath,
      `${JSON.stringify(
        {
          inputPath,
          outputPath,
          summaryPath,
          errorPath,
          selectedVariantIds,
          retainedRows: rows.length,
          pendingRows: pendingRows.length,
          resumedCandidates: existingCandidates.length,
          generatedCandidates,
          failedRows,
          lastFailure,
          byVariant: Object.fromEntries(
            dedupe(Array.from(byVariant.keys())).map((variantId) => [variantId, byVariant.get(variantId) ?? 0]),
          ),
          updatedAt: new Date().toISOString(),
        },
        null,
        2,
      )}\n`,
    )
  }

  await writeSummary()

  let writeQueue = Promise.resolve()

  const recordCandidate = async (candidate: RegenerationVariantCandidate) => {
    byVariant.set(candidate.variantId, (byVariant.get(candidate.variantId) ?? 0) + 1)
    generatedCandidates += 1
    writeQueue = writeQueue.then(async () => {
      await appendJsonlRow(outputPath, candidate)
      await writeSummary()
    })
    await writeQueue
  }

  const recordFailure = async (failure: RowFailureRecord) => {
    failedRows += 1
    lastFailure = failure
    writeQueue = writeQueue.then(async () => {
      await appendJsonlRow(errorPath, failure)
      await writeSummary()
    })
    await writeQueue
  }

  await runConcurrent({
    items: pendingRows,
    concurrency,
    worker: async (row, index) => {
      const completed = completedBySourceId.get(row.id) ?? new Set<RegenerationVariantId>()
      if (selectedVariantIds.includes('base_1')) {
        if (!completed.has('base_1')) {
          logProgress(!quiet, `row ${index + 1}/${pendingRows.length}: ${row.id} base_1`)
          const baseCandidate = createBaseVariantCandidate(row)
          await recordCandidate(baseCandidate)
        }
      }

      if (selectedVariantIds.includes('base_1_search')) {
        if (!completed.has('base_1_search')) {
          logProgress(!quiet, `row ${index + 1}/${pendingRows.length}: ${row.id} base_1_search`)
          const searchCandidate = await createSearchVariantCandidate({
            row,
            deep: false,
            plannerModel,
            modernizerModel,
            verifierModel,
            onProgress: (message) =>
              logProgress(!quiet, `row ${index + 1}/${pendingRows.length}: ${row.id} ${message}`),
          })
          await recordCandidate(searchCandidate)
        }
      }

      if (selectedVariantIds.includes('base_1_search_followup_livecrawl')) {
        if (!completed.has('base_1_search_followup_livecrawl')) {
          logProgress(!quiet, `row ${index + 1}/${pendingRows.length}: ${row.id} base_1_search_followup_livecrawl`)
          const followUpCandidate = await createSearchVariantCandidate({
            row,
            deep: true,
            plannerModel,
            modernizerModel,
            verifierModel,
            onProgress: (message) =>
              logProgress(!quiet, `row ${index + 1}/${pendingRows.length}: ${row.id} ${message}`),
          })
          await recordCandidate(followUpCandidate)
        }
      }
    },
    onWorkerError: async (error, row) => {
      const message = error instanceof Error ? error.message : String(error)
      await recordFailure({
        sourceId: row.id,
        variantIds: selectedVariantIds,
        error: normalizeText(message),
        failedAt: new Date().toISOString(),
      })
      logProgress(!quiet, `row failure: ${row.id} ${normalizeText(message)}`)
    },
  })

  console.log(
    JSON.stringify(
      {
        inputPath,
        outputPath,
        concurrency,
        selectedVariantIds,
        retainedRows: rows.length,
        pendingRows: pendingRows.length,
        resumedCandidates: existingCandidates.length,
        generatedCandidates,
        failedRows,
        byVariant: Object.fromEntries(
          dedupe(Array.from(byVariant.keys())).map((variantId) => [variantId, byVariant.get(variantId) ?? 0]),
        ),
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
