---
name: behavioral-core
description: Plaited behavioral programming patterns for event-driven coordination, workflow control, and symbolic rule composition. Use when implementing behavioral programs with behavioral(), designing rule composition with bThread/bSync, orchestrating controllers, workflows, or agent loops, or building neuro-symbolic control layers.
license: ISC
compatibility: Requires bun
---

# Behavioral Core

## Purpose

This skill teaches agents how to use Plaited's behavioral programming (BP) paradigm — an embedded TypeScript DSL for coordination where independent threads synchronize through events. Threads declare what they want (`request`), what they listen for (`waitFor`), and what they prohibit (`block`). The engine selects events that satisfy all threads simultaneously.

In this repo, BP is not only for symbolic reasoning. It is used as a general event-driven coordination model across controllers, workflows, agent loops, and rule systems. It is especially well suited to neuro-symbolic control, but that is only one of its uses.

**Use this when:**
- Implementing event-driven coordination with `behavioral()`
- Designing rule composition with `bThread`/`bSync`
- Understanding event selection, blocking, and priority
- Building safety constraints via additive blocking threads
- Orchestrating controllers, agent loops, workflows, or test runners
- Adding runtime rules without modifying existing threads

## Quick Reference

**Core APIs:**
- `behavioral()` — Create a behavioral program instance
- `bThread(rules, repeat?)` — Compose synchronization points into sequences
- `bSync({ request?, waitFor?, block?, interrupt? })` — Declare synchronization idioms
- `useFeedback()` — Register side-effect handlers (sync or async)
- `useSnapshot()` — Observe every BP engine decision (event selection, blocking)

**Code pattern:** In this repo, authors use the behavioral factory APIs directly. Do not write raw generator functions or raw `yield` statements in repo code; express behavior with `bThread()` and `bSync()`, and treat generator mechanics as behavioral-core implementation detail.

**Testing:** BP logic is tested with Bun tests (`*.spec.ts`), not browser stories. See `src/behavioral/tests/` for examples.

## References

### Algorithm Reference

