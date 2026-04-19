# Behavioral Programming: Foundations

Behavioral Programming (BP) is Plaited's coordination model for server/runtime
logic. It is exposed as a TypeScript DSL built from `behavioral()`, `bThread()`,
`bSync()`, typed feedback handlers, and event-selection snapshots.

This document is independent of the browser UI runtime. UI controller islands
send BPEvent-shaped messages to the server, but they do not host behavioral
programs. When UI-originated events should affect coordination, server or agent
code parses the message and calls `trigger()` on a behavioral program.

Use this reference for the conceptual model:

- how `request`, `waitFor`, `block`, and `interrupt` compose
- how event selection replaces direct callback choreography
- how handlers perform side effects after an event is selected
- how snapshots expose selection and deadlock diagnostics

For line-by-line runtime semantics, priority ordering, and deadlock details, use
`algorithm-reference.md`.

## Runtime Surface

The public behavioral surface is exported from `plaited/behavioral`:

```typescript
import * as z from 'zod'
import { BPEventSchema, behavioral, bSync, bThread } from 'plaited/behavioral'

const onType = (type: string) => ({
  type,
  detailSchema: z.unknown(),
})
```

The core program API is:

- `behavioral()` creates an isolated behavioral program instance.
- `trigger(event)` injects an external BP event.
- `addBThread(label, thread)` and `addBThreads(record)` install threads.
- `useFeedback(handlers)` subscribes side-effect handlers to selected events.
- `useSnapshot(listener)` observes selection, deadlock, and feedback-error snapshots.
- `reportSnapshot(message)` lets host code publish structured diagnostics.

`bSync()` creates one synchronization point. `bThread()` composes synchronization
points into a sequence. Omit the second `bThread()` argument for a one-shot
sequence; pass `true` for a persistent repeating sequence.

## BP Events

A BP event is a serializable control message:

```typescript
type BPEvent = {
  type: string
  detail?: unknown
}
```

Use `BPEventSchema` at untyped boundaries:

```typescript
const parsed = BPEventSchema.safeParse(JSON.parse(rawMessage))

if (parsed.success) {
  trigger(parsed.data)
}
```

The UI controller protocol uses this shape inside client `ui_event` messages.
That shape compatibility does not mean the browser controller runs BP; it only
means the server receives a value that can be fed into BP if the server-side
program chooses to do so.

## Synchronization Idioms

At each sync point, a thread declares one or more idioms:

| Idiom | Meaning | Effect |
|---|---|---|
| `request` | Propose an event | Adds a candidate for selection |
| `waitFor` | Resume when an event is selected | Listens without proposing |
| `block` | Prevent matching events | Removes candidates before selection |
| `interrupt` | Terminate this thread when an event is selected | Ends the generator |

Listeners are explicit objects with a `type` and a Zod `detailSchema`:

```typescript
const onExecute = {
  type: 'execute',
  detailSchema: z.object({ id: z.string() }),
}

const guard = bThread(
  [
    bSync({
      block: onExecute,
    }),
  ],
  true,
)
```

For malformed-payload guards, keep the schema positive and set
`detailMatch: 'invalid'` on the blocking listener:

```typescript
const validateExecute = {
  type: 'execute',
  detailSchema: z.object({ id: z.string() }),
  detailMatch: 'invalid',
}
```

## Event Selection

Each super-step advances runnable threads to their next sync point, gathers
requests and blocks, filters blocked candidates, selects the highest-priority
remaining candidate, publishes the selected event to feedback handlers, and
continues until no event can be selected.

External `trigger()` events have priority `0`. Thread requests receive priority
from registration order. Lower priority numbers win.

Blocking always wins over requesting. If one thread requests `execute` and
another thread blocks a matching `execute`, the event is not selected and the
feedback handler does not run.

## Coordination Examples

### Terminal Guard

Use a repeating thread when a constraint must remain installed:

```typescript
const { addBThreads, trigger, useFeedback } = behavioral()

addBThreads({
  doneGuard: bThread(
    [
      bSync({ waitFor: onType('done') }),
      bSync({ block: [onType('work'), onType('other')] }),
    ],
    true,
  ),
})

useFeedback({
  work() {
    console.log('work')
  },
  done() {
    console.log('done')
  },
})

trigger({ type: 'work' })
trigger({ type: 'done' })
trigger({ type: 'work' }) // blocked
```

### One-Shot Sequence

Omit `repeat` for finite workflows:

```typescript
addBThreads({
  completion: bThread([
    bSync({ waitFor: onType('task_done') }),
    bSync({ waitFor: onType('task_done') }),
    bSync({ request: { type: 'all_tasks_done' } }),
  ]),
})
```

