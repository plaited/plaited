# Slice 2: Small-Scale Eval Validation

## Target

Validate the Slice 1 eval themes, scoring rubric, and retained-output format
with a small number of direct sample runs before any larger-scale collection.

This slice should use the trial layer, not `research:overnight`.

## Scope

- native-model eval design validation only
- small sample execution using `src/improve/trial.ts` or equivalent wrapper
- no training and no repo-mutation keep/revise/discard loop
- no fake worker-branch orchestration

## Required

- run a small number of representative prompts from Slice 1
- use the trial runner or a thin trial-specific wrapper over the same substrate
- verify the judge and meta-verifier rubric are workable in practice
- confirm the retained output format is suitable for later curation and training
- document what should change before larger-scale collection begins

## Preserve

- this remains a validation step, not a production data-collection run
- eval themes remain Plaited-specific
- judge thresholds remain externally governed
- repeated executions should be immutable trial records, not branch mutations

## Avoid

- pretending this step is already the 3K-trial collection phase
- forcing the keep/revise/discard harness to generate eval prompts itself
- parallel worker orchestration before the eval design is validated
- treating repo-level commits as the unit of native-model validation

## Acceptance Criteria

- a small representative prompt set has been exercised successfully
- rubric gaps and output-format issues are documented explicitly
- the lane has a validated basis for later data-collection work
- the execution path is compatible with later pass@k-style repetition

## Suggested Execution Shape

Start with:

- 1 to 2 prompts per Slice 1 theme
- `k=2` to `k=3` runs per prompt
- low concurrency
- retained outputs written as JSONL trial results

The intent is to validate:

- prompt distinctness
- judge dimension usefulness
- meta-verifier trust labeling
- retained-output field completeness

This is not yet the large-scale corpus collection step.

## Trial Substrate

Preferred implementation path:

- `src/improve/trial.ts`
- `src/improve/trial.utils.ts`
- `skills/trial-runner/`
- `skills/trial-adapters/`

If a helper script is needed, it should wrap the trial substrate rather than
reimplementing a repo-autoresearch loop.

## Output

This slice should produce:

- a small validated trial result set
- documented rubric adjustments, if any
- documented retained-output adjustments, if any
- a go/no-go recommendation for broader collection
