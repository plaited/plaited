import type { EventLogRow } from '../tools/memory/memory.types.ts'
import { TOOL_STATUS } from './agent.constants.ts'
import type { AgentPlan, AgentPlanStep, AgentToolCall, ToolResult, TrajectoryStep } from './agent.schemas.ts'
import type { ChatMessage, DiagnosticEntry, InferenceCall, ParsedModelResponse } from './agent.types.ts'

// ============================================================================
// toToolResult — normalize tool execution result or error into ToolResult
// ============================================================================

/**
 * Normalizes a tool execution result or caught error into a `ToolResult`.
 *
 * @param toolCall - The tool call that was executed
 * @param resultOrError - Either a successful `ToolResult` or a caught error
 * @param duration - Execution duration in milliseconds
 * @returns A complete `ToolResult` with duration
 *
 * @internal
 */
export const toToolResult = (
  toolCall: AgentToolCall,
  resultOrError: ToolResult | Error | unknown,
  duration: number,
): ToolResult => {
  if (resultOrError && typeof resultOrError === 'object' && 'toolCallId' in resultOrError) {
    return { ...(resultOrError as ToolResult), duration }
  }
  const errorMsg = resultOrError instanceof Error ? resultOrError.message : String(resultOrError)
  return { toolCallId: toolCall.id, name: toolCall.name, status: TOOL_STATUS.failed, error: errorMsg, duration }
}

// ============================================================================
// createInferenceCall — fetch wrapper for OpenAI-compatible endpoints
// ============================================================================

/**
 * Creates an `InferenceCall` that calls an OpenAI-compatible chat completions endpoint.
 *
 * @remarks
 * Auth is a hosting/infrastructure concern, not a framework concern.
 * The agent runtime calls local or service-internal endpoints that are
 * already behind the data plane's auth layer.
 *
 * @param baseUrl - Base URL of the inference server (e.g., 'http://localhost:8080')
 * @returns An `InferenceCall` function
 *
 * @public
 */
export const createInferenceCall = (baseUrl: string): InferenceCall => {
  const url = `${baseUrl}/v1/chat/completions`

  return async (request) => {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    })
    if (!response.ok) {
      throw new Error(`Inference call failed: ${response.status} ${response.statusText}`)
    }
    const json = await response.json()
    if (!json?.choices?.[0]?.message) {
      throw new Error('Invalid inference response: missing choices[0].message')
    }
    return json
  }
}

// ============================================================================
// parseModelResponse — extract thinking, tool calls, and message from response
// ============================================================================

const THINK_TAG_REGEX = /^<think>([\s\S]*?)<\/think>\s*/

/**
 * Extracts structured data from a raw model response.
 *
 * @remarks
 * Handles two thinking formats:
 * 1. `reasoning_content` field (vLLM/MLX extension) — preferred
 * 2. `<think>...</think>` XML tags in content — fallback
 *
 * Tool call arguments are JSON-parsed from string form.
 *
 * @param response - Raw inference response
 * @returns Parsed response with thinking, tool calls, and message
 *
 * @public
 */
export const parseModelResponse = (response: {
  choices: Array<{ message: { content?: string | null; tool_calls?: unknown[]; reasoning_content?: string | null } }>
}): ParsedModelResponse => {
  const msg = response.choices[0]?.message
  if (!msg) return { thinking: null, toolCalls: [], message: null }

  // Extract thinking: prefer reasoning_content, fall back to <think> tags
  let thinking: string | null = msg.reasoning_content ?? null
  let content = msg.content ?? null

  if (!thinking && content) {
    const match = content.match(THINK_TAG_REGEX)
    if (match) {
      thinking = match[1]?.trim() ?? null
      content = content.slice(match[0].length) || null
    }
  }

  // Parse tool calls
  const toolCalls: AgentToolCall[] = []
  if (msg.tool_calls && Array.isArray(msg.tool_calls)) {
    for (const tc of msg.tool_calls) {
      const raw = tc as { id?: string; function?: { name?: string; arguments?: string } }
      if (raw.id && raw.function?.name) {
        let args: Record<string, unknown> = {}
        if (typeof raw.function.arguments === 'string') {
          try {
            args = JSON.parse(raw.function.arguments)
          } catch {
            args = { _raw: raw.function.arguments }
          }
        } else if (raw.function.arguments && typeof raw.function.arguments === 'object') {
          args = raw.function.arguments as Record<string, unknown>
        }
        toolCalls.push({ id: raw.id, name: raw.function.name, arguments: args })
      }
    }
  }

  // Remaining content is the user-facing message
  const message = content?.trim() || null

  return { thinking, toolCalls, message }
}

// ============================================================================
// createTrajectoryRecorder — accumulates trajectory steps
// ============================================================================

/**
 * Creates a trajectory recorder that accumulates `TrajectoryStep` entries.
 *
 * @returns Object with methods to add steps and retrieve/reset the trajectory
 *
 * @public
 */
