/**
 * Codex CLI adapter for bounded Plaited development experiments.
 *
 * @remarks
 * Runs `codex exec --json` non-interactively and maps the JSONL stream onto
 * the shared improve-layer adapter contract.
 */

import type { Adapter, CaptureEvidence, CaptureSnippet, TrajectoryStep } from '../src/improve.ts'

const CODEX_ADAPTER_TIMEOUT_MS = 10 * 60_000

type JsonRecord = Record<string, unknown>

type ParsedCodexExecJsonl = {
  output: string
  trajectory?: TrajectoryStep[]
  capture: CaptureEvidence
  inputTokens?: number
  outputTokens?: number
}

type ToolCallStep = Extract<TrajectoryStep, { type: 'tool_call' }>

const isRecord = (value: unknown): value is JsonRecord => value !== null && typeof value === 'object'

const getString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.length > 0 ? value : undefined

const getNumber = (value: unknown): number | undefined => (typeof value === 'number' ? value : undefined)

const getRecord = (value: unknown): JsonRecord | undefined => (isRecord(value) ? value : undefined)

const getArray = (value: unknown): unknown[] | undefined => (Array.isArray(value) ? value : undefined)

const truncate = (value: string, max = 240): string => (value.length <= max ? value : `${value.slice(0, max - 1)}...`)

const pushSnippet = (snippets: CaptureSnippet[], snippet: CaptureSnippet): void => {
  if (snippets.length < 8) {
    snippets.push(snippet)
  }
}

const extractItemText = (item: JsonRecord): string | undefined => {
  return getString(item.text) ?? getString(item.content) ?? getString(item.summary)
}

const extractCommandInput = (item: JsonRecord): unknown => {
  const command = getString(item.command)
  const argv = getArray(item.argv)
  if (command || argv) {
    return {
      ...(command ? { command } : {}),
      ...(argv ? { argv } : {}),
    }
  }

  return item.input
}

const extractCommandOutput = (item: JsonRecord): unknown => {
  const stdout = getString(item.stdout)
  const stderr = getString(item.stderr)
  const exitCode = getNumber(item.exit_code) ?? getNumber(item.exitCode)
  const output = {
    ...(stdout ? { stdout } : {}),
    ...(stderr ? { stderr } : {}),
    ...(exitCode !== undefined ? { exitCode } : {}),
  }

  if (Object.keys(output).length > 0) {
    return output
  }

  return item.output ?? item.result
}

const normalizeToolStatus = (item: JsonRecord): string => {
  const status = getString(item.status)
  if (status) {
    return status
  }

  const success = item.success
  if (typeof success === 'boolean') {
    return success ? 'completed' : 'failed'
  }

  return 'completed'
}

const parseToolStep = (item: JsonRecord, itemType: string, timestamp: number): ToolCallStep | undefined => {
  const explicitName = getString(item.name) ?? getString(item.tool_name)
  const hasCommandShape = itemType === 'command_execution'
  const hasToolShape = itemType.includes('tool') || explicitName !== undefined || hasCommandShape
  if (!hasToolShape) {
    return undefined
  }

  return {
    type: 'tool_call',
    name: explicitName ?? (hasCommandShape ? 'command_execution' : itemType),
    status: normalizeToolStatus(item),
    ...((hasCommandShape ? extractCommandInput(item) : item.input) !== undefined
      ? { input: hasCommandShape ? extractCommandInput(item) : item.input }
      : {}),
    ...((hasCommandShape ? extractCommandOutput(item) : (item.output ?? item.result)) !== undefined
      ? { output: hasCommandShape ? extractCommandOutput(item) : (item.output ?? item.result) }
      : {}),
    ...(getNumber(item.duration_ms) !== undefined
      ? { duration: getNumber(item.duration_ms) }
      : getNumber(item.duration) !== undefined
        ? { duration: getNumber(item.duration) }
        : {}),
    timestamp,
    ...(getString(item.id) ? { stepId: getString(item.id) } : {}),
  }
}

export const parseCodexExecJsonl = (raw: string): ParsedCodexExecJsonl => {
  const trajectory: TrajectoryStep[] = []
  const itemTypes = new Set<string>()
  const snippets: CaptureSnippet[] = []
  let output = ''
  let inputTokens = 0
  let outputTokens = 0
  let messageCount = 0
  let thoughtCount = 0
  let toolCallCount = 0
  let threadId: string | undefined
  let turnCount = 0

  const events = raw
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line) as JsonRecord
      } catch {
        return null
      }
    })
    .filter((event): event is JsonRecord => event !== null)

  for (const event of events) {
    const eventType = getString(event.type)
    if (!eventType) {
      continue
    }

    const timestamp = Date.now()

    if (eventType === 'thread.started') {
      threadId = getString(event.thread_id)
      pushSnippet(snippets, { kind: 'event', text: 'thread.started' })
      continue
    }

    if (eventType === 'turn.started') {
      turnCount += 1
      pushSnippet(snippets, { kind: 'event', text: 'turn.started' })
      continue
    }

    if (eventType === 'item.completed') {
      const item = getRecord(event.item)
      if (!item) {
        continue
      }

      const itemType = getString(item.type) ?? 'unknown'
      itemTypes.add(itemType)
      const stepId = getString(item.id)
      const text = extractItemText(item)

      if (
        itemType === 'agent_message' ||
        itemType === 'assistant_message' ||
        (getString(item.role) === 'assistant' && text)
      ) {
        if (text) {
          output = text
          messageCount += 1
          trajectory.push({
            type: 'message',
            content: text,
            timestamp,
            ...(stepId ? { stepId } : {}),
          })
          pushSnippet(snippets, { kind: 'message', text: truncate(text) })
        }
        continue
      }

      if (itemType.includes('reason') || itemType.includes('thought')) {
        if (text) {
          thoughtCount += 1
          trajectory.push({
            type: 'thought',
            content: text,
            timestamp,
            ...(stepId ? { stepId } : {}),
          })
          pushSnippet(snippets, { kind: 'thought', text: truncate(text) })
        }
        continue
      }

      const toolStep = parseToolStep(item, itemType, timestamp)
      if (toolStep) {
        toolCallCount += 1
        trajectory.push(toolStep)
        pushSnippet(snippets, {
          kind: 'tool_call',
          text: `${toolStep.name}:${toolStep.status}`,
        })
        continue
      }
    }

    if (eventType === 'turn.completed') {
      const usage = getRecord(event.usage)
      inputTokens += getNumber(usage?.input_tokens) ?? 0
      outputTokens += getNumber(usage?.output_tokens) ?? 0
      pushSnippet(snippets, {
        kind: 'usage',
        text: `usage in=${getNumber(usage?.input_tokens) ?? 0} out=${getNumber(usage?.output_tokens) ?? 0}`,
      })
    }
  }

  return {
    output,
    capture: {
      source: 'codex-cli',
      format: 'jsonl-event-stream',
      eventCount: events.length,
      messageCount,
      thoughtCount,
      toolCallCount,
      ...(itemTypes.size > 0 ? { itemTypes: [...itemTypes].sort() } : {}),
      ...(snippets.length > 0 ? { snippets } : {}),
      metadata: {
        ...(threadId ? { threadId } : {}),
        turnCount,
        rawEvents: events,
      },
    },
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
    capture: parsed.capture,
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
