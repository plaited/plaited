# Context Assembly Factories

## Goal

Research the default factory bundle for phase-aware context assembly and
request routing in a persistent Plaited agent.

This lane should define how the system:

- assembles bounded live context from internal state, memory, search, and
  capability selection
- routes multi-step inference flows where one step selects tools or evidence
  and the next step acts with only the needed context
- avoids transcript compaction as the main answer to context pressure
- keeps long-lived proactive behavior coherent through selective projection and
  routing

The target is not transcript compaction. The target is a factory family for
intentional context construction.

## Why This Lane Exists

The repo already has strong adjacent lanes:

- [dev-research/memory-factories/program.md](../memory-factories/program.md) owns retained recall and
  consolidation
- [dev-research/projection-factories/program.md](../projection-factories/program.md) owns concise live summaries
- [dev-research/search-factories/program.md](../search-factories/program.md) owns retrieval orchestration
- [dev-research/tool-registry-factories/program.md](../tool-registry-factories/program.md) owns metadata-first
  capability selection
- [dev-research/plan-factories/program.md](../plan-factories/program.md) owns decomposition and phase-state
  policy

What remains open is the assembly layer that combines them:

- what goes into the next request
- what is searched or selected in a prior request
- how context blocks differ by phase
- how live context stays bounded without depending on compaction
- how persistent proactive work avoids replaying the whole recent past

Without this lane, request assembly risks being split across memory,
projection, search, and capability selection without one explicit owner.

## Relationship To Other Lanes

This lane sits under:

- [dev-research/default-factories/program.md](../default-factories/program.md)

It should integrate with:

- [dev-research/memory-factories/program.md](../memory-factories/program.md)
- [dev-research/projection-factories/program.md](../projection-factories/program.md)
- [dev-research/search-factories/program.md](../search-factories/program.md)
- [dev-research/tool-registry-factories/program.md](../tool-registry-factories/program.md)
- [dev-research/plan-factories/program.md](../plan-factories/program.md)
- [dev-research/workflow-state-factories/program.md](../workflow-state-factories/program.md)

The intended split is:

- `context-assembly-factories` owns phase-aware assembly of the next request
- `memory-factories` owns recall sources
- `projection-factories` owns concise projected state blocks
- `search-factories` owns retrieval policy
- `tool-registry-factories` owns capability selection metadata and assembly
  inputs

## Dependency Order

1. [docs/AGENT-LOOP.md](../../docs/AGENT-LOOP.md) defines context assembly as a factory responsibility
2. adjacent lanes define memory, projection, search, planning, and capability
   selection constraints
3. this lane hill-climbs the request-assembly slice and feeds winners back
   into the default-factories umbrella

## Core Hypothesis

Long-lived agents should stay coherent by assembling the right context now, not
by repeatedly compacting prior context.

That means the best default design will:

- retrieve selectively
- project selectively
- assemble phase-aware bounded blocks
- sometimes split work into multiple inference steps

## Product Target

The first shipped context-assembly factory bundle should support:

1. selecting relevant internal state for the current phase
2. routing retrieval and capability-selection steps before action steps when
   needed
3. assembling bounded requests from:
   - plan state
   - constraints
   - recent verified progress
   - relevant memory
   - selected search evidence
   - selected capability surfaces
4. suppressing unchanged or low-value context
5. preserving provenance for assembled context blocks
6. staying compatible with a persistent proactive runtime

## Required Architectural Properties

### 1. Assembly Must Be Phase-Aware

Different phases should receive different context shapes, for example:

- planning
- searching
- execution
- verification
- repair
- proactive maintenance

### 2. Assembly Must Prefer Selection Over Compaction

This lane should prefer:

- bounded projection
- selective retrieval
- capability preselection
- multi-step routing

It should not treat transcript compaction as the primary solution.

### 3. Assembly Must Preserve Provenance

The system should make it clear:

- what context block was included
- where it came from
- why it was included now
- what deeper artifact or memory source backs it

### 4. Assembly Must Compose With Small Models

Candidate designs should explicitly support:

- local or smaller models
- bounded tool exposure
- limited active-window budgets

## Research Questions

This lane should answer:

- what is the minimal useful set of context blocks by phase?
- when should the agent do a separate retrieval or capability-selection step?
- how should unchanged projections be suppressed?
- how should live context differ for foreground versus background work?
- what provenance is sufficient for inspection without bloating the request?

## Deliverables

This lane should produce:

- candidate context-assembly factory bundles
- context-block schemas and request-routing patterns
- eval tasks for bounded context quality and phase-aware assembly
- a recommendation for how context assembly should participate in the default
  bundle
