# Eval

Reference for an agent assisting an engineer in wiring up Plaited's
behavioral-program **eval capture** primitives. These tools answer: *how do I
capture an agent run (with or without a behavioral coordination layer) into a
trace I can later grade, and — for behavioral agents — how do I analyze the
branching structure of that run?*

This is the eval-shaped use of the trace primitives. For the iterative
hill-climb use (capture a small experiment, analyze the trace, mutate, repeat
on a fixed budget), see [Auto-research](./autoresearch.md) — same primitives,
different purpose.

## Public surface (import from `plaited`)

```ts
import {
  behavioral,
  type Trace,
  type TraceBase,
  type UseTrace,
  type SendTrace,
  type TraceListener,
} from 'plaited'
```

`useTrace` and `sendTrace` are returned by `behavioral()` (the frozen public
API object), not imported directly. The type aliases above are re-exported so
consumers can type their own listeners and extension events.

`Trace` is the engine's closed discriminated union of trace kinds
(`selection`, `frontier`, `pending_bids`, `deadlock`, `runtime_error`,
`feedback_error`, `add_thread_error`). `TraceBase` is the structural contract
for consumer-supplied extensions: `{ kind: string; timestamp: number }` plus
kind-specific fields.

For divergence analysis over a captured run, also import the
[frontier-analysis](./frontier-analysis.md) functions (`exploreFrontiers`,
`verifyFrontiers`, `replayToFrontier`).

## When to use which

| Need | Use |
|------|-----|
| Observe a behavioral program's own execution (logging/debugging) | `behavioral()` + `useTrace`; default `T = never`, no `sendTrace`. Listener receives only `Trace`. |
| Capture a behavioral agent's run *plus* agent-lifecycle events for grading | `behavioral<T>()` + `useTrace` (listener receives `Trace \| T`) + `sendTrace` (injects `T`). Define `T` extending `TraceBase`. |
| Grade a linear run over an outcome | Post-hoc grader over the captured trace. plaited supplies **no grading code** — the consumer's grader reads the trace and emits a result. |
| Analyze reachable branches of a behavioral agent's run (divergence) | `exploreFrontiers` / `verifyFrontiers` over captured `Thread[]` + messages. See [frontier-analysis](./frontier-analysis.md). |

The first row is the base case: behavioral as a logging/observation utility
for its own execution. The second extends it with agent events. The third and
fourth are what you do with the captured trace *after* the run — plaited's
role ends at capture (and, for divergence, at analysis).

## The capture wiring

The capture layer is always a `useTrace` listener. What the listener does
with each event is the consumer's choice — the callback is the sink. plaited
does not prescribe JSONL, a database, a socket, or any particular store. The
callback writes wherever the consumer wants.

```ts
import { behavioral, type TraceBase } from 'plaited'

// 1. Define the agent-lifecycle events you want to capture alongside the
//    engine's Trace variants. Extend TraceBase ({ kind, timestamp }) with
//    kind-specific fields. Use literal `kind` strings distinct from the
//    engine's TRACE_MESSAGE_KINDS so narrowing by `kind` is unambiguous.
type AgentEvent =
  | { kind: 'tool_call'; timestamp: number; tool: string; args: unknown }
  | { kind: 'agent_message'; timestamp: number; content: string }
  | { kind: 'agent_error'; timestamp: number; message: string }

// 2. Construct the program with your extension type. Default T = never omits
//    this and the listener receives only Trace.
const program = behavioral<AgentEvent>()
const { useTrace, sendTrace, useAddThread, useTrigger } = program

// 3. Subscribe a capture listener. It receives Trace | AgentEvent — engine
//    traces and your injected agent events in one stream, in publication order.
const events: Array<Trace | AgentEvent> = []
useTrace((msg) => {
  events.push(msg)
  // ...or write to a file, socket, DB, stdout — the callback is the sink.
})

// 4. From the agent SDK's lifecycle callbacks (pi session.subscribe, Claude
//    Code hooks, etc.), call sendTrace to inject agent events into the same
//    stream the capture listener reads. sendTrace accepts ONLY AgentEvent —
//    engine Trace variants are rejected by the type system.
//
//   session.subscribe((e) => {
//     if (e.type === 'tool_execution_end') {
//       sendTrace({ kind: 'tool_call', timestamp: Date.now(), tool: e.toolName, args: e.input })
//     }
//   })
```

The behavioral program itself (threads, triggers, feedback handlers) is wired
with `useAddThread` / `useTrigger` / `useAddHandler` as usual — see
[behavioral](./behavioral.md). The capture layer is orthogonal: it observes
the program's execution via `useTrace` and bridges the agent SDK's lifecycle
into the same stream via `sendTrace`.

## What constitutes a trace? (intake)

The old `agent-eval-harness` answered this for you with a fixed shape. With
the harness dissolved, the agent + engineer decide. These are the questions to
surface (use `grill-me` to work through them with the engineer) — the answers
shape the capture wiring and differ by eval:

