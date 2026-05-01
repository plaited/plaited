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

export const SnapshotEventSchema = BPEventSchema.extend({
  ingress: z.literal(true).optional(),
})

/** @public */
export type SnapshotEvent = z.output<typeof SnapshotEventSchema>

export const SnapshotCandidateSchema = z.object({
  type: z.string(),
  detail: JsonObjectSchema.optional(),
  ingress: z.literal(true).optional(),
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

export const WorkerSnapshotSchema = z.object({
  kind: z.literal(SNAPSHOT_MESSAGE_KINDS.worker),
  response: z.record(z.string(), z.unknown()),
})

/** @public */
export type WorkerSnapshot = z.infer<typeof WorkerSnapshotSchema>

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
  WorkerSnapshotSchema,
])

/** @public */
export type SnapshotMessage = z.output<typeof SnapshotMessageSchema>
