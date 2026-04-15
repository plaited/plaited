# Default Modules

## Goal

Determine the default module composition for the Plaited agent.

## Writable Roots

Program-runner attempts for this lane should only edit:

- [src/modules/](../../src/modules/)
- [src/modules.ts](../../src/modules.ts)

This lane is the umbrella research program for module-era agent behavior. It
does not exist to mutate one narrow module surface in isolation. It exists to
decide:

- which module families belong in the default agent bundle
- which of those modules must be present at `createAgent()` initialization
- which should be discovered, selected, or generated later and installed
  through `AGENT_EVENTS.update_modules`
- how the shipped default composition should balance minimal core, reviewable
  policy, and dynamic extensibility

## Why This Lane Exists

The current architecture intentionally keeps
[src/agent/create-agent.ts](../../src/agent/create-agent.ts) minimal.

The core now owns only a small runtime substrate:

- behavioral engine setup
- restricted trigger boundary
- signal installation
- heartbeat emission
- built-in file, grep, bash, and inference handlers
- installation of module functions passed in at initialization
- installation of additional module modules loaded later through
  `AGENT_EVENTS.update_modules`

That means the main default-module question is no longer:

- "what giant built-in agent should exist?"

It is:

- "what module composition should ship as the default agent policy layer?"

## Source Of Truth

The current architectural source of truth is:

- [src/agent/create-agent.ts](../../src/agent/create-agent.ts)
- [src/agent/agent.types.ts](../../src/agent/agent.types.ts)
- [src/agent/agent.schemas.ts](../../src/agent/agent.schemas.ts)
- [src/agent/tests/create-agent.spec.ts](../../src/agent/tests/create-agent.spec.ts)

The most important current runtime facts are:

- `CreateAgentOptions` accepts `modules?: Module[]`
- `createAgent()` installs those modules immediately during initialization
- shipped default modules may be installed through that initial
  `modules` array
- `AGENT_EVENTS.update_modules` is the runtime module-loading path for
  additional module bundles
- a dynamically loaded module module must export:

```typescript
{
  default: Module[]
}
```

This split is real and should be treated as first-class in module research.

## Relationship To Other Lanes

This lane depends on and integrates focused subprograms such as:

- [dev-research/skill-modules/program.md](../skill-modules/program.md)
- [dev-research/bash-modules/program.md](../bash-modules/program.md)
- [dev-research/acp-modules/program.md](../acp-modules/program.md)
- [dev-research/a2a-modules/program.md](../a2a-modules/program.md)
- [dev-research/mcp-modules/program.md](../mcp-modules/program.md)
- [dev-research/memory-modules/program.md](../memory-modules/program.md)
- [dev-research/search-modules/program.md](../search-modules/program.md)
- [dev-research/verification-modules/program.md](../verification-modules/program.md)
- [dev-research/three-axis-modules/program.md](../three-axis-modules/program.md)
- [dev-research/node-auth-modules/program.md](../node-auth-modules/program.md)
- [dev-research/server-module/program.md](../server-module/program.md)
- [dev-research/module-discovery-modules/program.md](../module-discovery-modules/program.md)
- [dev-research/plan-modules/program.md](../plan-modules/program.md)
- [dev-research/edit-modules/program.md](../edit-modules/program.md)
- [dev-research/node-home-modules/program.md](../node-home-modules/program.md)
- [dev-research/node-discovery-modules/program.md](../node-discovery-modules/program.md)
- [dev-research/notification-modules/program.md](../notification-modules/program.md)
- [dev-research/observability-modules/program.md](../observability-modules/program.md)
- [dev-research/projection-modules/program.md](../projection-modules/program.md)
- [dev-research/workflow-state-modules/program.md](../workflow-state-modules/program.md)
- [dev-research/session-persistence-modules/program.md](../session-persistence-modules/program.md)
- [dev-research/tool-registry-modules/program.md](../tool-registry-modules/program.md)
- [dev-research/permission-audit-modules/program.md](../permission-audit-modules/program.md)
- [dev-research/context-assembly-modules/program.md](../context-assembly-modules/program.md)
- [dev-research/fanout-modules/program.md](../fanout-modules/program.md)
- [dev-research/identity-trust-modules/program.md](../identity-trust-modules/program.md)
- [dev-research/agent-bootstrap/program.md](../agent-bootstrap/program.md)
- [dev-research/agent-harness-research/program.md](../agent-harness-research/program.md)

## Core Clarification

`default-modules` should not assume that every valid module lane maps to
the same installation mechanism.

A lane can be valid research now even if its winning modules are not all
meant to be passed into `createAgent()` at startup.

The default bundle must instead distinguish at least three source classes:

### 1. Bootstrap Defaults

Modules that should be present when the agent starts because they establish
baseline policy or are needed before later discovery can work.

This is an installation-time category, not a statement about where the code
lives. A bootstrap default may still be implemented in the package and passed
directly through `CreateAgentOptions.modules`.

Typical examples may include:

- skill discovery or other initial capability catalog surfaces
- minimal planning / routing scaffolds
- baseline observability or notification policy
- module discovery / qualification logic needed to load later modules

These are installed through `CreateAgentOptions.modules`.

### 2. Deployment-Provided Modules

Modules that are not universally shipped as startup defaults, but are
provided by a specific deployment, node profile, or operator environment.

Examples may include:

- deployment-specific auth policy
- infrastructure or persistence integrations
- node-publication or hosted-environment policy
- profile-specific capability surfaces

Some of these may still be passed at initialization, but they should remain
distinguishable from globally shipped defaults.

### 3. Dynamically Loaded Modules

Modules that should be discovered, selected, or generated after startup and
installed through `AGENT_EVENTS.update_modules`.

