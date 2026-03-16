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

import { join } from 'node:path'
import { mkdir } from 'node:fs/promises'
import type { RulesFunction, Trigger } from '../behavioral/behavioral.types.ts'
import { bSync, bThread } from '../behavioral/behavioral.utils.ts'
import { AGENT_EVENTS } from './agent.constants.ts'
import type { SensorDeltaDetail, SensorFactory, SensorSnapshot } from './agent.types.ts'

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
 * waits for `sensorCount` deltas, then requests `sensor_sweep` with the
 * accumulated delta payloads.
 *
 * The `deltas` array is a mutable side-channel: the caller populates it
 * via a `sensor_delta` useFeedback handler. By the time the final bSync
 * fires, the array contains all collected payloads (JS reference identity).
 *
 * If no sensors detect changes (`sensorCount === 0`), the tick handler
 * triggers `sleep` directly — this thread is not created.
 *
 * Interrupted by `task` (user preemption) or `message` (cycle end).
 *
 * @param sensorCount - Number of sensors that reported deltas
 * @param deltas - Mutable array populated by a `sensor_delta` handler
 * @returns A `RulesFunction` to register via `bThreads.set()`
 *
 * @public
 */
export const createSensorBatchThread = (sensorCount: number, deltas: SensorDeltaDetail[]): RulesFunction =>
  bThread([
    ...Array.from({ length: sensorCount }, () =>
      bSync({
        waitFor: AGENT_EVENTS.sensor_delta,
        interrupt: [AGENT_EVENTS.task, AGENT_EVENTS.message],
      }),
    ),
    bSync({
      request: { type: AGENT_EVENTS.sensor_sweep, detail: { deltas } },
      interrupt: [AGENT_EVENTS.task, AGENT_EVENTS.message],
    }),
  ])

// ============================================================================
// Sensor Sweep — load snapshots, run sensors, save snapshots
// ============================================================================

/**
 * Result of a single sensor execution during a sweep.
 *
 * @public
 */
export type SensorResult = {
  sensor: string
  delta: unknown
}

/**
 * Run all sensors in parallel: load snapshots, read, diff, save.
 *
 * @remarks
 * Extracted from the tick handler so the logic is testable independently.
 * Each sensor's previous snapshot is loaded from `{memoryPath}/sensors/{snapshotPath}`.
 * After reading, the new snapshot is saved regardless of whether a delta was detected.
 * Sensor errors are non-fatal — a failing sensor is skipped.
 *
 * @param sensors - Sensor factories to execute
 * @param memoryPath - Base path for `.memory/` directory
 * @param signal - AbortSignal for timeout control
 * @returns Array of non-null deltas (sensor name + delta payload)
 *
 * @public
 */
export const runSensorSweep = async (
  sensors: SensorFactory[],
  memoryPath: string,
  signal: AbortSignal,
): Promise<SensorResult[]> => {
  const sensorsDir = join(memoryPath, 'sensors')

  // Ensure sensors directory exists
  await mkdir(sensorsDir, { recursive: true })

  const results = await Promise.all(
    sensors.map(async (sensor): Promise<SensorResult | null> => {
      try {
        // Load previous snapshot
        const snapshotFile = Bun.file(join(sensorsDir, sensor.snapshotPath))
        let previous: SensorSnapshot | null = null
        if (await snapshotFile.exists()) {
          previous = (await snapshotFile.json()) as SensorSnapshot
        }

        // Read current state
        const current = await sensor.read(signal)

        // Diff against previous
        const delta = sensor.diff(current, previous)

        // Save new snapshot (always, even if no delta)
        const snapshot: SensorSnapshot = {
          timestamp: new Date().toISOString(),
          data: current,
        }
        await Bun.write(join(sensorsDir, sensor.snapshotPath), JSON.stringify(snapshot, null, 2))

        if (delta !== null) {
          return { sensor: sensor.name, delta }
        }
        return null
      } catch {
        // Sensor errors are non-fatal — skip this sensor
        return null
      }
    }),
  )

  return results.filter((r): r is SensorResult => r !== null)
}
