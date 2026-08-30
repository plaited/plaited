import * as z from 'zod'

// ================================================================
// Open Responses — Phase 0 subset schemas
//
// Source of truth: https://github.com/openresponses/openresponses
//   schema/components/schemas/*.json
//
// This subset covers tool-calling loop + reasoning as content parts.
// Out of scope: hosted tools, tool_choice, truncation, service_tier,
// image generation.
//
// Request schemas parse strictly; stream events tolerate unknown types.
// ================================================================

// ----------------------------------------------------------------
// Shared enums
// ----------------------------------------------------------------

/** @public */
export const MessageRoleSchema = z.enum(['user', 'assistant', 'system'])
export type MessageRole = z.output<typeof MessageRoleSchema>

/** @public */
export const ItemStatusSchema = z.enum(['in_progress', 'completed', 'incomplete', 'failed'])
export type ItemStatus = z.output<typeof ItemStatusSchema>

/** @public */
export const TruncationSchema = z.enum(['auto', 'disabled'])
export type Truncation = z.output<typeof TruncationSchema>

// ----------------------------------------------------------------
// Content parts (message.content entries)
// ----------------------------------------------------------------

/** @public */
export const OutputTextContentSchema = z.object({
  type: z.literal('output_text'),
  text: z.string(),
  annotations: z.array(z.unknown()).optional(),
})
export type OutputTextContent = z.output<typeof OutputTextContentSchema>

/** @public */
export const ReasoningTextContentSchema = z.object({
  type: z.literal('reasoning_text'),
  text: z.string(),
})
export type ReasoningTextContent = z.output<typeof ReasoningTextContentSchema>

/** @public */
export const ContentPartSchema = z.discriminatedUnion('type', [OutputTextContentSchema, ReasoningTextContentSchema])
export type ContentPart = z.output<typeof ContentPartSchema>

// ----------------------------------------------------------------
// Items — output / response-field side (full shape)
// ----------------------------------------------------------------

/** @public */
export const MessageItemSchema = z.object({
  id: z.string(),
  type: z.literal('message'),
  status: ItemStatusSchema,
  role: MessageRoleSchema,
  content: z.array(ContentPartSchema),
})
export type MessageItem = z.output<typeof MessageItemSchema>

/** @public */
export const FunctionCallItemSchema = z.object({
  id: z.string(),
  type: z.literal('function_call'),
  status: ItemStatusSchema,
  call_id: z.string(),
  name: z.string(),
  arguments: z.string(),
})
export type FunctionCallItem = z.output<typeof FunctionCallItemSchema>

/** @public */
export const FunctionCallOutputItemSchema = z.object({
  id: z.string(),
  type: z.literal('function_call_output'),
  status: ItemStatusSchema,
  call_id: z.string(),
  output: z.string(),
})
export type FunctionCallOutputItem = z.output<typeof FunctionCallOutputItemSchema>

/** @public */
export const CompactionItemSchema = z.object({
  id: z.string(),
  type: z.literal('compaction'),
  status: ItemStatusSchema,
  encrypted_content: z.string(),
})
export type CompactionItem = z.output<typeof CompactionItemSchema>

/** @public */
export const OutputItemSchema = z.discriminatedUnion('type', [
  MessageItemSchema,
  FunctionCallItemSchema,
  FunctionCallOutputItemSchema,
  CompactionItemSchema,
])
export type OutputItem = z.output<typeof OutputItemSchema>

// ----------------------------------------------------------------
// Items — input / request-param side (some fields optional)
// ----------------------------------------------------------------

/** @public */
export const MessageItemParamSchema = z.object({
  id: z.string().optional(),
  type: z.literal('message'),
  status: ItemStatusSchema.optional(),
  role: MessageRoleSchema,
  content: z.union([z.string(), z.array(ContentPartSchema)]),
})
export type MessageItemParam = z.output<typeof MessageItemParamSchema>

