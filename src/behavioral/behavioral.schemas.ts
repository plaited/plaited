import * as z from 'zod'
import { DETAIL_MATCH, IDIOMS, SNAPSHOT_MESSAGE_KINDS } from './behavioral.constants.ts'

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
   * in event matching and never appears in any {@link SnapshotMessage} variant.
   * Frontier analysis snapshots field-pick `type`/`detail` only.
   */
  payload: z.unknown().optional(),
})

/** @public */
export type BPEvent = z.output<typeof BPEventSchema>

export const BPListenerSchema = z.object({
  type: z.string(),
  detailSchema: z.custom<z.ZodType<z.infer<typeof JsonObjectSchema>>>(
      (val) => val instanceof z.ZodType, // Zod exposes its base class internally here
      { message: "Must be a valid Zod Schema" }
    ).optional(),
  detailMatch: z.enum(Object.values(DETAIL_MATCH)).optional(),
})

export type BPListener = z.output<typeof BPListenerSchema>

export const RegisteredBPListenerSchema = z.object({
  ...BPListenerSchema.shape,
  topic: z.string().optional(),
})

export type RegisteredBPListener = BPListener & {
  topic?: string
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
 * @see {@link ReturnType<BSync>} for usage in behavioral rule steps
 * @see {@link bSync} for creating single synchronization points
 */
export const IdiomSchema = z.object({
  [IDIOMS.waitFor]: z.array(BPListenerSchema).min(1).optional(),
  [IDIOMS.interrupt]: z.array(BPListenerSchema).min(1).optional(),
  [IDIOMS.block]: z.array(BPListenerSchema).min(1).optional(),
  [IDIOMS.request]: BPEventSchema.optional(),
})

export type Idioms = z.output<typeof IdiomSchema>

export const RegisteredIdiomsSchema = z.object({
  [IDIOMS.waitFor]: z.array(RegisteredBPListenerSchema).min(1).optional(),
  [IDIOMS.interrupt]: z.array(RegisteredBPListenerSchema).min(1).optional(),
  [IDIOMS.block]: z.array(RegisteredBPListenerSchema).min(1).optional(),
  [IDIOMS.request]: BPEventSchema.optional(),
})

export type RegisteredIdioms = z.output<typeof RegisteredIdiomsSchema>

export const ThreadScehama = z.tuple([
  z.string().min(1),
  z.object({
    once: z.literal(true).optional(),
    rules: z.array(IdiomSchema),
  }),
])

export type Thread = z.output<typeof ThreadScehama>

export const ThreadsSchema = z.array(ThreadScehama)

export type Threads = z.output<typeof ThreadsSchema>

export const SnapshotEventSchema = BPEventSchema.extend({
  ingress: z.literal(true).optional(),
})

/** @public */
export type SnapshotEvent = z.output<typeof SnapshotEventSchema>

export const SnapshotCandidateSchema = z.object({
  type: z.string(),
  detail: JsonObjectSchema.optional(),
  ingress: z.literal(true).optional(),
  topic: z.string().optional(),
  priority: z.number(),
})

/** @public */
export type SnapshotCandidate = z.output<typeof SnapshotCandidateSchema>

export const FrontierSnapshotSchema = z.object({
  kind: z.literal(SNAPSHOT_MESSAGE_KINDS.frontier),
  step: z.number().int().nonnegative(),
  status: z.enum(['ready', 'deadlock', 'idle']),
  candidates: z.array(SnapshotCandidateSchema),
  enabled: z.array(SnapshotCandidateSchema),
})

/** @public */
export type FrontierSnapshot = z.output<typeof FrontierSnapshotSchema>

/**
 * Schema for a snapshot of all bids considered during one event selection step.
 *
 * @remarks
 * Published via {@link UseSnapshot} after each super-step's event selection.
 * Consumers narrow by `kind === 'selection'`.
 *
 * @see {@link SnapshotMessageSchema} for the full discriminated union
 *
 * @public
 */
export const SelectionSnapshotSchema = z.object({
  kind: z.literal(SNAPSHOT_MESSAGE_KINDS.selection),
  step: z.number().int().nonnegative(),
  selected: SnapshotEventSchema,
})

/** @public */
export type SelectionSnapshot = z.output<typeof SelectionSnapshotSchema>

/**
 * Schema for a snapshot emitted when no unblocked candidate can be selected.
 *
 * @remarks
 * Published via {@link UseSnapshot} when at least one request candidate exists
 * but all candidates are blocked. Consumers narrow by `kind === 'deadlock'`.
 *
 * @see {@link SnapshotMessageSchema} for the full discriminated union
 *
 * @public
 */
export const DeadlockSnapshotSchema = z.object({
  kind: z.literal(SNAPSHOT_MESSAGE_KINDS.deadlock),
  step: z.number().int().nonnegative(),
})

/** @public */
export type DeadlockSnapshot = z.output<typeof DeadlockSnapshotSchema>

/**
 * Schema for feedback handler errors published by the BP engine.
 *
 * @remarks
 * Emitted when a `useFeedback` handler throws during side-effect execution.
 * Published after the selection snapshot for the current super-step.
 * Consumers narrow by `kind === 'feedback_error'`.
 *
 * @see {@link SnapshotMessageSchema} for the full discriminated union
 *
 * @public
 */
export const FeedbackErrorSchema = z.object({
  kind: z.literal(SNAPSHOT_MESSAGE_KINDS.feedback_error),
  type: z.string(),
  topic: z.string().optional(),
  detail: JsonObjectSchema.optional(),
  error: z.string(),
})

/** @public */
export type FeedbackError = z.output<typeof FeedbackErrorSchema>

/**
 * Schema for errors emitted when a non-thread value is passed to `addThread`.
 *
 * @remarks
 * Published via the snapshot publisher when `addThread` receives a value that
 * does not pass the `isThread` runtime guard. The error message guides consumers
 * to use `thread()` to compose synchronization rules before registration.
 *
 * @see {@link isThread} for the runtime type guard
 * @see {@link thread} for composing behavioral threads
 * @see {@link AddThread} for the consumer-facing API
 *
 * @public
 */
export const AddThreadErrorSchema = z.object({
  kind: z.literal(SNAPSHOT_MESSAGE_KINDS.add_thread_error),
  error: z.custom<z.ZodIssue[]>() as z.ZodType<z.ZodIssue[]>,
})

/** @public */
export type AddThreadError = z.output<typeof AddThreadErrorSchema>

/**
 * Schema for the pending thread pool snapshot taken before each frontier computation.
 *
 * @remarks
 * Published at the start of each super-step's event selection phase, before
 * {@link FrontierSnapshotSchema}. Contains the serialized state of all pending
 * threads — their labels, priorities, and synchronization intentions — without
 * collapsing them into candidates.
 *
 * Consumers narrow by `kind === 'pending_bids'`.
 *
 * @see {@link SnapshotMessageSchema} for the full discriminated union
 *
 * @public
 */
export const PendingBidsSnapshotSchema = z.object({
  kind: z.literal(SNAPSHOT_MESSAGE_KINDS.pending_bids),
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
export type PendingBidsSnapshot = z.output<typeof PendingBidsSnapshotSchema>

export const RuntimeErrorSchema = z.object({
  kind: z.literal(SNAPSHOT_MESSAGE_KINDS.runtime_error),
  error: z.string(),
})

/** @public */
export type RuntimeError = z.infer<typeof RuntimeErrorSchema>

/**
 * Discriminated union schema for all observable moments from the BP engine.
 * Consumers narrow by the `kind` field.
 *
 * @see {@link SelectionSnapshotSchema} for event selection observations
 * @see {@link DeadlockSnapshotSchema} for blocked-candidate deadlock observations
 * @see {@link FeedbackErrorSchema} for feedback handler errors
 * @see {@link ExtensionErrorSchema} for host/runtime module diagnostics
 *
 * @public
 */
export const SnapshotMessageSchema = z.discriminatedUnion('kind', [
  RuntimeErrorSchema,
  FrontierSnapshotSchema,
  DeadlockSnapshotSchema,
  FeedbackErrorSchema,
  SelectionSnapshotSchema,
  AddThreadErrorSchema,
  PendingBidsSnapshotSchema,
])

/** @public */
export type SnapshotMessage = z.output<typeof SnapshotMessageSchema>
