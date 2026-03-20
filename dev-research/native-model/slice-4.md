# Slice 4: Native-Model Validation Calibration

## Target

Calibrate the first native-model validation path so it produces stable
validation signals without overstating curation or training readiness.

This slice should respond directly to the first real validation run:

- timeout instability on one prompt
- prompt/grader mismatch for the module-outline theme
- reporting that does not clearly separate validation success from training
  eligibility

## Scope

- `./package.json`
- `src/improve.ts`
- `src/improve/`
- `scripts/`
- `dev-research/native-model/`
- `dev-research/native-model/evals/`

## Required

- make timeout behavior configurable and appropriate for the validation batch
- tighten the fit between the module-outline prompt and its grading signals
- distinguish validation-pass reporting from training-eligibility reporting
- preserve the small-batch validation workflow added in Slice 3

## Preserve

- the validation driver remains trial-layer based
- prompt count remains intentionally small
- provider-specific model bindings remain in `scripts/`
- training eligibility remains stricter than validation success

## Avoid

- expanding into broad corpus collection
- treating prompt calibration as a full native-model data pipeline
- hiding validation failure reasons behind one aggregate score
- lowering thresholds just to manufacture training eligibility

## Acceptance Criteria

- the validation driver can run with an explicit timeout suitable for the batch
- the module-outline prompt/grader pairing no longer fails for avoidable
  calibration reasons
- summaries and outputs clearly distinguish:
  - validation pass/fail
  - retention label
  - training eligibility
- the resulting validation batch gives a more trustworthy signal for whether
  native-model Slice 2 is ready to proceed

## Notes

This slice is calibration work on top of the new driver, not a new execution
model.
