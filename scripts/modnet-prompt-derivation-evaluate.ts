#!/usr/bin/env bun

import { join } from 'node:path'
import * as z from 'zod'
import type { PromptCase } from '../src/improve.ts'
import { PromptCaseSchema } from '../src/improve.ts'
import { appendJsonlRow, resetJsonlOutput } from './jsonl-output.ts'
import { grade as judgeDerivedPrompt } from './modnet-prompt-derivation-judge.ts'
import { grade as metaVerifyDerivedPrompt } from './modnet-prompt-derivation-meta-verifier.ts'

type CandidateSeedContext = {
  sourceId?: string
  rewrittenTitle?: string
  rewrittenInput?: string
  rewrittenHint?: string
  sourceTitle?: string
  sourceDescription?: string
  sourceFamily?: string
  sourceStructure?: string
  sourceScale?: number
  sourceScaleLabel?: string
  sourceCoreUserJob?: string
  sourceWhyRelevant?: string
  sourceAnchors?: string
}

export const DerivedPromptCandidateSchema = z.object({
  id: z.string(),
  sourceId: z.string(),
  targetScale: z.enum(['S1', 'S2', 'S3']),
  input: z.string(),
  hint: z.string(),
  seedContext: z
    .object({
      sourceId: z.string().optional(),
      rewrittenTitle: z.string().optional(),
      rewrittenInput: z.string().optional(),
      rewrittenHint: z.string().optional(),
      sourceTitle: z.string().optional(),
      sourceDescription: z.string().optional(),
      sourceFamily: z.string().optional(),
      sourceStructure: z.string().optional(),
      sourceScale: z.number().optional(),
      sourceScaleLabel: z.string().optional(),
      sourceCoreUserJob: z.string().optional(),
      sourceWhyRelevant: z.string().optional(),
      sourceAnchors: z.string().optional(),
    })
    .passthrough()
    .optional(),
})

export type DerivedPromptCandidate = z.infer<typeof DerivedPromptCandidateSchema>

export const DeterministicCheckSchema = z.object({
  pass: z.boolean(),
  hardFailures: z.array(z.string()),
  softWarnings: z.array(z.string()),
  checks: z.object({
    sourceExists: z.boolean(),
    idIsUnique: z.boolean(),
    sourceHasRewrittenSeed: z.boolean(),
    inputHasEnoughDetail: z.boolean(),
    hintHasEnoughDetail: z.boolean(),
    sourceScaleFits: z.boolean(),
    sourceScaleKnown: z.boolean(),
    targetScaleMatchesId: z.boolean(),
    avoidsGenericTemplateLanguage: z.boolean(),
    hasRewrittenSeedAnchor: z.boolean(),
    hasSourceLexicalAnchor: z.boolean(),
    familyContinuity: z.boolean(),
  }),
  score: z.number().min(0).max(1),
})

export type DeterministicCheck = z.infer<typeof DeterministicCheckSchema>

export const DerivedPromptEvaluationSchema = z.object({
  candidate: DerivedPromptCandidateSchema,
  sourcePrompt: PromptCaseSchema,
  deterministicCheck: DeterministicCheckSchema,
  judge: z.record(z.string(), z.unknown()).optional(),
  metaVerification: z.record(z.string(), z.unknown()).optional(),
  recommended: z.boolean(),
})

type DerivedPromptEvaluation = z.infer<typeof DerivedPromptEvaluationSchema>

const DEFAULT_SOURCE_CATALOG = join(
  import.meta.dir,
  '..',
  'dev-research',
  'modnet',
  'catalog',
  'modnet-training-prompts.jsonl',
)
const DEFAULT_INPUT = join(import.meta.dir, 'modnet-derived-prompts.json')
const DEFAULT_OUTPUT = join(import.meta.dir, '..', 'tmp', 'modnet-derived-prompt-evals.jsonl')

const STOP_WORDS = new Set([
  'and',
  'with',
  'that',
  'this',
  'from',
  'your',
  'their',
  'there',
  'they',
  'them',
  'then',
  'just',
  'only',
  'also',
  'when',
  'where',
  'about',
  'which',
  'have',
  'for',
  'can',
  'will',
  'been',
  'using',
  'used',
  'lets',
  'let',
  'make',
  'show',
  'build',
  'create',
  'generate',
  'find',
  'list',
])

