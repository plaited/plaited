# Behavioral

Reference for an agent assisting an engineer in wiring up the Plaited
behavioral-programming runtime — the event-coordination layer that b-threads
run inside. A behavioral program coordinates b-threads via the super-step
model: each step, pending threads' `request`s are collected as candidates,
those matching any `block` are filtered out, the highest-priority remaining
candidate is selected, threads waiting/requesting/interrupted by it are
resumed, and the next step runs. If no unblocked candidate exists the
program halts until an external `trigger` arrives.

## Public surface (import from `plaited`)

The runtime API is re-exported from the package root:

```ts
import { behavioral } from 'plaited'
import type {
  AddHandler,
  AddThread,
  Disconnect,
  Handler,
  SendTrace,
  TraceListener,
  Trigger,
  UseAddHandler,
  UseAddThread,
  UseTrace,
  UseTrigger,
} from 'plaited'
```

`behavioral()` returns an immutable API object with five hooks. The deeper
engine internals (`computeFrontier`, `advanceRunningToPending`, the
`Registered*` types, the `*Schema` validators) are not part of the consumer surface — see
[Going deeper](#going-deeper) for how to reach them.

Threads are JSON objects: `{ label: string, rules: Idioms[], once?: true }`.
Each idiom is one sync point with `request` (propose an event), `waitFor`
(block until an event), `block` (forbid an event), and/or `interrupt`
(terminate the thread on an event). `detailSchema` on listeners is JSON
Schema, compiled at registration.

## The five hooks

`const { useAddThread, useTrigger, useAddHandler, useTrace, sendTrace } = behavioral()`

| Hook | Returns | Use when |
|------|---------|----------|
| `useAddThread(space?)` | `(args: Thread) => void` | Register a b-thread (`{ label, rules, once? }`). Optional `space` stamps all the thread's idioms. |
| `useTrigger(space?)` | `(event: BPEvent) => void` | Inject an external event. Triggered events have highest priority (0) and can be blocked. Initiates a new super-step. |
| `useTrace(listener)` | `Disconnect` | Observe internal state traces emitted after each event selection. Does not affect execution. |
| `sendTrace(arg)` | `void` | Publish a custom trace to all `useTrace` listeners (for host/extension integration). |

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
`ThreadScehama`, or an un-compilable `detailSchema`) are surfaced as an
`add_thread_error` trace, not a throw — the thread simply isn't added.

### `useTrigger` — injecting events

```ts
const trigger = useTrigger()
trigger({ type: 'kickoff' })
```

Triggered events behave like a one-shot thread requesting the event at
priority 0. They are subject to `block` like any request. Triggers are how
external systems (UI, network, timers) drive the program.

### `useAddHandler` — side effects

```ts
const addHandler = useAddHandler()
const disconnect = addHandler('task', ({ detail, payload, disconnect }) => {
  console.log('task selected', detail)
  // disconnect() to unsubscribe; throw → surfaces as feedback_error trace
})
```

Handlers fire after the event is selected and published. A handler that
throws is caught and published as a `feedback_error` trace; it does not
abort the super-step. Pass `once: true` as the third arg to auto-disconnect
after the first match. `payload` carries the opaque non-JSON side-channel
(File, Blob, FormData) if one was supplied on the triggering event — `detail`
stays JSON.

### `useTrace` and `sendTrace` — observation

```ts
const disconnect = useTrace((msg) => {
  // msg is inferred as the engine's Trace union: pending_bids | frontier |
  // selection | deadlock | trigger_error | add_thread_error | interrupt |
  // transform (narrow by `kind`)
})
```

`useTrace` subscribes a `TraceListener` receiving one trace per step. Unparametrized
`behavioral()` types messages as `Trace` (the engine's discriminated union of
trace variants; narrow by `kind`). To receive custom trace shapes your program
emits alongside the engine's, parametrize `behavioral<MyTrace>()` — `MyTrace`
must structurally satisfy `{ kind: string; timestamp: number }` (the
`TraceBase` constraint, an internal type; you don't need to import it — TS
checks the constraint structurally). The listener then receives `Trace | MyTrace`.
`sendTrace(arg)` publishes a value of your `MyTrace` to all listeners — for
host/extension code that needs to inject observation events alongside the
engine's own traces.

## A common wiring mistake to avoid

Forgetting to `trigger` after adding threads. `useAddThread` registers a
thread but does **not** start a super-step on its own; the program pauses
until a `trigger` arrives (or until a registered thread's own `request`
becomes selectable, which still needs a running super-step to begin). A
common symptom: threads are added, nothing happens. The fix is almost always
a missing `trigger({ type: '...' })` to kick off the first super-step.

The second common mistake: expecting `useAddHandler` handlers to fire on
`trigger`. Handlers fire on **selected** events — a triggered event that is
`block`ed by an active thread is never selected and never reaches handlers.
Check the `frontier` trace's `enabled` list to confirm the event wasn't
filtered out.

## Going deeper

The public surface above is importable. Deeper internals are reachable by
resolving the public specifier to its backing file and inspecting with the
TypeScript LSP CLI — no hardcoded source paths, so the examples survive
refactors that move impl files.

### Resolve the specifier and enumerate exports

```bash
# Step 1 — resolve the specifier to its backing file (barrel)
bun -e 'console.log(Bun.resolveSync("plaited", process.cwd()+"/"))'
# → /path/to/src/main.ts

# Step 2 — read the barrel to find the backing module that exports your symbol
# The barrel re-exports: export * from './main/behavioral.ts'
#                       export type * from './main/behavioral.types.ts'
#                       export { ... } from './main/frontier-analysis.ts'
#                       export * from './main/renderer.ts'
# Pick the module that declares the symbol you need (e.g. src/main/behavioral.ts)

# Step 3 — enumerate the backing module's symbols with documentSymbol
plaited typescript-lsp '{"mode":"execute","file":"<resolved-path>","requests":[{"method":"textDocument/documentSymbol","params":{"textDocument":{"uri":"file://<resolved-path>"}}}]}'
```

`documentSymbol` returns each symbol in the backing module with its kind
and `range.start` location — hover the symbol you want using the position
from the output (no hardcoded line numbers).

### Fetch one symbol's TSDoc and type

```bash
# Step 4 — fetch one symbol's TSDoc and type (use range.start from Step 3 as the position)
plaited typescript-lsp '{"mode":"execute","file":"<resolved-path>","requests":[{"method":"textDocument/hover","params":{"textDocument":{"uri":"file://<resolved-path>"},"position":{"line":0,"character":0}}}]}'
```

Returns the `/** ... */` block plus the resolved type signature — the deeper
"what it does / how to debug it" content for the symbol.

### Getting the position right (common mistakes)

`hover` requires `position`; `documentSymbol` does not. These are easy to
mix up:

✓ `hover` with `position` → the TSDoc at that symbol.
✗ `hover` **without** `position` → empty/whole-file result, not an error.
✗ `documentSymbol` **with** `position` → ignored; still returns all symbols.

`method` lives inside `requests[]`, not at the top level:

✓ `{"mode":"execute","file":"...","requests":[{"method":"textDocument/hover","params":{...}}]}`
✗ `{"mode":"execute","file":"...","method":"textDocument/hover"}` → `method` is
  silently dropped and the request does nothing.

## See also

- [`plaited typescript-lsp --help`](../../typescript-lsp/SKILL.md) — the LSP CLI
  used by the going-deeper workflow.
- [Frontier analysis](./frontier-analysis.md) — deadlock/livelock verification
  over the closed state graph of a behavioral program.
