# Slice 4

## Target

Introduce a local Attempt-DAG TeamHub for a single sovereign node.

## Scope

- `src/runtime/*`
- `src/agent/*` only if strictly required
- focused runtime and script tests only

## Required

- local attempt graph over worktrees/commits
- frontier/leaves/lineage concepts for team attempts
- `createLink` and BP-first coordination remain the live messaging layer
- `.memory/teams/<team-id>/` or equivalent local attempt metadata shape

## Avoid

- inter-node exchange
- Falcon/native-model dependencies
- replacing PM authority with a free-push hub
- broad createAgentLoop rewrites

## Preserve

- PM remains authority for attempt promotion/lineage decisions
- createLink + BP coordination remain the live messaging path
- Node boundary and A2A termination points untouched
- Actor/sub-agent/team types from Slice 3 remain usable

## Acceptance Criteria

- attempt DAG is locally queryable (frontier/leaves/lineage)
- team attempts can be persisted and restored
- validation passes