**[algorithm-reference.md](references/algorithm-reference.md)** — Deep reference for the BP algorithm as implemented in `src/behavioral/`. Covers:
- Core algorithm with formal definitions
- Priority-based event selection (Plaited's strategy)
- Super-step execution model and handler timing
- The `repeat` parameter (`true`, `false`, `() => boolean`)
- Ephemeral vs persistent blocks
- Shared state with block predicates
- Async feedback and the BP loop
- Infinite super-step anti-pattern
- Academic paper concepts (additive composition, scenario classification, pluggable ESM)

### Exploration Tests

**[agent-patterns.spec.ts](references/agent-patterns.spec.ts)** — 14 validated patterns for agent design:
- doneGuard blocking, ephemeral blocks, persistent blocks
- Shared state between handlers and predicates
- Counter-based completion via events
- Async handler → trigger chaining
- Event routing by predicate
- Additive composition of independent requirements

**[agent-lifecycle.spec.ts](references/agent-lifecycle.spec.ts)** — 5 validated lifecycle patterns:
- Per-task threads: interrupt + dynamic addition + re-use
- Mid-sequence interrupt (thread killed wherever it is)
- `repeat: () => boolean` conditional self-termination
- Task gate: blocks stale events between tasks
- Stale async trigger protection

**[agent-orchestration.spec.ts](references/agent-orchestration.spec.ts)** — 10 validated orchestration patterns:
- Phase-transition routing (taskGate pattern)
- Queue blocking (one-at-a-time enforcement)
- useSnapshot for observability and event logging
- Constitution as additive bThreads (config-driven rules)
- Runtime rule addition without modifying existing threads
- Parallel simulation coordination (Set-based guard)
- Restricted trigger API (useRestrictedTrigger boundary)

### Behavioral Programs Foundation

**[behavioral-programs.md](references/behavioral-programs.md)** — Conceptual BP foundation document. Use this when the embedded agent needs the general paradigm and the embedded DSL model:
- what behavioral programming is
- synchronization idioms (`request`, `waitFor`, `block`, `interrupt`)
- thread composition and lifecycle
- predicate usage and general non-UI coordination patterns

Use `algorithm-reference.md` when the embedded agent needs **Plaited-specific runtime semantics**:
- super-step timing
- priority behavior
- handler ordering
- persistent vs ephemeral blocks
- current repo-grounded coordination patterns

## Key Patterns

### Pattern 1: Phase-Transition Gate (taskGate)

The most important coordination pattern. A two-phase thread alternates between allowing and blocking events:

```typescript
bThreads.set({
  taskGate: bThread([
    // Phase 1: block task events, wait for 'task' to start
    bSync({ waitFor: 'task', block: (e) => TASK_EVENTS.has(e.type) }),
    // Phase 2: allow everything, wait for 'message' to end task
    bSync({ waitFor: 'message' }),
  ], true),  // loops: message → back to blocking
})
```

**Use for:** Task lifecycle gating, orchestrator routing, one-at-a-time enforcement. The thread's position in its rule sequence IS the coordination state — no external variables needed.

### Pattern 2: Per-Task Dynamic Threads

Threads added per task, interrupted when the task ends:

```typescript
useFeedback({
  task(detail) {
    bThreads.set({
      maxIterations: bThread([
        bSync({ waitFor: 'tool_result', interrupt: ['message'] }),
        bSync({ waitFor: 'tool_result', interrupt: ['message'] }),
        bSync({
          block: 'execute',
          request: { type: 'message', detail: { content: 'Max reached' } },
          interrupt: ['message'],
        }),
      ]),
    })
  },
})
```

**Key mechanics:** After interrupt, the thread name is freed for re-use. `bThread` without `repeat` = one-shot (terminates after last rule). Interrupt kills the thread wherever it is in the sequence.

### Pattern 3: Additive Safety Rules (Constitution)

Each safety rule is an independent blocking thread. New rules compose without touching existing ones:

```typescript
// Rule 1: block /etc/ writes
bThreads.set({
  noEtcWrites: bThread([
    bSync({
      block: (e) => e.type === 'execute' && e.detail?.path?.startsWith('/etc/'),
    }),
  ], true),
})

// Rule 2: block rm -rf (added later, doesn't modify rule 1)
bThreads.set({
  noRmRf: bThread([
    bSync({
      block: (e) => e.type === 'execute' && e.detail?.command?.includes('rm -rf'),
    }),
  ], true),
})
```

**Config-driven:** Rules can be loaded from arrays/JSON — each entry becomes a bThread with `repeat: true`.

### Pattern 4: Per-Call Dynamic Threads with Predicate Interrupt

Instead of persistent threads reading shared mutable state, each scoped operation gets its own guard thread that self-terminates via predicate interrupt:

```typescript
useFeedback({
  simulate(detail) {
    const id = detail.toolCall.id

    // Per-call guard: blocks execute until simulation completes
    bThreads.set({
      [`sim_guard_${id}`]: bThread([
        bSync({
          block: (e) => e.type === 'execute' && e.detail?.toolCall?.id === id,
          interrupt: [(e) => e.type === 'simulation_result' && e.detail?.toolCall?.id === id],
        }),
      ]),
    })

    // ... async simulation work ...
    trigger({ type: 'simulation_result', detail: { toolCall: detail.toolCall, prediction } })
    // sim_guard_{id} is interrupted (killed) by the simulation_result event
  },
})
```

**Key mechanics:**
- Block and interrupt both use **predicate listeners** scoped to a specific ID
- Thread self-terminates via interrupt — no shared state cleanup needed
- Thread name is unique per call → no collisions
- Observable: `SelectionBid.blockedBy: "sim_guard_tc-1"` and `SelectionBid.interrupts: "sim_guard_tc-1"` in snapshots

**Prefer for per-call scoped guards when lifecycle clarity matters.**
Persistent threads reading from mutable Sets/Maps can still be valid
coordination patterns, but they create more implicit coupling than a per-call
thread with explicit interrupt-based teardown.

### Pattern 5: Snapshot Observability

All BP decisions are observable via `useSnapshot`. `SelectionBid` records:
- `blockedBy: string` — which thread blocked this event
- `interrupts: string` — which thread was interrupted when this event was selected
- `selected: boolean` — whether this bid was the winning event
- `thread: string` — which thread proposed this bid

```typescript
// Persist snapshots → SQLite → model system prompt
useSnapshot((snapshot) => {
  if (snapshot.kind === 'selection') {
    for (const bid of snapshot.bids) {
      memory.saveEventLog({
        sessionId,
        eventType: bid.type,
        thread: bid.thread,
        selected: bid.selected,
        trigger: bid.trigger,
        priority: bid.priority,
        blockedBy: bid.blockedBy,     // "sim_guard_tc-1"
        interrupts: bid.interrupts,   // "sim_guard_tc-1"
        detail: bid.detail,
      })
    }
  }
})
// The model sees: "Blocked: execute (thread: sim_guard_tc-1) by sim_guard_tc-1"
// in its system prompt via formatSelectionContext()
```

**Blocks are NOT silent** — they are fully observable via snapshot. Persist snapshots to storage and feed them to the agent's context for full visibility into BP decisions.

### Pattern 6: Async Handler Bridging

The BP engine is synchronous. Async work (inference, I/O) happens in feedback handlers. The handler's `trigger()` after `await` starts a NEW super-step:

```typescript
useFeedback({
  async task(detail) {
    // Super-step ends here (async = fire-and-forget)
    const response = await inferenceCall(detail.prompt)
    // NEW super-step starts:
    trigger({ type: 'model_response', detail: { parsed: response } })
  },
})
```

## Critical Rules

### Ephemeral vs Persistent Blocks

A block on a sync point with a `request` is **ephemeral** — it vanishes after the request fires:

```typescript
// EPHEMERAL: block disappears after 'terminal' fires
bSync({ block: 'execute', request: { type: 'terminal' } })

// PERSISTENT: block stays forever (no request/waitFor to advance past it)
bSync({ block: () => true })
```

If you need a permanent block after a finite sequence, compose two threads: the sequence thread requests a completion event, a persistent thread (with `repeat: true`) waits for that event and then blocks.

### Infinite Super-Step Anti-Pattern

Never combine `repeat: true` with continuous `request`:

```typescript
// ANTI-PATTERN: stack overflow
worker: bThread([bSync({ request: { type: 'work' } })], true)
```

Events must enter via `trigger()` from handlers or external calls, breaking the synchronous chain.

### The `repeat` Parameter

| Value | Behavior | When to Use |
|-------|----------|-------------|
| `false` / omit | One-shot: rules run once, thread terminates | Counting sequences, per-task threads |
| `true` | Infinite loop: thread never terminates | Safety constraints, persistent gates |
| `() => boolean` | Conditional: repeats while predicate returns `true` | Task-scoped threads that self-terminate |

### Handler Operation Order: `bThreads.set()` Before `trigger()`

This is a **general BP rule**. The example below is an **agent-loop-specific
application**.

**CRITICAL:** `trigger()` calls `step()` synchronously — the full
step/select/nextStep chain runs within the trigger call. `useFeedback` handlers
may be sync or async, but the dispatcher does not await them (`void cb(value)`).
Thread state transitions are still synchronous.

This means `bThreads.set()` MUST come BEFORE any `trigger()` calls in the same handler, or the new thread will miss events that fire during the trigger's synchronous processing:

```typescript
// CORRECT: thread present when trigger fires
useFeedback({
  model_response(detail) {
    bThreads.set({ batchCompletion: bThread([...]) })  // thread added to running
    trigger({ type: 'context_ready' })                  // step() processes batchCompletion
  },
})

// WRONG: thread misses events — gate_rejected fires before batchCompletion exists
useFeedback({
  model_response(detail) {
    trigger({ type: 'context_ready' })                  // step() runs, events process, chain completes
    bThreads.set({ batchCompletion: bThread([...]) })  // too late — nobody calls step() again
  },
})
```

**Why it matters:** When `trigger(context_ready)` fires, the BP engine processes it synchronously. If the context_ready handler triggers `gate_rejected`, that also processes synchronously. `batchCompletion` needs to be in the pending set to catch `gate_rejected` as a completion event. If set after trigger, it sits in running with no step() call to advance it.

### Zero-Length Counting Threads Need an Explicit Fast Path

This is a **general counting-thread rule**. The example below is an
**agent-loop-specific application**.

A counting thread like `batchCompletion` with zero `waitFor` entries does not
wait at all. It immediately advances to its terminal `request` (for example,
`invoke_inference`).

In the agent loop, that is the wrong behavior: the zero-tool case should take
an explicit fast path instead of re-entering the workflow as though a real batch
completed:

```typescript
// WRONG FOR THIS FLOW: zero-length batch immediately requests invoke_inference
bThreads.set({
  batchCompletion: bThread([
    ...Array.from({ length: 0 }, () => bSync({ waitFor: isCompletion })),  // empty!
    bSync({ request: { type: 'invoke_inference' } }),  // fires immediately
  ]),
})

// CORRECT: only create batchCompletion when there are items to count
if (toolCalls.length > 0) {
  bThreads.set({ batchCompletion: bThread([...]) })
  for (const tc of toolCalls) trigger({ type: 'context_ready', detail: { toolCall: tc } })
} else {
  trigger({ type: 'message', detail: { content: text } })
}
```

**Rule of thumb:** if the batch size may be zero, branch explicitly outside the
thread. Do not rely on a zero-length counting thread to "wait for nothing" and
still preserve the intended control flow.

### Blocked Events Don't Produce Workflow Events

This is a **general BP rule**. The completion-counting implication below is the
**agent-loop-specific application**.

Blocked events are NOT queued — they don't fire. However, blocks ARE observable: `SelectionBid.blockedBy` records exactly which thread blocked which event. The event doesn't produce workflow side-effects (handlers don't fire), but the snapshot captures the decision.

**Implication for counting threads:** If a thread like `batchCompletion` counts N completion events and one is blocked, the batch deadlocks. Pair blocking bThreads with handler-level checks that produce rejection events for workflow coordination.

## Related Skills

- **code-patterns** — Utility function genome (coding conventions)
- **plaited-ui** — Server-driven UI with BP (templates, controller protocol, testing)
- **typescript-lsp** — Type verification and symbol discovery
- **code-documentation** — TSDoc standards
