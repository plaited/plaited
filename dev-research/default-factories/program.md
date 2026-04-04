# Default Factories

## Goal

Determine the default factory composition for the Plaited agent.

This lane is the umbrella research program for factory-era agent behavior. It
does not exist to mutate one narrow factory surface in isolation. It exists to
decide:

- which factory families belong in the default agent bundle
- which of those factories must be present at `createAgent()` initialization
- which should be discovered, selected, or generated later and installed
  through `AGENT_EVENTS.update_factories`
- how the shipped default composition should balance minimal core, reviewable
  policy, and dynamic extensibility

## Why This Lane Exists

The current architecture intentionally keeps
`src/agent/create-agent.ts` minimal.

The core now owns only a small runtime substrate:

- behavioral engine setup
- restricted trigger boundary
- signal installation
- heartbeat emission
- built-in file, grep, bash, and inference handlers
- installation of factory functions passed in at initialization
- installation of additional factory modules loaded later through
  `AGENT_EVENTS.update_factories`

That means the main default-factory question is no longer:

- "what giant built-in agent should exist?"

It is:

- "what factory composition should ship as the default agent policy layer?"

## Source Of Truth

The current architectural source of truth is:

- `src/agent/create-agent.ts`
- `src/agent/agent.types.ts`
- `src/agent/agent.schemas.ts`
- `src/agent/tests/create-agent.spec.ts`

The most important current runtime facts are:

- `CreateAgentOptions` accepts `factories?: Factory[]`
- `createAgent()` installs those factories immediately during initialization
- shipped default factories may be installed through that initial
  `factories` array
- `AGENT_EVENTS.update_factories` is the runtime module-loading path for
  additional factory bundles
- `UpdateFactoryModuleSchema` requires a dynamically loaded module to export:

```typescript
{
  default: Factory[]
}
```

This split is real and should be treated as first-class in factory research.

## Relationship To Other Lanes

This lane depends on and integrates focused subprograms such as:

- `dev-research/skill-factories/program.md`
- `dev-research/bash-factories/program.md`
- `dev-research/acp-factories/program.md`
- `dev-research/a2a-factories/program.md`
- `dev-research/mcp-factories/program.md`
- `dev-research/memory-factories/program.md`
- `dev-research/search-factories/program.md`
- `dev-research/verification-factories/program.md`
- `dev-research/three-axis-factories/program.md`
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
- `dev-research/session-persistence-factories/program.md`
- `dev-research/tool-registry-factories/program.md`
- `dev-research/permission-audit-factories/program.md`
- `dev-research/context-assembly-factories/program.md`
- `dev-research/fanout-factories/program.md`
- `dev-research/identity-trust-factories/program.md`
- `dev-research/agent-bootstrap/program.md`
- `dev-research/agent-harness-research/program.md`

## Core Clarification

`default-factories` should not assume that every valid factory lane maps to
the same installation mechanism.

A lane can be valid research now even if its winning factories are not all
meant to be passed into `createAgent()` at startup.

The default bundle must instead distinguish at least three source classes:

### 1. Bootstrap Defaults

Factories that should be present when the agent starts because they establish
baseline policy or are needed before later discovery can work.

This is an installation-time category, not a statement about where the code
lives. A bootstrap default may still be implemented in the package and passed
directly through `CreateAgentOptions.factories`.

Typical examples may include:

- skill discovery or other initial capability catalog surfaces
- minimal planning / routing scaffolds
- baseline observability or notification policy
- factory discovery / qualification logic needed to load later modules

These are installed through `CreateAgentOptions.factories`.

### 2. Deployment-Provided Factories

Factories that are not universally shipped as startup defaults, but are
provided by a specific deployment, node profile, or operator environment.

Examples may include:

- deployment-specific auth policy
- infrastructure or persistence integrations
- node-publication or hosted-environment policy
- profile-specific capability surfaces

Some of these may still be passed at initialization, but they should remain
distinguishable from globally shipped defaults.

### 3. Dynamically Loaded Factories

Factories that should be discovered, selected, or generated after startup and
installed through `AGENT_EVENTS.update_factories`.

Typical examples may include:

- generated modules
- newly discovered workspace factory modules
- deployment-added bundles loaded on demand
- capability expansions triggered by search, discovery, planning, or user
  actions

This is not a side detail. It is one of the core architectural seams of the
factory-era agent, but it should not be confused with the question of whether
a factory is "default" in origin. A factory can be part of the package and
still be installed either as a bootstrap default or through a later runtime
load path, depending on composition policy.

## What This Lane Owns

This umbrella lane owns the bundle-level questions:

- which factory families belong in the default shipped composition
- which belong at bootstrap time versus dynamic load time
- what dependency ordering exists among focused lanes
- how local winners from separate lanes compose or conflict
- what bundle-level evals should decide promotion

This lane does not own the detailed hill-climbing of every neighboring
factory family. That remains the job of the focused subprograms.

