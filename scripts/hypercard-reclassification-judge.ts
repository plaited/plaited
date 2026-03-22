import * as z from 'zod'
import type { Grader, GraderResult } from '../src/improve.ts'
import { GraderResultSchema } from '../src/improve.ts'
import { runStructuredClaudeQuery } from './claude-agent-sdk.ts'

const CLAUDE_PRIMARY_MODEL = 'claude-sonnet-4-6'

export const ReclassifiedMssSchema = z.object({
  contentType: z.string(),
  structure: z.string(),
  mechanics: z.array(z.string()),
  boundary: z.enum(['none', 'ask', 'all', 'paid']),
  scale: z.number().int().min(1).max(8),
  confidence: z.enum(['high', 'medium', 'low']),
})

export const HypercardReclassificationDimensionsSchema = z.object({
  scaleFit: z.number().min(0).max(1),
  familyFit: z.number().min(0).max(1),
  evidenceUse: z.number().min(0).max(1),
  modernizationValue: z.number().min(0).max(1),
})

export const HypercardReclassificationJudgeOutcomeSchema = z.object({
  judgeKind: z.literal('hypercard-reclassification'),
  patternFamily: z.string(),
  mss: ReclassifiedMssSchema,
  keepForSeedReview: z.boolean(),
  rationale: z.string(),
  dimensions: HypercardReclassificationDimensionsSchema.optional(),
  judgeSdk: z.record(z.string(), z.unknown()).optional(),
})

type JudgeOutput = {
  pass: boolean
  score: number
  reasoning: string
  patternFamily: string
  mss: z.infer<typeof ReclassifiedMssSchema>
  keepForSeedReview: boolean
  rationale: string
  dimensions?: z.infer<typeof HypercardReclassificationDimensionsSchema>
}

const JudgeOutputSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['pass', 'score', 'reasoning', 'patternFamily', 'mss', 'keepForSeedReview', 'rationale'],
  properties: {
    pass: { type: 'boolean' },
    score: { type: 'number', minimum: 0, maximum: 1 },
    reasoning: { type: 'string' },
    patternFamily: { type: 'string' },
    keepForSeedReview: { type: 'boolean' },
    rationale: { type: 'string' },
    mss: {
      type: 'object',
      additionalProperties: false,
      required: ['contentType', 'structure', 'mechanics', 'boundary', 'scale', 'confidence'],
      properties: {
        contentType: { type: 'string' },
        structure: { type: 'string' },
        mechanics: {
          type: 'array',
          items: { type: 'string' },
        },
        boundary: { type: 'string', enum: ['none', 'ask', 'all', 'paid'] },
        scale: { type: 'integer', minimum: 1, maximum: 8 },
        confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
      },
    },
    dimensions: {
      type: 'object',
      additionalProperties: false,
      required: ['scaleFit', 'familyFit', 'evidenceUse', 'modernizationValue'],
      properties: {
        scaleFit: { type: 'number', minimum: 0, maximum: 1 },
        familyFit: { type: 'number', minimum: 0, maximum: 1 },
        evidenceUse: { type: 'number', minimum: 0, maximum: 1 },
        modernizationValue: { type: 'number', minimum: 0, maximum: 1 },
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
  const sourceRecord = JSON.stringify(metadata?.sourceRecord ?? {}, null, 2)
  const currentClassification = JSON.stringify(metadata?.currentClassification ?? {}, null, 2)
  const heuristicPrior = JSON.stringify(metadata?.heuristicPrior ?? {}, null, 2)

  return `You are reclassifying a HyperCard-derived modnet training prompt.

Use the current MSS fields as a prior, not as ground truth. Prefer the actual title/description evidence.

Key heuristics:
- S1 = single object, S2 = object group/list/editor, S3 = block/dashboard/feed/profile/forum, S4 = connected block group/suite, S5 = full standalone module/community, S6+ = networked module group or platform.
- Many historical HyperCard business tools are understated if they really behave like multi-block suites rather than a single list.
- Pattern family must match the actual artifact, not generic workflow language accidentally added during prompt generation.
- KeepForSeedReview should be true when the reclassified item is especially useful for richer future derivation, especially if scale >= 4 or it is a high-value niche pattern.

Task:
${task}

Current generated prompt:
${output}

Source record:
${sourceRecord}

Current classification:
${currentClassification}

Heuristic prior:
${heuristicPrior}

Return the best revised patternFamily and MSS classification for this item. Pass only if the reclassification looks trustworthy enough to keep for audit/promotion review.`
}

const buildOutcome = ({
  result,
  sdkMeta,
}: {
  result: Omit<JudgeOutput, 'pass' | 'score' | 'reasoning'>
  sdkMeta?: Record<string, unknown>
}) =>
  HypercardReclassificationJudgeOutcomeSchema.parse({
    judgeKind: 'hypercard-reclassification',
    patternFamily: result.patternFamily,
    mss: result.mss,
    keepForSeedReview: result.keepForSeedReview,
    rationale: result.rationale,
    ...(result.dimensions ? { dimensions: result.dimensions } : {}),
    ...(sdkMeta ? { judgeSdk: sdkMeta } : {}),
  })

export const toGraderResult = (result: JudgeOutput & { outcome?: Record<string, unknown> }): GraderResult =>
  GraderResultSchema.parse({
    pass: result.pass,
    score: result.score,
    reasoning: result.reasoning,
    outcome: result.outcome
      ? result.outcome
      : buildOutcome({
          result: {
            patternFamily: result.patternFamily,
            mss: result.mss,
            keepForSeedReview: result.keepForSeedReview,
            rationale: result.rationale,
            ...(result.dimensions ? { dimensions: result.dimensions } : {}),
          },
        }),
  })

const invokeClaudeJudge = async (prompt: string): Promise<JudgeOutput & { outcome?: Record<string, unknown> }> => {
  const result = await runStructuredClaudeQuery<JudgeOutput>({
    model: CLAUDE_PRIMARY_MODEL,
    prompt,
    schema: JudgeOutputSchema,
  })

  if (!result.ok) {
    return {
      pass: false,
      score: 0,
      reasoning: `Claude judge SDK error: ${result.reason}`,
      patternFamily: 'unknown',
      mss: {
        contentType: 'tools',
        structure: 'list',
        mechanics: [],
        boundary: 'none',
        scale: 2,
        confidence: 'low',
      },
      keepForSeedReview: false,
      rationale: 'Judge failed before returning a structured reclassification.',
      outcome: buildOutcome({
        result: {
          patternFamily: 'unknown',
          mss: {
            contentType: 'tools',
            structure: 'list',
            mechanics: [],
            boundary: 'none',
            scale: 2,
            confidence: 'low',
          },
          keepForSeedReview: false,
          rationale: 'Judge failed before returning a structured reclassification.',
        },
        sdkMeta: result.meta,
      }),
    }
  }

  return {
    ...result.value,
    outcome: buildOutcome({
      result: {
        patternFamily: result.value.patternFamily,
        mss: result.value.mss,
        keepForSeedReview: result.value.keepForSeedReview,
        rationale: result.value.rationale,
        ...(result.value.dimensions ? { dimensions: result.value.dimensions } : {}),
      },
      sdkMeta: result.meta,
    }),
  }
}

export const grade: Grader = async ({ input, output, metadata }) => {
  const task = Array.isArray(input) ? input.join('\n') : input
  const meta = (metadata ?? {}) as Record<string, unknown>
  const result = await invokeClaudeJudge(buildJudgePrompt({ task, output, metadata: meta }))
  return toGraderResult(result)
}
