# Behavioral

Reference for an agent assisting an engineer in wiring up the Behavioral
behavioral-programming runtime — the event-coordination layer that b-threads
run inside. A behavioral program coordinates b-threads via the super-step
model: each step, pending threads' `request`s are collected as candidates,
those matching any `block` are filtered out, the highest-priority remaining
candidate is selected, threads waiting/requesting/interrupted by it are
resumed, and the next step runs. If no unblocked candidate exists the
program halts until an external `trigger` arrives.

## Public surface

The engine lives in-repo at `src/behavioral/behavioral.ts` (with types in
`behavioral.types.ts`, constants in `behavioral.constants.ts`, utils in
`behavioral.utils.ts`). It is **not** a public package export — there is no
root `@behavioral/sh` export (the package exports only `./tools`,
`./controller`, `./utils`). Import it from its source path:

```ts
import { behavioral } from '../../behavioral/behavioral.ts'
import type {
  BPEvent,
  Disconnect,
  Thread,
  Trace,
  UseAddThread,
  UseTrigger,
  UseTrace,
} from '../../behavioral/behavioral.types.ts'
```

`behavioral()` returns a frozen API object with **three hooks** — no
`useAddHandler`, no `sendTrace`, no generic type parameter:

```ts
const { useAddThread, useTrigger, useTrace } = behavioral({ instanceId?: string })
```

Threads are JSON objects: `{ label: string, rules: Idioms[], once?: true }`.
Each idiom is one sync point with `request` (propose an event), `waitFor`
(block until an event), `block` (forbid an event), `interrupt` (terminate the
thread on an event), and/or `transform` (match, hand off to external
reshaping, re-enter via a `target` event). `detailSchema` on listeners is
JSON Schema (draft 2020-12), compiled at registration.

## The three hooks

`const { useAddThread, useTrigger, useTrace } = behavioral()`

| Hook | Signature | Use when |
|------|-----------|----------|
| `useAddThread(space?)` | `(args: Thread) => void` | Register a b-thread (`{ label, rules, once? }`). Optional `space` stamps all the thread's idioms. |
| `useTrigger(space?)` | `(event: BPEvent) => void` | Inject an external event. Triggered events have highest priority (0) and can be blocked. Initiates a new super-step. |
| `useTrace(listener)` | `Disconnect` | Observe internal state traces emitted after each event selection. Does not affect execution. |

### `useAddThread` — registering threads

```ts
const addThread = useAddThread()
addThread({
  label: 'producer',
  rules: [{ request: { type: 'task' } }],
  once: true,
})
addThread({
  label: 'consumer',
  rules: [{ waitFor: [{ type: 'task' }] }, { request: { type: 'ack' } }],
  once: true,
})
```

A thread is an object with `label`, `rules` (an array of `Idioms` sync points),
and optional `once`. Without `once`, the thread loops its `rules` indefinitely;
with `once: true`, it runs through the rules once and completes. The `label`
identifies the thread in traces. Invalid thread arguments (failing
`ThreadSchema`, or an un-compilable `detailSchema`) are surfaced as an
`add_thread_error` trace, not a throw — the thread simply isn't added.

### `useTrigger` — injecting events

```ts
const trigger = useTrigger()
trigger({ type: 'kickoff' })
```

Triggered events behave like a one-shot thread requesting the event at
priority 0. They are subject to `block` like any request. An event that fails
`BPEvent` validation is rejected at the ingress boundary and surfaced as a
`trigger_error` trace (not a throw). Triggers are how external systems (UI,
network, timers) drive the program.

### `useTrace` — observation and the action channel

```ts
const disconnect = useTrace((msg: Trace) => {
  // msg is the engine's closed Trace union — narrow by `kind`:
  //   'pending_bids' | 'frontier' | 'selection' | 'deadlock'
  //   'trigger_error' | 'add_thread_error' | 'interrupt' | 'transform'
})
```

`useTrace` subscribes a listener receiving one `Trace` per step. The listener
may be sync or async (`void | Promise<void>`); **the engine never awaits
it.** Each listener return value is absorbed by `Promise.resolve(...)` with a
rejection handler attached, so a rejecting promise never breaks the
super-step. A listener that throws synchronously is caught and logged via
`console.error('[behavioral] trace listener ...')` — listener failures are
**log-only**, never published as traces.

#### The action-channel pattern (replaces `useAddHandler`)

There is no `useAddHandler` hook. Side effects — tool dispatch, I/O, model
calls — are performed by `useTrace` listeners that observe `selection`
traces and act outside the super-step, then **re-enter the engine via
`trigger`**. The kernel's dispatch bridge is the canonical implementation
(`src/kernel/kernel.ts`):

