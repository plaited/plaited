import * as z from 'zod'
import type { Grader, GraderResult } from '../src/improve.ts'
import { GraderResultSchema } from '../src/improve.ts'
import { resolvePrimaryJudgeModel, runStructuredLlmQuery } from './structured-llm-query.ts'

type SourcePromptLike = {
  id?: string
  input?: string | string[]
  hint?: string
  metadata?: Record<string, unknown>
}

export const ModnetDerivedPromptJudgeDimensionsSchema = z.object({
  fidelity: z.number().min(0).max(1),
  scaleFit: z.number().min(0).max(1),
  usefulness: z.number().min(0).max(1),
  specificity: z.number().min(0).max(1),
})

export const ModnetDerivedPromptJudgeOutcomeSchema = z.object({
  judgeKind: z.literal('modnet-derived-prompt'),
  dimensions: ModnetDerivedPromptJudgeDimensionsSchema.optional(),
  judgeSdk: z.record(z.string(), z.unknown()).optional(),
})

type JudgeOutput = {
  pass: boolean
  score: number
  reasoning: string
  dimensions?: z.infer<typeof ModnetDerivedPromptJudgeDimensionsSchema>
}

const JudgeOutputSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['pass', 'score', 'reasoning'],
  properties: {
    pass: { type: 'boolean' },
    score: { type: 'number', minimum: 0, maximum: 1 },
    reasoning: { type: 'string' },
    dimensions: {
      type: 'object',
      additionalProperties: false,
      required: ['fidelity', 'scaleFit', 'usefulness', 'specificity'],
      properties: {
        fidelity: { type: 'number', minimum: 0, maximum: 1 },
        scaleFit: { type: 'number', minimum: 0, maximum: 1 },
        usefulness: { type: 'number', minimum: 0, maximum: 1 },
        specificity: { type: 'number', minimum: 0, maximum: 1 },
      },
    },
  },
} as const

type SeedContext = {
  sourceId: string
  rewrittenTitle: string
  rewrittenInput: string
  rewrittenHint: string
  sourceTitle: string
  sourceDescription: string
  sourceStructure: string
  sourceFamily: string
  sourceScaleLabel: string
  sourceSeedAnchors: string
  sourceGroundingAnchors: string
  sourceMechanics: string
  operationalLoop: string
  reusableActions: string
  targetShapeTransferSignals: string
  targetShapeTransferMechanics: string
  targetShapeTransferStructureSignals: string
  targetShapeTransferDynamicSignals: string
  targetShapeTransferManifest: string
  targetShapeTransferTerms: string
  handcraftedAnchorIds: string
  handcraftedAnchorTerms: string
  handcraftedAnchorMechanics: string
  approvedParentAnchor: string
  approvedParentFamily: string
  approvedParentScale: string
  approvedParentMechanism: string
  approvedParentSubject: string
  sourceShape: string
  sourceCoreUserJob: string
  sourceWhyRelevant: string
  chainExpectedParentScale: string
  chainImmediateParentScale: string
  chainExpectedParentMechanism: string
  chainImmediateParentMechanism: string
  chainExpectedParentSubject: string
  chainImmediateParentSubject: string
  chainExpectedParentCapability: string
  chainImmediateParentCapability: string
  chainExpectedParentPromptId: string
  chainImmediateParentPromptId: string
  chainImmediateParentReusableActions: string
  chainImmediateParentOperationalLoop: string
  chainImmediateParentShape: string
  chainImmediateParentRole: string
  chainImmediateParentRoleAffordances: string
  chainPath: string
  contributesToParentCapability: string
}

type SeedChainContext = {
  chainExpectedParentPromptId: string
  chainImmediateParentPromptId: string
  chainExpectedParentScale: string
  chainImmediateParentScale: string
  chainExpectedParentMechanism: string
  chainImmediateParentMechanism: string
  chainExpectedParentSubject: string
  chainImmediateParentSubject: string
  chainExpectedParentCapability: string
  chainImmediateParentCapability: string
  chainImmediateParentReusableActions: string
  chainImmediateParentOperationalLoop: string
  chainImmediateParentShape: string
  chainImmediateParentRole: string
  chainImmediateParentRoleAffordances: string
  chainPath: string
}

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {}

