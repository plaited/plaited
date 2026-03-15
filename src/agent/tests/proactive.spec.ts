/**
 * Tests for proactive heartbeat bThread patterns.
 */

import { afterEach, describe, expect, test } from 'bun:test'
import { behavioral } from '../../behavioral/behavioral.ts'
import { AGENT_EVENTS } from '../agent.constants.ts'
import {
  createHeartbeatTimer,
  createTickYieldThread,
  createSensorBatchThread,
} from '../proactive.ts'
import type { HeartbeatHandle } from '../proactive.ts'

// ============================================================================
// Helpers
// ============================================================================

/** Wait for a number of milliseconds. */
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/** Create a feedback handler that records events without returning a value. */
const recorder = (events: string[], name: string) => () => {
  events.push(name)
}

// ============================================================================
// Tests
// ============================================================================

describe('createHeartbeatTimer', () => {
  let handle: HeartbeatHandle | undefined

  afterEach(() => {
    handle?.destroy()
    handle = undefined
  })

  test('fires tick events at configured interval', async () => {
    const triggered: { type: string; detail?: unknown }[] = []
    handle = createHeartbeatTimer({
      trigger: (event) => {
        triggered.push(event)
      },
      intervalMs: 50,
    })

    await wait(130)

    expect(triggered.length).toBeGreaterThanOrEqual(2)
    expect(triggered[0]!.type).toBe(AGENT_EVENTS.tick)

    const detail = triggered[0]!.detail as { tickNumber: number; timestamp: string }
    expect(detail.tickNumber).toBe(1)
    expect(detail.timestamp).toBeDefined()
  })

  test('increments tickNumber on each tick', async () => {
    const triggered: { type: string; detail?: unknown }[] = []
    handle = createHeartbeatTimer({
      trigger: (event) => {
        triggered.push(event)
      },
      intervalMs: 30,
    })

    await wait(100)

    expect(triggered.length).toBeGreaterThanOrEqual(2)
    const ticks = triggered.map((e) => (e.detail as { tickNumber: number }).tickNumber)
    // Verify monotonic increment
    for (let i = 1; i < ticks.length; i++) {
      expect(ticks[i]).toBe(ticks[i - 1]! + 1)
    }
  })

  test('setInterval reconfigures the timer', async () => {
    const triggered: { type: string }[] = []
    handle = createHeartbeatTimer({
      trigger: (event) => {
        triggered.push(event)
      },
      intervalMs: 30,
    })

    await wait(80)
    const countBefore = triggered.length

    // Pause
    handle.setInterval(0)
    await wait(80)

    // No new ticks while paused
    expect(triggered.length).toBe(countBefore)
  })

  test('setInterval(0) pauses the heartbeat', async () => {
    const triggered: { type: string }[] = []
    handle = createHeartbeatTimer({
      trigger: (event) => {
        triggered.push(event)
      },
      intervalMs: 30,
    })

    handle.setInterval(0)
    await wait(80)

    expect(triggered.length).toBe(0)
  })

  test('destroy stops the timer', async () => {
    const triggered: { type: string }[] = []
    handle = createHeartbeatTimer({
      trigger: (event) => {
        triggered.push(event)
      },
      intervalMs: 30,
    })

    handle.destroy()
    handle = undefined // prevent afterEach double-destroy
    await wait(80)

    expect(triggered.length).toBe(0)
  })

  test('defaults to 15 minute interval', () => {
    const triggered: { type: string }[] = []
    handle = createHeartbeatTimer({
      trigger: (event) => {
        triggered.push(event)
      },
    })

    // Can't easily test 15min interval — just verify no immediate fire
    expect(triggered.length).toBe(0)
  })
})

describe('createTickYieldThread', () => {
  test('interrupts proactive cycle when task arrives', () => {
    const { bThreads, trigger, useFeedback } = behavioral()
    const events: string[] = []

    useFeedback({
      [AGENT_EVENTS.tick]: recorder(events, 'tick'),
      [AGENT_EVENTS.task]: recorder(events, 'task'),
      [AGENT_EVENTS.message]: recorder(events, 'message'),
    })

    bThreads.set({
      tickYield: createTickYieldThread(),
    })

    // Fire tick — tickYield advances to wait for message
    trigger({ type: AGENT_EVENTS.tick })
    expect(events).toContain('tick')

    // Fire task — tickYield should be interrupted (thread killed)
    trigger({ type: AGENT_EVENTS.task })
    expect(events).toContain('task')

    // tickYield should have reset (repeat: true)
    // Fire another tick to verify it's still active
    trigger({ type: AGENT_EVENTS.tick })
    const tickCount = events.filter((e) => e === 'tick').length
    expect(tickCount).toBe(2)
  })

  test('completes normally when message fires after tick', () => {
    const { bThreads, trigger, useFeedback } = behavioral()
    const events: string[] = []

    useFeedback({
      [AGENT_EVENTS.tick]: recorder(events, 'tick'),
      [AGENT_EVENTS.message]: recorder(events, 'message'),
    })

    bThreads.set({
      tickYield: createTickYieldThread(),
    })

    // Normal cycle: tick → message
    trigger({ type: AGENT_EVENTS.tick })
    trigger({ type: AGENT_EVENTS.message, detail: { content: 'done' } })

    expect(events).toEqual(['tick', 'message'])

    // Should loop — ready for next tick
    trigger({ type: AGENT_EVENTS.tick })
    expect(events).toEqual(['tick', 'message', 'tick'])
  })
})

