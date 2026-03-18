/**
 * Claude Code judge for bounded Plaited development slices.
 *
 * @remarks
 * Reviews a candidate diff against the active program/slice contract and
 * returns a schema-valid grader result for the dev autoresearch harness.
 */

import type { Grader, GraderResult } from '../src/improve.ts'

type JudgeOutput = {
  pass: boolean
  score: number
  reasoning: string
  dimensions?: {
    architecture: number
    boundedness: number
    quality: number
  }
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
      required: ['architecture', 'boundedness', 'quality'],
      properties: {
        architecture: { type: 'number', minimum: 0, maximum: 1 },
        boundedness: { type: 'number', minimum: 0, maximum: 1 },
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

const parseJudgeOutput = (raw: string): JudgeOutput => {
  const envelope = JSON.parse(raw) as Record<string, unknown>
  const structured = envelope.structured_output
  const result = envelope.result
  const payload = structured ?? result ?? envelope

  const parsed =
    typeof payload === 'string'
      ? (JSON.parse(payload) as JudgeOutput)
      : (payload as JudgeOutput)

  return {
    pass: typeof parsed.pass === 'boolean' ? parsed.pass : false,
    score: typeof parsed.score === 'number' ? Math.max(0, Math.min(1, parsed.score)) : 0,
    reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : '',
    dimensions: parsed.dimensions,
  }
}

const invokeClaudeJudge = async (prompt: string): Promise<JudgeOutput> => {
  const claudePath = await Bun.which('claude')
  if (!claudePath) {
    return { pass: false, score: 0, reasoning: 'Claude CLI not available' }
  }

  try {
    const proc = Bun.spawn(
      [
        'claude',
        '-p',
        '--output-format',
        'json',
        '--tools',
        '',
        '--json-schema',
        JSON.stringify(JudgeOutputSchema),
        prompt,
      ],
      {
        stdout: 'pipe',
        stderr: 'ignore',
      },
    )

    const timeout = setTimeout(() => proc.kill(), 60_000)
    const [stdout] = await Promise.all([new Response(proc.stdout).text(), proc.exited])
    clearTimeout(timeout)

    const raw = stdout.trim()
    if (!raw) return { pass: false, score: 0, reasoning: 'Claude returned empty response' }

    return parseJudgeOutput(raw)
  } catch (error) {
    return {
      pass: false,
      score: 0,
      reasoning: error instanceof Error ? `Claude judge parse error: ${error.message}` : String(error),
    }
  }
}

export const grade: Grader = async ({ input, output, metadata }) => {
  const task = Array.isArray(input) ? input.join('\n') : input
  const meta = (metadata ?? {}) as Record<string, unknown>
  const result = await invokeClaudeJudge(buildJudgePrompt({ task, output, metadata: meta }))
  return toGraderResult(result)
}
