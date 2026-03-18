/**
 * Claude Haiku meta-verifier for bounded Plaited development slices.
 *
 * @remarks
 * Reviews the primary judge output plus diff/check context and returns a
 * second-pass grader result used to confirm or challenge keep decisions.
 */

import type { Grader, GraderResult } from '../src/improve.ts'

type MetaJudgeOutput = {
  pass: boolean
  score: number
  reasoning: string
  dimensions?: {
    consistency: number
    risk: number
    confidence: number
  }
}

const CLAUDE_META_MODEL = 'haiku'

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
  const candidateOutput = typeof metadata?.candidateOutput === 'string' ? metadata.candidateOutput : '(missing candidate output)'

  return `You are meta-verifying an LLM judge decision for a bounded Plaited framework-development slice.

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
  ...(result.dimensions
    ? {
        outcome: {
          metaVerificationDimensions: result.dimensions,
        },
      }
    : {}),
})

const parseMetaOutput = (raw: string): MetaJudgeOutput => {
  const envelope = JSON.parse(raw) as Record<string, unknown>
  const structured = envelope.structured_output
  const result = envelope.result
  const payload = structured ?? result ?? envelope

  const parsed =
    typeof payload === 'string'
      ? (JSON.parse(payload) as MetaJudgeOutput)
      : (payload as MetaJudgeOutput)

  return {
    pass: typeof parsed.pass === 'boolean' ? parsed.pass : false,
    score: typeof parsed.score === 'number' ? Math.max(0, Math.min(1, parsed.score)) : 0,
    reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : '',
    dimensions: parsed.dimensions,
  }
}

const invokeClaudeMetaVerifier = async (prompt: string): Promise<MetaJudgeOutput> => {
  const claudePath = await Bun.which('claude')
  if (!claudePath) {
    return { pass: false, score: 0, reasoning: 'Claude CLI not available' }
  }

  try {
    const proc = Bun.spawn(
      [
        'claude',
        '-p',
        '--model',
        CLAUDE_META_MODEL,
        '--output-format',
        'json',
        '--tools',
        '',
        '--json-schema',
        JSON.stringify(MetaJudgeOutputSchema),
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
    if (!raw) return { pass: false, score: 0, reasoning: 'Claude meta verifier returned empty response' }

    return parseMetaOutput(raw)
  } catch (error) {
    return {
      pass: false,
      score: 0,
      reasoning: error instanceof Error ? `Claude meta verifier parse error: ${error.message}` : String(error),
    }
  }
}

export const grade: Grader = async ({ input, output, metadata }): Promise<GraderResult> => {
  const task = Array.isArray(input) ? input.join('\n') : input
  const meta = (metadata ?? {}) as Record<string, unknown>
  const result = await invokeClaudeMetaVerifier(buildMetaPrompt({ task, output, metadata: meta }))

  return toGraderResult(result)
}
