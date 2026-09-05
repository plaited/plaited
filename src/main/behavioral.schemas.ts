import * as z from 'zod'
import { DETAIL_MATCH, IDIOMS, TRACE_MESSAGE_KINDS } from './behavioral.constants.ts'

// 1. Define the TypeScript types for your JSON structure first
export type JsonPrimitive = string | number | boolean | null
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }

// 2. Explicitly type the Zod schema using z.ZodType<JsonValue>
export const JsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(JsonValueSchema),
    z.record(z.string(), JsonValueSchema),
  ]),
)

// This strictly validates a valid, plain JSON object (key-value pairs)
export const JsonObjectSchema = z.record(z.string(), JsonValueSchema)

/** @public */
export type JsonObject = z.output<typeof JsonObjectSchema>

/**
 * Schema for validating BPEvent objects.
 * Uses a JSON-Schema-exportable object shape for runtime validation.
 *
 * @public
 */
export const BPEventSchema = z.object({
  type: z.string(),
  detail: JsonObjectSchema.optional(),
  topic: z.string().optional(),
})

/** @public */
export type BPEvent = z.output<typeof BPEventSchema>

const JSON_SCHEMA_KEYWORDS = new Set([
  'type',
  '$ref',
  '$schema',
  'enum',
  'const',
  'properties',
  'allOf',
  'anyOf',
  'oneOf',
  'not',
])

/**
 * A JSON object that must carry at least one JSON Schema keyword.
 *
 * The single source of truth for “is this a JSON Schema document?” at every
 * trust boundary that accepts one:
 *
 * - `BPListenerSchema.detailSchema` (optional) — hand-authored by thread authors.
 * - Phase 2 `useTool` descriptors — machine-derived via `z.toJSONSchema()` for
 *   both `inputSchema` and `outputSchema` (required).
 *
 * The keyword presence distinguishes a real schema from an arbitrary catchall
 * object (a common mistake is passing a Zod schema instance or a plain detail
 * object to `detailSchema`).
 *
 * @public
 */
export const JsonSchemaObjectSchema = JsonObjectSchema.refine(
  (val) => Object.keys(val).some((key) => JSON_SCHEMA_KEYWORDS.has(key)),
  { message: 'must be a valid JSON Schema object' },
)

export type JsonSchemaObject = z.output<typeof JsonSchemaObjectSchema>

/**
 * A valid detail schema accepts only JSON-serializable payloads — kernel
 * detail payloads are JSON values. `z.toJSONSchema` in input mode is the
 * oracle: it throws for dates, bigints, transforms, class instances, and
 * other non-JSON shapes.
 */
const isJsonDetailSchema = (schema: z.ZodObject): boolean => {
  try {
    z.toJSONSchema(schema, { io: 'input' })
    return true
  } catch {
    return false
  }
}

export const BPListenerSchema = z.object({
  type: z.string(),
  detailSchema: z
    .instanceof(z.ZodObject)
    .refine(isJsonDetailSchema, {
      message: 'detailSchema must only accept JSON-serializable detail payloads',
    })
    .optional(),
  detailMatch: z.enum(Object.values(DETAIL_MATCH)).optional(),
})

export type BPListener = z.output<typeof BPListenerSchema>

export const TransformListenerSchema = z.object({
  ...BPListenerSchema.shape,
  query: z.string(),
  target: z.string(),
})

export type TransformListener = z.output<typeof TransformListenerSchema>

const RegisteredBaseSchema = z.object({
  topic: z.string().optional(),
})

/**
 * Registered listener with topic stamping and compiled detail validator.
 *
 * The `validate` function is a compiled Ajv validator created at registration
 * time in {@link generateRulesFunctions}. Returns `true` when the candidate
 * event's `detail` conforms to the listener's `detailSchema`.
 */
export const RegisteredBPListenerSchema = z.object({
  ...RegisteredBaseSchema.shape,
  ...BPListenerSchema.shape,
})

export type RegisteredBPListener = z.output<typeof RegisteredBPListenerSchema> & {
  query?: never
  target?: never
}
/**
 * Registered transform listener — {@link TransformListener} with topic
 * stamping and the compiled detail validator shared by all registered idioms.
 */
export const RegisteredTransformListenerSchema = z.object({
  ...RegisteredBPListenerSchema.shape,
  ...TransformListenerSchema.shape,
})

export type RegisteredTransformListener = z.output<typeof RegisteredTransformListenerSchema>

/**
 * Trace-serialized listener — the in-memory zod `detailSchema` instance is
 * emitted as JSON Schema via `z.toJSONSchema()` at the trace boundary, keeping
 * trace messages JSON-only (frontier replay / visited-set invariant).
 */
export const SerializedListenerSchema = z.object({
  type: z.string(),
  topic: z.string().optional(),
  detailMatch: z.enum(Object.values(DETAIL_MATCH)).optional(),
  // JSON Schema emitted by z.toJSONSchema() — structurally a JSON object.
  detailSchema: z.record(z.string(), z.unknown()).optional(),
})

