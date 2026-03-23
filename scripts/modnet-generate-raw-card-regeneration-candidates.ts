#!/usr/bin/env bun
import { appendJsonlRow, resetJsonlOutput } from './jsonl-output.ts'
import { type RetainedRawCardCorpusRow, RetainedRawCardCorpusRowSchema } from './modnet-raw-card-base.ts'
import {
  DEFAULT_REGENERATION_CANDIDATES_PATH,
  DEFAULT_RETAINED_RAW_CARD_PATH,
  loadRetainedRawCardRows,
  type RegenerationVariantCandidate,
  RegenerationVariantCandidateSchema,
  type RegenerationVariantId,
} from './modnet-raw-card-regeneration-base.ts'

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

const DEFAULT_SEARCH_COUNT = 5
const TARGET_VOCAB_LIMIT = 8

const parseArgs = () => {
  const args = Bun.argv.slice(2)
  let inputPath = DEFAULT_RETAINED_RAW_CARD_PATH
  let outputPath = DEFAULT_REGENERATION_CANDIDATES_PATH
  let limit: number | undefined
  let quiet = false

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
    if (arg === '--quiet') {
      quiet = true
    }
  }

  return { inputPath, outputPath, limit, quiet }
}

const normalizeText = (value: string): string => value.replace(/\s+/g, ' ').trim()

const normalizeToken = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

const splitTokens = (value: string): string[] => normalizeToken(value).split(/\s+/).filter(Boolean)

const dedupe = <T>(values: T[]): T[] => Array.from(new Set(values))

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

const defaultHeaders = () => {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  }
  if (process.env.YDC_API_KEY) {
    headers['X-API-Key'] = process.env.YDC_API_KEY
  }
  return headers
}

export const runYouSearch = async ({
  query,
  livecrawl,
}: {
  query: string
  livecrawl: boolean
}): Promise<{ snippets: string[]; usedLivecrawl: boolean }> => {
  const url = new URL('https://api.you.com/v1/agents/search')
  url.searchParams.set('query', query)
  url.searchParams.set('count', String(DEFAULT_SEARCH_COUNT))
  if (livecrawl) {
    url.searchParams.set('livecrawl', 'web')
    url.searchParams.set('livecrawl_formats', 'markdown')
  }

  const response = await fetch(url, { headers: defaultHeaders() })
  if (!response.ok) {
    throw new Error(`You.com search failed: ${response.status} ${response.statusText}`)
  }

  const payload = (await response.json()) as SearchResponse
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

export const createSearchVariantCandidate = async ({
  row,
  deep,
}: {
  row: RetainedRawCardCorpusRow
  deep: boolean
}): Promise<RegenerationVariantCandidate> => {
  const initial = await runYouSearch({
    query: row.searchQuerySeed,
    livecrawl: false,
  })
  const initialVocab = extractTopVocabulary(initial.snippets)
  const initialShape = recoverModuleShape({ snippets: initial.snippets, rawCard: row })

  let followUpQuery = ''
  let followUpSnippetCount = 0
  let livecrawlReason = ''
  let usedTargetedFollowUpSearch = false
  let usedLivecrawl = false
  let aggregateSnippets = [...initial.snippets]
  let shape = initialShape

  if (deep && initialShape !== 'clear') {
    usedTargetedFollowUpSearch = true
    followUpQuery = buildFollowUpQuery(row, initialVocab)
    const followUp = await runYouSearch({ query: followUpQuery, livecrawl: false })
    aggregateSnippets = aggregateSnippets.concat(followUp.snippets)
    followUpSnippetCount = followUp.snippets.length
    shape = recoverModuleShape({ snippets: aggregateSnippets, rawCard: row })

    if (shape !== 'clear') {
      usedLivecrawl = true
      livecrawlReason = 'initial and follow-up search still left the module shape unclear'
      const livecrawl = await runYouSearch({ query: followUpQuery || row.searchQuerySeed, livecrawl: true })
      aggregateSnippets = aggregateSnippets.concat(livecrawl.snippets)
      shape = recoverModuleShape({ snippets: aggregateSnippets, rawCard: row })
    }
  }

  const vocab = extractTopVocabulary(aggregateSnippets)
  const structureCue = inferStructureCue(row, vocab)
  const variantId: RegenerationVariantId = deep ? 'base_1_search_followup_livecrawl' : 'base_1_search'

  const research: VariantResearchTrace = {
    usedSearch: true,
    usedTargetedFollowUpSearch,
    usedLivecrawl,
    usedResearchLite: false,
    searchQuery: row.searchQuerySeed,
    followUpSearchQuery: followUpQuery,
    livecrawlReason,
    searchSnippetCount: initial.snippets.length,
    followUpSnippetCount,
    modernWorkflowVocabulary: vocab,
    moduleShapeRecoveredFromSearch: shape,
  }

  return RegenerationVariantCandidateSchema.parse({
    rawCard: RetainedRawCardCorpusRowSchema.parse(row),
    variantId,
    promptDraft: buildPromptDraft({
      row,
      variantId,
      vocab,
      structureCue,
    }),
    research,
    assessment: buildAssessment({
      variantId,
      shape,
      usedLivecrawl,
    }),
  })
}

const logProgress = (enabled: boolean, message: string) => {
  if (enabled) {
    console.error(`[modnet-regeneration-gen] ${message}`)
  }
}

const main = async () => {
  const { inputPath, outputPath, limit, quiet } = parseArgs()
  const summaryPath = toSummaryPath(outputPath)
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
  await resetJsonlOutput(outputPath)
  const byVariant = new Map<RegenerationVariantId, number>()
  let generatedCandidates = 0

  const writeSummary = async () => {
    await Bun.write(
      summaryPath,
      `${JSON.stringify(
        {
          inputPath,
          outputPath,
          summaryPath,
          retainedRows: rows.length,
          generatedCandidates,
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

  for (const [index, row] of rows.entries()) {
    logProgress(!quiet, `row ${index + 1}/${rows.length}: ${row.id} base_1`)
    const baseCandidate = createBaseVariantCandidate(row)
    await appendJsonlRow(outputPath, baseCandidate)
    byVariant.set(baseCandidate.variantId, (byVariant.get(baseCandidate.variantId) ?? 0) + 1)
    generatedCandidates += 1
    await writeSummary()

    logProgress(!quiet, `row ${index + 1}/${rows.length}: ${row.id} base_1_search`)
    const searchCandidate = await createSearchVariantCandidate({ row, deep: false })
    await appendJsonlRow(outputPath, searchCandidate)
    byVariant.set(searchCandidate.variantId, (byVariant.get(searchCandidate.variantId) ?? 0) + 1)
    generatedCandidates += 1
    await writeSummary()

    logProgress(!quiet, `row ${index + 1}/${rows.length}: ${row.id} base_1_search_followup_livecrawl`)
    const followUpCandidate = await createSearchVariantCandidate({ row, deep: true })
    await appendJsonlRow(outputPath, followUpCandidate)
    byVariant.set(followUpCandidate.variantId, (byVariant.get(followUpCandidate.variantId) ?? 0) + 1)
    generatedCandidates += 1
    await writeSummary()
  }

  console.log(
    JSON.stringify(
      {
        inputPath,
        outputPath,
        retainedRows: rows.length,
        generatedCandidates,
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
