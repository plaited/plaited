# Slice 14

## Target

Run the chosen regeneration flow over the retained HyperCard corpus and produce
a regenerated modnet prompt set.

## Scope

- `scripts/modnet-raw-card-regeneration-base.ts`
- `scripts/modnet-raw-card-regeneration-evaluate.ts`
- `scripts/modnet-raw-card-regeneration-compare.ts`
- `scripts/modnet-regeneration-variant-evaluate.ts`
- `scripts/modnet-build-retained-raw-card-corpus.ts`
- `scripts/workspace-paths.ts`
- `dev-research/modnet/catalog/`
- `dev-research/modnet/`

## Required

- take the retained raw corpus from:
  - `dev-research/modnet/catalog/modnet-retained-raw-card-corpus.jsonl`
- apply the winning regeneration flow from Slice 13
- treat the allowed regeneration variants as:
  - `base_1`
  - `base_1_search`
  - `base_1_search_followup_livecrawl`
- write concrete artifacts for:
  - regeneration candidates
  - regeneration evaluations
  - variant comparison
  - regenerated prompt-set output
- emit a versioned regenerated prompt set with provenance fields that make each
  row traceable back to:
  - the raw card
  - the inclusion-gate output
  - the search-grounded regeneration result
- keep the output format compatible with later seed-review tooling

## Preserve

- the regenerated prompt set should be a new artifact, not an in-place rewrite
  of the existing catalog
- handcrafted prompts remain the control set rather than being merged blindly

## Avoid

- collapsing all cards into one generic prompt shape
- stripping provenance fields needed for later audit/promotion

## Acceptance Criteria

- a regenerated HyperCard prompt set exists as a concrete JSONL artifact
- the concrete output paths are documented and deterministic
- the set is ready for seed review without further manual reshaping
