#!/usr/bin/env bun

import { join } from 'node:path'

type SeedReviewRow = {
  id: string
  title?: string
  trusted?: boolean
  recommendedForSeedReview?: boolean
  current?: {
    patternFamily?: string | null
    mss?: {
      structure?: string | null
      scale?: number | null
      confidence?: string | null
    }
  }
}

type RegeneratedCandidateRow = {
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
    input: string | string[]
    hint?: string | null
    metadata?: {
      modernTitle?: string | null
      likelyPatternFamily?: string | null
      scale?: string | null
      [key: string]: unknown
    }
  }
}

type DerivedRecommendedRow = {
  candidate: {
    id: string
    sourceId: string
    targetScale?: string | null
    input: string | string[]
    hint?: string | null
    seedContext?: {
      rewrittenTitle?: string | null
      sourceTitle?: string | null
      approvedParentFamily?: string | null
      sourceFamily?: string | null
      sourceScale?: number | null
      sourceScaleLabel?: string | null
    }
    metadata?: {
      patternFamily?: string | null
      [key: string]: unknown
    }
  }
  recommended: boolean
  sourcePrompt?: {
    id?: string
    title?: string
    metadata?: {
      patternFamily?: string | null
      generatedScaleValue?: number | null
      [key: string]: unknown
    }
  }
}

type HandcraftedRow = {
  id: string
  input: string | string[]
  hint?: string | null
  metadata?: {
    patternFamily?: string | null
    promptSource?: string | null
    judge?: {
      requiredConcepts?: string[]
    }
    [key: string]: unknown
  }
}

type InitialCorpusRow = {
  id: string
  title: string
  input: string
  hint: string | null
  corpusKind: 'seed-parent' | 'derived-lower-scale' | 'handcrafted'
  corpusSource: 'slice15-recommended' | 'slice15-salvage' | 'slice16-recommended' | 'handcrafted'
  recommended: boolean
  trusted: boolean | null
  scale: string | null
  patternFamily: string | null
  sourceId: string | null
  sourceTitle: string | null
}

type Summary = {
  outputPath: string
  markdownPath: string
  totalRows: number
  byCorpusKind: Record<string, number>
  byCorpusSource: Record<string, number>
  byScale: Record<string, number>
}