## Core Hypothesis

The best default agent will come from a layered composition:

- a minimal core in `src/agent/create-agent.ts`
- a small bootstrap default bundle that makes the runtime usable and capable
  of further discovery
- optional deployment-provided factories
- dynamic factory installation for later capability expansion

The best shipped result will not come from:

- pushing all behavior back into the core
- pretending every factory should load at startup
- treating dynamically loaded factories as an afterthought
- optimizing each lane locally without bundle-level integration authority

## Program Structure

This lane should treat default-factory research as a two-level system.

### 1. Focused Subprograms

Each focused lane should own one bounded policy family.

Examples:

- `search-factories` owns search orchestration and retrieval policy
- `plan-factories` owns decomposition and plan-state routing
- `edit-factories` owns edit strategy and edit-state policy
- `verification-factories` owns checks, simulation, and repair policy
- `notification-factories` owns attention routing
- `observability-factories` owns retained traces and artifacts
- `module-discovery-factories` owns qualification and load policy
- `tool-registry-factories` owns compact capability records and selection
- `context-assembly-factories` owns phase-aware request assembly
- `identity-trust-factories` owns stable node identity, peer trust, and
  trust-service integration

Each subprogram should be narrow enough to support parallel mutation and
judged comparison.

### 2. Integration And Promotion

This umbrella lane should:

- define bundle-level evals
- classify startup versus dynamic factory roles
- track dependency edges between lanes
- judge whether local winners compose cleanly
- decide what becomes the recommended default shipped bundle

## Installation Classes

This lane should explicitly evaluate candidate factories by installation time.

### Bootstrap-Time Candidates

Questions:

- does this factory need to exist before any model-driven discovery?
- does it define baseline routing, safety, or observability?
- does later dynamic loading depend on it?

### Runtime-Load Candidates

Questions:

- can this capability be deferred until a task or event justifies it?
- should it be discovered from the workspace or generated on demand?
- does dynamic installation preserve a cleaner default model surface?

### Hybrid Candidates

Some factory families may split across both layers.

Examples:

- a minimal bootstrap discovery factory plus richer runtime-loaded modules
- a baseline planning scaffold plus dynamically loaded specialized planners
- a default observability spine plus task-specific artifact factories

The right unit of promotion is therefore not only:

- "should this lane exist?"

but also:

- "which part of this lane belongs in which layer?"

## Independence Classes

This lane should classify factory surfaces by coupling strength.

### Mostly Independent

Surfaces that can usually be hill-climbed in parallel first:

- notifications
- narrow projection helpers
- artifact retention patterns
- bounded skill and search metadata surfaces

### Moderately Coupled

Surfaces that can be explored separately but must be integrated early:

- planning
- editing
- verification
- search and retrieval
- workflow state
- module discovery
- tool registry and context assembly

### Tightly Coupled

Surfaces where the main value emerges at bundle level:

- planning + editing + verification
- search + context assembly + tool registry
- module discovery + dynamic loading correctness
- node auth + permission audit + notification policy
- observability + verification + distillation readiness
- session persistence + memory recall + restart behavior
- final default shipped composition

This classification should guide fanout scheduling and integration cadence.

## Evaluation Model

This lane should judge both local quality and bundle quality.

### Local Success Is Not Enough

A focused lane can produce a strong local candidate that still should not
become part of the default bundle if it:

- increases bundle complexity too much
- depends on assumptions neighboring lanes reject
- belongs in runtime loading rather than bootstrap defaults
- makes the default model surface harder to use correctly

### Bundle-Level Criteria

A default factory composition should be judged on:

- compatibility with the minimal core
- clarity of bootstrap versus runtime-loading boundaries
- quality of composition across factories
- observability and reviewability
- correctness of dynamic load behavior
- ease of correct use by the default model
- recovery behavior under partial failure or blocked work

## Promotion Rules

Nothing should become part of the default shipped composition merely because it
won one focused lane.

A promotable bundle must:

- preserve the minimal `createAgent()` direction
- compose through the current factory contract
- respect the concrete runtime module export contract
- justify whether each promoted factory is bootstrap-time, deployment-provided,
  or runtime-loaded
- outperform simpler alternatives on bundle-level tasks
- remain understandable enough for the default model to use reliably

## Outputs

This lane should produce:

- a map of current focused factory subprograms
- a bundle-level classification of bootstrap, deployment, and dynamic factory
  roles
- integration notes on compatibility and dependency order
- bundle-level evals and promotion rubrics
- retained recommendations for default shipped compositions
- an explicit recommendation for what should ship by default now

## Negative Goal

This lane should not:

- collapse factory research back into one giant mutation surface
- treat every valid lane as a startup default
- leave real current lanes described as future placeholders
- contradict the runtime distinction between initial factories and
  `update_factories`-loaded modules

The point of this lane is to hold both truths at once:

- factory research should remain parallelizable
- shipped defaults must still be chosen as a coherent layered bundle
