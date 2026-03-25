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
  sourceGroundingAnchors?: string
  sourceShape?: string
  parentScaleLabel?: string
  sourceMechanics?: string
  operationalLoop?: string
  reusableActions?: string
  handcraftedAnchorIds?: string
  handcraftedAnchorTerms?: string
  handcraftedAnchorMechanics?: string
  targetShapeTransferSignals?: string
  targetShapeTransferMechanics?: string
  targetShapeTransferStructureSignals?: string
  targetShapeTransferDynamicSignals?: string
  targetShapeTransferManifest?: string
  targetShapeTransferTerms?: string
  approvedParentAnchor?: string
  approvedParentFamily?: string
  approvedParentScale?: string
  approvedParentMechanism?: string
  approvedParentSubject?: string
  contributesToParentCapability?: string
}

type CandidateChainContext = {
  rootSourceId?: string
  immediateParentPromptId?: string
  expectedParentPromptId?: string
  parentScaleLabel: string
  immediateParentMechanics?: string
  immediateParentReusableActions?: string
  immediateParentOperationalLoop?: string
  immediateParentShape?: string
  immediateParentRole?: string
  immediateParentRoleAffordances?: string
  parentFamily?: string
  parentMechanism?: string
  parentSubject?: string
  chainPath: string[]
  chainImmediateParentCapability?: string
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
      sourceGroundingAnchors: z.string().optional(),
      sourceShape: z.string().optional(),
      sourceMechanics: z.string().optional(),
      operationalLoop: z.string().optional(),
      reusableActions: z.string().optional(),
      targetShapeTransferSignals: z.string().optional(),
      targetShapeTransferMechanics: z.string().optional(),
      targetShapeTransferStructureSignals: z.string().optional(),
      targetShapeTransferDynamicSignals: z.string().optional(),
      targetShapeTransferManifest: z.string().optional(),
      targetShapeTransferTerms: z.string().optional(),
      handcraftedAnchorIds: z.string().optional(),
      handcraftedAnchorTerms: z.string().optional(),
      handcraftedAnchorMechanics: z.string().optional(),
      approvedParentAnchor: z.string().optional(),
      approvedParentFamily: z.string().optional(),
      approvedParentScale: z.string().optional(),
      approvedParentMechanism: z.string().optional(),
      approvedParentSubject: z.string().optional(),
      contributesToParentCapability: z.string().optional(),
      parentScaleLabel: z.string().optional(),
    })
    .passthrough()
    .optional(),
  chain: z
    .object({
      rootSourceId: z.string().optional(),
      immediateParentPromptId: z.string().optional(),
      expectedParentPromptId: z.string().optional(),
      parentScaleLabel: z.string().optional(),
      immediateParentMechanics: z.string().optional(),
      immediateParentReusableActions: z.string().optional(),
      immediateParentOperationalLoop: z.string().optional(),
      immediateParentShape: z.string().optional(),
      immediateParentRole: z.string().optional(),
      immediateParentRoleAffordances: z.string().optional(),
      parentFamily: z.string().optional(),
      parentMechanism: z.string().optional(),
      parentSubject: z.string().optional(),
      chainImmediateParentCapability: z.string().optional(),
      chainImmediateParentRole: z.string().optional(),
      chainImmediateParentRoleAffordances: z.string().optional(),
      chainPath: z.array(z.string()).max(8).optional(),
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
    hasSourceEvidenceAnchor: z.boolean(),
    targetShapeTransferContinuity: z.boolean(),
    targetShapeTransferContinuityDataPresent: z.boolean(),
    handcraftedStyleCopySafe: z.boolean(),
    immediateParentMechanicsContinuity: z.boolean(),
    immediateParentOperationalLoopContinuity: z.boolean(),
    immediateParentRoleContinuity: z.boolean(),
    chainPathContinuity: z.boolean(),
    hasDualSourceAnchorEvidence: z.boolean(),
    shapeScaleAligned: z.boolean(),
    sourceMechanicsContinuity: z.boolean(),
    reusableActionsSignal: z.boolean(),
    reusableActionLoopContinuity: z.boolean(),
    operationalLoopContinuity: z.boolean(),
    approvedParentMechanicContinuity: z.boolean(),
    candidateShapeKnown: z.boolean(),
    candidateShapeAnchor: z.boolean(),
    chainContinuity: z.boolean(),
    chainParentMatch: z.boolean(),
    familyContinuity: z.boolean(),
    familySpecificity: z.boolean(),
    approvedParentContinuity: z.boolean(),
    approvedParentContinuityDataPresent: z.boolean(),
    handcraftedAnchorTermOverlap: z.boolean(),
    handcraftedAnchorMechanicOverlap: z.boolean(),
    parentCapabilityContinuity: z.boolean(),
    hasConcretePrecursorContribution: z.boolean(),
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
const DEFAULT_CONCURRENCY = 5
const MODEL_STAGE_TIMEOUT_MS = 90_000
const MAX_MODEL_STAGE_RETRIES = 2
const INITIAL_MODEL_STAGE_BACKOFF_MS = 1_000
const MAX_MODEL_STAGE_BACKOFF_MS = 9_999

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

const MECHANIC_VERBS = [
  'add',
  'analyze',
  'browse',
  'calculate',
  'check',
  'compose',
  'create',
  'delete',
  'edit',
  'filter',
  'generate',
  'list',
  'mark',
  'open',
  'play',
  'record',
  'review',
  'save',
  'search',
  'select',
  'share',
  'simulate',
  'sort',
  'track',
  'translate',
  'update',
  'view',
  'watch',
] as const

const MECHANIC_REPLACEMENTS = new Map([
  ['analyse', 'analyze'],
  ['make', 'create'],
  ['build', 'create'],
  ['compose', 'create'],
  ['discover', 'browse'],
  ['edit', 'update'],
  ['explore', 'browse'],
  ['find', 'search'],
  ['watch', 'view'],
  ['zoom', 'view'],
  ['check', 'validate'],
]) as Map<string, string>

const OPERATIONAL_LOOP_MARKERS = ['for each', 'one by one', 'while', 'until', 'repeat', 'step', 'loop']

const PROMPT_ID_ROOT_MARKER = '-derived-'

const extractPromptScaleFromId = (value: string): string | null => {
  const normalized = value.trim().toLowerCase()
  const match = /-s([1-3])(?!\d)/i.exec(normalized)
  if (!match) return null
  return `S${match[1]}`
}

const normalizedPromptRoot = (value: string): string => {
  const normalized = value.toLowerCase().trim()
  const splitIndex = normalized.indexOf(PROMPT_ID_ROOT_MARKER)
  return splitIndex === -1 ? normalized : normalized.slice(0, splitIndex)
}

const relatedChainParentId = (value: string, expected: string): boolean => {
  const observed = value.trim().toLowerCase()
  const expectedLower = expected.trim().toLowerCase()
  if (!observed || !expectedLower) return false
  if (observed === expectedLower || observed.includes(expectedLower) || expectedLower.includes(observed)) return true

  const observedRoot = normalizedPromptRoot(observed)
  const expectedRoot = normalizedPromptRoot(expectedLower)
  if (!observedRoot || !expectedRoot || observedRoot !== expectedRoot) return false

  const observedScale = extractPromptScaleFromId(observed)
  const expectedScale = extractPromptScaleFromId(expectedLower)
  if (!observedScale || !expectedScale) return true
  return observedScale === expectedScale
}

const parseMechanicTokens = (value: string): string[] => {
  return dedupe(
    normalizeWord(value)
      .split(' ')
      .filter((word) => word.length >= 3)
      .map((word) => MECHANIC_REPLACEMENTS.get(word) ?? word)
      .filter((word) => MECHANIC_VERBS.includes(word as (typeof MECHANIC_VERBS)[number])),
  )
}

const parseReusableActions = (value: string): string[] =>
  parseMechanicTokens(value)
    .map((word) => word.trim())
    .filter((word) => word.length > 0)
    .slice(0, 6)

const dedupe = (values: string[]): string[] => {
  const seen = new Set<string>()
  return values.filter((value) => {
    if (seen.has(value)) return false
    seen.add(value)
    return true
  })
}

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

const SHAPE_TOKENS_BY_SCALE: Record<DerivedPromptCandidate['targetScale'], string[]> = {
  S1: ['atom', 'card', 'tile', 'chip', 'surface', 'item', 'widget', 'entry', 'surface'],
  S2: ['list', 'index', 'board', 'grid', 'directory', 'entries', 'collection', 'registry'],
  S3: ['stack', 'pipeline', 'journey', 'flow', 'stage', 'stage', 'composition', 'board'],
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
  sourceSeedAnchors: string
  sourceGroundingAnchors: string
  candidateShape: string
  sourceMechanics: string
  operationalLoop: string
  reusableActions: string
  handcraftedAnchorIds: string
  handcraftedAnchorTerms: string
  handcraftedAnchorMechanics: string
  targetShapeTransferSignals: string
  targetShapeTransferMechanics: string
  targetShapeTransferStructureSignals: string
  targetShapeTransferDynamicSignals: string
  targetShapeTransferManifest: string
  targetShapeTransferTerms: string
  approvedParentAnchor?: string
  approvedParentFamily?: string
  approvedParentScale?: string
  approvedParentMechanism?: string
  approvedParentSubject?: string
  sourceCoreUserJob: string
  sourceWhyRelevant: string
  contributesToParentCapability: string
  chainExpectedParentScale: string
  chainImmediateParentScale: string
  chainExpectedParentPromptId: string
  chainImmediateParentPromptId: string
  chainImmediateParentMechanics: string
  chainImmediateParentReusableActions: string
  chainImmediateParentOperationalLoop: string
  chainImmediateParentShape: string
  chainExpectedParentMechanism: string
  chainImmediateParentMechanism: string
  chainExpectedParentSubject: string
  chainImmediateParentSubject: string
  chainExpectedParentCapability: string
  chainImmediateParentCapability: string
  chainImmediateParentRole: string
  chainImmediateParentRoleAffordances: string
  chainPath: string
  chainProvided: boolean
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

const parseShapeFromCandidateId = (candidateId: string, targetScale: DerivedPromptCandidate['targetScale']): string => {
  const marker = `-derived-${targetScale.toLowerCase()}-`
  const markerIndex = candidateId.indexOf(marker)
  if (markerIndex === -1) return ''
  return candidateId.slice(markerIndex + marker.length)
}

const normalizeShapeTokens = (value: string): string[] =>
  value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((entry) => entry.length > 0)

const shapeSupportsScale = (shape: string, targetScale: DerivedPromptCandidate['targetScale']): boolean => {
  const shapeTokens = normalizeShapeTokens(shape)
  const expected = SHAPE_TOKENS_BY_SCALE[targetScale]

  if (shapeTokens.length === 0 || expected.length === 0) {
    return true
  }

  return shapeTokens.some((token) => expected.includes(token))
}

const parseCandidateScale = (targetScale: 'S1' | 'S2' | 'S3') => Number(targetScale.replace('S', ''))

const parseScaleLabel = (value: string): string | null => {
  const match = /(?:^|[^\w])(?:scale-|S)?\s*([1-8])(?:[^\w]|$)/i.exec(value)
  return match ? `S${match[1]!}` : null
}

const parseScaleValueFromLabel = (value: string): number | null => {
  const scaleLabel = parseScaleLabel(value)
  return scaleLabel === null ? null : Number(scaleLabel.replace('S', ''))
}

const chainPathIsPlausible = (chainPath: string): boolean => {
  const entries = chainPath
    .split('→')
    .map((entry) => parseScaleValueFromLabel(entry.trim()))
    .filter((value): value is number => value !== null)
  if (entries.length <= 1) {
    return true
  }

  for (let index = 1; index < entries.length; index += 1) {
    const previous = entries[index - 1]!
    const value = entries[index]!
    if (previous - value >= 1 && previous >= 1 && value >= 1) {
      continue
    }
    return false
  }
  return true
}

const chainPathHasTarget = (chainPath: string, targetScale: string): boolean => chainPath.includes(targetScale)

const expectedParentForTarget = (
  sourceId: string,
  targetScale: 'S1' | 'S2' | 'S3',
  sourceScaleLabel: string,
): CandidateChainContext => {
  if (targetScale === 'S3') {
    return {
      expectedParentPromptId: sourceId,
      parentScaleLabel: sourceScaleLabel || 'unknown',
      rootSourceId: sourceId,
      chainPath: [sourceScaleLabel || 'unknown', targetScale],
    }
  }

  if (targetScale === 'S2') {
    return {
      expectedParentPromptId: `${sourceId}-derived-s3`,
      parentScaleLabel: 'S3',
      rootSourceId: sourceId,
      chainPath: [sourceScaleLabel || 'unknown', 'S3', targetScale],
    }
  }

  return {
    expectedParentPromptId: `${sourceId}-derived-s2`,
    parentScaleLabel: 'S2',
    rootSourceId: sourceId,
    chainPath: [sourceScaleLabel || 'unknown', 'S3', 'S2', targetScale],
  }
}

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

const deriveChainContext = (
  candidate: DerivedPromptCandidate,
  sourceScaleLabel: string,
): {
  chainExpectedParentPromptId: string
  chainImmediateParentPromptId: string
  chainExpectedParentScale: string
  chainImmediateParentScale: string
  chainPath: string
  chainExpectedParentMechanism: string
  chainImmediateParentMechanism: string
  chainImmediateParentMechanics: string
  chainImmediateParentReusableActions: string
  chainImmediateParentOperationalLoop: string
  chainImmediateParentShape: string
  chainImmediateParentRole: string
  chainImmediateParentRoleAffordances: string
  chainExpectedParentSubject: string
  chainImmediateParentSubject: string
  chainExpectedParentCapability: string
  chainImmediateParentCapability: string
  chainProvided: boolean
} => {
  const chainContext = candidate.chain
  const sourceContext = asRecord(candidate.seedContext)
  const expected = expectedParentForTarget(candidate.sourceId, candidate.targetScale, sourceScaleLabel)
  const chainContextPath = chainContext?.chainPath ?? []
  const hasProvidedScale =
    typeof chainContext?.parentScaleLabel === 'string' && chainContext.parentScaleLabel.length > 0
  const hasProvidedPath = chainContextPath.length > 0
  const hasProvidedParent =
    typeof chainContext?.immediateParentPromptId === 'string' && chainContext.immediateParentPromptId.length > 0
  const chainProvided = hasProvidedScale || hasProvidedPath || hasProvidedParent

  const rawChainPath = hasProvidedPath ? chainContextPath : expected.chainPath
  const parsedPath = rawChainPath.length > 0 ? rawChainPath : ['unknown']
  const parsedChainPath = parsedPath.map((entry) => entry.trim()).filter((entry) => entry.length > 0)

  const parentScaleLabel = asString(chainContext?.parentScaleLabel) || expected.parentScaleLabel
  const expectedParentScale = expected.parentScaleLabel || 'unknown'
  const immediateParentScale = parseScaleLabel(parentScaleLabel) ?? expectedParentScale
  const expectedParentPromptId = expected.expectedParentPromptId || `${candidate.sourceId}`
  const expectedParentMechanism =
    asString(chainContext?.parentMechanism) || asString(sourceContext.chainExpectedParentMechanism)
  const expectedParentSubject =
    asString(chainContext?.parentSubject) || asString(sourceContext.chainExpectedParentSubject)
  const immediateParentMechanism =
    asString(chainContext?.parentMechanism) ||
    asString(chainContext?.immediateParentMechanism) ||
    asString(sourceContext.chainImmediateParentMechanism)
  const immediateParentSubject =
    asString(chainContext?.parentSubject) || asString(chainContext?.immediateParentSubject) || expectedParentSubject
  const immediateParentMechanics =
    asString(chainContext?.immediateParentMechanics) ||
    asString(sourceContext.chainImmediateParentMechanics) ||
    expectedParentMechanism
  const immediateParentReusableActions =
    asString(chainContext?.immediateParentReusableActions) ||
    asString(sourceContext.chainImmediateParentReusableActions)
  const immediateParentOperationalLoop =
    asString(chainContext?.immediateParentOperationalLoop) ||
    asString(sourceContext.chainImmediateParentOperationalLoop)
  const immediateParentShape =
    asString(chainContext?.immediateParentShape) || asString(sourceContext.chainImmediateParentShape)
  const immediateParentRole =
    asString(chainContext?.immediateParentRole) || asString(sourceContext.chainImmediateParentRole)
  const immediateParentRoleAffordances =
    asString(chainContext?.immediateParentRoleAffordances) ||
    asString(sourceContext.chainImmediateParentRoleAffordances)
  const chainExpectedParentCapability =
    asString(chainContext?.chainImmediateParentCapability) || asString(sourceContext.chainExpectedParentCapability)
  const chainImmediateParentCapability =
    asString(chainContext?.chainImmediateParentCapability) || asString(sourceContext.chainImmediateParentCapability)

  return {
    chainExpectedParentPromptId: asString(chainContext?.expectedParentPromptId) || expectedParentPromptId,
    chainImmediateParentPromptId: asString(chainContext?.immediateParentPromptId) || expectedParentPromptId,
    chainExpectedParentScale: expectedParentScale,
    chainImmediateParentScale: immediateParentScale,
    chainPath: parsedChainPath.join('→'),
    chainExpectedParentMechanism: expectedParentMechanism,
    chainImmediateParentMechanism: immediateParentMechanism,
    chainImmediateParentMechanics: immediateParentMechanics,
    chainImmediateParentReusableActions: immediateParentReusableActions,
    chainImmediateParentOperationalLoop: immediateParentOperationalLoop,
    chainImmediateParentShape: immediateParentShape,
    chainImmediateParentRole: immediateParentRole,
    chainImmediateParentRoleAffordances: immediateParentRoleAffordances,
    chainExpectedParentSubject: expectedParentSubject,
    chainImmediateParentSubject: immediateParentSubject,
    chainExpectedParentCapability,
    chainImmediateParentCapability,
    chainProvided,
  }
}

const extractOperationalLoopFromText = (value: string): string => {
  const normalized = normalizeWord(value)
  return OPERATIONAL_LOOP_MARKERS.find((marker) => normalized.includes(marker)) ?? ''
}

const parseSeedMechanics = (seed: SeedContext): string[] =>
  parseMechanicTokens(`${seed.seedTitle} ${seed.seedInput} ${seed.seedHint} ${seed.sourceMechanics}`).slice(0, 6)

const hasTokenOverlap = (left: string[], right: string[]): boolean => {
  const rightSet = new Set(right)
  return left.some((token) => rightSet.has(token))
}

const parseCandidateMechanics = (candidate: DerivedPromptCandidate): string[] =>
  parseMechanicTokens(`${candidate.input} ${candidate.hint}`).slice(0, 6)

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
  const chainContext = deriveChainContext(candidate, sourceScaleLabel)
  const candidateShape =
    asString(candidateContext.sourceShape) || parseShapeFromCandidateId(candidate.id, candidate.targetScale)
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
  const sourceMechanics =
    asString(candidateContext.sourceMechanics) ||
    parseMechanicTokens(`${seedTitle} ${seedInput} ${seedHint}`).join(', ')
  const operationalLoop =
    asString(candidateContext.operationalLoop) ||
    extractOperationalLoopFromText([seedInput, seedHint, sourceTitle, sourceDescription].join(' '))
  const reusableActions =
    asString(candidateContext.reusableActions) ||
    parseReusableActions([seedTitle, seedInput, seedHint].join(' ')).join(' → ')
  const handcraftedAnchorIds = asString(candidateContext.handcraftedAnchorIds)
  const handcraftedAnchorTerms = asString(candidateContext.handcraftedAnchorTerms)
  const handcraftedAnchorMechanics = asString(candidateContext.handcraftedAnchorMechanics)
  const approvedParentAnchor = asString(candidateContext.approvedParentAnchor)
  const approvedParentFamily = asString(candidateContext.approvedParentFamily)
  const approvedParentScale = asString(candidateContext.approvedParentScale)
  const approvedParentMechanism = asString(candidateContext.approvedParentMechanism)
  const approvedParentSubject = asString(candidateContext.approvedParentSubject)
  const contributesToParentCapability = asString(candidateContext.contributesToParentCapability)
  const sourceCoreUserJob =
    asString(candidateContext.sourceCoreUserJob) ||
    asString(seedReviewContext.coreUserJob) ||
    asString(sourceRecord.coreUserJob)
  const sourceWhyRelevant =
    asString(candidateContext.sourceWhyRelevant) ||
    asString(seedReviewContext.whyRelevant) ||
    asString(sourceRecord.whyRelevant)
  const targetShapeTransferSignals = asString(candidateContext.targetShapeTransferSignals)
  const targetShapeTransferMechanics = asString(candidateContext.targetShapeTransferMechanics)
  const targetShapeTransferStructureSignals = asString(candidateContext.targetShapeTransferStructureSignals)
  const targetShapeTransferDynamicSignals = asString(candidateContext.targetShapeTransferDynamicSignals)
  const targetShapeTransferManifest = asString(candidateContext.targetShapeTransferManifest)
  const targetShapeTransferTerms = asString(candidateContext.targetShapeTransferTerms)
  const sourceHasRewrittenSeed =
    asString(candidateContext.rewrittenTitle).length > 0 ||
    asString(candidateContext.rewrittenInput).length > 0 ||
    asString(candidateContext.rewrittenHint).length > 0 ||
    asString(seedReviewContext.generatedModernTitle).length > 0 ||
    asString(promptMetadata.generatedModernTitle).length > 0
  const sourceSeedAnchors =
    asString(candidateContext.sourceAnchors) ||
    splitTokens(
      [seedTitle, seedInput, seedHint, sourceTitle, sourceDescription, sourceCoreUserJob, sourceWhyRelevant].join(' '),
      80,
    ).join(' ')
  const sourceGroundingAnchors =
    asString(candidateContext.sourceGroundingAnchors) ||
    splitTokens(
      [sourceTitle, sourceDescription, sourceCoreUserJob, sourceWhyRelevant, sourceStructure, sourceFamily].join(' '),
      80,
    ).join(' ')

  return {
    sourceId: candidate.sourceId,
    seedTitle,
    seedInput,
    seedHint,
    candidateShape,
    sourceTitle,
    sourceDescription,
    sourceFamily,
    sourceStructure,
    sourceScale,
    sourceScaleLabel,
    chainExpectedParentScale: chainContext.chainExpectedParentScale,
    chainImmediateParentScale: chainContext.chainImmediateParentScale,
    chainExpectedParentPromptId: chainContext.chainExpectedParentPromptId,
    chainImmediateParentPromptId: chainContext.chainImmediateParentPromptId,
    chainImmediateParentMechanics: chainContext.chainImmediateParentMechanics,
    chainImmediateParentReusableActions: chainContext.chainImmediateParentReusableActions,
    chainImmediateParentOperationalLoop: chainContext.chainImmediateParentOperationalLoop,
    chainImmediateParentShape: chainContext.chainImmediateParentShape,
    chainImmediateParentRole: chainContext.chainImmediateParentRole,
    chainImmediateParentRoleAffordances: chainContext.chainImmediateParentRoleAffordances,
    chainExpectedParentMechanism: chainContext.chainExpectedParentMechanism,
    chainImmediateParentMechanism: chainContext.chainImmediateParentMechanism,
    chainExpectedParentCapability: chainContext.chainExpectedParentCapability,
    chainImmediateParentCapability: chainContext.chainImmediateParentCapability,
    chainExpectedParentSubject: chainContext.chainExpectedParentSubject,
    chainImmediateParentSubject: chainContext.chainImmediateParentSubject,
    chainPath: chainContext.chainPath,
    chainProvided: chainContext.chainProvided,
    sourceHasRewrittenSeed,
    sourceSeedAnchors,
    sourceGroundingAnchors,
    sourceMechanics,
    operationalLoop,
    reusableActions,
    handcraftedAnchorIds,
    handcraftedAnchorTerms,
    handcraftedAnchorMechanics,
    approvedParentAnchor,
    approvedParentFamily,
    approvedParentScale,
    approvedParentMechanism,
    approvedParentSubject,
    sourceCoreUserJob,
    sourceWhyRelevant,
    contributesToParentCapability,
    targetShapeTransferSignals,
    targetShapeTransferMechanics,
    targetShapeTransferStructureSignals,
    targetShapeTransferDynamicSignals,
    targetShapeTransferManifest,
    targetShapeTransferTerms,
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

const buildNgrams = (tokens: string[], size: number): string[] => {
  if (tokens.length < size) return []
  const result: string[] = []
  for (let index = 0; index <= tokens.length - size; index += 1) {
    result.push(tokens.slice(index, index + size).join(' '))
  }
  return result
}

const hasLongCopy = (left: string, right: string, minGram = 5): boolean => {
  const leftTokens = splitTokens(left, 300)
  const rightTokens = splitTokens(right, 600)
  if (leftTokens.length < minGram || rightTokens.length < minGram) return false

  const leftNgrams = new Set(buildNgrams(leftTokens, minGram))
  const rightNgrams = buildNgrams(rightTokens, minGram)
  return rightNgrams.some((ngram) => leftNgrams.has(ngram))
}

const parseTransferAlignmentTokens = (...fields: string[]): Set<string> =>
  new Set(fields.flatMap((field) => splitTokens(field, 160)).map((token) => token.toLowerCase()))

const parseAnchorIdTokens = (value: string, limit: number): string[] => {
  return dedupe(
    normalizeWord(value)
      .replace(/\(.+\)/g, ' ')
      .split(/[\s,.-]+/)
      .filter((entry) => entry.length >= 4 && !STOP_WORDS.has(entry))
      .slice(0, limit),
  )
}

const parseHandcraftedMechanicTokens = (value: string): string[] => {
  return parseMechanicTokens(value)
    .map((mechanic) => mechanic.trim())
    .filter((mechanic) => mechanic.length > 0)
    .slice(0, 12)
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

const extractSourceEvidenceAnchorSet = (context: SeedContext): Set<string> => {
  const sourceFields = [
    context.sourceTitle,
    context.sourceDescription,
    context.sourceCoreUserJob,
    context.sourceWhyRelevant,
    context.sourceStructure,
  ]
  const tokens = sourceFields.flatMap((value) => (value ? splitTokens(value, 160) : []))
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
  if (sourceScale !== null && sourceScale < 2) {
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

  const sourceAnchorTokens =
    splitTokens(sourceContext.sourceSeedAnchors || '', 80).length > 0
      ? splitTokens(sourceContext.sourceSeedAnchors, 80)
      : Array.from(extractAnchorSet(sourceContext))
  const sourceEvidenceTokens =
    splitTokens(sourceContext.sourceGroundingAnchors || '', 80).length > 0
      ? splitTokens(sourceContext.sourceGroundingAnchors, 80)
      : Array.from(extractSourceEvidenceAnchorSet(sourceContext))
  const sourceAnchorSet = new Set(sourceAnchorTokens)
  const sourceEvidenceAnchorSet = new Set(sourceEvidenceTokens)
  const derivedTokens = new Set(splitTokens(normalizedCombined, 120))
  const candidateMechanics = parseCandidateMechanics(candidate)
  const approvedParentAnchorTokens = new Set(parseAnchorIdTokens(`${sourceContext.approvedParentAnchor ?? ''}`, 12))
  const approvedParentTermTokens = new Set(
    splitTokens(`${sourceContext.approvedParentSubject ?? ''} ${sourceContext.approvedParentFamily ?? ''}`, 40),
  )
  const approvedParentMechanicTokens = new Set(
    parseHandcraftedMechanicTokens(
      `${sourceContext.approvedParentMechanism ?? ''} ${sourceContext.approvedParentSubject ?? ''}`,
    ),
  )
  const handcraftedAnchorIdTokens = new Set(parseAnchorIdTokens(sourceContext.handcraftedAnchorIds ?? '', 12))
  const handcraftedAnchorTermTokens = new Set(splitTokens(sourceContext.handcraftedAnchorTerms, 80))
  const handcraftedAnchorMechanicTokens = new Set(
    parseHandcraftedMechanicTokens(sourceContext.handcraftedAnchorMechanics),
  )
  const approvedParentContinuityDataPresent =
    approvedParentAnchorTokens.size > 0 || approvedParentTermTokens.size > 0 || approvedParentMechanicTokens.size > 0
  const approvedParentContinuity = approvedParentContinuityDataPresent
    ? Array.from(derivedTokens).some(
        (word) =>
          approvedParentAnchorTokens.has(word) ||
          approvedParentTermTokens.has(word) ||
          approvedParentMechanicTokens.has(word),
      )
    : true
  const handcraftedAnchorTermOverlap =
    handcraftedAnchorIdTokens.size === 0 && handcraftedAnchorTermTokens.size === 0
      ? true
      : Array.from(derivedTokens).some(
          (word) => handcraftedAnchorIdTokens.has(word) || handcraftedAnchorTermTokens.has(word),
        )
  const handcraftedAnchorMechanicOverlap =
    handcraftedAnchorMechanicTokens.size === 0
      ? true
      : candidateMechanics.some((mechanic) => handcraftedAnchorMechanicTokens.has(mechanic))

  const hasSourceLexicalAnchor = sourceExists && Array.from(derivedTokens).some((word) => sourceAnchorSet.has(word))

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

  const candidateShape = sourceContext.candidateShape
  const candidateShapeTokens = normalizeShapeTokens(candidateShape)
  const hasCandidateShapeAnchor =
    candidateShapeTokens.length === 0 || candidateShapeTokens.some((word) => derivedTokens.has(word))
  if (!hasCandidateShapeAnchor) {
    softWarnings.push(`missing-shape-anchor:${candidateShape}`)
  }
  const shapeScaleAligned = candidateShape.length === 0 || shapeSupportsScale(candidateShape, candidate.targetScale)
  if (!shapeScaleAligned) {
    softWarnings.push(`shape-scale-mismatch:${candidateShape}->${candidate.targetScale}`)
  }

  const hasSourceEvidenceAnchor =
    sourceExists &&
    (sourceEvidenceAnchorSet.size === 0
      ? sourceContext.sourceTitle.length > 0 || sourceContext.sourceDescription.length > 0
      : Array.from(derivedTokens).some((word) => sourceEvidenceAnchorSet.has(word)))

  const sourceMechanicTokens = parseMechanicTokens(sourceContext.sourceMechanics)
  const seedMechanics = parseSeedMechanics(sourceContext)
  const parentMechanicTokens = parseHandcraftedMechanicTokens(
    `${sourceContext.chainImmediateParentMechanism || sourceContext.approvedParentMechanism || ''}`,
  )
  const hasMechanicsContinuity =
    sourceMechanicTokens.length === 0
      ? parentMechanicTokens.length === 0
        ? true
        : hasTokenOverlap(candidateMechanics, parentMechanicTokens)
      : hasTokenOverlap(candidateMechanics, seedMechanics) ||
        (parentMechanicTokens.length > 0 && hasTokenOverlap(candidateMechanics, parentMechanicTokens))
  if (!hasMechanicsContinuity) {
    softWarnings.push(`missing-mechanics-continuity:${sourceMechanicTokens.join(',') || 'none'}`)
  }

  const parentRoleMechanicTokens = parseHandcraftedMechanicTokens(
    `${sourceContext.chainImmediateParentMechanism} ${sourceContext.chainExpectedParentMechanism} ${sourceContext.approvedParentMechanism ?? ''}`,
  )
  const parentRoleTermTokens = new Set(
    splitTokens(
      `${sourceContext.chainImmediateParentSubject} ${sourceContext.chainExpectedParentSubject} ${sourceContext.approvedParentSubject ?? ''}`,
      40,
    ),
  )
  const parentRoleMechanicOverlap =
    parentRoleMechanicTokens.length > 0 && hasTokenOverlap(candidateMechanics, parentRoleMechanicTokens)
  const parentRoleTermOverlap =
    parentRoleTermTokens.size > 0 && Array.from(derivedTokens).some((word) => parentRoleTermTokens.has(word))
  const chainParentMechanicSignalTokens = sourceContext.chainImmediateParentMechanics
    ? parseMechanicTokens(sourceContext.chainImmediateParentMechanics)
    : []
  const hasParentRoleContinuity =
    parentRoleMechanicTokens.length === 0 &&
    parentRoleTermTokens.size === 0 &&
    chainParentMechanicSignalTokens.length === 0
      ? false
      : parentRoleMechanicOverlap ||
        parentRoleTermOverlap ||
        hasTokenOverlap(candidateMechanics, chainParentMechanicSignalTokens)
  const immediateParentRoleTokens = parseHandcraftedMechanicTokens(sourceContext.chainImmediateParentRoleAffordances)
  const immediateParentRoleTermTokens = new Set(splitTokens(sourceContext.chainImmediateParentRole, 20))
  const immediateParentRoleContinuity =
    immediateParentRoleTokens.length === 0 && immediateParentRoleTermTokens.size === 0
      ? hasParentRoleContinuity
      : hasTokenOverlap(candidateMechanics, immediateParentRoleTokens) ||
        Array.from(immediateParentRoleTermTokens).some((word) => derivedTokens.has(word))
  if (!immediateParentRoleContinuity) {
    softWarnings.push(`missing-immediate-parent-role-continuity:${sourceContext.chainImmediateParentRole || 'missing'}`)
  }

  const approvedParentMechanicContinuity =
    approvedParentMechanicTokens.size === 0
      ? true
      : candidateMechanics.some((mechanic) => approvedParentMechanicTokens.has(mechanic))
  if (!approvedParentMechanicContinuity) {
    softWarnings.push(`missing-approved-parent-mechanics:${sourceContext.approvedParentMechanism || 'none'}`)
  }

  const reusableActionTokens =
    parseReusableActions(sourceContext.reusableActions).length > 0
      ? parseReusableActions(sourceContext.reusableActions)
      : seedMechanics
  const chainParentReusableActions = parseReusableActions(sourceContext.chainImmediateParentReusableActions)
  const reusableActionSignal =
    reusableActionTokens.length === 0
      ? true
      : candidateMechanics.some((mechanic) => reusableActionTokens.includes(mechanic))
  if (!reusableActionSignal && chainParentReusableActions.length === 0) {
    softWarnings.push('missing-reusable-action-signal')
  }
  const reusableActionLoopContinuity =
    chainParentReusableActions.length === 0
      ? reusableActionSignal
      : chainParentReusableActions.some((action) => candidateMechanics.includes(action))
  if (!reusableActionLoopContinuity && chainParentReusableActions.length > 0) {
    softWarnings.push(`missing-reusable-action-loop:${chainParentReusableActions.join(' ')}`)
  }

  const sourceLoop = sourceContext.operationalLoop
  const candidateLoop =
    extractOperationalLoopFromText(`${candidate.input} ${candidate.hint}`) ||
    extractOperationalLoopFromText(`${sourceContext.seedInput} ${sourceContext.seedHint}`)

  const chainParentMechanicTokens =
    chainParentReusableActions.length > 0
      ? chainParentReusableActions
      : sourceContext.chainImmediateParentMechanics
        ? parseMechanicTokens(sourceContext.chainImmediateParentMechanics)
        : []
  const hasPrecursorMechanicsContinuity =
    sourceContext.chainImmediateParentScale.length === 0
      ? true
      : chainParentMechanicTokens.length === 0
        ? hasMechanicsContinuity
        : hasTokenOverlap(candidateMechanics, chainParentMechanicTokens)
  if (!hasPrecursorMechanicsContinuity) {
    softWarnings.push(`missing-immediate-parent-mechanics:${sourceContext.chainImmediateParentScale}`)
  }

  const parentCapabilityTokens = splitTokens(
    `${sourceContext.contributesToParentCapability} ${sourceContext.chainImmediateParentCapability} ${sourceContext.chainExpectedParentCapability} ${sourceContext.approvedParentMechanism} ${sourceContext.approvedParentSubject}`,
    80,
  )
  const parentCapabilityTokenSet = new Set(parentCapabilityTokens)
  const parentCapabilityContinuity =
    parentCapabilityTokens.length === 0
      ? true
      : Array.from(derivedTokens).some((word) => parentCapabilityTokenSet.has(word))
  if (!parentCapabilityContinuity) {
    softWarnings.push('missing-parent-capability-anchor')
  }
  const concreteContributionSignals = [
    'filter',
    'select',
    'open',
    'browse',
    'compose',
    'sequence',
    'index',
    'list',
    'detail',
  ]
  const concreteContributionTokenSet = new Set(concreteContributionSignals)
  const concretePrecursorContribution =
    parentCapabilityContinuity ||
    reusableActionLoopContinuity ||
    hasPrecursorMechanicsContinuity ||
    candidateMechanics.some((mechanic) => concreteContributionTokenSet.has(mechanic))
  if (!concretePrecursorContribution) {
    softWarnings.push('family-agnostic-filler-precursor')
  }

  const parentLoop =
    sourceContext.chainImmediateParentOperationalLoop.length > 0
      ? sourceContext.chainImmediateParentOperationalLoop
      : sourceContext.operationalLoop
  const chainParentLoopContinuity =
    parentLoop.length === 0 ||
    candidateLoop.length === 0 ||
    parentLoop.includes(candidateLoop) ||
    candidateLoop.includes(parentLoop)
  if (!chainParentLoopContinuity) {
    softWarnings.push(`missing-immediate-parent-loop:${parentLoop || 'none'}->${candidateLoop || 'none'}`)
  }

  const operationalLoopContinuity =
    sourceLoop.length === 0 ||
    candidateLoop.length === 0 ||
    sourceLoop.includes(candidateLoop) ||
    candidateLoop.includes(sourceLoop)
  if (!operationalLoopContinuity) {
    softWarnings.push(`missing-operational-loop-continuity:${sourceLoop || 'none'}->${candidateLoop || 'none'}`)
  }

  const parentRoleSignalPresent =
    parentRoleMechanicTokens.length > 0 ||
    parentRoleTermTokens.size > 0 ||
    sourceContext.chainImmediateParentMechanism.length > 0 ||
    sourceContext.chainExpectedParentMechanism.length > 0 ||
    (sourceContext.approvedParentMechanism ?? '').length > 0 ||
    (sourceContext.approvedParentSubject ?? '').length > 0
  const precursorAffordanceSignalPresent =
    chainParentReusableActions.length > 0 ||
    sourceContext.chainImmediateParentOperationalLoop.length > 0 ||
    sourceContext.operationalLoop.length > 0
  const precursorAffordanceContinuity =
    chainParentReusableActions.length > 0
      ? chainParentReusableActions.some((action) => candidateMechanics.includes(action))
      : sourceContext.chainImmediateParentOperationalLoop.length > 0
        ? chainParentLoopContinuity
        : sourceContext.operationalLoop.length > 0
          ? operationalLoopContinuity
          : false

  const allowWeakAnchorFallback =
    hasMechanicsContinuity &&
    hasParentRoleContinuity &&
    parentRoleSignalPresent &&
    precursorAffordanceSignalPresent &&
    precursorAffordanceContinuity
  const hasSourceAnchorsStrict = sourceContext.chainProvided
  const hasSourceLexicalAnchorWithContext = hasSourceAnchorsStrict
    ? hasSourceLexicalAnchor
    : allowWeakAnchorFallback || hasSourceLexicalAnchor
  const hasSourceEvidenceAnchorWithContext = hasSourceAnchorsStrict
    ? hasSourceEvidenceAnchor
    : allowWeakAnchorFallback || hasSourceEvidenceAnchor
  if (sourceExists && !hasSourceLexicalAnchorWithContext) {
    softWarnings.push('weak-lexical-anchor')
  }
  if (sourceExists && !hasSourceEvidenceAnchorWithContext) {
    softWarnings.push('missing-source-evidence-anchor')
  }
  const hasDualSourceAnchorEvidence = sourceExists
    ? hasRewrittenSeedAnchor && hasSourceEvidenceAnchorWithContext
    : false

  const expectedParentPromptId =
    sourceContext.chainExpectedParentPromptId ||
    (candidate.targetScale === 'S3'
      ? `${candidate.sourceId}`
      : candidate.targetScale === 'S2'
        ? `${candidate.sourceId}-derived-s3`
        : `${candidate.sourceId}-derived-s2`)
  const chainParentMatch =
    sourceContext.chainImmediateParentPromptId.length > 0
      ? relatedChainParentId(sourceContext.chainImmediateParentPromptId, expectedParentPromptId)
      : true
  if (!chainParentMatch) {
    softWarnings.push(`chain-parent-mismatch:${sourceContext.chainImmediateParentPromptId}`)
  }

  const chainExpectedScale =
    parseScaleLabel(sourceContext.chainExpectedParentScale) ?? parseScaleLabel(expectedParentPromptId)
  const chainImmediateScale = parseScaleLabel(sourceContext.chainImmediateParentScale) ?? chainExpectedScale
  const chainContinuity =
    chainExpectedScale === null || chainImmediateScale === null || chainExpectedScale === chainImmediateScale
  if (!chainContinuity) {
    softWarnings.push(`chain-scale-mismatch:${chainImmediateScale}->${chainExpectedScale}`)
  }
  const chainPathContinuity =
    chainPathIsPlausible(sourceContext.chainPath) &&
    chainPathHasTarget(sourceContext.chainPath, candidate.targetScale) &&
    (sourceContext.chainPath.includes(sourceContext.chainExpectedParentScale) ||
      sourceContext.chainExpectedParentScale.length === 0) &&
    (sourceContext.chainPath.includes(sourceContext.chainImmediateParentScale) ||
      sourceContext.chainImmediateParentScale.length === 0)
  if (!chainPathContinuity) {
    softWarnings.push(`chain-path-continuity:${sourceContext.chainPath || 'missing'}`)
  }

  const targetShapeTransferSignalTokens = parseTransferAlignmentTokens(
    sourceContext.targetShapeTransferSignals,
    sourceContext.targetShapeTransferMechanics,
    sourceContext.targetShapeTransferStructureSignals,
    sourceContext.targetShapeTransferDynamicSignals,
    sourceContext.targetShapeTransferTerms,
  )
  const targetShapeTransferMechanicTokens = new Set(
    parseMechanicTokens(sourceContext.targetShapeTransferMechanics)
      .filter((mechanic) => mechanic.length >= 3)
      .slice(0, 36),
  )
  const targetShapeTransferContinuityDataPresent =
    targetShapeTransferSignalTokens.size > 0 || targetShapeTransferMechanicTokens.size > 0
  const hasTargetShapeTransferSignals =
    targetShapeTransferSignalTokens.size === 0 ||
    Array.from(derivedTokens).some(
      (word) => targetShapeTransferSignalTokens.has(word) || targetShapeTransferMechanicTokens.has(word),
    ) ||
    targetShapeTransferMechanicTokens.size === 0
  const targetShapeTransferContinuity = targetShapeTransferContinuityDataPresent ? hasTargetShapeTransferSignals : true
  if (!targetShapeTransferContinuity && targetShapeTransferContinuityDataPresent) {
    softWarnings.push('missing-target-shape-transfer')
  }

  const targetShapeTransferCopySources = [
    sourceContext.handcraftedAnchorIds,
    sourceContext.handcraftedAnchorTerms,
    sourceContext.handcraftedAnchorMechanics,
    sourceContext.targetShapeTransferManifest,
    `${sourceContext.seedTitle} ${sourceContext.seedInput} ${sourceContext.seedHint}`,
  ].join(' ')
  const handcraftedStyleCopySafe =
    !hasLongCopy(targetShapeTransferCopySources, normalizedCombined, 8) &&
    !hasLongCopy(
      `${sourceContext.seedTitle} ${sourceContext.seedInput} ${sourceContext.seedHint}`,
      normalizedCombined,
      8,
    )
  if (!handcraftedStyleCopySafe) {
    softWarnings.push('style-copying-from-handcrafted')
  }

  const family = sourceContext.sourceFamily.length > 0 ? sourceContext.sourceFamily : 'unknown'
  const familyContinuity =
    family === 'unknown' ? hasRewrittenSeedAnchor : hasFamilyTermOverlap(family, normalizedCombined)
  const familySpecificity = family !== 'unknown' ? familyContinuity : true
  if (!familyContinuity) {
    softWarnings.push('family-continuity-gap')
    softWarnings.push('family-generic-filler-risk')
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
    hasSourceLexicalAnchorWithContext,
    hasSourceEvidenceAnchorWithContext,
    hasDualSourceAnchorEvidence,
    hasMechanicsContinuity,
    reusableActionSignal,
    reusableActionLoopContinuity,
    operationalLoopContinuity,
    candidateShape.length > 0,
    hasCandidateShapeAnchor,
    shapeScaleAligned,
    chainContinuity,
    chainParentMatch,
    hasPrecursorMechanicsContinuity,
    chainParentLoopContinuity,
    chainPathContinuity,
    familyContinuity,
    familySpecificity,
    approvedParentContinuity,
    approvedParentContinuityDataPresent,
    handcraftedAnchorTermOverlap,
    handcraftedAnchorMechanicOverlap,
    targetShapeTransferContinuity,
    targetShapeTransferContinuityDataPresent,
    handcraftedStyleCopySafe,
    immediateParentRoleContinuity,
    parentCapabilityContinuity,
    concretePrecursorContribution,
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
      hasSourceLexicalAnchor: hasSourceLexicalAnchorWithContext,
      hasSourceEvidenceAnchor: hasSourceEvidenceAnchorWithContext,
      hasDualSourceAnchorEvidence,
      sourceMechanicsContinuity: hasMechanicsContinuity,
      reusableActionsSignal: reusableActionSignal,
      reusableActionLoopContinuity,
      approvedParentMechanicContinuity,
      operationalLoopContinuity,
      immediateParentMechanicsContinuity: hasPrecursorMechanicsContinuity,
      immediateParentOperationalLoopContinuity: chainParentLoopContinuity,
      immediateParentRoleContinuity,
      chainPathContinuity,
      shapeScaleAligned,
      candidateShapeKnown: candidateShape.length > 0,
      candidateShapeAnchor: hasCandidateShapeAnchor,
      targetShapeTransferContinuity,
      targetShapeTransferContinuityDataPresent,
      handcraftedStyleCopySafe,
      chainContinuity,
      chainParentMatch,
      familyContinuity,
      familySpecificity,
      approvedParentContinuity,
      approvedParentContinuityDataPresent,
      handcraftedAnchorTermOverlap,
      handcraftedAnchorMechanicOverlap,
      parentCapabilityContinuity,
      hasConcretePrecursorContribution: concretePrecursorContribution,
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
  let concurrency = DEFAULT_CONCURRENCY
  let resume = true

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
    if (arg === '--concurrency' && args[index + 1]) {
      concurrency = Math.max(1, Number(args[index + 1]!))
      index += 1
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

  return { candidatesPath, sourcePath, outputPath, progress, concurrency, resume }
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

const readExistingEvaluationIds = async (path: string): Promise<Set<string>> => {
  if (!(await Bun.file(path).exists())) return new Set()
  const text = await Bun.file(path).text()
  return new Set(
    text
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        try {
          const row = JSON.parse(line) as { candidate?: { id?: unknown } }
          return typeof row.candidate?.id === 'string' ? row.candidate.id : null
        } catch {
          return null
        }
      })
      .filter((id): id is string => Boolean(id)),
  )
}

const getJudgeCostUsd = (value: unknown): number => {
  const record = asRecord(value)
  return typeof record.totalCostUsd === 'number' ? record.totalCostUsd : 0
}

const summarizeExistingEvaluations = async (path: string) => {
  if (!(await Bun.file(path).exists())) {
    return {
      processedCandidates: 0,
      blockedDeterministically: 0,
      judgePassed: 0,
      metaPassed: 0,
      recommended: 0,
      judgeCostUsd: 0,
      metaVerifierCostUsd: 0,
      sourceFamilies: {} as Record<string, number>,
    }
  }

  const text = await Bun.file(path).text()
  const rows = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as DerivedPromptEvaluation)

  return {
    processedCandidates: rows.length,
    blockedDeterministically: rows.filter((row) => row.deterministicCheck.pass === false).length,
    judgePassed: rows.filter((row) => row.judge?.pass === true).length,
    metaPassed: rows.filter((row) => row.metaVerification?.pass === true).length,
    recommended: rows.filter((row) => row.recommended === true).length,
    judgeCostUsd: rows.reduce((sum, row) => sum + getJudgeCostUsd(asRecord(row.judge?.outcome).judgeSdk), 0),
    metaVerifierCostUsd: rows.reduce(
      (sum, row) => sum + getJudgeCostUsd(asRecord(row.metaVerification?.outcome).metaVerificationSdk),
      0,
    ),
    sourceFamilies: summarizeFamilies(rows),
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
    `Approved parent: ${sourceContext.approvedParentAnchor || 'missing'} (${sourceContext.approvedParentFamily || 'missing'}/${sourceContext.approvedParentScale || 'missing'})`,
    `Approved parent mechanics / subject: ${sourceContext.approvedParentMechanism || 'missing'} / ${sourceContext.approvedParentSubject || 'missing'}`,
    `Parent contribution: ${sourceContext.contributesToParentCapability || 'missing'}`,
    `Precursor chain: immediate parent scale ${sourceContext.chainImmediateParentScale} -> target ${candidate.targetScale}`,
    `Chain expectation: expected parent id ${sourceContext.chainExpectedParentPromptId} (${sourceContext.chainExpectedParentScale})`,
    `Chain immediate parent id: ${sourceContext.chainImmediateParentPromptId} (${sourceContext.chainImmediateParentScale})`,
    `Expected chain parent mechanism: ${sourceContext.chainExpectedParentMechanism || 'missing'} / subject: ${sourceContext.chainExpectedParentSubject || 'missing'}`,
    `Expected chain parent capability: ${sourceContext.chainExpectedParentCapability || 'missing'}`,
    `Observed chain parent mechanism: ${sourceContext.chainImmediateParentMechanism || 'missing'} / subject: ${sourceContext.chainImmediateParentSubject || 'missing'}`,
    `Observed chain parent role: ${sourceContext.chainImmediateParentRole || 'missing'} / affordances: ${
      sourceContext.chainImmediateParentRoleAffordances || 'missing'
    }`,
    `Observed chain parent capability: ${sourceContext.chainImmediateParentCapability || 'missing'}`,
    `Chain path: ${sourceContext.chainPath || 'legacy'}`,
    '',
    'Rewritten seed (primary source):',
    `- title: ${sourceContext.seedTitle || 'missing'}`,
    `- input: ${sourceContext.seedInput || 'missing'}`,
    `- hint: ${sourceContext.seedHint || 'missing'}`,
    `- recurring mechanics: ${sourceContext.sourceMechanics || 'not-provided'}`,
    `- operational loop: ${sourceContext.operationalLoop || 'not-provided'}`,
    `- reusable actions: ${sourceContext.reusableActions || 'not-provided'}`,
    `- handcrafted anchor mechanics: ${sourceContext.handcraftedAnchorMechanics || 'not-provided'}`,
    `- grounded anchor terms: ${sourceContext.handcraftedAnchorTerms || 'not-provided'}`,
    `- low-scale anchor ids: ${sourceContext.handcraftedAnchorIds || 'not-provided'}`,
    '',
    `Candidate precursor shape: ${sourceContext.candidateShape || 'unknown'}`,
    `Candidate mechanics: ${parseCandidateMechanics(candidate).join(', ') || 'not-provided'}`,
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

const getSummaryPath = (outputPath: string) => `${outputPath}.summary.json`

const getErrorsPath = (outputPath: string) => `${outputPath}.errors.jsonl`

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const computeBackoffMs = (attempt: number): number => {
  const exponential = Math.min(MAX_MODEL_STAGE_BACKOFF_MS, INITIAL_MODEL_STAGE_BACKOFF_MS * 2 ** attempt)
  const jitter = Math.floor(Math.random() * 250)
  return exponential + jitter
}

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
      const reason = error instanceof Error ? error.message : String(error)
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

const logProgress = ({ enabled, message }: { enabled: boolean; message: string }) => {
  if (!enabled) {
    return
  }

  console.error(`[modnet-derive-eval] ${message}`)
}

const processCandidate = async ({
  candidate,
  sourceCatalog,
  seenIds,
  index,
  total,
  progress,
}: {
  candidate: DerivedPromptCandidate
  sourceCatalog: Map<string, PromptCase>
  seenIds: Set<string>
  index: number
  total: number
  progress: boolean
}): Promise<DerivedPromptEvaluation> => {
  logProgress({
    enabled: progress,
    message: `candidate ${index + 1}/${total}: ${candidate.id} precheck`,
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
      message: `candidate ${index + 1}/${total}: ${candidate.id} blocked (missing source)`,
    })
    return DerivedPromptEvaluationSchema.parse({
      candidate,
      sourcePrompt: PromptCaseSchema.parse({
        id: candidate.sourceId,
        input: '',
      }),
      deterministicCheck,
      recommended: false,
    })
  }

  if (!deterministicCheck.pass) {
    logProgress({
      enabled: progress,
      message: `candidate ${index + 1}/${total}: ${candidate.id} blocked (${deterministicCheck.hardFailures.join(', ')})`,
    })
    return DerivedPromptEvaluationSchema.parse({
      candidate,
      sourcePrompt,
      deterministicCheck,
      recommended: false,
    })
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
    message: `candidate ${index + 1}/${total}: ${candidate.id} judge`,
  })
  const judge = await runRetriableStage({
    label: `${candidate.id} judge`,
    operation: () =>
      judgeDerivedPrompt({
        input: task,
        output: JSON.stringify(candidate, null, 2),
        metadata,
      }),
    onRetry: (message) => logProgress({ enabled: progress, message }),
  })
  logProgress({
    enabled: progress,
    message: `candidate ${index + 1}/${total}: ${candidate.id} meta-verifier`,
  })
  const metaVerification = await runRetriableStage({
    label: `${candidate.id} meta-verifier`,
    operation: () =>
      metaVerifyDerivedPrompt({
        input: task,
        output: JSON.stringify(judge, null, 2),
        metadata: {
          ...metadata,
          judgeResult: judge,
        },
      }),
    onRetry: (message) => logProgress({ enabled: progress, message }),
  })

  const evaluation = DerivedPromptEvaluationSchema.parse({
    candidate,
    sourcePrompt,
    deterministicCheck,
    judge,
    metaVerification,
    recommended: deterministicCheck.pass && judge.pass && metaVerification.pass,
  })
  logProgress({
    enabled: progress,
    message: `candidate ${index + 1}/${total}: ${candidate.id} done judge=${judge.pass} meta=${metaVerification.pass}`,
  })
  return evaluation
}

const main = async () => {
  const { candidatesPath, sourcePath, outputPath, progress, concurrency, resume } = parseArgs()
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
  const errorsPath = getErrorsPath(outputPath)
  const summaryPath = getSummaryPath(outputPath)
  const existingIds = resume ? await readExistingEvaluationIds(outputPath) : new Set<string>()
  const pendingCandidates = candidates.filter((candidate) => !existingIds.has(candidate.id))
  const seenIds = new Set(existingIds)

  if (resume) {
    if (!(await Bun.file(errorsPath).exists())) {
      await resetJsonlOutput(errorsPath)
    }
  } else {
    await resetJsonlOutput(outputPath)
    await resetJsonlOutput(errorsPath)
  }

  const existingSummary = resume
    ? await summarizeExistingEvaluations(outputPath)
    : {
        processedCandidates: 0,
        blockedDeterministically: 0,
        judgePassed: 0,
        metaPassed: 0,
        recommended: 0,
        judgeCostUsd: 0,
        metaVerifierCostUsd: 0,
        sourceFamilies: {} as Record<string, number>,
      }

  let processedCandidates = existingSummary.processedCandidates
  let blockedDeterministically = existingSummary.blockedDeterministically
  let judgePassed = existingSummary.judgePassed
  let metaPassed = existingSummary.metaPassed
  let recommended = existingSummary.recommended
  let failedCandidates = resume ? await countErrorRows(errorsPath) : 0
  let judgeCostUsd = existingSummary.judgeCostUsd
  let metaVerifierCostUsd = existingSummary.metaVerifierCostUsd
  const familyCounts = new Map(Object.entries(existingSummary.sourceFamilies))
  let lastFailure: { id: string; message: string } | null = null
  let writeQueue = Promise.resolve()

  const writeSummary = async () => {
    await Bun.write(
      summaryPath,
      `${JSON.stringify(
        {
          candidatesPath,
          sourcePath,
          outputPath,
          errorsPath,
          totalCandidates: candidates.length,
          pendingCandidates: pendingCandidates.length,
          processedCandidates,
          failedCandidates,
          blockedDeterministically,
          judgePassed,
          metaPassed,
          recommended,
          spendUsd: {
            judge: Number(judgeCostUsd.toFixed(6)),
            metaVerifier: Number(metaVerifierCostUsd.toFixed(6)),
            total: Number((judgeCostUsd + metaVerifierCostUsd).toFixed(6)),
          },
          sourceFamilies: Object.fromEntries(
            Array.from(familyCounts.entries()).sort((left, right) => right[1] - left[1]),
          ),
          lastFailure,
          updatedAt: new Date().toISOString(),
        },
        null,
        2,
      )}\n`,
    )
  }

  await writeSummary()

  const recordSuccess = (evaluation: DerivedPromptEvaluation) => {
    writeQueue = writeQueue.then(async () => {
      await appendJsonlRow(outputPath, evaluation)
      processedCandidates += 1
      if (!evaluation.deterministicCheck.pass) blockedDeterministically += 1
      if (evaluation.judge?.pass === true) judgePassed += 1
      if (evaluation.metaVerification?.pass === true) metaPassed += 1
      if (evaluation.recommended) recommended += 1
      judgeCostUsd += getJudgeCostUsd(asRecord(evaluation.judge?.outcome).judgeSdk)
      metaVerifierCostUsd += getJudgeCostUsd(asRecord(evaluation.metaVerification?.outcome).metaVerificationSdk)
      const family =
        typeof evaluation.sourcePrompt.metadata?.patternFamily === 'string'
          ? evaluation.sourcePrompt.metadata.patternFamily
          : 'unknown'
      familyCounts.set(family, (familyCounts.get(family) ?? 0) + 1)
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
    while (nextIndex < pendingCandidates.length) {
      const currentIndex = nextIndex
      nextIndex += 1
      const candidate = pendingCandidates[currentIndex]!
      try {
        const evaluation = await processCandidate({
          candidate,
          sourceCatalog,
          seenIds,
          index: currentIndex,
          total: pendingCandidates.length,
          progress,
        })
        await recordSuccess(evaluation)
      } catch (error: unknown) {
        logProgress({
          enabled: progress,
          message: `candidate ${currentIndex + 1}/${pendingCandidates.length}: ${candidate.id} failed ${
            error instanceof Error ? error.message : String(error)
          }`,
        })
        await recordFailure(candidate.id, error)
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, pendingCandidates.length) }, () => runWorker())
  await Promise.all(workers)
  await writeQueue

  console.log(
    JSON.stringify(
      {
        candidatesPath,
        sourcePath,
        outputPath,
        errorsPath,
        summaryPath,
        totalCandidates: candidates.length,
        pendingCandidates: pendingCandidates.length,
        processedCandidates,
        failedCandidates,
        blockedDeterministically,
        judgePassed,
        metaPassed,
        recommended,
        sourceFamilies: Object.fromEntries(
          Array.from(familyCounts.entries()).sort((left, right) => right[1] - left[1]),
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
