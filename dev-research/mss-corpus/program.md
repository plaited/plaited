# MSS Corpus

## Goal

Encode MSS and Modnet source material as a graph-ready corpus that downstream behavioral-factory generation can consume without going back to raw `SKILL.md` files.

## Dependency Order

1. `mss-seed` establishes the compact ontology and relation anchors.
2. `mss-corpus` encodes source chunks, distilled assertions, provenance, and optional embeddings against that seed layer.
3. `behavioral-factories` consumes both the seed and the encoded corpus.

## Inputs

- `dev-research/mss-seed/program.md`
- `dev-research/mss-seed/seed/`
- `skills/mss/SKILL.md`
- `skills/mss/references/*.md`
- `skills/modnet-node/SKILL.md`
- `skills/modnet-modules/SKILL.md`
- `docs/Structural-IA.md`
- `docs/Modnet.md`
- `docs/MODNET-IMPLEMENTATION.md`

## Target Output Shape

This lane should eventually emit graph-ready corpus artifacts such as:

- source chunks
- distilled assertions
- typed relations
- provenance links
- optional embeddings

Those artifacts should stay lane-local until reviewed and promoted.

## What You Can Edit

- `dev-research/mss-corpus/program.md`
- `dev-research/mss-corpus/encoded/`
- `dev-research/mss-corpus/artifacts/`
- `scripts/mss-corpus.ts`

## What You Cannot Edit

- `src/tools/`

## Run Loop

1. Confirm that `mss-seed` and the lane-local seed artifacts exist.
2. Chunk and compare the source material deterministically.
3. Emit lane-local encoded corpus artifacts under `dev-research/mss-corpus/encoded/`.
4. Validate that the corpus still depends on the seed layer rather than raw ad hoc concepts.
5. Promote reviewed corpus outputs only as a separate explicit step.

## Success Criteria

- lane-local encoded artifacts exist and are non-empty
- source chunks and distilled assertions can point back to source material
- encoded artifacts align to seed anchors instead of inventing a separate ontology
- downstream behavioral-factory generation can consume seed plus corpus without reopening raw source files

## Current Operator Surface

- `bun run research:mss-doc-chunks`
- `bun run research:mss-source-compare`
- `bun run research:mss-corpus -- status`
- `bun run research:mss-corpus -- validate`

## Validation

Deterministic checks should verify:

- the program exists and is non-empty
- the seed lane and lane-local seed outputs exist
- required source inputs exist
- the chunking and compare helpers exist

This lane does not yet claim that corpus generation is implemented. It defines the lane and the prerequisites for the upcoming corpus encoder.
