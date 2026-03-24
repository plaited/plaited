# Slice 21

## Target

Calibrate the Slice 15 seed-review context so the reclassification judge and
meta-verifier can review regenerated prompt seeds with the right MSS and
promotion context.

The current Slice 15 sample artifact is mechanically valid but under-contexted:
- it does not clearly explain that the rows are regenerated Slice 14 prompt
  seeds
- it provides only thin MSS fields
- it does not expose the regenerated module identity, likely submodules, or
  Slice 14 recommendation provenance strongly enough

This slice should improve the sample-builder and review prompt surfaces before
the next Slice 15 sample run.

## Scope

- `scripts/modnet-build-seed-review-sample.ts`
- `scripts/hypercard-reclassification-judge.ts`
- `scripts/hypercard-reclassification-meta-verifier.ts`
- `scripts/tests/`
- `dev-research/modnet/`

## Required

- preserve Slice 15 as a review/evaluation lane rather than an autoresearch
  generation lane
- keep the existing reclassification judge/meta-verifier flow unless stronger
  context alone is clearly insufficient
- improve the sample artifact so each row explicitly carries:
  - source HyperCard title/description
  - regenerated prompt input/hint
  - regenerated modern title
  - regenerated module identity
  - regenerated scale
  - regenerated likely submodules
  - Slice 14 quality score
  - trusted/iffy provenance
  - explicit indication that the row already passed Slice 14 recommendation
- improve the judge prompt so it knows:
  - this is a regenerated modern prompt seed, not a legacy prompt row
  - the task is promotion review for seed curation and later lower-scale
    derivation
  - MSS should be used to judge boundedness, scale plausibility, and promotion
    suitability, not to inflate the artifact
- improve the meta-verifier prompt so it checks:
  - consistency between regenerated seed context and the judge result
  - overbuilt scale inflation
  - weakly evidenced seed-promotion recommendations
  - provenance-aware caution for iffy rows

## Preserve

- Slice 15 sample size: `100`
- Slice 15 concurrency: `5`
- the requirement that Slice 15 consumes only the regenerated Slice 14 prompt
  set
- trusted vs iffy provenance separation

## Avoid

- treating Slice 14 `recommended=true` as automatic seed promotion
- dropping provenance from the seed-review sample rows
- overfitting the judge to handcrafted prompt assumptions instead of regenerated
  seed-review artifacts
- rerunning the Slice 15 sample before the context bundle is materially better

## Acceptance Criteria

- Slice 15 sample rows carry richer regenerated-seed context and provenance
- judge/meta prompts explicitly understand the promotion-review task
- a rerun of the 100-row Slice 15 sample can be justified as better-contexted
  than the aborted attempt

## Deliverable

A stronger Slice 15 seed-review artifact shape and prompt surface, ready for a
fresh 100-row sample review over regenerated prompt seeds.