const asString = (value: unknown): string => (typeof value === 'string' ? value : '')

const asBoolean = (value: unknown): boolean | null => {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    if (value === 'true') return true
    if (value === 'false') return false
  }
  return null
}

const parseScaleFromValue = (value: unknown): string => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const scale = Math.max(1, Math.min(8, Math.round(value)))
    return `S${scale}`
  }

  const text = asString(value).trim()
  if (text.length === 0) return 'missing'
  const match = /(?:^|[^\w])(?:scale-|S)?\s*([1-8])(?:[^\w]|$)/i.exec(text)
  if (!match) return text
  return `S${match[1]!}`
}

const parseScalePathText = (value: unknown): string => {
  if (!Array.isArray(value)) {
    return ''
  }

  return value
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter((entry) => entry.length > 0)
    .join(' → ')
}

const parseSourceShapeFromCandidate = (metadata?: Record<string, unknown>): string => {
  const candidatePrompt = asRecord(metadata?.candidatePrompt)
  const candidateId = asString(candidatePrompt.id)
  const markerIndex = candidateId.indexOf('-derived-')
  if (markerIndex === -1) return ''

  const tail = candidateId.slice(markerIndex + '-derived-'.length).trim()
  const separatorIndex = tail.indexOf('-')
  if (separatorIndex === -1) return ''
  return tail.slice(separatorIndex + 1)
}

const parseCandidateChainFromMetadata = (metadata?: Record<string, unknown>): SeedChainContext => {
  const candidatePrompt = asRecord(metadata?.candidatePrompt)
  const chainContext = asRecord(candidatePrompt.chain)
  const sourceContext = asRecord(metadata?.sourceContext)
  const expectedParentPromptId =
    asString(chainContext.expectedParentPromptId) ||
    asString(sourceContext.expectedParentPromptId) ||
    asString(candidatePrompt.expectedParentPromptId) ||
    ''
  const immediateParentPromptId =
    asString(chainContext.immediateParentPromptId) ||
    asString(sourceContext.immediateParentPromptId) ||
    expectedParentPromptId
  const chainPath =
    parseScalePathText(chainContext.chainPath) ||
    parseScalePathText(sourceContext.chainPath) ||
    parseScalePathText(sourceContext.chain)
  const expectedParentScale =
    asString(chainContext.parentScaleLabel) || asString(sourceContext.expectedParentScale) || ''
  const immediateParentScale =
    asString(chainContext.parentScaleLabel) || asString(sourceContext.immediateParentScale) || expectedParentScale
  const expectedParentMechanism =
    asString(chainContext.parentMechanism) ||
    asString(sourceContext.parentMechanism) ||
    asString(sourceContext.approvedParentMechanism)
  const immediateParentMechanism = asString(chainContext.parentMechanism) || expectedParentMechanism
  const expectedParentSubject =
    asString(chainContext.parentSubject) ||
    asString(sourceContext.parentSubject) ||
    asString(sourceContext.approvedParentSubject)
  const immediateParentSubject = asString(chainContext.parentSubject) || expectedParentSubject
  const immediateParentReusableActions =
    asString(chainContext.immediateParentReusableActions) || asString(sourceContext.immediateParentReusableActions)
  const immediateParentOperationalLoop =
    asString(chainContext.immediateParentOperationalLoop) || asString(sourceContext.immediateParentOperationalLoop)
  const immediateParentShape =
    asString(chainContext.immediateParentShape) || asString(sourceContext.immediateParentShape)
  const immediateParentRole =
    asString(chainContext.immediateParentRole) ||
    asString(chainContext.chainImmediateParentRole) ||
    asString(sourceContext.immediateParentRole) ||
    asString(sourceContext.chainImmediateParentRole)
  const immediateParentRoleAffordances =
    asString(chainContext.immediateParentRoleAffordances) ||
    asString(chainContext.chainImmediateParentRoleAffordances) ||
    asString(sourceContext.immediateParentRoleAffordances) ||
    asString(sourceContext.chainImmediateParentRoleAffordances)
  const chainExpectedParentCapability =
    asString(chainContext.chainImmediateParentCapability) || asString(sourceContext.chainExpectedParentCapability)
  const chainImmediateParentCapability =
    asString(chainContext.chainImmediateParentCapability) || asString(sourceContext.chainImmediateParentCapability)

  return {
    chainExpectedParentPromptId: expectedParentPromptId,
    chainImmediateParentPromptId: immediateParentPromptId,
    chainExpectedParentScale: expectedParentScale,
    chainImmediateParentScale: immediateParentScale,
    chainExpectedParentMechanism: expectedParentMechanism,
    chainImmediateParentMechanism: immediateParentMechanism,
    chainExpectedParentSubject: expectedParentSubject,
    chainImmediateParentSubject: immediateParentSubject,
    chainExpectedParentCapability,
    chainImmediateParentCapability,
    chainImmediateParentReusableActions: immediateParentReusableActions,
    chainImmediateParentOperationalLoop: immediateParentOperationalLoop,
    chainImmediateParentShape: immediateParentShape,
    chainImmediateParentRole: immediateParentRole,
    chainImmediateParentRoleAffordances: immediateParentRoleAffordances,
    chainPath,
  }
}

