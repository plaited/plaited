#!/usr/bin/env bun

import { join, resolve } from 'node:path'
import { extractSectionsFromMarkdown, type SkillSection } from '../src/tools/skill-links.ts'
import { embed } from './embedding-adapter.ts'
import { runStructuredLlmQuery } from './structured-llm-query.ts'

export type SourceFamily = 'mss' | 'modnet-node' | 'modnet-modules' | 'docs-chunks'
export type Disposition = 'preserve' | 'reinterpret' | 'archive'

export type ComparisonSection = {
  id: string
  path: string
  heading: string
  headingPath: string[]
  kind: SkillSection['kind']
  text: string
  sourceFamily: SourceFamily
}

export type DeterministicPair = {
  leftId: string
  rightId: string
  score: number
  sharedTerms: string[]
  leftDisposition: Disposition
  rightDisposition: Disposition
}

export type EmbeddingPair = {
  leftId: string
  rightId: string
  cosine: number
}

export type PairReview = {
  relation: 'support' | 'overlap' | 'conflict' | 'reinterpret'
  disposition: Disposition
  reason: string
}

export type ConceptProposal = {
  name: string
  type: 'concept' | 'relation' | 'heuristic'
  reason: string
}

export type SourceCompareReport = {
  input: {
    chunkPath: string
    markdownPaths: string[]
  }
  totals: {
    sections: number
    deterministicPairs: number
  }
  deterministic: {
    pairs: DeterministicPair[]
  }
  embeddings?: {
    pairs: EmbeddingPair[]
  }
  llm?: {
    pairReviews: Array<{ pair: DeterministicPair; review: PairReview }>
    conceptProposals: Array<{ sectionId: string; proposals: ConceptProposal[] }>
  }
}

const DEFAULT_CHUNK_PATH = join('.prompts', 'mss-doc-chunks', 'chunks.jsonl')
export const DEFAULT_MSS_COMPARE_EMBEDDING_MODEL = 'nvidia/llama-nemotron-embed-vl-1b-v2:free'
const DEFAULT_MARKDOWN_PATHS = [
  join('skills', 'mss', 'SKILL.md'),
  join('skills', 'mss', 'references', 'dynamics-distilled.md'),
  join('skills', 'mss', 'references', 'modnet-standards-distilled.md'),
  join('skills', 'mss', 'references', 'structural-ia-distilled.md'),
  join('skills', 'mss', 'references', 'valid-combinations.md'),
  join('skills', 'modnet-node', 'SKILL.md'),
  join('skills', 'modnet-modules', 'SKILL.md'),
] as const

const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'by',
  'for',
  'from',
  'how',
  'in',
  'into',
  'is',
  'it',
  'of',
  'on',
  'or',
  'that',
  'the',
  'their',
  'this',
  'to',
  'use',
  'what',
  'when',
  'with',
])

const REINTERPRET_HINTS = [
  'auto-group',
  'auto-populate',
  'template',
  'templates',
  'crowd-sourced',
  'platform patterns',
  'platform-owned',
  'agent card contains mss metadata',
  'modnet:mss:',
]

const ARCHIVE_HINTS = ['download — user gets a module template', 'crowd-sourced repository']

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

export const tokenize = (value: string): string[] =>
  normalizeText(value)
    .split(' ')
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token))

export const buildSignature = (section: Pick<ComparisonSection, 'headingPath' | 'text'>): string[] => {
  const headingTokens = tokenize(section.headingPath.join(' '))
  const textTokens = tokenize(section.text).slice(0, 30)
  return [...new Set([...headingTokens, ...textTokens])]
}

export const jaccardSimilarity = (left: string[], right: string[]) => {
  const leftSet = new Set(left)
  const rightSet = new Set(right)
  const intersection = [...leftSet].filter((token) => rightSet.has(token))
  const union = new Set([...leftSet, ...rightSet])
  return union.size === 0 ? 0 : intersection.length / union.size
}

