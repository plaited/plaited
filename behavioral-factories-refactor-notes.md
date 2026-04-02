# Behavioral Factories Refactor Notes

## Purpose

This note captures the current architectural decisions before refactoring
`src/agent`, related policy surfaces, and
`dev-research/behavioral-factories/program.md`.

## Accomplished So Far

The refactor has already made several concrete architecture moves:

- `src/bootstrap` now exists as the top-level setup/install boundary
- the root `src/runtime.ts` export was removed
- the remaining `src/runtime/` directory has now been deleted
- `createLink` and its schemas/types/constants now live fully under `src/agent`
- `src/agent` now has a minimal core centered on:
  - `create-agent.ts`
  - `agent.types.ts`
  - `agent.schemas.ts`
  - `agent.constants.ts`
- `create-agent.ts` currently accepts:
  - `id`
  - `cwd`
  - `workspace`
  - required `models`
  - optional `env`
  - `factories`
  - `restrictedTriggers`
  - `heartbeat`
- `create-agent.ts` currently returns:
  - `trigger`
  - `useSnapshot`
- `create-agent.ts` now supports runtime factory installation through
  `update_factories`
- `create-agent.ts` now owns signal registration and shared signal access for
  explicit intra-agent context
- `create-agent.ts` now owns explicit core inference request handlers for:
  - `request_inference_primary`
  - `request_inference_vision`
  - `request_inference_tts`
- those inference handlers now write results to factory-provided signals using
  a uniform `{ input, output }` envelope
- `create-agent.ts` now owns signal-backed core execution capability for:
  - `read_file`
  - `write_file`
  - `delete_file`
  - `glob_files`
  - `grep`
  - `bash`
  through agent-core events scoped by agent `cwd` and `workspace`
- the signal-backed core tool handlers now also use the same `{ input, output }`
  envelope rather than ad hoc result shapes
- `src/factories` now exists as a real promotion target
- the first promoted factories are in place:
  - inference
  - gate/execute
  - simulation/evaluation
  - snapshot-context capture
- `src/skill` now exists as the module boundary for shipped skill exports
- the legacy `src/inference` boundary has been removed
- the legacy `src/hypergraph` boundary has been removed
- the legacy CRUD helper layer under `src/agent` has been removed
- `src/tools` has now been deleted entirely
- the old distillation adapter path in `src/improve` was removed because
  `dev-research/evolutionary-agent/program.md` is replacing that direction
- `src/modnet` has now been deleted entirely
- `src/agent/create-agent-loop.ts` has now been deleted
- `src/agent` has shed legacy policy and loop surfaces including:
  - goals
  - governance
  - branded factories
  - gate helper
  - simulate helper
  - evaluate helper
  - proactive helper layer
  - context assembly layer
  - file-backed snapshot writer

The main remaining refactor work is now no longer about deleting the old loop.
That phase is complete.

The main remaining work is:

- continuing to shrink `src/agent` toward the true minimal core
- replacing stale legacy docs/tests that still mention removed layers
- refining `src/bootstrap`
- installing shipped default skills from bootstrap
- promoting more top-level behavior into factories, especially:
  - A2A behavior for the top-level agent
  - durable-memory promotion
  - message/history/task intake shaping where needed

The deleted `create-node.ts` review still established an important point:

- widening `create-agent.ts` to restore old loop affordances is not the right
  move
- `useSnapshot` is sufficient to replace old subscribe-style observation
  paths because selected events and their `detail` payloads are observable
  through behavioral snapshots

So the rest of the refactor should continue by promoting the remaining loop
surfaces into factories rather than widening the new agent core.

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

- canonical authored durable memory is git-backed markdown and code
- git history is part of durable memory, not just version control
- commit messages, diffs, touched files, and lineage provide compressed and
  expandable context
- retained artifacts, snapshot envelopes, and optional later indexing should
  supply durable linking and provenance when needed

This means:

- markdown, code, and git remain the authored source of truth
- heavier indexing should stay optional and secondary to those authored
  surfaces

