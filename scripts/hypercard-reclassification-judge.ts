import * as z from 'zod'
import type { Grader, GraderResult } from '../src/improve.ts'
import { GraderResultSchema } from '../src/improve.ts'
import { runStructuredClaudeQuery } from './claude-agent-sdk.ts'

const CLAUDE_PRIMARY_MODEL = 'claude-sonnet-4-6'

const TRAINING_GUIDE_CONTEXT = [
  'Training guide context:',
  '- HyperCard-derived prompts are breadth material for modnet Stage 1, but the goal is not nostalgia-faithful reproduction. The goal is to recover strong sovereign-module patterns.',
  '- Good seed-review candidates are historically interesting artifacts that still express reusable module structure, especially richer S4+ suites, niche but evergreen tools, or artifacts with clear modern sovereign-node relevance.',
  '- Scale guidance: S1 single object, S2 object group/list/editor, S3 interactive block, S4 connected block group or suite, S5 standalone full module/community, S6+ networked module group or platform.',
  '- Use S4 only when the artifact really behaves like a connected suite of blocks, not merely a feature-rich S2 object group.',
  '- Public-domain or public reference artifacts can reasonably be boundary=all. Personal records, payroll, journals, and similarly sensitive data should usually remain boundary=none.',
  '- Pattern-family choices should stay inside the canonical ten-family modnet catalog vocabulary and reflect the actual artifact, not prompt-noise or accidental workflow phrasing.',
].join('\n')

const PatternFamilySchema = z.enum([
  'personal-data-manager',
  'reference-browser',
  'educational-interactive',
  'creative-tool',
  'business-process',
  'game-simulation',
  'communication',
  'instrument-control',
  'multimedia-presentation',
  'developer-utility',
])

const StructureSchema = z.enum([
  'object',
  'form',
  'list',
  'collection',
  'steps',
  'pool',
  'stream',
  'feed',
  'wall',
  'thread',
  'hierarchy',
  'matrix',
  'daisy',
  'hypertext',
])

export const ReclassifiedMssSchema = z.object({
  contentType: z.string(),
  structure: StructureSchema,
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
  patternFamily: PatternFamilySchema,
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
  patternFamily: z.infer<typeof PatternFamilySchema>
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
    patternFamily: {
      type: 'string',
      enum: [
        'personal-data-manager',
        'reference-browser',
        'educational-interactive',
        'creative-tool',
        'business-process',
        'game-simulation',
        'communication',
        'instrument-control',
        'multimedia-presentation',
        'developer-utility',
      ],
    },
    keepForSeedReview: { type: 'boolean' },
    rationale: { type: 'string' },
    mss: {
      type: 'object',
      additionalProperties: false,
      required: ['contentType', 'structure', 'mechanics', 'boundary', 'scale', 'confidence'],
      properties: {
        contentType: { type: 'string' },
        structure: {
          type: 'string',
          enum: [
            'object',
            'form',
            'list',
            'collection',
            'steps',
            'pool',
            'stream',
            'feed',
            'wall',
            'thread',
            'hierarchy',
            'matrix',
            'daisy',
            'hypertext',
          ],
        },
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
- Stay inside the Plaited vocabulary drawn from skills/mss-vocabulary, skills/modnet-node, and skills/modnet-modules.
- Do not invent new pattern families.
- Do not invent new structure labels. Use only: object, form, list, collection, steps, pool, stream, feed, wall, thread, hierarchy, matrix, daisy, hypertext.
- Prefer the documented MSS mechanic vocabulary when it fits: sort, filter, track, chart, vote, reply, share, follow, like, post, tag, book, rate, stream, contact, limited-loops, gold, karma, scarcity.
- Do not force a mechanic into that list if it would distort the artifact. When needed, you may return a more specific mechanic label, but keep it concise and semantically grounded in the source.
- ContentType may be specific, but it should still read like MSS vocabulary: lowercase, hyphenated when needed, and semantically compatible with modnet grouping.
- Apply modnet-node boundary reasoning conservatively: truly private/personal records should stay none, public reference material can be all, collaborative or account-like flows should usually be ask, and value-exchange flows may be paid.

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

${TRAINING_GUIDE_CONTEXT}

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
      patternFamily: 'developer-utility',
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
          patternFamily: 'developer-utility',
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