const GENERIC_TEMPLATE_PATTERNS = [
  'smallest useful single object',
  'grouped object/list view',
  'block-level surface',
  'larger module would be built from',
  'larger module would likely use',
  'derived s1 precursor candidate',
  'derived s2 precursor candidate',
  'derived s3 precursor candidate',
]

const FAMILY_ANCHORS: Record<string, string[]> = {
  'creative-tool': ['creative', 'tool', 'compose', 'edit', 'canvas', 'project'],
  'reference-browser': ['reference', 'lookup', 'browse', 'search', 'entry', 'detail'],
  'educational-interactive': ['lesson', 'learn', 'practice', 'quiz', 'education', 'study'],
  'personal-data-manager': ['record', 'profile', 'history', 'note', 'household', 'ledger', 'task'],
  'business-process': ['workflow', 'status', 'task', 'schedule', 'project', 'coordination'],
  'game-simulation': ['play', 'simulate', 'score', 'challenge', 'state'],
  communication: ['message', 'conversation', 'contact', 'reply', 'thread'],
  'instrument-control': ['input', 'control', 'session', 'log', 'instrument'],
  'multimedia-presentation': ['slide', 'screen', 'media', 'gallery'],
  'developer-utility': ['generate', 'inspect', 'lint', 'test', 'tool'],
  unknown: ['module'],
}

type SeedContext = {
  sourceId: string
  seedTitle: string
  seedInput: string
  seedHint: string
  sourceTitle: string
  sourceDescription: string
  sourceFamily: string
  sourceStructure: string
  sourceScale: number | null
  sourceScaleLabel: string
  sourceHasRewrittenSeed: boolean
  sourceCoreUserJob: string
  sourceWhyRelevant: string
}

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {}

const asString = (value: unknown): string => (typeof value === 'string' ? value : '')

const asNumber = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null)

const normalizeWord = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

const parseScaleFromString = (value: string | null | undefined): number | null => {
  if (!value) return null
  const match = /(?:^|[^\w])(?:scale-|S)?\s*([1-8])(?:[^\w]|$)/i.exec(value)
  return match ? Number(match[1]!) : null
}

const parseCandidateScale = (targetScale: 'S1' | 'S2' | 'S3') => Number(targetScale.replace('S', ''))

const getRequiredConcepts = (prompt: PromptCase): string[] => {
  const judge = prompt.metadata?.judge
  if (!judge || typeof judge !== 'object') {
    return []
  }

  const requiredConcepts = (judge as Record<string, unknown>).requiredConcepts
  return Array.isArray(requiredConcepts)
    ? requiredConcepts.filter((value): value is string => typeof value === 'string')
    : []
}

const parseSourceScaleFromRecord = (prompt: PromptCase, candidateContext?: CandidateSeedContext): number | null => {
  if (typeof candidateContext?.sourceScale === 'number' && Number.isFinite(candidateContext.sourceScale)) {
    return Math.max(1, Math.min(8, Math.round(candidateContext.sourceScale)))
  }

  const parsedCandidateLabel = parseScaleFromString(candidateContext?.sourceScaleLabel)
  if (parsedCandidateLabel !== null) return parsedCandidateLabel

  const sourceRecord = asRecord(prompt.metadata?._source)
  const metadata = asRecord(prompt.metadata)
  const seedReviewContext = asRecord(metadata.seedReviewContext)

  const fromConcepts = getRequiredConcepts(prompt).find((concept) => /^scale-S[1-8]$/i.test(concept))
  if (fromConcepts) return Number(fromConcepts.replace('scale-S', ''))

  const candidates = [
    parseScaleFromString(asString(metadata.generatedScale)),
    parseScaleFromString(asString(seedReviewContext.generatedScale)),
    parseScaleFromString(asString(seedReviewContext.generatedScaleLabel)),
    parseScaleFromString(asString(seedReviewContext.sourceScaleEstimateLabel)),
    asNumber(metadata.generatedScaleValue),
    asNumber(seedReviewContext.generatedScaleValue),
    asNumber(seedReviewContext.sourceScale),
    asNumber(metadata.sourceScaleEstimate),
    asNumber(seedReviewContext.sourceScaleEstimate),
    asNumber(seedReviewContext.sourceScale),
    asNumber(asRecord(sourceRecord.mss).scale),
  ]
    .map((value) => (typeof value === 'number' ? Math.max(1, Math.min(8, Math.round(value))) : value))
    .filter((value): value is number => value !== null)

  return candidates[0] ?? null
}

