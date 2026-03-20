# Slice 3: Native-Model Validation Driver

## Target

Build the first bounded native-model validation driver on top of the trial
layer so the native-model lane can execute small eval batches without using the
repo-autoresearch loop as the runtime.

## Scope

- `./package.json`
- `src/improve.ts`
- `src/improve/`
- `scripts/`
- `dev-research/native-model/`
- `dev-research/native-model/evals/`

## Required

- add a small native-model validation driver or wrapper script
- define a tiny prompt set covering 1 to 2 Slice 1 native-model themes
- route execution through the trial layer rather than repo mutation
- add a package-script entrypoint for running the validation batch
- make the resulting outputs and scores easy to inspect

## Preserve

- repo-autoresearch remains a bounded code-improvement harness
- native-model validation runs through the trial substrate
- provider-specific model bindings remain in `scripts/`
- output and provenance remain explicit

## Avoid

- turning the driver into a full large-scale collection system
- reintroducing fake worker-branch orchestration
- coupling the driver to one fixed model or one fixed machine
- burying retained-output inspection behind opaque tooling

## Acceptance Criteria

- a small validation batch can be launched from a package script
- the batch executes through the trial layer
- prompt cases for 1 to 2 native-model themes are present and documented
- output artifacts and scores are inspectable without reading raw internal state
- the driver is usable as the first executable step of native-model Slice 2

## Notes

This slice is about creating the first practical execution path for the
native-model lane.
Keep it intentionally small and validation-focused.
