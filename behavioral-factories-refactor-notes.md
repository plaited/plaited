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

### `src/factories`

Shipped default behavior should live in `src/factories`, not in a separate
policy directory.

This is the right home for accepted executable:

- governance factories
- working-memory factories
- durable-memory factories
- rollout factories
- validation factories
- proactive factories

## Provisioned Extension Points

The new agent engine should support explicit provisioning primarily through
factories.

Factories should control most actual loop behavior while keeping the engine
generic.

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
results. Factories decide which CLI-backed or built-in capabilities to target.

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

## Additional Decisions

### `src/agent` Rewrite Direction

`src/agent` should likely shrink to:

- `create-agent.ts`
- `agent.types.ts`
- `agent.schemas.ts`
- `agent.constants.ts` only if the remaining constants are truly generic

Most current `src/agent/*` files are better treated as policy or factory
behavior, not core engine:

- `evaluate.ts`
- `executor.ts`
- `governance.ts`
- `gate.ts`
- `factories.ts`
- `memory-handlers.ts`
- `goals.ts`
- `snapshot-writer.ts`
- `simulate.ts`
- `proactive.ts`

The concepts are still needed, but they should not remain as hardcoded agent
defaults in the core engine.

### `src/factories`

Promoted executable behavior should land in `src/factories`.

This should become the primary home for accepted:

- policy factories
- working-memory factories
- durable-memory factories
- rollout factories
- validation factories
- governance factories
- proactive factories

Successful experiments should clean up or replace older hardcoded paths in
`src/agent` and promote real factory implementations into `src/factories`.

### `src/inference`

Model/provider-facing code should move into `src/inference`.

At minimum this includes:

- `src/agent/openai-compat.ts`

`src/inference` should hold transport/adaptation code for model interfaces
rather than keeping that logic embedded in `src/agent`.

### Factory Identity

Do not use emoji branding or internal symbol branding for factory identity.

Use string literal kinds that are easy to inspect, serialize, extend, and
generate.

The contract should remain open to future agent evolution and user-created
factories.

### Modules

Do not ship a default stateful module just to test the module system.

Modules own memory, so a better path is likely:

- `createMcpModule`
- install/provision flows
- runtime/module coordination through provisioned module surfaces

Module-specific policies should likely live alongside their modules.

### Heartbeat

Heartbeat should remain part of the core engine.

It should exist even if no policy currently listens to it.
Policies may later attach proactive or maintenance behavior, and heartbeat
timing may also be adjusted through explicit behavioral control surfaces.

### Runtime Tooling and Shared Context

Factories should continue to act through behavioral events and installed
handlers.

That means:

- tool execution should remain behavioral
- factories should not get direct helper callbacks like `read`, `write`, or
  `now`
- the engine should provision handlers that execute these operations

For shared runtime context, the preferred direction is:

- no direct `ctx` object passed into factories
- no ad hoc shared `Map`/`Set`/counter approach as the main shared-context
  model
- use dedicated behavioral events and handlers for shared runtime context

### Runtime SQLite Direction

Shared runtime context should likely be backed by in-memory SQLite owned by the
engine, not by direct factory-owned state.

`create-agent.ts` should install default handlers for runtime SQLite operations.

Factories still only get `trigger`.
They request context work behaviorally, and handlers perform it.

This preserves BP observability through:

- trigger
- bThreads
- handlers
- useSnapshot

#### Important correction

Factories should not be constrained to manage prepared statement ids manually.

Requiring:

- prepare statement
- receive statement id
- reuse statement id in later threads/handlers

would be too rigid for generated behavior.

Instead, factories should be allowed to pass SQL and params directly in their
behavioral events, while engine-owned handlers:

- prepare/cache statements internally
- execute them via Bun SQLite
- emit result events back with correlation ids

#### Preferred SQLite operation model

Mirror Bun's actual statement execution model instead of inventing a generic
CRUD abstraction.

Useful operations are closer to:

- `run`
- `get`
- `all`
- `values`
- maybe later `iterate`
- maybe later `toString`
- maybe later `finalize`

The initial event model should therefore be statement-oriented, not CRUD-style.

#### Engine-owned lifecycle

The engine should own:

- opening the in-memory database
- statement caching
- cleanup/finalization on teardown or disconnect
- DB configuration such as WAL/file controls when appropriate

Factories should not own DB lifecycle directly.

### Server/UI Clarification

