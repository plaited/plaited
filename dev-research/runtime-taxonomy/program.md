# Runtime Taxonomy Program

This directory contains bounded autoresearch artifacts for improving Plaited's
internal runtime coordination model.

It is not the same thing as future user- or agent-generated research objects
inside a running node.

## Mission

Improve Plaited's internal runtime coordination model without changing the user
or system model.

Plaited remains:
- a sovereign personal agent runtime
- a modnet node whose A2A boundary terminates at the PM/node edge
- a BP-first system
- a git + hypergraph backed system of provenance, rollback, and training context

## Fixed Architecture

These decisions are already made. Do not change them.

- MSS is a structural layer, not a 1:1 package ontology.
- Internal modules remain local to the node.
- A2A exchanges tasks, services, artifacts, and controlled data.
- A2A always terminates at the PM/node boundary first.
- Actors are behavioral-program-shaped runtimes.
- PM is sovereign coordinator and treaty authority.
- PM mediation in Slice 1 is temporary. Direct actor-to-actor messaging is a target state.
- Constitution, boundary policy, promotion policy, and external A2A mediation must not be bypassed.

## Runtime Taxonomy

- MSS object: structural description only
- artifact: concrete implementation asset
- behavioral actor: BP runtime edge around an MSS object/artifact
- sub-agent: isolated behavioral actor with fresh context/runtime
- team: coordinated set of sub-agents with direct messaging and shared task graph
- PM: sovereign coordinator

## Behavioral Foundations

- Behavioral actors use the same BP foundations as the main runtime.
- PM carries the broadest coordination and treaty authority.
- Sub-agents inherit at least the MAC floor and may receive task-scoped governance derived from PM.
- Direct actor messaging is allowed as the target architecture, but it must remain observable and policy-constrained.

## Promotion Ladder

- MSS object -> behavioral actor
  Trigger: mechanics / bridge-code require eventful coordination.
- behavioral actor -> sub-agent
  Trigger: isolation, fresh context, or independent inference/task loop required.
- sub-agent -> team
  Trigger: parallel specialists, direct messaging, dependency tracking, or competing hypotheses required.

## Demotion

Demotion tears down the runtime edge while preserving the MSS object and artifact.

## Execution Rules

- Use an autoresearch-style workflow for implementation slices.
- The architecture is already decided here; do not use autoresearch to reinvent it.
- For each slice, choose one bounded mutation target, implement it, run validation, evaluate the result, and either keep it or revise it.
- Prefer small experimental steps over broad rewrites.
- Keep the public runtime boundary explicit and small.

## Validation

For accepted code slices, both must pass:

- `bun --bun tsc --noEmit`
- `bun test src/ skills/ scripts/`

## Slice Progression

- Slice 1: runtime taxonomy and in-process `createLink`
- Slice 2: IPC bridge for `createLink`
- Slice 3: explicit actor/sub-agent/team integration path
- Slice 4: local Attempt-DAG TeamHub for sovereign node teams
- Slice 5: PM-governed winner selection for local TeamHub attempts

## Keep / Revise / Discard

Keep only changes that:
- preserve the fixed architecture
- satisfy the slice acceptance criteria
- improve the runtime without expanding accidental complexity

Revise or discard changes that:
- hide coordination outside BP event flow
- weaken observability
- introduce architecture drift outside the current slice
