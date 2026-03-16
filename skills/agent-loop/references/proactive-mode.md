# Proactive Mode (Heartbeat)

> **Status: IMPLEMENTED** — Heartbeat, sensor sweep, tickYield, `set_heartbeat` tool, proactive context contributor, and message source routing are implemented. See [sensor-patterns.md](sensor-patterns.md) for generation patterns.

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

---

## Generation Patterns

The framework provides the primitives. The sections below teach frontier agents how to generate deployment-specific sensors, goals, and notification channels from natural language seeds.

### Sensor Generation

See **[sensor-patterns.md](sensor-patterns.md)** for complete implementation patterns:

- **Git sensor** — commits, branches, working tree (`src/agent/sensors/git.ts` reference)
- **Filesystem sensor** — file modification times in a watched directory
- **HTTP sensor** — poll an endpoint, diff response body
- **Web search sensor** — vendor-agnostic REST search API with `.env.schema` integration

All sensors implement the `SensorFactory` contract from `src/agent/agent.types.ts`:

```typescript
type SensorFactory = {
  name: string
  read: (signal: AbortSignal) => Promise<unknown>
  diff: (current: unknown, previous: SensorSnapshot | null) => unknown | null
  snapshotPath: string
}
```

### Goal Generation Patterns

Goals use the `GoalFactory` brand from `src/agent/agent.factories.ts`. A goal's `create()` method receives `trigger` and returns `{ threads, handlers }` — the same shape as constitution and workflow factories.

```typescript
import { createGoal } from '../agent.factories.ts'
import { bThread, bSync } from '../../behavioral/behavioral.ts'
```

#### Watch Pattern — React to Specific Sensor Deltas

A `repeat: true` bThread that `waitFor` a specific `sensor_delta`, then triggers a `task` with a pre-formed prompt:

```typescript
export const watchGitMain = createGoal((trigger) => ({
  threads: {
    watchMainBranch: bThread([
      bSync({
        waitFor: (e) =>
          e.type === 'sensor_delta' &&
          e.detail?.sensor === 'git' &&
          e.detail?.delta?.newCommits?.length > 0,
      }),
      bSync({
        request: {
          type: 'task',
          detail: {
            prompt: 'New commits detected on main. Review the changes and summarize any breaking changes.',
          },
        },
      }),
    ], true), // repeat: true — fires on every matching delta
  },
}))
```

**Key:** The bThread is persistent (`repeat: true`). It advances when a git sensor delta with new commits is selected, then requests a `task` event with a pre-formed prompt. After the task completes, it loops back to waiting for the next matching delta.

#### Alert Pattern — Conditional Action on Threshold

Fires a `task` when a sensor delta meets a specific condition (e.g., server down, disk full):

```typescript
export const alertServerDown = createGoal((trigger) => ({
  threads: {
    serverHealthWatch: bThread([
      bSync({
        waitFor: (e) =>
          e.type === 'sensor_delta' &&
          e.detail?.sensor?.startsWith('http:') &&
          e.detail?.delta?.currentStatus !== 200,
      }),
      bSync({
        request: {
          type: 'task',
          detail: {
            prompt: 'Server health check failed. Investigate the issue and notify the team.',
          },
        },
      }),
    ], true),
  },
}))
```

**Alert vs Watch:** An alert pattern typically triggers a more urgent response (notification channel, immediate action). A watch pattern triggers a review or summary. The distinction is in the prompt and the notification routing, not the bThread structure.

#### Schedule Pattern — Time-Based Filtering

Goal with time-based filtering — only active during specific windows:

```typescript
export const weekdayDigest = createGoal((trigger) => ({
  threads: {
    weekdayOnly: bThread([
      bSync({
        waitFor: (e) => {
          if (e.type !== 'tick') return false
          const day = new Date().getDay()
          return day >= 1 && day <= 5 // Monday–Friday
        },
      }),
      bSync({
        request: {
          type: 'task',
          detail: {
            prompt: 'Compile a summary of all sensor deltas since the last digest and prepare a daily report.',
          },
        },
      }),
    ], true),
  },
}))
```

**Schedule vs Watch:** Schedule goals filter on `tick` events directly (time-based). Watch goals filter on `sensor_delta` events (data-driven). A schedule goal runs regardless of sensor deltas — it's the agent's "cron job."

#### Business Hours Pattern — Combined Time + Sensor Filter

```typescript
export const businessHoursAlert = createGoal((trigger) => ({
  threads: {
    businessHoursOnly: bThread([
      bSync({
        waitFor: (e) => {
          if (e.type !== 'sensor_delta') return false
          const hour = new Date().getHours()
          return hour >= 9 && hour < 17 // 9am–5pm
        },
      }),
      bSync({
        request: {
          type: 'task',
          detail: {
            prompt: 'Sensor delta detected during business hours. Assess urgency and take action if needed.',
          },
        },
      }),
    ], true),
  },
}))
```

#### Goal Lifecycle: Natural Language → Factory File → Load

The generation flow when a user says "watch for new commits on main":

1. **Parse intent** — extract: sensor type (git), condition (new commits), action (summarize)
2. **Generate factory file** — `watch-git-main.ts` using the watch pattern above
3. **Generate test file** — `watch-git-main.spec.ts` verifying the bThread advances on matching deltas
4. **Validate** — `bun --bun tsc --noEmit` + `bun test` on the generated files
5. **Load** — goal loader reads `.memory/goals/watch-git-main.ts`, calls `create(trigger)`, registers threads

