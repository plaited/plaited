# MSS Seed

## Goal

Reproduce a compact MSS/Modnet seed ontology from the current MSS and Modnet source surfaces.

This lane exists to replace one-off manual seed curation with a stable, reviewable seed-generation workflow that a Plaited agent can eventually run for user-provided skills.

## Inputs

- `skills/mss/SKILL.md`
- `skills/mss/references/dynamics-distilled.md`
- `skills/mss/references/modnet-standards-distilled.md`
- `skills/mss/references/structural-ia-distilled.md`
- `skills/mss/references/valid-combinations.md`
- `skills/modnet-node/SKILL.md`
- `skills/modnet-modules/SKILL.md`
- `docs/Structural-IA.md`
- `docs/Modnet.md`
- `docs/MODNET-IMPLEMENTATION.md`

## External Retrieval

This lane already receives explicit local inputs and lane-provisioned skills.
Treat those as the primary source surface.

In practice, external retrieval here means targeted web search and source lookup
through the provisioned You.com skill.

External retrieval is allowed only when:

- the listed MSS / Modnet inputs are insufficient for a bounded seed decision
- multiple local sources conflict and a tie-breaker is needed
- a missing term, standard, or reference must be verified before encoding it

External retrieval should be used as supporting evidence, not as the default
authoring surface.

When external retrieval is used:

- prefer narrow web-search and source-seeking queries over broad open-ended exploration
- preserve the lane boundary and keep changes reviewable
- record in the attempt summary that external retrieval materially influenced the result
- do not let externally retrieved material silently override the lane inputs without explanation

## Lane Output

This lane owns its own seed candidate package under:

- `dev-research/mss-seed/seed/`

Those seed candidates should be graph-ready JSON-LD artifacts that define:

- stable MSS field anchors
- compact canonical value concepts
- invariants
- runtime and decomposition anchors needed by downstream corpus and factory compilation

## Downstream Use

Reviewed outputs from this lane are meant to seed downstream corpus and behavioral-factory generation.

This lane owns the authoring boundary for compact seed artifacts.

## Current Operator Surface

- `bun run research:mss-seed -- status`
- `bun run research:mss-seed -- validate`
- `bun run research:mss-seed -- generate`

## What You Can Edit

- `dev-research/mss-seed/program.md`
- `dev-research/mss-seed/seed/`
- `dev-research/mss-seed/artifacts/`
- `scripts/mss-seed.ts`

## What You Cannot Edit

- `src/tools/`

These remain separate support surfaces unless the operator explicitly broadens scope.

## Run Loop

1. Check that source inputs and deterministic helpers exist.
2. Use lane-owned chunking and comparison helpers to prepare source material.
3. Generate or revise lane-local seed candidates under `dev-research/mss-seed/seed/`.
4. Validate that the lane remains internally coherent and reviewable.
5. Promote reviewed seed candidates into downstream lanes only as a separate explicit step.

## Success Criteria

- lane-local seed artifacts exist and are non-empty
- artifacts express a compact seed ontology rather than raw corpus chunks
- internal references are resolvable
- the lane remains independently authorable

## Validation

Deterministic checks should verify:

- the program exists and is non-empty
- all required source inputs exist
- the chunking and compare helpers exist
- the lane-local seed path exists
- lane-local seed artifacts can be counted deterministically

This lane does not yet claim that seed generation is fully automated. It establishes the operator, boundary, and validation surface that a future Plaited-native generator will use.
