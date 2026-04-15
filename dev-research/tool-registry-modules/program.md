# Tool Registry Modules

## Goal

Research the default module bundle for metadata-first capability registry,
selection, and context assembly.

This lane should define how the system:

- represents callable capability surfaces such as built-ins, skills, MCP
  tools, A2A-exposed capabilities, and module-provided tools
- searches over compact metadata and descriptions instead of shoving full
  schemas into every model request
- assembles a bounded request with only the relevant tools or capability
  surfaces for the next inference step
- keeps the minimal core free of giant prompt-time tool catalogs

The target is not one monolithic prompt formatter. The target is a module
family that makes capability discovery and selection explicit, searchable, and
reviewable.

## Why This Lane Exists

The current repo already has adjacent ingredients:

- [dev-research/skill-modules/program.md](../skill-modules/program.md) owns skill discovery and
  activation
- [dev-research/mcp-modules/program.md](../mcp-modules/program.md) owns MCP-backed capability surfaces
- [dev-research/module-discovery-modules/program.md](../module-discovery-modules/program.md) owns module-bearing
  module qualification and load policy
- [dev-research/search-modules/program.md](../search-modules/program.md) owns broader retrieval policy

What remains open is the unified registry layer:

- what compact metadata should exist for each capability surface
- how tool and skill descriptions should be searched
- when to make a separate inference request just for capability selection
- how the next inference request should be assembled with only the relevant
  callable surfaces
- how capability selection remains reviewable across proactive long-lived work

Without this lane, capability assembly risks being partially owned by skills,
MCP, search, and projection without one explicit owner.

## Relationship To Other Lanes

This lane sits under:

- [dev-research/default-modules/program.md](../default-modules/program.md)

It should integrate with:

- [dev-research/skill-modules/program.md](../skill-modules/program.md)
- [dev-research/mcp-modules/program.md](../mcp-modules/program.md)
- [dev-research/module-discovery-modules/program.md](../module-discovery-modules/program.md)
- [dev-research/search-modules/program.md](../search-modules/program.md)
- [dev-research/context-assembly-modules/program.md](../context-assembly-modules/program.md)
- [dev-research/three-axis-modules/program.md](../three-axis-modules/program.md)

The intended split is:

- `tool-registry-modules` owns compact capability records, search over
  descriptions, and selection/assembly policy
- `skill-modules` owns skill-specific discovery and activation
- `mcp-modules` owns MCP capability integration
- `context-assembly-modules` owns broader phase-aware request assembly
- `three-axis-modules` owns cross-cutting risk and authority controls

## Dependency Order

1. [docs/AGENT-LOOP.md](../../docs/AGENT-LOOP.md) defines the minimal-core plus module-composed model
2. adjacent lanes define skills, MCP, modules, search, and three-axis
   constraints
3. this lane hill-climbs the metadata-first capability registry slice and
   feeds winners back into the default-modules umbrella

## Core Hypothesis

The best default agent will not inline every full tool schema or skill body in
every request.

Instead it should:

- retain a compact searchable registry of capability metadata
- use one inference step or symbolic policy step to select relevant surfaces
- assemble the subsequent request with only the needed tools, skills, or
  modules

That makes small and medium models more reliable while preserving provenance.

## Product Target

The first shipped tool-registry module bundle should support:

1. registering compact metadata for callable capability surfaces
2. searching over names, descriptions, tags, and authority-relevant hints
3. selecting a bounded subset of capabilities for the next phase
4. assembling a subsequent request with only those selected surfaces
5. retaining provenance for why a capability was selected or omitted
6. composing with MCP, skills, modules, and A2A without one giant registry
   dump in every context block

## Required Architectural Properties

### 1. Registry Must Be Metadata-First

Candidate designs should start from compact records such as:

- name
- description
- capability class
- risk tags
- authority hints
- source class

### 2. Selection Must Be Reviewable

The system should make it clear:

- what capability search happened
- what candidates were considered
- what was selected
- what subsequent request was assembled

### 3. Source Classes Must Stay Distinguishable

The design should preserve explicit distinctions among:

- built-in primitives
- skill-linked capabilities
- MCP tools
- A2A-routed remote capabilities
- module-provided or generated capabilities

### 4. Full Schemas Should Be On-Demand

This lane should strongly prefer:

- searching over compact descriptions first
- loading richer callable surfaces only when selected

## Research Questions

This lane should answer:

- what is the minimal canonical capability record?
- when should selection use inference versus symbolic filtering?
- what should be searchable before a capability is fully loaded?
- how should selected capability bundles be assembled for the next request?
- how should authority, provenance, and trust metadata participate?

## Deliverables

This lane should produce:

- candidate tool-registry module bundles
- compact capability-record schemas
- eval tasks for tool selection and bounded request assembly
- a recommendation for how tool registry policy should participate in the
  default bundle
