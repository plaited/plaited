import * as z from 'zod'
import type { Grader, GraderResult } from '../src/improve.ts'
import { GraderResultSchema } from '../src/improve.ts'
import { resolvePrimaryJudgeModel, runStructuredLlmQuery } from './structured-llm-query.ts'

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

const buildJudgePrompt = ({
  task,
  output,
  metadata,
}: {
  task: string
  output: string
  metadata?: Record<string, unknown>
}) => {
  const sourcePrompt = JSON.stringify(metadata?.sourcePrompt ?? {}, null, 2)
  const candidatePrompt = JSON.stringify(metadata?.candidatePrompt ?? output, null, 2)
  const deterministicCheck = JSON.stringify(metadata?.deterministicCheck ?? {}, null, 2)

  return `You are reviewing a candidate low-scale modnet prompt derived from a higher-scale source prompt.

The goal is to keep only prompts worth refining into the canonical modnet training catalog.

Task:
${task}

Source prompt:
${sourcePrompt}

Candidate derived prompt:
${candidatePrompt}

Deterministic precheck:
${deterministicCheck}

Judge this candidate on:
- fidelity: does it preserve the source domain/pattern family rather than drifting generic?
- scaleFit: is the candidate genuinely appropriate for the claimed S1/S2/S3 target?
- usefulness: would this help strengthen Stage 1 symbolic output quality in the catalog?
- specificity: is the wording concrete enough to be worth keeping rather than a template?

Pass only if this candidate is worth retaining for refinement or promotion into the catalog. Be conservative about generic prompts.`
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
