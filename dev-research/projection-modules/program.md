# Projection Modules

## Goal

Research the default projection-oriented module bundle for the Plaited agent.

This lane should define how the agent projects internal state back into
model-usable and operator-usable context.

That includes:

- plan-state projection
- memory and search-result projection
- progress summaries
- concise status blocks derived from richer retained traces

The target is not generic summarization. The target is a policy layer that
decides what internal facts should become live context and in what form.

## Why This Lane Exists

The repo already has many rich internal surfaces:

- behavioral snapshots
- signals and computed state
- search results
- memory observations and reflections
- verification and execution artifacts

What remains open is projection policy:

- what should be shown now
- what should stay retained but off-screen
- how large projections should be
- how projections should vary by task phase

Without this lane, context assembly risks becoming a scattered mixture of ad
hoc summaries from each neighboring module family.

## Relationship To Other Lanes

This lane sits under:

- [dev-research/server-module/program.md](../server-module/program.md)

It should integrate with:

- [dev-research/plan-modules/program.md](../plan-modules/program.md)
- [dev-research/search-modules/program.md](../search-modules/program.md)
- [dev-research/memory-modules/program.md](../memory-modules/program.md)
- [dev-research/verification-modules/program.md](../verification-modules/program.md)
- [dev-research/notification-modules/program.md](../notification-modules/program.md)
- [dev-research/observability-modules/program.md](../observability-modules/program.md)

The intended split is:

- `projection-modules` owns live-context shaping and concise projections
- `observability-modules` owns richer retained evidence
- `memory-modules` owns long-horizon consolidation and recall

## Dependency Order

1. [src/agent/create-agent.ts](../../src/agent/create-agent.ts) defines the minimal core
2. [src/agent/agent.types.ts](../../src/agent/agent.types.ts) defines the shared state and module seams
3. [skills/behavioral-core/SKILL.md](../../skills/behavioral-core/SKILL.md) defines the runtime signal and snapshot
   substrate
4. [dev-research/server-module/program.md](../server-module/program.md) defines the bundle question
5. this lane hill-climbs the projection slice and feeds winners back into the
   server-module issue backlog

## Core Hypothesis

The default agent will use its other modules more reliably if internal state
is projected through a small number of intentional context blocks rather than
through raw traces or one-off summaries.

That means projection should be:

- selective
- bounded
- phase-aware
- provenance-aware

## Product Target

The first shipped projection module bundle should support:

1. selecting which internal facts are relevant to the current phase
2. projecting concise blocks for:
   - current plan
   - current constraints
   - recent verified progress
   - unresolved failures
   - relevant retrieved evidence
3. varying projection size and detail by task complexity
4. avoiding repeated projection of unchanged low-value context
5. preserving provenance so projected claims remain inspectable

## Required Architectural Properties

### 1. Projection Is Not Raw Logging

This lane should convert richer internal state into compact context blocks. It
should not dump raw logs, raw snapshots, or full search outputs into the live
window by default.

### 2. Projection Must Be Bounded

Candidate designs should prefer:

- fixed-size or thresholded blocks
- stable ordering
- incremental updates

### 3. Projection Must Be Phase-Aware

Different phases may need different projections, for example:

- planning needs constraints and retrieved evidence
- execution needs active step and edit targets
- verification needs proposed changes and failure state

### 4. Projection Must Preserve Provenance

Projected context should keep enough linkage to answer:

- where this fact came from
- when it was last updated
- what deeper artifact can be consulted if needed

## Research Questions

This lane should answer:

- what context blocks are most useful for the default bundle?
- how should projections differ by task phase?
- how should unchanged projections be suppressed for prompt-cache reuse?
- what provenance is sufficient without overloading the live context?
- how should projection compose with memory recall and search summaries?

## Candidate Module Hypotheses

### 1. State-Block First

Hypothesis:

- a small fixed set of context blocks yields most of the projection value for
  the default bundle

### 2. Phase-Scoped Projection First

Hypothesis:

- phase-aware projection outperforms one universal summary format

### 3. Change-Only Projection First

Hypothesis:

- only projecting state changes meaningfully improves context quality and
  prompt-cache stability

## Deliverables

This lane should produce:

- candidate projection module bundles
- context-block schemas and projection rules
- eval tasks for context usefulness and prompt-noise control
- a recommendation for how projection should participate in the default bundle
