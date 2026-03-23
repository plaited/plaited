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
  const sourcePrompt = JSON.stringify(metadata?.sourcePrompt ?? {}, null, 2)
  const candidatePrompt = JSON.stringify(metadata?.candidatePrompt ?? {}, null, 2)
  const deterministicCheck = JSON.stringify(metadata?.deterministicCheck ?? {}, null, 2)

  return `You are meta-verifying an LLM judge decision for a derived low-scale modnet prompt.

Task:
${task}

Source prompt:
${sourcePrompt}

Candidate derived prompt:
${candidatePrompt}

Deterministic precheck:
${deterministicCheck}

Primary judge result:
${output}

Score the primary judge on:
- consistency: does the reasoning match the source prompt, candidate, and deterministic checks?
- risk: does the candidate still look safe to retain despite possible judge optimism?
- confidence: how much should the harness trust the primary judge here?

Pass only if the primary judge result looks internally consistent and safe to trust.`
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
