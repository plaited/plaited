/**
 * BP-Mediated Inference Bridge Module
 *
 * @remarks
 * This module provides the runtime bridge for routing executor-originated inference
 * traffic through behavioral programming. It enables future policy, MSS, and eval
 * work to attach to real trajectories.
 *
 * The bridge is intentionally narrow: policy-neutral pass-through behavior first,
 * observable BP snapshots always.
 *
 * @public
 */

// Re-export schemas
export {
  BPNormalizedSnapshotSchema,
  BridgeEventDetailSchema,
  BridgeEventSchema,
  BridgeEventTypeSchema,
  ExecutorMetadataSchema,
  InferenceErrorSchema,
  InferencePayloadSchema,
  InferenceRequestSchema,
  InferenceResponseDataSchema,
  InferenceResponseSchema,
  InferenceTrajectorySchema,
  TrajectoryBlockedOutcomeSchema,
  TrajectoryErrorOutcomeSchema,
  TrajectoryOutcomeSchema,
  TrajectorySuccessOutcomeSchema,
} from './inference.schemas.ts'
// Re-export types from types file
export type {
  BPNormalizedSnapshot,
  BridgeEvent,
  BridgeEventDetail,
  BridgeEventType,
  ExecutorMetadata,
  InferenceAdapter,
  InferenceError,
  InferencePayload,
  InferencePolicy,
  InferenceRequest,
  InferenceResponse,
  InferenceResponseData,
  InferenceTrajectory,
  TrajectoryOutcome,
} from './inference.types.ts'
// Re-export policy
export { defaultInferencePolicy } from './inference.types.ts'
export type { InferenceBridge, InferenceBridgeOptions, InferenceBridgeResult } from './inference-bridge.ts'
// Re-export implementation
export { createInferenceBridge } from './inference-bridge.ts'