After the final rule advances, the thread is done and is not re-added to the
program.

### Dynamic Threads

Feedback handlers can install additional threads before triggering the event
that those threads should observe:

```typescript
const { addBThread, trigger, useFeedback } = behavioral()

useFeedback({
  start_task(detail: { id: string; maxResults: number }) {
    addBThread(
      `limit:${detail.id}`,
      bThread([
        ...Array.from({ length: detail.maxResults }, () => bSync({ waitFor: onType('tool_result') })),
        bSync({ request: { type: 'task_limit_reached', detail: { id: detail.id } } }),
      ]),
    )

    trigger({ type: 'task_started', detail })
  },
})
```

The ordering matters: install the thread first, then trigger the event that lets
the rest of the workflow proceed.

## Feedback Handlers

Threads coordinate timing and constraints. Feedback handlers perform effects:
network calls, storage writes, process interaction, runtime state mutation, and
follow-up `trigger()` calls.

```typescript
type Events = {
  load_user: { id: string }
  user_loaded: { id: string; name: string }
  save_user: undefined
}

const { addBThreads, trigger, useFeedback } = behavioral<Events>()

let currentUser: Events['user_loaded'] | undefined

addBThreads({
  workflow: bThread([
    bSync({ waitFor: onType('load_user') }),
    bSync({ waitFor: onType('user_loaded') }),
    bSync({ request: { type: 'save_user' } }),
  ]),
})

useFeedback({
  async load_user({ id }) {
    const response = await fetch(`/users/${id}`)
    currentUser = await response.json()
    trigger({ type: 'user_loaded', detail: currentUser })
  },

  async save_user() {
    if (!currentUser) return
    await fetch(`/users/${currentUser.id}`, {
      method: 'POST',
      body: JSON.stringify(currentUser),
    })
  },
})
```

Async handlers are fire-and-forget from the engine's point of view. When an
async handler finishes and calls `trigger()`, that call starts a new super-step.

## Snapshots

`useSnapshot()` observes engine decisions without participating in selection:

```typescript
const disconnectSnapshot = useSnapshot((snapshot) => {
  if (snapshot.kind === 'selection') {
    const selected = snapshot.bids.find((bid) => bid.selected)
    console.log('selected', selected?.type)
  }

  if (snapshot.kind === 'deadlock') {
    console.warn('deadlock', snapshot.summary)
  }
})
```

Snapshots are engine observability. They are not UI controller messages. Use
them for debugging, replay, memory, and deadlock diagnostics inside behavioral
hosts.

`useFeedback()` reports thrown handler errors as `feedback_error` snapshots. The
engine does not throw those errors through `trigger()`.

## Extensions

Reusable behavioral modules use `useExtension()` and `useInstaller()`. An
extension receives scoped helpers from the installer, contributes bThreads, and
returns feedback handlers.

```typescript
import * as z from 'zod'
import { useExtension } from 'plaited/behavioral'

export const searchExtension = useExtension('search', ({ bThread, bSync, trigger }) => {
  bThread({
    label: 'requestSearch',
    rules: [
      bSync({
        waitFor: {
          type: 'query',
          detailSchema: z.object({ q: z.string() }),
        },
      }),
      bSync({ request: { type: 'execute_search' } }),
    ],
  })

  return {
    execute_search() {
      trigger({ type: 'search_started' })
    },
  }
})
```

Use extensions when several behavioral programs need the same rule set with
scoped event names and installer-managed memory. Use direct `addBThread()` calls
for local one-off coordination.

## Runtime Coordination Use Cases

BP is useful when the behavior is easier to express as independent constraints
than as one large imperative function:

- agent-loop phase gates
- fanout completion counting
- workflow checkpoints
- protocol state machines
- resource limits
- safety guards that block events
- test orchestration
- replay and deadlock analysis

## Boundary With UI

The UI stack has its own skill. The browser controller model is:

- `controlIsland(tag)` owns the custom element and WebSocket protocol.
- `p-trigger` turns DOM events into `ui_event` messages.
- the `ui_event.detail` is BPEvent-shaped.
- browser controller modules may call their provided `trigger()` callback.
- the browser controller does not import or call `behavioral()`.

Keep behavioral rules in server/runtime modules. Treat UI events as ingress
data, then validate and route them at the server boundary.

## Summary

Use BP when coordination is the hard part: several independent requirements must
request, wait for, block, or interrupt events without becoming tightly coupled.
Keep threads declarative, keep effects in handlers, use snapshots for
observability, and keep browser UI controllers outside the behavioral engine.
