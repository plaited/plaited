import * as z from 'zod'
import { SelectionBidSchema } from '../behavioral/behavioral.schemas.ts'
import { type BSync, type DefaultHandlers, isBehavioralRule } from '../behavioral.ts'
import { isTypeOf, trueTypeOf } from '../utils.ts'
import type { Factory, Signal } from './agent.types.ts'

/**
 * Initial heartbeat configuration for the new agent core.
 *
 * @public
 */
export const AgentHeartbeatConfigSchema = z.object({
  intervalMs: z.number().int().positive().optional(),
})

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

/** @public */
export const ReadFileConfigSchema = z.object({
  path: z.string().describe('Relative path to the file'),
})

/** @public */
export const GlobFilesConfigSchema = z.object({
  pattern: z.string().describe('Glob pattern to match'),
  exclude: z.array(z.string()).optional().describe('Optional exclude glob patterns'),
})

/** @public */
export const BashConfigSchema = z.object({
  path: z.string().describe('Workspace-local path to the Bun worker module to execute'),
  args: z.array(z.string()).describe('Arguments to pass to the worker module'),
  timeout: z.number().optional().describe('Optional timeout in milliseconds'),
})

/** @public */
export const GrepConfigSchema = z.object({
  pattern: z.string().describe('Regex or literal search pattern'),
  path: z.string().optional().describe('Directory or file to search (default: cwd root)'),
  glob: z.string().optional().describe('Filter files by glob pattern (e.g. "*.ts")'),
  ignoreCase: z.boolean().optional().describe('Case-insensitive search'),
  literal: z.boolean().optional().describe('Treat pattern as literal string, not regex'),
  context: z.number().optional().describe('Lines of context before and after each match'),
  limit: z.number().optional().describe('Maximum number of matches to return (default: 100)'),
  timeout: z.number().optional().describe('Optional timeout in milliseconds'),
})

/** @public */
export const BashOutputSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('completed'),
    output: z.string(),
    exitCode: z.literal(0),
  }),
  z.object({
    status: z.literal('failed'),
    error: z.string(),
    exitCode: z.number(),
    stderr: z.string().optional(),
  }),
])

/** @public */
export const GrepMatchSchema = z.object({
  path: z.string(),
  line: z.number(),
  text: z.string(),
  context: z
    .object({
      before: z.array(z.string()).optional(),
      after: z.array(z.string()).optional(),
    })
    .optional(),
})

/** @public */
export const GrepOutputSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('completed'),
    matches: z.array(GrepMatchSchema),
    totalMatches: z.number(),
    truncated: z.boolean(),
    exitCode: z.literal(0),
  }),
  z.object({
    status: z.literal('failed'),
    error: z.string(),
    exitCode: z.number(),
    stderr: z.string().optional(),
  }),
])

const ReadFileToolArgumentsSchema = z.object({
  path: z.string().describe('Relative path to the file'),
})

const WriteFileToolArgumentsSchema = z.object({
  path: z.string().describe('Relative path to the file'),
  content: z.string().describe('Full file contents to write'),
})

const DeleteFileToolArgumentsSchema = z.object({
  path: z.string().describe('Relative path to the file'),
})

/**
 * A tool call parsed from the primary model response.
 *
 * @remarks
 * This is intentionally narrower than the generic OpenAI function-calling
 * surface. Tool calls that survive parsing must already match the concrete
 * built-in tool request shapes expected by the factory bridge into the agent
 * core handlers.
 *
 * @public
 */
export const AgentToolCallSchema = z.discriminatedUnion('name', [
  z.object({
    id: z.string(),
    name: z.literal('read_file'),
    arguments: ReadFileToolArgumentsSchema,
  }),
  z.object({
    id: z.string(),
    name: z.literal('write_file'),
    arguments: WriteFileToolArgumentsSchema,
  }),
  z.object({
    id: z.string(),
    name: z.literal('delete_file'),
    arguments: DeleteFileToolArgumentsSchema,
  }),
  z.object({
    id: z.string(),
    name: z.literal('glob_files'),
    arguments: GlobFilesConfigSchema,
  }),
  z.object({
    id: z.string(),
    name: z.literal('grep'),
    arguments: GrepConfigSchema,
  }),
  z.object({
    id: z.string(),
    name: z.literal('bash'),
    arguments: BashConfigSchema,
  }),
])