`src/server` is currently the browser transport adapter, not the PM runtime or
sub-agent runtime.

`src/ui/protocol/controller.ts` already demonstrates a strong provisioning
pattern:

- server sends `update_behavioral`
- client imports an ES module dynamically
- module returns `threads` and `handlers`
- client installs them into its local behavioral runtime

This proves that executable TypeScript factories are already a real runtime
artifact pattern in Plaited.

## `create-agent` Shape

The current intended `create-agent.ts` contract is small.

### Input

- `id`
- `factories`
- `restrictedTriggers`
- `heartbeat`

`id` should be assigned by the spawning agent/runtime, not self-generated by
the child as the primary model.

This keeps identity part of orchestration and topology rather than local engine
state.

### Output

The most important returned surface is:

- `restrictedTrigger`
- `useSnapshot`

`disconnect` should be modeled as an event rather than an imperative returned
method.

The engine may also expose snapshot observation in a BP-native way, but should
not fall back to a generic pub/sub mental model.

## Factory Install Context

Factories should not receive:

- direct helper callbacks like `read`, `write`, or `now`
- a direct shared `ctx` object

Factories should continue to act through behavioral mechanisms.

The current preferred install context is:

- `trigger`
- `useSnapshot`

That gives factories:

- action via triggered events
- observation via BP snapshots

This matches the existing `update_behavioral` pattern in the UI controller more
closely than an object-oriented callback or context API.

## Shared Runtime Context

Shared runtime context should not be passed directly into factories.

Instead:

- factories request shared-runtime operations through triggered events
- `create-agent.ts` installs the default handlers
- handlers use in-memory SQLite internally

Writes should emit completion events.
Reads should emit result events.

This keeps shared runtime context inside the BP idiom:

- request via event
- handler performs work
- completion/result event is selected
- threads can `waitFor` that completion/result

## Identity and Registration

Spawners should assign agent ids.

`create-agent.ts` should accept that id rather than inventing one as the main
orchestration path.

Runtime registration and discoverability should then use those spawner-assigned
ids.

`create-link` is about transport and routing, not identity generation.

## Runtime Error Forwarding

Runtime and link/team errors should not stay as console-only local concerns.

The preferred direction is:

- emit structured error events upward
- let the initial/top-level PM agent observe and react to them
- allow factories on the PM side to log, persist, summarize, or escalate them

This should use the same behavioral event model rather than hidden side
channels.

## Runtime SQLite Event Direction

The current preferred runtime SQLite protocol is the "statement surface +
lifecycle" variant.

This should be modeled with behavioral request/result events close to Bun's
statement API, not a fake CRUD abstraction.

Preferred operations:

- `run`
- `get`
- `all`
- `values`
- `iterate`
- `finalize`

Result/error events should exist for these operations, with request correlation
ids so threads can `waitFor` completion or result events.

The engine should own:

- in-memory database creation
- statement caching
- cleanup/finalization on teardown or disconnect

Factories should only request these operations through events.

## `src/runtime` Review Outcome

The current `src/runtime` split should be:

### Keep in `src/runtime`

Substrate-like primitives:

- `create-link.ts`
- core team/link primitives from `create-team.ts`
- generic participant/link/team types from `runtime.types.ts`

These fit the target direction:

- transport-neutral
- participant/event coordination
- low policy coupling

### Move out of `src/runtime`

Domain or policy-shaped behavior:

- MSS/domain taxonomy and object modeling from `runtime.constants.ts`
- MSS/domain schemas from `runtime.schemas.ts`
- promotion/frontier/winner-selection logic from `team-hub.ts`
- `createManagedTeamRuntime()` from `create-team.ts`

These are better treated as:

- factory behavior
- rollout behavior
- orchestration defaults
- domain modeling

They should not remain part of the generic runtime substrate.

### Runtime target after trim

`src/runtime` should focus on:

- participants
- links
- teams
- routing
- lifecycle
- observable error forwarding

and avoid:

- MSS/domain ontology
- promotion logic
- managed topology defaults

## Immediate Next Refactor Steps

1. Trim `src/runtime` first:
   - retain substrate
   - move/remove policy and domain coupling
2. Then rewrite `src/agent` around:
   - `create-agent.ts`
   - `agent.types.ts`
   - `agent.schemas.ts`
   - `agent.constants.ts` only if still generic
3. Then let factories progressively replace the old hardcoded behavior.
