import type { AGENT_EVENTS } from './agent.constants.ts'
import type { AgentPlan, AgentToolCall, GateDecision, ToolResult, TrajectoryStep } from './agent.schemas.ts'

// ============================================================================
// Tool Context + Handler — used by tool executor implementations
// ============================================================================

/** Context passed to tool handlers */
export type ToolContext = {
  workspace: string
}

/**
 * A tool implementation that executes a specific tool.
 *
 * @remarks
 * Receives parsed arguments and a workspace context.
 * Returned value becomes the `output` field of a `ToolResult`.
 *
 * @public
 */
export type ToolHandler = (args: Record<string, unknown>, ctx: ToolContext) => Promise<unknown>

// ============================================================================
// Gate Check — pluggable gate evaluation
// ============================================================================

/**
 * Gate evaluation function — decides whether a tool call is approved.
 *
 * @remarks
 * Returned by `createGateCheck()`. The agent loop calls this for each
 * proposed tool call. Returns a `GateDecision` with approval status
 * and risk classification.
 *
 * @public
 */
export type GateCheck = (toolCall: AgentToolCall) => GateDecision

// ============================================================================
// Inference Call — testing seam for model interaction
// ============================================================================

/** A single message in the OpenAI chat format */
export type ChatMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content?: string | null
  tool_calls?: unknown[]
  tool_call_id?: string
}

/** Inference request payload (OpenAI-compatible subset) */
export type InferenceRequest = {
  model: string
  messages: ChatMessage[]
  tools?: unknown[]
  temperature?: number
}

/** Inference response payload (OpenAI-compatible subset) */
export type InferenceResponse = {
  choices: Array<{
    message: {
      content?: string | null
      tool_calls?: unknown[]
      reasoning_content?: string | null
    }
  }>
}

/**
 * Testing seam for model inference.
 *
 * @remarks
 * Mock this in tests. Use `createInferenceCall()` in production
 * for real OpenAI-compatible API calls via `fetch()`.
 *
 * @public
 */
export type InferenceCall = (request: InferenceRequest) => Promise<InferenceResponse>

// ============================================================================
// Tool Executor — testing seam for tool execution
// ============================================================================

/**
 * Testing seam for tool execution.
 *
 * @remarks
 * Mock this in tests. Production implementation will use `Bun.spawn()`
 * for sandboxed subprocess execution (deferred to sandbox layer).
 *
 * @public
 */
export type ToolExecutor = (toolCall: AgentToolCall) => Promise<ToolResult>

// ============================================================================
// Parsed Model Response
// ============================================================================

/**
 * Structured output extracted from a raw model response by `parseModelResponse`.
 *
 * @public
 */
export type ParsedModelResponse = {
  thinking: string | null
  toolCalls: AgentToolCall[]
  message: string | null
}

// ============================================================================
// Agent Event Details — type map for behavioral<AgentEventDetails>()
// ============================================================================

/** Detail payload for the `task` event */
export type TaskDetail = {
  prompt: string
}

/** Detail payload for the `model_response` event */
export type ModelResponseDetail = {
  parsed: ParsedModelResponse
  raw: InferenceResponse
}

/** Detail payload for the `proposed_action` event */
export type ProposedActionDetail = {
  toolCall: AgentToolCall
}

/** Detail payload for gate decision events */
export type GateResultDetail = {
  toolCall: AgentToolCall
  decision: GateDecision
}

/** Detail payload for the `execute` event */
export type ExecuteDetail = {
  toolCall: AgentToolCall
  riskClass: string
}

/** Detail payload for the `tool_result` event */
export type ToolResultDetail = {
  result: ToolResult
}

/** Detail payload for the `save_plan` event */
export type SavePlanDetail = {
  plan: AgentPlan
}

/** Detail payload for the `plan_saved` event */
export type PlanSavedDetail = {
  plan: AgentPlan
}

/** Detail payload for the `message` event */
export type MessageDetail = {
  content: string
}

/**
 * Type-safe event detail map for `behavioral<AgentEventDetails>()`.
 *
 * @remarks
 * Each key matches an `AGENT_EVENTS` constant. The behavioral engine uses this
 * to infer handler parameter types in `useFeedback()`.
 *
 * @public
 */
export type AgentEventDetails = {
  [K in (typeof AGENT_EVENTS)['task']]: TaskDetail
} & {
  [K in (typeof AGENT_EVENTS)['context_ready']]: undefined
} & {
  [K in (typeof AGENT_EVENTS)['model_response']]: ModelResponseDetail
} & {
  [K in (typeof AGENT_EVENTS)['proposed_action']]: ProposedActionDetail
} & {
  [K in (typeof AGENT_EVENTS)['gate_approved']]: GateResultDetail
} & {
  [K in (typeof AGENT_EVENTS)['gate_rejected']]: GateResultDetail
} & {
  [K in (typeof AGENT_EVENTS)['simulate_request']]: ProposedActionDetail
} & {
  [K in (typeof AGENT_EVENTS)['simulation_result']]: unknown
} & {
  [K in (typeof AGENT_EVENTS)['eval_approved']]: unknown
} & {
  [K in (typeof AGENT_EVENTS)['eval_rejected']]: unknown
} & {
  [K in (typeof AGENT_EVENTS)['execute']]: ExecuteDetail
} & {
  [K in (typeof AGENT_EVENTS)['tool_result']]: ToolResultDetail
} & {
  [K in (typeof AGENT_EVENTS)['save_plan']]: SavePlanDetail
} & {
  [K in (typeof AGENT_EVENTS)['plan_saved']]: PlanSavedDetail
} & {
  [K in (typeof AGENT_EVENTS)['message']]: MessageDetail
} & {
  [K in (typeof AGENT_EVENTS)['loop_complete']]: undefined
}

// ============================================================================
// Agent Loop — public return type
// ============================================================================

/**
 * Return type of `createAgentLoop`.
 *
 * @remarks
 * - `run(prompt)` executes a full agent loop and resolves with output + trajectory
 * - `destroy()` cleans up all event subscriptions
 *
 * @public
 */
export type AgentLoop = {
  run: (prompt: string) => Promise<{ output: string; trajectory: TrajectoryStep[] }>
  destroy: () => void
}