/** @public */
export const FunctionCallItemParamSchema = z.object({
  call_id: z.string(),
  id: z.string().optional(),
  type: z.literal('function_call'),
  status: ItemStatusSchema.optional(),
  name: z.string(),
  arguments: z.string(),
})
export type FunctionCallItemParam = z.output<typeof FunctionCallItemParamSchema>

/** @public */
export const FunctionCallOutputItemParamSchema = z.object({
  call_id: z.string(),
  id: z.string().optional(),
  type: z.literal('function_call_output'),
  status: ItemStatusSchema.optional(),
  output: z.string(),
})
export type FunctionCallOutputItemParam = z.output<typeof FunctionCallOutputItemParamSchema>

/** @public */
export const InputItemSchema = z.discriminatedUnion('type', [
  MessageItemParamSchema,
  FunctionCallItemParamSchema,
  FunctionCallOutputItemParamSchema,
])
export type InputItem = z.output<typeof InputItemSchema>

// ----------------------------------------------------------------
// Tool definition (request-side)
// ----------------------------------------------------------------

/** @public */
export const FunctionToolSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  parameters: z.record(z.string(), z.unknown()),
})
export type FunctionTool = z.output<typeof FunctionToolSchema>

// ----------------------------------------------------------------
// Request
// ----------------------------------------------------------------

/** @public */
export const OpenResponsesRequestSchema = z.object({
  model: z.object({
    provider: z.string(),
    modelId: z.string(),
  }),
  input: z.array(InputItemSchema),
  tools: z.array(FunctionToolSchema).optional(),
  truncation: TruncationSchema.optional(),
  instructions: z.string().optional(),
})
export type OpenResponsesRequest = z.output<typeof OpenResponsesRequestSchema>

// ----------------------------------------------------------------
// Usage (token counts on terminal events)
// ----------------------------------------------------------------

/** @public */
export const InputTokensDetailsSchema = z.object({
  cached_tokens: z.number().int().nonnegative().optional(),
})
export type InputTokensDetails = z.output<typeof InputTokensDetailsSchema>

/** @public */
export const OutputTokensDetailsSchema = z.object({
  reasoning_tokens: z.number().int().nonnegative().optional(),
})
export type OutputTokensDetails = z.output<typeof OutputTokensDetailsSchema>

/** @public */
export const UsageSchema = z.object({
  input_tokens: z.number().int().nonnegative(),
  output_tokens: z.number().int().nonnegative(),
  total_tokens: z.number().int().nonnegative(),
  input_tokens_details: InputTokensDetailsSchema.optional(),
  output_tokens_details: OutputTokensDetailsSchema.optional(),
})
export type Usage = z.output<typeof UsageSchema>

// ----------------------------------------------------------------
// Error (on response.failed)
// ----------------------------------------------------------------

/** @public */
export const ErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
})
export type Error = z.output<typeof ErrorSchema>

// ----------------------------------------------------------------
// Stream events — discriminated union
// ----------------------------------------------------------------

/** @public */
export const ResponseOutputItemAddedEventSchema = z.object({
  type: z.literal('response.output_item.added'),
  sequence_number: z.number().int().nonnegative().optional(),
  output_index: z.number().int().nonnegative().optional(),
  item: OutputItemSchema,
})
export type ResponseOutputItemAddedEvent = z.output<typeof ResponseOutputItemAddedEventSchema>

/** @public */
export const ResponseOutputTextDeltaEventSchema = z.object({
  type: z.literal('response.output_text.delta'),
  sequence_number: z.number().int().nonnegative().optional(),
  item_id: z.string(),
  output_index: z.number().int().nonnegative(),
  content_index: z.number().int().nonnegative(),
  delta: z.string(),
})
export type ResponseOutputTextDeltaEvent = z.output<typeof ResponseOutputTextDeltaEventSchema>

/** @public */
export const ResponseReasoningTextDeltaEventSchema = z.object({
  type: z.literal('response.reasoning_text.delta'),
  sequence_number: z.number().int().nonnegative().optional(),
  item_id: z.string(),
  output_index: z.number().int().nonnegative(),
  content_index: z.number().int().nonnegative(),
  delta: z.string(),
})
export type ResponseReasoningTextDeltaEvent = z.output<typeof ResponseReasoningTextDeltaEventSchema>