describe('createSensorBatchThread', () => {
  test('waits for N sensor_delta events then requests sensor_sweep', () => {
    const { bThreads, trigger, useFeedback } = behavioral()
    const events: string[] = []

    useFeedback({
      [AGENT_EVENTS.sensor_delta]: recorder(events, 'sensor_delta'),
      [AGENT_EVENTS.sensor_sweep]: recorder(events, 'sensor_sweep'),
    })

    bThreads.set({
      sensorBatch: createSensorBatchThread(2),
    })

    // Fire 2 sensor deltas
    trigger({ type: AGENT_EVENTS.sensor_delta, detail: { sensor: 'git', delta: { changed: true } } })
    trigger({ type: AGENT_EVENTS.sensor_delta, detail: { sensor: 'fs', delta: { changed: true } } })

    // sensor_sweep should be requested after both deltas arrive
    expect(events).toContain('sensor_sweep')
    expect(events.filter((e) => e === 'sensor_delta').length).toBe(2)
  })

  test('zero-length batch requests sensor_sweep on next super-step', () => {
    const { bThreads, trigger, useFeedback } = behavioral()
    const events: string[] = []

    useFeedback({
      [AGENT_EVENTS.tick]: recorder(events, 'tick'),
      [AGENT_EVENTS.sensor_sweep]: recorder(events, 'sensor_sweep'),
    })

    // Zero sensors — bThread has no waitFor steps, goes straight to request.
    // In practice, this is always created inside a tick handler where a
    // super-step is already running. The request fires on the next step.
    bThreads.set({
      sensorBatch: createSensorBatchThread(0),
    })

    // Trigger a super-step — the pending request is selected
    trigger({ type: AGENT_EVENTS.tick })

    expect(events).toContain('sensor_sweep')
  })

  test('interrupts on task event (user preemption)', () => {
    const { bThreads, trigger, useFeedback } = behavioral()
    const events: string[] = []

    useFeedback({
      [AGENT_EVENTS.sensor_delta]: recorder(events, 'sensor_delta'),
      [AGENT_EVENTS.sensor_sweep]: recorder(events, 'sensor_sweep'),
      [AGENT_EVENTS.task]: recorder(events, 'task'),
    })

    bThreads.set({
      sensorBatch: createSensorBatchThread(3),
    })

    // Fire 1 of 3 expected deltas
    trigger({ type: AGENT_EVENTS.sensor_delta, detail: { sensor: 'git', delta: {} } })

    // User sends task — should interrupt sensor batch
    trigger({ type: AGENT_EVENTS.task, detail: { prompt: 'hello' } })
    expect(events).toContain('task')

    // sensor_sweep should NOT have fired (interrupted before completing)
    expect(events).not.toContain('sensor_sweep')
  })

  test('interrupts on message event (cycle end)', () => {
    const { bThreads, trigger, useFeedback } = behavioral()
    const events: string[] = []

    useFeedback({
      [AGENT_EVENTS.sensor_delta]: recorder(events, 'sensor_delta'),
      [AGENT_EVENTS.sensor_sweep]: recorder(events, 'sensor_sweep'),
      [AGENT_EVENTS.message]: recorder(events, 'message'),
    })

    bThreads.set({
      sensorBatch: createSensorBatchThread(2),
    })

    // Fire 1 of 2 expected deltas
    trigger({ type: AGENT_EVENTS.sensor_delta, detail: { sensor: 'git', delta: {} } })

    // Message fires (loop ends) — should interrupt sensor batch
    trigger({ type: AGENT_EVENTS.message, detail: { content: 'done' } })
    expect(events).toContain('message')

    // sensor_sweep should NOT have fired
    expect(events).not.toContain('sensor_sweep')
  })

  test('one-shot thread terminates after completion', () => {
    const { bThreads, trigger, useFeedback } = behavioral()
    let sweepCount = 0

    useFeedback({
      [AGENT_EVENTS.sensor_sweep]: () => {
        sweepCount++
      },
    })

    bThreads.set({
      sensorBatch: createSensorBatchThread(1),
    })

    trigger({ type: AGENT_EVENTS.sensor_delta, detail: { sensor: 'git', delta: {} } })

    // Thread should have terminated (no repeat)
    const status = bThreads.has('sensorBatch')
    expect(status.running).toBe(false)
    expect(sweepCount).toBe(1)
  })
})
