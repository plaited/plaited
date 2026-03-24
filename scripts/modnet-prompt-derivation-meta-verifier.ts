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
  sourceCoreUserJob: string
  sourceWhyRelevant: string
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
  if (asBoolean(checks.usefulnessOrReusability) === false) {
    riskSignals.push('low-usefulness-risk')
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
        : parseScaleFromValue(asRecord(asRecord(sourceMetadata).judge).scale ?? asString(sourceMetadata.sourceScale)),
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
- rewritten seed anchors (primary):
  - title: ${seedContext.rewrittenTitle}
  - input: ${seedContext.rewrittenInput}
  - hint: ${seedContext.rewrittenHint}
- original source anchors:
  - source title: ${seedContext.sourceTitle}
  - source description: ${seedContext.sourceDescription}
- source structure: ${seedContext.sourceStructure}
- source core user job: ${seedContext.sourceCoreUserJob}
- source why relevant: ${seedContext.sourceWhyRelevant}
- source context summary:
${sourceContextText}
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

Primary judge result:
${output}

Score the primary judge on:
- consistency: does the judge explicitly justify family continuity, scale continuity, and concrete building-block utility?
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
