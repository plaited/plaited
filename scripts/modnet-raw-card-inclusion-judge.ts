import * as z from 'zod'
import type { Grader, GraderResult } from '../src/improve.ts'
import { GraderResultSchema } from '../src/improve.ts'
import { runStructuredClaudeQuery } from './claude-agent-sdk.ts'

const CLAUDE_PRIMARY_MODEL = 'claude-sonnet-4-6'

export const InclusionDecisionSchema = z.enum(['retain', 'retain_low_priority', 'discard'])

export const ModnetRawCardInclusionJudgeDimensionsSchema = z.object({
  relevance: z.number().min(0).max(1),
  corollaryFit: z.number().min(0).max(1),
  moduleShape: z.number().min(0).max(1),
  restraint: z.number().min(0).max(1),
})

export const ModnetRawCardInclusionJudgeOutcomeSchema = z.object({
  judgeKind: z.literal('modnet-raw-card-inclusion'),
  inclusionDecision: InclusionDecisionSchema,
  modernAnalog: z.string(),
  coreUserJob: z.string(),
  whyRelevant: z.string(),
  likelyPatternFamily: z.string(),
  likelyStructure: z.string(),
  searchQuerySeed: z.string(),
  dimensions: ModnetRawCardInclusionJudgeDimensionsSchema.optional(),
  judgeSdk: z.record(z.string(), z.unknown()).optional(),
})

type JudgeOutput = {
  pass: boolean
  score: number
  reasoning: string
  inclusionDecision: z.infer<typeof InclusionDecisionSchema>
  modernAnalog: string
  coreUserJob: string
  whyRelevant: string
  likelyPatternFamily: string
  likelyStructure: string
  searchQuerySeed: string
  dimensions?: z.infer<typeof ModnetRawCardInclusionJudgeDimensionsSchema>
}

const JudgeOutputSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'pass',
    'score',
    'reasoning',
    'inclusionDecision',
    'modernAnalog',
    'coreUserJob',
    'whyRelevant',
    'likelyPatternFamily',
    'likelyStructure',
    'searchQuerySeed',
  ],
  properties: {
    pass: { type: 'boolean' },
    score: { type: 'number', minimum: 0, maximum: 1 },
    reasoning: { type: 'string' },
    inclusionDecision: { type: 'string', enum: ['retain', 'retain_low_priority', 'discard'] },
    modernAnalog: { type: 'string' },
    coreUserJob: { type: 'string' },
    whyRelevant: { type: 'string' },
    likelyPatternFamily: { type: 'string' },
    likelyStructure: { type: 'string' },
    searchQuerySeed: { type: 'string' },
    dimensions: {
      type: 'object',
      additionalProperties: false,
      required: ['relevance', 'corollaryFit', 'moduleShape', 'restraint'],
      properties: {
        relevance: { type: 'number', minimum: 0, maximum: 1 },
        corollaryFit: { type: 'number', minimum: 0, maximum: 1 },
        moduleShape: { type: 'number', minimum: 0, maximum: 1 },
        restraint: { type: 'number', minimum: 0, maximum: 1 },
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
  const rawCard = JSON.stringify(metadata?.rawCard ?? {}, null, 2)
  const deterministicCheck = JSON.stringify(metadata?.deterministicCheck ?? {}, null, 2)
  const derivedRubric = JSON.stringify(metadata?.derivedRubric ?? {}, null, 2)

  return `You are reviewing a raw-card inclusion decision for the modnet prompt pipeline.

The raw-card gate must decide whether a historical software card has a durable
modern module analog worth carrying forward into the prompt set.

Task:
${task}

Raw card:
${rawCard}

Candidate inclusion output:
${output}

Deterministic precheck:
${deterministicCheck}

Derived target rubric:
${derivedRubric || '"Use the Slice 11 prompt-target rubric when present."'}

Judge this candidate on:
- relevance: does the row imply a durable modern user job with sovereign/local-first value?
- corollaryFit: is the proposed modern analog plausible rather than generic or nostalgic?
- moduleShape: do the likely family/structure and search seed recover a useful module shape?
- restraint: does the candidate avoid inventing more than the title/description can support?

Guidance:
- Use only title and description as evidence. Do not rely on source_url or archive-page nostalgia.
- Obsolete surfaces can still be retained if the underlying user job has a credible modern analog.
- Fax, dial-up, or era-specific transport should often collapse to a durable workflow such as intake, routing, logging, coordination, or records management.
- Historical curiosity alone is not enough. Thin novelty, platform trivia, or obsolete implementation detail without a durable modern user job should be discarded.
- "retain" means prompt-worthy and worth later search-grounded regeneration.
- "retain_low_priority" means plausible but weaker or niche enough that later search spend should be conservative.
- "discard" means mostly obsolete or not meaningfully modnet-relevant.
- The modern analog should stay concrete. Avoid generic fallbacks like "a private organizer on my phone" unless the raw evidence truly supports only that level.
- The search query seed should target the modern workflow/job, not the historical brand or platform.

Pass only if the candidate inclusion output is trustworthy enough to use as the basis for the next pipeline step.`
}

const buildOutcome = ({
  result,
  sdkMeta,
}: {
  result: Omit<JudgeOutput, 'pass' | 'score' | 'reasoning'>
  sdkMeta?: Record<string, unknown>
}) =>
  ModnetRawCardInclusionJudgeOutcomeSchema.parse({
    judgeKind: 'modnet-raw-card-inclusion',
    inclusionDecision: result.inclusionDecision,
    modernAnalog: result.modernAnalog,
    coreUserJob: result.coreUserJob,
    whyRelevant: result.whyRelevant,
    likelyPatternFamily: result.likelyPatternFamily,
    likelyStructure: result.likelyStructure,
    searchQuerySeed: result.searchQuerySeed,
    ...(result.dimensions ? { dimensions: result.dimensions } : {}),
    ...(sdkMeta ? { judgeSdk: sdkMeta } : {}),
  })

export const toGraderResult = (result: JudgeOutput & { outcome?: Record<string, unknown> }): GraderResult =>
  GraderResultSchema.parse({
    pass: result.pass,
    score: result.score,
    reasoning: result.reasoning,
    outcome:
      result.outcome ??
      buildOutcome({
        result: {
          inclusionDecision: result.inclusionDecision,
          modernAnalog: result.modernAnalog,
          coreUserJob: result.coreUserJob,
          whyRelevant: result.whyRelevant,
          likelyPatternFamily: result.likelyPatternFamily,
          likelyStructure: result.likelyStructure,
          searchQuerySeed: result.searchQuerySeed,
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
      inclusionDecision: 'discard',
      modernAnalog: '',
      coreUserJob: '',
      whyRelevant: 'Judge failed before returning a structured inclusion result.',
      likelyPatternFamily: '',
      likelyStructure: '',
      searchQuerySeed: '',
      outcome: buildOutcome({
        result: {
          inclusionDecision: 'discard',
          modernAnalog: '',
          coreUserJob: '',
          whyRelevant: 'Judge failed before returning a structured inclusion result.',
          likelyPatternFamily: '',
          likelyStructure: '',
          searchQuerySeed: '',
        },
        sdkMeta: result.meta,
      }),
    }
  }

  return {
    ...result.value,
    score: Math.max(0, Math.min(1, result.value.score)),
    outcome: buildOutcome({
      result: {
        inclusionDecision: result.value.inclusionDecision,
        modernAnalog: result.value.modernAnalog,
        coreUserJob: result.value.coreUserJob,
        whyRelevant: result.value.whyRelevant,
        likelyPatternFamily: result.value.likelyPatternFamily,
        likelyStructure: result.value.likelyStructure,
        searchQuerySeed: result.value.searchQuerySeed,
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
