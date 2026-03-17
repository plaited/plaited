/**
 * Gemini CLI adapter for bounded agent-runtime improvement experiments.
 */

import type { Adapter, TrajectoryStep } from '../src/improve/trial.schemas.ts'

const SYSTEM_PROMPT = `You are improving a personal modnet agent runtime.

Priorities:
- tighten the runtime around personal-node and self-improvement goals
- remove stale code when deletion is clearly safer
- keep infra that directly supports local models or bounded eval loops

Rules:
- keep edits bounded to the task
- prefer smaller diffs
- finish changes end-to-end
- summarize concrete code changes in the final output
`

export const adapt: Adapter = async ({ prompt, cwd }) => {
  const text = Array.isArray(prompt) ? prompt.join('\n') : prompt
  const start = Date.now()
  const fullPrompt = `${SYSTEM_PROMPT}\n\nTask:\n${text}`

  const proc = Bun.spawn(['gemini', '-p', fullPrompt, '--yolo', '--output-format', 'stream-json'], {
    cwd: cwd ?? process.cwd(),
    stdout: 'pipe',
    stderr: 'ignore',
  })

  const [raw, exitCode] = await Promise.all([new Response(proc.stdout).text(), proc.exited])
  const elapsed = Date.now() - start

  const events = raw
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line) as Record<string, unknown>
      } catch {
        return null
      }
    })
    .filter((event): event is Record<string, unknown> => event !== null)

  const trajectory: TrajectoryStep[] = []
  let output = ''

  for (const event of events) {
    const timestamp = Date.now()

    if (event.type === 'final_response') {
      const finalText = event.text ?? event.content ?? event.result
      if (typeof finalText === 'string') output = finalText
      continue
    }

    if (event.type === 'response') {
      const delta = event.delta as Record<string, unknown> | undefined
      const chunk = delta?.text ?? delta?.content
      if (typeof chunk === 'string') {
        output += chunk
        trajectory.push({ type: 'message', content: chunk, timestamp })
      }
      continue
    }

    if (event.type === 'tool_call') {
      trajectory.push({
        type: 'tool_call',
        name: (event.name as string) ?? 'unknown',
        status: 'pending',
        input: event.args ?? event.input,
        timestamp,
      })
      continue
    }

    if (event.type === 'tool_result' || event.type === 'tool_response') {
      const pendingCall = [...trajectory].reverse().find((step) => step.type === 'tool_call' && step.status === 'pending')
      if (pendingCall && pendingCall.type === 'tool_call') {
        pendingCall.status = event.error ? 'failed' : 'completed'
        pendingCall.output = JSON.stringify(event.result ?? event.output ?? event.content)
      }
      continue
    }

    const fallback = event.text ?? event.content
    if (typeof fallback === 'string' && fallback.trim()) {
      output = fallback
    }
  }

  if (!output && raw.trim() && exitCode === 0) {
    output = raw.trim()
  }

  return {
    output,
    trajectory: trajectory.length > 0 ? trajectory : undefined,
    timing: { total: elapsed },
    exitCode,
    timedOut: exitCode === 124,
  }
}
