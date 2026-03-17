/**
 * Gemini CLI LLM-as-judge — semantic evaluation of generated modules.
 *
 * @remarks
 * Uses `gemini -p "..." --output-format json` via Bun.$ to score a
 * generated module against its prompt requirements. Part of Phase 4
 * layered boot verification (Layer 4: semantic verification).
 *
 * Prompt construction uses the module's eval_ref dimensions (intention,
 * static, dynamic) as a checklist. The judge scores each dimension
 * independently and returns a composite score.
 *
 * Usage:
 * ```bash
 * # Direct use (not typical — the layered-boot eval orchestrates this)
 * bun scripts/gemini-judge.ts
 * ```
 *
 * @packageDocumentation
 */

import type { Grader, GraderResult } from '../src/tools/trial.schemas.ts'

// ============================================================================
// Judge output type
// ============================================================================

type JudgeDimensions = {
  intention: number
  static: number
  dynamic: number
}

type JudgeOutput = {
  score: number
  pass: boolean
  reasoning: string
  dimensions?: JudgeDimensions
}

// ============================================================================
// Judge prompt builder
// ============================================================================

const buildJudgePrompt = (
  taskDescription: string,
  generatedOutput: string,
  evalRef?: {
    intention?: string[]
    static?: string[]
    dynamic?: string[]
  },
): string => {
  const intentionChecks = evalRef?.intention?.map((s) => `- ${s}`).join('\n') ?? ''
  const staticChecks = evalRef?.static?.map((s) => `- ${s}`).join('\n') ?? ''
  const dynamicChecks = evalRef?.dynamic?.map((s) => `- ${s}`).join('\n') ?? ''

  return `You are evaluating a generated software module against requirements. Be strict but fair.

## Task Description
${taskDescription}

## Expected Behaviors

### Intention (Functional Requirements)
${intentionChecks || '(none specified)'}

### Static Quality (Code Structure)
${staticChecks || '(none specified)'}

### Dynamic Behavior (Runtime Interactions)
${dynamicChecks || '(none specified)'}

## Generated Output
<output>
${generatedOutput.slice(0, 8000)}${generatedOutput.length > 8000 ? '\n...[truncated]' : ''}
</output>

## Evaluation Instructions

Score each dimension 0.0–1.0 based on how well the output satisfies the requirements.
- 1.0 = fully satisfies all requirements in the dimension
- 0.7+ = satisfies most requirements (pass threshold)
- 0.5 = satisfies about half
- 0.0 = does not satisfy requirements

The composite score = (intention + static + dynamic) / 3.
Pass = composite >= 0.70.

Output ONLY a JSON object with no explanation, no markdown, no surrounding text:
{"score":<0.0-1.0>,"pass":<true/false>,"reasoning":"<one sentence>","dimensions":{"intention":<0.0-1.0>,"static":<0.0-1.0>,"dynamic":<0.0-1.0>}}`
}

// ============================================================================
// Invoke Gemini CLI judge
// ============================================================================

/**
 * Call Gemini CLI in headless mode to score a generated module.
 *
 * @remarks
 * Spawns `gemini -p "..." --output-format json` and parses the result.
 * Returns a default low score if Gemini is unavailable or fails.
 *
 * @internal
 */
const invokeGeminiJudge = async (judgePrompt: string): Promise<JudgeOutput> => {
  const geminiAvailable = !!(await Bun.which('gemini'))
  if (!geminiAvailable) {
    return { score: 0, pass: false, reasoning: 'Gemini CLI not available' }
  }

  try {
    const proc = Bun.spawn(['gemini', '-p', judgePrompt, '--output-format', 'json'], {
      stdout: 'pipe',
      stderr: 'ignore',
    })
    const timeoutId = setTimeout(() => proc.kill(), 60000)
    const [stdout, exitCode] = await Promise.all([new Response(proc.stdout).text(), proc.exited])
    clearTimeout(timeoutId)
    const result = { stdout, exitCode }

    const raw = result.stdout.trim()
    if (!raw) {
      return { score: 0, pass: false, reasoning: 'Gemini returned empty response' }
    }

    // Gemini -o json wraps the model response in a JSON envelope
    // Try to extract our inner JSON from the envelope
    let judgeJson: string = raw

    try {
      const envelope = JSON.parse(raw) as Record<string, unknown>
      // Gemini CLI json format: { candidates: [{ content: { parts: [{ text: '...' }] } }] }
      // or: { text: '...' } or: { response: '...' }
      const candidates = envelope.candidates as Array<{ content?: { parts?: Array<{ text?: string }> } }> | undefined
      const text = candidates?.[0]?.content?.parts?.[0]?.text
        ?? (envelope.text as string | undefined)
        ?? (envelope.response as string | undefined)
        ?? (envelope.content as string | undefined)

      if (text) {
        judgeJson = text.trim()
        // Strip markdown fences if present
        const fenceMatch = judgeJson.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/)
        if (fenceMatch?.[1]) judgeJson = fenceMatch[1].trim()
      }
    } catch {
      // envelope parse failed — treat raw as the judge JSON directly
    }

    const parsed = JSON.parse(judgeJson) as JudgeOutput
    return {
      score: typeof parsed.score === 'number' ? Math.max(0, Math.min(1, parsed.score)) : 0,
      pass: typeof parsed.pass === 'boolean' ? parsed.pass : (parsed.score ?? 0) >= 0.7,
      reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : '',
      dimensions: parsed.dimensions,
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return { score: 0, pass: false, reasoning: `Judge error: ${msg}` }
  }
}

// ============================================================================
// Exported grader (used by layered-boot.ts)
// ============================================================================

type JudgeMetadata = {
  eval_ref?: {
    intention?: string[]
    static?: string[]
    dynamic?: string[]
  }
}

/**
 * Gemini LLM-as-judge grader for the trial runner.
 *
 * @remarks
 * Satisfies the `Grader` contract. `metadata.eval_ref` provides the rubric
 * dimensions. Falls back gracefully if Gemini CLI is unavailable.
 *
 * @public
 */
export const grade: Grader = async ({
  input,
  output,
  metadata,
}: {
  input: string | string[]
  output: string
  metadata?: unknown
}): Promise<GraderResult> => {
  const taskDescription = Array.isArray(input) ? input.join('\n') : input
  const meta = metadata as JudgeMetadata | undefined
  const judgePrompt = buildJudgePrompt(taskDescription, output, meta?.eval_ref)
  const result = await invokeGeminiJudge(judgePrompt)

  return {
    pass: result.pass,
    score: result.score,
    reasoning: result.reasoning,
    ...(result.dimensions && {
      metadata: { dimensions: result.dimensions },
    }),
  }
}
