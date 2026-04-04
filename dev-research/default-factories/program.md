# Default Factories

## Goal

Determine the default factory bundle that should ship with the Plaited agent.

This lane is the umbrella research program for default factory design. It is
not the place to exhaustively mutate one specific factory surface. Instead, it
defines the shared architectural target, integration criteria, and promotion
rules for the focused factory subprograms.

## Why This Lane Exists

The current architecture intentionally keeps `src/agent/create-agent.ts`
minimal and pushes behavior into factories.

That leaves an open research question:

- which factories should become the default installed composition of the agent?

This is an integration question, not just a collection of isolated local
optimizations. Several factory surfaces can and should be explored in parallel,
but the repo still needs one lane that decides what counts as the default
bundle.

## Relationship To Other Lanes

This lane depends on and integrates focused default-factory subprograms such as:

- `dev-research/bash-factories/program.md`
- `dev-research/skill-factories/program.md`
- `dev-research/acp-factories/program.md`
- `dev-research/a2a-factories/program.md`
- `dev-research/mcp-factories/program.md`
- `dev-research/memory-factories/program.md`
- `dev-research/search-factories/program.md`
- `dev-research/verification-factories/program.md`
- `dev-research/three-axis-factories/program.md`
- `dev-research/agent-bootstrap/program.md`
- `dev-research/agent-harness-research/program.md`
- `dev-research/node-auth-factories/program.md`
- `dev-research/module-discovery-factories/program.md`
- `dev-research/plan-factories/program.md`
- `dev-research/edit-factories/program.md`
- `dev-research/node-home-factories/program.md`
- `dev-research/node-discovery-factories/program.md`
- `dev-research/notification-factories/program.md`
- `dev-research/observability-factories/program.md`
- `dev-research/projection-factories/program.md`
- `dev-research/workflow-state-factories/program.md`
- future lanes for retrieval, planning, editing, verification, notifications,
  observability, and related default behaviors

The broader architectural direction should now be taken directly from:

- `src/agent/create-agent.ts`
- `src/agent/agent.types.ts`
- `src/agent/agent.schemas.ts`

The intended split is:

- `default-factories` decides which concrete factory bundle should become the
  shipped default agent composition
- focused subprograms hill-climb bounded factory surfaces in parallel

## Behavioral Translation Of External Agent Primitives

External agent products are useful as input evidence, but their primitives
must be translated into Plaited's factory-composed behavioral architecture
rather than copied as direct feature doctrine.

The relevant grounding from `plaited/example-agent` includes:

- metadata-bearing tool and permission surfaces in `src/Tool.ts`
- dynamic pool assembly in `src/utils/toolPool.ts`
- deferred tool discovery in `src/utils/toolSearch.ts`
- token-budget parsing in `src/utils/tokenBudget.ts`
- session event pagination in `src/assistant/sessionHistory.ts`
- structured control/event transport in `src/cli/structuredIO.ts`
- permission request callbacks in `src/bridge/bridgePermissionCallbacks.ts`
- transcript search and compaction behavior in `src/utils/transcriptSearch.ts`
- retained telemetry events in `src/utils/telemetry/events.ts`
- large bootstrap/session state seams in `src/bootstrap/state.ts`

Within Plaited, those should be expressed as behavioral-factory questions:

- metadata-first tool registry maps to module qualification, factory discovery,
  skill activation, and module-generation policy
- tiered permission systems map to auth-aware authority shaping, approval
  policy, and execution gating across node-auth, bash, and three-axis lanes
- session persistence maps to durable retained artifacts, bootstrap profile
  state, and memory recall rather than one opaque runtime singleton
- workflow state management maps to behavioral thread bundles, plan routing,
  and explicit execution-state signals
- hard token budgeting maps to bounded search, bounded context assembly, and
  bounded eval loops rather than prompt-only heuristics
- structured streaming events map to snapshots, signals, and retained runtime
  traces suitable for replay and distillation
- system event logging maps to analyzable artifact retention, observable
  handler relationships, and replayable bundle-eval traces
- two-level verification maps to local checks plus bundle-level
  meta-verification
- dynamic tool pool assembly maps to search-driven, discovery-driven, and
  auth-aware capability selection
- transcript compaction maps to memory layering and context projection policy
- permission audit trail maps to retained approval decisions, trust-state
  transitions, and verification artifacts
- constrained agent types map to sharply bounded factory families such as
  planning, editing, verification, and routing

The umbrella program should use those translations to decide whether a
behavior belongs in:

- an existing focused lane
- a missing focused lane that should be created
- bundle-level composition logic only

It should not treat a foreign product primitive as sufficient architectural
justification on its own.

## Inputs

The current architectural source of truth is:

- `src/agent/create-agent.ts`
- `src/agent/agent.types.ts`
- `src/agent/agent.schemas.ts`

Reference skills:

- `skills/behavioral-core`
- `skills/code-documentation`
- `skills/code-patterns`
- `skills/modnet-factories`
- `skills/node-auth`

Utility skills:

