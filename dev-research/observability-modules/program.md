# Observability Modules

## Goal

Research the default observability-oriented module bundle for the Plaited
agent.

This lane should define how the agent:

- retains structured runtime traces
- emits analyzable artifact records for execution and coordination
- supports replay, inspection, and later model adaptation
- exposes enough observability without turning the runtime into opaque logging
  sprawl

The target is explicit reviewable runtime evidence, not generic telemetry for
its own sake.

## Why This Lane Exists

Plaited already has the right low-level substrate for observability:

- snapshots from the behavioral engine
- signals for shared runtime state
- durable artifacts through files and git-backed workspaces
- evaluation and trace retention through [src/eval](../../src/eval)

What remains open is observability policy:

- what should be retained
- at what granularity
- in what artifact formats
- which traces should feed later verification, replay, or retained training
  corpora

Without this lane, trace retention risks being partially owned by bash,
verification, memory, and harness workflows without a coherent default story.

## Relationship To Other Lanes

This lane sits under:

- [dev-research/default-modules/program.md](../default-modules/program.md)

It should integrate with:

- [dev-research/verification-modules/program.md](../verification-modules/program.md)
- [dev-research/memory-modules/program.md](../memory-modules/program.md)
- [dev-research/agent-harness-research/program.md](../agent-harness-research/program.md)
- [dev-research/bash-modules/program.md](../bash-modules/program.md)
- [dev-research/notification-modules/program.md](../notification-modules/program.md)
- [dev-research/projection-modules/program.md](../projection-modules/program.md)

The intended split is:

- `observability-modules` owns retained traces and artifact policy
- `projection-modules` owns concise live summaries
- `memory-modules` owns longer-horizon recall and consolidation

## Dependency Order

1. [src/agent/create-agent.ts](../../src/agent/create-agent.ts) defines the minimal core
2. [skills/behavioral-core/SKILL.md](../../skills/behavioral-core/SKILL.md) defines snapshot and event selection
   observability
3. [src/eval](../../src/eval) defines retained evaluation artifact patterns
4. [src/program-runner](../../src/program-runner) defines bounded worktree-backed
   module-program fanout patterns
5. [dev-research/default-modules/program.md](../default-modules/program.md) defines the bundle question
6. this lane hill-climbs the observability slice and feeds winners back into
   the default-modules umbrella

## Core Hypothesis

The default agent should produce explicit reviewable traces for key runtime
decisions, but those traces should remain structured, bounded, and tied to
specific decision classes rather than raw exhaust.

## Product Target

The first shipped observability module bundle should support:

1. retaining structured traces for important runtime events
2. associating traces with tasks, files, plans, or verification decisions
3. producing artifact records that support:
   - inspection
   - replay
   - judged comparison
   - later training or model adaptation
4. keeping artifact formats durable and reviewable by default
5. exposing enough status for operators without requiring deep log spelunking

## Required Architectural Properties

### 1. Observability Must Be Structured

Candidate designs should prefer:

- explicit event classes
- stable schemas
- bounded summaries
- append-friendly retained artifacts

It should avoid relying on unstructured stdout as the only evidence surface.

### 2. Observability Must Be Actionable

This lane should make it possible to answer:

- what happened
- why it happened
- what decision it informed
- what can be replayed or compared later

### 3. Observability Must Compose With Verification And Memory

The traces retained here should be usable by:

- verification and repair flows
- memory reflection and recall
- eval and model-adaptation workflows

## Research Questions

This lane should answer:

- what trace classes are worth retaining by default?
- which artifacts should be append-only versus rebuildable?
- how should trace retention differ for local runtime versus eval runtime?
- what is the minimum viable replay surface?
- which trace classes contribute most to a retained training corpus?

## Candidate Module Hypotheses

### 1. Snapshot-First

Hypothesis:

- behavioral snapshots already provide the best backbone for the first
  observability bundle

### 2. Artifact-Per-Run First

Hypothesis:

- explicit task/run artifact directories are the most useful first unit of
  retained evidence

### 3. Verification-Trace First

Hypothesis:

- the highest-value retained traces are the ones around failed, blocked, or
  repaired decisions

## Deliverables

This lane should produce:

- candidate observability module bundles
- artifact schemas and retained-trace patterns
- eval tasks for replayability and inspection quality
- a recommendation for how observability should participate in the default
  bundle
