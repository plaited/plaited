# Native-Model Validation Batch

This directory holds the first bounded validation batch for the native-model
lane. The batch runs through `src/improve/trial.ts` via the wrapper script
`scripts/improve-native-model-validation.ts`.

## Prompt Set

`slice-3-validation-prompts.jsonl` covers two Slice 1 themes:

- `mss-grounded-module-generation`
- `controller-compatible-ui-generation`

Each prompt stays inspection-oriented instead of mutating the repo. The grader
is intentionally lightweight and externalized in
`scripts/improve-native-model-validation-grader.ts`.

## Run It

```bash
bun run native-model:validate -- --adapter ./scripts/falcon-h1r-mlx-adapter.ts --timeout 90000
```

You can swap in any other trial adapter that follows the same contract:

```bash
NATIVE_MODEL_ADAPTER=./scripts/falcon-h1r-mlx-adapter.ts \
NATIVE_MODEL_VALIDATION_TIMEOUT_MS=90000 \
bun run native-model:validate
```

## Artifacts

Each run writes a timestamped folder under `./runs/` with:

- `run.json` — config and provenance for the batch
- `results.jsonl` — raw `TrialResult` records from the trial layer
- `summary.md` — human-readable summary split into validation success and training eligibility
- `summary.json` — machine-readable aggregated summary with the same split

These artifacts are intended to be easy to inspect without digging into
internal runner state.

Successful validation and training eligibility are still separate outcomes.
`results.jsonl` now carries adapter-reported `capture` evidence plus
`trainingAssessment` reasons/richness so it is visible whether a trial failed
eligibility because it only captured a messages-only transcript or because the
run/runtime itself was not clean enough to retain.