/** @public */
export const ResponseFunctionCallArgumentsDeltaEventSchema = z.object({
  type: z.literal('response.function_call_arguments.delta'),
  sequence_number: z.number().int().nonnegative().optional(),
  item_id: z.string(),
  output_index: z.number().int().nonnegative(),
  delta: z.string(),
})
export type ResponseFunctionCallArgumentsDeltaEvent = z.output<typeof ResponseFunctionCallArgumentsDeltaEventSchema>

/** @public */
export const ResponseOutputItemDoneEventSchema = z.object({
  type: z.literal('response.output_item.done'),
  sequence_number: z.number().int().nonnegative().optional(),
  output_index: z.number().int().nonnegative().optional(),
  item: OutputItemSchema,
})
export type ResponseOutputItemDoneEvent = z.output<typeof ResponseOutputItemDoneEventSchema>

/** @public */
export const ResponseCompletedEventSchema = z.object({
  type: z.literal('response.completed'),
  sequence_number: z.number().int().nonnegative().optional(),
  status: z.literal('completed'),
  usage: UsageSchema.optional(),
})
export type ResponseCompletedEvent = z.output<typeof ResponseCompletedEventSchema>

/** @public */
export const ResponseFailedEventSchema = z.object({
  type: z.literal('response.failed'),
  sequence_number: z.number().int().nonnegative().optional(),
  status: z.literal('failed'),
  error: ErrorSchema,
  usage: UsageSchema.optional(),
})
export type ResponseFailedEvent = z.output<typeof ResponseFailedEventSchema>

/** @public */
export const ResponseIncompleteEventSchema = z.object({
  type: z.literal('response.incomplete'),
  sequence_number: z.number().int().nonnegative().optional(),
  status: z.literal('incomplete'),
  usage: UsageSchema.optional(),
})
export type ResponseIncompleteEvent = z.output<typeof ResponseIncompleteEventSchema>

// ----------------------------------------------------------------
// Known stream event union (strict validation)
// ----------------------------------------------------------------

/** @public */
export const KnownStreamEventSchema = z.discriminatedUnion('type', [
  ResponseOutputItemAddedEventSchema,
  ResponseOutputTextDeltaEventSchema,
  ResponseReasoningTextDeltaEventSchema,
  ResponseFunctionCallArgumentsDeltaEventSchema,
  ResponseOutputItemDoneEventSchema,
  ResponseCompletedEventSchema,
  ResponseFailedEventSchema,
  ResponseIncompleteEventSchema,
])
export type KnownStreamEvent = z.output<typeof KnownStreamEventSchema>

// ----------------------------------------------------------------
// Unknown event passthrough (provider extras, _-prefixed)
// Tolerates any object with a 'type' field NOT matching known types.
// The refine closes the union fall-through: a malformed known frame
// (e.g. a text delta missing `delta`) fails the strict schema AND is
// rejected here, so it throws instead of masquerading as an unknown
// provider extra.
// ----------------------------------------------------------------

// Derived from the discriminated union's literal discriminants — the set stays in
// sync with KnownStreamEventSchema by construction, no hand-maintained duplicate.
const KNOWN_STREAM_EVENT_TYPES: ReadonlySet<string> = new Set(
  KnownStreamEventSchema.options.map((option) => option.shape.type.values.values().next().value as string),
)

/** @public */
export const UnknownStreamEventSchema = z.looseObject({
  type: z.string().refine((type) => !KNOWN_STREAM_EVENT_TYPES.has(type), {
    error: 'malformed known stream event — fix the frame instead of passing it through',
  }),
})
export type UnknownStreamEvent = z.output<typeof UnknownStreamEventSchema>

// ----------------------------------------------------------------
// Lax stream parser — tolerates unknown types
// ----------------------------------------------------------------

/** @public */
export const StreamEventLaxSchema = z.union([KnownStreamEventSchema, UnknownStreamEventSchema])
export type OpenResponsesStreamEvent = z.output<typeof StreamEventLaxSchema>
