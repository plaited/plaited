/**
 * Codex CLI adapter for bounded Plaited development experiments.
 *
 * @remarks
 * Runs `codex exec --json` non-interactively and maps the JSONL stream onto
 * the shared improve-layer adapter contract.
 */

import type { Adapter, TrajectoryStep } from '../src/improve.ts'

const CODEX_ADAPTER_TIMEOUT_MS = 10 * 60_000

type CodexJsonEvent =
  | { type: 'thread.started'; thread_id?: string }
  | { type: 'turn.started' }
  | { type: 'item.completed'; item: { id?: string; type?: string; text?: string } }
  | {
      type: 'turn.completed'
      usage?: { input_tokens?: number; cached_input_tokens?: number; output_tokens?: number }
    }

export const parseCodexExecJsonl = (
  raw: string,
): {
  output: string
  trajectory?: TrajectoryStep[]
  inputTokens?: number
  outputTokens?: number
} => {
  const trajectory: TrajectoryStep[] = []
  let output = ''
  let inputTokens = 0
  let outputTokens = 0

  const events = raw
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line) as CodexJsonEvent
      } catch {
        return null
      }
    })
    .filter((event): event is CodexJsonEvent => event !== null)

  for (const event of events) {
    const timestamp = Date.now()

    if (event.type === 'item.completed' && event.item.type === 'agent_message' && typeof event.item.text === 'string') {
      output = event.item.text
      trajectory.push({
        type: 'message',
        content: event.item.text,
        timestamp,
      })
      continue
    }

    if (event.type === 'turn.completed') {
      inputTokens += event.usage?.input_tokens ?? 0
      outputTokens += event.usage?.output_tokens ?? 0
    }
  }

  return {
    output,
    ...(trajectory.length > 0 ? { trajectory } : {}),
    ...(inputTokens > 0 ? { inputTokens } : {}),
    ...(outputTokens > 0 ? { outputTokens } : {}),
  }
}

const SYSTEM_PROMPT = `You are improving Plaited itself, not adding a shipped product feature.

Priorities:
1. Strengthen the runtime for a sovereign personal agent node.
2. Improve the developer-side autoresearch loop for bounded framework work.
3. Keep changes tightly scoped to the declared slice.

Rules:
- Follow the architecture and slice files exactly.
- Prefer small bounded edits over broad rewrites.
- Preserve Bun-native patterns.
- Leave the repo in a testable state.
- Summarize what changed in the final response.
`

export const adapt: Adapter = async ({ prompt, cwd }) => {
  const text = Array.isArray(prompt) ? prompt.join('\n') : prompt
  const start = Date.now()

  const proc = Bun.spawn(
    [
      'codex',
      'exec',
      '--json',
      '--sandbox',
      'workspace-write',
      '-C',
      cwd ?? process.cwd(),
      `${SYSTEM_PROMPT}\n\n${text}`,
    ],
    {
      cwd: cwd ?? process.cwd(),
      stdout: 'pipe',
      stderr: 'pipe',
      env: process.env as Record<string, string>,
    },
  )

  const timeout = setTimeout(() => proc.kill(), CODEX_ADAPTER_TIMEOUT_MS)

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])
  clearTimeout(timeout)

  const elapsed = Date.now() - start
  const parsed = parseCodexExecJsonl(stdout)

  return {
    output: parsed.output,
    ...(parsed.trajectory ? { trajectory: parsed.trajectory } : {}),
    timing: {
      total: elapsed,
      ...(parsed.inputTokens !== undefined ? { inputTokens: parsed.inputTokens } : {}),
      ...(parsed.outputTokens !== undefined ? { outputTokens: parsed.outputTokens } : {}),
    },
    exitCode,
    timedOut: exitCode === 124 || elapsed >= CODEX_ADAPTER_TIMEOUT_MS,
    ...(exitCode !== 0 && stderr.trim()
      ? {
          output: parsed.output || stderr.trim(),
        }
      : {}),
  }
}
