# Slice 15

## Target

Run seed review on the regenerated prompt set, analyze a 100-row sample at
`--concurrency 5`, and define promotion criteria for the full retained corpus.

## Scope

- `scripts/hypercard-reclassify.ts`
- `scripts/hypercard-reclassification-judge.ts`
- `scripts/hypercard-reclassification-meta-verifier.ts`
- `dev-research/modnet/catalog/`
- `dev-research/modnet/`

## Required

- run seed review on the regenerated prompt set rather than the original prompt
  set
- treat the regenerated prompt-set artifact from Slice 14 as the only input
  source for this slice
- analyze a 100-row sample with:
  - trust rate
  - recommended-for-seed-review rate
  - family distribution
  - scale distribution
  - structure distribution
  - spend totals
- define what counts as good enough to run the full retained corpus
- define promotion criteria for moving regenerated prompts or seeds into
  canonical training artifacts

## Preserve

- use the existing reclassification judge/meta-verifier lane unless a clear
  failure forces change
- keep the sample run at `--concurrency 5`
- keep spend visible for sample and full-run decisions

## Avoid

- treating all `recommendedForSeedReview` rows as auto-promoted
- skipping the sample analysis before the full run
- falling back to the legacy prompt catalog out of convenience

## Acceptance Criteria

- a sample-analysis report exists for the regenerated prompt set
- clear thresholds exist for when to run the full retained corpus
- promotion policy is explicit enough to move from experiment to curation
