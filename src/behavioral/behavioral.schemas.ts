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
  /** Thread identifier (stringified Symbol if from an external trigger). */
  thread: z.string(),
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
  /** Identifier of the thread that blocked this bid, if blocked. */
  blockedBy: z.string().optional(),
  /** Identifier of the thread interrupted when this bid is selected. */
  interrupts: z.string().optional(),
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
 * @see {@link FeedbackErrorSchema} for feedback handler errors
 * @see {@link RestrictedTriggerErrorSchema} for restricted trigger rejections
 * @see {@link BThreadsWarningSchema} for duplicate thread warnings
 *
 * @public
 */
export const SnapshotMessageSchema = z.discriminatedUnion('kind', [
  BThreadsWarningSchema,
  FeedbackErrorSchema,
  RestrictedTriggerErrorSchema,
  SelectionSnapshotSchema,
])

/** @public */
export type SnapshotMessage = z.infer<typeof SnapshotMessageSchema>