const getSeedContextFromMetadata = (metadata?: Record<string, unknown>): SeedContext => {
  const sourcePrompt = asRecord(metadata?.sourcePrompt) as SourcePromptLike
  const sourceMetadata = asRecord(sourcePrompt.metadata)
  const sourceRecord = asRecord(sourceMetadata._source)
  const seedReviewContext = asRecord((sourceMetadata as { seedReviewContext?: unknown }).seedReviewContext)
  const candidatePrompt = asRecord(metadata?.candidatePrompt)
  const sourceContext = asRecord(candidatePrompt.seedContext ?? metadata?.sourceContext)

  const rewrittenTitle =
    asString(sourceContext.rewrittenTitle) ||
    asString(seedReviewContext.generatedModernTitle) ||
    asString(sourceMetadata.generatedModernTitle) ||
    asString(sourceRecord.title) ||
    asString(sourcePrompt.id) ||
    'missing'

  const rewrittenInput =
    asString(sourceContext.rewrittenInput) ||
    asString(seedReviewContext.generatedPromptInput) ||
    asString(sourceMetadata.generatedPromptInput) ||
    (typeof sourcePrompt.input === 'string'
      ? sourcePrompt.input
      : Array.isArray(sourcePrompt.input)
        ? sourcePrompt.input.join(' ')
        : '') ||
    'missing'

  const rewrittenHint =
    asString(sourceContext.rewrittenHint) ||
    asString(seedReviewContext.generatedPromptHint) ||
    asString(sourceMetadata.generatedPromptHint) ||
    asString(sourceRecord.generatedPromptHint) ||
    asString(sourcePrompt.hint) ||
    'missing'
  const chainContext = parseCandidateChainFromMetadata({
    candidatePrompt,
    sourceContext,
  })
  const approvedParentAnchor = asString(sourceContext.approvedParentAnchor)
  const approvedParentFamily = asString(sourceContext.approvedParentFamily)
  const approvedParentScale = asString(sourceContext.approvedParentScale)
  const approvedParentMechanism = asString(sourceContext.approvedParentMechanism)
  const approvedParentSubject = asString(sourceContext.approvedParentSubject)
  const contributesToParentCapability = asString(sourceContext.contributesToParentCapability)

  return {
    sourceId: asString(candidatePrompt.sourceId) || asString(sourcePrompt.id),
    sourceTitle:
      asString(sourceContext.sourceTitle) ||
      asString(seedReviewContext.sourceTitle) ||
      asString(sourceRecord.title) ||
      'missing',
    sourceDescription:
      asString(sourceContext.sourceDescription) ||
      asString(seedReviewContext.sourceDescription) ||
      asString(sourceRecord.description) ||
      'missing',
    sourceStructure:
      asString(sourceContext.sourceStructure) ||
      asString(seedReviewContext.generatedLikelyStructure) ||
      asString(seedReviewContext.sourceStructure) ||
      asString(asRecord(sourceRecord.mss).structure) ||
      'module',
    sourceFamily:
      asString(sourceContext.sourceFamily) ||
      asString(sourceMetadata.patternFamily) ||
      asString(seedReviewContext.generatedLikelyPatternFamily) ||
      'unknown',
    sourceScaleLabel:
      parseScaleFromValue(sourceContext.sourceScaleLabel) !== 'missing'
        ? parseScaleFromValue(sourceContext.sourceScaleLabel)
        : parseScaleFromValue(
            asRecord(asRecord(sourceMetadata).judge).scale ??
              asString(sourceMetadata.sourceScale) ??
              asString(seedReviewContext.sourceScale),
          ),
    sourceShape: asString(sourceContext.sourceShape) || parseSourceShapeFromCandidate(metadata),
    sourceSeedAnchors:
      asString(sourceContext.sourceAnchors) ||
      [
        rewrittenTitle,
        rewrittenInput,
        rewrittenHint,
        asString(seedReviewContext.sourceTitle),
        asString(seedReviewContext.sourceDescription),
      ]
        .filter(Boolean)
        .join(' '),
    sourceGroundingAnchors:
      asString(sourceContext.sourceGroundingAnchors) ||
      [asString(sourceContext.sourceTitle), asString(sourceContext.sourceDescription)].filter(Boolean).join(' '),
    sourceMechanics:
      asString(sourceContext.sourceMechanics) ||
      asString(seedReviewContext.sourceMechanics) ||
      [asString(sourceContext.rewrittenTitle), asString(sourceContext.rewrittenHint)]
        .filter(Boolean)
        .join(' ')
        .split(' ')
        .slice(0, 12)
        .filter((word) => word.length >= 4)
        .join(', '),
    operationalLoop:
      asString(sourceContext.operationalLoop) ||
      asString(seedReviewContext.operationalLoop) ||
      asString(asRecord(seedReviewContext).loop) ||
      'none',
    reusableActions:
      asString(sourceContext.reusableActions) ||
      asString(seedReviewContext.reusableActions) ||
      asString(sourceContext.sourceCoreUserJob) ||
      'none',
    targetShapeTransferSignals: asString(sourceContext.targetShapeTransferSignals),
    targetShapeTransferMechanics: asString(sourceContext.targetShapeTransferMechanics),
    targetShapeTransferStructureSignals: asString(sourceContext.targetShapeTransferStructureSignals),
    targetShapeTransferDynamicSignals: asString(sourceContext.targetShapeTransferDynamicSignals),
    targetShapeTransferManifest: asString(sourceContext.targetShapeTransferManifest),
    targetShapeTransferTerms: asString(sourceContext.targetShapeTransferTerms),
    handcraftedAnchorIds: asString(sourceContext.handcraftedAnchorIds),
    handcraftedAnchorTerms: asString(sourceContext.handcraftedAnchorTerms),
    handcraftedAnchorMechanics: asString(sourceContext.handcraftedAnchorMechanics),
    sourceCoreUserJob:
      asString(sourceContext.sourceCoreUserJob) ||
      asString(seedReviewContext.coreUserJob) ||
      asString(sourceRecord.coreUserJob) ||
      'missing',
    sourceWhyRelevant:
      asString(sourceContext.sourceWhyRelevant) ||
      asString(seedReviewContext.whyRelevant) ||
      asString(sourceRecord.whyRelevant) ||
      'missing',
    chainExpectedParentScale: chainContext.chainExpectedParentScale,
    chainImmediateParentScale: chainContext.chainImmediateParentScale,
    chainExpectedParentMechanism: chainContext.chainExpectedParentMechanism,
    chainImmediateParentMechanism: chainContext.chainImmediateParentMechanism,
    chainExpectedParentCapability: chainContext.chainExpectedParentCapability,
    chainImmediateParentCapability: chainContext.chainImmediateParentCapability,
    chainExpectedParentSubject: chainContext.chainExpectedParentSubject,
    chainImmediateParentSubject: chainContext.chainImmediateParentSubject,
    chainImmediateParentReusableActions: chainContext.chainImmediateParentReusableActions,
    chainImmediateParentOperationalLoop: chainContext.chainImmediateParentOperationalLoop,
    chainImmediateParentShape: chainContext.chainImmediateParentShape,
    chainExpectedParentPromptId: chainContext.chainExpectedParentPromptId,
    chainImmediateParentPromptId: chainContext.chainImmediateParentPromptId,
    chainImmediateParentRole: chainContext.chainImmediateParentRole,
    chainImmediateParentRoleAffordances: chainContext.chainImmediateParentRoleAffordances,
    chainPath: chainContext.chainPath,
    contributesToParentCapability,
    approvedParentAnchor,
    approvedParentFamily,
    approvedParentScale,
    approvedParentMechanism,
    approvedParentSubject,
    rewrittenTitle,
    rewrittenInput,
    rewrittenHint,
  }
}