export const SerializedTransformListenerSchema = z.object({
  ...SerializedListenerSchema.shape,
  query: z.string(),
  target: z.string(),
})
/**
 * Represents a synchronization statement yielded by a behavioral rule step.
 * This is the core mechanism through which b-threads communicate their behavioral intentions
 * to the behavioral program scheduler at each step of execution.
 *
 * @property request - Propose an event to be selected and triggered. Only one request per sync point.
 * @property waitFor - Wait for specific events. Thread pauses until a matching event is selected.
 * @property block - Prevent specific events from being selected. Higher precedence than requests.
 * @property interrupt - Events that terminate the thread's execution if selected.
 *
 * @remarks
 * - Multiple listeners can be provided as arrays
 * - Blocked events have precedence over requested events
 * - Interrupts cause thread termination
 *
 * @see {@link ThreadScehama} for the tuple that embeds `IdiomSchema` rules
 * @see {@link UseAddThread} for registering a thread from `Idiom[]` rules
 */
export const IdiomSchema = z.object({
  [IDIOMS.waitFor]: z.array(BPListenerSchema).min(1).optional(),
  [IDIOMS.interrupt]: z.array(BPListenerSchema).min(1).optional(),
  [IDIOMS.block]: z.array(BPListenerSchema).min(1).optional(),
  [IDIOMS.request]: BPEventSchema.optional(),
  [IDIOMS.transform]: z.array(TransformListenerSchema).min(1).optional(),
})

export type Idioms = z.output<typeof IdiomSchema>

/**
 * Registered idioms with compiled validators on each listener.
 *
 * Hand-written (not derived from a Zod schema) because the `validate`
 * callable on each listener is non-serializable and cannot be expressed
 * by a Zod schema. The author-facing shape is {@link IdiomSchema};
 * `RegisteredIdioms` is the internal, post-registration representation.
 */
export type RegisteredIdioms = {
  [IDIOMS.waitFor]?: RegisteredBPListener[]
  [IDIOMS.interrupt]?: RegisteredBPListener[]
  [IDIOMS.block]?: RegisteredBPListener[]
  [IDIOMS.request]?: z.output<typeof BPEventSchema>
  [IDIOMS.transform]?: RegisteredTransformListener[]
}

export const ThreadScehama = z.object({
  label: z.string().min(1),
  once: z.literal(true).optional(),
  rules: z.array(IdiomSchema),
})
export type Thread = z.output<typeof ThreadScehama>

export const ThreadsSchema = z.array(ThreadScehama)

export type Threads = z.output<typeof ThreadsSchema>

export const TraceEventSchema = BPEventSchema.extend({
  ingress: z.literal(true).optional(),
})

/** @public */
export type TraceEvent = z.output<typeof TraceEventSchema>

export const TraceCandidateSchema = z.object({
  type: z.string(),
  detail: JsonObjectSchema.optional(),
  ingress: z.literal(true).optional(),
  topic: z.string().optional(),
  priority: z.number(),
})

/**
 * Structural contract for consumer-supplied trace extensions.
 *
 * @remarks
 * `Trace` variants happen to satisfy this shape (each spreads it), but consumers
 * should treat this as the contract their *extension* kinds must match when
 * parameterizing {@link behavioral} with a custom trace type — namely
 * `{ kind: string; timestamp: number }` plus kind-specific fields. Extension
 * kinds should use literal `kind` strings distinct from the engine's
 * `TRACE_MESSAGE_KINDS` so narrowing by `kind` remains unambiguous in the
 * unified `Trace | T` stream.
 *
 * @see {@link Trace} for the engine's closed trace union
 */
export const TraceBaseSchema = z.looseObject({
  kind: z.string(),
  timestamp: z.number(),
  instanceId: z.string(),
})

/** @public */
export type TraceCandidate = z.output<typeof TraceCandidateSchema>

export const FrontieTraceSchema = z.object({
  ...TraceBaseSchema.shape,
  kind: z.literal(TRACE_MESSAGE_KINDS.frontier),
  step: z.number().int().nonnegative(),
  status: z.enum(['ready', 'deadlock', 'idle']),
  candidates: z.array(TraceCandidateSchema),
  enabled: z.array(TraceCandidateSchema),
})

/** @public */
export type FrontierTrace = z.output<typeof FrontieTraceSchema>

/**
 * Schema for a trace of all bids considered during one event selection step.
 *
 * @remarks
 * Published via {@link useTrace} after each super-step's event selection.
 * Consumers narrow by `kind === 'selection'`.
 *
 * @see {@link TraceSchema} for the full discriminated union
 *
 * @public
 */
export const SelectionTraceSchema = z.object({
  ...TraceBaseSchema.shape,
  kind: z.literal(TRACE_MESSAGE_KINDS.selection),
  step: z.number().int().nonnegative(),
  selected: TraceEventSchema,
})

/** @public */
export type SelectionTrace = z.output<typeof SelectionTraceSchema>