```
.memory/goals/
├── watch-git-main.ts            # GoalFactory — generated from natural language
├── watch-git-main.spec.ts       # Companion test
├── alert-server-down.ts
├── alert-server-down.spec.ts
├── weekday-digest.ts
└── weekday-digest.spec.ts
```

**Composition:** Multiple goals compose additively. Each goal's bThreads are registered independently. BP event selection evaluates all of them simultaneously on every super-step. No goal knows about or depends on other goals.

### Notification Channel Patterns

When the agent acts proactively (message has `source: 'proactive'`), results route to notification channels. The framework provides WebSocket routing; external channels are generation targets.

#### WebSocket (Built-in)

Already implemented in `src/modnet/node.ts`:

```typescript
// In createNode — proactive messages route to session WebSocket
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

#### Webhook (Slack / Discord)

POST to an incoming webhook URL. The URL comes from `.env.schema`, never hardcoded:

**`.env.schema`:**

```ini
NOTIFICATION_WEBHOOK_URL=
  @sensitive
  @required
  @type url
  @description Incoming webhook URL (Slack, Discord, or custom)
  @source exec('op read "op://Plaited/notification-webhook/url"')
```

**Handler:**

```typescript
import type { MessageDetail } from '../agent/agent.types.ts'

export const createWebhookNotifier = () => {
  const webhookUrl = process.env.NOTIFICATION_WEBHOOK_URL
  if (!webhookUrl) throw new Error('NOTIFICATION_WEBHOOK_URL must be set in .env.schema')

  return {
    async notify({ content, source }: MessageDetail) {
      if (source !== 'proactive') return

      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: content,        // Slack format
          content,              // Discord format
        }),
      })
    },
  }
}
```

**Wiring into the agent loop:**

```typescript
const webhook = createWebhookNotifier()

useFeedback({
  [AGENT_EVENTS.message](detail: MessageDetail) {
    if (detail.source === 'proactive') {
      webhook.notify(detail)
    }
  },
})
```

#### Email (SMTP or API)

Read the SMTP/API endpoint from `.env.schema`. Never read the actual secret — Varlock resolves it at runtime.

**`.env.schema`:**

```ini
EMAIL_API_URL=
  @sensitive
  @required
  @type url
  @description Email sending API endpoint (SendGrid, Resend, Postmark, or SMTP relay)

EMAIL_API_KEY=
  @sensitive
  @required
  @description API key for the email service
  @source exec('op read "op://Plaited/email-api-key/credential"')

EMAIL_FROM=noreply@example.com
  @required
  @description Sender address for proactive notifications

EMAIL_TO=user@example.com
  @required
  @description Recipient address for proactive notifications
```

**Handler:**

```typescript
export const createEmailNotifier = () => {
  const apiUrl = process.env.EMAIL_API_URL
  const apiKey = process.env.EMAIL_API_KEY
  const from = process.env.EMAIL_FROM
  const to = process.env.EMAIL_TO
  if (!apiUrl || !apiKey || !from || !to) {
    throw new Error('Email env vars must be set in .env.schema')
  }

  return {
    async notify({ content, source }: MessageDetail) {
      if (source !== 'proactive') return

      await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          from,
          to,
          subject: 'Proactive Agent Notification',
          text: content,
        }),
      })
    },
  }
}
```

**Pattern:** All notification channels follow the same shape — subscribe to proactive messages, format, send. The generating agent adapts the API call for the chosen provider.

#### Notification Channel Composition

Multiple channels compose by registering multiple handlers:

```typescript
const webhook = createWebhookNotifier()
const email = createEmailNotifier()

useFeedback({
  [AGENT_EVENTS.message](detail: MessageDetail) {
    if (detail.source === 'proactive') {
      // Fire all channels in parallel
      Promise.all([
        webhook.notify(detail),
        email.notify(detail),
      ])
    }
  },
})
```

### Cost Model Decision Table

Help the generating agent choose the right heartbeat interval based on deployment context:

| Deployment | Inference Cost | Recommended Interval | Rationale |
|---|---|---|---|
| **Local GPU** (Mac Mini, DGX Spark) | Zero marginal | 5 min (aggressive) | GPU is sunk cost; frequent ticks improve utilization |
| **Cloud API** (Claude, GPT, etc.) | Per-token | 30 min–2 hr (conservative) | Cost scales linearly with tick frequency |
| **Hybrid** (sensors local, inference cloud) | Mixed | 15 min sensors, cloud on-delta-only | Run sensor sweep locally; only call cloud API when deltas found |
| **Development / Testing** | Varies | 1–5 min or manual | Fast feedback loop; use `set_heartbeat` for ad-hoc control |
| **Production monitoring** | Varies | Match SLA requirements | Alert latency = heartbeat interval; adjust per severity |

**Hybrid pattern:** Run sensors on local hardware (zero cost), only invoke cloud inference when deltas are detected. The `sensorBatch` bThread naturally gates inference — if zero deltas, `sleep` fires and no inference call is made.

```typescript
// Hybrid config: aggressive sensor sweep, cloud inference only on deltas
createAgentLoop({
  proactive: {
    intervalMs: 5 * 60 * 1000,  // 5 min sensor sweep (local, free)
    sensors: [createGitSensor(), createFsSensor('~/Documents')],
  },
  // Model is cloud — only called when sensorBatch triggers context_assembly
})