const summarizeDeterministicConcerns = (metadata?: Record<string, unknown>) => {
  const deterministicCheck = asRecord(metadata?.deterministicCheck)
  const hardFailures = Array.isArray(deterministicCheck.hardFailures)
    ? (deterministicCheck.hardFailures as unknown[]).filter((value): value is string => typeof value === 'string')
    : []
  const checks = asRecord(deterministicCheck.checks)
  const riskSignals: string[] = []

  if (asBoolean(checks.familyContinuity) === false) {
    riskSignals.push('family-continuity-risk')
  }
  if (asBoolean(checks.sourceScaleFits) === false) {
    riskSignals.push('scale-fit-risk')
  }
  if (asBoolean(checks.avoidsGenericTemplateLanguage) === false) {
    riskSignals.push('generic-template-language')
  }
  if (asBoolean(checks.parentCapabilityContinuity) === false) {
    riskSignals.push('missing-parent-capability')
  }
  if (asBoolean(checks.hasConcretePrecursorContribution) === false) {
    riskSignals.push('family-agnostic-filler-precursor')
  }
  if (asBoolean(checks.hasRewrittenSeedAnchor) === false) {
    riskSignals.push('missing-rewritten-seed-anchor')
  }
  if (asBoolean(checks.hasSourceLexicalAnchor) === false) {
    riskSignals.push('weak-source-anchor')
  }
  if (asBoolean(checks.hasSourceEvidenceAnchor) === false) {
    riskSignals.push('missing-source-evidence-anchor')
  }
  if (asBoolean(checks.hasDualSourceAnchorEvidence) === false) {
    riskSignals.push('missing-dual-source-anchor-evidence')
  }
  if (asBoolean(checks.familySpecificity) === false) {
    riskSignals.push('family-generic-filler-risk')
  }
  if (asBoolean(checks.chainContinuity) === false) {
    riskSignals.push('chain-continuity-risk')
  }
  if (asBoolean(checks.chainParentMatch) === false) {
    riskSignals.push('chain-parent-mismatch')
  }
  if (asBoolean(checks.sourceMechanicsContinuity) === false) {
    riskSignals.push('mechanics-continuity-risk')
  }
  if (asBoolean(checks.reusableActionsSignal) === false) {
    riskSignals.push('reusable-actions-risk')
  }
  if (asBoolean(checks.reusableActionLoopContinuity) === false) {
    riskSignals.push('reusable-action-loop-risk')
  }
  if (asBoolean(checks.approvedParentMechanicContinuity) === false) {
    riskSignals.push('approved-parent-mechanic-risk')
  }
  if (asBoolean(checks.immediateParentRoleContinuity) === false) {
    riskSignals.push('role-continuity-risk')
  }
  if (asBoolean(checks.operationalLoopContinuity) === false) {
    riskSignals.push('operational-loop-continuity-risk')
  }
  if (
    asBoolean(checks.targetShapeTransferContinuityDataPresent) === true &&
    asBoolean(checks.targetShapeTransferContinuity) === false
  ) {
    riskSignals.push('missing-target-shape-transfer')
  }
  if (asBoolean(checks.handcraftedStyleCopySafe) === false) {
    riskSignals.push('style-copying-risk')
  }

  return {
    hardFailures,
    riskSignals,
  }
}

