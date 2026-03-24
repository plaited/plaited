#!/usr/bin/env bun

import { join } from 'node:path'

type PromptInput = string | string[]

type SeedReviewMetadata = {
  patternFamily?: string | null
  sourceLikelyPatternFamily?: string | null
  sourceLikelyStructure?: string | null
  generatedModernTitle?: string | null
  generatedPromptInput?: string | null
  generatedPromptHint?: string | null
  generatedScale?: string | null
  generatedScaleValue?: number | null
  generatedScaleLabel?: string | null
  sourceScaleEstimate?: number | null
  sourceScaleEstimateLabel?: string | null
  generatedLikelyPatternFamily?: string | null
  generatedLikelyStructure?: string | null
}

type SourceRecord = {
  title?: string
  description?: string
  coreUserJob?: string | null
  whyRelevant?: string | null
  mss?: {
    structure?: string | null
    scale?: number | null
  }
}

type PromptRow = {
  id: string
  input: PromptInput
  hint?: string | null
  metadata?: SeedReviewMetadata & Record<string, unknown>
  _source?: SourceRecord
  title?: string
  description?: string
  coreUserJob?: string | null
  whyRelevant?: string | null
  likelyPatternFamily?: string | null
  likelyStructure?: string | null
}

type DerivedSeedContext = {
  sourceId: string
  rewrittenTitle: string
  rewrittenInput: string
  rewrittenHint: string
  sourceTitle: string
  sourceDescription: string
  sourceFamily: string
  sourceStructure: string
  sourceScale: number
  sourceScaleLabel: string
  sourceCoreUserJob: string
  sourceWhyRelevant: string
  sourceAnchors: string
}

type DerivedPrompt = {
  id: string
  sourceId: string
  targetScale: 'S1' | 'S2' | 'S3'
  input: string
  hint: string
  seedContext: DerivedSeedContext
}

const DEFAULT_INPUT = join(import.meta.dir, '..', 'dev-research', 'modnet', 'catalog', 'modnet-training-prompts.jsonl')

const APPROVED_ANCHORS = [
  {
    id: 'hypercard_archimedes-discovering-pi',
    patternFamily: 'creative-tool',
    targetScale: 'S1' as const,
    subjectStyle: 'interactive demonstration object',
    mechanism: 'derive',
  },
  {
    id: 'hypercard_klingondictionary',
    patternFamily: 'reference-browser',
    targetScale: 'S2' as const,
    subjectStyle: 'lookup entry',
    mechanism: 'lookup',
  },
  {
    id: 'hypercard_1st-law-of-thermodynamics',
    patternFamily: 'educational-interactive',
    targetScale: 'S3' as const,
    subjectStyle: 'lesson sequence',
    mechanism: 'sequence',
  },
]

const STOP_WORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'that',
  'this',
  'from',
  'have',
  'their',
  'where',
  'when',
  'about',
  'which',
  'there',
  'also',
  'only',
  'into',
  'your',
  'its',
  'it',
  'they',
  'them',
  'can',
  'let',
  'lets',
  'just',
  'justs',
])

const FAMILY_ANCHORS: Record<string, string[]> = {
  'creative-tool': ['interactive', 'create', 'compose', 'edit', 'artifact'],
  'reference-browser': ['lookup', 'browse', 'reference', 'entry', 'search'],
  'educational-interactive': ['lesson', 'learn', 'quiz', 'practice', 'assessment'],
  'developer-utility': ['analyze', 'inspect', 'tool', 'workflow', 'action'],
  'personal-data-manager': ['record', 'history', 'profile', 'task', 'note'],
  communication: ['message', 'reply', 'thread', 'conversation', 'contact'],
  'business-process': ['workflow', 'status', 'task', 'schedule', 'project', 'coordination'],
  'instrument-control': ['input', 'control', 'session', 'log', 'instrument'],
  'multimedia-presentation': ['slide', 'screen', 'media', 'gallery'],
  'game-simulation': ['play', 'simulate', 'score', 'challenge', 'state'],
  unknown: ['module'],
}

