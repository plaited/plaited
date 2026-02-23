import { z } from 'zod'
import { RISK_CLASS, TOOL_STATUS } from './agent.constants.ts'

// ============================================================================
// Trajectory Step Schemas (canonical source — eval harness will import these)
// ============================================================================

/**
 * Thought trajectory step — captures model reasoning/thinking.
 *
 * @public
 */
export const ThoughtStepSchema = z.object({
  type: z.literal('thought'),
  content: z.string(),
  timestamp: z.number(),
  stepId: z.string().optional(),
})

/**
 * Message trajectory step — user-facing model output.
 *
 * @public
 */
export const MessageStepSchema = z.object({
  type: z.literal('message'),
  content: z.string(),
  timestamp: z.number(),
  stepId: z.string().optional(),
})

/**
 * Tool call trajectory step — records tool invocation and result.
 *
 * @public
 */
export const ToolCallStepSchema = z.object({
  type: z.literal('tool_call'),
  name: z.string(),
  status: z.string(),
  input: z.unknown().optional(),
  output: z.unknown().optional(),
  duration: z.number().optional(),
  timestamp: z.number(),
  stepId: z.string().optional(),
})

/**
 * Plan trajectory step — records a plan proposed by the model.
 *
 * @public
 */
export const PlanStepSchema = z.object({
  type: z.literal('plan'),
  entries: z.array(z.unknown()),
  timestamp: z.number(),
  stepId: z.string().optional(),
})

/**
 * Discriminated union of all trajectory step types.
 *
 * @remarks
 * Canonical definition — structurally identical to the eval harness version.
 * The eval harness will later import from `plaited/agent`.
 *
 * @public
 */
export const TrajectoryStepSchema = z.discriminatedUnion('type', [
  ThoughtStepSchema,
  MessageStepSchema,
  ToolCallStepSchema,
  PlanStepSchema,
])

/** Trajectory step type */
export type TrajectoryStep = z.infer<typeof TrajectoryStepSchema>

// ============================================================================
// Agent Tool Call Schemas
// ============================================================================

/**
 * A tool call parsed from the model response.
 *
 * @remarks
 * Extracted from OpenAI-compatible `tool_calls[].function` in the response.
 * `arguments` is already JSON-parsed into a record.
 *
 * @public
 */
export const AgentToolCallSchema = z.object({
  id: z.string(),
  name: z.string(),
  arguments: z.record(z.string(), z.unknown()),
})

/** Parsed tool call from model response */
export type AgentToolCall = z.infer<typeof AgentToolCallSchema>

// ============================================================================
// Plan Schemas
// ============================================================================

/**
 * A single step within an agent plan.
 *
 * @public
 */
export const AgentPlanStepSchema = z.object({
  id: z.string(),
  intent: z.string(),
  tools: z.array(z.string()),
  depends: z.array(z.string()).optional(),
})

/** Single plan step */
export type AgentPlanStep = z.infer<typeof AgentPlanStepSchema>

/**
 * A plan proposed by the model for multi-step task execution.
 *
 * @public
 */
export const AgentPlanSchema = z.object({
  goal: z.string(),
  steps: z.array(AgentPlanStepSchema),
})

/** Agent plan */
export type AgentPlan = z.infer<typeof AgentPlanSchema>

// ============================================================================
// Tool Result Schema
// ============================================================================

const toolStatusValues = Object.values(TOOL_STATUS) as [string, ...string[]]

/**
 * Result of a tool execution.
 *
 * @public
 */
export const ToolResultSchema = z.object({
  toolCallId: z.string(),
  name: z.string(),
  status: z.enum(toolStatusValues),
  output: z.unknown().optional(),
  error: z.string().optional(),
  duration: z.number().optional(),
})

/** Tool execution result */
export type ToolResult = z.infer<typeof ToolResultSchema>

// ============================================================================
// Gate Decision Schema
// ============================================================================

const riskClassValues = Object.values(RISK_CLASS) as [string, ...string[]]

/**
 * Gate evaluation decision for a proposed tool call.
 *
 * @remarks
 * Foundation stubs approve all with `read_only` risk class.
 * Constitution bThreads will later provide real classification.
 *
 * @public
 */
export const GateDecisionSchema = z.object({
  approved: z.boolean(),
  riskClass: z.enum(riskClassValues).optional(),
  reason: z.string().optional(),
})

/** Gate decision */
export type GateDecision = z.infer<typeof GateDecisionSchema>

// ============================================================================
// Agent Config Schema
// ============================================================================

/**
 * Configuration for creating an agent loop.
 *
 * @remarks
 * - `model`: Model identifier (e.g., 'falcon-h1r-7b')
 * - `baseUrl`: Local or service-internal inference endpoint (e.g., 'http://localhost:8080')
 * - `tools`: OpenAI-format tool definitions passed to the model
 * - `maxIterations`: Safety limit on tool call rounds (default 50)
 * - `temperature`: Sampling temperature (default 0 for deterministic)
 *
 * @public
 */
export const AgentConfigSchema = z.object({
  model: z.string(),
  baseUrl: z.string(),
  tools: z.array(z.record(z.string(), z.unknown())).optional(),
  systemPrompt: z.string().optional(),
  maxIterations: z.number().default(50),
  temperature: z.number().default(0),
})

/** Agent configuration */
export type AgentConfig = z.infer<typeof AgentConfigSchema>
