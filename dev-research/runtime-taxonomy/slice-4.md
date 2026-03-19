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
- PM-governed winner selection
- `createLink` and BP-first coordination remain the live messaging layer
- `.memory/teams/<team-id>/` or equivalent local attempt metadata shape

## Avoid

- inter-node exchange
- Falcon/native-model dependencies
- replacing PM authority with a free-push hub
- broad createAgentLoop rewrites