/** Parsed tool call from model response */
export type AgentToolCall = z.infer<typeof AgentToolCallSchema>

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

/** @public */
export const ChatMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant', 'tool']),
  content: z.string().nullable().optional(),
  tool_calls: z.array(z.unknown()).optional(),
  tool_call_id: z.string().optional(),
})

/** @public */
export type ChatMessageShape = z.infer<typeof ChatMessageSchema>

/** @public */
export const ParsedModelResponseSchema = z.object({
  thinking: z.string().nullable(),
  toolCalls: z.array(AgentToolCallSchema),
  message: z.string().nullable(),
})

/** @public */
export type ParsedModelResponseShape = z.infer<typeof ParsedModelResponseSchema>

/** @public */
export const ModelResponseDetailSchema = z.object({
  parsed: ParsedModelResponseSchema,
  usage: ModelUsageSchema,
})

/** @public */
export type ModelResponseDetailShape = z.infer<typeof ModelResponseDetailSchema>

/** @public */
export const RequestInferenceRequestSchema = z.object({
  messages: z.array(ChatMessageSchema),
  tools: z.array(ToolDefinitionSchema).optional(),
  temperature: z.number().optional(),
  timeout: z.number().optional(),
})

/** @public */
export const VoiceResponseSchema = z.object({
  audio: z.custom<Uint8Array>((value) => value instanceof Uint8Array),
  sampleRate: z.number(),
  duration: z.number(),
})

/** @public */
export type VoiceResponseShape = z.infer<typeof VoiceResponseSchema>

const isSignalWithSetter = (value: unknown): value is Signal => {
  if (!isTypeOf<Record<string, unknown>>(value, 'object')) return false
  return (
    trueTypeOf(value.get) === 'function' &&
    trueTypeOf(value.listen) === 'function' &&
    trueTypeOf(value.set) === 'function' &&
    isTypeOf<Record<string, unknown>>(value.schema, 'object')
  )
}

const isFactory = (value: unknown): value is Factory => trueTypeOf(value) === 'function'

const isDefaultHandlers = (value: unknown): value is DefaultHandlers => {
  if (!isTypeOf<Record<string, unknown>>(value, 'object')) return false
  for (const handler of Object.values(value)) {
    if (trueTypeOf(handler) === 'function' || trueTypeOf(handler) === 'asyncfunction') continue
    return false
  }
  return true
}

const SignalWithSetterSchema = <TSchema extends z.ZodTypeAny>() => z.custom<Signal<TSchema>>(isSignalWithSetter)

const BehavioralRuleSchema = z.custom<ReturnType<BSync>>(isBehavioralRule)

const DefaultHandlersSchema = z.custom<DefaultHandlers>(isDefaultHandlers)

const FactorySchema = z.custom<Factory>(isFactory)

const isBunFile = (value: unknown) => {
  if (value === null || value === undefined) return false
  const file = value as Record<string, unknown>
  return (
    trueTypeOf(file.exists) === 'function' &&
    trueTypeOf(file.text) === 'function' &&
    trueTypeOf(file.bytes) === 'function' &&
    trueTypeOf(file.json) === 'function'
  )
}

/** @public */
export const BunFileSchema = z.custom<ReturnType<typeof Bun.file>>(isBunFile)

/** @public */
export const ReadFileOutputSchema = BunFileSchema

/** @public */
export type ReadFileOutput = z.infer<typeof ReadFileOutputSchema>

const createSignalResultSchema = <TInput extends z.ZodTypeAny, TOutput extends z.ZodTypeAny>(
  input: TInput,
  output: TOutput,
) =>
  z.object({
    input,
    output,
  })

/** @public */
export const PrimaryInferenceResultSchema = createSignalResultSchema(
  RequestInferenceRequestSchema,
  ModelResponseDetailSchema,
)

/** @public */
export type PrimaryInferenceResult = z.infer<typeof PrimaryInferenceResultSchema>

/** @public */
export const TtsInferenceRequestSchema = z.object({
  text: z.string(),
  voice: z.string().optional(),
  language: z.string().optional(),
  timeout: z.number().optional(),
})

/** @public */
export const TtsInferenceResultSchema = createSignalResultSchema(TtsInferenceRequestSchema, VoiceResponseSchema)

/** @public */
export type TtsInferenceResult = z.infer<typeof TtsInferenceResultSchema>

