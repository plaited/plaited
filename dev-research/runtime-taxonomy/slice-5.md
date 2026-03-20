# Slice 5

## Target

Add PM-governed winner selection on top of the local Attempt-DAG TeamHub.

## Scope

- `src/runtime/*`
- `src/agent/*` only if strictly required
- focused runtime and script tests only

## Required

- PM-governed winner selection over persisted team attempts
- promotion candidate selection is explicit and queryable
- selection works with Slice 4 attempt lineage and metadata
- `createLink` and BP-first coordination remain the live messaging layer

## Preserve

- PM remains authority for attempt promotion and selection decisions
- createLink + BP coordination remain the live messaging path
- Node boundary and A2A termination points untouched
- Slice 4 attempt DAG semantics remain intact

## Avoid

- inter-node exchange
- Falcon/native-model dependencies
- replacing PM authority with a free-push hub
- broad createAgentLoop rewrites

## Acceptance Criteria

- PM-governed winner selection chooses promotion candidates
- winner selection composes with local attempt DAG lineage
- validation passes
