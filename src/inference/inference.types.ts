/**
 * BP-Mediated Inference Bridge Types
 *
 * @remarks
 * This module defines the type contracts for the BP-mediated inference bridge.
 * The bridge accepts executor-originated inference requests, routes them through
 * a behavioral() program, calls a fakeable upstream inference adapter, and returns
 * the upstream response while preserving event/snapshot artifacts for eval.
 *
 * @public
 */

/**
 * Executor metadata attached to inference requests.
 *
 * @public
 */
export type ExecutorMetadata = {
  /** Executor identifier (e.g., 'cline', 'agent-core'). */
  executorId: string
  /** Session or conversation context identifier. */
  sessionId?: string
  /** Optional workspace root for executor context. */
  workspace?: string
}

/**
 * Generic executor-originated inference request.
 *
 * @public
 */
export type InferenceRequest = {
  /** Unique identifier for this request. */
  requestId: string
  /** Correlation identifier for related request chains. */
  correlationId?: string
  /** Executor metadata for the request origin. */
  executor: ExecutorMetadata
  /** The actual inference payload (model-specific). */
  payload: InferencePayload
}

/**
 * Inference payload shape (model-specific, opaque to the bridge).
 *
 * @remarks
 * The bridge treats this as opaque bytes/object data. Actual inference
 * adapters interpret the specific shape.
 *
 * @public
 */
// biome-ignore lint/suspicious/noExplicitAny: Bridge treats payload as opaque
export type InferencePayload = Record<string, any>

/**
 * Upstream inference adapter response.
 *
 * @public
 */
export type InferenceResponse = {
  /** Request ID this response corresponds to. */
  requestId: string
  /** The actual response data (model-specific). */
  data: InferenceResponseData
}

/**
 * Inference response data (model-specific, opaque to the bridge).
 *
 * @public
 */
// biome-ignore lint/suspicious/noExplicitAny: Bridge treats response as opaque
export type InferenceResponseData = Record<string, any>

/**
 * Error from upstream inference adapter.
 *
 * @public
 */
export type InferenceError = {
  /** Request ID this error corresponds to. */
  requestId: string
  /** Error message. */
  message: string
  /** Optional error code. */
  code?: string
}

/**
 * Fakeable upstream inference adapter interface.
 *
 * @remarks
 * The adapter is injected into the bridge, enabling:
 * - Real inference calls (production)
 * - Fake/stub responses (testing)
 * - Mock implementations (eval)
 *
 * @public
 */
export type InferenceAdapter = {
  /**
   * Execute an inference request against the upstream model.
   *
   * @param request - The inference request to execute.
   * @returns The inference response or throws InferenceError.
   */
  execute(request: InferenceRequest): Promise<InferenceResponse>
}

/**
 * Bridge event types emitted during bridge lifecycle.
 *
 * @public
 */
export type BridgeEventType = 'inference:request' | 'inference:response' | 'inference:error' | 'inference:policy_seam'

/**
 * Bridge event envelope for observability.
 *
 * @public
 */
export type BridgeEvent = {
  /** Event type discriminator. */
  type: BridgeEventType
  /** Timestamp when the event occurred. */
  timestamp: number
  /** Request ID this event relates to. */
  requestId: string
  /** Event-specific payload. */
  detail: BridgeEventDetail
}

/**
 * Union of all bridge event detail payloads.
 *
 * @public
 */
export type BridgeEventDetail =
  | { type: 'inference:request'; request: InferenceRequest }
  | { type: 'inference:response'; response: InferenceResponse }
  | { type: 'inference:error'; error: InferenceError }
  | { type: 'inference:policy_seam'; request: InferenceRequest; allowed: boolean }

/**
 * BP snapshot record for eval-compatible trajectory mapping.
 *
 * @remarks
 * This is a normalized snapshot record that preserves the BP engine's
 * state for eval and replay scenarios.
 *
 * @public
 */
export type BPNormalizedSnapshot = {
  /** Unique identifier for this snapshot. */
  snapshotId: string
  /** Request ID this snapshot relates to. */
  requestId: string
  /** Timestamp when the snapshot was taken. */
  timestamp: number
  /** Raw BP snapshot message kind. */
  kind: 'selection' | 'deadlock' | 'feedback_error' | 'extension_error'
  /** Snapshot data (structure varies by kind). */
  data: unknown
}

/**
 * Trajectory artifact for eval mapping.
 *
 * @remarks
 * Contains all events and snapshots for a complete inference request lifecycle.
 * This shape is designed for eval-compatible serialization and replay.
 *
 * @public
 */
export type InferenceTrajectory = {
  /** Unique trajectory identifier. */
  trajectoryId: string
  /** Request ID this trajectory corresponds to. */
  requestId: string
  /** All bridge events in order. */
  events: BridgeEvent[]
  /** All BP snapshots in order. */
  snapshots: BPNormalizedSnapshot[]
  /** Final outcome. */
  outcome: TrajectoryOutcome
}

/**
 * Final outcome of an inference trajectory.
 *
 * @public
 */
export type TrajectoryOutcome =
  | { status: 'success'; response: InferenceResponse }
  | { status: 'error'; error: InferenceError }
  | { status: 'blocked'; reason: string }

/**
 * Policy seam extension point for BP-mediated execution.
 *
 * @remarks
 * This is a future extension point where bThreads/extensions can attach
 * before inference execution. The default policy allows all requests through.
 *
 * @public
 */
export type InferencePolicy = {
  /**
   * Evaluate whether a request should proceed.
   *
   * @param request - The inference request to evaluate.
   * @returns True if the request is allowed, false if blocked.
   */
  evaluate(request: InferenceRequest): boolean
}

/**
 * Default policy that allows all requests through.
 *
 * @public
 */
export const defaultInferencePolicy: InferencePolicy = {
  evaluate: () => true,
}
