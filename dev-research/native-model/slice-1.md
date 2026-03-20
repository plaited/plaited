# Slice 1

## Target

Introduce a Native-Producer Attempt-DAG TeamHub at the start of the native-model lane.

## Scope

- native-model program scaffolding
- provenance and distillation metadata
- no broad framework rewrites

## Required

- attempt DAG retains producer-model identity
- native vs frontier producer comparison is explicit
- distillation suitability metadata is captured
- supports UI/module/runtime end-to-end task labeling

## Preserve

- framework and skills lanes remain separate from native-model work
- constitutional floor, grading policy, and distillation policy remain externally governed
- native traces are not automatically privileged without quality thresholds

## Avoid

- treating all framework keep traces as native-model training data
- open-ended self-modification
- changes to constitutional floor or grading policy without separate approval

## Acceptance Criteria

- producer-model identity is represented explicitly in retained attempt data
- distillation suitability metadata is captured and queryable
- the lane can distinguish native-model traces from frontier-model traces
- validation passes
