# Slice 2: Small-Scale Eval Validation

## Target

Validate the Slice 1 eval themes, scoring rubric, and retained-output format
with a small number of direct sample runs before any large-scale collection.

## Scope

- native-model eval design validation only
- small sample execution, not large-scale autoresearch
- no training or parallel worker orchestration

## Required

- run a small number of representative prompts from Slice 1
- verify the judge and meta-verifier rubric are workable in practice
- confirm the retained output format is suitable for later curation and training
- document what should change before larger-scale collection begins

## Preserve

- this remains a validation step, not a production data-collection run
- eval themes remain Plaited-specific
- judge thresholds remain externally governed

## Avoid

- pretending this step is already the 3K-trial collection phase
- forcing the keep/revise/discard harness to generate eval prompts itself
- parallel worker orchestration before the eval design is validated

## Acceptance Criteria

- a small representative prompt set has been exercised successfully
- rubric gaps and output-format issues are documented explicitly
- the lane has a validated basis for later data-collection work