const getRewrittenPromptInput = (prompt: PromptCase, candidateContext?: CandidateSeedContext): string => {
  const candidateInput = asString(candidateContext?.rewrittenInput)
  if (candidateInput.length > 0) return candidateInput

  const metadata = asRecord(prompt.metadata)
  const seedReviewContext = asRecord(metadata.seedReviewContext)
  return (
    asString(metadata.generatedPromptInput) ||
    asString(seedReviewContext.generatedPromptInput) ||
    (Array.isArray(prompt.input) ? prompt.input.join(' ') : prompt.input) ||
    asString(prompt.hint) ||
    ''
  )
}

const extractSeedContext = (candidate: DerivedPromptCandidate, sourcePrompt?: PromptCase): SeedContext => {
  const promptMetadata = asRecord(sourcePrompt?.metadata)
  const sourceRecord = asRecord(promptMetadata._source)
  const candidateContext = asRecord(candidate.seedContext)
  const seedReviewContext = asRecord(promptMetadata.seedReviewContext)

  const sourceScale = parseSourceScaleFromRecord(
    sourcePrompt ?? ({ id: candidate.sourceId, input: '' } as PromptCase),
    candidateContext as CandidateSeedContext,
  )
  const sourceScaleLabel =
    asString(candidateContext.sourceScaleLabel) || (sourceScale !== null ? `S${sourceScale}` : '')
  const sourceFamily =
    asString(candidateContext.sourceFamily) ||
    asString(promptMetadata.patternFamily) ||
    asString(seedReviewContext.generatedLikelyPatternFamily) ||
    'unknown'
  const sourceStructure =
    asString(candidateContext.sourceStructure) || asString(seedReviewContext.generatedLikelyStructure) || 'module'

  const seedTitle =
    asString(candidateContext.rewrittenTitle) ||
    asString(seedReviewContext.generatedModernTitle) ||
    asString(promptMetadata.generatedModernTitle) ||
    asString(sourceRecord.title) ||
    asString(sourcePrompt?.id) ||
    candidate.sourceId
  const seedInput = getRewrittenPromptInput(
    sourcePrompt ?? ({ id: candidate.sourceId, input: '' } as PromptCase),
    candidateContext as CandidateSeedContext,
  )
  const seedHint =
    asString(candidateContext.rewrittenHint) ||
    asString(seedReviewContext.generatedPromptHint) ||
    asString(promptMetadata.generatedPromptHint) ||
    asString(sourcePrompt?.hint)

  const sourceTitle =
    asString(candidateContext.sourceTitle) ||
    asString(sourceRecord.title) ||
    asString(seedReviewContext.sourceTitle) ||
    asString(sourcePrompt?.id) ||
    candidate.sourceId
  const sourceDescription =
    asString(candidateContext.sourceDescription) ||
    asString(sourceRecord.description) ||
    asString(seedReviewContext.sourceDescription)
  const sourceCoreUserJob =
    asString(candidateContext.sourceCoreUserJob) ||
    asString(seedReviewContext.coreUserJob) ||
    asString(sourceRecord.coreUserJob)
  const sourceWhyRelevant =
    asString(candidateContext.sourceWhyRelevant) ||
    asString(seedReviewContext.whyRelevant) ||
    asString(sourceRecord.whyRelevant)
  const sourceHasRewrittenSeed =
    asString(candidateContext.rewrittenTitle).length > 0 ||
    asString(candidateContext.rewrittenInput).length > 0 ||
    asString(candidateContext.rewrittenHint).length > 0 ||
    asString(seedReviewContext.generatedModernTitle).length > 0 ||
    asString(promptMetadata.generatedModernTitle).length > 0

  return {
    sourceId: candidate.sourceId,
    seedTitle,
    seedInput,
    seedHint,
    sourceTitle,
    sourceDescription,
    sourceFamily,
    sourceStructure,
    sourceScale,
    sourceScaleLabel,
    sourceHasRewrittenSeed,
    sourceCoreUserJob,
    sourceWhyRelevant,
  }
}

const splitTokens = (value: string, limit: number): string[] => {
  const words = normalizeWord(value)
    .split(/\s+/)
    .filter((word) => word.length >= 4 && !STOP_WORDS.has(word))

  const unique = new Set<string>()
  return words.filter((word) => {
    if (unique.has(word)) return false
    unique.add(word)
    return unique.size <= limit
  })
}

