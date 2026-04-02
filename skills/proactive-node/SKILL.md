---
name: proactive-node
description: Current contracts and implementation guidance for proactive Plaited nodes built on createAgent factories, signals, heartbeat-driven polling, and notification handlers.
license: ISC
compatibility: Requires bun
---

# Proactive Node

## Purpose

This skill documents the current proactive runtime surface in this repo.
Proactive behavior is no longer wired through `createAgentLoop()` or
`createGoal()` helpers. It is built on the minimal `createAgent()` core plus
repo-defined factories, signals, computed values, heartbeat events, and
behavioral handlers.

Use this skill when implementing or reviewing autonomous polling, state-diff
tracking, notification routing, or long-lived background coordination inside a
Plaited node.

Do not treat this skill as a generator contract for exact filenames or as proof
that a specific proactive policy has been standardized. The stable contract is
the factory/signals runtime surface that exists in `src/agent/`.

## Quick Reference

**Current core files:**
- `src/agent/create-agent.ts` - minimal agent runtime and factory installation
- `src/agent/agent.types.ts` - `CreateAgentOptions`, `Factory`, `FactoryParams`, `Signals`
- `src/agent/agent.constants.ts` - `AGENT_CORE_EVENTS` and broader `AGENT_EVENTS`
- `src/behavioral/behavioral.ts` - BP runtime used underneath factories

**Primary proactive seam:**
- `createAgent({ factories, heartbeat })`
- each factory receives `{ trigger, useSnapshot, signals, computed }`
- heartbeat emits `AGENT_CORE_EVENTS.heartbeat` on a timer
- factories convert heartbeat or external events into signals, BP threads, and handlers

## Current Contract

### Agent entry point

Proactive nodes compose behavior through `createAgent()`:

```typescript
import { createAgent } from 'src/agent/create-agent.ts'

const agent = await createAgent({
  id: 'watcher',
  cwd: process.cwd(),
  workspace: process.cwd(),
  models,
  factories: [proactiveFactory],
  heartbeat: { intervalMs: 300_000 },
})
```

The `heartbeat.intervalMs` value controls how often the core emits
`AGENT_CORE_EVENTS.heartbeat`. Treat heartbeat as the stable scheduling hook for
polling-oriented proactive behavior.

### Factory contract

Factories are the durable extension surface:

```typescript
import type { Factory } from 'src/agent/agent.types.ts'

export const proactiveFactory: Factory = ({ trigger, signals, computed, useSnapshot }) => {
  return {
    threads: {},
    handlers: {},
  }
}
```

A factory can:
- declare BP threads for coordination
- register feedback handlers for side effects
- create signals for durable in-memory state
- derive computed state from one or more signals
- observe runtime decisions through `useSnapshot`

Factories should be self-contained and reusable. Prefer one factory per
proactive capability or closely related capability set.

### Signals, not legacy sensor snapshots

The old `SensorFactory` / `SensorSnapshot` contract is stale. In the current
runtime, proactive state should usually live in signals:

```typescript
import { z } from 'zod'
import type { Factory } from 'src/agent/agent.types.ts'

const FeedStateSchema = z.object({
  seenIds: z.array(z.string()),
  lastPollAt: z.string().nullable(),
  pendingNotification: z.string().nullable(),
})

export const feedFactory: Factory = ({ signals, computed }) => {
  const feedState = signals.set({
    key: 'feed-state',
    schema: FeedStateSchema,
    readOnly: false,
    value: {
      seenIds: [],
      lastPollAt: null,
      pendingNotification: null,
    },
  })

  const hasPendingNotification = computed(
    () => Boolean(feedState.get()?.pendingNotification),
    [feedState],
  )

  return {
    handlers: {},
    threads: {},
  }
}
```

**Signal rules:**
- use explicit schemas for all signal state
- keep the stored shape compact and reviewable
- store durable state, not full noisy upstream payloads
- derive convenience state with `computed()` instead of duplicating fields
- prefer a small number of named signals over ad hoc module-level mutable state

## Heartbeat Pattern

The stable scheduling event is `AGENT_CORE_EVENTS.heartbeat`:

```typescript
import { AGENT_CORE_EVENTS } from 'src/agent/agent.constants.ts'
import type { Factory } from 'src/agent/agent.types.ts'

export const pollFactory: Factory = ({ trigger }) => ({
  handlers: {
    async [AGENT_CORE_EVENTS.heartbeat]() {
      const response = await fetch('https://example.com/feed')
      const items = await response.json()
      trigger({
        type: 'feed_polled',
        detail: { items },
      })
    },
  },
})
```

This is the main proactive loop:
1. heartbeat fires
2. handler reads external state
3. handler compares against signal-backed state
4. handler updates signals and emits a bounded domain event
5. BP threads or other handlers decide whether to notify, infer, or stay idle

Use custom domain events such as `feed_polled`, `invoice_overdue`, or
`build_failed` for local orchestration. Do not overload unrelated global events
when a narrower event type is available.

## Diff-Then-Notify Pattern

Proactive behavior should be driven by explainable deltas:

```typescript
import { AGENT_CORE_EVENTS } from 'src/agent/agent.constants.ts'
import type { Factory } from 'src/agent/agent.types.ts'

export const notifyOnChangeFactory: Factory = ({ signals, trigger }) => {
  const state = signals.set({
    key: 'status-feed',
    schema: FeedStateSchema,
    readOnly: false,
    value: {
      seenIds: [],
      lastPollAt: null,
      pendingNotification: null,
    },
  })

  return {
    handlers: {
      async [AGENT_CORE_EVENTS.heartbeat]() {
        const items = await loadItems()
        const previous = state.get() ?? { seenIds: [], lastPollAt: null, pendingNotification: null }
        const unseen = items.filter((item) => !previous.seenIds.includes(item.id))

        state.set?.({
          seenIds: items.map((item) => item.id),
          lastPollAt: new Date().toISOString(),
          pendingNotification: unseen[0]?.title ?? null,
        })

        if (unseen.length > 0) {
          trigger({
            type: 'new_feed_items',
            detail: {
              count: unseen.length,
              titles: unseen.map((item) => item.title),
            },
          })
        }
      },
    },
  }
}
```

**Diff rules:**
- compare against the previously stored signal value
- emit narrow, human-reviewable deltas
- avoid re-sending the entire upstream response when only a few fields changed
- keep first-run behavior explicit; decide whether initial state should notify or only prime the cache

## Notifications and Side Effects

Notification delivery belongs in focused handlers, not in the polling logic
itself:

```typescript
import type { Factory } from 'src/agent/agent.types.ts'

export const notificationFactory: Factory = () => ({
  handlers: {
    async new_feed_items(detail: { titles: string[] }) {
      const webhookUrl = process.env.DISCORD_WEBHOOK_URL
      if (!webhookUrl) return

      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: `New items: ${detail.titles.join(', ')}`,
        }),
      }).catch(() => {
        // Delivery is observable but usually non-fatal.
      })
    },
  },
})
```

**Side-effect rules:**
- polling and delivery should be separate concerns
- external delivery failures should usually be observable and non-fatal
- handler filters should be narrow so unrelated traffic does not trigger delivery
- prefer Bun-friendly APIs and normal process env access inside the handler

## Behavioral Coordination

Use BP threads when proactive work has ordering, gating, or safety constraints
that should be explicit. Examples:
- prevent overlapping polls
- gate delivery until a human-review event fires
- coalesce repeated changes into one summary action
- suppress notifications while another task is active

Reach for plain handlers first when the flow is simple. Add `threads` when the
coordination itself is important state.

## Import Paths

Prefer these current imports:

```typescript
import { createAgent } from 'src/agent/create-agent.ts'
import { AGENT_CORE_EVENTS, AGENT_EVENTS } from 'src/agent/agent.constants.ts'
import type { Factory, FactoryParams, Signals } from 'src/agent/agent.types.ts'
import { behavioral, bSync, bThread } from 'src/behavioral.ts'
```

Do not reference removed surfaces such as:
- `src/agent/agent.loop.ts`
- `src/agent/agent.factories.ts`
- `createGoal()`
- legacy `SensorFactory` examples as if they were still the runtime contract

## Invariants

- proactive behavior should be built on `createAgent()` factories, not legacy loop helpers
- heartbeat should remain the default scheduling primitive for polling
- stored proactive state should be schema-checked and compact
- emitted deltas should be explainable from prior state and current observation
- side effects should be isolated from polling and diff logic
- use TypeScript with strict types, arrow functions, and Bun-first APIs where appropriate
