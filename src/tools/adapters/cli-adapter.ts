/**
 * Generic CLI adapter factory — reads a JSON adapter schema and produces
 * a trial-runner-compatible {@link Adapter} function.
 *
 * @remarks
 * Each JSON schema declaratively maps an agent CLI's stdout events to
 * trial runner trajectory steps. This factory interprets those mappings
 * at runtime so no agent-specific TypeScript is needed.
 *
 * @packageDocumentation
 */

import type { Adapter, AdapterResult, TrajectoryStep, Timing } from '../trial.schemas.ts'

// ============================================================================
// Schema Types (mirrors adapter-schema.json)
// ============================================================================

type EventRule = {
  match: Record<string, unknown>
  content?: string
  output?: string
  name?: string
  input?: string
  id?: string
  toolCallId?: string
  costUsd?: string
  inputTokens?: string
  outputTokens?: string
}

type AdapterSchemaConfig = {
  name: string
  description?: string
  command: string[]
  promptArg?: string
  cwdArg?: string
  streamFormat: 'ndjson' | 'json'
  eventMapping: {
    message?: EventRule
    thinking?: EventRule
    tool_call?: EventRule
    tool_result?: EventRule
    result?: EventRule
  }
  exitCodeMapping?: {
    success?: number[]
    timeout?: number[]
  }
}

// ============================================================================
// JSONPath-like field extraction
// ============================================================================

/**
 * Extracts a value from an object using a simplified JSONPath expression.
 *
 * @remarks
 * Supports:
 * - `$.field` — direct property access
 * - `$.field.nested` — nested property access
 * - `$.array[?(@.type=='text')].value` — array filter + pluck
 *
 * @internal
 */