/**
 * Schema for a trace emitted when no unblocked candidate can be selected.
 *
 * @remarks
 * Published via {@link useTrace} when at least one request candidate exists
 * but all candidates are blocked. Consumers narrow by `kind === 'deadlock'`.
 *
 * @see {@link TraceSchema} for the full discriminated union
 *
 * @public
 */
export const DeadlockTraceSchema = z.object({
  ...TraceBaseSchema.shape,
  kind: z.literal(TRACE_MESSAGE_KINDS.deadlock),
  step: z.number().int().nonnegative(),
})

/** @public */
export type DeadlockTrace = z.output<typeof DeadlockTraceSchema>

/**
 * Schema for errors emitted when `useAddThread` receives arguments that fail
 * `ThreadScehama` validation or contain an un-compilable JSON Schema.
 *
 * @remarks
 * Published via the trace publisher when `useAddThread`'s `safeParse` rejects
 * the supplied `(label, { rules, once })` tuple, or when Ajv fails to compile a
 * `detailSchema`. `error` is either a human-readable string (Ajv compile failure)
 * or a `ZodIssue[]` (thread-shape validation failure), narrowed via `Array.isArray`.
 *
 * @see {@link UseAddThread} for the consumer-facing API
 * @see {@link ThreadScehama} for the validating schema
 *
 * @public
 */
export const AddThreadErrorSchema = z.object({
  ...TraceBaseSchema.shape,
  kind: z.literal(TRACE_MESSAGE_KINDS.add_thread_error),
  error: z.union([z.array(z.unknown()), z.string()]),
  topic: z.string().optional(),
})

/** @public */
export type AddThreadError = z.output<typeof AddThreadErrorSchema>

/**
 * Schema for the pending thread pool trace taken before each frontier computation.
 *
 * @remarks
 * Published at the start of each super-step's event selection phase, before
 * {@link FrontieTraceSchema}. Contains the serialized state of all pending
 * threads — their labels, priorities, and synchronization intentions — without
 * collapsing them into candidates.
 *
 * Consumers narrow by `kind === 'pending_bids'`.
 *
 * @see {@link TraceSchema} for the full discriminated union
 *
 * @public
 */
export const PendingBidsTraceSchema = z.object({
  ...TraceBaseSchema.shape,
  kind: z.literal(TRACE_MESSAGE_KINDS.pending_bids),
  step: z.number().int().nonnegative(),
  threads: z.array(
    z.object({
      label: z.string(),
      priority: z.number().int(),
      ingress: z.literal(true).optional(),
      topic: z.string().optional(),
      request: BPEventSchema.pick({ type: true, detail: true }).optional(),
      waitFor: z.array(SerializedListenerSchema).optional(),
      block: z.array(SerializedListenerSchema).optional(),
      interrupt: z.array(SerializedListenerSchema).optional(),
      transform: z.array(SerializedTransformListenerSchema).optional(),
    }),
  ),
})

/** @public */
export type PendingBidsTrace = z.output<typeof PendingBidsTraceSchema>

export const TriggerErrorSchema = z.object({
  ...TraceBaseSchema.shape,
  kind: z.literal(TRACE_MESSAGE_KINDS.trigger_error),
  error: z.union([z.array(z.unknown()), z.string()]),
  topic: z.string().optional(),
})

/** @public */
export type TriggerError = z.infer<typeof TriggerErrorSchema>

export const InterruptTraceSchema = z.object({
  ...TraceBaseSchema.shape,
  kind: z.literal(TRACE_MESSAGE_KINDS.interrupt),
  selected: BPEventSchema,
  threadLabel: z.string(),
  step: z.number().int().nonnegative(),
})

/** @public */
export type InterruptTrace = z.infer<typeof InterruptTraceSchema>

export const TransformTraceSchema = z.object({
  ...TraceBaseSchema.shape,
  kind: z.literal(TRACE_MESSAGE_KINDS.transform),
  selected: BPEventSchema,
  threadLabel: z.string(),
  step: z.number().int().nonnegative(),
  transform: z.array(SerializedTransformListenerSchema),
})

/** @public */
export type TransformTrace = z.infer<typeof TransformTraceSchema>

/**
 * Discriminated union schema for all observable moments from the BP engine.
 * Consumers narrow by the `kind` field.
 *
 * @see {@link SelectionTraceSchema} for event selection observations
 * @see {@link DeadlockTraceSchema} for blocked-candidate deadlock observations
 * @see {@link ExtensionErrorSchema} for host/runtime module diagnostics
 *
 * @public
 */
export const TraceSchema = z.discriminatedUnion('kind', [
  TriggerErrorSchema,
  FrontieTraceSchema,
  DeadlockTraceSchema,
  SelectionTraceSchema,
  AddThreadErrorSchema,
  PendingBidsTraceSchema,
  InterruptTraceSchema,
  TransformTraceSchema,
])

/** @public */
export type Trace = z.output<typeof TraceSchema>