type CliInput = {
  recommendedPath: string
  salvagePath: string
  trustedCandidatesPath: string
  iffyCandidatesPath: string
  handcraftedPath: string
  derivedRecommendedPath: string
  outputPath: string
  summaryPath: string
  markdownPath: string
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
const DEFAULT_DERIVED_RECOMMENDED = join(
  import.meta.dir,
  '..',
  'dev-research',
  'modnet',
  'catalog',
  'modnet-derived-prompts.slice16.recommended.jsonl',
)
const DEFAULT_OUTPUT = join(import.meta.dir, '..', 'dev-research', 'modnet', 'catalog', 'modnet-initial-corpus.jsonl')
const DEFAULT_MARKDOWN = join(
  import.meta.dir,
  '..',
  'dev-research',
  'modnet',
  'references',
  'modnet-initial-corpus-review.md',
)

const parseArgs = (): CliInput => {
  const args = Bun.argv.slice(2)
  let recommendedPath = DEFAULT_RECOMMENDED
  let salvagePath = DEFAULT_SALVAGE
  let trustedCandidatesPath = DEFAULT_TRUSTED_CANDIDATES
  let iffyCandidatesPath = DEFAULT_IFFY_CANDIDATES
  let handcraftedPath = DEFAULT_HANDCRAFTED
  let derivedRecommendedPath = DEFAULT_DERIVED_RECOMMENDED
  let outputPath = DEFAULT_OUTPUT
  let markdownPath = DEFAULT_MARKDOWN

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
    if (arg === '--derived-recommended' && args[index + 1]) {
      derivedRecommendedPath = args[index + 1]!
      index += 1
      continue
    }
    if (arg === '--output' && args[index + 1]) {
      outputPath = args[index + 1]!
      index += 1
      continue
    }
    if (arg === '--markdown' && args[index + 1]) {
      markdownPath = args[index + 1]!
      index += 1
    }
  }

  return {
    recommendedPath,
    salvagePath,
    trustedCandidatesPath,
    iffyCandidatesPath,
    handcraftedPath,
    derivedRecommendedPath,
    outputPath,
    summaryPath: `${outputPath}.summary.json`,
    markdownPath,
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

const asText = (value: string | string[]): string => (typeof value === 'string' ? value : value.join(' '))

const scaleLabelFromNumber = (value: number | null | undefined): string | null =>
  typeof value === 'number' && Number.isFinite(value) ? `S${value}` : null

const parseHandcraftedScale = (row: HandcraftedRow): string | null => {
  const concepts = row.metadata?.judge?.requiredConcepts ?? []
  const match = concepts.map((concept) => /scale-(S[1-8])/i.exec(concept)?.[1] ?? null).find(Boolean)
  return match ?? null
}

const buildCandidateMap = (rows: RegeneratedCandidateRow[]): Map<string, RegeneratedCandidateRow> =>
  new Map(rows.map((row) => [row.rawCard.id, row]))

const buildSeedRows = ({
  rows,
  candidateMap,
  corpusSource,
}: {
  rows: SeedReviewRow[]
  candidateMap: Map<string, RegeneratedCandidateRow>
  corpusSource: 'slice15-recommended' | 'slice15-salvage'
}): InitialCorpusRow[] =>
  rows
    .filter((row) => row.recommendedForSeedReview === true)
    .flatMap((row) => {
      const candidate = candidateMap.get(row.id)
      if (!candidate) return []
      return [
        {
          id: row.id,
          title: candidate.promptDraft.metadata?.modernTitle ?? row.title ?? candidate.rawCard.title ?? row.id,
          input: asText(candidate.promptDraft.input),
          hint: candidate.promptDraft.hint ?? null,
          corpusKind: 'seed-parent',
          corpusSource,
          recommended: true,
          trusted: row.trusted ?? null,
          scale: candidate.promptDraft.metadata?.scale ?? scaleLabelFromNumber(row.current?.mss?.scale) ?? null,
          patternFamily:
            row.current?.patternFamily ??
            candidate.promptDraft.metadata?.likelyPatternFamily ??
            candidate.rawCard.likelyPatternFamily ??
            null,
          sourceId: candidate.rawCard.id,
          sourceTitle: candidate.rawCard.title ?? row.title ?? null,
        },
      ]
    })

const buildDerivedRows = (rows: DerivedRecommendedRow[]): InitialCorpusRow[] =>
  rows
    .filter((row) => row.recommended === true)
    .map((row) => ({
      id: row.candidate.id,
      title: row.candidate.seedContext?.rewrittenTitle ?? row.sourcePrompt?.title ?? row.candidate.id,
      input: asText(row.candidate.input),
      hint: row.candidate.hint ?? null,
      corpusKind: 'derived-lower-scale',
      corpusSource: 'slice16-recommended',
      recommended: true,
      trusted: true,
      scale: row.candidate.targetScale ?? null,
      patternFamily:
        row.candidate.seedContext?.approvedParentFamily ??
        row.candidate.seedContext?.sourceFamily ??
        row.sourcePrompt?.metadata?.patternFamily ??
        null,
      sourceId: row.candidate.sourceId,
      sourceTitle: row.candidate.seedContext?.sourceTitle ?? row.sourcePrompt?.title ?? null,
    }))

const buildHandcraftedRows = (rows: HandcraftedRow[]): InitialCorpusRow[] =>
  rows.map((row) => ({
    id: row.id,
    title: row.id,
    input: asText(row.input),
    hint: row.hint ?? null,
    corpusKind: 'handcrafted',
    corpusSource: 'handcrafted',
    recommended: true,
    trusted: true,
    scale: parseHandcraftedScale(row),
    patternFamily: row.metadata?.patternFamily ?? null,
    sourceId: null,
    sourceTitle: null,
  }))

const increment = (record: Record<string, number>, key: string | null) => {
  if (!key) return
  record[key] = (record[key] ?? 0) + 1
}

const buildMarkdown = (rows: InitialCorpusRow[], summary: Summary): string => {
  const lines = [
    '# Modnet Initial Corpus',
    '',
    `Total rows: ${summary.totalRows}`,
    '',
    '## Breakdown',
    '',
    `- Seed parents: ${summary.byCorpusKind['seed-parent'] ?? 0}`,
    `- Derived lower-scale prompts: ${summary.byCorpusKind['derived-lower-scale'] ?? 0}`,
    `- Handcrafted prompts: ${summary.byCorpusKind.handcrafted ?? 0}`,
    '',
    '## By Source',
    '',
    ...Object.entries(summary.byCorpusSource)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, value]) => `- ${key}: ${value}`),
    '',
    '## By Scale',
    '',
    ...Object.entries(summary.byScale)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, value]) => `- ${key}: ${value}`),
    '',
    '## Entries',
    '',
  ]

  rows.forEach((row, index) => {
    lines.push(`${index + 1}. ${row.title}`)
    lines.push(`   - id: \`${row.id}\``)
    lines.push(`   - kind: \`${row.corpusKind}\``)
    lines.push(`   - source: \`${row.corpusSource}\``)
    lines.push(`   - scale: \`${row.scale ?? 'unknown'}\``)
    lines.push(`   - family: \`${row.patternFamily ?? 'unknown'}\``)
    lines.push(`   - recommended: \`${row.recommended ? 'yes' : 'no'}\``)
    if (row.sourceTitle) {
      lines.push(`   - source title: ${row.sourceTitle}`)
    }
    lines.push('   - prompt:')
    lines.push('')
    lines.push('```text')
    lines.push(row.input)
    if (row.hint) {
      lines.push('')
      lines.push(`Hint: ${row.hint}`)
    }
    lines.push('```')
    lines.push('')
  })

  return `${lines.join('\n')}\n`
}

