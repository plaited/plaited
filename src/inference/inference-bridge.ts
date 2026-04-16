import type { SnapshotMessage } from '../behavioral/behavioral.schemas.ts'
import { behavioral } from '../behavioral.ts'
import { ueid } from '../utils/ueid.ts'
import { InferenceTrajectorySchema } from './inference.schemas.ts'
import type {
  BPNormalizedSnapshot,
  BridgeEvent,
  BridgeEventDetail,
  BridgeEventType,
  InferenceAdapter,
  InferenceError,
  InferencePolicy,
  InferenceRequest,
  InferenceResponse,
  InferenceTrajectory,
  TrajectoryOutcome,
} from './inference.types.ts'

/**
 * BP-Mediated Inference Bridge Implementation
 *
 * @remarks
 * This module implements the runtime bridge that:
 * - Accepts generic executor-originated inference requests
 * - Routes them through a behavioral() program
 * - Calls a fakeable upstream inference adapter
 * - Returns the upstream response while preserving event/snapshot artifacts for eval
 *
 * Default behavior is transparent/pass-through: no blocking, mutation, redaction,
 * or forked inference. A future policy seam allows bThreads/extensions to
 * attach before execution.
 *
 * @public
 */

const INFERENCE_BRIDGE_ID = 'inference_bridge'

/** Event types used internally by the bridge */
const INFERENCE_EVENTS = {
  REQUEST: 'inference:request',
  RESPONSE: 'inference:response',
  ERROR: 'inference:error',
  POLICY_SEAM: 'inference:policy_seam',
} as const

/**
 * Configuration options for the inference bridge.
 *
 * @public
 */
export type InferenceBridgeOptions = {
  /** The upstream inference adapter (fakeable for testing). */
  adapter: InferenceAdapter
  /** Policy seam for request evaluation. Defaults to pass-through. */
  policy?: InferencePolicy
}

/**
 * Result from executing an inference request through the bridge.
 *
 * @public
 */
export type InferenceBridgeResult = {
  /** The inference response from the upstream adapter. */
  response: InferenceResponse
  /** The eval-compatible trajectory artifact. */
  trajectory: InferenceTrajectory
}

/**
 * Normalize a BP snapshot message to eval-compatible record.
 */
const normalizeSnapshot = (snapshot: SnapshotMessage, requestId: string): BPNormalizedSnapshot => {
  return {
    snapshotId: ueid('snap_'),
    requestId,
    timestamp: Date.now(),
    kind: snapshot.kind,
    data: snapshot,
  }
}

/**
 * Emit a bridge event to the trajectory.
 */
const emitBridgeEvent = (
  events: BridgeEvent[],
  type: BridgeEventType,
  requestId: string,
  detail: BridgeEventDetail,
): void => {
  events.push({
    type,
    timestamp: Date.now(),
    requestId,
    detail,
  })
}

/**
 * Creates a BP-mediated inference bridge.
 *
 * @remarks
 * The bridge uses a behavioral() program to coordinate inference requests.
 * By default, requests pass through transparently. The policy seam allows
 * bThreads/extensions to attach and evaluate requests before execution.
 *
 * @param options - Bridge configuration including the inference adapter.
 * @returns Bridge execute function.
 *
 * @example
 * ```typescript
 * const fakeAdapter: InferenceAdapter = {
 *   execute: async (request) => ({
 *     requestId: request.requestId,
 *     data: { content: `Response to: ${JSON.stringify(request.payload)}` }
 *   })
 * }
 *
 * const bridge = createInferenceBridge({ adapter: fakeAdapter })
 * const result = await bridge.execute({
 *   requestId: 'req-1',
 *   executor: { executorId: 'test' },
 *   payload: { prompt: 'Hello' }
 * })
 * ```
 *
 * @public
 */
export const createInferenceBridge = (options: InferenceBridgeOptions) => {
  const { adapter, policy = { evaluate: () => true } } = options

  /**
   * Execute an inference request through the BP-mediated bridge.
   *
   * @param request - The inference request to execute.
   * @returns Promise resolving to the inference response and trajectory.
   */
  const execute = async (request: InferenceRequest): Promise<InferenceBridgeResult> => {
    const trajectoryId = ueid('traj_')
    const events: BridgeEvent[] = []
    const snapshots: BPNormalizedSnapshot[] = []

    // Create a fresh behavioral program for this request
    const { trigger, useSnapshot } = behavioral()

    // Subscribe to BP snapshots for trajectory preservation
    const disconnectSnapshot = useSnapshot((snapshot: SnapshotMessage) => {
      snapshots.push(normalizeSnapshot(snapshot, request.requestId))
    })

    // Emit request event
    emitBridgeEvent(events, INFERENCE_EVENTS.REQUEST, request.requestId, {
      type: 'inference:request',
      request,
    })

    // Policy seam evaluation via BP trigger
    const allowed = policy.evaluate(request)
    emitBridgeEvent(events, INFERENCE_EVENTS.POLICY_SEAM, request.requestId, {
      type: 'inference:policy_seam',
      request,
      allowed,
    })

    // Trigger policy seam event through BP
    trigger({
      type: INFERENCE_EVENTS.POLICY_SEAM,
      detail: { request, allowed },
    })

    let response: InferenceResponse
    let outcome: TrajectoryOutcome

    if (!allowed) {
      // Request was blocked by policy
      outcome = { status: 'blocked', reason: 'policy evaluation returned false' }
      disconnectSnapshot()
      return buildResult(trajectoryId, request.requestId, events, snapshots, outcome)
    }

    try {
      // Execute inference via adapter
      response = await adapter.execute(request)

      // Emit response event
      emitBridgeEvent(events, INFERENCE_EVENTS.RESPONSE, request.requestId, {
        type: 'inference:response',
        response,
      })

      // Trigger response event through BP
      trigger({
        type: INFERENCE_EVENTS.RESPONSE,
        detail: { response },
      })

      outcome = { status: 'success', response }
    } catch (error) {
      const inferenceError: InferenceError = {
        requestId: request.requestId,
        message: error instanceof Error ? error.message : String(error),
        code: error instanceof Error ? error.name : undefined,
      }

      // Emit error event
      emitBridgeEvent(events, INFERENCE_EVENTS.ERROR, request.requestId, {
        type: 'inference:error',
        error: inferenceError,
      })

      // Trigger error event through BP
      trigger({
        type: INFERENCE_EVENTS.ERROR,
        detail: { error: inferenceError },
      })

      outcome = { status: 'error', error: inferenceError }
    }

    disconnectSnapshot()

    return buildResult(trajectoryId, request.requestId, events, snapshots, outcome)
  }

  const buildResult = (
    trajectoryId: string,
    requestId: string,
    events: BridgeEvent[],
    snapshots: BPNormalizedSnapshot[],
    outcome: TrajectoryOutcome,
  ): InferenceBridgeResult => {
    const trajectory: InferenceTrajectory = {
      trajectoryId,
      requestId,
      events,
      snapshots,
      outcome,
    }

    // Validate trajectory schema
    InferenceTrajectorySchema.parse(trajectory)

    const response: InferenceResponse =
      outcome.status === 'success'
        ? outcome.response
        : { requestId, data: { error: outcome.status === 'error' ? outcome.error.message : outcome.reason } }

    return { response, trajectory }
  }

  return { execute, id: INFERENCE_BRIDGE_ID }
}

/**
 * Type alias for the bridge factory result.
 *
 * @public
 */
export type InferenceBridge = ReturnType<typeof createInferenceBridge>
