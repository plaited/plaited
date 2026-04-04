# Fanout Factories

## Goal

Research the default factory bundle for bounded multi-attempt execution,
comparison, and winner selection in a durable local-first Plaited runtime.

This lane should define how the system:

- launches multiple bounded attempts when one path is insufficient
- uses durable worktree-backed or equally observable attempt directories
- retains explicit artifacts for each attempt while it runs
- compares outcomes and promotes or merges a winning result

The target is not opaque swarm state. The target is explicit, reviewable
attempt fanout.

## Why This Lane Exists

The repo already points toward durable fanout expectations:

- default-factories assumes parallel mutation and retained artifacts
- workflow-state-factories covers in-process role orchestration
- observability-factories covers retained evidence
- plan-factories covers decomposition and replanning

What remains open is the bounded multi-attempt layer:

- when fanout is warranted
- what counts as an attempt unit
- how attempt directories or worktrees are created and retained
- what artifacts each attempt must emit while running
- how winners are selected, promoted, or merged

Without this lane, fanout risks being an ad hoc agent pattern instead of an
explicit local-first execution family.

## Relationship To Other Lanes

This lane sits under:

- `dev-research/default-factories/program.md`

It should integrate with:

- `dev-research/plan-factories/program.md`
- `dev-research/workflow-state-factories/program.md`
- `dev-research/observability-factories/program.md`
- `dev-research/node-home-factories/program.md`
- `dev-research/verification-factories/program.md`
- `dev-research/session-persistence-factories/program.md`

The intended split is:

- `fanout-factories` owns bounded attempt creation, retention, comparison, and
  winner selection
- `workflow-state-factories` owns in-process orchestration of roles
- `plan-factories` owns decomposition and replan policy
- `observability-factories` owns shared artifact and trace conventions

## Dependency Order

1. `dev-research/default-factories/program.md` defines the parallelism model
2. adjacent lanes define planning, workflow, observability, and persistence
   constraints
3. this lane hill-climbs the durable multi-attempt slice and feeds winners
   back into the default-factories umbrella

## Core Hypothesis

When the agent needs parallel attempts, the attempts should be durable and
observable enough to inspect while running and compare after completion.

The best default design will treat fanout as:

- bounded
- artifact-backed
- reviewable
- explicitly comparable

rather than as hidden concurrent agent chatter.

## Product Target

The first shipped fanout factory bundle should support:

1. deciding when to fan out versus continue serially
2. creating durable attempt scopes such as worktrees or equivalent directories
3. requiring each attempt to emit:
   - status or result JSON
   - changed-file or diff summary
   - targeted validation result
4. comparing attempts on explicit criteria
5. promoting, merging, or discarding attempts cleanly
6. retaining enough evidence for replay and later evaluation

## Required Architectural Properties

### 1. Attempts Must Be Durable

The lane should strongly prefer:

- git worktree-backed attempts
- or an equally durable and inspectable attempt substrate

### 2. Attempt State Must Be Observable While Running

The system should not rely on live agent state as the only record.

### 3. Comparison Must Be Explicit

Candidate designs should define:

- comparison criteria
- validation thresholds
- tie-break or escalation behavior

### 4. Fanout Must Stay Bounded

This lane should make it explicit:

- max attempt count
- naming and retention rules
- cleanup policy
- when fanout is disallowed

## Research Questions

This lane should answer:

- what task classes justify fanout?
- what is the minimum required artifact set per attempt?
- when should attempts be isolated by worktree versus lighter-weight
  directories?
- how should winner selection compose with verification and repair?
- how should failed or partial attempts be retained or cleaned up?

## Deliverables

This lane should produce:

- candidate fanout factory bundles
- attempt-artifact schemas and comparison rules
- eval tasks for bounded multi-attempt execution and winner selection
- a recommendation for how fanout should participate in the default bundle
