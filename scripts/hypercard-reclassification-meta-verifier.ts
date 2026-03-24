import * as z from 'zod'
import type { Grader, GraderResult } from '../src/improve.ts'
import { GraderResultSchema } from '../src/improve.ts'
import { runStructuredMetaVerifierQuery } from './meta-verifier-runtime.ts'

export const HypercardReclassificationMetaDimensionsSchema = z.object({
  consistency: z.number().min(0).max(1),
  risk: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
})

export const HypercardReclassificationMetaOutcomeSchema = z.object({
  verifierKind: z.literal('hypercard-reclassification-meta-verifier'),
  dimensions: HypercardReclassificationMetaDimensionsSchema.optional(),
  metaVerificationSdk: z.record(z.string(), z.unknown()).optional(),
})

type SeedReviewContext = {
  provenance?: string
  recommendedFromSlice14?: boolean
  slice14Reliable?: boolean
  regenerationQualityScore?: number
  antiInflationLevel?: string
  antiInflationSignals?: unknown
  sourceScale?: number
  generatedScaleValue?: number
  scaleDrift?: number
  deterministicPass?: boolean
}

const getSeedReviewContext = (metadata?: Record<string, unknown>): SeedReviewContext => {
  const sourceRecord = metadata?.sourceRecord
  const maybeContext =
    sourceRecord && typeof sourceRecord === 'object'
      ? ((sourceRecord as Record<string, unknown>).seedReviewContext as unknown)
      : undefined

  if (!maybeContext || typeof maybeContext !== 'object') {
    return {}
  }

  return maybeContext as SeedReviewContext
}

const antiInflationFromContext = (context: SeedReviewContext): 'low' | 'medium' | 'high' => {
  if (context.antiInflationLevel === 'high') return 'high'
  if (context.antiInflationLevel === 'medium') return 'medium'
  if (context.antiInflationLevel === 'low') return 'low'
  return 'low'
}

const countAntiInflationSignals = (context: SeedReviewContext): number =>
  Array.isArray(context.antiInflationSignals) ? context.antiInflationSignals.length : 0

const isStrongTrustedCandidate = (context: SeedReviewContext): boolean => {
  const quality = context.regenerationQualityScore
  return (
    context.provenance === 'trusted' &&
    context.recommendedFromSlice14 === true &&
    context.slice14Reliable === true &&
    typeof quality === 'number' &&
    quality >= 0.82 &&
    antiInflationFromContext(context) !== 'high'
  )
}

const isRescueIffyCandidate = (context: SeedReviewContext): boolean => {
  const quality = context.regenerationQualityScore
  return (
    context.provenance === 'iffy' &&
    context.recommendedFromSlice14 === true &&
    antiInflationFromContext(context) === 'low' &&
    typeof quality === 'number' &&
    quality >= 0.88 &&
    countAntiInflationSignals(context) === 0
  )
}

type SeedReviewLane = 'strong-trusted' | 'iffy-rescue' | 'iffy-gated' | 'unknown'

const getSeedReviewLane = (context: SeedReviewContext): SeedReviewLane => {
  if (isStrongTrustedCandidate(context)) return 'strong-trusted'
  if (isRescueIffyCandidate(context)) return 'iffy-rescue'
  if (context.provenance === 'iffy') return 'iffy-gated'
  return 'unknown'
}

