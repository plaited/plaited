/**
 * Claude Code adapter for bounded agent-runtime improvement experiments.
 *
 * @remarks
 * This keeps the old adapter contract but replaces the module-generation
 * prompt with a product-specific instruction set:
 * personal modnet agent runtime, self-improvement, narrower surface area,
 * delete stale code instead of archiving it.
 */

import type { Adapter, TrajectoryStep } from '../src/improve/trial.schemas.ts'

const SYSTEM_PROMPT = `You are improving a personal modnet agent runtime.

Priorities:
1. Strengthen the runtime for a sovereign personal agent node.
2. Improve self-improvement and autoresearch support.
3. Remove code that does not serve those goals.

Rules:
- Prefer deletion over archival for stale code.
- Keep infra, but do not preserve obsolete eval families.
- Do not introduce broad abstractions unless they directly reduce complexity.
- Keep changes bounded to the task prompt.
- Preserve Bun-native patterns.
- If you modify code, finish the change end-to-end and leave the repo in a testable state.
- Summarize what you changed in the final response.
`

export const adapt: Adapter = async ({ prompt, cwd }) => {
  const text = Array.isArray(prompt) ? prompt.join('\n') : prompt
  const start = Date.now()
  const args = [
    'claude',
    '-p',
    '--dangerously-skip-permissions',
    '--verbose',
    '--output-format',
    'stream-json',
    '--max-turns',
    '60',
    '--append-system-prompt',
    SYSTEM_PROMPT,
    text,
  ]

  const { ANTHROPIC_API_KEY: _, CLAUDE_CODE_ENTRYPOINT: __, CLAUDECODE: ___, ...spawnEnv } = process.env
  const proc = Bun.spawn(args, {
    cwd: cwd ?? process.cwd(),
    stdout: 'pipe',
    stderr: 'ignore',
    env: spawnEnv as Record<string, string>,
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
  let inputTokens = 0
  let outputTokens = 0

  for (const event of events) {
    const timestamp = Date.now()

    if (event.type === 'result') {
      if (typeof event.result === 'string') output = event.result
      const usage = event.usage as Record<string, number> | undefined
      if (usage) {
        inputTokens += usage.input_tokens ?? 0
        outputTokens += usage.output_tokens ?? 0
      }
      continue
    }

    if (event.type === 'assistant') {
      const message = event.message as Record<string, unknown> | undefined
      const content = message?.content as Array<Record<string, unknown>> | undefined
      if (!content) continue

      for (const block of content) {
        if (block.type === 'thinking' && typeof block.thinking === 'string') {
          trajectory.push({ type: 'thought', content: block.thinking, timestamp })
        }
        if (block.type === 'text' && typeof block.text === 'string') {
          trajectory.push({ type: 'message', content: block.text, timestamp })
        }
        if (block.type === 'tool_use') {
          trajectory.push({
            type: 'tool_call',
            name: (block.name as string) ?? 'unknown',
            status: 'pending',
            input: block.input,
            timestamp,
          })
        }
      }

      const usage = message?.usage as Record<string, number> | undefined
      if (usage) {
        inputTokens += usage.input_tokens ?? 0
        outputTokens += usage.output_tokens ?? 0
      }
      continue
    }

    if (event.type === 'user') {
      const message = event.message as Record<string, unknown> | undefined
      const content = message?.content as Array<Record<string, unknown>> | undefined
      if (!content) continue

      for (const block of content) {
        if (block.type === 'tool_result') {
          const pendingCall = [...trajectory].reverse().find((step) => step.type === 'tool_call' && step.status === 'pending')
          if (pendingCall && pendingCall.type === 'tool_call') {
            pendingCall.status = block.is_error ? 'failed' : 'completed'
            pendingCall.output = typeof block.content === 'string' ? block.content : JSON.stringify(block.content)
          }
        }
      }
    }
  }

  return {
    output: output || '',
    trajectory: trajectory.length > 0 ? trajectory : undefined,
    timing: {
      total: elapsed,
      ...(inputTokens > 0 ? { inputTokens } : {}),
      ...(outputTokens > 0 ? { outputTokens } : {}),
    },
    exitCode,
    timedOut: exitCode === 124,
  }
}
