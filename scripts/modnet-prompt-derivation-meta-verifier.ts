import * as z from 'zod'
import type { Grader, GraderResult } from '../src/improve.ts'
import { GraderResultSchema } from '../src/improve.ts'
import { runStructuredMetaVerifierQuery } from './meta-verifier-runtime.ts'

export const ModnetDerivedPromptMetaDimensionsSchema = z.object({
  consistency: z.number().min(0).max(1),
  risk: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
})

export const ModnetDerivedPromptMetaOutcomeSchema = z.object({
  verifierKind: z.literal('modnet-derived-prompt-meta-verifier'),
  dimensions: ModnetDerivedPromptMetaDimensionsSchema.optional(),
  metaVerificationSdk: z.record(z.string(), z.unknown()).optional(),
})

type MetaJudgeOutput = {
  pass: boolean
  score: number
  reasoning: string
  dimensions?: z.infer<typeof ModnetDerivedPromptMetaDimensionsSchema>
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

type SourceContext = {
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
  contributesToParentCapability: string
  chainPath: string
}

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {}

const asString = (value: unknown): string => (typeof value === 'string' ? value : '')

const asBoolean = (value: unknown): boolean | null => {
  if (typeof value === 'boolean') {
    return value
  }
  if (typeof value === 'string') {
    if (value === 'true') {
      return true
    }
    if (value === 'false') {
      return false
    }
  }
  return null
}

const parseJudgeResultText = (output: string): Record<string, unknown> => {
  try {
    const parsed = JSON.parse(output)
    return asRecord(parsed)
  } catch {
    return {}
  }
}

const summarizeDeterministicFlags = (metadata?: Record<string, unknown>) => {
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
  if (asBoolean(checks.candidateShapeKnown) === false) {
    riskSignals.push('missing-shape-anchor')
  }
  if (asBoolean(checks.candidateShapeAnchor) === false) {
    riskSignals.push('shape-anchor-risk')
  }
  if (asBoolean(checks.shapeScaleAligned) === false) {
    riskSignals.push('shape-scale-risk')
  }
  if (asBoolean(checks.hasSourceEvidenceAnchor) === false) {
    riskSignals.push('missing-source-evidence-anchor')
  }
  if (asBoolean(checks.chainParentMatch) === false) {
    riskSignals.push('chain-parent-mismatch')
  }
  if (asBoolean(checks.chainContinuity) === false) {
    riskSignals.push('chain-continuity-risk')
  }
  if (asBoolean(checks.hasDualSourceAnchorEvidence) === false) {
    riskSignals.push('missing-dual-source-anchor-evidence')
  }
  if (asBoolean(checks.familySpecificity) === false) {
    riskSignals.push('family-generic-filler-risk')
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
  if (asBoolean(checks.parentCapabilityContinuity) === false) {
    riskSignals.push('missing-parent-capability-anchor')
  }
  if (asBoolean(checks.hasConcretePrecursorContribution) === false) {
    riskSignals.push('family-agnostic-filler-precursor')
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

  return { hardFailures, riskSignals }
}

const parseScaleFromValue = (value: unknown): string => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const scale = Math.max(1, Math.min(8, Math.round(value)))
    return `S${scale}`
  }

  const text = asString(value).trim()
  if (text.length === 0) return 'missing'
  const match = /(?:^|[^\w])(?:scale-|S)?\s*([1-8])(?:[^\w]|$)/i.exec(text)
  return match ? `S${match[1]!}` : text
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

  const tail = candidateId.slice(markerIndex + '-derived-'.length)
  const scaleSeparatorIndex = tail.indexOf('-')
  if (scaleSeparatorIndex === -1) return ''
  return tail.slice(scaleSeparatorIndex + 1).trim()
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
  const chainParentScale =
    asString(chainContext.parentScaleLabel) ||
    asString(sourceContext.expectedParentScale) ||
    asString(sourceContext.immediateParentScale)
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
  const chainExpectedParentCapability =
    asString(chainContext.chainImmediateParentCapability) || asString(sourceContext.chainExpectedParentCapability)
  const chainImmediateParentCapability =
    asString(chainContext.chainImmediateParentCapability) || asString(sourceContext.chainImmediateParentCapability)
  const chainImmediateParentRole =
    asString(chainContext.immediateParentRole) ||
    asString(chainContext.chainImmediateParentRole) ||
    asString(sourceContext.immediateParentRole) ||
    asString(sourceContext.chainImmediateParentRole)
  const chainImmediateParentRoleAffordances =
    asString(chainContext.immediateParentRoleAffordances) ||
    asString(chainContext.chainImmediateParentRoleAffordances) ||
    asString(sourceContext.immediateParentRoleAffordances) ||
    asString(sourceContext.chainImmediateParentRoleAffordances)

  return {
    chainExpectedParentPromptId: expectedParentPromptId,
    chainImmediateParentPromptId: immediateParentPromptId,
    chainExpectedParentScale: chainParentScale,
    chainImmediateParentScale: chainParentScale,
    chainExpectedParentMechanism: expectedParentMechanism,
    chainImmediateParentMechanism: immediateParentMechanism,
    chainExpectedParentSubject: expectedParentSubject,
    chainImmediateParentSubject: immediateParentSubject,
    chainExpectedParentCapability,
    chainImmediateParentCapability,
    chainImmediateParentReusableActions: immediateParentReusableActions,
    chainImmediateParentOperationalLoop: immediateParentOperationalLoop,
    chainImmediateParentShape: immediateParentShape,
    chainImmediateParentRole: chainImmediateParentRole,
    chainImmediateParentRoleAffordances: chainImmediateParentRoleAffordances,
    chainPath:
      parseScalePathText(chainContext.chainPath) ||
      parseScalePathText(sourceContext.chainPath) ||
      parseScalePathText(sourceContext.chain),
  }
}

const getSeedContext = (metadata?: Record<string, unknown>): SourceContext => {
  const sourcePrompt = asRecord(metadata?.sourcePrompt)
  const sourceMetadata = asRecord(sourcePrompt.metadata)
  const sourceRecord = asRecord(sourceMetadata._source)
  const seedReviewContext = asRecord((sourceMetadata as { seedReviewContext?: unknown }).seedReviewContext)
  const candidatePrompt = asRecord(metadata?.candidatePrompt)
  const sourceContext = asRecord(candidatePrompt.seedContext ?? metadata?.sourceContext)

  const rewrittenTitle =
    asString(sourceContext.rewrittenTitle) ||
    asString(seedReviewContext.generatedModernTitle) ||
    asString(sourceMetadata.generatedModernTitle) ||
    'missing'
  const rewrittenInput =
    asString(sourceContext.rewrittenInput) ||
    asString(seedReviewContext.generatedPromptInput) ||
    asString(sourceMetadata.generatedPromptInput) ||
    asString(sourcePrompt.input) ||
    'missing'
  const rewrittenHint =
    asString(sourceContext.rewrittenHint) ||
    asString(seedReviewContext.generatedPromptHint) ||
    asString(sourceMetadata.generatedPromptHint) ||
    asString(sourceRecord.generatedPromptHint) ||
    asString(sourcePrompt.hint) ||
    'missing'
  const sourceSeedAnchors =
    asString(sourceContext.sourceAnchors) || [rewrittenTitle, rewrittenInput, rewrittenHint].filter(Boolean).join(' ')
  const sourceGroundingAnchors =
    asString(sourceContext.sourceGroundingAnchors) ||
    [asString(sourceContext.sourceTitle), asString(sourceContext.sourceDescription)].filter(Boolean).join(' ')
  const sourceMechanics =
    asString(sourceContext.sourceMechanics) ||
    asString(seedReviewContext.sourceMechanics) ||
    [rewrittenTitle, rewrittenHint]
      .join(' ')
      .split(' ')
      .slice(0, 12)
      .filter((value) => value.length >= 4)
      .join(', ')
  const operationalLoop =
    asString(sourceContext.operationalLoop) ||
    asString(seedReviewContext.operationalLoop) ||
    asString(asRecord(seedReviewContext).loop) ||
    'none'
  const reusableActions =
    asString(sourceContext.reusableActions) || asString(seedReviewContext.reusableActions) || 'none'
  const handcraftedAnchorIds = asString(sourceContext.handcraftedAnchorIds)
  const handcraftedAnchorTerms = asString(sourceContext.handcraftedAnchorTerms)
  const handcraftedAnchorMechanics = asString(sourceContext.handcraftedAnchorMechanics)
  const approvedParentAnchor = asString(sourceContext.approvedParentAnchor)
  const approvedParentFamily = asString(sourceContext.approvedParentFamily)
  const approvedParentScale = asString(sourceContext.approvedParentScale)
  const approvedParentMechanism = asString(sourceContext.approvedParentMechanism)
  const approvedParentSubject = asString(sourceContext.approvedParentSubject)
  const chainContext = parseCandidateChainFromMetadata(metadata)
  const targetShapeTransferSignals = asString(sourceContext.targetShapeTransferSignals)
  const targetShapeTransferMechanics = asString(sourceContext.targetShapeTransferMechanics)
  const targetShapeTransferStructureSignals = asString(sourceContext.targetShapeTransferStructureSignals)
  const targetShapeTransferDynamicSignals = asString(sourceContext.targetShapeTransferDynamicSignals)
  const targetShapeTransferManifest = asString(sourceContext.targetShapeTransferManifest)
  const targetShapeTransferTerms = asString(sourceContext.targetShapeTransferTerms)
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
    sourceShape: asString(sourceContext.sourceShape) || parseSourceShapeFromCandidate(metadata),
    sourceScaleLabel:
      parseScaleFromValue(sourceContext.sourceScaleLabel) !== 'missing'
        ? parseScaleFromValue(sourceContext.sourceScaleLabel)
        : parseScaleFromValue(asRecord(asRecord(sourceMetadata).judge).scale ?? asString(sourceMetadata.sourceScale)),
    sourceSeedAnchors,
    sourceGroundingAnchors,
    sourceMechanics,
    operationalLoop,
    reusableActions,
    targetShapeTransferSignals,
    targetShapeTransferMechanics,
    targetShapeTransferStructureSignals,
    targetShapeTransferDynamicSignals,
    targetShapeTransferManifest,
    targetShapeTransferTerms,
    handcraftedAnchorIds,
    handcraftedAnchorTerms,
    handcraftedAnchorMechanics,
    approvedParentAnchor,
    approvedParentFamily,
    approvedParentScale,
    approvedParentMechanism,
    approvedParentSubject,
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
    chainImmediateParentReusableActions: chainContext.chainImmediateParentReusableActions,
    chainImmediateParentOperationalLoop: chainContext.chainImmediateParentOperationalLoop,
    chainImmediateParentShape: chainContext.chainImmediateParentShape,
    chainImmediateParentRole: chainContext.chainImmediateParentRole,
    chainImmediateParentRoleAffordances: chainContext.chainImmediateParentRoleAffordances,
    chainExpectedParentSubject: chainContext.chainExpectedParentSubject,
    chainImmediateParentSubject: chainContext.chainImmediateParentSubject,
    contributesToParentCapability,
    chainExpectedParentPromptId: chainContext.chainExpectedParentPromptId,
    chainImmediateParentPromptId: chainContext.chainImmediateParentPromptId,
    chainPath: chainContext.chainPath,
    rewrittenTitle,
    rewrittenInput,
    rewrittenHint,
  }
}

