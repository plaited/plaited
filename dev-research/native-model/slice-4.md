# Slice 4: First Local Tuning Run

## Target

Prepare and launch the first local native-model tuning run from the curated
Slice 3 dataset.

This slice begins after:

- the validation path is stable
- at least some retained outputs are training-eligible
- `dev-research/native-model/evals/curated-good-outputs.jsonl` exists as the
  stable curation path

## Scope

- `./package.json`
- `scripts/`
- `dev-research/native-model/`
- `dev-research/native-model/evals/`

## Required

- define the first local tuning command for the curated dataset
- export the curated candidates into a trainer-friendly SFT dataset format
- write a stable run manifest with dataset path, base model, and output
  directory
- keep trainer execution external rather than hardwiring one training stack
  into framework code
- make the first local tuning command inspectable and reproducible

## Preserve

- provider/model-specific launch logic remains in `scripts/`
- the curated dataset remains the stable input boundary for tuning
- validation-ready and training-ready outputs remain distinct
- trainer infrastructure remains external to `src/`

## Avoid

- pretending inference servers are training pipelines
- coupling the repo to one mandatory trainer dependency too early
- training directly from raw validation `results.jsonl`
- expanding into large-scale self-distillation orchestration in this slice

## Acceptance Criteria

- there is a package-script entrypoint for the first local tuning run
- the command consumes `curated-good-outputs.jsonl`, not raw validation output
- running the command prepares a trainer-friendly dataset and a run manifest
- the command can optionally invoke an external trainer when configured
- the resulting workflow is good enough to start the first real local tuning
  pass on the new hardware

## Notes

This slice is about wiring the first practical local tuning path, not about
solving the full long-term training stack.
