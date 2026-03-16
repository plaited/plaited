/**
 * Proactive node adapter — spawns `claude -p` with workspace isolation
 * and proactive artifact guidance for sensor/goal/notification evaluation.
 *
 * @remarks
 * Loads `skills/proactive-node/SKILL.md` as the `--append-system-prompt`
 * so that calibration edits to the skill flow directly into eval behavior.
 * The adapter otherwise mirrors `claude-code.ts` — same stream-json parsing,
 * same env stripping, same trajectory capture.
 *
 * @packageDocumentation
 */

import { resolve } from 'node:path'
import type { Adapter, TrajectoryStep } from '../trial.schemas.ts'

// ============================================================================
// Skill Path
// ============================================================================

const SKILL_PATH = resolve(import.meta.dir, '../../../skills/proactive-node/SKILL.md')

// ============================================================================
// Adapter
// ============================================================================

/**
 * Claude Code adapter for proactive node artifact evaluation.
 *
 * @remarks
 * Spawns `claude -p` with `--dangerously-skip-permissions` for automated
 * file generation and `--append-system-prompt` loaded from SKILL.md.
 * Claude writes TypeScript files to the workspace cwd; the proactive-grader
 * reads them via `collectSource(cwd)` for full structural analysis.
 *
 * @public
 */
export const adapt: Adapter = async ({ prompt, cwd }) => {
  const text = Array.isArray(prompt) ? prompt.join('\n') : prompt
  const start = Date.now()

  // Load SKILL.md at runtime — calibration updates the skill, which flows into eval
  const skillContent = await Bun.file(SKILL_PATH).text()

  const args = [
    'claude',
    '-p',
    '--dangerously-skip-permissions',
    '--verbose',
    '--output-format',
    'stream-json',
    '--max-turns',
    '30',
    '--append-system-prompt',
    skillContent,
    text,
  ]

  // Strip session-scoped keys so the subprocess uses ~/.claude/ OAuth credentials
  const { ANTHROPIC_API_KEY: _, CLAUDE_CODE_ENTRYPOINT: __, CLAUDECODE: ___, ...spawnEnv } = process.env

  const proc = Bun.spawn(args, {
    cwd: cwd ?? process.cwd(),
    stdout: 'pipe',
    stderr: 'ignore',
    env: spawnEnv as Record<string, string>,
  })

  const [raw, exitCode] = await Promise.all([new Response(proc.stdout).text(), proc.exited])
  const elapsed = Date.now() - start

  // Parse NDJSON events
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
    .filter((e): e is Record<string, unknown> => e !== null)

  // Build trajectory and extract output
  const trajectory: TrajectoryStep[] = []
  let output = ''
  let inputTokens = 0
  let outputTokens = 0

  for (const event of events) {
    const ts = Date.now()

    // Result event — final output and token usage
    if (event.type === 'result') {
      if (typeof event.result === 'string') output = event.result
      const usage = event.usage as Record<string, number> | undefined
      if (usage) {
        inputTokens += usage.input_tokens ?? 0
        outputTokens += usage.output_tokens ?? 0
      }
      continue
    }

    // Assistant message — contains text, thinking, tool_use blocks
    if (event.type === 'assistant') {
      const msg = event.message as Record<string, unknown> | undefined
      const content = msg?.content as Array<Record<string, unknown>> | undefined
      if (!content) continue

      for (const block of content) {
        if (block.type === 'thinking' && typeof block.thinking === 'string') {
          trajectory.push({ type: 'thought', content: block.thinking, timestamp: ts })
        }
        if (block.type === 'text' && typeof block.text === 'string') {
          trajectory.push({ type: 'message', content: block.text, timestamp: ts })
        }
        if (block.type === 'tool_use') {
          trajectory.push({
            type: 'tool_call',
            name: (block.name as string) ?? 'unknown',
            status: 'pending',
            input: block.input,
            timestamp: ts,
          })
        }
      }

      // Accumulate usage from per-turn messages
      const usage = msg?.usage as Record<string, number> | undefined
      if (usage) {
        inputTokens += usage.input_tokens ?? 0
        outputTokens += usage.output_tokens ?? 0
      }
      continue
    }

    // Tool result events
    if (event.type === 'user') {
      const msg = event.message as Record<string, unknown> | undefined
      const content = msg?.content as Array<Record<string, unknown>> | undefined
      if (!content) continue

      for (const block of content) {
        if (block.type === 'tool_result') {
          const isError = block.is_error as boolean | undefined
          const resultContent = typeof block.content === 'string' ? block.content : JSON.stringify(block.content)

          const pendingCall = [...trajectory].reverse().find((s) => s.type === 'tool_call' && s.status === 'pending')
          if (pendingCall && pendingCall.type === 'tool_call') {
            pendingCall.status = isError ? 'failed' : 'completed'
            pendingCall.output = resultContent
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
      ...(inputTokens > 0 && { inputTokens }),
      ...(outputTokens > 0 && { outputTokens }),
    },
    exitCode,
    timedOut: exitCode === 124,
  }
}