const buildMetaPromotionPolicy = (context: SeedReviewContext): string => {
  const antiInflation = antiInflationFromContext(context)
  const lane = getSeedReviewLane(context)
  const signalCount = countAntiInflationSignals(context)
  const sourceScale = typeof context.sourceScale === 'number' ? context.sourceScale : null
  const regeneratedScale = typeof context.generatedScaleValue === 'number' ? context.generatedScaleValue : null
  const scaleDrift = typeof context.scaleDrift === 'number' ? context.scaleDrift : null

  return [
    'Seed-promotion verifier policy:',
    `- Provenance: ${context.provenance ?? 'unknown'}.`,
    `- Seed-review lane: ${lane}.`,
    `- Slice-14 trust signals: recommended=${Boolean(context.recommendedFromSlice14)}, reliable=${Boolean(context.slice14Reliable)}.`,
    `- Anti-inflation: ${antiInflation} (${signalCount} signal(s)).`,
    `- Scale view: source S${sourceScale ?? '?'} -> regenerated S${regeneratedScale ?? '?'} with drift ${scaleDrift ?? '?'}.`,
    '- Pass unless explicit evidence is insufficient for bounded reuse and source alignment.',
    ...(lane === 'strong-trusted'
      ? [
          '- Strong-trusted lane: pass compact, evidence-grounded S1-S3 outcomes when scale/family fit is coherent.',
          '- For this lane, do not fail solely on conservative novelty concerns.',
        ]
      : lane === 'iffy-rescue'
        ? [
            '- Iffy-rescue lane: allow pass when mechanics are explicit, source anchors are clear, and scale expansion is bounded.',
            '- Prefer to fail only when provenance mismatch or clear over-expansion remains.',
          ]
        : lane === 'iffy-gated'
          ? [
              '- Iffy-gated lane: keep conservative. Require explicit source-scope proof before any pass.',
              '- Family/scale expansion should be rejected unless there is direct block-level evidence.',
            ]
          : ['- Unknown lane: stay conservative and pass only when all evidence fields align.']),
    ...(antiInflation === 'high'
      ? [
          '- For high anti-inflation, do not pass suite-like S4+ claims unless the judge output includes explicit coordinated block proof and consistent family/scale evidence.',
        ]
      : antiInflation === 'medium'
        ? [
            '- For medium anti-inflation, demand stronger consistency and source alignment before pass on scale/family expansion above S2.',
          ]
        : [
            '- For low anti-inflation, allow bounded S1-S3 reuse when mechanics and source anchors are clear and consistent.',
            '- Avoid defaulting to fail when scale/family stays bounded and evidence remains source-faithful.',
          ]),
    ...(context.deterministicPass === false
      ? ['- Deterministic checks were flagged; tighten confidence and risk gating before pass.']
      : []),
  ].join('\n')
}

type MetaJudgeOutput = {
  pass: boolean
  score: number
  reasoning: string
  dimensions?: z.infer<typeof HypercardReclassificationMetaDimensionsSchema>
}

type ParsedJudgeSummary = {
  primaryPass: boolean | null
  primaryScore: number | null
  keepForSeedReview: boolean | null
  rationale: string | null
  patternFamily: string | null
  structure: string | null
  mssScale: number | null
  dimensions:
    | {
        consistency: number | null
        risk: number | null
        confidence: number | null
      }
    | undefined
}

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {}

