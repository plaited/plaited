# Slice 6: Stage 1 MSI Refinement

## Target

Refine Stage 1 symbolic-output training on the MSI machine with better data
shaping and more realistic training headroom than the local Mac path allows.

## Scope

- `dev-research/native-model/`
- `dev-research/native-model/evals/`
- `dev-research/native-model/training/`
- `scripts/`
- no broad framework-runtime refactors

## Required

- improve data shaping so oversized examples are less aggressively truncated
- preserve the curated retained-output boundary as the stable Stage 1 input
- run the first serious MSI baseline-vs-tuned comparison before promotion
- keep no-promotion-on-regression as the policy

## Preserve

- this slice remains Stage 1 symbolic-output work
- the trial/eval/compare loop remains the decision surface
- provider-specific training backends stay outside `src/`

## Avoid

- treating MSI bring-up as a reason to skip evaluation discipline
- jumping into tool-aware process training before Stage 1 is stable
- training directly from raw validation results

## Acceptance Criteria

- MSI-scale Stage 1 runs reduce truncation pressure materially
- tuned-versus-untuned comparison is run before promotion
- the resulting Stage 1 workflow is stronger than the local Mac bootstrap path
