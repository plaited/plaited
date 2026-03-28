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

- `bun run research:mss-doc-chunks`
- `bun run research:mss-source-compare`
- `bun run research:mss-seed -- status`
- `bun run research:mss-seed -- validate`

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
2. Use chunking and comparison helpers to prepare source material.
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