/** @public */
export const RequestPrimaryInferenceDetailSchema = z.object({
  input: RequestInferenceRequestSchema,
  signal: SignalWithSetterSchema<typeof PrimaryInferenceResultSchema>(),
})

/** @public */
export type RequestPrimaryInferenceDetail = z.infer<typeof RequestPrimaryInferenceDetailSchema>

/** @public */
export const RequestTtsInferenceDetailSchema = z.object({
  input: TtsInferenceRequestSchema,
  signal: SignalWithSetterSchema<typeof TtsInferenceResultSchema>(),
})

/** @public */
export type RequestTtsInferenceDetail = z.infer<typeof RequestTtsInferenceDetailSchema>

/** @public */
export const BashResultSchema = createSignalResultSchema(BashConfigSchema, BashOutputSchema)

/** @public */
export const RequestBashDetailSchema = z.object({
  input: BashConfigSchema,
  signal: SignalWithSetterSchema<typeof BashResultSchema>(),
})

/** @public */
export type RequestBashDetail = z.infer<typeof RequestBashDetailSchema>

const WriteFileInputSchema = z.object({
  path: z.string(),
  content: z.custom<Bun.BlobOrStringOrBuffer>((value) => {
    return (
      typeof value === 'string' ||
      value instanceof Blob ||
      value instanceof ArrayBuffer ||
      value instanceof SharedArrayBuffer ||
      ArrayBuffer.isView(value)
    )
  }),
})

/** @public */
export const WriteFileOutputSchema = z.number()

/** @public */
export const RequestWriteFileDetailSchema = z.object({
  input: WriteFileInputSchema,
  signal: SignalWithSetterSchema<typeof WriteFileResultSchema>(),
})

/** @public */
export type RequestWriteFileDetail = z.infer<typeof RequestWriteFileDetailSchema>

/** @public */
export const WriteFileResultSchema = createSignalResultSchema(WriteFileInputSchema, WriteFileOutputSchema)

/** @public */
export const RequestReadFileDetailSchema = z.object({
  input: z.string(),
  signal: SignalWithSetterSchema<typeof ReadFileResultSchema>(),
})

/** @public */
export type RequestReadFileDetail = z.infer<typeof RequestReadFileDetailSchema>

/** @public */
export const ReadFileResultSchema = createSignalResultSchema(z.string(), ReadFileOutputSchema)

/** @public */
export const GlobFilesOutputSchema = z.array(z.string())

/** @public */
export const RequestGlobFilesDetailSchema = z.object({
  input: GlobFilesConfigSchema,
  signal: SignalWithSetterSchema<typeof GlobFilesResultSchema>(),
})

/** @public */
export type RequestGlobFilesDetail = z.infer<typeof RequestGlobFilesDetailSchema>

/** @public */
export const GlobFilesResultSchema = createSignalResultSchema(GlobFilesConfigSchema, GlobFilesOutputSchema)

/** @public */
export const RequestGrepDetailSchema = z.object({
  input: GrepConfigSchema,
  signal: SignalWithSetterSchema<typeof GrepResultSchema>(),
})

/** @public */
export type RequestGrepDetail = z.infer<typeof RequestGrepDetailSchema>

/** @public */
export const GrepResultSchema = createSignalResultSchema(GrepConfigSchema, GrepOutputSchema)

/** @public */
export const DeleteFileOutputSchema = z.literal(true)

/** @public */
export const RequestDeleteFileDetailSchema = z.object({
  input: z.string(),
  signal: SignalWithSetterSchema<typeof DeleteFileResultSchema>(),
})

/** @public */
export type RequestDeleteFileDetail = z.infer<typeof RequestDeleteFileDetailSchema>

/** @public */
export const DeleteFileResultSchema = createSignalResultSchema(z.string(), DeleteFileOutputSchema)

// ============================================================================
// Agent Config Schema
// ============================================================================

/** @public */
export const FactoryResultSchema = z
  .object({
    threads: z.record(z.string(), BehavioralRuleSchema).optional(),
    handlers: DefaultHandlersSchema.optional(),
  })
  .strict()

/** @public */
export type FactoryResult = z.infer<typeof FactoryResultSchema>

/** @public */
export const UpdateFactoryModuleSchema = z
  .object({
    default: z.array(FactorySchema).min(1),
  })
  .strict()

/** @public */
export type UpdateFactoryModule = z.infer<typeof UpdateFactoryModuleSchema>