const readRows = async (path: string): Promise<PromptRow[]> => {
  const text = await Bun.file(path).text()
  return text
    .trim()
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as PromptRow)
}

const asString = (value: unknown): string => (typeof value === 'string' ? value : '')

const asNumber = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null)

const asOptionalString = (value: unknown): string | undefined => {
  const sanitized = asString(value).trim()
  return sanitized.length > 0 ? sanitized : undefined
}

const flattenInput = (value: PromptInput): string => (Array.isArray(value) ? value.join(' ') : value)

const normalizeText = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const parseScaleFromRaw = (value: string | null | undefined): number | null => {
  if (!value) return null
  const match = /(?:^|[^\w])(?:scale[-_ ]*)?s?([1-8])(?:[^\w]|$)/i.exec(value)
  return match ? Number(match[1]!) : null
}

const getRequiredConceptScale = (concepts: unknown): number | null => {
  if (!Array.isArray(concepts)) return null
  for (const value of concepts) {
    if (typeof value !== 'string') continue
    const match = /^scale-S([1-8])$/i.exec(value)
    if (match) return Number(match[1]!)
  }
  return null
}

const pickScaleFromRow = (row: PromptRow): number | null => {
  const metadata = row.metadata ?? {}
  const concepts = getRequiredConceptScale(
    asRecord(metadata).judge ? asRecord((metadata as { judge?: unknown }).judge).requiredConcepts : [],
  )

  if (concepts !== null) return concepts

  const metadataScale =
    parseScaleFromRaw(metadata.generatedScale) ??
    parseScaleFromRaw(metadata.generatedScaleLabel) ??
    parseScaleFromRaw(metadata.sourceScaleEstimateLabel)
  if (metadataScale !== null) return metadataScale

  const numericScale =
    asNumber(metadata.generatedScaleValue) ??
    asNumber(metadata.sourceScaleEstimate) ??
    asNumber(row._source?.mss?.scale)
  if (numericScale !== null) return Math.max(1, Math.min(8, Math.round(numericScale)))

  return null
}

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {}

const stripSeedNoise = (value: string): string =>
  value
    .replace(/^build\s+me\s+/i, '')
    .replace(/^create\s+(me|a|an|one)\s+/i, '')
    .replace(/^generate\s+(me|a|an|one)\s+/i, '')
    .trim()

const collectAnchorTerms = (seedContext: DerivedSeedContext): string => {
  const terms = [
    seedContext.rewrittenTitle,
    seedContext.rewrittenInput,
    seedContext.sourceTitle,
    seedContext.sourceDescription,
    seedContext.sourceCoreUserJob,
    seedContext.sourceWhyRelevant,
    seedContext.sourceFamily,
    seedContext.sourceStructure,
  ]
    .flatMap((value) => normalizeText(value).split(' '))
    .filter((value) => value.length >= 4 && !STOP_WORDS.has(value))

  const seen = new Set<string>()
  return terms
    .filter((term) => {
      if (seen.has(term)) return false
      seen.add(term)
      return true
    })
    .slice(0, 10)
    .join(', ')
}

const extractMechanics = (context: DerivedSeedContext): string => {
  const combined = normalizeText([context.rewrittenTitle, context.rewrittenInput, context.sourceDescription].join(' '))
  const matches: string[] = []
  const mechanics = {
    filter: ['filter', 'sort', 'group', 'order'],
    browse: ['browse', 'view', 'list', 'lookup', 'search'],
    craft: ['create', 'make', 'build', 'edit', 'compose'],
    share: ['share', 'publish', 'distribute', 'send'],
    learn: ['learn', 'quiz', 'practice', 'lesson', 'study'],
    track: ['track', 'save', 'record', 'history', 'capture', 'log'],
    test: ['test', 'verify', 'check', 'validate', 'simulate'],
  } as const

  for (const [mechanic, tokens] of Object.entries(mechanics)) {
    if (tokens.some((token) => combined.includes(` ${token} `) || combined.includes(` ${token}`))) {
      matches.push(mechanic)
    }
  }

  return matches.length > 0 ? matches[0]! : 'craft'
}

