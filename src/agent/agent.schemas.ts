import * as z from 'zod'
import { SelectionBidSchema } from '../behavioral/behavioral.schemas.ts'
import { type DefaultHandlers, isRulesFunction, type RulesFunction } from '../behavioral.ts'
import { isTypeOf, trueTypeOf } from '../utils.ts'
import { RISK_TAG, TOOL_STATUS } from './agent.constants.ts'

/**
 * Initial heartbeat configuration for the new agent core.
 *
 * @public
 */
export const AgentHeartbeatConfigSchema = z.object({
  intervalMs: z.number().int().positive().optional(),
})

/**
 * Runtime factory update request for the new agent core.
 *
 * @public
 */
export const UpdateFactoriesDetailSchema = z.string().min(1)

export type UpdateFactoriesDetail = z.infer<typeof UpdateFactoriesDetailSchema>

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
// Trajectory Step Schemas (canonical source — eval harness imports these)
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
  entries: z.array(AgentPlanStepSchema),
  timestamp: z.number(),
  stepId: z.string().optional(),
})

/**
 * Decision trajectory step — captures BP engine selection state.
 *
 * @remarks
 * Each entry in `bids` is a {@link SelectionBid} from the BP engine's
 * event selection step — what was requested, blocked, selected, and
 * interrupted. Provides deterministic process signal for training
 * without requiring a learned Process Reward Model.
 *
 * @public
 */
export const DecisionStepSchema = z.object({
  type: z.literal('decision'),
  bids: z.array(SelectionBidSchema),
  timestamp: z.number(),
  stepId: z.string().optional(),
})

/** BP engine decision step */
export type DecisionStep = z.infer<typeof DecisionStepSchema>

/**
 * Discriminated union of all trajectory step types.
 *
 * @remarks
 * Canonical definition. The eval harness schemas module imports
 * `ThoughtStepSchema`, `MessageStepSchema`, and `ToolCallStepSchema`.
 * `PlanStepSchema` intentionally diverges in the eval harness
 * (`entries: z.array(z.unknown())`) to accept arbitrary adapter outputs.
 * `DecisionStepSchema` is agent-build specific (BP snapshots).
 *
 * @public
 */
export const TrajectoryStepSchema = z.discriminatedUnion('type', [
  ThoughtStepSchema,
  MessageStepSchema,
  ToolCallStepSchema,
  PlanStepSchema,
  DecisionStepSchema,
])

/** Trajectory step type */
export type TrajectoryStep = z.infer<typeof TrajectoryStepSchema>

// ============================================================================
// Tool Result Schema
// ============================================================================

const toolStatusValues = Object.values(TOOL_STATUS)

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

export const AgentToolResultDetailSchema = z.object({
  result: z.object({
    name: z.string().min(1),
    status: z.enum(toolStatusValues),
    output: z.unknown().optional(),
  }),
})

export type AgentToolResultDetail = z.infer<typeof AgentToolResultDetailSchema>

// ============================================================================
// Gate Decision Schema
// ============================================================================

const riskTagValues = Object.values(RISK_TAG)

/**
 * Gate evaluation decision for a proposed tool call.
 *
 * @remarks
 * Produced by gate bThread block predicates. The `tags` array contains
 * composable risk tags (see `RISK_TAG`) that determine routing:
 *
 * - Empty/unknown tags → Simulate + Judge (default-deny, prove it's safe)
 * - `workspace`-only → Execute directly (declared safe)
 * - Any boundary/irreversible/audience tags → Simulate + Judge
 *
 * Tags are declared by tool/wrapper definitions, not inferred at runtime.
 *
 * @public
 */
export const GateDecisionSchema = z.object({
  approved: z.boolean(),
  tags: z.array(z.enum(riskTagValues)).default([]),
  reason: z.string().optional(),
})

/** Gate decision */
export type GateDecision = z.infer<typeof GateDecisionSchema>

// ============================================================================
// Tool Definition Schema (OpenAI function-calling format)
// ============================================================================

/**
 * JSON Schema parameters subset for tool definitions.
 *
 * @internal
 */
const ToolParametersSchema = z
  .object({
    type: z.literal('object'),
    properties: z.record(z.string(), z.record(z.string(), z.unknown())).optional(),
    required: z.array(z.string()).optional(),
  })
  .passthrough()

/**
 * OpenAI function-calling tool definition.
 *
 * @remarks
 * Validates the `{ type: 'function', function: { name, description?, parameters? } }`
 * shape used by OpenAI-compatible inference APIs.
 *
 * @public
 */
export const ToolDefinitionSchema = z.object({
  type: z.literal('function'),
  function: z.object({
    name: z.string(),
    description: z.string().optional(),
    parameters: ToolParametersSchema.optional(),
  }),
  tags: z.array(z.string()).optional(),
})

/** OpenAI function-calling tool definition */
export type ToolDefinition = z.infer<typeof ToolDefinitionSchema>

// ============================================================================
// Model Usage Schema
// ============================================================================

/**
 * Token usage from a completed inference call.
 *
 * @remarks
 * Included in `ModelResponse` on the `done` delta. Used for context
 * budgeting (pre-flight token check), not billing.
 *
 * @public
 */
export const ModelUsageSchema = z.object({
  inputTokens: z.number(),
  outputTokens: z.number(),
})

/** Model usage */
export type ModelUsage = z.infer<typeof ModelUsageSchema>

// ============================================================================
// Agent Config Schema
// ============================================================================

/**
 * Configuration for creating an agent loop.
 *
 * @remarks
 * The `Model` interface is passed separately — config controls behavior,
 * not connection details.
 *
 * @public
 */
export const AgentConfigSchema = z.object({
  tools: z.array(ToolDefinitionSchema).optional(),
  systemPrompt: z.string().optional(),
  maxIterations: z.number().default(50),
  temperature: z.number().default(0),
})

/** Agent configuration */
export type AgentConfig = z.infer<typeof AgentConfigSchema>

export const FactoryResultSchema = z.object({
  threads: z.record(z.string(), z.custom<RulesFunction>(isRulesFunction)).optional(),
  handlers: z
    .custom<DefaultHandlers>((obj) => {
      const isObject = isTypeOf<Record<string, unknown>>(obj, 'object')
      if (!isObject) return false
      for (const val of Object.values(obj)) {
        if (trueTypeOf(val) === 'function' || trueTypeOf(val) === 'asyncfunction') continue
        return false
      }
      return true
    })
    .optional(),
})

export type FactoryResult = z.infer<typeof FactoryResultSchema>

export const UpdateFactoryModuleSchema = z.object({
  default: z.custom<(...args: unknown[]) => FactoryResult>((val) => trueTypeOf(val) === 'function'),
})

/** @public */
export type UpdateFactoryModule = z.infer<typeof UpdateFactoryModuleSchema>