const MetaJudgeOutputSchema = {
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
      required: ['consistency', 'risk', 'confidence'],
      properties: {
        consistency: { type: 'number', minimum: 0, maximum: 1 },
        risk: { type: 'number', minimum: 0, maximum: 1 },
        confidence: { type: 'number', minimum: 0, maximum: 1 },
      },
    },
  },
} as const

export const buildMetaPrompt = ({
  task,
  output,
  metadata,
}: {
  task: string
  output: string
  metadata?: Record<string, unknown>
}) => {
  const sourcePrompt = (metadata?.sourcePrompt ?? {}) as {
    metadata?: {
      patternFamily?: unknown
      judge?: { requiredConcepts?: unknown }
    }
  }
  const sourcePromptText = JSON.stringify(sourcePrompt, null, 2)
  const candidatePrompt = JSON.stringify(metadata?.candidatePrompt ?? {}, null, 2)
  const deterministicCheck = JSON.stringify(metadata?.deterministicCheck ?? {}, null, 2)
  const seedContext = getSeedContext(metadata)
  const seedContextText = JSON.stringify(seedContext, null, 2)
  const sourceContextText = JSON.stringify(asRecord(metadata?.sourceContext), null, 2)
  const chainText = JSON.stringify(
    {
      targetShapeTransferSignals: seedContext.targetShapeTransferSignals || 'none',
      targetShapeTransferMechanics: seedContext.targetShapeTransferMechanics || 'none',
      targetShapeTransferStructureSignals: seedContext.targetShapeTransferStructureSignals || 'none',
      targetShapeTransferDynamicSignals: seedContext.targetShapeTransferDynamicSignals || 'none',
      targetShapeTransferTerms: seedContext.targetShapeTransferTerms || 'none',
      targetShapeTransferManifest: seedContext.targetShapeTransferManifest || 'none',
      expectedParentScale: seedContext.chainExpectedParentScale,
      immediateParentScale: seedContext.chainImmediateParentScale,
      expectedParentMechanism: seedContext.chainExpectedParentMechanism,
      immediateParentMechanism: seedContext.chainImmediateParentMechanism,
      expectedParentCapability: seedContext.chainExpectedParentCapability,
      immediateParentCapability: seedContext.chainImmediateParentCapability,
      immediateParentReusableActions: seedContext.chainImmediateParentReusableActions,
      immediateParentOperationalLoop: seedContext.chainImmediateParentOperationalLoop,
      immediateParentShape: seedContext.chainImmediateParentShape,
      immediateParentRole: seedContext.chainImmediateParentRole,
      immediateParentRoleAffordances: seedContext.chainImmediateParentRoleAffordances,
      expectedParentSubject: seedContext.chainExpectedParentSubject,
      immediateParentSubject: seedContext.chainImmediateParentSubject,
      parentContribution: seedContext.contributesToParentCapability,
      expectedParentPromptId: seedContext.chainExpectedParentPromptId,
      immediateParentPromptId: seedContext.chainImmediateParentPromptId,
      chainPath: seedContext.chainPath,
    },
    null,
    2,
  )
  const judgeResult = parseJudgeResultText(output)
  const deterministicFlags = summarizeDeterministicFlags(metadata)
  const judgePass = judgeResult.pass === true ? 'true' : judgeResult.pass === false ? 'false' : 'unknown'
  const judgeScore = typeof judgeResult.score === 'number' ? judgeResult.score : 'unknown'
  const judgeReasoning = asString(judgeResult.reasoning)
  const sourceFamily =
    typeof sourcePrompt?.metadata === 'object' &&
    sourcePrompt?.metadata &&
    'patternFamily' in sourcePrompt.metadata &&
    typeof (sourcePrompt.metadata as Record<string, unknown>).patternFamily === 'string'
      ? ((sourcePrompt.metadata as Record<string, unknown>).patternFamily as string)
      : seedContext.sourceFamily
  const requiredConcepts =
    sourcePrompt?.metadata && typeof sourcePrompt.metadata.judge?.requiredConcepts === 'object'
      ? (sourcePrompt.metadata.judge?.requiredConcepts as unknown[]).filter(
          (value): value is string => typeof value === 'string',
        )
      : []

  return `You are meta-verifying an LLM judge decision for a derived low-scale modnet prompt.

Task:
${task}

Source continuity context:
- source family: ${sourceFamily}
- source scale concepts: ${requiredConcepts.length > 0 ? requiredConcepts.join(', ') : 'unknown'}
- source scale label: ${seedContext.sourceScaleLabel}
- approved parent context:
  - anchor: ${seedContext.approvedParentAnchor || 'missing'}
  - family/scale: ${seedContext.approvedParentFamily || 'unknown'}/${seedContext.approvedParentScale || 'missing'}
  - mechanism: ${seedContext.approvedParentMechanism || 'missing'}
  - subject style: ${seedContext.approvedParentSubject || 'missing'}
- rewritten seed anchors (primary):
  - title: ${seedContext.rewrittenTitle}
  - input: ${seedContext.rewrittenInput}
  - hint: ${seedContext.rewrittenHint}
- original source anchors:
  - source title: ${seedContext.sourceTitle}
  - source description: ${seedContext.sourceDescription}
  - source-anchor signals:
  - rewritten-seed anchors: ${seedContext.sourceSeedAnchors || 'none'}
  - source-grounding anchors: ${seedContext.sourceGroundingAnchors || 'none'}
  - source mechanics: ${seedContext.sourceMechanics || 'not-provided'}
  - source operational loop: ${seedContext.operationalLoop || 'not-provided'}
  - source reusable actions: ${seedContext.reusableActions || 'not-provided'}
  - handcrafted anchor ids: ${seedContext.handcraftedAnchorIds || 'none'}
  - handcrafted anchor terms: ${seedContext.handcraftedAnchorTerms || 'none'}
  - handcrafted anchor mechanics: ${seedContext.handcraftedAnchorMechanics || 'none'}
- source structure: ${seedContext.sourceStructure}
- source precursor shape: ${seedContext.sourceShape || 'unknown'}
- source core user job: ${seedContext.sourceCoreUserJob}
- source why relevant: ${seedContext.sourceWhyRelevant}
- source context summary:
${sourceContextText}
- chain context:
${chainText}
- parent contribution: ${seedContext.contributesToParentCapability || 'missing'}
- approved lane anchors:
  - Archimedes/pi explorer → creative-tool / S1
  - Klingon Dictionary → reference-browser / S2
  - 1st Law of Thermodynamics → educational-interactive / S3

Source prompt:
${sourcePromptText}

Candidate derived prompt:
${candidatePrompt}

Deterministic precheck:
${deterministicCheck}

Seed context payload:
${seedContextText}

Precursor-chain assertions:
- expected parent scale: ${seedContext.chainExpectedParentScale || 'missing'}
- immediate parent scale: ${seedContext.chainImmediateParentScale || 'missing'}
  - expected parent capability: ${seedContext.chainExpectedParentCapability || 'missing'}
  - immediate parent capability: ${seedContext.chainImmediateParentCapability || 'missing'}
  - immediate parent reusable actions: ${seedContext.chainImmediateParentReusableActions || 'missing'}
  - immediate parent operational loop: ${seedContext.chainImmediateParentOperationalLoop || 'missing'}
  - immediate parent shape: ${seedContext.chainImmediateParentShape || 'missing'}
  - immediate parent role/affordances: ${seedContext.chainImmediateParentRole || 'missing'} / ${seedContext.chainImmediateParentRoleAffordances || 'missing'}
- parent contribution: ${seedContext.contributesToParentCapability || 'missing'}
- expected parent prompt id: ${seedContext.chainExpectedParentPromptId || 'missing'}
- immediate parent prompt id: ${seedContext.chainImmediateParentPromptId || 'missing'}
- chain path: ${seedContext.chainPath || 'missing'}

Primary judge result:
${output}

- consistency: does the judge explicitly justify family continuity, scale continuity, and concrete reusable action/block utility?
- consistency: does the judge verify precursor shape is explicit and scale-appropriate for the target?
- consistency: does the judge verify reusable action-loop continuity and approved-parent mechanism alignment from the immediate parent?
- consistency: does the judge verify a concrete predecessor capability path (not generic role language)?
- consistency: does the judge verify the candidate explicitly uses immediate-parent role affordances (e.g., list, session, lookup, board)?
- risk: is there any category-risked failure (generic drift, scale drift, or low reuse value) the judge ignored?
- confidence: is the primary judge reasoning materially recoverable from source + candidate + deterministic checks?
- primary judge signal checks:
  - judge pass: ${judgePass}
  - judge score: ${judgeScore}
  - judge reasoning length: ${judgeReasoning.length}
  - deterministic hard failures: ${deterministicFlags.hardFailures.join(', ') || 'none'}
  - deterministic risk signals: ${deterministicFlags.riskSignals.join(', ') || 'none'}

Meta-guardrails:
- reject when source continuity signals are weak but judge reasoning is broad
- reject when scale continuity is wrong or implied without explicit anti-drift anchors
- reject when usefulness is claimed without a concrete reusable block signal
- reject when shape continuity/anchor is generic or mismatched to the target scale
- reject when family-agnostic filler is present without recurring source mechanics/reusable primitives
- reject when one of the two source anchors is missing (rewritten seed or grounding)
- reject when judge confidence exceeds evidence from the provided rewritten/source context

Pass only if the primary judge result is specific, internally consistent, and safe to trust.

Explicit continuity check:
- if deterministic signals show continuity risk, the judge must provide direct mitigation language or it should fail.
`
}