- `skills/typescript-lsp` for type-aware analysis of TypeScript surfaces

Current heartbeat note:

- `src/agent/create-agent.ts` owns only timer setup and emission of
  `AGENT_CORE_EVENTS.heartbeat`
- heartbeat is substrate, not policy
- default-factory work should decide which installed factories listen to
  heartbeat, what they poll, how they diff state, and whether they notify,
  infer, or stay idle

## Core Hypothesis

The best default factory bundle will not be discovered by designing the entire
agent composition as one monolithic lane.

Instead:

- bounded factory surfaces should be explored in parallel
- each surface should produce candidate factories, evals, and retained evidence
- this umbrella lane should periodically compose the current best candidates
- promotion should happen at the bundle level, not only at the local-factory
  level

## Program Structure

This lane should treat default-factory research as a two-level system.

### 1. Focused Subprograms

Each focused lane should research one bounded surface, for example:

- local execution
- search and retrieval orchestration
- retrieval
- planning
- editing
- validation
- memory
- three-axis control
- deployment bootstrap
- notification and projection
- observability and artifact handling

Near-term lanes that now look concrete are:

- `plan-factories`
- `edit-factories`
- `node-home-factories`
- `node-discovery-factories`
- `notification-factories`
- `observability-factories`
- `projection-factories`
- `workflow-state-factories`

Additional lane candidates implied by the current architecture and the
`plaited/example-agent` surfaces are:

- `session-persistence-factories` for durable session state, replay, and
  restart semantics beyond bootstrap scaffolding alone
- `tool-registry-factories` if module-discovery plus skill-factories proves
  too broad to cleanly own metadata-first tool qualification and pool assembly
- `permission-audit-factories` if retained approval history, review, and
  justification replay becomes large enough to deserve a standalone bundle

These are not product-feature clones. They are candidate behavioral-factory
families that should be created only if the existing lanes cannot own the
translated behavior cleanly.

Each subprogram should be narrow enough to support parallel mutation and judged
comparison across many independent attempts.

### 2. Integration and Promotion

This umbrella lane should:

- define bundle-level evals
- track dependency edges between subprograms
- evaluate compatibility between locally winning factory candidates
- choose what becomes the default shipped bundle

## Parallelism Model

This lane assumes a parallel fanout workflow, including worktree-backed or
equally durable multi-attempt research and agent-swarm coordination such as an
`agenthub`-style message-board plus shared git DAG model.

That means:

- subprograms should be designed so different agents can work on them in
  parallel
- retained artifacts should be explicit and durable
- local winners should be easy to fetch, inspect, compare, and recombine
- integration runs should be separate from local mutation runs

## Independence Classes

This lane should classify default-factory surfaces by coupling strength.

### Mostly Independent

Surfaces that can usually be hill-climbed in parallel first:

- `bash` / local execution
- notifications
- progress and artifact observability
- narrow projection or reporting helpers

### Moderately Coupled

Surfaces that can be explored separately but must be integrated early:

- retrieval
- planning
- editing
- validation
- three-axis control
- deployment bootstrap
- session persistence
- observability and artifact handling

### Tightly Coupled

Surfaces where the main value emerges at bundle level:

- memory + planning
- retrieval + validation
- editing + planning
- three-axis control + execution routing
- three-axis control + MCP/A2A exposure
- deployment bootstrap + infrastructure target validation
- verification + execution routing
- verification + module-discovery correctness
- verification + MSS boundary correctness
- node-auth + approval policy + audit retention
- session persistence + memory recall + restart behavior
- observability + verification + distillation readiness
- planning + execution routing
- final default-factory stack composition

This classification should guide fanout scheduling and integration cadence.

## Evaluation Model

This lane should judge both local and bundle-level quality.

### Local Success Is Not Enough

A subprogram can produce a strong local candidate that still should not become
part of the default bundle if it:

- increases architectural complexity too much
- depends on assumptions that other default factories reject
- creates an overly confusing operator surface for the model
- improves one local metric while harming the overall default agent

### Bundle-Level Criteria

A default factory bundle should be judged on:

- architectural clarity
- compatibility with the minimal core
- quality of composition across factories
- observability and reviewability
- default-task performance
- recovery behavior
- ease of correct usage by the model

## Promotion Rules

Nothing should become the default shipped bundle merely because it won one
subprogram.

A promotable default bundle must:

- preserve the minimal `create-agent` direction
- compose through the existing factory contract
- outperform simpler alternatives on judged bundle-level tasks
- remain understandable enough for the default model to use reliably
- preserve a clear engine-versus-policy split

## Outputs

This lane should produce:

- a map of focused default-factory subprograms
- bundle-level evals and rubrics
- integration notes on factory compatibility
- retained recommended default-factory bundles
- an explicit recommendation for what should be shipped by default

## Negative Goal

This lane should not collapse all default-factory research back into one giant
mutation surface.

It should also not let focused subprograms drift into isolated local
optimization with no integration authority.

The point of this lane is to hold both truths at once:

- factory research should be parallelizable
- shipped defaults must still be chosen as a coherent bundle
