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
- `dev-research/a2a-factories/program.md`
- `dev-research/mcp-factories/program.md`
- `dev-research/memory-factories/program.md`
- `dev-research/three-axis-factories/program.md`
- `dev-research/agent-bootstrap/program.md`
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

## Inputs

The current architectural source of truth is:

- `src/agent/create-agent.ts`
- `src/agent/agent.types.ts`
- `src/agent/agent.schemas.ts`

Reference skills:

- `skills/behavioral-core`
- `skills/code-documentation`
- `skills/code-patterns`
- `skills/agent-loop`
- `skills/mss`
- `skills/node-auth`
- `skills/modnet-node`
- `skills/constitution`
- `skills/proactive-node`

Utility skills:

- `skills/typescript-lsp` for type-aware analysis of TypeScript surfaces

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
- retrieval
- planning
- editing
- validation
- memory
- three-axis control
- deployment bootstrap
- notification and projection
- observability and artifact handling

Near-term missing lanes that now look concrete are:

- `plan-factory`
- `edit-factory`
- `verification-factory`
- `three-axis-factory`
- `agent-bootstrap`

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

### Tightly Coupled

Surfaces where the main value emerges at bundle level:

- memory + planning
- retrieval + validation
- editing + planning
- three-axis control + execution routing
- three-axis control + MCP/A2A exposure
- deployment bootstrap + infrastructure target validation
- verification + execution routing
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