```ts
// The action channel: fire on selection, do async I/O, re-enter via trigger.
const disconnect = useTrace((msg) => {
  if (msg.kind !== 'selection') return
  void bridge(msg.selected.type) // async I/O outside the super-step
})

// Re-entry is deferred past the current super-step so the bridge never
// re-enters the engine synchronously from inside a listener.
const fire = (event: BPEvent): void => {
  queueMicrotask(() => trigger({ ...event, space }))
}
```

The contract:

- The listener filters on `msg.kind === 'selection'` and reads
  `msg.selected.type` to decide what to do.
- Async work happens **after** the listener returns — the engine continues the
  super-step without waiting.
- Results re-enter via `trigger`, deferred with `queueMicrotask` so the
  action channel never re-enters the engine synchronously from inside a
  `sendTrace` listener call.
- Tool/I/O failures return as **data** (`isError: true` on the output) and
  drive a `turn.end` or recovery trigger — they never throw into the space.
- A listener throw is `console.error`'d and swallowed — it cannot corrupt the
  program.

This is why "self-modification can't break confluence": the action channel is
an observer of the trace, not a participant in the super-step. Adding or
removing a listener never changes which event the arbiter selects.

## The `transform` idiom — declarative pure-data reshape

The fifth idiom is `transform`: a declarative, pure-data reshape that fires
**inside** the super-step, complementary to the async action-listener pattern
above (which does I/O outside it). A transform listener matches an event like
`waitFor`/`block`/`interrupt` (same `type` + optional `detailSchema`/`detailMatch`),
but instead of pausing or forbidding, it declares a reshape contract the
external host executes:

```ts
addThread({
  label: 'shaper',
  rules: [{
    transform: [{
      type: 'order',          // match this selected event
      detailSchema: { ... },  // optional JSON Schema guard
      query: '.order',        // applied to selected.detail (e.g. a jq expression)
      target: 'ship',         // re-enter the engine with this event type
    }],
  }],
})
```

Shape (`TransformListener` in `behavioral.types.ts`): a `BPListener` plus
`query` (string) and `target` (string). When a matching event is selected,
the engine emits a `transform` trace carrying `transformers: { query, target,
thread }[]` **immediately before** the `selection` trace, then resumes the
thread (a transform match wakes the thread like a `waitFor` match). The
engine does **no I/O** — it only publishes the contract. External code reads
the `transform` trace, evaluates each `query` over `selected.detail`, and
re-enters via `trigger({ type: target, detail })` — or, for multiple targets,
fans out via `addThread` (one request thread per target).

This is a two-phase loop: **prime** (the `transform` trace carries the
contracts) then **execute** (the immediately following `selection` trace
carries the payload). The reference implementation is
`src/behavioral/tests/transform.spec.ts`. Honest caveat: today only that test
loop consumes the trace — the kernel-side consumer is not yet wired, so there
is no production host applying `query` → `target` yet. The trace contract is
stable; the host is what's missing.

## The trace union

`Trace` is a closed discriminated union (narrow by `kind`). The kinds:

| `kind` | Carries | When |
|--------|---------|------|
| `pending_bids` | `step`, `threads` (serialized pending set) | Before event selection each step |
| `frontier` | `step`, `status`, `candidates`, `enabled` | After computing the frontier |
| `selection` | `step`, `selected` (the chosen candidate) | When an event is selected |
| `deadlock` | `step` | Candidates exist but all are blocked |
| `interrupt` | `selected`, `threadLabel`, `step` | A thread was terminated by an interrupt |
| `transform` | `step`, `transformers` | A transform listener matched; external code applies `query` → `target` |
| `add_thread_error` | `error` (AJV errors), `space?` | `useAddThread` rejected invalid args / un-compilable `detailSchema` |
| `trigger_error` | `error` (AJV errors), `space?` | `useTrigger` rejected an invalid `BPEvent` |

The two error kinds are the engine's only failure surfaces, and both are
**traces, not throws** — invalid input is reported as data and the program
keeps running. There is no `feedback_error` trace.

## A common wiring mistake to avoid

Forgetting to `trigger` after adding threads. `useAddThread` registers a
thread but does **not** start a super-step on its own; the program pauses
until a `trigger` arrives. A common symptom: threads are added, nothing
happens. The fix is almost always a missing `trigger({ type: '...' })` to
kick off the first super-step.

The second common mistake: expecting side effects to fire on `trigger`. The
action channel fires on **selected** events — a triggered event that is
`block`ed by an active thread is never selected and never reaches the
`selection` trace. Check the `frontier` trace's `enabled` list to confirm the
event wasn't filtered out.

## See also

- [Frontier analysis](./frontier-analysis.md) — deadlock/livelock verification
  over the closed state graph of a behavioral program.
- [Controller](./controller.md) — the browser-side message applier and the
  stateless SSR html tools (one UI-layer reference).