export const classifyDisposition = (section: Pick<ComparisonSection, 'path' | 'text'>): Disposition => {
  const normalized = normalizeText(`${section.path} ${section.text}`)
  if (ARCHIVE_HINTS.some((hint) => normalized.includes(normalizeText(hint)))) {
    return 'archive'
  }
  if (
    normalized.includes('pre-agent') ||
    normalized.includes('reinterpret') ||
    REINTERPRET_HINTS.some((hint) => normalized.includes(normalizeText(hint)))
  ) {
    return 'reinterpret'
  }
  return 'preserve'
}

const detectSourceFamily = (path: string): SourceFamily => {
  if (path.includes('skills/mss/')) return 'mss'
  if (path.includes('skills/modnet-node/')) return 'modnet-node'
  if (path.includes('skills/modnet-modules/')) return 'modnet-modules'
  return 'docs-chunks'
}

export const convertSkillSection = (path: string, section: SkillSection): ComparisonSection => ({
  id: `${path}#${section.id}`,
  path,
  heading: section.heading,
  headingPath: section.headingPath,
  kind: section.kind,
  text: section.text,
  sourceFamily: detectSourceFamily(path),
})

export const loadMarkdownSections = async (paths: readonly string[]): Promise<ComparisonSection[]> => {
  const sections: ComparisonSection[] = []

  for (const path of paths) {
    const resolvedPath = resolve(path)
    const file = Bun.file(resolvedPath)
    if (!(await file.exists())) continue
    const content = await file.text()
    const extracted = extractSectionsFromMarkdown({ path: resolvedPath, content })
    sections.push(...extracted.map((section) => convertSkillSection(resolvedPath, section)))
  }

  return sections
}

export const loadChunkSections = async (path: string): Promise<ComparisonSection[]> => {
  const resolvedPath = resolve(path)
  const file = Bun.file(resolvedPath)
  if (!(await file.exists())) return []

  const lines = (await file.text())
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  return lines.map((line, index) => {
    const row = JSON.parse(line) as {
      sourcePath: string
      heading: string
      headingPath: string[]
      kind: SkillSection['kind']
      text: string
    }

    return {
      id: `${row.sourcePath}#chunk-${index.toString().padStart(4, '0')}`,
      path: row.sourcePath,
      heading: row.heading,
      headingPath: row.headingPath,
      kind: row.kind,
      text: row.text,
      sourceFamily: 'docs-chunks' as const,
    }
  })
}

export const buildDeterministicPairs = (sections: ComparisonSection[], limit = 40): DeterministicPair[] => {
  const tokenIndex = new Map<string, Set<number>>()
  const signatures = sections.map((section) => buildSignature(section))

  signatures.forEach((signature, sectionIndex) => {
    for (const token of signature) {
      const bucket = tokenIndex.get(token) ?? new Set<number>()
      bucket.add(sectionIndex)
      tokenIndex.set(token, bucket)
    }
  })

  const seen = new Set<string>()
  const pairs: DeterministicPair[] = []

  sections.forEach((section, leftIndex) => {
    const candidateIndexes = new Set<number>()
    for (const token of signatures[leftIndex] ?? []) {
      for (const index of tokenIndex.get(token) ?? []) {
        if (index !== leftIndex) candidateIndexes.add(index)
      }
    }

    for (const rightIndex of candidateIndexes) {
      const right = sections[rightIndex]
      if (!right || section.sourceFamily === right.sourceFamily) continue

      const key = [leftIndex, rightIndex].sort((a, b) => a - b).join(':')
      if (seen.has(key)) continue
      seen.add(key)

      const leftSignature = signatures[leftIndex] ?? []
      const rightSignature = signatures[rightIndex] ?? []
      const score = jaccardSimilarity(leftSignature, rightSignature)
      if (score < 0.16) continue

      const sharedTerms = leftSignature.filter((token) => rightSignature.includes(token)).slice(0, 8)
      pairs.push({
        leftId: section.id,
        rightId: right.id,
        score,
        sharedTerms,
        leftDisposition: classifyDisposition(section),
        rightDisposition: classifyDisposition(right),
      })
    }
  })

  return pairs.sort((left, right) => right.score - left.score).slice(0, limit)
}

