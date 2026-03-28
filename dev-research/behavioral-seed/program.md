# Behavioral Seed

## Goal

Distill a compact behavioral ontology from Plaited's behavioral and
constitution source surfaces.

This lane exists to move core behavioral concepts out of raw `SKILL.md`
dependency and into durable seed memory the agent can eventually use for
training and runtime reasoning.

## Inputs

- `skills/behavioral-core/SKILL.md`
- `skills/behavioral-core/references/behavioral-programs.md`
- `skills/behavioral-core/references/algorithm-reference.md`
- `skills/behavioral-core/references/agent-patterns.spec.ts`
- `skills/behavioral-core/references/agent-lifecycle.spec.ts`
- `skills/behavioral-core/references/agent-orchestration.spec.ts`
- `skills/constitution/SKILL.md`
- `skills/constitution/references/factory-patterns.md`
- `skills/constitution/references/generated-bthreads.md`
- `skills/constitution/references/governance-model.md`
- `skills/constitution/references/mac-rules.md`
- `src/behavioral/behavioral.ts`

## Input Priority

Use these inputs with clear precedence:

1. `skills/behavioral-core` and `skills/constitution` define the primary
   ontology surface for this lane.
2. constitution references provide governance and lifecycle detail that should
   shape the seed layer.
3. runtime code such as `src/behavioral/behavioral.ts` is supporting
   implementation evidence, not ontology authority.
4. when runtime code and skill/reference surfaces diverge, prefer the
   behavioral and constitution source surfaces unless the discrepancy is made
   explicit and justified.

## External Retrieval

This lane already receives explicit local inputs and lane-provisioned skills.
Treat those as the primary source surface.

In practice, external retrieval here means targeted web search and source lookup
through the provisioned You.com skill.

External retrieval is allowed only when:

- local behavioral or constitution surfaces are insufficient for a bounded seed decision
- multiple local sources conflict and a tie-breaker is needed
- a missing term, standard, or reference must be verified before encoding it

External retrieval should be supporting evidence, not the default authoring
surface.

## Lane Output

This lane owns compact behavioral seed candidates under:

- `dev-research/behavioral-seed/seed/`

Those seed candidates should define stable behavioral anchors such as:

- behavioral program primitives
- synchronization idioms
- event-selection invariants
- governance and constitution anchors
- factory and lifecycle concepts used downstream

## Downstream Use

Reviewed outputs from this lane are meant to seed downstream behavioral corpus
and behavioral-factory generation.

## Current Operator Surface

- `bun run research:behavioral-seed`
- `bun scripts/behavioral-seed.ts status`
- `bun scripts/behavioral-seed.ts validate`

## What You Can Edit

- `dev-research/behavioral-seed/program.md`
- `dev-research/behavioral-seed/seed/`
- `dev-research/behavioral-seed/artifacts/`
- `scripts/behavioral-seed.ts`

## What You Cannot Edit

- `src/tools/`

## Run Loop

1. Check that behavioral and constitution source inputs exist.
2. Treat behavioral-core and constitution sources as the main ontology surface.
3. Use runtime code only as supporting implementation evidence when needed.
4. Generate or revise lane-local seed candidates under `dev-research/behavioral-seed/seed/`.
5. Validate that the lane remains compact, reviewable, and independently authorable.
6. Promote reviewed seed candidates only as a separate explicit step.

## Success Criteria

- lane-local behavioral seed artifacts exist and are non-empty
- artifacts encode behavioral and constitution anchors rather than raw source dumps
- internal references are resolvable
- downstream behavioral corpus generation can depend on this lane instead of reopening raw skill text

## Validation

Deterministic checks should verify:

- the program exists and is non-empty
- required behavioral and constitution inputs exist
- the lane-local seed path exists or can be counted deterministically

This lane does not yet claim that behavioral seed generation is fully automated.
It establishes the authoring boundary and validation surface for that future
generator.