export const createTrajectoryRecorder = () => {
  let steps: TrajectoryStep[] = []

  const addThought = (content: string, stepId?: string) => {
    steps.push({ type: 'thought', content, timestamp: Date.now(), ...(stepId && { stepId }) })
  }

  const addMessage = (content: string, stepId?: string) => {
    steps.push({ type: 'message', content, timestamp: Date.now(), ...(stepId && { stepId }) })
  }

  const addToolCall = (
    {
      name,
      status,
      input,
      output,
      duration,
    }: { name: string; status: string; input?: unknown; output?: unknown; duration?: number },
    stepId?: string,
  ) => {
    steps.push({
      type: 'tool_call',
      name,
      status,
      timestamp: Date.now(),
      ...(input !== undefined && { input }),
      ...(output !== undefined && { output }),
      ...(duration !== undefined && { duration }),
      ...(stepId && { stepId }),
    })
  }

  const addPlan = (entries: AgentPlanStep[], stepId?: string) => {
    steps.push({ type: 'plan', entries, timestamp: Date.now(), ...(stepId && { stepId }) })
  }

  return {
    addThought,
    addMessage,
    addToolCall,
    addPlan,
    getSteps: () => structuredClone(steps),
    reset: () => {
      steps = []
    },
  }
}

// ============================================================================
// buildContextMessages — assembles the messages array for inference
// ============================================================================

const SELECTION_WINDOW = 10

/**
 * Groups event log rows into selection steps and formats the last N.
 *
 * @remarks
 * A "selection step" is a contiguous group of rows where exactly one has
 * `selected=1`. Windows to the last {@link SELECTION_WINDOW} steps.
 *
 * @internal
 */
const formatSelectionContext = (eventLog: EventLogRow[]): string => {
  // Group rows into selection steps
  const steps: EventLogRow[][] = []
  let current: EventLogRow[] = []

  for (const row of eventLog) {
    current.push(row)
    if (row.selected) {
      steps.push(current)
      current = []
    }
  }
  if (current.length) steps.push(current)

  const totalSteps = steps.length
  const windowedSteps = steps.slice(-SELECTION_WINDOW)
  const omitted = totalSteps - windowedSteps.length

  let section = '\n\n## BP Selection History'
  if (omitted > 0) {
    section += `\n(${omitted} earlier selection steps omitted)`
  }

  for (const step of windowedSteps) {
    const selected = step.find((r) => r.selected)
    const blocked = step.filter((r) => r.blocked_by)

    if (selected) {
      section += `\n\n**Selected:** ${selected.event_type} (thread: ${selected.thread}, priority: ${selected.priority})`
    }
    for (const b of blocked) {
      section += `\n  - Blocked: ${b.event_type} (thread: ${b.thread}) by ${b.blocked_by}`
    }
  }

  return section
}

/**
 * Formats diagnostic entries (errors and warnings) for the model.
 *
 * @internal
 */
const formatDiagnostics = (diagnostics: DiagnosticEntry[]): string => {
  let section = '\n\n## BP Diagnostics'

  for (const d of diagnostics) {
    switch (d.kind) {
      case 'feedback_error':
        section += `\n- ERROR: handler for "${d.type}" threw: ${d.error}`
        break
      case 'restricted_trigger_error':
        section += `\n- REJECTED: trigger for "${d.type}" — ${d.error}`
        break
      case 'bthreads_warning':
        section += `\n- WARNING: thread "${d.thread}" — ${d.warning}`
        break
    }
  }

  return section
}

/**
 * Builds the messages array for an inference call.
 *
 * @remarks
 * Always provides full BP snapshot context to the model:
 * - Selection history (who won, who was blocked, priorities)
 * - Diagnostics (feedback errors, restricted trigger rejections, thread warnings)
 *
 * @param options - Context assembly options
 * @returns Array of chat messages in OpenAI format
 *
 * @public
 */
export const buildContextMessages = ({
  systemPrompt,
  history,
  plan,
  eventLog,
  diagnostics,
}: {
  systemPrompt?: string
  history: ChatMessage[]
  plan?: AgentPlan
  eventLog?: EventLogRow[]
  diagnostics?: DiagnosticEntry[]
}): ChatMessage[] => {
  const messages: ChatMessage[] = []

  // System message with optional plan context
  let system = systemPrompt ?? 'You are a helpful assistant.'
  if (plan) {
    system += `\n\n## Current Plan\nGoal: ${plan.goal}\nSteps:\n${plan.steps.map((s) => `- [${s.id}] ${s.intent} (tools: ${s.tools.join(', ')})`).join('\n')}`
  }

  // Full BP snapshot context: selections + diagnostics
  if (eventLog?.length) {
    system += formatSelectionContext(eventLog)
  }

  if (diagnostics?.length) {
    system += formatDiagnostics(diagnostics)
  }

  messages.push({ role: 'system', content: system })

  // Append conversation history
  messages.push(...history)

  return messages
}
