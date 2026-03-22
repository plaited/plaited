# Slice 9

## Target

Improve the HyperCard reclassification judge prompt so it uses the right mix of
modnet skills and reference guidance to classify hard examples more accurately
without overcorrecting the classifier contract.

## Scope

- `scripts/hypercard-reclassification-judge.ts`
- `scripts/hypercard-reclassify.ts`
- `scripts/tests/hypercard-reclassification-judge.spec.ts`
- `scripts/tests/hypercard-reclassification-meta-verifier.spec.ts`

## Calibration Cases

Focus prompt/rubric tuning on known hard examples such as:

- `hypercard_keyboard-stack`
- `hypercard_laboratorytoolbox`
- `hypercard_accounting`

## Required

- improve the judge prompt and surrounding context, not the entire
  reclassification pipeline
- use the repo's own guidance sources deliberately:
  - `skills/mss-vocabulary`
  - `skills/modnet-node`
  - `skills/modnet-modules`
  - `dev-research/modnet/references/modnet-native-model-training-guide.md`
- preserve the current contract split:
  - fixed catalog `patternFamily`
  - fixed MSS `structure`
  - mechanics guided but not overconstrained
- make the prompt better at:
  - family disambiguation
  - scale judgment
  - seed-worthiness decisions
  - resisting lexical snap-to-label errors

## Preserve

- do not let the judge invent new catalog pattern families
- do not let the judge invent new MSS structure labels
- do not treat mechanics as a permanently closed runtime enum
- keep the reclassification pipeline usable as a seed-recovery workflow, not a
  full catalog rewrite tool

## Avoid

- broad prompt bloat from dumping full skills/docs verbatim
- overfitting to one example at the expense of the rest of the batch
- rewriting the entire HyperCard taxonomy or prompt catalog in this slice
- changing the classifier contract more than necessary

## Acceptance Criteria

- the judge prompt is more selective and more accurate on the known hard cases
- the resulting classifications stay inside the intended modnet vocabulary
- the prompt better distinguishes cases like:
  - `creative-tool` vs `instrument-control`
  - `business-process` vs `personal-data-manager`
  - `S3` block vs `S4` suite
- the change remains bounded to prompt/rubric tuning and targeted tests
