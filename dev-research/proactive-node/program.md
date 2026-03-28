# Proactive Node

## Goal

Discover and refine the durable memory, runtime, and evaluation surfaces for
proactive Plaited agents.

This lane exists to explore what should become stable long-term proactive memory
instead of leaving proactive behavior primarily encoded in `SKILL.md`
instructions or one-off generated files.

## Scope

This program is about:

- proactive sensing and diff semantics
- goal triggering and bounded task requests
- notification and escalation routing
- proactive memory layout and provenance
- evaluation criteria for proactive usefulness, correctness, and restraint

This program is not primarily about:

- final runtime implementation inside `src/`
- a fixed file scaffold for sensors/goals
- replacing the stable contracts already documented in `skills/proactive-node`

## Inputs

- `skills/proactive-node/SKILL.md`
- `skills/behavioral-core/SKILL.md`
- `skills/behavioral-core/references/behavioral-programs.md`
- `skills/behavioral-core/references/agent-patterns.spec.ts`
- `skills/agent-loop/SKILL.md`
- `skills/hypergraph-memory/SKILL.md`
- `src/agent/agent.types.ts`
- `src/agent/agent.constants.ts`
- `src/agent/agent.factories.ts`
- `src/behavioral/behavioral.utils.ts`
- `docs/HYPERGRAPH-MEMORY.md`
- `docs/AGENT-LOOP.md`

## Input Priority

Use these inputs with clear precedence:

1. `src/` and stable runtime contracts define what already exists.
2. `skills/proactive-node` defines the current contract surface.
3. behavioral and memory skills/docs provide supporting architecture and
   precedent.
4. exploratory ideas should be made explicit as proposals, not silently folded
   into the stable contract.

## External Retrieval

This lane already receives explicit local inputs and lane-provisioned skills.
Treat those as the primary source surface.

External retrieval is allowed only when:

- local proactive and memory surfaces are insufficient for a bounded design decision
- multiple local sources conflict and a tie-breaker is needed
- a missing term, pattern, or precedent must be verified before it is proposed

External retrieval should be supporting evidence, not the default authoring
surface.

## Expected Outputs

This lane should produce reviewable, lane-local artifacts such as:

- proactive design notes
- memory-shape proposals
- candidate sensor/goal taxonomies
- evaluation rubrics for proactive behavior
- candidate seed/corpus inputs for future proactive memory lanes

Those outputs should stay under:

- `dev-research/proactive-node/`

## What You Can Edit

- `dev-research/proactive-node/program.md`
- lane-local artifacts created under `dev-research/proactive-node/`

## What You Cannot Edit

- `src/tools/`
- stable runtime contracts in `src/` unless a separate reviewed promotion step explicitly broadens scope

## Research Questions

This lane should help answer questions such as:

- what proactive concepts should become long-term semantic memory rather than remain skill prose
- what makes a sensor delta useful instead of noisy
- how should goals express bounded action requests and escalation
- what notification patterns belong in stable runtime contracts versus lane-local policy
- what proactive traces should feed training and evaluation

## Run Loop

1. Confirm that the relevant proactive, behavioral, and memory inputs exist.
2. Compare current stable contracts against the unresolved proactive design space.
3. Produce or revise lane-local research artifacts under `dev-research/proactive-node/`.
4. Keep outputs reviewable, bounded, and explicit about what is stable versus proposed.
5. Promote only accepted conclusions into skills, runtime surfaces, or future seed/corpus lanes as a separate step.

## Success Criteria

- the lane produces reviewable proactive design artifacts
- proposed proactive memory and evaluation surfaces are explicit and bounded
- stable contracts are distinguished from still-experimental policy
- outputs make it easier to decide what should later become proactive seed/corpus memory

## Validation

Deterministic checks should verify:

- the program exists and is non-empty
- required local inputs exist
- lane-local outputs stay within `dev-research/proactive-node/`

This lane is exploratory by design. It exists to improve and distill the
proactive-node surface, not to claim that the final proactive runtime design is
already settled.
