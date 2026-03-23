import * as z from 'zod'

export const RawPromptCardSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
})

export const Base1InclusionDecisionSchema = z.enum(['retain', 'retain_low_priority', 'discard'])

export const Base1InclusionCandidateSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  inclusionDecision: Base1InclusionDecisionSchema,
  modernAnalog: z.string(),
  coreUserJob: z.string(),
  whyRelevant: z.string(),
  likelyPatternFamily: z.string(),
  likelyStructure: z.string(),
  searchQuerySeed: z.string(),
})

export const RetainedRawCardCorpusRowSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  inclusionDecision: z.enum(['retain', 'retain_low_priority']),
  modernAnalog: z.string(),
  coreUserJob: z.string(),
  whyRelevant: z.string(),
  likelyPatternFamily: z.string(),
  likelyStructure: z.string(),
  searchQuerySeed: z.string(),
})

export const RawCardEvaluationSummarySchema = z.object({
  stage: z.enum(['deterministic_prefilter', 'codex_generation', 'sonnet_judgment', 'haiku_meta_verification']),
  role: z.string(),
  purpose: z.string(),
})

export type RawPromptCard = z.infer<typeof RawPromptCardSchema>
export type Base1InclusionCandidate = z.infer<typeof Base1InclusionCandidateSchema>
export type RetainedRawCardCorpusRow = z.infer<typeof RetainedRawCardCorpusRowSchema>

type RawCatalogRow = {
  id?: unknown
  title?: unknown
  description?: unknown
}

export const BASE_1_VALIDATION_PLAN = RawCardEvaluationSummarySchema.array().parse([
  {
    stage: 'deterministic_prefilter',
    role: 'Script guardrails',
    purpose: 'Validate source rows, enforce id/title/description-only inputs, and block malformed candidates.',
  },
  {
    stage: 'codex_generation',
    role: 'Codex',
    purpose: 'Generate the Base 1 inclusion decision and compact corollaries from id, title, and description only.',
  },
  {
    stage: 'sonnet_judgment',
    role: 'Claude Sonnet',
    purpose: 'Judge whether the Codex output is coherent, restrained, and modnet-relevant.',
  },
  {
    stage: 'haiku_meta_verification',
    role: 'Claude Haiku',
    purpose: 'Verify the Sonnet result for consistency, confidence, and downstream risk.',
  },
])

export const normalizeRawCardText = (value: string): string => value.replace(/\s+/g, ' ').trim()

export const parseRawPromptCard = (line: string): RawPromptCard | null => {
  const parsed = JSON.parse(line) as RawCatalogRow
  if (typeof parsed.id !== 'string' || typeof parsed.title !== 'string' || typeof parsed.description !== 'string') {
    return null
  }

  const row = {
    id: normalizeRawCardText(parsed.id),
    title: normalizeRawCardText(parsed.title),
    description: normalizeRawCardText(parsed.description),
  }

  return row.id && row.title && row.description ? RawPromptCardSchema.parse(row) : null
}

export const loadJsonlRows = async <T>(path: string, schema: z.ZodSchema<T>): Promise<T[]> => {
  const text = await Bun.file(path).text()
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => schema.parse(JSON.parse(line)))
}

export const loadRawPromptCards = async (path: string): Promise<RawPromptCard[]> => {
  const text = await Bun.file(path).text()
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseRawPromptCard)
    .filter((row): row is RawPromptCard => row !== null)
}

export const dedupeRawPromptCards = (rows: RawPromptCard[]): RawPromptCard[] => {
  const seen = new Set<string>()
  const deduped: RawPromptCard[] = []

  for (const row of rows) {
    if (seen.has(row.id)) continue
    seen.add(row.id)
    deduped.push(row)
  }

  return deduped
}