const extractAnchorSet = (context: SeedContext): Set<string> => {
  const sourceFields = [
    context.seedInput,
    context.seedHint,
    context.seedTitle,
    context.sourceTitle,
    context.sourceDescription,
    context.sourceCoreUserJob,
    context.sourceWhyRelevant,
    context.sourceStructure,
  ]
  const tokens = sourceFields.flatMap((value) => (value ? splitTokens(value, 256) : []))
  return new Set(tokens)
}

const hasFamilyTermOverlap = (family: string, candidateText: string): boolean => {
  const anchors = FAMILY_ANCHORS[family] ?? FAMILY_ANCHORS.unknown ?? []
  const normalized = normalizeWord(candidateText)
  return anchors.some(
    (anchor) =>
      normalized.includes(` ${anchor} `) || normalized.endsWith(` ${anchor}`) || normalized.startsWith(`${anchor} `),
  )
}

export const assessDerivedPromptCandidate = ({
  candidate,
  sourcePrompt,
  seenIds,
}: {
  candidate: DerivedPromptCandidate
  sourcePrompt?: PromptCase
  seenIds: Set<string>
}): DeterministicCheck => {
  const hardFailures: string[] = []
  const softWarnings: string[] = []

  const sourceContext = extractSeedContext(candidate, sourcePrompt)
  const sourceExists = Boolean(sourcePrompt)
  if (!sourceExists) {
    hardFailures.push(`missing-source:${candidate.sourceId}`)
  }

  const idIsUnique = !seenIds.has(candidate.id)
  if (!idIsUnique) {
    hardFailures.push(`duplicate-id:${candidate.id}`)
  }

  const inputHasEnoughDetail = normalizeWord(candidate.input).split(/\s+/).filter(Boolean).length >= 8
  if (!inputHasEnoughDetail) {
    hardFailures.push('input-too-short')
  }

  const hintHasEnoughDetail = normalizeWord(candidate.hint).split(/\s+/).filter(Boolean).length >= 6
  if (!hintHasEnoughDetail) {
    softWarnings.push('hint-too-short')
  }

  const sourceScale = sourceContext.sourceScale
  const sourceScaleKnown = sourceScale !== null
  const targetScale = parseCandidateScale(candidate.targetScale)
  const sourceScaleFits = sourceScale === null ? false : targetScale < sourceScale
  if (sourceScale !== null && sourceScale < 4) {
    hardFailures.push(`source-scale-too-small:${sourceScale}`)
  }
  if (!sourceScaleKnown) {
    softWarnings.push('source-scale-unknown')
  }
  if (!sourceScaleFits && sourceScale !== null) {
    softWarnings.push(`scale-inconsistency:S${targetScale}-from-S${sourceScale}`)
  }

  const targetScaleMatchesId = candidate.id.toLowerCase().includes(candidate.targetScale.toLowerCase())
  if (!targetScaleMatchesId) {
    softWarnings.push('id-target-scale-mismatch')
  }

  const normalizedCombined = normalizeWord(`${candidate.input} ${candidate.hint}`)
  const avoidsGenericTemplateLanguage = !GENERIC_TEMPLATE_PATTERNS.some((pattern) =>
    normalizedCombined.includes(normalizeWord(pattern)),
  )
  if (!avoidsGenericTemplateLanguage) {
    softWarnings.push('generic-template-language')
  }

  const sourceAnchors = sourceExists ? extractAnchorSet(sourceContext) : new Set<string>()
  const derivedTokens = new Set(splitTokens(normalizedCombined, 120))
  const hasSourceLexicalAnchor = Array.from(derivedTokens).some((word) => sourceAnchors.has(word))
  if (sourceExists && !hasSourceLexicalAnchor) {
    softWarnings.push('weak-lexical-anchor')
  }

  const sourceHasRewrittenSeed = sourceContext.sourceHasRewrittenSeed
  const rewrittenSeedTokens = splitTokens(
    `${sourceContext.seedInput} ${sourceContext.seedHint} ${sourceContext.seedTitle}`,
    24,
  )
  const hasRewrittenSeedAnchor =
    rewrittenSeedTokens.length === 0 || rewrittenSeedTokens.some((word) => derivedTokens.has(word))
  if (!hasRewrittenSeedAnchor) {
    softWarnings.push('missing-rewritten-seed-anchor')
  }

  const family = sourceContext.sourceFamily.length > 0 ? sourceContext.sourceFamily : 'unknown'
  const familyContinuity = hasFamilyTermOverlap(family, normalizedCombined) || hasRewrittenSeedAnchor
  if (!familyContinuity) {
    softWarnings.push('family-continuity-gap')
  }

  const checkValues = [
    sourceExists,
    idIsUnique,
    sourceHasRewrittenSeed,
    inputHasEnoughDetail,
    hintHasEnoughDetail,
    sourceScaleFits || sourceScale === null,
    sourceScaleKnown,
    targetScaleMatchesId,
    avoidsGenericTemplateLanguage,
    hasRewrittenSeedAnchor,
    hasSourceLexicalAnchor,
    familyContinuity,
  ]

  const score = Number((checkValues.filter(Boolean).length / checkValues.length).toFixed(3))

  return DeterministicCheckSchema.parse({
    pass: hardFailures.length === 0,
    hardFailures,
    softWarnings,
    checks: {
      sourceExists,
      idIsUnique,
      sourceHasRewrittenSeed,
      inputHasEnoughDetail,
      hintHasEnoughDetail,
      sourceScaleFits,
      sourceScaleKnown,
      targetScaleMatchesId,
      avoidsGenericTemplateLanguage,
      hasRewrittenSeedAnchor,
      hasSourceLexicalAnchor,
      familyContinuity,
    },
    score,
  })
}

