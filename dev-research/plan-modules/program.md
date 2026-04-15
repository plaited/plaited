# Plan Modules

## Goal

Research the default planning-oriented module bundle for the Plaited agent.

This lane should define how the agent:

- turns user goals into explicit bounded plans
- routes among planning, execution, verification, and repair phases
- represents plan state as observable runtime facts
- supports decomposition without widening the minimal core agent engine

The target is not a giant built-in planner. The target is a module family
that makes planning explicit, reviewable, and composable.

## Why This Lane Exists

The repo already has strong ingredients for planning:

- a minimal eventful core in [src/agent/create-agent.ts](../../src/agent/create-agent.ts)
- behavioral thread composition through [skills/behavioral-core](../../skills/behavioral-core)
- bundle-level research and evaluation through [src/eval](../../src/eval)
- focused execution, search, memory, and verification lanes

What remains open is the planning policy layer:

- when a task should be decomposed
- how plans should be represented
- when a plan should be revised
- how execution should be gated by plan state
- how plan progress should be retained and projected

Without this lane, planning risks being half-buried in prompts, half-buried in
execution modules, and fully owned by none of them.

## Relationship To Other Lanes

This lane sits under:

- [dev-research/default-modules/program.md](../default-modules/program.md)

It should integrate with:

- [dev-research/search-modules/program.md](../search-modules/program.md)
- [dev-research/memory-modules/program.md](../memory-modules/program.md)
- [dev-research/edit-modules/program.md](../edit-modules/program.md)
- [dev-research/verification-modules/program.md](../verification-modules/program.md)
- [dev-research/three-axis-modules/program.md](../three-axis-modules/program.md)
- [dev-research/projection-modules/program.md](../projection-modules/program.md)

The intended split is:

- `plan-modules` owns decomposition, phase transitions, and plan-state policy
- `edit-modules` owns concrete change execution policy
- `verification-modules` owns checks and repair triggers
- `projection-modules` owns how plan state is exposed back to the model

## Dependency Order

1. [src/agent/create-agent.ts](../../src/agent/create-agent.ts) defines the minimal executable core
2. [src/agent/agent.types.ts](../../src/agent/agent.types.ts) defines the module and signal seams
3. [skills/behavioral-core/SKILL.md](../../skills/behavioral-core/SKILL.md) defines the BP coordination substrate
4. [dev-research/default-modules/program.md](../default-modules/program.md) defines the bundle question
5. this lane hill-climbs the planning slice and feeds its winners back into
   the default-modules umbrella

## Core Hypothesis

Planning should be represented as explicit behavioral state, not as a hidden
private chain-of-thought substitute and not as a loose blob of prompt text.

That means:

- plans should have bounded structure
- plans should drive execution routing
- replanning should be triggered by explicit conditions
- progress should be observable and reviewable

## Product Target

The first shipped planning module bundle should support:

1. deciding whether a task needs a plan at all
2. creating a bounded plan with explicit steps or phases
3. tracking plan state such as:
   - pending
   - in_progress
   - blocked
   - needs_replan
   - completed
4. routing execution and verification relative to that state
5. revising the plan when evidence invalidates the current route
6. projecting a concise current-plan view back into context

## Required Architectural Properties

### 1. Planning Is A Module Surface

This lane should avoid burying planning inside:

- prompts alone
- search results alone
- execution handlers alone
- memory summaries alone

Planning should remain an explicit composable layer.

### 2. Plans Must Stay Bounded

The default planning system should prefer:

- short explicit step lists
- phase-oriented routing
- lightweight dependency structure

It should avoid giant speculative plans that become stale before they are used.

### 3. Replanning Must Be Eventful

Candidate designs should make it explicit:

- what caused replanning
- what part of the plan changed
- what evidence triggered the change

### 4. Planning Must Compose With Verification

The planning layer should be able to route:

- pre-execution checks
- mid-plan corrections
- post-step verification
- repair after failed validation

### 5. Plan State Must Be Reviewable

Candidate designs should make it easy to inspect:

- current goal
- active plan state
- blocked step
- next intended action
- last replan cause

## Research Questions

This lane should answer:

- what is the smallest useful plan representation for the default agent?
- when should the agent plan versus act immediately?
- how should plan state be represented in signals or snapshots?
- when should failure trigger retry versus replanning?
- how much of the plan should be projected into the live context?

## Candidate Module Hypotheses

### 1. Step-List First

Hypothesis:

- a short ordered step list with explicit status covers most useful planning
  needs for the default bundle

### 2. Phase-Gate First

Hypothesis:

- a behavioral phase machine such as search -> plan -> execute -> verify ->
  repair is more reliable than free-form task lists alone

### 3. Replan-Trigger First

Hypothesis:

- the highest-value planning improvement is not richer initial planning but
  clearer conditions for when a plan must be revised

## Deliverables

This lane should produce:

- candidate planning module bundles
- eval tasks for decomposition, replanning, and blocked-state recovery
- retained traces showing plan-state transitions
- a recommendation for how planning should participate in the default bundle