export const buildJudgePrompt = ({
  task,
  output,
  metadata,
}: {
  task: string
  output: string
  metadata?: Record<string, unknown>
}) => {
  const sourcePrompt = (metadata?.sourcePrompt ?? {}) as SourcePromptLike
  const sourceInput = sourcePrompt.input ?? ''
  const sourceHint = sourcePrompt.hint ?? ''
  const sourceMetadata = asRecord(sourcePrompt.metadata)
  const sourceJudge = asRecord(sourceMetadata.judge)
  const sourceJudgeRequiredConcepts = Array.isArray(sourceJudge.requiredConcepts)
    ? (sourceJudge.requiredConcepts as unknown[]).filter((value): value is string => typeof value === 'string')
    : []
  const sourceScaleConcept = sourceJudgeRequiredConcepts.find((value) => /^scale-S\d$/i.test(value)) ?? 'scale-unknown'
  const candidatePrompt = JSON.stringify(metadata?.candidatePrompt ?? output, null, 2)
  const deterministicCheck = JSON.stringify(metadata?.deterministicCheck ?? {}, null, 2)
  const sourcePromptText = JSON.stringify(metadata?.sourcePrompt ?? {}, null, 2)
  const sourceContext = asRecord(metadata?.sourceContext)
  const sourceContextText = JSON.stringify(sourceContext, null, 2)
  const seedReviewContext = getSeedContextFromMetadata(metadata)
  const seedContextText = JSON.stringify(seedReviewContext, null, 2)
  const deterministicConcerns = summarizeDeterministicConcerns(metadata)
  const chainText = JSON.stringify(
    {
      targetShapeTransferSignals: seedReviewContext.targetShapeTransferSignals || 'none',
      targetShapeTransferMechanics: seedReviewContext.targetShapeTransferMechanics || 'none',
      targetShapeTransferStructureSignals: seedReviewContext.targetShapeTransferStructureSignals || 'none',
      targetShapeTransferDynamicSignals: seedReviewContext.targetShapeTransferDynamicSignals || 'none',
      targetShapeTransferTerms: seedReviewContext.targetShapeTransferTerms || 'none',
      targetShapeTransferManifest: seedReviewContext.targetShapeTransferManifest || 'none',
      expectedParentScale: seedReviewContext.chainExpectedParentScale,
      immediateParentScale: seedReviewContext.chainImmediateParentScale,
      expectedParentMechanism: seedReviewContext.chainExpectedParentMechanism,
      immediateParentMechanism: seedReviewContext.chainImmediateParentMechanism,
      immediateParentReusableActions: seedReviewContext.chainImmediateParentReusableActions,
      immediateParentOperationalLoop: seedReviewContext.chainImmediateParentOperationalLoop,
      immediateParentShape: seedReviewContext.chainImmediateParentShape,
      immediateParentRole: seedReviewContext.chainImmediateParentRole,
      immediateParentRoleAffordances: seedReviewContext.chainImmediateParentRoleAffordances,
      immediateParentCapability: seedReviewContext.chainImmediateParentCapability,
      expectedParentCapability: seedReviewContext.chainExpectedParentCapability,
      expectedParentSubject: seedReviewContext.chainExpectedParentSubject,
      immediateParentSubject: seedReviewContext.chainImmediateParentSubject,
      expectedParentPromptId: seedReviewContext.chainExpectedParentPromptId,
      immediateParentPromptId: seedReviewContext.chainImmediateParentPromptId,
      chainPath: seedReviewContext.chainPath,
    },
    null,
    2,
  )
  const sourceAnchorCandidates = `${sourceInput} ${sourceHint}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((value): boolean => value.length >= 4)
  const sourceAnchors = [...new Set(sourceAnchorCandidates)].sort().slice(0, 40).join(', ')
  const rawSourceFamily =
    typeof sourceMetadata.patternFamily === 'string' ? sourceMetadata.patternFamily : seedReviewContext.sourceFamily

  return `You are reviewing a candidate low-scale modnet prompt derived from a higher-scale source prompt.

The goal is to keep only prompts worth refining into the canonical modnet training catalog.

Task:
${task}

Source continuity context:
- source family: ${rawSourceFamily}
- source scale signals: ${sourceJudgeRequiredConcepts.length > 0 ? sourceJudgeRequiredConcepts.join(', ') : sourceScaleConcept}
- approved parent context:
  - anchor: ${seedReviewContext.approvedParentAnchor || 'missing'}
  - family/scale: ${seedReviewContext.approvedParentFamily || 'unknown'}/${seedReviewContext.approvedParentScale || 'missing'}
  - mechanism: ${seedReviewContext.approvedParentMechanism || 'missing'}
  - subject style: ${seedReviewContext.approvedParentSubject || 'missing'}
- parent contribution: ${seedReviewContext.contributesToParentCapability || 'missing'}
- rewritten seed anchors (primary):
  - title: ${seedReviewContext.rewrittenTitle}
  - input: ${seedReviewContext.rewrittenInput}
  - hint: ${seedReviewContext.rewrittenHint}
- source continuity anchors (anti-drift):
  - source id: ${seedReviewContext.sourceId}
  - source title: ${seedReviewContext.sourceTitle}
  - source description: ${seedReviewContext.sourceDescription}
  - source structure: ${seedReviewContext.sourceStructure}
  - source scale label: ${seedReviewContext.sourceScaleLabel}
  - source precursor shape: ${seedReviewContext.sourceShape || 'unknown'}
  - source core user job: ${seedReviewContext.sourceCoreUserJob}
  - source why relevant: ${seedReviewContext.sourceWhyRelevant}
  - source-anchor signals:
  - rewritten-seed anchors: ${seedReviewContext.sourceSeedAnchors || 'none'}
  - source-grounding anchors: ${seedReviewContext.sourceGroundingAnchors || 'none'}
  - source mechanics: ${seedReviewContext.sourceMechanics || 'not-provided'}
  - source operational loop: ${seedReviewContext.operationalLoop || 'not-provided'}
  - source reusable actions: ${seedReviewContext.reusableActions || 'not-provided'}
  - handcrafted anchor ids: ${seedReviewContext.handcraftedAnchorIds || 'none'}
  - handcrafted anchor terms: ${seedReviewContext.handcraftedAnchorTerms || 'none'}
  - handcrafted anchor mechanics: ${seedReviewContext.handcraftedAnchorMechanics || 'none'}
  - target-shape transfer signals: ${seedReviewContext.targetShapeTransferSignals || 'none'}
  - target-shape transfer mechanics: ${seedReviewContext.targetShapeTransferMechanics || 'none'}
  - target structure signals: ${seedReviewContext.targetShapeTransferStructureSignals || 'none'}
  - target dynamic signals: ${seedReviewContext.targetShapeTransferDynamicSignals || 'none'}
  - target-shape transfer vocabulary: ${seedReviewContext.targetShapeTransferTerms || 'none'}
  - target-shape transfer capsule: ${seedReviewContext.targetShapeTransferManifest || 'none'}
- source context summary:
${sourceContextText}
- chain context:
${chainText}
- top source anchors: ${sourceAnchors || 'none'}
- approved lane anchors:
  - Archimedes/pi explorer → creative-tool / S1
  - Klingon Dictionary → reference-browser / S2
  - 1st Law of Thermodynamics → educational-interactive / S3

Source prompt:
${sourcePromptText}

Seed context payload:
${seedContextText}

Candidate derived prompt:
${candidatePrompt}

Deterministic precheck:
${deterministicCheck}

Judge this candidate on:
- fidelity: family continuity (preserve source family, nouns, and workflow intent; avoid drift into generic utilities)
- scaleFit: scale continuity (strict precursor for S1/S3, not the full parent)
- usefulness: building-block usefulness (directly composable into the approved parent seed)
  - specificity: recurring source mechanics and reusable action primitives (not cosmetic family terms)
- immediate-parent continuity: immediate mechanics/actions/loop and precursor shape must be reused as real building blocks
  - precursor plausibility: one-stage precursor intent (real S1/S2/S3 precursor, not full abstraction)
  - approved-parent mechanism fit: candidate mechanics should align to approved parent mechanism for the lane.
  - role continuity: preferred candidate operations should explicitly mirror the immediate parent role affordances (not just family labels).
  - chain continuity:
  - expected parent scale: ${seedReviewContext.chainExpectedParentScale || 'missing'}
  - immediate parent scale: ${seedReviewContext.chainImmediateParentScale || 'missing'}
  - immediate parent reusable actions: ${seedReviewContext.chainImmediateParentReusableActions || 'missing'}
  - immediate parent capability: ${seedReviewContext.chainImmediateParentCapability || 'missing'}
  - immediate parent operational loop: ${seedReviewContext.chainImmediateParentOperationalLoop || 'missing'}
  - immediate parent shape: ${seedReviewContext.chainImmediateParentShape || 'missing'}
  - immediate parent role/affordances: ${seedReviewContext.chainImmediateParentRole || 'missing'} / ${seedReviewContext.chainImmediateParentRoleAffordances || 'missing'}
  - expected parent capability: ${seedReviewContext.chainExpectedParentCapability || 'missing'}
  - expected parent id: ${seedReviewContext.chainExpectedParentPromptId || 'missing'}
  - immediate parent id: ${seedReviewContext.chainImmediateParentPromptId || 'missing'}
  - path: ${seedReviewContext.chainPath || 'missing'}

Scoring guidance:
- S1 should be one atomic module with clear action and minimal surface area.
- S2 should expose list/group mechanics over atomic modules.
- S3 should expose one bounded composition surface.
- Prefer explicit reuse mechanics over decorative intent.
- Penalize over-abstracted, feature-suite, or duplicated full-parent scope candidates.
- Reject candidates that fail source anchor continuity even if generic text is fluent.
- Reject candidates that keep rewritten-seed anchors or source-grounding anchors while dropping the other.
- Reject family-agnostic filler that uses only family labels without reusable mechanisms.
- Reject candidates that lack an explicit parent-contribution path and only shrink scope (no reusable precursor role).

Pass only if this candidate materially preserves family continuity, scale continuity, and real lower-scale composition value.
Be conservative about generic prompts and overbroad abstractions.

Continuity guardrails:
- deterministic hard failures: ${deterministicConcerns.hardFailures.join(', ') || 'none'}
  - deterministic risk signals: ${deterministicConcerns.riskSignals.join(', ') || 'none'}
  - action-loop continuity: checks.reusableActionLoopContinuity and approvedParentMechanicContinuity should both be true for strongest mechanical fidelity
  - if risks exist, require explicit evidence in text, not implied intent.
`
}

const buildOutcome = ({
  dimensions,
  sdkMeta,
}: {
  dimensions?: JudgeOutput['dimensions']
  sdkMeta?: Record<string, unknown>
}) =>
  ModnetDerivedPromptJudgeOutcomeSchema.parse({
    judgeKind: 'modnet-derived-prompt',
    ...(dimensions ? { dimensions } : {}),
    ...(sdkMeta ? { judgeSdk: sdkMeta } : {}),
  })

const clampUnit = (value: number): number => Math.max(0, Math.min(1, value))

const clampDimensions = (dimensions?: JudgeOutput['dimensions']): JudgeOutput['dimensions'] | undefined =>
  dimensions
    ? {
        fidelity: clampUnit(dimensions.fidelity),
        scaleFit: clampUnit(dimensions.scaleFit),
        usefulness: clampUnit(dimensions.usefulness),
        specificity: clampUnit(dimensions.specificity),
      }
    : undefined

export const toGraderResult = (result: JudgeOutput & { outcome?: Record<string, unknown> }): GraderResult =>
  GraderResultSchema.parse({
    pass: result.pass,
    score: result.score,
    reasoning: result.reasoning,
    ...(result.outcome || result.dimensions
      ? {
          outcome: {
            ...(result.outcome ?? {}),
            ...buildOutcome({
              dimensions: result.dimensions,
            }),
          },
        }
      : {}),
  })

const invokeJudge = async (prompt: string): Promise<JudgeOutput & { outcome?: Record<string, unknown> }> => {
  const result = await runStructuredLlmQuery<JudgeOutput>({
    model: resolvePrimaryJudgeModel(),
    prompt,
    schema: JudgeOutputSchema,
  })

  if (!result.ok) {
    return {
      pass: false,
      score: 0,
      reasoning: `Primary judge SDK error: ${result.reason}`,
      outcome: buildOutcome({
        sdkMeta: result.meta,
      }),
    }
  }

  return {
    pass: result.value.pass,
    score: Math.max(0, Math.min(1, result.value.score)),
    reasoning: result.value.reasoning,
    dimensions: clampDimensions(result.value.dimensions),
    ...(result.value.dimensions || result.meta
      ? {
          outcome: buildOutcome({
            dimensions: clampDimensions(result.value.dimensions),
            sdkMeta: result.meta,
          }),
        }
      : {}),
  }
}

export const grade: Grader = async ({ input, output, metadata }) => {
  const task = Array.isArray(input) ? input.join('\n') : input
  const meta = (metadata ?? {}) as Record<string, unknown>
  const result = await invokeJudge(buildJudgePrompt({ task, output, metadata: meta }))
  return toGraderResult(result)
}