- **Boundary** — what counts as one trace? One agent session? One task attempt?
  One inference turn? One branched exploration? For eval, usually *one trial*
  (one task attempt, from start to a terminal result).
- **Lifecycle** — what event closes the trace and triggers flush? A
  `completed`/`failed`/`timed_out` result? A turn budget? A wall-clock budget?
  The flush trigger is where the capture callback hands the accumulated events
  to whatever comes next (a grader, a file write, a socket send).
- **Sink** — where does the `useTrace` callback write? File, socket, DB, in-memory,
  stdout. plaited doesn't know or care; the callback handles it.
- **Retention** — for eval, are all trials kept, or only failures, or a sample?
  The keep/discard rule is the consumer's.
- **Analysis target** — post-hoc outcome grading (grade what the agent produced),
  divergence analysis (`frontier-analysis` over the behavioral layer's branches),
  or both? This determines whether you need `Thread[]` capture (see below).

## The `Thread[]` capture concern (behavioral agents only)

`useTrace` gives you the **messages** (the trace stream). `frontier-analysis`
needs the **threads** that produced those messages — `exploreFrontiers` and
`verifyFrontiers` take a `Thread[]` plus a `messages` trace. If the agent runs
a behavioral program and you want divergence grading later, persist the
`Thread[]` definition at capture time, alongside the trace:

```ts
const threads: Thread[] = [
  { label: 'coordinator', rules: [...], once: true },
  // ...the threads the agent's behavioral layer runs
]
// At flush: write `threads` and `events` together — one trial's full capture.
```

A consumer who wires `useTrace` and later wants `frontier-analysis` without
having captured `Thread[]` is stuck — the messages alone aren't enough to
reconstruct reachable branches. Surface this at intake time, not after the
run. For a plain agent (no behavioral layer), there are no threads and
`frontier-analysis` doesn't apply — only trace grading does.

## Grading is beyond this package

plaited supplies the capture primitives (`useTrace`, `sendTrace`) and, for
behavioral agents, the divergence-analysis primitive (`frontier-analysis`).
It supplies **no grading code**. Graders are consumer-authored and run
wherever the consumer chose to sink the trace:

- **Deterministic** — read the trace, apply rules (gold-answer match, BP-health
  metrics over `kind` counts, token/cost aggregation). The consumer's code, in
  the consumer's chosen language/store.
- **LLM-rubric** — a subprocess grader that reads the trace and asks a judge
  model. The consumer authors the grader; plaited does not ship a grader
  contract or IO helpers.
- **Hybrid** — deterministic pre-filter + LLM-rubric on the survivors.

Anthropic's framing applies to the outcome-grading subset: *grade what the
agent produced, not the path it took.* Trajectory signals (tool-call count,
BP deadlocks, latency) are metrics, not pass/fail graders. The divergence
case is the exception — there, the *branches* are the thing being graded, and
`frontier-analysis` is the tool.

## A common wiring mistake to avoid

Wiring `useTrace`, running the agent, then discovering you wanted divergence
grading and have no `Thread[]`. The messages alone can't reconstruct
reachable branches. Decide at intake whether the eval needs divergence
analysis; if it does, capture `Thread[]` alongside the trace. If it doesn't
(plain agent, outcome-only grading), skip `Thread[]` capture and skip
`frontier-analysis` — they don't apply without a behavioral layer.

## Going deeper

The capture primitives are in `src/behavioral/behavioral.ts` (`useTrace`,
`sendTrace`) and the trace types are in `src/behavioral/behavioral.schemas.ts`
(`Trace`, `TraceBase`, the variant schemas). Each export's TSDoc names its
contract — fetch it with the TypeScript LSP CLI rather than re-reading the
whole file.

### Enumerate the file's public exports

```bash
plaited typescript-lsp '{"mode":"execute","file":"src/behavioral/behavioral.types.ts","requests":[{"method":"textDocument/documentSymbol","params":{"textDocument":{"uri":"file://src/behavioral/behavioral.types.ts"}}}]}'
```

### Fetch one symbol's TSDoc and type

```bash
plaited typescript-lsp '{"mode":"execute","file":"src/behavioral/behavioral.types.ts","requests":[{"method":"textDocument/hover","params":{"textDocument":{"uri":"file://src/behavioral/behavioral.types.ts"},"position":{"line":142,"character":13}}}]}'
```

`position` is 0-indexed. Get the exact line from `documentSymbol` output (its
`range.start` is also 0-indexed), not by counting in your editor. `hover`
requires `position`; `documentSymbol` does not.

## See also

- [frontier-analysis](./frontier-analysis.md) — divergence analysis over a captured `Thread[]` + messages.
- [Auto-research](./autoresearch.md) — the iterative hill-climb use of the same capture primitives.
- [behavioral](./behavioral.md) — wiring the behavioral program itself (`useAddThread`, `useTrigger`, `useAddHandler`).
