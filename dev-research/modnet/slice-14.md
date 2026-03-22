# Slice 14

## Target

Run the chosen regeneration flow over the retained HyperCard corpus and produce
a regenerated modnet prompt set.

## Scope

- `.worktrees/hypercard-catalog-task/dev-research/native-model/hypercard-catalog.jsonl`
- `dev-research/modnet/catalog/`
- `dev-research/modnet/`

## Required

- take the retained raw corpus from Slice 12
- apply the winning regeneration flow from Slice 13
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
- the set is ready for seed review without further manual reshaping
