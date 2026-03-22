# Slice 10

## Target

Do one final bounded calibration pass on the HyperCard reclassification judge
to reduce the remaining family and structure drift after Slice 9.

## Scope

- `scripts/hypercard-reclassification-judge.ts`
- `scripts/hypercard-reclassify.ts`
- `scripts/tests/hypercard-reclassification-judge.spec.ts`
- `scripts/tests/hypercard-reclassification-meta-verifier.spec.ts`

## Calibration Cases

Focus on the remaining drift patterns seen in the post-Slice-9 batches:

- `hypercard_laboratorytoolbox`
- `hypercard_hyperproject`
- `hypercard_construction-costs`
- `hypercard_software-inventory-revision`
- `hypercard_inventory-master-11`

## Required

- improve only prompt/rubric calibration and tightly related metadata flow
- preserve the current contract split:
  - fixed catalog `patternFamily`
  - fixed MSS `structure`
  - mechanics guided but not overconstrained
- make the prompt better at:
  - `business-process` vs `personal-data-manager` disambiguation
  - avoiding reflexive `collection` defaults when `list`, `hierarchy`,
    `matrix`, `steps`, or `form` fit better
  - deciding when an `S2` operational tool is seed-worthy breadth versus when
    seed review should be reserved for richer `S3/S4` patterns

## Preserve

- do not undo the Slice 9 gains around lexical snap-to-label resistance
- do not let the judge invent new catalog pattern families
- do not let the judge invent new MSS structure labels
- do not turn mechanics into a closed runtime enum

## Avoid

- broad taxonomy rewrites
- prompt bloat from dumping long reference docs verbatim
- overfitting to one artifact instead of the recurring drift pattern
- changing the whole reclassification pipeline rather than its calibration

## Acceptance Criteria

- the prompt more reliably distinguishes:
  - operational workflow modules from personal record-management modules
  - `collection` from `list`, `hierarchy`, `matrix`, `steps`, and `form`
- the known drift cases above improve or become more conservative
- the classifier remains selective on seed-worthiness after the change
- the change remains bounded to prompt/rubric tuning and targeted tests
