/**
 * Claude Haiku meta-verifier for bounded Plaited development slices.
 *
 * @remarks
 * Reviews the primary judge output plus diff/check context and returns a
 * second-pass grader result used to confirm or challenge keep decisions.
 */

import type { Grader, GraderResult } from '../src/improve.ts'
import { runStructuredClaudeQuery } from './claude-agent-sdk.ts'

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

const CLAUDE_META_MODEL = 'claude-haiku-4-5-20251001'

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

export const toGraderResult = (result: MetaJudgeOutput): GraderResult => ({
  pass: result.pass,
  score: result.score,
  reasoning: result.reasoning,
  ...(result.outcome
    ? {
        outcome: result.outcome,
      }
    : {}),
})

const invokeClaudeMetaVerifier = async (prompt: string): Promise<MetaJudgeOutput> => {
  const result = await runStructuredClaudeQuery<MetaJudgeOutput>({
    model: CLAUDE_META_MODEL,
    prompt,
    schema: MetaJudgeOutputSchema,
  })

  if (!result.ok) {
    return {
      pass: false,
      score: 0,
      reasoning: `Claude meta verifier SDK error: ${result.reason}`,
      ...(result.meta
        ? {
            outcome: {
              metaVerificationSdk: result.meta,
            },
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
          outcome: {
            ...(result.value.dimensions ? { metaVerificationDimensions: result.value.dimensions } : {}),
            ...(result.meta ? { metaVerificationSdk: result.meta } : {}),
          },
        }
      : {}),
  }
}

export const grade: Grader = async ({ input, output, metadata }): Promise<GraderResult> => {
  const task = Array.isArray(input) ? input.join('\n') : input
  const meta = (metadata ?? {}) as Record<string, unknown>
  const result = await invokeClaudeMetaVerifier(buildMetaPrompt({ task, output, metadata: meta }))

  return toGraderResult(result)
}
