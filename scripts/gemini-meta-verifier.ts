/**
 * Gemini meta-verifier for bounded Plaited development slices.
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

Pass only if the primary judge result looks internally consistent and safe to trust.

Return ONLY JSON:
{"score":0.0,"pass":false,"reasoning":"...","dimensions":{"consistency":0.0,"risk":0.0,"confidence":0.0}}`
}

const invokeGeminiMetaVerifier = async (prompt: string): Promise<MetaJudgeOutput> => {
  const geminiPath = await Bun.which('gemini')
  if (!geminiPath) {
    return { score: 0, pass: false, reasoning: 'Gemini CLI not available' }
  }

  try {
    const proc = Bun.spawn(['gemini', '-p', prompt, '--output-format', 'json'], {
      stdout: 'pipe',
      stderr: 'ignore',
    })
    const timeout = setTimeout(() => proc.kill(), 60_000)
    const [stdout] = await Promise.all([new Response(proc.stdout).text(), proc.exited])
    clearTimeout(timeout)

    const raw = stdout.trim()
    if (!raw) return { score: 0, pass: false, reasoning: 'Gemini returned empty response' }

    let judgeJson = raw
    try {
      const envelope = JSON.parse(raw) as Record<string, unknown>
      const candidates = envelope.candidates as Array<{ content?: { parts?: Array<{ text?: string }> } }> | undefined
      const text = candidates?.[0]?.content?.parts?.[0]?.text
        ?? (envelope.text as string | undefined)
        ?? (envelope.response as string | undefined)
      if (text) judgeJson = text.trim()
    } catch {
      // raw output is already the JSON payload
    }

    const parsed = JSON.parse(judgeJson) as MetaJudgeOutput
    return {
      score: typeof parsed.score === 'number' ? Math.max(0, Math.min(1, parsed.score)) : 0,
      pass: typeof parsed.pass === 'boolean' ? parsed.pass : false,
      reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : '',
      dimensions: parsed.dimensions,
    }
  } catch (error) {
    return {
      score: 0,
      pass: false,
      reasoning: error instanceof Error ? error.message : String(error),
    }
  }
}

export const grade: Grader = async ({ input, output, metadata }): Promise<GraderResult> => {
  const task = Array.isArray(input) ? input.join('\n') : input
  const meta = (metadata ?? {}) as Record<string, unknown>
  const result = await invokeGeminiMetaVerifier(buildMetaPrompt({ task, output, metadata: meta }))

  return toGraderResult(result)
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
