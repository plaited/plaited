# Slice 22

## Target

Improve the regenerated-seed review classifier so Slice 15 produces materially
better promotion decisions on regenerated HyperCard prompt seeds.

The current issue is not generation quality alone. The current seed-review lane
is under-contexted:
- regenerated seeds are being judged through a reclassification surface that
  was designed around older prompt rows
- sample rows do not yet carry enough regenerated-module and MSS context
- the judge/meta prompts do not clearly frame the task as promotion review for
  future lower-scale derivation

This slice should improve classifier results by strengthening the review
artifact shape and the classifier instructions before rerunning the Slice 15
sample.

## Scope

- `scripts/modnet-build-seed-review-sample.ts`
- `scripts/hypercard-reclassify.ts`
- `scripts/hypercard-reclassification-judge.ts`
- `scripts/hypercard-reclassification-meta-verifier.ts`
- `scripts/tests/`
- `dev-research/modnet/`

## Required

- keep Slice 15 as a classifier/review lane, not an autoresearch generation lane
- preserve the existing judge/meta-verifier architecture unless better context
  still fails
- enrich the Slice 15 sample rows with explicit regenerated-seed context:
  - regenerated prompt input
  - regenerated prompt hint
  - regenerated modern title
  - regenerated module identity
  - regenerated scale
  - regenerated likely submodules
  - Slice 14 quality score
  - Slice 14 recommended status
  - trusted/iffy provenance
  - source HyperCard title and description
- make the classifier task explicit:
  - this is promotion review for regenerated prompt seeds
  - the question is whether a regenerated seed is trustworthy enough for later
    curation and lower-scale derivation
  - the task is not first-pass modernization or nostalgia recovery
- improve the judge prompt so MSS is used for:
  - boundedness
  - scale plausibility
  - family/structure fit
  - promotion suitability
  rather than scale inflation
- improve the meta prompt so it explicitly checks:
  - provenance-aware caution for iffy rows
  - overbuilt seed inflation
  - weak evidence for seed promotion
  - mismatch between regenerated prompt scope and recommended seed status
- keep spend visible in the sample run

## Preserve

- Slice 15 sample size: `100`
- Slice 15 sample concurrency: `5`
- trusted vs iffy provenance split
- the rule that Slice 15 consumes the regenerated Slice 14 outputs only

## Avoid

- treating Slice 14 `recommended` as automatic promotion
- rerunning the full seed-review lane before the 100-row sample improves
- dropping the original HyperCard evidence from the review payload
- letting generic polished prompt wording outweigh source evidence

## Acceptance Criteria

- the sample builder emits richer regenerated-seed review rows
- judge/meta prompts explicitly understand promotion review for regenerated seeds
- a rerun of the Slice 15 sample can fairly test classifier quality rather than
  missing context
- the slice ends with a clearer basis for:
  - trusted rate
  - recommended-for-seed-review rate
  - promotion criteria

## Deliverable

A better-contexted Slice 15 review lane and a fresh 100-row seed-review sample
run plan aimed at materially better classifier results.
