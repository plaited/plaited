import * as z from 'zod'

import { SNAPSHOT_MESSAGE_KINDS } from './behavioral.constants.ts'

/** @public */
export const JsonObjectSchema = z.record(z.string(), z.json())

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
})

export type BPEvent = z.output<typeof BPEventSchema>

export const DetailSchemaSchema = z.instanceof(z.ZodObject) as z.ZodType<
  z.ZodObject<Record<string, z.ZodType<unknown>>>
>

export type DetailSchema = z.output<typeof DetailSchemaSchema>

export const BPListenerSchema = z.object({
  type: z.string(),
  source: z.enum(['trigger', 'request']).optional(),
  detailSchema: DetailSchemaSchema.optional(),
  detailMatch: z.enum(['valid', 'invalid']).optional(),
})

export type BPListener = z.output<typeof BPListenerSchema>

export const SpecListenerSchema = BPListenerSchema.omit({
  detailSchema: true,
}).extend({
  detailSchema: JsonObjectSchema.optional(),
})

export type SpecListener = z.output<typeof SpecListenerSchema>

export const SpecIdiomsSchema = z.object({
  waitFor: z.array(SpecListenerSchema).min(1).optional(),
  interrupt: z.array(SpecListenerSchema).min(1).optional(),
  block: z.array(SpecListenerSchema).min(1).optional(),
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

/**
 * Schema for a thread reference used across snapshot attribution fields.
 *
 * @remarks
 * `label` is human-readable. `id` is present when a precise runtime instance
 * identifier exists (for example, spawned threads).
 *
 * @public
 */
export const ThreadReferenceSchema = z.object({
  label: z.string(),
  id: z.string().optional(),
})

/** @public */
export type ThreadReference = z.output<typeof ThreadReferenceSchema>

/**
 * Schema for a single bid snapshot from the BP engine's event selection step.
 *
 * @remarks
 * Each bid represents a thread's participation in event selection —
 * what it requested, whether it was selected, blocked, or interrupted.
 * Bids are sorted by priority in the containing {@link SelectionSnapshotSchema}.
 *
 * @see {@link SelectionSnapshotSchema} for the containing snapshot
 *
 * @public
 */
export const SelectionBidSchema = z.object({
  /** Thread reference (stringified Symbol label for external trigger threads). */
  thread: ThreadReferenceSchema,
  /** Explicit source provenance for source-aware matching and replay. */
  source: z.enum(['trigger', 'request']),
  /** Whether this bid was selected for execution in the current step. */
  selected: z.boolean(),
  /** The event type being requested or waited for. */
  type: z.string(),
  /** Optional event payload data. */
  detail: JsonObjectSchema.optional(),
  /** Priority level — lower numbers indicate higher priority. */
  priority: z.number(),
  /** Thread reference that blocked this bid, if blocked. */
  blockedBy: ThreadReferenceSchema.optional(),
  /** Thread reference interrupted when this bid is selected. */
  interrupts: ThreadReferenceSchema.optional(),
})

/** @public */
export type SelectionBid = z.output<typeof SelectionBidSchema>

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
  bids: z.array(SelectionBidSchema),
})

/** @public */
export type SelectionSnapshot = z.output<typeof SelectionSnapshotSchema>

/**
 * Schema for classifying why a bid appears in a deadlock snapshot.
 *
 * @public
 */
export const DeadlockReasonSchema = z.enum(['blocked', 'no_selectable_candidate'])

/** @public */
export type DeadlockReason = z.output<typeof DeadlockReasonSchema>

/**
 * Schema for a bid entry in a deadlock snapshot.
 *
 * @remarks
 * Deadlock bids are always unselected and include a reason code.
 *
 * @public
 */
export const DeadlockBidSchema = SelectionBidSchema.extend({
  selected: z.literal(false),
  reason: DeadlockReasonSchema,
})

/** @public */
export type DeadlockBid = z.output<typeof DeadlockBidSchema>

/**
 * Schema for top-level deadlock diagnostics aggregated across all bids.
 *
 * @public
 */
export const DeadlockSummarySchema = z.object({
  candidateCount: z.number(),
  blockedCount: z.number(),
  unblockedCount: z.number(),
  blockers: z.array(ThreadReferenceSchema),
  interrupters: z.array(ThreadReferenceSchema),
})

/** @public */
export type DeadlockSummary = z.output<typeof DeadlockSummarySchema>

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
  bids: z.array(DeadlockBidSchema),
  summary: DeadlockSummarySchema,
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
  detail: JsonObjectSchema.optional(),
  error: z.string(),
})

/** @public */
export type FeedbackError = z.output<typeof FeedbackErrorSchema>

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
  DeadlockSnapshotSchema,
  FeedbackErrorSchema,
  SelectionSnapshotSchema,
])

/** @public */
export type SnapshotMessage = z.output<typeof SnapshotMessageSchema>
