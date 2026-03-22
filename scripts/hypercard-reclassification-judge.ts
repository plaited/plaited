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

const REFERENCE_SYNTHESIS_CONTEXT = [
  'Reference synthesis from skills/mss-vocabulary, skills/modnet-node, skills/modnet-modules, and the modnet training guide:',
  "- Use MSS as composition reasoning, not nostalgia labeling: classify by the module's dominant loop, information organization, boundary, and containment level.",
  '- Boundary=none means internal-only. Do not let invitation text, author contact details, or distribution notes pressure the classification toward communication or service exposure.',
  '- Session-like verbs only count as mechanics when the artifact itself mediates that interaction. "Contact me for info", support addresses, and author credits are metadata, not module mechanics.',
  '- Instrument-control is for operating external hardware, lab equipment, telemetry, or real data-acquisition surfaces. Internal music-making, simulated instruments, and composition/playback tools are usually creative-tool unless the source clearly controls an external device.',
  '- Business-process beats personal-data-manager when the primary loop is payroll, ledger, inventory, scheduling, or repeatable operational work, even if the stack also keeps personal records or contact fields.',
  "- Personal-data-manager is only correct when the core value is the owner's personal records, contacts, notes, calendars, or household organization rather than an operational workflow.",
  '- Household, owner, or personal examples do not force personal-data-manager when the actual job is budgeting, project costing, inventory upkeep, vendor tracking, or payment summarization.',
  '- Creative-tool is for authoring, composing, arranging, performing, or manipulating expressive material. Do not snap to instrument-control just because the title mentions a keyboard, lab, or toolbox.',
  '- S2 remains correct for a rich tracker, editor, catalog, or workflow form. S3 needs a true block with multiple grouped views or emergent interactions. S4 is rare and requires multiple distinct S3-like blocks arranged into a coordinated suite.',
  '- "Complete", "thorough", "powerful", or "suite-like" prose is not enough for S4 by itself. Require evidence of separate coordinated blocks, not just depth inside one workflow.',
  '- Avoid reflexive collection defaults. Use list for ordered or printable records, form for dialog-style entry/editing, hierarchy for parent-child project/subproject organization, matrix for budget-vs-actual or category cross-comparison, and steps for explicit staged workflows.',
  '- Use collection only when the dominant value is browsing or managing a general catalog rather than a more specific list, hierarchy, matrix, steps, or form shape.',
  '- Menu-driven sections, generated category lists, transfer helpers, or printable summaries may still be an S2 operational tool rather than an S3/S4 suite unless the evidence shows separately coordinated blocks.',
  '- Seed-worthiness should favor niche-gold sovereign modules, enduring operational tools, and reusable module patterns. Do not promote thin demos or lexical curiosities just because the title sounds unusual.',
  '- S2 operational tools can still be seed-worthy when they capture an evergreen workflow with transferable structure, but ordinary inventory logs, simple payment ledgers, or thin record keepers should stay conservative unless the source shows unusual leverage.',
  '- Resist lexical snap-to-label errors. Titles like "keyboard", "accounting", or "laboratory toolbox" are clues, but the description and dominant user job decide the family, scale, and seed value.',
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

export const buildJudgePrompt = ({
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
  const calibrationCues = JSON.stringify(metadata?.calibrationCues ?? [], null, 2)

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
- Prioritize title + source description over prompt phrasing, appended contact copy, and generic modernization filler.

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

Calibration cues:
${calibrationCues}

${TRAINING_GUIDE_CONTEXT}

${REFERENCE_SYNTHESIS_CONTEXT}

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
