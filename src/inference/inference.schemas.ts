import * as z from 'zod'

/**
 * BP-Mediated Inference Bridge Schemas
 *
 * @remarks
 * This module provides Zod schemas for validating inference bridge types.
 *
 * @public
 */

const SNAPSHOT_KINDS = ['selection', 'deadlock', 'feedback_error', 'extension_error'] as const

/**
 * Schema for executor metadata.
 *
 * @public
 */
export const ExecutorMetadataSchema = z.object({
  executorId: z.string(),
  sessionId: z.string().optional(),
  workspace: z.string().optional(),
})

/**
 * Schema for inference payload (opaque to the bridge).
 *
 * @public
 */
export const InferencePayloadSchema = z.record(z.string(), z.unknown())

/**
 * Schema for a generic executor-originated inference request.
 *
 * @public
 */
export const InferenceRequestSchema = z.object({
  requestId: z.string(),
  correlationId: z.string().optional(),
  executor: ExecutorMetadataSchema,
  payload: InferencePayloadSchema,
})

/**
 * Schema for inference response data (opaque to the bridge).
 *
 * @public
 */
export const InferenceResponseDataSchema = z.record(z.string(), z.unknown())

/**
 * Schema for upstream inference adapter response.
 *
 * @public
 */
export const InferenceResponseSchema = z.object({
  requestId: z.string(),
  data: InferenceResponseDataSchema,
})

/**
 * Schema for upstream inference adapter error.
 *
 * @public
 */
export const InferenceErrorSchema = z.object({
  requestId: z.string(),
  message: z.string(),
  code: z.string().optional(),
})

/**
 * Schema for bridge event type discriminator.
 *
 * @public
 */
export const BridgeEventTypeSchema = z.enum([
  'inference:request',
  'inference:response',
  'inference:error',
  'inference:policy_seam',
])

/**
 * Schema for bridge event detail (discriminated union).
 *
 * @public
 */
export const BridgeRequestDetailSchema = z.object({
  type: z.literal('inference:request'),
  request: InferenceRequestSchema,
})

export const BridgeResponseDetailSchema = z.object({
  type: z.literal('inference:response'),
  response: InferenceResponseSchema,
})

export const BridgeErrorDetailSchema = z.object({
  type: z.literal('inference:error'),
  error: InferenceErrorSchema,
})

export const BridgePolicySeamDetailSchema = z.object({
  type: z.literal('inference:policy_seam'),
  request: InferenceRequestSchema,
  allowed: z.boolean(),
})

/**
 * Discriminated union schema for bridge event details.
 *
 * @public
 */
export const BridgeEventDetailSchema = z.discriminatedUnion('type', [
  BridgeRequestDetailSchema,
  BridgeResponseDetailSchema,
  BridgeErrorDetailSchema,
  BridgePolicySeamDetailSchema,
])

/**
 * Schema for a bridge event envelope.
 *
 * @public
 */
export const BridgeEventSchema = z.object({
  type: BridgeEventTypeSchema,
  timestamp: z.number(),
  requestId: z.string(),
  detail: BridgeEventDetailSchema,
})

/**
 * Schema for BP-normalized snapshot record.
 *
 * @public
 */
export const BPNormalizedSnapshotSchema = z.object({
  snapshotId: z.string(),
  requestId: z.string(),
  timestamp: z.number(),
  kind: z.enum(SNAPSHOT_KINDS),
  data: z.unknown(),
})

/**
 * Schema for trajectory success outcome.
 *
 * @public
 */
export const TrajectorySuccessOutcomeSchema = z.object({
  status: z.literal('success'),
  response: InferenceResponseSchema,
})

/**
 * Schema for trajectory error outcome.
 *
 * @public
 */
export const TrajectoryErrorOutcomeSchema = z.object({
  status: z.literal('error'),
  error: InferenceErrorSchema,
})

/**
 * Schema for trajectory blocked outcome.
 *
 * @public
 */
export const TrajectoryBlockedOutcomeSchema = z.object({
  status: z.literal('blocked'),
  reason: z.string(),
})

/**
 * Discriminated union schema for trajectory outcomes.
 *
 * @public
 */
export const TrajectoryOutcomeSchema = z.discriminatedUnion('status', [
  TrajectorySuccessOutcomeSchema,
  TrajectoryErrorOutcomeSchema,
  TrajectoryBlockedOutcomeSchema,
])

/**
 * Schema for eval-compatible inference trajectory artifact.
 *
 * @public
 */
export const InferenceTrajectorySchema = z.object({
  trajectoryId: z.string(),
  requestId: z.string(),
  events: z.array(BridgeEventSchema),
  snapshots: z.array(BPNormalizedSnapshotSchema),
  outcome: TrajectoryOutcomeSchema,
})