This should stay distinct from shared runtime context:

- runtime coordination state is transient
- intra-agent shared runtime context is now signal-based
- durable memory remains commit- and artifact-linked

Default retrieval should begin with:

- direct file reads
- markdown link traversal
- `git log`
- `git show`
- `git diff`
- targeted commit and path inspection

Any later indexing or provenance helpers should accelerate these workflows
without replacing the authored memory surfaces.

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

For autonomous operation, branches should not be part of the normal control
surface:

- repos are the independence boundary
- worktrees are the active attempt boundary
- commits are the provenance and promotion unit
- branches should not be created or managed as part of routine autonomous
  orchestration

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

This layer has been removed.

The surviving direction is now:

- `src/bootstrap` for setup/install/startup
- `src/agent` for agent-to-agent primitives and orchestration surfaces
- `src/skill` for shipped default skills and skill exports

The old PM/team hierarchical runtime modeling should not be reintroduced as a
core layer.

### `src/server`

Currently acts as the browser transport adapter:

- HTTP routes
- WebSocket upgrade and security
- browser session tracking
- replay buffer
- server-to-client event bridge

It is not the PM runtime or hierarchical coordination runtime.

Dynamic Bun route reloading via `server.reload()` is relevant for future route
provisioning.

### `src/a2a`

Should remain a protocol and transport library.

It is currently a cleaner standalone surface than the removed `modnet` layer
and should not be deleted simply because orchestration is moving into
factories.

The intended split is:

- `src/a2a` owns protocol schemas, clients, HTTP bindings, and WebSocket
  bindings
- `src/bootstrap` exposes A2A only for the top-level agent
- top-level factories own A2A behavior and Agent Card projection
- internal agents and modules must not communicate through A2A directly

This keeps A2A as a single external control point and prevents internal
factories from casually exfiltrating data outside the node.

### `src/ui`

Is not just rendering.

It is also a client-side behavioral runtime surface that can receive dynamic
behavior updates through `update_behavioral`.

### `src/agent`

Should remain a small generic agent engine with explicit extension points, not
a home for concrete policy defaults.

The main entrypoint is now:

- `src/agent/create-agent.ts`

The engine should own:

- lifecycle
- heartbeat/pulse
- handler/thread registration
- signal registration and shared explicit context surfaces
- installed model capability surfaces
- built-in local execution capability scoped by agent `cwd` and `env`
- safe execution boundaries

The engine should not own concrete:

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

### `src/skill`

Shipped default skills should live in `skills/*` and be exported through
`src/skill`.

This means:

- bootstrap should install the shipped default skills
- factories and agents should consume skill behavior through the skill system
- skill scripts should import framework surfaces through `plaited/*`
  boundaries, not repo-relative `src/` paths

## Provisioned Extension Points

The agent engine now supports explicit provisioning primarily through
factories.

Factories should control most actual behavior while keeping the engine generic.

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

- `plaited markdown --get-frontmatter`
- CLI wrappers over `bash`, `git`, `jq`, and other utilities where appropriate

The engine should know only that it can request core capabilities and write
results into explicit signals. Factories decide which built-in or CLI-backed
capabilities to target and how to interpret the results.

## Improve

`src/improve` should likely become the reusable home for:

- LLM-as-judge utilities
- meta-verification utilities
- verification contracts and findings
- structured tool-calling judge helpers
- promotion/selection helpers
- retained-artifact extraction helpers
- reusable evaluation schemas and evidence builders

This would let `scripts/` import stable evaluation utilities from
`plaited/improve` instead of re-implementing too much lane-specific logic.

Current refinement:

- raw `eval.ts` output should remain evaluation-only
- eval results should carry:
  - pass/fail
  - score
  - dimensions
  - outcome
  - timing
  - trajectory
  - capture
  - pass@k / pass^k aggregates
- eval results should not carry built-in training or distillation policy
  annotations such as `trainingAssessment`
- the old `training.ts` / `training-score` lane was removed because it pushed
  distillation policy too early into the improve surface
