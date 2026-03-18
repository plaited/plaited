/**
 * Claude Code judge for bounded Plaited development slices.
 *
 * @remarks
 * Reviews a candidate diff against the active program/slice contract and
 * returns a schema-valid grader result for the dev autoresearch harness.
 */

import type { Grader, GraderResult } from '../src/improve.ts'
import { runStructuredClaudeQuery } from './claude-agent-sdk.ts'

type JudgeOutput = {
  pass: boolean
  score: number
  reasoning: string
  dimensions?: {
    architecture: number
    boundedness: number
    focus: number
    quality: number
  }
}

const CLAUDE_PRIMARY_MODEL = 'claude-sonnet-4-6'

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
      required: ['architecture', 'boundedness', 'focus', 'quality'],
      properties: {
        architecture: { type: 'number', minimum: 0, maximum: 1 },
        boundedness: { type: 'number', minimum: 0, maximum: 1 },
        focus: { type: 'number', minimum: 0, maximum: 1 },
        quality: { type: 'number', minimum: 0, maximum: 1 },
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
  const changedFiles = Array.isArray(metadata?.changedFiles) ? metadata.changedFiles.join('\n') : '(unknown)'
  const diffStat = typeof metadata?.diffStat === 'string' ? metadata.diffStat : '(none)'
  const patch = typeof metadata?.patch === 'string' ? metadata.patch : '(none)'
  const checks = JSON.stringify(metadata?.checks ?? {}, null, 2)
  const program = typeof metadata?.program === 'string' ? metadata.program : '(missing program)'
  const slice = typeof metadata?.slice === 'string' ? metadata.slice : '(missing slice)'

  return `You are reviewing a bounded Plaited framework-development slice.

This is developer tooling for improving Plaited itself, not a shipped runtime feature.

Program:
${program}

Slice:
${slice}

Task:
${task}

Candidate summary:
${output}

Changed files:
${changedFiles}

Diff stat:
${diffStat}

Checks:
${checks}

Patch excerpt:
${patch.slice(0, 12000)}

Score the candidate from 0.0 to 1.0 on:
- architecture: does it preserve the fixed architecture and avoid drift?
- boundedness: does it stay tightly within the declared slice?
- focus: does it materially address the intended slice target rather than merely staying in-bounds?
- quality: is the code clear, coherent, and low-risk?

Pass only if the candidate should be kept after review.`
}

export const toGraderResult = (result: JudgeOutput): GraderResult => ({
  pass: result.pass,
  score: result.score,
  reasoning: result.reasoning,
  ...(result.dimensions
    ? {
        outcome: {
          judgeDimensions: result.dimensions,
        },
      }
    : {}),
})

const invokeClaudeJudge = async (prompt: string): Promise<JudgeOutput> => {
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
    }
  }

  return {
    pass: typeof result.value.pass === 'boolean' ? result.value.pass : false,
    score: typeof result.value.score === 'number' ? Math.max(0, Math.min(1, result.value.score)) : 0,
    reasoning: typeof result.value.reasoning === 'string' ? result.value.reasoning : '',
    dimensions: result.value.dimensions,
  }
}

export const grade: Grader = async ({ input, output, metadata }) => {
  const task = Array.isArray(input) ? input.join('\n') : input
  const meta = (metadata ?? {}) as Record<string, unknown>
  const result = await invokeClaudeJudge(buildJudgePrompt({ task, output, metadata: meta }))
  return toGraderResult(result)
}
