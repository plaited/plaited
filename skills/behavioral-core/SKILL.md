---
name: behavioral-core
description: Plaited behavioral programming patterns for event-driven coordination and symbolic reasoning. Use when implementing behavioral programs with behavioral()/useBehavioral, designing rule composition with bThread/bSync, orchestrating workflows or agent loops, or building neuro-symbolic reasoning layers.
license: ISC
compatibility: Requires bun
---

# Behavioral Core

## Purpose

This skill teaches agents how to use Plaited's behavioral programming (BP) paradigm — a coordination mechanism where independent threads synchronize through events. BP is the symbolic reasoning layer: threads declare what they want (`request`), what they listen for (`waitFor`), and what they prohibit (`block`). The engine selects events that satisfy all threads simultaneously.

**Use this when:**
- Implementing event-driven coordination with `behavioral()` or `useBehavioral`
- Designing rule composition with `bThread`/`bSync`
- Understanding event selection, blocking, and priority
- Building safety constraints via additive blocking threads
- Orchestrating agent loops, workflows, or test runners
- Adding runtime rules without modifying existing threads

## Quick Reference

**Core APIs:**
- `behavioral()` — Create a behavioral program instance
- `bThread(rules, repeat?)` — Compose synchronization points into sequences
- `bSync({ request?, waitFor?, block?, interrupt? })` — Declare synchronization idioms
- `useBehavioral()` — Factory pattern for reusable BP configurations with `publicEvents` whitelist
- `useFeedback()` — Register side-effect handlers (sync or async)
- `useSnapshot()` — Observe every BP engine decision (event selection, blocking)

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
- Counter-based completion (useRunner pattern)
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
- Restricted trigger API (publicEvents whitelist)

### Behavioral Programs Foundation

**[behavioral-programs.md](references/behavioral-programs.md)** — Complete BP paradigm documentation from Plaited source. Covers synchronization idioms, event selection algorithm, useBehavioral factory, non-UI use cases (test orchestration, game logic, workflow coordination), and neuro-symbolic reasoning integration.

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

### Pattern 4: Shared State + Block Predicates

Handlers modify state; block predicates read it. Works because `actionPublisher()` fires BEFORE `step()`:

```typescript
const simulatingIds = new Set<string>()

bThreads.set({
  simulationGuard: bThread([
    bSync({
      block: (event) => {
        if (event.type !== 'execute') return false
        return simulatingIds.has(event.detail?.id)
      },
    }),
  ], true),
})

useFeedback({
  simulate(detail) {
    simulatingIds.add(detail.id)  // handler modifies state
    // ... async work ...
    // simulatingIds.delete(detail.id)  // cleared when done
  },
})
```

### Pattern 5: Async Handler Bridging

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

### Blocked Events Are Silently Dropped

Blocked events are NOT queued. If `trigger()` fires an event that a bThread blocks, the event disappears. The caller must retry after the block lifts.

## Related Skills

- **code-patterns** — Utility function genome (coding conventions)
- **generative-ui** — Server-driven UI with BP (bElements, templates, controller protocol)
- **typescript-lsp** — Type verification and symbol discovery
- **code-documentation** — TSDoc standards