- retention/distillation should instead consume selected and retained outputs
  from the evolutionary lane, not shape the raw eval contract

Near-term focus should shift toward tooling that supports
`dev-research/evolutionary-agent/program.md` directly:

- package or harness mutation tooling
- rollout orchestration
- verification and self-verification tooling
- judged selection and promotion tooling
- retained artifact capture for later distillation

Current improve boundary now reflects that direction more clearly:

- `attempt-evaluation.ts`
  - judged attempt prompts
  - meta-verifier prompts
  - promotion prompt helpers
- `research-program.ts`
  - singular `program.md` loading
  - scope parsing/checking
  - stage logging
- `evolution.ts`
  - selection-signal summaries
  - promotion candidate helpers
  - retained-artifact collection

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

1. Continue reducing the remaining legacy agent surfaces that do not belong in
   the minimal core.
2. Decide which remaining `src/agent/*` files should move into
   `src/factories`, `src/agent` capability helpers, or bootstrap-owned
   composition.
3. Rebuild `src/bootstrap` on top of the reduced agent surface.
4. Then decide whether proactive and memory surfaces should be promoted next
   or regenerated by the behavioral-factories lane.

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

### Model Capabilities

Model/provider-facing adaptation can live under `src/agent` when it is part of
the installed agent capability surface.

The current direction is:

- bootstrap installs `models`
- `create-agent.ts` exposes explicit core inference request events
- factories decide when to call those capabilities, which signal receives the
  result, and how to react to the resulting `{ input, output }` envelope
- primary-model tool calls are parsed into concrete built-in tool shapes and
  then translated by factories into core trigger payloads with factory-owned
  signals
- signals and snapshots remain the shared context and observability surfaces

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
- use signals for explicit intra-agent shared context
- use snapshots as the main observability and replay-facing event surface
- treat persistence and durable indexing as outside the core agent runtime

### Server/UI Clarification

`src/server` is currently the browser transport adapter, not the PM runtime or
hierarchical coordination runtime.

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
- `cwd`
- `workspace`
- required `models`
- optional `env`
- `factories`
- `restrictedTriggers`
- `heartbeat`

`id` should be assigned by the spawning agent/runtime, not self-generated by
the child as the primary model.

This keeps identity part of orchestration and topology rather than local engine
state.

### Output

The most important returned surface is:

- `trigger`
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
- `disconnectSet`
- `signals`
- `useSnapshot`

That gives factories:

- action via triggered events
- observation via BP snapshots
- shared explicit context via signals
- ownership of signal selection for inference and tool execution
- a stable bridge from model-emitted tool intents into core handler requests

## Memory Handler Direction

`src/agent/memory-handlers.ts` should no longer be treated as an agent-core
surface.

Given the refined durable-memory direction:

- authored durable memory should remain git-backed markdown/code
- durable linking should remain secondary and reviewable
- runtime context should remain separate and transient

the existing memory-handler implementation is now a candidate for deletion.

The likely replacement path is:

- use the behavioral-factories lane to generate a durable-memory factory
- have that factory project authored memory artifacts plus explicit retained
  links or indexes
- keep memory logic out of `src/agent`

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

## Next Session

Current `src/improve` direction is now:

- `eval.ts`
  - evaluation-only output
- `judge-contracts.ts`
  - judge, verifier, self-verification, and retained-output contracts
- `attempt-evaluation.ts`
  - judged attempt, meta-verifier, and promotion prompt helpers
- `research-program.ts`
  - singular `program.md` loading, scope parsing, and stage logging
- `evolution.ts`
- selection signals, promotion helpers, and retained-artifact collection

The old `training.ts` / `training-score` lane is removed.

Recommended next focus:

1. Continue tooling for `dev-research/evolutionary-agent/program.md`
2. Review whether `scripts/autoresearch-runner.ts` should stay script-first for
   now or expose a thinner reusable improve boundary
3. Revisit `src/agent` / bootstrap only after the evolutionary tooling surface
   is stable enough to drive agent-led improvement loops