const parseArgs = () => {
  const args = Bun.argv.slice(2)
  let candidatesPath = DEFAULT_INPUT
  let sourcePath = DEFAULT_SOURCE_CATALOG
  let outputPath = DEFAULT_OUTPUT
  let progress = true

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--candidates' && args[index + 1]) {
      candidatesPath = args[index + 1]!
      index += 1
      continue
    }
    if (arg === '--source' && args[index + 1]) {
      sourcePath = args[index + 1]!
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

  return { candidatesPath, sourcePath, outputPath, progress }
}

const loadPromptCatalog = async (path: string): Promise<Map<string, PromptCase>> => {
  const text = await Bun.file(path).text()
  const rows = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => PromptCaseSchema.parse(JSON.parse(line)))

  return new Map(rows.map((row) => [row.id, row]))
}

const loadDerivedCandidates = async (path: string): Promise<DerivedPromptCandidate[]> => {
  const text = await Bun.file(path).text()

  if (path.endsWith('.jsonl')) {
    return text
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => DerivedPromptCandidateSchema.parse(JSON.parse(line)))
  }

  const parsed = JSON.parse(text) as unknown
  const bundle = z
    .object({
      prompts: z.array(DerivedPromptCandidateSchema),
    })
    .parse(parsed)

  return bundle.prompts
}

const createTaskDescription = (candidate: DerivedPromptCandidate, sourcePrompt: PromptCase) => {
  const sourceContext = extractSeedContext(candidate, sourcePrompt)
  return [
    `Evaluate whether this derived prompt is worth keeping for the modnet catalog.`,
    `Source prompt id: ${sourcePrompt.id}`,
    `Candidate id: ${candidate.id}`,
    `Target scale: ${candidate.targetScale}`,
    `Source scale: ${sourceContext.sourceScaleLabel || 'unknown'} (${sourceContext.sourceScale ?? 'unknown'})`,
    `Source family: ${sourceContext.sourceFamily}`,
    `Source structure: ${sourceContext.sourceStructure}`,
    '',
    'Rewritten seed (primary source):',
    `- title: ${sourceContext.seedTitle || 'missing'}`,
    `- input: ${sourceContext.seedInput || 'missing'}`,
    `- hint: ${sourceContext.seedHint || 'missing'}`,
    '',
    'Original source grounding (anti-drift):',
    `- title: ${sourceContext.sourceTitle || 'missing'}`,
    `- description: ${sourceContext.sourceDescription || 'missing'}`,
    `- core user job: ${sourceContext.sourceCoreUserJob || 'missing'}`,
    `- why relevant: ${sourceContext.sourceWhyRelevant || 'missing'}`,
  ].join('\n')
}

const summarizeFamilies = (evaluations: DerivedPromptEvaluation[]) => {
  const counts = new Map<string, number>()

  for (const evaluation of evaluations) {
    const family =
      typeof evaluation.sourcePrompt.metadata?.patternFamily === 'string'
        ? evaluation.sourcePrompt.metadata.patternFamily
        : 'unknown'
    counts.set(family, (counts.get(family) ?? 0) + 1)
  }

  return Object.fromEntries(Array.from(counts.entries()).sort((left, right) => right[1] - left[1]))
}

const logProgress = ({ enabled, message }: { enabled: boolean; message: string }) => {
  if (!enabled) {
    return
  }

  console.error(`[modnet-derive-eval] ${message}`)
}

