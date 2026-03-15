/**
 * Proactive heartbeat bThread patterns for autonomous agent operation.
 *
 * @remarks
 * Three composable bThread factories that enable the agent to act without
 * user prompting. The heartbeat timer fires `tick` events into the existing
 * BP engine, and these threads coordinate sensor sweeps, user preemption,
 * and batch completion.
 *
 * - `createHeartbeatThread`: Fires `tick` events on a configurable interval
 * - `createTickYieldThread`: Ensures user `task` events interrupt proactive cycles
 * - `createSensorBatchThread`: Coordinates parallel sensor execution
 *
 * All threads use production BP primitives from `src/behavioral/`.
 * Designed for additive composition — each can be set independently
 * on a `behavioral()` instance's `bThreads`.
 *
 * @public
 */

import type { RulesFunction, Trigger } from '../behavioral/behavioral.types.ts'
import { bSync, bThread } from '../behavioral/behavioral.utils.ts'
import { AGENT_EVENTS } from './agent.constants.ts'

// ============================================================================
// Types
// ============================================================================

/**
 * Configuration for the heartbeat timer.
 *
 * @public
 */
export type HeartbeatConfig = {
  /** Trigger function from the behavioral instance */
  trigger: Trigger
  /** Heartbeat interval in milliseconds (default: 900000 = 15 min) */
  intervalMs?: number
}

/**
 * Return type of `createHeartbeatThread`.
 *
 * @remarks
 * Exposes `setInterval` for runtime reconfiguration (e.g. via
 * `set_heartbeat` tool call) and `destroy` for cleanup.
 *
 * @public
 */
export type HeartbeatHandle = {
  /** Reconfigure the heartbeat interval. 0 = pause. */
  setInterval: (intervalMs: number) => void
  /** Stop the heartbeat and clean up the timer. */
  destroy: () => void
}

// ============================================================================
// Heartbeat Timer
// ============================================================================

/**
 * Create a heartbeat timer that fires `tick` events into the BP engine.
 *
 * @remarks
 * The heartbeat is NOT a bThread — it's an external timer that calls
 * `trigger()`. BP event selection handles all coordination (taskGate
 * blocks ticks during active user tasks). This follows the design in
 * `docs/AGENT-LOOP.md § Proactive Mode`.
 *
 * @param config - Heartbeat configuration
 * @returns A handle for reconfiguring or destroying the heartbeat
 *
 * @public
 */
export const createHeartbeatTimer = ({ trigger, intervalMs = 15 * 60 * 1000 }: HeartbeatConfig): HeartbeatHandle => {
  let timerId: Timer | undefined
  let tickNumber = 0

  const setHeartbeatInterval = (ms: number) => {
    if (timerId !== undefined) {
      clearInterval(timerId)
      timerId = undefined
    }
    if (ms > 0) {
      timerId = setInterval(() => {
        tickNumber++
        trigger({
          type: AGENT_EVENTS.tick,
          detail: { tickNumber, timestamp: new Date().toISOString() },
        })
      }, ms)
    }
  }

  // Start immediately with configured interval
  setHeartbeatInterval(intervalMs)

  return {
    setInterval: setHeartbeatInterval,
    destroy: () => {
      if (timerId !== undefined) {
        clearInterval(timerId)
        timerId = undefined
      }
    },
  }
}

// ============================================================================
// Tick Yield Thread
// ============================================================================

/**
 * Create a bThread that ensures user tasks interrupt proactive cycles.
 *
 * @remarks
 * When a `tick` fires, this thread advances to wait for `message`
 * (proactive cycle completion). If a `task` arrives before the cycle
 * finishes, the thread interrupts — giving priority to the user.
 *
 * Uses `repeat: true` so it resets after each cycle.
 *
 * @returns A `RulesFunction` to register via `bThreads.set()`
 *
 * @public
 */
export const createTickYieldThread = (): RulesFunction =>
  bThread(
    [
      bSync({ waitFor: AGENT_EVENTS.tick }),
      bSync({
        waitFor: AGENT_EVENTS.message,
        interrupt: [AGENT_EVENTS.task],
      }),
    ],
    true,
  )

// ============================================================================
// Sensor Batch Thread
// ============================================================================

/**
 * Create a bThread that coordinates parallel sensor execution.
 *
 * @remarks
 * After a tick fires, the tick handler runs all sensors in parallel.
 * Each sensor that detects a change triggers `sensor_delta`. This thread
 * waits for `sensorCount` deltas, then requests `context_assembly` to
 * feed the deltas into the inference pipeline.
 *
 * If no sensors detect changes (`sensorCount === 0`), the tick handler
 * triggers `sleep` directly — this thread is not created.
 *
 * Interrupted by `task` (user preemption) or `message` (cycle end).
 *
 * @param sensorCount - Number of sensors that reported deltas
 * @returns A `RulesFunction` to register via `bThreads.set()`
 *
 * @public
 */
export const createSensorBatchThread = (sensorCount: number): RulesFunction =>
  bThread([
    ...Array.from({ length: sensorCount }, () =>
      bSync({
        waitFor: AGENT_EVENTS.sensor_delta,
        interrupt: [AGENT_EVENTS.task, AGENT_EVENTS.message],
      }),
    ),
    bSync({
      request: { type: AGENT_EVENTS.sensor_sweep, detail: { deltas: [] } },
      interrupt: [AGENT_EVENTS.task, AGENT_EVENTS.message],
    }),
  ])