const dotProduct = (left: number[], right: number[]) =>
  left.reduce((sum, value, index) => sum + value * (right[index] ?? 0), 0)
const magnitude = (vector: number[]) => Math.sqrt(dotProduct(vector, vector))
export const cosineSimilarity = (left: number[], right: number[]) => {
  const denominator = magnitude(left) * magnitude(right)
  return denominator === 0 ? 0 : dotProduct(left, right) / denominator
}

export const buildEmbeddingPairs = async (
  sections: ComparisonSection[],
  pairs: DeterministicPair[],
  limit = 20,
): Promise<EmbeddingPair[]> => {
  const selectedIds = [...new Set(pairs.flatMap((pair) => [pair.leftId, pair.rightId]))]
  const selectedSections = selectedIds
    .map((id) => sections.find((section) => section.id === id))
    .filter((section): section is ComparisonSection => Boolean(section))

  const result = await embed({
    model: process.env.PLAITED_MSS_COMPARE_EMBED_MODEL?.trim() || DEFAULT_MSS_COMPARE_EMBEDDING_MODEL,
    texts: selectedSections.map((section) => `${section.headingPath.join(' / ')}\n${section.text.slice(0, 1200)}`),
  })

  const embeddingMap = new Map<string, number[]>()
  selectedSections.forEach((section, index) => {
    embeddingMap.set(section.id, result.embeddings[index] ?? [])
  })

  const embeddingPairs = pairs
    .map((pair) => ({
      leftId: pair.leftId,
      rightId: pair.rightId,
      cosine: cosineSimilarity(embeddingMap.get(pair.leftId) ?? [], embeddingMap.get(pair.rightId) ?? []),
    }))
    .sort((left, right) => right.cosine - left.cosine)
    .slice(0, limit)

  return embeddingPairs
}

export const buildPairReviewPrompt = ({
  left,
  right,
}: {
  left: ComparisonSection
  right: ComparisonSection
}) => `Compare these two source sections for MSS/default-hypergraph distillation.

Classify whether they support each other, overlap, conflict, or should be reinterpreted.
Also decide whether the older source material should be preserved, reinterpreted, or archived
for the current agent-era architecture.

LEFT
- path: ${left.path}
- heading: ${left.headingPath.join(' / ')}
${left.text}

RIGHT
- path: ${right.path}
- heading: ${right.headingPath.join(' / ')}
${right.text}
`

export const buildConceptPrompt = ({
  section,
}: {
  section: ComparisonSection
}) => `Extract normalized hypergraph candidates from this MSS/modnet source section.

Prefer durable concepts, relations, or heuristics that belong in the default hypergraph.
Do not repeat prose. Normalize names.

SOURCE
- path: ${section.path}
- heading: ${section.headingPath.join(' / ')}
${section.text}
`

const PairReviewSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['relation', 'disposition', 'reason'],
  properties: {
    relation: {
      type: 'string',
      enum: ['support', 'overlap', 'conflict', 'reinterpret'],
    },
    disposition: {
      type: 'string',
      enum: ['preserve', 'reinterpret', 'archive'],
    },
    reason: { type: 'string' },
  },
} as const

const ConceptSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['proposals'],
  properties: {
    proposals: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'type', 'reason'],
        properties: {
          name: { type: 'string' },
          type: { type: 'string', enum: ['concept', 'relation', 'heuristic'] },
          reason: { type: 'string' },
        },
      },
    },
  },
} as const

