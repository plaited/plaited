import * as z from 'zod'
import type { BPEvent, JsonObject } from '../shared.ts'
import { BPEventSchema, JsonObjectSchema } from '../shared.ts'

export type { BPEvent, JsonObject }
export { BPEventSchema }

import { DETAIL_MATCH, SNAPSHOT_MESSAGE_KINDS } from './behavioral.constants.ts'

export const BPListenerSchema = z.object({
  type: z.string(),
  detailSchema: JsonObjectSchema.optional(),
  detailMatch: z.enum(Object.values(DETAIL_MATCH)).optional(),
  topic: z.string().optional(),
})

export type BPListener = {
  type: string
  detailSchema?: z.ZodType<JsonObject>
  detailMatch?: keyof typeof DETAIL_MATCH
  topic?: string
}

export const SpecIdiomsSchema = z.object({
  waitFor: z.array(BPListenerSchema).min(1).optional(),
  interrupt: z.array(BPListenerSchema).min(1).optional(),
  block: z.array(BPListenerSchema).min(1).optional(),
  request: BPEventSchema.optional(),
})

export type SpecIdioms = z.output<typeof SpecIdiomsSchema>

export const SpecSchema = z.object({
  label: z.string(),
  thread: z.object({
    once: z.literal(true).optional(),
    syncPoints: z.array(SpecIdiomsSchema),
  }),
})

export type Spec = z.output<typeof SpecSchema>

/**
 * @internal
 * Shared schema for memory entry detail envelopes.
 */
export const createMemoryEntryDetailSchema = (detailSchema: z.ZodType<unknown>) =>
  z.object({
    expiresAt: z.number().optional(),
    createdAt: z.number(),
    body: detailSchema,
  })

/**
 * @internal
 * Shared schema for memory response envelopes with request id.
 */
export const createMemoryResponseDetailSchema = ({
  id,
  detailSchema,
}: {
  id: string
  detailSchema: z.ZodType<unknown>
}) =>
  createMemoryEntryDetailSchema(detailSchema).extend({
    id: z.literal(id),
  })

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
  /** Label passed to `addThread`, used to identify which registration failed. */
  label: z.string(),
  /** Human-readable error message explaining why the value was rejected. */
  error: z.string(),
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
