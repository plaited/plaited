import * as z from 'zod'

import { SNAPSHOT_MESSAGE_KINDS } from './behavioral.constants.ts'
import type { BPEvent } from './behavioral.types.ts'
import { isBPEvent } from './behavioral.utils.ts'

/**
 * Schema for validating BPEvent objects.
 * Uses the framework's `isBPEvent` type guard for runtime validation.
 *
 * @public
 */
export const BPEventSchema = z.custom<BPEvent>(isBPEvent)

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
export type ThreadReference = z.infer<typeof ThreadReferenceSchema>

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
  /** Whether this bid originated from an external `trigger()` call. */
  trigger: z.boolean(),
  /** Whether this bid was selected for execution in the current step. */
  selected: z.boolean(),
  /** The event type being requested or waited for. */
  type: z.string(),
  /** Optional event payload data. */
  detail: z.unknown().optional(),
  /** Priority level — lower numbers indicate higher priority. */
  priority: z.number(),
  /** Thread reference that blocked this bid, if blocked. */
  blockedBy: ThreadReferenceSchema.optional(),
  /** Thread reference interrupted when this bid is selected. */
  interrupts: ThreadReferenceSchema.optional(),
})

/** @public */
export type SelectionBid = z.infer<typeof SelectionBidSchema>

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
export type SelectionSnapshot = z.infer<typeof SelectionSnapshotSchema>

/**
 * Schema for classifying why a bid appears in a deadlock snapshot.
 *
 * @public
 */
export const DeadlockReasonSchema = z.enum(['blocked', 'no_selectable_candidate'])

/** @public */
export type DeadlockReason = z.infer<typeof DeadlockReasonSchema>

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
export type DeadlockBid = z.infer<typeof DeadlockBidSchema>

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
  interruptors: z.array(ThreadReferenceSchema),
})

/** @public */
export type DeadlockSummary = z.infer<typeof DeadlockSummarySchema>

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
export type DeadlockSnapshot = z.infer<typeof DeadlockSnapshotSchema>

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
  detail: z.unknown().optional(),
  error: z.string(),
})

/** @public */
export type FeedbackError = z.infer<typeof FeedbackErrorSchema>

/**
 * Schema for restricted trigger rejection errors.
 *
 * @remarks
 * Emitted when a restricted trigger rejects an event not in its allowed set.
 * The rejected event never reaches the BP engine.
 * Consumers narrow by `kind === 'restricted_trigger_error'`.
 *
 * @see {@link SnapshotMessageSchema} for the full discriminated union
 *
 * @public
 */
export const RestrictedTriggerErrorSchema = z.object({
  kind: z.literal(SNAPSHOT_MESSAGE_KINDS.restricted_trigger_error),
  type: z.string(),
  detail: z.unknown().optional(),
  error: z.string(),
})

/** @public */
export type RestrictedTriggerError = z.infer<typeof RestrictedTriggerErrorSchema>

/**
 * Schema for b-thread warnings published by the BP engine.
 *
 * @remarks
 * Emitted when `bThreads.set()` attempts to add a thread with an identifier
 * that already exists. The duplicate thread is ignored.
 * Consumers narrow by `kind === 'bthreads_warning'`.
 *
 * @see {@link SnapshotMessageSchema} for the full discriminated union
 *
 * @public
 */
export const BThreadsWarningSchema = z.object({
  kind: z.literal(SNAPSHOT_MESSAGE_KINDS.bthreads_warning),
  thread: z.string(),
  warning: z.string(),
})

/** @public */
export type BThreadsWarning = z.infer<typeof BThreadsWarningSchema>

/**
 * Discriminated union schema for all observable moments from the BP engine.
 * Consumers narrow by the `kind` field.
 *
 * @see {@link SelectionSnapshotSchema} for event selection observations
 * @see {@link DeadlockSnapshotSchema} for blocked-candidate deadlock observations
 * @see {@link FeedbackErrorSchema} for feedback handler errors
 * @see {@link RestrictedTriggerErrorSchema} for restricted trigger rejections
 * @see {@link BThreadsWarningSchema} for duplicate thread warnings
 *
 * @public
 */
export const SnapshotMessageSchema = z.discriminatedUnion('kind', [
  BThreadsWarningSchema,
  DeadlockSnapshotSchema,
  FeedbackErrorSchema,
  RestrictedTriggerErrorSchema,
  SelectionSnapshotSchema,
])

/** @public */
export type SnapshotMessage = z.infer<typeof SnapshotMessageSchema>