const main = async () => {
  const { candidatesPath, sourcePath, outputPath, progress } = parseArgs()
  logProgress({
    enabled: progress,
    message: `loading source catalog from ${sourcePath}`,
  })
  const sourceCatalog = await loadPromptCatalog(sourcePath)
  logProgress({
    enabled: progress,
    message: `loading candidates from ${candidatesPath}`,
  })
  const candidates = await loadDerivedCandidates(candidatesPath)
  logProgress({
    enabled: progress,
    message: `loaded ${candidates.length} candidate(s)`,
  })
  const seenIds = new Set<string>()
  const evaluations: DerivedPromptEvaluation[] = []
  await resetJsonlOutput(outputPath)

  for (const [index, candidate] of candidates.entries()) {
    logProgress({
      enabled: progress,
      message: `candidate ${index + 1}/${candidates.length}: ${candidate.id} precheck`,
    })

    const sourcePrompt = sourceCatalog.get(candidate.sourceId)
    const sourceContext = sourcePrompt ? extractSeedContext(candidate, sourcePrompt) : extractSeedContext(candidate)
    const deterministicCheck = assessDerivedPromptCandidate({
      candidate,
      sourcePrompt,
      seenIds,
    })
    seenIds.add(candidate.id)

    if (!sourcePrompt) {
      logProgress({
        enabled: progress,
        message: `candidate ${index + 1}/${candidates.length}: ${candidate.id} blocked (missing source)`,
      })
      const evaluation = DerivedPromptEvaluationSchema.parse({
        candidate,
        sourcePrompt: PromptCaseSchema.parse({
          id: candidate.sourceId,
          input: '',
        }),
        deterministicCheck,
        recommended: false,
      })
      evaluations.push(evaluation)
      await appendJsonlRow(outputPath, evaluation)
      continue
    }

    if (!deterministicCheck.pass) {
      logProgress({
        enabled: progress,
        message: `candidate ${index + 1}/${candidates.length}: ${candidate.id} blocked (${deterministicCheck.hardFailures.join(', ')})`,
      })
      const evaluation = DerivedPromptEvaluationSchema.parse({
        candidate,
        sourcePrompt,
        deterministicCheck,
        recommended: false,
      })
      evaluations.push(evaluation)
      await appendJsonlRow(outputPath, evaluation)
      continue
    }

    const task = createTaskDescription(candidate, sourcePrompt)
    const metadata = {
      sourcePrompt,
      candidatePrompt: candidate,
      deterministicCheck,
      sourceContext,
    }

    logProgress({
      enabled: progress,
      message: `candidate ${index + 1}/${candidates.length}: ${candidate.id} judge`,
    })
    const judge = await judgeDerivedPrompt({
      input: task,
      output: JSON.stringify(candidate, null, 2),
      metadata,
    })
    logProgress({
      enabled: progress,
      message: `candidate ${index + 1}/${candidates.length}: ${candidate.id} meta-verifier`,
    })
    const metaVerification = await metaVerifyDerivedPrompt({
      input: task,
      output: JSON.stringify(judge, null, 2),
      metadata: {
        ...metadata,
        judgeResult: judge,
      },
    })

    const evaluation = DerivedPromptEvaluationSchema.parse({
      candidate,
      sourcePrompt,
      deterministicCheck,
      judge,
      metaVerification,
      recommended: deterministicCheck.pass && judge.pass && metaVerification.pass,
    })
    evaluations.push(evaluation)
    await appendJsonlRow(outputPath, evaluation)
    logProgress({
      enabled: progress,
      message: `candidate ${index + 1}/${candidates.length}: ${candidate.id} done judge=${judge.pass} meta=${metaVerification.pass}`,
    })
  }

  logProgress({
    enabled: progress,
    message: `wrote ${evaluations.length} evaluation row(s) to ${outputPath}`,
  })

  const recommended = evaluations.filter((entry) => entry.recommended).length
  const blockedDeterministically = evaluations.filter((entry) => !entry.deterministicCheck.pass).length
  const judgePassed = evaluations.filter((entry) => entry.judge?.pass === true).length
  const metaPassed = evaluations.filter((entry) => entry.metaVerification?.pass === true).length

  console.log(
    JSON.stringify(
      {
        candidatesPath,
        sourcePath,
        outputPath,
        totalCandidates: evaluations.length,
        blockedDeterministically,
        judgePassed,
        metaPassed,
        recommended,
        sourceFamilies: summarizeFamilies(evaluations),
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
