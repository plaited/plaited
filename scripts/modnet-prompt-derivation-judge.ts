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
  sourceCoreUserJob: string
  sourceWhyRelevant: string
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
  if (asBoolean(checks.hasRewrittenSeedAnchor) === false) {
    riskSignals.push('missing-rewritten-seed-anchor')
  }
  if (asBoolean(checks.hasSourceLexicalAnchor) === false) {
    riskSignals.push('weak-source-anchor')
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
  - source core user job: ${seedReviewContext.sourceCoreUserJob}
  - source why relevant: ${seedReviewContext.sourceWhyRelevant}
- source context summary:
${sourceContextText}
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
- specificity: concrete mechanics (defined fields/actions instead of template text)
- precursor plausibility: one-stage precursor intent (real S1/S2/S3 precursor, not full abstraction)

Scoring guidance:
- S1 should be one atomic module with clear action and minimal surface area.
- S2 should expose list/group mechanics over atomic modules.
- S3 should expose one bounded composition surface.
- Prefer explicit reuse mechanics over decorative intent.
- Penalize over-abstracted, feature-suite, or duplicated full-parent scope candidates.
- Reject candidates that fail source anchor continuity even if generic text is fluent.

Pass only if this candidate materially preserves family continuity, scale continuity, and real lower-scale composition value.
Be conservative about generic prompts and overbroad abstractions.

Continuity guardrails:
- deterministic hard failures: ${deterministicConcerns.hardFailures.join(', ') || 'none'}
- deterministic risk signals: ${deterministicConcerns.riskSignals.join(', ') || 'none'}
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

export const grade: Grader = async ({ input, output, metadata }) => {
  const task = Array.isArray(input) ? input.join('\n') : input
  const meta = (metadata ?? {}) as Record<string, unknown>
  const result = await invokeJudge(buildJudgePrompt({ task, output, metadata: meta }))
  return toGraderResult(result)
}
