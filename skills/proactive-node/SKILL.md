---
name: proactive-node
description: Contracts and implementation guidance for proactive Plaited nodes: SensorFactory, GoalFactory, notification routing, and loop wiring.
metadata:
  domain: Proactive
  artifact_types: sensor+goal+notification
---

# Proactive Node

This skill documents the stable contracts and implementation rules for proactive
Plaited nodes: sensors that watch external state, goals that react to change, and
notification handlers that route alerts.

Use it when implementing or reviewing proactive surfaces. Do not treat it as a
generator mandate for exact file names or a complete research program.

---

## SensorFactory Contract

A sensor reads current state and diffs against the previous snapshot.

```typescript
import type { SensorFactory, SensorSnapshot } from 'src/agent/agent.types.ts'

export const mySensor: SensorFactory = {
  name: 'my-sensor',             // unique sensor identifier — used in sensor_delta events
  snapshotPath: 'my-sensor.json', // relative path under .memory/sensors/

  async read(signal: AbortSignal): Promise<unknown> {
    // Read current state. Check signal.aborted if the operation is long.
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
    return { /* current state */ }
  },

  diff(current: unknown, previous: SensorSnapshot | null): unknown | null {
    // First run: previous is null — report initial state as delta if non-empty
    if (!previous) return current
    const prev = previous.data as YourDataType
    const curr = current as YourDataType
    // Compute differences; return null if unchanged
    return hasChanges ? { changedFields } : null
  },
}
```

**Required fields:**
- `name: string` — matches what goals filter by in `sensor_delta` events
- `snapshotPath: string` — e.g. `'git.json'`, `'pdfs.json'`, `'health.json'`
- `read(signal: AbortSignal): Promise<unknown>` — always accept AbortSignal
- `diff(current, previous: SensorSnapshot | null): unknown | null` — return null = no change

**Design rules:**
- `read()` should return the smallest stable snapshot that still supports meaningful diffing
- `diff()` should emit reviewable deltas, not full noisy payloads, once a previous snapshot exists
- snapshot paths should be durable and lane-neutral because they become part of long-term memory layout

---

## GoalFactory Contract

A goal watches for sensor deltas and requests agent tasks.

```typescript
import { createGoal } from 'src/agent/agent.factories.ts'
import { bThread, bSync } from 'src/behavioral/behavioral.utils.ts'
import { AGENT_EVENTS } from 'src/agent/agent.constants.ts'
import type { SensorDeltaDetail } from 'src/agent/agent.types.ts'

export const myGoal = createGoal((_trigger) => ({
  threads: {
    'my-goal-thread': bThread(
      [
        // Step 1: Wait for sensor delta from our sensor
        bSync({
          waitFor: ({ type, detail }) =>
            type === AGENT_EVENTS.sensor_delta &&
            (detail as SensorDeltaDetail).sensor === 'my-sensor',
        }),
        // Step 2: Request a task for the agent to act on
        bSync({
          request: {
            type: AGENT_EVENTS.task,
            detail: { prompt: 'Describe what the agent should do with the detected change' },
          },
        }),
      ],
      true, // repeat: true — restart after each cycle for continuous monitoring
    ),
  },
}))
```

**Key API:**
- `createGoal(fn)` — brands the factory with `🎯`; `fn` receives `trigger`, returns `{ threads?, handlers? }`
- `bThread(steps, repeat?)` — `repeat: true` restarts after the last step completes
- `bSync({ waitFor })` — pause until a matching event fires
- `bSync({ request })` — request a BP event; selected when no thread blocks it
- `AGENT_EVENTS.sensor_delta` — event type for sensor changes
- `AGENT_EVENTS.task` — event type to trigger the agent's task loop

**Design rules:**
- goals should react to explicit sensor deltas, not re-read external state ad hoc
- requested tasks should be bounded and explain what changed, not just that change occurred
- repeatable goals should restart cleanly after each cycle without carrying hidden mutable state

---

## Accumulating Goals (multi-step patterns)

For goals that collect multiple deltas before acting (e.g., daily digest):

```typescript
export const digestGoal = createGoal((_trigger) => ({
  threads: {
    'digest-goal': bThread(
      [
        // Collect deltas until condition is met
        bSync({
          waitFor: ({ type }) => type === AGENT_EVENTS.sensor_delta,
        }),
        // Time-based condition: check hour before requesting task
        bSync({
          waitFor: ({ type }) =>
            type === AGENT_EVENTS.tick &&
            new Date().getHours() === 8,
        }),
        // Request digest task
        bSync({
          request: {
            type: AGENT_EVENTS.task,
            detail: { prompt: 'Compose and send the daily digest' },
          },
        }),
      ],
      true,
    ),
  },
}))
```

---

## Notification Handler

For sending alerts to external systems (Discord, Slack, email), keep notification
logic separate from the sensor and goal contracts:

```typescript
import type { DefaultHandlers } from 'src/behavioral/behavioral.types.ts'

const notificationHandler: DefaultHandlers = {
  [AGENT_EVENTS.message]: ({ detail }) => {
    const msg = detail as { source?: string; content?: string }
    if (msg.source !== 'proactive') return
    // Send to external service
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL
    if (!webhookUrl) return
    fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: msg.content }),
    }).catch(() => {/* non-fatal */})
  },
}

// Include in goal factory:
export const alertGoal = createGoal((_trigger) => ({
  threads: { 'alert-thread': myBThread },
  handlers: notificationHandler,
}))
```

**Design rules:**
- notifications are a side effect of proactive decisions, not the proactive decision itself
- external delivery failures should usually be non-fatal and observable
- handler logic should filter aggressively so it does not consume unrelated agent messages

---

## Import Paths

Always import from these exact paths:

```typescript
import type { SensorFactory, SensorSnapshot, SensorDeltaDetail } from 'src/agent/agent.types.ts'
import { createGoal } from 'src/agent/agent.factories.ts'
import { AGENT_EVENTS } from 'src/agent/agent.constants.ts'
import { bThread, bSync } from 'src/behavioral/behavioral.utils.ts'
import type { DefaultHandlers } from 'src/behavioral/behavioral.types.ts'
```

---

## Wiring into createAgentLoop

To integrate proactive behavior into a node:

```typescript
import { createAgentLoop } from 'src/agent/agent.loop.ts'
import { mySensor } from './sensor.ts'
import { myGoal } from './goal.ts'

const agent = createAgentLoop({
  // ... other config ...
  proactive: {
    sensors: [mySensor],
    goals: [myGoal],
    intervalMs: 300_000, // 5-minute heartbeat
  },
})
```

This wiring is the stable integration point. The exact sensor set, goal set, interval,
and memory layout are appropriate subjects for research lanes and evals.

---

## Invariants

- sensors observe; goals decide; handlers deliver side effects
- proactive state changes should be explainable from stored snapshots and deltas
- sensors and goals should be testable in isolation even if a particular research lane chooses not to generate tests by default
- proactive wiring should use the agent loop contracts rather than ad hoc polling code scattered through the repo
- use TypeScript with strict types, arrow functions, and Bun-first APIs where appropriate
