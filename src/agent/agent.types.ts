import { AGENT_EVENTS } from './agent.constants.ts'
import type {
  AgentPlan,
  AgentToolCall,
  GateDecision,
  ToolDefinition,
  ToolResult,
  TrajectoryStep,
} from './agent.schemas.ts'

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
  tools?: ToolDefinition[]
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
// Simulate — testing seam for Dreamer prediction
// ============================================================================

/**
 * Testing seam for simulation (Dreamer).
 *
 * @remarks
 * Given a proposed tool call and conversation context, returns a
 * natural-language prediction of the tool's outcome. Mock in tests;
 * use `createSimulate()` or `createSubAgentSimulate()` in production.
 *
 * @public
 */
export type Simulate = (args: {
  toolCall: AgentToolCall
  history: ChatMessage[]
  plan: AgentPlan | null
}) => Promise<string>

// ============================================================================
// Evaluate — testing seam for Judge scoring
// ============================================================================

/** Decision returned by the Judge after evaluating a simulation prediction */
export type EvalDecision = {
  approved: boolean
  reason?: string
  score?: number
}

/**
 * Testing seam for evaluation (Judge).
 *
 * @remarks
 * Runs symbolic gate and optional neural scorer on a Dreamer prediction.
 * Mock in tests; use `createEvaluate()` in production.
 *
 * @public
 */
export type Evaluate = (args: {
  toolCall: AgentToolCall
  prediction: string
  riskClass: string
  history: ChatMessage[]
  goal?: string
}) => Promise<EvalDecision>

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

/** Detail payload for the `simulate_request` event */
export type SimulateRequestDetail = {
  toolCall: AgentToolCall
  decision: GateDecision
}

/** Detail payload for the `simulation_result` event */
export type SimulationResultDetail = {
  toolCall: AgentToolCall
  prediction: string
  riskClass: string
}

/** Detail payload for the `eval_approved` event */
export type EvalApprovedDetail = {
  toolCall: AgentToolCall
  riskClass: string
  score?: number
}

/** Detail payload for the `eval_rejected` event */
export type EvalRejectedDetail = {
  toolCall: AgentToolCall
  reason: string
  score?: number
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
  [AGENT_EVENTS.task]: TaskDetail
  [AGENT_EVENTS.context_ready]: undefined
  [AGENT_EVENTS.invoke_inference]: undefined
  [AGENT_EVENTS.model_response]: ModelResponseDetail
  [AGENT_EVENTS.proposed_action]: ProposedActionDetail
  [AGENT_EVENTS.gate_approved]: GateResultDetail
  [AGENT_EVENTS.gate_rejected]: GateResultDetail
  [AGENT_EVENTS.simulate_request]: SimulateRequestDetail
  [AGENT_EVENTS.simulation_result]: SimulationResultDetail
  [AGENT_EVENTS.eval_approved]: EvalApprovedDetail
  [AGENT_EVENTS.eval_rejected]: EvalRejectedDetail
  [AGENT_EVENTS.execute]: ExecuteDetail
  [AGENT_EVENTS.tool_result]: ToolResultDetail
  [AGENT_EVENTS.save_plan]: SavePlanDetail
  [AGENT_EVENTS.plan_saved]: PlanSavedDetail
  [AGENT_EVENTS.message]: MessageDetail
  [AGENT_EVENTS.loop_complete]: undefined
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
