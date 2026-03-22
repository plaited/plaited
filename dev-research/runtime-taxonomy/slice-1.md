# Slice 1

## Target

Add the initial runtime taxonomy and in-process actor communication primitive.

## Scope

- `src/runtime/*`
- focused runtime tests
- minimal export boundary updates only

## Required

- runtime taxonomy types/constants/schemas
- concrete `BehavioralActor` shape
- in-process `createLink`
- directional bridges:
  - `linkToTrigger()`
  - `triggerToLink()`
- tests for publish/subscribe, cleanup, and both bridge directions

## Temporary Constraint

Keep the initial bridge path PM-mediated for simplicity and observability.

## Preserve

- PM-mediated routing remains the temporary constraint for this slice
- the runtime boundary stays explicit
- actor taxonomy remains local-runtime-only in this slice

## Avoid

- broad A2A redesign
- cross-process work before the in-process contract is stable
- collapsing the temporary PM-mediated constraint into the permanent design

## Acceptance Criteria

- runtime boundary exists and is explicit
- `createLink` works in-process
- tests validate the core contract
- validation passes

## Status

Implemented in Slice 1 checkpoint work. Preserve this file so the runtime plan survives context compaction.