const getAnchorFromFamily = (family: string, fallback: string): string => {
  const anchors = FAMILY_ANCHORS[family] ?? FAMILY_ANCHORS.unknown
  return anchors && anchors.length > 0 ? anchors[0]! : fallback
}

const buildS1Input = (context: DerivedSeedContext, mechanism: string, subject: string): string => {
  const familyAnchor = getAnchorFromFamily(context.sourceFamily, 'object')
  return `Build one ${subject} ${familyAnchor} for ${context.rewrittenTitle} that ${mechanism}-captures one concrete action and keeps behavior bounded to the source intent.`
}

const buildS2Input = (context: DerivedSeedContext, mechanism: string, subject: string): string => {
  const structure = context.sourceStructure.length > 0 ? context.sourceStructure : 'collection'
  return `Create a ${structure} for ${context.rewrittenTitle} where many ${subject} entries are listed, ${mechanism}, and each entry opens a bounded source-level detail view.`
}

const buildS3Input = (context: DerivedSeedContext, mechanism: string, subject: string): string => {
  return `Build a grouped ${context.sourceFamily} work surface for ${context.rewrittenTitle} that composes ${subject} modules into one reusable stage, with ${mechanism}, filters, and one progression edge.`
}

const buildHintsByScale = (context: DerivedSeedContext, subject: string, targetScale: DerivedPrompt['targetScale']) => {
  const anchors = context.sourceAnchors
  const anchorSuffix = anchors.length > 0 ? ` Source anchors: ${anchors}.` : ''

  if (targetScale === 'S1') {
    return `Derived S1 precursor for "${context.rewrittenTitle}". Anchor to ${subject} as a single ${context.sourceFamily} primitive. Keep this bounded, concrete, and source-grounded. ${anchorSuffix}`.trim()
  }
  if (targetScale === 'S2') {
    return `Derived S2 precursor for "${context.rewrittenTitle}". Keep list/group behavior explicit, keep source intent explicit, and avoid module-shell abstractions.${anchorSuffix}`.trim()
  }
  return `Derived S3 precursor for "${context.rewrittenTitle}". Keep composition bounded and reusable as the lower-scale shell for the approved parent seed.${anchorSuffix}`.trim()
}

const chooseSubject = (context: DerivedSeedContext): string => {
  const calibrated = APPROVED_ANCHORS.find((entry) => entry.patternFamily === context.sourceFamily)
  const anchorTerms = normalizeText(context.rewrittenTitle)
    .split(' ')
    .filter((term) => term.length >= 4 && !STOP_WORDS.has(term))

  if (anchorTerms.length > 0) return anchorTerms[0]!
  return calibrated?.subjectStyle ?? 'module item'
}

const buildSeedContext = (row: PromptRow): DerivedSeedContext => {
  const metadata = row.metadata ?? {}
  const source = row._source ?? {}
  const rawSourceScale = pickScaleFromRow(row)
  const sourceScale = rawSourceScale !== null ? rawSourceScale : 1

  const sourceTitle = asString(source.title) || asString(row.title) || row.id
  const sourceDescription = asString(source.description) || asString(row.description)
  const sourceFamily =
    asString(metadata.patternFamily) ||
    asString(metadata.sourceLikelyPatternFamily) ||
    asString(row.likelyPatternFamily) ||
    'unknown'
  const sourceStructure =
    asString(metadata.sourceLikelyStructure) ||
    asString(metadata.generatedLikelyStructure) ||
    asString(row.likelyStructure) ||
    asString(source.mss?.structure) ||
    'module'

  const rewrittenTitle =
    asOptionalString(metadata.generatedModernTitle) ??
    asOptionalString(sourceTitle) ??
    asOptionalString(stripSeedNoise(flattenInput(row.input))) ??
    sourceTitle
  const rewrittenInput =
    asOptionalString(metadata.generatedPromptInput) ??
    asOptionalString(sourceDescription) ??
    asOptionalString(stripSeedNoise(flattenInput(row.input))) ??
    sourceTitle
  const rewrittenHint =
    asOptionalString(metadata.generatedPromptHint) ?? asOptionalString(row.hint) ?? `${sourceFamily} precursor`

  const provisional: Omit<DerivedSeedContext, 'sourceScaleLabel' | 'sourceAnchors'> = {
    sourceId: row.id,
    rewrittenTitle,
    rewrittenInput,
    rewrittenHint,
    sourceTitle,
    sourceDescription,
    sourceFamily,
    sourceStructure,
    sourceScale,
    sourceCoreUserJob: asString(source.coreUserJob) || asString(row.coreUserJob),
    sourceWhyRelevant: asString(source.whyRelevant) || asString(row.whyRelevant),
  }

  const provisionalContext = {
    ...provisional,
    sourceScaleLabel: `S${Math.max(1, Math.min(8, sourceScale))}`,
    sourceAnchors: '',
  }

  return {
    ...provisionalContext,
    sourceAnchors: collectAnchorTerms(provisionalContext),
  }
}

