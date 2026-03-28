# Behavioral Corpus

## Goal

Encode behavioral and constitution source material as a graph-ready corpus that
depends on behavioral seed anchors and can support downstream factory
compilation without reopening raw `SKILL.md` files.

## Dependency Order

1. `behavioral-seed` establishes compact behavioral and constitution anchors.
2. `behavioral-corpus` encodes source chunks, assertions, and provenance against that seed layer.
3. `behavioral-factories` consumes both behavioral seed and behavioral corpus.

## Inputs

- `dev-research/behavioral-seed/program.md`
- `dev-research/behavioral-seed/seed/`
- `skills/behavioral-core/SKILL.md`
- `skills/behavioral-core/references/behavioral-programs.md`
- `skills/behavioral-core/references/algorithm-reference.md`
- `skills/behavioral-core/references/agent-patterns.spec.ts`
- `skills/behavioral-core/references/agent-lifecycle.spec.ts`
- `skills/behavioral-core/references/agent-orchestration.spec.ts`
- `skills/constitution/SKILL.md`
- `skills/constitution/references/factory-patterns.md`
- `skills/constitution/references/generated-bthreads.md`
- `skills/constitution/references/mac-rules.md`
- `src/behavioral/behavioral.ts`
- `src/agent/factories.ts`
- `src/agent/governance.ts`

## Input Priority

Use a progressive mix with clear precedence:

1. `dev-research/behavioral-seed/seed/` is the semantic frame for this lane.
2. Raw behavioral and constitution source surfaces are the evidence layer.
3. Only introduce corpus structure not already covered by the seed when the
   source material requires it and the insufficiency is made explicit.

This lane should not treat raw source material as a parallel ontology source.

## External Retrieval

This lane already receives explicit local inputs and lane-provisioned skills.
Treat those as the primary source surface.

In practice, external retrieval here means targeted web search and source lookup
through the provisioned You.com skill.

External retrieval is allowed only when:

- the listed behavioral / constitution inputs do not provide enough evidence to encode a chunk or assertion
- multiple local sources conflict and additional source verification is needed
- a missing reference, standard, or concept must be checked before it is added to the corpus

External retrieval should remain a fallback, not the default corpus source.

## Target Output Shape

This lane should eventually emit graph-ready corpus artifacts such as:

- source chunks
- distilled assertions
- typed relations
- provenance links
- optional embeddings

## What You Can Edit

- `dev-research/behavioral-corpus/program.md`
- `dev-research/behavioral-corpus/encoded/`
- `dev-research/behavioral-corpus/artifacts/`
- `scripts/behavioral-corpus.ts`

## What You Cannot Edit

- `src/tools/`

## Run Loop

1. Confirm that `behavioral-seed` and lane-local seed artifacts exist.
2. Load seed anchors first and treat them as the semantic frame for corpus encoding.
3. Chunk and compare the raw behavioral / constitution source material deterministically.
4. Emit lane-local encoded corpus artifacts under `dev-research/behavioral-corpus/encoded/`.
5. Validate that the corpus still depends on the behavioral seed layer rather than raw ad hoc concepts.
6. Record any explicit seed insufficiency instead of silently inventing a parallel ontology.
7. Promote reviewed corpus outputs only as a separate explicit step.

## Success Criteria

- lane-local encoded artifacts exist and are non-empty
- source chunks and distilled assertions can point back to source material
- encoded artifacts align to behavioral seed anchors instead of inventing a separate ontology
- downstream behavioral-factory generation can consume seed plus corpus without reopening raw source files

## Current Operator Surface

- `bun run research:behavioral-corpus`
- `bun scripts/behavioral-corpus.ts status`
- `bun scripts/behavioral-corpus.ts validate`

## Validation

Deterministic checks should verify:

- the program exists and is non-empty
- the behavioral-seed lane and lane-local seed outputs exist
- required source inputs exist
- required runtime surfaces exist

This lane does not yet claim that corpus generation is implemented. It defines
the lane and the prerequisites for the upcoming behavioral corpus encoder.
