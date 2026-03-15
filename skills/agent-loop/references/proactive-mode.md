# Proactive Mode (Heartbeat)

> **Status: DESIGN** — Partially implemented. Heartbeat bThread, sensor sweep, and tickYield exist in `src/agent/proactive.ts`. `set_heartbeat` tool and push notification routing are not yet built.

## Architecture: Tick as BP Event

The heartbeat is not a scheduler — it's a timer that fires `trigger({ type: 'tick' })` into the existing BP engine. BP event selection handles all coordination:

```typescript
// Timer source — outside BP, replaceable
let timerId: Timer

const setHeartbeat = (intervalMs: number) => {
  clearInterval(timerId)
  if (intervalMs > 0) {
    timerId = setInterval(() => trigger({ type: 'tick' }), intervalMs)
  }
}

// Default: every 15 minutes
setHeartbeat(15 * 60 * 1000)
```

The `taskGate` bThread extends to accept both `task` and `tick`:

```typescript
bThreads.set({
  taskGate: bThread([
    bSync({
      waitFor: (e) => e.type === AGENT_EVENTS.task || e.type === 'tick',
      block: (e) => PIPELINE_EVENTS.has(e.type),
    }),
    bSync({ waitFor: AGENT_EVENTS.message }),
  ], true),
})
```

## Sensor Sweep

Each sensor is a `useFeedback` handler on `tick`. Sensors run in parallel, produce `sensor_delta` events. A `sensorBatch` bThread (same pattern as `batchCompletion`) waits for all sensors to resolve, then either triggers `context_assembly` (deltas found) or `sleep` (no changes):

```typescript
useFeedback({
  async tick() {
    const sensors = getSensors()
    const results = await Promise.all(
      sensors.map(async (sensor) => {
        const current = await sensor.read()
        const previous = await sensor.lastSnapshot()
        const delta = sensor.diff(current, previous)
        if (delta) {
          trigger({ type: 'sensor_delta', detail: { sensor: sensor.name, delta } })
        }
        await sensor.saveSnapshot(current)
        return delta
      }),
    )

    const sensorCount = results.filter(Boolean).length
    bThreads.set({
      sensorBatch: bThread([
        ...Array.from({ length: sensorCount }, () =>
          bSync({ waitFor: 'sensor_delta', interrupt: [AGENT_EVENTS.task] }),
        ),
        bSync({
          request: { type: AGENT_EVENTS.context_assembly },
          interrupt: [AGENT_EVENTS.task],
        }),
      ]),
    })

    if (sensorCount === 0) {
      trigger({ type: 'sleep' })
    }
  },
})
```

## Inference Prompt (Proactive)

When a `tick` triggers inference (via `context_assembly`), the system prompt includes a proactive framing:

```
Here are your active goals.
Here is what you did during the last heartbeat.
Here is new data from your sensors.

Based strictly on this context, is any action required?
If no action is needed, respond with a text message "SLEEP".
If action is required, produce the appropriate tool calls.
```

If the model responds with text only (no tool calls), the `message` event fires, `taskGate` loops back to waiting, and the agent sleeps until the next tick.

## Priority: User Always Wins

A `tickYield` bThread ensures user prompts interrupt in-progress proactive cycles:

```typescript
bThreads.set({
  tickYield: bThread([
    bSync({ waitFor: 'tick' }),
    bSync({
      waitFor: AGENT_EVENTS.message,
      interrupt: [AGENT_EVENTS.task],
    }),
  ], true),
})
```

| Scenario | Behavior |
|----------|----------|
| User sends prompt while idle | `task` selected, normal reactive flow |
| Tick fires while idle | `tick` selected, sensor sweep runs |
| Tick fires during active user task | `taskGate` blocks `tick` — silently dropped |
| User sends prompt during tick processing | `tickYield` interrupts proactive cycle, user task runs |
| User says "pause heartbeat" | Model calls `set_heartbeat(0)`, timer cleared |

**Concurrency:** BP's single-threaded super-step model provides mutual exclusion for free. A `tick` during an active task is not selected (blocked by `taskGate`). No locks, no race conditions, no concurrent inference calls.

## User-Configurable Heartbeat

The heartbeat interval is a tool call, not a config file:

```typescript
const setHeartbeatTool = {
  name: 'set_heartbeat',
  description: 'Change the proactive heartbeat interval. 0 = pause.',
  parameters: {
    interval_seconds: { type: 'number', minimum: 0 },
  },
}
```

Natural language control: "pause heartbeat", "check every 2 hours", "wake me if anything changes". No settings UI required — the cost knob is accessible through conversation.

## Goals as bThreads

Long-term directives ("watch for emails from Alice", "alert if server goes down") are persistent `repeat: true` bThreads that `waitFor` specific `sensor_delta` events. Multiple goals coexist — BP event selection evaluates all threads simultaneously on every super-step.

Goals are generated as TypeScript factory files with companion tests, stored in `.memory/goals/`. On agent spawn, the loader reads all goal factories, validates them (tsc + test), and creates bThreads. See `CONSTITUTION.md` § Generated bThreads for the full generation architecture.

**Goal lifecycle via natural language:**

| User says | Agent action |
|-----------|-------------|
| "Watch for emails from Alice" | Generates `watch-alice.ts` + `watch-alice.spec.ts`, runs verification, loads bThread |
| "Stop watching Alice" | Removes goal factory file, bThread is interrupted |
| "Pause all monitoring" | Calls `set_heartbeat(0)` — goals stay registered but dormant (no ticks) |
| "Also watch for Bob" | Generates new goal factory — composes additively with existing goals |
| "Watch Alice but only weekdays" | Generates goal with `repeat: () => isWeekday()` — self-terminates on weekends |

**Multiple goals firing on same tick:** If Alice emails AND the server goes down in the same tick, both goal bThreads advance. The `batchCompletion` pattern handles N concurrent goal-triggered actions.

## Push Notifications

When the agent acts proactively, it pushes results to the user via the existing WebSocket channel. If the client is disconnected, the `sessionGate` bThread blocks pipeline events — proactive actions queue until reconnection or route to an external notification channel.

```typescript
useFeedback({
  [AGENT_EVENTS.message]({ content, source }: MessageDetail) {
    if (source === 'proactive') {
      server.publish(sessionId, {
        type: 'render',
        detail: { target: 'notifications', template: formatNotification(content) },
      })
    }
  },
})
```

## Cost Implications

On local hardware (Mac Mini, Mac Studio, DGX Spark), the GPU is a sunk cost — proactive ticks have **zero marginal cost** and improve hardware utilization. On cloud GPU, cost scales linearly with tick frequency:

| Interval | Ticks/day | Est. cloud cost/mo |
|----------|----------|-------------------|
| 5 min | 288 | ~$25 |
| 15 min (default) | 96 | ~$8 |
| 1 hour | 24 | ~$2 |
| 2 hours | 12 | ~$1 |
| Paused | 0 | $0 |
