# Node Home Factories

## Goal

Research the default factory bundle for node-home persistence and promotion.

This lane should define how the agent:

- persists generated files and other durable workspace artifacts
- persists real Git state and related repo metadata
- decides when and how durable state changes happen
- exports, imports, and hands off a node home between hosts
- recovers durable state after restart, migration failure, or host change

The point is not to hard-code one storage substrate into the core. The point is
to make node-home persistence a well-scoped factory family that composes with
editing, memory, bootstrap, and execution.

## Why This Lane Exists

The repo now has a clearer infrastructure split:

- Web/UI protocol lives in [src/ui/](../../src/ui) and [src/server/](../../src/server)
- execution can live in a sandbox such as Boxer/WasmBox
- discovery and transport can be handled separately through modnet surfaces

What remains open is the durable node-home policy layer:

- when file and Git mutations become durable
- how those mutations are checkpointed or bundled
- how a node home moves from phone to server without losing state
- how restart and recovery semantics stay reviewable

Without this lane, persistence risks becoming an accidental side effect of file
tools or a storage backend choice instead of an explicit behavioral surface.

## Relationship To Other Lanes

This lane sits under:

- [dev-research/default-factories/program.md](../default-factories/program.md)

It should integrate with:

- [dev-research/edit-factories/program.md](../edit-factories/program.md)
- [dev-research/memory-factories/program.md](../memory-factories/program.md)
- [dev-research/agent-bootstrap/program.md](../agent-bootstrap/program.md)
- [dev-research/bash-factories/program.md](../bash-factories/program.md)
- [dev-research/observability-factories/program.md](../observability-factories/program.md)
- [dev-research/workflow-state-factories/program.md](../workflow-state-factories/program.md)

The intended split is:

- `node-home-factories` owns persistence policy and promotion semantics
- `edit-factories` owns concrete write and edit strategy
- `memory-factories` owns durable recall and summarized memory policy
- `agent-bootstrap` owns operator-facing scaffold generation
- backend adapters own how the node home is stored or mounted

## Dependency Order

1. [docs/INFRASTRUCTURE.md](../../docs/INFRASTRUCTURE.md) defines the node-home direction
2. [src/agent/create-agent.ts](../../src/agent/create-agent.ts) defines the minimal core boundary
3. [src/agent/agent.types.ts](../../src/agent/agent.types.ts) defines the factory contract
4. [dev-research/default-factories/program.md](../default-factories/program.md) defines the umbrella bundle
   question
5. adjacent lanes provide edit, memory, bootstrap, observability, and workflow
   constraints
6. this lane hill-climbs the persistence and promotion slice and feeds winners
   back into the default-factories umbrella

## Core Hypothesis

The best default persistence story will not come from one opaque storage
backend.

Instead, the system should separate:

- backend adapters
  - how the node home is physically stored or mounted
- persistence factory behavior
  - when and how durable state changes happen
- promotion factory behavior
  - export/import/handoff semantics

That separation keeps the storage substrate replaceable while making durability
and migration policy explicit and observable.

## Product Target

The first shipped node-home factory bundle should support:

1. projecting a durable node-home contract into the runtime
2. persisting generated files and real Git state credibly
3. deciding when writes are staged, checkpointed, committed, or bundled
4. retaining reviewable evidence of durable state transitions
5. exporting and importing a node home between phone, local machine, and server
6. handing off execution without losing durable state or identity continuity
7. recovering cleanly from interrupted writes, failed handoff, or restart

## Required Architectural Properties

### 1. Persistence Is Policy, Not Just Storage

This lane should own policy for:

- write durability boundaries
- checkpoint timing
- Git persistence and bundle timing
- export/import behavior
- restart and repair behavior

### 2. Promotion Must Be First-Class

Phone-to-server continuity is part of the design target, not an afterthought.

This lane should make promotion behavior explicit:

- what gets exported
- what remains local-only
- when a handoff is considered complete
- how a failed handoff is rolled back or retried

### 3. Durable State Must Stay Reviewable

The system should make it clear:

- what durable artifacts changed
- what Git state changed
- what checkpoint or bundle was produced
- what host currently owns active execution

### 4. Storage Backends Must Stay Replaceable

Do not tie the policy layer to one storage answer too early.

Candidate backends may include:

- native filesystem plus SQLite metadata
- AgentFS
- another portable workspace substrate

## Research Questions

This lane should answer:

- what is the minimal `NodeHome` contract?
- how should files, Git state, metadata, and keys be separated?
- when should durable edits be checkpointed versus committed versus bundled?
- what export/import format best supports phone-to-server promotion?
- how should recovery work after interrupted migration or partial durable
  writes?
- can AgentFS satisfy the required Git and mobility semantics, or is a simpler
  filesystem-first home more credible?

## Deliverables

This lane should produce:

- a concrete `NodeHome` contract
- candidate persistence and promotion factory bundles
- evaluation tasks for durable write, restart, export/import, and handoff flows
- a recommendation for the default persistence-policy bundle