const summarizeJudgeOutput = (output: string): ParsedJudgeSummary => {
  try {
    const parsed = JSON.parse(output)
    if (!parsed || typeof parsed !== 'object') {
      return {
        primaryPass: null,
        primaryScore: null,
        keepForSeedReview: null,
        rationale: null,
        patternFamily: null,
        structure: null,
        mssScale: null,
        dimensions: undefined,
      }
    }

    const primary = asRecord(parsed)
    const outcome = asRecord(primary.outcome)
    const mss = asRecord(outcome.mss)
    const dimensions = asRecord(outcome.dimensions)
    const hasDimensionData =
      typeof dimensions.consistency === 'number' ||
      typeof dimensions.risk === 'number' ||
      typeof dimensions.confidence === 'number'

    return {
      primaryPass: typeof primary.pass === 'boolean' ? primary.pass : null,
      primaryScore: typeof primary.score === 'number' ? primary.score : null,
      keepForSeedReview: typeof outcome.keepForSeedReview === 'boolean' ? outcome.keepForSeedReview : null,
      rationale: typeof primary.reasoning === 'string' ? primary.reasoning : null,
      patternFamily: typeof outcome.patternFamily === 'string' ? outcome.patternFamily : null,
      structure: typeof mss.structure === 'string' ? mss.structure : null,
      mssScale: typeof mss.scale === 'number' ? mss.scale : null,
      dimensions: hasDimensionData
        ? {
            consistency: typeof dimensions.consistency === 'number' ? dimensions.consistency : null,
            risk: typeof dimensions.risk === 'number' ? dimensions.risk : null,
            confidence: typeof dimensions.confidence === 'number' ? dimensions.confidence : null,
          }
        : undefined,
    }
  } catch {
    return {
      primaryPass: null,
      primaryScore: null,
      keepForSeedReview: null,
      rationale: null,
      patternFamily: null,
      structure: null,
      mssScale: null,
      dimensions: undefined,
    }
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
  const sourceRecord = JSON.stringify((metadata?.sourceRecord as Record<string, unknown> | undefined) ?? {}, null, 2)
  const currentClassification = JSON.stringify(
    (metadata?.currentClassification as Record<string, unknown> | undefined) ?? {},
    null,
    2,
  )
  const heuristicPrior = JSON.stringify(
    (metadata?.heuristicPrior as Record<string, unknown> | undefined) ?? {},
    null,
    2,
  )
  const seedReviewContext = JSON.stringify(
    ((metadata?.sourceRecord as Record<string, unknown> | undefined)?.seedReviewContext as
      | Record<string, unknown>
      | undefined) ?? {},
    null,
    2,
  )
  const seedReviewPolicy = buildMetaPromotionPolicy(getSeedReviewContext(metadata))
  const judgeSummary = summarizeJudgeOutput(output)
  const policyContext = JSON.stringify(
    (metadata?.metaVerifierPolicy as Record<string, unknown> | undefined) ?? {},
    null,
    2,
  )

  return `You are meta-verifying a HyperCard reclassification judgment.

Task:
${task}

Source record:
${sourceRecord}

Current classification:
${currentClassification}

Heuristic prior:
${heuristicPrior}

Seed-review context:
${seedReviewContext}

Seed-promotion policy:
${seedReviewPolicy}

Primary judge summary:
${JSON.stringify(judgeSummary, null, 2)}

Meta-verifier policy:
${policyContext}

Primary judge result:
${output}

Score the primary judge on:
- consistency: does it match the evidence?
- risk: how risky would it be to trust this reclassification?
- confidence: how much should the pipeline trust the primary judge?
- default stance: when the output is mostly source-aligned and bounded, prefer pass unless a concrete contradiction is present.
- provenance-aware caution: do not reward weakly evidenced positives from iffy rows
- if the judge is internally consistent but conservative, do not punish absence of novelty or suite framing when evidence is bounded.
- anti-inflation: penalize inflated scale or expanded family where source evidence is narrow, especially for S4+ structures
- anti-inflation: allow bounded S1-S3 expansion when source anchors and mechanics are clear
- promotion suitability: prefer conservative trust unless clear reusable module-level value is present; bounded source-aligned S1-S3 candidates can pass when derivation-safe.
- scope alignment: detect mismatch between the regenerated scope and the original source pattern
- explicit scale guardrail: if anti-inflation risk is present in sourceRecord.seedReviewContext, score risk higher and reduce confidence unless a direct mechanism chain is present
- provenance guardrail: if provenance is "iffy" and deterministic checks reported hard failures, require strong cross-evidence before pass
- if 'seedReviewContext' includes 'coreUserJob', 'whyRelevant', or 'searchQuerySeed', prioritize source-scope fidelity to those anchors before passing inflated scope/classification.
- do not fail for low novelty alone; conservative modules can still be trustworthy.
- if the primary judge returns keepForSeedReview=false but is internally consistent and source-aligned, meta-verifier may still pass.
- only fail on keepForSeedReview=false when refusal reflects real source mismatch, unsupported expansion, or provenance risk without evidence.
- if primary score is close and consistency appears grounded, bias toward pass over reject when provenance and anti-inflation checks pass.

Pass if the primary reclassification result looks internally consistent, evidence-grounded, and safe to trust for promotion review.
A bounded reusable S1-S3 candidate may pass even without high novelty when source alignment and anti-overbuild checks are clear.
Give explicit room for compact, source-grounded S2/S3 candidates that are derivation-safe and mechanism-complete, even with ordinary wording.`
}

const buildOutcome = ({
  dimensions,
  sdkMeta,
}: {
  dimensions?: MetaJudgeOutput['dimensions']
  sdkMeta?: Record<string, unknown>
}) =>
  HypercardReclassificationMetaOutcomeSchema.parse({
    verifierKind: 'hypercard-reclassification-meta-verifier',
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
    ...result.value,
    outcome: buildOutcome({
      dimensions: result.value.dimensions,
      sdkMeta: result.meta,
    }),
  }
}

export const grade: Grader = async ({ input, output, metadata }) => {
  const task = Array.isArray(input) ? input.join('\n') : input
  const meta = (metadata ?? {}) as Record<string, unknown>
  try {
    const result = await invokeMetaVerifier(buildMetaPrompt({ task, output, metadata: meta }))
    return toGraderResult(result)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return toGraderResult({
      pass: false,
      score: 0,
      reasoning: `Meta verifier parse error: ${message}`,
    })
  }
}
