/**
 * Gemini judge for bounded runtime-improvement experiments.
 *
 * @remarks
 * Scores a candidate change on:
 * - impact on the stated goal
 * - focus/scope discipline
 * - safety/regression risk
 */

import type { Grader, GraderResult } from '../src/tools/trial.schemas.ts'

type JudgeOutput = {
  score: number
  pass: boolean
  reasoning: string
  dimensions?: {
    impact: number
    focus: number
    safety: number
  }
}

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

  return `You are judging a repo-improvement experiment for a personal modnet agent runtime.

Task:
${task}

Model summary:
${output}

Changed files:
${changedFiles}

Diff stat:
${diffStat}

Check results:
${checks}

Patch excerpt:
${patch.slice(0, 10000)}

Score the change from 0.0 to 1.0 on:
- impact: does it materially improve the stated goal?
- focus: is it tightly scoped and not broadened unnecessarily?
- safety: does it look low-risk given the checks and diff?

Pass only if the candidate looks genuinely useful and safe.

Return ONLY JSON:
{"score":0.0,"pass":false,"reasoning":"...","dimensions":{"impact":0.0,"focus":0.0,"safety":0.0}}`
}

const invokeGeminiJudge = async (prompt: string): Promise<JudgeOutput> => {
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

    const parsed = JSON.parse(judgeJson) as JudgeOutput
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
  const result = await invokeGeminiJudge(buildJudgePrompt({ task, output, metadata: meta }))

  return {
    pass: result.pass,
    score: result.score,
    reasoning: result.reasoning,
    ...(result.dimensions
      ? {
          metadata: { dimensions: result.dimensions },
        }
      : {}),
  }
}