Typical examples may include:

- generated modules
- newly discovered workspace module modules
- deployment-added bundles loaded on demand
- capability expansions triggered by search, discovery, planning, or user
  actions

This is not a side detail. It is one of the core architectural seams of the
module-era agent, but it should not be confused with the question of whether
a module is "default" in origin. A module can be part of the package and
still be installed either as a bootstrap default or through a later runtime
load path, depending on composition policy.

## What This Lane Owns

This umbrella lane owns the bundle-level questions:

- which module families belong in the default shipped composition
- which belong at bootstrap time versus dynamic load time
- what dependency ordering exists among focused lanes
- how local winners from separate lanes compose or conflict
- what bundle-level evals should decide promotion

This lane does not own the detailed hill-climbing of every neighboring
module family. That remains the job of the focused subprograms.

## Core Hypothesis

The best default agent will come from a layered composition:

- a minimal core in [src/agent/create-agent.ts](../../src/agent/create-agent.ts)
- a small bootstrap default bundle that makes the runtime usable and capable
  of further discovery
- optional deployment-provided modules
- dynamic module installation for later capability expansion

The current model-family assumption for bundle research should be:

- Gemma 4 is the initial autoresearch model family
- local and server lanes stay in that same family
- deployment may change model size, quantization, or hosting lane
- deployment should not require a separate built-in vision inference surface
  when the primary model already supports multimodal work

The best shipped result will not come from:

- pushing all behavior back into the core
- pretending every module should load at startup
- treating dynamically loaded modules as an afterthought
- optimizing each lane locally without bundle-level integration authority

## Current Initial Bundle

The smallest real bootstrap-time bundle should currently contain only:

- `server-module`

Reasoning:

- it is the only concrete shipped module lane in `src/modules.ts` that
  bootstrap directly depends on to start the runtime
- `autoresearch-module` and `skills-module` are still placeholders, not real
  startup policy surfaces
- `a2a-module`, `mcp-module`, and related utilities are important adjacent
  surfaces, but they are not yet promoted as bootstrap-installed behavioral
  modules

Until more module lanes become concrete and judged at the bundle level,
bootstrap should consume this minimal bundle rather than inventing broader
policy inline.

## Program Structure

This lane should treat default-module research as a two-level system.

### 1. Focused Subprograms

Each focused lane should own one bounded policy family.

Examples:

- `search-modules` owns search orchestration and retrieval policy
- `plan-modules` owns decomposition and plan-state routing
- `edit-modules` owns edit strategy and edit-state policy
- `verification-modules` owns checks, simulation, and repair policy
- `notification-modules` owns attention routing
- `observability-modules` owns retained traces and artifacts
- `module-discovery-modules` owns qualification and load policy
- `tool-registry-modules` owns compact capability records and selection
- `context-assembly-modules` owns phase-aware request assembly
- `identity-trust-modules` owns stable node identity, peer trust, and
  trust-service integration
- `server-module` owns transport runtime composition, route contribution, and
  server lifecycle policy

Each subprogram should be narrow enough to support parallel mutation and
judged comparison.

### 2. Integration And Promotion

This umbrella lane should:

- define bundle-level evals
- classify startup versus dynamic module roles
- track dependency edges between lanes
- judge whether local winners compose cleanly
- decide what becomes the recommended default shipped bundle

## Installation Classes

This lane should explicitly evaluate candidate modules by installation time.

### Bootstrap-Time Candidates

Questions:

- does this module need to exist before any model-driven discovery?
- does it define baseline routing, safety, or observability?
- does later dynamic loading depend on it?

### Runtime-Load Candidates

Questions:

- can this capability be deferred until a task or event justifies it?
- should it be discovered from the workspace or generated on demand?
- does dynamic installation preserve a cleaner default model surface?

### Hybrid Candidates

Some module families may split across both layers.

Examples:

- a minimal bootstrap discovery module plus richer runtime-loaded modules
- a baseline planning scaffold plus dynamically loaded specialized planners
- a default observability spine plus task-specific artifact modules

The right unit of promotion is therefore not only:

- "should this lane exist?"

but also:

- "which part of this lane belongs in which layer?"

## Independence Classes

This lane should classify module surfaces by coupling strength.

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
- observability + verification + model-adaptation readiness
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

A default module composition should be judged on:

- compatibility with the minimal core
- clarity of bootstrap versus runtime-loading boundaries
- quality of composition across modules
- observability and reviewability
- correctness of dynamic load behavior
- ease of correct use by the default model
- recovery behavior under partial failure or blocked work

## Promotion Rules

Nothing should become part of the default shipped composition merely because it
won one focused lane.

A promotable bundle must:

- preserve the minimal `createAgent()` direction
- compose through the current module contract
- respect the concrete runtime module export contract
- justify whether each promoted module is bootstrap-time, deployment-provided,
  or runtime-loaded
- outperform simpler alternatives on bundle-level tasks
- remain understandable enough for the default model to use reliably

## Outputs

This lane should produce:

- a map of current focused module subprograms
- a bundle-level classification of bootstrap, deployment, and dynamic module
  roles
- integration notes on compatibility and dependency order
- bundle-level evals and promotion rubrics
- retained recommendations for default shipped compositions
- an explicit recommendation for what should ship by default now

## Negative Goal

This lane should not:

- collapse module research back into one giant mutation surface
- treat every valid lane as a startup default
- leave real current lanes described as future placeholders
- contradict the runtime distinction between initial modules and
  `update_modules`-loaded modules

The point of this lane is to hold both truths at once:

- module research should remain parallelizable
- shipped defaults must still be chosen as a coherent layered bundle