const extractField = (obj: Record<string, unknown>, path: string): unknown => {
  if (!path.startsWith('$')) return undefined

  const stripped = path.slice(2) // Remove "$."
  const filterMatch = stripped.match(/^(.+?)\[\?\(@\.(.+?)==['"](.*?)['"]\)\]\.(.+)$/)

  if (filterMatch) {
    const [, arrayPath, filterKey, filterVal, pluckKey] = filterMatch as [
      string,
      string,
      string,
      string,
      string,
    ]
    const arr = getNestedValue(obj, arrayPath)
    if (!Array.isArray(arr)) return undefined
    const results = arr
      .filter((item) => typeof item === 'object' && item !== null && (item as Record<string, unknown>)[filterKey] === filterVal)
      .map((item) => (item as Record<string, unknown>)[pluckKey])
    return results.length === 1 ? results[0] : results.length > 0 ? results.join('') : undefined
  }

  return getNestedValue(obj, stripped)
}

/**
 * Traverse nested object by dot-separated path.
 *
 * @internal
 */
const getNestedValue = (obj: unknown, path: string): unknown => {
  let current: unknown = obj
  for (const key of path.split('.')) {
    if (current === null || current === undefined || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[key]
  }
  return current
}

// ============================================================================
// Event matching
// ============================================================================

/**
 * Check if an event object matches the rule's `match` criteria.
 *
 * @internal
 */
const matchesRule = (event: Record<string, unknown>, rule: EventRule): boolean =>
  Object.entries(rule.match).every(([key, value]) => event[key] === value)

// ============================================================================
// Factory
// ============================================================================

/**
 * Load an adapter schema from a JSON file path.
 *
 * @public
 */
export const loadAdapterSchema = async (schemaPath: string): Promise<AdapterSchemaConfig> => {
  const file = Bun.file(schemaPath)
  if (!(await file.exists())) {
    throw new Error(`Adapter schema not found: ${schemaPath}`)
  }
  return file.json() as Promise<AdapterSchemaConfig>
}

/**
 * Create a trial-runner-compatible adapter from a JSON schema config.
 *
 * @remarks
 * The returned adapter spawns the CLI agent as a subprocess, parses its
 * stdout events according to the schema's event mapping, and builds
 * a structured `AdapterResult` with trajectory and timing.
 *
 * @param config - Parsed adapter schema
 * @returns Adapter function
 *
 * @public
 */
export const createCliAdapter = (config: AdapterSchemaConfig): Adapter => {
  const { command, promptArg, cwdArg, streamFormat, eventMapping, exitCodeMapping } = config

  return async ({ prompt, cwd }) => {
    const text = Array.isArray(prompt) ? prompt.join('\n') : prompt
    const start = Date.now()

    // Build command args
    const args = [...command]
    if (promptArg) {
      args.push(promptArg, text)
    }
    if (cwdArg && cwd) {
      args.push(cwdArg, cwd)
    }

    const proc = Bun.spawn(args, {
      cwd: cwd ?? process.cwd(),
      stdout: 'pipe',
      stderr: 'pipe',
      stdin: promptArg ? undefined : new TextEncoder().encode(text),
    })

    const raw = await new Response(proc.stdout).text()
    const exitCode = await proc.exited
    const elapsed = Date.now() - start

    // Parse events
    const events: Record<string, unknown>[] = streamFormat === 'ndjson'
      ? raw.trim().split('\n').filter(Boolean).map((line) => {
          try { return JSON.parse(line) as Record<string, unknown> }
          catch { return null }
        }).filter((e): e is Record<string, unknown> => e !== null)
      : (() => {
          try { const parsed = JSON.parse(raw); return Array.isArray(parsed) ? parsed : [parsed] }
          catch { return [] }
        })()

    // Build trajectory and extract final output
    const trajectory: TrajectoryStep[] = []
    let output = ''
    let timing: Timing | undefined

    for (const event of events) {
      const ts = Date.now()

      // Result event (final output + usage)
      if (eventMapping.result && matchesRule(event, eventMapping.result)) {
        const rule = eventMapping.result
        const resultOutput = rule.output ? extractField(event, rule.output) : undefined
        if (typeof resultOutput === 'string') output = resultOutput

        const inputTokens = rule.inputTokens ? extractField(event, rule.inputTokens) : undefined
        const outputTokens = rule.outputTokens ? extractField(event, rule.outputTokens) : undefined
        if (inputTokens !== undefined || outputTokens !== undefined) {
          timing = {
            total: elapsed,
            ...(typeof inputTokens === 'number' && { inputTokens }),
            ...(typeof outputTokens === 'number' && { outputTokens }),
          }
        }
        continue
      }

      // Thinking event
      if (eventMapping.thinking && matchesRule(event, eventMapping.thinking)) {
        const content = extractField(event, eventMapping.thinking.content ?? '$.content')
        if (typeof content === 'string' && content) {
          trajectory.push({ type: 'thought', content, timestamp: ts })
        }
        continue
      }

      // Tool call event
      if (eventMapping.tool_call && matchesRule(event, eventMapping.tool_call)) {
        const rule = eventMapping.tool_call
        const name = extractField(event, rule.name ?? '$.name')
        const input = extractField(event, rule.input ?? '$.input')
        trajectory.push({
          type: 'tool_call',
          name: typeof name === 'string' ? name : 'unknown',
          status: 'completed',
          input,
          timestamp: ts,
        })
        continue
      }

      // Tool result event
      if (eventMapping.tool_result && matchesRule(event, eventMapping.tool_result)) {
        const rule = eventMapping.tool_result
        const resultOutput = extractField(event, rule.output ?? '$.output')
        // Attach output to the most recent tool_call
        const lastToolCall = [...trajectory].reverse().find((s) => s.type === 'tool_call')
        if (lastToolCall && lastToolCall.type === 'tool_call') {
          lastToolCall.output = resultOutput
        }
        continue
      }

      // Message event
      if (eventMapping.message && matchesRule(event, eventMapping.message)) {
        const content = extractField(event, eventMapping.message.content ?? '$.content')
        if (typeof content === 'string' && content) {
          output += content
          trajectory.push({ type: 'message', content, timestamp: ts })
        }
        continue
      }
    }

    // Determine timeout
    const timeoutCodes = exitCodeMapping?.timeout ?? [124]
    const timedOut = exitCode !== null && timeoutCodes.includes(exitCode)

    const result: AdapterResult = {
      output: output || raw.trim(),
      trajectory: trajectory.length > 0 ? trajectory : undefined,
      timing: timing ?? { total: elapsed },
      exitCode,
      timedOut,
    }

    return result
  }
}

/**
 * Load an adapter schema from a JSON file and return a ready-to-use adapter.
 *
 * @public
 */
export const loadCliAdapter = async (schemaPath: string): Promise<Adapter> => {
  const config = await loadAdapterSchema(schemaPath)
  return createCliAdapter(config)
}
