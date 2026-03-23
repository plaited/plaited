import type { Grader, GraderResult } from '../src/improve.ts'
import { RepoImprovementJudgeInputSchema, RepoImprovementMetaVerifierOutcomeSchema } from '../src/improve.ts'
import { runStructuredMetaVerifierQuery } from './meta-verifier-runtime.ts'

type MetaJudgeOutput = {
  pass: boolean
  score: number
  reasoning: string
  outcome?: Record<string, unknown>
  dimensions?: {
    consistency: number
    risk: number
    confidence: number
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

const buildMetaPrompt = ({
  task,
  output,
  metadata,
}: {
  task: string
  output: string
  metadata?: Record<string, unknown>
}) => {
  const changedFiles = Array.isArray(metadata?.changedFiles) ? metadata.changedFiles.join('\n') : '(unknown)'
  const diffStat = typeof metadata?.diffStat === 'string' ? metadata.diffStat : '(none)'
  const patch = typeof metadata?.patch === 'string' ? metadata.patch : '(none)'
  const checks = JSON.stringify(metadata?.checks ?? {}, null, 2)
  const candidateOutput =
    typeof metadata?.candidateOutput === 'string' ? metadata.candidateOutput : '(missing candidate output)'
  const program = typeof metadata?.program === 'string' ? metadata.program : '(missing program)'
  const slice = typeof metadata?.slice === 'string' ? metadata.slice : '(missing slice)'

  RepoImprovementJudgeInputSchema.parse({
    evaluationTarget: 'repo-improvement',
    task,
    candidateOutput,
    changedFiles: Array.isArray(metadata?.changedFiles)
      ? metadata.changedFiles.filter((value): value is string => typeof value === 'string')
      : [],
    diffStat,
    patch,
    checks: (metadata?.checks ?? {}) as Record<string, unknown>,
    program,
    slice,
  })

  return `You are meta-verifying an LLM judge decision for a bounded Plaited framework-development slice.

Program:
${program}

Slice:
${slice}

Task:
${task}

Primary judge result:
${output}

Candidate summary:
${candidateOutput}

Changed files:
${changedFiles}

Diff stat:
${diffStat}

Checks:
${checks}

Patch excerpt:
${patch.slice(0, 12000)}

Score the primary judge result from 0.0 to 1.0 on:
- consistency: does the reasoning match the actual diff and checks?
- risk: does the candidate still look safe despite any optimistic judging?
- confidence: how much should the harness trust the primary judge?

Pass only if the primary judge result looks internally consistent and safe to trust.`
}

const buildOutcome = ({
  dimensions,
  outcome,
  sdkMeta,
}: {
  dimensions?: MetaJudgeOutput['dimensions']
  outcome?: Record<string, unknown>
  sdkMeta?: Record<string, unknown>
}) => {
  const contract = RepoImprovementMetaVerifierOutcomeSchema.parse({
    evaluationTarget: 'repo-improvement',
    judgeKind: 'repo-improvement-meta-verifier',
    ...(dimensions ? { rubric: dimensions } : {}),
    ...(sdkMeta ? { metaVerificationSdk: sdkMeta } : {}),
  })

  return {
    ...outcome,
    ...contract,
    ...(dimensions ? { metaVerificationDimensions: dimensions } : {}),
    ...(sdkMeta ? { metaVerificationSdk: sdkMeta } : {}),
  }
}

export const toGraderResult = (result: MetaJudgeOutput): GraderResult => ({
  pass: result.pass,
  score: result.score,
  reasoning: result.reasoning,
  ...(result.outcome || result.dimensions
    ? {
        outcome: buildOutcome({
          dimensions: result.dimensions,
          outcome: result.outcome,
        }),
      }
    : {}),
})

const invokeMetaVerifier = async (prompt: string): Promise<MetaJudgeOutput> => {
  const result = await runStructuredMetaVerifierQuery<MetaJudgeOutput>({
    prompt,
    schema: MetaJudgeOutputSchema,
  })

  if (!result.ok) {
    return {
      pass: false,
      score: 0,
      reasoning: `Meta verifier SDK error: ${result.reason}`,
      ...(result.meta
        ? {
            outcome: buildOutcome({
              sdkMeta: result.meta,
            }),
          }
        : {}),
    }
  }

  return {
    pass: typeof result.value.pass === 'boolean' ? result.value.pass : false,
    score: typeof result.value.score === 'number' ? Math.max(0, Math.min(1, result.value.score)) : 0,
    reasoning: typeof result.value.reasoning === 'string' ? result.value.reasoning : '',
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
