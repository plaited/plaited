# Workflow State Factories

## Goal

Research a factory family that captures team-like orchestration inside one
Plaited agent runtime without spawning subagents as the primary abstraction.

This lane should define how the agent:

- installs multiple role-specialized factory layers inside one sovereign node
- coordinates them through behavioral threads, signals, and snapshots
- supports both startup-installed defaults and runtime-installed dynamic
  overlays through `AGENT_CORE_EVENTS.update_factories`
- achieves non-linear planning, editing, verification, and repair without
  process-level teammate orchestration

The target is not "multi-agent but hidden." The target is a first-class
in-process orchestration model built from factories.

## Why This Lane Exists

The repo already has the core execution seam needed for this direction:

- `src/agent/create-agent.ts` installs a `factories` array at init time
- `src/agent/create-agent.ts` also supports runtime module installation through
  `AGENT_CORE_EVENTS.update_factories`
- `src/agent/agent.schemas.ts` keeps the runtime loading contract concrete:
  `default: Factory[]`
- `skills/behavioral-core/SKILL.md` defines the coordination substrate through
  `bThread`, `bSync`, signals, snapshots, blocking, and interrupts

That means the repo already supports two distinct installation moments:

- static default programs loaded into `createAgent(...)` at startup
- dynamic default programs loaded later one or more times by
  `update_factories`

What remains open is the orchestration policy:

- when a role should be a startup-installed factory versus a runtime overlay
- how role boundaries should be represented inside one event space
- how repeated installs should stay namespaced and reviewable
- when a factory family should behave like a transient "teammate" without
  becoming a separate agent runtime

This lane exists because that question is larger than planning alone and
larger than projection alone.

## External Grounding To Translate, Not Copy

`plaited/example-agent` expresses team and tool coordination through:

- `src/tools/TeamCreateTool/TeamCreateTool.ts`
- `src/utils/swarm/inProcessRunner.ts`
- `src/utils/swarm/teamHelpers.ts`
- `src/Tool.ts`
- `src/utils/toolPool.ts`

Those surfaces are useful comparison points, but Plaited should translate them
through the factory model instead of copying teammate spawning.

The relevant translation is:

- team creation maps to installation of namespaced role bundles
- in-process teammate runners map to in-process behavioral overlays
- team files map to retained workflow-state artifacts and signal-backed role
  registries
- tool pools map to capability selection and projection policy owned by
  factories

## Relationship To Other Lanes

This lane sits under:

- `dev-research/default-factories/program.md`

It should integrate with:

- `dev-research/plan-factories/program.md`
- `dev-research/edit-factories/program.md`
- `dev-research/verification-factories/program.md`
- `dev-research/projection-factories/program.md`
- `dev-research/observability-factories/program.md`
- `dev-research/module-discovery-factories/program.md`

The intended split is:

- `workflow-state-factories` owns team-like in-process orchestration patterns
- `plan-factories` owns decomposition and plan-state policy
- `edit-factories` owns concrete change execution policy
- `verification-factories` owns checks, blocking, and repair routing
- `module-discovery-factories` owns how runtime factory modules are found and
  loaded

## Dependency Order

1. `src/agent/create-agent.ts` defines init-time and runtime factory
   installation
2. `src/agent/agent.types.ts` defines the factory contract
3. `src/agent/agent.schemas.ts` defines the `default: Factory[]` module shape
4. `skills/behavioral-core/SKILL.md` defines the event coordination substrate
5. `dev-research/default-factories/program.md` defines the bundle question
6. this lane hill-climbs workflow-state orchestration candidates and feeds the
   winners back into the default-factories umbrella

## Core Hypothesis

Many behaviors that look like "multi-agent collaboration" can be captured more
cheaply and more coherently as multiple factories sharing one event space.

The architectural shift is:

- process-level isolation becomes logical isolation
- teammate handoff becomes event selection, blocking, and projection
- copied context becomes shared signals plus selective projection
- subagent lifecycle becomes factory install, activation, interruption, and
  teardown policy

## Product Target

The first shipped workflow-state factory bundle should support:

1. multiple specialized roles inside one runtime, for example:
   - planner
   - editor
   - verifier
   - projection or reporting helper
2. explicit role state and role boundaries
3. non-linear coordination among those roles through BP rules
4. runtime installation of additional role bundles when task conditions demand
   it
5. retained evidence explaining which roles were active and why
6. no requirement to spawn separate teammate processes for ordinary
   coding-task orchestration

## Three Variant Patterns

This lane should evaluate at least three concrete variants.

### 1. Static Sovereign Bundle

All primary roles install at `createAgent(...)` time as part of the shipped
default bundle.

Pattern:

- planner, editor, verifier, and projector factories are installed once at
  startup
- roles stay logically isolated through namespaced signals and bThreads
- all coordination happens inside one stable event graph

Best fit:

- stable default coding profile
- predictable operator surface
- low runtime loading complexity

Tradeoff:

- every role bundle is present even when some are idle
- bundle complexity grows if too many conditional behaviors are shipped static

### 2. Phase-Loaded Dynamic Overlay

A small static kernel ships at startup, then phase-specific factory modules are
loaded later through `AGENT_CORE_EVENTS.update_factories`.

Pattern:

- startup bundle installs only the minimal kernel:
  planning gate, shared state, verification hooks, projection substrate
- entering a phase such as editing, verification, or recovery loads an
  additional factory module
- overlays remain task- or phase-scoped rather than permanently resident

Best fit:

- keeping the base bundle small
- introducing richer behaviors only when needed
- explicit task-phase transitions

Tradeoff:

- phase transition policy becomes critical
- repeated loading needs clean idempotence or teardown conventions

### 3. Repeatable Namespaced Role Overlays

Factories are loaded dynamically one or more times, with each install creating
an isolated role instance inside the shared runtime.

Pattern:

- `update_factories` installs the same module multiple times with different
  namespaced signals or generated module exports
- one task may activate multiple concurrent review or search overlays
- overlays behave like ephemeral in-process "teammates" without separate
  runtimes

Best fit:

- bounded fanout inside one sovereign node
- task-specific compare-and-select workflows
- repeated local verification, search, or repair passes

Tradeoff:

- requires disciplined namespacing and artifact retention
- risks recreating multi-agent confusion if role identity is not explicit

## Evaluation Questions

Candidate workflow-state bundles should be judged on:

- does the design preserve the minimal `create-agent` core?
- is the difference between static and dynamic factory installation explicit?
- can repeated `update_factories` installs remain understandable and safe?
- do role boundaries stay legible without separate processes?
- does the resulting orchestration improve context quality and verification
  behavior?
- does it avoid accidental drift back toward hidden multi-agent architecture?

## Research Questions

This lane should answer:

- which roles belong in the static startup bundle?
- which roles should be loaded dynamically by default?
- what namespacing convention should repeated role installs use?
- how should a runtime-installed overlay declare activation and completion?
- what artifact trail is sufficient to inspect which role bundles ran?
- when is process-level isolation still justified instead of factory
  composition?

## Candidate Artifacts

This lane should preserve evidence such as:

- startup bundle manifests
- runtime overlay install records
- namespaced signal maps
- snapshots showing role-request, role-block, and role-interrupt patterns
- judged comparisons between static and dynamic bundle variants

## Deliverables

This lane should produce:

- candidate workflow-state factory bundles
- explicit comparison of the three orchestration variants
- eval tasks for in-process role coordination and repeated overlay installs
- retained traces for role activation, blocking, and completion
- a recommendation for which variant should become the default orchestration
  pattern
