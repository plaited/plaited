import * as z from 'zod'
import { DETAIL_MATCH, IDIOMS, TRACE_MESSAGE_KINDS } from './behavioral.constants.ts'

/** @public */
export const JsonObjectSchema = z.object({}).catchall(z.json())

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
  /**
   * Opaque, non-serializable side-channel for carrying non-JSON values (File,
   * Blob, FormData, ArrayBuffer, structured-clone values) straight to handlers.
   *
   * @remarks
   * `detail` stays JSON for frontier analysis; `payload` never participates
   * in event matching and never appears in any {@link Trace} variant.
   * Frontier analysis traces field-pick `type`/`detail` only.
   */
  payload: z.unknown().optional(),
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

export const BPListenerSchema = z.object({
  type: z.string(),
  detailSchema: JsonObjectSchema.optional().refine(
    (val) => val === undefined || Object.keys(val).some((key) => JSON_SCHEMA_KEYWORDS.has(key)),
    { message: 'detailSchema must be a valid JSON Schema object' },
  ),
  detailMatch: z.enum(Object.values(DETAIL_MATCH)).optional(),
})

export type BPListener = z.output<typeof BPListenerSchema>

/**
 * Registered listener with topic stamping and compiled detail validator.
 *
 * The `validate` function is a compiled Ajv validator created at registration
 * time in {@link generateRulesFunctions}. Returns `true` when the candidate
 * event's `detail` conforms to the listener's `detailSchema`.
 */
export type RegisteredBPListener = BPListener & {
  topic?: string
  validate: (detail: unknown) => boolean
}

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

export const TraceBaseSchema = z.looseObject({
  kind: z.string(),
  timestamp: z.number(),
})

export type TraceBase = z.output<typeof TraceBaseSchema>

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
 * Schema for feedback handler errors published by the BP engine.
 *
 * @remarks
 * Emitted when a `useFeedback` handler throws during side-effect execution.
 * Published after the selection trace for the current super-step.
 * Consumers narrow by `kind === 'feedback_error'`.
 *
 * @see {@link TraceSchema} for the full discriminated union
 *
 * @public
 */
export const FeedbackErrorSchema = z.object({
  ...TraceBaseSchema.shape,
  kind: z.literal(TRACE_MESSAGE_KINDS.feedback_error),
  type: z.string(),
  topic: z.string().optional(),
  detail: JsonObjectSchema.optional(),
  error: z.string(),
})

/** @public */
export type FeedbackError = z.output<typeof FeedbackErrorSchema>

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
      waitFor: z
        .array(
          z.object({
            type: z.string(),
            topic: z.string().optional(),
            detailMatch: z.enum(Object.values(DETAIL_MATCH)).optional(),
            detailSchema: JsonObjectSchema.optional(),
          }),
        )
        .optional(),
      block: z
        .array(
          z.object({
            type: z.string(),
            topic: z.string().optional(),
            detailMatch: z.enum(Object.values(DETAIL_MATCH)).optional(),
            detailSchema: JsonObjectSchema.optional(),
          }),
        )
        .optional(),
      interrupt: z
        .array(
          z.object({
            type: z.string(),
            topic: z.string().optional(),
            detailMatch: z.enum(Object.values(DETAIL_MATCH)).optional(),
            detailSchema: JsonObjectSchema.optional(),
          }),
        )
        .optional(),
    }),
  ),
})

/** @public */
export type PendingBidsTrace = z.output<typeof PendingBidsTraceSchema>

export const RuntimeErrorSchema = z.object({
  ...TraceBaseSchema.shape,
  kind: z.literal(TRACE_MESSAGE_KINDS.runtime_error),
  error: z.string(),
})

/** @public */
export type RuntimeError = z.infer<typeof RuntimeErrorSchema>

/**
 * Discriminated union schema for all observable moments from the BP engine.
 * Consumers narrow by the `kind` field.
 *
 * @see {@link SelectionTraceSchema} for event selection observations
 * @see {@link DeadlockTraceSchema} for blocked-candidate deadlock observations
 * @see {@link FeedbackErrorSchema} for feedback handler errors
 * @see {@link ExtensionErrorSchema} for host/runtime module diagnostics
 *
 * @public
 */
export const TraceSchema = z.discriminatedUnion('kind', [
  RuntimeErrorSchema,
  FrontieTraceSchema,
  DeadlockTraceSchema,
  FeedbackErrorSchema,
  SelectionTraceSchema,
  AddThreadErrorSchema,
  PendingBidsTraceSchema,
])

/** @public */
export type Trace = z.output<typeof TraceSchema>
