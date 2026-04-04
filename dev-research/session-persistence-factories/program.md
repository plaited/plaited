# Session Persistence Factories

## Goal

Research the default factory bundle for durable session state, replay, and
restart behavior in a persistent Plaited agent runtime.

This lane should define how the system:

- retains session-scoped runtime artifacts and event history
- restores enough state after restart to continue coherent work
- separates durable session state from longer-horizon memory and node-home
  persistence
- supports reviewable replay and partial-output recovery without widening the
  minimal core

The target is not one opaque runtime singleton. The target is a factory family
for explicit session continuity in a long-lived agent.

## Why This Lane Exists

The current architecture already has the right boundaries for this work:

- `src/agent/create-agent.ts` stays minimal and eventful
- `dev-research/node-home-factories/program.md` owns durable node-home and
  promotion semantics
- `dev-research/memory-factories/program.md` owns longer-horizon recall and
  consolidation
- `dev-research/observability-factories/program.md` owns richer retained
  traces

What remains open is the middle layer:

- what session state should persist across restart
- how active or recent runs are reconstructed
- how partial execution output is recovered
- what session artifacts support replay, audit, and resumption
- how session continuity composes with background proactive behavior

Without this lane, restart semantics risk being split awkwardly across memory,
node-home, observability, and ad hoc runtime code.

## Relationship To Other Lanes

This lane sits under:

- `dev-research/default-factories/program.md`

It should integrate with:

- `dev-research/node-home-factories/program.md`
- `dev-research/memory-factories/program.md`
- `dev-research/observability-factories/program.md`
- `dev-research/projection-factories/program.md`
- `dev-research/fanout-factories/program.md`

The intended split is:

- `session-persistence-factories` owns session continuity, replay, and restart
  policy
- `node-home-factories` owns broader durable home and promotion semantics
- `memory-factories` owns retained recall beyond one session's working state
- `observability-factories` owns richer trace retention beyond the minimum
  restart surface

## Dependency Order

1. `src/agent/create-agent.ts` defines the minimal core
2. `docs/AGENT-LOOP.md` defines factory-composed orchestration
3. adjacent lanes define node-home, memory, observability, and projection
   constraints
4. this lane hill-climbs the session continuity slice and feeds winners back
   into the default-factories umbrella

## Core Hypothesis

Persistent proactive agents need an explicit session layer between:

- transient in-memory execution
- durable long-horizon memory
- full node-home persistence

The best default design will preserve enough session state to:

- resume coherent work
- inspect what happened recently
- recover partial outputs and pending work
- avoid replaying the entire transcript into live context

## Product Target

The first shipped session-persistence factory bundle should support:

1. explicit session-scoped artifact retention
2. restart-aware reconstruction of recent work state
3. partial-output and in-flight-task recovery
4. replayable recent event history with provenance
5. separation between session state, durable memory, and node-home state
6. bounded retention suitable for a long-lived local-first runtime

## Required Architectural Properties

### 1. Session Persistence Must Stay Distinct From Memory

This lane should preserve the difference between:

- session working state
- longer-horizon memory or reflection artifacts

### 2. Restart Behavior Must Be Reviewable

Candidate designs should make it easy to inspect:

- what state was restored
- what state was dropped
- what artifacts were used for recovery
- what tasks remain pending or incomplete

### 3. Partial Output Must Be Recoverable

Long-running local execution or background work should not depend on one live
process staying attached.

### 4. Session Retention Must Stay Bounded

This lane should prefer:

- append-friendly artifacts
- recent-history windows
- explicit rollover or expiry policy

It should avoid turning session persistence into unbounded transcript hoarding.

## Research Questions

This lane should answer:

- what is the minimal session state needed for restart?
- what artifacts should be append-only versus reconstructable?
- how should pending or partial tasks be represented durably?
- how should session replay differ from memory recall?
- when should a session be resumable versus archived?

## Deliverables

This lane should produce:

- candidate session-persistence factory bundles
- restart and replay artifact schemas
- eval tasks for recovery, replay, and partial-output continuation
- a recommendation for how session persistence should participate in the
  default bundle