const deriveScaleCandidates = (row: PromptRow): DerivedPrompt[] => {
  const context = buildSeedContext(row)
  const mechanism = extractMechanics(context)
  const subject = stripSeedNoise(chooseSubject(context))
  const anchor = APPROVED_ANCHORS.find((entry) => entry.id === row.id)
  const sourceScaleSignature = `${context.sourceScaleLabel} (${context.sourceFamily}/${context.sourceStructure})`

  const templates: Record<DerivedPrompt['targetScale'], { input: string; hint: string }> = {
    S1: {
      input: buildS1Input(context, mechanism, subject),
      hint: buildHintsByScale(context, subject, 'S1'),
    },
    S2: {
      input: buildS2Input(context, mechanism, subject),
      hint: buildHintsByScale(context, subject, 'S2'),
    },
    S3: {
      input: buildS3Input(context, mechanism, subject),
      hint: buildHintsByScale(context, subject, 'S3'),
    },
  }

  const targets: DerivedPrompt['targetScale'][] = ['S1', 'S2', 'S3']
  return targets.map((targetScale) => {
    const candidate = templates[targetScale]
    return {
      id: `${row.id}-derived-${targetScale.toLowerCase()}`,
      sourceId: row.id,
      targetScale,
      input: candidate.input,
      hint: `${candidate.hint} Calibrated from rewritten seed "${context.rewrittenTitle}" with source scale ${sourceScaleSignature}, approved lane=${anchor ? `${anchor.patternFamily}/${anchor.targetScale}` : 'none'}.`,
      seedContext: {
        ...context,
      },
    }
  })
}

const hasScaleAtLeast4 = (row: PromptRow): boolean => {
  const sourceScale = pickScaleFromRow(row)
  return sourceScale !== null && sourceScale >= 4
}

const parseArgs = () => {
  const args = Bun.argv.slice(2)
  let inputPath = DEFAULT_INPUT
  let limit = 20
  let outputPath: string | null = null

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]

    if (arg === '--input' && args[index + 1]) {
      inputPath = args[index + 1]!
      index += 1
      continue
    }

    if (arg === '--limit' && args[index + 1]) {
      limit = Math.max(1, Number(args[index + 1]!))
      index += 1
      continue
    }

    if (arg === '--output' && args[index + 1]) {
      outputPath = args[index + 1]!
      index += 1
    }
  }

  return { inputPath, limit, outputPath }
}

const main = async () => {
  const { inputPath, limit, outputPath } = parseArgs()
  const rows = await readRows(inputPath)
  const qualified = rows.filter(hasScaleAtLeast4).slice(0, limit)
  const prompts = qualified.flatMap(deriveScaleCandidates)
  const payload = {
    inputPath,
    seedCount: qualified.length,
    derivedCount: prompts.length,
    prompts,
  }

  const serialized = `${JSON.stringify(payload, null, 2)}\n`
  if (outputPath === null) {
    console.log(serialized)
    return
  }

  await Bun.write(outputPath, serialized)
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  })
}
