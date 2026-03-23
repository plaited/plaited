import * as z from 'zod'
import type { Grader, GraderResult } from '../src/improve.ts'
import { GraderResultSchema } from '../src/improve.ts'
import { runStructuredMetaVerifierQuery } from './meta-verifier-runtime.ts'

export const ModnetRawCardInclusionMetaDimensionsSchema = z.object({
  consistency: z.number().min(0).max(1),
  risk: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
})

export const ModnetRawCardInclusionMetaOutcomeSchema = z.object({
  verifierKind: z.literal('modnet-raw-card-inclusion-meta-verifier'),
  dimensions: ModnetRawCardInclusionMetaDimensionsSchema.optional(),
  metaVerificationSdk: z.record(z.string(), z.unknown()).optional(),
})

type MetaJudgeOutput = {
  pass: boolean
  score: number
  reasoning: string
  dimensions?: z.infer<typeof ModnetRawCardInclusionMetaDimensionsSchema>
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

const normalizeProbability = (value: unknown): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0
  return Math.max(0, Math.min(1, value))
}

const normalizeText = (value: unknown, fallback = ''): string => (typeof value === 'string' ? value : fallback)

const normalizeMetaOutput = (value: Partial<MetaJudgeOutput>, fallbackReasoning: string): MetaJudgeOutput => ({
  pass: typeof value.pass === 'boolean' ? value.pass : false,
  score: normalizeProbability(value.score),
  reasoning: normalizeText(value.reasoning, fallbackReasoning),
  ...(value.dimensions ? { dimensions: value.dimensions } : {}),
})

export const buildMetaPrompt = ({
  task,
  output,
  metadata,
}: {
  task: string
  output: string
  metadata?: Record<string, unknown>
}) => {
  const rawCard = JSON.stringify(metadata?.rawCard ?? {}, null, 2)
  const deterministicCheck = JSON.stringify(metadata?.deterministicCheck ?? {}, null, 2)

  return `You are meta-verifying an LLM judge result for the raw-card inclusion gate in the modnet prompt pipeline.

Modnet context:
- The gate is trying to keep rows that recover durable sovereign/local-first module patterns.
- It should reject thin implementation demos, one-off migration shims, nostalgia artifacts, trivia, and content-only stacks without a reusable workflow/module shape.
- A judge should not be rewarded for finding a merely possible generic software abstraction if the raw card does not support it.
- Obsolete storage, transport, or packaging formats can still imply a valid modern module if the underlying job survives in another medium or toolchain.
- Examples:
  - cassette labeler -> physical media, merch, or print-label workflow
  - phone-number change utility -> contact-data normalization or migration
  - fax or mail transport -> intake, routing, logging, or archival workflow

Task:
${task}

Raw card:
${rawCard}

Deterministic precheck:
${deterministicCheck}

Primary judge result:
${output}

Score the primary judge on:
- consistency: does the reasoning match the raw card and the proposed inclusion output?
- risk: how risky would it be to trust this inclusion decision in the next pipeline step?
- confidence: how much should the harness trust the primary judge here?

Consistency should include whether the judge correctly distinguishes:
- obsolete medium but durable workflow
- one-off technical demo with no bounded end-user utility
- broad generic abstraction invented from weak evidence

Meta checks:
- Fail if "pass" and "inclusionDecision" disagree.
  - "discard" should not come with "pass=true".
  - "retain" or "retain_low_priority" should not come with "pass=false".
- Fail or sharply downgrade if the score contradicts the reasoning.
- Fail or sharply downgrade if the judge treats "old medium" as sufficient evidence for discard without checking whether the underlying operational job is still durable.
- Reward discard when the row is only a technique demo, script trick, or implementation sample with no bounded end-user workflow.
- Fail or sharply downgrade if the judge over-generalizes from weak evidence into a broad modern analog.
- Distinguish "durable workflow survives in a new medium" from "judge invented a broad modern category"; downgrade the second but not the first.
- Reward judges that stay close to the text while still recovering a plausible modern workflow/module when one truly exists.

Pass only if the primary judge result looks internally consistent and safe to trust.`
}

const buildOutcome = ({
  dimensions,
  sdkMeta,
}: {
  dimensions?: MetaJudgeOutput['dimensions']
  sdkMeta?: Record<string, unknown>
}) =>
  ModnetRawCardInclusionMetaOutcomeSchema.parse({
    verifierKind: 'modnet-raw-card-inclusion-meta-verifier',
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

  const normalized = normalizeMetaOutput(
    result.value,
    'Meta verifier returned a partially malformed structured verification result.',
  )

  return {
    ...normalized,
    outcome: buildOutcome({
      dimensions: normalized.dimensions,
      sdkMeta: result.meta,
    }),
  }
}

export const grade: Grader = async ({ input, output, metadata }): Promise<GraderResult> => {
  const task = Array.isArray(input) ? input.join('\n') : input
  const meta = (metadata ?? {}) as Record<string, unknown>
  const result = await invokeMetaVerifier(buildMetaPrompt({ task, output, metadata: meta }))
  return toGraderResult(result)
}
