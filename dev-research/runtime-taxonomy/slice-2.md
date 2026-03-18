# Slice 2

## Target

Add IPC bridge support for `createLink`.

## Scope

- `src/runtime/*`
- runtime tests only
- minimal supporting changes if strictly required

## Required

- cross-process actor messaging
- canonical BP event envelope preserved
- transport-aware but runtime-neutral bridge
- tests for process-to-process link delivery

## Temporary Constraint

Do not change A2A -> PM boundary semantics in this slice.

## Avoid

- broad PM rewrites
- introducing teams yet
- broad `createAgentLoop` changes
- collapsing PM-mediated slice-1 constraints into the permanent architecture

## Acceptance Criteria

- one cross-process messaging path works
- validation passes
- no architecture drift outside runtime link/bridge concerns
