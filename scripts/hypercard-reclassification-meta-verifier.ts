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

type MetaJudgeOutput = {
  pass: boolean
  score: number
  reasoning: string
  dimensions?: z.infer<typeof HypercardReclassificationMetaDimensionsSchema>
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

const buildMetaPrompt = ({
  task,
  output,
  metadata,
}: {
  task: string
  output: string
  metadata?: Record<string, unknown>
}) => {
  const sourceRecord = JSON.stringify(metadata?.sourceRecord ?? {}, null, 2)
  const currentClassification = JSON.stringify(metadata?.currentClassification ?? {}, null, 2)
  const heuristicPrior = JSON.stringify(metadata?.heuristicPrior ?? {}, null, 2)

  return `You are meta-verifying a HyperCard reclassification judgment.

Task:
${task}

Source record:
${sourceRecord}

Current classification:
${currentClassification}

Heuristic prior:
${heuristicPrior}

Primary judge result:
${output}

Score the primary judge on:
- consistency: does it match the evidence?
- risk: how risky would it be to trust this reclassification?
- confidence: how much should the pipeline trust the primary judge?

Pass only if the primary reclassification result looks internally consistent and safe to trust.`
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
  const result = await invokeMetaVerifier(buildMetaPrompt({ task, output, metadata: meta }))
  return toGraderResult(result)
}