const buildOutcome = ({
  dimensions,
  sdkMeta,
}: {
  dimensions?: MetaJudgeOutput['dimensions']
  sdkMeta?: Record<string, unknown>
}) =>
  ModnetDerivedPromptMetaOutcomeSchema.parse({
    verifierKind: 'modnet-derived-prompt-meta-verifier',
    ...(dimensions ? { dimensions } : {}),
    ...(sdkMeta ? { metaVerificationSdk: sdkMeta } : {}),
  })

export const toGraderResult = (result: MetaJudgeOutput & { outcome?: Record<string, unknown> }): GraderResult =>
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

const invokeMetaVerifier = async (prompt: string): Promise<MetaJudgeOutput & { outcome?: Record<string, unknown> }> => {
  const result = await runStructuredMetaVerifierQuery<MetaJudgeOutput>({
    prompt,
    schema: MetaJudgeOutputSchema,
  })

  if (!result.ok) {
    return {
      pass: false,
      score: 0,
      reasoning: `Meta verifier SDK error: ${result.reason}`,
      outcome: buildOutcome({
        sdkMeta: result.meta,
      }),
    }
  }

  return {
    pass: result.value.pass,
    score: Math.max(0, Math.min(1, result.value.score)),
    reasoning: result.value.reasoning,
    ...(result.value.dimensions || result.meta
      ? {
          outcome: buildOutcome({
            dimensions: result.value.dimensions,
            sdkMeta: result.meta,
          }),
        }
      : {}),
  }
}

export const grade: Grader = async ({ input, output, metadata }): Promise<GraderResult> => {
  const task = Array.isArray(input) ? input.join('\n') : input
  const meta = (metadata ?? {}) as Record<string, unknown>
  const result = await invokeMetaVerifier(buildMetaPrompt({ task, output, metadata: meta }))
  return toGraderResult(result)
}
