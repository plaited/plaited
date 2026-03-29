# Behavioral Factories Refactor Notes

## Purpose

This note captures the current architectural decisions before refactoring
`src/agent`, `src/runtime`, related policy surfaces, and
`dev-research/behavioral-factories/program.md`.

## Stable Foundations

The refactor assumes these remain foundational:

- `src/behavioral`
- `src/ui`
- most of `src/server`

The UI side already proves an important factory pattern:

- the server can send `update_behavioral`
- the client imports a new ES module dynamically
- the module provisions new `threads` and `handlers`
- the client behavioral runtime installs them at runtime

That means executable TypeScript factories are already real runtime artifacts,
not just an abstract research concept.

## Memory Model

The current preferred memory model is:

- canonical memory is git-backed markdown and code
- git history is part of memory, not just version control
- commit messages, diffs, touched files, and lineage provide compressed and
  expandable context
- hypergraph artifacts are optional derived accelerators for retrieval,
  provenance, and stable symbolic anchors

Default retrieval should begin with:

- direct file reads
- markdown link traversal
- `git log`
- `git show`
- `git diff`
- targeted commit and path inspection

Hypergraph and similar semantic tooling should accelerate these workflows, not
replace them as the authored source of truth.

## Repo Model

The intended deployment model is:

- the personal agent operates inside a workspace that is itself a git repo
- `modules/*` may be separate git repos, ignored by the outer repo
- both the workspace repo and module repos may use worktrees for active
  exploration
- OS-level backups provide catastrophic recovery outside Plaited runtime

This means the same worktree/commit/frontier model should apply:

- in the main workspace repo
- in repo-scoped modules under `modules/*`

## Engine vs Policy

The current direction is to separate generic engines from provisioned
behavior.

### `src/behavioral`

Should remain the stable BP engine and coordination substrate:

- `bThread`
- `bSync`
- trigger/snapshot/feedback mechanics

It should not know agent-specific policy.

### `src/runtime`

Should own generic participant/event coordination, not concrete policy:

- actor identity and lifecycle
- team/link/hub mechanics
- participant/event routing
- PM/orchestrator communication substrate

It should not own:

- governance policy
- memory policy
- retrieval policy
- concrete agent loop logic

### `src/server`

Currently acts as the browser transport adapter:

- HTTP routes
- WebSocket upgrade and security
- browser session tracking
- replay buffer
- server-to-client event bridge

It is not the PM runtime or sub-agent runtime.

Dynamic Bun route reloading via `server.reload()` is relevant for future route
provisioning.

### `src/ui`

Is not just rendering.

It is also a client-side behavioral runtime surface that can receive dynamic
behavior updates through `update_behavioral`.

### `src/agent`

Should become a generic agent loop engine with explicit extension points, not a
home for concrete policy defaults.

The likely main entrypoint should become:

- `src/agent/create-agent.ts`

The loop engine should own:

- lifecycle
- heartbeat/pulse
- handler/thread registration
- tool execution interface
- safe execution boundaries

The loop engine should not own concrete:

- governance defaults
- memory policy
- retrieval policy
- rollout policy
- validation policy

### `src/policies`

We should likely add `src/policies` for shipped default policies and factory
packs.

This is the right home for default:

- governance behavior
- working-memory behavior
- durable-memory behavior
- rollout behavior
- validation behavior
- proactive behavior

## Provisioned Extension Points

The new agent engine should support explicit provisioning for:

- tool execution
- working-memory assembly
- durable-memory projection
- validation
- governance checks
- rollout decisions
- proactive sensing/behavior

These extension points are intended to let policies/factories control most
actual loop behavior while keeping the engine generic.

## Heartbeat

Heartbeat should remain part of the core agent engine.

Reasoning:

- it is cheap
- it gives the loop a stable temporal pulse
- if nothing listens, nothing happens
- policies can attach proactive or maintenance behavior later
- policies may also control heartbeat timing via trigger/handler surfaces

`src/agent/proactive.ts` likely mixes timer infrastructure with proactive
policy in a way that should be split apart.

## Tooling Model

We do not currently want `git` or similar CLIs hardcoded as loop-native tools.

Instead:

- tool logic should live as reusable library capabilities
- many tools should be exposed through `plaited ...` CLI surfaces
- policies should mediate which CLI-backed tools are used and when

Examples:

- `plaited typescript-lsp`
- `plaited markdown --get-frontmatter`
- CLI wrappers over `bash`, `git`, `jq`, and other utilities where appropriate

`src/tools/crud.ts` is a likely default low-level capability surface because it
is general and substrate-like.

The engine should know only that it can request tool execution and receive tool
results. Policies decide which tools to target.

## Improve

`src/improve` should likely become the reusable home for:

- LLM-as-judge utilities
- meta-verification utilities
- structured tool-calling judge helpers
- promotion/selection helpers
- reusable evaluation schemas and evidence builders

This would let `scripts/` import stable evaluation utilities from
`plaited/improve` instead of re-implementing too much lane-specific logic.

## Behavioral Factories Program Decisions

The current `behavioral-factories` direction is:

- executable TypeScript factories are preferred for real runtime surfaces
- non-TypeScript artifacts are supportive:
  - retrieval
  - provenance
  - retained artifacts
  - schema description

The five refined factory families are:

### Policy Factories

These are deterministic tool/memory orchestration policies triggered by
reasoning-derived signals. They are not attempts to encode the model's
reasoning itself.

### Working-Memory Factories

These build bounded context packs for the next step or handoff.

### Durable-Memory Factories

These update retained memory after accepted work or commits.

Commits are durable event boundaries, not automatically the summary itself.
The factory gathers bounded source context, and the model may draft the summary
inside a deterministic contract.

### Rollout Factories

These are worktree-first, not branch-first.

They should:

- use worktrees for exploration
- use commits as durable checkpoints
- use frontier/leaf concepts for orchestration and replay
- avoid making branch management central

### Validation Factories

These act as deterministic gates across:

- code correctness
- context correctness
- handoff correctness
- commit/replay correctness

Important signals include:

- `bun --bun tsc --noEmit`
- Biome
- BP anti-pattern checks
- LSP seam checks
- TSDoc requirements
- tests
- commit and replay target validation

Commit hooks may also become event sources instead of relying only on generic
`lint-staged` behavior.

## Current Next Steps

1. Update `dev-research/behavioral-factories/program.md` to reflect the final
   engine vs policy and lifecycle decisions.
2. Sketch the `src/agent` refactor plan before editing code.
3. Then begin reshaping `src/agent`, `src/runtime`, and `src/policies` around
   these boundaries.
