import { TOOL_STATUS } from './agent.constants.ts'
import type { AgentPlanStep, AgentToolCall, ToolResult, TrajectoryStep } from './agent.schemas.ts'
import type { ModelDelta, ParsedModelResponse } from './agent.types.ts'

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
 * @public
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
 * Used by the inference handler to construct `ParsedModelResponse`
 * from accumulated `ModelDelta` chunks on the `done` event.
 *
 * @param response - Raw inference response (OpenAI-compatible format)
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
// collectModelText — consume AsyncIterable<ModelDelta> into a string
// ============================================================================

/**
 * Consumes a model inference stream and collects all `text_delta` content.
 *
 * @remarks
 * Used by the simulation handler (Dreamer) and neural evaluation scorer (Judge)
 * to get the full text response from `Model.reason()`. Throws on `error` deltas
 * and respects abort signals.
 *
 * @param stream - The async iterable from `Model.reason()`
 * @param signal - Optional abort signal for cancellation
 * @returns Concatenated text content from all `text_delta` chunks
 *
 * @public
 */
export const collectModelText = async (stream: AsyncIterable<ModelDelta>, signal?: AbortSignal): Promise<string> => {
  const chunks: string[] = []
  for await (const delta of stream) {
    signal?.throwIfAborted()
    if (delta.type === 'text_delta') {
      chunks.push(delta.content)
    } else if (delta.type === 'error') {
      throw new Error(delta.error)
    }
  }
  return chunks.join('')
}

// ============================================================================
// createTrajectoryRecorder — accumulates trajectory steps
// ============================================================================

/**
 * Creates a trajectory recorder that accumulates `TrajectoryStep` entries.
 *
 * @remarks
 * Used by adapters (eval harness, trajectory persistence) to build
 * a structured record of agent execution. `getSteps()` returns a
 * deep clone to prevent mutation.
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