const parseArgs = (argv: string[]) => {
  let chunkPath = DEFAULT_CHUNK_PATH
  let outputPath = join('.prompts', 'mss-source-compare', 'report.json')
  let withEmbeddings = false
  let withLlm = false
  let pairLimit = 40
  let markdownPaths = [...DEFAULT_MARKDOWN_PATHS]

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    const next = argv[index + 1]
    if (!arg) continue

    if (arg === '--chunks' && next) {
      chunkPath = next
      index += 1
      continue
    }
    if (arg === '--output' && next) {
      outputPath = next
      index += 1
      continue
    }
    if (arg === '--pair-limit' && next) {
      pairLimit = Number(next)
      index += 1
      continue
    }
    if (arg === '--markdown' && next) {
      markdownPaths = next
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
      index += 1
      continue
    }
    if (arg === '--with-embeddings') {
      withEmbeddings = true
      continue
    }
    if (arg === '--with-llm') {
      withLlm = true
    }
  }

  return { chunkPath, outputPath, withEmbeddings, withLlm, pairLimit, markdownPaths }
}

const resolveAnalysisModel = () => process.env.PLAITED_COMPARE_MODEL?.trim() || 'minimax/minimax-m2.7'
const resolveConceptModel = () => process.env.PLAITED_CONCEPT_MODEL?.trim() || 'z-ai/glm-5'

export const buildReport = async ({
  chunkPath,
  markdownPaths,
  pairLimit,
  withEmbeddings,
  withLlm,
}: {
  chunkPath: string
  markdownPaths: string[]
  pairLimit: number
  withEmbeddings: boolean
  withLlm: boolean
}): Promise<SourceCompareReport> => {
  const markdownSections = await loadMarkdownSections(markdownPaths)
  const chunkSections = await loadChunkSections(chunkPath)
  const sections = [...markdownSections, ...chunkSections]
  const deterministicPairs = buildDeterministicPairs(sections, pairLimit)

  const report: SourceCompareReport = {
    input: {
      chunkPath: resolve(chunkPath),
      markdownPaths: markdownPaths.map((path) => resolve(path)),
    },
    totals: {
      sections: sections.length,
      deterministicPairs: deterministicPairs.length,
    },
    deterministic: {
      pairs: deterministicPairs,
    },
  }

  if (withEmbeddings) {
    report.embeddings = {
      pairs: await buildEmbeddingPairs(sections, deterministicPairs),
    }
  }

  if (withLlm) {
    const pairReviews: Array<{ pair: DeterministicPair; review: PairReview }> = []
    for (const pair of deterministicPairs.slice(0, 8)) {
      const left = sections.find((section) => section.id === pair.leftId)
      const right = sections.find((section) => section.id === pair.rightId)
      if (!left || !right) continue

      const review = await runStructuredLlmQuery<PairReview>({
        model: resolveAnalysisModel(),
        prompt: buildPairReviewPrompt({ left, right }),
        schema: PairReviewSchema,
      })

      if (review.ok) {
        pairReviews.push({ pair, review: review.value })
      }
    }

    const conceptProposals: Array<{ sectionId: string; proposals: ConceptProposal[] }> = []
    const candidateSections = sections.filter((section) => classifyDisposition(section) !== 'archive').slice(0, 8)

    for (const section of candidateSections) {
      const proposal = await runStructuredLlmQuery<{ proposals: ConceptProposal[] }>({
        model: resolveConceptModel(),
        prompt: buildConceptPrompt({ section }),
        schema: ConceptSchema,
      })

      if (proposal.ok) {
        conceptProposals.push({
          sectionId: section.id,
          proposals: proposal.value.proposals,
        })
      }
    }

    report.llm = {
      pairReviews,
      conceptProposals,
    }
  }

  return report
}

const main = async () => {
  const { chunkPath, outputPath, withEmbeddings, withLlm, pairLimit, markdownPaths } = parseArgs(process.argv.slice(2))
  const report = await buildReport({
    chunkPath,
    markdownPaths,
    pairLimit,
    withEmbeddings,
    withLlm,
  })

  const resolvedOutputPath = resolve(outputPath)
  await Bun.$`mkdir -p ${join(resolvedOutputPath, '..')}`.quiet()
  await Bun.write(resolvedOutputPath, `${JSON.stringify(report, null, 2)}\n`)
  console.log(JSON.stringify({ outputPath: resolvedOutputPath, totals: report.totals }, null, 2))
}

if (import.meta.main) {
  await main()
}