const main = async () => {
  const input = parseArgs()

  const [recommendedRows, salvageRows, trustedCandidates, iffyCandidates, handcraftedRows, derivedRows] =
    await Promise.all([
      readJsonl<SeedReviewRow>(input.recommendedPath),
      readJsonl<SeedReviewRow>(input.salvagePath),
      readJsonl<RegeneratedCandidateRow>(input.trustedCandidatesPath),
      readJsonl<RegeneratedCandidateRow>(input.iffyCandidatesPath),
      readJsonl<HandcraftedRow>(input.handcraftedPath),
      readJsonl<DerivedRecommendedRow>(input.derivedRecommendedPath),
    ])

  const candidateMap = buildCandidateMap([...trustedCandidates, ...iffyCandidates])

  const corpusRows = [
    ...buildSeedRows({
      rows: recommendedRows,
      candidateMap,
      corpusSource: 'slice15-recommended',
    }),
    ...buildSeedRows({
      rows: salvageRows,
      candidateMap,
      corpusSource: 'slice15-salvage',
    }),
    ...buildDerivedRows(derivedRows),
    ...buildHandcraftedRows(handcraftedRows),
  ]

  const summary: Summary = {
    outputPath: input.outputPath,
    markdownPath: input.markdownPath,
    totalRows: corpusRows.length,
    byCorpusKind: {},
    byCorpusSource: {},
    byScale: {},
  }

  for (const row of corpusRows) {
    increment(summary.byCorpusKind, row.corpusKind)
    increment(summary.byCorpusSource, row.corpusSource)
    increment(summary.byScale, row.scale ?? 'unknown')
  }

  const jsonl = `${corpusRows.map((row) => JSON.stringify(row)).join('\n')}\n`
  await Bun.write(input.outputPath, jsonl)
  await Bun.write(input.summaryPath, `${JSON.stringify(summary, null, 2)}\n`)
  await Bun.write(input.markdownPath, buildMarkdown(corpusRows, summary))

  console.log(JSON.stringify(summary, null, 2))
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  })
}
