import * as z from 'zod'
import type { Grader, GraderResult } from '../src/improve.ts'
import { GraderResultSchema } from '../src/improve.ts'
import { resolvePrimaryJudgeModel, runStructuredLlmQuery } from './structured-llm-query.ts'

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

const normalizeProbability = (value: unknown): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0
  return Math.max(0, Math.min(1, value))
}

const normalizeText = (value: unknown, fallback = ''): string => (typeof value === 'string' ? value : fallback)

const normalizeDecision = (value: unknown): z.infer<typeof InclusionDecisionSchema> => {
  if (value === 'retain' || value === 'retain_low_priority' || value === 'discard') {
    return value
  }
  return 'discard'
}

const normalizeJudgeOutput = (value: Partial<JudgeOutput>, fallbackReasoning: string): JudgeOutput => {
  const inclusionDecision = normalizeDecision(value.inclusionDecision)
  const pass = typeof value.pass === 'boolean' ? value.pass : inclusionDecision !== 'discard'
  return {
    pass,
    score: normalizeProbability(value.score),
    reasoning: normalizeText(value.reasoning, fallbackReasoning),
    inclusionDecision,
    modernAnalog: normalizeText(value.modernAnalog),
    coreUserJob: normalizeText(value.coreUserJob),
    whyRelevant: normalizeText(value.whyRelevant, fallbackReasoning),
    likelyPatternFamily: normalizeText(value.likelyPatternFamily),
    likelyStructure: normalizeText(value.likelyStructure),
    searchQuerySeed: normalizeText(value.searchQuerySeed),
    ...(value.dimensions ? { dimensions: value.dimensions } : {}),
  }
}

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

Modnet context:
- Prefer durable sovereign/local-first module patterns over generic software abstractions.
- Good candidates recover a bounded user job, a plausible modern corollary, and a real module shape.
- Weak candidates are often thin implementation demos, one-off migration shims, nostalgia artifacts, trivia, or content-only stacks without a reusable workflow/module pattern.
- A modern analog is only good if it is supported by the title and description, not because a distant generic software category exists.

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
- Use the raw card first, not the candidate's optimism, as the source of truth.
- If the original medium, transport, or packaging is obsolete, first ask whether the underlying operator job still exists in a modern toolchain or adjacent medium; obsolete surface alone is not a discard reason.
- Obsolete surfaces can still be retained if the underlying user job has a credible modern analog.
- Fax, dial-up, or era-specific transport should often collapse to a durable workflow such as intake, routing, logging, coordination, or records management.
- Treat medium shifts as valid when the bounded job survives:
  - cassette labels can become merch, vinyl, or Cricut-style print-label workflows
  - phone-number changes can become contact-data normalization or migration workflows
  - fax or mail transport can become document intake, routing, logging, or archival workflows
- Historical curiosity alone is not enough. Thin novelty, platform trivia, or obsolete implementation detail without a durable modern user job should be discarded.
- If the row is just a helper function, implementation trick, or developer demo, prefer discard or retain_low_priority rather than promoting it into a prompt-worthy module.
- If the row is only content, fandom, a storybook, or a toy with no recoverable workflow/module pattern, discard it.
- Prefer discard only when both the historical medium is obsolete and the title/description do not support any surviving bounded workflow.
- Niche physical or operator workflows still count if they imply a concrete module or utility today; do not require mass-market relevance if the module shape is clear.
- If the modern analog requires a large conceptual jump that the card text does not support, discard it rather than rewarding clever abstraction.
- When rescuing an obsolete-medium row, keep the analog at the job level, not the nostalgia level: recover labeling, packaging, migration, routing, intake, tracking, or production support, not the dead platform itself.
- A keep-worthy row should usually imply one bounded module, record system, workflow, or operational utility that still makes sense today.
- "retain" means prompt-worthy and worth later search-grounded regeneration.
- "retain_low_priority" means plausible but weaker or niche enough that later search spend should be conservative.
- "discard" means mostly obsolete or not meaningfully modnet-relevant.
- The modern analog should stay concrete. Avoid generic fallbacks like "a private organizer on my phone" unless the raw evidence truly supports only that level.
- Fail restraint if the judge jumps from an obsolete artifact directly to a broad generic app category without naming the surviving bounded workflow.
- For obsolete-medium rows, score corollaryFit on whether the present-day corollary preserves the same user action loop, not whether it preserves the same file format or hardware.
- The search query seed should target the modern workflow/job, not the historical brand or platform.
- "pass" must agree with the inclusion decision:
  - "retain" or "retain_low_priority" => "pass=true"
  - "discard" => "pass=false"
- The score must agree with the reasoning and decision. Do not output a high score with a discard rationale, or a low score with strong positive reasoning.

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

  const normalized = normalizeJudgeOutput(
    result.value,
    'Judge returned a partially malformed structured inclusion result.',
  )

  return {
    ...normalized,
    outcome: buildOutcome({
      result: {
        inclusionDecision: normalized.inclusionDecision,
        modernAnalog: normalized.modernAnalog,
        coreUserJob: normalized.coreUserJob,
        whyRelevant: normalized.whyRelevant,
        likelyPatternFamily: normalized.likelyPatternFamily,
        likelyStructure: normalized.likelyStructure,
        searchQuerySeed: normalized.searchQuerySeed,
        ...(normalized.dimensions ? { dimensions: normalized.dimensions } : {}),
      },
      sdkMeta: result.meta,
    }),
  }
}

export const grade: Grader = async ({ input, output, metadata }) => {
  const task = Array.isArray(input) ? input.join('\n') : input
  const meta = (metadata ?? {}) as Record<string, unknown>
  const result = await invokeJudge(buildJudgePrompt({ task, output, metadata: meta }))
  return toGraderResult(result)
}
